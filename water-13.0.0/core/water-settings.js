export const DEFAULT_SWELL=85;
export const validModes=['ripple','flow','vortex'],validQualities=['auto','high','eco'];
// Preserve deliberate choices. Only the former untouched default (32) adopts
// the new preset once; later choices, including 32, carry this revision marker.
export function resolveWaterSettings(saved={},reducedMotion=false){
 if(!saved||typeof saved!=='object')saved={};
 const settings={swell:reducedMotion?12:DEFAULT_SWELL,light:65,sound:false,quality:'auto',mode:'ripple',swellDefaultRevision:2};
 for(const key of ['swell','light'])if(typeof saved[key]==='number'&&Number.isFinite(saved[key]))settings[key]=Math.max(0,Math.min(100,saved[key]));
 if(saved.swellDefaultRevision!==2&&saved.swell===32&&!reducedMotion)settings.swell=DEFAULT_SWELL;
 if(typeof saved.sound==='boolean')settings.sound=saved.sound;
 if(validModes.includes(saved.mode))settings.mode=saved.mode;
 if(validQualities.includes(saved.quality))settings.quality=saved.quality;
 return settings;
}
