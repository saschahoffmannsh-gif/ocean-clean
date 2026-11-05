import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {LIFE_KINDS,createCreature,stepLife} from '../src/life-sim.js';
import {BASE_CONFIG} from '../src/config.js';

const kind=name=>LIFE_KINDS.find(k=>k.name===name);
const env=(flow)=>({width:390,height:844,t:0,flow});
const zero=()=>({vx:0,vy:0,weight:0});

test('underwater cast has no plants and the sprites exist',()=>{
 assert.equal(LIFE_KINDS.length,4);
 assert.ok(!LIFE_KINDS.some(k=>k.role==='grass'||k.name==='seegras'));
 assert.equal(BASE_CONFIG.life.counts.seegras,undefined);
 const n=Object.values(BASE_CONFIG.life.counts).reduce((a,b)=>a+b,0);
 assert.ok(n>=12&&n<=20,'count '+n);
 for(const k of LIFE_KINDS)assert.ok(existsSync(new URL('../assets/life/'+k.name+'.png',import.meta.url)),k.name);
 assert.ok(!existsSync(new URL('../assets/life/seegras.png',import.meta.url)));
 assert.ok(existsSync(new URL('../asset-sources/life/unused/seegras.png',import.meta.url)));
 assert.equal(BASE_CONFIG.life.counts.schildkroete,1);
 assert.ok(BASE_CONFIG.life.counts.sardine>=6&&BASE_CONFIG.life.counts.qualle>=2);
 assert.ok(BASE_CONFIG.life.alpha<1&&BASE_CONFIG.life.blur>0);
});

test('turtle is slow and jellyfish only pulse',()=>{
 const cfg=BASE_CONFIG.life,fish=createCreature(kind('sardine'),180,400,()=>.2),turtle=createCreature(kind('schildkroete'),200,420,()=>.2);
 const jelly=createCreature(kind('qualle'),220,300,()=>.4);
 fish.heading=0;turtle.heading=0;jelly.heading=0;
 const list=[fish,turtle,jelly];
 for(let i=0;i<120;i++)stepLife(list,{...env(zero),t:i/60},1/60,cfg);
 const fishD=Math.hypot(fish.x-180,fish.y-400),turtleD=Math.hypot(turtle.x-200,turtle.y-420);
 assert.ok(fishD>turtleD*1.8,'tempo '+fishD+' '+turtleD);
 assert.ok(jelly.pulse>.9&&jelly.pulse<1.1,'pulse '+jelly.pulse);
});

test('a strong swipe turns a fish aside without removing it',()=>{
 const cfg=BASE_CONFIG.life;
 const swim=createCreature(kind('makrele'),200,400,()=>0);swim.heading=0;
 const calm=createCreature(kind('makrele'),200,400,()=>0);calm.heading=0;
 const flow=()=>({vx:220,vy:0,weight:1});
 for(let i=0;i<90;i++)stepLife([swim],{...env(flow),t:i/60},1/60,cfg);
 for(let i=0;i<90;i++)stepLife([calm],{...env(zero),t:i/60},1/60,cfg);
 assert.ok(Math.abs(Math.cos(swim.heading))<Math.abs(Math.cos(calm.heading)),'ausweichen '+swim.heading+' '+calm.heading);
 assert.ok(Math.hypot(swim.x-200,swim.y-400)>20);
});

test('creatures stay in the field',()=>{
 const cfg=BASE_CONFIG.life,list=[];
 let s=3;const rand=()=>((s=s*16807%2147483647)/2147483647);
 for(const k of LIFE_KINDS)list.push(createCreature(k,40+rand()*300,80+rand()*700,rand));
 for(let i=0;i<60*12;i++)stepLife(list,{width:390,height:844,t:i/60,flow:zero},1/60,cfg);
 for(const c of list){assert.ok(c.x>-30&&c.x<420&&c.y>-30&&c.y<880,c.kind.name+' '+c.x+','+c.y);
  if(c.kind.role==='jelly')assert.ok(c.pulse>.9&&c.pulse<1.1);}
});
