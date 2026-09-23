'use strict';
// 介面元素、角色外觀與本機狀態。
const $ = (id) => document.getElementById(id),
  canvas = $('arena'),
  ctx = canvas.getContext('2d'),
  TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
for (const c of Object.values(WarData.characters)) {
  const base = TopArt.skins[c.baseSkin];
  TopArt.skins[c.id] = {
    ...base,
    ...GeneralArt[c.id],
    title: c.name + '・' + GeneralArt[c.id].name,
    code: c.faction + ' / ' + c.name,
    material: c.role,
  };
}
let networkRevision = 0,
  playMode = 'solo',
  launchQualities = [null, null];
const p2Keys = ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ','];
let selected = 'guanyu',
  enemy = 'lubu',
  faction = 'all',
  width = 1,
  height = 1,
  scale = 1,
  last = 0,
  accumulator = 0,
  particleList = [],
  trail = [],
  shockwaves = [],
  floaters = [],
  shake = 0,
  lastUI = 0,
  logKey = '',
  bannerLife = 0,
  countdown = 0,
  chargingTime = 0;
const game = new WarBattle(selected, enemy);
let tops = game.actors;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
function announce(text) {
  $('announcement').textContent = text;
}
function message(kicker, title, copy) {
  $('center-message').hidden = false;
  $('message-eyebrow').textContent = kicker;
  $('message-title').textContent = title;
  $('message-copy').textContent = copy;
}
let soundSequence = 0,
  soundJournal = [],
  receivedSound = 0,
  soundInitialized = false;
