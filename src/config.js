// Zentrale Stellschrauben für Ocean Clean (Wasser-Eingabe und treibender Müll).
// Zum Testen: URL-Parameter ?force=0..2 multipliziert die Fingerkraft aufs Wasser
// UND die Wischströmung, die den Müll mitnimmt (1 = Standard, 0 = keine Reaktion).
export const BASE_CONFIG=Object.freeze({
 water:Object.freeze({
  swell:72,          // Dünung (Original-Preset 85)
  light:65,
  ambient:.7         // Faktor auf die Hintergrund-Wellen des Meeres
 }),
 // Wischen: EINE begrenzte Bugwelle entlang der Spur statt vieler Kreiswellen.
 // Eingabe direkt in die Wellen-Simulation (surface.disturb): vorn Druck, dicht
 // dahinter Sog (Dipol) mit kleinem Radius – strahlt kaum Ringe ab.
 wake:Object.freeze({
  minStep:7,         // px Fingerweg pro Wellenabschnitt
  push:.075,         // Druck vor dem Finger (Höchstwert bei schnellem Wisch)
  pull:-.06,         // Sog dicht dahinter
  ahead:7,behind:7,  // px Abstand vor/hinter dem Finger
  radius:3.2,        // Radius in Simulations-Texeln (Original-motionWake 6.2)
  speedFull:900,     // px/s, ab hier volle Stärke
  tap:.07,tapRadius:3.5, // Antippen: ein kleiner Tropfen
  spray:.35,sprayCount:2,sprayChance:.25 // wenige, kleine Wischtropfen
 }),
 flow:Object.freeze({
  radius:42,         // px Gauß-Breite der Strömung um die Spur
  cutoff:2.4,        // ab radius*cutoff (≈100 px) exakt 0
  carry:.35,         // Anteil der Fingergeschwindigkeit, mit der Wasser mitströmt
  side:.07,          // seitliche Verdrängung von der Spur weg
  maxFingerSpeed:1600,
  maxFlow:240,       // px/s Strömung höchstens
  decay:.45,         // s Abklingzeit
  lifetime:1.1,      // s
  maxSegments:160,
  tapRadius:34,tapSpeed:70, // Antippen: kleiner radialer Schubs im Nahbereich
  coupling:3.2       // 1/s wie schnell ein Teil die Strömung annimmt (× Gewicht)
 }),
 drift:Object.freeze({
  step:1/120,        // feste Physik-Schrittweite in s (bildratenunabhängig)
  maxSteps:10,
  current:.5,        // sehr ruhige Grundströmung px/s² (kein Wandern)
  drag:2.4,          // 1/s Wasserwiderstand
  inertia:1.0,       // zusätzliche Trägheit (Masse + inertia)
  maxSpeed:110,      // px/s
  spin:.004,         // wie stark Strömungsstöße das Teil drehen
  spinDrag:3.2,
  maxSpin:.6,        // rad/s
  repel:420,         // weiche gegenseitige Abstoßung
  edge:700           // weicher Rand
 }),
 float:Object.freeze({
  maxBob:2.5,        // px Hub höchstens (zusätzlich ≤ size*0.065)
  bob:.35,roll:.3,pitch:.35, // Darstellungsfaktoren auf stepBuoyancy
  waveTilt:220,      // Wellensteigung → Kippen (Original-Merge: 320)
  bandLift:3.5,      // Auftrieb aus der Wischwelle (nur Wippen, keine Wanderung)
  wake:Object.freeze({minSpeed:35,interval:450,amp:.01,radius:2.2,perSecond:2})
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
 return{force,water:b.water,wake:{...b.wake,push:b.wake.push*force,pull:b.wake.pull*force,tap:b.wake.tap*force,spray:b.wake.spray*Math.min(1,force)},
  flow:{...b.flow,carry:b.flow.carry*force,side:b.flow.side*force,tapSpeed:b.flow.tapSpeed*force},drift:b.drift,float:b.float};
}
