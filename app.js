import {WaterSurface,CanvasSurface} from './water.js?v=20261104-orig';
import {SeaCamera} from './camera.js?v=20261104-orig';
import {sampleSeaMotion,sampleInteractionWaves,stepBuoyancy,INTERACTION_WAVE_LIFETIME} from './buoyancy.js?v=20261104-orig';
import {GRID_SIZE,gridGeometry,cellCenter,cellAt} from './grid.js?v=20261104-orig';

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
 renderer?.resize(width,height,dpr,settings.quality);spray.width=Math.round(width*dpr);spray.height=Math.round(height*dpr);layout();
}
new ResizeObserver(resize).observe(world);

// Öffentliche Schnittstelle für spätere Merges: Welle an einer Bildschirmposition.
function splash(x,y,power=1){
 drop(x/width,y/height,.26*power,5.5,true,true);kickFloaters(x,y,0,0,.6*power);
}
// ── Wasser-Interaktion 1:1 wie im Original Ocean Merge ────────────────
// Viele kleine, scharfe Tropfen (Radius 2,5 Texel) entlang der Fingerspur statt
// einer breiten, weichen Spur: genau das erzeugt die feinen, hellen Kräuselwellen
// und die stark tanzenden Lichtnetze. Dazu Spritzer-Partikel und Bugwellen-Bögen.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
let particles=[],wakes=[];
function addPulse(x,y,power){pulses.push({x,y,start:performance.now(),power,nearField:true});if(pulses.length>40)pulses.shift();}
function splashes(x,y,power=1,count=8){if(reducedMotion)return;for(let i=0;i<count;i++){const angle=Math.random()*Math.PI*2,speed=(17+Math.random()*42)*power;particles.push({x:x*width,y:y*height,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed*.4-35*power,life:0,maxLife:.35+Math.random()*.32,size:.9+Math.random()*1.4});}if(particles.length>150)particles.splice(0,particles.length-150);}
let lastPulseAt=0;
function drop(x,y,amplitude=.17,radius=4,withSplash=false,nearField=false){
 if(!renderer)return;renderer.disturb(x,y,amplitude,radius);
 // Platzhalter reagieren auf jede Störung (wie game.reactToWater im Original), gedrosselt.
 const now=performance.now();if(nearField||now-lastPulseAt>60){lastPulseAt=now;addPulse(x*width,y*height,Math.max(.35,amplitude/.27)*1.2);}
 if(withSplash)splashes(x,y,Math.min(1.7,amplitude*5));
}
// Bugwelle wie motionWake im Original: Kamm vor dem Finger, Senke dahinter.
function motionWake(x,y,dx,dy,power){
 if(reducedMotion||!renderer)return;const distance=Math.hypot(dx,dy);if(distance<1)return;const ux=dx/distance,uy=dy/distance;
 drop(x+ux*10/width,y+uy*10/height,.22*power,5.2,false,true);
 drop(x-ux*14/width,y-uy*14/height,-.12*power,4.2,false,true);
 wakes.push({x:x*width,y:y*height,angle:Math.atan2(dy,dx),life:0,power});if(wakes.length>36)wakes.shift();
 if(power>.8)splashes(x+ux*10/width,y+uy*10/height,.3,2);
}
// Platzhalter in der Nähe werden leicht weggeschoben (Federn zurück aufs Feld).
function kickFloaters(x,y,dirX,dirY,strength){
 if(!geometry)return;const R=geometry.cell*1.35;
 for(const f of floaters){const fx=f.x+(f.ox||0),fy=f.y+(f.oy||0),dx=fx-x,dy=fy-y,d=Math.hypot(dx,dy);if(d>R)continue;
  const k=(1-d/R)*strength*geometry.cell*2.2,nx=d>1?dx/d:0,ny=d>1?dy/d:0;
  f.vx=(f.vx||0)+(nx*.7+dirX*.5)*k;f.vy=(f.vy||0)+(ny*.7+dirY*.5)*k;f.wobble=Math.min(1.5,(f.wobble||0)+strength*.9*(1-d/R));}
}
const activePointers=new Map();
function point(e){const r=canvas.getBoundingClientRect();return{x:clamp((e.clientX-r.left)/r.width,0,1),y:clamp((e.clientY-r.top)/r.height,0,1)};}
world.addEventListener('pointerdown',e=>{
 if(e.target.closest('a')||!renderer||e.button>0)return;e.preventDefault();
 try{world.setPointerCapture(e.pointerId);}catch{}
 const p=point(e),now=performance.now();
 activePointers.set(e.pointerId,{...p,previousX:p.x,previousY:p.y,lastDrop:now,wakeAt:-Infinity,wakePoint:{x:p.x*width,y:p.y*height},speed:0});
 splash(p.x*width,p.y*height,1);
});
world.addEventListener('pointermove',e=>{
 const state=activePointers.get(e.pointerId);if(!state)return;e.preventDefault();
 const p=point(e),now=performance.now(),distance=Math.hypot((p.x-state.x)*width,(p.y-state.y)*height);
 // Bugwelle wie beim Wischen übers Spielfeld im Original (MergeGame.trail): alle 48 ms ab 6 px,
 // bis zu 3 Zwischenpunkte. Stärke .6 wie im Original, bei schnellen Wischern bis 1.
 const wp=state.wakePoint,px=p.x*width,py=p.y*height,wd=Math.hypot(px-wp.x,py-wp.y);
 if(now-state.wakeAt>=48&&wd>=6){const steps=Math.min(3,Math.ceil(wd/18)),power=clamp(.6+state.speed/3500,.6,1);
  for(let i=1;i<=steps;i++){const fx=wp.x+(px-wp.x)*(i-1)/steps,fy=wp.y+(py-wp.y)*(i-1)/steps,tx=wp.x+(px-wp.x)*i/steps,ty=wp.y+(py-wp.y)*i/steps;motionWake(tx/width,ty/height,tx-fx,ty-fy,power);}
  state.wakePoint={x:px,y:py};state.wakeAt=now;}
 // Original: höchstens alle 15 ms, ab 1,5 px, bis zu 7 interpolierte Tropfen je Schritt.
 if(distance>1.5&&now-state.lastDrop>15){
  const dt=Math.max(.008,(now-state.lastDrop)/1000);state.speed+=(Math.min(distance/dt,3000)-state.speed)*.5;
  const boost=1+clamp(state.speed/1800,0,.45);// verstärkt nur bei schnellen Wischern, gekappt
  const steps=Math.min(10,Math.max(1,Math.floor(distance/7)));
  for(let i=1;i<=steps;i++){const f=i/steps;renderer.disturb(state.x+(p.x-state.x)*f,state.y+(p.y-state.y)*f,.07*boost,2.5);}
  const dx=(p.x-state.x)*width,dy=(p.y-state.y)*height;
  if(now-lastPulseAt>60){lastPulseAt=now;addPulse(p.x*width,p.y*height,.5*boost);}
  kickFloaters(p.x*width,p.y*height,dx/distance,dy/distance,.12*boost);
  if(distance>9&&Math.random()>.5)splashes(p.x,p.y,.55,2);
  state.previousX=state.x;state.previousY=state.y;state.x=p.x;state.y=p.y;state.lastDrop=now;
 }
});
function releasePointer(e){const state=activePointers.get(e.pointerId);if(!state)return;if(e.type==='pointerup')drop(state.x,state.y,.075,3);activePointers.delete(e.pointerId);try{if(world.hasPointerCapture(e.pointerId))world.releasePointerCapture(e.pointerId);}catch{}}
for(const type of ['pointerup','pointercancel','lostpointercapture'])world.addEventListener(type,releasePointer);
// iOS: kein Scrollen, kein Pinch-Zoom, kein Doppeltipp-Zoom über dem Meer.
world.addEventListener('touchmove',e=>{if(!e.target.closest('a'))e.preventDefault();},{passive:false});
for(const type of ['gesturestart','gesturechange'])document.addEventListener(type,e=>e.preventDefault(),{passive:false});
world.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('keydown',e=>{if(e.key==='g'||e.key==='G')window.oceanClean.toggleGrid();});
window.oceanClean={splash,cellCenter:i=>cellCenter(i,geometry),cellAt:(x,y)=>cellAt(x,y,geometry),get geometry(){return geometry;},settings,toggleGrid(){showGrid=!showGrid;drawDebug();},get renderer(){return renderer;}};
const spray=$('#spray'),sprayContext=spray.getContext('2d');
function paintSpray(dt){
 sprayContext.setTransform(dpr,0,0,dpr,0,0);sprayContext.clearRect(0,0,width,height);
 wakes=wakes.filter(w=>w.life<.48);for(const w of wakes){w.life+=dt;const age=w.life/.48,spread=13+age*14,tail=22+age*20;
  sprayContext.save();sprayContext.translate(w.x,w.y);sprayContext.rotate(w.angle);sprayContext.lineWidth=2.1-age*1.1;sprayContext.lineCap='round';sprayContext.strokeStyle=`rgba(229,255,242,${Math.max(0,1-age)**1.8*.55*w.power})`;
  sprayContext.beginPath();sprayContext.moveTo(8,-spread);sprayContext.quadraticCurveTo(19,0,8,spread);sprayContext.stroke();
  for(const side of [-1,1]){sprayContext.beginPath();sprayContext.moveTo(-3,side*spread);sprayContext.quadraticCurveTo(-tail*.5,side*(spread+2),-tail,side*(spread+10));sprayContext.stroke();}sprayContext.restore();}
 particles=particles.filter(p=>p.life<p.maxLife);for(const p of particles){p.life+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=160*dt;const alpha=Math.max(0,1-p.life/p.maxLife);sprayContext.beginPath();sprayContext.ellipse(p.x,p.y,p.size*alpha,p.size*alpha*1.5,.15,0,Math.PI*2);sprayContext.fillStyle=`rgba(238,255,244,${alpha*.8})`;sprayContext.fill();}
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
 renderer.advance(dt,settings);updateFloaters(now,dt);paintSpray(dt);raf=requestAnimationFrame(animate);
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
