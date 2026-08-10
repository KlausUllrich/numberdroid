# Numberdroid — Codex Handover

**Status:** 10 August 2026  
**Reference prototype:** `zahlenkern-prototyp-meta-v7.html`  
**Clean integration branch:** `agent/integrate-metagame-architecture`

## Current state

The rapid v7 prototype proved the full loop but attached the metagame around an existing compiled React number duel using DOM patches, hidden control clicks, localStorage bridges and `MutationObserver`. That architecture is now replaced on the integration branch by a normal React/TypeScript application.

Continue development in `src/`. Keep `zahlenkern-prototyp-meta-v7.html` frozen as a behavioral/visual regression reference. Do not resume patching the standalone HTML.

The clean application has explicit top-level surfaces:

```text
Deck → Encounter → NumberDuel → Transfer → Deck
                  ↘ loss, HP > 0 ─────────→ Deck
                  ↘ loss, HP = 0 → DestroyedScreen → restart Floor → Deck
```

Key boundaries:
- `App` owns cross-screen state and transitions.
- `MetaGame` owns deck movement/interactions.
- `NumberDuel` receives an explicit `EncounterConfig` and returns a `BattleResult`.
- `TransferScreen` owns only the transfer presentation.
- `DestroyedScreen` owns the 0-HP presentation and explicit Floor-restart action.
- Fullscreen/orientation belongs to the app shell.
- Save data remains versioned under `numberdroid-meta-v2`.
- HP is represented compatibly as `3 - damageTaken`; `damageTaken` is clamped to 0–3.

## Product goal

Numberdroid (previous working title: Zahlenkern) is a cooperative math game for 1–4 younger primary-school children, loosely Paradroid-inspired. Children explore a spaceship as a robot, deliberately engage hostile robots in number-chain duels and, on victory, transfer into the defeated robot body.

The game must feel like a game first, not a worksheet. It should be readable, tactile, fair, understandable without time pressure and give children a realistic chance to win.

Primary target: **phone in landscape orientation**. Desktop landscape must also work. Offline use is important.

## Binding gameplay rules

### Number duel

- Shared 6×5 board for team and AI.
- Directed orthogonal chains; chains may bend.
- No tile may repeat in one chain.
- Minimum chain length: 2.
- The board remains spatially the same on turn change.
- Used tiles disappear and affected columns refill/fall.
- Visible `R1`/`R2`/... row text is forbidden; row/column may remain in accessibility labels.

Correct-chain rewards:
- 2 numbers → 1 reactor core
- 3 numbers → 2 cores
- 4 numbers → 4 cores
- 5+ numbers → immediate win

Incorrect chain:
- visible overload/failure after submit,
- board remains unchanged,
- team loses 1 reactor core.

**Critical rule:** before the player deliberately presses `REAKTOR AUSLÖSEN`, the UI must never reveal whether the calculation is correct. No remainder, correctness color, revealing button state or reward logic that proves the answer.

Current encounter math:
- SENTRY-4 → +6, values 1–5, easy AI
- MAGNETAR 742 → +8, values 1–7, medium AI
- KRONOS-9 → +10, values 1–9, strong AI

Subtraction target 8 was prototyped but is not part of the first deck.

AI is deliberately child-friendly: mostly 2-number chains, sometimes 3, rarely 4, very rarely 5; it may pass.

### Reactor / math-target presentation

The reactor is an important game object, not a small sidebar readout.

Current confirmed presentation:
- reactor/core field should be visually substantial on desktop,
- the arithmetic operation and target sit directly above the reactor,
- the operator itself (`+`, `−`, later `×`, `÷`) is large and immediately readable,
- redundant text such as `REAKTORBALANCE 6:6` is omitted because the colored core field communicates the balance more clearly,
- the chain-length reward explanation belongs visually near the bottom of the panel,
- meta-energy remains a separate readout.

### Active robot in duel

A visually substantial robot is shown **left of the number grid**.
- team turn → current player-controlled body, green
- AI turn → current enemy, red

Do not regress this to a tiny decorative icon. Desktop v7 intentionally made this element large.

Remaining robot HP must also be visible during the duel.

## Faction/ownership color rule

Binding everywhere:
- **hostile robot = red**
- **currently controlled player robot = green**

This applies on deck, in the number duel and on the transfer screen.

During transfer:
1. old/current body on left is green from frame one,
2. defeated/new body on right remains red during transfer,
3. the single central progress bar reaches 100%,
4. then the new body visibly switches red → green,
5. that body becomes the player's deck sprite and duel portrait.

A destroyed robot uses a neutral/desaturated destroyed treatment; it is neither an active hostile nor an active controlled body.

## Body transfer screen

Victory automatically leads to body transfer in the first slice; there is no keep-old/take-new choice.

Layout:
- current/old body left,
- compact transfer/progress section center,
- defeated/new body right.

Approved progress stages:
`SCAN → EXTRAKTION → UPLOAD → SYNCHRONISATION → AKTIVIERUNG`

Use **one central progress bar only**. Do not add a second green background/fill behind the new robot. At completion, use a distinct activation/color-switch effect and then reveal the new body capability. `WEITER` is available only after completion.

## Resources

### Body abilities

Body abilities belong to the current robot body. They do not cost meta-energy.

Confirmed ability:
- **MAGNETAR 742 — REIHENSCHUB →**: once per duel, shift one deliberately selected row exactly one field to the right.

Potential swap/copy/other-shift concepts are not yet assigned as final abilities.

Do **not** promote old visual mockup placeholders such as `PHASENSCHUB` or `SCHUTZPROTOKOLL` into mechanics.

KRONOS-9's exact ability is still open.

