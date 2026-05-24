import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

import {
  DEFAULT_UPDATE_OUTPUT_PATH,
  type UpdateDraftBatch,
  UpdateDraftBatchSchema,
  parseDyknowConfig,
} from "@dyknow/core";

import {
  DEFAULT_AUDIT_LOG_PATH,
  appendAuditEntries,
  formatRelativePath,
} from "./audit.js";
import {
  assertDraftMatchesConfiguredPage,
  resolveWorkspacePath,
} from "./security.js";

const execFileAsync = promisify(execFile);

export const DEFAULT_COMMIT_MESSAGE = "docs: apply approved dyknow updates";

export type CommitOptions = {
  inputPath: string;
  message: string;
};

export type CommitResult = {
  commitHash: string;
  inputPath: string;
  publishedProposals: number;
};

type PendingAuditEntry = {
  action: string;
  entries: readonly {
    outputsAffected: readonly string[];
    sourcesRead: readonly string[];
  }[];
};

function parseUpdateBatch(
  snapshotText: string,
  snapshotPath: string,
): UpdateDraftBatch {
  let value: unknown;

  try {
    value = JSON.parse(snapshotText);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unknown JSON parse error.";
    throw new Error(
      `Invalid update proposals JSON at ${snapshotPath}: ${reason}`,
    );
  }

  try {
    return UpdateDraftBatchSchema.parse(value);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unknown schema error.";
    throw new Error(`Invalid update proposals at ${snapshotPath}: ${reason}`);
  }
}

async function runGit(cwd: string, args: readonly string[]): Promise<string> {
  const result = await execFileAsync("git", [...args], {
    cwd,
    encoding: "utf8",
  });

  return result.stdout.trim();
}

function parseStatusPaths(status: string): string[] {
  const entries = status.split("\0").filter((entry) => entry.length >= 4);
  const paths: string[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];

    if (!entry) {
      continue;
    }

    const code = entry.slice(0, 2);
    const renamedPath = entries[index + 1];

    if ((code.includes("R") || code.includes("C")) && renamedPath) {
      paths.push(renamedPath.trim().replaceAll("\\", "/"));
      index += 1;
      continue;
    }

    paths.push(entry.slice(3).trim().replaceAll("\\", "/"));
  }

  return paths;
}

async function ensureCommitableWorktree(
  cwd: string,
  allowedPaths: ReadonlySet<string>,
) {
  const status = await runGit(cwd, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
  ]);
  const disallowedPaths = parseStatusPaths(status).filter(
    (path) => !allowedPaths.has(path),
  );

  if (disallowedPaths.length > 0) {
    throw new Error(
      "dyknow commit requires the worktree to be clean aside from the update-proposals artifact so the resulting commit only contains approved DyKnow updates.",
    );
  }
}

export function parseCommitOptions(args: readonly string[]): CommitOptions {
  let inputPath = DEFAULT_UPDATE_OUTPUT_PATH;
  let message = DEFAULT_COMMIT_MESSAGE;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === undefined) {
      break;
    }

    if (argument === "--input") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --input.");
      }

      inputPath = value;
      index += 1;
      continue;
    }

    if (argument === "--message") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --message.");
      }

      message = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown commit option: ${argument}`);
  }

  return { inputPath, message };
}

export async function createCommitResult(options: {
  additionalAuditEntries?: readonly PendingAuditEntry[];
  cwd: string;
  inputPath: string;
  message: string;
}): Promise<CommitResult> {
  const rootPath = resolve(options.cwd);
  const inputPath = await resolveWorkspacePath(
    rootPath,
    options.inputPath,
    "Commit input path",
  );
  const inputPathRelative = formatRelativePath(rootPath, inputPath);
  let snapshotText: string;

  await ensureCommitableWorktree(rootPath, new Set([inputPathRelative]));

  try {
    snapshotText = await readFile(inputPath, "utf8");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      throw new Error(
        `Could not find update proposals at ${inputPathRelative}. Run dyknow update first.`,
      );
    }

    throw error;
  }

  const updateBatch = parseUpdateBatch(snapshotText, inputPathRelative);
  const approvedDrafts = updateBatch.drafts.filter(
    (draft) => draft.proposal.reviewState === "Approved",
  );

  if (approvedDrafts.length === 0) {
    throw new Error(
      `No approved update proposals were found in ${formatRelativePath(rootPath, inputPath)}. Run dyknow review --approve first.`,
    );
  }

  const configPath = await resolveWorkspacePath(
    rootPath,
    updateBatch.configPath,
    "Commit config path",
  );
  const config = parseDyknowConfig(await readFile(configPath, "utf8"));

  for (const draft of approvedDrafts) {
    const page = config.pages.find(
      (candidate) => candidate.id === draft.proposal.pageId,
    );

    if (!page) {
      throw new Error(
        `Approved update proposal referenced unknown page "${draft.proposal.pageId}". Regenerate dyknow update with the current config.`,
      );
    }

    assertDraftMatchesConfiguredPage(draft, page, "Approved update proposal");
    const outputPath = await resolveWorkspacePath(
      rootPath,
      page.outputPath,
      "Approved page output path",
    );

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${draft.proposal.proposedText}\n`, "utf8");
  }

  const nextBatch = UpdateDraftBatchSchema.parse({
    ...updateBatch,
    outputPath: formatRelativePath(rootPath, inputPath),
    drafts: updateBatch.drafts.map((draft) => {
      if (draft.proposal.reviewState !== "Approved") {
        return draft;
      }

      return {
        ...draft,
        proposal: {
          ...draft.proposal,
          reviewState: "Published",
        },
      };
    }),
  });

  await writeFile(inputPath, `${JSON.stringify(nextBatch, null, 2)}\n`, "utf8");

  await appendAuditEntries({
    action: "publish:commit",
    entries: approvedDrafts.map((draft) => ({
      outputsAffected: [draft.affectedPage.outputPath, inputPathRelative],
      sourcesRead: draft.proposal.sources,
    })),
    rootPath,
  });

  for (const pendingEntry of options.additionalAuditEntries ?? []) {
    await appendAuditEntries({
      action: pendingEntry.action,
      entries: pendingEntry.entries,
      rootPath,
    });
  }

  const filesToAdd = [
    ...approvedDrafts.map((draft) => draft.affectedPage.outputPath),
    inputPathRelative,
    DEFAULT_AUDIT_LOG_PATH,
  ];

  await runGit(rootPath, ["add", ...filesToAdd]);
  await runGit(rootPath, ["commit", "-m", options.message]);

  return {
    commitHash: await runGit(rootPath, ["rev-parse", "--short", "HEAD"]),
    inputPath: inputPathRelative,
    publishedProposals: approvedDrafts.length,
  };
}
