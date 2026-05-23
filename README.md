# DyKnow

**Source-aligned knowledge maintenance for humans, teams, and AI agents.**

DyKnow keeps a company's most important knowledge pages aligned with the latest source material — code, docs, websites, support tickets, product specs. It exists in two complementary forms:

- **DyKnow Cloud** — hosted system that monitors approved external/internal sources.
- **DyKnow Local** — repo-native CLI / VS Code extension that runs inside the customer's environment.

This repository contains the working concept, whitepaper, documentation system, and the initial TypeScript workspace for DyKnow Local's shared engine plus the first implemented `init`, `scan`, `diff`, `update`, `review`, `log`, `commit`, and `pr` CLI slices.

## Repo layout

```
.
├── .github/
│   ├── agents/                    Workspace Copilot agents for docs maintenance and Local build work.
│   ├── instructions/              File-specific Copilot instructions for wiki, trust, and Phase 0 work.
│   ├── skills/                    On-demand Copilot skills for page maintenance and build slicing.
│   └── workflows/                 CI validation workflow.
├── biome.json                     Formatter and linter config.
├── dyknow.config.json             Generated repo-local DyKnow config.
├── dyknow.config.schema.json      JSON Schema for `dyknow.config.json`.
├── README.md                       This file.
├── CLAUDE.md                       Schema for the LLM wiki maintainer (read this first).
├── AGENTS.md                       Agent context: project purpose, conventions, do-not-touch.
├── CONTRIBUTING.md                 How to contribute to docs and (eventually) code.
├── CHANGELOG.md                    Human-facing release notes.
├── package.json                    npm workspace root.
├── packages/
│   ├── cli/                        Bootstrap DyKnow Local CLI package.
│   └── core/                       Shared engine contracts and config validation.
├── tsconfig.base.json              Shared TypeScript compiler settings.
└── docs/
    ├── dyknow/
    │   └── .state/                 Generated repo-map and repo-diff snapshots.
    ├── index.md                    Catalog of all Dynamic Knowledge Pages.
    ├── log.md                      Append-only change log.
    ├── lint.md                     Wiki health checklist.
    ├── product-overview.md         What DyKnow is and who it's for.
    ├── feature-map.md              Inventory of features across Cloud and Local.
    ├── architecture.md             Technical architecture for Cloud and Local.
    ├── setup-guide.md              How to set up DyKnow Local.
    ├── trust-and-security.md       Trust model, security controls, governance.
    ├── messaging.md                Positioning, one-liners, audience pitches.
    ├── roadmap.md                  Phased build path.
    ├── glossary.md                 Canonical terms and concepts.
    └── sources/                    Raw source material (immutable).
        ├── README.md               Source index and authority hierarchy.
        └── dyknow_local_whitepaper.md   Founding whitepaper.
```

## How this documentation works

We treat documentation the way DyKnow proposes treating product knowledge:

1. **Raw sources are immutable.** The whitepaper and any future research live untouched in their original files.
2. **The wiki (`docs/`) is the synthesized layer.** Each page has a defined purpose, source map, and last-reviewed date.
3. **The schema (`CLAUDE.md`) tells the maintainer how to operate.** It defines page conventions, when to update, when to escalate, and how to log.

This pattern follows Karpathy's "LLM wiki" model and DyKnow's own Dynamic Knowledge Page concept. The two reinforce each other: persistent topic-organized pages, source-backed updates, append-only history.

## Code bootstrap

The current implementation slice uses:

- **TypeScript + npm workspaces** for shared code across DyKnow Local surfaces.
- **`packages/core`** for JSON-serializable shared contracts, config validation, repo-map schemas, repo-diff schemas, and provider-backed update drafting.
- **`packages/cli`** for the DyKnow Local CLI package with working `dyknow init`, `dyknow scan`, `dyknow diff`, `dyknow update`, `dyknow review`, `dyknow log`, `dyknow commit`, and `dyknow pr` commands.
- **Biome + Vitest + GitHub Actions** for formatting, linting, tests, and CI.

## Quick starts

- Reading: start with [docs/product-overview.md](docs/product-overview.md) then [docs/feature-map.md](docs/feature-map.md).
- Building: read [docs/architecture.md](docs/architecture.md) and [docs/roadmap.md](docs/roadmap.md).
- Maintaining these docs (as a human or LLM): read [CLAUDE.md](CLAUDE.md).
- Installing the workspace: run `npm install`.
- Validating the bootstrap: run `npm test`, `npm run build`, and `npm run lint`.
- Creating the repo-local DyKnow config: run `node packages/cli/dist/bin.js init --force --project-name DyKnow` after a build.
- Generating the repo map snapshot: run `node packages/cli/dist/bin.js scan` after a build.
- Generating the structured repo diff: run `node packages/cli/dist/bin.js diff` after a build and after at least one scan. The diff artifact includes affected configured pages based on matched source patterns.
- Drafting update proposals from the current repo diff: run `node packages/cli/dist/bin.js update` after a build and after `dyknow diff`. The current implementation writes `docs/dyknow/.state/update-proposals.json` using the local stub update provider and always requires human review.
- Persisting review decisions back into the proposal artifact: run `node packages/cli/dist/bin.js review --approve --page <page-id>`, `node packages/cli/dist/bin.js review --reject --all`, `node packages/cli/dist/bin.js review --edit --page <page-id> --text <value>`, `node packages/cli/dist/bin.js review --edit --page <page-id> --editor`, `node packages/cli/dist/bin.js review --skip --page <page-id>`, or `node packages/cli/dist/bin.js review --regenerate --page <page-id>` after `dyknow update`. The current review slice updates proposal review states in place, can persist one edited proposal text, can open one targeted proposal in an external editor via `DYKNOW_EDITOR_COMMAND` or `EDITOR`, can explicitly skip targeted proposals without mutating the snapshot, can regenerate targeted proposals from the saved repo diff, and appends review-action audit entries to `docs/dyknow/.state/audit-log.jsonl`.
- Inspecting recent audit entries: run `node packages/cli/dist/bin.js log --limit 10 --source all` after `dyknow review`, `dyknow commit`, or `dyknow pr`. The current implementation pretty-prints recent entries from the committed `docs/dyknow/.state/audit-log.jsonl` artifact and the git-local runtime audit file used for confirmed external PR-open events, newest first, labels each entry with the source audit file it came from, can filter to `all`, `committed`, or `runtime` entries, and remains read-only.
- Applying approved proposals in one git commit: run `node packages/cli/dist/bin.js commit` after `dyknow review --approve ...`. The current implementation applies only `Approved` proposals, marks them `Published`, updates page files, creates one git commit when the worktree is otherwise clean, and appends publish-action audit entries to `docs/dyknow/.state/audit-log.jsonl` as part of that committed flow.
- Creating a reviewable pull request for approved proposals: run `node packages/cli/dist/bin.js pr --branch <name>` from `main` after `dyknow review --approve ...`. The current implementation creates a new branch, reuses the approved-proposal apply-and-commit flow, pushes the branch to `origin`, opens a GitHub pull request with a page/risk/source summary table, records a `publish:pr-prepared` audit entry in the committed audit trail before the external PR creation call, and appends a confirmed `publish:pr-opened` entry to the git-local runtime audit file after the external PR-open call succeeds.
