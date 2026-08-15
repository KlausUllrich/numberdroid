# Numberdroid Architecture

## Current status

The proven v7 loop now runs in a clean React/TypeScript application and has passed manual desktop/mobile parity validation. GitHub Actions independently validates the production build.

Current top-level flow:

```text
Deck → Encounter → NumberDuel
                   ├─ loss, HP > 0 → Deck
                   ├─ loss, HP = 0 → DestroyedScreen → restart Floor → Deck
                   └─ win → TransferScreen → Deck
```

There are no hidden DOM controls, MutationObserver bridges, reload-based transitions or localStorage message buses between gameplay systems.

## Ownership boundaries

### App

Owns cross-screen state and transitions:
- current body
- pilot/player state
- meta-energy
- HP/damage
- defeated encounter instances
- duel/transfer/destruction transitions
- Floor restart
- fullscreen/orientation

### MetaGame

Consumes the active `FloorDefinition` directly and owns:
- free top-down movement
- keyboard and touch-hold steering
- camera follow
- collision/proximity checks
- multiple energy stations
- multiple encounter instances
- encounter initiation

### NumberDuel

Owns one duel only:
- shared 6×5 board
- directed chain rules
- player/AI turns
- hidden correctness until submit
- reactor cores
- meta-energy use inside the duel
- current body ability use

It returns a `BattleResult`; it does not directly mutate the Floor/run state.

### TransferScreen / DestroyedScreen

Presentation only. `App` commits body transfer or Floor restart.

## FloorDefinition

`src/game/floors.ts` is the source of truth for Floor content.

A `FloorDefinition` contains:
- stable Floor id
- display name/subtitle
- world dimensions
- background asset
- start position/facing/body/meta-energy
- objective copy
- walkable geometry
- obstacle geometry
- energy-station definitions
- encounter definitions

Every energy station has a stable id. Every encounter has a stable `encounterId` separate from `enemyId`:

- `encounterId` = one concrete opponent/spawn on a Floor
- `enemyId` = robot archetype/body family

This permits multiple opponents of the same archetype on one Floor.

`FLOORS`/`getFloor()` form the current Floor registry. A7 is currently the default and only authored Floor.

## Save / RunState v3

Current save key:

`numberdroid-meta-v3`

The persisted state now contains:

```text
MetaState v3
├── floorId
├── x / y / facing
├── currentBody
├── metaEnergy
├── usedStationIds[]
├── defeatedEncounterIds[]
├── damageTaken
├── pilotIndex
└── playerCount
```

This is the required state shape for the Vertical Slice 2 target of several opponents and several energy sources.

Existing `numberdroid-meta-v2` saves are migrated one-way:
- old `stationUsed` maps to the current A7 station id
- old defeated enemy archetypes map to matching A7 encounter ids
- position/body/meta-energy/player/HP state is preserved where valid

Legacy prototype saves are still read as a fallback.

Floor restart is data-driven: it rebuilds the initial state from the active `FloorDefinition` while preserving player count.

## Health / HP

Confirmed:
- 3 HP at Floor start
- every lost duel costs exactly 1 HP
- HP visible on deck and duel
- at 0 HP open the dedicated destroyed screen
- explicit Floor restart restores initial Floor run state and 3 HP
- player count survives restart

## Visual/gameplay invariants

- hostile robot = red
- controlled robot = green
- controlled robot name above its sprite
- arithmetic correctness hidden until deliberate submit
- reactor visually substantial on desktop and mobile
- arithmetic operator/target prominent above reactor
- no redundant `REAKTORBALANCE X:Y`
- body abilities separate from meta-energy
- MAGNETAR `REIHENSCHUB →` once per duel

## CI

`.github/workflows/build.yml` runs for `main`, `agent/**`, and pull requests targeting `main`.

Current workflow:

```text
checkout
→ Node 22
→ npm install --no-audit --no-fund
→ npm run build
```

The workflow is currently green.

The repository does not yet contain a committed `package-lock.json`, so CI temporarily uses `npm install`. Once a lockfile is committed, switch to `npm ci`.

## Next architecture/content boundary

The basic application/run-state architecture is now sufficient for Vertical Slice 2. The next work should focus on Floor representation and content rather than another state rewrite.

Recommended order:
1. choose and integrate a tile/object map format (LDtk or Tiled are the leading options),
2. keep `FloorDefinition` as the gameplay-facing contract,
3. import/render floor/wall/decor layers from map data,
4. keep encounters, stations, triggers and collision as explicit object/data layers,
5. build the fuller 10–15 minute Floor with roughly 5–7 opponents, 2–3 energy sources and optional routes,
6. define the three meaningful body capabilities needed for that slice, including KRONOS.

Do not create a custom map editor unless the external editors prove inadequate.

## Prototype policy

`zahlenkern-prototyp-meta-v7.html` remains a frozen visual/behavioral reference. Production work belongs in `src/` and authored Floor/map data.
