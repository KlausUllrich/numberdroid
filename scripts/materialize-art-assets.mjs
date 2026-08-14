import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDir = join(root, "art-source/runtime");

function sourceBytes({name,prefix,expectedChunks,expectedBytes,expectedSha256}) {
  const files = readdirSync(runtimeDir).filter((file)=>file.startsWith(prefix)).sort();
  if(files.length!==expectedChunks) throw new Error(`${name}: expected ${expectedChunks} source chunks, found ${files.length}`);
  const bytes=Buffer.from(files.map((f)=>readFileSync(join(runtimeDir,f),"utf8").trim()).join(""),"base64");
  const sig=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  if(bytes.length<24||!bytes.subarray(0,8).equals(sig)) throw new Error(`${name}: source is not PNG`);
  if(bytes.length!==expectedBytes) throw new Error(`${name}: expected ${expectedBytes} bytes, decoded ${bytes.length}`);
  const digest=createHash("sha256").update(bytes).digest("hex");
  if(digest!==expectedSha256) throw new Error(`${name}: source SHA-256 mismatch (${digest})`);
  return bytes;
}

function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
function decodePng(bytes){
  let off=8,width=0,height=0,bit=0,type=0,interlace=0,palette=null,transparency=null; const idat=[];
  while(off<bytes.length){const len=bytes.readUInt32BE(off), tag=bytes.toString("ascii",off+4,off+8), data=bytes.subarray(off+8,off+8+len); off+=12+len;
    if(tag==="IHDR"){width=data.readUInt32BE(0);height=data.readUInt32BE(4);bit=data[8];type=data[9];interlace=data[12];}
    else if(tag==="PLTE") palette=data;
    else if(tag==="tRNS") transparency=data;
    else if(tag==="IDAT") idat.push(data);
    else if(tag==="IEND") break;
  }
  if(bit!==8||interlace!==0||![3,6].includes(type)) throw new Error(`PNG decoder supports non-interlaced 8-bit palette/RGBA only; got bit=${bit} type=${type}`);
  const bpp=type===6?4:1, stride=width*bpp, raw=inflateSync(Buffer.concat(idat)), scan=Buffer.alloc(height*stride); let rp=0;
  for(let y=0;y<height;y++){const f=raw[rp++];for(let x=0;x<stride;x++){const v=raw[rp++],left=x>=bpp?scan[y*stride+x-bpp]:0,up=y?scan[(y-1)*stride+x]:0,ul=(y&&x>=bpp)?scan[(y-1)*stride+x-bpp]:0;let q=v;
      if(f===1)q=(v+left)&255; else if(f===2)q=(v+up)&255; else if(f===3)q=(v+Math.floor((left+up)/2))&255; else if(f===4)q=(v+paeth(left,up,ul))&255; else if(f!==0)throw new Error(`unsupported PNG filter ${f}`); scan[y*stride+x]=q;}}
  const rgba=Buffer.alloc(width*height*4);
  if(type===6){scan.copy(rgba);} else {
    if(!palette) throw new Error("palette PNG missing PLTE");
    for(let i=0;i<width*height;i++){const idx=scan[i],p=idx*3,o=i*4;rgba[o]=palette[p]??0;rgba[o+1]=palette[p+1]??0;rgba[o+2]=palette[p+2]??0;rgba[o+3]=transparency&&idx<transparency.length?transparency[idx]:255;}
  }
  return {width,height,rgba};
}

const crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(buf){let c=0xffffffff;for(const v of buf)c=crcTable[(c^v)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function chunk(tag,data){const t=Buffer.from(tag),out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length,0);t.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([t,data])),8+data.length);return out;}
function encodeRgbaPng({width,height,rgba}){const sig=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6; const stride=width*4,raw=Buffer.alloc(height*(stride+1));for(let y=0;y<height;y++){raw[y*(stride+1)]=0;rgba.copy(raw,y*(stride+1)+1,y*stride,(y+1)*stride);}return Buffer.concat([sig,chunk("IHDR",ihdr),chunk("IDAT",deflateSync(raw,{level:9})),chunk("IEND",Buffer.alloc(0))]);}

