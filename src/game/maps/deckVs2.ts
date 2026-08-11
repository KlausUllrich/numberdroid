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
type EncounterOptions = {
  boss?: boolean;
  keyId?: string;
  keyLabel?: string;
  duelLayers?: number;
  storyIntro?: string;
};

const ROOMS: TileRect[] = [
  { name: "aft-engineering", x: 2, y: 6, w: 8, h: 8 },
  { name: "aft-reactor", x: 12, y: 1, w: 8, h: 6 },
  { name: "aft-cargo", x: 12, y: 13, w: 8, h: 6 },
  { name: "central-security", x: 22, y: 6, w: 8, h: 8 },
  { name: "research-lab", x: 32, y: 1, w: 8, h: 6 },
  { name: "machine-room", x: 32, y: 13, w: 8, h: 6 },
  { name: "navigation", x: 42, y: 2, w: 6, h: 6 },
  { name: "storage-east", x: 42, y: 12, w: 6, h: 6 },
  { name: "bridge", x: 48, y: 8, w: 4, h: 4 },
];

const ROOM_COPY: Record<string, { label: string; subtitle: string }> = {
  "aft-engineering": { label: "ANTRIEBSWERKSTATT", subtitle: "WARTUNG · HECKSEKTION" },
  "aft-reactor": { label: "REAKTORKAMMER", subtitle: "ENERGIEVERTEILUNG B2" },
  "aft-cargo": { label: "FRACHTDECK", subtitle: "CONTAINER · ERSATZTEILE" },
  "central-security": { label: "SICHERHEITSZENTRALE", subtitle: "ZUGANGSKONTROLLE · BLUE" },
  "research-lab": { label: "SIGNALLABOR", subtitle: "SENSOREN · FELDTECHNIK" },
  "machine-room": { label: "MASCHINENKERN", subtitle: "SCHWERTECHNIK · VERSORGUNG" },
  navigation: { label: "NAVIGATION", subtitle: "KOMMANDOZUGANG" },
  "storage-east": { label: "VERSORGUNGSLAGER", subtitle: "OSTSEKTION" },
  bridge: { label: "BRÜCKE B2", subtitle: "HAUPTKONSOLE · KOMMANDO" },
};

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

