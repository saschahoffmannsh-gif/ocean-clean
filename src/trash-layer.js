// Frei treibender Müll, sichtbar OBEN auf dem Wasser.
// Eigener Canvas über dem Wasser-Canvas (und unter der Gischt), d. h. Glanz und
// Brechung des Meeres liegen nicht über den Teilen. Kontakt zum Wasser: weicher
// Schatten nach unten rechts (Sonne oben links), heller Benetzungsrand und sparsame
// Mini-Ripples über ocean.disturb, wenn ein Teil durchs Wasser gleitet.
// Kein direktes Ziehen – der Finger bewegt das Wasser (Bugwelle + lokale
// Wischströmung aus swipe-input.js), die Strömung nimmt den Müll mit.
import {stepBuoyancy} from '../water-13.0.0/ocean.js';
import {TRASH,balancedOrder} from './trash-catalog.js?v=20261105-boat7';
import {createBody,advance,displayFloat,seaSway} from './trash-physics.js?v=20261105-boat7';
import {layoutBoat,isCarried} from './boat.js?v=20261105-boat7';
import {drawBoat} from './boat-draw.js?v=20261105-boat7';

const load=src=>new Promise((ok,fail)=>{const i=new Image();i.decoding='async';i.onload=()=>ok(i);i.onerror=()=>fail(new Error('Bild fehlt: '+src));i.src=src;});
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const PAD=40;
// Aus der Silhouette abgeleitet: Schatten (dunkel, weich) und Benetzungsrand (hell, schmal).
function derived(img){
 const mk=()=>{const c=document.createElement('canvas');c.width=img.width+PAD*2;c.height=img.height+PAD*2;return c;};
 const shadow=mk(),g=shadow.getContext('2d');g.filter='blur(7px)';g.drawImage(img,PAD,PAD);g.filter='none';g.globalCompositeOperation='source-in';g.fillStyle='rgb(0,42,60)';g.fillRect(0,0,shadow.width,shadow.height);
 const rim=mk(),r=rim.getContext('2d');r.filter='blur(3px)';for(const [dx,dy] of [[-5,0],[5,0],[0,-5],[0,5],[-4,-4],[4,4],[-4,4],[4,-4]])r.drawImage(img,PAD+dx,PAD+dy);r.filter='none';
 r.globalCompositeOperation='source-in';r.fillStyle='rgb(225,255,250)';r.fillRect(0,0,rim.width,rim.height);r.globalCompositeOperation='destination-out';r.drawImage(img,PAD,PAD);
 return{shadow,rim};
}

