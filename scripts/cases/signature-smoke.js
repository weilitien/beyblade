(() => {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const sheet = document.createElement('canvas');
  sheet.width = 1200;
  sheet.height = 1250;
  const paint = sheet.getContext('2d');
  paint.fillStyle = '#09131f';
  paint.fillRect(0, 0, 1200, 1250);
  const ids = Object.keys(WarData.characters);
  const hashes = new Set();
  for (const [id, character] of Object.entries(WarData.characters))
    SignatureFX.prepare(id, character.color);
  const originalCreate = document.createElement.bind(document);
  let textureAllocations = 0;
  document.createElement = (...args) => {
    if (args[0] === 'canvas') textureAllocations++;
    return originalCreate(...args);
  };
  for (const [index, id] of ids.entries()) {
    SpinArena.select(id);
    SpinArena.game.start();
    SpinArena.simulate(0);
    SpinArena.game.aiEnabled = false;
    SpinArena.useSkill('signature');
    const snapshot = captureNetwork();
    assert(
      snapshot.signatureEffects.some((e) => e.id === id),
      id + ' lacks activation effect',
    );
    const preview = document.createElement('canvas');
    preview.width = 300;
    preview.height = 210;
    SignatureFX.draw(
      preview.getContext('2d'),
      (x, y, z) => [150 + x * 35, 110 + z * 20],
      60,
      [],
      [{ ...snapshot.signatureEffects[0], x: 0, z: 0, tx: 1, tz: 0, life: 0.75 }],
      0.5,
      false,
    );
    hashes.add(preview.toDataURL());
    const x = (index % 4) * 300,
      y = Math.floor(index / 4) * 250;
    paint.drawImage(preview, x, y);
    paint.fillStyle = WarData.characters[id].color;
    paint.font = '18px system-ui';
    paint.fillText(
      WarData.characters[id].name + ' · ' + SignatureFX.themes[id],
      x + 12,
      y + 225,
    );
    SpinArena.draw();
    SpinArena.reset();
    assert(captureNetwork().signatureEffects.length === 0, 'Reset must clear effects');
  }
  document.createElement = originalCreate;
  assert(
    textureAllocations === ids.length,
    'Warm effects reuse textures; only preview canvases are created',
  );
  assert(hashes.size === ids.length, 'Every character must have a distinct visual');
  SpinArena.select('guanyu');
  SpinArena.game.start();
  SpinArena.simulate(0);
  SpinArena.game.aiEnabled = false;
  SpinArena.useSkill('signature');
  SpinArena.game.hit(SpinArena.game.actors[1], SpinArena.game.actors[0]);
  SpinArena.simulate(0.01);
  assert(!SpinArena.game.actors[0].cast, 'Charge interrupted');
  assert(
    !captureNetwork().signatureEffects.some((e) => e.id === 'guanyu'),
    'Interrupted charge must clear its effect',
  );
  SpinArena.reset();
  SpinArena.game.start();
  SpinArena.simulate(0);
  SpinArena.game.aiEnabled = false;
  SpinArena.useSkill('signature');
  for (let i = 0; i < 250; i++) {
    SpinArena.game.actors.forEach((a, j) => {
      a.x = j ? 2 : -2;
      a.z = 0;
      a.vx = 0;
      a.vz = 0;
    });
    SpinArena.simulate(1 / 120);
  }
  assert(
    captureNetwork().signatureEffects.some(
      (e) => e.id === 'guanyu' && e.phase === 'release',
    ),
    'Completed charge must show actual slash',
  );
  SpinArena.pause();
  const life = captureNetwork().signatureEffects[0].life;
  SpinArena.simulate(0.5);
  assert(captureNetwork().signatureEffects[0].life === life, 'Pause must freeze effects');
  SignatureFX.draw(
    document.createElement('canvas').getContext('2d'),
    (x, y, z) => [100, 100],
    30,
    SpinArena.game.actors,
    captureNetwork().signatureEffects,
    0,
    true,
  );
  SpinArena.reset();
  document.body.replaceChildren(sheet);
  sheet.style.width = '1200px';
  return {
    characters: ids.length,
    uniqueVisuals: hashes.size,
    reset: true,
    interrupt: true,
    pause: true,
    reducedMotion: true,
  };
})();
