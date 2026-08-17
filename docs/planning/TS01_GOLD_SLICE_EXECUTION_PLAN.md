# Numberdroid — TS-01 Gold Slice Execution Plan

Status: **CURRENT detailed execution plan — 2026-08-17 after Transfer Apparatus + Yellow Core live acceptance**

`DEVELOPMENT_PLAN_NEXT.md` remains the project-level roadmap. `docs/game-design/LEVEL_DESIGN_RULES.md` owns durable spatial principles. `docs/level-generation/GOLD_SLICE_REGRESSION_GATES.md` owns the permanent v0.13.2 spatial/presentation regression contract.

The current task is **visual Gold-Slice completion**, not another architecture/compiler migration and not yet a Transfer-animation production block.

---

# 1. Gold Slice target

TS-01 succeeds when the **generated** Transfer Hall feels like a believable, attractive Numberdroid place and a representative quality bar rather than a diagram of gameplay functions.

The generated Floor must preserve:

- comfortable top-down movement;
- clear Family → Hall → Transfer / PRIMUS progression;
- Transfer as the strongest environmental Hero hierarchy;
- Family/PRIMUS spatial and cultural contrast;
- desktop and phone readability;
- accepted spatial/runtime behavior;
- accepted art assets unless a concrete defect requires deliberate revision.

The current room is structurally functional but still visually sparse. **Making the Gold Slice look finished is the current milestone.** Do not jump to broader campaign production merely because the Transfer hero itself is now accepted.

---

# 2. Accepted spatial / runtime baseline

v0.13.2 was explicitly accepted on 2026-08-16.

Preserve:

- semantic Layout-v3 room sequence;
- Shared Wall Graph / real apertures;
- 30 px visible wall fascia / 10 px collision core;
- accepted Door contract: 5 px leaf, aperture clipping, 520 ms open, 650 ms soft close;
- widened Door Clearance and clean thresholds;
- true-space Exact Fit with minimum sub-tile correction;
- multipart Prop collision where authored;
- wall-safe fallback blockouts;
- safe-interior patrol preference;
- persistent Trigger/Event/access behavior.

A smaller player-model/presentation issue is known and deliberately deferred. It must not trigger unrequested PICO regeneration.

---

# 3. Accepted art baseline

## Frozen / accepted

- **PICO** — LIVE_ACCEPTED source/turnaround baseline;
- **Floor** — accepted baseline;
- **Walls / Architecture** — LIVE_ACCEPTED 30 px M4 wall kit;
- **Doors** — LIVE_ACCEPTED;
- **Family Table + shadow** — LIVE_ACCEPTED;
- **Family Memory Console + shadow** — LIVE_ACCEPTED;
- **Transfer Apparatus + shadow + silhouette collision** — LIVE_ACCEPTED;
- **Yellow Core static resting state** — LIVE_ACCEPTED at 96×96 on a separate `transfer-fx` layer.

Accepted categories remain frozen unless live QA exposes a concrete defect or a deliberate revision is approved.

## Current live candidates

Still awaiting explicit full-room disposition:

- Coffee Machine + shadow;
- Planter Trough + shadow;
- Round Plant + shadow;
- Hologram Pedestal + shadow.

Their spatial integration is stable; their final visual status remains a later Gold-Slice cohesion decision.

## Current blockouts / missing production art

The room still feels sparse because several semantically real roles remain provisional or visually underdeveloped:

- **Flow support / Transfer support system**;
- **functional Transfer-related FloorFX / grounding/path cues**, only where justified;
- **PRIMUS allocation/service-bank hero/system object**;
- **Child Bed**;
- **Toy / personal storage**;
- **Hygiene fixture/support**;
- any surviving blockout that remains functionally necessary after composition review.

The accepted Transfer Apparatus and Yellow Core are no longer on this missing list.

---

# 4. Accepted Layout-v3 spatial thesis

```text
DOMESTIC CLUSTER
  family-living
  + family-child
  + family-hygiene
        │
        ↓
MAIN HALL
  ├────────→ PRIMUS ALLOCATION / WORK ROOM
  │             controlled door
  │
  └────────↓
         TRANSFER ROOM
         destination / ritual / hero chamber
```

Do not return to an equal horizontal `Family | Transfer | PRIMUS` panel layout.

Rationality gradient:

```text
Family dwelling  → adapted, layered, personal, slightly inefficient
Hall             → connective, legible, restrained
Transfer room    → deliberate destination, strongest local hierarchy/symmetry
PRIMUS room      → efficient, aligned, modular
```

