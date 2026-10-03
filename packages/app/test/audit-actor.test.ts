import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AuditLogEntrySchema } from "@dyknow/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_AUDIT_LOG_PATH,
  appendAuditEntries,
  resolveAuditActor,
} from "../src/audit.js";

describe("@dyknow/app audit actor", () => {
  const cleanupPaths: string[] = [];

  async function makeWorkspace() {
    const workspace = await mkdtemp(join(tmpdir(), "dyknow-audit-actor-"));
    cleanupPaths.push(workspace);
    return workspace;
  }

  function initRepo(workspace: string, identity: Record<string, string>) {
    execFileSync("git", ["init", "-q"], { cwd: workspace });
    for (const [key, value] of Object.entries(identity)) {
      execFileSync("git", ["config", key, value], { cwd: workspace });
    }
  }

  beforeEach(async () => {
    // Keep git from reading the machine's own identity, so "no identity"
    // means no identity on every developer's laptop and on CI.
    const emptyGlobalConfig = join(
      await mkdtemp(join(tmpdir(), "dyknow-git-config-")),
      "gitconfig",
    );
    cleanupPaths.push(join(emptyGlobalConfig, ".."));
    await writeFile(emptyGlobalConfig, "", "utf8");
    vi.stubEnv("GIT_CONFIG_GLOBAL", emptyGlobalConfig);
    vi.stubEnv("GIT_CONFIG_NOSYSTEM", "1");
    vi.stubEnv("DYKNOW_ACTOR", "");
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await Promise.all(
      cleanupPaths
        .splice(0)
        .map((path) => rm(path, { force: true, recursive: true })),
    );
  });

  it("uses a declared DYKNOW_ACTOR first, trimmed", async () => {
    const workspace = await makeWorkspace();
    initRepo(workspace, {
      "user.name": "Git Person",
      "user.email": "g@x.test",
    });
    vi.stubEnv("DYKNOW_ACTOR", "  release-bot  ");

    await expect(resolveAuditActor(workspace)).resolves.toEqual({
      actor: "release-bot",
      source: "env",
    });
  });

  it("ignores a blank DYKNOW_ACTOR and falls back to the git identity", async () => {
    const workspace = await makeWorkspace();
    initRepo(workspace, {
      "user.name": "Git Person",
      "user.email": "g@x.test",
    });
    vi.stubEnv("DYKNOW_ACTOR", "   ");

    await expect(resolveAuditActor(workspace)).resolves.toEqual({
      actor: "Git Person <g@x.test>",
      source: "git",
    });
  });

  it("uses whichever git identity field exists when only one is set", async () => {
    const workspace = await makeWorkspace();
    initRepo(workspace, { "user.name": "Only Name" });

    await expect(resolveAuditActor(workspace)).resolves.toEqual({
      actor: "Only Name",
      source: "git",
    });
  });

  it("says unknown, not a made-up name, when nothing identifies the actor", async () => {
    const workspace = await makeWorkspace();
    initRepo(workspace, {});

    await expect(resolveAuditActor(workspace)).resolves.toEqual({
      actor: "unknown",
      source: "default",
    });
  });

  it("falls back to unknown outside a git repository", async () => {
    const workspace = await makeWorkspace();

    await expect(resolveAuditActor(workspace)).resolves.toEqual({
      actor: "unknown",
      source: "default",
    });
  });

  it("records the actor and how it was determined on every audit entry", async () => {
    const workspace = await makeWorkspace();
    initRepo(workspace, {});
    vi.stubEnv("DYKNOW_ACTOR", "alice");

    await appendAuditEntries({
      action: "review:approve",
      entries: [
        { outputsAffected: ["docs/a.md"], sourcesRead: ["src/a.ts"] },
        { outputsAffected: ["docs/b.md"], sourcesRead: ["src/b.ts"] },
      ],
      rootPath: workspace,
    });

    const lines = (
      await readFile(join(workspace, DEFAULT_AUDIT_LOG_PATH), "utf8")
    )
      .trim()
      .split("\n");
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      const entry = AuditLogEntrySchema.parse(JSON.parse(line));
      expect(entry.actor).toBe("alice");
      expect(entry.actorSource).toBe("env");
    }
  });

  it("marks entries written with no identity as default, never as a person", async () => {
    const workspace = await makeWorkspace();
    initRepo(workspace, {});

    await appendAuditEntries({
      action: "publish:commit",
      entries: [{ outputsAffected: ["docs/a.md"], sourcesRead: ["src/a.ts"] }],
      rootPath: workspace,
    });

    const [line] = (
      await readFile(join(workspace, DEFAULT_AUDIT_LOG_PATH), "utf8")
    )
      .trim()
      .split("\n");
    const entry = AuditLogEntrySchema.parse(JSON.parse(line ?? ""));
    expect(entry.actor).toBe("unknown");
    expect(entry.actorSource).toBe("default");
  });
});
