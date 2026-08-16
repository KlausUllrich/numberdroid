# Numberdroid — Procedural Level Compiler

Status: **CURRENT architecture / implementation track — v0.11 cyclic / multi-constraint topology**

This directory owns the design and technical contract for the Numberdroid deterministic/declarative level-authoring system.

The goal is **not** a classic random level generator. The goal is an inspectable Level Compiler that turns semantic design intent into a reproducible playable Floor:

```text
natural-language design intent
        ↓
LevelSpec / declarative DSL
        ↓
semantic space + relationship graph
        ↓
topology / geometry constraint solving
        ↓
Shared Wall Graph + doors + corridors
        ↓
navigation + forbidden zones
        ↓
Prop placement + rotation-aware physical footprints
        ↓
Encounter / Actor placement + routes
        ↓
Trigger Zones + Pickups + Trigger/Event programs
        ↓
Tiled-compatible runtime emission
        ↓
FloorDefinition + typed script contract
        ↓
existing Numberdroid runtime
```

The existing React/gameplay runtime remains the consumer. The compiler is an **authoring layer in front of it**, not a replacement game architecture.

## Current implementation status

### v0 — semantic foundation — IMPLEMENTED

- typed `LevelSpec`;
- stable semantic IDs and sub-seeds;
- rooms/corridors as semantic Spaces;
- `TileRange` sizing;
- Connections / Doors / Access Keys;
- Prop requests backed by registries;
- Encounter intents;
- Routes;
- Trigger Zones, Triggers and Events;
- Staged Actors;
- semantic Overrides;
- validation and semantic reachability;
- TS-01 reference spec.

### v0.1 — geometry + Shared Wall Graph — IMPLEMENTED

See `GEOMETRY_AND_WALL_GRAPH.md`.

- deterministic preferred-size geometry;
- real shared boundaries;
- collision-avoiding edge slides;
- canonical shared wall graph;
- real apertures cut from walls;
- Door Clearance rectangles;
- exact TS-01 geometry regression coverage.

### v0.2 — navigation + forbidden zones — IMPLEMENTED

See `NAVIGATION_AND_FORBIDDEN_ZONES.md`.

- walkable cell decomposition;
- portal links only through real apertures;
- reachability validation;
- primary circulation skeleton;
- wall attachment slots;
- Door Clearance as authoring forbidden zones.

### v0.3 — metadata-driven Prop placement — IMPLEMENTED

See `PROP_PLACEMENT.md`.

- hierarchy `hero → support → furniture → dressing`;
- real wall-slot placement;
- footprint vs use-space separation;
- Hero clearance;
- hard rejections for collision / clearance / circulation;
- semantic scoring for wall/corner/near/center/opposite-door intent;
- explainable candidate/rejection diagnostics.

### v0.3.1 — clearance + art orientation hardening — IMPLEMENTED

- real-door lateral clearance = **2× aperture width**;
- explicit per-Prop `allowedRotations` from `0/90/180/270`;
- binding wall convention:

```text
0°   north wall · front/access south
90°  east wall  · front/access west
180° south wall · front/access north
270° west wall  · front/access east
```

Perspective-sensitive art is never rotated into an unsupported orientation.

### v0.4 — Encounter / Actor placement — IMPLEMENTED

See `ACTOR_PLACEMENT.md`.

- Actors consume furnished/reserved free space;
- neutral / guard / patrol / aggressive placement intent;
- patrol/pass-by/scripted Routes through actual remaining navigation;
- Actor facing;
- deterministic diagnostics;
- no duplicate collision/reservation model.

### v0.5 — Trigger / Event compilation — IMPLEMENTED

See `TRIGGER_EVENT_COMPILATION.md`.

- semantic Trigger Zones;
- Access Pickup materialization;
- Staged Actors;
- `enter-space`, `enter-zone`, `interact`, `collect`, `state-change`, `proximity`, `timer`;
- ordered Trigger → Event programs;
- key / door / flag / Actor / Story events;
- deterministic source geometry;
- invalid-reference and loop diagnostics.

### v0.6 — Runtime / Tiled emission — IMPLEMENTED

See `RUNTIME_TILED_EMISSION.md`.

- one-call semantic compile to runtime representation;
- Tiled-compatible interchange;
- Start / Walkable / Obstacles / Rooms / Doors / Encounters / Pickups;
- Shared-Wall collision;
- generated patrol routes mapped into the existing runtime contract;
- compiler-only layers preserve rich Props/Routes/Triggers/Events;
- emitted physical Floor round-trips through existing `floorFromTiledMap()`.

### v0.7 — playable generated Floor — IMPLEMENTED

See `PLAYABLE_GENERATED_PREVIEW.md`.

`?floor=ts01-generated` executes the generated TS-01 in the normal `MetaGame` runtime without replacing the hand-authored Transfer Hall reference.

