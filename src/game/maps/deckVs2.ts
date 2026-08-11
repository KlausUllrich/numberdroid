import type { TiledMapJson } from "../tiled";

const COLUMNS = 40;
const ROWS = 24;
const TILE = 64;

function inBlock(col: number, row: number, x: number, y: number, w: number, h: number) {
  return col >= x && col < x + w && row >= y && row < y + h;
}

function groundTile(col: number, row: number) {
  if (col === 0 || row === 0 || col === COLUMNS - 1 || row === ROWS - 1) return 3;
  if (inBlock(col, row, 10, 7, 4, 5)) return 3;
  if (inBlock(col, row, 26, 7, 4, 5)) return 3;
  if (inBlock(col, row, 17, 13, 6, 4)) return 3;
  return (col + row * 3) % 11 === 0 ? 2 : 1;
}

const ground = Array.from({ length: COLUMNS * ROWS }, (_, index) => {
  const col = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  return groundTile(col, row);
});

const decor = Array.from({ length: COLUMNS * ROWS }, () => 0);
for (const [col, row] of [[6, 12], [20, 17], [33, 12]] as const) {
  decor[row * COLUMNS + col] = 4;
}

function prop(name: string, value: unknown, type = typeof value) {
  return { name, type, value };
}

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
    prop("subtitle", "TECHNISCHER VERTICAL-SLICE-2-FLOOR", "string"),
    prop("objectiveDefault", "ERKUNDE DECK B2 · FINDE ENERGIE · ÜBERNIMM DROIDEN", "string"),
    prop("objectiveAfterEnergy", "ENERGIE GESICHERT · WÄHLE DEINEN NÄCHSTEN DROIDEN", "string"),
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
    {
      id: 1,
      name: "Ground",
      type: "tilelayer",
      width: COLUMNS,
      height: ROWS,
      data: ground,
      opacity: 1,
      visible: true,
    },
    {
      id: 2,
      name: "Decor",
      type: "tilelayer",
      width: COLUMNS,
      height: ROWS,
      data: decor,
      opacity: 1,
      visible: true,
    },
    {
      id: 10,
      name: "Start",
      type: "objectgroup",
      objects: [
        {
          id: 100,
          name: "player-start",
          x: 1280,
          y: 1370,
          properties: [
            prop("bodyId", "pico", "string"),
            prop("facing", 0, "float"),
            prop("metaEnergy", 0, "int"),
          ],
        },
      ],
    },
    {
      id: 11,
      name: "Walkable",
      type: "objectgroup",
      objects: [
        { id: 110, name: "interior", x: 64, y: 64, width: 2432, height: 1408 },
      ],
    },
    {
      id: 12,
      name: "Obstacles",
      type: "objectgroup",
      objects: [
        { id: 120, name: "west-machinery", x: 640, y: 448, width: 256, height: 320 },
        { id: 121, name: "east-machinery", x: 1664, y: 448, width: 256, height: 320 },
        { id: 122, name: "central-reactor", x: 1088, y: 832, width: 384, height: 256 },
      ],
    },
    {
      id: 13,
      name: "EnergyStations",
      type: "objectgroup",
      objects: [
        { id: 130, name: "b2-energy-west", x: 420, y: 760, properties: [prop("energy", 1, "int"), prop("label", "ENERGIE ⚡ +1", "string")] },
        { id: 131, name: "b2-energy-center", x: 1280, y: 1160, properties: [prop("energy", 1, "int"), prop("label", "ENERGIE ⚡ +1", "string")] },
        { id: 132, name: "b2-energy-east", x: 2140, y: 760, properties: [prop("energy", 1, "int"), prop("label", "ENERGIE ⚡ +1", "string")] },
      ],
    },
    {
      id: 14,
      name: "Encounters",
      type: "objectgroup",
      objects: [
        {
          id: 140,
          name: "SENTRY-4 WEST",
          x: 330,
          y: 1180,
          properties: [
            prop("encounterId", "b2-sentry-west-low", "string"), prop("enemyId", "sentry", "string"), prop("bodyId", "sentry", "string"),
            prop("mode", "add-easy", "string"), prop("mathLabel", "+ ZIEL 6", "string"), prop("difficulty", "easy", "string"),
            prop("retreatX", 540, "float"), prop("retreatY", 1180, "float"),
          ],
        },
        {
          id: 141,
          name: "SENTRY-4 NORDWEST",
          x: 360,
          y: 320,
          properties: [
            prop("encounterId", "b2-sentry-west-high", "string"), prop("enemyId", "sentry", "string"), prop("bodyId", "sentry", "string"),
            prop("mode", "add-easy", "string"), prop("mathLabel", "+ ZIEL 6", "string"), prop("difficulty", "easy", "string"),
            prop("retreatX", 570, "float"), prop("retreatY", 320, "float"),
          ],
        },
        {
          id: 142,
          name: "MAGNETAR 742 OST",
          x: 2230,
          y: 1180,
          properties: [
            prop("encounterId", "b2-magnetar-east-low", "string"), prop("enemyId", "magnetar", "string"), prop("bodyId", "magnetar", "string"),
            prop("mode", "add-normal", "string"), prop("mathLabel", "+ ZIEL 8", "string"), prop("difficulty", "medium", "string"),
            prop("rewardLabel", "SIEG → MAGNETAR 742 + REIHENSCHUB →", "string"), prop("retreatX", 2020, "float"), prop("retreatY", 1180, "float"),
          ],
        },
        {
          id: 143,
          name: "MAGNETAR 742 NORDOST",
          x: 2200,
          y: 320,
          properties: [
            prop("encounterId", "b2-magnetar-east-high", "string"), prop("enemyId", "magnetar", "string"), prop("bodyId", "magnetar", "string"),
            prop("mode", "add-normal", "string"), prop("mathLabel", "+ ZIEL 8", "string"), prop("difficulty", "medium", "string"),
            prop("rewardLabel", "SIEG → MAGNETAR 742 + REIHENSCHUB →", "string"), prop("retreatX", 1990, "float"), prop("retreatY", 320, "float"),
          ],
        },
        {
          id: 144,
          name: "KRONOS-9 ZENTRUM",
          x: 1010,
          y: 640,
          properties: [
            prop("encounterId", "b2-kronos-center-west", "string"), prop("enemyId", "kronos", "string"), prop("bodyId", "kronos", "string"),
            prop("mode", "add-hard", "string"), prop("mathLabel", "+ ZIEL 10", "string"), prop("difficulty", "hard", "string"),
            prop("retreatX", 1010, "float"), prop("retreatY", 800, "float"),
          ],
        },
        {
          id: 145,
          name: "KRONOS-9 MINUS",
          x: 1550,
          y: 640,
          properties: [
            prop("encounterId", "b2-kronos-center-east", "string"), prop("enemyId", "kronos", "string"), prop("bodyId", "kronos", "string"),
            prop("mode", "subtract", "string"), prop("mathLabel", "− ZIEL 8", "string"), prop("difficulty", "hard", "string"),
            prop("retreatX", 1550, "float"), prop("retreatY", 800, "float"),
          ],
        },
      ],
    },
  ],
};
