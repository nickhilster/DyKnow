import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import {
  AuditLogEntrySchema,
  DEFAULT_UPDATE_OUTPUT_PATH,
  UpdateDraftBatchSchema,
} from "@dyknow/core";

import { runCli } from "../src/index.js";

const execFileAsync = promisify(execFile);

async function runGit(cwd: string, args: readonly string[]) {
  const result = await execFileAsync("git", [...args], {
    cwd,
    encoding: "utf8",
  });

  return result.stdout.trim();
}

describe("dyknow commit", () => {
  it("applies approved proposals and creates a git commit", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-commit-"));

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(
      join(root, "docs", "product-overview.md"),
      "# Product Overview\n\nOld content.\n",
      "utf8",
    );
    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
    await writeFile(
      join(root, "dyknow.config.json"),
      `${JSON.stringify(
        {
          $schema: "./dyknow.config.schema.json",
          projectName: "Fixture",
          mode: "local-only",
          allowedSources: ["README.md", "docs/**"],
          ignoredSources: [],
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
    await runGit(root, ["init"]);
    await runGit(root, ["config", "user.name", "DyKnow Test"]);
    await runGit(root, ["config", "user.email", "dyknow@example.com"]);
    await runGit(root, ["add", "."]);
    await runGit(root, ["commit", "-m", "chore: initial fixture"]);
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
                summary: "Summary",
                why: "Why",
                sources: ["README.md"],
                proposedText: "# Product Overview\n\nApproved content.",
                confidence: "low",
                risk: "medium",
                reviewState: "Approved",
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
    const exitCode = await runCli(["commit"], {
      cwd: root,
      stdout: (message) => {
        stdout.push(message);
      },
      stderr: (message) => {
        stderr.push(message);
      },
    });
    const pageText = await readFile(
      join(root, "docs", "product-overview.md"),
      "utf8",
    );
    const batchText = await readFile(
      join(root, DEFAULT_UPDATE_OUTPUT_PATH),
      "utf8",
    );
    const auditText = await readFile(
      join(root, "docs", "dyknow", ".state", "audit-log.jsonl"),
      "utf8",
    );
    const batch = UpdateDraftBatchSchema.parse(JSON.parse(batchText));
    const auditEntries = auditText
      .trim()
      .split(/\r?\n/u)
      .map((line) => AuditLogEntrySchema.parse(JSON.parse(line)));
    const commitSubject = await runGit(root, ["log", "-1", "--pretty=%s"]);
    const status = await runGit(root, ["status", "--short"]);

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout[0]).toContain("Applied 1 approved update proposal(s)");
    expect(pageText).toContain("Approved content.");
    expect(batch.drafts[0]?.proposal.reviewState).toBe("Published");
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0]?.action).toBe("publish:commit");
    expect(auditEntries[0]?.outputsAffected).toContain(
      "docs/product-overview.md",
    );
    expect(auditEntries[0]?.outputsAffected).toContain(
      DEFAULT_UPDATE_OUTPUT_PATH,
    );
    expect(commitSubject).toBe("docs: apply approved dyknow updates");
    expect(status).toBe("");
  });

  it("requires at least one approved proposal", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-commit-"));
    const stderr: string[] = [];

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
    await runGit(root, ["init"]);
    await runGit(root, ["config", "user.name", "DyKnow Test"]);
    await runGit(root, ["config", "user.email", "dyknow@example.com"]);
    await runGit(root, ["add", "."]);
    await runGit(root, ["commit", "-m", "chore: initial fixture"]);
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
          drafts: [],
          summary: {
            affectedPages: 0,
            draftedProposals: 0,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const exitCode = await runCli(["commit"], {
      cwd: root,
      stderr: (message) => {
        stderr.push(message);
      },
    });

    expect(exitCode).toBe(1);
    expect(stderr[0]).toContain("Run dyknow review --approve first");
  });

  it("rejects approved proposals whose output path does not match the configured page", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-commit-"));
    const stderr: string[] = [];

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(
      join(root, "docs", "product-overview.md"),
      "# Product Overview\n\nOld content.\n",
      "utf8",
    );
    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
    await writeFile(
      join(root, "dyknow.config.json"),
      `${JSON.stringify(
        {
          $schema: "./dyknow.config.schema.json",
          projectName: "Fixture",
          mode: "local-only",
          allowedSources: ["README.md", "docs/**"],
          ignoredSources: [],
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
    await runGit(root, ["init"]);
    await runGit(root, ["config", "user.name", "DyKnow Test"]);
    await runGit(root, ["config", "user.email", "dyknow@example.com"]);
    await runGit(root, ["add", "."]);
    await runGit(root, ["commit", "-m", "chore: initial fixture"]);
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
                outputPath: "README.md",
                matchedSourcePaths: ["README.md"],
                reasons: ["changed-file"],
              },
              proposal: {
                pageId: "product-overview",
                summary: "Summary",
                why: "Why",
                sources: ["README.md"],
                proposedText: "Overwritten content.",
                confidence: "low",
                risk: "medium",
                reviewState: "Approved",
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

    const exitCode = await runCli(["commit"], {
      cwd: root,
      stderr: (message) => {
        stderr.push(message);
      },
    });
    const readmeText = await readFile(join(root, "README.md"), "utf8");
    const headSubject = await runGit(root, ["log", "-1", "--pretty=%s"]);

    expect(exitCode).toBe(1);
    expect(stderr[0]).toContain("does not match the configured output path");
    expect(readmeText).toBe("# Fixture\n");
    expect(headSubject).toBe("chore: initial fixture");
  });
});
