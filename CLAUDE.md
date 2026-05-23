# CLAUDE.md — Wiki Maintainer Schema

This file is the **schema** for the DyKnow documentation wiki. It defines how an LLM (or a human acting in the same role) maintains the pages in `docs/`. The pattern is adapted from Karpathy's LLM-wiki concept and DyKnow's own Dynamic Knowledge Page model.

If you are an LLM assigned to this repository, read this file first.

---

## 1. Three-layer model

| Layer | Location | Mutability | Maintained by |
|---|---|---|---|
| Raw sources | `docs/sources/*`, future inputs | Immutable | Humans only |
| Wiki | `docs/*.md` | Mutable, source-backed | LLM (you), reviewed by humans |
| Schema | `CLAUDE.md` (this file), `AGENTS.md` | Stable, evolves rarely | Humans, with LLM proposals |

Never edit raw sources. Never invent claims that aren't supported by a raw source or a prior wiki page that itself cites a source.

## 2. Page conventions

Every page under `docs/` (except `index.md` and `log.md`) must begin with this frontmatter:

```yaml
---
title: <Human-readable title>
purpose: <One sentence: what this page exists to answer>
audience: <internal | external | agent | mixed>
sources:
  - <path or URL>
  - <path or URL>
last_reviewed: YYYY-MM-DD
confidence: <high | medium | low>
---
```

After the frontmatter:

1. A one-paragraph **summary** so a reader (or another LLM) can decide if they need the rest.
2. The body, organized by topic — not by chronology.
3. A trailing **Open questions** section if any claims are uncertain.
4. A trailing **Cross-references** section linking related pages with `[[page-name]]` style or markdown links.

Pages are persistent. They are updated in place when source material changes. They are not dated posts.

## 3. Core operations

### Ingest
When a new raw source arrives:
1. Read it end-to-end.
2. Identify which existing pages it affects.
3. Propose diffs to each affected page with a one-line reason.
4. If the source introduces a new topic, create a new page rather than overloading an existing one.
5. Append an entry to `docs/log.md`.

### Query
When a human asks a question:
1. Try to answer from existing wiki pages first.
2. If the answer required synthesis across pages, consider filing the synthesis as a new page or section. Explorations should compound.
3. If the answer required reading raw sources, update the relevant wiki page so the next query doesn't.

### Lint
On request (or before any release), audit the wiki for:
- Contradictions between pages.
- Stale `last_reviewed` dates (> 90 days).
- Orphan pages not referenced by `docs/index.md`.
- Pages whose `sources:` no longer exist.
- Missing cross-references between pages that clearly relate.
- Claims with no source backing.

Report findings as a checklist; do not silently fix.

## 4. Navigation files

- **`docs/index.md`** — the catalog. Every wiki page is listed here with a one-line hook. Reorganize when categories shift, but keep entries terse.
- **`docs/log.md`** — append-only. Each entry uses the prefix format:
  ```
  YYYY-MM-DD | <ingest|update|create|lint|delete> | <page or scope> | <one-line reason>
  ```
  Never edit past entries. New entries go at the bottom.

## 5. What not to do

- Do not write blog-style dated posts.
- Do not duplicate content across pages — link instead.
- Do not auto-publish high-risk claims (pricing, legal, security, compliance) without human approval.
- Do not delete a page silently — log a `delete` entry with reason.
- Do not invent file paths, commands, or APIs. If something isn't in a source, mark it as an open question.

## 6. Confidence and risk

Each update you propose should carry an implicit answer to:
- What source(s) justify it?
- What's the confidence level?
- Is this a high-risk claim (pricing, legal, security, customer commitments, compliance)?

High-risk claims require a human reviewer. Mark them clearly in the diff.

## 7. Project-specific knowledge

- DyKnow's founding source of truth is [docs/sources/dyknow_local_whitepaper.md](docs/sources/dyknow_local_whitepaper.md). All product claims should trace back to it until additional sources are added.
- DyKnow has two product surfaces: **Cloud** and **Local**. Most pages need to address both unless explicitly scoped.
- The internal first customer is Teambotics. Examples and dogfooding should reference it where useful.
- See [AGENTS.md](AGENTS.md) for general agent context (project purpose, conventions, do-not-touch).
