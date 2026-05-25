---
title: Phase 3 Demo Baseline Plan
purpose: Define the proposed bootstrap commands, starter layout, and reproducible baseline steps for the first public demo repo.
audience: internal
sources:
  - docs/phase3-demo-repo-selection.md
  - docs/handoff-phase3-demo.md
  - docs/phase3-demo-checklist.md
  - docs/implementation-roadmap.md
  - docs/setup-guide.md
  - AGENTS.md
last_reviewed: 2026-05-25
confidence: medium
---

This page turns the selected Phase 3 demo repo direction into a concrete baseline setup plan. The commands and file set below are the proposed starting point for `nickhilster/dyknow-demo-app`; they should be treated as the working bootstrap plan until the actual repo is created and verified.

## Proposed bootstrap commands

From a clean parent directory:

```bash
npx create-next-app@latest dyknow-demo-app --ts --eslint --app --src-dir --use-npm --import-alias "@/*"
cd dyknow-demo-app
git init
git checkout -b main
npm install
```

After the starter app exists, add the initial docs and agent-context files for the stale baseline:

```bash
mkdir docs
touch AGENTS.md docs/feature-map.md docs/setup-guide.md docs/architecture.md
git add .
git commit -m "chore: create phase 3 demo baseline"
git tag phase3-demo-baseline
```

## Proposed baseline file set

The initial baseline should contain these repo surfaces before any staged source changes are introduced:

- `src/app/page.tsx` — home page for the small demo app
- `src/app/pricing/page.tsx` — one recognizable static route
- `src/app/api/feedback/route.ts` — one lightweight API route
- `README.md` — intentionally stale product and run summary
- `docs/feature-map.md` — intentionally stale feature inventory
- `docs/setup-guide.md` — intentionally stale setup steps
- `docs/architecture.md` — intentionally stale route and data-flow summary
- `AGENTS.md` — intentionally stale repo context for coding agents
- `package.json` and `package-lock.json` — baseline dependency manifests for DyKnow scanning

This gives the Phase 3 walkthrough both source files and maintained knowledge files that can drift in visible ways.

## Proposed stale baseline story

The baseline should intentionally lag the actual app in a few specific ways:

- `README.md` describes only the home page and omits the pricing route.
- `docs/feature-map.md` omits one visible capability that already exists in the source tree.
- `docs/setup-guide.md` references an outdated local run command or misses one dependency detail.
- `docs/architecture.md` uses an old route name that will later be renamed again in the staged change script.
- `AGENTS.md` references only a subset of the app routes and source folders.

That baseline drift should be obvious enough that the DyKnow updates feel concrete instead of cosmetic.

## Proposed verification steps

Once the repo exists, validate the baseline with this order:

1. Confirm the app boots with `npm run dev`.
2. Confirm the repo is committed on `main` and tagged `phase3-demo-baseline`.
3. Add DyKnow config and run `dyknow scan` to verify the route and manifest metadata are visible.
4. Preserve the stale docs until the later staged source changes drive the full `scan -> diff -> update -> review` walkthrough.

## Open questions

- Should the baseline app include a second top-level marketing route beyond `pricing` for a stronger route-rename demo?
- Should the initial API route live under `src/app/api/**` only, or should the demo also include a client-side data fetch?
- Should the stale baseline commit include DyKnow config from the start, or should the recording introduce `dyknow init` later in the walkthrough?

## Cross-references

- [Phase 3 Demo Repo Selection](phase3-demo-repo-selection.md)
- [Phase 3 Public Demo Handoff](handoff-phase3-demo.md)
- [Phase 3 Demo Checklist](phase3-demo-checklist.md)
- [Setup Guide](setup-guide.md)
- [Implementation Roadmap](implementation-roadmap.md)