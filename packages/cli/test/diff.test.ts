import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_REPO_DIFF_OUTPUT_PATH, RepoMapDiffSchema } from "@dyknow/core";

import { runCli } from "../src/index.js";

describe("dyknow diff", () => {
  it("compares the current workspace against the saved repo map snapshot", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-diff-"));

    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
    await writeFile(join(root, "docs", "old.md"), "Old doc\n", "utf8");
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

    await runCli(["init", "--project-name", "Fixture"], { cwd: root });
    await writeFile(
      join(root, "dyknow.config.json"),
      `${JSON.stringify(
        {
          $schema: "./dyknow.config.schema.json",
          projectName: "Fixture",
          mode: "local-only",
          allowedSources: ["README.md", "docs/**", "package.json"],
          ignoredSources: [
            ".env",
            ".env.*",
            "secrets/**",
            "node_modules/**",
            "dist/**",
            "coverage/**",
            "logs/**",
          ],
          pages: [
            {
              id: "docs-page",
              title: "Docs Page",
              outputPath: "docs/docs-page.md",
              audience: "mixed",
              sources: ["docs/**"],
              reviewRules: {
                approvalRequired: true,
              },
            },
            {
              id: "package-page",
              title: "Package Page",
              outputPath: "docs/package-page.md",
              audience: "mixed",
              sources: ["package.json"],
              reviewRules: {
                approvalRequired: true,
              },
            },
          ],
          approvalRequired: true,
          llmProvider: "local",
          publishTargets: [],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await runCli(["scan"], { cwd: root });

    await rm(join(root, "docs", "old.md"));
    await writeFile(join(root, "docs", "new.md"), "New doc\n", "utf8");
    await writeFile(
      join(root, "package.json"),
      JSON.stringify(
        {
          name: "fixture",
          dependencies: {
            zod: "^3.25.0",
          },
          devDependencies: {
            vitest: "^3.2.4",
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const stdout: string[] = [];
    const stderr: string[] = [];
    const exitCode = await runCli(["diff"], {
      cwd: root,
      stdout: (message) => {
        stdout.push(message);
      },
      stderr: (message) => {
        stderr.push(message);
      },
    });
    const repoDiffText = await readFile(
      join(root, DEFAULT_REPO_DIFF_OUTPUT_PATH),
      "utf8",
    );
    const repoDiff = RepoMapDiffSchema.parse(JSON.parse(repoDiffText));

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout[0]).toContain(DEFAULT_REPO_DIFF_OUTPUT_PATH);
    expect(repoDiff.summary).toEqual({
      addedFiles: 1,
      changedFiles: 1,
      removedFiles: 1,
      addedWarnings: 0,
      removedWarnings: 0,
    });
    expect(repoDiff.affectedPages).toEqual([
      {
        pageId: "docs-page",
        outputPath: "docs/docs-page.md",
        matchedSourcePaths: ["docs/new.md", "docs/old.md"],
        reasons: ["added-file", "removed-file"],
      },
      {
        pageId: "package-page",
        outputPath: "docs/package-page.md",
        matchedSourcePaths: ["package.json"],
        reasons: ["changed-file"],
      },
    ]);
    expect(repoDiff.addedFiles[0]?.path).toBe("docs/new.md");
    expect(repoDiff.removedFiles[0]?.path).toBe("docs/old.md");
    expect(repoDiff.changedFiles[0]?.path).toBe("package.json");
    expect(repoDiff.changedFiles[0]?.changes).toContain("dependencies");
  });

  it("requires a prior repo map snapshot", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-diff-"));
    const stderr: string[] = [];

    await runCli(["init", "--project-name", "Fixture"], { cwd: root });

    const exitCode = await runCli(["diff"], {
      cwd: root,
      stderr: (message) => {
        stderr.push(message);
      },
    });

    expect(exitCode).toBe(1);
    expect(stderr[0]).toContain("Run dyknow scan first");
  });

  it("rejects snapshot paths that escape the workspace root", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-diff-"));
    const stderr: string[] = [];

    await runCli(["init", "--project-name", "Fixture"], { cwd: root });

    const exitCode = await runCli(["diff", "--snapshot", "../outside.json"], {
      cwd: root,
      stderr: (message) => {
        stderr.push(message);
      },
    });

    expect(exitCode).toBe(1);
    expect(stderr[0]).toContain(
      "Diff snapshot path must stay within the workspace root",
    );
  });

  it("rejects output paths that escape the workspace root", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-diff-"));
    const stderr: string[] = [];

    await runCli(["init", "--project-name", "Fixture"], { cwd: root });

    const exitCode = await runCli(["diff", "--output", "../outside.json"], {
      cwd: root,
      stderr: (message) => {
        stderr.push(message);
      },
    });

    expect(exitCode).toBe(1);
    expect(stderr[0]).toContain(
      "Diff output path must stay within the workspace root",
    );
  });
});
