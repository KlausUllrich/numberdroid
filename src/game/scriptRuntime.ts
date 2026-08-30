import type {
  FloorDefinition,
  FloorScriptEventDefinition,
  FloorScriptTriggerDefinition,
  LevelScriptRunState,
  MetaState,
  ScriptedActorRunState,
} from "./types";

export type ScriptAdvanceContext = {
  interactionSourceId?: string;
  /** Optional explicit timer edge retained for tests/debug tooling. Normal gameplay uses persisted deadlines. */
  timerSourceId?: string;
  /** Injectable wall-clock source keeps scheduler behavior deterministic in tests. */
  nowMs?: number;
};

export type ScriptAdvanceResult = {
  state: MetaState;
  firedTriggerIds: string[];
  changed: boolean;
};

function cloneScriptState(source: LevelScriptRunState): LevelScriptRunState {
  return {
    firedTriggerIds: [...source.firedTriggerIds],
    flags: { ...source.flags },
    doorStates: { ...source.doorStates },
    stagedActors: Object.fromEntries(
      Object.entries(source.stagedActors).map(([id, actor]) => [id, { ...actor }]),
    ),
    scheduledTriggers: Object.fromEntries(
      Object.entries(source.scheduledTriggers).map(([id, schedule]) => [id, { ...schedule }]),
    ),
    storyBeatQueue: [...source.storyBeatQueue],
    activeStoryBeatId: source.activeStoryBeatId,
  };
}

function tileCell(floor: FloorDefinition, state: Pick<MetaState, "x" | "y">) {
  const tileSize = floor.script?.tileSize ?? 64;
  return { x: Math.floor(state.x / tileSize), y: Math.floor(state.y / tileSize) };
}

function containsCell(trigger: FloorScriptTriggerDefinition, cell: { x: number; y: number }) {
  return trigger.sourceCells.some((candidate) => candidate.x === cell.x && candidate.y === cell.y);
}

function enteredCells(
  floor: FloorDefinition,
  trigger: FloorScriptTriggerDefinition,
  previous: MetaState,
  current: MetaState,
) {
  const before = tileCell(floor, previous);
  const after = tileCell(floor, current);
  return containsCell(trigger, after) && !containsCell(trigger, before);
}

function triggerEdgeEligible(
  floor: FloorDefinition,
  trigger: FloorScriptTriggerDefinition,
  previous: MetaState,
  current: MetaState,
  context: ScriptAdvanceContext,
) {
  if (trigger.kind === "enter-space" || trigger.kind === "enter-zone" || trigger.kind === "proximity") {
    return enteredCells(floor, trigger, previous, current);
  }
  if (trigger.kind === "collect") {
    return current.collectedPickupIds.includes(trigger.sourceId)
      && !previous.collectedPickupIds.includes(trigger.sourceId);
  }
  if (trigger.kind === "actor-defeated") {
    return current.defeatedEncounterIds.includes(trigger.sourceId)
      && !previous.defeatedEncounterIds.includes(trigger.sourceId);
  }
  if (trigger.kind === "interact") return context.interactionSourceId === trigger.sourceId;
  if (trigger.kind === "state-change") {
    return previous.scriptState.flags[trigger.sourceId] !== current.scriptState.flags[trigger.sourceId];
  }
  return context.timerSourceId === trigger.sourceId;
}

function stagedActor(current: MetaState, actorId: string): ScriptedActorRunState {
  return current.scriptState.stagedActors[actorId] ?? { present: false, mode: "idle" };
}

