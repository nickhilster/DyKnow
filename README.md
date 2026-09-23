# DyKnow

**Source-aligned knowledge maintenance for humans, teams, and AI agents.**

DyKnow keeps a company's most important knowledge pages aligned with the latest source material — code, docs, websites, support tickets, product specs. It exists in two complementary forms:

- **DyKnow Cloud** — hosted system that monitors approved external/internal sources.
- **DyKnow Local** — repo-native CLI, MCP server, and optional VS Code extension that runs inside the customer's environment.

This repository contains the founding whitepaper, the documentation wiki in `docs/`, and the TypeScript workspace for DyKnow Local plus an early DyKnow Cloud prototype.

DyKnow is released under the MIT license. Private planning workspaces and internal-only repo names are intentionally excluded from the synthesized docs in this public repository.

## Status

DyKnow is pre-1.0. Nothing is published to npm or the VS Code Marketplace yet, so everything below runs from a clone of this repository.

| Surface | Status | What it does |
| --- | --- | --- |
| Local CLI (`dyknow`) | Stable | `init`, `scan`, `diff`, `update`, `review`, `log`, `status`, `commit`, `pr` |
| MCP server (`dyknow-mcp`) | Stable | The same workflow as 10 MCP tools over stdio |
| VS Code extension | Stable, run from source | Tree views and inline review actions on top of the CLI |
| DyKnow Cloud (`cloud-api`, `cloud-web`, `dyknow cloud-sync`) | Early prototype | Local-only control plane with seeded data and a demo login. Not for deployment. |
| Phase 3 demo (`dyknow demo-smoke`, `docs/phase3-*`) | Early | Scaffolding for a recorded demo |

"Stable" means covered by tests and by CI on Linux, macOS and Windows. Commands, flags and file formats can still change before 1.0.

## Quick start

### Prerequisites

- Node.js 22.12 or newer, with npm
- Git
- Optional: the GitHub CLI (`gh`), signed in, for `dyknow pr`

### 1. Install from source

```bash
git clone https://github.com/nickhilster/DyKnow.git
cd DyKnow
npm ci
npm run build
npm install -g ./packages/cli ./packages/mcp-server
```

These commands are the same in PowerShell, Command Prompt and macOS/Linux shells. The last one puts `dyknow` and `dyknow-mcp` on your PATH. npm installs a local folder globally as a symlink into this checkout rather than a copy, so after a `git pull` you only need `npm ci` and `npm run build` again. To remove them, run `npm uninstall -g @dyknow/cli @dyknow/mcp-server`.

If you would rather not install globally (for example because global npm installs need `sudo` on your machine), skip the last command and call the CLI by path: `node /path/to/DyKnow/packages/cli/dist/bin.js <command>`.

### 2. Use the CLI in your repository

```bash
cd /path/to/your-repo
dyknow init        # writes dyknow.config.json and dyknow.config.schema.json
dyknow scan        # snapshots the repo into docs/dyknow/.state/repo-map.json
```

Then, after you change code or docs:

```bash
dyknow diff                  # find the knowledge pages your changes affect
dyknow update                # draft proposals into docs/dyknow/.state/update-proposals.json
dyknow review --interactive  # or: dyknow review --approve --page <page-id>
git add -A
git commit -m "chore: record DyKnow review"
dyknow commit                # apply the approved proposals as one commit
```

- `dyknow commit` only runs on a clean worktree (apart from the proposals file), which is why the `git commit` comes first. `dyknow pr --branch <name>` publishes to a new branch instead and opens a pull request through `gh`.
- Drafting works offline by default. With `llmProvider: "local"`, DyKnow uses built-in generators and needs no API key. To draft with your own OpenAI key, see [docs/setup-guide.md](docs/setup-guide.md).
- `dyknow --help` lists every command and flag.

### 3. Connect an MCP client

`dyknow-mcp` exposes the workflow as MCP tools over stdio: `dyknow_scan`, `dyknow_diff`, `dyknow_update`, `dyknow_list_proposals`, `dyknow_get_proposal`, `dyknow_review_proposal`, `dyknow_log`, `dyknow_status`, `dyknow_commit` and `dyknow_open_pr`. The server acts on the repository in its working directory.

With Claude Code, run this from your repository:

```bash
claude mcp add dyknow -- node /path/to/DyKnow/packages/mcp-server/dist/bin.js
```

For other clients, use the same command and set the server's working directory to your repository, if the client supports that:

```json
{
  "mcpServers": {
    "dyknow": {
      "command": "node",
      "args": ["/path/to/DyKnow/packages/mcp-server/dist/bin.js"],
      "cwd": "/path/to/your-repo"
    }
  }
}
```

