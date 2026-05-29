import { z } from "zod";

import { type DyknowConfig, LlmProviderSchema } from "./config.js";
import {
  CONFIDENCE_SCORING_RUBRIC,
  ConfidenceLevelSchema,
  PageDefinitionSchema,
  RISK_CLASSIFIER_RULES,
  RiskLevelSchema,
  type UpdateProposal,
  UpdateProposalSchema,
} from "./contracts.js";
import { AffectedPageSchema } from "./repo-diff.js";
import {
  type UpdatePromptTemplate,
  getDefaultUpdatePromptTemplate,
} from "./update-templates.js";

export const UpdateDraftRequestSchema = z.object({
  page: PageDefinitionSchema,
  affectedPage: AffectedPageSchema,
  currentContent: z.string().default(""),
});

export const UpdateProviderDraftSchema = z.object({
  summary: z.string().min(1),
  why: z.string().min(1),
  proposedText: z.string().min(1),
  confidence: ConfidenceLevelSchema,
  risk: RiskLevelSchema,
});

export const UpdateProviderUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative().default(0),
  outputTokens: z.number().int().nonnegative().default(0),
  totalTokens: z.number().int().nonnegative().default(0),
  estimatedCostUsd: z.number().nonnegative().nullable().default(null),
});

export const UpdateProviderTelemetrySchema = z.object({
  attempts: z.number().int().positive().default(1),
  durationMs: z.number().int().nonnegative().default(0),
  timedOut: z.boolean().default(false),
  usage: UpdateProviderUsageSchema.default({}),
});

export const DEFAULT_UPDATE_OUTPUT_PATH =
  "docs/dyknow/.state/update-proposals.json";

export const DraftedPageUpdateSchema = z.object({
  affectedPage: AffectedPageSchema,
  proposal: UpdateProposalSchema,
  providerTelemetry: UpdateProviderTelemetrySchema.default({}),
});

export const UpdateDraftBatchSummarySchema = z.object({
  affectedPages: z.number().int().nonnegative(),
  draftedProposals: z.number().int().nonnegative(),
});

export const UpdateDraftBatchTelemetrySchema = z.object({
  totalAttempts: z.number().int().nonnegative().default(0),
  totalDurationMs: z.number().int().nonnegative().default(0),
  timedOutDrafts: z.number().int().nonnegative().default(0),
  usage: UpdateProviderUsageSchema.default({}),
});

export const UpdateDraftBatchSchema = z.object({
  draftedAt: z.string().datetime({ offset: true }),
  rootPath: z.string().min(1),
  configPath: z.string().min(1),
  repoDiffPath: z.string().min(1),
  outputPath: z.string().min(1),
  providerId: LlmProviderSchema,
  drafts: z.array(DraftedPageUpdateSchema),
  summary: UpdateDraftBatchSummarySchema,
  providerTelemetry: UpdateDraftBatchTelemetrySchema.default({}),
});

export type UpdateDraftRequest = z.infer<typeof UpdateDraftRequestSchema>;
export type UpdateProviderDraft = z.infer<typeof UpdateProviderDraftSchema>;
export type UpdateProviderUsage = z.infer<typeof UpdateProviderUsageSchema>;
export type UpdateProviderTelemetry = z.infer<
  typeof UpdateProviderTelemetrySchema
>;
export type DraftedPageUpdate = z.infer<typeof DraftedPageUpdateSchema>;
export type UpdateDraftBatchSummary = z.infer<
  typeof UpdateDraftBatchSummarySchema
>;
export type UpdateDraftBatchTelemetry = z.infer<
  typeof UpdateDraftBatchTelemetrySchema
>;
export type UpdateDraftBatch = z.infer<typeof UpdateDraftBatchSchema>;

export type UpdateProvider = {
  id: z.infer<typeof LlmProviderSchema>;
  draftUpdate(options: {
    prompt: string;
    request: UpdateDraftRequest;
    template: UpdatePromptTemplate;
  }): Promise<{
    draft: UpdateProviderDraft;
    telemetry?: UpdateProviderTelemetry;
  }>;
};

