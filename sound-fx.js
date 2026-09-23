'use strict';
// Original, sample-free Web Audio effects. No music files or network downloads.
window.SoundFX = (() => {
  let context = null,
    master = null,
    limiter = null,
    noiseBuffer = null,
    enabled = true,
    volume = 0.7,
    lastHit = -Infinity;
  const voices = new Set();
  const signatures = {
    lubu: { notes: [110, 147, 220], wave: 'sawtooth', step: 0.095, noise: 900 },
    guanyu: { notes: [147, 220, 440, 880], wave: 'triangle', step: 0.14, noise: 2100 },
    zhangfei: { notes: [90, 65, 48], wave: 'sawtooth', step: 0.1, noise: 420 },
    zhaoyun: { notes: [587, 880, 1175, 1760], wave: 'sine', step: 0.055, noise: 3600 },
    zhugeliang: { notes: [392, 494, 587, 784, 1175], wave: 'sine', step: 0.11, noise: 0 },
    liubei: { notes: [262, 330, 392, 523], wave: 'sine', step: 0.13, noise: 0 },
    caocao: { notes: [196, 196, 147, 98], wave: 'square', step: 0.1, noise: 700 },
    simayi: { notes: [220, 165, 110, 82], wave: 'triangle', step: 0.15, noise: 550 },
    zhouyu: { notes: [110, 165, 247], wave: 'sawtooth', step: 0.09, noise: 1800 },
    diaochan: { notes: [880, 659, 988, 740], wave: 'sine', step: 0.12, noise: 0 },
    machao: { notes: [98, 147, 220, 330], wave: 'triangle', step: 0.085, noise: 2600 },
    pangde: { notes: [73, 73, 55], wave: 'triangle', step: 0.15, noise: 300 },
    xiahou: { notes: [130, 196, 130], wave: 'square', step: 0.09, noise: 650 },
    ganning: { notes: [988, 494, 247], wave: 'sine', step: 0.075, noise: 3100 },
    sunce: { notes: [98, 196, 392], wave: 'sawtooth', step: 0.09, noise: 1000 },
  };
  // 預設啟用，但等第一次使用者操作才建立 AudioContext。
  async function unlock() {
    if (!enabled) return false;
    if (!context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw Error('Web Audio unavailable');
      context = new Audio();
      master = context.createGain();
      limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -16;
      limiter.knee.value = 15;
      limiter.ratio.value = 8;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.16;
      master.gain.value = volume * 0.65;
      master.connect(limiter);
      limiter.connect(context.destination);
      noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (context.state === 'suspended') await context.resume();
    return context.state === 'running';
  }
  function stop() {
    for (const source of voices) {
      try {
        source.stop();
      } catch {}
    }
    voices.clear();
    lastHit = -Infinity;
  }
  async function setEnabled(value) {
    enabled = !!value;
    if (!enabled) {
      stop();
      return false;
    }
    try {
      await unlock();
      return enabled;
    } catch (e) {
      enabled = false;
      stop();
      throw e;
    }
  }
  function setVolume(value) {
    volume = Math.max(0, Math.min(1, Number(value) || 0));
    if (master) master.gain.setTargetAtTime(volume * 0.65, context.currentTime, 0.025);
  }
  // 所有音源共用短起音、自然衰減；結束或靜音時會釋放節點。
  function voice(source, nodes, gain, pan, start, duration, level) {
    if (voices.size >= 64) return;
    const envelope = context.createGain(),
      panner = context.createStereoPanner();
    panner.pan.value = Math.max(-0.8, Math.min(0.8, pan || 0));
    source.connect(gain || envelope);
    if (gain) gain.connect(envelope);
    envelope.connect(panner);
    panner.connect(master);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), start + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    voices.add(source);
    source.onended = () => {
      voices.delete(source);
      [source, ...nodes, envelope, panner].forEach((n) => n.disconnect());
    };
    source.start(start);
    source.stop(start + duration + 0.02);
  }
  function tone(
    startFrequency,
    endFrequency,
    duration = 0.2,
    level = 0.08,
    wave = 'sine',
    delay = 0,
    pan = 0,
  ) {
    if (voices.size >= 64) return;
    const at = context.currentTime + delay,
      oscillator = context.createOscillator();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(startFrequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, endFrequency),
      at + duration,
    );
    voice(oscillator, [], null, pan, at, duration, level);
  }
  function noise(
    startFrequency,
    endFrequency,
    duration = 0.15,
    level = 0.09,
    delay = 0,
    pan = 0,
  ) {
    if (voices.size >= 64) return;
    const at = context.currentTime + delay,
      source = context.createBufferSource(),
      filter = context.createBiquadFilter();
    source.buffer = noiseBuffer;
    filter.type = 'bandpass';
    filter.Q.value = 0.75;
    filter.frequency.setValueAtTime(startFrequency, at);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(40, endFrequency),
      at + duration,
    );
    voice(source, [filter], filter, pan, at, duration, level);
  }
  function chime(notes, step = 0.08, wave = 'sine', level = 0.07, pan = 0) {
    notes.forEach((f, i) => tone(f, f * 0.995, 0.3, level, wave, i * step, pan));
  }
  // 撞擊由三層組成：低頻重量、金屬脆響、短暫的空氣震動。
  function impact(force = 1, delay = 0, pan = 0) {
    tone(160, 38, 0.26, 0.25 * force, 'sine', delay, pan);
    tone(95, 44, 0.2, 0.12 * force, 'triangle', delay, pan);
    noise(3100, 650, 0.16, 0.24 * force, delay, pan);
    tone(1750, 1210, 0.22, 0.065 * force, 'sine', delay, pan);
    noise(220, 70, 0.3, 0.17 * force, delay + 0.018, pan);
  }

  function slash(delay = 0, pan = 0, weight = 1) {
    noise(650, 6200, 0.11, 0.19 * weight, delay, pan);
    noise(5300, 650, 0.22, 0.22 * weight, delay + 0.075, -pan);
    tone(980, 170, 0.16, 0.06 * weight, 'sawtooth', delay + 0.06, pan);
  }

  function shield(delay = 0, pan = 0) {
    impact(0.65, delay, pan);
    [420, 710, 1180].forEach((frequency) =>
      tone(frequency, frequency * 0.97, 0.5, 0.075, 'sine', delay + 0.025, pan),
    );
  }

  // 每位武將保留自己的音階，再疊上辨識度更高的動作音型。
  function signature(character, pan) {
    const theme = signatures[character];
    if (!theme) return;
    chime(theme.notes, theme.step, theme.wave, 0.08, pan);
    switch (character) {
      case 'lubu': // 三段重斬
        [0, 0.16, 0.34].forEach((delay, index) => {
          slash(delay, index % 2 ? -0.55 : 0.55, 0.7);
          impact(0.75, delay + 0.1, pan);
        });
        break;
      case 'guanyu': // 蓄勢、一道長斬、金屬尾音
        tone(75, 310, 0.3, 0.14, 'triangle', 0, pan);
        slash(0.2, pan, 1.3);
        tone(1480, 1380, 0.65, 0.09, 'sine', 0.36, pan);
        break;
      case 'zhangfei': // 低頻怒吼與震波
        tone(105, 39, 0.62, 0.18, 'sawtooth', 0, pan);
        noise(540, 110, 0.65, 0.26, 0, pan);
        impact(1.15, 0.09, pan);
        break;
      case 'zhaoyun': // 左右穿梭的連續槍風
        [0, 0.1, 0.2, 0.3].forEach((delay, index) =>
          slash(delay, index % 2 ? 0.65 : -0.65, 0.5),
        );
        break;
      case 'zhugeliang': // 展開法陣的空靈共鳴
        [196, 294, 392].forEach((frequency) =>
          tone(frequency, frequency * 2, 0.75, 0.06, 'sine', 0, pan),
        );
        noise(600, 3500, 0.7, 0.09, 0, pan);
        break;
      case 'liubei': // 三道援軍和弦
        [0, 0.2, 0.4].forEach((delay) => {
          tone(262, 262, 0.46, 0.08, 'triangle', delay, pan);
          tone(392, 392, 0.46, 0.06, 'sine', delay, -pan);
        });
        break;
      case 'caocao': // 王令落印、低沉號角
        shield(0.04, pan);
        tone(98, 98, 0.55, 0.08, 'sawtooth', 0, pan);
        tone(147, 146, 0.55, 0.055, 'sawtooth', 0, -pan);
        break;
      case 'simayi': // 向內收束的暗流
        noise(3200, 110, 0.75, 0.17, 0, pan);
        tone(185, 46, 0.75, 0.12, 'sine', 0, pan);
        break;
      case 'zhouyu': // 火焰噴發與爆燃
        [0, 0.09, 0.23, 0.41].forEach((delay) =>
          noise(2100, 300, 0.34, 0.22, delay, pan),
        );
        impact(0.85, 0.06, pan);
        break;
      case 'diaochan': // 左右交錯的幻音
        [659, 988, 740, 1109].forEach((frequency, index) =>
          tone(
            frequency * 0.5,
            frequency,
            0.34,
            0.08,
            'sine',
            index * 0.13,
            index % 2 ? 0.6 : -0.6,
          ),
        );
        break;
      case 'machao': // 鐵騎踏地後加速
        [0, 0.13, 0.26].forEach((delay) => impact(0.5, delay, pan));
        noise(450, 4600, 0.5, 0.18, 0.16, pan);
        break;
      case 'pangde': // 三記沉重戰鼓
        [0, 0.19, 0.38].forEach((delay) => {
          tone(82, 32, 0.34, 0.22, 'sine', delay, pan);
          noise(420, 90, 0.21, 0.17, delay, pan);
        });
        break;
      case 'xiahou': // 鎧甲撞擊與反攻
        shield(0, pan);
        noise(750, 3400, 0.32, 0.15, 0.18, pan);
        break;
      case 'ganning': // 急速掠過、鐵鉤迴響
        slash(0, -0.65, 0.9);
        tone(2150, 1230, 0.45, 0.11, 'sine', 0.14, 0.65);
        impact(0.65, 0.19, pan);
        break;
      case 'sunce': // 霸王突進的爆發衝擊
        noise(450, 5200, 0.2, 0.2, 0, pan);
        impact(1.3, 0.16, pan);
        tone(165, 48, 0.42, 0.12, 'sawtooth', 0.15, pan);
        break;
    }
  }

  // 結算音效約兩秒：先留出空間，再以節奏、和聲與低頻建立張力。
  // 清掉尚未結束的碰撞或招式，避免搶走結局的重音。
  function victory() {
    stop();
    impact(0.9, 0, 0);
    tone(82, 48, 0.3, 0.16, 'sine', 0.22);
    const fanfare = [392, 494, 587, 784];
    fanfare.forEach((frequency, index) => {
      const delay = 0.18 + index * 0.18;
      tone(frequency, frequency, 0.46, 0.12, 'triangle', delay, -0.25);
      tone(frequency * 1.005, frequency, 0.42, 0.035, 'sawtooth', delay, 0.25);
    });
    // 最後一記戰鼓接寬幅大和弦，留下高音餘韻。
    impact(0.65, 0.95);
    [196, 392, 494, 587, 784].forEach((frequency, index) =>
      tone(frequency, frequency * 0.999, 1.3, 0.075, 'triangle', 0.98, (index - 2) * 0.2),
    );
    noise(2600, 7200, 0.65, 0.09, 0.9);
    tone(1568, 1566, 0.95, 0.045, 'sine', 1.15, 0.4);
  }

  function defeat() {
    stop();
    impact(1.05, 0);
    // 失速下墜的氣流與低音，接短暫停頓後的黯淡和弦。
    tone(310, 42, 0.7, 0.11, 'sawtooth', 0.08, -0.2);
    noise(3900, 110, 0.85, 0.2, 0.04, 0.2);
    tone(68, 28, 0.9, 0.2, 'sine', 0.03);
    [294, 233, 196].forEach((frequency, index) =>
      tone(
        frequency,
        frequency * 0.97,
        0.72,
        0.1,
        'triangle',
        0.3 + index * 0.2,
        (index - 1) * 0.3,
      ),
    );
    [98, 147, 233].forEach((frequency, index) =>
      tone(frequency, frequency * 0.985, 1.05, 0.075, 'sine', 0.88, (index - 1) * 0.3),
    );
    noise(410, 65, 0.8, 0.11, 0.84);
  }

  function play(kind, data = {}) {
    if (!enabled || !context || context.state !== 'running' || document.hidden) return;
    const pan = Math.max(-0.8, Math.min(0.8, (data.x || 0) / 4));
    switch (kind) {
      case 'hit': {
        if (context.currentTime - lastHit < 0.045) return;
        lastHit = context.currentTime;
        const force = Math.max(0.25, Math.min(1.5, (data.damage || 35) / 85));
        impact(force, 0, pan);
        tone(2630, 2210, 0.12, 0.04 * force, 'sine', 0.008, pan);
        break;
      }
      case 'skill': {
        const id = data.id;
        if (id === 'signature') {
          signature(data.character, pan);
          break;
        }
        if (id === 'storm') {
          noise(450, 3200, 0.48, 0.22, 0, pan);
          impact(0.7, 0.15, pan);
          tone(90, 210, 0.35, 0.08, 'sawtooth', 0, pan);
        } else if (id === 'rush') {
          slash(0, pan, 1.1);
          impact(0.8, 0.12, pan);
          tone(240, 65, 0.18, 0.12, 'triangle', 0.07, pan);
        } else if (id === 'center') {
          chime([330, 440, 660], 0.07, 'sine', 0.08, pan);
          tone(150, 55, 0.5, 0.15, 'triangle', 0, pan);
        } else if (id === 'edge') {
          noise(1700, 5000, 0.35, 0.12, 0, pan);
          tone(330, 880, 0.32, 0.055, 'sine', 0, pan);
        } else if (id === 'wall') {
          shield(0, pan);
          chime([660, 990], 0.035, 'sine', 0.065, pan);
        } else if (id === 'reflect') {
          chime([1100, 1650, 2200], 0.045, 'sine', 0.09, pan);
          impact(0.6, 0.08, pan);
          noise(4500, 1900, 0.1, 0.08, 0, pan);
        } else if (id === 'wind') {
          noise(2600, 350, 0.5, 0.18, 0, pan);
          tone(190, 70, 0.4, 0.045, 'sine', 0, pan);
        } else if (id === 'siphon') {
          tone(880, 75, 0.65, 0.13, 'sine', 0, pan);
          noise(2600, 180, 0.6, 0.18, 0, pan);
          chime([440, 554, 659], 0.09, 'sine', 0.045, pan);
        }
        break;
      }
      case 'charge':
        tone(110, 550, 0.48, 0.09, 'triangle');
        noise(450, 1600, 0.3, 0.035);
        break;
      case 'launch':
        slash(0, 0, 1.2);
        impact(1.2, 0.11);
        tone(500, 70, 0.35, 0.14, 'sawtooth');
        chime([440, 880], 0.06, 'sine', 0.07);
        break;
      case 'evade':
        noise(4000, 1300, 0.14, 0.09, 0, pan);
        tone(1300, 1900, 0.1, 0.05, 'sine', 0, pan);
        break;
      case 'interrupt':
      case 'seal':
        tone(180, 65, 0.18, 0.085, 'square', 0, pan);
        noise(950, 300, 0.12, 0.09, 0, pan);
        break;
      case 'win':
        victory();
        break;
      case 'lose':
        defeat();
        break;
      case 'draw':
        chime([330, 392, 330], 0.12, 'sine', 0.08);
        break;
      case 'enabled':
        chime([523, 784], 0.07, 'sine', 0.055);
        break;
    }
  }
  return {
    unlock,
    setEnabled,
    setVolume,
    play,
    stop,
    get enabled() {
      return enabled;
    },
    get activeVoices() {
      return voices.size;
    },
    get state() {
      return context?.state || 'uninitialized';
    },
    signatures,
  };
})();
