# Numberdroid — Codex Handover

**Status:** 10 August 2026  
**Branch:** `agent/integrate-metagame-architecture`  
**Draft PR:** #1 against `main`  
**Frozen reference:** `zahlenkern-prototyp-meta-v7.html`

## Milestone status

The clean React/TypeScript migration has passed manual parity acceptance on desktop and phone for the current slice. The original v7 deck art is restored, HP/destruction is implemented, reactor/mobile presentation is accepted, and GitHub Actions now validates the build independently.

The first Vertical Slice 2 architecture work is also complete:
- `FloorDefinition` is the source of Floor content,
- `MetaGame` consumes the active Floor directly,
- run/save state is now v3 with stable Floor, station and encounter-instance ids,
- existing v2 saves migrate forward.

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

`src/game/floors.ts` contains `DECK_A7`, the Floor registry and `getFloor()`.

`FloorDefinition` contains:
- id/name/subtitle
- dimensions/background asset
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

Floor restart is generated from the active `FloorDefinition` rather than hard-coded A7 coordinates.

## CI

`.github/workflows/build.yml` runs on `main`, `agent/**`, and PRs to `main` with Node 22.

Current steps:

```text
npm install --no-audit --no-fund
npm run build
```

The workflow is green on the v3 runtime migration.

No `package-lock.json` is committed yet. Once the local lockfile is added, change the workflow to `npm ci`.

## Immediate next work

The state/application architecture is now sufficient. Do not perform another broad state rewrite before building content.

Next block:
1. decide map authoring format: LDtk vs Tiled,
2. integrate map/tile/object layers behind `FloorDefinition`,
3. keep the current A7 raster version working during the transition,
4. build the fuller 10–15 minute Vertical Slice 2 Floor,
5. target roughly 5–7 encounter instances and 2–3 energy sources,
6. add optional routing/encounter choices and one explicit Floor objective,
7. define three meaningful body identities/capabilities; KRONOS still needs a final ability.

Likely map split:

```text
FloorDefinition
├── tile/map visual layers
├── collision/walkable data
├── encounters[]
├── energyStations[]
├── triggers/exits
└── objective metadata
```

Prefer LDtk or Tiled over building a custom editor unless a concrete limitation appears.

## Local validation

From the worktree:

```bash
git pull --ff-only
npm run build
npm run dev -- --host 0.0.0.0
```

The current LAN address observed during phone testing was `http://192.168.76.12:5173/` while that address remains assigned.

After pulling v3, specifically verify once:
- existing v2 save loads without reset/stranding,
- already-used station remains used,
- already-defeated current A7 opponents remain defeated,
- one new loss decrements HP correctly,
- Floor restart still returns to clean A7 start state.

## Architectural prohibitions

Do not reintroduce:
- hidden DOM button clicks
- MutationObserver bridges
- reload-based screen transitions
- localStorage as implicit inter-component messaging
- competing fullscreen owners
- pre-submit correctness indicators

Keep `zahlenkern-prototyp-meta-v7.html` frozen and implement production changes in `src/` or authored Floor/map data.
