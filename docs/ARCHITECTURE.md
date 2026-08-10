# Numberdroid Architecture

## Current status

The v7 prototype loop has been migrated into a clean React/TypeScript application and has passed manual desktop/mobile parity validation. The application now also has GitHub Actions build validation.

Current top-level surfaces:

```text
Deck → Encounter → NumberDuel
                   ├─ loss, HP > 0 → Deck
                   ├─ loss, HP = 0 → DestroyedScreen → restart Floor → Deck
                   └─ win → TransferScreen → Deck
```

There are no DOM bridges, hidden control clicks, MutationObservers, reload-based transitions, or localStorage message buses between these systems.

## Ownership boundaries

### App

Owns cross-screen state and transitions:

- current body
- player/pilot state
- meta-energy
- remaining run integrity through `damageTaken`
- defeated enemies
- transition into duel, transfer, destruction and Floor restart
- top-level fullscreen/orientation

### MetaGame

Owns the live deck surface:

- free top-down movement
- keyboard and touch-hold steering
- camera follow
- collision/proximity checks
- stations and enemy interaction

### NumberDuel

Owns one duel only:

- 6×5 board
- player/AI turns
- chain rules and delayed correctness reveal
- reactor core balance
- meta-energy spending during the duel
- current body ability use during the duel

It returns a `BattleResult`; it does not mutate deck/run state directly.

### TransferScreen / DestroyedScreen

These own presentation only. `App` commits the resulting body transfer or Floor restart.

## FloorDefinition

Floor content is now separated from global robot/game catalogs.

`src/game/floors.ts` contains the current `DECK_A7` definition. A `FloorDefinition` contains:

- stable Floor id
- display name/subtitle
- world dimensions
- background asset
- start position, facing, starter body and initial meta-energy
- walkable geometry
- obstacle geometry
- objective copy
- energy-station definitions
- encounter definitions

Each encounter now also has a stable `encounterId`, separate from `enemyId`. This distinction is intentional:

- `encounterId` identifies one concrete opponent/spawn on a Floor
- `enemyId` identifies the opponent archetype/body family

This is required for Vertical Slice 2, where one Floor can contain multiple opponents of the same archetype.

Energy stations likewise have stable ids, allowing a later Floor to contain multiple independent energy sources.

### Temporary compatibility layer

The parity-tested runtime still stores:

- `stationUsed: boolean`
- `defeated: EnemyId[]`

and `MetaGame` still consumes compatibility views exported from `catalog.ts` (`ENCOUNTERS`, `STATION`, `WORLD_W`, etc.). These views are derived from `CURRENT_FLOOR`; the actual A7 coordinates/content no longer live in `catalog.ts`.

This is deliberate staging, not the final multi-Floor model. It keeps the just-validated loop unchanged while isolating the next migration.

## Next runtime-state migration

Before adding the 5–7 opponents and 2–3 energy sources planned for Vertical Slice 2, migrate run state from the current v2 compatibility fields to stable instance ids, approximately:

```text
RunState
├── floorId
├── currentBody
├── deckPosition / facing
├── metaEnergy
├── usedStationIds[]
├── defeatedEncounterIds[]
├── damageTaken / HP
├── pilotIndex
└── playerCount
```

That migration should preserve existing `numberdroid-meta-v2` saves and then move to a new versioned schema. Do not overload `EnemyId` to represent multiple physical opponents.

Once this migration is complete, remove the single-Floor compatibility exports from `catalog.ts` and let `MetaGame` consume the active `FloorDefinition` directly.

## Health / HP

Confirmed behavior:

- 3 HP at Floor start
- every lost duel costs 1 HP
- HP visible on deck and duel
- at 0 HP open a dedicated destroyed screen
- explicit Floor restart restores the Floor start state and 3 HP
- player count survives the restart

The current v2 save represents remaining HP as `3 - damageTaken`.

## Visual invariants

- hostile robot = red
- controlled robot = green
- controlled robot name remains above the sprite
- math correctness is hidden until deliberate submit
- duel reactor is visually substantial
- arithmetic operator/target are prominent above the reactor
- redundant `REAKTORBALANCE X:Y` text is not shown
- body abilities and meta-energy remain separate resources

## CI

`.github/workflows/build.yml` validates pushes to `main` and `agent/**` plus pull requests targeting `main`.

Current workflow:

```text
checkout
→ Node 22
→ npm install
→ npm run build
```

The repository currently has no committed `package-lock.json`, so the workflow temporarily uses `npm install`. Once the locally generated lockfile is committed, change CI to `npm ci` for reproducible dependency installation.

## Prototype policy

`zahlenkern-prototyp-meta-v7.html` remains a frozen behavioral/visual reference. Production work belongs in `src/` and data definitions such as `src/game/floors.ts`.
