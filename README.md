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
