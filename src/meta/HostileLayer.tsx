import { memo, useEffect, useRef, type CSSProperties, type MutableRefObject } from "react";
import { BODIES, robotCollisionRadius } from "../game/catalog";
import { pointWalkable } from "../game/save";
import type { EncounterBehaviorKind, EncounterConfig, FloorDefinition, MetaState } from "../game/types";
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
  returning: boolean;
  armed: boolean;
};

export type EncounterRuntimePose = {
  x: number;
  y: number;
  radius: number;
  behaviorKind: EncounterBehaviorKind | "legacy";
};

type Props = {
  floor: FloorDefinition;
  defeatedEncounterIds: string[];
  playerMetaRef: MutableRefObject<MetaState>;
  openDoorIdsRef: MutableRefObject<Set<string>>;
  pausedRef: MutableRefObject<boolean>;
  runtimePosesRef: MutableRefObject<Map<string, EncounterRuntimePose>>;
  onIntercept: (enemy: EncounterConfig) => void;
  onManualEncounter: (enemy: EncounterConfig) => void;
  onAlert: (enemy: EncounterConfig) => void;
  onNearbyNeutralChange: (encounterId: string | null) => void;
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
  runtimePosesRef,
  onIntercept,
  onManualEncounter,
  onAlert,
  onNearbyNeutralChange,
}: Props) {
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const runtimeRef = useRef(new Map<string, EnemyRuntime>());
  const callbacksRef = useRef({ onIntercept, onManualEncounter, onAlert, onNearbyNeutralChange });
  callbacksRef.current = { onIntercept, onManualEncounter, onAlert, onNearbyNeutralChange };
  const encounterOpeningRef = useRef(false);
  const wasPausedRef = useRef(pausedRef.current);
  const nearbyNeutralRef = useRef<string | null>(null);

  const activeEncounters = floor.encounters.filter((encounter) => !defeatedEncounterIds.includes(encounter.encounterId));

  function contactDistance(enemy: EncounterConfig) {
    return robotCollisionRadius(enemy.deckSize ?? "standard") + robotCollisionRadius(playerMetaRef.current.currentDeckSize) + 6;
  }

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
        returning: false,
        armed: neutral
          ? false
          : distance(enemy.x, enemy.y, playerMetaRef.current.x, playerMetaRef.current.y) > contactDistance(enemy) + 28,
      };
      runtimeRef.current.set(enemy.encounterId, runtime);
    }
    return runtime;
  }

  function syncRuntimePose(enemy: EncounterConfig, runtime: EnemyRuntime) {
    runtimePosesRef.current.set(enemy.encounterId, {
      x: runtime.x,
      y: runtime.y,
      radius: robotCollisionRadius(enemy.deckSize ?? "standard"),
      behaviorKind: enemy.behavior?.kind ?? "legacy",
    });
  }

  function applyNode(enemy: EncounterConfig, runtime: EnemyRuntime) {
    syncRuntimePose(enemy, runtime);
    const node = nodeRefs.current.get(enemy.encounterId);
    if (!node) return;
    node.style.setProperty("--enemy-x", `${runtime.x}px`);
    node.style.setProperty("--enemy-y", `${runtime.y}px`);
    node.style.setProperty("--enemy-facing", `${runtime.facing}deg`);
    node.classList.toggle("alerted", runtime.chasing);
    node.classList.toggle("returning", runtime.returning);
  }

  function canOccupy(enemy: EncounterConfig, x: number, y: number) {
    const radius = robotCollisionRadius(enemy.deckSize ?? "standard");
    if (!pointWalkable(x, y, floor.id, radius)) return false;
    if (blockedByClosedDoor(floor, openDoorIdsRef.current, x, y, radius)) return false;

    const player = playerMetaRef.current;
    const playerRadius = robotCollisionRadius(player.currentDeckSize);
    return distance(x, y, player.x, player.y) >= radius + playerRadius + 2;
  }

  function moveToward(enemy: EncounterConfig, runtime: EnemyRuntime, targetX: number, targetY: number, speed: number, dt: number) {
    const dx = targetX - runtime.x;
    const dy = targetY - runtime.y;
    const length = Math.hypot(dx, dy);
    if (length < 4) return true;

    const step = Math.min(length, speed * dt);
    const moveX = dx / length * step;
    const moveY = dy / length * step;
    let x = runtime.x;
    let y = runtime.y;
    const nx = x + moveX;
    const ny = y + moveY;

    if (canOccupy(enemy, nx, y)) x = nx;
    if (canOccupy(enemy, x, ny)) y = ny;

    runtime.x = x;
    runtime.y = y;
    runtime.facing = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    return distance(x, y, targetX, targetY) < 6;
  }

  useEffect(() => {
    runtimeRef.current = new Map();
    runtimePosesRef.current.clear();
    encounterOpeningRef.current = false;
    nearbyNeutralRef.current = null;
    callbacksRef.current.onNearbyNeutralChange(null);
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
      const playerRadius = robotCollisionRadius(player.currentDeckSize);
      let nearestNeutralId: string | null = null;
      let nearestNeutralDistance = Infinity;

      for (const enemy of activeEncounters) {
        const behavior = enemy.behavior;
        const runtime = runtimeFor(enemy);
        if (!behavior) {
          applyNode(enemy, runtime);
          continue;
        }

        let playerDistance = distance(runtime.x, runtime.y, player.x, player.y);
        const homePlayerDistance = distance(enemy.x, enemy.y, player.x, player.y);

        if (behavior.kind === "guard") {
          if (runtime.returning) {
            runtime.chasing = false;
            if (moveToward(enemy, runtime, enemy.x, enemy.y, Math.max(48, behavior.chaseSpeed * 0.72), dt)) {
              runtime.returning = false;
              runtime.facing = 0;
            }
          } else {
            if (!runtime.chasing && homePlayerDistance <= behavior.detectionRadius) {
              runtime.chasing = true;
              callbacksRef.current.onAlert(enemy);
            }

            if (runtime.chasing) {
              if (homePlayerDistance > behavior.loseRadius) {
                runtime.chasing = false;
                runtime.returning = true;
              } else {
                moveToward(enemy, runtime, player.x, player.y, behavior.chaseSpeed, dt);
              }
            }
          }
          playerDistance = distance(runtime.x, runtime.y, player.x, player.y);
        } else if (behavior.kind === "aggressive") {
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

        const contact = robotCollisionRadius(enemy.deckSize ?? "standard") + playerRadius + 6;
        if (behavior.kind === "neutral") {
          const interactionDistance = contact + 68;
          if (playerDistance <= interactionDistance && playerDistance < nearestNeutralDistance) {
            nearestNeutralId = enemy.encounterId;
            nearestNeutralDistance = playerDistance;
          }
        } else if (!runtime.armed) {
          if (playerDistance > contact + 46) runtime.armed = true;
        } else if (!encounterOpeningRef.current && playerDistance <= contact) {
          runtime.armed = false;
          encounterOpeningRef.current = true;
          callbacksRef.current.onIntercept({ ...enemy, x: runtime.x, y: runtime.y });
        }

        applyNode(enemy, runtime);
      }

      if (nearestNeutralId !== nearbyNeutralRef.current) {
        nearbyNeutralRef.current = nearestNeutralId;
        callbacksRef.current.onNearbyNeutralChange(nearestNeutralId);
      }

      frameId = requestAnimationFrame(frame);
    }

    frameId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(frameId);
      runtimePosesRef.current.clear();
    };
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
            {behavior && <span className="hostile-mode" aria-hidden="true">{behavior.kind === "neutral" ? "⚙" : runtime.returning ? "↩" : behavior.kind === "aggressive" ? "!" : behavior.kind === "patrol" ? "↔" : "◆"}</span>}
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
  && previous.runtimePosesRef === next.runtimePosesRef
));