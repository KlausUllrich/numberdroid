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
  timerSourceId?: string;
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

function triggerEligible(
  floor: FloorDefinition,
  trigger: FloorScriptTriggerDefinition,
  previous: MetaState,
  current: MetaState,
  context: ScriptAdvanceContext,
) {
  if (trigger.once && current.scriptState.firedTriggerIds.includes(trigger.id)) return false;
  // v0.8.0 intentionally executes the immediate event path first. Delayed/timer
  // scheduling remains explicit future work rather than silently ignoring timing.
  if (trigger.delayMs > 0) return false;

  if (trigger.kind === "enter-space" || trigger.kind === "enter-zone" || trigger.kind === "proximity") {
    return enteredCells(floor, trigger, previous, current);
  }
  if (trigger.kind === "collect") {
    return current.collectedPickupIds.includes(trigger.sourceId)
      && !previous.collectedPickupIds.includes(trigger.sourceId);
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

function applyEvent(current: MetaState, event: FloorScriptEventDefinition) {
  const scriptState = current.scriptState;
  if (event.kind === "set-flag") {
    if (scriptState.flags[event.flag] === event.value) return false;
    scriptState.flags[event.flag] = event.value;
    return true;
  }
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
    };
    return !before.present || before.spaceId !== event.spaceId || before.mode !== "idle";
  }
  if (event.kind === "despawn-actor") {
    const before = stagedActor(current, event.actorId);
    scriptState.stagedActors[event.actorId] = { ...before, present: false, mode: "idle", routeId: undefined, durationMs: undefined };
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
    };
    return !before.present || before.mode !== mode || before.routeId !== event.routeId;
  }

  const alreadyActive = scriptState.activeStoryBeatId === event.beatId;
  const alreadyQueued = scriptState.storyBeatQueue.includes(event.beatId);
  if (alreadyActive || alreadyQueued) return false;
  if (event.blocking && !scriptState.activeStoryBeatId) scriptState.activeStoryBeatId = event.beatId;
  else scriptState.storyBeatQueue.push(event.beatId);
  return true;
}

/**
 * Runs immediate trigger edges and their ordered events against explicit run
 * state. It is pure with respect to the input objects: the returned MetaState is
 * a cloned state suitable for React/save ownership.
 */
export function advanceFloorScript(
  floor: FloorDefinition,
  previous: MetaState,
  candidate: MetaState,
  context: ScriptAdvanceContext = {},
): ScriptAdvanceResult {
  const script = floor.script;
  if (!script || !script.triggers.length) return { state: candidate, firedTriggerIds: [], changed: false };

  const current: MetaState = {
    ...candidate,
    accessKeyIds: [...candidate.accessKeyIds],
    scriptState: cloneScriptState(candidate.scriptState),
  };
  const eventById = new Map(script.events.map((event) => [event.id, event]));
  const firedThisAdvance = new Set<string>();
  const firedTriggerIds: string[] = [];
  let changed = false;

  // State-change events may unlock another trigger in the same authored beat.
  // Bound the cascade so malformed non-once cycles cannot hang the runtime.
  for (let pass = 0; pass < Math.max(1, script.triggers.length + 2); pass += 1) {
    let firedInPass = false;
    for (const trigger of script.triggers) {
      if (firedThisAdvance.has(trigger.id)) continue;
      if (!triggerEligible(floor, trigger, previous, current, context)) continue;
      firedThisAdvance.add(trigger.id);
      firedTriggerIds.push(trigger.id);
      firedInPass = true;
      if (trigger.once && !current.scriptState.firedTriggerIds.includes(trigger.id)) {
        current.scriptState.firedTriggerIds.push(trigger.id);
        changed = true;
      }
      for (const eventId of trigger.eventIds) {
        const event = eventById.get(eventId);
        if (!event) continue;
        if (applyEvent(current, event)) changed = true;
      }
    }
    if (!firedInPass) break;
  }

  return { state: changed ? current : candidate, firedTriggerIds, changed };
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

export function storyBeatIsBlocking(floor: FloorDefinition, beatId: string | null) {
  if (!beatId) return false;
  return floor.script?.events.some((event) => event.kind === "story-beat" && event.beatId === beatId && event.blocking) ?? false;
}
