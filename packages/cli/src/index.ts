import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { basename, dirname, relative, resolve } from "node:path";
import { stdin as input, stdout as output } from "node:process";

import {
  DEFAULT_IGNORED_SOURCE_PATTERNS,
  DEFAULT_REPO_DIFF_OUTPUT_PATH,
  DEFAULT_REPO_MAP_OUTPUT_PATH,
  DEFAULT_UPDATE_OUTPUT_PATH,
  DYKNOW_CONFIG_FILE_NAME,
  DYKNOW_CONFIG_SCHEMA_FILE_NAME,
  type InitialStackProfile,
  type RepoMapWarning,
  RepoMapWarningCodeSchema,
  createInitialDyknowConfig,
  parseDyknowConfig,
  renderDyknowConfig,
  renderDyknowConfigJsonSchema,
} from "@dyknow/core";

import { createCommitResult, parseCommitOptions } from "./commit.js";
import { createRepoDiff, parseDiffOptions } from "./diff.js";
import {
  createAuditLogReport,
  parseLogOptions,
  supportsLogSourceFiltering,
} from "./log.js";
import { createPrResult, parsePrOptions } from "./pr.js";
import {
  createInteractiveReviewSession,
  createReviewUpdateBatch,
  parseReviewOptions,
} from "./review.js";
import { scanWorkspace } from "./scan.js";
import { resolveWorkspacePath } from "./security.js";
import { createStatusReport, parseStatusOptions } from "./status.js";
import { createUpdateDraftBatch, parseUpdateOptions } from "./update.js";

export const PLANNED_COMMANDS = [] as const;

type CliWriter = (message: string) => void;

export type CliContext = {
  cwd?: string;
  prompt?: (message: string) => Promise<string>;
  stderr?: CliWriter;
  stdout?: CliWriter;
};

type InitOptions = {
  force: boolean;
  interactive: boolean;
  mode: "connected" | "local-only";
  projectName?: string;
};

type ScanOptions = {
  configPath: string;
  outputPath: string;
  failOn: RepoMapWarning["code"][];
};

function defaultWriter(message: string) {
  console.log(message);
}

async function defaultPrompt(message: string): Promise<string> {
  const terminal = createInterface({ input, output });

  try {
    return (await terminal.question(message)).trim();
  } finally {
    terminal.close();
  }
}

