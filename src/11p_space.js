/* JIZURA pack: space — depth layouts (parallax layers, words flying in from a vanishing point), a pseudo-3D yaw camera, pen writing */
(() => {
'use strict';
const E = J.E;
const P = 'space';
const reg = (g, k, d) => J.register(g, k, d, P);
const clamp = J.clamp, lerp = J.lerp;
const U = env => Math.min(env.W, env.H);
const isPort = env => env.H > env.W * 1.08;
const tin = (env, d = 0, len = 0.4, ease = E.outExpo) => ease(clamp((env.lt - d) / Math.max(0.01, len)));
const tout = env => 1 - E.inCubic(env.pOut);
const wordsOf = env => { const w = (env.cut.words && env.cut.words.length ? env.cut.words : [env.cut.text]).map(s => String(s).trim()).filter(Boolean); return w.length ? w : [env.cut.text || ' ']; };
// merge words into at most `max` groups of neighbours (keeps reading order; Latin and Hangul keep their spaces)
const groupWords = (w, max) => { if (w.length <= max) return w; const k = Math.ceil(w.length / max), out = []; for (let i = 0; i < w.length; i += k) out.push(w.slice(i, i + k).join(/[A-Za-z가-힣]/.test(w.join('')) ? ' ' : '')); return out; };

/* ---------------- layout: 패럴랙스 — words on three depth layers, each layer drifting at its own speed ---------------- */
const DEPTH_K = [1, 0.74, 0.56];
reg('layout', 'parallax', {
  name: '패럴랙스', tags: ['emotional', 'graphic', 'calm'], w: 0.9, ae: 'scatter', fits: n => n >= 2 && n <= 18,
  plan: (rng, cut, st) => ({ font: rng.pick(J.fontsOf(st, ['display', 'serif'])), dir: rng.pick([1, -1]), off: rng.int(0, 2), far: rng.chance(0.75), drift: rng.range(0.025, 0.045) }),
  render(env) {
    const { W, H, sc } = env, Pm = env.cut.params, port = isPort(env), out = tout(env);
    const words = groupWords(wordsOf(env), port ? 5 : 4), n = words.length;
    const zs = words.map((_, i) => (n === 1 ? 0 : (i + Pm.off) % 3));
    if (!zs.includes(0)) zs[0] = 0;
    const o = { track: 0.03 };
    // size: the whole row (or column of rows in portrait) fits the safe area
    let size;
    if (port) size = Math.min(...words.map((w, i) => J.fitSize(w, Pm.font, W * 0.8 / DEPTH_K[zs[i]], H * 0.62 / n, o)), H * 0.12);
    else {
      const unit = words.reduce((a, w, i) => a + J.measure(Object.assign({ text: w, font: Pm.font, size: 100 }, o)).w * DEPTH_K[zs[i]] + 100 * 0.35, 0);
      size = Math.min(100 * W * 0.84 / Math.max(1, unit), H * 0.2);
    }
    const q = clamp(env.ltb / Math.max(0.5, env.cut.dur)) * 2 - 1;    // -1 → 1 across the cut
    // far layer: faint copies of the line scroll slowly behind everything
    if (Pm.far) {
      const fa = tin(env, 0, 0.5, E.outCubic) * out * 0.55, fs = size * 0.38;
      for (let r = 0; r < 2; r++) {
        const y = r ? H * 0.84 : H * 0.16, sh = (env.ltb * W * 0.012 * Pm.dir * (r ? -1 : 1)) % (W * 0.5);
        for (let k = -1; k <= 2; k++) env.draw({ text: env.cut.lineText || env.cut.text, font: Pm.font, size: fs, x: W * 0.25 + k * W * 0.5 + sh, y, color: sc.dim, alpha: fa, ghost: false, plain: true });
      }
    }
    // lay the words out in reading order, deeper words smaller, higher and slower
    let bb = null, x = 0;
    const ws = words.map((w, i) => J.measure(Object.assign({ text: w, font: Pm.font, size: size * DEPTH_K[zs[i]] }, o)).w);
    const total = ws.reduce((a, b) => a + b, 0) + size * 0.35 * (n - 1);
    x = W / 2 - total / 2;
    // draw back to front so the front layer sits on top
    const order = words.map((_, i) => i).sort((a, b) => zs[b] - zs[a]);
    const pos = words.map((w, i) => {
      if (port) return { x: W / 2 + (zs[i] - 1) * W * 0.06, y: H / 2 + (i - (n - 1) / 2) * H * 0.62 / n };
      const cx = x + ws[i] / 2; x += ws[i] + size * 0.35;
      return { x: cx, y: H / 2 - zs[i] * size * 0.32 };
    });
    for (const i of order) {
      const z = zs[i], k = DEPTH_K[z];
      const dx = Pm.dir * q * W * Pm.drift * (1 - z * 0.42);
      const col = z === 0 ? sc.fg : J.mix(sc.fg, sc.sub, z * 0.3);
      const b = J.mainDraw(env, { text: words[i], font: Pm.font, size: size * k, x: pos[i].x + dx, y: pos[i].y, track: 0.03, color: col, mi: i, blur: env.allowFilter ? z * 0.9 : 0 });
      bb = J.unionBB(bb, b);
    }
    return bb;
  },
});

/* ---------------- layout: 다가오기 — each word flies in from a vanishing point, leaving a short depth trail ---------------- */
reg('layout', 'approach', {
  name: '다가오기', tags: ['graphic', 'emotional', 'pop'], w: 0.9, ae: 'stack', emph: 1.2, fits: n => n >= 2 && n <= 16,
  enterBias: { cut: 2.5, blur: 1.4 },
  plan: (rng, cut, st) => ({ font: rng.pick(J.fontsOf(st, ['display'])), vx: rng.range(0.3, 0.7), vy: rng.pick([0.18, 0.5, 0.82]), trail: rng.int(2, 4), lag: rng.range(0.12, 0.2) }),
  render(env) {
    const { W, H, sc } = env, Pm = env.cut.params, out = tout(env);
    const rows = groupWords(wordsOf(env), isPort(env) ? 5 : 4), n = rows.length;
    const size = Math.min(...rows.map(w => J.fitSize(w, Pm.font, W * 0.82, H * 0.7 / n, { track: 0.02 })), H * 0.22);
    const V = [W * Pm.vx, H * Pm.vy], lag = Math.min(Pm.lag, env.cut.dur * 0.45 / Math.max(1, n));
    let bb = null;
    for (let i = 0; i < n; i++) {
      const fy = H / 2 + (i - (n - 1) / 2) * size * 1.12, fx = W / 2 + (i % 2 ? 1 : -1) * W * 0.03 * (n > 1 ? 1 : 0);
      const u = tin(env, i * lag, 0.5, E.outCubic);                 // 0 = at the vanishing point, 1 = arrived
      if (u <= 0) continue;
      const at = z => ({ x: lerp(V[0], fx, z), y: lerp(V[1], fy, z), s: 0.08 + 0.92 * z });
      // depth trail: faint copies further back along the path, fading once the word has landed
      const ta = (1 - u) * 0.5 * out;
      if (ta > 0.01) for (let k = Pm.trail; k >= 1; k--) {
        const p = at(Math.max(0, u - k * 0.12));
        env.draw({ text: rows[i], font: Pm.font, size: size * p.s, x: p.x, y: p.y, track: 0.02, color: sc.sub, alpha: ta * (1 - k / (Pm.trail + 1)), ghost: false, plain: true });
      }
      const p = at(u);
      const b = J.mainDraw(env, { text: rows[i], font: Pm.font, size: size * p.s, x: p.x, y: p.y, track: 0.02, color: sc.fg, mi: i, alpha: clamp(u * 3) });
      bb = J.unionBB(bb, b);
    }
    return bb || J.centerBB(env, null);
  },
});

/* ---------------- camera: 가로 회전 — the picture turns a little around the vertical axis, like a card seen from the side ---------------- */
reg('cam', 'yawTurn', {
  name: '가로 회전', tags: ['emotional', 'graphic', 'calm'], w: 0.7,
  plan: rng => ({ amp: rng.range(24, 36), f: rng.range(0.35, 0.7), ph: rng.range(0, J.TAU), dir: rng.pick([1, -1]) }),
  get(env, P) {
    const K = clamp(env.fx.motion ?? 0.7, 0, 1), q = env.lt / Math.max(0.5, env.cut.dur);
    const a = P.dir * P.amp * K * Math.sin(J.TAU * P.f * q + P.ph) * J.DEG;
    // cos → horizontal squash of the turned plane, sin → slight shear + slide towards the near side
    return { sx: Math.max(0.8, Math.cos(a)), skx: Math.sin(a) * 13, x: Math.sin(a) * env.W * 0.03, s: 1 + 0.03 * Math.abs(Math.sin(a)) };
  },
});

/* ---------------- enter: 펜 글씨 — glyph by glyph an outline is drawn left to right with a pen nib, then filled ---------------- */
reg('enter', 'penWrite', {
  name: '펜 글씨', tags: ['calm', 'emotional', 'editorial'], w: 0.8, ae: 'type', minDur: 0.7,
  inDur: (dur, n) => clamp(0.25 + n * 0.09, 0.4, Math.max(0.4, Math.min(1.4, dur * 0.6))),
  apply(env, it, p) {
    const vert = !!it.vertical;
    let act = -1;
    it.charFns.push((i, g, n) => {
      const u = clamp(p * (n * 0.85 + 0.15) - i * 0.85);
      if (u <= 0) return { hide: true };
      if (u >= 1) return null;
      if (u < 0.72) { const e = E.inOutSine(u / 0.72); act = e; const w = [-0.62, -0.62 + 1.24 * e]; return vert ? { outline: true, clipY: w } : { outline: true, clipX: w }; }
      act = -1;
      return { a: 0.55 + 0.45 * E.outCubic((u - 0.72) / 0.28) };
    });
    // the pen nib rides the end of the stroke being drawn (the last visible glyph box)
    const prev = it.post;
    it.post = (e, i, bb) => {
      if (prev) prev(e, i, bb);
      // one nib per cut: only the first item carries it (layouts with many items would otherwise sprout a pen per glyph)
      if (e.pass !== 'main' || act < 0 || (i.mi | 0) !== 0 || !bb || !bb.boxes || !bb.boxes.length) return;
      const b = bb.boxes[bb.boxes.length - 1], s = i.size || 40;
      const px = vert ? bb.cx + b.x + Math.sin(act * 9) * b.w * 0.18 : bb.cx + b.x - b.w * 0.62 + b.w * 1.24 * act;
      const py = vert ? bb.cy + b.y - b.h * 0.62 + b.h * 1.24 * act : bb.cy + b.y + Math.sin(act * 9) * b.h * 0.18;
      e.circle(px, py, Math.max(2, s * 0.045), e.sc.accent, null, 1, 0.95, false);
      e.line([[px, py], [px + s * 0.28, py - s * 0.5]], e.sc.accent, Math.max(1.5, s * 0.03), 0.8, false);
    };
  },
});
})();
