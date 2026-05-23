---
title: Roadmap
purpose: Phased build path from internal prototype through commercial pilots.
audience: internal
sources:
  - sources/dyknow_local_whitepaper.md (sections 15, 21)
last_reviewed: 2026-05-23
confidence: medium
---

## Summary

DyKnow is built in five phases, starting with a CLI dogfooded inside Teambotics and progressing toward DyKnow Cloud Lite and commercial pilots.

## Phase 1 — Internal prototype (DyKnow Local CLI)

Build DyKnow Local for Teambotics repositories and product folders.

**Goal: maintain these pages**
- AGENTS.md
- Product Overview
- Feature Map
- Architecture Summary
- Changelog Summary

**Success criteria**
- Detects changes accurately.
- Produces useful diffs.
- Does not overwrite recklessly.
- Improves agent performance inside the repo.
- Reduces documentation maintenance burden.

**MVP 1 features**
- `dyknow init` and config generation
- Source allowlist / ignore list
- Repo scan
- Basic repo map
- Maintain 3–5 markdown pages
- Diff generation
- Human approval
- Local commit
- Optional local LLM / BYO key support

## Phase 2 — VS Code extension prototype

Visual interface around the CLI.

**Goals**
- Make the workflow understandable.
- Show stale pages.
- Show source evidence.
- Approve/reject/edit updates.

**Core features**
- Sidebar
- Scan button
- Page health view
- Suggested updates
- Source evidence panel
- Approve/reject/edit flow
- Commit or PR action

## Phase 3 — Public demo

Demo repo showing:

- Before: stale docs
- Repo changes
- DyKnow scan
- Suggested updates
- Human approval
- Updated docs
- Updated AGENTS.md

This becomes the pitch asset.

## Phase 4 — DyKnow Cloud Lite

**Add**
- Public website crawler
- Sitemap monitoring
- Manual file uploads
- DyKnow Hub
- 5–10 Dynamic Knowledge Pages

Use Teambotics product pages as the first showcase.

## Phase 5 — Commercial pilots

**Targets**
- Small SaaS teams
- Agencies
- AI-native startups
- Developer tool companies

**Pilot offer**
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

## Open questions

- Target dates for each phase.
- Which 1–2 Cloud connectors land first beyond sitemap (likely Notion or Google Docs).
- Whether Phase 2 (VS Code) and Phase 3 (public demo) can run in parallel.
