# Numberdroid — Procedural Level Compiler

Status: **CURRENT architecture / implementation track — v0.13.2 stabilization LIVE QA ACCEPTED; Generated TS-01 feature/art parity is CURRENT**

Acceptance record: `V0132_STABILIZATION_ACCEPTANCE_2026-08-16.md`.

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
Prop placement + rotation-aware coarse anchors/reservations
        ↓
Exact / True-Space Prop Fit
  visual bounds + collision parts + placement envelopes
        ↓
Encounter / Actor placement + routes
        ↓
Trigger Zones + Pickups + Trigger/Event programs
        ↓
Tiled-compatible runtime emission
        ↓
Prop / Actor presentation registries
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
- Connections / Doors / Access Keys;
- Prop, Encounter, Route, Trigger Zone, Trigger, Event and Staged Actor intent;
- semantic Overrides;
- semantic validation/reachability;
- TS-01 reference spec.

### v0.1 — geometry + Shared Wall Graph — IMPLEMENTED

See `GEOMETRY_AND_WALL_GRAPH.md`.

- deterministic preferred-size geometry;
- canonical shared boundaries instead of room-owned double walls;
- real connection apertures;
- Door Clearance rectangles;
- exact TS-01 geometry regression coverage.

### v0.2 / v0.3.1 — navigation + forbidden-zone hardening — IMPLEMENTED

See `NAVIGATION_AND_FORBIDDEN_ZONES.md`.

- walkable-cell graph and real portal links;
- primary circulation skeleton;
- wall attachment slots;
- widened real-door clearance with 2× aperture lateral span;
- downstream Props/Actors consume the same reservations.

### v0.3 / v0.10 — Prop placement + rotation-aware geometry — IMPLEMENTED

See `PROP_PLACEMENT.md`.

- placement order `hero → support → furniture → dressing`;
- real wall-slot placement;
- footprint vs use-space / Hero-clearance separation;
- semantic scoring/rejection diagnostics;
- explicit authored rotations;
- non-square footprints rotate physically before validation;
- deterministic candidate stability.

### v0.4 — Encounter / Actor placement — IMPLEMENTED

See `ACTOR_PLACEMENT.md`.

- Actors consume furnished/reserved free space;
- neutral / guard / patrol / aggressive authoring intent;
- generated routes use actual remaining navigation;
- Actor facing and diagnostics;
- single-room patrol interior preference protects large visible sprites from room fascia when a safe interior exists.

### v0.5 — Trigger / Event compilation — IMPLEMENTED

See `TRIGGER_EVENT_COMPILATION.md`.

- semantic Trigger Zones;
- Access Pickup materialization;
- Staged Actors;
- ordered Trigger → Event programs;
- invalid-reference / suspicious-loop diagnostics.

### v0.6 / v0.7 — Runtime/Tiled emission + playable generated Floor — IMPLEMENTED / MANUALLY QA'D

See `RUNTIME_TILED_EMISSION.md` and `PLAYABLE_GENERATED_PREVIEW.md`.

- full authoring plan emits to the existing Tiled/`FloorDefinition` boundary;
- generated Shared Walls, Doors, Props, Pickups, Encounters and patrol routes use normal runtime systems;
- compiler-only layers preserve richer semantic data;
- `?floor=ts01-generated` executes generated TS-01 in normal `MetaGame`.

### v0.7.1 — scale/performance hardening — IMPLEMENTED / MANUALLY QA'D

- generated background collapsed from per-cell React presentation into static imagery;
- accepted 30 px wall fascia remains visually separate from 10 px collision core;
- cached obstacle index introduced;
- desktop and real-mobile driving manually confirmed smooth.

### v0.8 / v0.8.1 — persistent Trigger/Event runtime + scheduler — IMPLEMENTED / MANUALLY QA'D

See `TRIGGER_EVENT_RUNTIME.md`.

