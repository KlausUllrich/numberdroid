import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { BODIES, ENCOUNTERS, ENCOUNTER_IDS, MAX_META_ENERGY, PLAYER_NAMES, STARTING_HP, STATION, WORLD_H, WORLD_W } from "../game/catalog";
import { pointWalkable } from "../game/save";
import type { EncounterConfig, EnemyId, MetaState } from "../game/types";

type Nearby = { type: "station" } | { type: "enemy"; id: EnemyId } | null;

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
  let best: Nearby = null;
  let bestDistance = Infinity;
  if (!meta.stationUsed) {
    const d = distance(meta.x, meta.y, STATION.x, STATION.y);
    if (d < 105) { best = { type: "station" }; bestDistance = d; }
  }
  for (const id of ENCOUNTER_IDS) {
    if (meta.defeated.includes(id)) continue;
    const enemy = ENCOUNTERS[id];
    const d = distance(meta.x, meta.y, enemy.x, enemy.y);
    if (d < 112 && d < bestDistance) { best = { type: "enemy", id }; bestDistance = d; }
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

  useEffect(() => { latestMetaRef.current = meta; }, [meta]);
  useEffect(() => { cameraRef.current = camera; }, [camera]);
  useEffect(() => { pausedRef.current = paused; if (paused) { touchRef.current.active = false; setTouchMarker(null); } }, [paused]);

  const nearby = useMemo(() => nearestInteractable(meta), [meta]);

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
      const next = rotatePilot({
        ...meta,
        stationUsed: true,
        metaEnergy: Math.min(MAX_META_ENERGY, meta.metaEnergy + 1),
      });
      onMetaChange(next);
      showToast(`ENERGIEZELLE GELADEN · ⚡ ${next.metaEnergy}/${MAX_META_ENERGY}`);
      return;
    }
    onEncounter(ENCOUNTERS[nearby.id]);
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
      if (pausedRef.current) { frameId = requestAnimationFrame(frame); return; }
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
        if (len > 22) { dx += tx / len; dy += ty / len; }
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
        if (pointWalkable(nx, y)) x = nx;
        if (pointWalkable(x, ny)) y = ny;
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
      const vw = viewport.clientWidth;
      const vh = viewport.clientHeight;
      let cx = meta.x - vw / 2;
      let cy = meta.y - vh / 2;
      cx = Math.max(0, Math.min(Math.max(0, WORLD_W - vw), cx));
      cy = Math.max(0, Math.min(Math.max(0, WORLD_H - vh), cy));
      if (vw > WORLD_W) cx = -(vw - WORLD_W) / 2;
      if (vh > WORLD_H) cy = -(vh - WORLD_H) / 2;
      setCamera({ x: cx, y: cy });
    }
    updateCamera();
    window.addEventListener("resize", updateCamera);
    return () => window.removeEventListener("resize", updateCamera);
  }, [meta.x, meta.y]);

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
  const objective = meta.stationUsed ? "ENERGIE GESICHERT · WÄHLE EINEN DROIDEN" : "ERKUNDE DAS DECK · FINDE ENERGIE · WÄHLE EINEN DROIDEN";

  return (
    <main className="zk-meta-shell clean-meta-screen">
      <header className="zk-meta-hud">
        <div className="zk-meta-brand"><span className="zk-meta-mark">ND</span><div><strong>DECK A7</strong><small>FREIE ERKUNDUNG · VERTICAL SLICE</small></div></div>
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
        <div className="zk-meta-world" style={{ transform: `translate(${-camera.x}px, ${-camera.y}px)` }}>
          <img className="zk-deck-art" alt="" src="/assets/deck/deck-a7.webp" />

          <div className={`zk-entity station ${meta.stationUsed ? "empty" : ""}`} style={{ left: STATION.x, top: STATION.y }}>
            <img src="/assets/robots/station.png" alt="Energiestation" /><span className="tag">ENERGIE ⚡ +1</span>
          </div>

          {ENCOUNTER_IDS.map((id) => {
            const enemy = ENCOUNTERS[id];
            const defeated = meta.defeated.includes(id);
            return (
              <button
                key={id}
                className={`zk-entity enemy ${id === "kronos" ? "kronos" : ""} ${defeated ? "defeated" : ""}`}
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
          {!nearby ? <>INTERAGIEREN<small>Fahre näher heran</small></> : nearby.type === "station" ? <>ENERGIE AUFLADEN<small>+1 Meta-Energie</small></> : <>DROID SCANNEN<small>{ENCOUNTERS[nearby.id].name} · {ENCOUNTERS[nearby.id].difficultyLabel}</small></>}
        </button>
        <div className={`zk-toast ${toast ? "show" : ""}`}>{toast}</div>
      </div>
    </main>
  );
}
