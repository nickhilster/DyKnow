---
title: Phase 3 Demo Checklist
purpose: Break the Phase 3 public demo kickoff into concrete, actionable work items.
audience: internal
sources:
  - docs/handoff-phase3-demo.md
  - docs/implementation-roadmap.md
  - docs/roadmap.md
  - AGENTS.md
last_reviewed: 2026-05-25
confidence: high
---

The Phase 3 handoff becomes easier to execute when it is split into a small set of issues with clear exit criteria. This page is the working checklist for that demo-prep slice.

Current decision: the first public demo should use a dedicated TypeScript Next.js sandbox repo rather than an existing dogfood repo. See [Phase 3 Demo Repo Selection](phase3-demo-repo-selection.md).

Current concrete target: `nickhilster/dyknow-demo-app` with the baseline tag `phase3-demo-baseline`.

## Issue checklist

1. Select the first demo repository.
   - Use `nickhilster/dyknow-demo-app` on `main`.
   - Record the rationale, the baseline tag `phase3-demo-baseline`, and the files that will intentionally start stale.
   - Exit criterion: the demo repo choice is documented and reproducible.

2. Capture the baseline snapshot.
   - Create or identify the tagged starting point `phase3-demo-baseline`.
   - Record the exact commit, branch name, and any required bootstrap steps.
   - Exit criterion: another contributor can clone the repo and match the same baseline state.

3. Prepare the stale-to-fresh change set.
   - Identify at least one stale doc or page that will visibly change during the demo.
   - Start with `README.md`, `docs/feature-map.md`, `docs/setup-guide.md`, `docs/architecture.md`, and `AGENTS.md` as the stale baseline set.
   - Stage the source edits that drive the scan/diff/update flow.
   - Exit criterion: the demo change script is repeatable and creates meaningful output.

4. Draft the CLI smoke path.
   - Validate the non-interactive `scan -> diff -> update` loop from the demo workspace.
   - Confirm the command can run in CI without manual prompts.
   - Exit criterion: a smoke command returns a clean success signal and leaves a useful artifact trail.

5. Draft the VS Code walkthrough path.
   - Decide which view or command sequence is the lead narrative.
   - Include at least one approval action and one non-approval action.
   - Exit criterion: the walkthrough can be followed from the handoff without extra tribal knowledge.

6. Capture the recording script and artifact list.
   - List the exact commands, expected outputs, and screenshots or notes needed for recording.
   - Confirm where execution outputs and status artifacts should live.
   - Exit criterion: the demo recording can be reproduced and audited later.

## Open questions

- Should the first recording lead with the CLI or the VS Code extension?
- Does the demo smoke command need to run inside the demo repo only, or should it also validate the DyKnow repo itself?

## Cross-references

- [Phase 3 Demo Repo Selection](phase3-demo-repo-selection.md)
- [Phase 3 Public Demo Handoff](handoff-phase3-demo.md)
- [Implementation Roadmap](implementation-roadmap.md)
- [Roadmap](roadmap.md)
- [Setup Guide](setup-guide.md)
