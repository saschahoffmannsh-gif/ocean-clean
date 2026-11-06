import {OceanWater} from './water-13.0.0/ocean.js';
import {makeConfig} from './src/config.js?v=20261105-heap12';
import {PileLayer} from './src/pile-layer.js?v=20261105-heap12';
import {SwipeInput,tuneWater} from './src/swipe-input.js?v=20261105-heap12';
const root=document.querySelector('#ocean'),error=document.querySelector('#error');
const fail=message=>{error.hidden=false;error.textContent=message;};
try{
 const config=makeConfig();
 const ocean=await OceanWater.create(root,{settings:{swell:config.water.swell,light:config.water.light,quality:'auto'},gesture:'game',travel:.10});
 tuneWater(ocean,config.water);
 const input=new SwipeInput(ocean,config);
 root.addEventListener('ocean-error',()=>fail('Die Wasseroberfläche konnte nicht wiederhergestellt werden. Bitte die Seite neu laden.'));
 const pile=await new PileLayer(ocean,config,input).init();
 window.oceanClean={ocean,pile,trash:pile,input,config,version:window.OCEAN_CLEAN_VERSION};
 if(new URLSearchParams(location.search).has('debug'))import('./src/debug.js?v=20261105-heap12').then(m=>m.startDebug(window.oceanClean));
 let pending=0;const refit=()=>{cancelAnimationFrame(pending);pending=requestAnimationFrame(()=>{const r=root.getBoundingClientRect();
  if(Math.abs(r.width-ocean.width)>.5||Math.abs(r.height-ocean.height)>.5)ocean.resize();pile.resize();});};
 addEventListener('orientationchange',()=>setTimeout(refit,250));addEventListener('resize',refit);visualViewport?.addEventListener('resize',refit);
}catch(e){fail('Das Meer konnte nicht geladen werden. Bitte die Seite neu laden.');console.error(e);}
