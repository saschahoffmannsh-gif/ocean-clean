import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sampleSurfFront,SURF_GLSL} from '../water-13.0.0/core/surf.js';
import {CanvasSurface,FRAGMENT} from '../water-13.0.0/core/water.js';
import {sampleSeaMotion} from '../water-13.0.0/core/buoyancy.js';
import {shorelineAt,viewSpan} from '../water-13.0.0/core/camera.js';
import {SEA_FEEL} from '../water-13.0.0/core/game-feel.js';

test('offshore crests have changing, non-linear curves across a phone viewport',()=>{
 const xs=Array.from({length:41},(_,i)=>.15+i*.7/40),shapes=[];
 for(const time of [.5,1.5,2.5]){
  const ys=xs.map(x=>sampleSurfFront(x,time).y),first=ys[0],last=ys.at(-1);
  assert(Math.max(...ys)-Math.min(...ys)>.025,'the front visibly bends');
  assert(Math.max(...ys.map((y,i)=>Math.abs(y-(first+(last-first)*i/40))))>.012,'it is not a straight diagonal either');
  shapes.push(ys.map(y=>y-first));
  for(const x of xs){const a=sampleSurfFront(x,time),b=sampleSurfFront(x,time+.016);assert(b.y<a.y,'the crest advances toward the coast');assert(Math.abs(b.y-a.y)<.005,'the curve moves continuously');}
 }
 assert(Math.max(...shapes[0].map((y,i)=>Math.abs(y-shapes[2][i])))>.004,'the contour evolves instead of translating a fixed line');
});

test('the curved front meets the original coast and drives the actual floating objects',()=>{
 const width=390,height=844,camera={x:0,y:-.1},span=viewSpan(width,height),swell=32;
 for(const x of [.2,.35,.5,.7,.8]){
  const front=sampleSurfFront(x,1.7),screenX=(x-.5-camera.x)/span.x+.5,screenY=(front.y-camera.y)/span.y;
  const on=sampleSeaMotion(screenX,screenY,{width,height,camera,time:1.7,swell});
  const off=sampleSeaMotion(screenX,screenY+.09,{width,height,camera,time:1.7,swell});
  assert(on.crest>1.4&&off.crest<.01,'items lift on their local curved crest');
  for(const time of [.48,.50,.60,.90].map(p=>p*SEA_FEEL.surfPeriod))assert(Math.abs(sampleSurfFront(x,time).y-shorelineAt(x))<1e-12,'the front conforms to the untouched coast');
 }
 assert(FRAGMENT.includes(SURF_GLSL),'the GPU receives the same surf geometry');
});