function applyEvent(
  current: MetaState,
  event: FloorScriptEventDefinition,
  nowMs: number,
  changedStateSourceIds: Set<string>,
) {
  const scriptState = current.scriptState;
  if (event.kind === "set-flag") {
    if (scriptState.flags[event.flag] === event.value) return false;
    scriptState.flags[event.flag] = event.value;
    changedStateSourceIds.add(event.flag);
    return true;
  }
  if (event.kind === "set-variable") {
    if (scriptState.flags[event.variableId] === event.value) return false;
    scriptState.flags[event.variableId] = event.value;
    changedStateSourceIds.add(event.variableId);
    return true;
  }
  // The once-only producer Trigger persisted in firedTriggerIds is the sole
  // drop state. Pickup visibility/interactions derive from that trusted graph.
  if (event.kind === "drop-item") return false;
  if (event.kind === "grant-key") {
    if (current.accessKeyIds.includes(event.keyId)) return false;
    current.accessKeyIds = [...current.accessKeyIds, event.keyId];
    return true;
  }
  if (event.kind === "unlock-door" || event.kind === "lock-door") {
    const next = event.kind === "unlock-door" ? "unlocked" : "locked";
    if (scriptState.doorStates[event.doorId] === next) return false;
    scriptState.doorStates[event.doorId] = next;
    return true;
  }
  if (event.kind === "spawn-actor") {
    const before = stagedActor(current, event.actorId);
    scriptState.stagedActors[event.actorId] = {
      ...before,
      present: true,
      spaceId: event.spaceId,
      mode: "idle",
      routeId: undefined,
      durationMs: undefined,
      startedAtMs: undefined,
      pausedAtMs: undefined,
    };
    return !before.present || before.spaceId !== event.spaceId || before.mode !== "idle";
  }
  if (event.kind === "despawn-actor") {
    const before = stagedActor(current, event.actorId);
    scriptState.stagedActors[event.actorId] = {
      ...before,
      present: false,
      mode: "idle",
      routeId: undefined,
      durationMs: undefined,
      startedAtMs: undefined,
      pausedAtMs: undefined,
    };
    return before.present || before.mode !== "idle";
  }
  if (event.kind === "move-actor" || event.kind === "actor-passby") {
    const before = stagedActor(current, event.actorId);
    const mode = event.kind === "actor-passby" ? "passby" : "route";
    scriptState.stagedActors[event.actorId] = {
      ...before,
      present: true,
      mode,
      routeId: event.routeId,
      durationMs: event.kind === "actor-passby" ? event.durationMs : undefined,
      startedAtMs: nowMs,
      pausedAtMs: undefined,
    };
    // Re-firing a non-once scripted movement intentionally restarts that route.
    return true;
  }

  const beatId = event.kind === "show-text" ? event.textRefId : event.beatId;
  const blocking = event.kind === "show-text" ? true : event.blocking;
  const alreadyActive = scriptState.activeStoryBeatId === beatId;
  const alreadyQueued = scriptState.storyBeatQueue.includes(beatId);
  if (alreadyActive || alreadyQueued) return false;
  if (blocking && !scriptState.activeStoryBeatId) scriptState.activeStoryBeatId = beatId;
  else scriptState.storyBeatQueue.push(beatId);
  return true;
}

function triggerAlreadyFired(current: MetaState, trigger: FloorScriptTriggerDefinition) {
  return trigger.once && current.scriptState.firedTriggerIds.includes(trigger.id);
}

function scheduleTrigger(current: MetaState, trigger: FloorScriptTriggerDefinition, nowMs: number) {
  if (trigger.delayMs <= 0 || current.scriptState.scheduledTriggers[trigger.id]) return false;
  current.scriptState.scheduledTriggers[trigger.id] = {
    scheduledAtMs: nowMs,
    dueAtMs: nowMs + trigger.delayMs,
  };
  return true;
}

function removeSchedule(current: MetaState, triggerId: string) {
  if (!current.scriptState.scheduledTriggers[triggerId]) return false;
  delete current.scriptState.scheduledTriggers[triggerId];
  return true;
}

/** Earliest absolute scheduler deadline, or null when the Floor has no pending timed work. */
export function nextScheduledScriptDeadline(state: MetaState): number | null {
  let next = Infinity;
  for (const schedule of Object.values(state.scriptState.scheduledTriggers)) {
    if (Number.isFinite(schedule.dueAtMs)) next = Math.min(next, schedule.dueAtMs);
  }
  return Number.isFinite(next) ? next : null;
}

/**
 * Runs trigger edges and their ordered events against explicit run state.
 *
 * v0.8.1 timing contract:
 * - an edge with delayMs > 0 creates one persisted absolute deadline;
 * - a timer Trigger schedules itself from the first runtime advance;
 * - overdue deadlines fire on the next scheduler advance after reload/resume;
 * - non-once timer Triggers schedule their next interval only after firing;
 * - no timed work runs from the per-frame movement RAF.
 */
