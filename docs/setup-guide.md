---
title: Setup Guide
purpose: Walk through the planned DyKnow Local CLI workflow from init to PR.
audience: external
sources:
  - sources/dyknow_local_whitepaper.md (section 8)
  - ../dyknow.config.json
  - ../dyknow.config.schema.json
  - dyknow/.state/repo-diff.json
  - dyknow/.state/update-proposals.json
  - ../packages/cli/src/audit.ts
  - ../packages/cli/src/commit.ts
  - ../packages/cli/src/diff.ts
  - ../packages/cli/src/index.ts
  - ../packages/cli/src/log.ts
  - ../packages/cli/src/pr.ts
  - ../packages/cli/src/review.ts
  - ../packages/cli/src/scan.ts
  - ../packages/cli/src/update.ts
  - ../packages/core/src/repo-diff.ts
  - ../packages/core/src/update-runner.ts
  - dyknow/.state/repo-map.json
last_reviewed: 2026-05-23
confidence: medium
---

## Summary

This page describes the DyKnow Local CLI workflow. `dyknow init`, `dyknow scan`, `dyknow diff`, `dyknow update`, `dyknow review`, `dyknow log`, `dyknow commit`, and the first `dyknow pr` publishing path are now implemented in this repo, while richer review editing and sync flows remain planned.

## Prerequisites

- A git repository.
- An LLM access method: local model, BYO API key, or vendor-hosted provider.
- Permission to write to a `docs/dyknow/` directory and (optionally) open pull requests.
- In this repository's current bootstrap, run `npm run build` before invoking `node packages/cli/dist/bin.js ...` directly.

## Step 1 — Initialize

```bash
dyknow init
```

Creates `dyknow.config.json` and `dyknow.config.schema.json`. The current implementation writes a local-only default config that points at the schema file and pre-populates the MVP 1 maintained pages for this repo.

If you are working inside this repo today, the direct invocation is:

```bash
node packages/cli/dist/bin.js init --force --project-name DyKnow
```

The config defines:

- Allowed folders
- Ignored folders
- Maintained pages
- Public/private output settings
- LLM provider
- Local-only mode
- Review requirements
- Source authority hierarchy
- Output formats
- Publishing targets

### Example config

```json
{
  "$schema": "./dyknow.config.schema.json",
  "projectName": "Example Product",
  "mode": "local-only",
  "allowedSources": [
    "README.md",
    "docs/**",
    "packages/**",
    ".github/**",
    "package.json"
  ],
  "ignoredSources": [
    ".env",
    "secrets/**",
    "node_modules/**",
    "dist/**",
    "logs/**"
  ],
  "pages": [
    {
      "id": "product-overview",
      "title": "Product Overview",
      "outputPath": "docs/product-overview.md",
      "audience": "mixed",
      "sources": ["README.md", "docs/**", "packages/**"],
      "reviewRules": { "approvalRequired": true }
    },
    {
      "id": "agent-context",
      "title": "AI Agent Context",
      "outputPath": "AGENTS.md",
      "audience": "agent",
      "sources": ["README.md", "docs/**", "packages/**"],
      "reviewRules": { "approvalRequired": true }
    }
  ],
  "approvalRequired": true,
  "llmProvider": "local",
  "publishTargets": []
}
```

## Step 2 — Scan

```bash
dyknow scan
```

Builds a repo map from the configured source set. The current implementation classifies markdown, JSON, YAML, and TypeScript files; flags route candidates heuristically; extracts package dependencies from `package.json` files; and warns on likely sensitive content patterns without writing raw file contents into the repo map.

If you are working inside this repo today, the direct invocation is:

```bash
node packages/cli/dist/bin.js scan
```

Output: `docs/dyknow/.state/repo-map.json`.

## Step 3 — Detect changes

```bash
dyknow diff
```

**Status:** implemented.

Compares current repo state against the previous repo-map snapshot without overwriting that snapshot. The current implementation identifies added, removed, and changed files; tracks warning additions and removals; maps those deltas to affected configured pages via page source patterns; and writes a structured diff artifact at `docs/dyknow/.state/repo-diff.json`.

If you are working inside this repo today, the direct invocation is:

```bash
node packages/cli/dist/bin.js diff
```

If no repo-map snapshot exists yet, `dyknow diff` exits with a helpful message telling you to run `dyknow scan` first.

## Step 4 — Draft updates

```bash
dyknow update
```

**Status:** implemented for the local stub drafting path.

Drafts updates to affected pages from `docs/dyknow/.state/repo-diff.json` and writes them to `docs/dyknow/.state/update-proposals.json`. Each suggested update includes:

- What changed
- Why the page needs updating
- Which source files triggered the change
- Confidence level
- Exact proposed text
- Risk level
- Whether human review is required

DyKnow does not blindly overwrite. It produces a diff with reasoning.

If you are working inside this repo today, the direct invocation is:

```bash
node packages/cli/dist/bin.js update
```

If no repo diff snapshot exists yet, `dyknow update` exits with a helpful message telling you to run `dyknow diff` first.

The current implementation uses the local stub update provider. It drafts `Needs review` proposals and never applies them automatically.

## Step 5 — Review

```bash
dyknow review
```

**Status:** implemented for the first persisted decision, text edit, editor edit, skip, regenerate, and review-audit slice.

