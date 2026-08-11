# Numberdroid — Codex Handover

**Status:** 11 August 2026  
**Branch:** `agent/integrate-metagame-architecture`  
**Draft PR:** #1 against `main`  
**Frozen reference:** `zahlenkern-prototyp-meta-v7.html`

## Milestone status

The clean React/TypeScript migration has passed manual parity acceptance on desktop and phone for A7. The original v7 deck art is restored, HP/destruction works, reactor/mobile presentation is accepted, defeated encounters persist correctly, number-tile fall and MAGNETAR row-shift animations are active, and GitHub Actions validates the build independently.

Vertical Slice 2 infrastructure is active:
- `FloorDefinition` is the runtime source of Floor content,
- run/save state is v3 with stable Floor, station and encounter-instance ids,
- A7 remains default and keeps its raster-background visual,
- a generic tilemap renderer supports layered Tiled GIDs,
- `src/game/tiled.ts` converts the supported Tiled subset into `FloorDefinition`,
- Tiled gameplay layers provide Start, Walkable, Obstacles, EnergyStations and Encounters,
- explicit Floor goals and boss encounter metadata are supported,
- `deck-vs2` is a non-persistent technical preview and does not overwrite the normal A7 save.

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
- correctness hidden until `REAKTOR AUSLÖSEN`
- correct 2 numbers → +1 core
- 3 → +2
- 4 → +4
- 5+ → immediate win
- incorrect chain → failure after submit, board unchanged, team loses one reactor core
- AI deliberately child-friendly
- collapsed/refilled tiles visibly fall
- fall duration currently 560 ms
- MAGNETAR `REIHENSCHUB →` visibly shifts the selected row and wraps the right tile to the left

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
- reload at 0 HP reopens destroyed state

## Deck movement / camera

VS2 performance work moved visual movement off the top-level React state loop:
- player pose is updated locally in `requestAnimationFrame`,
- camera/world transform is updated in the same RAF,
- transforms use `translate3d`/GPU-friendly CSS,
- `FloorVisual` is memoized and does not reconcile all tiles while driving,
- parent/save-compatible `MetaState` is synchronized at a throttled interval and forced on stop/interact/screen transition.

This is owned component animation, not DOM bridge/patch logic.

Deck zoom:
- normal gameplay zoom = `1.0`,
- local overview toggle = `0.68`,
- zoom-out is intentionally local context rather than a full-floor minimap,
- touch direction calculation accounts for zoom.

## Floor architecture

`src/game/floors.ts` owns the Floor registry and keeps `DECK_A7` as production/default Floor.

`FloorDefinition` contains:
- id/name/subtitle
- dimensions
- visual definition: raster image or tilemap
- start state
- objectives
- optional explicit `goal`
- walkable/obstacle geometry
- `energyStations[]`
- `encounters[]`

Stable identity:
- `encounterId` = one physical encounter/spawn
- `enemyId` = robot archetype/body family
- station id = one energy source

This supports multiple opponents of the same body and multiple stations on one Floor.

### Tiled

Tiled is the chosen VS2 authoring direction. Runtime code does not depend on the Tiled application.

Supported subset:
- finite orthogonal maps
- uncompressed JSON-array tile layers
- embedded image tilesets
- multiple tile layers
- gameplay object layers
- boss metadata and explicit defeat-encounter Floor goals

See `docs/TILED_MAPS.md` for conventions and planned layers.

`src/meta/FloorVisual.tsx` renders either A7-style raster art or layered tilemap visuals.

## Technical VS2 preview — DECK B2

`src/game/maps/deckVs2.ts` is currently a Tiled-shaped technical fixture, not final authored art.

