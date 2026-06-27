---
title: AI Agent Context
purpose: Give coding agents and assistants the minimum context they need to work productively in this repository.
audience: agent
sources:
  - docs/sources/dyknow_local_whitepaper.md
  - CLAUDE.md
  - package.json
  - biome.json
  - dyknow.config.json
  - dyknow.config.schema.json
  - docs/dyknow/.state/repo-map.json
  - docs/dyknow/.state/repo-diff.json
  - docs/dyknow/.state/update-proposals.json
  - packages/cli/src/audit.ts
  - packages/cli/src/log.ts
  - packages/core/src/contracts.ts
  - packages/core/src/config.ts
  - packages/core/src/repo-diff.ts
  - packages/core/src/repo-map.ts
  - packages/core/src/update-runner.ts
  - packages/core/src/update-templates.ts
  - packages/app/src/diff-service.ts
  - packages/app/src/proposal-service.ts
  - packages/app/src/scan-service.ts
  - packages/app/src/status-service.ts
  - packages/app/src/update-service.ts
  - packages/cli/src/diff.ts
  - packages/cli/src/commit.ts
  - packages/cli/src/index.ts
  - packages/mcp-server/src/server.ts
  - packages/cli/src/pr.ts
  - packages/cli/src/review.ts
  - packages/cli/src/scan.ts
  - packages/cli/src/status.ts
  - packages/cli/src/update.ts
last_reviewed: 2026-06-26
confidence: high
---

## Summary

This repository is the working concept, documentation hub, and bootstrap implementation workspace for **DyKnow** — a system for maintaining Dynamic Knowledge Pages that stay synchronized with product, code, docs, and websites. It has two surfaces: DyKnow Cloud (hosted) and DyKnow Local (repo-native).

The repo now contains the founding whitepaper, a wiki of source-backed pages, a TypeScript/npm workspace for DyKnow Local shared contracts, a reusable application layer, and working `dyknow init`, `dyknow scan`, `dyknow diff`, `dyknow update`, `dyknow review`, `dyknow log`, `dyknow status`, `dyknow commit`, and `dyknow pr` commands that generate the repo-local config, repo-map and repo-diff snapshots, draft update proposals, persist review decisions, pretty-print recent audit entries across committed and git-local runtime audit files, generate an HTML status report, and publish approved changes into reviewable branches. The repo also now includes a stdio MCP server for agent-native clients across both read and mutation flows.

## Project purpose

Build a knowledge maintenance system that:
- Keeps product knowledge aligned with source material.
- Runs locally (CLI, MCP, VS Code, CI) so sensitive code never leaves the customer.
- Maintains AI-agent context files (AGENTS.md, CLAUDE.md, etc.) as a first-class output.
- Keeps humans in control of publishing.

## Architecture overview (current)

```
.
├── .github/
│   ├── agents/                    Workspace Copilot agents for docs maintenance and Local build work.
│   ├── instructions/              File-specific Copilot instructions for wiki, trust, and Phase 0 work.
│   ├── skills/                    On-demand Copilot skills for page maintenance and build slicing.
│   └── workflows/                 CI validation workflow.
├── biome.json                     Formatter and linter config.
├── dyknow.config.json             Generated repo-local DyKnow config.
├── dyknow.config.schema.json      JSON Schema for the local config.
├── README.md
├── CLAUDE.md                    Schema for the wiki maintainer.
├── AGENTS.md                    You are here.
├── CONTRIBUTING.md
├── CHANGELOG.md
├── package.json                  npm workspace root.
├── packages/
│   ├── app/                      Shared DyKnow Local application services.
│   ├── cli/                      Bootstrap DyKnow Local CLI package.
│   ├── core/                     Shared engine contracts and config validation.
│   ├── mcp-server/               Stdio MCP server for agent-native clients.
│   └── vscode-extension/         Optional VS Code client surface.
├── tsconfig.base.json            Shared TypeScript compiler settings.
└── docs/
  ├── dyknow/
  │   └── .state/               Generated repo-map snapshots.
    ├── index.md                 Catalog of pages.
    ├── log.md                   Append-only change log.
    ├── lint.md                  Wiki health checklist.
    ├── product-overview.md
    ├── feature-map.md
    ├── architecture.md
    ├── setup-guide.md
    ├── trust-and-security.md
    ├── messaging.md
    ├── roadmap.md
    ├── glossary.md
    └── sources/
        ├── README.md
        └── dyknow_local_whitepaper.md   Founding raw source.
```

  The implemented code surface is still small, but it is real: `packages/core` defines the shared engine contracts, config validation, repo-map schema, repo-diff schema, default update prompt templates, and a provider-backed update runner with local built-in page generators, local confidence/risk heuristics, BYO OpenAI retry/timeout handling, and per-draft usage telemetry; `packages/app` owns reusable scan, diff, proposal-read, update, review, log, commit, PR, and status orchestration; `packages/cli` implements `dyknow init`, `dyknow scan`, `dyknow diff`, `dyknow update`, an interactive and non-interactive `dyknow review` flow with edited proposal text, external-editor handling, skip handling, targeted regenerate handling, and review-action audit logging, a read-only `dyknow log` audit viewer that now merges the committed audit artifact with a git-local runtime audit file, `dyknow status` for generating an HTML progress snapshot, and `dyknow commit` and `dyknow pr` workflow slices with publish-action audit logging where high-risk proposals require an explicit `--allow-high-risk` publish override and PR publication records both a prepared local state and a confirmed external PR-open event in separate persistence boundaries; `packages/mcp-server` exposes stdio MCP tools for `scan`, `diff`, `update`, `list_proposals`, `get_proposal`, `review_proposal`, `log`, `status`, `commit`, and `open_pr`; `packages/vscode-extension` now has focused automated coverage for command and publish-flow argument wiring; and CI runs lint, tests, and build checks.

