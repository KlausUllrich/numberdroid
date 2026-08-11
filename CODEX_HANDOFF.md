# Numberdroid — Codex Handover

**Status:** 11 August 2026  
**Branch:** `agent/integrate-metagame-architecture`  
**Draft PR:** #1 against `main`  
**Frozen reference:** `zahlenkern-prototyp-meta-v7.html`

## Milestone status

The clean React/TypeScript migration has passed manual parity acceptance on desktop and phone for the current A7 slice. The original v7 deck art is restored, HP/destruction is implemented, reactor/mobile presentation is accepted, defeated encounters persist correctly, and GitHub Actions validates the build independently.

Vertical Slice 2 infrastructure is now active:
- `FloorDefinition` is the runtime source of Floor content,
- run/save state is v3 with stable Floor, station and encounter-instance ids,
- A7 remains the default and keeps its raster-background visual,
- a generic tilemap renderer supports layered Tiled GIDs,
- `src/game/tiled.ts` converts the supported Tiled JSON subset into `FloorDefinition`,
- gameplay object layers provide Start, Walkable, Obstacles, EnergyStations and Encounters,
- `deck-vs2` is a larger technical preview Floor with 6 encounters and 3 energy sources,
- preview mode is non-persistent and does not overwrite the normal A7 save.

Do not merge PR #1 unless explicitly requested.

## Current flow

```text
Deck → Encounter → NumberDuel
                   ├─ loss, HP > 0 → Deck
                   ├─ loss, HP = 0 → DestroyedScreen → restart Floor → Deck
                   └─ win → TransferScreen → Deck
```

No prototype bridge techniques are allowed in production code: no hidden clicks, MutationObservers, reload transitions, DOM patching or localStorage message buses.

## Binding gameplay rules

### Number duel
- shared 6×5 board
- directed orthogonal chains; bends allowed
- no repeated tile in one chain
- minimum 2 numbers
- correctness must remain hidden until `REAKTOR AUSLÖSEN`
- correct 2 numbers → +1 core
- 3 → +2
- 4 → +4
- 5+ → immediate win
- incorrect chain → visible failure after submit, board unchanged, team loses one reactor core
- AI deliberately child-friendly
- collapsed/refilled number tiles visibly fall into place
- tile fall duration currently 560 ms
- MAGNETAR row shift visibly animates instead of teleporting

Current A7 encounters:
- SENTRY-4: +6, easy
- MAGNETAR 742: +8, medium
- KRONOS-9: +10, strong

### Presentation
- acting robot substantial and left of grid
- hostile red, controlled green
- own robot name above robot
- HP visible
- reactor substantial on desktop and mobile
- large operator/target directly above reactor
- no redundant `REAKTORBALANCE X:Y`
- reward explanation secondary near bottom

### Resources
Meta-energy:
- separate metagame resource
- starts at 0 on current Floor
- station grants configured energy
- spend 1 to modify exactly one number by +1 or −1

Body ability:
- does not cost meta-energy
- MAGNETAR 742: `REIHENSCHUB →`, once per duel, deliberately selected row shifts one field right
- KRONOS ability remains open

### HP
- Floor starts at 3 HP
- each lost duel costs exactly 1 HP
- 2/3 and 1/3 return to deck
- reaching 0 opens `ROBOTER ZERSTÖRT`
- explicit Floor restart restores Floor start state and 3 HP
- player count survives restart
- reload at 0 HP must reopen destroyed state

## Floor architecture

`src/game/floors.ts` owns the Floor registry and keeps `DECK_A7` as production/default Floor.

`FloorDefinition` contains:
- id/name/subtitle
- dimensions
- visual definition: raster image or tilemap
- start state
- objectives
- walkable/obstacle geometry
- `energyStations[]`
- `encounters[]`

Stable identity rules:
- `encounterId` identifies one physical encounter/spawn
- `enemyId` identifies robot archetype/body family
- station id identifies one energy source

This supports multiple opponents of the same type and multiple energy stations on the same Floor.

