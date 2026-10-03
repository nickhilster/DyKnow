import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DYKNOW_CONFIG_FILE_NAME, parseDyknowConfig } from "@dyknow/core";

import { runCli } from "../src/index.js";
import {
  formatRedirectNotice,
  getProtectedOutputPath,
  redirectExistingPageOutputs,
} from "../src/init-safety.js";

describe("redirectExistingPageOutputs", () => {
  const pages = [
    { id: "agent-context", outputPath: "AGENTS.md", title: "Agent" },
    { id: "architecture", outputPath: "docs/architecture.md", title: "Arch" },
  ];

  it("leaves every page alone when no output file exists", async () => {
    const result = await redirectExistingPageOutputs(pages, async () => false);

    expect(result.redirected).toEqual([]);
    expect(result.pages).toEqual(pages);
  });

  it("redirects only the pages whose output file exists", async () => {
    const result = await redirectExistingPageOutputs(
      pages,
      async (path) => path === "AGENTS.md",
    );

    expect(result.redirected).toEqual([
      {
        from: "AGENTS.md",
        pageId: "agent-context",
        to: "docs/dyknow/agent-context.md",
      },
    ]);
    expect(result.pages[0]).toEqual({
      id: "agent-context",
      outputPath: "docs/dyknow/agent-context.md",
      title: "Agent",
    });
    expect(result.pages[1]).toEqual(pages[1]);
  });

  it("does not mutate its input", async () => {
    await redirectExistingPageOutputs(pages, async () => true);

    expect(pages[0]?.outputPath).toBe("AGENTS.md");
  });

  it("does not redirect a page that already writes to DyKnow's own path", async () => {
    const own = [
      {
        id: "agent-context",
        outputPath: getProtectedOutputPath("agent-context"),
      },
    ];
    const result = await redirectExistingPageOutputs(own, async () => true);

    expect(result.redirected).toEqual([]);
    expect(result.pages).toEqual(own);
  });

  it("explains how to opt back in", () => {
    const notice = formatRedirectNotice({
      from: "AGENTS.md",
      pageId: "agent-context",
      to: "docs/dyknow/agent-context.md",
    });

    expect(notice).toContain("Kept existing AGENTS.md");
    expect(notice).toContain("docs/dyknow/agent-context.md");
    expect(notice).toContain("outputPath");
  });
});

describe("dyknow init protects existing files", () => {
  async function runInit(root: string) {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const exitCode = await runCli(["init", "--project-name", "Fixture"], {
      cwd: root,
      stdout: (message) => {
        stdout.push(message);
      },
      stderr: (message) => {
        stderr.push(message);
      },
    });
    const config = parseDyknowConfig(
      await readFile(join(root, DYKNOW_CONFIG_FILE_NAME), "utf8"),
    );
    return { config, exitCode, stderr, stdout };
  }

  function outputPathOf(
    config: { pages: readonly { id: string; outputPath: string }[] },
    pageId: string,
  ) {
    return config.pages.find((page) => page.id === pageId)?.outputPath;
  }

  it("keeps the AGENTS.md default when there is no AGENTS.md", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-init-safe-"));

    const { config, exitCode, stdout } = await runInit(root);

    expect(exitCode).toBe(0);
    expect(outputPathOf(config, "agent-context")).toBe("AGENTS.md");
    expect(stdout.join("\n")).not.toContain("Kept existing");
  });

  it("points the agent-context page away from an existing AGENTS.md", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-init-safe-"));
    const humanText =
      "# My project guidance\n\n- Run npm test before committing.\n";
    await writeFile(join(root, "AGENTS.md"), humanText, "utf8");

    const { config, exitCode, stdout } = await runInit(root);

    expect(exitCode).toBe(0);
    expect(outputPathOf(config, "agent-context")).toBe(
      "docs/dyknow/agent-context.md",
    );
    expect(stdout.join("\n")).toContain("Kept existing AGENTS.md");
    expect(await readFile(join(root, "AGENTS.md"), "utf8")).toBe(humanText);
  });

  it("protects any page whose default output file already exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-init-safe-"));
    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(join(root, "docs", "architecture.md"), "# Mine\n", "utf8");

    const { config } = await runInit(root);

    expect(outputPathOf(config, "architecture")).toBe(
      "docs/dyknow/architecture.md",
    );
    expect(outputPathOf(config, "feature-map")).toBe("docs/feature-map.md");
  });
});