function playCue(kind, data = {}) {
  if (kind === 'finish')
    kind =
      data.winner === null
        ? 'draw'
        : playMode === 'local' || data.winner === mySide()
          ? 'win'
          : 'lose';
  SoundFX.play(kind, data);
}
function cue(kind, data = {}) {
  const event = { seq: ++soundSequence, kind, data, at: performance.now() };
  soundJournal.push(event);
  soundJournal = soundJournal.filter((e) => event.at - e.at < 1200).slice(-32);
  playCue(kind, data);
}
function canSelect() {
  return ['ready', 'result'].includes(game.phase);
}
function reset() {
  if (playMode === 'online' && RemoteRoom.role === 'guest') return;
  networkRevision++;
  SoundFX.stop();
  soundJournal = [];
  game.reset(selected, enemy);
  game.aiEnabled = playMode === 'solo';
  launchQualities = [null, null];
  tops = game.actors;
  particleList = [];
  trail = [];
  shockwaves = [];
  floaters = [];
  bannerLife = 0;
  logKey = '';
  chargingTime = 0;
  countdown = 0;
  renderLoadout();
  renderSkills();
  message('英雄入陣', 'SPIN FOR GLORY', '群雄競逐，榮耀由你締造。');
  $('skill-feedback').textContent = '陀螺自動移動；觀察對手，用技能掌握戰局。';
  updateUI();
}
// 選將與技能面板：顯示內容從目前角色資料產生。
function renderLoadout() {
  $('tops').replaceChildren();
  for (const c of Object.values(WarData.characters)) {
    if (faction !== 'all' && c.faction !== faction) continue;
    const b = document.createElement('button');
    b.className = 'general-choice' + (c.id === selected ? ' selected' : '');
    b.dataset.character = c.id;
    b.setAttribute('aria-pressed', String(c.id === selected));
    b.disabled = !canSelect() || (playMode === 'online' && RemoteRoom.role === 'guest');
    b.innerHTML = `<span>${c.name}</span><small>${c.faction} · ${c.provisional ? '暫定' : '文件值'}</small>`;
    b.onclick = () => {
      if (!canSelect()) return;
      selected = c.id;
      reset();
    };
    $('tops').append(b);
  }
  const c = WarData.characters[selected],
    art = TopArt.skins[selected];
  $('showcase-title').textContent = art.title;
  $('inspect-title').textContent = art.title;
  $('showcase-material').textContent = art.blades + ' 刃 · ' + art.motif + ' · ' + c.role;
  $('showcase-code').textContent = c.faction + ' / ' + c.name;
  $('character-stats').innerHTML = [
    ['攻擊', c.attack],
    ['防禦', c.defense],
    ['生命', c.hp],
    ['魔法', 100],
    ['速度', c.speed],
    ['穩定', c.stability],
  ]
    .map(([n, v]) => `<div><span>${n}</span><b>${v}</b></div>`)
    .join('');
  $('stat-provenance').textContent = c.provisional
    ? '暫定平衡值｜文件僅定義角色定位'
    : '文件原始值｜六項數值依第 2 頁實作';
  $('play-mode').value = playMode;
  $('play-mode').disabled = !canSelect() || !!RemoteRoom.role;
  $('online-lobby').hidden = playMode !== 'online';
  $('p2-panel').hidden = playMode === 'solo';
  $('launch-p2').hidden = playMode === 'solo';
  $('enemy-label').textContent = playMode !== 'solo' ? 'P2 武將' : '指定對手';
  $('mode-hint').textContent =
    playMode !== 'solo'
      ? '同機雙人：P1 空白鍵發射 · P2 Enter 發射 · P 暫停。雙方鎖定後開戰。'
      : '選擇武將，挑戰電腦對手。';
  $('enemy-select').value = enemy;
  $('enemy-select').disabled =
    !canSelect() || (playMode === 'online' && RemoteRoom.role !== 'guest');
  $('matchup-note').textContent =
    game.rivalry()?.text || '沒有宿敵加成。利用減速、反震與封招創造機會。';
}
function renderSkills() {
  for (const owner of [0, 1]) {
    const c = WarData.characters[owner ? enemy : selected],
      suffix = owner ? '-p2' : '',
      key = owner && playMode !== 'online' ? '/' : 'Q';
    const signature = $('signature' + suffix);
    signature.dataset.owner = owner;
    signature.dataset.action = 'signature';
    signature.innerHTML = `<span><strong>${key} · ${c.signature}</strong><small>${c.description}</small></span><span class="skill-state"></span>`;
    signature.onclick = () => useSkill('signature', owner);
    $('skills' + suffix).replaceChildren();
    Object.entries(WarData.common).forEach(([id, s], i) => {
      const b = document.createElement('button');
      b.className = 'skill-button';
      if (!owner) b.dataset.skill = id;
      b.dataset.action = id;
      b.dataset.owner = owner;
      b.innerHTML = `<span class="skill-meta"><span>${owner && playMode !== 'online' ? p2Keys[i] : i + 1} / ${s.type}</span><span>${s.cost} 魔法</span></span><strong>${s.name}</strong><small>${s.text}</small><em class="skill-state">待戰</em>`;
      b.onclick = () => useSkill(id, owner);
      $('skills' + suffix).append(b);
    });
  }
  $('p2-hotkeys').textContent =
    playMode === 'online' ? '1–8 通用技 · Q 專屬技' : 'Z X C V B N M , 通用技 · / 專屬技';
  $('p2-heading').textContent = 'P2 · ' + WarData.characters[enemy].name;
  $('skill-feedback-p2').textContent =
    playMode === 'online'
      ? '玩家 2：空白鍵發射，Q 施放專屬技。'
      : '玩家 2：Enter 發射，/ 施放專屬技。';
}
const statusNames = {
  storm: '攻擊 +30%',
  weak: '虛弱',
  edge: '邊緣滑行',
  wall: '減傷 40%',
  center: '中心守勢',
  reflect: '反震待命',
  slow: '逆風減速',
  root: '禁止位移',
  roarSlow: '怒吼震懾',
  evade: '閃避',
  reverse: '反轉',
  store: '蓄傷反擊',
  death: '抬棺死戰',
  immovable: '免疫擊退',
  xiahouBoost: '攻擊 +40%',
  runup: '邊緣助跑',
  unstable: '穩定降低',
};
function actorStatus(a) {
  const tags = Object.entries(a.status)
    .filter(([, t]) => t > 0)
    .map(
      ([id, t]) =>
        (statusNames[id] || id) +
        (id === 'evade' ? ' ' + a.evades + '次' : ' ' + t.toFixed(1) + '秒'),
    );
  if (a.cast)
    tags.unshift(
      (a.cast.kind === 'guanyu' ? '青龍蓄力' : '鐵騎助跑') +
        ' ' +
        a.cast.left.toFixed(1) +
        '秒',
    );
  if (a.sealed) tags.unshift('下一招被封鎖');
  if (a.pending) tags.unshift('衝撞待命');
  if (a.id === 'zhugeliang')
    tags.push('擊倒率 ' + Math.min(30, 10 + a.behindCount * 5) + '%');
  return tags.join(' · ') || '無狀態';
}
function mySide() {
  return playMode === 'online' && RemoteRoom.role === 'guest' ? 1 : 0;
}
function onlineCommand(action, value) {
  RemoteRoom.command(action, { revision: networkRevision, value });
}
function updateUI() {
  const a = tops[0],
    b = tops[1],
    phase = game.phase;
  $('player-name').textContent = a.c.name;
  $('ai-name').textContent = b.c.name;
  $('player-faction').textContent =
    a.c.faction + (playMode !== 'solo' ? ' · P1' : ' · 玩家');
  $('ai-faction').textContent = b.c.faction + (playMode !== 'solo' ? ' · P2' : ' · 電腦');
  const remain = Math.max(0, Math.ceil(120 - game.roundElapsed));
  $('battle-clock').textContent =
    String(Math.floor(remain / 60)).padStart(2, '0') +
    ':' +
    String(remain % 60).padStart(2, '0');
  $('launch').disabled = ['battle', 'countdown', 'paused'].includes(phase);
  $('launch').innerHTML =
    phase === 'charging'
      ? '發射！ <span>↗</span>'
      : phase === 'result'
        ? '再戰一場 <span>↗</span>'
        : phase === 'battle'
          ? '交鋒中 <span>⚔</span>'
          : '蓄力發射 <span>↗</span>';
  $('pause').disabled = !['battle', 'charging', 'countdown', 'paused'].includes(phase);
  $('pause').textContent = phase === 'paused' ? '▶' : 'Ⅱ';
  $('pause').setAttribute('aria-label', phase === 'paused' ? '繼續戰鬥' : '暫停戰鬥');
  $('arena-status').textContent = {
    ready: '選將待戰',
    charging: '把握發射時機',
    countdown: '準備交鋒',
    battle: '自動交鋒 · 選招決勝',
    paused: '對戰暫停',
    result: '勝負已分',
  }[phase];
  for (const [t, prefix] of [
    [a, 'your'],
    [b, 'ai'],
  ]) {
    $(prefix + '-spin').textContent = Math.ceil(Math.max(0, t.hp)) + ' / ' + t.maxHp;
    $(prefix + '-bar').style.width = clamp((t.hp / t.maxHp) * 100, 0, 100) + '%';
    $(prefix + '-mana').textContent = Math.floor(t.mana) + ' / 100';
    $(prefix + '-mana-bar').style.width = t.mana + '%';
    $(prefix + '-status').textContent = actorStatus(t);
  }
  $('timing-marker').style.left = game.charge * 100 + '%';
  $('launch-label').textContent = phase === 'battle' ? '半即時制' : '發射時機';
  $('launch-hint').textContent =
    phase === 'battle' ? '按 1–8 或 Q 出招。' : '亮區發射可提高初速。';
  for (const btn of document.querySelectorAll('[data-action]')) {
    const owner = Number(btn.dataset.owner),
      a = tops[owner],
      id = btn.dataset.action,
      why =
        playMode === 'online' && (!RemoteRoom.connected || owner !== mySide())
          ? '等待連線或由對手操作'
          : owner && playMode === 'solo'
            ? '單人模式'
            : game.reason(a, id),
      cooldown = a.cooldowns[id] || 0;
    btn.disabled = !!why;
    btn.title = why || '施放招式';
    const cost = game.cost(a, id);
    btn.querySelector('.skill-state').textContent =
      cooldown > 0
        ? '冷卻 ' + cooldown.toFixed(1) + '秒'
        : why ||
          (a.sealed
            ? '封招待解除'
            : id === 'signature'
              ? Math.floor(cost) + ' 魔法'
              : '可以施放');
  }
  if (playMode !== 'solo') {
    for (const owner of [0, 1]) {
      const b = $(owner ? 'launch-p2' : 'launch'),
        locked = launchQualities[owner] !== null;
      b.disabled =
        ['battle', 'countdown', 'paused'].includes(phase) ||
        (phase === 'charging' && locked);
      b.textContent =
        'P' +
        (owner + 1) +
        ' ' +
        (phase === 'charging'
          ? locked
            ? '已就緒'
            : '發射！'
          : phase === 'battle'
            ? '交鋒中'
            : '蓄力發射');
    }
    $('launch-hint').textContent =
      phase === 'battle'
        ? 'P1：1–8 / Q；P2：Z–M、逗號 / 斜線'
        : 'P1 空白鍵 · P2 Enter，各自鎖定。';
  }
  if (playMode === 'online') {
    $('launch').disabled ||= !RemoteRoom.connected || mySide() !== 0;
    $('launch-p2').disabled ||= !RemoteRoom.connected || mySide() !== 1;
    $('pause').disabled ||= !RemoteRoom.connected;
    $('restart').disabled = RemoteRoom.role === 'guest';
    $('mode-hint').textContent =
      '遠端對戰：你是 ' +
      (RemoteRoom.role ? 'P' + (mySide() + 1) : '尚未加入的玩家') +
      ' · 1–8 / Q 出招 · 空白鍵發射';
    $('launch-hint').textContent = '你是 P' + (mySide() + 1) + ' · 空白鍵發射';
  } else $('restart').disabled = false;
  const key = game.log[0]?.time + '|' + game.log[0]?.text;
  if (key !== logKey) {
    logKey = key;
    $('combat-log').replaceChildren(
      ...game.log.slice(0, 12).map((e) => {
        const li = document.createElement('li'),
          time = document.createElement('time');
        time.textContent = Number(e.time).toFixed(1) + 's';
        li.append(time, document.createTextNode(String(e.text)));
        return li;
      }),
    );
  }
  $('skill-banner').classList.toggle('show', bannerLife > 0);
}
function charge() {
  game.reset(selected, enemy);
  game.aiEnabled = playMode === 'solo';
  launchQualities = [null, null];
  tops = game.actors;
  game.phase = 'charging';
  chargingTime = 0;
  game.charge = 0;
  particleList = [];
  trail = [];
  shockwaves = [];
  floaters = [];
  renderLoadout();
  message(
    '掌握初速',
    '蓄勢待發。',
    playMode !== 'solo'
      ? 'P1 空白鍵 · P2 Enter，各自鎖定亮區。'
      : '亮區按空白鍵或發射按鈕。',
  );
  cue('charge');
  updateUI();
}
function launch(owner = mySide(), remote = false, observedCharge = null) {
  if (playMode === 'online' && !remote) {
    if (!RemoteRoom.connected || owner !== mySide()) return;
    if (RemoteRoom.role === 'guest') {
      onlineCommand('launch', game.charge);
      return;
    }
  }
  if (owner !== 0 && owner !== 1) return;
  if (owner === 1 && playMode === 'solo') return;
  if (canSelect()) {
    charge();
    return;
  }
  if (game.phase !== 'charging' || launchQualities[owner] !== null) return;
  const quality = clamp(
    1 - Math.abs((observedCharge ?? game.charge) - 0.81) / 0.81,
    0.15,
    1,
  );
  launchQualities[owner] = quality;
  if (playMode !== 'solo' && launchQualities.some((q) => q === null)) {
    message(
      '發射已鎖定',
      'P' + (owner + 1) + ' READY',
      '等待 P' + (owner === 0 ? 2 : 1) + ' 發射 · ' + (owner === 0 ? 'Enter' : '空白鍵'),
    );
    updateUI();
    return;
  }
  game.quality = launchQualities[0];
  countdown = 1.5;
  game.phase = 'countdown';
  message('武將就位', '開戰！', '陀螺自動交鋒，準備選招。');
  cue('launch');
  updateUI();
}
function pause(remote = false) {
  if (playMode === 'online' && RemoteRoom.role === 'guest' && !remote) {
    if (RemoteRoom.connected) onlineCommand('pause');
    return;
  }
  const before = game.phase;
  game.pause();
  if (game.phase === 'paused') {
    SoundFX.stop();
    message('暫停演武', '運籌帷幄。', '按 P 或播放按鈕繼續。');
  } else if (before === 'paused') {
    if (game.phase === 'battle') $('center-message').hidden = true;
    else message('準備發射', '蓄勢待發。', '按空白鍵或發射按鈕。');
  }
  updateUI();
}
function useSkill(id, owner = mySide(), remote = false) {
  if (playMode === 'online' && !remote) {
    if (!RemoteRoom.connected || owner !== mySide()) return;
    if (RemoteRoom.role === 'guest') {
      onlineCommand('skill', id);
      return;
    }
  }
  if (owner !== 0 && owner !== 1) return;
  if (owner === 1 && playMode === 'solo') return;
  const result = game.use(tops[owner], id);
  $(owner ? 'skill-feedback-p2' : 'skill-feedback').textContent = result.ok
    ? '已施放「' +
      (id === 'signature' ? tops[owner].c.signature : WarData.common[id].name) +
      '」。'
    : result.reason;
  processEvents();
  updateUI();
}
function sparks(x, z, color, count = 16) {
  shockwaves.push({ x, z, color, life: 0.48, max: 0.48 });
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * TAU,
      v = 1 + Math.random() * 3;
    particleList.push({
      x,
      z,
      y: 0.3,
      vx: Math.cos(angle) * v,
      vz: Math.sin(angle) * v,
      vy: 1.5 + Math.random() * 2,
      life: 0.4 + Math.random() * 0.4,
      color,
      size: 1 + Math.random() * 2,
    });
  }
}
// 戰鬥事件轉成粒子、提示文字與音效；不在此計算傷害。
function processEvents() {
  for (const e of game.drainEvents()) {
    if (e.type === 'hit') {
      sparks(e.actor.x, e.actor.z, e.actor.color, 10);
      floaters.push({
        x: e.actor.x,
        z: e.actor.z,
        text: '−' + Math.round(e.damage),
        color: '#ffe3bd',
        life: 1,
        max: 1,
      });
      shake = 3;
      cue('hit', { damage: e.damage, x: e.actor.x });
    }
    if (e.type === 'skill') {
      bannerLife = 1.25;
      $('skill-banner').textContent = e.actor.c.name + ' · ' + e.name;
      announce($('skill-banner').textContent);
      sparks(e.actor.x, e.actor.z, e.actor.color, 18);
      cue('skill', {
        id:
          e.name === e.actor.c.signature
            ? 'signature'
            : Object.keys(WarData.common).find(
                (id) => WarData.common[id].name === e.name,
              ),
        character: e.actor.id,
        x: e.actor.x,
      });
    }
    if (['evade', 'interrupt', 'seal'].includes(e.type)) cue(e.type, { x: e.actor.x });
    if (['evade', 'interrupt', 'seal', 'miss'].includes(e.type))
      floaters.push({
        x: e.actor.x,
        z: e.actor.z,
        text: { evade: '閃避', interrupt: '中斷', seal: '封招', miss: '未命中' }[e.type],
        color: '#c3dbff',
        life: 1,
        max: 1,
      });
    if (e.type === 'summon') {
      const target = e.target;
      for (let i = 0; i < 12; i++) {
        const f = i / 12;
        particleList.push({
          x: e.actor.x * (1 - f) + target.x * f,
          z: e.actor.z * (1 - f) + target.z * f,
          y: 0.3,
          vx: 0,
          vz: 0,
          vy: 1,
          life: 0.6,
          color: '#c8f2a0',
          size: 4,
        });
      }
    }
    if (e.type === 'finish') {
      updateUI();
      const won = e.winner === 0,
        draw = e.winner === null;
      message(
        '一戰定勝負',
        draw
          ? '英雄相惜，平手。'
          : playMode !== 'solo'
            ? 'P' + (e.winner + 1) + ' · 勝利！'
            : won
              ? '此戰，大獲全勝！'
              : '勝敗乃兵家常事。',
        e.kind + ' · ' + (draw ? '再戰分高下' : tops[e.winner].c.name + '獲勝'),
      );
      announce($('message-title').textContent + ' ' + e.kind);
      if (!draw)
        sparks(tops[1 - e.winner].x, tops[1 - e.winner].z, tops[1 - e.winner].color, 36);
      renderLoadout();
      cue('finish', { winner: e.winner });
    }
  }
}
// 固定時間步進；遠端訪客只接收房主狀態，不重算戰鬥。
function simulate(dt) {
  if (playMode === 'online' && (RemoteRoom.role === 'guest' || !RemoteRoom.connected))
    return;
  if (game.phase === 'paused') return;
  if (game.phase === 'charging') {
    chargingTime += dt;
    game.charge = (Math.sin(chargingTime * 3.6 - Math.PI / 2) + 1) / 2;
  } else if (game.phase === 'countdown') {
    countdown -= dt;
    if (countdown <= 0) {
      game.start(game.quality, playMode !== 'solo' ? launchQualities[1] : null);
      tops = game.actors;
      $('center-message').hidden = true;
      renderLoadout();
    }
  } else if (game.phase === 'battle') {
    game.tick(dt);
    tops = game.actors;
    processEvents();
    if (Math.random() < 0.35)
      for (const t of tops) trail.push({ x: t.x, z: t.z, life: 0.4, color: t.color });
  } else if (game.phase === 'ready' && !reduced.matches)
    for (const t of tops) t.angle += dt * 0.4;
  for (const p of particleList) {
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.y += p.vy * dt;
    p.vy -= 8 * dt;
    p.life -= dt;
  }
  particleList = particleList.filter((p) => p.life > 0);
  for (const t of trail) t.life -= dt;
  trail = trail.filter((t) => t.life > 0);
  for (const w of shockwaves) w.life -= dt;
  shockwaves = shockwaves.filter((w) => w.life > 0);
  for (const f of floaters) f.life -= dt;
  floaters = floaters.filter((f) => f.life > 0);
  shake *= Math.exp(-dt * 12);
  bannerLife = Math.max(0, bannerLife - dt);
}
function drawBattleFields() {
  for (const f of game.hazards) {
    const p = project(f.x, floorY(f.x, f.z) + 0.04, f.z);
    ctx.save();
    ctx.globalAlpha = 0.45;
    const g = ctx.createRadialGradient(...p, 0, ...p, f.radius * scale);
    g.addColorStop(0, '#ffb842');
    g.addColorStop(1, '#ee443311');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(...p, f.radius * scale, f.radius * scale * 0.58, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#ff9658';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
  for (const t of tops) {
    for (const key of ['wall', 'store', 'reflect', 'center', 'evade'])
      if (game.has(t, key)) {
        const p = project(t.x, floorY(t.x, t.z) + 0.24, t.z);
        ctx.strokeStyle = {
          wall: '#86b9ff',
          store: '#ce9bf9',
          reflect: '#ffd786',
          center: '#8ef1ca',
          evade: '#e8fcff',
        }[key];
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(...p, scale * 0.6, scale * 0.4, 0, 0, TAU);
        ctx.stroke();
      }
    if (t.cast) {
      const p = project(t.x, 0.4, t.z);
      ctx.strokeStyle = '#ffe39c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(
        ...p,
        scale * 0.65,
        scale * 0.4,
        0,
        -Math.PI / 2,
        -Math.PI / 2 + TAU * (1 - t.cast.left / (t.cast.kind === 'guanyu' ? 2 : 3)),
      );
      ctx.stroke();
    }
  }
}
function drawFloaters() {
  ctx.save();
  ctx.font = 'bold 13px system-ui';
  ctx.textAlign = 'center';
  for (const f of floaters) {
    const p = project(f.x, 0.8 + (1 - f.life) * 0.7, f.z);
    ctx.globalAlpha = f.life;
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, ...p);
  }
  ctx.restore();
}
for (const c of Object.values(WarData.characters)) {
  const o = document.createElement('option');
  o.value = c.id;
  o.textContent = c.faction + ' · ' + c.name + ' — ' + c.role;
  $('enemy-select').append(o);
}
$('enemy-select').onchange = (e) => {
  if (canSelect()) {
    if (playMode === 'online') {
      if (RemoteRoom.role === 'guest') onlineCommand('select', e.target.value);
      return;
    }
    enemy = e.target.value;
    reset();
  }
};
document.querySelectorAll('[data-faction]').forEach(
  (b) =>
    (b.onclick = () => {
      faction = b.dataset.faction;
      document
        .querySelectorAll('[data-faction]')
        .forEach((x) => x.classList.toggle('active', x === b));
      renderLoadout();
    }),
);
// 滑鼠、鍵盤與音訊控制。
$('play-mode').onchange = (e) => setMode(e.target.value);
$('launch').onclick = () => launch(0);
$('launch-p2').onclick = () => launch(1);
$('pause').onclick = () => pause();
$('restart').onclick = reset;
$('signature').onclick = () => useSkill('signature', 0);
$('sound').onclick = async () => {
  try {
    await SoundFX.setEnabled(!SoundFX.enabled);
    $('sound').textContent = SoundFX.enabled ? '音效 開 ♫' : '音效 關 ♫';
    $('sound').setAttribute('aria-pressed', String(SoundFX.enabled));
    if (SoundFX.enabled) SoundFX.play('enabled');
  } catch {
    $('sound').textContent = '音效不可用';
    $('sound').setAttribute('aria-pressed', 'false');
  }
};
$('sound-volume').oninput = (e) => SoundFX.setVolume(Number(e.target.value) / 100);
for (const type of ['pointerdown', 'keydown'])
  document.addEventListener(
    type,
    () => {
      if (SoundFX.enabled) SoundFX.unlock().catch(() => {});
    },
    { capture: true },
  );

