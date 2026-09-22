#!/usr/bin/env node
// Runs the README "Quick start" against a throwaway git repo so CI proves it
// works on Linux, macOS, and Windows. Requires `npm run build` first.

import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(repoRoot, "packages", "cli", "dist", "bin.js");
const mcpPath = join(repoRoot, "packages", "mcp-server", "dist", "bin.js");
const target = mkdtempSync(join(tmpdir(), "dyknow-quickstart-"));

function run(command, args) {
  return execFileSync(command, args, {
    cwd: target,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function dyknow(...args) {
  const output = run(process.execPath, [cliPath, ...args]);
  console.log(`$ dyknow ${args.join(" ")}\n  ${output.split("\n")[0]}`);
  return output;
}

async function checkMcpHandshake() {
  const child = spawn(process.execPath, [mcpPath], {
    cwd: target,
    stdio: ["pipe", "pipe", "inherit"],
  });
  let output = "";

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });

  for (const message of [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "quickstart-smoke", version: "0.0.0" },
      },
    },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
  ]) {
    child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  try {
    const deadline = Date.now() + 10_000;

    while (Date.now() < deadline) {
      const lines = output.split("\n").filter(Boolean);
      const toolsList = lines
        .map((line) => JSON.parse(line))
        .find((response) => response.id === 2);

      if (toolsList) {
        const count = toolsList.result?.tools?.length ?? 0;

        if (count === 0) {
          throw new Error("MCP tools/list returned no tools.");
        }

        console.log(
          `$ dyknow-mcp\n  initialize + tools/list OK (${count} tools)`,
        );
        return;
      }

      await new Promise((done) => setTimeout(done, 100));
    }

    throw new Error("MCP server did not answer tools/list within 10s.");
  } finally {
    // Wait for exit so Windows releases the temp dir (the child's cwd).
    if (child.exitCode === null && child.signalCode === null) {
      const exited = new Promise((done) => child.once("exit", done));
      child.kill();
      await exited;
    }
  }
}

try {
  run("git", ["init", "--quiet"]);
  run("git", ["config", "user.name", "DyKnow Quickstart"]);
  run("git", ["config", "user.email", "quickstart@example.com"]);
  writeFileSync(join(target, "README.md"), "# Demo\n\n## Install\n\nRun it.\n");
  run("git", ["add", "-A"]);
  run("git", ["commit", "--quiet", "-m", "init"]);

  dyknow("init");
  dyknow("scan");
  writeFileSync(
    join(target, "README.md"),
    "# Demo\n\n## Install\n\nRun it.\n\n## Usage\n\nNew section.\n",
  );
  run("git", ["add", "-A"]);
  run("git", ["commit", "--quiet", "-m", "docs: add usage"]);
  dyknow("diff");
  dyknow("update");

  const proposals = JSON.parse(
    readFileSync(
      join(target, "docs", "dyknow", ".state", "update-proposals.json"),
      "utf8",
    ),
  );
  const pageId = proposals.drafts[0]?.proposal.pageId;

  if (!pageId) {
    throw new Error("dyknow update produced no proposals.");
  }

  dyknow("review", "--approve", "--page", pageId);
  run("git", ["add", "-A"]);
  run("git", ["commit", "--quiet", "-m", "chore: record dyknow review"]);
  dyknow("commit");

  const head = run("git", ["log", "-1", "--pretty=%s"]);

  if (!/dyknow/iu.test(head)) {
    throw new Error(`Expected a DyKnow commit at HEAD, found "${head}".`);
  }

  await checkMcpHandshake();
  console.log("\nQuick start smoke test passed.");
} catch (error) {
  console.error(`\nQuick start smoke test failed: ${error.stderr ?? ""}`);
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  rmSync(target, { recursive: true, force: true, maxRetries: 5 });
}
