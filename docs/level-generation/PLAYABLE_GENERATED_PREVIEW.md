# Numberdroid — Playable Generated Preview

Status: **v0.7 integration contract + v0.7.1 runtime-QA hardening**

v0.7 is the first stage where a Floor produced by the procedural Level Compiler is registered in the existing game and driven by the real `MetaGame` runtime.

```text
LevelSpec
→ compiler v0.1–v0.5
→ v0.6 Tiled/FloorDefinition emission
→ presentation-only compiler preview
→ normal FLOORS registry
→ existing MetaGame / DoorLayer / HostileLayer / save collision helpers
```

The accepted hand-authored Transfer Hall remains unchanged. The generated Floor is a separate QA target.

## Preview URL

```text
?floor=ts01-generated
```

The friendly preview alias resolves to the generated TS-01 Floor. The canonical `FloorDefinition.id` remains the semantic LevelSpec id, so save/runtime references continue to use the compiler identity rather than the URL alias.

## What is real runtime behavior

The following data comes directly from v0.6 emission and is consumed by the existing game systems without a generated-level-specific movement/runtime fork:

- solved player start;
- Walkable rectangles;
- Shared-Wall-derived obstacle collision;
- Prop footprint collision;
- embedded Door objects;
- locked-door / access-key behavior;
- generated Pickup position;
- generated Encounter home positions;
- generated Patrol path;
- normal PICO movement/camera/collision;
- normal DoorLayer animation and door collision;
- normal HostileLayer encounter/perception runtime.

`pointWalkable()` and the existing closed-door collision path remain authoritative. v0.7 does not add a second generated-level collision model.

## v0.7.1 — runtime QA hardening

The first side-by-side QA against the hand-authored Transfer Hall exposed two integration problems:

1. generated movement became less homogeneous;
2. the blockout's visual scale language no longer matched the accepted Transfer Hall closely enough.

Both are treated as runtime/presentation defects, not as reasons to change semantic room geometry or the 64 px compiler grid.

### Static preview image instead of React tile proliferation

The first playable preview rendered generated Ground, wall masks and Prop masks as many individual tile DOM nodes. That was useful for initial proof, but it unnecessarily increased the amount of composited DOM moved by the camera every animation frame.

v0.7.1 changes the presentation-only preview to **one static generated SVG image**:

```text
compiler geometry
→ one SVG illustration
→ one FloorVisual image node
```

Runtime collision is unchanged and still comes from the emitted `FloorDefinition`.

The SVG contains:

- semantic room/corridor fills;
- a lightweight 64 px reference grid;
- canonical Shared Walls;
- one visual blockout silhouette per placed Prop instance.

This keeps the preview cheap to move with the camera while preserving the exact same generated gameplay floor underneath.

### Visual wall scale

The initial preview used an 8 px debug edge although the accepted Transfer Hall established a much stronger visible wall language.

v0.7.1 therefore uses:

```text
visible compiler-preview fascia = 30 px
runtime collision core           = 10 px
```

These must remain separate concepts. The 30 px fascia is presentation; the 10 px collision core remains physical truth.

This restores the established room-scale cue without changing tile size, robot size, room dimensions or collision geometry.

### Prop blockout scale

The first preview painted every occupied Prop cell as a separate full-tile symbol, making multi-tile objects read as collections of boxes.

v0.7.1 instead draws **one inset silhouette per placed Prop instance** using its solved rectangular footprint and role. Rotation remains the compiler-selected cardinal rotation.

This better represents the mass of a table, Transfer core or service bank while remaining explicitly provisional art.

### Collision hot path

Generated Floors contain more wall obstacle segments than the old hand-authored map. `pointWalkable()` is called repeatedly by both player movement and moving actors, so scanning every obstacle on every query does not scale well with procedural maps.

v0.7.1 adds a cached coarse spatial index for Floors with more than a small number of obstacles. Collision queries only test obstacle rectangles in buckets intersecting the robot's local collision circle.

The result remains mathematically equivalent to the previous rectangle collision test; only candidate selection changes.

## Presentation-only preview

The generated preview is **not** collision truth. It visualizes compiler output while driving the real emitted Floor.

### Wall visualization

Walls are derived directly from the canonical Shared Wall Graph. Every wall segment is emitted exactly once, including shared room boundaries. Door apertures remain gaps because no canonical wall segment exists through an aperture.

### Prop visualization

Placed Props receive generic role language:

- Hero
- Support
- Furniture
- Dressing

These remain temporary QA blockouts only.

## Acceptance tests

Regression coverage verifies:

- the generated Floor is registered under canonical id and preview alias;
- PICO starts on a valid collision-safe position;
- the PRIMUS controlled door remains locked to `primus-access`;
- the generated PRIMUS access card survives into the runtime Floor;
- doorway centers remain physically walkable before DoorLayer collision is applied;
- SENTRY patrol geometry and neutral MAGNETAR behavior survive into runtime Encounter data;
- the playable compiler presentation is one static SVG image;
- the visible wall fascia is 30 px while runtime obstacles remain unchanged;
- every canonical wall is represented once in the generated preview SVG.

## Deliberate boundary

v0.7 / v0.7.1 do **not yet execute** compiler `Trigger` / `Event` programs. Existing runtime behavior such as collecting an access card still works because that capability already exists in `FloorDefinition`/`MetaGame`.

Trigger/Event execution requires explicit persistent runtime state for concepts such as:

- once-fired trigger IDs;
- world flags;
- scripted actor presence/movement;
- blocking Story Beat state.

That state must be added to the clean runtime/save architecture rather than hidden in component-local hacks. This remains the next integration block after playable generated-floor QA.
