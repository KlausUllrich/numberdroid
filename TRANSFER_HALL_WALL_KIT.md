# Numberdroid — Transfer Hall Wall Kit

Status: **binding production contract for the Gold Slice wall/architecture category**

Applies to: `TS-01 Transfer Hall` only until promoted into a broader Transfer Ship architecture kit.

Companion documents:
- `TRANSFER_HALL_LAYER_RULES.md`
- `ART_DIRECTION_TRANSFER_SHIP.md`
- `ART_PRODUCTION_RULES_TRANSFER_SHIP.md`
- `ART_ASSET_VALIDATION_RULES.md`
- `ARTIST_AGENT_WORKFLOW.md`

## 1. Visual purpose

The Transfer Hall uses **dark graphite/charcoal wall bands against the light warm ceramic floor** to increase room readability and make boundaries obvious at gameplay scale.

This does **not** mean the ship becomes generic dark military sci-fi. The value hierarchy is deliberate:

- floor / civic walking surface: light warm off-white / ceramic grey;
- walls / structural boundaries: dark graphite / charcoal;
- machinery recesses: dark mineral/graphite, selectively;
- teal/cyan: sparse semantic system signal only;
- amber: CORE / Transfer meaning only.

The dark wall is a **graphic framing device and structural material**, not a mood change toward a hostile warship.

The target read is: bright, calm civic room **clearly bounded by darker architecture**.

## 2. Technical foundation remains binding

- gameplay remains strict orthographic top-down;
- Architecture remains the semantic wall layer;
- visible wall geometry remains **10 px** thick;
- collision remains aligned with the same geometry;
- the runtime may overlap adjacent wall geometry by 1 px to avoid raster seams;
- moving door leaves remain 5 px and belong below Architecture;
- LightOverlay does not paint walls from above;
- the existing Slice-0 layer/collision/door-pocket architecture is preserved.

Do not redesign the wall system to fit generated art.

## 3. Exact TS-01 Wall Kit v1

The current Transfer Hall needs exactly these 13 active architecture markers. The existing 4-column, 16-cell architecture atlas may reserve the final three cells for future use.

| local ID | GID | Name | Function |
|---:|---:|---|---|
| 0 | 81 | `H_TOP` | continuous horizontal wall at top room boundary |
| 1 | 82 | `H_BOTTOM` | continuous horizontal wall at bottom room boundary |
| 2 | 83 | `V_LEFT` | continuous vertical wall at left room boundary |
| 3 | 84 | `V_RIGHT` | continuous vertical wall at right room boundary |
| 4 | 85 | `CORNER_NW` | manufactured continuous top-left 90° corner |
| 5 | 86 | `CORNER_NE` | manufactured continuous top-right 90° corner |
| 6 | 87 | `CORNER_SE` | manufactured continuous bottom-right 90° corner |
| 7 | 88 | `CORNER_SW` | manufactured continuous bottom-left 90° corner |
| 8 | 89 | `V_CENTER` | internal vertical divider, centered in cell |
| 9 | 90 | `T_TOP_DOWN` | uninterrupted top wall with divider stem entering from below |
| 10 | 91 | `T_BOTTOM_UP` | uninterrupted bottom wall with divider stem entering from above |
| 11 | 92 | `CAP_DOWN` | genuine lower termination of north divider at doorway |
| 12 | 93 | `CAP_UP` | genuine upper termination of south divider at doorway |
| 13 | 94 | reserved | unused in TS-01 v1 |
| 14 | 95 | reserved | unused in TS-01 v1 |
| 15 | 96 | reserved | unused in TS-01 v1 |

Door pockets and moving door leaves are **not part of this Wall source generation**. They belong to the following Door category and must be designed against `CAP_DOWN` / `CAP_UP` after this wall kit is accepted.

## 4. Connection geometry — hard rule

Every connectable wall endpoint must reach the relevant 64 px cell boundary as a **flat, square, identical 10 px section**.

