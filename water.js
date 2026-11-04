// Ocean Clean – Wasseroberfläche (offenes Meer, keine Küste).
// Technik 1:1 aus Ocean Merge (dist/water.js) übernommen: WebGL2-Fullscreen-
// Shader, der einen gemalten Meeresgrund mit Lichtmustern bricht, plus eine
// GPU-Wellensimulation (Ping-Pong-Höhenfeld) für lokale Störungen.
// Geändert: Küstenlinie, Brandung, Sand, Uferschaum und Wassermaske entfallen.
// Der Meeresgrund ist eine nahtlos kachelbare Textur in Weltkoordinaten.
import {seaView} from './camera.js?v=20261104-swipe';

// Gemeinsame GLSL-Hilfen: Bildschirm-UV -> Welt -> Kachel-UV.
const WORLD_GLSL=`
uniform vec2 uTile;      // Weltgröße einer Texturkachel
uniform float uViewH;    // sichtbare Welthöhe
vec2 worldPos(vec2 uv){float aspect=uResolution.x/uResolution.y;return vec2((uv.x-.5)*aspect,uv.y-.5)*uViewH+uCamera;}
vec2 tileUv(vec2 uv){return worldPos(uv)/uTile;}
`;

export const VERTEX=`#version 300 es
precision highp float;
in vec2 aPosition;
out vec2 vUv;
void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}
`;

// Höhenfeld-Schritt (unverändert bis auf die entfernte Uferreflexion).
export const STEP=`#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform vec4 uDrops[12];
uniform vec4 uSegs[16];   // Wischspur: Strecke a(xy)→b(zw), Bildschirm 0…1
uniform vec2 uSegP[16];   // x=Amplitude, y=Radius in Texeln
uniform int uSegCount;
uniform float uDamp;
uniform int uDropCount;
void main(){
  vec2 p=vUv;
  vec2 state=texture(uState,p).rg;
  float h=state.r;
  float next=(texture(uState,p+vec2(uTexel.x,0.)).r+texture(uState,p-vec2(uTexel.x,0.)).r+texture(uState,p+vec2(0.,uTexel.y)).r+texture(uState,p-vec2(0.,uTexel.y)).r)*.5-state.g;
  // Offenes Meer: Wellen laufen am Bildrand weich aus statt zu reflektieren.
  float edge=min(min(p.x,1.-p.x),min(p.y,1.-p.y));
  next*=mix(.90,uDamp,smoothstep(0.,.06,edge));
  for(int i=0;i<12;i++){
    if(i>=uDropCount)break;
    vec2 d=(p-uDrops[i].xy)/uTexel;
    float r=length(d)/uDrops[i].w;
    if(r<1.)next+=(cos(r*3.14159265)+1.)*.5*uDrops[i].z;
  }
  // Finger-Kapseln: lückenlose Störung entlang der ganzen Wischstrecke.
  for(int i=0;i<16;i++){
    if(i>=uSegCount)break;
    vec2 a=uSegs[i].xy/uTexel,b=uSegs[i].zw/uTexel,q=p/uTexel,ab=b-a;
    float h=clamp(dot(q-a,ab)/max(dot(ab,ab),1e-4),0.,1.);
    float r=length(q-a-ab*h)/uSegP[i].y;
    if(r<1.)next+=(cos(r*3.14159265)+1.)*.5*uSegP[i].x;
  }
  next=clamp(next,-.8,.8);
  fragColor=vec4(next,h,0.,1.);
}
`;

