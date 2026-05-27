---
title: Phase 3 Codex Takeover Handoff
purpose: Give the next Codex operator a concise, source-backed snapshot of the current Phase 3 sprint state, artifacts, and recommended next moves.
audience: agent
sources:
  - docs/handoff-phase3-demo.md
  - docs/phase3-demo-repo-selection.md
  - docs/phase3-demo-baseline-plan.md
  - docs/phase3-demo-change-script.md
  - docs/phase3-demo-recording-runbook.md
  - docs/phase3-demo-checklist.md
  - packages/core/src/config.ts
  - packages/cli/src/index.ts
  - packages/vscode-extension/package.json
  - packages/vscode-extension/src/extension.ts
  - https://github.com/nickhilster/dyknow-demo-app
  - https://github.com/nickhilster/dyknow-demo-app/tree/phase3-demo-staged-changes
  - AGENTS.md
last_reviewed: 2026-05-27
confidence: high
---

Phase 3 planning is now far enough along that the next useful work can move from repo-internal planning pages to execution against the demo sandbox itself. This handoff gives the next Codex operator the current branch, PR, artifacts, and the shortest path to continue without re-deriving context.

## Current state

- Active branch: `nickhilster/tea-367-phase-3-kickoff-select-demo-repo-and-script-reproducible`
- Active PR: `#45` — `TEA-367: kick off Phase 3 demo prep`
- Linear issue: `TEA-367`
- Demo repo: `https://github.com/nickhilster/dyknow-demo-app`
- Baseline tag + commit: `phase3-demo-baseline` at `fee6467f40dc92904ae706f2fdb40446436ea5ea`
- Staged drift branch + commit: `phase3-demo-staged-changes` at `361c59b`

## What is already done

The current branch has already established the Phase 3 planning stack:

- [Phase 3 Public Demo Handoff](handoff-phase3-demo.md) defines the top-level direction.
- [Phase 3 Demo Repo Selection](phase3-demo-repo-selection.md) locks the first demo repo to `nickhilster/dyknow-demo-app` and the baseline tag to `phase3-demo-baseline`.
- [Phase 3 Demo Baseline Plan](phase3-demo-baseline-plan.md) defines the proposed bootstrap commands, starter files, and baseline verification steps.
- [Phase 3 Demo Change Script](phase3-demo-change-script.md) defines the staged feature, route rename, setup drift, and stale-file set.
- [Phase 3 Demo Recording Runbook](phase3-demo-recording-runbook.md) defines the first CLI recording order, review pattern, and artifact checklist.

The branch also includes the `demo-smoke` hardening slice, so the handoff pages have a focused CLI validation path already in place.

Execution is now in-flight in the real demo repo:

- baseline app, stale docs, and DyKnow config are committed on `main`,
- staged source drift is committed on `phase3-demo-staged-changes`,
- first CLI pass artifacts and notes are captured in `docs/phase3-recording-notes.md` in the demo repo.
- Phase 3 recording defaults are locked: CLI first, VS Code follow-up uses `skip` for the non-approval action, and audit-log output stays appendix-only in the first public cut.
- the VS Code extension now exposes `Source Evidence` as a first-class DyKnow view that follows the active `Suggested Updates` selection, matching the planned demo sequence.

## Recommended next moves

The next Codex operator should prefer this order:

1. Record the first CLI cut using `phase3-demo-staged-changes` and the reconciled runbook commands.
2. Produce the VS Code cut using the same baseline and staged branch.
3. Feed final recording deltas back into the Phase 3 docs and messaging pages.

## Suggested execution approach

If the next operator continues inside this DyKnow repo first, keep changes limited to execution-facing artifacts only. Avoid reopening repo-selection or baseline-decision questions unless the actual demo repo creation forces a concrete correction.

If the next operator moves into the demo repo itself, use these pages as the authoritative source order:

1. [Phase 3 Demo Repo Selection](phase3-demo-repo-selection.md)
2. [Phase 3 Demo Baseline Plan](phase3-demo-baseline-plan.md)
3. [Phase 3 Demo Change Script](phase3-demo-change-script.md)
4. [Phase 3 Demo Recording Runbook](phase3-demo-recording-runbook.md)

## Current operator defaults

Until the real demo repo forces a correction, use these defaults:

- Recording lead: CLI first.
- Main recording path: start from a preconfigured repo; do not show `dyknow init` in the core cut.
- Maintained page IDs for review actions: `product-overview`, `feature-map`, `architecture`, `setup-guide`, `agent-context`.
- First public ending: refreshed docs plus refreshed `AGENTS.md`; keep audit-log output appendix-only.
- VS Code follow-up: use `skip` for the non-approval action so it contrasts with the CLI `regenerate` example.
- Audit-log appendix: keep it out of the main story unless the later public cut explicitly needs it.

## Known constraints

- Keep the Phase 3 story narrow: one visible feature, one route rename, one setup or dependency drift.
- Keep the docs intentionally stale until the DyKnow walkthrough updates them.
- Preserve the human-in-the-loop story by showing at least one approval action and one non-approval action.
- Do not expand scope into new product surfaces or extra integrations just to make the demo look bigger.

## Remaining open items for the next operator

- Capture the VS Code recording once the CLI cut is stable.
- Feed any final recording deltas back into the Phase 3 docs and messaging pages.

## Cross-references

- [Phase 3 Public Demo Handoff](handoff-phase3-demo.md)
- [Phase 3 Demo Repo Selection](phase3-demo-repo-selection.md)
- [Phase 3 Demo Baseline Plan](phase3-demo-baseline-plan.md)
- [Phase 3 Demo Change Script](phase3-demo-change-script.md)
- [Phase 3 Demo Recording Runbook](phase3-demo-recording-runbook.md)
- [Phase 3 Demo Checklist](phase3-demo-checklist.md)
