// Reine Bewegung für Meeresleben unter der Oberfläche (ohne DOM). Feste Aufrufe
// mit dt, testbar. Fische schwimmen in der Draufsicht und weichen starker
// Wischströmung aus. Die Schildkröte ist langsam, Quallen treiben und pulsieren.
// Nichts davon wird eingesammelt und nichts schreibt in die Müll-Physik.
const TAU=Math.PI*2;
const wrap=a=>{a%=TAU;return a<0?a+TAU:a;};
const diff=(from,to)=>{let d=wrap(to)-wrap(from);if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d;};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

export const LIFE_KINDS=Object.freeze([
 {name:'sardine',role:'fish',speed:48,turn:.7,wander:.85,dodge:1,drift:.04,school:true,look:.62},
 {name:'makrele',role:'fish',speed:54,turn:.4,wander:.5,dodge:1,drift:.04,school:false,look:1.05},
 {name:'schildkroete',role:'turtle',speed:14,turn:.16,wander:.18,dodge:.22,drift:.1,school:false,look:1.45},
 {name:'qualle',role:'jelly',speed:7,turn:.12,wander:.22,dodge:0,drift:.38,school:false,look:.95,pulse:1.15}
].map(k=>Object.freeze({...k,src:`./assets/life/${k.name}.png?v=20261105-life5`})));

export function createCreature(kind,x,y,rand=Math.random){
 return{kind,x,y,heading:rand()*TAU,phase:rand()*TAU,bend:0,pulse:1,squash:1};
}

// env: {width,height,t,flow(x,y)->{vx,vy,weight}}
export function stepLife(list,env,dt,cfg){
 const schools={};
 for(const c of list)if(c.kind.school)(schools[c.kind.name]||=[]).push(c);
 const {width:w,height:h}=env,m=40;
 for(const c of list){
  const f=env.flow(c.x,c.y)||{vx:0,vy:0,weight:0},fw=f.weight||0;
  let turn=Math.sin(env.t*c.kind.wander+c.phase)*c.kind.turn;
  if(c.kind.school){
   const mates=schools[c.kind.name];let sx=0,sy=0,hx=0,hy=0,near=0;
   for(const o of mates){if(o===c)continue;const dx=o.x-c.x,dy=o.y-c.y,d=Math.hypot(dx,dy);
    if(d>150||d<1)continue;near++;
    if(d<24){sx-=dx/d;sy-=dy/d;}else{sx+=dx/d*.4;sy+=dy/d*.4;hx+=Math.cos(o.heading);hy+=Math.sin(o.heading);}}
   if(near&&(sx||sy))turn+=diff(c.heading,Math.atan2(sy,sx))*cfg.cohere;
   if(hx||hy)turn+=diff(c.heading,Math.atan2(hy,hx))*cfg.cohere*.5;
  }
  const flowSp=Math.hypot(f.vx||0,f.vy||0);
  if(c.kind.dodge&&fw>.12&&flowSp>30){
   const p1=Math.atan2(f.vx,-f.vy),p2=Math.atan2(-f.vx,f.vy);
   const pref=Math.abs(diff(c.heading,p1))<Math.abs(diff(c.heading,p2))?p1:p2;
   turn+=diff(c.heading,pref)*cfg.dodge*c.kind.dodge;
  }
  if(c.x<m)turn+=diff(c.heading,0)*2.4;
  if(c.x>w-m)turn+=diff(c.heading,Math.PI)*2.4;
  if(c.y<m+36)turn+=diff(c.heading,Math.PI/2)*2.4;
  if(c.y>h-m)turn+=diff(c.heading,-Math.PI/2)*2.4;
  c.heading=wrap(c.heading+turn*dt);
  c.x+= (Math.cos(c.heading)*c.kind.speed+(f.vx||0)*c.kind.drift*fw)*dt;
  c.y+= (Math.sin(c.heading)*c.kind.speed+(f.vy||0)*c.kind.drift*fw)*dt;
  c.x=clamp(c.x,-20,w+20);c.y=clamp(c.y,-20,h+20);
  if(c.kind.role==='jelly'){const s=Math.sin(env.t*c.kind.pulse+c.phase);c.pulse=1+s*.08;c.squash=1-s*.05;}
  else{c.pulse=1;c.squash=1;}
 }
}
