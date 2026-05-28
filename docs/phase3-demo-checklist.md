---
title: Phase 3 Demo Checklist
purpose: Break the Phase 3 public demo kickoff into concrete, actionable work items.
audience: internal
sources:
  - docs/handoff-phase3-demo.md
  - docs/implementation-roadmap.md
  - docs/roadmap.md
   - docs/log.md
   - packages/vscode-extension/package.json
   - packages/vscode-extension/src/extension.ts
  - https://github.com/nickhilster/dyknow-demo-app
  - https://github.com/nickhilster/dyknow-demo-app/tree/phase3-demo-staged-changes
  - AGENTS.md
last_reviewed: 2026-05-27
confidence: high
---

The Phase 3 handoff becomes easier to execute when it is split into a small set of issues with clear exit criteria. This page is the working checklist for that demo-prep slice.

Current decision: the first public demo should use a dedicated TypeScript Next.js sandbox repo rather than an existing dogfood repo. See [Phase 3 Demo Repo Selection](phase3-demo-repo-selection.md).

Current concrete target: `nickhilster/dyknow-demo-app` with the baseline tag `phase3-demo-baseline`.

Working bootstrap plan: use the proposed commands and starter file set in [Phase 3 Demo Baseline Plan](phase3-demo-baseline-plan.md).

Working staged change set: use the proposed source changes and stale-file targets in [Phase 3 Demo Change Script](phase3-demo-change-script.md).

Working recording order: use the command sequence and capture checklist in [Phase 3 Demo Recording Runbook](phase3-demo-recording-runbook.md).

Current recording default: lead with the CLI cut first and keep `dyknow init` out of the main recording path unless config is missing.
Current VS Code default: use `skip` as the non-approval action, and keep audit-log output appendix-only for the first public cut.

## Execution status (2026-05-25)

- Demo repo created: `https://github.com/nickhilster/dyknow-demo-app`
- Baseline locked on `main` with tag `phase3-demo-baseline` at `fee6467f40dc92904ae706f2fdb40446436ea5ea`
- Staged drift branch created: `phase3-demo-staged-changes` (`361c59b`)
- CLI flow executed end to end (`scan -> diff -> update -> review`) with one approval and one non-approval action pattern
- CLI flow revalidated on 2026-05-27 against the current DyKnow build: demo-app lint and build passed, `scan`/`diff` reported 3 added, 4 changed, and 1 removed file(s), `update` drafted 5 proposals across 5 affected pages, and the scripted review sequence left 2 Approved plus 3 Needs review.
- Recording notes captured in the demo repo at `docs/phase3-recording-notes.md`
- VS Code `Source Evidence` now exists as a first-class DyKnow view that follows the active `Suggested Updates` selection

## Issue checklist

1. Select the first demo repository.
   - Status: complete.
   - Use `nickhilster/dyknow-demo-app` on `main`.
   - Record the rationale, the baseline tag `phase3-demo-baseline`, and the files that will intentionally start stale.
   - Exit criterion: the demo repo choice is documented and reproducible.

2. Capture the baseline snapshot.
   - Status: complete.
   - Create or identify the tagged starting point `phase3-demo-baseline`.
   - Record the exact commit, branch name, and any required bootstrap steps.
   - Exit criterion: another contributor can clone the repo and match the same baseline state.

3. Prepare the stale-to-fresh change set.
   - Status: complete.
   - Identify at least one stale doc or page that will visibly change during the demo.
   - Start with `README.md`, `docs/feature-map.md`, `docs/setup-guide.md`, `docs/architecture.md`, and `AGENTS.md` as the stale baseline set.
   - Stage the source edits that drive the scan/diff/update flow.
   - Exit criterion: the demo change script is repeatable and creates meaningful output.

4. Draft the CLI smoke path.
   - Status: complete.
   - Validate the non-interactive `scan -> diff -> update` loop from the demo workspace.
   - Confirm the command can run in CI without manual prompts.
   - Exit criterion: a smoke command returns a clean success signal and leaves a useful artifact trail.

5. Draft the VS Code walkthrough path.
   - Status: complete.
   - Lead with the DyKnow views that make stale knowledge obvious: `DyKnow Map`, `Changed Knowledge`, and `Stale Pages`.
   - Include at least one approval action and one non-approval action; use `Approve` on `feature-map` and `Skip` on `setup-guide`.
   - Show `Agent Context` and the first-class `Source Evidence` view before ending the walkthrough, with `Source Evidence` following the active `Suggested Updates` selection.
   - Exit criterion: the walkthrough can be followed from the handoff without extra tribal knowledge.

6. Capture the recording script and artifact list.
   - Status: complete for CLI pass; remaining for VS Code pass.
   - List the exact commands, expected outputs, and screenshots or notes needed for recording.
   - Confirm where execution outputs and status artifacts should live.
   - Exit criterion: the demo recording can be reproduced and audited later.

## Open questions

- Does the demo smoke command need to run inside the demo repo only, or should it also validate the DyKnow repo itself before the first public recording cut?

## Cross-references

- [Phase 3 Demo Baseline Plan](phase3-demo-baseline-plan.md)
- [Phase 3 Demo Change Script](phase3-demo-change-script.md)
- [Phase 3 Demo Recording Runbook](phase3-demo-recording-runbook.md)
- [Phase 3 Demo Repo Selection](phase3-demo-repo-selection.md)
- [Phase 3 Public Demo Handoff](handoff-phase3-demo.md)
- [Implementation Roadmap](implementation-roadmap.md)
- [Roadmap](roadmap.md)
- [Setup Guide](setup-guide.md)
