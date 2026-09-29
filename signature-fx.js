'use strict';
// Compact effect records are synchronized by the host; rendering never changes damage.
window.SignatureFX = (() => {
  const TAU = Math.PI * 2;
  const themes = {
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
        status.xiahouBoost > 0
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
      sustained.push({
        id: 'zhouyu',
        x: fire.x,
        z: fire.z,
        tx: fire.x,
        tz: fire.z,
        phase: 'aura',
        life: 0.5,
        max: 1,
        color: '#ff6652',
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
      ctx.globalAlpha = Math.min(0.85, effect.life * 2) * (reduced ? 0.6 : 1);
      ctx.strokeStyle = effect.color;
      ctx.fillStyle = effect.color;
      ctx.lineWidth = Math.max(1.5, scale * 0.035);
      ctx.lineCap = 'round';
      // Avoid large bloom or full-screen flashes; keep the opponent readable.
      ctx.shadowColor = effect.color;
      ctx.shadowBlur = reduced ? 0 : 8;
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
  return { themes, create, draw };
})();
