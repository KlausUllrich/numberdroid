# Numberdroid — Workbench Authoring Pass v0.12.3

Status: **CURRENT authoring/usability contract layered on v0.12 semantic Overrides**

This document records the v0.12.3 extension of the Level Compiler Workbench. The underlying semantic Override/Lock model remains defined by `OVERRIDES_AND_WORKBENCH.md`.

## 1. Purpose

v0.12 proved that the Workbench can edit declarative compiler input safely. v0.12.1 restored mobile gesture/inspector behavior and v0.12.2 made direct move/resize controls constraint-aware.

v0.12.3 closes four practical authoring gaps discovered during real mobile QA:

1. Encounter robots were visible but could not be selected/edited.
2. The Workbench had export JSON but no explicit way to continue work later on the same browser/device.
3. Accepted edits had no Undo/Redo history.
4. Disabled constraint-aware controls did not explain their reason on touch devices.

These are authoring-layer capabilities. They do not create a second runtime or bypass the compiler.

## 2. Actor / Encounter selection

Generated Encounter actors are now first-class Workbench selection targets alongside Spaces and Props.

The visible Actor keeps its stable semantic Encounter ID, for example:

```text
primus-sentry-4
```

Selecting it opens the semantic inspector.

The initial v0.12.3 Actor edit is **ROBOT TYPE**.

Supported current enemy robot types come from the existing game body catalog:

```text
SENTRY-4
MAGNETAR 742
KRONOS-9
```

PICO is not offered as an enemy replacement because `EnemyId` deliberately excludes the player/base body.

## 3. `robotType` semantic Override

`PlacementOverride` may now contain:

```ts
{
  targetId: "primus-sentry-4",
  robotType: "magnetar"
}
```

`robotType` is legal only for an authored Encounter ID.

During semantic compilation it replaces both:

```text
enemyId
bodyId
```

while preserving the rest of the Encounter intent:

- stable Encounter ID;
- Space;
- Neutral / Guard / Patrol / Aggressive behavior;
- Patrol Route identity;
- math mode / label / role;
- difficulty;
- tags;
- story/progression references that target the Encounter ID.

Therefore changing SENTRY → MAGNETAR is not a Workbench-only visual skin. The normal downstream Actor placement and runtime/Tiled emission receive the substituted canonical robot type.

Diagnostic:

```text
ENCOUNTER_ROBOT_TYPE_OVERRIDDEN
```

The Override validator rejects `robotType` on non-Encounter targets and rejects unknown runtime robot identities loaded from untrusted/stale draft JSON.

## 4. Undo / Redo contract

Workbench history stores snapshots of **accepted semantic `Override[]` state only**.

An accepted edit follows:

```text
current Override[]
→ proposed semantic edit
→ full compiler validation
→ valid
→ commit new Override[] to history
```

The history model is:

```ts
{
  past: Override[][],
  present: Override[],
  future: Override[][]
}
```

`UNDO` restores the previous accepted Override snapshot.

`REDO` restores the next snapshot after an Undo.

A new accepted edit after Undo clears the redo branch.

The following do **not** create history entries:

- selecting an element;
- panning;
- pinch/wheel zooming;
- opening/closing the mobile inspector;
- layer visibility toggles;
- rejected compiler edits.

This keeps Undo semantically meaningful instead of behaving like generic UI history.

## 5. Browser-local `SAVE DRAFT`

The toolbar now exposes an explicit `SAVE DRAFT` action.

This persists the current `Override[]` in browser `localStorage` under a versioned, Level-specific Workbench key.

A stored record contains:

```ts
{
  version: 1,
  levelId: "ts01-transfer-hall",
  savedAt: "...ISO timestamp...",
  overrides: [...]
}
```

When the same Level Workbench is opened again on the same browser/device, a valid saved draft is loaded as the initial Workbench state.

Before loading, the draft is validated against the current LevelSpec Override contract. Invalid/stale/corrupt JSON is ignored instead of poisoning Workbench startup.

The toolbar indicates the distinction between:

