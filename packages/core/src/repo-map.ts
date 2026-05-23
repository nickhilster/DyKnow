import { z } from "zod";

export const DEFAULT_REPO_MAP_OUTPUT_PATH = "docs/dyknow/.state/repo-map.json";

export const RepoFileKindSchema = z.enum([
  "json",
  "markdown",
  "plaintext",
  "typescript",
  "yaml",
  "unknown",
]);

export const RepoFileSignalSchema = z.enum([
  "agent-context",
  "config",
  "documentation",
  "openapi",
  "package-manifest",
  "route-candidate",
  "source-code",
]);

export const DependencySectionSchema = z.enum([
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
]);

export const DependencyRecordSchema = z.object({
  name: z.string().min(1),
  section: DependencySectionSchema,
  version: z.string().min(1),
});

export const RepoFileSummarySchema = z.object({
  path: z.string().min(1),
  kind: RepoFileKindSchema,
  size: z.number().int().nonnegative(),
  lineCount: z.number().int().nonnegative(),
  signals: z.array(RepoFileSignalSchema),
  dependencies: z.array(DependencyRecordSchema),
});

export const RepoMapWarningSchema = z.object({
  code: z.enum(["parse-error", "secret-pattern"]),
  message: z.string().min(1),
  path: z.string().min(1),
});

export const RepoMapSchema = z.object({
  configPath: z.string().min(1),
  files: z.array(RepoFileSummarySchema),
  outputPath: z.string().min(1),
  rootPath: z.string().min(1),
  scannedAt: z.string().datetime({ offset: true }),
  warnings: z.array(RepoMapWarningSchema),
});

export type RepoFileKind = z.infer<typeof RepoFileKindSchema>;
export type RepoFileSignal = z.infer<typeof RepoFileSignalSchema>;
export type DependencySection = z.infer<typeof DependencySectionSchema>;
export type DependencyRecord = z.infer<typeof DependencyRecordSchema>;
export type RepoFileSummary = z.infer<typeof RepoFileSummarySchema>;
export type RepoMapWarning = z.infer<typeof RepoMapWarningSchema>;
export type RepoMap = z.infer<typeof RepoMapSchema>;
