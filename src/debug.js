// Diagnose-Overlay für ?debug=1: Viewport-, Safe-Area- und Canvas-Maße live.
export function startDebug(app){
 const probe=css=>{const e=document.createElement('div');e.className='probe';e.style.cssText+=css;document.body.append(e);return e;};
 const lvh=probe('height:100lvh'),dvh=probe('height:100dvh'),svh=probe('height:100svh'),vh=probe('height:100vh');
 const sa=probe('padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);height:0');
 const box=document.createElement('pre');box.className='debug';document.body.append(box);
 const r=n=>Math.round(n*10)/10;
 const tick=()=>{
  const cs=getComputedStyle(sa),root=app.ocean.root.getBoundingClientRect(),gl=app.ocean.canvas,tc=app.trash.canvas;
  box.textContent=[
   `Ocean Clean v${app.version}`,
   `innerW×H      ${innerWidth}×${innerHeight}`,
   `visualViewport ${r(visualViewport?.width??0)}×${r(visualViewport?.height??0)}`,
   `screen        ${screen.width}×${screen.height}  dpr ${devicePixelRatio}`,
   `100vh/lvh/dvh/svh ${r(vh.offsetHeight)}/${r(lvh.offsetHeight)}/${r(dvh.offsetHeight)}/${r(svh.offsetHeight)}`,
   `safe-area t/r/b/l ${cs.paddingTop}/${cs.paddingRight}/${cs.paddingBottom}/${cs.paddingLeft}`,
   `standalone    nav=${navigator.standalone} mm=${matchMedia('(display-mode: standalone)').matches}`,
   `--play-h      ${getComputedStyle(document.documentElement).getPropertyValue('--play-h')}`,
   `html/body     ${r(document.documentElement.getBoundingClientRect().height)}/${r(document.body.getBoundingClientRect().height)}  class=${document.documentElement.className}`,
   `container     ${r(root.top)}..${r(root.bottom)} (${r(root.width)}×${r(root.height)})`,
   `water canvas  css ${app.ocean.width}×${app.ocean.height} px ${gl.width}×${gl.height}`,
   `trash canvas  px ${tc.width}×${tc.height}  field ${app.trash.w}×${r(app.trash.h)}`,
  ].join('\n');
  setTimeout(tick,500);};
 tick();
}
