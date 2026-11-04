// Unsichtbares 6×6-Logikraster. Es wird NICHT gezeichnet; es liefert nur
// Feldpositionen in Bildschirmpixeln. Es füllt die freie Meeresfläche zwischen
// Kopfzeile und (späterer) Steuerleiste so groß wie möglich aus.
export const GRID_SIZE=6;
// Felder dürfen leicht rechteckig werden (max. 1,3 : 1), damit das Raster im
// Hochformat mehr Meeresfläche nutzt. cell = kleinere Kante (für Objektgröße).
export const MAX_CELL_STRETCH=1.3;
export function gridGeometry(width,height,{top=72,bottom=96,side=8,max=820}={}){
 const availW=Math.min(width-side*2,max),availH=Math.min(height-top-bottom,max);
 let cw=availW/GRID_SIZE,ch=availH/GRID_SIZE;
 if(ch>cw*MAX_CELL_STRETCH)ch=cw*MAX_CELL_STRETCH;
 if(cw>ch*MAX_CELL_STRETCH)cw=ch*MAX_CELL_STRETCH;
 const w=cw*GRID_SIZE,h=ch*GRID_SIZE,left=(width-w)/2,y0=top+(height-top-bottom-h)/2;
 return{width:w,height:h,cellW:cw,cellH:ch,cell:Math.min(cw,ch),left,top:y0,right:left+w,bottom:y0+h};
}
export const cellIndex=(row,col)=>row*GRID_SIZE+col;
export function cellCenter(index,g){const row=Math.floor(index/GRID_SIZE),col=index%GRID_SIZE;return{x:g.left+(col+.5)*g.cellW,y:g.top+(row+.5)*g.cellH};}
export function cellAt(x,y,g){const col=Math.floor((x-g.left)/g.cellW),row=Math.floor((y-g.top)/g.cellH);return(col<0||row<0||col>=GRID_SIZE||row>=GRID_SIZE)?-1:cellIndex(row,col);}
