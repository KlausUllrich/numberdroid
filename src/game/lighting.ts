export type LightZone = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type SceneLight = {
  id: string;
  zoneId: string;
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  rgb: string;
  intensity: number;
  pulse?: boolean;
};

export type FloorLighting = {
  zones: LightZone[];
  lights: SceneLight[];
};

const TILE = 64;

const TRANSFER_HALL_LIGHTING: FloorLighting = {
  // Zones are room-interior illumination masks, not room rectangles. They start/end at the
  // INNER wall faces so the overlay never paints wall pixels and never bleeds across the divider.
  zones: [
    { id: "transfer-left", x: TILE + 8, y: TILE + 8, w: 724, h: 624 },
    { id: "primus-right", x: 804, y: TILE + 8, w: 404, h: 624 },
  ],
  lights: [
    {
      id: "transfer-core",
      zoneId: "transfer-left",
      x: 9.5 * TILE,
      y: 5.5 * TILE,
      radiusX: 180,
      radiusY: 155,
      rgb: "246 184 75",
      intensity: 0.34,
      pulse: true,
    },
  ],
};

const LIGHTING_BY_FLOOR: Record<string, FloorLighting> = {
  "transfer-hall": TRANSFER_HALL_LIGHTING,
};

export function lightingForFloor(floorId: string): FloorLighting | null {
  return LIGHTING_BY_FLOOR[floorId] ?? null;
}
