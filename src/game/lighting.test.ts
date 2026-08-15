import { describe, expect, it } from "vitest";
import { lightingForFloor } from "./lighting";
import { TRANSFER_HALL_MAP } from "./maps/transferHall";

const TILE = 64;

describe("TS-01 Layout v3 light overlay contract", () => {
  it("clips the warm CORE light to the south Transfer room", () => {
    const lighting = lightingForFloor("transfer-hall")!;
    expect(lighting.zones).toHaveLength(1);
    const zone = lighting.zones[0];
    expect(zone.id).toBe("transfer-room");
    expect(zone.x).toBe(8 * TILE + 30);
    expect(zone.y).toBe(14 * TILE + 30);
    expect(zone.w).toBe(11 * TILE - 60);
    expect(zone.h).toBe(6 * TILE - 60);
  });

  it("keeps the Transfer source inside its destination-room occlusion zone", () => {
    const lighting = lightingForFloor("transfer-hall")!;
    const zone = lighting.zones.find((entry) => entry.id === "transfer-room")!;
    const light = lighting.lights.find((entry) => entry.id === "transfer-core")!;
    expect(light.zoneId).toBe(zone.id);
    expect(light.x).toBe(12.5 * TILE);
    expect(light.y).toBe(16.5 * TILE);
    expect(light.x).toBeGreaterThan(zone.x);
    expect(light.x).toBeLessThan(zone.x + zone.w);
    expect(light.y).toBeGreaterThan(zone.y);
    expect(light.y).toBeLessThan(zone.y + zone.h);
  });

  it("does not encode scene illumination as a FloorFX tile", () => {
    const floorFx = TRANSFER_HALL_MAP.layers.find((layer): layer is any => layer.type === "tilelayer" && layer.name === "FloorFX")!;
    expect((floorFx.data as number[]).includes(97)).toBe(false);
  });
});
