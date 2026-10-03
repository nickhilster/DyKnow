import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, mkdir, realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

import { AuditLogEntrySchema } from "@dyknow/core";

import {
  formatRelativePath,
  isPathInsideDirectory,
  resolveWorkspacePath,
} from "./security.js";

export const DEFAULT_AUDIT_LOG_PATH = "docs/dyknow/.state/audit-log.jsonl";
export const DEFAULT_RUNTIME_AUDIT_LOG_PATH = "dyknow/runtime-audit-log.jsonl";

const execFileAsync = promisify(execFile);

export type AuditActor = {
  actor: string;
  source: "env" | "git" | "default";
};

async function readGitConfig(rootPath: string, key: string) {
  try {
    const { stdout } = await execFileAsync("git", ["config", "--get", key], {
      cwd: rootPath,
      encoding: "utf8",
    });
    return stdout.trim();
  } catch {
    return "";
  }
}

/**
 * Identify who is acting, for audit entries. A declared `DYKNOW_ACTOR` wins;
 * otherwise the repository's git identity; otherwise "unknown". The fallback
 * is never a made-up name, so an audit entry cannot attribute an action to
 * someone who did not take it.
 */
export async function resolveAuditActor(rootPath: string): Promise<AuditActor> {
  const declared = process.env.DYKNOW_ACTOR?.trim();
  if (declared) {
    return { actor: declared, source: "env" };
  }

  const [name, email] = await Promise.all([
    readGitConfig(rootPath, "user.name"),
    readGitConfig(rootPath, "user.email"),
  ]);
  if (name && email) {
    return { actor: `${name} <${email}>`, source: "git" };
  }
  if (name || email) {
    return { actor: name || email, source: "git" };
  }

  return { actor: "unknown", source: "default" };
}

export async function resolveRuntimeAuditPath(rootPath: string) {
  try {
    const [gitDirResult, gitPathResult] = await Promise.all([
      execFileAsync("git", ["rev-parse", "--absolute-git-dir"], {
        cwd: rootPath,
        encoding: "utf8",
      }),
      execFileAsync(
        "git",
        ["rev-parse", "--git-path", DEFAULT_RUNTIME_AUDIT_LOG_PATH],
        {
          cwd: rootPath,
          encoding: "utf8",
        },
      ),
    ]);
    const gitPath = gitPathResult.stdout.trim();
    // git reports canonical paths, so compare canonical forms. Otherwise a
    // symlinked root (macOS /var -> /private/var) or a Windows 8.3 short
    // name looks like an escape and the runtime log is silently dropped.
    const [realRootPath, realGitDir] = await Promise.all([
      realpath(rootPath),
      realpath(resolve(rootPath, gitDirResult.stdout.trim())),
    ]);

    if (!isPathInsideDirectory(realGitDir, resolve(realRootPath, gitPath))) {
      throw new Error("Runtime audit log path escaped the git directory.");
    }

    return resolve(rootPath, gitPath);
  } catch {
    return undefined;
  }
}

export async function appendAuditEntries(options: {
  action: string;
  auditPath?: string;
  entries: readonly {
    outputsAffected: readonly string[];
    sourcesRead: readonly string[];
  }[];
  rootPath: string;
}) {
  const auditPath = options.auditPath
    ? resolve(options.rootPath, options.auditPath)
    : await resolveWorkspacePath(
        options.rootPath,
        DEFAULT_AUDIT_LOG_PATH,
        "Audit log path",
      );
  const timestamp = new Date().toISOString();
  const { actor, source: actorSource } = await resolveAuditActor(
    options.rootPath,
  );
  const auditEntries = options.entries.map((entry) => {
    const sourcesRead = [...new Set(entry.sourcesRead)];
    const outputsAffected = [...new Set(entry.outputsAffected)];
    const hashInput = JSON.stringify({
      action: options.action,
      actor,
      actorSource,
      outputsAffected,
      sourcesRead,
      timestamp,
    });

    return AuditLogEntrySchema.parse({
      action: options.action,
      actor,
      actorSource,
      sourcesRead,
      outputsAffected,
      timestamp,
      hash: createHash("sha256").update(hashInput).digest("hex"),
    });
  });

  await mkdir(dirname(auditPath), { recursive: true });
  await appendFile(
    auditPath,
    auditEntries.map((entry) => `${JSON.stringify(entry)}\n`).join(""),
    "utf8",
  );
}

export { formatRelativePath };
