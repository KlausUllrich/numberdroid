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

The Transfer Hall uses **dark graphite/charcoal walls against the light warm ceramic floor** so room boundaries read immediately at gameplay scale.

This does not turn the ship into generic dark military sci-fi. The value hierarchy remains:

- floor / civic walking surface: light warm off-white / ceramic grey;
- walls / structural boundaries: dark graphite / charcoal;
- machinery recesses: dark mineral/graphite, selectively;
- teal/cyan: sparse semantic system signal only;
- amber: CORE / Transfer meaning only.

The target read is a bright, calm civic room **clearly framed by substantial darker architecture**.

## 2. Structural core versus visual fascia

Slice-0 gameplay geometry remains binding, but Gold-Slice art now distinguishes collision geometry from visible wall mass:

- gameplay remains strict orthographic top-down;
- Architecture remains the semantic wall layer;
- the **structural/collision core remains 10 px** thick;
- the Gold-Slice **visible fascia is 16 px** thick in the 64 px runtime cell;
- the extra 6 px are visual mass/depth only and do not enlarge collision;
- outer walls extend the visual fascia inward into the room;
- centered dividers remain centered on the same collision axis and expand symmetrically around it;
- moving door leaves remain 5 px and belong below Architecture;
- LightOverlay does not paint walls from above;
- existing Slice-0 layer, GID, collision and door-pocket topology is preserved.

This refinement was made after live PC QA showed that the correct 10 px wall atlas read too thin compared with the approved Transfer Hall reference. Do not change map topology or collision merely to match the thicker fascia.

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

Every visible connectable endpoint reaches the relevant 64 px cell boundary as a **flat, square, identical 16 px fascia**. The underlying collision contract remains 10 px.

At a connection boundary:

- no rounded end;
- no bevel that narrows before the edge;
- no decorative cap;
- no shadow that visually closes the endpoint;
- no cyan/teal strip crossing the boundary;
- no width change;
- no inset gap.

Two compatible neighboring markers must read as one continuous manufactured wall.

Only `CAP_DOWN` and `CAP_UP` are genuine visible terminations. Their closure detail must remain compact and compatible with the Door pass.

## 5. Corner and T-junction rules

Corners are continuous 90° structures, never two finished props touching. Their outgoing visible bands are 16 px wide and connect without seams.

T-junction hierarchy remains:

- divider stem terminates into the outer wall;
- outer horizontal wall stays visually uninterrupted;
- stem does not pierce outside the room;
- no cross-shaped protrusion.

`T_TOP_DOWN`: top wall continuous, stem from below.

`T_BOTTOM_UP`: bottom wall continuous, stem from above.

A previous apparent T-junction gap was traced to an incorrect QA montage with too few `V_CENTER` cells, not to the semantic T tile. Correct assembly QA must mirror the real TS-01 divider sequence.

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
16 px visible Gold-Slice fascia
```

For geometry-critical wall art, follow the deterministic-to-generative Artist workflow: structural master → material pass → mask/connector restore → exact atlas.

## 8. Required QA before integration

Inspect at minimum:

1. three `H_TOP` pieces in a row;
2. three `V_CENTER` pieces vertically;
3. all four corners with straight neighbors;
4. `H_TOP + T_TOP_DOWN + H_TOP` with divider;
5. `H_BOTTOM + T_BOTTOM_UP + H_BOTTOM` with divider;
6. north divider ending at `CAP_DOWN`;
7. two-cell doorway gap;
8. south divider starting at `CAP_UP`;
9. the actual TS-01 wall layout;
10. live PC/browser preview against the approved Transfer Hall reference.

Reject visible seams, accidental gaps, cyan stitching, width changes, mismatched shading or a wall weight that collapses to a thin outline at gameplay scale.

## 9. Gold Slice acceptance

Walls pass when:

- light floor versus dark wall gives immediate boundary readability;
- visible wall mass is close to the approved reference rather than a thin rail;
- the result still feels like maintained civilian architecture rather than a warship;
- straight runs read as continuous structures;
- corners and T-junctions read as manufactured assemblies;
- the cyan seam defect is gone;
- collision and door behavior remain unchanged;
- the kit is visually compatible with the following Door pass.