### Meta-energy

Meta-energy belongs to the metagame, not the body.
- earned at deck stations/bonuses,
- not randomly generated by the duel,
- first deck starts at 0,
- current station grants +1 and becomes empty,
- spending 1 energy changes exactly one number by +1 or −1.

## Metagame movement

Confirmed: **free continuous top-down movement**, not node/grid movement.

Desktop:
- WASD / arrow keys.

Touch:
- no virtual joystick,
- touch and hold anywhere on the world,
- robot moves in the relative direction from itself toward the touch point,
- dragging continuously changes direction,
- release stops movement.

Camera follows the robot. Enemies do not auto-attack: approach → scan → inspect encounter → explicitly start transfer duel.

Current deck contains a detailed raster environment plus separate interactive robot/station sprites. Longer term, move toward reusable proper tiles/assets and data-driven `FloorDefinition`/map data rather than one monolithic generated deck image.

## Fullscreen / mobile

This must be treated as app architecture because prototype regressions occurred when it was tied to individual screens.

- Fullscreen belongs to the entire app shell.
- Touch/mobile startup provides a legal user gesture such as `VOLLBILD STARTEN`.
- Request landscape lock where the browser supports it.
- Deck → encounter → duel → transfer/destroyed stays in the same fullscreen session.
- Desktop works without forced fullscreen.
- If fullscreen is exited, offering re-entry is acceptable.

## Health / HP

Confirmed runtime rule:
- each Floor run starts at **3 HP**,
- a lost duel removes exactly **1 HP**,
- HP is visible on the deck and in the duel,
- losses at 2 HP or 1 HP return to the deck,
- the loss that reaches **0 HP** opens a dedicated **ROBOTER ZERSTÖRT** screen,
- the player explicitly chooses `FLOOR NEU STARTEN`,
- restarting the current Floor resets the run to its initial state: start position, PICO-3, enemies unresolved again, station unused, meta-energy 0 and HP 3,
- player count is retained,
- when multiple Floors exist later, Floor selection/restart can become data-driven.

The current save schema keeps `damageTaken` for compatibility. Remaining HP is derived as `3 - damageTaken`; sanitize/clamp it to 0–3. A reload at 0 HP must reopen the destroyed state, not put the robot back on the deck.

Still open:
- repair/healing mechanics,
- final fiction/ownership of HP (body vs consciousness vs shared run integrity).

These semantic questions do not change the confirmed 3-HP gameplay behavior.

## Save behavior

Clean key: `numberdroid-meta-v2`.

The migration layer may read legacy `zahlenkern-meta-v1` / `zahlenkern-save-v6` data. Validate saved deck coordinates and repair invalid positions.

A completed run must remain persisted across reload; do not silently resurrect defeated enemies. The explicit Floor-restart action is what resets current Floor run state after robot destruction.

## Multiple children

Supports 1–4 players cooperatively.
- duel turns rotate between children,
- metagame has a separate pilot concept,
- pilot rotation should follow meaningful events, not timers.

Do not introduce time pressure merely to force sharing.

## Art direction

Not limited to SVG.
- HTML/CSS/SVG for flexible HUD/UI,
- raster/pixel-art sprites/tiles for game world and robots,
- larger detailed art is acceptable on transfer/reward/destroyed screens.

For pixel art use integer scaling where practical and `image-rendering: pixelated`; avoid blurry arbitrary scaling.

## Architecture to preserve

The important boundary is behavioral, not exact filenames:

```text
Numberdroid App
├── MetaState
│   ├── currentBody
│   ├── metaEnergy
│   ├── damageTaken → HP
│   ├── deckPosition
│   ├── station state
│   └── defeated robots
├── MetaGame
├── EncounterConfig
├── NumberDuel → BattleResult
├── TransferScreen
└── DestroyedScreen → restartFloorState
```

The duel must not infer metagame state from DOM or localStorage. The metagame must not click hidden duel controls. Do not reintroduce MutationObserver bridges or page reloads between surfaces.

## Immediate next work

The architecture extraction is complete on `agent/integrate-metagame-architecture`. The environment build blocker was resolved on Klaus's local checkout, and the original v7 deck background has been restored as `public/assets/deck/deck-a7.webp`.

Current validation sequence:
1. pull the latest integration branch,
2. `npm run build`,
3. run the clean app on desktop,
4. verify 3 → 2 → 1 → 0 HP across three lost duels,
5. confirm 0 HP opens the destroyed screen and Floor restart returns to the initial Floor state with 3 HP,
6. verify desktop reactor sizing and operation/target hierarchy,
7. run the full deck → encounter → duel → transfer → deck loop,
8. verify touch movement, fullscreen/landscape, save/reload, red/green ownership, MAGNETAR ability and meta-energy on phone/touch.

After that, build **Vertical Slice 2**: one fuller 10–15 minute Floor with roughly 5–7 opponents, three meaningful bodies, 2–3 energy sources, optional routing and one clear deck objective. Before multiplying Floors, move toward reusable Floor/map data and a modular tile/object approach.

Avoid large skill trees, many Floors, unrelated minigames, bosses, timers or complex inventory until this first complete Floor is stable.

## Recommended opening prompt for the next coding session

> Read `AGENTS.md`, `CODEX_HANDOFF.md` and inspect the frozen `zahlenkern-prototyp-meta-v7.html`. Continue from the clean implementation in `src/` on `agent/integrate-metagame-architecture`. First build/run and regression-test the full loop on desktop and phone, including the confirmed 3-HP → destroyed → Floor-restart flow and the reactor/target presentation. Fix regressions in `src/`; do not patch the standalone HTML or reintroduce DOM/localStorage bridge techniques.
