import {OceanWater} from './water-13.0.0/ocean.js';
import {TrashLayer} from './src/trash-layer.js?v=20261104-trash1';
const root=document.querySelector('#ocean'),error=document.querySelector('#error');
const fail=message=>{error.hidden=false;error.textContent=message;};
try{
 const ocean=await OceanWater.create(root,{settings:{swell:85,light:65,quality:'auto'},gesture:'game',travel:.10});
 root.addEventListener('ocean-error',()=>fail('Die Wasseroberfläche konnte nicht wiederhergestellt werden. Bitte die Seite neu laden.'));
 const trash=await new TrashLayer(ocean).init();
 window.oceanClean={ocean,trash};
}catch(e){fail('Das Meer konnte nicht geladen werden. Bitte die Seite neu laden.');console.error(e);}
