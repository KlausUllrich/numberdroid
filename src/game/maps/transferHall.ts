import type { TiledMapJson } from "../tiled";

const TILE = 64;
const COLUMNS = 20;
const ROWS = 12;
type TileRect = { name: string; x: number; y: number; w: number; h: number };
function prop(name: string, value: unknown, type: string = typeof value) { return { name, type, value }; }

const WALKABLE: TileRect[] = [{ name: "transfer-hall", x: 1, y: 1, w: 18, h: 10 }];

// 10 px visual wall centered on the former divider centerline.
const WALL_THICKNESS = 10 / TILE;
const DIVIDER_X = 12.5 - WALL_THICKNESS / 2;
const OBSTACLES: TileRect[] = [
  { name: "divider-north", x: DIVIDER_X, y: 1, w: WALL_THICKNESS, h: 4 },
  { name: "divider-south", x: DIVIDER_X, y: 7, w: WALL_THICKNESS, h: 4 },
  { name: "family-table-solid", x: 2.52, y: 4.58, w: 1.96, h: 0.82 },
  { name: "family-display-protrusion", x: 3.25, y: 1.08, w: 1.50, h: 0.56 },
  { name: "transfer-cradle-core", x: 8.70, y: 4.70, w: 1.60, h: 1.60 },
  { name: "primus-console-protrusion", x: 14.20, y: 1.08, w: 1.60, h: 0.58 },
  { name: "body-slot-bank-protrusion", x: 16.20, y: 1.08, w: 1.60, h: 0.58 },
];

const layer = () => Array.from({ length: COLUMNS * ROWS }, () => 0);
function setCell(target: number[], col: number, row: number, gid: number) { target[row * COLUMNS + col] = gid; }
function block(target: number[], col: number, row: number, gids: number[], width: number) {
  gids.forEach((gid, i) => setCell(target, col + i % width, row + Math.floor(i / width), gid));
}

const ground = layer();
for (let row = 1; row <= 10; row += 1) {
  for (let col = 1; col <= 18; col += 1) {
    const service = col >= 7 && col <= 11 && row >= 3 && row <= 8 && (col + row) % 4 === 0;
    setCell(ground, col, row, service ? 2 : 1);
  }
}

// Architecture contains semantic geometry markers only.
const architecture = layer();
for (let col = 2; col <= 17; col += 1) {
  setCell(architecture, col, 1, 81);
  setCell(architecture, col, 10, 82);
}
for (let row = 2; row <= 9; row += 1) {
  setCell(architecture, 1, row, 83);
  setCell(architecture, 18, row, 84);
}
setCell(architecture, 1, 1, 85);
setCell(architecture, 18, 1, 86);
setCell(architecture, 18, 10, 87);
setCell(architecture, 1, 10, 88);
setCell(architecture, 12, 1, 90);
setCell(architecture, 12, 2, 89);
setCell(architecture, 12, 3, 89);
setCell(architecture, 12, 4, 92);
setCell(architecture, 12, 7, 93);
setCell(architecture, 12, 8, 89);
setCell(architecture, 12, 9, 89);
setCell(architecture, 12, 10, 91);

// FloorFX is strictly floor-projected non-light FX.
const floorFx = layer();
block(floorFx, 2, 4, [167,168,169,170,171,172], 3);
block(floorFx, 9, 7, [112,113,114,115], 2);
block(floorFx, 14, 6, [116,117,118,119], 2);

const wallProps = layer();
block(wallProps, 3, 1, [173,174], 2);
block(wallProps, 14, 1, [131,132], 2);
block(wallProps, 16, 1, [133,134], 2);

const floorProps = layer();
block(floorProps, 2, 4, [161,162,163,164,165,166], 3);
block(floorProps, 8, 4, [141,142,143,144,145,146,147,148,149], 3);
block(floorProps, 9, 7, [150,151,152,153], 2);
block(floorProps, 14, 6, [154,155,156,157], 2);

function rectObjects(rects: TileRect[], firstId: number) {
  return rects.map((r,i)=>({id:firstId+i,name:r.name,x:r.x*TILE,y:r.y*TILE,width:r.w*TILE,height:r.h*TILE}));
}

const rooms = [
  { id:210,name:"family-niche",x:2*TILE,y:2*TILE,width:4*TILE,height:7*TILE,properties:[prop("label","FAMILIENBEREICH","string"),prop("subtitle","PERSÖNLICHE DINGE · KEIN ZUGEWIESENER ZWECK","string")] },
  { id:211,name:"transfer-zone",x:7*TILE,y:2*TILE,width:5*TILE,height:7*TILE,properties:[prop("label","TRANSFER","string"),prop("subtitle","CORE → SLOT · KÖRPERWAHL","string")] },
  { id:212,name:"machine-exit",x:13*TILE,y:2*TILE,width:5*TILE,height:8*TILE,properties:[prop("label","PRIMUS-ZUTEILUNG","string"),prop("subtitle","ROLLEN · ROUTEN · ARBEIT","string")] },
];

