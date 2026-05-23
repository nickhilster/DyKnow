---
description: "Use when editing DyKnow wiki pages, README, CHANGELOG, CONTRIBUTING, AGENTS.md, or CLAUDE.md. Covers source-backed updates, frontmatter, cross-references, and docs/index.md + docs/log.md hygiene."
name: "DyKnow Wiki Maintenance"
applyTo:
  - "docs/*.md"
  - "README.md"
  - "CONTRIBUTING.md"
  - "CHANGELOG.md"
  - "AGENTS.md"
  - "CLAUDE.md"
---

# DyKnow Wiki Maintenance

- Treat the repo as a source-backed wiki, not a blog or generic marketing doc set.
- Preserve the `CLAUDE.md` schema for pages in `docs/` except `index.md` and `log.md`: frontmatter, summary, topic-organized body, `Open questions`, and `Cross-references`.
- Every product or implementation claim must trace to a real source. If the claim is inferred or still undecided, move it to `Open questions` instead of stating it as fact.
- When changing the meaning of a page, bump `last_reviewed`. When a new source informed the change, add it to `sources:`.
- If you create or delete a wiki page, also update `docs/index.md`. If you create, update, or delete a page or schema file, append the correct entry to `docs/log.md` without editing prior entries.
- Prefer links over duplicated prose. Keep pages persistent and organized by topic, not chronology.
- High-risk content (pricing, legal, security, compliance, customer commitments) requires explicit human review language and should never be silently published.