# Numberdroid — TS-01 Gold Slice Execution Plan

Status: **CURRENT detailed execution plan — Layout v3 approved for composition implementation, 2026-08-15**

`DEVELOPMENT_PLAN_NEXT.md` remains the project-level roadmap. `docs/game-design/LEVEL_DESIGN_RULES.md` owns durable spatial principles. This document applies them to the active TS-01 Gold Slice.

---

# 1. Gold Slice target

TS-01 succeeds when the deployed Transfer Hall feels like a believable Numberdroid place and a representative quality bar rather than a diagram of three gameplay functions.

The room must preserve:

- comfortable top-down movement;
- clear Family → Transfer → PRIMUS progression;
- strong hero hierarchy;
- Family/PRIMUS spatial contrast;
- desktop and phone readability;
- accepted art assets unless a concrete defect requires revision.

The reference image is a **density/composition reference, not a footprint template**. More square meters are acceptable when they improve staging and plausibility.

---

# 2. Accepted / candidate art baseline

## Frozen / accepted

- PICO;
- Floor baseline;
- 30 px M4 wall material/kit;
- Doors;
- Family Table + shadow;
- Family Memory Console + shadow.

## Current live candidates

- Coffee machine + shadow;
- Planter trough + shadow;
- Round plant + shadow;
- Hologram pedestal + shadow;
- SVG composition/blockout props.

The candidate art is reusable across topology revisions; moving it does not reopen the source art.

---

# 3. Learning from Composition Preview v2

Preview v2 improved density and functional grouping, but the overall plan remained too efficient and diagrammatic:

- essentially two large rectangular rooms;
- Family reduced to one generic open area;
- spatial history/domestic subdivision missing;
- plants still not fully plausible as human furnishing;
- one plant obscured wall furniture;
- hologram crowded the controlled door threshold;
- the room outline remained too rectangular.

The next pass therefore changes **topology**, not merely prop coordinates.

---

# 4. Layout v3 spatial thesis

The level should read as a sequence of places:

```text
DOMESTIC CLUSTER
  living / family room
  + small child room
  + small hygiene/bathroom room
        │
        │ short domestic connection
        ↓
MAIN HALL
  ├────────→ PRIMUS ALLOCATION / WORK ROOM
  │             controlled door
  │
  └────────↓
         TRANSFER ROOM
         destination / ritual / hero chamber
```

This intentionally rejects the old horizontal `Family | Transfer | PRIMUS` panel layout.

## Rationality gradient

```text
Family dwelling  → adapted, subdivided, a little inefficient
Hall             → connective, legible, restrained
Transfer room    → deliberate destination, strongest local symmetry
PRIMUS room      → efficient, aligned, modular
```

---

# 5. Layout v3 topology — composition blockout

The map bounding canvas may expand to approximately **25 × 20 tiles**. The playable footprint should not fill that rectangle.

## 5.1 Living / Family room — north-west

Approximate blockout box:

```text
left 1 / top 1 / right 8 / bottom 7
```

Purpose:

- main family waiting/living area;
- Family Table anchor;
- Memory Console and Coffee Machine on supported wall edges;
- personal furnishing and one wall-adjacent plant.

Rules:

- keep generous use space around the table;
- Coffee Machine stays upper-wall backed, accessed from below;
- no plant in front of Memory Console/Coffee/storage;
- long planter should sit genuinely near the left wall or terminate a furniture run;
- do not make the living room perfectly symmetrical.

## 5.2 Child room — south-west pocket

Approximate box:

```text
left 1 / top 8 / right 5 / bottom 13
```

Purpose:

- prove that the family lived here rather than merely waited in a lobby;
- add domestic layering and irregular outline;
- introduce child-specific placeholder mass without committing final art.

Blockout inventory:

- small child bed;
- toy/personal storage;
- optional soft seat/object if composition needs it.

This is a composition/story-space proof, not final child-room production art.

## 5.3 Hygiene / bathroom pocket

Approximate box:

```text
left 6 / top 8 / right 8 / bottom 12
```

Purpose:

- make the dwelling read like habitation;
- create a second small room that is functionally distinct from living/child space;
- contribute to an irregular domestic cluster.

Use a simple top-down hygiene placeholder only; do not solve detailed sanitary design during this pass.

## 5.4 Main hall — central spine

Approximate box:

```text
left 9 / top 3 / right 13 / bottom 13
```

Purpose:

- connect domestic space, Transfer and PRIMUS;
- create compression/release and staged reveal;
- stop the level from reading as one open rectangle.

Rules:

- hall itself remains comparatively uncluttered;
- no decorative prop should steal doorway clearance;
- route to Transfer and PRIMUS should be immediately readable once inside the hall.

## 5.5 PRIMUS allocation/work room — north-east

Approximate box:

