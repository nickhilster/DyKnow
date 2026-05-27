import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import * as vscode from "vscode";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const execFileAsync = promisify(execFile);
const EXTENSION_DIR = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(EXTENSION_DIR, "../../cli/dist/bin.js");

const STATE_DIR = "docs/dyknow/.state";
const CONFIG_PATH = "dyknow.config.json";
const REPO_MAP_PATH = `${STATE_DIR}/repo-map.json`;
const REPO_DIFF_PATH = `${STATE_DIR}/repo-diff.json`;
const PROPOSALS_PATH = `${STATE_DIR}/update-proposals.json`;
const SOURCE_OVERRIDES_PATH = `${STATE_DIR}/source-overrides.json`;

// ---------------------------------------------------------------------------
// Types (mirrors core contracts without importing @dyknow/core to keep the
// bundle simple — vscode extensions run in a CommonJS host)
// ---------------------------------------------------------------------------

interface RepoDiffEntry {
  path: string;
  change: "added" | "changed" | "removed";
}

interface RepoDiff {
  added?: RepoDiffEntry[];
  changed?: RepoDiffEntry[];
  removed?: RepoDiffEntry[];
  addedFiles?: Array<{ path: string }>;
  changedFiles?: Array<{ path: string }>;
  removedFiles?: Array<{ path: string }>;
  affectedPages?: Array<{ pageId: string; outputPath: string }>;
}

interface DyKnowPageConfig {
  id: string;
  title: string;
  outputPath: string;
}

interface DyKnowConfig {
  pages: DyKnowPageConfig[];
}

type RepoFileSignal =
  | "agent-context"
  | "config"
  | "documentation"
  | "openapi"
  | "package-manifest"
  | "route-candidate"
  | "source-code";

interface RepoMapFileSummary {
  path: string;
  kind: string;
  signals: RepoFileSignal[];
  dependencies: Array<{ name: string }>;
  routes: Array<{ path: string }>;
}

interface RepoMapSnapshot {
  files: RepoMapFileSummary[];
}

type ReviewState =
  | "Drafted"
  | "Needs review"
  | "Approved"
  | "Rejected"
  | "Escalated"
  | "Edited"
  | "Skipped";

interface UpdateProposal {
  pageId: string;
  summary: string;
  why: string;
  risk: "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
  reviewState: ReviewState;
  sources: string[];
  proposedText: string;
  requiresHumanReview: boolean;
}

interface UpdateDraft {
  affectedPage: {
    outputPath: string;
  };
  proposal: UpdateProposal;
}

interface UpdateDraftBatch {
  drafts: UpdateDraft[];
}

interface SourceOverrideEntry {
  ignoredSources: string[];
  updatedAt: string;
}

interface SourceOverrides {
  pages: Record<string, SourceOverrideEntry>;
}

function isTelemetryEnabled(): boolean {
  return vscode.workspace
    .getConfiguration("dyknow")
    .get<boolean>("telemetryEnabled", false);
}

function parseLastReviewedDate(pageContent: string): string | undefined {
  const frontmatterMatch = pageContent.match(/^---[\s\S]*?---/u);

  if (!frontmatterMatch) {
    return undefined;
  }

  const dateMatch = frontmatterMatch[0].match(
    /^last_reviewed:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})$/mu,
  );

  return dateMatch?.[1];
}