function openDialog(id) {
  if (['battle', 'charging', 'countdown'].includes(game.phase)) pause();
  $(id).showModal();
}
$('rules-open').onclick = () => openDialog('rules-dialog');
$('rules-close').onclick = () => $('rules-dialog').close();
$('inspect-open').onclick = () => openDialog('inspect-dialog');
$('inspect-close').onclick = () => $('inspect-dialog').close();
const skillKeys = Object.keys(WarData.common);
window.addEventListener('keydown', (e) => {
  if (
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    $('inspect-dialog').open ||
    $('rules-dialog').open ||
    e.target.matches?.('select,input,textarea,[contenteditable="true"]') ||
    e.repeat
  )
    return;
  if (e.code === 'Space') {
    e.preventDefault();
    launch(mySide());
  } else if (playMode === 'local' && (e.code === 'Enter' || e.code === 'NumpadEnter')) {
    e.preventDefault();
    launch(1);
  } else if (e.code === 'KeyP') {
    e.preventDefault();
    pause();
  } else if (e.code === 'KeyQ') {
    e.preventDefault();
    useSkill('signature');
  } else if (/^Digit[1-8]$/.test(e.code)) {
    e.preventDefault();
    useSkill(skillKeys[Number(e.code.slice(-1)) - 1]);
  } else if (playMode === 'local') {
    const index = [
      'KeyZ',
      'KeyX',
      'KeyC',
      'KeyV',
      'KeyB',
      'KeyN',
      'KeyM',
      'Comma',
    ].indexOf(e.code);
    if (index >= 0) {
      e.preventDefault();
      useSkill(skillKeys[index], 1);
    } else if (e.code === 'Slash') {
      e.preventDefault();
      useSkill('signature', 1);
    }
  }
});
function setMode(mode) {
  if (!canSelect() || !['solo', 'local', 'online'].includes(mode) || RemoteRoom.role)
    return;
  playMode = mode;
  reset();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) SoundFX.stop();
  if (document.hidden && ['battle', 'charging', 'countdown'].includes(game.phase))
    pause();
});
window.addEventListener('blur', () => {
  if (['battle', 'charging', 'countdown'].includes(game.phase)) pause();
});
let inspectAngle = 0.3,
  inspectTilt = 0.68,
  inspectDrag = null,
  showcaseClock = 0,
  lastShowcase = 0;
