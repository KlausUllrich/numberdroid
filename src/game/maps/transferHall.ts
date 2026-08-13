import type { TiledMapJson } from "../tiled";

const TILE = 64;
const COLUMNS = 20;
const ROWS = 12;

type TileRect = { name: string; x: number; y: number; w: number; h: number };

function prop(name: string, value: unknown, type: string = typeof value) {
  return { name, type, value };
}

const WALKABLE: TileRect[] = [{ name: "transfer-hall", x: 1, y: 1, w: 18, h: 10 }];
const OBSTACLES: TileRect[] = [
  { name: "divider-north", x: 12, y: 1, w: 1, h: 4 },
  { name: "divider-south", x: 12, y: 7, w: 1, h: 4 },
  { name: "family-bench", x: 3.05, y: 4.34, w: .9, h: .5 },
  { name: "parent-a", x: 4.18, y: 3.2, w: .42, h: .52 },
  { name: "parent-b", x: 5.18, y: 3.2, w: .42, h: .52 },
  { name: "transfer-cradle", x: 9.18, y: 5.18, w: .64, h: .64 },
  { name: "kayo", x: 14.2, y: 6.2, w: .5, h: .55 },
  { name: "primus-pylon", x: 16.2, y: 6.2, w: .52, h: .55 },
];

function contains(rect: TileRect, col: number, row: number) {
  return col >= rect.x && col < rect.x + rect.w && row >= rect.y && row < rect.y + rect.h;
}

function groundTile(col: number, row: number) {
  if (col < 1 || col > 18 || row < 1 || row > 10) return 3;
  if (col === 1 && row === 1) return 9;
  if (col === 18 && row === 1) return 10;
  if (col === 18 && row === 10) return 11;
  if (col === 1 && row === 10) return 12;
  if (row === 1) return 5;
  if (col === 18) return 6;
  if (row === 10) return 7;
  if (col === 1) return 8;
  if (col === 12 && (row <= 4 || row >= 7)) return 3;
  if (col === 12) return 2;
  if (col >= 7 && col <= 11 && row >= 3 && row <= 8) return (col + row) % 4 === 0 ? 2 : 1;
  return (col * 3 + row * 5) % 17 === 0 ? 13 : 1;
}

const ground = Array.from({ length: COLUMNS * ROWS }, (_, index) => groundTile(index % COLUMNS, Math.floor(index / COLUMNS)));
const decor = Array.from({ length: COLUMNS * ROWS }, () => 0);
function setDecor(col: number, row: number, gid: number) { decor[row * COLUMNS + col] = gid; }

// Family niche: personal traces that have no optimized system purpose.
setDecor(3, 4, 17); // bench
setDecor(4, 5, 18); // bag + cup
setDecor(2, 3, 19); // drawing
setDecor(4, 7, 20); // warm family light
setDecor(4, 3, 25); // parent A
setDecor(5, 3, 26); // parent B
setDecor(5, 7, 32); // keepsake

// Transfer zone: CORE & SLOT as the center of the room.
setDecor(9, 5, 21); // cradle
setDecor(10, 5, 22); // transfer control
setDecor(8, 7, 23); // empty PICO dock
setDecor(10, 7, 14); // body parking slot
setDecor(8, 3, 30); // route guidance
setDecor(10, 3, 30);

// Machine society: PRIMUS order, Kayo status and utilitarian work.
setDecor(14, 6, 27); // Kayo, orange
setDecor(16, 6, 28); // PRIMUS, black
setDecor(15, 3, 24); // PRIMUS terminal
setDecor(16, 3, 15); // data plate
setDecor(14, 8, 29); // crate
setDecor(16, 8, 31); // service console
setDecor(13, 5, 16); // controlled threshold warning
setDecor(14, 5, 30);
setDecor(15, 5, 30);

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

const rooms = [
  { id: 210, name: "family-niche", x: 2 * TILE, y: 2 * TILE, width: 4 * TILE, height: 7 * TILE, properties: [prop("label", "FAMILIENBEREICH", "string"), prop("subtitle", "PERSÖNLICHE DINGE · KEIN ZUGEWIESENER ZWECK", "string")] },
  { id: 211, name: "transfer-zone", x: 7 * TILE, y: 2 * TILE, width: 5 * TILE, height: 7 * TILE, properties: [prop("label", "TRANSFER", "string"), prop("subtitle", "CORE → SLOT · KÖRPERWAHL", "string")] },
  { id: 212, name: "machine-exit", x: 13 * TILE, y: 2 * TILE, width: 5 * TILE, height: 7 * TILE, properties: [prop("label", "PRIMUS-ZUTEILUNG", "string"), prop("subtitle", "ROLLEN · ROUTEN · ARBEIT", "string")] },
];

