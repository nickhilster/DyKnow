import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runCli } from "../src/index.js";

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
    expect(stdout[0]).toContain(
      "[2026-05-23T20:05:00.000Z] review:edit by copilot",
    );
    expect(stdout[0]).not.toContain(
      "[2026-05-23T20:00:00.000Z] review:approve by copilot",
    );
  });
});
