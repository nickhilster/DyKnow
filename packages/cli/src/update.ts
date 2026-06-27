import {
  DEFAULT_REPO_DIFF_OUTPUT_PATH,
  DEFAULT_UPDATE_OUTPUT_PATH,
  DYKNOW_CONFIG_FILE_NAME,
  createUpdateDraftBatch,
} from "@dyknow/app";

export {
  createUpdateDraftBatch,
  DEFAULT_REPO_DIFF_OUTPUT_PATH,
  DEFAULT_UPDATE_OUTPUT_PATH,
  DYKNOW_CONFIG_FILE_NAME,
};

export type UpdateOptions = {
  configPath: string;
  diffPath: string;
  outputPath: string;
};

export function parseUpdateOptions(args: readonly string[]): UpdateOptions {
  let configPath = DYKNOW_CONFIG_FILE_NAME;
  let diffPath = DEFAULT_REPO_DIFF_OUTPUT_PATH;
  let outputPath = DEFAULT_UPDATE_OUTPUT_PATH;

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

    if (argument === "--diff") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --diff.");
      }

      diffPath = value;
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

    throw new Error(`Unknown update option: ${argument}`);
  }

  return { configPath, diffPath, outputPath };
}
