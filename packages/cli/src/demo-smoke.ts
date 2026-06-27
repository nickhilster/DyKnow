import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import { DEFAULT_REPO_MAP_OUTPUT_PATH, parseDyknowConfig } from "@dyknow/core";

import { createRepoDiff } from "./diff.js";
import { scanWorkspace } from "./scan.js";
import { resolveWorkspacePath } from "./security.js";
import { createUpdateDraftBatch } from "./update.js";

export type DemoSmokeOptions = {
  checklistPath: string;
  configPath: string;
  handoffPath: string;
  indexPath: string;
  logPath: string;
  workspacePath: string;
};

type RequiredPhase3Document = {
  fileLabel: string;
  linkText: string;
  path: string;
  pathLabel: string;
};

function defaultWriter(message: string) {
  console.log(message);
}

function defaultErrorWriter(message: string) {
  console.error(message);
}

function toPortablePath(path: string) {
  return path.replaceAll("\\", "/");
}

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getRequiredPhase3Documents(
  options: DemoSmokeOptions,
): RequiredPhase3Document[] {
  return [
    {
      fileLabel: "Phase 3 handoff page",
      linkText: "Phase 3 Public Demo Handoff",
      path: options.handoffPath,
      pathLabel: "Phase 3 handoff path",
    },
    {
      fileLabel: "Phase 3 checklist page",
      linkText: "Phase 3 Demo Checklist",
      path: options.checklistPath,
      pathLabel: "Phase 3 checklist path",
    },
    {
      fileLabel: "Phase 3 repo selection page",
      linkText: "Phase 3 Demo Repo Selection",
      path: "docs/phase3-demo-repo-selection.md",
      pathLabel: "Phase 3 repo selection path",
    },
    {
      fileLabel: "Phase 3 baseline plan page",
      linkText: "Phase 3 Demo Baseline Plan",
      path: "docs/phase3-demo-baseline-plan.md",
      pathLabel: "Phase 3 baseline plan path",
    },
    {
      fileLabel: "Phase 3 change script page",
      linkText: "Phase 3 Demo Change Script",
      path: "docs/phase3-demo-change-script.md",
      pathLabel: "Phase 3 change script path",
    },
    {
      fileLabel: "Phase 3 recording runbook page",
      linkText: "Phase 3 Demo Recording Runbook",
      path: "docs/phase3-demo-recording-runbook.md",
      pathLabel: "Phase 3 recording runbook path",
    },
    {
      fileLabel: "Phase 3 Codex takeover handoff page",
      linkText: "Phase 3 Codex Takeover Handoff",
      path: "docs/handoff-phase3-codex.md",
      pathLabel: "Phase 3 Codex takeover handoff path",
    },
  ];
}

