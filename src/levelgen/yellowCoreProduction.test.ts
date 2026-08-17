import { describe, expect, it } from "vitest";
import { TS01_GENERATED_FLOOR } from "./generatedTs01Preview";
import { YELLOW_CORE_RUNTIME_CANDIDATE } from "./transferFxPresentation";

describe("TS-01 Yellow Core production candidate", () => {
  it("keeps the Core separate from Prop geometry and centers it on the Transfer Apparatus", () => {
    expect(TS01_GENERATED_FLOOR.visual.kind).toBe("composite");
    if (TS01_GENERATED_FLOOR.visual.kind !== "composite") throw new Error("TS-01 preview must be composite");

    const layers = TS01_GENERATED_FLOOR.visual.layers;
    const propLayer = layers.find((layer) => layer.id === "floor-props");
    const fxLayer = layers.find((layer) => layer.id === "transfer-fx");
    expect(propLayer?.kind).toBe("sprites");
    expect(fxLayer?.kind).toBe("sprites");
    if (propLayer?.kind !== "sprites" || fxLayer?.kind !== "sprites") throw new Error("Expected Prop and Transfer FX sprite layers");

    const apparatus = propLayer.sprites.find((sprite) => sprite.id === "transfer-core");
    const core = fxLayer.sprites.find((sprite) => sprite.id === "yellow-core");
    expect(apparatus).toBeDefined();
    expect(core).toBeDefined();
    if (!apparatus || !core) throw new Error("Expected Transfer Apparatus and Yellow Core sprites");

    expect(core.asset).toMatch(/assets\/deck\/yellow-core\.png$/);
    expect(core.width).toBe(YELLOW_CORE_RUNTIME_CANDIDATE.widthPx);
    expect(core.height).toBe(YELLOW_CORE_RUNTIME_CANDIDATE.heightPx);
    expect(core.x + core.width / 2).toBe(apparatus.x + apparatus.width / 2);
    expect(core.y + core.height / 2).toBe(apparatus.y + apparatus.height / 2);

    // FX must render after the physical Prop so the glowing identity module is
    // visible on its platform without becoming part of Prop collision.
    expect(layers.indexOf(fxLayer)).toBeGreaterThan(layers.indexOf(propLayer));
  });
});
