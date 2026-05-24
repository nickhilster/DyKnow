import { readFile, readdir, stat } from "node:fs/promises";
import { basename, extname, join, matchesGlob, relative, resolve } from "node:path";

import {
  DEFAULT_REPO_MAP_OUTPUT_PATH,
  type DependencyRecord,
  type DependencySection,
  type DyknowConfig,
  type RepoFileKind,
  type RepoRoute,
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

const SECRET_PATH_PATTERNS = [
  {
    label: "sensitive-file-name",
    matcher:
      /(?:^|\/)(?:\.npmrc|\.pypirc|\.netrc|id_rsa|id_dsa|id_ed25519|.*\.(?:pem|p12|pfx|key))$/i,
  },
] as const;

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
  {
    code: "secret-pattern",
    label: "connection-string",
    matcher:
      /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s"'`]+/i,
  },
  {
    code: "secret-pattern",
    label: "npm-auth-token",
    matcher: /\/\/registry\.npmjs\.org\/:_authToken=\S+/i,
  },
  {
    code: "secret-pattern",
    label: "slack-token",
    matcher: /xox[baprs]-[A-Za-z0-9-]{10,}/,
  },
  {
    code: "secret-pattern",
    label: "google-api-key",
    matcher: /AIza[0-9A-Za-z\-_]{35}/,
  },
  {
    code: "secret-pattern",
    label: "jwt",
    matcher: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/,
  },
] as const;

