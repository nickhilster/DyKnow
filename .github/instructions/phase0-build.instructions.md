---
description: "Use when bootstrapping DyKnow implementation work, choosing runtime and tooling, defining shared engine contracts, or building Phase 0 and Phase 1 Local CLI features like page definitions, source maps, update proposals, dyknow init, scan, diff, update, or review."
name: "DyKnow Phase 0 Build"
---

# DyKnow Phase 0 Build

- Anchor implementation decisions in `docs/implementation-roadmap.md`, `docs/roadmap.md`, `docs/architecture.md`, `docs/setup-guide.md`, and `docs/glossary.md`.
- Prefer one small vertical slice at a time. Good first slices are: page definition schema, source map contract, update proposal schema, audit log entry format, or `dyknow init` config validation.
- If runtime, package manager, repo location, or test and lint setup is still unresolved, surface that as the first blocking task instead of inventing a scaffold implicitly.
- Define shared contracts once for Local and Cloud where the docs say they are shared. Keep deployment-specific behavior outside those core types.
- Favor JSON-serializable, example-backed schemas first; add storage or transport details later.
- Every feature touching docs generation should carry source evidence, confidence, risk, and review-state data through the design.
- Validate each slice narrowly before expanding scope.