// Müll-Sprites (assets/trash/<kategorie>-<name>.png, 256 px @2x).
// v2: strikte Draufsicht (asset-sources/trash/metadata.json).
// radius: Größe für die Physik, look: Darstellungsgröße (lange Seite, realistische Verhältnisse), mass: Trägheit, float: wie hoch das Teil im Wasser liegt (1 = obenauf).
// Kategorien bleiben im Dateinamen erhalten – für ein späteres Sortieren.
export const TRASH=Object.freeze([
 ['plastik','pet-flasche',.95,.6,.9,0.95],['plastik','tuete',1.0,.25,.55,1.1],['plastik','becher',.8,.35,.8,0.62],
 ['plastik','strohhalm',.7,.15,.9,0.8],['plastik','sixpack-ring',.85,.2,.6,0.75],['plastik','kanister',1.05,.9,.95,1.05],
 ['plastik','wasserball',.9,.25,1,1.0],['plastik','waschmittelflasche',.95,.75,.9,1.0],['plastik','styropor-box',.95,.3,1,0.9],
 ['plastik','zahnbuerste',.7,.15,.85,0.75],
 ['metall','dose',.75,.5,.8,0.68],['metall','konservendose',.8,.7,.65,0.62],['metall','spraydose',.85,.6,.8,0.8],['metall','kronkorken',.42,.15,.6,0.4],
 ['glas','flasche',1.0,.9,.7,1.0],['glas','glas',.82,.85,.65,0.58],
 ['papier','karton',1.05,.6,.6,1.1],['papier','zeitung',.95,.35,.5,1.05],['papier','pappbecher',.78,.35,.75,0.6],
 ['gummi','badelatsche',.85,.45,.95,0.9],['gummi','reifen',1.1,1.2,.7,1.25],['gummi','handschuh',.8,.3,.7,0.9],
 ['sonstiges','fischernetz',1.1,.8,.5,1.2],['sonstiges','boje',.85,.7,1,0.95]
].map(([category,name,radius,mass,float,look])=>Object.freeze({category,name,radius,mass,float,look,src:`./assets/trash/${category}-${name}.png?v=20261104-full6`})));
