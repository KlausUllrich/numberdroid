import { memo, useEffect, useRef, type CSSProperties, type MutableRefObject } from "react";
import { stagedActorPresentation } from "../game/stagedActorCatalog";
import { stagedActorPose } from "../game/stagedActorRuntime";
import type { FloorDefinition, ScriptedActorRunState } from "../game/types";
import "./StagedActorLayer.css";

type ActorStyle = CSSProperties & {
  "--staged-x": string;
  "--staged-y": string;
  "--staged-facing": string;
  "--staged-width": string;
  "--staged-height": string;
};

type Props = {
  floor: FloorDefinition;
  stagedActors: Readonly<Record<string, ScriptedActorRunState>>;
  pausedRef: MutableRefObject<boolean>;
  onPassbyComplete: (actorId: string) => void;
};

export const StagedActorLayer = memo(function StagedActorLayer({
  floor,
  stagedActors,
  pausedRef,
  onPassbyComplete,
}: Props) {
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const completionRef = useRef(new Map<string, string>());
  const callbackRef = useRef(onPassbyComplete);
  callbackRef.current = onPassbyComplete;

  const definitions = floor.script?.stagedActors ?? [];

  function signature(actorId: string, state: ScriptedActorRunState) {
    return `${actorId}|${state.mode}|${state.routeId ?? ""}|${state.startedAtMs ?? ""}`;
  }

  function applyPose(actorId: string, nowMs: number) {
    const definition = definitions.find((entry) => entry.id === actorId);
    const state = stagedActors[actorId];
    const node = nodeRefs.current.get(actorId);
    if (!definition || !state || !node || !state.present) return;
    const presentation = stagedActorPresentation(definition.actorType);
    const pose = stagedActorPose(floor, definition, state, presentation, nowMs);
    if (!pose) return;

    node.style.setProperty("--staged-x", `${pose.x}px`);
    node.style.setProperty("--staged-y", `${pose.y}px`);
    node.style.setProperty("--staged-facing", `${pose.facing}deg`);
    node.dataset.progress = pose.progress.toFixed(3);

    const currentSignature = signature(actorId, state);
    if (completionRef.current.get(actorId) !== currentSignature) completionRef.current.delete(actorId);
    if (state.mode === "passby" && pose.complete && !pausedRef.current && !completionRef.current.has(actorId)) {
      completionRef.current.set(actorId, currentSignature);
      callbackRef.current(actorId);
    }
  }

  useEffect(() => {
    let frameId = 0;
    const moving = definitions.some((definition) => {
      const state = stagedActors[definition.id];
      return Boolean(state?.present && state.mode !== "idle" && state.routeId);
    });

    const now = Date.now();
    for (const definition of definitions) applyPose(definition.id, now);
    if (!moving) return undefined;

    function frame() {
      const current = Date.now();
      for (const definition of definitions) applyPose(definition.id, current);
      frameId = requestAnimationFrame(frame);
    }
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
    // Actor pose is derived from the persistent stagedActors object; ordinary player pose updates do not restart this loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floor.id, stagedActors]);

  return (
    <>
      {definitions.map((definition) => {
        const state = stagedActors[definition.id];
        if (!state?.present) return null;
        const presentation = stagedActorPresentation(definition.actorType);
        const pose = stagedActorPose(floor, definition, state, presentation, Date.now());
        if (!pose) return null;
        const style: ActorStyle = {
          "--staged-x": `${pose.x}px`,
          "--staged-y": `${pose.y}px`,
          "--staged-facing": `${pose.facing}deg`,
          "--staged-width": `${presentation.widthPx}px`,
          "--staged-height": `${presentation.heightPx}px`,
        };
        return (
          <div
            key={definition.id}
            ref={(node) => {
              if (node) nodeRefs.current.set(definition.id, node);
              else nodeRefs.current.delete(definition.id);
            }}
            className={`zk-staged-actor kind-${presentation.kind} mode-${state.mode}`}
            data-actor-id={definition.id}
            data-actor-type={definition.actorType}
            style={style}
            aria-label={presentation.label}
          >
            <span className="staged-shadow" />
            <span className="staged-body"><i className="staged-head" /><i className="staged-mark" /></span>
            <span className="staged-tag">{presentation.label}</span>
          </div>
        );
      })}
    </>
  );
});
