# Numberdroid Tiled Map Contract

Numberdroid runtime stays independent of the Tiled application. Maps are converted into `FloorDefinition` through `src/game/tiled.ts`.

Tiled remains valid for hand-authored/debug Floors, but the approved scalable campaign-authoring direction now adds a declarative Level Compiler **upstream** of this contract. Generated Floors should initially compile to the same Tiled/`FloorDefinition` semantics rather than introducing a second runtime map system.

See:

- `docs/level-generation/README.md`
- `docs/level-generation/LEVEL_SPEC.md`
- `src/levelgen/`

## Level Compiler relationship

The intended boundary is:

```text
LevelSpec / constraints
→ topology / shared wall / door / placement compilation
→ Tiled-compatible semantic layers / FloorDefinition
→ existing runtime
```

Tiled object layers therefore remain useful as a compiled target/debug representation for:

- rooms/walkable/obstacles;
- doors and access metadata;
- pickups;
- encounters;
- stations/actions;
- later trigger/event adapters.

The high-level LevelSpec should not duplicate raw tile coordinates when a semantic relationship can express the design intent.

## Current import scope

The runtime importer deliberately supports a small, deterministic subset:

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

For current hand-authored maps, large rectangular room rectangles may be connected through explicit doorway/corridor rectangles. For future compiled maps, these rectangles are outputs of semantic room/corridor geometry rather than the primary level-design language.

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

Large gates use larger object rectangles rather than a separate rendering system.

For generated geometry, a door definition must derive from a real wall aperture. The Level Compiler owns the stronger authoring invariant that door clearance is reserved on both sides and that adjacent rooms share one wall rather than emitting overlapping walls.

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

Each object is one independent robot/encounter instance. Multiple encounters may use the same robot body.

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
- behavior/perception/path properties supported by the current importer/runtime

Standard deck robots should render smaller than one 64 px tile aperture. Large robots are deliberately exceptional and should generally be placed behind or near large gates. Full body-footprint/pathing semantics for controlled large bodies remain a separate gameplay rule.

The Tiled object's name is the displayed robot name.

## Visual layers

Tile layers are rendered in map order. Tiled global tile IDs are preserved. The renderer currently supports the horizontal, vertical and diagonal Tiled flip flags.

Technical maps may use simple placeholder tilesets to validate layout, camera, collision, object placement and multi-instance semantics; they are not automatically final art.

## Access / gating direction

Existing Tiled content already proves a data-driven access loop through `Pickups` + locked `Doors`. The LevelSpec layer should reference the same stable key/door identities and later add progression validation so a required key cannot accidentally be generated behind its own lock.

## Trigger / event direction

The declarative LevelSpec now reserves first-class triggers/events for future compilation, including access events, one-shot staging, actor pass-bys and world-specific scripted moments.

Do not hard-code those future beats into React components. When runtime execution is implemented, extend the Floor/Tiled data contract or an adjacent explicit compiled contract so stable trigger/event IDs survive the compiler boundary.

## Patrol / route direction

Patrol simulation remains outside global per-frame React state so it does not regress smooth deck scrolling.

The LevelSpec may declare named semantic routes. A later geometry stage converts those route intents into the point/path form consumed by encounter/runtime systems.

## Preview mode

A registered Floor can be opened without changing the persistent default save by adding a `?floor=<floor-id>` query parameter where supported by the current registry.

Preview state is created fresh when the page loads and is not written to the normal persistent save.
