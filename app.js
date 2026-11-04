import {WaterSurface,CanvasSurface} from './water.js?v=20261104-swipe';
import {SeaCamera} from './camera.js?v=20261104-swipe';
import {sampleSeaMotion,sampleInteractionWaves,stepBuoyancy,INTERACTION_WAVE_LIFETIME} from './buoyancy.js?v=20261104-swipe';
import {GRID_SIZE,gridGeometry,cellCenter,cellAt} from './grid.js?v=20261104-swipe';

const $=s=>document.querySelector(s);
const world=$('#world');let canvas=$('#water');const layer=$('#float-layer'),debug=$('#grid-debug'),debugCtx=debug.getContext('2d');
const params=new URLSearchParams(location.search);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const num=(k,d)=>{const v=Number(params.get(k));return params.has(k)&&Number.isFinite(v)?Math.max(0,Math.min(100,v)):d;};
const settings={swell:num('swell',reducedMotion?12:32),light:num('light',65),quality:params.get('quality')||'auto'};
let showGrid=params.has('grid');
const camera=new SeaCamera();
let renderer=null,width=1,height=1,dpr=1,geometry=null,raf=0,lastFrame=0,lastAmbient=0,pulses=[];

// Platzhalter auf Rasterfeldern – später ersetzt durch Müll-Items.
const PLACEHOLDERS=[{cell:7,art:'crate'},{cell:16,art:'bottle'},{cell:25,art:'can'},{cell:34,art:'tire'}];
const floaters=PLACEHOLDERS.map(({cell,art},index)=>{
 const el=document.createElement('div');el.className='floater';el.dataset.cell=cell;
 el.innerHTML=`<span class="float-shadow"></span><div class="float-art"><img class="submerged-art" src="./assets/${art}.svg" alt="" draggable="false"><img class="surface-art" src="./assets/${art}.svg" alt="Platzhalter ${art}" draggable="false"></div>`;
 layer.appendChild(el);return{el,art:el.querySelector('.float-art'),cell,index,x:0,y:0,phase:index*1.7};
});

function layout(){
 geometry=gridGeometry(width,height);world.style.setProperty('--cell',`${geometry.cell}px`);
 for(const f of floaters){const p=cellCenter(f.cell,geometry);f.x=p.x;f.y=p.y;}
 drawDebug();
}
function drawDebug(){
 debug.width=Math.round(width*dpr);debug.height=Math.round(height*dpr);debug.hidden=!showGrid;if(!showGrid)return;
 const c=debugCtx,g=geometry;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,width,height);c.strokeStyle='rgba(255,255,255,.55)';c.setLineDash([4,4]);c.lineWidth=1;
 for(let i=0;i<=GRID_SIZE;i++){c.beginPath();c.moveTo(g.left+i*g.cellW,g.top);c.lineTo(g.left+i*g.cellW,g.bottom);c.moveTo(g.left,g.top+i*g.cellH);c.lineTo(g.right,g.top+i*g.cellH);c.stroke();}
}
function resize(){
 const rect=world.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);
 const cap=settings.quality==='high'?2:settings.quality==='eco'?1:1.5;dpr=Math.min(window.devicePixelRatio||1,cap);
 renderer?.resize(width,height,dpr,settings.quality);layout();
}
new ResizeObserver(resize).observe(world);

// Öffentliche Schnittstelle für spätere Merges: Welle an einer Bildschirmposition.
function splash(x,y,power=1){
 renderer?.disturb(x/width,y/height,.3*power,6);
 addPulse(x,y,1.4*power);kickFloaters(x,y,0,0,.8*power);
}
function addPulse(x,y,power){pulses.push({x,y,start:performance.now(),power,nearField:true});if(pulses.length>40)pulses.shift();}
window.oceanClean={splash,cellCenter:i=>cellCenter(i,geometry),cellAt:(x,y)=>cellAt(x,y,geometry),get geometry(){return geometry;},settings,toggleGrid(){showGrid=!showGrid;drawDebug();},get renderer(){return renderer;}};

