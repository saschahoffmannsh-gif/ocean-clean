import test from 'node:test';
import assert from 'node:assert/strict';
import {PILE_KINDS,advancePile,ceiling,countFree,createPileBody,grabTarget,isFree,layoutPile,mulberry32,spawnPile} from '../src/pile.js';
import {getMesh,MESH_KEYS} from '../src/trash-meshes.js';
import {itemPose,submerge,waveRock} from '../src/pile-pose.js';
import {BASE_CONFIG,makeConfig} from '../src/config.js';

const cfg=BASE_CONFIG.pile;
const kind=PILE_KINDS[0];

function world(extra={}){
 return{width:390,height:844,t:0,cx:195,cy:400,pileR:140,flow:()=>({vx:0,vy:0,weight:0}),...extra};
}
function run(bodies,seconds,{fps=60,env}={}){
 const sim={};
 const n=Math.round(seconds*fps);
 for(let i=1;i<=n;i++)advancePile(sim,bodies,t=>env?env(t):world({t}),1/fps,i*1000/fps,cfg);
 return bodies;
}

test('exactly three low-poly meshes, one per pile kind',()=>{
 assert.equal(PILE_KINDS.length,3);
 assert.deepEqual(MESH_KEYS,[...PILE_KINDS.map(k=>k.key)]);
 assert.equal(new Set(PILE_KINDS.map(k=>k.category)).size,3);
 for(const key of MESH_KEYS){
  const mesh=getMesh(key);
  assert.ok(mesh&&mesh.parts.length>=2,key);
  let tris=0,minY=Infinity;
  for(const part of mesh.parts){
   assert.equal(part.positions.length,part.normals.length);
   assert.equal(part.positions.length%3,0);
   assert.ok(part.indices.length>=12);
   tris+=part.indices.length/3;
   for(let i=1;i<part.positions.length;i+=3)minY=Math.min(minY,part.positions[i]);
   const n=part.positions.length/3;
   for(const index of part.indices)assert.ok(index>=0&&index<n);
  }
  assert.ok(tris>40&&tris<800,key+' tris '+tris);
  assert.ok(Math.abs(minY)<1e-4,'sit '+key+' '+minY);
 }
 assert.equal(getMesh('rest:reifen'),null);
});

test('a settled pile keeps buried items under a free surface',()=>{
 const lay=layoutPile(390,844);
 const bodies=spawnPile({n:lay.n,cx:lay.cx,cy:lay.cy,pileR:lay.pileR,thick:cfg.thick,rand:mulberry32(11),radiusScale:1});
 run(bodies,1.4,{env:t=>world({t,cx:lay.cx,cy:lay.cy,pileR:lay.pileR,width:390,height:844})});
 const c=countFree(bodies,cfg);
 console.log(`haufen n=${bodies.length} frei=${c.free} unten=${c.buried}`);
 assert.equal(bodies.length,lay.n);
 assert.ok(c.free>=6&&c.buried>=10,JSON.stringify(c));
 const counts={};for(const b of bodies)counts[b.kind.key]=(counts[b.kind.key]||0)+1;
 const ns=Object.values(counts);assert.ok(Math.max(...ns)-Math.min(...ns)<=1,JSON.stringify(counts));
 const top=bodies.filter(b=>isFree(b,bodies,cfg))[0];
 assert.equal(grabTarget(top.x,top.y,bodies,cfg),top);
 const buried=bodies.filter(b=>!isFree(b,bodies,cfg)&&b.z<cfg.grabBand)[0];
 assert.ok(buried);
 assert.equal(grabTarget(buried.x,buried.y,bodies,cfg)===buried,false);
});

