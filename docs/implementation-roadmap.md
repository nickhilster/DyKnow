---
title: Implementation Roadmap
purpose: Task-level checklist of everything to build, phased but undated, so contributors can pick work up at any time.
audience: mixed
sources:
  - sources/dyknow_local_whitepaper.md (sections 7, 8, 14, 15, 21)
  - roadmap.md
  - architecture.md
  - feature-map.md
  - ../package.json
  - ../biome.json
  - ../dyknow.config.json
  - ../dyknow.config.schema.json
  - ../packages/core/src/contracts.ts
  - ../packages/core/src/config.ts
  - ../packages/core/src/repo-diff.ts
  - ../packages/core/src/repo-map.ts
  - ../packages/core/src/update-runner.ts
  - ../packages/core/src/update-templates.ts
  - ../packages/cli/src/audit.ts
  - ../packages/cli/src/commit.ts
  - ../packages/cli/src/diff.ts
  - ../packages/cli/src/index.ts
  - ../packages/cli/src/log.ts
  - ../packages/cli/src/pr.ts
  - ../packages/cli/src/review.ts
  - ../packages/cli/src/scan.ts
  - ../packages/cli/src/status.ts
  - ../packages/cli/src/update.ts
  - ../.github/workflows/ci.yml
  - dyknow/.state/repo-map.json
  - dyknow/.state/repo-diff.json
  - dyknow/.state/update-proposals.json
last_reviewed: 2026-06-26
confidence: medium
---

## Summary

This is the **build checklist**. Strategic phase context (goals, success criteria, risk framing) lives in [roadmap.md](roadmap.md); this page lists the actual tasks. Tasks are grouped by phase and by area within each phase. There are no dates — order within a phase is roughly suggested, but tasks within an area can usually proceed in parallel.

The current code scaffold lives in `packages/core`, `packages/app`, `packages/cli`, `packages/mcp-server`, and `packages/vscode-extension`. Phase 0 now has a real TypeScript/npm workspace, CI validation, shared-contract plus config-validation slices, a shared Local application layer, working CLI and MCP publication flows, and focused VS Code command-wiring verification.

When a task is completed, tick the box and append an `update` entry to [log.md](log.md) referencing this page.

---

## Phase 0 — Foundations (cross-cutting)

These items underpin every later phase. Land them once; reuse everywhere.

### Shared engine contracts
- [x] Define **page definition** schema (id, title, output path, audience, sources, review rules).
- [x] Define **source map** data structure (source → pages it informs, with weight/relevance).
- [x] Define **update proposal** schema (what changed, why, sources, exact text, confidence, risk, review state).
- [x] Define **review workflow** state machine (Drafted → Needs review → Approved | Rejected | Edited → Published → Archived | Escalated).
- [x] Define **audit log** entry format (action, actor, sources read, output affected, timestamp, hash).
- [ ] Define **confidence scoring** rubric (inputs: source recency, source authority, overlap, LLM self-report).
- [ ] Define **risk classifier** rules (pricing, legal, security, compliance, customer commitments → high risk).

### Repo & tooling
- [x] Choose primary implementation language and runtime for the shared engine.
- [x] Initialize a real source repository (separate from this docs-only repo, or as a sibling package).
- [x] Set up package manager, linter, formatter, test runner.
- [x] CI pipeline: lint + tests on PR.
- [ ] Conventional commit format or equivalent.

### Output templates
- [ ] Markdown page template (with DyKnow frontmatter).
- [ ] AGENTS.md template.
- [ ] CLAUDE.md template.
- [ ] JSON knowledge map template.
- [ ] RAG-ready source pack template.

---

## Phase 1 — DyKnow Local CLI (MVP 1)

**Strategic goal:** dogfood inside maintainer-owned repos; maintain 5 pages reliably with human approval. See [roadmap.md § Phase 1](roadmap.md).

