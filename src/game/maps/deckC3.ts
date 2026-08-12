import type { TiledMapJson } from "../tiled";

const TILE = 64;
const COLUMNS = 30;
const ROWS = 14;

type TileRect = { name: string; x: number; y: number; w: number; h: number };

const ROOMS: TileRect[] = [
  { name: "entry-bay", x: 1, y: 4, w: 7, h: 6 },
  { name: "sorting", x: 9, y: 1, w: 7, h: 6 },
  { name: "coolant", x: 9, y: 8, w: 7, h: 5 },
  { name: "supply-core", x: 18, y: 3, w: 8, h: 8 },
  { name: "control", x: 27, y: 5, w: 3, h: 4 },
];

const CORRIDORS: TileRect[] = [
  { name: "entry-junction", x: 8, y: 6, w: 3, h: 2 },
  { name: "sorting-drop", x: 12, y: 7, w: 2, h: 1 },
  { name: "core-link", x: 16, y: 6, w: 2, h: 2 },
  { name: "core-control", x: 26, y: 6, w: 1, h: 2 },
];

const WALKABLE = [...ROOMS, ...CORRIDORS];
const OBSTACLES: TileRect[] = [
  { name: "entry-crates", x: 3, y: 5, w: 2, h: 1 },
  { name: "sorting-line", x: 11, y: 3, w: 3, h: 1 },
  { name: "coolant-pump", x: 12, y: 10, w: 2, h: 1 },
  { name: "supply-stack", x: 21, y: 5, w: 2, h: 2 },
];

const ROOM_COPY: Record<string, { label: string; subtitle: string }> = {
  "entry-bay": { label: "VERSORGUNGSSCHLEUSE", subtitle: "C3 · ANKUNFT" },
  sorting: { label: "SORTIERWERK", subtitle: "FRACHT · ROUTINEDROIDEN" },
  coolant: { label: "KÜHLMITTELKREIS", subtitle: "PUMPEN · WARTUNG" },
  "supply-core": { label: "VERSORGUNGSKERN", subtitle: "AUTOMATIK · AUFSICHT" },
  control: { label: "C3 KONTROLLE", subtitle: "DECKFREIGABE" },
};

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
  if (inAny(WALKABLE, col, row)) return (col + row * 3) % 11 === 0 ? 2 : 1;
  if (touchesWalkable(col, row)) return 3;
  return 0;
}

const ground = Array.from({ length: COLUMNS * ROWS }, (_, index) => {
  const col = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  return groundTile(col, row);
});
const decor = Array.from({ length: COLUMNS * ROWS }, () => 0);

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
      prop("label", ROOM_COPY[room.name].label, "string"),
      prop("subtitle", ROOM_COPY[room.name].subtitle, "string"),
    ],
  }));
}

function encounter(
  id: number,
  encounterId: string,
  name: string,
  x: number,
  y: number,
  enemyId: "sentry" | "magnetar",
  mode: "add-easy" | "add-normal" | "add-hard" | "subtract",
  difficulty: "easy" | "medium" | "hard",
  mathRole: "comfort" | "core" | "stretch" | "specialist",
  retreatX: number,
  retreatY: number,
  behavior: "neutral" | "guard" | "patrol" | "aggressive",
  extra: Array<{ name: string; type?: string; value: unknown }> = [],
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
      prop("mathRole", mathRole, "string"),
      prop("difficulty", difficulty, "string"),
      prop("retreatX", retreatX, "float"),
      prop("retreatY", retreatY, "float"),
      prop("behavior", behavior, "string"),
      prop("interceptRadius", 76, "float"),
      ...(behavior === "guard" ? [
        prop("detectionRadius", 260, "float"),
        prop("loseRadius", 470, "float"),
        prop("chaseSpeed", 148, "float"),
        prop("chaseAcceleration", 145, "float"),
      ] : []),
      ...(behavior === "aggressive" ? [
        prop("detectionRadius", 285, "float"),
        prop("loseRadius", 470, "float"),
        prop("chaseSpeed", 142, "float"),
        prop("chaseAcceleration", 180, "float"),
        prop("forcedEngagement", true, "bool"),
      ] : []),
      ...(behavior === "neutral" ? [prop("patrolSpeed", 48, "float")] : []),
      ...extra,
    ],
  };
}

