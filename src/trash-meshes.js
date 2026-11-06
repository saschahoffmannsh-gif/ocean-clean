// Zwanzig Müll-Netze, Match-3D-nah: rundliche Low-Poly-Formen, glatte Normalen,
// klare Farben. Länge entlang X, Y nach oben, Unterkante auf y=0.
// Keine Texturen. Kollider werden aus dem Netz gemessen.

const TAU=Math.PI*2;

export const MESH_KEYS=Object.freeze([
 'plastik:pet-flasche','plastik:tuete','plastik:becher','plastik:sixpack-ring','plastik:kanister','plastik:waschmittelflasche',
 'glas:gruene-flasche','glas:schraubglas','glas:bierflasche','glas:medizinflasche',
 'gummi:reifen','gummi:badelatsche','gummi:handschuh',
 'metall:dose','metall:konservendose','metall:spraydose',
 'rest:fischernetz','rest:maske','rest:windel','rest:karton'
]);

const mat=(color,o={})=>({color,metal:o.metal??0,rough:o.rough??.38,alpha:o.alpha??1,fresnel:o.fresnel??.28,decal:!!o.decal});

function powc(e,v){return Math.sign(v)*Math.abs(v)**e;}
function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function sub(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function add(a,b){return[a[0]+b[0],a[1]+b[1],a[2]+b[2]];}
function mul(a,s){return[a[0]*s,a[1]*s,a[2]*s];}
function norm(v){const l=Math.hypot(v[0],v[1],v[2])||1;return[v[0]/l,v[1]/l,v[2]/l];}

function gridMesh(nu,nv,sample){
 const pos=[],nrm=[];
 const at=(iu,iv)=>sample(iu/nu*TAU,iv/nv*Math.PI);
 for(let iv=0;iv<=nv;iv++)for(let iu=0;iu<=nu;iu++){
  const p=at(iu,iv);
  const du=sub(at(iu+.35,iv),at(iu-.35,iv)),dv=sub(at(iu,iv+.35),at(iu,iv-.35));
  let n=norm(cross(du,dv));
  if(n[0]*p[0]+n[1]*p[1]+n[2]*p[2]<0)n=mul(n,-1);
  pos.push(p[0],p[1],p[2]);nrm.push(n[0],n[1],n[2]);
 }
 const idx=[],stride=nu+1;
 for(let iv=0;iv<nv;iv++)for(let iu=0;iu<nu;iu++){
  const a=iv*stride+iu,b=a+1,c=a+stride,d=c+1;
  idx.push(a,c,b,b,c,d);
 }
 return{positions:new Float32Array(pos),normals:new Float32Array(nrm),indices:new Uint16Array(idx)};
}

function superellipse(rx,ry,rz,e1,e2,nu,nv){
 const eA=e1,eB=e2;
 return gridMesh(nu,nv,(th,phi)=>{
  const sp=Math.sin(phi),cp=Math.cos(phi),st=Math.sin(th),ct=Math.cos(th);
  return[rx*powc(eB,ct)*powc(eA,sp),ry*powc(eA,cp),rz*powc(eB,st)*powc(eA,sp)];
 });
}

function lathe(profile,segments){
 const rings=profile.length,pos=[],nrm=[];
 for(let i=0;i<rings;i++){
  const a=profile[Math.max(0,i-1)],b=profile[Math.min(rings-1,i+1)];
  let tx=b.x-a.x,tr=b.r-a.r,nx=-tr,ny=tx,len=Math.hypot(nx,ny)||1;
  nx/=len;ny/=len;if(ny<0){nx=-nx;ny=-ny;}
  for(let s=0;s<segments;s++){
   const t=s/segments*TAU,ca=Math.cos(t),sa=Math.sin(t),r=profile[i].r;
   pos.push(profile[i].x,r*ca,r*sa);
   nrm.push(nx,ny*ca,ny*sa);
  }
 }
 const idx=[];
 for(let i=0;i<rings-1;i++)for(let s=0;s<segments;s++){
  const s2=(s+1)%segments,a=i*segments+s,b=i*segments+s2,c=(i+1)*segments+s,d=(i+1)*segments+s2;
  idx.push(a,c,b,b,c,d);
 }
 return{positions:new Float32Array(pos),normals:new Float32Array(nrm),indices:new Uint16Array(idx)};
}
function revolve(profile,seg,material){
 return{...lathe(profile.map(([x,r])=>({x,r})),seg),...material};
}

function torus(R,r,maj,min,axis){
 return gridMesh(maj,min,(th,phi)=>{
  const ca=Math.cos(th),sa=Math.sin(th),cb=Math.cos(phi),sb=Math.sin(phi);
  const rr=R+r*cb;
  if(axis==='y')return[rr*ca,r*sb,rr*sa];
  return[rr*ca,rr*sa,r*sb];
 });
}

function move(mesh,x,y,z){
 const p=mesh.positions;
 for(let i=0;i<p.length;i+=3){p[i]+=x;p[i+1]+=y;p[i+2]+=z;}
 return mesh;
}
function scaleMesh(mesh,x,y,z){
 const p=mesh.positions,n=mesh.normals;
 for(let i=0;i<p.length;i+=3){
  p[i]*=x;p[i+1]*=y;p[i+2]*=z;
  const nn=norm([n[i]/x,n[i+1]/y,n[i+2]/z]);
  n[i]=nn[0];n[i+1]=nn[1];n[i+2]=nn[2];
 }
 return mesh;
}

function sit(parts){
 let minY=Infinity;
 for(const p of parts)for(let i=1;i<p.positions.length;i+=3)if(p.positions[i]<minY)minY=p.positions[i];
 for(const p of parts)for(let i=1;i<p.positions.length;i+=3)p.positions[i]-=minY;
 return parts;
}
function part(mesh,material){return{...mesh,...material};}

function blob(rx,ry,rz,round,nu,nv,material){
 const e=round;
 return part(superellipse(rx,ry,rz,e,e,nu,nv),material);
}

function measure(parts){
 let minX=1e9,maxX=-1e9,minZ=1e9,maxZ=-1e9,maxY=0;
 for(const p of parts){
  const v=p.positions;
  for(let i=0;i<v.length;i+=3){
   minX=Math.min(minX,v[i]);maxX=Math.max(maxX,v[i]);
   minZ=Math.min(minZ,v[i+2]);maxZ=Math.max(maxZ,v[i+2]);
   maxY=Math.max(maxY,v[i+1]);
  }
 }
 const hx=(maxX-minX)*.5,hz=(maxZ-minZ)*.5,rad=Math.min(hx,hz);
 return{halfLen:Math.max(.012,Math.max(hx,hz)-rad),tube:Math.max(.04,rad*.9),stackH:Math.max(.045,maxY*.92)};
}

const P={rough:.32,fresnel:.34};
const GL={rough:.12,fresnel:.92,alpha:.62};
const MET={metal:.92,rough:.2,fresnel:.4};
const RUB={rough:.82,fresnel:.08,metal:.02};

function pet(){
 const seg=22;
 const body=revolve([
  [-.46,.03],[-.42,.05],[-.36,.07],[-.3,.1],[-.24,.15],[-.16,.175],[-.06,.16],
  [.02,.1],[.08,.15],[.2,.185],[.34,.18],[.44,.12],[.5,.04]
 ],seg,mat([.55,.84,.96],{...P,alpha:.9,fresnel:.45}));
 const cap=revolve([[-.52,.02],[-.52,.075],[-.46,.082],[-.44,.05]],seg,mat([.94,.94,.9],{rough:.42,fresnel:.15,decal:true}));
 const label=revolve([[-.16,.178],[-.16,.192],[-.01,.192],[-.01,.17]],seg,mat([.12,.42,.86],{rough:.4,fresnel:.12,decal:true}));
 return[body,cap,label];
}
function bag(){
 const film=mat([.98,.86,.18],{rough:.48,fresnel:.22,alpha:.9});
 const sack=blob(.44,.06,.28,.7,20,12,film);
 const neck=move(blob(.07,.045,.055,.55,10,8,mat([.95,.78,.12],{rough:.5,decal:true})),.36,.03,0);
 const handle=mat([.9,.74,.1],{rough:.45,decal:true});
 const h1=part(move(scaleMesh(torus(.07,.012,12,5,'x'),1,.7,1),-.02,.05,-.1),handle);
 const h2=part(move(scaleMesh(torus(.07,.012,12,5,'x'),1,.7,1),-.02,.05,.1),handle);
 return[sack,neck,h1,h2];
}
function cup(){
 const seg=20;
 const wall=revolve([[-.28,.07],[-.22,.1],[-.05,.125],[.16,.15],[.28,.168],[.3,.15]],seg,mat([.92,.22,.18],{rough:.34,fresnel:.3}));
 const rim=revolve([[.26,.15],[.26,.175],[.32,.175],[.32,.145]],seg,mat([.98,.96,.94],{rough:.3,decal:true}));
 return[wall,rim];
}
function sixpack(){
 const ring=mat([.86,.9,.84],{rough:.35,fresnel:.3,alpha:.9});
 const parts=[];
 for(let r=0;r<2;r++)for(let c=0;c<3;c++){
  parts.push(part(move(torus(.085,.016,16,6,'y'),(c-1)*.2,.02,(r-.5)*.18),ring));
 }
 return parts;
}
function jerrycan(){
 const body=blob(.4,.16,.22,.38,16,12,mat([.16,.62,.28],{rough:.4,fresnel:.22}));
 const handle=part(move(scaleMesh(torus(.1,.02,12,6,'z'),1,.7,1),.08,.16,0),mat([.12,.5,.22],{rough:.45,decal:true}));
 const cap=move(blob(.06,.05,.06,.45,8,6,mat([.2,.2,.2],{rough:.35,decal:true})),-.28,.12,0);
 return[body,handle,cap];
}
function detergent(){
 const seg=18;
 const body=revolve([
  [-.4,.04],[-.34,.1],[-.2,.16],[-.05,.17],[.18,.16],[.32,.1],[.4,.04]
 ],seg,mat([.95,.48,.1],{rough:.3,fresnel:.32}));
 const handle=part(move(torus(.09,.018,12,6,'z'),.05,.14,0),mat([.85,.4,.08],{rough:.35,decal:true}));
 const cap=revolve([[-.42,.03],[-.42,.07],[-.36,.075],[-.34,.04]],seg,mat([.2,.55,.85],{rough:.28,decal:true}));
 return[body,handle,cap];
}
function greenBottle(){
 const seg=22;
 const body=revolve([
  [-.5,.02],[-.48,.055],[-.44,.04],[-.28,.045],[-.16,.09],[-.04,.15],[.28,.155],[.42,.1],[.5,.02]
 ],seg,mat([.08,.55,.22],GL));
 const band=revolve([[.08,.155],[.08,.17],[.3,.17],[.3,.15]],seg,mat([.78,.64,.28],{rough:.35,fresnel:.2,decal:true}));
 return[body,band];
}
function jar(){
 const seg=22;
 const body=revolve([[-.22,.08],[-.16,.16],[.12,.17],[.2,.12],[.24,.05]],seg,mat([.72,.9,.88],{...GL,alpha:.55}));
 const lid=revolve([[.16,.12],[.16,.185],[.3,.19],[.34,.1],[.3,.04]],seg,mat([.78,.62,.22],{...MET,metal:.7,rough:.28,decal:true}));
 return[body,lid];
}
function beer(){
 const seg=20;
 const body=revolve([
  [-.5,.02],[-.46,.06],[-.4,.045],[-.18,.05],[-.06,.1],[.05,.14],[.32,.145],[.46,.08],[.5,.02]
 ],seg,mat([.45,.22,.08],{...GL,alpha:.72,fresnel:.85}));
 const label=revolve([[.02,.142],[.02,.158],[.28,.158],[.28,.14]],seg,mat([.82,.7,.28],{rough:.45,decal:true}));
 return[body,label];
}
function vial(){
 const seg=16;
 const body=revolve([[-.18,.02],[-.14,.045],[-.02,.05],[.08,.048],[.14,.03],[.16,.015]],seg,mat([.72,.84,.9],{...GL,alpha:.6}));
 const cap=revolve([[-.2,.015],[-.2,.04],[-.15,.045],[-.13,.02]],seg,mat([.85,.2,.25],{rough:.3,decal:true}));
 return[body,cap];
}
function tire(){
 const rubber=part(torus(.36,.12,32,14,'y'),mat([.1,.1,.12],RUB));
 const wall=part(torus(.34,.045,24,8,'y'),mat([.28,.28,.3],{rough:.55,fresnel:.12,decal:true}));
 return[rubber,wall];
}
function flipflop(){
 const sole=blob(.4,.035,.16,.55,16,10,mat([.95,.35,.55],{rough:.6,fresnel:.12}));
 const strap=part(move(scaleMesh(torus(.1,.02,12,6,'x'),1.1,.45,1.3),-.02,.05,0),mat([.9,.25,.48],{rough:.5,decal:true}));
 return[sole,strap];
}
function glove(){
 const palm=blob(.22,.05,.16,.6,14,10,mat([.95,.82,.15],{rough:.62,fresnel:.1}));
 const fingers=[];
 const col=mat([.98,.86,.2],{rough:.6,decal:true});
 for(let i=0;i<4;i++){
  fingers.push(part(move(blob(.1,.025,.03,.7,8,6,col),.24,.02,(i-1.5)*.07),col));
 }
 const thumb=part(move(blob(.08,.025,.03,.7,8,6,col),.08,.02,-.16),col);
 return[palm,...fingers,thumb];
}
function soda(){
 const seg=24;
 const body=revolve([[-.32,.2],[.32,.2]],seg,mat([.82,.08,.12],{...MET,metal:.75,rough:.25}));
 const rim=mat([.86,.88,.9],MET);
 const a=revolve([[-.4,.02],[-.36,.16],[-.32,.21]],seg,{...rim,decal:true});
 const b=revolve([[.32,.21],[.36,.16],[.4,.02]],seg,{...rim,decal:true});
 const band=revolve([[-.06,.202],[-.06,.218],[.14,.218],[.14,.202]],seg,mat([.96,.96,.98],{rough:.35,decal:true}));
 return[body,a,b,band];
}
function tin(){
 const seg=22;
 const body=revolve([[-.2,.2],[.2,.2]],seg,mat([.78,.8,.82],{...MET,rough:.3}));
 const rim=mat([.7,.72,.74],{...MET,rough:.35,decal:true});
 return[body,revolve([[-.26,.04],[-.22,.18],[-.18,.21]],seg,rim),revolve([[.18,.21],[.22,.18],[.26,.04]],seg,rim)];
}
function spray(){
 const seg=20;
 const body=revolve([[-.38,.09],[-.3,.11],[.22,.11],[.3,.08]],seg,mat([.15,.45,.82],{...MET,metal:.55,rough:.28}));
 const cap=revolve([[.28,.04],[.28,.09],[.36,.095],[.42,.04],[.4,.01]],seg,mat([.92,.93,.94],{rough:.35,decal:true}));
 return[body,cap];
}
function net(){
 const col=mat([.22,.48,.3],{rough:.7,fresnel:.08});
 const rope=mat([.55,.62,.28],{rough:.6,decal:true});
 const bits=[
  part(blob(.22,.1,.2,.65,12,8,col),col),
  part(move(blob(.16,.08,.14,.7,10,8,col),.14,.02,.06),col),
  part(move(blob(.14,.07,.12,.7,10,8,col),-.12,.01,-.08),col)
 ];
 const loops=[[0,.04,0,1,.7],[.12,.05,.08,.6,.5],[-.1,.03,-.06,.55,.8],[.04,.06,-.12,.5,.6]];
 for(const [x,y,z,sx,sz] of loops)bits.push(part(move(scaleMesh(torus(.1,.012,12,5,'y'),sx,1,sz),x,y,z),rope));
 return bits;
}
function mask(){
 const cloth=blob(.34,.025,.16,.6,14,8,mat([.9,.94,.98],{rough:.6,fresnel:.1}));
 const loop=mat([.75,.82,.9],{rough:.5,decal:true});
 const a=part(move(torus(.07,.008,8,5,'z'),-.22,.01,0),loop);
 const b=part(move(torus(.07,.008,8,5,'z'),.22,.01,0),loop);
 return[cloth,a,b];
}
function diaper(){
 const body=blob(.32,.09,.2,.62,14,10,mat([.95,.95,.97],{rough:.7,fresnel:.08}));
 const band=move(blob(.34,.04,.06,.5,10,6,mat([.3,.62,.9],{rough:.5,decal:true})),0,.02,.12);
 return[body,band];
}
function carton(){
 const box=blob(.36,.14,.24,.32,14,10,mat([.62,.42,.22],{rough:.72,fresnel:.08}));
 const tape=mat([.92,.9,.82],{rough:.5,decal:true});
 const a=move(blob(.38,.016,.045,.35,8,6,tape),0,.15,0);
 const b=move(blob(.04,.016,.26,.35,8,6,tape),0,.155,0);
 return[box,a,b];
}

const BUILD={
 'plastik:pet-flasche':pet,
 'plastik:tuete':bag,
 'plastik:becher':cup,
 'plastik:sixpack-ring':sixpack,
 'plastik:kanister':jerrycan,
 'plastik:waschmittelflasche':detergent,
 'glas:gruene-flasche':greenBottle,
 'glas:schraubglas':jar,
 'glas:bierflasche':beer,
 'glas:medizinflasche':vial,
 'gummi:reifen':tire,
 'gummi:badelatsche':flipflop,
 'gummi:handschuh':glove,
 'metall:dose':soda,
 'metall:konservendose':tin,
 'metall:spraydose':spray,
 'rest:fischernetz':net,
 'rest:maske':mask,
 'rest:windel':diaper,
 'rest:karton':carton
};

const cache=new Map();
export function getMesh(key){
 let mesh=cache.get(key);
 if(!mesh){
  const build=BUILD[key];
  if(!build)return null;
  const parts=sit(build());
  mesh={parts,collider:measure(parts)};
  cache.set(key,mesh);
 }
 return mesh;
}
export function colliderOf(key){
 const mesh=getMesh(key);
 return mesh?mesh.collider:null;
}