### Config system
- [x] `dyknow.config.json` JSON Schema.
- [x] Config loader + validator with helpful errors.
- [x] `dyknow init` command (interactive prompts, stack detection, sensible defaults).
- [x] Default ignore patterns enforced regardless of user config (`.env`, `secrets/**`, etc.).

### Scanner
- [x] File reader honoring `allowedSources` / `ignoredSources`.
- [x] Secret-pattern detection in scanned files (warn, never include).
- [x] Broaden AST/text parsers for Markdown, JSON, YAML, and OpenAPI beyond the current package-manifest slice (`package.json`, `pyproject.toml`, `requirements*.txt`).
- [x] Route/endpoint extraction for at least one stack (e.g., Next.js or Express).
- [x] Dependency extraction.
- [x] `dyknow scan` command — produces repo map.

### Snapshot & change detection
- [x] Snapshot store layout under `docs/dyknow/.state/`.
- [x] Write repo map snapshot.
- [x] `dyknow diff` command — compute structured delta between snapshots.
- [x] Map deltas → affected page IDs via source map.

### LLM runner
- [x] LLM provider abstraction (interface for local model, BYO key, vendor).
- [x] At least one provider implementation (BYO key recommended for MVP).
- [x] Token/cost accounting per call.
- [x] Retry + timeout policy.
- [x] Local-only mode that hard-fails if a remote provider is selected.

### Drafting engine
- [x] Prompt templates per page type (overview, feature map, architecture, setup, AGENTS.md).
- [x] `dyknow update` command — drafts updates for each affected page.
- [x] Per-update output: what changed, why, source files cited, exact proposed text, confidence, risk.
- [x] High-risk flag enforcement (never auto-apply).

### Review flow
- [x] `dyknow review` — CLI walk-through of pending updates (approve / reject / edit / regenerate / skip).
- [x] Edit-in-editor for proposed text.
- [x] Persist review decisions to snapshot.
- [x] Persist one edited proposal text back into the review snapshot.
- [x] Handle explicit skip actions without mutating the review snapshot.
- [x] Regenerate targeted proposals from the saved repo diff.

### Commit / PR
- [x] `dyknow commit` — apply approved updates and create a single commit.
- [x] `dyknow pr` — create a branch + open a PR via `gh` / `glab`.
- [x] PR body: summary table of pages updated, source evidence, risk levels.

### Audit
- [x] Audit log writer (append-only).
- [x] Append review-action audit entries to an append-only log artifact.
- [x] Append publish-action audit entries for `dyknow commit` and `dyknow pr` to the same log artifact.
- [x] `dyknow log` — pretty-print recent audit entries.
- [x] Expose the audit/log workflow through the MCP surface with committed/runtime filtering.

### Initial maintained pages
- [x] Product Overview generator.
- [x] Feature Map generator.
- [x] Architecture Summary generator.
- [x] Setup Guide generator.
- [x] AGENTS.md generator.

### Dogfood
- [x] Run DyKnow Local on this docs repo and verify it can maintain its own pages.
- [ ] Run DyKnow Local on additional maintainer-owned repos and at least one public demo repo.
- [ ] Collect findings, file issues, iterate.

### Quality bar before exiting Phase 1
- [ ] Detects real changes (>90% precision on a labeled test set).
- [ ] Never overwrites without proposing a diff.
- [ ] Never publishes high-risk content without explicit approval.
- [ ] Survives a `scan → diff → update → review → commit` cycle on each dogfood repo without manual fixup.

---

## Phase 2 — VS Code extension (MVP 2)

**Strategic goal:** make the workflow understandable; visual approval over raw CLI. See [roadmap.md § Phase 2](roadmap.md).

### Scaffolding
- [x] Extension scaffold (TypeScript, VS Code API).
- [x] Activation events: workspace contains `dyknow.config.json`.
- [x] Bundled CLI binary or detected from PATH.
- [x] Settings UI for config overrides.

