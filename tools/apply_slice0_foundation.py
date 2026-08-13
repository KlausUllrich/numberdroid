from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
TILE = 64
ATLAS = ROOT / "public/assets/deck/transfer-hall-tiles.png"

# --- 1) Thin-wall raster pass -------------------------------------------------
img = Image.open(ATLAS).convert("RGBA")
assert img.width == 256 and img.height >= 1280, f"unexpected atlas size {img.size}"


def box_for_gid(gid: int):
    local = gid - 1
    col = local % 4
    row = local // 4
    return (col * TILE, row * TILE, (col + 1) * TILE, (row + 1) * TILE)

base = img.crop(box_for_gid(1))


def make_wall(*edges: str, divider: bool = False):
    tile = base.copy()
    d = ImageDraw.Draw(tile, "RGBA")
    dark = (45, 55, 53, 255)
    mid = (91, 105, 101, 255)
    light = (221, 224, 218, 255)
    shadow = (19, 27, 26, 42)

    if divider:
        # An interior wall is a narrow architectural separator, not a full 64 px slab.
        d.rectangle((27, 0, 37, 63), fill=shadow)
        d.rectangle((29, 0, 35, 63), fill=dark)
        d.line((28, 0, 28, 63), fill=mid, width=1)
        d.line((36, 0, 36, 63), fill=light, width=1)
        return tile

    if "N" in edges:
        d.rectangle((0, 7, 63, 14), fill=shadow)
        d.rectangle((0, 2, 63, 8), fill=dark)
        d.line((0, 9, 63, 9), fill=light, width=2)
    if "S" in edges:
        d.rectangle((0, 50, 63, 57), fill=shadow)
        d.rectangle((0, 55, 63, 61), fill=dark)
        d.line((0, 53, 63, 53), fill=mid, width=2)
    if "W" in edges:
        d.rectangle((7, 0, 14, 63), fill=shadow)
        d.rectangle((2, 0, 8, 63), fill=dark)
        d.line((9, 0, 9, 63), fill=light, width=2)
    if "E" in edges:
        d.rectangle((50, 0, 57, 63), fill=shadow)
        d.rectangle((55, 0, 61, 63), fill=dark)
        d.line((53, 0, 53, 63), fill=mid, width=2)
    return tile

walls = {
    5: make_wall("N"),
    6: make_wall("E"),
    7: make_wall("S"),
    8: make_wall("W"),
    9: make_wall("N", "W"),
    10: make_wall("N", "E"),
    11: make_wall("S", "E"),
    12: make_wall("S", "W"),
    20: make_wall(divider=True),
}
for gid, tile in walls.items():
    img.paste(tile, box_for_gid(gid)[:2])
img.save(ATLAS, optimize=True)