export const FRAGMENT=`#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uImage;
uniform sampler2D uState;
uniform vec2 uCamera;
uniform vec2 uResolution;
uniform vec2 uTexel;
uniform float uTime;
uniform float uWind;
uniform float uLight;
uniform float uHasSimulation;
uniform vec4 uTouches[4]; // Fingerspitzen: xy, Gischt-Stärke, Radius
uniform int uTouchCount;
uniform vec4 uRipples[20];
uniform int uRippleCount;
${WORLD_GLSL}
vec3 scene(vec2 uv){return texture(uImage,tileUv(uv)).rgb;}
vec3 softScene(vec2 uv,float level){return textureLod(uImage,tileUv(uv),level).rgb;}
// Scharfe Lichtmuster vom tieffrequenten Grundton trennen (wie im Original).
vec3 causticDetail(vec2 uv){return scene(uv)-softScene(uv,4.);}
float morphHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float morphNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(morphHash(i),morphHash(i+vec2(1.,0.)),f.x),mix(morphHash(i+vec2(0.,1.)),morphHash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){return morphNoise(p)*.55+morphNoise(p*2.03+7.1)*.3+morphNoise(p*4.1-3.3)*.15;}
void main(){
  vec2 uv=vec2(vUv.x,1.-vUv.y);
  float aspect=uResolution.x/uResolution.y;
  float t=uTime;
  vec2 p=uv*vec2(aspect,1.);
  vec2 world=worldPos(uv);
  // Analytische Dünung: vier Sinuswellen mit exakten Ableitungen (Original).
  float seaEnergy=.08+uWind*1.8;
  vec2 k1=vec2(10.,21.),k2=vec2(-25.,14.),k3=vec2(49.,-31.),k4=vec2(-76.,-39.);
  vec4 phases=vec4(dot(k1,p),dot(k2,p),dot(k3,p),dot(k4,p))+t*vec4(1.45,1.83,2.47,3.15);
  vec4 amplitudes=vec4(.0048,.0026,.0008,.00036)*seaEnergy;
  vec4 waveHeights=sin(phases)*amplitudes;
  vec4 slopes=cos(phases)*amplitudes;
  vec2 seaGradient=k1*slopes.x+k2*slopes.y+k3*slopes.z+k4*slopes.w;
  vec3 curvature=-vec3(k1.x*k1.x,k1.x*k1.y,k1.y*k1.y)*waveHeights.x
                 -vec3(k2.x*k2.x,k2.x*k2.y,k2.y*k2.y)*waveHeights.y
                 -vec3(k3.x*k3.x,k3.x*k3.y,k3.y*k3.y)*waveHeights.z
                 -vec3(k4.x*k4.x,k4.x*k4.y,k4.y*k4.y)*waveHeights.w;
  vec2 grad=seaGradient;
  vec2 dynamicGrad=vec2(0.);
  float height=0.;
  if(uHasSimulation>.5){
    float a=texture(uState,uv-vec2(uTexel.x,0.)).r;
    float b=texture(uState,uv+vec2(uTexel.x,0.)).r;
    float c=texture(uState,uv-vec2(0.,uTexel.y)).r;
    float d=texture(uState,uv+vec2(0.,uTexel.y)).r;
    height=texture(uState,uv).r;
    dynamicGrad=vec2(b-a,d-c)*4.5;
    // Fingerwellen sichtbar verstärken; das ruhige Grundbild (kleine Gradienten) bleibt unverändert.
    dynamicGrad*=1.+3.2*smoothstep(.045,.3,length(dynamicGrad));
    curvature+=vec3(a+b-2.*height,0.,c+d-2.*height)*75.;
  }else{
    for(int i=0;i<20;i++){
      if(i>=uRippleCount)break;
      vec2 delta=(uv-uRipples[i].xy)*vec2(aspect,1.);
      float r=length(delta)+.0001;
      float age=t-uRipples[i].z;
      float distanceFromFront=r-age*.13;
      float width=.027+age*.012;
      float envelope=exp(-pow(distanceFromFront/width,2.))*exp(-age*.75)/(1.+r*12.);
      float phase=distanceFromFront*125.;
      float derivative=(cos(phase)*125.-sin(phase)*2.*distanceFromFront/(width*width))*envelope;
      dynamicGrad+=delta/r*derivative*uRipples[i].w*.0024;
      height+=sin(phase)*envelope*uRipples[i].w*.05;
    }
  }
  // Breite, langsame Dünung des offenen Meeres (statt Brandung): sehr flache
  // lange Wellenzüge, die nur Licht und Lichtmuster leicht modulieren.
  float swellPhase=dot(world,vec2(.55,1.))*5.2-t*.62;
  float swell=sin(swellPhase+fbm(world*1.3+t*.03)*2.2);
  grad+=vec2(.55,1.)*cos(swellPhase)*.0016*(.4+uWind);
  grad+=dynamicGrad;
  vec2 drift=vec2(seaGradient.x/aspect,seaGradient.y)*.018;
  vec2 refraction=vec2(grad.x/aspect,grad.y)*.022+vec2(dynamicGrad.x/aspect,dynamicGrad.y)*.03;
  vec2 sampleUv=uv+refraction+drift;
  vec3 normal=normalize(vec3(-grad.x,grad.y,1.));
  // Snell-Brechung des Sonnenstrahls an der echten Oberflächennormalen.
  vec3 sunDirection=normalize(vec3(-.32,.46,1.));
  vec3 bentRay=refract(-sunDirection,normal,.75188);
  vec3 flatRay=refract(-sunDirection,vec3(0.,0.,1.),.75188);
  float depth=.36; // überall tiefes Wasser
  vec2 rayShift=(bentRay.xy/max(.2,-bentRay.z)-flatRay.xy/(-flatRay.z))*depth;
  vec2 lightUv=uv-vec2(rayShift.x/aspect,-rayShift.y)+drift*.35;
  // Zwei versetzte Fließphasen verformen das gemalte Lichtmuster (Original).
  float activity=clamp(length(dynamicGrad)*3.5+abs(height)*1.5,0.,1.);
  float morphStrength=.86+uWind*.64+activity*1.55;
  vec2 morphP=world+seaGradient*.10+dynamicGrad*.035;
  vec2 field=vec2(morphNoise(morphP*6.+vec2(t*.065,3.7)),morphNoise(morphP*6.+vec2(17.3,-t*.055)))-.5;
  vec2 worldFlow=field*.086+vec2(.014,.026);
  vec2 flow=worldFlow*vec2(1./aspect,1.)*morphStrength;
  vec2 flowB=(vec2(-worldFlow.y,worldFlow.x)*.85+vec2(.014,-.008))*vec2(1./aspect,1.)*morphStrength;
  vec2 shape=vec2(morphNoise(morphP*13.+vec2(t*.17,11.2)),morphNoise(morphP*11.+vec2(31.8,-t*.15)))-.5;
  vec2 shapeWarp=shape*vec2(1./aspect,1.)*(.018+activity*.030);
  float clock=t*(.24+uWind*.075)+morphNoise(morphP*4.5+28.7)*.75;
  float phaseA=fract(clock),phaseB=fract(clock+.5);
  float weightA=1.-abs(phaseA*2.-1.);
  weightA=weightA*weightA*(3.-2.*weightA);
  vec3 detailA=causticDetail(lightUv+shapeWarp-flow*phaseA);
  vec3 detailB=causticDetail(lightUv-shapeWarp*.85-flowB*phaseB+vec2(.012/aspect,-.009)*morphStrength);
  float contrast=inversesqrt(weightA*weightA+(1.-weightA)*(1.-weightA));
  vec3 movingLight=(detailA*weightA+detailB*(1.-weightA))*mix(1.,contrast,.65);
  // Großflächige Tiefenvariation bricht die Kachelwiederholung auf: tieferes
  // Blau in Flecken, hellere Türkis-Zonen dazwischen; Licht dort etwas schwächer.
  float deep=smoothstep(.30,.78,fbm(world*.9+vec2(t*.008,-t*.006)));
  float lightAmount=mix(1.,.72,deep)*(.92+.08*swell);
  float focusScale=depth*.25;
  float jxx=1.+curvature.x*focusScale,jyy=1.+curvature.z*focusScale,jxy=curvature.y*focusScale;
  float focus=clamp(inversesqrt(max(jxx*jyy-jxy*jxy,.42)),.76,1.45);
  vec3 base=softScene(sampleUv,4.);
  base=mix(base,base*vec3(.55,.80,.93),deep*.42);
  vec3 refracted=base+movingLight*(.55+uLight*.7)*focus*lightAmount;
  refracted*=1.+(focus-1.)*.028*uLight;
  vec2 micro=vec2(sin(p.x*175.+p.y*131.-t*3.5),cos(p.x*117.-p.y*167.+t*3.9))*.006*seaEnergy;
  vec3 reflectionNormal=normalize(vec3(-grad.x-micro.x,grad.y+micro.y,1.));
  vec3 halfLight=normalize(sunDirection+vec3(0.,0.,1.));
  float highlight=max(dot(reflectionNormal,halfLight),0.);
  float specular=pow(highlight,125.);
  float sun=exp(-length((uv-vec2(.15,.2))*vec2(aspect,1.))*1.2);
  float fresnel=.02+.98*pow(1.-max(normal.z,0.),5.);
  vec3 color=mix(refracted,vec3(.55,.85,.91),fresnel*.6);
  color+=vec3(1.,.99,.85)*specular*(.05+uLight*.16)*(.45+sun*.55);
  color+=vec3(.75,.94,.90)*pow(highlight,24.)*.009*uLight;
  color+=vec3(.35,.8,.68)*height*.28;
  // Wellenkämme der Wischspur: Glanz auf den Flanken, gebrochener Schaum auf steilen Kämmen.
  float dynSlope=length(dynamicGrad);
  vec3 dynNormal=normalize(vec3(-dynamicGrad.x*.35,dynamicGrad.y*.35,1.));
  float dynHighlight=pow(max(dot(dynNormal,normalize(vec3(-.32,.46,1.)+vec3(0.,0.,1.))),0.),40.);
  color+=vec3(1.,.99,.9)*dynHighlight*smoothstep(.05,.4,dynSlope)*(.25+uLight*.35);
  color+=vec3(.55,.95,.92)*max(height,0.)*.22;
  float foamNoise=morphNoise(world*95.+vec2(t*.9,-t*.7))*.6+morphNoise(world*210.-t*1.3)*.4;
  float crest=smoothstep(.18,.7,dynSlope)*.18+smoothstep(.45,1.3,dynSlope)*smoothstep(.45,.85,foamNoise)*.55;
  // Gischt-Schimmer direkt an der Fingerspitze bei schnellen Bewegungen.
  for(int i=0;i<4;i++){
    if(i>=uTouchCount)break;
    vec2 d=(uv-uTouches[i].xy)*vec2(aspect,1.);
    float fall=exp(-dot(d,d)/(uTouches[i].w*uTouches[i].w));
    crest+=fall*uTouches[i].z*(.25+.75*smoothstep(.35,.8,foamNoise));
  }
  color=mix(color,vec3(.9,1.,.97),clamp(crest,0.,.8));
  // Sanfte Randabdunklung: das Meer wirkt nach außen tiefer und weiter.
  vec2 v=(uv-.5)*vec2(aspect>1.?1.:.85,1.);
  color*=1.-smoothstep(.35,.95,length(v))*.16;
  fragColor=vec4(clamp(color,0.,1.),1.);
}
`;

