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
  - packages/cli/src/diff.ts
  - packages/cli/src/commit.ts
  - packages/cli/src/index.ts
  - packages/cli/src/pr.ts
  - packages/cli/src/review.ts
  - packages/cli/src/scan.ts
  - packages/cli/src/update.ts
last_reviewed: 2026-05-23
confidence: high
---

## Summary

This repository is the working concept, documentation hub, and bootstrap implementation workspace for **DyKnow** — a system for maintaining Dynamic Knowledge Pages that stay synchronized with product, code, docs, and websites. It has two surfaces: DyKnow Cloud (hosted) and DyKnow Local (repo-native).

The repo now contains the founding whitepaper, a wiki of source-backed pages, a TypeScript/npm workspace for DyKnow Local shared contracts, and working `dyknow init`, `dyknow scan`, `dyknow diff`, `dyknow update`, `dyknow review`, `dyknow log`, `dyknow commit`, and `dyknow pr` commands that generate the repo-local config, repo-map and repo-diff snapshots, draft update proposals, persist review decisions, pretty-print recent audit entries across committed and git-local runtime audit files, and publish approved changes into reviewable branches.

## External hubs

| Platform | URL |
|---|---|
| Linear | https://linear.app/teambotics/project/dyknow-30e3394df921 |
| Notion | https://www.notion.so/369cddcb424a81b2beedd1d654388b89 |

## Project purpose

Build a knowledge maintenance system that:
- Keeps product knowledge aligned with source material.
- Runs locally (CLI, VS Code, CI) so sensitive code never leaves the customer.
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
│   ├── cli/                      Bootstrap DyKnow Local CLI package.
│   └── core/                     Shared engine contracts and config validation.
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

  The implemented code surface is still small, but it is real: `packages/core` defines the first shared engine contracts, config validation, repo-map schema, repo-diff schema, default update prompt templates, and a provider-backed update runner; `packages/cli` implements `dyknow init`, `dyknow scan`, `dyknow diff`, `dyknow update`, the first persisted `dyknow review` decision slice including edited proposal text, external-editor handling, skip handling, targeted regenerate handling, and review-action audit logging, a read-only `dyknow log` audit viewer that now merges the committed audit artifact with a git-local runtime audit file, and the first `dyknow commit` and `dyknow pr` workflow slices with publish-action audit logging where PR publication records both a prepared local state and a confirmed external PR-open event in separate persistence boundaries; and CI runs lint, tests, and build checks.

## Development commands

  - `npm install` — install workspace dependencies.
  - `npm test` — run the shared-contract and config-validation tests.
  - `npm run build` — compile `packages/core` and `packages/cli`.
  - `npm run lint` — run Biome checks across the scaffolded workspace.
  - `node packages/cli/dist/bin.js init --force --project-name DyKnow` — generate the repo-local config and schema after a build.
  - `node packages/cli/dist/bin.js scan` — build the repo map snapshot at `docs/dyknow/.state/repo-map.json` after a build.
  - `node packages/cli/dist/bin.js diff` — compare the current workspace against the saved repo-map snapshot, map deltas to affected page IDs via configured source patterns, and write `docs/dyknow/.state/repo-diff.json` after a build.
  - `node packages/cli/dist/bin.js update` — read `docs/dyknow/.state/repo-diff.json`, draft proposals for affected pages, and write `docs/dyknow/.state/update-proposals.json` after a build.
  - `node packages/cli/dist/bin.js review --approve --page <page-id>` — persist approval, rejection, escalation, one edited proposal text, one editor-driven edited proposal text, an explicit skip, or a targeted regenerate back into `docs/dyknow/.state/update-proposals.json` after a build while appending review-action audit entries to `docs/dyknow/.state/audit-log.jsonl`.
  - `node packages/cli/dist/bin.js log --limit 10 --source all --action all` — pretty-print recent entries from `docs/dyknow/.state/audit-log.jsonl` and the git-local runtime audit file after a build, label each entry with its source audit file, and optionally filter by source (`all|committed|runtime`) and action family (`all|review|publish`).
  - `node packages/cli/dist/bin.js commit` — apply approved proposals from `docs/dyknow/.state/update-proposals.json`, mark them published, append publish audit entries, and create a single git commit.
  - `node packages/cli/dist/bin.js pr --branch <name>` — create a new branch from `main`, apply approved proposals, append a `publish:pr-prepared` audit entry in the committed local flow, push the branch to `origin`, open a GitHub pull request with a summary table, and append a confirmed `publish:pr-opened` event to the git-local runtime audit file after the external PR-open call succeeds.

  Implemented DyKnow Local CLI commands:

  - `dyknow init` — create `dyknow.config.json` and `dyknow.config.schema.json`
  - `dyknow scan` — build repo map at `docs/dyknow/.state/repo-map.json`
  - `dyknow diff` — compare the current workspace to the saved repo map, identify affected pages, and write `docs/dyknow/.state/repo-diff.json`
  - `dyknow update` — draft update proposals at `docs/dyknow/.state/update-proposals.json`
  - `dyknow review` — persist approval, rejection, escalation, one edited proposal text, one editor-driven edited proposal text, an explicit skip, or a targeted regenerate in `docs/dyknow/.state/update-proposals.json`
  - `dyknow log` — pretty-print recent review and publish audit entries from the committed audit artifact plus the git-local runtime audit file
  - `dyknow commit` — apply approved proposals, mark them published, append publish audit entries, and create a single git commit
  - `dyknow pr` — create a review branch, append a `publish:pr-prepared` audit entry, push it, open a GitHub pull request for approved proposals, and append a confirmed `publish:pr-opened` runtime event on success

