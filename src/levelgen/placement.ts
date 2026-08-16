import { deriveSubSeed, seededUnit } from "./seed";
import type { CardinalDirection, CompiledPropRequest, PropPlacementRole, PropRotation } from "./types";
import type { GridRect, SpaceGeometry } from "./geometryTypes";
import type { GridCell, NavigationCell, NavigationCompilePlan } from "./navigationTypes";
import type { PlacementReservation, PropPlacementDecision, PropPlacementPlan } from "./placementTypes";

const ROLE_ORDER: Record<PropPlacementRole, number> = {
  hero: 0,
  support: 1,
  furniture: 2,
  dressing: 3,
};

const SIDES: CardinalDirection[] = ["north", "east", "south", "west"];
const NEIGHBORS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const;

function cellKey(cell: GridCell) {
  return `${cell.x},${cell.y}`;
}

function sideOpposite(side: CardinalDirection): CardinalDirection {
  if (side === "north") return "south";
  if (side === "south") return "north";
  if (side === "east") return "west";
  return "east";
}

export function rotationBackSide(rotation: PropRotation): CardinalDirection {
  if (rotation === 0) return "north";
  if (rotation === 90) return "east";
  if (rotation === 180) return "south";
  return "west";
}

export function wallSideRotation(side: CardinalDirection): PropRotation {
  if (side === "north") return 0;
  if (side === "east") return 90;
  if (side === "south") return 180;
  return 270;
}

export function rotatedFootprint(
  footprint: { w: number; h: number },
  rotation: PropRotation,
) {
  return rotation === 90 || rotation === 270
    ? { w: footprint.h, h: footprint.w }
    : { w: footprint.w, h: footprint.h };
}

function rectCenter(rect: GridRect) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

function manhattanRects(a: GridRect, b: GridRect) {
  const ac = rectCenter(a);
  const bc = rectCenter(b);
  return Math.abs(ac.x - bc.x) + Math.abs(ac.y - bc.y);
}

function touchedSides(rect: GridRect, space: GridRect): CardinalDirection[] {
  const result: CardinalDirection[] = [];
  if (rect.y === space.y) result.push("north");
  if (rect.x + rect.w === space.x + space.w) result.push("east");
  if (rect.y + rect.h === space.y + space.h) result.push("south");
  if (rect.x === space.x) result.push("west");
  return result;
}

function cellsInRect(rect: GridRect, byCell: Map<string, NavigationCell>, spaceId: string): NavigationCell[] | null {
  const cells: NavigationCell[] = [];
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      const cell = byCell.get(`${x},${y}`);
      if (!cell || cell.spaceId !== spaceId) return null;
      cells.push(cell);
    }
  }
  return cells;
}

/**
 * `side` is the prop's back side. The returned rectangle is therefore on the
 * opposite/front side and represents unobstructed interaction/use space.
 */
function approachRect(rect: GridRect, side: CardinalDirection, depth: number): GridRect | null {
  if (depth <= 0) return null;
  if (side === "north") return { x: rect.x, y: rect.y + rect.h, w: rect.w, h: depth };
  if (side === "south") return { x: rect.x, y: rect.y - depth, w: rect.w, h: depth };
  if (side === "west") return { x: rect.x + rect.w, y: rect.y, w: depth, h: rect.h };
  return { x: rect.x - depth, y: rect.y, w: depth, h: rect.h };
}

function clearanceCells(
  rect: GridRect,
  radius: number,
  byCell: Map<string, NavigationCell>,
  spaceId: string,
): NavigationCell[] | null {
  if (radius <= 0) return [];
  const expanded: GridRect = {
    x: rect.x - radius,
    y: rect.y - radius,
    w: rect.w + radius * 2,
    h: rect.h + radius * 2,
  };
  const all = cellsInRect(expanded, byCell, spaceId);
  if (!all) return null;
  return all.filter((cell) => !(cell.x >= rect.x && cell.x < rect.x + rect.w && cell.y >= rect.y && cell.y < rect.y + rect.h));
}

type RawCandidate = {
  rect: GridRect;
  wallSide: CardinalDirection | null;
  rotation: PropRotation;
  approachSide: CardinalDirection;
};

