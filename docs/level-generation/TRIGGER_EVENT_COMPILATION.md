# Numberdroid — Trigger / Event Compiler

Status: **v0.5 compiler contract**

This stage consumes the fully furnished and actor-populated authoring plan and compiles semantic triggers into deterministic runtime-ready event programs.

```text
LevelSpec
  ↓
SemanticCompilePlan
  ↓
Geometry / Shared Walls
  ↓
Navigation / Forbidden Zones
  ↓
Oriented Prop Placement
  ↓
Actor / Route Placement
  ↓
TriggerEventCompilationPlan   ← this document
  ↓
Runtime / Tiled emission
```

The v0.5 compiler does **not execute gameplay events yet**. It resolves, validates and materializes the authored event graph so runtime emission can consume one coherent plan.

## 1. First-class trigger sources

A Trigger remains authored as a stable semantic ID plus a source and ordered event list.

Supported trigger kinds:

- `enter-space`
- `enter-zone`
- `interact`
- `collect`
- `state-change`
- `proximity`
- `timer`

The compiler resolves the source against the already generated level rather than persisting hand-authored map coordinates.

Examples:

```yaml
- id: enter-transfer-intro
  kind: enter-zone
  sourceId: transfer-intro-zone
  eventIds:
    - play-transfer-intro
  once: true
```

```yaml
- id: collect-primus-access
  kind: collect
  sourceId: primus-access-card
  eventIds:
    - grant-primus-access
    - unlock-primus-door
  once: true
```

Event order inside `eventIds` is binding. The compiled plan emits explicit ordered Trigger→Event links.

## 2. Semantic Trigger Zones

`TriggerZoneSpec` is a generated region, not a raw tile rectangle.

A zone declares:

- stable ID;
- owning semantic Space;
- semantic anchor;
- optional size;
- optional tags.

Supported anchors in v0.5:

```text
space-center
connection
prop
actor
route
pickup
```

Examples:

```yaml
id: transfer-intro-zone
spaceId: transfer-room
anchor:
  kind: space-center
sizeTiles:
  w: 4
  h: 3
```

or later:

```yaml
id: primus-threshold-warning
spaceId: main-hall
anchor:
  kind: connection
  targetId: hall-to-primus
sizeTiles:
  w: 3
  h: 4
```

Zone cells are derived from generated walkable geometry and clipped to their semantic Space. Prop footprints are excluded so an `enter-zone` trigger represents positions the player can actually occupy.

The zone therefore moves with regenerated topology, Props and doors instead of becoming stale coordinate data.

## 3. Pickup source placement

Access pickups are materialized in v0.5 because `collect` triggers require a concrete generated source.

The current deterministic pickup placement:

- stays inside the authored semantic Space;
- rejects Prop footprints;
- rejects Prop approach/use-space and Hero clearance;
- rejects widened Door Clearance;
- rejects actor home cells;
- rejects authored actor-route cells;
- prefers a visible/central position;
- positively scores provisional primary circulation when valid;
- uses stable sub-seeds for ties.

This is intentionally conservative. Future pickup metadata may add wall preference, container placement, concealment, reward hierarchy and explicit `near` relationships.

## 4. Staged non-combat actors

Not every moving object belongs in `EncounterIntentSpec`.

v0.5 adds `StagedActorSpec` for things such as:

- a large Bio-Ark animal briefly crossing a visible route;
- maintenance machinery;
- crowd/background robots;
- scripted transports;
- one-shot story actors.

A staged actor has a stable semantic ID and `actorType`, but does not require combat/math metadata.

Example:

```yaml
stagedActors:
  - id: herd-animal-01
    actorType: bioark-large-herbivore
    initiallyPresent: false
```

This actor can then be referenced by `spawn-actor`, `despawn-actor`, `move-actor` or `actor-passby` events.

## 5. Event types

The schema currently supports:

```text
set-flag
grant-key
unlock-door
lock-door
spawn-actor
despawn-actor
move-actor
actor-passby
story-beat
```

