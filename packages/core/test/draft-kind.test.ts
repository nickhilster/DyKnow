import { describe, expect, it } from "vitest";

import {
  UpdateProposalSchema,
  type UpdateProvider,
  createInitialDyknowConfig,
  createLocalStubUpdateProvider,
  draftUpdateProposal,
  formatConfidenceLabel,
} from "../src/index.js";

function buildRequest() {
  const config = createInitialDyknowConfig();
  const page = config.pages.find((candidate) => candidate.id === "feature-map");

  if (!page) {
    throw new Error("Missing default feature-map page definition.");
  }

  return {
    config,
    request: {
      page,
      affectedPage: {
        pageId: page.id,
        outputPath: page.outputPath,
        matchedSourcePaths: ["README.md", "docs/a.md", "docs/b.md"],
        reasons: ["changed-file" as const],
      },
      currentContent: "",
    },
  };
}

describe("proposal draft kind", () => {
  it("marks the offline provider's placeholder drafts as stubs", async () => {
    const { config, request } = buildRequest();

    const proposal = await draftUpdateProposal({
      config,
      provider: createLocalStubUpdateProvider(),
      request,
    });

    expect(proposal.draftKind).toBe("stub");
    // Three matched sources score "high": evidence overlap, not draft quality.
    expect(proposal.confidence).toBe("high");
    expect(proposal.proposedText).toContain("local-stub");
  });

  it("treats a draft that does not say otherwise as generated", async () => {
    const { config, request } = buildRequest();
    const provider: UpdateProvider = {
      id: "local",
      async draftUpdate() {
        return {
          draft: {
            summary: "Describe the new command.",
            why: "A command was added.",
            proposedText: "## Commands\n\n- `adopt` installs the tool.",
            confidence: "medium",
            risk: "low",
          },
        };
      },
    };

    const proposal = await draftUpdateProposal({ config, provider, request });

    expect(proposal.draftKind).toBe("generated");
  });

  it("keeps a provider's explicit draft kind", async () => {
    const { config, request } = buildRequest();
    const provider: UpdateProvider = {
      id: "local",
      async draftUpdate() {
        return {
          draft: {
            summary: "Placeholder.",
            why: "No model configured.",
            proposedText: "TODO",
            confidence: "low",
            risk: "low",
            draftKind: "stub",
          },
        };
      },
    };

    const proposal = await draftUpdateProposal({ config, provider, request });

    expect(proposal.draftKind).toBe("stub");
  });

  it("still parses proposals written before the field existed", () => {
    const proposal = UpdateProposalSchema.parse({
      pageId: "feature-map",
      summary: "Summary",
      why: "Why",
      sources: ["README.md"],
      proposedText: "Text",
      confidence: "low",
      risk: "low",
      reviewState: "Needs review",
      requiresHumanReview: true,
    });

    expect(proposal.draftKind).toBeUndefined();
    expect(formatConfidenceLabel(proposal)).toBe("low");
  });
});

describe("formatConfidenceLabel", () => {
  it("labels stubs so they do not read like trustworthy drafts", () => {
    expect(
      formatConfidenceLabel({ confidence: "high", draftKind: "stub" }),
    ).toBe("high (stub)");
  });

  it("leaves generated and unmarked drafts unchanged", () => {
    expect(
      formatConfidenceLabel({ confidence: "high", draftKind: "generated" }),
    ).toBe("high");
    expect(formatConfidenceLabel({ confidence: "medium" })).toBe("medium");
  });
});