function wallCandidateRects(space: SpaceGeometry, request: CompiledPropRequest, availableSlotKeys: Set<string>) {
  const candidates: RawCandidate[] = [];
  const allowed = new Set(request.metadata.allowedRotations);

  const slotKey = (side: CardinalDirection, x: number, y: number) => `${space.id}:${side}:${x},${y}`;
  const wallExists = (side: CardinalDirection, rect: GridRect) => {
    if (side === "north" || side === "south") {
      const y = side === "north" ? rect.y : rect.y + rect.h - 1;
      for (let x = rect.x; x < rect.x + rect.w; x += 1) if (!availableSlotKeys.has(slotKey(side, x, y))) return false;
      return true;
    }
    const x = side === "west" ? rect.x : rect.x + rect.w - 1;
    for (let y = rect.y; y < rect.y + rect.h; y += 1) if (!availableSlotKeys.has(slotKey(side, x, y))) return false;
    return true;
  };

  for (const side of SIDES) {
    const rotation = wallSideRotation(side);
    // A perspective-sensitive wall prop may only be mounted where matching art exists.
    if (!allowed.has(rotation)) continue;
    const { w, h } = rotatedFootprint(request.metadata.footprintTiles, rotation);
    if (w > space.rect.w || h > space.rect.h) continue;

    if (side === "north" || side === "south") {
      const y = side === "north" ? space.rect.y : space.rect.y + space.rect.h - h;
      for (let x = space.rect.x; x <= space.rect.x + space.rect.w - w; x += 1) {
        const rect = { x, y, w, h };
        if (wallExists(side, rect)) candidates.push({ rect, wallSide: side, rotation, approachSide: side });
      }
    } else {
      const x = side === "west" ? space.rect.x : space.rect.x + space.rect.w - w;
      for (let y = space.rect.y; y <= space.rect.y + space.rect.h - h; y += 1) {
        const rect = { x, y, w, h };
        if (wallExists(side, rect)) candidates.push({ rect, wallSide: side, rotation, approachSide: side });
      }
    }
  }
  return candidates;
}

function floorCandidateRects(space: SpaceGeometry, request: CompiledPropRequest) {
  const candidates: RawCandidate[] = [];
  // Preserve author order but avoid duplicate orientations if malformed metadata repeats one.
  const rotations = [...new Set(request.metadata.allowedRotations)];

  for (const rotation of rotations) {
    const { w, h } = rotatedFootprint(request.metadata.footprintTiles, rotation);
    if (w > space.rect.w || h > space.rect.h) continue;
    for (let y = space.rect.y; y <= space.rect.y + space.rect.h - h; y += 1) {
      for (let x = space.rect.x; x <= space.rect.x + space.rect.w - w; x += 1) {
        const rect = { x, y, w, h };
        const touched = touchedSides(rect, space.rect);
        const preferred = request.preferredWall && touched.includes(request.preferredWall) ? request.preferredWall : touched[0] ?? null;
        candidates.push({
          rect,
          wallSide: preferred,
          rotation,
          // Floor props can also reserve a directional use-space. 0° has its back
          // to north and front/access to south, matching the wall-art convention.
          approachSide: rotationBackSide(rotation),
        });
      }
    }
  }
  return candidates;
}

function doorOppositeSides(navigation: NavigationCompilePlan, spaceId: string) {
  const result = new Set<CardinalDirection>();
  for (const connection of navigation.geometry.connections) {
    if (connection.kind === "opening") continue;
    if (connection.from === spaceId) result.add(sideOpposite(connection.fromSide));
    if (connection.to === spaceId) result.add(sideOpposite(connection.toSide));
  }
  return result;
}

function portalLinks(navigation: NavigationCompilePlan) {
  const links = new Set<string>();
  const canonical = (a: GridCell, b: GridCell) => {
    const ak = cellKey(a);
    const bk = cellKey(b);
    return ak < bk ? `${ak}|${bk}` : `${bk}|${ak}`;
  };
  for (const portal of navigation.portals) for (const pair of portal.pairs) links.add(canonical(pair.from, pair.to));
  return { links, canonical };
}

