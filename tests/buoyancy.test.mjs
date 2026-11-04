import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleSeaMotion,stepBuoyancy,sampleInteractionWaves} from '../water-13.0.0/core/buoyancy.js';
import {SEA_FEEL} from '../water-13.0.0/core/game-feel.js';

test('a passing crest briefly immerses a small edge, then the floating body settles back up',()=>{
 const body={};stepBuoyancy(body,{lift:0,crest:0},0,0);let peak=0;
 for(let i=0;i<18;i++){const pose=stepBuoyancy(body,{lift:3,crest:1},0,.016);peak=Math.max(peak,pose.dip);assert(pose.dip<=.18);assert(pose.bob>-11&&pose.bob<11);}
 assert(peak>.05,'a wave must actually wash over the lower edge');
 for(let i=0;i<180;i++)stepBuoyancy(body,{lift:0,crest:0},0,.016);
 assert(body.draft<.0001);assert(Math.abs(body.heave)<.005,'the part resurfaces rather than slowly sinking');
});

test('interaction waves are bounded, calm objects stay dry, and reduced motion disables dipping',()=>{
 const calm={};for(let i=0;i<100;i++){const pose=stepBuoyancy(calm,{lift:0,crest:0},0,.016);assert(pose.bob===0&&pose.dip===0);}
 const body={};stepBuoyancy(body,{lift:0,crest:0},0,0);let peak=0;
 for(let i=0;i<120;i++){const pose=stepBuoyancy(body,{lift:Math.sin(i*.3)*10,crest:1},Math.sin(i*.15)*4,.016);peak=Math.max(peak,pose.dip);assert(pose.dip>=0&&pose.dip<=.18);assert(Math.abs(pose.bob)<11);}
 assert(peak>0);assert.deepEqual(stepBuoyancy(body,{lift:3,crest:1},4,.016,true),{bob:0,dip:0,pitch:0,roll:0});
});

test('the sampled incoming crest travels from the deep sea toward the shore instead of dipping every part together',()=>{
 const options={width:390,height:660,camera:{x:0,y:0},swell:32};let far={height:0,time:0},near={height:0,time:0};
 for(let time=0;time<SEA_FEEL.surfPeriod;time+=.016){for(const [y,record]of [[.72,far],[.42,near]]){const sample=sampleSeaMotion(.5,y,{...options,time});assert(Number.isFinite(sample.lift+sample.crest+sample.roll));if(sample.crest>record.height){record.height=sample.crest;record.time=time;}}}
 assert(far.height>.7&&near.height>.7);assert(far.time<near.time,'the visible sea-to-shore wave reaches offshore objects first');
});


test('pitch and roll follow the local water slope with damping, bounded angles and complete recovery',()=>{
 const body={};stepBuoyancy(body,{lift:0,crest:0,pitch:0,roll:0},0,0);
 let pose;for(let i=0;i<20;i++)pose=stepBuoyancy(body,{lift:2,crest:1,pitch:7,roll:-5},0,.016);
 assert(pose.pitch>5&&pose.pitch<9);assert(pose.roll< -3&&pose.roll> -7);
 for(let i=0;i<20;i++){pose=stepBuoyancy(body,{lift:0,crest:0,pitch:-100,roll:100},0,.016);assert(Math.abs(pose.pitch)<=12&&Math.abs(pose.roll)<=10);}
 assert(pose.pitch< -7&&pose.roll>5,'opposite wave slopes reverse both tilt axes');
 for(let i=0;i<150;i++)pose=stepBuoyancy(body,{lift:0,crest:0,pitch:0,roll:0},0,.016);
 assert(Math.abs(pose.pitch)<.001&&Math.abs(pose.roll)<.001);
 assert.deepEqual(stepBuoyancy(body,{lift:2,crest:1,pitch:8,roll:6},2,.016,true),{bob:0,dip:0,pitch:0,roll:0});
});

test('an expanding interaction wave tilts objects on opposite sides in opposite directions',()=>{
 const pulses=[{x:100,y:100,start:0,power:1}],left=sampleInteractionWaves(pulses,80,100,100),right=sampleInteractionWaves(pulses,120,100,100),below=sampleInteractionWaves(pulses,100,120,100);
 assert.equal(left.height,right.height);assert(left.slopeX<0&&right.slopeX>0);assert.equal(left.slopeY,0);assert(below.slopeY>0);assert.deepEqual(sampleInteractionWaves(pulses,120,100,2200),{height:0,slopeX:0,slopeY:0});
});


test('motion waves reach neighbours in sequence, preserve suction, and fade back to rest',()=>{
 const positive=[{x:0,y:0,start:0,power:.45}],negative=[{x:0,y:0,start:0,power:-.45}],records=[];
 for(const distance of [70,140,210]){
  const body={};stepBuoyancy(body,{lift:0,crest:0},0,0);let peak=0,at=0,angle=0;
  for(let now=16;now<2600;now+=16){const wave=sampleInteractionWaves(positive,distance,0,now),suction=sampleInteractionWaves(negative,distance,0,now);assert(Math.abs(wave.height+suction.height)<1e-12);const pose=stepBuoyancy(body,{lift:0,crest:0,roll:wave.slopeX*320},wave.height,.016);if(pose.dip>peak){peak=pose.dip;at=now;}angle=Math.max(angle,Math.abs(pose.roll));}
  assert(peak>.005&&angle>.4,'even the farther neighbour receives a visible disturbance');assert(body.draft<.001&&Math.abs(body.roll)<.01);records.push({peak,at});
 }
 assert(records[0].peak>.03);assert(records[0].at<records[1].at&&records[1].at<records[2].at,'neighbours react when the wave arrives, not all at once');
});



test('movement waves are strongest beside the item and flatten smoothly with distance',()=>{
 const samples=[];
 for(const distance of [20,70,140,210]){
  const ordinary=[{x:0,y:0,start:0,power:.6}],movement=[{...ordinary[0],nearField:true}];let normalPeak=0,motionPeak=0;
  for(let now=0;now<1400;now+=8){const plain=sampleInteractionWaves(ordinary,distance,0,now),near=sampleInteractionWaves(movement,distance,0,now);normalPeak=Math.max(normalPeak,Math.abs(plain.height));motionPeak=Math.max(motionPeak,Math.abs(near.height));assert(Number.isFinite(near.slopeX+near.slopeY));}
  samples.push({peak:motionPeak,gain:motionPeak/normalPeak});
 }
 assert(samples[0].gain>2,'an immediate local crest is noticeably higher');assert(samples.at(-1).gain<1.06,'the extra force has almost vanished at a distant item');
 for(let i=1;i<samples.length;i++){assert(samples[i].peak<samples[i-1].peak);assert(samples[i].gain<samples[i-1].gain);}
});