## Development commands

  - `npm install` — install workspace dependencies.
  - `npm test` — run the shared-contract and config-validation tests.
  - `npm run build` — compile the TypeScript workspace packages, including `core`, `app`, `cli`, and `mcp-server`.
  - `npm run lint` — run Biome checks across the scaffolded workspace.
  - `node packages/cli/dist/bin.js init --force --project-name DyKnow` — generate the repo-local config and schema after a build.
  - `node packages/cli/dist/bin.js scan` — build the repo map snapshot at `docs/dyknow/.state/repo-map.json` after a build.
  - `node packages/cli/dist/bin.js diff` — compare the current workspace against the saved repo-map snapshot, map deltas to affected page IDs via configured source patterns, and write `docs/dyknow/.state/repo-diff.json` after a build.
  - `node packages/cli/dist/bin.js update` — read `docs/dyknow/.state/repo-diff.json`, draft proposals for affected pages through either the local built-in generator path or the BYO provider path, and write `docs/dyknow/.state/update-proposals.json` after a build.
  - `node packages/mcp-server/dist/bin.js` — run the stdio MCP server for agent-native IDE and desktop clients after a build.
  - `node packages/cli/dist/bin.js review --approve --page <page-id>` — persist approval, rejection, escalation, one edited proposal text, one editor-driven edited proposal text, an explicit skip, a targeted regenerate, or an interactive walkthrough back into `docs/dyknow/.state/update-proposals.json` after a build while appending review-action audit entries to `docs/dyknow/.state/audit-log.jsonl`.
  - `node packages/cli/dist/bin.js log --limit 10 --source all --action all` — pretty-print recent entries from `docs/dyknow/.state/audit-log.jsonl` and the git-local runtime audit file after a build, label each entry with its source audit file, and optionally filter by source (`all|committed|runtime`) and action family (`all|review|publish`).
  - `node packages/cli/dist/bin.js status` — generate `dyknow-progress-status.html` from live git metadata plus the current repo diff, update proposal, and audit artifacts after a build.
  - `node packages/cli/dist/bin.js commit [--allow-high-risk]` — apply approved proposals from `docs/dyknow/.state/update-proposals.json`, mark them published, append publish audit entries, and create a single git commit while refusing approved high-risk proposals unless the explicit override flag is present.
  - `node packages/cli/dist/bin.js pr --branch <name> [--allow-high-risk]` — create a new branch from `main`, apply approved proposals, append a `publish:pr-prepared` audit entry in the committed local flow, push the branch to `origin`, open a GitHub pull request with a summary table, and append a confirmed `publish:pr-opened` event to the git-local runtime audit file after the external PR-open call succeeds while refusing approved high-risk proposals unless the explicit override flag is present.

  Implemented DyKnow Local CLI commands:

  - `dyknow init` — create `dyknow.config.json` and `dyknow.config.schema.json`, with optional interactive prompts and stack-aware source defaults
  - `dyknow scan` — build repo map at `docs/dyknow/.state/repo-map.json`
  - `dyknow diff` — compare the current workspace to the saved repo map, identify affected pages, and write `docs/dyknow/.state/repo-diff.json`
  - `dyknow update` — draft update proposals at `docs/dyknow/.state/update-proposals.json`
  - `dyknow-mcp` — expose the MCP workflow for `scan`, `diff`, `update`, `list_proposals`, `get_proposal`, `review_proposal`, `log`, `status`, `commit`, and `open_pr`
  - `dyknow review` — persist approval, rejection, escalation, one edited proposal text, one editor-driven edited proposal text, an explicit skip, or a targeted regenerate in `docs/dyknow/.state/update-proposals.json`
  - `dyknow log` — pretty-print recent review and publish audit entries from the committed audit artifact plus the git-local runtime audit file
  - `dyknow status` — generate an HTML repo status report at `dyknow-progress-status.html`
  - `dyknow commit` — apply approved proposals, mark them published, append publish audit entries, and create a single git commit, with `--allow-high-risk` required for approved high-risk proposals
  - `dyknow pr` — create a review branch, append a `publish:pr-prepared` audit entry, push it, open a GitHub pull request for approved proposals, and append a confirmed `publish:pr-opened` runtime event on success, with `--allow-high-risk` required for approved high-risk proposals

