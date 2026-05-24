import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { promisify } from "node:util";

import {
  type AuditLogEntry,
  AuditLogEntrySchema,
  DEFAULT_REPO_DIFF_OUTPUT_PATH,
  DEFAULT_UPDATE_OUTPUT_PATH,
  type RepoMapDiff,
  RepoMapDiffSchema,
  type ReviewState,
  type UpdateDraftBatch,
  UpdateDraftBatchSchema,
} from "@dyknow/core";

import {
  DEFAULT_AUDIT_LOG_PATH,
  formatRelativePath,
  resolveRuntimeAuditPath,
} from "./audit.js";
import { resolveWorkspacePath } from "./security.js";

const execFileAsync = promisify(execFile);

export const DEFAULT_STATUS_OUTPUT_PATH = "dyknow-progress-status.html";

export type StatusOptions = {
  outputPath: string;
};

type ReportAuditEntry = {
  entry: AuditLogEntry;
  inputPath: string;
  source: "committed" | "runtime";
};

type StatusReportResult = {
  outputPath: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseStatusOptions(args: readonly string[]): StatusOptions {
  let outputPath = DEFAULT_STATUS_OUTPUT_PATH;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--output") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --output.");
      }

      outputPath = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown status option: ${argument}`);
  }

  return { outputPath };
}

async function runGit(cwd: string, args: readonly string[]) {
  const result = await execFileAsync("git", [...args], {
    cwd,
    encoding: "utf8",
  });

  return result.stdout.trim();
}

async function readOptionalJson<T>(options: {
  cwd: string;
  label: string;
  path: string;
  schema: { parse(value: unknown): T };
}) {
  const absolutePath = await resolveWorkspacePath(
    options.cwd,
    options.path,
    options.label,
  );

  try {
    const input = await readFile(absolutePath, "utf8");
    return {
      data: options.schema.parse(JSON.parse(input)),
      inputPath: formatRelativePath(options.cwd, absolutePath),
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return undefined;
    }

    throw error;
  }
}

function parseAuditLogEntries(input: string, inputPath: string) {
  return input
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      let value: unknown;

      try {
        value = JSON.parse(line);
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : "Unknown JSON parse error.";
        throw new Error(
          `Invalid audit log JSON at ${inputPath}:${index + 1}: ${reason}`,
        );
      }

      return AuditLogEntrySchema.parse(value);
    });
}

async function readOptionalAuditEntries(options: {
  cwd: string;
  inputPath: string;
  source: "committed" | "runtime";
}) {
  const absolutePath =
    options.source === "runtime"
      ? options.inputPath
      : await resolveWorkspacePath(
          options.cwd,
          options.inputPath,
          "Status audit log path",
        );

  try {
    const input = await readFile(absolutePath, "utf8");

    return parseAuditLogEntries(
      input,
      formatRelativePath(options.cwd, absolutePath),
    ).map(
      (entry) =>
        ({
          entry,
          inputPath: formatRelativePath(options.cwd, absolutePath),
          source: options.source,
        }) satisfies ReportAuditEntry,
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }

    throw error;
  }
}

function countReviewStates(updateBatch?: UpdateDraftBatch) {
  const counts = new Map<ReviewState, number>();

  for (const draft of updateBatch?.drafts ?? []) {
    counts.set(
      draft.proposal.reviewState,
      (counts.get(draft.proposal.reviewState) ?? 0) + 1,
    );
  }

  return [...counts.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
}

function formatRepositoryName(remoteUrl: string | undefined, rootPath: string) {
  if (!remoteUrl) {
    return basename(rootPath);
  }

  const normalized = remoteUrl.replace(/\\/gu, "/");
  const lastSegment = normalized.split("/").at(-1) ?? normalized;

  return lastSegment.endsWith(".git")
    ? lastSegment.slice(0, lastSegment.length - 4)
    : lastSegment;
}

function renderStatusReport(options: {
  auditEntries: readonly ReportAuditEntry[];
  branch: string;
  head: string;
  latestCommit: string;
  outputPath: string;
  remoteUrl?: string;
  repoDiff?: RepoMapDiff;
  rootPath: string;
  statusSummary: string;
  totalCommits: number;
  updateBatch?: UpdateDraftBatch;
}) {
  const affectedPages = options.repoDiff?.affectedPages.length ?? 0;
  const draftedProposals = options.updateBatch?.drafts.length ?? 0;
  const reviewStateCounts = countReviewStates(options.updateBatch);
  const recentAuditEntries = options.auditEntries
    .slice()
    .sort((left, right) =>
      right.entry.timestamp.localeCompare(left.entry.timestamp),
    )
    .slice(0, 5);
  const repository = formatRepositoryName(options.remoteUrl, options.rootPath);
  const generatedDate = new Date().toISOString().slice(0, 10);
  const diffSummary = options.repoDiff?.summary ?? {
    addedFiles: 0,
    changedFiles: 0,
    removedFiles: 0,
    addedWarnings: 0,
    removedWarnings: 0,
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DyKnow Progress and Status Report</title>
  <style>
    :root {
      --bg: #0a1328;
      --panel: #111d3d;
      --panel-2: #18305f;
      --text: #ecf3ff;
      --muted: #c0d0f2;
      --accent: #6bd6ff;
      --good: #66d59b;
      --warn: #ffd166;
      --border: #27457f;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: "Segoe UI", "Arial", sans-serif;
      background:
        radial-gradient(1000px 700px at 100% 0%, rgba(72, 130, 255, 0.28), transparent 60%),
        linear-gradient(180deg, #091120 0%, #0a1328 100%);
      color: var(--text);
      line-height: 1.5;
    }

    .container {
      max-width: 1160px;
      margin: 0 auto;
      padding: 32px 20px 56px;
    }

    .hero, .card {
      border: 1px solid var(--border);
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(24, 48, 95, 0.92), rgba(17, 29, 61, 0.96));
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.22);
    }

    .hero {
      padding: 24px;
    }

    h1, h2 {
      margin: 0 0 10px;
    }

    h1 {
      font-size: clamp(1.6rem, 3vw, 2.5rem);
    }

    h2 {
      color: var(--accent);
      font-size: 1.1rem;
    }

    p {
      margin: 8px 0;
      color: var(--muted);
    }

    .meta, .grid {
      display: grid;
      gap: 14px;
    }

    .meta {
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      margin-top: 16px;
    }

    .meta div, .card {
      padding: 14px 16px;
    }

    .meta div {
      border: 1px solid var(--border);
      border-radius: 12px;
      background: rgba(8, 13, 27, 0.28);
    }

    .grid {
      grid-template-columns: repeat(12, 1fr);
      margin-top: 18px;
    }

    .kpi { grid-column: span 3; }
    .wide { grid-column: span 8; }
    .narrow { grid-column: span 4; }

    .value {
      font-size: 1.8rem;
      font-weight: 700;
      margin: 4px 0;
    }

    .label {
      color: var(--muted);
      font-size: 0.92rem;
    }

    .badge {
      display: inline-block;
      margin: 6px 8px 0 0;
      padding: 3px 10px;
      border-radius: 999px;
      border: 1px solid;
      font-size: 0.82rem;
      font-weight: 600;
    }

    .good {
      color: var(--good);
      background: rgba(102, 213, 155, 0.1);
      border-color: rgba(102, 213, 155, 0.4);
    }

    .warn {
      color: var(--warn);
      background: rgba(255, 209, 102, 0.1);
      border-color: rgba(255, 209, 102, 0.4);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 0.94rem;
    }

    th, td {
      text-align: left;
      padding: 9px 10px;
      border-bottom: 1px solid rgba(39, 69, 127, 0.85);
      vertical-align: top;
    }

    th {
      color: var(--accent);
      font-weight: 600;
    }

    ul {
      margin: 8px 0 0 18px;
      color: var(--muted);
    }

    code {
      background: rgba(8, 13, 27, 0.45);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 1px 6px;
      color: #dbe8ff;
    }

    .footer {
      margin-top: 26px;
      color: var(--muted);
      font-size: 0.9rem;
    }

    @media (max-width: 950px) {
      .kpi, .wide, .narrow {
        grid-column: span 12;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <section class="hero">
      <h1>DyKnow Progress and Status Report</h1>
      <p>Generated from live repository metadata plus the current DyKnow state artifacts.</p>
      <div class="meta">
        <div><strong>Report Date:</strong> ${escapeHtml(generatedDate)}</div>
        <div><strong>Repository:</strong> ${escapeHtml(repository)}</div>
        <div><strong>Branch:</strong> ${escapeHtml(options.branch)}</div>
        <div><strong>HEAD:</strong> <code>${escapeHtml(options.head)}</code></div>
        <div><strong>Total Commits:</strong> ${options.totalCommits}</div>
        <div><strong>Latest Commit:</strong> ${escapeHtml(options.latestCommit)}</div>
      </div>
    </section>

    <div class="grid">
      <article class="card kpi">
        <div class="value">${affectedPages}</div>
        <div class="label">Affected Pages in Current Repo Diff</div>
      </article>
      <article class="card kpi">
        <div class="value">${draftedProposals}</div>
        <div class="label">Draft Proposals in Current Update Batch</div>
      </article>
      <article class="card kpi">
        <div class="value">${options.auditEntries.length}</div>
        <div class="label">Audit Entries Available</div>
      </article>
      <article class="card kpi">
        <div class="value">${escapeHtml(options.statusSummary === "" ? "Clean" : "Dirty")}</div>
        <div class="label">Working Tree Status</div>
      </article>

      <article class="card wide">
        <h2>Executive Summary</h2>
        <p>This report is generated from current git metadata and validated DyKnow artifacts instead of hard-coded snapshot values.</p>
        <p>The repository is on <code>${escapeHtml(options.branch)}</code> at <code>${escapeHtml(options.head)}</code> with ${options.totalCommits} commit(s). The latest commit is <code>${escapeHtml(options.latestCommit)}</code>.</p>
        <div>
          <span class="badge ${options.statusSummary === "" ? "good" : "warn"}">Worktree: ${escapeHtml(options.statusSummary === "" ? "Clean" : "Has local changes")}</span>
          <span class="badge ${draftedProposals > 0 ? "warn" : "good"}">Drafts: ${draftedProposals}</span>
          <span class="badge ${affectedPages > 0 ? "warn" : "good"}">Affected Pages: ${affectedPages}</span>
        </div>
      </article>

      <article class="card narrow">
        <h2>Current Readiness</h2>
        <ul>
          <li>Repo diff artifact: ${escapeHtml(options.repoDiff ? "present" : "missing")}</li>
          <li>Update proposal artifact: ${escapeHtml(options.updateBatch ? "present" : "missing")}</li>
          <li>Audit visibility: ${escapeHtml(options.auditEntries.length > 0 ? "entries available" : "no entries found")}</li>
          <li>Working tree: ${escapeHtml(options.statusSummary === "" ? "clean" : "contains local changes")}</li>
        </ul>
      </article>

      <article class="card wide">
        <h2>Repo Diff Summary</h2>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Added files</td><td>${diffSummary.addedFiles}</td></tr>
            <tr><td>Changed files</td><td>${diffSummary.changedFiles}</td></tr>
            <tr><td>Removed files</td><td>${diffSummary.removedFiles}</td></tr>
            <tr><td>Added warnings</td><td>${diffSummary.addedWarnings}</td></tr>
            <tr><td>Removed warnings</td><td>${diffSummary.removedWarnings}</td></tr>
          </tbody>
        </table>
      </article>

      <article class="card narrow">
        <h2>Proposal States</h2>
        ${
          reviewStateCounts.length > 0
            ? `<ul>${reviewStateCounts
                .map(
                  ([state, count]) => `<li>${escapeHtml(state)}: ${count}</li>`,
                )
                .join("")}</ul>`
            : "<p>No drafted proposals are available.</p>"
        }
      </article>

      <article class="card wide">
        <h2>Recent Audit Activity</h2>
        ${
          recentAuditEntries.length > 0
            ? `<table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Sources</th>
              <th>Log</th>
            </tr>
          </thead>
          <tbody>
            ${recentAuditEntries
              .map(
                ({ entry, inputPath }) =>
                  `<tr><td>${escapeHtml(entry.timestamp)}</td><td>${escapeHtml(entry.action)}</td><td>${escapeHtml(entry.sourcesRead.join(", ") || "none")}</td><td>${escapeHtml(inputPath)}</td></tr>`,
              )
              .join("")}
          </tbody>
        </table>`
            : "<p>No audit entries are available yet.</p>"
        }
      </article>
    </div>

    <p class="footer">Generated by DyKnow Local at <code>${escapeHtml(options.outputPath)}</code>.</p>
  </div>
</body>
</html>
`;
}

