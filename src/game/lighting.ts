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
  // Layout v3: Transfer is now its own south destination room. The light mask is clipped
  // to the room interior so the warm CORE light cannot spill into the hall/void/walls.
  zones: [
    {
      id: "transfer-room",
      x: 8 * TILE + 30,
      y: 14 * TILE + 30,
      w: 11 * TILE - 60,
      h: 6 * TILE - 60,
    },
  ],
  lights: [
    {
      id: "transfer-core",
      zoneId: "transfer-room",
      x: 12.5 * TILE,
      y: 16.5 * TILE,
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
