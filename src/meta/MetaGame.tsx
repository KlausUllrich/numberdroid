import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { BODIES, MAX_META_ENERGY, PLAYER_NAMES, STARTING_HP } from "../game/catalog";
import { getFloor } from "../game/floors";
import { pointWalkable } from "../game/save";
import type { EncounterConfig, MetaState } from "../game/types";

type Nearby = { type: "station"; id: string } | { type: "enemy"; id: string } | null;

type Props = {
  meta: MetaState;
  onMetaChange: (next: MetaState) => void;
  onEncounter: (encounter: EncounterConfig) => void;
  paused?: boolean;
};

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
  const keysRef = useRef(new Set<string>());
  const touchRef = useRef({ active: false, pointerId: -1, x: 0, y: 0 });
  const latestMetaRef = useRef(meta);
  const lastFrameRef = useRef(performance.now());
  const cameraRef = useRef({ x: 0, y: 0 });
  const pausedRef = useRef(paused);
  const [touchMarker, setTouchMarker] = useState<{ x: number; y: number } | null>(null);
  const [toast, setToast] = useState("");
  const [camera, setCamera] = useState({ x: 0, y: 0 });

  const floor = getFloor(meta.floorId);
  const nearby = useMemo(() => nearestInteractable(meta), [meta]);
  const nearbyStation = nearby?.type === "station" ? floor.energyStations.find((station) => station.id === nearby.id) : null;
  const nearbyEncounter = nearby?.type === "enemy" ? floor.encounters.find((encounter) => encounter.encounterId === nearby.id) : null;

  useEffect(() => { latestMetaRef.current = meta; }, [meta]);
  useEffect(() => { cameraRef.current = camera; }, [camera]);
  useEffect(() => {
    pausedRef.current = paused;
    if (paused) {
      touchRef.current.active = false;
      setTouchMarker(null);
    }
  }, [paused]);

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

    if (nearby.type === "station") {
      const station = floor.energyStations.find((entry) => entry.id === nearby.id);
      if (!station || meta.usedStationIds.includes(station.id)) return;
      const next = rotatePilot({
        ...meta,
        usedStationIds: [...meta.usedStationIds, station.id],
        metaEnergy: Math.min(MAX_META_ENERGY, meta.metaEnergy + station.energy),
      });
      onMetaChange(next);
      showToast(`ENERGIEZELLE GELADEN · ⚡ ${next.metaEnergy}/${MAX_META_ENERGY}`);
      return;
    }

    const encounter = floor.encounters.find((entry) => entry.encounterId === nearby.id);
    if (encounter) onEncounter(encounter);
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
        frameId = requestAnimationFrame(frame);
        return;
      }

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
        const playerScreenX = current.x - cameraRef.current.x + rect.left;
        const playerScreenY = current.y - cameraRef.current.y + rect.top;
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
        if (pointWalkable(nx, y, current.floorId)) x = nx;
        if (pointWalkable(x, ny, current.floorId)) y = ny;
        const next = { ...current, x, y, facing: Math.atan2(dy, dx) * 180 / Math.PI + 90 };
        latestMetaRef.current = next;
        onMetaChange(next);
      }
      frameId = requestAnimationFrame(frame);
    }
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [onMetaChange]);

  useEffect(() => {
    function updateCamera() {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const activeFloor = getFloor(meta.floorId);
      const vw = viewport.clientWidth;
      const vh = viewport.clientHeight;
      let cx = meta.x - vw / 2;
      let cy = meta.y - vh / 2;
      cx = Math.max(0, Math.min(Math.max(0, activeFloor.width - vw), cx));
      cy = Math.max(0, Math.min(Math.max(0, activeFloor.height - vh), cy));
      if (vw > activeFloor.width) cx = -(vw - activeFloor.width) / 2;
      if (vh > activeFloor.height) cy = -(vh - activeFloor.height) / 2;
      setCamera({ x: cx, y: cy });
    }
    updateCamera();
    window.addEventListener("resize", updateCamera);
    return () => window.removeEventListener("resize", updateCamera);
  }, [meta.floorId, meta.x, meta.y]);

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
  const objective = meta.usedStationIds.length > 0 ? floor.objectives.afterEnergy : floor.objectives.default;

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
          className="zk-meta-world"
          style={{ width: floor.width, height: floor.height, transform: `translate(${-camera.x}px, ${-camera.y}px)` }}
        >
          <img className="zk-deck-art" alt="" src={floor.backgroundAsset} style={{ width: floor.width, height: floor.height }} />

          {floor.energyStations.map((station) => {
            const used = meta.usedStationIds.includes(station.id);
            return (
              <div key={station.id} className={`zk-entity station ${used ? "empty" : ""}`} style={{ left: station.x, top: station.y }}>
                <img src="/assets/robots/station.png" alt="Energiestation" /><span className="tag">{station.label}</span>
              </div>
            );
          })}

          {floor.encounters.map((enemy) => {
            const defeated = meta.defeatedEncounterIds.includes(enemy.encounterId);
            return (
              <button
                key={enemy.encounterId}
                className={`zk-entity enemy ${enemy.enemyId === "kronos" ? "kronos" : ""} ${defeated ? "defeated" : ""}`}
                style={{ left: enemy.x, top: enemy.y, border: 0, background: "transparent" }}
                onClick={() => distance(meta.x, meta.y, enemy.x, enemy.y) < 145 ? onEncounter(enemy) : showToast(`FAHRE NÄHER AN ${enemy.name}`)}
                disabled={defeated}
                aria-label={`${enemy.name}, ${enemy.difficultyLabel}`}
              >
                <img src={BODIES[enemy.bodyId].sprite} alt="" />
                <span className="tag">{enemy.name}</span>
                <span className="level" aria-hidden="true">{[0, 1, 2].map((i) => <i key={i} className={i >= (enemy.difficulty === "easy" ? 1 : enemy.difficulty === "medium" ? 2 : 3) ? "off" : ""} />)}</span>
              </button>
            );
          })}

          <div className="zk-player" style={{ left: meta.x, top: meta.y, "--facing": `${meta.facing}deg` } as CSSProperties & { "--facing": string }}>
            <span className="zk-player-name">{body.name}</span>
            <img src={body.sprite} alt="Dein Roboter" />
          </div>
        </div>

        {touchMarker && <div className="zk-touch-marker" style={{ left: touchMarker.x, top: touchMarker.y }} />}
        <div className="zk-touch-hint">TOUCH HALTEN → ROBOTER FÄHRT IN DIESE RICHTUNG · DESKTOP: WASD / PFEILE</div>
        <button className="zk-interact" disabled={!nearby} onClick={interact}>
          {!nearby ? (
            <>INTERAGIEREN<small>Fahre näher heran</small></>
          ) : nearby.type === "station" && nearbyStation ? (
            <>ENERGIE AUFLADEN<small>+{nearbyStation.energy} Meta-Energie</small></>
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
