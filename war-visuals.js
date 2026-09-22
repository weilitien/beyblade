'use strict';
function project(x,y,z){return [width*.5+x*scale,height*.49+z*scale*.58-y*scale*.94];}
function floorY(x,z){return .04+(x*x+z*z)*.033;}
function path(points){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();}
function ringPoints(r,y){return Array.from({length:97},(_,i)=>project(Math.cos(i/96*TAU)*r,y,Math.sin(i/96*TAU)*r));}
function drawRing(r,y,color,line=1){path(ringPoints(r,y));ctx.strokeStyle=color;ctx.lineWidth=line;ctx.stroke();}
function stadium(){
  const base=project(0,-.4,0);ctx.save();ctx.translate(base[0],base[1]+20);ctx.scale(1,.55);const g=ctx.createRadialGradient(0,0,scale,0,0,scale*4.7);g.addColorStop(0,'#060c1699');g.addColorStop(1,'#060c1600');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,scale*4.7,0,TAU);ctx.fill();ctx.restore();
  path(ringPoints(4.12,.31));ctx.fillStyle='#0b1522';ctx.fill();
  for(let i=0;i<96;i++){const a=i/96*TAU,b=(i+1)/96*TAU;path([project(Math.cos(a)*4.08,.27,Math.sin(a)*4.08),project(Math.cos(b)*4.08,.27,Math.sin(b)*4.08),project(Math.cos(b)*4.08,.71,Math.sin(b)*4.08),project(Math.cos(a)*4.08,.71,Math.sin(a)*4.08)]);ctx.fillStyle=Math.sin(a)>0?'#283b53':'#22334a';ctx.fill();}
  path(ringPoints(4.08,.71));ctx.fillStyle='#2f4861';ctx.fill();path(ringPoints(3.76,.67));ctx.fillStyle='#172a3c';ctx.fill();
  for(let r=3.72;r>0;r-=.075){path(ringPoints(r,floorY(r,0)));const v=Math.round(28+(3.72-r)*2);ctx.fillStyle=`rgb(${v-9},${v+8},${v+23})`;ctx.fill();}
  drawRing(3.79,.68,'#7894a378',1.5);drawRing(4.07,.72,'#5d7c9277',1.5);drawRing(3.52,floorY(3.52,0),'#59819466',1);drawRing(2.8,floorY(2.8,0),'#47677f55',1);drawRing(1.8,floorY(1.8,0),'#48657955',1);drawRing(.65,floorY(.65,0),'#81c5c455',1);
  for(let i=0;i<24;i++){const a=i/24*TAU,p=project(Math.cos(a)*3.85,.72,Math.sin(a)*3.85),q=project(Math.cos(a)*4.01,.72,Math.sin(a)*4.01);ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.strokeStyle=i%3===0?'#71edcf':'#56778d';ctx.lineWidth=i%3===0?3:1;ctx.stroke();}
  for(let i=0;i<8;i++){const a=i/8*TAU;const p=project(Math.cos(a)*.9,.09,Math.sin(a)*.9),q=project(Math.cos(a)*3.4,floorY(3.4,0),Math.sin(a)*3.4);ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.strokeStyle='#35526b44';ctx.lineWidth=1;ctx.stroke();}
  const c=project(0,.075,0);ctx.save();ctx.translate(...c);ctx.scale(1,.58);ctx.rotate(Math.PI/4);ctx.strokeStyle='#5b8e9d66';ctx.strokeRect(-scale*.17,-scale*.17,scale*.34,scale*.34);ctx.restore();
}
function topMesh(t){
  if(t.dead&&t.burst)return;
  const y=floorY(t.x,t.z),p=project(t.x,y+.20,t.z);
  ctx.save();ctx.globalCompositeOperation='lighter';const glow=ctx.createRadialGradient(p[0],p[1],0,p[0],p[1],scale*.7);glow.addColorStop(0,t.color+'44');glow.addColorStop(1,t.color+'00');ctx.fillStyle=glow;ctx.beginPath();ctx.ellipse(p[0],p[1],scale*.70,scale*.40,0,0,TAU);ctx.fill();ctx.restore();
  TopArt.render(ctx,{x:p[0],y:p[1],size:scale*.41,angle:t.angle,tilt:.64,skin:t.skin});
  if(!t.dead){ctx.save();ctx.strokeStyle=t.color+'88';ctx.lineWidth=1.4;ctx.shadowColor=t.color;ctx.shadowBlur=7;ctx.beginPath();ctx.ellipse(p[0],p[1],scale*.50,scale*.29,0,t.angle,t.angle+Math.PI*1.15);ctx.stroke();ctx.restore();const center=project(t.x,y+.65,t.z);ctx.font='600 8px system-ui';ctx.textAlign='center';ctx.fillStyle=t.color;ctx.fillText(t.c.name,center[0],center[1]-9);ctx.fillStyle='#42566e';ctx.fillRect(center[0]-13,center[1]-4,26,2);ctx.fillStyle=t.color;ctx.fillRect(center[0]-13,center[1]-4,26*Math.max(0,t.integrity)/100,2);}
}
function draw(){ctx.clearRect(0,0,width,height);ctx.save();if(shake>.1&&!reduced.matches&&game.phase!=='paused')ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);stadium();drawBattleFields();for(const t of trail){const p=project(t.x,floorY(t.x,t.z)+.02,t.z);ctx.globalAlpha=t.life*.40;ctx.fillStyle=t.color;ctx.beginPath();ctx.ellipse(...p,scale*.22,scale*.13,0,0,TAU);ctx.fill();}ctx.globalAlpha=1;for(const t of [...tops].sort((a,b)=>a.z-b.z))topMesh(t);for(const w of shockwaves){const p=project(w.x,floorY(w.x,w.z)+.15,w.z),r=(1-w.life/w.max)*scale*1.2;ctx.globalAlpha=w.life/w.max;ctx.strokeStyle=w.color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(...p,r,r*.58,0,0,TAU);ctx.stroke();}ctx.globalCompositeOperation='lighter';for(const p of particleList){const xy=project(p.x,floorY(p.x,p.z)+p.y,p.z),tail=project(p.x-p.vx*.045,floorY(p.x,p.z)+p.y-p.vy*.045,p.z-p.vz*.045);ctx.globalAlpha=Math.min(1,p.life*2);ctx.strokeStyle=p.color;ctx.lineWidth=p.size;ctx.beginPath();ctx.moveTo(...tail);ctx.lineTo(...xy);ctx.stroke();ctx.fillStyle='#fff6d5';ctx.fillRect(xy[0],xy[1],p.size*.6,p.size*.6);}ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.restore();}
function resize(){const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);width=r.width;height=r.height;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);scale=Math.min(width/9.8,height/6.4);}
