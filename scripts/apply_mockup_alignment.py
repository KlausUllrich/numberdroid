from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import math, random

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public" / "assets"
random.seed(42)
S = 64
COLS = 4
TILES = 80
ROWS = math.ceil(TILES / COLS)


def rr(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius, fill=fill, outline=outline, width=width)


def ceramic(edge=None, corner=None, service=False):
    im = Image.new("RGBA", (S, S), (205, 211, 207, 255))
    d = ImageDraw.Draw(im)
    for y in range(S):
        t = y / 63
        c = int(222 - 23 * t)
        d.line((0, y, 64, y), fill=(c, c + 3, c + 1, 255))
    d.rounded_rectangle((2, 2, 61, 61), 5, outline=(148, 158, 154, 180), width=1)
    d.line((32, 3, 32, 61), fill=(174, 181, 178, 80))
    d.line((3, 32, 61, 32), fill=(174, 181, 178, 80))
    for x, y in ((7,7),(57,7),(7,57),(57,57)):
        d.ellipse((x-1,y-1,x+1,y+1), fill=(112,127,122,120))
    if service:
        d.rounded_rectangle((7,7,57,57),8,fill=(184,193,189),outline=(116,132,127),width=2)
        d.ellipse((17,17,47,47),outline=(82,128,121),width=3)
        d.ellipse((27,27,37,37),fill=(79,97,93))
    strip=(35,42,42,255); accent=(92,145,136,255)
    def side(which):
        if which == "N": d.rectangle((0,0,63,13),fill=strip); d.line((0,14,63,14),fill=accent,width=3)
        if which == "E": d.rectangle((50,0,63,63),fill=strip); d.line((49,0,49,63),fill=accent,width=3)
        if which == "S": d.rectangle((0,50,63,63),fill=strip); d.line((0,49,63,49),fill=accent,width=3)
        if which == "W": d.rectangle((0,0,13,63),fill=strip); d.line((14,0,14,63),fill=accent,width=3)
    if edge: side(edge)
    if corner:
        for ch in corner: side(ch)
    return im


def graphite():
    im=Image.new("RGBA",(S,S),(24,29,30,255)); d=ImageDraw.Draw(im)
    d.rounded_rectangle((3,3,61,61),6,fill=(57,66,66),outline=(112,124,121),width=2)
    d.rounded_rectangle((9,9,55,55),5,fill=(42,50,50),outline=(78,90,87),width=2)
    d.rounded_rectangle((17,17,47,47),3,fill=(29,35,36),outline=(90,104,100),width=1)
    for x,y in ((10,10),(54,10),(10,54),(54,54)): d.ellipse((x-2,y-2,x+2,y+2),fill=(145,156,152))
    return im


def core_tile():
    im=ceramic(); d=ImageDraw.Draw(im)
    for r,c in ((20,(43,53,52)),(15,(27,33,33)),(10,(218,145,42)),(6,(255,192,77)),(2,(255,246,211))):
        d.ellipse((32-r,32-r,32+r,32+r),fill=c)
    c=(64,111,105)
    d.line((8,20,8,8,20,8),fill=c,width=3); d.line((44,8,56,8,56,20),fill=c,width=3)
    d.line((8,44,8,56,20,56),fill=c,width=3); d.line((44,56,56,56,56,44),fill=c,width=3)
    return im


def add_texture(im):
    # Raster material variation: enough to break the web-SVG look without making the deck dirty.
    noise = Image.new("RGBA", im.size, (0,0,0,0)); p=noise.load()
    for y in range(im.height):
        for x in range(im.width):
            n=random.randint(-7,7)
            if n > 0: p[x,y]=(255,255,255,n*2)
            elif n < 0: p[x,y]=(0,0,0,-n*2)
    return Image.alpha_composite(im, noise)


