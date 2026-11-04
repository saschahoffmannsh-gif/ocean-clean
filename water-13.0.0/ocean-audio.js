// Extracted from Ocean Clean app.js. Only settings injection is adapted.
export class OceanAudio{
  constructor(settings){this.settings=settings;this.context=null;this.gain=null;this.lastPlop=0;}
  async start(){
    if(!this.settings.sound)return;
    if(!this.context){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;const c=this.context=new AC();this.gain=c.createGain();this.gain.gain.value=0;this.gain.connect(c.destination);const buffer=c.createBuffer(1,c.sampleRate*4,c.sampleRate),data=buffer.getChannelData(0);let previous=0;for(let i=0;i<data.length;i++){previous=(previous+Math.random()*.04-.02)/1.02;data[i]=previous*6;}const source=c.createBufferSource();source.buffer=buffer;source.loop=true;const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=630;source.connect(filter);filter.connect(this.gain);source.start();const lfo=c.createOscillator(),lfoGain=c.createGain();lfo.frequency.value=.12;lfoGain.gain.value=.016;lfo.connect(lfoGain);lfoGain.connect(this.gain.gain);lfo.start();}
    if(this.context.state==='suspended')await this.context.resume();this.gain.gain.setTargetAtTime(.058,this.context.currentTime,.8);
  }
  async stop(){if(this.context){this.gain.gain.setTargetAtTime(0,this.context.currentTime,.15);await this.context.suspend();}}
  match(strength=1){
    if(!this.settings.sound||!this.context||this.context.state!=='running')return;const c=this.context,now=c.currentTime;
    for(const [i,hz]of [587.33,739.99,880].entries()){const o=c.createOscillator(),g=c.createGain(),at=now+i*.045;o.type='sine';o.frequency.setValueAtTime(hz*(1+Math.min(3,strength-1)*.035),at);g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(.024,at+.012);g.gain.exponentialRampToValueAtTime(.0001,at+.28);o.connect(g);g.connect(this.gain);o.start(at);o.stop(at+.3);}
  }
  plop(power=1){if(!this.settings.sound||!this.context||this.context.state!=='running')return;const c=this.context,t=c.currentTime;if(t-this.lastPlop<.09)return;this.lastPlop=t;const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(450+Math.random()*170,t);o.frequency.exponentialRampToValueAtTime(95,t+.15);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.035*Math.min(power,1.5),t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+.21);o.connect(g);g.connect(this.gain);o.start(t);o.stop(t+.23);}
}
