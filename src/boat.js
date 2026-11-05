// Bootsheck mit vier Förderbändern. Reine Geometrie und Sortierlogik, ohne DOM.
//
// Sortierregeln (von links nach rechts, Kategorien aus trash-catalog.js):
//   Plastik gelb · Metall blau · Glas grün · Restmüll dunkel.
//   Geprüft wird am Maul, der Ellipse am wasserseitigen Bandende.
//   Kategorie = Band → auflegen, mit dem Band zur Box tragen, hineinwerfen, einsammeln.
//   Kategorie ≠ Band → am Maul zurückstoßen, nicht einsammeln, kurz nicht erneut greifen.
//   Leichter Sog nur im Umkreis des Mauls. Ein Wisch bleibt stärker und kann Teile
//   ins Maul schieben oder davon wegziehen. Falsche Teile fahren nicht auf dem Band mit.
import {CATEGORIES,CATEGORY_LABELS} from './trash-catalog.js';
import {BASE_CONFIG} from './config.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

export const BIN_LOOK=Object.freeze({
 plastik:Object.freeze({floor:'#ffd56a',face:'#e2a31c',faceDeep:'#c48a0e',ink:'#3d2c08',icon:'#5c4210'}),
 metall:Object.freeze({floor:'#8eb8e6',face:'#326eae',faceDeep:'#24568c',ink:'#f5f9ff',icon:'#f7fbff'}),
 glas:Object.freeze({floor:'#8ee3ae',face:'#2b8d4b',faceDeep:'#1c6c38',ink:'#f4fff7',icon:'#f7fff9'}),
 rest:Object.freeze({floor:'#626a74',face:'#2b3036',faceDeep:'#15181c',ink:'#f4f5f6',icon:'#f4f5f6'})
});

export function decideSort(itemCategory,binCategory){
 return itemCategory===binCategory?'keep':'reject';
}

export function isCarried(b){
 return b.mode==='ride'||b.mode==='throw'||!!b.collected;
}

// Sichtbares Heck: Boxenböden nur ein schmaler Streifen, die Front läuft aus dem Bild.
// Die Bänder stehen im Wasser, das Maul ist ihr oberes Ende.
export function layoutBoat(width,height){
 const gap=clamp(width*0.02,7,11);
 const side=clamp(width*0.045,14,40);
 const boxW=clamp((width-side*2-gap*3)/4,64,116);
 const group=boxW*4+gap*3,left=(width-group)/2;
 const faceH=clamp(height*0.04,32,38);
 const floorH=clamp(height*0.02,15,18);
 const faceTop=height-faceH;
 const floorTop=faceTop-floorH;
 const lipTop=floorTop-5;
 const beltLen=clamp(height*0.132,84,128);
 const mouthY=lipTop-beltLen;
 const bins=CATEGORIES.map((category,i)=>{
  const cx=left+boxW/2+i*(boxW+gap);
  const mouthW=boxW*0.68,baseW=boxW*0.9;
  const baseY=lipTop+1;
  const length=Math.max(1,baseY-mouthY);
  return{
   index:i,category,label:CATEGORY_LABELS[category],look:BIN_LOOK[category],cx,boxW,
   floorTop,floorH,faceTop,faceH,lipTop,
   belt:{length,mouth:{x:cx,y:mouthY,w:mouthW},base:{x:cx,y:baseY,w:baseW}},
   mouth:{x:cx,y:mouthY,rx:mouthW*0.56,ry:clamp(mouthW*0.32,15,22)}
  };
 });
 return{width,height,faceTop,faceH,floorTop,floorH,lipTop,mouthY,hullTop:lipTop-2,bins};
}

export function beltPoint(bin,t){
 const m=bin.belt.mouth,base=bin.belt.base,len=bin.belt.length||1;
 return{x:m.x+(base.x-m.x)*t,y:m.y+(base.y-m.y)*t,dx:(base.x-m.x)/len,dy:(base.y-m.y)/len,w:m.w+(base.w-m.w)*t};
}

function gainOf(b,driftCfg){
 return(1+driftCfg.inertia)/(b.kind.mass+driftCfg.inertia);
}

// Zusätzliche Kräfte für freie Teile: Heckfeder, seitlich vom Band, Sog zum nächsten Maul.
export function beltAccelerate(b,env,driftCfg){
 const c=env.beltCfg||BASE_CONFIG.boat,layout=env.belts;
 if(!layout||isCarried(b))return;
 const gain=gainOf(b,driftCfg),r=env.size(b);
 const wall=layout.lipTop-r*0.15;
 if(b.y>wall){b.ay-=(b.y-wall)*c.hullK*gain;b.ay-=b.vy*c.hullDamp;}
 if(b.rejectUntil>env.t)return;
 let best=null,bestD=c.suctionRadius;
 for(const bin of layout.bins){
  const dx=bin.mouth.x-b.x,dy=bin.mouth.y-b.y,d=Math.hypot(dx,dy);
  if(d<bestD){bestD=d;best={dx,dy,d};}
 }
 if(!best||best.d<0.8)return;
 const reach=1-best.d/c.suctionRadius,pull=c.suctionSpeed*reach**0.65,k=c.suctionCoupling*reach*gain;
 b.ax+=(best.dx/best.d*pull-b.vx)*k;b.ay+=(best.dy/best.d*pull-b.vy)*k;
}

