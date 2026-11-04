import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {TRASH,CATEGORIES,balancedOrder} from '../src/trash-catalog.js';
import {createBody,advance,displayFloat} from '../src/trash-physics.js';
import {SwipeFlow} from '../src/swipe-flow.js';
import {wakeDrops} from '../src/swipe-input.js';
import {BASE_CONFIG,makeConfig,readForce} from '../src/config.js';
import {simulate} from './helpers/swipe-sim.mjs';
import {probe} from './helpers/suction-probe.mjs';

test('trash catalog: 4 categories x 6 sprites, category in file name, files exist',()=>{
 assert.equal(TRASH.length,24);assert.deepEqual(CATEGORIES,['plastik','metall','glas','rest']);
 for(const c of CATEGORIES)assert.equal(TRASH.filter(t=>t.category===c).length,6,c);
 for(const t of TRASH){const f=t.src.split('?')[0];assert.match(f,new RegExp(`/${t.category}-${t.name}\\.png$`));assert.ok(existsSync(new URL('..'+f.slice(1),import.meta.url)),t.src);assert.ok(t.look>.3&&t.look<=1.3,'look '+t.name);}
 assert.equal(new Set(TRASH.map(t=>t.src)).size,TRASH.length);
});

test('swipe flow: along the stroke inside the band, exactly zero beyond the cutoff',()=>{
 const c=BASE_CONFIG.flow,f=new SwipeFlow(c);f.addSegment(100,400,140,400,1/30,0);
 const on=f.sample(120,400,50),side=f.sample(120,440,50),far=f.sample(120,400+c.radius*c.cutoff+1,50);
 assert.ok(on.vx>50&&Math.abs(on.vy)<1e-9,JSON.stringify(on));assert.ok(side.vy>0&&side.weight<on.weight);
 assert.deepEqual([far.vx,far.vy,far.weight],[0,0,0]);
 assert.equal(f.sample(120,400,c.lifetime*1000+10).weight,0);
});

test('bow wave: one pressure/suction pair close to the finger, small radius',()=>{
 const w=BASE_CONFIG.wake,d=wakeDrops(0,0,20,0,1/60,w);
 assert.equal(d.length,2);assert.ok(d[0][2]>0&&d[1][2]<0);assert.ok(d[0][0]-d[1][0]<=w.ahead+w.behind+20+1e-9);assert.ok(d[0][3]<5);
});

test('fixed time step: the same tap gives the same motion at 30, 60 and 120 fps',()=>{
 const r=[30,60,120].map(fps=>simulate({fps,kind:'tap'}));
 for(const x of r)x.items.forEach((it,i)=>assert.ok(Math.abs(it.moved-r[1].items[i].moved)<.5));
});

test('a normal swipe only moves trash near the stroke (60 and 120 fps)',()=>{
 for(const fps of [60,120]){
  const s=simulate({fps,kind:'swipe'}),t=simulate({fps,kind:'tap'});
  console.log(`${fps} fps | nah <60 px: n=${s.near.n} Ø ${s.near.mean.toFixed(1)} max ${s.near.max.toFixed(1)} px | 60–150 px: Ø ${s.mid.mean.toFixed(1)} max ${s.mid.max.toFixed(1)} | fern >150 px: n=${s.far.n} max ${s.far.max.toFixed(2)} px | Tipp max ${Math.max(t.near.max,t.mid.max,t.far.max).toFixed(1)} px`);
  assert.ok(s.far.n>=8&&s.far.max<3,'far '+s.far.max);
  assert.ok(s.near.mean>15&&s.near.max<120,'near '+JSON.stringify(s.near));
  assert.ok(s.maxSpeed<=BASE_CONFIG.drift.maxSpeed+1e-6);
 }
 const a=simulate({fps:60}),b=simulate({fps:120});assert.ok(Math.abs(a.near.mean-b.near.mean)<a.near.mean*.15,'fps-unabhängig');
});

