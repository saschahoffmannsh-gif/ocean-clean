# Ocean Clean – Original-Meer

## Strömung ohne Schatten (v2026.11.06-8)

Keine Schatten unter den Teilen. Ohne Berührung liegt das Wasser still: keine Dünung und keine Hintergrundwelle. Auf offenem Wasser treiben freie Teile mit der Strömung, drehen sich darin und stoßen Nachbarn an; danach gleiten sie kurz aus und bleiben liegen. Auf einem Gegenstand hebt der Finger ihn an.

## Finger genau auf dem Gegenstand (v2026.11.06-7)

Der Treffer und das gehaltene Teil sitzen auf dem Finger, ohne Versatz nach oben.

## Aufheben und fallen lassen (v2026.11.06-6)

Der Finger hebt den obersten Gegenstand unter sich an und trägt ihn. Loslassen lässt ihn dort fallen. Er bleibt liegen, auf dem Wasser oder auf anderen Teilen. Kein Wühlen mehr durch den Teppich.

## Originalnetze, Draco (v2026.11.06-5)

Die 24 Teile sind die ursprünglichen hochauflösenden Tripo-Netze mit den originalen UVs und dem Atlas. Nur Draco-komprimiert, sonst unverändert. Kamera bleibt die senkrechte Draufsicht. `water-13.0.0/` bleibt bytegleich.

## Gemalte Draufsicht (v2026.11.06-4)

Dieselben 24 flachen GLBs, senkrecht von oben. Jedes Teil trägt nur sein eigenes gemaltes Bild (PNG, Alpha-Maske), nicht mehr den gemeinsamen Tripo-Atlas. `water-13.0.0/` bleibt bytegleich.

## Draufsicht auf die GLBs (v2026.11.06-3)

Genau 24 Müllmodelle aus `assets/items3d/*.glb`, dichter als zuvor (etwa 6k–14k Dreiecke), beidseitig, Gesicht nach oben. Die Kamera schaut senkrecht aufs Wasser, ohne Schrägsicht. Teppich über die ganze Fläche, in Lagen, nichts darunter. Berührung schiebt. Abgelegt bleibt liegen. Keine Säcke. `water-13.0.0/` bleibt bytegleich.

## Texturierte GLB-Teile (v2026.11.06-2)

Erste GLB-Fassung. Die Schrägsicht zeigte die dünnen Kanten der Reliefs; das ist in v2026.11.06-3 die senkrechte Draufsicht.

## Wühlen im Teppich (v2026.11.06-1)

Zwanzig erkennbare Müllteile (Plastik, Glas, Gummi, Metall, Restmüll) lagen als Teppich über die ganze Wasserfläche. Diese Verfahrensnetze sind in v2026.11.06-2 durch die GLBs ersetzt.

## Bisher

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
- Alle Stellschrauben: `src/config.js` (`wake`, `flow`, `drift`, `float`). Test-Multiplikatoren: `?force=0..2` (z. B. `?force=0.5`) für die Strömung, `?spin=0..2` nur für die Drehung der Items.
- Physik mit fester Schrittweite (1/120 s), gleiches Verhalten bei 30/60/120 fps (`tests/trash.test.mjs`: Teile >150 px von der Spur bewegen sich < 3 px).
- `src/trash-physics.js`: Teile folgen der lokalen Wischströmung (Trägheit, Wasserwiderstand, Drehung, weiche Abstoßung, weicher Rand).
  Dünung und Restwellen lassen sie nur wippen/kippen (Original-`stepBuoyancy`, Hub ≤ 2,5 px), aber nicht wandern.
- Kein direktes Ziehen: Der Finger bewegt nur das Wasser.

## 4 Sortier-Kategorien (v2026.11.04-7)
- Genau 24 Items, je 6 pro Kategorie (`CATEGORIES`, `CATEGORY_LABELS` in `src/trash-catalog.js`),
  Dateinamen `assets/trash/<plastik|metall|glas|rest>-<name>.png`:
  - Plastik: PET-Flasche, Tüte, Becher, Kanister, Waschmittelflasche, Sixpack-Ring
  - Metall: Kronkorken, Getränkedose, Konservendose, Spraydose, Alu-Schale (neu), Fischdose (neu)
  - Glas: grüne Flasche, Schraubglas (neu, liegend), braune Bierflasche, Flaschenpost, Parfümflakon, Medizinfläschchen (neu)
  - Restmüll: Badelatsche, Reifen, Fischernetz, Gummihandschuh, Einwegmaske (neu), Windel (neu)
- Entfernt (Grenzfälle) → `asset-sources/trash/unused/`: Strohhalm, Wasserball, Zahnbürste, Styropor-Box, Karton,
  Zeitung, Pappbecher, Boje, altes Schraubglas (Metalldeckel dominierte).
- Spawn: `balancedOrder()` – Kategorien reihum, alle 4 gleich oft (±1). Sortiert wird in den vier Säcken unten (v2026.11.05-8).
- Kontaktbogen `screenshots/trash-contact-v3.png`, Spielansicht `screenshots/categories-ingame.png`.

## Müll-Items v2: strikte Draufsicht (v2026.11.04-7)
- Alle 24 Sprites neu (gleiche Dateinamen in `assets/trash/`), orthografisch senkrecht von oben, flach treibend,
  Licht oben links, keine eingebauten Schatten. Prompts, Zuordnung und abgelehnte Zellen in
  `asset-sources/trash/metadata.json`, Bildbögen in `asset-sources/trash/sheets/`, Freistellen mit
  `process_trash.py`, Kontaktbogen `contact_sheet.py` → `screenshots/trash-contact-v2.png`. v1 archiviert in
  `asset-sources/trash/v1/`.
