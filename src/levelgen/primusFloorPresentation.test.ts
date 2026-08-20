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

  it("covers every PRIMUS room cell exactly once with deterministic semantic tiles", () => {
    const room = primusRoom();
    expect(room).toBeDefined();
    if (!room) return;

    const first = primusFloorSprites(TS01_GENERATED_PLAN);
    const second = primusFloorSprites(TS01_GENERATED_PLAN);
    expect(first).toEqual(second);
    expect(first).toHaveLength(room.rect.w * room.rect.h);
    expect(new Set(first.map((sprite) => `${sprite.x},${sprite.y}`)).size).toBe(first.length);

    for (const sprite of first) {
      expect(sprite.width).toBe(64);
      expect(sprite.height).toBe(64);
      expect([0, 90]).toContain(sprite.rotation ?? 0);
      expect(sprite.asset).toMatch(/assets\/deck\/primus-floor\/primus-[a-z0-9-]+\.svg$/);
    }
  });

  it("keeps generated-atlas ideas behind explicit runtime metadata", () => {
    expect(PRIMUS_FLOOR_TILE_METADATA.length).toBeGreaterThanOrEqual(15);
    expect(new Set(PRIMUS_FLOOR_TILE_METADATA.map((tile) => tile.id)).size).toBe(PRIMUS_FLOOR_TILE_METADATA.length);

    for (const tile of PRIMUS_FLOOR_TILE_METADATA.filter((entry) => entry.role === "macro")) {
      expect(tile.continuityProfile).toBe("primus-macro-2x2");
      expect(tile.macroVariant).toMatch(/^[ab]$/);
      expect(tile.macroPhase).toMatch(/^(nw|ne|sw|se)$/);
    }

    for (const tile of PRIMUS_FLOOR_TILE_METADATA.filter((entry) => entry.role === "maintenance")) {
      expect(tile.runtimeEligible).toBe(false);
    }
  });

  it("uses the real controlled Hall connection as one 2-cell west threshold pair", () => {
    const geometry = TS01_GENERATED_PLAN.events.actors.props.navigation.geometry;
    const room = primusRoom();
    expect(room).toBeDefined();
    if (!room) return;

    const semanticSpaces = new Map(geometry.semantic.spaces.map((space) => [space.id, space]));
    const connection = geometry.connections.find((candidate) => {
      if (candidate.from !== room.id && candidate.to !== room.id) return false;
      const otherId = candidate.from === room.id ? candidate.to : candidate.from;
      return semanticSpaces.get(otherId)?.kind === "corridor";
    });
    expect(connection).toBeDefined();
    if (!connection) return;

    const side = connection.from === room.id ? connection.fromSide : connection.toSide;
    expect(side).toBe("west");
    expect(connection.apertureLength).toBe(2);

    const thresholds = primusFloorSprites(TS01_GENERATED_PLAN).filter((sprite) => sprite.id.startsWith("primus-floor:threshold:"));
    expect(thresholds).toHaveLength(2);
    expect(thresholds.map((sprite) => sprite.asset).sort()).toEqual([
      expect.stringMatching(/primus-threshold-west-lower\.svg$/),
      expect.stringMatching(/primus-threshold-west-upper\.svg$/),
    ].sort());
  });

  it("places service markings only on actual primus-service-bank approach cells", () => {
    const geometry = TS01_GENERATED_PLAN.events.actors.props.navigation.geometry;
    const bounds = geometry.bounds;
    const room = primusRoom();
    expect(room).toBeDefined();
    if (!room) return;

    const placements = TS01_GENERATED_PLAN.events.actors.props.placements.filter((placement) => (
      placement.spaceId === room.id && placement.propId === "primus-service-bank"
    ));
    expect(placements).toHaveLength(2);

    const expected = new Set(placements.flatMap((placement) => placement.approachCells.map((cell) => `${cell.x},${cell.y}`)));
    const service = primusFloorSprites(TS01_GENERATED_PLAN).filter((sprite) => sprite.id.startsWith("primus-floor:service-approach:"));
    const actual = new Set(service.map((sprite) => `${sprite.x / 64 + bounds.x},${sprite.y / 64 + bounds.y}`));

    expect(actual).toEqual(expected);
    expect(service).toHaveLength(expected.size);
    for (const sprite of service) {
      expect(sprite.asset).toMatch(/primus-service-approach-(?:left|right)\.svg$/);
    }
  });

  it("uses complete 2x2 macro variants instead of random per-cell material swaps", () => {
    const room = primusRoom();
    expect(room).toBeDefined();
    if (!room) return;
    const bounds = TS01_GENERATED_PLAN.events.actors.props.navigation.bounds;
    const sprites = primusFloorSprites(TS01_GENERATED_PLAN);
    const byCell = new Map(sprites.map((sprite) => [`${sprite.x / 64 + bounds.x},${sprite.y / 64 + bounds.y}`, sprite]));

    for (let localY = 0; localY + 1 < room.rect.h; localY += 2) {
      for (let localX = 0; localX + 1 < room.rect.w; localX += 2) {
        const cells = [
          byCell.get(`${room.rect.x + localX},${room.rect.y + localY}`),
          byCell.get(`${room.rect.x + localX + 1},${room.rect.y + localY}`),
          byCell.get(`${room.rect.x + localX},${room.rect.y + localY + 1}`),
          byCell.get(`${room.rect.x + localX + 1},${room.rect.y + localY + 1}`),
        ];
        // Semantic threshold/service cells may deliberately replace part of a macro.
        if (cells.some((sprite) => !sprite || !sprite.id.startsWith("primus-floor:macro:"))) continue;
        const variants = new Set(cells.map((sprite) => sprite?.asset.match(/primus-base-([ab])-/)?.[1]));
        expect(variants.size).toBe(1);
      }
    }
  });

  it("does not auto-place reserved maintenance or invented text/work-slot semantics", () => {
    const sprites = primusFloorSprites(TS01_GENERATED_PLAN);
    expect(sprites.some((sprite) => sprite.id.startsWith("primus-floor:maintenance:"))).toBe(false);
    expect(sprites.some((sprite) => /maint|work-slot|01|02|03/i.test(sprite.asset))).toBe(false);
  });

  it("renders PRIMUS material before grounding shadows without changing layer ownership", () => {
    expect(TS01_GENERATED_FLOOR.visual.kind).toBe("composite");
    if (TS01_GENERATED_FLOOR.visual.kind !== "composite") return;

    const floorFx = TS01_GENERATED_FLOOR.visual.layers.find((layer) => layer.id === "floor-fx");
    expect(floorFx?.kind).toBe("sprites");
    if (floorFx?.kind !== "sprites") return;

    const primusSprites = floorFx.sprites.filter((sprite) => sprite.id.startsWith("primus-floor:"));
    const firstShadow = floorFx.sprites.findIndex((sprite) => sprite.id.startsWith("shadow:"));
    const lastPrimus = floorFx.sprites.reduce(
      (index, sprite, current) => (sprite.id.startsWith("primus-floor:") ? current : index),
      -1,
    );

    expect(primusSprites.length).toBeGreaterThan(0);
    expect(firstShadow).toBeGreaterThan(lastPrimus);
    expect(TS01_GENERATED_FLOOR.visual.layers.map((layer) => layer.id)).toEqual([
      "ground",
      "floor-fx",
      "architecture",
      "wall-prop-blockouts",
      "wall-props",
      "floor-prop-blockouts",
      "floor-props",
      "transfer-fx",
    ]);
  });
});
