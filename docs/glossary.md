---
title: Glossary
purpose: Canonical terms and concepts used throughout DyKnow documentation and product surfaces.
audience: mixed
sources:
  - sources/dyknow_local_whitepaper.md (throughout)
last_reviewed: 2026-05-23
confidence: high
---

## Summary

When in doubt, use these terms verbatim. Consistency across pages, marketing, and the product itself is part of the trust model.

## Core terms

**Dynamic Knowledge Page**
A fixed-topic, source-backed page that updates as the underlying source material changes. Organized by topic and purpose, not by publication date. Sometimes abbreviated as "DyKnow Page."

**DyKnow Cloud**
The hosted product. Connects to approved external and internal sources, monitors changes, detects stale pages, drafts updates, and routes them through human approval.

**DyKnow Local**
The repo-native product. CLI / VS Code extension / CI integration that runs inside the customer's own environment so that private code and context never leave the organization.

**DyKnow Hub**
The customer-facing surface that hosts a company's Dynamic Knowledge Pages (under DyKnow Cloud).

**Source map**
A mapping from raw sources (docs, repo files, tickets, etc.) to the Dynamic Knowledge Pages they inform. Used to determine which pages a change affects.

**Page health**
A scored assessment of how aligned a Dynamic Knowledge Page is with its current sources. Includes staleness, drift, and confidence signals.

**Repo map**
DyKnow Local's structured understanding of a codebase: routes, components, APIs, data models, features, config, dependencies, behaviors. Stored at `docs/dyknow/.state/repo-map.json`.

**Snapshot**
A point-in-time copy of the repo map and page state used as the baseline for change detection.

**Drafting agent**
The component that produces source-backed update diffs for affected pages.

**Source evidence**
The specific files, commits, issues, or docs that justify a proposed update. Always surfaced for human reviewers.

**Confidence score**
A per-update value indicating how strongly the proposed change is supported by source evidence.

**Risk level**
A per-update classification indicating sensitivity (e.g., low for typo fixes, high for pricing or legal claims).

**Review state**
One of: Drafted, Needs review, Approved, Rejected, Edited, Published, Archived, Escalated.

**High-risk content**
Content that must never publish automatically: pricing, legal language, compliance claims, security statements, medical claims, financial claims, customer data handling, enterprise commitments.

**Local-only mode**
A DyKnow Local configuration in which no source material, prompt, or output leaves the customer's environment. Implies a local or self-hosted LLM.

**BYO LLM / BYO key**
Bring-your-own LLM provider or API key. The customer controls inference.

**Allowed sources / Ignored sources**
The two lists in `dyknow.config.json` that govern what DyKnow Local may read.

**Maintained pages**
Pages declared in `dyknow.config.json` that DyKnow Local is responsible for keeping aligned.

**Audit log**
The immutable record of every read, draft, approval, and publish action.

## Wiki-internal terms

**Raw source**
An immutable input document (e.g., the whitepaper). Never edited.

**Wiki page**
A page in `docs/` that synthesizes from one or more raw sources. Always carries frontmatter with a `sources:` list and `last_reviewed` date.

**Schema**
The maintainer instructions in [CLAUDE.md](../CLAUDE.md). Tells the LLM how to operate the wiki.

**Log entry**
A line in `docs/log.md`. Append-only. Format: `YYYY-MM-DD | <action> | <scope> | <reason>`.

**Lint**
A wiki health check: looks for contradictions, stale pages, orphans, broken sources, missing cross-references, and unsourced claims.

## Cross-references

- [Product Overview](product-overview.md) — most terms used in context.
- [Architecture](architecture.md) — where each component lives.
- [Trust and Security](trust-and-security.md) — review states, risk levels, audit logs.