# --- 2) Re-author the room foundation ----------------------------------------
map_path = ROOT / "src/game/maps/transferHall.ts"
map_path.write_text(r'''import type { TiledMapJson } from "../tiled";

const TILE = 64;
const COLUMNS = 20;
const ROWS = 12;
type TileRect = { name: string; x: number; y: number; w: number; h: number };
function prop(name: string, value: unknown, type: string = typeof value) { return { name, type, value }; }

const WALKABLE: TileRect[] = [{ name: "transfer-hall", x: 1, y: 1, w: 18, h: 10 }];

// SLICE 0 RULE: visual footprint and collision footprint are independent.
// Thin walls use thin blockers; wall-mounted props block only their protruding core.
const OBSTACLES: TileRect[] = [
  { name: "divider-north", x: 12.43, y: 1, w: 0.14, h: 4 },
  { name: "divider-south", x: 12.43, y: 7, w: 0.14, h: 4 },
  { name: "family-table-solid", x: 2.52, y: 4.58, w: 1.96, h: 0.82 },
  { name: "family-display-protrusion", x: 3.38, y: 1.56, w: 1.24, h: 0.70 },
  { name: "transfer-cradle-core", x: 8.70, y: 4.70, w: 1.60, h: 1.60 },
  { name: "primus-console-protrusion", x: 14.36, y: 1.54, w: 1.28, h: 0.72 },
  { name: "body-slot-bank-protrusion", x: 16.38, y: 1.54, w: 1.24, h: 0.70 },
];

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
  // Thin internal architectural separator. Rows 5–6 are the actual doorway.
  if (col === 12 && (row <= 4 || row >= 7)) return 20;
  if (col === 12) return 2;
  if (col >= 7 && col <= 11 && row >= 3 && row <= 8) return (col + row) % 4 === 0 ? 2 : 1;
  return (col * 3 + row * 5) % 17 === 0 ? 13 : 1;
}

const ground = Array.from({ length: COLUMNS * ROWS }, (_, i) => groundTile(i % COLUMNS, Math.floor(i / COLUMNS)));
const decor = Array.from({ length: COLUMNS * ROWS }, () => 0);
function setDecor(col: number, row: number, gid: number) { decor[row * COLUMNS + col] = gid; }
function block(col: number, row: number, gids: number[], width: number) { gids.forEach((gid,i) => setDecor(col + i % width, row + Math.floor(i / width), gid)); }

// SLICE 0 PLACEMENT GRAMMAR:
// - wall-mounted assets overlap the TOP wall and project downward into the room;
// - lower walls remain visually clean;
// - floor objects exist only when their function requires a floor position.
block(3,1,[68,69,70,71],2);                 // family display, wall-mounted 2x2
block(2,4,[33,34,35,36,37,38],3);          // family table, intentional floor prop 3x2
setDecor(4,7,17);                            // one personal trace, intentional floor prop
block(8,4,[39,40,41,42,43,44,45,46,47],3); // Transfer Cradle, hero floor setpiece 3x3
block(9,7,[48,49,50,51],2);                 // PICO dock, driveable floor pad 2x2
setDecor(10,3,14);                           // body parking SLOT: floor marking, not furniture
block(14,1,[52,53,54,55],2);                // PRIMUS allocation console, top-wall mounted
block(16,1,[76,77,78,79],2);                // body-slot bank, top-wall mounted
block(14,6,[56,57,58,59],2);                // Kayo status platform, intentional floor pad

function rectObjects(rects: TileRect[], firstId: number) { return rects.map((r,i)=>({id:firstId+i,name:r.name,x:r.x*TILE,y:r.y*TILE,width:r.w*TILE,height:r.h*TILE})); }

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
  properties:[prop("floorId","transfer-hall","string"),prop("floorName","TS-01 · TRANSFER HALL","string"),prop("subtitle","SLICE 0 · FOUNDATION","string"),prop("objectiveDefault","ERKUNDE FAMILIE → TRANSFER → PRIMUS-ZUTEILUNG","string"),prop("objectiveAfterEnergy","ERKUNDE DEN TRANSFERBEREICH","string")],
  tilesets:[{firstgid:1,image:"/assets/deck/transfer-hall-tiles.png",tilewidth:TILE,tileheight:TILE,tilecount:80,columns:4,margin:0,spacing:0}],
  layers:[
    {id:1,name:"Ground",type:"tilelayer",width:COLUMNS,height:ROWS,data:ground,opacity:1,visible:true},
    {id:2,name:"Decor",type:"tilelayer",width:COLUMNS,height:ROWS,data:decor,opacity:1,visible:true},
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
''', encoding="utf-8")

# --- 3) Regression tests -------------------------------------------------------
(ROOT / "src/game/transferHall.test.ts").write_text(r'''import { describe, expect, it } from "vitest";
import { pointWalkable } from "./save";

const TILE = 64;

describe("Transfer Hall Slice 0 traversal contract", () => {
  it("keeps the allocation doorway clear on approach, threshold and exit", () => {
    const y = 6 * TILE;
    expect(pointWalkable(11.45*TILE,y,"transfer-hall",18)).toBe(true);
    expect(pointWalkable(12.5*TILE,y,"transfer-hall",18)).toBe(true);
    expect(pointWalkable(13.55*TILE,y,"transfer-hall",18)).toBe(true);
  });

  it("makes the divider physically thin instead of a full tile slab", () => {
    const y = 3 * TILE;
    expect(pointWalkable(12.20*TILE,y,"transfer-hall",8)).toBe(true);
    expect(pointWalkable(12.50*TILE,y,"transfer-hall",8)).toBe(false);
    expect(pointWalkable(12.80*TILE,y,"transfer-hall",8)).toBe(true);
  });

  it("keeps intentional floor pads driveable", () => {
    expect(pointWalkable(10*TILE,8*TILE,"transfer-hall",18)).toBe(true);
    expect(pointWalkable(14.4*TILE,6.8*TILE,"transfer-hall",18)).toBe(true);
  });

  it("blocks only the solid Transfer Cradle core", () => {
    expect(pointWalkable(9.5*TILE,5.5*TILE,"transfer-hall",18)).toBe(false);
    expect(pointWalkable(8.30*TILE,5.5*TILE,"transfer-hall",12)).toBe(true);
  });
});
''', encoding="utf-8")

(ROOT / "src/game/previewFlow.test.ts").write_text(r'''import { afterEach, describe, expect, it, vi } from "vitest";
import { getPreviewFloorId } from "./floors";

afterEach(() => vi.unstubAllGlobals());

describe("preview floor routing", () => {
  it("resolves the direct Transfer Hall preview explicitly", () => {
    vi.stubGlobal("window", { location: { search: "?floor=transfer-hall" } });
    expect(getPreviewFloorId()).toBe("transfer-hall");
  });

  it("does not activate preview routing on a normal launch", () => {
    vi.stubGlobal("window", { location: { search: "" } });
    expect(getPreviewFloorId()).toBeNull();
  });
});
''', encoding="utf-8")