function getContext(context?: CliContext) {
  return {
    cwd: context?.cwd ?? process.cwd(),
    prompt: context?.prompt ?? defaultPrompt,
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
  let interactive = false;
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

    if (argument === "--interactive") {
      interactive = true;
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
    return { force, interactive, mode, projectName };
  }

  return { force, interactive, mode };
}

type DetectedStack = {
  profile: InitialStackProfile;
  reason: string;
};

async function detectInitialStackProfile(cwd: string): Promise<DetectedStack> {
  const packageJsonPath = resolve(cwd, "package.json");
  const pyprojectPath = resolve(cwd, "pyproject.toml");
  const requirementsPath = resolve(cwd, "requirements.txt");

  if (await pathExists(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const dependencyNames = new Set([
        ...Object.keys(packageJson.dependencies ?? {}),
        ...Object.keys(packageJson.devDependencies ?? {}),
      ]);

      if (dependencyNames.has("next")) {
        return {
          profile: "nextjs",
          reason: 'Detected the "next" package in package.json.',
        };
      }

      if (
        dependencyNames.has("express") ||
        dependencyNames.has("fastify") ||
        dependencyNames.has("@nestjs/core")
      ) {
        return {
          profile: "express",
          reason: "Detected a Node server dependency in package.json.",
        };
      }
    } catch {
      // Fall back to file-based detection below if package.json is invalid.
    }
  }

  if ((await pathExists(pyprojectPath)) || (await pathExists(requirementsPath))) {
    return {
      profile: "python",
      reason: "Detected Python dependency manifests in the workspace.",
    };
  }

  if (
    (await pathExists(resolve(cwd, "app"))) ||
    (await pathExists(resolve(cwd, "src", "app"))) ||
    (await pathExists(resolve(cwd, "pages")))
  ) {
    return {
      profile: "nextjs",
      reason: "Detected Next.js-style app or pages directories.",
    };
  }

  if (
    (await pathExists(resolve(cwd, "routes"))) ||
    (await pathExists(resolve(cwd, "src", "routes"))) ||
    (await pathExists(resolve(cwd, "server")))
  ) {
    return {
      profile: "express",
      reason: "Detected server or routes directories in the workspace.",
    };
  }

  return {
    profile: "generic",
    reason: "Using generic repo defaults because no specific stack markers were found.",
  };
}

function parseInitModeAnswer(answer: string): InitOptions["mode"] | null {
  const normalized = answer.trim().toLowerCase();

  if (normalized === "" || normalized === "local" || normalized === "local-only") {
    return "local-only";
  }

  if (normalized === "connected") {
    return "connected";
  }

  return null;
}

function parseStackProfileAnswer(answer: string): InitialStackProfile | null {
  const normalized = answer.trim().toLowerCase();

  if (normalized === "" || normalized === "auto") {
    return null;
  }

  if (
    normalized === "generic" ||
    normalized === "nextjs" ||
    normalized === "express" ||
    normalized === "python"
  ) {
    return normalized;
  }

  return null;
}

async function resolveInteractiveInitOptions(
  cwd: string,
  options: InitOptions,
  prompt: (message: string) => Promise<string>,
): Promise<{
  mode: InitOptions["mode"];
  projectName: string;
  stackProfile: InitialStackProfile;
}> {
  const detectedStack = await detectInitialStackProfile(cwd);
  const defaultProjectName = options.projectName ?? basename(cwd);
  let projectName = defaultProjectName;
  let mode = options.mode;
  let stackProfile = detectedStack.profile;

  const projectNameAnswer = await prompt(
    `Project name [${defaultProjectName}]: `,
  );

  if (projectNameAnswer.trim().length > 0) {
    projectName = projectNameAnswer.trim();
  }

  while (true) {
    const modeAnswer = await prompt(
      `Mode [${mode}] (local-only/connected): `,
    );
    const parsedMode = parseInitModeAnswer(modeAnswer);

    if (parsedMode) {
      mode = parsedMode;
      break;
    }
  }

  while (true) {
    const stackAnswer = await prompt(
      `Stack profile [${detectedStack.profile}] (auto/generic/nextjs/express/python): `,
    );
    const parsedStack = parseStackProfileAnswer(stackAnswer);

    if (parsedStack === null && stackAnswer.trim().length > 0) {
      continue;
    }

    stackProfile = parsedStack ?? detectedStack.profile;
    break;
  }

  return { mode, projectName, stackProfile };
}

function parseScanOptions(args: readonly string[]): ScanOptions {
  let configPath = DYKNOW_CONFIG_FILE_NAME;
  let outputPath = DEFAULT_REPO_MAP_OUTPUT_PATH;
  const failOn = new Set<RepoMapWarning["code"]>();

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

    if (argument === "--fail-on") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --fail-on.");
      }

      const parsedCode = RepoMapWarningCodeSchema.safeParse(value);

      if (!parsedCode.success) {
        throw new Error(
          `Invalid value for --fail-on: ${value}. Expected one of ${RepoMapWarningCodeSchema.options.join(
            ", ",
          )}.`,
        );
      }

      failOn.add(parsedCode.data);
      index += 1;
      continue;
    }

    throw new Error(`Unknown scan option: ${argument}`);
  }

  return { configPath, outputPath, failOn: [...failOn] };
}

