# Numberdroid — Durable Gameplay and Engineering Rules

Status: **binding durable rules**

This document contains long-lived gameplay, UX and engineering invariants for Numberdroid. It deliberately does **not** describe the current milestone, active art slice, session handoff or next-agent task.

For current repository navigation read `REPOSITORY_STRUCTURE.md` and `docs/README.md`. For current code behavior inspect `src/` and the relevant current domain contracts.

## 1. Clean architecture — do not reintroduce prototype bridges

Production code uses explicit state and typed data contracts.

Expected high-level flow:

```text
App
├── MetaGame / Deck
├── Encounter
├── NumberDuel
├── TransferScreen
└── DestroyedScreen
```

Use explicit contracts such as `EncounterConfig` and `BattleResult` between systems.

Do not recreate rapid-prototype bridge techniques in production code:

- hidden DOM button clicks to configure React state;
- `MutationObserver` as a bridge between game screens;
- page reloads as gameplay transitions;
- DOM text/style patching across component boundaries;
- localStorage as an implicit message bus;
- component-specific competing fullscreen ownership.

If a system needs information, pass it through explicit state, props, context or a clearly owned store.

`zahlenkern-prototyp-meta-v7.html` remains a frozen behavioral/reference artifact. Do not refactor it into production code.

## 2. Fullscreen and orientation

Fullscreen/orientation belong to the top-level application shell.

Requirements:

- phone play targets landscape;
- mobile/touch startup must use a legal user gesture for `requestFullscreen()`;
- request landscape orientation where supported;
- Deck → Duel → Transfer/Destroyed should remain in one fullscreen session;
- desktop must work without forced fullscreen;
- leaving fullscreen may provide a clear re-entry action.

Do not fix fullscreen regressions by globally hiding startup UI with CSS.

## 3. Math correctness remains hidden until submit

Before the player deliberately triggers the reactor/submit action, the UI must **not reveal whether a selected chain is mathematically correct**.

Never expose correctness through:

- red/green submit state;
- remainder/difference indicators;
- success previews;
- reward previews that prove correctness.

Children must actually calculate.

## 4. Number board invariants

- shared 6 × 5 board;
- team and AI use the same board;
- turn switching does not spatially rebuild the board;
- used tiles dissolve;
- only affected tiles fall/refill from their actual positions;
- chains are directed and orthogonal;
- chains may bend;
- no tile repeats in one chain;
- at least 2 numbers;
- selection direction/order must be readable.

Current reward contract:

- 2 numbers → 1 reactor core;
- 3 numbers → 2 cores;
- 4 numbers → 4 cores;
- 5+ numbers → immediate win;
- incorrect chain → visible overload, board unchanged, team loses 1 reactor core.

Do not show visible `R1`, `R2`, etc. row markers on number tiles. Accessibility labels may still contain row/column information.

## 5. Reactor / target presentation

The reactor should be visually substantial, especially on desktop.

- show required arithmetic operation and target directly above the reactor;
- the arithmetic operator (`+`, `−`, later `×`, `÷`) is a prominent visual symbol, not small inline text;
- do not show redundant balance text such as `REAKTORBALANCE 6:6` when the visual core field already communicates it;
- keep chain-length/reward explanation visually secondary.

## 6. AI behavior

The AI is intentionally child-friendly, not optimal.

Current behavior target:

- usually 2-number chains;
- sometimes 3;
- rarely 4;
- very rarely 5 at high difficulty;
- may pass.

Do not make the AI substantially more punishing without an explicit design decision.

## 7. Robot ownership colour invariant

Binding semantic colour language:

- currently controlled player robot = **green**;
- hostile robot = **red**;
- neutral/NPC body = **blue**;
- Kayo semantic status = **orange**;
- PRIMUS semantic status = **black / controlled neutral authority language**, not villain styling.

Ownership must remain consistent across deck, duel and transfer presentation.

A destroyed robot is no longer active hostile/controlled body and should use a neutral damaged/desaturated treatment rather than violating ownership semantics.

Transfer presentation:

- old/current body on left is already owned → green;
- defeated/new body on right begins hostile → red;
- only after transfer completion does the new body become green;
- use the center progress bar as the primary transfer progress indicator;
- do not add a second competing green progress overlay behind/on the new robot.

## 8. Active robot in Number Duel

Show the currently acting robot to the **left of the number grid**.

