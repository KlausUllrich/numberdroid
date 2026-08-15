# M4 — Procedural 2D Compositor

Status: **preferred next method for modular Transfer Hall architecture**

## Purpose

Build the final asset deterministically from:

- exact geometry;
- explicit topology/edge semantics;
- one or more authored/generated material textures;
- deterministic shading rules;
- optional semantic accents.

The core insight is:

> The material source does not need to know where the wall ends. The compositor knows.

This method stops asking an image model to simultaneously invent material, exact geometry and runtime neighbor semantics.

## Authority model

- `geometry.svg` owns shape;
- topology/connector metadata owns which edges continue and which terminate;
- material texture owns surface appearance only;
- compositor rules own outline/AO/highlight/shadow treatment;
- semantic colors remain explicit;
- runtime packing and QA remain deterministic.

## Target wall pipeline

```text
semantic wall kit
→ geometry masks
→ connector/exposed-edge classification
→ one calm graphite material texture
→ texture mapping into all wall masks
→ exposed-edge darkening / AO / restrained highlight
→ NO end treatment on connector boundaries
→ real cap treatment only on CAP_UP / CAP_DOWN terminations
→ connector canonicalization / exact seam QA
→ runtime atlas
```

## Why this should produce calmer walls

All pieces can draw from the **same material field** rather than asking the model to paint thirteen separate objects. This naturally reduces per-tile framing and visual noise.

The visible construction language is then applied consistently by code:

- homogeneous graphite body;
- broad low-frequency material variation;
- controlled darker outer contour;
- optional subtle inner highlight;
- AO/contact depth where architecturally justified;
- zero artificial cap/outline across runtime connector boundaries.

## Edge semantics

The compositor must distinguish at least:

```text
EXPOSED_MASK_EDGE
CONNECTOR_EDGE
TRUE_CAP_EDGE
OPTIONAL_EFFECT_EDGE
```

A tile's raw alpha silhouette is **not enough** to derive this information. For example, the left border of `H_TOP` is part of the isolated tile silhouette but is a runtime connector, not an architectural end.

This classification must come from the semantic kit/topology contract.

## Inputs

A mature recipe can use:

```text
geometry.svg
collision-core.svg               # optional
render-recipe.json
material-base.png
material-variant-*.png            # optional
material-reference.md
```

`render-recipe.json` should reference stable semantic tile names, not inferred occupancy alone.

## Proposed render-recipe responsibilities

Example conceptual fields:

```json
{
  "runtimeTile": 64,
  "material": "graphite-transfer-ship-v1",
  "materialMapping": "world-continuous",
  "edges": {
    "outerDarkPx": 3,
    "aoPx": 4,
    "innerHighlightPx": 1,
    "connectorTreatment": "none"
  },
  "connectors": "transfer-hall-wall-kit-v1"
}
```

The exact schema should evolve from implementation rather than being over-designed before the prototype.

## Material mapping modes

The compositor should eventually support more than one mapping strategy:

### World-continuous

All tiles sample from one larger material field using stable coordinates. Good for homogeneous architecture and reducing visible repetition.

### Tile-local

Each tile samples a local crop/variant. Useful when cells need controlled individual variation.

### Periodic/seamless

Material sampling wraps in both axes. Required for some floor/wall materials; see `../capabilities/seamless-materials.md`.

### Seeded variation

Deterministic offsets/rotations/low-frequency overlays vary repeated assets without making builds non-reproducible.

## Shading passes

Candidate deterministic passes, applied only through masks:

1. base material fill;
2. low-frequency value normalization;
3. exposed-edge outer darkening;
4. internal AO/distance-field darkening;
5. restrained inner highlight;
6. true-cap treatment;
7. semantic accent mask;
8. optional effect envelope;
9. alpha restore;
10. runtime packing.

Every pass must be independently inspectable during development.

## QA

M4 should enable stronger automated QA than M1/M2 alone:

- dimensions and atlas order;
- geometry mask equality;
- connector seam equality;
- negative-control seam metric;
- accidental alpha outside mask;
- exposed-edge versus connector-edge treatment checks;
- repeated assembly renders;
- deterministic output hash for fixed inputs/settings.

Visual QA remains mandatory; automation does not decide whether the art is beautiful.

## Good fits

- modular walls;
- doors and door pockets;
- architectural frames;
- sockets and floor interfaces;
- repeated consoles/panels with fixed geometry;
- materialized UI/environment frames;
- potentially floor tiles when their art can be decomposed into material + deterministic marks.

## Poor fits

- expressive characters;
- unique organic forms;
- objects whose appeal depends primarily on hand-painted shape invention;
- final hero paint-over that needs local artistic judgment.

Use M1 or M3 for those categories, possibly feeding results into M4 as textures/components.

## First prototype target

Do **not** begin with the complete Transfer Hall atlas.

Prototype in this order:

```text
1. H_TOP
2. H_TOP × 3 repeated run
3. CORNER_NW + straight neighbors
4. T_TOP_DOWN + divider
5. full 13-piece wall kit
6. live Transfer Hall
```

Acceptance for the first prototype:

- wall material reads calmer and more homogeneous than Walls v2;
- connectors contain no false end-outline;
- true exposed edges retain stable visual depth;
- a three-tile run reads as one continuous architectural wall;
- output is deterministic and reproducible.