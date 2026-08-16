# Numberdroid — Encounter / Actor Placement Compiler

Status: **v0.4 compiler contract**

This stage consumes the oriented Prop placement plan and places authored robots/actors plus route geometry into the **remaining valid level space**.

```text
LevelSpec
  ↓
Geometry / Shared Walls
  ↓
Navigation + widened Door Clearance
  ↓
Oriented Prop Placement
  ↓
Actor Placement + Route Geometry   ← this document
  ↓
Trigger / Event Compilation
  ↓
Runtime / Tiled emission
```

The purpose is authoring/layout. Runtime perception, pursuit and physical collision remain owned by the existing gameplay systems.

## 1. One reservation model

Actor placement does not invent a second collision vocabulary.

An actor home/spawn cell is rejected when it is already consumed by:

- a Prop footprint;
- a Prop approach/use-space reservation;
- Hero clearance;
- widened Door Clearance;
- another actor home/spawn.

This means a future level-design rule added to the shared placement/navigation stages can protect Props **and** actors consistently.

## 2. Door Clearance hardening

As of v0.3.1, every real door reserves lateral breathing room equal to **2× its aperture width**:

```text
½ door width | DOOR APERTURE | ½ door width
```

The authored `before` / `after` depth into each connected room remains unchanged.

Actors never receive a home/spawn cell inside this widened threshold zone. This protects readable door approaches and prevents guards/workers from looking accidentally glued to a doorway.

## 3. Behavior-aware spawn scoring

All candidates must first pass hard constraints. Behavior then influences only the ranking of remaining valid cells.

### Neutral

Neutral workers prefer an edge/work-position character and are softly discouraged from standing directly on the provisional primary circulation path.

### Guard

Guards prefer positions that can plausibly watch a threshold/portal while remaining **outside** Door Clearance.

This stage does not create runtime LOS/chase rules; it only chooses a plausible authored home position.

### Patrol

Patrol actors must start on their compiled named patrol route.

### Aggressive / hunter

Aggressive actors prefer more open/central pressure positions and may deliberately relate to primary circulation, while still respecting Door Clearance and furnishing reservations.

## 4. Authored route compilation

`RouteSpec` remains semantic authoring data.

v0.4 converts it into concrete navigation cells **after Props and use-space exist**.

Therefore generated routes cannot silently pass through:

- furniture;
- wall-console operating space;
- Hero clearance;
- widened Door Clearance.

### Single-space patrol

For a patrol contained in one room, the compiler derives several spatially separated free anchor cells and joins them through shortest valid paths. A looped patrol closes back toward its first anchor.

### Multi-space route

For routes spanning several semantic Spaces, the compiler selects a free anchor in each authored Space and joins them in authored order through real navigation portals.

### Pass-by / scripted route

The same route representation is intentionally reusable for later staging events such as a large Bio-Ark animal crossing a visible area once.

## 5. Actor-to-route conflicts

Patrol-route cells are reserved against unrelated static actor homes.

A neutral worker therefore should not be generated standing directly in the middle of another robot's patrol route. The patrol actor itself is required to start on its own route.

This rule is authoring-oriented; runtime actors may of course later move and physically meet.

## 6. Determinism and explainability

Actor candidates receive stable sub-seed tie breaking.

Every `ActorPlacementDecision` records:

- semantic actor/encounter ID;
- Space;
- behavior archetype;
- home cell;
- cardinal facing;
- patrol-route reference when applicable;
- score;
- scoring reasons;
- valid candidate count;
- rejection counts.

The debug Workbench can therefore answer questions such as:

> Why is this worker standing here?

or:

> Why wasn't the Sentry allowed beside the PRIMUS door?

## 7. Facing convention

v0.4 emits cardinal authored facings:

```text
0°   east
90°  south
180° west
270° north
```

A patrol actor faces its next route segment. A static actor faces roughly toward the room interior by default.

This is actor-facing data and is separate from the Prop art-rotation convention.

## 8. TS-01 proof

The current reference spec exercises:

- `primus-magnetar-742` as a neutral worker;
- `primus-sentry-4` as a patrol actor;
- `primus-sentry-patrol` as a looped named route inside PRIMUS;
- both actors respecting PRIMUS furnishing and widened doorway clearance;
- the neutral worker staying off the reserved patrol route.

## 9. Debug preview

`?levelgen=ts01` now visualizes:

- `ACTOR ROUTES`;
- `ACTORS`;
- actor facing;
- behavior category;
- score/reason tooltip;
- the same widened Door Clearance used by the compiler;
- Prop tooltip rotation in degrees.

Pan, wheel zoom, pinch zoom and `FIT` remain unchanged.

## 10. Current limitations / next block

v0.4 does not yet:

- execute runtime guard/hunter behavior;
- compile explicit LOS/cones from LevelSpec;
- model large-body footprints beyond the current cell-level authoring anchor;
- execute trigger/event chains;
- animate pass-by actors;
- emit the generated plan as `FloorDefinition` / Tiled runtime content.

The next compiler block should compile **Triggers / Events / staged actor actions** against stable generated semantic IDs and route geometry. Runtime/Tiled emission can then consume one coherent generated plan.
