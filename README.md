# DyKnow

**Source-aligned knowledge maintenance for humans, teams, and AI agents.**

DyKnow keeps a company's most important knowledge pages aligned with the latest source material — code, docs, websites, support tickets, product specs. It exists in two complementary forms:

- **DyKnow Cloud** — hosted system that monitors approved external/internal sources.
- **DyKnow Local** — repo-native CLI / VS Code extension that runs inside the customer's environment.

This repository contains the working concept, whitepaper, documentation system, and the initial TypeScript workspace for DyKnow Local's shared engine and CLI bootstrap.

## Repo layout

```
.
├── .github/
│   ├── agents/                    Workspace Copilot agents for docs maintenance and Local build work.
│   ├── instructions/              File-specific Copilot instructions for wiki, trust, and Phase 0 work.
│   ├── skills/                    On-demand Copilot skills for page maintenance and build slicing.
│   └── workflows/                 CI validation workflow.
├── biome.json                     Formatter and linter config.
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
- **`packages/core`** for JSON-serializable shared contracts and config validation.
- **`packages/cli`** for the bootstrap CLI package that will grow into `dyknow init`, `scan`, `diff`, and review commands.
- **Biome + Vitest + GitHub Actions** for formatting, linting, tests, and CI.

## Quick starts

- Reading: start with [docs/product-overview.md](docs/product-overview.md) then [docs/feature-map.md](docs/feature-map.md).
- Building: read [docs/architecture.md](docs/architecture.md) and [docs/roadmap.md](docs/roadmap.md).
- Maintaining these docs (as a human or LLM): read [CLAUDE.md](CLAUDE.md).
- Installing the workspace: run `npm install`.
- Validating the bootstrap: run `npm test`, `npm run build`, and `npm run lint`.
