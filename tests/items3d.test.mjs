import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TRASH} from '../src/trash-catalog.js';
import {createBody} from '../src/trash-physics.js';
import {stepBuoyancy} from '../water-13.0.0/ocean.js';
import {
 PROTOTYPE_KEYS,getPrototypeMesh,hasPrototypeMesh,spriteReplacedByMesh,meshKey
} from '../src/trash-meshes.js';
import {
 wantsItems3D,waveRock,itemPose,meshScale,modelMatrix,transformPoint,obliqueClip,obliqueMatrix,
 ROCK_GAIN,ROCK_LIMIT_DEG,MESH_UNITS_PER_LOOK,VIEW_SPIN
} from '../src/trash-pose.js';

const read=rel=>readFileSync(new URL('../'+rel,import.meta.url),'utf8');

function bounds(mesh){
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 let verts=0,tris=0;
 for(const p of mesh.parts){
  verts+=p.positions.length/3;tris+=p.indices.length/3;
  for(let i=0;i<p.positions.length;i+=3)for(let k=0;k<3;k++){min[k]=Math.min(min[k],p.positions[i+k]);max[k]=Math.max(max[k],p.positions[i+k]);}
 }
 return{min,max,verts,tris};
}
function windingAgreement(part){
 const p=part.positions,n=part.normals,idx=part.indices;let agree=0,disagree=0;
 for(let i=0;i<idx.length;i+=3){
  const ia=idx[i],ib=idx[i+1],ic=idx[i+2];
  const ax=p[ia*3],ay=p[ia*3+1],az=p[ia*3+2],bx=p[ib*3],by=p[ib*3+1],bz=p[ib*3+2],cx=p[ic*3],cy=p[ic*3+1],cz=p[ic*3+2];
  const abx=bx-ax,aby=by-ay,abz=bz-az,acx=cx-ax,acy=cy-ay,acz=cz-az;
  const nx=aby*acz-abz*acy,ny=abz*acx-abx*acz,nz=abx*acy-aby*acx;
  if(Math.hypot(nx,ny,nz)<1e-8)continue;
  const vnx=n[ia*3]+n[ib*3]+n[ic*3],vny=n[ia*3+1]+n[ib*3+1]+n[ic*3+1],vnz=n[ia*3+2]+n[ib*3+2]+n[ic*3+2];
  if(nx*vnx+ny*vny+nz*vnz>=0)agree++;else disagree++;
 }
 return{agree,disagree};
}

test('URL-Schalter ?items3d=1 ist opt-in, Default bleibt aus',()=>{
 assert.equal(wantsItems3D(''),false);
 assert.equal(wantsItems3D('?debug=1'),false);
 assert.equal(wantsItems3D('?force=0.5'),false);
 assert.equal(wantsItems3D('?items3d=0'),false);
 assert.equal(wantsItems3D('?items3d='),false);
 assert.equal(wantsItems3D('?items3d=1'),true);
 assert.equal(wantsItems3D('?items3d=true'),true);
 assert.equal(wantsItems3D('?items3d=ON'),true);
 assert.equal(wantsItems3D('?force=2&items3d=1'),true);
 assert.equal(wantsItems3D('?items3d=1&force=0.5'),true);
});

test('Live-Kennung bleibt v2026.11.04-7, 3D hängt nur am Schalter, Wasserordner unberührt',()=>{
 const html=read('index.html'),app=read('app.js'),layer=read('src/trash-layer.js');
 assert.match(html,/OCEAN_CLEAN_VERSION='2026\.11\.04-7'/);
 assert.match(html,/>v2026\.11\.04-7</);
 assert.match(app,/wantsItems3D\(location\.search\)/);
 assert.match(app,/attachItems3D/);
 assert.match(layer,/view3d\?\.handles\(b\)/);
 for(const f of ['src/trash-meshes.js','src/trash-pose.js','src/trash-items3d.js'])assert.doesNotMatch(read(f),/water-13\.0\.0/,f);
});

test('Prototyp: genau PET, Dose, grüne Flasche, Reifen – der Rest bleibt Sprite',()=>{
 assert.deepEqual([...PROTOTYPE_KEYS],['plastik:pet-flasche','metall:dose','glas:gruene-flasche','rest:reifen']);
 for(const key of PROTOTYPE_KEYS){
  const [category,name]=key.split(':');
  assert.ok(TRASH.some(t=>t.category===category&&t.name===name),key);
  assert.ok(getPrototypeMesh(key));
 }
 const pet=TRASH.find(t=>t.name==='pet-flasche'),bag=TRASH.find(t=>t.name==='tuete');
 assert.equal(hasPrototypeMesh(pet),true);
 assert.equal(hasPrototypeMesh(bag),false);
 assert.equal(spriteReplacedByMesh(null,pet),false);
 assert.equal(spriteReplacedByMesh({active:false},pet),false);
 assert.equal(spriteReplacedByMesh({active:true},pet),true);
 assert.equal(spriteReplacedByMesh({active:true},bag),false);
 assert.equal(TRASH.filter(t=>hasPrototypeMesh(t)).length,4);
 assert.equal(meshKey(pet),'plastik:pet-flasche');
});

