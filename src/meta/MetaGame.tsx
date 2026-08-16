import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { publicAsset } from "../game/assets";
import { BODIES, MAX_META_ENERGY, PLAYER_NAMES, STARTING_HP, robotCollisionRadius, robotDriveProfile } from "../game/catalog";
import { getFloor } from "../game/floors";
import type { TacticalChallengeId } from "../game/playerProfile";
import { pointWalkable } from "../game/save";
import { advanceFloorScript, dismissActiveStoryBeat, nextScheduledScriptDeadline, storyBeatIsBlocking } from "../game/scriptRuntime";
import type { EncounterConfig, MetaState } from "../game/types";
import { directionClassForFacing } from "./robotDirection";
import { DoorLayer } from "./DoorLayer";
import { FloorVisual } from "./FloorVisual";
import { HostileLayer, type EncounterRuntimePose } from "./HostileLayer";
import { blockedByClosedDoor, nextAutomaticDoorIds, sameDoorSet } from "./doorRuntime";
import "./MetaGameMotion.css";
import "./ScriptRuntime.css";

type Nearby =
  | { type: "station"; id: string }
  | { type: "pickup"; id: string }
  | { type: "action"; id: string }
  | { type: "enemy"; id: string }
  | null;
type PlayerStyle = CSSProperties & { "--player-x": string; "--player-y": string; "--facing": string };

type Props = {
  meta: MetaState;
  onMetaChange: (next: MetaState) => void;
  onEncounter: (encounter: EncounterConfig) => void;
  tacticalChallengeId?: TacticalChallengeId;
  paused?: boolean;
};

const META_SYNC_INTERVAL_MS = 120;
const NORMAL_ZOOM = 1;
const LOCAL_OVERVIEW_ZOOM = 0.68;