function formatBlockingWarnings(
  warnings: readonly RepoMapWarning[],
  failOn: readonly RepoMapWarning["code"][],
): string | null {
  const blockingWarnings = warnings.filter((warning) =>
    failOn.includes(warning.code),
  );

  if (blockingWarnings.length === 0) {
    return null;
  }

  const counts = new Map<RepoMapWarning["code"], number>();

  for (const warning of blockingWarnings) {
    counts.set(warning.code, (counts.get(warning.code) ?? 0) + 1);
  }

  const summary = [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([code, count]) => `${count} ${code}`)
    .join(", ");

  return `Blocking warnings prevented a clean scan: ${summary}.`;
}

function formatHelp(): string {
  const lines = [
    "DyKnow Local CLI",
    "",
    "Implemented commands:",
    "- dyknow init [--force] [--connected] [--interactive] [--project-name <name>]",
    "- dyknow scan [--config <path>] [--output <path>] [--fail-on <dependency-policy|parse-error|secret-pattern>]...",
    "- dyknow diff [--config <path>] [--snapshot <path>] [--output <path>]",
    "- dyknow update [--config <path>] [--diff <path>] [--output <path>]",
    "- dyknow review [--input <path>] [--output <path>] [--approve|--reject|--escalate|--skip|--regenerate] (--all | --page <id>...)",
    "- dyknow review [--input <path>] [--output <path>] --edit --page <id> (--text <value> | --editor)",
    "- dyknow log [--input <path>] [--limit <count>] [--source <all|committed|runtime>] [--action <all|review|publish>]",
    "- dyknow status [--output <path>]",
    "- dyknow commit [--input <path>] [--message <text>] [--allow-high-risk]",
    "- dyknow pr [--input <path>] [--base <branch>] [--branch <name>] [--message <text>] [--title <text>] [--allow-high-risk]",
    "",
    `Default repo diff output: ${DEFAULT_REPO_DIFF_OUTPUT_PATH}`,
    `Default update output: ${DEFAULT_UPDATE_OUTPUT_PATH}`,
    "",
    "Default ignored source patterns:",
    ...DEFAULT_IGNORED_SOURCE_PATTERNS.map((pattern) => `- ${pattern}`),
  ];

  if (PLANNED_COMMANDS.length > 0) {
    lines.push(
      "",
      "Planned commands:",
      ...PLANNED_COMMANDS.map((command) => `- ${command}`),
    );
  }

  return lines.join("\n");
}

async function handleInit(args: readonly string[], context?: CliContext) {
  const { cwd, prompt, stderr, stdout } = getContext(context);
  const options = parseInitOptions(args);
  const configPath = resolve(cwd, DYKNOW_CONFIG_FILE_NAME);
  const schemaPath = resolve(cwd, DYKNOW_CONFIG_SCHEMA_FILE_NAME);

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

  const detectedStack = await detectInitialStackProfile(cwd);
  const initSelection = options.interactive
    ? await resolveInteractiveInitOptions(cwd, options, prompt)
    : {
        mode: options.mode,
        projectName: options.projectName ?? basename(cwd),
        stackProfile: detectedStack.profile,
      };

  const config = createInitialDyknowConfig({
    mode: initSelection.mode,
    projectName: initSelection.projectName,
    stackProfile: initSelection.stackProfile,
  });

  await writeFile(schemaPath, renderDyknowConfigJsonSchema(), "utf8");
  await writeFile(configPath, renderDyknowConfig(config), "utf8");

  stdout(
    `Created ${relative(cwd, configPath)} and ${relative(cwd, schemaPath)} for project ${initSelection.projectName} using the ${initSelection.stackProfile} stack profile. ${detectedStack.reason}`,
  );
  return 0;
}

