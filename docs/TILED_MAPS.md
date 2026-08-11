# Numberdroid Tiled Map Contract

VS2 uses Tiled as an authoring format while the game runtime stays independent of the Tiled application. Maps are converted into `FloorDefinition` through `src/game/tiled.ts`.

## Current import scope

The first VS2 importer deliberately supports a small, deterministic subset:

- orthogonal finite maps
- JSON-array tile-layer data (not base64/compressed data)
- embedded image tilesets (not external `.tsx` references yet)
- one or more visible tile layers
- rectangle/point object layers for gameplay data

This is enough for the current vertical slice and keeps the runtime parser explicit.

## Required map properties

Set these custom properties on the map:

- `floorId` string — stable save/runtime ID, e.g. `deck-vs2`
- `floorName` string — display name
- `subtitle` string — HUD subtitle
- `objectiveDefault` string — objective before any energy station is used
- `objectiveAfterEnergy` string — objective once energy has been collected

## Required object layers

### `Start`

Exactly one start object is currently used.

Properties:

- `bodyId`: `pico`, `sentry`, `magnetar`, or `kronos`
- `facing`: number in degrees, optional, default `0`
- `metaEnergy`: integer, optional, default `0`

The object's `x` / `y` are the player start position.

### `Walkable`

One or more rectangle objects. Their rectangles define the areas in which the robot may move.

### `Obstacles`

Optional rectangle objects. These are subtracted from the walkable space.

### `EnergyStations`

Each object is one independent station instance.

- object name becomes the stable station ID; otherwise `station-<Tiled object id>` is used
- `energy`: integer, optional, default `1`
- `label`: string, optional

### `Encounters`

Each object is one independent hostile-robot instance. Multiple encounters may use the same robot body.

Required properties:

- `enemyId`: `sentry`, `magnetar`, or `kronos`
- `bodyId`: body gained after transfer
- `mode`: current duel mode (`add-easy`, `add-normal`, `add-hard`, `subtract`)
- `mathLabel`: display label such as `+ ZIEL 8`
- `difficulty`: `easy`, `medium`, or `hard`

Optional properties:

- `encounterId`: stable ID; defaults to `encounter-<Tiled object id>`
- `difficultyLabel`
- `rewardLabel`
- `retreatX`, `retreatY`

The Tiled object's name is the displayed robot name.

## Visual layers

Tile layers are rendered in map order. Tiled global tile IDs are preserved. The renderer currently supports the horizontal, vertical and diagonal Tiled flip flags.

The current `deck-vs2` map uses a deliberately simple technical tileset. It validates layout, camera, collision, object placement and multi-instance save semantics; it is not intended as final art.

## Preview mode

The production/default floor remains A7. A registered floor can be opened without changing the persistent A7 save by adding the query parameter:

```text
?floor=deck-vs2
```

Preview state is created fresh when the page loads and is not written to the normal `numberdroid-meta-v3` save.
