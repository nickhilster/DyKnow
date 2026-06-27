import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  DEFAULT_REPO_DIFF_OUTPUT_PATH,
  DEFAULT_REPO_MAP_OUTPUT_PATH,
  type RepoMap,
  type RepoMapDiff,
  RepoMapSchema,
  compareRepoMaps,
  parseDyknowConfig,
} from "@dyknow/core";

import { scanWorkspace } from "./scan-service.js";
import { formatRelativePath, resolveWorkspacePath } from "./security.js";

function parseRepoMapSnapshot(
  snapshotText: string,
  snapshotPath: string,
): RepoMap {
  let value: unknown;

  try {
    value = JSON.parse(snapshotText);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unknown JSON parse error.";
    throw new Error(
      `Invalid repo map snapshot JSON at ${snapshotPath}: ${reason}`,
    );
  }

  try {
    return RepoMapSchema.parse(value);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unknown schema error.";
    throw new Error(`Invalid repo map snapshot at ${snapshotPath}: ${reason}`);
  }
}

export async function createRepoDiff(options: {
  configPath: string;
  cwd: string;
  outputPath: string;
  snapshotPath: string;
}): Promise<RepoMapDiff> {
  const rootPath = resolve(options.cwd);
  const configPath = await resolveWorkspacePath(
    rootPath,
    options.configPath,
    "Diff config path",
  );
  const outputPath = await resolveWorkspacePath(
    rootPath,
    options.outputPath,
    "Diff output path",
  );
  const snapshotPath = await resolveWorkspacePath(
    rootPath,
    options.snapshotPath,
    "Diff snapshot path",
  );
  const configText = await readFile(configPath, "utf8");
  const config = parseDyknowConfig(configText);
  let snapshotText: string;

  try {
    snapshotText = await readFile(snapshotPath, "utf8");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      throw new Error(
        `Could not find a repo map snapshot at ${formatRelativePath(rootPath, snapshotPath)}. Run dyknow scan first.`,
      );
    }

    throw error;
  }

  const previousRepoMap = parseRepoMapSnapshot(
    snapshotText,
    formatRelativePath(rootPath, snapshotPath),
  );
  const currentRepoMap = await scanWorkspace({
    config,
    configPath,
    outputPath: snapshotPath,
    rootPath,
  });
  const repoDiff = compareRepoMaps(previousRepoMap, currentRepoMap, {
    baseSnapshotPath: formatRelativePath(rootPath, snapshotPath),
    outputPath: formatRelativePath(rootPath, outputPath),
    pages: config.pages,
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(repoDiff, null, 2)}\n`, "utf8");

  return repoDiff;
}

export { DEFAULT_REPO_DIFF_OUTPUT_PATH, DEFAULT_REPO_MAP_OUTPUT_PATH };
