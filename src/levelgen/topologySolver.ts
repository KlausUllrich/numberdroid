import { deriveSubSeed, seededUnit } from "./seed";
import { locallyVariedSeed, overrideFor } from "./overrides";
import type {
  CardinalDirection,
  CompiledConnection,
  CompiledSemanticSpace,
  CompileDiagnostic,
  RelativeRelation,
  SemanticCompilePlan,
  SpatialRelationSpec,
  TileRange,
} from "./types";
import type { GridRect, SpaceGeometry } from "./geometryTypes";

const SIDES: CardinalDirection[] = ["north", "east", "south", "west"];
const DEFAULT_ROOM_SIZE = {
  tiny: { w: 2, h: 3 },
  small: { w: 4, h: 4 },
  medium: { w: 7, h: 6 },
  large: { w: 9, h: 8 },
  hero: { w: 10, h: 6 },
} as const;

export type MultiConstraintTopologyResult = {
  spaces: SpaceGeometry[];
  diagnostics: CompileDiagnostic[];
  searchNodes: number;
  backtracks: number;
};

type RelationConstraint = SpatialRelationSpec & { subjectId: string };

type Candidate = {
  rect: GridRect;
  score: number;
  anchorConnectionId: string;
  anchorSide: CardinalDirection;
  slide: number;
};

function opposite(side: CardinalDirection): CardinalDirection {
  if (side === "north") return "south";
  if (side === "south") return "north";
  if (side === "east") return "west";
  return "east";
}

function inverseRelation(relation: RelativeRelation): RelativeRelation {
  if (relation === "north_of") return "south_of";
  if (relation === "south_of") return "north_of";
  if (relation === "east_of") return "west_of";
  if (relation === "west_of") return "east_of";
  if (relation === "north_east_of") return "south_west_of";
  if (relation === "north_west_of") return "south_east_of";
  if (relation === "south_east_of") return "north_west_of";
  if (relation === "south_west_of") return "north_east_of";
  return "adjacent";
}

function sideFromRelation(relation: RelativeRelation | undefined): CardinalDirection | undefined {
  if (!relation || relation === "adjacent") return undefined;
  if (relation === "north_of" || relation === "north_east_of" || relation === "north_west_of") return "north";
  if (relation === "south_of" || relation === "south_east_of" || relation === "south_west_of") return "south";
  if (relation === "east_of") return "east";
  return "west";
}

function integerRangeOptions(range: TileRange | undefined, fallback: number, context: string) {
  const preferred = range?.preferred ?? fallback;
  const min = range?.min ?? preferred;
  const max = range?.max ?? preferred;
  if (!Number.isInteger(preferred) || preferred <= 0) {
    throw new Error(`${context} preferred value must resolve to a positive integer tile count; got ${preferred}.`);
  }
  const low = Math.ceil(min);
  const high = Math.floor(max);
  if (low <= 0 || high < low || preferred < low || preferred > high) {
    throw new Error(`${context} has no valid integer range around preferred ${preferred}.`);
  }
  const result = [preferred];
  for (let delta = 1; result.length < high - low + 1; delta += 1) {
    const lower = preferred - delta;
    const upper = preferred + delta;
    if (lower >= low) result.push(lower);
    if (upper <= high) result.push(upper);
  }
  return result;
}

function lockedRect(semantic: SemanticCompilePlan, spaceId: string): GridRect | null {
  const override = overrideFor(semantic.overrides, spaceId);
  if (!override?.lockGeometry || !override.lockedGeometry) return null;
  const lock = override.lockedGeometry;
  return {
    x: lock.offsetFromRootTiles.x,
    y: lock.offsetFromRootTiles.y,
    w: lock.sizeTiles.w,
    h: lock.sizeTiles.h,
  };
}

