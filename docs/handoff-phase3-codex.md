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
  - AGENTS.md
last_reviewed: 2026-05-25
confidence: high
---

Phase 3 planning is now far enough along that the next useful work can move from repo-internal planning pages to execution against the demo sandbox itself. This handoff gives the next Codex operator the current branch, PR, artifacts, and the shortest path to continue without re-deriving context.

## Current state

- Active branch: `nickhilster/tea-367-phase-3-kickoff-select-demo-repo-and-script-reproducible`
- Active PR: `#45` — `TEA-367: kick off Phase 3 demo prep`
- Linear issue: `TEA-367`
- Current repo status at handoff time should be clean before the next slice starts.

## What is already done

The current branch has already established the Phase 3 planning stack:

- [Phase 3 Public Demo Handoff](handoff-phase3-demo.md) defines the top-level direction.
- [Phase 3 Demo Repo Selection](phase3-demo-repo-selection.md) locks the first demo repo to `nickhilster/dyknow-demo-app` and the baseline tag to `phase3-demo-baseline`.
- [Phase 3 Demo Baseline Plan](phase3-demo-baseline-plan.md) defines the proposed bootstrap commands, starter files, and baseline verification steps.
- [Phase 3 Demo Change Script](phase3-demo-change-script.md) defines the staged feature, route rename, setup drift, and stale-file set.
- [Phase 3 Demo Recording Runbook](phase3-demo-recording-runbook.md) defines the first CLI recording order, review pattern, and artifact checklist.

The branch also includes the `demo-smoke` hardening slice, so the handoff pages have a focused CLI validation path already in place.

## Recommended next moves

The next Codex operator should prefer this order:

1. Create or scaffold `nickhilster/dyknow-demo-app` from the baseline plan.
2. Verify the baseline tag flow and starter file set in the real demo repo.
3. Apply the staged source changes from the change script.
4. Reconcile the runbook against the actual page IDs, exact commands, and real repo layout.
5. Only after the real demo repo exists, tighten any remaining recording details in this DyKnow repo.

## Suggested execution approach

If the next operator continues inside this DyKnow repo first, keep changes limited to execution-facing artifacts only. Avoid reopening repo-selection or baseline-decision questions unless the actual demo repo creation forces a concrete correction.

If the next operator moves into the demo repo itself, use these pages as the authoritative source order:

1. [Phase 3 Demo Repo Selection](phase3-demo-repo-selection.md)
2. [Phase 3 Demo Baseline Plan](phase3-demo-baseline-plan.md)
3. [Phase 3 Demo Change Script](phase3-demo-change-script.md)
4. [Phase 3 Demo Recording Runbook](phase3-demo-recording-runbook.md)

## Known constraints

- Keep the Phase 3 story narrow: one visible feature, one route rename, one setup or dependency drift.
- Keep the docs intentionally stale until the DyKnow walkthrough updates them.
- Preserve the human-in-the-loop story by showing at least one approval action and one non-approval action.
- Do not expand scope into new product surfaces or extra integrations just to make the demo look bigger.

## Open questions for the next operator

- Whether the first real recording should include `dyknow init` or begin from a preconfigured demo repo.
- Which exact page IDs the demo repo config should use for the maintained files.
- Whether the first public cut should show audit-log output or stop at refreshed docs and `AGENTS.md`.

## Cross-references

- [Phase 3 Public Demo Handoff](handoff-phase3-demo.md)
- [Phase 3 Demo Repo Selection](phase3-demo-repo-selection.md)
- [Phase 3 Demo Baseline Plan](phase3-demo-baseline-plan.md)
- [Phase 3 Demo Change Script](phase3-demo-change-script.md)
- [Phase 3 Demo Recording Runbook](phase3-demo-recording-runbook.md)
- [Phase 3 Demo Checklist](phase3-demo-checklist.md)