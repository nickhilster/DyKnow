---
title: DyKnow Cloud Sprint 1 Plan
purpose: Give the next implementation agent a narrow, ordered checklist for building the first DyKnow Cloud control-plane slice without drifting into later hosted-product concerns.
audience: agent
sources:
  - ../cloud-sprint-1-control-plane.md
  - ../architecture.md
  - ../roadmap.md
  - ../implementation-roadmap.md
  - ../mcp-server-plan.md
last_reviewed: 2026-06-29
confidence: medium
---

## Summary

This is the worker-facing implementation plan for **DyKnow Cloud Sprint 1**. Build the hosted control plane only: auth, orgs, workspaces, source/page registration, workspace dashboard summaries, and append-only workspace events. Do not add live connectors, drafting flows, billing, or web-based publishing in this sprint.

## Rules

- Keep DyKnow Local as the execution engine.
- Treat Cloud as a control plane and read model first.
- Prefer manual seed data over premature automation.
- Keep status enums narrow and explicit.
- Record important mutations as append-only events.

## Deliverables

- hosted web app shell
- hosted API or server routes
- persistent schema for orgs, workspaces, sources, pages, runs, update batches, events
- workspace dashboard
- first-party seed path for DyKnow dogfood
- basic tests for core summaries and route guards

## Ordered checklist

### 1. Choose the initial hosted package shape

- Decide whether to add one app package or split `cloud-web`, `cloud-api`, and `cloud-shared`.
- Keep the first slice as small as possible.
- Preserve clean boundaries around DTOs and status enums even if starting in one package.

Definition of done:

- package layout exists
- root workspace config includes the new package(s)
- build/lint/test commands still work at repo level

### 2. Define shared hosted contracts

- Create DTOs and enums for:
  - organization
  - workspace
  - workspace source
  - workspace page
  - workspace run
  - workspace update batch
  - workspace event
- Keep display-oriented summaries separate from raw persistence models if useful.
- Prefer explicit summary types for dashboard cards.

Definition of done:

- contracts compile
- status names are stable and documented in code comments where needed
- tests cover enum and summary invariants

### 3. Add persistence

- Add the first hosted database schema.
- Create tables or equivalent models for the Sprint 1 entities.
- Include created/updated timestamps and stable ids.
- Keep destructive migrations out of scope; start from clean bootstrapping.

Definition of done:

- fresh local setup can create the schema
- one seed script can populate a demo org and workspace

### 4. Add authentication and org membership

- Implement sign-in for the hosted app.
- Add a default org creation flow for the first signed-in user.
- Add org membership checks for protected routes.
- Defer complex invite flows if they slow the sprint.

Definition of done:

- anonymous users cannot access workspace routes
- authenticated users can access only their org-scoped data

### 5. Add workspace CRUD

- Create a workspace creation flow.
- Store name, slug, environment, and top-level status.
- Show the workspace in org navigation.

Definition of done:

- a user can create and revisit a workspace through the UI

### 6. Add source registration

- Add manual source registration records.
- Support source type, label, scope, connection status, and last-sync metadata fields.
- Keep these records human-readable; they are control-plane entries, not raw connector payloads.

Definition of done:

- a workspace can display multiple sources with distinct statuses

### 7. Add page-definition registration

- Add workspace page records with page id, title, audience, risk profile, health status, and last reviewed fields.
- Keep the page model close to existing DyKnow concepts without importing repo-local file paths into Cloud.

Definition of done:

- a workspace can display multiple pages with health metadata

### 8. Add run and update-batch summaries

- Add persisted records for latest scan/diff/update runs.
- Add a persisted update-batch summary with counts by review state and risk band.
- Expose read helpers that return the latest run and current pending summary for a workspace.

Definition of done:

- dashboard cards can render from persisted summary data without mock-only logic

### 9. Add append-only workspace events

- Record events for:
  - org created
  - workspace created
  - source added
  - page added
  - run recorded
  - update batch recorded
- Keep event payloads concise and readable.

Definition of done:

- workspace page shows a recent activity list backed by stored events

### 10. Build the workspace dashboard

- Add summary cards for:
  - source coverage
  - page health
  - latest run status
  - pending updates
- Add a small recent activity feed.
- Keep the UI clear and functional; avoid overdesign on the first slice.

Definition of done:

- a first-party workspace can be inspected end-to-end in the browser

### 11. Add seed data and dogfood flow

- Add a seed script or admin path for a first-party DyKnow workspace.
- Seed realistic sources, pages, run records, update summary records, and events.
- Use this seeded workspace as the Sprint 1 acceptance path.

Definition of done:

- a fresh local setup can show a believable DyKnow Cloud workspace without manual database editing

### 12. Add validation and tests

- Add unit or integration coverage for summary calculations and route guards.
- Add at least one end-to-end smoke path for:
  - sign in
  - create workspace
  - add source
  - add page
  - view dashboard

Definition of done:

- repo-level validation stays green
- Sprint 1 core flow has automated coverage

## Explicit non-goals

Do not add these in this sprint:

- live OAuth connectors
- crawl jobs
- review editing from the web UI
- publishing to GitHub, CMS, or DyKnow Hub
- billing
- custom domains
- role matrix beyond what auth/org scoping minimally requires

## Verification checklist

- install dependencies
- run the hosted app locally
- seed the database
- sign in
- create org/workspace if not seeded
- verify sources render
- verify pages render
- verify latest run summary renders
- verify pending update summary renders
- verify recent activity renders
- run lint
- run tests
- run build

## Exit condition

Stop Sprint 1 when the control plane is clearly real and boring:

- authenticated
- persisted
- navigable
- seeded
- readable

If the product starts drifting toward connector automation or hosted publishing, cut scope and move it to Sprint 2.
