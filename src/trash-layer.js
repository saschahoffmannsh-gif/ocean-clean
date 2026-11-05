// Frei treibender Müll, sichtbar OBEN auf dem Wasser, und vier Säcke unten.
// Eigener Canvas über dem Wasser-Canvas (und unter der Gischt). Kontakt zum Wasser:
// weicher Schatten, heller Benetzungsrand, sparsame Mini-Ripples.
// Kein direktes Ziehen – der Finger bewegt das Wasser, die Strömung nimmt den Müll mit.
// In die passende Sacköffnung geschoben, wird ein Teil eingesammelt. Falsche Kategorie
// prallt an der Lippe ab (Regel in sort-bags.js).
import {stepBuoyancy} from '../water-13.0.0/ocean.js';
import {TRASH,balancedOrder} from './trash-catalog.js?v=20261105-sacks8b';
import {createBody,advance,displayFloat,seaSway} from './trash-physics.js?v=20261105-sacks8b';
import {layoutBags,bagAccel,bagResolve,suctionFalloff,spawnCeiling} from './sort-bags.js?v=20261105-sacks8b';
import {drawBags,drawBagFx} from './bag-draw.js?v=20261105-sacks8b';

const load=src=>new Promise((ok,fail)=>{const i=new Image();i.decoding='async';i.onload=()=>ok(i);i.onerror=()=>fail(new Error('Bild fehlt: '+src));i.src=src;});
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const PAD=40;
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
  this.ctx=this.canvas.getContext('2d');this.rand=rng(seed);this.count=count;this.bodies=[];this.swallows=[];this.droplets=[];
  this.raf=0;this.last=0;this.sim={};this.wakeBudget=0;this.frameMs=0;this.steps=0;
  this.collected={plastik:0,metall:0,glas:0,rest:0};this.bagAnim=[];
  this.disturb=(x,y,a,r)=>ocean.surface.disturb(x,y,a,r);
 }
 async init(){
  this.sprites=await Promise.all(TRASH.map(async kind=>{const img=await load(kind.src);return{kind,img,...derived(img)};}));
  this.ocean.spray.before(this.canvas);this.resize();this.spawn();
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(this.ocean.root);
  document.addEventListener('visibilitychange',()=>document.hidden?this.stop():this.start());
  this.start();return this;
 }
 get base(){return Math.max(21,Math.min(36,Math.min(this.ocean.width,this.playH())/390*25));}
 playH(){const v=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--play-h'));return v>0?Math.min(this.ocean.height,v):this.ocean.height;}
 size(b){return this.base*b.kind.radius;}
 look(b){return this.base*(b.kind.look??b.kind.radius);}
 safeBottom(){
  if(!this._safe){const e=document.createElement('div');e.setAttribute('aria-hidden','true');
   e.style.cssText='position:fixed;left:0;bottom:0;width:0;height:env(safe-area-inset-bottom);pointer-events:none;visibility:hidden';
   document.body.append(e);this._safe=e;}
  return this._safe.offsetHeight||0;
 }
 resize(){
  const o=this.ocean,dpr=Math.min(devicePixelRatio||1,2),w=Math.round(o.width*dpr),h=Math.round(o.height*dpr);this.dpr=dpr;
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  const ph=this.playH();if(this.w&&this.bodies.length){const sx=o.width/this.w,sy=ph/this.h;for(const b of this.bodies){b.x*=sx;b.y*=sy;}}
  this.w=o.width;this.h=ph;this.layout();
 }
 layout(){
  this.bagGeom=layoutBags(this.w,this.h,{safeBottom:this.safeBottom()});
  if(this.bagAnim.length!==this.bagGeom.length)this.bagAnim=this.bagGeom.map(()=>({gulp:0,refuse:0,open:0,plus:0,burst:0,count:0}));
  const dock=Math.round(this.h-this.bagGeom[0].mouthTop);
  document.documentElement.style.setProperty('--dock-h',dock+'px');
 }
 spawn(){
  const n=this.count??Math.round(Math.max(26,Math.min(38,this.w*this.h/10500)));
  for(const i of balancedOrder(n,this.rand))this.place(i);
 }
 place(i){
  const kind=this.sprites[i].kind,lip=this.bagGeom[0].mouthTop,yHi=Math.max(130,Math.min(spawnCeiling(lip,this.cfg.sort.reach),this.h*.78));
  let best=null,bestD=-1;
  for(let k=0;k<18;k++){const x=30+this.rand()*(this.w-60),y=72+this.rand()*Math.max(36,yHi-72);let d=1e9;for(const b of this.bodies)d=Math.min(d,Math.hypot(b.x-x,b.y-y));if(d>bestD){bestD=d;best={x,y};}}
  const b=createBody(kind,best.x,best.y,this.rand);b.sprite=this.sprites[i];b.float={bob:0,dip:0,pitch:0,roll:0};this.bodies.push(b);return b;
 }
 start(){if(!this.raf&&!document.hidden){this.last=0;this.raf=requestAnimationFrame(t=>this.frame(t));}}
 stop(){cancelAnimationFrame(this.raf);this.raf=0;}
 frame(){
  const t0=performance.now(),now=t0,frameDt=Math.min(.1,(now-(this.last||now-16.7))/1000);this.last=now;
  const o=this.ocean,w=o.width,h=this.h||o.height,F=this.cfg.float,sort=this.cfg.sort;
  this.layout();
  for(let i=0;i<this.bagAnim.length;i++){
   const a=this.bagAnim[i],bag=this.bagGeom[i];let target=0;
   for(const b of this.bodies)target=Math.max(target,suctionFalloff(b,bag,sort));
   a.open+=(target-a.open)*Math.min(1,frameDt*8);
   a.gulp=Math.max(0,a.gulp-frameDt*1.7);a.refuse=Math.max(0,a.refuse-frameDt*2.15);
   a.plus=Math.max(0,a.plus-frameDt*.9);a.burst=Math.max(0,a.burst-frameDt*1.4);
  }
  this.steps=advance(this.sim,this.bodies,(t,n)=>({width:w,height:h,now:n,t,pulses:o.pulses,
   flow:(x,y)=>this.input.flow.sample(x,y,n),size:b=>this.size(b),bags:this.bagGeom,
   bagAccel:(b,env)=>bagAccel(b,env,sort,this.cfg.drift.edge),bagResolve:(b,env)=>bagResolve(b,env,sort)}),frameDt,now,this.cfg.drift,
   (dt,env)=>{for(const b of this.bodies){if(b.collected)continue;
     const sea=o.sample(b.x/w,b.y/h),wave=o.sampleLocalWaves(b.x/w,b.y/h,env.now),band=b.flow||{vx:0,vy:0,lift:0},motion=Math.hypot(b.vx,b.vy)/200;
     const tiltX=band.vx*.02,tiltY=band.vy*.02;
     b.float=displayFloat(stepBuoyancy(b,{...sea,pitch:(sea.pitch||0)-wave.slopeY*F.waveTilt-tiltY,roll:(sea.roll||0)+wave.slopeX*F.waveTilt+tiltX,motion},wave.height+(band.lift||0)*F.bandLift*.1,dt,o.reducedMotion),this.size(b),F);}},this.cfg.flow);
  this.settle();this.input.flow.prune(now);
  for(const s of this.swallows)s.t+=frameDt;this.swallows=this.swallows.filter(s=>s.t<s.dur);
  for(const p of this.droplets){p.life+=frameDt;p.x+=p.vx*frameDt;p.y+=p.vy*frameDt;p.vy+=80*frameDt;}
  this.droplets=this.droplets.filter(p=>p.life<p.max);
  this.ripples(frameDt,now);this.draw();
  this.frameMs=this.frameMs*.95+(performance.now()-t0)*.05;
  this.raf=requestAnimationFrame(t=>this.frame(t));
 }
 settle(){
  const kept=[];
  for(const b of this.bodies){
   const ev=b.sortEvent;b.sortEvent=null;
   if(ev?.type==='collect'){
    const a=this.bagAnim[ev.index];if(a){a.gulp=1;a.plus=1;a.burst=1;a.count++;}
    this.collected[b.kind.category]=(this.collected[b.kind.category]||0)+1;
    this.swallows.push({sprite:b.sprite,kind:b.kind,float:b.float,angle:b.angle,spin:b.spin,x0:b.x,y0:b.y,index:ev.index,t:0,dur:.52,swayPhase:b.swayPhase});
    const g=this.bagGeom[ev.index];this.burst(g.cx,g.mouthTop+g.mouthH*.4,6,.75);
   }else if(ev?.type==='reject'){
    const a=this.bagAnim[ev.index];if(a)a.refuse=1;
    const g=this.bagGeom[ev.index];this.burst(b.x,g.mouthTop,5,.5);
   }
   if(!b.collected)kept.push(b);
  }
  this.bodies=kept;
 }
 burst(x,y,n,power){
  for(let i=0;i<n;i++){const a=this.rand()*Math.PI*2,sp=(20+this.rand()*50)*power;
   this.droplets.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-18*power,life:0,max:.28+this.rand()*.22,r:1.1+this.rand()*1.4});}
  if(this.droplets.length>80)this.droplets.splice(0,this.droplets.length-80);
  const o=this.ocean;if(o.width)this.disturb(x/o.width,y/o.height,.016*power,2.3);
 }
 ripples(dt,now){
  const k=this.cfg.float.wake,o=this.ocean;this.wakeBudget=Math.min(k.perSecond,this.wakeBudget+dt*k.perSecond);
  for(const b of this.bodies){const sp=Math.hypot(b.vx,b.vy);
   if(sp>k.minSpeed&&now-b.lastWake>k.interval&&this.wakeBudget>=1){this.wakeBudget-=1;b.lastWake=now;this.disturb(b.x/o.width,b.y/o.height,k.amp*(.6+b.kind.mass*.5),k.radius);}}
 }
 paintBody(b,opts={}){
  const c=opts.ctx||this.ctx,dpr=this.dpr,size=this.look(b),f=b.float||{bob:0,dip:0,pitch:0,roll:0};
  const box=size*2.3,k=box/b.sprite.img.width,pw=b.sprite.shadow.width*k,ph=b.sprite.shadow.height*k;
  const sway=opts.sway||seaSway(b,this.sim.time||0,this.cfg.sway);
  const mul=opts.scale??1,bob=opts.bob===false?0:f.bob;
  const sx=Math.cos((f.roll||0)*Math.PI/180)*(1-bob*.01)*sway.scale*mul;
  const sy=Math.cos((f.pitch||0)*Math.PI/180)*(1-bob*.01)*sway.scale*mul;
  const alpha=opts.alpha??1,x=(opts.x??b.x)+sway.x,y=(opts.y??b.y)+sway.y,angle=opts.angle??b.angle;
  const place=(dx,dy)=>{c.setTransform(dpr,0,0,dpr,0,0);c.translate(x+dx,y+bob+dy);c.rotate(angle+(f.roll||0)*.004);c.scale(sx,sy);};
  const lift=-bob,off=size*(.1+(b.kind.float-.5)*.06)+lift*.6;
  c.setTransform(dpr,0,0,dpr,0,0);c.translate(x+off,y+off*1.2);c.rotate(angle);c.scale(sx,sy);
  c.globalAlpha=.34*alpha;c.drawImage(b.sprite.shadow,-pw/2,-ph/2,pw,ph);
  place(0,size*.03);c.globalAlpha=(.26+Math.min(.2,(f.dip||0)*1.4)+(1-b.kind.float)*.12)*alpha;c.drawImage(b.sprite.rim,-pw/2,-ph/2,pw,ph);
  place(0,0);c.globalAlpha=alpha;c.drawImage(b.sprite.img,-box/2,-box/2,box,box);
 }
 paintSwallow(s){
  const bag=this.bagGeom[s.index];if(!bag)return;
  const u=Math.min(1,s.t/s.dur),e=u*u*(3-2*u);
  const x=s.x0+(bag.cx-s.x0)*e,y=s.y0+(bag.mouthTop+bag.mouthH*.45-s.y0)*e;
  const wob=seaSway({swayPhase:s.swayPhase},this.sim.time||0,this.cfg.sway),damp=1-e;
  this.paintBody({sprite:s.sprite,kind:s.kind,float:s.float,angle:s.angle+s.spin*s.t+e*.9},
   {x,y,scale:1-e*.88,alpha:u<.58?1:Math.max(0,1-(u-.58)/.42),sway:{x:wob.x*damp,y:wob.y*damp,scale:1+(wob.scale-1)*damp}});
 }
 draw(){
  const c=this.ctx,dpr=this.dpr;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,this.canvas.width,this.canvas.height);
  c.setTransform(dpr,0,0,dpr,0,0);drawBags(c,this.bagGeom,this.bagAnim,this.sim.time||0);
  for(const b of this.bodies)this.paintBody(b);
  for(const s of this.swallows)this.paintSwallow(s);
  c.setTransform(dpr,0,0,dpr,0,0);drawBagFx(c,this.bagGeom,this.bagAnim);
  c.setTransform(dpr,0,0,dpr,0,0);
  for(const p of this.droplets){const u=1-p.life/p.max;c.globalAlpha=Math.max(0,u)*.75;c.fillStyle='rgba(232,252,255,.95)';c.beginPath();c.arc(p.x,p.y,p.r,0,7);c.fill();}
  c.globalAlpha=1;
 }
}
