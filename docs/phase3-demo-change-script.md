---
title: Phase 3 Demo Change Script
purpose: Define the exact staged source and doc drift changes that the first public demo walkthrough should apply after the baseline tag.
audience: internal
sources:
  - docs/phase3-demo-repo-selection.md
  - docs/phase3-demo-baseline-plan.md
  - docs/phase3-demo-checklist.md
  - docs/messaging.md
  - docs/implementation-roadmap.md
  - AGENTS.md
last_reviewed: 2026-05-25
confidence: medium
---

This page defines the first repeatable stale-to-fresh change set for `nickhilster/dyknow-demo-app`. It is intentionally small: the goal is to create visible product drift that DyKnow can detect and turn into source-backed updates without adding noise to the walkthrough.

## Change set overview

Apply the staged demo changes on top of the `phase3-demo-baseline` tag.

The planned changes are:

1. Add one visible feature to the app.
2. Rename one route so the repo map and docs both drift.
3. Update one setup or dependency detail.
4. Leave the maintained docs and `AGENTS.md` stale until the DyKnow flow updates them.

## Proposed source changes

### 1. Add a visible feature

Add a lightweight feedback inbox feature that turns the existing feedback API into a visible user-facing capability.

Source changes:

- Add `src/app/feedback/page.tsx` as the new route.
- Expand `src/app/api/feedback/route.ts` to reflect the new expected payload or response shape.
- Update home-page copy in `src/app/page.tsx` so the feature is discoverable from the landing screen.

Expected DyKnow effect:

- the scan output sees a new route,
- the feature map should gain the new feedback capability,
- `README.md` and `AGENTS.md` should mention the new route and supporting files.

### 2. Rename one route

Rename `src/app/pricing/page.tsx` to `src/app/plans/page.tsx`.

Source changes:

- move the route file from `pricing` to `plans`,
- update internal links or copy in `src/app/page.tsx`,
- keep the baseline docs stale so they still refer to pricing.

Expected DyKnow effect:

- the repo diff should show one removed route and one added route,
- `docs/architecture.md` and `docs/feature-map.md` should need updates,
- `AGENTS.md` should swap the old route reference for the new one.

### 3. Update one setup detail

Add one small setup drift that is easy to explain in the walkthrough.

Preferred option:

- add a lightweight dependency used by the new feedback UI or route flow,
- update the actual run instructions in the repo,
- keep `docs/setup-guide.md` stale until DyKnow drafts the correction.

Expected DyKnow effect:

- package manifest changes show up in the repo map and diff,
- `README.md` and `docs/setup-guide.md` need aligned updates.

## Files expected to start stale

These files should remain stale after the source changes land and before the DyKnow workflow runs:

- `README.md`
- `docs/feature-map.md`
- `docs/setup-guide.md`
- `docs/architecture.md`
- `AGENTS.md`

That stale set is deliberate. It keeps the demo focused on knowledge maintenance rather than generic code generation.

## Walkthrough checkpoints

The walkthrough should make these checkpoints easy to observe:

1. The code changes are already present, but the docs still describe the old product state.
2. `dyknow scan` captures the changed routes and dependency context.
3. `dyknow diff` maps those changes to affected maintained pages.
4. `dyknow update` drafts proposals for the stale files.
5. The review flow includes:
   - one approval action,
   - one non-approval action such as skip or regenerate.
6. The final output shows updated docs and updated agent context.

## Recommended review path

Use this review pattern in the first recording:

- approve the `README.md` or `docs/feature-map.md` update,
- regenerate or skip one lower-priority proposal,
- approve the `AGENTS.md` update so the agent-context angle is visible.

This keeps the human-in-the-loop story explicit without making the walkthrough feel adversarial.

## Open questions

- Which exact dependency change makes the setup drift easiest to explain without distracting from the main demo?
- Should the non-approval example be `skip` or `regenerate` in the first recording?
- Should the CLI and VS Code recordings use the exact same source-change set or slightly different review paths?

## Cross-references

- [Phase 3 Demo Baseline Plan](phase3-demo-baseline-plan.md)
- [Phase 3 Demo Repo Selection](phase3-demo-repo-selection.md)
- [Phase 3 Public Demo Handoff](handoff-phase3-demo.md)
- [Phase 3 Demo Checklist](phase3-demo-checklist.md)
- [Messaging](messaging.md)