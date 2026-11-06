// Zentrale Stellschrauben für Ocean Clean (Wasser-Eingabe und treibender Müll).
// Zum Testen: URL-Parameter ?force=0..2 multipliziert die Fingerkraft aufs Wasser
// UND die Wischströmung, die den Müll mitnimmt (1 = Standard, 0 = keine Reaktion).
// ?spin=0..2 multipliziert nur die Drehung der PNG-Items (1 = Standard, 0 = ruhig).
export const BASE_CONFIG=Object.freeze({
 water:Object.freeze({
  swell:79,          // Dünung, etwas lebhafter (Original-Preset 85, vorher 72)
  light:65,
  ambient:.86        // Faktor auf die Hintergrund-Wellen des Meeres
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
  coupling:3.2,      // 1/s wie schnell ein Teil die Strömung annimmt (× Gewicht)
  // Sog (Kielwasser) direkt unter der Spur: zieht Teile leicht in Wischrichtung mit
  // und hält sie zur Spurmitte hin, statt sie seitlich wegzuschieben. Eng begrenzt.
  suction:Object.freeze({
   radius:30,        // px seitlich um die Spur, glatter Abfall auf exakt 0
   strength:.3,      // Anteil der Fingergeschwindigkeit in Wischrichtung
   inward:.15,       // Zug zur Spurmitte (Anteil der Fingergeschwindigkeit)
   ahead:.35,        // vor der Fingerspitze schwächer als dahinter
   decay:.7          // s Abklingzeit des Sogs
  })
 }),
 drift:Object.freeze({
  step:1/120,        // feste Physik-Schrittweite in s (bildratenunabhängig)
  maxSteps:10,
  current:.5,        // sehr ruhige Grundströmung px/s² (kein Wandern)
  drag:2.4,          // 1/s Wasserwiderstand
  inertia:1.0,       // zusätzliche Trägheit (Masse + inertia)
  maxSpeed:110,      // px/s
  // Drehung um die Hochachse. Betrag ∝ Strömung (Wisch + Sog), Vorzeichen folgt
  // der Wischrichtung (links ↔ rechts entgegengesetzt). Ohne Strömung nur idleSpin.
  spin:.016,         // rad/s je px/s signierter Strömung (swirl)
  idleSpin:.07,      // rad/s leichte Drift ohne Strömung (mal spinBias)
  spinDrag:2.4,      // 1/s wie schnell die Drehung der Strömung folgt (~0.4 s)
  maxSpin:4.2,       // rad/s Deckel (starker Wisch: etwa eine Umdrehung in 1.5–2 s)
  repel:420,         // weiche gegenseitige Abstoßung
  edge:700           // weicher Rand
 }),
 float:Object.freeze({
  maxBob:2.5,        // px Hub höchstens (zusätzlich ≤ size*0.065)
  bob:.35,roll:.3,pitch:.35, // Darstellungsfaktoren auf stepBuoyancy
  waveTilt:220,      // Wellensteigung → Kippen (Original-Merge: 320)
  bandLift:3.5,      // Auftrieb aus der Wischwelle (nur Wippen, keine Wanderung)
  wake:Object.freeze({minSpeed:35,interval:450,amp:.01,radius:2.2,perSecond:2})
 }),
 // Ruhige Meeresunruhe, nur Darstellung (ändert b.x/b.y nicht): jedes Teil schaukelt
 // mit eigener Phase hoch/runter und hin/her. Dezent, Periode mehrere Sekunden.
 sway:Object.freeze({
  bobAmp:7,          // px Auf und Ab
  bobFreq:.2,        // Hz, eine Welle in 5 s
  swayAmp:11,        // px hin und her
  swayFreq:.12,      // Hz, eine Welle in etwa 8 s
  scaleAmp:.045      // Größenatemzug mit dem Hub, Anteil
 }),
 // Säcke: leichter Sog nur direkt vor der Öffnung. ?force ändert das nicht.
 // Wirkt nur, wenn die Physik ein Layout bekommt (env.bags).
 sort:Object.freeze({
  reach:22,          // px über der Lippe, danach exakt 0
  suction:52,        // px/s² nach unten, an der Lippe (leicht, gleich für jedes Gewicht)
  inward:96,         // px/s² zur Mitte der Öffnung
  swirl:48,          // px/s Scherung für die Drehung, nur im Sogfeld, seitlich der Mitte
  dock:20,           // px Weichheit der Kante neben den Öffnungen
  nudge:6,           // px, um die das Teil bei einem Fehlwurf sofort über der Lippe liegt
  reject:200,        // px/s Rückstoß nach oben
  rejectSide:42,     // px/s etwas zur Seite, damit es nicht auf der Lippe kleben bleibt
  rejectHold:.55,    // s kein erneutes Saugen an demselben Sack
  maxAccel:240      // Deckel, der Sog reißt nie
 }),
 // Haufen auf dem Wasser (v2026.11.06-1). Nichts sinkt unter die Fläche.
 // Teile liegen aufeinander. Berührung schiebt nur leicht; ohne Halt rollen sie herunter.
 pile:Object.freeze({
  thick:16,
  cover:.55,
  grabBand:0,
  grabInner:.92,
  fingerR:22,
  nudge:460,
  dwell:12,
  fall:46,           // px/s sichtbares Herunterrollen, kein Sprung
  roll:80,           // px/s² den Hang hinunter, nur am Rand der Auflage
  gravity:520,
  solid:1,
  skin:0,
  drag:3.4,
  maxSpeed:62,
  holdLift:52,
  holdK:22,
  ambient:0,
  ambientCoupling:0,
  edge:420,
  inertia:.45,
  idleSpin:0,
  spin:.02,
  maxSpin:2.2,
  spinDrag:8,
  holdSpin:.4,
  gather:0,
  floor:0,
  sway:Object.freeze({bobAmp:.8,bobFreq:.14,swayAmp:.5,swayFreq:.09,scaleAmp:.008})
 })
});

const clampN=(n,a,b)=>Math.max(a,Math.min(b,n));
export function readForce(search=globalThis.location?.search||''){
 const v=parseFloat(new URLSearchParams(search).get('force'));
 return Number.isFinite(v)?clampN(v,0,2):1;
}
export function readSpin(search=globalThis.location?.search||''){
 const v=parseFloat(new URLSearchParams(search).get('spin'));
 return Number.isFinite(v)?clampN(v,0,2):1;
}
// Konfig mit ?force auf Wasser-Eingabe und Kopplung, ?spin nur auf die Drehung.
// spin ist der zweite Parameter, damit makeConfig(force) in Tests unverändert bleibt.
export function makeConfig(force=readForce(), spin=readSpin()){
 const b=BASE_CONFIG,d=b.drift;
 return{force,spin,water:b.water,wake:{...b.wake,push:b.wake.push*force,pull:b.wake.pull*force,tap:b.wake.tap*force,spray:b.wake.spray*Math.min(1,force)},
  flow:{...b.flow,carry:b.flow.carry*force,side:b.flow.side*force,tapSpeed:b.flow.tapSpeed*force,
   suction:{...b.flow.suction,strength:b.flow.suction.strength*force,inward:b.flow.suction.inward*force}},
  drift:{...d,spin:d.spin*spin,idleSpin:d.idleSpin*spin,maxSpin:d.maxSpin*spin},float:b.float,sway:b.sway,sort:b.sort,pile:b.pile};
}
