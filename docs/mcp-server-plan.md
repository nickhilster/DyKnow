---
title: MCP Server Plan
purpose: Capture the IDE-agnostic DyKnow Local pivot, the extraction boundary that shipped, the current MCP tool surface, and the remaining MCP follow-up work.
audience: mixed
sources:
  - architecture.md
  - roadmap.md
  - implementation-roadmap.md
  - feature-map.md
  - ../packages/cli/src/index.ts
  - ../packages/cli/src/scan.ts
  - ../packages/cli/src/diff.ts
  - ../packages/cli/src/update.ts
  - ../packages/cli/src/review.ts
  - ../packages/cli/src/status.ts
  - ../packages/cli/src/commit.ts
  - ../packages/cli/src/pr.ts
  - ../packages/app/src/review-service.ts
  - ../packages/app/src/commit-service.ts
  - ../packages/app/src/pr-service.ts
  - ../packages/mcp-server/src/server.ts
  - ../packages/core/src/index.ts
  - ../packages/core/src/contracts.ts
last_reviewed: 2026-06-26
confidence: high
---

## Summary

DyKnow Local has now pivoted from **CLI + VS Code extension as the primary product story** to **CLI + MCP server as the primary integration story**. The CLI remains the source of truth. The MCP server is now the agent-native surface for Codex, Claude, Cursor, and other MCP-capable IDE or desktop clients. The existing VS Code extension remains an optional thin client rather than the main strategic dependency.

The practical rule is:

1. Keep the current CLI workflow intact.
2. Extract reusable application logic out of CLI command handlers.
3. Build `@dyknow/mcp-server` on top of that shared application layer.
4. Let editor-specific surfaces call the same underlying operations.

That extraction and first shipping pass are now complete for the shared review, commit, and PR flows.

## Why this pivot fits the current codebase

The current architecture already says DyKnow Local should share logic across surfaces. The present implementation has a strong CLI spine and a mostly complete VS Code shell, but the remaining quality risk is still in repo understanding, drift detection, and safe publication rather than in the sidebar UI. See [architecture.md](architecture.md) and [roadmap.md](roadmap.md).

Today the CLI surface already covers:

- `dyknow init`
- `dyknow scan`
- `dyknow diff`
- `dyknow update`
- `dyknow review`
- `dyknow log`
- `dyknow status`
- `dyknow commit`
- `dyknow pr`

Those commands are the real product contract. The current `packages/cli/src/index.ts` file also makes the extraction seam obvious: each command already delegates to a focused module such as `scan.ts`, `diff.ts`, `update.ts`, `review.ts`, `status.ts`, `commit.ts`, or `pr.ts`. The MCP server should reuse those underlying behaviors, not reimplement them.

## Product position after the pivot

DyKnow Local becomes:

- a repo-native CLI for humans and CI
- an MCP server for agent-native IDEs and desktops
- an optional VS Code extension for users who prefer a visual sidebar workflow

This keeps the local-first trust model and removes the need to treat VS Code as the only privileged client.

## Package plan

### Current packages

- `packages/core`
- `packages/cli`
- `packages/vscode-extension`

### Added package

Add:

```txt
packages/
  mcp-server/
    package.json
    tsconfig.json
    src/
      bin.ts
      server.ts
      tools/
        scan.ts
        diff.ts
        update.ts
        proposals.ts
        review.ts
        status.ts
        commit.ts
        pr.ts
      transport/
        stdio.ts
```

### Implemented intermediate extraction

Before implementing the MCP server, extract a reusable application layer:

```txt
packages/
  app/
    package.json
    tsconfig.json
    src/
      index.ts
      init-service.ts
      scan-service.ts
      diff-service.ts
      update-service.ts
      review-service.ts
      status-service.ts
      commit-service.ts
      pr-service.ts
      result-shapes.ts
```

This repo now took the direct `packages/app` route rather than the `packages/cli/src/lib/` fallback.

## Extraction boundary

### Keep in `packages/core`

Keep pure contracts and reusable schemas in `packages/core`:

- config schema and parsing
- repo map schema
- repo diff schema
- update proposal schema
- confidence/risk rubric
- template registry
- low-level update-runner and contract helpers

