# TS-01 Floor Treatment Brief / Recipe

Status: **ACTIVE PRODUCTION — 2026-08-20; Family Living / Main Hall / Transfer Room / PRIMUS LIVE_ACCEPTED; Child/Hygiene + AO/wear/Flow still open**

This brief defines the Gold-Slice floor-treatment pass for generated TS-01. The existing accepted Floor remains the **base material baseline**; this pass adds room identity, subtle age/use, contact grounding and functional floor integration without turning the Transfer Ship into a dirty industrial environment.

Current authorities:

- `docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`
- `docs/planning/DEVELOPMENT_PLAN_NEXT.md`
- `docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md`
- `docs/art/direction/ART_DIRECTION_TRANSFER_SHIP.md`
- `docs/art/production/ART_PRODUCTION_RULES_TRANSFER_SHIP.md`
- `docs/art/transfer-hall/TRANSFER_HALL_LAYER_RULES.md`
- `art-source/recipes/transfer-hall/flow-support/recipe.md`
- accepted generated TS-01 Layout-v3 / v0.13.2 spatial baseline

---

## 0. Current production state

Room identity progress:

```text
Family Living   LIVE_ACCEPTED v1
Family Child    OPEN — currently inherits domestic/family treatment
Family Hygiene  OPEN — currently inherits domestic/family treatment
Main Hall       LIVE_ACCEPTED v1
Transfer Room   LIVE_ACCEPTED v1 incl. Hero floor anchoring
PRIMUS          LIVE_ACCEPTED v2 — exact 2×2 macro fit + calm one-tile perimeter
```

System progress:

```text
B1 room identity        4 / 6 accepted
B2 wall AO              OPEN
B3 usage/wear           OPEN
B4 Transfer anchor      LIVE_ACCEPTED v1
B5 Flow floor relation  PARTIAL / OPEN
```

Accepted room-floor baselines are frozen unless a concrete live defect or deliberate revision reopens them.

---

## 1. Visual thesis

The Transfer Ship is:

> **clean, maintained, inhabited, used, not new, not sterile, not dirty.**

Avoid both extremes:

```text
BAD: hospital / showroom / newly rendered architectural visualization
BAD: gritty cargo ship / grimdark factory / abandoned industrial deck
GOOD: competent civilian technology with accumulated everyday use
```

The floor should help explain **what each room is for** before additional Props are added.

---

## 2. Layer / authority model

```text
GROUND
- room material identity
- calm base / macro panels
- topology-critical structural seams where intentional
- thresholds/material transitions

FLOORFX
- wall/contact AO
- use/wear overlays
- Prop grounding/contact shadows
- contextual service/registration marks
- Flow/service buses

LIGHTOVERLAY
- actual scene illumination only
```

Ground/FloorFX never become collision or navigation authority.

---

## 3. Semantic floor / tile metadata — binding trigger

Any floor atlas or modular surface with connectors, directional marks, thresholds, route lines, wall-edge variants, multi-cell pieces or automatic placement must follow:

`docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md`

Required production sequence:

```text
define tile/surface inventory + semantics
→ define structural bands and usable placement domain
→ generate/author source
→ archive approved source unchanged when required
→ deterministic crop/composition
→ explicit metadata incl. spanTiles for multi-cell surfaces
→ topology-safe placement from Level semantics
→ exact-fit / continuity regression tests
→ deployed live QA
```

Do not infer topology from pixel similarity or atlas index.

### Main Hall lesson — accepted

- one calm longitudinal circulation spine;
- room accesses are thresholds, not route T-junctions;
- T/cross/corner graphics are reserved for actual corridor-to-corridor topology changes;
- multi-tile apertures do not create multiple visual route branches;
- no false terminal before Transfer;
- line-bearing variants are not pseudo-randomly swapped unless metadata guarantees continuity.

### PRIMUS lesson — accepted and binding

The first PRIMUS macro pass failed because a correct 2×2 surface was aligned to the room origin and a calm one-tile wall band was then drawn over it. That created visually **half/partial macro panels**.

The correction is structural, not cosmetic:

