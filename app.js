import {OceanWater} from './water-13.0.0/ocean.js';
import {makeConfig} from './src/config.js?v=20261104-band1';
import {TrashLayer} from './src/trash-layer.js?v=20261104-band1';
import {SwipeInput,tuneWater} from './src/swipe-input.js?v=20261104-band1';
const root=document.querySelector('#ocean'),error=document.querySelector('#error');
const fail=message=>{error.hidden=false;error.textContent=message;};
try{
 const config=makeConfig();
 const ocean=await OceanWater.create(root,{settings:{swell:config.water.swell,light:config.water.light,quality:'auto'},gesture:'game',travel:.10});
 tuneWater(ocean,config.water);
 const input=new SwipeInput(ocean,config);
 root.addEventListener('ocean-error',()=>fail('Die Wasseroberfläche konnte nicht wiederhergestellt werden. Bitte die Seite neu laden.'));
 const trash=await new TrashLayer(ocean,config,input).init();
 window.oceanClean={ocean,trash,input,config};
}catch(e){fail('Das Meer konnte nicht geladen werden. Bitte die Seite neu laden.');console.error(e);}
