# Wiki Log

Append-only. Newest entries at the bottom. Format:

```
YYYY-MM-DD | <ingest|update|create|lint|delete> | <page or scope> | <one-line reason>
```

Do not edit past entries. If an entry is wrong, add a correction entry below it.

---

2026-05-23 | ingest | docs/sources/dyknow_local_whitepaper.md | Founding whitepaper added as raw source.
2026-05-23 | create | README.md | Initial repo overview and layout.
2026-05-23 | create | CLAUDE.md | Schema for LLM wiki maintainer (Karpathy-style).
2026-05-23 | create | AGENTS.md | Agent context file for coding assistants.
2026-05-23 | create | docs/index.md | Catalog of all wiki pages.
2026-05-23 | create | docs/log.md | This file.
2026-05-23 | create | docs/product-overview.md | Synthesized from whitepaper sections 1-3, 19.
2026-05-23 | create | docs/feature-map.md | Synthesized from whitepaper sections 4, 6, 7, 13.
2026-05-23 | create | docs/architecture.md | Synthesized from whitepaper sections 7, 8, 14.
2026-05-23 | create | docs/setup-guide.md | Synthesized from whitepaper section 8 (planned CLI workflow).
2026-05-23 | create | docs/trust-and-security.md | Synthesized from whitepaper sections 5, 11, 12.
2026-05-23 | create | docs/messaging.md | Synthesized from whitepaper sections 18, 19.
2026-05-23 | create | docs/roadmap.md | Synthesized from whitepaper sections 15, 21.
2026-05-23 | create | docs/glossary.md | Canonical terms drawn from whitepaper throughout.
2026-05-23 | create | docs/sources/README.md | Pointer index to raw source material.
2026-05-23 | update | docs/sources/dyknow_local_whitepaper.md | Moved whitepaper from repo root into docs/sources/. Updated all references in README, CLAUDE, AGENTS, log, and wiki frontmatter.
2026-05-23 | create | docs/lint.md | Runnable wiki health checklist (precursor to dyknow lint).
2026-05-23 | create | CONTRIBUTING.md | Contribution workflow for docs (and eventually code).
2026-05-23 | create | CHANGELOG.md | Human-facing release notes.
2026-05-23 | update | docs/index.md | Added lint, CONTRIBUTING, CHANGELOG to Wiki operations section.
2026-05-23 | create | docs/implementation-roadmap.md | Task-level checklist across Phases 0–5 (foundations, Local CLI, VS Code, demo, Cloud Lite, pilots).
2026-05-23 | update | docs/index.md | Linked Implementation Roadmap under Product.
2026-05-23 | create | linear | Created DyKnow project in Linear (Teambotics team) — https://linear.app/teambotics/project/dyknow-30e3394df921
2026-05-23 | create | notion | Created DyKnow Hub in Notion under PROJECTS INITIATED (SOFTWARE) — https://www.notion.so/369cddcb424a81b2beedd1d654388b89
2026-05-23 | create | linear | Added Phase 0–5 milestones to DyKnow Linear project.
2026-05-23 | update | docs/sources/README.md | Added External project hubs table (Linear + Notion URLs).
2026-05-23 | update | repo bootstrap | Added TypeScript workspace, shared contracts, config validation, tests, and CI scaffold.
2026-05-23 | update | AGENTS.md | Reflected current package layout, build commands, and coding conventions.
2026-05-23 | update | docs/implementation-roadmap.md | Marked completed Phase 0 scaffolding and config-validation tasks.
2026-05-23 | create | dyknow.config.schema.json | Generated the first DyKnow Local config schema from the implemented init slice.
2026-05-23 | create | dyknow.config.json | Generated the repo-local DyKnow configuration via dyknow init.
2026-05-23 | create | docs/dyknow/.state/repo-map.json | Generated the first repo map snapshot via dyknow scan.
2026-05-23 | update | README.md | Documented generated config/schema artifacts and the implemented init/scan commands.
2026-05-23 | update | AGENTS.md | Reflected generated config, repo-map snapshot, and current CLI command status.
2026-05-23 | update | CHANGELOG.md | Recorded init/scan implementation and generated repo artifacts.
2026-05-23 | update | docs/feature-map.md | Marked dyknow init and dyknow scan as implemented and documented current scanner behavior.
2026-05-23 | update | docs/setup-guide.md | Updated the workflow page to show init/scan as implemented and later steps as planned.
2026-05-23 | update | docs/implementation-roadmap.md | Marked JSON schema, scanner, dependency extraction, and repo-map snapshot tasks complete.
2026-05-23 | create | docs/dyknow/.state/repo-diff.json | Generated the first repo diff snapshot via dyknow diff.
2026-05-23 | update | README.md | Documented the implemented dyknow diff command and repo-diff artifact.
2026-05-23 | update | AGENTS.md | Reflected the repo-diff snapshot, diff schema, and current CLI command status.
2026-05-23 | update | CHANGELOG.md | Recorded dyknow diff implementation and generated repo-diff artifact.
2026-05-23 | update | docs/feature-map.md | Marked dyknow diff as implemented and documented current diff behavior.
2026-05-23 | update | docs/setup-guide.md | Updated the workflow page to show dyknow diff as implemented and describe its output.
2026-05-23 | update | docs/implementation-roadmap.md | Marked the dyknow diff task complete.
2026-05-23 | update | docs/dyknow/.state/repo-map.json | Refreshed the repo map snapshot after implementing dyknow diff.
2026-05-23 | update | docs/dyknow/.state/repo-diff.json | Regenerated the repo diff snapshot after refreshing the repo map snapshot.
2026-05-23 | update | README.md | Documented that dyknow diff now maps repo deltas to affected configured pages.
2026-05-23 | update | AGENTS.md | Reflected affected-page mapping in the current dyknow diff command and repo-diff behavior.
2026-05-23 | update | CHANGELOG.md | Recorded affected-page mapping in the dyknow diff implementation notes.
2026-05-23 | update | docs/feature-map.md | Documented that dyknow diff maps repo deltas to affected configured pages.
2026-05-23 | update | docs/setup-guide.md | Updated the diff workflow step to describe affected-page mapping via page source patterns.
2026-05-23 | update | docs/implementation-roadmap.md | Marked delta-to-page mapping complete for the current dyknow diff slice.
2026-05-23 | update | docs/dyknow/.state/repo-map.json | Refreshed the repo map snapshot after adding affected-page mapping.
2026-05-23 | update | docs/dyknow/.state/repo-diff.json | Regenerated the repo diff snapshot with affected configured pages.
2026-05-23 | update | repo bootstrap | Added default update prompt templates and a provider-backed local update runner foundation.
2026-05-23 | update | AGENTS.md | Reflected the new update templates and local-only update runner foundation.
2026-05-23 | update | CHANGELOG.md | Recorded the first dyknow update foundation modules and local stub provider behavior.
2026-05-23 | update | docs/implementation-roadmap.md | Marked prompt templates and the provider abstraction complete for the dyknow update foundation slice.
2026-05-23 | update | docs/dyknow/.state/repo-map.json | Refreshed the repo map snapshot after adding the dyknow update foundation modules.
2026-05-23 | update | docs/dyknow/.state/repo-diff.json | Regenerated the repo diff snapshot after adding the dyknow update foundation modules.
2026-05-23 | update | packages/cli/src/update.ts | Implemented the first dyknow update command to draft proposals from the repo diff into a structured state artifact.
2026-05-23 | update | docs/setup-guide.md | Marked dyknow update implemented for the local stub drafting path and documented the update-proposals artifact.
2026-05-23 | update | docs/feature-map.md | Marked dyknow update implemented and described the current local stub review requirement.
2026-05-23 | update | AGENTS.md | Updated agent context to include the dyknow update command and update-proposals artifact.
2026-05-23 | update | docs/dyknow/.state/update-proposals.json | Generated the first update-proposals artifact from the current repo diff using the local stub provider.
2026-05-23 | update | packages/cli/src/review.ts | Implemented the first dyknow review command slice to persist approval, rejection, and escalation decisions into the update-proposals artifact.
2026-05-23 | update | docs/setup-guide.md | Documented the first dyknow review decision flow and its current limits.
2026-05-23 | update | docs/feature-map.md | Marked dyknow review implemented for the first persisted decision slice.
2026-05-23 | update | AGENTS.md | Updated agent context to include the dyknow review command and persisted review-state behavior.
2026-05-23 | update | packages/cli/src/commit.ts | Implemented the first dyknow commit command slice to apply approved proposals and create one git commit.
2026-05-23 | update | docs/setup-guide.md | Documented the first dyknow commit workflow and its current worktree guard.
2026-05-23 | update | docs/feature-map.md | Marked dyknow commit implemented for the first apply-and-commit slice.
2026-05-23 | update | AGENTS.md | Updated agent context to include the dyknow commit command and published-state behavior.
2026-05-23 | update | docs/dyknow/.state/repo-map.json | Refreshed the repo map snapshot after implementing the dyknow commit slice.
2026-05-23 | update | docs/dyknow/.state/repo-diff.json | Regenerated the repo diff snapshot after implementing the dyknow commit slice.
2026-05-23 | update | docs/dyknow/.state/update-proposals.json | Regenerated the update-proposals artifact after implementing the dyknow commit slice.
2026-05-23 | update | packages/cli/src/pr.ts | Implemented the first dyknow pr command slice to branch, push, and open a GitHub pull request for approved proposals.
2026-05-23 | update | README.md | Documented the first dyknow pr workflow alongside the existing review and commit slices.
2026-05-23 | update | AGENTS.md | Updated agent context to include the dyknow pr command and its branch-and-PR behavior.
2026-05-23 | update | CHANGELOG.md | Marked dyknow pr implemented for the first review-branch and pull-request slice.
2026-05-23 | update | docs/setup-guide.md | Documented the first dyknow pr workflow, including its base-branch guard and GitHub PR output.
2026-05-23 | update | docs/feature-map.md | Marked dyknow pr implemented for the first branch-and-PR slice.
2026-05-23 | update | docs/implementation-roadmap.md | Checked off the dyknow pr and PR-body roadmap items after implementing the first GitHub-backed slice.
2026-05-23 | update | docs/dyknow/.state/repo-map.json | Refreshed the repo map snapshot after implementing the dyknow pr slice.
2026-05-23 | update | docs/dyknow/.state/repo-diff.json | Regenerated the repo diff snapshot after implementing the dyknow pr slice.
2026-05-23 | update | docs/dyknow/.state/update-proposals.json | Regenerated the update-proposals artifact after implementing the dyknow pr slice.
2026-05-23 | update | packages/cli/src/review.ts | Implemented the first dyknow review edit slice to replace one proposal text and mark it Edited inside the snapshot.
2026-05-23 | update | README.md | Documented the first dyknow review edit path alongside the existing decision workflow.
2026-05-23 | update | AGENTS.md | Updated agent context to include the dyknow review Edited-proposal behavior.
2026-05-23 | update | CHANGELOG.md | Marked dyknow review updated for the first persisted proposal-edit slice.
2026-05-23 | update | docs/setup-guide.md | Documented the first dyknow review edit command and clarified the remaining planned review actions.
2026-05-23 | update | docs/feature-map.md | Marked dyknow review implemented for the first persisted proposal-edit slice.
2026-05-23 | update | docs/implementation-roadmap.md | Checked off the first persisted proposal-edit slice in the review workflow backlog.
2026-05-23 | update | docs/dyknow/.state/repo-map.json | Refreshed the repo map snapshot after implementing the dyknow review edit slice.
2026-05-23 | update | docs/dyknow/.state/repo-diff.json | Regenerated the repo diff snapshot after implementing the dyknow review edit slice.
2026-05-23 | update | docs/dyknow/.state/update-proposals.json | Regenerated the update-proposals artifact after implementing the dyknow review edit slice.
