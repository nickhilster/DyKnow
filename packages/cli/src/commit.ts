import {
  type CommitResult,
  DEFAULT_COMMIT_MESSAGE,
  createCommitResult,
} from "@dyknow/app";
import { DEFAULT_UPDATE_OUTPUT_PATH } from "@dyknow/core";

export type CommitOptions = {
  allowHighRisk: boolean;
  inputPath: string;
  message: string;
};

export function parseCommitOptions(args: readonly string[]): CommitOptions {
  let inputPath = DEFAULT_UPDATE_OUTPUT_PATH;
  let message = DEFAULT_COMMIT_MESSAGE;
  let allowHighRisk = false;

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

    if (argument === "--allow-high-risk") {
      allowHighRisk = true;
      continue;
    }

    throw new Error(`Unknown commit option: ${argument}`);
  }

  return { allowHighRisk, inputPath, message };
}

export { DEFAULT_COMMIT_MESSAGE, createCommitResult };
export type { CommitResult };
