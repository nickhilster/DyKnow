import { z } from "zod";

import { PageDefinitionSchema } from "./contracts.js";

export const DYKNOW_CONFIG_FILE_NAME = "dyknow.config.json";
export const DYKNOW_CONFIG_SCHEMA_FILE_NAME = "dyknow.config.schema.json";

export const DEFAULT_IGNORED_SOURCE_PATTERNS = [
  ".env",
  ".env.*",
  "secrets/**",
  "node_modules/**",
  "dist/**",
  "coverage/**",
  "logs/**",
] as const;

export const REPO_LOCAL_GLOB_PATTERN =
  "^(?![A-Za-z]:[\\\\/])(?![\\\\/])(?!.*(?:^|[\\\\/])\\.\\.(?:[\\\\/]|$))[^\\u0000\\r\\n]+$";
export const REPO_LOCAL_OUTPUT_PATH_PATTERN =
  "^(?![A-Za-z]:[\\\\/])(?![\\\\/])(?!.*(?:^|[\\\\/])\\.\\.(?:[\\\\/]|$))(?!docs[\\\\/]sources(?:[\\\\/]|$))(?!\\.git(?:[\\\\/]|$))[^\\u0000\\r\\n]+$";
export const DEPENDENCY_POLICY_PACKAGE_PATTERN =
  "^(?:@[a-z0-9][a-z0-9._-]*/)?[a-z0-9][a-z0-9._-]*$";

export const LlmProviderSchema = z.enum(["local", "byo-key", "vendor-hosted"]);
export const DependencyPolicySchema = z.object({
  allow: z
    .array(
      z
        .string()
        .regex(
          new RegExp(DEPENDENCY_POLICY_PACKAGE_PATTERN, "u"),
          "Dependency policy entries must be valid lowercase package names.",
        ),
    )
    .default([]),
  deny: z
    .array(
      z
        .string()
        .regex(
          new RegExp(DEPENDENCY_POLICY_PACKAGE_PATTERN, "u"),
          "Dependency policy entries must be valid lowercase package names.",
        ),
    )
    .default([]),
});

export const CloudConfigSchema = z.object({
  apiBaseUrl: z.string().url().optional(),
  email: z.string().email().optional(),
  organizationSlug: z.string().min(1).optional(),
  workspaceSlug: z.string().min(1).optional(),
});

export const DyknowConfigSchema = z
  .object({
    projectName: z.string().min(1, "projectName is required."),
    mode: z.enum(["local-only", "connected"]),
    allowedSources: z
      .array(z.string().min(1))
      .min(1, "At least one allowed source is required."),
    ignoredSources: z.array(z.string().min(1)).default([]),
    pages: z
      .array(PageDefinitionSchema)
      .min(1, "At least one maintained page is required."),
    approvalRequired: z.boolean().default(true),
    llmProvider: LlmProviderSchema,
    publishTargets: z.array(z.string().min(1)).default([]),
    cloud: CloudConfigSchema.default({}),
    dependencyPolicy: DependencyPolicySchema.default({
      allow: [],
      deny: [],
    }),
  })
  .superRefine((config, ctx) => {
    if (config.mode === "local-only" && config.llmProvider !== "local") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["llmProvider"],
        message: 'Local-only mode only allows the "local" LLM provider.',
      });
    }

    if (config.mode === "local-only" && config.publishTargets.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["publishTargets"],
        message: "Local-only mode cannot define publish targets.",
      });
    }

    for (const [index, pattern] of config.allowedSources.entries()) {
      if (!isRepoRelativePattern(pattern)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["allowedSources", index],
          message: "Source patterns must stay within the repository root.",
        });
      }
    }

    for (const [index, pattern] of config.ignoredSources.entries()) {
      if (!isRepoRelativePattern(pattern)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ignoredSources", index],
          message: "Source patterns must stay within the repository root.",
        });
      }
    }

    const seenOutputPaths = new Map<string, number>();

    for (const [index, page] of config.pages.entries()) {
      if (!isRepoRelativePattern(page.outputPath)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pages", index, "outputPath"],
          message: "Output paths must stay within the repository root.",
        });
      }

      if (isProtectedOutputPath(page.outputPath)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pages", index, "outputPath"],
          message:
            'Output paths cannot target protected paths such as "docs/sources/**" or ".git/**".',
        });
      }

      const normalizedOutputPath = normalizeConfigPath(page.outputPath);

      if (seenOutputPaths.has(normalizedOutputPath)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pages", index, "outputPath"],
          message: "Output paths must be unique across maintained pages.",
        });
      } else {
        seenOutputPaths.set(normalizedOutputPath, index);
      }

      for (const [sourceIndex, pattern] of page.sources.entries()) {
        if (!isRepoRelativePattern(pattern)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["pages", index, "sources", sourceIndex],
            message: "Source patterns must stay within the repository root.",
          });
        }
      }
    }

    const allowedDependencies = new Set(config.dependencyPolicy.allow);

    for (const [index, packageName] of config.dependencyPolicy.deny.entries()) {
      if (allowedDependencies.has(packageName)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dependencyPolicy", "deny", index],
          message: `Dependency policy entries cannot be both allowed and denied for package "${packageName}".`,
        });
      }
    }
  });

