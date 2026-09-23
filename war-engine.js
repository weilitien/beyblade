'use strict';
// Deterministic battle rules are independent of the browser/rendering layer.
window.WarBattle = class WarBattle {
  constructor(player = 'guanyu', rival = 'lubu', random = Math.random) {
    this.random = random;
    this.aiEnabled = true;
    this.reset(player, rival);
  }
  actor(id, ai) {
    const c = WarData.characters[id];
    if (!c) throw Error('未知武將');
    return {
      id,
      c,
      ai,
      x: ai ? 1.5 : -1.5,
      z: ai ? -0.9 : 0.9,
      vx: 0,
      vz: 0,
      hp: c.hp,
      maxHp: c.hp,
      mana: 100,
      integrity: 100,
      angle: 0,
      skin: id,
      color: c.color,
      dead: false,
      burst: false,
      status: {},
      cooldowns: {},
      pending: null,
      sequence: null,
      cast: null,
      stored: 0,
      evades: 0,
      sealed: false,
      firstHit: true,
      behindCount: 0,
      wasBehind: false,
      globalCooldown: 0,
      get spin() {
        return (this.hp / this.maxHp) * 100;
      },
    };
  }
  reset(player = this.actors?.[0].id || 'guanyu', rival = this.actors?.[1].id || 'lubu') {
    this.actors = [this.actor(player, false), this.actor(rival, true)];
    this.phase = 'ready';
    this.time = 0;
    this.roundElapsed = 0;
    this.round = 1;
    this.you = 0;
    this.ai = 0;
    this.winner = null;
    this.finishKind = '';
    this.events = [];
    this.log = [];
    this.hazards = [];
    this.collisionCooldown = 0;
    this.aiTimer = 2;
    this.exchange = false;
    this.charge = 0;
    this.quality = 0;
    this.resumePhase = null;
    this.logEvent('選將就緒：' + this.actors.map((a) => a.c.name).join(' 對 '));
  }
  logEvent(text) {
    const e = { time: this.roundElapsed, text };
    this.log.unshift(e);
    if (this.log.length > 60) this.log.pop();
  }
  event(type, data = {}) {
    this.events.push({ type, ...data });
  }
  drainEvents() {
    return this.events.splice(0);
  }
  start(quality = 1, rivalQuality = null) {
    const ids = this.actors.map((a) => a.id);
    this.actors = ids.map((id, i) => this.actor(id, !!i));
    this.phase = 'battle';
    this.roundElapsed = 0;
    this.time = 0;
    this.hazards = [];
    this.collisionCooldown = 0;
    this.aiTimer = 1.8;
    this.quality = quality;
    const [a, b] = this.actors;
    a.vx = 2.8 + quality * 2;
    a.vz = -1.3;
    b.vx = rivalQuality === null ? -3.7 : -(2.8 + rivalQuality * 2);
    b.vz = 1.3;
    this.logEvent('開戰！自動碰撞，選招決勝。');
    const r = this.rivalry();
    if (r) this.logEvent(r.text);
  }
  opponent(a) {
    return this.actors[a.ai ? 0 : 1];
  }
  has(a, key) {
    return (a.status[key] || 0) > 0;
  }
  set(a, key, seconds) {
    a.status[key] = seconds;
  }
  cost(a, id) {
    if (id === 'signature') {
      if (a.id === 'zhugeliang') return Math.max(30, a.mana);
      if (a.id === 'pangde' && a.hp / a.maxHp < 0.3) return 0;
      return a.c.cost;
    }
    return WarData.common[id]?.cost ?? Infinity;
  }
  reason(a, id) {
    if (this.phase !== 'battle') return '戰鬥開始後才能出招';
    if (a.hp <= 0) return '武將已停轉';
    if (a.globalCooldown > 0) return '出招間隔';
    if (a.cooldowns[id] > 0) return '招式冷卻中';
    if (a.cast || a.sequence || this.has(a, 'store')) return '目前招式進行中';
    if (this.has(a, 'center')) return '中心守勢期間無法出招';
    const def = WarData.common[id];
    if (id !== 'signature' && !def) return '未知招式';
    const movement =
      def?.type === '位移' ||
      (id === 'signature' && ['lubu', 'machao', 'ganning', 'sunce'].includes(a.id));
    if (this.has(a, 'root') && movement) return '震懾中，禁止位移招式';
    if (this.has(a, 'death') && def?.type === '防禦') return '死戰期間禁止防禦招式';
    if (a.mana < this.cost(a, id)) return '魔法不足';
    return '';
  }
  use(a, id) {
    const why = this.reason(a, id);
    if (why) return { ok: false, reason: why };
    if (a.sealed) {
      a.sealed = false;
      a.globalCooldown = 0.5;
      this.logEvent(a.c.name + '的下一招被「挾天子令諸侯」封鎖！');
      this.event('seal', { actor: a });
      return { ok: false, reason: '封招被消耗，本次招式失敗；未扣魔法' };
    }
    const b = this.opponent(a),
      cost = this.cost(a, id);
    a.mana = Math.max(0, a.mana - cost);
    a.cooldowns[id] =
      id === 'signature' ? (a.id === 'pangde' ? 10 : 12) : WarData.common[id].cooldown;
    a.globalCooldown = 0.8;
    const name = id === 'signature' ? a.c.signature : WarData.common[id].name;
    this.logEvent(a.c.name + '施放「' + name + '」 −' + Math.round(cost) + ' 魔法');
    this.event('skill', { actor: a, name });
    if (id === 'signature') {
      this.signature(a, b);
      return { ok: true };
    }
    switch (id) {
      case 'storm':
        this.set(a, 'storm', 8);
        break;
      case 'rush':
        this.dash(a, 1.5, 6, 2.5);
        break;
      case 'center':
        a.x = 0;
        a.z = 0;
        a.vx = 0;
        a.vz = 0;
        this.set(a, 'center', 5);
        break;
      case 'edge':
        this.set(a, 'edge', 5);
        break;
      case 'wall':
        this.set(a, 'wall', 5);
        break;
      case 'reflect':
        this.set(a, 'reflect', 8);
        break;
      case 'wind':
        this.set(b, 'slow', 6);
        break;
      case 'siphon':
        this.steal(a, b, 15);
        break;
    }
    return { ok: true };
  }
  steal(a, b, n) {
    const stolen = Math.min(n, b.mana, 100 - a.mana);
    b.mana -= stolen;
    a.mana += stolen;
    this.logEvent(a.c.name + '奪取 ' + Math.round(stolen) + ' 魔法。');
  }
  dash(a, multiplier, speed = 6, knockback = 2, kind = 'rush') {
    const b = this.opponent(a),
      dx = b.x - a.x,
      dz = b.z - a.z,
      d = Math.hypot(dx, dz) || 1;
    a.vx = (dx / d) * speed;
    a.vz = (dz / d) * speed;
    a.pending = { multiplier, knockback, kind, life: 1.7 };
  }
  signature(a, b) {
    switch (a.id) {
      case 'lubu':
        a.sequence = { remaining: 3, timer: 0, kind: 'lubu' };
        break;
      case 'guanyu':
        a.cast = { kind: 'guanyu', left: 2 };
        break;
      case 'zhangfei':
        this.set(b, 'root', 4);
        this.set(b, 'roarSlow', 4);
        if (b.cast?.kind === 'machao') this.interrupt(b);
        break;
      case 'zhaoyun':
        a.evades = 3;
        this.set(a, 'evade', 15);
        break;
      case 'zhugeliang': {
        const chance = Math.min(0.3, 0.1 + a.behindCount * 0.05);
        this.logEvent('心之一方成功率 ' + Math.round(chance * 100) + '%。');
        if (this.random() < chance) {
          b.hp = 0;
          this.end(a.ai ? 1 : 0, '心之一方・擊倒');
        } else {
          this.event('miss', { actor: a });
          this.logEvent('心之一方未能擊倒對手。');
        }
        break;
      }
      case 'liubei':
        a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.08);
        a.sequence = { remaining: 2, timer: 0.4, kind: 'summon' };
        break;
      case 'caocao':
        b.sealed = true;
        this.steal(a, b, 20);
        break;
      case 'simayi':
        a.stored = 0;
        this.set(a, 'store', 6);
        a.pending = null;
        break;
      case 'zhouyu':
        this.hazards.push({ owner: a, x: b.x, z: b.z, radius: 0.95, left: 10, tick: 0 });
        break;
      case 'diaochan':
        this.set(b, 'reverse', 5);
        break;
      case 'machao':
        a.cast = { kind: 'machao', left: 3 };
        this.set(a, 'runup', 3);
        break;
      case 'pangde':
        this.set(a, 'death', 8);
        if (a.hp / a.maxHp < 0.3) this.set(a, 'immovable', 8);
        break;
      case 'xiahou':
        for (const k of ['slow', 'roarSlow', 'root', 'reverse', 'weak', 'unstable'])
          delete a.status[k];
        a.sealed = false;
        a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.05);
        this.set(a, 'xiahouBoost', 5);
        break;
      case 'ganning': {
        const centered = this.has(b, 'center');
        delete b.status.center;
        const speed = Math.hypot(b.vx, b.vz),
          dx = speed > 0.1 ? b.vx / speed : 1,
          dz = speed > 0.1 ? b.vz / speed : 0;
        a.x = b.x - dx * 0.79;
        a.z = b.z - dz * 0.79;
        this.confine(a);
        if (centered) {
          b.x += 0.85;
          b.z += 0.5;
          this.confine(b);
        }
        this.hit(a, b, centered ? 1.8 : 1.2, { knockback: 1.5 });
        this.steal(a, b, 20);
        break;
      }
      case 'sunce':
        this.dash(a, 1.8, 7.2, 5.4, 'sunce');
        break;
    }
  }
  rivalry() {
    const ids = this.actors.map((a) => a.id);
    return WarData.rivals.find((r) => ids.includes(r.a) && ids.includes(r.b));
  }
  attack(a) {
    let n = a.c.attack;
    if (this.has(a, 'storm')) n *= 1.3;
    if (this.has(a, 'death')) n *= 1.5;
    if (this.has(a, 'xiahouBoost')) n *= 1.4;
    if (this.has(a, 'weak')) n *= 0.75;
    const r = this.rivalry();
    if (r && (r.bonus === 'both' || (r.bonus === 'a' && a.id === r.a))) n *= 1.05;
    return n;
  }
  defense(a) {
    return a.c.defense * (this.has(a, 'edge') ? 0.7 : 1);
  }
  damageFormula(attack, multiplier, defense) {
    return (attack * multiplier * 100) / (100 + defense);
  }
  hit(a, b, multiplier = 1, options = {}) {
    if (this.phase !== 'battle' || (a.hp <= 0 && !this.exchange) || b.hp <= 0) return 0;
    if (this.has(a, 'store') && !options.retaliation) return 0;
    if (b.evades > 0 && !options.unavoidable) {
      b.evades--;
      this.logEvent(b.c.name + '閃避成功，剩餘 ' + b.evades + ' 次。');
      this.event('evade', { actor: b });
      if (b.evades === 0) {
        delete b.status.evade;
        this.interrupt(a);
        this.hit(b, a, 1.4, { retaliation: true });
      }
      return 0;
    }
    let mult = multiplier;
    if (a.id === 'sunce' && a.firstHit) {
      mult *= 1.2;
      a.firstHit = false;
    }
    const raw =
      options.fixed ??
      this.damageFormula(
        this.attack(a),
        mult,
        this.defense(b) * (1 - (options.ignoreDefense || 0)),
      );
    let dealt = raw * (this.has(b, 'wall') ? 0.6 : 1) * (this.has(b, 'center') ? 0.5 : 1);
    dealt = Math.min(b.hp, dealt);
    b.hp = Math.max(0, b.hp - dealt);
    this.interrupt(b);
    a.mana = Math.min(100, a.mana + 3);
    b.mana = Math.min(100, b.mana + 6);
    if (b.id === 'xiahou' && dealt >= 65) b.mana = Math.min(100, b.mana + 5);
    b.integrity = Math.max(0, b.integrity - dealt / (5 + b.c.stability * 0.05));
    if (this.has(b, 'store')) b.stored += dealt;
    this.event('hit', { actor: b, attacker: a, damage: dealt });
    if (options.knockback) this.knock(a, b, options.knockback);
    if (this.has(b, 'reflect') && !options.noReflect) {
      delete b.status.reflect;
      this.directDamage(a, dealt * 0.5, b, '反震');
    }
    if (this.has(a, 'reverse') && !options.noReflect)
      this.directDamage(a, dealt * 0.25, b, '反轉反噬');
    if (options.kind === 'sunce' && Math.hypot(b.x, b.z) > 3.08 && b.hp > 0) {
      this.end(a.ai ? 1 : 0, '霸王突擊・出界');
      return dealt;
    }
    this.checkEnd();
    return dealt;
  }
  directDamage(target, n, source, label) {
    if (target.hp <= 0) return;
    const actual = Math.min(target.hp, n);
    target.hp -= actual;
    if (this.has(target, 'store')) target.stored += actual;
    this.interrupt(target);
    target.mana = Math.min(100, target.mana + 6);
    this.event('hit', { actor: target, attacker: source, damage: actual });
    this.logEvent(label + '：' + Math.round(actual) + ' 傷害。');
  }
  interrupt(a) {
    if (a.cast) {
      this.logEvent(
        a.c.name + '的' + (a.cast.kind === 'guanyu' ? '蓄力' : '助跑') + '被打斷！',
      );
      a.cast = null;
      delete a.status.runup;
      this.event('interrupt', { actor: a });
    }
  }
  knock(a, b, strength) {
    if (this.has(b, 'immovable') || this.has(b, 'center')) return;
    const dx = b.x - a.x,
      dz = b.z - a.z,
      d = Math.hypot(dx, dz) || 1,
      stability = b.c.stability * (this.has(b, 'unstable') ? 0.35 : 1),
      v = (strength * 100) / (55 + stability);
    b.vx += (dx / d) * v;
    b.vz += (dz / d) * v;
  }
  confine(a) {
    const r = Math.hypot(a.x, a.z);
    if (r > 3.12) {
      a.x *= 3.12 / r;
      a.z *= 3.12 / r;
    }
  }
  checkEnd() {
    if (this.phase !== 'battle' || this.exchange) return;
    const [a, b] = this.actors;
    const ad = a.hp <= 0 || a.integrity <= 0,
      bd = b.hp <= 0 || b.integrity <= 0;
    if (ad && bd) this.end(null, '同歸於盡');
    else if (ad) this.end(1, a.integrity <= 0 ? '爆裂終結' : '生命耗盡');
    else if (bd) this.end(0, b.integrity <= 0 ? '爆裂終結' : '生命耗盡');
  }
  end(winner, kind) {
    if (this.phase !== 'battle') return;
    this.phase = 'result';
    this.winner = winner;
    this.finishKind = kind;
    this.you = winner === 0 ? 1 : 0;
    this.ai = winner === 1 ? 1 : 0;
    this.logEvent(
      winner === null ? '平手。' : this.actors[winner].c.name + '獲勝：' + kind,
    );
    if (winner !== null) {
      const loser = this.actors[1 - winner];
      loser.dead = true;
      loser.burst = kind.includes('爆裂');
    }
    this.event('finish', { winner, kind });
  }
  pause() {
    if (this.phase === 'paused') {
      this.phase = this.resumePhase;
      this.resumePhase = null;
    } else if (['battle', 'charging', 'countdown'].includes(this.phase)) {
      this.resumePhase = this.phase;
      this.phase = 'paused';
    }
  }
  tick(dt) {
    if (this.phase !== 'battle') return;
    dt = Math.max(0, Math.min(0.05, dt));
    this.time += dt;
    this.roundElapsed += dt;
    this.collisionCooldown = Math.max(0, this.collisionCooldown - dt);
    this.aiTimer -= dt;
    for (const a of this.actors) {
      const b = this.opponent(a),
        behind = a.hp / a.maxHp < b.hp / b.maxHp;
      if (behind && !a.wasBehind) a.behindCount = Math.min(4, a.behindCount + 1);
      a.wasBehind = behind;
      a.globalCooldown = Math.max(0, a.globalCooldown - dt);
      for (const k in a.cooldowns) a.cooldowns[k] = Math.max(0, a.cooldowns[k] - dt);
      for (const k of Object.keys(a.status)) {
        a.status[k] -= dt;
        if (a.status[k] <= 0) {
          delete a.status[k];
          if (k === 'storm') this.set(a, 'weak', 3);
          if (k === 'evade') a.evades = 0;
          if (k === 'store') {
            const amount = a.stored;
            a.stored = 0;
            this.hit(a, b, 1, {
              fixed: amount * 1.5,
              retaliation: true,
              noReflect: true,
            });
            this.logEvent(a.c.name + '返還累積傷害 ' + Math.round(amount * 1.5) + '。');
          }
        }
      }
      if (a.cast) {
        a.cast.left -= dt;
        if (a.cast.left <= 0) {
          const kind = a.cast.kind;
          a.cast = null;
          delete a.status.runup;
          if (kind === 'guanyu') this.hit(a, b, 2, { ignoreDefense: 0.3, knockback: 1 });
          else this.dash(a, 2, 7.2, 3.5, 'machao');
        }
      }
      if (a.sequence) {
        a.sequence.timer -= dt;
        if (a.sequence.timer <= 0) {
          const seq = a.sequence;
          seq.remaining--;
          seq.timer = 0.65;
          if (seq.kind === 'lubu') {
            this.dash(a, 0.8, 5.5, 1.2, 'lubu');
          } else {
            this.hit(a, b, 0.75, { retaliation: true });
            this.event('summon', { actor: a, target: b, number: seq.remaining });
          }
          if (seq.remaining <= 0) {
            a.sequence = null;
            if (seq.kind === 'lubu') this.set(a, 'unstable', 5);
          }
        }
      }
      if (a.pending) {
        a.pending.life -= dt;
        if (a.pending.life <= 0) a.pending = null;
      }
      a.angle += (this.has(a, 'reverse') ? -1 : 1) * (18 + a.spin * 0.24) * dt;
    }
    if (this.phase !== 'battle') return;
    if (this.aiEnabled && this.aiTimer <= 0) {
      this.chooseAI();
      this.aiTimer = 1.6 + this.random() * 1.8;
    }
    for (const a of this.actors) {
      const b = this.opponent(a);
      if (this.has(a, 'center')) {
        a.x = 0;
        a.z = 0;
        a.vx = 0;
        a.vz = 0;
        continue;
      }
      if (a.cast?.kind === 'guanyu') {
        a.vx *= 0.85;
        a.vz *= 0.85;
      } else {
        let speed = a.c.speed / 70;
        if (this.has(a, 'slow')) speed *= 0.7;
        if (this.has(a, 'roarSlow')) speed *= 0.4;
        if (this.has(a, 'edge') || this.has(a, 'runup')) {
          const r = Math.hypot(a.x, a.z) || 1,
            nx = a.x / r,
            nz = a.z / r;
          a.vx += (-nz * 7 + (2.75 - r) * nx * 8) * speed * dt;
          a.vz += (nx * 7 + (2.75 - r) * nz * 8) * speed * dt;
        } else if (!a.pending) {
          const dx = b.x - a.x,
            dz = b.z - a.z,
            d = Math.hypot(dx, dz) || 1,
            tangent = Math.sin(this.time * 1.5 + (a.ai ? 2 : 0)) * 0.45;
          a.vx += ((dx / d) * 4.2 - (dz / d) * tangent - a.x * 0.2) * speed * dt;
          a.vz += ((dz / d) * 4.2 + (dx / d) * tangent - a.z * 0.2) * speed * dt;
        }
      }
      a.vx -= a.x * 0.45 * dt;
      a.vz -= a.z * 0.45 * dt;
      const damping = Math.exp(-0.5 * dt);
      a.vx *= damping;
      a.vz *= damping;
      const v = Math.hypot(a.vx, a.vz),
        max = a.pending ? 10 : 5.6 * (this.has(a, 'edge') ? 1.55 : 1);
      if (v > max) {
        a.vx *= max / v;
        a.vz *= max / v;
      }
      a.x += a.vx * dt;
      a.z += a.vz * dt;
      const r = Math.hypot(a.x, a.z),
        nx = a.x / (r || 1),
        nz = a.z / (r || 1),
        out = a.vx * nx + a.vz * nz;
      if (r > 3.5 && out > 3.5 && !this.has(a, 'immovable')) {
        this.end(a.ai ? 0 : 1, '出界落敗');
        return;
      }
      if (r > 3.28) {
        a.vx -= nx * (r - 3.28) * 40 * dt;
        a.vz -= nz * (r - 3.28) * 40 * dt;
        if (r > 3.62) {
          a.x = nx * 3.62;
          a.z = nz * 3.62;
          if (out > 0) {
            a.vx -= nx * out * 1.6;
            a.vz -= nz * out * 1.6;
          }
        }
      }
    }
    this.collide();
    if (this.phase !== 'battle') return;
    for (const fire of this.hazards) {
      fire.left -= dt;
      fire.tick -= dt;
      if (fire.tick <= 0) {
        fire.tick = 0.5;
        const target = this.opponent(fire.owner);
        if (Math.hypot(target.x - fire.x, target.z - fire.z) < fire.radius)
          this.hit(fire.owner, target, 0.3, { unavoidable: true, noReflect: true });
      }
    }
    this.hazards = this.hazards.filter((f) => f.left > 0);
    this.checkEnd();
    if (this.phase === 'battle' && this.roundElapsed >= 120) {
      const [a, b] = this.actors,
        delta = a.hp / a.maxHp - b.hp / b.maxHp;
      this.end(
        Math.abs(delta) < 0.00001 ? null : delta > 0 ? 0 : 1,
        '限時判定・剩餘生命比例',
      );
    }
  }
  collide() {
    const [a, b] = this.actors,
      dx = b.x - a.x,
      dz = b.z - a.z,
      d = Math.hypot(dx, dz) || 0.001;
    if (d >= 0.82) return;
    const nx = dx / d,
      nz = dz / d,
      overlap = 0.82 - d;
    const ca = this.has(a, 'center'),
      cb = this.has(b, 'center');
    if (!ca) {
      a.x -= nx * overlap * (cb ? 1 : 0.5);
      a.z -= nz * overlap * (cb ? 1 : 0.5);
    }
    if (!cb) {
      b.x += nx * overlap * (ca ? 1 : 0.5);
      b.z += nz * overlap * (ca ? 1 : 0.5);
    }
    const approach = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
    if (approach <= 0) return;
    const ma = 0.8 + a.c.stability / 100,
      mb = 0.8 + b.c.stability / 100,
      impulse = (1.65 * approach) / (1 / ma + 1 / mb);
    if (!ca && !this.has(a, 'immovable')) {
      a.vx -= (impulse * nx) / ma;
      a.vz -= (impulse * nz) / ma;
    }
    if (!cb && !this.has(b, 'immovable')) {
      b.vx += (impulse * nx) / mb;
      b.vz += (impulse * nz) / mb;
    }
    if (this.collisionCooldown > 0) return;
    this.collisionCooldown = 0.28;
    const basic = Math.min(1.1, 0.65 + approach * 0.05),
      ap = a.pending,
      bp = b.pending;
    a.pending = null;
    b.pending = null;
    this.exchange = true;
    if (!ca)
      this.hit(a, b, ap?.multiplier ?? basic, {
        knockback: ap?.knockback || 0.8,
        kind: ap?.kind,
      });
    if (this.phase === 'battle' && !cb)
      this.hit(b, a, bp?.multiplier ?? basic, {
        knockback: bp?.knockback || 0.8,
        kind: bp?.kind,
      });
    this.exchange = false;
    this.checkEnd();
  }
  chooseAI() {
    const a = this.actors[1],
      b = this.actors[0];
    let priority = [];
    if (b.cast || this.has(b, 'runup')) priority.push('signature', 'rush', 'wind');
    if (a.hp / a.maxHp < 0.4) priority.push('signature', 'wall', 'reflect');
    if (a.id === 'simayi' && (this.has(b, 'storm') || this.has(b, 'death')))
      priority.unshift('signature');
    if (this.has(b, 'store')) priority = ['wall', 'edge', 'siphon', ...priority];
    else
      priority.push(
        'signature',
        'rush',
        'storm',
        'reflect',
        'wind',
        'siphon',
        'wall',
        'edge',
      );
    for (const id of priority) {
      if (!this.reason(a, id)) {
        this.use(a, id);
        return;
      }
    }
  }
};
