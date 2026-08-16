# Numberdroid — Procedural Level Compiler

Status: **CURRENT architecture / implementation track — v0.8 trigger/event runtime**

This directory owns the design and technical contract for the Numberdroid procedural/declarative level-authoring system.

The goal is **not** a classic random level generator that invents a completely different Floor every time. The goal is a deterministic, inspectable **Level Compiler**:

```text
natural-language design intent
        ↓
LevelSpec / declarative DSL
        ↓
semantic space + relationship graph
        ↓
constraint solving / topology
        ↓
shared wall graph + doors + corridors
        ↓
navigation + forbidden zones
        ↓
hero / prop placement + allowed art rotations
        ↓
enemy / actor placement + authored routes
        ↓
trigger zones + pickups + trigger/event programs
        ↓
Tiled-compatible runtime emission
        ↓
FloorDefinition + typed script contract
        ↓
existing Numberdroid runtime
```

The existing React/gameplay architecture remains the consuming runtime. The compiler is an **authoring layer in front of it**, not a replacement game architecture.

## Current implementation status

### v0 — semantic foundation — IMPLEMENTED

- typed `LevelSpec`;
- stable seed/sub-seed derivation;
- rooms and corridors as semantic spaces;
- explicit corridor-width constraints;
- room/space connections;
- doors / locked doors / key cards;
- prop requirements backed by metadata;
- encounter/enemy spawn intent;
- trigger and event declarations;
- semantic overrides/locks;
- validation and semantic reachability;
- TS-01 as first reference spec.

### v0.1 — deterministic geometry + Shared Wall Graph — IMPLEMENTED

See `GEOMETRY_AND_WALL_GRAPH.md`.

- preferred room/corridor dimensions;
- deterministic connected-space placement;
- overlap avoidance;
- real shared boundaries;
- one canonical wall graph instead of room-owned duplicate walls;
- apertures cut from the shared wall;
- tree-like connected topology supported deliberately before arbitrary cyclic constraint solving.

### v0.2 — navigation + forbidden zones — IMPLEMENTED

See `NAVIGATION_AND_FORBIDDEN_ZONES.md`.

- walkable cell decomposition;
- portal pairs through real apertures only;
- reachability validation;
- provisional primary circulation;
- wall attachment slots;
- Door Clearance / forbidden-zone basis.

### v0.3 — metadata-driven Prop placement — IMPLEMENTED

See `PROP_PLACEMENT.md`.

- placement order `hero → support → furniture → dressing`;
- real wall slots for wall Props;
- occupied/use-space/door/path rejection;
- approach/use-space and Hero clearance;
- semantic near/wall/corner/center/opposite-door scoring;
- deterministic explainable candidate diagnostics.

### v0.3.1 — clearance + art orientation hardening — IMPLEMENTED

- Door Clearance lateral width = **2× aperture width**, adding half a door width on each side;
- Props declare allowed rotations from `0° / 90° / 180° / 270°`;
- wall convention:

```text
0°   north wall, access south
90°  east wall,  access west
180° south wall, access north
270° west wall,  access east
```

Perspective-sensitive Props cannot be placed on a wall orientation for which no authored rotation exists.

### v0.4 — Encounter / Actor placement — IMPLEMENTED

See `ACTOR_PLACEMENT.md`.

- Actor homes consume furnished/reserved geometry;
- no Actor placement on Props, use-space, Hero clearance or Door Clearance;
- patrol/pass-by/scripted routes through remaining navigable geometry;
- patrol Actors start on route;
- behavior-aware Neutral / Guard / Patrol / Aggressive scoring;
- cardinal facing and explainable diagnostics.

### v0.5 — Trigger / Event compilation — IMPLEMENTED

See `TRIGGER_EVENT_COMPILATION.md`.

- Trigger Zones anchored to Spaces, Connections, Props, Actors, Routes or Pickups;
- Access Pickup materialization;
- Staged Actors for non-combat scripted objects;
- `enter-space`, `enter-zone`, `interact`, `collect`, `state-change`, `proximity`, `timer` source resolution;
- ordered Trigger → Event programs;
- key/door/flag/actor/story events;
- state-loop warnings;
- deterministic source geometry.

### v0.6 — Runtime / Tiled emission — IMPLEMENTED

See `RUNTIME_TILED_EMISSION.md`.

- one-call `LevelSpec → FloorDefinition` compile path;
- orthogonal Tiled-compatible emitted representation;
- standard runtime layers for Start, Walkable, Obstacles, Rooms, Doors, Encounters, Pickups;
- Shared-Wall collision with apertures preserved;
- generated patrol routes converted into existing runtime path format;
- compiler-only layers preserve Props, rotations, routes, zones, Triggers, Events and ordering;
- emitted physical Floor immediately round-trips through the existing `floorFromTiledMap()` importer.

### v0.7 — playable generated Floor — IMPLEMENTED

See `PLAYABLE_GENERATED_PREVIEW.md`.

`?floor=ts01-generated` runs the generated TS-01 through the normal `MetaGame`, Door, collision, Pickup, Encounter and Hostile/Patrol systems. The accepted hand-authored Transfer Hall remains a separate reference Floor.

### v0.7.1 — runtime scale/performance hardening — IMPLEMENTED

Manual desktop/mobile QA exposed two regressions when the generated Floor first became playable.

- compiler QA world collapsed from many React tile nodes into one static SVG image;
- visible wall fascia restored to the accepted **30 px** while physical collision remains **10 px**;
- multi-cell Props now read as one semantic blockout rather than repeated cell symbols;
- procedural Floors use a cached coarse spatial obstacle index in the shared collision hot path;
- regression tests prove indexed collision remains equivalent to brute-force semantics.

