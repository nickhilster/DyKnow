# Raw Sources

Pointers to the immutable source material that feeds the wiki. **Do not edit these files.** New sources should be added here with a one-line description and the date ingested.

## Current sources

| Source | Location | Type | Ingested |
|---|---|---|---|
| DyKnow Whitepaper | [dyknow_local_whitepaper.md](dyknow_local_whitepaper.md) | Founding concept document | 2026-05-23 |

Private planning workspaces are intentionally omitted from this public repository because they are not authoritative raw sources.

## How to add a source

1. Place the raw file somewhere immutable (this directory, or the repo root for top-level docs).
2. Add a row to the table above.
3. Append an `ingest` entry to [../log.md](../log.md).
4. Propose updates to any affected wiki pages and update their frontmatter `sources:` and `last_reviewed`.

## Source authority hierarchy

For now, the whitepaper is the sole source of product truth. As DyKnow evolves, the expected hierarchy is:

1. Working code and runtime behavior
2. OpenAPI specs, schemas, config
3. Approved product specs and design docs
4. Whitepaper and strategy documents
5. Marketing and external copy

Higher-authority sources override lower-authority ones when they conflict.
