// Uferlinie im sichtbaren Spielfeld. y wächst nach unten.
// Im Mittel liegt das Ufer bei zwei Dritteln der Höhe: darüber Meer, darunter Strand.
export function shoreY(x, width, playH) {
  const t = width > 0 ? x / width : 0;
  const wave = Math.sin(t * Math.PI * 2) * 12 + Math.sin(t * Math.PI * 5.2 + 1.1) * 7;
  return playH * (2 / 3) + wave;
}

export function shoreRange(width, playH, steps = 32) {
  let min = Infinity, max = -Infinity, sum = 0;
  const n = Math.max(1, steps);
  for (let i = 0; i <= n; i++) {
    const y = shoreY((width * i) / n, width, playH);
    if (y < min) min = y;
    if (y > max) max = y;
    sum += y;
  }
  return { min, max, avg: sum / (n + 1) };
}

// Rechteck, in dem Teile auf dem Wasser liegen. Unter dem Ufer ist Sand.
export function waterRect(width, playH) {
  const shore = shoreRange(width, playH);
  const top = 78;
  const bottom = shore.min - 24;
  return {
    x: 16,
    y: top,
    w: Math.max(40, width - 32),
    h: Math.max(48, bottom - top),
    shore
  };
}
