// Die 24 GLB-Teile über dem Meer. Jedes zeigt nur sein gemaltes Draufsicht-Bild
// (baseColor, Alpha-Maske). Kein Atlas, keine Normal- oder Metallkarte.
import {MESH_KEYS,getMesh} from './item-mesh.js?v=20261106-v8b';
import {itemPose,modelMatrix,obliqueMatrix} from './pile-pose.js?v=20261106-v8b';

const ATTRS={alpha:true,antialias:true,depth:true,stencil:false,premultipliedAlpha:true,powerPreference:'low-power',preserveDrawingBuffer:false};
const VERT=`precision highp float;
attribute vec3 aPos;
attribute vec3 aNrm;
attribute vec2 aUv;
uniform mat4 uModel;
uniform mat4 uVP;
varying vec3 vN;
varying vec2 vUv;
void main(){
  vec4 world=uModel*vec4(aPos,1.0);
  vN=mat3(uModel)*aNrm;
  vUv=aUv;
  gl_Position=uVP*world;
}`;
const FRAG=`precision mediump float;
varying vec3 vN;
varying vec2 vUv;
uniform sampler2D uBase;
uniform vec3 uBaseFactor;
uniform float uCutoff;
uniform float uHeld;
void main(){
  vec4 tex=texture2D(uBase,vUv);
  if(tex.a<uCutoff) discard;
  float up=clamp(normalize(vN).y*0.5+0.5,0.0,1.0);
  vec3 lit=tex.rgb*uBaseFactor*mix(0.9,1.0,up)+vec3(0.04)*uHeld;
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
 gl.bindAttribLocation(p,2,'aUv');
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

async function decodeImage(bytes,mime='image/png'){
 const blob=new Blob([bytes],{type:mime||'image/png'});
 if(typeof createImageBitmap==='function'){
  try{return await createImageBitmap(blob);}catch{/* Image fallback */}
 }
 const url=URL.createObjectURL(blob);
 try{
  return await new Promise((res,rej)=>{const img=new Image();img.onload=()=>res(img);img.onerror=()=>rej(new Error('jpeg'));img.src=url;});
 }finally{URL.revokeObjectURL(url);}
}

function isPot(n){return n>0&&(n&(n-1))===0;}
function makeTexture(gl,source){
 const t=gl.createTexture();
 gl.bindTexture(gl.TEXTURE_2D,t);
 gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
 gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
 const pot=isPot(source.width)&&isPot(source.height);
 const wrap=pot?gl.REPEAT:gl.CLAMP_TO_EDGE;
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,wrap);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,wrap);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 if(pot){
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
 }else gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
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
  if(gl)g.getExtension('OES_element_index_uint');
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
   cutoff:g.getUniformLocation(p,'uCutoff'),held:g.getUniformLocation(p,'uHeld'),
   base:g.getUniformLocation(p,'uBase'),
   pos:g.getAttribLocation(p,'aPos'),norm:g.getAttribLocation(p,'aNrm'),
   uv:g.getAttribLocation(p,'aUv')
  };
  this.textures=null;
  this.canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.drop();});
  this.ready=false;
 }
 async warm(){
  if(!this.gl||!this.program||this.meshes.size!==MESH_KEYS.length)return false;
  const gl=this.gl;
  const shared=new Map();
  const loadTex=async (bytes,mime)=>{
   const key=sig(bytes);
   if(shared.has(key))return shared.get(key);
   const img=await decodeImage(bytes,mime);
   const tex=makeTexture(gl,img);
   if(img.close)img.close();
   shared.set(key,tex);
   return tex;
  };
  for(const gpu of this.meshes.values()){
   const img=gpu.mesh.images;
   gpu.tex={base:await loadTex(img.base,img.mime)};
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
  const pw=this.canvas.clientWidth||this.cssW,ph=this.canvas.clientHeight||this.cssH;
  gl.uniformMatrix4fv(this.loc.vp,false,obliqueMatrix(pw,ph));
  gl.uniform1i(this.loc.base,0);
  const stride=STRIDE*4;
  for(const item of items){
   const gpu=this.meshes.get(item.key);
   if(!gpu)continue;
   gl.uniformMatrix4fv(this.loc.model,false,modelMatrix(item.pose,pile.base));
   gl.uniform1f(this.loc.held,item.pose.held?1:0);
   const m=gpu.mesh;
   gl.uniform3f(this.loc.baseFactor,m.baseFactor[0],m.baseFactor[1],m.baseFactor[2]);
   gl.uniform1f(this.loc.cutoff,m.alphaCutoff||0);
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,gpu.tex.base);
   gl.bindBuffer(gl.ARRAY_BUFFER,gpu.vbo);
   gl.enableVertexAttribArray(this.loc.pos);gl.enableVertexAttribArray(this.loc.norm);
   gl.enableVertexAttribArray(this.loc.uv);
   gl.vertexAttribPointer(this.loc.pos,3,gl.FLOAT,false,stride,0);
   gl.vertexAttribPointer(this.loc.norm,3,gl.FLOAT,false,stride,12);
   gl.vertexAttribPointer(this.loc.uv,2,gl.FLOAT,false,stride,24);
   gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gpu.ibo);
   if(m.doubleSided)gl.disable(gl.CULL_FACE);else gl.enable(gl.CULL_FACE);
   gl.drawElements(gl.TRIANGLES,gpu.count,gpu.type,0);
  }
  gl.enable(gl.CULL_FACE);
 }
}

export function fallbackColor(key){return COLORS[key]||'#d5ddd8';}
