# Numberdroid — Codex Handover

**Status:** 11 August 2026  
**Branch:** `agent/integrate-metagame-architecture`  
**Draft PR:** #1 against `main`  
**Last fully gameplay-validated code before this handoff update:** `f5df8a74102fc54cbfa19b0f5ff45230a7a39ae4`  
**Frozen reference:** `zahlenkern-prototyp-meta-v7.html`

## Handover decision

This is the intended context boundary. The clean architecture, A7 parity work and the first complete VS2/B2 gameplay loop are established. The next phase is not another migration; it is gameplay enrichment: encounter pressure, hostile patrol/attack behavior, richer duel mechanics, boss-specific mechanics, stronger presentation and eventually real art/content authoring.

Do **not** merge PR #1 unless explicitly requested.

Do **not** perform another broad state rewrite. Extend the current systems.

## Current milestone

The React/TypeScript app has passed manual parity acceptance for A7 on desktop and physical phone. B2 has then been iterated as the first real Vertical Slice 2 floor.

Confirmed working in the current B2 preview:
- smooth player/camera scrolling using local RAF transforms rather than App state every frame,
- phone landscape and desktop controls,
- local zoom-out overview toggle,
- body-specific physical size and collision,
- body-specific drive feel,
- multiple rooms/corridors and higher enemy density,
- automatic sliding doors with dynamic collision,
- locked doors and access rights,
- access rights carried by Security robots rather than lying on the floor,
- robot scan/encounter panel,
- body transfer preserving body size,
- HP/destruction/floor restart,
- multi-instance encounter persistence,
- energy stations,
- two-layer KRONOS B2 boss duel,
- post-boss transfer into large KRONOS,
- extended victory drive to Deck Control,
- explicit final console action to take over Deck B2.

GitHub Actions builds the branch independently. The gameplay code at `f5df8a7` built successfully.

## Current application flow

```text
Deck
  → scan/encounter
    → NumberDuel
      ├─ loss, HP > 0 → Deck
      ├─ loss, HP = 0 → DestroyedScreen → restart Floor → Deck
      └─ win → TransferScreen
                  ├─ body activated
                  ├─ optional Security access acquired and shown
                  └─ Deck

B2 boss path:
Security access → COMMAND access → KRONOS boss → transfer to large KRONOS
→ long Command Gallery victory drive → Deck Control console → TAKE OVER DECK B2
```

No prototype bridge techniques are allowed in production code: no hidden clicks, MutationObservers, reload transitions, DOM patching or localStorage message buses.

## Binding number-duel rules currently implemented

- shared 6×5 board
- directed orthogonal chains; bends allowed
- no repeated tile in one chain
- minimum 2 numbers
- correctness hidden until explicit `REAKTOR AUSLÖSEN`
- correct 2 numbers → +1 reactor power
- 3 → +2
- 4 → +4
- 5+ → instant win for a normal opponent
- incorrect chain → board remains unchanged and team loses one reactor core
- child-friendly AI; often 2-number solutions, less frequently longer paths, may pass
- collapsed/refilled tiles visibly fall
- fall animation = 560 ms
- MAGNETAR `REIHENSCHUB →` visibly shifts one deliberately selected row right, once per duel
- meta-energy is separate from body ability; spend 1 to modify one number by +1 or −1
- no pre-submit correctness indicator is permitted

### Current KRONOS B2 boss exception

B2 KRONOS currently uses two reactor firewalls. A 5+ chain destroys the **current firewall**, not the whole boss. Meta-energy and body ability uses persist across firewall phases.

This is **not** a generic boss template. Future bosses must get their own mechanics rather than merely more reactor lives.

## Strong new duel-design requirements for the next agent

These requirements come directly from the latest playtest and should guide the next phase.

### 1. Replace the textual reward legend with an energy/progress bar

The current text such as:

```text
2 Zahlen → +1
3 → +2
4 → +4
5+ → Sofortsieg
```

