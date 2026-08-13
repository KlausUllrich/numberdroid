from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import os, random

S=4; T=64; TS=T*S
DECK=Path('public/assets/deck'); ROBOTS=Path('public/assets/robots')
DECK.mkdir(parents=True,exist_ok=True); ROBOTS.mkdir(parents=True,exist_ok=True)

def C(h,a=255):
    h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))+(a,)

def rr(d,b,r,fill,outline=None,w=1):
    d.rounded_rectangle(tuple(int(v) for v in b),radius=int(r),fill=fill,outline=outline,width=max(1,int(w)))

def textured(im,seed,amount=4):
    random.seed(seed); px=im.load(); w,h=im.size
    layer=Image.new('RGBA',im.size,(0,0,0,0)); lp=layer.load()
    for y in range(h):
        for x in range(w):
            if px[x,y][3]==0: continue
            n=random.randint(-amount,amount)
            if n>0: lp[x,y]=(255,255,255,min(10,n*2))
            elif n<0: lp[x,y]=(0,0,0,min(10,-n*2))
    return Image.alpha_composite(im,layer)

def floor(seed=0,slot=False):
    im=Image.new('RGBA',(TS,TS),C('#d5d9d3')); d=ImageDraw.Draw(im)
    for y in range(TS):
        q=int(229-13*y/(TS-1)); d.line((0,y,TS,y),fill=(q,q+2,q-1,255))
    rr(d,(6*S,6*S,58*S,58*S),7*S,C('#e1e4de'),C('#a7b0aa'),2*S)
    rr(d,(11*S,11*S,53*S,53*S),5*S,C('#ebede8'),C('#c7ccc7'),S)
    for x,y in ((11,11),(53,11),(11,53),(53,53)):
        d.ellipse(((x-1.5)*S,(y-1.5)*S,(x+1.5)*S,(y+1.5)*S),fill=C('#89948f'))
    if slot:
        d.ellipse((19*S,19*S,45*S,45*S),outline=C('#5d9189'),width=3*S)
        d.ellipse((28*S,28*S,36*S,36*S),fill=C('#59716c'))
    return textured(im,seed)

def machinery(seed=3):
    im=Image.new('RGBA',(TS,TS),C('#1b2223')); d=ImageDraw.Draw(im)
    rr(d,(3*S,3*S,61*S,61*S),7*S,C('#30383a'),C('#75807d'),2*S)
    rr(d,(10*S,10*S,54*S,54*S),5*S,C('#202829'),C('#475250'),2*S)
    rr(d,(16*S,16*S,48*S,48*S),4*S,C('#141a1b'),C('#35403e'),S)
    return textured(im,seed,6)

def coretile():
    im=floor(4); d=ImageDraw.Draw(im)
    d.ellipse((11*S,11*S,53*S,53*S),fill=C('#303839'),outline=C('#697572'),width=2*S)
    d.ellipse((17*S,17*S,47*S,47*S),fill=C('#13191a'),outline=C('#c98228'),width=3*S)
    gl=Image.new('RGBA',im.size,(0,0,0,0)); gd=ImageDraw.Draw(gl); gd.ellipse((22*S,22*S,42*S,42*S),fill=C('#f0a234',120)); gl=gl.filter(ImageFilter.GaussianBlur(5*S)); im=Image.alpha_composite(im,gl)
    d=ImageDraw.Draw(im); d.ellipse((25*S,25*S,39*S,39*S),fill=C('#f0a234')); d.ellipse((29*S,29*S,35*S,35*S),fill=C('#fff1ba'))
    return im

tiles={i:floor(i) for i in range(1,81)}
tiles[1]=floor(1); tiles[2]=floor(2,True); tiles[3]=machinery(); tiles[4]=coretile()

