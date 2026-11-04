// Offenes Meer ohne Küste: keine Bildränder, die Kamera darf beliebig wandern.
// Welteinheit: 1 = ungefähr eine Handy-Bildhöhe (wie im Original 1 y-Einheit).
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// Sichtbare Welthöhe. Hält die Lichtmuster auf allen Bildschirmen etwa gleich groß.
export function seaView(width,height){return{h:clamp(height/880,.75,1.4)};}
export class SeaCamera{
  constructor(){this.x=0;this.y=0;}
  // Langsames Treiben über das offene Meer – die Muster ziehen unter dem Raster durch.
  step(dt,drift=true){if(drift){this.x+=dt*.004;this.y+=dt*.0025;}}
}
