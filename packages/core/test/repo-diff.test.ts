import { describe, expect, it } from "vitest";

import { RepoMapDiffSchema, compareRepoMaps } from "../src/index.js";

describe("repo diff", () => {
  it("computes added, removed, and changed file summaries", () => {
    const previous = {
      scannedAt: "2026-05-23T12:00:00.000Z",
      rootPath: "C:/DEV/DyKnow",
      configPath: "dyknow.config.json",
      outputPath: "docs/dyknow/.state/repo-map.json",
      files: [
        {
          path: "README.md",
          kind: "markdown",
          size: 128,
          lineCount: 8,
          signals: ["documentation"],
          dependencies: [],
        },
        {
          path: "package.json",
          kind: "json",
          size: 96,
          lineCount: 6,
          signals: ["config", "package-manifest"],
          dependencies: [
            {
              name: "zod",
              section: "dependencies",
              version: "^3.24.4",
            },
          ],
        },
        {
          path: "docs/old.md",
          kind: "markdown",
          size: 32,
          lineCount: 2,
          signals: ["documentation"],
          dependencies: [],
        },
      ],
      warnings: [],
    } as const;

    const current = {
      scannedAt: "2026-05-23T12:05:00.000Z",
      rootPath: "C:/DEV/DyKnow",
      configPath: "dyknow.config.json",
      outputPath: "docs/dyknow/.state/repo-map.json",
      files: [
        {
          path: "README.md",
          kind: "markdown",
          size: 128,
          lineCount: 8,
          signals: ["documentation"],
          dependencies: [],
        },
        {
          path: "package.json",
          kind: "json",
          size: 120,
          lineCount: 8,
          signals: ["config", "package-manifest"],
          dependencies: [
            {
              name: "vitest",
              section: "devDependencies",
              version: "^2.1.1",
            },
            {
              name: "zod",
              section: "dependencies",
              version: "^3.25.0",
            },
          ],
        },
        {
          path: "docs/new.md",
          kind: "markdown",
          size: 40,
          lineCount: 3,
          signals: ["documentation"],
          dependencies: [],
        },
      ],
      warnings: [
        {
          code: "secret-pattern",
          path: "packages/app/src/routes/admin.ts",
          message: "Potential sensitive content detected by api-token.",
        },
      ],
    } as const;

    const diff = compareRepoMaps(previous, current);
    const parsed = RepoMapDiffSchema.parse(diff);

    expect(parsed.summary).toEqual({
      addedFiles: 1,
      changedFiles: 1,
      removedFiles: 1,
      addedWarnings: 1,
      removedWarnings: 0,
    });
    expect(parsed.addedFiles[0]?.path).toBe("docs/new.md");
    expect(parsed.removedFiles[0]?.path).toBe("docs/old.md");
    expect(parsed.changedFiles[0]?.path).toBe("package.json");
    expect(parsed.changedFiles[0]?.changes).toContain("dependencies");
    expect(parsed.addedWarnings[0]?.code).toBe("secret-pattern");
  });
});
