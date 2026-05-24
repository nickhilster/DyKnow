import { readFile } from "node:fs/promises";

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
    expect(result.data.dependencyPolicy).toEqual({
      allow: [],
      deny: [],
    });
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

  it("rejects source patterns and output paths that escape the repository root", () => {
    const result = validateDyknowConfig({
      projectName: "DyKnow",
      mode: "connected",
      allowedSources: ["../secrets/**", "docs/**"],
      ignoredSources: ["C:/outside/**"],
      pages: [
        {
          id: "agent-context",
          title: "AI Agent Context",
          outputPath: "../AGENTS.md",
          audience: "agent",
          sources: ["../../private/**", "docs/**"],
          reviewRules: {
            approvalRequired: true,
          },
        },
      ],
      approvalRequired: true,
      llmProvider: "local",
      publishTargets: [],
    });

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.errors).toContain(
      "allowedSources.0: Source patterns must stay within the repository root.",
    );
    expect(result.errors).toContain(
      "ignoredSources.0: Source patterns must stay within the repository root.",
    );
    expect(result.errors).toContain(
      "pages.0.outputPath: Output paths must stay within the repository root.",
    );
    expect(result.errors).toContain(
      "pages.0.sources.0: Source patterns must stay within the repository root.",
    );
  });

  it("rejects duplicate maintained outputs and protected raw-source targets", () => {
    const result = validateDyknowConfig({
      projectName: "DyKnow",
      mode: "connected",
      allowedSources: ["README.md", "docs/**"],
      ignoredSources: [],
      pages: [
        {
          id: "product-overview",
          title: "Product Overview",
          outputPath: "docs/sources/raw-copy.md",
          audience: "mixed",
          sources: ["README.md"],
          reviewRules: {
            approvalRequired: true,
          },
        },
        {
          id: "feature-map",
          title: "Feature Map",
          outputPath: "docs/sources/raw-copy.md",
          audience: "mixed",
          sources: ["docs/**"],
          reviewRules: {
            approvalRequired: true,
          },
        },
      ],
      approvalRequired: true,
      llmProvider: "local",
      publishTargets: [],
    });

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.errors).toContain(
      'pages.0.outputPath: Output paths cannot target protected paths such as "docs/sources/**" or ".git/**".',
    );
    expect(result.errors).toContain(
      "pages.1.outputPath: Output paths must be unique across maintained pages.",
    );
  });

  it("rejects overlapping dependency allow and deny rules", () => {
    const result = validateDyknowConfig({
      projectName: "DyKnow",
      mode: "connected",
      allowedSources: ["README.md", "docs/**"],
      ignoredSources: [],
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
      dependencyPolicy: {
        allow: ["zod"],
        deny: ["zod"],
      },
    });

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    expect(result.errors).toContain(
      'dependencyPolicy.deny.0: Dependency policy entries cannot be both allowed and denied for package "zod".',
    );
  });

  it("ships a checked-in starter dependency deny list for this repo", async () => {
    const configText = await readFile("dyknow.config.json", "utf8");
    const config = parseDyknowConfig(configText);

    expect(config.dependencyPolicy.allow).toContain("@dyknow/core");
    expect(config.dependencyPolicy.deny).toContain("left-pad");
  });
});
