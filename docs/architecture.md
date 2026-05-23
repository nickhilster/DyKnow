---
title: Architecture
purpose: Describe the component architecture of DyKnow Cloud, DyKnow Local, and the shared engine.
audience: mixed
sources:
  - sources/dyknow_local_whitepaper.md (sections 7, 8, 14)
last_reviewed: 2026-05-23
confidence: medium
---

## Summary

DyKnow Cloud and DyKnow Local share conceptual logic (source maps, page definitions, update reasoning, confidence scoring, review workflow, output templates, audit trails). They differ in **deployment environment**: Cloud runs as SaaS; Local runs where the customer's sensitive source material already lives.

## DyKnow Cloud — components

1. **Connector layer** — pulls from approved external/internal sources.
2. **Source ingestion layer** — normalizes raw payloads from each connector.
3. **Source normalization layer** — converts ingested content into a common internal representation.
4. **Change detection engine** — diffs new state against the previous snapshot per source.
5. **Knowledge graph / source map** — maps sources to the pages they inform.
6. **Page health engine** — scores each page for staleness, drift, and confidence.
7. **Drafting agent** — produces source-backed update diffs.
8. **Review workflow** — handles drafted/needs-review/approved/rejected/edited/published/archived/escalated states.
9. **Publishing layer** — pushes approved outputs to CMS, knowledge bases, websites, DyKnow Hub.
10. **Audit and governance layer** — records every action with source evidence.

## DyKnow Local — components

1. **CLI / VS Code interface** — primary surfaces.
2. **Local config file** — `dyknow.config.json` defining allowed/ignored sources, pages, providers, review rules.
3. **File scanner** — reads approved files only.
4. **Repo map generator** — produces a structured understanding of routes, components, APIs, data models, features, config, dependencies, behaviors.
5. **Snapshot store** — `docs/dyknow/.state/` (repo map, prior diffs, page state).
6. **Change detector** — compares current scan against prior snapshot.
7. **Local or BYO LLM runner** — local model, BYO API key, or vendor-hosted model — customer's choice.
8. **Documentation update engine** — drafts page updates with reasoning, source evidence, confidence, and risk.
9. **Diff reviewer** — surfaces proposed diffs via CLI or VS Code.
10. **Commit / PR generator** — creates branches and pull requests.
11. **Optional sync bridge** — pushes approved outputs to Cloud, CMS, Notion, Confluence.

## Shared engine

The following are intended to be implemented once and reused by both surfaces:

- Source maps
- Page definitions (config schema for a Dynamic Knowledge Page)
- Update reasoning (what changed, why this page is affected, what to propose)
- Confidence scoring
- Review workflow state machine
- Output templates
- Audit trail format

## Trust-relevant boundaries

- DyKnow Local never sends repo contents to an external service unless the customer configures a remote LLM or `sync` target.
- DyKnow Cloud never reads sources that haven't been explicitly connected.
- Both record every read and every drafted change in an audit log.

See [Trust and Security](trust-and-security.md).

## Cross-references

- [Feature Map](feature-map.md) — what the system does, externally.
- [Setup Guide](setup-guide.md) — how the Local components are invoked end-to-end.
- [Roadmap](roadmap.md) — order of implementation.

## Open questions

- Snapshot store format: single JSON, SQLite, or a directory tree?
- Whether the shared engine ships as a separate library or as embedded code in each surface.
- Default LLM provider for Local (likely BYO key + optional local model).
