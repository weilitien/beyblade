// Reproducible automated policy comparison; not a human-play win-rate estimate.
const fs = require('node:fs'), vm = require('node:vm');
global.window = global;
for (const file of ['war-data.js', 'war-engine.js']) vm.runInThisContext(fs.readFileSync(file, 'utf8'));
const signatureOnly = process.argv.includes("--signature-only");
const seeds = 30, dt = 1 / 120, records = [];
function rng(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
for (const subject of ['luxun', 'dianwei', 'huangzhong']) {
  for (const opponent of Object.keys(WarData.characters)) {
    const summary = {subject, opponent, games:0, wins:0, draws:0, sideWins:[0,0], seconds:0, maxHazards:0, casts:0, ends:{}};
    for (let seed = 1; seed <= seeds; seed++) for (const side of [0,1]) {
      const g = new WarBattle(side ? opponent : subject, side ? subject : opponent, rng(seed));
      g.aiEnabled = false; g.start(0.8,0.8);
      let step=0;
      while (g.phase === 'battle' && step < 14500) {
        // Same policy and cadence for both players; alternate first decision each sample.
        if (step % 60 === 0) for (const i of (seed%2 ? [0,1] : [1,0])) {
          const a=g.actors[i];
          const actions=signatureOnly ? ['signature'] : ['signature', ...Object.keys(WarData.common).slice(seed%8), ...Object.keys(WarData.common).slice(0,seed%8)];
          for (const action of actions) if (!g.reason(a,action)) { g.use(a,action); break; }
        }
        g.tick(dt); step++;
        summary.maxHazards=Math.max(summary.maxHazards,g.hazards.length);
        for (const e of g.drainEvents()) if (e.type==='skill' && e.actor===g.actors[side] && e.name===e.actor.c.signature) summary.casts++;
        if (g.actors.some(a=>!Number.isFinite(a.hp)||!Number.isFinite(a.x))) throw Error('Nonfinite combat state');
      }
      if (g.phase !== 'result') throw Error('Battle did not terminate');
      summary.games++; summary.seconds+=g.roundElapsed;
      if(g.winner===side) {summary.wins++;summary.sideWins[side]++;}
      if(g.winner===null) summary.draws++;
      summary.ends[g.finishKind]=(summary.ends[g.finishKind]||0)+1;
    }
    summary.meanSeconds=summary.seconds/summary.games;
    summary.winRate=summary.wins/summary.games;
    records.push(summary);
  }
}
const output={seeds,dt,policy:(signatureOnly ? 'Signature-only; ' : '')+'Signature-first, seed-rotated common skills every 0.5s; matched launch quality; swapped sides; alternating decision order',records};
fs.writeFileSync(signatureOnly ? 'reports/balance-signature-only.json' : 'reports/balance-results.json',JSON.stringify(output,null,2)+'\n');
for(const id of ['luxun','dianwei','huangzhong']) {
 const rows=records.filter(r=>r.subject===id && r.opponent!==id), games=rows.reduce((n,r)=>n+r.games,0);
 console.log(id,JSON.stringify({games,winRate:rows.reduce((n,r)=>n+r.wins,0)/games,meanSeconds:rows.reduce((n,r)=>n+r.seconds,0)/games,maxHazards:Math.max(...rows.map(r=>r.maxHazards))}));
}