- persistent Trigger IDs, flags, Door overrides, Staged Actor state and Story Beat queue;
- ordered Event execution;
- blocking Story Beats pause Player/Actors;
- persisted absolute deadlines for delays/timers;
- scheduler remains outside movement RAF loops.

Generated TS-01 access and Transfer Story Beat behavior were manually confirmed live.

### v0.9 — Scripted / Staged Actor presentation — IMPLEMENTED / MANUALLY QA'D

See `STAGED_ACTOR_PRESENTATION.md`.

- non-combat Staged Actors remain separate from Encounters;
- route/pass-by pose derives from semantic state + compiled routes;
- frame coordinates are not persisted;
- blocking pauses freeze route clocks safely.

Bio-Ark proof remains `?floor=bioark-passby`.

### v0.11 — cyclic / multi-constraint topology — IMPLEMENTED

See `MULTI_CONSTRAINT_TOPOLOGY.md`.

- existing valid tree-compatible layouts are preserved exactly;
- deterministic bounded fallback solves cycles/multiple simultaneous constraints;
- preferred sizes may vary within authored ranges only when required;
- TS-01 remains on its compatibility path rather than being rerolled.

### v0.12–v0.12.4 — semantic Workbench authoring — IMPLEMENTED / MANUALLY QA'D

See:

- `OVERRIDES_AND_WORKBENCH.md`;
- `WORKBENCH_MOBILE_INTERACTION.md`;
- `WORKBENCH_AUTHORING_V0123.md`.

Capabilities include:

- constraint-aware Space geometry Locks;
- singleton Prop placement Locks;
- `preferredWall`, `preferredSide`, local `seedSalt`;
- full-compiler validation before edit commit;
- mobile tap/pan/pinch + bottom-sheet Inspector;
- selectable Encounter Actors and typed robot substitution;
- Undo/Redo of accepted semantic Override snapshots;
- browser-local Drafts distinct from canonical repository truth;
- `WHY BLOCKED?` explanations;
- effective Actor body labels while stable Encounter IDs remain internal.

### v0.13 — Prop / Art emission — IMPLEMENTED

See `PROP_ART_EMISSION.md`.

Binding separation:

```text
Spatial Prop Registry
  placement / coarse footprint / true-space metadata
          ↓
Prop solver + Exact Fit
          ↓
Prop Art Registry
  asset / shadow / review state only
          ↓
ordered composite Floor visual
```

Current generated TS-01 maps real accepted/candidate Family art into the compiled room while unmapped Props remain deterministic blockouts.

Generated layer order:

```text
Ground
→ FloorFX / Shadows
→ Architecture
→ WallProp blockout fallback
→ WallProps
→ FloorProp blockout fallback
→ FloorProps
→ runtime Characters / Doors / UI
```

No per-cell React rendering is reintroduced.

### v0.13.1 — first Exact Prop Fit model — IMPLEMENTED, SUPERSEDED WHERE NOTED

v0.13.1 introduced explicit:

- `visualBoundsTiles`;
- collision bounds;
- `placementEnvelope`;
- `wallBoundary`;
- shared sprite/shadow/collision sub-tile translation.

Its original assumption that final true object space must remain inside the coarse integer tile anchor was disproven by live QA and is superseded by v0.13.2.

### v0.13.2 — Gold Slice spatial/presentation stabilization — IMPLEMENTED / LIVE QA ACCEPTED

See `PROP_EXACT_FIT.md`, `GOLD_SLICE_REGRESSION_GATES.md` and `V0132_STABILIZATION_ACCEPTANCE_2026-08-16.md`.

Binding stabilized behavior:

