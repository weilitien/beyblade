'use strict';
// Original geometric tops: machined blade bevels, layered resin, and vector crests.
// Shared by the live battle, loadout previews, and the inspect turntable.
window.TopArt = (()=>{
  const TAU=Math.PI*2;
  const skins={
    attack:{color:'#21ddd1',light:'#b9fff3',dark:'#056575',secondary:'#603de0',gold:'#edcd72',blades:3,crest:'dragon',title:'蒼龍・電光刃',code:'VS / 03',material:'三翼銀刃 × 翡翠晶體 × 紫晶軸心'},
    defense:{color:'#a577ff',light:'#ecd6ff',dark:'#39246d',secondary:'#53ce83',gold:'#cad6e8',blades:5,crest:'wolf',title:'銀狼・重裝盾',code:'IA / 05',material:'五重裝甲 × 紫晶底盤 × 碧綠軸心'},
    stamina:{color:'#38d8a6',light:'#ceffe6',dark:'#11635c',secondary:'#1579cc',gold:'#ffd967',blades:6,crest:'eagle',title:'翠鷹・永旋翼',code:'AD / 06',material:'六翼銀環 × 翡翠樹脂 × 黃金徽章'},
    rival:{color:'#ff573b',light:'#ffdab0',dark:'#8a162b',secondary:'#ff9624',gold:'#ffd45f',blades:3,crest:'phoenix',title:'烈焰・鳳凰刃',code:'EG / 03',material:'烈焰紅翼 × 黑銀刃環 × 琥珀軸心'}
  };
  function render(ctx,{x=0,y=0,size=100,angle=0,tilt=.66,skin='attack',explode=0}={}){
    const s=skins[skin]||skins.attack,faces=[],body=(skins[skin]||skins.attack).body||1,sin=Math.sin(tilt),cos=Math.cos(tilt),ca=Math.cos(angle),sa=Math.sin(angle);
    const world=p=>[p[0]*ca-p[2]*sa,p[1],p[0]*sa+p[2]*ca];
    const project=p=>[x+p[0]*size,y+(p[2]*sin-p[1]*cos)*size];
    const face=(ps,material='metal',color=null)=>{const v=ps.map(world);const a=v[0],b=v[1],c=v[2],u=b.map((n,i)=>n-a[i]),w=c.map((n,i)=>n-a[i]);let n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],len=Math.hypot(...n)||1;n=n.map(v=>v/len);faces.push({v,material,color,normal:n,depth:v.reduce((d,p)=>d+p[2]*cos+p[1]*sin,0)/v.length});};
    const polar=(r,a,h)=>[Math.cos(a)*r,h,Math.sin(a)*r];
    function band(r1,r2,h1,h2,material,color,n=48,gear=0){for(let i=0;i<n;i++){const a=i/n*TAU,b=(i+1)/n*TAU,ra=r1+(i%2?gear:0),rb=r1+((i+1)%2?gear:0);face([polar(ra,a,h1),polar(rb,b,h1),polar(r2,b,h2),polar(r2,a,h2)],material,color);}}
    // Fluted driver and translucent ratchet. Each layer has its own silhouette.
    band(.08,.15,-.82-explode*.55,-.59-explode*.55,'resin',s.secondary,20);band(.15,.22,-.59-explode*.55,-.25-explode*.55,'resin',s.secondary,20,.025);
    band(.22,.36,-.25-explode*.55,-.21-explode*.55,'resin',s.secondary,32);
    band(.65*body,.77*body,-.22-explode*.25,-.16-explode*.25,'resin',s.secondary,48,.04);
    band(.77*body,.82*body,-.16-explode*.25,-.035-explode*.25,'resin',s.color,48,.015);
    band(.82*body,.68*body,-.035-explode*.25,.00-explode*.25,'resin',s.light,48);
    band(.81*body,.92*body,.015,.075,'dark');band(.92*body,.94*body,.075,.125,'metal');band(.94*body,.75*body,.125,.16,'metal');
    band(.68*body,.80*body,.12,.20,'resin',s.color);band(.80*body,.52*body,.20,.29,'resin',s.color);
    const count=s.blades,sector=TAU/count;
    for(let k=0;k<count;k++){
      const a=k*sector,ex=explode*.3;
      // A swept claw, cut into three reflective bevels around a raised ridge.
      const outline=s.profile?s.profile.map(([r,t,h])=>polar(r,a+t*sector,h+ex)):[polar(.40,a+.12*sector,.28+ex),polar(.73,a-.04*sector,.29+ex),polar(1.05,a+.13*sector,.17+ex),polar(1.08,a+.35*sector,.19+ex),polar(.84,a+.62*sector,.28+ex),polar(.54,a+.72*sector,.29+ex)];
      const ridge=polar(.74,a+.31*sector,(s.ridge||.42)+ex);
      for(let i=0;i<outline.length;i++){const next=(i+1)%outline.length;face([outline[i],outline[next],ridge],'metal');const lo=outline[i].map((v,j)=>j===1?v-(s.thickness||.13):v),ln=outline[next].map((v,j)=>j===1?v-(s.thickness||.13):v);face([lo,ln,outline[next],outline[i]],i===2?'dark':'metal');}
      // Crystal inlays, polished edge strips and mechanical screws.
      const inset=[polar(.47,a+.73*sector,.285+ex),polar(.84*body,a+.69*sector,.23+ex),polar(.92*body,a+.83*sector,.20+ex),polar(.69,a+.99*sector,.29+ex)];
      face(inset,'resin',s.color);face([inset[0],inset[1],polar(.69,a+.80*sector,.37+ex)],'resin',s.light);
      face([polar(.80,a+.02*sector,.32+ex),polar(1.03,a+.15*sector,.21+ex),polar(.96,a+.19*sector,.255+ex)],'bright');
      const bolt=polar(.78,a+.46*sector,.36+ex);
      face(Array.from({length:8},(_,i)=>[bolt[0]+Math.cos(i/8*TAU)*.045,bolt[1],bolt[2]+Math.sin(i/8*TAU)*.045]),'dark');
      face([[bolt[0]-.029,bolt[1]+.003,bolt[2]-.008],[bolt[0]+.029,bolt[1]+.003,bolt[2]-.008],[bolt[0]+.029,bolt[1]+.003,bolt[2]+.008],[bolt[0]-.029,bolt[1]+.003,bolt[2]+.008]],'bright');
    }
    const crestHeight=.37+explode*.65;
    band(.35,.39,.24+explode*.65,crestHeight-.02,'gold',s.gold,48);band(.39,.34,crestHeight-.02,crestHeight+.005,'gold',s.gold,48);
    face(Array.from({length:48},(_,i)=>polar(.338,i/48*TAU,crestHeight)), 'crest');
    faces.sort((a,b)=>a.depth-b.depth);
    function polygon(v){ctx.beginPath();v.forEach((p,i)=>i?ctx.lineTo(...project(p)):ctx.moveTo(...project(p)));ctx.closePath();}
    for(const f of faces){
      if(f.material==='crest'){const center=project(world([0,crestHeight,0]));ctx.save();ctx.translate(...center);ctx.scale(size,size*sin);ctx.rotate(angle);crest(ctx,s);ctx.restore();continue;}
      polygon(f.v);const pts=f.v.map(project),xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
      const g=ctx.createLinearGradient(x0,y0,x1+.01,y1+.01),n=f.normal;
      const facing=Math.abs(n[0]*-.5+n[1]*.8+n[2]*-.4);
      if(f.material==='metal'){
        const palettes={silver:['#f7fcff','#aab8c5','#394858'],gunmetal:['#d0deeb','#58677b','#152135'],obsidian:['#b6acd0','#3e3755','#100f22'],gold:['#fff4cb','#d2ab58','#76532a'],rose:['#fff0e6','#d6a3a0','#6e424d'],ivory:['#ffffff','#eee6ce','#8c977d'],bronze:['#ffe2ba','#aa7952','#4e342c']};
        const [hi,mid,lo]=palettes[s.metal]||palettes.silver;
        const stops=facing>.52?[hi,mid,lo,hi,mid,lo]:[lo,mid,hi,mid,lo,mid];
        [0,.16,.38,.52,.74,1].forEach((t,i)=>g.addColorStop(t,stops[i]));
      }else if(f.material==='resin'){
        g.addColorStop(0,s.light);g.addColorStop(.18,f.color||s.color);g.addColorStop(.62,f.color===s.secondary?s.secondary:s.dark);g.addColorStop(1,f.color||s.color);
      }else if(f.material==='gold'){g.addColorStop(0,'#fff3c8');g.addColorStop(.30,f.color);g.addColorStop(.65,'#766127');g.addColorStop(1,'#ffe5a0');}
      else if(f.material==='bright'){g.addColorStop(0,'#ffffff');g.addColorStop(1,'#adbecb');}
      else{g.addColorStop(0,'#081323');g.addColorStop(.5,'#536272');g.addColorStop(1,'#111925');}
      ctx.fillStyle=g;ctx.fill();ctx.strokeStyle=f.material==='metal'?'#d3edff55':'#d2fbff22';ctx.lineWidth=size>60?.45:.2;ctx.stroke();
    }
  }
  function crest(ctx,s){
    const disc=ctx.createRadialGradient(-.1,-.1,0,0,0,.34);disc.addColorStop(0,s.dark);disc.addColorStop(1,'#071526');ctx.fillStyle=disc;ctx.beginPath();ctx.arc(0,0,.333,0,TAU);ctx.fill();
    ctx.strokeStyle=s.gold;ctx.lineWidth=.013;ctx.beginPath();ctx.arc(0,0,.305,0,TAU);ctx.stroke();
    for(let i=0;i<24;i++){const a=i/24*TAU;ctx.beginPath();ctx.moveTo(Math.cos(a)*.273,Math.sin(a)*.273);ctx.lineTo(Math.cos(a)*.29,Math.sin(a)*.29);ctx.stroke();}
    function poly(points,fill,stroke='#051523'){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=.015;ctx.stroke();}
    const line=(points,color=s.gold,width=.025)=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();};
    const circle=(x,y,r,fill)=>{ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fillStyle=fill;ctx.fill();};
    if(s.crest==='halberd'){
      poly([[-.025,.24],[-.025,-.13],[-.075,-.11],[0,-.26],[.075,-.11],[.025,-.13],[.025,.24]],s.gold);
      poly([[-.04,-.1],[-.19,-.2],[-.15,-.04],[-.06,.025],[-.04,-.015]],s.light);poly([[.04,-.1],[.19,-.2],[.15,-.04],[.06,.025],[.04,-.015]],s.light);
      line([[-.09,.1],[.09,.1]],s.color,.035);
    }else if(s.crest==='spear'){
      for(const a of [-.42,.42]){ctx.save();ctx.rotate(a);poly([[-.014,.24],[-.014,-.10],[-.065,-.10],[0,-.26],[.065,-.10],[.014,-.10],[.014,.24]],s.light);line([[-.06,-.07],[.07,-.015]],s.color,.04);ctx.restore();}
    }else if(s.crest==='serpent'){
      ctx.beginPath();ctx.moveTo(.13,-.14);ctx.bezierCurveTo(-.24,-.3,-.26,.04,-.02,.015);ctx.bezierCurveTo(.26,-.02,.17,.25,-.14,.19);ctx.strokeStyle=s.gold;ctx.lineWidth=.072;ctx.stroke();
      poly([[.04,-.17],[.19,-.21],[.23,-.12],[.13,-.07]],s.light);circle(.16,-.155,.015,s.color);line([[.2,-.1],[.25,-.055]],s.color,.015);
    }else if(s.crest==='bagua'){
      circle(0,0,.15,s.light);ctx.beginPath();ctx.arc(0,0,.15,-Math.PI/2,Math.PI/2);ctx.arc(0,.075,.075,Math.PI/2,-Math.PI/2,true);ctx.arc(0,-.075,.075,Math.PI/2,-Math.PI/2);ctx.fillStyle=s.dark;ctx.fill();circle(0,-.075,.024,s.light);circle(0,.075,.024,s.dark);
      for(let k=0;k<8;k++){ctx.save();ctx.rotate(k*TAU/8);for(let j=0;j<3;j++){let h=-.19-j*.026;if((k>>j)&1){line([[-.063,h],[-.015,h]],s.gold,.014);line([[.015,h],[.063,h]],s.gold,.014);}else line([[-.063,h],[.063,h]],s.gold,.014);}ctx.restore();}
    }else if(s.crest==='peach'){
      for(let i=0;i<5;i++){const a=i*TAU/5-Math.PI/2;circle(Math.cos(a)*.11,Math.sin(a)*.11,.09,'#f6b4d7');}circle(0,0,.05,s.gold);
      line([[-.16,.2],[.15,-.17]],s.light,.024);line([[.16,.2],[-.15,-.17]],s.light,.024);
    }else if(s.crest==='crown'){
      poly([[-.21,-.15],[-.11,-.045],[0,-.23],[.11,-.045],[.21,-.15],[.16,.15],[-.16,.15]],s.gold);line([[-.15,.075],[.15,.075]],s.dark,.024);poly([[0,-.09],[.045,-.02],[0,.04],[-.045,-.02]],s.color);
    }else if(s.crest==='raven'){
      poly([[-.26,-.15],[-.1,-.10],[.03,-.23],[.12,-.14],[.23,-.11],[.12,-.045],[.08,.05],[.20,.2],[0,.13],[-.18,.22],[-.08,.025],[-.2,-.02]],s.gold);
      poly([[-.19,-.12],[-.055,-.055],[.045,.07],[-.12,.14],[-.07,.02]],s.color);circle(.085,-.135,.015,s.light);
    }else if(s.crest==='lotus'){
      for(const a of [-.95,-.48,0,.48,.95]){ctx.save();ctx.rotate(a);ctx.beginPath();ctx.moveTo(0,.17);ctx.bezierCurveTo(-.15,.03,-.07,-.16,0,-.25);ctx.bezierCurveTo(.07,-.16,.15,.03,0,.17);ctx.fillStyle=a===0?s.light:s.color;ctx.fill();ctx.strokeStyle=s.gold;ctx.lineWidth=.013;ctx.stroke();ctx.restore();}line([[-.16,.2],[.16,.2]],s.gold,.018);
    }else if(s.crest==='horse'){
      poly([[-.15,.22],[-.12,.03],[-.2,-.035],[-.08,-.18],[-.04,-.26],[.015,-.17],[.10,-.23],[.09,-.11],[.21,-.035],[.17,.055],[.055,.035],[.12,.22]],s.light);poly([[-.04,-.13],[-.13,.015],[-.15,.20],[-.02,.10],[.025,-.09]],s.color);circle(.09,-.065,.018,s.gold);
    }else if(s.crest==='coffin'){
      poly([[-.09,-.24],[.09,-.24],[.18,-.11],[.12,.23],[-.12,.23],[-.18,-.11]],s.gold);poly([[-.06,-.19],[.06,-.19],[.12,-.09],[.08,.18],[-.08,.18],[-.12,-.09]],s.dark);line([[0,-.13],[0,.12]],s.light,.023);line([[-.07,-.055],[.07,-.055]],s.light,.023);
    }else if(s.crest==='eye'){
      poly([[-.25,0],[-.13,-.10],[0,-.15],[.13,-.10],[.25,0],[.13,.10],[0,.15],[-.13,.10]],s.gold);circle(0,0,.085,s.light);circle(0,0,.043,s.dark);line([[.12,-.23],[-.1,.23]],s.color,.042);
    }else if(s.crest==='anchor'){
      circle(0,-.17,.065,s.gold);circle(0,-.17,.03,s.dark);line([[0,-.11],[0,.19]],s.light,.039);line([[-.13,-.06],[.13,-.06]],s.gold,.031);line([[-.21,.02],[-.15,.14],[0,.21],[.15,.14],[.21,.02]],s.light,.04);poly([[-.24,.08],[-.22,-.035],[-.12,.035]],s.gold);poly([[.24,.08],[.22,-.035],[.12,.035]],s.gold);
    }else if(s.crest==='tiger'){
      poly([[-.21,-.20],[-.075,-.15],[.075,-.15],[.21,-.20],[.17,.02],[.1,.18],[0,.23],[-.1,.18],[-.17,.02]],s.gold);poly([[-.15,.035],[0,.085],[.15,.035],[.07,.17],[0,.20],[-.07,.17]],s.light);
      line([[0,-.13],[0,.025]],s.dark,.025);line([[-.07,-.085],[.07,-.085]],s.dark,.025);line([[-.15,-.015],[-.065,.025]],s.dark,.035);line([[.15,-.015],[.065,.025]],s.dark,.035);poly([[-.035,.09],[.035,.09],[0,.13]],s.dark);
    }else if(s.crest==='dragon'){
      poly([[-.24,.14],[-.11,.03],[-.21,-.05],[-.08,-.06],[-.16,-.25],[.01,-.15],[.13,-.23],[.11,-.08],[.24,-.015],[.17,.055],[.08,.05],[.02,.14],[-.11,.21]],'#e5f8ff');
      poly([[-.13,.13],[-.025,-.02],[-.045,-.16],[.055,-.09],[.14,-.025],[.025,.01],[.07,.105],[-.04,.15]],s.color);
      poly([[.025,-.045],[.10,-.02],[.025,.003]],'#ffdb64');
    }else if(s.crest==='wolf'){
      poly([[-.22,-.23],[-.05,-.15],[.04,-.16],[.22,-.24],[.15,-.035],[.20,.045],[.08,.15],[0,.23],[-.09,.15],[-.20,.05],[-.15,-.04]],'#e4ebff');
      poly([[-.14,-.09],[0,-.02],[.14,-.09],[.07,.09],[0,.17],[-.07,.09]],s.color);
      poly([[-.13,-.015],[-.035,.025],[-.06,.055]],'#ffec77');poly([[.13,-.015],[.035,.025],[.06,.055]],'#ffec77');
    }else{
      poly([[-.26,-.16],[-.08,-.10],[0,-.24],[.09,-.10],[.27,-.17],[.20,-.01],[.13,.015],[.20,.07],[.085,.10],[.03,.23],[-.05,.13],[-.20,.08],[-.11,.02],[-.22,-.01]],s.crest==='phoenix'?'#ffe78b':'#f4ffe8');
      poly([[-.15,-.07],[0,-.12],[.13,-.055],[.07,.0],[.11,.04],[.0,.15],[-.08,.015]],s.color);
      poly([[.04,-.09],[.15,-.035],[.045,-.01]],s.gold);
    }
    ctx.strokeStyle='#e6ffff77';ctx.lineWidth=.008;ctx.beginPath();ctx.arc(0,0,.317,Math.PI,Math.PI*1.8);ctx.stroke();
  }
  return {render,skins};
})();
