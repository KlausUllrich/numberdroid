# Asset Recipe — TS-01 Walls / Architecture

Status: `PREPARED` for procedural-compositor prototype.

## Identity

- Slice/world: TS-01 Transfer Hall / Transfer Ship
- Category: modular Architecture wall kit
- Runtime target: 4 columns × 4 rows, 64×64 px cells, 256×256 px atlas
- Runtime asset: `public/assets/deck/transfer-hall-architecture.png`
- GIDs: 81–93 active, 94–96 reserved
- Perspective: strict orthographic top-down
- Background: transparent outside visible wall geometry

## Production method

- Primary production method: **M4 Procedural 2D Compositor**
- Material/source method: **M1 Direct Generative Source** for one edge-agnostic graphite material swatch, or an authored equivalent
- Optional finishing method: **M3 Layered Raster Editor / MCP** later, only if local paint-over is useful and a reliable editor integration exists
- Retired primary method: **M2 Controlled Art Pass** on complete wall pieces; preserved in `prompt-m2-wall-edit-retired.md`

Why: the wall kit requires exact modular geometry **and** topology-dependent edge treatment. A separated generative wall sheet can distinguish pieces, but cannot know which isolated silhouette boundaries are runtime connectors versus true architectural terminations. M4 keeps that knowledge deterministic.

See `docs/art-production-methods/README.md` and `docs/art-production-methods/04-procedural-2d-compositor/README.md`.

## Source authority

- Visible geometry: `geometry.svg` — current 24 px visible fascia
- Collision/structural core: `collision-core.svg` — binding 10 px gameplay core
- Topology / connector semantics: `TRANSFER_HALL_WALL_KIT.md` + `docs/SEMANTIC_CONNECTOR_CANONICALIZATION.md`
- Material reference: `material-reference.md`
- Current material-source generation prompt: `prompt.md`
- Historical M2 wall-object prompt: `prompt-m2-wall-edit-retired.md`
- Render/compositor recipe: pending first prototype; add `render-recipe.json` only once the implementation fields are proven

The older `art-source/flow-vorlagen/transfer-hall-wall-blueprint.svg` remains the historical 10 px geometry proof. This recipe is the clearer source for the current separated 24 px visual / 10 px collision contract.

## Visual target

Walls are a quiet, substantial dark frame around the bright ceramic room. Compared with Walls v2 they should become:

- visually heavier and closer to the approved reference;
- more homogeneous and less segmented;
- lower in local contrast;
- less metallic-highlight driven;
- stable architectural masses rather than individually framed wall props;
- clearly darker than the floor while remaining maintained civilian infrastructure.

The wall is not a hero asset. PICO, door operation, personal props and the Transfer apparatus must attract more attention.

## M4 processing target

The compositor should eventually execute the following deterministic pipeline:

1. Load/rasterize `geometry.svg` at exact runtime or controlled working resolution.
2. Load one approved graphite material source that contains **no object outline or cap semantics**.
3. Map the material into the complete semantic wall kit. Prefer a shared/world-continuous material field for homogeneity; keep mapping deterministic.
4. Derive or load explicit edge classes from the semantic kit:
   - `EXPOSED`
   - `CONNECTOR`
   - `TRUE_CAP`
5. Apply low-contrast dark outer contour / AO only to true exposed architectural edges.
6. Apply **no end-cap / closing outline treatment** across connector boundaries.
7. Apply true termination treatment only on the doorway-facing ends of `CAP_DOWN` and `CAP_UP`.
8. Reapply exact visible geometry alpha.
9. Apply semantic connector canonicalization if any material boundary variation remains at continuation edges.
10. Pack exact 64×64 cells into the 256×256 atlas.
11. Run automated seam QA with DIFF-TYPE negative control.
12. Assemble straight, corner, T, divider/cap and actual TS-01 layouts.
13. Integrate and perform live browser QA.

The 10 px collision system in `src/game/maps/transferHall.ts` does not change when visible fascia/shading changes.

## Connector classes

Use the named classes defined in `TRANSFER_HALL_WALL_KIT.md`:

- `OUTER_TOP_RUN`
- `OUTER_BOTTOM_RUN`
- `OUTER_LEFT_RUN`
- `OUTER_RIGHT_RUN`
- `DIVIDER_VERTICAL`

Door-facing ends of `CAP_DOWN` and `CAP_UP` are genuine terminations and are not canonicalized as continuation edges.

## Edge-treatment rule

Do not derive architectural end treatment from an isolated tile's raw alpha silhouette alone.

For example:

- `H_TOP.left` and `H_TOP.right` are runtime connectors, even though they appear as silhouette edges in an isolated tile;
- the floor-facing/internal long wall boundary is a true exposed architectural edge and may receive depth treatment;
- `CAP_DOWN` / `CAP_UP` contain true doorway-facing terminations that may receive compact cap treatment.

This semantic distinction is the primary reason M4 replaces full-object M2 editing for Walls v3.

## Forbidden

Reject:

- perspective / visible wall side faces;
- full-cell wall slabs that alter room geometry;
- noisy repeated panels/vents;
- cyan stitching at connectors;
- black/missing fragments at T/corner joins;
- rounded/tapered connector ends;
- bright per-tile metallic framing;
- baked scene lighting or large glow;
- hero props or doors inside the architecture atlas;
- material treatment that makes the wall more visually dominant than the room's focal objects;
- compositor logic that treats every alpha boundary as an exposed architectural edge.

## QA

### Geometry / alpha

- atlas exactly 256×256;
- every cell exactly 64×64;
- visible fascia exactly follows `geometry.svg`;
- collision remains separately 10 px;
- reserved cells 13–15 empty;
- no alpha outside allowed masks.

### Material

- material reads as one coherent Transfer Ship graphite family across all pieces;
- no obvious per-tile frames or unique generator-authored caps;
- repeated run does not reveal obvious texture reset at every cell;
- low-frequency value hierarchy stays quieter than PICO/Transfer/doors.

### Edge/topology QA

- connector boundaries have no false closing outline/cap;
- true exposed edges retain consistent depth treatment;
- true caps appear only at named termination edges;
- T and corners read as continuous structures.

### Seam QA

Run `npm run validate-art-seams` after runtime atlas materialization.

Always report:

- SAME-TYPE mean diff;
- DIFF-TYPE negative control;
- ratio;
- worst same-type pair.

Current production target is pixel-identical required boundary strips after canonicalization (`SAME-TYPE = 0`).

### Visual assembly QA

Prototype and inspect in this order:

1. single `H_TOP`;
2. 3× `H_TOP` continuous run;
3. `CORNER_NW` with straight neighbors;
4. `T_TOP_DOWN` with divider;
5. 3× `V_CENTER`;
6. all corners and both T-junctions;
7. north/south divider caps with doorway gap;
8. actual TS-01 wall layout;
9. live comparison against the approved reference.

## Acceptance state

- Technical modular wall system: proven.
- 24 px visible fascia + 10 px collision separation: proven.
- Semantic connector canonicalization: proven.
- M2 separated generation layout: proven useful for separating pieces, but retired as primary wall materialization method because edge topology remained ambiguous to the model.
- M4 procedural compositor: **next prototype, not yet proven visually**.