test('Netze sind geschlossene Low-Poly-Körper, keine Billboards, liegen auf y=0',()=>{
 let total=0;
 for(const key of PROTOTYPE_KEYS){
  const mesh=getPrototypeMesh(key),box=bounds(mesh);
  total+=box.tris;
  assert.ok(box.verts>=24&&box.verts<900,key+' verts '+box.verts);
  assert.ok(box.tris>=40&&box.tris<1200,key+' tris '+box.tris);
  assert.ok(Math.abs(box.min[1])<1e-4,'Unterkante '+key+' '+box.min[1]);
  assert.ok(box.max[1]>0.05,key);
  for(const part of mesh.parts){
   assert.equal(part.indices.length%3,0);
   assert.ok(part.color.every(c=>c>=0&&c<=1));
   assert.ok(part.alpha>0&&part.alpha<=1);
   assert.ok(part.metal>=0&&part.metal<=1&&part.rough>=0&&part.rough<=1);
   for(let i=0;i<part.indices.length;i++)assert.ok(part.indices[i]*3<part.positions.length);
   for(let i=0;i<part.positions.length;i++)assert.ok(Number.isFinite(part.positions[i]));
   for(let i=0;i<part.normals.length;i+=3){
    const l=Math.hypot(part.normals[i],part.normals[i+1],part.normals[i+2]);
    assert.ok(Math.abs(l-1)<0.05,key+' normal '+l);
   }
   const w=windingAgreement(part);
   assert.ok(w.agree>=16&&w.disagree<=w.agree*0.02,key+' winding '+JSON.stringify(w));
   let up=0,n=0;
   for(let i=0;i<part.positions.length;i+=3)if(part.positions[i+1]>box.max[1]*0.72){up+=part.normals[i+1];n++;}
   if(n>4)assert.ok(up/n>0.15,key+' Oberseite schaut nach oben');
  }
 }
 assert.ok(total<2500,'zu viele Dreiecke '+total);
 const aspect=key=>{const b=bounds(getPrototypeMesh(key));return (b.max[0]-b.min[0])/(b.max[1]-b.min[1]);};
 assert.ok(aspect('plastik:pet-flasche')>2.3&&aspect('plastik:pet-flasche')<3.3);
 assert.ok(aspect('metall:dose')>1.45&&aspect('metall:dose')<2.1);
 assert.ok(aspect('glas:gruene-flasche')>2.7&&aspect('glas:gruene-flasche')<3.8);
 const tire=bounds(getPrototypeMesh('rest:reifen'));
 const dx=tire.max[0]-tire.min[0],dy=tire.max[1]-tire.min[1],dz=tire.max[2]-tire.min[2];
 assert.ok(Math.abs(dx-dz)<0.08,'Reifen ist rund');
 assert.ok(dy<dx*0.45,'Reifen liegt flach');
 const radial=[];
 for(const part of getPrototypeMesh('rest:reifen').parts)for(let i=0;i<part.positions.length;i+=3)radial.push(Math.hypot(part.positions[i],part.positions[i+2]));
 assert.ok(Math.min(...radial)>0.18&&Math.min(...radial)<0.36&&Math.max(...radial)>0.45,'Reifen hat ein Loch');
 const pet=getPrototypeMesh('plastik:pet-flasche'),glass=getPrototypeMesh('glas:gruene-flasche'),dose=getPrototypeMesh('metall:dose');
 assert.ok(pet.parts.some(p=>p.alpha<0.9)&&pet.parts.some(p=>p.alpha===1));
 assert.ok(glass.parts.some(p=>p.alpha<0.9)&&glass.parts.some(p=>p.color[0]>0.5));
 assert.ok(dose.parts.every(p=>p.alpha===1)&&dose.parts.some(p=>p.metal>0.8)&&dose.parts.some(p=>p.color[0]>0.6&&p.color[1]<0.2));
 assert.ok(getPrototypeMesh('rest:reifen').parts.every(p=>p.rough>0.8&&p.alpha===1));
 const long=key=>{const b=bounds(getPrototypeMesh(key));return (b.max[0]-b.min[0])>(b.max[2]-b.min[2])*1.6;};
 assert.ok(long('plastik:pet-flasche')&&long('metall:dose')&&long('glas:gruene-flasche'));
});

test('waveRock verstärkt und begrenzt, Vorzeichen bleiben',()=>{
 const z=waveRock(0,0);assert.equal(z.pitch,0);assert.equal(z.roll,0);
 const a=waveRock(4,-2);
 assert.ok(a.pitch>4*Math.PI/180&&a.pitch<ROCK_LIMIT_DEG*Math.PI/180);
 assert.ok(a.roll<0&&Math.abs(a.roll)>2*Math.PI/180);
 const cap=waveRock(90,-90);
 assert.ok(Math.abs(Math.abs(cap.pitch)-ROCK_LIMIT_DEG*Math.PI/180)<1e-9);
 assert.ok(Math.abs(Math.abs(cap.roll)-ROCK_LIMIT_DEG*Math.PI/180)<1e-9);
 assert.equal(ROCK_GAIN>1,true);
});

