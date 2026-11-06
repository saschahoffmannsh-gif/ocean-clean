// Illustrierter Strand OBEN, Schaum zum Meer hin. Kein Panorama, keine Posterfläche.
import { shoreY } from './shore.js?v=20261106-v10';

let plantsImg = null;
let plantsRev = 0;
export function setPlantsImage(img){ plantsImg = img; plantsRev++; }
export function plantsRevision(){ return plantsRev; }

function hash(ix, iy){
  let n = Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function lineShore(ctx, w, playH, steps, dy){
  ctx.moveTo(0, shoreY(0, w, playH) + (dy ? dy(0, 0) : 0));
  for (let i = 1; i <= steps; i++){
    const x = (w * i) / steps;
    ctx.lineTo(x, shoreY(x, w, playH) + (dy ? dy(x, i) : 0));
  }
}

export function drawBeach(ctx, width, canvasH, playH){
  const w = Math.max(1, width), h = Math.max(1, canvasH);
  const steps = Math.max(72, Math.ceil(w / 4));
  ctx.clearRect(0, 0, w, h);

  ctx.save();
  ctx.beginPath();
  lineShore(ctx, w, playH, steps);
  ctx.lineTo(w + 4, -4);
  ctx.lineTo(-4, -4);
  ctx.closePath();
  ctx.clip();

  const sand = ctx.createLinearGradient(0, 0, 0, playH * 0.42);
  sand.addColorStop(0, '#f6d48a');
  sand.addColorStop(0.35, '#f3c56a');
  sand.addColorStop(0.72, '#efb85a');
  sand.addColorStop(1, '#e7c48a');
  ctx.fillStyle = sand;
  ctx.fillRect(0, 0, w, playH);

  // weiche Farbflecken, damit der Sand nicht eine Fläche ist
  for (let i = 0; i < 14; i++){
    const x = hash(i, 2) * w;
    const y = hash(i, 3) * playH * 0.34;
    const r = 40 + hash(i, 4) * 90;
    const g = ctx.createRadialGradient(x, y, 4, x, y, r);
    g.addColorStop(0, hash(i, 5) > 0.5 ? 'rgba(255, 236, 190, 0.45)' : 'rgba(214, 150, 70, 0.28)');
    g.addColorStop(1, 'rgba(255, 220, 150, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7);
    ctx.fill();
  }

  // Dünenlinien wie in einer gezeichneten Küste
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 11; i++){
    const y0 = 18 + i * (playH * 0.032);
    ctx.beginPath();
    for (let x = 0; x <= w; x += 6){
      const y = y0 + Math.sin(x * 0.012 + i * 0.9) * 5 + Math.sin(x * 0.031 + i) * 2.2;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(176, 120, 52, ${0.055 + (i % 3) * 0.02})`;
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  ctx.restore();

  // nasser Saum direkt über dem Schaum
  ctx.beginPath();
  lineShore(ctx, w, playH, steps, () => -36);
  for (let i = steps; i >= 0; i--){
    const x = (w * i) / steps;
    ctx.lineTo(x, shoreY(x, w, playH) + 2);
  }
  ctx.closePath();
  const wet = ctx.createLinearGradient(0, playH * 0.28, 0, playH * 0.4);
  wet.addColorStop(0, 'rgba(232, 186, 110, 0)');
  wet.addColorStop(0.45, 'rgba(214, 164, 96, 0.35)');
  wet.addColorStop(1, 'rgba(186, 140, 78, 0.55)');
  ctx.fillStyle = wet;
  ctx.fill();

  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = 'rgba(255, 248, 230, 0.7)';
  ctx.lineWidth = 1.15;
  for (let k = 0; k < 5; k++){
    ctx.beginPath();
    lineShore(ctx, w, playH, steps, (x, i) => -8 - k * 5 + Math.sin((i || 0) * 0.5 + k) * 1.4);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // feines Korn
  const grains = Math.min(2200, Math.round(w * playH * 0.34 / 80));
  for (let i = 0; i < grains; i++){
    const gx = hash(i, 7) * w;
    const gy = hash(i, 8) * shoreY(gx, w, playH);
    ctx.globalAlpha = 0.12 + hash(i, 9) * 0.28;
    ctx.fillStyle = hash(i, 10) > 0.62 ? '#fff3d2' : (hash(i, 11) < 0.3 ? '#c48a45' : '#f0cc8e');
    const s = hash(i, 12) < 0.8 ? 1.2 : 2.1;
    ctx.fillRect(gx, gy, s, s * 0.6);
  }
  ctx.globalAlpha = 1;

  drawPlants(ctx, w, playH);
  ctx.restore();

  drawFoam(ctx, w, playH, steps);
}

function drawFoam(ctx, w, playH, steps){
  // dicker Schaum auf dem Saum, läuft ins Wasser
  ctx.beginPath();
  lineShore(ctx, w, playH, steps, (x, i) => -18 - Math.max(0, Math.sin((i || 0) * 0.38) * 8 + Math.sin((i || 0) * 1.05) * 4));
  for (let i = steps; i >= 0; i--){
    const x = (w * i) / steps;
    const scallop = Math.sin(i * 0.55) * 8 + Math.sin(i * 1.35 + 0.4) * 5 + Math.sin(i * 2.6) * 2.4;
    ctx.lineTo(x, shoreY(x, w, playH) + 10 + Math.max(0, scallop));
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(0, playH * 0.3, 0, playH * 0.46);
  g.addColorStop(0, 'rgba(255,252,246,0.15)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.92)');
  g.addColorStop(0.7, 'rgba(255,255,252,0.72)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fill();

  ctx.beginPath();
  lineShore(ctx, w, playH, steps, (x, i) => Math.sin((i || 0) * 0.7) * 1.2);
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // zweite, dünnere Gischtlinie im Wasser
  ctx.beginPath();
  lineShore(ctx, w, playH, steps, (x, i) => 16 + Math.sin((i || 0) * 0.62 + 1) * 4);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#fff';
  for (let i = 0; i < steps; i += 2){
    const x = (w * (i + 0.2)) / steps;
    const y = shoreY(x, w, playH) + (hash(i, 20) - 0.2) * 14;
    const r = 1.8 + hash(i, 21) * 4.5;
    ctx.globalAlpha = 0.28 + hash(i, 22) * 0.55;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.35, r * 0.5, 0, 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPlants(ctx, w, playH){
  const spots = [
    [w * 0.04, playH * 0.06, 1],
    [w * 0.1, playH * 0.14, 0.85],
    [w * 0.02, playH * 0.2, 0.7],
    [w * 0.96, playH * 0.05, 1],
    [w * 0.9, playH * 0.15, 0.9],
    [w * 0.98, playH * 0.22, 0.65]
  ];
  for (const [x, y, sc] of spots) clump(ctx, x, y, sc, Math.floor(x + y));
  if (plantsImg && plantsImg.complete && plantsImg.naturalWidth){
    const s = Math.min(w * 0.28, playH * 0.22);
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.drawImage(plantsImg, -s * 0.15, -s * 0.05, s, s);
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(plantsImg, -s * 0.15, -s * 0.05, s, s);
    ctx.restore();
  }
}

function clump(ctx, x, y, sc, seed){
  const n = 7 + Math.floor(hash(seed, 1) * 5);
  for (let i = 0; i < n; i++){
    const a = (i / n) * Math.PI - Math.PI / 2 + (hash(seed + i, 2) - 0.5);
    const len = (16 + hash(seed + i, 3) * 22) * sc;
    const bx = x + Math.cos(a) * 3;
    const by = y + 6;
    ctx.strokeStyle = hash(seed + i, 4) > 0.4 ? '#7eaf45' : '#c6b15a';
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 1.6 * sc;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + Math.cos(a) * len * 0.5, by - len * 0.7, bx + Math.cos(a) * len, by - len);
    ctx.stroke();
  }
  const flowers = 2 + Math.floor(hash(seed, 5) * 3);
  for (let i = 0; i < flowers; i++){
    const fx = x + (hash(seed + i, 6) - 0.5) * 28 * sc;
    const fy = y + (hash(seed + i, 7) - 0.2) * 18 * sc;
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = hash(seed + i, 8) > 0.5 ? '#f27b9b' : '#ff8a5b';
    for (let p = 0; p < 5; p++){
      const ang = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(fx + Math.cos(ang) * 3.2 * sc, fy + Math.sin(ang) * 3.2 * sc, 2.4 * sc, 1.6 * sc, ang, 0, 7);
      ctx.fill();
    }
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath();
    ctx.arc(fx, fy, 1.7 * sc, 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawTruckShadow(ctx, foot){
  if (!foot) return;
  const cx = foot.x + foot.w / 2;
  const cy = foot.y + foot.h * 0.62;
  const rx = foot.w * 0.46;
  const ry = Math.max(16, foot.h * 0.34);
  const g = ctx.createRadialGradient(cx, cy - ry * 0.2, rx * 0.12, cx, cy, rx);
  g.addColorStop(0, 'rgba(120, 78, 28, 0.28)');
  g.addColorStop(0.6, 'rgba(120, 78, 28, 0.1)');
  g.addColorStop(1, 'rgba(120, 78, 28, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, 7);
  ctx.fill();
}
