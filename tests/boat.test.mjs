import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CATEGORIES,CATEGORY_LABELS,TRASH} from '../src/trash-catalog.js';
import {createBody,advance} from '../src/trash-physics.js';
import {layoutBoat,decideSort,BIN_LOOK} from '../src/boat.js';
import {BASE_CONFIG,makeConfig} from '../src/config.js';

const kind=cat=>TRASH.find(t=>t.category===cat);
function envAt(layout,cfg){
 return (t,now)=>({width:layout.width,height:layout.height,now,t,flow:()=>({vx:0,vy:0,weight:0,swirl:0}),size:()=>22,belts:layout,beltCfg:cfg.boat});
}
function run(cat,binIndex,{x,y,seconds=2.4,fps=60,W=390,H=844}={}){
 const cfg=makeConfig(),layout=layoutBoat(W,H),bin=layout.bins[binIndex];
 const b=createBody(kind(cat),x??bin.mouth.x,y??bin.mouth.y,()=>.5),sim={};
 const n=Math.round(seconds*fps);
 for(let i=1;i<=n;i++)advance(sim,[b],envAt(layout,cfg),1/fps,i*1000/fps,cfg.drift,null,cfg.flow);
 return {b,bin,layout,cfg};
}

test('stern layout: four category bins, floors only a sliver, hull stays low',()=>{
 const L=layoutBoat(390,844);
 assert.deepEqual(L.bins.map(b=>b.category),[...CATEGORIES]);
 assert.deepEqual(L.bins.map(b=>b.label),CATEGORIES.map(c=>CATEGORY_LABELS[c]));
 for(const b of L.bins){
  assert.ok(b.floorH<b.faceH*.6,'boden nur im ansatz '+b.floorH);
  assert.ok(b.floorH<=18&&b.floorH>=14,'bodenstreifen '+b.floorH);
  assert.equal(b.look,BIN_LOOK[b.category]);
  assert.ok(b.mouth.y<b.lipTop&&b.belt.base.y>b.mouth.y);
  assert.ok(b.mouth.x>b.cx-b.boxW/2&&b.mouth.x<b.cx+b.boxW/2);
 }
 assert.ok(L.hullTop>844*.72,'heck frisst das meer nicht '+L.hullTop);
 assert.ok(L.mouthY>844*.55);
 assert.equal(decideSort('glas','glas'),'keep');
 assert.equal(decideSort('glas','plastik'),'reject');
 const wide=layoutBoat(1400,900);
 assert.ok(wide.bins[0].boxW<=116&&wide.bins[3].cx<1400);
});

test('matching trash is carried into its bin, the wrong kind is kicked back at the mouth',()=>{
 for(const [cat,i] of CATEGORIES.map((c,n)=>[c,n])){
  const ok=run(cat,i,{seconds:2.2});
  assert.equal(ok.b.collected,true,cat);
  assert.ok(ok.b.y>ok.bin.mouth.y+40,'in die box '+cat);
 }
 const wrong=run('glas',0,{seconds:1.2});
 assert.notEqual(wrong.b.collected,true);
 assert.equal(wrong.b.mode,'free');
 assert.ok(wrong.b.rejects>=1,'abgewiesen');
 assert.ok(wrong.b.y<wrong.bin.mouth.y-8,'zurück ins wasser '+wrong.b.y);
 const metal=run('metall',1,{seconds:2.2});
 assert.equal(metal.b.collected,true);
 assert.notEqual(run('metall',2,{seconds:.8}).b.collected,true);
});

test('light suction at the mouth pulls a nearby item in and leaves a far one',()=>{
 const near=run('plastik',0,{y:null,seconds:1.8});
 const layout=near.layout,mouth=layout.bins[0].mouth;
 const pulled=run('plastik',0,{x:mouth.x,y:mouth.y-50,seconds:2.8});
 assert.equal(pulled.b.collected,true,'sog sammelt passendes');
 const early=run('plastik',0,{x:mouth.x,y:mouth.y-50,seconds:1.55});
 assert.ok(early.b.mode==='ride'||early.b.mode==='throw'||early.b.collected,'sog hat das maul erreicht '+early.b.mode);
 const far=run('plastik',0,{x:mouth.x,y:mouth.y-220,seconds:1.8});
 assert.notEqual(far.b.collected,true);
 assert.ok(Math.hypot(far.b.x-mouth.x,far.b.y-(mouth.y-220))<12,'fern bleibt '+far.b.y);
 const side=run('plastik',0,{x:mouth.x+40,y:mouth.y-36,seconds:2.8});
 assert.equal(side.b.collected,true,'seitlich im sog');
});

test('belt capture matches at 60 and 120 fps and does not ride the wrong category',()=>{
 const t=fps=>{
  const cfg=makeConfig(),L=layoutBoat(390,844),bin=L.bins[0],b=createBody(kind('plastik'),bin.mouth.x,bin.mouth.y-46,()=>.5),sim={};
  let hit=null;const n=Math.round(3*fps);
  for(let i=1;i<=n;i++){advance(sim,[b],envAt(L,cfg),1/fps,i*1000/fps,cfg.drift,null,cfg.flow);if(hit==null&&b.mode!=='free')hit=i/fps;if(b.collected)return {hit,done:i/fps};}
  return {hit,done:null,mode:b.mode};
 };
 const a=t(60),b=t(120);
 assert.ok(a.done&&b.done,'gefangen');
 assert.ok(Math.abs(a.done-b.done)<.05,JSON.stringify([a,b]));
 const cfg=makeConfig(),L=layoutBoat(390,844),bin=L.bins[2];
 const y=bin.mouth.y+(bin.belt.base.y-bin.mouth.y)*.55;
 const mid=createBody(kind('rest'),bin.cx,y,()=>.5),sim={};
 for(let i=1;i<=40;i++)advance(sim,[mid],envAt(L,cfg),1/60,i*1000/60,cfg.drift,null,cfg.flow);
 assert.notEqual(mid.collected,true);
 assert.ok(mid.rejects>=1,'auf dem band abgewiesen');
 assert.ok(mid.y<y-12,'zurück nach oben '+mid.y);
 const on=run('glas',2,{x:L.bins[2].cx,y:L.bins[2].mouth.y+(L.bins[2].belt.base.y-L.bins[2].mouth.y)*.4,seconds:2});
 assert.equal(on.b.collected,true,'richtiges teil auf dem band wird mitgenommen');
});

test('sorting rules are the documented categories and the page names them',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const readme=readFileSync(new URL('../README.md',import.meta.url),'utf8');
 assert.match(html,/Plastik, Metall, Glas und Restmüll/);
 assert.match(readme,/decideSort/);
 assert.match(readme,/Kategorie = Band/);
 assert.match(readme,/Abweisen am Maul/);
 for(const c of CATEGORIES)assert.match(readme,new RegExp(c));
 assert.equal(makeConfig().boat,BASE_CONFIG.boat);
 assert.equal(BASE_CONFIG.boat.rejectHold,.85);
});