function fitArtCanvas(c) {
  const r = c.getBoundingClientRect(),
    dpr = Math.min(devicePixelRatio || 1, 2);
  if (c.width !== Math.round(r.width * dpr) || c.height !== Math.round(r.height * dpr)) {
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
  }
  const art = c.getContext('2d');
  art.setTransform(dpr, 0, 0, dpr, 0, 0);
  art.clearRect(0, 0, r.width, r.height);
  return { art, w: r.width, h: r.height };
}
// 選將預覽和鑑賞視窗共用同一套陀螺模型。
function drawShowcase(time) {
  if (time - lastShowcase < 65) return;
  const dt = Math.min(0.1, (time - lastShowcase) / 1000);
  lastShowcase = time;
  if (!reduced.matches) showcaseClock += dt;
  const { art, w, h } = fitArtCanvas($('top-preview'));
  TopArt.render(art, {
    x: w / 2,
    y: h * 0.45,
    size: Math.min(w * 0.39, h * 0.65),
    angle: 0.3 + showcaseClock * 0.26,
    skin: selected,
    tilt: 0.65,
  });
  if ($('inspect-dialog').open) {
    const { art, w, h } = fitArtCanvas($('inspect-canvas'));
    if ($('inspect-spin').checked && !inspectDrag && !reduced.matches)
      inspectAngle += dt * 0.3;
    const explode = $('inspect-explode').checked ? 1 : 0;
    TopArt.render(art, {
      x: w / 2,
      y: h * 0.47,
      size: Math.min(w * 0.37, h * (explode ? 0.46 : 0.67)),
      angle: inspectAngle,
      tilt: inspectTilt,
      skin: selected,
      explode,
    });
  }
}
$('inspect-canvas').addEventListener('pointerdown', (e) => {
  inspectDrag = { x: e.clientX, y: e.clientY };
  e.target.setPointerCapture(e.pointerId);
});
$('inspect-canvas').addEventListener('pointermove', (e) => {
  if (!inspectDrag) return;
  inspectAngle += (e.clientX - inspectDrag.x) * 0.009;
  inspectTilt = clamp(inspectTilt + (e.clientY - inspectDrag.y) * 0.006, 0.22, 1.35);
  inspectDrag = { x: e.clientX, y: e.clientY };
});
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'])
  $('inspect-canvas').addEventListener(ev, () => (inspectDrag = null));
