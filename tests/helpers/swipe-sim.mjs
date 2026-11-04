// Spielt einen normalen Wisch (bzw. Tipp) nach, wie ocean.js ihn im 'game'-Modus
// erzeugt (Tipp .23, motionWake .31/-.17 je ≥40 ms), skaliert mit config.water.input,
// und integriert den Müll bei gegebener Bildrate. Ergebnis: Verdrängungen in px.
import {sampleInteractionWaves} from '../../water-13.0.0/core/buoyancy.js';
import {TRASH} from '../../src/trash-catalog.js';
import {createBody,advance} from '../../src/trash-physics.js';
import {makeConfig} from '../../src/config.js';
export function simulate({fps=60,kind='swipe',force=1,seconds=3,W=390,H=844}={}){
 const cfg=makeConfig(force);let seed=3;const rand=()=>((seed=seed*16807%2147483647)/2147483647);
 const bodies=[];for(let i=0;i<31;i++)bodies.push(createBody(TRASH[i%TRASH.length],30+rand()*330,80+rand()*720,rand));
 const pulses=[],sim={};let last=null,maxSpeed=0,p0=null;const settle=2000;
 const add=(x,y,amp,near,now)=>{pulses.push({x,y,power:Math.max(-2,Math.min(2,amp*cfg.water.input/.27)),nearField:near,start:now});if(pulses.length>48)pulses.shift();};
 const frames=Math.round((seconds+settle/1000)*fps);
 for(let f=1;f<=frames;f++){const clock=f*1000/fps,now=clock-settle;if(now>0&&!p0)p0=bodies.map(b=>[b.x,b.y]);
  if(kind==='swipe'&&now>0&&now<=1000){const t=now/1000,x=W*(.12+.72*t),y=H*(.78-.42*t)+Math.sin(t*6.28)*H*.06;
   if(!last){add(x,y,.23,false,now);last={x,y,at:now};}else{const dx=x-last.x,dy=y-last.y,d=Math.hypot(dx,dy);if(d>3&&now-last.at>40){const ux=dx/d,uy=dy/d;add(x+ux*12,y+uy*12,.31*.95,true,now);add(x-ux*16,y-uy*16,-.17*.95,true,now);last={x,y,at:now};}}}
  if(kind==='tap'&&p0&&!sim.tapped&&(sim.tapped=1))add(W/2,H/2,.23,false,now);
  advance(sim,bodies,(t,n)=>({width:W,height:H,now:n,t,pulses,local:(x,y)=>sampleInteractionWaves(pulses,x,y,n),swell:()=>({lift:0,crest:0,pitch:0,roll:0}),size:b=>25*b.kind.radius}),1/fps,now,cfg.drift);
  if(p0)for(const b of bodies)maxSpeed=Math.max(maxSpeed,Math.hypot(b.vx,b.vy));
 }
 const d=bodies.map((b,i)=>Math.hypot(b.x-p0[i][0],b.y-p0[i][1])).sort((a,b)=>b-a);
 return{max:d[0],top5:d.slice(0,5).reduce((a,b)=>a+b)/5,median:d[d.length>>1],maxSpeed,maxSpin:Math.max(...bodies.map(b=>Math.abs(b.spin)))};
}