const encounters = [
  { id:300,name:"MAGNETAR 742",x:17.2*TILE,y:3.65*TILE,properties:[prop("encounterId","ts01-utility","string"),prop("enemyId","magnetar","string"),prop("bodyId","magnetar","string"),prop("mode","add-easy","string"),prop("mathLabel","+ ZIEL 6","string"),prop("difficulty","easy","string"),prop("mathRole","comfort","string"),prop("retreatX",16.2*TILE,"float"),prop("retreatY",3.7*TILE,"float"),prop("behavior","neutral","string"),prop("patrolSpeed",42,"float"),prop("patrolPath","1060,228;1130,228;1130,280;1060,280","string"),prop("storyIntro","Ein normaler Arbeitskörper. Blau zeigt: Er gehört weder dir noch einem Gegner – er arbeitet einfach hier.","string")] },
  { id:301,name:"SENTRY-4",x:15.7*TILE,y:9.35*TILE,properties:[prop("encounterId","ts01-guard","string"),prop("enemyId","sentry","string"),prop("bodyId","sentry","string"),prop("mode","add-easy","string"),prop("mathLabel","+ ZIEL 6","string"),prop("difficulty","easy","string"),prop("mathRole","comfort","string"),prop("retreatX",15.4*TILE,"float"),prop("retreatY",8.9*TILE,"float"),prop("behavior","patrol","string"),prop("patrolSpeed",64,"float"),prop("interceptRadius",80,"float"),prop("patrolPath","960,600;1110,600;1110,640;960,640","string"),prop("storyIntro","Rot bedeutet Gegenkontrolle. Derselbe Körper würde nach erfolgreicher Übernahme als Spieler grün gelesen.","string")] },
];

export const TRANSFER_HALL_MAP: TiledMapJson = {
  orientation:"orthogonal", infinite:false, width:COLUMNS, height:ROWS, tilewidth:TILE, tileheight:TILE,
  properties:[prop("floorId","transfer-hall","string"),prop("floorName","TS-01 · TRANSFER HALL","string"),prop("subtitle","SLICE 0 · FINAL FOUNDATION","string"),prop("objectiveDefault","ERKUNDE FAMILIE → TRANSFER → PRIMUS-ZUTEILUNG","string"),prop("objectiveAfterEnergy","ERKUNDE DEN TRANSFERBEREICH","string")],
  tilesets:[
    {firstgid:1,image:"/assets/deck/transfer-hall-tiles.png",tilewidth:TILE,tileheight:TILE,tilecount:4,columns:4,margin:0,spacing:0},
    {firstgid:81,image:"/assets/deck/transfer-hall-architecture.png",tilewidth:TILE,tileheight:TILE,tilecount:16,columns:4,margin:0,spacing:0},
    {firstgid:97,image:"/assets/deck/transfer-hall-floorfx.png",tilewidth:TILE,tileheight:TILE,tilecount:32,columns:4,margin:0,spacing:0},
    {firstgid:129,image:"/assets/deck/transfer-hall-props.png",tilewidth:TILE,tileheight:TILE,tilecount:32,columns:4,margin:0,spacing:0},
    {firstgid:161,image:"/assets/deck/family-table-props.png",tilewidth:TILE,tileheight:TILE,tilecount:6,columns:3,margin:0,spacing:0},
    {firstgid:167,image:"/assets/deck/family-table-shadow.png",tilewidth:TILE,tileheight:TILE,tilecount:6,columns:3,margin:0,spacing:0},
    {firstgid:173,image:"/assets/deck/family-memory-console.png",tilewidth:TILE,tileheight:TILE,tilecount:2,columns:2,margin:0,spacing:0},
  ],
  layers:[
    {id:1,name:"Ground",type:"tilelayer",width:COLUMNS,height:ROWS,data:ground,opacity:1,visible:true},
    {id:2,name:"FloorFX",type:"tilelayer",width:COLUMNS,height:ROWS,data:floorFx,opacity:1,visible:true},
    {id:3,name:"Architecture",type:"tilelayer",width:COLUMNS,height:ROWS,data:architecture,opacity:1,visible:true},
    {id:4,name:"WallProps",type:"tilelayer",width:COLUMNS,height:ROWS,data:wallProps,opacity:1,visible:true},
    {id:5,name:"FloorProps",type:"tilelayer",width:COLUMNS,height:ROWS,data:floorProps,opacity:1,visible:true},
    {id:10,name:"Start",type:"objectgroup",objects:[{id:100,name:"player-start",x:7.35*TILE,y:6.45*TILE,properties:[prop("bodyId","pico","string"),prop("facing",90,"float"),prop("metaEnergy",0,"int")]}]},
    {id:11,name:"Walkable",type:"objectgroup",objects:rectObjects(WALKABLE,110)},
    {id:12,name:"Obstacles",type:"objectgroup",objects:rectObjects(OBSTACLES,130)},
    {id:13,name:"Rooms",type:"objectgroup",objects:rooms},
    {id:14,name:"Doors",type:"objectgroup",objects:[{id:240,name:"transfer-threshold",x:12*TILE,y:5*TILE,width:TILE,height:2*TILE,properties:[prop("orientation","vertical","string"),prop("mode","auto","string"),prop("size","large","string"),prop("openRadius",150,"float"),prop("label","ZUTEILUNG","string")]}]},
    {id:15,name:"EnergyStations",type:"objectgroup",objects:[]},
    {id:16,name:"Encounters",type:"objectgroup",objects:encounters},
    {id:17,name:"Pickups",type:"objectgroup",objects:[]},
    {id:18,name:"Actions",type:"objectgroup",objects:[]},
  ],
};