Examples:

```yaml
- id: unlock-primus-door
  kind: unlock-door
  doorId: hall-to-primus
```

```yaml
- id: animal-crosses
  kind: actor-passby
  actorId: herd-animal-01
  routeId: herd-window-pass
  durationMs: 2600
```

```yaml
- id: transfer-first-view
  kind: story-beat
  beatId: ts01.transfer-first-view
  blocking: true
```

`blocking: true` is the current semantic representation for a short authored stopping/staging beat. Runtime presentation and input pausing are deliberately deferred to the runtime execution layer.

## 6. Reference validation

v0.5 fails compilation for structurally invalid event programs.

Examples:

- Trigger references missing Event;
- `enter-zone` references missing Trigger Zone;
- `collect` references missing Pickup;
- actor Event references neither Encounter actor nor Staged Actor;
- actor route Event references missing Route;
- `actor-passby` uses a patrol Route rather than pass-by/scripted Route;
- lock/unlock Event targets an `opening` instead of a real door;
- zone anchor references missing Prop / Actor / Route / Pickup / Connection;
- invalid negative delays/radii/durations.

The generator should fail loudly rather than emit an event graph whose runtime meaning is ambiguous.

## 7. State-loop diagnostic

State triggers may intentionally form event systems, but an obvious self-loop is suspicious:

```text
state-change: alert
  ↓
set-flag: alert
```

If the Trigger is not `once`, v0.5 emits `POTENTIAL_STATE_TRIGGER_LOOP`.

This is currently a warning because a future runtime may use edge-triggered state transitions that make some such graphs valid.

## 8. Explainable compiled programs

`EventCompilationPlan` contains:

- placed Pickup sources;
- generated Trigger Zones;
- staged actor declarations;
- resolved Trigger sources;
- ordered Event definitions;
- explicit Trigger→Event links;
- diagnostics.

A resolved Trigger source knows its source kind, semantic ID, optional Space, optional map point, generated source cells and resolved concrete IDs.

This keeps future Workbench inspection explainable:

> What activates this beat?

> Which exact door is unlocked by this card?

> Which route will this animal use?

> Which generated cells make up this trigger region?

## 9. TS-01 proof

The current TS-01 authoring spec exercises v0.5 without changing the separate live gameplay Floor:

- `hall-to-primus` is semantically access-key locked;
- `primus-access-card` is generated into Family Living;
- collecting it runs two ordered events:
  1. grant `primus-access`;
  2. unlock `hall-to-primus`;
- `transfer-intro-zone` is generated from the Transfer Room center;
- entering it once runs a blocking `ts01.transfer-first-view` Story Beat.

These remain compiler/workbench proofs until runtime emission/execution is connected.

## 10. Workbench visualization and label rule

`?levelgen=ts01` can visualize:

- Trigger Zones;
- generated Pickup sources;
- spatial Trigger markers;
- Trigger→Event program details via tooltips.

### Binding foreground-label rule

**All Workbench element labels render in one final SVG label layer after every graphical/debug layer.**

This applies to:

- Space names/dimensions;
- Prop names;
- Actor names;
- Pickup names;
- Trigger names;
- future selectable semantic-object labels.

No newly added compiler overlay may render after the label layer. This avoids labels disappearing below Props, walls, route lines, Actor markers, Trigger Zones or future validation overlays.

## 11. Current boundary

v0.5 compiles event intent; it does not yet execute it.

Still future work:

- runtime event dispatcher/state machine;
- actual door lock state transitions in generated runtime output;
- story-beat presentation/input-pause execution;
- staged actor spawn/despawn/pass-by execution;
- arbitrary runtime flags and save persistence;
- Workbench editing of Trigger/Zone/Event properties;
- generated `FloorDefinition` / Tiled emission.

The next compiler block should emit **one coherent generated runtime/debug Floor representation** containing geometry, doors, Props, Actors, routes, pickups, zones, triggers and events. Runtime execution can then be connected against that stable emitted contract instead of against separate hand-authored systems.