const DEPENDENCY_POLICY_RULES = [
  {
    label: "local-source",
    matcher: /^(?:file:|workspace:)/i,
    message: (name: string, version: string) =>
      `Dependency "${name}" uses a local source specifier "${version}". Approve it explicitly in dependencyPolicy.allow if this package is an intended workspace or local dependency.`,
  },
  {
    label: "non-registry-source",
    matcher: /^(?:github:|git(?:\+|:|:\/\/)|https?:\/\/)/i,
    message: (name: string, version: string) =>
      `Dependency "${name}" uses a non-registry source specifier "${version}". Prefer a published registry release or a vetted local source.`,
  },
  {
    label: "broad-version",
    matcher: /^(?:\*|latest)$/i,
    message: (name: string, version: string) =>
      `Dependency "${name}" uses an overly broad version specifier "${version}". Prefer an explicit semver range.`,
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

  if (extension === ".py") {
    return "python";
  }

  if (extension === ".toml") {
    return "toml";
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
    lowerPath.endsWith("pnpm-lock.yaml") ||
    lowerPath.endsWith("pyproject.toml") ||
    /(?:^|\/)requirements[^/]*\.txt$/i.test(lowerPath)
  ) {
    signals.add("package-manifest");
  }

  if (
    lowerPath.includes("route") ||
    lowerPath.includes("routes/") ||
    lowerPath.includes("/app/") ||
    lowerPath.startsWith("app/") ||
    lowerPath.startsWith("pages/") ||
    lowerPath.startsWith("src/app/") ||
    lowerPath.startsWith("src/pages/")
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

  if (kind === "python") {
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

function normalizePackageName(value: string): string {
  return value.toLowerCase();
}

function detectDependencySectionFromPath(filePath: string): DependencySection {
  const lowerPath = filePath.toLowerCase();

  if (lowerPath.includes("dev")) {
    return "devDependencies";
  }

  return "dependencies";
}

function extractDependencies(
  filePath: string,
  text: string,
  dependencyPolicy: DyknowConfig["dependencyPolicy"],
): {
  dependencies: DependencyRecord[];
  warnings: RepoMapWarning[];
} {
  if (filePath.endsWith("package.json")) {
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
      const allowedDependencies = new Set(
        dependencyPolicy.allow.map(normalizePackageName),
      );
      const deniedDependencies = new Set(
        dependencyPolicy.deny.map(normalizePackageName),
      );

      for (const section of sections) {
        const records = manifest[section] ?? {};

        for (const [name, version] of Object.entries(records)) {
          dependencies.push({ name, section, version });
        }
      }

      return {
        dependencies,
        warnings: dependencies.flatMap((dependency) =>
          deniedDependencies.has(normalizePackageName(dependency.name))
            ? [
                {
                  code: "dependency-policy",
                  path: "package.json",
                  message: `Dependency "${dependency.name}" is explicitly denied by dependencyPolicy.deny.`,
                } satisfies RepoMapWarning,
              ]
            : allowedDependencies.has(normalizePackageName(dependency.name))
              ? []
              : DEPENDENCY_POLICY_RULES.filter((rule) =>
                  rule.matcher.test(dependency.version),
                ).map(
                  (rule) =>
                    ({
                      code: "dependency-policy",
                      path: "package.json",
                      message: rule.message(
                        dependency.name,
                        dependency.version,
                      ),
                    }) satisfies RepoMapWarning,
                ),
        ),
      };
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

  if (filePath.endsWith("pyproject.toml")) {
    const dependencies: DependencyRecord[] = [];
    const projectDependenciesMatch = text.match(
      /dependencies\s*=\s*\[((?:.|\r|\n)*?)\]/m,
    );

    for (const rawDependency of (
      projectDependenciesMatch?.[1] ?? ""
    ).matchAll(/"([^"]+)"/g)) {
      const [name, version] = splitPythonDependency(rawDependency[1] ?? "");

      dependencies.push({
        name,
        section: "dependencies",
        version,
      });
    }

    for (const match of text.matchAll(
      /\[project\.optional-dependencies\.([^\]]+)\]((?:\r?\n(?!\[).*)*)/g,
    )) {
      const body = match[2] ?? "";

      for (const rawDependency of body.matchAll(/"([^"]+)"/g)) {
        const [name, version] = splitPythonDependency(rawDependency[1] ?? "");

        dependencies.push({
          name,
          section: "optionalDependencies",
          version,
        });
      }
    }

    for (const match of text.matchAll(
      /\[tool\.poetry\.group\.([^.]+)\.dependencies\]((?:\r?\n(?!\[).*)*)/g,
    )) {
      const groupName = (match[1] ?? "").toLowerCase();
      const section =
        groupName === "dev" ? "devDependencies" : "optionalDependencies";
      const body = match[2] ?? "";

      for (const dependency of parseTomlKeyValueDependencies(body, section)) {
        dependencies.push(dependency);
      }
    }

    return { dependencies, warnings: [] };
  }

  if (/(?:^|\/)requirements[^/]*\.txt$/i.test(filePath)) {
    const section = detectDependencySectionFromPath(filePath);
    const dependencies = text
      .split(/\r\n|\r|\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .map((line) => line.split(/\s+#/, 1)[0] ?? line)
      .map((line) => splitPythonDependency(line))
      .map(([name, version]) => ({ name, section, version }));

    return { dependencies, warnings: [] };
  }

  return {
    dependencies: [],
    warnings: [],
  };
}

function splitPythonDependency(rawValue: string): [string, string] {
  const cleanedValue = rawValue.trim();
  const nameMatch = cleanedValue.match(/^[A-Za-z0-9_.-]+/);
  const name = nameMatch?.[0] ?? cleanedValue;
  const version = cleanedValue.slice(name.length).trim() || "*";

  return [name.toLowerCase(), version];
}

function parseTomlKeyValueDependencies(
  body: string,
  section: DependencySection,
): DependencyRecord[] {
  return body
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 && !line.startsWith("#") && line.includes("="),
    )
    .map((line) => {
      const [rawName, rawVersion] = line.split("=", 2);
      const version = (rawVersion ?? "").trim().replace(/^"|"$/g, "") || "*";

      return {
        name: (rawName ?? "").trim().toLowerCase(),
        section,
        version,
      } satisfies DependencyRecord;
    });
}

function normalizeRouteSegment(segment: string): string | null {
  if (segment === "" || segment === "index") {
    return null;
  }

  if (/^\(.+\)$/.test(segment)) {
    return null;
  }

  if (/^\[\[\.\.\.(.+)\]\]$/.test(segment)) {
    return `*${segment.slice(5, -2)}?`;
  }

  if (/^\[\.\.\.(.+)\]$/.test(segment)) {
    return `*${segment.slice(4, -1)}`;
  }

  if (/^\[(.+)\]$/.test(segment)) {
    return `:${segment.slice(1, -1)}`;
  }

  return segment;
}

function normalizeRoutePath(rawSegments: readonly string[]): string {
  const segments = rawSegments
    .map(normalizeRouteSegment)
    .filter((segment): segment is string => Boolean(segment));

  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

function extractExportedHttpMethods(text: string): string[] {
  const methods = new Set<string>();

  for (const match of text.matchAll(
    /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g,
  )) {
    methods.add(match[1] ?? "");
  }

  return [...methods];
}

function extractMarkdownHeadings(text: string): string[] {
  return [...text.matchAll(/^#{1,6}\s+(.+)$/gm)]
    .map((match) => match[1]?.trim() ?? "")
    .filter((heading) => heading.length > 0);
}

function extractJsonTopLevelKeys(text: string): string[] {
  try {
    const parsed = JSON.parse(text) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return [];
    }

    return Object.keys(parsed).sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

function extractTopLevelMappingKeys(text: string): string[] {
  return [...text.matchAll(/^([A-Za-z0-9_.-]+):(?:\s+.*)?$/gm)]
    .map((match) => match[1] ?? "")
    .filter((key) => key.length > 0)
    .sort((left, right) => left.localeCompare(right));
}

function extractOpenApiJsonRoutes(filePath: string, text: string): RepoRoute[] {
  try {
    const parsed = JSON.parse(text) as {
      paths?: Record<string, Record<string, unknown>>;
    };
    const paths = parsed.paths;

    if (!paths || typeof paths !== "object") {
      return [];
    }

    return Object.entries(paths)
      .filter((entry): entry is [string, Record<string, unknown>] => {
        const [routePath, methods] = entry;
        return routePath.startsWith("/") && methods && typeof methods === "object";
      })
      .map(([routePath, methods]) => ({
        framework: "openapi",
        kind: "api" as const,
        path: routePath,
        handler: filePath,
        methods: Object.keys(methods)
          .filter((method) =>
            ["get", "post", "put", "patch", "delete", "head", "options"].includes(
              method.toLowerCase(),
            ),
          )
          .map((method) => method.toUpperCase())
          .sort((left, right) => left.localeCompare(right)),
      }));
  } catch {
    return [];
  }
}

function extractOpenApiYamlRoutes(filePath: string, text: string): RepoRoute[] {
  const routes: RepoRoute[] = [];
  const lines = text.split(/\r\n|\r|\n/);
  let inPathsSection = false;
  let currentPath: string | null = null;
  let currentMethods = new Set<string>();

  function flushCurrentPath() {
    if (!currentPath) {
      return;
    }

    routes.push({
      framework: "openapi",
      kind: "api",
      path: currentPath,
      handler: filePath,
      methods: [...currentMethods].sort((left, right) => left.localeCompare(right)),
    });
  }

  for (const line of lines) {
    if (!inPathsSection) {
      if (/^paths:\s*$/.test(line.trim())) {
        inPathsSection = true;
      }

      continue;
    }

    if (/^[A-Za-z0-9_.-]+:\s*$/.test(line)) {
      flushCurrentPath();
      break;
    }

    const pathMatch = line.match(/^  (\/[^:]+):\s*$/);

    if (pathMatch) {
      flushCurrentPath();
      currentPath = pathMatch[1] ?? null;
      currentMethods = new Set<string>();
      continue;
    }

    const methodMatch = line.match(
      /^    (get|post|put|patch|delete|head|options):\s*$/i,
    );

    if (methodMatch && currentPath) {
      currentMethods.add((methodMatch[1] ?? "").toUpperCase());
    }
  }

  flushCurrentPath();
  return routes;
}

function extractTopLevelKeys(filePath: string, kind: RepoFileKind, text: string): string[] {
  if (kind === "json") {
    return extractJsonTopLevelKeys(text);
  }

  if (kind === "yaml" || kind === "toml") {
    return extractTopLevelMappingKeys(text);
  }

  if (filePath.endsWith("package.json")) {
    return extractJsonTopLevelKeys(text);
  }

  return [];
}

function extractNextJsRoutes(filePath: string, text: string): RepoRoute[] {
  const portablePath = filePath.replaceAll("\\", "/");
  const nextAppMatch = portablePath.match(
    /(?:^|\/)(?:src\/)?app\/(.+)\/(page|route)\.(?:[cm]?[jt]sx?)$/,
  );

  if (nextAppMatch) {
    const routePath = normalizeRoutePath(nextAppMatch[1]?.split("/") ?? []);
    const handlerType = nextAppMatch[2];

    if (handlerType === "page") {
      return [
        {
          framework: "nextjs-app",
          kind: "page",
          path: routePath,
          handler: filePath,
          methods: [],
        },
      ];
    }

    const methods = extractExportedHttpMethods(text);

    return [
      {
        framework: "nextjs-app",
        kind: "api",
        path: routePath,
        handler: filePath,
        methods: methods.length > 0 ? methods : ["ANY"],
      },
    ];
  }

  const nextPagesMatch = portablePath.match(
    /(?:^|\/)(?:src\/)?pages\/(.+)\.(?:[cm]?[jt]sx?)$/,
  );

  if (!nextPagesMatch) {
    return [];
  }

  const routeFilePath = nextPagesMatch[1] ?? "";
  const segments = routeFilePath.split("/");
  const lastSegment = segments.at(-1) ?? "";

  if (lastSegment.startsWith("_")) {
    return [];
  }

  if (segments[0] === "api") {
    return [
      {
        framework: "nextjs-pages",
        kind: "api",
        path: normalizeRoutePath(segments.slice(1)),
        handler: filePath,
        methods: ["ANY"],
      },
    ];
  }

  return [
    {
      framework: "nextjs-pages",
      kind: "page",
      path: normalizeRoutePath(segments),
      handler: filePath,
      methods: [],
    },
  ];
}

function extractExpressRoutes(filePath: string, text: string): RepoRoute[] {
  const methodsByPath = new Map<string, Set<string>>();

  for (const match of text.matchAll(
    /\b(?:app|router)\.(get|post|put|patch|delete|options|head|all)\(\s*["'`]([^"'`]+)["'`]/gi,
  )) {
    const method = (match[1] ?? "all").toUpperCase();
    const path = match[2] ?? "/";
    const methods = methodsByPath.get(path) ?? new Set<string>();

    methods.add(method === "ALL" ? "ANY" : method);
    methodsByPath.set(path, methods);
  }

  return [...methodsByPath.entries()].map(([path, methods]) => ({
    framework: "express",
    kind: "api",
    path,
    handler: filePath,
    methods: [...methods].sort((left, right) => left.localeCompare(right)),
  }));
}

function extractRoutes(
  filePath: string,
  kind: RepoFileKind,
  text: string,
): RepoRoute[] {
  const lowerPath = filePath.toLowerCase();

  if (
    kind === "json" &&
    (lowerPath.includes("openapi") || lowerPath.includes("swagger"))
  ) {
    return extractOpenApiJsonRoutes(filePath, text);
  }

  if (
    kind === "yaml" &&
    (lowerPath.includes("openapi") || lowerPath.includes("swagger"))
  ) {
    return extractOpenApiYamlRoutes(filePath, text);
  }

  if (kind !== "typescript" && kind !== "python") {
    return [];
  }

  if (
    lowerPath.includes("/app/") ||
    lowerPath.includes("/pages/") ||
    lowerPath.startsWith("app/") ||
    lowerPath.startsWith("pages/") ||
    lowerPath.startsWith("src/app/") ||
    lowerPath.startsWith("src/pages/")
  ) {
    return extractNextJsRoutes(filePath, text);
  }

  if (
    lowerPath.includes("route") ||
    lowerPath.includes("routes/") ||
    /\b(?:app|router)\.(?:get|post|put|patch|delete|options|head|all)\(/i.test(
      text,
    )
  ) {
    return extractExpressRoutes(filePath, text);
  }

  return [];
}

function shouldParseDependencies(filePath: string): boolean {
  const fileName = basename(filePath).toLowerCase();

  return (
    fileName === "package.json" ||
    fileName === "pyproject.toml" ||
    /^requirements[^/]*\.txt$/i.test(fileName)
  );
}

function shouldReadFileText(kind: RepoFileKind, filePath: string): boolean {
  if (kind !== "unknown") {
    return true;
  }

  return shouldParseDependencies(filePath);
}

function detectSecretWarnings(
  filePath: string,
  text: string,
): RepoMapWarning[] {
  const matches = [
    ...SECRET_PATH_PATTERNS.filter((pattern) => pattern.matcher.test(filePath)),
    ...SECRET_PATTERNS.filter((pattern) => pattern.matcher.test(text)),
  ];

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
    const isReadableText = shouldReadFileText(kind, filePath);
    let lineCount = 0;
    let dependencies: DependencyRecord[] = [];
    let routes: RepoRoute[] = [];
    let headings: string[] = [];
    let topLevelKeys: string[] = [];

    if (isReadableText) {
      const text = await readFile(absolutePath, "utf8");

      lineCount = countLines(text);
      warnings.push(...detectSecretWarnings(filePath, text));

      headings = kind === "markdown" ? extractMarkdownHeadings(text) : [];
      topLevelKeys = extractTopLevelKeys(filePath, kind, text);
      routes = extractRoutes(filePath, kind, text);

      if (shouldParseDependencies(filePath)) {
        const dependencyResult = extractDependencies(
          filePath,
          text,
          options.config.dependencyPolicy,
        );

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
      routes,
      headings,
      topLevelKeys,
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