```text
room size          10 × 8
calm perimeter      1 tile on all sides
usable macro domain 8 × 6
macro span           2 × 2
macro origin         room + (1,1)
result               4 × 3 complete macros
```

Binding rule:

> **Structural bands are removed from the macro domain before placement. The remaining width/height must divide exactly by the repeated multi-cell span.**

If the domain does not divide exactly, change room geometry or author a deliberate terminal/fringe treatment. Never hide, clip or mask part of a macro to make it fit.

For TS-01 this means the PRIMUS room is intentionally 10×8 rather than 9×8.

---

## 4. Room-by-room floor identities

### Family Living — LIVE_ACCEPTED v1

- warm civilian ceramic/composite identity;
- calm medium/large panel rhythm;
- lived-in but maintained;
- future local activity evidence belongs primarily to B3 FloorFX.

### Family Child — OPEN

- related to Family Living;
- slightly softer/warmer or more human-scaled panel rhythm;
- modestly more micro-scuffing/use evidence;
- no generic kids-room decals.

### Family Hygiene — OPEN

- slightly cooler/denser/non-slip material character;
- lower dirt level;
- faint cleaning/water variation allowed;
- not sterile white.

### Main Hall — LIVE_ACCEPTED v1

- neutral durable circulation material;
- one calm longitudinal route language;
- room access handled by thresholds;
- no false route branches;
- traffic wear belongs to B3 rather than random Ground variation.

### Transfer Room — LIVE_ACCEPTED v1

- premium light technical material family;
- strongest large-scale alignment around Apparatus;
- dedicated installed Hero anchoring zone;
- restrained cyan support/status language.

Still open around this accepted baseline: B2 AO, B3 approach/exit wear, B5 Flow integration.

### PRIMUS Allocation — LIVE_ACCEPTED v2

Read:

> optimized institutional work space, competent rather than sinister

Accepted v2 baseline:

- cooler/darker systematic material than Main Hall;
- continuous authored 2×2 macro surfaces in the interior;
- one-tile calm grey perimeter directly along walls;
- real controlled-door threshold only at the actual Hall connection;
- service approach overlays only at real `primus-service-bank` approach cells;
- no invented `WORK SLOT`/number text or random conduit topology;
- no partial macros along walls: room geometry and macro origin are fitted deliberately.

Avoid villain-black flooring, aggressive red grids and excessive glowing circuitry.

Do not reopen this base to add use evidence. Future patrol/service wear belongs to B3 FloorFX.

---

## 4A. Family Hygiene v1 — production contract

Status: **SOURCE_APPROVED / APPROVED_SOURCE_ARCHIVED / PRODUCTION INTEGRATION ACTIVE**

This room is intentionally produced before Child by explicit Art-Director reprioritization on 2026-08-21. It remains a separate room pass; no Child source or integration is bundled into this work.

### Authority declaration

```text
ASSET CATEGORY             Family Hygiene Ground material tiles
RUNTIME REQUIREMENTS       64×64 px opaque full-bleed 1×1 tiles
GEOMETRY AUTHORITY         deterministic 1×1 runtime cells / measured crop
MATERIAL AUTHORITY         M1 generated source candidates after Art-Director alignment
EDGE / TOPOLOGY AUTHORITY  no connectors; metadata explicitly declares none
ALPHA / BACKGROUND         opaque full-bleed Ground; no transparency/card background
PACKING / RUNTIME          deterministic materializer + individual runtime PNGs
SELECTED METHOD / HYBRID   M1 material/source board → deterministic extraction/resample
KNOWN FAILURE MODE         hospital-white/industrial read, card gutters, tile checkerboard,
                           directional grooves, random use of all candidates
```

M4 does not need to invent the material appearance for this pass because the room requires no connector geometry, multi-cell macro or procedural topology. Deterministic production still owns crop, exact runtime dimensions, metadata, placement and QA.

### Asset Task Card

