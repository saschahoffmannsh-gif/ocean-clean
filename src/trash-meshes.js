// Low-Poly-Netze für den 3D-Prototyp. Einheiten: Länge 1 entlang X, Y nach oben.
// Die Körper liegen auf der Wasserfläche (Unterkante y=0), passend zur Draufsicht
// der PNG-Sprites. Keine Billboards, keine Texturen – Form und Materialfarbe tragen.

const TAU=Math.PI*2;

export const PROTOTYPE_KEYS=Object.freeze([
 'plastik:pet-flasche',
 'metall:dose',
 'glas:gruene-flasche',
 'rest:reifen'
]);

export function meshKey(kind){return kind?`${kind.category}:${kind.name}`:'';}
export function hasPrototypeMesh(kind){return PROTOTYPE_KEYS.includes(meshKey(kind));}
// true, wenn dieses Teil als Netz gezeichnet wird und das PNG ausbleibt.
export function spriteReplacedByMesh(view3d,kind){return !!(view3d&&view3d.active&&hasPrototypeMesh(kind));}

function lathe(profile,segments){
 const rings=profile.length,pos=[],nrm=[];
 for(let i=0;i<rings;i++){
  const a=profile[Math.max(0,i-1)],b=profile[Math.min(rings-1,i+1)];
  let tx=b.x-a.x,tr=b.r-a.r,nx=-tr,nr=tx,len=Math.hypot(nx,nr)||1;
  nx/=len;nr/=len;
  if(nr<0){nx=-nx;nr=-nr;}
  for(let s=0;s<segments;s++){
   const t=s/segments*TAU,ca=Math.cos(t),sa=Math.sin(t),r=profile[i].r;
   pos.push(profile[i].x,r*ca,r*sa);
   nrm.push(nx,nr*ca,nr*sa);
  }
 }
 const idx=[];
 for(let i=0;i<rings-1;i++)for(let s=0;s<segments;s++){
  const s2=(s+1)%segments,a=i*segments+s,b=i*segments+s2,c=(i+1)*segments+s,d=(i+1)*segments+s2;
  idx.push(a,b,c,b,d,c);
 }
 return{positions:new Float32Array(pos),normals:normalize(nrm),indices:new Uint16Array(idx)};
}

function normalize(src){
 const out=new Float32Array(src.length);
 for(let i=0;i<src.length;i+=3){
  const x=src[i],y=src[i+1],z=src[i+2],l=Math.hypot(x,y,z)||1;
  out[i]=x/l;out[i+1]=y/l;out[i+2]=z/l;
 }
 return out;
}

function part(profile,segments,mat){
 return{...lathe(profile.map(([x,r])=>({x,r})),segments),...mat};
}

// Unterkante auf y=0, alle Teile gemeinsam, damit Deckel und Etikett sitzen bleiben.
function sit(parts){
 let minY=Infinity;
 for(const p of parts)for(let i=1;i<p.positions.length;i+=3)if(p.positions[i]<minY)minY=p.positions[i];
 for(const p of parts)for(let i=1;i<p.positions.length;i+=3)p.positions[i]-=minY;
 return{parts};
}

function tireMesh(){
 // Grobe Stollen wechseln sich ab, damit die Draufsicht ein Reifenprofil zeigt und keinen glatten Ring.
 const majorSeg=22,minorSeg=10,R=0.35,tube=0.118,pos=[],nrm=[];
 for(let i=0;i<majorSeg;i++){
  const a=i/majorSeg*TAU,ca=Math.cos(a),sa=Math.sin(a);
  // Flache, häufige Stollen: Profil bleibt rund, die Kante wellt sich nur leicht.
  const cog=i%2===0?0.046:0.018;
  for(let j=0;j<minorSeg;j++){
   const b=j/minorSeg*TAU,cb=Math.cos(b),sb=Math.sin(b);
   const outer=Math.max(0,cb);
   const rr=tube+cog*outer*outer+Math.cos(b*2)*0.006*outer;
   const ox=ca*cb,oy=sb,oz=sa*cb;
   pos.push(ca*R+ox*rr,oy*rr,sa*R+oz*rr);
   nrm.push(ox,oy,oz);
  }
 }
 const idx=[];
 for(let i=0;i<majorSeg;i++)for(let j=0;j<minorSeg;j++){
  const i2=(i+1)%majorSeg,j2=(j+1)%minorSeg;
  const a=i*minorSeg+j,b=i*minorSeg+j2,c=i2*minorSeg+j,d=i2*minorSeg+j2;
  idx.push(a,b,c,b,d,c);
 }
 const rubber={
  positions:new Float32Array(pos),normals:normalize(nrm),indices:new Uint16Array(idx),
  color:[0.16,0.16,0.17],metal:0.04,rough:0.9,alpha:1,fresnel:0.1,decal:false
 };
 return sit([rubber]);
}

