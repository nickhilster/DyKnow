import { z } from "zod";

import { type DyknowConfig, LlmProviderSchema } from "./config.js";
import {
  ConfidenceLevelSchema,
  PageDefinitionSchema,
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

export const DEFAULT_UPDATE_OUTPUT_PATH =
  "docs/dyknow/.state/update-proposals.json";

export const DraftedPageUpdateSchema = z.object({
  affectedPage: AffectedPageSchema,
  proposal: UpdateProposalSchema,
});

export const UpdateDraftBatchSummarySchema = z.object({
  affectedPages: z.number().int().nonnegative(),
  draftedProposals: z.number().int().nonnegative(),
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
});

export type UpdateDraftRequest = z.infer<typeof UpdateDraftRequestSchema>;
export type UpdateProviderDraft = z.infer<typeof UpdateProviderDraftSchema>;
export type DraftedPageUpdate = z.infer<typeof DraftedPageUpdateSchema>;
export type UpdateDraftBatchSummary = z.infer<
  typeof UpdateDraftBatchSummarySchema
>;
export type UpdateDraftBatch = z.infer<typeof UpdateDraftBatchSchema>;

export type UpdateProvider = {
  id: z.infer<typeof LlmProviderSchema>;
  draftUpdate(options: {
    prompt: string;
    request: UpdateDraftRequest;
    template: UpdatePromptTemplate;
  }): Promise<UpdateProviderDraft>;
};

function formatReason(reason: string): string {
  return reason.replaceAll("-", " ");
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

      return UpdateProviderDraftSchema.parse({
        summary: `Review ${request.page.title} for ${sourceCount} changed source path(s).`,
        why: `${request.page.title} is affected because DyKnow detected ${reasonText} across ${sourceCount} configured source path(s).`,
        proposedText: [
          "<!-- dyknow:update local-stub -->",
          `Review ${request.page.title} against the following affected sources:`,
          ...request.affectedPage.matchedSourcePaths.map((path) => `- ${path}`),
          "",
          "This draft came from the local stub update provider and still requires human review before any publish or apply step.",
        ].join("\n"),
        confidence: "low",
        risk: "medium",
      });
    },
  };
}

export async function draftUpdateProposal(options: {
  config: DyknowConfig;
  provider: UpdateProvider;
  request: UpdateDraftRequest;
}): Promise<UpdateProposal> {
  ensureProviderMatchesConfig(options.config, options.provider);

  const request = UpdateDraftRequestSchema.parse(options.request);
  const template = getDefaultUpdatePromptTemplate(request.page.id);

  if (!template) {
    throw new Error(
      `No default update prompt template is registered for page "${request.page.id}".`,
    );
  }

  const prompt = buildUpdatePrompt(request, template);
  const providerDraft = UpdateProviderDraftSchema.parse(
    await options.provider.draftUpdate({
      prompt,
      request,
      template,
    }),
  );

  return UpdateProposalSchema.parse({
    pageId: request.page.id,
    summary: providerDraft.summary,
    why: providerDraft.why,
    sources: request.affectedPage.matchedSourcePaths,
    proposedText: providerDraft.proposedText,
    confidence: providerDraft.confidence,
    risk: providerDraft.risk,
    reviewState: "Needs review",
    requiresHumanReview: true,
  });
}
