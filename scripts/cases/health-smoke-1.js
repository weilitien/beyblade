(() => {
  const a = SpinArena,
    g = a.game,
    checks = [],
    ok = (v, t) => {
      if (!v) throw Error(t);
      checks.push(t);
    };
  const start = () => {
    a.reset();
    a.launch();
    g.charge = 0.81;
    a.launch();
    for (let i = 0; i < 181; i++) a.simulate(1 / 120);
    g.aiEnabled = false;
  };
  for (const loser of [0, 1]) {
    start();
    const prefix = loser ? 'ai' : 'your';
    g.actors[loser].hp = 1;
    updateUI();
    g.hit(g.actors[1 - loser], g.actors[loser]);
    processEvents();
    ok(g.phase === 'result' && g.actors[loser].hp === 0, 'Lethal damage P' + (loser + 1));
    ok(
      document.getElementById(prefix + '-spin').textContent.startsWith('0 /'),
      'Zero HP label immediately P' + (loser + 1),
    );
    ok(
      document.getElementById(prefix + '-bar').style.width === '0%',
      'Zero bar immediately P' + (loser + 1),
    );
  }
  start();
  g.actors[0].hp = 0;
  g.actors[1].hp = 0;
  g.checkEnd();
  processEvents();
  ok(
    g.winner === null &&
      ['your', 'ai'].every((p) =>
        document.getElementById(p + '-spin').textContent.startsWith('0 /'),
      ),
    'Draw updates both HP labels',
  );
  start();
  g.actors[1].integrity = 0.01;
  g.hit(g.actors[0], g.actors[1]);
  processEvents();
  ok(
    g.finishKind === '爆裂終結' &&
      g.actors[1].hp > 0 &&
      !document.getElementById('ai-spin').textContent.startsWith('0 /'),
    'Burst preserves remaining HP',
  );
  start();
  const hp = g.actors[1].hp;
  g.end(0, '出界落敗');
  processEvents();
  ok(g.actors[1].hp === hp, 'Ring out preserves remaining HP');
  const s = JSON.parse(JSON.stringify(captureNetwork()));
  s.actors[1].hp = 0;
  s.actors[1].spin = 75;
  applyNetwork(s);
  ok(
    document.getElementById('ai-bar').style.width === '0%' &&
      document.getElementById('ai-spin').textContent.startsWith('0 /'),
    'Remote snapshot renders HP without stale derived spin',
  );
  return checks;
})();
