import {
  DEFAULT_COMMIT_MESSAGE,
  DEFAULT_PR_BASE_BRANCH,
  DEFAULT_PR_TITLE,
  type PrResult,
  buildPrBody,
  createPrResult,
} from "@dyknow/app";
import { DEFAULT_UPDATE_OUTPUT_PATH } from "@dyknow/core";

export type PrOptions = {
  allowHighRisk: boolean;
  base: string;
  branch?: string;
  inputPath: string;
  message: string;
  title: string;
};

export function parsePrOptions(args: readonly string[]): PrOptions {
  let base = DEFAULT_PR_BASE_BRANCH;
  let allowHighRisk = false;
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

    if (argument === "--allow-high-risk") {
      allowHighRisk = true;
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
    return { allowHighRisk, base, branch, inputPath, message, title };
  }

  return { allowHighRisk, base, inputPath, message, title };
}

export {
  DEFAULT_COMMIT_MESSAGE,
  DEFAULT_PR_BASE_BRANCH,
  DEFAULT_PR_TITLE,
  buildPrBody,
  createPrResult,
};
export type { PrResult };
