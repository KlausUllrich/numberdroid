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
├─ src/                         # production application code
├─ public/                      # runtime/deploy assets only
├─ scripts/                     # deterministic build, art and validation tooling
├─ art-source/                  # reproducible/current + archived art-authoring sources
└─ docs/                        # current documentation plus explicit history
```

Do not add project-status, art-process, design, handoff, or research Markdown files directly to the repository root. The root is intentionally small.

## `src/` — production code

Contains the React/TypeScript game implementation. Current runtime behavior lives here; historical handoffs are not substitutes for inspecting current code.

## `public/` — runtime/deploy outputs

Contains files the built application loads directly.

Rules:
- `public/` answers **what the game loads**, not necessarily **how the asset is authored**;
- generated/materialized runtime images are outputs;
- source prompts/material references/authoring recipes belong in `art-source/`;
- some legacy source-like SVGs remain in `public/` because current reference coverage is not yet sufficient to remove them safely; clean them only in a dedicated runtime-reference audit.

## `art-source/` — art authoring source

```text
art-source/
├─ recipes/                     # canonical source contract per current production asset/category
└─ archive/                     # superseded source artifacts retained only for historical/reference value
```

### `art-source/recipes/`

Preferred source of truth for current/revisitable production art. A recipe can contain deterministic geometry, collision geometry, topology, prompts, render settings, material references and an optional `source/` payload required for deterministic reconstruction.

Source payloads should live with the asset they reconstruct rather than in a generic runtime transport folder.

### `art-source/archive/`

Historical authoring artifacts that still have reference/research value but are not current production authority. Do not start new production work here.

Intermediate/transport artifacts with no continuing reference value should be deleted once consumers are removed; Git history preserves them.

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
- reusable deterministic mechanics belong under `scripts/art/toolkit/` when shared by multiple methods/categories;
- recipes may reference toolkit code but must not duplicate generic mechanics;
- asset-specific topology/settings remain with `art-source/recipes/`;
- model calls/prompts belong to methods/skills or recipes, not low-level toolkit modules.

## `docs/` — documentation taxonomy

```text
docs/
├─ README.md
├─ agents/                      # durable workflow, role-routing and handoff rules
├─ architecture/
├─ game-design/
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
- `docs/game-design/` — current gameplay design/progression;
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
art direction         → docs/art/
method selection      → docs/art-production-methods/
reusable mechanics    → docs/art-production-toolkit/ + scripts/art/toolkit/
asset reproducibility → art-source/recipes/
historical art source → art-source/archive/
runtime output        → public/assets/...
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
3. do not mix gameplay behavior changes into a structure-only PR;
4. run tests/build even for documentation/source moves because build scripts may reference files;
5. keep historical material only when it still adds useful evidence;
6. delete technical artifacts only after checking code/build references;
7. update this structure document if a new durable category is introduced.

## Branch and PR history

Branches/PRs are development history, not repository information architecture. Open PRs that predate a major structure change should be discussed individually: rebase/retarget, absorb unique content into the new structure, or close as superseded.
