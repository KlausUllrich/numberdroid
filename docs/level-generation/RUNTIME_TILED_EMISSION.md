# Numberdroid — Runtime / Tiled Emission

Status: **v0.6 compiler contract**

v0.6 is the first stage that turns the complete generated authoring plan into one Tiled-compatible runtime representation.

```text
LevelSpec
→ semantic graph
→ geometry + Shared Wall Graph
→ navigation + forbidden zones
→ Props + rotations
→ Actors + routes
→ Triggers + Events
→ TiledMapJson                         ← v0.6 canonical emitted representation
→ existing floorFromTiledMap()
→ FloorDefinition                      ← existing gameplay runtime boundary
```

The emitter does **not** introduce another renderer or gameplay map model. The generated Tiled map is immediately round-tripped through the existing `src/game/tiled.ts` importer. If the current runtime contract cannot consume the physical level, v0.6 compilation fails QA rather than silently creating a parallel format.

## 1. Runtime-facing LevelSpec metadata

`LevelSpec.runtime` may now provide small runtime/presentation preferences without reintroducing raw authored coordinates:

- `tileSize` — defaults to 64 px;
- `wallCollisionPx` — defaults to the current 10 px wall collision core;
- display name/subtitle/objectives;
- start Space;
- start body/facing/meta-energy;
- optional preferred side inside the start Space.

The start is still **solved**, not hand-positioned. The emitter selects a valid free cell inside the requested Space after Props, use-space, Door Clearance, Actors, routes and Pickups exist.

## 2. Generic blockout visual

v0.6 ships a generic compiler blockout tileset:

`/assets/levelgen/compiler-blockout-tiles.svg`

It provides simple semantic floor classes for:

- domestic;
- neutral/circulation;
- ritual/Transfer;
- system/PRIMUS.

This is an emission/debug visual only. It is not world art and must not become the final campaign tileset strategy.

## 3. Standard runtime layers

The emitted map contains the same object layers understood by the current importer.

### `Start`

One solved player start point.

### `Walkable`

One rectangle per generated Space.

### `Obstacles`

Contains:

- canonical Shared Wall Graph collision segments using the configured wall collision thickness;
- placed Prop footprints.

Walls are emitted from the canonical graph, so shared room boundaries still produce one collision wall rather than room-owned duplicates. Apertures have already been removed by geometry compilation, so emitted wall collision does not cover doorway openings.

### `Doors`

Every non-opening Connection becomes one runtime Door object located directly in the compiled wall aperture.

- aperture orientation becomes runtime door orientation;
- one-tile aperture → standard door;
- two-or-more-tile aperture → large door;
- access-key lock → runtime locked door with the same stable `keyId`;
- otherwise → automatic door.

The wider authoring Door Clearance remains compiler reservation data; the physical runtime door rectangle itself remains the thin collision/animation barrier in the aperture.

### `Encounters`

Compiled Actor home cells become runtime encounter objects using the existing `EncounterConfig` import path.

Patrol Actors receive their compiled route as the existing `patrolPath` point string. v0.6 therefore proves that generated patrol geometry can cross the current Tiled importer boundary without changing encounter runtime behavior.

### `Pickups`

Compiled access-card placements become the existing runtime Pickup objects with stable `id` and `keyId`.

`EnergyStations` and `Actions` are emitted as empty standard layers until their semantic generators exist.

## 4. Lossless compiler layers

The existing runtime importer intentionally ignores unknown object layers. v0.6 therefore carries the richer authoring/runtime-next data beside the standard layers without breaking current gameplay.

### `CompilerProps`

Preserves every placed Prop instance:

- stable instance/request ID;
- Prop ID;
- Space;
- placement role;
- cardinal rotation;
- wall side;
- semantic tags.

### `ActorRoutes`

Preserves named patrol/pass-by/scripted routes and their generated world-space paths.

### `TriggerZones`

Preserves compiled zone geometry, center, semantic anchor and exact covered tile cells.

### `Triggers`

Preserves resolved trigger kind/source, ordered event IDs, one-shot/delay/radius semantics and compiled source cells.

### `Events`

Preserves event kind, explicit target IDs and the complete typed event payload serialized as JSON for the interchange layer.

### `TriggerEventLinks`

Preserves explicit Trigger → Event order as separate stable links. Event array order must never become an accidental implementation detail.

### `StagedActors`

Preserves non-encounter scripted actors such as future Bio-Ark fauna.

## 5. Coordinate conversion

The authoring compiler works in semantic tile-grid coordinates. v0.6 converts these to world pixels only at the runtime boundary.

For a tile size `T`:

```text
cell center = ((x + 0.5) * T, (y + 0.5) * T)
room rect   = (x*T, y*T, w*T, h*T)
```

Emitter code also accounts for compiler bounds offsets so future geometry is not required to begin at grid coordinate zero.

## 6. Runtime wall collision

A generated wall segment becomes a thin obstacle centered on the canonical wall edge.

Default:

```text
wallCollisionPx = 10
```

This matches the current Transfer Hall collision-core language. Visual wall fascia remains a separate art/rendering concern.

## 7. Determinism

For identical LevelSpec + seed, v0.6 must emit structurally identical:

- Tiled map;
- object IDs/order;
- runtime FloorDefinition after round-trip;
- compiler-only semantic layers.

Regression tests compare complete emitted structures, not only counts.

## 8. Current boundary

v0.6 **does** prove:

- generated geometry can become current-runtime Walkable/Obstacle data;
- Shared Walls/apertures can become collision + Door objects;
- generated access cards become runtime Pickups;
- generated encounters/patrol routes become current Encounter data;
- richer Props/Triggers/Events survive the Tiled interchange representation;
- output round-trips through `floorFromTiledMap()`.

v0.6 does **not yet**:

- execute Trigger/Event programs in gameplay;
- render final generated world/Prop art;
- register the generated TS-01 as the canonical live campaign Floor;
- import the compiler-only layers back into active runtime scripting;
- solve generated EnergyStations/Actions;
- replace current final-art mapping rules.

Those are intentionally separate integration steps.

## 9. Next step

After v0.6 is visually/data-QA accepted, the next block should connect the explicit compiled script contract to runtime execution and/or register a generated preview Floor without replacing the accepted hand-authored TS-01 until parity is proven.