# strict top-down boundaries
for gid,side in ((5,'N'),(6,'E'),(7,'S'),(8,'W')):
    im=floor(gid); d=ImageDraw.Draw(im); b=14*S; dark=C('#242c2e'); teal=C('#709b94')
    if side=='N': d.rectangle((0,0,TS,b),fill=dark); d.line((0,b,TS,b),fill=teal,width=2*S)
    if side=='S': d.rectangle((0,TS-b,TS,TS),fill=dark); d.line((0,TS-b,TS,TS-b),fill=teal,width=2*S)
    if side=='W': d.rectangle((0,0,b,TS),fill=dark); d.line((b,0,b,TS),fill=teal,width=2*S)
    if side=='E': d.rectangle((TS-b,0,TS,TS),fill=dark); d.line((TS-b,0,TS-b,TS),fill=teal,width=2*S)
    tiles[gid]=im
for gid,sides in ((9,'NW'),(10,'NE'),(11,'SE'),(12,'SW')):
    im=floor(gid); d=ImageDraw.Draw(im); b=14*S; dark=C('#242c2e'); teal=C('#709b94')
    if 'N' in sides: d.rectangle((0,0,TS,b),fill=dark); d.line((0,b,TS,b),fill=teal,width=2*S)
    if 'S' in sides: d.rectangle((0,TS-b,TS,TS),fill=dark); d.line((0,TS-b,TS,TS-b),fill=teal,width=2*S)
    if 'W' in sides: d.rectangle((0,0,b,TS),fill=dark); d.line((b,0,b,TS),fill=teal,width=2*S)
    if 'E' in sides: d.rectangle((TS-b,0,TS,TS),fill=dark); d.line((TS-b,0,TS-b,TS),fill=teal,width=2*S)
    tiles[gid]=im

# hatch / docking slot / PRIMUS plate / warning
a=floor(13);d=ImageDraw.Draw(a);rr(d,(15*S,15*S,49*S,49*S),6*S,C('#adb6b1'),C('#62716b'),2*S);[d.line((21*S,y*S,43*S,y*S),fill=C('#61766f'),width=2*S) for y in (24,32,40)];tiles[13]=a
a=floor(14);d=ImageDraw.Draw(a);rr(d,(10*S,12*S,54*S,52*S),7*S,C('#cbd2cd'),C('#667873'),2*S);d.arc((18*S,17*S,46*S,45*S),20,160,fill=C('#4f847c'),width=3*S);d.line((19*S,47*S,45*S,47*S),fill=C('#d4932e'),width=3*S);tiles[14]=a
a=floor(15);d=ImageDraw.Draw(a);rr(d,(10*S,10*S,54*S,54*S),6*S,C('#141b1c'),C('#65706c'),2*S);rr(d,(15*S,16*S,49*S,31*S),4*S,C('#061011'),C('#76a9a0'),S);[d.line((18*S,y*S,(18+w)*S,y*S),fill=C('#8ab8b0'),width=2*S) for y,w in ((38,25),(44,18),(50,12))];d.ellipse((43*S,42*S,49*S,48*S),fill=C('#db9b31'));tiles[15]=a
a=floor(16);d=ImageDraw.Draw(a);d.line((8*S,32*S,56*S,32*S),fill=C('#cf8a24'),width=6*S);rr(d,(18*S,18*S,46*S,46*S),4*S,(0,0,0,0),C('#b46f1c'),2*S);tiles[16]=a

# warm family trace
a=floor(17);g=Image.new('RGBA',a.size,(0,0,0,0));gd=ImageDraw.Draw(g);gd.ellipse((8*S,8*S,56*S,56*S),fill=C('#eeb267',55));g=g.filter(ImageFilter.GaussianBlur(8*S));a=Image.alpha_composite(a,g);ImageDraw.Draw(a).ellipse((29*S,29*S,35*S,35*S),fill=C('#eab267'));tiles[17]=a

def basebig(w,h,start):
    im=Image.new('RGBA',(w*TS,h*TS),(0,0,0,0))
    for r in range(h):
        for c in range(w): im.alpha_composite(floor(start+r*w+c),(c*TS,r*TS))
    return im

