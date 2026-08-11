# Numberdroid — Robot Body Size and Deck Collision

This document records the confirmed VS2 rule that physical robot size belongs to the robot body/instance and must not change merely because that robot becomes player-controlled.

## Binding rule

- A robot keeps its physical deck size through encounter, duel result, transfer, and player control.
- `EncounterConfig.deckSize` describes the encountered physical body size.
- A successful transfer copies that size into `MetaState.currentDeckSize`.
- Rendering and collision both read the same current size.
- Do not resize an acquired body to a generic player size.

Current size classes:

- `standard`: approximately 52 px deck sprite, 18 px collision radius; designed to fit a 64 px standard doorway.
- `large`: approximately 96 px deck sprite, 38 px collision radius; requires appropriately wide/tall routes and large gates.

The exact art dimensions may be tuned, but visual size and collision size must remain coherent.

## Design meaning

Size is intended to carry gameplay meaning:

- smaller bodies are generally weaker/lighter,
- larger bodies are generally stronger/heavier,
- large robots should be less common and can appear as later-level threats/rewards,
- strength mechanics tied to size are still open; do not invent a new damage/HP formula without a separate design decision.

## Level-design consequence

A level that allows transfer into a large body must provide a valid route for that body from the transfer point to the intended next objective/exit. Standard one-tile doors may deliberately exclude large bodies; large gates exist to support large-body routes.

Do not make a large acquired robot shrink simply to solve navigation. Fix the level route or use an explicitly designed body-size mechanic instead.

## Collision rule

Walkable geometry is a union of room, corridor, and doorway rectangles. Collision must test the robot footprint against that union.

Do **not** shrink each individual walkable rectangle by the robot radius. Doing so creates artificial non-walkable seams between adjacent room/door/corridor rectangles.

Obstacle and closed-door collision must use the active robot's collision radius.
