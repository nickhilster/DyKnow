---
title: Lint Checklist
purpose: Periodic health check for the DyKnow wiki — runnable by a human or an LLM maintainer.
audience: agent
sources:
  - ../CLAUDE.md
last_reviewed: 2026-05-23
confidence: high
---

## Summary

Run this checklist on request and before any external release (public demo, pilot kickoff, marketing publish). It is a **report-only** pass: surface findings as a checklist; do not silently fix high-risk issues. Low-risk fixes (typos, broken links inside the wiki) may be auto-applied if you also append a `lint` entry to [log.md](log.md).

This is the human-runnable equivalent of the future `dyknow lint` command described in the [Setup Guide](setup-guide.md). Today it is checklist-driven; the same checks will eventually be enforced programmatically.

---

## A. Structural checks

- [ ] Every page under `docs/` (except `index.md`, `log.md`, and this file) has frontmatter with `title`, `purpose`, `audience`, `sources`, `last_reviewed`, `confidence`.
- [ ] No page is missing from [index.md](index.md) (orphan check).
- [ ] No page is in [index.md](index.md) that doesn't exist on disk (broken catalog entry).
- [ ] Every `sources:` path resolves to a real file.
- [ ] Every internal markdown link resolves.
- [ ] Every page has a one-paragraph summary section near the top.
- [ ] Every page has a `Cross-references` section (or has none because none apply — note explicitly).

## B. Freshness checks

- [ ] No page has a `last_reviewed` date older than 90 days. List any that do.
- [ ] No page's `sources:` reference a file modified after the page's `last_reviewed` date. (If a source has changed, the page may be stale.)
- [ ] [log.md](log.md) has at least one entry within the last 30 days, unless the project is intentionally paused.

## C. Consistency checks

- [ ] No contradictions between pages on the same fact. Common drift points: pricing, command names, file paths, page list, glossary terms.
- [ ] Glossary terms are used consistently. If a page introduces a term that isn't in [glossary.md](glossary.md), either add it or replace the term.
- [ ] DyKnow Local CLI command names match between [feature-map.md](feature-map.md), [setup-guide.md](setup-guide.md), and [AGENTS.md](../AGENTS.md).
- [ ] Connector lists, output types, and review states match between [feature-map.md](feature-map.md), [architecture.md](architecture.md), and [trust-and-security.md](trust-and-security.md).
- [ ] Phase numbering matches between [roadmap.md](roadmap.md) and any page referencing phases.

## D. Source backing

- [ ] No claim in any page lacks source backing. If a claim is genuinely inferred, mark it under `Open questions` rather than presenting it as fact.
- [ ] No invented file paths, commands, APIs, or features that aren't in a source.
- [ ] `confidence: high` pages have a `sources:` list of at least one concrete file. `confidence: medium` or `low` pages have explicit open questions.

## E. Cross-reference health

- [ ] Pages that clearly relate link to each other. (Product Overview ↔ Feature Map ↔ Architecture; Trust and Security ↔ Architecture; Setup Guide ↔ Feature Map.)
- [ ] No `[[page-name]]` references point to non-existent pages.
- [ ] Glossary terms used in 3+ pages have at least one inbound link from the glossary page back, when useful.

## F. Sensitive content

- [ ] No page contains secrets, credentials, customer data, or unpublished pricing.
- [ ] High-risk claims (pricing, legal, security, compliance, customer commitments) are explicitly flagged and have a named reviewer or an `Open questions` entry.
- [ ] No source file under `docs/sources/` has been modified (raw sources must be immutable).

## G. Log hygiene

- [ ] [log.md](log.md) entries follow the format `YYYY-MM-DD | <action> | <scope> | <reason>`.
- [ ] No past entry has been edited (corrections are appended, not rewritten).
- [ ] Every page created/updated/deleted since the last lint pass has a corresponding log entry.

---

## How to run a lint pass

1. Read this checklist top to bottom.
2. For each unchecked box, either:
   - Tick it because the check passed, or
   - Write a finding under "Findings" below (in your pass output, not in this file).
3. Append a single `lint` entry to [log.md](log.md) summarizing the pass (e.g., `2026-05-23 | lint | wiki | 0 findings`, or `2026-05-23 | lint | wiki | 3 findings, see PR #12`).
4. If findings are non-trivial, open a PR with the proposed fixes rather than silently editing.

## Open questions

- Should `dyknow lint` be a separate command or a flag on `dyknow scan`?
- Threshold for `last_reviewed` staleness — 90 days is a placeholder.
