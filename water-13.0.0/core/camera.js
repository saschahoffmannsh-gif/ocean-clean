// World coordinates keep the original art's 1024:1536 unit ratio. The clean
// environment is a single expanded texture, with no masked-in older artwork.
// Keeping projection and hit-testing together prevents panning from offsetting
// touches relative to the water or to future building positions.
export const HOME_Y=-.10;
export const SCENE_RECT={x:-.4,y:-.32,width:1.8,height:1.4};
// Physical wet-sand/foam boundary, sampled across the complete expanded image.
export const COAST_PROFILE=[.268,.270,.277,.278,.254,.238,.226,.220,.221,.226,.235,.253,.270,.286,.296,.301,.300,.298,.294,.283,.268,.250,.237,.230,.224,.225,.227,.247,.269,.280,.280,.300,.330];
export function shorelineAt(x){const q=Math.max(0,Math.min(1,(x-SCENE_RECT.x)/SCENE_RECT.width))*(COAST_PROFILE.length-1),i=Math.min(COAST_PROFILE.length-2,Math.floor(q)),f=q-i,s=f*f*(3-2*f);return COAST_PROFILE[i]*(1-s)+COAST_PROFILE[i+1]*s;}
export function viewSpan(width,height){const aspect=width/height;return{x:Math.min(1,aspect/(2/3)),y:Math.min(1,(2/3)/aspect)};}
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export class CoastCamera{
  constructor(){this.x=0;this.y=HOME_Y;this.targetX=0;this.targetY=HOME_Y;this.drag=null;}
  get exploring(){return Math.abs(this.x)>.035||this.y<HOME_Y-.045||Math.abs(this.targetX)>.035||this.targetY<HOME_Y-.045;}
  moveTo(x,y,snap=false){this.targetX=clamp(x,-.38,.38);this.targetY=clamp(y,SCENE_RECT.y,HOME_Y);if(snap){this.x=this.targetX;this.y=this.targetY;}}
  home(){this.moveTo(0,HOME_Y);}
  explore(){this.moveTo(0,-.22);}
  step(dt){if(this.drag)return;const f=1-Math.exp(-dt*13);this.x+=(this.targetX-this.x)*f;this.y+=(this.targetY-this.y)*f;if(Math.abs(this.x-this.targetX)<.00001)this.x=this.targetX;if(Math.abs(this.y-this.targetY)<.00001)this.y=this.targetY;}
  imagePoint(x,y,width,height){const span=viewSpan(width,height);return{x:(x-.5)*span.x+.5+this.x,y:y*span.y+this.y};}
  begin(clientX,clientY,width,height){this.drag={clientX,clientY,x:this.x,y:this.y,width,height,span:viewSpan(width,height)};this.targetX=this.x;this.targetY=this.y;}
  pan(clientX,clientY){if(!this.drag)return;const d=this.drag;this.moveTo(d.x-(clientX-d.clientX)/d.width*d.span.x,d.y-(clientY-d.clientY)/d.height*d.span.y,true);}
  end(){this.drag=null;}
  wheel(dx,dy,width,height){const span=viewSpan(width,height);this.moveTo(this.targetX+dx/width*span.x,this.targetY+dy/height*span.y);}
}