test('?force multiplier scales water input and coupling, clamped 0..2',()=>{
 assert.equal(readForce('?force=0.5'),.5);assert.equal(readForce('?force=9'),2);assert.equal(readForce(''),1);
 const c=makeConfig(2);assert.equal(c.flow.carry,BASE_CONFIG.flow.carry*2);assert.equal(c.wake.push,BASE_CONFIG.wake.push*2);
 assert.ok(simulate({kind:'swipe',force:0}).near.max<3);
});

test('soft edge brings drifting items back',()=>{
 const e=createBody(TRASH[0],385,400,()=>.5);e.vx=70;const sim={};
 const envAt=(t,now)=>({width:390,height:844,now,t,flow:()=>({vx:0,vy:0,weight:0}),size:()=>25});
 for(let i=1;i<=240;i++)advance(sim,[e],envAt,1/60,i*16.7);
 assert.ok(e.x<390-10,'x '+e.x);
});

test('display limits keep heave small and tilt reduced',()=>{
 const f=displayFloat({bob:-9.5,dip:.1,pitch:12,roll:10},20);
 assert.ok(Math.abs(f.bob)<=1.3+1e-9);assert.ok(Math.abs(f.pitch-12*BASE_CONFIG.float.pitch)<1e-9&&Math.abs(f.roll-10*BASE_CONFIG.float.roll)<1e-9);
});

test('suction: item on the stroke is pulled along 20–50 px extra, 50 px aside barely, far unchanged (60/120 fps)',()=>{
 for(const fps of [60,120])for(const dur of [.35,.6]){
  const on=probe({fps,dur,offset:0}),on0=probe({fps,dur,offset:0,suction:false}),gain=on.dx-on0.dx;
  const s10=probe({fps,dur,offset:10}),s10b=probe({fps,dur,offset:10,suction:false});
  const at50=probe({fps,dur,offset:50}),at50b=probe({fps,dur,offset:50,suction:false});
  const far=probe({fps,dur,offset:150});
  console.log(`${fps} fps, Wisch ${(300/dur).toFixed(0)} px/s | auf der Spur ${on0.dx.toFixed(0)} → ${on.dx.toFixed(0)} px (+${gain.toFixed(1)}) | 10 px seitlich quer ${s10b.dy.toFixed(1)} → ${s10.dy.toFixed(1)} px | 50 px: Δ ${Math.abs(at50.dx-at50b.dx).toFixed(2)} px | 150 px: ${Math.hypot(far.dx,far.dy).toFixed(2)} px`);
  assert.ok(gain>=20&&gain<=50,'gain '+gain);
  assert.ok(s10.dy<s10b.dy,'im Kern weniger nach außen');
  assert.ok(Math.abs(at50.dx-at50b.dx)<1&&Math.abs(at50.dy-at50b.dy)<1,'50 px kaum');
  assert.ok(Math.hypot(far.dx,far.dy)<3);
  assert.ok(on.maxSpeed<=BASE_CONFIG.drift.maxSpeed+1e-6);
 }
 const f=new SwipeFlow(BASE_CONFIG.flow);f.addSegment(100,400,140,400,1/60,0);
 const a=f.sample(120,400+BASE_CONFIG.flow.suction.radius+.01,20),b=new SwipeFlow({...BASE_CONFIG.flow,suction:null});b.addSegment(100,400,140,400,1/60,0);
 const a0=b.sample(120,400+BASE_CONFIG.flow.suction.radius+.01,20);assert.ok(Math.abs(a.vx-a0.vx)<1e-9&&Math.abs(a.vy-a0.vy)<1e-9,'außerhalb des Kerns wie bisher');
 assert.equal(makeConfig(2).flow.suction.strength,BASE_CONFIG.flow.suction.strength*2);assert.equal(makeConfig(0).flow.suction.inward,0);
});

test('spawn order: all 4 categories about equally often',()=>{
 for(const n of [26,31,38]){let s=7;const rand=()=>((s=s*16807%2147483647)/2147483647);
  const o=balancedOrder(n,rand),cnt=CATEGORIES.map(c=>o.filter(i=>TRASH[i].category===c).length);
  assert.equal(o.length,n);assert.ok(Math.max(...cnt)-Math.min(...cnt)<=1,JSON.stringify(cnt));}
});
