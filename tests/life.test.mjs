import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {LIFE_KINDS,createCreature,stepLife} from '../src/life-sim.js';
import {BASE_CONFIG} from '../src/config.js';

const kind=name=>LIFE_KINDS.find(k=>k.name===name);
const env=(flow)=>({width:390,height:844,t:0,flow});
const zero=()=>({vx:0,vy:0,weight:0});

test('life sprites exist and stay a small cast',()=>{
 assert.equal(LIFE_KINDS.length,6);
 const counts=BASE_CONFIG.life.counts,n=Object.values(counts).reduce((a,b)=>a+b,0);
 assert.ok(n<=24&&n>=16,'count '+n);
 for(const k of LIFE_KINDS)assert.ok(existsSync(new URL('../assets/life/'+k.name+'.png',import.meta.url)),k.name);
 assert.equal(counts.schildkroete,1);assert.ok(counts.sardine>=6);assert.ok(counts.qualle>=2);assert.ok(counts.seegras>=4);
});

test('turtle is slow, grass stays rooted, jellyfish only pulse',()=>{
 const cfg=BASE_CONFIG.life,fish=createCreature(kind('sardine'),180,400,()=>.2),turtle=createCreature(kind('schildkroete'),200,420,()=>.2);
 const grass=createCreature(kind('seegras'),150,600,()=>.3),jelly=createCreature(kind('qualle'),220,300,()=>.4);
 fish.heading=0;turtle.heading=0;jelly.heading=0;
 const list=[fish,turtle,grass,jelly];
 for(let i=0;i<120;i++){stepLife(list,{...env(zero),t:i/60},1/60,cfg);}
 const fishD=Math.hypot(fish.x-180,fish.y-400),turtleD=Math.hypot(turtle.x-200,turtle.y-420);
 assert.ok(fishD>turtleD*1.8,'tempo '+fishD+' '+turtleD);
 assert.equal(grass.x,150);assert.equal(grass.y,600);
 assert.ok(Math.abs(grass.bend)<=cfg.grassMax+1e-9);
 assert.ok(jelly.pulse>.9&&jelly.pulse<1.1,'pulse '+jelly.pulse);
});

test('a strong swipe turns a fish aside and bends the grass, without collecting anyone',()=>{
 const cfg=BASE_CONFIG.life;
 const swim=createCreature(kind('makrele'),200,400,()=>0);swim.heading=0;
 const calm=createCreature(kind('makrele'),200,400,()=>0);calm.heading=0;
 const grass=createCreature(kind('seegras'),200,400,()=>0);
 const flow=()=>({vx:220,vy:0,weight:1});
 for(let i=0;i<90;i++)stepLife([swim,grass],{...env(flow),t:i/60},1/60,cfg);
 for(let i=0;i<90;i++)stepLife([calm],{...env(zero),t:i/60},1/60,cfg);
 assert.ok(Math.abs(Math.cos(swim.heading))<Math.abs(Math.cos(calm.heading)),'ausweichen '+swim.heading+' '+calm.heading);
 assert.ok(Math.abs(grass.bend)>0.05,'wiegen '+grass.bend);
 assert.equal(grass.x,200);assert.equal(grass.y,400);
});

test('creatures stay in the field',()=>{
 const cfg=BASE_CONFIG.life,list=[];
 let s=3;const rand=()=>((s=s*16807%2147483647)/2147483647);
 for(const k of LIFE_KINDS)if(k.role!=='grass')list.push(createCreature(k,40+rand()*300,80+rand()*700,rand));
 list.push(createCreature(kind('seegras'),200,700,rand));
 for(let i=0;i<60*12;i++)stepLife(list,{width:390,height:844,t:i/60,flow:zero},1/60,cfg);
 for(const c of list){assert.ok(c.x>-30&&c.x<420&&c.y>-30&&c.y<880,c.kind.name+' '+c.x+','+c.y);
  if(c.kind.role==='jelly')assert.ok(c.pulse>.9&&c.pulse<1.1);}
});
