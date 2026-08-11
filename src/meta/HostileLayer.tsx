import { memo, useEffect, useRef, type CSSProperties, type MutableRefObject } from "react";
import { BODIES, robotCollisionRadius } from "../game/catalog";
import { pointWalkable } from "../game/save";
import type { EncounterConfig, FloorDefinition, MetaState } from "../game/types";
import { blockedByClosedDoor } from "./doorRuntime";
import "./HostileLayer.css";

type EnemyStyle = CSSProperties & {
  "--enemy-x": string;
  "--enemy-y": string;
  "--enemy-facing": string;
};

type EnemyRuntime = {
  x: number;
  y: number;
  facing: number;
  pathIndex: number;
  chasing: boolean;
  armed: boolean;
};

type Props = {
  floor: FloorDefinition;
  defeatedEncounterIds: string[];
  playerMetaRef: MutableRefObject<MetaState>;
  openDoorIdsRef: MutableRefObject<Set<string>>;
  pausedRef: MutableRefObject<boolean>;
  onIntercept: (enemy: EncounterConfig) => void;
  onManualEncounter: (enemy: EncounterConfig) => void;
  onAlert: (enemy: EncounterConfig) => void;
};

function distance(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

function behaviorLabel(enemy: EncounterConfig) {
  switch (enemy.behavior?.kind) {
    case "neutral": return "ARBEITSDROID";
    case "guard": return "WACHE";
    case "patrol": return "PATROUILLE";
    case "aggressive": return "JÄGER";
    default: return "DROID";
  }
}

function HostileLayerComponent({
  floor,
  defeatedEncounterIds,
  playerMetaRef,
  openDoorIdsRef,
  pausedRef,
  onIntercept,
  onManualEncounter,
  onAlert,
}: Props) {
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const runtimeRef = useRef(new Map<string, EnemyRuntime>());
  const callbacksRef = useRef({ onIntercept, onManualEncounter, onAlert });
  callbacksRef.current = { onIntercept, onManualEncounter, onAlert };
  const encounterOpeningRef = useRef(false);
  const wasPausedRef = useRef(pausedRef.current);

  const activeEncounters = floor.encounters.filter((encounter) => !defeatedEncounterIds.includes(encounter.encounterId));

  function runtimeFor(enemy: EncounterConfig) {
    let runtime = runtimeRef.current.get(enemy.encounterId);
    if (!runtime) {
      const neutral = enemy.behavior?.kind === "neutral";
      runtime = {
        x: enemy.x,
        y: enemy.y,
        facing: 0,
        pathIndex: 0,
        chasing: false,
        armed: neutral
          ? false
          : !enemy.behavior || distance(enemy.x, enemy.y, playerMetaRef.current.x, playerMetaRef.current.y) > enemy.behavior.interceptRadius,
      };
      runtimeRef.current.set(enemy.encounterId, runtime);
    }
    return runtime;
  }

  function applyNode(enemy: EncounterConfig, runtime: EnemyRuntime) {
    const node = nodeRefs.current.get(enemy.encounterId);
    if (!node) return;
    node.style.setProperty("--enemy-x", `${runtime.x}px`);
    node.style.setProperty("--enemy-y", `${runtime.y}px`);
    node.style.setProperty("--enemy-facing", `${runtime.facing}deg`);
    node.classList.toggle("alerted", runtime.chasing);
  }

  function moveToward(enemy: EncounterConfig, runtime: EnemyRuntime, targetX: number, targetY: number, speed: number, dt: number) {
    const dx = targetX - runtime.x;
    const dy = targetY - runtime.y;
    const length = Math.hypot(dx, dy);
    if (length < 4) return true;

    const step = Math.min(length, speed * dt);
    const moveX = dx / length * step;
    const moveY = dy / length * step;
    const radius = robotCollisionRadius(enemy.deckSize ?? "standard");
    let x = runtime.x;
    let y = runtime.y;
    const nx = x + moveX;
    const ny = y + moveY;

    if (
      pointWalkable(nx, y, floor.id, radius)
      && !blockedByClosedDoor(floor, openDoorIdsRef.current, nx, y, radius)
    ) x = nx;
    if (
      pointWalkable(x, ny, floor.id, radius)
      && !blockedByClosedDoor(floor, openDoorIdsRef.current, x, ny, radius)
    ) y = ny;

    runtime.x = x;
    runtime.y = y;
    runtime.facing = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    return distance(x, y, targetX, targetY) < 6;
  }

  useEffect(() => {
    runtimeRef.current = new Map();
    encounterOpeningRef.current = false;
    let frameId = 0;
    let lastFrame = performance.now();

    for (const enemy of activeEncounters) applyNode(enemy, runtimeFor(enemy));

    function frame(now: number) {
      const dt = Math.min(0.04, (now - lastFrame) / 1000);
      lastFrame = now;
      const paused = pausedRef.current;
      if (paused) {
        wasPausedRef.current = true;
        frameId = requestAnimationFrame(frame);
        return;
      }
      if (wasPausedRef.current) {
        encounterOpeningRef.current = false;
        wasPausedRef.current = false;
      }

      const player = playerMetaRef.current;
      for (const enemy of activeEncounters) {
        const behavior = enemy.behavior;
        if (!behavior) continue;
        const runtime = runtimeFor(enemy);
        let playerDistance = distance(runtime.x, runtime.y, player.x, player.y);

        if (behavior.kind === "aggressive") {
          if (!runtime.chasing && playerDistance <= behavior.detectionRadius) {
            runtime.chasing = true;
            callbacksRef.current.onAlert(enemy);
          } else if (runtime.chasing && playerDistance > behavior.loseRadius) {
            runtime.chasing = false;
          }

          if (runtime.chasing) {
            moveToward(enemy, runtime, player.x, player.y, behavior.chaseSpeed, dt);
            playerDistance = distance(runtime.x, runtime.y, player.x, player.y);
          }
        } else if ((behavior.kind === "patrol" || behavior.kind === "neutral") && behavior.patrolPath.length > 1) {
          const target = behavior.patrolPath[runtime.pathIndex % behavior.patrolPath.length];
          if (moveToward(enemy, runtime, target.x, target.y, behavior.patrolSpeed, dt)) {
            runtime.pathIndex = (runtime.pathIndex + 1) % behavior.patrolPath.length;
          }
          playerDistance = distance(runtime.x, runtime.y, player.x, player.y);
        }

        if (behavior.kind !== "neutral") {
          if (!runtime.armed) {
            if (playerDistance > behavior.interceptRadius + 82) runtime.armed = true;
          } else if (!encounterOpeningRef.current && playerDistance <= behavior.interceptRadius) {
            runtime.armed = false;
            encounterOpeningRef.current = true;
            callbacksRef.current.onIntercept(enemy);
          }
        }

        applyNode(enemy, runtime);
      }

      frameId = requestAnimationFrame(frame);
    }

    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
    // Runtime intentionally keys off authored floor/encounter data, not player React state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floor.id, defeatedEncounterIds]);

  return (
    <>
      {activeEncounters.map((enemy) => {
        const runtime = runtimeFor(enemy);
        const style: EnemyStyle = {
          "--enemy-x": `${runtime.x}px`,
          "--enemy-y": `${runtime.y}px`,
          "--enemy-facing": `${runtime.facing}deg`,
          border: 0,
          background: "transparent",
        };
        const behavior = enemy.behavior;
        const manuallyScannable = !behavior || behavior.kind === "neutral";
        return (
          <button
            key={enemy.encounterId}
            ref={(node) => {
              if (node) nodeRefs.current.set(enemy.encounterId, node);
              else nodeRefs.current.delete(enemy.encounterId);
            }}
            className={`zk-entity enemy zk-hostile ${enemy.enemyId === "kronos" ? "kronos" : ""} ${enemy.boss ? "boss" : ""} ${enemy.deckSize === "large" ? "large" : "standard"} ${behavior ? `behavior-${behavior.kind}` : "behavior-legacy"} ${behavior?.forcedEngagement ? "forced" : ""}`}
            style={style}
            onClick={manuallyScannable ? () => callbacksRef.current.onManualEncounter({ ...enemy, x: runtime.x, y: runtime.y }) : undefined}
            aria-label={`${enemy.name}, ${enemy.boss ? "Endgegner, " : ""}${behavior ? `${behaviorLabel(enemy)}, ` : ""}${enemy.difficultyLabel}`}
          >
            <img src={BODIES[enemy.bodyId].sprite} alt="" />
            <span className="tag">{enemy.name}</span>
            {enemy.accessKey && <span className="zk-enemy-key" aria-label={`Trägt ${enemy.accessKey.label}`}>▣</span>}
            {behavior && <span className="hostile-mode" aria-hidden="true">{behavior.kind === "neutral" ? "⚙" : behavior.kind === "aggressive" ? "!" : behavior.kind === "patrol" ? "↔" : "◆"}</span>}
            <span className="level" aria-hidden="true">{[0, 1, 2].map((i) => <i key={i} className={i >= (enemy.difficulty === "easy" ? 1 : enemy.difficulty === "medium" ? 2 : 3) ? "off" : ""} />)}</span>
          </button>
        );
      })}
    </>
  );
}

export const HostileLayer = memo(HostileLayerComponent, (previous, next) => (
  previous.floor.id === next.floor.id
  && previous.defeatedEncounterIds === next.defeatedEncounterIds
  && previous.playerMetaRef === next.playerMetaRef
  && previous.openDoorIdsRef === next.openDoorIdsRef
  && previous.pausedRef === next.pausedRef
));
