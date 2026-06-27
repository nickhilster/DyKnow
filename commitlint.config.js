/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Allow longer subjects — DyKnow commit messages are often descriptive
    "header-max-length": [2, "always", 120],
    // Enforce the standard type list plus a few DyKnow-specific ones
    "type-enum": [
      2,
      "always",
      [
        // Standard conventional commit types
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
        // DyKnow-specific
        "wiki", // wiki page updates (docs/ changes maintained by DyKnow itself)
        "scan", // changes to scan / diff / snapshot artifacts
        "infra", // infrastructure / tooling not captured by build or ci
      ],
    ],
  },
};
