import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {PILE_KINDS,advancePile,countFree,createPileBody,grabTarget,isFree,layoutPile,mulberry32,spawnPile} from '../src/pile.js';
import {getMesh,MESH_KEYS} from '../src/item-mesh.js';
import {SHEAR_X,SHEAR_Z,itemPose,obliqueMatrix,submerge,waveRock} from '../src/pile-pose.js';
import {BASE_CONFIG,makeConfig} from '../src/config.js';

const cfg=BASE_CONFIG.pile;
const kind=PILE_KINDS[0];

function world(extra={}){
 return{width:390,height:844,t:0,cx:195,cy:400,pileR:180,flow:()=>({vx:0,vy:0,weight:0}),...extra};
}
function run(bodies,seconds,{fps=60,env}={}){
 const sim={};
 const n=Math.round(seconds*fps);
 for(let i=1;i<=n;i++)advancePile(sim,bodies,t=>env?env(t):world({t}),1/fps,i*1000/fps,cfg);
 return bodies;
}
function aboveWater(bodies){
 for(const b of bodies)if(!b.held)assert.ok(b.z>=-0.05,'unter Wasser '+b.z);
}

test('twenty-four textured glb items, one per kind, triangles unchanged',()=>{
 assert.equal(PILE_KINDS.length,24);
 assert.deepEqual(MESH_KEYS,[...PILE_KINDS.map(k=>k.key)]);
 const count={};
 for(const k of PILE_KINDS)count[k.category]=(count[k.category]||0)+1;
 assert.deepEqual(count,{plastik:6,metall:6,glas:6,rest:6});
 const manifest=JSON.parse(readFileSync(new URL('../assets/items3d/manifest.json',import.meta.url)));
 assert.equal(manifest.length,24);
 assert.equal(existsSync(new URL('../src/trash-meshes.js',import.meta.url)),false);
 assert.equal(existsSync(new URL('../assets/trash',import.meta.url)),false);
 for(const row of manifest){
  const file=row.file.replace(/\.glb$/,'');
  const category=file.slice(0,file.indexOf('-'));
  const key=category+':'+file.slice(category.length+1);
  const mesh=getMesh(key);
  assert.ok(mesh,key);
  assert.equal(mesh.tris,row.tris,key);
  assert.equal(mesh.positions.length,mesh.normals.length);
  assert.equal(mesh.uvs.length,mesh.positions.length/3*2);
  assert.ok(mesh.images.base.length>1000&&mesh.images.base[0]===0x89&&mesh.images.mime==='image/png',key);
  assert.equal(mesh.alphaCutoff,.25,key);
  assert.ok(!mesh.images.normal&&!mesh.images.mr,key);
  assert.ok(mesh.collider.tube>0.04&&mesh.collider.stackH>0.02,key);
  assert.equal(mesh.doubleSided,true,key);
  assert.ok(mesh.tris>=5000&&mesh.tris<=14000,key+' tris '+mesh.tris);
  for(let i=0;i<mesh.positions.length;i++)assert.ok(Number.isFinite(mesh.positions[i]),key);
  let minY=Infinity,maxY=-Infinity,minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  const p=mesh.positions;
  for(let i=0;i<p.length;i+=3){
   minX=Math.min(minX,p[i]);maxX=Math.max(maxX,p[i]);
   minY=Math.min(minY,p[i+1]);maxY=Math.max(maxY,p[i+1]);
   minZ=Math.min(minZ,p[i+2]);maxZ=Math.max(maxZ,p[i+2]);
  }
  assert.ok(Math.abs(minY)<1e-4,'sitzt nicht auf y=0 '+key);
  const hy=maxY-minY,hx=maxX-minX,hz=maxZ-minZ;
  assert.ok(hy<=Math.max(hx,hz)*1.02,key+' steht hoch '+hy.toFixed(3)+' vs '+hx.toFixed(3)+'x'+hz.toFixed(3));
 }
 const tire=getMesh('rest:reifen').collider,vial=getMesh('glas:medizinflasche').collider,ring=getMesh('plastik:sixpack-ring').collider,pet=getMesh('plastik:pet-flasche').collider;
 assert.ok(tire.tube>vial.tube,'Reifen größer als Fläschchen');
 assert.ok(ring.stackH<ring.tube*.45,'Sixpack liegt flach');
 assert.ok(pet.halfLen>pet.tube*.35,'Flasche ist lang');
 assert.ok(tire.halfLen<tire.tube*.4,'Reifen ist rund');
});