function shader(gl,type,source){
  const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const log=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(log);}
  return s;
}
function program(gl,fragment){
  const p=gl.createProgram(),vs=shader(gl,gl.VERTEX_SHADER,VERTEX),fs=shader(gl,gl.FRAGMENT_SHADER,fragment);
  gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
  return {p,uniforms:new Map()};
}

export const TILE={x:1.2,y:.6}; // Welteinheiten einer Grund-Kachel (1 = Handy-Bildhöhe)

export class WaterSurface{
  constructor(canvas,image){
    this.canvas=canvas;
    const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:'default'});
    if(!gl)throw new Error('WebGL2 unavailable');
    this.gl=gl;this.surface=program(gl,FRAGMENT);this.stepProgram=program(gl,STEP);this.time=0;this.accumulator=0;this.pending=[];this.segments=[];this.touches=[];this.ripples=[];this.stateIndex=0;this.camera={x:0,y:0};
    this.floatSupported=!!gl.getExtension('EXT_color_buffer_float');
    const vertices=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vertices);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    this.vaos=new Map();
    for(const item of [this.surface,this.stepProgram]){
      const vao=gl.createVertexArray();gl.bindVertexArray(vao);const loc=gl.getAttribLocation(item.p,'aPosition');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);this.vaos.set(item.p,vao);
    }
    gl.bindVertexArray(null);
    // Kachelbarer Meeresgrund: REPEAT + Mipmaps (WebGL2 erlaubt NPOT, Kachel ist ohnehin 1024×512).
    this.imageTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.imageTexture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
    this.black=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.black);this.textureParameters(gl.NEAREST);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));
    this.states=[];this.width=1;this.height=1;this.simW=192;this.simH=280;
  }
  textureParameters(filter){const g=this.gl;g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,filter);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,filter);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);}
  use(item){const g=this.gl;g.useProgram(item.p);g.bindVertexArray(this.vaos.get(item.p));this.current=item;}
  uniform(name){const item=this.current;if(!item.uniforms.has(name))item.uniforms.set(name,this.gl.getUniformLocation(item.p,name));return item.uniforms.get(name);}
  bind(texture,unit,name){const g=this.gl;g.activeTexture(g.TEXTURE0+unit);g.bindTexture(g.TEXTURE_2D,texture);g.uniform1i(this.uniform(name),unit);}
  setCamera(x,y){this.camera.x=x;this.camera.y=y;}
  resize(width,height,dpr=1.5,quality='auto'){
    const g=this.gl;this.width=width;this.height=height;this.canvas.width=Math.max(1,Math.round(width*dpr));this.canvas.height=Math.max(1,Math.round(height*dpr));
    const desiredWidth=quality==='eco'?128:quality==='high'?240:192;
    const desiredHeight=Math.min(512,Math.round(desiredWidth*height/width));
    if(this.states.length&&this.simW===desiredWidth&&this.simH===desiredHeight)return;
    this.simW=desiredWidth;this.simH=desiredHeight;
    for(const state of this.states){g.deleteFramebuffer(state.fbo);g.deleteTexture(state.texture);}this.states=[];
    if(!this.floatSupported)return;
    for(let i=0;i<2;i++){
      const texture=g.createTexture();g.bindTexture(g.TEXTURE_2D,texture);this.textureParameters(g.LINEAR);g.texImage2D(g.TEXTURE_2D,0,g.RG16F,this.simW,this.simH,0,g.RG,g.HALF_FLOAT,null);
      const fbo=g.createFramebuffer();g.bindFramebuffer(g.FRAMEBUFFER,fbo);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,texture,0);
      if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE){this.floatSupported=false;g.deleteTexture(texture);g.deleteFramebuffer(fbo);break;}
      g.clearColor(0,0,0,1);g.clear(g.COLOR_BUFFER_BIT);this.states.push({texture,fbo});
    }
    g.bindFramebuffer(g.FRAMEBUFFER,null);this.stateIndex=0;
  }
  // x,y: Bildschirm 0…1. Spätere Merges können hier Wellen auslösen.
  disturb(x,y,amplitude=.14,radius=4){
    if(!Number.isFinite(x+y+amplitude+radius))return;
    x=Math.max(.005,Math.min(.995,x));y=Math.max(.005,Math.min(.995,y));
    if(this.pending.length<48)this.pending.push([x,y,amplitude,radius]);
    this.ripples.push([x,y,this.time,Math.min(2.2,Math.abs(amplitude)*7)]);
    if(this.ripples.length>20)this.ripples.shift();
  }
  // Wischspur von (x0,y0) nach (x1,y1), Bildschirm 0…1. Die Kapsel im Step-Shader
  // deckt die ganze Strecke ab, auch bei schnellen Wischern entstehen keine Lücken.
  stroke(x0,y0,x1,y1,amplitude,radius=4){
    if(!Number.isFinite(x0+y0+x1+y1+amplitude+radius))return;
    if(this.floatSupported&&this.states.length===2){if(this.segments.length<96)this.segments.push([x0,y0,x1,y1,amplitude,radius]);}
    else if(Math.hypot(x1-x0,y1-y0)>.002&&Math.random()<.3){this.ripples.push([x1,y1,this.time,Math.min(2.2,Math.abs(amplitude)*40)]);if(this.ripples.length>20)this.ripples.shift();}
  }
  // Fingerspitzen für den Gischt-Schimmer: [{x,y,foam,radius}]
  setTouches(list){this.touches=list.slice(0,4);}
  calm(){
    this.pending=[];this.segments=[];this.ripples=[];
    const g=this.gl;for(const s of this.states){g.bindFramebuffer(g.FRAMEBUFFER,s.fbo);g.clearColor(0,0,0,1);g.clear(g.COLOR_BUFFER_BIT);}g.bindFramebuffer(g.FRAMEBUFFER,null);
  }
  advance(dt,settings){
    const g=this.gl;this.time+=dt;this.accumulator=Math.min(this.accumulator+dt,.05);
    const hasSimulation=this.floatSupported&&this.states.length===2;
    if(hasSimulation){
      // 90 Hz: Ringwellen laufen 1,5× so schnell wie vorher, Spur klingt über mehrere Sekunden ab.
      const STEP_DT=1/90;
      while(this.accumulator>=STEP_DT){
        this.use(this.stepProgram);const source=this.states[this.stateIndex],target=this.states[1-this.stateIndex];g.bindFramebuffer(g.FRAMEBUFFER,target.fbo);g.viewport(0,0,this.simW,this.simH);this.bind(source.texture,0,'uState');g.uniform2f(this.uniform('uTexel'),1/this.simW,1/this.simH);
        const packet=this.pending.splice(0,12),drops=new Float32Array(48);packet.forEach((drop,index)=>drops.set(drop,index*4));g.uniform4fv(this.uniform('uDrops[0]'),drops);g.uniform1i(this.uniform('uDropCount'),packet.length);
        const segs=this.segments.splice(0,16),sd=new Float32Array(64),sp=new Float32Array(32);segs.forEach((s,i)=>{sd.set(s.slice(0,4),i*4);sp.set(s.slice(4,6),i*2);});g.uniform4fv(this.uniform('uSegs[0]'),sd);g.uniform2fv(this.uniform('uSegP[0]'),sp);g.uniform1i(this.uniform('uSegCount'),segs.length);g.uniform1f(this.uniform('uDamp'),.9965);
        g.drawArrays(g.TRIANGLES,0,3);this.stateIndex=1-this.stateIndex;this.accumulator-=STEP_DT;
      }
    }else{this.pending=[];this.segments=[];this.accumulator=0;}
    this.ripples=this.ripples.filter(r=>this.time-r[2]<7);
    this.use(this.surface);g.bindFramebuffer(g.FRAMEBUFFER,null);g.viewport(0,0,this.canvas.width,this.canvas.height);this.bind(this.imageTexture,0,'uImage');this.bind(hasSimulation?this.states[this.stateIndex].texture:this.black,1,'uState');
    g.uniform2f(this.uniform('uCamera'),this.camera.x,this.camera.y);
    g.uniform2f(this.uniform('uTile'),TILE.x,TILE.y);g.uniform1f(this.uniform('uViewH'),seaView(this.width,this.height).h);
    g.uniform2f(this.uniform('uResolution'),this.width,this.height);g.uniform2f(this.uniform('uTexel'),1/this.simW,1/this.simH);g.uniform1f(this.uniform('uTime'),this.time);g.uniform1f(this.uniform('uWind'),settings.swell/100);g.uniform1f(this.uniform('uLight'),settings.light/100);g.uniform1f(this.uniform('uHasSimulation'),hasSimulation?1:0);
    const touchData=new Float32Array(16);this.touches.forEach((p,i)=>touchData.set([p.x,p.y,p.foam,p.radius],i*4));g.uniform4fv(this.uniform('uTouches[0]'),touchData);g.uniform1i(this.uniform('uTouchCount'),this.touches.length);
    const ripples=new Float32Array(80);this.ripples.forEach((r,index)=>ripples.set(r,index*4));g.uniform4fv(this.uniform('uRipples[0]'),ripples);g.uniform1i(this.uniform('uRippleCount'),this.ripples.length);g.drawArrays(g.TRIANGLES,0,3);
  }
}

