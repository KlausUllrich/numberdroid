# TS-01 Floor Treatment Brief / Recipe

Status: **ACTIVE PRODUCTION — 2026-08-20; Family Living / Main Hall / Transfer Room v1 LIVE_ACCEPTED, remaining room identities + AO/wear/Flow still open**

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
PRIMUS          OPEN
```

System progress:

```text
B1 room identity        3 / 6 accepted
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

A useful real-world analogy is a well-kept home with children: it is regularly cleaned and clearly cared for, but small marks, scuffs, duller high-traffic patches and occasional stains remain because people actually live there.

Avoid both extremes:

```text
BAD: hospital / showroom / newly rendered architectural visualization
BAD: gritty cargo ship / grimdark factory / abandoned industrial deck
GOOD: competent civilian technology with accumulated everyday use
```

The floor should help explain **what each room is for** before additional Props are added.

---

## 2. Core production decision — room identity first

The largest intended improvement is **different floor character by room**, while all rooms remain recognizably part of one Transfer Ship material family.

Do not solve this by applying one global dirt texture over the entire map.

Instead:

```text
COMMON TRANSFER-SHIP MATERIAL FAMILY
        +
ROOM-SPECIFIC BASE VARIATION
        +
ROOM-SPECIFIC USE / WEAR
        +
STATIC CONTACT / WALL AO
        +
FUNCTIONAL FLOORFX WHERE JUSTIFIED
```

The result should increase room readability even if all Props are temporarily hidden.

---

## 3. Layer / authority model

### Ground — base material identity

Ground owns:

- walkable base surface;
- room-specific material/tint/panel family;
- large-scale panel seams and material variation;
- threshold material transitions where required;
- topology-critical floor seams only when intentionally part of the room language.

Ground does **not** own:

- Prop shadows;
- wall AO overlays when generated separately;
- active glow;
- temporary effects;
- collision;
- arbitrary decorative route/wear variation.

### FloorFX — non-light overlays

FloorFX may own:

- wall/contact ambient-occlusion treatment;
- Prop grounding/contact shadows;
- subtle wear/dirt/scuff overlays;
- maintenance plates / functional registration graphics;
- the static Flow coupling bus;
- restrained service/docking marks;
- contextual arrows/signage only when semantics justify them.

FloorFX remains non-colliding and is **not scene illumination**.

### LightOverlay — actual scene lighting

LightOverlay alone owns light that affects nearby floor, Props or Characters.

---

## 4. Semantic floor / tile metadata — binding trigger

Any future floor atlas with connectors, directional marks, thresholds, route lines, corners, T-junctions, crossings, terminals or automatic placement must follow:

`docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md`

The Main Hall pass proved that a generated atlas is only a **visual source** until explicit tile semantics exist.

Required production sequence:

```text
define tile inventory + semantics
→ generate/author cuttable source
→ archive approved source unchanged
→ deterministic crop/full-bleed materialization
→ per-cell semantic metadata
→ topology-safe placement from actual Level semantics
→ regression tests
→ deployed live QA
```

Do not infer topology from pixel similarity or atlas index.

### Main Hall reference lesson

Binding accepted behavior:

- one calm longitudinal circulation spine;
- room accesses are thresholds, not route T-junctions;
- T/cross/corner graphics are reserved for actual corridor-to-corridor topology changes;
- multi-tile room apertures do not create multiple visual route branches;
- no false terminal before the Transfer threshold;
- random service/wear Ground variants are avoided because they made the Hall read as patchwork;
- uncalibrated generated tile alternatives remain archived but are not auto-placed.

---

## 5. Room-by-room floor identities

### A. Family Living — LIVE_ACCEPTED v1

Read:

> cared-for family space inside a machine society

Accepted baseline:

- warmer civilian ceramic/composite identity;
- calm medium/large panel rhythm;
- lived-in but maintained;
- materially distinct from Hall/Transfer.

Do not regenerate/repaint the accepted base merely to add wear. Future local activity evidence belongs primarily to B3 FloorFX.

### B. Family Child — OPEN

Read:

> a real child lives here, but it is still a Transfer Ship room

Target:

- related to Family Living;
- slightly softer/warmer or more human-scaled panel rhythm;
- modestly more micro-scuffing/use evidence;
- optional restrained personal material accent if composition needs it;
- no generic kids-room decals or saturated floor graphics.

### C. Family Hygiene — OPEN

Read:

> cleaned frequently, functionally different, not a hospital

Target:

- slightly cooler/denser panel or micro-texture;
- plausible non-slip read;
- lower dirt level;
- faint cleaning/water variation allowed;
- not sterile white.

### D. Main Hall — LIVE_ACCEPTED v1

Read:

> this is where bodies move through the ship

Accepted baseline:

- neutral durable circulation material;
- one calm longitudinal route/seam language;
- room access handled by thresholds;
- no false route branches;
- no glowing navigation road;
- one calm base outside the spine.

Future traffic wear belongs to B3 rather than random Ground tile alternation.

### E. Transfer Room — LIVE_ACCEPTED v1

Read:

> important maintained ritual/technology chamber built around the Transfer system

Accepted baseline:

- premium light technical material family;
- strongest large-scale alignment around the Apparatus;
- dedicated installed Hero anchoring zone;
- restrained cyan support/status language;
- no giant decorative glowing ring.

Still open around this accepted baseline:

- B2 architectural/wall AO;
- B3 Human approach / Robot exit wear;
- B5 Flow shadow/collision/bus integration.

### F. PRIMUS Allocation — OPEN

Read:

