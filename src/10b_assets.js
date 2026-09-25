/* ============================================================
   JIZURA — 소재: images laid over / under the lyrics
   project.assets holds only the settings; the image files (and a subject mask per photo) live in this browser's
   IndexedDB ('asset:<id>', 'mask:<id>'), like the song. J.ASSETS holds the decoded, keyed canvases for drawing.
   ============================================================ */
(() => {
'use strict';

J.ASSETS = new Map();                 // id → { img, subj, keyed, w, h }
const MAX_SIDE = 2560;                // big photos are scaled down once on load
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* settings of a newly added image. kind: 'overlay' (one layer, back or front of the lyrics) or 'subject'
   (a photo behind the lyrics whose masked subject is drawn again in front of them) */
J.assetDefaults = (id, name) => ({ id, name, kind: 'overlay', layer: 'back', key: 'auto', fit: 'contain', scale: 1, x: 0, y: 0, opacity: 1, hidden: false });

J.assetAdd = async (file) => {
  const id = newId(), data = await file.arrayBuffer();
  if (!(await J.idbPut('asset:' + id, { name: file.name, type: file.type, data }))) throw new Error('이 브라우저에 소재를 저장할 수 없습니다');
  return J.assetDefaults(id, file.name);
};
J.assetForget = async (id) => { J.ASSETS.delete(id); await J.idbDel('asset:' + id); await J.idbDel('mask:' + id); };

async function decode(rec) {
  const bmp = await createImageBitmap(new Blob([rec.data], { type: rec.type || '' }));
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  return c;
}
/* green screen: most of the border is saturated green */
J.looksGreen = (c) => {
  const x = c.getContext('2d', { willReadFrequently: true }), w = c.width, h = c.height, d = x.getImageData(0, 0, w, h).data;
  let n = 0, g = 0;
  const at = (px, py) => { const i = (py * w + px) * 4; n++; if (d[i + 3] > 200 && d[i + 1] > 90 && d[i + 1] > d[i] * 1.4 && d[i + 1] > d[i + 2] * 1.4) g++; };
  const sx = Math.max(1, Math.floor(w / 60)), sy = Math.max(1, Math.floor(h / 60));
  for (let px = 0; px < w; px += sx) { at(px, 0); at(px, h - 1); }
  for (let py = 0; py < h; py += sy) { at(0, py); at(w - 1, py); }
  return g / Math.max(1, n) > 0.6;
};
const hasAlpha = (c) => {
  const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < d.length; i += 4 * 7) if (d[i] < 250) return true;
  return false;
};
/* chroma key: the more a pixel is green over its red / blue, the more transparent; the green spill on the
   remaining edges is pulled down to the other two channels */
J.keyGreen = (c) => {
  const x = c.getContext('2d', { willReadFrequently: true }), im = x.getImageData(0, 0, c.width, c.height), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2], m = Math.max(r, b), k = g - m;
    if (k <= 20) continue;
    d[i + 3] = Math.round(d[i + 3] * (1 - Math.min(1, (k - 20) / 80)));
    d[i + 1] = m;
  }
  x.putImageData(im, 0, 0);
};
/* the subject only: the image through its mask (mask alpha = subject) */
J.assetSubject = (img, mask) => {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'destination-in'; x.drawImage(mask, 0, 0, c.width, c.height);
  return c;
};
/* load (or reload after a key / mask change) the canvases of one asset */
J.assetPrepare = async (a) => {
  const rec = await J.idbGet('asset:' + a.id);
  if (!rec) { J.ASSETS.delete(a.id); return null; }
  const img = await decode(rec);
  let keyed = false;
  if (a.key === 'green' || (a.key === 'auto' && !hasAlpha(img) && J.looksGreen(img))) { J.keyGreen(img); keyed = true; }
  let subj = null, mask = null;
  const mrec = await J.idbGet('mask:' + a.id);
  if (mrec) { mask = await decode(mrec); if (a.kind === 'subject') subj = J.assetSubject(img, mask); }
  const e = { img, subj, mask, keyed, w: img.width, h: img.height };
  J.ASSETS.set(a.id, e);
  return e;
};
J.assetSetMask = async (a, maskCanvas) => {
  const blob = await new Promise(r => maskCanvas.toBlob(r, 'image/png'));
  await J.idbPut('mask:' + a.id, { name: 'mask.png', type: 'image/png', data: await blob.arrayBuffer() });
  return J.assetPrepare(a);
};

/* AI 피사체 선택 (optional): Google MediaPipe's interactive segmenter, downloaded only after the user agreed
   (see the consent dialog in the UI) — nothing here runs or loads before J.loadSegmenter() is called.
   The photo never leaves the browser: the model runs locally. */
J.ML = {
  lib: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1',
  model: 'https://storage.googleapis.com/mediapipe-models/interactive_segmenter_v2/magic_touch/int8/1/interactive_segmentation.task',
};
let segJob = null;
J.loadSegmenter = () => {
  if (!segJob) segJob = (async () => {
    const V = await import(J.ML.lib + '/vision_bundle.mjs');
    const fs = await V.FilesetResolver.forVisionTasks(J.ML.lib + '/wasm');
    return V.InteractiveSegmenter.createFromOptions(fs, { baseOptions: { modelAssetPath: J.ML.model } });
  })().catch(e => { segJob = null; throw e; });
  return segJob;
};
/* points: [{ x, y (0..1), neg }] → mask canvas (w × h, alpha = subject) */
J.segmentPoints = (seg, points, w, h) => {
  const m = seg.segment(points.map(p => ({ brushMode: p.neg ? 2 : 1, point: [{ x: p.x, y: p.y }], isCompleted: true })));
  const v = m.getAsFloat32Array(), mw = m.width, mh = m.height;
  const c = document.createElement('canvas'); c.width = mw; c.height = mh;
  const x = c.getContext('2d'), im = x.createImageData(mw, mh);
  for (let i = 0; i < v.length; i++) { const k = i * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = 255; im.data[k + 3] = Math.round(J.clamp(v[i]) * 255); }
  x.putImageData(im, 0, 0);
  if (m.close) m.close();
  if (mw === w && mh === h) return c;
  const o = document.createElement('canvas'); o.width = w; o.height = h; o.getContext('2d').drawImage(c, 0, 0, w, h);
  return o;
};

/* draw the assets of one side: 'back' (after the background, before the lyrics) or 'front' (over the lyrics).
   A 'subject' photo is drawn whole at the back and its masked subject again at the front. Design coordinates. */
J.drawAssets = (ctx, plan, which) => {
  for (const a of plan.assets || []) {
    if (a.hidden) continue;
    const A = J.ASSETS.get(a.id); if (!A) continue;
    const src = a.kind === 'subject' ? (which === 'back' ? A.img : A.subj) : (a.layer || 'back') === which ? A.img : null;
    if (!src) continue;
    const W = plan.W, H = plan.H, iw = src.width, ih = src.height;
    const s = (a.fit === 'cover' ? Math.max(W / iw, H / ih) : Math.min(W / iw, H / ih)) * (a.scale ?? 1);
    const w = iw * s, h = ih * s, cx = W / 2 + (a.x || 0) * W, cy = H / 2 + (a.y || 0) * H;
    ctx.save();
    ctx.globalAlpha = a.opacity ?? 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    ctx.drawImage(src, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
  }
};
})();