### Move into the application layer

Move orchestration logic that should be shared by CLI, MCP, and future surfaces:

- workspace path resolution for DyKnow operations
- scan orchestration
- diff orchestration
- proposal drafting orchestration
- proposal review-state mutation
- status report assembly
- approved proposal application
- PR/open-publish orchestration
- standardized success/error result shapes

### Keep in `packages/cli`

Keep only CLI-specific concerns in `packages/cli`:

- argument parsing
- terminal prompts
- terminal formatting
- exit codes
- help text

### Keep in `packages/vscode-extension`

Keep only client concerns in `packages/vscode-extension`:

- tree views
- status bar
- diff/evidence display
- editor commands
- workspace settings UI

The extension should call the same application layer via Node imports or the CLI as a temporary compatibility bridge.

## First implementation order

### Slice 1 — extraction without behavior change

Goal: no user-facing workflow changes.

1. Extract shared result types for `scan`, `diff`, `update`, `review`, `status`, `commit`, and `pr`.
2. Move command orchestration from `packages/cli/src/*.ts` into reusable service modules.
3. Keep CLI command outputs byte-for-byte as close as practical to the current behavior.
4. Re-run the existing CLI test suite after each extraction step.

Status: complete.

### Slice 2 — read-oriented MCP server

Status: complete.

Goal: let agent clients inspect a repo safely before mutation tools are used.

Implement these tools first:

- `dyknow_scan`
- `dyknow_diff`
- `dyknow_update`
- `dyknow_list_proposals`
- `dyknow_get_proposal`
- `dyknow_status`

### Slice 3 — mutation MCP tools

Status: complete for the first review and publish path.

Goal: complete the same human-in-the-loop workflow agents need.

Shipped mutation tools:

- `dyknow_review_proposal`
- `dyknow_commit`
- `dyknow_open_pr`

`Regenerated` is handled as a decision on `dyknow_review_proposal`, so a separate `dyknow_regenerate_proposal` tool was not added in the shipped surface.

The read-first rollout order still mattered: the server shipped read-oriented tools first, then added mutation tools once the shared app layer and tests were in place.

## Current MCP tool set

The first tool set should mirror the current CLI verbs closely so operator intent stays legible.

### `dyknow_scan`

Purpose: run the scan step and return a structured summary plus the artifact path.

Request:

```json
{
  "cwd": "C:/repo",
  "configPath": "dyknow.config.json",
  "outputPath": "docs/dyknow/.state/repo-map.json",
  "failOn": ["secret-pattern"]
}
```

Response:

```json
{
  "ok": true,
  "summary": {
    "filesScanned": 142,
    "warnings": 1
  },
  "artifacts": {
    "repoMapPath": "docs/dyknow/.state/repo-map.json"
  },
  "nextRecommendedAction": "Run dyknow_diff to compare the current workspace against the saved snapshot."
}
```

### `dyknow_diff`

Purpose: compare the current workspace against the stored repo-map snapshot and report affected pages.

Request:

```json
{
  "cwd": "C:/repo",
  "configPath": "dyknow.config.json",
  "snapshotPath": "docs/dyknow/.state/repo-map.json",
  "outputPath": "docs/dyknow/.state/repo-diff.json"
}
```

Response:

```json
{
  "ok": true,
  "summary": {
    "addedFiles": 1,
    "changedFiles": 4,
    "removedFiles": 0,
    "affectedPages": 3
  },
  "affectedPages": [
    {
      "pageId": "feature-map",
      "outputPath": "docs/feature-map.md",
      "reasons": ["changed-file"],
      "matchedSourcePaths": ["README.md", "packages/cli/src/index.ts"]
    }
  ],
  "artifacts": {
    "repoDiffPath": "docs/dyknow/.state/repo-diff.json"
  },
  "nextRecommendedAction": "Run dyknow_update to draft proposal text for the affected pages."
}
```

### `dyknow_update`

Purpose: draft update proposals from the repo diff.

Request:

```json
{
  "cwd": "C:/repo",
  "configPath": "dyknow.config.json",
  "diffPath": "docs/dyknow/.state/repo-diff.json",
  "outputPath": "docs/dyknow/.state/update-proposals.json"
}
```

