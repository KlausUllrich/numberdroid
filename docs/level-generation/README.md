# Numberdroid — Procedural Level Compiler

Status: **CURRENT architecture / implementation track — v0.13 Prop / Art emission mapping**

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

### v0.3 / v0.3.1 — metadata-driven Prop placement + orientation — IMPLEMENTED

See `PROP_PLACEMENT.md`.

- hierarchy `hero → support → furniture → dressing`;
- real wall-slot placement;
- footprint vs use-space separation;
- Hero clearance;
- hard collision / clearance / circulation rejections;
- semantic scoring for wall/corner/near/center/opposite-door intent;
- explicit `allowedRotations`;
- binding wall orientation convention;
- explainable candidate/rejection diagnostics.

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

### v0.7 / v0.7.1 — playable generated Floor + scale/performance hardening — IMPLEMENTED / MANUALLY QA'D

See `PLAYABLE_GENERATED_PREVIEW.md`.

`?floor=ts01-generated` executes generated TS-01 in normal `MetaGame`.

The v0.7.1 hardening collapsed the generated QA world from hundreds of React tiles to static presentation images, restored accepted 30 px wall fascia while collision remains 10 px, and added a cached obstacle index. Desktop and real-mobile driving were manually confirmed smooth.

### v0.8 / v0.8.1 — persistent Trigger/Event runtime + timing scheduler — IMPLEMENTED / MANUALLY QA'D

See `TRIGGER_EVENT_RUNTIME.md`.

- persistent script state in `MetaState`;
- fired Trigger IDs, flags, Door overrides, Staged Actor state, Story Beat queue;
- ordered Event execution;
- blocking Story Beats pause Player and Actors;
- persisted absolute deadlines for delayed triggers;
- `timer` triggers and recurring timers without catch-up bursts;
- reload/browser-suspend/mobile-background safe execution;
- scheduler remains outside movement RAF loops.

TS-01 access and Transfer Story Beat behavior were manually confirmed live.

### v0.9 — Scripted / Staged Actor presentation — IMPLEMENTED / MANUALLY QA'D

See `STAGED_ACTOR_PRESENTATION.md`.

- non-combat Staged Actors remain separate from Encounters;
- `spawn-actor`, `despawn-actor`, `move-actor`, `actor-passby`;
- route pose derived from compiled route + persistent timing state;
- no frame coordinates persisted;
- blocking Story Beats freeze route clocks without jumps;
- one-shot pass-by completion persists;
- semantic Actor presentation catalog + fallback blockout.

Bio-Ark proof:

```text
?floor=bioark-passby
```

The Grazer pass-by has been manually confirmed live.

### v0.10 — rotated non-square Prop footprints — IMPLEMENTED

See `PROP_PLACEMENT.md`.

- rotation moved into candidate generation;
- `90°/270°` physically swap non-square width/height;
- collision, use-space, clearance and downstream Actor/Trigger calculations use the rotated rectangle;
- Wall Props only generate candidates for authored/allowed rotations;
- directional use-space rotates with access direction;
- stable pre-existing candidate seed identity is preserved.

### v0.11 — cyclic / multi-constraint topology — IMPLEMENTED

See `GEOMETRY_AND_WALL_GRAPH.md` and `MULTI_CONSTRAINT_TOPOLOGY.md`.

The geometry stage deliberately preserves the existing tree-compatible solution when it still satisfies the complete graph. If it cannot, bounded deterministic multi-constraint search handles cycles, several simultaneous Connections, hard required relations, soft preferences and integer size variation inside authored ranges.

Existing TS-01 stays on the compatibility path and is not rerolled merely because the more capable solver exists.

### v0.12 — semantic Overrides / Workbench editing — IMPLEMENTED

See `OVERRIDES_AND_WORKBENCH.md`.

Core contract:

- Space Geometry Locks are root-relative compiler-grid geometry;
- Prop Placement Locks are containing-Space-relative placement + rotation;
- `preferredWall`, `preferredSide` and local `seedSalt` remain semantic compiler inputs;
- every proposed edit is recompiled through the full pipeline before commit;
- invalid edits never leave a partial broken Workbench state;
- generated output is never destructively tile-painted as canonical truth.

### v0.12.1 — mobile Workbench interaction hardening — IMPLEMENTED / MANUALLY QA'D

See `WORKBENCH_MOBILE_INTERACTION.md`.

- one-finger tap selects;
- one-finger movement pans;
- two-finger gesture pinches/pans and never commits Selection;
- debug overlays are pointer-transparent;
- narrow screens use a bottom-sheet Inspector with larger touch targets.

Mobile pinch, selection and Inspector behavior were manually confirmed.

### v0.12.2 — constraint-aware direct editing — IMPLEMENTED / MANUALLY QA'D

Direct move/resize controls are preflighted through the complete compiler. Impossible exact one-tile actions are disabled rather than pretending every arrow is legal and then returning an avoidable red error.

The Workbench also records why direct edits are blocked by topology, Door Clearance, navigation, furnishing, route or attachment constraints.

### v0.12.3 — authoring usability: Actors, Undo/Redo, Drafts — IMPLEMENTED / MANUALLY QA'D

See `WORKBENCH_AUTHORING_V0123.md`.

