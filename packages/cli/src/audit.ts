import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { promisify } from "node:util";

import { AuditLogEntrySchema } from "@dyknow/core";

export const DEFAULT_AUDIT_LOG_PATH = "docs/dyknow/.state/audit-log.jsonl";
export const DEFAULT_RUNTIME_AUDIT_LOG_PATH = "dyknow/runtime-audit-log.jsonl";

const execFileAsync = promisify(execFile);

function toPortablePath(path: string): string {
  return path.replaceAll("\\", "/");
}

export function formatRelativePath(
  rootPath: string,
  targetPath: string,
): string {
  return toPortablePath(relative(rootPath, targetPath) || targetPath);
}

export function getAuditActor(): string {
  return process.env.DYKNOW_ACTOR ?? "copilot";
}

export async function resolveRuntimeAuditPath(rootPath: string) {
  try {
    const result = await execFileAsync(
      "git",
      ["rev-parse", "--git-path", DEFAULT_RUNTIME_AUDIT_LOG_PATH],
      {
        cwd: rootPath,
        encoding: "utf8",
      },
    );

    return resolve(rootPath, result.stdout.trim());
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
  const auditPath = resolve(
    options.rootPath,
    options.auditPath ?? DEFAULT_AUDIT_LOG_PATH,
  );
  const timestamp = new Date().toISOString();
  const actor = getAuditActor();
  const auditEntries = options.entries.map((entry) => {
    const sourcesRead = [...new Set(entry.sourcesRead)];
    const outputsAffected = [...new Set(entry.outputsAffected)];
    const hashInput = JSON.stringify({
      action: options.action,
      actor,
      outputsAffected,
      sourcesRead,
      timestamp,
    });

    return AuditLogEntrySchema.parse({
      action: options.action,
      actor,
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