// 2D-Fallback ohne WebGL2: gekachelter Meeresgrund mit wandernden Streifen-Verschiebungen.
export class CanvasSurface{
  constructor(canvas,image){this.canvas=canvas;this.image=image;this.context=canvas.getContext('2d',{alpha:false});this.ripples=[];this.time=0;this.width=1;this.height=1;this.camera={x:0,y:0};}
  setCamera(x,y){this.camera.x=x;this.camera.y=y;}
  resize(width,height,dpr=1.5){this.width=width;this.height=height;this.dpr=dpr;this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);}
  stroke(x0,y0,x1,y1,amplitude){if(Math.random()<.35)this.disturb(x1,y1,Math.min(.5,Math.abs(amplitude)*6));}
  setTouches(){}
  disturb(x,y,amplitude=.14){this.ripples.push({x,y,start:this.time,amplitude});if(this.ripples.length>35)this.ripples.shift();}
  calm(){this.ripples=[];}
  advance(dt,settings){
    this.time+=dt;const c=this.context,w=this.width,h=this.height,view=seaView(w,h),pxPerWorld=h/view.h,tw=TILE.x*pxPerWorld,th=TILE.y*pxPerWorld;
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='#04b2ec';c.fillRect(0,0,w,h);
    const ox=((w/2-this.camera.x*pxPerWorld)%tw+tw)%tw-tw,oy=((h/2-this.camera.y*pxPerWorld)%th+th)%th-th,motion=.08+settings.swell*.018;
    for(let y=0;y<h;y+=3){const shift=(Math.cos(y/h*21+this.time*1.45)*5+Math.cos(y/h*49+this.time*2.47)*2)*motion,ty=((y-oy)%th+th)%th,sy=ty/th*this.image.height;
      for(let x=ox+shift-tw;x<w;x+=tw)c.drawImage(this.image,0,sy,this.image.width,Math.max(1,3/th*this.image.height),x,y,tw,3);}
    this.ripples=this.ripples.filter(r=>this.time-r.start<4);
    for(const r of this.ripples){const age=this.time-r.start,alpha=Math.exp(-age*1.2)*Math.min(.6,r.amplitude*2);for(let j=0;j<3;j++){const radius=age*78-j*10;if(radius<1)continue;c.beginPath();c.ellipse(r.x*w,r.y*h,radius,radius,0,0,Math.PI*2);c.strokeStyle=`rgba(222,255,242,${alpha*(1-j*.2)})`;c.lineWidth=1.5;c.stroke();}}
  }
}