atlas=Image.new("RGBA",(COLS*S,ROWS*S),(0,0,0,0))
def paste_tile(tid, im):
    idx=tid-1; atlas.alpha_composite(im,((idx%COLS)*S,(idx//COLS)*S))

base={1:ceramic(),2:ceramic(service=True),3:graphite(),4:core_tile()}
for i,e in enumerate(("N","E","S","W"),5): base[i]=ceramic(edge=e)
for i,c in enumerate(("NW","NE","SE","SW"),9): base[i]=ceramic(corner=c)
# small functional tiles 13-16
im=ceramic(); d=ImageDraw.Draw(im); d.rounded_rectangle((10,12,54,52),7,fill=(150,161,157),outline=(98,112,108),width=2); d.rounded_rectangle((16,18,48,46),4,fill=(178,187,183)); [d.line((22,y,42,y),fill=(104,123,118),width=2) for y in (24,32,40)]; base[13]=im
im=ceramic(service=True); d=ImageDraw.Draw(im); d.rounded_rectangle((18,22,28,45),4,fill=(92,108,104)); d.rounded_rectangle((36,22,46,45),4,fill=(92,108,104)); d.ellipse((27,11,37,21),fill=(221,159,54)); base[14]=im
im=ceramic(); d=ImageDraw.Draw(im); d.rounded_rectangle((8,8,56,56),7,fill=(20,27,28),outline=(78,93,89),width=2); [d.line((17,y,17+w,y),fill=(116,166,158),width=2) for y,w in ((18,28),(25,20),(36,32),(43,25))]; d.ellipse((42,44,49,51),fill=(223,160,59)); base[15]=im
im=ceramic(); d=ImageDraw.Draw(im); d.line((7,32,57,32),fill=(221,151,43),width=7); d.rounded_rectangle((20,16,44,48),4,outline=(172,107,27),width=2); d.ellipse((28,25,36,33),fill=(245,185,71)); base[16]=im
for tid in range(17,33):
    im=ceramic(); d=ImageDraw.Draw(im)
    if tid%4==1: d.ellipse((7,7,57,57),outline=(208,154,82,90),width=2); d.ellipse((26,26,38,38),fill=(236,181,93,130))
    elif tid%4==2: d.rounded_rectangle((13,15,51,49),6,fill=(185,192,189),outline=(115,130,125),width=2)
    elif tid%4==3: d.line((8,50,56,14),fill=(83,139,131,120),width=3)
    else: d.rounded_rectangle((8,8,56,56),8,outline=(98,144,137,150),width=2)
    base[tid]=im
for tid,im in base.items(): paste_tile(tid,add_texture(im))


def split(im,tids,cols,rows):
    assert len(tids)==cols*rows
    for k,tid in enumerate(tids):
        c=k%cols; r=k//cols
        paste_tile(tid,im.crop((c*S,r*S,(c+1)*S,(r+1)*S)))

# FAMILY NICHE 3x2: true plan view, no furniture side faces.
im=Image.new("RGBA",(192,128),(0,0,0,0)); d=ImageDraw.Draw(im)
d.rounded_rectangle((8,8,184,120),22,fill=(188,132,91,42),outline=(194,137,93,100),width=3)
d.rounded_rectangle((52,30,140,98),18,fill=(179,116,77),outline=(114,70,50),width=4); d.rounded_rectangle((58,36,134,92),15,fill=(204,145,102),outline=(226,171,127),width=2)
for box in ((17,39,48,89),(144,39,175,89)):
    d.rounded_rectangle(box,10,fill=(102,78,68),outline=(65,51,46),width=3)
# parents seen from directly above, seated around the table
d.ellipse((25,51,40,66),fill=(202,154,119),outline=(108,77,61),width=2); d.pieslice((19,56,46,85),180,360,fill=(122,86,78),outline=(81,60,55))
d.ellipse((152,51,167,66),fill=(212,166,128),outline=(111,79,61),width=2); d.pieslice((146,56,173,85),180,360,fill=(172,99,80),outline=(106,61,52))
# personal traces
d.ellipse((78,49,92,63),fill=(224,219,200),outline=(112,115,108),width=2); d.ellipse((82,53,88,59),fill=(111,72,52))
d.rectangle((105,46,124,65),fill=(242,232,199),outline=(164,145,110)); d.line((108,59,121,50),fill=(210,100,82),width=2)
d.rounded_rectangle((63,75,84,91),5,fill=(177,85,66),outline=(115,57,48),width=2); d.arc((67,68,80,80),180,360,fill=(218,139,111),width=2)
split(im,list(range(33,39)),3,2)

# TRANSFER CRADLE 3x3: focal setpiece, same CORE & SLOT language at architecture scale.
im=Image.new("RGBA",(192,192),(0,0,0,0)); glow=Image.new("RGBA",im.size,(0,0,0,0)); gd=ImageDraw.Draw(glow)
for r,a in ((82,12),(67,18),(52,25)): gd.ellipse((96-r,96-r,96+r,96+r),fill=(240,171,58,a))
glow=glow.filter(ImageFilter.GaussianBlur(8)); im=Image.alpha_composite(im,glow); d=ImageDraw.Draw(im)
d.rounded_rectangle((16,16,176,176),34,fill=(52,62,61,235),outline=(102,123,117),width=5); d.rounded_rectangle((28,28,164,164),28,fill=(210,216,211),outline=(121,139,133),width=4)
for angle in (0,90,180,270):
    x=96+math.cos(math.radians(angle))*62; y=96+math.sin(math.radians(angle))*62
    if angle in (0,180): d.rounded_rectangle((x-25,y-9,x+25,y+9),7,fill=(61,73,71),outline=(119,139,133),width=2)
    else: d.rounded_rectangle((x-9,y-25,x+9,y+25),7,fill=(61,73,71),outline=(119,139,133),width=2)
for r,c in ((48,(39,48,47)),(39,(22,29,29)),(29,(80,111,104)),(20,(214,142,39)),(12,(255,191,70)),(5,(255,246,210))): d.ellipse((96-r,96-r,96+r,96+r),fill=c)
for x,y,sx,sy in ((40,40,1,1),(152,40,-1,1),(40,152,1,-1),(152,152,-1,-1)):
    d.line((x,y,x+sx*26,y),fill=(68,126,117),width=5); d.line((x,y,x,y+sy*26),fill=(68,126,117),width=5)
for a in range(0,360,45):
    x=96+math.cos(math.radians(a))*72; y=96+math.sin(math.radians(a))*72; d.ellipse((x-3,y-3,x+3,y+3),fill=(100,185,171))
split(im,list(range(39,48)),3,3)

# PICO DOCK 2x2
im=Image.new("RGBA",(128,128),(0,0,0,0)); d=ImageDraw.Draw(im); d.rounded_rectangle((10,10,118,118),24,fill=(197,205,201),outline=(104,122,116),width=4); d.rounded_rectangle((22,22,106,106),18,fill=(50,60,59),outline=(72,126,117),width=4); d.line((64,24,64,104),fill=(79,130,122),width=3); d.rounded_rectangle((38,44,90,84),10,outline=(207,150,49),width=4); d.ellipse((55,28,73,46),fill=(226,160,53)); split(im,list(range(48,52)),2,2)
# PRIMUS ALLOCATION CONSOLE 2x2
im=Image.new("RGBA",(128,128),(0,0,0,0)); d=ImageDraw.Draw(im); d.rounded_rectangle((12,12,116,116),16,fill=(18,22,23),outline=(77,88,85),width=4); d.rounded_rectangle((25,22,103,76),10,fill=(5,8,9),outline=(105,142,136),width=3); [d.rounded_rectangle((32,y,32+w,y+3),2,fill=(94,151,142)) for y,w in ((32,58),(41,42),(53,65),(64,49))]; d.ellipse((91,87,103,99),fill=(221,157,54)); d.line((29,91,75,91),fill=(151,166,162),width=3); d.line((29,101,62,101),fill=(95,115,110),width=3); split(im,list(range(52,56)),2,2)
# KAYO STATUS PLATFORM 2x2, premium + orange
im=Image.new("RGBA",(128,128),(0,0,0,0)); d=ImageDraw.Draw(im); d.rounded_rectangle((18,18,110,110),22,fill=(212,217,213),outline=(88,96,93),width=4); d.rounded_rectangle((28,28,100,100),18,fill=(48,55,54),outline=(220,139,47),width=5); d.polygon(((64,34),(82,43),(89,63),(82,87),(64,98),(46,87),(39,63),(46,43)),fill=(224,226,222),outline=(96,101,99)); d.ellipse((53,43,75,65),fill=(29,34,34),outline=(226,139,45),width=3); d.ellipse((59,49,69,59),fill=(236,151,48)); d.line((46,78,82,78),fill=(226,139,45),width=4); split(im,list(range(56,60)),2,2)
# PRIMUS PYLON 2x2, black/charcoal system presence
im=Image.new("RGBA",(128,128),(0,0,0,0)); d=ImageDraw.Draw(im); d.rounded_rectangle((25,15,103,107),18,fill=(10,12,13),outline=(69,76,74),width=4); d.rounded_rectangle((35,25,93,97),14,fill=(3,5,6),outline=(39,47,46),width=3); d.ellipse((50,40,78,68),outline=(103,139,133),width=3); d.ellipse((58,48,70,60),fill=(16,18,19)); d.line((46,78,82,78),fill=(64,93,88),width=2); d.line((46,86,82,86),fill=(64,93,88),width=2); split(im,list(range(60,64)),2,2)
# MACHINE RACK 2x2
im=Image.new("RGBA",(128,128),(0,0,0,0)); d=ImageDraw.Draw(im); d.rounded_rectangle((9,17,119,111),15,fill=(54,63,62),outline=(114,126,122),width=4)
for x in (22,68):
    d.rounded_rectangle((x,30,x+37,96),8,fill=(31,38,38),outline=(81,103,98),width=3)
    for yy in (42,55,68,81): d.line((x+8,yy,x+29,yy),fill=(94,148,139),width=2)
d.ellipse((100,88,110,98),fill=(216,150,48)); split(im,list(range(64,68)),2,2)
# FAMILY DISPLAY 2x2
im=Image.new("RGBA",(128,128),(0,0,0,0)); d=ImageDraw.Draw(im); d.rounded_rectangle((16,16,112,112),18,fill=(221,211,194),outline=(154,129,105),width=3); d.rounded_rectangle((25,25,103,103),12,fill=(236,229,213),outline=(188,166,135),width=2); d.rectangle((35,32,76,70),fill=(248,244,225),outline=(184,168,137)); d.line((42,59,53,44,62,58,70,48),fill=(207,103,79),width=3); d.ellipse((44,39,51,46),fill=(228,171,67)); d.rounded_rectangle((77,73,98,96),6,fill=(177,82,65)); split(im,list(range(68,72)),2,2)
# ALLOCATION THRESHOLD 2x2
im=Image.new("RGBA",(128,128),(0,0,0,0)); d=ImageDraw.Draw(im); d.rounded_rectangle((10,10,118,118),18,fill=(202,209,205),outline=(116,132,127),width=3); [d.line((x,18,x,110),fill=(74,123,116),width=3) for x in (32,64,96)]; d.line((18,64,110,64),fill=(216,145,42),width=8); d.rounded_rectangle((47,45,81,83),8,fill=(29,35,35),outline=(221,154,48),width=3); d.ellipse((58,56,70,68),fill=(247,185,67)); split(im,list(range(72,76)),2,2)
# BODY SLOT BANK 2x2
im=Image.new("RGBA",(128,128),(0,0,0,0)); d=ImageDraw.Draw(im); d.rounded_rectangle((10,15,118,113),20,fill=(192,201,197),outline=(105,120,115),width=4)
for cx in (40,88):
    d.rounded_rectangle((cx-22,28,cx+22,100),12,fill=(43,52,51),outline=(76,125,118),width=3); d.ellipse((cx-8,38,cx+8,54),fill=(212,151,49)); d.rounded_rectangle((cx-12,61,cx+12,87),6,outline=(149,164,159),width=2)
split(im,list(range(76,80)),2,2)
im=ceramic(); d=ImageDraw.Draw(im); d.line((6,32,58,32),fill=(212,145,42),width=5); d.ellipse((27,27,37,37),fill=(255,195,75)); paste_tile(80,im)

(PUBLIC / "deck").mkdir(parents=True, exist_ok=True)
atlas.save(PUBLIC / "deck" / "transfer-hall-tiles.png", optimize=True)

# ---------------------------------------------------------------------------
# 8-view raster character turnarounds. N/NE/E/SE/S/SW/W/NW are all authored
# as visibly different silhouettes; these are not rotations of one image.
# ---------------------------------------------------------------------------
def robot_frame(kind, idx, size=96):
    im=Image.new("RGBA",(size,size),(0,0,0,0)); d=ImageDraw.Draw(im); cx=size/2
    d.ellipse((cx-27,78,cx+27,89),fill=(10,15,15,28))
    is_front=idx in (3,4,5); is_back=idx in (7,0,1); is_side=idx in (2,6); right=idx in (1,2,3); left=idx in (5,6,7)
    bw,bh={"pico":(42,40),"sentry":(38,36),"magnetar":(50,42),"kronos":(58,48)}[kind]
    vbw=int(bw*(0.72 if is_side else 0.9 if (right or left) and not (is_front or is_back) else 1)); bx0=int(cx-vbw/2); bx1=int(cx+vbw/2); by0=37; by1=by0+bh
    body={"pico":(205,214,209),"sentry":(194,204,201),"magnetar":(184,198,194),"kronos":(172,184,181)}[kind]; outline=(70,82,79)
    rr(d,(bx0,by0,bx1,by1),12,body,outline,2)
    if is_side:
        if right: rr(d,(bx1-2,44,bx1+12,63),6,(66,78,75),outline,1)
        else: rr(d,(bx0-12,44,bx0+2,63),6,(66,78,75),outline,1)
    elif right: rr(d,(bx1-2,46,bx1+8,62),5,(65,77,74),outline,1)
    elif left: rr(d,(bx0-8,46,bx0+2,62),5,(65,77,74),outline,1)
    else:
        rr(d,(bx0-7,47,bx0+3,62),5,(65,77,74),outline,1); rr(d,(bx1-3,47,bx1+7,62),5,(65,77,74),outline,1)
    rr(d,(bx0+4,by1-2,bx0+14,by1+8),4,(43,51,49)); rr(d,(bx1-14,by1-2,bx1-4,by1+8),4,(43,51,49))
    hw,hh={"pico":(34,23),"sentry":(30,21),"magnetar":(38,24),"kronos":(42,26)}[kind]; shift=8 if is_side and right else -8 if is_side and left else 5 if right else -5 if left else 0; hx=cx+shift
    head=tuple(min(235,c+13) for c in body); rr(d,(int(hx-hw/2),15,int(hx+hw/2),15+hh),9,head,outline,2); dark=(34,42,40)
    if is_front:
        rr(d,(int(hx-hw*.34),22,int(hx+hw*.34),31),4,dark)
        if right: d.ellipse((hx-5,25,hx-1,29),fill=(226,240,235)); d.ellipse((hx+5,24,hx+11,30),fill=(226,240,235))
        elif left: d.ellipse((hx-11,24,hx-5,30),fill=(226,240,235)); d.ellipse((hx+1,25,hx+5,29),fill=(226,240,235))
        else: d.ellipse((hx-8,24,hx-3,29),fill=(226,240,235)); d.ellipse((hx+3,24,hx+8,29),fill=(226,240,235))
    elif is_back:
        rr(d,(int(hx-hw*.30),22,int(hx+hw*.30),31),4,(89,105,100)); d.line((hx-7,25,hx+7,25),fill=(45,58,54),width=1); d.line((hx-7,28,hx+7,28),fill=(45,58,54),width=1)
    else:
        if right: rr(d,(int(hx+1),22,int(hx+hw*.34),31),4,dark); d.ellipse((hx+6,24,hx+12,30),fill=(226,240,235))
        else: rr(d,(int(hx-hw*.34),22,int(hx-1),31),4,dark); d.ellipse((hx-12,24,hx-6,30),fill=(226,240,235))
    core=(232,161,48)
    if is_front:
        d.ellipse((cx-7,45,cx+7,59),fill=(41,49,47),outline=(91,104,99)); d.ellipse((cx-4,48,cx+4,56),fill=core); d.ellipse((cx-1,51,cx+1,53),fill=(255,244,204))
    elif is_back: rr(d,(cx-12,51,cx+12,61),4,(82,103,97)); d.line((cx-8,56,cx+8,56),fill=(48,66,61),width=2)
    else:
        sx=cx+(7 if right else -7); d.ellipse((sx-5,48,sx+5,58),fill=(42,50,48)); d.ellipse((sx-3,50,sx+3,56),fill=core)
    if kind=="sentry":
        ax=hx+(8 if right else -8 if left else 0); d.line((ax,15,ax,9),fill=(66,78,75),width=2); d.ellipse((ax-3,6,ax+3,12),fill=(105,143,136))
    elif kind=="magnetar":
        d.ellipse((bx0-7,49,bx0+7,63),outline=(83,142,133),width=3); d.ellipse((bx1-7,49,bx1+7,63),outline=(83,142,133),width=3)
    elif kind=="kronos":
        rr(d,(bx0-9,40,bx0+6,59),5,(94,103,100),outline,2); rr(d,(bx1-6,40,bx1+9,59),5,(94,103,100),outline,2); d.line((bx0+8,72,bx1-8,72),fill=(114,126,122),width=4)
    else: d.line((bx0+7,68,bx1-7,68),fill=(91,150,140),width=3)
    return im

(PUBLIC / "robots").mkdir(parents=True, exist_ok=True)
for kind in ("pico","sentry","magnetar","kronos"):
    sheet=Image.new("RGBA",(768,96),(0,0,0,0))
    for idx in range(8): sheet.alpha_composite(robot_frame(kind,idx),(idx*96,0))
    sheet.save(PUBLIC / "robots" / f"directional-{kind}.png", optimize=True)

# Runtime uses PNG turnarounds.
catalog = ROOT / "src" / "game" / "catalog.ts"
text = catalog.read_text()
for kind in ("pico","sentry","magnetar","kronos"):
    text=text.replace(f"directional-{kind}.svg",f"directional-{kind}.png")
catalog.write_text(text)

# Better direct reversal: brake before the chassis turns through 180°, avoiding the visible kick.
meta = ROOT / "src" / "meta" / "MetaGame.tsx"
text = meta.read_text()
old = '''        const desiredHeading = Math.atan2(inputY, inputX);\n        headingRef.current = turnToward(headingRef.current, desiredHeading, drive.turnSpeed * Math.PI / 180 * dt);\n        speedRef.current = Math.min(drive.maxSpeed, speedRef.current + drive.acceleration * dt);'''
new = '''        const desiredHeading = Math.atan2(inputY, inputX);\n        const headingDelta = normalizeAngle(desiredHeading - headingRef.current);\n        const reversing = Math.abs(headingDelta) > Math.PI * 0.62;\n        headingRef.current = turnToward(headingRef.current, desiredHeading, drive.turnSpeed * Math.PI / 180 * dt);\n        speedRef.current = reversing && speedRef.current > drive.maxSpeed * 0.16\n          ? Math.max(0, speedRef.current - drive.deceleration * 1.35 * dt)\n          : Math.min(drive.maxSpeed, speedRef.current + drive.acceleration * dt);'''
if old not in text: raise SystemExit("MetaGame reversal patch target not found")
meta.write_text(text.replace(old,new))

# Transfer Hall is now built around multi-tile setpieces rather than one-cell symbols.
transfer = ROOT / "src" / "game" / "maps" / "transferHall.ts"
transfer.write_text(r'''import type { TiledMapJson } from "../tiled";

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
''')

# Transfer Hall raster treatment and stronger separation between zones.
css = ROOT / "src" / "meta" / "MetaGameMotion.css"
text = css.read_text()
marker = "/* MOCKUP ALIGNMENT PASS 1 */"
if marker not in text:
    text += r'''

/* MOCKUP ALIGNMENT PASS 1 */
.zk-meta-shell[data-floor-id="transfer-hall"] .zk-meta-viewport {
  background:
    radial-gradient(circle at 22% 48%, rgba(225,168,103,.16), transparent 24%),
    radial-gradient(circle at 49% 50%, rgba(235,173,63,.13), transparent 23%),
    linear-gradient(90deg, #bfc7c2 0 59%, #9ca8a4 59% 64%, #7d8986 64% 100%);
}
.zk-meta-shell[data-floor-id="transfer-hall"] .zk-tilemap { filter: drop-shadow(0 10px 20px rgba(22,30,29,.22)); }
.zk-meta-shell[data-floor-id="transfer-hall"] .zk-tilemap-layer[data-layer-id="Decor"] { filter: drop-shadow(0 5px 5px rgba(20,26,25,.22)); }
.zk-meta-shell[data-floor-id="transfer-hall"] .zk-directional-sprite { image-rendering: auto; }
'''
    css.write_text(text)

# Production documentation: final runtime visible art is raster; large setpieces are multi-cell.
doc = ROOT / "ART_PRODUCTION_RULES_TRANSFER_SHIP.md"
text = doc.read_text().replace("Transfer Ship Art Production Rules v0.1","Transfer Ship Art Production Rules v0.2")
append = r'''

## Mockup Alignment Pass 1 — binding production update

The first in-game review showed that technically correct SVG primitives still read as prototype art. From this pass onward the visible Transfer Hall production assets are raster runtime assets (`PNG`) with subtle material variation; SVG may remain a source/construction format but is not the target presentation format.

### Tile vs. setpiece rule

Use a 64×64 tile for repeatable surfaces, seams, edges, sockets and small functional markers. Use a multi-tile setpiece when the object is a focal architectural object or would physically occupy more than one cell.

Current minimum examples:

- Family table / parent niche: 3×2 cells
- Transfer Cradle: 3×3 cells
- PICO dock: 2×2 cells
- PRIMUS allocation console: 2×2 cells
- Kayo status platform: 2×2 cells
- PRIMUS pylon: 2×2 cells
- machine rack / body-slot bank: 2×2 cells

A setpiece is sliced into exact 64×64 atlas fragments for the renderer, but must read as one coherent object in world space. Collision uses the setpiece footprint rather than one-cell proxy obstacles.

### Directional character sheet naming

`directional-<body>.png` is one horizontal 8-frame strip in this exact order:

`N | NE | E | SE | S | SW | W | NW`

The eight views must be visibly authored, not a rotated source image and not four views duplicated by mirroring. Front views expose face/sensor personality; rear views expose service/rear panels; pure side views have a true profile silhouette; diagonal views carry asymmetric near/far features.

Ownership remains a renderer treatment. Do not bake player green, hostile red or NPC blue into the physical body sheet.
'''
if "## Mockup Alignment Pass 1 — binding production update" not in text: text += append
doc.write_text(text)