def assign(gids,w,big):
    for i,gid in enumerate(gids):
        c=i%w; r=i//w; tiles[gid]=big.crop((c*TS,r*TS,(c+1)*TS,(r+1)*TS))

# Family table: unmistakable top-down tabletop, chairs, cups, bag and drawing.
b=basebig(3,2,33);d=ImageDraw.Draw(b);rr(d,(10*S,14*S,182*S,112*S),12*S,C('#d9c6b2',190),C('#a9927b'),2*S);d.ellipse((31*S,34*S,145*S,94*S),fill=C('#996748'),outline=C('#6d4937'),width=3*S);d.ellipse((39*S,40*S,137*S,88*S),fill=C('#ba8160'),outline=C('#d5a382'),width=2*S)
for x,y in ((67,56),(108,69),(91,54)): d.ellipse(((x-7)*S,(y-7)*S,(x+7)*S,(y+7)*S),fill=C('#e7e0d4'),outline=C('#756f66'),width=S); d.ellipse(((x-3)*S,(y-3)*S,(x+3)*S,(y+3)*S),fill=C('#76513d'))
for x,y in ((30,102),(148,103)): rr(d,((x-18)*S,(y-14)*S,(x+18)*S,(y+14)*S),6*S,C('#b36d52'),C('#6d4636'),2*S)
rr(d,(151*S,30*S,181*S,62*S),7*S,C('#b66f4f'),C('#744532'),2*S);rr(d,(12*S,74*S,42*S,106*S),3*S,C('#f3ecd9'),C('#b4a27f'),S);d.line((18*S,94*S,27*S,82*S,37*S,97*S),fill=C('#ce735b'),width=2*S);assign([33,34,35,36,37,38],3,b)

# Transfer Cradle: 3x3 top-down circular machine, readable as one large device.
b=basebig(3,3,39);g=Image.new('RGBA',b.size,(0,0,0,0));gd=ImageDraw.Draw(g);gd.ellipse((28*S,28*S,164*S,164*S),fill=C('#f0a533',55));g=g.filter(ImageFilter.GaussianBlur(14*S));b=Image.alpha_composite(b,g);d=ImageDraw.Draw(b);d.ellipse((24*S,24*S,168*S,168*S),fill=C('#293234'),outline=C('#697a76'),width=7*S);d.ellipse((39*S,39*S,153*S,153*S),fill=C('#d5dad5'),outline=C('#4f817a'),width=5*S);d.ellipse((56*S,56*S,136*S,136*S),fill=C('#1b2425'));d.ellipse((68*S,68*S,124*S,124*S),fill=C('#101617'),outline=C('#d28d2b'),width=4*S);d.ellipse((82*S,82*S,110*S,110*S),fill=C('#eda12f'));d.ellipse((90*S,90*S,102*S,102*S),fill=C('#fff0b5'))
for box in ((83,18,109,54),(83,138,109,174),(18,83,54,109),(138,83,174,109)): rr(d,tuple(v*S for v in box),6*S,C('#3d4949'),C('#75847f'),2*S)
for x,y in ((96,47),(96,145),(47,96),(145,96)): d.ellipse(((x-4)*S,(y-4)*S,(x+4)*S,(y+4)*S),fill=C('#5ab3aa'))
assign(list(range(39,48)),3,b)

# PICO floor dock: visibly a docking pad, not a wall/blocker.
b=basebig(2,2,48);d=ImageDraw.Draw(b);rr(d,(15*S,18*S,113*S,110*S),12*S,C('#cbd1cb'),C('#59746f'),3*S);rr(d,(27*S,28*S,101*S,98*S),10*S,C('#283233'),C('#6c7b76'),2*S);d.ellipse((54*S,38*S,74*S,58*S),fill=C('#d39a30'));rr(d,(49*S,57*S,79*S,90*S),8*S,C('#e0e3dd'),C('#616d69'),2*S);d.line((38*S,94*S,90*S,94*S),fill=C('#d1942e'),width=4*S);assign([48,49,50,51],2,b)

