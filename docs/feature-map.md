---
title: Feature Map
purpose: Inventory of DyKnow features across Cloud and Local, including connectors, scanning targets, outputs, and workflow steps.
audience: mixed
sources:
  - sources/dyknow_local_whitepaper.md (sections 4, 6, 7, 8, 13)
  - ../dyknow.config.json
  - ../packages/cli/src/index.ts
  - ../packages/cli/src/scan.ts
  - dyknow/.state/repo-map.json
last_reviewed: 2026-05-23
confidence: high
---

## Summary

This page lists what DyKnow does, separated by surface. For *why* and *how*, see [Product Overview](product-overview.md) and [Architecture](architecture.md).

## DyKnow Cloud

### Source connectors

| Category | Connectors |
|---|---|
| Website / CMS | Public crawler, sitemap monitor, RSS, WordPress, Webflow, Framer, Contentful, Sanity, Strapi, Shopify |
| Docs / Knowledge | Notion, Confluence, Google Drive/Docs, SharePoint/OneDrive, Zendesk Guide, Intercom Articles, Help Scout Docs, Guru, Slab |
| Product management | Linear, Jira, Asana, Trello, ClickUp, Monday.com, GitHub/GitLab/Azure DevOps Issues |
| Support / Feedback | Zendesk, Intercom, Freshdesk, HubSpot Service, Salesforce Service, Front, Help Scout, Typeform, Tally, Airtable, Google Forms |
| Sales / CRM | HubSpot, Salesforce, Pipedrive, Close, Attio |
| Communication | Slack, Microsoft Teams, Discord (scoped to specific channels only) |
| Design / Specs | Figma, FigJam, Miro, Whimsical |

Slack/Teams/Discord must be scoped to specific channels (e.g., `product-updates`, `release-notes`, `customer-feedback`). Broad workspace access is never the default.

### Cloud workflow

1. Connect approved sources.
2. Monitor for changes on a defined cadence.
3. Detect stale pages and draft updates with source evidence.
4. Route updates through human approval.
5. Publish to CMS, knowledge base, or DyKnow Hub.
6. Maintain audit log.

## DyKnow Local

### Forms

CLI, VS Code extension, GitHub Action, GitLab CI job, Bitbucket pipeline, local desktop app, self-hosted internal service. Likely early forms: CLI, VS Code extension, GitHub/GitLab PR workflow.

### What it scans (when permitted)

READMEs, `docs/` folders, source route files, API schemas, OpenAPI specs, package files, changelogs, feature flags, config files, tests, comments/docstrings, architecture notes, existing agent instruction files, markdown documentation.

### What it ignores by default

`.env` files, secrets, credentials, raw customer data, private keys, production dumps, sensitive logs, payment data, unapproved folders, build artifacts. Enforced through configuration and default ignore patterns. See [Trust and Security](trust-and-security.md).

### Local CLI commands

| Command | Status | Purpose |
|---|---|---|
| `dyknow init` | Implemented | Create `dyknow.config.json` and `dyknow.config.schema.json` with local-first defaults. |
| `dyknow scan` | Implemented | Build repo map at `docs/dyknow/.state/repo-map.json` while honoring `allowedSources` / `ignoredSources`, extracting package dependencies, and warning on likely sensitive content. |
| `dyknow diff` | Planned | Detect changes since last snapshot. |
| `dyknow update` | Planned | Draft updates with reasoning, source evidence, confidence. |
| `dyknow review` | Planned | Inspect proposed diffs. |
| `dyknow commit` | Planned | Commit approved updates. |
| `dyknow pr` | Planned | Open a pull request with updates. |
| `dyknow sync` | Planned | (Optional) push approved outputs to Cloud, CMS, Notion, Confluence. |

Full workflow detail: [Setup Guide](setup-guide.md).

### VS Code extension surfaces

- **DyKnow Map** — how DyKnow understands the project (areas, routes, features, APIs, docs, agent files).
- **Changed Knowledge** — what changed since the last scan.
- **Stale Pages** — pages likely needing updates.
- **Suggested Updates** — proposed diffs with source evidence.
- **Source Evidence** — files, commits, issues, or docs that justify each update.
- **Agent Context** — maintained AGENTS.md, CLAUDE.md, GEMINI.md, product-context.md, architecture.md, feature-map.md.

## Output types

### Public-facing
Product knowledge pages, feature explainers, help center articles, customer FAQs, setup guides, release interpretation, use case pages, pricing explanation.

### Internal
Sales enablement, support enablement, product briefs, onboarding docs, team FAQs, known limitations, competitive notes, product truth maps.

### Developer
README updates, architecture summaries, API behavior summaries, feature maps, changelog summaries, AGENTS.md, CLAUDE.md, GEMINI.md, CONTRIBUTING.md, setup instructions.

### Machine-readable
JSON knowledge maps, markdown context files, embedding-ready documents, RAG-ready source packs, API-accessible page data, structured change summaries.

## Cross-references

- [Architecture](architecture.md) — how the components are organized.
- [Setup Guide](setup-guide.md) — the Local CLI workflow in detail.
- [Trust and Security](trust-and-security.md) — what DyKnow refuses to do by default.
- [Roadmap](roadmap.md) — which features land in which phase.

## Open questions

- Initial connector set for Cloud Lite (likely sitemap + Notion or Google Docs).
- Whether `dyknow sync` is a separate command or a flag on `commit`/`pr`.
