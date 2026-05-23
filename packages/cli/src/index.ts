import { DEFAULT_IGNORED_SOURCE_PATTERNS } from "@dyknow/core";

export const PLANNED_COMMANDS = [
  "dyknow init",
  "dyknow scan",
  "dyknow diff",
  "dyknow update",
  "dyknow review",
  "dyknow commit",
  "dyknow pr",
] as const;

export function formatBootstrapStatus(): string {
  const lines = [
    "DyKnow Local bootstrap workspace",
    "",
    "Implemented in this slice:",
    "- npm workspaces with TypeScript project references",
    "- Shared engine contract schemas",
    "- DyKnow config validation with local-only safeguards",
    "",
    "Default ignored source patterns:",
    ...DEFAULT_IGNORED_SOURCE_PATTERNS.map((pattern) => `- ${pattern}`),
    "",
    "Planned commands:",
    ...PLANNED_COMMANDS.map((command) => `- ${command}`),
  ];

  return lines.join("\n");
}
