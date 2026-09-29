'use strict';
// Presentation follows the engine's recorded finish kind, never guessed from HP alone.
window.BattleResult = (() => {
  const hp = (actor) => `${Math.max(0, Math.ceil(actor.hp))} / ${actor.maxHp}`;
  const percent = (actor) =>
    `${((100 * Math.max(0, actor.hp)) / actor.maxHp).toFixed(1)}%`;
  function describe(game) {
    const kind = game.finishKind;
    const winner = game.winner;
    const actors = game.actors;
    const victor =
      winner === null ? '雙方平手' : `P${winner + 1} · ${actors[winner].c.name}獲勝`;
    const loser = winner === null ? null : actors[1 - winner];
    if (kind.includes('限時'))
      return {
        type: 'time',
        title: winner === null ? '時間到 · 平手' : '時間到 · 生命比例判定',
        victor,
        detail: `120 秒結束，比較剩餘生命比例。P1 ${actors[0].c.name} ${percent(actors[0])}；P2 ${actors[1].c.name} ${percent(actors[1])}。`,
        color: '#a9cbff',
        marker: '時間到',
      };
    if (winner === null)
      return {
        type: 'draw',
        title: '雙方同時停轉',
        victor,
        detail: actors
          .map(
            (actor, index) =>
              `P${index + 1} ${actor.c.name}：${actor.hp <= 0 ? '生命歸零' : '爆裂'}（生命 ${hp(actor)}）`,
          )
          .join('；'),
        color: '#cad1df',
        marker: '同時停轉',
      };
    const name = `P${2 - winner} ${loser.c.name}`;
    if (kind.includes('出界'))
      return {
        type: 'out',
        title: '出界終結',
        victor,
        detail: `${name}被擊出場外，剩餘生命 ${hp(loser)}。${kind.includes('霸王') ? '由霸王突擊觸發出界。' : ''}`,
        color: '#ffbc70',
        marker: '出界',
      };
    if (kind.includes('爆裂'))
      return {
        type: 'burst',
        title: '爆裂終結',
        victor,
        detail: `${name}的爆裂耐久歸零，剩餘生命 ${hp(loser)}。${loser.hp <= 0 ? '生命也已歸零。' : '生命尚未耗盡，仍因爆裂落敗。'}`,
        color: '#eea4ff',
        marker: '爆裂',
      };
    if (kind.includes('心之一方'))
      return {
        type: 'special',
        title: '絕技擊倒 · 心之一方',
        victor,
        detail: `諸葛亮的心之一方成功擊倒${name}，生命 ${hp(loser)}。`,
        color: '#dbeca2',
        marker: '絕技擊倒',
      };
    return {
      type: 'hp',
      title: '生命歸零 · 擊倒',
      victor,
      detail: `${name}的生命已耗盡（${hp(loser)}），陀螺停止戰鬥。`,
      color: '#ff8d9b',
      marker: '生命 0',
    };
  }
  function draw(ctx, project, scale, game, width, height) {
    if (game.phase !== 'result') return;
    const result = describe(game);
    const sides =
      game.winner === null || result.type === 'time' ? [0, 1] : [1 - game.winner];
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = result.color;
    ctx.font = 'bold 13px system-ui';
    ctx.textAlign = 'center';
    for (const side of sides) {
      const actor = game.actors[side];
      let x = actor.x,
        z = actor.z;
      if (result.type === 'out') {
        const length = Math.hypot(x, z) || 1;
        const nx = length === 1 && x === 0 && z === 0 ? 1 : x / length;
        const nz = z / length;
        const start = project(nx * 2.9, 0.25, nz * 2.9);
        const end = project(nx * 3.65, 0.25, nz * 3.65);
        ctx.beginPath();
        ctx.moveTo(...start);
        ctx.lineTo(...end);
        ctx.stroke();
        const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
        ctx.beginPath();
        ctx.moveTo(
          end[0] - 12 * Math.cos(angle - 0.5),
          end[1] - 12 * Math.sin(angle - 0.5),
        );
        ctx.lineTo(...end);
        ctx.lineTo(
          end[0] - 12 * Math.cos(angle + 0.5),
          end[1] - 12 * Math.sin(angle + 0.5),
        );
        ctx.stroke();
        x = nx * 3.3;
        z = nz * 3.3;
      }
      const point = project(x, 0.4, z);
      ctx.beginPath();
      ctx.ellipse(...point, scale * 0.55, scale * 0.34, 0, 0, Math.PI * 2);
      ctx.stroke();
      const text = `P${side + 1} · ${result.type === 'time' ? percent(actor) : result.marker}`;
      const labelWidth = ctx.measureText(text).width + 20;
      const labelX = Math.max(
        labelWidth / 2 + 6,
        Math.min(width - labelWidth / 2 - 6, point[0]),
      );
      const labelY = Math.max(28, Math.min(height - 70, point[1] + scale * 0.55));
      ctx.fillStyle = '#0a1426';
      ctx.fillRect(labelX - labelWidth / 2, labelY - 17, labelWidth, 26);
      ctx.fillStyle = result.color;
      ctx.fillText(text, labelX, labelY + 1);
    }
    ctx.restore();
  }
  return { describe, draw };
})();
