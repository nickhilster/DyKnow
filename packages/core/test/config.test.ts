import { describe, expect, it } from "vitest";

import {
  DEFAULT_IGNORED_SOURCE_PATTERNS,
  parseDyknowConfig,
  validateDyknowConfig,
} from "../src/index.js";

describe("DyKnow config validation", () => {
  it("merges the default ignored source patterns into successful config output", () => {
    const result = validateDyknowConfig({
      projectName: "DyKnow",
      mode: "connected",
      allowedSources: ["README.md", "docs/**"],
      ignoredSources: ["tmp/**", "dist/**"],
      pages: [
        {
          id: "agent-context",
          title: "AI Agent Context",
          outputPath: "AGENTS.md",
          audience: "agent",
          sources: ["README.md", "docs/**"],
          reviewRules: {
            approvalRequired: true,
          },
        },
      ],
      approvalRequired: true,
      llmProvider: "local",
      publishTargets: [],
    });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.data.ignoredSources).toEqual([
      ...DEFAULT_IGNORED_SOURCE_PATTERNS,
      "tmp/**",
    ]);
  });

  it("rejects remote behavior when local-only mode is selected", () => {
    const result = validateDyknowConfig({
      projectName: "DyKnow",
      mode: "local-only",
      allowedSources: ["README.md"],
      ignoredSources: [],
      pages: [
        {
          id: "product-overview",
          title: "Product Overview",
          outputPath: "docs/dyknow/product-overview.md",
          audience: "internal",
          sources: ["README.md"],
          reviewRules: {
            approvalRequired: true,
          },
        },
      ],
      approvalRequired: true,
      llmProvider: "vendor-hosted",
      publishTargets: ["dyknow-cloud"],
    });

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.errors).toContain(
      'llmProvider: Local-only mode only allows the "local" LLM provider.',
    );
    expect(result.errors).toContain(
      "publishTargets: Local-only mode cannot define publish targets.",
    );
  });

  it("surfaces invalid JSON with a helpful parse error", () => {
    expect(() => parseDyknowConfig("{")).toThrowError(
      /Invalid DyKnow config JSON:/,
    );
  });
});