> optimized institutional work space, competent rather than sinister

Target:

- slightly cooler, cleaner and more systematic than Main Hall;
- regular modular grid / precise registration logic;
- less random dirt distribution;
- wear aligned with work slots/service banks/patrol paths;
- restrained teal/cyan functional marks;
- visually calm center for robots/patrol.

Avoid villain-black flooring, aggressive red grids and excessive glowing circuitry.

---

## 6. Thresholds / room transitions

Different room floors must not look like unrelated games stitched together.

Use controlled threshold transitions:

- narrow material transitions;
- seam alignment where practical;
- shared ceramic/graphite family;
- room variation primarily through panel scale, tint/value, micro-texture, wear logic and functional markings;
- doors/openings visually explain where one room identity ends and the next begins.

Important semantic rule:

> **A room threshold is not automatically route topology.**

A room doorway may interrupt/transition material while the circulation spine remains conceptually straight toward it. Only actual corridor branching justifies junction-route tiles.

---

## 7. Ambient occlusion / wall grounding — B2 OPEN

Wall AO is recommended for the Gold Slice.

Purpose:

- ground the 30 px wall fascia into the floor;
- make rooms feel less like flat polygons;
- strengthen corners and architectural depth without perspective geometry;
- visually integrate architecture and ground.

Implementation principle:

```text
Shared Wall Graph / visible wall surface
→ interior-side occlusion mask
→ soft short falloff into walkable floor
→ slightly stronger corner accumulation
→ FloorFX AO layer
```

Rules:

- subtle, never black outline;
- open door apertures must remain free of false AO;
- no collision/navigation meaning;
- avoid excessive double-darkening with Prop shadows.

Exact values remain live-QA decisions.

---

## 8. Wear / dirt system — B3 OPEN

Use **usage evidence**, not generic dirt noise.

Preferred categories:

### Traffic wear

- slightly duller/polished high-traffic bands;
- small scuffs from bodies/wheels/feet;
- direction follows actual circulation.

### Local activity wear

- Family Table / Coffee area;
- Child bed/storage zone;
- Transfer Human approach / Robot exit;
- PRIMUS work slots/service banks.

### Rare small stains / marks

- few, low-contrast, irregular;
- more plausible in Family spaces than PRIMUS;
- never repeated at obvious tile intervals.

### Age / maintenance variation

- selected panels may be subtly newer/older;
- replacement-panel variation is allowed;
- maintained-over-time, not newly manufactured or derelict.

Avoid:

- globally tiled grunge;
- high-frequency noise everywhere;
- oil/rust/corrosion baseline;
- dark dirt lines around every tile seam;
- pseudo-random Ground variants that create patchwork.

---

## 9. Transfer / Flow floor relationship — B4 DONE, B5 OPEN

### Transfer Hero anchor — B4 LIVE_ACCEPTED

The Apparatus now reads as installed into a dedicated floor system rather than dropped on generic tiles.

Do not reopen the accepted anchor without a concrete defect.

### Flow relationship — B5 PARTIAL

Still required:

- final live scale decision for 128×128 Flow candidate;
- collision/use-space finalization;
- grounding shadow;
- deterministic short coupling/service bus to Apparatus;
- static bus in FloorFX;
- later animation/synchronization on `transfer-fx` after Gold Slice gate.

---

## 10. Generated atlas production rules

For generated cuttable floor/tile atlases:

1. define tile inventory **before** generation;
2. use a strict equal-cell rectangular grid;
3. no labels/headings/presentation furniture inside production pixels;
4. use flat orthographic presentation;
5. preserve approved original unchanged under `art-source/approved/`;
6. measure actual cell faces when generated gutters/pitch drift;
7. strip presentation-only rounded card/background frames for runtime full-bleed floor faces;
8. normalize deterministically to runtime size;
9. create semantic metadata before automatic placement;
10. quarantine visually plausible but uncalibrated alternatives;
11. regression-test required directions/topology;
12. perform deployed gameplay-scale QA before `LIVE_ACCEPTED`.

Source appearance and semantic placement are separate authorities.

---

## 11. Implementation order — current

```text
DONE  Family Living floor v1
DONE  Transfer Room floor v1 + Hero anchor
DONE  Main Hall floor v1 + semantic metadata proof
NEXT  Child room floor identity
NEXT  Hygiene room floor identity
NEXT  PRIMUS room floor identity
OPEN  wall AO FloorFX
OPEN  authored use/wear FloorFX
OPEN  Flow shadow/collision/bus
THEN  full-room cohesion + desktop/phone Gold-Slice QA
```

Order among Child/Hygiene/PRIMUS may be adjusted for production efficiency, but accepted room baselines must not be reclassified as unfinished.

---

## 12. Acceptance criteria

The Floor Treatment as a **whole** passes when:

- all six room identities are established;
- rooms can be distinguished by floor character without labels;
- every room still belongs to the same Transfer Ship;
- Family spaces feel maintained/lived-in;
- Main Hall reads as circulation space without false route semantics;
- Transfer Room floor strengthens the Apparatus Hero rather than competing with it;
- PRIMUS reads ordered/systematic;
- wall AO adds depth without obvious outlines or fake aperture shadows;
- wear follows plausible use rather than random noise;
- semantic tile placement does not invent topology from pixels;
- no FloorFX changes collision/pathfinding;
- no fake scene illumination is baked into Ground/FloorFX;
- desktop and phone views remain readable.

Final Gold-Slice acceptance still requires full-room Art-Director/gameplay QA after PRIMUS/domestic/candidate disposition work.
