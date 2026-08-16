# Numberdroid — Playable Generated Preview

Status: **v0.7 runtime integration + v0.7.1 performance hardening + v0.13 composite art presentation**

The generated preview is the live integration target where a Floor produced by the Level Compiler is driven by the real Numberdroid runtime.

```text
LevelSpec
→ semantic compiler
→ geometry / navigation / Props / Actors / Events
→ Tiled/FloorDefinition physical emission
→ typed script contract
→ presentation mapping
→ existing MetaGame runtime
```

The hand-authored Transfer Hall remains a separate reference until generated TS-01 reaches explicit feature/art parity acceptance.

## Preview URL

```text
?floor=ts01-generated
```

The friendly URL alias resolves to the generated TS-01 Floor. Runtime/save identity remains the canonical compiler Floor ID.

## What is real runtime behavior

The generated Floor uses the normal game systems rather than a preview-specific gameplay fork.

Compiler/runtime data drives:

- solved player start;
- Walkable rectangles;
- Shared-Wall obstacle collision;
- Prop footprint collision;
- embedded Doors;
- access keys / Pickups;
- generated Encounter positions and patrol routes;
- Trigger/Event programs;
- persistent delayed/timer scheduling;
- blocking Story Beats;
- Staged Actor state/routes;
- normal PICO movement/camera;
- normal DoorLayer collision/animation;
- normal HostileLayer behavior/perception;
- normal save state.

`FloorDefinition` physical data and existing runtime helpers remain authoritative. The preview never measures rendered DOM or image pixels for collision.

## v0.7.1 — performance architecture

The first playable compiler proof used many individual visual tile nodes. That made camera movement unnecessarily expensive on generated Floors.

v0.7.1 changed the presentation to static generated imagery while leaving physical collision untouched.

The binding wall scale remains:

```text
visible fascia       = 30 px
physical collision   = 10 px
compiler/runtime grid = 64 px
```

Desktop and real-mobile driving/scale were manually QA'd after this hardening.

The cached obstacle index introduced at the same time remains the collision acceleration path for procedural Floors; its result is equivalent to the prior rectangle collision test.

## v0.13 — composite presentation

A single data-URL SVG is excellent for generated geometry but is the wrong container for normal production PNG assets.

v0.13 therefore extends `FloorVisualDefinition` with a presentation-only ordered composite:

```text
Ground static SVG
→ FloorFX / registered shadows
→ Architecture static SVG
→ WallProp blockout fallback
→ registered WallProps
→ FloorProp blockout fallback
→ registered FloorProps
```

This keeps the v0.7.1 performance principle:

- no per-cell React rendering;
- only a small number of static image layers;
- one positioned image per registered Prop/shadow.

Characters, Doors, Pickups and other live entities remain normal runtime layers outside the static Floor visual.

## Production Prop art vs blockouts

See `PROP_ART_EMISSION.md`.

Registered art is progressive enhancement. A Prop without a presentation registration remains a deterministic role-colored blockout and still has full physical/runtime behavior.

Current generated TS-01 mapping includes accepted Family Table and Memory Console art plus several explicitly `candidate` assets for integrated QA. Candidate status does not imply visual acceptance.

## Rotation contract

Production sprites use their authored 0° dimensions, centered over the solver's final physical footprint and rotated around that center.

Example:

```text
source asset / metadata = 2×1
solver rotation          = 90°
physical footprint       = 1×2
runtime image            = 2×1, centered, rotate(90°)
```

The source image is never stretched to the already-rotated physical dimensions and then rotated again.

## Trigger/Event runtime

The old v0.7 limitation where Trigger/Event programs were only compiled is obsolete.

Since v0.8/v0.8.1 the generated Floor executes persistent Trigger/Event state, delayed deadlines and timers. TS-01 live QA has confirmed:

```text
PRIMUS ACCESS collected
→ collect Trigger
→ key granted
→ controlled Door unlocked

Transfer intro zone entered
→ Story Beat activated
→ runtime pauses
→ WEITER resumes
```

## Staged Actor runtime

Since v0.9, compiler script state can present non-combat staged actors through compiled routes. The separate Bio-Ark proof remains:

```text
?floor=bioark-passby
```

## Acceptance tests

Regression coverage verifies at least:

- generated Floor registration / preview alias;
- valid PICO start;
- physical door-aperture walkability;
- access key / Door contract;
- Encounter behavior and patrol geometry;
- persistent Trigger/Event integration;
- 30 px visual wall fascia while runtime obstacles remain unchanged;
- every canonical wall emitted once;
- ordered v0.13 composite visual layers;
- registered production Prop assets in their intended layers;
- FloorFX shadows before Architecture;
- blockout fallback for unmapped Props;
- authored-size non-square art rotation without distortion.

## Current acceptance boundary

Compiler correctness and CI are not the same as visual acceptance.

For v0.13 and the following generated TS-01 parity pass, live QA must separately inspect:

- asset scale;
- rotation / orientation;
- grounding shadows;
- WallProp vs FloorProp layering;
- collisions still matching visual mass reasonably;
- performance on desktop/mobile;
- whether candidate art should be promoted, replaced or left provisional.

Only explicit visual/gameplay acceptance can make generated TS-01 eligible to replace the hand-authored reference.
