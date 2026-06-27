---
title: Product Overview
purpose: Explain what DyKnow is, the problem it solves, and how the two product surfaces fit together.
audience: mixed
sources:
  - sources/dyknow_local_whitepaper.md (sections 1–4, 19, 22)
last_reviewed: 2026-05-28
confidence: high
---

## Summary

DyKnow is a system for maintaining **Dynamic Knowledge Pages** — fixed-topic, source-backed pages that update as the underlying product, code, or source material changes. It ships in two complementary surfaces: **DyKnow Cloud** (hosted, monitors approved external/internal sources) and **DyKnow Local** (repo-native CLI / VS Code extension that runs where sensitive code already lives).

## The problem

Products change faster than the content that explains them. Code ships, features evolve, pricing shifts, customer questions reveal gaps — and meanwhile help docs go stale, website copy stops reflecting reality, sales teams improvise positioning, support repeats clarifications, and AI agents read outdated context.

Traditional content systems are built around publishing: a blog post is written once and archived chronologically; a doc page is edited inconsistently; a changelog records events without explaining their meaning. That model does not survive an AI-assisted environment where more code ships faster and AI agents act on whatever context they find.

## The concept: Dynamic Knowledge Pages

A Dynamic Knowledge Page is **not** a blog post, **not** a static doc page, and **not** a generic AI-written article. It is a canonical, source-backed page organized by topic and purpose rather than publication date. It becomes stale only when the underlying source material changes, and it is updated in place.

> A blog says: "Here is what we published on this date."
> A DyKnow Page says: "Here is the current truth about this topic."

Examples of pages: Product Overview, Feature Map, Pricing Logic, API Behavior, Setup Guide, Customer FAQ, Internal Sales Enablement, Known Limitations, AI Agent Context, Competitive Positioning, Onboarding Guide, Technical Architecture Summary.

## The two surfaces

### DyKnow Cloud
Hosted product. Connects to approved external/internal sources (websites, CMS, Notion, Confluence, Linear, Zendesk, Slack channels, Figma, etc.), monitors changes, detects stale pages, drafts source-backed updates, and routes them through human approval. Best for teams willing to integrate at the knowledge layer.

### DyKnow Local
Repo-native. Runs as a CLI, VS Code extension, GitHub Action, GitLab pipeline, or self-hosted service. Scans approved files (READMEs, docs folders, OpenAPI specs, route files, config) and maintains markdown pages and agent-context files inside the customer's environment. Best for organizations that won't send private code to an external SaaS.

The two surfaces share conceptual logic — source maps, page definitions, update reasoning, confidence scoring, review workflow, output templates, audit trails — and differ only in deployment environment.

## Who DyKnow is for

- **Cloud**: SaaS startups, agencies managing client sites, AI product companies, developer tool companies, support-heavy services, education platforms.
- **Local**: AI-native startups, dev-tool companies, OSS maintainers, teams using AI coding agents, security-sensitive teams, internal platform teams.
- **Early dogfood**: maintainer-owned repos and first-party product surfaces before wider pilots.

## Why now

As AI agents become part of product development, customer support, sales, and onboarding, stale knowledge becomes more dangerous. A human might recognize an outdated doc; an AI agent will simply act on it. DyKnow exists to keep product truth alive across code, docs, websites, teams, and AI agents.

## Cross-references

- [Feature Map](feature-map.md) — full feature inventory.
- [Architecture](architecture.md) — how Cloud and Local are built.
- [Trust and Security](trust-and-security.md) — the trust model that makes adoption possible.
- [Messaging](messaging.md) — positioning and audience pitches.
- [Glossary](glossary.md) — canonical terms.

## Open questions

- Final naming convention for shared engine components across Cloud and Local.
- Whether "Dynamic Knowledge Page" stays the public term or becomes shortened (e.g., "DyKnow Page").
