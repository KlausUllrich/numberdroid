# Numberdroid — TS-01 Gold Slice Execution Plan

Status: **CURRENT execution plan — 2026-08-20 after PRIMUS floor v2 LIVE_ACCEPTED**

`DEVELOPMENT_PLAN_NEXT.md` remains the project-level roadmap. `docs/game-design/LEVEL_DESIGN_RULES.md` owns durable spatial principles. `docs/level-generation/GOLD_SLICE_REGRESSION_GATES.md` owns the permanent v0.13.2 spatial/presentation regression contract.

Current Floor-treatment authorities:

- `art-source/recipes/transfer-hall/floor-treatment/recipe.md`
- `docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md`

The current task is **static visual Gold-Slice completion**, not another architecture/compiler migration and not yet a Transfer-animation production block.

---

# 1. Gold Slice target

TS-01 succeeds when the **generated** Transfer Hall feels like a believable, attractive Numberdroid place and a representative quality bar rather than a diagram of gameplay functions.

Preserve:

- comfortable top-down movement;
- clear Family → Hall → Transfer / PRIMUS progression;
- Transfer as strongest environmental Hero hierarchy;
- Family/PRIMUS cultural contrast;
- room identity readable before Props;
- desktop + phone readability;
- accepted runtime behavior and accepted art unless a concrete defect requires revision.

The structural/runtime baseline is accepted. Current work is room identity, architectural grounding, use evidence, missing room art and final cohesion.

---

# 2. Accepted spatial / runtime baseline

v0.13.2 was explicitly accepted on 2026-08-16.

Preserve:

- semantic Layout-v3 room sequence;
- Shared Wall Graph / real apertures;
- 30 px visible wall fascia / 10 px collision core;
- accepted Door contract and Door Clearance;
- true-space Exact Fit with minimum sub-tile correction;
- multipart / silhouette Prop collision where authored;
- safe-interior patrol preference;
- persistent Trigger/Event/access behavior.

A smaller player-model/presentation issue remains deliberately deferred.

---

# 3. Accepted / current art baseline

Frozen unless live QA exposes a concrete defect:

- PICO source/turnaround — **LIVE_ACCEPTED**;
- PICO physical grounding — **LIVE_ACCEPTED**;
- Floor base family — **ACCEPTED BASELINE**;
- Family Living floor v1 — **LIVE_ACCEPTED**;
- Main Hall floor v1 — **LIVE_ACCEPTED**;
- Transfer Room floor / Hero anchoring v1 — **LIVE_ACCEPTED**;
- PRIMUS floor v2 — **LIVE_ACCEPTED**;
- Walls / Architecture — **LIVE_ACCEPTED**;
- Doors — **LIVE_ACCEPTED**;
- Family Table + shadow — **LIVE_ACCEPTED**;
- Family Memory Console + shadow — **LIVE_ACCEPTED**;
- Transfer Apparatus + shadow + silhouette collision — **LIVE_ACCEPTED**;
- Yellow Core static resting state — **LIVE_ACCEPTED**.

Room-context candidates still requiring final disposition include Coffee Machine, Planter Trough, Round Plant, Hologram Pedestal and Flow Regulator.

---

# 4. Floor-treatment progress snapshot

## B1 — Room-specific Ground identities

| Room | Status | Current note |
|---|---|---|
| Family Living | **LIVE_ACCEPTED v1** | warm civilian/lived-in material |
| Family Child | **OPEN** | still inherits domestic/family treatment |
| Family Hygiene | **OPEN** | still inherits domestic/family treatment |
| Main Hall | **LIVE_ACCEPTED v1** | calm circulation floor; room access ≠ route branch |
| Transfer Room | **LIVE_ACCEPTED v1** | premium light floor + installed Hero anchor |
| PRIMUS Allocation | **LIVE_ACCEPTED v2** | systematic 2×2 macro interior + calm wall band; exact-fit correction accepted in live QA |

