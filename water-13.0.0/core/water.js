// The scene and the water are separate layers. Nothing in this renderer knows
// about merge tiles: future game objects can use disturb() without a rewrite.
import {SCENE_RECT,COAST_PROFILE,shorelineAt} from './camera.js';
import {SEA_FEEL} from './game-feel.js';
import {sampleSurfFront,SURF_GLSL} from './surf.js';
const SHORELINE_GLSL=`
uniform float uOceanMode;
uniform float uOceanTravel;
float shoreline(float x){
  const float profile[${COAST_PROFILE.length}]=float[${COAST_PROFILE.length}](${COAST_PROFILE.map(n=>n.toFixed(4)).join(',')});
  float q=clamp((x-(${SCENE_RECT.x.toFixed(4)}))/${SCENE_RECT.width.toFixed(4)},0.,1.)*${(COAST_PROFILE.length-1).toFixed(1)};
  int i=min(int(floor(q)),${COAST_PROFILE.length-2});float f=q-float(i);f=f*f*(3.-2.*f);return mix(profile[i],profile[i+1],f);
}
vec2 sceneUv(vec2 uv){float aspect=uResolution.x/uResolution.y;float imageAspect=2./3.;if(uOceanMode>.5){float x=(uv.x-.5)*min(1.,aspect/imageAspect)+.5;float y=1.-abs(mod(uv.y*.86+uOceanTravel,2.)-1.);return vec2(x,.43+y*.59);}if(aspect<imageAspect)return vec2((uv.x-.5)*aspect/imageAspect+.5,uv.y)+uCamera;return vec2(uv.x,uv.y*imageAspect/aspect)+uCamera;}
`;
export const VERTEX = `#version 300 es
precision highp float;
in vec2 aPosition;
out vec2 vUv;
void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}
`;

