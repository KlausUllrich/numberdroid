import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const path = process.argv[2] ?? "public/assets/deck/transfer-hall-architecture.png";
const T = 64;

function decodeRgbaPng(path) {
  const b = readFileSync(path);
  const sig = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  if (!b.subarray(0,8).equals(sig)) throw new Error("not PNG");
  let off=8, width=0, height=0, bit=0, type=0, interlace=0; const idat=[];
  while (off < b.length) {
    const len=b.readUInt32BE(off); const tag=b.toString("ascii",off+4,off+8); const data=b.subarray(off+8,off+8+len); off += 12+len;
    if (tag==="IHDR") { width=data.readUInt32BE(0); height=data.readUInt32BE(4); bit=data[8]; type=data[9]; interlace=data[12]; }
    else if (tag==="IDAT") idat.push(data);
    else if (tag==="IEND") break;
  }
  if (bit!==8 || type!==6 || interlace!==0) throw new Error(`expected non-interlaced RGBA8 PNG, got bit=${bit} type=${type} interlace=${interlace}`);
  const raw=inflateSync(Buffer.concat(idat)); const bpp=4, stride=width*bpp; const rgba=Buffer.alloc(width*height*bpp); let rp=0;
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c); return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for (let y=0;y<height;y++) {
    const f=raw[rp++];
    for (let x=0;x<stride;x++) {
      const v=raw[rp++], left=x>=bpp?rgba[y*stride+x-bpp]:0, up=y?rgba[(y-1)*stride+x]:0, ul=(y&&x>=bpp)?rgba[(y-1)*stride+x-bpp]:0;
      let q=v;
      if (f===1) q=(v+left)&255; else if (f===2) q=(v+up)&255; else if (f===3) q=(v+Math.floor((left+up)/2))&255; else if (f===4) q=(v+paeth(left,up,ul))&255; else if (f!==0) throw new Error(`unsupported filter ${f}`);
      rgba[y*stride+x]=q;
    }
  }
  return {width,height,rgba};
}
function px(img,x,y){ const i=(y*img.width+x)*4; return [img.rgba[i],img.rgba[i+1],img.rgba[i+2],img.rgba[i+3]]; }
function edge(img,tile,side){ const r=Math.floor(tile/4),c=tile%4,x0=c*T,y0=r*T,out=[]; for(let k=0;k<T;k++){ let x,y; if(side==='T'){x=x0+k;y=y0;} if(side==='B'){x=x0+k;y=y0+T-1;} if(side==='L'){x=x0;y=y0+k;} if(side==='R'){x=x0+T-1;y=y0+k;} out.push(px(img,x,y)); } return out; }
function diff(a,b){ let sum=0,n=0; for(let i=0;i<a.length;i++) for(let c=0;c<4;c++){sum+=Math.abs(a[i][c]-b[i][c]);n++;} return sum/n; }

// Semantic connector classes from TRANSFER_HALL_WALL_KIT.md.
// Genuine CAP ends are intentionally absent: they terminate, so they must NOT share a canon.
const groups={
  OUTER_TOP_RUN:[[0,'L'],[0,'R'],[4,'R'],[5,'L'],[9,'L'],[9,'R']],
  OUTER_BOTTOM_RUN:[[1,'L'],[1,'R'],[7,'R'],[6,'L'],[10,'L'],[10,'R']],
  OUTER_LEFT_RUN:[[2,'T'],[2,'B'],[4,'B'],[7,'T']],
  OUTER_RIGHT_RUN:[[3,'T'],[3,'B'],[5,'B'],[6,'T']],
  DIVIDER_VERTICAL:[[8,'T'],[8,'B'],[9,'B'],[10,'T'],[11,'T'],[12,'B']],
};

const img=decodeRgbaPng(path); if(img.width!==256||img.height!==256) throw new Error(`expected 256x256 atlas, got ${img.width}x${img.height}`);
const entries=[];
for(const [group,members] of Object.entries(groups)) for(const [tile,side] of members) entries.push({group,axis:(side==='L'||side==='R')?'VERT_BOUNDARY':'HORIZ_BOUNDARY',name:`${tile}.${side}`,strip:edge(img,tile,side)});
const same=[], control=[]; let worst={d:-1,a:'',b:''};
for(let i=0;i<entries.length;i++) for(let j=i+1;j<entries.length;j++) {
  const a=entries[i],b=entries[j]; if(a.axis!==b.axis) continue; const v=diff(a.strip,b.strip);
  if(a.group===b.group){same.push(v); if(v>worst.d) worst={d:v,a:a.name,b:b.name};} else control.push(v);
}
const mean=x=>x.reduce((a,b)=>a+b,0)/x.length; const s=mean(same),g=mean(control),ratio=s===0?Infinity:g/s;
console.log(`semantic connector edges : ${entries.length}`);
console.log(`SAME-TYPE mean diff      : ${s.toFixed(3)}   <- must match`);
console.log(`DIFF-TYPE mean diff      : ${g.toFixed(3)}   <- negative control`);
console.log(`RATIO                    : ${Number.isFinite(ratio)?ratio.toFixed(1):'∞'}x`);
console.log(`WORST same-type pair     : ${worst.d.toFixed(3)} (${worst.a} vs ${worst.b})`);

// A match number without a negative control is not considered meaningful QA.
// The current canonicalized kit should be pixel-identical at the actual runtime seam.
if (s > 1.0 || (Number.isFinite(ratio) && ratio < 20)) {
  throw new Error(`wall seam QA failed: same=${s.toFixed(3)} control=${g.toFixed(3)} ratio=${ratio.toFixed(1)}x`);
}