function dimensionOptions(space: CompiledSemanticSpace, semantic: SemanticCompilePlan) {
  const locked = lockedRect(semantic, space.id);
  if (locked) return [{ w: locked.w, h: locked.h }];

  if (space.kind === "corridor") {
    const widths = integerRangeOptions(space.width, 3, `Corridor ${space.id} width`);
    const lengths = integerRangeOptions(space.length, 8, `Corridor ${space.id} length`);
    const orientation = space.orientation === "horizontal" ? "horizontal" : "vertical";
    const result = widths.flatMap((width) => lengths.map((length) => orientation === "horizontal"
      ? { w: length, h: width }
      : { w: width, h: length }));
    return result.sort((a, b) => {
      const preferred = orientation === "horizontal"
        ? { w: lengths[0], h: widths[0] }
        : { w: widths[0], h: lengths[0] };
      const ad = Math.abs(a.w - preferred.w) + Math.abs(a.h - preferred.h);
      const bd = Math.abs(b.w - preferred.w) + Math.abs(b.h - preferred.h);
      return ad - bd || a.w * a.h - b.w * b.h || a.w - b.w || a.h - b.h;
    });
  }

  const fallback = DEFAULT_ROOM_SIZE[space.size.class];
  const override = overrideFor(semantic.overrides, space.id);
  const widths = integerRangeOptions(override?.size?.width ?? space.size.width, fallback.w, `Room ${space.id} width`);
  const heights = integerRangeOptions(override?.size?.height ?? space.size.height, fallback.h, `Room ${space.id} height`);
  const preferred = { w: widths[0], h: heights[0] };
  return widths.flatMap((w) => heights.map((h) => ({ w, h }))).sort((a, b) => {
    const ad = Math.abs(a.w - preferred.w) + Math.abs(a.h - preferred.h);
    const bd = Math.abs(b.w - preferred.w) + Math.abs(b.h - preferred.h);
    return ad - bd || a.w * a.h - b.w * b.h || a.w - b.w || a.h - b.h;
  });
}

function preferredDimensions(space: CompiledSemanticSpace, semantic: SemanticCompilePlan) {
  return dimensionOptions(space, semantic)[0];
}

