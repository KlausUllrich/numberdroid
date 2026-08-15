# M4 — Procedural 2D Compositor

Status: **PROVEN / LIVE_ACCEPTED for TS-01 modular walls**

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

## Proven TS-01 wall pipeline

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
→ live gameplay QA
```

## Live validation — 2026-08-15

M4 was implemented for the complete 13-piece TS-01 wall kit and reviewed in the public Transfer Hall at gameplay scale.

Accepted result:

- **30 px visible wall mass fits** the approved reference target;
- walls read **homogeneous and visually subordinate** to PICO / focal objects;
- **no visible connector, corner or T-junction errors** were observed;
- gameplay collision remains the separate **10 px core**;
- automated semantic seam QA remains exact after canonicalization.

This is the first Numberdroid method family that has moved from hypothesis to live acceptance for a complete modular environment category.

The important validated principle is:

> For topology-aware modular architecture, generate/authenticate the material separately and let deterministic code own the silhouette and edge semantics.

## Why this produces calmer walls

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

## Render-recipe responsibilities

The TS-01 implementation established these useful responsibilities:

```text
runtime tile / atlas geometry
visible fascia versus collision size
material generation/source configuration
material coordinate mapping
outline width / value change
AO radius / value change
inner lift/highlight
connector quiet zone
named semantic connector groups
packing order
```

Do not move hidden topology back into the material source.

## Material mapping modes

The compositor should eventually support more than one mapping strategy:

### World-continuous

All tiles sample from one larger material field using stable coordinates. Good for homogeneous architecture and reducing visible repetition.

This is the preferred TS-01 wall behavior.

### Tile-local

Each tile samples a local crop/variant. Useful when cells need controlled individual variation, but it can accidentally reintroduce visible tile boundaries.

### Periodic/seamless

Material sampling wraps in both axes. Required for some floor/wall materials; see `../capabilities/seamless-materials.md`.

### Seeded variation

Deterministic offsets/rotations/low-frequency overlays vary repeated assets without making builds non-reproducible. Use only when the variation survives repetition QA without making tiles read as separate panels.

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
10. connector canonicalization;
11. runtime packing.

Every pass should be independently inspectable during development.

## QA

M4 enables stronger automated QA than M1/M2 alone:

- dimensions and atlas order;
- geometry mask equality;
- connector seam equality;
- negative-control seam metric;
- accidental alpha outside mask;
- exposed-edge versus connector-edge treatment checks;
- repeated assembly renders;
- deterministic output hash for fixed inputs/settings.

Visual QA remains mandatory; automation does not decide whether the art is beautiful.

For a live-accepted category, do not continue tweaking merely because numeric QA permits it. Preserve the accepted baseline and reopen only for a concrete defect or deliberate bounded upgrade.

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

## Prototype sequence — validated

The original prototype sequence was:

```text
1. H_TOP
2. H_TOP × 3 repeated run
3. CORNER_NW + straight neighbors
4. T_TOP_DOWN + divider
5. full 13-piece wall kit
6. live Transfer Hall
```

All six stages have now been completed for TS-01 Walls. The final live acceptance is recorded in `docs/TRANSFER_HALL_WALL_COMPOSITOR_ACCEPTANCE_2026-08-15.md`.

The next useful test of M4 is **not another wall iteration**. It is applying the same authority model to a different suitable category, especially Door architecture/pockets, while keeping moving door behavior separate.
