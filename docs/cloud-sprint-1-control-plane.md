---
title: Cloud Sprint 1 Control Plane
purpose: Define the first DyKnow Cloud implementation slice so the hosted product starts with a narrow, buildable control plane instead of a vague Phase 4 bucket.
audience: mixed
sources:
  - sources/dyknow_local_whitepaper.md (sections 6, 15, 21)
  - product-overview.md
  - architecture.md
  - roadmap.md
  - implementation-roadmap.md
  - mcp-server-plan.md
last_reviewed: 2026-06-29
confidence: medium
---

## Summary

DyKnow Cloud Sprint 1 should build the **hosted control plane**, not the full hosted product. The goal is to stand up the minimum multi-tenant web surface that can represent organizations, workspaces, source connections, page definitions, and read-only knowledge health. Sprint 1 ends when a first-party DyKnow workspace can be created in the browser, show its registered sources and page inventory, and display status cards for scan health, page health, and pending updates without requiring the VS Code extension.

## Why this is the right first Cloud slice

DyKnow Local is now functionally complete enough to act as the execution spine. That changes the Cloud question. The next risk is no longer "can DyKnow detect drift locally?" It is "what is the hosted product actually responsible for?" Sprint 1 answers that by shipping the control plane first:

- account and workspace model
- source registration and connection-state model
- page inventory and health model
- read-only dashboard for humans
- protocol boundary for later Local and connector orchestration

This keeps Cloud narrow and useful without prematurely building publishing, connector breadth, or a second drafting engine.

## Sprint goal

Deliver a hosted DyKnow Cloud shell where an authenticated user can:

1. sign in
2. create or enter an organization
3. create a workspace
4. register sources and page definitions for that workspace
5. view current page health, source connection state, latest scan status, and pending update counts

The sprint is successful if the hosted UI can represent real DyKnow state clearly, even if most state is seeded manually at first.

## Non-goals

Sprint 1 should not include:

- broad OAuth connector coverage
- live website crawling
- full review queue editing flows
- PR publishing from the web app
- billing
- custom domains
- CMS pushback
- a replacement for the Local CLI or MCP server

If a choice would force one of those concerns into Sprint 1, defer it.

## Product stance after Sprint 1

After Sprint 1, DyKnow Cloud should behave like a **control plane for knowledge operations**, not yet like the full automation engine.

In practical terms:

- Cloud owns identity, orgs, workspaces, visibility, and the shared hosted dashboard.
- Local and future connectors remain the systems that produce scan, diff, update, and review events.
- Cloud becomes the place where a human sees "what is drifting" before it becomes the place where a human publishes.

## User stories

### Founder / internal operator

"I want a hosted place where I can see all current DyKnow workspaces, their source coverage, page health, and pending work without opening each repo locally."

### Design partner admin

"I want to create a workspace for my product, define what sources and pages matter, and confirm the system understands the shape of my knowledge surface before I connect deeper automation."

### Reviewer

"I want a simple dashboard that tells me whether this workspace is healthy, stale, blocked, or waiting on review."

## Scope

### In scope

- authentication
- organization model
- workspace model
- source registration records
- page definition records
- status and health summaries
- audit-friendly event model for later orchestration
- first-party seed data path for DyKnow dogfood

### Optional in Sprint 1 only if cheap

- invite another user into an org
- a manual "mark workspace seeded" flow
- lightweight event timeline per workspace

## Data model

Sprint 1 should introduce hosted records for:

- `user`
- `organization`
- `organization_membership`
- `workspace`
- `workspace_source`
- `workspace_page`
- `workspace_run`
- `workspace_update_batch`
- `workspace_event`

### Minimum field intent

- `organization`: display name, slug
- `workspace`: name, slug, environment, status
- `workspace_source`: type, label, scope, connection status, last sync metadata
- `workspace_page`: page id, title, audience, risk profile, health status, last reviewed
- `workspace_run`: run type (`scan|diff|update|review-sync`), status, started/finished timestamps
- `workspace_update_batch`: counts by review state plus risk summary
- `workspace_event`: append-only human-readable event feed

