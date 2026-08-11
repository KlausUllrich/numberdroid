import type { TiledMapJson } from "../tiled";

const COLUMNS = 52;
const ROWS = 20;
const TILE = 64;

type TileRect = { name: string; x: number; y: number; w: number; h: number };
type DoorTile = {
  name: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  orientation: "vertical" | "horizontal";
  mode?: "auto" | "locked";
  size?: "standard" | "large";
  keyId?: string;
  label?: string;
};

const ROOMS: TileRect[] = [
  { name: "aft-engineering", x: 2, y: 6, w: 8, h: 8 },
  { name: "aft-reactor", x: 12, y: 1, w: 8, h: 6 },
  { name: "aft-cargo", x: 12, y: 13, w: 8, h: 6 },
  { name: "central-security", x: 22, y: 6, w: 8, h: 8 },
  { name: "research-lab", x: 32, y: 1, w: 8, h: 6 },
  { name: "machine-room", x: 32, y: 13, w: 8, h: 6 },
  { name: "navigation", x: 42, y: 2, w: 7, h: 6 },
  { name: "storage-east", x: 42, y: 12, w: 7, h: 6 },
  { name: "bridge", x: 48, y: 8, w: 4, h: 4 },
];

const CORRIDORS: TileRect[] = [
  { name: "main-west", x: 11, y: 9, w: 10, h: 2 },
  { name: "reactor-drop", x: 16, y: 8, w: 2, h: 1 },
  { name: "cargo-rise", x: 16, y: 11, w: 2, h: 1 },
  { name: "main-east", x: 31, y: 9, w: 16, h: 2 },
  { name: "lab-drop", x: 36, y: 8, w: 2, h: 1 },
  { name: "machine-rise", x: 36, y: 11, w: 2, h: 1 },
];

const DOORWAYS: DoorTile[] = [
  { name: "door-engineering-east", x: 10, y: 9, orientation: "vertical" },
  { name: "door-security-west", x: 21, y: 9, orientation: "vertical" },
  { name: "door-reactor-south", x: 16, y: 7, orientation: "horizontal" },
  { name: "door-cargo-north", x: 16, y: 12, orientation: "horizontal" },
  {
    name: "door-security-east",
    x: 30,
    y: 9,
    orientation: "vertical",
    mode: "locked",
    keyId: "blue-access",
    label: "BLUE",
  },
  { name: "door-lab-south", x: 36, y: 7, orientation: "horizontal" },
  { name: "door-machine-north", x: 36, y: 12, orientation: "horizontal" },
  { name: "door-navigation-south", x: 45, y: 8, orientation: "horizontal" },
  { name: "door-storage-north", x: 45, y: 11, orientation: "horizontal" },
  {
    name: "door-bridge-west",
    x: 47,
    y: 9,
    w: 1,
    h: 2,
    orientation: "vertical",
    mode: "locked",
    size: "large",
    keyId: "command-access",
    label: "COMMAND",
  },
];

const DOOR_RECTS: TileRect[] = DOORWAYS.map((door) => ({
  name: door.name,
  x: door.x,
  y: door.y,
  w: door.w ?? 1,
  h: door.h ?? 1,
}));
const WALKABLE: TileRect[] = [...ROOMS, ...CORRIDORS, ...DOOR_RECTS];

const OBSTACLES: TileRect[] = [
  { name: "engineering-core", x: 5, y: 8, w: 2, h: 2 },
  { name: "reactor-bank", x: 15, y: 2, w: 2, h: 2 },
  { name: "cargo-stack", x: 15, y: 15, w: 3, h: 1 },
  { name: "security-console", x: 25, y: 9, w: 2, h: 2 },
  { name: "lab-console", x: 35, y: 2, w: 2, h: 2 },
  { name: "machine-core", x: 35, y: 15, w: 2, h: 2 },
  { name: "navigation-bank", x: 44, y: 3, w: 2, h: 2 },
  { name: "storage-stack", x: 44, y: 14, w: 2, h: 1 },
];

function contains(rect: TileRect, col: number, row: number) {
  return col >= rect.x && col < rect.x + rect.w && row >= rect.y && row < rect.y + rect.h;
}

function inAny(rects: TileRect[], col: number, row: number) {
  return rects.some((rect) => contains(rect, col, row));
}

function touchesWalkable(col: number, row: number) {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if ((dx || dy) && inAny(WALKABLE, col + dx, row + dy)) return true;
    }
  }
  return false;
}

function groundTile(col: number, row: number) {
  if (inAny(OBSTACLES, col, row)) return 3;
  if (inAny(WALKABLE, col, row)) return (col * 7 + row * 3) % 13 === 0 ? 2 : 1;
  if (touchesWalkable(col, row)) return 3;
  return 0;
}

