import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {TRASH} from '../src/trash-catalog.js';
import {waveDrift,createBody,stepBodies,advance,displayFloat} from '../src/trash-physics.js';
import {BASE_CONFIG,makeConfig,readForce} from '../src/config.js';
import {simulate} from './helpers/swipe-sim.mjs';

test('trash catalog: 18-24+ sprites, category in file name, files exist',()=>{
 assert.ok(TRASH.length>=18);
 for(const t of TRASH){assert.match(t.src,new RegExp(`/${t.category}-${t.name}\\.png$`));assert.ok(existsSync(new URL('..'+t.src.slice(1),import.meta.url)),t.src);}
 assert.equal(new Set(TRASH.map(t=>t.src)).size,TRASH.length);
});

test('a ring pushes items radially outward, suction pulls inward',()=>{
 const now=1000,ring=[{x:0,y:0,power:.4,nearField:false,start:now-400}];
 assert.ok(waveDrift(ring,100,0,now).ax>5);assert.ok(waveDrift(ring,0,-100,now).ay<-5);
 assert.ok(waveDrift([{...ring[0],power:-.3}],100,0,now).ax<0);
 assert.equal(waveDrift(ring,100,0,now+5000).energy,0);
});

test('fixed time step: the same tap gives the same motion at 30, 60 and 120 fps',()=>{
 const r=[30,60,120].map(fps=>simulate({fps,kind:'tap'}));
 for(const x of r){assert.ok(Math.abs(x.max-r[1].max)<1,JSON.stringify(r));assert.ok(Math.abs(x.median-r[1].median)<.3);}
});

test('a normal swipe moves trash calmly at 60 and 120 fps (heavy, no flinging)',()=>{
 for(const fps of [60,120]){
  const s=simulate({fps,kind:'swipe'}),t=simulate({fps,kind:'tap'});
  console.log(`${fps} fps swipe max ${s.max.toFixed(0)} px, top5 ${s.top5.toFixed(0)} px, median ${s.median.toFixed(0)} px, vmax ${s.maxSpeed.toFixed(0)} px/s | tap max ${t.max.toFixed(0)} px`);
  assert.ok(s.max>35&&s.max<100,'swipe max '+s.max);       // vorher ~280 px
  assert.ok(s.median>10&&s.median<45,'swipe median '+s.median); // vorher ~107 px
  assert.ok(s.maxSpeed<=BASE_CONFIG.drift.maxSpeed+1e-6);
  assert.ok(t.max<30,'tap '+t.max);                         // vorher ~84 px
 }
});

test('?force multiplier scales water input and coupling, clamped 0..2',()=>{
 assert.equal(readForce('?force=0.5'),.5);assert.equal(readForce('?force=9'),2);assert.equal(readForce(''),1);
 const c=makeConfig(2);assert.equal(c.water.input,BASE_CONFIG.water.input*2);assert.equal(c.drift.push,BASE_CONFIG.drift.push*2);
 assert.ok(simulate({kind:'swipe',force:0}).max<5);
});

test('soft edge brings drifting items back',()=>{
 const e=createBody(TRASH[0],385,400,()=>.5);e.vx=70;const sim={};
 const envAt=(t,now)=>({width:390,height:844,now,t,pulses:[],local:()=>({height:0,slopeX:0,slopeY:0}),swell:()=>({lift:0,crest:0,pitch:0,roll:0}),size:()=>25});
 for(let i=1;i<=240;i++)advance(sim,[e],envAt,1/60,i*16.7);
 assert.ok(e.x<390-10,'x '+e.x);
});

test('display limits keep heave small and tilt reduced',()=>{
 const f=displayFloat({bob:-9.5,dip:.1,pitch:12,roll:10},20);
 assert.ok(Math.abs(f.bob)<=1.3+1e-9);assert.ok(Math.abs(f.pitch-12*BASE_CONFIG.float.pitch)<1e-9&&Math.abs(f.roll-10*BASE_CONFIG.float.roll)<1e-9);
});