// ── Finger auf dem Wasser ─────────────────────────────────────────────
// Jeder gedrückte Finger (oder Maus) zieht eine Kapsel-Störung durch das
// Höhenfeld: schnell = stärker und breiter (gekappt). Daraus entstehen Bugwelle,
// Kielwasser und Ringwellen; an der Fingerspitze schimmert Gischt.
const touches=new Map();
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function localPoint(e){const r=world.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top,t:e.timeStamp||performance.now()};}
// Platzhalter in der Nähe werden leicht weggeschoben (Federn zurück aufs Feld).
function kickFloaters(x,y,dirX,dirY,strength){
 if(!geometry)return;const R=geometry.cell*1.35;
 for(const f of floaters){const fx=f.x+(f.ox||0),fy=f.y+(f.oy||0),dx=fx-x,dy=fy-y,d=Math.hypot(dx,dy);if(d>R)continue;
  const k=(1-d/R)*strength*geometry.cell*2.2,nx=d>1?dx/d:0,ny=d>1?dy/d:0;
  f.vx=(f.vx||0)+(nx*.7+dirX*.5)*k;f.vy=(f.vy||0)+(ny*.7+dirY*.5)*k;f.wobble=Math.min(1.5,(f.wobble||0)+strength*.9*(1-d/R));}
}
function moveTouch(state,p){
 const dx=p.x-state.x,dy=p.y-state.y,dist=Math.hypot(dx,dy);if(dist<.5)return;
 const dt=Math.max(.004,(p.t-state.t)/1000),speed=dist/dt;
 state.speed+=(Math.min(speed,4000)-state.speed)*.35;
 const strength=clamp(state.speed/1500,.12,1);
 const texel=width/(renderer?.simW||192),radius=clamp(14/texel,3.5,9)*(.8+.5*strength);
 renderer?.stroke(state.x/width,state.y/height,p.x/width,p.y/height,-(.045+.11*strength)*Math.min(1,dist/6+.35),radius);
 state.travel+=dist;
 if(state.travel>26){state.travel=0;addPulse(p.x,p.y,.5+1.1*strength);}
 kickFloaters(p.x,p.y,dx/dist,dy/dist,strength*.18);
 state.x=p.x;state.y=p.y;state.t=p.t;state.foamTarget=clamp((state.speed-350)/1600,0,1);
}
world.addEventListener('pointerdown',e=>{
 if(e.target.closest('a'))return;e.preventDefault();
 try{world.setPointerCapture(e.pointerId);}catch{}
 const p=localPoint(e);touches.set(e.pointerId,{...p,speed:0,travel:0,foam:0,foamTarget:0,down:true});splash(p.x,p.y,1);
});
world.addEventListener('pointermove',e=>{
 const state=touches.get(e.pointerId);if(!state||!state.down)return;e.preventDefault();
 const events=e.getCoalescedEvents?e.getCoalescedEvents():[];for(const ev of (events.length?events:[e]))moveTouch(state,localPoint(ev));
});
function release(e){const state=touches.get(e.pointerId);if(state){state.down=false;state.foamTarget=0;}}
for(const type of ['pointerup','pointercancel','lostpointercapture'])world.addEventListener(type,release);
// iOS: kein Scrollen, kein Pinch-Zoom, kein Doppeltipp-Zoom über dem Meer.
for(const type of ['touchstart','touchmove'])world.addEventListener(type,e=>{if(!e.target.closest('a'))e.preventDefault();},{passive:false});
for(const type of ['gesturestart','gesturechange','dblclick'])document.addEventListener(type,e=>e.preventDefault(),{passive:false});
addEventListener('keydown',e=>{if(e.key==='g'||e.key==='G')window.oceanClean.toggleGrid();});
function updateTouches(dt){
 const list=[];
 for(const [id,s] of touches){
  if(s.down)s.speed*=Math.exp(-dt*6);// stillstehender Finger beruhigt sich
  else s.foamTarget=0;
  if(s.down)s.foamTarget=Math.min(s.foamTarget,clamp((s.speed-350)/1600,0,1));
  s.foam+=(s.foamTarget-s.foam)*(1-Math.exp(-dt*(s.foamTarget>s.foam?14:3.5)));
  if(!s.down&&s.foam<.01){touches.delete(id);continue;}
  list.push({x:s.x/width,y:s.y/height,foam:s.foam*.85,radius:.022+s.foam*.02});
 }
 renderer?.setTouches(list);
}