- Renderer: `look` je Item (realistische relative Größen, nur Darstellung), freie 360°-Drehung, Schatten aus der
  Silhouette. Physik (`radius`, `mass`, `float`) unverändert.

## Sortieren in vier Säcken (v2026.11.05-8)
Unten am Bildschirm liegen vier flache Müllsäcke in strikter Draufsicht, Öffnung jeweils nach oben zum Meer. Sie bleiben eine schmale Leiste (höchstens 64 px) und lassen das Meer frei. Kein Schiff, keine Förderbänder, keine Tiere. Die Fassung v2026.11.05-7 (Bootsheck) ist ersetzt. `water-13.0.0/` bleibt bytegleich.

Von links nach rechts, Kategorien aus `src/trash-catalog.js`:

| Sack | Kategorie | Farbe |
| --- | --- | --- |
| Plastik | `plastik` | gelb |
| Metall | `metall` | blau-grau |
| Glas | `glas` | grün |
| Restmüll | `rest` | dunkelgrau / schwarz |

Regel (`src/sort-bags.js`, geprüft an der Öffnung):

- Es zählt die **Mitte** des Teils, nicht der Rand. Nur die Öffnung nimmt etwas an, der Sackkörper daneben ist eine Kante.
- Mitte in der **passenden** Öffnung (Lippe überschritten): das Teil wird eingesammelt. Es dreht und schaukelt noch mit, schrumpft in das Loch, der Sack knittert einmal. Danach ist es weg.
- Mitte in einer **falschen** Öffnung: es geht nicht hinein. Der Sack stößt es nach oben aus dem Feld (Rückstoß, etwas zur Seite). Es bleibt im Spiel. Dieser Sack saugt nicht nach, solange das Teil in seinem engen Feld bleibt (mindestens 0,55 s). Ein anderer, passender Sack gilt sofort.
- Leichter Sog nur im Rechteck direkt vor der Öffnung (22 px hoch, nicht breiter als die Öffnung, außerhalb exakt 0). Er hilft dem letzten Stück und ist für jedes Gewicht gleich. Weiter oben bleibt nur Wischen, Drehung und Schaukeln. Im Sogfeld kommt eine kleine Drehung aus dem Zug zur Mitte dazu. `?force` ändert diesen Sog nicht.

## Tiere wieder entfernt (v2026.11.05-6)
- Fische, Schildkröte und Quallen sind aus dem Spiel. Sprites und Bögen liegen unter `asset-sources/life/unused/`.
- Müll, Drehung, Schaukeln und Wasser bleiben.

## Unter Wasser, von oben (v2026.11.05-5)
- Seegras ist raus (`asset-sources/life/unused/`). Sardinen und Makrelen, die Schildkröte und die Quallen sind von oben.
- Sie liegen unter dem Müll und wirken unter der Oberfläche: durchscheinend, leicht unscharf, blau abgedunkelt, mit wandernden Lichtflecken. Kein Auflageschatten.
- Bewegung bleibt: Fische weichen dem Wisch aus, die Schildkröte ist langsam, Quallen pulsieren und treiben.

## Meeresleben (v2026.11.05-4)
- Erste Fassung mit Sardinen, Brassen, Makrelen, Schildkröte, Quallen und Seegras. Seitenansicht der Fische und Pflanzen wurden in v2026.11.05-5 ersetzt.

## Leichte Meeresunruhe (v2026.11.05-3)
- Ohne Wischen schaukeln die PNG-Items langsam: 7 px hoch/runter (alle 5 s) und 11 px hin/her (etwa alle 8 s),
  plus ±4,5 % Größe mit dem Hub. Eigene Phase je Teil (`sway` in `src/config.js`). Nur Darstellung, die Physik-Position bleibt.
- Das Meer selbst etwas lebhafter: Dünung 79 (vorher 72, Original 85), Hintergrundwellen-Faktor .86.

## Drehrichtung folgt dem Wisch (v2026.11.05-2)
- Das Vorzeichen kommt aus der Wischrichtung, nicht mehr aus einem festen `spinBias`.
  Rechtswischen und Linkswischen drehen entgegengesetzt; oberhalb und unterhalb der Spur ebenfalls.
  Betrag weiter über `drift.spin`, Ruhe-Drift und `?spin=0..2` wie in v2026.11.05-1.

## Drehung mit der Strömung (v2026.11.05-1)
- PNG-Items drehen sich um die Hochachse mit der lokalen Strömung (`drift.spin` .016 rad/s je px/s).
  Wischen und Sog stecken in derselben Geschwindigkeit: auf der Spur etwa eine viertel bis halbe Umdrehung beim Wisch,
  seitlich und weit weg nur die leichte Drift (`idleSpin` .07 rad/s). Deckel `maxSpin` 4.2 rad/s, Folgen mit `spinDrag` 2.4/s.
- `?spin=0..2` skaliert nur Drehgewinn, Ruhe-Drift und Deckel (1 = Standard). `?force` bleibt der Strömungs-Multiplikator.
- Feste Physik-Schritte: gleiche Drehung bei 30/60/120 fps, wenn die Strömung gleich ist.

## Sog beim Wischen (v2026.11.04-7)
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
- Version oben rechts neben Impressum (`v2026.11.06-1`), Diagnose-Overlay mit `?debug=1` (`src/debug.js`). Das Impressum sitzt unter dem Logo. In dieser Fassung gibt es keine Säcke.
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
