---
title: Setup Guide
purpose: Walk through the planned DyKnow Local CLI workflow from init to PR.
audience: external
sources:
  - sources/dyknow_local_whitepaper.md (section 8)
last_reviewed: 2026-05-23
confidence: medium
---

## Summary

This page describes the planned DyKnow Local CLI workflow. **No commands exist yet** — this is the target workflow being built toward.

## Prerequisites (planned)

- A git repository.
- An LLM access method: local model, BYO API key, or vendor-hosted provider.
- Permission to write to a `docs/dyknow/` directory and (optionally) open pull requests.

## Step 1 — Initialize

```bash
dyknow init
```

Creates `dyknow.config.json`. The config defines:

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
  "projectName": "Example Product",
  "mode": "local-only",
  "allowedSources": [
    "README.md",
    "docs/**",
    "src/routes/**",
    "openapi.yaml",
    "CHANGELOG.md"
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
      "output": "docs/dyknow/product-overview.md",
      "audience": "internal",
      "sources": ["README.md", "docs/**", "src/routes/**"]
    },
    {
      "id": "agent-context",
      "title": "AI Agent Context",
      "output": "AGENTS.md",
      "audience": "agent",
      "sources": ["README.md", "docs/**", "src/**"]
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

Builds a repo map: routes, components, API endpoints, data models, feature areas, config, existing docs, product concepts, architecture patterns, dependencies, user-facing behaviors.

Output: `docs/dyknow/.state/repo-map.json`.

## Step 3 — Detect changes

```bash
dyknow diff
```

Compares current repo state against the previous snapshot. Identifies new/removed features, changed APIs, changed routes, changed config, new dependencies, updated setup process, changed terminology, stale documentation, and which DyKnow Pages are affected.

## Step 4 — Draft updates

```bash
dyknow update
```

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
- Default page set for `init` (likely Product Overview, Feature Map, Architecture, Setup Guide, AGENTS.md per MVP 1).