function getDaysSince(dateText: string): number | undefined {
  const parsed = new Date(`${dateText}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  const diffMs = Date.now() - parsed.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Shared output channel (singleton per activation)
// ---------------------------------------------------------------------------

let _outputChannel: vscode.OutputChannel | undefined;

function getOutput(): vscode.OutputChannel {
  _outputChannel ??= vscode.window.createOutputChannel("DyKnow");
  return _outputChannel;
}

// ---------------------------------------------------------------------------
// CLI runner
// ---------------------------------------------------------------------------

async function runCli(
  cwd: string,
  args: string[],
  opts?: { silent?: boolean },
): Promise<string> {
  const output = getOutput();
  const startedAt = Date.now();

  if (!opts?.silent) {
    output.appendLine(`\n$ dyknow ${args.join(" ")}`);
  }

  if (isTelemetryEnabled()) {
    output.appendLine(
      `[telemetry] command.start ${JSON.stringify({
        command: args[0] ?? "unknown",
        argsCount: Math.max(0, args.length - 1),
      })}`,
    );
  }

  try {
    const result = await execFileAsync(process.execPath, [CLI_PATH, ...args], {
      cwd,
      encoding: "utf8",
    });

    const stdout = result.stdout.trim();
    const stderr = result.stderr.trim();

    if (!opts?.silent) {
      if (stdout) output.appendLine(stdout);
      if (stderr) output.appendLine(stderr);
    }

    if (isTelemetryEnabled()) {
      output.appendLine(
        `[telemetry] command.success ${JSON.stringify({
          command: args[0] ?? "unknown",
          durationMs: Date.now() - startedAt,
        })}`,
      );
    }

    return stdout;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown DyKnow error.";

    if (isTelemetryEnabled()) {
      output.appendLine(
        `[telemetry] command.error ${JSON.stringify({
          command: args[0] ?? "unknown",
          durationMs: Date.now() - startedAt,
          message,
        })}`,
      );
    }

    if (!opts?.silent) {
      output.appendLine(`ERROR: ${message}`);
    }

    throw new Error(message);
  }
}

// ---------------------------------------------------------------------------
// Workspace helpers
// ---------------------------------------------------------------------------

function getWorkspacePath(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

async function readJsonFile<T>(cwd: string, relPath: string): Promise<T | null> {
  try {
    const text = await readFile(resolve(cwd, relPath), "utf8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(
  cwd: string,
  relPath: string,
  value: unknown,
): Promise<void> {
  const outputPath = resolve(cwd, relPath);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

// ---------------------------------------------------------------------------
// DyKnow Map tree view
// ---------------------------------------------------------------------------

const MAP_GROUP_ORDER: readonly RepoFileSignal[] = [
  "agent-context",
  "documentation",
  "config",
  "source-code",
  "route-candidate",
  "openapi",
  "package-manifest",
];

function formatSignalLabel(signal: RepoFileSignal): string {
  switch (signal) {
    case "agent-context":
      return "Agent Context";
    case "documentation":
      return "Documentation";
    case "config":
      return "Config";
    case "source-code":
      return "Source Code";
    case "route-candidate":
      return "Routes";
    case "openapi":
      return "OpenAPI";
    case "package-manifest":
      return "Package Manifests";
  }
}

class MapGroupItem extends vscode.TreeItem {
  constructor(
    readonly signal: RepoFileSignal,
    readonly files: RepoMapFileSummary[],
  ) {
    super(
      `${formatSignalLabel(signal)} (${files.length})`,
      vscode.TreeItemCollapsibleState.Collapsed,
    );

    this.tooltip = `${formatSignalLabel(signal)} files: ${files.length}`;
    this.iconPath = new vscode.ThemeIcon("folder-library");
    this.contextValue = "dyknow-map-group";
  }
}

class MapFileItem extends vscode.TreeItem {
  constructor(readonly file: RepoMapFileSummary, workspaceRoot: string) {
    super(basename(file.path), vscode.TreeItemCollapsibleState.None);

    this.description = `${file.kind} · ${file.path}`;

    const details: string[] = [file.path, `kind: ${file.kind}`];

    if (file.dependencies.length > 0) {
      details.push(`dependencies: ${file.dependencies.length}`);
    }

    if (file.routes.length > 0) {
      details.push(`routes: ${file.routes.length}`);
    }

    this.tooltip = details.join("\n");
    this.iconPath = new vscode.ThemeIcon("file");
    this.contextValue = "dyknow-map-file";

    const uri = vscode.Uri.file(resolve(workspaceRoot, file.path));
    this.command = {
      command: "vscode.open",
      title: "Open file",
      arguments: [uri],
    };
  }
}

class DyKnowMapProvider
  implements vscode.TreeDataProvider<MapGroupItem | MapFileItem>
{
  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<MapGroupItem | MapFileItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private map: RepoMapSnapshot | null = null;
  private workspaceRoot: string | undefined;

  refresh(workspaceRoot: string | undefined): void {
    this.workspaceRoot = workspaceRoot;
    this._onDidChangeTreeData.fire();
  }

  async load(): Promise<void> {
    const cwd = this.workspaceRoot;

    if (!cwd) {
      this.map = null;
      return;
    }

    this.map = await readJsonFile<RepoMapSnapshot>(cwd, REPO_MAP_PATH);
  }

  getTreeItem(element: MapGroupItem | MapFileItem): vscode.TreeItem {
    return element;
  }

  async getChildren(
    element?: MapGroupItem | MapFileItem,
  ): Promise<Array<MapGroupItem | MapFileItem>> {
    await this.load();

    const cwd = this.workspaceRoot;

    if (!cwd || !this.map) {
      return [];
    }

    if (!element) {
      return MAP_GROUP_ORDER.map((signal) => {
        const files = this.map?.files.filter((f) => f.signals.includes(signal)) ?? [];
        return new MapGroupItem(signal, files);
      }).filter((group) => group.files.length > 0);
    }

    if (element instanceof MapGroupItem) {
      return element.files.map((file) => new MapFileItem(file, cwd));
    }

    return [];
  }
}

// ---------------------------------------------------------------------------
// Agent Context tree view
// ---------------------------------------------------------------------------

type AgentContextTarget = {
  id: string;
  label: string;
  path: string;
};

const AGENT_CONTEXT_TARGETS: readonly AgentContextTarget[] = [
  {
    id: "agents",
    label: "AGENTS.md",
    path: "AGENTS.md",
  },
  {
    id: "claude",
    label: "CLAUDE.md",
    path: "CLAUDE.md",
  },
  {
    id: "product-overview",
    label: "Product Overview",
    path: "docs/product-overview.md",
  },
  {
    id: "feature-map",
    label: "Feature Map",
    path: "docs/feature-map.md",
  },
  {
    id: "architecture",
    label: "Architecture",
    path: "docs/architecture.md",
  },
  {
    id: "setup-guide",
    label: "Setup Guide",
    path: "docs/setup-guide.md",
  },
];

class AgentContextItem extends vscode.TreeItem {
  constructor(
    readonly target: AgentContextTarget,
    readonly status: "ready" | "missing",
    workspaceRoot: string,
  ) {
    super(target.label, vscode.TreeItemCollapsibleState.None);

    this.description = status === "ready" ? target.path : "missing";
    this.tooltip = `${target.path}\nstatus: ${status}`;
    this.iconPath = new vscode.ThemeIcon(
      status === "ready" ? "notebook" : "warning",
    );
    this.contextValue = "dyknow-agent-context-file";

    const uri = vscode.Uri.file(resolve(workspaceRoot, target.path));
    this.command = {
      command: "vscode.open",
      title: "Open file",
      arguments: [uri],
    };
  }
}

class AgentContextProvider implements vscode.TreeDataProvider<AgentContextItem> {
  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<AgentContextItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private workspaceRoot: string | undefined;

  refresh(workspaceRoot: string | undefined): void {
    this.workspaceRoot = workspaceRoot;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: AgentContextItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<AgentContextItem[]> {
    const cwd = this.workspaceRoot;

    if (!cwd) {
      return [];
    }

    const items = await Promise.all(
      AGENT_CONTEXT_TARGETS.map(async (target) => {
        try {
          await readFile(resolve(cwd, target.path), "utf8");
          return new AgentContextItem(target, "ready", cwd);
        } catch {
          return new AgentContextItem(target, "missing", cwd);
        }
      }),
    );

    return items;
  }
}

// ---------------------------------------------------------------------------
// Changed Knowledge tree view
// ---------------------------------------------------------------------------

class ChangedFileItem extends vscode.TreeItem {
  constructor(entry: RepoDiffEntry, workspaceRoot: string) {
    super(entry.path, vscode.TreeItemCollapsibleState.None);

    const icon =
      entry.change === "added"
        ? "diff-added"
        : entry.change === "removed"
          ? "diff-removed"
          : "diff-modified";

    this.iconPath = new vscode.ThemeIcon(icon);
    this.description = entry.change;
    this.tooltip = `${entry.change}: ${entry.path}`;

    // Make the item clickable — open the file if it exists
    const uri = vscode.Uri.file(resolve(workspaceRoot, entry.path));
    this.command = {
      command: "vscode.open",
      title: "Open file",
      arguments: [uri],
    };
  }
}

class ChangedKnowledgeProvider
  implements vscode.TreeDataProvider<ChangedFileItem>
{
  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<ChangedFileItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private diff: RepoDiff | null = null;
  private workspaceRoot: string | undefined;

  refresh(workspaceRoot: string | undefined): void {
    this.workspaceRoot = workspaceRoot;
    this._onDidChangeTreeData.fire();
  }

  async load(): Promise<void> {
    const cwd = this.workspaceRoot;

    if (!cwd) {
      this.diff = null;
      return;
    }

    this.diff = await readJsonFile<RepoDiff>(cwd, REPO_DIFF_PATH);
  }

  getTreeItem(element: ChangedFileItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<ChangedFileItem[]> {
    await this.load();

    const cwd = this.workspaceRoot;

    if (!cwd || !this.diff) {
      return [];
    }

    const entries: RepoDiffEntry[] = [
      ...(this.diff.added ?? []).map((e) => ({ ...e, change: "added" as const })),
      ...(this.diff.changed ?? []).map((e) => ({ ...e, change: "changed" as const })),
      ...(this.diff.removed ?? []).map((e) => ({ ...e, change: "removed" as const })),
      ...(this.diff.addedFiles ?? []).map((e) => ({
        path: e.path,
        change: "added" as const,
      })),
      ...(this.diff.changedFiles ?? []).map((e) => ({
        path: e.path,
        change: "changed" as const,
      })),
      ...(this.diff.removedFiles ?? []).map((e) => ({
        path: e.path,
        change: "removed" as const,
      })),
    ];

    return entries.map((e) => new ChangedFileItem(e, cwd));
  }
}

// ---------------------------------------------------------------------------
// Stale Pages tree view
// ---------------------------------------------------------------------------

class StalePageItem extends vscode.TreeItem {
  constructor(
    readonly page: DyKnowPageConfig,
    readonly reasons: string[],
    readonly severity: "low" | "medium" | "high",
    workspaceRoot: string,
  ) {
    super(page.id, vscode.TreeItemCollapsibleState.None);

    this.description = `${severity} · ${reasons[0] ?? "needs review"}`;
    this.tooltip = new vscode.MarkdownString(
      `**${page.title}** (${page.id})\n\n${reasons.map((r) => `- ${r}`).join("\n")}`,
    );
    this.iconPath = new vscode.ThemeIcon(
      severity === "high"
        ? "warning"
        : severity === "medium"
          ? "alert"
          : "clock",
    );

    const uri = vscode.Uri.file(resolve(workspaceRoot, page.outputPath));
    this.command = {
      command: "vscode.open",
      title: "Open page",
      arguments: [uri],
    };
  }
}

class StalePagesProvider implements vscode.TreeDataProvider<StalePageItem> {
  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<StalePageItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private workspaceRoot: string | undefined;
  private staleItems: StalePageItem[] = [];

  refresh(workspaceRoot: string | undefined): void {
    this.workspaceRoot = workspaceRoot;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: StalePageItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<StalePageItem[]> {
    const cwd = this.workspaceRoot;

    if (!cwd) {
      return [];
    }

    const [config, repoDiff, proposals] = await Promise.all([
      readJsonFile<DyKnowConfig>(cwd, CONFIG_PATH),
      readJsonFile<RepoDiff>(cwd, REPO_DIFF_PATH),
      readJsonFile<UpdateDraftBatch>(cwd, PROPOSALS_PATH),
    ]);

    if (!config) {
      this.staleItems = [];
      return this.staleItems;
    }

    const affectedPageIds = new Set(
      (repoDiff?.affectedPages ?? []).map((page) => page.pageId),
    );
    const proposalByPage = new Map(
      (proposals?.drafts ?? []).map((draft) => [draft.proposal.pageId, draft.proposal]),
    );

    const items = await Promise.all(
      config.pages.map(async (page) => {
        const reasons: string[] = [];
        let severity: "low" | "medium" | "high" = "low";

        const pagePath = resolve(cwd, page.outputPath);
        let pageContent = "";
        let missing = false;

        try {
          pageContent = await readFile(pagePath, "utf8");
        } catch {
          missing = true;
        }

        if (missing) {
          reasons.push("page file is missing");
          severity = "high";
        } else {
          const lastReviewed = parseLastReviewedDate(pageContent);

          if (!lastReviewed) {
            reasons.push("missing last_reviewed frontmatter");
            severity = "medium";
          } else {
            const days = getDaysSince(lastReviewed);

            if (days !== undefined && days > 90) {
              reasons.push(`last_reviewed is ${days} days old`);
              severity = severity === "high" ? "high" : "medium";
            }
          }
        }

        if (affectedPageIds.has(page.id)) {
          reasons.push("repo diff shows source drift for this page");
          severity = severity === "high" ? "high" : "medium";
        }

        const proposal = proposalByPage.get(page.id);

        if (proposal) {
          if (
            proposal.reviewState === "Needs review" ||
            proposal.reviewState === "Edited" ||
            proposal.reviewState === "Escalated" ||
            proposal.reviewState === "Drafted"
          ) {
            reasons.push(`proposal is ${proposal.reviewState}`);
            severity = proposal.risk === "high" ? "high" : "medium";
          } else if (
            proposal.reviewState === "Skipped" ||
            proposal.reviewState === "Rejected"
          ) {
            reasons.push(`proposal is ${proposal.reviewState.toLowerCase()}`);
          }
        }

        if (reasons.length === 0) {
          return undefined;
        }

        return new StalePageItem(page, reasons, severity, cwd);
      }),
    );

    this.staleItems = items
      .filter((item): item is StalePageItem => item !== undefined)
      .sort((a, b) => a.label!.toString().localeCompare(b.label!.toString()));

    return this.staleItems;
  }
}

// ---------------------------------------------------------------------------
// Suggested Updates tree view
// ---------------------------------------------------------------------------

class ProposalItem extends vscode.TreeItem {
  constructor(readonly draft: UpdateDraft) {
    const { proposal } = draft;
    super(proposal.pageId, vscode.TreeItemCollapsibleState.None);

    const riskIcon =
      proposal.risk === "high"
        ? "$(warning)"
        : proposal.risk === "medium"
          ? "$(info)"
          : "$(circle-outline)";

    const stateIcon =
      proposal.reviewState === "Approved"
        ? "$(check)"
        : proposal.reviewState === "Rejected"
          ? "$(close)"
          : proposal.reviewState === "Escalated"
            ? "$(warning)"
            : proposal.reviewState === "Edited"
              ? "$(edit)"
        : proposal.reviewState === "Skipped"
          ? "$(x)"
          : "$(circle-large-outline)";

    this.label = `${stateIcon} ${proposal.pageId}`;
    this.description = `${riskIcon} ${proposal.risk} · ${proposal.confidence}`;
    this.tooltip = new vscode.MarkdownString(
      `**${proposal.pageId}** (${proposal.reviewState})\n\n` +
        `${proposal.summary}\n\n` +
        `**Why:** ${proposal.why}\n\n` +
        `**Risk:** ${proposal.risk}  **Confidence:** ${proposal.confidence}\n\n` +
        `**Sources:** ${proposal.sources.join(", ")}`,
    );

    // contextValue drives which inline actions appear (see menus in package.json)
    this.contextValue =
      proposal.reviewState === "Needs review"
        ? "proposal-needs-review"
        : proposal.reviewState === "Approved"
          ? "proposal-approved"
          : proposal.reviewState === "Rejected"
            ? "proposal-rejected"
            : proposal.reviewState === "Escalated"
              ? "proposal-escalated"
              : proposal.reviewState === "Edited"
                ? "proposal-edited"
          : "proposal-skipped";

    this.command = {
      command: "dyknow.viewDiff",
      title: "View diff",
      arguments: [this],
    };
  }
}

class SuggestedUpdatesProvider
  implements vscode.TreeDataProvider<ProposalItem>
{
  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<ProposalItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private batch: UpdateDraftBatch | null = null;
  private workspaceRoot: string | undefined;

  refresh(workspaceRoot: string | undefined): void {
    this.workspaceRoot = workspaceRoot;
    this._onDidChangeTreeData.fire();
  }

  async load(): Promise<void> {
    const cwd = this.workspaceRoot;

    if (!cwd) {
      this.batch = null;
      return;
    }

    this.batch = await readJsonFile<UpdateDraftBatch>(cwd, PROPOSALS_PATH);
  }

  getTreeItem(element: ProposalItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<ProposalItem[]> {
    await this.load();

    if (!this.batch) {
      return [];
    }

    return this.batch.drafts.map((d) => new ProposalItem(d));
  }

  get pendingCount(): number {
    const pendingStates = new Set<ReviewState>([
      "Drafted",
      "Needs review",
      "Escalated",
      "Edited",
    ]);

    return (
      this.batch?.drafts.filter(
        (d) => pendingStates.has(d.proposal.reviewState),
      ).length ?? 0
    );
  }

  get approvedCount(): number {
    return (
      this.batch?.drafts.filter(
        (d) => d.proposal.reviewState === "Approved",
      ).length ?? 0
    );
  }
}

// ---------------------------------------------------------------------------
// Status bar
// ---------------------------------------------------------------------------

function createStatusBarItem(): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );

  item.name = "DyKnow";
  item.command = "dyknow.refreshViews";
  updateStatusBar(item, null);
  item.show();

  return item;
}

function updateStatusBar(
  item: vscode.StatusBarItem,
  updatesProvider: SuggestedUpdatesProvider | null,
): void {
  if (!updatesProvider) {
    item.text = "$(search-view-icon) DyKnow";
    item.tooltip = "DyKnow — click to refresh";
    return;
  }

  const pending = updatesProvider.pendingCount;
  const approved = updatesProvider.approvedCount;

  if (pending > 0) {
    item.text = `$(search-view-icon) DyKnow $(circle-large-filled) ${pending} pending`;
    item.tooltip = `DyKnow — ${pending} update(s) need review, ${approved} approved`;
    item.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground",
    );
  } else if (approved > 0) {
    item.text = `$(search-view-icon) DyKnow $(check) ${approved} approved`;
    item.tooltip = `DyKnow — ${approved} update(s) approved, ready to commit`;
    item.backgroundColor = undefined;
  } else {
    item.text = "$(search-view-icon) DyKnow";
    item.tooltip = "DyKnow — no pending updates";
    item.backgroundColor = undefined;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createSourceCommandUri(workspaceRoot: string, source: string): string {
  const targetUri = resolveSourceUri(workspaceRoot, source);
  const commandArgs = encodeURIComponent(JSON.stringify([targetUri]));
  return `command:vscode.open?${commandArgs}`;
}

function resolveSourceUri(workspaceRoot: string, source: string): vscode.Uri {
  return /^https?:\/\//i.test(source)
    ? vscode.Uri.parse(source)
    : vscode.Uri.file(resolve(workspaceRoot, source));
}

function buildEvidenceHtml(workspaceRoot: string, draft: UpdateDraft): string {
  const { proposal } = draft;

  const sourcesHtml = proposal.sources.length
    ? proposal.sources
        .map((source) => {
          const href = createSourceCommandUri(workspaceRoot, source);
          return `<li><a href="${href}"><code>${escapeHtml(source)}</code></a></li>`;
        })
        .join("\n")
    : "<li><em>No sources were captured for this proposal.</em></li>";

  const humanReviewBadge = proposal.requiresHumanReview
    ? '<p><strong>Human review:</strong> <span class="badge high">required</span></p>'
    : '<p><strong>Human review:</strong> <span class="badge low">not required</span></p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: var(--vscode-font-family); padding: 16px; }
    h2 { margin-top: 0; }
    a { color: var(--vscode-textLink-foreground); text-decoration: none; }
    a:hover { text-decoration: underline; }
    code {
      background: var(--vscode-textCodeBlock-background);
      border-radius: 4px;
      padding: 1px 4px;
    }
    .badge { padding: 2px 6px; border-radius: 4px; font-size: 0.85em; }
    .high {
      background: var(--vscode-statusBarItem-warningBackground);
      color: var(--vscode-statusBarItem-warningForeground);
    }
    .medium {
      background: var(--vscode-editorWarning-foreground);
      color: var(--vscode-editor-background);
    }
    .low {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    ul { padding-left: 20px; }
  </style>
</head>
<body>
  <h2>${escapeHtml(proposal.pageId)}</h2>
  <p>${escapeHtml(proposal.summary)}</p>
  <p><strong>Why:</strong> ${escapeHtml(proposal.why)}</p>
  <p>
    Risk: <span class="badge ${proposal.risk}">${escapeHtml(proposal.risk)}</span>
    Confidence: <span class="badge ${proposal.confidence}">${escapeHtml(
      proposal.confidence,
    )}</span>
  </p>
  ${humanReviewBadge}
  <h3>Sources (${proposal.sources.length})</h3>
  <ul>${sourcesHtml}</ul>
</body>
</html>`;
}

class SourceEvidenceItem extends vscode.TreeItem {
  constructor(
    label: string,
    options?: {
      description?: string;
      tooltip?: string | vscode.MarkdownString;
      iconId?: string;
      command?: vscode.Command;
    },
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);

    this.description = options?.description;
    this.tooltip = options?.tooltip;
    this.iconPath = options?.iconId
      ? new vscode.ThemeIcon(options.iconId)
      : undefined;
    this.command = options?.command;
  }
}

