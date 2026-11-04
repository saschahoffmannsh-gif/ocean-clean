# Ocean Clean – Wasseroberfläche (Prototyp)

Offenes Meer von oben, ohne Küste. Darauf ein **unsichtbares 6×6-Logikraster**
(`grid.js`), das die freie Meeresfläche zwischen Kopfzeile und späterer
Steuerleiste ausfüllt. Vier Platzhalter (Kiste, Flasche, Dose, Reifen) schwimmen
auf Rasterfeldern und zeigen den Auftrieb.

Starten (kein Build-Schritt):

```sh
cd ocean-clean && python3 -m http.server 8000   # dann http://localhost:8000
```

URL-Optionen: `?grid=1` zeigt das Raster zum Entwickeln (Taste **G** schaltet um),
`?swell=0…100` Wellengang (Standard 32), `?light=0…100` Licht (65), `?quality=eco|high`.
Antippen des Wassers erzeugt eine Welle, Objekte in der Nähe reagieren.

## Dateien
- `water.js` – WebGL2-Shader (übernommen aus Ocean Merge, Küste entfernt) + 2D-Fallback
- `buoyancy.js` – Auftrieb/Wippen/Kippen (aus Ocean Merge, ohne Brandung, plus Hochsee-Dünung)
- `camera.js` – Weltmaßstab und langsames Treiben über das Meer
- `grid.js` – unsichtbares 6×6-Raster: `gridGeometry`, `cellCenter`, `cellAt`
- `app.js` – Schleife, Platzhalter, Eingaben; `window.oceanClean.splash(x,y,power)` für spätere Merges
- `assets/open-sea-floor.png` – nahtlos kachelbarer Meeresgrund, aus dem Tiefwasserbereich von `coast-no-tent-v4.png` erzeugt

## Veröffentlichung
GitHub Pages aus `main` (Root), `.nojekyll`. Keine externen Verbindungen (Schriften = Systemschriften).
Impressum/Datenschutz: `impressum.html`, `datenschutz.html`, dezent unten rechts verlinkt.
