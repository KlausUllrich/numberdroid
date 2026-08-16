import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FloorDefinition } from "../game/types";
import { DoorLayer, GOLD_SLICE_DOOR_TIMING, usesGoldSliceDoorPresentation } from "./DoorLayer";

function floor(id: string): FloorDefinition {
  return {
    id,
    name: "TS-01",
    subtitle: "TEST",
    width: 1280,
    height: 768,
    visual: { kind: "image", asset: "" },
    start: { x: 0, y: 0, facing: 0, bodyId: "pico", metaEnergy: 0 },
    objectives: { default: "", afterEnergy: "" },
    walkable: [],
    obstacles: [],
    rooms: [],
    doors: [{
      id: "transfer-threshold",
      x: 768,
      y: 320,
      w: 64,
      h: 128,
      orientation: "vertical",
      mode: "auto",
      size: "large",
      openRadius: 150,
      label: "ZUTEILUNG",
    }],
    pickups: [],
    actions: [],
    energyStations: [],
    encounters: [],
  };
}

function renderDoor(floorId: string) {
  return renderToStaticMarkup(
    <DoorLayer floor={floor(floorId)} openDoorIds={new Set(["transfer-threshold"])} accessKeyIds={[]} />,
  );
}

describe("Transfer Hall Gold Slice Door visual contract", () => {
  it("is explicitly shared by hand-authored and compiler-generated TS-01", () => {
    expect(usesGoldSliceDoorPresentation("transfer-hall")).toBe(true);
    expect(usesGoldSliceDoorPresentation("ts01-transfer-hall")).toBe(true);
    expect(usesGoldSliceDoorPresentation("deck-b2")).toBe(false);
    expect(GOLD_SLICE_DOOR_TIMING).toEqual({ openMs: 520, closeMs: 650 });
  });

  for (const floorId of ["transfer-hall", "ts01-transfer-hall"]) {
    it(`${floorId} clips moving leaves, uses accepted timing and renders no status text`, () => {
      const html = renderDoor(floorId);
      expect(html).toContain("gold-slice");
      expect(html).toContain("leaf-clip");
      expect(html).toContain("overflow:hidden");
      expect(html).toContain("panel-a");
      expect(html).toContain("panel-b");
      expect(html).toContain("--door-open-duration:520ms");
      expect(html).toContain("--door-close-duration:650ms");
      expect(html).not.toContain("ZUTEILUNG");
      expect(html).not.toContain("OPEN");
    });
  }

  it("keeps unrelated Floors on the generic door presentation", () => {
    const html = renderDoor("deck-b2");
    expect(html).toContain("generic");
    expect(html).not.toContain("gold-slice");
    // Generic doors still expose status text; this fixture is rendered open.
    expect(html).toContain("OPEN");
  });
});
