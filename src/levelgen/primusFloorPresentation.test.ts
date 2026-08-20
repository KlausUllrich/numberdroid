import { describe, expect, it } from "vitest";
import { TS01_GENERATED_FLOOR, TS01_GENERATED_PLAN } from "./generatedTs01Preview";
import { primusFloorSprites } from "./primusFloorPresentation";
import { PRIMUS_FLOOR_TILE_METADATA } from "./primusFloorTileMetadata";

describe("TS-01 PRIMUS floor presentation", () => {
  function primusRoom() {
    const geometry = TS01_GENERATED_PLAN.events.actors.props.navigation.geometry;
    const semanticSpaces = new Map(geometry.semantic.spaces.map((space) => [space.id, space]));
    return geometry.spaces.find((space) => {
      const semantic = semanticSpaces.get(space.id);
      return space.kind === "room"
        && semantic?.kind === "room"
        && (semantic.archetype === "primus-allocation" || semantic.rationality === "system");
    });
  }

  it("fits complete 2x2 macros exactly inside a one-tile calm perimeter", () => {
    const room = primusRoom();
    expect(room).toBeDefined();
    if (!room) return;
    expect(room.rect.w).toBe(10);
    expect(room.rect.h).toBe(8);
    expect((room.rect.w - 2) % 2).toBe(0);
    expect((room.rect.h - 2) % 2).toBe(0);

    const bounds = TS01_GENERATED_PLAN.events.actors.props.navigation.bounds;
    const first = primusFloorSprites(TS01_GENERATED_PLAN);
    const second = primusFloorSprites(TS01_GENERATED_PLAN);
    expect(first).toEqual(second);

    const macros = first.filter((sprite) => sprite.id.startsWith("primus-floor:macro:"));
    const wallFringe = first.filter((sprite) => sprite.id.startsWith("primus-floor:wall-fringe:"));
    expect(macros).toHaveLength(((room.rect.w - 2) / 2) * ((room.rect.h - 2) / 2));
    expect(wallFringe).toHaveLength(2 * room.rect.w + 2 * room.rect.h - 4);

    const covered = new Set<string>();
    for (const sprite of macros) {
      expect(sprite.width).toBe(128);
      expect(sprite.height).toBe(128);
      expect([0, 180]).toContain(sprite.rotation ?? 0);
      expect(sprite.asset).toMatch(/primus-macro-[ab]\.svg$/);
      const x0 = sprite.x / 64 + bounds.x;
      const y0 = sprite.y / 64 + bounds.y;
      expect(x0).toBeGreaterThanOrEqual(room.rect.x + 1);
      expect(y0).toBeGreaterThanOrEqual(room.rect.y + 1);
      expect(x0 + 1).toBeLessThan(room.rect.x + room.rect.w - 1);
      expect(y0 + 1).toBeLessThan(room.rect.y + room.rect.h - 1);
      for (let dy = 0; dy < 2; dy += 1) {
        for (let dx = 0; dx < 2; dx += 1) {
          const cell = `${x0 + dx},${y0 + dy}`;
          expect(covered.has(cell)).toBe(false);
          covered.add(cell);
        }
      }
    }

    const right = room.rect.x + room.rect.w - 1;
    const bottom = room.rect.y + room.rect.h - 1;
    for (const sprite of wallFringe) {
      expect(sprite.width).toBe(64);
      expect(sprite.height).toBe(64);
      expect(sprite.asset).toMatch(/primus-fringe\.svg$/);
      const x = sprite.x / 64 + bounds.x;
      const y = sprite.y / 64 + bounds.y;
      expect(x === room.rect.x || x === right || y === room.rect.y || y === bottom).toBe(true);
      const cell = `${x},${y}`;
      expect(covered.has(cell)).toBe(false);
      covered.add(cell);
    }

    expect(covered.size).toBe(room.rect.w * room.rect.h);
  });

  it("renders the calm perimeter before threshold/service semantics", () => {
    const room = primusRoom();
    expect(room).toBeDefined();
    if (!room) return;
    const sprites = primusFloorSprites(TS01_GENERATED_PLAN);
    const lastWallFringe = sprites.reduce((index, sprite, current) => (
      sprite.id.startsWith("primus-floor:wall-fringe:") ? current : index
    ), -1);
    const thresholdIndex = sprites.findIndex((sprite) => sprite.id.startsWith("primus-floor:threshold:"));
    const serviceIndex = sprites.findIndex((sprite) => sprite.id.startsWith("primus-floor:service-approach:"));
    expect(thresholdIndex).toBeGreaterThan(lastWallFringe);
    expect(serviceIndex).toBeGreaterThan(lastWallFringe);
  });

  it("stores multi-cell semantic metadata rather than per-quadrant visual guesses", () => {
    expect(new Set(PRIMUS_FLOOR_TILE_METADATA.map((entry) => entry.id)).size).toBe(PRIMUS_FLOOR_TILE_METADATA.length);
    const macros = PRIMUS_FLOOR_TILE_METADATA.filter((entry) => entry.role === "macro");
    expect(macros).toHaveLength(2);
    for (const entry of macros) {
      expect(entry.spanTiles).toEqual({ w: 2, h: 2 });
      expect(entry.continuityProfile).toBe("primus-macro-2x2");
      expect(entry.runtimeEligible).toBe(true);
    }
    expect(PRIMUS_FLOOR_TILE_METADATA.find((entry) => entry.role === "maintenance")?.runtimeEligible).toBe(false);
  });

  it("uses the real Hall connection as one authored 1x2 west threshold", () => {
    const room = primusRoom();
    expect(room).toBeDefined();
    if (!room) return;
    const sprites = primusFloorSprites(TS01_GENERATED_PLAN);
    const threshold = sprites.filter((sprite) => sprite.id.startsWith("primus-floor:threshold:"));
    expect(threshold).toHaveLength(1);
    expect(threshold[0].width).toBe(64);
    expect(threshold[0].height).toBe(128);
    expect(threshold[0].asset).toMatch(/primus-threshold-west\.svg$/);
  });

  it("places exactly one whole approach overlay per real primus-service-bank", () => {
    const room = primusRoom();
    expect(room).toBeDefined();
    if (!room) return;
    const bounds = TS01_GENERATED_PLAN.events.actors.props.navigation.bounds;
    const placements = TS01_GENERATED_PLAN.events.actors.props.placements.filter((placement) => (
      placement.spaceId === room.id && placement.propId === "primus-service-bank"
    ));
    const service = primusFloorSprites(TS01_GENERATED_PLAN).filter((sprite) => sprite.id.startsWith("primus-floor:service-approach:"));
    expect(service).toHaveLength(placements.length);

    for (const placement of placements) {
      const sprite = service.find((entry) => entry.id.endsWith(placement.id));
      expect(sprite).toBeDefined();
      if (!sprite) continue;
      const minX = Math.min(...placement.approachCells.map((cell) => cell.x));
      const minY = Math.min(...placement.approachCells.map((cell) => cell.y));
      expect(sprite.x / 64 + bounds.x).toBe(minX);
      expect(sprite.y / 64 + bounds.y).toBe(minY);
      expect((sprite.width / 64) * (sprite.height / 64)).toBe(2);
      expect(sprite.asset).toMatch(/primus-service-approach-(?:horizontal|vertical)\.svg$/);
    }
  });

  it("keeps reserved/invented semantics out of runtime", () => {
    const sprites = primusFloorSprites(TS01_GENERATED_PLAN);
    expect(sprites.some((sprite) => sprite.id.startsWith("primus-floor:maintenance:"))).toBe(false);
    expect(sprites.some((sprite) => /maint|work-slot|01|02|03/i.test(sprite.asset))).toBe(false);
  });

  it("renders all PRIMUS surfaces before existing grounding shadows", () => {
    expect(TS01_GENERATED_FLOOR.visual.kind).toBe("composite");
    if (TS01_GENERATED_FLOOR.visual.kind !== "composite") return;
    const floorFx = TS01_GENERATED_FLOOR.visual.layers.find((layer) => layer.id === "floor-fx");
    expect(floorFx?.kind).toBe("sprites");
    if (floorFx?.kind !== "sprites") return;
    const firstShadow = floorFx.sprites.findIndex((sprite) => sprite.id.startsWith("shadow:"));
    const lastPrimus = floorFx.sprites.reduce((index, sprite, current) => (
      sprite.id.startsWith("primus-floor:") ? current : index
    ), -1);
    expect(lastPrimus).toBeGreaterThanOrEqual(0);
    expect(firstShadow).toBeGreaterThan(lastPrimus);
  });
});
