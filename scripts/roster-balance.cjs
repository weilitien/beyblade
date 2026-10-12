// Fair paired simulations: same policy, seed and launch quality; swap both seats.
const fs=require('node:fs'),vm=require('node:vm');
global.window=global;
for(const f of ['war-data.js','war-engine.js']) vm.runInThisContext(fs.readFileSync(f,'utf8'));
const option=k=>process.argv.find(x=>x.startsWith(k+'='))?.split('=')[1];
if(process.argv.includes('--original')) for(const [id,stats] of Object.entries(WarData.originalStats)) Object.assign(WarData.characters[id],stats);
const adjustments=option('--adjustments');
if(adjustments) for(const [id,stats] of Object.entries(JSON.parse(fs.readFileSync(adjustments)))) Object.assign(WarData.characters[id],stats);
const seeds=Number(option('--seeds')||4),offset=Number(option('--offset')||0);
const roster=Object.keys(WarData.characters),policies=['mixed','signature'];
const results=Object.fromEntries(roster.map(id=>[id,{games:0,points:0,wins:0,draws:0,sidePoints:[0,0],policies:{mixed:{games:0,points:0},signature:{games:0,points:0}}}]));
const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const pairs=[];
for(let x=0;x<roster.length;x++)for(let y=x+1;y<roster.length;y++){
 const pair={a:roster[x],b:roster[y],games:0,points:0};
 for(const policy of policies)for(let seed=1+offset;seed<=seeds+offset;seed++)for(const side of [0,1]){
  const ids=side?[pair.b,pair.a]:[pair.a,pair.b];const g=new WarBattle(...ids,rng(seed));g.aiEnabled=false;g.start(.8,.8);
  let step=0;
  while(g.phase==='battle'&&step<14500){
   if(step%60===0)for(const i of seed%2?[0,1]:[1,0]){
    const common=Object.keys(WarData.common),a=g.actors[i];
    const priority=policy==='signature'?['signature']:['signature',...common.slice(seed%8),...common.slice(0,seed%8)];
    for(const id of priority)if(!g.reason(a,id)){g.use(a,id);break;}
   }
   g.tick(1/120);g.drainEvents();step++;
  }
  if(g.phase!=='result'||g.actors.some(a=>!Number.isFinite(a.hp)))throw Error('Invalid result');
  pair.games++;pair.points+=g.winner===null?.5:g.winner===side?1:0;
  ids.forEach((id,i)=>{const r=results[id],p=g.winner===null?.5:g.winner===i?1:0;r.games++;r.points+=p;r.sidePoints[i]+=p;r.wins+=g.winner===i?1:0;r.draws+=g.winner===null?1:0;r.policies[policy].games++;r.policies[policy].points+=p;});
 }
 pairs.push(pair);
}
for(const r of Object.values(results)){r.score=r.points/r.games;for(const p of Object.values(r.policies))p.score=p.points/p.games;}
const output={seeds,offset,step:1/120,policies,stats:Object.fromEntries(roster.map(id=>[id,Object.fromEntries(['attack','defense','hp','speed','stability','cost'].map(k=>[k,WarData.characters[id][k]]))])),results,pairs};
fs.writeFileSync(option('--output')||'/private/tmp/roster-balance.json',JSON.stringify(output,null,2)+'\n');
for(const [id,r]of Object.entries(results).sort((a,b)=>b[1].score-a[1].score))console.log(id,(r.score*100).toFixed(1),...policies.map(p=>(r.policies[p].score*100).toFixed(1)));
