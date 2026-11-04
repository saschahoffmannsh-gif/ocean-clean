// Shared by the GPU water, CPU flotation and input feedback. Keep the visible
// crest and the objects riding it on exactly the same clock.
export const SEA_FEEL=Object.freeze({surfPeriod:7.6,surfGain:1.85,crestWidthGain:1.5,swellGain:1.22,ambientInterval:2100,waveLifetime:2000,waveSpeed:250,waveWidth:46,waveDecay:1.15});
export const FLOAT_FEEL=Object.freeze({maxHeave:9.5,maxPitch:12,maxRoll:10,maxDip:.16,responseGain:4.7});
export const SEA_TIMING=Object.freeze({swap:230,remove:450,refill:470,columnStagger:13,arrivalStagger:19,collect:620});
export function planTileMotion(from,to,{kind='refill',index=0,column=0,now=0,cell=50,viewportHeight=800,entering=false}={}){
 const delay=kind==='refill'?column*SEA_TIMING.columnStagger+(entering?Math.min(index,5)*SEA_TIMING.arrivalStagger:0):0;
 const start={...from};if(entering)start.y=Math.max(start.y,viewportHeight+cell*(.8+index*.65));
 return{from:start,to:{...to},start:now+delay,duration:kind==='refill'?SEA_TIMING.refill:SEA_TIMING.swap,cell,kind,entering};
}
export function sampleTileMotion(motion,now){
 const t=Math.max(0,Math.min(1,(now-motion.start)/motion.duration)),ease=1-(1-t)**3,dx=motion.to.x-motion.from.x,dy=motion.to.y-motion.from.y;
 const arc=Math.sin(t*Math.PI)**2,settle=t>.72?Math.sin((t-.72)/.28*Math.PI)**2*motion.cell*.065:0;
 return{x:motion.from.x+dx*ease+(motion.kind==='swap'?-Math.sign(dy)*arc*motion.cell*.14:Math.sin((motion.to.x+1)*.1)*arc*motion.cell*.045),y:motion.from.y+dy*ease+(motion.kind==='swap'?Math.sign(dx)*arc*motion.cell*.14:-settle),done:t===1,progress:t};
}