test('a settled pile is stacked above the water and then sits still',()=>{
 const lay=layoutPile(390,844);
 const bodies=spawnPile({n:lay.n,width:390,height:844,rand:mulberry32(11),radiusScale:1});
 const xs=bodies.map(b=>b.x),ys=bodies.map(b=>b.y);
 assert.ok(Math.min(...xs)<70&&Math.max(...xs)>320,'breite');
 assert.ok(Math.min(...ys)<140&&Math.max(...ys)>700,'höhe');
 const env=t=>world({t,cx:lay.cx,cy:lay.cy,width:390,height:844});
 run(bodies,6.5,{env});
 const zs=bodies.map(b=>b.z);
 const high=zs.filter(z=>z>14).length;
 console.log(`haufen n=${bodies.length} oben=${high} max=${Math.max(...zs).toFixed(1)} frei=${countFree(bodies).free}`);
 assert.equal(bodies.length,lay.n);
 assert.ok(high>=6,'zu flach '+high);
 assert.ok(Math.max(...zs)>24,'kein Haufen');
 aboveWater(bodies);
 const snap=bodies.map(b=>({x:b.x,y:b.y,z:b.z}));
 run(bodies,1.5,{env});
 let drift=0;
 bodies.forEach((b,i)=>{drift=Math.max(drift,Math.hypot(b.x-snap[i].x,b.y-snap[i].y)+Math.abs(b.z-snap[i].z));});
 console.log(`ruhe ${drift.toFixed(2)} px`);
 assert.ok(drift<1.5,'drift '+drift);
 const top=bodies.reduce((m,b)=>b.z>m.z?b:m);
 assert.equal(grabTarget(top.x,top.y,bodies),top);
 assert.equal(isFree(top,bodies),true);
});

test('an unsupported item rolls down continuously and does not sink',()=>{
 const b=createPileBody(kind,80,80,64,()=>.3);
 const zs=[];
 const sim={};
 for(let i=1;i<=140;i++){
  advancePile(sim,[b],t=>world({t}),1/60,i*16.7,cfg);
  if(i%6===0)zs.push(b.z);
 }
 let maxStep=0;
 for(let i=1;i<zs.length;i++){
  assert.ok(zs[i]<=zs[i-1]+.2,'hochgesprungen');
  maxStep=Math.max(maxStep,zs[i-1]-zs[i]);
 }
 console.log(`fall ${zs[0].toFixed(1)} → ${zs.at(-1).toFixed(1)} größter Schritt ${maxStep.toFixed(2)}`);
 assert.ok(maxStep>1&&maxStep<8,'kein sichtbares Rollen '+maxStep);
 assert.ok(zs[0]-zs[4]>6,'zu langsam');
 assert.ok(b.z>=-0.05&&b.z<2,'landet '+b.z);
 assert.ok(Math.hypot(b.x-80,b.y-80)<3,'weggeschwommen');
});

test('an item resting on another stays stacked until it is rolled off',()=>{
 const a=createPileBody(PILE_KINDS[1],200,400,0,()=>.2);a.angle=0;
 const b=createPileBody(kind,200,400,a.stackH,()=>.4);b.angle=0;
 run([a,b],1);
 assert.ok(b.z>a.stackH*.8,'liegt nicht auf '+b.z);
 assert.ok(a.z<1);
 b.x=a.x+a.tube*.75;
 const track=[];
 const sim={};
 for(let i=1;i<=110;i++){
  advancePile(sim,[a,b],t=>world({t}),1/60,i*16.7,cfg);
  if(i%8===0)track.push(b.z);
 }
 let maxStep=0;
 for(let i=1;i<track.length;i++)maxStep=Math.max(maxStep,track[i-1]-track[i]);
 console.log(`rollen ${track.map(z=>z.toFixed(1)).join(' → ')} max ${maxStep.toFixed(2)}`);
 assert.ok(track.at(-1)<track[0]-6,'nicht herunter');
 assert.ok(maxStep<8,'Sprung '+maxStep);
 assert.ok(b.z>=-0.05);
});

