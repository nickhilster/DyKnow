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
2026-05-23 | update | packages/cli/src/review.ts | Implemented the first dyknow review skip slice to explicitly skip targeted proposals without mutating the snapshot.
2026-05-23 | update | README.md | Documented the first dyknow review skip path alongside the existing decision and edit workflow.
2026-05-23 | update | AGENTS.md | Updated agent context to include explicit dyknow review skip handling.
2026-05-23 | update | CHANGELOG.md | Marked dyknow review updated for the first persisted skip slice.
2026-05-23 | update | docs/setup-guide.md | Documented the first dyknow review skip command and clarified the remaining planned review actions.
2026-05-23 | update | docs/feature-map.md | Marked dyknow review implemented for the first explicit skip slice.
2026-05-23 | update | docs/implementation-roadmap.md | Checked off explicit skip handling in the review workflow backlog.
2026-05-23 | update | docs/dyknow/.state/repo-map.json | Refreshed the repo map snapshot after implementing the dyknow review skip slice.
2026-05-23 | update | docs/dyknow/.state/repo-diff.json | Regenerated the repo diff snapshot after implementing the dyknow review skip slice.
2026-05-23 | update | docs/dyknow/.state/update-proposals.json | Regenerated the update-proposals artifact after implementing the dyknow review skip slice.
2026-05-23 | update | packages/cli/src/review.ts | Implemented the first dyknow review regenerate slice to re-draft targeted proposals from the saved repo diff.
2026-05-23 | update | packages/cli/src/log.ts | Implemented the first dyknow log slice to pretty-print recent review audit entries from the append-only JSONL artifact.
2026-05-23 | update | README.md | Documented the implemented dyknow log command and its read-only audit-viewer behavior.
2026-05-23 | update | AGENTS.md | Updated agent context to include the dyknow log command and audit-log reader behavior.
2026-05-23 | update | CHANGELOG.md | Recorded the first dyknow log read-only audit-viewer slice.
2026-05-23 | update | docs/setup-guide.md | Added the implemented dyknow log step and clarified the current audit-viewer workflow.
2026-05-23 | update | docs/feature-map.md | Marked dyknow log implemented and documented its current read-only audit behavior.
2026-05-23 | update | docs/implementation-roadmap.md | Marked the audit log writer and dyknow log reader tasks complete.
2026-05-23 | update | README.md | Documented the first dyknow review regenerate path alongside the existing decision, edit, and skip workflow.
2026-05-23 | update | AGENTS.md | Updated agent context to include targeted dyknow review regenerate handling.
2026-05-23 | update | CHANGELOG.md | Marked dyknow review updated for the first targeted regenerate slice.
2026-05-23 | update | docs/setup-guide.md | Documented the first dyknow review regenerate command and clarified the remaining planned review actions.
2026-05-23 | update | docs/feature-map.md | Marked dyknow review implemented for the first targeted regenerate slice.
2026-05-23 | update | docs/implementation-roadmap.md | Checked off targeted regenerate handling in the review workflow backlog.
2026-05-23 | update | docs/dyknow/.state/repo-map.json | Refreshed the repo map snapshot after implementing the dyknow review regenerate slice.
2026-05-23 | update | docs/dyknow/.state/repo-diff.json | Regenerated the repo diff snapshot after implementing the dyknow review regenerate slice.
2026-05-23 | update | docs/dyknow/.state/update-proposals.json | Regenerated the update-proposals artifact after implementing the dyknow review regenerate slice.
2026-05-23 | update | packages/cli/src/review.ts | Implemented the first dyknow review external-editor slice to edit one targeted proposal through DYKNOW_EDITOR_COMMAND or EDITOR.
2026-05-23 | update | README.md | Documented the first dyknow review external-editor path alongside the existing text edit, skip, and regenerate workflow.
2026-05-23 | update | AGENTS.md | Updated agent context to include the external-editor review edit path.
2026-05-23 | update | CHANGELOG.md | Marked dyknow review updated for the first external-editor edit slice.
2026-05-23 | update | docs/setup-guide.md | Documented the first dyknow review external-editor command and clarified the remaining planned review surfaces.
2026-05-23 | update | docs/feature-map.md | Marked dyknow review implemented for the first external-editor edit slice.
2026-05-23 | update | docs/implementation-roadmap.md | Checked off edit-in-editor for proposed text in the review workflow backlog.
2026-05-23 | update | docs/dyknow/.state/repo-map.json | Refreshed the repo map snapshot after implementing the dyknow review external-editor slice.
2026-05-23 | update | docs/dyknow/.state/repo-diff.json | Regenerated the repo diff snapshot after implementing the dyknow review external-editor slice.
2026-05-23 | update | docs/dyknow/.state/update-proposals.json | Regenerated the update-proposals artifact after implementing the dyknow review external-editor slice.
2026-05-23 | update | packages/cli/src/review.ts | Implemented the first review-action audit-log writer to append one entry per targeted review action.
2026-05-23 | update | README.md | Documented the first review-action audit-log artifact alongside the existing review workflow.
2026-05-23 | update | AGENTS.md | Updated agent context to include review-action audit logging.
2026-05-23 | update | CHANGELOG.md | Marked dyknow review updated for the first review-action audit-log slice.
2026-05-23 | update | docs/setup-guide.md | Documented the first review-action audit-log behavior and clarified the remaining audit work.
2026-05-23 | update | docs/feature-map.md | Marked dyknow review implemented for the first review-action audit-log slice.
2026-05-23 | update | docs/implementation-roadmap.md | Checked off review-action audit entry appends in the audit backlog.
2026-05-23 | update | docs/dyknow/.state/repo-map.json | Refreshed the repo map snapshot after implementing the review-action audit-log slice.
2026-05-23 | update | docs/dyknow/.state/repo-diff.json | Regenerated the repo diff snapshot after implementing the review-action audit-log slice.
2026-05-23 | update | docs/dyknow/.state/update-proposals.json | Regenerated the update-proposals artifact after implementing the review-action audit-log slice.
2026-05-23 | update | packages/cli/src/audit.ts | Added a shared append-only audit helper for publish and review flows.
2026-05-23 | update | packages/cli/src/commit.ts | Appended publish audit entries during dyknow commit so published outputs and snapshot changes are recorded in the committed audit trail.
2026-05-23 | update | packages/cli/src/pr.ts | Added dyknow pr publish audit coverage in the same committed audit flow used for approved proposal publication.
2026-05-23 | update | README.md | Documented publish-action audit coverage for dyknow commit, dyknow pr, and the dyknow log viewer.
2026-05-23 | update | AGENTS.md | Updated agent context to include shared publish audit helpers and commit/pr audit behavior.
2026-05-23 | update | CHANGELOG.md | Recorded the first publish-action audit coverage for dyknow commit and dyknow pr.
2026-05-23 | update | docs/setup-guide.md | Documented that review, commit, and pr now append to the same local audit trail.
2026-05-23 | update | docs/feature-map.md | Expanded the audit command descriptions to cover publish audit entries.
2026-05-23 | update | docs/implementation-roadmap.md | Checked off publish-action audit entries in the audit backlog.
2026-05-23 | update | packages/cli/src/pr.ts | Renamed the committed PR audit action to publish:pr-prepared so it reflects local prepared state before external PR creation.
2026-05-23 | update | README.md | Clarified that dyknow pr currently records a prepared local PR publish state, not a confirmed external PR-open audit event.
2026-05-23 | update | AGENTS.md | Updated agent context to distinguish prepared PR publish audit state from future confirmed external publication events.
2026-05-23 | update | CHANGELOG.md | Recorded the narrower publish:pr-prepared audit semantics for dyknow pr.
2026-05-23 | update | docs/setup-guide.md | Clarified that the current PR audit trail records prepared local state before external PR creation.
2026-05-23 | update | docs/feature-map.md | Updated the dyknow pr command description to reflect publish:pr-prepared audit semantics.
2026-05-23 | update | packages/cli/src/pr.ts | Added a confirmed publish:pr-opened runtime audit event after successful external PR creation.
2026-05-23 | update | packages/cli/src/log.ts | Expanded dyknow log to merge the committed audit artifact with the git-local runtime audit file.
2026-05-23 | update | README.md | Documented the git-local runtime audit file used for confirmed external PR-open events.
2026-05-23 | update | AGENTS.md | Updated agent context to describe the split between committed and runtime PR audit events.
2026-05-23 | update | CHANGELOG.md | Recorded confirmed external PR-open runtime audit coverage and merged log viewing.
2026-05-23 | update | docs/setup-guide.md | Clarified that confirmed external PR-open events now land in the git-local runtime audit file.
2026-05-23 | update | docs/feature-map.md | Updated the dyknow log and dyknow pr descriptions for confirmed external PR-open runtime events.
2026-05-24 | update | packages/cli/src/status.ts | Added dyknow status to generate an HTML repository status report from git metadata and DyKnow state artifacts.
2026-05-24 | update | packages/core/src/update-runner.ts | Added local stub confidence and risk heuristics so drafted proposals carry more useful review metadata.
2026-05-24 | update | packages/cli/src/commit.ts | Added an explicit --allow-high-risk publish guard for approved high-risk proposals.
2026-05-24 | update | packages/cli/src/pr.ts | Added the same explicit high-risk publish guard to the PR publication path.
2026-05-24 | update | docs/implementation-roadmap.md | Marked local-only provider enforcement and high-risk publish enforcement complete for the current Phase 1 slice.
2026-05-24 | update | docs/setup-guide.md | Documented dyknow status and the explicit high-risk publish override on commit and PR flows.
2026-05-24 | update | docs/feature-map.md | Added the dyknow status command and clarified the high-risk publish guard on commit and PR commands.
2026-05-24 | update | AGENTS.md | Refreshed agent context for dyknow status, local stub risk heuristics, and explicit high-risk publish overrides.
2026-05-24 | update | docs/dyknow/.state/repo-map.json | Refreshed the repo map snapshot while dogfooding the current DyKnow Local flow on this repo.
2026-05-24 | update | docs/dyknow/.state/repo-diff.json | Regenerated the repo diff snapshot while dogfooding the current DyKnow Local flow on this repo.
2026-05-24 | update | docs/dyknow/.state/update-proposals.json | Regenerated update proposals while dogfooding the current DyKnow Local flow on this repo after the status and publish-safety slices.
2026-05-24 | update | packages/cli/src/update.ts | Added a BYO OpenAI-backed update provider path for connected-mode drafting.
2026-05-24 | update | packages/cli/src/review.ts | Added an interactive review walkthrough on top of the existing review mutation and audit flow.
2026-05-24 | update | packages/core/src/update-runner.ts | Added page-specific built-in local draft generators for the default maintained pages.
2026-05-24 | update | docs/implementation-roadmap.md | Marked the BYO provider, interactive review walkthrough, and initial built-in page generators complete for the current Phase 1 slice.
2026-05-25 | create | docs/phase3-demo-repo-selection.md | Recorded the selected dedicated Next.js sandbox direction for the first public demo repo.
2026-05-25 | update | docs/handoff-phase3-demo.md | Resolved the repo-type decision toward a dedicated public sandbox and linked the selection page.
2026-05-25 | update | docs/phase3-demo-checklist.md | Added the selected demo-repo direction and linked the detailed repo-selection page.
2026-05-25 | update | docs/index.md | Added the Phase 3 demo repo selection page to the handoff catalog.
2026-05-25 | update | docs/phase3-demo-repo-selection.md | Locked the first demo repo to nickhilster/dyknow-demo-app with baseline tag and stale starting files.
2026-05-25 | update | docs/handoff-phase3-demo.md | Added the concrete Phase 3 demo repo target, baseline tag, and next execution details.
2026-05-25 | update | docs/phase3-demo-checklist.md | Replaced the remaining repo-selection placeholder with the concrete demo repo target and stale baseline files.
2026-05-25 | create | docs/phase3-demo-baseline-plan.md | Added the proposed bootstrap commands, starter files, and baseline verification steps for dyknow-demo-app.
2026-05-25 | update | docs/handoff-phase3-demo.md | Linked the new baseline plan page from the Phase 3 handoff.
2026-05-25 | update | docs/phase3-demo-checklist.md | Linked the baseline plan so the repo bootstrap path is explicit.
2026-05-25 | update | docs/index.md | Added the Phase 3 demo baseline plan page to the handoff catalog.
2026-05-25 | create | docs/phase3-demo-change-script.md | Added the proposed staged source changes and stale-file targets for the first public demo walkthrough.
2026-05-25 | update | docs/handoff-phase3-demo.md | Linked the Phase 3 change script from the execution details.
2026-05-25 | update | docs/phase3-demo-checklist.md | Linked the staged change script so the next demo-prep slice is explicit.
2026-05-25 | update | docs/index.md | Added the Phase 3 demo change script page to the handoff catalog.
2026-05-25 | create | docs/phase3-demo-recording-runbook.md | Added the exact CLI recording order, review pattern, and artifact checklist for the first public demo pass.
2026-05-25 | update | docs/handoff-phase3-demo.md | Linked the recording runbook from the Phase 3 handoff artifact list.
2026-05-25 | update | docs/phase3-demo-checklist.md | Linked the recording runbook so the planned command order is explicit.
2026-05-25 | update | docs/index.md | Added the Phase 3 demo recording runbook page to the handoff catalog.
2026-05-25 | create | docs/handoff-phase3-codex.md | Added a focused takeover handoff for the next Codex operator continuing Phase 3 execution.
2026-05-25 | update | docs/index.md | Added the Phase 3 Codex takeover handoff page to the handoff catalog.
2026-05-23 | update | packages/cli/src/log.ts | Added per-entry source log labels so merged committed and runtime audit output stays traceable.
2026-05-23 | update | README.md | Documented that dyknow log now labels each rendered entry with its source audit file.
2026-05-23 | update | AGENTS.md | Updated agent context to note per-entry source labels in dyknow log output.
2026-05-23 | update | CHANGELOG.md | Recorded per-entry source labels for the merged dyknow log audit view.
2026-05-23 | update | docs/setup-guide.md | Clarified that dyknow log now shows which audit file each rendered entry came from.
2026-05-23 | update | docs/feature-map.md | Updated the dyknow log command description to include per-entry source labels.
2026-05-23 | update | packages/cli/src/log.ts | Added an all|committed|runtime filter so dyknow log can isolate merged audit sources.
2026-05-23 | update | README.md | Documented the new dyknow log source filter options.
2026-05-23 | update | AGENTS.md | Updated agent context to include dyknow log source filtering.
2026-05-23 | update | CHANGELOG.md | Recorded dyknow log source filtering for committed and runtime audit entries.
2026-05-23 | update | docs/setup-guide.md | Documented the new dyknow log --source option and current filter values.
2026-05-23 | update | docs/feature-map.md | Updated the dyknow log command description to include source filtering.
2026-05-23 | update | packages/cli/src/log.ts | Added an all|review|publish action-family filter so dyknow log can isolate review and publish entries.
2026-05-23 | update | README.md | Documented the new dyknow log --action filter options.
2026-05-23 | update | AGENTS.md | Updated agent context to include dyknow log action-family filtering.
2026-05-23 | update | CHANGELOG.md | Recorded dyknow log action-family filtering for review and publish entries.
2026-05-23 | update | docs/setup-guide.md | Documented the new dyknow log --action option and current filter values.
2026-05-23 | update | docs/feature-map.md | Updated the dyknow log command description to include action-family filtering.
2026-05-24 | update | packages/cli/src/index.ts | Added an interactive dyknow init flow with stack-aware defaults for generic, Next.js, Express-style Node, and Python repos.
2026-05-24 | update | packages/cli/src/scan.ts | Expanded the repo scanner to extract Python dependency manifests and lightweight Next.js and Express route metadata.
2026-05-24 | update | packages/core/src/repo-map.ts | Extended the repo-map schema with route metadata so scan output and diffs can carry concrete route information.
2026-05-24 | update | README.md | Documented interactive init, stack-aware source defaults, and richer scan extraction coverage.
2026-05-24 | update | docs/setup-guide.md | Updated init and scan workflow steps for interactive init, stack detection, package-manifest parsing, and route extraction.
2026-05-24 | update | docs/feature-map.md | Refreshed the dyknow init and dyknow scan command entries to reflect interactive setup and richer repo intelligence.
2026-05-24 | update | docs/implementation-roadmap.md | Marked interactive init and route extraction complete while narrowing the remaining parser backlog to deeper Markdown/JSON/YAML/OpenAPI coverage.
2026-05-24 | update | AGENTS.md | Updated agent context for interactive init defaults and richer scan metadata.
2026-05-24 | update | packages/core/src/update-runner.ts | Added BYO provider retry/timeout handling plus token and known-model cost telemetry for drafted updates.
2026-05-24 | update | packages/core/src/repo-map.ts | Expanded repo-map summaries with headings and top-level key metadata for richer scanner output.
2026-05-24 | update | packages/cli/src/scan.ts | Added Markdown heading extraction, top-level JSON/YAML/TOML key extraction, and OpenAPI route parsing.
2026-05-24 | update | packages/cli/src/commit.ts | Fixed the git-status parser so normal DyKnow state artifacts no longer block a clean commit flow.
2026-05-24 | update | docs/implementation-roadmap.md | Marked parser coverage, runner accounting, retry policy, and this-repo dogfooding complete for the current Phase 1 slice.
2026-05-24 | update | README.md | Documented richer scanner metadata plus BYO usage and retry telemetry in update artifacts.
2026-05-24 | update | docs/setup-guide.md | Updated scan and update docs for OpenAPI parsing, structural metadata extraction, and provider telemetry.
2026-05-24 | update | docs/feature-map.md | Reflected richer scan parsing and update-provider telemetry in the command inventory.
2026-05-24 | update | AGENTS.md | Refreshed agent context for OpenAPI parsing and BYO provider telemetry.
2026-05-24 | update | packages/core/src/contracts.ts | Added formal RiskClassifierRule schema, RISK_CLASSIFIER_RULES constant (6 categories: pricing, legal, compliance, security, customer-commitment, pii), CONFIDENCE_SCORING_RUBRIC constant, and RiskClassifierRule type export.
2026-05-24 | update | packages/core/src/update-runner.ts | Replaced inline HIGH_RISK_KEYWORDS heuristic with rubric-driven classifyDraftRisk and scoreDraftConfidence functions (now exported); both are driven by RISK_CLASSIFIER_RULES and CONFIDENCE_SCORING_RUBRIC from contracts.ts.
2026-05-24 | update | packages/cli/src/review.ts | Surfaced risk badge ([HIGH RISK] / [medium risk]), confidence level, why, and sources in the interactive review walkthrough display; added ⚠ warning for high-risk proposals.
2026-05-24 | update | packages/core/test/contracts.test.ts | Added ruleset coverage tests: all 6 expected categories present, all rules have valid risk levels and non-empty keywords; rubric ordering and descriptions tested.
2026-05-24 | update | packages/core/test/update-runner.test.ts | Added classifyDraftRisk and scoreDraftConfidence unit test suites (10 new cases); added low-risk/low-confidence baseline test; fixed stale medium-risk expectation now that benign source paths don't trigger a rule.
2026-05-24 | create | packages/core/src/output-templates.ts | Added 5 output templates (markdown-page, agents-md, claude-md, json-knowledge-map, rag-source-pack) with PageScaffoldOptions schema, OUTPUT_TEMPLATE_REGISTRY, scaffoldPage, getOutputTemplate, listOutputTemplates exports.
2026-05-24 | update | packages/core/src/index.ts | Exported output-templates module alongside existing core exports.
2026-05-24 | create | packages/core/test/output-templates.test.ts | 45 tests covering registry invariants, per-template structure (frontmatter, sections, JSONL validity, JSON validity), cross-template validation, and dyknow:fill placeholder presence.
2026-05-24 | create | commitlint.config.js | Added conventional commit config extending @commitlint/config-conventional; added wiki, scan, infra custom types; header-max-length set to 120.
2026-05-24 | update | .github/workflows/ci.yml | Added commit-lint job (PR-only) that runs commitlint from PR base to head SHA with full fetch-depth.
2026-05-24 | update | CONTRIBUTING.md | Added commit message format section (type table, examples, breaking changes, local check command); updated stale "When code lands" section to reflect Phase 1 code reality.
2026-05-24 | update | notion | Updated DyKnow Hub page to reflect current repo progress — Phase 0 ~80%, Phase 1 ~85%, all 9 CLI commands implemented and dogfooded on this repo.
2026-05-24 | update | linear | Populated DyKnow Linear project with 20 issues across Phase 0 and Phase 1 milestones (10 Done, 7 Todo); updated project status to In Progress; Phase 1 milestone now shows 77% progress.
2026-05-24 | update | packages/cli/src/commit.ts | Fixed worktree guard: added DEFAULT_REPO_MAP_OUTPUT_PATH to allowed paths set so repo-map.json does not block dyknow commit when it exists as an untracked state file.
2026-05-24 | update | dogfood/ltb-buddy | Completed full Phase 1 dogfood cycle: scan → change → diff (1 file) → update (5 proposals) → review (4 approved, 1 skipped high-risk) → commit (671a535). First successful end-to-end cycle.
2026-05-24 | update | dogfood/Code2Motion | Completed full Phase 1 dogfood cycle: scan → change → diff (1 file) → update (5 proposals, all low risk) → review (5 approved) → commit (bd4bb2d).
2026-05-24 | update | dogfood/teambotics-website | Completed full Phase 1 dogfood cycle: scan → change → diff (1 file) → update (5 proposals, all low risk) → review (5 approved) → commit (ca3581a).
2026-05-24 | update | dogfood/StoryTeller | Completed full Phase 1 dogfood cycle: scan → change → diff (1 file) → update (5 proposals, all low risk) → review (5 approved) → commit (6830f88). TEA-354 complete: all 4 available dogfood repos done end-to-end without manual fixup (excluding worktree guard bug fix).
2026-05-24 | update | packages/vscode-extension | Phase 2 MVP: added sidebar tree views (Changed Knowledge, Suggested Updates), inline approve/skip actions, status bar with pending count, full command set (scan/diff/update/approve/skip/commit/openPr/refresh), esbuild ESM bundle replacing tsc+NodeNext.
2026-05-24 | create | docs/handoff-phase2-vscode.md | Agent handoff doc for GitHub Copilot to finish Phase 2: diff viewer (Task 1), source evidence webview (Task 2), settings UI (Task 3), vsce publish prep (Task 4), roadmap checkbox update (Task 5). Added to docs/index.md under "Agent handoffs".
2026-05-24 | update | docs/implementation-roadmap.md | Marked Phase 2 extension tasks done after Copilot handoff completion.
2026-05-24 | update | packages/vscode-extension | Added Phase 2 Agent Context and Stale Pages views, selected/bulk review actions, and telemetry opt-in wiring in the VS Code extension.
2026-05-24 | update | docs/implementation-roadmap.md | Marked Phase 2 Agent Context and telemetry opt-in checklist items complete after extension sprint progress.
2026-05-24 | update | packages/vscode-extension | Added mark-source-irrelevant persistence, DyKnow Map and Stale Pages views, and expanded selected/bulk review action parity in the extension.
2026-05-24 | create | docs/dyknow/.state/phase2-acceptance-report.json | Generated scripted Phase 2 acceptance checks covering manifest parity, build, package, and VSIX existence.
2026-05-24 | create | docs/dyknow/.state/phase2-acceptance-report.md | Generated human-readable Phase 2 acceptance summary with remaining manual quality-bar walkthrough step.
2026-05-24 | update | docs/implementation-roadmap.md | Marked Phase 2 DyKnow Map, Stale Pages, and per-update inline action parity complete; linked acceptance artifact status for the quality bar.
2026-05-24 | create | docs/dyknow/.state/phase2-manual-walkthrough.md | Recorded manual first-time-user walkthrough evidence: VSIX install, scan/diff/update flow, and review approval action.
2026-05-24 | update | docs/implementation-roadmap.md | Marked the final Phase 2 quality-bar checkbox complete using acceptance artifacts plus manual walkthrough evidence.
2026-05-25 | create | docs/handoff-phase3-demo.md | Added a focused Phase 3 kickoff handoff for demo repository selection and scripted walkthrough setup.
2026-05-25 | update | docs/index.md | Added the Phase 3 handoff page to Agent handoffs for discoverable next-slice execution.
2026-05-25 | create | docs/phase3-demo-checklist.md | Added a concrete Phase 3 demo checklist with issue-by-issue acceptance criteria.
2026-05-25 | update | docs/handoff-phase3-demo.md | Linked the new Phase 3 demo checklist and smoke command scaffold into the handoff.
2026-05-25 | update | docs/index.md | Added the Phase 3 demo checklist to Agent handoffs for easier navigation.
2026-05-25 | update | docs/phase3-demo-recording-runbook.md | Locked first-cut recording defaults (preconfigured init path, default page IDs, and optional audit-log appendix).
2026-05-25 | update | docs/handoff-phase3-codex.md | Converted open takeover questions into resolved operator defaults plus narrower remaining open items.
2026-05-25 | update | docs/dyknow/.state/repo-map.json | Refreshed the repo map snapshot while validating the Phase 3 smoke path after runbook and handoff updates.
2026-05-25 | update | docs/dyknow/.state/repo-diff.json | Regenerated the repo diff snapshot during the same Phase 3 smoke-path validation run.
2026-05-25 | update | docs/dyknow/.state/update-proposals.json | Regenerated update proposals during the same Phase 3 smoke-path validation run.
2026-05-25 | update | docs/phase3-demo-checklist.md | Aligned the checklist with the CLI-first recording default and preconfigured-init baseline.
2026-05-25 | update | docs/handoff-phase3-demo.md | Narrowed the remaining open question to first-cut ending scope now that the CLI-first lead decision is locked.
2026-05-25 | create | github:nickhilster/dyknow-demo-app | Created the public Phase 3 demo sandbox repo with stale baseline docs, DyKnow config, and baseline tag `phase3-demo-baseline` at `fee6467f40dc92904ae706f2fdb40446436ea5ea`.
2026-05-25 | update | github:nickhilster/dyknow-demo-app | Pushed staged drift branch `phase3-demo-staged-changes` (`361c59b`) with feedback feature, pricing-to-plans route rename, dependency drift, and first CLI run artifacts.
2026-05-25 | update | docs/phase3-demo-recording-runbook.md | Reconciled recording commands with the real demo repo flow, including snapshot-preserving scan output and exact local CLI command paths.
2026-05-25 | update | docs/phase3-demo-checklist.md | Added concrete execution status for the real demo repo, baseline tag commit, staged branch commit, and CLI pass artifact capture.
2026-05-25 | update | docs/handoff-phase3-demo.md | Shifted Phase 3 handoff from planning to execution with concrete baseline and staged-branch references.
2026-05-25 | update | docs/handoff-phase3-codex.md | Refreshed takeover guidance to focus on recording completion now that the real demo sandbox is live.
2026-05-25 | update | docs/dyknow/.state/repo-map.json | Refreshed the repo map snapshot while validating the updated Phase 3 handoff and checklist pages.
2026-05-25 | update | docs/dyknow/.state/repo-diff.json | Regenerated the repo diff snapshot during the same post-handoff demo-smoke validation run.
2026-05-25 | update | docs/dyknow/.state/update-proposals.json | Regenerated update proposals during the same post-handoff demo-smoke validation run.
2026-05-26 | update | docs/phase3-demo-recording-runbook.md | Locked the Phase 3 VS Code follow-up narrative, using `skip` for the non-approval action and keeping audit-log output appendix-only for the first public cut.
2026-05-27 | update | docs/handoff-phase3-codex.md, docs/handoff-phase3-demo.md, docs/phase3-demo-recording-runbook.md, docs/phase3-demo-checklist.md | Clarified that the Phase 3 VS Code follow-up now uses a first-class Source Evidence view tied to the active Suggested Updates selection.
2026-05-27 | update | docs/handoff-phase3-codex.md, docs/phase3-demo-checklist.md | Recorded the latest demo-repo CLI revalidation against the current DyKnow build, including the current diff summary and review-state outcome.
2026-05-27 | update | github:nickhilster/dyknow-demo-app | Revalidated the staged demo flow against the current DyKnow build, refreshed the demo repo state artifacts, and updated recording notes with the latest diff and review-state summary.
2026-05-27 | update | docs/dyknow/.state/repo-map.json | Refreshed the repo map snapshot while validating the updated Phase 3 handoff docs after the latest demo-repo CLI revalidation.
2026-05-27 | update | docs/dyknow/.state/repo-diff.json | Regenerated the repo diff snapshot during the same post-revalidation demo-smoke run.
2026-05-27 | update | docs/dyknow/.state/update-proposals.json | Regenerated update proposals during the same post-revalidation demo-smoke run.
2026-05-27 | update | packages/vscode-extension/src/extension.ts, docs/phase3-demo-recording-runbook.md | Made the Source Evidence action focus the dedicated view and aligned the VS Code demo runbook with that reveal path.
2026-05-27 | update | docs/dyknow/.state/repo-map.json | Refreshed the repo map snapshot while validating the VS Code cut runbook update with demo-smoke.
2026-05-27 | update | docs/dyknow/.state/repo-diff.json | Regenerated the repo diff snapshot during the same VS Code cut demo-smoke validation run.
2026-05-27 | update | docs/dyknow/.state/update-proposals.json | Regenerated update proposals during the same VS Code cut demo-smoke validation run.
2026-05-27 | update | docs/roadmap.md | Rewrote to Phase 0–5 structure with current milestone progress (Phase 0 100%, Phase 1 77%, Phase 2 100%, Phase 3 ~50%); aligned with Linear and Notion state.
2026-05-27 | update | linear | Updated Phase 3 milestone description to reflect execution state: sandbox live, CLI pass done, recording and messaging assets remaining (TEA-379, TEA-380, TEA-381).
