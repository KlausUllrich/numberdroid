# Numberdroid Art Recipe Library

This directory stores the reproducible source contract for authored/generated gameplay art.

The purpose is simple: a production asset must not exist only as a PNG plus lost chat context. The repository should retain enough information for a later Artist agent to reproduce or deliberately revise it.

## Method selection comes first

Before preparing or generating an asset, choose the production method from `docs/art-production-methods/README.md` and record which method owns geometry, topology, material and optional finishing.

Do not assume every asset should use the latest wall workflow.

## Folder contract

Each production asset/category gets one recipe folder:

```text
art-source/recipes/<world-or-slice>/<asset-name>/
  recipe.md
  geometry.svg              # when deterministic geometry applies
  collision-core.svg        # optional, when collision differs from visible geometry
  material-reference.md     # approved material/style source(s)
  prompt.md                 # approved generation/edit/material prompt when applicable
  render-recipe.json        # optional deterministic compositor/render settings
  topology.json             # optional explicit modular edge/connectivity semantics
  source/                   # optional accepted source payload when build/reproduction requires it
  reference.*               # optional image only when rights/source are clear and repo storage is useful
```

Not every asset needs every file. The recipe must say explicitly when a file is not applicable.

## Authority

For geometry-critical environment art:

1. `geometry.svg` owns visible production geometry/masks/connectors unless the recipe explicitly assigns a different deterministic source.
2. `collision-core.svg`, when present, owns the collision-corresponding structural core.
3. topology/connector metadata or the category contract owns neighbor/edge semantics; generated silhouette does not.
4. `material-reference.md` identifies the visual material source; it does not own geometry.
5. `prompt.md` records the approved generation/edit/material instruction when generation is part of the method.
6. `render-recipe.json`, when present, owns deterministic compositor settings.
7. `recipe.md` owns runtime size, method selection, atlas order, post-processing, semantic connectors and QA.
8. `source/`, when present, stores an accepted source payload required for deterministic reconstruction; it must be described and validated by the recipe.
9. Runtime PNG/WebP assets are outputs, not automatically the source of truth.

Characters are a deliberate exception: an authored eight-direction turnaround is not reduced to a rigid SVG silhouette merely for consistency. Character recipes may instead preserve frame order, scale, source payload and generation/production process.

## Lifecycle

Before generating a new production category, create or update its recipe to at least `PREPARED` status. After visual acceptance, update the recipe with the accepted source/material reference, deterministic processing and QA result.

Do not invent placeholder SVGs for assets whose geometry has not yet been art-directed. A `PLANNED` recipe is preferable to a fake geometry master.

## Historical sources

Superseded source artifacts that still carry useful research/history value belong under `art-source/archive/`. They are not current production authority.

Do not create new work under the old `flow-vorlagen` convention. Current deterministic geometry belongs with its asset recipe.