- player/team turn → current body, green;
- AI turn → enemy body, red.

The robot must remain visually substantial and readable on desktop and mobile.

## 9. Metagame movement

Confirmed movement model: **free top-down movement**.

Desktop:

- WASD and/or arrow keys.

Touch:

- no virtual joystick;
- touch/hold on the world;
- move in the direction from robot toward touch point;
- dragging changes direction;
- release stops movement.

Movement pauses while modal encounter/transfer UI owns interaction.

## 10. Body abilities and meta-energy are separate

Body abilities belong to the current robot body and do **not** consume meta-energy unless a later explicit design changes that contract.

Confirmed body ability:

**MAGNETAR 742 — REIHENSCHUB →**

- once per duel;
- player deliberately selects a row;
- selected row shifts one field right;
- operation must be visibly previewed/animated.

Do not treat old mockup labels such as KRONOS `PHASENSCHUB` or starter `SCHUTZPROTOKOLL` as approved mechanics without a current design decision.

Meta-energy is a separate metagame resource.

Current use:

- spend 1 energy to modify exactly one number by +1 or -1.

Rules:

- duels do not randomly generate it;
- deck stations/bonuses grant it;
- used stations visibly become empty/inactive.

## 11. Health / HP

Current confirmed run contract:

- a Floor run starts with **3 HP**;
- every lost duel costs exactly **1 HP**;
- remaining HP must be visibly readable on deck and in Number Duel;
- at **0 HP** the current robot is destroyed;
- 0 HP opens a dedicated `DestroyedScreen`; do not silently return to the deck;
- the player deliberately restarts the current Floor from that screen;
- Floor restart resets run state including start position, starter body PICO-3, defeated opponents, station state, meta-energy and HP;
- selected player count is retained across the Floor restart.

The save model may persist `damageTaken`; with 3 starting HP, remaining HP is `3 - damageTaken`. Clamp persisted damage to 0–3.

Questions such as the fiction behind HP or future repair/healing mechanics remain separate design decisions and must not block the confirmed runtime behavior.

## 12. Saves

Use an explicit versioned save schema with validation/migration.

Keep separate concepts for:

- run state;
- persistent progression;
- current screen/encounter state where appropriate.

Never use saved state as a hidden cross-component control channel.

If saved state has 0 HP, loading must return to the destroyed state rather than strand the player on the deck. A completed Floor/run must not be silently reset merely because the app reloads.

## 13. Offline requirement

The game should remain usable offline after initial installation/load where practical.

- prefer local assets;
- avoid runtime dependencies on external image/font/CDN URLs;
- preserve the service-worker/offline direction;
- do not introduce unnecessary network-only game assets.

## 14. Visual/readability standard

Target users include younger children.

Prioritize:

- large readable type;
- large touch targets;
- obvious ownership and turn state;
- visible HP/resource state;
- visible cause/effect;
- no unexplained random UI changes;
- no worksheet-like clutter.

Desktop and mobile must be tested independently; do not assume responsive CSS that works on one automatically works on the other.

## 15. Validation discipline

For runtime/gameplay changes, run the tests, build, browser, and platform gates
selected by `CHANGE_RISK_AND_VERIFICATION.md` and the actual affected paths.
Pure portable helpers need focused coverage; visible or broad gameplay changes
escalate to the relevant production build and interaction/platform regression
gates.

Manually verify the interaction paths affected by the change. For broad gameplay changes, regression coverage should include as relevant:

- desktop and phone/touch startup;
- fullscreen/landscape behavior;
- free deck movement;
- encounter modal pausing movement;
- duel start without reload/hanging;
- hidden correctness until submit;
- team/AI turn switching;
- robot ownership colours;
- meta-energy ±1;
- MAGNETAR row shift;
- HP loss and DestroyedScreen flow;
- Floor restart state reset;
- transfer old/new body colours and completion;
- defeated-enemy persistence;
- save/reload validity;
- reactor readability.

Fix regressions in the clean architecture rather than patching the frozen prototype.

## 16. Change discipline

- keep `main` stable;
- use focused branches/PRs;
- do not combine broad repository reorganization with gameplay changes;
- preserve confirmed design rules unless the user explicitly revises them;
- when a durable rule changes, update the appropriate current domain contract rather than adding another competing status document.

Current milestones, active tasks and handoffs belong in planning/history, not in this durable rules document.
