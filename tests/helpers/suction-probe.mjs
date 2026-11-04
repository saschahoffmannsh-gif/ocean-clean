// Ein einzelnes Teil an definiertem Seitenabstand zu einem waagerechten Wisch (Mitte, links→rechts).
// Ergebnis: Verschiebung längs (dx, in Wischrichtung) und quer (dy, + = von der Spur weg).
import {TRASH} from '../../src/trash-catalog.js';
import {createBody,advance} from '../../src/trash-physics.js';
import {SwipeFlow} from '../../src/swipe-flow.js';
import {makeConfig} from '../../src/config.js';
export function probe({suction=true,fps=60,offset=0,force=1,kindIndex=0,x0=195,W=390,H=844,len=300,dur=.35,seconds=3}={}){
 const cfg=makeConfig(force);if(!suction)cfg.flow={...cfg.flow,suction:null};const y=H/2,b=createBody(TRASH[kindIndex],x0,y+offset,()=>.5),bodies=[b],flow=new SwipeFlow(cfg.flow),sim={};
 const ax=x0-len/2;let last=null,maxSpeed=0;const frames=Math.round(seconds*fps);
 for(let f=1;f<=frames;f++){const now=f*1000/fps;
  if(now<=dur*1000){const p={x:ax+len*now/1000/dur,y};
   if(!last){flow.addTap(p.x,p.y,now);last={...p,at:now};}
   else if(Math.hypot(p.x-last.x,p.y-last.y)>=cfg.wake.minStep){flow.addSegment(last.x,last.y,p.x,p.y,(now-last.at)/1000,now);last={...p,at:now};}}
  advance(sim,bodies,(t,n)=>({width:W,height:H,now:n,t,flow:(x,yy)=>flow.sample(x,yy,n),size:q=>25*q.kind.radius}),1/fps,now,cfg.drift,null,cfg.flow);
  flow.prune(now);maxSpeed=Math.max(maxSpeed,Math.hypot(b.vx,b.vy));
 }
 const dy=(b.y-(y+offset))*(offset<0?-1:1);
 return{dx:b.x-x0,dy,maxSpeed};
}