Therefore B1 is **4/6 accepted**.

## B2 — Static wall AO

Status: **OPEN**.

Use deterministic short-range FloorFX AO derived from actual architecture / Shared Wall Graph. No fake AO across apertures, no collision semantics, no scene-light claim.

## B3 — Usage / wear

Status: **OPEN**.

Use usage evidence rather than generic grunge:

- Family activity zones;
- Main Hall circulation;
- Transfer Human approach / Robot exit;
- PRIMUS service/patrol use;
- rare plausible low-contrast scuffs/stains;
- no obvious repeated dirt tiles.

## B4 — Transfer Hero floor anchoring

Status: **COMPLETED / LIVE_ACCEPTED v1**.

Do not reopen without a concrete defect.

## B5 — Complete Flow floor relationship

Status: **PARTIAL / OPEN**.

Still required: final scale, collision/use-space, grounding shadow, deterministic coupling/service bus, static bus in FloorFX; active synchronization remains later `transfer-fx` work.

---

# 5. Proven semantic-floor rules

Binding contract:

`docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md`

## Main Hall proof

Accepted behavior:

- one calm longitudinal circulation spine;
- room doors/openings are thresholds;
- room access is **not** corridor-route T topology;
- T/cross/corner graphics only for true corridor-to-corridor topology;
- multi-tile apertures do not create multiple branches;
- no false terminal before Transfer;
- non-route cells remain calm;
- generated card/gutter artifacts are removed during materialization;
- uncalibrated generated alternatives remain quarantined.

## PRIMUS proof — accepted multi-cell fit

The first PRIMUS wall-band pass still exposed half 2×2 panels because macros were aligned to the room origin and then covered by the calm perimeter.

The accepted correction is:

```text
room                  10 × 8
calm perimeter         1 tile on every side
usable macro interior  8 × 6
macro span              2 × 2
macro origin            room + (1,1)
macro count             4 × 3 = 12 complete surfaces
```

General rule:

> **Remove structural bands from the tiling domain before placing multi-cell surfaces. The remaining width/height must divide exactly by the repeated surface span.**

If not, change the room geometry or author a deliberate terminal/fringe surface. Never clip, hide or mask part of a macro as a layout fix.

For TS-01 the PRIMUS width is therefore intentionally 10 tiles while height remains 8; macro placement shifts one tile inward vertically and horizontally.

---

# 6. Room composition / identity rules

## Family Living — accepted

- Family Table remains anchor;
- Memory Console/Coffee remain supported/wall-related;
- preserve breathing/use space;
- future wear goes to B3 rather than base regeneration.

## Child — next domestic identity

- related to Family Living but softer/warmer or more human-scaled;
- modest personal/use evidence;
- avoid childish decal clichés.

## Hygiene — next functional identity

- cooler/denser/non-slip material;
- cleaner than Family Living, not sterile white;
- subtle cleaning/water variation allowed.

## Main Hall — accepted

- neutral robust circulation material;
- calm center spine;
- thresholds for room access;
- usage wear later in B3.

## PRIMUS — accepted v2

- controlled, aligned modular work-space character;
- cooler/darker systematic material than Main Hall;
- calm one-tile perimeter along walls;
- complete 2×2 macros only in usable interior;
- service overlays only on real service-bank approach cells;
- actual controlled threshold only at Hall connection;
- no invented work-slot text / random conduit semantics;
- preserve open center for robots/patrol;
- competent/attractive, not villain-black.

Do not reopen the PRIMUS Ground identity merely to add wear; service/patrol evidence belongs to B3 FloorFX.

## Transfer — accepted base/anchor

Preserve Apparatus ownership, open space, Yellow Core resting state, support cluster and accepted premium floor/anchor. Later additions are B2 AO, B3 approach/exit wear and B5 Flow integration.

---

# 7. Current production sequence