```text
CATEGORY                    Family Hygiene Floor v1
SOURCE TARGET               art-source/approved/area-01-transfer-ship/floor-treatment/
                             source/family-hygiene-floor-2x2__source-approved__2026-08-21.png
SOURCE GRID                  strict 2×2 / four equal square 1×1 candidates
RUNTIME OUTPUT              public/assets/deck/family-hygiene-floor/
                             family-hygiene-floor-00..03.png
RUNTIME TILE                64×64 px
PERSPECTIVE                 strict orthographic top-down / no visible vertical faces
BACKGROUND                  opaque, full-bleed material faces after extraction
PALETTE                     cooler pearl/ceramic grey + muted blue-grey mineral variation;
                             restrained family warmth; no dominant teal, amber or black
MATERIAL READ               fine isotropic non-slip microtexture; clean and maintained;
                             denser than Living, not sterile, wet-room plausible
ALLOWED                     tiny value/material variation; extremely restrained cleaning/
                             water finish variation that remains Ground identity
FORBIDDEN                   drains, route lines, arrows, labels, icons, toys, hazard stripes,
                             directional grooves, hospital white, industrial grates, grime,
                             baked wall AO, scene illumination or story-specific content
MAP CONTEXT                 family-hygiene room only; 2×3 = six complete 1×1 cells
EXTRACTION                  measure four material faces; remove source-board gutters/frame;
                             premultiplied-alpha Lanczos normalization to exact 64×64
QA                          source category/perspective/palette; full-bleed crop; 3×3 repeats;
                             actual 2×3 room assembly; gameplay scale; desktop + phone live QA
```

### Tile / surface metadata contract

| Source cell | Surface id | Role | spanTiles | runtimeEligible after source QA | wallSafe | Rotation | Connectors |
|---:|---|---|---|---|---|---|---|
| 0 | `hygiene-base-a` | dominant calm non-slip base | 1×1 | true | true | invariant | none |
| 1 | `hygiene-base-b` | compatible secondary base | 1×1 | true | true | invariant | none |
| 2 | `hygiene-fine-a` | fine-material alternative | 1×1 | true | true | invariant | none |
| 3 | `hygiene-fine-b` | fine-material alternative | 1×1 | true | true | invariant | none |

Source and deterministic 3×3 repetition QA on 2026-08-21 confirmed all four cells as compatible full-bleed members of continuity family `family-hygiene-calm-v1`. The tiny v1 room still uses only three candidates so approval does not become random placement.

Approved source record:

```text
dimensions    1254 × 1254 px
bytes         2,720,519
SHA-256       67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e
Git blob SHA  806e322b3e787b70318586d796067fb3c54181dc
crop contract 2 × 2 measured 600 × 600 material faces at x=[14,640], y=[14,639]
```

```text
structural full-tile bands  none
room domain                 2 × 3
placement origin            family-hygiene room origin
surface span                1 × 1
divisibility                2 % 1 = 0; 3 % 1 = 0
remainder policy            none
route / connector topology  none
threshold ownership         existing connection/material transition; not this source board
Ground ownership            room material identity only
FloorFX ownership           later drain/service/water-use evidence, wear and AO
```

The live placement must remain deliberately calm: one approved base dominates at least four of the six cells; at most two cells use a compatible secondary material. Do not hash all approved candidates across this tiny room and do not create an obvious checkerboard.

### Deterministic implementation

- add `scripts/materialize-family-hygiene-floor.mjs` with immutable source byte/hash/dimension validation and measured face crops;
- materialize individual 64×64 outputs during `predev` / `prebuild`; runtime derivatives need not be committed;
- add durable per-cell metadata in `src/levelgen/familyHygieneFloorTileMetadata.ts`;
- add `familyHygieneFloorSprites()` in its own presentation module;
- exclude `family-hygiene` from the accepted generic Family overlay while preserving Living/Child unchanged;
- insert Hygiene sprites in the existing pre-Architecture room-floor sequence without changing collision/navigation;
- regression-test exactly six Hygiene sprites, no double-render with the generic Family floor, metadata integrity, deterministic selection, 1×1 fit and existing layer order.

### Generation prompt intent

Generate exactly one production source board containing only four equal square top-down floor-material candidates in a strict 2×2 grid. Each candidate is one complete 1×1 tile face, not a multi-cell composition. The family is a refined civilian Transfer-Ship hygiene floor: slightly cooler and denser than Family Living, pearl/ceramic grey with muted blue-grey mineral variation, fine isotropic non-slip microtexture, clean and maintained but not sterile white. The four candidates are closely related material variants, not different designs. No labels, text, presentation legend, drains, route marks, arrows, symbols, props, walls, doors, perspective, directional grooves, hazard stripes, neon circuitry, grime, baked AO or lighting.

