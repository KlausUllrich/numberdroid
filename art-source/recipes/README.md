# Numberdroid Art Recipe Library

This directory stores the reproducible source contract for authored/generated gameplay art.

The purpose is simple: a production asset must not exist only as a PNG plus lost chat context. The repository should retain enough information for a later Artist agent to reproduce or deliberately revise it.

## Method selection comes first

Before preparing or generating an asset, choose the production method from:

`docs/art-production-methods/README.md`

The recipe must record which method owns geometry, topology, material and optional finishing. This is especially important for hybrid pipelines.

Example:

```text
Primary production method: M4 Procedural 2D Compositor
Material/source method: M1 Direct Generative Source
Optional finishing method: M3 Layered Raster Editor
```

Do not leave the method implicit in chat history or assume every asset should use the latest wall workflow.

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
8. Runtime PNG/WebP assets are outputs, not the source of truth.

Characters are a deliberate exception: an authored eight-direction turnaround is not reduced to a rigid SVG silhouette merely for consistency. Character recipes may omit `geometry.svg` and instead preserve frame order, scale, reference/source and generation prompt.

## Lifecycle

Before generating a new production category, create or update its recipe to at least `PREPARED` status. After visual acceptance, update the recipe with the accepted material reference, prompt, deterministic processing and QA result.

Do not invent placeholder SVGs for assets whose geometry has not yet been art-directed. A `PLANNED` recipe is preferable to a fake geometry master.

## Legacy flow templates

`art-source/flow-vorlagen/` predates this library. Existing accepted templates remain valid. As categories are revisited, their authoritative files should be referenced or migrated into a recipe folder rather than duplicated without purpose.