type FetchLike = typeof fetch;

function formatReason(reason: string): string {
  return reason.replaceAll("-", " ");
}

function normalizeText(value: string): string {
  return value.toLowerCase();
}

/**
 * Classify the risk level of an update proposal using the canonical
 * `RISK_CLASSIFIER_RULES` rubric defined in contracts.ts.
 *
 * Each rule is evaluated against the searchable fields of the request:
 * page title, output path, matched source paths, and current page content.
 * A field "fires" for a rule when it contains at least one of the rule's
 * keywords. The rule fires when the number of firing fields meets or exceeds
 * `minSignals`. The highest risk level across all fired rules is returned.
 */
export function classifyDraftRisk(
  request: UpdateDraftRequest,
): z.infer<typeof RiskLevelSchema> {
  const searchableFields = [
    request.page.title,
    request.page.outputPath,
    ...request.affectedPage.matchedSourcePaths,
    request.currentContent,
  ].map(normalizeText);

  const RISK_ORDER: z.infer<typeof RiskLevelSchema>[] = [
    "low",
    "medium",
    "high",
  ];

  let highestRisk: z.infer<typeof RiskLevelSchema> = "low";

  for (const rule of RISK_CLASSIFIER_RULES) {
    const firingFieldCount = searchableFields.filter((field) =>
      rule.keywords.some((keyword) => field.includes(keyword)),
    ).length;

    if (firingFieldCount >= rule.minSignals) {
      if (RISK_ORDER.indexOf(rule.risk) > RISK_ORDER.indexOf(highestRisk)) {
        highestRisk = rule.risk;
      }
    }

    if (highestRisk === "high") {
      break;
    }
  }

  return highestRisk;
}

/**
 * Score the confidence of an update proposal using the canonical
 * `CONFIDENCE_SCORING_RUBRIC` defined in contracts.ts.
 *
 * Confidence reflects how well the available evidence supports the draft:
 * - high:   3+ matched source paths
 * - medium: 2 matched source paths, OR existing page content is present
 * - low:    fewer than 2 matched source paths and no existing content
 */
export function scoreDraftConfidence(
  request: UpdateDraftRequest,
): z.infer<typeof ConfidenceLevelSchema> {
  const sourceCount = request.affectedPage.matchedSourcePaths.length;

  if (sourceCount >= CONFIDENCE_SCORING_RUBRIC.high.minMatchedSources) {
    return "high";
  }

  if (
    sourceCount >= CONFIDENCE_SCORING_RUBRIC.medium.minMatchedSources ||
    request.currentContent.trim().length > 0
  ) {
    return "medium";
  }

  return "low";
}

function renderAffectedSources(
  request: UpdateDraftRequest,
  heading: string,
): string[] {
  return [
    heading,
    ...request.affectedPage.matchedSourcePaths.map((path) => `- ${path}`),
  ];
}

