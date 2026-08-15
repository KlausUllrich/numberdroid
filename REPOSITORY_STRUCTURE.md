# Numberdroid Repository Structure

Status: **binding repository organization contract**

This file defines where project information belongs and which directories are authoritative for which concerns. It is mandatory reading for agents via `AGENTS.md`.

## Top-level structure

```text
/
├─ AGENTS.md                    # short agent entry point / mandatory reading order
├─ REPOSITORY_STRUCTURE.md      # this file; folder ownership and document taxonomy
├─ README.md                    # human-facing project overview
├─ package.json                 # build/test/dev entry points
├─ index.html / vite / tsconfig # application tooling
├─ zahlenkern-prototyp-meta-v7.html  # frozen prototype reference
├─ .github/                     # CI / GitHub automation
├─ src/                         # production application code
├─ public/                      # runtime/deploy assets only
├─ scripts/                     # deterministic build, art and validation tooling
├─ art-source/                  # reproducible art-authoring sources
└─ docs/                        # current documentation plus explicit history
```

Do not add project-status, art-process, design, handoff, or research Markdown files directly to the repository root. The root is intentionally small.

## `src/` — production code

Contains the React/TypeScript game implementation.

Rules:
- current runtime behavior lives here;
- architecture changes must preserve the durable rules in `docs/agents/GAMEPLAY_AND_ENGINEERING_RULES.md`;
- do not use historical handoffs as a substitute for inspecting current code.

## `public/` — runtime/deploy outputs

Contains files the built application loads directly.

```text
public/
└─ assets/
   ├─ deck/
   └─ robots/
```

Rules:
- `public/` answers **what the game loads**, not necessarily **how the asset is authored**;
- generated/materialized runtime images are outputs;
- source SVGs, prompts, material references and authoring recipes should not be introduced here when they belong in `art-source/`;
- legacy source-like files already present in `public/` are technical debt to be migrated only in a dedicated cleanup pass with reference checks.

## `art-source/` — reproducible art source

```text
art-source/
├─ recipes/                     # canonical source contract per production asset/category
├─ flow-vorlagen/               # legacy deterministic templates; transitional
└─ runtime/                     # transitional text-safe binary transport/materialization sources
```

### `art-source/recipes/` — preferred source of truth

Every revisited/new production art category should get one recipe folder with the information needed to reproduce or deliberately revise the asset. The recipe states which method owns geometry, material, topology, finishing and QA.

### `flow-vorlagen/`

Historical predecessor of the recipe system. Keep only while existing recipes or research still require these templates. Do not add new unrelated production categories here.

### `runtime/`

Transitional storage used to reconstruct binary assets safely during builds. It is not a general art-source dumping ground. Remove obsolete entries only in a technical cleanup after proving nothing consumes them.

## `scripts/` — deterministic tooling

Contains repeatable processing and validation code.

```text
scripts/
├─ art/
│  └─ toolkit/                  # reusable method-agnostic art-processing primitives
├─ validation/                  # reusable validators as this area grows
└─ <small project-specific scripts>
```

Rules:
- reusable deterministic mechanics belong under `scripts/art/toolkit/` when they are shared by multiple methods/categories;
- production recipes may reference toolkit code but must not duplicate generic mechanics;
- asset-specific topology/settings remain with `art-source/recipes/`;
- model calls/prompts belong to methods/skills or recipes, not inside low-level deterministic toolkit modules.

## `docs/` — documentation taxonomy

```text
docs/
├─ README.md                    # documentation index
├─ agents/
├─ architecture/
├─ game-design/
├─ story/
├─ planning/
├─ decisions/
├─ art/
├─ art-production-methods/      # when/why; authority model and workflow selection
├─ art-production-toolkit/      # what reusable tools can do and how to call them
└─ history/
```

### `docs/agents/`

Durable rules agents must follow. These are mandatory after `AGENTS.md` and this structure file.

### `docs/architecture/`, `game-design/`, `story/`, `planning/`, `decisions/`

Current software/map contracts, gameplay design, world/story, forward plans and durable cross-cutting decisions respectively.

### `docs/art/`

Current art-direction and production contracts. Asset-specific reproducible source still belongs in `art-source/recipes/`, not in `docs/art/`.

### `docs/art-production-methods/` — method catalog

The canonical catalog for choosing **how an art problem should be produced and which stage owns which property**. Method-specific skills live beside their method under `skill/`.

### `docs/art-production-toolkit/` — reusable tool catalog

The canonical inventory for deterministic reusable art-processing capabilities. It documents each tool's status, inputs, outputs, authority, limitations, usage and QA.

Methods may compose several tools. A tool is not a method: background removal, mask operations, connector canonicalization or periodic-edge validation are reusable operations and should not create new production-method families by themselves.

### `docs/history/`

Historical material is preserved for learning but is not current authority. A current document may cite history as evidence, but new agents must not treat historical confident language as latest status.

## Root documentation policy

Only these project Markdown files should normally exist at repository root:

```text
README.md
AGENTS.md
REPOSITORY_STRUCTURE.md
```

Everything else belongs under `docs/` or `art-source/` according to ownership.

## Current authority examples

For art production:

```text
art direction        → docs/art/
method selection     → docs/art-production-methods/
reusable mechanics   → docs/art-production-toolkit/ + scripts/art/toolkit/
asset reproducibility→ art-source/recipes/
runtime output       → public/assets/...
```

## Move / rename discipline

When reorganizing files:

1. move information without changing its meaning unless deliberate;
2. update current cross-references in the same PR;
3. do not mix gameplay behavior changes into a structure-only PR;
4. run tests/build even for documentation moves because build scripts may reference files;
5. keep historical documents rather than deleting useful reasoning on the first cleanup pass;
6. delete technical artifacts only after checking code/build references;
7. update this structure document if a new durable top-level category is introduced.

## Branch and PR history

Branches/PRs are development history, not repository information architecture. Open PRs that predate a major structure change should be discussed individually: rebase/retarget, absorb unique content into the new structure, or close as superseded.
