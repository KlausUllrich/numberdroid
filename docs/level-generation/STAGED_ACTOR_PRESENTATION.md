# Numberdroid — Scripted / Staged Actor Presentation

Status: **v0.9 runtime/presentation contract**

This block turns the persistent Staged Actor state introduced by v0.8 into visible runtime actors without turning them into Encounter robots or storing per-frame coordinates in the save.

```text
LevelSpec StagedActor + Route
→ Trigger / Event
→ persistent ScriptedActorRunState
→ FloorScriptRouteDefinition
→ derived runtime pose
→ StagedActorLayer
```

## 1. Separation from Encounter Actors

Staged Actors are for non-combat scripted world actors such as:

- Bio-Ark fauna;
- maintenance vehicles;
- crowd/background actors;
- large ambient machinery;
- scripted pass-by objects.

They do not require fake Enemy/Math metadata and do not enter `HostileLayer`.

## 2. Persistent state, derived pose

`MetaState.scriptState.stagedActors` stores semantic motion state only:

- `present`;
- `spaceId`;
- `mode: idle | route | passby`;
- `routeId`;
- optional `durationMs`;
- absolute `startedAtMs`;
- optional `pausedAtMs`.

World-space `x/y` are **not** persisted every frame. `stagedActorPose()` derives the current position and facing from the compiled route and persisted timing.

This keeps saves small and avoids React/RAF writes into persistent state.

## 3. Runtime modes

### `idle`

The Actor is shown at the center of its semantic Space. This is the presentation of `spawn-actor` unless another movement Event follows.

### `route`

The Actor traverses the compiled route using its presentation-catalog speed. Loop routes wrap; non-loop routes clamp at the end and remain visible there.

### `passby`

The Actor traverses the route once. An authored `durationMs` controls the complete traversal when present; otherwise the presentation speed is used. On completion the runtime persists the Actor back to `present: false` instead of merely hiding a DOM node.

## 4. Pause contract

Blocking Story Beats and other explicit MetaGame pauses must freeze Staged Actors too.

The runtime does this without per-frame counters:

1. on pause, `pausedAtMs` is persisted;
2. pose derivation uses the paused timestamp;
3. on resume, `startedAtMs` is shifted by the pause duration;
4. `pausedAtMs` is cleared.

Actor motion therefore resumes from the same visual point.

## 5. Presentation catalog

`src/game/stagedActorCatalog.ts` maps semantic `actorType` values to current presentation metadata:

- readable label;
- presentation kind (`creature`, `vehicle`, `generic`);
- width / height;
- route speed.

Unknown actor types receive a generic blockout rather than crashing the Floor. Production art can later replace these blockouts through the same registry without changing LevelSpec Trigger/Event authoring.

Current proof type:

```text
bioark-grazer
```

The current creature is intentionally a CSS/runtime blockout, not final Bio-Ark art.

## 6. Bio-Ark proof Floor

A separate compiler-generated proof Floor keeps this capability out of TS-01:

```text
?floor=bioark-passby
```

The authored chain is:

```text
PICO enters grazer-view-zone
→ enter-grazer-view fires once
→ run-grazer-passby
→ bioark-grazer-01 becomes present
→ traverses generated grazer-pass-route
→ pass-by completes
→ Actor state persists as absent
```

The Floor itself is generated from `src/levelgen/specs/bioArkPassbyProof.ts`; route geometry is not hard-coded into React.

## 7. Performance rule

`StagedActorLayer` starts a RAF only when at least one visible Actor is moving. Idle Actors do not require a motion loop. Route coordinates remain derived DOM transforms; persistent state changes only on semantic events such as start, pause/resume or pass-by completion.

This system must be included in the final Performance & Scale Pass, especially with multiple simultaneous fauna/ambient actors on a large Bio-Ark Floor.
