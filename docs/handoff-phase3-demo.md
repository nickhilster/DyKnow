---
title: Phase 3 Public Demo Handoff
purpose: Define the next implementation slice to start Phase 3 with a concrete, reviewable demo setup.
audience: internal
sources:
  - docs/implementation-roadmap.md
  - docs/roadmap.md
  - packages/vscode-extension/package.json
  - packages/vscode-extension/src/extension.ts
  - https://github.com/nickhilster/dyknow-demo-app
  - https://github.com/nickhilster/dyknow-demo-app/tree/phase3-demo-staged-changes
  - AGENTS.md
last_reviewed: 2026-05-27
confidence: high
---

Phase 2 closure is complete, and the next useful move is to stand up a reproducible public demo workflow that proves the end-to-end value proposition with minimal setup friction.

## Immediate next artifacts

- [Phase 3 Demo Repo Selection](phase3-demo-repo-selection.md) — selected direction for the first public demo repo, plus rationale and baseline expectations.
- [Phase 3 Demo Baseline Plan](phase3-demo-baseline-plan.md) — proposed bootstrap commands, starter files, and baseline verification steps for `dyknow-demo-app`.
- [Phase 3 Demo Change Script](phase3-demo-change-script.md) — exact staged source changes and intentionally stale files for the first walkthrough.
- [Phase 3 Demo Recording Runbook](phase3-demo-recording-runbook.md) — exact CLI recording order, review pattern, and capture artifacts for the first public cut.
- [Phase 3 Demo Checklist](phase3-demo-checklist.md) — concrete issue list for demo repo selection, baseline capture, staged changes, and recording prep.
- `npm run demo:smoke` — CI-ready smoke command scaffold that validates the handoff pages and runs the non-interactive `scan -> diff -> update` path.

## Current direction

Use a dedicated public sandbox repo for the first demo, not an existing dogfood repo. The selected repo shape is a small TypeScript Next.js app so the walkthrough leans on route and manifest metadata DyKnow already extracts today.

Current concrete target:

- Repo: `nickhilster/dyknow-demo-app`
- Baseline tag: `phase3-demo-baseline`
- Intentionally stale starting files: `README.md`, `docs/feature-map.md`, `docs/setup-guide.md`, `docs/architecture.md`, and `AGENTS.md`

Current execution state:

- Baseline tag commit: `fee6467f40dc92904ae706f2fdb40446436ea5ea`
- Staged drift branch: `phase3-demo-staged-changes` (`361c59b`)
- First CLI pass notes captured at `docs/phase3-recording-notes.md` in the demo repo
- Phase 3 recording defaults are now locked: CLI first, VS Code follow-up uses `skip` for the non-approval action, and the audit-log output stays appendix-only for the first public cut.
- The VS Code extension now exposes `Source Evidence` as a first-class DyKnow view, so the follow-up cut can show the planned sidebar sequence without relying on a separate panel.

## Scope for the next slice

1. Record the first CLI cut from the validated staged branch.
2. Mirror the walkthrough in VS Code with the same source-change set.
3. Finalize messaging and capture assets for the public-facing demo package.

## Deliverables

- One selected demo repository with rationale.
- A baseline snapshot plan (tag or explicit commit reference).
- A staged change plan that creates meaningful stale-to-fresh documentation diffs.
- A draft walkthrough script that covers:
  - stale starting docs,
  - source changes,
  - `dyknow scan`, `dyknow diff`, `dyknow update`,
  - human review actions,
  - updated docs and agent-context output.

## Acceptance criteria

- A new contributor can follow one page and run the demo path without extra tribal knowledge.
- The walkthrough includes at least one approval action and one non-approval action (skip, reject, or regenerate).
- The resulting artifacts are easy to reference in Phase 3 recording and messaging work.

## Open questions

- None for the current documented cut. The first public recording keeps audit-log output appendix-only, and the VS Code follow-up uses `skip` as the non-approval action.

## Next execution details

1. Capture CLI footage against `phase3-demo-staged-changes` using the exact command order in [Phase 3 Demo Recording Runbook](phase3-demo-recording-runbook.md).
2. Capture the VS Code walkthrough using the same baseline tag and staged branch.
3. Keep audit-log output in the appendix for the first public cut.

## Cross-references

- [Phase 3 Demo Baseline Plan](phase3-demo-baseline-plan.md)
- [Phase 3 Demo Change Script](phase3-demo-change-script.md)
- [Phase 3 Demo Recording Runbook](phase3-demo-recording-runbook.md)
- [Phase 3 Demo Repo Selection](phase3-demo-repo-selection.md)
- [Phase 3 Demo Checklist](phase3-demo-checklist.md)
- [Implementation Roadmap](implementation-roadmap.md)
- [Roadmap](roadmap.md)
- [Setup Guide](setup-guide.md)
- [Feature Map](feature-map.md)