- `footprintTiles` is the deterministic coarse anchor/reservation, **not** mandatory final world-space containment;
- source-local true-space bounds/parts remain explicit semantic metadata;
- Exact Fit may apply the minimum sub-tile translation beyond the object's own coarse anchor;
- translated geometry is revalidated against containing-room surfaces, other Prop true-space envelopes, foreign use-space/Hero reservations and Door Clearance;
- Family Table uses multipart collision, preserving navigable seat gaps;
- Hologram physical pedestal is 0.70 × 0.70 tiles;
- fallback blockouts cannot bleed through visible wall fascia;
- large single-room patrols prefer a safe interior instead of room-edge cells when possible;
- hand-authored and compiler-generated Gold Slice Floors share the accepted Door presentation/timing contract;
- Door baseline remains 5 px leaf, 520 ms opening, 650 ms soft close, aperture clipping and wall-pocket retraction.

Klaus explicitly confirmed the deployed/generated v0.13.2 stabilization pass on 2026-08-16.

A smaller issue with the player's own in-game model/presentation is known but deliberately deferred for separate discussion. It does not block the stabilization acceptance or the next Art Asset block.

## Workbench / runtime proof links

Semantic Workbench:

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

docs/level-generation/
    compiler architecture + technical contracts

src/levelgen/specs/
    canonical declarative intent for one Floor

spatial registries / metadata
    placement, true-space physical/composition contracts

presentation registries
    asset bindings + visual review state only

semantic Override[]
    reviewed local exceptions / locked composition

src/levelgen/
    executable compiler / validators / solvers

compiled Tiled/FloorDefinition + typed script contract
    runtime output, never high-level authoring truth
```

When a recurring defect is found, prefer fixing a reusable rule/metadata contract instead of manually patching every Floor.

## Current task list / next stages

1. **Generated TS-01 feature/art parity — CURRENT.** v0.13.2 stabilization is accepted. Add the missing deliberate production assets/bindings, beginning with the Transfer/Flow hero hierarchy and PRIMUS system/hero objects, then replace useful remaining blockouts. Preserve accepted Walls/Doors/Family assets. Candidate art remains candidate until explicit Art-Director promotion.
2. **TS-01 Gold Slice cohesion/final QA.** Add only justified FloorFX/grounding/use-wear/light support, compare Generated TS-01 against the intended room quality bar on desktop and phone, and require explicit visual/gameplay acceptance before the generated Floor may replace the hand-authored reference.
3. **Additional archetype stress Floors.** Dense PRIMUS/system layout, larger ship layout and larger Bio-Ark/natural layout to expose missing reusable rules before campaign-scale production.
4. **Natural-language front-end.** Translate rough Level Designer instructions into typed/inspectable LevelSpec; LevelSpec remains canonical.
5. **Workbench usability/canonical write-back pass.** Extend Connection editing, per-instance Overrides where production proves necessary, import/apply/reviewed repository write-back and richer diffs/diagnostics without creating a second tile editor.
6. **Campaign production workflow.** Validate repeatable authoring for the planned Floor set and asset-library growth.
7. **FINAL PERFORMANCE & SCALE PASS.** Explicit desktop + real-mobile runtime profiling and compiler stress testing before production readiness.
8. **FINAL AGENT AUTHORING GUIDE — LAST STEP.** Write the final operational guide only after the production/compiler workflows stop changing materially.

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
├─ composite Prop art / DOM image count
└─ React renders / frame-time consistency

Compiler
├─ topology search nodes / backtracks
├─ geometry solve time
├─ Prop placement time
├─ true-space Exact Fit / collision emission
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

Binding examples include:

- adding a Prop rotation preserves unchanged candidate seed identity;
- v0.11 does not rerun an already-valid tree-compatible layout;
- Workbench `seedSalt` changes only the target semantic seed;
- Geometry/Prop locks preserve reviewed local composition while the compiler revalidates dependent systems;
- adding/replacing a Prop Art Registry entry does not reroll spatial placement;
- Exact Fit refines true-space art/collision without becoming a second topology solver;
- adding a new production asset must not silently redefine gameplay geometry from its PNG dimensions or alpha.
