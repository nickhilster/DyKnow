import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import {
  AuditLogEntrySchema,
  DEFAULT_UPDATE_OUTPUT_PATH,
  UpdateDraftBatchSchema,
} from "@dyknow/core";

import { runCli } from "../src/index.js";
import { buildPrBody } from "../src/pr.js";

const execFileAsync = promisify(execFile);
const originalPath = process.env.PATH ?? "";
const originalGhCommand = process.env.DYKNOW_GH_COMMAND;

async function writeFakeGhCommand(tools: string) {
  if (process.platform === "win32") {
    const commandPath = join(tools, "gh.cmd");

    await writeFile(
      commandPath,
      ["@echo off", "echo https://github.com/example/DyKnow/pull/99"].join(
        "\r\n",
      ),
      "utf8",
    );

    return commandPath;
  }

  const commandPath = join(tools, "gh");

  await writeFile(
    commandPath,
    ["#!/bin/sh", "echo https://github.com/example/DyKnow/pull/99"].join("\n"),
    "utf8",
  );
  await chmod(commandPath, 0o755);

  return commandPath;
}

async function writeFailingGhCommand(tools: string) {
  if (process.platform === "win32") {
    const commandPath = join(tools, "gh-fail.cmd");

    await writeFile(
      commandPath,
      ["@echo off", "echo gh pr create failed 1>&2", "exit /b 1"].join("\r\n"),
      "utf8",
    );

    return commandPath;
  }

  const commandPath = join(tools, "gh-fail");

  await writeFile(
    commandPath,
    ["#!/bin/sh", "echo gh pr create failed 1>&2", "exit 1"].join("\n"),
    "utf8",
  );
  await chmod(commandPath, 0o755);

  return commandPath;
}

async function runGit(cwd: string, args: readonly string[]) {
  const result = await execFileAsync("git", [...args], {
    cwd,
    encoding: "utf8",
  });

  return result.stdout.trim();
}

afterEach(() => {
  process.env.PATH = originalPath;
  if (originalGhCommand === undefined) {
    process.env.DYKNOW_GH_COMMAND = undefined;
  } else {
    process.env.DYKNOW_GH_COMMAND = originalGhCommand;
  }
});

