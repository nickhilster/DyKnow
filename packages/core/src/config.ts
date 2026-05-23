import { z } from "zod";

import { PageDefinitionSchema } from "./contracts.js";

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
