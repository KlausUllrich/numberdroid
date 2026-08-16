import { compileActorPlacement } from "./actorPlacement";
import { compileLevelSpec } from "./compiler";
import { compileTriggerEvents } from "./eventCompilation";
import { compileLevelGeometry } from "./geometry";
import { compileLevelNavigationV031 } from "./navigationHardening";
import { compileOrientedPropPlacement } from "./orientedPlacement";
import { overrideFor, validatePlacementOverrides, withOverride } from "./overrides";
import type { EventCompilationPlan } from "./eventCompilationTypes";
import type { EnemyId } from "../game/types";
import type { PropRegistry, LevelSpec, PlacementOverride, CardinalDirection } from "./types";

export type WorkbenchSelection =
  | { kind: "space"; id: string }
  | { kind: "prop"; id: string }
  | { kind: "actor"; id: string };

export type WorkbenchCompileResult = {
  plan: EventCompilationPlan | null;
  error: string | null;
};

export function compileWorkbenchPlan(
  baseSpec: LevelSpec,
  propRegistry: PropRegistry,
  overrides: PlacementOverride[],
): EventCompilationPlan {
  const spec: LevelSpec = { ...baseSpec, overrides };
  validatePlacementOverrides(spec);
  const semantic = compileLevelSpec(spec, propRegistry);
  const geometry = compileLevelGeometry(semantic);
  const navigation = compileLevelNavigationV031(geometry);
  const props = compileOrientedPropPlacement(navigation);
  const actors = compileActorPlacement(props);
  return compileTriggerEvents(actors);
}

export function tryCompileWorkbenchPlan(
  baseSpec: LevelSpec,
  propRegistry: PropRegistry,
  overrides: PlacementOverride[],
): WorkbenchCompileResult {
  try {
    return { plan: compileWorkbenchPlan(baseSpec, propRegistry, overrides), error: null };
  } catch (error) {
    return { plan: null, error: error instanceof Error ? error.message : String(error) };
  }
}

export function materializeGeometryLock(
  plan: EventCompilationPlan,
  overrides: PlacementOverride[],
  spaceId: string,
) {
  const spaces = plan.actors.props.navigation.geometry.spaces;
  const root = spaces[0];
  const space = spaces.find((entry) => entry.id === spaceId);
  if (!root || !space) throw new Error(`Workbench cannot lock unknown Space ${spaceId}.`);
  return withOverride(overrides, spaceId, (current) => ({
    ...current,
    targetId: spaceId,
    lockGeometry: true,
    lockedGeometry: {
      offsetFromRootTiles: { x: space.rect.x - root.rect.x, y: space.rect.y - root.rect.y },
      sizeTiles: { w: space.rect.w, h: space.rect.h },
    },
    offsetTiles: undefined,
  }));
}

export function unlockGeometry(overrides: PlacementOverride[], spaceId: string) {
  return withOverride(overrides, spaceId, (current) => {
    const next = { ...current, lockGeometry: undefined, lockedGeometry: undefined };
    return compactOverride(next);
  });
}

export function nudgeLockedGeometry(
  plan: EventCompilationPlan,
  overrides: PlacementOverride[],
  spaceId: string,
  dx: number,
  dy: number,
) {
  const locked = materializeGeometryLock(plan, overrides, spaceId);
  return withOverride(locked, spaceId, (current) => ({
    ...current,
    lockedGeometry: {
      ...current.lockedGeometry!,
      offsetFromRootTiles: {
        x: current.lockedGeometry!.offsetFromRootTiles.x + dx,
        y: current.lockedGeometry!.offsetFromRootTiles.y + dy,
      },
    },
  }));
}

export function resizeLockedGeometry(
  plan: EventCompilationPlan,
  overrides: PlacementOverride[],
  spaceId: string,
  dw: number,
  dh: number,
) {
  const locked = materializeGeometryLock(plan, overrides, spaceId);
  return withOverride(locked, spaceId, (current) => {
    const w = current.lockedGeometry!.sizeTiles.w + dw;
    const h = current.lockedGeometry!.sizeTiles.h + dh;
    if (w <= 0 || h <= 0) throw new Error(`Workbench Space size must remain positive.`);
    return {
      ...current,
      lockedGeometry: { ...current.lockedGeometry!, sizeTiles: { w, h } },
    };
  });
}

