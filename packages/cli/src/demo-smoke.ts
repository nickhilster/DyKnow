import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveWorkspacePath } from "./security.js";

export type DemoSmokeOptions = {
  checklistPath: string;
  configPath: string;
  handoffPath: string;
  indexPath: string;
  logPath: string;
  workspacePath: string;
};

function defaultWriter(message: string) {
  console.log(message);
}

function defaultErrorWriter(message: string) {
  console.error(message);
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

async function runDyKnowCommand(options: {
  command: string;
  workspacePath: string;
  args: readonly string[];
}) {
  const binPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "bin.js",
  );

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [binPath, options.command, ...options.args], {
      cwd: options.workspacePath,
      env: process.env,
      stdio: "inherit",
    });

    child.once("error", rejectPromise);
    child.once("exit", (exitCode) => {
      if (exitCode === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(
        new Error(`dyknow ${options.command} failed with exit code ${exitCode ?? "unknown"}.`),
      );
    });
  });
}

export async function runDemoSmoke(
  args: readonly string[],
  context?: { cwd?: string; stdout?: (message: string) => void; stderr?: (message: string) => void },
): Promise<number> {
  const cwd = context?.cwd ?? process.cwd();
  const stdout = context?.stdout ?? defaultWriter;
  const stderr = context?.stderr ?? defaultErrorWriter;

  try {
    const options = parseDemoSmokeOptions(args);
    const workspacePath = resolve(cwd, options.workspacePath);
    const handoffPath = await resolveWorkspacePath(
      workspacePath,
      options.handoffPath,
      "Phase 3 handoff path",
    );
    const checklistPath = await resolveWorkspacePath(
      workspacePath,
      options.checklistPath,
      "Phase 3 checklist path",
    );
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

    await assertFileExists(handoffPath, "Phase 3 handoff page");
    await assertFileExists(checklistPath, "Phase 3 checklist page");
    await assertFileExists(configPath, "DyKnow config");
    await assertFileContains({
      filePath: indexPath,
      label: "Phase 3 handoff link in docs/index.md",
      pattern: /\[Phase 3 Public Demo Handoff\]\(handoff-phase3-demo\.md\)/,
    });
    await assertFileContains({
      filePath: indexPath,
      label: "Phase 3 checklist link in docs/index.md",
      pattern: /\[Phase 3 Demo Checklist\]\(phase3-demo-checklist\.md\)/,
    });
    await assertFileContains({
      filePath: logPath,
      label: "Phase 3 handoff log entry",
      pattern: /\| create \| docs\/handoff-phase3-demo\.md \|/,
    });
    await assertFileContains({
      filePath: logPath,
      label: "Phase 3 checklist log entry",
      pattern: /\| create \| docs\/phase3-demo-checklist\.md \|/,
    });

    await runDyKnowCommand({
      command: "scan",
      workspacePath,
      args: ["--config", options.configPath],
    });
    await runDyKnowCommand({
      command: "diff",
      workspacePath,
      args: ["--config", options.configPath],
    });
    await runDyKnowCommand({
      command: "update",
      workspacePath,
      args: ["--config", options.configPath],
    });

    stdout(
      `Phase 3 smoke path passed for ${relative(workspacePath, handoffPath)} and ${relative(workspacePath, checklistPath)}.`,
    );
    return 0;
  } catch (error) {
    stderr(error instanceof Error ? error.message : "Unknown demo smoke error.");
    return 1;
  }
}
