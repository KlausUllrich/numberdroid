# Numberdroid — Transfer Hall Wall Kit

Status: **binding production contract for the Gold Slice wall/architecture category**

Applies to: `TS-01 Transfer Hall` only until promoted into a broader Transfer Ship architecture kit.

Companion documents:
- `TRANSFER_HALL_LAYER_RULES.md`
- `ART_DIRECTION_TRANSFER_SHIP.md`
- `ART_PRODUCTION_RULES_TRANSFER_SHIP.md`
- `ART_ASSET_VALIDATION_RULES.md`
- `ARTIST_AGENT_WORKFLOW.md`
- `docs/SEMANTIC_CONNECTOR_CANONICALIZATION.md`

## 1. Visual purpose

The Transfer Hall uses **dark graphite/charcoal walls against the light warm ceramic floor** so room boundaries read immediately at gameplay scale.

This does not turn the ship into generic dark military sci-fi. The value hierarchy remains:

- floor / civic walking surface: light warm off-white / ceramic grey;
- walls / structural boundaries: dark graphite / charcoal;
- machinery recesses: dark mineral/graphite, selectively;
- teal/cyan: sparse semantic system signal only;
- amber: CORE / Transfer meaning only.

The target read is a bright, calm civic room **clearly framed by substantial darker architecture**.

## 2. Structural core versus visual fascia

Slice-0 gameplay geometry remains binding, but Gold-Slice art distinguishes collision geometry from visible wall mass:

- gameplay remains strict orthographic top-down;
- the runtime tile is authoritatively **64 × 64 px**;
- Architecture remains the semantic wall layer;
- the **structural/collision core remains 10 px** thick;
- the current Gold-Slice **visible fascia is 24 px** thick in the 64 px runtime cell;
- the extra 14 px are visual mass/depth only and do not enlarge collision;
- outer walls extend the visual fascia inward into the room;
- centered dividers remain centered on the same collision axis and expand symmetrically around it;
- moving door leaves remain 5 px and belong below Architecture;
- LightOverlay does not paint walls from above;
- existing Slice-0 layer, GID, collision and door-pocket topology is preserved.

This refinement was made after repeated live PC QA showed that both 10 px and 16 px visible wall art still read too thin compared with the approved Transfer Hall reference. Do not change map topology or collision merely to match the thicker fascia.

### 64 px tile versus old “16 px grid” note

The current runtime/Tiled contract is **64 px per tile**. An early art-direction board contained a `Grid: 16 px` note; that is not a runtime tile-size contract and must not be used for production downscale calculations. Treat it only as an old conceptual/alignment-grid note unless a future document explicitly defines a 16 px sub-grid.

## 3. Exact TS-01 Wall Kit v1

The Transfer Hall uses these 13 active markers in a 4-column × 4-row atlas; the final three cells remain reserved.

| local ID | GID | Name | Function |
|---:|---:|---|---|
| 0 | 81 | `H_TOP` | continuous horizontal wall at top room boundary |
| 1 | 82 | `H_BOTTOM` | continuous horizontal wall at bottom room boundary |
| 2 | 83 | `V_LEFT` | continuous vertical wall at left room boundary |
| 3 | 84 | `V_RIGHT` | continuous vertical wall at right room boundary |
| 4 | 85 | `CORNER_NW` | continuous top-left 90° corner |
| 5 | 86 | `CORNER_NE` | continuous top-right 90° corner |
| 6 | 87 | `CORNER_SE` | continuous bottom-right 90° corner |
| 7 | 88 | `CORNER_SW` | continuous bottom-left 90° corner |
| 8 | 89 | `V_CENTER` | internal vertical divider, centered in cell |
| 9 | 90 | `T_TOP_DOWN` | uninterrupted top wall with divider entering from below |
| 10 | 91 | `T_BOTTOM_UP` | uninterrupted bottom wall with divider entering from above |
| 11 | 92 | `CAP_DOWN` | lower termination of north divider at doorway |
| 12 | 93 | `CAP_UP` | upper termination of south divider at doorway |
| 13 | 94 | reserved | unused |
| 14 | 95 | reserved | unused |
| 15 | 96 | reserved | unused |

Door pockets and moving door leaves are a separate Door category and must be authored against `CAP_DOWN` / `CAP_UP`.

## 4. Connection geometry — hard rule

Every visible connectable endpoint reaches the relevant 64 px cell boundary as a **flat, square, identical 24 px fascia**. The underlying collision contract remains 10 px.

At a connection boundary:

- no rounded end;
- no bevel that narrows before the edge;
- no decorative cap;
- no shadow that visually closes the endpoint;
- no cyan/teal strip crossing the boundary;
- no width change;
- no inset gap;
- no transparent or black missing fragment at a T/corner join.

Two compatible neighboring markers must read as one continuous manufactured wall.

Only `CAP_DOWN` and `CAP_UP` are genuine visible terminations. Their closure detail must remain compact and compatible with the Door pass.

## 5. Corner and T-junction rules

