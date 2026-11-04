import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {TRASH} from '../src/trash-catalog.js';
import {waveDrift,createBody,stepBodies,displayFloat} from '../src/trash-physics.js';

test('trash catalog: 18-24+ sprites, category in file name, files exist',()=>{
 assert.ok(TRASH.length>=18);
 for(const t of TRASH){assert.match(t.src,new RegExp(`/${t.category}-${t.name}\\.png$`));assert.ok(existsSync(new URL('..'+t.src.slice(1),import.meta.url)),t.src);}
 assert.equal(new Set(TRASH.map(t=>t.src)).size,TRASH.length);
});

test('a tap ring pushes items radially outward, suction pulls inward',()=>{
 const now=1000,ring=[{x:0,y:0,power:.85,nearField:false,start:now-400}];// front at 100 px
 const out=waveDrift(ring,100,0,now);assert.ok(out.ax>50&&Math.abs(out.ay)<1e-6);
 const diag=waveDrift(ring,0,-100,now);assert.ok(diag.ay<-50);
 const pull=waveDrift([{...ring[0],power:-.6}],100,0,now);assert.ok(pull.ax<0);
 assert.equal(waveDrift(ring,100,0,now+5000).energy,0);
});

test('items drift with the water and stay inside the soft edge',()=>{
 const kind=TRASH[0],b=createBody(kind,200,400,()=>.5),pulses=[{x:150,y:400,power:1,nearField:true,start:0}];
 const env=now=>({width:390,height:844,now,t:now/1000,pulses,local:()=>({height:0,slopeX:0,slopeY:0}),swell:()=>({lift:0,crest:0,pitch:0,roll:0}),size:()=>25});
 for(let i=0;i<120;i++)stepBodies([b],env(i*16.7),1/60);
 assert.ok(b.x>230,'pushed away from the finger: '+b.x);
 const e=createBody(kind,385,400,()=>.5);e.vx=300;
 for(let i=0;i<240;i++)stepBodies([e],{...env(99999),pulses:[]},1/60);
 assert.ok(e.x<390-10,'soft edge brings it back: '+e.x);
});

test('display limits keep heave small and tilt reduced',()=>{
 const f=displayFloat({bob:-9.5,dip:.1,pitch:12,roll:10},20);
 assert.ok(Math.abs(f.bob)<=1.3+1e-9);assert.ok(Math.abs(f.pitch-4.8)<1e-9&&Math.abs(f.roll-3.5)<1e-9);
});
