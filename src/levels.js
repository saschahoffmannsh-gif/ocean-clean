// Zehn Strände. Jeder legt andere Teile aufs Wasser. Der Spieler sortiert sie
// selbst in den Wagen. Kein Paare-Suchen.
import { createPileBody } from './pile.js?v=20261106-v9';

const RAW = [
  [1, 11, [
    ['plastik', 'pet-flasche', .20, .22],
    ['metall', 'dose', .78, .20],
    ['glas', 'gruene-flasche', .30, .68],
    ['rest', 'badelatsche', .72, .66]
  ]],
  [2, 23, [
    ['plastik', 'tuete', .18, .30],
    ['plastik', 'becher', .50, .16],
    ['metall', 'kronkorken', .82, .32],
    ['glas', 'bierflasche', .26, .74],
    ['glas', 'schraubglas', .62, .56],
    ['rest', 'maske', .84, .76]
  ]],
  [3, 37, [
    ['plastik', 'kanister', .24, .46],
    ['metall', 'konservendose', .72, .18],
    ['metall', 'spraydose', .42, .20],
    ['glas', 'flaschenpost', .16, .76],
    ['rest', 'reifen', .78, .60],
    ['rest', 'handschuh', .48, .72]
  ]],
  [4, 41, [
    ['plastik', 'waschmittelflasche', .16, .18],
    ['plastik', 'sixpack-ring', .42, .34],
    ['metall', 'alu-schale', .68, .16],
    ['metall', 'fischdose', .88, .38],
    ['glas', 'parfuemflakon', .20, .64],
    ['glas', 'medizinflasche', .50, .80],
    ['rest', 'fischernetz', .74, .66],
    ['rest', 'windel', .90, .82]
  ]],
  [5, 59, [
    ['plastik', 'pet-flasche', .28, .14],
    ['plastik', 'tuete', .58, .28],
    ['metall', 'dose', .84, .16],
    ['metall', 'kronkorken', .14, .46],
    ['glas', 'gruene-flasche', .44, .50],
    ['glas', 'bierflasche', .72, .56],
    ['rest', 'badelatsche', .24, .80],
    ['rest', 'maske', .86, .78]
  ]],
  [6, 67, [
    ['plastik', 'pet-flasche', .14, .18],
    ['metall', 'dose', .36, .20],
    ['glas', 'gruene-flasche', .58, .14],
    ['rest', 'badelatsche', .82, .24],
    ['plastik', 'kanister', .22, .46],
    ['metall', 'spraydose', .48, .40],
    ['glas', 'schraubglas', .74, .48],
    ['rest', 'reifen', .16, .76],
    ['plastik', 'tuete', .46, .74],
    ['metall', 'konservendose', .80, .78]
  ]],
  [7, 73, [
    ['plastik', 'becher', .16, .24],
    ['metall', 'fischdose', .42, .14],
    ['glas', 'flaschenpost', .66, .26],
    ['rest', 'handschuh', .88, .16],
    ['plastik', 'sixpack-ring', .28, .50],
    ['metall', 'alu-schale', .54, .44],
    ['glas', 'parfuemflakon', .78, .52],
    ['rest', 'windel', .16, .80],
    ['glas', 'medizinflasche', .48, .78],
    ['plastik', 'waschmittelflasche', .82, .74]
  ]],
  [8, 89, [
    ['plastik', 'pet-flasche', .16, .16],
    ['metall', 'dose', .38, .14],
    ['glas', 'bierflasche', .62, .18],
    ['rest', 'maske', .86, .16],
    ['rest', 'fischernetz', .16, .48],
    ['plastik', 'tuete', .40, .42],
    ['metall', 'kronkorken', .64, .50],
    ['glas', 'gruene-flasche', .88, .46],
    ['glas', 'schraubglas', .14, .78],
    ['rest', 'badelatsche', .40, .76],
    ['plastik', 'kanister', .64, .74],
    ['metall', 'spraydose', .86, .80]
  ]],
  [9, 97, [
    ['metall', 'konservendose', .22, .14],
    ['plastik', 'becher', .48, .20],
    ['glas', 'flaschenpost', .74, .14],
    ['rest', 'reifen', .90, .36],
    ['glas', 'parfuemflakon', .12, .42],
    ['rest', 'handschuh', .36, .48],
    ['plastik', 'sixpack-ring', .58, .40],
    ['metall', 'alu-schale', .84, .52],
    ['plastik', 'waschmittelflasche', .18, .72],
    ['metall', 'fischdose', .42, .82],
    ['rest', 'windel', .66, .74],
    ['glas', 'medizinflasche', .88, .84]
  ]],
  [10, 101, [
    ['plastik', 'pet-flasche', .12, .14],
    ['metall', 'dose', .32, .12],
    ['glas', 'gruene-flasche', .52, .16],
    ['rest', 'badelatsche', .72, .12],
    ['plastik', 'tuete', .90, .28],
    ['metall', 'spraydose', .16, .40],
    ['glas', 'bierflasche', .36, .44],
    ['rest', 'maske', .58, .38],
    ['plastik', 'kanister', .78, .46],
    ['metall', 'kronkorken', .92, .60],
    ['glas', 'schraubglas', .14, .68],
    ['rest', 'handschuh', .36, .76],
    ['plastik', 'becher', .58, .78],
    ['glas', 'flaschenpost', .80, .74]
  ]]
];

export const LEVELS = Object.freeze(RAW.map(([id, seed, items]) => Object.freeze({
  id,
  seed,
  items: Object.freeze(items.map(([category, name, nx, ny]) => Object.freeze({ category, name, nx, ny })))
})));

export function levelByIndex(index) {
  const n = LEVELS.length;
  const i = ((index % n) + n) % n;
  return LEVELS[i];
}

export function spawnLevel(level, rect, kinds, rand, radiusScale = 1) {
  const bodies = [];
  for (const item of level.items) {
    const kind = kinds.find((k) => k.category === item.category && k.name === item.name);
    if (!kind) throw new Error('Unbekanntes Teil: ' + item.category + ':' + item.name);
    const body = createPileBody(kind, rect.x + item.nx * rect.w, rect.y + item.ny * rect.h, 0, rand, radiusScale);
    body.z = 0;
    bodies.push(body);
  }
  return bodies;
}
