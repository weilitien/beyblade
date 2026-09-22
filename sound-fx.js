'use strict';
// Original, sample-free Web Audio effects. No music files or network downloads.
window.SoundFX=(()=>{
  let context=null,master=null,limiter=null,noiseBuffer=null,enabled=false,volume=.55,lastHit=-Infinity;
  const voices=new Set();
  const signatures={
    lubu:{notes:[110,147,220],wave:'sawtooth',step:.095,noise:900},
    guanyu:{notes:[147,220,440,880],wave:'triangle',step:.14,noise:2100},
    zhangfei:{notes:[90,65,48],wave:'sawtooth',step:.1,noise:420},
    zhaoyun:{notes:[587,880,1175,1760],wave:'sine',step:.055,noise:3600},
    zhugeliang:{notes:[392,494,587,784,1175],wave:'sine',step:.11,noise:0},
    liubei:{notes:[262,330,392,523],wave:'sine',step:.13,noise:0},
    caocao:{notes:[196,196,147,98],wave:'square',step:.1,noise:700},
    simayi:{notes:[220,165,110,82],wave:'triangle',step:.15,noise:550},
    zhouyu:{notes:[110,165,247],wave:'sawtooth',step:.09,noise:1800},
    diaochan:{notes:[880,659,988,740],wave:'sine',step:.12,noise:0},
    machao:{notes:[98,147,220,330],wave:'triangle',step:.085,noise:2600},
    pangde:{notes:[73,73,55],wave:'triangle',step:.15,noise:300},
    xiahou:{notes:[130,196,130],wave:'square',step:.09,noise:650},
    ganning:{notes:[988,494,247],wave:'sine',step:.075,noise:3100},
    sunce:{notes:[98,196,392],wave:'sawtooth',step:.09,noise:1000}
  };
  async function unlock(){
    if(!enabled)return false;
    if(!context){
      const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('Web Audio unavailable');
      context=new Audio();master=context.createGain();limiter=context.createDynamicsCompressor();
      limiter.threshold.value=-16;limiter.knee.value=15;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.16;
      master.gain.value=volume*.55;master.connect(limiter);limiter.connect(context.destination);
      noiseBuffer=context.createBuffer(1,context.sampleRate,context.sampleRate);const data=noiseBuffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    }
    if(context.state==='suspended')await context.resume();return context.state==='running';
  }
  function stop(){for(const source of voices){try{source.stop();}catch{}}voices.clear();lastHit=-Infinity;}
  async function setEnabled(value){enabled=!!value;if(!enabled){stop();return false;}try{await unlock();return enabled;}catch(e){enabled=false;stop();throw e;}}
  function setVolume(value){volume=Math.max(0,Math.min(1,Number(value)||0));if(master)master.gain.setTargetAtTime(volume*.55,context.currentTime,.025);}
  function voice(source,nodes,gain,pan,start,duration,level){
    if(voices.size>=64)return;
    const envelope=context.createGain(),panner=context.createStereoPanner();panner.pan.value=Math.max(-.8,Math.min(.8,pan||0));
    source.connect(gain||envelope);if(gain)gain.connect(envelope);envelope.connect(panner);panner.connect(master);
    envelope.gain.setValueAtTime(.0001,start);envelope.gain.exponentialRampToValueAtTime(Math.max(.0002,level),start+.006);envelope.gain.exponentialRampToValueAtTime(.0001,start+duration);
    voices.add(source);source.onended=()=>{voices.delete(source);[source,...nodes,envelope,panner].forEach(n=>n.disconnect());};source.start(start);source.stop(start+duration+.02);
  }
  function tone(freq,end,duration=.2,level=.08,wave='sine',delay=0,pan=0){if(voices.size>=64)return;const at=context.currentTime+delay,o=context.createOscillator();o.type=wave;o.frequency.setValueAtTime(freq,at);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),at+duration);voice(o,[],null,pan,at,duration,level);}
  function noise(freq,end,duration=.15,level=.09,delay=0,pan=0){if(voices.size>=64)return;const at=context.currentTime+delay,source=context.createBufferSource(),filter=context.createBiquadFilter();source.buffer=noiseBuffer;filter.type='bandpass';filter.Q.value=.75;filter.frequency.setValueAtTime(freq,at);filter.frequency.exponentialRampToValueAtTime(Math.max(40,end),at+duration);voice(source,[filter],filter,pan,at,duration,level);}
  function chime(notes,step=.08,wave='sine',level=.07,pan=0){notes.forEach((f,i)=>tone(f,f*.995,.3,level,wave,i*step,pan));}
  function play(kind,data={}){
    if(!enabled||!context||context.state!=='running'||document.hidden)return;
    const pan=Math.max(-.8,Math.min(.8,(data.x||0)/4));
    switch(kind){
      case 'hit':{
        if(context.currentTime-lastHit<.045)return;lastHit=context.currentTime;
        const force=Math.max(.25,Math.min(1.5,(data.damage||35)/85));
        tone(130+force*25,42,.12,.16*force,'triangle',0,pan);noise(2800,800,.10,.16*force,0,pan);
        tone(1700,1100,.13,.035*force,'sine',0,pan);tone(2530,2210,.075,.025*force,'sine',.008,pan);break;
      }
      case 'skill':{
        const id=data.id;
        if(id==='signature'){
          const s=signatures[data.character];if(!s)return;chime(s.notes,s.step,s.wave,.075,pan);
          if(s.noise)noise(s.noise,s.noise*.35,.38,.13,.02,pan);break;
        }
        if(id==='storm'){noise(450,3200,.48,.14,0,pan);tone(90,210,.35,.08,'sawtooth',0,pan);}
        else if(id==='rush'){noise(3800,300,.24,.2,0,pan);tone(240,65,.18,.12,'triangle',.07,pan);}
        else if(id==='center'){chime([330,440,660],.07,'sine',.08,pan);tone(150,90,.3,.07,'triangle',0,pan);}
        else if(id==='edge'){noise(1700,5000,.35,.12,0,pan);tone(330,880,.32,.055,'sine',0,pan);}
        else if(id==='wall'){tone(260,130,.28,.13,'triangle',0,pan);chime([660,990],.035,'sine',.065,pan);}
        else if(id==='reflect'){chime([1100,1650,2200],.045,'sine',.065,pan);noise(4500,1900,.1,.08,0,pan);}
        else if(id==='wind'){noise(2600,350,.5,.18,0,pan);tone(190,70,.4,.045,'sine',0,pan);}
        else if(id==='siphon'){tone(880,140,.5,.085,'sine',0,pan);chime([440,554,659],.09,'sine',.045,pan);}
        break;
      }
      case 'charge':tone(110,550,.48,.09,'triangle');noise(450,1600,.3,.035);break;
      case 'launch':noise(4200,180,.4,.2);tone(500,70,.35,.14,'sawtooth');chime([440,880],.06,'sine',.07);break;
      case 'evade':noise(4000,1300,.14,.09,0,pan);tone(1300,1900,.1,.05,'sine',0,pan);break;
      case 'interrupt':case 'seal':tone(180,65,.18,.085,'square',0,pan);noise(950,300,.12,.09,0,pan);break;
      case 'win':chime([392,494,587,784],.12,'triangle',.11);break;
      case 'lose':chime([294,247,196],.15,'triangle',.08);break;
      case 'draw':chime([330,392,330],.12,'sine',.08);break;
      case 'enabled':chime([523,784],.07,'sine',.055);break;
    }
  }
  return {unlock,setEnabled,setVolume,play,stop,get enabled(){return enabled;},get activeVoices(){return voices.size;},get state(){return context?.state||'uninitialized';},signatures};
})();
