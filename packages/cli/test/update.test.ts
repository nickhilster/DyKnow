import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_REPO_DIFF_OUTPUT_PATH,
  DEFAULT_UPDATE_OUTPUT_PATH,
  UpdateDraftBatchSchema,
} from "@dyknow/core";

import { runCli } from "../src/index.js";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.OPENAI_API_KEY;
const originalModel = process.env.DYKNOW_OPENAI_MODEL;

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.OPENAI_API_KEY = originalApiKey;
  process.env.DYKNOW_OPENAI_MODEL = originalModel;
});

describe("dyknow update", () => {
  it("drafts update proposals for affected pages", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-update-"));

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
    await writeFile(
      join(root, "docs", "product-overview.md"),
      "# Product Overview\n\nOld content.\n",
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
          allowedSources: ["README.md", "docs/**"],
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
              id: "product-overview",
              title: "Product Overview",
              outputPath: "docs/product-overview.md",
              audience: "mixed",
              sources: ["README.md"],
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
    await writeFile(
      join(root, DEFAULT_REPO_DIFF_OUTPUT_PATH),
      `${JSON.stringify(
        {
          comparedAt: "2026-05-23T18:00:00.000Z",
          rootPath: root,
          configPath: "dyknow.config.json",
          baseSnapshotPath: "docs/dyknow/.state/repo-map.json",
          outputPath: DEFAULT_REPO_DIFF_OUTPUT_PATH,
          previousScannedAt: "2026-05-23T17:00:00.000Z",
          currentScannedAt: "2026-05-23T17:30:00.000Z",
          addedFiles: [],
          changedFiles: [
            {
              path: "README.md",
              changes: ["line-count"],
              before: {
                path: "README.md",
                kind: "markdown",
                size: 10,
                lineCount: 1,
                signals: ["documentation"],
                dependencies: [],
              },
              after: {
                path: "README.md",
                kind: "markdown",
                size: 20,
                lineCount: 2,
                signals: ["documentation"],
                dependencies: [],
              },
            },
          ],
          removedFiles: [],
          addedWarnings: [],
          removedWarnings: [],
          affectedPages: [
            {
              pageId: "product-overview",
              outputPath: "docs/product-overview.md",
              matchedSourcePaths: ["README.md"],
              reasons: ["changed-file"],
            },
          ],
          summary: {
            addedFiles: 0,
            changedFiles: 1,
            removedFiles: 0,
            addedWarnings: 0,
            removedWarnings: 0,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const stdout: string[] = [];
    const stderr: string[] = [];
    const exitCode = await runCli(["update"], {
      cwd: root,
      stdout: (message) => {
        stdout.push(message);
      },
      stderr: (message) => {
        stderr.push(message);
      },
    });
    const updateText = await readFile(
      join(root, DEFAULT_UPDATE_OUTPUT_PATH),
      "utf8",
    );
    const updateBatch = UpdateDraftBatchSchema.parse(JSON.parse(updateText));

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout[0]).toContain(DEFAULT_UPDATE_OUTPUT_PATH);
    expect(updateBatch.summary).toEqual({
      affectedPages: 1,
      draftedProposals: 1,
    });
    expect(updateBatch.providerId).toBe("local");
    expect(updateBatch.drafts[0]?.proposal.pageId).toBe("product-overview");
    expect(updateBatch.drafts[0]?.proposal.sources).toEqual(["README.md"]);
    expect(updateBatch.drafts[0]?.proposal.reviewState).toBe("Needs review");
    expect(updateBatch.drafts[0]?.proposal.proposedText).toContain(
      "# Product Overview",
    );
    expect(updateBatch.drafts[0]?.proposal.proposedText).toContain(
      "## Affected sources",
    );
  });

  it("requires a prior repo diff snapshot", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-update-"));
    const stderr: string[] = [];

    await runCli(["init", "--project-name", "Fixture"], { cwd: root });

    const exitCode = await runCli(["update"], {
      cwd: root,
      stderr: (message) => {
        stderr.push(message);
      },
    });

    expect(exitCode).toBe(1);
    expect(stderr[0]).toContain("Run dyknow diff first");
  });

  it("rejects repo diff inputs that escape the workspace root", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-update-"));
    const outsideRoot = await mkdtemp(join(tmpdir(), "dyknow-update-outside-"));

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
    await writeFile(
      join(root, "docs", "product-overview.md"),
      "# Product Overview\n\nOld content.\n",
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
          allowedSources: ["README.md", "docs/**"],
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
              id: "product-overview",
              title: "Product Overview",
              outputPath: "docs/product-overview.md",
              audience: "mixed",
              sources: ["README.md"],
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
    await writeFile(
      join(outsideRoot, "repo-diff.json"),
      `${JSON.stringify(
        {
          comparedAt: "2026-05-23T18:00:00.000Z",
          rootPath: root,
          configPath: "dyknow.config.json",
          baseSnapshotPath: "docs/dyknow/.state/repo-map.json",
          outputPath: DEFAULT_REPO_DIFF_OUTPUT_PATH,
          previousScannedAt: "2026-05-23T17:00:00.000Z",
          currentScannedAt: "2026-05-23T17:30:00.000Z",
          addedFiles: [],
          changedFiles: [],
          removedFiles: [],
          addedWarnings: [],
          removedWarnings: [],
          affectedPages: [
            {
              pageId: "product-overview",
              outputPath: "docs/product-overview.md",
              matchedSourcePaths: ["README.md"],
              reasons: ["changed-file"],
            },
          ],
          summary: {
            addedFiles: 0,
            changedFiles: 0,
            removedFiles: 0,
            addedWarnings: 0,
            removedWarnings: 0,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const stderr: string[] = [];
    const exitCode = await runCli(
      ["update", "--diff", relative(root, join(outsideRoot, "repo-diff.json"))],
      {
        cwd: root,
        stderr: (message) => {
          stderr.push(message);
        },
      },
    );

    expect(exitCode).toBe(1);
    expect(stderr[0]).toContain("must stay within the workspace root");
  });

  it("uses the BYO provider in connected mode when OpenAI env vars are configured", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-update-"));

    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            usage: {
              input_tokens: 90,
              output_tokens: 30,
              total_tokens: 120,
            },
            output: [
              {
                content: [
                  {
                    text: JSON.stringify({
                      summary: "Connected summary",
                      why: "Connected why",
                      proposedText: "# Product Overview\n\nConnected draft.\n",
                      confidence: "medium",
                      risk: "low",
                    }),
                  },
                ],
              },
            ],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
    ) as typeof fetch;
    process.env.OPENAI_API_KEY = "test-key";
    process.env.DYKNOW_OPENAI_MODEL = "gpt-test";

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
    await writeFile(
      join(root, "docs", "product-overview.md"),
      "# Product Overview\n\nOld content.\n",
      "utf8",
    );
    await runCli(["init", "--project-name", "Fixture"], { cwd: root });
    await writeFile(
      join(root, "dyknow.config.json"),
      `${JSON.stringify(
        {
          $schema: "./dyknow.config.schema.json",
          projectName: "Fixture",
          mode: "connected",
          allowedSources: ["README.md", "docs/**"],
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
              id: "product-overview",
              title: "Product Overview",
              outputPath: "docs/product-overview.md",
              audience: "mixed",
              sources: ["README.md"],
              reviewRules: {
                approvalRequired: true,
              },
            },
          ],
          approvalRequired: true,
          llmProvider: "byo-key",
          publishTargets: ["github-pr"],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      join(root, DEFAULT_REPO_DIFF_OUTPUT_PATH),
      `${JSON.stringify(
        {
          comparedAt: "2026-05-23T18:00:00.000Z",
          rootPath: root,
          configPath: "dyknow.config.json",
          baseSnapshotPath: "docs/dyknow/.state/repo-map.json",
          outputPath: DEFAULT_REPO_DIFF_OUTPUT_PATH,
          previousScannedAt: "2026-05-23T17:00:00.000Z",
          currentScannedAt: "2026-05-23T17:30:00.000Z",
          addedFiles: [],
          changedFiles: [],
          removedFiles: [],
          addedWarnings: [],
          removedWarnings: [],
          affectedPages: [
            {
              pageId: "product-overview",
              outputPath: "docs/product-overview.md",
              matchedSourcePaths: ["README.md"],
              reasons: ["changed-file"],
            },
          ],
          summary: {
            addedFiles: 0,
            changedFiles: 1,
            removedFiles: 0,
            addedWarnings: 0,
            removedWarnings: 0,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const stdout: string[] = [];
    const stderr: string[] = [];
    const exitCode = await runCli(["update"], {
      cwd: root,
      stdout: (message) => {
        stdout.push(message);
      },
      stderr: (message) => {
        stderr.push(message);
      },
    });
    const updateText = await readFile(
      join(root, DEFAULT_UPDATE_OUTPUT_PATH),
      "utf8",
    );
    const updateBatch = UpdateDraftBatchSchema.parse(JSON.parse(updateText));

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout[0]).toContain(DEFAULT_UPDATE_OUTPUT_PATH);
    expect(updateBatch.providerId).toBe("byo-key");
    expect(updateBatch.drafts[0]?.proposal.summary).toBe("Connected summary");
    expect(updateBatch.drafts[0]?.proposal.proposedText).toContain(
      "Connected draft.",
    );
    expect(updateBatch.providerTelemetry.totalAttempts).toBe(1);
    expect(updateBatch.providerTelemetry.usage.totalTokens).toBe(120);
  });
});
