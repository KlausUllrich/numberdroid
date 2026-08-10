# AGENTS.md

## Purpose

This repository contains **Numberdroid** (working title previously *Zahlenkern*), a cooperative math game for 1–4 children. The current development branch is migrating the proven v7 standalone prototype into a clean React/TypeScript application architecture.

This file defines durable working rules for coding agents. Read it before modifying the project.

## Source of truth

Use the following precedence when making decisions:

1. `AGENTS.md` — durable engineering/workflow rules.
2. `CODEX_HANDOFF.md` — current project state, confirmed game-design decisions, open questions, and migration context.
3. `zahlenkern-prototyp-meta-v7.html` — frozen behavioral/visual reference for the proven prototype loop.
4. Current React/TypeScript implementation under `src/` — production code being developed.

If these conflict, do not silently invent a resolution. Preserve confirmed design decisions and report the conflict.

## Immediate objective

The immediate objective is **behavioral parity with v7 on the clean architecture**, plus explicitly confirmed parity fixes, not unrelated feature expansion.

Before adding new gameplay systems:

1. install dependencies,
2. run the build/type checks,
3. run the app locally,
4. verify the full loop on desktop,
5. verify the full loop on a phone/touch viewport,
6. fix migration/regression issues,
7. only then extend gameplay.

Do not reintroduce prototype bridge techniques merely to make a regression disappear.

## Architectural boundaries

The application should use explicit state and typed data contracts.

Expected flow:

```text
App
├── MetaGame / Deck
├── Encounter
├── NumberDuel
├── TransferScreen
└── DestroyedScreen
```

The intended runtime transition is:

```text
Deck → Encounter → NumberDuel
                   ├─ loss, HP > 0 → Deck
                   ├─ loss, HP = 0 → DestroyedScreen → restart current Floor → Deck
                   └─ win → TransferScreen → Deck
```

Use explicit contracts such as `EncounterConfig` and `BattleResult` between systems.

### Do not use

Do not recreate any of the following v7 prototype techniques in production code:

- hidden DOM button clicks to configure React state,
- `MutationObserver` as a bridge between game screens,
- page reloads to transition between deck and duel,
- DOM text/style patching across component boundaries,
- localStorage as an implicit message bus,
- component-specific competing fullscreen ownership.

If a system needs information, pass it through state, props, context, or a clearly owned store.

## Fullscreen and orientation

Fullscreen/orientation belong to the **top-level application shell**.

Requirements:

- phone play targets landscape,
- mobile/touch startup must provide a legal user gesture for `requestFullscreen()`,
- request landscape orientation where supported,
- Deck → Duel → Transfer/Destroyed should remain in one fullscreen session,
- desktop must work without forced fullscreen,
- leaving fullscreen may offer a clear re-entry action.

Do not solve fullscreen regressions by hiding startup UI globally with CSS.

## Core gameplay invariants

These are confirmed design rules and must not regress.

### Math correctness remains hidden until submit

Before the player deliberately triggers the reactor/submit action, the UI must **not reveal whether a selected chain is mathematically correct**.

Never expose correctness through:

- red/green submit state,
- remainder/difference indicators,
- success previews,
- reward previews that prove correctness.

### Number board

- shared 6 × 5 board,
- team and AI use the same board,
- turn switching does not spatially rebuild the board,
- used tiles dissolve,
- only affected tiles fall/refill from their actual positions,
- chains are directed and orthogonal,
- chains may bend,
- no tile repeats in one chain,
- at least 2 numbers,
- selection direction/order must be readable.

Rewards:

- 2 numbers → 1 reactor core,
- 3 numbers → 2 cores,
- 4 numbers → 4 cores,
- 5+ numbers → immediate win,
- incorrect chain → visible overload, board unchanged, team loses 1 reactor core.

Do not show visible `R1`, `R2`, etc. row markers on number tiles. Accessibility labels may still contain row/column information.

### Reactor / target presentation

The reactor should be visually substantial, especially on desktop.

- Do not show redundant text such as `REAKTORBALANCE 6:6` when the colored reactor-core field already communicates the balance.
- Show the required arithmetic operation and target directly above the reactor.
- The arithmetic operator (`+`, `−`, later `×`, `÷`) must be a prominent visual symbol, not small inline text.
- Keep the chain-length/reward explanation visually secondary and toward the bottom of the reactor panel.

### AI

The AI is intentionally child-friendly, not optimal.

Current behavior target:

- usually 2-number chains,
- sometimes 3,
- rarely 4,
- very rarely 5 at high difficulty,
- may pass.

Do not make the AI substantially more punishing without an explicit design decision.

## Robot ownership color invariant

This is a binding visual rule:

- **hostile robot = red**
- **currently controlled player robot = green**

This must be consistent on:

- the deck,
- the active-robot display in the number duel,
- the transfer screen.

A destroyed robot is no longer an active hostile/controlled body and should use a neutral damaged/desaturated treatment rather than violating the ownership colors.

Transfer screen behavior:

- old/current body on the left is already owned → green,
- defeated/new body on the right begins hostile → red,
- at 100% transfer completion the new body changes to green,
- use the center progress bar as the primary progress indicator,
- do not add a second green progress overlay behind/on the new robot.

## Active robot in number duel

Show the currently acting robot to the **left of the number grid**.

- player/team turn → current body, green,
- AI turn → enemy body, red.

The robot should be visually substantial on desktop, not a small decorative badge. Preserve readable font sizes on both desktop and mobile.

## Metagame movement

Confirmed movement model: **free top-down movement**.

Desktop:

