import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { BODIES, MAX_META_ENERGY, PLAYER_NAMES, STARTING_HP } from "../game/catalog";
import { getFloor } from "../game/floors";
import { pointWalkable } from "../game/save";
import type { EncounterConfig, MetaState } from "../game/types";
import { DoorLayer } from "./DoorLayer";
import { FloorVisual } from "./FloorVisual";
import { blockedByClosedDoor, nextAutomaticDoorIds, sameDoorSet } from "./doorRuntime";
import "./MetaGameMotion.css";

type Nearby =
  | { type: "station"; id: string }
  | { type: "pickup"; id: string }
  | { type: "enemy"; id: string }
  | null;
type PlayerStyle = CSSProperties & { "--player-x": string; "--player-y": string; "--facing": string };

type Props = {
  meta: MetaState;
  onMetaChange: (next: MetaState) => void;
  onEncounter: (encounter: EncounterConfig) => void;
  paused?: boolean;
};

const META_SYNC_INTERVAL_MS = 120;
const NORMAL_ZOOM = 1;
const LOCAL_OVERVIEW_ZOOM = 0.68;

function distance(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
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

  for (const encounter of floor.encounters) {
    if (meta.defeatedEncounterIds.includes(encounter.encounterId)) continue;
    const d = distance(meta.x, meta.y, encounter.x, encounter.y);
    if (d < 112 && d < bestDistance) {
      best = { type: "enemy", id: encounter.encounterId };
      bestDistance = d;
    }
  }

  return best;
}

