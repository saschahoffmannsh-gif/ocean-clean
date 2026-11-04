// Reine Physik für frei treibenden Müll (ohne DOM, testbar mit node --test).
// Kopplung ans Original-Meer: Die Wellenringe (ocean.pulses) laufen mit
// SEA_FEEL.waveSpeed nach außen. Ein Teil auf einem Ring bekommt eine Drift in
// Laufrichtung (Stokes-Drift ~ Amplitude), Sog-Pulse (negativ, hinter dem Finger)
// ziehen leicht an. Dazu der Hangabtrieb der lokalen Wellen (sampleLocalWaves)
// und der Dünung (sample): Teile rutschen vom Wellenberg ins Tal.
import {SEA_FEEL} from '../water-13.0.0/core/game-feel.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=(a,b,n)=>{const t=clamp((n-a)/(b-a),0,1);return t*t*(3-2*t);};

export const DRIFT=Object.freeze({
 push:300,       // px/s² pro Pulsstärke auf dem Wellenring
 nearPush:5.0,   // Zusatz im Nahfeld des Fingers (motionWake / Tipp)
 nearRange:70,   // px
 slope:5200,     // Hangabtrieb lokaler Wellen
  swell:10,       // Hangabtrieb der Dünung (aus roll/pitch in Grad)
 drag:2.1,       // 1/s Wasserwiderstand
 spinDrag:2.6,
 maxSpeed:420,   // px/s
 range:180,      // px, wie weit ein Wellenring spürbar schiebt
 repel:900,      // weiche gegenseitige Abstoßung
 edge:1100       // weicher Rand
});

// Beschleunigung (px/s²) eines Teils an Pixelposition x,y durch alle aktiven Pulse.
export function waveDrift(pulses,x,y,now){
 let ax=0,ay=0,energy=0;
 for(const p of pulses){
  const age=(now-p.start)/1000;if(age<0||age>SEA_FEEL.waveLifetime/1000)continue;
  const dx=x-p.x,dy=y-p.y,d=Math.hypot(dx,dy)||1,front=age*SEA_FEEL.waveSpeed,delta=d-front;
  const ring=Math.exp(-((delta/(SEA_FEEL.waveWidth*1.25))**2)-age*SEA_FEEL.waveDecay)*(1-smooth(1.55,2,age));
  const near=p.nearField||Math.abs(p.power)>.6?DRIFT.nearPush*Math.exp(-d/DRIFT.nearRange)*Math.exp(-age*4):0;
  const s=(ring+near)*p.power*DRIFT.push*Math.exp(-d/DRIFT.range);
  ax+=dx/d*s;ay+=dy/d*s;energy+=Math.abs(s);
 }
 return{ax,ay,energy};
}

export function createBody(kind,x,y,rand=Math.random){
 return{kind,x,y,vx:(rand()-.5)*6,vy:(rand()-.5)*6,angle:rand()*Math.PI*2,spin:(rand()-.5)*.25,spinBias:(rand()<.5?-1:1)*(.4+rand()*.6),
  heave:NaN,heaveSpeed:0,draft:0,pitch:0,roll:0,pitchSpeed:0,rollSpeed:0,lastWake:0};
}

// Ein Integrationsschritt für alle Körper. env: {width,height,now,t,pulses,local(x,y),swell(x,y),size(body)}
export function stepBodies(bodies,env,dt){
 const {width:w,height:h}=env;
 for(const b of bodies){
  const r=env.size(b),inv=1/(.55+b.kind.mass);
  const drift=waveDrift(env.pulses,b.x,b.y,env.now),wave=env.local(b.x,b.y),sea=env.swell(b.x,b.y);
  let ax=drift.ax-wave.slopeX*DRIFT.slope,ay=drift.ay-wave.slopeY*DRIFT.slope;
  ax+=(sea.roll||0)*DRIFT.swell*-.1;ay+=(sea.pitch||0)*DRIFT.swell*.1;
  // sehr ruhige Grundströmung, damit das Meer nie ganz stillsteht
  ax+=Math.sin(b.y*.011+env.t*.13)*3.2;ay+=Math.cos(b.x*.009-env.t*.11)*2.4;
  // weicher Rand
  const m=r*1.1;
  if(b.x<m)ax+=(m-b.x)/m*DRIFT.edge;if(b.x>w-m)ax-=(b.x-(w-m))/m*DRIFT.edge;
  if(b.y<m+40)ay+=(m+40-b.y)/(m+40)*DRIFT.edge;if(b.y>h-m)ay-=(b.y-(h-m))/m*DRIFT.edge;
  b.ax=ax*inv;b.ay=ay*inv;b.energy=drift.energy;b.wave=wave;b.sea=sea;
 }
 // weiche gegenseitige Abstoßung
 for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
  const a=bodies[i],c=bodies[j],dx=c.x-a.x,dy=c.y-a.y,min=(env.size(a)+env.size(c))*.78,d2=dx*dx+dy*dy;
  if(d2>=min*min||d2<1e-6)continue;const d=Math.sqrt(d2),f=(1-d/min)*DRIFT.repel,ux=dx/d,uy=dy/d;
  a.ax-=ux*f/(.55+a.kind.mass);a.ay-=uy*f/(.55+a.kind.mass);c.ax+=ux*f/(.55+c.kind.mass);c.ay+=uy*f/(.55+c.kind.mass);
 }
 const damp=Math.exp(-DRIFT.drag*dt),sdamp=Math.exp(-DRIFT.spinDrag*dt);
 for(const b of bodies){
  b.vx=(b.vx+b.ax*dt)*damp;b.vy=(b.vy+b.ay*dt)*damp;
  const sp=Math.hypot(b.vx,b.vy);if(sp>DRIFT.maxSpeed){b.vx*=DRIFT.maxSpeed/sp;b.vy*=DRIFT.maxSpeed/sp;}
  b.x+=b.vx*dt;b.y+=b.vy*dt;
  // leichte Drehung: Wellenstöße drehen das Teil je nach Form etwas mit
  b.spin=(b.spin+Math.hypot(b.ax,b.ay)*b.spinBias*.0021*dt)*sdamp;b.angle+=b.spin*dt;
  b.x=clamp(b.x,-20,w+20);b.y=clamp(b.y,-20,h+20);
 }
}

// Ocean-Clean-Grenzen für die Darstellung (Teile sitzen ruhig im Wasser).
export function displayFloat(float,size){
 const lim=Math.min(3,size*.065);
 return{bob:clamp(float.bob*.35,-lim,lim),dip:float.dip,pitch:float.pitch*.4,roll:float.roll*.35};
}
