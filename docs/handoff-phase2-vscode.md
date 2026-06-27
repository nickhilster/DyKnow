---
title: Phase 2 VS Code Extension — Handoff to GitHub Copilot
purpose: Give a fresh agent the context needed to finish the remaining Phase 2 tasks without re-deriving what already exists.
audience: agent
sources:
  - packages/vscode-extension/src/extension.ts
  - packages/vscode-extension/package.json
  - packages/vscode-extension/esbuild.mjs
  - packages/vscode-extension/tsconfig.json
  - packages/core/src/contracts.ts
  - packages/core/src/update-runner.ts
  - docs/implementation-roadmap.md
  - AGENTS.md
last_reviewed: 2026-05-24
confidence: high
---

## Summary

The DyKnow VS Code extension is ~60% complete. The sidebar panel, tree views, inline approve/skip actions, status bar, and all CLI-backed commands are wired up and building cleanly. The remaining Phase 2 work is: a diff viewer for proposed content, a source evidence webview panel, a settings UI for config overrides, `@dyknow/vscode-extension` publishing prep (`vsce package`), and marking the Phase 2 items done in `docs/implementation-roadmap.md`. Read this entire file before touching any code.

---

## Repository layout

```
packages/
  core/           — shared contracts, repo-map, repo-diff, update-runner, output-templates
  cli/            — dyknow CLI commands (scan, diff, update, review, commit, pr, log, status, init)
  vscode-extension/
    src/
      extension.ts   — THE ONLY SOURCE FILE (622 lines, all logic here for now)
    dist/
      extension.js   — esbuild ESM bundle (built from extension.ts)
    package.json   — VS Code extension manifest
    esbuild.mjs    — build script
    tsconfig.json  — type-check only (noEmit: true, moduleResolution: bundler)
docs/             — DyKnow wiki pages
AGENTS.md         — agent context (read this for repo-wide standards)
CLAUDE.md         — wiki maintainer schema
```

---

## Branch

```
phase2/vscode-extension-prototype
```

All work goes on this branch. Open a PR to `main` when Phase 2 is complete.

---

## Build

```sh
# From repo root
npm install                             # installs all workspaces
npm run build                          # tsc -b (core + cli) then esbuild (extension)

# Extension only
cd packages/vscode-extension
node esbuild.mjs                       # bundle → dist/extension.js
node esbuild.mjs --watch               # watch mode
npx tsc --noEmit                       # type-check only (no emit — esbuild builds)

# Tests (core + cli only — extension has no unit tests yet)
npm test                               # 147 tests, all must stay green
npm run lint                           # Biome — must pass
```

**Never run `tsc -b` inside `packages/vscode-extension/`** — its tsconfig has `composite: false` and `noEmit: true`. The root `tsc -b` only references `packages/core` and `packages/cli`.

---

## What is already done

| Item | Where |
|---|---|
| Extension scaffold, activation on `dyknow.config.json` | `package.json` → `activationEvents` |
| Activity bar container (`dyknow`) | `package.json` → `contributes.viewsContainers` |
| **Changed Knowledge** tree view | `ChangedKnowledgeProvider` in `extension.ts` |
| **Suggested Updates** tree view | `SuggestedUpdatesProvider` in `extension.ts` |
| Inline Approve / Skip buttons on pending proposals | `view/item/context` menus + `dyknow.approveProposal` / `dyknow.skipProposal` commands |
| Status bar: pending count + warning background | `createStatusBarItem` / `updateStatusBar` in `extension.ts` |
| Commands: scan, diff, update, commit, openPr, refreshViews | All registered in `activate()` |
| Output channel for CLI stdout/stderr | `getOutput()` singleton in `extension.ts` |
| Progress notifications on long-running commands | `vscode.window.withProgress` wrappers |
| esbuild ESM bundle replacing tsc+NodeNext | `esbuild.mjs` → `dist/extension.js` |

---

## What is NOT done — remaining Phase 2 tasks

Work through these in order. Each task has enough detail to implement without asking questions.

---

### Task 1 — Diff viewer for proposed content

**Goal:** when the user clicks a proposal in the Suggested Updates view, open VS Code's native diff editor showing the current page content on the left and the `proposedText` on the right.

**Where `proposedText` lives:**  
`docs/dyknow/.state/update-proposals.json` → `drafts[].proposal.proposedText` (a full markdown string).  
The proposal also has `drafts[].affectedPage.outputPath` — the relative path to the page file in the repo.