Response:

```json
{
  "ok": true,
  "summary": {
    "affectedPages": 3,
    "draftedProposals": 3
  },
  "artifacts": {
    "updateProposalsPath": "docs/dyknow/.state/update-proposals.json"
  },
  "proposalCounts": {
    "needsReview": 3,
    "approved": 0,
    "rejected": 0,
    "edited": 0,
    "published": 0
  },
  "nextRecommendedAction": "Use dyknow_list_proposals or dyknow_get_proposal to inspect the drafted updates before any review action."
}
```

### `dyknow_list_proposals`

Purpose: return a lightweight list view for all proposals without forcing the client to parse the file directly.

Request:

```json
{
  "cwd": "C:/repo",
  "inputPath": "docs/dyknow/.state/update-proposals.json",
  "states": ["Needs review", "Approved", "Edited"]
}
```

Response:

```json
{
  "ok": true,
  "summary": {
    "total": 5,
    "matching": 3
  },
  "proposals": [
    {
      "pageId": "feature-map",
      "summary": "Refresh feature inventory for CLI and publish workflow changes.",
      "reviewState": "Needs review",
      "risk": "low",
      "confidence": "medium",
      "sources": ["README.md", "packages/cli/src/index.ts"]
    }
  ],
  "nextRecommendedAction": "Use dyknow_get_proposal for full text and evidence on one proposal."
}
```

### `dyknow_get_proposal`

Purpose: return one proposal with exact proposed text and its evidence set.

Request:

```json
{
  "cwd": "C:/repo",
  "inputPath": "docs/dyknow/.state/update-proposals.json",
  "pageId": "feature-map"
}
```

Response:

```json
{
  "ok": true,
  "proposal": {
    "pageId": "feature-map",
    "summary": "Refresh feature inventory for CLI and publish workflow changes.",
    "why": "Repo diff matched CLI command and setup-guide sources that inform the feature map.",
    "reviewState": "Needs review",
    "risk": "low",
    "confidence": "medium",
    "sources": ["README.md", "packages/cli/src/index.ts"],
    "proposedText": "# Feature Map\n..."
  },
  "affectedPage": {
    "outputPath": "docs/feature-map.md"
  },
  "nextRecommendedAction": "Use dyknow_review_proposal to approve, reject, edit, skip, or escalate this proposal."
}
```

### `dyknow_review_proposal`

Purpose: persist a review decision for one proposal.

Request:

```json
{
  "cwd": "C:/repo",
  "inputPath": "docs/dyknow/.state/update-proposals.json",
  "outputPath": "docs/dyknow/.state/update-proposals.json",
  "pageId": "feature-map",
  "decision": "Approved"
}
```

Allowed decisions:

- `Approved`
- `Rejected`
- `Escalated`
- `Edited`
- `Skipped`

If `decision` is `Edited`, the request must also include `proposedText`.

Response:

```json
{
  "ok": true,
  "updatedProposals": 1,
  "decision": "Approved",
  "artifactPath": "docs/dyknow/.state/update-proposals.json",
  "nextRecommendedAction": "List proposals again to confirm remaining work, or run dyknow_commit once the approved set is complete."
}
```

### `dyknow_log`

Purpose: return the merged committed/runtime DyKnow audit view with the same filter semantics as the CLI log command.

Request:

```json
{
  "cwd": "C:/repo",
  "inputPath": "docs/dyknow/.state/audit-log.jsonl",
  "limit": 10,
  "source": "all",
  "action": "all"
}
```

Response:

```json
{
  "ok": true,
  "summary": {
    "shownEntries": 4,
    "totalEntries": 4
  },
  "artifacts": {
    "inputPath": "docs/dyknow/.state/audit-log.jsonl"
  },
  "report": "Recent audit entries from docs/dyknow/.state/audit-log.jsonl and .git/dyknow/runtime-audit-log.jsonl ..."
}
```

### `dyknow_status`

Purpose: return a concise status summary plus the HTML report path.

Request:

