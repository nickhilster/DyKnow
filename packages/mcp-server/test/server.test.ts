import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { PassThrough } from "node:stream";
import { promisify } from "node:util";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_COMMIT_MESSAGE,
  DEFAULT_PR_BASE_BRANCH,
  DEFAULT_PR_TITLE,
  DEFAULT_REPO_DIFF_OUTPUT_PATH,
  DEFAULT_REPO_MAP_OUTPUT_PATH,
  DEFAULT_STATUS_OUTPUT_PATH,
  DEFAULT_UPDATE_OUTPUT_PATH,
  createToolDefinitions,
  handleJsonRpcRequest,
  parseMessages,
  startStdioServer,
} from "../src/server.js";

const execFileAsync = promisify(execFile);
const originalPath = process.env.PATH ?? "";
const originalGhCommand = process.env.DYKNOW_GH_COMMAND;

async function runGit(cwd: string, args: readonly string[]) {
  const result = await execFileAsync("git", [...args], {
    cwd,
    encoding: "utf8",
  });

  return result.stdout.trim();
}

async function writeFakeGhCommand(tools: string) {
  const commandPath = join(tools, "gh.mjs");

  await writeFile(
    commandPath,
    ['console.log("https://github.com/example/DyKnow/pull/101");'].join("\n"),
    "utf8",
  );

  return commandPath;
}

afterEach(() => {
  process.env.PATH = originalPath;

  if (originalGhCommand === undefined) {
    process.env.DYKNOW_GH_COMMAND = undefined;
  } else {
    process.env.DYKNOW_GH_COMMAND = originalGhCommand;
  }
});

