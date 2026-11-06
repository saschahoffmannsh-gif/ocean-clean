// Physik des Müllhaufens auf der Wasserfläche. Nichts liegt darunter.
// Harte Kapseln: die Teile stoßen sich, gehen aber nicht durcheinander.
// Ohne DOM, testbar mit node --test.
import {BASE_CONFIG} from './config.js';
import {MESH_UNITS,SHEAR_X,SHEAR_Z} from './pile-pose.js';
import {PILE_KINDS,colliderOf} from './item-mesh.js?v=20261106-v6';

export {PILE_KINDS};

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

export function mulberry32(seed){
 let s=seed|0;
 return()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
}

// Kapsel in Pixeln. tube ist die Auflage, stackH die Höhe, auf der das nächste Teil liegt.
export function bodyShape(kind,radiusScale=1){
 const px=30*radiusScale*MESH_UNITS*(kind.fit||1);
 const c=colliderOf(kind.key)||{halfLen:.2,tube:.08,stackH:.12};
 return{halfLen:Math.max(0,c.halfLen*px),tube:Math.max(4,c.tube*px),stackH:Math.max(3,c.stackH*px)};
}

export function createPileBody(kind,x,y,z,rand=Math.random,radiusScale=1){
 const shape=bodyShape(kind,radiusScale);
 return{kind,x,y,z:z>0?z:0,vx:0,vy:0,vz:0,radius:shape.tube+4,halfLen:shape.halfLen,tube:shape.tube,stackH:shape.stackH,
  angle:rand()*Math.PI*2,spin:0,spinBias:(rand()<.5?-1:1)*(.55+rand()*.7),
  swayPhase:((x*.017+y*.013)%1+1)%1*Math.PI*2,
  held:false,prevZ:0,
  heave:NaN,heaveSpeed:0,draft:0,pitch:0,roll:0,pitchSpeed:0,rollSpeed:0,
  float:null,hitWater:false};
}

function shuffle(a,rand){
 for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
 return a;
}

export function layoutPile(w,h){
 const base=Math.max(26,Math.min(36,Math.min(w,h)/390*30));
 const grid=carpetGrid(w,h);
 const cells=grid.cols*grid.rows;
 // Zwei Lagen über die ganze Fläche. Deckel, damit ein breiter Monitor nicht hunderte Netze zeichnet.
 const n=Math.min(260,cells*2+Math.round(cells*.35));
 return{cx:w*.5,cy:h*.5,pileR:Math.min(w,h),n,base,radiusScale:base/30,width:w,height:h};
}

export function carpetGrid(w,h){
 const margin=14,top=76;
 const x0=margin,x1=Math.max(x0+40,w-margin),y0=top,y1=Math.max(y0+40,h-margin);
 const cols=Math.max(5,Math.round((x1-x0)/72)),rows=Math.max(8,Math.round((y1-y0)/80));
 return{x0,x1,y0,y1,cols,rows};
}

export function spawnPile({kinds=PILE_KINDS,n,width=390,height=844,rand,radiusScale=1}){
 const order=[];
 while(order.length<n)for(const k of shuffle(kinds.map((_,i)=>i),rand))if(order.length<n)order.push(k);
 const {x0,x1,y0,y1,cols,rows}=carpetGrid(width,height);
 const cells=[];
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
  const brick=r%2?0.5:0;
  cells.push({
   x:x0+((c+.5+brick)%cols)/cols*(x1-x0),y:y0+(r+.5)/rows*(y1-y0)
  });
 }
 const tops=cells.map(()=>null),bodies=[];
 for(let i=0;i<n;i++){
  const idx=i%cells.length,cell=cells[idx],under=tops[idx];
  const kind=kinds[order[i]];
  const b=createPileBody(kind,cell.x,cell.y,0,rand,radiusScale);
  b.z=under?under.z+under.stackH*.96:0;
  const reach=under?Math.min(6,under.tube*.22):2.4;
  b.x+=(rand()-.5)*reach;b.y+=(rand()-.5)*reach;
  tops[idx]=b;bodies.push(b);
 }
 return bodies;
}

export function isFree(body,bodies){
 if(!body||body.held)return false;
 if(!bodies)return body.z>=-0.5;
 for(const other of bodies){
  if(other===body||other.held)continue;
  if(other.z<body.z+(body.stackH||12)*.4)continue;
  if(touchDistance(other,body.x,body.y)<(other.tube||8)*.85)return false;
 }
 return true;
}