export const STEP = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform vec4 uDrops[12];
uniform int uDropCount;
uniform vec2 uCamera;
uniform vec2 uResolution;
${SHORELINE_GLSL}
float shore(vec2 p){vec2 q=sceneUv(p);float s=shoreline(q.x);return smoothstep(s-.005,s+.022,q.y);}
float neighbor(vec2 p,float center){return mix(center,texture(uState,p).r,shore(p));}
void main(){
  vec2 p=vUv;
  vec2 state=texture(uState,p).rg;
  float h=state.r;
  float next=(neighbor(p+vec2(uTexel.x,0.),h)+neighbor(p-vec2(uTexel.x,0.),h)+neighbor(p+vec2(0.,uTexel.y),h)+neighbor(p-vec2(0.,uTexel.y),h))*.5-state.g;
  float edge=min(min(p.x,1.-p.x),min(p.y,1.-p.y));
  next*=mix(.92,.993,smoothstep(0.,.045,edge));
  for(int i=0;i<12;i++){
    if(i>=uDropCount)break;
    vec2 d=(p-uDrops[i].xy)/uTexel;
    float r=length(d)/uDrops[i].w;
    if(r<1.)next+=(cos(r*3.14159265)+1.)*.5*uDrops[i].z;
  }
  next=clamp(next*shore(p),-.8,.8);
  fragColor=vec4(next,h,0.,1.);
}
`;

export const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uImage;
uniform sampler2D uObjects;
uniform float uObjectsActive;
uniform float uObjectAnchoring;
uniform sampler2D uState;
uniform vec2 uCamera;
uniform vec2 uResolution;
uniform vec2 uTexel;
uniform float uTime;
uniform float uWind;
uniform float uLight;
uniform float uHasSimulation;
uniform vec4 uVortices[4];
uniform int uVortexCount;
uniform vec4 uRipples[20];
uniform int uRippleCount;
${SHORELINE_GLSL}
${SURF_GLSL}
float oceanMask(vec2 uv,vec3 color){float coast=shoreline(uv.x);return smoothstep(.025,.14,min(color.g,color.b)-color.r)*smoothstep(coast-.012,coast+.045,uv.y);}
vec3 sceneArt(vec2 q,float level){
  vec2 artUv=clamp((q-vec2(${SCENE_RECT.x.toFixed(4)},${SCENE_RECT.y.toFixed(4)}))/vec2(${SCENE_RECT.width.toFixed(4)},${SCENE_RECT.height.toFixed(4)}),vec2(.001),vec2(.999));
  return level<0.?texture(uImage,artUv).rgb:textureLod(uImage,artUv,level).rgb;
}
vec3 scene(vec2 uv){return sceneArt(sceneUv(uv),-1.);}
vec3 softScene(vec2 uv,float level){return sceneArt(sceneUv(clamp(uv,vec2(.001),vec2(.999))),level);}
// Separate the sharp caustic detail from the low-frequency seabed color. The
// sun patterns can now flow and deform without dragging the beach or rocks.
vec3 causticDetail(vec2 uv){return scene(clamp(uv,vec2(.001),vec2(.999)))-softScene(uv,4.);}
float morphHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float morphNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(morphHash(i),morphHash(i+vec2(1.,0.)),f.x),mix(morphHash(i+vec2(0.,1.)),morphHash(i+vec2(1.,1.)),f.x),f.y);}
void main(){
  vec2 uv=vec2(vUv.x,1.-vUv.y);
  vec2 imageUv=sceneUv(uv);
  float coast=shoreline(imageUv.x),coastDistance=imageUv.y-coast;
  vec3 original=scene(uv);
  float water=oceanMask(sceneUv(uv),softScene(uv,2.));
  water=mix(water,1.,smoothstep(coast+.07,coast+.14,imageUv.y));
  float aspect=uResolution.x/uResolution.y;
  float t=uTime;
  vec2 p=uv*vec2(aspect,1.);
  float surfStrength=smoothstep(0.,.20,uWind)*(.55+uWind*.75)*${SEA_FEEL.surfGain.toFixed(3)};
  vec4 front=surfFront(imageUv.x,t);
  float surfPhase=front.z,nearCoast=front.y,crestY=front.x;
  float crestDistance=imageUv.y-crestY;
  float crestWidth=mix(.009,.004,nearCoast)*${SEA_FEEL.crestWidthGain.toFixed(3)};
  float incoming=exp(-pow(crestDistance/crestWidth,2.))*(1.-smoothstep(.48,.515,surfPhase));
  float surfGradient=-crestDistance/(crestWidth*crestWidth)*incoming*.0009*surfStrength;
  float maxRunup=.026*surfStrength*(.93+.07*sin(imageUv.x*7.1+t*.11));
  float runup=maxRunup*smoothstep(.48,.62,surfPhase)*(1.-smoothstep(.62,.94,surfPhase));
  float sheetLife=smoothstep(.455,.50,surfPhase)*(1.-smoothstep(.93,.985,surfPhase));
  float backflow=smoothstep(.60,.68,surfPhase)*(1.-smoothstep(.91,.99,surfPhase));
  // One continuous sea surface drives displacement, refracted sunlight and
  // reflected glints. Its analytic derivatives keep the lighting coherent.
  float seaEnergy=(.08+uWind*1.8)*${SEA_FEEL.swellGain.toFixed(3)};
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
  dynamicGrad+=vec2(-front.w,1.)*surfGradient;
  grad+=dynamicGrad;
  vec2 warped=uv;
  float vortexFoam=0.;
  float vortexMotion=0.;
  for(int i=0;i<4;i++){
    if(i>=uVortexCount)break;
    vec2 delta=(uv-uVortices[i].xy)*vec2(aspect,1.);
    float radius=length(delta)+.0001;
    float strength=uVortices[i].z;
    float influence=exp(-radius*17.)*strength;
    vortexMotion=max(vortexMotion,influence);
    float angle=influence*.95;
    mat2 rotation=mat2(cos(angle),-sin(angle),sin(angle),cos(angle));
    vec2 swirl=rotation*delta;
    warped+=(swirl-delta)/vec2(aspect,1.);
    vec2 tangent=vec2(-delta.y,delta.x)/radius;
    grad+=delta/radius*influence*.2+tangent*influence*.07;
    float spiral=sin(atan(delta.y,delta.x)*3.+radius*135.-t*4.);
    vortexFoam+=pow(max(spiral,0.),10.)*influence*smoothstep(.009,.035,radius)*.11;
  }
  vec2 drift=vec2(seaGradient.x/aspect,seaGradient.y)*.018;
  vec2 refraction=vec2(grad.x/aspect,grad.y)*.022;
  refraction.y+=backflow*.0018*exp(-pow(coastDistance/.04,2.))*surfStrength;
  vec2 sampleUv=clamp(warped+refraction+drift,vec2(.001),vec2(.999));
  vec3 normal=normalize(vec3(-grad.x,grad.y,1.));
  // Snell refraction: the sun's ray bends with the actual surface normal.
  // Greater water depth gives the projected caustics a wider excursion.
  vec3 sunDirection=normalize(vec3(-.32,.46,1.));
  vec3 bentRay=refract(-sunDirection,normal,.75188);
  vec3 flatRay=refract(-sunDirection,vec3(0.,0.,1.),.75188);
  float depth=mix(.14,.36,smoothstep(.03,.60,coastDistance));
  vec2 rayShift=(bentRay.xy/max(.2,-bentRay.z)-flatRay.xy/(-flatRay.z))*depth;
  vec2 lightUv=warped-vec2(rayShift.x/aspect,-rayShift.y)+drift*.35;
  // Preserve the irregular, illustrated light pattern. Two staggered flow
  // phases reshape it continuously; their zero-weight resets are invisible.
  // This is an artistic flow morph, not a regularly spaced ray-mesh pattern.
  float activity=clamp(length(dynamicGrad)*3.5+abs(height)*1.5+vortexMotion,0.,1.);
  float shoreFade=smoothstep(.015,.10,coastDistance);
  float morphStrength=(.86+uWind*.64+activity*1.55)*shoreFade;
  vec2 morphP=warped*vec2(aspect,1.)+seaGradient*.10+dynamicGrad*.035;
  vec2 field=vec2(morphNoise(morphP*6.+vec2(t*.065,3.7)),morphNoise(morphP*6.+vec2(17.3,-t*.055)))-.5;
  vec2 worldFlow=field*.086+vec2(.014,.026);
  vec2 flow=worldFlow*vec2(1./aspect,1.)*morphStrength;
  // The incoming light layer takes a different path and starts at a new
  // nearby patch, so fading filaments give way to genuinely different ones.
  vec2 flowB=(vec2(-worldFlow.y,worldFlow.x)*.85+vec2(.014,-.008))*vec2(1./aspect,1.)*morphStrength;
  vec2 shape=vec2(morphNoise(morphP*13.+vec2(t*.17,11.2)),morphNoise(morphP*11.+vec2(31.8,-t*.15)))-.5;
  vec2 shapeWarp=shape*vec2(1./aspect,1.)*(.018+activity*.030)*shoreFade;
  float clock=t*(.24+uWind*.075)+morphNoise(morphP*4.5+28.7)*.75;
  float phaseA=fract(clock),phaseB=fract(clock+.5);
  float weightA=1.-abs(phaseA*2.-1.);
  weightA=weightA*weightA*(3.-2.*weightA);
  vec3 detailA=causticDetail(lightUv+shapeWarp-flow*phaseA);
  vec3 detailB=causticDetail(lightUv-shapeWarp*.85-flowB*phaseB+vec2(.012/aspect,-.009)*morphStrength);
  float contrast=inversesqrt(weightA*weightA+(1.-weightA)*(1.-weightA));
  vec3 movingLight=(detailA*weightA+detailB*(1.-weightA))*mix(1.,contrast,.65);
  // A bounded ray-footprint Jacobian approximates focusing/defocusing. This
  // lets crests gather light and troughs spread it, rather than blinking it.
  float focusScale=depth*.25;
  float jxx=1.+curvature.x*focusScale,jyy=1.+curvature.z*focusScale,jxy=curvature.y*focusScale;
  float focus=clamp(inversesqrt(max(jxx*jyy-jxy*jxy,.42)),.76,1.45);
  vec3 seabed=softScene(sampleUv,4.);
  // Objects are below the same refracting surface as the seabed. Caustics,
  // reflected sunlight and foam remain above them; transparent pixels preserve
  // the original environment exactly when no objects are present.
  vec2 objectUv=clamp(mix(warped+refraction*.48+drift*.25,uv,uObjectAnchoring),vec2(.001),vec2(.999));
  vec4 object=texture(uObjects,objectUv);
  float objectAlpha=object.a*uObjectsActive*.94;
  vec3 submerged=mix(object.rgb*vec3(.91,.99,1.02),seabed,.10);
  vec3 refracted=mix(seabed,submerged,objectAlpha)+movingLight*(.55+uLight*.7)*focus*mix(1.,.75,objectAlpha);
  refracted*=1.+(focus-1.)*.028*uLight;
  vec2 micro=vec2(sin(p.x*175.+p.y*131.-t*3.5),cos(p.x*117.-p.y*167.+t*3.9))*.006*seaEnergy;
  vec3 reflectionNormal=normalize(vec3(-grad.x-micro.x,grad.y+micro.y,1.));
  vec3 halfLight=normalize(sunDirection+vec3(0.,0.,1.));
  float highlight=max(dot(reflectionNormal,halfLight),0.);
  float specular=pow(highlight,125.);
  float sun=exp(-length((uv-vec2(.15,.38))*vec2(aspect,1.))*1.2);
  float fresnel=.02+.98*pow(1.-max(normal.z,0.),5.);
  vec3 color=mix(refracted,vec3(.55,.85,.91),fresnel*.6);
  color+=vec3(1.,.99,.85)*specular*(.05+uLight*.16)*(.45+sun*.55);
  color+=vec3(.75,.94,.90)*pow(highlight,24.)*.009*uLight;
  color+=vec3(.35,.8,.68)*height*.28;
  float crest=smoothstep(.18,.7,length(dynamicGrad))*.18;
  color=mix(color,vec3(.87,1.,.95),min(crest+vortexFoam,.25));
  // A restrained offshore crest grows into broken whitewater near the cove.
  float shoulder=exp(-pow((crestDistance-.011)/.018,2.))*(1.-smoothstep(.48,.52,surfPhase));
  color*=1.-shoulder*.032*surfStrength;
  float crestFoam=incoming*(.11+nearCoast*.43)*surfStrength;
  if(incoming>.002){float broken=.20+.80*smoothstep(.18,.85,morphNoise(vec2(imageUv.x*65.,t*.35)));color=mix(color,vec3(.87,.99,.95),crestFoam*broken);}
  color=clamp(color,0.,1.);
  vec3 result=mix(original,color,water);
  if(abs(coastDistance)<.07&&surfStrength>.001){
    // Warm sand admits a thin transparent sheet; grey rocks stay in front.
    float sand=smoothstep(.12,.24,original.r-original.b)*smoothstep(.09,.18,original.g-original.b)*smoothstep(.5,.75,original.r);
    float wetExtent=surfPhase<.62?runup:maxRunup;
    float wetRegion=smoothstep(-wetExtent-.002,-wetExtent+.001,coastDistance)*(1.-smoothstep(.002,.022,coastDistance));
    float wetness=smoothstep(.47,.60,surfPhase)*(1.-smoothstep(.75,1.,surfPhase))*wetRegion*sand*min(surfStrength,1.);
    result=mix(result,original*vec3(.79,.84,.87),wetness*.75);
    float fringe=(sin(imageUv.x*95.+t*3.5)*.0011+sin(imageUv.x*183.-t*2.7)*.00065)*sheetLife;
    float front=-runup+fringe;
    float sheet=smoothstep(front-.0013,front+.0012,coastDistance)*(1.-smoothstep(.012,.04,coastDistance))*sheetLife;
    float thickness=smoothstep(front,front+.014,coastDistance);
    vec3 submerged=original*vec3(.84,.91,.93)+vec3(.012,.028,.023);
    submerged=mix(submerged,vec3(.22,.78,.74),thickness*.11);
    result=mix(result,submerged,sheet*sand*.68*min(surfStrength,1.));
    float foamNoise=morphNoise(vec2(imageUv.x*155.,(coastDistance-front)*650.-t*.35));
    float edge=exp(-pow((coastDistance-front)/.0019,2.));
    float lace=exp(-max(coastDistance-front,0.)*180.)*smoothstep(front-.0007,front+.001,coastDistance)*smoothstep(.53,.78,foamNoise)*.40;
    float foam=(edge*(.50+.50*foamNoise)+lace)*sheetLife*surfStrength;
    result=mix(result,vec3(.87,.98,.94),clamp(foam*.62*max(sand,water),0.,.72));
    float returnThreads=pow(max(sin(imageUv.x*370.+morphNoise(imageUv*42.)*4.),0.),12.)*backflow*sheet*.035*surfStrength;
    result+=vec3(.61,.85,.77)*returnThreads*max(sand,water);
  }
  fragColor=vec4(clamp(result,0.,1.),1.);
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

export class WaterSurface{
  constructor(canvas,image){
    this.canvas=canvas;
    const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:'default'});
    if(!gl)throw new Error('WebGL2 unavailable');
    this.gl=gl;this.surface=program(gl,FRAGMENT);this.stepProgram=program(gl,STEP);this.time=0;this.accumulator=0;this.pending=[];this.ripples=[];this.stateIndex=0;this.camera={x:0,y:0};
    this.floatSupported=!!gl.getExtension('EXT_color_buffer_float');
    const vertices=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vertices);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    this.vaos=new Map();
    for(const item of [this.surface,this.stepProgram]){
      const vao=gl.createVertexArray();gl.bindVertexArray(vao);const loc=gl.getAttribLocation(item.p,'aPosition');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);this.vaos.set(item.p,vao);
    }
    gl.bindVertexArray(null);
    this.imageTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.imageTexture);this.textureParameters(gl.LINEAR);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    this.objectsTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.objectsTexture);this.textureParameters(gl.LINEAR);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,0]));
    this.black=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.black);this.textureParameters(gl.NEAREST);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));
    this.states=[];this.width=1;this.height=1;this.simW=192;this.simH=280;
  }
  textureParameters(filter){const g=this.gl;g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,filter);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,filter);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);}
  use(item){const g=this.gl;g.useProgram(item.p);g.bindVertexArray(this.vaos.get(item.p));this.current=item;}
  uniform(name){const item=this.current;if(!item.uniforms.has(name))item.uniforms.set(name,this.gl.getUniformLocation(item.p,name));return item.uniforms.get(name);}
  bind(texture,unit,name){const g=this.gl;g.activeTexture(g.TEXTURE0+unit);g.bindTexture(g.TEXTURE_2D,texture);g.uniform1i(this.uniform(name),unit);}
  setCamera(x,y){this.camera.x=x;this.camera.y=y;}
  setOceanView(travel=null){this.oceanMode=travel!==null;this.oceanTravel=travel||0;}
  setObjectAnchoring(amount=0){this.objectAnchoring=Math.max(0,Math.min(1,Number(amount)||0));}
  setObjectsLayer(canvas,visible=true,inOpenWater=false){this.objectsCanvas=canvas;this.objectsVisible=visible;this.objectsInOpenWater=inOpenWater;}
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
  disturb(x,y,amplitude=.14,radius=4){
    if(!Number.isFinite(x+y+amplitude+radius))return;
    x=Math.max(.005,Math.min(.995,x));y=Math.max(.005,Math.min(.995,y));
    if(this.pending.length<48)this.pending.push([x,y,amplitude,radius]);
    this.ripples.push([x,y,this.time,Math.min(2.2,Math.abs(amplitude)*7)]);
    if(this.ripples.length>20)this.ripples.shift();
  }
  calm(){
    this.pending=[];this.ripples=[];
    const g=this.gl;for(const s of this.states){g.bindFramebuffer(g.FRAMEBUFFER,s.fbo);g.clearColor(0,0,0,1);g.clear(g.COLOR_BUFFER_BIT);}g.bindFramebuffer(g.FRAMEBUFFER,null);
  }
  advance(dt,settings,vortices=[]){
    const g=this.gl;this.time+=dt;this.accumulator=Math.min(this.accumulator+dt,.05);
    const hasSimulation=this.floatSupported&&this.states.length===2;
    if(hasSimulation){
      while(this.accumulator>=1/60){
        this.use(this.stepProgram);const source=this.states[this.stateIndex],target=this.states[1-this.stateIndex];g.bindFramebuffer(g.FRAMEBUFFER,target.fbo);g.viewport(0,0,this.simW,this.simH);this.bind(source.texture,0,'uState');g.uniform2f(this.uniform('uTexel'),1/this.simW,1/this.simH);
        g.uniform2f(this.uniform('uCamera'),this.camera.x,this.camera.y);g.uniform2f(this.uniform('uResolution'),this.width,this.height);g.uniform1f(this.uniform('uOceanMode'),this.oceanMode?1:0);g.uniform1f(this.uniform('uOceanTravel'),this.oceanTravel||0);
        const packet=this.pending.splice(0,12),drops=new Float32Array(48);packet.forEach((drop,index)=>drops.set(drop,index*4));g.uniform4fv(this.uniform('uDrops[0]'),drops);g.uniform1i(this.uniform('uDropCount'),packet.length);g.drawArrays(g.TRIANGLES,0,3);this.stateIndex=1-this.stateIndex;this.accumulator-=1/60;
      }
    }else{this.pending=[];this.accumulator=0;}
    this.ripples=this.ripples.filter(r=>this.time-r[2]<7);
    this.use(this.surface);g.bindFramebuffer(g.FRAMEBUFFER,null);g.viewport(0,0,this.canvas.width,this.canvas.height);this.bind(this.imageTexture,0,'uImage');this.bind(hasSimulation?this.states[this.stateIndex].texture:this.black,1,'uState');
    this.bind(this.objectsTexture,2,'uObjects');const showObjects=!!this.objectsCanvas&&this.objectsVisible&&(!this.oceanMode||this.objectsInOpenWater);g.uniform1f(this.uniform('uObjectsActive'),showObjects?1:0);if(showObjects)g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,this.objectsCanvas);
    g.uniform1f(this.uniform('uObjectAnchoring'),this.objectAnchoring||0);
    g.uniform2f(this.uniform('uCamera'),this.camera.x,this.camera.y);
    g.uniform1f(this.uniform('uOceanMode'),this.oceanMode?1:0);g.uniform1f(this.uniform('uOceanTravel'),this.oceanTravel||0);
    g.uniform2f(this.uniform('uResolution'),this.width,this.height);g.uniform2f(this.uniform('uTexel'),1/this.simW,1/this.simH);g.uniform1f(this.uniform('uTime'),this.time);g.uniform1f(this.uniform('uWind'),settings.swell/100);g.uniform1f(this.uniform('uLight'),settings.light/100);g.uniform1f(this.uniform('uHasSimulation'),hasSimulation?1:0);
    const vortexData=new Float32Array(16);vortices.slice(0,4).forEach((v,index)=>vortexData.set([v.x,v.y,v.strength,0],index*4));g.uniform4fv(this.uniform('uVortices[0]'),vortexData);g.uniform1i(this.uniform('uVortexCount'),Math.min(vortices.length,4));
    const ripples=new Float32Array(80);this.ripples.forEach((r,index)=>ripples.set(r,index*4));g.uniform4fv(this.uniform('uRipples[0]'),ripples);g.uniform1i(this.uniform('uRippleCount'),this.ripples.length);g.drawArrays(g.TRIANGLES,0,3);
  }
}

// A lightweight accessible fallback for devices that do not provide WebGL2.
// It keeps all gestures usable instead of leaving a blank canvas.
export class CanvasSurface{
  constructor(canvas,image){this.canvas=canvas;this.image=image;this.context=canvas.getContext('2d',{alpha:false});this.ripples=[];this.time=0;this.width=1;this.height=1;this.camera={x:0,y:0};}
  setObjectAnchoring(amount=0){this.objectAnchoring=Math.max(0,Math.min(1,Number(amount)||0));}
  setObjectsLayer(canvas,visible=true,inOpenWater=false){this.objectsCanvas=canvas;this.objectsVisible=visible;this.objectsInOpenWater=inOpenWater;if(canvas&&!this.objectLight){this.objectLight=document.createElement('canvas');this.objectLightContext=this.objectLight.getContext('2d');}}
  setCamera(x,y){this.camera.x=x;this.camera.y=y;}
  setOceanView(travel=null){this.oceanMode=travel!==null;this.oceanTravel=travel||0;}
  resize(width,height,dpr=1.5){this.width=width;this.height=height;this.dpr=dpr;this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);}
  disturb(x,y,amplitude=.14,radius=4){this.ripples.push({x,y,start:this.time,amplitude,radius});if(this.ripples.length>35)this.ripples.shift();}
  calm(){this.ripples=[];}
  advance(dt,settings,vortices=[]){
    this.time+=dt;const c=this.context,w=this.width,h=this.height,aspect=w/h,sx=Math.min(1,aspect/(2/3)),sy=Math.min(1,(2/3)/aspect),left=.5-sx/2+this.camera.x,top=this.camera.y;
    if(this.oceanMode){
      // Reuse only the deep-water part of the original coast art. Mirrored
      // sampling lets the journey continue without redrawing the environment.
      c.setTransform(this.dpr,0,0,this.dpr,0,0);const sourceX=(.5-sx/2-SCENE_RECT.x)/SCENE_RECT.width*this.image.width,sourceW=sx/SCENE_RECT.width*this.image.width,sourceH=4/h*.86*.59/SCENE_RECT.height*this.image.height;
      for(let y=-3;y<h+3;y+=3){const q=y/h*.86+(this.oceanTravel||0),mirror=1-Math.abs(((q%2)+2)%2-1),sourceY=(.43+mirror*.59-SCENE_RECT.y)/SCENE_RECT.height*this.image.height,motion=(.08+settings.swell*.018)*SEA_FEEL.swellGain,shift=(Math.sin(y/h*21+this.time*1.45)*3+Math.sin(y/h*49-this.time*1.83))*motion;
        c.drawImage(this.image,sourceX,sourceY,sourceW,sourceH,shift-8,y,w+16,4.2);
      }
    }else{
    c.setTransform(this.dpr*w/sx,0,0,this.dpr*h/sy,-left*w/sx*this.dpr,-top*h/sy*this.dpr);
    c.fillStyle='#12c5ce';c.fillRect(left,top,sx,sy);
    const r=SCENE_RECT;c.drawImage(this.image,r.x,r.y,r.width,r.height);
    c.setTransform(this.dpr,0,0,this.dpr,0,0);
    // Refract narrow strips only below the shore; the beach stays perfectly still.
    const deepShore=Math.max(...Array.from({length:33},(_,i)=>shorelineAt(left+sx*i/32)))+.07;
    const start=Math.max(0,Math.ceil((deepShore-top)/sy*h)),sourceScale=sy*this.image.height/(r.height*h);
    if(left>=r.x&&left+sx<=r.x+r.width)for(let y=start;y<h;y+=3){const motion=(.08+settings.swell*.018)*SEA_FEEL.swellGain,phase=y/h*21+this.time*1.45,shift=(Math.cos(phase)*5+Math.cos(y/h*49+this.time*2.47)*2)*motion,verticalShift=(Math.sin(phase)*5+Math.sin(y/h*14+this.time*1.83)*2.5)*motion,strip=Math.min(3,h-y),sourceY=Math.max(0,Math.min(this.image.height-strip*sourceScale,(top-r.y)*this.image.height/r.height+(y+verticalShift)*sourceScale));c.drawImage(this.image,(left-r.x)*this.image.width/r.width,sourceY,sx*this.image.width/r.width,strip*sourceScale,shift,y,w,strip);}
    const front=sampleSurfFront(.5,this.time),surfStrength=Math.min(1,settings.swell/20)*(.55+settings.swell*.0075)*SEA_FEEL.surfGain;
    if(front.fade>0&&surfStrength>0){
      const points=Array.from({length:81},(_,i)=>{const x=i/80,wx=left+x*sx,f=sampleSurfFront(wx,this.time);return{x:x*w,y:(f.y-top)/sy*h,wx,near:f.near};});
      c.save();c.lineCap='round';c.lineJoin='round';
      // Broad transparent shoulder, then soft, uneven foam patches. No ruler-
      // straight full-width stroke, even on devices without WebGL2.
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i],patch=.22+.78*((1+Math.sin(b.wx*53+this.time*.34)*Math.sin(b.wx*21-this.time*.21))*.5)**1.5;
        c.beginPath();c.moveTo(a.x,a.y+4);c.lineTo(b.x,b.y+4);c.lineWidth=11;c.strokeStyle=`rgba(7,146,146,${.07*surfStrength*front.fade})`;c.stroke();
        c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.lineWidth=3.8+patch*3;c.shadowColor='#e9fff3';c.shadowBlur=5;c.strokeStyle=`rgba(230,255,243,${(.13+b.near*.17)*surfStrength*front.fade*patch})`;c.stroke();
      }
      c.restore();
    }
    }
    if(this.objectsCanvas&&this.objectsVisible&&(!this.oceanMode||this.objectsInOpenWater)){
      const mask=this.objectLight,light=this.objectLightContext;if(mask.width!==this.canvas.width||mask.height!==this.canvas.height){mask.width=this.canvas.width;mask.height=this.canvas.height;}
      light.setTransform(1,0,0,1,0,0);light.clearRect(0,0,mask.width,mask.height);light.drawImage(this.objectsCanvas,0,0,mask.width,mask.height);light.globalCompositeOperation='source-in';light.drawImage(this.canvas,0,0);light.globalCompositeOperation='source-over';
      c.save();c.setTransform(this.dpr,0,0,this.dpr,0,0);c.globalAlpha=.93;c.drawImage(this.objectsCanvas,0,0,w,h);c.globalAlpha=.18;c.drawImage(mask,0,0,w,h);c.restore();
    }
    this.ripples=this.ripples.filter(r=>this.time-r.start<4);
    for(const r of this.ripples){const age=this.time-r.start,alpha=Math.exp(-age*1.2)*Math.min(.6,r.amplitude*2);for(let j=0;j<3;j++){const radius=age*78-j*10;if(radius<1)continue;c.beginPath();c.ellipse(r.x*w,r.y*h,radius,radius*.87,0,0,Math.PI*2);c.strokeStyle=`rgba(222,255,242,${alpha*(1-j*.2)})`;c.lineWidth=1.5;c.stroke();}}
    for(const v of vortices){c.save();c.translate(v.x*w,v.y*h);c.rotate(-this.time*2);c.strokeStyle=`rgba(220,255,243,${v.strength*.25})`;c.lineWidth=1.5;c.beginPath();for(let a=0;a<Math.PI*5;a+=.12){const r=a*3;c.lineTo(Math.cos(a)*r,Math.sin(a)*r*.8);}c.stroke();c.restore();}
  }
}
