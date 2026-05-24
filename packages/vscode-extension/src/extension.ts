import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
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
const REPO_DIFF_PATH = `${STATE_DIR}/repo-diff.json`;
const PROPOSALS_PATH = `${STATE_DIR}/update-proposals.json`;

// ---------------------------------------------------------------------------
// Types (mirrors core contracts without importing @dyknow/core to keep the
// bundle simple — vscode extensions run in a CommonJS host)
// ---------------------------------------------------------------------------

interface RepoDiffEntry {
  path: string;
  change: "added" | "changed" | "removed";
}

interface RepoDiff {
  added: RepoDiffEntry[];
  changed: RepoDiffEntry[];
  removed: RepoDiffEntry[];
}

type ReviewState = "Needs review" | "Approved" | "Skipped";

interface UpdateProposal {
  pageId: string;
  summary: string;
  why: string;
  risk: "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
  reviewState: ReviewState;
  sources: string[];
  outputPath: string;
}

interface UpdateDraft {
  proposal: UpdateProposal;
}

interface UpdateDraftBatch {
  drafts: UpdateDraft[];
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

  if (!opts?.silent) {
    output.appendLine(`\n$ dyknow ${args.join(" ")}`);
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

    return stdout;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown DyKnow error.";

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
    new vscode.EventEmitter<ChangedFileItem | undefined | void>();
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
    ];

    return entries.map((e) => new ChangedFileItem(e, cwd));
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
          : "proposal-skipped";
  }
}

class SuggestedUpdatesProvider
  implements vscode.TreeDataProvider<ProposalItem>
{
  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<ProposalItem | undefined | void>();
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
    return (
      this.batch?.drafts.filter(
        (d) => d.proposal.reviewState === "Needs review",
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

  const changedKnowledgeProvider = new ChangedKnowledgeProvider();
  const suggestedUpdatesProvider = new SuggestedUpdatesProvider();
  const statusBarItem = createStatusBarItem();

  // Register tree views
  const changedKnowledgeView = vscode.window.createTreeView(
    "dyknow.changedKnowledge",
    {
      treeDataProvider: changedKnowledgeProvider,
      showCollapseAll: false,
    },
  );

  const suggestedUpdatesView = vscode.window.createTreeView(
    "dyknow.suggestedUpdates",
    {
      treeDataProvider: suggestedUpdatesProvider,
      showCollapseAll: false,
    },
  );

  function refreshViews(): void {
    const cwd = getWorkspacePath();
    changedKnowledgeProvider.refresh(cwd);
    suggestedUpdatesProvider.refresh(cwd);
    // Give providers time to re-render before updating status bar
    setTimeout(() => {
      updateStatusBar(statusBarItem, suggestedUpdatesProvider);
    }, 300);
  }

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

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "DyKnow: Drafting updates…",
            cancellable: false,
          },
          async () => runCli(cwd, ["update"]),
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

    vscode.commands.registerCommand("dyknow.commit", async () => {
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
            title: "DyKnow: Committing approved updates…",
            cancellable: false,
          },
          async () => runCli(cwd, ["commit"]),
        );

        refreshViews();
        void vscode.window.showInformationMessage("DyKnow commit complete.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`DyKnow commit failed: ${msg}`);
      }
    }),

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
    changedKnowledgeView,
    suggestedUpdatesView,
    statusBarItem,
    ...commands,
  );
}

export function deactivate(): void {
  _outputChannel?.dispose();
}
