import {parseGlb} from './glb-parse.js';

// Die 24 GLB-Teile. Geometrie bleibt wie geliefert (keine Vereinfachung).
// Jedes Teil wird auf die Wasserfläche gelegt: die erkennbare Seite nach oben,
// die lange Seite entlang X, Unterkante auf y=0. `span` ist die längere
// Grundseite in Mesh-Einheiten (1 ≈ eine Flasche, wie die bisherigen Netze).

export const ITEM_DEFS=Object.freeze([
 // up: welche Achse der Datei nach oben zeigt. 'y' liegt schon, 'z' ist die Schauseite.
 ['plastik','pet-flasche','PET-Flasche',.34,1.00,'y'],
 ['plastik','tuete','Plastiktüte',.22,1.05,'z'],
 ['plastik','becher','Plastikbecher',.30,.90,'z'],
 ['plastik','sixpack-ring','Sixpack-Ring',.18,.84,'z'],
 ['plastik','kanister','Kanister',.70,1.08,'z'],
 ['plastik','waschmittelflasche','Waschmittelflasche',.55,1.02,'z'],
 ['metall','dose','Getränkedose',.45,.84,'y'],
 ['metall','konservendose','Konservendose',.55,.80,'z'],
 ['metall','spraydose','Spraydose',.40,.88,'y'],
 ['metall','kronkorken','Kronkorken',.12,.50,'z'],
 ['metall','alu-schale','Alu-Schale',.22,1.00,'z'],
 ['metall','fischdose','Fischdose',.48,.86,'z'],
 ['glas','gruene-flasche','Glasflasche',.62,1.00,'y'],
 ['glas','schraubglas','Schraubglas',.70,.82,'y'],
 ['glas','bierflasche','Bierflasche',.60,1.00,'y'],
 ['glas','flaschenpost','Flaschenpost',.50,.98,'y'],
 ['glas','parfuemflakon','Parfümflakon',.32,.66,'y'],
 ['glas','medizinflasche','Medizinflasche',.25,.64,'y'],
 ['rest','reifen','Autoreifen',1.10,1.28,'z'],
 ['rest','badelatsche','Badelatsche',.30,1.00,'z'],
 ['rest','handschuh','Gummihandschuh',.22,.92,'z'],
 ['rest','fischernetz','Fischernetz',.40,1.08,'z'],
 ['rest','maske','Einwegmaske',.12,.90,'z'],
 ['rest','windel','Windel',.35,.98,'z']
].map(([category,name,label,mass,span,up])=>Object.freeze({
 category,name,label,mass,span,up,
 key:`${category}:${name}`,
 file:`${category}-${name}.glb`,
 fit:1,long:1,thick:1,radius:16,mid:.12
})));

export const PILE_KINDS=ITEM_DEFS;
export const MESH_KEYS=Object.freeze(ITEM_DEFS.map(k=>k.key));

const cache=new Map();

export function itemByKey(key){return ITEM_DEFS.find(k=>k.key===key)||null;}

export function colliderOf(key){
 ensureNode();
 return cache.get(key)?.collider||null;
}
export function getMesh(key){
 ensureNode();
 return cache.get(key)||null;
}

export async function loadItemMeshes(fetchImpl=globalThis.fetch){
 if(cache.size>=ITEM_DEFS.length)return cache;
 await Promise.all(ITEM_DEFS.map(async item=>{
  if(cache.has(item.key))return;
  const url=new URL('../assets/items3d/'+item.file,import.meta.url);
  const res=await fetchImpl(url);
  if(!res.ok)throw new Error('Müllmodell fehlt: '+item.file);
  cache.set(item.key,buildItem(new Uint8Array(await res.arrayBuffer()),item));
 }));
 return cache;
}

function ensureNode(){
 if(cache.size>=ITEM_DEFS.length)return;
 const fs=globalThis.process?.getBuiltinModule?.('fs');
 const url=globalThis.process?.getBuiltinModule?.('url');
 if(!fs||!url)return;
 for(const item of ITEM_DEFS){
  if(cache.has(item.key))continue;
  const file=url.fileURLToPath(new URL('../assets/items3d/'+item.file,import.meta.url));
  cache.set(item.key,buildItem(fs.readFileSync(file),item));
 }
}

export function buildItem(bytes,item){
 const parsed=parse(bytes);
 const pos=parsed.positions.slice();
 const nrm=parsed.normals.slice();
 layFlat(pos,nrm,item.up||'y');
 placeAndScale(pos,item.span);
 const indices=parsed.indices.length&&parsed.indices.every?.(i=>i<65536)!==false&&maxIndex(parsed.indices)<65536
  ?Uint16Array.from(parsed.indices):Uint32Array.from(parsed.indices);
 return{
  key:item.key,
  positions:pos,
  normals:nrm,
  uvs:parsed.uvs,
  tangents:tangentsOf(pos,nrm,parsed.uvs,parsed.indices),
  indices,
  images:parsed.images,
  doubleSided:parsed.doubleSided,
  baseFactor:parsed.baseFactor,
  metallicFactor:parsed.metallicFactor,
  roughnessFactor:parsed.roughnessFactor,
  normalScale:parsed.normalScale,
  collider:measure(pos),
  tris:parsed.indices.length/3
 };
}

function maxIndex(idx){let m=0;for(let i=0;i<idx.length;i++)if(idx[i]>m)m=idx[i];return m;}

function parse(bytes){return parseGlb(bytes);}