export type LlmProvider = z.infer<typeof LlmProviderSchema>;
export type DependencyPolicy = z.infer<typeof DependencyPolicySchema>;
export type CloudConfig = z.infer<typeof CloudConfigSchema>;
export type DyknowConfig = z.infer<typeof DyknowConfigSchema>;

export type ValidationResult =
  | {
      success: true;
      data: DyknowConfig;
    }
  | {
      success: false;
      errors: string[];
    };

function normalizeConfigPath(value: string): string {
  return value.replaceAll("\\", "/").toLowerCase();
}

function isRepoRelativePattern(value: string): boolean {
  if (/[\0\r\n]/u.test(value)) {
    return false;
  }

  if (
    value.startsWith("/") ||
    value.startsWith("\\") ||
    /^[A-Za-z]:[\\/]/u.test(value)
  ) {
    return false;
  }

  return !value.replaceAll("\\", "/").split("/").includes("..");
}

function isProtectedOutputPath(value: string): boolean {
  const normalized = normalizeConfigPath(value);

  return (
    normalized === ".git" ||
    normalized.startsWith(".git/") ||
    normalized === "docs/sources" ||
    normalized.startsWith("docs/sources/")
  );
}

function dedupePatterns(patterns: readonly string[]): string[] {
  const seen = new Set<string>();

  return patterns.filter((pattern) => {
    if (seen.has(pattern)) {
      return false;
    }

    seen.add(pattern);
    return true;
  });
}

function withDefaultIgnoredSources(config: DyknowConfig): DyknowConfig {
  return {
    ...config,
    ignoredSources: dedupePatterns([
      ...DEFAULT_IGNORED_SOURCE_PATTERNS,
      ...config.ignoredSources,
    ]),
  };
}

function formatIssue(issue: z.ZodIssue): string {
  const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";

  return `${path}: ${issue.message}`;
}

function createDefaultMaintainedPages() {
  return [
    {
      id: "product-overview",
      title: "Product Overview",
      outputPath: "docs/product-overview.md",
      audience: "mixed",
      sources: ["README.md", "docs/**", "packages/**"],
      reviewRules: {
        approvalRequired: true,
      },
    },
    {
      id: "feature-map",
      title: "Feature Map",
      outputPath: "docs/feature-map.md",
      audience: "mixed",
      sources: ["README.md", "docs/**", "packages/**", ".github/**"],
      reviewRules: {
        approvalRequired: true,
      },
    },
    {
      id: "architecture",
      title: "Architecture",
      outputPath: "docs/architecture.md",
      audience: "mixed",
      sources: ["README.md", "docs/**", "packages/**", "package.json"],
      reviewRules: {
        approvalRequired: true,
      },
    },
    {
      id: "setup-guide",
      title: "Setup Guide",
      outputPath: "docs/setup-guide.md",
      audience: "external",
      sources: ["README.md", "docs/**", "package.json", "packages/**"],
      reviewRules: {
        approvalRequired: true,
      },
    },
    {
      id: "agent-context",
      title: "AI Agent Context",
      outputPath: "AGENTS.md",
      audience: "agent",
      sources: [
        "README.md",
        "AGENTS.md",
        "CLAUDE.md",
        ".github/**",
        "docs/**",
        "packages/**",
      ],
      reviewRules: {
        approvalRequired: true,
      },
    },
  ] satisfies DyknowConfig["pages"];
}

