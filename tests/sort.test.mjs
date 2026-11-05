import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TRASH,CATEGORIES} from '../src/trash-catalog.js';
import {createBody,advance} from '../src/trash-physics.js';
import {BASE_CONFIG,makeConfig} from '../src/config.js';
import {layoutBags,spawnCeiling,bagAccel,bagResolve,suctionFalloff} from '../src/sort-bags.js';

const kind=c=>TRASH.find(t=>t.category===c);
const W=390,H=844;

function world(w=W,h=H){return layoutBags(w,h);}

function run(category,x,y,{w=W,h=H,seconds=1,fps=60,vy=0,bags,sort=BASE_CONFIG.sort,hook=true,vx=0}={}){
 const b=createBody(kind(category),x,y,()=>.5);b.vy=vy;b.vx=vx;
 const sim={},events=[],use=bags||world(w,h);
 const n=Math.round(seconds*fps);
 for(let i=1;i<=n;i++){
  advance(sim,[b],(t,now)=>({width:w,height:h,now,t,flow:()=>({vx:0,vy:0,weight:0}),size:()=>22,
   bags:hook?use:undefined,
   bagAccel:hook?(body,env)=>bagAccel(body,env,sort,BASE_CONFIG.drift.edge):undefined,
   bagResolve:hook?(body,env)=>bagResolve(body,env,sort):undefined}),1/fps,i*1000/fps);
  if(b.sortEvent){events.push({...b.sortEvent,t:sim.time,y:b.y});b.sortEvent=null;}
 }
 return {b,events,bags:use,time:sim.time};
}

test('four flat bags, openings face the sea, compact strip',()=>{
 for(const [w,h] of [[390,844],[320,700],[1280,800]]){
  const bags=layoutBags(w,h),strip=bags[0].h;
  assert.equal(bags.length,4);
  assert.deepEqual(bags.map(b=>b.category),CATEGORIES);
  assert.equal(new Set(bags.map(b=>b.mid)).size,4);
  for(const b of bags){
   assert.equal(b.mouthTop,b.y,'Öffnung ist der obere Rand');
   assert.ok(b.mouthTop+b.mouthH<b.y+b.h*.55,'Loch im oberen Teil');
   assert.ok(b.h<=74&&b.h>=56,b.h);
   assert.ok(b.bottom<=h&&b.x>=0&&b.x+b.w<=w+1);
  }
  for(let i=0;i<3;i++)assert.ok(bags[i].cx+bags[i].mouthW/2<bags[i+1].cx-bags[i+1].mouthW/2,'Öffnungen überlappen nicht');
  assert.ok(strip/h<.12,'Leiste frisst das Meer '+strip/h);
 }
 const bags=world(),reach=BASE_CONFIG.sort.reach;
 assert.ok(spawnCeiling(bags[0].mouthTop,reach)<=bags[0].mouthTop-reach-28);
});

test('?force does not scale the mouth suction',()=>{
 assert.equal(makeConfig(0).sort.suction,BASE_CONFIG.sort.suction);
 assert.equal(makeConfig(2).sort.reach,BASE_CONFIG.sort.reach);
 assert.equal(makeConfig().boat,undefined);
});

test('outside the mouth the bags change nothing',()=>{
 const bags=world(),lip=bags[0].mouthTop,sort=BASE_CONFIG.sort;
 const far=run('plastik',180,280,{seconds:2,bags});
 const bare=run('plastik',180,280,{seconds:2,bags,hook:false});
 assert.equal(far.b.x,bare.b.x);assert.equal(far.b.y,bare.b.y);assert.equal(far.b.angle,bare.b.angle);assert.equal(far.b.collected,undefined);
 const above=bags[1].mouthTop-sort.reach-3;
 const edge=run('metall',bags[1].cx,above,{seconds:1.5,bags});
 const edge0=run('metall',bags[1].cx,above,{seconds:1.5,bags,hook:false});
 assert.equal(edge.b.x,edge0.b.x);assert.equal(edge.b.y,edge0.b.y);assert.equal(edge.b.angle,edge0.b.angle);
 const side=bags[2].cx+bags[2].mouthW/2+4;
 const wide=run('glas',side,bags[2].mouthTop-6,{seconds:1.2,bags});
 const wide0=run('glas',side,bags[2].mouthTop-6,{seconds:1.2,bags,hook:false});
 assert.equal(wide.b.x,wide0.b.x);assert.equal(wide.b.y,wide0.b.y);
 assert.ok(suctionFalloff({x:bags[0].cx,y:lip-(sort.reach-1),collected:false},bags[0],sort)>0);
 assert.equal(suctionFalloff({x:bags[0].cx,y:lip-(sort.reach+1),collected:false},bags[0],sort),0);
});