function renderLocalStubDraftText(request: UpdateDraftRequest): string {
  switch (request.page.id) {
    case "product-overview":
      return [
        "# Product Overview",
        "",
        "## What changed",
        `DyKnow detected ${request.affectedPage.reasons.map(formatReason).join(", ")} for this page.`,
        "",
        "## Affected sources",
        ...request.affectedPage.matchedSourcePaths.map((path) => `- ${path}`),
        "",
        "## Review notes",
        "Confirm the product truth, audience fit, and Cloud versus Local positioning still match the updated sources.",
        "",
        "<!-- dyknow:update local-stub -->",
      ].join("\n");
    case "feature-map":
      return [
        "# Feature Map",
        "",
        "## Review focus",
        "Update implemented versus planned command status and any changed workflow descriptions.",
        "",
        "## Affected sources",
        ...request.affectedPage.matchedSourcePaths.map((path) => `- ${path}`),
        "",
        "## Notes",
        "Keep command names and status labels aligned with the codebase.",
        "",
        "<!-- dyknow:update local-stub -->",
      ].join("\n");
    case "architecture":
      return [
        "# Architecture",
        "",
        "## Review focus",
        "Update shared-engine responsibilities, CLI ownership boundaries, and trust-boundary behavior affected by these source changes.",
        "",
        "## Affected sources",
        ...request.affectedPage.matchedSourcePaths.map((path) => `- ${path}`),
        "",
        "## Notes",
        "Preserve the distinction between DyKnow Local, DyKnow Cloud, and shared engine behavior.",
        "",
        "<!-- dyknow:update local-stub -->",
      ].join("\n");
    case "setup-guide":
      return [
        "# Setup Guide",
        "",
        "## Review focus",
        "Update command order, prerequisite artifacts, and operator-facing safety notes affected by these changes.",
        "",
        "## Affected sources",
        ...request.affectedPage.matchedSourcePaths.map((path) => `- ${path}`),
        "",
        "## Notes",
        "Keep the guide chronological and explicit about required flags and outputs.",
        "",
        "<!-- dyknow:update local-stub -->",
      ].join("\n");
    case "agent-context":
      return [
        "# AGENTS.md Review Draft",
        "",
        "## Review focus",
        "Refresh the compact repo context, implemented command list, and guardrails based on the changed sources below.",
        "",
        "## Affected sources",
        ...request.affectedPage.matchedSourcePaths.map((path) => `- ${path}`),
        "",
        "## Notes",
        "Keep the file factual, compact, and aligned with the current command surface.",
        "",
        "<!-- dyknow:update local-stub -->",
      ].join("\n");
    default:
      return [
        "<!-- dyknow:update local-stub -->",
        ...renderAffectedSources(
          request,
          `Review ${request.page.title} against the following affected sources:`,
        ),
        "",
        "This draft came from the local stub update provider and still requires human review before any publish or apply step.",
      ].join("\n");
  }
}

function getJsonSchemaProviderDraftSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["summary", "why", "proposedText", "confidence", "risk"],
    properties: {
      summary: { type: "string" },
      why: { type: "string" },
      proposedText: { type: "string" },
      confidence: {
        type: "string",
        enum: ConfidenceLevelSchema.options,
      },
      risk: {
        type: "string",
        enum: RiskLevelSchema.options,
      },
    },
  };
}

function extractResponseText(responseBody: unknown): string {
  if (
    responseBody &&
    typeof responseBody === "object" &&
    "output_text" in responseBody &&
    typeof responseBody.output_text === "string"
  ) {
    return responseBody.output_text;
  }

  if (
    responseBody &&
    typeof responseBody === "object" &&
    "output" in responseBody &&
    Array.isArray(responseBody.output)
  ) {
    for (const item of responseBody.output) {
      if (!item || typeof item !== "object" || !("content" in item)) {
        continue;
      }

      const content = item.content;

      if (!Array.isArray(content)) {
        continue;
      }

      for (const part of content) {
        if (!part || typeof part !== "object") {
          continue;
        }

        if ("text" in part && typeof part.text === "string") {
          return part.text;
        }
      }
    }
  }

  throw new Error("OpenAI BYO provider returned no text output.");
}

function estimateOpenAiCostUsd(options: {
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}): number | null {
  const pricingByModel = new Map<
    string,
    { inputPerMillionUsd: number; outputPerMillionUsd: number }
  >([
    ["gpt-4.1", { inputPerMillionUsd: 2, outputPerMillionUsd: 8 }],
    ["gpt-4.1-mini", { inputPerMillionUsd: 0.4, outputPerMillionUsd: 1.6 }],
    ["gpt-4o", { inputPerMillionUsd: 5, outputPerMillionUsd: 15 }],
    ["gpt-4o-mini", { inputPerMillionUsd: 0.15, outputPerMillionUsd: 0.6 }],
  ]);
  const pricing = pricingByModel.get(options.model);

  if (!pricing) {
    return null;
  }

  const inputCost =
    (options.usage.inputTokens / 1_000_000) * pricing.inputPerMillionUsd;
  const outputCost =
    (options.usage.outputTokens / 1_000_000) * pricing.outputPerMillionUsd;

  return Number((inputCost + outputCost).toFixed(6));
}