function distance(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

function normalizeAngle(angle: number) {
  let next = angle;
  while (next > Math.PI) next -= Math.PI * 2;
  while (next < -Math.PI) next += Math.PI * 2;
  return next;
}

function turnToward(current: number, target: number, maxStep: number) {
  const delta = normalizeAngle(target - current);
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}

function actionUnlocked(meta: MetaState, actionId: string) {
  const floor = getFloor(meta.floorId);
  const action = floor.actions.find((entry) => entry.id === actionId);
  if (!action) return false;
  return !action.requiresEncounterId || meta.defeatedEncounterIds.includes(action.requiresEncounterId);
}

function nearestInteractable(meta: MetaState): Nearby {
  const floor = getFloor(meta.floorId);
  let best: Nearby = null;
  let bestDistance = Infinity;

  for (const station of floor.energyStations) {
    if (meta.usedStationIds.includes(station.id)) continue;
    const d = distance(meta.x, meta.y, station.x, station.y);
    if (d < 105 && d < bestDistance) {
      best = { type: "station", id: station.id };
      bestDistance = d;
    }
  }

  for (const pickup of floor.pickups) {
    if (meta.collectedPickupIds.includes(pickup.id)) continue;
    const d = distance(meta.x, meta.y, pickup.x, pickup.y);
    if (d < 100 && d < bestDistance) {
      best = { type: "pickup", id: pickup.id };
      bestDistance = d;
    }
  }

  for (const action of floor.actions) {
    if (meta.completedActionIds.includes(action.id) || !actionUnlocked(meta, action.id)) continue;
    const d = distance(meta.x, meta.y, action.x, action.y);
    if (d < 118 && d < bestDistance) {
      best = { type: "action", id: action.id };
      bestDistance = d;
    }
  }

  for (const encounter of floor.encounters) {
    if (encounter.behavior || meta.defeatedEncounterIds.includes(encounter.encounterId)) continue;
    const d = distance(meta.x, meta.y, encounter.x, encounter.y);
    if (d < 112 && d < bestDistance) {
      best = { type: "enemy", id: encounter.encounterId };
      bestDistance = d;
    }
  }

  return best;
}

export function MetaGame({ meta, onMetaChange, onEncounter, tacticalChallengeId = "standard", paused = false }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef(new Set<string>());
  const touchRef = useRef({ active: false, pointerId: -1, x: 0, y: 0 });
  const latestMetaRef = useRef(meta);
  const previousScriptMetaRef = useRef(meta);
  const lastFrameRef = useRef(performance.now());
  const lastMetaSyncRef = useRef(performance.now());
  const cameraRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(NORMAL_ZOOM);
  const pausedRef = useRef(paused);
  const wasMovingRef = useRef(false);
  const speedRef = useRef(0);
  const headingRef = useRef((meta.facing - 90) * Math.PI / 180);
  const openDoorIdsRef = useRef<Set<string>>(new Set());
  const encounterRuntimePosesRef = useRef<Map<string, EncounterRuntimePose>>(new Map());
  const [touchMarker, setTouchMarker] = useState<{ x: number; y: number } | null>(null);
  const [toast, setToast] = useState("");
  const [zoom, setZoom] = useState(NORMAL_ZOOM);
  const [openDoorIds, setOpenDoorIds] = useState<Set<string>>(() => new Set());
  const [nearbyNeutralId, setNearbyNeutralId] = useState<string | null>(null);

  const floor = getFloor(meta.floorId);
  const activeStoryBeatId = meta.scriptState.activeStoryBeatId;
  const blockingStoryBeat = storyBeatIsBlocking(floor, activeStoryBeatId);
  const runtimePaused = paused || blockingStoryBeat;
  const nearby = useMemo(() => nearestInteractable(meta), [meta]);
  const nearbyStation = nearby?.type === "station" ? floor.energyStations.find((station) => station.id === nearby.id) : null;
  const nearbyPickup = nearby?.type === "pickup" ? floor.pickups.find((pickup) => pickup.id === nearby.id) : null;
  const nearbyAction = nearby?.type === "action" ? floor.actions.find((action) => action.id === nearby.id) : null;
  const nearbyEncounter = nearby?.type === "enemy" ? floor.encounters.find((encounter) => encounter.encounterId === nearby.id) : null;
  const nearbyNeutralEncounter = nearbyNeutralId
    ? floor.encounters.find((encounter) => encounter.encounterId === nearbyNeutralId && encounter.behavior?.kind === "neutral") ?? null
    : null;

  function syncMeta(next: MetaState, force = false) {
    const now = performance.now();
    if (!force && now - lastMetaSyncRef.current < META_SYNC_INTERVAL_MS) return;
    lastMetaSyncRef.current = now;
    onMetaChange(next);
  }

  function applyPlayerPose(state: MetaState) {
    const player = playerRef.current;
    if (!player) return;
    player.style.setProperty("--player-x", `${state.x}px`);
    player.style.setProperty("--player-y", `${state.y}px`);
    player.style.setProperty("--facing", `${state.facing}deg`);
    for (let index = 0; index < 8; index += 1) player.classList.remove(`dir-${index}`);
    player.classList.add(directionClassForFacing(state.facing));
  }

  function applyCamera(state: MetaState, requestedZoom = zoomRef.current) {
    const viewport = viewportRef.current;
    const world = worldRef.current;
    if (!viewport || !world) return;

    const viewWorldWidth = viewport.clientWidth / requestedZoom;
    const viewWorldHeight = viewport.clientHeight / requestedZoom;
    let cameraX = state.x - viewWorldWidth / 2;
    let cameraY = state.y - viewWorldHeight / 2;

    if (viewWorldWidth >= floor.width) cameraX = -(viewWorldWidth - floor.width) / 2;
    else cameraX = Math.max(0, Math.min(floor.width - viewWorldWidth, cameraX));

    if (viewWorldHeight >= floor.height) cameraY = -(viewWorldHeight - floor.height) / 2;
    else cameraY = Math.max(0, Math.min(floor.height - viewWorldHeight, cameraY));

    cameraRef.current = { x: cameraX, y: cameraY };
    world.style.transform = `translate3d(${-cameraX * requestedZoom}px, ${-cameraY * requestedZoom}px, 0) scale(${requestedZoom})`;
  }

  function updateAutomaticDoors(state: MetaState) {
    const next = nextAutomaticDoorIds(floor, state, openDoorIdsRef.current);
    if (sameDoorSet(next, openDoorIdsRef.current)) return;
    openDoorIdsRef.current = next;
    setOpenDoorIds(next);
  }

  function runtimeEncounter(encounter: EncounterConfig) {
    const pose = encounterRuntimePosesRef.current.get(encounter.encounterId);
    return pose ? { ...encounter, x: pose.x, y: pose.y } : encounter;
  }

  function blockedByEncounterRobot(x: number, y: number, playerRadius: number) {
    for (const [encounterId, pose] of encounterRuntimePosesRef.current) {
      if (latestMetaRef.current.defeatedEncounterIds.includes(encounterId)) continue;
      if (distance(x, y, pose.x, pose.y) < playerRadius + pose.radius + 2) return true;
    }
    return false;
  }

  function applyInteractionScript(current: MetaState, candidate: MetaState, sourceId: string) {
    const advanced = advanceFloorScript(floor, current, candidate, { interactionSourceId: sourceId });
    const resolved = advanced.state;
    latestMetaRef.current = resolved;
    previousScriptMetaRef.current = resolved;
    updateAutomaticDoors(resolved);
    if (storyBeatIsBlocking(floor, resolved.scriptState.activeStoryBeatId)) {
      pausedRef.current = true;
      speedRef.current = 0;
      touchRef.current.active = false;
      setTouchMarker(null);
    }
    return resolved;
  }

  useEffect(() => {
    const previous = previousScriptMetaRef.current.floorId === meta.floorId
      ? previousScriptMetaRef.current
      : meta;
    const advanced = advanceFloorScript(floor, previous, meta);
    previousScriptMetaRef.current = advanced.state;
    if (!advanced.changed) return;
    latestMetaRef.current = advanced.state;
    updateAutomaticDoors(advanced.state);
    if (storyBeatIsBlocking(floor, advanced.state.scriptState.activeStoryBeatId)) {
      pausedRef.current = true;
      speedRef.current = 0;
      touchRef.current.active = false;
      setTouchMarker(null);
    }
    onMetaChange(advanced.state);
    // Script edge evaluation runs on the throttled React run-state stream, not RAF.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, floor.id, onMetaChange]);

  useEffect(() => {
    if (!floor.script?.triggers.length) return;
    let cancelled = false;
    let timeoutId: number | null = null;

    const commitSchedulerAdvance = () => {
      if (cancelled) return;
      const current = latestMetaRef.current;
      const advanced = advanceFloorScript(floor, current, current, { nowMs: Date.now() });
      if (!advanced.changed) return;
      latestMetaRef.current = advanced.state;
      previousScriptMetaRef.current = advanced.state;
      updateAutomaticDoors(advanced.state);
      if (storyBeatIsBlocking(floor, advanced.state.scriptState.activeStoryBeatId)) {
        pausedRef.current = true;
        speedRef.current = 0;
        touchRef.current.active = false;
        setTouchMarker(null);
      }
      onMetaChange(advanced.state);
    };

    // First pass initializes timer Trigger deadlines and immediately resolves any
    // deadline that became overdue while the app was suspended or reloaded.
    commitSchedulerAdvance();

    const deadline = nextScheduledScriptDeadline(latestMetaRef.current);
    if (deadline !== null) {
      const delay = Math.min(2_147_000_000, Math.max(0, deadline - Date.now()));
      timeoutId = window.setTimeout(commitSchedulerAdvance, delay + 4);
    }

    const onResume = () => {
      if (document.visibilityState === "visible") commitSchedulerAdvance();
    };
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("focus", commitSchedulerAdvance);
    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("focus", commitSchedulerAdvance);
    };
    // Scheduler state changes only when script timing changes; ordinary RAF pose
    // updates preserve the same scheduledTriggers object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floor.id, meta.scriptState.scheduledTriggers, onMetaChange]);

  useEffect(() => {
    latestMetaRef.current = meta;
    speedRef.current = 0;
    headingRef.current = (meta.facing - 90) * Math.PI / 180;
    applyPlayerPose(meta);
    applyCamera(meta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.floorId, meta.currentBody, meta.currentDeckSize]);

  useEffect(() => {
    zoomRef.current = zoom;
    applyCamera(latestMetaRef.current, zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  useEffect(() => {
    pausedRef.current = runtimePaused;
    if (runtimePaused) {
      touchRef.current.active = false;
      speedRef.current = 0;
      setTouchMarker(null);
      syncMeta(latestMetaRef.current, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtimePaused]);

  useEffect(() => {
    function onResize() { applyCamera(latestMetaRef.current); }
    openDoorIdsRef.current = new Set();
    encounterRuntimePosesRef.current.clear();
    setNearbyNeutralId(null);
    setOpenDoorIds(new Set());
    previousScriptMetaRef.current = latestMetaRef.current;
    applyPlayerPose(latestMetaRef.current);
    applyCamera(latestMetaRef.current);
    updateAutomaticDoors(latestMetaRef.current);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floor.id]);

  function rotatePilot(next: MetaState) {
    if (next.playerCount <= 1) return next;
    return { ...next, pilotIndex: (next.pilotIndex + 1) % next.playerCount };
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast((current) => current === message ? "" : current), 2200);
  }

  function dismissStoryBeat() {
    const next = dismissActiveStoryBeat(latestMetaRef.current);
    latestMetaRef.current = next;
    previousScriptMetaRef.current = next;
    pausedRef.current = paused || storyBeatIsBlocking(floor, next.scriptState.activeStoryBeatId);
    syncMeta(next, true);
  }

  function openNeutralEncounter(current: MetaState) {
    if (!nearbyNeutralEncounter) return false;
    const encounter = runtimeEncounter(nearbyNeutralEncounter);
    if (distance(current.x, current.y, encounter.x, encounter.y) >= 145) return false;
    const scripted = applyInteractionScript(current, current, encounter.encounterId);
    syncMeta(scripted, true);
    if (storyBeatIsBlocking(floor, scripted.scriptState.activeStoryBeatId)) return true;
    speedRef.current = 0;
    onEncounter(encounter);
    return true;
  }

  function interact() {
    if (runtimePaused) return;
    const current = latestMetaRef.current;

    if (!nearby) {
      openNeutralEncounter(current);
      return;
    }

    if (nearby.type === "station") {
      const station = floor.energyStations.find((entry) => entry.id === nearby.id);
      if (!station || current.usedStationIds.includes(station.id)) return;
      const candidate = rotatePilot({
        ...current,
        usedStationIds: [...current.usedStationIds, station.id],
        metaEnergy: Math.min(MAX_META_ENERGY, current.metaEnergy + station.energy),
      });
      const next = applyInteractionScript(current, candidate, station.id);
      syncMeta(next, true);
      showToast(`ENERGIEZELLE GELADEN · ⚡ ${next.metaEnergy}/${MAX_META_ENERGY}`);
      return;
    }

    if (nearby.type === "pickup") {
      const pickup = floor.pickups.find((entry) => entry.id === nearby.id);
      if (!pickup || current.collectedPickupIds.includes(pickup.id)) return;
      const candidate = {
        ...current,
        collectedPickupIds: [...current.collectedPickupIds, pickup.id],
        accessKeyIds: current.accessKeyIds.includes(pickup.keyId) ? current.accessKeyIds : [...current.accessKeyIds, pickup.keyId],
      };
      const next = applyInteractionScript(current, candidate, pickup.id);
      syncMeta(next, true);
      showToast(`${pickup.label} GESICHERT`);
      return;
    }

    if (nearby.type === "action") {
      const action = floor.actions.find((entry) => entry.id === nearby.id);
      if (!action || current.completedActionIds.includes(action.id) || !actionUnlocked(current, action.id)) return;
      const candidate = {
        ...current,
        completedActionIds: [...current.completedActionIds, action.id],
      };
      const next = applyInteractionScript(current, candidate, action.id);
      syncMeta(next, true);
      showToast(action.completionLabel);
      return;
    }

    const encounter = floor.encounters.find((entry) => entry.encounterId === nearby.id);
    if (encounter) {
      const scripted = applyInteractionScript(current, current, encounter.encounterId);
      syncMeta(scripted, true);
      if (storyBeatIsBlocking(floor, scripted.scriptState.activeStoryBeatId)) return;
      speedRef.current = 0;
      onEncounter(runtimeEncounter(encounter));
    }
  }

  function tryOpenEncounter(enemy: EncounterConfig) {
    const current = latestMetaRef.current;
    const runtimeEnemy = runtimeEncounter(enemy);
    if (distance(current.x, current.y, runtimeEnemy.x, runtimeEnemy.y) >= 145) {
      showToast(`FAHRE NÄHER AN ${runtimeEnemy.name}`);
      return;
    }
    const scripted = applyInteractionScript(current, current, runtimeEnemy.encounterId);
    syncMeta(scripted, true);
    if (storyBeatIsBlocking(floor, scripted.scriptState.activeStoryBeatId)) return;
    speedRef.current = 0;
    onEncounter(runtimeEnemy);
  }

  function interceptEncounter(enemy: EncounterConfig) {
    if (pausedRef.current) return;
    touchRef.current.active = false;
    speedRef.current = 0;
    wasMovingRef.current = false;
    setTouchMarker(null);
    syncMeta(latestMetaRef.current, true);
    onEncounter(enemy);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
        keysRef.current.add(event.code);
        event.preventDefault();
      }
    }
    function onKeyUp(event: KeyboardEvent) { keysRef.current.delete(event.code); }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    let frameId = 0;
    function frame(now: number) {
      const dt = Math.min(0.04, (now - lastFrameRef.current) / 1000);
      lastFrameRef.current = now;
      const current = latestMetaRef.current;
      if (pausedRef.current) {
        speedRef.current = 0;
        wasMovingRef.current = false;
        frameId = requestAnimationFrame(frame);
        return;
      }

      updateAutomaticDoors(current);

      let inputX = 0;
      let inputY = 0;
      const keys = keysRef.current;
      if (keys.has("ArrowLeft") || keys.has("KeyA")) inputX -= 1;
      if (keys.has("ArrowRight") || keys.has("KeyD")) inputX += 1;
      if (keys.has("ArrowUp") || keys.has("KeyW")) inputY -= 1;
      if (keys.has("ArrowDown") || keys.has("KeyS")) inputY += 1;

      const touch = touchRef.current;
      const viewport = viewportRef.current;
      if (touch.active && viewport) {
        const rect = viewport.getBoundingClientRect();
        const activeZoom = zoomRef.current;
        const playerScreenX = (current.x - cameraRef.current.x) * activeZoom + rect.left;
        const playerScreenY = (current.y - cameraRef.current.y) * activeZoom + rect.top;
        const tx = touch.x - playerScreenX;
        const ty = touch.y - playerScreenY;
        const len = Math.hypot(tx, ty);
        if (len > 22) {
          inputX += tx / len;
          inputY += ty / len;
        }
      }

      const inputLength = Math.hypot(inputX, inputY);
      const hasInput = inputLength > 0.06;
      const drive = robotDriveProfile(current.currentBody, current.currentDeckSize);

      if (hasInput) {
        inputX /= Math.max(1, inputLength);
        inputY /= Math.max(1, inputLength);
        const desiredHeading = Math.atan2(inputY, inputX);
        const headingDelta = normalizeAngle(desiredHeading - headingRef.current);
        const reversing = Math.abs(headingDelta) > Math.PI * 0.62;
        headingRef.current = turnToward(headingRef.current, desiredHeading, drive.turnSpeed * Math.PI / 180 * dt);
        speedRef.current = reversing && speedRef.current > drive.maxSpeed * 0.16
          ? Math.max(0, speedRef.current - drive.deceleration * 1.35 * dt)
          : Math.min(drive.maxSpeed, speedRef.current + drive.acceleration * dt);
      } else {
        speedRef.current = Math.max(0, speedRef.current - drive.deceleration * dt);
      }

      if (speedRef.current > 0.5) {
        const collisionRadius = robotCollisionRadius(current.currentDeckSize);
        const moveX = Math.cos(headingRef.current) * speedRef.current * dt;
        const moveY = Math.sin(headingRef.current) * speedRef.current * dt;
        let x = current.x;
        let y = current.y;
        const nx = x + moveX;
        const ny = y + moveY;
        if (
          pointWalkable(nx, y, current.floorId, collisionRadius)
          && !blockedByClosedDoor(floor, openDoorIdsRef.current, nx, y, collisionRadius)
          && !blockedByEncounterRobot(nx, y, collisionRadius)
        ) x = nx;
        if (
          pointWalkable(x, ny, current.floorId, collisionRadius)
          && !blockedByClosedDoor(floor, openDoorIdsRef.current, x, ny, collisionRadius)
          && !blockedByEncounterRobot(x, ny, collisionRadius)
        ) y = ny;

        if (x === current.x && y === current.y) speedRef.current = 0;
        const next = {
          ...current,
          x,
          y,
          facing: headingRef.current * 180 / Math.PI + 90,
        };
        latestMetaRef.current = next;
        updateAutomaticDoors(next);
        applyPlayerPose(next);
        applyCamera(next);
        syncMeta(next);
        wasMovingRef.current = true;
      } else if (wasMovingRef.current) {
        speedRef.current = 0;
        syncMeta(current, true);
        wasMovingRef.current = false;
      }

      frameId = requestAnimationFrame(frame);
    }
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floor.id, onMetaChange]);

  function updateTouch(event: ReactPointerEvent<HTMLDivElement>) {
    touchRef.current.x = event.clientX;
    touchRef.current.y = event.clientY;
    const rect = event.currentTarget.getBoundingClientRect();
    setTouchMarker({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (runtimePaused || (event.target as HTMLElement).closest("button,.zk-entity,.zk-modal-layer,.zk-transfer")) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    touchRef.current = { active: true, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* optional */ }
    updateTouch(event);
    event.preventDefault();
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (touchRef.current.active && event.pointerId === touchRef.current.pointerId) updateTouch(event);
  }

  function endTouch(event: ReactPointerEvent<HTMLDivElement>) {
    if (!touchRef.current.active || event.pointerId !== touchRef.current.pointerId) return;
    touchRef.current.active = false;
    setTouchMarker(null);
  }

  const body = BODIES[meta.currentBody];
  const drive = robotDriveProfile(meta.currentBody, meta.currentDeckSize);
  const remainingHp = Math.max(0, STARTING_HP - meta.damageTaken);
  let objective = meta.usedStationIds.length > 0 ? floor.objectives.afterEnergy : floor.objectives.default;
  const goal = floor.goal;
  if (goal?.kind === "defeat-encounter") {
    objective = meta.defeatedEncounterIds.includes(goal.encounterId) ? goal.completedLabel : goal.label;
  } else if (goal?.kind === "complete-action") {
    const goalAction = floor.actions.find((action) => action.id === goal.actionId);
    const complete = meta.completedActionIds.includes(goal.actionId);
    const ready = Boolean(goalAction && (!goalAction.requiresEncounterId || meta.defeatedEncounterIds.includes(goalAction.requiresEncounterId)));
    objective = complete ? goal.completedLabel : ready ? goal.readyLabel : goal.label;
  }
  const activePickups = floor.pickups.filter((pickup) => !meta.collectedPickupIds.includes(pickup.id));
  const pose = latestMetaRef.current;
  const initialPlayerStyle: PlayerStyle = {
    "--player-x": `${pose.x}px`,
    "--player-y": `${pose.y}px`,
    "--facing": `${pose.facing}deg`,
  };
  const canInteract = Boolean(nearby || nearbyNeutralEncounter) && !runtimePaused;

  return (
    <main className="zk-meta-shell clean-meta-screen" data-floor-id={floor.id}>
      <header className="zk-meta-hud">
        <div className="zk-meta-brand"><span className="zk-meta-mark">ND</span><div><strong>{floor.name}</strong><small>{floor.subtitle}</small></div></div>
        <div className="zk-meta-objective">{objective}</div>
        <div className="zk-meta-stats">
          <div className="zk-meta-stat"><small>PILOT</small><b>{PLAYER_NAMES[meta.pilotIndex % meta.playerCount].toUpperCase()}</b></div>
          <div className="zk-meta-stat"><small>KÖRPER</small><b>{body.name}</b></div>
          <div className="zk-meta-stat hp"><small>ROBOTER-HP</small><b>{remainingHp}/{STARTING_HP}</b></div>
          <div className="zk-meta-stat energy"><small>META-ENERGIE</small><b>⚡ {meta.metaEnergy}/{MAX_META_ENERGY}</b></div>
        </div>
      </header>

      <div
        ref={viewportRef}
        className="zk-meta-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endTouch}
        onPointerCancel={endTouch}
      >
        <div
          ref={worldRef}
          className="zk-meta-world"
          style={{ width: floor.width, height: floor.height }}
        >
          <FloorVisual floor={floor} />

          {floor.rooms.map((room) => (
            <div key={room.id} className="zk-room-label" style={{ left: room.x + 14, top: room.y + 12 }}>
              <b>{room.label}</b>{room.subtitle && <span>{room.subtitle}</span>}
            </div>
          ))}

          <DoorLayer
            floor={floor}
            openDoorIds={openDoorIds}
            accessKeyIds={meta.accessKeyIds}
            doorStates={meta.scriptState.doorStates}
          />

          {activePickups.map((pickup) => (
            <div key={pickup.id} className="zk-entity pickup" style={{ left: pickup.x, top: pickup.y }}>
              <span className="zk-keycard" aria-hidden="true"><b>ACCESS</b><i /></span>
              <span className="tag">{pickup.label}</span>
            </div>
          ))}

          {floor.actions.map((action) => {
            const complete = meta.completedActionIds.includes(action.id);
            const unlocked = actionUnlocked(meta, action.id);
            return (
              <div key={action.id} className={`zk-entity deck-action ${complete ? "complete" : unlocked ? "ready" : "locked"}`} style={{ left: action.x, top: action.y }}>
                <span className="zk-console-icon" aria-hidden="true">⌘</span>
                <span className="tag">{complete ? action.completionLabel : unlocked ? action.prompt : action.label}</span>
              </div>
            );
          })}

          {floor.energyStations.map((station) => {
            const used = meta.usedStationIds.includes(station.id);
            return (
              <div key={station.id} className={`zk-entity station ${used ? "empty" : ""}`} style={{ left: station.x, top: station.y }}>
                <img src={publicAsset("assets/robots/station.png")} alt="Energiestation" /><span className="tag">{station.label}</span>
              </div>
            );
          })}

          <HostileLayer
            floor={floor}
            defeatedEncounterIds={meta.defeatedEncounterIds}
            playerMetaRef={latestMetaRef}
            openDoorIdsRef={openDoorIdsRef}
            pausedRef={pausedRef}
            runtimePosesRef={encounterRuntimePosesRef}
            tacticalChallengeId={tacticalChallengeId}
            onIntercept={interceptEncounter}
            onManualEncounter={tryOpenEncounter}
            onAlert={(enemy) => showToast(enemy.behavior?.kind === "guard" ? `${enemy.name} VERLÄSST SEINEN POSTEN!` : `${enemy.name} HAT DICH ENTDECKT!`)}
            onNearbyNeutralChange={setNearbyNeutralId}
          />

          <div ref={playerRef} className={`zk-player ${meta.currentDeckSize} ${directionClassForFacing(pose.facing)}`} style={initialPlayerStyle}>
            <span className="zk-player-name">{body.name}</span>
            <span className="zk-directional-sprite" style={{ backgroundImage: `url(${body.directionalSprite})` }} aria-label="Dein Roboter" role="img" />
          </div>
        </div>

        {touchMarker && <div className="zk-touch-marker" style={{ left: touchMarker.x, top: touchMarker.y }} />}
        <button
          className={`zk-zoom-toggle ${zoom < NORMAL_ZOOM ? "active" : ""}`}
          onClick={() => setZoom((current) => current < NORMAL_ZOOM ? NORMAL_ZOOM : LOCAL_OVERVIEW_ZOOM)}
        >
          {zoom < NORMAL_ZOOM ? <>NORMALANSICHT<small>100 %</small></> : <>UMGEBUNG ANSEHEN<small>LOKALER ZOOM-OUT</small></>}
        </button>
        <div className="zk-drive-readout">{body.roleLabel} · {drive.label}</div>
        <div className="zk-touch-hint">TOUCH HALTEN → ROBOTER FÄHRT IN DIESE RICHTUNG · DESKTOP: WASD / PFEILE</div>
        <button className="zk-interact" disabled={!canInteract} onClick={interact}>
          {!nearby && nearbyNeutralEncounter ? (
            <>NEUTRALEN DROID SCANNEN<small>{nearbyNeutralEncounter.name} · freiwillig</small></>
          ) : !nearby ? (
            <>INTERAGIEREN<small>Jede Robotkollision öffnet den Scan</small></>
          ) : nearby.type === "station" && nearbyStation ? (
            <>ENERGIE AUFLADEN<small>+{nearbyStation.energy} Meta-Energie</small></>
          ) : nearby.type === "pickup" && nearbyPickup ? (
            <>ZUGANG NEHMEN<small>{nearbyPickup.label}</small></>
          ) : nearby.type === "action" && nearbyAction ? (
            <>{nearbyAction.prompt}<small>{nearbyAction.label}</small></>
          ) : nearbyEncounter ? (
            <>DROID SCANNEN<small>{nearbyEncounter.name} · {nearbyEncounter.difficultyLabel}</small></>
          ) : (
            <>INTERAGIEREN<small>Fahre näher heran</small></>
          )}
        </button>
        <div className={`zk-toast ${toast ? "show" : ""}`}>{toast}</div>

        {activeStoryBeatId && blockingStoryBeat && (
          <section className="zk-story-beat-runtime" role="dialog" aria-modal="true" aria-label="Story Beat">
            <small>LEVEL EVENT · STORY BEAT</small>
            <strong>{activeStoryBeatId}</strong>
            <span>Für diesen Beat ist noch kein finaler Story-Text hinterlegt. Die Runtime pausiert trotzdem korrekt und wartet auf die bewusste Fortsetzung.</span>
            <button onClick={dismissStoryBeat}>WEITER</button>
          </section>
        )}
      </div>
    </main>
  );
}
