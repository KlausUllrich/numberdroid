# Numberdroid — Trigger / Event Runtime

Status: **v0.8.1 runtime + persistent scheduler contract**

v0.8 closes the first complete path from declarative LevelSpec intent into persistent gameplay state. v0.8.1 adds deterministic authored timing without moving script work into the gameplay RAF hot path.

```text
LevelSpec Trigger/Event
→ v0.5 resolved trigger graph
→ v0.6 emitted/interchange representation
→ typed Floor script contract
→ persistent MetaState v4 scriptState
→ MetaGame trigger edge evaluation
→ persistent scheduler deadlines
→ ordered runtime Events
```

The runtime does not hard-code TS-01 event behavior into React. Generated Floors carry a typed `FloorScriptDefinition`; the current playable compiler adapter derives it from the same `EventCompilationPlan` that produced the emitted Tiled representation.

## Persistent run state

`MetaState` schema version 4 owns a `scriptState` containing:

- `firedTriggerIds` — once-only trigger persistence;
- `flags` — typed boolean/number/string world flags;
- `doorStates` — explicit runtime `locked` / `unlocked` overrides;
- `stagedActors` — persistent scripted actor presence/route intent;
- `scheduledTriggers` — persisted absolute timing deadlines;
- `storyBeatQueue`;
- `activeStoryBeatId`.

Each scheduled Trigger stores:

```text
scheduledAtMs
absolute dueAtMs
```

Old v3 global/profile saves migrate to v4 with an empty/default script state for the current Floor. Existing run position, resources, body, encounters, pickups and actions remain intact. Existing v4 saves without scheduler data sanitize to an empty `scheduledTriggers` map.

## Immediate trigger edges

The runtime executes these trigger kinds:

- `enter-space`;
- `enter-zone`;
- `proximity` using the already compiled source cells;
- `collect` on the collection edge of a specific Pickup;
- `interact` when MetaGame explicitly identifies the interacted semantic source;
- `state-change`, including bounded same-beat cascades caused by preceding events;
- `timer` through the v0.8.1 scheduler.

Once-only triggers persist their ID when they actually fire.

Trigger edge evaluation is deliberately **not** performed as another full per-frame system. Movement continues in RAF; immediate script edges are evaluated against the throttled run-state stream and explicit interaction commits. Timed work uses a separate deadline-driven wakeup.

## v0.8.1 persistent scheduler

### Delayed trigger edge

For any non-timer Trigger with `delayMs > 0`:

```text
edge occurs
→ one absolute deadline is created
→ deadline persists in MetaState
→ no Event fires yet
→ scheduler wakes at/after dueAtMs
→ ordered Events execute
→ schedule entry is removed
→ once Trigger ID persists if applicable
```

Re-entering or repeating the same source while a deadline is already pending does not create duplicate schedules.

### Timer trigger

A `timer` Trigger must have `delayMs > 0` at the runtime compiler boundary.

One-shot timer:

```text
Floor runtime initializes
→ deadline = now + delayMs
→ due
→ Events fire once
→ Trigger ID persists
```

Recurring timer (`once: false`):

```text
first deadline
→ Events fire
→ next deadline = actual firing time + delayMs
```

The scheduler intentionally does **not** replay every missed interval after a suspended tab/device. If a 400 ms recurring timer is resumed two minutes late, it fires once and schedules the next interval from resume/firing time. This prevents catch-up bursts.

### Save / reload / mobile suspension

Deadlines use absolute wall-clock timestamps. Therefore:

- saving does not reset a delay;
- reload does not create a duplicate deadline;
- browser/mobile suspension may make a deadline overdue;
- the first scheduler advance after resume executes overdue work once;
- `visibilitychange` and window focus explicitly prompt an overdue check in addition to the scheduled timeout.

This behavior is intentional for authored story/event timing. It is not a simulation-time clock.

### Performance

The scheduler uses the earliest persisted deadline to arm **one timeout**. It does not poll every frame and does not add timer work to Player or Actor RAF loops.

`nextScheduledScriptDeadline()` exposes the earliest pending timestamp for runtime integration and future Workbench diagnostics.

## Runtime Events

The runtime applies, in authored event order:

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

The generated playable TS-01 demonstrates two real compiler-driven immediate programs.

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

v0.8.1 timing itself is covered by deterministic runtime regression tests using an injectable `nowMs` clock, including delayed edges, one-shot timers, recurring timers, JSON/save-like round trips and overdue resume behavior. A dedicated narrative timer is not added to TS-01 merely to prove infrastructure.

## Staged actor boundary

Spawn/despawn/move/pass-by Events already update typed persistent actor state. Dedicated rendering and route-progress simulation for non-encounter actors (for example Bio-Ark fauna) is still separate. That renderer must consume `scriptState.stagedActors` and compiled `FloorScriptRouteDefinition` rather than create component-local state.

This is the next compiler/runtime block after v0.8.1.

## Performance rule

Trigger/event execution must stay outside the high-frequency Player/Actor hot paths unless a specific spatial index makes a query constant/local. New trigger kinds and staged-actor simulation must be profiled in the final Performance & Scale Pass before campaign-scale production.