---

# 5. Room composition rules during the finishing pass

## Family Living

- Family Table remains anchor;
- Memory Console/Coffee remain supported or wall-related;
- preserve breathing/use space around Table;
- domestic composition should not become perfectly optimized;
- candidate plants should be judged in the complete room, not as isolated thumbnails.

## Child room

Purpose is to prove actual habitation.

Add only assets that materially strengthen that read:

- child bed;
- toy/personal storage;
- one additional personal/soft cue only if the composition still needs it.

Avoid generic clutter for density's sake.

## Hygiene room

Use the minimum art needed for immediate recognizable hygiene function. Do not create a sanitary-detail subproject.

## Main Hall

Keep comparatively uncluttered so circulation and Family → Transfer/PRIMUS branching remain obvious.

## PRIMUS allocation/work room

- controlled, aligned, modular work-space character;
- wall-backed system/service objects;
- open center for robots and patrol;
- PRIMUS technology should look competent and attractive, not generic evil-black machinery;
- the missing system hero must create identity without stealing the Transfer room's primary hierarchy.

## Transfer room

The accepted 4×6 Apparatus owns the room.

- preserve intentional open space around it;
- Yellow Core remains centered on its resting platform in the static state;
- Hologram/Flow/support should read as a coherent Transfer cluster, not unrelated decoration;
- additional effects should **support**, not visually bury, the accepted Hero;
- restrained symmetry is appropriate;
- normal movement collision around the Apparatus remains the accepted authored silhouette contract.

---

# 6. CURRENT production sequence — finish the Gold Slice first

This is now the intended order.

## COMPLETED — Asset Block A: Transfer Apparatus + Yellow Core

Accepted result:

```text
Transfer Apparatus: 4×6 Hero / source + runtime + shadow + collision LIVE_ACCEPTED
Yellow Core:        96×96 separate movable transfer-fx resting state LIVE_ACCEPTED
```

The production cycle also established reusable lessons around source-vs-runtime scale, Hero prominence, silhouette collision and movable components. See:

`docs/history/experiments/TRANSFER_SYSTEM_HERO_PRODUCTION_LEARNINGS_2026-08-17.md`

Do not continue polishing these static assets while the rest of the room is still blockout-heavy.

## CURRENT — Asset Block B: Flow support + functional FloorFX

Purpose:

- make the Transfer room feel like an engineered system rather than one isolated machine;
- visually explain support/flow relationships around the accepted Hero;
- strengthen composition without creating a second competing focal point.

Rules:

- Flow must visibly belong to the Transfer Apparatus;
- floor-projected paths/markings only when they communicate function;
- grounding/contact treatment may use FloorFX;
- FloorFX is not scene illumination;
- preserve Apparatus circulation and silhouette-collision whitespace;
- do not overfill the room merely to make it look richer.

Before production, create/update a dedicated recipe and declare whether support components are Props, FloorFX or movable FX.

## NEXT — Asset Block C: PRIMUS hero/system wall object

Produce the missing high-quality PRIMUS allocation/service object after Transfer support establishes the local visual grammar.

Requirements:

- precise, attractive, competent;
- communicates assignment/order/system control;
- ceramic/light-neutral + graphite with restrained teal/cyan status language;
- avoid frontal cabinet/side-view logic incompatible with the gameplay camera;
- avoid villain-black cliché;
- keep central patrol/work area open;
- wall protrusion/collision is explicit authored metadata.

Use/revise `art-source/recipes/transfer-hall/primus-console/recipe.md` before production.

## NEXT — Asset Block D: useful domestic replacements

Only after Transfer and PRIMUS hierarchy is strong, replace blockouts that materially improve Family habitation:

- Child Bed;
- Toy / personal storage;
- Hygiene fixture/support;
- any surviving named functional placeholder.

Prefer a few convincing objects over generic density.

## NEXT — Asset Block E: full-room cohesion / candidate disposition

Once the major missing production assets exist:

1. review Coffee Machine, Round Plant, Planter Trough and Hologram in the complete composition;
2. explicitly accept/revise/remove each candidate;
3. remove obsolete blockouts;
4. add restrained grounding/contact shadows where still missing;
5. add subtle floor use/wear only where it tells room function/history;
6. converge lighting hierarchy with Transfer as the primary restrained warm local focus;
7. verify that Family feels lived-in and PRIMUS feels ordered without visual noise;
8. do not repaint accepted Floor/Walls merely because the room becomes richer.