describe("@dyknow/mcp-server", () => {
  it("lists the read-only tool surface", () => {
    expect(createToolDefinitions().map((tool) => tool.name)).toEqual([
      "dyknow_scan",
      "dyknow_diff",
      "dyknow_update",
      "dyknow_list_proposals",
      "dyknow_get_proposal",
      "dyknow_review_proposal",
      "dyknow_log",
      "dyknow_status",
      "dyknow_commit",
      "dyknow_open_pr",
    ]);
  });

  it("handles initialize and tools/list requests", async () => {
    const initializeResponse = await handleJsonRpcRequest(
      {
        id: 1,
        method: "initialize",
      },
      { cwd: process.cwd() },
    );
    const listResponse = await handleJsonRpcRequest(
      {
        id: 2,
        method: "tools/list",
      },
      { cwd: process.cwd() },
    );

    expect(initializeResponse?.result).toMatchObject({
      protocolVersion: "2024-11-05",
      serverInfo: {
        name: "dyknow-mcp",
      },
    });
    expect(listResponse?.result).toMatchObject({
      tools: expect.arrayContaining([
        expect.objectContaining({ name: "dyknow_scan" }),
        expect.objectContaining({ name: "dyknow_diff" }),
      ]),
    });
  });

  it("parses newline-delimited messages, the MCP stdio default", () => {
    const first = parseMessages(
      '{"jsonrpc":"2.0","id":1,"method":"initialize"}\n\n{"jsonrpc":"2.0","id":2,',
    );

    expect(first.messages).toEqual([
      {
        request: { jsonrpc: "2.0", id: 1, method: "initialize" },
        framing: "newline",
      },
    ]);
    expect(first.remainder).toBe('{"jsonrpc":"2.0","id":2,');

    const second = parseMessages(`${first.remainder}"method":"tools/list"}\n`);

    expect(second.messages.map((message) => message.request.id)).toEqual([2]);
    expect(second.remainder).toBe("");
  });

  it("still parses Content-Length framed messages", () => {
    const body = '{"jsonrpc":"2.0","id":7,"method":"tools/list"}';
    const parsed = parseMessages(
      `Content-Length: ${body.length}\r\n\r\n${body}Content-Len`,
    );

    expect(parsed.messages).toEqual([
      {
        request: { jsonrpc: "2.0", id: 7, method: "tools/list" },
        framing: "content-length",
      },
    ]);
    expect(parsed.remainder).toBe("Content-Len");
  });

  it("parses Content-Length frames when another header comes first", () => {
    const body = '{"jsonrpc":"2.0","id":8,"method":"tools/list"}';
    const parsed = parseMessages(
      `Content-Type: application/vscode-jsonrpc; charset=utf-8\r\nContent-Length: ${body.length}\r\n\r\n${body}`,
    );

    expect(parsed.messages).toEqual([
      {
        request: { jsonrpc: "2.0", id: 8, method: "tools/list" },
        framing: "content-length",
      },
    ]);
    expect(parsed.remainder).toBe("");
  });

  it("waits for the rest of a header block that has not arrived yet", () => {
    const parsed = parseMessages("Content-Type: application/json\r\n");

    expect(parsed.messages).toEqual([]);
    expect(parsed.remainder).toBe("Content-Type: application/json\r\n");
  });

  it("answers each request over stdio in the framing it arrived in", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    let written = "";

    output.setEncoding("utf8");
    output.on("data", (chunk: string) => {
      written += chunk;
    });
    startStdioServer({ cwd: process.cwd() }, { input, output });

    input.write(
      [
        '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}',
        '{"jsonrpc":"2.0","method":"notifications/initialized"}',
        "",
      ].join("\n"),
    );

    await vi.waitFor(() => {
      expect(written.endsWith("\n")).toBe(true);
    });

    expect(JSON.parse(written)).toMatchObject({
      id: 1,
      result: { serverInfo: { name: "dyknow-mcp" } },
    });

    const lspBody = '{"jsonrpc":"2.0","id":2,"method":"tools/list"}';
    written = "";
    input.write(`Content-Length: ${lspBody.length}\r\n\r\n${lspBody}`);

    await vi.waitFor(() => {
      expect(written).toContain('"id":2');
    });

    expect(written).toMatch(
      /^Content-Length: \d+\r\n\r\n\{"jsonrpc":"2.0","id":2,/u,
    );
  });

  it("runs scan, diff, update, and status through tools/call", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-mcp-"));

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
          ignoredSources: [
            ".env",
            ".env.*",
            "secrets/**",
            "node_modules/**",
            "dist/**",
            "coverage/**",
            "logs/**",
          ],
          pages: [
            {
              id: "product-overview",
              title: "Product Overview",
              outputPath: "docs/product-overview.md",
              audience: "mixed",
              sources: ["README.md"],
              reviewRules: {
                approvalRequired: true,
              },
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
    await writeFile(join(root, "dyknow.config.schema.json"), "{}\n", "utf8");

    await runGit(root, ["init"]);
    await runGit(root, ["config", "user.name", "DyKnow Test"]);
    await runGit(root, ["config", "user.email", "dyknow@example.com"]);
    await runGit(root, ["branch", "-M", "main"]);
    await runGit(root, ["add", "."]);
    await runGit(root, ["commit", "-m", "chore: fixture"]);

    const scanResponse = await handleJsonRpcRequest(
      {
        id: 1,
        method: "tools/call",
        params: {
          name: "dyknow_scan",
        },
      },
      { cwd: root },
    );

    await writeFile(
      join(root, "README.md"),
      "# Fixture\n\nChanged again.\n",
      "utf8",
    );

    const diffResponse = await handleJsonRpcRequest(
      {
        id: 2,
        method: "tools/call",
        params: {
          name: "dyknow_diff",
        },
      },
      { cwd: root },
    );
    const updateResponse = await handleJsonRpcRequest(
      {
        id: 3,
        method: "tools/call",
        params: {
          name: "dyknow_update",
        },
      },
      { cwd: root },
    );
    const listResponse = await handleJsonRpcRequest(
      {
        id: 4,
        method: "tools/call",
        params: {
          name: "dyknow_list_proposals",
          arguments: {
            states: ["Needs review"],
          },
        },
      },
      { cwd: root },
    );
    const getResponse = await handleJsonRpcRequest(
      {
        id: 5,
        method: "tools/call",
        params: {
          name: "dyknow_get_proposal",
          arguments: {
            pageId: "product-overview",
          },
        },
      },
      { cwd: root },
    );
    const statusResponse = await handleJsonRpcRequest(
      {
        id: 6,
        method: "tools/call",
        params: {
          name: "dyknow_status",
        },
      },
      { cwd: root },
    );

    expect(scanResponse?.result).toMatchObject({
      structuredContent: {
        outputPath: DEFAULT_REPO_MAP_OUTPUT_PATH,
      },
    });
    expect(diffResponse?.result).toMatchObject({
      structuredContent: {
        outputPath: DEFAULT_REPO_DIFF_OUTPUT_PATH,
      },
    });
    expect(updateResponse?.result).toMatchObject({
      structuredContent: {
        outputPath: DEFAULT_UPDATE_OUTPUT_PATH,
        summary: {
          affectedPages: 1,
          draftedProposals: 1,
        },
      },
    });
    expect(listResponse?.result).toMatchObject({
      structuredContent: {
        inputPath: DEFAULT_UPDATE_OUTPUT_PATH,
        summary: {
          total: 1,
          matching: 1,
        },
        proposals: [
          expect.objectContaining({
            pageId: "product-overview",
            reviewState: "Needs review",
          }),
        ],
      },
    });
    expect(getResponse?.result).toMatchObject({
      structuredContent: {
        inputPath: DEFAULT_UPDATE_OUTPUT_PATH,
        proposal: expect.objectContaining({
          pageId: "product-overview",
          reviewState: "Needs review",
        }),
        affectedPage: expect.objectContaining({
          outputPath: "docs/product-overview.md",
        }),
      },
    });
    expect(statusResponse?.result).toMatchObject({
      structuredContent: {
        outputPath: DEFAULT_STATUS_OUTPUT_PATH,
      },
    });

    expect(
      JSON.parse(
        await readFile(join(root, DEFAULT_REPO_MAP_OUTPUT_PATH), "utf8"),
      ).files.length,
    ).toBeGreaterThan(0);
    expect(
      JSON.parse(
        await readFile(join(root, DEFAULT_REPO_DIFF_OUTPUT_PATH), "utf8"),
      ).affectedPages,
    ).toHaveLength(1);
    expect(
      JSON.parse(await readFile(join(root, DEFAULT_UPDATE_OUTPUT_PATH), "utf8"))
        .drafts,
    ).toHaveLength(1);
    expect(
      await readFile(join(root, DEFAULT_STATUS_OUTPUT_PATH), "utf8"),
    ).toContain("DyKnow Progress and Status Report");
  });

  it("reviews and commits an approved proposal through tools/call", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-mcp-commit-"));

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(
      join(root, "docs", "product-overview.md"),
      "# Product Overview\n\nOld content.\n",
      "utf8",
    );
    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
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
              reviewRules: {
                approvalRequired: true,
              },
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
    await runGit(root, ["init"]);
    await runGit(root, ["config", "user.name", "DyKnow Test"]);
    await runGit(root, ["config", "user.email", "dyknow@example.com"]);
    await runGit(root, ["branch", "-M", "main"]);
    await runGit(root, ["add", "."]);
    await runGit(root, ["commit", "-m", "chore: fixture"]);
    await writeFile(
      join(root, DEFAULT_UPDATE_OUTPUT_PATH),
      `${JSON.stringify(
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
                summary: "Summary",
                why: "Why",
                sources: ["README.md"],
                proposedText: "# Product Overview\n\nApproved content.",
                confidence: "low",
                risk: "medium",
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

    const reviewResponse = await handleJsonRpcRequest(
      {
        id: 1,
        method: "tools/call",
        params: {
          name: "dyknow_review_proposal",
          arguments: {
            pageId: "product-overview",
            decision: "Approved",
          },
        },
      },
      { cwd: root },
    );
    const commitResponse = await handleJsonRpcRequest(
      {
        id: 2,
        method: "tools/call",
        params: {
          name: "dyknow_commit",
        },
      },
      { cwd: root },
    );

    expect(reviewResponse?.result).toMatchObject({
      structuredContent: {
        decision: "Approved",
        updatedProposals: 1,
      },
    });
    expect(commitResponse?.result).toMatchObject({
      structuredContent: {
        inputPath: DEFAULT_UPDATE_OUTPUT_PATH,
        publishedProposals: 1,
      },
    });
    expect(
      await readFile(join(root, "docs", "product-overview.md"), "utf8"),
    ).toContain("Approved content.");
    expect(
      JSON.parse(await readFile(join(root, DEFAULT_UPDATE_OUTPUT_PATH), "utf8"))
        .drafts[0].proposal.reviewState,
    ).toBe("Published");
    expect(await runGit(root, ["log", "-1", "--pretty=%s"])).toBe(
      DEFAULT_COMMIT_MESSAGE,
    );
  });

  it("reads committed and runtime audit logs through tools/call", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-mcp-log-"));

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
    await runGit(root, ["init"]);
    await runGit(root, ["config", "user.name", "DyKnow Test"]);
    await runGit(root, ["config", "user.email", "dyknow@example.com"]);
    await runGit(root, ["branch", "-M", "main"]);
    await runGit(root, ["add", "."]);
    await runGit(root, ["commit", "-m", "chore: fixture"]);

    await writeFile(
      join(root, "docs", "dyknow", ".state", "audit-log.jsonl"),
      [
        JSON.stringify({
          action: "review:approve",
          actor: "copilot",
          sourcesRead: ["README.md"],
          outputsAffected: ["docs/product-overview.md"],
          timestamp: "2026-06-26T10:00:00.000Z",
          hash: "a1b2c3d4",
        }),
      ].join("\n"),
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
      [
        JSON.stringify({
          action: "publish:pr-opened",
          actor: "copilot",
          sourcesRead: ["README.md"],
          outputsAffected: [
            "github-pr:https://github.com/example/DyKnow/pull/101",
          ],
          timestamp: "2026-06-26T11:00:00.000Z",
          hash: "deadbeef",
        }),
      ].join("\n"),
      "utf8",
    );

    const logResponse = await handleJsonRpcRequest(
      {
        id: 1,
        method: "tools/call",
        params: {
          name: "dyknow_log",
          arguments: {
            source: "all",
            action: "all",
            limit: 10,
          },
        },
      },
      { cwd: root },
    );
    const publishOnlyResponse = await handleJsonRpcRequest(
      {
        id: 2,
        method: "tools/call",
        params: {
          name: "dyknow_log",
          arguments: {
            source: "runtime",
            action: "publish",
            limit: 10,
          },
        },
      },
      { cwd: root },
    );

    expect(logResponse?.result).toMatchObject({
      structuredContent: {
        inputPath: "docs/dyknow/.state/audit-log.jsonl",
        shownEntries: 2,
        totalEntries: 2,
        report: expect.stringContaining("publish:pr-opened"),
      },
    });
    expect(logResponse?.result).toMatchObject({
      structuredContent: {
        report: expect.stringContaining("review:approve"),
      },
    });
    expect(publishOnlyResponse?.result).toMatchObject({
      structuredContent: {
        shownEntries: 1,
        totalEntries: 1,
        report: expect.stringContaining("publish:pr-opened"),
      },
    });
  });

  it("opens a PR through tools/call", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-mcp-pr-"));
    const remote = await mkdtemp(join(tmpdir(), "dyknow-mcp-pr-remote-"));
    const tools = await mkdtemp(join(tmpdir(), "dyknow-mcp-pr-tools-"));

    await mkdir(join(root, "docs", "dyknow", ".state"), { recursive: true });
    await writeFile(
      join(root, "docs", "product-overview.md"),
      "# Product Overview\n\nOld content.\n",
      "utf8",
    );
    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
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
              reviewRules: {
                approvalRequired: true,
              },
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
    await runGit(root, ["init"]);
    await runGit(root, ["config", "user.name", "DyKnow Test"]);
    await runGit(root, ["config", "user.email", "dyknow@example.com"]);
    await runGit(root, ["branch", "-M", "main"]);
    await runGit(remote, ["init", "--bare"]);
    await runGit(root, ["remote", "add", "origin", remote]);
    await runGit(root, ["add", "."]);
    await runGit(root, ["commit", "-m", "chore: fixture"]);
    await runGit(root, ["push", "--set-upstream", "origin", "main"]);
    await writeFile(
      join(root, DEFAULT_UPDATE_OUTPUT_PATH),
      `${JSON.stringify(
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
                summary: "Summary",
                why: "Why",
                sources: ["README.md"],
                proposedText: "# Product Overview\n\nApproved content.",
                confidence: "low",
                risk: "medium",
                reviewState: "Approved",
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
    const fakeGhCommand = await writeFakeGhCommand(tools);
    process.env.PATH = `${tools};${originalPath}`;
    process.env.DYKNOW_GH_COMMAND = `node ${fakeGhCommand}`;

    const prResponse = await handleJsonRpcRequest(
      {
        id: 1,
        method: "tools/call",
        params: {
          name: "dyknow_open_pr",
          arguments: {
            base: DEFAULT_PR_BASE_BRANCH,
            branch: "dyknow/mcp-test-pr",
            message: DEFAULT_COMMIT_MESSAGE,
            title: DEFAULT_PR_TITLE,
          },
        },
      },
      { cwd: root },
    );

    expect(prResponse?.result).toMatchObject({
      structuredContent: {
        base: DEFAULT_PR_BASE_BRANCH,
        branch: "dyknow/mcp-test-pr",
        publishedProposals: 1,
        url: "https://github.com/example/DyKnow/pull/101",
      },
    });
    expect(await runGit(root, ["branch", "--show-current"])).toBe(
      "dyknow/mcp-test-pr",
    );
    expect(
      await runGit(remote, [
        "for-each-ref",
        "--format=%(refname:short)",
        "refs/heads",
      ]),
    ).toContain("dyknow/mcp-test-pr");
  }, 20000);
});