```text
BASE       no browser draft and no unsaved semantic changes
SAVED      current Override[] equals saved browser draft
UNSAVED    current Override[] differs from the last saved/base state
```

`CLEAR SAVED DRAFT` removes the persisted browser copy. It does not modify the current in-memory Workbench state.

## 6. Browser draft is NOT canonical project persistence

This distinction is binding:

```text
SAVE DRAFT
= continue this Workbench state later on this browser/device

COPY JSON
= portable semantic Override representation

LevelSpec / repository commit
= canonical project authoring state
```

The game client must not receive GitHub credentials or silently write repository files from the Workbench.

A later reviewed authoring workflow may add an explicit Apply/Commit operation through an authenticated development tool or agent. Until then, browser draft persistence is convenience state only.

`localStorage` must never become a gameplay message bus or canonical level database.

## 7. Mobile-readable constraint explanation

v0.12.2 preflights direct move/resize operations through the complete compiler and disables actions that cannot currently succeed.

Desktop `title` tooltips were insufficient because disabled-button hover text is effectively unavailable on touch devices.

v0.12.3 therefore adds a `WHY BLOCKED?` disclosure in the inspector.

For each currently blocked direct edit it shows:

```text
action → human-readable compiler reason
```

Common explanation families include:

- root coordinate anchor;
- required Connection/shared-boundary break;
- Space overlap;
- required spatial relation;
- Door/use clearance;
- navigation/reachability;
- required Prop placement dependency;
- Actor Route invalidation;
- wall/attachment placement contract.

The full compiler remains authority. The human-readable explanation is a presentation layer over the actual failed preflight, not an independent hand-maintained rule engine.

## 8. Why direct editing can still be sparse

The Workbench is a **constraint editor**, not unrestricted coordinate painting.

A room or Prop can legitimately have few or zero valid one-tile moves because its current solution jointly satisfies:

- direct Space Connections;
- Door aperture width;
- required spatial relations;
- Door Clearance;
- primary circulation/reachability;
- Prop footprint/use-space/hero clearance;
- wall attachment and authored rotations;
- neighboring required Props;
- Actor homes and Routes;
- Trigger source geometry.

The appropriate response depends on design intent:

```text
"I want this exact reviewed object one tile right"
→ use a direct Override if that state validates.

"I want this object generally on another wall"
→ change preferredWall rather than forcing coordinates.

"The whole family of generated rooms is too rigid"
→ improve solver/archetype/global rules instead of defeating constraints with Overrides.
```

The final Agent Authoring Guide must make this choice explicit for Game Designer and Artist agents.

## 9. Regression requirements

v0.12.3 adds permanent tests for:

- accepted semantic snapshot Undo/Redo;
- redo invalidation after a new branch of edits;
- browser draft save/load/clear with injected storage;
- level-specific draft identity;
- Encounter robot type substitution;
- preservation of Encounter behavior and Patrol Route after robot substitution.

Existing v0.12.x regression coverage remains binding:

- every TS-01 Space can round-trip its current geometry as a lock;
- every singleton TS-01 Prop can round-trip its current placement as a lock;
- representative valid direct edits compile;
- impossible edits reject;
- mobile tap/pan/pinch arbitration remains deterministic.

## 10. Current Workbench scope after v0.12.3

Selectable/editable categories:

### Spaces

- geometry lock/unlock;
- valid one-tile moves;
- valid one-tile resize operations;
- local regeneration;
- reset Override;
- blocked-action explanations.

### Props

- singleton placement lock/unlock;
- valid one-tile moves;
- preferred wall;
- local regeneration;
- reset Override;
- blocked-action explanations.

### Encounter Actors

- select visible Actor;
- replace robot type (`sentry` / `magnetar` / `kronos`);
- reset robot Override.

### Workbench session

- Undo;
- Redo;
- explicit browser-local Save Draft;
- automatic validated draft reload;
- clear saved draft;
- export/copy Override JSON;
- mobile tap/pan/pinch + bottom-sheet inspector.

Future expansion should extend these semantic mechanisms rather than adding hidden component-local authoring state.
