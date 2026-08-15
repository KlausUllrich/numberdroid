# Approach 03 — Material Source + Procedural 2D Compositor

Status: **preferred next experiment for modular walls**

## Purpose

Stop asking a generative model to decide object-edge semantics that are already known deterministically.

Instead:

```text
semantic geometry
+ material source
+ exposed-edge masks
+ connector masks
+ shading recipe
        ↓
procedural compositor
        ↓
production asset
```

The generator or artist creates **material**, while the compositor creates the final object treatment.

## Core ownership model

### Deterministic system owns

- exact silhouette;
- tile/cell dimensions;
- connector positions;
- exposed versus connected edges;
- true terminations/caps;
- outline placement;
- AO/bevel/highlight bands;
- alpha;
- atlas packing;
- collision relationship.

### Material source owns

- surface grain;
- color/value variation;
- wear;
- subtle construction character;
- non-semantic texture detail.

## Why this is promising for Transfer Hall walls

The desired wall material is mostly shared across all wall pieces, while the visual edge treatment depends on assembly semantics.

A generator cannot reliably infer that `H_TOP.right` is a connector while another geometrically similar side may be a true exposed edge. The recipe already knows this.

Therefore the wall should be constructed from:

1. one or more high-quality **borderless graphite material swatches**;
2. a structural/visible wall mask;
3. an explicit connector mask;
4. an explicit exposed-edge mask;
5. deterministic dark outline / AO / restrained highlight treatment;
6. semantic connector canonicalization where required.

## Proposed wall compositor flow

```text
material-source.png
        ↓ map/tile/crop
wall semantic mask
        ↓
apply material inside wall
        ↓
compute exposed-edge distance field
        ↓
outer darkening / AO / optional highlight
        ↓
subtract connector-edge treatment
        ↓
cap-specific treatment
        ↓
semantic seam canonicalization
        ↓
64px runtime atlas
```

## Important principle

**A connector is not an edge for visual-outline purposes.**

Only exposed geometry receives closure/outline treatment. This should be explicit data, not inferred from raster occupancy after the fact.

## Candidate recipe fields

Future `render-recipe.json` may include fields such as:

```json
{
  "material": "transfer-graphite-v1",
  "materialMapping": "world-continuous-or-per-piece",
  "edge": {
    "outerDarkPx": 3,
    "innerAoPx": 5,
    "highlightPx": 1,
    "highlightStrength": 0.12
  },
  "connector": {
    "edgeTreatment": "none",
    "canonicalize": true
  },
  "shadow": {
    "mode": "inside-mask-only"
  }
}
```

Values are illustrative until validated visually.

## Material mapping choices to test

### Per-piece mapping

Each tile receives a crop/transform of the same material source.

Pros: easy, varied.
Cons: material pattern may jump at seams even if colors match.

### World-continuous mapping

Material coordinates are derived from world/atlas position so adjacent connected tiles sample one continuous texture field.

Pros: strongest continuity for long walls.
Cons: requires deterministic mapping and care around rotated semantic pieces.

### Canonical connector strips

Tile interiors vary, but connector guard regions share canonical material strips.

Pros: existing seam mechanism remains useful.
Cons: connector zones may look locally repetitive if too wide.

Test all three with negative-control seam metrics and live-room visual QA.

## Suitable asset classes

Strong fit:

- modular walls;
- architectural frames;
- doors and pockets;
- floor sockets/technical frames;
- some consoles or machine bases;
- state variants derived from the same geometry.

Partial fit:

- props where a deterministic base can be procedurally shaded then manually/generatively embellished;
- hero machines as a technical base pass.

Poor fit:

- organic/highly characterful silhouettes;
- character turnaround invention;
- unique illustrative props where surface layout is the design.

## Implementation target

Initial implementation should be small and dependency-light:

- Python;
- Pillow;
- NumPy if useful;
- SVG/mask inputs already stored in recipes;
- no GPU requirement.

First acceptance test:

1. one high-quality borderless graphite material source;
2. render `H_TOP`;
3. assemble `H_TOP × 3`;
4. render one corner and one T;
5. verify connector seams and exposed outlines;
6. compare against current live walls at gameplay scale.

Do not implement a general editor before this minimal proof works.
