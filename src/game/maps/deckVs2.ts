import type { TiledMapJson } from "../tiled";

const COLUMNS = 52;
const ROWS = 20;
const TILE = 64;

type TileRect = { name: string; x: number; y: number; w: number; h: number };

const ROOMS: TileRect[] = [
  { name: "aft-engineering", x: 2, y: 6, w: 8, h: 8 },
  { name: "aft-reactor", x: 10, y: 1, w: 8, h: 6 },
  { name: "aft-cargo", x: 10, y: 13, w: 9, h: 6 },
  { name: "central-security", x: 20, y: 6, w: 7, h: 8 },
  { name: "research-lab", x: 28, y: 1, w: 8, h: 6 },
  { name: "machine-room", x: 28, y: 13, w: 8, h: 6 },
  { name: "navigation", x: 38, y: 2, w: 7, h: 6 },
  { name: "storage-east", x: 38, y: 12, w: 7, h: 6 },
  { name: "bridge-access", x: 45, y: 6, w: 5, h: 8 },
  { name: "bridge", x: 49, y: 8, w: 3, h: 4 },
];

const CORRIDORS: TileRect[] = [
  { name: "aft-upper-link", x: 8, y: 4, w: 5, h: 4 },
  { name: "aft-lower-link", x: 8, y: 12, w: 5, h: 3 },
  { name: "upper-west-corridor", x: 16, y: 4, w: 6, h: 3 },
  { name: "lower-west-corridor", x: 17, y: 12, w: 5, h: 4 },
  { name: "upper-center-link", x: 25, y: 4, w: 5, h: 4 },
  { name: "lower-center-link", x: 25, y: 12, w: 5, h: 4 },
  { name: "upper-east-corridor", x: 34, y: 4, w: 6, h: 3 },
  { name: "lower-east-corridor", x: 34, y: 13, w: 6, h: 3 },
  { name: "fore-upper-link", x: 43, y: 6, w: 4, h: 4 },
  { name: "fore-lower-link", x: 43, y: 11, w: 4, h: 4 },
  { name: "bridge-neck", x: 48, y: 8, w: 3, h: 4 },
];

const WALKABLE: TileRect[] = [...ROOMS, ...CORRIDORS];

const OBSTACLES: TileRect[] = [
  { name: "engineering-core", x: 5, y: 8, w: 2, h: 2 },
  { name: "reactor-bank", x: 13, y: 2, w: 2, h: 2 },
  { name: "cargo-stack", x: 13, y: 15, w: 3, h: 1 },
  { name: "security-console", x: 22, y: 9, w: 2, h: 2 },
  { name: "lab-console", x: 31, y: 2, w: 2, h: 2 },
  { name: "machine-core", x: 31, y: 15, w: 2, h: 2 },
  { name: "navigation-bank", x: 40, y: 3, w: 2, h: 2 },
  { name: "storage-stack", x: 40, y: 14, w: 2, h: 1 },
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
  station(300, "b2-energy-engineering", 350, 470),
  station(301, "b2-energy-lab", 2180, 290),
  station(302, "b2-energy-machine", 2180, 1080),
  station(303, "b2-energy-navigation", 2780, 390),
];

const encounters = [
  encounter(400, "b2-sentry-engineering", "SENTRY-4 TECHNIK", 460, 720, "sentry", "add-easy", "easy", 330, 720),
  encounter(401, "b2-sentry-reactor", "SENTRY-4 REAKTOR", 760, 300, "sentry", "add-easy", "easy", 650, 300),
  encounter(402, "b2-magnetar-cargo", "MAGNETAR 742 FRACHT", 790, 1050, "magnetar", "add-normal", "medium", 650, 1050),
  encounter(403, "b2-sentry-upper-west", "SENTRY-4 KORRIDOR", 1180, 350, "sentry", "add-easy", "easy", 1070, 350),
  encounter(404, "b2-magnetar-security", "MAGNETAR 742 SICHERHEIT", 1430, 500, "magnetar", "add-normal", "medium", 1320, 500),
  encounter(405, "b2-sentry-security", "SENTRY-4 ZENTRALE", 1540, 760, "sentry", "add-easy", "easy", 1430, 760),
  encounter(406, "b2-magnetar-lab", "MAGNETAR 742 LABOR", 2020, 300, "magnetar", "add-normal", "medium", 1900, 300),
  encounter(407, "b2-kronos-machine", "KRONOS-9 MASCHINENRAUM", 2020, 1050, "kronos", "add-hard", "hard", 1900, 1050),
  encounter(408, "b2-sentry-upper-east", "SENTRY-4 VERBINDUNG", 2350, 350, "sentry", "add-easy", "easy", 2240, 350),
  encounter(409, "b2-magnetar-navigation", "MAGNETAR 742 NAVIGATION", 2650, 350, "magnetar", "add-normal", "medium", 2520, 350),
  encounter(410, "b2-sentry-lower-east", "SENTRY-4 VERSORGUNG", 2350, 940, "sentry", "add-easy", "easy", 2240, 940),
  encounter(411, "b2-kronos-storage", "KRONOS-9 LAGER", 2650, 960, "kronos", "subtract", "hard", 2520, 960),
  encounter(412, "b2-magnetar-bridge-access", "MAGNETAR 742 BRÜCKENZUGANG", 2990, 650, "magnetar", "add-normal", "medium", 2870, 650),
  encounter(413, "b2-boss-bridge", "KRONOS-9 KOMMANDO", 3230, 640, "kronos", "add-hard", "hard", 3110, 640, true),
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
    prop("subtitle", "VERTICAL SLICE 2 · SCHIFFSDECK", "string"),
    prop("objectiveDefault", "ERKUNDE DECK B2 · FINDE EINEN WEG DURCH DIE SEKTIONEN", "string"),
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
