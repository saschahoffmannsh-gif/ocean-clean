// Passive native scrolling and water simulation share screen coordinates.
// No pointer capture or preventDefault: iOS keeps its native scroll physics.
export class VoyageTouch{
 constructor({disturb,rect,active,reducedMotion=false}){Object.assign(this,{disturb,rect,active,reducedMotion});this.last=null;}
 end(){this.last=null;}
 sample(clientX,clientY,now,{begin=false,energy=0}={}){
  if(!this.active()){this.end();return 0;}
  const r=this.rect(),x=clientX-r.left,y=clientY-r.top;
  if(!r.width||!r.height||x<0||y<0||x>r.width||y>r.height){this.end();return 0;}
  if(begin)this.end();
  const prior=this.last,distance=prior?Math.hypot(x-prior.x,y-prior.y):0;
  if(prior&&(now-prior.at<32||(distance<3&&energy===0)))return 0;
  const steps=prior?Math.min(4,Math.max(1,Math.ceil(distance/24))):1;
  const strength=(begin ? .10 : .12+Math.min(.14,(distance+Math.abs(energy)*.15)/180))*(this.reducedMotion ? .45 : 1);
  for(let i=1;i<=steps;i++){const f=i/steps;this.disturb((prior?prior.x+(x-prior.x)*f:x)/r.width,(prior?prior.y+(y-prior.y)*f:y)/r.height,strength/Math.sqrt(steps),5.5);}
  this.last={x,y,at:now};return steps;
 }
}