export function MetaGame({ meta, onMetaChange, onEncounter, paused = false }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef(new Set<string>());
  const touchRef = useRef({ active: false, pointerId: -1, x: 0, y: 0 });
  const latestMetaRef = useRef(meta);
  const lastFrameRef = useRef(performance.now());
  const lastMetaSyncRef = useRef(performance.now());
  const cameraRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(NORMAL_ZOOM);
  const pausedRef = useRef(paused);
  const wasMovingRef = useRef(false);
  const openDoorIdsRef = useRef<Set<string>>(new Set());
  const [touchMarker, setTouchMarker] = useState<{ x: number; y: number } | null>(null);
  const [toast, setToast] = useState("");
  const [zoom, setZoom] = useState(NORMAL_ZOOM);
  const [openDoorIds, setOpenDoorIds] = useState<Set<string>>(() => new Set());

  const floor = getFloor(meta.floorId);
  const nearby = useMemo(() => nearestInteractable(meta), [meta]);
  const nearbyStation = nearby?.type === "station" ? floor.energyStations.find((station) => station.id === nearby.id) : null;
  const nearbyPickup = nearby?.type === "pickup" ? floor.pickups.find((pickup) => pickup.id === nearby.id) : null;
  const nearbyEncounter = nearby?.type === "enemy" ? floor.encounters.find((encounter) => encounter.encounterId === nearby.id) : null;

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

  useEffect(() => {
    latestMetaRef.current = meta;
    applyPlayerPose(meta);
    applyCamera(meta);
    // This component is remounted for deck returns; floor changes are external pose changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.floorId]);

  useEffect(() => {
    zoomRef.current = zoom;
    applyCamera(latestMetaRef.current, zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  useEffect(() => {
    pausedRef.current = paused;
    if (paused) {
      touchRef.current.active = false;
      setTouchMarker(null);
      syncMeta(latestMetaRef.current, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  useEffect(() => {
    function onResize() { applyCamera(latestMetaRef.current); }
    openDoorIdsRef.current = new Set();
    setOpenDoorIds(new Set());
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

  function interact() {
    if (paused || !nearby) return;
    const current = latestMetaRef.current;

    if (nearby.type === "station") {
      const station = floor.energyStations.find((entry) => entry.id === nearby.id);
      if (!station || current.usedStationIds.includes(station.id)) return;
      const next = rotatePilot({
        ...current,
        usedStationIds: [...current.usedStationIds, station.id],
        metaEnergy: Math.min(MAX_META_ENERGY, current.metaEnergy + station.energy),
      });
      latestMetaRef.current = next;
      syncMeta(next, true);
      showToast(`ENERGIEZELLE GELADEN · ⚡ ${next.metaEnergy}/${MAX_META_ENERGY}`);
      return;
    }

    if (nearby.type === "pickup") {
      const pickup = floor.pickups.find((entry) => entry.id === nearby.id);
      if (!pickup || current.collectedPickupIds.includes(pickup.id)) return;
      const next = {
        ...current,
        collectedPickupIds: [...current.collectedPickupIds, pickup.id],
      };
      latestMetaRef.current = next;
      updateAutomaticDoors(next);
      syncMeta(next, true);
      showToast(`${pickup.label} GESICHERT`);
      return;
    }

    const encounter = floor.encounters.find((entry) => entry.encounterId === nearby.id);
    if (encounter) {
      syncMeta(current, true);
      onEncounter(encounter);
    }
  }

  function tryOpenEncounter(enemy: EncounterConfig) {
    const current = latestMetaRef.current;
    if (distance(current.x, current.y, enemy.x, enemy.y) >= 145) {
      showToast(`FAHRE NÄHER AN ${enemy.name}`);
      return;
    }
    syncMeta(current, true);
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
        wasMovingRef.current = false;
        frameId = requestAnimationFrame(frame);
        return;
      }

      updateAutomaticDoors(current);

      let dx = 0;
      let dy = 0;
      const keys = keysRef.current;
      if (keys.has("ArrowLeft") || keys.has("KeyA")) dx -= 1;
      if (keys.has("ArrowRight") || keys.has("KeyD")) dx += 1;
      if (keys.has("ArrowUp") || keys.has("KeyW")) dy -= 1;
      if (keys.has("ArrowDown") || keys.has("KeyS")) dy += 1;

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
          dx += tx / len;
          dy += ty / len;
        }
      }

      const len = Math.hypot(dx, dy);
      if (len > 0.06) {
        dx /= Math.max(1, len);
        dy /= Math.max(1, len);
        const speed = 205;
        let x = current.x;
        let y = current.y;
        const nx = x + dx * speed * dt;
        const ny = y + dy * speed * dt;
        if (pointWalkable(nx, y, current.floorId) && !blockedByClosedDoor(floor, openDoorIdsRef.current, nx, y)) x = nx;
        if (pointWalkable(x, ny, current.floorId) && !blockedByClosedDoor(floor, openDoorIdsRef.current, x, ny)) y = ny;
        const next = { ...current, x, y, facing: Math.atan2(dy, dx) * 180 / Math.PI + 90 };
        latestMetaRef.current = next;
        updateAutomaticDoors(next);
        applyPlayerPose(next);
        applyCamera(next);
        syncMeta(next);
        wasMovingRef.current = true;
      } else if (wasMovingRef.current) {
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
    if (paused || (event.target as HTMLElement).closest("button,.zk-entity,.zk-modal-layer,.zk-transfer")) return;
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
  const remainingHp = Math.max(0, STARTING_HP - meta.damageTaken);
  const goalComplete = floor.goal?.kind === "defeat-encounter" && meta.defeatedEncounterIds.includes(floor.goal.encounterId);
  const objective = floor.goal
    ? goalComplete ? floor.goal.completedLabel : floor.goal.label
    : meta.usedStationIds.length > 0 ? floor.objectives.afterEnergy : floor.objectives.default;
  const activeEncounters = floor.encounters.filter((encounter) => !meta.defeatedEncounterIds.includes(encounter.encounterId));
  const activePickups = floor.pickups.filter((pickup) => !meta.collectedPickupIds.includes(pickup.id));
  const pose = latestMetaRef.current;
  const initialPlayerStyle: PlayerStyle = {
    "--player-x": `${pose.x}px`,
    "--player-y": `${pose.y}px`,
    "--facing": `${pose.facing}deg`,
  };

  return (
    <main className="zk-meta-shell clean-meta-screen">
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
          <DoorLayer floor={floor} openDoorIds={openDoorIds} collectedPickupIds={meta.collectedPickupIds} />

          {activePickups.map((pickup) => (
            <div key={pickup.id} className="zk-entity pickup" style={{ left: pickup.x, top: pickup.y }}>
              <span className="zk-keycard" aria-hidden="true"><b>ACCESS</b><i /></span>
              <span className="tag">{pickup.label}</span>
            </div>
          ))}

          {floor.energyStations.map((station) => {
            const used = meta.usedStationIds.includes(station.id);
            return (
              <div key={station.id} className={`zk-entity station ${used ? "empty" : ""}`} style={{ left: station.x, top: station.y }}>
                <img src="/assets/robots/station.png" alt="Energiestation" /><span className="tag">{station.label}</span>
              </div>
            );
          })}

          {activeEncounters.map((enemy) => (
            <button
              key={enemy.encounterId}
              className={`zk-entity enemy ${enemy.enemyId === "kronos" ? "kronos" : ""} ${enemy.boss ? "boss" : ""} ${enemy.deckSize === "large" ? "large" : "standard"}`}
              style={{ left: enemy.x, top: enemy.y, border: 0, background: "transparent" }}
              onClick={() => tryOpenEncounter(enemy)}
              aria-label={`${enemy.name}, ${enemy.boss ? "Endgegner, " : ""}${enemy.difficultyLabel}`}
            >
              <img src={BODIES[enemy.bodyId].sprite} alt="" />
              <span className="tag">{enemy.name}</span>
              <span className="level" aria-hidden="true">{[0, 1, 2].map((i) => <i key={i} className={i >= (enemy.difficulty === "easy" ? 1 : enemy.difficulty === "medium" ? 2 : 3) ? "off" : ""} />)}</span>
            </button>
          ))}

          <div ref={playerRef} className="zk-player" style={initialPlayerStyle}>
            <span className="zk-player-name">{body.name}</span>
            <img src={body.sprite} alt="Dein Roboter" />
          </div>
        </div>

        {touchMarker && <div className="zk-touch-marker" style={{ left: touchMarker.x, top: touchMarker.y }} />}
        <button
          className={`zk-zoom-toggle ${zoom < NORMAL_ZOOM ? "active" : ""}`}
          onClick={() => setZoom((current) => current < NORMAL_ZOOM ? NORMAL_ZOOM : LOCAL_OVERVIEW_ZOOM)}
        >
          {zoom < NORMAL_ZOOM ? <>NORMALANSICHT<small>100 %</small></> : <>UMGEBUNG ANSEHEN<small>LOKALER ZOOM-OUT</small></>}
        </button>
        <div className="zk-touch-hint">TOUCH HALTEN → ROBOTER FÄHRT IN DIESE RICHTUNG · DESKTOP: WASD / PFEILE</div>
        <button className="zk-interact" disabled={!nearby} onClick={interact}>
          {!nearby ? (
            <>INTERAGIEREN<small>Fahre näher heran</small></>
          ) : nearby.type === "station" && nearbyStation ? (
            <>ENERGIE AUFLADEN<small>+{nearbyStation.energy} Meta-Energie</small></>
          ) : nearby.type === "pickup" && nearbyPickup ? (
            <>ZUGANGSKARTE NEHMEN<small>{nearbyPickup.label}</small></>
          ) : nearbyEncounter ? (
            <>DROID SCANNEN<small>{nearbyEncounter.name} · {nearbyEncounter.difficultyLabel}</small></>
          ) : (
            <>INTERAGIEREN<small>Fahre näher heran</small></>
          )}
        </button>
        <div className={`zk-toast ${toast ? "show" : ""}`}>{toast}</div>
      </div>
    </main>
  );
}
