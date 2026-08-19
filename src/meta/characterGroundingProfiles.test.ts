import { describe, expect, it } from "vitest";
import grounding from "./characterGroundingProfiles.json";

const EXPECTED_DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const EXPECTED_PICO_FOOT_Y = [86, 86, 87, 87, 89, 92, 92, 92];
const EXPECTED_PICO_PRESENTATION_OFFSET_Y = [-2, -2, 0, -1, 0, 0, 0, -3];
const EXPECTED_PICO_SHADOW_OFFSET_Y = [0, 0, -3, -2, -2, -3, -3, 2];
const EXPECTED_PICO_COMBINED_RENDER_OFFSET_Y = [-2, -2, -3, -3, -2, -3, -3, -1];

describe("CharacterGrounding profiles", () => {
  it("tracks the connected eight-direction PICO runtime foot planes", () => {
    const pico = grounding.profiles.pico;
    expect(pico.sourceFrameSize).toBe(96);
    expect(pico.directions.map((direction) => direction.name)).toEqual(EXPECTED_DIRECTIONS);
    expect(pico.directions.map((direction) => direction.footY)).toEqual(EXPECTED_PICO_FOOT_Y);
  });

  it("keeps pose calibration separate from the explicit human-QA shadow delta", () => {
    const pico = grounding.profiles.pico;
    const presentation = pico.directions.map((direction) => direction.presentationOffsetY ?? 0);
    const shadow = pico.directions.map((direction) => direction.shadowOffsetY ?? 0);
    expect(presentation).toEqual(EXPECTED_PICO_PRESENTATION_OFFSET_Y);
    expect(shadow).toEqual(EXPECTED_PICO_SHADOW_OFFSET_Y);
    expect(presentation.map((value, index) => value + shadow[index])).toEqual(EXPECTED_PICO_COMBINED_RENDER_OFFSET_Y);
    for (const direction of pico.directions) {
      expect(Math.abs(direction.presentationOffsetY ?? 0)).toBeLessThanOrEqual(3);
      expect(Math.abs(direction.shadowOffsetY ?? 0)).toBeLessThanOrEqual(3);
    }
  });

  it("applies the manual QA ambient deltas relative to the connected foot planes", () => {
    const pico = grounding.profiles.pico;
    expect(pico.ambient.width).toBe(92);
    expect(pico.ambient.height).toBe(23);
    expect(pico.ambient.offsetYFromFoot).toBe(-5);
    expect("offsetYFromContactMean" in pico.ambient).toBe(false);

    const renderedAmbientAnchors = pico.directions.map(
      (direction) => direction.footY + pico.ambient.offsetYFromFoot + (direction.shadowOffsetY ?? 0),
    );
    expect(renderedAmbientAnchors).toEqual([81, 81, 79, 80, 82, 84, 84, 89]);
  });

  it("applies the requested NE contact move and 15 percent contact enlargement", () => {
    const pico = grounding.profiles.pico;
    expect(pico.contactDefaults.radiusX).toBeCloseTo(5.5 * 1.15, 6);
    expect(pico.contactDefaults.radiusY).toBeCloseTo(3 * 1.15, 6);
    expect(pico.directions[1].name).toBe("NE");
    expect(pico.directions[1].contacts[0].x).toBe(37.5);
    expect(pico.directions[2].contacts[0].radiusX).toBeCloseTo(7 * 1.15, 6);
    expect(pico.directions[6].contacts[0].radiusX).toBeCloseTo(7 * 1.15, 6);
  });

  it("uses only the connected NW support instead of the rejected floating source fragment", () => {
    const nw = grounding.profiles.pico.directions[7];
    expect(nw.name).toBe("NW");
    expect(nw.footY).toBe(92);
    expect(nw.contacts).toEqual([{ x: 42.5, y: 92, opacity: 0.78 }]);
  });

  it("keeps all PICO contact geometry inside the authoritative source frame", () => {
    const pico = grounding.profiles.pico;
    for (const direction of pico.directions) {
      expect(direction.contacts.length).toBeGreaterThanOrEqual(1);
      expect(direction.contacts.length).toBeLessThanOrEqual(2);
      expect(direction.footY).toBeGreaterThanOrEqual(0);
      expect(direction.footY).toBeLessThan(pico.sourceFrameSize);

      for (const contact of direction.contacts) {
        expect(contact.x).toBeGreaterThanOrEqual(0);
        expect(contact.x).toBeLessThan(pico.sourceFrameSize);
        expect(contact.y).toBeGreaterThanOrEqual(75);
        expect(contact.y).toBeLessThan(pico.sourceFrameSize);
        expect(Math.abs(contact.y - direction.footY)).toBeLessThanOrEqual(6);
      }
    }
  });

  it("uses one contact for pure side views instead of inventing a detached second point", () => {
    const pico = grounding.profiles.pico;
    expect(pico.directions[2].name).toBe("E");
    expect(pico.directions[2].contacts).toHaveLength(1);
    expect(pico.directions[6].name).toBe("W");
    expect(pico.directions[6].contacts).toHaveLength(1);
  });

  it("keeps ambient grounding restrained relative to the 96px source frame", () => {
    const pico = grounding.profiles.pico;
    expect(pico.ambient.width).toBeGreaterThan(50);
    expect(pico.ambient.width).toBeLessThan(pico.sourceFrameSize);
    expect(pico.ambient.height).toBeGreaterThan(8);
    expect(pico.ambient.height).toBeLessThan(24);
    expect(pico.ambient.coreOpacity).toBeLessThanOrEqual(0.2);
    expect(pico.ambient.midOpacity).toBeLessThan(pico.ambient.coreOpacity);
  });
});
