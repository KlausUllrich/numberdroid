# Numberdroid Tiled Map Contract

VS2 uses Tiled as an authoring format while the game runtime stays independent of the Tiled application. Maps are converted into `FloorDefinition` through `src/game/tiled.ts`.

## Current import scope

The VS2 importer deliberately supports a small, deterministic subset:

- orthogonal finite maps
- JSON-array tile-layer data (not base64/compressed data)
- embedded image tilesets (not external `.tsx` references yet)
- one or more visible tile layers
- rectangle/point object layers for gameplay data

## Required map properties

Set these custom properties on the map:

- `floorId` string — stable save/runtime ID, e.g. `deck-vs2`
- `floorName` string — display name
- `subtitle` string — HUD subtitle
- `objectiveDefault` string — generic exploration objective
- `objectiveAfterEnergy` string — generic objective once energy has been collected

Optional explicit Floor goal properties:

- `goalEncounterId` string — encounter instance that completes the Floor
- `goalLabel` string — HUD objective while the goal is open
- `goalCompletedLabel` string — HUD objective after completion

If `goalEncounterId` is present it must reference a real `encounterId` in the map. The explicit Floor goal takes priority over the generic energy/exploration objective in the HUD.

## Required object layers

### `Start`

Exactly one start object is currently used.

Properties:

- `bodyId`: `pico`, `sentry`, `magnetar`, or `kronos`
- `facing`: number in degrees, optional, default `0`
- `metaEnergy`: integer, optional, default `0`

The object's `x` / `y` are the player start position.

### `Walkable`

One or more rectangle objects. Their rectangles define the areas in which the robot may move. Overlapping rectangles are encouraged for rooms, bends and corridors; Floors do not need to be rectangular arenas.

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
- `boss`: boolean — marks the encounter as an Endgegner visually
- `storyIntro`: short encounter/story setup displayed before the duel

The Tiled object's name is the displayed robot name.

## Visual layers

Tile layers are rendered in map order. Tiled global tile IDs are preserved. The renderer currently supports the horizontal, vertical and diagonal Tiled flip flags.

The current `deck-vs2` map uses a deliberately simple technical tileset. It validates layout, camera, collision, object placement and multi-instance semantics; it is not final art.

## Current B2 layout direction

The technical VS2 Floor is intentionally ship-shaped rather than arena-shaped:

- elongated horizontal silhouette
- bent/S-shaped main route
- side rooms and machinery spaces
- multiple optional branches
- substantially higher enemy density
- bridge/command area at the far end
- boss encounter as the explicit Floor goal

The target is a 10–15 minute Floor in which enemies create route choices rather than a requirement to clear every spawn.

## Planned gameplay object layers

The next interaction layer should extend this contract rather than hard-code behavior in React:

- `Doors` — automatic sliding doors and locked/keyed doors
- `Pickups` — keys/access tokens and other one-off items
- `PatrolPaths` — short named paths used by moving enemy instances
- later explicit exits/transitions once multi-Floor progression is designed

Door collision, key state and patrol simulation are not implemented yet; these names document the intended Tiled-facing architecture.

## Preview mode

The production/default Floor remains A7. A registered Floor can be opened without changing the persistent A7 save by adding:

```text
?floor=deck-vs2
```

Preview state is created fresh when the page loads and is not written to the normal `numberdroid-meta-v3` save.
