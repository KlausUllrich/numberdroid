# Numberdroid / Zahlenkern — Codex Handover

**Status:** 10 August 2026  
**Reference prototype:** `prototype/zahlenkern-prototyp-meta-v7.html`  
**Repository:** `KlausUllrich/numberdroid`

## 1. Project goal

Numberdroid (working title previously **Zahlenkern**) is a cooperative math game for 1–4 children. The core fantasy is inspired by Paradroid: children explore a spaceship as a robot, deliberately engage hostile robots in a number-based duel, and on victory transfer into the defeated robot body to gain a new body and body-specific ability.

The game must feel like a game first and a worksheet second. The target audience is younger primary-school children. It must be readable, tactile, fair, and understandable without time pressure.

Primary target platform is **phone in landscape orientation**, but desktop landscape must work well too. Offline use is important.

## 2. Current playable loop

The v7 standalone prototype proves the following loop:

1. Move freely through a top-down spaceship deck.
2. Discover and approach hostile robots.
3. Inspect an opponent and consciously choose to start the transfer encounter.
4. Enter the number duel.
5. Solve number-chain challenges against a deliberately child-friendly AI.
6. Win the duel.
7. Watch a dedicated body-transfer screen.
8. Automatically take over the defeated robot body.
9. Return to the same deck using the new body and its ability.
10. Continue exploring.

This loop has been played through on desktop against all current opponents.

## 3. Binding design principles

These are confirmed decisions and should be treated as authoritative unless explicitly changed later.

### 3.1 Do not reveal whether the child's math is correct before submit

Before the player deliberately presses the reactor/submit action, the UI must **never** reveal whether the current number chain is correct.

Do not use:
- red/green submit-button states based on correctness,
- remaining-difference indicators,
- previews that expose the answer,
- reward previews that implicitly prove correctness.

Children must calculate themselves.

### 3.2 Clear cause and effect

Every state change must be visually understandable. Avoid unexplained random shifts, random markers, unexplained bonuses, or effects whose cause is unclear.

Any board manipulation must show:
- what caused it,
- which tiles are affected,
- the direction of movement,
- the resulting state.

### 3.3 Child-friendly difficulty

The AI is intentionally beatable. The goal is not adversarial optimization.

Current AI tendency:
- prefers 2-number chains,
- sometimes uses 3,
- rarely 4,
- very rarely 5 at high difficulty,
- may pass.

Children should have a realistic and satisfying winning chance.

## 4. Number duel rules

### 4.1 Shared board

- Shared 6 × 5 number field for team and AI.
- The board stays spatially unchanged when the turn changes.
- Used tiles dissolve and only affected tiles fall from their true positions.

### 4.2 Chains

- Directed orthogonal chains.
- Chains may bend.
- No tile may be repeated in one chain.
- At least 2 numbers are required.
- Selected chains show direction/arrows and step order clearly.

### 4.3 Rewards

For a correct chain:
- 2 numbers → 1 reactor core
- 3 numbers → 2 reactor cores
- 4 numbers → 4 reactor cores
- 5+ numbers → immediate win

Incorrect chain:
- visible overload/failure feedback,
- board remains unchanged,
- team loses 1 reactor core.

### 4.4 Current difficulty examples

Prototype encounter targets:
- easy: `+6`, values 1–5
- medium: `+8`, values 1–7
- strong: `+10`, values 1–9

Ordered subtraction with target 8 and values up to 20 was also prototyped earlier, but subtraction is not part of the first metagame deck yet.

Longer term, difficulty should be represented as separate parameters instead of a single hard-coded mode:
- operator/rule,
- target,
- number range,
- AI profile,
- optional encounter modifiers.

## 5. Resources are deliberately separated

### 5.1 Body abilities

Abilities belong to the currently controlled robot body.

They:
- do **not** cost meta-energy,
- normally have their own use limit per duel,
- are replaced when the player changes body.

Confirmed current ability:

**MAGNETAR 742 — REIHENSCHUB →**  
Once per duel, shift one selected row one field to the right.

The operation must be selected deliberately and visually previewed/animated.

