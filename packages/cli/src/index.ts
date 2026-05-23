import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";

import {
  DEFAULT_IGNORED_SOURCE_PATTERNS,
  DEFAULT_REPO_DIFF_OUTPUT_PATH,
  DEFAULT_REPO_MAP_OUTPUT_PATH,
  DEFAULT_UPDATE_OUTPUT_PATH,
  DYKNOW_CONFIG_FILE_NAME,
  DYKNOW_CONFIG_SCHEMA_FILE_NAME,
  createInitialDyknowConfig,
  parseDyknowConfig,
  renderDyknowConfig,
  renderDyknowConfigJsonSchema,
} from "@dyknow/core";

import { createCommitResult, parseCommitOptions } from "./commit.js";
import { createRepoDiff, parseDiffOptions } from "./diff.js";
import { createPrResult, parsePrOptions } from "./pr.js";
import { createReviewUpdateBatch, parseReviewOptions } from "./review.js";
import { scanWorkspace } from "./scan.js";
import { createUpdateDraftBatch, parseUpdateOptions } from "./update.js";

export const PLANNED_COMMANDS = ["dyknow init", "dyknow scan"] as const;

type CliWriter = (message: string) => void;

export type CliContext = {
  cwd?: string;
  stderr?: CliWriter;
  stdout?: CliWriter;
};

type InitOptions = {
  force: boolean;
  mode: "connected" | "local-only";
  projectName?: string;
};

type ScanOptions = {
  configPath: string;
  outputPath: string;
};

function defaultWriter(message: string) {
  console.log(message);
}

function getContext(context?: CliContext) {
  return {
    cwd: context?.cwd ?? process.cwd(),
    stderr: context?.stderr ?? defaultWriter,
    stdout: context?.stdout ?? defaultWriter,
  };
}

async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function parseInitOptions(args: readonly string[]): InitOptions {
  let force = false;
  let mode: InitOptions["mode"] = "local-only";
  let projectName: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--force") {
      force = true;
      continue;
    }

    if (argument === "--connected") {
      mode = "connected";
      continue;
    }

    if (argument === "--project-name") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --project-name.");
      }

      projectName = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown init option: ${argument}`);
  }

  if (projectName) {
    return { force, mode, projectName };
  }

  return { force, mode };
}

function parseScanOptions(args: readonly string[]): ScanOptions {
  let configPath = DYKNOW_CONFIG_FILE_NAME;
  let outputPath = DEFAULT_REPO_MAP_OUTPUT_PATH;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--config") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --config.");
      }

      configPath = value;
      index += 1;
      continue;
    }

    if (argument === "--output") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --output.");
      }

      outputPath = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown scan option: ${argument}`);
  }

  return { configPath, outputPath };
}

function formatHelp(): string {
  const lines = [
    "DyKnow Local CLI",
    "",
    "Implemented commands:",
    "- dyknow init [--force] [--connected] [--project-name <name>]",
    "- dyknow scan [--config <path>] [--output <path>]",
    "- dyknow diff [--config <path>] [--snapshot <path>] [--output <path>]",
    "- dyknow update [--config <path>] [--diff <path>] [--output <path>]",
    "- dyknow review [--input <path>] [--output <path>] [--approve|--reject|--escalate] (--all | --page <id>...)",
    "- dyknow commit [--input <path>] [--message <text>]",
    "- dyknow pr [--input <path>] [--base <branch>] [--branch <name>] [--message <text>] [--title <text>]",
    "",
    `Default repo diff output: ${DEFAULT_REPO_DIFF_OUTPUT_PATH}`,
    `Default update output: ${DEFAULT_UPDATE_OUTPUT_PATH}`,
    "",
    "Default ignored source patterns:",
    ...DEFAULT_IGNORED_SOURCE_PATTERNS.map((pattern) => `- ${pattern}`),
    "",
    "Planned commands:",
    ...PLANNED_COMMANDS.map((command) => `- ${command}`),
  ];

  return lines.join("\n");
}

async function handleInit(args: readonly string[], context?: CliContext) {
  const { cwd, stderr, stdout } = getContext(context);
  const options = parseInitOptions(args);
  const configPath = resolve(cwd, DYKNOW_CONFIG_FILE_NAME);
  const schemaPath = resolve(cwd, DYKNOW_CONFIG_SCHEMA_FILE_NAME);
  const projectName = options.projectName ?? basename(cwd);

  if (!options.force) {
    const existingTargets = await Promise.all([
      pathExists(configPath),
      pathExists(schemaPath),
    ]);

    if (existingTargets.some(Boolean)) {
      stderr(
        `Refusing to overwrite existing DyKnow config artifacts. Re-run with --force to replace ${relative(
          cwd,
          configPath,
        )} and ${relative(cwd, schemaPath)}.`,
      );
      return 1;
    }
  }

  const config = createInitialDyknowConfig({
    mode: options.mode,
    projectName,
  });

  await writeFile(schemaPath, renderDyknowConfigJsonSchema(), "utf8");
  await writeFile(configPath, renderDyknowConfig(config), "utf8");

  stdout(
    `Created ${relative(cwd, configPath)} and ${relative(cwd, schemaPath)} for project ${projectName}.`,
  );
  return 0;
}