function preservesReachability(navigation: NavigationCompilePlan, blocked: Set<string>) {
  const free = navigation.walkableCells.filter((cell) => !blocked.has(cellKey(cell)));
  if (!free.length) return false;
  const byKey = new Map(free.map((cell) => [cellKey(cell), cell]));
  const { links, canonical } = portalLinks(navigation);
  const start = free[0];
  const visited = new Set<string>([cellKey(start)]);
  const queue = [start];

  while (queue.length) {
    const current = queue.shift()!;
    for (const delta of NEIGHBORS) {
      const next = byKey.get(`${current.x + delta.x},${current.y + delta.y}`);
      if (!next) continue;
      if (next.spaceId !== current.spaceId && !links.has(canonical(current, next))) continue;
      const key = cellKey(next);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push(next);
    }
  }

  for (const space of navigation.geometry.spaces) {
    const anyFree = free.find((cell) => cell.spaceId === space.id);
    if (!anyFree || !visited.has(cellKey(anyFree))) return false;
  }
  return true;
}

type InternalCandidate = {
  rect: GridRect;
  wallSide: CardinalDirection | null;
  rotation: PropRotation;
  approachSide: CardinalDirection;
  footprintCells: NavigationCell[];
  approachCells: NavigationCell[];
  clearanceCells: NavigationCell[];
  score: number;
  reasons: string[];
};

function candidateScore(
  request: CompiledPropRequest,
  instanceSeed: number,
  rect: GridRect,
  wallSide: CardinalDirection | null,
  rotation: PropRotation,
  space: SpaceGeometry,
  placements: PropPlacementDecision[],
  primaryOverlap: number,
) {
  const metadata = request.metadata.placement;
  const reasons: string[] = [];
  let score = 0;
  const touched = touchedSides(rect, space.rect);

  if (request.preferredWall) {
    if (touched.includes(request.preferredWall) || wallSide === request.preferredWall) {
      score += 80;
      reasons.push(`preferred wall ${request.preferredWall}`);
    } else score -= 20;
  }

  if (metadata.preferWallAdjacent && touched.length) {
    score += 25;
    reasons.push("wall-adjacent");
  }
  if (metadata.preferCorner && touched.length >= 2) {
    score += 18;
    reasons.push("corner");
  }
  if (metadata.preferRoomCenter) {
    const distance = manhattanRects(rect, space.rect);
    const value = Math.max(0, 90 - distance * 18);
    score += value;
    if (value > 0) reasons.push("room-center hero focus");
  }

  for (const targetId of request.near ?? []) {
    const targets = placements.filter((placement) => placement.requestId === targetId || placement.id === targetId);
    if (!targets.length) continue;
    const distance = Math.min(...targets.map((target) => manhattanRects(rect, target.rect)));
    const value = Math.max(0, 70 - distance * 10);
    score += value;
    reasons.push(`near ${targetId}`);
  }

  if (metadata.preferNearTags?.length) {
    const targets = placements.filter((placement) => placement.spaceId === request.spaceId && placement.tags.some((tag) => metadata.preferNearTags!.includes(tag)));
    if (targets.length) {
      const distance = Math.min(...targets.map((target) => manhattanRects(rect, target.rect)));
      const value = Math.max(0, 28 - distance * 4);
      score += value;
      if (value > 0) reasons.push(`near ${metadata.preferNearTags.join("/")}`);
    }
  }

  if (primaryOverlap > 0) {
    score -= primaryOverlap * 6;
    reasons.push(`hero reroutes ${primaryOverlap} primary cell${primaryOverlap === 1 ? "" : "s"}`);
  }

  // Rotation participates in the deterministic tie break. Equal geometry with
  // different valid art orientations therefore remains reproducible by seed.
  const tie = seededUnit(deriveSubSeed(instanceSeed, `candidate/${rect.x},${rect.y},${rect.w},${rect.h}/${wallSide ?? "floor"}/${rotation}`));
  score += tie * 0.01;
  return { score, reasons };
}