const encounters = [
  encounter(
    300,
    "c3-sentry-loader",
    "SENTRY-4 LADEHELFER",
    320,
    520,
    "sentry",
    "add-easy",
    "easy",
    "comfort",
    230,
    520,
    "neutral",
    [prop("patrolPath", "250,520;390,520;390,610;250,610", "string")],
  ),
  encounter(
    301,
    "c3-sentry-sorter",
    "SENTRY-4 SORTIERLÄUFER",
    740,
    245,
    "sentry",
    "add-easy",
    "easy",
    "comfort",
    670,
    360,
    "patrol",
    [prop("patrolPath", "650,220;920,220;920,340;650,340", "string"), prop("patrolSpeed", 82, "float")],
  ),
  encounter(
    302,
    "c3-magnetar-coolant",
    "MAGNETAR 742 KÜHLMITTELWACHE",
    820,
    690,
    "magnetar",
    "add-normal",
    "medium",
    "core",
    740,
    690,
    "guard",
  ),
  encounter(
    303,
    "c3-magnetar-balancer",
    "MAGNETAR 742 LASTABGLEICH",
    1250,
    410,
    "magnetar",
    "add-hard",
    "medium",
    "specialist",
    1160,
    500,
    "neutral",
    [
      prop("patrolPath", "1180,390;1450,390;1450,520;1180,520", "string"),
      prop("storyIntro", "Dieser neutrale Spezialist rechnet anspruchsvoller als die einfachen Arbeitsdroiden, greift aber nicht an. Mathematische Rolle und Aggression sind getrennt.", "string"),
    ],
  ),
  encounter(
    304,
    "c3-magnetar-overseer",
    "MAGNETAR 742 VERSORGUNGSAUFSEHER",
    1580,
    450,
    "magnetar",
    "add-hard",
    "hard",
    "stretch",
    1490,
    540,
    "aggressive",
    [prop("storyIntro", "Der Versorgungsaufseher blockiert die Deckfreigabe. Er ist der lokale Druckpunkt von C3, ohne bereits einen neuen Bossmechanismus einzuführen.", "string")],
  ),
];

const actions = [{
  id: 400,
  name: "c3-control-console",
  x: 1810,
  y: 450,
  properties: [
    prop("prompt", "DECK C3 ÜBERNEHMEN", "string"),
    prop("label", "VERSORGUNGSKONTROLLE", "string"),
    prop("completionLabel", "DECK C3 IST UNTER DEINER KONTROLLE", "string"),
    prop("requiresEncounterId", "c3-magnetar-overseer", "string"),
  ],
}];

export const DECK_C3_MAP: TiledMapJson = {
  orientation: "orthogonal",
  infinite: false,
  width: COLUMNS,
  height: ROWS,
  tilewidth: TILE,
  tileheight: TILE,
  properties: [
    prop("floorId", "deck-c3", "string"),
    prop("floorName", "DECK C3", "string"),
    prop("subtitle", "VERSORGUNGSRING · CAMPAIGN PROOF", "string"),
    prop("objectiveDefault", "ERKUNDE C3 · BEOBACHTE DIE UNTERSCHIEDLICHEN DROIDENROLLEN", "string"),
    prop("objectiveAfterEnergy", "ENERGIE GESICHERT · DRINGE ZUR VERSORGUNGSKONTROLLE VOR", "string"),
    prop("goalActionId", "c3-control-console", "string"),
    prop("goalLabel", "ZIEL: SCHALTE DEN VERSORGUNGSAUFSEHER AUS", "string"),
    prop("goalReadyLabel", "AUFSEHER BESIEGT · ÜBERNIMM DIE C3-KONTROLLE", "string"),
    prop("goalCompletedLabel", "DECK C3 ÜBERNOMMEN · VERSORGUNG GESICHERT", "string"),
  ],
  tilesets: [{
    firstgid: 1,
    image: "/assets/deck/vs2-tech-tiles.svg",
    tilewidth: TILE,
    tileheight: TILE,
    tilecount: 4,
    columns: 4,
    margin: 0,
    spacing: 0,
  }],
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
        x: 150,
        y: 520,
        properties: [prop("bodyId", "pico", "string"), prop("facing", 90, "float"), prop("metaEnergy", 0, "int")],
      }],
    },
    { id: 11, name: "Walkable", type: "objectgroup", objects: rectObjects(WALKABLE, 110) },
    { id: 12, name: "Obstacles", type: "objectgroup", objects: rectObjects(OBSTACLES, 150) },
    { id: 13, name: "Rooms", type: "objectgroup", objects: roomObjects(180) },
    { id: 14, name: "Doors", type: "objectgroup", objects: [] },
    { id: 15, name: "EnergyStations", type: "objectgroup", objects: [{ id: 250, name: "c3-energy-entry", x: 470, y: 580, properties: [prop("energy", 1, "int"), prop("label", "ENERGIE ⚡ +1", "string")] }] },
    { id: 16, name: "Encounters", type: "objectgroup", objects: encounters },
    { id: 17, name: "Pickups", type: "objectgroup", objects: [] },
    { id: 18, name: "Actions", type: "objectgroup", objects: actions },
  ],
};
