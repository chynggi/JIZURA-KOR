/* ============================================================
   JIZURA — registries for the newer expression groups + a single
   registration helper used by every expression pack (src/11p_*.js)

   group    registry      order array          picked per
   layout   J.LAYOUTS     J.LAYOUT_ORDER       cut
   enter    J.ENTER       J.ENTER_ORDER        cut
   hold     J.HOLD        J.HOLD_ORDER         cut
   exit     J.EXIT        J.EXIT_ORDER         cut
   decor    J.DECOR       J.DECOR_ORDER        cut (0..n)
   treat    J.TREAT       J.TREAT_ORDER        cut   text treatment (outline, extrude, marker…)
   bg       J.BG          J.BG_ORDER           line  full-screen background graphic
   cam      J.CAMERA      J.CAMERA_ORDER       cut   camera move over the cut
   fx       J.FXE         J.FXE_ORDER          event post-processing / transition effect
   trans    J.TRANS       J.TRANS_ORDER        cut   how this cut takes over from the previous one (both frames composited)

   Common optional fields on every entry:
     name  (Japanese label, required)   tags  (mood keys it suits: glitch calm pop graphic editorial emotional)
     w     (base pick weight, default 1)  pack (set by J.register)
   ============================================================ */
(() => {
'use strict';

J.TREAT = { none: { name: '없음', apply() {} } };
J.TREAT_ORDER = ['none'];
J.BG = { none: { name: '단색', draw() {} } };
J.BG_ORDER = ['none'];
J.CAMERA = {
  push: { name: '천천히 다가오기', tags: ['calm', 'editorial', 'emotional', 'graphic', 'pop', 'glitch'], w: 5,
    get: (env) => ({ s: 1 + 0.03 * (env.fx.motion ?? 0.7) * J.clamp(env.lt / Math.max(0.3, env.cut.dur)) }) },
};
J.CAMERA_ORDER = ['push'];
// post / transition effects. Entries without draw() are handled by the renderer's built-in branch.
J.FXE = {
  slice:  { name: '슬라이스 글리치', builtin: true },
  block:  { name: '블록 글리치', builtin: true },
  invert: { name: '반전', builtin: true },
  flash:  { name: '플래시', builtin: true },
  zoom:   { name: '줌 블러', builtin: true },
  mosaic: { name: '모자이크', builtin: true },
  shake:  { name: '흔들림', builtin: true },
  chroma: { name: '색 어긋남 점프', builtin: true },
};
J.FXE_ORDER = ['chroma', 'shake', 'slice', 'block', 'invert', 'flash', 'zoom', 'mosaic'];
// cut-to-cut transitions: draw(ctx, A, B, p, info) composites the previous cut (A) and this cut (B) in device pixels
J.TRANS = {};
J.TRANS_ORDER = [];

const GROUPS = {
  layout: ['LAYOUTS', 'LAYOUT_ORDER'], enter: ['ENTER', 'ENTER_ORDER'], hold: ['HOLD', 'HOLD_ORDER'], exit: ['EXIT', 'EXIT_ORDER'],
  decor: ['DECOR', 'DECOR_ORDER'], treat: ['TREAT', 'TREAT_ORDER'], bg: ['BG', 'BG_ORDER'], cam: ['CAMERA', 'CAMERA_ORDER'], fx: ['FXE', 'FXE_ORDER'], trans: ['TRANS', 'TRANS_ORDER'],
};
J.GROUP_KEYS = Object.keys(GROUPS);
J.registry = g => J[GROUPS[g][0]];
J.order = g => J[GROUPS[g][1]];

/* J.register('layout', 'myKey', { name: '…', … }, 'packName') */
J.register = (group, key, def, pack) => {
  const G = GROUPS[group];
  if (!G) throw new Error('unknown group ' + group);
  if (!def || !def.name) throw new Error(`${group}.${key}: name is required`);
  const reg = J[G[0]], order = J[G[1]];
  if (reg[key] && reg[key].pack !== pack) console.warn(`JIZURA: ${group}.${key} is being replaced`);
  def.pack = pack || def.pack || 'core';
  reg[key] = def;
  if (!def.special && !order.includes(key)) order.push(key);
  return def;
};
J.registerAll = (group, defs, pack) => { for (const k of Object.keys(defs)) J.register(group, k, defs[k], pack); };

/* items whose tags include a mood key (used by おまかせ) */
J.taggedWith = (group, mood) => J.order(group).filter(k => { const d = J.registry(group)[k]; return d && d.tags && d.tags.includes(mood); });
})();