Desktop and mobile driving were manually re-verified as smooth after this pass.

### v0.8 — persistent Trigger / Event runtime — IMPLEMENTED / CURRENT

See `TRIGGER_EVENT_RUNTIME.md`.

- `MetaState` v4 owns persistent script run state;
- old v3 global/profile runs migrate forward;
- compiled Floors carry a typed script contract adjacent to the physical `FloorDefinition`;
- immediate `enter-space`, `enter-zone`, `proximity`, `collect`, `interact`, `state-change` edges execute in gameplay;
- once-fired Trigger IDs persist;
- ordered Events update flags, keys, Door overrides and staged Actor state;
- blocking Story Beats pause Player and Hostile/Patrol simulation and require explicit continuation;
- Trigger evaluation stays off the per-frame RAF hot path.

The generated TS-01 now provides the first complete compiler-driven proof:

```text
PRIMUS ACCESS collected
→ compiler Trigger fires once
→ grant key
→ unlock PRIMUS door

Transfer trigger zone entered
→ compiler Trigger fires once
→ blocking Story Beat
→ Player + Actors pause
→ explicit WEITER
```

## Workbench interaction baseline

The live compiler/debug view is the first shell of the future Level Workbench:

- one-finger / left-mouse drag to pan;
- pinch / mouse wheel to zoom around gesture focus;
- `FIT` restores complete generated topology;
- `+` / `−` provide accessible fallback;
- viewport state never mutates LevelSpec or gameplay-camera state;
- all element labels render in one final foreground SVG layer.

Workbench URL:

```text
?levelgen=ts01
```

Playable generated Floor:

```text
?floor=ts01-generated
```

## Why this exists

Manual TS-01 composition proved that local coordinate fixes do not scale to the roughly 25 authored Floors expected for Numberdroid. Reusable design knowledge therefore becomes data and constraints:

- general Numberdroid spatial rules;
- world/archetype rules;
- one-level-specific rules;
- stable seeds/sub-seeds;
- Prop metadata and allowed art orientation;
- room/corridor relationships;
- door/access semantics;
- Actor roles/routes;
- Triggers/Events;
- local overrides/locks.

When a recurring layout defect is discovered, prefer adding a reusable rule or metadata constraint instead of fixing the same class of defect in many authored maps.

## Source-of-truth hierarchy

```text
docs/game-design/LEVEL_DESIGN_RULES.md
    durable spatial/design principles

this directory
    compiler architecture + LevelSpec contracts

src/levelgen/specs/
    declarative intent for one Floor

src/levelgen/
    deterministic compiler / validators / registries

compiled Tiled/Floor data + typed script contract
    runtime output, not high-level authoring truth
```

## Current task list / next stages

1. **v0.8.1 Runtime timing scheduler** — persistent delayed Trigger deadlines + `timer` execution; save/reload must not duplicate or reset timing.
2. **Scripted / Staged Actor presentation** — consume persistent spawn/despawn/move/pass-by state and compiled routes; first Bio-Ark pass-by proof.
3. **Rotated non-square footprint solving** — enumerate true 90°/270° footprints rather than conservatively rejecting them.
4. **Cyclic / multi-constraint topology solver** — extend beyond tree-like Space graphs without sacrificing deterministic/explainable decisions.
5. **Overrides / Workbench editing** — select, lock, move, resize or regenerate one semantic element without destabilizing unrelated areas.
6. **Prop/art emission mapping** — replace semantic blockouts with registered production assets while preserving metadata/rotation/collision contracts.
7. **Generated TS-01 feature/art parity** — make the compiler-generated Floor capable of replacing the hand-authored reference only after explicit QA acceptance.
8. **Additional archetype stress Floors** — dense PRIMUS/system layout, larger ship layout and Bio-Ark/natural layout to expose missing rules before producing the campaign set.
9. **Natural-language front-end** — LLM translates rough Level Designer instructions into LevelSpec; LevelSpec remains canonical and inspectable.
10. **Workbench usability pass** — direct editing, locks, local regeneration, diagnostics/explanations and useful diffing of generated changes.
11. **Campaign production workflow** — validate repeatable authoring for the planned Floor set and asset-library growth.
12. **FINAL PERFORMANCE & SCALE PASS** — explicit desktop + real-mobile profiling before the compiler/runtime pipeline is treated as production-ready.

The final Performance & Scale Pass is a **required task**, not an optional polish step. It must cover at least:

```text
Runtime
├─ Player RAF / camera
├─ Actor RAF
├─ collision / spatial queries
├─ Door / LOS / perception
├─ Trigger evaluation
├─ scripted Actors / pass-bys
└─ React renders / DOM complexity

Compiler
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

Prefer frame-time stability over a misleading average FPS figure. Performance regression guards should be structural/deterministic where possible rather than fragile CI millisecond thresholds.

## Stability rule

A single global PRNG stream is forbidden for authored regeneration. Every semantic object receives a deterministic sub-seed from:

```text
level seed + stable semantic path
```

Changing/regenerating one child-space should not randomly rearrange Transfer or PRIMUS.

## Editing model

Generated output should remain editable through semantic overrides rather than destructive tile painting alone.

```yaml
overrides:
  family.bathroom:
    lockGeometry: true
  family.child:
    offset: [-1, 0]
  transfer.hologram:
    preferredWall: west
```

A later Workbench exposes these through direct manipulation while the persisted representation remains declarative/reproducible.

## Relationship to Tiled

Tiled remains a useful interchange/debug format and the existing runtime importer remains valid. Physical generated Floors continue to cross that boundary. Rich compiler script data is preserved in compiler-only layers and is attached to gameplay through an explicit typed script contract; it must never be recreated as hidden React/DOM behavior.
