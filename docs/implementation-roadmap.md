---
title: Implementation Roadmap
purpose: Task-level checklist of everything to build, phased but undated, so contributors can pick work up at any time.
audience: internal
sources:
  - sources/dyknow_local_whitepaper.md (sections 7, 8, 14, 15, 21)
  - roadmap.md
  - architecture.md
  - feature-map.md
  - ../package.json
  - ../biome.json
  - ../packages/core/src/contracts.ts
  - ../packages/core/src/config.ts
  - ../.github/workflows/ci.yml
last_reviewed: 2026-05-23
confidence: medium
---

## Summary

This is the **build checklist**. Strategic phase context (goals, success criteria, risk framing) lives in [roadmap.md](roadmap.md); this page lists the actual tasks. Tasks are grouped by phase and by area within each phase. There are no dates — order within a phase is roughly suggested, but tasks within an area can usually proceed in parallel.

The current code scaffold lives in `packages/core` and `packages/cli`. Phase 0 now has a real TypeScript/npm workspace, CI validation, and the first shared-contract plus config-validation slice.

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

**Strategic goal:** dogfood inside Teambotics repos; maintain 5 pages reliably with human approval. See [roadmap.md § Phase 1](roadmap.md).

### Config system
- [ ] `dyknow.config.json` JSON Schema.
- [x] Config loader + validator with helpful errors.
- [ ] `dyknow init` command (interactive prompts, stack detection, sensible defaults).
- [x] Default ignore patterns enforced regardless of user config (`.env`, `secrets/**`, etc.).

### Scanner
- [ ] File reader honoring `allowedSources` / `ignoredSources`.
- [ ] Secret-pattern detection in scanned files (warn, never include).
- [ ] Basic AST/text parsers for: Markdown, JSON, YAML, OpenAPI, package files (package.json, pyproject.toml, etc.).
- [ ] Route/endpoint extraction for at least one stack (e.g., Next.js or Express).
- [ ] Dependency extraction.
- [ ] `dyknow scan` command — produces repo map.

### Snapshot & change detection
- [ ] Snapshot store layout under `docs/dyknow/.state/`.
- [ ] Write repo map snapshot.
- [ ] `dyknow diff` command — compute structured delta between snapshots.
- [ ] Map deltas → affected page IDs via source map.

### LLM runner
- [ ] LLM provider abstraction (interface for local model, BYO key, vendor).
- [ ] At least one provider implementation (BYO key recommended for MVP).
- [ ] Token/cost accounting per call.
- [ ] Retry + timeout policy.
- [ ] Local-only mode that hard-fails if a remote provider is selected.

### Drafting engine
- [ ] Prompt templates per page type (overview, feature map, architecture, setup, AGENTS.md).
- [ ] `dyknow update` command — drafts updates for each affected page.
- [ ] Per-update output: what changed, why, source files cited, exact proposed text, confidence, risk.
- [ ] High-risk flag enforcement (never auto-apply).

### Review flow
- [ ] `dyknow review` — CLI walk-through of pending updates (approve / reject / edit / regenerate / skip).
- [ ] Edit-in-editor for proposed text.
- [ ] Persist review decisions to snapshot.

### Commit / PR
- [ ] `dyknow commit` — apply approved updates and create a single commit.
- [ ] `dyknow pr` — create a branch + open a PR via `gh` / `glab`.
- [ ] PR body: summary table of pages updated, source evidence, risk levels.

### Audit
- [ ] Audit log writer (append-only).
- [ ] `dyknow log` — pretty-print recent audit entries.

### Initial maintained pages
- [ ] Product Overview generator.
- [ ] Feature Map generator.
- [ ] Architecture Summary generator.
- [ ] Setup Guide generator.
- [ ] AGENTS.md generator.

### Dogfood
- [ ] Run DyKnow Local on this docs repo and verify it can maintain its own pages.
- [ ] Run DyKnow Local on Teambotics, LTBBuddy, Code2Motion, EasyBuddy, StoryTellr, NikBot repos.
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
- [ ] Extension scaffold (TypeScript, VS Code API).
- [ ] Activation events: workspace contains `dyknow.config.json`.
- [ ] Bundled CLI binary or detected from PATH.
- [ ] Settings UI for config overrides.

### Sidebar views
- [ ] **DyKnow Map** — tree view of product areas, routes, features, APIs, docs, agent context files.
- [ ] **Changed Knowledge** — list of repo deltas since last scan.
- [ ] **Stale Pages** — pages with `last_reviewed` age or detected drift.
- [ ] **Suggested Updates** — per-page proposed diffs.
- [ ] **Source Evidence** — for the selected update, show cited source files/commits/issues.
- [ ] **Agent Context** — quick-edit view for AGENTS.md / CLAUDE.md / GEMINI.md / product-context.md / architecture.md / feature-map.md.

### Actions
- [ ] **Scan** button — runs `dyknow scan`.
- [ ] **Detect** button — runs `dyknow diff`.
- [ ] **Draft** button — runs `dyknow update`.
- [ ] Per-update inline: Approve / Reject / Edit / Regenerate / Mark source irrelevant.
- [ ] **Commit** and **Open PR** actions.
- [ ] Status bar item showing pending updates count.

### Polish
- [ ] Diff viewer reuse (native VS Code diff editor).
- [ ] Webview for source evidence panel.
- [ ] Telemetry opt-in (off by default).
- [ ] Marketplace publish.

### Quality bar
- [ ] A first-time user can install the extension and complete one full approval cycle without reading docs.

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
- [ ] Stand up Teambotics product pages on DyKnow Hub as the first customer.

### Quality bar
- [ ] One real (non-Teambotics) early-design partner could be onboarded end-to-end.

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
