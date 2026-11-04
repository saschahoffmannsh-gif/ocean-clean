import {shorelineAt} from './camera.js';
import {SEA_FEEL} from './game-feel.js';

// Unequal, slowly drifting lobes bend the whole crest, rather than decorating
// a straight line with foam. GPU, fallback and floating objects share this path.
const LOBES=Object.freeze([
 {amplitude:.030,frequency:7.2,drift:.13,phase:1.4},
 {amplitude:.014,frequency:17.6,drift:-.19,phase:.8},
 {amplitude:.006,frequency:33.5,drift:.23,phase:2.4}
]);
const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=(a,b,n)=>{const t=clamp((n-a)/(b-a));return t*t*(3-2*t);};
export function sampleSurfFront(x,time){
 const phase=((time/SEA_FEEL.surfPeriod)%1+1)%1,approach=clamp(phase/.48),offshore=.58*(1-approach)**1.15,near=1-smooth(.025,.15,offshore);
 let bend=0,bendSlope=0;
 for(const l of LOBES){const p=x*l.frequency+time*l.drift+l.phase;bend+=Math.sin(p)*l.amplitude;bendSlope+=Math.cos(p)*l.amplitude*l.frequency;}
 const y=shorelineAt(.5)*(1-near)+shorelineAt(x)*near+offshore+bend*(1-near);
 const slope=(shorelineAt(x+.001)-shorelineAt(x-.001))/.002*near+bendSlope*(1-near);
 return{y,slope,phase,near,offshore,fade:1-smooth(.48,.515,phase)};
}
const f=n=>n.toFixed(8);
export const SURF_GLSL=`
vec4 surfFront(float x,float t){
 float phase=fract(t/${f(SEA_FEEL.surfPeriod)});
 float offshore=.58*pow(1.-clamp(phase/.48,0.,1.),1.15);
 float nearCoast=1.-smoothstep(.025,.15,offshore);
 float bend=${LOBES.map(l=>`${f(l.amplitude)}*sin(x*${f(l.frequency)}+t*(${f(l.drift)})+${f(l.phase)})`).join('+')};
 float bendSlope=${LOBES.map(l=>`${f(l.amplitude*l.frequency)}*cos(x*${f(l.frequency)}+t*(${f(l.drift)})+${f(l.phase)})`).join('+')};
 float y=mix(shoreline(.5),shoreline(x),nearCoast)+offshore+bend*(1.-nearCoast);
 float slope=(shoreline(x+.001)-shoreline(x-.001))/.002*nearCoast+bendSlope*(1.-nearCoast);
 return vec4(y,nearCoast,phase,slope);
}
`;