export function compilePropPlacement(navigation: NavigationCompilePlan): PropPlacementPlan {
  const semantic = navigation.geometry.semantic;
  const byCell = new Map(navigation.walkableCells.map((cell) => [cellKey(cell), cell]));
  const forbidden = new Map(navigation.forbiddenCells.map((cell) => [cellKey(cell), cell]));
  const primary = new Set(navigation.primaryPathCells.map(cellKey));
  const occupied = new Set<string>();
  const reserved = new Set<string>();
  const placements: PropPlacementDecision[] = [];
  const reservations: PlacementReservation[] = [];
  const diagnostics = [...navigation.diagnostics];
  const spaceById = new Map(navigation.geometry.spaces.map((space) => [space.id, space]));
  const slotKeys = new Set(navigation.wallAttachmentSlots.map((slot) => `${slot.spaceId}:${slot.side}:${slot.cell.x},${slot.cell.y}`));

  const expanded = semantic.props.flatMap((request, requestOrder) => {
    const role = request.role ?? "furniture";
    return Array.from({ length: request.quantity }, (_, instanceIndex) => ({ request, requestOrder, role, instanceIndex }));
  }).sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.requestOrder - b.requestOrder || a.instanceIndex - b.instanceIndex);

  for (const item of expanded) {
    const { request, role, instanceIndex } = item;
    const space = spaceById.get(request.spaceId);
    if (!space) throw new Error(`Placement request ${request.id} references missing geometry space ${request.spaceId}.`);
    const instanceId = request.quantity === 1 ? request.id : `${request.id}#${instanceIndex + 1}`;
    const instanceSeed = deriveSubSeed(request.seed, `instance/${instanceIndex + 1}`);
    const rejectedCounts: Record<string, number> = {};
    const reject = (code: string) => { rejectedCounts[code] = (rejectedCounts[code] ?? 0) + 1; };

    if (!request.metadata.allowedRotations.length) {
      throw new Error(`Prop ${request.propId} must declare at least one allowed rotation.`);
    }

    const rawCandidates = [
      ...(request.metadata.attachment === "wall" || request.metadata.attachment === "either" ? wallCandidateRects(space, request, slotKeys) : []),
      ...(request.metadata.attachment === "floor" || request.metadata.attachment === "either" ? floorCandidateRects(space, request) : []),
    ];
    const candidates: InternalCandidate[] = [];
    const oppositeDoorSides = doorOppositeSides(navigation, request.spaceId);

    for (const raw of rawCandidates) {
      const footprintCells = cellsInRect(raw.rect, byCell, request.spaceId);
      if (!footprintCells) { reject("outside-space"); continue; }
      const footprintKeys = footprintCells.map(cellKey);
      if (footprintKeys.some((key) => occupied.has(key))) { reject("occupied"); continue; }
      if (footprintKeys.some((key) => reserved.has(key))) { reject("reserved-use-space"); continue; }

      if (request.metadata.placement.forbidDoorClearance && footprintKeys.some((key) => forbidden.get(key)?.reasons.includes("door-clearance"))) {
        reject("door-clearance");
        continue;
      }
      const primaryOverlap = footprintKeys.filter((key) => primary.has(key)).length;
      if (request.metadata.placement.forbidPrimaryPath && role !== "hero" && primaryOverlap) {
        reject("primary-circulation");
        continue;
      }

      const approachDepth = request.metadata.placement.approachDepthTiles ?? 0;
      let approachCells: NavigationCell[] = [];
      if (approachDepth > 0) {
        const rect = approachRect(raw.rect, raw.approachSide, approachDepth);
        approachCells = rect ? cellsInRect(rect, byCell, request.spaceId) ?? [] : [];
        if (!rect || !approachCells.length || approachCells.length !== rect.w * rect.h) { reject("approach-outside-space"); continue; }
        const keys = approachCells.map(cellKey);
        if (keys.some((key) => occupied.has(key) || reserved.has(key))) { reject("approach-blocked"); continue; }
        if (keys.some((key) => forbidden.get(key)?.reasons.includes("door-clearance"))) { reject("approach-door-clearance"); continue; }
      }

      const clearanceRadius = request.metadata.placement.clearanceAroundTiles ?? 0;
      const heroClearance = clearanceCells(raw.rect, clearanceRadius, byCell, request.spaceId);
      if (heroClearance === null) { reject("clearance-outside-space"); continue; }
      const clearanceKeys = heroClearance.map(cellKey);
      if (clearanceKeys.some((key) => occupied.has(key) || reserved.has(key))) { reject("clearance-blocked"); continue; }
      if (clearanceKeys.some((key) => forbidden.get(key)?.reasons.includes("door-clearance"))) { reject("clearance-door-overlap"); continue; }

      if (role === "hero") {
        const trial = new Set(occupied);
        footprintKeys.forEach((key) => trial.add(key));
        if (!preservesReachability(navigation, trial)) { reject("blocks-reachability"); continue; }
      }

      const scored = candidateScore(request, instanceSeed, raw.rect, raw.wallSide, raw.rotation, space, placements, primaryOverlap);
      let score = scored.score;
      const reasons = [...scored.reasons, `rotation ${raw.rotation}° allowed`, `footprint ${raw.rect.w}×${raw.rect.h}`];
      const touched = touchedSides(raw.rect, space.rect);
      if (request.metadata.placement.preferOppositeDoor && touched.some((side) => oppositeDoorSides.has(side))) {
        score += 55;
        reasons.push("opposite door");
      }

      candidates.push({
        rect: raw.rect,
        wallSide: raw.wallSide,
        rotation: raw.rotation,
        approachSide: raw.approachSide,
        footprintCells,
        approachCells,
        clearanceCells: heroClearance,
        score,
        reasons,
      });
    }

    candidates.sort((a, b) => b.score - a.score);
    const chosen = candidates[0];
    if (!chosen) {
      const summary = Object.entries(rejectedCounts).sort((a, b) => b[1] - a[1]).map(([reason, count]) => `${reason}:${count}`).join(", ") || "no geometric candidates";
      if (request.required) throw new Error(`Required prop ${instanceId} could not be placed in ${request.spaceId} (${summary}).`);
      diagnostics.push({ level: "warning", code: "OPTIONAL_PROP_UNPLACED", targetId: instanceId, message: `Optional prop ${instanceId} was not placed (${summary}).` });
      continue;
    }

    const decision: PropPlacementDecision = {
      id: instanceId,
      requestId: request.id,
      instanceIndex,
      propId: request.propId,
      spaceId: request.spaceId,
      role,
      tags: [...request.metadata.tags],
      rotation: chosen.rotation,
      rect: chosen.rect,
      wallSide: chosen.wallSide,
      footprintCells: chosen.footprintCells,
      approachCells: chosen.approachCells,
      clearanceCells: chosen.clearanceCells,
      score: chosen.score,
      reasons: chosen.reasons.length ? chosen.reasons : ["best valid deterministic candidate"],
      candidateCount: candidates.length,
      rejectedCounts,
    };
    placements.push(decision);
    decision.footprintCells.forEach((cell) => occupied.add(cellKey(cell)));

    for (const cell of decision.approachCells) {
      const key = cellKey(cell);
      reserved.add(key);
      reservations.push({ ...cell, kind: "approach", ownerPlacementId: decision.id });
    }
    for (const cell of decision.clearanceCells) {
      const key = cellKey(cell);
      if (reserved.has(key)) continue;
      reserved.add(key);
      reservations.push({ ...cell, kind: "hero-clearance", ownerPlacementId: decision.id });
    }
  }

  const occupiedCells = navigation.walkableCells.filter((cell) => occupied.has(cellKey(cell)));
  diagnostics.push({
    level: "info",
    code: "PROP_PLACEMENT_COMPLETE",
    message: `Placed ${placements.length} prop instance(s); reserved ${reservations.length} approach/hero-clearance cell(s).`,
  });
  diagnostics.push({
    level: "info",
    code: "ROTATED_FOOTPRINTS_SOLVED",
    message: `Solved physical footprints and use-space for ${placements.length} prop rotation(s) during candidate placement.`,
  });

  return { navigation, placements, occupiedCells, reservations, diagnostics };
}
