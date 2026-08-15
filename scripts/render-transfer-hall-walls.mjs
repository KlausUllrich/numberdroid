import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const recipePath = join(root, "art-source/recipes/transfer-hall/walls/render-recipe.json");
const recipe = JSON.parse(readFileSync(recipePath, "utf8"));

const T = recipe.runtime.tileSize;
const TH = recipe.runtime.visibleFascia;
const CX = Math.floor((T - TH) / 2);
const ACTIVE = recipe.runtime.activeTiles;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a,b,t) { return a + (b-a)*t; }
function smoothstep(t) { t=clamp(t,0,1); return t*t*(3-2*t); }

function makeNoiseGrid(size, cells, rand) {
  const g = Array.from({ length: cells + 1 }, () => Array(cells + 1).fill(0));
  for (let y=0;y<=cells;y++) for(let x=0;x<=cells;x++) g[y][x]=rand()*2-1;
  return { size, cells, g };
}
function sampleGrid(grid, x, y) {
  const { size, cells, g } = grid;
  const fx = (x / size) * cells;
  const fy = (y / size) * cells;
  const x0 = Math.floor(fx) % cells;
  const y0 = Math.floor(fy) % cells;
  const tx = smoothstep(fx - Math.floor(fx));
  const ty = smoothstep(fy - Math.floor(fy));
  const x1 = x0 + 1, y1 = y0 + 1;
  return lerp(lerp(g[y0][x0], g[y0][x1], tx), lerp(g[y1][x0], g[y1][x1], tx), ty);
}

function buildMaterial() {
  const m = recipe.material;
  const rand = mulberry32(m.seed);
  const coarse = makeNoiseGrid(m.size, 7, rand);
  const medium = makeNoiseGrid(m.size, 21, rand);
  const out = Buffer.alloc(m.size*m.size*4);
  for(let y=0;y<m.size;y++) for(let x=0;x<m.size;x++) {
    const n0 = sampleGrid(coarse,x,y) * m.coarseVariation;
    const n1 = sampleGrid(medium,x,y) * m.mediumVariation;
    const fine = (rand()*2-1) * m.fineVariation;
    const dir = (Math.sin(x/43) + 0.7*Math.sin(y/67)) * m.directionalVariation;
    const delta = n0+n1+fine+dir;
    const o=(y*m.size+x)*4;
    out[o]   = clamp(Math.round(m.baseRgb[0]+delta),0,255);
    out[o+1] = clamp(Math.round(m.baseRgb[1]+delta),0,255);
    out[o+2] = clamp(Math.round(m.baseRgb[2]+delta),0,255);
    out[o+3] = 255;
  }
  return { width:m.size, height:m.size, rgba:out };
}

function targetMask(id,x,y) {
  if(id===0)return y<TH;
  if(id===1)return y>=T-TH;
  if(id===2)return x<TH;
  if(id===3)return x>=T-TH;
  if(id===4)return y<TH||x<TH;
  if(id===5)return y<TH||x>=T-TH;
  if(id===6)return y>=T-TH||x>=T-TH;
  if(id===7)return y>=T-TH||x<TH;
  if(id===8||id===11||id===12)return x>=CX&&x<CX+TH;
  if(id===9)return y<TH||(x>=CX&&x<CX+TH);
  if(id===10)return y>=T-TH||(x>=CX&&x<CX+TH);
  return false;
}

function connectorBoundary(id,x,y) {
  for (const members of Object.values(recipe.connectorGroups)) {
    for (const [tid,side] of members) {
      if (tid!==id) continue;
      if (side==='T' && y===0 && targetMask(id,x,y)) return true;
      if (side==='B' && y===T-1 && targetMask(id,x,y)) return true;
      if (side==='L' && x===0 && targetMask(id,x,y)) return true;
      if (side==='R' && x===T-1 && targetMask(id,x,y)) return true;
    }
  }
  return false;
}

function boundarySeeds(id, connectorOnly=false) {
  const seeds=[];
  for(let y=0;y<T;y++) for(let x=0;x<T;x++) {
    if(!targetMask(id,x,y)) continue;
    const conn = connectorBoundary(id,x,y);
    if(connectorOnly) { if(conn) seeds.push(y*T+x); continue; }
    if(conn) continue;
    const n=[[1,0],[-1,0],[0,1],[0,-1]];
    let exposed=false;
    for(const [dx,dy] of n){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=T||ny>=T||!targetMask(id,nx,ny)){exposed=true;break;}}
    if(exposed) seeds.push(y*T+x);
  }
  return seeds;
}

function distanceField(id,seeds,maxDistance=64) {
  const dist = new Int16Array(T*T); dist.fill(32767);
  const q = new Int32Array(T*T); let h=0,n=0;
  for(const p of seeds){dist[p]=0;q[n++]=p;}
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  while(h<n){const p=q[h++],d=dist[p];if(d>=maxDistance)continue;const x=p%T,y=(p/T)|0;
    for(const [dx,dy] of dirs){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=T||ny>=T)continue;if(!targetMask(id,nx,ny))continue;const np=ny*T+nx;if(dist[np]<=d+1)continue;dist[np]=d+1;q[n++]=np;}
  }
  return dist;
}

function materialPixel(material,x,y) {
  const sx=x%material.width, sy=y%material.height;
  const o=(sy*material.width+sx)*4;
  return [material.rgba[o],material.rgba[o+1],material.rgba[o+2],255];
}
function setPixel(buf,x,y,rgba){const o=(y*T+x)*4;for(let c=0;c<4;c++)buf[o+c]=rgba[c];}
function pixel(buf,x,y,c){return buf[(y*T+x)*4+c];}

