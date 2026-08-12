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

For the current B2 direction, large rectangular room rectangles are connected through explicit one-tile doorway rectangles and narrower corridor rectangles. Room-to-corridor openings should therefore be deliberate rather than broad overlapping edges.

### `Obstacles`

Optional rectangle objects. These are subtracted from the walkable space.

### `Doors`

Each rectangle is one doorway/portal area. Doors participate in runtime collision and animate independently of the tilemap.

Required properties:

- `orientation`: `vertical` or `horizontal`

Optional properties:

- object name is the stable door id; otherwise `door-<Tiled object id>` is used
- `openRadius`: proximity radius in world pixels, default `118`
- `mode`: `auto` or `locked`, default `auto`
- `size`: `standard` or `large`, default `standard`
- `keyId`: required when `mode=locked`; matches a key id from `Pickups`
- `label`: short display label such as `BLUE` or `COMMAND`

Automatic doors open when the player approaches. Locked doors remain closed until the matching access card has been collected, then behave like automatic doors. An additional close-distance hysteresis prevents rapid open/close flicker while passing through.

Large gates use larger object rectangles rather than a separate rendering system. Current B2 uses a 64×128 command gate before the bridge.

### `Pickups`

Each object is a collectible access item. Current runtime support is intentionally narrow and deterministic: access cards only.

Required properties:

- `keyId`: stable access identity matched by locked doors

Optional properties:

- object name is the stable pickup id; otherwise `pickup-<Tiled object id>` is used
- `label`: player-facing name such as `BLAUE ZUGANGSKARTE`

Collected pickup ids are part of `MetaState` and survive normal save/reload flows. Preview floors still reset on page reload by design.

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
- `deckSize`: `standard` or `large`, default `standard`; currently controls deck presentation only

Standard deck robots should render smaller than one 64 px tile aperture. Large robots are deliberately exceptional and should generally be placed behind or near large gates. Full body-footprint/pathing semantics for controlled large bodies are intentionally deferred until large body takeover is designed as a persistent gameplay rule.

The Tiled object's name is the displayed robot name.

## Visual layers

Tile layers are rendered in map order. Tiled global tile IDs are preserved. The renderer currently supports the horizontal, vertical and diagonal Tiled flip flags.

The current `deck-vs2` map uses a deliberately simple technical tileset. It validates layout, camera, collision, object placement and multi-instance semantics; it is not final art.

## Current B2 layout / gating direction

The technical VS2 Floor is intentionally ship-shaped rather than arena-shaped:

- elongated horizontal silhouette
- large rectangular rooms as primary play spaces
- explicit one-tile room entrances
- corridors connecting those entrances
- several rooms with multiple possible exits
- high enemy density inside room sections
- bridge/command area at the far end
- boss encounter as the explicit Floor goal

Current access loop:

```text
aft section
  → reactor side room
  → BLUE access card
  → locked security-east door
  → eastern section
  → navigation room
  → COMMAND access card
  → large locked bridge gate
  → large command boss
```

The target is a 10–15 minute Floor in which enemies create route choices rather than a requirement to clear every spawn.

## Next gameplay object layer

The next interaction layer should extend this contract rather than hard-code behavior in React:

- `PatrolPaths` — short named paths used by moving enemy instances
- later explicit exits/transitions once multi-Floor progression is designed

Patrol simulation must remain outside global per-frame React state so it does not regress the currently smooth deck scrolling.

## Preview mode

The production/default Floor remains A7. A registered Floor can be opened without changing the persistent A7 save by adding:

```text
?floor=deck-vs2
```

Preview state is created fresh when the page loads and is not written to the normal `numberdroid-meta-v3` save.
