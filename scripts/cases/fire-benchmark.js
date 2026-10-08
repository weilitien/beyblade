(async () => {
 const stats = values => { const sorted=[...values].sort((a,b)=>a-b); return {medianMs:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.ceil(sorted.length*.95)-1],maxMs:sorted.at(-1),over16ms:values.filter(x=>x>16.67).length,samples:values.length}; };
 SpinArena.reset();SpinArena.select('luxun');SpinArena.setEnemy('luxun');CombatView.open();
 SpinArena.game.aiEnabled=false;SpinArena.game.start(.8,.8);
 const g=SpinArena.game;
 const cases=[];
 for(const count of [0,14,40]) for(const reduced of [false,true]) {
   const canvas=document.createElement('canvas');canvas.width=780;canvas.height=500;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   const actors=g.actors;
   actors.forEach(a=>a.status.fireTrail=6);
   const hazards=Array.from({length:count},(_,i)=>({owner:actors[i%2],kind:'trail',x:Math.cos(i)*2,z:Math.sin(i)*2,radius:.55,left:1+(i%5)*.2,tick:0}));
   for(const a of actors) SignatureFX.prepare('luxun',SignatureFX.hazardStyle({owner:a,kind:'trail',left:2}).color);
   const draw=[],serialize=[],apply=[],fullScene=[];
   g.hazards=hazards;
   for(let i=0;i<130;i++) {
     let start=performance.now();
     ctx.clearRect(0,0,780,500);
     SignatureFX.draw(ctx,(x,y,z)=>[390+x*80,250+z*45],80,actors,[],i/60,reduced,hazards);
     ctx.getImageData(0,0,780,500);
     const drawMs=performance.now()-start;
     start=performance.now();const data=JSON.stringify(captureNetwork());const serializeMs=performance.now()-start;
     start=performance.now();applyNetwork(JSON.parse(data));const applyMs=performance.now()-start;
     start=performance.now();SpinArena.draw();document.getElementById('arena').getContext('2d').getImageData(0,0,1,1);const fullMs=performance.now()-start;
     if(i>=10){draw.push(drawMs);serialize.push(serializeMs);apply.push(applyMs);fullScene.push(fullMs);}
   }
   const snapshot=captureNetwork();
   const bytes=new TextEncoder().encode(JSON.stringify(snapshot)).length;
   const compact={...snapshot,fields:{...snapshot.fields,hazards:snapshot.fields.hazards.map(f=>({...f,owner:f.owner.ai?1:0}))}};
   const compactOwnerBytes=new TextEncoder().encode(JSON.stringify(compact)).length;
   cases.push({count,reduced,compactOwnerBytes,effectDrawAndReadback:stats(draw),fullSceneDrawAndReadback:stats(fullScene),serialize:stats(serialize),parseApply:stats(apply),snapshotBytes:bytes,estimatedBytesPerSecondAt20Hz:bytes*20});
 }
 const pacing=[];
 for(const count of [0,14,40]) {
   const battle=SpinArena.game;
   battle.hazards=Array.from({length:count},(_,i)=>({owner:battle.actors[i%2],kind:'trail',x:Math.cos(i)*2,z:Math.sin(i)*2,radius:.55,left:1.5,tick:0}));
   const intervals=[];let last=null, frame=0;
   let timedOut=false;
   await new Promise(resolve=>{
     let finished=false;
     const timer=setTimeout(()=>{finished=true;timedOut=true;resolve();},5000);
     const draw=stamp=>{
       if(finished) return;
       if(last!==null && frame>10) intervals.push(stamp-last);
       last=stamp;
       SpinArena.draw();
       if(frame%3===0) applyNetwork(JSON.parse(JSON.stringify(captureNetwork())));
       if(++frame<90) window.benchmarkRAF(draw); else {finished=true;clearTimeout(timer);resolve();}
     };
     window.benchmarkRAF(draw);
   });
   pacing.push({count,timedOut,frameIntervals:stats(intervals)});
 }
 return {pacing,userAgent:navigator.userAgent,devicePixelRatio,viewport:[innerWidth,innerHeight],note:'Headless Chrome --disable-gpu, synchronous draw+readback timings, Pacing separately samples headless RAF with drawing and local snapshot round-trip, not physical phone FPS. Full scene uses OS reduced-motion preference, independent of isolated effect reduced flag.',cases};
})();
