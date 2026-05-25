---
title: Phase 3 Demo Recording Runbook
purpose: Provide the exact command order, walkthrough beats, and capture artifacts for the first public DyKnow demo recording.
audience: internal
sources:
  - docs/phase3-demo-baseline-plan.md
  - docs/phase3-demo-change-script.md
  - docs/phase3-demo-checklist.md
  - docs/handoff-phase3-demo.md
  - docs/messaging.md
  - docs/setup-guide.md
  - AGENTS.md
last_reviewed: 2026-05-25
confidence: medium
---

This page turns the Phase 3 planning set into a recording-ready runbook. It assumes the first recording uses the `nickhilster/dyknow-demo-app` baseline and staged change script already defined in the linked pages.

## Recording goal

Show a compact before-and-after story:

1. the app source changed,
2. the docs and `AGENTS.md` are stale,
3. DyKnow detects the drift,
4. a human reviews the proposed updates,
5. the maintained knowledge artifacts become current again.

The recording should reinforce the messaging claim that DyKnow keeps product truth alive rather than merely generating docs.

## Recommended narrative order

Lead with the CLI recording first.

Reasoning:

- the CLI path is the narrowest proof of the core system,
- it makes the scan, diff, update, and review pipeline explicit,
- the later VS Code recording can reuse the same source changes while shifting the emphasis to usability.

## Pre-recording checklist

Before recording, confirm all of the following in `nickhilster/dyknow-demo-app`:

1. `main` contains the stale baseline and is tagged `phase3-demo-baseline`.
2. The staged source changes from [Phase 3 Demo Change Script](phase3-demo-change-script.md) are already applied on a separate working branch.
3. The stale docs remain unchanged from baseline.
4. DyKnow can be invoked from the demo repo with a known-good local command path.
5. The terminal window and editor layout are clean enough for screen capture.

## CLI runbook

Use this command order for the first recording pass.

### 1. Show the stale state

Open the demo repo and briefly show:

- the new source route or feature files,
- the renamed route in source,
- one stale doc page still referencing the old product state,
- stale `AGENTS.md` content.

Suggested narration:

> The source already changed, but the maintained knowledge pages still describe the old state.

### 2. Initialize DyKnow if needed

If the repo does not already carry committed DyKnow config, run:

```bash
dyknow init
```

If the recording uses a direct local build of this repo's CLI, adapt to the equivalent built command path.

### 3. Scan the repo

```bash
dyknow scan
```

Expected checkpoint:

- the repo map writes successfully,
- route and package metadata are visible for the new feature and renamed route.

### 4. Detect changes

```bash
dyknow diff
```

Expected checkpoint:

- the diff maps changed source files to affected maintained pages,
- the output clearly suggests that `README.md`, feature or architecture docs, and `AGENTS.md` are impacted.

### 5. Draft updates

```bash
dyknow update
```

Expected checkpoint:

- proposals are written for the stale maintained files,
- the proposal summaries visibly tie back to the route rename, new feature, and setup drift.

### 6. Review proposals

Use at least one approval action and one non-approval action.

Recommended pattern:

```bash
dyknow review --approve --page feature-map
dyknow review --regenerate --page setup-guide
dyknow review --approve --page agent-context
```

If the actual page IDs differ in the demo repo config, keep the action pattern but swap in the correct page IDs.

Expected checkpoint:

- one proposal is clearly approved,
- one proposal is explicitly not approved on the first pass,
- the agent-context update is visible as part of the maintenance story.

### 7. Show resulting artifacts

End the CLI recording by showing:

- the updated proposal states,
- one refreshed doc,
- refreshed `AGENTS.md`,
- the audit trail or other generated state artifact if it improves the story.

## Expected capture artifacts

The first recording pass should preserve these artifacts for reuse:

- terminal transcript or notes for each command
- screenshots or clips of:
  - stale source versus stale docs,
  - `dyknow diff` affected pages,
  - `dyknow update` proposal summaries,
  - the approval action,
  - the non-approval action,
  - refreshed docs and refreshed `AGENTS.md`
- the exact baseline commit or tag reference
- the branch name used for the staged source changes

## Suggested file for recording notes

Store the first recording notes as a future page or artifact tied to the demo repo execution, not as an unstructured chat log. The notes should preserve:

- date recorded,
- repo commit or branch,
- commands run,
- deviations from the planned runbook,
- follow-up edits needed before a public cut.

## VS Code follow-up

After the CLI recording is stable, reuse the same baseline and staged change set for the VS Code recording. Keep the source changes identical when possible so the difference between the two recordings is the surface area, not the product story.

## Open questions

- Should the first CLI recording show `dyknow init`, or should config already be present so the video stays focused on drift detection and review?
- Which exact page IDs will the demo repo config assign to the maintained files?
- Should the first public cut include audit-log output, or keep the ending focused only on refreshed docs and agent context?

## Cross-references

- [Phase 3 Demo Baseline Plan](phase3-demo-baseline-plan.md)
- [Phase 3 Demo Change Script](phase3-demo-change-script.md)
- [Phase 3 Public Demo Handoff](handoff-phase3-demo.md)
- [Phase 3 Demo Checklist](phase3-demo-checklist.md)
- [Messaging](messaging.md)