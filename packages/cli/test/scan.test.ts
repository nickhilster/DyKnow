import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_REPO_MAP_OUTPUT_PATH, RepoMapSchema } from "@dyknow/core";

import { runCli } from "../src/index.js";

describe("dyknow scan", () => {
  it("scans the configured workspace and writes a repo map", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-scan-"));
    const secretName = ["to", "ken"].join("");
    const secretValue = ["ghp", "123456789012345678901234567890123456"].join(
      "_",
    );

    await mkdir(join(root, "docs"), { recursive: true });
    await mkdir(join(root, "packages", "app", "src", "routes"), {
      recursive: true,
    });

    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
    await writeFile(
      join(root, "package.json"),
      JSON.stringify(
        {
          name: "fixture",
          dependencies: {
            zod: "^3.24.4",
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      join(root, "packages", "app", "src", "routes", "users.ts"),
      `export const ${secretName} = "${secretValue}";\n`,
      "utf8",
    );

    await runCli(["init", "--project-name", "Fixture"], { cwd: root });

    const exitCode = await runCli(["scan"], { cwd: root });
    const repoMapText = await readFile(
      join(root, DEFAULT_REPO_MAP_OUTPUT_PATH),
      "utf8",
    );
    const repoMap = RepoMapSchema.parse(JSON.parse(repoMapText));

    expect(exitCode).toBe(0);
    expect(repoMap.files.some((file) => file.path === "README.md")).toBe(true);
    expect(
      repoMap.files.some((file) =>
        file.dependencies.some((dependency) => dependency.name === "zod"),
      ),
    ).toBe(true);
    expect(repoMap.warnings).toHaveLength(1);
    expect(repoMap.warnings[0]?.code).toBe("secret-pattern");
  });

  it("warns on risky dependency specifiers and broader secret patterns", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-scan-"));
    const connectionScheme = ["post", "gres"].join("");
    const connectionValue = `${connectionScheme}://admin:supersecret@db.example.com/app`;

    await mkdir(join(root, "docs"), { recursive: true });
    await mkdir(join(root, "packages", "app", "src"), {
      recursive: true,
    });

    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
    await writeFile(
      join(root, "package.json"),
      JSON.stringify(
        {
          name: "fixture",
          dependencies: {
            localpkg: "file:../localpkg",
            "left-pad": "latest",
            zod: "github:colinhacks/zod",
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      join(root, "packages", "app", "src", "secrets.ts"),
      `export const databaseUrl = "${connectionValue}";\n`,
      "utf8",
    );

    await runCli(["init", "--project-name", "Fixture"], { cwd: root });

    const exitCode = await runCli(["scan"], { cwd: root });
    const repoMapText = await readFile(
      join(root, DEFAULT_REPO_MAP_OUTPUT_PATH),
      "utf8",
    );
    const repoMap = RepoMapSchema.parse(JSON.parse(repoMapText));

    expect(exitCode).toBe(0);
    expect(
      repoMap.warnings.some(
        (warning) =>
          warning.code === "dependency-policy" &&
          warning.path === "package.json" &&
          warning.message.includes("localpkg") &&
          warning.message.includes("file:../localpkg"),
      ),
    ).toBe(true);
    expect(
      repoMap.warnings.some(
        (warning) =>
          warning.code === "dependency-policy" &&
          warning.path === "package.json" &&
          warning.message.includes("left-pad") &&
          warning.message.includes('"latest"'),
      ),
    ).toBe(true);
    expect(
      repoMap.warnings.some(
        (warning) =>
          warning.code === "dependency-policy" &&
          warning.path === "package.json" &&
          warning.message.includes("zod") &&
          warning.message.includes("github:colinhacks/zod"),
      ),
    ).toBe(true);
    expect(
      repoMap.warnings.some(
        (warning) =>
          warning.code === "secret-pattern" &&
          warning.path === "packages/app/src/secrets.ts" &&
          warning.message.includes("connection-string"),
      ),
    ).toBe(true);
  });

  it("applies dependency allow and deny rules and can fail on configured warning codes", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-scan-"));
    const tokenValue = ["ghp", "123456789012345678901234567890123456"].join(
      "_",
    );
    const stdout: string[] = [];
    const stderr: string[] = [];

    await mkdir(join(root, "docs"), { recursive: true });
    await mkdir(join(root, "packages", "app", "src"), {
      recursive: true,
    });

    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
    await writeFile(
      join(root, "package.json"),
      JSON.stringify(
        {
          name: "fixture",
          dependencies: {
            "@dyknow/core": "file:../core",
            zod: "github:colinhacks/zod",
            "left-pad": "latest",
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      join(root, "packages", "app", "src", "secrets.ts"),
      `export const fixtureValue = "${tokenValue}";\n`,
      "utf8",
    );

    await runCli(["init", "--project-name", "Fixture"], { cwd: root });

    await writeFile(
      join(root, "dyknow.config.json"),
      JSON.stringify(
        {
          $schema: "./dyknow.config.schema.json",
          projectName: "Fixture",
          mode: "local-only",
          allowedSources: [
            "README.md",
            "docs/**",
            "packages/**",
            "package.json",
          ],
          ignoredSources: [],
          pages: [
            {
              id: "agent-context",
              title: "AI Agent Context",
              outputPath: "AGENTS.md",
              audience: "agent",
              sources: ["README.md", "docs/**", "packages/**"],
              reviewRules: {
                approvalRequired: true,
              },
            },
          ],
          approvalRequired: true,
          llmProvider: "local",
          publishTargets: [],
          dependencyPolicy: {
            allow: ["@dyknow/core", "zod"],
            deny: ["left-pad"],
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const exitCode = await runCli(
      ["scan", "--fail-on", "secret-pattern", "--fail-on", "dependency-policy"],
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
    const repoMapText = await readFile(
      join(root, DEFAULT_REPO_MAP_OUTPUT_PATH),
      "utf8",
    );
    const repoMap = RepoMapSchema.parse(JSON.parse(repoMapText));

    expect(exitCode).toBe(1);
    expect(stdout[0]).toContain("with 2 warning(s)");
    expect(stderr[0]).toContain("Blocking warnings");
    expect(
      repoMap.warnings.some(
        (warning) =>
          warning.code === "dependency-policy" &&
          warning.message.includes('"left-pad"') &&
          warning.message.includes("dependencyPolicy.deny"),
      ),
    ).toBe(true);
    expect(
      repoMap.warnings.some(
        (warning) =>
          warning.code === "dependency-policy" &&
          warning.message.includes("@dyknow/core") &&
          warning.message.includes("file:../core"),
      ),
    ).toBe(false);
    expect(
      repoMap.warnings.some(
        (warning) =>
          warning.code === "dependency-policy" &&
          warning.message.includes('"left-pad"') &&
          warning.message.includes("dependencyPolicy.deny"),
      ),
    ).toBe(true);
    expect(
      repoMap.warnings.some(
        (warning) =>
          warning.code === "dependency-policy" &&
          warning.message.includes("github:colinhacks/zod"),
      ),
    ).toBe(false);
    expect(
      repoMap.warnings.some(
        (warning) =>
          warning.code === "secret-pattern" &&
          warning.path === "packages/app/src/secrets.ts",
      ),
    ).toBe(true);
  });

  it("can fail on package manifest parse errors when configured", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-scan-"));
    const stdout: string[] = [];
    const stderr: string[] = [];

    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
    await writeFile(
      join(root, "package.json"),
      '{"name":"fixture","dependencies":{"zod":"^3.24.4"',
      "utf8",
    );

    await runCli(["init", "--project-name", "Fixture"], { cwd: root });

    const exitCode = await runCli(["scan", "--fail-on", "parse-error"], {
      cwd: root,
      stdout: (message) => {
        stdout.push(message);
      },
      stderr: (message) => {
        stderr.push(message);
      },
    });
    const repoMapText = await readFile(
      join(root, DEFAULT_REPO_MAP_OUTPUT_PATH),
      "utf8",
    );
    const repoMap = RepoMapSchema.parse(JSON.parse(repoMapText));

    expect(exitCode).toBe(1);
    expect(stdout[0]).toContain("with 1 warning(s)");
    expect(stderr[0]).toContain("1 parse-error");
    expect(repoMap.warnings).toEqual([
      expect.objectContaining({
        code: "parse-error",
        path: "package.json",
      }),
    ]);
  });

  it("extracts route metadata for Next.js and Express-style handlers", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-scan-"));

    await mkdir(join(root, "app", "blog", "[slug]"), { recursive: true });
    await mkdir(join(root, "src", "pages", "api", "users"), {
      recursive: true,
    });
    await mkdir(join(root, "src", "routes"), { recursive: true });

    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
    await writeFile(
      join(root, "package.json"),
      JSON.stringify(
        {
          name: "fixture",
          dependencies: {
            next: "^16.0.0",
            express: "^5.0.0",
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      join(root, "app", "blog", "[slug]", "page.tsx"),
      "export default function Page() { return null; }\n",
      "utf8",
    );
    await writeFile(
      join(root, "src", "pages", "api", "users", "index.ts"),
      "export default function handler() { return null; }\n",
      "utf8",
    );
    await writeFile(
      join(root, "src", "routes", "users.ts"),
      [
        'router.get("/users", listUsers);',
        'router.post("/users", createUser);',
      ].join("\n"),
      "utf8",
    );

    await runCli(["init", "--project-name", "Fixture"], { cwd: root });

    const exitCode = await runCli(["scan"], { cwd: root });
    const repoMapText = await readFile(
      join(root, DEFAULT_REPO_MAP_OUTPUT_PATH),
      "utf8",
    );
    const repoMap = RepoMapSchema.parse(JSON.parse(repoMapText));
    const nextPageFile = repoMap.files.find(
      (file) => file.path === "app/blog/[slug]/page.tsx",
    );
    const nextApiFile = repoMap.files.find(
      (file) => file.path === "src/pages/api/users/index.ts",
    );
    const expressRouteFile = repoMap.files.find(
      (file) => file.path === "src/routes/users.ts",
    );

    expect(exitCode).toBe(0);
    expect(nextPageFile?.routes).toEqual([
      expect.objectContaining({
        framework: "nextjs-app",
        kind: "page",
        path: "/blog/:slug",
      }),
    ]);
    expect(nextApiFile?.routes).toEqual([
      expect.objectContaining({
        framework: "nextjs-pages",
        kind: "api",
        path: "/users",
        methods: ["ANY"],
      }),
    ]);
    expect(expressRouteFile?.routes).toEqual([
      expect.objectContaining({
        framework: "express",
        kind: "api",
        path: "/users",
        methods: ["GET", "POST"],
      }),
    ]);
  });

  it("extracts Python dependency manifests from pyproject and requirements files", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-scan-"));

    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "README.md"), "# Fixture\n", "utf8");
    await writeFile(
      join(root, "pyproject.toml"),
      [
        '[project]',
        'dependencies = ["fastapi>=0.115", "pydantic>=2.0"]',
        "",
        "[tool.poetry.group.dev.dependencies]",
        'pytest = "^8.3.0"',
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      join(root, "requirements-dev.txt"),
      ["ruff>=0.6", "mypy>=1.10"].join("\n"),
      "utf8",
    );

    await runCli(["init", "--project-name", "Fixture"], { cwd: root });

    const exitCode = await runCli(["scan"], { cwd: root });
    const repoMapText = await readFile(
      join(root, DEFAULT_REPO_MAP_OUTPUT_PATH),
      "utf8",
    );
    const repoMap = RepoMapSchema.parse(JSON.parse(repoMapText));
    const pyprojectFile = repoMap.files.find(
      (file) => file.path === "pyproject.toml",
    );
    const requirementsFile = repoMap.files.find(
      (file) => file.path === "requirements-dev.txt",
    );

    expect(exitCode).toBe(0);
    expect(pyprojectFile?.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "fastapi",
          section: "dependencies",
          version: ">=0.115",
        }),
        expect.objectContaining({
          name: "pytest",
          section: "devDependencies",
        }),
      ]),
    );
    expect(requirementsFile?.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "ruff",
          section: "devDependencies",
          version: ">=0.6",
        }),
      ]),
    );
  });

  it("extracts markdown headings and OpenAPI routes from source documents", async () => {
    const root = await mkdtemp(join(tmpdir(), "dyknow-scan-"));

    await mkdir(join(root, "docs"), { recursive: true });
    await mkdir(join(root, "docs", "api"), { recursive: true });
    await writeFile(
      join(root, "README.md"),
      ["# Fixture", "", "## Overview", "", "### CLI"].join("\n"),
      "utf8",
    );
    await writeFile(
      join(root, "docs", "api", "openapi.yaml"),
      [
        "openapi: 3.1.0",
        "info:",
        "  title: Fixture API",
        "paths:",
        "  /users:",
        "    get:",
        "      summary: List users",
        "    post:",
        "      summary: Create user",
      ].join("\n"),
      "utf8",
    );

    await runCli(["init", "--project-name", "Fixture"], { cwd: root });

    const exitCode = await runCli(["scan"], { cwd: root });
    const repoMapText = await readFile(
      join(root, DEFAULT_REPO_MAP_OUTPUT_PATH),
      "utf8",
    );
    const repoMap = RepoMapSchema.parse(JSON.parse(repoMapText));
    const readmeFile = repoMap.files.find((file) => file.path === "README.md");
    const openApiFile = repoMap.files.find(
      (file) => file.path === "docs/api/openapi.yaml",
    );

    expect(exitCode).toBe(0);
    expect(readmeFile?.headings).toEqual(["Fixture", "Overview", "CLI"]);
    expect(openApiFile?.topLevelKeys).toContain("openapi");
    expect(openApiFile?.routes).toEqual([
      expect.objectContaining({
        framework: "openapi",
        kind: "api",
        path: "/users",
        methods: ["GET", "POST"],
      }),
    ]);
  });
});
