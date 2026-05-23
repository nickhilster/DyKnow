---
title: Setup Guide
purpose: Walk through the planned DyKnow Local CLI workflow from init to PR.
audience: external
sources:
  - sources/dyknow_local_whitepaper.md (section 8)
  - ../dyknow.config.json
  - ../dyknow.config.schema.json
  - ../packages/cli/src/diff.ts
  - ../packages/cli/src/index.ts
  - ../packages/cli/src/scan.ts
  - ../packages/core/src/repo-diff.ts
  - dyknow/.state/repo-map.json
last_reviewed: 2026-05-23
confidence: medium
---

## Summary

This page describes the DyKnow Local CLI workflow. `dyknow init`, `dyknow scan`, and `dyknow diff` are now implemented in this repo; the later review, update, and publish steps remain the target workflow.

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

Compares current repo state against the previous repo-map snapshot without overwriting that snapshot. The current implementation identifies added, removed, and changed files; tracks warning additions and removals; and writes a structured diff artifact at `docs/dyknow/.state/repo-diff.json`.

If you are working inside this repo today, the direct invocation is:

```bash
node packages/cli/dist/bin.js diff
```

If no repo-map snapshot exists yet, `dyknow diff` exits with a helpful message telling you to run `dyknow scan` first.

## Step 4 — Draft updates

```bash
dyknow update
```

**Status:** planned. `dyknow update` is not implemented yet.

Drafts updates to affected pages. Each suggested update includes:

- What changed
- Why the page needs updating
- Which source files triggered the change
- Confidence level
- Exact proposed text
- Risk level
- Whether human review is required

DyKnow does not blindly overwrite. It produces a diff with reasoning.

## Step 5 — Review

```bash
dyknow review
```

**Status:** planned. `dyknow review` is not implemented yet.

Or use the VS Code extension to inspect changes visually. Reviewers can:

- Approve
- Reject
- Edit
- Regenerate
- Assign to another reviewer
- Mark source as irrelevant
- Update config rules

## Step 6 — Commit or publish

```bash
dyknow commit
```

or

```bash
dyknow pr
```

**Status:** planned. `dyknow commit`, `dyknow pr`, and `dyknow sync` are not implemented yet.

Creates a branch and pull request containing the documentation updates.

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
