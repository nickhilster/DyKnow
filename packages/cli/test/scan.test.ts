import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_REPO_MAP_OUTPUT_PATH, RepoMapSchema } from "@dyknow/core";

import { runCli } from "../src/index.js";

describe("dyknow scan", () => {
  it("scans the configured workspace and writes a repo map", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-scan-"));
    const secretName = ["to", "ken"].join("");
    const secretValue = ["ghp", "123456789012345678901234567890123456"].join(
      "_",
    );

    await mkdir(join(root, "docs"), { recursive: true });
    await mkdir(join(root, "packages", "app", "src", "routes"), {
      recursive: true,
    });

    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
    await writeFile(
      join(root, "package.json"),
      JSON.stringify(
        {
          name: "fixture",
          dependencies: {
            zod: "^3.24.4",
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      join(root, "packages", "app", "src", "routes", "users.ts"),
      `export const ${secretName} = "${secretValue}";\n`,
      "utf8",
    );

    await runCli(["init", "--project-name", "Fixture"], { cwd: root });

    const exitCode = await runCli(["scan"], { cwd: root });
    const repoMapText = await readFile(
      join(root, DEFAULT_REPO_MAP_OUTPUT_PATH),
      "utf8",
    );
    const repoMap = RepoMapSchema.parse(JSON.parse(repoMapText));

    expect(exitCode).toBe(0);
    expect(repoMap.files.some((file) => file.path === "README.md")).toBe(true);
    expect(
      repoMap.files.some((file) =>
        file.dependencies.some((dependency) => dependency.name === "zod"),
      ),
    ).toBe(true);
    expect(repoMap.warnings).toHaveLength(1);
    expect(repoMap.warnings[0]?.code).toBe("secret-pattern");
  });
});
