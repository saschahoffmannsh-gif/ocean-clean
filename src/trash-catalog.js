// Müll-Sprites (assets/trash/<kategorie>-<name>.png, 256 px @2x), strikte Draufsicht.
// v3: genau 4 Sortier-Kategorien à 6 Items (asset-sources/trash/metadata.json).
// radius: Größe für die Physik, look: Darstellungsgröße (lange Seite, realistische Verhältnisse),
// mass: Trägheit, float: wie hoch das Teil im Wasser liegt (1 = obenauf).
export const CATEGORIES=Object.freeze(['plastik','metall','glas','rest']);
export const CATEGORY_LABELS=Object.freeze({plastik:'Plastik',metall:'Metall',glas:'Glas',rest:'Restmüll'});
export const TRASH=Object.freeze([
 ['plastik','pet-flasche',0.95,0.6,0.9,0.95],['plastik','tuete',1.0,0.25,0.55,1.1],['plastik','becher',0.8,0.35,0.8,0.62],['plastik','kanister',1.05,0.9,0.95,1.05],['plastik','waschmittelflasche',0.95,0.75,0.9,1.0],['plastik','sixpack-ring',0.85,0.2,0.6,0.75],
 ['metall','kronkorken',0.42,0.15,0.6,0.4],['metall','dose',0.75,0.5,0.8,0.68],['metall','konservendose',0.8,0.7,0.65,0.62],['metall','spraydose',0.85,0.6,0.8,0.8],['metall','alu-schale',0.9,0.2,0.9,0.9],['metall','fischdose',0.75,0.5,0.75,0.7],
 ['glas','gruene-flasche',1.0,0.9,0.7,1.0],['glas','schraubglas',0.82,0.85,0.65,0.68],['glas','bierflasche',1.0,0.9,0.7,1.0],['glas','flaschenpost',0.95,0.8,0.75,0.95],['glas','parfuemflakon',0.7,0.6,0.65,0.58],['glas','medizinflasche',0.7,0.6,0.65,0.58],
 ['rest','badelatsche',0.85,0.45,0.95,0.9],['rest','reifen',1.1,1.2,0.7,1.25],['rest','fischernetz',1.1,0.8,0.5,1.2],['rest','handschuh',0.8,0.3,0.7,0.9],['rest','maske',0.85,0.15,0.6,0.85],['rest','windel',1.0,0.6,0.6,1.0]
].map(([category,name,radius,mass,float,look])=>Object.freeze({category,name,radius,mass,float,look,src:`./assets/trash/${category}-${name}.png?v=20261105-spin1`})));
// Spawn-Reihenfolge: Kategorien reihum (je Runde gemischt), innerhalb der Kategorie ohne Wiederholung
// bis alle 6 dran waren → alle 4 Kategorien kommen gleich oft vor (±1).
export function balancedOrder(n,rand=Math.random){
 const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 const bags={},out=[];
 while(out.length<n){for(const c of shuffle([...CATEGORIES])){if(out.length>=n)break;
  if(!bags[c]?.length)bags[c]=shuffle(TRASH.map((t,i)=>i).filter(i=>TRASH[i].category===c));out.push(bags[c].pop());}}
 return out;
}
