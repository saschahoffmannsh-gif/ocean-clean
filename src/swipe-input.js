// Finger → Wasser + Wischströmung. Hört passiv auf die Pointer-Events des
// Wasser-Canvas (ocean.js verarbeitet sie weiter, seine eigenen Wisch-/Tipp-Impulse
// werden von tuneWater() abgefangen). Statt einer Kette aus Punkttropfen entsteht
// eine zusammenhängende, schmale Bugwelle: vorn Druck, dicht dahinter Sog.
import {SwipeFlow} from './swipe-flow.js?v=20261104-full4';

// Wake-Impulse für einen Wischabschnitt (reine Funktion, testbar).
// Rückgabe: Liste [x,y,amplitude,radius] in Pixeln.
export function wakeDrops(ax,ay,bx,by,dt,cfg){
 const dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy);if(len<1e-3)return[];
 const ux=dx/len,uy=dy/len,speed=len/Math.max(dt,1/240),s=Math.min(1,speed/cfg.speedFull)**.8;
 return[[bx+ux*cfg.ahead,by+uy*cfg.ahead,cfg.push*s,cfg.radius],[bx-ux*cfg.behind,by-uy*cfg.behind,cfg.pull*s,cfg.radius]];
}

export class SwipeInput{
 constructor(ocean,config){
  this.ocean=ocean;this.cfg=config;this.flow=new SwipeFlow(config.flow);this.pointers=new Map();
  const c=ocean.canvas,opt={passive:true,signal:(this.events=new AbortController()).signal};
  c.addEventListener('pointerdown',e=>this.down(e),opt);c.addEventListener('pointermove',e=>this.move(e),opt);
  for(const n of ['pointerup','pointercancel','lostpointercapture'])c.addEventListener(n,e=>this.pointers.delete(e.pointerId),opt);
 }
 local(e){const r=this.ocean.canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
 drop(x,y,amp,radius){const o=this.ocean;o.surface.disturb(x/o.width,y/o.height,amp,radius);}
 down(e){
  if(e.button>0)return;const p=this.local(e),now=performance.now(),w=this.cfg.wake;
  this.pointers.set(e.pointerId,{...p,at:now});this.flow.addTap(p.x,p.y,now);
  if(w.tap)this.drop(p.x,p.y,w.tap,w.tapRadius);
 }
 move(e){
  const s=this.pointers.get(e.pointerId);if(!s)return;
  const p=this.local(e),now=performance.now(),w=this.cfg.wake,d=Math.hypot(p.x-s.x,p.y-s.y);
  if(d<w.minStep)return;
  const dt=Math.max(1/240,(now-s.at)/1000);
  this.flow.addSegment(s.x,s.y,p.x,p.y,dt,now);
  for(const [x,y,a,r] of wakeDrops(s.x,s.y,p.x,p.y,dt,w))this.drop(x,y,a,r);
  if(w.spray>0&&Math.random()<w.sprayChance)this.ocean.__originalSplashes?.(p.x/this.ocean.width,p.y/this.ocean.height,w.spray,w.sprayCount);
  s.x=p.x;s.y=p.y;s.at=now;
 }
}

// ocean.js-eigene Wisch-/Tipp-Impulse (motionWake, Tipp-, Loslass-Tropfen) und ihre
// Gischt abfangen – sie erzeugen die vielen Kreiswellen. Die Hintergrund-Wellen des
// Meeres (Radius 12) bleiben, leicht gedämpft. Core bleibt unverändert.
export function tuneWater(ocean,water){
 const disturb=ocean.disturb.bind(ocean),splashes=ocean.splashes.bind(ocean);
 ocean.__originalDisturb=disturb;ocean.__originalSplashes=splashes;
 ocean.disturb=(x,y,amplitude=.17,radius=4,withSplash=false,nearField=false)=>{if(radius===12)disturb(x,y,amplitude*water.ambient,radius,withSplash,nearField);};
 ocean.splashes=()=>{};
}
