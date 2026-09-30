(() => {
  const surface = document.createElement('canvas');
  surface.width = 780;
  surface.height = 500;
  const painter = surface.getContext('2d', { willReadFrequently: true });
  for (const [id, character] of Object.entries(WarData.characters))
    SignatureFX.prepare(id, character.color);
  const results = {};
  for (const [name, ids] of [
    ['duel', ['guanyu', 'diaochan']],
    ['busy', ['zhugeliang', 'zhouyu', 'zhaoyun', 'lubu', 'simayi', 'sunce']],
  ]) {
    const effects = ids.map((id, i) => ({
      id,
      owner: i % 2,
      x: i % 2 ? 1 : -1,
      z: 0,
      tx: 0,
      tz: 0,
      life: 0.7,
      max: 0.95,
      color: WarData.characters[id].color,
      phase: 'release',
      charges: 3,
    }));
    const samples = [];
    for (let frame = 0; frame < 32; frame++) {
      const start = performance.now();
      painter.clearRect(0, 0, 780, 500);
      SignatureFX.draw(
        painter,
        (x, y, z) => [390 + x * 90, 250 + z * 55],
        90,
        [],
        effects,
        frame / 60,
        false,
      );
      painter.getImageData(0, 0, 780, 500);
      samples.push(performance.now() - start);
    }
    const sorted = samples.slice(2).sort((a, b) => a - b);
    results[name] = { firstMs: samples[0], medianMs: sorted[15], p95Ms: sorted[28] };
  }
  return results;
})();