Corners are continuous 90° structures, never two finished props touching. Their outgoing visible bands are 24 px wide and connect without seams.

T-junction hierarchy remains:

- divider stem terminates into the outer wall;
- outer horizontal wall stays visually uninterrupted;
- stem does not pierce outside the room;
- no cross-shaped protrusion;
- the complete target silhouette is reconstructed deterministically rather than trusted to the generated/material source alpha.

`T_TOP_DOWN`: top wall continuous, stem from below.

`T_BOTTOM_UP`: bottom wall continuous, stem from above.

Live PC QA of the 16 px fascia revealed a genuine black/missing-looking fragment at the upper T-junction. Walls v2 therefore rebuilds both T silhouettes from the semantic mask before connector canonicalization; visual source alpha is not allowed to define the join.

## 6. Material and value hierarchy

Wall material is neutral dark graphite/charcoal with restrained metallic highlights. It should read substantially darker and heavier than the normal floor.

Avoid:

- green/teal-tinted wall body;
- cyan edge around every segment;
- hazard stripes;
- random vents/pipes/modules in the structural sheet;
- large glowing strips;
- black-villain treatment.

## 7. Production source contract

The wall atlas contains only the 13 named structural pieces plus three empty reserved cells. No doors, props, floors, labels, documentation or bonus variants.

Final production atlas:

```text
4 columns × 4 rows
64 × 64 px per cell
256 × 256 px total
GIDs 81–93 active
GIDs 94–96 reserved
10 px structural/collision core
24 px visible Gold-Slice fascia
```

The current 16 px accepted material atlas remains a validated **material source**. `scripts/materialize-art-assets.mjs` deterministically expands it into the exact 24 px v2 semantic masks and performs connector canonicalization before writing the runtime PNG. Do not hand-author a separate thicker collision shape.

## 8. Semantic Connector Canonicalization — mandatory mechanism

A Connector Guard Zone is not merely a visual requirement. Modular edges are canonicalized deterministically.

The current semantic connector classes are:

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

The genuine doorway-facing sides of `CAP_DOWN` and `CAP_UP` are **not** connector members and must not be canonicalized into a continuation.

For each connector class:

1. collect every member edge strip;
2. compute one canonical strip using the **per-pixel median**, not the mean;
3. make the boundary strip canonical;
4. blend back toward each tile's individual material over an approximately **8–12 px ramp**; current runtime implementation uses 10 px;
5. restore the semantic structural/visible mask after blending so canonicalization cannot create alpha outside allowed geometry.

Use named semantic relationships, not only occupancy counts. `orientation + occupied pixel count` is acceptable as an exploratory diagnostic but can group edges that are geometrically similar yet semantically not interchangeable.

## 9. Automated seam QA with negative control

Seam compatibility is a pixel property and must not rely exclusively on visual inspection.

Run:

```text
npm run validate-art-seams
```

The validator reports at least:

```text
SAME-TYPE mean diff      <- connector edges that MUST match
DIFF-TYPE mean diff      <- negative control: same edge axis, different connector class
RATIO = DIFF / SAME
WORST same-type pair
```

**Never report a match number without a negative control.** A raw difference value is not interpretable by itself.

For the current v2 wall atlas, semantic canonicalization is expected to make the actual runtime boundary strips pixel-identical (`SAME-TYPE = 0`, ratio effectively infinite). Generic future kits may use a tolerance, but a finite ratio below **20×** is a rejection signal unless the category contract explicitly justifies another threshold.

The validator is deliberately based on the named semantic table above rather than inferred occupancy. A heuristic occupancy-based metric can report a low ratio even for a correct atlas because it treats non-interchangeable wall classes as equivalent; that metric is not the production authority.

## 10. Required QA before integration

Inspect and measure at minimum:

1. automated semantic seam QA including negative control;
2. three `H_TOP` pieces in a row;
3. three `V_CENTER` pieces vertically;
4. all four corners with straight neighbors;
5. `H_TOP + T_TOP_DOWN + H_TOP` with divider;
6. `H_BOTTOM + T_BOTTOM_UP + H_BOTTOM` with divider;
7. north divider ending at `CAP_DOWN`;
8. two-cell doorway gap;
9. south divider starting at `CAP_UP`;
10. the actual TS-01 wall layout;
11. live PC/browser preview against the approved Transfer Hall reference.

Reject visible seams, accidental gaps, black missing fragments, cyan stitching, width changes, mismatched shading or a wall weight that collapses to a thin outline at gameplay scale.

## 11. Gold Slice acceptance

Walls pass when:

- light floor versus dark wall gives immediate boundary readability;
- visible wall mass is close to the approved reference rather than a thin rail;
- the result still feels like maintained civilian architecture rather than a warship;
- straight runs read as continuous structures;
- corners and T-junctions read as manufactured assemblies;
- the cyan seam and black T-junction gap defects are gone;
- semantic seam QA passes with its negative control;
- collision and door behavior remain unchanged;
- the kit is visually compatible with the following Door pass.