Calling `node` with the full path behaves the same on every OS, unlike the npm command shims. On Windows, write the path as `C:/path/to/DyKnow/...` or escape the backslashes in JSON.

### 4. Run the VS Code extension

The extension adds DyKnow views and inline review actions. It runs the CLI from this checkout, so launch it from here instead of installing a `.vsix`:

```bash
code --extensionDevelopmentPath=/path/to/DyKnow/packages/vscode-extension /path/to/your-repo
```

This opens an Extension Development Host window with DyKnow loaded. The extension activates in workspaces that contain `dyknow.config.json`, so run `dyknow init` there first. A standalone `.vsix` install isn't supported yet: the packaged extension looks for the CLI relative to its own folder, which only works inside a DyKnow checkout.

### Try the Cloud prototype (early)

DyKnow Cloud here is an early, local-only prototype of the hosted control plane. It uses seeded demo data, a single hard-coded demo password and a JSON file under `packages/cloud-api/.local/`. Don't expose it to a network. After building, start the API and the web UI in two separate terminals, since both keep running:

```bash
# Terminal 1: API on http://127.0.0.1:4180
npm run dev:cloud:api
```

```bash
# Terminal 2: web UI through Vite, which proxies /api to the API
npm run dev:cloud
```

Sign in as `nick@example.com` with the password `dyknow-demo`. To push Local results from a repository into the prototype, run this from that repository while the API is up:

```bash
dyknow cloud-sync --workspace dyknow-marketing --password dyknow-demo
```

## Development

```bash
npm ci
npm run lint
npm test
npm run build
npm run smoke:quickstart   # runs the quick start above against a throwaway repo
```

CI runs all of these on Linux, macOS and Windows. See [CONTRIBUTING.md](CONTRIBUTING.md) for the review workflow and the Conventional Commits format that CI enforces.

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
│   ├── app/                        Shared DyKnow Local application services reused across surfaces.
│   ├── cli/                        Bootstrap DyKnow Local CLI package.
│   ├── cloud-api/                  Early Cloud prototype: local HTTP API with demo auth.
│   ├── cloud-shared/               Contracts shared by the Cloud API, web UI and cloud-sync.
│   ├── cloud-web/                  Early Cloud prototype: React dashboard (Vite).
│   ├── core/                       Shared engine contracts and config validation.
│   ├── mcp-server/                 Stdio MCP server for agent-native IDE and desktop clients.
│   └── vscode-extension/           Optional VS Code client surface.
├── scripts/
│   └── quickstart-smoke.mjs        Runs the README quick start against a throwaway repo (CI).
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
- **`packages/app`** for reusable DyKnow Local orchestration shared by the CLI and MCP server, including audit/log reporting.
- **`packages/cli`** for the DyKnow Local CLI package with working `dyknow init`, `dyknow scan`, `dyknow diff`, `dyknow update`, `dyknow review`, `dyknow log`, `dyknow status`, `dyknow cloud-sync`, `dyknow commit`, and `dyknow pr` commands.
- **`packages/mcp-server`** for the stdio MCP surface, now covering `scan`, `diff`, `update`, `list_proposals`, `get_proposal`, `review_proposal`, `log`, `status`, `commit`, and `open_pr`.
- **`packages/vscode-extension`** for the optional editor client, now backed by focused automated tests for CLI command wiring helpers.
- **`packages/cloud-api`, `packages/cloud-web`, `packages/cloud-shared`** for the early Cloud control-plane prototype that `dyknow cloud-sync` talks to.
- **Biome + Vitest + GitHub Actions** for formatting, linting, tests, and CI.

## Learn more

- Reading: start with [docs/product-overview.md](docs/product-overview.md) then [docs/feature-map.md](docs/feature-map.md).
- Building: read [docs/architecture.md](docs/architecture.md) and [docs/roadmap.md](docs/roadmap.md).
- Maintaining these docs (as a human or LLM): read [CLAUDE.md](CLAUDE.md).

## Command reference

This repository runs DyKnow on its own docs, so the examples below call the CLI by path from the repo root. With the global install from the quick start, `dyknow <command>` does the same thing.

