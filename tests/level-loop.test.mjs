import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { CATEGORIES } from '../src/trash-catalog.js';
import { PILE_KINDS, advancePile } from '../src/pile.js';
import { shoreRange, shoreY, waterRect } from '../src/shore.js';
import { TRUCK_MESH, layoutTruck, wheelSpin } from '../src/truck-layout.js';
import { releaseItem } from '../src/sort-drop.js';
import { drivePose, isAdvanceSwipe } from '../src/drive.js';
import { LEVELS, levelByIndex, spawnLevel } from '../src/levels.js';
import { mulberry32 } from '../src/pile.js';
import { loadPropMeshes } from '../src/prop-mesh.js';
import { BASE_CONFIG } from '../src/config.js';

const phone = { w: 390, h: 844 };

test('the shore sits near two thirds so the beach is the bottom third', () => {
  const range = shoreRange(phone.w, phone.h);
  assert.ok(Math.abs(range.avg / phone.h - 2 / 3) < 0.03, range.avg);
  assert.ok(range.max - range.min < 48, 'Ufer zu wild');
  assert.ok(range.min > phone.h * 0.55);
  const water = waterRect(phone.w, phone.h);
  assert.ok(water.y + water.h < range.min, 'Teile müssen über dem Ufer liegen');
  assert.ok(shoreY(0, phone.w, phone.h) !== shoreY(phone.w * 0.25, phone.w, phone.h));
});

test('the truck is wider than half the screen and has four category bins', () => {
  const truck = layoutTruck(phone.w, phone.h);
  assert.ok(truck.length > phone.w * 0.5, truck.length);
  assert.equal(truck.bins.length, 4);
  assert.deepEqual(truck.bins.map((b) => b.category), [...CATEGORIES]);
  assert.equal(truck.wheels.length, 4);
  assert.equal(TRUCK_MESH.holes.length, 4);
  for (let i = 0; i < 3; i++) {
    const a = truck.bins[i], b = truck.bins[i + 1];
    assert.ok(a.x + a.w <= b.x + 0.6, 'Mulden überlappen');
    assert.ok(a.w > 36 && a.h > 36, 'Mulde zu klein ' + a.w + 'x' + a.h);
  }
  const top = Math.min(...truck.bins.map((b) => b.y));
  assert.ok(top > shoreRange(phone.w, phone.h).min - 8, 'Wagen liegt nicht auf dem Strand');
});

test('a drop collects only the matching bin and never by itself', () => {
  const truck = layoutTruck(phone.w, phone.h);
  const plastic = { kind: { category: 'plastik' }, x: truck.bins[0].cx, y: truck.bins[0].cy, z: 4, vx: 0, vy: 0, vz: 0 };
  const ok = releaseItem(plastic, truck.bins, truck.foot);
  assert.equal(ok.type, 'collect');
  assert.equal(plastic.collected, true);

  const glass = { kind: { category: 'glas' }, x: truck.bins[0].cx, y: truck.bins[0].cy, z: 4, vx: 0, vy: 0, vz: 0, spinBias: 1 };
  const before = glass.y;
  const bad = releaseItem(glass, truck.bins, truck.foot);
  assert.equal(bad.type, 'reject');
  assert.notEqual(glass.collected, true);
  assert.ok(glass.y < before - 8, 'nicht zurück zum Wasser');
  assert.ok(glass.vy < 0);

  const sea = { kind: { category: 'metall' }, x: 40, y: 120, z: 0, vx: 9, vy: 4, vz: 0 };
  assert.equal(releaseItem(sea, truck.bins, truck.foot).type, 'place');
  assert.notEqual(sea.collected, true);

  const resting = {
    kind: PILE_KINDS.find((k) => k.category === 'plastik'),
    x: truck.bins[0].cx, y: truck.bins[0].cy, z: 0,
    vx: 0, vy: 0, vz: 0, angle: 0, spin: 0, spinBias: 1, swayPhase: 0,
    held: false, radius: 16, halfLen: 8, tube: 12, stackH: 10, glide: 0
  };
  const sim = {};
  for (let i = 1; i <= 120; i++) {
    advancePile(sim, [resting], () => ({
      width: phone.w, height: phone.h, t: i / 60, flow: () => ({ vx: 0, vy: 0, weight: 0 })
    }), 1/60, i * 16.7, BASE_CONFIG.pile);
  }
  assert.notEqual(resting.collected, true, 'Physik saugt nicht in die Mulde');
});

