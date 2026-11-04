// Spielt einen normalen Wisch (bzw. Tipp) mit Pointer-Events in Bildrate fps nach
// und integriert den Müll. Ergebnis: Verdrängung je Teil plus Abstand zur Fingerspur.
import {TRASH} from '../../src/trash-catalog.js';
import {createBody,advance} from '../../src/trash-physics.js';
import {SwipeFlow} from '../../src/swipe-flow.js';
import {makeConfig} from '../../src/config.js';
const segDist=(x,y,ax,ay,bx,by)=>{const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/l)):0;return Math.hypot(x-ax-dx*t,y-ay-dy*t);};
export function simulate({fps=60,kind='swipe',force=1,seconds=3,W=390,H=844,path}={}){
 const cfg=makeConfig(force);let seed=3;const rand=()=>((seed=seed*16807%2147483647)/2147483647);
 const bodies=[];for(let i=0;i<31;i++)bodies.push(createBody(TRASH[i%TRASH.length],30+rand()*330,80+rand()*720,rand));
 const flow=new SwipeFlow(cfg.flow),sim={},settle=2000,trace=[];let last=null,p0=null,maxSpeed=0;
 // Standard: schräger Wisch durch die Mitte, ~520 px in 0,6 s
 path=path||(t=>({x:W*(.15+.7*t),y:H*(.62-.24*t)}));const dur=.6;
 const frames=Math.round((seconds+settle/1000)*fps);
 for(let f=1;f<=frames;f++){const clock=f*1000/fps,now=clock-settle;if(now>0&&!p0)p0=bodies.map(b=>[b.x,b.y]);
  if(kind==='swipe'&&now>0&&now<=dur*1000){const p=path(now/1000/dur);
   if(!last){flow.addTap(p.x,p.y,now);last={...p,at:now};trace.push(p);}
   else if(Math.hypot(p.x-last.x,p.y-last.y)>=cfg.wake.minStep){flow.addSegment(last.x,last.y,p.x,p.y,(now-last.at)/1000,now);last={...p,at:now};trace.push(p);}}
  if(kind==='tap'&&p0&&!sim.tapped){sim.tapped=1;flow.addTap(W/2,H/2,now);trace.push({x:W/2,y:H/2});}
  advance(sim,bodies,(t,n)=>({width:W,height:H,now:n,t,flow:(x,y)=>flow.sample(x,y,n),size:b=>25*b.kind.radius}),1/fps,now,cfg.drift,null,cfg.flow);
  flow.prune(now);if(p0)for(const b of bodies)maxSpeed=Math.max(maxSpeed,Math.hypot(b.vx,b.vy));
 }
 const items=bodies.map((b,i)=>{let dist=1e9;for(let k=0;k<trace.length;k++){const a=trace[Math.max(0,k-1)],c=trace[k];dist=Math.min(dist,segDist(p0[i][0],p0[i][1],a.x,a.y,c.x,c.y));}return{moved:Math.hypot(b.x-p0[i][0],b.y-p0[i][1]),dist};});
 const near=items.filter(i=>i.dist<60).map(i=>i.moved),far=items.filter(i=>i.dist>150).map(i=>i.moved),mid=items.filter(i=>i.dist>=60&&i.dist<=150).map(i=>i.moved);
 const st=a=>a.length?{n:a.length,max:Math.max(...a),mean:a.reduce((x,y)=>x+y,0)/a.length}:{n:0,max:0,mean:0};
 return{near:st(near),mid:st(mid),far:st(far),maxSpeed,items};
}