function renderTile(material,id) {
  const out=Buffer.alloc(T*T*4);
  const edgeSeeds=boundarySeeds(id,false);
  const connSeeds=boundarySeeds(id,true);
  const e=recipe.edgeTreatment;
  const edgeDist=distanceField(id,edgeSeeds,e.aoRadius+4);
  const connDist=connSeeds.length?distanceField(id,connSeeds,e.connectorQuietZone+2):null;
  for(let y=0;y<T;y++) for(let x=0;x<T;x++) {
    if(!targetMask(id,x,y)){setPixel(out,x,y,[0,0,0,0]);continue;}
    const src=materialPixel(material,x,y);
    const d=edgeDist[y*T+x];
    const quiet=connDist?clamp(connDist[y*T+x]/e.connectorQuietZone,0,1):1;
    const outline=clamp((e.outlineWidth+1-d)/(e.outlineWidth+1),0,1)*quiet;
    const ao=clamp((e.aoRadius+1-d)/(e.aoRadius+1),0,1)*quiet;
    const lift=clamp(1-Math.abs(d-e.innerLiftDistance)/Math.max(1,e.innerLiftWidth),0,1)*quiet;
    const rgb=[0,1,2].map(c=>clamp(Math.round(src[c]*(1-e.outlineDarken*outline)*(1-e.aoDarken*ao)+e.innerLift*lift),0,255));
    setPixel(out,x,y,[...rgb,255]);
  }
  return out;
}

function edge(tile,side){const out=Array.from({length:T},()=>[0,0,0,0]);for(let k=0;k<T;k++){let x,y;if(side==='T'){x=k;y=0}else if(side==='B'){x=k;y=T-1}else if(side==='L'){x=0;y=k}else{x=T-1;y=k}for(let c=0;c<4;c++)out[k][c]=pixel(tile,x,y,c);}return out;}
function median(vals){const a=[...vals].sort((x,y)=>x-y),m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2;}
function canonicalize(tiles){
  const canon={};
  for(const [name,members] of Object.entries(recipe.connectorGroups)){
    const strips=members.map(([id,s])=>edge(tiles[id],s));
    canon[name]=Array.from({length:T},(_,k)=>Array.from({length:4},(_,c)=>median(strips.map(st=>st[k][c]))));
  }
  const blend=recipe.edgeTreatment.connectorQuietZone;
  for(let id=0;id<ACTIVE;id++){
    const base=Buffer.from(tiles[id]),targets=[];
    for(const [name,members] of Object.entries(recipe.connectorGroups))for(const [tid,side] of members)if(tid===id)targets.push({side,strip:canon[name]});
    for(let y=0;y<T;y++)for(let x=0;x<T;x++){
      if(!targetMask(id,x,y)){setPixel(base,x,y,[0,0,0,0]);continue;}
      const ws=targets.map(({side})=>{const d=side==='T'?y:side==='B'?T-1-y:side==='L'?x:T-1-x;return Math.max(0,1-d/blend);});
      const total=ws.reduce((a,b)=>a+b,0),scale=total>1?1/total:1;
      const src=[0,1,2,3].map(c=>pixel(tiles[id],x,y,c));const result=[...src];
      for(let n=0;n<targets.length;n++){const w=ws[n]*scale;if(!w)continue;const {side,strip}=targets[n],k=(side==='T'||side==='B')?x:y;for(let c=0;c<4;c++)result[c]+=w*(strip[k][c]-src[c]);}
      result[3]=255;setPixel(base,x,y,result.map(v=>clamp(Math.round(v),0,255)));
    }
    tiles[id]=base;
  }
}

const crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(buf){let c=0xffffffff;for(const v of buf)c=crcTable[(c^v)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function chunk(tag,data){const t=Buffer.from(tag),out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length,0);t.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([t,data])),8+data.length);return out;}
function encodeRgbaPng({width,height,rgba}){const sig=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;const stride=width*4,raw=Buffer.alloc(height*(stride+1));for(let y=0;y<height;y++){raw[y*(stride+1)]=0;rgba.copy(raw,y*(stride+1)+1,y*stride,(y+1)*stride);}return Buffer.concat([sig,chunk("IHDR",ihdr),chunk("IDAT",deflateSync(raw,{level:9})),chunk("IEND",Buffer.alloc(0))]);}

const material=buildMaterial();
const tiles=[];for(let id=0;id<16;id++)tiles[id]=id<ACTIVE?renderTile(material,id):Buffer.alloc(T*T*4);
canonicalize(tiles);
const atlasW=T*recipe.runtime.atlasColumns,atlasH=T*recipe.runtime.atlasRows,rgba=Buffer.alloc(atlasW*atlasH*4);
for(let id=0;id<16;id++){const r=(id/recipe.runtime.atlasColumns)|0,c=id%recipe.runtime.atlasColumns,tile=tiles[id];for(let y=0;y<T;y++){const dst=((r*T+y)*atlasW+c*T)*4;tile.copy(rgba,dst,y*T*4,(y+1)*T*4);}}
const atlasPng=encodeRgbaPng({width:atlasW,height:atlasH,rgba});
const materialPng=encodeRgbaPng(material);
const outDir=join(root,"public/assets/deck");mkdirSync(outDir,{recursive:true});
writeFileSync(join(outDir,"transfer-hall-architecture.png"),atlasPng);
writeFileSync(join(outDir,"transfer-hall-wall-material-preview.png"),materialPng);
console.log(`Transfer Hall procedural compositor: ${atlasW}x${atlasH}, fascia=${TH}px, collision=${recipe.runtime.collisionCore}px, shared material coordinates`);
