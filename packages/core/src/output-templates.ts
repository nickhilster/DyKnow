/**
 * Output templates for DyKnow page scaffolding.
 *
 * These templates are used when `dyknow update` needs to create a page from
 * scratch (rather than updating an existing one). Each template type targets
 * a different consumer:
 *
 * - `markdown-page`   — DyKnow wiki page with canonical frontmatter + structure
 * - `agents-md`       — AGENTS.md coding-agent context file
 * - `claude-md`       — CLAUDE.md wiki-maintainer schema file
 * - `json-knowledge-map` — Structured JSON for programmatic consumption
 * - `rag-source-pack` — Chunked, attributed text for RAG / vector store ingestion
 *
 * All templates accept a `PageScaffoldOptions` argument and return a string.
 * Placeholder markers (`<!-- dyknow:fill ... -->`) indicate where an LLM or
 * human reviewer should supply content. The markers are intentional — they
 * keep the LLM fill-in scope explicit and prevent templates from being
 * committed as-is.
 *
 * Adding a new template type:
 * 1. Add it to `OutputTemplateType`.
 * 2. Implement a `render*Template` function.
 * 3. Add it to `OUTPUT_TEMPLATE_REGISTRY`.
 * 4. Add a test case in `packages/core/test/output-templates.test.ts`.
 */

import { z } from "zod";

import { AudienceSchema, ConfidenceLevelSchema } from "./contracts.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const OutputTemplateTypeSchema = z.enum([
  "markdown-page",
  "agents-md",
  "claude-md",
  "json-knowledge-map",
  "rag-source-pack",
]);

export type OutputTemplateType = z.infer<typeof OutputTemplateTypeSchema>;

export const PageScaffoldOptionsSchema = z.object({
  /** kebab-case page identifier */
  pageId: z.string().min(1),
  /** Human-readable title */
  title: z.string().min(1),
  /** One sentence explaining what this page exists to answer */
  purpose: z.string().min(1),
  /** Target audience */
  audience: AudienceSchema,
  /** Source paths that inform this page */
  sources: z.array(z.string().min(1)).min(1),
  /** ISO date string for last_reviewed (defaults to today) */
  lastReviewed: z.string().optional(),
  /** Initial confidence level (defaults to "low" for new pages) */
  confidence: ConfidenceLevelSchema.default("low"),
});

export type PageScaffoldOptions = z.infer<typeof PageScaffoldOptionsSchema>;

export const OutputTemplateSchema = z.object({
  type: OutputTemplateTypeSchema,
  description: z.string().min(1),
  render: z.function().args(PageScaffoldOptionsSchema).returns(z.string()),
});

export type OutputTemplate = z.infer<typeof OutputTemplateSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function yamlSources(sources: readonly string[]): string {
  return sources.map((s) => `  - ${s}`).join("\n");
}

// ---------------------------------------------------------------------------
// Template: markdown-page
// ---------------------------------------------------------------------------

/**
 * Canonical DyKnow wiki page with frontmatter, summary placeholder, body
 * structure, Open questions, and Cross-references sections.
 *
 * This is the default template for new pages under `docs/`.
 * It matches the structure required by CLAUDE.md section 2.
 */
