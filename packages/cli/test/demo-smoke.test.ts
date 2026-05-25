import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runCli } from "../src/index.js";

describe("dyknow demo-smoke", () => {
  it("validates the Phase 3 handoff pages and runs scan, diff, and update", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-demo-smoke-"));
    const stdout: string[] = [];
    const stderr: string[] = [];

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
    await writeFile(
      join(root, "docs", "handoff-phase3-demo.md"),
      "# Phase 3 Public Demo Handoff\n",
      "utf8",
    );
    await writeFile(
      join(root, "docs", "phase3-demo-checklist.md"),
      "# Phase 3 Demo Checklist\n",
      "utf8",
    );
    await writeFile(
      join(root, "docs", "index.md"),
      [
        "# Docs Index",
        "",
        "- [Phase 3 Public Demo Handoff](handoff-phase3-demo.md)",
        "- [Phase 3 Demo Checklist](phase3-demo-checklist.md)",
        "",
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      join(root, "docs", "log.md"),
      [
        "2026-05-25 | create | docs/handoff-phase3-demo.md | Added the Phase 3 handoff page.",
        "2026-05-25 | create | docs/phase3-demo-checklist.md | Added the Phase 3 checklist page.",
        "",
      ].join("\n"),
      "utf8",
    );

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
    expect(stdout.at(-1)).toBe(
      "Phase 3 smoke path passed for docs/handoff-phase3-demo.md and docs/phase3-demo-checklist.md.",
    );

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

    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(join(root, "docs", "handoff-phase3-demo.md"), "# Handoff\n", "utf8");
    await writeFile(
      join(root, "docs", "index.md"),
      [
        "# Docs Index",
        "",
        "- [Phase 3 Public Demo Handoff](handoff-phase3-demo.md)",
        "- [Phase 3 Demo Checklist](phase3-demo-checklist.md)",
        "",
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      join(root, "docs", "log.md"),
      "2026-05-25 | create | docs/handoff-phase3-demo.md | Added the Phase 3 handoff page.\n",
      "utf8",
    );

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
});