```text
DONE  Family Living floor v1
DONE  Main Hall floor v1
DONE  Transfer Room floor v1 + Hero anchor
DONE  PRIMUS floor v2 exact macro-fit
NEXT  Child room floor identity
NEXT  Hygiene room floor identity
OPEN  wall AO FloorFX
OPEN  authored use/wear FloorFX
OPEN  Flow shadow/collision/bus
THEN  full-room cohesion + desktop/phone Gold-Slice QA
```

Continue floor identities **one room at a time**. Do not combine Child and Hygiene into one generation/integration pass merely for efficiency.

After the floor-identity block, continue the PRIMUS hero/system wall object from:

`art-source/recipes/transfer-hall/primus-console/recipe.md`

Useful domestic replacements follow only where they materially improve habitation: Child Bed, toy/personal storage, hygiene fixture/support and surviving necessary placeholders.

---

# 8. Floor production authority

```text
Base room material       Ground / deterministic material set
Room assignment          LevelSpec semantic room identity
Tile/surface meaning     explicit metadata incl. spanTiles
Structural band          Level/visual policy before macro placement
Macro placement domain   room geometry minus structural bands
Route topology           actual corridor/Level semantics
Wall AO                  architecture-derived FloorFX
Wear masks               semantic activity/traffic zones
Prop grounding           separate shadow/contact FloorFX
Flow bus                  exact Prop relationship → FloorFX
Scene illumination        LightOverlay
```

Do not use image generation to guess wall AO, traffic masks, door openings, Flow endpoints, route topology or multi-cell fit.

---

# 9. Production / iteration rules

Classify every visual defect before acting:

```text
FUNCTION / SOURCE DESIGN
PERSPECTIVE / STYLE
RUNTIME CROP / SCALE / PADDING
PLACEMENT / ROOM COMPOSITION
MULTI-CELL FIT / STRUCTURAL BAND ALIGNMENT
COLLISION / USE-SPACE
SHADOW / GROUNDING
MOVABLE FX / CHOREOGRAPHY
```

Only source/function/perspective failures normally justify another source generation. Runtime scale, collision, shadow and floor-layout problems should use deterministic production/runtime tools first.

Binding reminders:

- physical size and Hero prominence are separate;
- PNG alpha is not collision authority;
- new diegetic symbols require semantic authority;
- generated gutters/card frames are not runtime floor art;
- line-bearing variants may not pseudo-randomly alternate without continuity metadata;
- room access and corridor topology are distinct;
- structural perimeter bands must never hide part of a repeated multi-cell surface;
- room geometry may be deliberately adjusted when exact visual modularity requires it;
- a successful code/CI pass is not visual acceptance; deployed gameplay-scale QA remains authoritative.

---

# 10. Runtime layer order

```text
Ground — room material identity
→ FloorFX — AO / wear / shadows / functional floor marks
→ Architecture
→ WallProps
→ FloorProps
→ transfer-fx / movable visuals
→ runtime Characters / interaction layers
→ LightOverlay
```

Spatial truth remains in LevelSpec/placement, `propRegistry.ts`, `propCollisionRegistry.ts` and Exact-Fit metadata. Ground/FloorFX metadata never become implicit collision authority.

---

# 11. Gold-Slice QA gate

Before final acceptance verify:

- Family / Hall / Transfer / PRIMUS distinguishable without floating labels;
- Child/Hygiene read as distinct functions while remaining domestic relatives;
- Transfer remains strongest environmental focal point;
- PRIMUS reads ordered/competent without stealing Hero role;
- thresholds clean;
- no false route branches;
- no wall-overlapped or half multi-cell surfaces;
- no pseudo-random Ground patchwork;
- AO/wear subtle and usage-driven;
- desktop and phone landscape readability;
- movement/collision/access behavior unchanged.

Only after full-room Art-Director/gameplay acceptance should generated TS-01 be considered the representative Gold Slice.

After that gate proceed to Transfer choreography / animation polish.