Potential future ability families discussed but **not yet approved as exact robot abilities**:
- swap two numbers,
- copy a number,
- shift a selected row in a chosen direction.

Do not assume mockup placeholder skills are approved.

### 5.2 Meta-energy

Meta-energy is represented by lightning/battery energy.

It belongs to the metagame, not to a body.

Current use:
- spend 1 energy to change exactly one number by +1 or -1.

Rules:
- number duels do not randomly generate energy,
- energy is earned on the deck from stations/bonuses,
- the current deck starts at 0 energy,
- a visible station grants +1 and then becomes empty.

## 6. Metagame movement and deck

### 6.1 Movement

Confirmed: **free top-down movement**, not node-based or tile-by-tile movement.

Desktop:
- WASD / arrow keys.

Touch:
- do **not** use a virtual joystick,
- touch and hold on the game world,
- robot moves in the relative direction from the robot toward the touch point,
- dragging changes direction continuously,
- releasing stops movement,
- a subtle temporary touch-target indicator is acceptable.

### 6.2 Camera

Camera follows the robot softly. The deck is larger than one screen.

### 6.3 Environment

The prototype already uses a rasterized detailed deck rather than plain CSS rectangles:
- metal floor tiles,
- walls,
- doors/alcoves,
- consoles,
- machinery,
- pipes/cables,
- vents,
- warning markings,
- grime/vegetation,
- localized lighting.

Interactive actors remain separate sprites layered above the deck art.

Longer term, prefer proper reusable game assets/tiles rather than one monolithic generated background image.

## 7. Robot ownership color rule

This is a binding visual rule:

- **Every hostile robot is red.**
- **The currently player-controlled robot is green.**

This must be true everywhere:
- deck,
- number duel,
- body-transfer screen.

When a hostile robot is defeated and transferred into:
1. it remains red while it is still the defeated enemy body,
2. transfer reaches 100%,
3. ownership visibly switches,
4. the new body turns green,
5. that green body becomes the player's deck sprite and duel portrait.

The old body shown on the left side of the transfer screen is already the player's current body and therefore **must already be green**.

## 8. Active robot in the number duel

The number duel shows the currently acting robot **to the left of the number grid**.

Team turn:
- show current player body,
- green.

AI turn:
- show the current enemy,
- red.

The portrait/robot should be visually substantial, especially on desktop. v7 increased it significantly; do not regress to a tiny decorative icon.

Do not show `R1`, `R2`, etc. row-text markers on the number tiles. They were removed because they made the board visually noisy. Row/column information may remain in accessibility labels.

## 9. Body transfer screen

Automatic body transfer after victory is confirmed. There is no "keep old body / take new body" choice in the first slice.

The transfer is a dedicated rewarding screen, not a static reward card.

Layout:
- old/current body on the left,
- compact transfer/progress area in the center,
- defeated/new body on the right.

The center must remain compact and focus primarily on one transfer progress bar.

Approved conceptual progress stages:
1. SCAN
2. EXTRAKTION
3. UPLOAD
4. SYNCHRONISATION
5. AKTIVIERUNG

Important UI rule:
- there must **not** be an additional green background progress fill behind/over the new robot,
- the single center progress bar completes,
- then the new robot changes from red to green as a distinct activation beat,
- optional activation effects are welcome.

After activation:
- reveal `NEUE KÖRPERFÄHIGKEIT`,
- show the ability icon/name,
- show one short child-readable explanation,
- a tiny visual example is useful,
- `WEITER` becomes available only after transfer completion.

## 10. Current opponents in prototype

Current vertical-slice opponents:

### SENTRY-4
- easy
- target +6
- weak body/reward

### MAGNETAR 742
- medium
- target +8
- confirmed body ability: `REIHENSCHUB →`

### KRONOS-9
- strong
- target +10
- body visual exists in prototype/mockups
- exact body ability is **not finalized**

Earlier visual mockups used labels such as `PHASENSCHUB` and a starter `SCHUTZPROTOKOLL`; these were visual placeholders only and are **not approved game mechanics**.

## 11. Encounter behavior

