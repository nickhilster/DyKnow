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

import { appendAuditEntries } from "./audit.js";
import { DEFAULT_COMMIT_MESSAGE, createCommitResult } from "./commit.js";

const execFileAsync = promisify(execFile);

export const DEFAULT_PR_BASE_BRANCH = "main";
export const DEFAULT_PR_TITLE = "Apply approved DyKnow updates";

function getGhCommand(): string {
  return process.env.DYKNOW_GH_COMMAND ?? "gh";
}

export type PrOptions = {
  base: string;
  branch?: string;
  inputPath: string;
  message: string;
  title: string;
};

export type PrResult = {
  base: string;
  branch: string;
  commitHash: string;
  publishedProposals: number;
  url: string;
};

function toPortablePath(path: string): string {
  return path.replaceAll("\\", "/");
}

function formatRelativePath(rootPath: string, targetPath: string): string {
  return toPortablePath(relative(rootPath, targetPath) || targetPath);
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

async function runCommand(
  command: string,
  cwd: string,
  args: readonly string[],
) {
  if (/\.(cmd|bat)$/i.test(command)) {
    const result = await execFileAsync("cmd.exe", ["/c", command, ...args], {
      cwd,
      encoding: "utf8",
    });

    return result.stdout.trim();
  }

  const result = await execFileAsync(command, [...args], {
    cwd,
    encoding: "utf8",
  });

  return result.stdout.trim();
}

async function runGit(cwd: string, args: readonly string[]) {
  return runCommand("git", cwd, args);
}

async function readApprovedDrafts(options: {
  cwd: string;
  inputPath: string;
}): Promise<{
  approvedDrafts: DraftedPageUpdate[];
  batch: UpdateDraftBatch;
  inputPathRelative: string;
}> {
  const rootPath = resolve(options.cwd);
  const inputPath = resolve(rootPath, options.inputPath);
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

  if (approvedDrafts.length === 0) {
    throw new Error(
      `No approved update proposals were found in ${inputPathRelative}. Run dyknow review --approve first.`,
    );
  }

  return {
    approvedDrafts,
    batch,
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
  approvedDrafts: readonly DraftedPageUpdate[];
  batch: UpdateDraftBatch;
}): string {
  return [
    "## Summary",
    `Apply ${options.approvedDrafts.length} approved DyKnow update proposal(s) drafted from ${options.batch.repoDiffPath}.`,
    "",
    "## Updated pages",
    renderMarkdownTable(options.approvedDrafts),
  ].join("\n");
}

export function parsePrOptions(args: readonly string[]): PrOptions {
  let base = DEFAULT_PR_BASE_BRANCH;
  let branch: string | undefined;
  let inputPath = DEFAULT_UPDATE_OUTPUT_PATH;
  let message = DEFAULT_COMMIT_MESSAGE;
  let title = DEFAULT_PR_TITLE;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === undefined) {
      break;
    }

    if (argument === "--base") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --base.");
      }

      base = value;
      index += 1;
      continue;
    }

    if (argument === "--branch") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --branch.");
      }

      branch = value;
      index += 1;
      continue;
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

    if (argument === "--title") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --title.");
      }

      title = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown pr option: ${argument}`);
  }

  if (branch) {
    return { base, branch, inputPath, message, title };
  }

  return { base, inputPath, message, title };
}

export async function createPrResult(options: {
  cwd: string;
  base: string;
  branch?: string;
  inputPath: string;
  message: string;
  title: string;
  now?: Date;
}): Promise<PrResult> {
  const rootPath = resolve(options.cwd);
  const currentBranch = await runGit(rootPath, ["branch", "--show-current"]);

  if (currentBranch !== options.base) {
    throw new Error(
      `dyknow pr must start from the base branch "${options.base}", but the current branch is "${currentBranch}". Checkout ${options.base} or pass --base ${currentBranch}.`,
    );
  }

  const { approvedDrafts, batch } = await readApprovedDrafts({
    cwd: rootPath,
    inputPath: options.inputPath,
  });
  const branch =
    options.branch ?? createDefaultBranchName(options.now ?? new Date());
  const body = buildPrBody({ approvedDrafts, batch });

  await runGit(rootPath, ["checkout", "-b", branch]);

  const commitResult = await createCommitResult({
    additionalAuditEntries: [
      {
        action: "publish:pr-prepared",
        entries: [
          {
            outputsAffected: [
              ...approvedDrafts.map((draft) => draft.affectedPage.outputPath),
              formatRelativePath(
                rootPath,
                resolve(rootPath, options.inputPath),
              ),
            ],
            sourcesRead: approvedDrafts.flatMap(
              (draft) => draft.proposal.sources,
            ),
          },
        ],
      },
    ],
    cwd: rootPath,
    inputPath: options.inputPath,
    message: options.message,
  });

  await runGit(rootPath, ["push", "--set-upstream", "origin", branch]);

  const url = await runCommand(getGhCommand(), rootPath, [
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
  ]);

  return {
    base: options.base,
    branch,
    commitHash: commitResult.commitHash,
    publishedProposals: commitResult.publishedProposals,
    url,
  };
}
