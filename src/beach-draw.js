// Flacher Sand unter dem Ufer. Kein Küstenpanorama, nur Farbe und Korn.
import { shoreY } from './shore.js?v=20261106-v9';

function mulberry(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function drawBeach(ctx, width, canvasH, playH) {
  const w = Math.max(1, width), h = Math.max(1, canvasH);
  ctx.clearRect(0, 0, w, h);
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, shoreY(0, w, playH));
  const steps = Math.max(12, Math.ceil(w / 16));
  for (let i = 1; i <= steps; i++) {
    const x = (w * i) / steps;
    ctx.lineTo(x, shoreY(x, w, playH));
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  const sand = ctx.createLinearGradient(0, playH * (2 / 3) - 20, 0, h);
  sand.addColorStop(0, '#f3e2b4');
  sand.addColorStop(0.08, '#e7c98a');
  sand.addColorStop(0.45, '#e4bc74');
  sand.addColorStop(1, '#d7ad62');
  ctx.fillStyle = sand;
  ctx.fill();

  ctx.save();
  ctx.clip();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#c99555';
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const x = (w * i) / steps;
    const y = shoreY(x, w, playH) + 10 + Math.sin(i * 0.7) * 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(0, shoreY(0, w, playH));
  for (let i = 1; i <= steps; i++) {
    const x = (w * i) / steps;
    ctx.lineTo(x, shoreY(x, w, playH));
  }
  ctx.strokeStyle = 'rgba(255,250,236,.85)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(120,168,170,.45)';
  ctx.lineWidth = 7;
  ctx.stroke();

  const rand = mulberry(19);
  const specks = Math.min(420, Math.round(w * (h - playH * 0.62) / 900));
  for (let i = 0; i < specks; i++) {
    const x = rand() * w;
    const y = shoreY(x, w, playH) + 8 + rand() * (h - shoreY(x, w, playH));
    ctx.globalAlpha = 0.15 + rand() * 0.25;
    ctx.fillStyle = rand() < 0.5 ? '#f8edd0' : '#c4964e';
    ctx.fillRect(x, y, rand() < 0.8 ? 1.4 : 2.2, 1.2);
  }
  ctx.globalAlpha = 1;
}
