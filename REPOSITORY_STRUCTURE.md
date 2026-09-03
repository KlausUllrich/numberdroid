# Numberdroid Repository Structure

Status: **binding repository organization contract**

This file defines where project information belongs and which directories are authoritative for which concerns. It is mandatory reading for agents via `AGENTS.md`.

## Top-level structure

```text
/
├─ AGENTS.md                    # universal agent router / hard rules
├─ REPOSITORY_STRUCTURE.md      # this file; folder ownership and document taxonomy
├─ README.md                    # human-facing project overview
├─ package.json                 # build/test/dev entry points
├─ index.html / vite / tsconfig # application tooling
├─ zahlenkern-prototyp-meta-v7.html  # frozen prototype reference
├─ .github/                     # CI / GitHub automation
├─ .codex/                      # trusted repository-local Codex config and hooks
├─ .agent-context/              # ignored per-session agent continuity state
├─ src/                         # production application + compiler code
├─ public/                      # runtime/deploy assets only
├─ scripts/                     # deterministic build, art and validation tooling
├─ tools/                       # extractable local authoring applications
├─ art-source/                  # approved/current + reproducible + archived art-authoring sources
└─ docs/                        # current documentation plus explicit history
```

Do not add project-status, art-process, design, handoff, or research Markdown files directly to the repository root. The root is intentionally small.

## `src/` — production code

Contains the React/TypeScript game implementation. Current runtime behavior lives here; historical handoffs are not substitutes for inspecting current code.

### `src/levelgen/` — declarative Level Compiler

Owns the deterministic procedural/declarative level-authoring implementation:

- typed `LevelSpec` contracts;
- seed/sub-seed derivation;
- semantic graph/constraint validation;
- prop metadata registry;
- level-specific semantic specs under `src/levelgen/specs/`;
- future topology, wall, door, placement and event compile stages.

This is an authoring/compiler layer **before** the existing Tiled/`FloorDefinition` runtime boundary. It must not become a competing runtime renderer/state architecture.

## `public/` — runtime/deploy outputs

Contains files the built application loads directly.

Rules:
- `public/` answers **what the game loads**, not necessarily **how the asset is authored**;
- generated/materialized runtime images are outputs;
- approved high-resolution originals, source prompts/material references and authoring recipes belong in `art-source/`;
- some legacy source-like SVGs remain in `public/` because current reference coverage is not yet sufficient to remove them safely; clean them only in a dedicated runtime-reference audit.

## `art-source/` — art authoring source

```text
art-source/
├─ approved/                    # immutable approved high-quality sources + family derivatives
├─ recipes/                     # canonical source contract per current production asset/category
└─ archive/                     # superseded source artifacts retained only for historical/reference value
```

### `art-source/approved/`

Durable preservation archive for **Art-Director-approved high-resolution authoring sources**.

Approved sources are grouped by **Campaign Area** and then by **Asset Family**:

```text
art-source/approved/
├─ area-01-transfer-ship/
├─ area-02-deep-ocean/
├─ area-03-extreme-industry/
├─ area-04-moon-vacuum/
└─ area-05-bio-ark-primus/
```

Each Asset Family normally owns:

```text
<asset-family>/
├─ README.md       # manifest/provenance/relationships
├─ source/         # immutable byte-identical approved originals
├─ production/     # processed/crop/fit/runtime-source derivatives
├─ fx/             # related source-quality effects/components
└─ animation/      # later animation-authoring sources/exports
```

An Asset Family may represent one simple asset or several tightly related components that should remain together for future editing/animation. Example: `transfer-system/` contains the Transfer Apparatus, yellow Core and Transfer FX; PICO remains a separate Character lifecycle.

Binding preservation/process authority:

- `docs/art/production/APPROVED_SOURCE_ARCHIVE.md`
- `art-source/approved/README.md`
- binary publication: `docs/agents/BINARY_ASSET_TRANSPORT.md`

The approved original must remain unchanged. Runtime/downscaled derivatives never replace it as authoring authority.

### `art-source/recipes/`

Preferred source of truth for current/revisitable production art **process and reproducibility**. A recipe can contain deterministic geometry, collision geometry, topology, prompts, render settings, material references and an optional `source/` payload required for deterministic reconstruction.

Recipes explain how an asset is produced/revised. `art-source/approved/` preserves the actual approved source files. These roles are complementary, not duplicates.

### `art-source/archive/`

Historical authoring artifacts that still have reference/research value but are not current production authority. Do not start new production work here.

Intermediate/transport artifacts with no continuing reference value should be deleted once consumers are removed; Git history preserves them.

## `scripts/` — deterministic tooling

Contains repeatable processing and validation code.

```text
scripts/
├─ art/
│  └─ toolkit/                  # reusable method-agnostic art-processing primitives
├─ repo/                        # repository/transport preflights and guards
├─ validation/                  # reusable validators as this area grows
└─ <small project-specific scripts>
```

