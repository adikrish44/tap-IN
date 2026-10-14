/** /chimpanzee BRICKS: original procedural soundtracks, no copyrighted recordings. */
export const BEATS=[
 {id:'afterglow',title:'Afterglow',artist:'The Brick Lab',bpm:108,key:'A minor',mood:'Dreamy bounce',shade:'peach',duration:128,accent:'#ff775e'},
 {id:'plastic-sun',title:'Plastic Sun',artist:'The Brick Lab',bpm:124,key:'C major',mood:'Golden house',shade:'gold',duration:124,accent:'#ffcf69'},
 {id:'orbit',title:'Orbit 96',artist:'The Brick Lab',bpm:96,key:'D minor',mood:'Space groove',shade:'violet',duration:160,accent:'#a89cff'},
 {id:'midnight-build',title:'Midnight Build',artist:'The Brick Lab',bpm:132,key:'F minor',mood:'Neon energy',shade:'blue',duration:128,accent:'#75b9ff'},
 {id:'stereo-city',title:'Stereo City',artist:'The Brick Lab',bpm:116,key:'E minor',mood:'City pop',shade:'mint',duration:132,accent:'#7addba'},
 {id:'soft-edges',title:'Soft Edges',artist:'The Brick Lab',bpm:84,key:'G major',mood:'Warm lofi',shade:'pink',duration:144,accent:'#e99eb8'}
];
const melodies={
 'afterglow':[57,null,60,64,67,null,64,60,57,null,60,62,64,null,60,55],
 'plastic-sun':[60,64,67,72,71,null,67,64,60,64,67,76,72,null,67,64],
 'orbit':[62,null,65,69,null,72,69,65,62,null,60,57,60,65,null,69],
 'midnight-build':[53,56,60,65,60,56,53,null,53,56,60,68,65,60,56,null],
 'stereo-city':[64,null,67,71,74,71,67,64,62,null,67,71,74,76,74,71],
 'soft-edges':[67,null,71,null,74,71,67,null,64,null,67,71,69,null,67,null]
};
const basslines={
 'afterglow':[45,45,48,43],'plastic-sun':[48,45,53,43],'orbit':[38,41,45,41],
 'midnight-build':[41,41,44,39],'stereo-city':[40,43,45,43],'soft-edges':[43,40,48,45]
};
const freq=n=>440*Math.pow(2,(n-69)/12);
export class BrickAudio {
 constructor(){this.ctx=null;this.master=null;this.analyser=null;this.nextStep=null;this.timer=null;this.currentTrack=null;this.lastClock='';this.level=0.78;this.freqArray=null;this.audio=null;this.audioUrl=null;this.playbackKey='';this.enabled=false;this.onStatus=()=>{};}
 async enable(){try{if(!this.ctx){const C=window.AudioContext||window.webkitAudioContext;this.ctx=new C();this.master=this.ctx.createGain();this.master.gain.value=this.level;this.analyser=this.ctx.createAnalyser();this.analyser.fftSize=256;this.freqArray=new Uint8Array(this.analyser.frequencyBinCount);this.master.connect(this.analyser);this.analyser.connect(this.ctx.destination)}await this.ctx.resume();this.enabled=true;this.onStatus();return true}catch(e){console.warn(e);return false}}
 setVolume(v){this.level=Number(v);if(this.master)this.master.gain.setTargetAtTime(this.level,this.ctx.currentTime,.02);if(this.audio)this.audio.volume=this.level}
 stop(){if(this.timer){clearInterval(this.timer);this.timer=null}this.nextStep=null;this.currentTrack=null;if(this.audio){this.audio.pause();this.audio.src='';this.audio=null}this.playbackKey=''}
 tone(n,t,d,wave='sine',vol=.15,filter=0){const c=this.ctx;if(!c)return;const o=c.createOscillator(),g=c.createGain();o.type=wave;o.frequency.setValueAtTime(freq(n),t);if(filter)o.frequency.exponentialRampToValueAtTime(freq(n)*filter,t+Math.min(.2,d*.6));g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,vol),t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+d+.015)}
 noise(t,d,vol,highpass=0){const c=this.ctx;if(!c)return;const samples=Math.ceil(c.sampleRate*d);const buf=c.createBuffer(1,samples,c.sampleRate),data=buf.getChannelData(0);for(let i=0;i<samples;i++)data[i]=(Math.random()*2-1);const src=c.createBufferSource();src.buffer=buf;let tail=src;if(highpass){const f=c.createBiquadFilter();f.type='highpass';f.frequency.value=highpass;src.connect(f);tail=f}const g=c.createGain();g.gain.setValueAtTime(Math.max(.0001,vol),t);g.gain.exponentialRampToValueAtTime(.0001,t+d);tail.connect(g);g.connect(this.master);src.start(t);src.stop(t+d+.015)}
 step(track,index,t){if(!this.ctx)return;const ix=index%16,bar=Math.floor(index/16),root=basslines[track.id]?.[bar%4]||45;
  if(ix===0||ix===8){this.tone(35,t,.26,'sine',.6,.34);this.tone(47,t,.052,'triangle',.17,.5)}
  if(ix===4||ix===12){this.noise(t,.15,.22,1100);this.tone(50,t,.09,'triangle',.08,.6)}
  if(ix%2===0)this.noise(t,.045,.055,7000);
  if([0,3,6,10,14].includes(ix))this.tone(root+(ix===10?7:0),t,.2,'sawtooth',.09,.96);
  const note=melodies[track.id]?.[ix];if(note!=null){const kind=track.id==='midnight-build'?'square':track.id==='soft-edges'?'sine':'triangle';this.tone(note,t,track.id==='soft-edges'?.43:.27,kind,track.id==='midnight-build'?.065:.075)}
 }
 sync(track,playback,clockOffset){if(!track||!playback?.playing||!this.enabled){if(this.timer){clearInterval(this.timer);this.timer=null}this.currentTrack=null;this.nextStep=null;this.syncAudio(null,null,0);return}
  if(track.kind==='beat'){
    this.syncAudio(null,null,0);const beat=BEATS.find(b=>b.id===track.beat);if(!beat)return;
    const key=`${playback.trackId}:${playback.at}:${playback.offsetMs}`;
    if(this.lastClock!==key||this.currentTrack!==beat.id){this.nextStep=null;this.lastClock=key;this.currentTrack=beat.id}
    if(!this.timer)this.timer=setInterval(()=>this.schedule(beat,playback,clockOffset),40);
    this.schedule(beat,playback,clockOffset);
  }else{
    if(this.timer){clearInterval(this.timer);this.timer=null}this.currentTrack=null;this.nextStep=null;
    if(track.kind==='audio')this.syncAudio(track,playback,clockOffset);else this.syncAudio(null,null,0)
  }
 }
 schedule(beat,playback,clockOffset){if(!this.ctx||this.ctx.state!=='running')return;
  const stepMs=60000/beat.bpm/4,serverNow=Date.now()+clockOffset,currentMs=playback.offsetMs+(serverNow-playback.at),index=Math.max(0,Math.floor(currentMs/stepMs));
  if(this.nextStep==null||this.nextStep<index-1||this.nextStep>index+10)this.nextStep=index+1;
  while(this.nextStep*stepMs-currentMs<220){const delta=this.nextStep*stepMs-currentMs,t=this.ctx.currentTime+Math.max(.006,delta/1000);if(delta>=-60)this.step(beat,this.nextStep,t);this.nextStep++}
 }
 syncAudio(track,playback,clockOffset){if(!track){if(this.audio){this.audio.pause();this.audio.src='';this.audio=null}this.playbackKey='';return}
  if(this.playbackKey!==track.id){if(this.audio){this.audio.pause();this.audio.src=''}this.audio=new Audio(track.url);this.audio.preload='auto';this.audio.volume=this.level;this.playbackKey=track.id;this.audio.onerror=()=>this.onStatus()}
  const target=Math.max(0,(playback.offsetMs+(Date.now()+clockOffset-playback.at))/1000);
  if(Number.isFinite(this.audio.duration)&&target<this.audio.duration){if(Math.abs(this.audio.currentTime-target)>1.2)this.audio.currentTime=target}
  if(this.audio.paused)this.audio.play().catch(()=>this.onStatus());
 }
 levels(){if(!this.analyser||!this.enabled){return Array.from({length:40},(_,i)=>3+Math.sin(i*.61)*2)}this.analyser.getByteFrequencyData(this.freqArray);return Array.from({length:40},(_,i)=>this.freqArray[Math.floor(i*this.freqArray.length/40)]/255)}
}