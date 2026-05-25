---
title: Phase 3 Demo Repo Selection
purpose: Record the chosen first public demo repo direction, its rationale, and the baseline plan for the Phase 3 walkthrough.
audience: internal
sources:
  - docs/handoff-phase3-demo.md
  - docs/phase3-demo-checklist.md
  - docs/implementation-roadmap.md
  - docs/roadmap.md
  - AGENTS.md
last_reviewed: 2026-05-25
confidence: high
---

The first public demo should use a new dedicated sandbox repository rather than an existing dogfood repo. The selected shape is a small TypeScript Next.js app repo with intentionally stale docs, a maintained `AGENTS.md`, and a narrow change script that DyKnow can scan, diff, draft, and review without extra setup.

## Decision

Use a dedicated public demo repo for Phase 3.

The first repo should be a small Next.js-flavored TypeScript app because the current DyKnow scanner already extracts package-manifest data plus lightweight Next.js route metadata. That keeps the demo aligned with implemented capabilities instead of relying on a repo shape the current CLI does not highlight as clearly.

## Why this direction

- A public demo is a pitch asset, so the repo should be safe to record and share without carrying internal dogfood history or unrelated product context.
- The handoff calls for a reproducible walkthrough with minimal setup friction, which is easier to guarantee in a purpose-built sandbox than in a live dogfood repo.
- AGENTS.md keeps the trust boundary explicit: no private data should appear in this repo, which also argues for a clean public sandbox.
- The implementation roadmap already frames the Phase 3 change script around a feature addition, a route rename, and a dependency bump; a small dedicated app makes those deltas easy to stage and explain.

## Baseline plan

- Create a new dedicated demo repository under the DyKnow or Teambotics GitHub space.
- Start from a small Next.js TypeScript app with a few recognizable routes and one lightweight API or server-backed interaction.
- Include stale starting docs that DyKnow can visibly improve:
  - `README.md`
  - `docs/feature-map.md`
  - `docs/setup-guide.md`
  - `AGENTS.md`
- After the stale baseline is in place, cut an explicit baseline tag before the staged source changes are introduced.

## Planned staged changes

The first walkthrough should include a small set of source changes that map directly to Phase 3 success criteria:

- add one visible feature,
- rename or move one route,
- bump one dependency or setup detail,
- leave the docs stale until the `scan -> diff -> update -> review` flow runs.

This keeps the before-and-after story obvious in both the CLI and VS Code flows.

## Implications for the walkthrough

- The CLI smoke path should run against this dedicated repo without interactive prompts.
- The recorded walkthrough can show both an approval action and a non-approval action without exposing unrelated repo churn.
- The resulting docs and agent-context updates stay attributable to a single controlled change script.

## Open questions

- What exact GitHub repo name and owner should host the dedicated demo sandbox?
- Should the first recorded narrative lead with the CLI or the VS Code extension?
- Which baseline tag name should the recording script standardize on?

## Cross-references

- [Phase 3 Public Demo Handoff](handoff-phase3-demo.md)
- [Phase 3 Demo Checklist](phase3-demo-checklist.md)
- [Implementation Roadmap](implementation-roadmap.md)
- [Roadmap](roadmap.md)
- [Setup Guide](setup-guide.md)