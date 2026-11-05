// Reine Physik für frei treibenden Müll (ohne DOM, testbar mit node --test).
// Antrieb: nur das lokale Wischströmungsfeld (swipe-flow.js). Feste Schrittweite
// (cfg.step) → gleiches Verhalten bei 30/60/120 fps. Die Drehung folgt derselben
// Strömung (stärkerer Wisch/Sog → schnellere Drehung) und klingt mit ihr ab.
import {BASE_CONFIG} from './config.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const STILL={vx:0,vy:0,weight:0,lift:0,swirl:0};

export function createBody(kind,x,y,rand=Math.random){
 return{kind,x,y,vx:0,vy:0,angle:rand()*Math.PI*2,spin:(rand()-.5)*.08,spinBias:(rand()<.5?-1:1)*(.4+rand()*.6),
  swayPhase:((x*.017+y*.013)%1+1)%1*Math.PI*2,
  heave:NaN,heaveSpeed:0,draft:0,pitch:0,roll:0,pitchSpeed:0,rollSpeed:0,lastWake:-1e9,
  wave:{height:0,slopeX:0,slopeY:0},sea:{lift:0,crest:0,pitch:0,roll:0}};
}

// Ein fester Integrationsschritt. env: {width,height,now,t,flow(x,y)->{vx,vy,weight},size(body)}
// Optional env.bagAccel/env.bagResolve (Säcke). Ohne sie bleibt die Bahn wie bisher.
// Teile übernehmen nur die LOKALE Wischströmung (Gewicht 0 außerhalb der Spur);
// entfernte Wellenringe und Dünung verschieben nichts (nur Wippen, siehe Auftrieb).
export function stepBodies(bodies,env,dt,cfg=BASE_CONFIG.drift,flowCfg=BASE_CONFIG.flow){
 const {width:w,height:h}=env;
 for(const b of bodies){
  b.swirlAdd=0;
  if(b.collected){b.ax=0;b.ay=0;b.flow=b.flow||STILL;continue;}
  const r=env.size(b),inv=1/(b.kind.mass+cfg.inertia),f=env.flow(b.x,b.y);
  const k=flowCfg.coupling*f.weight*inv*(1+cfg.inertia);
  let ax=(f.vx-b.vx)*k,ay=(f.vy-b.vy)*k;
  ax+=Math.sin(b.y*.011+env.t*.13)*cfg.current*inv;ay+=Math.cos(b.x*.009-env.t*.11)*cfg.current*.75*inv;
  const m=r*1.1;
  if(b.x<m)ax+=(m-b.x)/m*cfg.edge*inv;if(b.x>w-m)ax-=(b.x-(w-m))/m*cfg.edge*inv;
  if(b.y<m+40)ay+=(m+40-b.y)/(m+40)*cfg.edge*inv;if(b.y>h-m)ay-=(b.y-(h-m))/m*cfg.edge*inv;
  if(env.bagAccel){const bag=env.bagAccel(b,env)||{};ax+=bag.ax||0;ay+=bag.ay||0;b.swirlAdd=bag.swirl||0;}
  b.ax=ax;b.ay=ay;b.flow=f;
 }
 for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
  const a=bodies[i],c=bodies[j];if(a.collected||c.collected)continue;
  const dx=c.x-a.x,dy=c.y-a.y,min=(env.size(a)+env.size(c))*.8,d2=dx*dx+dy*dy;
  if(d2>=min*min||d2<1e-6)continue;const d=Math.sqrt(d2),f=(1-d/min)*cfg.repel,ux=dx/d,uy=dy/d,ia=1/(a.kind.mass+cfg.inertia),ic=1/(c.kind.mass+cfg.inertia);
  a.ax-=ux*f*ia;a.ay-=uy*f*ia;c.ax+=ux*f*ic;c.ay+=uy*f*ic;
 }
 const damp=Math.exp(-cfg.drag*dt),keep=Math.exp(-cfg.spinDrag*dt);
 for(const b of bodies){
  if(b.collected)continue;
  b.vx=(b.vx+b.ax*dt)*damp;b.vy=(b.vy+b.ay*dt)*damp;
  const cap=b.rejectCap||cfg.maxSpeed;
  const sp=Math.hypot(b.vx,b.vy);if(sp>cap){b.vx*=cap/sp;b.vy*=cap/sp;}
  b.x=clamp(b.x+b.vx*dt,-20,w+20);b.y=clamp(b.y+b.vy*dt,-20,h+20);
  // Ziel-Drehung aus dem Vorzeichen der lokalen Strömung (swirl aus swipe-flow,
  // sonst vx/−vy), plus die Scherung am Sackmund. Links und rechts drehen entgegengesetzt.
  // Ohne Strömung nur idleSpin. Exakt für konstantes Ziel: ω → Ziel + (ω−Ziel)·e^{−spinDrag·dt}.
  const f=b.flow||{vx:0,vy:0};
  const signed=Number.isFinite(f.swirl)?f.swirl:((f.vx||0)*.92-(f.vy||0)*.38);
  const target=b.spinBias*(cfg.idleSpin||0)+(signed+(b.swirlAdd||0))*cfg.spin;
  b.spin=clamp(target+(b.spin-target)*keep,-cfg.maxSpin,cfg.maxSpin);b.angle+=b.spin*dt;
  env.bagResolve?.(b,env);
 }
}

// Bildratenunabhängig: frameDt wird in feste Schritte zerlegt. Rückgabe: Anzahl Schritte.
// onStep(stepDt, nowMs) läuft nach jedem Schritt (z. B. Auftrieb).
// Bildratenunabhängig: frameDt (s) wird in feste Schritte cfg.step zerlegt.
// frameNow: Uhrzeit (ms, performance.now) am Ende des Bildes – daraus bekommt jeder
// Teilschritt seine eigene Zeit für die Wellenringe. onStep(stepDt, env) z. B. für Auftrieb.
export function advance(sim,bodies,envAt,frameDt,frameNow,cfg=BASE_CONFIG.drift,onStep,flowCfg=BASE_CONFIG.flow){
 sim.acc=Math.min((sim.acc||0)+frameDt,cfg.step*cfg.maxSteps);let n=0;
 while(sim.acc>=cfg.step-1e-9){sim.acc-=cfg.step;sim.time=(sim.time||0)+cfg.step;
  const env=envAt(sim.time,frameNow-Math.max(0,sim.acc)*1000);stepBodies(bodies,env,cfg.step,cfg,flowCfg);onStep?.(cfg.step,env);n++;}
 return n;
}

// Ruhige Schaukel nur fürs Bild: y hoch/runter, x hin/her, leichte Größe.
// Phase je Teil, Zeit t in Sekunden (dieselbe Physik-Uhr). Ändert die Position nicht.
export function seaSway(body,t,cfg=BASE_CONFIG.sway){
 const p=body.swayPhase||0,bob=Math.sin(t*cfg.bobFreq*Math.PI*2+p);
 return{x:Math.sin(t*cfg.swayFreq*Math.PI*2+p*1.7+1.2)*cfg.swayAmp,y:bob*cfg.bobAmp,scale:1+bob*cfg.scaleAmp};
}

export function displayFloat(float,size,cfg=BASE_CONFIG.float){
 const lim=Math.min(cfg.maxBob,size*.065);
 return{bob:clamp(float.bob*cfg.bob,-lim,lim),dip:float.dip,pitch:float.pitch*cfg.pitch,roll:float.roll*cfg.roll};
}