test('itemPose: Position aus der Physik, Drehung über die Zeit, Neigung aus der Welle',()=>{
 const kind=TRASH.find(t=>t.name==='pet-flasche');
 const b=createBody(kind,120,340,()=>0);
 b.spinBias=1;b.pitch=6;b.roll=-4;b.angle=0.3;b.float={bob:-1,dip:0,pitch:1,roll:-1};
 const a=itemPose(b,0,{motion:true,spin:0.5}),c=itemPose(b,2,{motion:true,spin:0.5});
 assert.equal(a.x,120);
 assert.ok(Math.abs(a.screenY-(340-1))<1e-9);
 assert.ok(Math.abs(a.lift-1)<1e-9);
 assert.ok(a.pitch>6*Math.PI/180&&a.roll<0);
 assert.ok(Math.abs((c.yaw-a.yaw)-1)<1e-9);
 const still=itemPose(b,2,{motion:false,spin:0.5});
 assert.ok(Math.abs(still.yaw-b.angle)<1e-9);
 assert.equal(VIEW_SPIN>0,true);
});

test('entgegengesetzte Wellenneigung kippt die 3D-Pose entgegengesetzt',()=>{
 const kind=TRASH.find(t=>t.name==='dose');
 const pose=(pitch,roll)=>{
  const b=createBody(kind,10,20,()=>0);b.spinBias=1;
  stepBuoyancy(b,{lift:0,crest:0,pitch,roll,motion:0},0,0,false);
  b.float={bob:0,dip:0,pitch:0,roll:0};
  return itemPose(b,0,{motion:false});
 };
 const a=pose(9,-7),c=pose(-9,7);
 assert.ok(a.pitch>0.2&&c.pitch<-0.2);
 assert.ok(a.roll<-0.1&&c.roll>0.1);
 assert.notEqual(Math.sign(a.pitch),Math.sign(c.pitch));
 assert.notEqual(Math.sign(a.roll),Math.sign(c.roll));
 const calm=createBody(kind,0,0,()=>0);
 stepBuoyancy(calm,{lift:2,crest:1,pitch:9,roll:7,motion:1},0.016,0.016,true);
 const p=itemPose(calm,1,{motion:false});
 assert.equal(p.pitch,0);assert.equal(p.roll,0);assert.ok(Math.abs(p.yaw-calm.angle)<1e-9);
});

test('Modellmatrix: Ursprung bleibt, Yaw dreht, Roll/Pitch heben die passende Seite',()=>{
 const origin=modelMatrix({x:40,lift:3,screenY:80,yaw:0.4,pitch:0.2,roll:-0.2},2.5);
 const o=transformPoint(origin,0,0,0);
 assert.ok(Math.abs(o.x-40)<1e-5&&Math.abs(o.y-3)<1e-5&&Math.abs(o.z-80)<1e-5);
 const spun=modelMatrix({x:0,lift:0,screenY:0,yaw:Math.PI/2,pitch:0,roll:0},1);
 const nose=transformPoint(spun,1,0,0);
 assert.ok(Math.abs(nose.x)<1e-5&&nose.z<-0.9);
 const rolled=modelMatrix({x:0,lift:0,screenY:0,yaw:0,pitch:0,roll:0.5},1);
 assert.ok(transformPoint(rolled,1,0,0).y>0.2);
 const pitched=modelMatrix({x:0,lift:0,screenY:0,yaw:0,pitch:-0.5,roll:0},1);
 assert.ok(transformPoint(pitched,0,0,1).y>0.2);
 const sized=meshScale(30);
 assert.ok(Math.abs(sized-30*MESH_UNITS_PER_LOOK)<1e-9);
});

test('Draufsicht: Wasserfläche pixelgenau, Höhe schert nach links oben und nach vorn',()=>{
 const w=390,h=844;
 const tl=obliqueClip(0,0,0,w,h),br=obliqueClip(w,0,h,w,h),mid=obliqueClip(w/2,0,h/2,w,h),up=obliqueClip(w/2,30,h/2,w,h);
 assert.ok(Math.abs(tl.x+1)<1e-9&&Math.abs(tl.y-1)<1e-9);
 assert.ok(Math.abs(br.x-1)<1e-9&&Math.abs(br.y+1)<1e-9);
 assert.ok(Math.abs(mid.x)<1e-9&&Math.abs(mid.y)<1e-9);
 assert.ok(up.x<mid.x&&up.y>mid.y&&up.z<mid.z);
 const m=obliqueMatrix(w,h),p=transformPoint(m,w/2,30,h/2);
 assert.ok(Math.abs(p.x-up.x)<1e-5&&Math.abs(p.y-up.y)<1e-5&&Math.abs(p.z-up.z)<1e-5);
});