test('a finger nudges the touched item and a dropped one stays put',()=>{
 const a=createPileBody(kind,200,400,0,()=>.4),far=createPileBody(kind,40,700,0,()=>.4);
 const x0=a.x;
 const finger={active:true,holding:false,x:a.x-a.halfLen-24,y:a.y,vx:200,vy:0};
 const sim={};
 for(let i=1;i<=28;i++){finger.x+=4;advancePile(sim,[a,far],t=>world({t,finger}),1/60,i*16.7,cfg);}
 assert.ok(Math.hypot(a.x-x0,a.y-400)>6,'kein Schubs');
 assert.ok(Math.hypot(far.x-40,far.y-700)<2);
 const dropped=createPileBody(kind,60,100,0,()=>.2);dropped.vx=50;
 run([dropped],1.5,{env:t=>world({t,flow:()=>({vx:200,vy:40,weight:1})})});
 assert.ok(Math.hypot(dropped.x-60,dropped.y-100)<2,'bleibt nicht');
 assert.ok(dropped.z<1);
});

test('clear grab follows the finger and the drop stays on the pile height it lands on',()=>{
 const a=createPileBody(kind,180,300,0,()=>.5);
 assert.equal(grabTarget(180,300,[a]),a);
 assert.equal(grabTarget(180,300+a.tube+a.halfLen+40,[a]),null);
 a.held=true;
 const finger={active:true,holding:true,x:180,y:300,vx:0,vy:0};
 const sim={};
 for(let i=1;i<=24;i++){finger.x=180+i*3;finger.y=300+i;advancePile(sim,[a],t=>world({t,finger}),1/60,i*16.7,cfg);}
 assert.ok(Math.hypot(a.x-finger.x,a.y-finger.y)<18);
 assert.ok(a.z>20);
 const x=a.x,y=a.y;
 a.held=false;a.vx=0;a.vy=0;a.vz=-40;
 run([a],1.2);
 assert.ok(a.z>=-0.05&&a.z<2,a.z);
 assert.ok(Math.hypot(a.x-x,a.y-y)<3);
});

test('the item camera looks straight down, with no side shear',()=>{
 assert.equal(SHEAR_X,0);
 assert.equal(SHEAR_Z,0);
 const m=obliqueMatrix(200,400);
 assert.ok(m[4]===0&&m[5]===0);
 assert.equal(m[15],1);
 const at=(x,y,z)=>({x:m[0]*x+m[4]*y+m[8]*z+m[12],y:m[1]*x+m[5]*y+m[9]*z+m[13]});
 const flat=at(100,0,200),lifted=at(100,48,200);
 assert.ok(Math.abs(flat.x)<1e-6&&Math.abs(flat.y)<1e-6);
 assert.ok(Math.abs(lifted.x-flat.x)<1e-6&&Math.abs(lifted.y-flat.y)<1e-6,'Höhe schiebt zur Seite');
});

test('pile pose stays clear of underwater tint and shows stack height',()=>{
 assert.equal(submerge(-40,false),0);
 const b=createPileBody(kind,10,20,28,()=>0);b.pitch=8;
 const pose=itemPose(b,{x:0,y:0,scale:1});
 assert.equal(pose.depth,0);
 assert.ok(pose.lift>20,'Höhe nicht sichtbar');
 const rock=waveRock(8,0);assert.ok(rock.pitch>0);
 b.held=true;b.z=50;
 const hand=itemPose(b,{x:0,y:0,scale:1});
 assert.equal(hand.depth,0);assert.ok(hand.lift>40);
 assert.equal(makeConfig().pile.fall,cfg.fall);
});
