// Physik des Müllhaufens: Tiefe, Wühlen, Auftrieb, Greifen, Fallenlassen.
// z = 0 ist die Oberfläche, negativ unter Wasser. Ohne DOM, testbar mit node --test.
// Die Wischströmung ist nur ein schwacher Rest. Der Finger schiebt und hebt selbst.
import {BASE_CONFIG} from './config.js';
import {SHEAR_X,SHEAR_Z} from './pile-pose.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const STILL={vx:0,vy:0,weight:0};

export const PILE_KINDS=Object.freeze([
 Object.freeze({key:'plastik:pet-flasche',category:'plastik',name:'pet-flasche',label:'PET-Flasche',mass:.34,long:1.08,thick:.84,radius:16,mid:.16}),
 Object.freeze({key:'metall:dose',category:'metall',name:'dose',label:'Getränkedose',mass:.52,long:.76,thick:1.16,radius:17,mid:.24}),
 Object.freeze({key:'glas:gruene-flasche',category:'glas',name:'gruene-flasche',label:'Glasflasche',mass:.74,long:1.14,thick:.8,radius:15.5,mid:.15})
]);

export function mulberry32(seed){
 let s=seed|0;
 return()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
}

export function createPileBody(kind,x,y,z,rand=Math.random,radiusScale=1){
 return{kind,x,y,z,vx:0,vy:0,vz:0,radius:kind.radius*radiusScale,
  angle:rand()*Math.PI*2,spin:(rand()-.5)*.2,spinBias:(rand()<.5?-1:1)*(.55+rand()*.7),
  swayPhase:((x*.017+y*.013)%1+1)%1*Math.PI*2,
  held:false,prevZ:z,
  heave:NaN,heaveSpeed:0,draft:0,pitch:0,roll:0,pitchSpeed:0,rollSpeed:0,
  float:null,hitWater:false};
}

export function layoutPile(w,h){
 const base=Math.max(28,Math.min(42,Math.min(w,h)/390*34));
 const pileR=Math.max(120,Math.min(220,Math.min(w,h)*.36));
 const n=Math.round(Math.max(42,Math.min(58,Math.min(w,h)/7.6)));
 return{cx:w*.5,cy:h*.47,pileR,n,base,radiusScale:base/30};
}

function shuffle(a,rand){
 for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
 return a;
}

export function spawnPile({kinds=PILE_KINDS,n,cx,cy,pileR,thick,rand,radiusScale=1}){
 const order=[];
 while(order.length<n)for(const k of shuffle([0,1,2],rand))if(order.length<n)order.push(k);
 const anchors=Math.max(10,Math.round(n/3.1)),slots=[];
 for(let a=0;a<anchors;a++){
  const t=(a+.5)/anchors,rad=pileR*(.05+.9*Math.sqrt(t));
  const layers=rad<pileR*.36?4:rad<pileR*.66?3:2;
  slots.push({rad,layers,ang:a*2.399963});
 }
 let total=slots.reduce((s,x)=>s+x.layers,0);
 while(total>n){const slot=slots[slots.length-1-(total%slots.length)];if(slot.layers>1){slot.layers--;total--;}else break;}
 while(total<n){slots[total%Math.min(5,slots.length)].layers++;total++;}
 const bodies=[];let idx=0;
 for(const slot of slots)for(let s=0;s<slot.layers&&idx<n;s++){
  const kind=kinds[order[idx++]];
  const j=(s===0?.28:.7)*kind.radius*radiusScale,jang=rand()*Math.PI*2;
  const x=cx+Math.cos(slot.ang)*slot.rad+Math.cos(jang)*j*(.25+rand()*.75);
  const y=cy+Math.sin(slot.ang)*slot.rad*.9+Math.sin(jang)*j*(.25+rand()*.75);
  const z=-s*thick+(rand()-.5)*1.4;
  bodies.push(createPileBody(kind,x,y,z,rand,radiusScale));
 }
 return bodies;
}

export function isFree(body,bodies,cfg=BASE_CONFIG.pile){
 if(!body||body.held)return false;
 if(body.z<cfg.grabBand)return false;
 for(const other of bodies){
  if(other===body||other.held)continue;
  if(other.z<body.z+cfg.thick*.32)continue;
  if(Math.hypot(other.x-body.x,other.y-body.y)<(other.radius+body.radius)*cfg.cover)return false;
 }
 return true;
}