should be removed from the active duel UI.

Preferred direction: a visual reactor/energy bar that charges and uses clear visual state/color changes to communicate the current reward tier: effectively +1, +2, +4 or instant-win territory. It must **not** reveal whether the arithmetic result itself is correct before submit.

### 2. More accessible number-board mechanics over time

The current special actions/meta-energy can be cognitively expensive for children. The game needs simpler positive mechanics as progression expands. Candidate examples explicitly requested:
- 3 or 4 identical numbers produce a bonus,
- flexible blocks that may count as one of two values,
- other easy-to-read board modifiers before adding highly complex powers.

These are directions, not a finalized ruleset. Preserve the core mental-math requirement.

### 3. Enemy abilities must become visible actions

Enemy robots should use their own body abilities more often where appropriate.

Do not mutate the board silently. Use a staged sequence:
1. clear cue/message about what the enemy is about to do,
2. short anticipation,
3. visible board animation/effect,
4. resulting state.

The child should understand the opponent as a character taking an action.

### 4. AI “thinking and failing” should be a moment

When the enemy AI cannot find/chooses not to make a valid chain, the current pass is too quick.

Make it take a little longer and visibly show that the robot is thinking, trying and failing. This may be mildly humorous. This is intentionally a rewarding/funny moment for children, not dead time.

### 5. Player-change presentation

When the active child/pilot changes in the number duel, improve the transition: the previous active robot should quickly slide out to the left and the new active robot should slide in from the left. Keep it fast enough not to interrupt play.

### 6. Meta-energy action layout must be stable

When +1/−1 adjustment mode is activated, `ABBRECHEN` must appear **to the right of the existing action buttons** without changing/scaling the board layout. The number grid must not resize because a contextual button appeared.

## Boss presentation requirements

### B2 firewall visuals

The newest thick firewall presentation is too heavy.

Preferred presentation:
- return to thin firewall blocks/bars,
- no text labels inside/around the firewall blocks themselves,
- both firewall blocks are visible from the beginning,
- both initially orange/intact,
- when one firewall is defeated, that exact block visibly breaks/dies,
- use a strong but brief effect/animation so the phase change is unmistakable.

### B2 boss structure should become 3 stages

Current implementation ends after the two firewalls. Desired next version:

```text
Firewall 1 → Firewall 2 → exposed core → final core fight
```

The player should only win KRONOS after both firewalls are gone **and then** defeating the exposed core.

Suggested thematic differentiation explicitly requested: firewall phases may use only **8 reactor fields/segments rather than 12**, to make them feel like protection layers rather than the normal core. Explore how this can be represented thematically and mechanically without breaking the core arithmetic loop.

Again: this is B2/KRONOS-specific. Future bosses need distinct mechanics.

## Robot/body design rules

### Physical identity persists through transfer

A robot does not change size because the player controls it.

- normal bodies fit standard 64 px doorways,
- large bodies remain large after transfer,
- collision uses the body’s physical size,
- level routing must account for large bodies,
- large doors/gates allow occasional large powerful robots.

Design direction:
- small/light robot = generally weaker but faster/agile,
- large/heavy robot = generally stronger but slower/heavier.

Do not reduce this to sprite scale only.

### Current drive profiles

Body feel is already implemented with max speed, acceleration, deceleration/ease-out and turn speed.

Current intent:
- PICO: balanced,
- SENTRY: fast and agile Scout/Security body,
- MAGNETAR: medium/stable utility body,
- KRONOS: slow, heavy, low turn speed; large KRONOS amplifies that mass.

Latest playtest explicitly confirmed that the different bodies feel distinct and enjoyable to drive. Preserve this.

### KRONOS body ability

Still intentionally undefined. Do not invent it casually. It should eventually be a meaningful high-value ability consistent with the heavy body.

## Encounter / hostile-behavior direction for the next phase

This is one of the highest-priority new systems.

