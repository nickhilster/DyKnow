import { describe, expect, it } from "vitest";

import {
  AuditLogEntrySchema,
  CONFIDENCE_SCORING_RUBRIC,
  PageDefinitionSchema,
  RISK_CLASSIFIER_RULES,
  SourceMapEntrySchema,
  UpdateProposalSchema,
} from "../src/index.js";

describe("shared engine contracts", () => {
  it("parses a valid page definition and source map entry", () => {
    const page = PageDefinitionSchema.parse({
      id: "product-overview",
      title: "Product Overview",
      outputPath: "docs/dyknow/product-overview.md",
      audience: "mixed",
      sources: ["README.md", "docs/**"],
      reviewRules: {
        approvalRequired: true,
      },
    });

    const sourceMapEntry = SourceMapEntrySchema.parse({
      source: "README.md",
      pages: [
        {
          pageId: page.id,
          relevance: 1,
        },
      ],
    });

    expect(page.id).toBe("product-overview");
    expect(sourceMapEntry.pages[0]?.pageId).toBe("product-overview");
  });

  it("captures review state, evidence, and audit metadata", () => {
    const proposal = UpdateProposalSchema.parse({
      pageId: "agents-context",
      summary: "Refresh AGENTS.md after build bootstrap",
      why: "The repo now contains a real TypeScript workspace.",
      sources: ["package.json", "packages/core/src/contracts.ts"],
      proposedText: "Updated summary text.",
      confidence: "high",
      risk: "low",
      reviewState: "Needs review",
      requiresHumanReview: false,
    });

    const auditLogEntry = AuditLogEntrySchema.parse({
      action: "draft",
      actor: "copilot",
      sourcesRead: proposal.sources,
      outputsAffected: ["AGENTS.md"],
      timestamp: "2026-05-23T12:00:00.000Z",
      hash: "deadbeefcafebabe",
    });

    expect(proposal.reviewState).toBe("Needs review");
    expect(auditLogEntry.outputsAffected).toEqual(["AGENTS.md"]);
  });
});

describe("risk classifier ruleset", () => {
  it("has at least one rule for each documented high-risk category", () => {
    const expectedCategories = [
      "pricing",
      "legal",
      "compliance",
      "security",
      "customer-commitment",
      "pii",
    ];

    for (const category of expectedCategories) {
      expect(
        RISK_CLASSIFIER_RULES.some((rule) => rule.category === category),
        `Expected a risk classifier rule for category "${category}"`,
      ).toBe(true);
    }
  });

  it("all rules assign a valid risk level", () => {
    const validLevels = new Set(["low", "medium", "high"]);

    for (const rule of RISK_CLASSIFIER_RULES) {
      expect(
        validLevels.has(rule.risk),
        `Rule "${rule.category}" has invalid risk level "${rule.risk}"`,
      ).toBe(true);
    }
  });

  it("all rules have at least one non-empty keyword", () => {
    for (const rule of RISK_CLASSIFIER_RULES) {
      expect(
        rule.keywords.length,
        `Rule "${rule.category}" must have at least one keyword`,
      ).toBeGreaterThan(0);

      for (const keyword of rule.keywords) {
        expect(
          keyword.trim().length,
          `Rule "${rule.category}" has an empty keyword`,
        ).toBeGreaterThan(0);
      }
    }
  });
});

describe("confidence scoring rubric", () => {
  it("defines high, medium, and low levels", () => {
    expect(CONFIDENCE_SCORING_RUBRIC.high).toBeDefined();
    expect(CONFIDENCE_SCORING_RUBRIC.medium).toBeDefined();
    expect(CONFIDENCE_SCORING_RUBRIC.low).toBeDefined();
  });

  it("minMatchedSources is strictly ordered high > medium >= low", () => {
    expect(CONFIDENCE_SCORING_RUBRIC.high.minMatchedSources).toBeGreaterThan(
      CONFIDENCE_SCORING_RUBRIC.medium.minMatchedSources,
    );
    expect(
      CONFIDENCE_SCORING_RUBRIC.medium.minMatchedSources,
    ).toBeGreaterThanOrEqual(CONFIDENCE_SCORING_RUBRIC.low.minMatchedSources);
  });

  it("each level has a non-empty description", () => {
    for (const level of ["high", "medium", "low"] as const) {
      expect(
        CONFIDENCE_SCORING_RUBRIC[level].description.trim().length,
      ).toBeGreaterThan(0);
    }
  });
});
