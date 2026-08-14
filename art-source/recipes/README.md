# Numberdroid Art Recipe Library

This directory stores the reproducible source contract for authored/generated gameplay art.

The purpose is simple: a production asset must not exist only as a PNG plus lost chat context. The repository should retain enough information for a later Artist agent to reproduce or deliberately revise it.

## Folder contract

Each production asset/category gets one recipe folder:

```text
art-source/recipes/<world-or-slice>/<asset-name>/
  recipe.md
  geometry.svg              # when deterministic geometry applies
  collision-core.svg        # optional, when collision differs from visible geometry
  material-reference.md     # approved material/style source(s)
  prompt.md                 # last approved generation/edit prompt
  reference.*               # optional image only when rights/source are clear and repo storage is useful
```

Not every asset needs every file. The recipe must say explicitly when a file is not applicable.

## Authority

For geometry-critical environment art:

1. `geometry.svg` owns visible production geometry/masks/connectors.
2. `collision-core.svg`, when present, owns the collision-corresponding structural core.
3. `material-reference.md` identifies the visual material source; it does not own geometry.
4. `prompt.md` records the approved image-generation/edit instruction.
5. `recipe.md` owns runtime size, atlas order, post-processing, semantic connectors and QA.
6. Runtime PNG/WebP assets are outputs, not the source of truth.

Characters are a deliberate exception: an authored eight-direction turnaround is not reduced to a rigid SVG silhouette merely for consistency. Character recipes may omit `geometry.svg` and instead preserve frame order, scale, reference/source and generation prompt.

## Lifecycle

Before generating a new production category, create or update its recipe to at least `PREPARED` status. After visual acceptance, update the recipe with the accepted material reference, prompt, deterministic processing and QA result.

Do not invent placeholder SVGs for assets whose geometry has not yet been art-directed. A `PLANNED` recipe is preferable to a fake geometry master.

## Legacy flow templates

`art-source/flow-vorlagen/` predates this library. Existing accepted templates remain valid. As categories are revisited, their authoritative files should be referenced or migrated into a recipe folder rather than duplicated without purpose.