$('inspect-canvas').addEventListener('keydown', (e) => {
  if (!e.key.startsWith('Arrow')) return;
  e.preventDefault();
  if (e.key === 'ArrowLeft') inspectAngle -= 0.13;
  if (e.key === 'ArrowRight') inspectAngle += 0.13;
  if (e.key === 'ArrowUp') inspectTilt = clamp(inspectTilt + 0.1, 0.22, 1.35);
  if (e.key === 'ArrowDown') inspectTilt = clamp(inspectTilt - 0.1, 0.22, 1.35);
});
new ResizeObserver(resize).observe(canvas);
function frame(time) {
  RemoteRoom.tick(time);
  const elapsed = Math.min(0.1, (time - last) / 1000 || 0);
  last = time;
  accumulator += elapsed;
  while (accumulator >= 1 / 120) {
    simulate(1 / 120);
    accumulator -= 1 / 120;
  }
  draw();
  drawFloaters();
  drawShowcase(time);
  if (time - lastUI > 90) {
    updateUI();
    lastUI = time;
  }
  requestAnimationFrame(frame);
}
window.SpinArena = {
  game,
  setMode,
  get mode() {
    return playMode;
  },
  get tops() {
    return tops;
  },
  simulate,
  launch,
  pause,
  reset,
  draw,
  useSkill,
  select: (id) => {
    if (WarData.characters[id] && canSelect()) {
      selected = id;
      reset();
    }
  },
  setEnemy: (id) => {
    if (WarData.characters[id] && canSelect()) {
      enemy = id;
      reset();
    }
  },
};
reset();
resize();
requestAnimationFrame(frame);