// Nach der Integration: liegt die Mitte im Maul, wird sortiert.
// Liegt (x,y) auf dem wasserseitigen Teil des Bandes? Rückgabe: Fortschritt 0 am Maul.
export function beltHit(bin,x,y,pad=4){
 const span=bin.belt.base.y-bin.belt.mouth.y;if(span<1)return null;
 const t=(y-bin.belt.mouth.y)/span;
 if(t<-0.08||t>0.84)return null;
 const tt=Math.max(0,Math.min(1,t));
 const cx=bin.belt.mouth.x+(bin.belt.base.x-bin.belt.mouth.x)*tt;
 const half=(bin.belt.mouth.w+(bin.belt.base.w-bin.belt.mouth.w)*tt)/2+pad;
 if(Math.abs(x-cx)>half)return null;
 return Math.max(0,t);
}

export function beltCapture(b,env){
 const c=env.beltCfg||BASE_CONFIG.boat,layout=env.belts;
 if(!layout||isCarried(b)||b.rejectUntil>env.t)return null;
 if(typeof b.fade==='number'&&b.fade<0.85)return null;
 let best=null,bestS=1,bestT=0;
 for(const bin of layout.bins){
  const ex=(b.x-bin.mouth.x)/bin.mouth.rx,ey=(b.y-bin.mouth.y)/bin.mouth.ry,s=ex*ex+ey*ey;
  if(s<=1&&s<bestS){bestS=s;best=bin;bestT=0;}
 }
 if(!best)for(const bin of layout.bins){
  const t=beltHit(bin,b.x,b.y,6);if(t==null)continue;
  const d=Math.abs(b.x-bin.cx);if(!best||d<bestS){best=bin;bestS=d;bestT=t;}
 }
 if(!best)return null;
 if(decideSort(b.kind.category,best.category)==='keep'){
  b.mode='ride';b.rideBin=best.index;b.rideT=bestT;b.spin*=.25;
  b.justCaught=true;b.caughtX=b.x;b.caughtY=b.y;return 'keep';
 }
 b.rejects=(b.rejects||0)+1;b.rejectUntil=env.t+c.rejectHold;b.bumpUntil=env.t+.32;b.bumpBin=best.index;
 b.justRejected=true;b.caughtX=best.mouth.x;b.caughtY=best.mouth.y;
 b.vx=clamp((b.x-best.mouth.x)/(best.mouth.rx||1),-1,1)*c.rejectSide;b.vy=-c.rejectSpeed;
 b.y=best.mouth.y-best.mouth.ry-2;return 'reject';
}

export function beltMove(b,env,dt){
 if(b.collected)return;
 const c=env.beltCfg||BASE_CONFIG.boat,bin=env.belts.bins[b.rideBin];
 if(!bin){b.mode='free';return;}
 if(b.mode==='ride'){
  b.rideT+=dt*c.beltSpeed/bin.belt.length;
  if(b.rideT>=1){
   b.rideT=1;const p=beltPoint(bin,1);b.x=p.x;b.y=p.y;
   b.throwFrom={x:p.x,y:p.y,angle:b.angle};b.throwT=0;b.mode='throw';return;
  }
  const p=beltPoint(bin,b.rideT);
  b.x=p.x;b.y=p.y;b.vx=p.dx*c.beltSpeed;b.vy=p.dy*c.beltSpeed;
  const target=Math.atan2(p.dy,p.dx);let da=target-b.angle;
  while(da>Math.PI)da-=Math.PI*2;while(da<-Math.PI)da+=Math.PI*2;
  b.angle+=da*(1-Math.exp(-7*dt));b.spin=da;return;
 }
 if(b.mode==='throw'){
  b.throwT+=dt;const u=Math.min(1,b.throwT/c.throwTime),e=1-(1-u)*(1-u),from=b.throwFrom;
  b.x=from.x+(bin.cx-from.x)*e;
  b.y=from.y+(bin.faceTop+bin.faceH*.62-from.y)*e-Math.sin(u*Math.PI)*c.throwHop;
  b.angle=from.angle+u*1.7;b.throwU=u;b.vx=0;b.vy=0;
  if(u>=1)b.collected=true;
 }
}
