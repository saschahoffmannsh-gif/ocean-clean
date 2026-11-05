// Meeresleben UNTER dem Müll-Canvas: Seegras, Quallen, Schildkröte, Fische.
// Wird nicht eingesammelt. Wischen beeinflusst nur die eigene Bewegung (life-sim.js).
import {LIFE_KINDS,createCreature,stepLife} from './life-sim.js?v=20261105-life4';

const load=src=>new Promise((ok,fail)=>{const i=new Image();i.decoding='async';i.onload=()=>ok(i);i.onerror=()=>fail(new Error('Bild fehlt: '+src));i.src=src;});
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};

export class LifeLayer{
 constructor(ocean,config,input,{seed=29}={}){
  this.ocean=ocean;this.cfg=config;this.input=input;this.rand=rng(seed);
  this.canvas=document.createElement('canvas');this.canvas.className='life-layer';this.canvas.setAttribute('aria-hidden','true');
  this.ctx=this.canvas.getContext('2d');this.creatures=[];this.raf=0;this.last=0;this.time=0;this.acc=0;
 }
 async init(){
  this.images={};await Promise.all(LIFE_KINDS.map(async k=>{this.images[k.name]=await load(k.src);}));
  this.resize();this.spawn();
  document.addEventListener('visibilitychange',()=>document.hidden?this.stop():this.start());
  this.start();return this;
 }
 playH(){const v=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--play-h'));return v>0?Math.min(this.ocean.height,v):this.ocean.height;}
 get base(){return Math.max(21,Math.min(36,Math.min(this.ocean.width,this.playH())/390*25));}
 resize(){
  const o=this.ocean,dpr=Math.min(devicePixelRatio||1,2),w=Math.round(o.width*dpr),h=Math.round(o.height*dpr);this.dpr=dpr;
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  const ph=this.playH();
  if(this.w&&this.creatures.length){const sx=o.width/this.w,sy=ph/this.h;for(const c of this.creatures){c.x*=sx;c.y*=sy;}}
  this.w=o.width;this.h=ph;
 }
 spawn(){
  const counts=this.cfg.life.counts,w=this.w,h=this.h,r=this.rand;
  const put=(name,n,band)=>{
   const kind=LIFE_KINDS.find(k=>k.name===name);
   for(let i=0;i<n;i++){
    let x=48+r()*(w-96),y=band?h*(.55+r()*.32):70+r()*(h-140);
    this.creatures.push(createCreature(kind,x,y,r));
   }
  };
  put('seegras',counts.seegras,true);
  put('qualle',counts.qualle,false);
  put('schildkroete',counts.schildkroete,false);
  put('sardine',counts.sardine,false);
  put('brasse',counts.brasse,false);
  put('makrele',counts.makrele,false);
 }
 start(){if(!this.raf&&!document.hidden){this.last=0;this.raf=requestAnimationFrame(()=>this.frame());}}
 stop(){cancelAnimationFrame(this.raf);this.raf=0;}
 frame(){
  const now=performance.now(),frameDt=Math.min(.05,(now-(this.last||now-16.7))/1000);this.last=now;
  const step=1/60,cfg=this.cfg.life,w=this.w||this.ocean.width,h=this.h||this.ocean.height;
  this.acc=Math.min(this.acc+frameDt,step*8);
  const flow=(x,y)=>this.input.flow.sample(x,y,now);
  while(this.acc>=step-1e-9){this.acc-=step;this.time+=step;
   stepLife(this.creatures,{width:w,height:h,t:this.time,flow},step,cfg);}
  this.draw();
  this.raf=requestAnimationFrame(()=>this.frame());
 }
 draw(){
  const c=this.ctx,dpr=this.dpr,base=this.base;
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,this.canvas.width,this.canvas.height);
  const order=['grass','jelly','turtle','fish'];
  const list=this.creatures.slice().sort((a,b)=>order.indexOf(a.kind.role)-order.indexOf(b.kind.role));
  for(const b of list){
   const img=this.images[b.kind.name];if(!img)continue;
   const size=base*b.kind.look,box=size*2.4;
   c.setTransform(dpr,0,0,dpr,0,0);
   if(b.kind.role==='grass'){
    c.translate(b.x,b.y);c.rotate(b.bend);c.globalAlpha=.92;
    c.drawImage(img,-box/2,-box*.92,box,box);
   }else if(b.kind.role==='jelly'){
    c.translate(b.x,b.y);c.rotate(Math.sin(this.time*.3+b.phase)*.15);
    c.scale(b.pulse,b.squash);c.globalAlpha=.88;
    c.drawImage(img,-box/2,-box/2,box,box);
   }else{
    c.translate(b.x,b.y);c.rotate(b.heading);c.globalAlpha=1;
    c.drawImage(img,-box/2,-box/2,box,box);
   }
  }
  c.globalAlpha=1;
 }
}