- generated Encounter Actors are selectable;
- SENTRY / MAGNETAR / KRONOS can be swapped through a typed `robotType` Override while Encounter ID, behavior, route and math metadata remain stable;
- Undo/Redo stores accepted semantic Override snapshots only;
- `SAVE DRAFT` persists level/version-specific Override data in the current browser;
- `COPY JSON` remains the portable representation for review/project integration;
- `WHY BLOCKED?` exposes mobile-readable compiler explanations.

Browser Draft data is explicitly **not** canonical repository truth.

The user manually confirmed the v0.12.3 Workbench behavior. A v0.12.4 display-only follow-up also makes the foreground SVG Actor label follow the effective compiled Robot body name while the stable Encounter ID remains internal.

### v0.13 — Prop / Art emission mapping — IMPLEMENTED / CURRENT QA TARGET

See `PROP_ART_EMISSION.md`.

v0.13 connects solved Prop placements to actual registered runtime art without allowing pixels to define gameplay geometry.

Binding architecture:

```text
Spatial Prop Registry
  footprint / rotations / placement rules
          ↓
rotation-aware solved placement
          ↓
Prop Art Registry
  asset / shadow / accepted-or-candidate status
          ↓
ordered composite Floor visual
```

Capabilities:

- new `composite` Floor visual type; existing `image`/`tilemap` Floors remain unchanged;
- presentation-only Prop Art Registry separate from collision/placement metadata;
- accepted Family Table + Memory Console mapped into generated TS-01;
- candidate Coffee Machine, Planter, Round Plant and Hologram Pedestal mapped for integrated visual evaluation without promoting their review status;
- unregistered Props remain deterministic semantic blockouts;
- grounding shadows render in FloorFX before Architecture;
- WallProps and FloorProps are separate explicit presentation layers;
- layer classification follows authored attachment semantics, not incidental `wallSide` placement hints;
- authored 0° image dimensions are retained and rotated around the center of the solved physical footprint, preventing non-square sprite distortion;
- runtime collision / navigation / Doors / Encounters / Triggers remain unchanged;
- no per-cell React rendering is reintroduced.

Generated layer order:

```text
Ground
→ FloorFX / Shadows
→ Architecture
→ WallProp blockout fallback
→ WallProps
→ FloorProp blockout fallback
→ FloorProps
→ runtime Characters / Doors / UI outside the static Floor visual
```

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

this directory
    compiler architecture + technical contracts

src/levelgen/specs/
    canonical declarative intent for one Floor

spatial registries / metadata
    reusable physical placement capabilities

presentation registries
    reusable art bindings and review state

semantic Override[]
    explicit reviewed local exceptions / locked composition

src/levelgen/
    deterministic compiler / validators / solvers

compiled Tiled/FloorDefinition + typed script contract
    runtime output, never high-level authoring truth
```

When a recurring defect is found, prefer fixing a reusable rule/metadata contract instead of manually patching every affected Floor.

## Current task list / next stages

1. **Generated TS-01 feature/art parity** — evaluate v0.13 in the live generated Floor, complete missing production bindings/assets and make the generated Floor capable of replacing the hand-authored reference only after explicit visual/gameplay QA acceptance.
2. **Additional archetype stress Floors** — dense PRIMUS/system layout, larger ship layout and larger Bio-Ark/natural layout to expose missing rules before campaign production.
3. **Natural-language front-end** — LLM translates rough Level Designer instructions into LevelSpec; LevelSpec remains canonical, typed and inspectable.
4. **Workbench usability pass** — extend the accepted Workbench with Connection selection, per-instance Overrides where needed, direct manipulation translated into semantic grid edits, import/apply/write-back workflow, richer diagnostics and useful generated diffs.
5. **Campaign production workflow** — validate repeatable authoring for the planned Floor set and asset-library growth.
6. **FINAL PERFORMANCE & SCALE PASS** — explicit desktop + real-mobile profiling and compiler stress testing before production readiness.
7. **FINAL AGENT AUTHORING GUIDE** — **the absolute last step of this development track**. This assistant writes the authoritative operational guide for Game Designer and Artist agents only after all tool/workflows are stable: capability overview, LevelSpec authoring, global vs per-Level rules, registries/metadata, rotations/footprints, Actor art, Routes, Triggers/Events, Workbench/Overrides/locks/local regeneration, QA, diagnostics, asset expansion and the decision rule for reusable-system fixes vs one-Level overrides.

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
├─ composite Prop art / DOM image count
└─ React renders / frame-time consistency

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

Binding examples include:

- adding a Prop rotation preserves unchanged candidate seed identity;
- v0.11 does not rerun an already-valid tree-compatible layout;
- Workbench `seedSalt` changes only the target semantic seed;
- Geometry/Prop locks preserve reviewed local composition while the compiler revalidates dependent systems;
- adding/replacing a Prop Art Registry entry does not reroll spatial placement or mutate collision.

## Editing and persistence model

Generated output is edited through semantic intent and Overrides, not destructive tile painting.

Workbench history is transient UI state. `SAVE DRAFT` is browser-local continuation state. `COPY JSON` is portable authoring data. The repository `LevelSpec` remains the canonical project source after explicit review/write-back.

## Relationship to Tiled

Tiled remains an interchange/debug/runtime boundary. It is not the canonical high-level authoring model.

Physical generated Floors continue to cross the existing Tiled/FloorDefinition importer boundary. Rich compiler-only semantics remain preserved in typed compiler/runtime data and must never be recreated as hidden DOM or React behavior.
