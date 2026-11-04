// Frei treibender Müll im Objekt-Layer des Original-Meeres.
// Die Teile werden in ein Offscreen-Canvas gezeichnet, das water-13.0.0 unter der
// brechenden Oberfläche einblendet (setObjectsLayer(canvas,true,true)): Kaustiken,
// Lichtreflexe und Schaum liegen dadurch über dem Müll. Kein direktes Ziehen –
// der Finger bewegt nur das Wasser, das Wasser bewegt den Müll.
import {stepBuoyancy} from '../water-13.0.0/ocean.js';
import {TRASH} from './trash-catalog.js?v=20261104-trash1';
import {createBody,stepBodies,displayFloat} from './trash-physics.js?v=20261104-trash1';

const load=src=>new Promise((ok,fail)=>{const i=new Image();i.decoding='async';i.onload=()=>ok(i);i.onerror=()=>fail(new Error('Bild fehlt: '+src));i.src=src;});
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};

function shadowOf(img){
 // weicher, blauer Schlagschatten aus der eigenen Silhouette (Sonne oben links)
 const c=document.createElement('canvas');c.width=img.width+48;c.height=img.height+48;const g=c.getContext('2d');
 g.filter='blur(9px)';g.drawImage(img,24,24);g.filter='none';g.globalCompositeOperation='source-in';g.fillStyle='rgb(0,38,58)';g.fillRect(0,0,c.width,c.height);return c;
}

export class TrashLayer{
 constructor(ocean,{count,seed=11}={}){
  this.ocean=ocean;this.canvas=document.createElement('canvas');this.ctx=this.canvas.getContext('2d');
  this.rand=rng(seed);this.count=count;this.bodies=[];this.raf=0;this.last=0;this.wakeBudget=0;this.t=0;this.frameMs=0;
 }
 async init(){
  this.sprites=await Promise.all(TRASH.map(async kind=>{const img=await load(kind.src);return{kind,img,shadow:shadowOf(img)};}));
  this.resize();this.spawn();this.ocean.surface.setObjectsLayer(this.canvas,true,true);
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(this.ocean.root);
  document.addEventListener('visibilitychange',()=>document.hidden?this.stop():this.start());
  this.start();return this;
 }
 get base(){return Math.max(21,Math.min(36,this.ocean.width/390*25));}
 size(b){return this.base*b.kind.radius;}
 resize(){
  const o=this.ocean,w=Math.round(o.width*o.dpr),h=Math.round(o.height*o.dpr);
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
   const b=createBody(kind,best.x,best.y,this.rand);b.sprite=this.sprites[i];this.bodies.push(b);
  }
 }
 start(){if(!this.raf&&!document.hidden){this.last=0;this.raf=requestAnimationFrame(t=>this.frame(t));}}
 stop(){cancelAnimationFrame(this.raf);this.raf=0;}
 frame(now){
  const t0=performance.now(),dt=Math.min(.04,(now-(this.last||now-16.7))/1000);this.last=now;this.t+=dt;
  const o=this.ocean,w=o.width,h=o.height;
  stepBodies(this.bodies,{width:w,height:h,now:performance.now(),t:this.t,pulses:o.pulses,
   local:(x,y)=>o.sampleLocalWaves(x/w,y/h),swell:(x,y)=>o.sample(x/w,y/h),size:b=>this.size(b)},dt);
  this.wakeBudget=Math.min(4,this.wakeBudget+dt*3);
  this.draw(dt,now);
  this.frameMs=this.frameMs*.95+(performance.now()-t0)*.05;
  this.raf=requestAnimationFrame(t=>this.frame(t));
 }
 draw(dt,now){
  const o=this.ocean,c=this.ctx,dpr=o.dpr;
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,this.canvas.width,this.canvas.height);
  for(const b of this.bodies){
   const size=this.size(b),wave=b.wave,sea=b.sea,motion=Math.hypot(b.vx,b.vy)/260;
   const float=displayFloat(stepBuoyancy(b,{...sea,pitch:(sea.pitch||0)-wave.slopeY*320,roll:(sea.roll||0)+wave.slopeX*320,motion},wave.height,dt,o.reducedMotion),size);
   b.float=float;
   // Teile, die schnell durchs Wasser geschoben werden, wirken sparsam aufs Wasser zurück
   const speed=Math.hypot(b.vx,b.vy);
   if(speed>150&&now-b.lastWake>260&&this.wakeBudget>=1){this.wakeBudget-=1;b.lastWake=now;o.disturb(b.x/o.width,b.y/o.height,Math.min(.05,.012+speed*.00007)*b.kind.mass,2.6);}
   const box=size*2.3,sx=Math.cos(float.roll*Math.PI/180)*(1+float.bob*-.006),sy=Math.cos(float.pitch*Math.PI/180)*(1+float.bob*-.006);
   const place=(dx,dy)=>{c.setTransform(dpr,0,0,dpr,0,0);c.translate(b.x+dx,b.y+float.bob+dy);c.rotate(b.angle+float.roll*.006);c.scale(sx,sy);};
   // Schatten fällt nach unten rechts auf den Grund (Sonne oben links), unter Wasser weich gestreut
   const sh=b.sprite.shadow,k=box/b.sprite.img.width,off=size*(.16+(1-b.kind.float)*.05);
   place(off,off*1.15);c.globalAlpha=.30;c.drawImage(sh,-sh.width*k/2,-sh.height*k/2,sh.width*k,sh.height*k);
   place(0,0);
   // Teile, die tiefer liegen, wirken etwas mehr vom Wasser überspült
   c.globalAlpha=Math.max(.7,1-(1-b.kind.float)*.22-float.dip*.9);
   c.drawImage(b.sprite.img,-box/2,-box/2,box,box);c.globalAlpha=1;
  }
 }
}
