import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { describe, expect, it } from "vitest";

import { runCli } from "../src/index.js";

const phase3FixtureDocuments = [
  {
    heading: "# Phase 3 Public Demo Handoff",
    linkText: "Phase 3 Public Demo Handoff",
    path: "docs/handoff-phase3-demo.md",
  },
  {
    heading: "# Phase 3 Demo Checklist",
    linkText: "Phase 3 Demo Checklist",
    path: "docs/phase3-demo-checklist.md",
  },
  {
    heading: "# Phase 3 Demo Repo Selection",
    linkText: "Phase 3 Demo Repo Selection",
    path: "docs/phase3-demo-repo-selection.md",
  },
  {
    heading: "# Phase 3 Demo Baseline Plan",
    linkText: "Phase 3 Demo Baseline Plan",
    path: "docs/phase3-demo-baseline-plan.md",
  },
  {
    heading: "# Phase 3 Demo Change Script",
    linkText: "Phase 3 Demo Change Script",
    path: "docs/phase3-demo-change-script.md",
  },
  {
    heading: "# Phase 3 Demo Recording Runbook",
    linkText: "Phase 3 Demo Recording Runbook",
    path: "docs/phase3-demo-recording-runbook.md",
  },
  {
    heading: "# Phase 3 Codex Takeover Handoff",
    linkText: "Phase 3 Codex Takeover Handoff",
    path: "docs/handoff-phase3-codex.md",
  },
] as const;

async function writePhase3SmokeFixture(
  root: string,
  options?: { missingPaths?: readonly string[] },
) {
  const missingPaths = new Set(options?.missingPaths ?? []);

  await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
  await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");

  for (const document of phase3FixtureDocuments) {
    if (missingPaths.has(document.path)) {
      continue;
    }

    await writeFile(
      join(root, ...document.path.split("/")),
      `${document.heading}\n`,
      "utf8",
    );
  }

  await writeFile(
    join(root, "docs", "index.md"),
    [
      "# Docs Index",
      "",
      ...phase3FixtureDocuments.map(
        (document) => `- [${document.linkText}](${basename(document.path)})`,
      ),
      "",
    ].join("\n"),
    "utf8",
  );

  await writeFile(
    join(root, "docs", "log.md"),
    [
      ...phase3FixtureDocuments.map(
        (document) => `2026-05-25 | create | ${document.path} | Fixture log entry.`,
      ),
      "",
    ].join("\n"),
    "utf8",
  );
}

describe("dyknow demo-smoke", () => {
  it("validates the Phase 3 handoff pages and runs scan, diff, and update", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-demo-smoke-"));
    const stdout: string[] = [];
    const stderr: string[] = [];

    await writePhase3SmokeFixture(root);

    const initExitCode = await runCli(["init", "--project-name", "Fixture"], {
      cwd: root,
      stderr: (message) => {
        stderr.push(message);
      },
    });

    expect(initExitCode).toBe(0);
    stderr.length = 0;

    const exitCode = await runCli(["demo-smoke"], {
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
    expect(stdout.at(-1)).toBe("Phase 3 smoke path passed for 7 required Phase 3 docs.");

    const repoMap = await readFile(
      join(root, "docs", "dyknow", ".state", "repo-map.json"),
      "utf8",
    );
    const repoDiff = await readFile(
      join(root, "docs", "dyknow", ".state", "repo-diff.json"),
      "utf8",
    );
    const updateProposals = await readFile(
      join(root, "docs", "dyknow", ".state", "update-proposals.json"),
      "utf8",
    );

    expect(repoMap).toContain('"scannedAt"');
    expect(repoDiff).toContain('"affectedPages"');
    expect(updateProposals).toContain('"drafts"');
  });

  it("fails when the Phase 3 checklist page is missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-demo-smoke-"));
    const stderr: string[] = [];

    await writePhase3SmokeFixture(root, {
      missingPaths: ["docs/phase3-demo-checklist.md"],
    });

    const initExitCode = await runCli(["init", "--project-name", "Fixture"], {
      cwd: root,
    });

    expect(initExitCode).toBe(0);

    const exitCode = await runCli(["demo-smoke"], {
      cwd: root,
      stderr: (message) => {
        stderr.push(message);
      },
    });

    expect(exitCode).toBe(1);
    expect(stderr[0]).toContain("Missing Phase 3 checklist page");
  });

  it("fails when the Phase 3 Codex takeover handoff page is missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-demo-smoke-"));
    const stderr: string[] = [];

    await writePhase3SmokeFixture(root, {
      missingPaths: ["docs/handoff-phase3-codex.md"],
    });

    const initExitCode = await runCli(["init", "--project-name", "Fixture"], {
      cwd: root,
    });

    expect(initExitCode).toBe(0);

    const exitCode = await runCli(["demo-smoke"], {
      cwd: root,
      stderr: (message) => {
        stderr.push(message);
      },
    });

    expect(exitCode).toBe(1);
    expect(stderr[0]).toContain("Missing Phase 3 Codex takeover handoff page");
  });
});