### Sidebar views
- [x] **DyKnow Map** — tree view of product areas, routes, features, APIs, docs, agent context files.
- [x] **Changed Knowledge** — list of repo deltas since last scan.
- [x] **Stale Pages** — pages with `last_reviewed` age or detected drift.
- [x] **Suggested Updates** — per-page proposed diffs.
- [x] **Source Evidence** — for the selected update, show cited source files/commits/issues.
- [x] **Agent Context** — quick-edit view for AGENTS.md / CLAUDE.md / GEMINI.md / product-context.md / architecture.md / feature-map.md.

### Actions
- [x] **Scan** button — runs `dyknow scan`.
- [x] **Detect** button — runs `dyknow diff`.
- [x] **Draft** button — runs `dyknow update`.
- [x] Per-update inline: Approve / Reject / Edit / Regenerate / Mark source irrelevant.
- [x] **Commit** and **Open PR** actions.
- [x] Status bar item showing pending updates count.

### Polish
- [x] Diff viewer reuse (native VS Code diff editor).
- [x] Webview for source evidence panel.
- [x] Telemetry opt-in (off by default).
- [x] Marketplace publish.

### Quality bar
- [x] A first-time user can install the extension and complete one full approval cycle without reading docs.
  - Acceptance artifacts are generated at `docs/dyknow/.state/phase2-acceptance-report.json` and `docs/dyknow/.state/phase2-acceptance-report.md`.
  - Manual walkthrough evidence is recorded at `docs/dyknow/.state/phase2-manual-walkthrough.md` (VSIX install plus scan/diff/update/review workflow execution).
- [x] Focused automated verification exists for extension command and publish-flow argument wiring.

---

## Phase 3 — Public demo

**Strategic goal:** produce the pitch asset. See [roadmap.md § Phase 3](roadmap.md).

### Demo repo
- [ ] Build (or fork) a small, recognizable demo product repo.
- [ ] Author intentionally stale docs as the starting state.
- [ ] Stage a sequence of meaningful repo changes (feature added, route renamed, dependency bumped).
- [ ] Capture the `before` state in a tagged commit.

### Recorded walkthrough
- [ ] Script the demo flow: stale → changes → `dyknow scan` → suggested updates → human approval → updated docs → updated AGENTS.md.
- [ ] Record screencast (CLI version).
- [ ] Record screencast (VS Code version).
- [ ] Edit + caption.

### Assets
- [ ] Landing page or microsite.
- [ ] Pitch deck.
- [ ] One-page PDF brief.
- [ ] README polish on the demo repo so visitors can run it themselves.
- [ ] Link checklist in [messaging.md](messaging.md).

---

## Phase 4 — DyKnow Cloud Lite

**Strategic goal:** stand up the hosted product with a minimal connector set and the DyKnow Hub. See [roadmap.md § Phase 4](roadmap.md).

### Current Sprint 1 slice

This phase is now starting with a narrower hosted **control plane** slice before broader connector and publishing work. See [Cloud Sprint 1 Control Plane](cloud-sprint-1-control-plane.md) and the worker-facing [DyKnow Cloud Sprint 1 Plan](superpowers/plans/2026-06-29-dyknow-cloud-sprint-1.md).

- [ ] Add the first hosted package/app scaffold for DyKnow Cloud.
- [ ] Define hosted contracts for orgs, workspaces, sources, pages, runs, update batches, and workspace events.
- [ ] Add persistence for the Sprint 1 control-plane entities.
- [ ] Add auth and org membership guards.
- [ ] Add workspace creation and navigation.
- [ ] Add manual source registration records.
- [ ] Add page-definition registration records.
- [ ] Add latest-run and pending-update summary read models.
- [ ] Add append-only workspace events.
- [ ] Add the read-only workspace dashboard.
- [ ] Add first-party seed data for DyKnow dogfood.
- [ ] Add automated validation for the hosted control-plane flow.

