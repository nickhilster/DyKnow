---
title: Roadmap
purpose: Phased build path from internal prototype through commercial pilots.
audience: mixed
sources:
  - sources/dyknow_local_whitepaper.md (sections 15, 21)
last_reviewed: 2026-06-26
confidence: medium
---

## Summary

DyKnow is built in six phases (Phase 0–5), starting with foundational contracts and a CLI dogfooded inside maintainer-owned repos, progressing through a VS Code extension and public demo, and eventually reaching DyKnow Cloud Lite and commercial pilots.

## Phase 0 — Foundations

Status: Complete (100%)

Core contracts, config schema, CI, confidence/risk rubric, output template set, and conventional commit enforcement.

- `dyknow.config.json` + JSON Schema
- Confidence scoring rubric (`CONFIDENCE_SCORING_RUBRIC`)
- Risk classifier rules (`RISK_CLASSIFIER_RULES`, 6 categories)
- Output template registry (markdown-page, agents-md, claude-md, json-knowledge-map, rag-source-pack)
- Commit lint CI gate (`commitlint.config.js`)

## Phase 1 — DyKnow Local CLI

Status: Repo-local workflow complete and verified (85%) — broader dogfood and quality-bar closure remaining

Build DyKnow Local for maintainer-owned repositories and product folders.

### Implemented commands

- `dyknow init` — interactive prompts, stack detection (Next.js, Express, Python, generic)
- `dyknow scan` — repo map with deps, routes, Markdown headings, JSON/YAML keys, OpenAPI
- `dyknow diff` — structured delta and affected-page mapping
- `dyknow update` — BYO OpenAI + local stub provider, retry/timeout, cost telemetry
- `dyknow review` — interactive walkthrough: approve, reject, edit, skip, regenerate, external editor
- `dyknow log` — merged committed + runtime audit viewer with source and action filters
- `dyknow commit` — apply approved proposals with high-risk guard
- `dyknow pr` — branch + GitHub PR via `gh` with confirmed publish audit
- `dyknow status` — HTML repo status report with live workspace details

### Repo-verified local state

- CLI workflow is green in this repo under `build`, `test`, `lint`, and `typecheck`
- MCP now covers read, review, log, commit, and PR publication flows through the shared app layer
- the VS Code extension now has focused automated verification for command and publish-flow argument wiring in addition to its existing manual acceptance evidence

### Remaining

- Broader dogfood across maintainer-owned repos
- >90% precision change-detection quality bar on a labeled test set
- End-to-end cycle on each dogfood repo without manual fixup

### Success criteria

- Detects changes accurately.
- Produces useful diffs.
- Does not overwrite recklessly.
- Improves agent performance inside the repo.
- Reduces documentation maintenance burden.

## Phase 2 — VS Code Extension

Status: Complete (100%)

Visual interface around the CLI.

### Shipped sidebar views

- DyKnow Map
- Changed Knowledge
- Stale Pages
- Suggested Updates
- Source Evidence (first-class view, follows active Suggested Updates selection)
- Agent Context

### Shipped actions

- Approve / Reject / Edit / Regenerate / Mark source irrelevant (per-update inline)
- Commit and Open PR actions
- Status bar with pending count
- Diff viewer, telemetry opt-in

Quality bar met: acceptance artifacts and manual walkthrough evidence captured.

## Phase 3 — Public Demo

Status: In progress (~50%)

Demo sandbox live. CLI pass executed and validated. Recording runbook and VS Code walkthrough script locked.

### Done

- Demo repo `nickhilster/dyknow-demo-app` published with baseline tag `phase3-demo-baseline` (`fee6467f`)
- Staged drift branch `phase3-demo-staged-changes` (`361c59b`) with feature add, route rename, dependency drift
- CLI `scan → diff → update → review` executed end-to-end with approval and non-approval actions
- Recording runbook, change script, VS Code walkthrough script, and Codex handoff docs locked

### Remaining

- Record CLI footage against `phase3-demo-staged-changes` using the validated runbook
- Record VS Code extension footage using same source-change set
- Produce messaging assets (landing page, pitch deck, one-pager PDF, demo repo README polish)

## Phase 4 — DyKnow Cloud Lite

Status: Sprint 1 kickoff in progress (~10%) — the first control-plane slice is now defined, but hosted implementation has not landed yet.

### Planned additions

- Public website crawler
- Sitemap monitoring
- Manual file uploads
- DyKnow Hub publishing path
- 5–10 Dynamic Knowledge Pages

### Current sprint focus

- hosted auth, orgs, and workspaces
- source and page registration records
- read-only workspace dashboard
- latest run and pending-update summaries
- event model for later Local-to-Cloud ingestion

See [Cloud Sprint 1 Control Plane](cloud-sprint-1-control-plane.md).

Use first-party product pages or the public demo property as the first showcase.

## Phase 5 — Commercial Pilots

Status: Not started — depends on demo and productization readiness.

### Targets

- Small SaaS teams
- Agencies
- AI-native startups
- Developer tool companies

### Pilot offer

> We will create and maintain 5–10 Dynamic Knowledge Pages for your product and show how much product drift exists across your current website, docs, and support material.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Too broad too early | Start with one narrow workflow: detect repo/product changes and update approved markdown pages with source-backed diffs. |
| Trust barrier | Start local-first and public-source-only. Don't require private repo access. |
| Low perceived value (looks like AI-written docs) | Frame around drift, trust, source maps, review workflows, AI context maintenance. |
| Accuracy and liability | Human approval, source evidence, confidence scoring, audit logs, high-risk flags. |
| Integration complexity | Start with manual upload, local files, sitemap crawler, markdown docs, and 1–2 high-value connectors. |

## Cross-references

- [Feature Map](feature-map.md) — what features land in which phase.
- [Architecture](architecture.md) — the components being built.
- [Trust and Security](trust-and-security.md) — what must be true before any phase ships.
- [Implementation Roadmap](implementation-roadmap.md) — task-level checklist.

## Open questions

- Target dates for each phase.
- Which 1–2 Cloud connectors land first beyond sitemap (likely Notion or Google Docs).
