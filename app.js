import {OceanWater} from './water-13.0.0/ocean.js';
import {makeConfig} from './src/config.js?v=20261104-full7';
import {TrashLayer} from './src/trash-layer.js?v=20261105-items3d3';
import {SwipeInput,tuneWater} from './src/swipe-input.js?v=20261104-full7';
import {wantsItems3D} from './src/trash-pose.js?v=20261105-items3d3';
const root=document.querySelector('#ocean'),error=document.querySelector('#error');
const fail=message=>{error.hidden=false;error.textContent=message;};
try{
 const config=makeConfig();
 const ocean=await OceanWater.create(root,{settings:{swell:config.water.swell,light:config.water.light,quality:'auto'},gesture:'game',travel:.10});
 tuneWater(ocean,config.water);
 const input=new SwipeInput(ocean,config);
 root.addEventListener('ocean-error',()=>fail('Die Wasseroberfläche konnte nicht wiederhergestellt werden. Bitte die Seite neu laden.'));
 const trash=await new TrashLayer(ocean,config,input).init();
 window.oceanClean={ocean,trash,input,config,version:window.OCEAN_CLEAN_VERSION};
 // 3D-Netze nur auf Wunsch. Ohne Schalter bleiben die PNG-Sprites (v2026.11.04-7).
 if(wantsItems3D(location.search)){
  try{
   const {attachItems3D}=await import('./src/trash-items3d.js?v=20261105-items3d3');
   const view=attachItems3D(trash),ver=document.querySelector('#app-version');
   if(ver)ver.textContent=view?'v2026.11.04-7 · 3D':'v2026.11.04-7 · PNG';
   if(!view)console.info('Ocean Clean: WebGL für 3D-Items fehlt, PNG-Sprites bleiben.');
  }catch(e){console.warn('Ocean Clean: 3D-Items Fallback auf PNG.',e);const ver=document.querySelector('#app-version');if(ver)ver.textContent='v2026.11.04-7 · PNG';}
 }
 if(new URLSearchParams(location.search).has('debug'))import('./src/debug.js?v=20261105-items3d1').then(m=>m.startDebug(window.oceanClean));
 // Vollbild: bei Drehung / Browserleisten-Änderung Wasser und Müll-Canvas neu vermessen
 let pending=0;const refit=()=>{cancelAnimationFrame(pending);pending=requestAnimationFrame(()=>{const r=root.getBoundingClientRect();
  if(Math.abs(r.width-ocean.width)>.5||Math.abs(r.height-ocean.height)>.5)ocean.resize();trash.resize();});};
 addEventListener('orientationchange',()=>setTimeout(refit,250));addEventListener('resize',refit);visualViewport?.addEventListener('resize',refit);
}catch(e){fail('Das Meer konnte nicht geladen werden. Bitte die Seite neu laden.');console.error(e);}
