import { describe, expect, it } from "vitest";

import { RepoMapSchema } from "../src/index.js";

describe("repo map schema", () => {
  it("parses a minimal repo map payload", () => {
    const repoMap = RepoMapSchema.parse({
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
      ],
      warnings: [],
    });

    expect(repoMap.files[0]?.path).toBe("README.md");
  });
});
