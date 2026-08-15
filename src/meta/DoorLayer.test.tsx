import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FloorDefinition } from "../game/types";
import doorCss from "./DoorLayer.css?raw";
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
  it("wraps moving leaves in a dedicated aperture clip and renders no status text", () => {
    const html = renderToStaticMarkup(
      <DoorLayer floor={floor} openDoorIds={new Set(["transfer-threshold"])} accessKeyIds={[]} />,
    );
    expect(html).toContain("leaf-clip");
    expect(html).toContain("panel-a");
    expect(html).toContain("panel-b");
    expect(html).not.toContain("ZUTEILUNG");
    expect(html).not.toContain("OPEN");
  });

  it("clips the Transfer Hall leaf container at the exact door aperture", () => {
    expect(doorCss).toMatch(/data-floor-id="transfer-hall"[^}]*\.zk-door \.leaf-clip\s*\{[^}]*overflow:hidden;/s);
  });
});
