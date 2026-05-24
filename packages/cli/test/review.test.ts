import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  AuditLogEntrySchema,
  DEFAULT_UPDATE_OUTPUT_PATH,
  UpdateDraftBatchSchema,
} from "@dyknow/core";

import { runCli } from "../src/index.js";

const originalEditorCommand = process.env.DYKNOW_EDITOR_COMMAND;

async function writeNodeEditorScript(tools: string) {
  const scriptPath = join(tools, "dyknow-editor.mjs");

  await writeFile(
    scriptPath,
    [
      'import { writeFileSync } from "node:fs";',
      'writeFileSync(process.argv[2], "Edited from node editor", "utf8");',
    ].join("\n"),
    "utf8",
  );

  return scriptPath;
}

afterEach(() => {
  if (originalEditorCommand === undefined) {
    process.env.DYKNOW_EDITOR_COMMAND = undefined;
  } else {
    process.env.DYKNOW_EDITOR_COMMAND = originalEditorCommand;
  }
});

describe("dyknow review", () => {
  it("persists an approval decision for a targeted page", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-review-"));

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(
      join(root, DEFAULT_UPDATE_OUTPUT_PATH),
      `${JSON.stringify(
        {
          draftedAt: "2026-05-23T18:00:00.000Z",
          rootPath: root,
          configPath: "dyknow.config.json",
          repoDiffPath: "docs/dyknow/.state/repo-diff.json",
          outputPath: DEFAULT_UPDATE_OUTPUT_PATH,
          providerId: "local",
          drafts: [
            {
              affectedPage: {
                pageId: "product-overview",
                outputPath: "docs/product-overview.md",
                matchedSourcePaths: ["README.md"],
                reasons: ["changed-file"],
              },
              proposal: {
                pageId: "product-overview",
                summary:
                  "Review Product Overview for 1 changed source path(s).",
                why: "Product Overview is affected because DyKnow detected changed file across 1 configured source path(s).",
                sources: ["README.md"],
                proposedText: "Draft text",
                confidence: "low",
                risk: "medium",
                reviewState: "Needs review",
                requiresHumanReview: true,
              },
            },
          ],
          summary: {
            affectedPages: 1,
            draftedProposals: 1,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const stdout: string[] = [];
    const stderr: string[] = [];
    const exitCode = await runCli(
      ["review", "--approve", "--page", "product-overview"],
      {
        cwd: root,
        stdout: (message) => {
          stdout.push(message);
        },
        stderr: (message) => {
          stderr.push(message);
        },
      },
    );
    const reviewText = await readFile(
      join(root, DEFAULT_UPDATE_OUTPUT_PATH),
      "utf8",
    );
    const auditText = await readFile(
      join(root, "docs", "dyknow", ".state", "audit-log.jsonl"),
      "utf8",
    );
    const reviewBatch = UpdateDraftBatchSchema.parse(JSON.parse(reviewText));
    const auditEntries = auditText
      .trim()
      .split(/\r?\n/)
      .map((line) => AuditLogEntrySchema.parse(JSON.parse(line)));

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout[0]).toContain("Marked 1 update proposal(s) as Approved");
    expect(reviewBatch.drafts[0]?.proposal.reviewState).toBe("Approved");
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0]?.action).toBe("review:approve");
    expect(auditEntries[0]?.outputsAffected).toContain(
      "docs/product-overview.md",
    );
    expect(auditEntries[0]?.outputsAffected).toContain(
      DEFAULT_UPDATE_OUTPUT_PATH,
    );
  });

  it("persists an edited proposal for a targeted page", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-review-"));

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(
      join(root, DEFAULT_UPDATE_OUTPUT_PATH),
      `${JSON.stringify(
        {
          draftedAt: "2026-05-23T18:00:00.000Z",
          rootPath: root,
          configPath: "dyknow.config.json",
          repoDiffPath: "docs/dyknow/.state/repo-diff.json",
          outputPath: DEFAULT_UPDATE_OUTPUT_PATH,
          providerId: "local",
          drafts: [
            {
              affectedPage: {
                pageId: "product-overview",
                outputPath: "docs/product-overview.md",
                matchedSourcePaths: ["README.md"],
                reasons: ["changed-file"],
              },
              proposal: {
                pageId: "product-overview",
                summary:
                  "Review Product Overview for 1 changed source path(s).",
                why: "Product Overview is affected because DyKnow detected changed file across 1 configured source path(s).",
                sources: ["README.md"],
                proposedText: "Draft text",
                confidence: "low",
                risk: "medium",
                reviewState: "Needs review",
                requiresHumanReview: true,
              },
            },
          ],
          summary: {
            affectedPages: 1,
            draftedProposals: 1,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const stdout: string[] = [];
    const stderr: string[] = [];
    const exitCode = await runCli(
      [
        "review",
        "--edit",
        "--page",
        "product-overview",
        "--text",
        "Edited draft text",
      ],
      {
        cwd: root,
        stdout: (message) => {
          stdout.push(message);
        },
        stderr: (message) => {
          stderr.push(message);
        },
      },
    );
    const reviewText = await readFile(
      join(root, DEFAULT_UPDATE_OUTPUT_PATH),
      "utf8",
    );
    const reviewBatch = UpdateDraftBatchSchema.parse(JSON.parse(reviewText));

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout[0]).toContain("Marked 1 update proposal(s) as Edited");
    expect(reviewBatch.drafts[0]?.proposal.reviewState).toBe("Edited");
    expect(reviewBatch.drafts[0]?.proposal.proposedText).toBe(
      "Edited draft text",
    );
  });

  it("supports editor commands with fixed arguments without invoking a shell", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-review-"));
    const tools = await mkdtemp(join(tmpdir(), "dyknow-review-tools-"));

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(
      join(root, DEFAULT_UPDATE_OUTPUT_PATH),
      `${JSON.stringify(
        {
          draftedAt: "2026-05-23T18:00:00.000Z",
          rootPath: root,
          configPath: "dyknow.config.json",
          repoDiffPath: "docs/dyknow/.state/repo-diff.json",
          outputPath: DEFAULT_UPDATE_OUTPUT_PATH,
          providerId: "local",
          drafts: [
            {
              affectedPage: {
                pageId: "product-overview",
                outputPath: "docs/product-overview.md",
                matchedSourcePaths: ["README.md"],
                reasons: ["changed-file"],
              },
              proposal: {
                pageId: "product-overview",
                summary:
                  "Review Product Overview for 1 changed source path(s).",
                why: "Product Overview is affected because DyKnow detected changed file across 1 configured source path(s).",
                sources: ["README.md"],
                proposedText: "Draft text",
                confidence: "low",
                risk: "medium",
                reviewState: "Needs review",
                requiresHumanReview: true,
              },
            },
          ],
          summary: {
            affectedPages: 1,
            draftedProposals: 1,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    process.env.DYKNOW_EDITOR_COMMAND = `node ${await writeNodeEditorScript(tools)}`;

    const stdout: string[] = [];
    const stderr: string[] = [];
    const exitCode = await runCli(
      ["review", "--edit", "--page", "product-overview", "--editor"],
      {
        cwd: root,
        stdout: (message) => {
          stdout.push(message);
        },
        stderr: (message) => {
          stderr.push(message);
        },
      },
    );
    const reviewText = await readFile(
      join(root, DEFAULT_UPDATE_OUTPUT_PATH),
      "utf8",
    );
    const reviewBatch = UpdateDraftBatchSchema.parse(JSON.parse(reviewText));

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout[0]).toContain("Marked 1 update proposal(s) as Edited");
    expect(reviewBatch.drafts[0]?.proposal.reviewState).toBe("Edited");
    expect(reviewBatch.drafts[0]?.proposal.proposedText).toBe(
      "Edited from node editor",
    );
  }, 15000);

  it("rejects editor commands that contain shell control operators", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-review-"));

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(
      join(root, DEFAULT_UPDATE_OUTPUT_PATH),
      `${JSON.stringify(
        {
          draftedAt: "2026-05-23T18:00:00.000Z",
          rootPath: root,
          configPath: "dyknow.config.json",
          repoDiffPath: "docs/dyknow/.state/repo-diff.json",
          outputPath: DEFAULT_UPDATE_OUTPUT_PATH,
          providerId: "local",
          drafts: [
            {
              affectedPage: {
                pageId: "product-overview",
                outputPath: "docs/product-overview.md",
                matchedSourcePaths: ["README.md"],
                reasons: ["changed-file"],
              },
              proposal: {
                pageId: "product-overview",
                summary:
                  "Review Product Overview for 1 changed source path(s).",
                why: "Product Overview is affected because DyKnow detected changed file across 1 configured source path(s).",
                sources: ["README.md"],
                proposedText: "Draft text",
                confidence: "low",
                risk: "medium",
                reviewState: "Needs review",
                requiresHumanReview: true,
              },
            },
          ],
          summary: {
            affectedPages: 1,
            draftedProposals: 1,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    process.env.DYKNOW_EDITOR_COMMAND = "node fake-editor.mjs && whoami";

    const stderr: string[] = [];
    const exitCode = await runCli(
      ["review", "--edit", "--page", "product-overview", "--editor"],
      {
        cwd: root,
        stderr: (message) => {
          stderr.push(message);
        },
      },
    );

    expect(exitCode).toBe(1);
    expect(stderr[0]).toContain("shell control operators");
  });

  it("rejects editor .cmd wrappers on Windows", async () => {
    if (process.platform !== "win32") {
      return;
    }

    const root = await mkdtemp(join(tmpdir(), "dyknow-review-"));
    const tools = await mkdtemp(join(tmpdir(), "dyknow-review-tools-"));
    const originalPath = process.env.PATH ?? "";

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(
      join(root, DEFAULT_UPDATE_OUTPUT_PATH),
      `${JSON.stringify(
        {
          draftedAt: "2026-05-23T18:00:00.000Z",
          rootPath: root,
          configPath: "dyknow.config.json",
          repoDiffPath: "docs/dyknow/.state/repo-diff.json",
          outputPath: DEFAULT_UPDATE_OUTPUT_PATH,
          providerId: "local",
          drafts: [
            {
              affectedPage: {
                pageId: "product-overview",
                outputPath: "docs/product-overview.md",
                matchedSourcePaths: ["README.md"],
                reasons: ["changed-file"],
              },
              proposal: {
                pageId: "product-overview",
                summary:
                  "Review Product Overview for 1 changed source path(s).",
                why: "Product Overview is affected because DyKnow detected changed file across 1 configured source path(s).",
                sources: ["README.md"],
                proposedText: "Draft text",
                confidence: "low",
                risk: "medium",
                reviewState: "Needs review",
                requiresHumanReview: true,
              },
            },
          ],
          summary: {
            affectedPages: 1,
            draftedProposals: 1,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      join(tools, "fake-editor.cmd"),
      ["@echo off", "exit /b 0"].join("\r\n"),
      "utf8",
    );

    process.env.PATH = `${tools};${originalPath}`;
    process.env.DYKNOW_EDITOR_COMMAND = "fake-editor";

    try {
      const stderr: string[] = [];
      const exitCode = await runCli(
        ["review", "--edit", "--page", "product-overview", "--editor"],
        {
          cwd: root,
          stderr: (message) => {
            stderr.push(message);
          },
        },
      );

      expect(exitCode).toBe(1);
      expect(stderr[0]).toContain("Review editor command");
      expect(stderr[0]).toContain("native executable");
      expect(stderr[0]).toContain(".cmd or .bat wrapper");
    } finally {
      process.env.PATH = originalPath;
    }
  });

  it("rejects editor .bat wrappers on Windows", async () => {
    if (process.platform !== "win32") {
      return;
    }

    const root = await mkdtemp(join(tmpdir(), "dyknow-review-"));
    const tools = await mkdtemp(join(tmpdir(), "dyknow-review-tools-"));
    const originalPath = process.env.PATH ?? "";

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(
      join(root, DEFAULT_UPDATE_OUTPUT_PATH),
      `${JSON.stringify(
        {
          draftedAt: "2026-05-23T18:00:00.000Z",
          rootPath: root,
          configPath: "dyknow.config.json",
          repoDiffPath: "docs/dyknow/.state/repo-diff.json",
          outputPath: DEFAULT_UPDATE_OUTPUT_PATH,
          providerId: "local",
          drafts: [
            {
              affectedPage: {
                pageId: "product-overview",
                outputPath: "docs/product-overview.md",
                matchedSourcePaths: ["README.md"],
                reasons: ["changed-file"],
              },
              proposal: {
                pageId: "product-overview",
                summary:
                  "Review Product Overview for 1 changed source path(s).",
                why: "Product Overview is affected because DyKnow detected changed file across 1 configured source path(s).",
                sources: ["README.md"],
                proposedText: "Draft text",
                confidence: "low",
                risk: "medium",
                reviewState: "Needs review",
                requiresHumanReview: true,
              },
            },
          ],
          summary: {
            affectedPages: 1,
            draftedProposals: 1,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      join(tools, "fake-editor-bat.bat"),
      ["@echo off", "exit /b 0"].join("\r\n"),
      "utf8",
    );

    process.env.PATH = `${tools};${originalPath}`;
    process.env.DYKNOW_EDITOR_COMMAND = "fake-editor-bat";

    try {
      const stderr: string[] = [];
      const exitCode = await runCli(
        ["review", "--edit", "--page", "product-overview", "--editor"],
        {
          cwd: root,
          stderr: (message) => {
            stderr.push(message);
          },
        },
      );

      expect(exitCode).toBe(1);
      expect(stderr[0]).toContain("Review editor command");
      expect(stderr[0]).toContain("native executable");
      expect(stderr[0]).toContain(".cmd or .bat wrapper");
    } finally {
      process.env.PATH = originalPath;
    }
  });

  it("skips a targeted proposal without mutating the snapshot", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-review-"));

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(
      join(root, DEFAULT_UPDATE_OUTPUT_PATH),
      `${JSON.stringify(
        {
          draftedAt: "2026-05-23T18:00:00.000Z",
          rootPath: root,
          configPath: "dyknow.config.json",
          repoDiffPath: "docs/dyknow/.state/repo-diff.json",
          outputPath: DEFAULT_UPDATE_OUTPUT_PATH,
          providerId: "local",
          drafts: [
            {
              affectedPage: {
                pageId: "product-overview",
                outputPath: "docs/product-overview.md",
                matchedSourcePaths: ["README.md"],
                reasons: ["changed-file"],
              },
              proposal: {
                pageId: "product-overview",
                summary:
                  "Review Product Overview for 1 changed source path(s).",
                why: "Product Overview is affected because DyKnow detected changed file across 1 configured source path(s).",
                sources: ["README.md"],
                proposedText: "Draft text",
                confidence: "low",
                risk: "medium",
                reviewState: "Needs review",
                requiresHumanReview: true,
              },
            },
          ],
          summary: {
            affectedPages: 1,
            draftedProposals: 1,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const originalText = await readFile(
      join(root, DEFAULT_UPDATE_OUTPUT_PATH),
      "utf8",
    );
    const stdout: string[] = [];
    const stderr: string[] = [];
    const exitCode = await runCli(
      ["review", "--skip", "--page", "product-overview"],
      {
        cwd: root,
        stdout: (message) => {
          stdout.push(message);
        },
        stderr: (message) => {
          stderr.push(message);
        },
      },
    );
    const reviewText = await readFile(
      join(root, DEFAULT_UPDATE_OUTPUT_PATH),
      "utf8",
    );
    const reviewBatch = UpdateDraftBatchSchema.parse(JSON.parse(reviewText));

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout[0]).toContain("Skipped 1 update proposal(s)");
    expect(reviewText).toBe(originalText);
    expect(reviewBatch.drafts[0]?.proposal.reviewState).toBe("Needs review");
  });

  it("regenerates a targeted proposal from the saved repo diff without mutating other drafts", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-review-"));

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(
      join(root, "README.md"),
      "# Fixture\n\nUpdated content.\n",
      "utf8",
    );
    await writeFile(
      join(root, "docs", "product-overview.md"),
      "# Product Overview\n\nExisting page text.\n",
      "utf8",
    );
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
            {
              id: "agent-context",
              title: "AI Agent Context",
              outputPath: "AGENTS.md",
              audience: "agent",
              sources: ["docs/**"],
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
      join(root, "docs", "dyknow", ".state", "repo-diff.json"),
      `${JSON.stringify(
        {
          comparedAt: "2026-05-23T18:00:00.000Z",
          rootPath: root,
          configPath: "dyknow.config.json",
          baseSnapshotPath: "docs/dyknow/.state/repo-map.json",
          outputPath: "docs/dyknow/.state/repo-diff.json",
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
    await writeFile(
      join(root, DEFAULT_UPDATE_OUTPUT_PATH),
      `${JSON.stringify(
        {
          draftedAt: "2026-05-23T18:00:00.000Z",
          rootPath: root,
          configPath: "dyknow.config.json",
          repoDiffPath: "docs/dyknow/.state/repo-diff.json",
          outputPath: DEFAULT_UPDATE_OUTPUT_PATH,
          providerId: "local",
          drafts: [
            {
              affectedPage: {
                pageId: "product-overview",
                outputPath: "docs/product-overview.md",
                matchedSourcePaths: ["README.md"],
                reasons: ["changed-file"],
              },
              proposal: {
                pageId: "product-overview",
                summary:
                  "Review Product Overview for 1 changed source path(s).",
                why: "Product Overview is affected because DyKnow detected changed file across 1 configured source path(s).",
                sources: ["README.md"],
                proposedText: "Old draft text",
                confidence: "low",
                risk: "medium",
                reviewState: "Edited",
                requiresHumanReview: true,
              },
            },
            {
              affectedPage: {
                pageId: "agent-context",
                outputPath: "AGENTS.md",
                matchedSourcePaths: ["docs/setup-guide.md"],
                reasons: ["changed-file"],
              },
              proposal: {
                pageId: "agent-context",
                summary: "Leave this proposal alone.",
                why: "Untargeted proposal.",
                sources: ["docs/setup-guide.md"],
                proposedText: "Untouched draft text",
                confidence: "low",
                risk: "medium",
                reviewState: "Approved",
                requiresHumanReview: true,
              },
            },
          ],
          summary: {
            affectedPages: 2,
            draftedProposals: 2,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const stdout: string[] = [];
    const stderr: string[] = [];
    const exitCode = await runCli(
      ["review", "--regenerate", "--page", "product-overview"],
      {
        cwd: root,
        stdout: (message) => {
          stdout.push(message);
        },
        stderr: (message) => {
          stderr.push(message);
        },
      },
    );
    const reviewText = await readFile(
      join(root, DEFAULT_UPDATE_OUTPUT_PATH),
      "utf8",
    );
    const reviewBatch = UpdateDraftBatchSchema.parse(JSON.parse(reviewText));

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout[0]).toContain("Regenerated 1 update proposal(s)");
    expect(reviewBatch.summary).toEqual({
      affectedPages: 2,
      draftedProposals: 2,
    });
    expect(reviewBatch.drafts[0]?.proposal.reviewState).toBe("Needs review");
    expect(reviewBatch.drafts[0]?.proposal.proposedText).toContain(
      "local stub update provider",
    );
    expect(reviewBatch.drafts[1]?.proposal.reviewState).toBe("Approved");
    expect(reviewBatch.drafts[1]?.proposal.proposedText).toBe(
      "Untouched draft text",
    );
  });

  it("edits a targeted proposal through an external editor command", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-review-"));
    const tools = await mkdtemp(join(tmpdir(), "dyknow-review-tools-"));

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(
      join(root, DEFAULT_UPDATE_OUTPUT_PATH),
      `${JSON.stringify(
        {
          draftedAt: "2026-05-23T18:00:00.000Z",
          rootPath: root,
          configPath: "dyknow.config.json",
          repoDiffPath: "docs/dyknow/.state/repo-diff.json",
          outputPath: DEFAULT_UPDATE_OUTPUT_PATH,
          providerId: "local",
          drafts: [
            {
              affectedPage: {
                pageId: "product-overview",
                outputPath: "docs/product-overview.md",
                matchedSourcePaths: ["README.md"],
                reasons: ["changed-file"],
              },
              proposal: {
                pageId: "product-overview",
                summary:
                  "Review Product Overview for 1 changed source path(s).",
                why: "Product Overview is affected because DyKnow detected changed file across 1 configured source path(s).",
                sources: ["README.md"],
                proposedText: "Draft text",
                confidence: "low",
                risk: "medium",
                reviewState: "Needs review",
                requiresHumanReview: true,
              },
            },
          ],
          summary: {
            affectedPages: 1,
            draftedProposals: 1,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    process.env.DYKNOW_EDITOR_COMMAND = `node ${await writeNodeEditorScript(tools)}`;

    const stdout: string[] = [];
    const stderr: string[] = [];
    const exitCode = await runCli(
      ["review", "--edit", "--page", "product-overview", "--editor"],
      {
        cwd: root,
        stdout: (message) => {
          stdout.push(message);
        },
        stderr: (message) => {
          stderr.push(message);
        },
      },
    );
    const reviewText = await readFile(
      join(root, DEFAULT_UPDATE_OUTPUT_PATH),
      "utf8",
    );
    const reviewBatch = UpdateDraftBatchSchema.parse(JSON.parse(reviewText));

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout[0]).toContain("Marked 1 update proposal(s) as Edited");
    expect(reviewBatch.drafts[0]?.proposal.reviewState).toBe("Edited");
    expect(reviewBatch.drafts[0]?.proposal.proposedText.trimEnd()).toBe(
      "Edited from node editor",
    );
  }, 15000);

  it("requires a prior update-proposals snapshot", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-review-"));
    const stderr: string[] = [];

    const exitCode = await runCli(["review", "--approve", "--all"], {
      cwd: root,
      stderr: (message) => {
        stderr.push(message);
      },
    });

    expect(exitCode).toBe(1);
    expect(stderr[0]).toContain("Run dyknow update first");
  });
});
