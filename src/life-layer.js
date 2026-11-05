// Meeresleben UNTER der Wasseroberfläche und unter dem Müll.
// Eigener Canvas: Tiere etwas dunkel, leicht unscharf, mit wandernden Kaustiken.
// Kein Auflageschatten — der gehört nur zum Müll auf der Oberfläche.
import {LIFE_KINDS,createCreature,stepLife} from './life-sim.js?v=20261105-life5';

const load=src=>new Promise((ok,fail)=>{const i=new Image();i.decoding='async';i.onload=()=>ok(i);i.onerror=()=>fail(new Error('Bild fehlt: '+src));i.src=src;});
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};

export class LifeLayer{
 constructor(ocean,config,input,{seed=29}={}){
  this.ocean=ocean;this.cfg=config;this.input=input;this.rand=rng(seed);
  this.canvas=document.createElement('canvas');this.canvas.className='life-layer';this.canvas.setAttribute('aria-hidden','true');
  this.ctx=this.canvas.getContext('2d');
  this.buf=document.createElement('canvas');this.bctx=this.buf.getContext('2d');
  this.creatures=[];this.raf=0;this.last=0;this.time=0;this.acc=0;
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
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.buf.width=w;this.buf.height=h;}
  const ph=this.playH();
  if(this.w&&this.creatures.length){const sx=o.width/this.w,sy=ph/this.h;for(const c of this.creatures){c.x*=sx;c.y*=sy;}}
  this.w=o.width;this.h=ph;
 }
 spawn(){
  const counts=this.cfg.life.counts,w=this.w,h=this.h,r=this.rand;
  const put=(name,n)=>{
   const kind=LIFE_KINDS.find(k=>k.name===name);
   for(let i=0;i<n;i++)this.creatures.push(createCreature(kind,48+r()*(w-96),70+r()*(h-140),r));
  };
  put('qualle',counts.qualle);
  put('schildkroete',counts.schildkroete);
  put('sardine',counts.sardine);
  put('makrele',counts.makrele);
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
  const c=this.bctx,dpr=this.dpr,base=this.base,L=this.cfg.life;
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,this.buf.width,this.buf.height);
  const order={jelly:0,turtle:1,fish:2};
  const list=this.creatures.slice().sort((a,b)=>order[a.kind.role]-order[b.kind.role]);
  for(const b of list){
   const img=this.images[b.kind.name];if(!img)continue;
   const size=base*b.kind.look,box=size*2.35;
   c.setTransform(dpr,0,0,dpr,0,0);c.translate(b.x,b.y);
   if(b.kind.role==='jelly'){c.scale(b.pulse,b.squash);c.globalAlpha=.9;}
   else{c.rotate(b.heading);c.globalAlpha=1;}
   c.drawImage(img,-box/2,-box/2,box,box);
  }
  const o=this.ctx;o.setTransform(1,0,0,1,0,0);o.clearRect(0,0,this.canvas.width,this.canvas.height);
  o.save();o.filter=`blur(${L.blur}px)`;o.globalAlpha=L.alpha;o.drawImage(this.buf,0,0);o.restore();
  // Nur auf den Tieren: kühles Wasser und wandernde Kaustik, nichts auf leerem Grund.
  o.save();o.globalCompositeOperation='source-atop';
  o.fillStyle=`rgba(6,42,72,${L.tint})`;o.fillRect(0,0,this.w,this.h);
  o.globalAlpha=L.caustic;
  const t=this.time;
  for(let i=0;i<6;i++){
   const x=(this.w*(.12+i*.15)+Math.sin(t*.55+i*1.4)*this.w*.08)%this.w;
   const y=(this.h*(.18+(i%3)*.28)+Math.cos(t*.4+i)*this.h*.06)%this.h;
   const g=o.createRadialGradient(x,y,2,x,y,78);
   g.addColorStop(0,'rgba(236,255,252,.95)');g.addColorStop(1,'rgba(236,255,252,0)');
   o.fillStyle=g;o.beginPath();o.arc(x,y,78,0,Math.PI*2);o.fill();
  }
  o.restore();
 }
}