// Both screens consume host state; only the host advances the simulation.
const networkGameFields = [
  'phase',
  'time',
  'roundElapsed',
  'winner',
  'finishKind',
  'charge',
  'quality',
  'resumePhase',
  'log',
  'hazards',
];
function captureNetwork() {
  const fields = {};
  for (const key of networkGameFields) fields[key] = game[key];
  return {
    soundSequence,
    sounds: soundJournal.filter((e) => performance.now() - e.at < 1200),
    revision: networkRevision,
    selected,
    enemy,
    fields,
    actors: game.actors,
    launchQualities,
    trail,
    particleList,
    shockwaves,
    floaters,
    bannerLife,
    banner: $('skill-banner').textContent,
    message: {
      hidden: $('center-message').hidden,
      kicker: $('message-eyebrow').textContent,
      title: $('message-title').textContent,
      copy: $('message-copy').textContent,
    },
  };
}
function applyNetwork(s) {
  if (
    !s ||
    !WarData.characters[s.selected] ||
    !WarData.characters[s.enemy] ||
    !Array.isArray(s.actors) ||
    s.actors.length !== 2 ||
    !s.fields ||
    !Number.isSafeInteger(s.revision)
  )
    return;
  const previousPhase = game.phase,
    previousRevision = networkRevision;
  const changed =
    selected !== s.selected ||
    enemy !== s.enemy ||
    networkRevision !== s.revision ||
    game.phase !== s.fields.phase;
  selected = s.selected;
  enemy = s.enemy;
  networkRevision = s.revision;
  for (const key of networkGameFields) game[key] = s.fields[key];
  game.actors = s.actors.map((a, i) => ({
    ...a,
    c: WarData.characters[i ? enemy : selected],
    id: i ? enemy : selected,
    ai: !!i,
  }));
  tops = game.actors;
  game.aiEnabled = false;
  launchQualities = s.launchQualities;
  trail = s.trail;
  particleList = s.particleList;
  shockwaves = s.shockwaves;
  floaters = s.floaters;
  bannerLife = s.bannerLife;
  $('skill-banner').textContent = s.banner;
  message(s.message.kicker, s.message.title, s.message.copy);
  $('center-message').hidden = s.message.hidden;
  if (changed) {
    renderLoadout();
    renderSkills();
  }
  $('enemy-select').value = enemy;
  updateUI();
  if (!soundInitialized || previousRevision !== networkRevision) {
    receivedSound = s.soundSequence || 0;
    soundInitialized = true;
    SoundFX.stop();
  } else {
    if (previousPhase !== game.phase && game.phase === 'paused') SoundFX.stop();
    for (const event of s.sounds || []) {
      if (event.seq > receivedSound && game.phase !== 'paused')
        playCue(event.kind, event.data);
    }
    receivedSound = Math.max(receivedSound, s.soundSequence || 0);
  }
}