const ground = Array.from({ length: COLUMNS * ROWS }, (_, index) => {
  const col = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  return groundTile(col, row);
});

const decor = Array.from({ length: COLUMNS * ROWS }, () => 0);

function markDecor(x: number, y: number) {
  const col = Math.floor(x / TILE);
  const row = Math.floor(y / TILE);
  if (col >= 0 && col < COLUMNS && row >= 0 && row < ROWS) decor[row * COLUMNS + col] = 4;
}

function prop(name: string, value: unknown, type: string = typeof value) {
  return { name, type, value };
}

function rectObjects(rects: TileRect[], firstId: number) {
  return rects.map((rect, index) => ({
    id: firstId + index,
    name: rect.name,
    x: rect.x * TILE,
    y: rect.y * TILE,
    width: rect.w * TILE,
    height: rect.h * TILE,
  }));
}

function doorObjects(firstId: number) {
  return DOORWAYS.map((door, index) => ({
    id: firstId + index,
    name: door.name,
    x: door.x * TILE,
    y: door.y * TILE,
    width: (door.w ?? 1) * TILE,
    height: (door.h ?? 1) * TILE,
    properties: [
      prop("orientation", door.orientation, "string"),
      prop("openRadius", door.size === "large" ? 150 : 118, "float"),
      prop("mode", door.mode ?? "auto", "string"),
      prop("size", door.size ?? "standard", "string"),
      ...(door.keyId ? [prop("keyId", door.keyId, "string")] : []),
      ...(door.label ? [prop("label", door.label, "string")] : []),
    ],
  }));
}

function station(id: number, name: string, x: number, y: number) {
  markDecor(x, y);
  return {
    id,
    name,
    x,
    y,
    properties: [prop("energy", 1, "int"), prop("label", "ENERGIE ⚡ +1", "string")],
  };
}

function pickup(id: number, name: string, x: number, y: number, keyId: string, label: string) {
  return {
    id,
    name,
    x,
    y,
    properties: [prop("keyId", keyId, "string"), prop("label", label, "string")],
  };
}

function encounter(
  id: number,
  encounterId: string,
  name: string,
  x: number,
  y: number,
  enemyId: "sentry" | "magnetar" | "kronos",
  mode: "add-easy" | "add-normal" | "add-hard" | "subtract",
  difficulty: "easy" | "medium" | "hard",
  retreatX: number,
  retreatY: number,
  boss = false,
) {
  const target = mode === "add-easy" ? 6 : mode === "add-normal" ? 8 : mode === "add-hard" ? 10 : 8;
  const symbol = mode === "subtract" ? "−" : "+";
  return {
    id,
    name,
    x,
    y,
    properties: [
      prop("encounterId", encounterId, "string"),
      prop("enemyId", enemyId, "string"),
      prop("bodyId", enemyId, "string"),
      prop("mode", mode, "string"),
      prop("mathLabel", `${symbol} ZIEL ${target}`, "string"),
      prop("difficulty", difficulty, "string"),
      prop("retreatX", retreatX, "float"),
      prop("retreatY", retreatY, "float"),
      ...(enemyId === "magnetar" ? [prop("rewardLabel", `SIEG → ${name} + REIHENSCHUB →`, "string")] : []),
      ...(boss ? [
        prop("boss", true, "bool"),
        prop("deckSize", "large", "string"),
        prop("rewardLabel", "SIEG → BRÜCKE SICHERN · KÖRPERTRANSFER BEREIT", "string"),
        prop("storyIntro", "Der große Kommandodroide hält die Brücke verriegelt. Besiege ihn, um Deck B2 unter Kontrolle zu bringen.", "string"),
      ] : []),
    ],
  };
}

const stations = [
  station(300, "b2-energy-engineering", 330, 500),
  station(301, "b2-energy-reactor", 1000, 250),
  station(302, "b2-energy-machine", 2200, 1020),
  station(303, "b2-energy-navigation", 2860, 300),
];

const pickups = [
  pickup(350, "b2-blue-access-card", 1110, 250, "blue-access", "BLAUE ZUGANGSKARTE"),
  pickup(351, "b2-command-access-card", 2860, 430, "command-access", "KOMMANDOKARTE"),
];