### Automatic scan/proximity interception

Currently the player actively scans/engages nearby enemies. Desired direction:
- approaching a hostile robot should automatically activate the scan/encounter state,
- hostile robots should therefore act as actual hazards/guards and cannot simply be driven through/past,
- some enemies may still allow the player to back away after the scan,
- other enemy types should be able to initiate an unavoidable attack.

This enables real guard behavior rather than optional buttons floating in rooms.

### Pursuit / aggression

Support a distinction such as:
- stationary/guard robot,
- patrol robot,
- aggressive robot that notices the player and pursues,
- possibly robots that force combat on contact/proximity.

Short pursuit and patrol behavior should be compatible with room/corridor layout. Keep animation/movement in local RAF-style runtime logic; do not reintroduce top-level React rerenders every frame.

### Patrol paths

This remains the first major deck-behavior feature to implement. Patrols should be authored via Floor/Tiled data, not hard-coded JSX coordinates.

## Security/access design

- keys/access cards are acquired from specific Security robots, not floor pickups in B2,
- the robot scan shows the access right in a blue Security panel with a keycard graphic,
- the deck enemy itself only has a subtle key icon; the user explicitly prefers some searching/discovery rather than an enormous “KEY HERE” marker,
- after the body transfer, acquiring an access right is shown again as its own reward moment,
- locked doors require the corresponding acquired access id.

### New binding rule: unique key color per deck

Every access key/card on a given deck must have its **own distinct color**. Do not use a single generic blue keycard treatment for every key on the same floor.

Color must remain consistent across:
- subtle enemy key icon/cue,
- encounter Security panel/card,
- post-transfer acquired-card presentation,
- matching locked door/gate indication.

The current B2 implementation uses generic blue styling and will need to be generalized into authored key/access metadata rather than special-case CSS.

## Encounter scan screen

Current scan intentionally shows more tactical/body information before combat:
- robot name,
- role and description,
- math protocol,
- AI strength,
- body/size class,
- drive behavior,
- body ability and explanation,
- access key if present,
- boss protection info if applicable.

The generic `SIEG → ROBOTERNAME ÜBERNEHMEN` reward text has been removed and should stay removed.

## Transfer presentation

Current transfer lasts ~4300 ms with five phases and keeps old/new body size visually meaningful.

Latest issue to fix:
- in phase 5 the transfer text shifts/jumps slightly downward.

Stabilize the layout dimensions so stage/status copy changes do not move the transfer composition.

Access-card reward after transfer is intentional and should remain prominent.

## Floor / deck architecture

`FloorDefinition` is the content source. Tiled JSON is the chosen authoring direction; runtime code must not depend on the Tiled desktop app.

Current supported concepts include:
- raster or tilemap visual,
- Start,
- Walkable,
- Obstacles,
- Rooms,
- Doors,
- EnergyStations,
- Encounters,
- access rights,
- floor Actions,
- explicit floor Goal.

Continue moving gameplay-specific placement/content into Floor/Tiled data.

### B2 current structure

B2 is a Tiled-shaped TypeScript fixture in `src/game/maps/deckVs2.ts`, still using placeholder technical art.

Current map after the victory-route extension:
- 68×20 tiles,
- 64 px tiles,
- world size 4352×1280,
- elongated symbolic spaceship rather than square arena,
- rooms plus connecting corridors,
- 14 hostile encounter instances,
- 4 energy sources,
- Blue Security gate,
- Command gate,
- Bridge/Boss area,
- post-boss heavy-body route through Command Gallery,
- Deck Control room with final console action.

The user likes the overall level size and enemy density.

Room/deck art is still prototype-level and needs much more personality later.

## Level personality / future content direction

The game is now at the point where robots, rooms and the deck need stronger identity rather than generic technical labels/tiles.