### Backend foundation
- [ ] Choose hosting (managed vs. self-built).
- [ ] Auth + organization model.
- [ ] Role-based access (admin, editor, reviewer, viewer).
- [ ] Persistent storage for sources, snapshots, pages, audit log.
- [ ] Background job runner for scheduled monitoring.
- [ ] Reuse shared engine from Phase 0.

### Connector framework
- [ ] Connector interface (auth, list, fetch, change-poll, normalize).
- [ ] OAuth/scope manager.
- [ ] Connector test harness.

### Initial connectors
- [ ] Public website crawler.
- [ ] Sitemap monitor.
- [ ] Manual file upload.
- [ ] One docs connector: Notion **or** Google Docs (pick one for Lite).

### Monitoring & drafting
- [ ] Per-org page definitions with source bindings.
- [ ] Cadence-based change polling.
- [ ] Drafting agent (calls shared engine).
- [ ] Review queue UI (web).
- [ ] Approval workflow with role enforcement.

### DyKnow Hub
- [ ] Public-facing renderer for approved pages.
- [ ] Per-org subdomain or custom domain support.
- [ ] Page-level public/private toggle.
- [ ] Embeddable widget.

### Publishing layer
- [ ] Push to CMS (one target for Lite, e.g., Webflow or generic webhook).
- [ ] Push back to source docs system (Notion or Google Docs).
- [ ] Optional sync from Local (`dyknow sync`).

### Audit & governance
- [ ] Audit log UI.
- [ ] Export controls.
- [ ] Data retention policy + tooling.

### Billing & ops
- [ ] Pricing tiers wired (Starter / Growth — Enterprise is custom).
- [ ] Subscription + setup-fee billing.
- [ ] Usage metering (pages, sources, draft calls).
- [ ] Status page + on-call rotation basics.

### Dogfood
- [ ] Stand up first-party product pages on DyKnow Hub as the first showcase.

### Quality bar
- [ ] One real early-design partner could be onboarded end-to-end.

---

## Phase 5 — Commercial pilots

**Strategic goal:** move from prototype to paid pilots with small SaaS teams, agencies, AI-native startups, and dev-tool companies. See [roadmap.md § Phase 5](roadmap.md).

### Pilot offer
- [ ] Pilot offer template (5–10 Dynamic Knowledge Pages + drift assessment).
- [ ] Drift-assessment tool — free starter that scans a prospect's public site/docs/support and reports gaps.
- [ ] Pilot pricing (one-time setup + capped monthly).

### Onboarding playbook
- [ ] Discovery script (what pages, what sources, what review rules).
- [ ] Source connection checklist.
- [ ] First-week milestones.
- [ ] Pilot success metrics (pages live, updates approved, drift reduction, time-to-publish).

### Sales collateral
- [ ] Audience-specific one-pagers (SaaS, agency, AI-native, dev tool).
- [ ] Case study template.
- [ ] Reference architecture diagram.
- [ ] Pricing page.

### Customer success
- [ ] Pilot kickoff template.
- [ ] Weekly check-in template.
- [ ] End-of-pilot review template (convert / extend / close).
- [ ] Support inbox + SLA.

### Quality bar before exiting Phase 5
- [ ] At least 3 paying pilots converted to ongoing subscriptions.
- [ ] At least 1 reference customer willing to be quoted publicly.

---

## Cross-references

- [Roadmap](roadmap.md) — strategic phase framing.
- [Architecture](architecture.md) — components each task fits into.
- [Feature Map](feature-map.md) — external behavior these tasks deliver.
- [Trust and Security](trust-and-security.md) — non-negotiable controls every phase must respect.
- [Lint Checklist](lint.md) — run before any phase-exit milestone.

## Open questions

- Should the shared engine live in this repo, a sibling, or a separate organization-owned repo?
- First docs connector for Cloud Lite: Notion or Google Docs?
- Default stack for route/endpoint extraction in Phase 1 (Next.js, Express, FastAPI?).
- Pricing for the free drift-assessment tool — fully gated or anonymous?
