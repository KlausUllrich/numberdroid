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

`src/game/floors.ts` is the gameplay-facing source of truth for compiled Floor content.

A `FloorDefinition` contains:
- stable Floor id
- display name/subtitle
- world dimensions
- visual data
- start position/facing/body/meta-energy
- objective copy
- walkable geometry
- obstacle geometry
- rooms/doors/pickups/actions
- energy-station definitions
- encounter definitions

Every energy station has a stable id. Every encounter has a stable `encounterId` separate from `enemyId`:

- `encounterId` = one concrete opponent/spawn on a Floor
- `enemyId` = robot archetype/body family

This permits multiple opponents of the same archetype on one Floor.

`FLOORS`/`getFloor()` form the current Floor registry.

## Declarative Level Compiler authoring layer

A new authoring boundary now exists **before** Tiled/`FloorDefinition`:

```text
LevelSpec
→ semantic compile plan
→ topology / shared walls / doors / placement / event compile stages
→ Tiled-compatible / FloorDefinition data
→ existing runtime
```

Implementation and contract:

- `docs/level-generation/`
- `src/levelgen/`

This is deliberately **not** another runtime architecture migration. The game continues to consume `FloorDefinition`; the Level Compiler exists to make large-scale level production deterministic, rule-driven and editable.

The compiler is expected to own authoring concerns such as:

- room/corridor topology and corridor width;
- stable seeds/sub-seeds;
- shared wall derivation without duplicate walls;
- doors embedded into real wall apertures with clearance;
- prop metadata/placement constraints;
- enemy spawn/route intent;
- access keys/locked-door intent;
- triggers/events;
- local locks/overrides.

The current TS-01 runtime map remains authoritative until the compiler reaches geometry/runtime parity and passes live QA.

## Save / RunState v3

Current save key:

`numberdroid-meta-v3`

The persisted state contains:

```text
MetaState v3
├── floorId
├── x / y / facing
├── currentBody
├── metaEnergy
├── usedStationIds[]
├── collectedPickupIds[]
├── accessKeyIds[]
├── completedActionIds[]
├── defeatedEncounterIds[]
├── damageTaken
├── pilotIndex
└── playerCount
```

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

`.github/workflows/build.yml` validates branches, pull requests and `main` through the project test/build path.

The repository does not yet contain a committed `package-lock.json`, so CI currently uses `npm install` rather than `npm ci`.

## Current architecture/content boundary

The application/run-state architecture is sufficient for content production. Do not restart the React/game-state framework as a prerequisite.

Current content-authoring direction:

1. keep `FloorDefinition` as the gameplay-facing runtime contract;
2. keep the current Tiled subset/importer as a valid runtime/interchange path;
3. develop the declarative Level Compiler upstream of that boundary;
4. use TS-01 as the first parity/reference case;
5. move recurring manual level-design fixes into reusable rules/metadata/validators;
6. add compiler stages incrementally: semantic graph → topology → shared wall graph → doors/navigation → props/enemies → triggers/events → workbench/overrides;
7. only switch a live Floor from manual map authoring to compiler output after parity, tests and deployed QA.

A future **Level Generator Workbench** is now an approved authoring-tool direction because large-scale campaign production requires semantic regeneration/locking/overrides. It should manipulate LevelSpec/constraints rather than becoming an unrelated second game runtime or an unconstrained tile-painting editor.

## Prototype policy

`zahlenkern-prototyp-meta-v7.html` remains a frozen visual/behavioral reference. Production work belongs in `src/` and authored/compiled Floor data.