```text
left 14 / top 1 / right 23 / bottom 9
```

Purpose:

- controlled system space;
- aligned service consoles / body banks;
- neutral and hostile robot activity;
- efficient contrast to domestic layout.

Access:

- controlled vertical doorway from hall;
- preserve visual breathing room on both sides of the door;
- no hologram/plant/service prop immediately beside the threshold.

Density:

- wall-backed north/right/bottom modules;
- open center for robot movement/patrol.

## 5.6 Transfer room — south destination

Approximate box:

```text
left 8 / top 14 / right 18 / bottom 19
```

Purpose:

- destination chamber reached from the hall;
- strongest focal composition;
- Transfer apparatus / Flow / hologram / diagnostics form one coherent system.

Rules:

- Transfer apparatus owns the strongest local symmetry;
- room remains larger/open around hero machinery;
- hologram/control is placed close enough to read as part of Transfer, but away from the hall entrance/doorway clearance;
- support consoles sit on room walls, not the doorway mouth;
- Flow grounding/path remains later Gold Slice work.

---

# 6. Connections and thresholds

## Living → Hall

- open domestic passage;
- no controlled door required;
- short transition may be framed by walls but should not feel security-gated.

## Living → Child / Bathroom

- small domestic openings;
- blockout may use open doorway gaps rather than adding production doors;
- topology should suggest rooms without creating fiddly gameplay choke points.

## Hall → Transfer

- broad/open destination threshold;
- no ordinary prop in the approach zone;
- room reveal should make the Transfer hero visible after moving down the hall.

## Hall → PRIMUS

- hard controlled threshold;
- existing Door system remains appropriate;
- approximately one tile of visual breathing space should remain clear on each useful side.

---

# 7. Prop placement rules for Layout v3

## Family plants

- long planter: wall-adjacent, preferably left/west wall or end of a furniture run;
- round plant: corner/edge support object;
- neither plant may sit directly in front of wall furniture or block access/readability.

## Coffee Machine

- upper living-room wall;
- access from below;
- no plant blocking it.

## Hologram

- belongs to Transfer;
- place in the Transfer room beside the hero/support system;
- not beside the PRIMUS door or Hall→Transfer threshold.

## SVG blockout props

Use only where they answer room-function questions:

- living bench/storage;
- Transfer diagnostics/service bank;
- PRIMUS service modules.

A new small domestic blockout atlas may add:

- child bed;
- hygiene module;
- toy/personal storage.

These remain provisional.

---

# 8. Composition Preview v3 implementation block

Implement now:

1. expand map canvas as required by the irregular floor plan;
2. replace the two-room topology with Living + Child + Bathroom + Hall + Transfer + PRIMUS volumes;
3. use the accepted wall art to outline the rectangular component rooms where possible;
4. use open doorway gaps / explicit walkable connectors rather than inventing meaningless wall stubs;
5. reposition all existing Family/Transfer candidate props under the rules above;
6. add the small domestic SVG blockout atlas;
7. move Transfer hero placeholders into the new south room;
8. move PRIMUS encounters/service dressing into the north-east room;
9. update light-zone coordinates for the new Transfer room;
10. update topology/traversal/door-clearance regression tests;
11. deploy as **COMPOSITION PREVIEW v3**, not `LIVE_ACCEPTED`.

---

# 9. Composition Preview v3 live QA gate

Judge:

## Topology
- does the level now feel like a sequence of places rather than two rectangles?
- does the domestic cluster plausibly suggest living + child + hygiene functions?
- is the overall silhouette/footprint visibly non-rectangular?

## Human plausibility
- are plants beside walls/corners/furniture rather than in front of wall furniture?
- does the Family zone feel adapted/lived-in rather than optimized?

## Circulation
- is the Hall readable?
- are all room connections comfortable?
- does the PRIMUS door have breathing room on both sides?
- is the Transfer entrance uncluttered?

## Functional relationships
- does the hologram clearly belong to Transfer?
- do Transfer support pieces form one cluster?
- does PRIMUS remain ordered without becoming a mirror-image showroom?

## Gameplay scale
- does the larger footprint still feel comfortable rather than empty?
- are the additional square meters justified by pacing and spatial identity?

Do not produce final child/bathroom assets until this topology passes live QA.

---

# 10. After Layout v3 topology passes

Return to the broader Gold Slice completion work:

1. final Transfer hero production;
2. Flow support + floor-projected grounding/path;
3. replace useful SVG placeholders with deliberate production assets;
4. restrained floor dirt/use-wear pass;
5. fidelity convergence for threshold/architecture/support details;
6. desktop + phone final Gold Slice QA.

Gold Slice acceptance still requires coherent architecture, floor, props, heroes, shadows, lighting and story identity. `Merged` remains different from `LIVE_ACCEPTED`.
