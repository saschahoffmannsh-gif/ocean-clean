// Transparentes WebGL über dem Meer: die drei Low-Poly-Netze, viele Instanzen.
// Oberfläche klar, unter Wasser blau, weicher und durchscheinender. Fehlt WebGL,
// bleibt das Canvas draussen und die Ebene zeichnet einfache Körper.
import {getMesh,MESH_KEYS} from './trash-meshes.js?v=20261105-heap12';
import {itemPose,modelMatrix,obliqueMatrix} from './pile-pose.js?v=20261105-heap12';

const ATTRS={alpha:true,antialias:true,depth:true,stencil:false,premultipliedAlpha:true,powerPreference:'low-power',preserveDrawingBuffer:false};
const VERT=`precision highp float;
attribute vec3 aPos;
attribute vec3 aNrm;
uniform mat4 uModel;
uniform mat4 uVP;
varying vec3 vN;
varying vec3 vWorld;
varying float vLift;
void main(){
  vec4 world=uModel*vec4(aPos,1.0);
  vWorld=world.xyz;
  vN=mat3(uModel)*aNrm;
  vLift=aPos.y;
  gl_Position=uVP*world;
}`;
const FRAG=`precision mediump float;
varying vec3 vN;
varying vec3 vWorld;
varying float vLift;
uniform vec3 uColor;
uniform vec3 uLight;
uniform vec3 uCam;
uniform float uMetal;
uniform float uRough;
uniform float uAlpha;
uniform float uFresnel;
uniform float uDepth;
uniform float uHeld;
void main(){
  vec3 N=normalize(vN);
  vec3 L=normalize(uLight);
  vec3 V=normalize(uCam-vWorld);
  float ndl=max(dot(N,L),0.0);
  float fill=max(dot(N,normalize(vec3(0.35,0.55,0.28))),0.0);
  vec3 H=normalize(L+V);
  float shin=mix(72.0,12.0,clamp(uRough,0.0,1.0));
  float spec=pow(max(dot(N,H),0.0),shin)*(1.0-uRough*0.75)*mix(0.25,1.05,uMetal);
  float fres=pow(1.0-max(dot(N,V),0.0),2.4);
  float hemi=clamp(N.y*0.5+0.5,0.0,1.0);
  vec3 env=mix(vec3(0.03,0.16,0.22),vec3(0.78,0.93,0.96),hemi);
  vec3 ambient=env*uColor*mix(0.72,0.36,uMetal);
  vec3 diffuse=uColor*(ndl*mix(1.0,0.32,uMetal)+fill*0.22);
  vec3 specCol=mix(vec3(1.0,0.98,0.92),uColor,uMetal*0.45)*spec;
  vec3 rimCol=vec3(0.82,0.96,0.94)*fres*uFresnel;
  float ao=mix(0.72,1.0,smoothstep(0.0,0.16,vLift));
  vec3 lit=(ambient+diffuse)*ao+specCol+rimCol;
  float depth=clamp(uDepth,0.0,1.0);
  vec3 water=vec3(0.03,0.24,0.40);
  float soft=mix(1.0,0.42,depth);
  vec3 murk=mix(water,lit*0.35+water,0.55);
  lit=mix(lit,murk,depth);
  float l=dot(lit,vec3(0.30,0.50,0.20));
  lit=mix(vec3(l),lit,soft)+water*depth*0.18;
  specCol*=(1.0-depth*0.9);
  lit+=vec3(0.14,0.12,0.08)*uHeld;
  float alpha=mix(uAlpha,uAlpha*0.42+0.08,depth);
  alpha=mix(alpha,min(1.0,alpha+0.12),uHeld);
  alpha=clamp(mix(alpha,1.0,fres*uFresnel*(1.0-depth*0.65)),0.0,1.0);
  gl_FragColor=vec4(lit*alpha,alpha);
}`;

function repl(s,a,b){return s.split(a).join(b);}
function sources(version){
 if(version===1)return{vert:VERT,frag:FRAG};
 const vert='#version 300 es\n'+repl(repl(VERT,'attribute ','in '),'varying ','out ');
 const frag='#version 300 es\n'+repl(repl(repl(FRAG,'precision mediump float;','precision mediump float;\nout vec4 fragColor;'),'varying ','in '),'gl_FragColor','fragColor');
 return{vert,frag};
}
function compile(gl,type,src){
 const s=gl.createShader(type);
 gl.shaderSource(s,src);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){console.warn('Ocean Clean 3D:',gl.getShaderInfoLog(s));gl.deleteShader(s);return null;}
 return s;
}
function link(gl,version){
 const {vert,frag}=sources(version),vs=compile(gl,gl.VERTEX_SHADER,vert),fs=compile(gl,gl.FRAGMENT_SHADER,frag);
 if(!vs||!fs)return null;
 const p=gl.createProgram();
 gl.attachShader(p,vs);gl.attachShader(p,fs);gl.bindAttribLocation(p,0,'aPos');gl.bindAttribLocation(p,1,'aNrm');
 gl.linkProgram(p);
 if(!gl.getProgramParameter(p,gl.LINK_STATUS)){console.warn('Ocean Clean 3D:',gl.getProgramInfoLog(p));return null;}
 return p;
}
function upload(gl,part){
 const n=part.positions.length/3,inter=new Float32Array(n*6);
 for(let i=0;i<n;i++){
  inter[i*6]=part.positions[i*3];inter[i*6+1]=part.positions[i*3+1];inter[i*6+2]=part.positions[i*3+2];
  inter[i*6+3]=part.normals[i*3];inter[i*6+4]=part.normals[i*3+1];inter[i*6+5]=part.normals[i*3+2];
 }
 const vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,inter,gl.STATIC_DRAW);
 const ibo=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,part.indices,gl.STATIC_DRAW);
 return{vbo,ibo,count:part.indices.length};
}

