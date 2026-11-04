// Zentrale Stellschrauben für Ocean Clean (Wasser-Eingabe und treibender Müll).
// Zum Testen: URL-Parameter ?force=0..2 multipliziert die Fingerkraft aufs Wasser
// UND die Kopplung Wasser→Müll (1 = Standard, 0 = keine Reaktion).
export const BASE_CONFIG=Object.freeze({
 water:Object.freeze({
  swell:72,          // Dünung (Original-Preset 85)
  light:65,
  input:.45,         // Faktor auf Druck-/Sog-Impulse von Wischen und Tippen (Original = 1)
  ambient:.85,       // Faktor auf die Hintergrund-Wellen des Meeres
  splash:.55,        // Faktor auf Stärke der Wischtropfen
  splashCount:.5     // Faktor auf Anzahl der Wischtropfen
 }),
 drift:Object.freeze({
  step:1/120,        // feste Physik-Schrittweite in s (bildratenunabhängig)
  maxSteps:10,       // höchstens so viele Schritte pro Bild (danach Zeit verwerfen)
  push:380,           // px/s² pro Pulsstärke auf einem Wellenring
  nearPush:4,        // Zusatz direkt am Finger
  nearRange:60,      // px
  range:150,         // px, wie weit ein Ring spürbar schiebt
  slope:3500,        // Hangabtrieb lokaler Wellen
  swell:3,           // Hangabtrieb der Dünung (aus roll/pitch in Grad)
  current:1.6,       // ruhige Grundströmung px/s²
  drag:2.6,          // 1/s Wasserwiderstand
  inertia:1.0,       // zusätzliche Trägheit (Masse + inertia)
  maxSpeed:75,       // px/s
  spin:.0025,        // wie stark Stöße das Teil drehen
  spinDrag:3.2,
  maxSpin:.5,        // rad/s
  repel:420,         // weiche gegenseitige Abstoßung
  edge:700           // weicher Rand
 }),
 float:Object.freeze({
  maxBob:2.5,        // px Hub höchstens (zusätzlich ≤ size*0.065)
  bob:.35,roll:.3,pitch:.35, // Darstellungsfaktoren auf stepBuoyancy
  waveTilt:220,      // Wellensteigung → Kippen (Original-Merge: 320)
  wake:Object.freeze({minSpeed:28,interval:420,amp:.012,radius:2.4,perSecond:2})
 })
});

const clampN=(n,a,b)=>Math.max(a,Math.min(b,n));
export function readForce(search=globalThis.location?.search||''){
 const v=parseFloat(new URLSearchParams(search).get('force'));
 return Number.isFinite(v)?clampN(v,0,2):1;
}
// Konfig mit ?force-Multiplikator auf Wasser-Eingabe und Kopplung.
export function makeConfig(force=readForce()){
 const b=BASE_CONFIG;
 return{force,water:{...b.water,input:b.water.input*force,splash:b.water.splash*Math.min(1,force||0)},
  drift:{...b.drift,push:b.drift.push*force,slope:b.drift.slope*force},float:b.float};
}
