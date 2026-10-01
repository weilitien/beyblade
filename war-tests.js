'use strict';
window.runWarTests = () => {
  const checks = [],
    assert = (v, name) => {
      if (!v) throw Error(name);
      checks.push(name);
    },
    near = (a, b) => Math.abs(a - b) < 0.001;
  const duel = (a = 'liubei', b = 'diaochan', rng = () => 0.99) => {
    const g = new WarBattle(a, b, rng);
    g.aiEnabled = false;
    g.start();
    return g;
  };
  const cast = (g, id = 'signature', index = 0) => g.use(g.actors[index], id);
  const advance = (g, seconds) => {
    for (let i = 0; i < Math.ceil(seconds / 0.01) && g.phase === 'battle'; i++) {
      g.actors.forEach((a, j) => {
        a.x = j ? 2 : -2;
        a.z = 0;
        a.vx = 0;
        a.vz = 0;
      });
      g.tick(0.01);
    }
  };
  assert(Object.keys(WarData.characters).length === 18, '18 位角色齊全');
  assert(Object.keys(WarData.common).length === 8, '8 招通用技齊全');
  const exact = {
    machao: [88, 45, 900, 100, 92, 50],
    pangde: [80, 60, 1000, 100, 55, 75],
    xiahou: [75, 78, 1200, 100, 45, 85],
    ganning: [72, 42, 900, 100, 85, 45],
    sunce: [90, 55, 1000, 100, 70, 60],
  };
  for (const [id, stats] of Object.entries(exact)) {
    const c = WarData.characters[id];
    assert(
      JSON.stringify([c.attack, c.defense, c.hp, c.mana, c.speed, c.stability]) ===
        JSON.stringify(stats) && !c.provisional,
      id + ' 採用文件原值',
    );
  }
  assert(
    Object.values(WarData.characters).filter((c) => c.provisional).length === 13,
    '其餘十三位明示暫定數值',
  );
  let g = duel(),
    [a, b] = g.actors;
  assert(near(g.damageFormula(80, 1.5, 60), 75), '遞減防禦傷害公式');
  a.mana = 20;
  b.mana = 20;
  const dealt = g.hit(a, b, 1);
  assert(near(dealt, (60 * 100) / 140), '基本攻擊套用公式');
  assert(a.mana === 23 && b.mana === 26, '命中與受擊魔法回復不同');
  g = duel();
  [a, b] = g.actors;
  a.mana = 0;
  assert(!cast(g, 'storm').ok && a.mana === 0, '魔法不足不扣費');
  g = duel();
  [a, b] = g.actors;
  cast(g, 'storm');
  assert(near(g.attack(a), 78) && a.mana === 50, '螺旋風暴30%攻擊');
  advance(g, 8.01);
  assert(g.has(a, 'weak') && !g.has(a, 'storm'), '風暴結束進入虛弱');
  g = duel();
  [a, b] = g.actors;
  cast(g, 'rush');
  assert(
    a.pending.multiplier === 1.5 && Math.hypot(a.vx, a.vz) > 5.9,
    '疾風衝撞有方向與倍率',
  );
  g = duel();
  [a, b] = g.actors;
  cast(g, 'center');
  assert(a.x === 0 && a.z === 0 && g.has(a, 'center'), '赤道中心定位');
  assert(g.reason(a, 'rush') !== '', '中心不可連續出招');
  assert(
    near(g.hit(b, a, 1), ((b.c.attack * 100) / (100 + a.c.defense)) * 0.5),
    '中心減傷',
  );
  g = duel();
  [a, b] = g.actors;
  cast(g, 'edge');
  assert(near(g.defense(a), a.c.defense * 0.7), '邊緣滑行降低防禦');
  g = duel();
  [a, b] = g.actors;
  cast(g, 'wall');
  assert(
    near(g.hit(b, a), ((b.c.attack * 100) / (100 + a.c.defense)) * 0.6),
    '鐵壁減傷40%',
  );
  g = duel();
  [a, b] = g.actors;
  cast(g, 'reflect');
  const hp = b.hp,
    damage = g.hit(b, a);
  assert(
    near(hp - b.hp, damage * 0.5) && !g.has(a, 'reflect'),
    '反震只消耗一次並反彈50%',
  );
  g = duel();
  [a, b] = g.actors;
  cast(g, 'wind');
  assert(b.status.slow === 6, '逆風持續6秒');
  g = duel();
  [a, b] = g.actors;
  cast(g, 'siphon');
  assert(a.mana === 85 && b.mana === 85, '吸魔先消耗30再偷15');
  g = duel('guanyu');
  [a, b] = g.actors;
  cast(g);
  assert(a.cast.left === 2, '關羽蓄力2秒');
  g.hit(b, a);
  assert(a.cast === null, '受擊中斷關羽');
  g = duel('guanyu');
  [a, b] = g.actors;
  cast(g);
  const bhp = b.hp;
  advance(g, 2.01);
  assert(near(bhp - b.hp, (85 * 2 * 100) / (100 + b.c.defense * 0.7)), '青龍忽略30%防禦');
  g = duel('zhangfei', 'machao');
  [a, b] = g.actors;
  cast(g, 'signature', 1);
  cast(g);
  assert(!b.cast && g.has(b, 'root') && g.has(b, 'roarSlow'), '張飛中斷馬超助跑並封位移');
  b.globalCooldown = 0;
  b.cooldowns.signature = 0;
  assert(g.reason(b, 'signature').includes('禁止位移'), '震懾封鎖馬超位移技能');
  g = duel('zhaoyun', 'guanyu');
  [a, b] = g.actors;
  cast(g);
  const ahp = a.hp;
  g.hit(b, a);
  g.hit(b, a);
  b.cast = { kind: 'guanyu', left: 2 };
  g.hit(b, a);
  assert(
    a.hp === ahp && a.evades === 0 && b.hp < b.maxHp && !b.cast,
    '趙雲三次免傷反擊中斷蓄力',
  );
  g = duel('zhugeliang', 'caocao', () => 0);
  [a, b] = g.actors;
  cast(g);
  assert(a.mana === 0 && g.winner === 0, '心之一方消耗全部魔法並可擊倒');
  g = duel('zhugeliang');
  [a, b] = g.actors;
  a.mana = 29;
  assert(!cast(g).ok, '心之一方原型最低30魔法');
  a.hp = 100;
  g.tick(0.01);
  assert(a.behindCount === 1, '進入落後狀態增加成功率');
  g.tick(0.01);
  assert(a.behindCount === 1, '持續落後不每幀疊加');
  g = duel('caocao', 'zhugeliang');
  [a, b] = g.actors;
  cast(g);
  assert(a.mana === 70 && b.mana === 80 && b.sealed, '曹操偷魔與封招');
  const mana = b.mana;
  assert(!cast(g, 'signature', 1).ok && !b.sealed && b.mana === mana, '封鎖下一招不扣費');
  g = duel('simayi');
  [a, b] = g.actors;
  cast(g);
  const d = g.hit(b, a),
    hp2 = b.hp;
  advance(g, 6.01);
  assert(near(hp2 - b.hp, d * 1.5), '司馬懿返還實際承伤1.5倍');
  g = duel('liubei');
  [a, b] = g.actors;
  a.hp -= 300;
  cast(g);
  assert(near(a.hp, a.maxHp - 300 + a.maxHp * 0.08), '劉備回復8%');
  const before = b.hp;
  advance(g, 1.2);
  assert(b.hp < before && !a.sequence, '兩次援軍攻擊完成');
  g = duel('zhouyu');
  [a, b] = g.actors;
  cast(g);
  assert(g.hazards[0].left === 10, '周瑜留下10秒火區');
  const fireHp = b.hp;
  b.vx = b.vz = 0;
  g.tick(0.01);
  assert(b.hp < fireHp, '火區內持續受傷');
  g = duel('diaochan');
  [a, b] = g.actors;
  cast(g);
  const beforeB = b.hp;
  const reverseDamage = g.hit(b, a);
  assert(near(beforeB - b.hp, reverseDamage * 0.25), '貂蟬反轉造成25%反噬');
  g = duel('machao');
  [a, b] = g.actors;
  cast(g);
  advance(g, 3.01);
  assert(a.pending?.multiplier === 2, '馬超完成助跑為2倍衝撞');
  g = duel('pangde');
  [a, b] = g.actors;
  a.hp = a.maxHp * 0.29;
  a.mana = 0;
  assert(cast(g).ok && a.mana === 0 && g.has(a, 'immovable'), '龐德低血免費且免擊退');
  a.globalCooldown = 0;
  assert(g.reason(a, 'wall').includes('禁止防禦'), '死戰禁止防禦技');
  g = duel('xiahou');
  [a, b] = g.actors;
  a.hp -= 100;
  g.set(a, 'reverse', 5);
  g.set(a, 'root', 4);
  a.sealed = false;
  cast(g);
  assert(
    !g.has(a, 'reverse') &&
      !g.has(a, 'root') &&
      near(a.hp, a.maxHp - 40) &&
      near(g.attack(a), 105),
    '夏侯惇清負面補5%並加攻40%',
  );
  g = duel('ganning');
  [a, b] = g.actors;
  g.set(b, 'center', 5);
  b.x = b.z = 0;
  cast(g);
  assert(
    !g.has(b, 'center') && Math.hypot(b.x, b.z) > 0.8 && b.mana < 100,
    '甘寧拉出中心並偷魔',
  );
  g = duel('sunce');
  [a, b] = g.actors;
  assert(
    near(g.hit(a, b, 1), (90 * 1.2 * 100) / (100 + b.c.defense)),
    '孫策首次命中+20%',
  );
  g = duel('sunce');
  [a, b] = g.actors;
  b.x = 3.2;
  b.z = 0;
  g.hit(a, b, 1.8, { kind: 'sunce' });
  assert(g.winner === 0 && g.finishKind.includes('出界'), '霸王突擊僅外圈直接出界');
  g = duel('sunce');
  [a, b] = g.actors;
  b.x = 0;
  g.hit(a, b, 1.8, { kind: 'sunce' });
  assert(g.phase === 'battle', '中心不受霸王直接出界');
  g = duel('lubu');
  [a, b] = g.actors;
  cast(g);
  advance(g, 1.5);
  assert(!a.sequence && g.has(a, 'unstable'), '呂布三段追擊後穩定下降');
  g = duel();
  [a, b] = g.actors;
  g.pause();
  const t = g.time,
    x = a.x;
  g.tick(0.05);
  assert(g.time === t && a.x === x, '暫停凍結移動與技能時鐘');
  g.pause();
  assert(g.phase === 'battle', '可繼續戰鬥');
  g = duel();
  [a, b] = g.actors;
  a.x = 3.55;
  a.z = 0;
  a.vx = 6;
  g.tick(0.01);
  assert(g.winner === 1 && g.finishKind === '出界落敗', '物理出界直接落敗');
  g = duel();
  [a, b] = g.actors;
  b.integrity = 0.01;
  g.hit(a, b);
  assert(g.winner === 0 && b.burst, '累積傷害可爆裂');
  g = duel();
  [a, b] = g.actors;
  g.roundElapsed = 119.99;
  a.hp = a.maxHp * 0.9;
  b.hp = b.maxHp * 0.5;
  g.tick(0.02);
  assert(g.winner === 0 && g.finishKind.includes('限時'), '限時依剩餘生命比例');
  for (const id of Object.keys(WarData.characters)) {
    g = duel(id, 'lubu');
    g.aiEnabled = true;
    for (let i = 0; i < 15000 && g.phase === 'battle'; i++) g.tick(0.01);
    assert(
      g.phase === 'result' &&
        g.actors.every(
          (a) =>
            Number.isFinite(a.hp) && a.mana >= 0 && a.mana <= 100 && Number.isFinite(a.x),
        ),
      id + ' 可完成對戰且數值有限',
    );
  }
  g = new WarBattle('guanyu', 'lubu');
  g.aiEnabled = false;
  g.start(0.25, 0.9);
  assert(
    near(g.actors[0].vx, 3.3) && near(g.actors[1].vx, -4.6),
    '雙方初速分別採用各自蓄力值',
  );
  assert(!g.aiEnabled, '開始對戰不啟用已關閉的 AI');
  g.reset();
  assert(!g.aiEnabled, '重新選將保留 AI 關閉狀態');
  g.start(0.25);
  assert(near(g.actors[1].vx, -3.7), '單人對手保留原初速');
  g = duel('huangzhong', 'diaochan');
  advance(g, 0.01);
  const archer = g.actors[0],
    target = g.actors[1];
  const beforeArrow = target.hp;
  assert(cast(g).ok && archer.cast.kind === 'huangzhong', '黃忠開始瞄準蓄力');
  assert(near(archer.mana, 55), '黃忠消耗 45 魔法');
  advance(g, 0.5);
  assert(near(target.hp, beforeArrow), '蓄力未完成不會造成傷害');
  advance(g, 0.51);
  assert(
    near(
      beforeArrow - target.hp,
      g.damageFormula(archer.c.attack, 2.4, target.c.defense * 0.8),
    ),
    '百步穿楊命中與穿防傷害',
  );
  assert(
    g.events.some((e) => e.type === 'arrow'),
    '射擊產生可同步的箭光事件',
  );
  g = duel('huangzhong', 'diaochan');
  advance(g, 0.01);
  cast(g);
  g.actors[0].cast.dx = 0;
  g.actors[0].cast.dz = 1;
  const missedHp = g.actors[1].hp;
  advance(g, 1.01);
  assert(
    near(g.actors[1].hp, missedHp) && g.events.some((e) => e.type === 'miss'),
    '離開瞄準射線可躲避',
  );
  g = duel('huangzhong', 'diaochan');
  cast(g);
  g.hit(g.actors[1], g.actors[0]);
  assert(!g.actors[0].cast, '黃忠受擊中斷蓄力');
  advance(g, 1.1);
  assert(!g.events.some((e) => e.type === 'arrow'), '中斷後不會殘留射擊');
  g = duel('dianwei');
  [a, b] = g.actors;
  cast(g);
  assert(a.mana === 60 && a.status.ferocity === 8, '典韋啟動消耗40魔法且持續8秒');
  const basicDamage = g.damageFormula(a.c.attack, 1, b.c.defense);
  assert(near(g.hit(a, b, 1, {contact:true}), basicDamage * 1.15), '典韋首次碰撞即增加15%');
  b.hp = b.maxHp;
  g.hit(a, b, 1, {contact:true});
  g.hit(a, b, 1, {contact:true});
  assert(near(g.hit(a, b, 1, {contact:true}), basicDamage * 1.6), '典韋四層增加60%');
  b.hp = b.maxHp;
  assert(near(g.hit(a, b, 1, {contact:true}), basicDamage * 1.6) && a.ferocityStacks === 4, '典韋層數不超過4');
  b.hp = b.maxHp;
  assert(near(g.hit(a, b), basicDamage) && a.ferocityStacks === 4, '非碰撞傷害不享受或增加連擊');
  b.evades = 1;
  a.ferocityStacks = 0;
  g.hit(a, b, 1, {contact:true});
  assert(a.ferocityStacks === 0, '閃避不增加連擊');
  a.ferocityStacks = 4;
  a.x=-2; b.x=2; a.z=b.z=0;
  g.tick(0.01);
  assert(a.ferocityStacks === 0, '拉開距離清除連擊');
  a.ferocityStacks=4; a.status.ferocity=0.005;
  g.tick(0.01);
  assert(!a.status.ferocity && a.ferocityStacks===0, '連擊到期清除層數');
  g = duel('luxun');
  [a,b] = g.actors;
  cast(g);
  assert(a.mana === 55 && a.status.fireTrail === 6, '陸遜消耗45魔法且持續6秒');
  a.x=-2; a.z=0; b.x=2; b.z=0;
  a.fireTrailPoint={x:-2,z:0}; a.vx=a.vz=0;
  g.tick(0.01);
  assert(g.hazards.length===0, '靜止不產生火痕');
  a.x=-1; a.vx=a.vz=0;
  g.tick(0.01);
  assert(g.hazards.length===1 && g.hazards[0].kind==='trail', '移動後留下火痕');
  g.hazards = [0,1,2].map(() => ({owner:a,x:b.x,z:b.z,radius:0.55,left:2,tick:0,kind:'trail'}));
  const fireDamage=g.damageFormula(a.c.attack,0.25,b.c.defense);
  const beforeFire=b.hp;
  g.tick(0.01);
  assert(near(beforeFire-b.hp,fireDamage), '重疊火痕僅造成一次傷害');
  g.tick(0.01);
  assert(near(beforeFire-b.hp,fireDamage), '火痕傷害間隔至少0.5秒');
  a.status.fireTrail=0;
  g.hazards.forEach(f=>f.left=0.005);
  g.tick(0.01);
  assert(g.hazards.length===0, '到期火痕移除');
  g.reset();
  assert(g.hazards.length===0 && !g.actors[0].status.fireTrail, '重置不殘留火痕');
  // Exercise actual collision plumbing, not just the damage helper.
  g=duel('dianwei'); [a,b]=g.actors; cast(g);
  a.x=-0.3;b.x=0.3;a.z=b.z=0;a.vx=2;b.vx=-2;
  g.collide();
  assert(a.ferocityStacks===1, '實際碰撞會啟動典韋連擊');
  return checks;
};
try {
  const checks = runWarTests();
  document.getElementById('result').textContent =
    checks.map((x) => 'PASS ' + x).join('\n') +
    '\n\n' +
    checks.length +
    ' checks passed.';
  window.testResults = checks;
} catch (e) {
  document.getElementById('result').textContent = 'FAIL ' + e.message;
  window.testError = e.message;
  throw e;
}