```json
{
  "cwd": "C:/repo",
  "outputPath": "dyknow-progress-status.html"
}
```

Response:

```json
{
  "ok": true,
  "summary": {
    "branch": "main",
    "workingTree": "dirty",
    "affectedPages": 3,
    "draftedProposals": 3
  },
  "artifacts": {
    "htmlReportPath": "dyknow-progress-status.html"
  },
  "nextRecommendedAction": "Inspect proposals or resolve worktree issues before publishing."
}
```

### `dyknow_commit`

Purpose: apply approved proposals and create one commit.

Request:

```json
{
  "cwd": "C:/repo",
  "inputPath": "docs/dyknow/.state/update-proposals.json",
  "message": "docs: apply approved dyknow updates",
  "allowHighRisk": false
}
```

Response:

```json
{
  "ok": true,
  "summary": {
    "publishedProposals": 2,
    "commitHash": "abc1234"
  },
  "nextRecommendedAction": "Push the branch or use dyknow_open_pr if the repo is ready for review publication."
}
```

### `dyknow_open_pr`

Purpose: create a review branch, apply approved proposals, push it, and open a PR.

Request:

```json
{
  "cwd": "C:/repo",
  "inputPath": "docs/dyknow/.state/update-proposals.json",
  "base": "main",
  "branch": "dyknow/updates-2026-06-26",
  "title": "docs: refresh approved dyknow updates",
  "allowHighRisk": false
}
```

Response:

```json
{
  "ok": true,
  "summary": {
    "publishedProposals": 2,
    "branch": "dyknow/updates-2026-06-26",
    "url": "https://github.com/org/repo/pull/123"
  },
  "nextRecommendedAction": "Hand the PR to a human reviewer or continue the review workflow in the target forge."
}
```

## Tool design rules

Use these rules for every MCP tool:

1. Return structured data first, not terminal-formatted text.
2. Include artifact paths when a command writes files.
3. Include one `nextRecommendedAction` string so agents can chain the workflow safely.
4. Never return secrets or raw sensitive file contents.
5. Keep mutation tools explicit and narrow.
6. Preserve the current high-risk publish guard on `commit` and `open_pr`.
7. Prefer one proposal per review mutation tool call.

## Acceptance criteria for the MCP pivot

The pivot is successful when all of the following are true:

1. The CLI still passes its current tests unchanged or with minimal message-only diffs.
2. A minimal MCP server can complete `scan -> diff -> update -> list_proposals -> get_proposal` against the demo repo.
3. A second pass can complete `review -> commit` or `review -> open_pr` through MCP without bypassing the existing safety checks.
4. The VS Code extension can be left in place without becoming the critical path for agent integrations.

## What shipped

The repo now has:

1. `packages/app` as the shared application layer for scan, diff, update, review, status, commit, and PR orchestration.
2. `packages/mcp-server` with stdio transport.
3. Read-oriented MCP tools for `scan`, `diff`, `update`, `list_proposals`, `get_proposal`, `log`, and `status`.
4. Mutation MCP tools for `review_proposal`, `commit`, and `open_pr`.
5. CLI command wrappers for `review`, `commit`, and `pr` that now reuse the same shared app services as the MCP server.

## Recommended next slice

The next useful MCP follow-up work is:

1. Decide whether the VS Code extension should call the shared app layer directly for all remaining operations or selectively prefer MCP-style boundaries.
2. Validate the full MCP flow against `nickhilster/dyknow-demo-app`.
3. Decide whether a separate `sync` publish surface belongs in CLI first, MCP first, or only after Cloud Lite hardens.

## Cross-references

- [Architecture](architecture.md) — current surface/component framing.
- [Roadmap](roadmap.md) — current phase status.
- [Implementation Roadmap](implementation-roadmap.md) — task checklist across phases.
- [Feature Map](feature-map.md) — current Local surfaces and commands.

## Open questions

- Whether the reusable application layer should live in a new `packages/app` package immediately or begin as shared modules inside `packages/cli`.
- Whether the MCP server should expose only stdio first or reserve an HTTP transport for later local-webview tooling.
- Whether `dyknow log` should get its own MCP tool in the first cut or remain a second-wave read-only operation.
