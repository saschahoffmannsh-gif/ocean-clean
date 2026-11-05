// Zeichnet das flache Heck, die vier Boxen und die laufenden Bänder.
// Licht von oben links, passend zu den Schatten der treibenden Teile.
import {beltPoint} from './boat.js';
import {BASE_CONFIG} from './config.js';

const TAU=Math.PI*2;

function beltPoly(bin){
 const m=bin.belt.mouth,b=bin.belt.base,hw0=m.w/2,hw1=b.w/2;
 return[[m.x-hw0,m.y],[m.x+hw0,m.y],[b.x+hw1,b.y],[b.x-hw1,b.y]];
}
function path(ctx,pts){
 ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);
 for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);
 ctx.closePath();
}
function hullPath(ctx,w,h,y){
 const r=22;
 ctx.beginPath();
 ctx.moveTo(-40,h+90);
 ctx.lineTo(-40,y+r);
 ctx.quadraticCurveTo(-6,y+10,r*0.7,y);
 ctx.lineTo(w-r*0.7,y);
 ctx.quadraticCurveTo(w+6,y+10,w+40,y+r);
 ctx.lineTo(w+40,h+90);
 ctx.closePath();
}
function icon(ctx,cat,x,y,s,color){
 ctx.save();ctx.translate(x,y);ctx.scale(s/24,s/24);ctx.translate(-12,-12);
 ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=2.15;ctx.lineJoin='round';ctx.lineCap='round';
 if(cat==='plastik'){
  ctx.strokeRect(9.2,1.6,5.6,2.6);ctx.beginPath();ctx.moveTo(10,4.2);ctx.lineTo(10,7);ctx.lineTo(14,7);ctx.lineTo(14,4.2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(7.2,8.2);ctx.quadraticCurveTo(7,20.5,12,21.2);ctx.quadraticCurveTo(17,20.5,16.8,8.2);ctx.closePath();ctx.stroke();
 }else if(cat==='metall'){
  ctx.beginPath();ctx.ellipse(12,6.2,5.2,2.1,0,0,TAU);ctx.stroke();
  ctx.beginPath();ctx.moveTo(6.8,6.2);ctx.lineTo(6.8,16.4);ctx.quadraticCurveTo(6.8,19.6,12,19.6);ctx.quadraticCurveTo(17.2,19.6,17.2,16.4);ctx.lineTo(17.2,6.2);ctx.stroke();
  ctx.beginPath();ctx.ellipse(12,16.2,5.2,1.7,0,0,Math.PI);ctx.stroke();
 }else if(cat==='glas'){
  ctx.beginPath();ctx.moveTo(9.4,2.2);ctx.lineTo(14.6,2.2);ctx.moveTo(10.2,2.2);ctx.lineTo(10.2,6.4);ctx.lineTo(8.2,9.2);
  ctx.lineTo(8.2,19.2);ctx.quadraticCurveTo(8.2,21.4,12,21.4);ctx.quadraticCurveTo(15.8,21.4,15.8,19.2);ctx.lineTo(15.8,9.2);ctx.lineTo(13.8,6.4);ctx.lineTo(13.8,2.2);
  ctx.stroke();
 }else{
  ctx.beginPath();ctx.moveTo(8.2,8.4);ctx.quadraticCurveTo(7.2,7.2,9.2,6.6);ctx.quadraticCurveTo(12,5.2,14.8,6.6);ctx.quadraticCurveTo(16.8,7.2,15.8,8.4);
  ctx.lineTo(17.4,10.2);ctx.quadraticCurveTo(19.2,18.6,12,20.8);ctx.quadraticCurveTo(4.8,18.6,6.6,10.2);ctx.closePath();ctx.stroke();
  ctx.beginPath();ctx.moveTo(9.4,8.2);ctx.quadraticCurveTo(12,9.6,14.6,8.2);ctx.stroke();
 }
 ctx.restore();
}

function drawHull(ctx,L){
 const {width:w,height:h,hullTop:y}=L;
 ctx.save();
 const shade=ctx.createLinearGradient(0,y-34,0,y+10);
 shade.addColorStop(0,'rgba(0,36,48,0)');shade.addColorStop(1,'rgba(0,28,40,.32)');
 ctx.fillStyle=shade;ctx.fillRect(0,y-34,w,46);
 hullPath(ctx,w,h,y);
 const hull=ctx.createLinearGradient(0,y,0,h);
 hull.addColorStop(0,'#59616c');hull.addColorStop(0.18,'#3c444e');hull.addColorStop(1,'#2a3038');
 ctx.fillStyle=hull;ctx.fill();
 ctx.save();ctx.clip();
 ctx.fillStyle='#4a535e';ctx.fillRect(10,y+7,w-20,h);
 ctx.restore();
 ctx.beginPath();
 ctx.moveTo(16,y);ctx.lineTo(w-16,y);
 ctx.quadraticCurveTo(w+4,y+8,w+8,y+20);
 ctx.moveTo(16,y);ctx.quadraticCurveTo(-4,y+8,-8,y+20);
 ctx.strokeStyle='#c53432';ctx.lineWidth=3.2;ctx.lineCap='round';ctx.stroke();
 ctx.beginPath();ctx.moveTo(18,y+2.4);ctx.lineTo(w-18,y+2.4);
 ctx.strokeStyle='rgba(255,236,230,.55)';ctx.lineWidth=1;ctx.stroke();
 ctx.restore();
}

function drawBelt(ctx,bin,time,speed,gap){
 const m=bin.belt.mouth,base=bin.belt.base,len=bin.belt.length;
 ctx.save();
 ctx.beginPath();
 ctx.moveTo(m.x-m.w/2-2,m.y+3);ctx.lineTo(m.x+m.w/2+2,m.y+3);
 ctx.lineTo(base.x+base.w/2+3,base.y+8);ctx.lineTo(base.x-base.w/2-3,base.y+8);
 ctx.closePath();ctx.fillStyle='#1d232a';ctx.fill();
 const poly=beltPoly(bin);
 path(ctx,poly);
 const bed=ctx.createLinearGradient(m.x-m.w/2,0,m.x+m.w/2,0);
 bed.addColorStop(0,'#66727e');bed.addColorStop(.42,'#aeb8c2');bed.addColorStop(1,'#3a424b');
 ctx.fillStyle=bed;ctx.fill();
 ctx.save();ctx.clip();
 const off=(time*speed)%gap;
 for(let dist=off-gap;dist<len;dist+=gap){
  if(dist<5||dist>len-3)continue;
  const t=dist/len,p=beltPoint(bin,t),hw=p.w/2-4.5;
  ctx.beginPath();ctx.moveTo(p.x-hw,p.y);ctx.lineTo(p.x+hw,p.y);
  ctx.strokeStyle='rgba(28,34,40,.45)';ctx.lineWidth=3.4;ctx.stroke();
  ctx.beginPath();ctx.moveTo(p.x-hw,p.y-1.15);ctx.lineTo(p.x+hw,p.y-1.15);
  ctx.strokeStyle='rgba(236,242,246,.72)';ctx.lineWidth=1.35;ctx.stroke();
 }
 const wash=ctx.createLinearGradient(0,m.y-6,0,m.y+len*.24);
 wash.addColorStop(0,'rgba(78,198,214,.62)');wash.addColorStop(1,'rgba(78,198,214,0)');
 ctx.fillStyle=wash;ctx.fillRect(m.x-m.w,m.y-8,m.w*2,len*.3);
 ctx.restore();
 ctx.beginPath();
 ctx.moveTo(m.x-m.w/2,m.y);ctx.lineTo(base.x-base.w/2,base.y);
 ctx.moveTo(m.x+m.w/2,m.y);ctx.lineTo(base.x+base.w/2,base.y);
 ctx.strokeStyle='#d5dee6';ctx.lineWidth=2.4;ctx.lineCap='round';ctx.stroke();
 ctx.beginPath();
 ctx.moveTo(m.x-m.w/2+2.2,m.y);ctx.lineTo(base.x-base.w/2+2.4,base.y);
 ctx.moveTo(m.x+m.w/2-2.2,m.y);ctx.lineTo(base.x+base.w/2-2.4,base.y);
 ctx.strokeStyle='rgba(36,42,48,.55)';ctx.lineWidth=1;ctx.stroke();
 ctx.save();ctx.translate(m.x,m.y);
 const rg=ctx.createLinearGradient(-m.w/2,0,m.w/2,0);
 rg.addColorStop(0,'#8e99a3');rg.addColorStop(.48,'#f4f7f8');rg.addColorStop(1,'#59636c');
 ctx.fillStyle=rg;ctx.beginPath();ctx.ellipse(0,0,m.w/2+1.5,5.4,0,0,TAU);ctx.fill();
 ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=1.15;
 const a=(time*speed*0.11)%TAU;
 ctx.beginPath();ctx.ellipse(0,0,m.w/2-3,2.5,0,a,a+.9);ctx.stroke();
 ctx.restore();
 ctx.restore();
}

function drawFoam(ctx,bin,time){
 const m=bin.belt.mouth;
 ctx.save();
 for(let i=0;i<9;i++){
  const ph=time*2.6+i*1.17,wob=Math.sin(ph);
  const x=m.x+Math.sin(ph*.85+i)*m.w*.46;
  const y=m.y-8-(i%3)*3.1+wob*2.2;
  ctx.globalAlpha=.16+.18*(.5+.5*Math.sin(ph*1.6));
  ctx.fillStyle=i%2?'#ffffff':'#e9fbff';
  ctx.beginPath();ctx.ellipse(x,y,5.5+(i%4)*2.1,2.5,wob*.25,0,TAU);ctx.fill();
 }
 ctx.globalAlpha=.28;ctx.fillStyle='#f7fffe';
 ctx.beginPath();ctx.ellipse(m.x,m.y-3,m.w*.46,4.2,0,0,TAU);ctx.fill();
 ctx.restore();
}

function drawDroplets(ctx,drops){
 if(!drops?.length)return;
 ctx.save();
 for(const p of drops){
  const a=Math.max(0,1-p.life/p.max);
  ctx.globalAlpha=a*.85;ctx.fillStyle='#f4fffc';
  ctx.beginPath();ctx.ellipse(p.x,p.y,p.r*a,p.r*a*1.35,0,0,TAU);ctx.fill();
 }
 ctx.restore();
}

export function drawBoat(ctx,state){
 const {dpr,layout:L,time,paint,droplets,flashes,bodies}=state;
 const c=state.beltCfg||BASE_CONFIG.boat;
 ctx.setTransform(dpr,0,0,dpr,0,0);
 ctx.clearRect(0,0,L.width+4,L.height+80);
 ctx.imageSmoothingQuality='high';
 drawHull(ctx,L);
 for(const bin of L.bins)drawBelt(ctx,bin,time,c.beltSpeed,c.slatGap);
 for(const bin of L.bins)drawFoam(ctx,bin,time);
 if(paint){
  for(const b of bodies)if(b.mode==='ride')paint(b,{bob:false,rim:false,scale:.9+b.rideT*.16,shadow:.42});
 }
 drawBinFloors(ctx,L,time,flashes);
 if(paint){
  ctx.save();ctx.beginPath();ctx.rect(0,0,L.width,L.faceTop+2);ctx.clip();
  for(const b of bodies)if(b.mode==='throw'){
   const u=b.throwU||0,fade=u>.72?(1-u)/.28:1;
   paint(b,{bob:false,rim:false,scale:1.05-u*.38,alpha:Math.max(0,fade),shadow:.3});
  }
  ctx.restore();
 }
 drawBinFaces(ctx,L);
 redrawStripeGaps(ctx,L);
 drawDroplets(ctx,droplets);
}

function drawBinFloors(ctx,L,time,flashes){
 for(const bin of L.bins){
  const look=bin.look,x=bin.cx-bin.boxW/2,w=bin.boxW,y=bin.floorTop,h=bin.floorH;
  ctx.fillStyle='#12161b';
  ctx.fillRect(x,bin.lipTop,w,y-bin.lipTop+1);
  ctx.fillStyle=look.faceDeep;
  ctx.fillRect(x,y,5,h);ctx.fillRect(x+w-5,y,5,h);
  const floor=ctx.createLinearGradient(x,y,x,y+h);
  floor.addColorStop(0,look.floor);floor.addColorStop(1,look.face);
  ctx.fillStyle=floor;ctx.fillRect(x+5,y,w-10,h);
  ctx.fillStyle='rgba(255,255,255,.45)';ctx.fillRect(x+6,y,w-12,1.2);
  const flash=flashes?.[bin.index]||0;
  if(flash>time){ctx.save();ctx.globalAlpha=Math.min(.55,(flash-time)/.5);ctx.fillStyle='#fff';ctx.fillRect(x+5,y,w-10,h);ctx.restore();}
 }
}

function drawBinFaces(ctx,L){
 for(const bin of L.bins){
  const look=bin.look,x=bin.cx-bin.boxW/2,w=bin.boxW;
  ctx.save();
  const face=ctx.createLinearGradient(0,bin.faceTop,0,bin.faceTop+bin.faceH);
  face.addColorStop(0,look.face);face.addColorStop(1,look.faceDeep);
  ctx.fillStyle=face;
  ctx.beginPath();ctx.roundRect(x,bin.faceTop,w,L.height-bin.faceTop+56,[4,4,0,0]);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.42)';ctx.fillRect(x+2,bin.faceTop+1,w-4,1.3);
  const cy=bin.faceTop+Math.min(bin.faceH,L.height-bin.faceTop)*.48;
  icon(ctx,bin.category,bin.cx,cy-9,17,look.icon);
  let size=12.5;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font=`600 ${size}px ui-sans-serif,system-ui,"Segoe UI",sans-serif`;
  while(ctx.measureText(bin.label).width>w-12&&size>8){size-=.5;ctx.font=`600 ${size}px ui-sans-serif,system-ui,"Segoe UI",sans-serif`;}
  ctx.shadowColor='rgba(0,0,0,.3)';ctx.shadowBlur=2;ctx.shadowOffsetY=1;
  ctx.fillStyle=look.ink;ctx.fillText(bin.label,bin.cx,cy+9);
  ctx.restore();
 }
}

