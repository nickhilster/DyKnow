import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { type AuditLogEntry, AuditLogEntrySchema } from "@dyknow/core";

import { resolveRuntimeAuditPath } from "./audit.js";

export const DEFAULT_REVIEW_AUDIT_LOG_PATH =
  "docs/dyknow/.state/audit-log.jsonl";

export type LogOptions = {
  inputPath: string;
  limit: number;
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
          }) satisfies ReportAuditEntry,
      ),
    inputPath: formatRelativePath(options.rootPath, absolutePath),
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

    throw new Error(`Unknown log option: ${argument}`);
  }

  return { inputPath, limit };
}

export async function createAuditLogReport(options: {
  cwd: string;
  inputPath: string;
  limit: number;
}): Promise<AuditLogReport> {
  const reports = [
    await readAuditEntries({
      inputPath: options.inputPath,
      rootPath: options.cwd,
    }),
  ];

  if (options.inputPath === DEFAULT_REVIEW_AUDIT_LOG_PATH) {
    const runtimeAuditPath = await resolveRuntimeAuditPath(options.cwd);

    if (runtimeAuditPath) {
      reports.push(
        await readAuditEntries({
          inputPath: runtimeAuditPath,
          rootPath: options.cwd,
        }),
      );
    }
  }

  const entries = reports.flatMap((report) => report.entries);

  if (entries.length === 0) {
    return {
      inputPath: options.inputPath,
      report: `No audit entries found at ${options.inputPath}.`,
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
  const sourceLabels = reports
    .filter((report) => report.entries.length > 0)
    .map((report) => report.inputPath);
  const header = `Recent audit entries from ${sourceLabels.join(" and ")} (showing ${shownEntries.length} of ${entries.length}):`;

  return {
    inputPath: options.inputPath,
    report: [header, ...shownEntries.map((entry) => formatEntry(entry))].join(
      "\n\n",
    ),
    shownEntries: shownEntries.length,
    totalEntries: entries.length,
  };
}
