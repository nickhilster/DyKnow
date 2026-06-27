import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

import {
  DEFAULT_REPO_DIFF_OUTPUT_PATH,
  DEFAULT_REPO_MAP_OUTPUT_PATH,
  DEFAULT_UPDATE_OUTPUT_PATH,
  DYKNOW_CONFIG_FILE_NAME,
  DYKNOW_CONFIG_SCHEMA_FILE_NAME,
  type UpdateDraftBatch,
  UpdateDraftBatchSchema,
  parseDyknowConfig,
} from "@dyknow/core";

import {
  DEFAULT_AUDIT_LOG_PATH,
  appendAuditEntries,
  formatRelativePath,
} from "./audit.js";
import { DEFAULT_STATUS_OUTPUT_PATH } from "./status-service.js";
import {
  assertDraftMatchesConfiguredPage,
  resolveWorkspacePath,
} from "./security.js";

const execFileAsync = promisify(execFile);

export const DEFAULT_COMMIT_MESSAGE = "docs: apply approved dyknow updates";

export type CommitResult = {
  commitHash: string;
  inputPath: string;
  publishedProposals: number;
};

function getHighRiskPageIds(
  drafts: readonly UpdateDraftBatch["drafts"][number][],
) {
  return drafts
    .filter((draft) => draft.proposal.risk === "high")
    .map((draft) => draft.proposal.pageId)
    .sort((left, right) => left.localeCompare(right));
}

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

async function runGit(
  cwd: string,
  args: readonly string[],
  options?: { trimOutput?: boolean },
): Promise<string> {
  const result = await execFileAsync("git", [...args], {
    cwd,
    encoding: "utf8",
  });

  return options?.trimOutput === false ? result.stdout : result.stdout.trim();
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
  const status = await runGit(
    cwd,
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    { trimOutput: false },
  );
  const disallowedPaths = parseStatusPaths(status).filter(
    (path) => !allowedPaths.has(path),
  );

  if (disallowedPaths.length > 0) {
    throw new Error(
      "dyknow commit requires the worktree to be clean aside from the update-proposals artifact so the resulting commit only contains approved DyKnow updates.",
    );
  }
}

function createAllowedDyknowPaths(options: {
  inputPathRelative: string;
}): Set<string> {
  return new Set([
    DYKNOW_CONFIG_FILE_NAME,
    DYKNOW_CONFIG_SCHEMA_FILE_NAME,
    DEFAULT_REPO_MAP_OUTPUT_PATH,
    DEFAULT_REPO_DIFF_OUTPUT_PATH,
    options.inputPathRelative,
    DEFAULT_AUDIT_LOG_PATH,
    DEFAULT_STATUS_OUTPUT_PATH,
  ]);
}

async function pathExists(path: string) {
  try {
    await readFile(path, "utf8");
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return false;
    }

    throw error;
  }
}

export async function createCommitResult(options: {
  additionalAuditEntries?: readonly PendingAuditEntry[];
  allowHighRisk?: boolean;
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
  const allowedStatePaths = createAllowedDyknowPaths({ inputPathRelative });
  let snapshotText: string;

  await ensureCommitableWorktree(rootPath, allowedStatePaths);

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

  const highRiskPageIds = getHighRiskPageIds(approvedDrafts);

  if (highRiskPageIds.length > 0 && !options.allowHighRisk) {
    throw new Error(
      `Approved high-risk update proposals require --allow-high-risk before publish. Affected pages: ${highRiskPageIds.join(", ")}.`,
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
    ...(
      await Promise.all(
        [...allowedStatePaths].map(async (relativePath) =>
          (await pathExists(resolve(rootPath, relativePath)))
            ? relativePath
            : null,
        ),
      )
    ).filter((path): path is string => path !== null),
    ...approvedDrafts.map((draft) => draft.affectedPage.outputPath),
  ];

  await runGit(rootPath, ["add", ...filesToAdd]);
  await runGit(rootPath, ["commit", "-m", options.message]);

  return {
    commitHash: await runGit(rootPath, ["rev-parse", "--short", "HEAD"]),
    inputPath: inputPathRelative,
    publishedProposals: approvedDrafts.length,
  };
}
