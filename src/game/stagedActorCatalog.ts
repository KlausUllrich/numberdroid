export type StagedActorPresentationKind = "creature" | "vehicle" | "generic";

export type StagedActorPresentation = {
  actorType: string;
  label: string;
  kind: StagedActorPresentationKind;
  widthPx: number;
  heightPx: number;
  speedPxPerSecond: number;
};

const GENERIC: StagedActorPresentation = {
  actorType: "generic",
  label: "SCRIPTED ACTOR",
  kind: "generic",
  widthPx: 72,
  heightPx: 48,
  speedPxPerSecond: 90,
};

/**
 * Runtime-facing visual/motion metadata for non-encounter actors.
 *
 * LevelSpec keeps only semantic actorType references. Artists may later replace
 * these blockout presentations with registered assets without changing Trigger,
 * Event or route authoring. Unknown types deliberately fall back to a readable
 * blockout instead of breaking gameplay.
 */
export const STAGED_ACTOR_PRESENTATIONS: Readonly<Record<string, StagedActorPresentation>> = {
  "bioark-grazer": {
    actorType: "bioark-grazer",
    label: "BIO-ARK GRAZER",
    kind: "creature",
    widthPx: 118,
    heightPx: 72,
    speedPxPerSecond: 105,
  },
  "maintenance-skiff": {
    actorType: "maintenance-skiff",
    label: "MAINTENANCE SKIFF",
    kind: "vehicle",
    widthPx: 94,
    heightPx: 54,
    speedPxPerSecond: 125,
  },
};

export function stagedActorPresentation(actorType: string): StagedActorPresentation {
  return STAGED_ACTOR_PRESENTATIONS[actorType] ?? { ...GENERIC, actorType, label: actorType.replace(/[-_.]+/g, " ").toUpperCase() };
}
