// Vier flache Säcke unten, strikte Draufsicht, Öffnung nach oben zum Meer.
// Regel (Mitte des Teils, nicht der Rand):
// - Passende Öffnung: eingesammelt, sobald die Mitte die Lippe überschritten hat.
// - Falsche Öffnung: der Sack lässt nicht hinein. Rückstoß nach oben, und dieser
//   Sack saugt nicht nach, solange das Teil in seinem engen Feld bleibt
//   (mindestens rejectHold). Ein anderer, passender Sack bleibt sofort offen.
// - Neben der Öffnung ist der Sackkörper eine Kante. Nur die Öffnung nimmt an.
// - Sog nur im Rechteck direkt vor der Öffnung (reach px, nicht breiter), sonst 0.
// ?force ändert diesen Sog nicht. Drehung bekommt im Feld eine kleine Scherung dazu.
import {CATEGORIES} from './trash-catalog.js';

export const BAG_LOOK=Object.freeze({
 plastik:Object.freeze({label:'Plastik',light:'#ffe7a3',mid:'#f0c01a',dark:'#b8860a',rim:'#fff6d0',hole:'#3a2808',ink:'#5c3b08'}),
 metall:Object.freeze({label:'Metall',light:'#9ec4ea',mid:'#2f6eae',dark:'#14375c',rim:'#eef6fd',hole:'#0c1c2c',ink:'#071828'}),
 glas:Object.freeze({label:'Glas',light:'#c6f6d2',mid:'#2f9b4e',dark:'#146334',rim:'#e7ffee',hole:'#0c3320',ink:'#073018'}),
 rest:Object.freeze({label:'Restmüll',light:'#b4bcc6',mid:'#3a424c',dark:'#161a1f',rim:'#e6ebf0',hole:'#07080b',ink:'#f3f6f8'})
});

const smooth=q=>q*q*(3-2*q);

export function layoutBags(width,height,{safeBottom=0}={}){
 const n=CATEGORIES.length,margin=Math.max(6,Math.min(14,width*.018));
 let bw=Math.max(66,Math.min(116,width*.205)),gap=(width-margin*2-n*bw)/(n-1);
 if(gap<5){gap=5;bw=(width-margin*2-gap*(n-1))/n;}
 const total=n*bw+(n-1)*gap,x0=(width-total)/2;
 const bh=Math.max(56,Math.min(64,bw*.55));
 const bottom=height-Math.max(0,safeBottom)-4,top=bottom-bh;
 const mouthH=Math.max(14,Math.min(20,bh*.3));
 return CATEGORIES.map((category,i)=>{
  const x=x0+i*(bw+gap),look=BAG_LOOK[category];
  return {index:i,category,...look,x,y:top,w:bw,h:bh,bottom,cx:x+bw/2,mouthTop:top,mouthH,mouthW:bw*.66};
 });
}

// Obergrenze fürs Spawnen: klar über dem Sogfeld.
export function spawnCeiling(lip,reach){return lip-reach-28;}

export function mouthOf(body,bags){
 let best=null,bestDx=Infinity;
 for(const g of bags){const dx=Math.abs(body.x-g.cx);if(dx<=g.mouthW/2&&dx<bestDx){best=g;bestDx=dx;}}
 return best;
}

export function suctionFalloff(body,bag,sort){
 if(!bag||body.collected)return 0;
 if(body.rejectLatch&&body.rejectBag===bag.index)return 0;
 const above=bag.mouthTop-body.y;
 if(above<0||above>sort.reach)return 0;
 if(Math.abs(body.x-bag.cx)>bag.mouthW/2)return 0;
 return smooth(1-above/sort.reach);
}

export function bagAccel(body,env,sort,edge){
 const bags=env.bags;
 if(!bags?.length||body.collected)return {ax:0,ay:0,swirl:0};
 const g=mouthOf(body,bags);
 let ax=0,ay=0,swirl=0;
 if(g){
  const fall=suctionFalloff(body,g,sort);
  if(fall>0){
   const half=g.mouthW/2,side=(body.x-g.cx)/half;
   ax+=-side*sort.inward*fall;ay+=sort.suction*fall;swirl+=side*sort.swirl*fall;
  }
  const depth=body.y-g.mouthTop;
  if(depth>0&&depth<g.mouthH&&body.kind.category===g.category&&!(body.rejectLatch&&body.rejectBag===g.index)){
   ax+=(g.cx-body.x)*7;ay+=sort.suction*1.15;
  }
 }else if(body.y>bags[0].mouthTop){
  const pen=body.y-bags[0].mouthTop;
  ay-=Math.min(1.4,pen/sort.dock)*edge;
 }
 const mag=Math.hypot(ax,ay);
 if(mag>sort.maxAccel){const s=sort.maxAccel/mag;ax*=s;ay*=s;}
 return {ax,ay,swirl};
}

function releaseReject(body,env,sort){
 if(!body.rejectLatch)return;
 const bag=env.bags[body.rejectBag];
 if(!bag){body.rejectLatch=0;body.rejectBag=-1;body.rejectCap=0;return;}
 const above=bag.mouthTop-body.y;
 const near=Math.abs(body.x-bag.cx)<=bag.mouthW/2+2&&above<=sort.reach+6&&body.y<bag.mouthTop+bag.mouthH;
 if(!near)body.rejectCap=0;
 if(!near&&(env.t||0)>=(body.rejectUntil||0)){body.rejectLatch=0;body.rejectBag=-1;body.rejectCap=0;}
}

export function bagResolve(body,env,sort){
 const bags=env.bags;
 if(!bags?.length||body.collected)return;
 releaseReject(body,env,sort);
 const g=mouthOf(body,bags),lip=bags[0].mouthTop;
 if(!g){if(body.y>lip){body.y=lip;if(body.vy>0)body.vy*=.12;}return;}
 const depth=body.y-g.mouthTop;
 if(depth<=.5)return;
 const held=body.rejectLatch&&body.rejectBag===g.index;
 if(body.kind.category===g.category&&!held){
  body.collected=true;body.sortEvent={type:'collect',category:g.category,index:g.index};
  body.vx*=.15;return;
 }
 body.y=g.mouthTop-sort.nudge;
 if(!held){
  const side=Math.sign(body.x-g.cx)||(body.spinBias<0?-1:1);
  body.vy=-sort.reject;body.vx+=side*sort.rejectSide;
  body.rejectLatch=1;body.rejectBag=g.index;body.rejectUntil=(env.t||0)+sort.rejectHold;body.rejectCap=sort.reject;
  body.sortEvent={type:'reject',category:g.category,index:g.index,item:body.kind.category};
 }else if(body.vy>0)body.vy=0;
}