describe("dyknow pr", () => {
  it("creates a branch, pushes it, and opens a pull request for approved proposals", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-pr-"));
    const remote = await mkdtemp(join(tmpdir(), "dyknow-pr-remote-"));
    const tools = await mkdtemp(join(tmpdir(), "dyknow-pr-tools-"));

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(
      join(root, "docs", "product-overview.md"),
      "# Product Overview\n\nOld content.\n",
      "utf8",
    );
    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
    await runGit(root, ["init"]);
    await runGit(root, ["config", "user.name", "DyKnow Test"]);
    await runGit(root, ["config", "user.email", "dyknow@example.com"]);
    await runGit(root, ["branch", "-M", "main"]);
    await runGit(remote, ["init", "--bare"]);
    await runGit(root, ["remote", "add", "origin", remote]);
    await runGit(root, ["add", "."]);
    await runGit(root, ["commit", "-m", "chore: initial fixture"]);
    await runGit(root, ["push", "--set-upstream", "origin", "main"]);
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
    const fakeGhCommand = await writeFakeGhCommand(tools);
    process.env.PATH = `${tools};${originalPath}`;
    process.env.DYKNOW_GH_COMMAND = fakeGhCommand;

    const stdout: string[] = [];
    const stderr: string[] = [];
    const exitCode = await runCli(
      [
        "pr",
        "--branch",
        "dyknow/test-approved-updates",
        "--title",
        "Apply approved DyKnow updates",
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
    const body = buildPrBody({ approvedDrafts: batch.drafts, batch });
    const branchName = await runGit(root, ["branch", "--show-current"]);
    const remoteHeads = await runGit(remote, [
      "for-each-ref",
      "--format=%(refname:short)",
      "refs/heads",
    ]);
    const commitSubject = await runGit(root, ["log", "-1", "--pretty=%s"]);
    const status = await runGit(root, ["status", "--short"]);

    expect(stderr).toEqual([]);
    expect(exitCode).toBe(0);
    expect(stdout[0]).toContain(
      "opened PR https://github.com/example/DyKnow/pull/99",
    );
    expect(pageText).toContain("Approved content.");
    expect(batch.drafts[0]?.proposal.reviewState).toBe("Published");
    expect(auditEntries).toHaveLength(2);
    expect(auditEntries.map((entry) => entry.action)).toEqual([
      "publish:commit",
      "publish:pr-prepared",
    ]);
    expect(auditEntries[1]?.outputsAffected).toContain(
      "docs/product-overview.md",
    );
    expect(auditEntries[1]?.outputsAffected).toContain(
      DEFAULT_UPDATE_OUTPUT_PATH,
    );
    expect(branchName).toBe("dyknow/test-approved-updates");
    expect(remoteHeads).toContain("dyknow/test-approved-updates");
    expect(commitSubject).toBe("docs: apply approved dyknow updates");
    expect(body).toContain("## Updated pages");
    expect(body).toContain(
      "| product-overview | docs/product-overview.md | medium | low | README.md |",
    );
    expect(status).toBe("");
  });

  it("requires at least one approved proposal", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-pr-"));
    const remote = await mkdtemp(join(tmpdir(), "dyknow-pr-remote-"));
    const stderr: string[] = [];

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
    await runGit(root, ["init"]);
    await runGit(root, ["config", "user.name", "DyKnow Test"]);
    await runGit(root, ["config", "user.email", "dyknow@example.com"]);
    await runGit(root, ["branch", "-M", "main"]);
    await runGit(remote, ["init", "--bare"]);
    await runGit(root, ["remote", "add", "origin", remote]);
    await runGit(root, ["add", "."]);
    await runGit(root, ["commit", "-m", "chore: initial fixture"]);
    await runGit(root, ["push", "--set-upstream", "origin", "main"]);
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

    const exitCode = await runCli(["pr", "--branch", "dyknow/test-empty"], {
      cwd: root,
      stderr: (message) => {
        stderr.push(message);
      },
    });

    expect(exitCode).toBe(1);
    expect(stderr[0]).toContain("Run dyknow review --approve first");
  });

  it("records a prepared PR publish audit entry before an external PR creation failure", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-pr-"));
    const remote = await mkdtemp(join(tmpdir(), "dyknow-pr-remote-"));
    const tools = await mkdtemp(join(tmpdir(), "dyknow-pr-tools-"));

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(
      join(root, "docs", "product-overview.md"),
      "# Product Overview\n\nOld content.\n",
      "utf8",
    );
    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
    await runGit(root, ["init"]);
    await runGit(root, ["config", "user.name", "DyKnow Test"]);
    await runGit(root, ["config", "user.email", "dyknow@example.com"]);
    await runGit(root, ["branch", "-M", "main"]);
    await runGit(remote, ["init", "--bare"]);
    await runGit(root, ["remote", "add", "origin", remote]);
    await runGit(root, ["add", "."]);
    await runGit(root, ["commit", "-m", "chore: initial fixture"]);
    await runGit(root, ["push", "--set-upstream", "origin", "main"]);
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
    const failingGhCommand = await writeFailingGhCommand(tools);
    process.env.PATH = `${tools};${originalPath}`;
    process.env.DYKNOW_GH_COMMAND = failingGhCommand;

    const stderr: string[] = [];
    const exitCode = await runCli(["pr", "--branch", "dyknow/test-failed-pr"], {
      cwd: root,
      stderr: (message) => {
        stderr.push(message);
      },
    });

    const auditText = await readFile(
      join(root, "docs", "dyknow", ".state", "audit-log.jsonl"),
      "utf8",
    );
    const auditEntries = auditText
      .trim()
      .split(/\r?\n/u)
      .map((line) => AuditLogEntrySchema.parse(JSON.parse(line)));

    expect(exitCode).toBe(1);
    expect(stderr).not.toEqual([]);
    expect(auditEntries.map((entry) => entry.action)).toEqual([
      "publish:commit",
      "publish:pr-prepared",
    ]);
  });
});