Enemies do not automatically initiate combat.

Flow:
- approach enemy,
- show interaction opportunity,
- inspect/scan opponent,
- show compact encounter information,
- player deliberately presses the transfer/start action,
- switch to number duel.

The encounter information should communicate at least:
- robot name,
- difficulty,
- math target/rule,
- body ability/reward when appropriate.

## 12. Multiplayer / multiple children

The game supports 1–4 children cooperatively.

The number duel already rotates player turns.

For the metagame, the concept is a separate **meta pilot** who controls movement. Pilot rotation should happen after meaningful events rather than via time pressure.

Do not add timers simply to force sharing.

## 13. Fullscreen and landscape

This caused regressions during prototype iteration and should be treated as architecture, not as a one-off CSS patch.

Confirmed behavior:
- primary phone presentation is landscape,
- the entire app owns fullscreen state,
- fullscreen must not belong specifically to the duel component,
- touch/mobile startup should present a reliable user gesture such as `VOLLBILD STARTEN` so `requestFullscreen()` can legally run,
- request landscape orientation where supported,
- deck → duel → transfer must remain within the same fullscreen session,
- if fullscreen is left unintentionally, the app may offer re-entry,
- desktop must still work without forced fullscreen.

## 14. Health / life system — newly confirmed

A lost duel costs **life / integrity points**.

This is now a confirmed design direction.

Still open and must be designed before implementation:
- exact starting/max life count,
- whether life belongs to player consciousness or current robot body,
- what happens at zero,
- how/where life is repaired,
- whether a body can be lost/destroyed.

Recommended direction from discussion (not yet fully approved):
- around 3 integrity points,
- losing a duel costs 1,
- at 0, avoid a harsh classic game-over,
- possible fallback to a starter/backup droid or repair station.

Do not implement the zero-life consequence as binding until explicitly decided.

## 15. Save behavior

The prototype uses localStorage and evolved through several migration fixes.

Earlier duel key:
- `zahlenkern-save-v6`

Metagame prototype key:
- `zahlenkern-meta-v1`

Current prototype behavior includes defensive migration for invalid old deck positions.

For the temporary three-opponent vertical slice, when all three enemies have been defeated, a later fresh page load starts a fresh run instead of presenting an empty completed deck.

The production architecture should replace ad-hoc save patches with:
- explicit versioned schema,
- migration functions,
- validation of positions/entities,
- clear distinction between run-state and persistent progression.

## 16. Art direction

The game is **not limited to SVG**.

Preferred hybrid approach:
- HTML/CSS/SVG for HUD, buttons, overlays, diagrams and flexible UI,
- actual raster/pixel-art sprites and tiles for world, robots and environment,
- larger detailed art is acceptable on body-transfer/reward screens.

For true pixel art:
- integer scaling,
- `image-rendering: pixelated`,
- avoid arbitrary fractional scaling that blurs sprites.

The existing standalone prototype contains generated raster imagery as a visual proof, not necessarily final production assets.

## 17. Technical state of v7

`prototype/zahlenkern-prototyp-meta-v7.html` is deliberately a self-contained offline artifact.

It is valuable as:
- executable reference,
- behavior specification,
- regression reference,
- source from which to extract the current duel logic.

It is **not** the desired production architecture.

During rapid prototyping, metagame functionality was layered around an existing React standalone build using DOM bridges/patches. This enabled fast testing but produced fragility around:
- battle screen switching,
- MutationObservers,
- fullscreen,
- saved-state migration,
- cross-component UI patching.

Do not continue growing the application as one giant patched HTML file.

## 18. Recommended production architecture

The next implementation phase should turn the proven v7 loop into a normal component/state architecture.

Suggested conceptual structure:

