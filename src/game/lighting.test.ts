import { describe, expect, it } from "vitest";
import { lightingForFloor } from "./lighting";
import { TRANSFER_HALL_MAP } from "./maps/transferHall";

const TILE = 64;

describe("Transfer Hall light overlay contract", () => {
  it("clips room light to wall faces instead of bleeding through the divider", () => {
    const lighting = lightingForFloor("transfer-hall")!;
    const left = lighting.zones.find((zone) => zone.id === "transfer-left")!;
    const right = lighting.zones.find((zone) => zone.id === "primus-right")!;
    expect(left.x + left.w).toBe(12.4375 * TILE);
    expect(right.x).toBe(12.5625 * TILE);
    expect(right.x - (left.x + left.w)).toBe(8);
  });

  it("keeps the Transfer source in its left-room occlusion zone", () => {
    const lighting = lightingForFloor("transfer-hall")!;
    const zone = lighting.zones.find((entry) => entry.id === "transfer-left")!;
    const light = lighting.lights.find((entry) => entry.id === "transfer-core")!;
    expect(light.zoneId).toBe(zone.id);
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