function axisPoint(body,t){
 const hx=Math.cos(body.angle||0),hy=Math.sin(body.angle||0),L=body.halfLen||0;
 return{x:body.x+hx*L*t,y:body.y+hy*L*t};
}
function closestOnAxis(body,x,y){
 const hx=Math.cos(body.angle||0),hy=Math.sin(body.angle||0),L=body.halfLen||0;
 if(L<1e-3)return{x:body.x,y:body.y};
 const t=clamp(((x-body.x)*hx+(y-body.y)*hy)/L,-1,1);
 return axisPoint(body,t);
}

// Abstand vom Punkt zur Mittelachse der Kapsel.
export function touchDistance(body,x,y){
 const p=closestOnAxis(body,x,y);
 return Math.hypot(x-p.x,y-p.y);
}

export function visualAnchor(body,longPx=0){
 const h=(longPx||0)*(body.kind?.mid||0)*(body.kind?.thick||1)+Math.max(0,body.z||0);
 return{x:body.x+h*SHEAR_X,y:body.y+h*SHEAR_Z};
}

function segEnds(body){
 const hx=Math.cos(body.angle||0),hy=Math.sin(body.angle||0),L=body.halfLen||0;
 return{ax:body.x-hx*L,ay:body.y-hy*L,bx:body.x+hx*L,by:body.y+hy*L};
}
// Stabile nächste Punkte zweier Strecken (Ericson). pen > 0 = die Kapseln schneiden sich.
export function capsulePair(a,c){
 const A=segEnds(a),C=segEnds(c);
 const d1x=A.bx-A.ax,d1y=A.by-A.ay,d2x=C.bx-C.ax,d2y=C.by-C.ay;
 const rx=A.ax-C.ax,ry=A.ay-C.ay;
 const aa=d1x*d1x+d1y*d1y,e=d2x*d2x+d2y*d2y,f=d2x*rx+d2y*ry;
 let s,t;
 if(aa<=1e-8&&e<=1e-8){s=0;t=0;}
 else if(aa<=1e-8){s=0;t=clamp(f/e,0,1);}
 else{
  const cc=d1x*rx+d1y*ry;
  if(e<=1e-8){t=0;s=clamp(-cc/aa,0,1);}
  else{
   const b=d1x*d2x+d1y*d2y,denom=aa*e-b*b;
   s=denom>1e-8?clamp((b*f-cc*e)/denom,0,1):0;
   t=(b*s+f)/e;
   if(t<0){t=0;s=clamp(-cc/aa,0,1);}
   else if(t>1){t=1;s=clamp((b-cc)/aa,0,1);}
  }
 }
 const px=A.ax+d1x*s,py=A.ay+d1y*s,qx=C.ax+d2x*t,qy=C.ay+d2y*t;
 let dx=qx-px,dy=qy-py,d=Math.hypot(dx,dy);
 if(d<1e-3){
  const nx=-d1y,ny=d1x,nl=Math.hypot(nx,ny)||1;
  dx=nx/nl;dy=ny/nl;d=1;
 }
 const min=(a.tube||0)+(c.tube||0);
 return{dx,dy,d,min,pen:min-d,ux:dx/d,uy:dy/d};
}

export function grabTarget(x,y,bodies){
 let best=null;
 for(const b of bodies){
  if(b.held)continue;
  const d=touchDistance(b,x,y);
  if(d>(b.tube||0)*1.15)continue;
  if(!best||b.z>best.b.z+1||(Math.abs(b.z-best.b.z)<=1&&d<best.d))best={b,d};
 }
 return best?.b??null;
}

export function ceiling(){return 0;}

export function countFree(bodies){
 let free=0,buried=0;
 for(const b of bodies)if(isFree(b,bodies))free++;else buried++;
 return{free,buried};
}

// Höchste Auflage unter der Mitte. ox/oy zeigt vom Auflagemittel weg (bergab).
export function supportOf(body,bodies){
 let z=0,sx=0,sy=0,w=0;
 for(const other of bodies){
  if(other===body||other.held||!near(other,body,72))continue;
  const foot=other.z+(other.stackH||0);
  if(foot>body.z+3)continue;
  const d=touchDistance(other,body.x,body.y),reach=(other.tube||8)*.88;
  if(d>reach)continue;
  if(foot>z)z=foot;
  const wt=Math.max(.08,1-d/reach);
  sx+=(body.x-other.x)*wt;sy+=(body.y-other.y)*wt;w+=wt;
 }
 return{z,ox:w?sx/w:0,oy:w?sy/w:0};
}

function sameBand(a,c){
 const overlap=Math.min(a.z+(a.stackH||0),c.z+(c.stackH||0))-Math.max(a.z,c.z);
 return overlap>Math.min(a.stackH||1,c.stackH||1)*.42;
}

function near(a,c,reach=96){
 return Math.abs(a.x-c.x)<reach&&Math.abs(a.y-c.y)<reach;
}