# PRIMUS console.
b=basebig(2,2,52);d=ImageDraw.Draw(b);rr(d,(17*S,14*S,111*S,114*S),10*S,C('#171d1e'),C('#6f7774'),3*S);rr(d,(29*S,24*S,99*S,61*S),6*S,C('#061011'),C('#70aaa1'),2*S)
for y,w in ((34,44),(44,35),(54,25)): d.line((40*S,y*S,(40+w)*S,y*S),fill=C('#7db6ad'),width=2*S)
for x,col in ((42,'#d99a30'),(61,'#78aaa1'),(80,'#78aaa1')): d.ellipse(((x-4)*S,76*S,(x+4)*S,84*S),fill=C(col))
rr(d,(35*S,90*S,93*S,104*S),5*S,C('#262e2f'),C('#555f5c'),S);assign([52,53,54,55],2,b)

# Kayo: readable orange-accent character on a floor platform; platform remains driveable.
b=basebig(2,2,56);d=ImageDraw.Draw(b);d.ellipse((18*S,28*S,110*S,112*S),fill=C('#252e2f'),outline=C('#d78926'),width=4*S);d.ellipse((31*S,41*S,97*S,99*S),fill=C('#dce0dc'),outline=C('#8f9b96'),width=3*S);rr(d,(48*S,45*S,80*S,68*S),8*S,C('#f1f2ef'),C('#5d6664'),2*S);rr(d,(43*S,65*S,85*S,99*S),9*S,C('#eceeeb'),C('#5d6664'),2*S)
for x in (57,71): d.ellipse(((x-3)*S,51*S,(x+3)*S,57*S),fill=C('#e5962e'))
d.ellipse((59*S,74*S,69*S,84*S),fill=C('#e5962e'));d.line((45*S,76*S,35*S,91*S),fill=C('#616b67'),width=4*S);d.line((83*S,76*S,93*S,91*S),fill=C('#616b67'),width=4*S);assign([56,57,58,59],2,b)

# PRIMUS pylon.
b=basebig(2,2,60);d=ImageDraw.Draw(b);rr(d,(23*S,15*S,105*S,113*S),14*S,C('#101617'),C('#4c5d59'),3*S);rr(d,(35*S,26*S,93*S,78*S),8*S,C('#05090a'),C('#6d9790'),2*S)
for y,w in ((39,38),(51,30),(63,21)): d.line((47*S,y*S,(47+w)*S,y*S),fill=C('#5b9d94'),width=2*S)
d.ellipse((53*S,83*S,75*S,105*S),fill=C('#000000'),outline=C('#85948f'),width=2*S);d.ellipse((61*S,91*S,67*S,97*S),fill=C('#c4cbc7'));assign([60,61,62,63],2,b)

# Machine rack.
b=basebig(2,2,64);d=ImageDraw.Draw(b)
for x in (19,67):
    rr(d,(x*S,18*S,(x+42)*S,111*S),8*S,C('#2b3334'),C('#68736f'),2*S)
    for y in (35,52,69,86): d.line(((x+8)*S,y*S,(x+34)*S,y*S),fill=C('#79a49d'),width=2*S)
    d.ellipse(((x+31)*S,96*S,(x+37)*S,102*S),fill=C('#da9a2d'))
assign([64,65,66,67],2,b)

# Family display / keepsake, still top-down.
b=basebig(2,2,68);d=ImageDraw.Draw(b);rr(d,(22*S,16*S,106*S,106*S),12*S,C('#d6d0c2'),C('#8d8a80'),3*S);rr(d,(31*S,26*S,97*S,97*S),9*S,C('#eee8db'),C('#b5ab99'),2*S);rr(d,(42*S,35*S,82*S,72*S),3*S,C('#f8f2dd'),C('#aa9c7e'),S);d.arc((50*S,44*S,74*S,65*S),0,180,fill=C('#d87358'),width=3*S);d.ellipse((86*S,77*S,96*S,87*S),fill=C('#e3a445'));assign([68,69,70,71],2,b)