export class TrashLayer{
 constructor(ocean,config,input,{count,seed=11}={}){
  this.input=input;
  this.ocean=ocean;this.cfg=config;this.canvas=document.createElement('canvas');this.canvas.className='trash-layer';this.canvas.setAttribute('aria-hidden','true');
  this.ctx=this.canvas.getContext('2d');
  this.boatCanvas=document.createElement('canvas');this.boatCanvas.className='boat-layer';this.boatCanvas.setAttribute('aria-hidden','true');
  this.boatCtx=this.boatCanvas.getContext('2d');
  this.rand=rng(seed);this.count=count;this.bodies=[];this.raf=0;this.last=0;this.sim={};this.wakeBudget=0;this.frameMs=0;this.steps=0;
  this.collected={plastik:0,metall:0,glas:0,rest:0};this.binFlash=[0,0,0,0];this.droplets=[];
  this.disturb=(x,y,a,r)=>ocean.surface.disturb(x,y,a,r);
 }
 async init(){
  this.sprites=await Promise.all(TRASH.map(async kind=>{const img=await load(kind.src);return{kind,img,...derived(img)};}));
  this.ocean.spray.before(this.canvas);this.ocean.root.append(this.boatCanvas);this.resize();this.spawn();
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(this.ocean.root);
  document.addEventListener('visibilitychange',()=>document.hidden?this.stop():this.start());
  this.start();return this;
 }
 get base(){return Math.max(21,Math.min(36,Math.min(this.ocean.width,this.playH())/390*25));}
 // Sichtbare Spielfeldhöhe (--play-h); das Wasser-Canvas ist bewusst höher und ragt unten über den Rand.
 playH(){const v=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--play-h'));return v>0?Math.min(this.ocean.height,v):this.ocean.height;}
 size(b){return this.base*b.kind.radius;}
 // Darstellung: realistische relative Größen der Draufsicht-Sprites (Physik bleibt bei size()).
 look(b){return this.base*(b.kind.look??b.kind.radius);}
 resize(){
  const o=this.ocean,dpr=Math.min(devicePixelRatio||1,2),w=Math.round(o.width*dpr),h=Math.round(o.height*dpr);this.dpr=dpr;
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  const ph=this.playH();if(this.w&&this.bodies.length){const sx=o.width/this.w,sy=ph/this.h;for(const b of this.bodies){b.x*=sx;b.y*=sy;}}
  this.w=o.width;this.h=ph;
  const bw=Math.round(o.width*dpr),bh=Math.round(o.height*dpr);
  if(this.boatCanvas.width!==bw||this.boatCanvas.height!==bh){this.boatCanvas.width=bw;this.boatCanvas.height=bh;}
  this.boat=layoutBoat(this.w,this.h);
  document.documentElement.style.setProperty('--stern',Math.round(this.boat.hullTop)+'px');
 }
 openY(){const reach=this.cfg.boat?.suctionRadius||68;return Math.max(160,(this.boat?.mouthY||this.h)-reach-16);}
 spawnOne(i){
  const idx=i??balancedOrder(1,this.rand)[0],kind=this.sprites[idx].kind,yMax=this.openY();
  let best=null,bestD=-1;
  for(let k=0;k<18;k++){const x=28+this.rand()*(this.w-56),y=70+this.rand()*Math.max(40,yMax-70);let d=1e9;for(const b of this.bodies)d=Math.min(d,Math.hypot(b.x-x,b.y-y));if(d>bestD){bestD=d;best={x,y};}}
  const b=createBody(kind,best.x,best.y,this.rand);b.sprite=this.sprites[idx];b.float={bob:0,dip:0,pitch:0,roll:0};
  if(i==null)b.fade=0;this.bodies.push(b);return b;
 }
 spawn(){
  const n=this.count??Math.round(Math.max(26,Math.min(38,this.w*this.h/10500)));
  for(const i of balancedOrder(n,this.rand))this.spawnOne(i);
 }
 start(){if(!this.raf&&!document.hidden){this.last=0;this.raf=requestAnimationFrame(t=>this.frame(t));}}
 stop(){cancelAnimationFrame(this.raf);this.raf=0;}
 frame(){
  const t0=performance.now(),now=t0,frameDt=Math.min(.1,(now-(this.last||now-16.7))/1000);this.last=now;this._frameDt=frameDt;
  const o=this.ocean,w=o.width,h=this.h||o.height,F=this.cfg.float;
  this.steps=advance(this.sim,this.bodies,(t,n)=>({width:w,height:h,now:n,t,pulses:o.pulses,
   flow:(x,y)=>this.input.flow.sample(x,y,n),size:b=>this.size(b),belts:this.boat,beltCfg:this.cfg.boat}),frameDt,now,this.cfg.drift,
   (dt,env)=>{for(const b of this.bodies){
     // Wippen/Kippen: Dünung + lokale Wellen (nur Auftrieb, keine Wanderung) + Wischwelle
     const sea=o.sample(b.x/w,b.y/h),wave=o.sampleLocalWaves(b.x/w,b.y/h,env.now),band=b.flow||{vx:0,vy:0,lift:0},motion=Math.hypot(b.vx,b.vy)/200;
     const tiltX=band.vx*.02,tiltY=band.vy*.02;
     b.float=displayFloat(stepBuoyancy(b,{...sea,pitch:(sea.pitch||0)-wave.slopeY*F.waveTilt-tiltY,roll:(sea.roll||0)+wave.slopeX*F.waveTilt+tiltX,motion},wave.height+(band.lift||0)*F.bandLift*.1,dt,o.reducedMotion),this.size(b),F);}},this.cfg.flow);
  this.input.flow.prune(now);
  this.harvest();this.ripples(frameDt,now);this.draw();this.drawStern();
  this.frameMs=this.frameMs*.95+(performance.now()-t0)*.05;
  this.raf=requestAnimationFrame(t=>this.frame(t));
 }
 ripples(dt,now){
  // gleitende Teile hinterlassen sparsam eine kleine Ripple (nur Optik, kaum Kraft)
  const k=this.cfg.float.wake,o=this.ocean;this.wakeBudget=Math.min(k.perSecond,this.wakeBudget+dt*k.perSecond);
  for(const b of this.bodies){if(isCarried(b))continue;const sp=Math.hypot(b.vx,b.vy);
   if(sp>k.minSpeed&&now-b.lastWake>k.interval&&this.wakeBudget>=1){this.wakeBudget-=1;b.lastWake=now;this.disturb(b.x/o.width,b.y/o.height,k.amp*(.6+b.kind.mass*.5),k.radius);}}
 }
 harvest(){
  const time=this.sim.time||0,kept=[];
  for(const b of this.bodies){
   if(b.justCaught){b.justCaught=false;this.burst(b.caughtX,b.caughtY,7,1);}
   if(b.justRejected){b.justRejected=false;this.burst(b.caughtX,b.caughtY,6,.7);}
   if(b.collected){this.collected[b.kind.category]=(this.collected[b.kind.category]||0)+1;if(b.rideBin!=null)this.binFlash[b.rideBin]=time+.5;continue;}
   kept.push(b);
  }
  const need=this.bodies.length-kept.length;this.bodies=kept;
  for(let i=0;i<need;i++)this.spawnOne();
  const dt=this._frameDt||0;
  for(const p of this.droplets){p.life+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=90*dt;}
  this.droplets=this.droplets.filter(p=>p.life<p.max);
  if(this.droplets.length>90)this.droplets.splice(0,this.droplets.length-90);
 }
 burst(x,y,n,power){
  for(let i=0;i<n;i++){const a=this.rand()*Math.PI*2,sp=(28+this.rand()*80)*power;
   this.droplets.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-36*power,life:0,max:.26+this.rand()*.3,r:1.2+this.rand()*1.8});}
  const o=this.ocean;if(o.width)this.disturb(x/o.width,y/o.height,.018*power,2.5);
  o.__originalSplashes?.(x/o.width,y/o.height,.4*power,5);
 }
 draw(){
  const c=this.ctx;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,this.canvas.width,this.canvas.height);
  for(const b of this.bodies)if(!isCarried(b))this.paintBody(b);
  c.globalAlpha=1;
 }
 paintBody(b,opts={}){
  const c=opts.ctx||this.ctx,dpr=this.dpr,size=this.look(b),f=b.float||{bob:0,dip:0,pitch:0,roll:0};
  const box=size*2.3,k=box/b.sprite.img.width,pw=b.sprite.shadow.width*k,ph=b.sprite.shadow.height*k;
  const carried=b.mode==='ride'||b.mode==='throw';
  const sway=carried?{x:0,y:Math.sin((this.sim.time||0)*14+(b.rideBin||0))*.7,scale:1}:seaSway(b,this.sim.time||0,this.cfg.sway);
  const mul=opts.scale||1,bob=opts.bob===false?0:f.bob;
  const sx=Math.cos((f.roll||0)*Math.PI/180)*(1-bob*.01)*sway.scale*mul;
  const sy=Math.cos((f.pitch||0)*Math.PI/180)*(1-bob*.01)*sway.scale*mul*(carried?0.78:1);
  const alpha=(opts.alpha??1)*(typeof b.fade==='number'?b.fade:1);
  const place=(dx,dy)=>{c.setTransform(dpr,0,0,dpr,0,0);c.translate(b.x+sway.x+dx,b.y+bob+sway.y+dy);c.rotate(b.angle+(f.roll||0)*.004);c.scale(sx,sy);};
  const lift=-bob,off=carried?size*.04:size*(.1+(b.kind.float-.5)*.06)+lift*.6;
  c.setTransform(dpr,0,0,dpr,0,0);c.translate(b.x+sway.x+(carried?off*.4:off),b.y+sway.y+(carried?off*.55:off*1.2));
  c.rotate(b.angle);c.scale(sx,sy);c.globalAlpha=(opts.shadow??.34)*alpha;c.drawImage(b.sprite.shadow,-pw/2,-ph/2,pw,ph);
  if(opts.rim!==false){place(0,size*.03);c.globalAlpha=(.26+Math.min(.2,(f.dip||0)*1.4)+(1-b.kind.float)*.12)*alpha;c.drawImage(b.sprite.rim,-pw/2,-ph/2,pw,ph);}
  place(0,0);c.globalAlpha=alpha;c.drawImage(b.sprite.img,-box/2,-box/2,box,box);
 }
 drawStern(){
  const c=this.boatCtx;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,this.boatCanvas.width,this.boatCanvas.height);
  if(!this.boat)return;
  drawBoat(c,{dpr:this.dpr,layout:this.boat,time:this.sim.time||0,bodies:this.bodies,beltCfg:this.cfg.boat,
   flashes:this.binFlash,droplets:this.droplets,paint:(b,o)=>this.paintBody(b,{...o,ctx:c})});
  c.globalAlpha=1;
 }
}

