import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { promisify } from "node:util";

import {
  DEFAULT_UPDATE_OUTPUT_PATH,
  type DraftedPageUpdate,
  type UpdateDraftBatch,
  UpdateDraftBatchSchema,
} from "@dyknow/core";

import { appendAuditEntries, resolveRuntimeAuditPath } from "./audit.js";
import {
  DEFAULT_COMMIT_MESSAGE,
  createCommitResult,
} from "./commit-service.js";
import {
  assertValidGitBranchName,
  resolveWorkspacePath,
  runConfiguredCommand,
} from "./security.js";

const execFileAsync = promisify(execFile);

export const DEFAULT_PR_BASE_BRANCH = "main";
export const DEFAULT_PR_TITLE = "Apply approved DyKnow updates";

function getGhCommand(): string {
  return process.env.DYKNOW_GH_COMMAND ?? "gh";
}

export type PrResult = {
  base: string;
  branch: string;
  commitHash: string;
  publishedProposals: number;
  publishMode: "approved" | "published";
  url: string;
};

type PublishableDraftState = "Approved" | "Published";

function formatRelativePath(rootPath: string, targetPath: string) {
  return relative(rootPath, targetPath).replaceAll("\\", "/") || targetPath;
}

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

async function runGit(cwd: string, args: readonly string[]) {
  const result = await execFileAsync("git", [...args], {
    cwd,
    encoding: "utf8",
  });

  return result.stdout.trim();
}

async function readPublishableDrafts(options: {
  cwd: string;
  inputPath: string;
}): Promise<{
  batch: UpdateDraftBatch;
  drafts: DraftedPageUpdate[];
  draftState: PublishableDraftState;
  inputPathRelative: string;
}> {
  const rootPath = resolve(options.cwd);
  const inputPath = await resolveWorkspacePath(
    rootPath,
    options.inputPath,
    "PR input path",
  );
  const inputPathRelative = formatRelativePath(rootPath, inputPath);
  let snapshotText: string;

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

  const batch = parseUpdateBatch(snapshotText, inputPathRelative);
  const approvedDrafts = batch.drafts.filter(
    (draft) => draft.proposal.reviewState === "Approved",
  );

  if (approvedDrafts.length > 0) {
    return {
      batch,
      drafts: approvedDrafts,
      draftState: "Approved",
      inputPathRelative,
    };
  }

  const publishedDrafts = batch.drafts.filter(
    (draft) => draft.proposal.reviewState === "Published",
  );

  if (publishedDrafts.length === 0) {
    throw new Error(
      `No approved or published update proposals were found in ${inputPathRelative}. Run dyknow review --approve or dyknow commit first.`,
    );
  }

  return {
    batch,
    drafts: publishedDrafts,
    draftState: "Published",
    inputPathRelative,
  };
}

function createDefaultBranchName(date: Date): string {
  const timestamp = date
    .toISOString()
    .replaceAll(/[-:]/g, "")
    .replace(".000Z", "")
    .replace("T", "-");

  return `dyknow/update-${timestamp.toLowerCase()}`;
}