function extractUsage(
  responseBody: unknown,
  model: string,
): UpdateProviderUsage {
  if (
    !responseBody ||
    typeof responseBody !== "object" ||
    !("usage" in responseBody) ||
    !responseBody.usage ||
    typeof responseBody.usage !== "object"
  ) {
    return UpdateProviderUsageSchema.parse({});
  }

  const usageRecord = responseBody.usage as Record<string, unknown>;
  const inputTokens =
    typeof usageRecord.input_tokens === "number" ? usageRecord.input_tokens : 0;
  const outputTokens =
    typeof usageRecord.output_tokens === "number"
      ? usageRecord.output_tokens
      : 0;
  const totalTokens =
    typeof usageRecord.total_tokens === "number"
      ? usageRecord.total_tokens
      : inputTokens + outputTokens;

  return UpdateProviderUsageSchema.parse({
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd: estimateOpenAiCostUsd({
      model,
      usage: { inputTokens, outputTokens },
    }),
  });
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.message.includes("aborted"))
  );
}

function ensureProviderMatchesConfig(
  config: DyknowConfig,
  provider: UpdateProvider,
) {
  if (config.mode === "local-only" && provider.id !== "local") {
    throw new Error('Local-only mode only allows the "local" update provider.');
  }

  if (config.llmProvider !== provider.id) {
    throw new Error(
      `Configured llmProvider "${config.llmProvider}" does not match the supplied update provider "${provider.id}".`,
    );
  }
}

export function buildUpdatePrompt(
  request: UpdateDraftRequest,
  template: UpdatePromptTemplate,
): string {
  const sections = [
    template.systemPrompt,
    "",
    `Page ID: ${request.page.id}`,
    `Page title: ${request.page.title}`,
    `Output path: ${request.page.outputPath}`,
    `Audience: ${request.page.audience}`,
    `Affected reasons: ${request.affectedPage.reasons.map(formatReason).join(", ")}`,
    "Affected source paths:",
    ...request.affectedPage.matchedSourcePaths.map((path) => `- ${path}`),
    "",
    "Update instructions:",
    ...template.instructions.map((instruction) => `- ${instruction}`),
  ];

  if (request.currentContent.trim().length > 0) {
    sections.push("", "Current page content:", request.currentContent);
  }

  return sections.join("\n");
}

export function createLocalStubUpdateProvider(): UpdateProvider {
  return {
    id: "local",
    async draftUpdate({ request }) {
      const sourceCount = request.affectedPage.matchedSourcePaths.length;
      const reasonText = request.affectedPage.reasons
        .map(formatReason)
        .join(", ");
      const risk = classifyDraftRisk(request);
      const confidence = scoreDraftConfidence(request);

      return {
        draft: UpdateProviderDraftSchema.parse({
          summary: `Review ${request.page.title} for ${sourceCount} changed source path(s).`,
          why: `${request.page.title} is affected because DyKnow detected ${reasonText} across ${sourceCount} configured source path(s).`,
          proposedText: renderLocalStubDraftText(request),
          confidence,
          risk,
        }),
        telemetry: UpdateProviderTelemetrySchema.parse({}),
      };
    },
  };
}

