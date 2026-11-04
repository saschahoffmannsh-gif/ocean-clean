// Auftrieb 1:1 aus Ocean Merge (dist/buoyancy.js). Entfernt: Küstenbrandung.
// Ergänzt: die breite Hochsee-Dünung, die auch der Shader zeigt.
import {seaView} from './camera.js';
export const INTERACTION_WAVE_LIFETIME=1400;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=(a,b,n)=>{const t=clamp((n-a)/(b-a),0,1);return t*t*(3-2*t);};

// Die analytische Dünung des Shaders auf der CPU auswerten (kein GPU-Readback).
// x,y: Bildschirm 0…1.
export function sampleSeaMotion(x,y,{width,height,camera,time,swell}){
 const aspect=width/height,px=x*aspect,wind=swell/100,energy=.08+wind*1.8,view=seaView(width,height);
 const p1=10*px+21*y+time*1.45,p2=-25*px+14*y+time*1.83,p3=49*px-31*y+time*2.47,p4=-76*px-39*y+time*3.15;
 const ambient=(Math.sin(p1)*.0048+Math.sin(p2)*.0026+Math.sin(p3)*.0008+Math.sin(p4)*.00036)*energy*230;
 // Lange Hochsee-Dünung in Weltkoordinaten (gleiche Formel wie im Shader, ohne Rauschen).
 const wx=(x-.5)*aspect*view.h+camera.x,wy=(y-.5)*view.h+camera.y,sp=(wx*.55+wy)*5.2-time*.62;
 const swellLift=Math.sin(sp)*(.6+wind*1.6),swellSlope=Math.cos(sp)*(.4+wind)*.05;
 const gx=(Math.cos(p1)*.048-Math.cos(p2)*.065+Math.cos(p3)*.0392-Math.cos(p4)*.02736)*energy+swellSlope*.55;
 const gy=(Math.cos(p1)*.1008+Math.cos(p2)*.0364-Math.cos(p3)*.0248-Math.cos(p4)*.01404)*energy+swellSlope;
 return{lift:ambient+swellLift,crest:Math.max(0,Math.sin(sp))*.15*wind,pitch:-Math.atan(gy)*180/Math.PI*1.5,roll:Math.atan(gx)*180/Math.PI*1.5};
}

export function sampleInteractionWaves(pulses,x,y,now){
 let height=0,slopeX=0,slopeY=0;
 for(const p of pulses){const age=(now-p.start)/1000;if(age<0||age>INTERACTION_WAVE_LIFETIME/1000)continue;const dx=x-p.x,dy=y-p.y,distance=Math.hypot(dx,dy),delta=distance-age*180,phase=delta*.08,nearBoost=p.nearField?1.6*Math.exp(-distance/60):0,envelope=Math.exp(-((delta/38)**2)-age*1.6)*(1-smooth(1.1,1.4,age))*p.power*(1+nearBoost);
  height+=Math.sin(phase)*envelope;const slope=(Math.cos(phase)*.08-Math.sin(phase)*(2*delta/(38*38)+nearBoost/(60*(1+nearBoost))))*envelope/(distance||1);slopeX+=slope*dx;slopeY+=slope*dy;
 }
 return{height,slopeX,slopeY};
}

// Gedämpfter Auftrieb mit Rotationsträgheit (unverändert aus dem Original).
export function stepBuoyancy(body,surface,response,dt,reducedMotion=false){
 if(reducedMotion){body.heave=0;body.heaveSpeed=0;body.draft=0;body.pitch=0;body.roll=0;body.pitchSpeed=0;body.rollSpeed=0;return{bob:0,dip:0,pitch:0,roll:0};}
 const target=clamp(surface.lift+response*3.6,-4.5,4.5),pitch=clamp(surface.pitch||0,-10,10),roll=clamp(surface.roll||0,-8,8);
 if(!Number.isFinite(body.heave)||!dt){body.heave=target;body.heaveSpeed=0;body.draft=0;body.pitch=pitch;body.roll=roll;body.pitchSpeed=0;body.rollSpeed=0;}
 else{
  const step=Math.min(dt,.04);body.heaveSpeed+=((target-body.heave)*34-body.heaveSpeed*9)*step;body.heave+=body.heaveSpeed*step;
  const dip=clamp(Math.max(0,target-body.heave-.1)*.036+surface.crest*.03+Math.max(0,surface.lift-.25)*.02+Math.abs(response)*.085+clamp(surface.motion||0,0,1)*.065,0,.14);
  body.draft+=(dip-body.draft)*(1-Math.exp(-step*(dip>body.draft?13:5)));
  for(const [angle,speed,limit]of [['pitch','pitchSpeed',10],['roll','rollSpeed',8]]){
   const targetAngle=angle==='pitch'?pitch:roll;body[speed]=((body[speed]||0)+(targetAngle-body[angle])*90*step)*Math.exp(-9*step);body[angle]=clamp(body[angle]+body[speed]*step,-limit,limit);
  }
 }
 return{bob:-body.heave,dip:body.draft,pitch:body.pitch,roll:body.roll};
}