test('rummage pushes the surface aside and lets the piece below rise',()=>{
 const a=createPileBody(kind,200,400,0,()=>.2),b=createPileBody(PILE_KINDS[1],204,404,-cfg.thick,()=>.8);
 a.radius=b.radius=16;
 const finger={active:true,holding:false,x:150,y:400,vx:0,vy:0};
 const env=t=>world({t,finger});
 const sim={};const x0=a.x,y0=b.y,z0=b.z;
 const frames=Math.round(.55*60);
 for(let i=1;i<=frames;i++){
  const u=i/frames;finger.x=140+160*u;finger.vx=160/.55;finger.vy=0;
  advancePile(sim,[a,b],env,1/60,i*1000/60,cfg);
 }
 const moved=Math.hypot(a.x-x0,a.y-400),under=Math.hypot(b.x-204,b.y-y0);
 console.log(`wühlen oben Δ ${moved.toFixed(1)} px | unten z ${z0.toFixed(1)} → ${b.z.toFixed(1)} | unten Δ ${under.toFixed(1)}`);
 assert.ok(moved>8&&moved<55,'oben '+moved);
 assert.ok(under<moved*.9&&under<32,'unten bleibt im Stapel '+under);
 assert.ok(b.z<z0+6,'nicht an die Oberfläche durchfallen '+b.z);
 run([a,b],1.6,{env:()=>world()});
 console.log(`danach unten z ${b.z.toFixed(2)} frei ${isFree(b,[a,b],cfg)} oben z ${a.z.toFixed(2)}`);
 assert.ok(b.z>z0+6,'gehoben '+b.z);
 assert.ok(b.z<=1);
});

test('a finger far from an item barely moves it; ambient flow stays weak',()=>{
 const near=createPileBody(kind,200,400,0,()=>.4),far=createPileBody(kind,200,400+180,0,()=>.4);
 const finger={active:true,holding:false,x:140,y:400,vx:400,vy:0};
 const sim={};
 for(let i=1;i<=30;i++){finger.x=140+8*i;advancePile(sim,[near,far],t=>world({t,finger}),1/60,i*16.7,cfg);}
 assert.ok(Math.hypot(near.x-200,near.y-400)>10,'nah');
 assert.ok(Math.hypot(far.x-200,far.y-(400+180))<3,'fern '+Math.hypot(far.x-200,far.y-580));
 const drift=createPileBody(kind,200,400,0,()=>.4),x0=drift.x;
 run([drift],.5,{env:t=>world({t,flow:()=>({vx:220,vy:0,weight:1})})});
 const dx=Math.abs(drift.x-x0);
 console.log(`ambient ${dx.toFixed(1)} px`);
 assert.ok(dx<16,'ambient '+dx);
});

test('clear grab follows the finger and a drop settles back on the water',()=>{
 const a=createPileBody(kind,180,300,0,()=>.5),b=createPileBody(kind,176,304,-cfg.thick,()=>.5);
 a.radius=b.radius=16;
 assert.equal(isFree(a,[a,b],cfg),true);
 assert.equal(isFree(b,[a,b],cfg),false);
 assert.equal(grabTarget(180,300,[a,b],cfg),a);
 assert.equal(grabTarget(180,300+a.radius*2,[a,b],cfg),null);
 a.held=true;
 const finger={active:true,holding:true,x:180,y:300,vx:0,vy:0};
 const sim={};
 for(let i=1;i<=24;i++){finger.x=180+i*3;finger.y=300+i;advancePile(sim,[a,b],t=>world({t,finger}),1/60,i*16.7,cfg);}
 assert.ok(Math.hypot(a.x-finger.x,a.y-finger.y)<18,'folgt '+a.x+','+a.y);
 assert.ok(a.z>20,'gehoben '+a.z);
 assert.ok(Math.abs(b.x-176)<8,'unten bleibt');
 a.held=false;a.vz=-80;
 run([a],1.2);
 console.log(`abgelegt z ${a.z.toFixed(2)} x ${a.x.toFixed(1)}`);
 assert.ok(a.z<=.6&&a.z>cfg.floor,'liegt '+a.z);
});

test('removing the lid lets buoyancy bring the lower item up',()=>{
 const a=createPileBody(kind,200,400,0,()=>.3),b=createPileBody(PILE_KINDS[2],200,400,-cfg.thick,()=>.3);
 a.radius=b.radius=16;
 assert.ok(ceiling(b,[a,b],cfg)<=-cfg.thick+1);
 a.held=true;a.x=40;a.y=40;
 run([a,b],1.8);
 console.log(`frei z ${b.z.toFixed(2)} Decke ${ceiling(b,[a,b],cfg).toFixed(2)}`);
 assert.ok(b.z>-3&&isFree(b,[a,b],cfg));
});