function updateFloaters(now,dt){
 const seconds=now/1000,energy=settings.swell/100;pulses=pulses.filter(p=>now-p.start<INTERACTION_WAVE_LIFETIME);
 for(const f of floaters){
  const wave=sampleInteractionWaves(pulses,f.x,f.y,now);
  const surface=sampleSeaMotion(f.x/width,f.y/height,{width,height,camera,time:renderer.time,swell:settings.swell});
  f.ox=f.ox||0;f.oy=f.oy||0;f.vx=f.vx||0;f.vy=f.vy||0;f.wobble=Math.max(0,(f.wobble||0)-dt*1.2);
  // Feder zurück aufs Rasterfeld, gedämpft.
  f.vx+=(-f.ox*9-f.vx*3.2)*dt;f.vy+=(-f.oy*9-f.vy*3.2)*dt;f.ox=clamp(f.ox+f.vx*dt,-geometry.cell*.6,geometry.cell*.6);f.oy=clamp(f.oy+f.vy*dt,-geometry.cell*.6,geometry.cell*.6);
  const fl=stepBuoyancy(f,{...surface,pitch:(surface.pitch||0)-wave.slopeY*320,roll:(surface.roll||0)+wave.slopeX*320},wave.height,dt,reducedMotion);
  const tilt=reducedMotion?0:Math.sin(seconds*.9+f.phase)*(2.2+energy*3)+wave.height*3+Math.sin(seconds*7+f.phase)*f.wobble*9;
  const drift=reducedMotion?{x:0,y:0}:{x:Math.sin(seconds*.37+f.phase)*geometry.cell*.035,y:Math.cos(seconds*.31+f.phase*1.3)*geometry.cell*.03};
  // Von oben gesehen: Anheben = leicht größer + Schatten weiter weg; Kippen per Perspektive.
  const lift=-fl.bob,scale=1+lift*.007-fl.dip*.25;
  f.el.style.transform=`translate3d(${f.x+drift.x+f.ox}px,${f.y+drift.y+f.oy}px,0)`;
  f.art.style.transform=`translate(-50%,-50%) translateY(${fl.bob*.5}px) perspective(260px) rotateX(${fl.pitch}deg) rotateY(${fl.roll}deg) rotateZ(${tilt}deg) scale(${scale})`;
  f.el.style.setProperty('--dip',fl.dip.toFixed(3));f.el.style.setProperty('--lift',lift.toFixed(2));
 }
}

function animate(now){
 if(!renderer)return;const dt=Math.min((now-(lastFrame||now-16.67))/1000,.04);lastFrame=now;
 camera.step(dt,!reducedMotion);renderer.setCamera(camera.x,camera.y);
 if(now-lastAmbient>3300&&!reducedMotion&&settings.swell>3){
  // Breiter, unregelmäßiger Dünungszug wie im Original – hier vom offenen Meer.
  const phase=renderer.time||0;
  for(let i=0;i<12;i++){const x=(i+.5)/12;renderer.disturb(x,.9+Math.sin(x*6+phase*.24)*.01,(.003+settings.swell*.00014)*(.85+.15*Math.sin(x*7+phase)),12);}
  renderer.ripples.length=Math.max(0,renderer.ripples.length-12);// nur Simulation, keine Ringe im Fallback-Pfad
  lastAmbient=now;
 }
 updateTouches(dt);renderer.advance(dt,settings);updateFloaters(now,dt);raf=requestAnimationFrame(animate);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else{lastFrame=0;if(renderer&&!raf)raf=requestAnimationFrame(animate);}});

const floor=new Image();floor.src=new URL('./assets/open-sea-floor.png',import.meta.url).href;
async function init(){
 try{
  await floor.decode();
  try{renderer=new WaterSurface(canvas,floor);}catch(error){
   console.warn('WebGL2 nicht verfügbar, 2D-Fallback:',error.message);
   const replacement=canvas.cloneNode(false);canvas.replaceWith(replacement);canvas=replacement;renderer=new CanvasSurface(canvas,floor);
  }
  resize();renderer.advance(0,settings);document.body.classList.add('loaded');raf=requestAnimationFrame(animate);
  if(!reducedMotion)setTimeout(()=>{renderer.disturb(.5,.55,.084,4);addPulse(width*.5,height*.55,.6);},900);
 }catch(error){console.error('Ocean Clean water:',error);document.body.classList.add('loaded');}
}
init();
