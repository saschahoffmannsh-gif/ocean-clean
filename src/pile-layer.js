// Dichter 3D-Müllhaufen auf dem offenen Meer. Der Finger hebt freie Teile an
// und legt sie woanders ab. Auf offenem Wasser trägt die Wischströmung mit.
// Keine Säcke. Wasser bleibt im Originalmodul:
// Störung nur über surface.disturb, die Wischwelle kommt aus SwipeInput.
import {stepBuoyancy} from '../water-13.0.0/ocean.js';
import {displayFloat,seaSway} from './trash-physics.js?v=20261106-v8b';
import {loadItemMeshes} from './item-mesh.js?v=20261106-v8b';
import {PILE_KINDS,advancePile,countFree,grabTarget,layoutPile,mulberry32,spawnPile} from './pile.js?v=20261106-v8b';
import {PileView,fallbackColor} from './pile-view.js?v=20261106-v8b';
import {pointerPoint} from './pile-pose.js?v=20261106-v8b';

function canvas(className){
 const c=document.createElement('canvas');c.className=className;c.setAttribute('aria-hidden','true');return c;
}

export class PileLayer{
 constructor(ocean,config,input,{seed=11}={}){
  this.ocean=ocean;this.cfg=config;this.input=input;this.rand=mulberry32(seed);
  this.bodies=[];this.droplets=[];this.finger={active:false,holding:false,x:0,y:0,vx:0,vy:0,at:0};
  this.held=null;this.pointerId=null;this.raf=0;this.last=0;this.sim={};this.frameMs=0;
  this.shadow=canvas('pile-shadow');this.sctx=this.shadow.getContext('2d');
  this.fx=canvas('pile-fx');this.fctx=this.fx.getContext('2d');
  this.view=null;this.canvas=this.shadow;
 }
 async init(){
  await loadItemMeshes();
  try{this.view=new PileView();await this.view.warm();}catch(error){console.warn('Ocean Clean: 3D nicht verfügbar.',error);this.view=null;}
  this.ocean.spray.before(this.shadow);
  if(this.view?.canvas)this.ocean.spray.before(this.view.canvas);
  this.ocean.root.append(this.fx);
  if(this.view?.active)this.canvas=this.view.canvas;
  if(this.input)this.input.carrying=()=>!!this.held;
  this.resize();this.spawn();this.rest();
  this.bind();
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(this.ocean.root);
  document.addEventListener('visibilitychange',()=>document.hidden?this.stop():this.start());
  this.start();return this;
 }
 playH(){const v=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--play-h'));return v>0?Math.min(this.ocean.height,v):this.ocean.height;}
 resize(){
  const o=this.ocean,dpr=Math.min(devicePixelRatio||1,2);
  const w=Math.max(1,o.width),h=Math.max(1,o.height),ph=this.playH();
  const fit=(c)=>{const W=Math.round(w*dpr),H=Math.round(h*dpr);if(c.width!==W||c.height!==H){c.width=W;c.height=H;}};
  fit(this.shadow);fit(this.fx);this.dpr=dpr;
  this.view?.resize(w,h,dpr);
  if(this.w&&this.bodies.length){const sx=w/this.w,sy=ph/this.h;for(const b of this.bodies){b.x*=sx;b.y*=sy;}}
  const lay=layoutPile(w,ph);
  this.w=w;this.h=ph;this.cx=lay.cx;this.cy=lay.cy;this.pileR=lay.pileR;this.base=lay.base;this.radiusScale=lay.radiusScale;
 }
 spawn(){
  const lay=layoutPile(this.w,this.h);
  this.bodies=spawnPile({kinds:PILE_KINDS,n:lay.n,width:this.w,height:this.h,rand:this.rand,radiusScale:lay.radiusScale});
 }
 rest(){
  const env=this.env(0);env.finger=null;const sim={};
  for(let i=1;i<=320;i++)advancePile(sim,this.bodies,()=>env,1/60,i*16.7,this.cfg.pile);
  this.sim={};
 }
 env(t){
  return{width:this.w,height:this.h,t,cx:this.cx,cy:this.cy,pileR:this.pileR,
   finger:this.finger.active?this.finger:null,
   flow:(x,y)=>this.input.flow.sample(x,y,this.now||0)};
 }
 bind(){
  const c=this.ocean.canvas,opt={passive:true,signal:(this.events=new AbortController()).signal};
  c.addEventListener('pointerdown',e=>this.down(e),opt);
  c.addEventListener('pointermove',e=>this.move(e),opt);
  for(const n of ['pointerup','pointercancel','lostpointercapture'])c.addEventListener(n,e=>this.up(e),opt);
 }
 local(e){
  const el=this.view?.canvas||this.ocean.canvas;
  const r=el.getBoundingClientRect();
  const box={width:el.clientWidth||this.view?.cssW||r.width,height:el.clientHeight||this.view?.cssH||r.height};
  const src=e.touches?.[0]||e.changedTouches?.[0]||e;
  return pointerPoint(src.clientX,src.clientY,r,box,window.visualViewport);
 }
 down(e){
  if(e.button>0||this.pointerId!=null)return;
  const p=this.local(e),now=performance.now();
  this.pointerId=e.pointerId;
  const hit=grabTarget(p.x,p.y,this.bodies);
  this.finger.x=p.x;this.finger.y=p.y;this.finger.vx=0;this.finger.vy=0;this.finger.at=now;
  if(!hit){this.held=null;this.finger.active=false;this.finger.holding=false;return;}
  const segs=this.input?.flow?.segments;
  if(segs?.length&&segs[segs.length-1].tap)segs.pop();
  hit.held=true;hit.vx=0;hit.vy=0;
  this.held=hit;this.finger.active=true;this.finger.holding=true;
  this.splash(hit.x,hit.y,.11,3.5,8);
 }
 move(e){
  if(e.pointerId!==this.pointerId||!this.held)return;
  const p=this.local(e),now=performance.now(),dt=Math.max(1/240,(now-this.finger.at)/1000);
  const vx=(p.x-this.finger.x)/dt,vy=(p.y-this.finger.y)/dt;
  this.finger.vx=Math.max(-1600,Math.min(1600,vx));this.finger.vy=Math.max(-1600,Math.min(1600,vy));
  this.finger.x=p.x;this.finger.y=p.y;this.finger.at=now;
 }
 up(e){
  if(e.pointerId!==this.pointerId)return;
  if(this.held){this.held.held=false;this.held.vx=0;this.held.vy=0;this.held.vz=Math.min(this.held.vz,-80);this.held=null;}
  this.finger.active=false;this.finger.holding=false;this.finger.vx=0;this.finger.vy=0;this.pointerId=null;
 }
 splash(x,y,amp,radius,n=6){
  const o=this.ocean;if(o.width)o.surface.disturb(x/o.width,y/o.height,amp,radius);
  for(let i=0;i<n;i++){const a=this.rand()*Math.PI*2,sp=30+this.rand()*70;
   this.droplets.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-24,life:0,max:.32+this.rand()*.2,r:1.2+this.rand()*1.6});}
  if(this.droplets.length>70)this.droplets.splice(0,this.droplets.length-70);
 }
 start(){if(!this.raf&&!document.hidden){this.last=0;this.raf=requestAnimationFrame(()=>this.frame());}}
 stop(){cancelAnimationFrame(this.raf);this.raf=0;}
 frame(){
  const t0=performance.now();this.now=t0;
  const frameDt=Math.min(.1,(t0-(this.last||t0-16.7))/1000);this.last=t0;
  if(this.finger.active&&t0-this.finger.at>60){this.finger.vx=0;this.finger.vy=0;}
  const o=this.ocean,F=this.cfg.float;
  advancePile(this.sim,this.bodies,(t)=>this.env(t),frameDt,t0,this.cfg.pile);
  for(const b of this.bodies){
   if(b.hitWater)this.splash(b.x,b.y,.13,4.1,9);
   const sea=o.sample(b.x/o.width,b.y/o.height),wave=o.sampleLocalWaves(b.x/o.width,b.y/o.height,t0);
   const damp=b.held?.35:Math.max(.25,1+Math.min(0,b.z)/40);
   b.float=displayFloat(stepBuoyancy(b,{...sea,pitch:(sea.pitch||0)*damp,roll:(sea.roll||0)*damp,motion:Math.hypot(b.vx,b.vy)/220},wave.height,1/60,o.reducedMotion),this.base,F);
   if(b.held)b.float.bob*=.2;
  }
  for(const p of this.droplets){p.life+=frameDt;p.x+=p.vx*frameDt;p.y+=p.vy*frameDt;p.vy+=90*frameDt;}
  this.droplets=this.droplets.filter(p=>p.life<p.max);
  this.draw();
  this.frameMs=this.frameMs*.95+(performance.now()-t0)*.05;
  this.raf=requestAnimationFrame(()=>this.frame());
 }
 swayOf(b){return seaSway(b,this.sim.time||0,this.cfg.pile.sway);}
 draw(){
  const dpr=this.dpr,s=this.sctx;s.setTransform(1,0,0,1,0,0);s.clearRect(0,0,this.shadow.width,this.shadow.height);s.setTransform(dpr,0,0,dpr,0,0);
  if(!this.view?.active)for(const b of this.bodies)this.flat(s,b);
  const f=this.fctx;f.setTransform(1,0,0,1,0,0);f.clearRect(0,0,this.fx.width,this.fx.height);f.setTransform(dpr,0,0,dpr,0,0);
  if(this.finger.active){
   const g=f.createRadialGradient(this.finger.x,this.finger.y,2,this.finger.x,this.finger.y,34);
   g.addColorStop(0,'rgba(236,255,252,.38)');g.addColorStop(1,'rgba(236,255,252,0)');
   f.fillStyle=g;f.beginPath();f.arc(this.finger.x,this.finger.y,34,0,7);f.fill();
  }
  for(const p of this.droplets){const u=1-p.life/p.max;f.globalAlpha=Math.max(0,u)*.8;f.fillStyle='rgba(232,252,255,.95)';f.beginPath();f.arc(p.x,p.y,p.r,0,7);f.fill();}
  f.globalAlpha=1;
  this.view?.render(this,b=>this.swayOf(b));
 }
 flat(s,b){
  const len=this.base*b.kind.long*1.35,wid=Math.max(8,this.base*b.kind.thick*.34),depth=Math.min(1,Math.max(0,-b.z/34));
  s.save();s.translate(b.x,b.y-Math.min(0,b.z)*.35);s.rotate(b.angle);
  s.globalAlpha=b.held?1:.95-.55*depth;s.fillStyle=depth>.05?'#0d4e66':fallbackColor(b.kind.key);
  s.beginPath();s.ellipse(0,0,len*.5,wid,0,0,7);s.fill();s.restore();
 }
 stats(){const c=countFree(this.bodies,this.cfg.pile);return{...c,n:this.bodies.length,held:this.held?.kind.label||''};}
}
