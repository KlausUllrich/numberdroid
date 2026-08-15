# Approach 02 — Spaced Generation Layout

Status: **validated as a generation-layout improvement; not a complete art method**

## Purpose

Prevent adjacent production-atlas cells from visually merging during an image-edit/material pass.

The runtime atlas and the generation sheet deliberately use different layouts.

```text
compact runtime atlas
        ↓ expand
isolated generation cells + transparent gutters
        ↓ image edit
extract each generation cell
        ↓
mask restore / postprocess
        ↓ repack
compact runtime atlas
```

## Why it exists

In a compact atlas, connectable cells may physically touch at the atlas cell boundary. The image generator sees only raster pixels, not our invisible tile-grid semantics, and may interpret several cells as one large object.

Transparent gutters make each cell legible as a separate component.

## Validated Transfer Hall setup

For Walls v3 test:

- runtime tile: `64×64`;
- generation cell: `256×256`;
- visible wall fascia: `24 px runtime = 96 px generation`;
- gutter: `64 px` transparent;
- 4×4 semantic kit, with reserved cells left empty.

The generator successfully perceived the 13 active pieces as distinct shapes rather than one fused atlas mass.

## What it solves

- accidental fusion of neighboring atlas cells;
- ambiguous individual silhouettes caused by compact packing;
- style pass contamination across immediately touching atlas cells;
- allows one generation call to see multiple variants while retaining separation.

## What it does NOT solve

It does **not** tell the model whether a visible cell edge is:

- an exposed architectural edge;
- a connector to a neighbor;
- a genuine termination/cap;
- a hidden seam that should have no outline.

This distinction is semantic and must come from the recipe/post-processing pipeline.

The Walls v3 material-pass experiment demonstrated the limitation: the model created attractive bright perimeter frames around isolated shapes because, from its perspective, those were standalone objects.

## Rule

Treat `generation-layout.svg/png` as a **presentation of geometry to the generator**, not as the production geometry authority.

Each recipe may therefore contain both:

```text
geometry.svg              # compact/runtime geometry authority
generation-layout.svg     # separated edit layout
generation-layout.png     # derived raster edit target
```

After generation, cells are deterministically mapped back to `geometry.svg` semantics.

## When to use

Use as an auxiliary technique when:

- multiple components should share one broad material/style pass;
- compact atlas packing makes shapes touch or visually merge;
- cell order must survive generation/extraction.

Do not select this as the only solution to connector continuity, seamlessness or exposed-edge logic.

## Future extensions

Possible improvements to test later:

- variable gutter sizes;
- generation layout ordered by semantic family rather than runtime ID;
- explicit neutral guide background versus alpha;
- per-cell metadata stored outside the raster image;
- separate sheets for connectors and caps if model behavior benefits from semantic grouping.
