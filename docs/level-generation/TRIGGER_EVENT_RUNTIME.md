# Numberdroid — Trigger / Event Runtime

Status: **v0.8 runtime contract**

v0.8 closes the first complete path from declarative LevelSpec intent into persistent gameplay state.

```text
LevelSpec Trigger/Event
→ v0.5 resolved trigger graph
→ v0.6 emitted/interchange representation
→ typed Floor script contract
→ persistent MetaState v4 scriptState
→ MetaGame trigger edge evaluation
→ ordered runtime Events
```

The runtime does not hard-code TS-01 event behavior into React. Generated Floors carry a typed `FloorScriptDefinition`; the current playable compiler adapter derives it from the same `EventCompilationPlan` that produced the emitted Tiled representation.

## Persistent run state

`MetaState` is now schema version 4. It owns a `scriptState` containing:

- `firedTriggerIds` — once-only trigger persistence;
- `flags` — typed boolean/number/string world flags;
- `doorStates` — explicit runtime `locked` / `unlocked` overrides;
- `stagedActors` — persistent scripted actor presence/route intent;
- `storyBeatQueue`;
- `activeStoryBeatId`.

Old v3 global/profile saves are migrated to v4 with an empty/default script state for the current Floor. Existing run position, resources, body, encounters, pickups and actions remain intact.

## Immediate trigger edges

v0.8 executes these immediate trigger kinds:

- `enter-space`;
- `enter-zone`;
- `proximity` using the already compiled source cells;
- `collect` on the collection edge of a specific Pickup;
- `interact` when MetaGame explicitly identifies the interacted semantic source;
- `state-change`, including bounded same-beat cascades caused by preceding events.

Once-only triggers persist their ID before future updates can re-enter the same source.

Trigger evaluation is deliberately **not** performed as another full per-frame system. Movement continues in RAF; script edges are evaluated against the throttled run-state stream and explicit interaction commits. This protects the performance behavior established in v0.7.1.

## Runtime Events

The runtime currently applies, in authored event order:

- `set-flag`;
- `grant-key`;
- `unlock-door`;
- `lock-door`;
- `spawn-actor` state;
- `despawn-actor` state;
- `move-actor` route intent;
- `actor-passby` route intent;
- `story-beat`.

Door state is an explicit override, not a fake key mutation. Runtime access priority is:

```text
scripted unlocked → accessible
scripted locked   → denied
otherwise         → normal Door mode / access-key rules
```

This allows future story logic to lock an otherwise automatic/keyed door or unlock a door without changing authored geometry.

## Story Beats

A blocking Story Beat:

1. becomes `activeStoryBeatId`;
2. pauses Player movement;
3. pauses Hostile/Patrol simulation through the existing `pausedRef` path;
4. displays the runtime Story Beat overlay;
5. waits for explicit `WEITER`;
6. resumes normal runtime after dismissal.

The current TS-01 beat only carries the stable ID `ts01.transfer-first-view`; no final narrative copy is authored for that ID yet. The preview therefore displays the ID and explicitly says that final Story text is not present instead of inventing content.

## TS-01 proof

The generated playable TS-01 now demonstrates two real compiler-driven programs.

### Access chain

```text
collect primus-access-card
→ collect-primus-access fires once
→ grant-primus-access
→ unlock-primus-door
→ access key + explicit door override persist in MetaState v4
```

The existing Pickup behavior also grants its matching key, so the compiler grant is intentionally idempotent. The important v0.8 proof is that ordered compiler Events execute and persist independently of that legacy convenience path.

### Transfer Story Beat

```text
player enters transfer-intro-zone
→ enter-transfer-intro fires once
→ play-transfer-intro
→ blocking ts01.transfer-first-view
→ Player + Actors pause
→ WEITER resumes
```

## Deliberate timing boundary

v0.8.0 does **not** silently approximate authored timing.

Triggers with `delayMs > 0` remain present in the runtime contract but are not fired until an explicit scheduler exists. Timer triggers likewise require that scheduler. This is preferable to executing delayed authored intent immediately and producing hard-to-debug story timing.

The next timing sub-block should add persistent scheduled trigger deadlines so save/reload cannot accidentally reset or duplicate delayed events.

## Staged actor boundary

Spawn/despawn/move/pass-by Events already update typed persistent actor state. Dedicated rendering and route-progress simulation for non-encounter actors (for example Bio-Ark fauna) is still separate. That renderer must consume `scriptState.stagedActors` and compiled `FloorScriptRouteDefinition` rather than create component-local state.

## Performance rule

Trigger/event execution must stay outside the high-frequency Player/Actor hot paths unless a specific spatial index makes a query constant/local. New trigger kinds must be profiled in the final Performance & Scale Pass before campaign-scale production.