async function handleScan(args: readonly string[], context?: CliContext) {
  const { cwd, stderr, stdout } = getContext(context);

  try {
    const options = parseScanOptions(args);
    const configPath = await resolveWorkspacePath(
      cwd,
      options.configPath,
      "Scan config path",
    );
    const outputPath = await resolveWorkspacePath(
      cwd,
      options.outputPath,
      "Scan output path",
    );
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

    const blockingWarningMessage = formatBlockingWarnings(
      repoMap.warnings,
      options.failOn,
    );

    if (blockingWarningMessage) {
      stderr(blockingWarningMessage);
      return 1;
    }

    return 0;
  } catch (error) {
    stderr(error instanceof Error ? error.message : "Unknown scan error.");
    return 1;
  }
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

    if (options.interactive) {
      const result = await createInteractiveReviewSession({
        cwd,
        inputPath: options.inputPath,
        outputPath: options.outputPath,
        stdout,
        ...(context?.prompt ? { prompt: context.prompt } : {}),
      });

      stdout(
        `Interactive review updated ${result.updatedProposals} proposal(s) and left ${result.remainingProposals} pending in ${result.outputPath}.`,
      );
      return 0;
    }

    const reviewBatchOptions = {
      cwd,
      inputPath: options.inputPath,
      outputPath: options.outputPath,
      pageIds: options.pageIds,
      all: options.all,
      launchEditor: options.launchEditor,
      ...(options.decision ? { decision: options.decision } : {}),
      ...(options.editText ? { editText: options.editText } : {}),
    };
    const result = await createReviewUpdateBatch(reviewBatchOptions);

    if (!result.decision) {
      stdout(
        `Loaded ${result.totalDrafts} update proposal(s) from ${result.outputPath}: ${result.summary}.`,
      );
      return 0;
    }

    if (result.decision === "Skipped") {
      stdout(
        `Skipped ${result.updatedProposals} update proposal(s) and left ${result.outputPath} unchanged.`,
      );
      return 0;
    }

    if (result.decision === "Regenerated") {
      stdout(
        `Regenerated ${result.updatedProposals} update proposal(s) and wrote ${result.outputPath}.`,
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

async function handleLog(args: readonly string[], context?: CliContext) {
  const { cwd, stderr, stdout } = getContext(context);

  try {
    const options = parseLogOptions(args);

    if (
      options.source !== "all" &&
      !supportsLogSourceFiltering(options.inputPath)
    ) {
      stderr(
        `Ignoring --source ${options.source} for custom audit log input ${options.inputPath}. Source filtering only applies to the default merged log view.`,
      );
    }

    const result = await createAuditLogReport({
      cwd,
      inputPath: options.inputPath,
      limit: options.limit,
      source: options.source,
      action: options.action,
    });

    stdout(result.report);
    return 0;
  } catch (error) {
    stderr(error instanceof Error ? error.message : "Unknown log error.");
    return 1;
  }
}

async function handleCommit(args: readonly string[], context?: CliContext) {
  const { cwd, stderr, stdout } = getContext(context);

  try {
    const options = parseCommitOptions(args);
    const result = await createCommitResult({
      allowHighRisk: options.allowHighRisk,
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

async function handleStatus(args: readonly string[], context?: CliContext) {
  const { cwd, stderr, stdout } = getContext(context);

  try {
    const options = parseStatusOptions(args);
    const result = await createStatusReport({
      cwd,
      outputPath: options.outputPath,
    });

    stdout(`Generated DyKnow status report at ${result.outputPath}.`);
    return 0;
  } catch (error) {
    stderr(error instanceof Error ? error.message : "Unknown status error.");
    return 1;
  }
}

async function handlePr(args: readonly string[], context?: CliContext) {
  const { cwd, stderr, stdout } = getContext(context);

  try {
    const options = parsePrOptions(args);
    const result = await createPrResult({
      allowHighRisk: options.allowHighRisk,
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

  if (command === "log") {
    return handleLog(commandArgs, context);
  }

  if (command === "commit") {
    return handleCommit(commandArgs, context);
  }

  if (command === "status") {
    return handleStatus(commandArgs, context);
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
