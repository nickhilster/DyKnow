import { afterEach, describe, expect, it, vi } from "vitest";

import {
  classifyDraftRisk,
  createInitialDyknowConfig,
  createLocalStubUpdateProvider,
  createOpenAiByoKeyUpdateProvider,
  draftUpdateProposal,
  scoreDraftConfidence,
} from "../src/index.js";

const originalFetch = globalThis.fetch;

type InitialConfig = ReturnType<typeof createInitialDyknowConfig>;

function getFirstPage(config: InitialConfig) {
  const [page] = config.pages;

  if (!page) {
    throw new Error("Missing default page definition.");
  }

  return page;
}

function getPageById(config: InitialConfig, pageId: string) {
  const page = config.pages.find((candidate) => candidate.id === pageId);

  if (!page) {
    throw new Error(`Missing default ${pageId} page definition.`);
  }

  return page;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// Helper to build minimal UpdateDraftRequest fixtures
// ---------------------------------------------------------------------------
function makeRequest(overrides: {
  title?: string;
  outputPath?: string;
  matchedSourcePaths?: string[];
  currentContent?: string;
}) {
  const config = createInitialDyknowConfig();
  const page = {
    ...getFirstPage(config),
    title: overrides.title ?? "Feature Map",
    outputPath: overrides.outputPath ?? "docs/feature-map.md",
  };

  return {
    page,
    affectedPage: {
      pageId: page.id,
      outputPath: page.outputPath,
      matchedSourcePaths: overrides.matchedSourcePaths ?? ["README.md"],
      reasons: ["changed-file"] as const,
    },
    currentContent: overrides.currentContent ?? "",
  };
}

describe("classifyDraftRisk", () => {
  it("returns low for benign content", () => {
    expect(
      classifyDraftRisk(
        makeRequest({
          title: "Feature Map",
          matchedSourcePaths: ["README.md"],
        }),
      ),
    ).toBe("low");
  });

  it("returns high when page title contains a pricing keyword", () => {
    expect(classifyDraftRisk(makeRequest({ title: "Pricing Overview" }))).toBe(
      "high",
    );
  });

  it("returns high when output path contains a legal keyword", () => {
    expect(
      classifyDraftRisk(
        makeRequest({ outputPath: "docs/terms-of-service.md" }),
      ),
    ).toBe("high");
  });

  it("returns high when a source path contains a compliance keyword", () => {
    expect(
      classifyDraftRisk(
        makeRequest({ matchedSourcePaths: ["docs/soc2-report.md"] }),
      ),
    ).toBe("high");
  });

  it("returns high when page content contains a customer-commitment keyword", () => {
    expect(
      classifyDraftRisk(
        makeRequest({ currentContent: "We offer a 99.9% uptime SLA." }),
      ),
    ).toBe("high");
  });

  it("returns high when content contains PII keywords", () => {
    expect(
      classifyDraftRisk(
        makeRequest({
          currentContent: "We store personally identifiable information.",
        }),
      ),
    ).toBe("high");
  });

  it("returns high for security keyword when minSignals=2 threshold is met (title + source)", () => {
    expect(
      classifyDraftRisk(
        makeRequest({
          title: "Security Hardening Guide",
          matchedSourcePaths: ["docs/security-controls.md"],
        }),
      ),
    ).toBe("high");
  });

  it("returns low for security keyword when only one field fires (below minSignals=2)", () => {
    expect(
      classifyDraftRisk(
        makeRequest({
          title: "Security Overview",
          matchedSourcePaths: ["README.md"],
          currentContent: "",
          outputPath: "docs/overview.md",
        }),
      ),
    ).toBe("low");
  });

  it("is case-insensitive", () => {
    expect(classifyDraftRisk(makeRequest({ title: "PRICING PAGE" }))).toBe(
      "high",
    );
  });
});

describe("scoreDraftConfidence", () => {
  it("returns low for a single source and no existing content", () => {
    expect(
      scoreDraftConfidence(
        makeRequest({ matchedSourcePaths: ["README.md"], currentContent: "" }),
      ),
    ).toBe("low");
  });

  it("returns medium for two matched source paths", () => {
    expect(
      scoreDraftConfidence(
        makeRequest({
          matchedSourcePaths: ["README.md", "package.json"],
          currentContent: "",
        }),
      ),
    ).toBe("medium");
  });

  it("returns medium for one source path when existing content is present", () => {
    expect(
      scoreDraftConfidence(
        makeRequest({
          matchedSourcePaths: ["README.md"],
          currentContent: "# Existing content",
        }),
      ),
    ).toBe("medium");
  });

  it("returns high for three or more matched source paths", () => {
    expect(
      scoreDraftConfidence(
        makeRequest({
          matchedSourcePaths: [
            "README.md",
            "package.json",
            "docs/architecture.md",
          ],
        }),
      ),
    ).toBe("high");
  });
});

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
    expect(proposal.proposedText).toContain("# Product Overview");
    expect(proposal.proposedText).toContain("## Affected sources");
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

  it("raises high risk for security-oriented updates", async () => {
    const config = createInitialDyknowConfig();
    const page = {
      ...getPageById(config, "product-overview"),
      title: "Security Overview",
      sources: ["docs/trust-and-security.md"],
    };

    const proposal = await draftUpdateProposal({
      config,
      provider: createLocalStubUpdateProvider(),
      request: {
        page,
        affectedPage: {
          pageId: page.id,
          outputPath: page.outputPath,
          matchedSourcePaths: ["docs/trust-and-security.md"],
          reasons: ["changed-file"],
        },
        currentContent:
          "This page documents security statements and compliance claims.",
      },
    });

    expect(proposal.risk).toBe("high");
    expect(proposal.confidence).toBe("medium");
  });

  it("raises confidence to high when three or more sources overlap for the same page", async () => {
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
          matchedSourcePaths: [
            "README.md",
            "docs/product-overview.md",
            "packages/core/src/contracts.ts",
          ],
          reasons: ["changed-file"],
        },
        currentContent: "# Product Overview\n\nDyKnow overview.\n",
      },
    });

    // Three benign source paths → no risk rule fires → low risk.
    // Three source paths meets the high-confidence rubric threshold.
    expect(proposal.risk).toBe("low");
    expect(proposal.confidence).toBe("high");
  });

  it("parses structured output from the OpenAI BYO provider", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            usage: {
              input_tokens: 120,
              output_tokens: 80,
              total_tokens: 200,
            },
            output: [
              {
                content: [
                  {
                    text: JSON.stringify({
                      summary: "Summary",
                      why: "Why",
                      proposedText: "# Product Overview\n\nUpdated draft",
                      confidence: "high",
                      risk: "medium",
                    }),
                  },
                ],
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
    ) as typeof fetch;

    const provider = createOpenAiByoKeyUpdateProvider({
      apiKey: "test-key",
      endpoint: "https://example.com/v1/responses",
      model: "gpt-test",
    });

    const result = await provider.draftUpdate({
      prompt: "Prompt",
      request: {
        page: getFirstPage(createInitialDyknowConfig()),
        affectedPage: {
          pageId: "product-overview",
          outputPath: "docs/product-overview.md",
          matchedSourcePaths: ["README.md"],
          reasons: ["changed-file"],
        },
        currentContent: "# Product Overview\n",
      },
      template: {
        pageId: "product-overview",
        systemPrompt: "System",
        instructions: ["Instruction"],
      },
    });

    expect(result.draft.summary).toBe("Summary");
    expect(result.draft.proposedText).toContain("Updated draft");
    expect(result.draft.confidence).toBe("high");
    expect(result.draft.risk).toBe("medium");
    expect(result.telemetry?.attempts).toBe(1);
    expect(result.telemetry?.usage.totalTokens).toBe(200);
  });

  it("assigns low risk and low confidence for a minimal, benign request", async () => {
    const config = createInitialDyknowConfig();
    const page = getPageById(config, "feature-map");

    const proposal = await draftUpdateProposal({
      config,
      provider: createLocalStubUpdateProvider(),
      request: {
        page,
        affectedPage: {
          pageId: page.id,
          outputPath: page.outputPath,
          matchedSourcePaths: ["package.json"],
          reasons: ["changed-file"],
        },
        currentContent: "",
      },
    });

    expect(proposal.risk).toBe("low");
    expect(proposal.confidence).toBe("low");
  });

  it("retries retryable BYO provider failures before succeeding", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: "Rate limited",
            },
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            output: [
              {
                content: [
                  {
                    text: JSON.stringify({
                      summary: "Recovered",
                      why: "Retry worked",
                      proposedText: "# Product Overview\n\nRetry draft",
                      confidence: "medium",
                      risk: "low",
                    }),
                  },
                ],
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      ) as typeof fetch;

    const provider = createOpenAiByoKeyUpdateProvider({
      apiKey: "test-key",
      endpoint: "https://example.com/v1/responses",
      maxAttempts: 2,
      model: "gpt-test",
      retryDelayMs: 0,
    });

    const result = await provider.draftUpdate({
      prompt: "Prompt",
      request: {
        page: getFirstPage(createInitialDyknowConfig()),
        affectedPage: {
          pageId: "product-overview",
          outputPath: "docs/product-overview.md",
          matchedSourcePaths: ["README.md"],
          reasons: ["changed-file"],
        },
        currentContent: "# Product Overview\n",
      },
      template: {
        pageId: "product-overview",
        systemPrompt: "System",
        instructions: ["Instruction"],
      },
    });

    expect(result.draft.summary).toBe("Recovered");
    expect(result.telemetry?.attempts).toBe(2);
  });
});
