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
  weicher Schatten nach unten rechts, heller Benetzungsrand, sparsame Mini-Ripples.
- Wischen = EINE begrenzte Bugwelle (`src/swipe-input.js`): pro Fingerabschnitt ein schmales Druck/Sog-Paar direkt am Finger
  statt einer Kette aus Kreiswellen. Die eigenen Wisch-/Tipp-Tropfen von ocean.js werden per `tuneWater()` abgefangen (Core unverändert),
  die Hintergrundwellen bleiben.
- `src/swipe-flow.js`: lokales Wischströmungsfeld – Kapsel (Gauß, Radius 42 px, harte Grenze ~100 px) um die Fingerspur, klingt in ~0,5–1,1 s ab,
  trägt Teile in Wischrichtung plus leicht seitlich weg. Antippen = kleiner lokaler Schubs. Teile weit weg von der Spur bleiben ruhig.
- Alle Stellschrauben: `src/config.js` (`wake`, `flow`, `drift`, `float`). Test-Multiplikator: `?force=0..2` (z. B. `?force=0.5`).
- Physik mit fester Schrittweite (1/120 s), gleiches Verhalten bei 30/60/120 fps (`tests/trash.test.mjs`: Teile >150 px von der Spur bewegen sich < 3 px).
- `src/trash-physics.js`: Teile folgen der lokalen Wischströmung (Trägheit, Wasserwiderstand, Drehung, weiche Abstoßung, weicher Rand).
  Dünung und Restwellen lassen sie nur wippen/kippen (Original-`stepBuoyancy`, Hub ≤ 2,5 px), aber nicht wandern.
- Kein direktes Ziehen: Der Finger bewegt nur das Wasser.

## Vollbild / Web-App

- `viewport-fit=cover`: Wasser und Müll-Canvas füllen das ganze Display (hinter Notch/Dynamic Island und Home-Indicator),
  `position:fixed`, Höhe `100lvh` (Fallbacks `100vh`, `-webkit-fill-available`). Die 620-px-Spalte aus `ocean.css` wird nur in `styles.css` überschrieben.
- Unterer Rand robust: Das Wasser ist absichtlich höher als jede mögliche Viewport-Höhe
  (`max(100vh,100lvh,--play-h) + Safe-Areas + 80px`) und ragt unten über den Bildschirm. Spielfeld (Rand der Teile), Impressum
  und Fehlermeldung richten sich nach `--play-h` (sichtbare Höhe; in der iOS-Home-Bildschirm-App die echte Bildschirmhöhe).
- Version unten neben Impressum (`v2026.11.04-3`), Diagnose-Overlay mit `?debug=1` (`src/debug.js`).
- Logo und Impressum/Datenschutz rücken per `env(safe-area-inset-*)` (und ggf. Browserleiste: `100lvh − 100dvh`) ein.
- Drehen / Leistenwechsel: `app.js` misst bei `resize`, `orientationchange` und `visualViewport.resize` neu.
- `manifest.webmanifest` (display `fullscreen`), Icons in `assets/icons/` (192, 512, maskable 512, apple-touch-icon 180).
  iPhone: Safari → Teilen → „Zum Home-Bildschirm“ → randlos ohne Adressleiste.