### Tiled

Tiled is the chosen VS2 authoring direction. Runtime code does not depend on the Tiled application.

Current supported import subset:
- finite orthogonal maps
- uncompressed JSON-array tile layers
- embedded image tilesets
- multiple tile layers
- gameplay object layers

See `docs/TILED_MAPS.md` for exact layer/property conventions.

`src/meta/FloorVisual.tsx` renders either:
- A7-style raster background, or
- layered tilemap visuals.

## Technical VS2 preview

`src/game/maps/deckVs2.ts` currently defines a Tiled-shaped technical fixture for the first larger Floor.

Current preview characteristics:
- `DECK B2`
- 40×24 tiles at 64 px
- world size 2560×1536
- 6 encounter instances
  - 2× SENTRY
  - 2× MAGNETAR
  - 2× KRONOS
- 3 independent energy stations
- multiple obstacles / route choices
- one subtract encounter to exercise the existing minus mode
- technical SVG tileset at `public/assets/deck/vs2-tech-tiles.svg`

The technical tileset is for system/layout validation only; final art is still pending.

Preview locally with:

```text
http://localhost:5173/?floor=deck-vs2
```

or on the current LAN while the address remains assigned:

```text
http://192.168.76.12:5173/?floor=deck-vs2
```

Preview state starts fresh on page load and is deliberately not written to the persistent A7 save.

## Save schema v3

Current key: `numberdroid-meta-v3`.

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

V2 migration preserves valid position/body/meta-energy/player/HP state and maps:
- `stationUsed` → A7 station instance id
- `defeated: EnemyId[]` → matching A7 `encounterId`s

For A7, a uniquely identifiable currently-owned body also repairs a missing defeated marker. On Floors with duplicate body encounters, only explicit `encounterId` state is trusted.

Floor restart is generated from the active `FloorDefinition` rather than hard-coded A7 coordinates.

## CI

`.github/workflows/build.yml` runs on `main`, `agent/**`, and PRs to `main` with Node 22.

Current steps:

```text
npm install --no-audit --no-fund
npm run build
```

The workflow is green on the tilemap / VS2 preview runtime.

No `package-lock.json` is committed yet. Once the local lockfile is added, change the workflow to `npm ci`.

## Immediate next work

Do not perform another broad state rewrite.

Next VS2 work:
1. manually validate `?floor=deck-vs2` on desktop and phone,
2. replace the technical map fixture with an actual Tiled-authored JSON map once layout stabilizes,
3. replace the technical SVG with final modular spaceship tileset art,
4. refine B2 into a coherent 10–15 minute route rather than a rectangular test arena,
5. add an explicit Floor completion objective/exit without inventing a player-facing Floor selector yet,
6. expand arithmetic variety beyond the currently implemented add/subtract modes when design is confirmed,
7. define KRONOS' final body ability,
8. add automated smoke coverage for floor parsing and core gameplay transitions.

## Local validation

From the worktree:

```bash
git pull --ff-only
npm run build
npm run dev -- --host 0.0.0.0
```

A7 default:

```text
http://localhost:5173/
```

VS2 preview:

```text
http://localhost:5173/?floor=deck-vs2
```

On VS2 specifically verify:
- camera follows across the larger map,
- walls/machinery block movement consistently with visuals,
- all 6 encounters can be reached,
- all 3 stations can be independently consumed,
- defeating one of two same-body encounters removes only that encounter instance,
- transfer returns to a valid retreat point,
- HP and destroyed/restart operate on B2,
- reloading the preview intentionally starts a fresh preview and leaves A7 persistence untouched.

## Architectural prohibitions

Do not reintroduce:
- hidden DOM button clicks
- MutationObserver bridges
- reload-based screen transitions
- localStorage as implicit inter-component messaging
- competing fullscreen owners
- pre-submit correctness indicators

Keep `zahlenkern-prototyp-meta-v7.html` frozen and implement production changes in `src/` or authored Floor/map data.
