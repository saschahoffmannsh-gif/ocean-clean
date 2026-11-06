// Nach dem leeren Strand: Wisch nach links. Der Wagen fährt am Ufer entlang
// aus dem Bild und kommt von der anderen Seite in den nächsten Abschnitt.
// Die zurückgelegte Strecke ist monoton, damit die Räder durchgehend rollen.

const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2);

export function isAdvanceSwipe(dx, dy) {
  return dx <= -72 && Math.abs(dx) > Math.abs(dy) * 1.12;
}

export function drivePose(u, parkX, viewW, truckLen) {
  const t = Math.max(0, Math.min(1, u || 0));
  const off = viewW * 0.42 + truckLen * 0.72;
  const leave = parkX - off;
  const enter = parkX + off;
  if (t <= 0.5) {
    const k = ease(t / 0.5);
    const truckX = parkX + (leave - parkX) * k;
    return { truckX, distance: parkX - truckX, arrive: false };
  }
  const k = ease((t - 0.5) / 0.5);
  const truckX = enter + (parkX - enter) * k;
  return { truckX, distance: (parkX - leave) + (enter - truckX), arrive: t >= 0.82 };
}
