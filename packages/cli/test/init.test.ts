import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DYKNOW_CONFIG_FILE_NAME,
  DYKNOW_CONFIG_SCHEMA_FILE_NAME,
} from "@dyknow/core";

import { runCli } from "../src/index.js";

describe("dyknow init", () => {
  it("writes a config file and schema file", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-init-"));
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

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);

    const configText = await readFile(
      join(root, DYKNOW_CONFIG_FILE_NAME),
      "utf8",
    );
    const schemaText = await readFile(
      join(root, DYKNOW_CONFIG_SCHEMA_FILE_NAME),
      "utf8",
    );
    const config = JSON.parse(configText) as {
      cloud?: Record<string, unknown>;
      projectName: string;
      mode: string;
    };
    const schema = JSON.parse(schemaText) as { title: string };

    expect(stdout[0]).toContain(DYKNOW_CONFIG_FILE_NAME);
    expect(config.projectName).toBe("Fixture");
    expect(config.mode).toBe("local-only");
    expect(config.cloud).toEqual({});
    expect(schema.title).toBe("DyKnow Config");
  });

  it("refuses to overwrite existing config artifacts without --force", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-init-"));
    const stderr: string[] = [];

    await runCli(["init"], { cwd: root });

    const exitCode = await runCli(["init"], {
      cwd: root,
      stderr: (message) => {
        stderr.push(message);
      },
    });

    expect(exitCode).toBe(1);
    expect(stderr[0]).toContain("--force");
  });

  it("supports an interactive init flow with detected stack defaults", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-init-"));
    const prompts: string[] = [];

    await mkdir(join(root, "app", "blog"), { recursive: true });
    await writeFile(
      join(root, "package.json"),
      JSON.stringify(
        {
          name: "fixture",
          dependencies: {
            next: "^16.0.0",
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const answers = ["Fixture App", "connected", ""];
    const exitCode = await runCli(["init", "--interactive"], {
      cwd: root,
      prompt: async (message) => {
        prompts.push(message);
        return answers.shift() ?? "";
      },
    });

    const configText = await readFile(
      join(root, DYKNOW_CONFIG_FILE_NAME),
      "utf8",
    );
    const config = JSON.parse(configText) as {
      cloud?: Record<string, unknown>;
      projectName: string;
      mode: string;
      allowedSources: string[];
    };

    expect(exitCode).toBe(0);
    expect(prompts).toHaveLength(3);
    expect(config.projectName).toBe("Fixture App");
    expect(config.mode).toBe("connected");
    expect(config.cloud).toEqual({});
    expect(config.allowedSources).toContain("app/**");
    expect(config.allowedSources).toContain("next.config.*");
  });
});