See [docs/setup-guide.md](docs/setup-guide.md).

## Coding standards

- TypeScript uses npm workspaces and NodeNext module resolution.
- Shared engine contracts live in `packages/core`; CLI-specific wiring lives in `packages/cli`.
- Biome handles formatting and baseline linting; Vitest covers executable validation.
- The current scanner honors `allowedSources` and `ignoredSources`, extracts package dependencies, classifies route candidates heuristically, and warns on likely sensitive content without writing file contents into the repo map.
- The current diff command compares a fresh in-memory scan against the last saved repo-map snapshot, maps changed source paths to affected page IDs via configured page source patterns, and writes a structured repo-diff artifact without overwriting the base snapshot.
- The current update flow reads affected pages from the repo diff, drafts proposals into `docs/dyknow/.state/update-proposals.json`, uses default templates for the maintained DyKnow pages, and relies on a local stub update provider that always returns needs-review proposals and enforces local-only provider matching.
- The current review flow reads `docs/dyknow/.state/update-proposals.json`, can list proposal state counts, persists approval, rejection, or escalation decisions, can mark one targeted proposal `Edited` while replacing its proposed text inside that artifact from either `--text` or an external editor command, can explicitly skip targeted proposals without mutating the snapshot, can regenerate targeted proposals from the saved repo diff while leaving untargeted drafts alone, and appends one audit entry per targeted review action to `docs/dyknow/.state/audit-log.jsonl`.
- The current log flow reads `docs/dyknow/.state/audit-log.jsonl` plus the git-local runtime audit file, validates each JSONL entry against the shared audit-entry schema, and pretty-prints the most recent review and publish entries first with an explicit per-entry source log label plus `all|committed|runtime` and `all|review|publish` filters without mutating the committed audit artifact.
- The current commit flow reads `docs/dyknow/.state/update-proposals.json`, applies only approved proposals to their output files, marks them `Published`, appends publish audit entries to `docs/dyknow/.state/audit-log.jsonl`, and creates one git commit while refusing unrelated worktree changes.
- The current PR flow must start from the base branch (default `main`), creates a new review branch, reuses the approved-proposal commit path, carries a `publish:pr-prepared` audit entry in that committed local flow before the external PR-open call, pushes to `origin`, opens a GitHub pull request whose body summarizes pages, source evidence, risk, and confidence, and writes a confirmed `publish:pr-opened` event to the git-local runtime audit file after the external PR-open call succeeds.
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
- DyKnow is a concept-stage project; avoid fabricating implementation details that haven't been decided.
