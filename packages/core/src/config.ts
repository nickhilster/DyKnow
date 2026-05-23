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

export const LlmProviderSchema = z.enum(["local", "byo-key", "vendor-hosted"]);

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
  });

export type LlmProvider = z.infer<typeof LlmProviderSchema>;
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

export function createInitialDyknowConfig(options?: {
  approvalRequired?: boolean;
  llmProvider?: LlmProvider;
  mode?: DyknowConfig["mode"];
  projectName?: string;
  publishTargets?: string[];
}): DyknowConfig {
  const mode = options?.mode ?? "local-only";
  const llmProvider =
    mode === "local-only" ? "local" : (options?.llmProvider ?? "local");

  const result = validateDyknowConfig({
    projectName: options?.projectName ?? "DyKnow",
    mode,
    allowedSources: [
      "README.md",
      "AGENTS.md",
      "CLAUDE.md",
      "CHANGELOG.md",
      "CONTRIBUTING.md",
      ".github/**",
      "docs/**",
      "packages/**",
      "package.json",
      "tsconfig*.json",
      "biome.json",
    ],
    ignoredSources: [],
    pages: createDefaultMaintainedPages(),
    approvalRequired: options?.approvalRequired ?? true,
    llmProvider,
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