# --- 4) Expose layer semantics to CSS -----------------------------------------
floor_visual = ROOT / "src/meta/FloorVisual.tsx"
text = floor_visual.read_text(encoding="utf-8")
old = '<div key={layer.id} className="zk-tilemap-layer" style={{ opacity: layer.opacity ?? 1 }}>'
new = '<div key={layer.id} className="zk-tilemap-layer" data-layer-id={layer.id} data-layer-name={layer.name} style={{ opacity: layer.opacity ?? 1 }}>'
if old not in text:
    raise SystemExit("FloorVisual layer wrapper signature changed")
floor_visual.write_text(text.replace(old, new), encoding="utf-8")

# --- 5) Quiet light hierarchy + transfer emissive -----------------------------
css_path = ROOT / "src/meta/MetaGameMotion.css"
css = css_path.read_text(encoding="utf-8")
marker = "/* SLICE 0 FOUNDATION */"
if marker in css:
    css = css.split(marker)[0].rstrip() + "\n"
css += r'''

/* SLICE 0 FOUNDATION */
/* Early Transfer Ship lighting stays calm. The Transfer core is the single strong emissive. */
.zk-meta-shell[data-floor-id="transfer-hall"] .zk-tilemap-layer[data-layer-name="Decor"] {
  filter: none;
}
.zk-meta-shell[data-floor-id="transfer-hall"] .zk-map-tile[data-tile-id="43"] {
  animation: nd-slice0-transfer-core 2.5s ease-in-out infinite;
  filter: drop-shadow(0 0 5px rgba(239, 171, 58, .42));
}
@keyframes nd-slice0-transfer-core {
  0%, 100% { filter: drop-shadow(0 0 4px rgba(239,171,58,.34)) brightness(1); }
  50% { filter: drop-shadow(0 0 11px rgba(239,171,58,.62)) brightness(1.08); }
}
@media (prefers-reduced-motion: reduce) {
  .zk-meta-shell[data-floor-id="transfer-hall"] .zk-map-tile[data-tile-id="43"] { animation: none; }
}
'''
css_path.write_text(css, encoding="utf-8")

# --- 6) Binding production rules / definition of done -------------------------
doc_path = ROOT / "ART_PRODUCTION_RULES_TRANSFER_SHIP.md"
doc = doc_path.read_text(encoding="utf-8")
doc = doc.replace("Transfer Ship Art Production Rules v0.2", "Transfer Ship Art Production Rules v0.3", 1)
section = r'''

## Slice 0 Foundation — binding room grammar

Slice 0 deliberately fixes the room grammar before the Gold Slice replaces the art with target-quality assets.

### Thin-wall rule

Walls are architectural boundaries, not 64×64 solid slabs. Outer walls render as narrow bands on the outside edge of a floor cell. Interior separators use a narrow centered band and a matching narrow collision rectangle. The player may approach a wall closely, but cannot cross it.

A visible opening MUST be physically traversable. A closed wall MUST block. Door clearance is reserved on both sides of the opening.

### Placement classes

Every prop belongs to one of four placement classes:

1. **floor marking** — painted/inset and never blocks movement;
2. **intentional floor prop / hero setpiece** — may sit in open floor because its function requires it;
3. **wall-mounted prop** — anchored to an upper wall and allowed to overlap downward into the room;
4. **character/entity** — positioned independently from the tile atlas.

Do not scatter wall furniture as isolated floor icons.

### Orthographic overlap rule

Upper walls may carry equipment that overlaps downward into the room. Lower walls remain visually clean; equipment must not overlap upward from the lower wall because that fights player/world readability in this camera.

### Visual footprint vs collision footprint

Visual art, collision and interaction clearance are separate data. Multi-tile art MUST NOT automatically become a full rectangular blocker. Floor pads such as PICO/Kayo platforms are driveable. Hero machinery blocks only its visibly solid mass.

### Shadow and early-light rule

Important props receive controlled contact shadows in the art. Early Transfer Ship rooms use calm, even ambient illumination. Emissive accents are sparse. In Slice 0, the Transfer core is intentionally the strongest local glow; large dynamic lighting effects are reserved for later escalation.

### Preview-flow rule

`?floor=transfer-hall` is an explicit developer/art preview route and intentionally bypasses intro/title/hub. A normal launch without the query parameter must continue through the normal menu flow.

### Slice 0 definition of done

- no visible accidental gaps in the room perimeter;
- outer and interior walls read as thin architectural bands rather than square wall plates;
- visible openings match traversal;
- the two-cell allocation doorway is clear on approach, threshold and exit;
- wall-mounted assets are anchored to the upper wall rather than scattered across the floor;
- lower walls remain free of overlapping furniture;
- floor pads remain driveable unless visibly solid;
- the Transfer Cradle blocks only its solid core;
- room lighting stays quiet, with a restrained Transfer-core emissive;
- normal launch and direct preview routing are both regression-tested.
'''
if "## Slice 0 Foundation — binding room grammar" not in doc:
    doc += section
doc_path.write_text(doc, encoding="utf-8")

print("Slice 0 foundation applied")
