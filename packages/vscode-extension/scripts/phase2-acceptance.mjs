import { execFile } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const extensionRoot = resolve(repoRoot, "packages/vscode-extension");
const packageJsonPath = resolve(extensionRoot, "package.json");
const reportDir = resolve(repoRoot, "docs/dyknow/.state");
const jsonReportPath = resolve(reportDir, "phase2-acceptance-report.json");
const mdReportPath = resolve(reportDir, "phase2-acceptance-report.md");
const vsixPath = resolve(extensionRoot, "dyknow-0.1.0.vsix");

const REQUIRED_VIEWS = [
  "dyknow.map",
  "dyknow.changedKnowledge",
  "dyknow.stalePages",
  "dyknow.suggestedUpdates",
  "dyknow.agentContext",
];

const REQUIRED_COMMANDS = [
  "dyknow.scan",
  "dyknow.diff",
  "dyknow.update",
  "dyknow.approveProposal",
  "dyknow.skipProposal",
  "dyknow.rejectProposal",
  "dyknow.editProposal",
  "dyknow.regenerateProposal",
  "dyknow.markSourceIrrelevant",
  "dyknow.regeneratePending",
  "dyknow.rejectPending",
  "dyknow.regenerateSelected",
  "dyknow.rejectSelected",
  "dyknow.commit",
  "dyknow.openPr",
  "dyknow.refreshViews",
];

function unique(values) {
  return [...new Set(values)];
}

async function run(command, args, cwd) {
  const startedAt = Date.now();
  const result = await execFileAsync(command, args, {
    cwd,
    encoding: "utf8",
  });

  return {
    command: `${command} ${args.join(" ")}`,
    durationMs: Date.now() - startedAt,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

function checkManifest(pkg) {
  const views =
    pkg?.contributes?.views?.dyknow?.map((view) => view.id).filter(Boolean) ?? [];
  const commands =
    pkg?.contributes?.commands
      ?.map((command) => command.command)
      .filter(Boolean) ?? [];

  const missingViews = REQUIRED_VIEWS.filter((id) => !views.includes(id));
  const missingCommands = REQUIRED_COMMANDS.filter(
    (id) => !commands.includes(id),
  );

  const telemetryEnabledDefault =
    pkg?.contributes?.configuration?.properties?.["dyknow.telemetryEnabled"]
      ?.default;

  return {
    views: unique(views),
    commands: unique(commands),
    missingViews,
    missingCommands,
    telemetryOptInDefaultFalse: telemetryEnabledDefault === false,
  };
}

function toMarkdown(report) {
  const checks = report.checks;
  const pass = report.overallPass ? "PASS" : "FAIL";

  return `# Phase 2 Acceptance Report\n\n` +
    `- Generated: ${report.generatedAt}\n` +
    `- Overall: ${pass}\n` +
    `- Quality bar status: ${report.qualityBarStatus}\n\n` +
    `## Checks\n` +
    `- Manifest views complete: ${checks.manifest.missingViews.length === 0}\n` +
    `- Manifest commands complete: ${checks.manifest.missingCommands.length === 0}\n` +
    `- Telemetry default is opt-in false: ${checks.manifest.telemetryOptInDefaultFalse}\n` +
    `- Extension build: ${checks.build.ok}\n` +
    `- Extension package: ${checks.package.ok}\n` +
    `- VSIX exists: ${checks.vsixExists}\n\n` +
    `## Remaining to fully close quality bar\n` +
    `- Manual first-time-user walkthrough on a clean workspace (install extension, run scan/diff/update, review with inline actions, commit or open PR).\n`;
}

async function main() {
  const packageText = await readFile(packageJsonPath, "utf8");
  const packageJson = JSON.parse(packageText);
  const manifest = checkManifest(packageJson);

  const buildResult = { ok: false, error: undefined, output: undefined };
  const packageResult = { ok: false, error: undefined, output: undefined };

  try {
    buildResult.output = await run(
      process.execPath,
      [
        resolve(extensionRoot, "esbuild.mjs"),
      ],
      extensionRoot,
    );
    buildResult.ok = true;
  } catch (error) {
    buildResult.error = error instanceof Error ? error.message : String(error);
  }

  try {
    packageResult.output = await run(
      process.execPath,
      [
        resolve(repoRoot, "node_modules/@vscode/vsce/vsce"),
        "package",
        "--no-dependencies",
      ],
      extensionRoot,
    );
    packageResult.ok = true;
  } catch (error) {
    packageResult.error = error instanceof Error ? error.message : String(error);
  }

  let vsixExists = false;

  try {
    await access(vsixPath);
    vsixExists = true;
  } catch {
    vsixExists = false;
  }

  const checks = {
    manifest,
    build: buildResult,
    package: packageResult,
    vsixExists,
  };

  const overallPass =
    manifest.missingViews.length === 0 &&
    manifest.missingCommands.length === 0 &&
    manifest.telemetryOptInDefaultFalse &&
    buildResult.ok &&
    packageResult.ok &&
    vsixExists;

  const report = {
    generatedAt: new Date().toISOString(),
    checks,
    qualityBarStatus: overallPass
      ? "provisionally-pass-pending-manual-first-time-user-walkthrough"
      : "fail",
    overallPass,
  };

  await mkdir(reportDir, { recursive: true });
  await writeFile(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(mdReportPath, `${toMarkdown(report)}\n`, "utf8");

  if (!overallPass) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(
    `Phase 2 acceptance generation failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
