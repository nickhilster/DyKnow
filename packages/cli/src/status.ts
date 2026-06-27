import { DEFAULT_STATUS_OUTPUT_PATH, createStatusReport } from "@dyknow/app";

export { createStatusReport, DEFAULT_STATUS_OUTPUT_PATH };

export type StatusOptions = {
  outputPath: string;
};

export function parseStatusOptions(args: readonly string[]): StatusOptions {
  let outputPath = DEFAULT_STATUS_OUTPUT_PATH;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--output") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --output.");
      }

      outputPath = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown status option: ${argument}`);
  }

  return { outputPath };
}
