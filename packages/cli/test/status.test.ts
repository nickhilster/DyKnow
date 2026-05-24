import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { runCli } from "../src/index.js";

const execFileAsync = promisify(execFile);

async function runGit(cwd: string, args: readonly string[]) {
  const result = await execFileAsync("git", [...args], {
    cwd,
    encoding: "utf8",
  });

  return result.stdout.trim();
}

describe("dyknow status", () => {
  it("generates an HTML status report from repo state and DyKnow artifacts", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-status-"));
    const stdout: string[] = [];
    const stderr: string[] = [];

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
    await writeFile(
      join(root, "docs", "dyknow", ".state", "repo-diff.json"),
      `${JSON.stringify(
        {
          comparedAt: "2026-05-24T09:00:00.000Z",
          rootPath: root,
          configPath: "dyknow.config.json",
          baseSnapshotPath: "docs/dyknow/.state/repo-map.json",
          outputPath: "docs/dyknow/.state/repo-diff.json",
          previousScannedAt: "2026-05-24T08:59:00.000Z",
          currentScannedAt: "2026-05-24T09:00:00.000Z",
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
    await writeFile(
      join(root, "docs", "dyknow", ".state", "update-proposals.json"),
      `${JSON.stringify(
        {
          draftedAt: "2026-05-24T09:05:00.000Z",
          rootPath: root,
          configPath: "dyknow.config.json",
          repoDiffPath: "docs/dyknow/.state/repo-diff.json",
          outputPath: "docs/dyknow/.state/update-proposals.json",
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
                summary: "Refresh product overview",
                why: "README changed",
                sources: ["README.md"],
                proposedText: "# Product Overview\n",
                confidence: "medium",
                risk: "low",
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
      join(root, "docs", "dyknow", ".state", "audit-log.jsonl"),
      `${JSON.stringify({
        action: "review:approve",
        actor: "copilot",
        sourcesRead: ["README.md"],
        outputsAffected: ["docs/product-overview.md"],
        timestamp: "2026-05-24T09:10:00.000Z",
        hash: "abcdef12",
      })}\n`,
      "utf8",
    );

    await runGit(root, ["init"]);
    await runGit(root, ["config", "user.name", "DyKnow Test"]);
    await runGit(root, ["config", "user.email", "dyknow@example.com"]);
    await runGit(root, ["branch", "-M", "main"]);
    await runGit(root, ["add", "."]);
    await runGit(root, ["commit", "-m", "chore: fixture"]);

    const exitCode = await runCli(["status"], {
      cwd: root,
      stdout: (message) => {
        stdout.push(message);
      },
      stderr: (message) => {
        stderr.push(message);
      },
    });

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout[0]).toBe(
      "Generated DyKnow status report at dyknow-progress-status.html.",
    );

    const report = await readFile(
      join(root, "dyknow-progress-status.html"),
      "utf8",
    );

    expect(report).toContain("DyKnow Progress and Status Report");
    expect(report).toContain("<strong>Branch:</strong> main");
    expect(report).toContain("<strong>Total Commits:</strong> 1");
    expect(report).toContain("Latest Commit:</strong> chore: fixture");
    expect(report).toContain('class="value">1</div>');
    expect(report).toContain("Affected Pages in Current Repo Diff");
    expect(report).toContain("Draft Proposals in Current Update Batch");
    expect(report).toContain("Needs review");
    expect(report).toContain("review:approve");
    expect(report).toContain("README.md");
  });
});
