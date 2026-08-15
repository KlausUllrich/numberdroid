import type { TiledMapJson } from "../tiled";

const TILE = 64;
const COLUMNS = 25;
const ROWS = 20;

type TileRect = { name: string; x: number; y: number; w: number; h: number };
type Side = "top" | "bottom" | "left" | "right";
type Opening = { side: Side; cells: number[] };

type RoomBox = {
  name: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  openings?: Opening[];
};

function prop(name: string, value: unknown, type: string = typeof value) {
  return { name, type, value };
}

const ROOM_BOXES: RoomBox[] = [
  {
    name: "family-living",
    left: 1,
    top: 1,
    right: 8,
    bottom: 7,
    openings: [
      { side: "right", cells: [4, 5] },
      { side: "bottom", cells: [2, 3, 6, 7] },
    ],
  },
  {
    name: "family-child",
    left: 1,
    top: 8,
    right: 5,
    bottom: 13,
    openings: [{ side: "top", cells: [2, 3] }],
  },
  {
    name: "family-hygiene",
    left: 6,
    top: 8,
    right: 8,
    bottom: 12,
    openings: [{ side: "top", cells: [6, 7] }],
  },
  {
    name: "main-hall",
    left: 9,
    top: 3,
    right: 13,
    bottom: 13,
    openings: [
      { side: "left", cells: [4, 5] },
      { side: "right", cells: [4, 5] },
      { side: "bottom", cells: [10, 11] },
    ],
  },
  {
    name: "primus-allocation",
    left: 14,
    top: 1,
    right: 23,
    bottom: 9,
    openings: [{ side: "left", cells: [4, 5] }],
  },
  {
    name: "transfer-room",
    left: 8,
    top: 14,
    right: 18,
    bottom: 19,
    openings: [{ side: "top", cells: [10, 11] }],
  },
];

// Room interiors are intentionally separate rectangles connected by explicit doorway strips.
// This keeps the deployed layout non-rectangular and makes circulation topology testable.
const WALKABLE: TileRect[] = [
  { name: "family-living", x: 1, y: 1, w: 7, h: 6 },
  { name: "living-to-hall", x: 8, y: 4, w: 1, h: 2 },
  { name: "family-child", x: 1, y: 8, w: 4, h: 5 },
  { name: "living-to-child", x: 2, y: 7, w: 2, h: 1 },
  { name: "family-hygiene", x: 6, y: 8, w: 2, h: 4 },
  { name: "living-to-hygiene", x: 6, y: 7, w: 2, h: 1 },
  { name: "main-hall", x: 9, y: 3, w: 4, h: 10 },
  { name: "hall-to-primus", x: 13, y: 4, w: 1, h: 2 },
  { name: "primus-allocation", x: 14, y: 1, w: 9, h: 8 },
  { name: "hall-to-transfer", x: 10, y: 13, w: 2, h: 1 },
  { name: "transfer-room", x: 8, y: 14, w: 10, h: 5 },
];

const OBSTACLES: TileRect[] = [
  { name: "family-table-solid", x: 2.52, y: 3.58, w: 1.96, h: 0.82 },
  { name: "family-display-protrusion", x: 2.25, y: 1.408125, w: 1.50, h: 0.56 },
  { name: "family-coffee-machine-solid", x: 5.18, y: 1.52, w: 0.64, h: 0.82 },
  { name: "family-planter-trough-solid", x: 1.18, y: 9.55, w: 0.64, h: 0.90 },
  { name: "family-round-plant-solid", x: 7.20, y: 6.28, w: 0.60, h: 0.55 },
  { name: "family-hologram-solid", x: 10.18, y: 16.22, w: 0.64, h: 0.62 },
  { name: "transfer-cradle-core", x: 11.70, y: 15.70, w: 1.60, h: 1.60 },
  { name: "primus-console-protrusion", x: 17.20, y: 1.08, w: 1.60, h: 0.58 },
  { name: "body-slot-bank-protrusion", x: 20.20, y: 1.08, w: 1.60, h: 0.58 },
];

const layer = () => Array.from({ length: COLUMNS * ROWS }, () => 0);
function setCell(target: number[], col: number, row: number, gid: number) {
  target[row * COLUMNS + col] = gid;
}
function block(target: number[], col: number, row: number, gids: number[], width: number) {
  gids.forEach((gid, i) => setCell(target, col + (i % width), row + Math.floor(i / width), gid));
}
function openingHas(room: RoomBox, side: Side, cell: number) {
  return room.openings?.some((opening) => opening.side === side && opening.cells.includes(cell)) ?? false;
}

