---
title: Phase 3 Public Demo Handoff
purpose: Define the next implementation slice to start Phase 3 with a concrete, reviewable demo setup.
audience: internal
sources:
  - docs/implementation-roadmap.md
  - docs/roadmap.md
  - AGENTS.md
last_reviewed: 2026-05-25
confidence: high
---

Phase 2 closure is complete, and the next useful move is to stand up a reproducible public demo workflow that proves the end-to-end value proposition with minimal setup friction.

## Immediate next artifacts

- [Phase 3 Demo Repo Selection](phase3-demo-repo-selection.md) — selected direction for the first public demo repo, plus rationale and baseline expectations.
- [Phase 3 Demo Checklist](phase3-demo-checklist.md) — concrete issue list for demo repo selection, baseline capture, staged changes, and recording prep.
- `npm run demo:smoke` — CI-ready smoke command scaffold that validates the handoff pages and runs the non-interactive `scan -> diff -> update` path.

## Current direction

Use a dedicated public sandbox repo for the first demo, not an existing dogfood repo. The selected repo shape is a small TypeScript Next.js app so the walkthrough leans on route and manifest metadata DyKnow already extracts today.

Current concrete target:

- Repo: `nickhilster/dyknow-demo-app`
- Baseline tag: `phase3-demo-baseline`
- Intentionally stale starting files: `README.md`, `docs/feature-map.md`, `docs/setup-guide.md`, `docs/architecture.md`, and `AGENTS.md`

## Scope for the next slice

1. Pick the demo repository and capture baseline assumptions.
2. Define the scripted walkthrough path for CLI and VS Code surfaces.
3. Add reproducible run commands and expected outputs for each stage.

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

- Should the first recorded walkthrough prioritize CLI or VS Code as the lead narrative?

## Next execution details

1. Create `nickhilster/dyknow-demo-app` from a small Next.js TypeScript starter on `main`.
2. Author stale baseline docs and tag that commit as `phase3-demo-baseline`.
3. Stage the feature addition, route rename, and dependency or setup drift on top of that baseline.

## Cross-references

- [Phase 3 Demo Repo Selection](phase3-demo-repo-selection.md)
- [Phase 3 Demo Checklist](phase3-demo-checklist.md)
- [Implementation Roadmap](implementation-roadmap.md)
- [Roadmap](roadmap.md)
- [Setup Guide](setup-guide.md)
- [Feature Map](feature-map.md)
