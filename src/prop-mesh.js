// Wagen ohne Räder und ein einzelnes Rad. Beide sind Draco-GLBs unter assets/models.
import { parseGlb } from './glb-parse.js';
import { dracoReady } from './draco-decode.js';

const draco = await dracoReady();

function withTangents(parsed) {
  return { ...parsed, tangents: new Float32Array((parsed.positions.length / 3) * 4) };
}

async function loadOne(fetchImpl, file) {
  const bare = new URL('../assets/models/' + file, import.meta.url);
  const fs = globalThis.process?.getBuiltinModule?.('fs');
  const urlMod = globalThis.process?.getBuiltinModule?.('url');
  let bytes;
  if (fs && urlMod && fetchImpl === globalThis.fetch) {
    bytes = fs.readFileSync(urlMod.fileURLToPath(bare));
  } else {
    const res = await fetchImpl(new URL('../assets/models/' + file + '?v=20261106-v10', import.meta.url));
    if (!res.ok) throw new Error('Modell fehlt: ' + file);
    bytes = new Uint8Array(await res.arrayBuffer());
  }
  return withTangents(parseGlb(bytes, draco));
}

export async function loadPropMeshes(fetchImpl = globalThis.fetch) {
  const [truck, wheel] = await Promise.all([loadOne(fetchImpl, 'truck.glb'), loadOne(fetchImpl, 'wheel.glb')]);
  return { truck, wheel };
}