Current shape/density after first user review:
- 52×20 tiles at 64 px
- world size 3328×1280, comparable total area to the earlier 40×24 test but clearly more elongated
- symbolic spaceship layout rather than a square arena
- bent/S-shaped main route
- multiple side rooms, machinery areas and alternate branches
- 14 encounter instances with substantially higher density
- 4 independent energy sources
- final bridge/command section at the far end
- `KRONOS-9 KOMMANDO` is marked as boss
- explicit Floor goal: reach the bridge and defeat the command droid
- generic boss story-intro plumbing exists; detailed game story is still to be designed
- one subtract encounter remains to exercise minus mode
- technical SVG tileset remains placeholder art

Enemies are intended to create route pressure and choices; defeating every spawn is not required for Floor completion.

Preview:

```text
http://localhost:5173/?floor=deck-vs2
```

LAN address observed during testing while still assigned:

```text
http://192.168.76.12:5173/?floor=deck-vs2
```

Preview state starts fresh on page load and is deliberately not written to persistent A7 save.

## Confirmed future VS2 interaction direction

The following are now explicit design requirements, but are not yet implemented:
- automatic sliding doors,
- locked doors plus keys/access tokens,
- short patrol paths for some hostile robots,
- a clear goal per Floor,
- an end boss tied to story/progression,
- eventually a real modular spaceship tileset rather than technical tiles.

These should be authored through Floor/Tiled data instead of hard-coded per-map React conditions. Planned object-layer direction is documented in `docs/TILED_MAPS.md`: `Doors`, `Pickups`, `PatrolPaths`, later exits/transitions.

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

V2 migration preserves valid position/body/meta-energy/player/HP state and maps old station/defeated data to A7 stable ids. On A7 a uniquely identifiable currently-owned body can repair one missing defeated marker. On Floors with duplicate body encounters only explicit `encounterId` state is trusted.

Floor restart is generated from active `FloorDefinition`.

## CI

`.github/workflows/build.yml` runs on `main`, `agent/**`, and PRs to `main` with Node 22.

Current steps:

```text
npm install --no-audit --no-fund
npm run build
```

CI is green on the ship-shaped B2 / smooth-camera code.

No `package-lock.json` is committed yet. Once the local lockfile is added, change workflow to `npm ci`.

## Immediate next work

Do not perform another broad state rewrite.

Next sequence:
1. manually validate smooth movement and local zoom on desktop + phone,
2. validate the 52×20 ship layout and 14-encounter density,
3. implement `Doors` as the first dynamic map interaction, starting with automatic sliding doors and dynamic collision,
4. add `Pickups` / locked-door access state,
5. add short `PatrolPaths` and moving-hostile simulation without reintroducing global per-frame React rendering,
6. replace the TypeScript fixture with actual Tiled-authored JSON once spatial layout stabilizes,
7. replace the technical SVG with final modular spaceship tileset art,
8. define KRONOS' final body ability and richer arithmetic progression,
9. add automated smoke coverage for floor parsing and core gameplay transitions.

## Local validation

From the worktree:

```bash
git pull --ff-only
npm run build
npm run dev -- --host 0.0.0.0
```

A7:

```text
http://localhost:5173/
```

VS2:

```text
http://localhost:5173/?floor=deck-vs2
```

On B2 specifically verify:
- player motion is smooth rather than visibly stepping,
- tile background follows smoothly,
- `UMGEBUNG ANSEHEN` zooms to local overview and toggles back to normal,
- touch movement still aims correctly at both zoom levels,
- corridors/rooms are connected and obstacles match collision,
- boss goal is visible in HUD,
- dense encounters can be passed or engaged,
- defeating one duplicate-body encounter removes only that instance,
- HP/destroyed/restart still works,
- preview reload starts fresh and leaves A7 persistence untouched.

## Architectural prohibitions

Do not reintroduce:
- hidden DOM button clicks
- MutationObserver bridges
- reload-based screen transitions
- localStorage as implicit inter-component messaging
- competing fullscreen owners
- pre-submit correctness indicators

Keep `zahlenkern-prototyp-meta-v7.html` frozen and implement production changes in `src/` or authored Floor/map data.
