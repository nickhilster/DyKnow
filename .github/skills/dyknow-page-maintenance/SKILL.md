---
name: dyknow-page-maintenance
description: 'Maintain DyKnow wiki pages or agent context from source changes. Use for product overview, feature map, architecture, setup guide, AGENTS, CLAUDE, README, index and log hygiene, and source-backed documentation diffs.'
argument-hint: 'Page or topic to update'
---

# DyKnow Page Maintenance

## When to Use

- Updating any synthesized page in `docs/`
- Refreshing `AGENTS.md`, `CLAUDE.md`, `README.md`, or other repo context files
- Adding a new wiki page from an approved source
- Running a manual source-backed docs maintenance pass

## Procedure

1. Read `CLAUDE.md`, `AGENTS.md`, and the specific page or pages involved.
2. Read the real source files that justify the change. For product truth, prefer `docs/sources/dyknow_local_whitepaper.md` unless a newer approved source exists.
3. Make the smallest topic-scoped edit that resolves the request.
4. If a page's meaning changed, bump `last_reviewed` and update `sources:` when new evidence informed the change.
5. If you created or deleted a wiki page, update `docs/index.md`.
6. Append the correct `create`, `update`, `ingest`, `lint`, or `delete` entry to `docs/log.md`. Never edit existing entries.
7. If evidence is missing or ambiguous, add an `Open questions` note instead of inventing a fact.

## Output

Return:
- the files changed
- the evidence used
- any open questions or reviewer follow-up