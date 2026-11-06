// Minimal glTF 2.0 binary reader for the trash items.
// One mesh, POSITION / NORMAL / TEXCOORD_0, embedded images.
// KHR_draco_mesh_compression wird nur entpackt, nicht neu vernetzt.
import {decodeDracoMesh} from './draco-decode.js';

const COMPS={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};

function viewOf(buf){
 if(buf instanceof ArrayBuffer)return new Uint8Array(buf);
 return buf;
}

function chunk(u8,offset){
 const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);
 const len=dv.getUint32(offset,true);
 const type=dv.getUint32(offset+4,true);
 return{len,type,data:u8.subarray(offset+8,offset+8+len),next:offset+8+len};
}

function accessor(json,bin,index){
 const a=json.accessors[index];
 const bv=json.bufferViews[a.bufferView];
 const comps=COMPS[a.type];
 const bytes={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}[a.componentType];
 if(!comps||!bytes)throw new Error('unsupported accessor '+a.type+' '+a.componentType);
 return{
  count:a.count,comps,bytes,ctype:a.componentType,
  start:(bv.byteOffset||0)+(a.byteOffset||0),
  stride:bv.byteStride||comps*bytes
 };
}

function readNum(bin,ctype,offset){
 const dv=new DataView(bin.buffer,bin.byteOffset+offset,bytesOf(ctype));
 if(ctype===5126)return dv.getFloat32(0,true);
 if(ctype===5125)return dv.getUint32(0,true);
 if(ctype===5123)return dv.getUint16(0,true);
 if(ctype===5121)return bin[offset];
 if(ctype===5122)return dv.getInt16(0,true);
 if(ctype===5120)return dv.getInt8(0);
 throw new Error('component '+ctype);
}
function bytesOf(ctype){return ctype===5126||ctype===5125?4:ctype===5123||ctype===5122?2:1;}

function readArray(bin,acc,out,width){
 for(let i=0;i<acc.count;i++){
  const o=acc.start+i*acc.stride;
  for(let c=0;c<width;c++)out[i*width+c]=readNum(bin,acc.ctype,o+c*acc.bytes);
 }
 return out;
}

function imageBytes(json,bin,textureIndex){
 if(textureIndex==null)return null;
 const tex=json.textures[textureIndex];
 const img=json.images[tex.source];
 if(img.bufferView==null)throw new Error('external image');
 const bv=json.bufferViews[img.bufferView];
 const start=bv.byteOffset||0;
 return bin.slice(start,start+bv.byteLength);
}

export function parseGlb(buffer,draco){
 const u8=viewOf(buffer);
 if(u8.length<20||u8[0]!==0x67||u8[1]!==0x6c||u8[2]!==0x54||u8[3]!==0x46)throw new Error('not a GLB');
 const jsonChunk=chunk(u8,12);
 if(jsonChunk.type!==0x4E4F534A)throw new Error('GLB json missing');
 const json=JSON.parse(new TextDecoder().decode(jsonChunk.data));
 const binChunk=chunk(u8,jsonChunk.next);
 if(binChunk.type!==0x004E4942)throw new Error('GLB bin missing');
 const bin=binChunk.data;
 const mesh=json.meshes?.[0];
 if(!mesh?.primitives?.length)throw new Error('GLB has no mesh');
 let positions,normals,uvs,indices;
 const lists={pos:[],nrm:[],uv:[],idx:[]};
 let baseIndex=0;
 for(const prim of mesh.primitives){
  if((prim.mode??4)!==4)throw new Error('only triangles');
  let pos,nrm,uv,idx;
  if(prim.extensions?.KHR_draco_mesh_compression){
   if(!draco)throw new Error('Draco-Decoder nicht bereit');
   const decoded=decodeDracoMesh(draco,bin,json,prim);
   pos=decoded.positions;nrm=decoded.normals;uv=decoded.uvs;idx=decoded.indices;
  }else{
   const pa=accessor(json,bin,prim.attributes.POSITION);
   const na=accessor(json,bin,prim.attributes.NORMAL);
   const ta=accessor(json,bin,prim.attributes.TEXCOORD_0);
   const ia=accessor(json,bin,prim.indices);
   pos=readArray(bin,pa,new Float32Array(pa.count*3),3);
   nrm=readArray(bin,na,new Float32Array(na.count*3),3);
   uv=readArray(bin,ta,new Float32Array(ta.count*2),2);
   idx=readArray(bin,ia,new Uint32Array(ia.count),1);
  }
  lists.pos.push(pos);lists.nrm.push(nrm);lists.uv.push(uv);
  for(let i=0;i<idx.length;i++)lists.idx.push(idx[i]+baseIndex);
  baseIndex+=pos.length/3;
  positions=pos;normals=nrm;uvs=uv;indices=idx;
 }
 if(mesh.primitives.length>1){
  positions=concatFloat(lists.pos);
  normals=concatFloat(lists.nrm);
  uvs=concatFloat(lists.uv);
  indices=Uint32Array.from(lists.idx);
 }
 const prim0=mesh.primitives[0];
 const mat=json.materials?.[prim0.material]||{};
 const pbr=mat.pbrMetallicRoughness||{};
 const baseTex=pbr.baseColorTexture?.index;
 if(baseTex==null)throw new Error('GLB missing baseColor');
 const baseImg=json.images[json.textures[baseTex].source];
 const images={
  base:imageBytes(json,bin,baseTex),
  mime:baseImg.mimeType||'image/png'
 };
 if(!images.base)throw new Error('GLB missing baseColor');
 const mask=mat.alphaMode==='MASK';
 return{
  positions,normals,uvs,indices,
  images,
  doubleSided:!!mat.doubleSided,
  baseFactor:pbr.baseColorFactor||[1,1,1,1],
  alphaCutoff:mask?(mat.alphaCutoff??.5):0
 };
}

function concatFloat(parts){
 let n=0;for(const p of parts)n+=p.length;
 const o=new Float32Array(n);let k=0;
 for(const p of parts){o.set(p,k);k+=p.length;}
 return o;
}
