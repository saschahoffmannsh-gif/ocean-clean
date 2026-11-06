// Recyclingwagen auf dem Strand. Maße aus dem Tripo-Netz (Y oben, X längs, Z quer).
// Die vier Mulden sitzen im Bett, von der Fahrerkabine (links, −X) nach hinten:
// Plastik, Metall, Glas, Restmüll. Die Radkästen sind bei x ≈ ±0.30 leer.
import { CATEGORIES } from './trash-catalog.js';

export const TRUCK_MESH = Object.freeze({
  length: 0.9808961153030396,
  width: 0.3927612900733948,
  height: 0.3404083251953125,
  wheelDiameter: 0.145,
  axleZ: 0.212,
  axles: Object.freeze([-0.300, 0.300]),
  holes: Object.freeze([
    Object.freeze({ category: 'plastik', x0: -0.129, x1: -0.037, z0: -0.046, z1: 0.046 }),
    Object.freeze({ category: 'metall', x0: 0.029, x1: 0.121, z0: -0.046, z1: 0.046 }),
    Object.freeze({ category: 'glas', x0: 0.196, x1: 0.287, z0: -0.046, z1: 0.046 }),
    Object.freeze({ category: 'rest', x0: 0.354, x1: 0.446, z0: -0.046, z1: 0.046 })
  ])
});

// Trefferflächen: die Mulde plus der Rand bis zur Nachbarmulde, damit der Finger
// auf dem Telefon die Abteilung trifft. Die gemalte Fläche bleibt das Loch selbst.
const HIT_X = Object.freeze([-0.168, -0.004, 0.1585, 0.3205, 0.478]);
const HIT_Z0 = -0.112;
const HIT_Z1 = 0.112;

function ident() {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}
function mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}
function translation(x, y, z) {
  const m = ident();
  m[12] = x; m[13] = y; m[14] = z;
  return m;
}
function scaling(x, y, z) {
  const m = ident();
  m[0] = x; m[5] = y; m[10] = z;
  return m;
}
function rotZ(a) {
  const c = Math.cos(a), s = Math.sin(a), m = ident();
  m[0] = c; m[1] = s; m[4] = -s; m[5] = c;
  return m;
}

export function truckMatrix(origin, scale) {
  return mul(translation(origin.x, origin.y, origin.z), scaling(scale, scale, scale));
}

// Rad: Einheitsdurchmesser, Achse = Z, Mittelpunkt im Ursprung. Erst skalieren,
// dann drehen, dann in den Radkasten setzen, dann mit dem Wagen in Pixel.
export function wheelMatrix(origin, scale, axle, spin, diameter) {
  const local = mul(translation(axle.x, axle.y, axle.z), mul(rotZ(spin), scaling(diameter, diameter, diameter)));
  return mul(truckMatrix(origin, scale), local);
}

export function binMatrix(origin, scale, hole) {
  const w = (hole.x1 - hole.x0) * 0.9;
  const d = (hole.z1 - hole.z0) * 0.9;
  const local = mul(translation((hole.x0 + hole.x1) / 2, 0.07, (hole.z0 + hole.z1) / 2), scaling(w, 1, d));
  return mul(truckMatrix(origin, scale), local);
}

// Weg nach links (negative X) dreht das Rad um die Z-Achse so, dass es abrollt.
export function wheelSpin(distancePx, radiusPx) {
  if (!(radiusPx > 0)) return 0;
  return distancePx / radiusPx;
}

export function layoutTruck(width, playH, centerX = null) {
  const mesh = TRUCK_MESH;
  const shoreLow = playH * (2 / 3) - 19;
  const beachH = playH - playH * (2 / 3);
  const depthRatio = mesh.width / mesh.length;
  const lengthByWidth = width * 0.96;
  const lengthByBeach = (beachH * 0.9) / depthRatio;
  const length = Math.min(lengthByWidth, Math.max(width * 0.62, lengthByBeach));
  const scale = length / mesh.length;
  const depth = mesh.width * scale;
  const cx = centerX == null ? width / 2 : centerX;
  const margin = 8;
  let centerY = (Math.max(shoreLow, playH * (2 / 3) - 8) + playH) / 2;
  const minY = shoreLow + margin + depth / 2;
  const maxY = playH - margin - depth / 2;
  if (minY <= maxY) centerY = Math.min(maxY, Math.max(minY, centerY));
  const origin = { x: cx, y: 0.8, z: centerY };
  const bins = CATEGORIES.map((category, index) => {
    const hole = mesh.holes[index];
    const x0 = HIT_X[index], x1 = HIT_X[index + 1];
    const px = origin.x + x0 * scale;
    const py = origin.z + HIT_Z0 * scale;
    return {
      index,
      category,
      x: px,
      y: py,
      w: (x1 - x0) * scale,
      h: (HIT_Z1 - HIT_Z0) * scale,
      cx: origin.x + ((x0 + x1) / 2) * scale,
      cy: origin.z + ((HIT_Z0 + HIT_Z1) / 2) * scale,
      hole
    };
  });
  const wheels = [];
  for (const axle of mesh.axles) {
    for (const side of [-1, 1]) {
      wheels.push({ x: axle, y: mesh.wheelDiameter / 2, z: side * mesh.axleZ });
    }
  }
  const foot = {
    x: origin.x - length / 2,
    y: origin.z - depth / 2,
    w: length,
    h: depth
  };
  return {
    origin,
    scale,
    length,
    depth,
    bins,
    wheels,
    foot,
    wheelDiameter: mesh.wheelDiameter,
    wheelRadiusPx: (mesh.wheelDiameter * scale) / 2,
    parkX: width / 2
  };
}
