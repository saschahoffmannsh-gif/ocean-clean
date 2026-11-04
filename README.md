# Ocean Clean – Original-Meer

Reines Original-Meer aus **Ocean Water 13.0.0** (Export aus Ocean Clean 13.0.0, Quellstand
`55e004ca58e798537a2d28e510d6ae932e2c5947`) mit Kopfzeile „ocean clean“ und Impressum/Datenschutz.

- `water-13.0.0/core/*` und `water-13.0.0/assets/coast-no-tent-v4.png`: bytegleiche Originalmodule
  (Prüfsummen in `SOURCE_MANIFEST.json`, geprüft von `npm test`).
- `water-13.0.0/ocean.js`, `ocean.css`, `ocean-audio.js`, `water-preset.json`: unveränderter Adapter aus dem Export.
- `app.js`: `OceanWater.create(#ocean, {settings:{swell:85,light:65,quality:'auto'}, gesture:'game', travel:0.10})`.
  Kein Einstellungsmenü, Meeresklang bleibt aus.

Der Ordnername `water-13.0.0/` dient zugleich als Cache-Busting für die Originalmodule
(diese bleiben bytegleich und erhalten daher keine `?v=`-Parameter). Bei neuer Wasserversion neuen Ordner anlegen.

Starten: `python3 -m http.server 8000` → http://localhost:8000 · Tests: `npm test` (Node 20+).
Veröffentlichung: GitHub Pages aus `main` (Root), `.nojekyll`. Keine externen Verbindungen.

## Müll auf dem Wasser (Schritt 1, ohne Sortieren)

- 24 gemalte Müll-Sprites in `assets/trash/<kategorie>-<name>.png` (Kategorien: plastik, metall, glas, papier, gummi, sonstiges – bleiben für ein späteres Sortieren im Dateinamen).
  Herkunft, Prompts und Freistellung: `asset-sources/trash/` (`metadata.json`, `process_trash.py`, `contact_sheet.py`, Original-Sheets).
- `src/trash-layer.js` zeichnet 26–38 frei treibende Teile in einen eigenen Canvas (`.trash-layer`) ÜBER dem Wasser und unter der Gischt:
  weicher Schatten nach unten rechts, heller Benetzungsrand, sparsame Mini-Ripples. `tuneWater()` dämpft die Fingerkraft über den Adapter (Core unverändert).
- Alle Stellschrauben: `src/config.js`. Test-Multiplikator: `?force=0..2` (z. B. `?force=0.5`).
- Physik mit fester Schrittweite (1/120 s), gleiches Verhalten bei 30/60/120 fps (`tests/trash.test.mjs`).
- `src/trash-physics.js`: Die Wellenringe des Meeres (`ocean.pulses`, gleiche Laufgeschwindigkeit/Breite wie im Shader) schieben Teile in Laufrichtung,
  Sog hinter dem Finger zieht an, dazu Hangabtrieb aus `sampleLocalWaves` und Dünung aus `sample`, Trägheit, Wasserwiderstand, Drehung, weiche Abstoßung, weicher Rand.
  Auftrieb über das Original-`stepBuoyancy` mit Ocean-Clean-Grenzen (Hub ≤ 3 px, Rollen ×0,35, Nicken ×0,4). Schnelle Teile stören das Wasser sparsam zurück (`ocean.disturb`).
- Kein direktes Ziehen: Der Finger bewegt nur das Wasser.