const T=64,TH=24,CX=(T-TH)>>1;
function targetMask(id,x,y){
  if(id===0)return y<TH; if(id===1)return y>=T-TH; if(id===2)return x<TH; if(id===3)return x>=T-TH;
  if(id===4)return y<TH||x<TH; if(id===5)return y<TH||x>=T-TH; if(id===6)return y>=T-TH||x>=T-TH; if(id===7)return y>=T-TH||x<TH;
  if(id===8||id===11||id===12)return x>=CX&&x<CX+TH;
  if(id===9)return y<TH||(x>=CX&&x<CX+TH);
  if(id===10)return y>=T-TH||(x>=CX&&x<CX+TH);
  return false;
}
function pixel(tile,x,y,c){return tile[(y*T+x)*4+c];}
function setPixel(tile,x,y,rgba){const o=(y*T+x)*4;for(let c=0;c<4;c++)tile[o+c]=rgba[c];}
function nearestFillTile(source,id){
  const out=Buffer.alloc(T*T*4),dist=new Int16Array(T*T);dist.fill(-1);const owner=new Int32Array(T*T),queue=new Int32Array(T*T);let h=0,q=0;
  for(let y=0;y<T;y++)for(let x=0;x<T;x++){const p=y*T+x;if(pixel(source,x,y,3)>16){dist[p]=0;owner[p]=p;queue[q++]=p;}}
  if(q===0) throw new Error(`wall tile ${id} has no source material`);
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  while(h<q){const p=queue[h++],x=p%T,y=(p/T)|0;for(const [dx,dy] of dirs){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=T||ny>=T)continue;const np=ny*T+nx;if(dist[np]>=0)continue;dist[np]=dist[p]+1;owner[np]=owner[p];queue[q++]=np;}}
  for(let y=0;y<T;y++)for(let x=0;x<T;x++){if(!targetMask(id,x,y))continue;const p=y*T+x,sp=owner[p],sx=sp%T,sy=(sp/T)|0;setPixel(out,x,y,[pixel(source,sx,sy,0),pixel(source,sx,sy,1),pixel(source,sx,sy,2),255]);}
  return out;
}
function edge(tile,side){const out=Array.from({length:T},()=>[0,0,0,0]);for(let k=0;k<T;k++){let x,y;if(side==='T'){x=k;y=0}else if(side==='B'){x=k;y=T-1}else if(side==='L'){x=0;y=k}else{x=T-1;y=k}for(let c=0;c<4;c++)out[k][c]=pixel(tile,x,y,c);}return out;}
function median(vals){const a=[...vals].sort((x,y)=>x-y),m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2;}
const connectorGroups={
  OUTER_TOP_RUN:[[0,'L'],[0,'R'],[4,'R'],[5,'L'],[9,'L'],[9,'R']],
  OUTER_BOTTOM_RUN:[[1,'L'],[1,'R'],[7,'R'],[6,'L'],[10,'L'],[10,'R']],
  OUTER_LEFT_RUN:[[2,'T'],[2,'B'],[4,'B'],[7,'T']],
  OUTER_RIGHT_RUN:[[3,'T'],[3,'B'],[5,'B'],[6,'T']],
  DIVIDER_VERTICAL:[[8,'T'],[8,'B'],[9,'B'],[10,'T'],[11,'T'],[12,'B']],
};
function canonicalize(tiles){
  const canon={}; for(const [name,members] of Object.entries(connectorGroups)){const strips=members.map(([id,s])=>edge(tiles[id],s));canon[name]=Array.from({length:T},(_,k)=>Array.from({length:4},(_,c)=>median(strips.map(st=>st[k][c]))));}
  const blend=10;
  for(let id=0;id<13;id++){
    const base=Buffer.from(tiles[id]),targets=[];
    for(const [name,members] of Object.entries(connectorGroups))for(const [tid,side] of members)if(tid===id)targets.push({side,strip:canon[name]});
    for(let y=0;y<T;y++)for(let x=0;x<T;x++){
      if(!targetMask(id,x,y)){setPixel(base,x,y,[0,0,0,0]);continue;}
      const ws=targets.map(({side})=>{const d=side==='T'?y:side==='B'?T-1-y:side==='L'?x:T-1-x;return Math.max(0,1-d/blend);});let sum=ws.reduce((a,b)=>a+b,0);const scale=sum>1?1/sum:1;sum=0;const rgb=[0,0,0,0];
      for(let c=0;c<4;c++)rgb[c]=pixel(tiles[id],x,y,c);
      const result=rgb.map(v=>v); for(let n=0;n<targets.length;n++){const w=ws[n]*scale;if(!w)continue;sum+=w;const {side,strip}=targets[n],k=(side==='T'||side==='B')?x:y;for(let c=0;c<4;c++)result[c]+=w*(strip[k][c]-rgb[c]);}
      result[3]=255;setPixel(base,x,y,result.map(v=>Math.max(0,Math.min(255,Math.round(v)))));
    }
    tiles[id]=base;
  }
}
function buildWallAtlas(sourceBytes){const src=decodePng(sourceBytes);if(src.width!==256||src.height!==256)throw new Error(`wall source expected 256x256, got ${src.width}x${src.height}`);const tiles=[];for(let id=0;id<16;id++){const r=(id/4)|0,c=id%4,t=Buffer.alloc(T*T*4);for(let y=0;y<T;y++)for(let x=0;x<T;x++){const si=((r*T+y)*src.width+c*T+x)*4,di=(y*T+x)*4;src.rgba.copy(t,di,si,si+4);}tiles[id]=id<13?nearestFillTile(t,id):Buffer.alloc(T*T*4);}canonicalize(tiles);const rgba=Buffer.alloc(256*256*4);for(let id=0;id<16;id++){const r=(id/4)|0,c=id%4,t=tiles[id];for(let y=0;y<T;y++){const dst=((r*T+y)*256+c*T)*4;t.copy(rgba,dst,y*T*4,(y+1)*T*4);}}return encodeRgbaPng({width:256,height:256,rgba});}

