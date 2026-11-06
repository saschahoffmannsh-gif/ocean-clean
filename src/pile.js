// Physik des Müllhaufens auf der Wasserfläche. Nichts liegt darunter.
// Harte Kapseln: die Teile stoßen sich, gehen aber nicht durcheinander.
// Ohne DOM, testbar mit node --test.
import {BASE_CONFIG} from './config.js';
import {MESH_UNITS,SHEAR_X,SHEAR_Z} from './pile-pose.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

export const PILE_KINDS=Object.freeze([
 Object.freeze({key:'plastik:pet-flasche',category:'plastik',name:'pet-flasche',label:'PET-Flasche',mass:.34,long:1.08,thick:.84,radius:16,mid:.16}),
 Object.freeze({key:'metall:dose',category:'metall',name:'dose',label:'Getränkedose',mass:.52,long:.76,thick:1.16,radius:17,mid:.24}),
 Object.freeze({key:'glas:gruene-flasche',category:'glas',name:'gruene-flasche',label:'Glasflasche',mass:.74,long:1.14,thick:.8,radius:15.5,mid:.15})
]);

export function mulberry32(seed){
 let s=seed|0;
 return()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
}

// Kapsel in Pixeln. tube ist die Auflage, stackH die Höhe, auf der das nächste Teil liegt.
export function bodyShape(kind,radiusScale=1){
 const px=30*radiusScale*MESH_UNITS;
 const tube=Math.max(7,px*(kind.thick||1)*(kind.mid||.16)*.78);
 return{halfLen:px*(kind.long||1)*.4,tube,stackH:Math.max(26,tube*2.6)};
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
 const base=Math.max(28,Math.min(40,Math.min(w,h)/390*32));
 const pileR=Math.max(130,Math.min(240,Math.min(w,h)*.4));
 const n=Math.round(Math.max(26,Math.min(34,Math.min(w,h)/13)));
 return{cx:w*.5,cy:h*.47,pileR,n,base,radiusScale:base/30};
}

export function spawnPile({kinds=PILE_KINDS,n,cx,cy,rand,radiusScale=1}){
 const order=[];
 while(order.length<n)for(const k of shuffle([0,1,2],rand))if(order.length<n)order.push(k);
 const spread=64*radiusScale,bodies=[];
 let g=0;
 while(bodies.length<n&&g<48){
  const ang=g*2.399963,rad=g===0?0:Math.min(120*radiusScale,spread*(.5+.58*Math.sqrt(g)));
  const room=n-bodies.length,stack=g<3?Math.min(4,room):g<8?Math.min(3,room):Math.min(2,room);
  const x0=cx+Math.cos(ang)*rad,y0=cy+Math.sin(ang)*rad*.9;
  for(let s=0;s<stack&&bodies.length<n;s++){
   const kind=kinds[order[bodies.length]];
   const b=createPileBody(kind,x0,y0,0,rand,radiusScale);
   b.z=s*b.stackH*.96;
   b.x+=(rand()-.5)*1.6;b.y+=(rand()-.5)*1.6;
   bodies.push(b);
  }
  g++;
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
  if(other===body||other.held)continue;
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

function resolveContacts(bodies,cfg){
 for(let pass=0;pass<2;pass++){
  for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
   const a=bodies[i],c=bodies[j];
   if(a.held||c.held||!sameBand(a,c))continue;
   const hit=capsulePair(a,c);
   if(hit.pen<=.6)continue;
   const push=Math.min(.65,hit.pen*.4);
   const ia=1/(a.kind.mass+cfg.inertia),ic=1/(c.kind.mass+cfg.inertia),share=ia+ic;
   a.x-=hit.ux*push*(ia/share);a.y-=hit.uy*push*(ia/share);
   c.x+=hit.ux*push*(ic/share);c.y+=hit.uy*push*(ic/share);
  }
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
  let ax=0,ay=0;
  b.bumpX=0;b.bumpY=0;
  const sup=b.held?{z:b.z,ox:0,oy:0}:supportOf(b,bodies);
  b.support=sup.z;b.downhill=Math.hypot(sup.ox,sup.oy);
  if(finger&&!hold){
   const p=closestOnAxis(b,finger.x,finger.y);
   const dx=p.x-finger.x,dy=p.y-finger.y,d=Math.hypot(dx,dy),R=(b.tube||8)+cfg.fingerR;
   let buried=false;
   for(const other of bodies){
    if(other===b||other.held||other.z<b.z+(b.stackH||12)*.35)continue;
    if(touchDistance(other,p.x,p.y)<(other.tube||8)){buried=true;break;}
   }
   if(!buried&&d<R){
    const pen=(R-d)/R,speed=Math.hypot(finger.vx,finger.vy);
    const rx=d>1e-3?dx/d:1,ry=d>1e-3?dy/d:0;
    let dirx=rx,diry=ry;
    if(speed>=22){
     const fx=finger.vx/speed,fy=finger.vy/speed,side=fx*dy-fy*dx,sign=side>=0?1:-1;
     dirx=(-fy*sign)*.35+rx*.9;diry=(fx*sign)*.35+ry*.9;
    }
    const norm=Math.hypot(dirx,diry)||1;
    const mag=(speed>=22?cfg.nudge:cfg.dwell)*pen*Math.min(1,Math.max(speed,24)/220);
    b.bumpX=dirx/norm*mag;b.bumpY=diry/norm*mag;
   }
  }
  if(!b.held&&sup.z>1&&b.downhill>8&&b.z<sup.z+(b.stackH||16)){
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
 const damp=Math.exp(-cfg.drag*dt);
 for(const b of bodies){
  const prev=b.z;
  if(b.held){
   b.vx+=b.ax*dt;b.vy+=b.ay*dt;b.vz+=b.az*dt;
  }else{
   b.vx=(b.vx+b.ax*dt)*damp;b.vy=(b.vy+b.ay*dt)*damp;
   const sp=Math.hypot(b.vx,b.vy);
   if(sp>cfg.maxSpeed){b.vx*=cfg.maxSpeed/sp;b.vy*=cfg.maxSpeed/sp;}
   const margin=b.radius*1.05,nearEdge=b.x<margin+8||b.x>w-margin-8||b.y<margin+36||b.y>h-margin-8;
   if(b.bumpX||b.bumpY){
    b.x+=b.bumpX*dt;b.y+=b.bumpY*dt;
    b.vx=b.bumpX*.3;b.vy=b.bumpY*.3;
   }else if(b.downhill<6&&b.z<=(b.support||0)+.8&&!nearEdge){b.vx=0;b.vy=0;}
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
  if(b.held){b.spin=b.spinBias*(cfg.holdSpin||.4);b.angle+=b.spin*dt;}
  else if(moving>8||b.vz<-8){
   b.angle+=Math.sign(b.vx||b.spinBias||1)*Math.min(cfg.maxSpin,moving*cfg.spin+Math.abs(b.vz)*.018)*dt;
   b.spin=0;
  }else b.spin=0;
 }
 resolveContacts(bodies,cfg);
}

export function advancePile(sim,bodies,envAt,frameDt,frameNow,cfg=BASE_CONFIG.pile){
 const step=1/120;sim.acc=Math.min((sim.acc||0)+frameDt,step*10);let n=0;
 while(sim.acc>=step-1e-9){sim.acc-=step;sim.time=(sim.time||0)+step;
  stepPile(bodies,envAt(sim.time,frameNow-Math.max(0,sim.acc)*1000),step,cfg);n++;}
 return n;
}
