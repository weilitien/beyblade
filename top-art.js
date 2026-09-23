'use strict';
// Original geometric tops: machined blade bevels, layered resin, and vector crests.
// Shared by the live battle, loadout previews, and the inspect turntable.
window.TopArt = (() => {
  const TAU = Math.PI * 2;
  const skins = {
    attack: {
      color: '#21ddd1',
      light: '#b9fff3',
      dark: '#056575',
      secondary: '#603de0',
      gold: '#edcd72',
      blades: 3,
      crest: 'dragon',
      title: '蒼龍・電光刃',
      code: 'VS / 03',
      material: '三翼銀刃 × 翡翠晶體 × 紫晶軸心',
    },
    defense: {
      color: '#a577ff',
      light: '#ecd6ff',
      dark: '#39246d',
      secondary: '#53ce83',
      gold: '#cad6e8',
      blades: 5,
      crest: 'wolf',
      title: '銀狼・重裝盾',
      code: 'IA / 05',
      material: '五重裝甲 × 紫晶底盤 × 碧綠軸心',
    },
    stamina: {
      color: '#38d8a6',
      light: '#ceffe6',
      dark: '#11635c',
      secondary: '#1579cc',
      gold: '#ffd967',
      blades: 6,
      crest: 'eagle',
      title: '翠鷹・永旋翼',
      code: 'AD / 06',
      material: '六翼銀環 × 翡翠樹脂 × 黃金徽章',
    },
    rival: {
      color: '#ff573b',
      light: '#ffdab0',
      dark: '#8a162b',
      secondary: '#ff9624',
      gold: '#ffd45f',
      blades: 3,
      crest: 'phoenix',
      title: '烈焰・鳳凰刃',
      code: 'EG / 03',
      material: '烈焰紅翼 × 黑銀刃環 × 琥珀軸心',
    },
  };
  function render(
    ctx,
    {
      x = 0,
      y = 0,
      size = 100,
      angle = 0,
      tilt = 0.66,
      skin = 'attack',
      explode = 0,
    } = {},
  ) {
    const s = skins[skin] || skins.attack,
      faces = [],
      body = (skins[skin] || skins.attack).body || 1,
      sin = Math.sin(tilt),
      cos = Math.cos(tilt),
      ca = Math.cos(angle),
      sa = Math.sin(angle);
    const world = (p) => [p[0] * ca - p[2] * sa, p[1], p[0] * sa + p[2] * ca];
    const project = (p) => [x + p[0] * size, y + (p[2] * sin - p[1] * cos) * size];
    const face = (ps, material = 'metal', color = null) => {
      const v = ps.map(world);
      const a = v[0],
        b = v[1],
        c = v[2],
        u = b.map((n, i) => n - a[i]),
        w = c.map((n, i) => n - a[i]);
      let n = [
          u[1] * w[2] - u[2] * w[1],
          u[2] * w[0] - u[0] * w[2],
          u[0] * w[1] - u[1] * w[0],
        ],
        len = Math.hypot(...n) || 1;
      n = n.map((v) => v / len);
      faces.push({
        v,
        material,
        color,
        normal: n,
        depth: v.reduce((d, p) => d + p[2] * cos + p[1] * sin, 0) / v.length,
      });
    };
    const polar = (r, a, h) => [Math.cos(a) * r, h, Math.sin(a) * r];
    function band(r1, r2, h1, h2, material, color, n = 48, gear = 0) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU,
          b = ((i + 1) / n) * TAU,
          ra = r1 + (i % 2 ? gear : 0),
          rb = r1 + ((i + 1) % 2 ? gear : 0);
        face(
          [polar(ra, a, h1), polar(rb, b, h1), polar(r2, b, h2), polar(r2, a, h2)],
          material,
          color,
        );
      }
    }
    // Fluted driver and translucent ratchet. Each layer has its own silhouette.
    band(
      0.08,
      0.15,
      -0.82 - explode * 0.55,
      -0.59 - explode * 0.55,
      'resin',
      s.secondary,
      20,
    );
    band(
      0.15,
      0.22,
      -0.59 - explode * 0.55,
      -0.25 - explode * 0.55,
      'resin',
      s.secondary,
      20,
      0.025,
    );
    band(
      0.22,
      0.36,
      -0.25 - explode * 0.55,
      -0.21 - explode * 0.55,
      'resin',
      s.secondary,
      32,
    );
    band(
      0.65 * body,
      0.77 * body,
      -0.22 - explode * 0.25,
      -0.16 - explode * 0.25,
      'resin',
      s.secondary,
      48,
      0.04,
    );
    band(
      0.77 * body,
      0.82 * body,
      -0.16 - explode * 0.25,
      -0.035 - explode * 0.25,
      'resin',
      s.color,
      48,
      0.015,
    );
    band(
      0.82 * body,
      0.68 * body,
      -0.035 - explode * 0.25,
      0.0 - explode * 0.25,
      'resin',
      s.light,
      48,
    );
    band(0.81 * body, 0.92 * body, 0.015, 0.075, 'dark');
    band(0.92 * body, 0.94 * body, 0.075, 0.125, 'metal');
    band(0.94 * body, 0.75 * body, 0.125, 0.16, 'metal');
    band(0.68 * body, 0.8 * body, 0.12, 0.2, 'resin', s.color);
    band(0.8 * body, 0.52 * body, 0.2, 0.29, 'resin', s.color);
    const count = s.blades,
      sector = TAU / count;
    for (let k = 0; k < count; k++) {
      const a = k * sector,
        ex = explode * 0.3;
      // A swept claw, cut into three reflective bevels around a raised ridge.
      const outline = s.profile
        ? s.profile.map(([r, t, h]) => polar(r, a + t * sector, h + ex))
        : [
            polar(0.4, a + 0.12 * sector, 0.28 + ex),
            polar(0.73, a - 0.04 * sector, 0.29 + ex),
            polar(1.05, a + 0.13 * sector, 0.17 + ex),
            polar(1.08, a + 0.35 * sector, 0.19 + ex),
            polar(0.84, a + 0.62 * sector, 0.28 + ex),
            polar(0.54, a + 0.72 * sector, 0.29 + ex),
          ];
      const ridge = polar(0.74, a + 0.31 * sector, (s.ridge || 0.42) + ex);
      for (let i = 0; i < outline.length; i++) {
        const next = (i + 1) % outline.length;
        face([outline[i], outline[next], ridge], 'metal');
        const lo = outline[i].map((v, j) => (j === 1 ? v - (s.thickness || 0.13) : v)),
          ln = outline[next].map((v, j) => (j === 1 ? v - (s.thickness || 0.13) : v));
        face([lo, ln, outline[next], outline[i]], i === 2 ? 'dark' : 'metal');
      }
      // Crystal inlays, polished edge strips and mechanical screws.
      const inset = [
        polar(0.47, a + 0.73 * sector, 0.285 + ex),
        polar(0.84 * body, a + 0.69 * sector, 0.23 + ex),
        polar(0.92 * body, a + 0.83 * sector, 0.2 + ex),
        polar(0.69, a + 0.99 * sector, 0.29 + ex),
      ];
      face(inset, 'resin', s.color);
      face(
        [inset[0], inset[1], polar(0.69, a + 0.8 * sector, 0.37 + ex)],
        'resin',
        s.light,
      );
      face(
        [
          polar(0.8, a + 0.02 * sector, 0.32 + ex),
          polar(1.03, a + 0.15 * sector, 0.21 + ex),
          polar(0.96, a + 0.19 * sector, 0.255 + ex),
        ],
        'bright',
      );
      const bolt = polar(0.78, a + 0.46 * sector, 0.36 + ex);
      face(
        Array.from({ length: 8 }, (_, i) => [
          bolt[0] + Math.cos((i / 8) * TAU) * 0.045,
          bolt[1],
          bolt[2] + Math.sin((i / 8) * TAU) * 0.045,
        ]),
        'dark',
      );
      face(
        [
          [bolt[0] - 0.029, bolt[1] + 0.003, bolt[2] - 0.008],
          [bolt[0] + 0.029, bolt[1] + 0.003, bolt[2] - 0.008],
          [bolt[0] + 0.029, bolt[1] + 0.003, bolt[2] + 0.008],
          [bolt[0] - 0.029, bolt[1] + 0.003, bolt[2] + 0.008],
        ],
        'bright',
      );
    }
    const crestHeight = 0.37 + explode * 0.65;
    band(0.35, 0.39, 0.24 + explode * 0.65, crestHeight - 0.02, 'gold', s.gold, 48);
    band(0.39, 0.34, crestHeight - 0.02, crestHeight + 0.005, 'gold', s.gold, 48);
    face(
      Array.from({ length: 48 }, (_, i) => polar(0.338, (i / 48) * TAU, crestHeight)),
      'crest',
    );
    faces.sort((a, b) => a.depth - b.depth);
    function polygon(v) {
      ctx.beginPath();
      v.forEach((p, i) => (i ? ctx.lineTo(...project(p)) : ctx.moveTo(...project(p))));
      ctx.closePath();
    }
    for (const f of faces) {
      if (f.material === 'crest') {
        const center = project(world([0, crestHeight, 0]));
        ctx.save();
        ctx.translate(...center);
        ctx.scale(size, size * sin);
        ctx.rotate(angle);
        crest(ctx, s);
        ctx.restore();
        continue;
      }
      polygon(f.v);
      const pts = f.v.map(project),
        xs = pts.map((p) => p[0]),
        ys = pts.map((p) => p[1]);
      const x0 = Math.min(...xs),
        x1 = Math.max(...xs),
        y0 = Math.min(...ys),
        y1 = Math.max(...ys);
      const g = ctx.createLinearGradient(x0, y0, x1 + 0.01, y1 + 0.01),
        n = f.normal;
      const facing = Math.abs(n[0] * -0.5 + n[1] * 0.8 + n[2] * -0.4);
      if (f.material === 'metal') {
        const palettes = {
          silver: ['#f7fcff', '#aab8c5', '#394858'],
          gunmetal: ['#d0deeb', '#58677b', '#152135'],
          obsidian: ['#b6acd0', '#3e3755', '#100f22'],
          gold: ['#fff4cb', '#d2ab58', '#76532a'],
          rose: ['#fff0e6', '#d6a3a0', '#6e424d'],
          ivory: ['#ffffff', '#eee6ce', '#8c977d'],
          bronze: ['#ffe2ba', '#aa7952', '#4e342c'],
        };
        const [hi, mid, lo] = palettes[s.metal] || palettes.silver;
        const stops =
          facing > 0.52 ? [hi, mid, lo, hi, mid, lo] : [lo, mid, hi, mid, lo, mid];
        [0, 0.16, 0.38, 0.52, 0.74, 1].forEach((t, i) => g.addColorStop(t, stops[i]));
      } else if (f.material === 'resin') {
        g.addColorStop(0, s.light);
        g.addColorStop(0.18, f.color || s.color);
        g.addColorStop(0.62, f.color === s.secondary ? s.secondary : s.dark);
        g.addColorStop(1, f.color || s.color);
      } else if (f.material === 'gold') {
        g.addColorStop(0, '#fff3c8');
        g.addColorStop(0.3, f.color);
        g.addColorStop(0.65, '#766127');
        g.addColorStop(1, '#ffe5a0');
      } else if (f.material === 'bright') {
        g.addColorStop(0, '#ffffff');
        g.addColorStop(1, '#adbecb');
      } else {
        g.addColorStop(0, '#081323');
        g.addColorStop(0.5, '#536272');
        g.addColorStop(1, '#111925');
      }
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = f.material === 'metal' ? '#d3edff55' : '#d2fbff22';
      ctx.lineWidth = size > 60 ? 0.45 : 0.2;
      ctx.stroke();
    }
  }
  function crest(ctx, s) {
    const disc = ctx.createRadialGradient(-0.1, -0.1, 0, 0, 0, 0.34);
    disc.addColorStop(0, s.dark);
    disc.addColorStop(1, '#071526');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(0, 0, 0.333, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = s.gold;
    ctx.lineWidth = 0.013;
    ctx.beginPath();
    ctx.arc(0, 0, 0.305, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 0.273, Math.sin(a) * 0.273);
      ctx.lineTo(Math.cos(a) * 0.29, Math.sin(a) * 0.29);
      ctx.stroke();
    }
    function poly(points, fill, stroke = '#051523') {
      ctx.beginPath();
      points.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 0.015;
      ctx.stroke();
    }
    const line = (points, color = s.gold, width = 0.025) => {
      ctx.beginPath();
      points.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    };
    const circle = (x, y, r, fill) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = fill;
      ctx.fill();
    };
    if (s.crest === 'halberd') {
      poly(
        [
          [-0.025, 0.24],
          [-0.025, -0.13],
          [-0.075, -0.11],
          [0, -0.26],
          [0.075, -0.11],
          [0.025, -0.13],
          [0.025, 0.24],
        ],
        s.gold,
      );
      poly(
        [
          [-0.04, -0.1],
          [-0.19, -0.2],
          [-0.15, -0.04],
          [-0.06, 0.025],
          [-0.04, -0.015],
        ],
        s.light,
      );
      poly(
        [
          [0.04, -0.1],
          [0.19, -0.2],
          [0.15, -0.04],
          [0.06, 0.025],
          [0.04, -0.015],
        ],
        s.light,
      );
      line(
        [
          [-0.09, 0.1],
          [0.09, 0.1],
        ],
        s.color,
        0.035,
      );
    } else if (s.crest === 'spear') {
      for (const a of [-0.42, 0.42]) {
        ctx.save();
        ctx.rotate(a);
        poly(
          [
            [-0.014, 0.24],
            [-0.014, -0.1],
            [-0.065, -0.1],
            [0, -0.26],
            [0.065, -0.1],
            [0.014, -0.1],
            [0.014, 0.24],
          ],
          s.light,
        );
        line(
          [
            [-0.06, -0.07],
            [0.07, -0.015],
          ],
          s.color,
          0.04,
        );
        ctx.restore();
      }
    } else if (s.crest === 'serpent') {
      ctx.beginPath();
      ctx.moveTo(0.13, -0.14);
      ctx.bezierCurveTo(-0.24, -0.3, -0.26, 0.04, -0.02, 0.015);
      ctx.bezierCurveTo(0.26, -0.02, 0.17, 0.25, -0.14, 0.19);
      ctx.strokeStyle = s.gold;
      ctx.lineWidth = 0.072;
      ctx.stroke();
      poly(
        [
          [0.04, -0.17],
          [0.19, -0.21],
          [0.23, -0.12],
          [0.13, -0.07],
        ],
        s.light,
      );
      circle(0.16, -0.155, 0.015, s.color);
      line(
        [
          [0.2, -0.1],
          [0.25, -0.055],
        ],
        s.color,
        0.015,
      );
    } else if (s.crest === 'bagua') {
      circle(0, 0, 0.15, s.light);
      ctx.beginPath();
      ctx.arc(0, 0, 0.15, -Math.PI / 2, Math.PI / 2);
      ctx.arc(0, 0.075, 0.075, Math.PI / 2, -Math.PI / 2, true);
      ctx.arc(0, -0.075, 0.075, Math.PI / 2, -Math.PI / 2);
      ctx.fillStyle = s.dark;
      ctx.fill();
      circle(0, -0.075, 0.024, s.light);
      circle(0, 0.075, 0.024, s.dark);
      for (let k = 0; k < 8; k++) {
        ctx.save();
        ctx.rotate((k * TAU) / 8);
        for (let j = 0; j < 3; j++) {
          let h = -0.19 - j * 0.026;
          if ((k >> j) & 1) {
            line(
              [
                [-0.063, h],
                [-0.015, h],
              ],
              s.gold,
              0.014,
            );
            line(
              [
                [0.015, h],
                [0.063, h],
              ],
              s.gold,
              0.014,
            );
          } else
            line(
              [
                [-0.063, h],
                [0.063, h],
              ],
              s.gold,
              0.014,
            );
        }
        ctx.restore();
      }
    } else if (s.crest === 'peach') {
      for (let i = 0; i < 5; i++) {
        const a = (i * TAU) / 5 - Math.PI / 2;
        circle(Math.cos(a) * 0.11, Math.sin(a) * 0.11, 0.09, '#f6b4d7');
      }
      circle(0, 0, 0.05, s.gold);
      line(
        [
          [-0.16, 0.2],
          [0.15, -0.17],
        ],
        s.light,
        0.024,
      );
      line(
        [
          [0.16, 0.2],
          [-0.15, -0.17],
        ],
        s.light,
        0.024,
      );
    } else if (s.crest === 'crown') {
      poly(
        [
          [-0.21, -0.15],
          [-0.11, -0.045],
          [0, -0.23],
          [0.11, -0.045],
          [0.21, -0.15],
          [0.16, 0.15],
          [-0.16, 0.15],
        ],
        s.gold,
      );
      line(
        [
          [-0.15, 0.075],
          [0.15, 0.075],
        ],
        s.dark,
        0.024,
      );
      poly(
        [
          [0, -0.09],
          [0.045, -0.02],
          [0, 0.04],
          [-0.045, -0.02],
        ],
        s.color,
      );
    } else if (s.crest === 'raven') {
      poly(
        [
          [-0.26, -0.15],
          [-0.1, -0.1],
          [0.03, -0.23],
          [0.12, -0.14],
          [0.23, -0.11],
          [0.12, -0.045],
          [0.08, 0.05],
          [0.2, 0.2],
          [0, 0.13],
          [-0.18, 0.22],
          [-0.08, 0.025],
          [-0.2, -0.02],
        ],
        s.gold,
      );
      poly(
        [
          [-0.19, -0.12],
          [-0.055, -0.055],
          [0.045, 0.07],
          [-0.12, 0.14],
          [-0.07, 0.02],
        ],
        s.color,
      );
      circle(0.085, -0.135, 0.015, s.light);
    } else if (s.crest === 'lotus') {
      for (const a of [-0.95, -0.48, 0, 0.48, 0.95]) {
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(0, 0.17);
        ctx.bezierCurveTo(-0.15, 0.03, -0.07, -0.16, 0, -0.25);
        ctx.bezierCurveTo(0.07, -0.16, 0.15, 0.03, 0, 0.17);
        ctx.fillStyle = a === 0 ? s.light : s.color;
        ctx.fill();
        ctx.strokeStyle = s.gold;
        ctx.lineWidth = 0.013;
        ctx.stroke();
        ctx.restore();
      }
      line(
        [
          [-0.16, 0.2],
          [0.16, 0.2],
        ],
        s.gold,
        0.018,
      );
    } else if (s.crest === 'horse') {
      poly(
        [
          [-0.15, 0.22],
          [-0.12, 0.03],
          [-0.2, -0.035],
          [-0.08, -0.18],
          [-0.04, -0.26],
          [0.015, -0.17],
          [0.1, -0.23],
          [0.09, -0.11],
          [0.21, -0.035],
          [0.17, 0.055],
          [0.055, 0.035],
          [0.12, 0.22],
        ],
        s.light,
      );
      poly(
        [
          [-0.04, -0.13],
          [-0.13, 0.015],
          [-0.15, 0.2],
          [-0.02, 0.1],
          [0.025, -0.09],
        ],
        s.color,
      );
      circle(0.09, -0.065, 0.018, s.gold);
    } else if (s.crest === 'coffin') {
      poly(
        [
          [-0.09, -0.24],
          [0.09, -0.24],
          [0.18, -0.11],
          [0.12, 0.23],
          [-0.12, 0.23],
          [-0.18, -0.11],
        ],
        s.gold,
      );
      poly(
        [
          [-0.06, -0.19],
          [0.06, -0.19],
          [0.12, -0.09],
          [0.08, 0.18],
          [-0.08, 0.18],
          [-0.12, -0.09],
        ],
        s.dark,
      );
      line(
        [
          [0, -0.13],
          [0, 0.12],
        ],
        s.light,
        0.023,
      );
      line(
        [
          [-0.07, -0.055],
          [0.07, -0.055],
        ],
        s.light,
        0.023,
      );
    } else if (s.crest === 'eye') {
      poly(
        [
          [-0.25, 0],
          [-0.13, -0.1],
          [0, -0.15],
          [0.13, -0.1],
          [0.25, 0],
          [0.13, 0.1],
          [0, 0.15],
          [-0.13, 0.1],
        ],
        s.gold,
      );
      circle(0, 0, 0.085, s.light);
      circle(0, 0, 0.043, s.dark);
      line(
        [
          [0.12, -0.23],
          [-0.1, 0.23],
        ],
        s.color,
        0.042,
      );
    } else if (s.crest === 'anchor') {
      circle(0, -0.17, 0.065, s.gold);
      circle(0, -0.17, 0.03, s.dark);
      line(
        [
          [0, -0.11],
          [0, 0.19],
        ],
        s.light,
        0.039,
      );
      line(
        [
          [-0.13, -0.06],
          [0.13, -0.06],
        ],
        s.gold,
        0.031,
      );
      line(
        [
          [-0.21, 0.02],
          [-0.15, 0.14],
          [0, 0.21],
          [0.15, 0.14],
          [0.21, 0.02],
        ],
        s.light,
        0.04,
      );
      poly(
        [
          [-0.24, 0.08],
          [-0.22, -0.035],
          [-0.12, 0.035],
        ],
        s.gold,
      );
      poly(
        [
          [0.24, 0.08],
          [0.22, -0.035],
          [0.12, 0.035],
        ],
        s.gold,
      );
    } else if (s.crest === 'tiger') {
      poly(
        [
          [-0.21, -0.2],
          [-0.075, -0.15],
          [0.075, -0.15],
          [0.21, -0.2],
          [0.17, 0.02],
          [0.1, 0.18],
          [0, 0.23],
          [-0.1, 0.18],
          [-0.17, 0.02],
        ],
        s.gold,
      );
      poly(
        [
          [-0.15, 0.035],
          [0, 0.085],
          [0.15, 0.035],
          [0.07, 0.17],
          [0, 0.2],
          [-0.07, 0.17],
        ],
        s.light,
      );
      line(
        [
          [0, -0.13],
          [0, 0.025],
        ],
        s.dark,
        0.025,
      );
      line(
        [
          [-0.07, -0.085],
          [0.07, -0.085],
        ],
        s.dark,
        0.025,
      );
      line(
        [
          [-0.15, -0.015],
          [-0.065, 0.025],
        ],
        s.dark,
        0.035,
      );
      line(
        [
          [0.15, -0.015],
          [0.065, 0.025],
        ],
        s.dark,
        0.035,
      );
      poly(
        [
          [-0.035, 0.09],
          [0.035, 0.09],
          [0, 0.13],
        ],
        s.dark,
      );
    } else if (s.crest === 'dragon') {
      poly(
        [
          [-0.24, 0.14],
          [-0.11, 0.03],
          [-0.21, -0.05],
          [-0.08, -0.06],
          [-0.16, -0.25],
          [0.01, -0.15],
          [0.13, -0.23],
          [0.11, -0.08],
          [0.24, -0.015],
          [0.17, 0.055],
          [0.08, 0.05],
          [0.02, 0.14],
          [-0.11, 0.21],
        ],
        '#e5f8ff',
      );
      poly(
        [
          [-0.13, 0.13],
          [-0.025, -0.02],
          [-0.045, -0.16],
          [0.055, -0.09],
          [0.14, -0.025],
          [0.025, 0.01],
          [0.07, 0.105],
          [-0.04, 0.15],
        ],
        s.color,
      );
      poly(
        [
          [0.025, -0.045],
          [0.1, -0.02],
          [0.025, 0.003],
        ],
        '#ffdb64',
      );
    } else if (s.crest === 'wolf') {
      poly(
        [
          [-0.22, -0.23],
          [-0.05, -0.15],
          [0.04, -0.16],
          [0.22, -0.24],
          [0.15, -0.035],
          [0.2, 0.045],
          [0.08, 0.15],
          [0, 0.23],
          [-0.09, 0.15],
          [-0.2, 0.05],
          [-0.15, -0.04],
        ],
        '#e4ebff',
      );
      poly(
        [
          [-0.14, -0.09],
          [0, -0.02],
          [0.14, -0.09],
          [0.07, 0.09],
          [0, 0.17],
          [-0.07, 0.09],
        ],
        s.color,
      );
      poly(
        [
          [-0.13, -0.015],
          [-0.035, 0.025],
          [-0.06, 0.055],
        ],
        '#ffec77',
      );
      poly(
        [
          [0.13, -0.015],
          [0.035, 0.025],
          [0.06, 0.055],
        ],
        '#ffec77',
      );
    } else {
      poly(
        [
          [-0.26, -0.16],
          [-0.08, -0.1],
          [0, -0.24],
          [0.09, -0.1],
          [0.27, -0.17],
          [0.2, -0.01],
          [0.13, 0.015],
          [0.2, 0.07],
          [0.085, 0.1],
          [0.03, 0.23],
          [-0.05, 0.13],
          [-0.2, 0.08],
          [-0.11, 0.02],
          [-0.22, -0.01],
        ],
        s.crest === 'phoenix' ? '#ffe78b' : '#f4ffe8',
      );
      poly(
        [
          [-0.15, -0.07],
          [0, -0.12],
          [0.13, -0.055],
          [0.07, 0.0],
          [0.11, 0.04],
          [0.0, 0.15],
          [-0.08, 0.015],
        ],
        s.color,
      );
      poly(
        [
          [0.04, -0.09],
          [0.15, -0.035],
          [0.045, -0.01],
        ],
        s.gold,
      );
    }
    ctx.strokeStyle = '#e6ffff77';
    ctx.lineWidth = 0.008;
    ctx.beginPath();
    ctx.arc(0, 0, 0.317, Math.PI, Math.PI * 1.8);
    ctx.stroke();
  }
  return { render, skins };
})();
