import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, matchesGlob, relative, resolve } from "node:path";

import {
  DEFAULT_REPO_MAP_OUTPUT_PATH,
  type DependencyRecord,
  type DependencySection,
  type DyknowConfig,
  type RepoFileKind,
  type RepoFileSignal,
  type RepoMap,
  RepoMapSchema,
  type RepoMapWarning,
} from "@dyknow/core";

const SKIPPED_DIRECTORY_NAMES = new Set([
  ".git",
  "coverage",
  "dist",
  "node_modules",
]);

const SECRET_PATTERNS = [
  {
    code: "secret-pattern",
    label: "private-key",
    matcher: /BEGIN [A-Z ]*PRIVATE KEY/,
  },
  {
    code: "secret-pattern",
    label: "api-token",
    matcher:
      /(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})/,
  },
  {
    code: "secret-pattern",
    label: "credential-assignment",
    matcher:
      /\b(?:api[_-]?key|secret|token|password)\b\s*[:=]\s*["'][^"'\n]{8,}["']/i,
  },
  {
    code: "secret-pattern",
    label: "bearer-token",
    matcher: /authorization\s*:\s*bearer\s+[A-Za-z0-9._\-=]{20,}/i,
  },
] as const;

function toPortablePath(path: string): string {
  return path.replaceAll("\\", "/");
}

function isMatchedBy(path: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchesGlob(path, pattern));
}

async function collectWorkspaceFiles(
  rootPath: string,
  currentPath = "",
): Promise<string[]> {
  const absolutePath = currentPath ? join(rootPath, currentPath) : rootPath;
  const entries = await readdir(absolutePath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const nextPath = currentPath ? join(currentPath, entry.name) : entry.name;

    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORY_NAMES.has(entry.name)) {
        continue;
      }

      files.push(...(await collectWorkspaceFiles(rootPath, nextPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(toPortablePath(nextPath));
    }
  }

  return files;
}

function detectFileKind(filePath: string): RepoFileKind {
  const extension = extname(filePath).toLowerCase();

  if (extension === ".json") {
    return "json";
  }

  if (extension === ".md") {
    return "markdown";
  }

  if (extension === ".ts" || extension === ".tsx") {
    return "typescript";
  }

  if (extension === ".yaml" || extension === ".yml") {
    return "yaml";
  }

  if (extension === ".txt" || extension === "") {
    return "plaintext";
  }

  return "unknown";
}

function detectSignals(filePath: string, kind: RepoFileKind): RepoFileSignal[] {
  const lowerPath = filePath.toLowerCase();
  const signals = new Set<RepoFileSignal>();

  if (kind === "markdown") {
    signals.add("documentation");
  }

  if (
    lowerPath === "agents.md" ||
    lowerPath === "claude.md" ||
    lowerPath.endsWith("/agents.md") ||
    lowerPath.endsWith("/claude.md")
  ) {
    signals.add("agent-context");
  }

  if (
    lowerPath.endsWith("package.json") ||
    lowerPath.endsWith("package-lock.json") ||
    lowerPath.endsWith("pnpm-lock.yaml")
  ) {
    signals.add("package-manifest");
  }

  if (
    lowerPath.includes("route") ||
    lowerPath.includes("routes/") ||
    lowerPath.includes("/app/")
  ) {
    signals.add("route-candidate");
  }

  if (
    lowerPath.includes("openapi") ||
    lowerPath.includes("swagger") ||
    lowerPath.endsWith(".yaml") ||
    lowerPath.endsWith(".yml")
  ) {
    signals.add("openapi");
  }

  if (
    kind === "json" ||
    lowerPath.includes("config") ||
    lowerPath.startsWith(".github/")
  ) {
    signals.add("config");
  }

  if (kind === "typescript") {
    signals.add("source-code");
  }

  return [...signals];
}

function countLines(text: string): number {
  if (text.length === 0) {
    return 0;
  }

  return text.split(/\r\n|\r|\n/).length;
}

function extractDependencies(text: string): {
  dependencies: DependencyRecord[];
  warnings: RepoMapWarning[];
} {
  try {
    const manifest = JSON.parse(text) as Partial<
      Record<DependencySection, Record<string, string>>
    >;
    const sections: DependencySection[] = [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
    ];
    const dependencies: DependencyRecord[] = [];

    for (const section of sections) {
      const records = manifest[section] ?? {};

      for (const [name, version] of Object.entries(records)) {
        dependencies.push({ name, section, version });
      }
    }

    return { dependencies, warnings: [] };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unknown parse error.";

    return {
      dependencies: [],
      warnings: [
        {
          code: "parse-error",
          path: "package.json",
          message: `Failed to parse package.json: ${reason}`,
        },
      ],
    };
  }
}

function detectSecretWarnings(
  filePath: string,
  text: string,
): RepoMapWarning[] {
  const matches = SECRET_PATTERNS.filter((pattern) =>
    pattern.matcher.test(text),
  );

  if (matches.length === 0) {
    return [];
  }

  return [
    {
      code: "secret-pattern",
      path: filePath,
      message: `Potential sensitive content detected by ${matches
        .map((pattern) => pattern.label)
        .join(", ")}.`,
    } satisfies RepoMapWarning,
  ];
}

export async function scanWorkspace(options: {
  config: DyknowConfig;
  configPath: string;
  outputPath?: string;
  rootPath: string;
}): Promise<RepoMap> {
  const rootPath = resolve(options.rootPath);
  const allFiles = await collectWorkspaceFiles(rootPath);
  const includedFiles = allFiles.filter(
    (filePath) =>
      isMatchedBy(filePath, options.config.allowedSources) &&
      !isMatchedBy(filePath, options.config.ignoredSources),
  );
  const warnings: RepoMapWarning[] = [];
  const files = [];

  for (const filePath of includedFiles.sort()) {
    const absolutePath = resolve(rootPath, filePath);
    const fileStats = await stat(absolutePath);
    const kind = detectFileKind(filePath);
    const isReadableText = kind !== "unknown";
    let lineCount = 0;
    let dependencies: DependencyRecord[] = [];

    if (isReadableText) {
      const text = await readFile(absolutePath, "utf8");

      lineCount = countLines(text);
      warnings.push(...detectSecretWarnings(filePath, text));

      if (filePath.endsWith("package.json")) {
        const dependencyResult = extractDependencies(text);

        dependencies = dependencyResult.dependencies;
        warnings.push(
          ...dependencyResult.warnings.map((warning) => ({
            ...warning,
            path: filePath,
          })),
        );
      }
    }

    files.push({
      path: filePath,
      kind,
      size: fileStats.size,
      lineCount,
      signals: detectSignals(filePath, kind),
      dependencies,
    });
  }

  return RepoMapSchema.parse({
    scannedAt: new Date().toISOString(),
    rootPath,
    configPath: toPortablePath(
      relative(rootPath, options.configPath) || options.configPath,
    ),
    outputPath: toPortablePath(
      relative(rootPath, options.outputPath ?? DEFAULT_REPO_MAP_OUTPUT_PATH) ||
        options.outputPath ||
        DEFAULT_REPO_MAP_OUTPUT_PATH,
    ),
    files,
    warnings,
  });
}