// Abstand zum liegenden Teil: entlang der Längsachse eine Kapsel, seitlich der Radius.
export function touchDistance(body,x,y,longPx=0){
 const dx=x-body.x,dy=y-body.y;
 if(!(longPx>0))return Math.hypot(dx,dy);
 const hx=Math.cos(body.angle),hy=Math.sin(body.angle);
 const along=dx*hx+dy*hy,side=-dx*hy+dy*hx;
 const half=longPx*(body.kind?.long||1)*.46;
 const ca=clamp(along,-half,half);
 return Math.hypot(along-ca,side);
}

// Sichtbare Mitte: das Netz steht über dem Auflagepunkt, die Scherung rückt es nach links oben.
export function visualAnchor(body,longPx=0){
 const h=(longPx||0)*(body.kind?.mid||0)*(body.kind?.thick||1)+Math.max(0,body.z||0);
 return{x:body.x+h*SHEAR_X,y:body.y+h*SHEAR_Z};
}

function grabReach(body,cfg,longPx){
 const tube=longPx>0?longPx*(body.kind?.thick||1)*.4:0;
 return Math.max(body.radius*cfg.grabInner,tube);
}

// Greift das oberste Teil, dessen Körper den Punkt trifft. Liegt dort nichts Freies, bleibt es beim Wühlen.
export function grabTarget(x,y,bodies,cfg=BASE_CONFIG.pile,longPx=0){
 let best=null;
 for(const b of bodies){
  if(b.held||b.z<cfg.grabBand)continue;
  const p=visualAnchor(b,longPx);
  const d=touchDistance({...b,x:p.x,y:p.y},x,y,longPx);
  if(d>grabReach(b,cfg,longPx))continue;
  // Verdeckt: ein klar höheres Teil liegt über derselben Stelle.
  let covered=false;
  for(const o of bodies){
   if(o===b||o.held||o.z<b.z+cfg.thick*.32)continue;
   const q=visualAnchor(o,longPx);
   if(touchDistance({...o,x:q.x,y:q.y},x,y,longPx)<=grabReach(o,cfg,longPx)*.72){covered=true;break;}
  }
  if(covered)continue;
  if(!best||b.z>best.b.z+1||(Math.abs(b.z-best.b.z)<=1&&d<best.d))best={b,d};
 }
 return best?.b??null;
}

export function ceiling(body,bodies,cfg=BASE_CONFIG.pile){
 let cap=0;
 for(const other of bodies){
  if(other===body||other.held)continue;
  if(other.z<=body.z+1.2)continue;
  if(Math.hypot(other.x-body.x,other.y-body.y)>=(other.radius+body.radius)*cfg.cover)continue;
  cap=Math.min(cap,other.z-cfg.thick);
 }
 return cap;
}

export function countFree(bodies,cfg=BASE_CONFIG.pile){
 let free=0,buried=0;
 for(const b of bodies)if(isFree(b,bodies,cfg))free++;else buried++;
 return{free,buried};
}

function separate(bodies,cfg){
 for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
  const a=bodies[i],c=bodies[j];
  if(a.held||c.held)continue;
  let dx=c.x-a.x,dy=c.y-a.y,d2=dx*dx+dy*dy;
  const allow=clamp(Math.abs(a.z-c.z)/cfg.thick,0,1);
  const min=(a.radius+c.radius)*(1-cfg.stackOverlap*allow);
  if(d2>=min*min)continue;
  let d=Math.sqrt(d2);
  if(d<1e-3){dx=1;dy=0;d=1e-3;}
  const f=(1-d/min)*cfg.separate,ux=dx/d,uy=dy/d;
  const ia=.95/(a.kind.mass+cfg.inertia),ic=.95/(c.kind.mass+cfg.inertia);
  a.ax-=ux*f*ia;a.ay-=uy*f*ia;c.ax+=ux*f*ic;c.ay+=uy*f*ic;
 }
}