const encounters = [
  encounter(400, "b2-sentry-engineering", "SENTRY-4 TECHNIK", 500, 690, "sentry", "add-easy", "easy", 360, 690),
  encounter(401, "b2-sentry-reactor", "SENTRY-4 REAKTOR", 930, 210, "sentry", "add-easy", "easy", 850, 320),
  encounter(402, "b2-magnetar-reactor", "MAGNETAR 742 REAKTOR", 1150, 340, "magnetar", "add-normal", "medium", 1050, 340),
  encounter(403, "b2-magnetar-cargo", "MAGNETAR 742 FRACHT", 920, 1000, "magnetar", "add-normal", "medium", 850, 1100),
  encounter(404, "b2-sentry-cargo", "SENTRY-4 FRACHT", 1130, 1080, "sentry", "add-easy", "easy", 1030, 1080),
  encounter(405, "b2-sentry-security", "SENTRY-4 ZENTRALE", 1540, 610, "sentry", "add-easy", "easy", 1460, 760),
  encounter(406, "b2-magnetar-security", "MAGNETAR 742 SICHERHEIT", 1760, 760, "magnetar", "add-normal", "medium", 1660, 760),
  encounter(407, "b2-magnetar-lab", "MAGNETAR 742 LABOR", 2170, 220, "magnetar", "add-normal", "medium", 2100, 340),
  encounter(408, "b2-sentry-lab", "SENTRY-4 LABOR", 2390, 340, "sentry", "add-easy", "easy", 2290, 340),
  encounter(409, "b2-kronos-machine", "KRONOS-9 MASCHINENRAUM", 2180, 1010, "kronos", "subtract", "hard", 2100, 1100),
  encounter(410, "b2-magnetar-machine", "MAGNETAR 742 MASCHINENRAUM", 2400, 1100, "magnetar", "add-normal", "medium", 2300, 1100),
  encounter(411, "b2-sentry-navigation", "SENTRY-4 NAVIGATION", 2810, 260, "sentry", "add-easy", "easy", 2730, 400),
  encounter(412, "b2-magnetar-storage", "MAGNETAR 742 LAGER", 2860, 980, "magnetar", "add-normal", "medium", 2760, 980),
  encounter(413, "b2-boss-bridge", "KRONOS-9 KOMMANDO", 3210, 640, "kronos", "add-hard", "hard", 3120, 640, true),
];

export const DECK_VS2_MAP: TiledMapJson = {
  orientation: "orthogonal",
  infinite: false,
  width: COLUMNS,
  height: ROWS,
  tilewidth: TILE,
  tileheight: TILE,
  properties: [
    prop("floorId", "deck-vs2", "string"),
    prop("floorName", "DECK B2", "string"),
    prop("subtitle", "VERTICAL SLICE 2 · SEKTIONEN & ZUGANGSKONTROLLE", "string"),
    prop("objectiveDefault", "ERKUNDE DECK B2 · FINDE ZUGANGSKARTEN · DRINGE ZUR BRÜCKE VOR", "string"),
    prop("objectiveAfterEnergy", "ENERGIE GESICHERT · FINDE DIE ZUGANGSKARTEN · DRINGE ZUR BRÜCKE VOR", "string"),
    prop("goalEncounterId", "b2-boss-bridge", "string"),
    prop("goalLabel", "ZIEL: ERREICHE DIE BRÜCKE · BESIEGE DEN KOMMANDODROIDEN", "string"),
    prop("goalCompletedLabel", "EBENE GESICHERT · BRÜCKE UNTER KONTROLLE", "string"),
  ],
  tilesets: [
    {
      firstgid: 1,
      image: "/assets/deck/vs2-tech-tiles.svg",
      tilewidth: TILE,
      tileheight: TILE,
      tilecount: 4,
      columns: 4,
      margin: 0,
      spacing: 0,
    },
  ],
  layers: [
    { id: 1, name: "Ground", type: "tilelayer", width: COLUMNS, height: ROWS, data: ground, opacity: 1, visible: true },
    { id: 2, name: "Decor", type: "tilelayer", width: COLUMNS, height: ROWS, data: decor, opacity: 1, visible: true },
    {
      id: 10,
      name: "Start",
      type: "objectgroup",
      objects: [{
        id: 100,
        name: "player-start",
        x: 250,
        y: 640,
        properties: [prop("bodyId", "pico", "string"), prop("facing", 90, "float"), prop("metaEnergy", 0, "int")],
      }],
    },
    { id: 11, name: "Walkable", type: "objectgroup", objects: rectObjects(WALKABLE, 110) },
    { id: 12, name: "Obstacles", type: "objectgroup", objects: rectObjects(OBSTACLES, 200) },
    { id: 13, name: "Doors", type: "objectgroup", objects: doorObjects(260) },
    { id: 14, name: "EnergyStations", type: "objectgroup", objects: stations },
    { id: 15, name: "Encounters", type: "objectgroup", objects: encounters },
    { id: 16, name: "Pickups", type: "objectgroup", objects: pickups },
  ],
};
