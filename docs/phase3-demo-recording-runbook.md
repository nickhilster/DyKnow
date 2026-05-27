---
title: Phase 3 Demo Recording Runbook
purpose: Provide the exact command order, walkthrough beats, and capture artifacts for the first public DyKnow demo recording.
audience: internal
sources:
  - docs/phase3-demo-baseline-plan.md
  - docs/phase3-demo-change-script.md
  - docs/phase3-demo-checklist.md
  - docs/handoff-phase3-demo.md
  - packages/core/src/config.ts
  - packages/cli/src/index.ts
  - packages/vscode-extension/package.json
  - packages/vscode-extension/src/extension.ts
  - https://github.com/nickhilster/dyknow-demo-app
  - https://github.com/nickhilster/dyknow-demo-app/tree/phase3-demo-staged-changes
  - docs/messaging.md
  - docs/setup-guide.md
  - AGENTS.md
last_reviewed: 2026-05-27
confidence: medium
---

This page turns the Phase 3 planning set into a recording-ready runbook. It assumes the first recording uses the `nickhilster/dyknow-demo-app` baseline and staged change script already defined in the linked pages.

Current validated execution refs:

- Baseline tag: `phase3-demo-baseline`
- Baseline commit: `fee6467f40dc92904ae706f2fdb40446436ea5ea`
- Staged demo branch: `phase3-demo-staged-changes`

## Decisions locked for first public cut

To keep the first public recording short and reproducible, use these decisions as defaults:

1. Lead narrative: CLI first.
2. `dyknow init`: do not include it in the main recording path; start from a preconfigured repo.
3. Review page IDs: use the default maintained-page IDs from DyKnow init output:
   - `product-overview`
   - `feature-map`
   - `architecture`
   - `setup-guide`
   - `agent-context`
4. Ending scope: refreshed docs plus refreshed `AGENTS.md`; keep audit-log output appendix-only for the first public cut.
5. VS Code non-approval action: use `skip` so the second cut demonstrates a different review choice than the CLI cut.

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

### 2. Verify DyKnow config (or initialize only if missing)

For the main recording pass, assume the demo repo already includes committed `dyknow.config.json` and `dyknow.config.schema.json`.

Only if those files are missing, run:

```bash
dyknow init
```

If the recording uses a direct local build of this repo's CLI, use the equivalent built command path from this repository's setup guide.

### 3. Scan the repo

```bash
node C:\DEV\DyKnow\packages\cli\dist\bin.js scan --output docs/dyknow/.state/repo-map-current.json
```

Expected checkpoint:

- the current repo map writes successfully without overwriting the baseline snapshot,
- route and package metadata are visible for the new feature and renamed route.

### 4. Detect changes

```bash
node C:\DEV\DyKnow\packages\cli\dist\bin.js diff --snapshot docs/dyknow/.state/repo-map.json --output docs/dyknow/.state/repo-diff.json
```

Expected checkpoint:

- the diff maps changed source files to affected maintained pages,
- the output clearly suggests that `README.md`, feature or architecture docs, and `AGENTS.md` are impacted.

### 5. Draft updates

```bash
node C:\DEV\DyKnow\packages\cli\dist\bin.js update --diff docs/dyknow/.state/repo-diff.json --output docs/dyknow/.state/update-proposals.json
```

Expected checkpoint:

- proposals are written for the stale maintained files,
- the proposal summaries visibly tie back to the route rename, new feature, and setup drift.

### 6. Review proposals

Use at least one approval action and one non-approval action.

Recommended pattern:

```bash
node C:\DEV\DyKnow\packages\cli\dist\bin.js review --approve --page feature-map --input docs/dyknow/.state/update-proposals.json
node C:\DEV\DyKnow\packages\cli\dist\bin.js review --regenerate --page setup-guide --input docs/dyknow/.state/update-proposals.json
node C:\DEV\DyKnow\packages\cli\dist\bin.js review --approve --page agent-context --input docs/dyknow/.state/update-proposals.json
```

Those IDs align with the default DyKnow config page set. If the demo repo intentionally customizes page IDs, keep the same action pattern but swap in the configured IDs.

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

Use the VS Code extension surface to shift the emphasis from terminal commands to the visual review workflow:

1. Open the `dyknow-demo-app` workspace with `dyknow.config.json` already present.
2. Show the `DyKnow Map`, `Changed Knowledge`, and `Stale Pages` views so the stale state is visible before any action.
3. Run `DyKnow: Scan`, `DyKnow: Detect Changes`, and `DyKnow: Draft Updates` from the DyKnow view or command palette.
4. Open `Suggested Updates` and use `Approve` on `feature-map`.
5. Use `Skip` on `setup-guide` to demonstrate the non-approval path in the extension.
6. Open `Agent Context`, then show the first-class `Source Evidence` view while `feature-map` or `setup-guide` remains selected in `Suggested Updates` so the evidence visibly follows the active proposal.
7. End the cut with `DyKnow: Commit Approved Updates` or `DyKnow: Open PR` if the recording needs a publish moment; otherwise stop after the review pass.

## Remaining open items

- Whether a later extended cut should include a short appendix that shows `dyknow log --source all --action all` after review actions.

## Cross-references

- [Phase 3 Demo Baseline Plan](phase3-demo-baseline-plan.md)
- [Phase 3 Demo Change Script](phase3-demo-change-script.md)
- [Phase 3 Public Demo Handoff](handoff-phase3-demo.md)
- [Phase 3 Demo Checklist](phase3-demo-checklist.md)
- [Messaging](messaging.md)