export function stepPile(bodies,env,dt,cfg=BASE_CONFIG.pile){
 const {width:w,height:h}=env,finger=env.finger&&env.finger.active?env.finger:null;
 const hold=!!(finger&&finger.holding);
 for(const b of bodies){
  b.hitWater=false;
  const inv=.95/(b.kind.mass+cfg.inertia);
  if(b.held&&finger){
   const k=cfg.holdK;
   b.ax=(finger.x-b.x)*k*k-b.vx*2*k;
   b.ay=(finger.y-b.y)*k*k-b.vy*2*k;
   b.az=(cfg.holdLift-b.z)*k*k-b.vz*2*k;
   continue;
  }
  const time=env.t||0;
  let ax=Math.sin(b.y*.013+time*.17)*1.6*inv,ay=Math.cos(b.x*.011-time*.15)*1.3*inv;
  const cap0=ceiling(b,bodies,cfg);
  let cap=cap0;
  const exposure=clamp(1+b.z/(cfg.thick*2.4),.2,1);
  if(finger&&!hold){
   const dx=b.x-finger.x,dy=b.y-finger.y,d=Math.hypot(dx,dy),R=cfg.rummageRadius;
   if(d<R){
    const t=1-d/R,wt=t*t,speed=Math.hypot(finger.vx,finger.vy);
    const rx=d>1e-3?dx/d:1,ry=d>1e-3?dy/d:0;
    if(speed>=36){
     const fx=finger.vx/speed,fy=finger.vy/speed,side=fx*dy-fy*dx,sign=side>=0?1:-1;
     const px=-fy*sign,py=fx*sign;
     const dirx=px*.8+rx*.32,diry=py*.8+ry*.32,norm=Math.hypot(dirx,diry)||1;
     const push=cfg.push*wt*exposure*(.3+.7*Math.min(1,speed/460))*inv;
     ax+=dirx/norm*push;ay+=diry/norm*push;
    }else if(d>8){ax+=rx*cfg.dwell*wt*inv;ay+=ry*cfg.dwell*wt*inv;}
    cap=Math.min(0,cap0+cfg.dig*wt*(speed<36?.4:.55+.45*Math.min(1,speed/480)));
   }
  }
  const flow=env.flow?env.flow(b.x,b.y):STILL;
  if(flow&&flow.weight>0){
   const k=cfg.ambientCoupling*flow.weight*exposure;
   ax+=(flow.vx*cfg.ambient-b.vx)*k;ay+=(flow.vy*cfg.ambient-b.vy)*k;
  }
  const m=b.radius*1.05;
  if(b.x<m)ax+=(m-b.x)/m*cfg.edge*inv;if(b.x>w-m)ax-=(b.x-(w-m))/m*cfg.edge*inv;
  if(b.y<m+28)ay+=(m+28-b.y)/(m+28)*cfg.edge*inv;if(b.y>h-m)ay-=(b.y-(h-m))/m*cfg.edge*inv;
  if(env.cx!=null){
   const gx=env.cx-b.x,gy=env.cy-b.y,gd=Math.hypot(gx,gy);
   if(gd>env.pileR){const s=cfg.gather*(gd-env.pileR)/env.pileR;ax+=gx/gd*s;ay+=gy/gd*s;}
  }
  let az;
  if(b.z>0)az=-cfg.gravity;
  else az=(Math.min(0,cap)-b.z)*cfg.rise-b.vz*cfg.riseDamp;
  b.ax=ax;b.ay=ay;b.az=az;
 }
 separate(bodies,cfg);
 const damp=Math.exp(-cfg.drag*dt),spinKeep=Math.exp(-cfg.spinDrag*dt),zDamp=Math.exp(-cfg.riseDamp*.35*dt);
 for(const b of bodies){
  const prev=b.z;
  if(b.held){
   b.vx+=b.ax*dt;b.vy+=b.ay*dt;b.vz+=b.az*dt;
  }else{
   b.vx=(b.vx+b.ax*dt)*damp;b.vy=(b.vy+b.ay*dt)*damp;
   b.vz=(b.vz+b.az*dt)*(b.z>0?Math.exp(-2.2*dt):zDamp);
   const sp=Math.hypot(b.vx,b.vy);
   if(sp>cfg.maxSpeed){b.vx*=cfg.maxSpeed/sp;b.vy*=cfg.maxSpeed/sp;}
  }
  b.x=clamp(b.x+b.vx*dt,-30,w+30);b.y=clamp(b.y+b.vy*dt,-30,h+30);
  b.z+=b.vz*dt;
  if(!b.held){
   if(b.z>0&&b.vz>0){b.z=0;b.vz=0;}
   if(b.z<cfg.floor){b.z=cfg.floor;b.vz=0;}
  }
  b.hitWater=!b.held&&prev>3&&b.z<=0;
  b.prevZ=b.z;
  const signed=b.vx*.9-b.vy*.34;
  let target=b.spinBias*cfg.idleSpin+signed*cfg.spin;
  if(b.held)target=b.spinBias*1.35;
  b.spin=clamp(target+(b.spin-target)*spinKeep,-cfg.maxSpin,cfg.maxSpin);
  b.angle+=b.spin*dt;
 }
}

export function advancePile(sim,bodies,envAt,frameDt,frameNow,cfg=BASE_CONFIG.pile){
 const step=1/120;sim.acc=Math.min((sim.acc||0)+frameDt,step*10);let n=0;
 while(sim.acc>=step-1e-9){sim.acc-=step;sim.time=(sim.time||0)+step;
  stepPile(bodies,envAt(sim.time,frameNow-Math.max(0,sim.acc)*1000),step,cfg);n++;}
 return n;
}
