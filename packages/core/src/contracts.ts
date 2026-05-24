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

// ---------------------------------------------------------------------------
// Risk classifier
// ---------------------------------------------------------------------------

/**
 * A single rule in the risk classifier. A proposal is stamped `high` when
 * `minSignals` or more of the searchable fields (page title, output path,
 * matched source paths, current page content) contain the keyword.
 *
 * Rules are additive: the *highest* risk level that fires across all rules wins.
 */
export const RiskClassifierRuleSchema = z.object({
  /** Human-readable label for the rule category (e.g. "pricing"). */
  category: z.string().min(1),
  /** Keywords to search for (case-insensitive, substring match). */
  keywords: z.array(z.string().min(1)).min(1),
  /**
   * Risk level to assign when this rule fires.
   * Default: "high". Rules with `risk: "medium"` act as tie-breakers when no
   * high-risk rule fires.
   */
  risk: RiskLevelSchema.default("high"),
  /**
   * Minimum number of searchable fields that must contain at least one keyword
   * for the rule to fire. Default: 1 (any signal is enough).
   */
  minSignals: z.number().int().positive().default(1),
});

export type RiskClassifierRule = z.infer<typeof RiskClassifierRuleSchema>;

/**
 * The canonical DyKnow risk classifier ruleset.
 *
 * High-risk categories require `--allow-high-risk` to publish.
 * Medium-risk categories flag the proposal for careful review but do not block
 * publication.
 *
 * To propose a change to this rubric, open a PR with:
 * - The new or modified rule
 * - A justification referencing the harm model it addresses
 * - A test case that exercises the rule
 */
export const RISK_CLASSIFIER_RULES: readonly RiskClassifierRule[] = [
  {
    category: "pricing",
    keywords: [
      "pricing",
      "price",
      "cost",
      "billing",
      "subscription",
      "invoice",
      "payment",
      "charge",
      "fee",
      "tier",
    ],
    risk: "high",
    minSignals: 1,
  },
  {
    category: "legal",
    keywords: [
      "legal",
      "liability",
      "indemnity",
      "warranty",
      "disclaimer",
      "terms of service",
      "terms-of-service",
      "terms of use",
      "terms-of-use",
      "privacy policy",
      "privacy-policy",
      "gdpr",
      "ccpa",
      "dmca",
      "intellectual property",
      "copyright",
    ],
    risk: "high",
    minSignals: 1,
  },
  {
    category: "compliance",
    keywords: [
      "compliance",
      "regulatory",
      "regulation",
      "hipaa",
      "sox",
      "pci",
      "iso 27001",
      "soc 2",
      "soc2",
      "fedramp",
      "audit",
      "certified",
      "certification",
    ],
    risk: "high",
    minSignals: 1,
  },
  {
    category: "security",
    keywords: [
      "security",
      "vulnerability",
      "cve",
      "exploit",
      "penetration",
      "pentest",
      "authentication",
      "authorization",
      "credential",
      "secret",
      "token",
      "api key",
      "password",
      "encryption",
      "zero-day",
    ],
    risk: "high",
    minSignals: 2,
  },
  {
    category: "customer-commitment",
    keywords: [
      "sla",
      "service level",
      "uptime",
      "availability",
      "enterprise commitment",
      "enterprise commitments",
      "guaranteed",
      "guarantee",
      "refund",
    ],
    risk: "high",
    minSignals: 1,
  },
  {
    category: "pii",
    keywords: [
      "personal data",
      "personally identifiable",
      "pii",
      "health data",
      "medical",
      "financial data",
      "date of birth",
      "social security",
      "passport",
      "driver's license",
    ],
    risk: "high",
    minSignals: 1,
  },
] as const;

// ---------------------------------------------------------------------------
// Confidence scoring rubric
// ---------------------------------------------------------------------------

/**
 * The confidence score on a proposal reflects how well the evidence supports
 * the drafted update. Providers must populate this field; the rubric below
 * defines the local-stub heuristic and documents the semantics expected from
 * remote providers.
 *
 * | Level  | Meaning                                                          |
 * |--------|------------------------------------------------------------------|
 * | high   | 3+ matched source paths, or strong primary-source overlap        |
 * | medium | 2 matched source paths, or existing page content available       |
 * | low    | Single matched source path, no existing content to validate      |
 *
 * Remote providers (BYO key, vendor-hosted) must map their internal confidence
 * signal to one of these three values in the JSON schema they return.
 */
export const CONFIDENCE_SCORING_RUBRIC = {
  high: {
    description: "3 or more matched source paths, or strong primary-source overlap.",
    minMatchedSources: 3,
  },
  medium: {
    description: "2 matched source paths, or existing page content available.",
    minMatchedSources: 2,
  },
  low: {
    description: "Single matched source path, no existing content to validate against.",
    minMatchedSources: 1,
  },
} as const satisfies Record<
  z.infer<typeof ConfidenceLevelSchema>,
  { description: string; minMatchedSources: number }
>;

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
