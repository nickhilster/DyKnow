import {
  DEFAULT_REPO_DIFF_OUTPUT_PATH,
  DEFAULT_REPO_MAP_OUTPUT_PATH,
  createRepoDiff,
} from "@dyknow/app";

export {
  createRepoDiff,
  DEFAULT_REPO_DIFF_OUTPUT_PATH,
  DEFAULT_REPO_MAP_OUTPUT_PATH,
};

export type DiffOptions = {
  configPath: string;
  outputPath: string;
  snapshotPath: string;
};

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
