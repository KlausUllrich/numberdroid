import type { TiledMapJson } from "../tiled";

const COLUMNS = 52;
const ROWS = 20;
const TILE = 64;

type TileRect = { name: string; x: number; y: number; w: number; h: number };

const WALKABLE: TileRect[] = [
  { name: "aft-spine", x: 2, y: 8, w: 12, h: 4 },
  { name: "aft-upper", x: 4, y: 2, w: 8, h: 5 },
  { name: "aft-upper-link", x: 6, y: 6, w: 3, h: 3 },
  { name: "aft-lower", x: 4, y: 13, w: 9, h: 5 },
  { name: "aft-lower-link", x: 8, y: 11, w: 3, h: 3 },
  { name: "rise-link", x: 12, y: 5, w: 4, h: 5 },
  { name: "upper-passage", x: 14, y: 4, w: 11, h: 3 },
  { name: "west-upper", x: 16, y: 1, w: 7, h: 4 },
  { name: "west-drop", x: 22, y: 6, w: 3, h: 6 },
  { name: "center-spine", x: 22, y: 9, w: 11, h: 4 },
  { name: "center-upper", x: 26, y: 3, w: 7, h: 6 },
  { name: "center-lower", x: 25, y: 13, w: 8, h: 5 },
  { name: "fall-link", x: 31, y: 11, w: 4, h: 5 },
  { name: "lower-passage", x: 33, y: 13, w: 10, h: 3 },
  { name: "east-lower", x: 35, y: 15, w: 7, h: 4 },
  { name: "east-rise", x: 40, y: 8, w: 3, h: 6 },
  { name: "east-spine", x: 40, y: 7, w: 9, h: 4 },
  { name: "east-upper", x: 37, y: 2, w: 8, h: 5 },
  { name: "fore-section", x: 45, y: 5, w: 5, h: 9 },
  { name: "bridge", x: 49, y: 7, w: 3, h: 5 },
];

const OBSTACLES: TileRect[] = [
  { name: "aft-reactor", x: 7, y: 3, w: 2, h: 2 },
  { name: "aft-cargo", x: 6, y: 15, w: 3, h: 1 },
  { name: "upper-conduit", x: 17, y: 5, w: 2, h: 1 },
  { name: "center-console", x: 28, y: 5, w: 2, h: 2 },
  { name: "center-reactor", x: 26, y: 10, w: 2, h: 2 },
  { name: "lower-machinery", x: 28, y: 15, w: 2, h: 2 },
  { name: "east-cargo", x: 37, y: 14, w: 2, h: 1 },
  { name: "east-reactor", x: 40, y: 4, w: 2, h: 2 },
  { name: "bridge-divider", x: 47, y: 8, w: 1, h: 3 },
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
        prop("rewardLabel", "SIEG → BRÜCKE SICHERN · KÖRPERTRANSFER BEREIT", "string"),
        prop("storyIntro", "Der Kommandodroide hält die Brücke verriegelt. Besiege ihn, um Deck B2 unter Kontrolle zu bringen.", "string"),
      ] : []),
    ],
  };
}

const stations = [
  station(300, "b2-energy-aft", 390, 300),
  station(301, "b2-energy-center", 1540, 690),
  station(302, "b2-energy-lower", 1770, 1040),
  station(303, "b2-energy-fore", 2700, 300),
];

const encounters = [
  encounter(400, "b2-sentry-aft-spine", "SENTRY-4 AFT", 650, 640, "sentry", "add-easy", "easy", 520, 640),
  encounter(401, "b2-sentry-aft-upper", "SENTRY-4 REAKTOR", 610, 350, "sentry", "add-easy", "easy", 480, 350),
  encounter(402, "b2-magnetar-aft-lower", "MAGNETAR 742 FRACHT", 650, 1040, "magnetar", "add-normal", "medium", 820, 1040),
  encounter(403, "b2-sentry-upper-passage", "SENTRY-4 KORRIDOR", 1100, 350, "sentry", "add-easy", "easy", 980, 350),
  encounter(404, "b2-magnetar-west-upper", "MAGNETAR 742 SENSOR", 1300, 190, "magnetar", "add-normal", "medium", 1160, 250),
  encounter(405, "b2-sentry-center-spine", "SENTRY-4 ZENTRUM", 1500, 690, "sentry", "add-easy", "easy", 1380, 690),
  encounter(406, "b2-magnetar-center-upper", "MAGNETAR 742 SYSTEM", 1900, 360, "magnetar", "add-normal", "medium", 1760, 480),
  encounter(407, "b2-kronos-center-lower", "KRONOS-9 MASCHINENRAUM", 1800, 1050, "kronos", "add-hard", "hard", 1660, 1050),
  encounter(408, "b2-sentry-lower-passage", "SENTRY-4 VERSORGUNG", 2260, 930, "sentry", "add-easy", "easy", 2140, 930),
  encounter(409, "b2-magnetar-east-lower", "MAGNETAR 742 FRACHT OST", 2500, 1080, "magnetar", "add-normal", "medium", 2380, 1080),
  encounter(410, "b2-sentry-east-spine", "SENTRY-4 VORDECK", 2730, 590, "sentry", "add-easy", "easy", 2600, 590),
  encounter(411, "b2-kronos-east-upper", "KRONOS-9 NAVIGATION", 2650, 300, "kronos", "subtract", "hard", 2500, 300),
  encounter(412, "b2-magnetar-fore", "MAGNETAR 742 BRÜCKENZUGANG", 3000, 760, "magnetar", "add-normal", "medium", 2870, 760),
  encounter(413, "b2-boss-bridge", "KRONOS-9 KOMMANDO", 3230, 640, "kronos", "add-hard", "hard", 3090, 640, true),
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
    prop("subtitle", "VERTICAL SLICE 2 · TECHNISCHER SCHIFFSFLOOR", "string"),
    prop("objectiveDefault", "ERKUNDE DECK B2 · FINDE EINEN WEG ZUR BRÜCKE", "string"),
    prop("objectiveAfterEnergy", "ENERGIE GESICHERT · DRINGE ZUR BRÜCKE VOR", "string"),
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
    { id: 13, name: "EnergyStations", type: "objectgroup", objects: stations },
    { id: 14, name: "Encounters", type: "objectgroup", objects: encounters },
  ],
};
