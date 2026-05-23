---
name: dyknow-build-slice
description: 'Turn the DyKnow roadmap into a concrete implementation slice. Use for choosing the next Local CLI or shared-engine task, defining acceptance criteria, sequencing bootstrap work, or breaking Phase 0 and Phase 1 into small validated deliverables.'
argument-hint: 'Area to slice, such as bootstrap, page-definition, source-map, or dyknow init'
---

# DyKnow Build Slice

## When to Use

- Starting implementation in a new repo or package
- Choosing the next Phase 0 or Phase 1 task
- Turning roadmap bullets into code-ready work items
- Defining acceptance criteria before building

## Procedure

1. Read the relevant sections in `docs/implementation-roadmap.md`, `docs/roadmap.md`, `docs/architecture.md`, `docs/setup-guide.md`, and `docs/glossary.md`.
2. Classify the task as one of:
   - bootstrap and tooling
   - shared engine contract
   - Local CLI command
   - VS Code extension surface
3. If runtime choice, package manager, repo location, or test and lint setup is unresolved, treat that as the first blocking slice.
4. Choose one smallest deliverable with a clear input, output, and validation path.
5. Write acceptance criteria that include source evidence, confidence and risk handling, and failure modes where relevant.
6. Name the narrowest executable validation before any implementation begins.
7. List open questions separately so they do not leak into the implementation as assumptions.

## Output

Return:
- slice name
- why now
- likely files or packages affected
- acceptance criteria
- validation plan
- open questions