function rectOverlap(a: GridRect, b: GridRect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function rectCenter(rect: GridRect) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

function sharedBoundary(from: GridRect, to: GridRect) {
  const yStart = Math.max(from.y, to.y);
  const yEnd = Math.min(from.y + from.h, to.y + to.h);
  if (from.x + from.w === to.x && yEnd > yStart) return { fromSide: "east" as const, toSide: "west" as const, length: yEnd - yStart };
  if (to.x + to.w === from.x && yEnd > yStart) return { fromSide: "west" as const, toSide: "east" as const, length: yEnd - yStart };
  const xStart = Math.max(from.x, to.x);
  const xEnd = Math.min(from.x + from.w, to.x + to.w);
  if (from.y + from.h === to.y && xEnd > xStart) return { fromSide: "south" as const, toSide: "north" as const, length: xEnd - xStart };
  if (to.y + to.h === from.y && xEnd > xStart) return { fromSide: "north" as const, toSide: "south" as const, length: xEnd - xStart };
  return null;
}

export function spatialRelationSatisfied(subject: GridRect, target: GridRect, relation: RelativeRelation) {
  if (relation === "adjacent") return Boolean(sharedBoundary(subject, target));
  const a = rectCenter(subject);
  const b = rectCenter(target);
  if (relation === "north_of") return a.y < b.y;
  if (relation === "south_of") return a.y > b.y;
  if (relation === "east_of") return a.x > b.x;
  if (relation === "west_of") return a.x < b.x;
  if (relation === "north_east_of") return a.y <= b.y && a.x >= b.x && (a.y < b.y || a.x > b.x);
  if (relation === "north_west_of") return a.y <= b.y && a.x <= b.x && (a.y < b.y || a.x < b.x);
  if (relation === "south_east_of") return a.y >= b.y && a.x >= b.x && (a.y > b.y || a.x > b.x);
  return a.y >= b.y && a.x <= b.x && (a.y > b.y || a.x < b.x);
}

function relationConstraints(semantic: SemanticCompilePlan): RelationConstraint[] {
  return semantic.spaces.flatMap((space) => (space.relations ?? []).map((relation) => ({ ...relation, subjectId: space.id })));
}

function effectiveRelation(semantic: SemanticCompilePlan, subjectId: string, targetId: string) {
  const subject = semantic.spaces.find((space) => space.id === subjectId);
  const direct = subject?.relations?.find((relation) => relation.targetId === targetId);
  if (direct) return direct.relation;
  const target = semantic.spaces.find((space) => space.id === targetId);
  const reverse = target?.relations?.find((relation) => relation.targetId === subjectId);
  return reverse ? inverseRelation(reverse.relation) : undefined;
}

function preferredConnectionSide(semantic: SemanticCompilePlan, connection: CompiledConnection) {
  return overrideFor(semantic.overrides, connection.id)?.preferredSide ?? connection.preferredSide;
}

function connectionSide(
  semantic: SemanticCompilePlan,
  connection: CompiledConnection,
  parentId: string,
  childId: string,
  relation: RelativeRelation | undefined,
) {
  const preferredSide = preferredConnectionSide(semantic, connection);
  if (preferredSide) {
    if (connection.from === parentId && connection.to === childId) return preferredSide;
    if (connection.to === parentId && connection.from === childId) return opposite(preferredSide);
  }
  return sideFromRelation(relation) ?? "east";
}

function alignedCoordinate(parent: GridRect, childSize: { w: number; h: number }, side: CardinalDirection, relation?: RelativeRelation) {
  if (side === "north" || side === "south") {
    if (relation === "north_west_of" || relation === "south_west_of") return parent.x;
    if (relation === "north_east_of" || relation === "south_east_of") return parent.x + parent.w - childSize.w;
    return parent.x + Math.floor((parent.w - childSize.w) / 2);
  }
  if (relation === "north_east_of" || relation === "north_west_of") return parent.y;
  if (relation === "south_east_of" || relation === "south_west_of") return parent.y + parent.h - childSize.h;
  return parent.y + Math.floor((parent.h - childSize.h) / 2);
}

function baseCandidate(parent: GridRect, childSize: { w: number; h: number }, side: CardinalDirection, relation?: RelativeRelation): GridRect {
  if (side === "north") return { x: alignedCoordinate(parent, childSize, side, relation), y: parent.y - childSize.h, ...childSize };
  if (side === "south") return { x: alignedCoordinate(parent, childSize, side, relation), y: parent.y + parent.h, ...childSize };
  if (side === "west") return { x: parent.x - childSize.w, y: alignedCoordinate(parent, childSize, side, relation), ...childSize };
  return { x: parent.x + parent.w, y: alignedCoordinate(parent, childSize, side, relation), ...childSize };
}

function shifted(candidate: GridRect, side: CardinalDirection, amount: number): GridRect {
  return side === "north" || side === "south" ? { ...candidate, x: candidate.x + amount } : { ...candidate, y: candidate.y + amount };
}

function sharedLengthForSide(parent: GridRect, child: GridRect, side: CardinalDirection) {
  if (side === "north" || side === "south") return Math.max(0, Math.min(parent.x + parent.w, child.x + child.w) - Math.max(parent.x, child.x));
  return Math.max(0, Math.min(parent.y + parent.h, child.y + child.h) - Math.max(parent.y, child.y));
}

function shiftOrder(limit: number) {
  const result = [0];
  for (let value = 1; value <= limit; value += 1) result.push(-value, value);
  return result;
}

function sideOrder(primary: CardinalDirection) {
  return [primary, ...SIDES.filter((side) => side !== primary)];
}

function connectionsFor(semantic: SemanticCompilePlan, spaceId: string) {
  return semantic.connections.filter((connection) => connection.from === spaceId || connection.to === spaceId);
}

function connectionOther(connection: CompiledConnection, spaceId: string) {
  return connection.from === spaceId ? connection.to : connection.from;
}

function connectionSatisfied(connection: CompiledConnection, placed: Map<string, SpaceGeometry>) {
  const from = placed.get(connection.from);
  const to = placed.get(connection.to);
  if (!from || !to) return true;
  const boundary = sharedBoundary(from.rect, to.rect);
  return Boolean(boundary && boundary.length >= connection.widthTiles);
}

function requiredRelationsSatisfied(semantic: SemanticCompilePlan, placed: Map<string, SpaceGeometry>, focusId?: string) {
  for (const constraint of relationConstraints(semantic)) {
    if ((constraint.strength ?? "preferred") !== "required") continue;
    if (focusId && constraint.subjectId !== focusId && constraint.targetId !== focusId) continue;
    const subject = placed.get(constraint.subjectId);
    const target = placed.get(constraint.targetId);
    if (!subject || !target) continue;
    if (!spatialRelationSatisfied(subject.rect, target.rect, constraint.relation)) return false;
  }
  return true;
}

function candidateScore(
  semantic: SemanticCompilePlan,
  child: CompiledSemanticSpace,
  candidate: Candidate,
  placed: Map<string, SpaceGeometry>,
) {
  let score = candidate.score;
  const preferred = preferredDimensions(child, semantic);
  score -= (Math.abs(candidate.rect.w - preferred.w) + Math.abs(candidate.rect.h - preferred.h)) * 12;
  score -= Math.abs(candidate.slide) * 0.35;

  for (const connection of connectionsFor(semantic, child.id)) {
    const otherId = connectionOther(connection, child.id);
    const other = placed.get(otherId);
    if (!other) continue;
    const childGeometry: SpaceGeometry = { id: child.id, kind: child.kind, rect: candidate.rect, seed: child.seed };
    const from = connection.from === child.id ? childGeometry : other;
    const to = connection.to === child.id ? childGeometry : other;
    const boundary = sharedBoundary(from.rect, to.rect);
    if (!boundary) continue;
    const preferredSide = preferredConnectionSide(semantic, connection);
    if (preferredSide && boundary.fromSide === preferredSide) score += 80;
  }

  const prospective = new Map(placed);
  prospective.set(child.id, { id: child.id, kind: child.kind, rect: candidate.rect, seed: child.seed });
  for (const constraint of relationConstraints(semantic)) {
    if ((constraint.strength ?? "preferred") !== "preferred") continue;
    if (constraint.subjectId !== child.id && constraint.targetId !== child.id) continue;
    const subject = prospective.get(constraint.subjectId);
    const target = prospective.get(constraint.targetId);
    if (subject && target && spatialRelationSatisfied(subject.rect, target.rect, constraint.relation)) score += 32;
  }

  const variedSeed = locallyVariedSeed(child.seed, overrideFor(semantic.overrides, child.id));
  score += seededUnit(deriveSubSeed(variedSeed, `topology/${candidate.rect.x},${candidate.rect.y},${candidate.rect.w},${candidate.rect.h}`)) * 0.001;
  return score;
}

function generateCandidates(semantic: SemanticCompilePlan, child: CompiledSemanticSpace, placed: Map<string, SpaceGeometry>) {
  const raw = new Map<string, Candidate>();
  const locked = lockedRect(semantic, child.id);

  if (locked) {
    raw.set(`${locked.x},${locked.y},${locked.w},${locked.h}`, {
      rect: locked,
      score: 10_000,
      anchorConnectionId: `lock:${child.id}`,
      anchorSide: "north",
      slide: 0,
    });
  } else {
    for (const connection of connectionsFor(semantic, child.id)) {
      const parentId = connectionOther(connection, child.id);
      const parent = placed.get(parentId);
      if (!parent) continue;
      const relation = effectiveRelation(semantic, child.id, parentId);
      const primarySide = connectionSide(semantic, connection, parentId, child.id, relation);

      for (const childSize of dimensionOptions(child, semantic)) {
        const limit = Math.max(parent.rect.w, parent.rect.h, childSize.w, childSize.h) + 24;
        for (const side of sideOrder(primarySide)) {
          const base = baseCandidate(parent.rect, childSize, side, relation);
          for (const slide of shiftOrder(limit)) {
            const rect = shifted(base, side, slide);
            if (sharedLengthForSide(parent.rect, rect, side) < connection.widthTiles) continue;
            const key = `${rect.x},${rect.y},${rect.w},${rect.h}`;
            const sideBonus = side === primarySide ? 40 : 0;
            const candidate = { rect, score: sideBonus, anchorConnectionId: connection.id, anchorSide: side, slide };
            const previous = raw.get(key);
            if (!previous || candidate.score > previous.score || (candidate.score === previous.score && Math.abs(candidate.slide) < Math.abs(previous.slide))) {
              raw.set(key, candidate);
            }
          }
        }
      }
    }
  }

  const valid: Candidate[] = [];
  for (const candidate of raw.values()) {
    if ([...placed.values()].some((other) => rectOverlap(candidate.rect, other.rect))) continue;
    const prospective = new Map(placed);
    prospective.set(child.id, { id: child.id, kind: child.kind, rect: candidate.rect, seed: child.seed });
    if (connectionsFor(semantic, child.id).some((connection) => placed.has(connectionOther(connection, child.id)) && !connectionSatisfied(connection, prospective))) continue;
    if (!requiredRelationsSatisfied(semantic, prospective, child.id)) continue;
    valid.push({ ...candidate, score: candidateScore(semantic, child, candidate, placed) });
  }

  return valid.sort((a, b) => b.score - a.score
    || Math.abs(a.slide) - Math.abs(b.slide)
    || a.rect.y - b.rect.y
    || a.rect.x - b.rect.x
    || a.rect.w - b.rect.w
    || a.rect.h - b.rect.h
    || a.anchorConnectionId.localeCompare(b.anchorConnectionId));
}

function nextSpace(semantic: SemanticCompilePlan, placed: Map<string, SpaceGeometry>) {
  const relations = relationConstraints(semantic);
  const order = new Map(semantic.spaces.map((space, index) => [space.id, index]));
  return semantic.spaces
    .filter((space) => !placed.has(space.id))
    .map((space) => {
      const placedConnections = connectionsFor(semantic, space.id).filter((connection) => placed.has(connectionOther(connection, space.id))).length;
      const placedRequired = relations.filter((relation) => (relation.strength ?? "preferred") === "required"
        && (relation.subjectId === space.id || relation.targetId === space.id)
        && placed.has(relation.subjectId === space.id ? relation.targetId : relation.subjectId)).length;
      const degree = connectionsFor(semantic, space.id).length;
      const locked = overrideFor(semantic.overrides, space.id)?.lockGeometry ? 1 : 0;
      return { space, placedConnections, placedRequired, degree, locked, order: order.get(space.id) ?? 0 };
    })
    .filter((entry) => entry.placedConnections > 0)
    .sort((a, b) => b.locked - a.locked
      || b.placedRequired - a.placedRequired
      || b.placedConnections - a.placedConnections
      || b.degree - a.degree
      || a.order - b.order)[0]?.space ?? null;
}

export function validateRequiredSpatialRelations(semantic: SemanticCompilePlan, spaces: SpaceGeometry[]) {
  const byId = new Map(spaces.map((space) => [space.id, space]));
  for (const constraint of relationConstraints(semantic)) {
    if ((constraint.strength ?? "preferred") !== "required") continue;
    const subject = byId.get(constraint.subjectId)!;
    const target = byId.get(constraint.targetId)!;
    if (!spatialRelationSatisfied(subject.rect, target.rect, constraint.relation)) {
      throw new Error(`Required spatial relation failed: ${constraint.subjectId} ${constraint.relation} ${constraint.targetId}.`);
    }
  }
}

export function spatialRelationDiagnostics(semantic: SemanticCompilePlan, spaces: SpaceGeometry[]) {
  const byId = new Map(spaces.map((space) => [space.id, space]));
  const preferred = relationConstraints(semantic).filter((relation) => (relation.strength ?? "preferred") === "preferred");
  const unsatisfied = preferred.filter((constraint) => {
    const subject = byId.get(constraint.subjectId)!;
    const target = byId.get(constraint.targetId)!;
    return !spatialRelationSatisfied(subject.rect, target.rect, constraint.relation);
  });
  const diagnostics: CompileDiagnostic[] = unsatisfied.map((constraint) => ({
    level: "warning",
    code: "PREFERRED_SPATIAL_RELATION_UNSATISFIED",
    targetId: constraint.subjectId,
    message: `Preferred relation not satisfied: ${constraint.subjectId} ${constraint.relation} ${constraint.targetId}.`,
  }));
  diagnostics.push({
    level: "info",
    code: "SPATIAL_RELATIONS_EVALUATED",
    message: `Evaluated ${preferred.length} preferred spatial relation(s); ${preferred.length - unsatisfied.length} satisfied, ${unsatisfied.length} unsatisfied.`,
  });
  return diagnostics;
}

export function solveMultiConstraintTopology(semantic: SemanticCompilePlan): MultiConstraintTopologyResult {
  if (!semantic.spaces.length) throw new Error("Multi-constraint topology solve requires at least one semantic space.");
  const root = semantic.spaces[0];
  const rootLock = lockedRect(semantic, root.id);
  if (rootLock && (rootLock.x !== 0 || rootLock.y !== 0)) {
    throw new Error(`Root Space ${root.id} lockedGeometry offsetFromRootTiles must be 0,0.`);
  }
  const maxSearchNodes = Math.max(50_000, semantic.spaces.length * 5_000);
  let searchNodes = 0;
  let backtracks = 0;
  let solved: Map<string, SpaceGeometry> | null = null;

  const search = (placed: Map<string, SpaceGeometry>): Map<string, SpaceGeometry> | null => {
    searchNodes += 1;
    if (searchNodes > maxSearchNodes) {
      throw new Error(`Multi-constraint topology search exceeded ${maxSearchNodes} deterministic search nodes.`);
    }
    if (placed.size === semantic.spaces.length) return placed;
    const child = nextSpace(semantic, placed);
    if (!child) return null;
    const candidates = generateCandidates(semantic, child, placed);
    for (const candidate of candidates) {
      const next = new Map(placed);
      next.set(child.id, { id: child.id, kind: child.kind, rect: candidate.rect, seed: child.seed });
      const result = search(next);
      if (result) return result;
      backtracks += 1;
    }
    return null;
  };

  const rootSizes = rootLock ? [{ w: rootLock.w, h: rootLock.h }] : dimensionOptions(root, semantic);
  for (const rootSize of rootSizes) {
    const initial = new Map<string, SpaceGeometry>([[root.id, {
      id: root.id,
      kind: root.kind,
      rect: { x: 0, y: 0, ...rootSize },
      seed: root.seed,
    }]]);
    solved = search(initial);
    if (solved) break;
    backtracks += 1;
  }

  if (!solved) {
    const required = relationConstraints(semantic)
      .filter((relation) => (relation.strength ?? "preferred") === "required")
      .map((relation) => `${relation.subjectId} ${relation.relation} ${relation.targetId}`);
    throw new Error(`Multi-constraint topology solver found no valid arrangement for ${semantic.levelId}.${required.length ? ` Required relations: ${required.join("; ")}.` : ""}`);
  }

  const spaces = semantic.spaces.map((space) => solved!.get(space.id)!);
  validateRequiredSpatialRelations(semantic, spaces);
  const diagnostics: CompileDiagnostic[] = [];
  const cycleRank = Math.max(0, semantic.connections.length - semantic.spaces.length + 1);
  diagnostics.push({
    level: "info",
    code: "MULTI_CONSTRAINT_TOPOLOGY_SOLVED",
    message: `Solved topology with cycle rank ${cycleRank} in ${searchNodes} search node(s) and ${backtracks} backtrack(s).`,
  });

  for (const space of spaces) {
    const override = overrideFor(semantic.overrides, space.id);
    if (override?.lockGeometry) {
      diagnostics.push({
        level: "info",
        code: "GEOMETRY_LOCK_APPLIED",
        targetId: space.id,
        message: `${space.id} remained fixed to its materialized root-relative Workbench geometry lock.`,
      });
      continue;
    }
    const preferred = preferredDimensions(semantic.spaces.find((entry) => entry.id === space.id)!, semantic);
    if (space.rect.w !== preferred.w || space.rect.h !== preferred.h) {
      diagnostics.push({
        level: "info",
        code: "SPACE_SIZE_ADJUSTED_FOR_CONSTRAINTS",
        targetId: space.id,
        message: `${space.id} adjusted from preferred ${preferred.w}×${preferred.h} to ${space.rect.w}×${space.rect.h} to satisfy joint topology constraints.`,
      });
    }
  }

  return { spaces, diagnostics, searchNodes, backtracks };
}