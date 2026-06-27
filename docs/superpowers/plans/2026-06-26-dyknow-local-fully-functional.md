# DyKnow Local Fully Functional Sprint Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get DyKnow Local to a repo-verifiable "fully functional" state across CLI, MCP, and VS Code by closing the remaining shared-surface gaps and backing the result with automated checks.

**Architecture:** Keep the current shape: `packages/core` owns contracts, `packages/app` owns shared orchestration, `packages/cli` stays a thin terminal surface, `packages/mcp-server` stays a thin stdio tool adapter, and the VS Code extension remains a client surface. The sprint closes the missing shared log/audit capability, adds MCP parity for audit inspection, and adds extension-focused automated verification rather than inventing new product scope.

**Tech Stack:** TypeScript, npm workspaces, Vitest, Biome, VS Code extension host bundle, Node stdio MCP server.

---

## Definition of Fully Functional for This Sprint

- [ ] Full local workflow is available and verified in the CLI: `init -> scan -> diff -> update -> review -> log -> commit/pr`.
- [ ] The same operational workflow is available and verified for agent-native clients through MCP, including audit/log inspection.
- [ ] The VS Code extension has automated verification for its core command wiring and publish-flow argument construction.
- [ ] `npm run build`, `npm test`, `npm run lint`, and `npm run typecheck` all pass after the sprint changes.
- [ ] Product/docs status pages reflect the shipped state rather than planned-only language.

## Task 1: Capture and Lock the Baseline

**Files:**
- Create: `docs/superpowers/plans/2026-06-26-dyknow-local-fully-functional.md`
- Verify: workspace root scripts in `package.json`

- [ ] **Step 1: Record the baseline commands**

Run:

```bash
npm run build
npm test
npm run lint
npm run typecheck
```

Expected:
- all commands exit `0`
- this confirms the sprint starts from a green baseline rather than fixing pre-existing breakage first

- [ ] **Step 2: Use the baseline to constrain sprint scope**

Rule:
- do not add Cloud work
- do not widen product scope past Local CLI + MCP + VS Code
- prefer missing parity and missing verification over speculative refactors

## Task 2: Extract Shared Audit/Log Reading into `packages/app`

**Files:**
- Create: `packages/app/src/log-service.ts`
- Modify: `packages/app/src/index.ts`
- Modify: `packages/cli/src/log.ts`
- Test: `packages/cli/test/log.test.ts`

- [ ] **Step 1: Write the failing shared log-service tests indirectly through the existing CLI log suite**

Run:

```bash
npx vitest run packages/cli/test/log.test.ts
```

Expected:
- PASS before refactor
- this is a characterization gate for the existing CLI log behavior

- [ ] **Step 2: Move log-reading/report-generation logic into the shared app layer**

Implementation target:
- `packages/app/src/log-service.ts` should own:
  - `DEFAULT_REVIEW_AUDIT_LOG_PATH`
  - `LOG_SOURCES`
  - `LOG_ACTION_FILTERS`
  - `supportsLogSourceFiltering(...)`
  - `parseLogOptions(...)` only if it remains generic enough; keep it in CLI if it stays terminal-specific
  - `createAuditLogReport(...)`

Constraint:
- CLI-only argument parsing may stay in `packages/cli/src/log.ts`
- report generation and audit file reading should move to `@dyknow/app`

- [ ] **Step 3: Make the CLI log command a thin wrapper**

Implementation target:
- `packages/cli/src/log.ts` should keep CLI option parsing and re-export shared constants/result helpers from `@dyknow/app`
- no behavior change in terminal output

- [ ] **Step 4: Re-run the focused log suite**

Run:

```bash
npx vitest run packages/cli/test/log.test.ts
```

Expected:
- PASS with no message regressions

## Task 3: Add MCP Audit/Log Inspection