- Creating the repo-local DyKnow config: run `node packages/cli/dist/bin.js init --force --project-name DyKnow` after a build. `dyknow init --interactive` is also available and now auto-detects a stack profile (`generic`, `nextjs`, `express`, or `python`) to seed `allowedSources` more usefully.
- Generating the repo map snapshot: run `node packages/cli/dist/bin.js scan` after a build. The current scanner now captures Markdown headings, top-level JSON/YAML/TOML keys, lightweight OpenAPI route metadata, Next.js and Express-style handlers, and dependency manifests from `package.json`, `pyproject.toml`, and `requirements*.txt`.
- Generating the structured repo diff: run `node packages/cli/dist/bin.js diff` after a build and after at least one scan. The diff artifact includes affected configured pages based on matched source patterns.
- Drafting update proposals from the current repo diff: run `node packages/cli/dist/bin.js update` after a build and after `dyknow diff`. The current implementation writes `docs/dyknow/.state/update-proposals.json` using either the local built-in generator path or the BYO OpenAI-backed provider when `llmProvider` is set to `byo-key` in connected mode and both `OPENAI_API_KEY` and `DYKNOW_OPENAI_MODEL` are configured. BYO runs now record per-draft token usage, aggregate token totals, estimated cost when the model pricing is known, and retry/timeout telemetry in the update artifact.
- Syncing Local artifacts into the hosted control plane: populate the optional `cloud` block in `dyknow.config.json`, or set `DYKNOW_CLOUD_*` overrides, then run `node packages/cli/dist/bin.js cloud-sync` after a build. The sync helper reads the config block first, then environment variables, then CLI flags. Password stays out of config and must come from `DYKNOW_CLOUD_PASSWORD` or `--password`.
- Persisting review decisions back into the proposal artifact: run `node packages/cli/dist/bin.js review --approve --page <page-id>`, `node packages/cli/dist/bin.js review --reject --all`, `node packages/cli/dist/bin.js review --edit --page <page-id> --text <value>`, `node packages/cli/dist/bin.js review --edit --page <page-id> --editor`, `node packages/cli/dist/bin.js review --skip --page <page-id>`, `node packages/cli/dist/bin.js review --regenerate --page <page-id>`, or `node packages/cli/dist/bin.js review --interactive` after `dyknow update`. The current review slice updates proposal review states in place, supports an interactive walkthrough over pending proposals, can persist one edited proposal text, can open one targeted proposal in an external editor via `DYKNOW_EDITOR_COMMAND` or `EDITOR`, can explicitly skip targeted proposals without mutating the snapshot, can regenerate targeted proposals from the saved repo diff, and appends review-action audit entries to `docs/dyknow/.state/audit-log.jsonl`.
- Inspecting recent audit entries: run `node packages/cli/dist/bin.js log --limit 10 --source all --action all` after `dyknow review`, `dyknow commit`, or `dyknow pr`. The current implementation pretty-prints recent entries from the committed `docs/dyknow/.state/audit-log.jsonl` artifact and the git-local runtime audit file used for confirmed external PR-open events, newest first, labels each entry with the source audit file it came from, can filter by source (`all`, `committed`, `runtime`) and action family (`all`, `review`, `publish`), and remains read-only.
- Optional Graphify analysis: install Graphify with `pip install graphifyy && graphify install`, then run `graphify .` from the repo root or `npm run graphify` if Python and `graphifyy` are available. This provides an external interactive knowledge graph view of the code/doc corpus without changing DyKnow itself.
- Generating an HTML status snapshot: run `node packages/cli/dist/bin.js status` after a build. The current implementation writes `dyknow-progress-status.html` from live git metadata plus the current repo diff, update proposal, and audit artifacts.
- Applying approved proposals in one git commit: run `node packages/cli/dist/bin.js commit` after `dyknow review --approve ...`. The current implementation applies only `Approved` proposals, marks them `Published`, updates page files, creates one git commit when the worktree is otherwise clean, appends publish-action audit entries to `docs/dyknow/.state/audit-log.jsonl` as part of that committed flow, and requires `--allow-high-risk` before it will publish any approved proposal whose risk level is `high`.
- Creating a reviewable pull request for approved proposals: run `node packages/cli/dist/bin.js pr --branch <name>` from `main` after `dyknow review --approve ...`. The current implementation creates a new branch, reuses the approved-proposal apply-and-commit flow, pushes the branch to `origin`, opens a GitHub pull request with a page/risk/source summary table, records a `publish:pr-prepared` audit entry in the committed audit trail before the external PR creation call, appends a confirmed `publish:pr-opened` entry to the git-local runtime audit file after the external PR-open call succeeds, and requires `--allow-high-risk` before it will publish approved high-risk proposals.

## Community

- See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution and review workflow.
- See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for collaboration expectations.
- See [SECURITY.md](SECURITY.md) for vulnerability reporting.
- See [SUPPORT.md](SUPPORT.md) for support paths.

## License

This repository is available under the [MIT License](LICENSE).
