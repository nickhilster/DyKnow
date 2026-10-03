import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { DEFAULT_UPDATE_OUTPUT_PATH } from "@dyknow/core";

import { runCli } from "../src/index.js";

const execFileAsync = promisify(execFile);

type DraftKind = "stub" | "generated" | undefined;

async function runGit(cwd: string, args: readonly string[]) {
  await execFileAsync("git", [...args], { cwd, encoding: "utf8" });
}

function proposalBatch(
  root: string,
  draftKind: DraftKind,
  reviewState: "Approved" | "Needs review",
) {
  return `${JSON.stringify(
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
            summary: "Review Product Overview for 1 changed source path(s).",
            why: "Product Overview is affected.",
            sources: ["README.md"],
            proposedText: "# Product Overview\n\nNew content.",
            confidence: "high",
            risk: "medium",
            ...(draftKind ? { draftKind } : {}),
            reviewState,
            requiresHumanReview: true,
          },
        },
      ],
      summary: { affectedPages: 1, draftedProposals: 1 },
    },
    null,
    2,
  )}\n`;
}

async function createWorkspace(
  draftKind: DraftKind,
  reviewState: "Approved" | "Needs review",
  options: { git: boolean },
) {
  const root = await mkdtemp(join(tmpdir(), "dyknow-stub-"));

  await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
  await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
  await writeFile(
    join(root, "docs", "product-overview.md"),
    "# Product Overview\n\nOld content.\n",
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
        ignoredSources: [],
        pages: [
          {
            id: "product-overview",
            title: "Product Overview",
            outputPath: "docs/product-overview.md",
            audience: "mixed",
            sources: ["README.md"],
            reviewRules: { approvalRequired: true },
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

  if (options.git) {
    await runGit(root, ["init"]);
    await runGit(root, ["config", "user.name", "DyKnow Test"]);
    await runGit(root, ["config", "user.email", "dyknow@example.com"]);
    await runGit(root, ["add", "."]);
    await runGit(root, ["commit", "-m", "chore: initial fixture"]);
  }

  await writeFile(
    join(root, DEFAULT_UPDATE_OUTPUT_PATH),
    proposalBatch(root, draftKind, reviewState),
    "utf8",
  );

  return root;
}

async function run(root: string, args: readonly string[], answer?: string) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const answers = answer ? [answer] : [];
  const exitCode = await runCli([...args], {
    cwd: root,
    prompt: async () => answers.shift() ?? "quit",
    stdout: (message) => {
      stdout.push(message);
    },
    stderr: (message) => {
      stderr.push(message);
    },
  });

  return { exitCode, stderr, stdout };
}

describe("stub drafts are visible to a reviewer", () => {
  it("marks a stub in the interactive review header", async () => {
    const root = await createWorkspace("stub", "Needs review", { git: false });

    const { exitCode, stdout } = await run(
      root,
      ["review", "--interactive"],
      "skip",
    );

    expect(exitCode).toBe(0);
    expect(stdout[0]).toContain("[confidence:high]");
    expect(stdout[0]).toContain("[stub: no generated content]");
  });

  it("does not mark generated or unmarked drafts", async () => {
    for (const kind of ["generated", undefined] as const) {
      const root = await createWorkspace(kind, "Needs review", { git: false });

      const { stdout } = await run(root, ["review", "--interactive"], "skip");

      expect(stdout[0]).toContain("[confidence:high]");
      expect(stdout[0]).not.toContain("stub");
    }
  });

  it("notes after dyknow commit that a published page was a placeholder", async () => {
    const root = await createWorkspace("stub", "Approved", { git: true });

    const { exitCode, stdout } = await run(root, ["commit"]);

    expect(exitCode).toBe(0);
    expect(stdout[0]).toContain("Applied 1 approved update proposal(s)");
    expect(stdout[1]).toContain("1 of these is a placeholder stub");
    expect(stdout[1]).toContain("no generated content");
  });

  it("says nothing extra after committing generated content", async () => {
    const root = await createWorkspace("generated", "Approved", { git: true });

    const { exitCode, stdout } = await run(root, ["commit"]);

    expect(exitCode).toBe(0);
    expect(stdout).toHaveLength(1);
  });

  it("labels a stub in the status report table", async () => {
    const root = await createWorkspace("stub", "Needs review", { git: true });

    const { exitCode } = await run(root, ["status"]);
    const { readFile } = await import("node:fs/promises");
    const report = await readFile(
      join(root, "dyknow-progress-status.html"),
      "utf8",
    );

    expect(exitCode).toBe(0);
    expect(report).toContain("high (stub)");
  });
});