test('a matching item is collected only through the opening',()=>{
 const bags=world(),lip=bags[0].mouthTop;
 const hit=run('plastik',bags[0].cx,lip-4,{seconds:1.2,bags});
 assert.equal(hit.b.collected,true);assert.equal(hit.events[0].type,'collect');assert.equal(hit.events.length,1);
 const light=run('metall',bags[1].cx,bags[1].mouthTop-3,{seconds:1.2,bags});
 const heavy=run('rest',bags[3].cx,bags[3].mouthTop-3,{seconds:1.2,bags});
 assert.equal(light.b.collected,true);assert.equal(heavy.b.collected,true);
 assert.ok(Math.abs(light.events[0].t-heavy.events[0].t)<.25,'Gewicht ändert die Regel nicht');
 const shoulder=run('glas',bags[2].x+3,bags[2].mouthTop+10,{seconds:.8,bags});
 assert.notEqual(shoulder.b.collected,true);assert.ok(shoulder.b.y<=bags[2].mouthTop+.6,'Schulter '+shoulder.b.y);
 const away=run('plastik',bags[0].cx,lip-BASE_CONFIG.sort.reach-30,{seconds:3,bags});
 assert.notEqual(away.b.collected,true);
 const near=run('plastik',bags[0].cx,lip-8,{seconds:.45,bags});
 assert.ok(near.b.y>lip-8+2&&near.b.y<lip+30,'Sog bleibt lokal '+near.b.y);
});

test('a wrong category is spat back and is not sucked in again',()=>{
 const bags=world(),g=bags[0],lip=g.mouthTop;
 const bad=run('glas',g.cx,lip+2,{seconds:.7,bags});
 console.log(`Fehlwurf: y ${bad.b.y.toFixed(1)} (Lippe ${lip.toFixed(1)}) Ereignisse ${bad.events.map(e=>e.type).join(',')}`);
 assert.notEqual(bad.b.collected,true);
 assert.equal(bad.events.filter(e=>e.type==='reject').length,1);
 assert.ok(bad.b.y<lip-18,'Rückstoß '+bad.b.y);
 assert.ok(bad.b.y>lip-140,'nicht vom Bild '+bad.b.y);
 const later=run('glas',g.cx,lip-4,{seconds:1.6,bags});
 assert.notEqual(later.b.collected,true);
 assert.ok(later.b.y<lip-8);
 const fresh=createBody(kind('glas'),g.cx,lip+3,()=>.5);
 const sim={};advance(sim,[fresh],(t,now)=>({width:W,height:H,now,t,flow:()=>({vx:0,vy:0,weight:0}),size:()=>22,bags,
  bagAccel:(b,env)=>bagAccel(b,env,BASE_CONFIG.sort,BASE_CONFIG.drift.edge),
  bagResolve:(b,env)=>bagResolve(b,env,BASE_CONFIG.sort)}),1/60,16);
 assert.equal(fresh.sortEvent.type,'reject');fresh.sortEvent=null;
 fresh.x=bags[2].cx;fresh.y=bags[2].mouthTop+3;fresh.vx=0;fresh.vy=20;
 for(let i=0;i<20;i++)advance(sim,[fresh],(t,now)=>({width:W,height:H,now,t,flow:()=>({vx:0,vy:0,weight:0}),size:()=>22,bags,
  bagAccel:(b,env)=>bagAccel(b,env,BASE_CONFIG.sort,BASE_CONFIG.drift.edge),
  bagResolve:(b,env)=>bagResolve(b,env,BASE_CONFIG.sort)}),1/60,(i+2)*16);
 assert.equal(fresh.collected,true,'passender Sack bleibt offen');
});

test('mouth shear spins only inside the opening field, same at 60 and 120 fps',()=>{
 const bags=world(),sort={...BASE_CONFIG.sort,suction:0,inward:0,swirl:80};
 const y=bags[0].mouthTop-6,x=bags[0].cx+bags[0].mouthW*.22;
 const spun=run('plastik',x,y,{seconds:.6,bags,sort});
 const calm=run('plastik',x,y,{seconds:.6,bags,sort,hook:false});
 assert.ok(Math.abs(spun.b.angle-calm.b.angle)>.08,'Drehung im Feld '+(spun.b.angle-calm.b.angle));
 const far=run('plastik',40,200,{seconds:.6,bags,sort});
 const far0=run('plastik',40,200,{seconds:.6,bags,sort,hook:false});
 assert.equal(far.b.angle,far0.b.angle);
 const a=run('plastik',bags[0].cx,bags[0].mouthTop-4,{seconds:1,fps:60});
 const c=run('plastik',bags[0].cx,bags[0].mouthTop-4,{seconds:1,fps:120});
 assert.equal(a.b.collected,true);assert.equal(c.b.collected,true);
 assert.ok(Math.abs(a.events[0].t-c.events[0].t)<.05,'fps '+a.events[0].t+' '+c.events[0].t);
});

test('the rules are written down',()=>{
 const readme=readFileSync(new URL('../README.md',import.meta.url),'utf8');
 assert.match(readme,/v2026\.11\.05-8/);
 assert.match(readme,/Mitte/);assert.match(readme,/falschen/);assert.match(readme,/Sog/);
 assert.match(readme,/Kein Schiff, keine Förderbänder, keine Tiere/);
});
