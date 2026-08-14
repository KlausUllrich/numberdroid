# Asset Recipe — TS-01 Walls / Architecture

Status: `PREPARED` for Walls v3 material refinement.

## Identity

- Slice/world: TS-01 Transfer Hall / Transfer Ship
- Category: modular Architecture wall kit
- Runtime target: 4 columns × 4 rows, 64×64 px cells, 256×256 px atlas
- Runtime asset: `public/assets/deck/transfer-hall-architecture.png`
- GIDs: 81–93 active, 94–96 reserved
- Perspective: strict orthographic top-down
- Background: transparent outside visible wall geometry

## Source authority

- Visible geometry: `geometry.svg` — current 24 px visible fascia
- Collision/structural core: `collision-core.svg` — binding 10 px gameplay core
- Material reference: `material-reference.md`
- Image edit instruction: `prompt.md`
- Semantic connector contract: `TRANSFER_HALL_WALL_KIT.md` + `docs/SEMANTIC_CONNECTOR_CANONICALIZATION.md`

The older `art-source/flow-vorlagen/transfer-hall-wall-blueprint.svg` remains the historical 10 px geometry proof. This recipe is the clearer source for the current separated 24 px visual / 10 px collision contract.

## Visual target

Walls are a quiet, substantial dark frame around the bright ceramic room. Compared with the current v2 live result they should become:

- visually thicker/heavier rather than rail-like;
- more homogeneous and less segmented;
- lower in local contrast;
- less metallic-highlight driven;
- closer to the approved Transfer Hall reference's stable architectural masses;
- clearly darker than the floor while remaining maintained civilian infrastructure.

The wall is not a hero asset. PICO, door operation, personal props and the Transfer apparatus must attract more attention.

## Deterministic processing

1. Rasterize `geometry.svg` to the actual generation/edit canvas with exact aspect ratio.
2. Visually QA the guide before image editing.
3. Run one material edit using `prompt.md`.
4. Separate `MATERIAL / STYLE` QA from `PRODUCTION GEOMETRY` QA.
5. Map accepted material back to the exact deterministic coordinate system.
6. Restore `geometry.svg` alpha/mask exactly.
7. Apply semantic connector canonicalization using named connector classes; use per-pixel median and inward blend.
8. Reapply the visible mask so connector processing cannot expand alpha.
9. Downscale/extract to exact 64 px cells / 256×256 atlas.
10. Run automated semantic seam QA with a DIFF-TYPE negative control.
11. Assemble straight, corner, T, divider/cap and actual TS-01 layouts.
12. Integrate and perform live browser QA.

The 10 px collision system in `src/game/maps/transferHall.ts` does not change when visible fascia changes.

## Connector classes

Use the named classes defined in `TRANSFER_HALL_WALL_KIT.md`:

- `OUTER_TOP_RUN`
- `OUTER_BOTTOM_RUN`
- `OUTER_LEFT_RUN`
- `OUTER_RIGHT_RUN`
- `DIVIDER_VERTICAL`

Door-facing ends of `CAP_DOWN` and `CAP_UP` are genuine terminations and are not canonicalized as continuation edges.

## Forbidden

Reject:

- perspective / visible wall side faces;
- full-cell wall slabs that alter room geometry;
- noisy repeated panels/vents;
- cyan stitching at connectors;
- black/missing fragments at T/corner joins;
- rounded/tapered connector ends;
- baked scene lighting or large glow;
- hero props or doors inside the architecture atlas;
- material treatment that makes the wall more visually dominant than the room's focal objects.

## QA

### Geometry / alpha

- atlas exactly 256×256;
- every cell exactly 64×64;
- visible fascia exactly follows `geometry.svg`;
- collision remains separately 10 px;
- reserved cells 13–15 empty;
- no alpha outside allowed masks.

### Seam QA

Run `npm run validate-art-seams`.

Always report:

- SAME-TYPE mean diff;
- DIFF-TYPE negative control;
- ratio;
- worst same-type pair.

Current production target is pixel-identical required boundary strips after canonicalization (`SAME-TYPE = 0`).

### Visual assembly QA

Inspect:

- 3× H_TOP;
- 3× V_CENTER;
- all corners;
- both T-junctions;
- north/south divider caps with doorway gap;
- actual TS-01 wall layout;
- live comparison against the approved reference.

## Acceptance state

- Technical modular wall system: proven.
- 24 px visible fascia + 10 px collision separation: proven.
- Semantic connector canonicalization: proven.
- Walls v3 visual refinement: pending art-director QA.
