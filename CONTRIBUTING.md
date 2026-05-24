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

## Commit message format

All commits must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. CI enforces this on every PR via `commitlint`.

```
<type>(<optional scope>): <short description>

[optional body]

[optional footer(s)]
```

### Allowed types

| Type | Use for |
|---|---|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `docs` | Documentation changes (non-DyKnow-maintained) |
| `wiki` | DyKnow-maintained wiki page updates (`docs/` changes) |
| `scan` | Scan / diff / snapshot artifact changes |
| `refactor` | Code restructuring with no behavior change |
| `perf` | Performance improvements |
| `test` | Adding or updating tests |
| `build` | Build system or dependency changes |
| `ci` | CI/CD pipeline changes |
| `chore` | Maintenance tasks (cleanup, version bumps) |
| `infra` | Infrastructure / tooling not covered by `build` or `ci` |
| `revert` | Reverting a previous commit |
| `style` | Code style / formatting (no logic change) |

### Examples

```
feat(scanner): extract OpenAPI route metadata from yaml specs
fix(review): skip action no longer mutates snapshot state
docs: add Phase 2 VS Code extension scaffold notes
wiki: update feature-map to mark dyknow status as implemented
test(update-runner): add classifyDraftRisk unit tests
ci: add commitlint job to PR workflow
```

### Breaking changes

Append `!` after the type/scope, or add a `BREAKING CHANGE:` footer:

```
feat(contracts)!: rename RiskLevel to RiskClassification

BREAKING CHANGE: RiskLevel is now exported as RiskClassification.
```

### CI enforcement

The `commit-lint` CI job runs on every PR and lints all commits from the PR base to the PR head. The job will fail if any commit message does not conform to the format above.

To check your messages locally before pushing:

```sh
npx commitlint --from HEAD~1 --to HEAD --verbose
```

## Pull request expectations

- One coherent change per PR.
- Commit messages must follow the conventional commit format (see above).
- PR title should also follow the format: `type(scope): description`.
- Body should answer: **what changed**, **why**, **which sources justify it**, **risk level** (low / medium / high).
- **High-risk content** (pricing, legal, security, compliance, customer commitments) requires named human review before merging — even if you are an LLM with merge rights.

## Running the lint checklist

Before any external release (public demo, pilot kickoff, marketing publish), run through [docs/lint.md](docs/lint.md) and append a `lint` entry to `docs/log.md`.

Eventually this will be the `dyknow lint` command. Today it is human-driven.

## Code contributions

The repo is now in Phase 1 with a working TypeScript workspace. For code changes:

1. `npm install` — install workspace dependencies.
2. `npm run build` — compile `packages/core` and `packages/cli`.
3. `npm test` — run all tests (Vitest).
4. `npm run lint` — run Biome checks.
5. Make your change in a feature branch.
6. Write or update tests — all PRs must keep the test suite green.
7. Follow the commit message format above.
8. Open a PR; CI runs lint, tests, build, security scan, and commit-lint.

See [AGENTS.md](AGENTS.md) for the full development command reference and coding standards.

## Questions

For schema or convention questions, open a PR with a proposed change to [CLAUDE.md](CLAUDE.md) and explain the reasoning. The schema is meant to evolve — but deliberately.