function createBaseAllowedSources(): string[] {
  return [
    "README.md",
    "AGENTS.md",
    "CLAUDE.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    ".github/**",
    "docs/**",
    "packages/**",
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "tsconfig*.json",
    "biome.json",
  ];
}

export type InitialStackProfile = "generic" | "nextjs" | "express" | "python";

function createStackAwareAllowedSources(
  stackProfile: InitialStackProfile,
): string[] {
  const baseSources = createBaseAllowedSources();

  if (stackProfile === "nextjs") {
    return dedupePatterns([
      ...baseSources,
      "app/**",
      "src/**",
      "pages/**",
      "public/**",
      "next.config.*",
      "middleware.*",
    ]);
  }

  if (stackProfile === "express") {
    return dedupePatterns([
      ...baseSources,
      "src/**",
      "server/**",
      "routes/**",
      "api/**",
    ]);
  }

  if (stackProfile === "python") {
    return dedupePatterns([
      ...baseSources,
      "src/**",
      "app/**",
      "api/**",
      "pyproject.toml",
      "requirements*.txt",
      "poetry.lock",
    ]);
  }

  return baseSources;
}

export function createInitialDyknowConfig(options?: {
  approvalRequired?: boolean;
  allowedSources?: string[];
  cloud?: CloudConfig;
  llmProvider?: LlmProvider;
  mode?: DyknowConfig["mode"];
  projectName?: string;
  publishTargets?: string[];
  stackProfile?: InitialStackProfile;
}): DyknowConfig {
  const mode = options?.mode ?? "local-only";
  const llmProvider =
    mode === "local-only" ? "local" : (options?.llmProvider ?? "local");

  const result = validateDyknowConfig({
    projectName: options?.projectName ?? "DyKnow",
    mode,
    allowedSources:
      options?.allowedSources ??
      createStackAwareAllowedSources(options?.stackProfile ?? "generic"),
    ignoredSources: [],
    pages: createDefaultMaintainedPages(),
    approvalRequired: options?.approvalRequired ?? true,
    llmProvider,
    cloud: options?.cloud ?? {},
    publishTargets:
      mode === "local-only" ? [] : (options?.publishTargets ?? []),
  });

  if (!result.success) {
    throw new Error(
      `Failed to create initial DyKnow config:\n- ${result.errors.join("\n- ")}`,
    );
  }

  return result.data;
}

export function renderDyknowConfig(
  config: DyknowConfig,
  schemaPath = `./${DYKNOW_CONFIG_SCHEMA_FILE_NAME}`,
): string {
  return `${JSON.stringify(
    {
      $schema: schemaPath,
      ...config,
    },
    null,
    2,
  )}\n`;
}

export function validateDyknowConfig(value: unknown): ValidationResult {
  const result = DyknowConfigSchema.safeParse(value);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map(formatIssue),
    };
  }

  return {
    success: true,
    data: withDefaultIgnoredSources(result.data),
  };
}

export function parseDyknowConfig(jsonText: string): DyknowConfig {
  let value: unknown;

  try {
    value = JSON.parse(jsonText);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unknown JSON parse error.";
    throw new Error(`Invalid DyKnow config JSON: ${reason}`);
  }

  const result = validateDyknowConfig(value);

  if (!result.success) {
    throw new Error(`Invalid DyKnow config:\n- ${result.errors.join("\n- ")}`);
  }

  return result.data;
}