Future examples already discussed:
- room-specific visual identity,
- automatic sliding doors and large security gates,
- keys/access control,
- moving enemies,
- story-tied floor objectives,
- boss encounters,
- final deck action or elevator transition,
- different robot roles and abilities.

Do not turn this into decorative lore only; room identity should inform gameplay where practical.

## Save schema v3

Current key: `numberdroid-meta-v3`.

Current state includes at least:
- floorId,
- x/y/facing,
- currentBody,
- currentDeckSize,
- metaEnergy,
- usedStationIds[],
- collectedPickupIds[] (legacy/generic pickup support),
- accessKeyIds[],
- completedActionIds[],
- defeatedEncounterIds[],
- damageTaken,
- pilotIndex,
- playerCount.

B2 preview intentionally starts fresh on reload and does not overwrite normal A7 persistence.

## HP / restart rules

- floor starts at 3 HP,
- each duel loss = exactly −1 HP,
- 2/3 and 1/3 return to deck,
- 0 HP opens `ROBOTER ZERSTÖRT`,
- explicit floor restart restores floor start state and 3 HP,
- player count survives restart,
- reload at 0 HP reopens destroyed state on persistent floors.

## Performance / movement architecture

Do not regress this.

Deck movement was intentionally moved off global React state per frame:
- player pose updated locally in RAF,
- world/camera transform updated in same RAF,
- `translate3d` GPU-friendly transforms,
- tilemap component memoized,
- MetaState synchronized on a throttle and forced on stop/interact/screen transitions.

Latest physical-phone testing confirmed smooth scrolling.

## Zoom

- normal = 1.0,
- local overview = 0.68,
- overview is intentionally not a full minimap,
- touch direction is zoom-aware.

## CI

`.github/workflows/build.yml` runs Node 22 and currently uses:

```text
npm install --no-audit --no-fund
npm run build
```

No committed `package-lock.json` yet. When a lockfile is added, switch to `npm ci`.

## Recommended next-agent sequence

Do not implement every new idea at once. Suggested order:

1. **Small UI regression pass**
   - fix Transfer phase-5 text jump,
   - stabilize `ABBRECHEN` position,
   - restore thin unlabeled firewall visuals.

2. **Boss clarity / KRONOS final core**
   - two visible thin orange firewalls,
   - stronger break animation,
   - 8-segment thematic firewall phase if it works cleanly,
   - after both firewalls: distinct exposed-core final duel.

3. **Hostile deck behavior**
   - automatic proximity scan/interception,
   - patrol-path data/runtime,
   - guard vs aggressive behavior,
   - short chase/forced engagement behavior.

4. **Enemy duel personality**
   - longer/funnier think-and-fail pass,
   - staged enemy ability usage and animation,
   - player/pilot slide transition.

5. **Duel readability/progression**
   - replace textual reward legend with energy bar,
   - prototype one simple new board mechanic such as matching-number bonus or dual-value tile,
   - do not add several mechanics simultaneously before playtesting.

6. **Access-key generalization**
   - authored per-key color metadata,
   - consistent color through robot/scan/transfer/door presentation.

7. **Deck personality + art direction**
   - modular final spaceship tileset,
   - room-specific environmental identity,
   - then convert fixture more fully into actual Tiled-authored JSON.

8. **Automated smoke coverage** for floor parsing, boss progression, access gating and core transitions.

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

B2 preview:

```text
http://localhost:5173/?floor=deck-vs2
```

Known LAN address during this test session, only while still assigned:

```text
http://192.168.76.12:5173/?floor=deck-vs2
```

## Architectural prohibitions

Do not reintroduce:
- hidden DOM button clicks,
- MutationObserver bridges,
- reload-based transitions,
- localStorage as implicit component messaging,
- competing fullscreen owners,
- top-level React state updates every movement frame,
- pre-submit arithmetic correctness indicators.

Keep `zahlenkern-prototyp-meta-v7.html` frozen. Production changes belong in `src/`, reusable game modules, or authored Floor/Tiled data.
