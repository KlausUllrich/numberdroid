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
                  ↘ loss ─────────→ Deck
```

Key boundaries:
- `App` owns cross-screen state and transitions.
- `MetaGame` owns deck movement/interactions.
- `NumberDuel` receives an explicit `EncounterConfig` and returns a `BattleResult`.
- `TransferScreen` owns only the transfer presentation.
- Fullscreen/orientation belongs to the app shell.
- Save data is versioned (`numberdroid-meta-v2`).
- A lost duel increments `damageTaken`; max lives and the zero-life consequence are intentionally still undecided.

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

### Active robot in duel

A visually substantial robot is shown **left of the number grid**.
- team turn → current player-controlled body, green
- AI turn → current enemy, red

Do not regress this to a tiny decorative icon. Desktop v7 intentionally made this element large.

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

Current deck contains a detailed raster environment plus separate interactive robot/station sprites. Longer term, move toward reusable proper tiles/assets rather than one monolithic generated deck image.

## Fullscreen / mobile

This must be treated as app architecture because prototype regressions occurred when it was tied to individual screens.

- Fullscreen belongs to the entire app shell.
- Touch/mobile startup provides a legal user gesture such as `VOLLBILD STARTEN`.
- Request landscape lock where the browser supports it.
- Deck → encounter → duel → transfer stays in the same fullscreen session.
- Desktop works without forced fullscreen.
- If fullscreen is exited, offering re-entry is acceptable.

## Health / life

Confirmed: **losing a duel costs one life/integrity point**.

Still open:
- max/start life count,
- what happens at zero,
- how repair works,
- whether health belongs to consciousness or current body.

The clean save model therefore stores `damageTaken` rather than inventing a maximum. Do not implement a zero-life consequence until explicitly decided.

## Save behavior

Clean key: `numberdroid-meta-v2`.

The migration layer may read legacy `zahlenkern-meta-v1` / `zahlenkern-save-v6` data. Validate saved deck coordinates and repair invalid positions.

For the temporary three-opponent prototype, a fully completed run is treated as a session boundary so a later fresh load can restart the slice instead of opening an empty deck.

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
- larger detailed art is acceptable on transfer/reward screens.

For pixel art use integer scaling and `image-rendering: pixelated`; avoid blurry arbitrary scaling.

## Architecture to preserve

The important boundary is behavioral, not exact filenames:

```text
Numberdroid App
├── MetaState
│   ├── currentBody
│   ├── metaEnergy
│   ├── damageTaken
│   ├── deckPosition
│   ├── station state
│   └── defeated robots
├── MetaGame
├── EncounterConfig
├── NumberDuel → BattleResult
└── TransferScreen
```

The duel must not infer metagame state from DOM or localStorage. The metagame must not click hidden duel controls. Do not reintroduce MutationObserver bridges or page reloads between surfaces.

## Immediate next work

The architecture extraction is complete on `agent/integrate-metagame-architecture`, but it still needs normal environment/browser validation before new content is added.

1. `npm install`
2. `npm run build`
3. run the clean app on desktop and phone
4. regression-test full loop against v7: deck → encounter → duel → transfer → deck
5. verify touch movement, fullscreen/landscape, save migration, red/green ownership, MAGNETAR ability and meta-energy
6. fix migration regressions in `src/`, not the standalone HTML

After that, build **Vertical Slice 2**: one fuller 10–15 minute deck with roughly 5–7 opponents, three meaningful bodies, 2–3 energy sources, optional routing and one clear deck objective. The desired decisions are: “Which body do I want?”, “Can I beat this robot now?”, “Should I collect energy first?”, and “Do I need to fight this opponent at all?”

Avoid large skill trees, many decks, unrelated minigames, bosses, timers or complex inventory until this first complete deck is stable.

## Recommended opening prompt for the next coding session

> Read `CODEX_HANDOFF.md`, `README.md`, `docs/ARCHITECTURE.md`, and inspect the frozen `zahlenkern-prototyp-meta-v7.html`. Continue from the clean implementation in `src/` on `agent/integrate-metagame-architecture`. First install/run the normal build and regression-test the complete loop on desktop and phone. Fix migration regressions in `src/`; do not patch the standalone HTML and do not add new mechanics until the clean v7-equivalent loop is stable.