test('clearing a level drives the truck left and the wheels roll with the distance', () => {
  assert.equal(isAdvanceSwipe(-90, 10), true);
  assert.equal(isAdvanceSwipe(-40, 10), false);
  assert.equal(isAdvanceSwipe(120, 0), false);
  assert.equal(isAdvanceSwipe(-100, 90), false);
  const truck = layoutTruck(phone.w, phone.h);
  const a = drivePose(0, truck.parkX, phone.w, truck.length);
  const mid = drivePose(0.5, truck.parkX, phone.w, truck.length);
  const back = drivePose(1, truck.parkX, phone.w, truck.length);
  assert.ok(Math.abs(a.truckX - truck.parkX) < 1e-6);
  assert.ok(mid.truckX < truck.parkX - phone.w * 0.3, 'fährt nicht nach links');
  assert.ok(Math.abs(back.truckX - truck.parkX) < 1e-6, 'kommt nicht zurück');
  assert.ok(back.distance > mid.distance && mid.distance > a.distance);
  let prev = -1;
  for (let i = 0; i <= 20; i++) {
    const pose = drivePose(i / 20, truck.parkX, phone.w, truck.length);
    assert.ok(pose.distance + 1e-6 >= prev, pose.distance + ' < ' + prev);
    prev = pose.distance;
  }
  assert.ok(Math.abs(wheelSpin(back.distance, truck.wheelRadiusPx) - back.distance / truck.wheelRadiusPx) < 1e-6);
  assert.ok(wheelSpin(back.distance, truck.wheelRadiusPx) > Math.PI, 'Räder drehen sich kaum');
});

test('ten beaches, each with its own trash, every category present', () => {
  assert.equal(LEVELS.length, 10);
  const seen = new Set();
  let previous = 0;
  for (const level of LEVELS) {
    assert.equal(levelByIndex(level.id - 1).id, level.id);
    assert.ok(level.items.length >= previous);
    previous = level.items.length;
    const cats = new Set(level.items.map((item) => item.category));
    for (const category of CATEGORIES) assert.ok(cats.has(category), level.id + ' ' + category);
    for (const item of level.items) {
      assert.ok(PILE_KINDS.some((k) => k.category === item.category && k.name === item.name), item.name);
      seen.add(item.category + ':' + item.name);
      assert.ok(item.nx > 0.05 && item.nx < 0.96 && item.ny > 0.05 && item.ny < 0.92);
    }
  }
  assert.ok(seen.size >= 16, 'zu wenig verschiedene Teile');
  const rect = waterRect(phone.w, phone.h);
  const bodies = spawnLevel(LEVELS[0], rect, PILE_KINDS, mulberry32(1), 1);
  assert.equal(bodies.length, 4);
  const shore = shoreRange(phone.w, phone.h);
  for (const body of bodies) {
    assert.ok(body.y < shore.min - 8, body.y);
    assert.equal(body.collected, undefined);
  }
  assert.equal(levelByIndex(10).id, 1);
});

test('truck and wheel glbs are web-sized and readable', async () => {
  const truckBytes = statSync(new URL('../assets/models/truck.glb', import.meta.url)).size;
  const wheelBytes = statSync(new URL('../assets/models/wheel.glb', import.meta.url)).size;
  assert.ok(truckBytes < 8_000_000, truckBytes);
  assert.ok(wheelBytes < 3_000_000, wheelBytes);
  assert.ok(truckBytes > 50_000 && wheelBytes > 20_000);
  const { truck, wheel } = await loadPropMeshes();
  assert.ok(truck.indices.length > 300 && truck.positions.length > 300);
  assert.ok(wheel.indices.length > 300);
  assert.equal(truck.images.base[0], 0xff);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const p = wheel.positions;
  for (let i = 0; i < p.length; i += 3) {
    minX = Math.min(minX, p[i]); maxX = Math.max(maxX, p[i]);
    minY = Math.min(minY, p[i + 1]); maxY = Math.max(maxY, p[i + 1]);
    minZ = Math.min(minZ, p[i + 2]); maxZ = Math.max(maxZ, p[i + 2]);
  }
  const diam = Math.max(maxX - minX, maxY - minY);
  assert.ok(Math.abs(diam - 1) < 0.08, 'Raddurchmesser ' + diam);
  assert.ok(Math.abs((minX + maxX) / 2) < 0.08 && Math.abs((minY + maxY) / 2) < 0.08, 'Rad nicht zentriert');
  assert.ok((maxZ - minZ) < diam, 'Achse sollte die kurze Seite sein');
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /v2026\.11\.06-9/);
  assert.match(readme, /Wisch/);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /2026\.11\.06-9/);
});
