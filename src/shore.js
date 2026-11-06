// Ufer oben. y wächst nach unten: Strand im oberen Drittel, Meer darunter.
// Die Wellen mitteln sich heraus, der Saum bleibt bei BEACH.
export const BEACH = 0.37;

export function shoreY(x, width, playH) {
  const t = width > 0 ? x / width : 0;
  const s = playH / 844;
  const wave = Math.sin(t * Math.PI * 2) * 16 * s
    + Math.sin(t * Math.PI * 4.4 + 0.7) * 9 * s
    + Math.sin(t * Math.PI * 9.1 + 0.2) * 3.5 * s;
  return playH * BEACH + wave;
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

// Teile treiben unter dem Schaum, nicht auf dem Sand.
export function waterRect(width, playH) {
  const shore = shoreRange(width, playH);
  const top = shore.max + 36;
  const bottom = playH - 20;
  return {
    x: 18,
    y: top,
    w: Math.max(40, width - 36),
    h: Math.max(48, bottom - top),
    shore
  };
}
