# Numberdroid — Playable Generated Preview

Status: **v0.13.2 generated spatial/presentation stabilization LIVE QA ACCEPTED; feature/art parity CURRENT**

The generated preview is the live integration target where a Floor produced by the Level Compiler is driven by the real Numberdroid runtime.

```text
LevelSpec
→ semantic compiler
→ geometry / navigation / Props / Actors / Events
→ Tiled/FloorDefinition physical emission
→ typed script contract
→ true-space Exact Fit
→ presentation mapping
→ existing MetaGame runtime
```

The hand-authored Transfer Hall remains a separate reference until generated TS-01 reaches explicit final feature/art/gameplay parity acceptance.

Acceptance record for the current spatial baseline:

`V0132_STABILIZATION_ACCEPTANCE_2026-08-16.md`

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
- precise emitted Prop collision;
- embedded Doors;
- access keys / Pickups;
- generated Encounter positions and patrol routes;
- Trigger/Event programs;
- persistent delayed/timer scheduling;
- blocking Story Beats;
- Staged Actor state/routes;
- normal player movement/camera;
- normal DoorLayer collision/animation;
- normal HostileLayer behavior/perception;
- normal save state.

`FloorDefinition` physical data and existing runtime helpers remain authoritative. The preview never measures rendered DOM or image pixels for collision.

## v0.7.1 — performance architecture

The first playable compiler proof used many individual visual tile nodes. v0.7.1 changed presentation to static generated imagery while leaving physical collision untouched.

Binding scale remains:

```text
visible wall fascia   = 30 px
wall collision core   = 10 px
compiler/runtime grid = 64 px
```

Desktop and real-mobile driving/scale were manually QA'd after this hardening.

The cached obstacle index remains the collision acceleration path for procedural Floors.

## v0.13 — composite presentation

Production PNG assets are intentionally separate from generated static SVG geometry.

Generated composite order:

```text
Ground static SVG
→ FloorFX / registered shadows
→ Architecture static SVG
→ WallProp blockout fallback
→ registered WallProps
→ FloorProp blockout fallback
→ registered FloorProps
```

Characters, Doors, Pickups and other live entities remain normal runtime layers outside the static Floor visual.

This preserves the v0.7.1 performance principle:

- no per-cell React rendering;
- only a small number of static image layers;
- one positioned image per registered Prop/shadow.

## v0.13.2 — accepted true-space stabilization

The first v0.13.1 Exact-Fit model still treated the coarse tile anchor too strongly. v0.13.2 establishes the accepted current contract:

- coarse `footprintTiles` / solved tile rectangle remains deterministic placement anchor/reservation;
- explicit source-local visual bounds, collision parts and placement envelopes describe true object space;
- Exact Fit may apply the **minimum sub-tile correction beyond the object's own coarse anchor**;
- translated geometry is validated against room surfaces, other true-space Prop envelopes, foreign use-space/Hero reservations and Door Clearance;
- sprite, shadow and collision parts share the same translation;
- Family Table uses multipart collision instead of one invisible filled 3×2 block;
- Hologram pedestal uses a 0.70 × 0.70 tile physical collider;
- fallback Prop stubs stay inside the visible room interior;
- sufficiently large single-room PRIMUS patrols prefer safe interior cells rather than room-edge cells;
- hand-authored and generated Gold Slice Floors share the accepted Door presentation/timing contract.

Klaus explicitly accepted the deployed/generated v0.13.2 stabilization pass on **2026-08-16**.

See `PROP_EXACT_FIT.md` and `GOLD_SLICE_REGRESSION_GATES.md`.

## Production Prop art vs blockouts

See `PROP_ART_EMISSION.md`.

Registered art is progressive enhancement. A Prop without a presentation registration remains a deterministic semantic blockout and still has its complete physical/runtime behavior.

Current generated TS-01 includes:

### Accepted art

- Family Table + shadow;
- Family Memory Console + shadow.

### Candidate art

- Coffee Machine + shadow;
- Planter Trough + shadow;
- Round Plant + shadow;
- Hologram Pedestal + shadow.

The v0.13.2 PASS is a spatial/runtime acceptance and does not automatically promote candidate art.

### Important remaining blockouts

- Transfer Core / apparatus;
- Flow Station;
- PRIMUS Service Banks / system hero presentation;
- Child Bed;
- Toy Storage;
- Toilet / hygiene fixture.

Replacing these important blockouts with deliberate production art is the current Gold Slice task.

## Rotation contract

Production sprites use their authored 0° dimensions, centered on the solver/Exact-Fit position and rotated around their center.

Example:

```text
source asset / metadata = 2×1
solver rotation          = 90°
coarse physical anchor   = 1×2
runtime image            = authored 2×1, translated if needed, rotate(90°)
```

The source image is never stretched to the already-rotated physical dimensions and then rotated again.

The same authored-size/rotation/translation rule applies to grounding shadows.

## Trigger/Event runtime

The old v0.7 limitation where Trigger/Event programs were only compiled is obsolete.

Generated TS-01 executes persistent compiler-driven behavior, including:

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

Compiler script state can present non-combat staged actors through compiled routes. The separate Bio-Ark proof remains:

```text
?floor=bioark-passby
```

## Permanent acceptance/regression coverage

Regression coverage must continue to verify at least:

- generated Floor registration / preview alias;
- valid player start;
- physical door-aperture walkability;
- access key / Door contract;
- accepted Door presentation/timing shared across Gold Slice Floor IDs;
- Encounter behavior and safe patrol geometry;
- persistent Trigger/Event integration;
- 30 px visual fascia while wall collision remains 10 px;
- every canonical wall emitted once;
- ordered composite visual layers;
- registered assets in intended layers;
- FloorFX shadows before Architecture;
- wall-safe fallback blockouts;
- authored-size non-square art rotation;
- v0.13.2 true-space/corner fitting;
- pairwise Prop / foreign reservation / Door Clearance safety;
- multipart Family Table collision;
- Hologram physical pedestal size.

## Current acceptance boundary

The **spatial/presentation stabilization baseline is accepted**. The generated room is not yet the final Gold Slice because production-art parity is incomplete.

Current live QA now shifts toward:

- new Transfer Apparatus scale/material/hierarchy;
- Flow relation and FloorFX grounding;
- PRIMUS hero/system presentation;
- useful domestic replacement assets;
- final candidate-art disposition;
- lighting/grounding/cohesion;
- desktop/mobile readability;
- final comparison against the intended Gold Slice quality bar.

A smaller issue with the player's own in-game model/presentation is known and deliberately deferred for separate discussion. Do not treat it as a reason to reopen the accepted v0.13.2 spatial block or regenerate accepted PICO source art without first identifying the concrete issue.

Only explicit final visual/gameplay acceptance can make generated TS-01 eligible to replace the hand-authored reference.
