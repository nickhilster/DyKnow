import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { type AuditLogEntry, AuditLogEntrySchema } from "@dyknow/core";

import { resolveRuntimeAuditPath } from "./audit.js";

export const DEFAULT_REVIEW_AUDIT_LOG_PATH =
  "docs/dyknow/.state/audit-log.jsonl";

export const LOG_SOURCES = ["all", "committed", "runtime"] as const;
export const LOG_ACTION_FILTERS = ["all", "review", "publish"] as const;

export type LogSource = (typeof LOG_SOURCES)[number];
export type LogActionFilter = (typeof LOG_ACTION_FILTERS)[number];

export type LogOptions = {
  inputPath: string;
  limit: number;
  source: LogSource;
  action: LogActionFilter;
};

export type AuditLogReport = {
  inputPath: string;
  report: string;
  shownEntries: number;
  totalEntries: number;
};

type ReportAuditEntry = {
  entry: AuditLogEntry;
  inputPath: string;
  source: Exclude<LogSource, "all">;
};

function formatRelativePath(rootPath: string, targetPath: string): string {
  return relative(rootPath, targetPath).replaceAll("\\", "/") || targetPath;
}

function parseAuditLine(line: string, lineNumber: number, inputPath: string) {
  let value: unknown;

  try {
    value = JSON.parse(line);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unknown JSON parse error.";
    throw new Error(
      `Invalid audit log JSON at ${inputPath}:${lineNumber}: ${reason}`,
    );
  }

  try {
    return AuditLogEntrySchema.parse(value);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unknown schema error.";
    throw new Error(
      `Invalid audit log entry at ${inputPath}:${lineNumber}: ${reason}`,
    );
  }
}

async function readAuditEntries(options: {
  inputPath: string;
  rootPath: string;
  source: Exclude<LogSource, "all">;
}) {
  const absolutePath = resolve(options.rootPath, options.inputPath);
  let inputText: string;

  try {
    inputText = await readFile(absolutePath, "utf8");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {
        entries: [] as ReportAuditEntry[],
        inputPath: formatRelativePath(options.rootPath, absolutePath),
        source: options.source,
      };
    }

    throw error;
  }

  return {
    entries: inputText
      .split(/\r?\n/u)
      .filter((line) => line.trim().length > 0)
      .map(
        (line, index) =>
          ({
            entry: parseAuditLine(
              line,
              index + 1,
              formatRelativePath(options.rootPath, absolutePath),
            ),
            inputPath: formatRelativePath(options.rootPath, absolutePath),
            source: options.source,
          }) satisfies ReportAuditEntry,
      ),
    inputPath: formatRelativePath(options.rootPath, absolutePath),
    source: options.source,
  };
}

function formatEntry(reportEntry: ReportAuditEntry): string {
  const { entry, inputPath } = reportEntry;
  const sourceList =
    entry.sourcesRead.length > 0 ? entry.sourcesRead.join(", ") : "none";
  const outputList =
    entry.outputsAffected.length > 0
      ? entry.outputsAffected.join(", ")
      : "none";

  return [
    `[${entry.timestamp}] ${entry.action} by ${entry.actor}`,
    `  log: ${inputPath}`,
    `  sources: ${sourceList}`,
    `  outputs: ${outputList}`,
    `  hash: ${entry.hash}`,
  ].join("\n");
}

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

function matchesActionFilter(
  entry: AuditLogEntry,
  actionFilter: LogActionFilter,
) {
  if (actionFilter === "all") {
    return true;
  }

  return entry.action.startsWith(`${actionFilter}:`);
}

function formatEmptyAuditReport(options: {
  inputPath: string;
  source: LogSource;
  action: LogActionFilter;
  reportPaths: readonly string[];
}) {
  if (options.source === "all" && options.action === "all") {
    return `No audit entries found at ${options.inputPath}.`;
  }

  const scopeLabel =
    options.reportPaths.length > 0
      ? options.reportPaths.join(" and ")
      : options.inputPath;

  return `No audit entries found in ${scopeLabel}${formatFilterLabel(options.source, options.action)}.`;
}

function formatAuditReportHeader(options: {
  sourceLabels: readonly string[];
  shownEntries: number;
  totalEntries: number;
  source: LogSource;
  action: LogActionFilter;
}) {
  return `Recent audit entries from ${options.sourceLabels.join(" and ")}${formatFilterLabel(options.source, options.action)} (showing ${options.shownEntries} of ${options.totalEntries}):`;
}

function formatFilterLabel(source: LogSource, action: LogActionFilter): string {
  const filters: string[] = [];

  if (source !== "all") {
    filters.push(`source=${source}`);
  }

  if (action !== "all") {
    filters.push(`action=${action}`);
  }

  return filters.length > 0 ? ` for ${filters.join(" and ")}` : "";
}

function getOrderedSourceLabels(
  entries: readonly ReportAuditEntry[],
): string[] {
  const sourceOrder: Record<Exclude<LogSource, "all">, number> = {
    committed: 0,
    runtime: 1,
  };

  return [
    ...new Map(
      entries
        .slice()
        .sort(
          (left, right) => sourceOrder[left.source] - sourceOrder[right.source],
        )
        .map((entry) => [entry.inputPath, entry.inputPath]),
    ).values(),
  ];
}

export async function createAuditLogReport(options: {
  cwd: string;
  inputPath: string;
  limit: number;
  source: LogSource;
  action: LogActionFilter;
}): Promise<AuditLogReport> {
  const reports = [
    await readAuditEntries({
      inputPath: options.inputPath,
      rootPath: options.cwd,
      source: "committed",
    }),
  ];

  if (
    options.inputPath === DEFAULT_REVIEW_AUDIT_LOG_PATH &&
    options.source !== "committed"
  ) {
    const runtimeAuditPath = await resolveRuntimeAuditPath(options.cwd);

    if (runtimeAuditPath) {
      reports.push(
        await readAuditEntries({
          inputPath: runtimeAuditPath,
          rootPath: options.cwd,
          source: "runtime",
        }),
      );
    }
  }

  const entries = reports
    .flatMap((report) => report.entries)
    .filter(
      (reportEntry) =>
        (options.source === "all" || reportEntry.source === options.source) &&
        matchesActionFilter(reportEntry.entry, options.action),
    );

  const reportPaths = reports
    .filter(
      (report) => options.source === "all" || report.source === options.source,
    )
    .map((report) => report.inputPath);

  if (entries.length === 0) {
    return {
      inputPath: options.inputPath,
      report: formatEmptyAuditReport({
        inputPath: options.inputPath,
        source: options.source,
        action: options.action,
        reportPaths,
      }),
      shownEntries: 0,
      totalEntries: 0,
    };
  }

  const shownEntries = entries
    .slice()
    .sort((left, right) =>
      right.entry.timestamp.localeCompare(left.entry.timestamp),
    )
    .slice(0, options.limit);
  const sourceLabels = getOrderedSourceLabels(shownEntries);
  const header = formatAuditReportHeader({
    sourceLabels,
    shownEntries: shownEntries.length,
    totalEntries: entries.length,
    source: options.source,
    action: options.action,
  });

  return {
    inputPath: options.inputPath,
    report: [header, ...shownEntries.map((entry) => formatEntry(entry))].join(
      "\n\n",
    ),
    shownEntries: shownEntries.length,
    totalEntries: entries.length,
  };
}
