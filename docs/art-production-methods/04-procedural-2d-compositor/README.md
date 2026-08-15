# M4 — Procedural 2D Compositor

Status: **PROVEN / LIVE_ACCEPTED for TS-01 modular walls**

## Purpose

Build the final asset deterministically from:

- exact geometry;
- explicit topology/edge semantics;
- one or more authored/generated material textures;
- deterministic shading rules;
- optional semantic accents.

Core insight:

> The material source does not need to know where the wall ends. The compositor knows.

This method stops asking an image model to simultaneously invent material, exact geometry and runtime-neighbor semantics.

## Authority model

- `geometry.svg` owns shape;
- topology/connector metadata owns which edges continue and which terminate;
- material texture owns surface appearance only;
- compositor rules own outline/AO/highlight/shadow treatment;
- semantic colors remain explicit;
- runtime packing and QA remain deterministic.

## Proven TS-01 wall pipeline

```text
semantic wall kit
→ geometry masks
→ connector/exposed-edge classification
→ one calm graphite material field
→ texture/material mapping into all wall masks
→ exposed-edge darkening / AO / restrained highlight
→ NO end treatment on connector boundaries
→ real cap treatment only on genuine terminations
→ connector canonicalization / exact seam QA
→ runtime atlas
→ live gameplay QA
```

## Live validation — 2026-08-15

M4 was implemented for the complete 13-piece TS-01 wall kit and reviewed in the public Transfer Hall at gameplay scale.

Accepted result:

- 30 px visible fascia with unchanged 10 px collision core;
- wall mass fits the reference target;
- architecture reads homogeneous and visually subordinate;
- no visible T-junction/connector defects were observed;
- semantic seam canonicalization keeps required connector strips exact.

This changes M4 from an experiment into a **production-proven Numberdroid method for modular architecture with hidden topology semantics**.

Acceptance record: `../../art/transfer-hall/TRANSFER_HALL_WALL_COMPOSITOR_ACCEPTANCE_2026-08-15.md`.

## Why it produces calmer modular architecture

All pieces can draw from the same material family rather than asking a model to paint separate framed objects. The construction language is applied consistently by code:

- homogeneous material body;
- broad low-frequency surface variation;
- controlled darker exposed contour;
- optional restrained inner highlight;
- AO/contact depth where justified;
- zero artificial cap/outline across runtime connectors.

## Edge semantics

The compositor must distinguish at least:

```text
EXPOSED_MASK_EDGE
CONNECTOR_EDGE
TRUE_CAP_EDGE
OPTIONAL_EFFECT_EDGE
```

A tile's raw alpha silhouette is not enough. A cell-boundary edge may be part of the isolated silhouette while actually being a runtime continuation. Classification must come from semantic topology.

## Inputs

A mature recipe can use:

```text
geometry.svg
collision-core.svg               # optional
render-recipe.json
material-base.png                # optional authored/generated material
material-variant-*.png           # optional
topology.json                    # optional when not embedded in recipe
material-reference.md
```

`render-recipe.json` should reference stable semantic tile names, not inferred occupancy alone.

## Material mapping modes

### World-continuous

All tiles sample from one larger material field using stable coordinates. Good for homogeneous architecture and reducing visible repetition.

### Tile-local

Each tile samples a local crop/variant. Useful when cells need controlled individual variation.

### Periodic/seamless

Material sampling wraps in both axes. Required for some floor/wall materials; see `../capabilities/seamless-materials.md`.

### Seeded variation

Deterministic offsets/rotations/low-frequency overlays vary repeated assets without making builds non-reproducible.

## Shading passes

Candidate deterministic passes:

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

Every pass should remain independently inspectable during development.

## QA

M4 enables strong automated QA:

- dimensions and atlas order;
- geometry-mask equality;
- connector seam equality;
- negative-control seam metric;
- accidental alpha outside mask;
- exposed-edge versus connector-edge treatment checks;
- repeated assembly renders;
- deterministic output hash for fixed inputs/settings.

Visual QA remains mandatory; automation does not decide whether the art is good.

## Good fits

- modular walls;
- doors and door pockets;
- architectural frames;
- sockets and floor interfaces;
- repeated consoles/panels with fixed geometry;
- materialized UI/environment frames;
- potentially floor tiles when their art decomposes into material + deterministic marks.

## Poor fits

- expressive characters;
- unique organic forms;
- objects whose appeal depends primarily on free-form shape invention;
- final hero paint-over requiring local artistic judgment.

Use M1 or M3 for those categories, possibly feeding results into M4 as textures/components.

## Proven development sequence

The TS-01 proof succeeded by expanding in this order:

```text
1. H_TOP
2. H_TOP × 3 repeated run
3. CORNER_NW + straight neighbors
4. T_TOP_DOWN + divider
5. full 13-piece wall kit
6. live Transfer Hall
```

This sequence should be reused when adapting M4 to a new modular category: prove one simple element and one assembly before generating a complete kit.

## Next validation target

**Doors / door pockets / thresholds** are the next useful M4 test. They should prove whether the method generalizes beyond Walls while moving door leaves and runtime behavior remain separate systems.
