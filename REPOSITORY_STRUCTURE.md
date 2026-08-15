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

Every revisited/new production art category should get a recipe folder containing the information needed to reproduce or deliberately revise the asset:

```text
art-source/recipes/<world>/<asset>/
├─ recipe.md
├─ geometry.svg                 # when deterministic geometry applies
├─ collision-core.svg           # optional
├─ material-reference.md        # optional
├─ prompt.md                    # optional
├─ render-recipe.json           # optional compositor settings
├─ topology.json                # optional modular semantics
└─ reference.*                  # optional, only when appropriate to store
```

The recipe states which method owns geometry, material, topology, finishing and QA.

### `flow-vorlagen/`

Historical predecessor of the recipe system. Keep only while existing recipes or research still require these templates. Do not add new unrelated production categories here.

### `runtime/`

Transitional storage used to reconstruct binary assets safely during builds. It is not a general art-source dumping ground. Remove obsolete entries only in a technical cleanup after proving nothing consumes them.

## `scripts/` — deterministic tooling

Contains repeatable processing and validation code.

Preferred organization as the toolset grows:

```text
scripts/
├─ art/                         # reusable art/compositor helpers
├─ validation/                  # reusable validators
└─ <small project-specific scripts>
```

A production recipe may reference a script, but reusable mechanics should not be duplicated inside individual recipe folders.

## `docs/` — documentation taxonomy

```text
docs/
├─ README.md                    # documentation index
├─ agents/
│  ├─ REPOSITORY_WORKFLOW.md
│  └─ GAMEPLAY_AND_ENGINEERING_RULES.md
├─ architecture/
├─ game-design/
├─ story/
├─ planning/
├─ decisions/
├─ art/
│  ├─ direction/
│  ├─ production/
│  └─ transfer-hall/
├─ art-production-methods/
└─ history/
   ├─ handoffs/
   ├─ experiments/
   └─ art-pipeline-legacy/
```

### `docs/agents/`

Durable rules agents must follow. These are mandatory after `AGENTS.md` and this structure file.

### `docs/architecture/`

Current software, map, data and runtime architecture contracts. Examples: Tiled map contract, robot body sizing, application architecture.

### `docs/game-design/`

Current gameplay design and progression rules: encounters, learning profiles, menus, campaign/gameplay progression.

### `docs/story/`

World, fiction and narrative progression contracts.

### `docs/planning/`

Forward-looking development plans. Plans are subordinate to current code/contracts and should be revised rather than multiplied when they become stale.

### `docs/decisions/`

Cross-cutting durable decision records.

### `docs/art/`

Current art-direction and production contracts.

- `direction/` — what the world should look/feel like;
- `production/` — cross-category art production/QA rules;
- `transfer-hall/` — TS-01-specific layer, wall, floor and Gold-Slice contracts.

Asset-specific reproducible source still belongs in `art-source/recipes/`, not in `docs/art/`.

### `docs/art-production-methods/` — method catalog

The canonical catalog for choosing **how** an art problem should be produced.

Each method may contain:

```text
<method>/
├─ README.md
├─ research/
├─ scripts/
├─ demos/
├─ materials/
├─ schemas/
└─ skill/                       # optional method-specific agent skill(s)
```

Method-specific skills live here because a skill is an executable/operational specialization of a method, not a universal art authority.

Current methods include direct generative source, controlled art pass, layered raster editor/MCP, and procedural 2D compositor. Add methods when a genuinely different authority model is needed rather than stretching one workflow to every asset type.

### `docs/history/`

Historical material is preserved for learning but **is not handlungsleitend/current authority**.

- `handoffs/` — old session/agent handoffs and prompts;
- `experiments/` — dated experiments, breakthroughs and rejected/obsolete approaches;
- `art-pipeline-legacy/` — superseded duplicate art-pipeline handbook retained temporarily so unique learnings can be harvested before deletion.

A current document may cite history as evidence, but a new agent must not treat a history file as the latest status merely because it contains confident language.

## Root documentation policy

Only these project Markdown files should normally exist at repository root:

```text
README.md
AGENTS.md
REPOSITORY_STRUCTURE.md
```

Everything else belongs under `docs/` or `art-source/` according to ownership.

## Current authority examples

For Transfer Hall art:

```text
visual direction
  → docs/art/direction/ART_DIRECTION_TRANSFER_SHIP.md

cross-category production/QA
  → docs/art/production/

method selection
  → docs/art-production-methods/README.md

TS-01 category contract
  → docs/art/transfer-hall/

asset reproducibility
  → art-source/recipes/transfer-hall/<asset>/

runtime output
  → public/assets/...
```

## Move / rename discipline

When reorganizing files:

1. move information without changing its meaning unless the change is deliberate;
2. update current cross-references in the same PR;
3. do not mix gameplay behavior changes into a structure-only PR;
4. run tests/build even for documentation moves because build scripts may reference files;
5. keep historical documents rather than deleting useful reasoning on the first cleanup pass;
6. delete technical artifacts only after checking code/build references;
7. update this structure document if a new durable top-level category is introduced.

## Branch and PR history

Branches/PRs are development history, not repository information architecture. Do not keep stale files merely because an old PR references their old path. Git history preserves the old layout.

Open PRs that predate a major structure change should be discussed individually: rebase/retarget, absorb their unique content into the new structure, or close as superseded. Do not blindly merge an old documentation PR after paths have been reorganized.