class SourceEvidenceProvider
  implements vscode.TreeDataProvider<SourceEvidenceItem>
{
  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<SourceEvidenceItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private workspaceRoot: string | undefined;
  private selectedDraft: UpdateDraft | undefined;

  refresh(workspaceRoot: string | undefined): void {
    this.workspaceRoot = workspaceRoot;
    this._onDidChangeTreeData.fire();
  }

  showDraft(draft: UpdateDraft | undefined): void {
    this.selectedDraft = draft;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SourceEvidenceItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<SourceEvidenceItem[]> {
    const cwd = this.workspaceRoot;

    if (!cwd) {
      return [];
    }

    if (!this.selectedDraft) {
      return [
        new SourceEvidenceItem("Select a suggested update", {
          description: "Source Evidence follows the active proposal.",
          tooltip:
            "Select a proposal in Suggested Updates to inspect its source evidence.",
          iconId: "info",
        }),
      ];
    }

    const { proposal, affectedPage } = this.selectedDraft;
    const summaryLines = [
      proposal.summary,
      `Why: ${proposal.why}`,
      `Review: ${proposal.reviewState}`,
      `Risk: ${proposal.risk}`,
      `Confidence: ${proposal.confidence}`,
      `Human review: ${proposal.requiresHumanReview ? "required" : "not required"}`,
    ];
    const items = [
      new SourceEvidenceItem(proposal.pageId, {
        description: `${proposal.reviewState} · ${proposal.risk} risk · ${proposal.confidence} confidence`,
        tooltip: summaryLines.join("\n"),
        iconId: proposal.requiresHumanReview ? "warning" : "check",
      }),
      new SourceEvidenceItem(affectedPage.outputPath, {
        description: "Maintained output",
        tooltip: `Open maintained output for ${proposal.pageId}`,
        iconId: "file",
        command: {
          command: "vscode.open",
          title: "Open maintained output",
          arguments: [vscode.Uri.file(resolve(cwd, affectedPage.outputPath))],
        },
      }),
    ];

    if (proposal.sources.length === 0) {
      items.push(
        new SourceEvidenceItem("No captured sources", {
          description: "This proposal did not record source evidence.",
          iconId: "warning",
        }),
      );

      return items;
    }

    for (const source of proposal.sources) {
      items.push(
        new SourceEvidenceItem(source, {
          description: /^https?:\/\//i.test(source)
            ? "External source"
            : "Workspace source",
          tooltip: `Open source evidence: ${source}`,
          iconId: "references",
          command: {
            command: "vscode.open",
            title: "Open source evidence",
            arguments: [resolveSourceUri(cwd, source)],
          },
        }),
      );
    }

    return items;
  }
}

// ---------------------------------------------------------------------------
// Activate
// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext): void {
  // Set context flag so views show up
  void vscode.commands.executeCommand(
    "setContext",
    "dyknow:hasConfig",
    vscode.workspace.workspaceFolders !== undefined,
  );

  const dyKnowMapProvider = new DyKnowMapProvider();
  const agentContextProvider = new AgentContextProvider();
  const changedKnowledgeProvider = new ChangedKnowledgeProvider();
  const stalePagesProvider = new StalePagesProvider();
  const suggestedUpdatesProvider = new SuggestedUpdatesProvider();
  const sourceEvidenceProvider = new SourceEvidenceProvider();
  const statusBarItem = createStatusBarItem();

  // Register tree views
  const dyKnowMapView = vscode.window.createTreeView("dyknow.map", {
    treeDataProvider: dyKnowMapProvider,
    showCollapseAll: true,
  });

  const changedKnowledgeView = vscode.window.createTreeView(
    "dyknow.changedKnowledge",
    {
      treeDataProvider: changedKnowledgeProvider,
      showCollapseAll: false,
    },
  );

  const agentContextView = vscode.window.createTreeView("dyknow.agentContext", {
    treeDataProvider: agentContextProvider,
    showCollapseAll: false,
  });

  const stalePagesView = vscode.window.createTreeView("dyknow.stalePages", {
    treeDataProvider: stalePagesProvider,
    showCollapseAll: false,
  });

  const suggestedUpdatesView = vscode.window.createTreeView(
    "dyknow.suggestedUpdates",
    {
      treeDataProvider: suggestedUpdatesProvider,
      showCollapseAll: false,
      canSelectMany: true,
    },
  );

  const sourceEvidenceView = vscode.window.createTreeView(
    "dyknow.sourceEvidence",
    {
      treeDataProvider: sourceEvidenceProvider,
      showCollapseAll: false,
    },
  );

  function refreshViews(): void {
    const cwd = getWorkspacePath();
    dyKnowMapProvider.refresh(cwd);
    agentContextProvider.refresh(cwd);
    changedKnowledgeProvider.refresh(cwd);
    stalePagesProvider.refresh(cwd);
    suggestedUpdatesProvider.refresh(cwd);
    sourceEvidenceProvider.refresh(cwd);
    // Give providers time to re-render before updating status bar
    setTimeout(() => {
      updateStatusBar(statusBarItem, suggestedUpdatesProvider);
    }, 300);
  }

  suggestedUpdatesView.onDidChangeSelection(({ selection }) => {
    sourceEvidenceProvider.showDraft(selection[0]?.draft);
  });

  // Initial load
  refreshViews();

  // ---------------------------------------------------------------------------
  // Commands
  // ---------------------------------------------------------------------------

  const commands = [
    vscode.commands.registerCommand("dyknow.refreshViews", () => {
      refreshViews();
    }),

    vscode.commands.registerCommand("dyknow.scan", async () => {
      const cwd = getWorkspacePath();

      if (!cwd) {
        void vscode.window.showErrorMessage("Open a workspace folder first.");
        return;
      }

      getOutput().show(true);

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "DyKnow: Scanning workspace…",
            cancellable: false,
          },
          async () => runCli(cwd, ["scan"]),
        );

        refreshViews();
        void vscode.window.showInformationMessage("DyKnow scan complete.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`DyKnow scan failed: ${msg}`);
      }
    }),

    vscode.commands.registerCommand("dyknow.diff", async () => {
      const cwd = getWorkspacePath();

      if (!cwd) {
        void vscode.window.showErrorMessage("Open a workspace folder first.");
        return;
      }

      getOutput().show(true);

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "DyKnow: Detecting changes…",
            cancellable: false,
          },
          async () => runCli(cwd, ["diff"]),
        );

        refreshViews();
        void vscode.window.showInformationMessage(
          "DyKnow change detection complete.",
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(
          `DyKnow change detection failed: ${msg}`,
        );
      }
    }),

    vscode.commands.registerCommand("dyknow.update", async () => {
      const cwd = getWorkspacePath();

      if (!cwd) {
        void vscode.window.showErrorMessage("Open a workspace folder first.");
        return;
      }

      getOutput().show(true);
      const config = vscode.workspace.getConfiguration("dyknow");
      const provider = config.get<string>("llmProvider", "anthropic");
      const model =
        provider === "anthropic"
          ? config.get<string>("anthropicModel", "claude-sonnet-4-6")
          : config.get<string>("openaiModel", "gpt-4o");
      const args = ["update", "--provider", provider, "--model", model];

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "DyKnow: Drafting updates…",
            cancellable: false,
          },
          async () => runCli(cwd, args),
        );

        refreshViews();
        void vscode.window.showInformationMessage(
          "DyKnow update drafts written. Review them in the Suggested Updates panel.",
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`DyKnow update failed: ${msg}`);
      }
    }),

    vscode.commands.registerCommand(
      "dyknow.approveProposal",
      async (item: ProposalItem) => {
        const cwd = getWorkspacePath();

        if (!cwd || !item) return;

        try {
          await runCli(cwd, [
            "review",
            "--approve",
            "--page",
            item.draft.proposal.pageId,
          ]);

          refreshViews();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          void vscode.window.showErrorMessage(`DyKnow approve failed: ${msg}`);
        }
      },
    ),

    vscode.commands.registerCommand(
      "dyknow.skipProposal",
      async (item: ProposalItem) => {
        const cwd = getWorkspacePath();

        if (!cwd || !item) return;

        try {
          await runCli(cwd, [
            "review",
            "--skip",
            "--page",
            item.draft.proposal.pageId,
          ]);

          refreshViews();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          void vscode.window.showErrorMessage(`DyKnow skip failed: ${msg}`);
        }
      },
    ),

    vscode.commands.registerCommand(
      "dyknow.rejectProposal",
      async (item: ProposalItem) => {
        const cwd = getWorkspacePath();

        if (!cwd || !item) return;

        try {
          await runCli(cwd, [
            "review",
            "--reject",
            "--page",
            item.draft.proposal.pageId,
          ]);

          refreshViews();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          void vscode.window.showErrorMessage(`DyKnow reject failed: ${msg}`);
        }
      },
    ),

    vscode.commands.registerCommand(
      "dyknow.regenerateProposal",
      async (item: ProposalItem) => {
        const cwd = getWorkspacePath();

        if (!cwd || !item) return;

        try {
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `DyKnow: Regenerating ${item.draft.proposal.pageId}...`,
              cancellable: false,
            },
            async () =>
              runCli(cwd, [
                "review",
                "--regenerate",
                "--page",
                item.draft.proposal.pageId,
              ]),
          );

          refreshViews();
          void vscode.window.showInformationMessage(
            `DyKnow regenerated proposal for ${item.draft.proposal.pageId}.`,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          void vscode.window.showErrorMessage(`DyKnow regenerate failed: ${msg}`);
        }
      },
    ),

    vscode.commands.registerCommand(
      "dyknow.editProposal",
      async (item: ProposalItem) => {
        const cwd = getWorkspacePath();

        if (!cwd || !item) return;

        const doc = await vscode.workspace.openTextDocument({
          content: item.draft.proposal.proposedText,
          language: "markdown",
        });
        await vscode.window.showTextDocument(doc, {
          preview: false,
          viewColumn: vscode.ViewColumn.Beside,
        });

        const choice = await vscode.window.showInformationMessage(
          `Edit ${item.draft.proposal.pageId}, then apply changes to DyKnow proposal state.`,
          "Apply",
          "Cancel",
        );

        if (choice !== "Apply") {
          return;
        }

        const editedText = doc.getText();

        try {
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `DyKnow: Saving edits for ${item.draft.proposal.pageId}...`,
              cancellable: false,
            },
            async () =>
              runCli(cwd, [
                "review",
                "--edit",
                "--page",
                item.draft.proposal.pageId,
                "--text",
                editedText,
              ]),
          );

          refreshViews();
          void vscode.window.showInformationMessage(
            `DyKnow saved edited proposal for ${item.draft.proposal.pageId}.`,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          void vscode.window.showErrorMessage(`DyKnow edit failed: ${msg}`);
        }
      },
    ),

    vscode.commands.registerCommand(
      "dyknow.markSourceIrrelevant",
      async (item: ProposalItem) => {
        const cwd = getWorkspacePath();

        if (!cwd || !item) return;

        const pageId = item.draft.proposal.pageId;
        const sources = item.draft.proposal.sources;

        if (sources.length === 0) {
          void vscode.window.showWarningMessage(
            `No sources are attached to proposal ${pageId}.`,
          );
          return;
        }

        const existingOverrides =
          (await readJsonFile<SourceOverrides>(cwd, SOURCE_OVERRIDES_PATH)) ?? {
            pages: {},
          };

        const existingIgnored =
          existingOverrides.pages[pageId]?.ignoredSources ?? [];

        const picked = await vscode.window.showQuickPick(
          sources.map((source) => ({
            label: source,
            picked: existingIgnored.includes(source),
          })),
          {
            title: `Mark irrelevant sources for ${pageId}`,
            canPickMany: true,
            ignoreFocusOut: true,
            placeHolder: "Select sources to ignore for this page.",
          },
        );

        if (!picked) {
          return;
        }

        const ignoredSources = [...new Set(picked.map((choice) => choice.label))];

        existingOverrides.pages[pageId] = {
          ignoredSources,
          updatedAt: new Date().toISOString(),
        };

        await writeJsonFile(cwd, SOURCE_OVERRIDES_PATH, existingOverrides);

        getOutput().show(true);
        getOutput().appendLine(
          `[source-overrides] Updated ${SOURCE_OVERRIDES_PATH} for ${pageId}: ${ignoredSources.length} ignored source(s).`,
        );

        void vscode.window.showInformationMessage(
          `Saved ${ignoredSources.length} ignored source(s) for ${pageId}.`,
        );
      },
    ),

    vscode.commands.registerCommand(
      "dyknow.viewDiff",
      async (item: ProposalItem) => {
        const cwd = getWorkspacePath();

        if (!cwd || !item) return;

        const { proposal } = item.draft;
        const outputPath = item.draft.affectedPage.outputPath;
        const currentUri = vscode.Uri.file(resolve(cwd, outputPath));
        const tmpPath = resolve(tmpdir(), `dyknow-proposed-${proposal.pageId}.md`);

        try {
          await writeFile(tmpPath, proposal.proposedText, "utf8");

          const proposedUri = vscode.Uri.file(tmpPath);
          await vscode.commands.executeCommand(
            "vscode.diff",
            currentUri,
            proposedUri,
            `DyKnow: ${proposal.pageId} - current <-> proposed`,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          void vscode.window.showErrorMessage(`DyKnow diff viewer failed: ${msg}`);
        }
      },
    ),

    vscode.commands.registerCommand(
      "dyknow.showEvidence",
      async (item: ProposalItem) => {
        const cwd = getWorkspacePath();

        const activeItem = item ?? suggestedUpdatesView.selection[0];

        if (!cwd || !activeItem) return;

        sourceEvidenceProvider.refresh(cwd);
        sourceEvidenceProvider.showDraft(activeItem.draft);
        await vscode.commands.executeCommand("workbench.view.extension.dyknow");
      },
    ),

    vscode.commands.registerCommand("dyknow.commit", async () => {
      const cwd = getWorkspacePath();

      if (!cwd) {
        void vscode.window.showErrorMessage("Open a workspace folder first.");
        return;
      }

      getOutput().show(true);
      const config = vscode.workspace.getConfiguration("dyknow");
      const args = ["commit"];

      if (config.get<boolean>("allowHighRisk", false)) {
        args.push("--allow-high-risk");
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "DyKnow: Committing approved updates…",
            cancellable: false,
          },
          async () => runCli(cwd, args),
        );

        refreshViews();
        void vscode.window.showInformationMessage("DyKnow commit complete.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`DyKnow commit failed: ${msg}`);
      }
    }),

    vscode.commands.registerCommand("dyknow.regeneratePending", async () => {
      const cwd = getWorkspacePath();

      if (!cwd) {
        void vscode.window.showErrorMessage("Open a workspace folder first.");
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        "Regenerate all pending DyKnow proposals? This will replace current pending proposal text.",
        { modal: true },
        "Regenerate All",
      );

      if (confirm !== "Regenerate All") {
        return;
      }

      getOutput().show(true);

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "DyKnow: Regenerating pending proposals...",
            cancellable: false,
          },
          async () => runCli(cwd, ["review", "--regenerate", "--all"]),
        );

        refreshViews();
        void vscode.window.showInformationMessage(
          "DyKnow regenerated all pending proposals.",
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(
          `DyKnow regenerate all failed: ${msg}`,
        );
      }
    }),

    vscode.commands.registerCommand(
      "dyknow.regenerateSelected",
      async (item?: ProposalItem) => {
        const cwd = getWorkspacePath();

        if (!cwd) {
          void vscode.window.showErrorMessage("Open a workspace folder first.");
          return;
        }

        const selectedItems =
          suggestedUpdatesView.selection.length > 0
            ? [...suggestedUpdatesView.selection]
            : item
              ? [item]
              : [];

        if (selectedItems.length === 0) {
          void vscode.window.showWarningMessage(
            "Select one or more proposals in Suggested Updates first.",
          );
          return;
        }

        const pageIds = [...new Set(selectedItems.map((d) => d.draft.proposal.pageId))];
        const confirm = await vscode.window.showWarningMessage(
          `Regenerate ${pageIds.length} selected DyKnow proposal(s)?`,
          { modal: true },
          "Regenerate Selected",
        );

        if (confirm !== "Regenerate Selected") {
          return;
        }

        const args = ["review", "--regenerate"];

        for (const pageId of pageIds) {
          args.push("--page", pageId);
        }

        getOutput().show(true);

        try {
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `DyKnow: Regenerating ${pageIds.length} selected proposal(s)...`,
              cancellable: false,
            },
            async () => runCli(cwd, args),
          );

          refreshViews();
          void vscode.window.showInformationMessage(
            `DyKnow regenerated ${pageIds.length} selected proposal(s).`,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          void vscode.window.showErrorMessage(
            `DyKnow regenerate selected failed: ${msg}`,
          );
        }
      },
    ),

    vscode.commands.registerCommand("dyknow.rejectPending", async () => {
      const cwd = getWorkspacePath();

      if (!cwd) {
        void vscode.window.showErrorMessage("Open a workspace folder first.");
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        "Reject all pending DyKnow proposals?",
        { modal: true },
        "Reject All",
      );

      if (confirm !== "Reject All") {
        return;
      }

      getOutput().show(true);

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "DyKnow: Rejecting pending proposals...",
            cancellable: false,
          },
          async () => runCli(cwd, ["review", "--reject", "--all"]),
        );

        refreshViews();
        void vscode.window.showInformationMessage(
          "DyKnow rejected all pending proposals.",
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`DyKnow reject all failed: ${msg}`);
      }
    }),

    vscode.commands.registerCommand(
      "dyknow.rejectSelected",
      async (item?: ProposalItem) => {
        const cwd = getWorkspacePath();

        if (!cwd) {
          void vscode.window.showErrorMessage("Open a workspace folder first.");
          return;
        }

        const selectedItems =
          suggestedUpdatesView.selection.length > 0
            ? [...suggestedUpdatesView.selection]
            : item
              ? [item]
              : [];

        if (selectedItems.length === 0) {
          void vscode.window.showWarningMessage(
            "Select one or more proposals in Suggested Updates first.",
          );
          return;
        }

        const pageIds = [...new Set(selectedItems.map((d) => d.draft.proposal.pageId))];
        const confirm = await vscode.window.showWarningMessage(
          `Reject ${pageIds.length} selected DyKnow proposal(s)?`,
          { modal: true },
          "Reject Selected",
        );

        if (confirm !== "Reject Selected") {
          return;
        }

        const args = ["review", "--reject"];

        for (const pageId of pageIds) {
          args.push("--page", pageId);
        }

        getOutput().show(true);

        try {
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `DyKnow: Rejecting ${pageIds.length} selected proposal(s)...`,
              cancellable: false,
            },
            async () => runCli(cwd, args),
          );

          refreshViews();
          void vscode.window.showInformationMessage(
            `DyKnow rejected ${pageIds.length} selected proposal(s).`,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          void vscode.window.showErrorMessage(
            `DyKnow reject selected failed: ${msg}`,
          );
        }
      },
    ),

    vscode.commands.registerCommand("dyknow.openPr", async () => {
      const cwd = getWorkspacePath();

      if (!cwd) {
        void vscode.window.showErrorMessage("Open a workspace folder first.");
        return;
      }

      const defaultBranch = `dyknow/updates-${new Date().toISOString().slice(0, 10)}`;
      const branch = await vscode.window.showInputBox({
        prompt: "Branch name for the DyKnow PR",
        placeHolder: defaultBranch,
        value: defaultBranch,
      });

      if (!branch) return;

      getOutput().show(true);

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "DyKnow: Opening PR…",
            cancellable: false,
          },
          async () => runCli(cwd, ["pr", "--branch", branch]),
        );

        void vscode.window.showInformationMessage(
          "DyKnow PR opened. See the Output panel for the URL.",
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`DyKnow open PR failed: ${msg}`);
      }
    }),
  ];

  context.subscriptions.push(
    dyKnowMapView,
    agentContextView,
    changedKnowledgeView,
    stalePagesView,
    suggestedUpdatesView,
    sourceEvidenceView,
    statusBarItem,
    ...commands,
  );
}

export function deactivate(): void {
  _outputChannel?.dispose();
}
