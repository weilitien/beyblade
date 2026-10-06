'use strict';
// Compact effect records are synchronized by the host; rendering never changes damage.
window.SignatureFX = (() => {
  const TAU = Math.PI * 2;
  // Actor.ai is the stable P2 marker, including in serialized host snapshots.
  function hazardStyle(fire) {
    const side = fire.owner.ai ? 1 : 0;
    return {
      side,
      color: side ? '#ff9952' : '#55ddd7',
      opacity: Math.max(0, Math.min(1, fire.left / (fire.kind === 'trail' ? 2 : 10))),
    };
  }
  const themes = {
    dianwei: '雙戟連擊',
    luxun: '連營流火',
    lubu: '戟刃三連',
    guanyu: '青龍偃月',
    zhangfei: '雷吼震波',
    zhaoyun: '銀槍護影',
    zhugeliang: '八卦星陣',
    liubei: '桃園雙援',
    caocao: '王令封印',
    simayi: '暗渦返噬',
    zhouyu: '赤焰火羽',
    diaochan: '幻舞蓮華',
    machao: '鐵騎疾馳',
    pangde: '死戰鐵甲',
    xiahou: '赤眼反攻',
    ganning: '錦帆鉤索',
    sunce: '霸王虎爪',
    huangzhong: '穿楊金弓',
  };
  const textures = new Map();
  const prepared = new Set();
  const bends = {
    dianwei: [0.65],
    luxun: [0.65],
    lubu: [0.65],
    guanyu: [0.9],
    zhaoyun: [0.45, 0.4],
    liubei: [0.65],
    caocao: [0.32],
    simayi: [1.2],
    zhouyu: [0.45],
    diaochan: [1.2],
    machao: [0.2],
    xiahou: [0.45],
    ganning: [1.15, 0.8],
    sunce: [0.5],
    huangzhong: [0.9],
  };
  // Rasterize expensive blur once, then reuse the small transparent texture.
  function texture(color, bend = null) {
    const key = color + ':' + bend;
    if (textures.has(key)) return textures.get(key);
    const surface = document.createElement('canvas');
    surface.width = surface.height = 192;
    const painter = surface.getContext('2d');
    painter.translate(96, 96);
    if (bend === null) {
      const gradient = painter.createRadialGradient(0, 0, 0, 0, 0, 96);
      gradient.addColorStop(0, '#fff8de');
      gradient.addColorStop(0.18, color);
      gradient.addColorStop(1, color + '00');
      painter.fillStyle = gradient;
      painter.fillRect(-96, -96, 192, 192);
    } else {
      const r = 64;
      const gradient = painter.createLinearGradient(-r, 0, r, 0);
      gradient.addColorStop(0, color + '00');
      gradient.addColorStop(0.5, color);
      gradient.addColorStop(0.83, '#fffbea');
      gradient.addColorStop(1, color + '00');
      painter.fillStyle = gradient;
      painter.shadowColor = color;
      painter.shadowBlur = 8;
      painter.beginPath();
      painter.moveTo(-r, 0);
      painter.bezierCurveTo(-r * 0.2, -r * bend, r * 0.7, -r * bend, r, 0);
      painter.bezierCurveTo(
        r * 0.45,
        -r * bend * 0.58,
        -r * 0.15,
        -r * bend * 0.45,
        -r,
        0,
      );
      painter.fill();
    }
    // Bounded even if future/custom palettes supply many colors.
    if (textures.size >= 96) textures.delete(textures.keys().next().value);
    textures.set(key, surface);
    return surface;
  }
  function prepare(id, color) {
    const key = id + ':' + color;
    if (prepared.has(key)) return;
    texture(color);
    for (const bend of bends[id] || []) texture(color, bend);
    if (prepared.size >= 64) prepared.clear();
    prepared.add(key);
  }
  function create(actor, target, phase = 'activate') {
    return {
      id: actor.id,
      owner: actor.ai ? 1 : 0,
      x: actor.x,
      z: actor.z,
      tx: target.x,
      tz: target.z,
      phase,
      life: 0.95,
      max: 0.95,
      color: actor.color,
      charges: actor.evades,
    };
  }
  // Filled energy volumes and tapered trails, computed from shared time (no random state).
  function cinematic(ctx, effect, radius, target, time, reduced) {
    const age = reduced ? 0.28 : 1 - effect.life / effect.max;
    const clock = reduced ? 0 : time;
    const color = effect.color;
    const ongoing = effect.phase === 'aura' || effect.phase === 'aim';
    ctx.save();
    ctx.globalAlpha *= ongoing ? 0.62 : 0.9;
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur = 0;
    ctx.shadowColor = color;
    const glow = (x, y, size, strength = 0.45) => {
      ctx.save();
      ctx.globalAlpha *= strength;
      ctx.drawImage(texture(color), x - size, y - size, size * 2, size * 2);
      ctx.restore();
    };
    const crescent = (angle, size, bend = 0.65) => {
      ctx.save();
      ctx.rotate(angle);
      const r = radius * size;
      ctx.drawImage(texture(color, bend), -r * 1.5, -r * 1.5, r * 3, r * 3);
      ctx.restore();
    };
    const ring = (size, angle = 0, segments = 48) => {
      ctx.save();
      ctx.rotate(angle);
      ctx.scale(1, 0.56);
      ctx.strokeStyle = color;
      ctx.lineWidth = radius * 0.025;
      ctx.beginPath();
      ctx.arc(0, 0, radius * size, 0, TAU);
      for (let i = 0; i < segments; i++) {
        const a = (i * TAU) / segments;
        ctx.moveTo(Math.cos(a) * radius * size, Math.sin(a) * radius * size);
        ctx.lineTo(
          Math.cos(a) * radius * (size + 0.1),
          Math.sin(a) * radius * (size + 0.1),
        );
      }
      ctx.stroke();
      ctx.restore();
    };
    const beam = (offset = 0, tint = color) => {
      const distance = Math.hypot(...target);
      if (distance < 1) return;
      ctx.save();
      ctx.rotate(Math.atan2(target[1], target[0]));
      const gradient = ctx.createLinearGradient(0, 0, distance, 0);
      gradient.addColorStop(0, tint + '00');
      gradient.addColorStop(0.5, tint);
      gradient.addColorStop(0.85, '#fffbe6');
      gradient.addColorStop(1, tint + '00');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, offset);
      ctx.quadraticCurveTo(distance * 0.45, offset - radius * 0.23, distance, 0);
      ctx.quadraticCurveTo(distance * 0.45, offset + radius * 0.08, 0, offset);
      ctx.fill();
      ctx.restore();
    };
    const shards = (count, spread = 1.8, flame = false) => {
      for (let i = 0; i < (reduced ? Math.min(count, 5) : count); i++) {
        const seed = (i * 0.61803398875) % 1;
        const pulse = ongoing ? (clock * 0.65 + seed) % 1 : (age + seed * 0.55) % 1;
        const angle = i * 2.39996;
        const x = flame
          ? (seed - 0.5) * radius * 2.6
          : Math.cos(angle) * radius * (0.4 + pulse * spread);
        const y = flame
          ? radius * (0.45 - pulse * 2.5)
          : Math.sin(angle) * radius * (0.4 + pulse * spread) * 0.6;
        const size = radius * (flame ? 0.13 : 0.045) * (1 - pulse * 0.65);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(flame ? Math.sin(clock + i) * 0.3 : angle);
        ctx.globalAlpha *= 1 - pulse * 0.7;
        ctx.fillStyle = i % 3 === 0 ? '#fff1ba' : color;
        ctx.beginPath();
        ctx.moveTo(0, -size * (flame ? 4 : 2));
        ctx.quadraticCurveTo(size * 1.6, 0, 0, size);
        ctx.quadraticCurveTo(-size, 0, 0, -size * (flame ? 4 : 2));
        ctx.fill();
        ctx.restore();
      }
    };
    // Each family has a different silhouette and movement, beyond its crest.
    switch (effect.id) {
      case 'dianwei':
        crescent(age * 0.7, 1.5);
        crescent(Math.PI + age * 0.7, 1.5);
        ring(0.85);
        break;
      case 'luxun':
        for (let i = 0; i < 4; i++) crescent(i * TAU / 4 + clock, 0.7 + age * 0.5);
        shards(12, true);
        break;
      case 'lubu':
        for (let i = 0; i < 3; i++) crescent(-0.6 + i * 0.55 + age * 0.8, 1.2 + i * 0.25);
        shards(16);
        break;
      case 'guanyu':
        crescent(-0.5 + age * 1.2, effect.phase === 'release' ? 2.3 : 1.25, 0.9);
        crescent(-0.65 + age * 1.2, effect.phase === 'release' ? 1.95 : 1.05, 0.9);
        if (effect.phase === 'release') beam();
        shards(14);
        break;
      case 'zhangfei':
        for (let i = 0; i < 3; i++) ring(0.6 + ((age + i * 0.3) % 1) * 1.7, 0, 12);
        shards(20, 2.6);
        break;
      case 'zhaoyun':
        for (let i = 0; i < (ongoing ? effect.charges : 3); i++) {
          const angle = clock * 1.5 + (i * TAU) / 3;
          crescent(angle, 1.5, 0.45);
          crescent(angle - 0.13, 1.35, 0.4);
        }
        shards(10);
        break;
      case 'zhugeliang':
        ring(1.7, clock * 0.25);
        ring(1.35, -clock * 0.35, 24);
        ring(0.7, 0, 8);
        for (let i = 0; i < 8; i++)
          glow(
            Math.cos((i * TAU) / 8 + clock * 0.2) * radius * 1.5,
            Math.sin((i * TAU) / 8 + clock * 0.2) * radius * 0.85,
            radius * 0.2,
            0.7,
          );
        break;
      case 'liubei':
        ctx.save();
        ctx.translate(-radius * 0.6, 0);
        crescent(-0.7, 1.4);
        ctx.restore();
        ctx.save();
        ctx.translate(radius * 0.6, 0);
        crescent(0.7, 1.4);
        ctx.restore();
        if (effect.phase === 'release') {
          beam(-radius * 0.35, '#58e4c4');
          beam(radius * 0.35, '#b59bff');
        }
        shards(12);
        break;
      case 'caocao':
        ctx.translate(...target);
        ring(1.35, 0, 24);
        for (let i = 0; i < 4; i++) {
          ctx.save();
          ctx.rotate((i * TAU) / 4);
          crescent(clock * 0.15, 1.5, 0.32);
          ctx.restore();
        }
        shards(12, 1.2);
        break;
      case 'simayi':
        for (let i = 0; i < 5; i++)
          crescent(-clock * 1.2 + (i * TAU) / 5, 0.65 + i * 0.2, 1.2);
        if (effect.phase === 'release') beam();
        shards(12, 1.1);
        break;
      case 'zhouyu':
        ctx.translate(...target);
        glow(0, 0, radius * 1.8, 0.6);
        shards(24, 1.6, true);
        crescent(0, 1.7, 0.45);
        break;
      case 'diaochan':
        for (let i = 0; i < 7; i++) {
          ctx.save();
          ctx.rotate(clock * 0.55 + (i * TAU) / 7);
          ctx.translate(0, -radius * 0.45);
          crescent(-Math.PI / 2, 0.85, 1.2);
          ctx.restore();
        }
        shards(15, 2);
        break;
      case 'machao':
        for (let i = 0; i < 4; i++) {
          ctx.save();
          ctx.translate(-radius * 0.6, i * radius * 0.22 - radius * 0.3);
          crescent(-0.2, 1.8, 0.2);
          ctx.restore();
        }
        if (effect.phase === 'release') beam();
        shards(12);
        break;
      case 'pangde':
        ring(1.1, 0, 6);
        ring(1.3, 0, 6);
        shards(16, 1.3);
        for (let i = 0; i < 6; i++)
          glow(
            Math.cos((i * TAU) / 6) * radius,
            Math.sin((i * TAU) / 6) * radius * 0.6,
            radius * 0.23,
          );
        break;
      case 'xiahou':
        crescent(-0.65, 1.5, 0.45);
        crescent(Math.PI - 0.65, 1.5, 0.45);
        glow(0, 0, radius * 0.65, 0.8);
        shards(16, 1.7);
        break;
      case 'ganning':
        crescent(-0.5 + age * 2, 1.8, 1.15);
        crescent(2.5 + age * 2, 1.1, 0.8);
        beam();
        shards(14);
        break;
      case 'sunce':
        for (let i = 0; i < 3; i++) {
          ctx.save();
          ctx.translate((i - 1) * radius * 0.4, 0);
          crescent(-0.8 + age * 0.7, 1.75, 0.5);
          ctx.restore();
        }
        shards(20, 2.1);
        break;
      case 'huangzhong':
        ring(1.3, 0, 12);
        crescent(Math.PI / 2, 1.4, 0.9);
        if (effect.phase === 'release') {
          beam();
          shards(18);
        } else shards(8, 1.1);
        break;
    }
    glow(0, 0, radius * 1.15, 0.18);
    ctx.restore();
  }
  function draw(ctx, project, scale, actors, effects, time, reduced, hazards = []) {
    // Sustained effects derive from authoritative status, so interruption removes them.
    const sustained = [];
    for (const actor of actors) {
      const opponent = actors.find((other) => other !== actor);
      if (!opponent) continue;
      const status = actor.status;
      if (
        ['lubu', 'machao', 'sunce'].includes(actor.pending?.kind) ||
        actor.cast ||
        actor.evades > 0 ||
        status.store > 0 ||
        status.death > 0 ||
        status.xiahouBoost > 0 || status.ferocity > 0 || status.fireTrail > 0
      ) {
        sustained.push({
          ...create(actor, opponent, actor.cast ? 'aim' : 'aura'),
          life: 0.7,
        });
      }
      if (status.reverse > 0)
        sustained.push({
          id: 'diaochan',
          x: actor.x,
          z: actor.z,
          tx: actor.x,
          tz: actor.z,
          color: '#f780d3',
          phase: 'aura',
          life: 0.6,
          max: 1,
        });
      if (actor.sealed)
        sustained.push({
          id: 'caocao',
          x: actor.x,
          z: actor.z,
          tx: actor.x,
          tz: actor.z,
          color: '#678dff',
          phase: 'aura',
          life: 0.7,
          max: 1,
        });
    }
    for (const fire of hazards) {
      const style = hazardStyle(fire);
      sustained.push({
        id: fire.kind === 'trail' ? 'luxun' : 'zhouyu',
        x: fire.x,
        z: fire.z,
        tx: fire.x,
        tz: fire.z,
        phase: 'aura',
        life: 0.5,
        max: 1,
        color: style.color,
        opacity: style.opacity,
      });
    }
    for (const effect of [...effects, ...sustained]) {
      const { id, phase } = effect;
      if (!themes[id]) continue;
      const origin = project(effect.x, 0.38, effect.z);
      const target = project(effect.tx, 0.38, effect.tz);
      const progress = 1 - effect.life / effect.max;
      const rotation = reduced ? 0 : time * 0.7;
      const radius = scale * (reduced ? 0.95 : 0.7 + progress * 0.5);
      ctx.save();
      ctx.translate(...origin);
      ctx.globalAlpha = Math.min(0.85, effect.life * 2) * (reduced ? 0.6 : 1) * (effect.opacity ?? 1);
      ctx.strokeStyle = effect.color;
      ctx.fillStyle = effect.color;
      ctx.lineWidth = Math.max(1.5, scale * 0.035);
      ctx.lineCap = 'round';
      // Avoid large bloom or full-screen flashes; keep the opponent readable.
      ctx.shadowColor = effect.color;
      ctx.shadowBlur = 0;
      cinematic(
        ctx,
        effect,
        radius,
        [target[0] - origin[0], target[1] - origin[1]],
        time,
        reduced,
      );
      // The crest is now a restrained inner detail, leaving energy trails dominant.
      ctx.globalAlpha *= 0.58;
      const line = (points) => {
        ctx.beginPath();
        points.forEach(([x, y], i) =>
          i ? ctx.lineTo(x * radius, y * radius) : ctx.moveTo(x * radius, y * radius),
        );
        ctx.stroke();
      };
      const arc = (r, start = 0, end = TAU) => {
        ctx.beginPath();
        ctx.ellipse(0, 0, r * radius, r * radius * 0.62, 0, start, end);
        ctx.stroke();
      };
      const ray = (angle, start, end) =>
        line([
          [Math.cos(angle) * start, Math.sin(angle) * start * 0.62],
          [Math.cos(angle) * end, Math.sin(angle) * end * 0.62],
        ]);
      const link = () => {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(target[0] - origin[0], target[1] - origin[1]);
        ctx.stroke();
      };
      switch (id) {
        case 'lubu':
          for (let i = 0; i < 3; i++) {
            const offset = (i - 1) * 0.4;
            line([
              [-0.7 + offset, 0.55],
              [0.3 + offset, -0.7],
              [0.55 + offset, -0.55],
            ]);
          }
          break;
        case 'guanyu':
          if (phase === 'release') {
            ctx.lineWidth *= 2;
            arc(1.7, -2.8, 0.3);
            arc(1.35, -2.6, 0.1);
            link();
          } else {
            arc(1, rotation, rotation + 4.5);
            line([
              [-0.55, 0.6],
              [0.5, -0.65],
              [0.8, -0.4],
              [0.5, -0.2],
            ]);
          }
          break;
        case 'zhangfei':
          for (let i = 0; i < 3; i++) arc(0.7 + i * 0.4);
          for (let i = 0; i < 8; i++) {
            const angle = (i * TAU) / 8;
            ray(angle, 1.1, 1.6);
          }
          break;
        case 'zhaoyun':
          for (let i = 0; i < (phase === 'aura' ? effect.charges : 3); i++) {
            const angle = rotation + (i * TAU) / 3;
            ctx.save();
            ctx.rotate(angle);
            line([
              [-0.35, -0.9],
              [0.4, -0.9],
              [0.2, -1.05],
              [0.4, -0.9],
              [0.2, -0.75],
            ]);
            ctx.restore();
          }
          arc(0.8);
          break;
        case 'zhugeliang':
          arc(1.35);
          arc(0.9);
          arc(0.3);
          for (let i = 0; i < 8; i++) {
            ctx.save();
            ctx.rotate((i * TAU) / 8 + rotation * 0.2);
            line([
              [-0.2, -1],
              [0.2, -1],
            ]);
            if (i % 2) {
              line([
                [-0.2, -1.15],
                [-0.05, -1.15],
              ]);
              line([
                [0.05, -1.15],
                [0.2, -1.15],
              ]);
            } else
              line([
                [-0.2, -1.15],
                [0.2, -1.15],
              ]);
            ctx.restore();
          }
          break;
        case 'liubei':
          // Two distinct allied blades flank the caster; strikes follow summon events.
          for (const side of [-1, 1]) {
            ctx.strokeStyle = side < 0 ? '#58e4c4' : '#b59bff';
            line([
              [side * 0.6, 0.5],
              [side * 1.1, -0.65],
              [side * 0.85, -0.45],
            ]);
          }
          ctx.strokeStyle = effect.color;
          arc(0.65);
          if (phase === 'release') link();
          break;
        case 'caocao':
          if (phase !== 'aura')
            ctx.translate(target[0] - origin[0], target[1] - origin[1]);
          line([
            [-0.8, -0.5],
            [-0.4, -0.15],
            [0, -0.7],
            [0.4, -0.15],
            [0.8, -0.5],
            [0.65, 0.3],
            [-0.65, 0.3],
            [-0.8, -0.5],
          ]);
          line([
            [-0.65, 0.5],
            [0.65, 0.5],
          ]);
          arc(1.1);
          break;
        case 'simayi':
          for (let i = 0; i < 4; i++)
            arc(0.4 + i * 0.24, rotation + i, rotation + i + 3.8);
          if (phase === 'release') {
            link();
            arc(1.6);
          }
          break;
        case 'zhouyu':
          ctx.translate(target[0] - origin[0], target[1] - origin[1]);
          for (let i = 0; i < 7; i++) {
            const x = (i - 3) * 0.27;
            line([
              [x - 0.12, 0.4],
              [x - 0.25, -0.15],
              [x, -0.9 - (i % 3) * 0.15],
              [x + 0.08, -0.1],
              [x + 0.2, 0.4],
            ]);
          }
          arc(1.2);
          break;
        case 'diaochan':
          for (let i = 0; i < 6; i++) {
            const angle = (i * TAU) / 6 + rotation;
            ctx.save();
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.ellipse(0, -radius * 0.6, radius * 0.22, radius * 0.5, 0, 0, TAU);
            ctx.stroke();
            ctx.restore();
          }
          break;
        case 'machao':
          for (let i = 0; i < 3; i++)
            line([
              [-1.6 - i * 0.2, 0.5 - i * 0.35],
              [-0.3, 0.3 - i * 0.35],
            ]);
          line([
            [-0.5, 0.6],
            [0.15, -0.75],
            [0.65, -0.45],
            [0.25, -0.1],
            [0.7, 0.4],
          ]);
          if (phase === 'release') link();
          break;
        case 'pangde':
          line([
            [-0.55, -0.8],
            [0.55, -0.8],
            [0.8, -0.3],
            [0.45, 0.85],
            [-0.45, 0.85],
            [-0.8, -0.3],
            [-0.55, -0.8],
          ]);
          line([
            [-0.35, -0.3],
            [0.35, 0.3],
          ]);
          line([
            [0.35, -0.3],
            [-0.35, 0.3],
          ]);
          for (let i = 0; i < 6; i++) ray((i * TAU) / 6, 1, 1.3);
          break;
        case 'xiahou':
          line([
            [-1, 0],
            [-0.5, -0.45],
            [0.5, -0.45],
            [1, 0],
            [0.5, 0.45],
            [-0.5, 0.45],
            [-1, 0],
          ]);
          arc(0.27);
          line([
            [0.65, -0.7],
            [-0.3, 0.7],
          ]);
          break;
        case 'ganning':
          if (phase !== 'aura') link();
          line([
            [0, -0.8],
            [0, 0.7],
            [-0.65, 0.1],
            [-0.65, -0.1],
          ]);
          line([
            [0, 0.7],
            [0.65, 0.1],
            [0.65, -0.1],
          ]);
          arc(0.25);
          break;
        case 'sunce':
          for (let i = 0; i < 3; i++)
            line([
              [-0.8 + i * 0.45, -0.65],
              [-0.35 + i * 0.45, 0],
              [-0.6 + i * 0.45, 0.8],
            ]);
          arc(1.2, -2.8, -0.35);
          break;
        case 'huangzhong':
          arc(0.95, Math.PI * 0.5, Math.PI * 1.5);
          line([
            [0, -0.6],
            [0.35, 0],
            [0, 0.6],
          ]);
          line([
            [-0.5, 0],
            [0.8, 0],
            [0.55, -0.2],
          ]);
          if (phase === 'release') link();
          break;
      }
      ctx.restore();
    }
  }
  return { themes, create, draw, prepare, hazardStyle };
})();
