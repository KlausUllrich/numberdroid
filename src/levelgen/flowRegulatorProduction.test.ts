import { describe, expect, it } from "vitest";
import { TS01_GENERATED_FLOOR } from "./generatedTs01Preview";
import { propArtRegistration } from "./propArtRegistry";

describe("TS-01 Flow Regulator production candidate", () => {
  it("replaces the flow-station blockout without changing its 2x2 semantic reservation", () => {
    const registration = propArtRegistration("flow-station");
    expect(registration).toMatchObject({
      propId: "flow-station",
      asset: "assets/deck/flow-regulator.png",
      status: "candidate",
    });

    expect(TS01_GENERATED_FLOOR.visual.kind).toBe("composite");
    if (TS01_GENERATED_FLOOR.visual.kind !== "composite") throw new Error("TS-01 preview must be composite");

    const floorProps = TS01_GENERATED_FLOOR.visual.layers.find((layer) => layer.id === "floor-props");
    expect(floorProps?.kind).toBe("sprites");
    if (floorProps?.kind !== "sprites") throw new Error("Expected Floor Prop sprite layer");

    const flow = floorProps.sprites.find((sprite) => sprite.id === "transfer-flow");
    expect(flow).toBeDefined();
    if (!flow) throw new Error("Expected transfer-flow sprite");

    expect(flow.asset).toMatch(/assets\/deck\/flow-regulator\.png$/);
    expect(flow.width).toBe(128);
    expect(flow.height).toBe(128);
  });
});
