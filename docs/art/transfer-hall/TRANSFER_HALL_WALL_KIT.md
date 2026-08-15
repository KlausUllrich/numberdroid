# Numberdroid — Transfer Hall Wall Kit

Status: **binding production contract for TS-01 wall/architecture art**

Companion documents:
- `docs/art/transfer-hall/TRANSFER_HALL_LAYER_RULES.md`
- `docs/art/direction/ART_DIRECTION_TRANSFER_SHIP.md`
- `docs/art/production/ART_ASSET_VALIDATION_RULES.md`
- `docs/art/production/ARTIST_AGENT_WORKFLOW.md`
- `docs/art/production/SEMANTIC_CONNECTOR_CANONICALIZATION.md`
- `docs/art-production-methods/04-procedural-2d-compositor/README.md`
- `art-source/recipes/transfer-hall/walls/recipe.md`

## 1. Visual purpose

The Transfer Hall is a bright civilian space framed by **quiet, substantial dark graphite architecture**. Walls are structural background, not hero props.

Target hierarchy:
- floor: light warm ceramic/off-white;
- walls: homogeneous graphite/charcoal;
- system teal/cyan: sparse semantic signal only;
- CORE/Transfer amber: focal semantic accent only.

Avoid generic dark military sci-fi, noisy panels, bright per-tile metallic frames, vents/pipes everywhere, and cyan stitching.

## 2. Runtime and geometry contract

- runtime tile: **64 × 64 px**;
- atlas: **4 × 4 cells = 256 × 256 px**;
- GIDs 81–93 active, 94–96 reserved;
- structural/collision core: **10 px** and unchanged;
- current visible fascia: **30 px**;
- extra visible mass does not enlarge collision;
- outer walls expand inward into the room;
- centered divider remains on the same collision axis and expands symmetrically;
- moving door leaves remain a separate Door layer below Architecture;
- LightOverlay remains separate.

The 30 px fascia follows repeated live QA: 10, 16 and 24 px treatments all read too light/thin against the approved reference. This is a visual change only.

The old `Grid: 16 px` note in an early art-direction board is not a runtime tile-size contract. Runtime/Tiled tile size is 64 px.

## 3. Semantic wall kit

| local ID | GID | Name | Function |
|---:|---:|---|---|
| 0 | 81 | `H_TOP` | top outer wall |
| 1 | 82 | `H_BOTTOM` | bottom outer wall |
| 2 | 83 | `V_LEFT` | left outer wall |
| 3 | 84 | `V_RIGHT` | right outer wall |
| 4 | 85 | `CORNER_NW` | top-left corner |
| 5 | 86 | `CORNER_NE` | top-right corner |
| 6 | 87 | `CORNER_SE` | bottom-right corner |
| 7 | 88 | `CORNER_SW` | bottom-left corner |
| 8 | 89 | `V_CENTER` | centered internal divider |
| 9 | 90 | `T_TOP_DOWN` | top wall with divider entering from below |
| 10 | 91 | `T_BOTTOM_UP` | bottom wall with divider entering from above |
| 11 | 92 | `CAP_DOWN` | north divider termination at doorway |
| 12 | 93 | `CAP_UP` | south divider termination at doorway |
| 13–15 | 94–96 | reserved | empty |

## 4. Production method — M4 Procedural 2D Compositor

Walls no longer ask image generation to author complete wall pieces.

Binding pipeline:

```text
semantic geometry / topology
→ borderless material source
→ deterministic material mapping
→ EXPOSED / CONNECTOR / TRUE_CAP edge classification
→ outline + AO only on true exposed edges
→ no closing outline on connector boundaries
→ exact alpha restore
→ semantic connector canonicalization
→ 64 px tiles / 256 px atlas
→ automated seam QA + assembly QA
→ live browser QA
```

The runtime implementation is `scripts/render-transfer-hall-walls.mjs` driven by `art-source/recipes/transfer-hall/walls/render-recipe.json`.

The current material source is a deterministic procedural proof swatch. It can later be replaced by a generated or hand-authored **borderless** graphite texture without changing geometry or topology logic.

## 5. Edge semantics — hard rule

The compositor must distinguish:

- `EXPOSED`: real architectural boundary; may receive restrained dark outline/AO;
- `CONNECTOR`: continues into another tile; **must not** receive endpoint outline, cap, bevel closure or shadow closure;
- `TRUE_CAP`: genuine doorway-facing termination on `CAP_DOWN` / `CAP_UP`; may receive compact termination treatment when Door art is authored.

Do not derive this classification from isolated alpha silhouettes alone.

At every connector:
- flat and square to the cell boundary;
- identical 30 px visible fascia;
- no taper/rounding;
- no decorative cap;
- no cyan strip;
- no alpha gap;
- no black missing fragment;
- no per-tile frame seam.

## 6. Semantic connector groups

```text
OUTER_TOP_RUN
  H_TOP.L / H_TOP.R
  CORNER_NW.R / CORNER_NE.L
  T_TOP_DOWN.L / T_TOP_DOWN.R

OUTER_BOTTOM_RUN
  H_BOTTOM.L / H_BOTTOM.R
  CORNER_SW.R / CORNER_SE.L
  T_BOTTOM_UP.L / T_BOTTOM_UP.R

OUTER_LEFT_RUN
  V_LEFT.T / V_LEFT.B
  CORNER_NW.B / CORNER_SW.T

OUTER_RIGHT_RUN
  V_RIGHT.T / V_RIGHT.B
  CORNER_NE.B / CORNER_SE.T

DIVIDER_VERTICAL
  V_CENTER.T / V_CENTER.B
  T_TOP_DOWN.B
  T_BOTTOM_UP.T
  CAP_DOWN.T
  CAP_UP.B
```

Doorway-facing ends of `CAP_DOWN` and `CAP_UP` are not continuation connectors.

## 7. Connector canonicalization

For each named connector class:
1. collect all member edge strips;
2. compute one per-pixel **median** strip;
3. make boundary pixels canonical;
4. blend toward the individual material over the recipe guard width;
5. restore exact semantic alpha.

Named topology is authoritative. Occupancy-count heuristics are diagnostic only.

## 8. Material rule

The wall material should read as one quiet, maintained graphite/mineral-composite family.

Prefer:
- broad homogeneous value masses;
- low-frequency subtle surface variation;
- restrained construction depth;
- low local contrast;
- shared material coordinates where possible.

Reject:
- bright silver perimeter frame around each tile;
- obvious texture reset/panel change at every 64 px boundary;
- random vents/bolts/stripes;
- hero-level detail;
- baked room lighting.

Material generation, when used, should create a **borderless material swatch**, not a wall object.

## 9. Automated seam QA

Run:

```text
npm run validate-art-seams
```

Always report:
- SAME-TYPE mean diff;
- DIFF-TYPE negative control;
- ratio;
- worst same-type pair.

Never report a seam match value without its negative control.

Current production target after canonicalization: required boundary strips pixel-identical (`SAME-TYPE = 0`).

## 10. Visual QA

Inspect at minimum:
1. 3× `H_TOP` run;
2. 3× `V_CENTER` run;
3. all corners with straight neighbors;
4. both T-junctions;
5. divider + doorway caps;
6. actual TS-01 wall layout;
7. live PC/browser comparison against the approved reference.

Walls pass when they read as a stable dark architectural frame, are materially quieter than PICO/Transfer/doors, show no connector seams or black T gaps, and leave collision/door behavior unchanged.