Rules:
- reusable deterministic mechanics belong under `scripts/art/toolkit/` when shared by multiple methods/categories;
- recipes may reference toolkit code but must not duplicate generic mechanics;
- asset-specific topology/settings remain with `art-source/recipes/`;
- model calls/prompts belong to methods/skills or recipes, not low-level toolkit modules;
- repository binary transport must follow the guards under `scripts/repo/` + `docs/agents/BINARY_ASSET_TRANSPORT.md`.
- repository-local Codex continuity helpers belong under `scripts/repo/`; their
  per-session path manifests belong only in ignored `.agent-context/` state.

## `tools/` — extractable authoring applications

Contains local authoring products whose lifecycle and dependency graph are deliberately separate from the game runtime.

### `tools/numberdroid-studio/`

Numberdroid Studio is the local-first visual asset, room and level-authoring product. Its requirements, architecture, application packages, development service and tests live together so the subtree can later move to a standalone repository.

Rules:
- Studio is not part of the root npm workspace or the game Vite/TypeScript build;
- Studio domain/application packages must not import Numberdroid runtime internals;
- only its future `packages/numberdroid-adapter/` may know Numberdroid compiler, repository or export contracts;
- Studio's local database/artifact data is never committed;
- GitHub remains an explicit export/publication boundary, not the interactive authoring store;
- Studio-specific product documentation belongs under `tools/numberdroid-studio/docs/`; root documentation should link rather than duplicate it.

## `docs/` — documentation taxonomy

```text
docs/
├─ README.md
├─ agents/                      # durable workflow, role-routing and handoff rules
├─ architecture/
├─ game-design/
├─ level-generation/            # Level Compiler / LevelSpec / authoring-system contract
├─ story/
├─ planning/
├─ decisions/
├─ art/
├─ art-production-methods/      # when/why; authority model and workflow selection
├─ art-production-toolkit/      # reusable tools, capabilities and usage
└─ history/
   └─ handoffs/                 # dated task snapshots; not current authority by default
```

### Current authority

- `docs/agents/ROLE_ENTRYPOINTS.md` — role/task reading router and cross-domain triggers;
- `docs/agents/HANDOFF_PROTOCOL.md` — how self-explanatory cross-role handoffs are written/consumed;
- `docs/agents/` — other durable agent/workflow rules;
- `docs/architecture/` — software/map/runtime architecture;
- `docs/game-design/` — current gameplay and spatial-design rules;
- `docs/level-generation/` — declarative level-authoring/compiler architecture and LevelSpec contract;
- `docs/story/` — current world/narrative contracts;
- `docs/planning/` — forward-looking plans;
- `docs/decisions/` — durable cross-cutting decisions;
- `docs/art/` — current art direction and production/category contracts;
- `docs/art-production-methods/` — how/why a production approach is selected;
- `docs/art-production-toolkit/` — what reusable deterministic tools can do and how to use them;
- `docs/history/` — evidence/history, never current authority by default.

## Role-aware reading

Repository taxonomy and reading scope are separate concerns. Files remain organized by domain, while `AGENTS.md` + `docs/agents/ROLE_ENTRYPOINTS.md` tell each task which domains are mandatory.

An Artist therefore does not automatically read all Story/Game Design. Those domains become mandatory through explicit triggers such as narrative-specific prop content, gameplay affordance changes or runtime integration changes.

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
art direction             → docs/art/
method selection          → docs/art-production-methods/
reusable mechanics        → docs/art-production-toolkit/ + scripts/art/toolkit/
approved source archive   → art-source/approved/
asset reproducibility     → art-source/recipes/
historical art source     → art-source/archive/
runtime output            → public/assets/...
```

For level generation:

```text
spatial rules         → docs/game-design/LEVEL_DESIGN_RULES.md
compiler contract     → docs/level-generation/
semantic level spec   → src/levelgen/specs/
compiler code         → src/levelgen/
runtime map contract  → docs/architecture/ + src/game/tiled.ts + FloorDefinition
```

For current task continuation:

```text
universal rules       → AGENTS.md + docs/agents/
forward plan          → docs/planning/
current contracts     → domain docs + code/recipes
named handoff         → docs/history/handoffs/ (task snapshot only)
```

## Move / rename discipline

When reorganizing files:

1. move information without changing its meaning unless deliberate;
2. update current cross-references in the same PR;
3. do not mix unrelated gameplay behavior changes into a structure-only PR;
4. run tests/build even for documentation/source moves because build scripts may reference files;
5. keep historical material only when it still adds useful evidence;
6. delete technical artifacts only after checking code/build references;
7. update this structure document if a new durable category is introduced.

## Branch and PR history

Branches/PRs are development history, not repository information architecture. Open PRs that predate a major structure change should be discussed individually: rebase/retarget, absorb unique content into the new structure, or close as superseded.
