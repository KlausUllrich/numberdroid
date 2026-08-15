import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FloorDefinition } from "../game/types";
import { DoorLayer } from "./DoorLayer";

const floor: FloorDefinition = {
  id: "transfer-hall",
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

describe("Transfer Hall Door visual contract", () => {
  it("clips moving leaves at the aperture and renders no status text", () => {
    const html = renderToStaticMarkup(
      <DoorLayer floor={floor} openDoorIds={new Set(["transfer-threshold"])} accessKeyIds={[]} />,
    );
    expect(html).toContain("leaf-clip");
    expect(html).toContain("overflow:hidden");
    expect(html).toContain("panel-a");
    expect(html).toContain("panel-b");
    expect(html).not.toContain("ZUTEILUNG");
    expect(html).not.toContain("OPEN");
  });
});