At a connection boundary:

- no rounded end;
- no bevel that narrows before the edge;
- no decorative cap;
- no shadow that visually closes the endpoint;
- no cyan/teal strip crossing the boundary;
- no change in wall thickness;
- no inset gap.

Two adjacent compatible markers must visually become one continuous manufactured wall.

A connection endpoint is not allowed to look like the end of a standalone prop.

### Genuine ends

Only `CAP_DOWN` and `CAP_UP` are genuine visible terminations. They may contain a deliberately authored closure detail, but it must remain compact and compatible with the later door-pocket assembly.

## 5. Corner rule

A corner is one continuous 90° structural piece.

Do not construct a corner visually as two straight wall props meeting with rounded/end-capped tips.

The two outgoing 10 px bands must leave the cell at full width and meet their neighboring straight pieces without a seam.

## 6. T-junction rule

T-junction hierarchy follows the accepted Slice-0 runtime behavior:

- the divider stem terminates into the outer wall;
- the outer horizontal wall remains visually uninterrupted;
- the stem must not pierce through the outer wall;
- no cross-shaped protrusion may appear outside the room.

`T_TOP_DOWN`: top wall continuous, stem from below.

`T_BOTTOM_UP`: bottom wall continuous, stem from above.

## 7. Material and value hierarchy

Wall material is predominantly neutral dark graphite/charcoal.

Target wall read:

- darkest structural body: near-charcoal, not pure black;
- mid graphite planes for form separation;
- restrained neutral metallic edge highlights;
- occasional warm/off-white small casing insert is allowed if it supports the civic material language;
- teal/cyan must **not** define every wall edge or seam.

The wall should be significantly darker than the normal floor so the room silhouette and traversable area are immediately readable.

Avoid:

- green/teal-tinted wall body;
- cyan edge around every segment;
- military hazard stripes;
- random vents/pipes/modules in the structural wall sheet;
- large glowing strips;
- black-villain treatment.

## 8. Source-generation contract

A Wall source image for this kit contains **only the 13 named structural pieces**.

No:

- doors;
- door leaves;
- arches;
- columns;
- wall consoles;
- vents;
- props;
- floor tiles;
- room fragments;
- labels or documentation rendered into the image;
- random bonus variants.

The source should be organized as a regular 4-column × 4-row grid so extraction to the existing architecture atlas is deterministic. Cell 14–16 may remain visually empty/reserved.

Each cell represents one exact semantic marker. The source is art material; the final production atlas must still be normalized to exact 64 × 64 cells with transparency where expected.

## 9. Required QA before integration

### Source QA

Check all 13 pieces by name. Reject the source if any named piece is missing, duplicated, ambiguous or replaced with unrelated content.

### Boundary QA

For every connectable edge, inspect at enlarged scale:

- exact full-width 10 px exit;
- square cut at cell edge;
- no rounding;
- no hidden alpha gap;
- no decorative endpoint.

### Assembly QA

Construct and inspect at minimum:

1. three `H_TOP` pieces in a row;
2. three `V_CENTER` pieces vertically;
3. all four outer corners connected to their straight neighbors;
4. `H_TOP + T_TOP_DOWN + H_TOP` with vertical stem;
5. `H_BOTTOM + T_BOTTOM_UP + H_BOTTOM` with vertical stem;
6. north divider ending at `CAP_DOWN`;
7. south divider starting at `CAP_UP`;
8. the actual TS-01 wall layout.

Reject visible seams, repeated endpoint shapes, cyan stitching, width changes or mismatched shading at cell boundaries.

## 10. Gold Slice acceptance

Walls pass only when:

- light floor versus dark wall gives immediate room-boundary readability;
- the result still feels like maintained civilian architecture rather than a warship;
- straight runs read as continuous structures, not repeated 64 px props;
- corners and T-junctions read as manufactured single assemblies;
- the upper/right cyan seam is gone;
- the kit is visually compatible with the following Door pass.
