// Lokales Wischströmungsfeld (ohne DOM, testbar).
// Jeder Wischabschnitt ist eine Kapsel um die Fingerspur. Darin strömt das Wasser in
// Wischrichtung (plus leichte seitliche Verdrängung von der Spur weg); außerhalb fällt
// der Einfluss glatt (Gauß) auf 0 ab, harte Grenze bei cutoff·radius. Abklingen über
// ~1 s. Beiträge werden mit der Abschnittslänge gewichtet, damit die Strömung
// nicht von der Event-/Bildrate abhängt. Antippen = kurzer radialer Schubs im Nahbereich.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export class SwipeFlow{
 constructor(cfg){this.cfg=cfg;this.segments=[];}
 // a,b: Pixelpunkte, dt: Sekunden seit dem letzten Abschnitt, now: ms
 addSegment(ax,ay,bx,by,dt,now){
  const dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy);if(len<.5)return null;
  const speed=clamp(len/Math.max(dt,1/240),0,this.cfg.maxFingerSpeed);
  const s={ax,ay,bx,by,ux:dx/len,uy:dy/len,len,speed,start:now,tap:false};this.push(s);return s;
 }
 addTap(x,y,now){this.push({ax:x,ay:y,bx:x,by:y,ux:0,uy:0,len:0,speed:0,start:now,tap:true});}
 push(s){this.segments.push(s);if(this.segments.length>this.cfg.maxSegments)this.segments.shift();}
 prune(now){const life=this.cfg.lifetime*1000;this.segments=this.segments.filter(s=>now-s.start<life);}
 // Strömung (px/s) und Kopplungsgewicht 0..1 am Punkt x,y
 sample(x,y,now){
  const c=this.cfg,R=c.radius,cut=R*c.cutoff;let vx=0,vy=0,w=0,lift=0;
  for(const s of this.segments){
   const age=(now-s.start)/1000;if(age<0||age>c.lifetime)continue;
   // nächster Punkt auf dem Segment
   let t=0;if(s.len>0)t=clamp(((x-s.ax)*s.ux+(y-s.ay)*s.uy)/s.len,0,1);
   const px=s.ax+s.ux*s.len*t,py=s.ay+s.uy*s.len*t,ox=x-px,oy=y-py,d=Math.hypot(ox,oy);
   const fade=Math.exp(-age/c.decay)*(1-clamp((age-c.lifetime*.7)/(c.lifetime*.3),0,1));
   if(s.tap){const r=c.tapRadius;if(d>r*c.cutoff)continue;const k=Math.exp(-((d/r)**2))*fade,inv=d>1e-3?1/d:0;
    vx+=ox*inv*c.tapSpeed*k;vy+=oy*inv*c.tapSpeed*k;w=Math.max(w,k);lift+=k*.5;continue;}
   if(d>cut)continue;
   const k=Math.exp(-((d/R)**2))*fade,dens=Math.min(1,s.len/(1.2*R)),carry=dens*s.speed*c.carry*k,side=dens*s.speed*c.side*k*(d/R),inv=d>1e-3?1/d:0;
   vx+=s.ux*carry+ox*inv*side;vy+=s.uy*carry+oy*inv*side;w=Math.max(w,k);lift+=dens*k*Math.min(1,s.speed/600);
  }
  const sp=Math.hypot(vx,vy);if(sp>c.maxFlow){vx*=c.maxFlow/sp;vy*=c.maxFlow/sp;}
  return{vx,vy,weight:w,lift:Math.min(1,lift)};
 }
}
