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
  // Zones are the illuminated room interiors. They deliberately stop at wall faces:
  // light never paints a wall from above and never bleeds through the divider into the next room.
  zones: [
    { id: "transfer-left", x: TILE + 4, y: TILE + 4, w: 728, h: 632 },
    { id: "primus-right", x: 804, y: TILE + 4, w: 408, h: 632 },
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
