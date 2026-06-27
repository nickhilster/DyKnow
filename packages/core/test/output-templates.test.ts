import { describe, expect, it } from "vitest";

import {
  OUTPUT_TEMPLATE_REGISTRY,
  OutputTemplateTypeSchema,
  getOutputTemplate,
  listOutputTemplates,
  scaffoldPage,
} from "../src/index.js";

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const BASE_OPTIONS = {
  pageId: "test-page",
  title: "Test Page",
  purpose: "Verify output template scaffolding.",
  audience: "internal" as const,
  sources: ["README.md", "docs/test.md"],
  lastReviewed: "2026-05-24",
  confidence: "low" as const,
};

// ---------------------------------------------------------------------------
// Registry invariants
// ---------------------------------------------------------------------------

describe("output template registry", () => {
  it("contains all documented template types", () => {
    const expectedTypes = OutputTemplateTypeSchema.options;

    for (const type of expectedTypes) {
      expect(
        OUTPUT_TEMPLATE_REGISTRY.some((entry) => entry.type === type),
        `Expected a registered output template for type "${type}"`,
      ).toBe(true);
    }
  });

  it("has a non-empty description for every entry", () => {
    for (const entry of OUTPUT_TEMPLATE_REGISTRY) {
      expect(
        entry.description.trim().length,
        `Template "${entry.type}" must have a non-empty description`,
      ).toBeGreaterThan(0);
    }
  });

  it("listOutputTemplates returns one entry per registered type", () => {
    const listed = listOutputTemplates();

    expect(listed).toHaveLength(OUTPUT_TEMPLATE_REGISTRY.length);

    for (const { type } of listed) {
      expect(OutputTemplateTypeSchema.safeParse(type).success).toBe(true);
    }
  });

  it("getOutputTemplate returns undefined for an unregistered type", () => {
    expect(getOutputTemplate("not-a-real-type" as never)).toBeUndefined();
  });

  it("scaffoldPage throws for an unregistered type", () => {
    expect(() =>
      scaffoldPage("not-a-real-type" as never, BASE_OPTIONS),
    ).toThrow(/No output template registered/);
  });
});

// ---------------------------------------------------------------------------
// markdown-page
// ---------------------------------------------------------------------------

describe("markdown-page template", () => {
  it("produces valid YAML frontmatter", () => {
    const output = scaffoldPage("markdown-page", BASE_OPTIONS);

    expect(output).toContain("---");
    expect(output).toContain("title: Test Page");
    expect(output).toContain("purpose: Verify output template scaffolding.");
    expect(output).toContain("audience: internal");
    expect(output).toContain("  - README.md");
    expect(output).toContain("  - docs/test.md");
    expect(output).toContain("last_reviewed: 2026-05-24");
    expect(output).toContain("confidence: low");
  });

  it("includes the required structural sections", () => {
    const output = scaffoldPage("markdown-page", BASE_OPTIONS);

    expect(output).toContain("## Summary");
    expect(output).toContain("## Open questions");
    expect(output).toContain("## Cross-references");
  });

  it("contains dyknow:fill placeholder markers", () => {
    const output = scaffoldPage("markdown-page", BASE_OPTIONS);

    expect(output).toContain("<!-- dyknow:fill");
  });

  it("defaults lastReviewed to today when omitted", () => {
    const today = new Date().toISOString().slice(0, 10);
    const output = scaffoldPage("markdown-page", {
      ...BASE_OPTIONS,
      lastReviewed: undefined,
    });

    expect(output).toContain(`last_reviewed: ${today}`);
  });
});

// ---------------------------------------------------------------------------
// agents-md
// ---------------------------------------------------------------------------

describe("agents-md template", () => {
  it("forces audience to agent", () => {
    // The template hardcodes audience: agent regardless of input audience
    const output = scaffoldPage("agents-md", {
      ...BASE_OPTIONS,
      audience: "mixed",
    });

    expect(output).toContain("audience: agent");
  });

  it("includes the required AGENTS.md sections", () => {
    const output = scaffoldPage("agents-md", BASE_OPTIONS);

    expect(output).toContain("## Summary");
    expect(output).toContain("## Architecture overview");
    expect(output).toContain("## Development commands");
    expect(output).toContain("## Coding standards");
    expect(output).toContain("## Do-not-touch");
    expect(output).toContain("## Known constraints");
  });

  it("contains dyknow:fill placeholder markers in all sections", () => {
    const output = scaffoldPage("agents-md", BASE_OPTIONS);
    const fillCount = (output.match(/<!-- dyknow:fill/g) ?? []).length;

    expect(fillCount).toBeGreaterThanOrEqual(6);
  });
});

// ---------------------------------------------------------------------------
// claude-md
// ---------------------------------------------------------------------------

describe("claude-md template", () => {
  it("includes the title as a heading", () => {
    const output = scaffoldPage("claude-md", BASE_OPTIONS);

    expect(output).toContain("# Test Page — Wiki Maintainer Schema");
  });

  it("includes all seven required sections", () => {
    const output = scaffoldPage("claude-md", BASE_OPTIONS);

    expect(output).toContain("## 1. Three-layer model");
    expect(output).toContain("## 2. Page conventions");
    expect(output).toContain("## 3. Core operations");
    expect(output).toContain("## 4. Navigation files");
    expect(output).toContain("## 5. What not to do");
    expect(output).toContain("## 6. Confidence and risk");
    expect(output).toContain("## 7. Project-specific knowledge");
  });

  it("includes lastReviewed in the footer", () => {
    const output = scaffoldPage("claude-md", BASE_OPTIONS);

    expect(output).toContain("Last reviewed: 2026-05-24");
  });

  it("lists sources in the footer", () => {
    const output = scaffoldPage("claude-md", BASE_OPTIONS);

    expect(output).toContain("README.md");
    expect(output).toContain("docs/test.md");
  });
});

