# Asset Recipe — TS-01 Walls / Architecture

Status: `LIVE_ACCEPTED` — accepted in the public Transfer Hall on 2026-08-15.

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

The previous complete-wall image-edit approach is retired for Walls because an isolated generated piece cannot know which silhouette edges are runtime connectors and which are true exposed architectural edges.

Binding sources:
- `geometry.svg` — visible fascia master;
- `collision-core.svg` — unchanged gameplay core;
- `render-recipe.json` — material, shading and connector parameters;
- `scripts/render-transfer-hall-walls.mjs` — deterministic compositor;
- `scripts/validate-wall-seams.mjs` — automated semantic seam QA;
- `docs/art/transfer-hall/TRANSFER_HALL_WALL_KIT.md` — category contract.

## Separation of responsibility

```text
material source     -> surface variation only
geometry.svg        -> visible silhouette
collision-core.svg  -> gameplay collision contract
semantic topology   -> connector vs exposed vs true cap
compositor          -> material mapping + outline/AO + alpha
canonicalization    -> exact interchangeable connector strips
```

The generator/editor is no longer asked to decide topology-dependent wall edges.

## Current geometry

- tile: 64×64 px;
- visible fascia: **30 px**;
- collision core: **10 px**;
- outer wall visual mass expands inward;
- centered divider expands symmetrically around the existing collision axis;
- T and corner geometry remains deterministic;
- Door category remains separate.

## Material source

Current accepted material is generated deterministically by `scripts/render-transfer-hall-walls.mjs` from `render-recipe.json`.

It is intentionally borderless, neutral graphite/charcoal, low contrast, and free of wall-specific caps/outlines/vents/frames.

The material swatch is replaceable. A later image-generated, Invoke-created, hand-painted or editor-authored swatch may be substituted if it is edge-agnostic and passes material QA. Such a substitution is an intentional material revision, not routine cleanup.

A material swatch must never encode connector meaning, end caps, doorway semantics, collision geometry or scene lighting.

## Edge semantics

The compositor distinguishes:

- `EXPOSED` — real visible architectural boundary; receives restrained outline/AO;
- `CONNECTOR` — continuation into another tile; receives no endpoint treatment and uses a quiet guard zone;
- `TRUE_CAP` — genuine doorway-facing termination; reserved for Door-compatible treatment.

Connector relationships are defined by `docs/art/transfer-hall/TRANSFER_HALL_WALL_KIT.md` and `render-recipe.json`.

## Deterministic pipeline

```text
render-recipe.json
+ semantic mask/topology
→ build borderless material field
→ render each exact semantic tile mask
→ find exposed boundaries
→ suppress edge treatment at connector boundaries
→ apply restrained outline/AO
→ restore exact alpha
→ semantic median connector canonicalization
→ pack 13 active + 3 reserved cells
→ validate seams with negative control
→ live room QA
```

## Live acceptance — 2026-08-15

The public `?floor=transfer-hall` build was reviewed at PC gameplay scale after the 30 px M4 compositor pass.

User acceptance:

1. **Wall mass fits** the reference target.
2. Architecture reads **homogeneous and less visually important**, which is the intended hierarchy.
3. **No visible wall errors** were observed, including T-junction/connectors.

This validates the central M4 hypothesis for TS-01 walls:

> common material appearance and topology-dependent edge treatment should be separate responsibilities.

The accepted wall baseline is therefore the current 30 px procedural compositor output. Do not continue iterating Walls merely because a newer method or generator is available.

Reopen Walls only for one of these reasons:
- a concrete live visual defect is found;
- Door integration exposes a real wall/cap incompatibility;
- an explicitly approved material-quality upgrade is evaluated against the accepted baseline;
- broader Transfer Ship architecture requires a deliberate promotion/revision of the TS-01 kit.

See `docs/art/transfer-hall/TRANSFER_HALL_WALL_COMPOSITOR_ACCEPTANCE_2026-08-15.md` for the acceptance record.

## QA

Geometry:
- exact 256×256 atlas;
- exact 64×64 cells;
- exact 30 px visible fascia;
- collision still 10 px;
- cells 13–15 empty.

Material:
- homogeneous graphite family;
- architecture remains visually subordinate to focal objects;
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

## Learned method history

- M2 complete-wall material editing proved deterministic geometry + generative material can work, but failed as final Wall method because the model cannot infer runtime connector semantics from isolated silhouettes.
- Spaced generation layouts remain useful for separate object recognition, but still do not reveal connector meaning.
- Semantic connector canonicalization is retained after compositing.
- M4 is live-accepted for TS-01 Walls: one shared material family plus deterministic exposed/connector edge semantics produced the desired calm, substantial wall hierarchy.

See `docs/art-production-methods/README.md` for the current method catalog. Historical experiments live under `docs/history/`.