function renderMarkdownPageTemplate(options: PageScaffoldOptions): string {
  const reviewed = options.lastReviewed ?? todayIso();

  return [
    "---",
    `title: ${options.title}`,
    `purpose: ${options.purpose}`,
    `audience: ${options.audience}`,
    "sources:",
    yamlSources(options.sources),
    `last_reviewed: ${reviewed}`,
    `confidence: ${options.confidence}`,
    "---",
    "",
    "## Summary",
    "",
    "<!-- dyknow:fill summary — one paragraph that lets a reader decide if they need the rest of this page -->",
    "",
    "## <!-- dyknow:fill first topic heading -->",
    "",
    "<!-- dyknow:fill body — organized by topic, not chronology; cite sources inline -->",
    "",
    "## Open questions",
    "",
    "<!-- dyknow:fill open questions — list any claims that are uncertain or require human verification -->",
    "",
    "## Cross-references",
    "",
    "<!-- dyknow:fill cross-references — link related pages using [[page-name]] or markdown links -->",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Template: agents-md
// ---------------------------------------------------------------------------

/**
 * AGENTS.md coding-agent context file.
 *
 * Used when DyKnow bootstraps a new repo's agent context file from scratch.
 * The structure mirrors the DyKnow repo's own AGENTS.md.
 */
function renderAgentsMdTemplate(options: PageScaffoldOptions): string {
  const reviewed = options.lastReviewed ?? todayIso();

  return [
    "---",
    `title: ${options.title}`,
    `purpose: ${options.purpose}`,
    "audience: agent",
    "sources:",
    yamlSources(options.sources),
    `last_reviewed: ${reviewed}`,
    `confidence: ${options.confidence}`,
    "---",
    "",
    "## Summary",
    "",
    "<!-- dyknow:fill summary — one paragraph describing the repo, its purpose, and its current state for a coding agent -->",
    "",
    "## Architecture overview",
    "",
    "```",
    "<!-- dyknow:fill file tree — key directories and files a coding agent needs to know about -->",
    "```",
    "",
    "## Development commands",
    "",
    "<!-- dyknow:fill commands — install, test, build, lint, and any project-specific run commands -->",
    "",
    "## Coding standards",
    "",
    "<!-- dyknow:fill standards — language, module resolution, formatter, linter, test runner, key conventions -->",
    "",
    "## Do-not-touch",
    "",
    "<!-- dyknow:fill do-not-touch — files or directories that must not be modified by the agent -->",
    "",
    "## Known constraints",
    "",
    "<!-- dyknow:fill constraints — security, data, compliance, or design constraints the agent must respect -->",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Template: claude-md
// ---------------------------------------------------------------------------

/**
 * CLAUDE.md wiki-maintainer schema file.
 *
 * Used when DyKnow bootstraps a new repo's wiki maintainer schema.
 * Scaffolds the three-layer model and core operations sections.
 */
function renderClaudeMdTemplate(options: PageScaffoldOptions): string {
  const reviewed = options.lastReviewed ?? todayIso();

  return [
    `# ${options.title} — Wiki Maintainer Schema`,
    "",
    "<!-- dyknow:fill preamble — one paragraph describing this file's role and the wiki model it defines -->",
    "",
    "---",
    "",
    "## 1. Three-layer model",
    "",
    "| Layer | Location | Mutability | Maintained by |",
    "|---|---|---|---|",
    "| Raw sources | <!-- dyknow:fill path --> | Immutable | Humans only |",
    "| Wiki | <!-- dyknow:fill path --> | Mutable, source-backed | LLM (you), reviewed by humans |",
    "| Schema | <!-- dyknow:fill path --> | Stable, evolves rarely | Humans, with LLM proposals |",
    "",
    "## 2. Page conventions",
    "",
    "<!-- dyknow:fill frontmatter format and required page sections -->",
    "",
    "## 3. Core operations",
    "",
    "### Ingest",
    "<!-- dyknow:fill ingest steps -->",
    "",
    "### Query",
    "<!-- dyknow:fill query steps -->",
    "",
    "### Lint",
    "<!-- dyknow:fill lint checks -->",
    "",
    "## 4. Navigation files",
    "",
    "<!-- dyknow:fill index and log conventions -->",
    "",
    "## 5. What not to do",
    "",
    "<!-- dyknow:fill guardrails -->",
    "",
    "## 6. Confidence and risk",
    "",
    "<!-- dyknow:fill how confidence and risk levels are used -->",
    "",
    "## 7. Project-specific knowledge",
    "",
    "<!-- dyknow:fill project-specific facts that affect wiki maintenance -->",
    "",
    "---",
    `_Last reviewed: ${reviewed} | Sources: ${options.sources.join(", ")}_`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Template: json-knowledge-map
// ---------------------------------------------------------------------------

/**
 * JSON knowledge map — structured representation for programmatic consumption.
 *
 * Used by DyKnow Cloud connectors, CI pipelines, and any system that needs
 * to consume page metadata without parsing Markdown frontmatter.
 */
function renderJsonKnowledgeMapTemplate(options: PageScaffoldOptions): string {
  const reviewed = options.lastReviewed ?? todayIso();

  const map = {
    $schema: "https://dyknow.dev/schemas/knowledge-map/v1.json",
    pageId: options.pageId,
    title: options.title,
    purpose: options.purpose,
    audience: options.audience,
    sources: options.sources,
    lastReviewed: reviewed,
    confidence: options.confidence,
    sections: [
      {
        id: "summary",
        heading: "Summary",
        content: "<!-- dyknow:fill -->",
      },
    ],
    openQuestions: ["<!-- dyknow:fill -->"],
    crossReferences: [],
    dyknowMeta: {
      templateType: "json-knowledge-map",
      templateVersion: "1",
      generatedAt: new Date().toISOString(),
    },
  };

  return JSON.stringify(map, null, 2);
}

// ---------------------------------------------------------------------------
// Template: rag-source-pack
// ---------------------------------------------------------------------------

/**
 * RAG-ready source pack — chunked, attributed format for vector store ingestion.
 *
 * Each chunk is a self-contained piece of content that can be embedded
 * independently. Chunks carry full attribution so retrieval results can be
 * traced back to their source page and section.
 *
 * Format: JSONL (one JSON object per line). Each object is a `RagChunk`.
 */
function renderRagSourcePackTemplate(options: PageScaffoldOptions): string {
  const reviewed = options.lastReviewed ?? todayIso();

  const baseAttribution = {
    pageId: options.pageId,
    title: options.title,
    audience: options.audience,
    sources: options.sources,
    lastReviewed: reviewed,
    confidence: options.confidence,
  };

  const chunks = [
    {
      chunkId: `${options.pageId}:summary`,
      content:
        "<!-- dyknow:fill summary chunk — one paragraph, self-contained -->",
      attribution: { ...baseAttribution, section: "summary" },
    },
    {
      chunkId: `${options.pageId}:body-1`,
      content:
        "<!-- dyknow:fill first body chunk — one topic, self-contained -->",
      attribution: { ...baseAttribution, section: "body-1" },
    },
    {
      chunkId: `${options.pageId}:open-questions`,
      content: "<!-- dyknow:fill open questions chunk -->",
      attribution: { ...baseAttribution, section: "open-questions" },
    },
  ];

  return chunks.map((chunk) => JSON.stringify(chunk)).join("\n");
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const OUTPUT_TEMPLATE_REGISTRY: readonly {
  type: OutputTemplateType;
  description: string;
  render: (options: PageScaffoldOptions) => string;
}[] = [
  {
    type: "markdown-page",
    description:
      "Canonical DyKnow wiki page with frontmatter, summary, topic body, Open questions, and Cross-references. Default for new pages under docs/.",
    render: renderMarkdownPageTemplate,
  },
  {
    type: "agents-md",
    description:
      "AGENTS.md coding-agent context file. Scaffolds summary, architecture overview, dev commands, coding standards, do-not-touch, and constraints.",
    render: renderAgentsMdTemplate,
  },
  {
    type: "claude-md",
    description:
      "CLAUDE.md wiki-maintainer schema. Scaffolds the three-layer model, page conventions, core operations, and project-specific knowledge.",
    render: renderClaudeMdTemplate,
  },
  {
    type: "json-knowledge-map",
    description:
      "JSON knowledge map for programmatic consumption. Includes page metadata, sections, open questions, cross-references, and dyknowMeta.",
    render: renderJsonKnowledgeMapTemplate,
  },
  {
    type: "rag-source-pack",
    description:
      "JSONL RAG-ready source pack with chunked, attributed content for vector store ingestion. Each chunk is self-contained with full attribution.",
    render: renderRagSourcePackTemplate,
  },
] as const;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Retrieve a single output template by type. Returns `undefined` if the type
 * is not registered (which should not happen for valid `OutputTemplateType`
 * values, but is possible with raw string input).
 */
export function getOutputTemplate(
  type: OutputTemplateType,
): (typeof OUTPUT_TEMPLATE_REGISTRY)[number] | undefined {
  return OUTPUT_TEMPLATE_REGISTRY.find((entry) => entry.type === type);
}

/**
 * Scaffold a page using the specified output template type.
 * Validates options through `PageScaffoldOptionsSchema` before rendering.
 *
 * @throws if `type` is not registered or `options` fail schema validation.
 */
export function scaffoldPage(
  type: OutputTemplateType,
  options: PageScaffoldOptions,
): string {
  const template = getOutputTemplate(type);

  if (!template) {
    throw new Error(
      `No output template registered for type "${type}". Valid types: ${OUTPUT_TEMPLATE_REGISTRY.map((t) => t.type).join(", ")}.`,
    );
  }

  const validatedOptions = PageScaffoldOptionsSchema.parse(options);

  return template.render(validatedOptions);
}

/**
 * List all registered output template types with their descriptions.
 */
export function listOutputTemplates(): {
  type: OutputTemplateType;
  description: string;
}[] {
  return OUTPUT_TEMPLATE_REGISTRY.map(({ type, description }) => ({
    type,
    description,
  }));
}