export async function createStatusReport(options: {
  cwd: string;
  outputPath: string;
}): Promise<StatusReportResult> {
  const rootPath = resolve(options.cwd);
  const outputPath = await resolveWorkspacePath(
    rootPath,
    options.outputPath,
    "Status output path",
  );
  const [branch, head, totalCommitsText, latestCommit, statusSummary] =
    await Promise.all([
      runGit(rootPath, ["branch", "--show-current"]),
      runGit(rootPath, ["rev-parse", "--short", "HEAD"]),
      runGit(rootPath, ["rev-list", "--count", "HEAD"]),
      runGit(rootPath, ["log", "-1", "--pretty=%s"]),
      runGit(rootPath, ["status", "--short"]),
    ]);
  const remoteUrl = await runGit(rootPath, [
    "remote",
    "get-url",
    "origin",
  ]).catch(() => undefined);
  const [
    repoDiffArtifact,
    updateBatchArtifact,
    committedAuditEntries,
    runtimeAuditEntries,
  ] = await Promise.all([
    readOptionalJson({
      cwd: rootPath,
      label: "Status repo diff path",
      path: DEFAULT_REPO_DIFF_OUTPUT_PATH,
      schema: RepoMapDiffSchema,
    }),
    readOptionalJson({
      cwd: rootPath,
      label: "Status update proposals path",
      path: DEFAULT_UPDATE_OUTPUT_PATH,
      schema: UpdateDraftBatchSchema,
    }),
    readOptionalAuditEntries({
      cwd: rootPath,
      inputPath: DEFAULT_AUDIT_LOG_PATH,
      source: "committed",
    }),
    resolveRuntimeAuditPath(rootPath).then((runtimePath) =>
      runtimePath
        ? readOptionalAuditEntries({
            cwd: rootPath,
            inputPath: runtimePath,
            source: "runtime",
          })
        : [],
    ),
  ]);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    renderStatusReport({
      auditEntries: [...committedAuditEntries, ...runtimeAuditEntries],
      branch,
      head,
      latestCommit,
      outputPath: formatRelativePath(rootPath, outputPath),
      rootPath,
      statusSummary,
      totalCommits: Number.parseInt(totalCommitsText, 10),
      ...(remoteUrl ? { remoteUrl } : {}),
      ...(repoDiffArtifact ? { repoDiff: repoDiffArtifact.data } : {}),
      ...(updateBatchArtifact
        ? { updateBatch: updateBatchArtifact.data }
        : {}),
    }),
    "utf8",
  );

  return {
    outputPath: formatRelativePath(rootPath, outputPath),
  };
}

export { parseStatusOptions };
