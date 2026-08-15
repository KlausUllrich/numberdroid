# Asset Recipe — TS-01 Walls / Architecture

Status: `PROCEDURAL_COMPOSITOR_PROVEN` — pending final live visual acceptance.

## Identity

- Slice/world: TS-01 Transfer Hall / Transfer Ship
- Category: modular Architecture wall kit
- Runtime: 4×4 atlas, 64×64 px cells, 256×256 px total
- Runtime asset: `public/assets/deck/transfer-hall-architecture.png`
- GIDs: 81–93 active, 94–96 reserved
- Perspective: strict orthographic top-down
- Background: transparent outside wall geometry

## Primary method

**M4 — Material Source + Procedural 2D Compositor**

The previous full-object image-edit approach is retired for Walls because an isolated generated wall piece cannot know which silhouette edges are runtime connectors and which are true exposed architectural edges.

Binding implementation:
- `geometry.svg` — 30 px visible fascia master;
- `collision-core.svg` — unchanged 10 px gameplay core;
- `render-recipe.json` — material, shading and connector parameters;
- `scripts/render-transfer-hall-walls.mjs` — deterministic compositor;
- `scripts/validate-wall-seams.mjs` — automated semantic seam QA.

## Core separation of responsibility

```text
material source     -> surface variation only
geometry.svg        -> visible silhouette
collision-core.svg  -> gameplay collision contract
semantic topology   -> connector vs exposed vs true cap
compositor          -> material mapping + outline/AO + alpha
canonicalization    -> exact interchangeable connector strips
```

The generator/editor is no longer asked to decide topology-dependent wall edges.

## Current visible geometry

- tile: 64×64 px;
- visible fascia: **30 px**;
- collision core: **10 px**;
- outer wall visual mass expands inward;
- centered divider expands symmetrically around the existing collision axis;
- T and corner geometry remains deterministic;
- Door category remains separate.

The move from 24 to 30 px follows live QA against the approved reference: the architecture should feel more stable/substantial and less like a thin rail.

## Material source

Current proof material is generated deterministically by `render-transfer-hall-walls.mjs` from `render-recipe.json`.

It is intentionally:
- borderless;
- neutral graphite/charcoal;
- low contrast;
- free of wall-specific caps, outlines, vents and frames.

This procedural swatch is replaceable. A later image-generated, Invoke-created, hand-painted or Photoshop-authored swatch may be substituted if it is edge-agnostic and passes material QA.

A material swatch must never encode:
- which edge is a connector;
- per-tile frame borders;
- end caps;
- doorway semantics;
- collision geometry;
- scene lighting.

## Edge semantics

The compositor derives three conceptual classes:

- `EXPOSED` — real visible architectural boundary; receives restrained outline/AO;
- `CONNECTOR` — continuation into another tile; receives no endpoint treatment and uses a quiet guard zone;
- `TRUE_CAP` — genuine doorway-facing termination; reserved for compact Door-compatible treatment.

Connector relationships are the named groups in `TRANSFER_HALL_WALL_KIT.md` and `render-recipe.json`.

## Current compositor recipe

`render-recipe.json` currently controls:
- fascia/collision sizes;
- material seed and value range;
- outline width/darkening;
- AO radius/darkening;
- subtle inner lift;
- connector quiet-zone width;
- named connector groups.

Current material mapping uses one shared coordinate space across all wall pieces to prevent automatic per-tile panel changes. Deliberate variants may be added later, but not by random per-tile offsets.

## Deterministic pipeline

```text
render-recipe.json
+ semantic mask/topology
→ build borderless material field
→ render each exact semantic tile mask
→ find exposed boundaries
→ suppress edge treatment at connector boundaries
→ apply restrained interior outline/AO
→ restore exact alpha
→ semantic median connector canonicalization
→ pack 13 active + 3 reserved cells
→ validate seams with negative control
→ live room QA
```

## QA requirements

Geometry:
- exact 256×256 atlas;
- exact 64×64 cells;
- exact 30 px visible fascia;
- collision still 10 px;
- cells 13–15 empty.

Material:
- homogeneous graphite family;
- wall is background architecture rather than focal object;
- no silver per-tile frame;
- no obvious texture reset at every tile;
- no cyan/hazard decoration.

Topology:
- no closing outline on connectors;
- corners/Ts are continuous masses;
- no black T fragment;
- only true caps may terminate visibly.

Seams:
- `npm run validate-art-seams`;
- always report SAME-TYPE against DIFF-TYPE negative control;
- target SAME-TYPE = 0 after canonicalization.

Live:
- compare 3× straight run, corners, T, divider/door gap and full TS-01 against the approved reference.

## History / learned approaches

- M2 complete-wall material editing: proved that deterministic geometry + generative material can work, but failed as final wall method because the model cannot infer runtime connector semantics from isolated silhouettes.
- Spaced generation layouts: useful when separate object recognition is needed, but still do not tell a model which isolated edge is a connector.
- Semantic connector canonicalization: retained and now used after compositing.
- M4 compositor: first proof demonstrated that one material can be mapped to continuous H/CORNER/T geometry while outlines/AO are applied only to true exposed edges.

See `docs/art-production-methods/README.md` for the method matrix.