const ground = layer();
for (const room of ROOM_BOXES) {
  for (let row = room.top; row <= room.bottom; row += 1) {
    for (let col = room.left; col <= room.right; col += 1) setCell(ground, col, row, 1);
  }
}

// System areas receive sparse non-directional service registration; domestic rooms stay calmer.
for (let row = 2; row <= 8; row += 1) {
  for (let col = 15; col <= 22; col += 1) {
    if ((col + row) % 5 === 0) setCell(ground, col, row, 2);
  }
}
for (let row = 15; row <= 18; row += 1) {
  for (let col = 9; col <= 17; col += 1) {
    if ((col + row) % 5 === 0) setCell(ground, col, row, 2);
  }
}

// The accepted wall art outlines several functional volumes rather than one giant rectangle.
// Open cells are deliberate room connections; no decorative wall stubs are added.
const architecture = layer();
function drawRoom(room: RoomBox) {
  for (let col = room.left + 1; col < room.right; col += 1) {
    if (!openingHas(room, "top", col)) setCell(architecture, col, room.top, 81);
    if (!openingHas(room, "bottom", col)) setCell(architecture, col, room.bottom, 82);
  }
  for (let row = room.top + 1; row < room.bottom; row += 1) {
    if (!openingHas(room, "left", row)) setCell(architecture, room.left, row, 83);
    if (!openingHas(room, "right", row)) setCell(architecture, room.right, row, 84);
  }
  setCell(architecture, room.left, room.top, 85);
  setCell(architecture, room.right, room.top, 86);
  setCell(architecture, room.right, room.bottom, 87);
  setCell(architecture, room.left, room.bottom, 88);
}
ROOM_BOXES.forEach(drawRoom);

const floorFx = layer();
block(floorFx, 2, 1, [175, 176], 2);
block(floorFx, 5, 1, [179, 180], 1);
block(floorFx, 2, 3, [167, 168, 169, 170, 171, 172], 3);
block(floorFx, 1, 9, [183, 184], 1);
setCell(floorFx, 7, 6, 186);
setCell(floorFx, 10, 16, 188);
block(floorFx, 14, 16, [150, 151, 152, 153], 2);
block(floorFx, 18, 6, [116, 117, 118, 119], 2);

const wallProps = layer();
block(wallProps, 2, 1, [173, 174], 2);
block(wallProps, 5, 1, [177, 178], 1);
// Transfer support stays away from the hall entrance.
block(wallProps, 15, 14, [191, 192], 2);
block(wallProps, 11, 19, [197, 198], 2);
// PRIMUS uses aligned wall banks and leaves the threshold/patrol center clear.
setCell(wallProps, 15, 1, 199);
block(wallProps, 17, 1, [131, 132], 2);
block(wallProps, 20, 1, [133, 134], 2);
block(wallProps, 18, 9, [197, 198], 2);

const floorProps = layer();
block(floorProps, 2, 3, [161, 162, 163, 164, 165, 166], 3);
// Long planter deliberately hugs the west wall of the child-room pocket.
block(floorProps, 1, 9, [181, 182], 1);
// Round plant terminates the living-room edge instead of blocking wall furniture.
setCell(floorProps, 7, 6, 185);
// Personal bag near the living cluster, not in circulation.
setCell(floorProps, 5, 5, 195);
// Domestic topology blockouts: bed, hygiene and toy/personal storage.
block(floorProps, 2, 10, [201, 202], 2);
setCell(floorProps, 7, 9, 203);
setCell(floorProps, 4, 11, 204);

// Transfer destination: hero apparatus, control and Flow support form one room cluster.
block(floorProps, 11, 15, [141, 142, 143, 144, 145, 146, 147, 148, 149], 3);
setCell(floorProps, 10, 16, 187);
block(floorProps, 14, 16, [150, 151, 152, 153], 2);

function rectObjects(rects: TileRect[], firstId: number) {
  return rects.map((r, i) => ({
    id: firstId + i,
    name: r.name,
    x: r.x * TILE,
    y: r.y * TILE,
    width: r.w * TILE,
    height: r.h * TILE,
  }));
}