// ---------------------------------------------------------------------------
// json-knowledge-map
// ---------------------------------------------------------------------------

describe("json-knowledge-map template", () => {
  it("produces valid JSON", () => {
    const output = scaffoldPage("json-knowledge-map", BASE_OPTIONS);

    expect(() => JSON.parse(output)).not.toThrow();
  });

  it("includes all required top-level fields", () => {
    const output = scaffoldPage("json-knowledge-map", BASE_OPTIONS);
    const parsed = JSON.parse(output) as Record<string, unknown>;

    expect(parsed.pageId).toBe("test-page");
    expect(parsed.title).toBe("Test Page");
    expect(parsed.purpose).toBe("Verify output template scaffolding.");
    expect(parsed.audience).toBe("internal");
    expect(parsed.sources).toEqual(["README.md", "docs/test.md"]);
    expect(parsed.lastReviewed).toBe("2026-05-24");
    expect(parsed.confidence).toBe("low");
  });

  it("includes sections, openQuestions, and crossReferences arrays", () => {
    const output = scaffoldPage("json-knowledge-map", BASE_OPTIONS);
    const parsed = JSON.parse(output) as Record<string, unknown>;

    expect(Array.isArray(parsed.sections)).toBe(true);
    expect(Array.isArray(parsed.openQuestions)).toBe(true);
    expect(Array.isArray(parsed.crossReferences)).toBe(true);
  });

  it("includes dyknowMeta with templateType", () => {
    const output = scaffoldPage("json-knowledge-map", BASE_OPTIONS);
    const parsed = JSON.parse(output) as Record<string, unknown>;
    const meta = parsed.dyknowMeta as Record<string, unknown>;

    expect(meta.templateType).toBe("json-knowledge-map");
    expect(meta.templateVersion).toBe("1");
    expect(typeof meta.generatedAt).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// rag-source-pack
// ---------------------------------------------------------------------------

describe("rag-source-pack template", () => {
  it("produces valid JSONL (one JSON object per non-empty line)", () => {
    const output = scaffoldPage("rag-source-pack", BASE_OPTIONS);
    const lines = output.split("\n").filter((line) => line.trim().length > 0);

    expect(lines.length).toBeGreaterThan(0);

    for (const line of lines) {
      expect(
        () => JSON.parse(line),
        `Line is not valid JSON: ${line}`,
      ).not.toThrow();
    }
  });

  it("each chunk has chunkId, content, and attribution", () => {
    const output = scaffoldPage("rag-source-pack", BASE_OPTIONS);
    const lines = output.split("\n").filter((line) => line.trim().length > 0);

    for (const line of lines) {
      const chunk = JSON.parse(line) as Record<string, unknown>;

      expect(typeof chunk.chunkId).toBe("string");
      expect(typeof chunk.content).toBe("string");
      expect(chunk.attribution).toBeDefined();
    }
  });

  it("chunkIds are scoped to the pageId", () => {
    const output = scaffoldPage("rag-source-pack", BASE_OPTIONS);
    const lines = output.split("\n").filter((line) => line.trim().length > 0);

    for (const line of lines) {
      const chunk = JSON.parse(line) as { chunkId: string };

      expect(chunk.chunkId.startsWith("test-page:")).toBe(true);
    }
  });

  it("attribution carries full page metadata on every chunk", () => {
    const output = scaffoldPage("rag-source-pack", BASE_OPTIONS);
    const lines = output.split("\n").filter((line) => line.trim().length > 0);

    for (const line of lines) {
      const chunk = JSON.parse(line) as {
        attribution: Record<string, unknown>;
      };

      expect(chunk.attribution.pageId).toBe("test-page");
      expect(chunk.attribution.title).toBe("Test Page");
      expect(chunk.attribution.confidence).toBe("low");
      expect(Array.isArray(chunk.attribution.sources)).toBe(true);
    }
  });

  it("includes a summary chunk, at least one body chunk, and an open-questions chunk", () => {
    const output = scaffoldPage("rag-source-pack", BASE_OPTIONS);
    const chunkIds = output
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => (JSON.parse(line) as { chunkId: string }).chunkId);

    expect(chunkIds.some((id) => id.endsWith(":summary"))).toBe(true);
    expect(chunkIds.some((id) => id.includes(":body"))).toBe(true);
    expect(chunkIds.some((id) => id.endsWith(":open-questions"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cross-template invariants
// ---------------------------------------------------------------------------

describe("all output templates", () => {
  for (const { type } of OUTPUT_TEMPLATE_REGISTRY) {
    it(`${type}: renders without throwing for valid options`, () => {
      expect(() => scaffoldPage(type, BASE_OPTIONS)).not.toThrow();
    });

    it(`${type}: output is a non-empty string`, () => {
      const output = scaffoldPage(type, BASE_OPTIONS);

      expect(typeof output).toBe("string");
      expect(output.trim().length).toBeGreaterThan(0);
    });

    it(`${type}: validates options (rejects missing title)`, () => {
      expect(() =>
        scaffoldPage(type, { ...BASE_OPTIONS, title: "" }),
      ).toThrow();
    });

    it(`${type}: validates options (rejects empty sources)`, () => {
      expect(() =>
        scaffoldPage(type, { ...BASE_OPTIONS, sources: [] }),
      ).toThrow();
    });
  }
});
