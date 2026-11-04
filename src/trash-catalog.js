// Müll-Sprites (assets/trash/<kategorie>-<name>.png, 256 px @2x).
// radius: relative Größe, mass: Trägheit, float: wie hoch das Teil im Wasser liegt (1 = obenauf).
// Kategorien bleiben im Dateinamen erhalten – für ein späteres Sortieren.
export const TRASH=Object.freeze([
 ['plastik','pet-flasche',.95,.6,.9],['plastik','tuete',1.0,.25,.55],['plastik','becher',.8,.35,.8],
 ['plastik','strohhalm',.7,.15,.9],['plastik','sixpack-ring',.85,.2,.6],['plastik','kanister',1.05,.9,.95],
 ['plastik','wasserball',.9,.25,1],['plastik','waschmittelflasche',.95,.75,.9],['plastik','styropor-box',.95,.3,1],
 ['plastik','zahnbuerste',.7,.15,.85],
 ['metall','dose',.75,.5,.8],['metall','konservendose',.8,.7,.65],['metall','spraydose',.85,.6,.8],['metall','kronkorken',.42,.15,.6],
 ['glas','flasche',1.0,.9,.7],['glas','glas',.82,.85,.65],
 ['papier','karton',1.05,.6,.6],['papier','zeitung',.95,.35,.5],['papier','pappbecher',.78,.35,.75],
 ['gummi','badelatsche',.85,.45,.95],['gummi','reifen',1.1,1.2,.7],['gummi','handschuh',.8,.3,.7],
 ['sonstiges','fischernetz',1.1,.8,.5],['sonstiges','boje',.85,.7,1]
].map(([category,name,radius,mass,float])=>Object.freeze({category,name,radius,mass,float,src:`./assets/trash/${category}-${name}.png`})));