function renderMarkdownTable(drafts: readonly DraftedPageUpdate[]): string {
  const rows = drafts.map((draft) => {
    const sources = draft.proposal.sources.join("<br>");

    return `| ${draft.affectedPage.pageId} | ${draft.affectedPage.outputPath} | ${draft.proposal.risk} | ${draft.proposal.confidence} | ${sources} |`;
  });

  return [
    "| Page | Output | Risk | Confidence | Sources |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

export function buildPrBody(options: {
  drafts: readonly DraftedPageUpdate[];
  batch: UpdateDraftBatch;
}): string {
  return [
    "## Summary",
    `Open a pull request for ${options.drafts.length} DyKnow update proposal(s) drafted from ${options.batch.repoDiffPath}.`,
    "",
    "## Updated pages",
    renderMarkdownTable(options.drafts),
  ].join("\n");
}

async function ensureCurrentBranchIsAheadOfBaseRemote(
  rootPath: string,
  base: string,
) {
  const comparison = await runGit(rootPath, [
    "rev-list",
    "--left-right",
    "--count",
    `origin/${base}...HEAD`,
  ]);
  const [behindCountText, aheadCountText] = comparison.split(/\s+/u);
  const behindCount = Number(behindCountText ?? "0");
  const aheadCount = Number(aheadCountText ?? "0");

  if (
    !Number.isFinite(behindCount) ||
    !Number.isFinite(aheadCount) ||
    aheadCount <= 0
  ) {
    throw new Error(
      `Published DyKnow proposals must already exist in a local commit ahead of origin/${base} before opening a PR.`,
    );
  }
}

export async function createPrResult(options: {
  allowHighRisk?: boolean;
  cwd: string;
  base: string;
  branch?: string;
  inputPath: string;
  message: string;
  title: string;
  now?: Date;
}): Promise<PrResult> {
  const rootPath = resolve(options.cwd);
  await assertValidGitBranchName(rootPath, options.base, "base branch name");
  const currentBranch = await runGit(rootPath, ["branch", "--show-current"]);

  if (currentBranch !== options.base) {
    throw new Error(
      `dyknow pr must start from the base branch "${options.base}", but the current branch is "${currentBranch}". Checkout ${options.base} or pass --base ${currentBranch}.`,
    );
  }

  const { batch, drafts, draftState } = await readPublishableDrafts({
    cwd: rootPath,
    inputPath: options.inputPath,
  });
  const branch =
    options.branch ?? createDefaultBranchName(options.now ?? new Date());
  await assertValidGitBranchName(rootPath, branch, "PR branch name");
  const body = buildPrBody({ drafts, batch });

  await runGit(rootPath, ["checkout", "-b", branch]);
  let commitHash: string;
  let publishedProposals: number;

  if (draftState === "Approved") {
    const commitResult = await createCommitResult({
      additionalAuditEntries: [
        {
          action: "publish:pr-prepared",
          entries: [
            {
              outputsAffected: [
                ...drafts.map((draft) => draft.affectedPage.outputPath),
                formatRelativePath(
                  rootPath,
                  resolve(rootPath, options.inputPath),
                ),
              ],
              sourcesRead: drafts.flatMap((draft) => draft.proposal.sources),
            },
          ],
        },
      ],
      cwd: rootPath,
      inputPath: options.inputPath,
      message: options.message,
      ...(options.allowHighRisk
        ? { allowHighRisk: options.allowHighRisk }
        : {}),
    });
    commitHash = commitResult.commitHash;
    publishedProposals = commitResult.publishedProposals;
  } else {
    await ensureCurrentBranchIsAheadOfBaseRemote(rootPath, options.base);
    commitHash = await runGit(rootPath, ["rev-parse", "--short", "HEAD"]);
    publishedProposals = drafts.length;
  }

  await runGit(rootPath, ["push", "--set-upstream", "origin", branch]);

  const url = await runConfiguredCommand({
    args: [
      "pr",
      "create",
      "--base",
      options.base,
      "--head",
      branch,
      "--title",
      options.title,
      "--body",
      body,
    ],
    commandText: getGhCommand(),
    cwd: rootPath,
    label: "GitHub CLI command",
  });

  const runtimeAuditPath = await resolveRuntimeAuditPath(rootPath);

  if (runtimeAuditPath) {
    await appendAuditEntries({
      action: "publish:pr-opened",
      auditPath: runtimeAuditPath,
      entries: [
        {
          outputsAffected: [
            ...drafts.map((draft) => draft.affectedPage.outputPath),
            formatRelativePath(rootPath, resolve(rootPath, options.inputPath)),
            `github-pr:${url}`,
          ],
          sourcesRead: drafts.flatMap((draft) => draft.proposal.sources),
        },
      ],
      rootPath,
    });
  }

  return {
    base: options.base,
    branch,
    commitHash,
    publishedProposals,
    publishMode: draftState === "Approved" ? "approved" : "published",
    url,
  };
}

export { DEFAULT_COMMIT_MESSAGE };