### v0.7.1 — runtime scale/performance hardening — IMPLEMENTED / MANUALLY QA'D

- generated QA world collapsed from many React tiles into one static SVG image;
- visible wall fascia restored to 30 px while collision remains 10 px;
- semantic Prop blockouts instead of repeated cell DOM nodes;
- coarse cached obstacle index for procedural Floors;
- collision-equivalence regression tests;
- desktop and real-mobile driving manually confirmed smooth.

### v0.8 — persistent Trigger / Event runtime — IMPLEMENTED / MANUALLY QA'D

See `TRIGGER_EVENT_RUNTIME.md`.

- `MetaState` v4 persistent script state;
- fired Trigger IDs;
- world flags;
- Door overrides;
- Staged Actor state;
- Story Beat queue/active state;
- immediate Trigger execution;
- ordered Event execution;
- blocking Story Beats pause Player and Actors;
- v3 Save migration;
- Trigger evaluation outside the movement RAF hot path.

TS-01 proof:

```text
PRIMUS ACCESS collected
→ compiler Trigger fires once
→ key granted
→ PRIMUS door unlocked

Transfer Trigger Zone entered
→ blocking Story Beat
→ Player + Actors pause
→ explicit WEITER resumes
```

### v0.8.1 — persistent timing scheduler — IMPLEMENTED

See `TRIGGER_EVENT_RUNTIME.md`.

- absolute persisted deadlines for delayed Trigger edges;
- `timer` Trigger execution;
- recurring timers without catch-up bursts;
- reload / browser suspend / mobile background-safe overdue execution;
- one deadline-driven timeout plus focus/visibility wakeup;
- deterministic time-injected tests;
- timing remains outside RAF movement loops.

### v0.9 — Scripted / Staged Actor presentation — IMPLEMENTED / MANUALLY QA'D

See `STAGED_ACTOR_PRESENTATION.md`.

- non-combat Staged Actors render separately from Encounters;
- `spawn-actor`, `despawn-actor`, `move-actor`, `actor-passby`;
- route pose derived from compiled route + persistent start/pause time;
- no frame coordinates persisted;
- blocking Story Beats freeze route clocks without jumps;
- one-shot pass-by completion persists;
- semantic Actor presentation catalog + fallback blockout;
- moving Staged Actors own RAF only while active.

Bio-Ark proof:

```text
?floor=bioark-passby
```

The Grazer pass-by has been manually confirmed in the live runtime.

### v0.10 — rotated non-square Prop footprints — IMPLEMENTED

See `PROP_PLACEMENT.md`.

- rotation moved into candidate generation;
- `90°/270°` physically swap non-square width/height;
- collision, use-space, clearance and downstream Actor/Trigger calculations use the rotated rectangle;
- Wall Props only generate candidates for authored/allowed art rotations;
- directional use-space rotates with access direction;
- stable pre-existing candidate seed identity preserved to avoid unrelated rerolls;
- TS-01 Patrol/placement stability regression-tested.

### v0.11 — cyclic / multi-constraint topology — IMPLEMENTED / CURRENT

See:

- `GEOMETRY_AND_WALL_GRAPH.md`
- `MULTI_CONSTRAINT_TOPOLOGY.md`

The geometry stage now has two deliberate paths:

```text
existing incremental/tree-compatible placement
        ↓ complete graph validates?
      yes → preserve exact layout
       no → deterministic multi-constraint search
```

Capabilities:

- cyclic Connection graphs;
- one Space satisfying several already-placed Connections simultaneously;
- bounded deterministic backtracking;
- `required` spatial relations as hard constraints;
- `preferred` spatial relations as soft scoring hints;
- Connection `preferredSide` remains soft;
- integer dimension variation inside authored `TileRange min/preferred/max` when required to satisfy joint topology;
- constrained-space-first search ordering;
- Space-local deterministic candidate tie-breaks;
- explicit search/backtrack/size-adjustment diagnostics;
- incompatible required relations fail loudly;
- downstream Shared Wall / Navigation / Prop / Actor / Runtime contracts unchanged.

A dedicated cyclic regression proves that a preferred `6×4` room can become `7×4` when that is the smallest valid dimension capable of satisfying two independent aperture-width constraints.

Most importantly, existing TS-01 geometry remains exactly on the compatibility path and is not rerolled by the new solver.

## Workbench interaction baseline

The current compiler/debug view is the first shell of the future Level Workbench:

- drag / one-finger pan;
- pinch / mouse-wheel zoom around focus;
- `FIT` restores complete topology;
- `+ / −` fallback controls;
- viewport state never mutates LevelSpec/gameplay camera state;
- all labels render in one final foreground SVG layer;
- toggles exist for geometry, walls, paths, clearance, slots, Props, Actors/Routes and Trigger/Event debugging.

