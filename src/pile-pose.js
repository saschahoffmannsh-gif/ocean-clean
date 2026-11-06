// Draufsicht-Pose der 3D-Teile. Physik liefert x/y/z und die Drehung.
// z = 0 liegt auf der Wasserfläche, negativ ist unter Wasser, positiv in der Hand.
// Kein WebGL, damit die Funktionen unter node --test laufen.

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

export const ROCK_GAIN=2.4;
export const ROCK_LIMIT_DEG=28;
// Senkrechte Draufsicht: Höhe verschiebt das Teil nicht zur Seite.
export const SHEAR_X=0;
export const SHEAR_Z=0;
// Mesh-Länge 1 → Pixel. Dicht genug, dass der Teppich die Fläche füllt.
export const MESH_UNITS=2.15;
export const MURK_DEPTH=34;

export function meshScale(px){return px*MESH_UNITS;}

export function waveRock(pitchDeg,rollDeg,gain=ROCK_GAIN,limitDeg=ROCK_LIMIT_DEG){
 const lim=limitDeg*Math.PI/180,to=d=>clamp((d||0)*gain*Math.PI/180,-lim,lim);
 return{pitch:to(pitchDeg),roll:to(rollDeg)};
}

// In dieser Fassung liegt alles auf der Fläche. Keine Unterwasser-Tönung.
export function submerge(){return 0;}

export function itemPose(body,sway={x:0,y:0,scale:1}){
 const held=!!body.held,depth=0,amp=held?.15:1;
 const rock=waveRock(body.pitch,body.roll);
 const bob=held?0:(body.float?.bob||0)*(1-depth*.55);
 const pose={
  x:body.x+sway.x*amp,
  screenY:body.y+sway.y*amp+(held?0:bob*.25),
  lift:held?body.z:body.z+bob,
  yaw:body.angle||0,
  pitch:rock.pitch*(held?.45:1),
  roll:rock.roll*(held?.45:1),
  depth,held,
  scale:(sway.scale||1)*(held?1.34:1),
  long:body.kind?.long||1,
  thick:body.kind?.thick||1
 };
 // Scherung würde das gehobene Teil vom Finger wegschieben. In der Hand bleibt es unter dem Zeiger.
 if(held){pose.x-=pose.lift*SHEAR_X;pose.screenY-=pose.lift*SHEAR_Z;}
 return pose;
}

function ident(){const m=new Float32Array(16);m[0]=m[5]=m[10]=m[15]=1;return m;}
function mul(a,b){
 const o=new Float32Array(16);
 for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
 return o;
}
function rotX(a){const c=Math.cos(a),s=Math.sin(a),m=ident();m[5]=c;m[6]=s;m[9]=-s;m[10]=c;return m;}
function rotY(a){const c=Math.cos(a),s=Math.sin(a),m=ident();m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m;}
function rotZ(a){const c=Math.cos(a),s=Math.sin(a),m=ident();m[0]=c;m[1]=s;m[4]=-s;m[5]=c;return m;}
function translation(x,y,z){const m=ident();m[12]=x;m[13]=y;m[14]=z;return m;}
function scaling(x,y,z){const m=ident();m[0]=x;m[5]=y;m[10]=z;return m;}

export function modelMatrix(pose,px){
 const s=meshScale(px)*pose.scale,S=scaling(s*pose.long,s*pose.thick,s*pose.thick);
 const T=translation(pose.x,pose.lift,pose.screenY);
 return mul(T,mul(rotZ(pose.roll),mul(rotX(pose.pitch),mul(rotY(pose.yaw),S))));
}

// Orthografisch von oben: X nach rechts, die Wasserachse (Z) nach unten,
// die Höhe (Y) nur in die Tiefe, damit Lagen sich verdecken und nicht kippen.
export function obliqueMatrix(width,height,shearX=SHEAR_X,shearZ=SHEAR_Z){
 const m=new Float32Array(16);
 m[0]=2/width;m[4]=2*shearX/width;m[12]=-1;
 m[5]=-2*shearZ/height;m[9]=-2/height;m[13]=1;
 m[6]=-1/280;m[14]=.5;m[15]=1;
 return m;
}
