// Säcke in strikter Draufsicht: Öffnung (dunkles Loch) zum Meer, Knoten unten.
// Gezeichnet in CSS-Pixeln; der Aufrufer setzt die dpr-Transformation.

const hexA=(hex,a)=>{const n=parseInt(hex.slice(1),16);return `rgba(${n>>16},${(n>>8)&255},${n&255},${a})`;};

// Flaches abgerundetes Rechteck, senkrecht von oben. Unten nur eine kleine Raffung.
function sackPath(ctx,w,h){
 const x=w*.03,y=h*.02,rw=w*.94,rh=h*.9,r=Math.min(18,h*.28);
 ctx.beginPath();
 ctx.moveTo(x+r,y);
 ctx.lineTo(x+rw-r,y);
 ctx.quadraticCurveTo(x+rw,y,x+rw,y+r*.7);
 ctx.lineTo(x+rw,y+rh-r);
 ctx.quadraticCurveTo(x+rw,y+rh,x+rw*.72,y+rh);
 ctx.quadraticCurveTo(w*.58,y+rh+h*.07,w*.5,y+rh+h*.02);
 ctx.quadraticCurveTo(w*.42,y+rh+h*.07,x+rw*.28,y+rh);
 ctx.quadraticCurveTo(x,y+rh,x,y+rh-r);
 ctx.lineTo(x,y+r*.7);
 ctx.quadraticCurveTo(x,y,x+r,y);
 ctx.closePath();
}

export function drawBags(ctx,bags,anims,time){
 for(let i=0;i<bags.length;i++)drawBag(ctx,bags[i],anims[i]||{},time);
}

