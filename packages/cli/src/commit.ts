import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { promisify } from "node:util";

import {
  DEFAULT_UPDATE_OUTPUT_PATH,
  type UpdateDraftBatch,
  UpdateDraftBatchSchema,
} from "@dyknow/core";

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

async function runGit(cwd: string, args: readonly string[]): Promise<string> {
  const result = await execFileAsync("git", [...args], {
    cwd,
    encoding: "utf8",
  });

  return result.stdout.trim();
}

function parseStatusPaths(status: string): string[] {
  return status
    .split(/\r?\n/)
    .filter((line) => line.length >= 4)
    .map((line) => line.slice(3))
    .map((path) => {
      const renamedPath = path.split(" -> ").at(-1) ?? path;

      return toPortablePath(renamedPath.trim());
    });
}

async function ensureCommitableWorktree(
  cwd: string,
  allowedPaths: ReadonlySet<string>,
) {
  const status = await runGit(cwd, [
    "status",
    "--short",
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
  cwd: string;
  inputPath: string;
  message: string;
}): Promise<CommitResult> {
  const rootPath = resolve(options.cwd);
  const inputPath = resolve(rootPath, options.inputPath);
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

  for (const draft of approvedDrafts) {
    const outputPath = resolve(rootPath, draft.affectedPage.outputPath);

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

  const filesToAdd = [
    ...approvedDrafts.map((draft) => draft.affectedPage.outputPath),
    inputPathRelative,
  ];

  await runGit(rootPath, ["add", ...filesToAdd]);
  await runGit(rootPath, ["commit", "-m", options.message]);

  return {
    commitHash: await runGit(rootPath, ["rev-parse", "--short", "HEAD"]),
    inputPath: inputPathRelative,
    publishedProposals: approvedDrafts.length,
  };
}