See [docs/setup-guide.md](docs/setup-guide.md).

## Coding standards

- TypeScript uses npm workspaces and NodeNext module resolution.
- Shared engine contracts live in `packages/core`; reusable orchestration lives in `packages/app`; CLI-specific wiring lives in `packages/cli`; MCP transport and tool adapters live in `packages/mcp-server`.
- Biome handles formatting and baseline linting; Vitest covers executable validation.
- The current scanner honors `allowedSources` and `ignoredSources`, extracts Markdown headings, top-level JSON/YAML/TOML keys, dependency manifests from `package.json`, `pyproject.toml`, and `requirements*.txt`, captures lightweight OpenAPI, Next.js, and Express-style route metadata, and warns on likely sensitive content without writing file contents into the repo map.
- The current diff command compares a fresh in-memory scan against the last saved repo-map snapshot, maps changed source paths to affected page IDs via configured page source patterns, and writes a structured repo-diff artifact without overwriting the base snapshot.
- The current update flow reads affected pages from the repo diff, drafts proposals into `docs/dyknow/.state/update-proposals.json`, uses default templates for the maintained DyKnow pages, and supports both a local built-in generator path and a BYO OpenAI-backed provider path while assigning heuristic confidence and risk levels from the request context.
- The current review flow reads `docs/dyknow/.state/update-proposals.json`, can list proposal state counts, persists approval, rejection, or escalation decisions, can mark one targeted proposal `Edited` while replacing its proposed text inside that artifact from either `--text` or an external editor command, can explicitly skip targeted proposals without mutating the snapshot, can regenerate targeted proposals from the saved repo diff while leaving untargeted drafts alone, can walk pending proposals interactively, and appends one audit entry per targeted review action to `docs/dyknow/.state/audit-log.jsonl`.
- The current log flow reads `docs/dyknow/.state/audit-log.jsonl` plus the git-local runtime audit file, validates each JSONL entry against the shared audit-entry schema, and pretty-prints the most recent review and publish entries first with an explicit per-entry source log label plus `all|committed|runtime` and `all|review|publish` filters without mutating the committed audit artifact.
- The current status flow writes `dyknow-progress-status.html` from live git metadata plus the current repo diff, update proposal, and audit artifacts.
- The current commit flow reads `docs/dyknow/.state/update-proposals.json`, applies only approved proposals to their output files, marks them `Published`, appends publish audit entries to `docs/dyknow/.state/audit-log.jsonl`, creates one git commit while refusing unrelated worktree changes, and blocks approved high-risk proposals unless `--allow-high-risk` is passed.
- The current PR flow must start from the base branch (default `main`), creates a new review branch, reuses the approved-proposal commit path, carries a `publish:pr-prepared` audit entry in that committed local flow before the external PR-open call, pushes to `origin`, opens a GitHub pull request whose body summarizes pages, source evidence, risk, and confidence, writes a confirmed `publish:pr-opened` event to the git-local runtime audit file after the external PR-open call succeeds, and blocks approved high-risk proposals unless `--allow-high-risk` is passed.
- Favor small vertical slices that keep source evidence, confidence, risk, and review-state data explicit in the design.

## Documentation conventions

- All pages in `docs/` follow the frontmatter format defined in [CLAUDE.md](CLAUDE.md).
- Pages are topic-organized, not chronological.
- `docs/log.md` is append-only.
- High-risk claims (pricing, legal, security, compliance) require human approval before publishing.

## Do-not-touch

- Files under `docs/sources/` are raw sources. Never edit them.
- Past entries in `docs/log.md` are immutable.
- Frontmatter `sources:` should reflect what actually informed the page; don't add fake citations.

## Product terminology

The canonical glossary is [docs/glossary.md](docs/glossary.md). When in doubt, use those terms verbatim — particularly **Dynamic Knowledge Page**, **DyKnow Cloud**, **DyKnow Local**, **source map**, and **page health**.

## Known constraints

- No private data should appear in this repo.
- All product claims must trace to the whitepaper (or a future approved source).
- Public-facing docs should avoid private workspace URLs and internal customer or repo names unless they are intentionally approved for publication.
- DyKnow is a concept-stage project; avoid fabricating implementation details that haven't been decided.
