// Die 24 texturierten GLB-Teile über dem Meer. Materialien kommen aus den Dateien
// (baseColor, normal, metallicRoughness). Nichts unter Wasser.
import {MESH_KEYS,getMesh} from './item-mesh.js?v=20261106-td';
import {itemPose,modelMatrix,obliqueMatrix} from './pile-pose.js?v=20261106-td';

const ATTRS={alpha:true,antialias:true,depth:true,stencil:false,premultipliedAlpha:true,powerPreference:'low-power',preserveDrawingBuffer:false};
const VERT=`precision highp float;
attribute vec3 aPos;
attribute vec3 aNrm;
attribute vec2 aUv;
attribute vec4 aTan;
uniform mat4 uModel;
uniform mat4 uVP;
varying vec3 vN;
varying vec3 vT;
varying vec3 vB;
varying vec2 vUv;
varying vec3 vWorld;
varying float vLift;
void main(){
  vec4 world=uModel*vec4(aPos,1.0);
  vWorld=world.xyz;
  mat3 M=mat3(uModel);
  vN=M*aNrm;
  vec3 t=M*aTan.xyz;
  vT=t;
  vB=cross(vN,t)*aTan.w;
  vUv=aUv;
  vLift=aPos.y;
  gl_Position=uVP*world;
}`;
const FRAG=`precision mediump float;
varying vec3 vN;
varying vec3 vT;
varying vec3 vB;
varying vec2 vUv;
varying vec3 vWorld;
varying float vLift;
uniform sampler2D uBase;
uniform sampler2D uNrm;
uniform sampler2D uMr;
uniform vec3 uLight;
uniform vec3 uCam;
uniform vec3 uBaseFactor;
uniform float uMetal;
uniform float uRough;
uniform float uNormalScale;
uniform float uHeld;
void main(){
  vec3 base=pow(texture2D(uBase,vUv).rgb*uBaseFactor,vec3(2.2));
  vec3 ntex=texture2D(uNrm,vUv).xyz*2.0-1.0;
  ntex.xy*=uNormalScale;
  vec3 N=normalize(vT*ntex.x+vB*ntex.y+vN*ntex.z);
  vec3 mr=texture2D(uMr,vUv).rgb;
  float rough=clamp(mr.g*uRough,0.08,1.0);
  float metal=clamp(mr.b*uMetal,0.0,1.0);
  vec3 V=normalize(uCam-vWorld);
  float hemi=N.y*0.5+0.5;
  vec3 sky=mix(vec3(0.62,0.74,0.82),vec3(1.0,0.98,0.94),hemi);
  vec3 L=normalize(uLight);
  float ndl=clamp(dot(N,L)*0.55+0.45,0.0,1.0);
  vec3 H=normalize(L+V);
  float shin=mix(72.0,10.0,rough);
  float spec=pow(max(dot(N,H),0.0),shin)*(1.0-rough*0.65);
  vec3 F0=mix(vec3(0.04),base,metal);
  float ao=mix(0.62,1.0,smoothstep(0.0,0.07,vLift));
  vec3 lit=base*(sky*0.42+ndl*0.72)*ao;
  lit+=F0*spec*mix(0.35,1.05,metal);
  lit+=vec3(0.07)*uHeld;
  lit=pow(max(lit,0.0),vec3(0.4545));
  gl_FragColor=vec4(lit,1.0);
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
 gl.attachShader(p,vs);gl.attachShader(p,fs);
 gl.bindAttribLocation(p,0,'aPos');gl.bindAttribLocation(p,1,'aNrm');
 gl.bindAttribLocation(p,2,'aUv');gl.bindAttribLocation(p,3,'aTan');
 gl.linkProgram(p);
 if(!gl.getProgramParameter(p,gl.LINK_STATUS)){console.warn('Ocean Clean 3D:',gl.getProgramInfoLog(p));return null;}
 return p;
}

const STRIDE=12;
function uploadMesh(gl,mesh){
 const n=mesh.positions.length/3,inter=new Float32Array(n*STRIDE);
 for(let i=0;i<n;i++){
  const o=i*STRIDE;
  inter[o]=mesh.positions[i*3];inter[o+1]=mesh.positions[i*3+1];inter[o+2]=mesh.positions[i*3+2];
  inter[o+3]=mesh.normals[i*3];inter[o+4]=mesh.normals[i*3+1];inter[o+5]=mesh.normals[i*3+2];
  inter[o+6]=mesh.uvs[i*2];inter[o+7]=mesh.uvs[i*2+1];
  inter[o+8]=mesh.tangents[i*4];inter[o+9]=mesh.tangents[i*4+1];inter[o+10]=mesh.tangents[i*4+2];inter[o+11]=mesh.tangents[i*4+3];
 }
 const vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,inter,gl.STATIC_DRAW);
 const ibo=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW);
 const type=mesh.indices instanceof Uint32Array?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT;
 return{vbo,ibo,count:mesh.indices.length,type,mesh};
}

function sig(bytes){
 let h=2166136261;
 const step=Math.max(1,(bytes.length/48)|0);
 for(let i=0;i<bytes.length;i+=step)h=Math.imul(h^bytes[i],16777619);
 return bytes.length+':'+h;
}

async function decodeJpeg(bytes){
 const blob=new Blob([bytes],{type:'image/jpeg'});
 if(typeof createImageBitmap==='function'){
  try{return await createImageBitmap(blob);}catch{/* Image fallback */}
 }
 const url=URL.createObjectURL(blob);
 try{
  return await new Promise((res,rej)=>{const img=new Image();img.onload=()=>res(img);img.onerror=()=>rej(new Error('jpeg'));img.src=url;});
 }finally{URL.revokeObjectURL(url);}
}

function makeTexture(gl,source){
 const t=gl.createTexture();
 gl.bindTexture(gl.TEXTURE_2D,t);
 gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
 gl.generateMipmap(gl.TEXTURE_2D);
 const ext=gl.getExtension('EXT_texture_filter_anisotropic')||gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
 if(ext){
  const max=gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)||1;
  gl.texParameterf(gl.TEXTURE_2D,ext.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(4,max));
 }
 return t;
}

const COLORS={
 'plastik:pet-flasche':'#d8e4ea',
 'metall:dose':'#c8ccd0',
 'glas:gruene-flasche':'#7fbf78',
 'rest:reifen':'#3a3e44'
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
  if(!gl)g.getExtension('OES_element_index_uint');
  this.meshes=new Map();
  for(const key of MESH_KEYS){
   const mesh=getMesh(key);
   if(!mesh)continue;
   this.meshes.set(key,uploadMesh(g,mesh));
  }
  if(this.meshes.size!==MESH_KEYS.length){console.warn('Ocean Clean: GLB-Netze unvollständig');return;}
  const p=this.program;
  this.loc={
   model:g.getUniformLocation(p,'uModel'),vp:g.getUniformLocation(p,'uVP'),
   light:g.getUniformLocation(p,'uLight'),cam:g.getUniformLocation(p,'uCam'),
   baseFactor:g.getUniformLocation(p,'uBaseFactor'),
   metal:g.getUniformLocation(p,'uMetal'),rough:g.getUniformLocation(p,'uRough'),
   normalScale:g.getUniformLocation(p,'uNormalScale'),held:g.getUniformLocation(p,'uHeld'),
   base:g.getUniformLocation(p,'uBase'),nrm:g.getUniformLocation(p,'uNrm'),mr:g.getUniformLocation(p,'uMr'),
   pos:g.getAttribLocation(p,'aPos'),norm:g.getAttribLocation(p,'aNrm'),
   uv:g.getAttribLocation(p,'aUv'),tan:g.getAttribLocation(p,'aTan')
  };
  this.textures=null;
  this.canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.drop();});
  this.ready=false;
 }
 async warm(){
  if(!this.gl||!this.program||this.meshes.size!==MESH_KEYS.length)return false;
  const gl=this.gl;
  const shared=new Map();
  const loadTex=async bytes=>{
   const key=sig(bytes);
   if(shared.has(key))return shared.get(key);
   const img=await decodeJpeg(bytes);
   const tex=makeTexture(gl,img);
   if(img.close)img.close();
   shared.set(key,tex);
   return tex;
  };
  const first=this.meshes.get(MESH_KEYS[0]).mesh.images;
  this.textures={
   base:await loadTex(first.base),
   normal:await loadTex(first.normal),
   mr:await loadTex(first.mr)
  };
  for(const gpu of this.meshes.values()){
   const img=gpu.mesh.images;
   gpu.tex={
    base:sig(img.base)===sig(first.base)?this.textures.base:await loadTex(img.base),
    normal:sig(img.normal)===sig(first.normal)?this.textures.normal:await loadTex(img.normal),
    mr:sig(img.mr)===sig(first.mr)?this.textures.mr:await loadTex(img.mr)
   };
  }
  this.ready=true;this.active=true;return true;
 }
 resize(width,height,dpr){
  const w=Math.max(1,Math.round(width*dpr)),h=Math.max(1,Math.round(height*dpr));
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  this.cssW=Math.max(1,width);this.cssH=Math.max(1,height);
 }
 drop(){this.active=false;}
 render(pile,swayOf){
  if(!this.active||!this.ready)return;
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
  gl.disable(gl.BLEND);
  gl.uniformMatrix4fv(this.loc.vp,false,obliqueMatrix(this.cssW,this.cssH));
  gl.uniform3f(this.loc.light,-.25,.94,.22);
  gl.uniform3f(this.loc.cam,this.cssW*.34,Math.max(this.cssW,this.cssH)*.85,this.cssH*.18);
  gl.uniform1i(this.loc.base,0);gl.uniform1i(this.loc.nrm,1);gl.uniform1i(this.loc.mr,2);
  const stride=STRIDE*4;
  for(const item of items){
   const gpu=this.meshes.get(item.key);
   if(!gpu)continue;
   gl.uniformMatrix4fv(this.loc.model,false,modelMatrix(item.pose,pile.base));
   gl.uniform1f(this.loc.held,item.pose.held?1:0);
   const m=gpu.mesh;
   gl.uniform3f(this.loc.baseFactor,m.baseFactor[0],m.baseFactor[1],m.baseFactor[2]);
   gl.uniform1f(this.loc.metal,m.metallicFactor);
   gl.uniform1f(this.loc.rough,m.roughnessFactor);
   gl.uniform1f(this.loc.normalScale,m.normalScale||1);
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,gpu.tex.base);
   gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,gpu.tex.normal);
   gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,gpu.tex.mr);
   gl.bindBuffer(gl.ARRAY_BUFFER,gpu.vbo);
   gl.enableVertexAttribArray(this.loc.pos);gl.enableVertexAttribArray(this.loc.norm);
   gl.enableVertexAttribArray(this.loc.uv);gl.enableVertexAttribArray(this.loc.tan);
   gl.vertexAttribPointer(this.loc.pos,3,gl.FLOAT,false,stride,0);
   gl.vertexAttribPointer(this.loc.norm,3,gl.FLOAT,false,stride,12);
   gl.vertexAttribPointer(this.loc.uv,2,gl.FLOAT,false,stride,24);
   gl.vertexAttribPointer(this.loc.tan,4,gl.FLOAT,false,stride,32);
   gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gpu.ibo);
   if(m.doubleSided)gl.disable(gl.CULL_FACE);else gl.enable(gl.CULL_FACE);
   gl.drawElements(gl.TRIANGLES,gpu.count,gpu.type,0);
  }
  gl.enable(gl.CULL_FACE);
 }
}

export function fallbackColor(key){return COLORS[key]||'#d5ddd8';}
