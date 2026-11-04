// Ocean Clean: reines Original-Meer (Ocean Water 13.0.0, unverändert unter ./water-13.0.0/).
// Spielprofil 'game', offenes Meer travel 0.10, Standardwerte swell 85 / light 65 / quality auto.
import {OceanWater} from './water-13.0.0/ocean.js';
const root=document.querySelector('#ocean'),error=document.querySelector('#error');
const fail=message=>{error.hidden=false;error.textContent=message;};
try{
 const ocean=await OceanWater.create(root,{settings:{swell:85,light:65,quality:'auto'},gesture:'game',travel:.10});
 root.addEventListener('ocean-error',()=>fail('Die Wasseroberfläche konnte nicht wiederhergestellt werden. Bitte die Seite neu laden.'));
 window.oceanClean={ocean};
}catch(e){fail('Das Meer konnte nicht geladen werden. Bitte die Seite neu laden.');console.error(e);}