// Der volle rote Strich wird von Bändern übermalt; in den schmalen Lücken
// und außen am Rumpf bleibt er stehen. Hier nur die Außenkappen nachziehen,
// falls eine Box bis an den Rand reicht – der Strich aus drawHull liegt darunter.
function redrawStripeGaps(ctx,L){
 ctx.save();
 ctx.strokeStyle='#e23d3a';ctx.lineWidth=2.6;ctx.lineCap='butt';
 const bins=L.bins,y=L.hullTop+0.2;
 const gaps=[[0,bins[0].cx-bins[0].boxW/2-1]];
 for(let i=0;i<bins.length-1;i++)gaps.push([bins[i].cx+bins[i].boxW/2+1,bins[i+1].cx-bins[i+1].boxW/2-1]);
 gaps.push([bins[3].cx+bins[3].boxW/2+1,L.width]);
 ctx.lineWidth=4.2;
 ctx.beginPath();
 for(const [a,b] of gaps){if(b-a>3){ctx.moveTo(a,y);ctx.lineTo(b,y);}}
 ctx.stroke();
 ctx.strokeStyle='rgba(255,244,240,.7)';ctx.lineWidth=1.2;
 ctx.beginPath();
 for(const [a,b] of gaps){if(b-a>3){ctx.moveTo(a,y+2);ctx.lineTo(b,y+2);}}
 ctx.stroke();
 ctx.restore();
}
