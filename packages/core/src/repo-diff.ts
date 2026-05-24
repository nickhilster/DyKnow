import { matchesGlob } from "node:path";

import { z } from "zod";

import { type PageDefinition, PageDefinitionSchema } from "./contracts.js";
import {
  type DependencyRecord,
  type RepoFileSummary,
  type RepoRoute,
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
  "headings",
  "kind",
  "line-count",
  "routes",
  "signals",
  "size",
  "top-level-keys",
]);

export const RepoFileChangeSchema = z.object({
  path: z.string().min(1),
  changes: z.array(RepoFileChangeTypeSchema).min(1),
  before: RepoFileSummarySchema,
  after: RepoFileSummarySchema,
});

export const AffectedPageReasonSchema = z.enum([
  "added-file",
  "changed-file",
  "removed-file",
  "added-warning",
  "removed-warning",
]);

export const AffectedPageSchema = z.object({
  pageId: PageDefinitionSchema.shape.id,
  outputPath: PageDefinitionSchema.shape.outputPath,
  matchedSourcePaths: z.array(z.string().min(1)).min(1),
  reasons: z.array(AffectedPageReasonSchema).min(1),
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
  affectedPages: z.array(AffectedPageSchema).default([]),
  summary: RepoMapDiffSummarySchema,
});

export type AffectedPageReason = z.infer<typeof AffectedPageReasonSchema>;
export type AffectedPage = z.infer<typeof AffectedPageSchema>;
export type RepoFileChangeType = z.infer<typeof RepoFileChangeTypeSchema>;
export type RepoFileChange = z.infer<typeof RepoFileChangeSchema>;
export type RepoMapDiffSummary = z.infer<typeof RepoMapDiffSummarySchema>;
export type RepoMapDiff = z.infer<typeof RepoMapDiffSchema>;

const AFFECTED_PAGE_REASON_ORDER: readonly AffectedPageReason[] = [
  "added-file",
  "changed-file",
  "removed-file",
  "added-warning",
  "removed-warning",
];

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

function sortRoutes(routes: readonly RepoRoute[]): RepoRoute[] {
  return [...routes].sort((left, right) => {
    const leftKey = `${left.framework}:${left.kind}:${left.path}:${left.handler}:${sortStrings(left.methods).join(",")}`;
    const rightKey = `${right.framework}:${right.kind}:${right.path}:${right.handler}:${sortStrings(right.methods).join(",")}`;

    return leftKey.localeCompare(rightKey);
  });
}

function haveSameRoutes(
  left: readonly RepoRoute[],
  right: readonly RepoRoute[],
): boolean {
  return JSON.stringify(sortRoutes(left)) === JSON.stringify(sortRoutes(right));
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

  if (!haveSameRoutes(previousFile.routes, currentFile.routes)) {
    changes.push("routes");
  }

  if (!haveSameValues(previousFile.headings, currentFile.headings)) {
    changes.push("headings");
  }

  if (!haveSameValues(previousFile.topLevelKeys, currentFile.topLevelKeys)) {
    changes.push("top-level-keys");
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

function sortAffectedPageReasons(
  reasons: ReadonlySet<AffectedPageReason>,
): AffectedPageReason[] {
  return AFFECTED_PAGE_REASON_ORDER.filter((reason) => reasons.has(reason));
}

function resolveAffectedPages(
  pages: readonly PageDefinition[],
  sourceChanges: readonly {
    path: string;
    reason: AffectedPageReason;
  }[],
): AffectedPage[] {
  const affectedPages = new Map<
    string,
    {
      outputPath: string;
      matchedSourcePaths: Set<string>;
      reasons: Set<AffectedPageReason>;
    }
  >();

  for (const sourceChange of sourceChanges) {
    for (const page of pages) {
      if (
        !page.sources.some((pattern) => matchesGlob(sourceChange.path, pattern))
      ) {
        continue;
      }

      const entry = affectedPages.get(page.id) ?? {
        outputPath: page.outputPath,
        matchedSourcePaths: new Set<string>(),
        reasons: new Set<AffectedPageReason>(),
      };

      entry.matchedSourcePaths.add(sourceChange.path);
      entry.reasons.add(sourceChange.reason);
      affectedPages.set(page.id, entry);
    }
  }

  return [...affectedPages.entries()]
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .map(([pageId, entry]) => ({
      pageId,
      outputPath: entry.outputPath,
      matchedSourcePaths: [...entry.matchedSourcePaths].sort((left, right) =>
        left.localeCompare(right),
      ),
      reasons: sortAffectedPageReasons(entry.reasons),
    }));
}

export function compareRepoMaps(
  previous: RepoMap,
  current: RepoMap,
  options?: {
    baseSnapshotPath?: string;
    outputPath?: string;
    pages?: readonly PageDefinition[];
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
  const affectedPages =
    options?.pages && options.pages.length > 0
      ? resolveAffectedPages(options.pages, [
          ...addedFiles.map((file) => ({
            path: file.path,
            reason: "added-file" as const,
          })),
          ...changedFiles.map((file) => ({
            path: file.path,
            reason: "changed-file" as const,
          })),
          ...removedFiles.map((file) => ({
            path: file.path,
            reason: "removed-file" as const,
          })),
          ...addedWarnings.map((warning) => ({
            path: warning.path,
            reason: "added-warning" as const,
          })),
          ...removedWarnings.map((warning) => ({
            path: warning.path,
            reason: "removed-warning" as const,
          })),
        ])
      : undefined;

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
    affectedPages,
    summary: {
      addedFiles: addedFiles.length,
      changedFiles: changedFiles.length,
      removedFiles: removedFiles.length,
      addedWarnings: addedWarnings.length,
      removedWarnings: removedWarnings.length,
    },
  });
}