---

## 5. Thresholds / room transitions

Different room floors must remain one Transfer Ship family.

Use controlled threshold transitions and remember:

> **A room threshold is not automatically route topology.**

Doors/openings define material transitions. Only actual corridor branching justifies junction-route tiles.

---

## 6. Ambient occlusion / wall grounding — B2 OPEN

Use deterministic short-range FloorFX AO derived from actual architecture / Shared Wall Graph.

Rules:

- subtle interior-side falloff;
- slightly stronger corners allowed;
- no fake AO across open apertures;
- no collision semantics;
- no scene-light claim;
- avoid excessive double-darkening with Prop shadows.

---

## 7. Wear / dirt system — B3 OPEN

Use **usage evidence**, not generic dirt noise.

Preferred evidence:

- Main Hall traffic band;
- Family Table/Coffee area;
- Child bed/storage zone;
- Transfer Human approach / Robot exit;
- PRIMUS service-bank/patrol use;
- rare low-contrast scuffs/stains;
- selected newer/older replacement panels.

Avoid global tiled grunge, rust/oil baseline and pseudo-random Ground patchwork.

---

## 8. Transfer / Flow floor relationship — B4 DONE, B5 OPEN

### Transfer Hero anchor — B4 LIVE_ACCEPTED

Do not reopen without a concrete defect.

### Flow relationship — B5 PARTIAL

Still required:

- final Flow scale decision;
- collision/use-space finalization;
- grounding shadow;
- deterministic short coupling/service bus to Apparatus;
- static bus in FloorFX;
- later active synchronization after the Gold Slice gate.

---

## 9. Generated atlas / modular surface production rules

1. define inventory and semantics before generation;
2. use strict equal-cell grids for cuttable atlases;
3. no labels/headings/presentation furniture in production pixels;
4. use flat orthographic presentation;
5. preserve approved originals where the archive contract applies;
6. remove presentation-only gutters/card frames during materialization;
7. store explicit `spanTiles` for multi-cell surfaces;
8. define structural bands before placement;
9. require exact divisibility of the usable domain by repeated macro spans;
10. align placement origin to the usable domain, not blindly to room origin;
11. quarantine uncalibrated alternatives;
12. regression-test topology, wall behavior and multi-cell fit;
13. perform deployed gameplay-scale QA before `LIVE_ACCEPTED`.

Source appearance, semantic placement and room geometry are separate authorities but must satisfy one combined fit contract.

---

## 10. Implementation order — current

```text
DONE  Family Living floor v1
DONE  Transfer Room floor v1 + Hero anchor
DONE  Main Hall floor v1 + semantic metadata proof
DONE  PRIMUS floor v2 + exact macro-fit / calm perimeter
NEXT  Child room floor identity
NEXT  Hygiene room floor identity
OPEN  wall AO FloorFX
OPEN  authored use/wear FloorFX
OPEN  Flow shadow/collision/bus
THEN  full-room cohesion + desktop/phone Gold-Slice QA
```

Proceed room-by-room; do not generate or integrate Child and Hygiene as one combined pass unless their shared recipe explicitly requires it.

---

## 11. Acceptance criteria

The Floor Treatment as a whole passes when:

- all six room identities are established;
- rooms can be distinguished by floor character without labels;
- every room still belongs to the same Transfer Ship;
- Main Hall reads as circulation space without false route semantics;
- Transfer strengthens the Apparatus Hero;
- PRIMUS reads ordered/systematic without half macros or wall-edge line clutter;
- wall AO adds depth without fake outlines;
- wear follows plausible use rather than random noise;
- semantic placement does not invent topology from pixels;
- every repeated multi-cell surface fits its usable domain exactly;
- no FloorFX changes collision/pathfinding;
- desktop and phone views remain readable.

Final Gold-Slice acceptance still requires full-room Art-Director/gameplay QA.
