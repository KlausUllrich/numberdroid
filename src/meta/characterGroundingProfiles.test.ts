import { describe, expect, it } from "vitest";
import grounding from "./characterGroundingProfiles.json";

const EXPECTED_DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const EXPECTED_PICO_FOOT_Y = [86, 86, 87, 87, 89, 92, 92, 95];
const EXPECTED_PICO_PRESENTATION_OFFSET_Y = [-2, -2, 0, -1, 0, 0, 0, -4];

describe("CharacterGrounding profiles", () => {
  it("preserves the measured eight-direction PICO foot planes", () => {
    const pico = grounding.profiles.pico;
    expect(pico.sourceFrameSize).toBe(96);
    expect(pico.directions.map((direction) => direction.name)).toEqual(EXPECTED_DIRECTIONS);
    expect(pico.directions.map((direction) => direction.footY)).toEqual(EXPECTED_PICO_FOOT_Y);
  });

  it("keeps live-QA presentation offsets separate from measured foot geometry", () => {
    const pico = grounding.profiles.pico;
    expect(pico.directions.map((direction) => direction.presentationOffsetY ?? 0)).toEqual(EXPECTED_PICO_PRESENTATION_OFFSET_Y);
    for (const direction of pico.directions) {
      expect(Math.abs(direction.presentationOffsetY ?? 0)).toBeLessThanOrEqual(4);
    }
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