**Files:**
- Modify: `packages/mcp-server/src/server.ts`
- Modify: `packages/mcp-server/test/server.test.ts`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/feature-map.md`
- Modify: `docs/mcp-server-plan.md`

- [ ] **Step 1: Add the new tool definition**

Tool:

```text
dyknow_log
```

Inputs:
- `inputPath?: string`
- `limit?: number`
- `source?: "all" | "committed" | "runtime"`
- `action?: "all" | "review" | "publish"`

Response shape:
- `inputPath`
- `shownEntries`
- `totalEntries`
- `report`

- [ ] **Step 2: Implement the MCP handler using the shared log service**

Implementation target:
- import `createAuditLogReport` and related defaults/types from `@dyknow/app`
- keep the tool return structured-first, with the formatted report as a text payload plus structured counts

- [ ] **Step 3: Add MCP server tests for the log tool**

Cover:
- tool appears in `tools/list`
- default empty-log response is stable
- merged committed/runtime view works when fixtures are present
- filter arguments are honored

- [ ] **Step 4: Run the focused MCP suite**

Run:

```bash
npx vitest run packages/mcp-server/test/server.test.ts packages/cli/test/log.test.ts
```

Expected:
- PASS

## Task 4: Add VS Code Extension Verification for Core Command Wiring

**Files:**
- Create: `packages/vscode-extension/src/commands.ts`
- Modify: `packages/vscode-extension/src/extension.ts`
- Create: `packages/vscode-extension/test/commands.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Extract testable command/argument helpers out of the monolithic extension entrypoint**

Move pure logic into `packages/vscode-extension/src/commands.ts` for:
- commit args (`--allow-high-risk` behavior)
- PR args (`--branch` behavior)
- review action arg builders for approve/reject/skip/regenerate/edit
- default PR branch name generation

Constraint:
- do not rewrite the whole extension
- extract only pure helpers needed to verify command wiring

- [ ] **Step 2: Add focused Vitest coverage for the helpers**

Cover:
- commit args include `--allow-high-risk` only when enabled
- PR args include the chosen branch and preserve command order
- review arg builders target the expected `--page` and action flag
- regenerate/reject multi-select helpers dedupe page IDs

- [ ] **Step 3: Keep the extension activation behavior unchanged**

Run:

```bash
npm run build --workspace=packages/vscode-extension
```

Expected:
- PASS
- bundled extension still builds after helper extraction

- [ ] **Step 4: Run the extension-focused tests**

Run:

```bash
npx vitest run packages/vscode-extension/test/commands.test.ts
```

Expected:
- PASS

## Task 5: Final Workspace Verification and Status Updates

**Files:**
- Modify: `docs/implementation-roadmap.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/log.md`

- [ ] **Step 1: Run the full workspace verification suite**

Run:

```bash
npm run build
npm run typecheck
npm test
npm run lint
```

Expected:
- all commands exit `0`

- [ ] **Step 2: Update the roadmap/checklist pages to reflect the shipped Local state**

Update:
- MCP log parity if shipped
- shared app-layer audit/log extraction if shipped
- extension verification coverage if shipped
- phase language from "core complete but not fully verified" toward the new repo-verified Local state

- [ ] **Step 3: Append a sprint completion entry to the repo log**

Update:
- `docs/log.md`

Record:
- what was implemented
- what verification was run
- the exact Local definition of done reached in this sprint

## Execution Notes

- Always run the focused tests for the current slice before moving to the next implementation step.
- Do not revert unrelated worktree changes.
- Prefer keeping CLI and MCP as wrappers over `@dyknow/app` when touching shared behavior.
- Treat VS Code extension work as verification-driven unless a missing helper extraction is required to make testing possible.

## Sprint Exit Criteria

- [ ] Shared audit/log reading lives in `@dyknow/app`.
- [ ] MCP exposes `dyknow_log`.
- [ ] VS Code extension has automated tests for command/argument wiring.
- [ ] Full workspace build/test/lint/typecheck is green.
- [ ] Docs describe DyKnow Local as fully functional for the repo-local workflow.