const rooms = [
  {
    id: 210,
    name: "family-living",
    x: 2 * TILE,
    y: 2 * TILE,
    width: 5 * TILE,
    height: 4 * TILE,
    properties: [
      prop("label", "FAMILIENBEREICH", "string"),
      prop("subtitle", "WOHNEN · PERSÖNLICHE DINGE", "string"),
    ],
  },
  {
    id: 211,
    name: "transfer-room",
    x: 9 * TILE,
    y: 15 * TILE,
    width: 8 * TILE,
    height: 3 * TILE,
    properties: [
      prop("label", "TRANSFER", "string"),
      prop("subtitle", "CORE → SLOT · KÖRPERWAHL", "string"),
    ],
  },
  {
    id: 212,
    name: "primus-allocation",
    x: 15 * TILE,
    y: 2 * TILE,
    width: 7 * TILE,
    height: 6 * TILE,
    properties: [
      prop("label", "PRIMUS-ZUTEILUNG", "string"),
      prop("subtitle", "ROLLEN · ROUTEN · ARBEIT", "string"),
    ],
  },
];

const encounters = [
  {
    id: 300,
    name: "MAGNETAR 742",
    x: 20.2 * TILE,
    y: 4.1 * TILE,
    properties: [
      prop("encounterId", "ts01-utility", "string"),
      prop("enemyId", "magnetar", "string"),
      prop("bodyId", "magnetar", "string"),
      prop("mode", "add-easy", "string"),
      prop("mathLabel", "+ ZIEL 6", "string"),
      prop("difficulty", "easy", "string"),
      prop("mathRole", "comfort", "string"),
      prop("retreatX", 19.2 * TILE, "float"),
      prop("retreatY", 4.1 * TILE, "float"),
      prop("behavior", "neutral", "string"),
      prop("patrolSpeed", 42, "float"),
      prop("patrolPath", "1160,250;1390,250;1390,350;1160,350", "string"),
      prop("storyIntro", "Ein normaler Arbeitskörper. Blau zeigt: Er gehört weder dir noch einem Gegner – er arbeitet einfach hier.", "string"),
    ],
  },
  {
    id: 301,
    name: "SENTRY-4",
    x: 18.0 * TILE,
    y: 7.0 * TILE,
    properties: [
      prop("encounterId", "ts01-guard", "string"),
      prop("enemyId", "sentry", "string"),
      prop("bodyId", "sentry", "string"),
      prop("mode", "add-easy", "string"),
      prop("mathLabel", "+ ZIEL 6", "string"),
      prop("difficulty", "easy", "string"),
      prop("mathRole", "comfort", "string"),
      prop("retreatX", 17.5 * TILE, "float"),
      prop("retreatY", 7.0 * TILE, "float"),
      prop("behavior", "patrol", "string"),
      prop("patrolSpeed", 64, "float"),
      prop("interceptRadius", 80, "float"),
      prop("patrolPath", "1000,450;1370,450;1370,520;1000,520", "string"),
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
    prop("subtitle", "GOLD SLICE · LAYOUT V3 PREVIEW", "string"),
    prop("objectiveDefault", "ERKUNDE WOHNEN → HALLE → TRANSFER / PRIMUS", "string"),
    prop("objectiveAfterEnergy", "ERKUNDE DEN TRANSFERBEREICH", "string"),
  ],
  tilesets: [
    { firstgid: 1, image: "/assets/deck/transfer-hall-tiles.png", tilewidth: TILE, tileheight: TILE, tilecount: 4, columns: 4, margin: 0, spacing: 0 },
    { firstgid: 81, image: "/assets/deck/transfer-hall-architecture.png", tilewidth: TILE, tileheight: TILE, tilecount: 16, columns: 4, margin: 0, spacing: 0 },
    { firstgid: 97, image: "/assets/deck/transfer-hall-floorfx.png", tilewidth: TILE, tileheight: TILE, tilecount: 32, columns: 4, margin: 0, spacing: 0 },
    { firstgid: 129, image: "/assets/deck/transfer-hall-props.png", tilewidth: TILE, tileheight: TILE, tilecount: 32, columns: 4, margin: 0, spacing: 0 },
    { firstgid: 161, image: "/assets/deck/family-table-props.png", tilewidth: TILE, tileheight: TILE, tilecount: 6, columns: 3, margin: 0, spacing: 0 },
    { firstgid: 167, image: "/assets/deck/family-table-shadow.png", tilewidth: TILE, tileheight: TILE, tilecount: 6, columns: 3, margin: 0, spacing: 0 },
    { firstgid: 173, image: "/assets/deck/family-memory-console.png", tilewidth: TILE, tileheight: TILE, tilecount: 2, columns: 2, margin: 0, spacing: 0 },
    { firstgid: 175, image: "/assets/deck/family-memory-console-shadow.png", tilewidth: TILE, tileheight: TILE, tilecount: 2, columns: 2, margin: 0, spacing: 0 },
    { firstgid: 177, image: "/assets/deck/family-coffee-machine.png", tilewidth: TILE, tileheight: TILE, tilecount: 2, columns: 1, margin: 0, spacing: 0 },
    { firstgid: 179, image: "/assets/deck/family-coffee-machine-shadow.png", tilewidth: TILE, tileheight: TILE, tilecount: 2, columns: 1, margin: 0, spacing: 0 },
    { firstgid: 181, image: "/assets/deck/family-planter-trough.png", tilewidth: TILE, tileheight: TILE, tilecount: 2, columns: 1, margin: 0, spacing: 0 },
    { firstgid: 183, image: "/assets/deck/family-planter-trough-shadow.png", tilewidth: TILE, tileheight: TILE, tilecount: 2, columns: 1, margin: 0, spacing: 0 },
    { firstgid: 185, image: "/assets/deck/family-round-plant.png", tilewidth: TILE, tileheight: TILE, tilecount: 1, columns: 1, margin: 0, spacing: 0 },
    { firstgid: 186, image: "/assets/deck/family-round-plant-shadow.png", tilewidth: TILE, tileheight: TILE, tilecount: 1, columns: 1, margin: 0, spacing: 0 },
    { firstgid: 187, image: "/assets/deck/family-hologram-pedestal.png", tilewidth: TILE, tileheight: TILE, tilecount: 1, columns: 1, margin: 0, spacing: 0 },
    { firstgid: 188, image: "/assets/deck/family-hologram-pedestal-shadow.png", tilewidth: TILE, tileheight: TILE, tilecount: 1, columns: 1, margin: 0, spacing: 0 },
    { firstgid: 189, image: "/assets/deck/ts01-gold-slice-blockout-props.svg", tilewidth: TILE, tileheight: TILE, tilecount: 12, columns: 4, margin: 0, spacing: 0 },
    { firstgid: 201, image: "/assets/deck/ts01-domestic-blockout-props.svg", tilewidth: TILE, tileheight: TILE, tilecount: 4, columns: 4, margin: 0, spacing: 0 },
  ],
  layers: [
    { id: 1, name: "Ground", type: "tilelayer", width: COLUMNS, height: ROWS, data: ground, opacity: 1, visible: true },
    { id: 2, name: "FloorFX", type: "tilelayer", width: COLUMNS, height: ROWS, data: floorFx, opacity: 1, visible: true },
    { id: 3, name: "Architecture", type: "tilelayer", width: COLUMNS, height: ROWS, data: architecture, opacity: 1, visible: true },
    { id: 4, name: "WallProps", type: "tilelayer", width: COLUMNS, height: ROWS, data: wallProps, opacity: 1, visible: true },
    { id: 5, name: "FloorProps", type: "tilelayer", width: COLUMNS, height: ROWS, data: floorProps, opacity: 1, visible: true },
    {
      id: 10,
      name: "Start",
      type: "objectgroup",
      objects: [
        {
          id: 100,
          name: "player-start",
          x: 6.0 * TILE,
          y: 5.4 * TILE,
          properties: [prop("bodyId", "pico", "string"), prop("facing", 90, "float"), prop("metaEnergy", 0, "int")],
        },
      ],
    },
    { id: 11, name: "Walkable", type: "objectgroup", objects: rectObjects(WALKABLE, 110) },
    { id: 12, name: "Obstacles", type: "objectgroup", objects: rectObjects(OBSTACLES, 130) },
    { id: 13, name: "Rooms", type: "objectgroup", objects: rooms },
    {
      id: 14,
      name: "Doors",
      type: "objectgroup",
      objects: [
        {
          id: 240,
          name: "primus-threshold",
          x: 13 * TILE,
          y: 4 * TILE,
          width: TILE,
          height: 2 * TILE,
          properties: [
            prop("orientation", "vertical", "string"),
            prop("mode", "auto", "string"),
            prop("size", "large", "string"),
            prop("openRadius", 150, "float"),
            prop("label", "ZUTEILUNG", "string"),
          ],
        },
      ],
    },
    { id: 15, name: "EnergyStations", type: "objectgroup", objects: [] },
    { id: 16, name: "Encounters", type: "objectgroup", objects: encounters },
    { id: 17, name: "Pickups", type: "objectgroup", objects: [] },
    { id: 18, name: "Actions", type: "objectgroup", objects: [] },
  ],
};