async function handleScan(args: readonly string[], context?: CliContext) {
  const { cwd, stdout } = getContext(context);
  const options = parseScanOptions(args);
  const configPath = resolve(cwd, options.configPath);
  const outputPath = resolve(cwd, options.outputPath);
  const configText = await readFile(configPath, "utf8");
  const config = parseDyknowConfig(configText);
  const repoMap = await scanWorkspace({
    config,
    configPath,
    outputPath,
    rootPath: cwd,
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    `${outputPath}`,
    `${JSON.stringify(repoMap, null, 2)}\n`,
    "utf8",
  );

  stdout(
    `Scanned ${repoMap.files.length} files and wrote ${relative(cwd, outputPath)} with ${repoMap.warnings.length} warning(s).`,
  );
  return 0;
}

async function handleDiff(args: readonly string[], context?: CliContext) {
  const { cwd, stderr, stdout } = getContext(context);

  try {
    const options = parseDiffOptions(args);
    const repoDiff = await createRepoDiff({
      cwd,
      configPath: options.configPath,
      outputPath: options.outputPath,
      snapshotPath: options.snapshotPath,
    });
    const outputPath = repoDiff.outputPath || DEFAULT_REPO_DIFF_OUTPUT_PATH;

    stdout(
      `Compared ${repoDiff.baseSnapshotPath} to the current workspace and wrote ${outputPath} with ${repoDiff.summary.addedFiles} added, ${repoDiff.summary.changedFiles} changed, and ${repoDiff.summary.removedFiles} removed file(s).`,
    );
    return 0;
  } catch (error) {
    stderr(error instanceof Error ? error.message : "Unknown diff error.");
    return 1;
  }
}

async function handleUpdate(args: readonly string[], context?: CliContext) {
  const { cwd, stderr, stdout } = getContext(context);

  try {
    const options = parseUpdateOptions(args);
    const updateBatch = await createUpdateDraftBatch({
      cwd,
      configPath: options.configPath,
      diffPath: options.diffPath,
      outputPath: options.outputPath,
    });

    stdout(
      `Drafted ${updateBatch.summary.draftedProposals} update proposal(s) from ${updateBatch.summary.affectedPages} affected page(s) and wrote ${updateBatch.outputPath}.`,
    );
    return 0;
  } catch (error) {
    stderr(error instanceof Error ? error.message : "Unknown update error.");
    return 1;
  }
}

async function handleReview(args: readonly string[], context?: CliContext) {
  const { cwd, stderr, stdout } = getContext(context);

  try {
    const options = parseReviewOptions(args);
    const reviewBatchOptions = {
      cwd,
      inputPath: options.inputPath,
      outputPath: options.outputPath,
      pageIds: options.pageIds,
      all: options.all,
      ...(options.decision ? { decision: options.decision } : {}),
    };
    const result = await createReviewUpdateBatch(reviewBatchOptions);

    if (!result.decision) {
      stdout(
        `Loaded ${result.totalDrafts} update proposal(s) from ${result.outputPath}: ${result.summary}.`,
      );
      return 0;
    }

    stdout(
      `Marked ${result.updatedProposals} update proposal(s) as ${result.decision} and wrote ${result.outputPath}.`,
    );
    return 0;
  } catch (error) {
    stderr(error instanceof Error ? error.message : "Unknown review error.");
    return 1;
  }
}

async function handleCommit(args: readonly string[], context?: CliContext) {
  const { cwd, stderr, stdout } = getContext(context);

  try {
    const options = parseCommitOptions(args);
    const result = await createCommitResult({
      cwd,
      inputPath: options.inputPath,
      message: options.message,
    });

    stdout(
      `Applied ${result.publishedProposals} approved update proposal(s) and created commit ${result.commitHash}.`,
    );
    return 0;
  } catch (error) {
    stderr(error instanceof Error ? error.message : "Unknown commit error.");
    return 1;
  }
}

async function handlePr(args: readonly string[], context?: CliContext) {
  const { cwd, stderr, stdout } = getContext(context);

  try {
    const options = parsePrOptions(args);
    const result = await createPrResult({
      cwd,
      base: options.base,
      inputPath: options.inputPath,
      message: options.message,
      title: options.title,
      ...(options.branch ? { branch: options.branch } : {}),
    });

    stdout(
      `Applied ${result.publishedProposals} approved update proposal(s), pushed branch ${result.branch}, and opened PR ${result.url}.`,
    );
    return 0;
  } catch (error) {
    stderr(error instanceof Error ? error.message : "Unknown pr error.");
    return 1;
  }
}

export function formatBootstrapStatus(): string {
  return formatHelp();
}

export async function runCli(
  args: readonly string[],
  context?: CliContext,
): Promise<number> {
  const { stderr, stdout } = getContext(context);
  const [command, ...commandArgs] = args;

  if (!command || command === "help" || command === "--help") {
    stdout(formatHelp());
    return 0;
  }

  if (command === "init") {
    return handleInit(commandArgs, context);
  }

  if (command === "scan") {
    return handleScan(commandArgs, context);
  }

  if (command === "diff") {
    return handleDiff(commandArgs, context);
  }

  if (command === "update") {
    return handleUpdate(commandArgs, context);
  }

  if (command === "review") {
    return handleReview(commandArgs, context);
  }

  if (command === "commit") {
    return handleCommit(commandArgs, context);
  }

  if (command === "pr") {
    return handlePr(commandArgs, context);
  }

  if (
    PLANNED_COMMANDS.includes(
      `dyknow ${command}` as (typeof PLANNED_COMMANDS)[number],
    )
  ) {
    stderr(`Command not implemented yet: dyknow ${command}`);
    return 1;
  }

  stderr(`Unknown command: ${command}`);
  return 1;
}