- WASD and/or arrow keys.

Touch:

- no virtual joystick,
- touch/hold on the world,
- move in the direction from robot toward touch point,
- dragging changes direction,
- release stops movement.

Movement should pause while modal encounter/transfer UI owns interaction.

## Resources

### Body abilities

Body abilities belong to the current robot body and do **not** consume meta-energy.

Confirmed ability:

**MAGNETAR 742 — REIHENSCHUB →**

- once per duel,
- player deliberately selects a row,
- selected row shifts one field right,
- operation must be visually previewed/animated.

Do not treat mockup labels such as KRONOS `PHASENSCHUB` or starter `SCHUTZPROTOKOLL` as approved mechanics.

### Meta-energy

Meta-energy is a separate metagame resource.

Current use:

- spend 1 energy to modify exactly one number by +1 or -1.

Rules:

- duels do not randomly generate it,
- deck stations/bonuses grant it,
- current vertical slice begins at 0,
- used stations visibly become empty/inactive.

## Health / HP

Confirmed rules:

- a Floor run starts with **3 HP**,
- every lost duel costs exactly **1 HP**,
- remaining HP must be visibly readable on the deck and in the number duel,
- at **0 HP** the current robot is destroyed,
- 0 HP opens a dedicated `DestroyedScreen`; do not silently return to the deck,
- the player must deliberately restart the current Floor from that screen,
- restarting the Floor resets run state: start position, starter body PICO-3, defeated opponents, station state, meta-energy and HP,
- the selected player count is retained across the Floor restart,
- later, when multiple Floors exist, the Floor to restart/select can become an explicit choice.

The save model may continue storing `damageTaken` as the persisted representation; with 3 starting HP, remaining HP is `3 - damageTaken`. Clamp persisted damage to the valid 0–3 range.

Still open unless explicitly decided later:

- repair/healing mechanics,
- whether the fiction ultimately describes HP as consciousness integrity, body integrity, or a shared run resource.

Do not let those semantic questions block the confirmed 3-HP runtime behavior.

## Saves

Use an explicit versioned save schema with validation/migration.

Keep separate concepts for:

- run state,
- persistent progression,
- current screen/encounter state where appropriate.

Never use saved state as a hidden cross-component control channel.

If a saved state has 0 HP, loading must return to the destroyed state rather than strand the player on the deck. A completed Floor/run must not be silently reset merely because the app reloads.

## Offline requirement

The game should remain usable offline after initial installation/load where practical.

- prefer local assets,
- avoid runtime dependencies on external image/font/CDN URLs,
- preserve the service-worker/offline direction,
- do not introduce unnecessary network-only game assets.

## Visual/readability standard

Target users are younger children.

Prioritize:

- large readable type,
- large touch targets,
- obvious ownership and turn state,
- visible HP/resource state,
- visible cause/effect,
- no unexplained random UI changes,
- no worksheet-like clutter.

Desktop and mobile should be tested independently; do not assume responsive CSS that works on one automatically works on the other.

## Validation before merging architecture work

At minimum run:

```bash
npm install
npm run build
```

Run any available lint/type/test scripts as well.

Then manually verify:

1. app starts on desktop,
2. app starts on phone/touch viewport,
3. fullscreen entry works on phone,
4. landscape behavior is sane,
5. player can move on deck,
6. encounter dialog pauses movement,
7. SENTRY/MAGNETAR/KRONOS can be engaged,
8. number duel starts without reload/hanging,
9. math correctness remains hidden until submit,
10. team/AI turn switching works,
11. active robot changes green/red correctly,
12. meta-energy ±1 works and consumes exactly one energy,
13. MAGNETAR row shift works once per duel,
14. HP starts at 3 and is visible on deck and duel,
15. each lost duel removes exactly 1 HP,
16. losses at 2 HP and 1 HP return to the deck,
17. the loss that reaches 0 HP opens the robot-destroyed screen,
18. reloading at 0 HP still opens the destroyed state,
19. Floor restart restores the start position, PICO-3, all current Floor enemies/stations/resources and 3 HP,
20. win enters transfer screen,
21. old body is green and new body starts red,
22. new body becomes green only at transfer completion,
23. returning to deck uses the newly controlled body,
24. defeated enemies remain resolved during the run,
25. save/reload does not strand the player in an invalid state,
26. desktop reactor is substantial, operation/target are prominent above it, and redundant `REAKTORBALANCE X:Y` text is absent.

If a regression is found, fix it in the clean architecture rather than patching the frozen v7 file.

## Git/workflow rules

- Keep `main` stable.
- Use focused branches/PRs for changes.
- Preserve `zahlenkern-prototyp-meta-v7.html` as a behavioral reference; do not refactor it into production code.
- Keep commits focused and descriptively named.
- Do not mix broad formatting/reorganization with gameplay changes unless necessary.
- Update `CODEX_HANDOFF.md` when a major design decision, architectural boundary, or milestone changes.
- Update this `AGENTS.md` only for durable rules that future agents should inherit.

## Next milestone after parity

Once the clean architecture reliably reproduces v7 plus the confirmed 3-HP destruction flow, the next planned development target is **Vertical Slice 2**:

- one fuller deck,
- roughly 10–15 minutes,
- around 5–7 opponents,
- 3 meaningfully differentiated robot bodies,
- 2–3 meta-energy sources,
- optional routing/encounter choices,
- a clear deck objective,
- reusable Floor/map data so later Floors can be selected/restarted explicitly.

Do not jump to many decks, large skill trees, many robot types, unrelated minigames, or complex inventory before this slice is stable.
