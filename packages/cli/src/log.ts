import {
  type AuditLogReport,
  DEFAULT_REVIEW_AUDIT_LOG_PATH,
  LOG_ACTION_FILTERS,
  LOG_SOURCES,
  type LogActionFilter,
  type LogSource,
  createAuditLogReport,
  supportsLogSourceFiltering,
} from "@dyknow/app";

export type LogOptions = {
  inputPath: string;
  limit: number;
  source: LogSource;
  action: LogActionFilter;
};

export function parseLogOptions(args: readonly string[]): LogOptions {
  let inputPath = DEFAULT_REVIEW_AUDIT_LOG_PATH;
  let limit = 10;
  let source: LogSource = "all";
  let action: LogActionFilter = "all";

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--input") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --input.");
      }

      inputPath = value;
      index += 1;
      continue;
    }

    if (argument === "--limit") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --limit.");
      }

      const parsed = Number.parseInt(value, 10);

      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("--limit must be a positive integer.");
      }

      limit = parsed;
      index += 1;
      continue;
    }

    if (argument === "--source") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --source.");
      }

      if (!LOG_SOURCES.includes(value as LogSource)) {
        throw new Error(`--source must be one of: ${LOG_SOURCES.join(", ")}.`);
      }

      source = value as LogSource;
      index += 1;
      continue;
    }

    if (argument === "--action") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --action.");
      }

      if (!LOG_ACTION_FILTERS.includes(value as LogActionFilter)) {
        throw new Error(
          `--action must be one of: ${LOG_ACTION_FILTERS.join(", ")}.`,
        );
      }

      action = value as LogActionFilter;
      index += 1;
      continue;
    }

    throw new Error(`Unknown log option: ${argument}`);
  }

  return { inputPath, limit, source, action };
}

export {
  DEFAULT_REVIEW_AUDIT_LOG_PATH,
  LOG_ACTION_FILTERS,
  LOG_SOURCES,
  createAuditLogReport,
  supportsLogSourceFiltering,
};
export type { AuditLogReport, LogActionFilter, LogSource };
