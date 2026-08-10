# Confirmed Decisions

This is a short index. `CODEX_HANDOFF.md` contains the detailed rationale and full rules.

## Game loop

- Free top-down deck movement.
- Enemies do not auto-attack.
- Player explicitly scans/starts an encounter.
- Win automatically leads to body transfer.
- After transfer the new body becomes the player body.
- Loss costs one life/integrity point and returns the player to the deck.

## Faction color

- hostile robot = red
- player-controlled robot = green
- transfer left/current body = green
- transfer right/new body = red until 100%, then green

## Number duel

- Shared 6×5 board.
- Orthogonally connected directed chains.
- No correctness indication before deliberate submit.
- 2 numbers → 1 core.
- 3 numbers → 2 cores.
- 4 numbers → 4 cores.
- 5+ numbers → instant win.
- Wrong calculation leaves board unchanged and loses one reactor core.
- No visible `R1`–`R6` text on tiles.
- Active robot is a prominent element left of the grid.

## Resources

- Body abilities belong to the current robot and do not cost meta-energy.
- MAGNETAR 742 confirmed ability: once-per-duel row shift right.
- Meta-energy comes from the deck.
- ±1 on exactly one number costs one meta-energy.

## Input

- Desktop: WASD / arrow keys.
- Touch: hold on the world and move in the relative direction of the touch point.
- No virtual joystick.

## App shell

- Phone target is landscape.
- Fullscreen belongs to the whole app.
- Deck, duel and transfer do not independently own fullscreen.

## Still open

- Maximum life/integrity points.
- Exact consequence at zero life.
- KRONOS-9 body ability.
- Final starter-body ability (currently none).