function parseDemoSmokeOptions(args: readonly string[]): DemoSmokeOptions {
  let checklistPath = "docs/phase3-demo-checklist.md";
  let configPath = "dyknow.config.json";
  let handoffPath = "docs/handoff-phase3-demo.md";
  let indexPath = "docs/index.md";
  let logPath = "docs/log.md";
  let workspacePath = ".";

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--workspace") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --workspace.");
      }

      workspacePath = value;
      index += 1;
      continue;
    }

    if (argument === "--config") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --config.");
      }

      configPath = value;
      index += 1;
      continue;
    }

    if (argument === "--handoff") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --handoff.");
      }

      handoffPath = value;
      index += 1;
      continue;
    }

    if (argument === "--checklist") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --checklist.");
      }

      checklistPath = value;
      index += 1;
      continue;
    }

    if (argument === "--index") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --index.");
      }

      indexPath = value;
      index += 1;
      continue;
    }

    if (argument === "--log") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --log.");
      }

      logPath = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown demo smoke option: ${argument}`);
  }

  return {
    checklistPath,
    configPath,
    handoffPath,
    indexPath,
    logPath,
    workspacePath,
  };
}

async function assertFileExists(filePath: string, label: string) {
  await access(filePath).catch(() => {
    throw new Error(`Missing ${label}: ${filePath}`);
  });
}

async function assertFileContains(options: {
  filePath: string;
  label: string;
  pattern: RegExp;
}) {
  const fileText = await readFile(options.filePath, "utf8");

  if (!options.pattern.test(fileText)) {
    throw new Error(`Missing ${options.label}: ${options.filePath}`);
  }
}

async function runDemoSmokePipeline(options: {
  configPath: string;
  workspacePath: string;
}) {
  const configText = await readFile(options.configPath, "utf8");
  const config = parseDyknowConfig(configText);
  const repoMapOutputPath = resolve(
    options.workspacePath,
    DEFAULT_REPO_MAP_OUTPUT_PATH,
  );

  const repoMap = await scanWorkspace({
    config,
    configPath: options.configPath,
    outputPath: repoMapOutputPath,
    rootPath: options.workspacePath,
  });
  await mkdir(dirname(repoMapOutputPath), { recursive: true });
  await writeFile(
    repoMapOutputPath,
    `${JSON.stringify(repoMap, null, 2)}\n`,
    "utf8",
  );

  await createRepoDiff({
    cwd: options.workspacePath,
    configPath: options.configPath,
    outputPath: "docs/dyknow/.state/repo-diff.json",
    snapshotPath: "docs/dyknow/.state/repo-map.json",
  });
  await createUpdateDraftBatch({
    cwd: options.workspacePath,
    configPath: options.configPath,
    diffPath: "docs/dyknow/.state/repo-diff.json",
    outputPath: "docs/dyknow/.state/update-proposals.json",
  });
}

export async function runDemoSmoke(
  args: readonly string[],
  context?: {
    cwd?: string;
    stdout?: (message: string) => void;
    stderr?: (message: string) => void;
  },
): Promise<number> {
  const cwd = context?.cwd ?? process.cwd();
  const stdout = context?.stdout ?? defaultWriter;
  const stderr = context?.stderr ?? defaultErrorWriter;

  try {
    const options = parseDemoSmokeOptions(args);
    const workspacePath = resolve(cwd, options.workspacePath);
    const indexPath = await resolveWorkspacePath(
      workspacePath,
      options.indexPath,
      "Phase 3 index path",
    );
    const logPath = await resolveWorkspacePath(
      workspacePath,
      options.logPath,
      "Phase 3 log path",
    );
    const configPath = await resolveWorkspacePath(
      workspacePath,
      options.configPath,
      "Phase 3 config path",
    );
    const requiredDocuments = await Promise.all(
      getRequiredPhase3Documents(options).map(async (document) => ({
        ...document,
        filePath: await resolveWorkspacePath(
          workspacePath,
          document.path,
          document.pathLabel,
        ),
      })),
    );

    for (const document of requiredDocuments) {
      await assertFileExists(document.filePath, document.fileLabel);
    }

    await assertFileExists(configPath, "DyKnow config");

    for (const document of requiredDocuments) {
      const indexLinkPath = toPortablePath(
        relative(dirname(indexPath), document.filePath),
      );
      await assertFileContains({
        filePath: indexPath,
        label: `${document.linkText} link in docs/index.md`,
        pattern: new RegExp(
          `\\[${escapeForRegex(document.linkText)}\\]\\(${escapeForRegex(indexLinkPath)}\\)`,
        ),
      });
    }

    for (const document of requiredDocuments) {
      const logEntryPath = toPortablePath(
        relative(workspacePath, document.filePath),
      );
      await assertFileContains({
        filePath: logPath,
        label: `${document.linkText} create log entry`,
        pattern: new RegExp(
          `\\| create \\| ${escapeForRegex(logEntryPath)} \\|`,
        ),
      });
    }

    await runDemoSmokePipeline({
      configPath,
      workspacePath,
    });

    stdout(
      `Phase 3 smoke path passed for ${requiredDocuments.length} required Phase 3 docs.`,
    );
    return 0;
  } catch (error) {
    stderr(
      error instanceof Error ? error.message : "Unknown demo smoke error.",
    );
    return 1;
  }
}
