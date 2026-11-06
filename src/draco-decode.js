// Draco 1.5.9 (Apache-2.0, Google) für KHR_draco_mesh_compression.
// Entpackt nur die gelieferte Geometrie. Kein Remesh, keine neuen UVs.
const jsUrl=new URL('./vendor/draco/draco_decoder_gltf.js',import.meta.url);
const wasmUrl=new URL('./vendor/draco/draco_decoder_gltf.wasm',import.meta.url);

async function readBytes(url){
 const fs=globalThis.process?.getBuiltinModule?.('fs');
 const urlMod=globalThis.process?.getBuiltinModule?.('url');
 if(fs&&urlMod)return fs.readFileSync(urlMod.fileURLToPath(url));
 const res=await fetch(url);
 if(!res.ok)throw new Error('Draco-Decoder fehlt');
 return new Uint8Array(await res.arrayBuffer());
}

async function loadFactory(jsText){
 const wrapped=`(async function(module, exports){\n${jsText}\nreturn module.exports;\n})`;
 if(globalThis.process?.getBuiltinModule){
  const vm=process.getBuiltinModule('vm');
  const sandbox={console,WebAssembly,URL,fetch,TextDecoder,TextEncoder,performance,queueMicrotask,module:{exports:{}},exports:{}};
  sandbox.globalThis=sandbox;sandbox.global=sandbox;sandbox.self=sandbox;sandbox.window=sandbox;
  sandbox.module.exports=sandbox.exports;
  return new vm.Script(wrapped,{filename:'draco_decoder_gltf.js'}).runInNewContext(sandbox)(sandbox.module,sandbox.exports);
 }
 const factory=new Function(`return ${wrapped}`)();
 const module={exports:{}};
 module.exports=module.exports;
 return factory(module,module.exports);
}

const dracoPromise=(async()=>{
 const [jsText,wasm]=await Promise.all([
  readBytes(jsUrl).then(b=>new TextDecoder().decode(b)),
  readBytes(wasmUrl)
 ]);
 const factory=await loadFactory(jsText);
 return factory({wasmBinary:wasm instanceof Uint8Array?wasm:new Uint8Array(wasm)});
})();

export function dracoReady(){return dracoPromise;}

function copyAttr(draco,decoder,mesh,attributeId,components){
 const attr=decoder.GetAttributeByUniqueId(mesh,attributeId);
 const count=mesh.num_points()*components;
 const ptr=draco._malloc(count*4);
 decoder.GetAttributeDataArrayForAllPoints(mesh,attr,draco.DT_FLOAT32,count*4,ptr);
 const out=new Float32Array(draco.HEAPF32.buffer,ptr,count).slice();
 draco._free(ptr);
 return out;
}

// Synchron, nachdem dracoReady() erfüllt ist.
export function decodeDracoMesh(draco,bin,json,primitive){
 const ext=primitive.extensions.KHR_draco_mesh_compression;
 const bv=json.bufferViews[ext.bufferView];
 const start=bv.byteOffset||0;
 const bytes=bin.subarray(start,start+bv.byteLength);
 const decoder=new draco.Decoder();
 const buffer=new draco.DecoderBuffer();
 buffer.Init(new Int8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength),bytes.byteLength);
 const mesh=new draco.Mesh();
 const status=decoder.DecodeBufferToMesh(buffer,mesh);
 if(!status.ok()||!mesh.num_points())throw new Error('Draco-Netz ließ sich nicht lesen');
 const map=ext.attributes;
 const positions=copyAttr(draco,decoder,mesh,map.POSITION,3);
 const normals=copyAttr(draco,decoder,mesh,map.NORMAL,3);
 const uvs=copyAttr(draco,decoder,mesh,map.TEXCOORD_0,2);
 const faces=mesh.num_faces();
 const ip=draco._malloc(faces*12);
 decoder.GetTrianglesUInt32Array(mesh,faces*12,ip);
 const indices=new Uint32Array(draco.HEAPU32.buffer,ip,faces*3).slice();
 draco._free(ip);
 draco.destroy(mesh);draco.destroy(buffer);draco.destroy(decoder);
 return{positions,normals,uvs,indices};
}