Workbench:

```text
?levelgen=ts01
```

Generated runtime TS-01:

```text
?floor=ts01-generated
```

Bio-Ark Staged Actor proof:

```text
?floor=bioark-passby
```

## Source-of-truth hierarchy

```text
docs/game-design/LEVEL_DESIGN_RULES.md
    durable spatial/design principles

this directory
    compiler architecture + technical contracts

src/levelgen/specs/
    canonical declarative intent for one Floor

registries / metadata
    reusable Prop / Actor / art capabilities

src/levelgen/
    deterministic compiler / validators / solvers

compiled Tiled/FloorDefinition + typed script contract
    runtime output, never high-level authoring truth
```

When a recurring defect is found, prefer fixing a reusable rule/metadata contract instead of manually patching every affected Floor.

## Current task list / next stages

1. **Overrides / Workbench editing** — select, lock, move, resize or regenerate one semantic element without destabilizing unrelated areas. Evolve current post-solve Overrides into first-class constraint-aware authoring controls.
2. **Prop/art emission mapping** — replace semantic blockouts with registered production assets while preserving footprint, rotation, layering, shadow and collision metadata.
3. **Generated TS-01 feature/art parity** — make the generated Floor capable of replacing the hand-authored reference only after explicit visual/gameplay QA acceptance.
4. **Additional archetype stress Floors** — dense PRIMUS/system layout, larger ship layout and larger Bio-Ark/natural layout to expose missing rules before campaign production.
5. **Natural-language front-end** — LLM translates rough Level Designer instructions into LevelSpec; LevelSpec remains canonical, typed and inspectable.
6. **Workbench usability pass** — direct editing, locks, local regeneration, diagnostics/explanations and useful diffs of generated changes.
7. **Campaign production workflow** — validate repeatable authoring for the planned Floor set and asset-library growth.
8. **FINAL PERFORMANCE & SCALE PASS** — explicit desktop + real-mobile profiling and compiler stress testing before production readiness.
9. **FINAL AGENT AUTHORING GUIDE** — **the last step of this development track**. Write the authoritative operational guide for Game Designer and Artist agents only after the tool/workflows are stable: capability overview, LevelSpec authoring, global vs per-Level rules, registries/metadata, rotations/footprints, Actor art, Routes, Triggers/Events, Workbench/Overrides/locks/local regeneration, QA, diagnostics, asset expansion and the decision rule for reusable-system fixes vs one-Level overrides.

The final Agent Authoring Guide is deliberately last so it documents the final accepted workflow instead of becoming stale while the compiler is still changing.

## Required final Performance & Scale Pass

This is not optional polish.

```text
Runtime
├─ Player RAF / camera
├─ Actor RAF
├─ collision / spatial queries
├─ Door / LOS / perception
├─ Trigger evaluation / scheduler
├─ scripted Actors / pass-bys
└─ React renders / DOM complexity

Compiler
├─ topology search nodes / backtracks
├─ geometry solve time
├─ Prop placement time
├─ Actor/path solve time
├─ Trigger compilation
└─ complete LevelSpec → runtime compile time

Memory / scale
├─ FloorDefinition + script size
├─ navigation cells / spatial indices
├─ routes / Trigger Zones
└─ rendered asset count

Stress Floors
├─ TS-01 baseline
├─ large ship Floor
├─ dense PRIMUS Floor
└─ large Bio-Ark Floor
```

Prefer frame-time stability over misleading average FPS. CI guards should be structural/deterministic where possible rather than fragile wall-clock millisecond thresholds.

## Stability rule

A single global PRNG stream is forbidden.

Every semantic object receives deterministic identity from stable semantic paths/sub-seeds. Local changes must not randomly rearrange unrelated accepted content.

This includes several now-binding examples:

- adding a Prop rotation must preserve unchanged candidate seed identity;
- adding the v0.11 topology solver must not rerun an already-valid tree-compatible layout;
- future Workbench local regeneration must preserve locked and unrelated semantic regions.

## Editing model

Generated output should be edited through semantic intent and Overrides, not destructive tile painting as the canonical source.

Conceptual direction:

```yaml
overrides:
  family.bathroom:
    lockGeometry: true
  family.child:
    offset: [-1, 0]
  transfer.hologram:
    preferredWall: west
```

The next Workbench/Overrides block will turn this from a mostly declarative contract into a robust constraint-aware interactive workflow.

## Relationship to Tiled

Tiled remains an interchange/debug/runtime boundary. It is not the canonical high-level authoring model.

Physical generated Floors continue to cross the existing Tiled/FloorDefinition importer boundary. Rich compiler-only semantics remain preserved in typed compiler/runtime data and must never be recreated as hidden DOM or React behavior.