function resolveContacts(bodies,cfg){
 for(let pass=0;pass<2;pass++){
  for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
   const a=bodies[i],c=bodies[j];
   if(a.held||c.held||!near(a,c)||!sameBand(a,c))continue;
   const hit=capsulePair(a,c);
   if(hit.pen<=2.2)continue;
   const push=Math.min(.4,(hit.pen-1.6)*.22);
   const ia=1/(a.kind.mass+cfg.inertia),ic=1/(c.kind.mass+cfg.inertia),share=ia+ic;
   a.x-=hit.ux*push*(ia/share);a.y-=hit.uy*push*(ia/share);
   c.x+=hit.ux*push*(ic/share);c.y+=hit.uy*push*(ic/share);
  }
 }
}

export function stepPile(bodies,env,dt,cfg=BASE_CONFIG.pile){
 const {width:w,height:h}=env,finger=env.finger&&env.finger.active?env.finger:null;
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
  let ax=0,ay=0;
  const sup=b.held?{z:b.z,ox:0,oy:0}:supportOf(b,bodies);
  b.support=sup.z;b.downhill=Math.hypot(sup.ox,sup.oy);
  if(!b.held&&sup.z>1&&b.downhill>Math.max(4,b.tube*.5)&&b.z<sup.z+(b.stackH||16)){
   ax+=sup.ox/b.downhill*cfg.roll;ay+=sup.oy/b.downhill*cfg.roll;
  }
  const m=b.radius*1.05;
  if(b.x<m)ax+=(m-b.x)/m*cfg.edge*inv;if(b.x>w-m)ax-=(b.x-(w-m))/m*cfg.edge*inv;
  if(b.y<m+28)ay+=(m+28-b.y)/(m+28)*cfg.edge*inv;if(b.y>h-m)ay-=(b.y-(h-m))/m*cfg.edge*inv;
  const fall=cfg.fall||46;
  if(b.z>sup.z+.4)b.vz+=(-fall-b.vz)*Math.min(1,dt*3.2);
  else b.vz=(sup.z-b.z)*5;
  b.ax=ax;b.ay=ay;b.az=0;
 }
 for(const b of bodies){
  const prev=b.z;
  const grounded=!b.held&&b.z<=(b.support||0)+1.2;
  const damp=Math.exp(-(grounded?cfg.drag*1.55:cfg.drag*.5)*dt);
  if(b.held){
   b.vx+=b.ax*dt;b.vy+=b.ay*dt;b.vz+=b.az*dt;
  }else{
   b.vx=(b.vx+b.ax*dt)*damp;b.vy=(b.vy+b.ay*dt)*damp;
   const sp=Math.hypot(b.vx,b.vy);
   if(sp>cfg.maxSpeed){b.vx*=cfg.maxSpeed/sp;b.vy*=cfg.maxSpeed/sp;}
   if(b.downhill<Math.max(3.5,b.tube*.42)&&b.z<=(b.support||0)+1.2){b.vx=0;b.vy=0;}
  }
  b.x=clamp(b.x+b.vx*dt,-30,w+30);b.y=clamp(b.y+b.vy*dt,-30,h+30);
  if(!b.held){
   b.z+=b.vz*dt;
   const floor=b.support||0;
   if(b.z<floor){b.z=floor;b.vz=0;}
   if(b.z<0){b.z=0;b.vz=0;}
  }else b.z+=b.vz*dt;
  b.hitWater=!b.held&&prev>3&&b.z<=0;
  b.prevZ=b.z;
  const moving=Math.hypot(b.vx,b.vy);
  if(b.held){b.spin=b.spinBias*(cfg.holdSpin||.4);b.angle+=b.spin*dt;b.pitch*=.8;b.roll*=.8;}
  else if(moving>8||b.vz<-8){
   b.angle+=Math.sign(b.vx||b.spinBias||1)*Math.min(cfg.maxSpin,moving*cfg.spin+Math.abs(b.vz)*.018)*dt;
   const lean=Math.min(9,moving*.11);
   b.roll=lean*Math.sign(b.vx||b.spinBias||1);
   b.pitch=lean*.4*Math.sign(b.vy||1);
   b.spin=0;
  }else{b.spin=0;b.pitch*=.82;b.roll*=.82;}
 }
 resolveContacts(bodies,cfg);
}

export function advancePile(sim,bodies,envAt,frameDt,frameNow,cfg=BASE_CONFIG.pile){
 const step=1/120;sim.acc=Math.min((sim.acc||0)+frameDt,step*10);let n=0;
 while(sim.acc>=step-1e-9){sim.acc-=step;sim.time=(sim.time||0)+step;
  stepPile(bodies,envAt(sim.time,frameNow-Math.max(0,sim.acc)*1000),step,cfg);n++;}
 return n;
}
