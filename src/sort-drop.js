// Sortieren nur im Moment des Loslassens. Kein Sog, kein Nachziehen, kein Einsammeln,
// solange der Finger das Teil noch trägt oder es nur neben einer Mulde liegen bleibt.

export function binAt(x, y, bins) {
  if (!bins?.length) return null;
  for (const bin of bins) {
    if (x >= bin.x && x <= bin.x + bin.w && y >= bin.y && y <= bin.y + bin.h) return bin;
  }
  return null;
}

function inRect(x, y, rect) {
  return !!rect && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

// Passende Mulde: eingesammelt. Falsche Mulde oder Karosserie: zurück zum Wasser.
// Daneben auf Sand oder Meer: liegen bleiben.
export function releaseItem(body, bins, foot) {
  const bin = binAt(body.x, body.y, bins);
  if (bin && body.kind?.category === bin.category) {
    body.collected = true;
    body.vx = 0;
    body.vy = 0;
    body.vz = 0;
    return { type: 'collect', category: bin.category, index: bin.index };
  }
  if (bin || inRect(body.x, body.y, foot)) {
    const side = Math.sign(body.x - (bin?.cx ?? (foot.x + foot.w / 2))) || 1;
    body.collected = false;
    // Das Meer liegt unter dem Strand. Zurück ins Wasser, nicht auf die Kabine.
    body.y = foot.y + foot.h + 34;
    body.x = Math.min(foot.x + foot.w - 28, Math.max(foot.x + 28, body.x + side * 22));
    body.vy = 210;
    body.vx = side * 36;
    body.z = 16;
    body.vz = -20;
    body.glide = 0.45;
    return { type: 'reject', category: bin?.category ?? null, index: bin?.index ?? -1, item: body.kind?.category };
  }
  return { type: 'place' };
}
