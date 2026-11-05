// Transparentes WebGL-Canvas über dem Müll, nur für den Prototyp (?items3d=1).
// Wenige Low-Poly-Netze, statische Puffer, DPR gedeckelt. Fehlt WebGL oder bricht
// der Kontext weg, bleibt das Canvas draussen und die PNG-Sprites übernehmen.
import {getPrototypeMesh,hasPrototypeMesh,meshKey,PROTOTYPE_KEYS} from './trash-meshes.js?v=20261105-items3d3';
import {itemPose,meshScale,modelMatrix,obliqueMatrix} from './trash-pose.js?v=20261105-items3d3';

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
void main(){
  vec3 N=normalize(vN);
  vec3 L=normalize(uLight);
  vec3 V=normalize(uCam-vWorld);
  float ndl=max(dot(N,L),0.0);
  float fill=max(dot(N,normalize(vec3(0.40,0.32,0.62))),0.0);
  vec3 H=normalize(L+V);
  float shin=mix(80.0,14.0,clamp(uRough,0.0,1.0));
  float spec=pow(max(dot(N,H),0.0),shin)*(1.0-uRough*0.82)*mix(0.28,1.15,uMetal);
  float fres=pow(1.0-max(dot(N,V),0.0),2.6);
  float hemi=clamp(N.y*0.5+0.5,0.0,1.0);
  vec3 env=mix(vec3(0.03,0.15,0.20),vec3(0.80,0.94,0.97),hemi);
  vec3 ambient=env*uColor*mix(0.70,0.34,uMetal);
  vec3 diffuse=uColor*(ndl*mix(1.0,0.28,uMetal)+fill*0.20);
  vec3 specCol=mix(vec3(1.0,0.98,0.92),uColor,uMetal*0.55)*spec;
  vec3 rimCol=vec3(0.84,0.97,0.95)*fres*uFresnel;
  float ao=mix(0.66,1.0,smoothstep(0.0,0.18,vLift));
  vec3 color=(ambient+diffuse)*ao+specCol+rimCol;
  float alpha=clamp(mix(uAlpha,1.0,fres*uFresnel),0.0,1.0);
  gl_FragColor=vec4(color*alpha,alpha);
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

export class Items3D{
 constructor(trash){
  this.trash=trash;this.active=false;this.t0=0;
  this.canvas=document.createElement('canvas');
  this.canvas.className='trash-items3d';this.canvas.setAttribute('aria-hidden','true');
  const gl=this.canvas.getContext('webgl',ATTRS)||this.canvas.getContext('experimental-webgl',ATTRS);
  const gl2=!gl&&this.canvas.getContext('webgl2',ATTRS);
  this.gl=gl||gl2;if(!this.gl)return;
  this.program=link(this.gl,gl?1:2);if(!this.program)return;
  const g=this.gl;
  this.meshes=new Map();
  for(const key of PROTOTYPE_KEYS){
   const mesh=getPrototypeMesh(key);
   this.meshes.set(key,{parts:mesh.parts.map(part=>({mat:part,gpu:upload(g,part)}))});
  }
  const p=this.program;
  this.loc={
   model:g.getUniformLocation(p,'uModel'),vp:g.getUniformLocation(p,'uVP'),
   color:g.getUniformLocation(p,'uColor'),light:g.getUniformLocation(p,'uLight'),cam:g.getUniformLocation(p,'uCam'),
   metal:g.getUniformLocation(p,'uMetal'),rough:g.getUniformLocation(p,'uRough'),alpha:g.getUniformLocation(p,'uAlpha'),fresnel:g.getUniformLocation(p,'uFresnel'),
   pos:g.getAttribLocation(p,'aPos'),nrm:g.getAttribLocation(p,'aNrm')
  };
  this.canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.drop();});
  trash.ocean.spray.before(this.canvas);
  this.resize();this.active=true;
 }
 handles(body){return this.active&&hasPrototypeMesh(body?.kind);}
 resize(){
  const o=this.trash.ocean,dpr=Math.min(devicePixelRatio||1,1.5);
  const w=Math.max(1,Math.round(o.width*dpr)),h=Math.max(1,Math.round(o.height*dpr));
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  this.cssW=Math.max(1,o.width);this.cssH=Math.max(1,o.height);
 }
 drop(){this.active=false;this.canvas.remove();}
 render(now){
  if(!this.active)return;
  try{this.draw(now);}catch(error){console.warn('Ocean Clean: 3D-Items ausgefallen, PNG-Fallback.',error);this.drop();}
 }
 draw(now){
  if(!this.t0)this.t0=now;
  const gl=this.gl,trash=this.trash,time=(now-this.t0)/1000,motion=!trash.ocean.reducedMotion;
  const items=[];
  for(const body of trash.bodies){
   if(!hasPrototypeMesh(body.kind))continue;
   items.push({body,pose:itemPose(body,time,{motion}),scale:meshScale(trash.look(body)),key:meshKey(body.kind)});
  }
  gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  if(!items.length)return;
  gl.useProgram(this.program);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  gl.uniformMatrix4fv(this.loc.vp,false,obliqueMatrix(this.cssW,this.cssH));
  gl.uniform3f(this.loc.light,-0.46,0.84,-0.32);
  gl.uniform3f(this.loc.cam,this.cssW*0.32,Math.max(this.cssW,this.cssH)*0.9,this.cssH*0.22);
  const pass=(pred,mask)=>{
   gl.depthMask(mask);
   for(const item of items){
    const model=modelMatrix(item.pose,item.scale);
    gl.uniformMatrix4fv(this.loc.model,false,model);
    for(const part of this.meshes.get(item.key).parts){
     if(!pred(part.mat))continue;
     this.drawPart(part);
    }
   }
  };
  pass(mat=>mat.alpha>=0.99&&!mat.decal,true);
  pass(mat=>mat.alpha>=0.99&&mat.decal,true);
  items.sort((a,b)=>b.pose.lift-a.pose.lift);
  pass(mat=>mat.alpha<0.99,true);
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

export function attachItems3D(trash){
 let view=null;
 try{view=new Items3D(trash);}catch(error){console.warn('Ocean Clean: 3D-Items nicht verfügbar, PNG-Fallback.',error);return null;}
 if(!view?.active){view?.drop?.();return null;}
 trash.view3d=view;
 return view;
}
