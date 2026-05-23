# Contributing to DyKnow

DyKnow is currently a concept-stage project. The repository today is a documentation system; application code will land in future phases (see [docs/roadmap.md](docs/roadmap.md)).

This guide covers contributing to **documentation** today and will be extended when code lands.

---

## Before you start

1. Read [README.md](README.md) for the repo layout.
2. Read [CLAUDE.md](CLAUDE.md) for the wiki schema — page conventions, the three-layer model, what not to do.
3. Skim [docs/glossary.md](docs/glossary.md) so you use canonical terms.
4. If you are an LLM, also read [AGENTS.md](AGENTS.md).

## What you can change

| You can | You should not |
|---|---|
| Edit any page in `docs/` (with the conventions below) | Edit files under `docs/sources/` — those are immutable raw sources |
| Add new wiki pages, with frontmatter and an entry in `docs/index.md` | Add a page without listing it in `docs/index.md` |
| Append to `docs/log.md` | Edit past entries in `docs/log.md` (append a correction instead) |
| Propose changes to `CLAUDE.md`, `AGENTS.md`, or this file | Silently change the schema — open a PR with reasoning |
| Add new raw sources under `docs/sources/` | Modify a raw source after it has been ingested |

## Page conventions

Every page in `docs/` (except `index.md` and `log.md`) must begin with frontmatter:

```yaml
---
title: <Human-readable title>
purpose: <One sentence: what this page exists to answer>
audience: <internal | external | agent | mixed>
sources:
  - <path or URL>
last_reviewed: YYYY-MM-DD
confidence: <high | medium | low>
---
```

Followed by:

1. A one-paragraph **Summary** so readers can decide if they need the rest.
2. The body, organized by topic — not chronology.
3. A trailing **Open questions** section if anything is uncertain.
4. A trailing **Cross-references** section linking related pages.

See [CLAUDE.md](CLAUDE.md) for the full schema.

## Workflow

### Adding a new raw source

1. Place the file under `docs/sources/` (don't touch it after).
2. Add a row to `docs/sources/README.md`.
3. Append an `ingest` entry to `docs/log.md`.
4. Update affected wiki pages: bump `last_reviewed`, add the new source to their `sources:` list, propose content changes.
5. Open a PR.

### Updating an existing wiki page

1. Make the edits.
2. Bump `last_reviewed` in the frontmatter.
3. If a new source informed the change, add it to `sources:`.
4. Append an `update` entry to `docs/log.md`.
5. Open a PR.

### Creating a new wiki page

1. Add the file under `docs/` with full frontmatter.
2. Add an entry in `docs/index.md` under the appropriate category.
3. Add cross-references from any related existing pages.
4. Append a `create` entry to `docs/log.md`.
5. Open a PR.

### Deleting a wiki page

1. Move the file out of `docs/` (or delete).
2. Remove the entry from `docs/index.md`.
3. Remove or update any cross-references pointing to it.
4. Append a `delete` entry to `docs/log.md` **with a reason**.
5. Open a PR.

## Pull request expectations

- One coherent change per PR.
- Title format: `docs: <short description>` for doc changes.
- Body should answer: **what changed**, **why**, **which sources justify it**, **risk level** (low / medium / high).
- **High-risk content** (pricing, legal, security, compliance, customer commitments) requires named human review before merging — even if you are an LLM with merge rights.

## Running the lint checklist

Before any external release (public demo, pilot kickoff, marketing publish), run through [docs/lint.md](docs/lint.md) and append a `lint` entry to `docs/log.md`.

Eventually this will be the `dyknow lint` command. Today it is human-driven.

## When code lands

This document will be extended with build, test, and code-style sections in [Phase 1](docs/roadmap.md). For now, there is no code.

## Questions

For schema or convention questions, open a PR with a proposed change to [CLAUDE.md](CLAUDE.md) and explain the reasoning. The schema is meant to evolve — but deliberately.