export function createOpenAiByoKeyUpdateProvider(options: {
  apiKey: string;
  endpoint?: string;
  fetchImpl?: FetchLike;
  maxAttempts?: number;
  model: string;
  requestTimeoutMs?: number;
  retryDelayMs?: number;
}): UpdateProvider {
  return {
    id: "byo-key",
    async draftUpdate({ prompt }) {
      const fetchImpl = options.fetchImpl ?? globalThis.fetch;
      const maxAttempts = options.maxAttempts ?? 3;
      const retryDelayMs = options.retryDelayMs ?? 250;
      const requestTimeoutMs = options.requestTimeoutMs ?? 30_000;

      if (!fetchImpl) {
        throw new Error("Fetch is not available for the BYO update provider.");
      }

      const startedAt = Date.now();
      let lastError: Error | undefined;
      let timedOut = false;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          requestTimeoutMs,
        );

        try {
          const response = await fetchImpl(
            options.endpoint ?? "https://api.openai.com/v1/responses",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${options.apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: options.model,
                input: prompt,
                text: {
                  format: {
                    type: "json_schema",
                    name: "dyknow_update_provider_draft",
                    strict: true,
                    schema: getJsonSchemaProviderDraftSchema(),
                  },
                },
              }),
              signal: controller.signal,
            },
          );
          const responseBody = (await response.json()) as unknown;

          if (!response.ok) {
            const message =
              responseBody &&
              typeof responseBody === "object" &&
              "error" in responseBody &&
              responseBody.error &&
              typeof responseBody.error === "object" &&
              "message" in responseBody.error &&
              typeof responseBody.error.message === "string"
                ? responseBody.error.message
                : `OpenAI request failed with status ${response.status}.`;

            if (attempt < maxAttempts && isRetryableStatus(response.status)) {
              lastError = new Error(
                `OpenAI BYO provider request failed: ${message}`,
              );
              await delay(retryDelayMs * attempt);
              continue;
            }

            throw new Error(`OpenAI BYO provider request failed: ${message}`);
          }

          return {
            draft: UpdateProviderDraftSchema.parse(
              JSON.parse(extractResponseText(responseBody)),
            ),
            telemetry: UpdateProviderTelemetrySchema.parse({
              attempts: attempt,
              durationMs: Date.now() - startedAt,
              timedOut,
              usage: extractUsage(responseBody, options.model),
            }),
          };
        } catch (error) {
          if (isAbortError(error)) {
            timedOut = true;
            lastError = new Error(
              `OpenAI BYO provider request timed out after ${requestTimeoutMs}ms.`,
            );
          } else {
            lastError =
              error instanceof Error
                ? error
                : new Error("Unknown provider error.");
          }

          if (attempt >= maxAttempts) {
            throw lastError;
          }

          await delay(retryDelayMs * attempt);
        } finally {
          clearTimeout(timeoutId);
        }
      }

      throw lastError ?? new Error("OpenAI BYO provider failed unexpectedly.");
    },
  };
}

export async function draftUpdateResult(options: {
  config: DyknowConfig;
  provider: UpdateProvider;
  request: UpdateDraftRequest;
}): Promise<{
  proposal: UpdateProposal;
  providerTelemetry: UpdateProviderTelemetry;
}> {
  ensureProviderMatchesConfig(options.config, options.provider);

  const request = UpdateDraftRequestSchema.parse(options.request);
  const template = getDefaultUpdatePromptTemplate(request.page.id);

  if (!template) {
    throw new Error(
      `No default update prompt template is registered for page "${request.page.id}".`,
    );
  }

  const prompt = buildUpdatePrompt(request, template);
  const providerResult = await options.provider.draftUpdate({
    prompt,
    request,
    template,
  });
  const providerDraft = UpdateProviderDraftSchema.parse(providerResult.draft);
  const providerTelemetry = UpdateProviderTelemetrySchema.parse(
    providerResult.telemetry ?? {},
  );

  return {
    proposal: UpdateProposalSchema.parse({
      pageId: request.page.id,
      summary: providerDraft.summary,
      why: providerDraft.why,
      sources: request.affectedPage.matchedSourcePaths,
      proposedText: providerDraft.proposedText,
      confidence: providerDraft.confidence,
      risk: providerDraft.risk,
      reviewState: "Needs review",
      requiresHumanReview: true,
    }),
    providerTelemetry,
  };
}

export async function draftUpdateProposal(options: {
  config: DyknowConfig;
  provider: UpdateProvider;
  request: UpdateDraftRequest;
}): Promise<UpdateProposal> {
  const result = await draftUpdateResult(options);

  return UpdateProposalSchema.parse(result.proposal);
}
