import type { TiledMapJson } from "../tiled";

const TILE = 64;
const COLUMNS = 20;
const ROWS = 12;
type TileRect = { name: string; x: number; y: number; w: number; h: number };
function prop(name: string, value: unknown, type: string = typeof value) { return { name, type, value }; }
const WALKABLE: TileRect[] = [{ name: "transfer-hall", x: 1, y: 1, w: 18, h: 10 }];
const OBSTACLES: TileRect[] = [
  { name: "divider-north", x: 12, y: 1, w: 1, h: 4 },
  { name: "divider-south", x: 12, y: 7, w: 1, h: 4 },
  { name: "family-niche", x: 2.05, y: 4.05, w: 2.9, h: 1.9 },
  { name: "family-display", x: 3.05, y: 2.05, w: 1.9, h: 1.9 },
  { name: "transfer-cradle", x: 8.08, y: 4.08, w: 2.84, h: 2.84 },
  { name: "pico-dock", x: 9.08, y: 7.08, w: 1.84, h: 1.84 },
  { name: "primus-console", x: 14.08, y: 2.08, w: 1.84, h: 1.84 },
  { name: "kayo-platform", x: 13.08, y: 5.08, w: 1.84, h: 1.84 },
  { name: "primus-pylon", x: 16.08, y: 5.08, w: 1.84, h: 1.84 },
  { name: "machine-rack", x: 13.08, y: 8.08, w: 1.84, h: 1.84 },
];
function groundTile(col: number, row: number) {
  if (col < 1 || col > 18 || row < 1 || row > 10) return 3;
  if (col === 1 && row === 1) return 9; if (col === 18 && row === 1) return 10; if (col === 18 && row === 10) return 11; if (col === 1 && row === 10) return 12;
  if (row === 1) return 5; if (col === 18) return 6; if (row === 10) return 7; if (col === 1) return 8;
  if (col === 12 && (row <= 4 || row >= 7)) return 3; if (col === 12) return 2;
  if (col >= 7 && col <= 11 && row >= 3 && row <= 8) return (col + row) % 4 === 0 ? 2 : 1;
  return (col * 3 + row * 5) % 17 === 0 ? 13 : 1;
}
const ground = Array.from({ length: COLUMNS * ROWS }, (_, i) => groundTile(i % COLUMNS, Math.floor(i / COLUMNS)));
const decor = Array.from({ length: COLUMNS * ROWS }, () => 0);
function setDecor(col: number, row: number, gid: number) { decor[row * COLUMNS + col] = gid; }
function block(col: number, row: number, gids: number[], width: number) { gids.forEach((gid,i) => setDecor(col + i % width, row + Math.floor(i / width), gid)); }
// Multi-tile focal props. Each is assembled from atlas fragments but reads as one world-space object.
block(2,4,[33,34,35,36,37,38],3);       // family table + parents, 3x2
block(3,2,[68,69,70,71],2);             // personal family display, 2x2
setDecor(4,7,17);                         // warm personal trace
block(8,4,[39,40,41,42,43,44,45,46,47],3); // Transfer Cradle, 3x3
block(9,7,[48,49,50,51],2);             // PICO dock, 2x2
setDecor(10,3,14);                        // body parking SLOT
block(14,2,[52,53,54,55],2);            // PRIMUS allocation console, 2x2
block(13,5,[56,57,58,59],2);            // Kayo premium platform, 2x2
block(16,5,[60,61,62,63],2);            // PRIMUS pylon, 2x2
block(13,8,[64,65,66,67],2);            // machine rack, 2x2
block(16,8,[76,77,78,79],2);            // body-slot bank, 2x2
setDecor(13,4,16); setDecor(14,4,30); setDecor(15,4,30);
function rectObjects(rects: TileRect[], firstId: number) { return rects.map((r,i)=>({id:firstId+i,name:r.name,x:r.x*TILE,y:r.y*TILE,width:r.w*TILE,height:r.h*TILE})); }
const rooms = [
  { id:210,name:"family-niche",x:2*TILE,y:2*TILE,width:4*TILE,height:7*TILE,properties:[prop("label","FAMILIENBEREICH","string"),prop("subtitle","PERSÖNLICHE DINGE · KEIN ZUGEWIESENER ZWECK","string")] },
  { id:211,name:"transfer-zone",x:7*TILE,y:2*TILE,width:5*TILE,height:7*TILE,properties:[prop("label","TRANSFER","string"),prop("subtitle","CORE → SLOT · KÖRPERWAHL","string")] },
  { id:212,name:"machine-exit",x:13*TILE,y:2*TILE,width:5*TILE,height:8*TILE,properties:[prop("label","PRIMUS-ZUTEILUNG","string"),prop("subtitle","ROLLEN · ROUTEN · ARBEIT","string")] },
];
const encounters = [
  { id:300,name:"MAGNETAR 742 TRANSFERTECHNIK",x:17.2*TILE,y:3.65*TILE,properties:[prop("encounterId","ts01-utility","string"),prop("enemyId","magnetar","string"),prop("bodyId","magnetar","string"),prop("mode","add-easy","string"),prop("mathLabel","+ ZIEL 6","string"),prop("difficulty","easy","string"),prop("mathRole","comfort","string"),prop("retreatX",16.2*TILE,"float"),prop("retreatY",3.7*TILE,"float"),prop("behavior","neutral","string"),prop("patrolSpeed",42,"float"),prop("patrolPath","1060,228;1130,228;1130,280;1060,280","string"),prop("storyIntro","Ein normaler Arbeitskörper. Blau zeigt: Er gehört weder dir noch einem Gegner – er arbeitet einfach hier.","string")] },
  { id:301,name:"SENTRY-4 ZUGANGSWACHE",x:15.7*TILE,y:9.35*TILE,properties:[prop("encounterId","ts01-guard","string"),prop("enemyId","sentry","string"),prop("bodyId","sentry","string"),prop("mode","add-easy","string"),prop("mathLabel","+ ZIEL 6","string"),prop("difficulty","easy","string"),prop("mathRole","comfort","string"),prop("retreatX",15.4*TILE,"float"),prop("retreatY",8.9*TILE,"float"),prop("behavior","patrol","string"),prop("patrolSpeed",64,"float"),prop("interceptRadius",80,"float"),prop("patrolPath","960,600;1110,600;1110,640;960,640","string"),prop("storyIntro","Rot bedeutet Gegenkontrolle. Derselbe Körper würde nach erfolgreicher Übernahme als Spieler grün gelesen.","string")] },
];
export const TRANSFER_HALL_MAP: TiledMapJson = {
  orientation:"orthogonal", infinite:false, width:COLUMNS, height:ROWS, tilewidth:TILE, tileheight:TILE,
  properties:[prop("floorId","transfer-hall","string"),prop("floorName","TS-01 · TRANSFER HALL","string"),prop("subtitle","MOCKUP ALIGNMENT · CORE & SLOT","string"),prop("objectiveDefault","ERKUNDE FAMILIE → TRANSFER → PRIMUS-ZUTEILUNG","string"),prop("objectiveAfterEnergy","ERKUNDE DEN TRANSFERBEREICH","string")],
  tilesets:[{firstgid:1,image:"/assets/deck/transfer-hall-tiles.png",tilewidth:TILE,tileheight:TILE,tilecount:80,columns:4,margin:0,spacing:0}],
  layers:[
    {id:1,name:"Ground",type:"tilelayer",width:COLUMNS,height:ROWS,data:ground,opacity:1,visible:true},
    {id:2,name:"Decor",type:"tilelayer",width:COLUMNS,height:ROWS,data:decor,opacity:1,visible:true},
    {id:10,name:"Start",type:"objectgroup",objects:[{id:100,name:"player-start",x:7.35*TILE,y:6.45*TILE,properties:[prop("bodyId","pico","string"),prop("facing",90,"float"),prop("metaEnergy",0,"int")]}]},
    {id:11,name:"Walkable",type:"objectgroup",objects:rectObjects(WALKABLE,110)},
    {id:12,name:"Obstacles",type:"objectgroup",objects:rectObjects(OBSTACLES,130)},
    {id:13,name:"Rooms",type:"objectgroup",objects:rooms},
    {id:14,name:"Doors",type:"objectgroup",objects:[{id:240,name:"transfer-threshold",x:12*TILE,y:5*TILE,width:TILE,height:2*TILE,properties:[prop("orientation","vertical","string"),prop("mode","auto","string"),prop("size","large","string"),prop("openRadius",150,"float"),prop("label","ZUTEILUNG","string")]}]},
    {id:15,name:"EnergyStations",type:"objectgroup",objects:[]},{id:16,name:"Encounters",type:"objectgroup",objects:encounters},{id:17,name:"Pickups",type:"objectgroup",objects:[]},{id:18,name:"Actions",type:"objectgroup",objects:[]},
  ],
};