function layFlat(pos,nrm,upName){
 const up=upName==='z'?2:upName==='x'?0:1;
 const size=extents(pos).size;
 const horiz=[0,1,2].filter(a=>a!==up);
 const longA=size[horiz[0]]>=size[horiz[1]]?horiz[0]:horiz[1];
 const X=[0,0,0],Y=[0,0,0];
 X[longA]=1;Y[up]=1;
 const Z=[X[1]*Y[2]-X[2]*Y[1],X[2]*Y[0]-X[0]*Y[2],X[0]*Y[1]-X[1]*Y[0]];
 map3(pos,(x,y,z)=>[x*X[0]+y*X[1]+z*X[2],x*Y[0]+y*Y[1]+z*Y[2],x*Z[0]+y*Z[1]+z*Z[2]]);
 map3(nrm,(x,y,z)=>{
  const o=[x*X[0]+y*X[1]+z*X[2],x*Y[0]+y*Y[1]+z*Y[2],x*Z[0]+y*Z[1]+z*Z[2]];
  const l=Math.hypot(o[0],o[1],o[2])||1;
  return[o[0]/l,o[1]/l,o[2]/l];
 });
}

function placeAndScale(pos,span){
 const e=extents(pos);
 const cx=(e.min[0]+e.max[0])*.5,cz=(e.min[2]+e.max[2])*.5;
 const wide=Math.max(e.size[0],e.size[2])||1;
 const s=(span||1)/wide;
 for(let i=0;i<pos.length;i+=3){
  pos[i]=(pos[i]-cx)*s;
  pos[i+1]=(pos[i+1]-e.min[1])*s;
  pos[i+2]=(pos[i+2]-cz)*s;
 }
}

function extents(pos){
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<pos.length;i+=3)for(let k=0;k<3;k++){
  const v=pos[i+k];if(v<min[k])min[k]=v;if(v>max[k])max[k]=v;
 }
 return{min,max,size:min.map((m,k)=>max[k]-m)};
}

function map3(arr,fn){
 for(let i=0;i<arr.length;i+=3){
  const o=fn(arr[i],arr[i+1],arr[i+2]);
  arr[i]=o[0];arr[i+1]=o[1];arr[i+2]=o[2];
 }
}

// Kapsel in Mesh-Einheiten. tube füllt die schmale Seite, halfLen den Rest der langen.
export function measure(pos){
 const e=extents(pos);
 const hx=e.size[0]*.5,hz=e.size[2]*.5,hy=e.size[1];
 const rad=Math.min(hx,hz);
 return{
  halfLen:Math.max(0,Math.max(hx,hz)-rad),
  tube:Math.max(.02,rad),
  stackH:Math.max(.028,hy*.96)
 };
}

function tangentsOf(pos,nrm,uv,idx){
 const n=pos.length/3;
 const t1=new Float32Array(n*3),t2=new Float32Array(n*3);
 for(let i=0;i<idx.length;i+=3){
  const i0=idx[i],i1=idx[i+1],i2=idx[i+2];
  const x0=pos[i0*3],y0=pos[i0*3+1],z0=pos[i0*3+2];
  const x1=pos[i1*3],y1=pos[i1*3+1],z1=pos[i1*3+2];
  const x2=pos[i2*3],y2=pos[i2*3+1],z2=pos[i2*3+2];
  const u0=uv[i0*2],v0=uv[i0*2+1],u1=uv[i1*2],v1=uv[i1*2+1],u2=uv[i2*2],v2=uv[i2*2+1];
  const dx1=x1-x0,dy1=y1-y0,dz1=z1-z0,dx2=x2-x0,dy2=y2-y0,dz2=z2-z0;
  const du1=u1-u0,dv1=v1-v0,du2=u2-u0,dv2=v2-v0;
  const r=du1*dv2-du2*dv1,s=Math.abs(r)<1e-8?0:1/r;
  const tx=(dv2*dx1-dv1*dx2)*s,ty=(dv2*dy1-dv1*dy2)*s,tz=(dv2*dz1-dv1*dz2)*s;
  const bx=(du1*dx2-du2*dx1)*s,by=(du1*dy2-du2*dy1)*s,bz=(du1*dz2-du2*dz1)*s;
  for(const k of [i0,i1,i2]){
   t1[k*3]+=tx;t1[k*3+1]+=ty;t1[k*3+2]+=tz;
   t2[k*3]+=bx;t2[k*3+1]+=by;t2[k*3+2]+=bz;
  }
 }
 const out=new Float32Array(n*4);
 for(let i=0;i<n;i++){
  const nx=nrm[i*3],ny=nrm[i*3+1],nz=nrm[i*3+2];
  let tx=t1[i*3],ty=t1[i*3+1],tz=t1[i*3+2];
  const d=nx*tx+ny*ty+nz*tz;
  tx-=nx*d;ty-=ny*d;tz-=nz*d;
  let l=Math.hypot(tx,ty,tz);
  if(l<1e-8){
   const ax=Math.abs(nx)<.9?1:0,ay=ax?0:1;
   tx=ny*0-nz*ay;ty=nz*ax-nx*0;tz=nx*ay-ny*ax;
   l=Math.hypot(tx,ty,tz)||1;
  }
  tx/=l;ty/=l;tz/=l;
  const hx=ny*tz-nz*ty,hy=nz*tx-nx*tz,hz=nx*ty-ny*tx;
  const w=(hx*t2[i*3]+hy*t2[i*3+1]+hz*t2[i*3+2])<0?-1:1;
  out[i*4]=tx;out[i*4+1]=ty;out[i*4+2]=tz;out[i*4+3]=w;
 }
 return out;
}
