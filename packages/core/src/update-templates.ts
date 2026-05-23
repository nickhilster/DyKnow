import { z } from "zod";

import { type PageDefinition, PageDefinitionSchema } from "./contracts.js";

export const UpdatePromptTemplateSchema = z.object({
  pageId: PageDefinitionSchema.shape.id,
  systemPrompt: z.string().min(1),
  instructions: z.array(z.string().min(1)).min(1),
});

export type UpdatePromptTemplate = z.infer<typeof UpdatePromptTemplateSchema>;

const DEFAULT_UPDATE_PROMPT_TEMPLATES = [
  {
    pageId: "product-overview",
    systemPrompt:
      "You maintain the Product Overview page as a source-backed explanation of what DyKnow is, who it serves, and why it matters.",
    instructions: [
      "Keep the page focused on product truth, customer fit, and the distinction between DyKnow Cloud and DyKnow Local.",
      "Prefer concise narrative updates over changelog-style notes.",
      "Do not introduce pricing, legal, compliance, or security claims unless the sources clearly justify them.",
    ],
  },
  {
    pageId: "feature-map",
    systemPrompt:
      "You maintain the Feature Map page as the structured inventory of DyKnow capabilities and workflow status.",
    instructions: [
      "Keep commands and surfaces grouped clearly by product surface and workflow stage.",
      "Reflect implemented versus planned status accurately and avoid inventing features.",
      "Call out meaningful workflow or capability changes that affect how DyKnow is used.",
    ],
  },
  {
    pageId: "architecture",
    systemPrompt:
      "You maintain the Architecture page as the technical description of DyKnow Cloud, DyKnow Local, and their shared engine.",
    instructions: [
      "Describe which component owns the changed behavior and how it interacts with adjacent components.",
      "Keep trust boundaries, shared-versus-surface-specific logic, and source-backed constraints explicit.",
      "Avoid implementation claims that are not justified by the code or approved docs.",
    ],
  },
  {
    pageId: "setup-guide",
    systemPrompt:
      "You maintain the Setup Guide page as the operator-facing workflow for using DyKnow Local commands safely and correctly.",
    instructions: [
      "Keep the steps chronological and command-oriented.",
      "Mention status when a command is not fully implemented yet.",
      "Highlight prerequisite commands and expected artifacts when they matter to successful usage.",
    ],
  },
  {
    pageId: "agent-context",
    systemPrompt:
      "You maintain AGENTS.md as a compact, factual context file for coding agents working inside the repository.",
    instructions: [
      "Favor stable repo facts, implemented commands, and constraints over narrative prose.",
      "Keep the file tightly scoped to what an agent needs to work productively in the repo.",
      "Do not claim commands or behaviors are implemented unless the code and generated artifacts prove it.",
    ],
  },
] as const satisfies readonly UpdatePromptTemplate[];

export function listDefaultUpdatePromptTemplates(): UpdatePromptTemplate[] {
  return DEFAULT_UPDATE_PROMPT_TEMPLATES.map((template) =>
    UpdatePromptTemplateSchema.parse(template),
  );
}

export function getDefaultUpdatePromptTemplate(
  pageId: string,
): UpdatePromptTemplate | undefined {
  const template = DEFAULT_UPDATE_PROMPT_TEMPLATES.find(
    (candidate) => candidate.pageId === pageId,
  );

  return template ? UpdatePromptTemplateSchema.parse(template) : undefined;
}

export function getMissingDefaultUpdatePromptTemplates(
  pages: readonly PageDefinition[],
): string[] {
  return pages
    .filter((page) => !getDefaultUpdatePromptTemplate(page.id))
    .map((page) => page.id);
}