The current implementation reads `docs/dyknow/.state/update-proposals.json`, can summarize proposal counts by review state, can persist approval, rejection, or escalation decisions, can replace one targeted proposal's `proposedText` while marking it `Edited` from either inline text or an external editor command, can explicitly skip targeted proposals without changing the snapshot, can regenerate targeted proposals from the saved repo diff, and appends one audit entry per targeted review action to `docs/dyknow/.state/audit-log.jsonl`.

If you are working inside this repo today, the direct invocation is:

```bash
node packages/cli/dist/bin.js review --approve --page product-overview
```

You can also target all proposals at once:

```bash
node packages/cli/dist/bin.js review --reject --all
```

To replace one proposal's draft text without applying it yet:

```bash
node packages/cli/dist/bin.js review --edit --page product-overview --text "Revised draft text"
```

To edit one proposal in an external editor and persist the result back into the snapshot:

```bash
DYKNOW_EDITOR_COMMAND=<editor-command> node packages/cli/dist/bin.js review --edit --page product-overview --editor
```

If `DYKNOW_EDITOR_COMMAND` is unset, the current implementation falls back to `EDITOR`.

To skip one proposal for now without changing its current review state:

```bash
node packages/cli/dist/bin.js review --skip --page product-overview
```

To regenerate one proposal from the saved repo diff and reset it to a fresh `Needs review` draft:

```bash
node packages/cli/dist/bin.js review --regenerate --page product-overview
```

If no update-proposals snapshot exists yet, `dyknow review` exits with a helpful message telling you to run `dyknow update` first.

The full walkthrough remains broader than the current slice. Reviewers will eventually be able to:

- Approve
- Reject
- Edit
- Regenerate
- Assign to another reviewer
- Mark source as irrelevant
- Update config rules

Today, approve / reject / escalate plus a single inline edited-proposal text path, a single external-editor edit path, explicit skip handling, and targeted regenerate handling are implemented. Richer in-product review surfaces remain planned.

The current audit slice still stays local and append-only, but it is no longer limited to review actions: `dyknow review`, `dyknow commit`, and `dyknow pr` all append audit entries to the same JSONL artifact.

## Step 6 — Inspect the audit trail

```bash
dyknow log
```

**Status:** implemented for the first read-only audit-viewer slice.

The current implementation reads the committed `docs/dyknow/.state/audit-log.jsonl` artifact plus the git-local runtime audit file used for confirmed external PR-open events, validates each JSONL line against the shared audit-entry schema, pretty-prints recent review and publish entries newest first with a per-entry source log label, supports `--source all|committed|runtime`, and does not mutate the committed log artifact.

If you are working inside this repo today, the direct invocation is:

```bash
node packages/cli/dist/bin.js log --limit 10 --source all
```

If no audit log exists yet, `dyknow log` exits successfully and tells you that no audit entries were found.

## Step 7 — Commit or publish

```bash
dyknow commit
```

or

```bash
dyknow pr
```

**Status:** `dyknow commit` and `dyknow pr` are implemented for the first apply-and-publish slices. `dyknow sync` is still planned.

The current implementation reads `docs/dyknow/.state/update-proposals.json`, applies only proposals whose `reviewState` is `Approved`, updates those output files, marks the applied proposals `Published`, appends publish audit entries to `docs/dyknow/.state/audit-log.jsonl`, and creates a single git commit.

If you are working inside this repo today, the direct invocation is:

```bash
node packages/cli/dist/bin.js commit
```

If no approved proposals exist yet, `dyknow commit` exits with a helpful message telling you to run `dyknow review --approve` first.

If the worktree has unrelated changes, `dyknow commit` refuses to proceed so the resulting commit only contains the approved DyKnow updates.

The current `dyknow pr` implementation must start from the base branch (defaults to `main`), creates a new branch, reuses the approved-proposal apply-and-commit step, carries a `publish:pr-prepared` audit entry in that committed local flow before the external PR-open call, pushes the branch to `origin`, opens a GitHub pull request with a summary table covering updated pages, source evidence, risk, and confidence, and appends a confirmed `publish:pr-opened` event to the git-local runtime audit file after the external PR-open call succeeds.

If you are working inside this repo today, the direct invocation is:

```bash
node packages/cli/dist/bin.js pr --branch dyknow/review-product-updates
```

If no approved proposals exist yet, `dyknow pr` exits with a helpful message telling you to run `dyknow review --approve` first. If you run it from the wrong starting branch, it tells you to return to the configured base branch or pass `--base` explicitly. The current audit trail now distinguishes the prepared local PR-publication state in the committed artifact from the confirmed external PR-open event in the git-local runtime audit file.

Optionally:

```bash
dyknow sync
```

Pushes approved outputs to DyKnow Cloud, a CMS, Notion, Confluence, or a website.

## Cross-references

- [Feature Map](feature-map.md) — full command list and VS Code surfaces.
- [Architecture](architecture.md) — what each component does internally.
- [Trust and Security](trust-and-security.md) — what DyKnow refuses to read or publish.

## Open questions

- Whether `dyknow init` should auto-detect the framework/stack and pre-fill `allowedSources`.
- Whether `dyknow init` should stay non-interactive by default or add an interactive prompt mode alongside current defaults.