export function advanceFloorScript(
  floor: FloorDefinition,
  previous: MetaState,
  candidate: MetaState,
  context: ScriptAdvanceContext = {},
): ScriptAdvanceResult {
  const script = floor.script;
  if (!script || !script.triggers.length) return { state: candidate, firedTriggerIds: [], changed: false };

  const nowMs = context.nowMs ?? Date.now();
  const current: MetaState = {
    ...candidate,
    accessKeyIds: [...candidate.accessKeyIds],
    scriptState: cloneScriptState(candidate.scriptState),
  };
  const eventById = new Map(script.events.map((event) => [event.id, event]));
  const triggerById = new Map(script.triggers.map((trigger) => [trigger.id, trigger]));
  const firedThisAdvance = new Set<string>();
  const firedTriggerIds: string[] = [];
  let changed = false;

  const fireTrigger = (trigger: FloorScriptTriggerDefinition) => {
    const changedStateSourceIds = new Set<string>();
    if (firedThisAdvance.has(trigger.id) || triggerAlreadyFired(current, trigger)) {
      return { changed: false, changedStateSourceIds };
    }
    firedThisAdvance.add(trigger.id);
    firedTriggerIds.push(trigger.id);
    let localChanged = removeSchedule(current, trigger.id);
    if (trigger.once && !current.scriptState.firedTriggerIds.includes(trigger.id)) {
      current.scriptState.firedTriggerIds.push(trigger.id);
      localChanged = true;
    }
    for (const eventId of trigger.eventIds) {
      const event = eventById.get(eventId);
      if (event && applyEvent(current, event, nowMs, changedStateSourceIds)) localChanged = true;
    }
    if (trigger.kind === "timer" && !trigger.once && trigger.delayMs > 0) {
      current.scriptState.scheduledTriggers[trigger.id] = {
        scheduledAtMs: nowMs,
        dueAtMs: nowMs + trigger.delayMs,
      };
      localChanged = true;
    }
    return { changed: localChanged, changedStateSourceIds };
  };

  // Timers own their own persisted recurrence. Invalid zero-delay timers are
  // ignored defensively; compiler validation rejects them at authoring time.
  for (const trigger of script.triggers) {
    if (trigger.kind !== "timer" || triggerAlreadyFired(current, trigger) || trigger.delayMs <= 0) continue;
    if (context.timerSourceId === trigger.sourceId) {
      if (fireTrigger(trigger).changed) changed = true;
      continue;
    }
    if (scheduleTrigger(current, trigger, nowMs)) changed = true;
  }

  // Fire persisted deadlines that are due. A deadline remains absolute across
  // save/reload and browser suspension, so overdue work executes once on resume.
  const dueTriggerIds = Object.entries(current.scriptState.scheduledTriggers)
    .filter(([, schedule]) => schedule.dueAtMs <= nowMs)
    .sort((a, b) => a[1].dueAtMs - b[1].dueAtMs || a[0].localeCompare(b[0]))
    .map(([id]) => id);
  for (const triggerId of dueTriggerIds) {
    const trigger = triggerById.get(triggerId);
    if (!trigger || triggerAlreadyFired(current, trigger)) {
      if (removeSchedule(current, triggerId)) changed = true;
      continue;
    }
    if (fireTrigger(trigger).changed) changed = true;
  }

  // Evaluate each ordinary edge once, then requeue only state-change Triggers
  // whose exact source was mutated by an event. This keeps same-beat chains
  // deterministic without repeatedly scanning the complete Trigger graph.
  const queue = script.triggers.filter((trigger) => trigger.kind !== "timer");
  const queuedIds = new Set(queue.map((trigger) => trigger.id));
  const stateTriggersBySource = new Map<string, FloorScriptTriggerDefinition[]>();
  for (const trigger of queue) {
    if (trigger.kind !== "state-change") continue;
    const existing = stateTriggersBySource.get(trigger.sourceId) ?? [];
    existing.push(trigger);
    stateTriggersBySource.set(trigger.sourceId, existing);
  }
  const enqueueStateTriggers = (sourceIds: Set<string>) => {
    for (const sourceId of sourceIds) {
      for (const trigger of stateTriggersBySource.get(sourceId) ?? []) {
        if (queuedIds.has(trigger.id) || firedThisAdvance.has(trigger.id) || triggerAlreadyFired(current, trigger)) continue;
        queue.push(trigger);
        queuedIds.add(trigger.id);
      }
    }
  };

  while (queue.length) {
    const trigger = queue.shift()!;
    queuedIds.delete(trigger.id);
    if (firedThisAdvance.has(trigger.id) || triggerAlreadyFired(current, trigger)) continue;
    if (!triggerEdgeEligible(floor, trigger, previous, current, context)) continue;

    if (trigger.delayMs > 0) {
      if (scheduleTrigger(current, trigger, nowMs)) changed = true;
      continue;
    }

    const fired = fireTrigger(trigger);
    if (fired.changed) changed = true;
    enqueueStateTriggers(fired.changedStateSourceIds);
  }

  return { state: changed ? current : candidate, firedTriggerIds, changed };
}