Sprint 1 can use a relational database with explicit enums for status fields. Keep the status vocabulary narrow and boring.

## UI surface

Sprint 1 should ship a simple web app with these routes:

- `/login`
- `/orgs`
- `/orgs/:orgSlug`
- `/orgs/:orgSlug/workspaces/:workspaceSlug`
- `/orgs/:orgSlug/workspaces/:workspaceSlug/sources`
- `/orgs/:orgSlug/workspaces/:workspaceSlug/pages`

### Workspace dashboard sections

- workspace header: name, environment, status
- source coverage: connected, pending, errored, manual
- page health: healthy, stale, needs review, blocked
- latest run status: last scan, last diff, last update
- pending updates summary: counts by risk and review state
- recent activity: small append-only timeline

The dashboard should be read-only in Sprint 1 except for creating the workspace and registering records.

## Backend responsibilities

Sprint 1 backend responsibilities:

- auth/session handling
- org and workspace CRUD
- source and page-definition CRUD
- read models for dashboard summaries
- append-only event writes for important mutations

Sprint 1 backend should not execute scans, call LLMs, or open PRs directly. It only stores and serves control-plane state.

## Integration boundary with DyKnow Local

Sprint 1 must define, but does not need to fully automate, how Local reports into Cloud.

The preferred boundary is:

1. Local remains the execution engine.
2. Cloud exposes a narrow ingestion API for workspace runs, page health summaries, and update-batch summaries.
3. A later sprint adds authenticated upload or sync from Local/MCP into that API.

This keeps the Cloud architecture aligned with the Local MCP pivot instead of creating a Cloud-only workflow that competes with it.

## Suggested implementation shape

Keep the first hosted stack conventional. The repo does not need a complex platform decision before Sprint 1 starts. The important thing is clear boundaries.

A reasonable package shape is:

```txt
packages/
  cloud-api/
  cloud-web/
  cloud-shared/
```

Where:

- `cloud-shared` holds DTOs, enums, and summary contracts
- `cloud-api` owns auth, persistence, and read/write routes
- `cloud-web` owns the control-plane UI

If the team wants fewer packages at first, `cloud-web` and `cloud-api` can start in one app, but the hosted contracts should still be isolated.

## Acceptance criteria

Sprint 1 is done when all of the following are true:

- a user can sign in and land in a DyKnow Cloud org/workspace shell
- an org can create at least one workspace
- a workspace can store multiple source records with status
- a workspace can store multiple page records with health metadata
- the workspace dashboard renders summary cards from persisted data
- the dashboard shows the latest run status and pending update summary
- the system records append-only workspace events for core mutations
- first-party DyKnow dogfood data can be seeded and viewed end-to-end

## Risks

| Risk | Mitigation |
|---|---|
| Building too much product before proving the control plane | Keep Sprint 1 read-heavy and orchestration-light. |
| Cloud duplicates Local logic | Cloud stores state and summaries; Local remains the executor. |
| UI-first drift without stable contracts | Define workspace, run, page, and update-batch contracts before polishing pages. |
| Premature connector work | Start with manual records and seeded data; add live ingestion later. |

## What Sprint 2 should unlock

If Sprint 1 lands cleanly, Sprint 2 should add the first real Cloud ingestion path:

- authenticated Local-to-Cloud sync
- run ingestion for `scan`, `diff`, and `update`
- first non-manual source flow
- richer workspace activity timeline

That is the point where DyKnow Cloud becomes operational rather than representational.

## Cross-references

- [Product Overview](product-overview.md) — high-level Cloud and Local positioning.
- [Architecture](architecture.md) — current conceptual Cloud and Local boundary.
- [Roadmap](roadmap.md) — phase framing and current Phase 4 status.
- [Implementation Roadmap](implementation-roadmap.md) — task checklist across phases.
- [MCP Server Plan](mcp-server-plan.md) — why Local now centers on CLI + MCP rather than the VS Code extension.

## Open questions

- Which auth provider should be used for the first hosted shell?
- Should Sprint 1 seed first-party DyKnow data through fixtures, admin UI, or a one-off script?
- Does the first Local-to-Cloud ingestion path land as CLI `sync`, MCP tool, or both?
