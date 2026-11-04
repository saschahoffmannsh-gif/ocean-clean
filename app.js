import {WaterSurface,CanvasSurface} from './water.js';
import {SeaCamera} from './camera.js';
import {sampleSeaMotion,sampleInteractionWaves,stepBuoyancy,INTERACTION_WAVE_LIFETIME} from './buoyancy.js';
import {GRID_SIZE,gridGeometry,cellCenter,cellAt} from './grid.js';

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
 renderer?.disturb(x/width,y/height,.14*power,4);
 pulses.push({x,y,start:performance.now(),power,nearField:true});if(pulses.length>12)pulses.shift();
}
window.oceanClean={splash,cellCenter:i=>cellCenter(i,geometry),cellAt:(x,y)=>cellAt(x,y,geometry),get geometry(){return geometry;},settings,toggleGrid(){showGrid=!showGrid;drawDebug();}};

world.addEventListener('pointerdown',e=>{if(e.target.closest('a'))return;const r=world.getBoundingClientRect();splash(e.clientX-r.left,e.clientY-r.top,1);});
addEventListener('keydown',e=>{if(e.key==='g'||e.key==='G')window.oceanClean.toggleGrid();});

function updateFloaters(now,dt){
 const seconds=now/1000,energy=settings.swell/100;pulses=pulses.filter(p=>now-p.start<INTERACTION_WAVE_LIFETIME);
 for(const f of floaters){
  const wave=sampleInteractionWaves(pulses,f.x,f.y,now);
  const surface=sampleSeaMotion(f.x/width,f.y/height,{width,height,camera,time:renderer.time,swell:settings.swell});
  const fl=stepBuoyancy(f,{...surface,pitch:(surface.pitch||0)-wave.slopeY*320,roll:(surface.roll||0)+wave.slopeX*320},wave.height,dt,reducedMotion);
  const tilt=reducedMotion?0:Math.sin(seconds*.9+f.phase)*(2.2+energy*3)+wave.height*3;
  const drift=reducedMotion?{x:0,y:0}:{x:Math.sin(seconds*.37+f.phase)*geometry.cell*.035,y:Math.cos(seconds*.31+f.phase*1.3)*geometry.cell*.03};
  // Von oben gesehen: Anheben = leicht größer + Schatten weiter weg; Kippen per Perspektive.
  const lift=-fl.bob,scale=1+lift*.007-fl.dip*.25;
  f.el.style.transform=`translate3d(${f.x+drift.x}px,${f.y+drift.y}px,0)`;
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
 renderer.advance(dt,settings);updateFloaters(now,dt);raf=requestAnimationFrame(animate);
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
  if(!reducedMotion)setTimeout(()=>splash(width*.5,height*.55,.6),900);
 }catch(error){console.error('Ocean Clean water:',error);document.body.classList.add('loaded');}
}
init();