/**
 * Freezes/resumes staged Actor route clocks without per-frame persistence.
 * Blocking Story Beats and other explicit runtime pauses therefore stop scripted
 * Actors while their pose can still be derived from a persisted route start.
 */
export function setStagedActorsPaused(state: MetaState, paused: boolean, nowMs = Date.now()): MetaState {
  let changed = false;
  const stagedActors = Object.fromEntries(Object.entries(state.scriptState.stagedActors).map(([id, actor]) => {
    if (!actor.present || actor.mode === "idle" || !Number.isFinite(actor.startedAtMs)) return [id, actor];
    if (paused) {
      if (Number.isFinite(actor.pausedAtMs)) return [id, actor];
      changed = true;
      return [id, { ...actor, pausedAtMs: nowMs }];
    }
    if (!Number.isFinite(actor.pausedAtMs)) return [id, actor];
    const pausedFor = Math.max(0, nowMs - Number(actor.pausedAtMs));
    changed = true;
    return [id, {
      ...actor,
      startedAtMs: Number(actor.startedAtMs) + pausedFor,
      pausedAtMs: undefined,
    }];
  }));
  if (!changed) return state;
  return { ...state, scriptState: { ...state.scriptState, stagedActors } };
}

/** Persist the semantic end of a one-shot pass-by instead of hiding it only in React. */
export function completeStagedActorPassby(state: MetaState, actorId: string): MetaState {
  const before = state.scriptState.stagedActors[actorId];
  if (!before || !before.present || before.mode !== "passby") return state;
  return {
    ...state,
    scriptState: {
      ...state.scriptState,
      stagedActors: {
        ...state.scriptState.stagedActors,
        [actorId]: {
          ...before,
          present: false,
          mode: "idle",
          routeId: undefined,
          durationMs: undefined,
          startedAtMs: undefined,
          pausedAtMs: undefined,
        },
      },
    },
  };
}

export function dismissActiveStoryBeat(state: MetaState): MetaState {
  const active = state.scriptState.activeStoryBeatId;
  if (!active) return state;
  const [next, ...rest] = state.scriptState.storyBeatQueue;
  return {
    ...state,
    scriptState: {
      ...state.scriptState,
      storyBeatQueue: rest,
      activeStoryBeatId: next ?? null,
    },
  };
}

/** Fail-closed availability shared by rendering, interaction and save repair. */
export function floorPickupIsAvailable(floor: FloorDefinition, state: MetaState, pickupId: string) {
  const pickup = floor.pickups.find((entry) => entry.id === pickupId);
  if (!pickup) return false;
  if (pickup.initiallyPresent !== false) return true;
  const script = floor.script;
  if (!script) return false;
  const dropEvents = script.events.filter((event): event is Extract<FloorScriptEventDefinition, { kind: "drop-item" }> =>
    event.kind === "drop-item" && event.pickupId === pickupId);
  if (dropEvents.length !== 1) return false;
  const [dropEvent] = dropEvents;
  const producers = script.triggers.filter((trigger) => trigger.eventIds.includes(dropEvent.id));
  if (producers.length !== 1) return false;
  const [producer] = producers;
  return producer.kind === "actor-defeated"
    && producer.sourceKind === "actor"
    && producer.sourceId === dropEvent.actorId
    && producer.once
    && producer.delayMs === 0
    && state.scriptState.firedTriggerIds.includes(producer.id);
}

/** Resolve authored visible text while retaining legacy Story Beat IDs. */
export function storyBeatDisplayText(floor: FloorDefinition, beatId: string) {
  return floor.script?.textReferences?.find((reference) => reference.id === beatId)?.text ?? beatId;
}

export function storyBeatIsBlocking(floor: FloorDefinition, beatId: string | null) {
  if (!beatId) return false;
  return floor.script?.events.some((event) => (event.kind === "story-beat" && event.beatId === beatId && event.blocking)
    || (event.kind === "show-text" && event.textRefId === beatId)) ?? false;
}