test('a dropped item stays where it was put, even outside the pile and in a current',()=>{
 const a=createPileBody(kind,70,90,cfg.holdLift,()=>.4);
 a.held=false;a.vx=40;a.vy=-30;a.vz=-80;
 const finger={active:false,holding:false,x:0,y:0,vx:0,vy:0};
 run([a],2,{env:t=>world({t,finger,cx:195,cy:420,pileR:130,flow:()=>({vx:240,vy:-80,weight:1})})});
 console.log(`abgelegt bleibt ${a.x.toFixed(1)},${a.y.toFixed(1)} z ${a.z.toFixed(2)}`);
 assert.ok(Math.hypot(a.x-70,a.y-90)<3,'weggeschwommen '+a.x+' '+a.y);
 assert.ok(Math.abs(a.z)<.6,'liegt '+a.z);
});

test('a resting pile does not tumble or fall through itself',()=>{
 const lay=layoutPile(390,844);
 const bodies=spawnPile({n:lay.n,cx:lay.cx,cy:lay.cy,pileR:lay.pileR,thick:cfg.thick,rand:mulberry32(11),radiusScale:1});
 const env=t=>world({t,cx:lay.cx,cy:lay.cy,pileR:lay.pileR,width:390,height:844});
 run(bodies,2.4,{env});
 const snap=bodies.map(b=>({x:b.x,y:b.y,z:b.z,a:b.angle}));
 run(bodies,2.5,{env});
 let drift=0,turn=0;
 bodies.forEach((b,i)=>{
  drift=Math.max(drift,Math.hypot(b.x-snap[i].x,b.y-snap[i].y));
  turn=Math.max(turn,Math.abs(b.angle-snap[i].a));
  assert.ok(Math.abs(b.z-snap[i].z)<.5,'z '+b.z);
 });
 console.log(`ruhe Drift ${drift.toFixed(2)} px | Drehung ${(turn*180/Math.PI).toFixed(2)}°`);
 assert.ok(drift<1.5,'drift '+drift);
 assert.ok(turn<.15,'drehen '+turn);
 for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
  const a=bodies[i],c=bodies[j],d=Math.hypot(a.x-c.x,a.y-c.y),gap=Math.abs(a.z-c.z);
  if(gap<cfg.thick*.55)assert.ok(d>=(a.radius+c.radius)*cfg.solid*.88,'gleiche Lage '+d.toFixed(1));
  else{
   const lower=a.z<c.z?a:c,upper=a.z<c.z?c:a;
   if(Math.hypot(lower.x-upper.x,lower.y-upper.y)<(lower.radius+upper.radius)*cfg.cover)
    assert.ok(lower.z<=upper.z-cfg.thick+1.6,'durch '+lower.z.toFixed(1)+'/'+upper.z.toFixed(1));
  }
 }
});

test('pile pose: surface is clear, depth murks, held item stays lifted',()=>{
 const b=createPileBody(kind,10,20,0,()=>0);b.pitch=10;b.roll=-8;
 assert.equal(submerge(0,false),0);
 assert.ok(submerge(-40,false)>.9);
 assert.equal(submerge(-20,true),0);
 const rock=waveRock(10,-8);assert.ok(rock.pitch>0&&rock.roll<0);
 const pose=itemPose(b,{x:1,y:2,scale:1});
 assert.equal(pose.depth,0);assert.ok(Math.abs(pose.x-11)<1e-6);
 b.z=-20;const deep=itemPose(b,{x:0,y:0,scale:1});assert.ok(deep.depth>.4&&deep.lift<0);
 b.held=true;b.z=36;const hand=itemPose(b,{x:4,y:4,scale:1});
 assert.equal(hand.held,true);assert.equal(hand.depth,0);assert.ok(hand.lift>30);assert.ok(hand.scale>1.05);
 assert.equal(makeConfig().pile.thick,cfg.thick);
});