const COLORS={
 'plastik:pet-flasche':'#7fd4ea',
 'metall:dose':'#d01218',
 'glas:gruene-flasche':'#1c8a3a'
};

export class PileView{
 constructor(){
  this.active=false;
  this.canvas=document.createElement('canvas');
  this.canvas.className='pile-view';this.canvas.setAttribute('aria-hidden','true');
  const gl=this.canvas.getContext('webgl',ATTRS)||this.canvas.getContext('experimental-webgl',ATTRS);
  const gl2=!gl&&this.canvas.getContext('webgl2',ATTRS);
  this.gl=gl||gl2;if(!this.gl)return;
  this.program=link(this.gl,gl?1:2);if(!this.program)return;
  const g=this.gl;
  this.meshes=new Map();
  for(const key of MESH_KEYS){
   const mesh=getMesh(key);
   this.meshes.set(key,{parts:mesh.parts.map(part=>({mat:part,gpu:upload(g,part)}))});
  }
  const p=this.program;
  this.loc={
   model:g.getUniformLocation(p,'uModel'),vp:g.getUniformLocation(p,'uVP'),
   color:g.getUniformLocation(p,'uColor'),light:g.getUniformLocation(p,'uLight'),cam:g.getUniformLocation(p,'uCam'),
   metal:g.getUniformLocation(p,'uMetal'),rough:g.getUniformLocation(p,'uRough'),alpha:g.getUniformLocation(p,'uAlpha'),
   fresnel:g.getUniformLocation(p,'uFresnel'),depth:g.getUniformLocation(p,'uDepth'),held:g.getUniformLocation(p,'uHeld'),
   pos:g.getAttribLocation(p,'aPos'),nrm:g.getAttribLocation(p,'aNrm')
  };
  this.canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.drop();});
  this.active=true;
 }
 resize(width,height,dpr){
  const w=Math.max(1,Math.round(width*dpr)),h=Math.max(1,Math.round(height*dpr));
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  this.cssW=Math.max(1,width);this.cssH=Math.max(1,height);
 }
 drop(){this.active=false;}
 render(pile,swayOf){
  if(!this.active)return;
  try{this.draw(pile,swayOf);}catch(error){console.warn('Ocean Clean: 3D-Haufen ausgefallen.',error);this.drop();}
 }
 draw(pile,swayOf){
  const gl=this.gl,items=[];
  for(const body of pile.bodies){
   const pose=itemPose(body,swayOf(body));
   items.push({body,pose,key:body.kind.key});
  }
  items.sort((a,b)=>(a.pose.held-b.pose.held)||(a.pose.lift-b.pose.lift));
  gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  if(!items.length)return;
  gl.useProgram(this.program);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  gl.uniformMatrix4fv(this.loc.vp,false,obliqueMatrix(this.cssW,this.cssH));
  gl.uniform3f(this.loc.light,-.42,.86,-.28);
  gl.uniform3f(this.loc.cam,this.cssW*.34,Math.max(this.cssW,this.cssH)*.85,this.cssH*.18);
  for(const item of items){
   gl.uniformMatrix4fv(this.loc.model,false,modelMatrix(item.pose,pile.base));
   gl.uniform1f(this.loc.depth,0);
   gl.uniform1f(this.loc.held,item.pose.held?1:0);
   const parts=this.meshes.get(item.key).parts;
   gl.depthMask(true);
   for(const part of parts)if(part.mat.alpha>=.99)this.drawPart(part);
   for(const part of parts)if(part.mat.alpha<.99)this.drawPart(part);
  }
  gl.depthMask(true);
 }
 drawPart(part){
  const gl=this.gl,loc=this.loc,m=part.mat;
  gl.bindBuffer(gl.ARRAY_BUFFER,part.gpu.vbo);
  gl.enableVertexAttribArray(loc.pos);gl.enableVertexAttribArray(loc.nrm);
  gl.vertexAttribPointer(loc.pos,3,gl.FLOAT,false,24,0);
  gl.vertexAttribPointer(loc.nrm,3,gl.FLOAT,false,24,12);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,part.gpu.ibo);
  gl.uniform3fv(loc.color,m.color);
  gl.uniform1f(loc.metal,m.metal);gl.uniform1f(loc.rough,m.rough);gl.uniform1f(loc.alpha,m.alpha);gl.uniform1f(loc.fresnel,m.fresnel);
  gl.drawElements(gl.TRIANGLES,part.gpu.count,gl.UNSIGNED_SHORT,0);
 }
}

export function fallbackColor(key){return COLORS[key]||'#9fd';}