// Proportionen an den Alpha-Boxen der Draufsicht-Sprites: PET ~2.7:1, Dose ~1.7:1, Glas ~3.2:1.
function pet(){
 const seg=16;
 const body=part([
  [-0.44,0.040],[-0.40,0.046],[-0.35,0.052],[-0.30,0.088],[-0.25,0.140],
  [-0.19,0.172],[-0.11,0.178],[-0.03,0.166],
  [0.05,0.112],[0.11,0.155],[0.20,0.184],[0.33,0.178],[0.42,0.140],[0.47,0.078],[0.50,0.012]
 ],seg,{color:[0.62,0.86,0.94],metal:0.06,rough:0.18,alpha:0.52,fresnel:0.8,decal:false});
 const cap=part([
  [-0.50,0.012],[-0.50,0.078],[-0.445,0.084],[-0.428,0.070],[-0.422,0.048]
 ],seg,{color:[0.93,0.93,0.90],metal:0.04,rough:0.45,alpha:1,fresnel:0.12,decal:true});
 const label=part([
  [-0.175,0.180],[-0.175,0.190],[-0.015,0.190],[-0.015,0.172]
 ],seg,{color:[0.12,0.38,0.82],metal:0.08,rough:0.4,alpha:1,fresnel:0.15,decal:true});
 return sit([body,cap,label]);
}

function can(){
 const seg=20,silver={color:[0.86,0.88,0.90],metal:1,rough:0.16,alpha:1,fresnel:0.35,decal:true};
 const body=part([
  [-0.34,0.248],[0.34,0.248]
 ],seg,{color:[0.78,0.08,0.10],metal:0.88,rough:0.28,alpha:1,fresnel:0.3,decal:false});
 // Silberne Bördelränder an beiden Enden, lang genug für die Draufsicht.
 const left=part([[-0.50,0.02],[-0.488,0.16],[-0.468,0.292],[-0.40,0.262],[-0.34,0.248]],seg,silver);
 const right=part([[0.34,0.248],[0.40,0.262],[0.468,0.292],[0.488,0.16],[0.50,0.02]],seg,silver);
 return sit([body,left,right]);
}

function greenBottle(){
 const seg=16;
 const body=part([
  [-0.50,0.02],[-0.49,0.058],[-0.47,0.064],[-0.45,0.040],[-0.40,0.036],[-0.22,0.038],
  [-0.14,0.055],[-0.08,0.095],[-0.02,0.140],[0.05,0.157],[0.40,0.157],[0.46,0.130],[0.49,0.06],[0.50,0.012]
 ],seg,{color:[0.05,0.38,0.14],metal:0.12,rough:0.12,alpha:0.74,fresnel:0.92,decal:false});
 const label=part([
  [0.10,0.157],[0.10,0.168],[0.34,0.168],[0.34,0.157]
 ],seg,{color:[0.70,0.54,0.30],metal:0.18,rough:0.55,alpha:1,fresnel:0.12,decal:true});
 return sit([body,label]);
}

const BUILDERS={
 'plastik:pet-flasche':pet,
 'metall:dose':can,
 'glas:gruene-flasche':greenBottle,
 'rest:reifen':tireMesh
};

const cache=new Map();
export function getPrototypeMesh(key){
 let mesh=cache.get(key);
 if(!mesh){
  const build=BUILDERS[key];
  if(!build)return null;
  mesh=build();
  cache.set(key,mesh);
 }
 return mesh;
}