const encounters = [
  {
    id: 300,
    name: "MAGNETAR 742 TRANSFERTECHNIK",
    x: 15.4 * TILE,
    y: 3.9 * TILE,
    properties: [
      prop("encounterId", "ts01-utility", "string"), prop("enemyId", "magnetar", "string"), prop("bodyId", "magnetar", "string"),
      prop("mode", "add-easy", "string"), prop("mathLabel", "+ ZIEL 6", "string"), prop("difficulty", "easy", "string"),
      prop("mathRole", "comfort", "string"), prop("retreatX", 14.2 * TILE, "float"), prop("retreatY", 4.2 * TILE, "float"),
      prop("behavior", "neutral", "string"), prop("patrolSpeed", 42, "float"),
      prop("patrolPath", "900,240;1010,240;1010,315;900,315", "string"),
      prop("storyIntro", "Ein normaler Arbeitskörper. Blau zeigt: Er gehört weder dir noch einem Gegner – er arbeitet einfach hier.", "string"),
    ],
  },
  {
    id: 301,
    name: "SENTRY-4 ZUGANGSWACHE",
    x: 16.2 * TILE,
    y: 8.2 * TILE,
    properties: [
      prop("encounterId", "ts01-guard", "string"), prop("enemyId", "sentry", "string"), prop("bodyId", "sentry", "string"),
      prop("mode", "add-easy", "string"), prop("mathLabel", "+ ZIEL 6", "string"), prop("difficulty", "easy", "string"),
      prop("mathRole", "comfort", "string"), prop("retreatX", 14.2 * TILE, "float"), prop("retreatY", 8.2 * TILE, "float"),
      prop("behavior", "patrol", "string"), prop("patrolSpeed", 64, "float"), prop("interceptRadius", 80, "float"),
      prop("patrolPath", "930,520;1080,520;1080,590;930,590", "string"),
      prop("storyIntro", "Rot bedeutet Gegenkontrolle. Derselbe Körper würde nach erfolgreicher Übernahme als Spieler grün gelesen.", "string"),
    ],
  },
];

export const TRANSFER_HALL_MAP: TiledMapJson = {
  orientation: "orthogonal",
  infinite: false,
  width: COLUMNS,
  height: ROWS,
  tilewidth: TILE,
  tileheight: TILE,
  properties: [
    prop("floorId", "transfer-hall", "string"),
    prop("floorName", "TS-01 · TRANSFER HALL", "string"),
    prop("subtitle", "ART SLICE · CORE & SLOT", "string"),
    prop("objectiveDefault", "ERKUNDE DEN TRANSFERBEREICH · VERGLEICHE FAMILIE, TRANSFER UND PRIMUS-ORDNUNG", "string"),
    prop("objectiveAfterEnergy", "ERKUNDE DEN TRANSFERBEREICH", "string"),
  ],
  tilesets: [{ firstgid: 1, image: "/assets/deck/vs2-tech-tiles.svg", tilewidth: TILE, tileheight: TILE, tilecount: 32, columns: 4, margin: 0, spacing: 0 }],
  layers: [
    { id: 1, name: "Ground", type: "tilelayer", width: COLUMNS, height: ROWS, data: ground, opacity: 1, visible: true },
    { id: 2, name: "Decor", type: "tilelayer", width: COLUMNS, height: ROWS, data: decor, opacity: 1, visible: true },
    { id: 10, name: "Start", type: "objectgroup", objects: [{ id: 100, name: "player-start", x: 7.45 * TILE, y: 6.45 * TILE, properties: [prop("bodyId", "pico", "string"), prop("facing", 90, "float"), prop("metaEnergy", 0, "int")] }] },
    { id: 11, name: "Walkable", type: "objectgroup", objects: rectObjects(WALKABLE, 110) },
    { id: 12, name: "Obstacles", type: "objectgroup", objects: rectObjects(OBSTACLES, 130) },
    { id: 13, name: "Rooms", type: "objectgroup", objects: rooms },
    { id: 14, name: "Doors", type: "objectgroup", objects: [{ id: 240, name: "transfer-threshold", x: 12 * TILE, y: 5 * TILE, width: TILE, height: 2 * TILE, properties: [prop("orientation", "vertical", "string"), prop("mode", "auto", "string"), prop("size", "large", "string"), prop("openRadius", 150, "float"), prop("label", "ZUTEILUNG", "string")] }] },
    { id: 15, name: "EnergyStations", type: "objectgroup", objects: [] },
    { id: 16, name: "Encounters", type: "objectgroup", objects: encounters },
    { id: 17, name: "Pickups", type: "objectgroup", objects: [] },
    { id: 18, name: "Actions", type: "objectgroup", objects: [] },
  ],
};
