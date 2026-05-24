import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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

describe("dyknow log", () => {
  it("reports when the audit log does not exist", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-log-"));
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await runCli(["log"], {
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
      "No audit entries found at docs/dyknow/.state/audit-log.jsonl.",
    );
  });

  it("reports source and action filters when no entries match runtime filtering", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-log-"));
    const stdout: string[] = [];
    const stderr: string[] = [];

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
    await runGit(root, ["init"]);
    await runGit(root, ["config", "user.name", "DyKnow Test"]);
    await runGit(root, ["config", "user.email", "dyknow@example.com"]);
    await writeFile(
      join(root, "docs", "dyknow", ".state", "audit-log.jsonl"),
      `${JSON.stringify({
        action: "publish:pr-prepared",
        actor: "copilot",
        sourcesRead: ["README.md"],
        outputsAffected: ["docs/product-overview.md"],
        timestamp: "2026-05-23T20:05:00.000Z",
        hash: "22222222",
      })}\n`,
      "utf8",
    );
    const exitCode = await runCli(["log", "--source", "runtime"], {
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
      "No audit entries found in .git/dyknow/runtime-audit-log.jsonl for source=runtime.",
    );
  });

  it("reports source and action filters when no entries match action filtering", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-log-"));
    const stdout: string[] = [];
    const stderr: string[] = [];

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
    await runGit(root, ["init"]);
    await runGit(root, ["config", "user.name", "DyKnow Test"]);
    await runGit(root, ["config", "user.email", "dyknow@example.com"]);
    await writeFile(
      join(root, "docs", "dyknow", ".state", "audit-log.jsonl"),
      `${JSON.stringify({
        action: "review:approve",
        actor: "copilot",
        sourcesRead: ["README.md"],
        outputsAffected: ["docs/product-overview.md"],
        timestamp: "2026-05-23T20:05:00.000Z",
        hash: "22222222",
      })}\n`,
      "utf8",
    );

    const exitCode = await runCli(["log", "--action", "publish"], {
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
      "No audit entries found in docs/dyknow/.state/audit-log.jsonl and .git/dyknow/runtime-audit-log.jsonl for action=publish.",
    );
  });

  it("pretty-prints the most recent audit entries first", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-log-"));
    const stdout: string[] = [];
    const stderr: string[] = [];

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(
      join(root, "docs", "dyknow", ".state", "audit-log.jsonl"),
      `${[
        JSON.stringify({
          action: "review:approve",
          actor: "copilot",
          sourcesRead: ["README.md"],
          outputsAffected: ["docs/product-overview.md"],
          timestamp: "2026-05-23T20:00:00.000Z",
          hash: "11111111",
        }),
        JSON.stringify({
          action: "review:edit",
          actor: "copilot",
          sourcesRead: ["README.md", "docs/feature-map.md"],
          outputsAffected: ["docs/feature-map.md"],
          timestamp: "2026-05-23T20:05:00.000Z",
          hash: "22222222",
        }),
        JSON.stringify({
          action: "review:regenerate",
          actor: "copilot",
          sourcesRead: ["docs/implementation-roadmap.md"],
          outputsAffected: ["docs/dyknow/.state/update-proposals.json"],
          timestamp: "2026-05-23T20:10:00.000Z",
          hash: "33333333",
        }),
      ].join("\n")}
`,
      "utf8",
    );

    const exitCode = await runCli(["log", "--limit", "2"], {
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
    expect(stdout[0]).toContain(
      "Recent audit entries from docs/dyknow/.state/audit-log.jsonl (showing 2 of 3):",
    );
    expect(stdout[0]).toContain(
      "[2026-05-23T20:10:00.000Z] review:regenerate by copilot",
    );
    expect(stdout[0]).toContain("  log: docs/dyknow/.state/audit-log.jsonl");
    expect(stdout[0]).toContain(
      "[2026-05-23T20:05:00.000Z] review:edit by copilot",
    );
    expect(stdout[0]).not.toContain(
      "[2026-05-23T20:00:00.000Z] review:approve by copilot",
    );
  });

  it("includes runtime audit entries from the git metadata path when reading the default log", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-log-"));
    const stdout: string[] = [];
    const stderr: string[] = [];

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
    await runGit(root, ["init"]);
    await runGit(root, ["config", "user.name", "DyKnow Test"]);
    await runGit(root, ["config", "user.email", "dyknow@example.com"]);
    await writeFile(
      join(root, "docs", "dyknow", ".state", "audit-log.jsonl"),
      `${JSON.stringify({
        action: "publish:pr-prepared",
        actor: "copilot",
        sourcesRead: ["README.md"],
        outputsAffected: ["docs/product-overview.md"],
        timestamp: "2026-05-23T20:05:00.000Z",
        hash: "22222222",
      })}\n`,
      "utf8",
    );
    const runtimeAuditPath = await runGit(root, [
      "rev-parse",
      "--git-path",
      "dyknow/runtime-audit-log.jsonl",
    ]);
    await mkdir(dirname(join(root, runtimeAuditPath)), { recursive: true });
    await writeFile(
      join(root, runtimeAuditPath),
      `${JSON.stringify({
        action: "publish:pr-opened",
        actor: "copilot",
        sourcesRead: ["README.md"],
        outputsAffected: [
          "github-pr:https://github.com/example/DyKnow/pull/99",
        ],
        timestamp: "2026-05-23T20:10:00.000Z",
        hash: "33333333",
      })}\n`,
      "utf8",
    );

    const exitCode = await runCli(["log", "--limit", "2"], {
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
    expect(stdout[0]).toContain("publish:pr-opened by copilot");
    expect(stdout[0]).toContain("publish:pr-prepared by copilot");
    expect(stdout[0]).toContain(
      "Recent audit entries from docs/dyknow/.state/audit-log.jsonl and .git/dyknow/runtime-audit-log.jsonl (showing 2 of 2):",
    );
    expect(stdout[0]).toContain("  log: docs/dyknow/.state/audit-log.jsonl");
    expect(stdout[0]).toContain("  log: .git/dyknow/runtime-audit-log.jsonl");
  });

  it("can filter the default log view down to runtime entries only", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-log-"));
    const stdout: string[] = [];
    const stderr: string[] = [];

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
    await runGit(root, ["init"]);
    await runGit(root, ["config", "user.name", "DyKnow Test"]);
    await runGit(root, ["config", "user.email", "dyknow@example.com"]);
    await writeFile(
      join(root, "docs", "dyknow", ".state", "audit-log.jsonl"),
      `${JSON.stringify({
        action: "publish:pr-prepared",
        actor: "copilot",
        sourcesRead: ["README.md"],
        outputsAffected: ["docs/product-overview.md"],
        timestamp: "2026-05-23T20:05:00.000Z",
        hash: "22222222",
      })}\n`,
      "utf8",
    );
    const runtimeAuditPath = await runGit(root, [
      "rev-parse",
      "--git-path",
      "dyknow/runtime-audit-log.jsonl",
    ]);
    await mkdir(dirname(join(root, runtimeAuditPath)), { recursive: true });
    await writeFile(
      join(root, runtimeAuditPath),
      `${JSON.stringify({
        action: "publish:pr-opened",
        actor: "copilot",
        sourcesRead: ["README.md"],
        outputsAffected: [
          "github-pr:https://github.com/example/DyKnow/pull/99",
        ],
        timestamp: "2026-05-23T20:10:00.000Z",
        hash: "33333333",
      })}\n`,
      "utf8",
    );

    const exitCode = await runCli(["log", "--source", "runtime"], {
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
    expect(stdout[0]).toContain("publish:pr-opened by copilot");
    expect(stdout[0]).not.toContain("publish:pr-prepared by copilot");
    expect(stdout[0]).toContain(
      "Recent audit entries from .git/dyknow/runtime-audit-log.jsonl for source=runtime (showing 1 of 1):",
    );
    expect(stdout[0]).not.toContain(
      "Recent audit entries from docs/dyknow/.state/audit-log.jsonl and .git/dyknow/runtime-audit-log.jsonl",
    );
    expect(stdout[0]).toContain("  log: .git/dyknow/runtime-audit-log.jsonl");
  });

  it("can filter the default log view down to publish entries only", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-log-"));
    const stdout: string[] = [];
    const stderr: string[] = [];

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
    await runGit(root, ["init"]);
    await runGit(root, ["config", "user.name", "DyKnow Test"]);
    await runGit(root, ["config", "user.email", "dyknow@example.com"]);
    await writeFile(
      join(root, "docs", "dyknow", ".state", "audit-log.jsonl"),
      `${[
        JSON.stringify({
          action: "review:approve",
          actor: "copilot",
          sourcesRead: ["README.md"],
          outputsAffected: ["docs/product-overview.md"],
          timestamp: "2026-05-23T20:00:00.000Z",
          hash: "11111111",
        }),
        JSON.stringify({
          action: "publish:pr-prepared",
          actor: "copilot",
          sourcesRead: ["README.md"],
          outputsAffected: ["docs/product-overview.md"],
          timestamp: "2026-05-23T20:05:00.000Z",
          hash: "22222222",
        }),
      ].join("\n")}\n`,
      "utf8",
    );
    const runtimeAuditPath = await runGit(root, [
      "rev-parse",
      "--git-path",
      "dyknow/runtime-audit-log.jsonl",
    ]);
    await mkdir(dirname(join(root, runtimeAuditPath)), { recursive: true });
    await writeFile(
      join(root, runtimeAuditPath),
      `${JSON.stringify({
        action: "publish:pr-opened",
        actor: "copilot",
        sourcesRead: ["README.md"],
        outputsAffected: [
          "github-pr:https://github.com/example/DyKnow/pull/99",
        ],
        timestamp: "2026-05-23T20:10:00.000Z",
        hash: "33333333",
      })}\n`,
      "utf8",
    );

    const exitCode = await runCli(["log", "--action", "publish"], {
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
    expect(stdout[0]).toContain("publish:pr-opened by copilot");
    expect(stdout[0]).toContain("publish:pr-prepared by copilot");
    expect(stdout[0]).not.toContain("review:approve by copilot");
    expect(stdout[0]).toContain(
      "Recent audit entries from docs/dyknow/.state/audit-log.jsonl and .git/dyknow/runtime-audit-log.jsonl for action=publish (showing 2 of 2):",
    );
  });

  it("renders combined action and source filter labels in a stable order", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-log-"));
    const stdout: string[] = [];
    const stderr: string[] = [];

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
    await runGit(root, ["init"]);
    await runGit(root, ["config", "user.name", "DyKnow Test"]);
    await runGit(root, ["config", "user.email", "dyknow@example.com"]);
    await writeFile(
      join(root, "docs", "dyknow", ".state", "audit-log.jsonl"),
      `${JSON.stringify({
        action: "review:approve",
        actor: "copilot",
        sourcesRead: ["README.md"],
        outputsAffected: ["docs/product-overview.md"],
        timestamp: "2026-05-23T20:00:00.000Z",
        hash: "11111111",
      })}\n`,
      "utf8",
    );
    const runtimeAuditPath = await runGit(root, [
      "rev-parse",
      "--git-path",
      "dyknow/runtime-audit-log.jsonl",
    ]);
    await mkdir(dirname(join(root, runtimeAuditPath)), { recursive: true });
    await writeFile(
      join(root, runtimeAuditPath),
      `${JSON.stringify({
        action: "publish:pr-opened",
        actor: "copilot",
        sourcesRead: ["README.md"],
        outputsAffected: [
          "github-pr:https://github.com/example/DyKnow/pull/99",
        ],
        timestamp: "2026-05-23T20:10:00.000Z",
        hash: "33333333",
      })}\n`,
      "utf8",
    );

    const exitCode = await runCli(
      ["log", "--source", "runtime", "--action", "publish"],
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

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout[0]).toContain(
      "Recent audit entries from .git/dyknow/runtime-audit-log.jsonl for action=publish and source=runtime (showing 1 of 1):",
    );
  });
});
