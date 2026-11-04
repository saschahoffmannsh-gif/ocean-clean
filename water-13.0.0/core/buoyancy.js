import {viewSpan} from './camera.js';
import {sampleSurfFront} from './surf.js';
import {SEA_FEEL,FLOAT_FEEL} from './game-feel.js';
export const INTERACTION_WAVE_LIFETIME=SEA_FEEL.waveLifetime;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=(a,b,n)=>{const t=clamp((n-a)/(b-a),0,1);return t*t*(3-2*t);};

// Sample the existing shader's analytic swell and approaching surf on the CPU.
// Local interaction waves are supplied separately; no GPU readback is needed.
export function sampleSeaMotion(x,y,{width,height,camera,time,swell}){
 const span=viewSpan(width,height),worldX=(x-.5)*span.x+.5+camera.x,worldY=y*span.y+camera.y,aspect=width/height,px=x*aspect,wind=swell/100,energy=(.08+wind*1.8)*SEA_FEEL.swellGain;
 const p1=10*px+21*y+time*1.45,p2=-25*px+14*y+time*1.83,p3=49*px-31*y+time*2.47,p4=-76*px-39*y+time*3.15;
 const ambient=(Math.sin(p1)*.0048+Math.sin(p2)*.0026+Math.sin(p3)*.0008+Math.sin(p4)*.00036)*energy*230;
 const front=sampleSurfFront(worldX,time),{near,phase}=front,crestY=front.y;
 // Average the narrow crest over a floating object's footprint.
 const crestWidth=(.009*(1-near)+.004*near)*SEA_FEEL.crestWidthGain+.012,surfStrength=smooth(0,.2,wind)*(.55+wind*.75)*SEA_FEEL.surfGain,crest=Math.exp(-(((worldY-crestY)/crestWidth)**2))*(1-smooth(.48,.515,phase))*surfStrength;
 const surfGradient=-(worldY-crestY)/(crestWidth*crestWidth)*crest*.0009;
 const gx=(Math.cos(p1)*.048-Math.cos(p2)*.065+Math.cos(p3)*.0392-Math.cos(p4)*.02736)*energy-surfGradient*front.slope;
 const gy=(Math.cos(p1)*.1008+Math.cos(p2)*.0364-Math.cos(p3)*.0248-Math.cos(p4)*.01404)*energy+surfGradient;
 return{lift:ambient+crest*6.4,crest,pitch:-Math.atan(gy)*180/Math.PI*1.5,roll:Math.atan(gx)*180/Math.PI*1.5};
}

export function sampleInteractionWaves(pulses,x,y,now){
 let height=0,slopeX=0,slopeY=0;
 for(const p of pulses){const age=(now-p.start)/1000;if(age<0||age>INTERACTION_WAVE_LIFETIME/1000)continue;const dx=x-p.x,dy=y-p.y,distance=Math.hypot(dx,dy),delta=distance-age*SEA_FEEL.waveSpeed,phase=delta*.08,nearBoost=p.nearField?1.9*Math.exp(-distance/60):0,envelope=Math.exp(-((delta/SEA_FEEL.waveWidth)**2)-age*SEA_FEEL.waveDecay)*(1-smooth(1.55,2,age))*p.power*(1+nearBoost);
  height+=Math.sin(phase)*envelope;const slope=(Math.cos(phase)*.08-Math.sin(phase)*(2*delta/(SEA_FEEL.waveWidth**2)+nearBoost/(60*(1+nearBoost))))*envelope/(distance||1);slopeX+=slope*dx;slopeY+=slope*dy;
 }
 return{height,slopeX,slopeY};
}

export function stepBuoyancy(body,surface,response,dt,reducedMotion=false){
 if(reducedMotion){body.heave=0;body.heaveSpeed=0;body.draft=0;body.pitch=0;body.roll=0;body.pitchSpeed=0;body.rollSpeed=0;return{bob:0,dip:0,pitch:0,roll:0};}
 const target=clamp(surface.lift+response*FLOAT_FEEL.responseGain,-FLOAT_FEEL.maxHeave,FLOAT_FEEL.maxHeave),pitch=clamp(surface.pitch||0,-FLOAT_FEEL.maxPitch,FLOAT_FEEL.maxPitch),roll=clamp(surface.roll||0,-FLOAT_FEEL.maxRoll,FLOAT_FEEL.maxRoll);
 if(!Number.isFinite(body.heave)||!dt){body.heave=target;body.heaveSpeed=0;body.draft=0;body.pitch=pitch;body.roll=roll;body.pitchSpeed=0;body.rollSpeed=0;}
 else{
  // Damped buoyancy: the object follows a crest with a small physical lag.
  const step=Math.min(dt,.04);body.heaveSpeed+=((target-body.heave)*42-body.heaveSpeed*10)*step;body.heave+=body.heaveSpeed*step;
  const dip=clamp(Math.max(0,target-body.heave-.1)*.036+surface.crest*.03+Math.max(0,surface.lift-.25)*.02+Math.abs(response)*.085+clamp(surface.motion||0,0,1)*.065,0,FLOAT_FEEL.maxDip);
  body.draft+=(dip-body.draft)*(1-Math.exp(-step*(dip>body.draft?13:5)));
  // Rotational inertia lets an impulse rock the part, then settle naturally.
  for(const [angle,speed,limit]of [['pitch','pitchSpeed',FLOAT_FEEL.maxPitch],['roll','rollSpeed',FLOAT_FEEL.maxRoll]]){
   const targetAngle=angle==='pitch'?pitch:roll;body[speed]=((body[speed]||0)+(targetAngle-body[angle])*90*step)*Math.exp(-9*step);body[angle]=clamp(body[angle]+body[speed]*step,-limit,limit);
  }
 }
 return{bob:-body.heave,dip:body.draft,pitch:body.pitch,roll:body.roll};
}
