import test from 'node:test';
import assert from 'node:assert/strict';
import {PILE_KINDS,advancePile,capsulePair,countFree,createPileBody,grabTarget,isFree,layoutPile,mulberry32,spawnPile} from '../src/pile.js';
import {getMesh,MESH_KEYS} from '../src/trash-meshes.js';
import {itemPose,submerge,waveRock} from '../src/pile-pose.js';
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
function noOverlap(bodies,limit=.4){
 for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
  if(bodies[i].held||bodies[j].held)continue;
  const pen=capsulePair(bodies[i],bodies[j]).pen;
  assert.ok(pen<Math.max(limit,.5),`überlappen ${pen.toFixed(2)}`);
 }
}
function onSurface(bodies){
 for(const b of bodies)if(!b.held)assert.ok(Math.abs(b.z)<.05,'unter Wasser '+b.z);
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

test('a settled pile lies on the surface without overlaps',()=>{
 const lay=layoutPile(390,844);
 const bodies=spawnPile({n:lay.n,cx:lay.cx,cy:lay.cy,rand:mulberry32(11),radiusScale:1});
 run(bodies,2,{env:t=>world({t,cx:lay.cx,cy:lay.cy,width:390,height:844})});
 const c=countFree(bodies);
 console.log(`haufen n=${bodies.length} frei=${c.free} unten=${c.buried}`);
 assert.equal(bodies.length,lay.n);
 assert.equal(c.buried,0);
 assert.equal(c.free,lay.n);
 onSurface(bodies);
 noOverlap(bodies);
 const counts={};for(const b of bodies)counts[b.kind.key]=(counts[b.kind.key]||0)+1;
 const ns=Object.values(counts);assert.ok(Math.max(...ns)-Math.min(...ns)<=1,JSON.stringify(counts));
 const top=bodies[0];
 assert.equal(grabTarget(top.x,top.y,bodies),top);
 assert.equal(grabTarget(top.x,top.y+top.tube*3+top.halfLen,bodies),null);
});

test('rummage nudges by hard contact and nothing sinks or overlaps',()=>{
 const a=createPileBody(kind,200,400,0,()=>.2),b=createPileBody(PILE_KINDS[1],200,400,0,()=>.2);
 a.angle=0;b.angle=0;
 b.x=a.x+a.halfLen+b.halfLen+a.tube+b.tube+.4;
 b.y=a.y;
 const x0=a.x,bx0=b.x;
 const finger={active:true,holding:false,x:a.x-a.halfLen-20,y:a.y,vx:0,vy:0};
 const sim={};
 const frames=Math.round(.5*60);
 for(let i=1;i<=frames;i++){
  finger.x=x0-a.halfLen-30+i*3;finger.vx=180;finger.vy=0;
  advancePile(sim,[a,b],t=>world({t,finger}),1/60,i*1000/60,cfg);
 }
 const moved=a.x-x0,bumped=b.x-bx0;
 console.log(`schubs Δ ${moved.toFixed(1)} | nachbar Δ ${bumped.toFixed(1)} | pen ${capsulePair(a,b).pen.toFixed(2)}`);
 assert.ok(moved>6&&moved<80,'schubs '+moved);
 assert.ok(bumped>0&&bumped<moved,'nachbar '+bumped);
 onSurface([a,b]);
 noOverlap([a,b]);
});

test('a finger far from an item barely moves it; current does not carry a drop',()=>{
 const near=createPileBody(kind,200,400,0,()=>.4),far=createPileBody(kind,200,400+220,0,()=>.4);
 const finger={active:true,holding:false,x:140,y:400,vx:400,vy:0};
 const sim={};
 for(let i=1;i<=30;i++){finger.x=140+8*i;advancePile(sim,[near,far],t=>world({t,finger}),1/60,i*16.7,cfg);}
 assert.ok(Math.hypot(near.x-200,near.y-400)>8,'nah');
 assert.ok(Math.hypot(far.x-200,far.y-620)<2,'fern');
 const dropped=createPileBody(kind,70,90,0,()=>.4);dropped.vx=80;dropped.vy=-40;
 run([dropped],2,{env:t=>world({t,flow:()=>({vx:240,vy:-80,weight:1})})});
 console.log(`bleibt ${dropped.x.toFixed(1)},${dropped.y.toFixed(1)} z ${dropped.z.toFixed(2)}`);
 assert.ok(Math.hypot(dropped.x-70,dropped.y-90)<2);
 assert.ok(Math.abs(dropped.z)<.05);
});

test('clear grab follows the finger and a drop stays on the surface',()=>{
 const a=createPileBody(kind,180,300,0,()=>.5);
 assert.equal(isFree(a),true);
 assert.equal(grabTarget(180,300,[a]),a);
 assert.equal(grabTarget(180,300+a.tube+a.halfLen+30,[a]),null);
 a.held=true;
 const finger={active:true,holding:true,x:180,y:300,vx:0,vy:0};
 const sim={};
 for(let i=1;i<=24;i++){finger.x=180+i*3;finger.y=300+i;advancePile(sim,[a],t=>world({t,finger}),1/60,i*16.7,cfg);}
 assert.ok(Math.hypot(a.x-finger.x,a.y-finger.y)<18,'folgt');
 assert.ok(a.z>20,'gehoben '+a.z);
 const x=a.x,y=a.y;
 a.held=false;a.vx=0;a.vy=0;a.vz=-80;
 run([a],1.2);
 assert.ok(Math.abs(a.z)<.05,'liegt '+a.z);
 assert.ok(Math.hypot(a.x-x,a.y-y)<3,'weg '+a.x+' '+a.y);
});

test('overlapping capsules separate and then sit still on the surface',()=>{
 const a=createPileBody(kind,200,400,0,()=>.1),b=createPileBody(PILE_KINDS[2],206,404,0,()=>.2);
 assert.ok(capsulePair(a,b).pen>0,'starten überlappt');
 run([a,b],1.2);
 onSurface([a,b]);
 noOverlap([a,b]);
 const ax=a.x,ay=a.y,bx=b.x,by=b.y;
 run([a,b],2);
 assert.ok(Math.hypot(a.x-ax,a.y-ay)<.5&&Math.hypot(b.x-bx,b.y-by)<.5,'kriechen');
 assert.equal(a.spin,0);assert.equal(b.spin,0);
});

test('a resting pile does not tumble',()=>{
 const lay=layoutPile(390,844);
 const bodies=spawnPile({n:lay.n,cx:lay.cx,cy:lay.cy,rand:mulberry32(11),radiusScale:1});
 const env=t=>world({t,cx:lay.cx,cy:lay.cy,width:390,height:844});
 run(bodies,2,{env});
 const snap=bodies.map(b=>({x:b.x,y:b.y,z:b.z,a:b.angle}));
 run(bodies,2,{env});
 let drift=0,turn=0;
 bodies.forEach((b,i)=>{
  drift=Math.max(drift,Math.hypot(b.x-snap[i].x,b.y-snap[i].y));
  turn=Math.max(turn,Math.abs(b.angle-snap[i].a));
 });
 console.log(`ruhe Drift ${drift.toFixed(2)} px | Drehung ${(turn*180/Math.PI).toFixed(2)}°`);
 assert.ok(drift<1,'drift '+drift);
 assert.ok(turn<.05,'drehen '+turn);
 onSurface(bodies);
 noOverlap(bodies);
});

test('pile pose stays clear on the surface, held item lifts',()=>{
 assert.equal(submerge(-40,false),0);
 assert.equal(submerge(0,false),0);
 const b=createPileBody(kind,10,20,0,()=>0);b.pitch=10;b.roll=-8;
 const rock=waveRock(10,-8);assert.ok(rock.pitch>0&&rock.roll<0);
 const pose=itemPose(b,{x:1,y:2,scale:1});
 assert.equal(pose.depth,0);assert.ok(Math.abs(pose.x-11)<1e-6);
 b.z=-20;assert.equal(itemPose(b,{x:0,y:0,scale:1}).depth,0);
 b.held=true;b.z=36;const hand=itemPose(b,{x:4,y:4,scale:1});
 assert.equal(hand.held,true);assert.equal(hand.depth,0);assert.ok(hand.lift>30);assert.ok(hand.scale>1.05);
 assert.equal(makeConfig().pile.holdLift,cfg.holdLift);
});