export function materializePropLock(
  plan: EventCompilationPlan,
  overrides: PlacementOverride[],
  placementId: string,
) {
  const placement = plan.actors.props.placements.find((entry) => entry.id === placementId);
  if (!placement) throw new Error(`Workbench cannot lock unknown Prop placement ${placementId}.`);
  const request = plan.actors.props.navigation.geometry.semantic.props.find((entry) => entry.id === placement.requestId);
  if (!request) throw new Error(`Workbench cannot resolve Prop request ${placement.requestId}.`);
  if (request.quantity !== 1) {
    throw new Error(`Workbench v0.12 locks singleton Prop requests only; ${request.id} has quantity ${request.quantity}.`);
  }
  const space = plan.actors.props.navigation.geometry.spaces.find((entry) => entry.id === placement.spaceId)!;
  return withOverride(overrides, request.id, (current) => ({
    ...current,
    targetId: request.id,
    lockPlacement: true,
    lockedPlacement: {
      offsetTiles: { x: placement.rect.x - space.rect.x, y: placement.rect.y - space.rect.y },
      rotation: placement.rotation,
      wallSide: placement.wallSide,
    },
  }));
}

export function unlockProp(overrides: PlacementOverride[], requestId: string) {
  return withOverride(overrides, requestId, (current) => {
    const next = { ...current, lockPlacement: undefined, lockedPlacement: undefined };
    return compactOverride(next);
  });
}

export function nudgeLockedProp(
  plan: EventCompilationPlan,
  overrides: PlacementOverride[],
  placementId: string,
  dx: number,
  dy: number,
) {
  const placement = plan.actors.props.placements.find((entry) => entry.id === placementId);
  if (!placement) throw new Error(`Workbench cannot nudge unknown Prop ${placementId}.`);
  const locked = materializePropLock(plan, overrides, placementId);
  return withOverride(locked, placement.requestId, (current) => ({
    ...current,
    lockedPlacement: {
      ...current.lockedPlacement!,
      offsetTiles: {
        x: current.lockedPlacement!.offsetTiles.x + dx,
        y: current.lockedPlacement!.offsetTiles.y + dy,
      },
    },
  }));
}

export function setPreferredWall(
  overrides: PlacementOverride[],
  requestId: string,
  preferredWall: CardinalDirection | undefined,
) {
  return withOverride(overrides, requestId, (current) => compactOverride({ ...current, preferredWall }));
}

export function setPreferredSide(
  overrides: PlacementOverride[],
  connectionId: string,
  preferredSide: CardinalDirection | undefined,
) {
  return withOverride(overrides, connectionId, (current) => compactOverride({ ...current, preferredSide }));
}

export function setEncounterRobotType(
  overrides: PlacementOverride[],
  encounterId: string,
  robotType: EnemyId | undefined,
) {
  return withOverride(overrides, encounterId, (current) => compactOverride({ ...current, robotType }));
}

export function regenerateSemanticTarget(overrides: PlacementOverride[], targetId: string) {
  return withOverride(overrides, targetId, (current) => ({
    ...current,
    seedSalt: (current.seedSalt ?? 0) + 1,
  }));
}

export function resetOverride(overrides: PlacementOverride[], targetId: string) {
  return overrides.filter((entry) => entry.targetId !== targetId);
}

export function overrideJson(overrides: PlacementOverride[]) {
  return JSON.stringify(overrides, null, 2);
}

function compactOverride(override: PlacementOverride): PlacementOverride | null {
  const entries = Object.entries(override).filter(([key, value]) => key === "targetId" || value !== undefined);
  return entries.length <= 1 ? null : Object.fromEntries(entries) as PlacementOverride;
}

export function activeOverride(overrides: PlacementOverride[], targetId: string) {
  return overrideFor(overrides, targetId) ?? null;
}
