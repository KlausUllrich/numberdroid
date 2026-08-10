# Numberdroid — Codex Handover

**Status:** 10 August 2026  
**Branch:** `agent/integrate-metagame-architecture`  
**Draft PR:** #1 against `main`  
**Frozen reference:** `zahlenkern-prototyp-meta-v7.html`

## Milestone status

The clean React/TypeScript migration has reached parity acceptance on desktop and phone for the current vertical slice. The original v7 deck background has been restored, the 3-HP destruction flow is implemented, and the duel/reactor/mobile presentation has been manually validated.

A GitHub Actions build workflow is now active and has successfully run `npm run build` on GitHub infrastructure.

Do not merge PR #1 unless explicitly requested.

## Current runtime flow

```text
Deck → Encounter → NumberDuel
                   ├─ loss, HP > 0 → Deck
                   ├─ loss, HP = 0 → DestroyedScreen → restart current Floor → Deck
                   └─ win → TransferScreen → Deck
```

`App` owns cross-screen state. There are no prototype bridge techniques in production code: no hidden clicks, MutationObservers, reload transitions, DOM patching, or localStorage as a component message bus.

## Binding gameplay rules

### Number duel

- shared 6×5 board
- directed orthogonal chains; bends allowed
- no repeated tile in one chain
- minimum two numbers
- used tiles collapse/refill only after a correct submitted chain
- incorrect chain is revealed only after `REAKTOR AUSLÖSEN`
- before submit the UI must not reveal correctness
- 2 numbers → +1 reactor core
- 3 numbers → +2
- 4 numbers → +4
- 5+ → immediate win
- incorrect chain → board unchanged, team loses one reactor core
- AI remains deliberately child-friendly

Current A7 encounters:
- SENTRY-4: + target 6, easy
- MAGNETAR 742: + target 8, medium
- KRONOS-9: + target 10, strong

### Duel presentation

- acting robot is substantial and left of the number grid
- controlled robot green; hostile robot red
- robot name is above the robot
- HP visible
- reactor is substantial on desktop and mobile
- arithmetic operator and target are large and directly above the reactor
- do not show redundant `REAKTORBALANCE X:Y`
- reward explanation stays visually secondary near the bottom

### Resources

Meta-energy:
- separate metagame resource
- current slice starts at 0
- station grants +1
- spending 1 changes exactly one number by +1 or −1

Body ability:
- does not cost meta-energy
- MAGNETAR 742: `REIHENSCHUB →`, once per duel, deliberately selected row shifts one field right
- KRONOS ability remains open

### HP / destruction

- Floor starts at 3 HP
- every lost duel costs exactly 1 HP
- losses at 2 HP and 1 HP return to the deck
- the loss reaching 0 HP opens `ROBOTER ZERSTÖRT`
- Floor restart is explicit
- restart restores start position, PICO-3, unresolved enemies, unused station, 0 meta-energy and 3 HP
- player count survives restart
- reload at 0 HP must return to destroyed state

## FloorDefinition architecture

The first Vertical Slice 2 architecture step is implemented.

`src/game/floors.ts` is now the source of truth for current A7 Floor content:

- Floor id/name/subtitle
- dimensions
- background asset
- start state
- objectives
- walkable geometry
- obstacles
- energy-station definitions
- encounter definitions

`FloorDefinition` and `EnergyStationDefinition` are declared in `src/game/types.ts`.

Every encounter also has a stable `encounterId` distinct from `enemyId`. This is intentional preparation for multiple physical opponents of the same robot archetype. Energy stations likewise have stable ids.

### Temporary compatibility layer

The currently validated runtime/save schema is still v2 and still stores:

- `stationUsed: boolean`
- `defeated: EnemyId[]`

`catalog.ts` therefore currently exposes compatibility views derived from `CURRENT_FLOOR` (`ENCOUNTERS`, `STATION`, `WORLD_W`, `WALKABLE`, etc.) so `MetaGame` can remain behaviorally untouched during this first extraction.

Do not add 5–7 opponents or multiple stations until the next migration removes this limitation.

## Immediate next architecture step

Migrate persisted run state to instance ids and an explicit Floor id, preserving v2 saves. Target shape is roughly:

```text
RunState
├── floorId
├── currentBody
├── x / y / facing
├── metaEnergy
├── usedStationIds[]
├── defeatedEncounterIds[]
├── damageTaken
├── pilotIndex
└── playerCount
```

After that:
1. make `MetaGame` consume the active `FloorDefinition` directly,
2. remove single-Floor compatibility exports from `catalog.ts`,
3. then build Vertical Slice 2 content: about 5–7 opponents, three meaningful bodies, 2–3 energy sources, optional routes and one clear objective,
4. introduce tile/object-layer map data after the Floor/runtime boundary is stable; LDtk or Tiled remains the likely editor direction.

Do not jump directly into many Floors, skill trees, bosses, timers or unrelated systems.

## CI / dependencies

`.github/workflows/build.yml` runs on `main`, `agent/**`, and PRs to `main` using Node 22 and currently:

```text
npm install --no-audit --no-fund
npm run build
```

Reason: no `package-lock.json` is committed yet. Klaus's local checkout should already have/generated one from `npm install`; once it is committed, switch CI to `npm ci`.

## Local validation

From the worktree:

```bash
git pull --ff-only
npm run build
npm run dev -- --host 0.0.0.0
```

LAN test address on the current machine was `http://192.168.76.12:5173/` while that address remains assigned.

## Architectural prohibitions

Do not reintroduce:
- hidden DOM button clicks
- `MutationObserver` bridges
- reload-based screen transitions
- localStorage as implicit inter-component messaging
- competing fullscreen owners
- pre-submit correctness indicators

Keep `zahlenkern-prototyp-meta-v7.html` frozen and implement production changes in `src/`.
