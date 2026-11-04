import {WaterSurface,CanvasSurface} from './core/water.js';
import {CoastCamera} from './core/camera.js';
import {SEA_FEEL} from './core/game-feel.js';
import {resolveWaterSettings} from './core/water-settings.js';
import {sampleSeaMotion,sampleInteractionWaves,stepBuoyancy} from './core/buoyancy.js';
import {VoyageTouch} from './core/voyage-touch.js';
import {OceanAudio} from './ocean-audio.js';
export {sampleSeaMotion,sampleInteractionWaves,stepBuoyancy,SEA_FEEL};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const WATER_PRESET=Object.freeze({swell:85,light:65,quality:'auto',sound:false,mode:'ripple',swellDefaultRevision:2});
// A thin portable host around the unmodified Ocean Clean water modules.
export class OceanWater{
 static async create(root,options={}){const ocean=new OceanWater(root,options);await ocean.init();return ocean;}
 constructor(root,{settings={},gesture='game',travel=.10,reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches}={}){
  this.root=root;this.reducedMotion=reducedMotion;this.settings=resolveWaterSettings(settings,reducedMotion);this.gesture=gesture;this.travel=travel;this.camera=new CoastCamera();this.activePointers=new Map();this.vortices=[];this.particles=[];this.pulses=[];this.raf=0;this.lastFrame=0;this.lastAmbient=0;this.width=1;this.height=1;this.dpr=1;this.destroyed=false;this.calmUntil=0;this.events=new AbortController();this.audio=new OceanAudio(this.settings);
  this.canvas=document.createElement('canvas');this.canvas.className='ocean-surface';this.canvas.tabIndex=0;this.canvas.setAttribute('aria-label','Interaktive Wasseroberfläche. Tippen und Wischen erzeugen Wellen.');this.spray=document.createElement('canvas');this.spray.className='ocean-spray';this.spray.setAttribute('aria-hidden','true');root.append(this.canvas,this.spray);this.sprayContext=this.spray.getContext('2d');
  this.fingerWater=new VoyageTouch({disturb:(...a)=>this.disturb(...a),rect:()=>this.canvas.getBoundingClientRect(),active:()=>this.gesture==='voyage',reducedMotion});
 }
 async init(){
  this.image=new Image();this.image.src=new URL('./assets/coast-no-tent-v4.png',import.meta.url).href;await this.image.decode();
  try{this.surface=new WaterSurface(this.canvas,this.image);this.renderer='webgl2';}catch{const next=this.canvas.cloneNode(false);this.canvas.replaceWith(next);this.canvas=next;this.surface=new CanvasSurface(this.canvas,this.image);this.renderer='canvas';}
  this.canvas.dataset.renderer=this.renderer;this.surface.setObjectAnchoring(.9);this.surface.setOceanView(this.travel);this.resize();this.bindInput();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(this.root);
  this.canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.pause();},{signal:this.events.signal});
  this.canvas.addEventListener('webglcontextrestored',()=>{if(this.destroyed)return;try{this.surface=new WaterSurface(this.canvas,this.image);this.surface.setObjectAnchoring(.9);this.surface.setOceanView(this.travel);this.resize();this.start();}catch(error){this.root.dispatchEvent(new CustomEvent('ocean-error',{detail:error}));}},{signal:this.events.signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){this.clearPointers();this.pause();this.audio.context?.suspend().catch(()=>{});}else{this.start();if(this.settings.sound)this.audio.start().catch(()=>{});}},{signal:this.events.signal});
  window.addEventListener('blur',()=>this.clearPointers(),{signal:this.events.signal});this.start();return this;
 }
 resize(){const r=this.root.getBoundingClientRect();this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);const cap=this.settings.quality==='high'?2:this.settings.quality==='eco'?1:1.5;this.dpr=Math.min(devicePixelRatio||1,cap);this.surface?.resize(this.width,this.height,this.dpr,this.settings.quality);this.spray.width=Math.round(this.width*this.dpr);this.spray.height=Math.round(this.height*this.dpr);this.clearPointers();}
 start(){if(this.destroyed||this.raf||document.hidden)return;this.lastFrame=0;this.raf=requestAnimationFrame(now=>this.frame(now));}
 pause(){cancelAnimationFrame(this.raf);this.raf=0;this.lastFrame=0;}
 frame(now){
  if(this.destroyed||document.hidden){this.raf=0;return;}const dt=Math.min((now-(this.lastFrame||now-16.67))/1000,.04);this.lastFrame=now;this.camera.step(dt);this.surface.setCamera(this.camera.x,this.camera.y);this.surface.setOceanView(this.travel);
  for(const v of this.vortices)v.strength+=(v.target-v.strength)*Math.min(1,dt*(v.released?1.5:3.7));this.vortices=this.vortices.filter(v=>!v.released||v.strength>.015);
  for(const p of this.activePointers.values()){if(p.vortex&&now-p.lastDrop>110){this.disturb(p.x,p.y,-.045,4);p.lastDrop=now;}else if(p.mode==='flow'&&now-p.lastDrop>110){this.disturb(p.x,p.y,.035,4);p.lastDrop=now;}}
  if(now-this.lastAmbient>SEA_FEEL.ambientInterval&&now>this.calmUntil&&!this.reducedMotion&&this.settings.swell>3){const phase=this.surface.time||0;for(let i=0;i<12;i++){const x=(i+.5)/12;this.disturb(x,.91+Math.sin(x*6+phase*.24)*.008,(.008+this.settings.swell*.00032)*(.85+.15*Math.sin(x*7+phase)),12);}this.lastAmbient=now;}
  const settings=now<this.calmUntil?{...this.settings,swell:2}:this.settings;this.surface.advance(dt,settings,this.vortices);this.paintSpray(dt);this.pulses=this.pulses.filter(p=>now-p.start<SEA_FEEL.waveLifetime);this.raf=requestAnimationFrame(time=>this.frame(time));
 }
 interact(){this.calmUntil=0;if(this.settings.sound)this.audio.start().catch(()=>{});}
 disturb(x,y,amplitude=.17,radius=4,withSplash=false,nearField=false){
  if(!this.surface||!Number.isFinite(x+y+amplitude+radius))return;this.surface.disturb(x,y,amplitude,radius);this.pulses.push({x:x*this.width,y:y*this.height,power:clamp(amplitude/.27,-2,2),nearField,start:performance.now()});if(this.pulses.length>48)this.pulses.shift();if(withSplash)this.splashes(x,y,Math.min(1.7,amplitude*5));
 }
 motionWake(x,y,dx,dy,power=.95){
  if(this.reducedMotion||!this.surface)return;const distance=Math.hypot(dx,dy);if(distance<1)return;const ux=dx/distance,uy=dy/distance;
  this.disturb(x+ux*12/this.width,y+uy*12/this.height,.31*power,6.2,false,true);this.disturb(x-ux*16/this.width,y-uy*16/this.height,-.17*power,5.2,false,true);if(power>.8)this.splashes(x+ux*12/this.width,y+uy*12/this.height,.55,3);
 }
 splashes(x,y,power=1,count=8){if(this.reducedMotion)return;for(let i=0;i<count;i++){const angle=Math.random()*Math.PI*2,speed=(17+Math.random()*42)*power;this.particles.push({x:x*this.width,y:y*this.height,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed*.4-35*power,life:0,maxLife:.35+Math.random()*.32,size:.9+Math.random()*1.4});}if(this.particles.length>150)this.particles.splice(0,this.particles.length-150);}
 paintSpray(dt){const c=this.sprayContext;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,this.width,this.height);this.particles=this.particles.filter(p=>p.life<p.maxLife);for(const p of this.particles){p.life+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=160*dt;const alpha=Math.max(0,1-p.life/p.maxLife);c.beginPath();c.ellipse(p.x,p.y,p.size*alpha,p.size*alpha*1.5,.15,0,Math.PI*2);c.fillStyle=`rgba(238,255,244,${alpha*.8})`;c.fill();}}
 point(event){const r=this.canvas.getBoundingClientRect();return{x:clamp((event.clientX-r.left)/r.width,0,1),y:clamp((event.clientY-r.top)/r.height,0,1)};}
 bindInput(){
  const options={signal:this.events.signal};
  this.canvas.addEventListener('pointerdown',event=>{
   if(event.button>0||this.activePointers.has(event.pointerId))return;event.preventDefault();this.interact();const p=this.point(event),now=performance.now(),mode=this.gesture;
   const state={...p,lastDrop:now,mode,vortex:null};this.activePointers.set(event.pointerId,state);this.canvas.setPointerCapture(event.pointerId);
   if(mode==='voyage')this.fingerWater.sample(event.clientX,event.clientY,now,{begin:true});else if(mode==='vortex'){state.vortex={...p,strength:0,target:.95,released:false};this.vortices.push(state.vortex);if(this.vortices.length>4)this.vortices.shift();this.disturb(p.x,p.y,.09,4,true);}else this.disturb(p.x,p.y,mode==='flow'?.12:.23,mode==='flow'?3.5:5,true);
   this.audio.plop();
  },options);
  this.canvas.addEventListener('pointermove',event=>{
   const state=this.activePointers.get(event.pointerId);if(!state)return;event.preventDefault();const p=this.point(event),now=performance.now(),dx=(p.x-state.x)*this.width,dy=(p.y-state.y)*this.height,distance=Math.hypot(dx,dy);
   if(state.vortex){state.x=p.x;state.y=p.y;state.vortex.x=p.x;state.vortex.y=p.y;return;}
   if(state.mode==='voyage'){this.fingerWater.sample(event.clientX,event.clientY,now);this.setTravel(this.travel-dy/Math.max(400,this.height)*.34);state.x=p.x;state.y=p.y;return;}
   if(state.mode==='game'){if(distance>3&&now-state.lastDrop>40){this.motionWake(p.x,p.y,dx,dy,.95);state.x=p.x;state.y=p.y;state.lastDrop=now;}return;}
   if(distance>1.5&&now-state.lastDrop>15){const steps=Math.min(7,Math.max(1,Math.floor(distance/7)));for(let i=1;i<=steps;i++){const f=i/steps;this.disturb(state.x+(p.x-state.x)*f,state.y+(p.y-state.y)*f,state.mode==='flow'?.095:.07,state.mode==='flow'?3.7:2.5);}if(distance>9&&Math.random()>.5)this.splashes(p.x,p.y,.55,2);state.x=p.x;state.y=p.y;state.lastDrop=now;}
  },options);
  const release=event=>{const state=this.activePointers.get(event.pointerId);if(!state)return;this.activePointers.delete(event.pointerId);if(state.vortex){state.vortex.released=true;state.vortex.target=0;}else if(event.type==='pointerup'&&state.mode!=='voyage')this.disturb(state.x,state.y,.075,3);this.fingerWater.end();if(this.canvas.hasPointerCapture(event.pointerId))this.canvas.releasePointerCapture(event.pointerId);};
  for(const name of ['pointerup','pointercancel','lostpointercapture'])this.canvas.addEventListener(name,release,options);
  this.canvas.addEventListener('contextmenu',e=>e.preventDefault(),options);
  this.canvas.addEventListener('wheel',e=>{if(this.gesture!=='voyage')return;e.preventDefault();this.setTravel(this.travel+e.deltaY/Math.max(400,this.height)*.34);},{...options,passive:false});
 }
 clearPointers(){for(const v of this.vortices){v.released=true;v.target=0;}this.activePointers.clear();this.fingerWater.end();}
 setGesture(gesture){if(!['game','voyage','ripple','flow','vortex'].includes(gesture))return;this.clearPointers();this.gesture=gesture;}
 setTravel(travel){if(Number.isFinite(travel))this.travel=travel;}
 setSettings(patch){const previousQuality=this.settings.quality,next=resolveWaterSettings({...this.settings,...patch},this.reducedMotion);Object.assign(this.settings,next);if(previousQuality!==this.settings.quality)this.resize();if(this.settings.sound)this.audio.start().catch(()=>{});else this.audio.stop().catch(()=>{});return{...this.settings};}
 sample(x,y){return sampleSeaMotion(x,y,{width:this.width,height:this.height,camera:this.camera,time:this.surface.time,swell:this.settings.swell});}
 sampleLocalWaves(x,y,now=performance.now()){return sampleInteractionWaves(this.pulses,x*this.width,y*this.height,now);}
 calm(){this.surface.calm();this.clearPointers();this.vortices=[];this.pulses=[];this.particles=[];this.calmUntil=performance.now()+9000;}
 destroy(){this.destroyed=true;this.pause();this.events.abort();this.observer?.disconnect();this.clearPointers();this.audio.context?.close().catch(()=>{});this.surface.gl?.getExtension('WEBGL_lose_context')?.loseContext();this.canvas.remove();this.spray.remove();}
}