## GATE — Asset Block F: Gold-Slice live acceptance

Run the generated TS-01 as one finished room:

- desktop QA;
- phone landscape QA;
- movement/collision QA;
- hierarchy/readability QA;
- blockout audit;
- final Art-Director/gameplay acceptance.

Only after this gate should Generated TS-01 be considered the representative Gold Slice.

## AFTER THIS GATE — Transfer choreography / animation polish

The accepted static Apparatus/Core are deliberately animation-ready, but **animation is not the current next visual priority** while the surrounding Gold Slice remains sparse.

After the static room reaches the representative quality bar, proceed to:

- Human → Core → PICO choreography;
- body → body Transfer choreography;
- Core movement;
- synchronization/beam/energy FX;
- scripted actor placement/collision overrides during Transfer.

This order prevents polishing a complex animation sequence inside a room whose supporting visual language is still changing.

---

# 7. Production / iteration rules reinforced by Transfer Hero work

Every visual issue must be classified before taking action:

```text
FUNCTION / SOURCE DESIGN
PERSPECTIVE / STYLE
RUNTIME CROP / SCALE / PADDING
PLACEMENT / ROOM COMPOSITION
COLLISION / USE-SPACE
SHADOW / GROUNDING
MOVABLE FX / CHOREOGRAPHY
```

Only source/function/perspective failures normally justify a new source generation. Runtime scale/collision/shadow problems should use deterministic production/runtime tools first.

Additional proven rules:

- physical size and Hero prominence are separate art-direction questions;
- PNG alpha is not collision authority;
- shaped physical collision can be authored as deterministic occupancy/silhouette metadata while preserving transparent whitespace;
- finalize useful runtime scale before freezing a shadow;
- movable components that must later transition between environment and actors should not be forced into normal static Prop semantics.

---

# 8. Generated runtime integration rule

Current generated composite presentation now includes the accepted movable Core layer:

```text
Ground
→ FloorFX / Shadows
→ Architecture
→ WallProp fallback / production WallProps
→ FloorProp fallback / production FloorProps
→ transfer-fx / other explicit movable visuals as authored
→ runtime Characters / interaction layers
```

Normal Prop presentation still uses `src/levelgen/propArtRegistry.ts`.

Spatial truth remains in:

- `propRegistry.ts`;
- `propCollisionRegistry.ts`;
- Exact-Fit metadata/validation;
- semantic LevelSpec/placement.

Do not use raster pixels as implicit runtime gameplay geometry.

---

# 9. Gold-Slice visual QA gate

Evaluate TS-01 as one composition.

## Hierarchy

- Is Transfer unmistakably the strongest environmental focal point?
- Do Flow/support assets reinforce rather than compete with it?
- Does Family remain personal/warmer?
- Does PRIMUS read ordered/competent without stealing the hero role?

## Spatial plausibility

- Are objects placed where humans/robots would plausibly use them?
- Are thresholds clean?
- Are support objects coherent clusters rather than filler?
- Does transparent space around silhouettes remain meaningfully navigable?

## Runtime coherence

- Do sprites/shadows/collision align?
- Do accepted walls/doors remain unchanged?
- Does Sentry patrol remain visually clear?
- Does no new asset violate Door Clearance/use-space?

## Gameplay scale

- Do functions read on desktop?
- Do they still read on phone landscape?
- Is density rich enough to feel finished without becoming noisy?

## Numberdroid identity

- avoid generic dark military sci-fi;
- keep CORE/SLOT/Transfer visual grammar recognizable;
- Transfer should feel empowering before narrative reversal;
- Family should feel lived-in rather than lobby-like;
- PRIMUS should feel competent/systematic rather than cartoon-villainous.

---

# 10. Exit criteria

Generated TS-01 is Gold-Slice accepted only when:

1. important semantic blockouts have been replaced or deliberately removed;
2. Transfer/Flow/PRIMUS hierarchy is visually coherent;
3. Family spaces read as inhabited with a deliberately limited asset set;
4. candidate Family art has explicit disposition;
5. accepted spatial/runtime regression gates remain green;
6. desktop and phone live QA pass;
7. Klaus explicitly accepts the room as the representative quality bar.

Only then decide whether Generated TS-01 replaces the hand-authored reference as canonical campaign Floor.

`CI green`, `merged`, `deployed`, `spatially accepted`, `asset accepted` and `Gold Slice accepted` remain distinct states.
