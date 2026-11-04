// Frei treibender Müll, sichtbar OBEN auf dem Wasser.
// Eigener Canvas über dem Wasser-Canvas (und unter der Gischt), d. h. Glanz und
// Brechung des Meeres liegen nicht über den Teilen. Kontakt zum Wasser: weicher
// Schatten nach unten rechts (Sonne oben links), heller Benetzungsrand und sparsame
// Mini-Ripples über ocean.disturb, wenn ein Teil durchs Wasser gleitet.
// Kein direktes Ziehen – der Finger bewegt das Wasser (Bugwelle + lokale
// Wischströmung aus swipe-input.js), die Strömung nimmt den Müll mit.
import {stepBuoyancy} from '../water-13.0.0/ocean.js';
import {TRASH} from './trash-catalog.js?v=20261104-full2';
import {createBody,advance,displayFloat} from './trash-physics.js?v=20261104-full2';

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
  this.ctx=this.canvas.getContext('2d');this.rand=rng(seed);this.count=count;this.bodies=[];this.raf=0;this.last=0;this.sim={};this.wakeBudget=0;this.frameMs=0;this.steps=0;
  this.disturb=(x,y,a,r)=>ocean.surface.disturb(x,y,a,r);
 }
 async init(){
  this.sprites=await Promise.all(TRASH.map(async kind=>{const img=await load(kind.src);return{kind,img,...derived(img)};}));
  this.ocean.spray.before(this.canvas);this.resize();this.spawn();
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(this.ocean.root);
  document.addEventListener('visibilitychange',()=>document.hidden?this.stop():this.start());
  this.start();return this;
 }
 get base(){return Math.max(21,Math.min(36,Math.min(this.ocean.width,this.ocean.height)/390*25));}
 size(b){return this.base*b.kind.radius;}
 resize(){
  const o=this.ocean,dpr=Math.min(devicePixelRatio||1,2),w=Math.round(o.width*dpr),h=Math.round(o.height*dpr);this.dpr=dpr;
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  if(this.w&&this.bodies.length){const sx=o.width/this.w,sy=o.height/this.h;for(const b of this.bodies){b.x*=sx;b.y*=sy;}}
  this.w=o.width;this.h=o.height;
 }
 spawn(){
  const n=this.count??Math.round(Math.max(26,Math.min(38,this.w*this.h/10500))),order=[];
  while(order.length<n)order.push(...this.sprites.map((_,i)=>i).sort(()=>this.rand()-.5));
  for(const i of order.slice(0,n)){
   const kind=this.sprites[i].kind;let best=null,bestD=-1;
   for(let k=0;k<18;k++){const x=30+this.rand()*(this.w-60),y=80+this.rand()*(this.h-120);let d=1e9;for(const b of this.bodies)d=Math.min(d,Math.hypot(b.x-x,b.y-y));if(d>bestD){bestD=d;best={x,y};}}
   const b=createBody(kind,best.x,best.y,this.rand);b.sprite=this.sprites[i];b.float={bob:0,dip:0,pitch:0,roll:0};this.bodies.push(b);
  }
 }
 start(){if(!this.raf&&!document.hidden){this.last=0;this.raf=requestAnimationFrame(t=>this.frame(t));}}
 stop(){cancelAnimationFrame(this.raf);this.raf=0;}
 frame(){
  const t0=performance.now(),now=t0,frameDt=Math.min(.1,(now-(this.last||now-16.7))/1000);this.last=now;
  const o=this.ocean,w=o.width,h=o.height,F=this.cfg.float;
  this.steps=advance(this.sim,this.bodies,(t,n)=>({width:w,height:h,now:n,t,pulses:o.pulses,
   flow:(x,y)=>this.input.flow.sample(x,y,n),size:b=>this.size(b)}),frameDt,now,this.cfg.drift,
   (dt,env)=>{for(const b of this.bodies){
     // Wippen/Kippen: Dünung + lokale Wellen (nur Auftrieb, keine Wanderung) + Wischwelle
     const sea=o.sample(b.x/w,b.y/h),wave=o.sampleLocalWaves(b.x/w,b.y/h,env.now),band=b.flow||{vx:0,vy:0,lift:0},motion=Math.hypot(b.vx,b.vy)/200;
     const tiltX=band.vx*.02,tiltY=band.vy*.02;
     b.float=displayFloat(stepBuoyancy(b,{...sea,pitch:(sea.pitch||0)-wave.slopeY*F.waveTilt-tiltY,roll:(sea.roll||0)+wave.slopeX*F.waveTilt+tiltX,motion},wave.height+(band.lift||0)*F.bandLift*.1,dt,o.reducedMotion),this.size(b),F);}},this.cfg.flow);
  this.input.flow.prune(now);
  this.ripples(frameDt,now);this.draw();
  this.frameMs=this.frameMs*.95+(performance.now()-t0)*.05;
  this.raf=requestAnimationFrame(t=>this.frame(t));
 }
 ripples(dt,now){
  // gleitende Teile hinterlassen sparsam eine kleine Ripple (nur Optik, kaum Kraft)
  const k=this.cfg.float.wake,o=this.ocean;this.wakeBudget=Math.min(k.perSecond,this.wakeBudget+dt*k.perSecond);
  for(const b of this.bodies){const sp=Math.hypot(b.vx,b.vy);
   if(sp>k.minSpeed&&now-b.lastWake>k.interval&&this.wakeBudget>=1){this.wakeBudget-=1;b.lastWake=now;this.disturb(b.x/o.width,b.y/o.height,k.amp*(.6+b.kind.mass*.5),k.radius);}}
 }
 draw(){
  const c=this.ctx,dpr=this.dpr;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,this.canvas.width,this.canvas.height);
  for(const b of this.bodies){
   const size=this.size(b),f=b.float,box=size*2.3,k=box/b.sprite.img.width,pw=b.sprite.shadow.width*k,ph=b.sprite.shadow.height*k;
   const sx=Math.cos(f.roll*Math.PI/180)*(1-f.bob*.01),sy=Math.cos(f.pitch*Math.PI/180)*(1-f.bob*.01);
   const place=(dx,dy)=>{c.setTransform(dpr,0,0,dpr,0,0);c.translate(b.x+dx,b.y+f.bob+dy);c.rotate(b.angle+f.roll*.004);c.scale(sx,sy);};
   // Schatten aufs Wasser: nach unten rechts, bei Hub (Teil höher) etwas weiter weg und weicher
   const lift=-f.bob,off=size*(.1+(b.kind.float-.5)*.06)+lift*.6;
   c.setTransform(dpr,0,0,dpr,0,0);c.translate(b.x+off,b.y+off*1.2);c.rotate(b.angle);c.scale(sx,sy);
   c.globalAlpha=.34;c.drawImage(b.sprite.shadow,-pw/2,-ph/2,pw,ph);
   // Benetzungsrand: helles Wasser, das sich am Teil wölbt (bei Eintauchen etwas stärker)
   place(0,size*.03);c.globalAlpha=.26+Math.min(.2,f.dip*1.4)+(1-b.kind.float)*.12;c.drawImage(b.sprite.rim,-pw/2,-ph/2,pw,ph);
   place(0,0);c.globalAlpha=1;c.drawImage(b.sprite.img,-box/2,-box/2,box,box);
  }
  c.globalAlpha=1;
 }
}

