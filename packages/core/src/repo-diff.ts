import { z } from "zod";

import {
  type DependencyRecord,
  type RepoFileSummary,
  RepoFileSummarySchema,
  type RepoMap,
  RepoMapSchema,
  type RepoMapWarning,
  RepoMapWarningSchema,
} from "./repo-map.js";

export const DEFAULT_REPO_DIFF_OUTPUT_PATH =
  "docs/dyknow/.state/repo-diff.json";

export const RepoFileChangeTypeSchema = z.enum([
  "dependencies",
  "kind",
  "line-count",
  "signals",
  "size",
]);

export const RepoFileChangeSchema = z.object({
  path: z.string().min(1),
  changes: z.array(RepoFileChangeTypeSchema).min(1),
  before: RepoFileSummarySchema,
  after: RepoFileSummarySchema,
});

export const RepoMapDiffSummarySchema = z.object({
  addedFiles: z.number().int().nonnegative(),
  changedFiles: z.number().int().nonnegative(),
  removedFiles: z.number().int().nonnegative(),
  addedWarnings: z.number().int().nonnegative(),
  removedWarnings: z.number().int().nonnegative(),
});

export const RepoMapDiffSchema = z.object({
  comparedAt: z.string().datetime({ offset: true }),
  rootPath: z.string().min(1),
  configPath: z.string().min(1),
  baseSnapshotPath: z.string().min(1),
  outputPath: z.string().min(1),
  previousScannedAt: z.string().datetime({ offset: true }),
  currentScannedAt: z.string().datetime({ offset: true }),
  addedFiles: z.array(RepoFileSummarySchema),
  changedFiles: z.array(RepoFileChangeSchema),
  removedFiles: z.array(RepoFileSummarySchema),
  addedWarnings: z.array(RepoMapWarningSchema),
  removedWarnings: z.array(RepoMapWarningSchema),
  summary: RepoMapDiffSummarySchema,
});

export type RepoFileChangeType = z.infer<typeof RepoFileChangeTypeSchema>;
export type RepoFileChange = z.infer<typeof RepoFileChangeSchema>;
export type RepoMapDiffSummary = z.infer<typeof RepoMapDiffSummarySchema>;
export type RepoMapDiff = z.infer<typeof RepoMapDiffSchema>;

function sortStrings(values: readonly string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function sortDependencies(
  records: readonly DependencyRecord[],
): DependencyRecord[] {
  return [...records].sort((left, right) => {
    const leftKey = `${left.section}:${left.name}:${left.version}`;
    const rightKey = `${right.section}:${right.name}:${right.version}`;

    return leftKey.localeCompare(rightKey);
  });
}

function haveSameValues(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const leftValues = sortStrings(left);
  const rightValues = sortStrings(right);

  return JSON.stringify(leftValues) === JSON.stringify(rightValues);
}

function haveSameDependencies(
  left: readonly DependencyRecord[],
  right: readonly DependencyRecord[],
): boolean {
  return (
    JSON.stringify(sortDependencies(left)) ===
    JSON.stringify(sortDependencies(right))
  );
}

function detectFileChanges(
  previousFile: RepoFileSummary,
  currentFile: RepoFileSummary,
): RepoFileChangeType[] {
  const changes: RepoFileChangeType[] = [];

  if (previousFile.kind !== currentFile.kind) {
    changes.push("kind");
  }

  if (previousFile.size !== currentFile.size) {
    changes.push("size");
  }

  if (previousFile.lineCount !== currentFile.lineCount) {
    changes.push("line-count");
  }

  if (!haveSameValues(previousFile.signals, currentFile.signals)) {
    changes.push("signals");
  }

  if (
    !haveSameDependencies(previousFile.dependencies, currentFile.dependencies)
  ) {
    changes.push("dependencies");
  }

  return changes;
}

function warningKey(warning: RepoMapWarning): string {
  return `${warning.path}:${warning.code}:${warning.message}`;
}

function sortWarnings(warnings: readonly RepoMapWarning[]): RepoMapWarning[] {
  return [...warnings].sort((left, right) =>
    warningKey(left).localeCompare(warningKey(right)),
  );
}

export function compareRepoMaps(
  previous: RepoMap,
  current: RepoMap,
  options?: {
    baseSnapshotPath?: string;
    outputPath?: string;
  },
): RepoMapDiff {
  const previousSnapshot = RepoMapSchema.parse(previous);
  const currentSnapshot = RepoMapSchema.parse(current);
  const previousFiles = new Map(
    previousSnapshot.files.map((file) => [file.path, file] as const),
  );
  const currentFiles = new Map(
    currentSnapshot.files.map((file) => [file.path, file] as const),
  );
  const changedFiles: RepoFileChange[] = [];
  const addedFiles: RepoFileSummary[] = [];
  const removedFiles: RepoFileSummary[] = [];

  for (const path of [...currentFiles.keys()].sort((left, right) =>
    left.localeCompare(right),
  )) {
    const previousFile = previousFiles.get(path);
    const currentFile = currentFiles.get(path);

    if (!previousFile && currentFile) {
      addedFiles.push(currentFile);
      continue;
    }

    if (!previousFile || !currentFile) {
      continue;
    }

    const changes = detectFileChanges(previousFile, currentFile);

    if (changes.length > 0) {
      changedFiles.push({
        path,
        changes,
        before: previousFile,
        after: currentFile,
      });
    }
  }

  for (const path of [...previousFiles.keys()].sort((left, right) =>
    left.localeCompare(right),
  )) {
    if (currentFiles.has(path)) {
      continue;
    }

    const previousFile = previousFiles.get(path);

    if (previousFile) {
      removedFiles.push(previousFile);
    }
  }

  const previousWarnings = new Map(
    previousSnapshot.warnings.map(
      (warning) => [warningKey(warning), warning] as const,
    ),
  );
  const currentWarnings = new Map(
    currentSnapshot.warnings.map(
      (warning) => [warningKey(warning), warning] as const,
    ),
  );
  const addedWarnings = sortWarnings(
    [...currentWarnings.entries()]
      .filter(([key]) => !previousWarnings.has(key))
      .map(([, warning]) => warning),
  );
  const removedWarnings = sortWarnings(
    [...previousWarnings.entries()]
      .filter(([key]) => !currentWarnings.has(key))
      .map(([, warning]) => warning),
  );

  return RepoMapDiffSchema.parse({
    comparedAt: new Date().toISOString(),
    rootPath: currentSnapshot.rootPath,
    configPath: currentSnapshot.configPath,
    baseSnapshotPath: options?.baseSnapshotPath ?? previousSnapshot.outputPath,
    outputPath: options?.outputPath ?? DEFAULT_REPO_DIFF_OUTPUT_PATH,
    previousScannedAt: previousSnapshot.scannedAt,
    currentScannedAt: currentSnapshot.scannedAt,
    addedFiles,
    changedFiles,
    removedFiles,
    addedWarnings,
    removedWarnings,
    summary: {
      addedFiles: addedFiles.length,
      changedFiles: changedFiles.length,
      removedFiles: removedFiles.length,
      addedWarnings: addedWarnings.length,
      removedWarnings: removedWarnings.length,
    },
  });
}
