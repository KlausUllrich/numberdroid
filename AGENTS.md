# AGENTS.md

## Purpose

This file is the entry point for every coding or art-production agent working on Numberdroid. Keep it short and durable. Detailed rules live in the structured documentation tree.

## Mandatory reading order

Before changing anything in the repository, read completely in this order:

1. `AGENTS.md`
2. `REPOSITORY_STRUCTURE.md`
3. `docs/agents/REPOSITORY_WORKFLOW.md`
4. `docs/agents/GAMEPLAY_AND_ENGINEERING_RULES.md`
5. the domain documents relevant to the task, following the indices in `docs/README.md`

For art work, additionally read:

- `docs/art-production-methods/README.md`
- the selected method folder
- the relevant `art-source/recipes/.../recipe.md`

Do not begin implementation from an old handoff, historical experiment, stale branch, or runtime PNG when a current contract/recipe exists.

## Source-of-truth model

Use these authorities:

- repository organization and file ownership: `REPOSITORY_STRUCTURE.md`
- durable gameplay/engineering invariants: `docs/agents/GAMEPLAY_AND_ENGINEERING_RULES.md`
- repository/GitHub workflow: `docs/agents/REPOSITORY_WORKFLOW.md`
- current production code: `src/`
- runtime/deploy assets: `public/` (outputs, not automatically authoring sources)
- art-production method selection: `docs/art-production-methods/`
- reproducible asset-specific art source: `art-source/recipes/`
- architecture/map contracts: `docs/architecture/`
- game design: `docs/game-design/`
- story/world: `docs/story/`
- historical handoffs/experiments: `docs/history/` — context only, never current authority unless a current document explicitly points to one

If two current authorities conflict, report the conflict rather than silently inventing a resolution.

## Repository workflow — hard rules

- `main` is canonical and should remain stable.
- Use focused branches/PRs for changes.
- For remote repository operations use the connected GitHub connector. Do not fall back to `git clone`, `git fetch`, `curl`, `wget`, or container-network workarounds.
- Do not mix broad repository reorganization with gameplay changes.
- Preserve `zahlenkern-prototyp-meta-v7.html` as the frozen behavioral reference; do not refactor it into production code.
- Before merging runtime changes, run the available tests and production build. Art changes must also run their relevant art QA scripts.
- Update the relevant current contract/recipe when a durable decision or accepted asset changes.

## Documentation discipline

New documentation must be placed according to `REPOSITORY_STRUCTURE.md`; do not add new project documents to the repository root unless that file is explicitly allowed there.

When a document becomes historical, move it to `docs/history/` instead of leaving multiple competing status documents beside current contracts.

Method-specific skills belong inside the corresponding method folder under `docs/art-production-methods/<method>/skill/`. Do not create a global skill that implies one art workflow is universal.