RemoteRoom.configure({
  capture: captureNetwork,
  snapshot: applyNetwork,
  input: (action, payload) => {
    if (
      playMode !== 'online' ||
      RemoteRoom.role !== 'host' ||
      !payload ||
      payload.revision !== networkRevision
    )
      return;
    if (
      action === 'select' &&
      canSelect() &&
      Object.hasOwn(WarData.characters, payload.value)
    ) {
      enemy = payload.value;
      reset();
    } else if (
      action === 'launch' &&
      Number.isFinite(payload.value) &&
      payload.value >= 0 &&
      payload.value <= 1
    )
      launch(1, true, payload.value);
    else if (
      action === 'skill' &&
      (payload.value === 'signature' || Object.hasOwn(WarData.common, payload.value))
    )
      useSkill(payload.value, 1, true);
    else if (action === 'pause') pause(true);
  },
  connected: () => {
    if (RemoteRoom.role === 'host') reset();
    renderLoadout();
    updateUI();
  },
  closed: () => {
    SoundFX.stop();
    soundInitialized = false;
    renderLoadout();
    updateUI();
  },
  lost: (reason) => {
    if (['battle', 'charging', 'countdown'].includes(game.phase)) {
      game.pause();
    }
    message('連線已中止', 'DUEL PAUSED', reason);
    updateUI();
  },
  status: (text, state) => {
    $('online-status').textContent = text;
    $('online-role').textContent = state.role
      ? '你是 ' + (state.role === 'host' ? 'P1 · 房主' : 'P2 · 訪客')
      : '尚未連線';
    $('room-create').disabled = !!state.role;
    $('room-join').disabled = !!state.role;
    $('room-leave').disabled = !state.role;
    $('room-share').hidden = state.role !== 'host';
    if (state.role === 'host') $('room-link').value = RemoteRoom.invite();
    renderLoadout();
    updateUI();
  },
});
$('room-create').onclick = () => {
  if (playMode === 'online') {
    reset();
    RemoteRoom.create();
  }
};
$('room-join').onclick = () => {
  if (playMode === 'online') RemoteRoom.join($('room-code').value);
};
$('room-leave').onclick = () => {
  RemoteRoom.leave();
  reset();
};
$('room-copy').onclick = async () => {
  try {
    await navigator.clipboard.writeText($('room-link').value);
    $('online-status').textContent = '邀請連結已複製，傳給朋友即可加入。';
  } catch {
    $('room-link').focus();
    $('room-link').select();
    $('online-status').textContent = '請複製已選取的邀請連結。';
  }
};
if (/^#room=[a-f0-9]{10}$/i.test(location.hash)) {
  setMode('online');
  $('room-code').value = location.hash.slice(6);
  $('online-status').textContent = '已填入朋友的房間，按「加入房間 · P2」即可連線。';
}