function drawBag(ctx,bag,anim,time){
 const w=bag.w,h=bag.h,open=anim.open||0,refuse=anim.refuse||0,gulp=anim.gulp||0;
 const pulse=gulp>0?Math.sin((1-gulp)*Math.PI):0;
 const sh=Math.sin(refuse*Math.PI*3)*refuse*2.6;
 const breathe=1+Math.sin(time*1.15+bag.index*1.4)*.012;
 // Schlitz im Plastik, nicht ein Topfrand: breit, niedrig, mit Folie darüber und daneben.
 const mw=bag.w*(.56+open*.04-refuse*.1),mh=Math.max(6,Math.min(9,bag.mouthH*.42))*(1+open*.08);
 const hy=bag.mouthH*.48;
 ctx.save();
 ctx.translate(bag.x+sh,bag.y);
 ctx.translate(w/2,h*.52);ctx.scale(breathe*(1+pulse*.06),breathe*(1-pulse*.08));ctx.translate(-w/2,-h*.52);
 ctx.save();ctx.translate(4.5,6.5);ctx.fillStyle='rgba(0,28,40,.30)';ctx.beginPath();ctx.ellipse(w/2,h*.56,w*.4,h*.34,0,0,7);ctx.fill();ctx.restore();
 ctx.save();
 sackPath(ctx,w,h);ctx.clip();
 const grd=ctx.createLinearGradient(w*.1,0,w,h);
 grd.addColorStop(0,bag.light);grd.addColorStop(.42,bag.mid);grd.addColorStop(1,bag.dark);
 ctx.fillStyle=grd;ctx.fillRect(-2,-2,w+4,h+4);
 const sx=w*(.3+Math.sin(time*.55+bag.index)*.04),sy=h*.2;
 const spec=ctx.createRadialGradient(sx,sy,2,sx,sy+4,w*.62);
 spec.addColorStop(0,'rgba(255,255,255,.62)');spec.addColorStop(.4,'rgba(255,255,255,.1)');spec.addColorStop(1,'rgba(255,255,255,0)');
 ctx.fillStyle=spec;ctx.fillRect(0,0,w,h);
 ctx.strokeStyle=bag.dark;ctx.globalAlpha=.2;ctx.lineWidth=1.15;ctx.lineCap='round';
 for(const [y0,y1] of [[.34,.4],[.5,.46],[.66,.6]]){ctx.beginPath();ctx.moveTo(w*.16,h*y0);ctx.quadraticCurveTo(w*.5,h*(y0+y1)/2+Math.sin(time*.4+y0)*1.2,w*.84,h*y1);ctx.stroke();}
 ctx.globalAlpha=.12;ctx.beginPath();ctx.moveTo(w*.22,h*.22);ctx.quadraticCurveTo(w*.4,h*.55,w*.28,h*.82);ctx.stroke();
 ctx.globalAlpha=1;ctx.globalCompositeOperation='destination-out';
 ctx.beginPath();ctx.ellipse(w/2,hy,Math.max(2,mw/2),Math.max(2,mh/2),0,0,7);ctx.fill();
 ctx.restore();
 ctx.save();ctx.beginPath();ctx.ellipse(w/2,hy,Math.max(2,mw/2),Math.max(2,mh/2),0,0,7);ctx.clip();
 const hole=ctx.createLinearGradient(0,hy-mh/2,0,hy+mh/2);
 hole.addColorStop(0,'rgba(255,255,255,.22)');hole.addColorStop(.4,hexA(bag.hole,.5));hole.addColorStop(1,hexA(bag.hole,.9));
 ctx.fillStyle=hole;ctx.fillRect(0,0,w,h);ctx.restore();
 ctx.beginPath();ctx.ellipse(w/2,hy,Math.max(2,mw/2),Math.max(2,mh/2),0,0,7);
 ctx.lineWidth=1.7;ctx.strokeStyle=refuse>.04?'#fff':bag.rim;ctx.stroke();
 ctx.beginPath();ctx.ellipse(w/2,hy-mh*.15,Math.max(2,mw/2),Math.max(2,mh/2),0,Math.PI*1.15,Math.PI*1.85);
 ctx.strokeStyle='rgba(255,255,255,.95)';ctx.lineWidth=1.6;ctx.stroke();
 ctx.fillStyle=bag.dark;ctx.globalAlpha=.85;ctx.beginPath();ctx.ellipse(w/2,h*.9,w*.045,h*.035,0,0,7);ctx.fill();ctx.globalAlpha=1;
 const size=Math.max(8,Math.min(11,w*.108));
 ctx.font=`600 ${size}px ui-sans-serif,system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
 const ly=h*.64;ctx.fillStyle=bag.category==='rest'?'rgba(0,0,0,.4)':'rgba(255,255,255,.4)';
 ctx.fillText(bag.label,w/2+.5,ly+.6);ctx.fillStyle=bag.ink;ctx.globalAlpha=.84;ctx.fillText(bag.label,w/2,ly);
 ctx.restore();
}

export function drawBagFx(ctx,bags,anims){
 for(let i=0;i<bags.length;i++){
  const bag=bags[i],a=anims[i]||{};
  if(a.burst>0){const u=1-a.burst;ctx.save();
   for(let k=0;k<7;k++){const ang=k/7*Math.PI*2+.35,rad=5+u*18;
    ctx.globalAlpha=a.burst*.75;ctx.fillStyle=bag.light;ctx.beginPath();
    ctx.arc(bag.cx+Math.cos(ang)*rad,bag.mouthTop+bag.mouthH*.35+Math.sin(ang)*rad*.5,1.8+u,0,7);ctx.fill();}
   ctx.restore();}
  if(a.plus>0){ctx.save();ctx.globalAlpha=Math.min(1,a.plus*1.3);ctx.fillStyle='#fff';
   ctx.font='700 13px ui-sans-serif,system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.fillText('+1',bag.cx,bag.mouthTop-(1-a.plus)*18-4);ctx.restore();}
  if(a.refuse>.04){ctx.save();ctx.globalAlpha=a.refuse*.8;ctx.strokeStyle='#fff';ctx.lineWidth=2.4;
   ctx.beginPath();ctx.ellipse(bag.cx,bag.y+bag.mouthH*.5,bag.mouthW*.48,bag.mouthH*.42,0,0,7);ctx.stroke();ctx.restore();}
 }
}
