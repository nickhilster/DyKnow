import { describe, expect, it } from "vitest";

import {
  createInitialDyknowConfig,
  createLocalStubUpdateProvider,
  draftUpdateProposal,
} from "../src/index.js";

describe("update runner", () => {
  it("drafts a needs-review proposal for an affected page", async () => {
    const config = createInitialDyknowConfig();
    const page = config.pages.find(
      (candidate) => candidate.id === "product-overview",
    );

    if (!page) {
      throw new Error("Missing default product-overview page definition.");
    }

    const proposal = await draftUpdateProposal({
      config,
      provider: createLocalStubUpdateProvider(),
      request: {
        page,
        affectedPage: {
          pageId: page.id,
          outputPath: page.outputPath,
          matchedSourcePaths: ["README.md", "packages/core/src/contracts.ts"],
          reasons: ["changed-file"],
        },
        currentContent: "# Product Overview\n",
      },
    });

    expect(proposal.pageId).toBe("product-overview");
    expect(proposal.sources).toEqual([
      "README.md",
      "packages/core/src/contracts.ts",
    ]);
    expect(proposal.reviewState).toBe("Needs review");
    expect(proposal.requiresHumanReview).toBe(true);
    expect(proposal.proposedText).toContain("local stub update provider");
  });

  it("fails closed in local-only mode for non-local providers", async () => {
    const config = createInitialDyknowConfig();
    const page = config.pages[0];

    await expect(
      draftUpdateProposal({
        config,
        provider: {
          id: "vendor-hosted",
          async draftUpdate() {
            return {
              summary: "Summary",
              why: "Why",
              proposedText: "Text",
              confidence: "low",
              risk: "low",
            };
          },
        },
        request: {
          page,
          affectedPage: {
            pageId: page.id,
            outputPath: page.outputPath,
            matchedSourcePaths: ["README.md"],
            reasons: ["changed-file"],
          },
        },
      }),
    ).rejects.toThrow(
      'Local-only mode only allows the "local" update provider.',
    );
  });
});