```text
numberdroid/
├── README.md
├── CODEX_HANDOFF.md
├── docs/
│   ├── GAME_DESIGN.md
│   ├── ARCHITECTURE.md
│   └── DECISIONS.md
├── src/
│   ├── game/
│   │   ├── Game.tsx
│   │   ├── gameState.ts
│   │   └── saveGame.ts
│   ├── meta/
│   │   ├── MetaGame.tsx
│   │   ├── DeckView.tsx
│   │   ├── PlayerRobot.tsx
│   │   ├── EnemyRobot.tsx
│   │   ├── EncounterPanel.tsx
│   │   └── metaState.ts
│   ├── duel/
│   │   ├── NumberDuel.tsx
│   │   ├── NumberGrid.tsx
│   │   ├── ActiveRobot.tsx
│   │   ├── duelState.ts
│   │   └── encounterConfig.ts
│   ├── transfer/
│   │   └── TransferScreen.tsx
│   └── systems/
│       ├── robotBodies.ts
│       ├── abilities.ts
│       ├── difficulty.ts
│       └── health.ts
├── assets/
│   ├── robots/
│   ├── deck/
│   ├── tiles/
│   └── ui/
└── prototype/
    └── zahlenkern-prototyp-meta-v7.html
```

Exact filenames/framework can be adjusted, but the architectural boundaries matter.

### Core state boundary

Conceptually:

```text
NumberdroidGame
├── MetaState
│   ├── players
│   ├── pilot
│   ├── currentRobot
│   ├── metaEnergy
│   ├── health/integrity
│   ├── deckPosition
│   ├── usedStations
│   └── defeatedRobots
├── DeckView
├── NumberDuel
│   ├── EncounterConfig
│   └── onBattleFinished(result)
└── TransferScreen
```

`MetaGame` owns:
- deck,
- player body,
- enemy entities,
- energy,
- health,
- run progression.

`NumberDuel` receives an explicit encounter configuration and returns a result. It should not infer metagame state from DOM or localStorage.

Example `EncounterConfig` responsibilities:
- opponent id/body,
- operator/rule,
- target,
- number range,
- AI profile,
- player body/ability,
- available meta-energy.

Example `BattleResult` responsibilities:
- win/loss,
- remaining resources,
- optional statistics,
- body-transfer eligibility.

## 19. Recommended immediate development sequence

### Milestone A — Architecture extraction

Goal: reproduce v7 behavior without DOM bridges.

1. Preserve v7 untouched under `prototype/`.
2. Extract the existing number duel into a real `NumberDuel` component/module.
3. Create explicit `MetaState`.
4. Create `EncounterConfig` and `BattleResult` contracts.
5. Implement top-level game screen state:
   - deck,
   - encounter,
   - duel,
   - transfer.
6. Move fullscreen/orientation handling to top-level app shell.
7. Add versioned save schema.
8. Verify behavior against v7 before adding new mechanics.

### Milestone B — First complete deck / Vertical Slice 2

After architecture is stable, build one fuller deck rather than many shallow decks.

Target concept:
- roughly 10–15 minutes,
- around 5–7 opponents,
- 3 clearly differentiated robot bodies,
- 2–3 energy sources,
- meaningful optional routing,
- one clear deck objective.

Desired player decisions:
- “Which body do I want?”
- “Can I beat this robot now?”
- “Should I collect energy first?”
- “Do I need to fight this opponent at all?”

The map should stop feeling like a menu between math duels and begin to create exploration/progression choices.

### Milestone C — Health/integrity

After the component architecture exists, implement the confirmed loss-of-life rule once the exact zero-life consequence is decided.

## 20. Things not to do yet

Avoid adding these before the core architecture and first complete deck are stable:
- large skill trees,
- many decks,
- lots of robot types,
- extra unrelated minigames,
- boss systems,
- timers,
- complex inventory,
- random unexplained modifiers.

The strongest current feature is the simple loop of exploration, deliberate math duel, and rewarding body takeover. Protect that clarity.

## 21. Working instruction for Codex

When starting a new coding session, use this file and the v7 prototype as the basis.

Recommended opening instruction:

> Read `CODEX_HANDOFF.md` completely and inspect `prototype/zahlenkern-prototyp-meta-v7.html`. Treat the documented confirmed decisions as authoritative. First propose a migration plan from the standalone prototype to a clean component/state architecture. Preserve v7 as a read-only behavioral reference. Do not add new game mechanics during the architecture migration unless required to reproduce existing behavior.
