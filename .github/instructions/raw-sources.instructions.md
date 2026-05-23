---
description: "Use when working with DyKnow raw sources under docs/sources, source ingestion, or source authority. Covers immutable-input rules and how to add new sources safely."
name: "DyKnow Raw Sources"
applyTo: "docs/sources/**"
---

# DyKnow Raw Sources

- Treat every file under `docs/sources/` as immutable evidence. Do not rewrite it to fit the wiki.
- If source wording conflicts with the synthesized docs, update the wiki pages or log an open question; do not edit the source.
- When adding a new raw source, also update `docs/sources/README.md`, append an `ingest` entry to `docs/log.md`, and then update affected pages.
- Keep source citations exact. Use real file paths, real sections, and real authority order.
- If a requested change truly requires modifying a raw source, stop and ask for explicit human approval because it changes the evidence base.