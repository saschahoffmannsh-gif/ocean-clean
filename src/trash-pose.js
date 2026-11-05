// Lage der 3D-Müll-Items (nur Prototyp, ?items3d=1).
// Position und Auftrieb kommen aus der bestehenden 2D-Physik. Diese Datei rechnet
// daraus die Draufsicht-Pose: Drehung um die Hochachse und Schaukeln mit der Welle.
// Kein WebGL, damit die Funktionen unter node --test laufen.

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

// Darstellungsdrehung in rad/s. Die Physik selbst dreht nur über kleine Strömungsstöße;
// ohne diesen Zusatz wäre die Rotation in der Draufsicht kaum erkennbar.
// Bei reduced-motion bleibt sie aus (itemPose motion:false).
export const VIEW_SPIN=0.85;
// Auftriebswinkel (body.pitch/roll, Grad, bereits von stepBuoyancy begrenzt) → Radiant.
// Faktor >1, damit das Schaukeln in der steilen Draufsicht lesbar ist. Nur Darstellung,
// die 2D-Sprites nutzen weiterhin displayFloat und bleiben unverändert.
export const ROCK_GAIN=2.6;
export const ROCK_LIMIT_DEG=32;
// Schräge Draufsicht: Welt-oben wandert leicht nach links/oben (Licht kommt von oben links).
// tan(Winkel) ≈ |shear|; 0.42 entspricht etwa 23° aus der Senkrechten – noch Draufsicht.
export const SHEAR_X=-0.30;
export const SHEAR_Z=-0.42;
// Sprite liegt in einer Box look*2.3, der gemalte Inhalt füllt davon ~92 % der langen Seite.
// 0.92*2.3 ≈ 2.12: Mesh-Länge 1 entspricht der sichtbaren Sprite-Länge.
export const MESH_UNITS_PER_LOOK=2.12;

export function wantsItems3D(search=''){
 const v=(new URLSearchParams(search).get('items3d')||'').toLowerCase();
 return v==='1'||v==='true'||v==='on';
}

export function meshScale(lookPx){return lookPx*MESH_UNITS_PER_LOOK;}

// Wellen-Neigung in Radiant, begrenzt. Vorzeichen bleiben erhalten.
export function waveRock(pitchDeg,rollDeg,gain=ROCK_GAIN,limitDeg=ROCK_LIMIT_DEG){
 const lim=limitDeg*Math.PI/180,to=d=>clamp((d||0)*gain*Math.PI/180,-lim,lim);
 return{pitch:to(pitchDeg),roll:to(rollDeg)};
}

// body.pitch/roll: integrierte Auftriebsneigung in Grad (schaukelt mit Trägheit nach).
// body.angle: Physikdrehung. bob: 2D-Hub, negativ = angehoben (Sprite wandert im Bild nach oben).
export function itemPose(body,timeSec,opt={}){
 const motion=opt.motion!==false,spin=opt.spin??VIEW_SPIN,gain=opt.rockGain??ROCK_GAIN,limit=opt.rockLimit??ROCK_LIMIT_DEG;
 const bob=body.float?.bob||0,rock=waveRock(body.pitch,body.roll,gain,limit);
 const dir=Math.sign(body.spinBias||1)||1;
 return{
  x:body.x,
  screenY:body.y+bob,
  lift:-bob,
  yaw:(body.angle||0)+(motion?timeSec*spin*dir:0),
  pitch:rock.pitch,
  roll:rock.roll
 };
}

function ident(){const m=new Float32Array(16);m[0]=m[5]=m[10]=m[15]=1;return m;}
function mul(a,b){
 const o=new Float32Array(16);
 for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
 return o;
}
function rotX(a){
 const c=Math.cos(a),s=Math.sin(a),m=ident();
 m[5]=c;m[6]=s;m[9]=-s;m[10]=c;return m;
}
function rotY(a){
 const c=Math.cos(a),s=Math.sin(a),m=ident();
 m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m;
}
function rotZ(a){
 const c=Math.cos(a),s=Math.sin(a),m=ident();
 m[0]=c;m[1]=s;m[4]=-s;m[5]=c;return m;
}
function translation(x,y,z){const m=ident();m[12]=x;m[13]=y;m[14]=z;return m;}
function scaling(s){const m=ident();m[0]=m[5]=m[10]=s;return m;}

// T * Rz(roll) * Rx(pitch) * Ry(yaw) * S.
// Erst drehen (Yaw um oben), dann mit der Welle kippen, dann auf die Wasserstelle setzen.
// Negatives Pitch hebt die +Z-Seite (Bildschirm nach unten): so ist das Vorzeichen von
// stepBuoyancy (pitch = -atan(gy)) ohne Extra-Spiegelung richtig.
export function modelMatrix(pose,scale){
 const S=scaling(scale),Ry=rotY(pose.yaw),Rx=rotX(pose.pitch),Rz=rotZ(pose.roll),T=translation(pose.x,pose.lift,pose.screenY);
 return mul(T,mul(Rz,mul(Rx,mul(Ry,S))));
}

export function transformPoint(m,x,y,z){
 const w=m[3]*x+m[7]*y+m[11]*z+m[15]||1;
 return{
  x:(m[0]*x+m[4]*y+m[8]*z+m[12])/w,
  y:(m[1]*x+m[5]*y+m[9]*z+m[13])/w,
  z:(m[2]*x+m[6]*y+m[10]*z+m[14])/w
 };
}

// Orthografisch auf die Wasserfläche (y=0 liegt pixelgenau) plus Scherung für die Höhe.
// x = rechts, y = oben aus dem Wasser, z = Bildschirm nach unten. Ergebnis im Clip-Raum.
export function obliqueClip(x,yUp,z,width,height,shearX=SHEAR_X,shearZ=SHEAR_Z){
 return{
  x:(x+yUp*shearX)/width*2-1,
  y:1-(z+yUp*shearZ)/height*2,
  z:0.5-yUp/400
 };
}

export function obliqueMatrix(width,height,shearX=SHEAR_X,shearZ=SHEAR_Z){
 const m=new Float32Array(16);
 m[0]=2/width;m[4]=2*shearX/width;m[12]=-1;
 m[5]=-2*shearZ/height;m[9]=-2/height;m[13]=1;
 m[6]=-1/400;m[14]=0.5;m[15]=1;
 return m;
}
