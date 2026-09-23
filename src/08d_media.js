/* Uploaded-image/video planning and browser-local asset storage. */
(() => {
'use strict';
J.MEDIA_LAYOUT = { cover: '全画面', contain: '全体を表示', stretch: '引き伸ばす' };
J.MEDIA_ENTER = { fade: 'フェード', slide: 'スライド', zoom: 'ズーム', cut: '即時' };
J.MEDIA_HOLD = { still: '静止', push: 'ゆっくり拡大', pan: '横移動' };
J.MEDIA_EXIT = { fade: 'フェード', slide: 'スライド', zoom: 'ズーム', cut: '即時' };
J.MEDIA_TREAT = { none: 'なし', mono: 'モノクロ', sepia: 'セピア', contrast: '高コントラスト', blur: 'ぼかし' };
J.MEDIA_FOCUS = { tl: '左上', tc: '上', tr: '右上', ml: '左', mc: '中央', mr: '右', bl: '左下', bc: '下', br: '右下' };
J.mediaFocusPoint = (focus, w, h) => {
  const index = Object.keys(J.MEDIA_FOCUS).indexOf(focus);
  return { x: ((index < 0 ? 4 : index) % 3 - 1) * w / 3, y: (Math.floor((index < 0 ? 4 : index) / 3) - 1) * h / 3 };
};
J.mediaAssets = new Map();
const defaults = () => ({ items: [], randomOrder: false, loop: false, cutCount: 0, seed: 1, timing: { lineTimes: {} }, overrides: {}, cutOverrides: {}, blend: 'normal', opacity: 100 });
J.normalizeMedia = m => {
  const o = Object.assign(defaults(), m || {});
  o.items = Array.isArray(o.items) ? o.items.filter(x => x && x.id && x.name && ['image', 'video'].includes(x.type)) : [];
  o.timing = Object.assign({ lineTimes: {} }, o.timing || {});
  o.overrides = o.overrides || {};
  o.cutOverrides = o.cutOverrides || {};
  o.loop = !!o.loop;
  o.cutCount = J.clamp(Math.floor(+o.cutCount || 0), 0, 1000);
  if (!['normal', 'multiply', 'screen'].includes(o.blend)) o.blend = 'normal';
  o.opacity = J.clamp(+o.opacity || 0, 0, 100);
  return o;
};
J.planMedia = (project, lyricPlan, audioDuration) => {
  const m = J.normalizeMedia(project.media), items = m.items.slice();
  const count = items.length ? (m.loop ? Math.max(items.length, m.cutCount || items.length * 2) : items.length) : 0;
  const order = items.map((_, i) => i);
  if (m.randomOrder && order.length > 1) {
    const rng = J.rng(J.h(project.seed, m.seed));
    for (let i = order.length - 1; i > 0; i--) { const j = rng.int(0, i); [order[i], order[j]] = [order[j], order[i]]; }
  }
  const itemAt = i => items[order[i % items.length]];
  const duration = Math.max(lyricPlan.duration, audioDuration || 0,
    lyricPlan.lines.length ? 0 : Array.from({ length: count }, (_, i) => itemAt(i)).reduce((n, x) => n + (x.type === 'video' ? J.clamp(+x.duration || 4, 1, 12) : 4), 0));
  const lyricCount = Math.min(count, lyricPlan.lines.length);
  const starts = Array.from({ length: count }, (_, i) => {
    const v = m.timing.lineTimes[i];
    if (v != null && isFinite(+v)) return J.clamp(+v, 0, duration);
    if (lyricPlan.lines[i]) return lyricPlan.lines[i].start;
    if (lyricCount) return lyricPlan.lines[lyricCount - 1].start + (duration - lyricPlan.lines[lyricCount - 1].start) * (i - lyricCount + 1) / (count - lyricCount + 1);
    return i * duration / Math.max(1, count);
  });
  for (let i = 1; i < starts.length; i++) starts[i] = Math.max(starts[i], starts[i - 1] + 0.04);
  const cuts = Array.from({ length: count }, (_, i) => {
    const item = itemAt(i), ov = Object.assign({}, m.overrides[item.id] || {}, m.cutOverrides[i] || {});
    const seed = ov.lock && ov.lockedSeed != null ? ov.lockedSeed : J.h(project.seed, m.seed, i, ov.seed | 0);
    const rng = J.rng(seed);
    return { index: i, itemId: item.id, name: item.name, type: item.type, start: starts[i], end: i + 1 < count ? Math.max(starts[i] + 0.04, starts[i + 1]) : duration,
      layout: ov.layout || rng.pick(Object.keys(J.MEDIA_LAYOUT)), enter: ov.enter || rng.pick(Object.keys(J.MEDIA_ENTER)),
      hold: ov.hold || rng.pick(Object.keys(J.MEDIA_HOLD)), exit: ov.exit || rng.pick(Object.keys(J.MEDIA_EXIT)),
      treat: ov.treat || rng.pick(Object.keys(J.MEDIA_TREAT)),
      zoom: ov.zoom != null && ov.zoom !== '' && isFinite(+ov.zoom) ? J.clamp(+ov.zoom, 100, 300) : rng.pick([100, 110, 125, 140, 160]),
      focus: J.MEDIA_FOCUS[ov.focus] ? ov.focus : rng.pick(Object.keys(J.MEDIA_FOCUS)), seed };
  });
  return { cuts, duration, blend: m.blend, opacity: m.opacity, randomOrder: m.randomOrder, loop: m.loop };
};
J.mediaAt = (plan, t) => plan.media && plan.media.cuts.find(c => t >= c.start && t < c.end) || null;

const DB = 'jizura-media-v1';
const dbOpen = () => new Promise((resolve, reject) => {
  const q = indexedDB.open(DB, 1);
  q.onupgradeneeded = () => q.result.createObjectStore('files');
  q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error);
});
const dbOp = async (mode, cb) => {
  const db = await dbOpen();
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction('files', mode), q = cb(tx.objectStore('files'));
    q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error);
  }); } finally { db.close(); }
};
J.storeMedia = (id, file) => dbOp('readwrite', s => s.put(file, id));
J.loadMedia = id => dbOp('readonly', s => s.get(id));
J.removeMedia = id => dbOp('readwrite', s => s.delete(id));
J.attachMedia = (item, file) => new Promise((resolve, reject) => {
  const previous = J.mediaAssets.get(item.id); if (previous) URL.revokeObjectURL(previous.url);
  const url = URL.createObjectURL(file);
  const el = document.createElement(item.type === 'video' ? 'video' : 'img');
  if (item.type === 'video') { el.muted = true; el.playsInline = true; el.preload = 'auto'; }
  const ready = () => {
    let poster = url;
    if (item.type === 'video') {
      try { const c = document.createElement('canvas'); c.width = 96; c.height = 54; c.getContext('2d').drawImage(el, 0, 0, 96, 54); poster = c.toDataURL('image/png'); } catch (e) {}
    }
    J.mediaAssets.set(item.id, { url, element: el, type: item.type, poster }); resolve(el);
  };
  el.onerror = () => { URL.revokeObjectURL(url); reject(new Error('画像・動画を読み込めませんでした')); };
  if (item.type === 'video') el.onloadeddata = ready; else el.onload = ready;
  el.src = url;
});
J.prepareMediaFrame = async (plan, t, signal) => {
  const cut = J.mediaAt(plan, t); if (!cut || cut.type !== 'video') return;
  const asset = J.mediaAssets.get(cut.itemId); if (!asset) return;
  const v = asset.element; v.pause();
  const target = Math.max(0, Math.min(t - cut.start, (v.duration || 1) - 0.001));
  if (Math.abs(v.currentTime - target) < 0.002 && v.readyState >= 2) return;
  await new Promise((resolve, reject) => {
    const finish = () => { v.removeEventListener('seeked', ok); v.removeEventListener('error', fail); if (signal) signal.removeEventListener('abort', abort); };
    const ok = () => { finish(); resolve(); }, fail = () => { finish(); reject(new Error('動画を読み込めませんでした')); }, abort = () => { finish(); reject(new Error('キャンセルしました')); };
    v.addEventListener('seeked', ok, { once: true }); v.addEventListener('error', fail, { once: true });
    if (signal) signal.addEventListener('abort', abort, { once: true });
    v.currentTime = target;
  });
};
J.syncMediaPreview = (plan, t, playing) => {
  const cut = J.mediaAt(plan, t);
  for (const [id, asset] of J.mediaAssets) {
    if (asset.type !== 'video') continue;
    const v = asset.element;
    if (!cut || id !== cut.itemId) { v.pause(); continue; }
    const target = Math.max(0, Math.min(t - cut.start, (v.duration || 1) - 0.001));
    if (Math.abs(v.currentTime - target) > (playing ? 0.18 : 0.02)) v.currentTime = target;
    if (playing && v.paused) v.play().catch(() => {});
    if (!playing) v.pause();
  }
};
J.drawMedia = (ctx, plan, t) => {
  const cut = J.mediaAt(plan, t); if (!cut) return false;
  const asset = J.mediaAssets.get(cut.itemId); if (!asset) return false;
  const src = asset.element, sw = src.videoWidth || src.naturalWidth, sh = src.videoHeight || src.naturalHeight;
  if (!sw || !sh) return false;
  const w = ctx.canvas.width, h = ctx.canvas.height, d = Math.max(0.04, cut.end - cut.start), p = J.clamp((t - cut.start) / d, 0, 1);
  const fade = Math.min(1, (t - cut.start) / Math.min(0.45, d * 0.3));
  const out = Math.min(1, (cut.end - t) / Math.min(0.45, d * 0.3));
  let alpha = (cut.enter === 'fade' ? fade : 1) * (cut.exit === 'fade' ? out : 1);
  let z = (cut.zoom || 100) / 100 * (cut.hold === 'push' ? 1 + p * 0.12 : 1);
  if (cut.enter === 'zoom') z *= 1 + (1 - fade) * 0.16;
  if (cut.exit === 'zoom') z *= 1 + (1 - out) * 0.16;
  let dx = cut.hold === 'pan' ? (0.5 - p) * w * 0.12 : 0;
  if (cut.enter === 'slide') dx += (1 - fade) * w;
  if (cut.exit === 'slide') dx -= (1 - out) * w;
  const fit = cut.layout === 'stretch' ? [w, h] : (() => {
    const s = cut.layout === 'contain' ? Math.min(w / sw, h / sh) : Math.max(w / sw, h / sh);
    return [sw * s, sh * s];
  })();
  const focus = J.mediaFocusPoint(cut.focus, w, h);
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(w / 2 + dx, h / 2); ctx.translate(focus.x, focus.y); ctx.scale(z, z); ctx.translate(-focus.x, -focus.y);
  ctx.filter = ({ mono: 'grayscale(1)', sepia: 'sepia(1)', contrast: 'contrast(1.6)', blur: 'blur(8px)' })[cut.treat] || 'none';
  ctx.drawImage(src, -fit[0] / 2, -fit[1] / 2, fit[0], fit[1]); ctx.restore();
  return true;
};
})();
