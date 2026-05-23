import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import {
  DEFAULT_REPO_DIFF_OUTPUT_PATH,
  DEFAULT_REPO_MAP_OUTPUT_PATH,
  type RepoMap,
  type RepoMapDiff,
  RepoMapSchema,
  compareRepoMaps,
  parseDyknowConfig,
} from "@dyknow/core";

import { scanWorkspace } from "./scan.js";

export type DiffOptions = {
  configPath: string;
  outputPath: string;
  snapshotPath: string;
};

function toPortablePath(path: string): string {
  return path.replaceAll("\\", "/");
}

function formatRelativePath(rootPath: string, targetPath: string): string {
  return toPortablePath(relative(rootPath, targetPath) || targetPath);
}

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

export function parseDiffOptions(args: readonly string[]): DiffOptions {
  let configPath = "dyknow.config.json";
  let outputPath = DEFAULT_REPO_DIFF_OUTPUT_PATH;
  let snapshotPath = DEFAULT_REPO_MAP_OUTPUT_PATH;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--config") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --config.");
      }

      configPath = value;
      index += 1;
      continue;
    }

    if (argument === "--output") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --output.");
      }

      outputPath = value;
      index += 1;
      continue;
    }

    if (argument === "--snapshot") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --snapshot.");
      }

      snapshotPath = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown diff option: ${argument}`);
  }

  return { configPath, outputPath, snapshotPath };
}

export async function createRepoDiff(options: {
  configPath: string;
  cwd: string;
  outputPath: string;
  snapshotPath: string;
}): Promise<RepoMapDiff> {
  const rootPath = resolve(options.cwd);
  const configPath = resolve(rootPath, options.configPath);
  const outputPath = resolve(rootPath, options.outputPath);
  const snapshotPath = resolve(rootPath, options.snapshotPath);
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
