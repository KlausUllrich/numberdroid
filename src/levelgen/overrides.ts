import { deriveSubSeed } from "./seed";
import type { LevelSpec, PlacementOverride } from "./types";

export function overrideFor(overrides: PlacementOverride[], targetId: string) {
  return overrides.find((entry) => entry.targetId === targetId);
}

export function locallyVariedSeed(baseSeed: number, override: PlacementOverride | undefined) {
  const salt = override?.seedSalt ?? 0;
  return salt === 0 ? baseSeed : deriveSubSeed(baseSeed, `override-variation/${salt}`);
}

function integerPoint(value: { x: number; y: number } | undefined) {
  return Boolean(value && Number.isInteger(value.x) && Number.isInteger(value.y));
}

export function validatePlacementOverrides(spec: LevelSpec) {
  const spaces = new Set(spec.spaces.map((entry) => entry.id));
  const connections = new Set(spec.connections.map((entry) => entry.id));
  const props = new Set(spec.props.map((entry) => entry.id));
  const encounters = new Set(spec.encounters.map((entry) => entry.id));
  const known = new Set([
    ...spaces,
    ...connections,
    ...props,
    ...encounters,
    ...(spec.stagedActors ?? []).map((entry) => entry.id),
    ...(spec.routes ?? []).map((entry) => entry.id),
    ...(spec.pickups ?? []).map((entry) => entry.id),
    ...(spec.zones ?? []).map((entry) => entry.id),
    ...(spec.triggers ?? []).map((entry) => entry.id),
    ...(spec.events ?? []).map((entry) => entry.id),
  ]);
  const seen = new Set<string>();

  for (const override of spec.overrides ?? []) {
    if (!known.has(override.targetId)) throw new Error(`Override references unknown semantic id ${override.targetId}.`);
    if (seen.has(override.targetId)) throw new Error(`Duplicate Override target ${override.targetId}; merge edits into one semantic Override.`);
    seen.add(override.targetId);

    if (override.seedSalt !== undefined && (!Number.isInteger(override.seedSalt) || override.seedSalt < 0)) {
      throw new Error(`Override ${override.targetId} seedSalt must be a non-negative integer.`);
    }

    if (override.offsetTiles) {
      if (!spaces.has(override.targetId)) throw new Error(`Override ${override.targetId} offsetTiles can target only a Space.`);
      if (!integerPoint(override.offsetTiles)) throw new Error(`Override ${override.targetId} offsetTiles must use integer tile coordinates.`);
    }

    if (override.size) {
      if (!spaces.has(override.targetId)) throw new Error(`Override ${override.targetId} size can target only a Space.`);
      const space = spec.spaces.find((entry) => entry.id === override.targetId)!;
      if (space.kind !== "room") throw new Error(`Override ${override.targetId} size currently supports Room Spaces only.`);
    }

    if (override.preferredSide && !connections.has(override.targetId)) {
      throw new Error(`Override ${override.targetId} preferredSide can target only a Connection.`);
    }
    if (override.preferredWall && !props.has(override.targetId)) {
      throw new Error(`Override ${override.targetId} preferredWall can target only a Prop request.`);
    }
    if (override.robotType && !encounters.has(override.targetId)) {
      throw new Error(`Override ${override.targetId} robotType can target only an Encounter actor.`);
    }

    if (override.lockGeometry || override.lockedGeometry) {
      if (!spaces.has(override.targetId)) throw new Error(`Override ${override.targetId} geometry lock can target only a Space.`);
      if (!override.lockGeometry || !override.lockedGeometry) {
        throw new Error(`Override ${override.targetId} geometry lock requires lockGeometry=true and materialized lockedGeometry data.`);
      }
      const lock = override.lockedGeometry;
      if (!integerPoint(lock.offsetFromRootTiles)) {
        throw new Error(`Override ${override.targetId} lockedGeometry offsetFromRootTiles must use integer tile coordinates.`);
      }
      if (!Number.isInteger(lock.sizeTiles.w) || !Number.isInteger(lock.sizeTiles.h) || lock.sizeTiles.w <= 0 || lock.sizeTiles.h <= 0) {
        throw new Error(`Override ${override.targetId} lockedGeometry sizeTiles must use positive integer dimensions.`);
      }
    }

    if (override.lockPlacement || override.lockedPlacement) {
      if (!props.has(override.targetId)) throw new Error(`Override ${override.targetId} placement lock can target only a Prop request.`);
      if (!override.lockPlacement || !override.lockedPlacement) {
        throw new Error(`Override ${override.targetId} placement lock requires lockPlacement=true and materialized lockedPlacement data.`);
      }
      if (!integerPoint(override.lockedPlacement.offsetTiles)) {
        throw new Error(`Override ${override.targetId} lockedPlacement offsetTiles must use integer tile coordinates.`);
      }
    }
  }
}

export function withOverride(
  overrides: PlacementOverride[],
  targetId: string,
  edit: (current: PlacementOverride) => PlacementOverride | null,
) {
  const current = overrideFor(overrides, targetId) ?? { targetId };
  const next = edit(current);
  const rest = overrides.filter((entry) => entry.targetId !== targetId);
  return next ? [...rest, next] : rest;
}
