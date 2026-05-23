import { describe, expect, it } from "vitest";

import {
  AuditLogEntrySchema,
  PageDefinitionSchema,
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