const wallSource=sourceBytes({name:"Transfer Hall Architecture 16px material source",prefix:"transfer-hall-architecture-16px.b64.",expectedChunks:2,expectedBytes:3660,expectedSha256:"b44c324cd2b5820e76ab9765c7735ff0f227a86f5eaf2329a655e0cbc9004df9"});
const wallOut=buildWallAtlas(wallSource);const wallDigest=createHash("sha256").update(wallOut).digest("hex");
mkdirSync(join(root,"public/assets/deck"),{recursive:true});writeFileSync(join(root,"public/assets/deck/transfer-hall-architecture.png"),wallOut);console.log(`Transfer Hall Architecture: derived 24px fascia + semantic seam canon, ${wallOut.length} bytes (${wallDigest.slice(0,12)}…)`);

const pico=sourceBytes({name:"PICO eight-direction Gold Slice strip",prefix:"directional-pico-gold.b64.",expectedChunks:4,expectedBytes:14617,expectedSha256:"cb392e02da021ee2e33031021c6e7f01051f98edc4a01d0e9386a320f31494c9"});
if(pico.readUInt32BE(16)!==768||pico.readUInt32BE(20)!==96)throw new Error("PICO dimensions changed");mkdirSync(join(root,"public/assets/robots"),{recursive:true});writeFileSync(join(root,"public/assets/robots/directional-pico.png"),pico);console.log("PICO: materialized validated 768x96 strip");
