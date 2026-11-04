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

## Müll-Items v2: strikte Draufsicht (v2026.11.04-6)
- Alle 24 Sprites neu (gleiche Dateinamen in `assets/trash/`), orthografisch senkrecht von oben, flach treibend,
  Licht oben links, keine eingebauten Schatten. Prompts, Zuordnung und abgelehnte Zellen in
  `asset-sources/trash/metadata.json`, Bildbögen in `asset-sources/trash/sheets/`, Freistellen mit
  `process_trash.py`, Kontaktbogen `contact_sheet.py` → `screenshots/trash-contact-v2.png`. v1 archiviert in
  `asset-sources/trash/v1/`.
- Renderer: `look` je Item (realistische relative Größen, nur Darstellung), freie 360°-Drehung, Schatten aus der
  Silhouette. Physik (`radius`, `mass`, `float`) unverändert.

## Sog beim Wischen (v2026.11.04-6)
- Enger Sog-Kern (Kielwasser) direkt unter der Fingerspur in `src/swipe-flow.js`, Parameter `flow.suction` in
  `src/config.js` (`radius` 30 px, `strength` .3, `inward` .15, `ahead` .35, `decay` .7 s; skaliert mit `?force`).
- Teile auf der Spur werden zusätzlich ~25–32 px in Wischrichtung mitgezogen und zur Spurmitte gehalten statt
  seitlich weggeschoben; ab 30 px Seitenabstand exakt wie vorher, Höchstgeschwindigkeit unverändert.

## Vollbild / Web-App

- `viewport-fit=cover`: Wasser und Müll-Canvas füllen das ganze Display (hinter Notch/Dynamic Island und Home-Indicator),
  `position:fixed`, Höhe `100lvh` (Fallbacks `100vh`, `-webkit-fill-available`). Die 620-px-Spalte aus `ocean.css` wird nur in `styles.css` überschrieben.
- Unterer Rand robust: Das Wasser ist absichtlich höher als jede mögliche Viewport-Höhe
  (`max(100vh,100lvh,--play-h) + Safe-Areas + 80px`) und ragt unten über den Bildschirm. Spielfeld (Rand der Teile), Impressum
  und Fehlermeldung richten sich nach `--play-h` (sichtbare Höhe; in der iOS-Home-Bildschirm-App die echte Bildschirmhöhe).
- Version unten neben Impressum (`v2026.11.04-6`), Diagnose-Overlay mit `?debug=1` (`src/debug.js`).
- v4 – iOS-26-Home-Bildschirm-Bug: In der Standalone-App (black-translucent + viewport-fit=cover) sind `innerHeight`,
  `100%`, `100dvh` um die Statusleiste zu kurz, nur `100vh`/`100lvh` stimmen. `html,body{height:100%;overflow:hidden}`
  aus ocean.css schnitt daher unten ab (Streifen). Fix in `styles.css`: in Standalone (`html.standalone` bzw.
  `display-mode`-Query) `html`/`body` auf `max(100vh,100lvh,--play-h)`. Belege:
  github.com/get-bb/bb/commit/2356aee352cc0e870f534e6c2a4696b2bb674266, github.com/GarrickZ2/grove/pull/20,
  github.com/openchamber/openchamber/issues/2287, github.com/anomalyco/opencode/pull/46703, WebKit-Bug 313800.
- Alternativen, falls der Streifen bleibt: (a) Manifest + `black-translucent` für iOS entfernen – kein Spalt mehr,
  aber undurchsichtige Statusleiste, Wasser reicht nicht mehr unter die Notch (github.com/agegr/pi-web/issues/598);
  (b) Gerät einmal drehen und zurück (temporär). Manifest-/Meta-Änderungen greifen erst nach Löschen und neu
  Hinzufügen des Home-Bildschirm-Icons.
- Logo und Impressum/Datenschutz rücken per `env(safe-area-inset-*)` (und ggf. Browserleiste: `100lvh − 100dvh`) ein.
- Drehen / Leistenwechsel: `app.js` misst bei `resize`, `orientationchange` und `visualViewport.resize` neu.
- `manifest.webmanifest` (display `fullscreen`), Icons in `assets/icons/` (192, 512, maskable 512, apple-touch-icon 180).
  iPhone: Safari → Teilen → „Zum Home-Bildschirm“ → randlos ohne Adressleiste.