# Body-slot bank: two clearly empty body docks.
b=basebig(2,2,76);d=ImageDraw.Draw(b);rr(d,(12*S,17*S,116*S,111*S),12*S,C('#cbd1cc'),C('#5d827a'),3*S)
for cx in (42,86):
    rr(d,((cx-18)*S,31*S,(cx+18)*S,99*S),9*S,C('#273031'),C('#71918b'),2*S);d.ellipse(((cx-6)*S,39*S,(cx+6)*S,51*S),fill=C('#dfa038'));rr(d,((cx-10)*S,57*S,(cx+10)*S,87*S),5*S,C('#3b4545'),C('#87948f'),S)
assign([76,77,78,79],2,b)

atlas=Image.new('RGBA',(4*TS,20*TS),(0,0,0,0))
for gid in range(1,81):
    i=gid-1; atlas.alpha_composite(tiles[gid],((i%4)*TS,(i//4)*TS))
atlas.resize((256,1280),Image.Resampling.LANCZOS).save(DECK/'transfer-hall-tiles.png',optimize=True)

# Character sheet: N/NE/E/SE/S/SW/W/NW. S is the expressive front, N the rear.
def gradient_round(im,box,r,top,bottom,outline,w=2):
    x0,y0,x1,y1=[int(v) for v in box]; mask=Image.new('L',im.size,0); md=ImageDraw.Draw(mask); md.rounded_rectangle((x0,y0,x1,y1),radius=int(r),fill=255)
    g=Image.new('RGBA',im.size,(0,0,0,0)); gd=ImageDraw.Draw(g)
    for y in range(y0,y1+1):
        t=(y-y0)/max(1,y1-y0); col=tuple(int(top[k]*(1-t)+bottom[k]*t) for k in range(3))+(255,); gd.line((x0,y,x1,y),fill=col)
    im.alpha_composite(Image.composite(g,Image.new('RGBA',im.size,(0,0,0,0)),mask)); ImageDraw.Draw(im).rounded_rectangle((x0,y0,x1,y1),radius=int(r),outline=outline,width=max(1,int(w)))

def robot(body,di):
    im=Image.new('RGBA',(96*S,96*S),(0,0,0,0)); sh=Image.new('RGBA',im.size,(0,0,0,0)); sd=ImageDraw.Draw(sh); sd.ellipse((19*S,74*S,77*S,90*S),fill=C('#111719',55)); sh=sh.filter(ImageFilter.GaussianBlur(4*S)); im=Image.alpha_composite(im,sh); d=ImageDraw.Draw(im)
    front=di in (3,4,5); back=di in (7,0,1); side=di in (2,6); diag=di in (1,3,5,7); right=di in (1,2,3); left=di in (5,6,7)
    cfg={'pico':((29,39,67,76),(31,20,65,45),13,9,(241,243,238),(191,201,196)), 'sentry':((30,39,66,75),(33,18,63,41),16,8,(231,235,232),(170,181,178)), 'magnetar':((25,38,71,78),(30,18,66,43),19,11,(224,230,226),(156,170,166)), 'kronos':((20,35,76,80),(27,16,69,43),20,13,(213,220,216),(128,141,137))}[body]
    torso,head,arm,legw,b1,b2=cfg; dx=(3 if right else -3) if diag else ((4 if right else -4) if side else 0); tx0,ty0,tx1,ty1=torso; hx0,hy0,hx1,hy1=head; tx0+=dx;tx1+=dx;hx0+=dx;hx1+=dx
    if side:
        near=56 if right else 40; far=40 if right else 56; rr(d,((far-legw/2)*S,72*S,(far+legw/2)*S,88*S),4*S,C('#45504e'),C('#1a2221'),S); rr(d,((near-legw/2)*S,71*S,(near+legw/2)*S,90*S),4*S,C('#313b3a'),C('#151c1c'),S)
    else:
        for lx in (38+dx,58+dx): rr(d,((lx-legw/2)*S,72*S,(lx+legw/2)*S,90*S),4*S,C('#34403f'),C('#182120'),S)
    if body=='magnetar':
        for sg in (-1,1):
            ax=tx0-8 if sg<0 else tx1+8; d.ellipse(((ax-8)*S,48*S,(ax+8)*S,66*S),fill=C('#3c4847'),outline=C('#182120'),width=2*S); d.ellipse(((ax-4)*S,52*S,(ax+4)*S,62*S),outline=C('#8ba9a2'),width=2*S)
    elif body=='kronos':
        for sg in (-1,1):
            a0=tx0-14 if sg<0 else tx1; a1=tx0 if sg<0 else tx1+14; rr(d,(a0*S,43*S,a1*S,69*S),5*S,C('#616d69'),C('#202928'),2*S)
    else:
        for sg in (-1,1):
            sx=tx0 if sg<0 else tx1; ex=sx+(-arm if sg<0 else arm); d.line((sx*S,48*S,ex*S,62*S),fill=C('#566360'),width=6*S); d.ellipse(((ex-4)*S,58*S,(ex+4)*S,66*S),fill=C('#2a3433'))
    gradient_round(im,(tx0*S,ty0*S,tx1*S,ty1*S),9*S,b1,b2,C('#53615e'),2*S); d=ImageDraw.Draw(im)
    if front:
        rr(d,((tx0+7)*S,(ty0+7)*S,(tx1-7)*S,(ty1-5)*S),6*S,C('#dde1dc'),C('#85918d'),S); d.ellipse(((48+dx-7)*S,53*S,(48+dx+7)*S,67*S),fill=C('#2c3332'),outline=C('#646f6c'),width=S); d.ellipse(((48+dx-4)*S,56*S,(48+dx+4)*S,64*S),fill=C('#ef9c31')); d.ellipse(((46.5+dx)*S,57.5*S,(49.5+dx)*S,60.5*S),fill=C('#fff2bf'))
    elif back:
        rr(d,((tx0+7)*S,(ty0+8)*S,(tx1-7)*S,(ty1-7)*S),5*S,C('#89938f'),C('#5e6966'),S); d.line(((tx0+11)*S,52*S,(tx1-11)*S,52*S),fill=C('#3d4947'),width=2*S)
    else: d.ellipse(((48+dx-5)*S,56*S,(48+dx+5)*S,66*S),fill=C('#c4872c'))
    gradient_round(im,(hx0*S,hy0*S,hx1*S,hy1*S),9*S,(246,247,243),(201,208,204),C('#53615e'),2*S); d=ImageDraw.Draw(im)
    if front:
        rr(d,((hx0+6)*S,(hy0+6)*S,(hx1-6)*S,(hy0+17)*S),5*S,C('#273130'),C('#5e6c68'),S); ey=hy0+11
        for ex in (hx0+12,hx1-12): d.ellipse(((ex-2.4)*S,(ey-2.4)*S,(ex+2.4)*S,(ey+2.4)*S),fill=C('#eef8ef')); d.ellipse(((ex-.8)*S,(ey-.8)*S,(ex+.8)*S,(ey+.8)*S),fill=C('#65a99d'))
        if body=='pico': d.arc(((hx0+11)*S,(hy0+14)*S,(hx1-11)*S,(hy0+23)*S),10,170,fill=C('#687572'),width=S)
    elif back:
        rr(d,((hx0+8)*S,(hy0+7)*S,(hx1-8)*S,(hy1-7)*S),4*S,C('#a7b0ac'),C('#697470'),S); d.line(((hx0+11)*S,(hy0+13)*S,(hx1-11)*S,(hy0+13)*S),fill=C('#62706c'),width=2*S)
    elif right:
        rr(d,((hx1-13)*S,(hy0+6)*S,(hx1-4)*S,(hy0+18)*S),4*S,C('#25302f'),C('#5f6b68'),S); d.ellipse(((hx1-10)*S,(hy0+9)*S,(hx1-6)*S,(hy0+13)*S),fill=C('#eff8f0'))
    elif left:
        rr(d,((hx0+4)*S,(hy0+6)*S,(hx0+13)*S,(hy0+18)*S),4*S,C('#25302f'),C('#5f6b68'),S); d.ellipse(((hx0+6)*S,(hy0+9)*S,(hx0+10)*S,(hy0+13)*S),fill=C('#eff8f0'))
    if body=='sentry':
        ax=64+dx if not left else 32+dx; d.line((ax*S,20*S,ax*S,10*S),fill=C('#596863'),width=2*S); d.ellipse(((ax-2)*S,7*S,(ax+2)*S,11*S),fill=C('#d38a2b'))
    return textured(im,100+di*17+len(body),3).resize((96,96),Image.Resampling.LANCZOS)

for body in ('pico','sentry','magnetar','kronos'):
    sheet=Image.new('RGBA',(768,96),(0,0,0,0))
    for di in range(8): sheet.alpha_composite(robot(body,di),(di*96,0))
    sheet.save(ROBOTS/f'directional-{body}.png',optimize=True)

# Technical fix: separate large visual footprint from the actual collision footprint.
map_path=Path('src/game/maps/transferHall.ts'); src=map_path.read_text(encoding='utf-8')
old='''const OBSTACLES: TileRect[] = [\n  { name: "divider-north", x: 12, y: 1, w: 1, h: 4 },\n  { name: "divider-south", x: 12, y: 7, w: 1, h: 4 },\n  { name: "family-niche", x: 2.05, y: 4.05, w: 2.9, h: 1.9 },\n  { name: "family-display", x: 3.05, y: 2.05, w: 1.9, h: 1.9 },\n  { name: "transfer-cradle", x: 8.08, y: 4.08, w: 2.84, h: 2.84 },\n  { name: "pico-dock", x: 9.08, y: 7.08, w: 1.84, h: 1.84 },\n  { name: "primus-console", x: 14.08, y: 2.08, w: 1.84, h: 1.84 },\n  { name: "kayo-platform", x: 13.08, y: 5.08, w: 1.84, h: 1.84 },\n  { name: "primus-pylon", x: 16.08, y: 5.08, w: 1.84, h: 1.84 },\n  { name: "machine-rack", x: 13.08, y: 8.08, w: 1.84, h: 1.84 },\n];'''
new='''const OBSTACLES: TileRect[] = [\n  { name: "divider-north", x: 12, y: 1, w: 1, h: 4 },\n  { name: "divider-south", x: 12, y: 7, w: 1, h: 4 },\n  { name: "family-table-solid", x: 2.45, y: 4.48, w: 2.15, h: 1.02 },\n  { name: "family-display-solid", x: 3.38, y: 2.38, w: 1.24, h: 1.18 },\n  { name: "transfer-cradle-core", x: 8.55, y: 4.55, w: 1.9, h: 1.9 },\n  { name: "primus-console-core", x: 14.4, y: 2.36, w: 1.2, h: 1.28 },\n  { name: "primus-pylon-core", x: 16.42, y: 5.38, w: 1.16, h: 1.24 },\n  { name: "machine-rack-core", x: 13.3, y: 8.35, w: 1.4, h: 1.22 },\n];'''
if old not in src: raise SystemExit('Expected Transfer Hall obstacle block not found')
src=src.replace(old,new).replace('block(13,5,[56,57,58,59],2);','block(14,5,[56,57,58,59],2);').replace('name:"MAGNETAR 742 TRANSFERTECHNIK"','name:"MAGNETAR 742"').replace('name:"SENTRY-4 ZUGANGSWACHE"','name:"SENTRY-4"').replace('MOCKUP ALIGNMENT · CORE & SLOT','MOCKUP RECOVERY · CORE & SLOT')
map_path.write_text(src,encoding='utf-8')

Path('src/game/transferHall.test.ts').write_text('''import { describe, expect, it } from "vitest";\nimport { pointWalkable } from "./save";\nconst TILE = 64;\ndescribe("Transfer Hall traversal contract", () => {\n  it("keeps the allocation threshold collision-free on both sides", () => {\n    const y=6*TILE;\n    expect(pointWalkable(11.45*TILE,y,"transfer-hall",18)).toBe(true);\n    expect(pointWalkable(12.5*TILE,y,"transfer-hall",18)).toBe(true);\n    expect(pointWalkable(13.55*TILE,y,"transfer-hall",18)).toBe(true);\n  });\n  it("keeps floor pads driveable", () => {\n    expect(pointWalkable(10*TILE,8*TILE,"transfer-hall",18)).toBe(true);\n    expect(pointWalkable(14.2*TILE,6.5*TILE,"transfer-hall",18)).toBe(true);\n  });\n  it("blocks only the solid Transfer Cradle core", () => {\n    expect(pointWalkable(9.5*TILE,5.5*TILE,"transfer-hall",18)).toBe(false);\n  });\n});\n''',encoding='utf-8')

css=Path('src/art-direction.css'); text=css.read_text(encoding='utf-8'); marker='/* TRANSFER HALL RECOVERY PASS */'
if marker not in text:
    text += '''\n\n/* TRANSFER HALL RECOVERY PASS */\n.zk-meta-shell[data-floor-id="transfer-hall"] .zk-entity .tag,\n.zk-meta-shell[data-floor-id="transfer-hall"] .zk-player-name { min-height:24px;display:grid;place-items:center;padding:4px 9px;border-radius:7px;background:rgba(24,31,31,.94);color:#f5f7f2;text-shadow:0 1px 1px #000;box-shadow:0 4px 12px #00000045,inset 0 1px #ffffff12;font-size:10px;line-height:1;letter-spacing:.035em; }\n.zk-meta-shell[data-floor-id="transfer-hall"] .zk-player-name { border-color:#67d653;background:rgba(20,53,38,.95);color:#effff1; }\n.zk-meta-shell[data-floor-id="transfer-hall"] .zk-hostile:not(.behavior-neutral) .tag { border-color:#de5149;background:rgba(60,22,21,.95);color:#fff0ed; }\n.zk-meta-shell[data-floor-id="transfer-hall"] .zk-hostile.behavior-neutral .tag { border-color:#5799dc;background:rgba(19,45,70,.95);color:#edf7ff; }\n.zk-meta-shell[data-floor-id="transfer-hall"] .zk-player .zk-directional-sprite { filter:drop-shadow(0 5px 5px #16201e66) drop-shadow(0 0 7px #58cf4588) !important; }\n.zk-meta-shell[data-floor-id="transfer-hall"] .zk-hostile:not(.behavior-neutral) .zk-directional-sprite { filter:drop-shadow(0 5px 5px #16201e66) drop-shadow(0 0 7px #e33e3588) !important; }\n.zk-meta-shell[data-floor-id="transfer-hall"] .zk-hostile.behavior-neutral .zk-directional-sprite { filter:drop-shadow(0 5px 5px #16201e66) drop-shadow(0 0 7px #3f8ed888) !important; }\n.zk-meta-shell[data-floor-id="transfer-hall"] .zk-map-tile,.zk-meta-shell[data-floor-id="transfer-hall"] .zk-directional-sprite { image-rendering:auto; }\n'''
    css.write_text(text,encoding='utf-8')

print('Transfer Hall recovery generated')
