import { z } from "zod";

export const AudienceSchema = z.enum([
  "internal",
  "external",
  "agent",
  "mixed",
]);

export const ConfidenceLevelSchema = z.enum(["low", "medium", "high"]);

export const RiskLevelSchema = z.enum(["low", "medium", "high"]);

export const ReviewStateSchema = z.enum([
  "Drafted",
  "Needs review",
  "Approved",
  "Rejected",
  "Edited",
  "Published",
  "Archived",
  "Escalated",
]);

export const ReviewRulesSchema = z.object({
  approvalRequired: z.boolean(),
});

export const PageDefinitionSchema = z.object({
  id: z
    .string()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Page ids must be lowercase kebab-case.",
    ),
  title: z.string().min(1, "Page titles must not be empty."),
  outputPath: z.string().min(1, "Output paths must not be empty."),
  audience: AudienceSchema,
  sources: z
    .array(z.string().min(1))
    .min(1, "Each page needs at least one source pattern."),
  reviewRules: ReviewRulesSchema,
});

export const SourceMapBindingSchema = z.object({
  pageId: PageDefinitionSchema.shape.id,
  relevance: z.number().min(0).max(1),
});

export const SourceMapEntrySchema = z.object({
  source: z
    .string()
    .min(1, "Source entries must identify the informing file or pattern."),
  pages: z
    .array(SourceMapBindingSchema)
    .min(1, "Each source must inform at least one page."),
});

export const UpdateProposalSchema = z.object({
  pageId: PageDefinitionSchema.shape.id,
  summary: z.string().min(1, "Update proposals need a change summary."),
  why: z.string().min(1, "Update proposals need a reason."),
  sources: z
    .array(z.string().min(1))
    .min(1, "Update proposals need source evidence."),
  proposedText: z.string().min(1, "Update proposals need exact proposed text."),
  confidence: ConfidenceLevelSchema,
  risk: RiskLevelSchema,
  reviewState: ReviewStateSchema,
  requiresHumanReview: z.boolean(),
});

export const AuditLogEntrySchema = z.object({
  action: z.string().min(1, "Audit entries need an action."),
  actor: z.string().min(1, "Audit entries need an actor."),
  sourcesRead: z.array(z.string().min(1)),
  outputsAffected: z.array(z.string().min(1)),
  timestamp: z.string().datetime({ offset: true }),
  hash: z
    .string()
    .regex(
      /^[a-f0-9]{8,}$/i,
      "Audit hashes should be hexadecimal digests or prefixes.",
    ),
});

export type Audience = z.infer<typeof AudienceSchema>;
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type ReviewState = z.infer<typeof ReviewStateSchema>;
export type ReviewRules = z.infer<typeof ReviewRulesSchema>;
export type PageDefinition = z.infer<typeof PageDefinitionSchema>;
export type SourceMapBinding = z.infer<typeof SourceMapBindingSchema>;
export type SourceMapEntry = z.infer<typeof SourceMapEntrySchema>;
export type UpdateProposal = z.infer<typeof UpdateProposalSchema>;
export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;