**The `drafts[]` element structure** (from `DraftedPageUpdateSchema` in `packages/core/src/update-runner.ts`):
```ts
{
  affectedPage: {
    id: string,          // page id
    outputPath: string,  // relative path e.g. "docs/architecture.md"
    // ...
  },
  proposal: {
    pageId: string,
    summary: string,
    why: string,
    sources: string[],
    proposedText: string,  // ← full proposed markdown content
    confidence: "low" | "medium" | "high",
    risk: "low" | "medium" | "high",
    reviewState: "Needs review" | "Approved" | "Skipped",
    requiresHumanReview: boolean,
  },
  providerTelemetry: { ... },
}
```

**Note:** `extension.ts` currently defines its own local `UpdateProposal` interface that mirrors the schema but **omits** `proposedText` and `requiresHumanReview`. Add those two fields to the local interface:

```ts
interface UpdateProposal {
  // ... existing fields ...
  proposedText: string;        // ← add this
  requiresHumanReview: boolean; // ← add this
}
```

Also add `outputPath` to the local `UpdateDraft` or extend `ProposalItem` to carry `affectedPage.outputPath`.

**Implementation steps:**

1. Add `proposedText: string` and `requiresHumanReview: boolean` to the local `UpdateProposal` interface.
2. Add `affectedPage: { outputPath: string }` to the local `UpdateDraft` interface.
3. Add a command `dyknow.viewDiff` registered in `activate()`.
4. In `ProposalItem`, set `this.command = { command: "dyknow.viewDiff", title: "View diff", arguments: [this] }` so clicking the item fires the command.
5. In the `dyknow.viewDiff` handler:
   ```ts
   async (item: ProposalItem) => {
     const cwd = getWorkspacePath();
     if (!cwd || !item) return;

     const { proposal, affectedPage } = item.draft;
     const outputPath = affectedPage.outputPath; // e.g. "docs/architecture.md"

     // Left side: current file on disk (may not exist for new pages)
     const currentUri = vscode.Uri.file(resolve(cwd, outputPath));

     // Right side: proposed text as an untitled virtual document
     // Use a TextDocumentContentProvider for in-memory content.
     // The simplest approach that works without a full provider:
     // write to a temp file in the OS temp dir, then diff.
     const { tmpdir } = await import("node:os");
     const tmpPath = resolve(tmpdir(), `dyknow-proposed-${proposal.pageId}.md`);
     await writeFile(tmpPath, proposal.proposedText, "utf8");
     const proposedUri = vscode.Uri.file(tmpPath);

     await vscode.commands.executeCommand(
       "vscode.diff",
       currentUri,
       proposedUri,
       `DyKnow: ${proposal.pageId} — current ↔ proposed`,
     );
   }
   ```
6. Add `writeFile` to the existing `import { readFile } from "node:fs/promises"` import.

**Known edge case:** if `outputPath` points to a file that doesn't exist yet (new page), `currentUri` will be empty — VS Code's diff editor handles this gracefully (shows empty left side). No special handling needed.

---

### Task 2 — Source evidence webview panel

**Goal:** selecting a proposal shows a panel (beside the editor) listing the source files that triggered the update, with clickable links to open each file.

**Approach:** use a `vscode.WebviewPanel` (not a `TreeView`) — it gives richer layout for evidence.

**Implementation steps:**

1. Add a command `dyknow.showEvidence` with an icon `$(references)`.
2. Register it in `package.json` → `commands` and add it to `view/item/context` for all proposal states (`proposal-needs-review`, `proposal-approved`, `proposal-skipped`), `group: "inline@3"`.
3. In `activate()`, maintain a single webview panel (re-use if already open):
   ```ts
   let evidencePanel: vscode.WebviewPanel | undefined;
   ```
4. In the `dyknow.showEvidence` handler:
   ```ts
   async (item: ProposalItem) => {
     if (!evidencePanel || evidencePanel.viewColumn === undefined) {
       evidencePanel = vscode.window.createWebviewPanel(
         "dyknow.evidence",
         "DyKnow: Source Evidence",
         vscode.ViewColumn.Beside,
         { enableScripts: false },
       );
       evidencePanel.onDidDispose(() => { evidencePanel = undefined; });
     }
     evidencePanel.webview.html = buildEvidenceHtml(item.draft.proposal);
     evidencePanel.reveal();
   }
   ```