function roomObjects(firstId: number) {
  return ROOMS.map((room, index) => ({
    id: firstId + index,
    name: room.name,
    x: room.x * TILE,
    y: room.y * TILE,
    width: room.w * TILE,
    height: room.h * TILE,
    properties: [
      prop("label", ROOM_COPY[room.name]?.label ?? room.name.toUpperCase(), "string"),
      prop("subtitle", ROOM_COPY[room.name]?.subtitle ?? "DECK B2", "string"),
    ],
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
  options: EncounterOptions = {},
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
      ...(options.keyId ? [
        prop("accessKeyId", options.keyId, "string"),
        prop("accessKeyLabel", options.keyLabel ?? "ZUGANGSKARTE", "string"),
        prop("rewardLabel", `SIEG → KÖRPER + ${options.keyLabel ?? "ZUGANGSKARTE"}`, "string"),
      ] : []),
      ...(options.boss ? [
        prop("boss", true, "bool"),
        prop("deckSize", "large", "string"),
        prop("duelLayers", options.duelLayers ?? 2, "int"),
        prop("rewardLabel", "SIEG → KRONOS-KOMMANDOKÖRPER ÜBERNEHMEN", "string"),
      ] : []),
      ...(options.storyIntro ? [prop("storyIntro", options.storyIntro, "string")] : []),
    ],
  };
}

function action(id: number, name: string, x: number, y: number) {
  return {
    id,
    name,
    x,
    y,
    properties: [
      prop("prompt", "DECK B2 ÜBERNEHMEN", "string"),
      prop("label", "HAUPTKONSOLE", "string"),
      prop("completionLabel", "DECK B2 IST UNTER DEINER KONTROLLE", "string"),
      prop("requiresEncounterId", "b2-boss-bridge", "string"),
    ],
  };
}

const stations = [
  station(300, "b2-energy-engineering", 330, 500),
  station(301, "b2-energy-reactor", 1000, 250),
  station(302, "b2-energy-machine", 2200, 1020),
  station(303, "b2-energy-navigation", 2780, 300),
];

const encounters = [
  encounter(400, "b2-sentry-engineering", "SENTRY-4 WERKSTATTWACHE", 500, 690, "sentry", "add-easy", "easy", 360, 690),
  encounter(401, "b2-sentry-reactor", "SENTRY-4 REAKTORPATROUILLE", 930, 210, "sentry", "add-easy", "easy", 850, 320),
  encounter(402, "b2-magnetar-reactor", "MAGNETAR 742 REAKTORTECHNIK", 1150, 340, "magnetar", "add-normal", "medium", 1050, 340),
  encounter(403, "b2-magnetar-cargo", "MAGNETAR 742 FRACHTHEBER", 920, 1000, "magnetar", "add-normal", "medium", 850, 1100),
  encounter(404, "b2-sentry-cargo", "SENTRY-4 FRACHTWACHE", 1130, 1080, "sentry", "add-easy", "easy", 1030, 1080),
  encounter(
    405,
    "b2-sentry-security",
    "SENTRY-4 SCHLEUSENWACHE",
    1540,
    610,
    "sentry",
    "add-easy",
    "easy",
    1460,
    760,
    {
      keyId: "blue-access",
      keyLabel: "BLUE-SECURITY-CARD",
      storyIntro: "Diese Schleusenwache authentifiziert den Zugang zur östlichen Sicherheitssektion. Ihre BLUE-Card ist im Droidenkern gesichert.",
    },
  ),
  encounter(406, "b2-magnetar-security", "MAGNETAR 742 SICHERHEITSGITTER", 1760, 760, "magnetar", "add-normal", "medium", 1660, 760),
  encounter(407, "b2-magnetar-lab", "MAGNETAR 742 SIGNALTECHNIK", 2170, 220, "magnetar", "add-normal", "medium", 2100, 340),
  encounter(408, "b2-sentry-lab", "SENTRY-4 LABORPATROUILLE", 2390, 340, "sentry", "add-easy", "easy", 2290, 340),
  encounter(409, "b2-kronos-machine", "KRONOS-9 MASCHINENWACHE", 2180, 1010, "kronos", "subtract", "hard", 2100, 1100),
  encounter(410, "b2-magnetar-machine", "MAGNETAR 742 KERNWARTUNG", 2400, 1100, "magnetar", "add-normal", "medium", 2300, 1100),
  encounter(
    411,
    "b2-sentry-navigation",
    "SENTRY-4 KOMMANDOWACHE",
    2780,
    260,
    "sentry",
    "add-easy",
    "easy",
    2710,
    400,
    {
      keyId: "command-access",
      keyLabel: "COMMAND-SECURITY-CARD",
      storyIntro: "Die letzte Kommandowache trägt die Freigabe für das schwere Brückentor. Ohne ihren Kerncode bleibt COMMAND verriegelt.",
    },
  ),
  encounter(412, "b2-magnetar-storage", "MAGNETAR 742 VERSORGUNG", 2800, 980, "magnetar", "add-normal", "medium", 2720, 980),
  encounter(
    413,
    "b2-boss-bridge",
    "KRONOS-9 KOMMANDANT",
    3210,
    640,
    "kronos",
    "add-hard",
    "hard",
    3120,
    640,
    {
      boss: true,
      duelLayers: 2,
      storyIntro: "KRONOS-9 ist kein normaler Transfergegner. Zwei Reaktor-Firewalls schützen seinen Kommandokern. Ressourcen, Körperfähigkeit und Meta-Energie müssen für beide Schichten reichen.",
    },
  ),
];

const actions = [action(500, "b2-main-console", 3260, 700)];

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
    prop("subtitle", "VERTICAL SLICE 2 · SECURITY LOCKDOWN", "string"),
    prop("objectiveDefault", "FINDE DIE SECURITY-FREIGABEN · DRINGE ZUR BRÜCKE VOR", "string"),
    prop("objectiveAfterEnergy", "ENERGIE GESICHERT · FINDE DIE SECURITY-FREIGABEN · DRINGE ZUR BRÜCKE VOR", "string"),
    prop("goalActionId", "b2-main-console", "string"),
    prop("goalLabel", "ZIEL: DURCHBRICH DEN LOCKDOWN · BESIEGE KRONOS-9", "string"),
    prop("goalReadyLabel", "KRONOS BESIEGT · FAHRE ZUR HAUPTKONSOLE UND ÜBERNIMM DECK B2", "string"),
    prop("goalCompletedLabel", "DECK B2 ÜBERNOMMEN · EBENE GESICHERT", "string"),
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
    { id: 13, name: "Rooms", type: "objectgroup", objects: roomObjects(230) },
    { id: 14, name: "Doors", type: "objectgroup", objects: doorObjects(260) },
    { id: 15, name: "EnergyStations", type: "objectgroup", objects: stations },
    { id: 16, name: "Encounters", type: "objectgroup", objects: encounters },
    { id: 17, name: "Pickups", type: "objectgroup", objects: [] },
    { id: 18, name: "Actions", type: "objectgroup", objects: actions },
  ],
};
