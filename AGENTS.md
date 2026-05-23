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
  - packages/core/src/contracts.ts
  - packages/core/src/config.ts
  - packages/core/src/repo-diff.ts
  - packages/core/src/repo-map.ts
  - packages/cli/src/diff.ts
  - packages/cli/src/index.ts
  - packages/cli/src/scan.ts
last_reviewed: 2026-05-23
confidence: high
---

## Summary

This repository is the working concept, documentation hub, and bootstrap implementation workspace for **DyKnow** — a system for maintaining Dynamic Knowledge Pages that stay synchronized with product, code, docs, and websites. It has two surfaces: DyKnow Cloud (hosted) and DyKnow Local (repo-native).

The repo now contains the founding whitepaper, a wiki of source-backed pages, a TypeScript/npm workspace for DyKnow Local shared contracts, and working `dyknow init`, `dyknow scan`, and `dyknow diff` commands that generate the repo-local config plus repo-map and repo-diff snapshots.

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

  The implemented code surface is still small, but it is real: `packages/core` defines the first shared engine contracts, config validation, repo-map schema, and repo-diff schema; `packages/cli` implements `dyknow init`, `dyknow scan`, and `dyknow diff`; and CI runs lint, tests, and build checks.

## Development commands

  - `npm install` — install workspace dependencies.
  - `npm test` — run the shared-contract and config-validation tests.
  - `npm run build` — compile `packages/core` and `packages/cli`.
  - `npm run lint` — run Biome checks across the scaffolded workspace.
  - `node packages/cli/dist/bin.js init --force --project-name DyKnow` — generate the repo-local config and schema after a build.
  - `node packages/cli/dist/bin.js scan` — build the repo map snapshot at `docs/dyknow/.state/repo-map.json` after a build.
  - `node packages/cli/dist/bin.js diff` — compare the current workspace against the saved repo-map snapshot, map deltas to affected page IDs via configured source patterns, and write `docs/dyknow/.state/repo-diff.json` after a build.

  Implemented DyKnow Local CLI commands:

  - `dyknow init` — create `dyknow.config.json` and `dyknow.config.schema.json`
  - `dyknow scan` — build repo map at `docs/dyknow/.state/repo-map.json`
  - `dyknow diff` — compare the current workspace to the saved repo map, identify affected pages, and write `docs/dyknow/.state/repo-diff.json`

  Planned DyKnow Local CLI commands remain:

- `dyknow update` — draft page updates
- `dyknow review` — review proposed diffs
- `dyknow commit` / `dyknow pr` — commit or open PR

See [docs/setup-guide.md](docs/setup-guide.md).

## Coding standards

- TypeScript uses npm workspaces and NodeNext module resolution.
- Shared engine contracts live in `packages/core`; CLI-specific wiring lives in `packages/cli`.
- Biome handles formatting and baseline linting; Vitest covers executable validation.
- The current scanner honors `allowedSources` and `ignoredSources`, extracts package dependencies, classifies route candidates heuristically, and warns on likely sensitive content without writing file contents into the repo map.
- The current diff command compares a fresh in-memory scan against the last saved repo-map snapshot, maps changed source paths to affected page IDs via configured page source patterns, and writes a structured repo-diff artifact without overwriting the base snapshot.
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