5. Write `buildEvidenceHtml(proposal: UpdateProposal): string`:
   ```ts
   function buildEvidenceHtml(proposal: UpdateProposal): string {
     const sourcesHtml = proposal.sources
       .map((s) => `<li><code>${escapeHtml(s)}</code></li>`)
       .join("\n");
     return `<!DOCTYPE html>
   <html lang="en">
   <head><meta charset="UTF-8"><style>
     body { font-family: var(--vscode-font-family); padding: 16px; }
     h2 { margin-top: 0; }
     .badge { padding: 2px 6px; border-radius: 4px; font-size: 0.85em; }
     .high { background: var(--vscode-statusBarItem-warningBackground); }
     .medium { background: var(--vscode-editorWarning-foreground); color: #000; }
     .low { background: var(--vscode-badge-background); }
   </style></head>
   <body>
     <h2>${escapeHtml(proposal.pageId)}</h2>
     <p>${escapeHtml(proposal.summary)}</p>
     <p><strong>Why:</strong> ${escapeHtml(proposal.why)}</p>
     <p>
       Risk: <span class="badge ${proposal.risk}">${proposal.risk}</span>
       Confidence: <span class="badge ${proposal.confidence}">${proposal.confidence}</span>
     </p>
     <h3>Sources (${proposal.sources.length})</h3>
     <ul>${sourcesHtml}</ul>
   </body></html>`;
   }

   function escapeHtml(s: string): string {
     return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
   }
   ```

---

### Task 3 — Settings UI for config overrides

**Goal:** let users set the LLM provider and model via VS Code settings (no manual JSON editing).

**Implementation steps:**

1. Add to `package.json` → `contributes`:
   ```json
   "configuration": {
     "title": "DyKnow",
     "properties": {
       "dyknow.llmProvider": {
         "type": "string",
         "enum": ["anthropic", "openai", "local-stub"],
         "default": "anthropic",
         "description": "LLM provider used by dyknow update."
       },
       "dyknow.anthropicModel": {
         "type": "string",
         "default": "claude-sonnet-4-6",
         "description": "Anthropic model ID (used when dyknow.llmProvider is 'anthropic')."
       },
       "dyknow.openaiModel": {
         "type": "string",
         "default": "gpt-4o",
         "description": "OpenAI model ID (used when dyknow.llmProvider is 'openai')."
       },
       "dyknow.allowHighRisk": {
         "type": "boolean",
         "default": false,
         "description": "Allow committing/publishing high-risk proposals without a flag. Keep false unless you know what you are doing."
       }
     }
   }
   ```

2. In the `dyknow.update` command handler, read settings and pass them as CLI flags:
   ```ts
   const config = vscode.workspace.getConfiguration("dyknow");
   const provider = config.get<string>("llmProvider", "anthropic");
   const args = ["update", "--provider", provider];
   const model =
     provider === "anthropic"
       ? config.get<string>("anthropicModel", "claude-sonnet-4-6")
       : config.get<string>("openaiModel", "gpt-4o");
   args.push("--model", model);
   await runCli(cwd, args);
   ```

3. In the `dyknow.commit` command handler, pass `--allow-high-risk` when the setting is true:
   ```ts
   const config = vscode.workspace.getConfiguration("dyknow");
   const args = ["commit"];
   if (config.get<boolean>("allowHighRisk", false)) {
     args.push("--allow-high-risk");
   }
   await runCli(cwd, args);
   ```

---

### Task 4 — Marketplace publish prep

**Goal:** the extension can be packaged as a `.vsix` and installed manually.

**Implementation steps:**

1. Install `@vscode/vsce` in the extension workspace:
   ```sh
   npm install --save-dev @vscode/vsce --workspace=@dyknow/vscode-extension
   ```

2. Add a `"publisher"` field to `package.json`:
   ```json
  "publisher": "dyknow"
   ```
  (This is the VS Code Marketplace publisher ID. Use the public publisher you plan to ship under; `"dyknow"` is the neutral default in this repo.)

3. Add a `.vscodeignore` file at `packages/vscode-extension/.vscodeignore`:
   ```
   src/
   esbuild.mjs
   tsconfig.json
   tsconfig.tsbuildinfo
   dist-tsc/
   node_modules/
   .gitignore
   *.map
   ```

4. Add a `"package"` script to `package.json`:
   ```json
   "package": "vsce package --no-dependencies"
   ```

5. Add a `README.md` at `packages/vscode-extension/README.md` (required by vsce) with at minimum:
   ```markdown
   # DyKnow for VS Code
   Source-aligned knowledge maintenance — scan, detect drift, and apply approved updates.
   See [github.com/nickhilster/DyKnow](https://github.com/nickhilster/DyKnow) for full docs.
   ```

6. Verify it packages cleanly:
   ```sh
   cd packages/vscode-extension && npm run package
   ```
   This should produce `dyknow-0.1.0.vsix`. Install it locally with:
   ```sh
   code --install-extension dyknow-0.1.0.vsix
   ```

---

### Task 5 — Update implementation-roadmap.md

After the above tasks are complete, open `docs/implementation-roadmap.md` and change all Phase 2 checkboxes from `[ ]` to `[x]` for the items that are done. Also bump `last_reviewed` in the frontmatter to today.

Append an entry to `docs/log.md`:
```
2026-05-24 | update | docs/implementation-roadmap.md | Marked Phase 2 extension tasks done after Copilot handoff completion.
```

---

## Key data shapes (copy-paste safe for type declarations)

These are the exact shapes written to `docs/dyknow/.state/*.json` by the CLI.

### `repo-diff.json` (read by ChangedKnowledgeProvider)

```ts
interface RepoDiff {
  added: Array<{ path: string }>;
  changed: Array<{ path: string }>;
  removed: Array<{ path: string }>;
}
```

### `update-proposals.json` (read by SuggestedUpdatesProvider)

```ts
interface UpdateDraftBatch {
  draftedAt: string;      // ISO datetime
  rootPath: string;
  configPath: string;
  repoDiffPath: string;
  outputPath: string;
  providerId: string;
  drafts: DraftedPageUpdate[];
  summary: { affectedPages: number; draftedProposals: number };
}

interface DraftedPageUpdate {
  affectedPage: {
    id: string;
    outputPath: string;   // relative path to the page file
    // other fields exist but are not needed by the extension
  };
  proposal: {
    pageId: string;
    summary: string;
    why: string;
    sources: string[];
    proposedText: string;           // full proposed markdown content
    confidence: "low" | "medium" | "high";
    risk: "low" | "medium" | "high";
    reviewState: "Needs review" | "Approved" | "Skipped";
    requiresHumanReview: boolean;
  };
}
```

> **Note:** the local interfaces in `extension.ts` currently omit `proposedText`, `requiresHumanReview`, and `affectedPage.outputPath`. Add them for Tasks 1 and 2.

---

## CLI command reference (for `runCli` calls)

| Command | Args | What it does |
|---|---|---|
| `dyknow scan` | _(none)_ | Writes `repo-map.json` |
| `dyknow diff` | _(none)_ | Writes `repo-diff.json` |
| `dyknow update` | `[--provider anthropic\|openai\|local-stub] [--model <id>]` | Writes `update-proposals.json` |
| `dyknow review` | `--approve\|--skip --page <pageId>` | Updates `reviewState` in proposals |
| `dyknow commit` | `[--allow-high-risk]` | Applies approved proposals, creates a git commit |
| `dyknow pr` | `--branch <name>` | Creates a branch + GitHub PR |

---

## Commit message format

All commits must follow Conventional Commits (enforced by CI):
```
feat(vscode-extension): <description>
fix(vscode-extension): <description>
```

Run locally to check before pushing:
```sh
npx commitlint --from HEAD~1 --to HEAD --verbose
```

---

## Coding standards

- **TypeScript strict** — `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- **No `any`** — use proper types or `unknown`.
- **Biome** for formatting/linting — `npm run lint` must pass. Config is at `biome.json` in the repo root.
- **All `void`-returning async calls** that aren't awaited must be prefixed with `void` (e.g., `void vscode.window.showInformationMessage(...)`).
- **No `console.log`** — use the `getOutput()` channel.
- Keep the extension to a **single `extension.ts`** until it grows past ~1000 lines, then split by feature (providers/, commands/, webviews/).

---

## Cross-references

- [AGENTS.md](../AGENTS.md) — full repo context, architecture, do-not-touch list
- [docs/implementation-roadmap.md](implementation-roadmap.md) — all Phase 2 checkboxes
- [docs/roadmap.md](roadmap.md) — strategic phase framing
- [packages/core/src/contracts.ts](../packages/core/src/contracts.ts) — canonical data schemas (source of truth for type shapes)
- [packages/core/src/update-runner.ts](../packages/core/src/update-runner.ts) — `UpdateDraftBatch` and `DraftedPageUpdate` schemas
