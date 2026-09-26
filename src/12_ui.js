/* ============================================================
   JIZURA — editor UI
   ============================================================ */
(() => {
'use strict';
if (!document.getElementById('app')) return;          // engine-only pages (tests)
const $ = id => document.getElementById(id);
const LS_KEY = 'jizura.project.v1';
const MEDIA_DELETE_KEY = 'jizura.media.pendingDelete.v1';
const HUD_CHARS = '0123456789:./-_()【】 · No.LYRICRECUNTITLEDXYlinebpminterlude—─／ ';
const ICON = {
  dice: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="2" width="12" height="12" rx="2"/><circle cx="5.5" cy="5.5" r="1" fill="currentColor"/><circle cx="10.5" cy="10.5" r="1" fill="currentColor"/><circle cx="10.5" cy="5.5" r="1" fill="currentColor"/><circle cx="5.5" cy="10.5" r="1" fill="currentColor"/></svg>',
  lock: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></svg>',
  pen: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 13l1-3.5L11 2.5l2.5 2.5L6.5 12z"/><path d="M9.5 4l2.5 2.5"/></svg>',
  tap: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="2.2" fill="currentColor"/><circle cx="8" cy="8" r="5.5"/></svg>',
  cand: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="3" width="3.4" height="4" rx="0.6"/><rect x="6.3" y="3" width="3.4" height="4" rx="0.6"/><rect x="10.6" y="3" width="3.4" height="4" rx="0.6"/><rect x="2" y="9" width="3.4" height="4" rx="0.6"/><rect x="6.3" y="9" width="3.4" height="4" rx="0.6"/><rect x="10.6" y="9" width="3.4" height="4" rx="0.6"/></svg>',
  range: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 3v10M13 3v10"/><path d="M5.5 8h5M8.5 5.5L11 8l-2.5 2.5"/></svg>',
  frontmost: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="5" width="10" height="8" rx="1"/><path d="M5 2h9v8M8 4l2 2 2-2"/></svg>',
};

const S = { project: null, plan: null, audio: null, renderer: new J.Renderer(), playing: false, t: 0, t0: 0, loop: 'all', loopHold: null, need: true, exporting: null, tap: null, linkDrag: null, slow: false, lineEls: [], blankEls: new Map(), mediaLineEls: [], sourceTab: 'lyrics', curLine: -2, timelineZoom: 1 };
const LOOP_CYCLE = ['all', 'line', 'cut', false];
const LOOP_COPY = {
  all:  { ja: '반복', en: 'Loop', titleJa: '전체 반복', titleEn: 'Loop the whole piece' },
  line: { ja: '행 반복', en: 'Line loop', titleJa: '이 행 반복', titleEn: 'Loop this line' },
  cut:  { ja: '컷 반복', en: 'Cut loop', titleJa: '이 컷 반복', titleEn: 'Loop this cut' },
  off:  { ja: '반복', en: 'Loop', titleJa: '반복 안 함', titleEn: 'No loop' },
};
const isEn = () => document.documentElement.lang === 'en';
function cutAround(t) {
  const c = J.cutAt(S.plan, t);
  if (c) return c;
  const cs = S.plan.cuts;
  let ans = null;
  for (let i = 0; i < cs.length; i++) { if (cs[i].start <= t) ans = cs[i]; else break; }
  return ans;
}
function loopRange(t) {
  const T = t != null ? t : S.t;
  const endAll = S.plan.duration;
  if (S.loop === 'cut') {
    const cut = cutAround(T);
    return cut ? { start: cut.start, end: cut.end } : { start: 0, end: endAll };
  }
  if (S.loop === 'line') {
    const cut = cutAround(T);
    if (!cut || cut.line < 0) return cut ? { start: cut.start, end: cut.end } : { start: 0, end: endAll };
    const same = S.plan.cuts.filter(c => c.line === cut.line && c.layout !== 'interlude' && c.layout !== 'title');
    if (!same.length) return { start: cut.start, end: cut.end };
    return { start: same[0].start, end: same[same.length - 1].end };
  }
  return { start: 0, end: endAll };
}
function refreshLoopHold(t) {
  S.loopHold = (S.loop === 'line' || S.loop === 'cut') ? loopRange(t != null ? t : S.t) : null;
}
function activeLoopRange() {
  if ((S.loop === 'line' || S.loop === 'cut') && S.loopHold) return S.loopHold;
  return loopRange(S.t);
}
function syncLoopBtn() {
  const b = $('btnLoop'); if (!b) return;
  const key = S.loop || 'off';
  const copy = LOOP_COPY[key] || LOOP_COPY.off;
  const en = isEn();
  b.textContent = en ? copy.en : copy.ja;
  b.title = en ? copy.titleEn : copy.titleJa;
  b.setAttribute('aria-pressed', String(!!S.loop));
  b.dataset.mode = key;
  refreshLoopHold();
}

/* WebAudio player (works inside sandboxed pages where blob media may be blocked) */
const AP = {
  ctx: null, src: null, startAt: 0, gain: null, vol: 0.8, muted: false,
  play(buffer, offset) {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.stop();
    if (!this.gain) { this.gain = this.ctx.createGain(); this.gain.connect(this.ctx.destination); this.applyVol(); }
    const s = this.ctx.createBufferSource(); s.buffer = buffer; s.connect(this.gain);
    const off = Math.max(0, Math.min(offset, buffer.duration - 0.01));
    s.start(0, off); this.src = s; this.startAt = this.ctx.currentTime - off;
  },
  stop() { if (this.src) { try { this.src.stop(); } catch (e) {} try { this.src.disconnect(); } catch (e) {} this.src = null; } },
  time() { return this.ctx ? this.ctx.currentTime - this.startAt : 0; },
  /* preview volume only (exports keep the original level) */
  setVol(v, muted) { if (v != null) this.vol = Math.max(0, Math.min(1, v)); if (muted != null) this.muted = !!muted; this.applyVol(); },
  applyVol() { if (!this.gain) return; const v = this.muted ? 0 : this.vol * this.vol; try { this.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.015); } catch (e) { this.gain.gain.value = v; } },
};
/* プレビュー音量: remembered per browser */
function initVolume() {
  const el = $('vol'), mb = $('btnMute'); if (!el || !mb) return;
  let v = 0.8, m = false;
  try { const o = JSON.parse(localStorage.getItem('jizura.previewVolume') || 'null'); if (o) { v = +o.v; m = !!o.m; } } catch (e) {}
  if (!(v >= 0 && v <= 1)) v = 0.8;
  const show = () => { el.value = Math.round(AP.vol * 100); mb.textContent = AP.muted || AP.vol === 0 ? '음소거' : '음량'; mb.setAttribute('aria-pressed', String(AP.muted)); el.title = '음량 ' + Math.round(AP.vol * 100) + '%'; };
  const save = () => { try { localStorage.setItem('jizura.previewVolume', JSON.stringify({ v: AP.vol, m: AP.muted })); } catch (e) {} };
  AP.setVol(v, m); show();
  el.addEventListener('input', () => { AP.setVol(el.value / 100, false); show(); save(); });
  mb.addEventListener('click', () => { AP.setVol(null, !AP.muted); show(); save(); });
}
const NO_AUDIO_LABEL = '곡 없음(불러오면 박을 감지해 컷을 맞춥니다)';
function removeAudio() {
  if (!S.audio) return;
  pause(); S.audio = null;
  $('audioFile').value = '';
  $('audioName').textContent = audioNameDefault || NO_AUDIO_LABEL;
  S.project.audioName = '';
  if (J.forgetSong) J.forgetSong();              // the copy kept in this browser goes too (a reload must not bring it back)
  $('btnRemoveAudio').hidden = true;
  syncUI(); replan();
}

/* ---------------- project persistence ---------------- */
function mergeProject(p) {
  const d = J.defaultProject();
  const o = Object.assign(d, p || {});
  if (o.videoSize) { const [w, h] = J.outputSize(o); o.videoSize = { w, h }; }
  o.fx = Object.assign(J.defaultProject().fx, (p && p.fx) || {});
  o.timing = Object.assign(J.defaultProject().timing, (p && p.timing) || {});
  o.timing.cutTimes = o.timing.cutTimes || {};
  const en = J.defaultProject().enabled;
  for (const g of Object.keys(en)) en[g] = Object.assign(en[g], ((p && p.enabled) || {})[g] || {});
  o.enabled = en;
  o.aiPrompt = String((p && (p.aiPrompt ?? p.jevPrompt)) || ''); delete o.jevPrompt;
  o.overrides = (p && p.overrides) || {};
  o.lyricCutOptions = (p && p.lyricCutOptions) || {};
  o.lyricBlankCuts = Array.isArray(p && p.lyricBlankCuts) ? p.lyricBlankCuts : [];
  o.timelineLinks = Array.isArray(p && p.timelineLinks) ? p.timelineLinks : [];
  o.media = J.normalizeMedia(p && p.media);
  o.foreground = J.normalizeMedia(p && p.foreground);
  o.locks = { tech: {}, params: {} };
  // project files are untrusted: only plain keys may be locked, and only on (never a value we did not write)
  for (const [g, on] of Object.entries((p && p.locks && p.locks.tech) || {})) if (on === true && /^[\w-]+$/.test(g)) o.locks.tech[g] = true;
  for (const [k, on] of Object.entries((p && p.locks && p.locks.params) || {})) if (on === true && /^[\w-]+$/.test(k)) o.locks.params[k] = true;
  delete o.appVersion;
  // project files are untrusted: colours must be colours, font keys plain keys (they end up in the page's HTML / CSS)
  o.colors = { enabled: !!(p && p.colors && p.colors.enabled) };
  for (const [k, v] of Object.entries((p && p.colors) || {})) {
    if (k === 'enabled') continue;
    if (typeof v === 'boolean') o.colors[k] = v;
    else if (typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v)) o.colors[k] = v;
  }
  // uploaded faces (user_…, file: kept in this browser) and PC faces (local_…, the installed family name as it is)
  o.userFonts = (Array.isArray(p && p.userFonts) ? p.userFonts : []).filter(uf => uf && (J.SAFE_FONT_KEY.test(uf.key) || J.SAFE_LOCAL_FONT_KEY.test(uf.key)))
    .map(uf => {
      const local = !J.SAFE_FONT_KEY.test(uf.key);
      const out = { key: uf.key, label: String(uf.label || uf.key).slice(0, 80), family: local ? J.safeLocalFamily(uf.family || uf.key.slice(6)) : J.safeFamily(uf.family || uf.key.slice(5)), weight: J.clamp(parseInt(uf.weight, 10) || 400, 100, 900) };
      if (!local && uf.file === true) out.file = true;
      return out;
    });
  for (const uf of o.userFonts) if (!J.FONTS[uf.key]) J.addUserFont(uf.key, uf.label, uf.family, uf.weight);
  o.assets = ((p && p.assets) || []).map(a => Object.assign(J.assetDefaults(a.id, a.name), a));
  o.compositeFonts = Array.isArray(p && p.compositeFonts) ? p.compositeFonts : [];
  J.setCompositeFonts(o.compositeFonts);
  o.fonts = {};
  for (const [role, k] of Object.entries((p && p.fonts) || {})) if (typeof k === 'string' && J.FONTS[k] && /^[\w-]+$/.test(role)) o.fonts[role] = k;
  return o;
}
const SET_UI = { horror: { name: 'ホラー', badge: 'ホ' }, typo: { name: '文字PV系', badge: '文' }, kinetic: { name: 'キネティック', badge: 'キ' } };
function setBadges(d) {
  return (d && d.extra ? '<span class="set-badge ex" title="첫 공개 버전 이후 추가">추가</span>' : '') + (d && d.wa ? '<span class="set-badge" title="일본풍 연출">일본풍</span>' : '')
    + (d && d.set && SET_UI[d.set] ? `<span class="set-badge set-${d.set}" title="${SET_UI[d.set].name}">${SET_UI[d.set].badge}</span>` : '');
}
function loadLocal() { try { const s = localStorage.getItem(LS_KEY); if (s) return mergeProject(JSON.parse(s)); } catch (e) {} return mergeProject(null); }
function pendingMediaDeletes() { try { const ids = JSON.parse(localStorage.getItem(MEDIA_DELETE_KEY) || '[]'); return Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : []; } catch (e) { return []; } }
function queueMediaDeletion(id) { try { localStorage.setItem(MEDIA_DELETE_KEY, JSON.stringify([...new Set([...pendingMediaDeletes(), id])])); } catch (e) {} }
async function cleanupDeletedMedia() {
  const active = new Set([...S.project.media.items, ...S.project.foreground.items].map(item => item.id));
  const pending = pendingMediaDeletes(), failed = [];
  for (const id of pending) {
    if (active.has(id)) continue;
    try {
      await J.removeMedia(id);
      const asset = J.mediaAssets.get(id);
      if (asset) { URL.revokeObjectURL(asset.url); J.mediaAssets.delete(id); }
    } catch (e) { failed.push(id); }
  }
  try { localStorage.setItem(MEDIA_DELETE_KEY, JSON.stringify(pendingMediaDeletes().filter(id => !pending.includes(id) || failed.includes(id)))); } catch (e) {}
}
// 소재 files are deleted late (like the media above): deleting only drops the settings, so Ctrl+Z can bring it back;
// the files go on pagehide / next start when no current setting uses them
const ASSET_DELETE_KEY = LS_KEY + ':assetDeletes';
function pendingAssetDeletes() { try { const ids = JSON.parse(localStorage.getItem(ASSET_DELETE_KEY) || '[]'); return Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : []; } catch (e) { return []; } }
function queueAssetDeletion(id) { try { localStorage.setItem(ASSET_DELETE_KEY, JSON.stringify([...new Set([...pendingAssetDeletes(), id])])); } catch (e) {} }
async function cleanupDeletedAssets() {
  const active = new Set(S.project.assets.map(a => a.id));
  for (const id of pendingAssetDeletes()) if (!active.has(id)) await J.assetForget(id).catch(() => {});
  try { localStorage.setItem(ASSET_DELETE_KEY, JSON.stringify(pendingAssetDeletes().filter(id => active.has(id)))); } catch (e) {}
}
const U = { list: [], i: -1, restoring: false, pendingGroup: null, lastGroup: null, lastAt: 0 };
function initUndo() { U.list = [JSON.stringify(S.project)]; U.i = 0; updateUndoButtons(); }
function markUndoGroup(group) { U.pendingGroup = group; }
function updateUndoButtons() {
  if ($('btnUndo')) $('btnUndo').disabled = U.i <= 0;
  if ($('btnRedo')) $('btnRedo').disabled = U.i >= U.list.length - 1;
}
// a tap-sync pass and a line-start handle drag are one step each: recorded when they end (stopTap / pointerup flushSave)
function recordUndoState(force) {
  if (U.restoring || !S.project || ((S.tap || TL.drag >= 0) && !force)) return;
  const snap = JSON.stringify(S.project), group = U.pendingGroup, now = Date.now();
  U.pendingGroup = null;
  if (U.i < 0) { U.list = [snap]; U.i = 0; updateUndoButtons(); return; }
  if (snap === U.list[U.i]) return;
  const atTip = U.i === U.list.length - 1;
  U.list = U.list.slice(0, U.i + 1);
  if (group && atTip && group === U.lastGroup && now - U.lastAt < 1200 && U.i > 0) U.list[U.i] = snap;
  else { U.list.push(snap); U.i++; }
  if (U.list.length > 100) { U.list.shift(); U.i--; }
  U.lastGroup = group; U.lastAt = now;
  updateUndoButtons();
}
function undoMove(direction) {
  if (S.exporting) return;
  recordUndoState(true);
  const next = U.i + direction;
  if (next < 0 || next >= U.list.length) return;
  pause(); clearTimeout(replanTimer);
  if (S.areaEdit) cancelAreaEditor();
  S.tap = null; S.timelineDrag = null; S.linkDrag = null;
  $('tapPanel').hidden = true; $('btnTap').setAttribute('aria-pressed', 'false');
  U.restoring = true; U.i = next; U.pendingGroup = null; U.lastGroup = null;
  S.project = mergeProject(JSON.parse(U.list[next]));
  fontKey = ''; syncUI(); replan(); flushSave();
  U.restoring = false; updateUndoButtons();
  prepareAssets();                                // a 소재 brought back by undo is decoded again
}
let saveTimer = 0;
function autosave() { recordUndoState(); clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 700); }
function flushSave() { recordUndoState(); clearTimeout(saveTimer); try { localStorage.setItem(LS_KEY, JSON.stringify(S.project)); } catch (e) {} }
window.addEventListener('pagehide', () => { if (S.project) { flushSave(); cleanupDeletedMedia(); cleanupDeletedAssets(); } });

/* ---------------- planning ---------------- */
function audioLike() {
  const T = S.project.timing;
  if (S.audio) {
    const a = Object.assign({}, S.audio);
    if (T.bpm > 0) a.beats = J.beatGrid(T.bpm, T.beatOffset || 0, S.audio.duration);
    return a;
  }
  if (T.bpm > 0) return { beats: J.beatGrid(T.bpm, T.beatOffset || 0, 600) };
  return null;
}
/* 自動判定のとき、判定結果を言語欄の横に出す */
function langNote() {
  const el = $('langNote'); if (!el) return;
  el.textContent = (S.project.lang || 'auto') === 'auto' ? '→ ' + J.LANG_LABEL[J.resolveLang(S.project)] : '';
  if (langNote.last !== undefined && langNote.last !== J.lang) { try { renderFontRoles(); } catch (e) {} }   // font menus show the language's faces
  langNote.last = J.lang;
}
function replan() {
  S.plan = J.plan(S.project, audioLike());
  // lines locked in older projects (seed only): take a snapshot now, so from here on they stay exactly as they are
  for (const [i, o] of Object.entries(S.project.overrides || {})) if (o && o.lock && !Array.isArray(o.lockedCuts)) { const snap = J.lineSnapshot(S.plan, +i); if (snap) o.lockedCuts = snap; }
  S.plan.media = J.planMedia(S.project, S.plan, S.audio && S.audio.duration);
  S.plan.foreground = J.planMedia(S.project, S.plan, S.audio && S.audio.duration, 'foreground');
  S.plan.duration = Math.max(S.plan.media.duration, S.plan.foreground.duration);
  for (const layer of ['media', 'foreground']) {
    S.plan[layer].duration = S.plan.duration;
    const last = S.plan[layer].cuts.at(-1); if (last && last.videoDuration == null) last.end = S.plan.duration;
  }
  if (S.tap && S.tap.append && !S.audio) extendTapPreview(S.t);
  langNote();
  if (S.t > S.plan.duration) S.t = Math.max(0, S.plan.duration - 1e-3);
  refreshLoopHold();
  const temporarilyHidden = ref => S.project.durationOverride != null && /^l:\d+:\d+$/.test(ref) && +ref.split(':')[1] < S.plan.lines.length;
  S.project.timelineLinks = S.project.timelineLinks.filter(link => link && link.a !== link.b && (boundaryCut(link.a) || temporarilyHidden(link.a)) && (boundaryCut(link.b) || temporarilyHidden(link.b)));
  renderLines(); renderMediaList(); renderMediaLines(); sizeViewport(); drawTimeline(); drawTimelineLinks(); updateTimeUI();
  lastCutIdx = -2;
  if (typeof cutPick !== 'undefined' && cutPick.g) fillCutPick();
  S.need = true; autosave(); ensureFonts(); drawSwatch(); showNow();
  clearTimeout(warmTimer); warmTimer = setTimeout(warm, 450);
}
/* pre-decompose glyphs used by piece animations while the editor is idle, so playback does not hitch */
let warmTimer = 0, warmJob = 0;
function warm() {
  const job = ++warmJob;
  const cuts = S.plan.cuts.filter(c => c.enter === 'assemble' || ['explode', 'fall', 'drift'].includes(c.exit));
  const src = $('view');
  const cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
  const ctx = cv.getContext('2d');
  let i = 0;
  const idle = window.requestIdleCallback ? (f) => window.requestIdleCallback(f, { timeout: 400 }) : (f) => setTimeout(() => f(null), 40);
  const step = (deadline) => {
    if (job !== warmJob || S.exporting) return;
    do {
      const c = cuts[i++]; if (!c) break;
      const ts = [];
      if (c.enter === 'assemble') ts.push(c.start + Math.min(c.inDur * 0.3, c.dur * 0.2));
      if (c.outDur > 0) ts.push(c.end - c.outDur * 0.5);
      for (const t of ts) { try { S.renderer.frame(ctx, S.plan, t, { scale: cv.width / S.plan.W, fast: true, noHud: true, noGhost: true }); } catch (e) {} }
    } while (i < cuts.length && deadline && deadline.timeRemaining() > 10);
    if (i < cuts.length) idle(step);
  };
  idle(step);
}
let replanTimer = 0;
const replanSoon = (ms = 220) => { clearTimeout(replanTimer); replanTimer = setTimeout(replan, ms); };
let fontKey = '';
let thumbFonts = null;
async function ensureFonts() {
  const txt = S.project.lyrics + (S.project.title || '') + (S.project.artist || '') + HUD_CHARS;
  const keys = J.fontsOfPlan(S.plan);                       // only the faces this plan draws with
  const key = txt + '|' + keys.join(',') + '|' + Object.keys(J.FONTS).length + '|' + J.lang;   // the lyric language changes the faces
  if (key === fontKey) return;
  fontKey = key;
  showMsg('글꼴 불러오는 중…');
  try { await J.ensureFonts(txt, keys); } catch (e) {}
  showMsg(null); S.need = true; drawStyleGrid(); loadThumbFonts();
}
// style thumbnails need two glyphs of every style's display face — fetched only once the style grid is actually shown
function loadThumbFonts() {
  if (thumbFonts || !$('styleGrid').offsetParent) return;
  thumbFonts = J.ensureFonts('JIZURA', [...new Set(J.STYLE_ORDER.map(k => J.STYLES[k].fonts.display[0]))]).then(() => drawStyleGrid()).catch(() => {});
}
function showMsg(m) { const el = $('viewMsg'); if (!m) { el.hidden = true; return; } el.textContent = m; el.hidden = false; }

/* ---------------- viewport & drawing ---------------- */
// 固定表示: on wide & tall windows the page itself doesn't scroll (see style.css html.fixed-ok)
const FIXED_MQ = window.matchMedia ? window.matchMedia('(min-width: 1181px) and (min-height: 620px)') : null;
document.documentElement.classList.add('fixed-ok');
function fixedLayout() { return !!(FIXED_MQ && FIXED_MQ.matches) && document.documentElement.classList.contains('fixed-ok'); }
function sizeViewport() {
  const vp = $('viewport'), c = $('view');
  const ar = S.plan.W / S.plan.H;
  let cssW = vp.clientWidth || 800, cssH = cssW / ar;
  // fixed workspace: the viewport gets whatever height is left under the header / above the transport and timeline
  const maxH = fixedLayout() ? Math.max(160, vp.clientHeight - 2) : Math.max(220, window.innerHeight * 0.68);
  if (cssH > maxH) { cssH = maxH; cssW = cssH * ar; }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const pw = Math.round(Math.min(S.plan.W, cssW * dpr)), ph = Math.round(pw / ar);
  if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }
  c.style.width = cssW + 'px'; c.style.height = cssH + 'px';
  positionAreaEditor();
  S.need = true;
}
// preview only: dotted outline of the centre that 中央を空ける keeps free (never in exports)
function drawCenterGuide(ctx, k) {
  const P = S.plan, z = P.zones; if (!z) return;
  const r = z[0].side === 'left' ? [z[0].w, 0, P.W - z[0].w - z[1].w, P.H] : [0, z[0].h, P.W, P.H - z[0].h - z[1].h];
  ctx.save(); ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.setLineDash([14, 10]); ctx.lineWidth = 2 / k * 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.strokeRect(r[0] + 4, r[1] + 4, r[2] - 8, r[3] - 8);
  ctx.setLineDash([]); ctx.restore();
}
function draw() {
  const c = $('view'), ctx = c.getContext('2d');
  J.syncMediaPreview(S.plan, S.t, S.playing);
  const t0 = performance.now();
  const previewCuts = S.areaEdit && S.areaEdit.kind === 'lyric' && S.areaEdit.draft ? S.plan.cuts.filter(cut => cut.line === S.areaEdit.index) : [];
  const previousAreas = previewCuts.map(cut => cut.area);
  previewCuts.forEach(cut => { cut.area = { ...S.areaEdit.draft, angle: S.areaEdit.angle }; });
  const edit = S.areaEdit, mediaCut = edit && edit.kind !== 'lyric' && S.plan[edit.kind].cuts[edit.index];
  const previousMedia = mediaCut && { placement: mediaCut.placement, zoom: mediaCut.zoom, hold: mediaCut.hold, enter: mediaCut.enter, exit: mediaCut.exit, trans: mediaCut.trans };
  if (mediaCut) Object.assign(mediaCut, { placement: { cx: edit.draft.x + edit.draft.w / 2, cy: edit.draft.y + edit.draft.h / 2, w: edit.draft.w, h: edit.draft.h, lockAspect: edit.lockAspect, angle: edit.angle }, zoom: 100, hold: 'still', enter: 'cut', exit: 'cut', trans: undefined });
  try { S.renderer.frame(ctx, S.plan, S.t, { scale: c.width / S.plan.W, fast: !!edit || S.playing && S.slow, noTrans: !!edit, noPost: !!edit, previewEdit: !!edit, noForeground: !!edit && edit.kind === 'media' }); }
  finally { previewCuts.forEach((cut, i) => { cut.area = previousAreas[i]; }); if (mediaCut) Object.assign(mediaCut, previousMedia); }
  if (S.plan.centerFree) drawCenterGuide(ctx, c.width / S.plan.W);
  const dt = performance.now() - t0;
  S.slow = S.playing ? (dt > 30 ? true : dt < 14 ? false : S.slow) : false;
  updateTimeUI(); drawTimeline(); updateCutInfo();
}
function tick(now) {
  requestAnimationFrame(tick);
  if (S.exporting) return;
  if (S.playing) {
    // rAF timestamps can precede the moment play()/seek() stamped t0 → clamp so t never goes negative
    let t = Math.max(0, S.audio ? AP.time() : (now - S.t0) / 1000);
    if (S.tap && S.tap.append && !S.audio && t >= S.plan.duration - 2) extendTapPreview(t);
    const stopAt = S.tap && S.tap.append && S.audio ? Math.min(S.plan.duration, S.audio.duration) : S.plan.duration;
    const range = S.tap ? { start: 0, end: stopAt } : activeLoopRange();
    if (t >= range.end - 1e-3) {
      if (S.loop && !S.tap) { seek(range.start); t = range.start; }
      else { pause(); t = Math.min(t, stopAt - 1e-3); if (S.tap) stopTap(); }
    }
    S.t = t; S.need = true;
    followTlPlayhead();
  }
  if (S.need) { S.need = false; draw(); }
}
function updateTimeUI() {
  $('timeNow').textContent = J.fmtTime(S.t);
  $('timeDur').textContent = J.fmtTime(S.durationDrag ? S.durationDrag.preview : S.plan.duration);
  $('timeDur').classList.toggle('manual', S.project.durationOverride != null || !!S.durationDrag);
  if (!S.scrubbing) $('scrub').value = String(Math.round(S.t / Math.max(0.001, S.plan.duration) * 10000));
}
function minimumProjectDuration() {
  let minimum = 0.1;
  for (const line of S.plan.lines) minimum = Math.max(minimum, line.start + 0.04);
  for (const blank of S.project.lyricBlankCuts || []) if (Number.isFinite(+blank.start)) minimum = Math.max(minimum, +blank.start + 0.04);
  for (const layer of ['media', 'foreground']) {
    minimum = Math.max(minimum, S.plan[layer].cuts.length * 0.04);
    for (const [index, time] of Object.entries(S.project[layer].timing.lineTimes)) {
      if (+index < S.plan[layer].cuts.length && Number.isFinite(+time)) minimum = Math.max(minimum, +time + (S.plan[layer].cuts.length - +index) * 0.04);
    }
  }
  return Math.ceil(minimum * 100) / 100;
}
function parseProjectDuration(raw) {
  const parts = String(raw).trim().split(':');
  if (parts.length > 3 || !parts.every(p => /^\d+(?:\.\d{1,2})?$/.test(p))) return NaN;
  if (parts.slice(0, -1).some(p => p.includes('.'))) return NaN;
  if (parts.length > 1 && +parts.at(-1) >= 60) return NaN;
  if (parts.length === 3 && +parts[1] >= 60) return NaN;
  return parts.reduce((seconds, part) => seconds * 60 + +part, 0);
}
function setProjectDuration(seconds) {
  if (S.exporting || S.tap) return false;
  const minimum = minimumProjectDuration();
  if (seconds != null && (!Number.isFinite(seconds) || seconds < minimum - 1e-6 || seconds > 21600)) {
    toast(`동영상 전체 길이는 ${J.fmtTime(minimum)} ~ 06:00:00 범위로 입력해 주세요`);
    return false;
  }
  if (S.areaEdit) cancelAreaEditor();
  pause();
  S.project.durationOverride = seconds == null ? null : Math.round(seconds * 100) / 100;
  replan();
  return true;
}
function play() {
  refreshLoopHold();
  if (S.audio) AP.play(S.audio.buffer, S.t);
  else S.t0 = performance.now() - S.t * 1000;
  S.playing = true; $('btnPlay').textContent = '❚❚'; $('btnPlay').setAttribute('aria-label', '일시 정지');
}
function pause() {
  S.playing = false; AP.stop();
  J.syncMediaPreview(S.plan, S.t, false);
  $('btnPlay').textContent = '▶'; $('btnPlay').setAttribute('aria-label', '재생'); S.need = true;
}
function seek(t) {
  S.t = J.clamp(t, 0, Math.max(0, S.plan.duration - 1e-3));
  if (S.audio) { if (S.playing) AP.play(S.audio.buffer, S.t); }
  else S.t0 = performance.now() - S.t * 1000;
  J.syncMediaPreview(S.plan, S.t, S.playing);
  refreshLoopHold();
  S.need = true;
}

/* ---------------- timeline ---------------- */
// zoom = the width of the scrolled timeline stack (S.timelineZoom); line starts are draggable handles in the top band
const layoutHue = k => (J.LAYOUT_ORDER.indexOf(k) * 37 + 30) % 360;
const TL = { hover: -1, drag: -1 };
// the lyric timeline shares the zoom of the stacked timelines (S.timelineZoom, a wider scrolled stack),
// so the view always spans the whole song in canvas coordinates
function tlView() {
  const D = Math.max(0.001, S.plan.duration);
  return { D, vd: D, off: 0 };
}
// up to 8x, or further on a long song: down to about a 2 s window
const timelineZoomMax = () => Math.max(8, (S.plan ? S.plan.duration : 0) / 2);
function sizeTimelineStack() {
  const scroll = $('timelineScroll'), stack = $('timelineStack'), max = timelineZoomMax();
  S.timelineZoom = J.clamp(S.timelineZoom, 1, max);                     // the song may have become shorter
  const width = Math.max(10, Math.round(scroll.clientWidth * S.timelineZoom));
  if (stack.style.width !== `${width}px`) stack.style.width = `${width}px`;
  $('timelineZoomValue').textContent = `${Math.round(S.timelineZoom * 100)}%`;
  $('timelineZoomOut').disabled = S.timelineZoom <= 1;
  $('timelineZoomIn').disabled = S.timelineZoom >= max - 1e-6;
}
// anchorX (client px): the point that stays put while zooming (the wheel pointer); default: the middle of the view
function setTimelineZoom(zoom, anchorX) {
  const scroll = $('timelineScroll'), stack = $('timelineStack');
  const a = anchorX == null ? scroll.clientWidth / 2 : J.clamp(anchorX - scroll.getBoundingClientRect().left, 0, scroll.clientWidth);
  const fraction = (scroll.scrollLeft + a) / Math.max(1, stack.clientWidth);
  S.timelineZoom = J.clamp(zoom, 1, timelineZoomMax());
  sizeTimelineStack();
  scroll.scrollLeft = Math.max(0, fraction * stack.clientWidth - a);
  drawTimeline(); drawTimelineLinks();
}
// while playing zoomed in: redraw (which scrolls the view) once the playhead leaves the visible part
function followTlPlayhead() {
  if (!(TL.z > 1) || TL.drag >= 0) return;
  const { vd, off } = tlView();
  if (S.t < off || S.t > off + vd * 0.92) drawTimeline();
}
function drawTimeline() {
  sizeTimelineStack();
  const c = $('timeline'), dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = J.clamp(Math.round(c.clientWidth * dpr), 10, 32000), h = Math.max(10, Math.round(c.clientHeight * dpr));   // deep zoom: stay under the canvas size limit
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const { D, vd, off } = tlView();
  // follow the playhead while playing (zoomed in): scroll the stack
  if (S.timelineZoom > 1 && S.playing && TL.drag < 0) {
    const sc = $('timelineScroll'), px = S.t / D * c.clientWidth;
    if (px < sc.scrollLeft || px > sc.scrollLeft + sc.clientWidth * 0.92) sc.scrollLeft = Math.max(0, px - sc.clientWidth * 0.1);
  }
  const x = c.getContext('2d'), X = t => (t - off) / vd * w, T = px => off + px / w * vd;
  x.fillStyle = '#131316'; x.fillRect(0, 0, w, h);
  if (S.audio && S.audio.peaks) {
    const pk = S.audio.peaks, n = pk.length, sd = S.audio.duration;
    x.fillStyle = '#2b2b33';
    for (let i = 0; i < w; i += 2) { const t = T(i); if (t > sd) break; if (t < 0) continue; const v = pk[Math.min(n - 1, Math.floor(t / sd * n))]; const hh = v * h * 0.8; x.fillRect(i, h * 0.6 - hh / 2, 1.5, hh); }
  }
  const beats = S.plan.beats || [];
  x.fillStyle = '#3a3a44';
  for (const b of beats) { if (b < off) continue; if (b > off + vd) break; x.fillRect(Math.round(X(b)), h - 6 * dpr, 1, 6 * dpr); }
  const top = h * 0.3, bot = h - 8 * dpr;
  const R = exportRange();
  if (R) { x.fillStyle = 'rgba(245,165,12,0.10)'; x.fillRect(X(R.t0), 0, X(R.t1) - X(R.t0), h); }
  for (const cut of S.plan.cuts) {
    const x0 = X(cut.start), x1 = X(cut.end);
    if (x1 < 0 || x0 > w) continue;
    const hue = cut.blank ? 190 : layoutHue(cut.layout);
    x.fillStyle = `hsla(${hue},70%,58%,0.28)`; x.fillRect(x0, top, Math.max(1, x1 - x0 - 1), bot - top);
    x.fillStyle = `hsla(${hue},80%,62%,0.95)`; x.fillRect(x0, top, Math.max(1, 2 * dpr), bot - top);
    if (cut.line >= 0) x.fillRect(x0 - 2 * dpr, top - 3 * dpr, 6 * dpr, 6 * dpr);
    if (x1 - x0 > 34 * dpr) {
      x.fillStyle = 'rgba(236,231,225,0.85)'; x.font = `${10 * dpr}px ${getComputedStyle(document.body).getPropertyValue('--mono') || 'monospace'}`;
      x.save(); x.beginPath(); x.rect(x0, top, x1 - x0 - 3, bot - top); x.clip();
      x.fillText(cut.blank ? '무표시' : (cut.text || cut.lineText || (J.LAYOUTS[cut.layout] || {}).name || cut.layout), x0 + 5 * dpr, top + 13 * dpr); x.restore();
    }
  }
  x.font = `${10 * dpr}px monospace`;
  const LT = S.project.timing.lineTimes || {};
  for (const ln of S.plan.lines) {
    const lx = X(ln.start);
    if (lx < -20 * dpr || lx > w + 2) continue;
    const on = ln.index === TL.drag || ln.index === TL.hover, man = LT[ln.index] != null;
    x.fillStyle = on ? '#f5a50c' : man ? '#6fb7c8' : '#5d5a63'; x.fillRect(lx - (on ? dpr : 0), 0, on ? 2 * dpr : 1, top);
    // handle
    x.beginPath(); x.moveTo(lx - 5 * dpr, 0); x.lineTo(lx + 5 * dpr, 0); x.lineTo(lx, 7 * dpr); x.closePath(); x.fill();
    x.fillStyle = on ? '#f5a50c' : '#8e8a94'; x.fillText(String(ln.index + 1).padStart(2, '0') + (ln.interlude ? ' 간주' : ''), lx + 4 * dpr, 17 * dpr);
  }
  if (S.loop === 'line' || S.loop === 'cut') {
    const r = activeLoopRange();
    x.fillStyle = 'rgba(245,165,12,0.16)';
    x.fillRect(X(r.start), 0, Math.max(2 * dpr, X(r.end) - X(r.start)), h);
  }
  const px = X(S.t);
  x.fillStyle = '#f5a50c'; x.fillRect(Math.round(px) - dpr, 0, 2 * dpr, h);
  drawTimelineDragGuide(x, w, h, dpr, 'lyrics');
  drawMediaTimeline();
  drawMediaTimeline('foreground');
}
function extendTapPreview(t) {
  const end = Math.max(S.plan.duration, t + 10);
  S.plan.duration = end;
  for (const layer of ['media', 'foreground']) {
    S.plan[layer].duration = end;
    const last = S.plan[layer].cuts.at(-1); if (last && last.videoDuration == null) last.end = end;
  }
}
function drawMediaTimeline(layer = 'media') {
  const c = $(layer === 'media' ? 'mediaTimeline' : 'foregroundTimeline'), dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = J.clamp(Math.round(c.clientWidth * dpr), 10, 32000), h = Math.max(10, Math.round(c.clientHeight * dpr));   // deep zoom: stay under the canvas size limit
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const x = c.getContext('2d'), D = Math.max(0.001, S.plan.duration), X = t => t / D * w;
  x.fillStyle = '#131316'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#8e8a94'; x.font = `${10 * dpr}px monospace`; x.fillText(layer === 'media' ? '배경' : '전경', 6 * dpr, 12 * dpr);
  for (const cut of S.plan[layer].cuts) {
    const a = X(cut.start), b = X(cut.end);
    x.fillStyle = cut.type === 'video' ? 'rgba(22,244,212,0.28)' : 'rgba(245,165,12,0.28)'; x.fillRect(a, 17 * dpr, Math.max(1, b - a - 1), h - 20 * dpr);
    x.fillStyle = cut.type === 'video' ? '#16f4d4' : '#f5a50c'; x.fillRect(a, 17 * dpr, 2 * dpr, h - 20 * dpr);
    x.fillRect(a - 2 * dpr, 14 * dpr, 6 * dpr, 6 * dpr);
    if (b - a > 45 * dpr) { x.save(); x.beginPath(); x.rect(a, 17 * dpr, b - a - 3, h - 20 * dpr); x.clip(); x.fillStyle = '#ece7e1'; x.fillText(cut.name, a + 5 * dpr, 31 * dpr); x.restore(); }
  }
  x.fillStyle = '#f5a50c'; x.fillRect(Math.round(X(S.t)) - dpr, 0, 2 * dpr, h);
  drawTimelineDragGuide(x, w, h, dpr, layer);
}
function drawTimelineDragGuide(ctx, width, height, dpr, layer) {
  const drag = S.timelineDrag;
  if (!drag || !drag.moved || !linkedRefs(drag.ref).some(ref => boundaryLayer(ref) === layer)) return;
  const px = drag.preview / Math.max(0.001, S.plan.duration) * width;
  ctx.fillStyle = '#16f4d4'; ctx.fillRect(Math.round(px) - 2 * dpr, 0, 4 * dpr, height);
  ctx.fillStyle = '#101318'; ctx.fillRect(J.clamp(px + 5 * dpr, 0, width - 47 * dpr), 1 * dpr, 47 * dpr, 15 * dpr);
  ctx.fillStyle = '#16f4d4'; ctx.font = `${11 * dpr}px monospace`;
  ctx.fillText(`${drag.preview.toFixed(2)}s`, J.clamp(px + 8 * dpr, 3 * dpr, width - 44 * dpr), 12 * dpr);
}
function tlTime(ev) {
  const r = $('timeline').getBoundingClientRect(), { vd, off } = tlView();
  return off + J.clamp((ev.clientX - r.left) / r.width, 0, 1) * vd;
}
function timelineSeek(ev) {
  const r = (ev.currentTarget || $('timeline')).getBoundingClientRect();
  seek(J.clamp((ev.clientX - r.left) / r.width, 0, 1) * S.plan.duration);
}
/* the line whose start handle is under the pointer (top band, ±7px) */
function tlHandleAt(ev) {
  const c = $('timeline'), r = c.getBoundingClientRect(), { vd, off } = tlView();
  if (ev.clientY - r.top > r.height * 0.45) return -1;
  let best = -1, bd = 8;
  for (const ln of S.plan.lines) { const d = Math.abs((ln.start - off) / vd * r.width - (ev.clientX - r.left)); if (d < bd) { bd = d; best = ln.index; } }
  return best;
}
// hand-set cut boundaries (timing.cutTimes 'line:part' / 'line:interlude', seconds) follow their line when its start
// moves (line-start handle, tap sync, 곡에서 초안, the time field): base = the boundaries and line starts before the
// change, so a drag or a tap pass is always measured from where it began; one that no longer fits its line is dropped
function lineShiftBase() {
  return { cutTimes: Object.assign({}, S.project.timing.cutTimes || {}), starts: new Map(S.plan.lines.map(l => [l.index, l.start])) };
}
function followLineStarts(base) {
  if (!base) return;
  const lines = new Map(S.plan.lines.map(l => [l.index, l])), out = {};
  for (const [key, v] of Object.entries(base.cutTimes)) {
    const ln = lines.get(parseInt(key, 10)), s0 = base.starts.get(parseInt(key, 10));
    const d = ln && s0 != null && Number.isFinite(+v) ? ln.start - s0 : 0;
    if (Math.abs(d) < 1e-6) { out[key] = v; continue; }
    const t = +(+v + d).toFixed(3);
    if (t > ln.start && t < ln.end) out[key] = t;
  }
  if (JSON.stringify(out) === JSON.stringify(S.project.timing.cutTimes || {})) return;
  S.project.timing.cutTimes = out; replan();
}
function tlDragTo(i, ev) {
  let t = tlTime(ev);
  if (!ev.shiftKey && S.plan.beats && S.plan.beats.length) {       // snap to the nearest beat (Shift: free)
    let bt = null, bd = 0.12; for (const b of S.plan.beats) { const d = Math.abs(b - t); if (d < bd) { bd = d; bt = b; } if (b > t + 0.2) break; }
    if (bt != null) t = bt;
  }
  const L = S.plan.lines, lo = i > 0 ? L[i - 1].start + 0.2 : 0, hi = i < L.length - 1 ? L[i + 1].start - 0.2 : S.plan.duration - 0.2;
  t = +J.clamp(t, lo, Math.max(lo, hi)).toFixed(3);
  if (!S.project.timing.lineTimes) S.project.timing.lineTimes = {};
  // pin the neighbours too, so moving one boundary never shifts the lines after it
  L.forEach(ln => { if (S.project.timing.lineTimes[ln.index] == null) S.project.timing.lineTimes[ln.index] = +ln.start.toFixed(3); });
  S.project.timing.lineTimes[i] = t;
  replan(); followLineStarts(TL.base); seek(t + 0.001);
}

/* ---------------- keep the playing line in view (the list scrolls inside its column) ---------------- */
let listTouched = 0;
function followLine(li) {
  if (!S.playing || li < 0 || !fixedLayout()) return;
  if (performance.now() - listTouched < 2500) return;                       // the user is scrolling the list
  const el = S.lineEls[li], col = el && el.closest('.col-left');
  if (!el || !col || col.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  const tp = $('tapPanel'), pad = tp && !tp.hidden ? tp.offsetHeight + 12 : 8;   // 固定表示中のタップboxの下に隠れないように
  const r = el.getBoundingClientRect(), c = col.getBoundingClientRect();
  if (r.top >= c.top + pad && r.bottom <= c.bottom - 8) return;
  col.scrollTo({ top: col.scrollTop + (r.top - c.top) - Math.max(c.height * 0.3, pad + 24), behavior: 'smooth' });
}
function bindFollow() {
  const col = document.querySelector('.col-left'); if (!col) return;
  const touch = () => { listTouched = performance.now(); };
  col.addEventListener('wheel', touch, { passive: true }); col.addEventListener('touchmove', touch, { passive: true }); col.addEventListener('pointerdown', touch);
}
function boundaryRef(layer, cut) {
  if (layer === 'foreground') return `f:${cut.index}`;
  if (layer === 'media') return `m:${cut.index}`;
  return cut.blank ? `l:blank:${cut.blankId}` : `l:${cut.line}:${cut.part}`;
}
function boundaryLayer(ref) { return ref[0] === 'f' ? 'foreground' : ref[0] === 'm' ? 'media' : 'lyrics'; }
function boundaryCut(ref) {
  if (typeof ref !== 'string' || !S.plan) return null;
  const layer = boundaryLayer(ref);
  if (layer !== 'lyrics') {
    const index = +ref.slice(2);
    return Number.isInteger(index) && index >= 0 && ref === `${ref[0]}:${index}` ? S.plan[layer].cuts[index] || null : null;
  }
  if (ref.startsWith('l:blank:')) return S.plan.cuts.find(c => c.blank && c.blankId === ref.slice(8)) || null;
  return S.plan.cuts.find(c => c.line >= 0 && boundaryRef('lyrics', c) === ref) || null;
}
function linkedRefs(ref) {
  const seen = new Set([ref]), queue = [ref];
  for (const cur of queue) for (const link of S.project.timelineLinks) {
    const next = link.a === cur ? link.b : link.b === cur ? link.a : null;
    if (next && !seen.has(next)) { seen.add(next); queue.push(next); }
  }
  return queue;
}
function timelineMarkers() {
  const stack = $('timelineStack'), D = Math.max(0.001, S.plan.duration), markers = [];
  for (const [layer, id] of [['foreground', 'foregroundTimeline'], ['lyrics', 'timeline'], ['media', 'mediaTimeline']]) {
    const canvas = $(id), cuts = layer === 'lyrics' ? S.plan.cuts.filter(c => c.line >= 0 || c.blank) : S.plan[layer].cuts;
    const y = canvas.offsetTop + 11;
    for (const cut of cuts) if (layer !== 'lyrics' || !/^interlude:/.test(cut.part)) markers.push({ ref: boundaryRef(layer, cut), layer, x: canvas.offsetLeft + cut.start / D * canvas.clientWidth, y });
  }
  return markers;
}
function rerollLyricLine(index) {
  const line = S.plan.lines[index]; if (!line) return;
  const current = S.project.overrides[index] || {};
  setOv(index, { seed: (current.seed | 0) + 1, lock: false, lockedSeed: undefined, lockedCuts: undefined });
  replan(); seek(line.start + 0.001);
}
function toggleLyricLineLock(index) {
  const line = S.plan.lines[index]; if (!line) return;
  const current = S.project.overrides[index] || {};
  setOv(index, current.lock ? { lock: false, lockedSeed: undefined, lockedCuts: undefined } : { lock: true, lockedSeed: line.seed, lockedCuts: J.lineSnapshot(S.plan, index) || undefined });
  replan();
}
function toggleLyricCutFrontmost(line, part) {
  const key = `${line}:${part}`, options = S.project.lyricCutOptions;
  if (options[key] && options[key].frontmost) delete options[key];
  else options[key] = { frontmost: true };
  replan();
}
function mediaCutOptions(layer, index) {
  const cut = S.plan[layer].cuts[index]; if (!cut) return null;
  const media = S.project[layer];
  return Object.assign({}, media.overrides[cut.itemId] || {}, media.cutOverrides[index] || {});
}
function rerollMediaCut(layer, index) {
  const cut = S.plan[layer].cuts[index], options = mediaCutOptions(layer, index);
  if (!cut || !options) return;
  mediaOv(index, { seed: (options.seed | 0) + 1, lock: false }, layer);
  replan(); seek(cut.start + 0.001);
}
function toggleMediaCutLock(layer, index) {
  const cut = S.plan[layer].cuts[index], options = mediaCutOptions(layer, index);
  if (!cut || !options) return;
  mediaOv(index, options.lock ? { lock: false, lockedSeed: undefined } : { lock: true, lockedSeed: cut.seed }, layer);
  replan();
}
function performTimelineAction(control) {
  const layer = control.dataset.layer, index = +control.dataset.index;
  if (!Number.isInteger(index) || index < 0) return;
  if (control.dataset.action === 'area') {
    if (layer === 'lyrics') openAreaEditor(index);
    else if (layer === 'foreground' || layer === 'media') openMediaEditor(index, layer);
    return;
  }
  if (control.dataset.action === 'frontmost' && layer === 'lyrics') {
    toggleLyricCutFrontmost(index, +control.dataset.part);
    return;
  }
  if (layer === 'lyrics') {
    if (control.dataset.action === 'dice') rerollLyricLine(index);
    else toggleLyricLineLock(index);
  } else if (layer === 'foreground' || layer === 'media') {
    if (control.dataset.action === 'dice') rerollMediaCut(layer, index);
    else toggleMediaCutLock(layer, index);
  }
}
function drawTimelineLinks() {
  const svg = $('timelineLinks'), stack = $('timelineStack');
  if (!svg || !S.plan) return;
  const width = stack.clientWidth, height = stack.clientHeight;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const markers = timelineMarkers();
  if (S.timelineDrag && S.timelineDrag.moved) {
    const moving = new Set(linkedRefs(S.timelineDrag.ref));
    for (const marker of markers) if (moving.has(marker.ref)) {
      const canvas = $(marker.layer === 'lyrics' ? 'timeline' : marker.layer === 'media' ? 'mediaTimeline' : 'foregroundTimeline');
      marker.x = canvas.offsetLeft + S.timelineDrag.preview / Math.max(0.001, S.plan.duration) * canvas.clientWidth;
    }
  }
  const byRef = new Map(markers.map(m => [m.ref, m]));
  const links = S.project.timelineLinks.map((link, index) => {
    const a = byRef.get(link.a), b = byRef.get(link.b);
    if (!a || !b) return '';
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    return `<line class="link-wire" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/><g class="link-remove" data-edge="${index}" role="button" aria-label="링크 해제"><circle cx="${mx}" cy="${my}" r="9"/><text x="${mx}" y="${my + 0.5}">×</text></g>`;
  }).join('');
  const preview = S.linkDrag ? `<line class="link-preview" x1="${S.linkDrag.sourceX}" y1="${S.linkDrag.sourceY}" x2="${S.linkDrag.x}" y2="${S.linkDrag.y}"/>` : '';
  const handles = markers.map(m => `<g class="link-handle ${linkedRefs(m.ref).length > 1 ? 'linked' : ''}" data-ref="${escapeHtml(m.ref)}" role="button" aria-label="경계 연결"><circle cx="${m.x}" cy="${m.y}" r="9"/><text x="${m.x}" y="${m.y + 0.5}">🔗</text></g>`).join('');
  const action = (layer, cut, index, locked) => {
    const canvas = $(layer === 'lyrics' ? 'timeline' : layer === 'foreground' ? 'foregroundTimeline' : 'mediaTimeline');
    const startX = canvas.offsetLeft + cut.start / Math.max(0.001, S.plan.duration) * canvas.clientWidth;
    const left = J.clamp(startX + 25, canvas.offsetLeft + 9, canvas.offsetLeft + canvas.clientWidth - 63);
    const y = canvas.offsetTop + 11;
    const areaIcon = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="10"/><path d="M2 6h12M5 3v10"/></svg>';
    const actions = [['dice', false, layer === 'lyrics' ? '이 행 다시 뽑기' : '이 컷 다시 뽑기', ICON.dice], ['lock', locked, layer === 'lyrics' ? '이 행의 구성 잠금' : '이 컷 잠금', ICON.lock]];
    if (layer === 'lyrics' || J.mediaAssets.has(cut.itemId)) actions.push(['area', false, layer === 'lyrics' ? '이 행의 표시 영역을 편집' : '이 컷의 배치·크기 편집', areaIcon]);
    return actions.map(([name, active, label, icon], n) => {
      const x = left + n * 20, graphic = icon.replace('<svg ', '<svg x="-7" y="-7" width="14" height="14" ');
      return `<g class="timeline-action ${active ? 'locked' : ''}" data-action="${name}" data-layer="${layer}" data-index="${index}" role="button" tabindex="0" aria-label="${label}" ${name === 'lock' ? `aria-pressed="${active}"` : ''} transform="translate(${x} ${y})"><rect x="-9" y="-9" width="18" height="18" rx="3"/>${graphic}</g>`;
    }).join('');
  };
  const lyricActions = S.plan.lines.map(line => {
    const cut = S.plan.cuts.find(c => c.line === line.index && c.part === 0);
    return cut ? action('lyrics', cut, line.index, !!(S.project.overrides[line.index] || {}).lock) : '';
  }).join('');
  const frontmostActions = S.plan.cuts.filter(cut => cut.line >= 0 && Number.isInteger(cut.part)).map(cut => {
    const canvas = $('timeline'), startX = canvas.offsetLeft + cut.start / Math.max(0.001, S.plan.duration) * canvas.clientWidth;
    const x = J.clamp(startX + 10, canvas.offsetLeft + 9, canvas.offsetLeft + canvas.clientWidth - 9);
    const y = canvas.offsetTop + 33, active = !!cut.frontmost;
    const graphic = ICON.frontmost.replace('<svg ', '<svg x="-7" y="-7" width="14" height="14" ');
    return `<g class="timeline-action ${active ? 'frontmost' : ''}" data-action="frontmost" data-layer="lyrics" data-index="${cut.line}" data-part="${cut.part}" role="button" tabindex="0" aria-label="${cut.line + 1}행 ${cut.part + 1}컷을 맨 앞에 표시" aria-pressed="${active}" transform="translate(${x} ${y})"><rect x="-9" y="-9" width="18" height="18" rx="3"/>${graphic}</g>`;
  }).join('');
  const mediaActions = ['foreground', 'media'].map(layer => S.plan[layer].cuts.map(cut => action(layer, cut, cut.index, !!mediaCutOptions(layer, cut.index).lock)).join('')).join('');
  svg.innerHTML = links + preview + handles + lyricActions + frontmostActions + mediaActions;
}
function markerNear(clientX, clientY, sourceLayer) {
  const rect = $('timelineStack').getBoundingClientRect(), x = clientX - rect.left, y = clientY - rect.top;
  let best = null, distance = 18;
  for (const marker of timelineMarkers()) {
    if (marker.layer === sourceLayer) continue;
    const d = Math.hypot(marker.x - x, marker.y - y);
    if (d < distance) { best = marker; distance = d; }
  }
  return best;
}
function timelineBoundaryAt(ev, layer) {
  const rect = ev.currentTarget.getBoundingClientRect(), duration = S.plan.duration;
  const cuts = layer === 'lyrics' ? S.plan.cuts.filter(c => c.line >= 0 || c.blank) : S.plan[layer].cuts;
  let chosen = null, distance = 9;
  for (const cut of cuts) {
    const px = rect.left + cut.start / duration * rect.width, delta = Math.abs(ev.clientX - px);
    if (delta < distance) { chosen = cut; distance = delta; }
  }
  return chosen ? timelineBoundaryForCut(chosen, layer) : null;
}
function timelineBoundaryForCut(chosen, layer) {
  // the later pieces of a long interlude ('interlude:k') are split by the planner and have no stored time: not draggable
  if (layer === 'lyrics' && /^interlude:/.test(chosen.part)) return null;
  const duration = S.plan.duration;
  let min, max, target;
  if (layer !== 'lyrics') {
    const cutsForLayer = S.plan[layer].cuts, index = chosen.index;
    min = index ? cutsForLayer[index - 1].start + 0.04 : 0;
    max = index + 1 < cutsForLayer.length ? cutsForLayer[index + 1].start - 0.04 : duration - 0.04;
    target = { index };
  } else if (chosen.blank) {
    const rows = [...S.plan.lines.map(line => ({ start: line.start })), ...S.plan.cuts.filter(c => c.blank).map(c => ({ start: c.start, id: c.blankId }))].sort((a, b) => a.start - b.start);
    const i = rows.findIndex(row => row.id === chosen.blankId);
    min = i > 0 ? rows[i - 1].start + 0.04 : 0;
    max = i + 1 < rows.length ? rows[i + 1].start - 0.04 : duration - 0.04;
    target = { blankId: chosen.blankId };
  } else if (chosen.part === 'interlude') {
    const previous = S.plan.cuts.find(c => c.line === chosen.line && typeof c.part === 'number' && c.end === chosen.start);
    min = previous ? previous.start + 0.22 : S.plan.lines[chosen.line].start + 0.5;
    max = chosen.end - 1.31;
    target = { line: chosen.line, part: 'interlude' };
  } else if (chosen.part === 0) {
    const line = chosen.line, lines = S.plan.lines;
    min = line ? lines[line - 1].start + 0.35 : 0;
    max = line + 1 < lines.length ? lines[line + 1].start - 0.5 : duration - 0.5;
    const firstInner = S.project.timing.cutTimes && S.project.timing.cutTimes[`${line}:1`];
    if (firstInner != null && Number.isFinite(+firstInner)) max = Math.min(max, +firstInner - 0.22);
    target = { line, part: 0, nextLineStart: lines[line + 1] && lines[line + 1].start };
  } else {
    const previous = S.plan.cuts.find(c => c.line === chosen.line && c.part === chosen.part - 1);
    min = previous ? previous.start + 0.22 : S.plan.lines[chosen.line].start + 0.22;
    max = chosen.end - 0.22;
    target = { line: chosen.line, part: chosen.part };
  }
  return max > min ? { layer, ref: boundaryRef(layer, chosen), start: chosen.start, min, max, ...target } : null;
}
function setTimelineBoundaryTime(drag, t) {
  if (drag.layer === 'lyrics') {
    const timing = S.project.timing;
    if (drag.blankId) {
      const blank = S.project.lyricBlankCuts.find(b => b.id === drag.blankId);
      if (blank) blank.start = t;
    } else if (drag.part === 0) {
      timing.lineTimes[drag.line] = t;
      if (drag.nextLineStart != null && timing.lineTimes[drag.line + 1] == null) timing.lineTimes[drag.line + 1] = +drag.nextLineStart.toFixed(3);
    } else {
      if (!timing.cutTimes) timing.cutTimes = {};
      timing.cutTimes[`${drag.line}:${drag.part}`] = t;
    }
  } else S.project[drag.layer].timing.lineTimes[drag.index] = t;
}
function boundaryGroupLimits(ref) {
  const members = linkedRefs(ref).map(id => {
    const cut = boundaryCut(id);
    return cut && timelineBoundaryForCut(cut, boundaryLayer(id));
  });
  if (members.some(x => !x)) return null;
  return { members, min: Math.max(...members.map(x => x.min)), max: Math.min(...members.map(x => x.max)) };
}
function commitTimelineBoundary(drag) {
  const t = +drag.preview.toFixed(3);
  const group = boundaryGroupLimits(drag.ref);
  if (!group || group.max < group.min) return;
  for (const member of group.members) setTimelineBoundaryTime(member, t);
  replan();
}
function connectTimelineBoundaries(source, target) {
  const from = linkedRefs(source), to = linkedRefs(target);
  if (from.includes(target)) return;
  const layers = from.map(boundaryLayer);
  if (to.some(ref => layers.includes(boundaryLayer(ref)))) { toast('같은 레이어의 경계는 동시에 링크할 수 없습니다'); return; }
  const limits = [source, target].map(boundaryGroupLimits);
  if (limits.some(x => !x)) return;
  const min = Math.max(...limits.map(x => x.min)), max = Math.min(...limits.map(x => x.max));
  const targetTime = boundaryCut(target).start;
  if (targetTime < min - 0.001 || targetTime > max + 0.001) { toast('이 시작 위치에는 링크할 수 없습니다'); return; }
  for (const ref of [...from, ...to]) setTimelineBoundaryTime(timelineBoundaryForCut(boundaryCut(ref), boundaryLayer(ref)), targetTime);
  S.project.timelineLinks.push({ a: source, b: target });
  replan();
}

/* ---------------- cut info ---------------- */
const CHIP_GROUPS = [
  ['layout', 'l', 'レイアウト'], ['enter', 'e', '登場'], ['hold', 'h', '保持'], ['exit', 'x', '退場'],
  ['decor', '', '装飾'], ['treat', 't', '加工'], ['bg', 'b', '背景'], ['cam', 'c', 'カメラ'], ['trans', 'c', 'つなぎ'],
];
const cutPick = { g: null, line: -1, k: -1 };
let lastCutIdx = -2;

function lyricCutK(cut) {
  if (!cut || cut.line < 0) return -1;
  let k = 0;
  for (const c of S.plan.cuts) {
    if (c.line !== cut.line) continue;
    if (!J.LAYOUTS[c.layout] || J.LAYOUTS[c.layout].special) continue;
    if (c.index === cut.index) return k;
    k++;
  }
  return -1;
}
function cutQuietSlot(line, k) {
  const o = (S.project.overrides || {})[line] || {};
  return (o.cutQuiet && (o.cutQuiet[k] || o.cutQuiet[String(k)])) || {};
}
function markCutQuiet(i, k, groups, on) {
  if (i == null || i < 0 || k == null || k < 0) return;
  const cur = Object.assign({}, S.project.overrides[i] || {});
  const cutQuiet = Object.assign({}, cur.cutQuiet || {});
  const q = Object.assign({}, cutQuiet[k] || cutQuiet[String(k)] || {});
  delete cutQuiet[String(k)];
  groups.forEach(g => { if (on) q[g] = true; else delete q[g]; });
  if (Object.keys(q).length) cutQuiet[k] = q; else delete cutQuiet[k];
  if (Object.keys(cutQuiet).length) cur.cutQuiet = cutQuiet; else delete cur.cutQuiet;
  if (Object.keys(cur).length) S.project.overrides[i] = cur; else delete S.project.overrides[i];
}
function cutTechSlot(line, k) {
  const o = (S.project.overrides || {})[line] || {};
  const t = (o.cutTech && (o.cutTech[k] || o.cutTech[String(k)])) || {};
  const lay = o.cutLayouts && (o.cutLayouts[k] || o.cutLayouts[String(k)]);
  return lay && t.layout == null ? Object.assign({ layout: lay }, t) : t;
}
function cutGroupVal(cut, g) {
  if (g === 'layout') return cut.layout || '';
  if (g === 'enter') return cut.enter || '';
  if (g === 'hold') return cut.hold || '';
  if (g === 'exit') return cut.exit || '';
  if (g === 'treat') return cut.treat || 'none';
  if (g === 'bg') return cut.bg || 'none';
  if (g === 'cam') return cut.cam || 'push';
  if (g === 'trans') return cut.trans || '';
  if (g === 'decor') return (cut.decor && cut.decor[0] && cut.decor[0].id) || '';
  return '';
}
function groupName(g, k) {
  if (!k) return 'なし';
  const tbl = J.registry(g);
  return (tbl && tbl[k] && tbl[k].name) || k;
}
function pickEnabledTech(g, opts) {
  opts = opts || {};
  const tbl = J.registry(g) || {};
  const en = (S.project.enabled || {})[g] || {};
  let keys = J.order(g).filter(key => {
    const def = tbl[key];
    if (!def || def.special) return false;
    if (en[key] === false) return false;
    return !J.randomOk || J.randomOk(S.project, g, key);
  });
  if (!keys.length) keys = J.order(g).filter(key => tbl[key] && !tbl[key].special && en[key] !== false);
  if (g === 'layout' && opts.n != null) {
    const fit = keys.filter(key => !J.LAYOUTS[key].fits || J.LAYOUTS[key].fits(opts.n));
    if (fit.length) keys = fit;
  }
  if (opts.allowNone && !keys.includes('none')) keys = ['none'].concat(keys);
  if (opts.avoid && keys.length > 1) keys = keys.filter(key => key !== opts.avoid);
  if (!keys.length) return '';
  return keys[(Math.random() * keys.length) | 0];
}
function rerollCurrentCut(kind) {
  if (S.exporting || S.tap) return;
  const cut = J.cutAt(S.plan, S.t);
  const k = lyricCutK(cut);
  if (!cut || k < 0) { toast('この位置のカットは抽選できません'); return; }
  remember();
  const n = [...String(cut.text || '').replace(/\s+/g, '')].length;
  const groups = kind === 'omakase'
    ? CHIP_GROUPS.map(x => x[0])
    : ['layout', 'enter', 'hold', 'exit', 'cam', 'trans'];
  const t0 = S.t;
  groups.forEach(g => {
    const allowNone = g === 'decor' || g === 'trans';
    const key = pickEnabledTech(g, { avoid: kind === 'omakase' ? cutGroupVal(cut, g) : null, allowNone, n });
    if (key) setCutTech(cut.line, k, g, key);
  });
  markCutQuiet(cut.line, k, groups, true);
  closeCutPick();
  replan();
  commit();
  seek(t0);
  toast(kind === 'omakase' ? 'このカットをおまかせ' : 'このカットをシャッフル');
}
function updateCutInfo() {
  const cut = J.cutAt(S.plan, S.t);
  const mc = J.mediaAt(S.plan, S.t);
  const fc = J.mediaAt(S.plan, S.t, 'foreground');
  const idx = `${cut ? cut.index : -1}/${mc ? mc.index : -1}/${fc ? fc.index : -1}`;
  const li = cut ? cut.line : -1;
  if (li !== S.curLine) { S.lineEls.forEach((el, i) => el.classList.toggle('cur', i === li)); S.curLine = li; followLine(li); }
  S.blankEls.forEach((el, id) => el.classList.toggle('cur', !!cut && cut.blankId === id));
  const active = S.sourceTab === 'foreground' ? fc : mc;
  S.mediaLineEls.forEach((el, i) => el.classList.toggle('cur', !!active && i === active.index));
  if (idx === lastCutIdx) return;
  lastCutIdx = idx;
  const el = $('cutInfo');
  if (!cut && !mc && !fc) { el.innerHTML = '<span class="hint">이 위치에는 컷이 없습니다</span>'; if (cutPick.g) closeCutPick(); return; }
  const chip = (cls, k, v) => `<span class="chip ${cls}"><b>${k}</b>${v}</span>`;
  const n = (tbl, k) => (tbl[k] ? tbl[k].name : k);
  const mediaChips = [].concat(...[mc, fc].map((mediaCut, i) => mediaCut ? [chip('b', i ? '전경' : '배경', escapeHtml(mediaCut.name)), chip('l', '표시', J.MEDIA_LAYOUT[mediaCut.layout]), chip('e', '등장', J.MEDIA_ENTER[mediaCut.enter]), chip('h', '유지', J.MEDIA_HOLD[mediaCut.hold]), chip('x', '퇴장', J.MEDIA_EXIT[mediaCut.exit]), chip('t', '가공', J.MEDIA_TREAT[mediaCut.treat]), mediaCut.trans ? chip('c', '전환', J.mediaTransOptions()[mediaCut.trans]) : '', mediaCut.placement && mediaCut.placement.angle ? chip('c', '각도', `${mediaCut.placement.angle}°`) : '', mediaCut.chromaKey ? chip('c', '크로마키', mediaCut.chromaColor) : ''] : [])).join('');
  if (S.mode !== 'pro' || !cut || cut.blank) {          // 간단/스마트폰, 또는 가사 컷이 아닌 곳: 정적 칩 표시
    if (cutPick.g) closeCutPick();
    el.innerHTML = (cut && cut.blank ? [chip('l', '가사', '무표시')] : cut ? [
      `<span class="chip mono">#${String(cut.index + 1).padStart(2, '0')}</span>`,
      chip('l', '레이아웃', n(J.LAYOUTS, cut.layout)), chip('e', '등장', n(J.ENTER, cut.enter)), chip('h', '유지', n(J.HOLD, cut.hold)), chip('x', '퇴장', n(J.EXIT, cut.exit)),
      cut.decor && cut.decor.length ? chip('', '장식', cut.decor.map(d => n(J.DECOR, d.id)).join('·')) : '',
      cut.treat && cut.treat !== 'none' ? chip('t', '가공', n(J.TREAT, cut.treat)) : '',
      cut.bg && cut.bg !== 'none' ? chip('b', '배경', n(J.BG, cut.bg)) : '',
      cut.cam && cut.cam !== 'push' ? chip('c', '카메라', n(J.CAMERA, cut.cam)) : '',
      cut.trans ? chip('c', '전환', n(J.TRANS, cut.trans)) : '',
      ] : []).join('') + mediaChips;
    return;
  }
  const k = lyricCutK(cut);
  const slot = k >= 0 ? cutTechSlot(cut.line, k) : {};
  const quiet = k >= 0 ? cutQuietSlot(cut.line, k) : {};
  const bits = [`<span class="chip mono">#${String(cut.index + 1).padStart(2, '0')}</span>`];
  CHIP_GROUPS.forEach(([g, cls, label]) => {
    const forced = slot[g] != null && slot[g] !== '' && !quiet[g];
    bits.push(`<button type="button" class="chip ${cls}${forced ? ' is-forced' : ''}" data-g="${g}" aria-pressed="${cutPick.g === g ? 'true' : 'false'}" ${k < 0 ? 'disabled' : ''}><b>${label}</b>${escapeHtml(groupName(g, cutGroupVal(cut, g)))}</button>`);
  });
  bits.push(`<button type="button" class="ghost small cut-roll" data-roll="shuffle" ${k < 0 ? 'disabled' : ''} title="このカットだけ構成を再抽選">シャッフル</button>`);
  bits.push(`<button type="button" class="ghost small cut-roll accent" data-roll="omakase" ${k < 0 ? 'disabled' : ''} title="このカットだけ手法をランダムに">おまかせ</button>`);
  el.innerHTML = bits.join('') + mediaChips;
  if (k >= 0) {
    el.querySelectorAll('button.chip[data-g]').forEach(b => b.addEventListener('click', () => toggleCutPick(b.dataset.g, cut, k)));
    el.querySelectorAll('button.cut-roll').forEach(b => b.addEventListener('click', () => rerollCurrentCut(b.dataset.roll)));
  }
  followCutPick(cut, k);
}
function followCutPick(cut, k) {
  if (S.mode !== 'pro' || !cutPick.g) return;
  const p = $('cutPick');
  if (!cut || k < 0) {
    cutPick.g = null; cutPick.line = -1; cutPick.k = -1;
    if (p) p.hidden = true;
    return;
  }
  cutPick.line = cut.line;
  cutPick.k = k;
  if (p) p.hidden = false;
  fillCutPick();
}
function closeCutPick() {
  cutPick.g = null; cutPick.line = -1; cutPick.k = -1;
  const p = $('cutPick'); if (p) p.hidden = true;
  lastCutIdx = -2;
}
function toggleCutPick(g, cut, k) {
  if (S.mode !== 'pro') return;
  if (cutPick.g === g && cutPick.line === cut.line && cutPick.k === k) { closeCutPick(); updateCutInfo(); return; }
  cutPick.g = g; cutPick.line = cut.line; cutPick.k = k;
  $('cutPick').hidden = false;
  fillCutPick();
  lastCutIdx = -2; updateCutInfo();
}
function fillCutPick() {
  const g = cutPick.g, grid = $('cutPickGrid');
  if (!g || !grid) return;
  const meta = CHIP_GROUPS.find(x => x[0] === g);
  const cut = J.cutAt(S.plan, S.t);
  $('cutPickTitle').textContent = (meta ? meta[2] : g) + (cut ? ' · #' + String(cut.index + 1).padStart(2, '0') : '');
  const cur = cut ? cutGroupVal(cut, g) : '';
  const forced = cutTechSlot(cutPick.line, cutPick.k)[g];
  const onKey = forced || cur;
  grid.innerHTML = '';
  if (g === 'decor' || g === 'trans') {
    const none = document.createElement('button');
    none.type = 'button';
    none.className = 'tcard' + (forced === 'none' ? ' is-on' : '');
    none.innerHTML = '<span class="tcard-name" style="padding:16px 6px"><span>なし</span></span>';
    none.addEventListener('click', () => { setCutTech(cutPick.line, cutPick.k, g, 'none'); replan(); });
    grid.appendChild(none);
  }
  const [W, H] = J.designSize(S.project.aspect || '16:9');
  const th = 80, tw = Math.max(72, Math.round(th * W / H));
  const items = J.order(g).filter(key => J.registry(g)[key] && !J.registry(g)[key].special);
  items.forEach(key => {
    const def = J.registry(g)[key];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tcard' + (key === onKey ? ' is-on' : '');
    b.title = key;
    b.innerHTML = `<canvas width="${tw}" height="${th}" data-g="${g}" data-k="${key}"></canvas><span class="tcard-name"><span>${escapeHtml(def.name)}</span>${setBadges(def)}</span>`;
    b.addEventListener('click', () => {
      setCutTech(cutPick.line, cutPick.k, g, key);
      replan();
    });
    grid.appendChild(b);
  });
  queueThumbs(grid);
}

/* ---------------- line list ---------------- */
/* 읽기 속도: characters per second a line asks the viewer to read while it is on screen (by lyric language) */
const READ_CPS = { ko: 9, ja: 8, 'zh-Hant': 7, 'zh-Hans': 7, en: 18 };
function readRate(ln) {
  if (ln.interlude || !ln.text) return 0;
  return [...ln.text.replace(/\s+/g, '')].length / Math.max(0.05, (ln.visEnd ?? ln.end) - ln.start);
}
function insertLyricBlankCut(rows, position) {
  if (S.project.lyricBlankCuts.length >= 1000) { toast('컷 수 상한에 도달했습니다'); return; }
  const previous = rows[position - 1], next = rows[position];
  let start = previous ? (next ? (previous.start + next.start) / 2 : (previous.start + S.plan.duration) / 2) : 0;
  if (next && next.start - start < 0.04) {
    if (next.blankId) {
      const blank = S.project.lyricBlankCuts.find(b => b.id === next.blankId);
      if (blank) blank.start = +Math.max(0.4, next.start + 0.4).toFixed(3);
    } else S.project.timing.lineTimes[next.line] = +Math.max(0.4, next.start + 0.4).toFixed(3);
  }
  if (!next && S.plan.duration - start < 0.04) start = Math.max(0, S.plan.duration - 0.4);
  S.project.lyricBlankCuts.push({ id: crypto.randomUUID(), beforeLine: next ? next.line ?? next.beforeLine : S.plan.lines.length, start: +start.toFixed(3) });
  replan(); seek(start + 0.001);
}
function reconcileLyricLines(previous, next) {
  const oldLines = J.parseLyrics(previous).lines, newLines = J.parseLyrics(next).lines;
  if (oldLines.length === newLines.length) return false;
  const same = (a, b) => a.text === b.text && a.lrc === b.lrc;
  let prefix = 0, suffix = 0;
  while (prefix < Math.min(oldLines.length, newLines.length) && same(oldLines[prefix], newLines[prefix])) prefix++;
  while (suffix < Math.min(oldLines.length, newLines.length) - prefix && same(oldLines[oldLines.length - 1 - suffix], newLines[newLines.length - 1 - suffix])) suffix++;
  const oldMiddle = oldLines.length - prefix - suffix, newMiddle = newLines.length - prefix - suffix;
  const oldToNew = new Map();
  for (let i = 0; i < prefix; i++) oldToNew.set(i, i);
  for (let i = 0; i < suffix; i++) oldToNew.set(oldLines.length - suffix + i, newLines.length - suffix + i);
  if (oldMiddle * newMiddle <= 250000) {
    const dp = Array.from({ length: oldMiddle + 1 }, () => new Uint16Array(newMiddle + 1));
    for (let i = oldMiddle - 1; i >= 0; i--) for (let j = newMiddle - 1; j >= 0; j--) {
      dp[i][j] = same(oldLines[prefix + i], newLines[prefix + j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
    for (let i = 0, j = 0; i < oldMiddle && j < newMiddle;) {
      if (same(oldLines[prefix + i], newLines[prefix + j])) { oldToNew.set(prefix + i, prefix + j); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else j++;
    }
  }
  const anchors = [[-1, -1], ...[...oldToNew].sort((a, b) => a[0] - b[0]), [oldLines.length, newLines.length]];
  for (let a = 1; a < anchors.length; a++) {
    const [oldBefore, newBefore] = anchors[a - 1], [oldAfter, newAfter] = anchors[a];
    for (let k = 1; k <= Math.min(oldAfter - oldBefore - 1, newAfter - newBefore - 1); k++) oldToNew.set(oldBefore + k, newBefore + k);
  }
  const oldStarts = J.computeTiming(S.project, { lines: oldLines }, audioLike()).starts;
  const oldTimes = S.project.timing.lineTimes || {};
  const newTimes = {};
  for (const [key, value] of Object.entries(oldTimes)) {
    const mapped = oldToNew.get(+key);
    if (mapped != null) newTimes[mapped] = value;
  }
  // Preserve following lines, and preserve every LRC time if a new plain line disables all-LRC timing.
  const preserveAll = oldLines.length > 0 && oldLines.every(line => line.lrc != null) && newLines.some(line => line.lrc == null);
  for (let i = preserveAll ? 0 : oldLines.length - suffix; i < oldLines.length; i++) {
    const mapped = oldToNew.get(i);
    if (mapped != null && newTimes[mapped] == null) newTimes[mapped] = +oldStarts[i].toFixed(3);
  }
  const newToOld = new Map([...oldToNew].map(([oldIndex, newIndex]) => [newIndex, oldIndex]));
  for (let i = 0; i < newLines.length;) {
    if (newToOld.has(i)) { i++; continue; }
    let end = i; while (end < newLines.length && !newToOld.has(end)) end++;
    if (end < newLines.length) {
      const before = newToOld.get(i - 1), after = newToOld.get(end);
      const left = before == null ? 0 : oldStarts[before], right = oldStarts[after];
      for (let j = i; j < end; j++) newTimes[j] = +(left + (right - left) * (j - i + 1) / (end - i + 1)).toFixed(3);
    }
    i = end;
  }
  S.project.timing.lineTimes = newTimes;
  const remap = source => {
    const result = {};
    for (const [key, value] of Object.entries(source || {})) {
      const mapped = oldToNew.get(+key);
      if (mapped != null) result[mapped] = value;
    }
    return result;
  };
  S.project.overrides = remap(S.project.overrides);
  const newCutTimes = {};
  for (const [key, value] of Object.entries(S.project.timing.cutTimes || {})) {
    const match = key.match(/^(\d+):(.*)$/), mapped = match && oldToNew.get(+match[1]);
    if (mapped != null) newCutTimes[`${mapped}:${match[2]}`] = value;
  }
  S.project.timing.cutTimes = newCutTimes;
  const newCutOptions = {};
  for (const [key, value] of Object.entries(S.project.lyricCutOptions || {})) {
    const match = key.match(/^(\d+):(.*)$/), mapped = match && oldToNew.get(+match[1]);
    if (mapped != null) newCutOptions[`${mapped}:${match[2]}`] = value;
  }
  S.project.lyricCutOptions = newCutOptions;
  const newStarts = J.computeTiming(S.project, { lines: newLines }, audioLike()).starts;
  for (const blank of S.project.lyricBlankCuts) {
    const following = newStarts.findIndex(start => start > +blank.start + 1e-6);
    blank.beforeLine = following < 0 ? newLines.length : following;
  }
  const mapRef = ref => {
    const match = /^l:(\d+):(.*)$/.exec(ref);
    if (!match) return ref;
    const mapped = oldToNew.get(+match[1]);
    return mapped == null ? null : `l:${mapped}:${match[2]}`;
  };
  S.project.timelineLinks = S.project.timelineLinks.flatMap(link => {
    const a = mapRef(link.a), b = mapRef(link.b);
    return a && b ? [{ a, b }] : [];
  });
  return true;
}
function renderLines() {
  const ol = $('lineList'); ol.innerHTML = ''; S.lineEls = []; S.blankEls = new Map(); S.curLine = -2;
  const ov = S.project.overrides, R = exportRangeLines();
  const layoutOpts = '<option value="">자동</option>' + J.LAYOUT_ORDER.map(k => `<option value="${k}">${J.LAYOUTS[k].name}</option>`).join('');
  const cutOpts = '<option value="">컷: 자동</option>' + [1, 2, 3, 4, 5, 6].map(n => `<option value="${n}">컷: ${n}</option>`).join('');
  const rows = [...S.plan.lines.map(ln => ({ line: ln.index, start: ln.start })), ...S.plan.cuts.filter(c => c.blank).map(c => ({ blankId: c.blankId, beforeLine: c.beforeLine, start: c.start }))].sort((a, b) => a.start - b.start);
  const addButton = position => {
    const row = document.createElement('li'); row.className = 'media-cut-insert';
    row.innerHTML = `<button class="ghost small" type="button" aria-label="${position + 1}번째에 무표시 컷 추가">＋ 무표시 컷 추가</button>`;
    row.querySelector('button').addEventListener('click', () => insertLyricBlankCut(rows, position));
    ol.appendChild(row);
  };
  rows.forEach((row, position) => {
    addButton(position);
    if (row.blankId) {
      const li = document.createElement('li'); li.className = 'ln lyric-ln lyric-blank-ln';
      li.innerHTML = `<span class="no">—</span><input class="time mono" type="number" step="0.01" min="0" value="${row.start.toFixed(2)}" aria-label="무표시 컷 시작 초"><span class="txt">무표시</span><div class="meta"><span class="cuts"></span><span class="tools"><button class="ghost small remove-blank" type="button" aria-label="무표시 컷 삭제">삭제</button></span></div>`;
      li.querySelector('.time').addEventListener('change', e => { const blank = S.project.lyricBlankCuts.find(b => b.id === row.blankId); if (blank) blank.start = Math.max(0, parseFloat(e.target.value) || 0); replan(); });
      li.querySelector('.txt').addEventListener('click', () => seek(row.start + 0.001));
      li.querySelector('.remove-blank').addEventListener('click', () => { S.project.lyricBlankCuts = S.project.lyricBlankCuts.filter(b => b.id !== row.blankId); replan(); });
      ol.appendChild(li); S.blankEls.set(row.blankId, li);
      return;
    }
    const i = row.line, ln = S.plan.lines[i];
    const o = ov[i] || {};
    const rate = readRate(ln), lim = READ_CPS[S.plan.lang] || 8, fast = rate > lim;
    const li = document.createElement('li'); li.className = 'ln lyric-ln' + (ln.interlude ? ' is-inter' : '') + (R && i >= R.from && i <= R.to ? ' in-range' : '') + (fast ? ' fast' : '');
    const manual = S.project.timing.lineTimes && S.project.timing.lineTimes[i] != null;
    const label = ln.interlude ? `[간주${ln.secs ? ' ' + ln.secs + '초' : ''}]` : ln.text;
    const area = J.lyricArea(o.area) || { x: 0, y: 0, w: 1, h: 1 };
    li.innerHTML = `<span class="no">${String(i + 1).padStart(2, '0')}${fast ? `<i class="warn" title="빠름: 초당 ${rate.toFixed(1)}자(기준 ${lim}자). 다 읽기 전에 지나갈 수 있습니다. 시간을 늘리거나 행을 나눠 보세요">!</i>` : ''}</span>
      <input class="time mono" type="number" step="0.01" min="0" value="${ln.start.toFixed(2)}" title="시작(초)${manual ? ' · 수동' : ' · 자동'}" aria-label="${i + 1}행 시작(초)" style="${manual ? 'border-color:var(--cyan)' : ''}">
      <span class="txt" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
      <button class="lyric-area-thumb" title="${i + 1}행 가사 표시 영역 편집" aria-label="${i + 1}행 가사 표시 영역 편집"><i style="left:${area.x * 100}%;top:${area.y * 100}%;width:${area.w * 100}%;height:${area.h * 100}%;transform:rotate(${area.angle || 0}deg)"></i></button>
      <div class="meta"><span class="cuts"></span>
      <span class="tools">
        <button class="icon ghost edit" title="이 행의 가사 고치기" aria-label="${i + 1}행 가사 고치기">${ICON.pen}</button>
        ${ln.interlude ? '' : `<select class="ncut" aria-label="${i + 1}행 컷 수">${cutOpts}</select>`}
        ${ln.interlude ? '' : `<select class="lay pro-only" aria-label="레이아웃 선택">${layoutOpts}</select>`}
        <button class="icon ghost tapfrom" title="이 행부터 탭으로 동기화 다시 하기(Shift+클릭: 이 행만)" aria-label="${i + 1}행부터 탭">${ICON.tap}</button>
        <button class="icon ghost rng" title="내보낼 범위로 지정(Shift+클릭으로 범위 확장)" aria-pressed="${R && i >= R.from && i <= R.to ? 'true' : 'false'}" aria-label="${i + 1}행을 내보낼 범위로">${ICON.range}</button>
        ${ln.interlude ? '' : `<button class="icon ghost dice" title="이 행 다시 뽑기">${ICON.dice}</button>`}
        ${ln.interlude ? '' : `<button class="icon ghost cand" title="이 행의 후보 6개 중에서 고르기" aria-label="${i + 1}행 후보 고르기">${ICON.cand}</button>`}
        ${ln.interlude ? '' : `<button class="icon ghost uta" title="우타하메: 노래에 맞춰 한 글자씩 표시(단어 시각이 있으면 그 시각에 맞춤)" aria-pressed="${o.utahame ? 'true' : 'false'}" aria-label="${i + 1}행 우타하메">♪</button>`}
        ${ln.interlude ? '' : `<button class="icon ghost lock" title="이 행의 구성 잠금" aria-pressed="${o.lock ? 'true' : 'false'}">${ICON.lock}</button>`}
      </span></div>`;
    const q = sel => li.querySelector(sel);
    if (q('.lay')) q('.lay').value = o.layout || '';
    if (q('.ncut')) q('.ncut').value = o.cuts ? String(o.cuts) : '';
    q('.time').addEventListener('change', e => {
      const v = parseFloat(e.target.value);
      if (!S.project.timing.lineTimes) S.project.timing.lineTimes = {};
      const base = lineShiftBase();
      if (isFinite(v)) S.project.timing.lineTimes[i] = Math.max(0, v); else delete S.project.timing.lineTimes[i];
      replan(); followLineStarts(base);
    });
    q('.txt').addEventListener('click', () => seek(ln.start + 0.001));
    q('.txt').addEventListener('dblclick', () => editLine(li, ln));
    q('.edit').addEventListener('click', () => editLine(li, ln));
    q('.lyric-area-thumb').addEventListener('click', () => openAreaEditor(i));
    if (q('.lay')) q('.lay').addEventListener('change', e => { setOv(i, { layout: e.target.value || undefined }); replan(); });
    if (q('.ncut')) q('.ncut').addEventListener('change', e => { remember(); setOv(i, { cuts: +e.target.value || undefined, single: undefined }); replan(); commit(); seek(ln.start + 0.001); });
    q('.tapfrom').addEventListener('click', e => startTap(i, e.shiftKey));
    q('.rng').addEventListener('click', e => setExportRange(i, e.shiftKey));
    if (q('.dice')) q('.dice').addEventListener('click', () => rerollLyricLine(i));
    if (q('.cand')) q('.cand').addEventListener('click', () => openCandidates(i));
    if (q('.uta')) q('.uta').addEventListener('click', () => { const cur = ov[i] || {}; remember(); setOv(i, { utahame: !cur.utahame }); replan(); commit(); seek(ln.start + 0.001); });
    if (q('.lock')) q('.lock').addEventListener('click', () => toggleLyricLineLock(i));
    const cutsEl = q('.cuts');
    S.plan.cuts.filter(c => c.line === i && J.LAYOUTS[c.layout] && !J.LAYOUTS[c.layout].special).forEach((c, k) => {
      const cutOption = document.createElement('span'); cutOption.className = 'lyric-cut-option';
      cutOption.style.borderColor = `hsla(${layoutHue(c.layout)},70%,58%,0.7)`;
      const name = document.createElement('button'); name.type = 'button'; name.className = 'lyric-cut-name';
      name.textContent = `${c.part + 1}: ${J.LAYOUTS[c.layout].name}`;
      name.title = `${c.text}｜${J.ENTER[c.enter].name} → ${J.EXIT[c.exit].name}`;
      name.addEventListener('click', () => seek(c.start + Math.min(c.dur * 0.5, c.inDur + 0.05)));
      // per-cut layout (detailed mode)
      const forced = o.cutLayouts && o.cutLayouts[k];
      const sel = document.createElement('select');
      sel.className = 'cut-lay pro-only' + (forced ? ' is-forced' : '');
      sel.innerHTML = layoutOpts;
      sel.value = forced || c.layout;
      sel.title = `${c.text}｜${J.ENTER[c.enter].name} → ${J.EXIT[c.exit].name}`;
      sel.setAttribute('aria-label', `${i + 1}행 ${k + 1}컷 레이아웃`);
      sel.addEventListener('pointerdown', () => seek(c.start + Math.min(c.dur * 0.5, c.inDur + 0.05)));
      sel.addEventListener('change', e => { setCutLayout(i, k, e.target.value); replan(); seek(c.start + Math.min(c.dur * 0.5, c.inDur + 0.05)); });
      const label = document.createElement('label'); label.className = 'lyric-frontmost';
      const input = document.createElement('input'); input.type = 'checkbox'; input.checked = !!c.frontmost;
      input.setAttribute('aria-label', `${i + 1}행 ${c.part + 1}컷을 맨 앞에 표시`);
      input.addEventListener('change', () => toggleLyricCutFrontmost(i, c.part));
      label.append(input, document.createTextNode('맨 앞에 표시'));
      cutOption.append(name, sel, label); cutsEl.appendChild(cutOption);
    });
    // スマホ: a row is one line of text; tapping it opens its tools (and jumps there)
    if (S.openLine === i) li.classList.add('open');
    li.addEventListener('click', e => {
      if (S.mode !== 'mobile' || e.target.closest('button, select, input, .cuts')) return;
      const was = li.classList.contains('open');
      S.lineEls.forEach(x => x.classList.remove('open'));
      if (!was) { li.classList.add('open'); S.openLine = i; } else S.openLine = -1;
    });
    ol.appendChild(li); S.lineEls.push(li);
  });
  addButton(rows.length);
  $('linesInfo').textContent = `${S.plan.lines.length}행 / ${S.plan.cuts.length}컷`;
  syncRangeUI();
  syncSourceTab();
}

/* ---------------- 行から歌詞を直す ---------------- */
// the lyrics text is the source: a plan line knows the row it came from (ln.src); LRC time tags on that row are kept
const LRC_PREFIX = /^\s*(?:\[\d+:\d+(?:[.:]\d+)?\])*/;
function editLine(li, ln) {
  if (ln.src == null || li.querySelector('.txt-edit')) return;
  const rows = S.project.lyrics.replace(/\r/g, '').split('\n'), row = rows[ln.src] || '';
  const pre = (row.match(LRC_PREFIX) || [''])[0], body = row.slice(pre.length).trim();
  const txt = li.querySelector('.txt'), inp = document.createElement('input');
  inp.type = 'text'; inp.className = 'txt-edit'; inp.value = body; inp.setAttribute('aria-label', `${ln.index + 1}행 가사`);
  inp.title = '문법(/ 구분, *강조*, 행 끝의 !, | 메모, [간주 8])도 그대로 쓸 수 있습니다. Enter로 확정, Esc로 취소';
  txt.replaceWith(inp); inp.focus(); inp.select();
  let done = false;
  const finish = ok => {
    if (done) return; done = true;
    const v = inp.value.trim();
    if (ok && v && v !== body) {
      rows[ln.src] = pre + v;
      S.project.lyrics = rows.join('\n'); $('lyrics').value = S.project.lyrics;
      replan(); flushSave(); toast(`${ln.index + 1}행 가사를 고쳤습니다`);
    } else renderLines();
  };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); finish(true); } else if (e.key === 'Escape') { e.preventDefault(); finish(false); } });
  inp.addEventListener('blur', () => finish(true));
}

// 歌詞を消す: lyrics + everything tied to line numbers (times, per-line settings, export range); undoable
function clearLyrics() {
  if (S.tap || S.exporting) return;
  const P = S.project;
  if (!P.lyrics.trim() && !Object.keys(P.timing.lineTimes || {}).length) { $('lyrics').focus(); return; }
  pause();
  P.lyrics = ''; P.timing.lineTimes = {}; P.timing.cutTimes = {}; P.overrides = {}; P.exportRange = null; $('lyrics').value = '';
  P.lyricCutOptions = {}; P.lyricBlankCuts = []; P.timelineLinks = [];
  replan(); flushSave(); seek(0);
  toast('가사를 지웠습니다(‘실행 취소’나 Ctrl+Z로 복구 가능)');
}
// 初期化: back to a blank project — song (also the copy kept in this browser), settings and both histories go
let audioNameDefault = '';
async function resetAll() {
  if (S.exporting) return;
  if (S.tap) stopTap();
  pause();
  // 배경·전경 files go too (reset also drops the undo history that could bring them back)
  for (const id of [...S.project.media.items, ...S.project.foreground.items].map(item => item.id).concat([...J.mediaAssets.keys()])) queueMediaDeletion(id);
  S.project = mergeProject(null); S.project.lyrics = '';
  S.audio = null; if ($('audioFile')) $('audioFile').value = '';
  if (J.forgetSong) await J.forgetSong();
  for (const id of [...J.ASSETS.keys()]) await J.assetForget(id);
  await cleanupDeletedMedia();
  try { localStorage.removeItem('jizura.mlConsent'); } catch (e) {}
  renderAssets();
  $('audioName').textContent = audioNameDefault;
  H.list = []; H.i = -1;
  setTimelineZoom(1);
  $('lyrics').value = ''; fontKey = '';
  syncUI(); replan(); commit(); flushSave(); initUndo(); seek(0);
  toast('초기화했습니다');
}

/* ---------------- 書き出す範囲（選んだ行だけ） ---------------- */
function exportRangeLines() {
  const r = S.project.exportRange, n = S.plan ? S.plan.lines.length : 0;
  if (!r || !n || !(r.from >= 0)) return null;
  const from = Math.min(n - 1, r.from | 0), to = Math.min(n - 1, Math.max(from, r.to | 0));
  return { from, to };
}
function exportRange() {
  const R = exportRangeLines(); if (!R) return null;
  const L = S.plan.lines, a = L[R.from], b = L[R.to], last = R.to === L.length - 1;
  const t0 = Math.max(0, a.start - 0.25);
  const t1 = last ? S.plan.duration : Math.min(L[R.to + 1].start, (b.interlude ? b.end : b.visEnd) + 0.35);
  return { t0, t1 };
}
function rangeSuffix() { const R = exportRangeLines(); if (!R) return ''; const f = n => String(n + 1).padStart(2, '0'); return '_L' + f(R.from) + (R.to > R.from ? '-' + f(R.to) : ''); }
function setExportRange(i, extend) {
  const R = exportRangeLines();
  if (extend && R) S.project.exportRange = { from: Math.min(R.from, i), to: Math.max(R.to, i) };
  else if (R && R.from === i && R.to === i) S.project.exportRange = null;          // click again: back to the whole song
  else S.project.exportRange = { from: i, to: i };
  flushSave(); renderLines();
  const R2 = exportRangeLines();
  toast(R2 ? `내보낼 범위: ${R2.from + 1}${R2.to > R2.from ? '~' + (R2.to + 1) : ''}행` : '내보낼 범위: 전체');
}
function syncRangeUI() {
  const R = exportRangeLines(), n = S.plan.lines.length;
  const opts = (sel, first) => `<option value="-1">${first}</option>` + S.plan.lines.map((ln, i) => `<option value="${i}">${String(i + 1).padStart(2, '0')} ${escapeHtml((ln.interlude ? '[간주]' : ln.text).slice(0, 14))}</option>`).join('');
  document.querySelectorAll('.rngFrom').forEach(el => { el.innerHTML = opts(el, '전체'); el.value = R ? String(R.from) : '-1'; });
  document.querySelectorAll('.rngTo').forEach(el => { el.innerHTML = opts(el, '—'); el.value = R ? String(R.to) : '-1'; el.disabled = !R; });
  const r = exportRange();
  document.querySelectorAll('.rngInfo').forEach(el => { el.textContent = r ? `${J.fmtTime(r.t0)} ~ ${J.fmtTime(r.t1)} (${(r.t1 - r.t0).toFixed(1)}초)` : `전체 (${S.plan.duration.toFixed(1)}초)`; });
}
function bindRangeUI() {
  document.querySelectorAll('.rngFrom').forEach(el => el.addEventListener('change', () => {
    const v = +el.value, R = exportRangeLines();
    S.project.exportRange = v < 0 ? null : { from: v, to: R ? Math.max(v, R.to) : v };
    flushSave(); renderLines();
  }));
  document.querySelectorAll('.rngTo').forEach(el => el.addEventListener('change', () => {
    const v = +el.value, R = exportRangeLines(); if (!R) return;
    S.project.exportRange = v < 0 ? { from: R.from, to: R.from } : { from: Math.min(R.from, v), to: Math.max(R.from, v) };
    flushSave(); renderLines();
  }));
}
function positionAreaEditor() {
  if (!S.areaEdit) return;
  const view = $('view').getBoundingClientRect(), viewport = $('viewport').getBoundingClientRect(), overlay = $('areaEditOverlay');
  Object.assign(overlay.style, { left: `${view.left - viewport.left}px`, top: `${view.top - viewport.top}px`, width: `${view.width}px`, height: `${view.height}px` });
}
function showAreaDraft() {
  const edit = S.areaEdit, area = edit && edit.draft, rect = $('areaEditRect'), media = !!edit && edit.kind !== 'lyric';
  rect.hidden = !area;
  if (area) Object.assign(rect.style, { left: `${area.x * 100}%`, top: `${area.y * 100}%`, width: `${area.w * 100}%`, height: `${area.h * 100}%`, transform: `rotate(${edit.angle}deg)` });
  $('areaEditOverlay').classList.toggle('media-edit', !!edit);
  $('areaEditOverlay').querySelector('.area-edit-hint').textContent = '안쪽을 드래그하여 이동·네 모서리로 크기 변경·테두리 주변을 드래그하여 회전';
  $('mediaAreaSizeControls').hidden = !edit;
  if (area) { $('mediaAreaAspectLock').checked = edit.lockAspect; $('mediaAreaWidth').value = String(Math.round(area.w * 1000) / 10); $('mediaAreaHeight').value = String(Math.round(area.h * 1000) / 10); }
  $('mediaAreaAngleField').hidden = !edit;
  if (edit) $('mediaAreaAngle').value = String(edit.angle);
  $('areaResetFull').hidden = !edit || media;
  $('areaApplyOne').textContent = media ? '이 컷에만 적용' : '이 행에만 적용';
  $('areaApplyOne').disabled = !area;
  $('areaApplyFollowing').disabled = !area;
  S.need = true;
}
function openAreaEditor(index) {
  if (S.exporting || S.tap) return;
  if (S.areaEdit) cancelAreaEditor();
  const line = S.plan.lines[index]; if (!line) return;
  pause();
  clearTimeout(warmTimer); ++warmJob;
  const saved = J.lyricArea((S.project.overrides[index] || {}).area);
  S.areaEdit = { kind: 'lyric', index, oldTime: S.t, draft: saved || { x: 0, y: 0, w: 1, h: 1 }, ratio: saved ? saved.h / saved.w : 1, lockAspect: saved ? saved.lockAspect : true, angle: saved ? saved.angle : 0, drag: null };
  const cut = S.plan.cuts.find(c => c.line === index);
  seek(cut ? cut.start + Math.min(cut.dur * 0.6, cut.inDur + 0.25) : line.start);
  $('areaEditTitle').textContent = `${index + 1}행 「${line.text}」의 표시 영역`;
  $('areaEditOverlay').hidden = false; $('areaEditControls').hidden = false;
  positionAreaEditor(); showAreaDraft();
}
function openMediaEditor(index, layer) {
  if (S.exporting || S.tap) return;
  if (S.areaEdit) cancelAreaEditor();
  const cut = S.plan[layer].cuts[index], asset = cut && J.mediaAssets.get(cut.itemId);
  if (!asset) return;
  const source = asset.element, sw = source.videoWidth || source.naturalWidth, sh = source.videoHeight || source.naturalHeight;
  const draft = J.mediaPlacementRect(cut.placement, sw, sh, S.plan.W, S.plan.H);
  if (!draft) return;
  pause();
  clearTimeout(warmTimer); ++warmJob;
  S.areaEdit = { kind: layer, index, oldTime: S.t, draft, ratio: S.plan.W / S.plan.H * sh / sw, lockAspect: !cut.placement || cut.placement.lockAspect !== false, type: cut.type, angle: cut.placement && cut.placement.angle || 0, drag: null };
  seek(cut.start + Math.min(0.5, Math.max(0.001, (cut.end - cut.start) / 2)));
  $('areaEditTitle').textContent = `${index + 1}컷 「${cut.name}」의 배치·크기`;
  $('areaEditOverlay').hidden = false; $('areaEditControls').hidden = false;
  positionAreaEditor(); showAreaDraft();
}
function cancelAreaEditor() {
  if (!S.areaEdit) return;
  const oldTime = S.areaEdit.oldTime;
  S.areaEdit = null; $('areaEditOverlay').hidden = true; $('areaEditControls').hidden = true;
  seek(oldTime);
}
function applyAreaEditor(following) {
  if (!S.areaEdit || !S.areaEdit.draft) return;
  const { kind, index, draft } = S.areaEdit;
  remember();
  if (kind !== 'lyric') {
    for (let i = index; i < (following ? S.plan[kind].cuts.length : index + 1); i++) {
      mediaOv(i, { placement: { cx: draft.x + draft.w / 2, cy: draft.y + draft.h / 2, w: draft.w, h: draft.h, lockAspect: S.areaEdit.lockAspect, angle: S.areaEdit.angle }, zoom: undefined, focus: undefined }, kind);
    }
  } else {
    const full = draft.x === 0 && draft.y === 0 && draft.w === 1 && draft.h === 1 && S.areaEdit.angle === 0;
    for (let i = index; i < (following ? S.plan.lines.length : index + 1); i++) setOv(i, { area: full ? undefined : J.lyricArea({ ...draft, angle: S.areaEdit.angle, lockAspect: S.areaEdit.lockAspect }) });
  }
  S.areaEdit = null; $('areaEditOverlay').hidden = true; $('areaEditControls').hidden = true;
  replan(); commit();
}
function areaPointer(ev) {
  const box = $('areaEditOverlay').getBoundingClientRect();
  return { x: J.clamp((ev.clientX - box.left) / box.width), y: J.clamp((ev.clientY - box.top) / box.height) };
}
function mediaPointer(ev) {
  const box = $('areaEditOverlay').getBoundingClientRect();
  return { x: (ev.clientX - box.left) / box.width, y: (ev.clientY - box.top) / box.height };
}
function mediaHit(ev) {
  const edit = S.areaEdit, area = edit.draft, box = $('areaEditOverlay').getBoundingClientRect();
  const cx = box.left + (area.x + area.w / 2) * box.width, cy = box.top + (area.y + area.h / 2) * box.height;
  const dx = ev.clientX - cx, dy = ev.clientY - cy, radians = edit.angle * Math.PI / 180;
  const x = Math.abs(dx * Math.cos(radians) + dy * Math.sin(radians));
  const y = Math.abs(-dx * Math.sin(radians) + dy * Math.cos(radians));
  const halfW = area.w * box.width / 2, halfH = area.h * box.height / 2;
  const band = Math.min(18, Math.min(halfW, halfH) * 0.35);
  if (x <= halfW + 18 && y <= halfH + 18 && (x >= halfW - band || y >= halfH - band)) return 'rotate';
  return x <= halfW && y <= halfH ? 'move' : null;
}
function mediaPointerAngle(ev, area) {
  const box = $('areaEditOverlay').getBoundingClientRect();
  const cx = box.left + (area.x + area.w / 2) * box.width, cy = box.top + (area.y + area.h / 2) * box.height;
  return Math.atan2(ev.clientY - cy, ev.clientX - cx);
}
function wrapMediaAngle(angle) { return ((angle + 180) % 360 + 360) % 360 - 180; }
function setMediaDraftSize(width, height) {
  const edit = S.areaEdit, draft = edit.draft, cx = draft.x + draft.w / 2, cy = draft.y + draft.h / 2;
  const min = edit.kind === 'lyric' ? 0.04 : 0.005, max = edit.kind === 'lyric' ? 1 : 4;
  let w = J.clamp(width, min, max), h = J.clamp(height, min, max);
  if (edit.lockAspect) { w = Math.min(w, max / edit.ratio); h = w * edit.ratio; }
  edit.draft = { x: J.clamp(cx, edit.kind === 'lyric' ? w / 2 : 0, edit.kind === 'lyric' ? 1 - w / 2 : 1) - w / 2, y: J.clamp(cy, edit.kind === 'lyric' ? h / 2 : 0, edit.kind === 'lyric' ? 1 - h / 2 : 1) - h / 2, w, h };
  showAreaDraft();
}
function moveMediaDraft(ev) {
  const edit = S.areaEdit, drag = edit.drag, point = mediaPointer(ev), dx = point.x - drag.start.x, dy = point.y - drag.start.y, a = drag.previous;
  const lyric = edit.kind === 'lyric', min = lyric ? 0.04 : 0.005, max = lyric ? 1 : 4;
  if (drag.handle === 'rotate') {
    const difference = mediaPointerAngle(ev, a) - drag.pointerAngle;
    edit.angle = Math.round(wrapMediaAngle(drag.previousAngle + Math.atan2(Math.sin(difference), Math.cos(difference)) * 180 / Math.PI) * 10) / 10;
  } else if (drag.handle === 'move') {
    edit.draft = { x: J.clamp(a.x + dx, lyric ? 0 : -a.w / 2, lyric ? 1 - a.w : 1 - a.w / 2), y: J.clamp(a.y + dy, lyric ? 0 : -a.h / 2, lyric ? 1 - a.h : 1 - a.h / 2), w: a.w, h: a.h };
  } else {
    const east = drag.handle.includes('e'), south = drag.handle.includes('s');
    const radians = edit.angle * Math.PI / 180, box = $('areaEditOverlay').getBoundingClientRect();
    const localX = (dx * box.width * Math.cos(radians) + dy * box.height * Math.sin(radians)) / box.width;
    const localY = (-dx * box.width * Math.sin(radians) + dy * box.height * Math.cos(radians)) / box.height;
    const deltaX = localX * (east ? 1 : -1), deltaY = localY * (south ? 1 : -1);
    const w = edit.lockAspect ? J.clamp(a.w + (Math.abs(deltaX) > Math.abs(deltaY / edit.ratio) ? deltaX : deltaY / edit.ratio), min, Math.min(max, max / edit.ratio)) : J.clamp(a.w + deltaX, min, max);
    const h = edit.lockAspect ? w * edit.ratio : J.clamp(a.h + deltaY, min, max);
    const x = east ? a.x : a.x + a.w - w, y = south ? a.y : a.y + a.h - h;
    edit.draft = { x: J.clamp(x + w / 2, lyric ? w / 2 : 0, lyric ? 1 - w / 2 : 1) - w / 2, y: J.clamp(y + h / 2, lyric ? h / 2 : 0, lyric ? 1 - h / 2 : 1) - h / 2, w, h };
  }
  showAreaDraft();
}
function syncSourceTab() {
  const layer = activeMediaLayer(), media = !!layer, m = media && S.project[layer];
  $('sourceLyrics').setAttribute('aria-selected', String(!media)); $('sourceMedia').setAttribute('aria-selected', String(layer === 'media'));
  $('sourceForeground').setAttribute('aria-selected', String(layer === 'foreground'));
  $('lyricsPane').hidden = media; $('mediaPane').hidden = !media;
  $('lineList').hidden = media; $('mediaLineList').hidden = !media;
  $('mediaPaneTitle').textContent = layer === 'foreground' ? '전경' : '배경';
  $('foregroundBlendFields').hidden = layer !== 'foreground';
  $('lyricBlend').value = S.project.media.blend;
  $('lyricOpacity').value = S.project.media.opacity;
  $('linesInfo').textContent = media ? `파일 ${m.items.length} / 컷 ${S.plan[layer].cuts.length}` : `${S.plan.lines.length}행 / ${S.plan.cuts.length}컷`;
  $('mediaRandom').disabled = !media || m.items.length < 2 || m.manualCuts;
  $('mediaRandom').title = media && m.manualCuts ? '수동으로 추가한 컷에서는 파일을 개별로 지정합니다' : '';
  $('mediaLoop').disabled = !media || (m.items.length === 0 && S.plan[layer].cuts.length === 0);
  $('mediaCutCountField').hidden = !media || !m.loop || (m.items.length === 0 && S.plan[layer].cuts.length === 0);
}
function activeMediaLayer() { return S.sourceTab === 'foreground' ? 'foreground' : S.sourceTab === 'media' ? 'media' : null; }
function mediaThumb(item, cls = '') {
  if (!item) return `<span class="missing media-ln-thumb" aria-hidden="true">—</span>`;
  const asset = J.mediaAssets.get(item.id);
  if (!asset) return `<span class="missing">파일 없음</span>`;
  return `<img class="${cls}" src="${asset.poster || asset.url}" alt="">`;
}
function renderMediaList() {
  const layer = activeMediaLayer() || 'media', m = S.project[layer];
  const box = $('mediaList'); box.innerHTML = '';
  m.items.forEach((item, i) => {
    const row = document.createElement('div'); row.className = 'media-item'; row.dataset.id = item.id;
    row.innerHTML = `${mediaThumb(item)}<span class="name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span><button class="ghost small" aria-label="${escapeHtml(item.name)} 삭제">×</button>`;
    row.querySelector('button').addEventListener('click', () => {
      freezeMediaCuts(layer);
      m.items.splice(i, 1);
      for (const cut of S.plan[layer].cuts) if (cut.itemId === item.id) mediaOv(cut.index, { itemId: null }, layer);
      delete m.overrides[item.id];
      // Keep the file until this session's undo history is no longer available.
      queueMediaDeletion(item.id);
      replan();
    });
    box.appendChild(row);
  });
  $('mediaRandom').checked = !!m.randomOrder;
  $('mediaLoop').checked = !!m.loop;
  $('mediaCutCount').min = '0';
  $('mediaCutCount').value = String(m.manualCuts ? m.cutCount : m.cutCount || m.items.length * 2 || 1);
  $('mediaBlend').value = m.blend;
  $('mediaOpacity').value = m.opacity;
}
function mediaOv(index, patch, layer = activeMediaLayer() || 'media') {
  const m = S.project[layer];
  const o = Object.assign({}, m.cutOverrides[index] || {}, patch);
  for (const k of Object.keys(o)) if (o[k] === undefined || o[k] === '') delete o[k];
  if (Object.keys(o).length) m.cutOverrides[index] = o; else delete m.cutOverrides[index];
}
function freezeMediaCuts(layer) {
  const m = S.project[layer], cuts = S.plan[layer].cuts;
  cuts.forEach((cut, i) => { m.cutOverrides[i] = Object.assign({}, m.cutOverrides[i] || {}, { itemId: cut.itemId }); });
  m.manualCuts = true;
  m.cutCount = cuts.length;
}
function insertMediaCut(index, layer = activeMediaLayer() || 'media') {
  const m = S.project[layer], cuts = S.plan[layer].cuts;
  if (cuts.length >= 1000) { toast('컷 수 상한에 도달했습니다'); return; }
  const starts = cuts.map(cut => cut.start);
  const overrides = {};
  cuts.forEach((cut, i) => {
    overrides[i >= index ? i + 1 : i] = Object.assign({}, m.cutOverrides[i] || {}, { itemId: cut.itemId });
  });
  overrides[index] = { itemId: null };
  let start;
  if (!cuts.length) start = 0;
  else if (index === 0) {
    start = 0;
    starts[0] = Math.max(starts[0], Math.min(cuts[0].end, starts[0] + Math.max(0.04, (cuts[0].end - starts[0]) / 2)));
  } else if (index === cuts.length) {
    start = Math.max(cuts[index - 1].start + 0.04, (cuts[index - 1].start + S.plan.duration) / 2);
  } else start = (cuts[index - 1].start + cuts[index].start) / 2;
  const times = {};
  starts.forEach((time, i) => { times[i >= index ? i + 1 : i] = +time.toFixed(3); });
  times[index] = +start.toFixed(3);
  m.manualCuts = true;
  m.cutCount = cuts.length + 1;
  m.cutOverrides = overrides;
  m.timing.lineTimes = times;
  const prefix = layer === 'foreground' ? 'f:' : 'm:';
  for (const link of S.project.timelineLinks) for (const end of ['a', 'b']) {
    if (link[end].startsWith(prefix) && +link[end].slice(2) >= index) link[end] = prefix + (+link[end].slice(2) + 1);
  }
  replan(); seek(start);
}
function removeMediaCut(index, layer = activeMediaLayer() || 'media') {
  const m = S.project[layer], cuts = S.plan[layer].cuts;
  if (!Number.isInteger(index) || index < 0 || index >= cuts.length) return;
  cancelAreaEditor();
  if (S.tap) stopTap();
  const overrides = {}, times = {};
  cuts.forEach((cut, oldIndex) => {
    if (oldIndex === index) return;
    const newIndex = oldIndex > index ? oldIndex - 1 : oldIndex;
    overrides[newIndex] = Object.assign({}, m.cutOverrides[oldIndex] || {}, { itemId: cut.itemId });
    times[newIndex] = +cut.start.toFixed(3);
  });
  m.manualCuts = true;
  m.cutCount = cuts.length - 1;
  m.cutOverrides = overrides;
  m.timing.lineTimes = times;
  const prefix = layer === 'foreground' ? 'f:' : 'm:';
  const remapRef = ref => {
    if (typeof ref !== 'string' || !ref.startsWith(prefix)) return ref;
    const oldIndex = +ref.slice(prefix.length);
    if (!Number.isInteger(oldIndex)) return ref;
    return oldIndex === index ? null : prefix + (oldIndex > index ? oldIndex - 1 : oldIndex);
  };
  S.project.timelineLinks = S.project.timelineLinks.flatMap(link => {
    const a = remapRef(link.a), b = remapRef(link.b);
    return a && b ? [{ a, b }] : [];
  });
  replan();
}
async function addMediaFiles(files, layer) {
  const m = S.project[layer];
  for (const file of files) {
    const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null;
    if (!type) continue;
    const existing = m.items.find(x => x.name === file.name && x.size === file.size && !J.mediaAssets.has(x.id));
    const item = existing || { id: crypto.randomUUID(), name: file.name, size: file.size, type };
    try {
      const el = await J.attachMedia(item, file);
      el.addEventListener('seeked', () => { S.need = true; });
      if (type === 'video') item.duration = el.duration || 0;
      if (!existing) m.items.push(item);
      await J.storeMedia(item.id, file);
    } catch (err) { toast(`${file.name}: 불러올 수 없습니다`); }
  }
  replan();
}
function renderMediaLines() {
  const layer = activeMediaLayer() || 'media', m = S.project[layer];
  const ol = $('mediaLineList'); ol.innerHTML = ''; S.mediaLineEls = [];
  const select = (key, obj, val) => `<select aria-label="${key}"><option value="">자동</option>${Object.entries(obj).map(([k, label]) => `<option value="${k}" ${val === k ? 'selected' : ''}>${label}</option>`).join('')}</select>`;
  const addButton = index => {
    const row = document.createElement('li'); row.className = 'media-cut-insert';
    row.innerHTML = `<button class="ghost small" type="button" aria-label="${index + 1}번째에 컷 추가">＋ 컷 추가</button>`;
    row.querySelector('button').addEventListener('click', () => insertMediaCut(index, layer));
    ol.appendChild(row);
  };
  S.plan[layer].cuts.forEach((cut, i) => {
    addButton(i);
    const item = m.items.find(x => x.id === cut.itemId), ov = Object.assign({}, m.overrides[cut.itemId] || {}, m.cutOverrides[i] || {});
    const fileSelect = `<select class="media-cut-file" aria-label="${i + 1}컷 파일"><option value="">이미지 없음</option>${m.items.map(asset => `<option value="${escapeHtml(asset.id)}" ${cut.itemId === asset.id ? 'selected' : ''}>${escapeHtml(asset.name)}</option>`).join('')}</select>`;
    if (ov.layout === 'stretch') ov.layout = 'cover';
    for (const key of ['layout', 'enter', 'hold', 'exit', 'treat']) if (ov[key] === undefined) ov[key] = cut[key];
    const asset = J.mediaAssets.get(cut.itemId), source = asset && asset.element;
    const sw = source && (source.videoWidth || source.naturalWidth), sh = source && (source.videoHeight || source.naturalHeight);
    const placement = J.mediaPlacementRect(cut.placement, sw, sh, S.plan.W, S.plan.H);
    const placementControl = `<span class="foreground-placement-controls"><button class="foreground-placement-open ghost" type="button" ${placement ? '' : 'disabled'} aria-label="${i + 1}컷 배치와 크기 편집"><span class="foreground-placement-thumb"><i style="left:${(placement ? placement.x : 0) * 100}%;top:${(placement ? placement.y : 0) * 100}%;width:${(placement ? placement.w : 1) * 100}%;height:${(placement ? placement.h : 1) * 100}%;transform:rotate(${cut.placement ? cut.placement.angle || 0 : 0}deg)"></i></span>배치·크기 편집</button>${cut.placement ? '<button class="foreground-placement-reset ghost" type="button">자동 배치로 되돌리기</button>' : ''}</span>`;
    const li = document.createElement('li'); li.className = 'ln media-ln';
    li.innerHTML = `<span class="no">${String(i + 1).padStart(2, '0')}</span><input class="time mono" type="number" step="0.01" min="0" value="${cut.start.toFixed(2)}" aria-label="${i + 1}컷 시작 초">${fileSelect}${mediaThumb(item, 'media-ln-thumb')}<div class="meta"><span class="cuts"><span>${J.MEDIA_LAYOUT[cut.layout]}</span><span>${J.MEDIA_ENTER[cut.enter]} → ${J.MEDIA_EXIT[cut.exit]}</span>${cut.trans ? `<span>${J.mediaTransOptions()[cut.trans]}</span>` : ''}</span><span class="tools">${select('표시 방법', J.MEDIA_LAYOUT, ov.layout)}${select('등장', J.MEDIA_ENTER, ov.enter)}${select('유지', J.MEDIA_HOLD, ov.hold)}${select('퇴장', J.MEDIA_EXIT, ov.exit)}${select('가공', J.MEDIA_TREAT, ov.treat)}${select('전환', J.mediaTransOptions(), ov.trans)}<button class="icon ghost dice" title="이 컷 다시 뽑기">${ICON.dice}</button><button class="icon ghost lock" title="이 컷 잠금" aria-pressed="${ov.lock ? 'true' : 'false'}">${ICON.lock}</button><button class="ghost small remove-media-cut" type="button" aria-label="${i + 1}컷 삭제">삭제</button></span>${placementControl}${cut.type === 'video' ? `<label class="media-video-loop"><input type="checkbox" ${cut.videoLoop ? 'checked' : ''}>동영상 반복 재생</label><label class="media-video-duration">동영상 길이(초)<input type="number" min="0.04" max="3600" step="0.01" placeholder="자동" value="${ov.videoDuration ?? ''}" aria-label="${i + 1}컷 동영상 길이(초)"></label>` : ''}</div>`;
    if (cut.type === 'video') li.querySelector('.meta').insertAdjacentHTML('beforeend', `<span class="media-chroma"><label><input class="media-chroma-toggle" type="checkbox" ${cut.chromaKey ? 'checked' : ''}>크로마키 합성</label><label>색<input class="media-chroma-color" type="color" value="${cut.chromaColor}" aria-label="${i + 1}컷 크로마키 색" ${cut.chromaKey ? '' : 'disabled'}></label></span>`);
    li.querySelector('.time').addEventListener('change', e => { m.timing.lineTimes[i] = Math.max(0, parseFloat(e.target.value) || 0); replan(); });
    li.querySelector('.media-cut-file').addEventListener('change', e => { mediaOv(i, { itemId: e.target.value || null }, layer); replan(); });
    ['layout', 'enter', 'hold', 'exit', 'treat', 'trans'].forEach((key, n) => li.querySelectorAll('.tools select')[n].addEventListener('change', e => { mediaOv(i, { [key]: e.target.value || null }, layer); replan(); }));
    if (i === 0) li.querySelector('select[aria-label="전환"]').disabled = true;
    const videoLoop = li.querySelector('.media-video-loop input');
    if (videoLoop) videoLoop.addEventListener('change', e => { mediaOv(i, { videoLoop: e.target.checked }); replan(); });
    const videoDuration = li.querySelector('.media-video-duration input');
    if (videoDuration) videoDuration.addEventListener('change', e => { const v = +e.target.value; mediaOv(i, { videoDuration: e.target.value && Number.isFinite(v) && v > 0 ? J.clamp(v, 0.04, 3600) : undefined }, layer); replan(); });
    const placementOpen = li.querySelector('.foreground-placement-open');
    if (placementOpen) placementOpen.addEventListener('click', () => openMediaEditor(i, layer));
    const placementReset = li.querySelector('.foreground-placement-reset');
    if (placementReset) placementReset.addEventListener('click', () => { mediaOv(i, { placement: undefined }); replan(); });
    const chroma = li.querySelector('.media-chroma-toggle');
    if (chroma) {
      chroma.addEventListener('change', e => { mediaOv(i, { chromaKey: e.target.checked }); replan(); });
      li.querySelector('.media-chroma-color').addEventListener('change', e => { mediaOv(i, { chromaColor: e.target.value }); replan(); });
    }
    li.querySelector('.dice').addEventListener('click', () => rerollMediaCut(layer, i));
    li.querySelector('.lock').addEventListener('click', () => toggleMediaCutLock(layer, i));
    li.querySelector('.remove-media-cut').addEventListener('click', () => removeMediaCut(i, layer));
    ol.appendChild(li); S.mediaLineEls.push(li);
  });
  addButton(S.plan[layer].cuts.length);
  syncSourceTab();
}
async function restoreMediaAssets() {
  for (const item of [...S.project.media.items, ...S.project.foreground.items]) {
    if (J.mediaAssets.has(item.id)) continue;
    try { const blob = await J.loadMedia(item.id); if (blob) { const el = await J.attachMedia(item, blob); el.addEventListener('seeked', () => { S.need = true; }); } } catch (e) {}
  }
  replan();
}
function setOv(i, patch) {
  const cur = Object.assign({}, S.project.overrides[i] || {}, patch);
  for (const k of Object.keys(cur)) if (cur[k] === undefined || cur[k] === false || cur[k] === '') delete cur[k];
  if (Object.keys(cur).length) S.project.overrides[i] = cur; else delete S.project.overrides[i];
}
function setCutLayout(i, k, layout) { setCutTech(i, k, 'layout', layout); }
function setCutTech(i, k, group, key) {
  if (i == null || i < 0 || k == null || k < 0) return;
  const cur = Object.assign({}, S.project.overrides[i] || {});
  const cutTech = Object.assign({}, cur.cutTech || {});
  const slot = Object.assign({}, cutTech[k] || cutTech[String(k)] || {});
  delete cutTech[String(k)];
  if (!key) delete slot[group];
  else slot[group] = key;
  if (Object.keys(slot).length) cutTech[k] = slot;
  else delete cutTech[k];
  if (Object.keys(cutTech).length) cur.cutTech = cutTech; else delete cur.cutTech;
  const cutQuiet = Object.assign({}, cur.cutQuiet || {});
  const q = Object.assign({}, cutQuiet[k] || cutQuiet[String(k)] || {});
  delete cutQuiet[String(k)];
  delete q[group];
  if (Object.keys(q).length) cutQuiet[k] = q; else delete cutQuiet[k];
  if (Object.keys(cutQuiet).length) cur.cutQuiet = cutQuiet; else delete cur.cutQuiet;
  if (group === 'layout') {
    const cutLayouts = Object.assign({}, cur.cutLayouts || {});
    if (!key) delete cutLayouts[k]; else cutLayouts[k] = key;
    if (Object.keys(cutLayouts).length) cur.cutLayouts = cutLayouts; else delete cur.cutLayouts;
  }
  if (Object.keys(cur).length) S.project.overrides[i] = cur; else delete S.project.overrides[i];
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ---------------- style tab ---------------- */
function drawStyleGrid() {
  const g = $('styleGrid');
  if (!g.children.length) {
    J.STYLE_ORDER.forEach(k => {
      const b = document.createElement('button'); b.className = 'stile'; b.dataset.k = k;
      b.title = J.STYLES[k].desc;
      b.innerHTML = `<canvas width="192" height="108"></canvas><span>${J.STYLES[k].name}</span><span class="badges">${setBadges(J.STYLES[k])}</span>`;
      b.addEventListener('click', () => { remember(); S.project.style = k; S.project.colors.enabled = false; syncUI(); replan(); commit(); });
      g.appendChild(b);
    });
  }
  [...g.children].forEach(b => {
    const k = b.dataset.k, st = J.STYLES[k], sc = st.schemes[0], cv = b.querySelector('canvas'), x = cv.getContext('2d');
    b.setAttribute('aria-pressed', S.project.style === k ? 'true' : 'false');
    const off = !J.randomOk(S.project, 'style', k);
    b.classList.toggle('set-off', off);
    b.title = st.desc + (off ? (st.extra && S.project.extra !== true ? '(추가 연출이 꺼져 있어 자동에서는 선택되지 않습니다)' : st.set && !J.setOn(S.project, st.set) ? '(이 세트가 꺼져 있어 자동에서는 선택되지 않습니다)' : '(일본풍 연출이 꺼져 있어 자동에서는 선택되지 않습니다)') : '');
    x.fillStyle = sc.bg; x.fillRect(0, 0, 192, 108);
    st.schemes.slice(1, 4).forEach((s2, i) => { x.fillStyle = s2.bg; x.fillRect(192 - 14 * (i + 1), 0, 14, 10); });
    const f = st.fonts.display[0];
    x.font = J.fontCSS(f, 46); x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = sc.ghostB; x.fillText('JIZURA', 96 - 3, 54 - 1);
    x.fillStyle = sc.ghostA; x.fillText('JIZURA', 96 + 3, 54 + 2);
    x.fillStyle = sc.fg; x.fillText('JIZURA', 96, 54);
    x.fillStyle = sc.accent; x.fillRect(12, 90, 30, 4);
    x.font = J.fontCSS('mono', 9); x.textAlign = 'left'; x.fillStyle = sc.sub; x.fillText(k.toUpperCase(), 48, 93);
  });
}
function fontSelectOptions(sel) {
  return '<option value="">스타일 기본값</option>' + Object.entries(J.FONTS).map(([k, f]) => {
    const g = J.faceOf ? J.faceOf(k) : f, alt = g.label && g.label !== f.label ? ' → ' + g.label : '';   // the face actually used for the lyric language
    return `<option value="${escapeHtml(k)}" style="font-family:${escapeHtml(g.family)},sans-serif;font-weight:${g.weight}" ${sel === k ? 'selected' : ''}>${escapeHtml(f.label + alt)}</option>`;
  }).join('');
}
function renderFontRoles() {
  const box = $('fontRoles'); box.innerHTML = '';
  [['display', '제목'], ['serif', '명조'], ['body', '작은 글자']].forEach(([role, label]) => {
    const row = document.createElement('div'); row.className = 'font-row';
    row.innerHTML = `<span class="muted">${label}</span><select aria-label="${label} 글꼴">${fontSelectOptions(S.project.fonts[role])}</select>`;
    row.querySelector('select').addEventListener('change', e => { if (e.target.value) S.project.fonts[role] = e.target.value; else delete S.project.fonts[role]; fontKey = ''; replan(); });
    box.appendChild(row);
  });
  renderCompositeFonts();
}
function renderCompositeFonts() {
  const choices = Object.entries(J.FONTS).filter(([, f]) => !f.composite).map(([key, f]) => `<option value="${escapeHtml(key)}" style="font-family:${escapeHtml((J.faceOf ? J.faceOf(key) : f).family)},sans-serif">${escapeHtml(f.label)}</option>`).join('');
  const base = $('compositeBase');
  if (!base) return;
  const selected = base.value; base.innerHTML = choices;
  if (selected && J.FONTS[selected]) base.value = selected;
  const parts = $('compositeParts'), existing = Object.fromEntries([...parts.querySelectorAll('select')].map(el => [el.dataset.part, el.value]));
  parts.innerHTML = Object.entries(J.COMPOSITE_PARTS).map(([key, label]) => `<label>${label}<select data-part="${key}"><option value="">기준 글꼴 사용</option>${choices}</select></label>`).join('');
  for (const select of parts.querySelectorAll('select')) if (existing[select.dataset.part]) select.value = existing[select.dataset.part];
  $('compositeList').innerHTML = (S.project.compositeFonts || []).map(def => `<div class="composite-saved"><span>${escapeHtml(def.name)}</span><button type="button" data-key="${escapeHtml(def.key)}" aria-label="${escapeHtml(def.name)} 삭제">×</button></div>`).join('');
}
const BASE_KEYS = [['bg', '배경'], ['fg', '글자'], ['sub', '보조']];
const ACCENT_KEYS = [['accent', '강조'], ['ghostA', '색 어긋남 A'], ['ghostB', '색 어긋남 B']];
function renderColors() {
  const st = J.STYLES[S.project.style] || J.STYLES.noir, sc = st.schemes[0];
  const c = S.project.colors;
  $('colorOn').checked = !!c.enabled;
  $('accentOn').checked = !!c.accentOn;
  const fill = (rowId, keys, flag) => {
    const row = $(rowId); row.innerHTML = '';
    keys.forEach(([k, label]) => {
      const l = document.createElement('label');
      const v = (c[flag] && c[k]) || c[k] || sc[k];
      l.innerHTML = `${label}<input type="color" value="${toColorInput(v)}">`;
      l.querySelector('input').addEventListener('input', e => {
        c[k] = e.target.value.toUpperCase();
        if (!c[flag]) { c[flag] = true; $(flag === 'enabled' ? 'colorOn' : 'accentOn').checked = true; }
        markUndoGroup(`color:${k}`); replanSoon(60); drawSwatch();
      });
      row.appendChild(l);
    });
  };
  fill('colorRow', BASE_KEYS, 'enabled');
  fill('colorRowAccent', ACCENT_KEYS, 'accentOn');
  drawSwatch();
}
const toColorInput = v => { const h = String(v || '#000000'); return /^#[0-9a-f]{6}$/i.test(h) ? h.toLowerCase() : J.toHex(...J.hex(h)).toLowerCase(); };
function swatchHTML(cols) { return cols.filter(c => /^#[0-9a-f]{3,8}$/i.test(String(c))).map(c => `<i style="background:${c}" title="${c}"></i>`).join(''); }
function drawSwatch() {
  const sc = S.plan ? S.plan.style.schemes[0] : null; if (!sc) return;
  $('paletteSwatch').innerHTML = swatchHTML([sc.accent, sc.ghostA, sc.ghostB]);
}
function randomPalette() {
  remember();
  const c = S.project.colors;
  const sc0 = J.STYLES[S.project.style].schemes[0];
  const bg = c.enabled && c.bg ? c.bg : sc0.bg;
  let p, guard = 0;
  do { p = J.randomPalette(bg); } while (guard++ < 6 && p.ghostA === c.ghostA && p.ghostB === c.ghostB);
  Object.assign(c, { accent: p.accent, ghostA: p.ghostA, ghostB: p.ghostB, accentOn: true });
  renderColors(); replan(); commit();
  toast('색 배합: 강조·색 어긋남 A/B 변경', [p.accent, p.ghostA, p.ghostB]);
}

/* ---------------- history of looks (◀ ▶) ---------------- */
// only the "look" is tracked — lyrics, timing and output settings are never rolled back
const HKEYS = ['style', 'mood', 'seed', 'fx', 'enabled', 'fonts', 'colors', 'overrides', 'locks'];
const H = { list: [], i: -1 };
const lookSnap = () => JSON.stringify(Object.fromEntries(HKEYS.map(k => [k, S.project[k] ?? null])));
function remember() {            // call before changing the look: makes sure the current look is on the stack
  const s = lookSnap();
  if (H.i >= 0 && H.list[H.i] === s) return;
  H.list = H.list.slice(0, H.i + 1); H.list.push(s); H.i = H.list.length - 1;
}
function commit() {              // call after changing the look
  const s = lookSnap();
  if (H.list[H.i] !== s) { H.list = H.list.slice(0, H.i + 1); H.list.push(s); H.i = H.list.length - 1; }
  if (H.list.length > 80) { H.list.splice(0, H.list.length - 80); H.i = H.list.length - 1; }
  updateHist();
}
function histGo(d) {
  if (S.exporting) return;
  remember();                    // hand edits made since the last step become a stop of their own
  const j = H.i + d; if (j < 0 || j >= H.list.length) return;
  H.i = j;
  const snap = JSON.parse(H.list[j]);
  // 표시 영역 is not part of a look: keep the rows' current areas (as おまかせ does)
  if (snap.overrides) {
    const ov = {};
    for (const [i, o] of Object.entries(snap.overrides)) { const { area, ...rest } = o || {}; if (Object.keys(rest).length) ov[i] = rest; }
    for (const [i, o] of Object.entries(S.project.overrides || {})) if (o && o.area) ov[i] = Object.assign({}, ov[i], { area: o.area });
    snap.overrides = ov;
  }
  Object.assign(S.project, snap);
  fontKey = ''; syncUI(); replan(); updateHist();
  toast(`${j + 1} / ${H.list.length}번째 안`);
  restartPreview();
}
function updateHist() {
  const canB = H.i > 0, canF = H.i < H.list.length - 1;
  ['btnPrev', 'btnPrev2'].forEach(id => { $(id).disabled = !canB; });
  ['btnNext', 'btnNext2'].forEach(id => { $(id).disabled = !canF; });
  $('histPos').textContent = H.list.length > 1 ? `${H.i + 1} / ${H.list.length}` : '';
}

/* ---------------- locks (what Randomize / Shuffle must not touch) ----------------
   project.locks = { tech: { group: true }, params: { key: true } }
   tech:   freezes that group's ON/OFF selection, i.e. the candidate count the panel shows (120/140, 28/28).
           Randomize re-picks which techniques are candidates, so freezing the pool is what keeps the count —
           this does not pin one technique in place.
   params: freezes the current value of the effects sliders, on-twos and flash.
   Neither goes into J.plan: they only bracket the places that rewrite the look (Randomize, mood reroll). */
const LOCK_TITLE_ON = 'おまかせ／シャッフルで変えないようにロック';
const TECH_LOCK_ON = 'おまかせでON／OFFを変えないようにロック';
const LOCK_TITLE_OFF = 'ロック中。クリックで解除';
function locksOf() {
  const P = S.project;
  if (!P.locks) P.locks = { tech: {}, params: {} };
  if (!P.locks.tech) P.locks.tech = {};
  if (!P.locks.params) P.locks.params = {};
  return P.locks;
}
function lockOn(k) { return !!locksOf().params[k]; }
function lockName(k) {
  const f = FX.find(x => x[0] === k);
  return f ? f[1] : k;
}
function groupLabel(g) { const m = GROUPS.find(x => x[0] === g); return m ? m[1] : g; }
function toggleTechLock(g) {
  const L = locksOf();
  remember();
  if (L.tech[g]) { delete L.tech[g]; toast('ロック解除：' + groupLabel(g)); }
  else { L.tech[g] = true; toast('ロック：' + groupLabel(g)); }
  commit(); autosave(); renderTech();
}
function toggleParamLock(k) {
  const L = locksOf();
  remember();
  if (L.params[k]) { delete L.params[k]; toast('ロック解除：' + lockName(k)); }
  else { L.params[k] = true; toast('ロック：' + lockName(k)); }
  commit(); autosave(); renderFx();
}
function lockedEnabled() {                        // ON/OFF selection of every locked group, as it is now
  const P = S.project, out = {};
  for (const g of Object.keys(locksOf().tech)) if (P.enabled && P.enabled[g]) out[g] = Object.assign({}, P.enabled[g]);
  return out;
}
function restoreEnabled(keep) {                   // put the locked groups back after Randomize
  const P = S.project;
  for (const g of Object.keys(keep || {})) { P.enabled = P.enabled || {}; P.enabled[g] = keep[g]; }
}
function lockedParams() {                         // current value of every locked effect / set switch
  const out = {}, L = locksOf(), F = S.project.fx;
  for (const k of Object.keys(L.params)) {
    if (!L.params[k]) continue;
    if (k === 'koma') out[k] = J.komaOf(F);                      // on-twos: freeze the effective value even when unset
    else if (k === 'flash') out[k] = !!F.flash;
    else if (F[k] != null) out[k] = F[k];
  }
  return out;
}
function restoreParams(keep) {
  const P = S.project;
  for (const k of Object.keys(keep || {})) P.fx[k] = keep[k];
}
function lockBtn(k, anchor) {                     // lock button for effects that are not sliders (on-twos, flash)
  const p = anchor.parentElement;
  let b = p.querySelector(':scope > .lk[data-lk="' + k + '"]');
  if (!b) {
    b = document.createElement('button');
    b.type = 'button'; b.className = 'icon ghost lk pro-only'; b.dataset.lk = k;
    b.innerHTML = ICON.lock;
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggleParamLock(k); });
    anchor.insertAdjacentElement('afterend', b);
  }
  const on = !!locksOf().params[k];
  b.setAttribute('aria-pressed', String(on));
  b.title = on ? LOCK_TITLE_OFF : LOCK_TITLE_ON;
  return b;
}

/* ---------------- おまかせ ---------------- */
function restartPreview() { seek(0); if (!S.playing && S.mode !== 'pro') play(); }
function omakase() {
  if (S.exporting || S.tap) return;
  remember();
  const keepE = lockedEnabled(), keepP = lockedParams();
  const r = J.omakase(S.project);
  Object.assign(S.project, r);
  restoreEnabled(keepE); restoreParams(keepP);
  fontKey = ''; syncUI(); replan(); commit();
  toast(`자동: ${J.STYLES[r.style].name} × ${J.MOODS[r.mood].name}`, r.colors.accentOn ? [r.colors.accent, r.colors.ghostA, r.colors.ghostB] : null);
  restartPreview();
}
let aiBusy = false;
async function aiPick() {
  if (aiBusy || S.exporting || S.tap) return;
  aiBusy = true;
  ['btnAiPick', 'btnAiPickBig'].forEach(id => { $(id).disabled = true; });
  showMsg('AI가 가사에 맞는 연출을 고르는 중…');
  try {
    const lyrics = S.project.lyrics, aiPrompt = S.project.aiPrompt;
    const selected = await J.decideSuggest(S.project);
    if (S.project.lyrics !== lyrics || S.project.aiPrompt !== aiPrompt) throw new Error('고르는 동안 가사나 추가 지시가 바뀌었습니다. 다시 실행하세요');
    remember();
    const look = J.applyDecide(S.project, selected);
    Object.assign(S.project, look);
    fontKey = ''; syncUI(); replan(); commit();
    toast(`AI로 고르기: ${J.STYLES[look.style].name} × ${J.MOODS[look.mood].name}`);
    restartPreview();
  } catch (e) {
    toast(`AI로 고르기: ${e.message || e}`);
    console.error(e);
  } finally {
    showMsg(null);
    aiBusy = false;
    ['btnAiPick', 'btnAiPickBig'].forEach(id => { $(id).disabled = false; });
  }
}
// change just one aspect of the current look
function rerollPart(part) {
  if (S.exporting || S.tap) return;
  remember();
  const P = S.project;
  let msg = '';
  if (part === 'style') {
    let pool = J.STYLE_ORDER.filter(k => k !== P.style && J.randomOk(P, 'style', k));
    if (!pool.length) pool = J.STYLE_ORDER.filter(k => k !== P.style);
    P.style = pool[Math.floor(Math.random() * pool.length)];
    P.colors.enabled = false;
    msg = `스타일: ${J.STYLES[P.style].name}`;
  } else if (part === 'mood') {
    const keepE = lockedEnabled(), keepP = lockedParams();
    const r = J.omakase(P);
    Object.assign(P, { mood: r.mood, fx: r.fx, enabled: r.enabled });
    restoreEnabled(keepE); restoreParams(keepP);
    msg = `분위기: ${J.MOODS[r.mood].name}`;
  } else if (part === 'cut') {
    P.seed = (Math.random() * 1e9) | 0;
    msg = '구성: 레이아웃과 움직임 다시 뽑기';
  }
  fontKey = ''; syncUI(); replan(); commit();
  toast(msg);
  restartPreview();
}
function showNow() {
  const el = $('easyNow'); if (!el || !S.plan || el.closest('[hidden]')) return;
  const P = S.project, sc = S.plan.style.schemes[0];
  const moodName = P.mood && J.MOODS[P.mood] ? J.MOODS[P.mood].name : '사용자 지정';
  const fk = S.plan.style.fonts.display[0];
  const fontName = J.FONTS[fk] ? (J.faceOf ? J.faceOf(fk) : J.FONTS[fk]).label : fk;   // the face actually drawn for the lyric language
  const cuts = S.plan.cuts.filter(c => c.line >= 0 && c.layout !== 'interlude');
  const kinds = new Set(cuts.map(c => c.layout)).size;
  const row = (k, v) => `<div class="now-row"><span class="k">${k}</span><span class="v">${v}</span></div>`;
  el.innerHTML = row('스타일', `<b>${escapeHtml(J.STYLES[P.style].name)}</b>`)
    + row('분위기', escapeHtml(moodName))
    + row('색 배합', `<span class="swatches">${swatchHTML([sc.bg, sc.fg, sc.accent, sc.ghostA, sc.ghostB])}</span>${P.colors.accentOn ? '<span class="tagl">무작위</span>' : ''}`)
    + row('제목 글꼴', escapeHtml(fontName))
    + row('구성', `${cuts.length}컷 · 레이아웃 ${kinds}종`)
    + row('연출', `가공 ${cuts.filter(c => c.treat && c.treat !== 'none').length} · 배경 ${new Set(cuts.map(c => c.bg).filter(b => b && b !== 'none')).size}종 · 카메라 ${cuts.filter(c => c.cam && c.cam !== 'push').length}`);
}
let toastTimer = 0;
function toast(m, cols) {
  const el = $('toast'); if (!el) return;
  el.innerHTML = escapeHtml(m) + (cols ? `<span class="swatches">${swatchHTML(cols)}</span>` : '');
  el.hidden = false; el.classList.remove('out'); void el.offsetWidth; el.classList.add('in');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('in'); el.classList.add('out'); toastTimer = setTimeout(() => { el.hidden = true; }, 260); }, 1700);
}

/* ---------------- かんたん / 詳細 ---------------- */
function setMode(m) {
  S.mode = m === 'easy' ? 'easy' : m === 'mobile' ? 'mobile' : 'pro';
  const mobile = S.mode === 'mobile', easy = S.mode === 'easy' || mobile;   // スマホ = the かんたん panel, laid out for a phone
  $('app').classList.toggle('is-easy', easy);
  $('app').classList.toggle('is-mobile', mobile);
  $('app').classList.remove('menu-open'); $('btnMenu').setAttribute('aria-expanded', 'false');
  document.documentElement.classList.toggle('fixed-ok', !mobile);           // one scrolling page on a phone
  $('easyPanel').hidden = !easy;
  $('modeMobile').setAttribute('aria-pressed', String(mobile));
  $('modeEasy').setAttribute('aria-pressed', String(S.mode === 'easy'));
  $('modePro').setAttribute('aria-pressed', String(S.mode === 'pro'));
  try { localStorage.setItem('jizura.mode', S.mode); } catch (e) {}
  if (mobile) mobileInit();
    if (easy) { showNow(); syncOut(); codecNoteSoon(); }
    if (easy) closeCutPick();
    if (S.plan && S.lineEls && S.lineEls.length) { lastCutIdx = -2; updateCutInfo(); }
  sizeViewport(); drawTimeline(); loadThumbFonts();
}

/* スマホ: the preview sticks right under the header; the first time, a phone-friendly size and the line list folded */
function mobileBar() { const b = document.querySelector('.bar'); if (b) document.documentElement.style.setProperty('--mbar', b.offsetHeight + 'px'); }
function mobileInit() {
  mobileBar();
  let first = true; try { first = localStorage.getItem('jizura.mobileInit') !== '1'; localStorage.setItem('jizura.mobileInit', '1'); } catch (e) {}
  if (first) {
    if ((S.project.res || 1080) > 720) { S.project.res = 720; syncOut(); autosave(); }
    const sec = $('lineList') && $('lineList').closest('.sec'); if (sec) sec.classList.add('fold');
  }
}

/* ---------------- fx tab ---------------- */
const FX = [['motion', '움직임 강도'], ['glitch', '글리치'], ['chroma', '색 어긋남'], ['decor', '장식 양'], ['density', '컷 촘촘함'], ['texture', '질감'], ['bgSwitch', '배경 전환'], ['react', '음악 반응']];
function renderFx() {
  const box = $('fxSliders'); box.innerHTML = '';
  FX.forEach(([k, label]) => {
    const row = document.createElement('div'); row.className = 'slider';
    const v = S.project.fx[k] ?? 0.5;
    const lk = lockOn(k);
    row.innerHTML = `<label for="fx_${k}">${label}</label><input id="fx_${k}" type="range" min="0" max="1" step="0.01" value="${v}"><output>${Math.round(v * 100)}</output>`
      + `<button type="button" class="icon ghost lk pro-only" data-lk="${k}" aria-pressed="${lk}" title="${lk ? LOCK_TITLE_OFF : LOCK_TITLE_ON}">${ICON.lock}</button>`;
    const inp = row.querySelector('input'), out = row.querySelector('output');
    row.querySelector('.lk').addEventListener('click', () => toggleParamLock(k));
    inp.addEventListener('input', () => { S.project.fx[k] = +inp.value; S.project.mood = null; out.textContent = Math.round(inp.value * 100); markUndoGroup(`fx:${k}`); replanSoon(120); });
    box.appendChild(row);
  });
  lockBtn('flash', $('fxFlash').closest('label'));
  lockBtn('koma', $('fxKoma').closest('label'));
  $('fxFlash').checked = !!S.project.fx.flash;
  $('fxKoma').value = String(J.komaOf(S.project.fx));
  $('fxHud').value = S.project.fx.hud || 'auto';
  $('fxInterCount').value = S.project.fx.interCount || 'auto';
  $('fxInterCredit').checked = !!S.project.fx.interCredit;
  $('seed').value = S.project.seed;
}

/* ---------------- technique tab ---------------- */
const GROUPS = [['layout', '레이아웃'], ['enter', '등장'], ['hold', '유지'], ['exit', '퇴장'], ['decor', '장식'], ['treat', '글자 가공'], ['bg', '배경'], ['cam', '카메라'], ['fx', '화면 효과'], ['trans', '컷 간 전환']];
const openGroups = new Set();
function techItems(g) { return J.order(g).filter(k => J.registry(g)[k] && !J.registry(g)[k].special); }

const previewR = new J.Renderer();
const previewPlans = new Map();
const previewLive = new Set();
let previewObs = null, previewRaf = 0, previewLast = 0;
function previewCacheKey(g, k) {
  const p = S.project;
  return [p.style, p.aspect, g, k, p.colors && p.colors.enabled ? JSON.stringify(p.colors) : '', JSON.stringify(p.fonts || {})].join('|');
}
function getPreviewPlan(g, k) {
  const id = previewCacheKey(g, k);
  let plan = previewPlans.get(id);
  if (plan) return plan;
  plan = J.previewPlan(S.project, g, k);
  previewPlans.set(id, plan);
  if (previewPlans.size > 500) previewPlans.delete(previewPlans.keys().next().value);
  return plan;
}
function previewTime(plan, g, now) {
  const c = plan.cuts[plan.cuts.length - 1];
  const u = now / 1000;
  if (g === 'enter') return c.start + ((u % 1.5) / 1.5) * Math.max(0.3, c.inDur);
  if (g === 'exit') { const od = Math.max(0.3, c.outDur || 0.5); return c.end - od + ((u % 1.5) / 1.5) * od; }
  if (g === 'trans') return c.start + ((u % 1.7) / 1.7) * (c.transDur || 0.35);
  if (g === 'fx') return (u % 1.05);
  const span = Math.max(1.6, c.dur * 0.96);
  return c.start + ((u % span) / span) * (c.dur * 0.96);
}
function paintTechCanvas(cv, g, k, t) {
  const plan = getPreviewPlan(g, k);
  const ctx = cv.getContext('2d');
  try {
    previewR.frame(ctx, plan, t, { scale: cv.width / plan.W, fast: true, noHud: true, noGhost: g !== 'fx' });
  } catch (e) {
    ctx.fillStyle = '#131316'; ctx.fillRect(0, 0, cv.width, cv.height);
  }
  cv.dataset.ready = '1';
}
function techPaneOpen() {
  const pane = $('techLists') && $('techLists').closest('.tabpane');
  const pick = $('cutPick');
  return (pane && !pane.hidden) || (pick && !pick.hidden);
}
function ensurePreviewObs() {
  if (previewObs) return previewObs;
  previewObs = new IntersectionObserver((ents) => {
    ents.forEach(e => { if (e.isIntersecting && e.intersectionRatio > 0) previewLive.add(e.target); else previewLive.delete(e.target); });
    kickPreviewLoop();
  }, { root: null, rootMargin: '40px 0px', threshold: [0, 0.12, 0.4] });
  return previewObs;
}
function resetPreviewWatch() {
  previewLive.clear();
  if (previewObs) { previewObs.disconnect(); previewObs = null; }
}
function watchThumb(cv) { ensurePreviewObs().observe(cv); }
function kickPreviewLoop() {
  if (previewRaf) return;
  const tick = (now) => {
    previewRaf = 0;
    if (document.hidden || S.exporting || !techPaneOpen() || !previewLive.size) return;
    if (now - previewLast >= 70) {
      previewLast = now;
      for (const cv of previewLive) {
        if (!cv.isConnected) { previewLive.delete(cv); continue; }
        const g = cv.dataset.g, k = cv.dataset.k;
        if (!g || !k) continue;
        paintTechCanvas(cv, g, k, previewTime(getPreviewPlan(g, k), g, now));
      }
    }
    previewRaf = requestAnimationFrame(tick);
  };
  previewRaf = requestAnimationFrame(tick);
}
function queueThumbs(list) {
  const now = performance.now();
  [...list.querySelectorAll('canvas[data-g]')].forEach(cv => {
    previewLive.add(cv);
    watchThumb(cv);
    const g = cv.dataset.g, k = cv.dataset.k;
    if (g && k) paintTechCanvas(cv, g, k, previewTime(getPreviewPlan(g, k), g, now));
  });
  kickPreviewLoop();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) kickPreviewLoop(); });

function renderTech() {
  resetPreviewWatch();
  const box = $('techLists'); box.innerHTML = '';
  const q = ($('techFilter').value || '').trim().toLowerCase();
  let total = 0, onAll = 0;
  GROUPS.forEach(([g, label]) => {
    const tbl = J.registry(g), items = techItems(g), en = S.project.enabled[g] || (S.project.enabled[g] = {});
    const shown = q ? items.filter(k => (tbl[k].name + ' ' + k).toLowerCase().includes(q)) : items;
    const onN = items.filter(k => en[k] !== false).length;
    total += items.length; onAll += onN;
    if (q && !shown.length) return;
    const d = document.createElement('details'); d.className = 'tgroup';
    d.open = !!q || openGroups.has(g);
    const list = document.createElement('div'); list.className = 'checks tech-grid';
    d.addEventListener('toggle', () => { if (d.open) { openGroups.add(g); queueThumbs(list); } else openGroups.delete(g); });
    const lked = !!locksOf().tech[g];
    d.innerHTML = `<summary><span class="tg-name">${label}</span><span class="tg-cnt mono">${onN}/${items.length}</span>`
      + `<button type="button" class="icon ghost lk pro-only" data-lk="${g}" aria-pressed="${lked}" title="${lked ? LOCK_TITLE_OFF : TECH_LOCK_ON}">${ICON.lock}</button></summary><div class="tg-tools"><button class="ghost small" data-a="on">모두 켜기</button><button class="ghost small" data-a="off">모두 끄기</button><button class="ghost small" data-a="flip">반전</button></div>`;
    const [tw, th] = (() => {
      const [W, H] = J.designSize(S.project.aspect || '16:9');
      const h = 90; return [Math.max(80, Math.round(h * W / H)), h];
    })();
    shown.forEach(k => {
      const l = document.createElement('label');
      l.className = 'tcard';
      l.title = k + (tbl[k].tags && tbl[k].tags.length ? '(' + tbl[k].tags.map(t => (J.MOODS[t] ? J.MOODS[t].name : t)).join('·') + ')' : '');
      if (!J.randomOk(S.project, g, k)) { l.classList.add('set-off'); l.title += tbl[k].extra && S.project.extra !== true ? '(추가 연출이 꺼져 있어 자동으로는 선택되지 않습니다)' : tbl[k].set && !J.setOn(S.project, tbl[k].set) ? '(이 세트가 꺼져 있어 자동으로는 선택되지 않습니다)' : '(일본풍 연출이 꺼져 있어 자동으로는 선택되지 않습니다)'; }
      l.innerHTML = `<canvas width="${tw}" height="${th}" data-g="${g}" data-k="${k}"></canvas><span class="tcard-name"><input type="checkbox" ${en[k] !== false ? 'checked' : ''}> <span>${escapeHtml(tbl[k].name)}</span>${setBadges(tbl[k])}</span>`;
      const cv = l.querySelector('canvas');
      l.querySelector('input').addEventListener('change', e => { en[k] = e.target.checked; S.project.mood = null; d.querySelector('.tg-cnt').textContent = `${items.filter(x => en[x] !== false).length}/${items.length}`; replanSoon(60); });
      list.appendChild(l);
    });
    d.querySelector('summary .lk').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggleTechLock(g); });
    d.querySelectorAll('.tg-tools button').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.a;
      shown.forEach(k => { en[k] = a === 'on' ? true : a === 'off' ? false : en[k] === false; });
      if (g === 'layout' && !items.some(k => en[k] !== false)) en.center = true;
      if (g === 'enter') en.cut = true; if (g === 'exit') en.cut = true; if (g === 'hold') en.still = true;
      if (g === 'treat') en.none = true; if (g === 'bg') en.none = true; if (g === 'cam') en.push = true;
      S.project.mood = null; openGroups.add(g); renderTech(); replan();
    }));
    d.appendChild(list);
    box.appendChild(d);
    if (d.open) queueThumbs(list);
  });
  $('techTotal').textContent = `${onAll}/${total}`;
}

/* ---------------- output tab ---------------- */
function syncOut() {
  $('outAspect').value = S.project.aspect; $('outRes').value = String(S.project.res); $('outFps').value = String(S.project.fps);
  $('eAspect').value = S.project.aspect; $('eRes').value = String(S.project.res); $('eFps').value = String(S.project.fps);
  const size = S.project.videoSize;
  const preset = size ? `${size.w}x${size.h}` : 'legacy';
  for (const id of ['out', 'e']) {
    const selector = $(`${id}VideoSize`);
    selector.value = S.project.videoSizeMode === 'custom' ? 'custom' : [...selector.options].some(option => option.value === preset) ? preset : 'custom';
    if (!size) selector.value = 'legacy';
    $(`${id}VideoWidth`).value = size ? size.w : J.outputSize(S.project)[0];
    $(`${id}VideoHeight`).value = size ? size.h : J.outputSize(S.project)[1];
    $(`${id}VideoWidth`).closest('label').hidden = selector.value !== 'custom';
    $(`${id}VideoHeight`).closest('label').hidden = selector.value !== 'custom';
  }
  for (const id of ['outAspect', 'outRes', 'eAspect', 'eRes']) $(id).disabled = !!size;
  $('outQuality').value = S.project.quality || 'high'; $('outAudio').checked = S.project.includeAudio !== false;
  const k = J.keyMode(S.project) || 'off';
  $('outKey').value = k; $('eKey').value = k;
  $('outCenter').checked = $('eCenter').checked = !!S.project.centerFree;
  const [dW, dH] = J.designSize(S.project), tall = dH > dW * 1.1;   // the planner's frame (직접 지정한 영상 크기 포함)
  document.querySelectorAll('.center-dir').forEach(el => { el.hidden = !(S.project.centerFree && tall); });
  document.querySelectorAll('.centerDirSel').forEach(el => { el.value = S.project.centerDir === 'lr' ? 'lr' : 'tb'; });
  const kb = $('keyBadge');
  kb.hidden = k === 'off';
  if (k !== 'off') kb.innerHTML = `<i style="background:${J.KEY_BG[k]}"></i>${k === 'green' ? '그린 스크린' : '블랙 배경'}`;
}
// the codec check is slow in some browsers: at start-up, let the first preview frames paint before asking
function codecNoteSoon() { (window.requestIdleCallback || (f => setTimeout(f, 400)))(() => codecNote(), { timeout: 1500 }); }
async function codecNote() {
  const [w, h] = J.outputSize(S.project);
  const vc = await J.pickVideoCodec(w, h, S.project.fps, 12e6);
  $('codecNote').textContent = vc ? `이 브라우저에서는 ${vc.label}(으)로 내보냅니다(${w}×${h} / ${S.project.fps}fps). 내보내는 동안 탭을 열어 두세요.` : '이 브라우저는 영상 인코딩(WebCodecs)을 지원하지 않습니다. Chrome / Edge 최신 버전으로 열거나 연속 PNG를 사용하세요.';
  $('btnMP4').disabled = !vc; $('eMP4').disabled = !vc;
  ['btnMP4File', 'eMP4File'].forEach(id => { $(id).hidden = !vc || !canPickFile(); });
  if (!vc) $('eMP4').title = '이 브라우저에서는 MP4 내보내기를 사용할 수 없습니다 (Chrome / Edge 권장)';
}
const EXP_BTNS = ['btnMP4', 'btnPNG', 'btnPNGA', 'btnPNGL', 'eMP4', 'btnMP4File', 'eMP4File'];
function baseName() {
  const k = J.keyMode(S.project);
  return ((S.project.title || 'jizura').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60) || 'jizura') + (k ? (k === 'green' ? '_greenback' : '_blackback') : '');
}
const canPickFile = () => typeof window.showSaveFilePicker === 'function' && !document.documentElement.classList.contains('cep') && typeof VideoEncoder !== 'undefined';
async function runExport(kind) {
  if (S.exporting) return;
  // 大きな動画用: the save dialog must open straight from the click (before anything is awaited)
  let file = null, fileName = '';
  if (kind === 'mp4file') {
    try {
      const hnd = await window.showSaveFilePicker({ suggestedName: baseName() + rangeSuffix() + '.mp4', types: [{ description: 'MP4', accept: { 'video/mp4': ['.mp4'] } }] });
      file = await hnd.createWritable(); fileName = hnd.name;
    } catch (e) { if (e && e.name === 'AbortError') return; toast('저장 위치를 열 수 없습니다: ' + (e && e.message ? e.message : e)); return; }
  }
  pause();
  const ac = new AbortController(); S.exporting = ac;
  const boxes = [...document.querySelectorAll('.exp-box')];
  const setText = m => boxes.forEach(b => { b.querySelector('.exp-text').textContent = m; });
  const txt = { set textContent(m) { setText(m); }, get textContent() { return boxes[0].querySelector('.exp-text').textContent; } };
  boxes.forEach(b => { b.hidden = false; b.querySelector('.exp-bar').style.width = '0%'; });
  setText('준비 중…');
  EXP_BTNS.forEach(id => { $(id).disabled = true; });
  const onProgress = (p, m) => { boxes.forEach(b => { b.querySelector('.exp-bar').style.width = (p * 100).toFixed(1) + '%'; }); setText(m); };
  const t0 = performance.now();
  boxes.forEach(b => { const sh = b.querySelector('.exp-share'); if (sh) sh.hidden = true; });
  // keep the phone's screen on while exporting (a sleeping screen stops the encoder)
  let wake = null; try { if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); } catch (e) { wake = null; }
  // スマホ: at most 1080p (phones run out of memory / encoder time at 1440p and 4K)
  const proj = S.mode === 'mobile' && (S.project.res || 1080) > 1080 ? Object.assign({}, S.project, { res: 1080 }) : S.project;
  if (proj !== S.project) toast('スマホの画面では 1080p で書き出します');
  try {
    await J.ensureFonts(S.project.lyrics + (S.project.title || '') + (S.project.artist || '') + HUD_CHARS, J.fontsOfPlan(S.plan));
    const lost = J.missingUserFonts(J.fontsOfPlan(S.plan).concat(Object.values(S.project.fonts || {})));
    if (lost.length) throw new Error(`読み込んだ書体（${[...new Set(lost)].join('・')}）がこのブラウザにないため、書き出しを止めました。「フォント」から同じファイルを読み込み直すか、別の書体を選んでください`);
    if (kind === 'mp4' || kind === 'mp4file') {
      const plan = S.plan, range = exportRange(), span = J.exportSpan(plan, range);
      const r = await J.exportMP4({ plan, project: proj, audio: S.project.includeAudio !== false ? S.audio : null, quality: S.project.quality || 'high', onProgress, signal: ac.signal, range, file });
      file = null;
      txt.textContent = `완료 ${r.blob ? (r.blob.size / 1048576).toFixed(1) + 'MB · ' : ''}${r.codec}${r.audio ? ' + ' + r.audio.toUpperCase() : ''} · ${((performance.now() - t0) / 1000).toFixed(0)}초`;
      if (r.blob) {
        const name = baseName() + rangeSuffix() + '.mp4';
        const res = await J.saveFile(name, r.blob);
        if (res === 'declined') txt.textContent += ' (저장이 취소됨)';
        offerShare(boxes, r.blob, name);
      } else txt.textContent += `·「${fileName}」에 저장했습니다`;
      if (r.tried && r.tried.length) txt.textContent += '(처음 방법이 실패해서 다른 인코더로 내보냈습니다)';
      // audio that some players cannot play (Opus), or none at all: save the soundtrack as WAV next to it
      if (r.audioWanted && r.audio !== 'aac') {
        await J.saveFile(baseName() + rangeSuffix() + '_audio.wav', J.audioWav(S.audio.buffer, span.dur, span.t0));
        txt.textContent += r.audio ? '. 이 브라우저에서는 오디오가 Opus가 되어 iPhone·QuickTime 등에서 소리가 나지 않을 수 있으므로 오디오를 WAV로도 저장했습니다' : '. 이 브라우저는 오디오를 내보낼 수 없어 오디오를 WAV로 따로 저장했습니다(동영상 편집 프로그램에서 겹쳐 주세요)';
      } else if (S.project.includeAudio !== false && !S.audio && S.project.audioName) txt.textContent += '. 음원을 불러오지 않아 소리가 없습니다(‘음원 불러오기’로 다시 불러오세요)';
    } else {
      const blob = await J.exportPNGZip({ plan: S.plan, project: proj, transparent: kind === 'pnga', layers: kind === 'pngl', onProgress, signal: ac.signal, range: exportRange() });
      txt.textContent = `완료 ${(blob.size / 1048576).toFixed(1)}MB`;
      await J.saveFile(baseName() + rangeSuffix() + (kind === 'pnga' ? '_alpha' : kind === 'pngl' ? '_layers' : '') + '_png.zip', blob);
    }
  } catch (e) {
    txt.textContent = '오류: ' + (e && e.message ? e.message : e);
    console.error(e);
    if (file) { try { await file.abort(); } catch (e2) {} }
  } finally {
    S.exporting = null; S.need = true;
    EXP_BTNS.forEach(id => { $(id).disabled = false; });
    try { if (wake) await wake.release(); } catch (e) {}
    codecNote();
  }
}
/* phones: the share sheet is the reliable way to put a video into Photos / Files (a download link often isn't) */
function offerShare(boxes, blob, name) {
  let f = null;
  try { f = new File([blob], name, { type: blob.type || 'video/mp4' }); } catch (e) { return; }
  if (!navigator.canShare || !navigator.share || !navigator.canShare({ files: [f] })) return;
  boxes.forEach(b => {
    const sh = b.querySelector('.exp-share'); if (!sh) return;
    sh.hidden = false;
    sh.onclick = async () => { try { await navigator.share({ files: [f], title: name }); } catch (e) {} };
  });
}

/* ---------------- 행별 후보 6개 ---------------- */
// the next six re-rolls of a line, playing in small previews; picking one is the same as rolling the dice that many times
let candAnim = 0;
async function openCandidates(i) {
  let dlg = $('candDlg');
  if (!dlg) {
    dlg = document.createElement('dialog'); dlg.id = 'candDlg'; dlg.className = 'terms cand-dlg'; dlg.setAttribute('aria-labelledby', 'candTitle');
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => { cancelAnimationFrame(candAnim); candAnim = 0; });
  }
  const ln = S.plan.lines[i]; if (!ln || ln.interlude) return;
  const cur = S.project.overrides[i] || {}, base = cur.seed | 0;
  const cands = [1, 2, 3, 4, 5, 6].map(k => {
    const seed = base + k, ov = Object.assign({}, S.project.overrides, { [i]: Object.assign({}, cur, { seed, lock: false, lockedSeed: undefined, lockedCuts: undefined }) });
    const plan = J.plan(Object.assign({}, S.project, { overrides: ov }), S.audio);
    const cuts = plan.cuts.filter(c => c.line === i && J.LAYOUTS[c.layout] && !J.LAYOUTS[c.layout].special);
    return { seed, plan, cuts, label: cuts.map(c => J.LAYOUTS[c.layout].name).join('|') };
  });
  dlg.innerHTML = `<h2 id="candTitle">${i + 1}행 후보</h2><p class="terms-sub">${escapeHtml(ln.text)}</p><div class="cand-grid"></div>
    <form method="dialog" class="outbtns"><button value="cancel" class="ghost">닫기</button></form>`;
  const grid = dlg.querySelector('.cand-grid'), R = new J.Renderer(), tw = 240;
  const views = cands.map(c => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'cand-item'; b.dataset.layouts = c.label; b.dataset.seed = c.seed;
    const cv = document.createElement('canvas'); cv.width = tw; cv.height = Math.round(tw * c.plan.H / c.plan.W);
    const cap = document.createElement('span'); cap.textContent = c.label.split('|').join(' · ');
    b.append(cv, cap); grid.appendChild(b);
    b.addEventListener('click', () => {
      remember(); setOv(i, { seed: c.seed, lock: false, lockedSeed: undefined, lockedCuts: undefined }); replan(); commit(); dlg.close(); seek(ln.start + 0.001);
      toast(`${i + 1}행: 후보 ${cands.indexOf(c) + 1}을(를) 골랐습니다`);
    });
    return { c, ctx: cv.getContext('2d') };
  });
  if (!dlg.open) dlg.showModal();
  try { await J.ensureFonts(ln.text, [...new Set(cands.flatMap(c => J.fontsOfPlan(c.plan)))]); } catch (e) {}
  // loop the line in every preview (about 15 fps is enough to judge the motion)
  const t0 = ln.start, t1 = Math.max(ln.start + 0.5, ln.visEnd ?? ln.end), wall = performance.now();
  let last = 0;
  const tick = now => {
    if (!dlg.open) return;
    candAnim = requestAnimationFrame(tick);
    if (now - last < 66) return; last = now;
    const t = t0 + ((now - wall) / 1000) % (t1 - t0);
    for (const v of views) R.frame(v.ctx, v.c.plan, t, { scale: tw / v.c.plan.W });
  };
  cancelAnimationFrame(candAnim); candAnim = requestAnimationFrame(tick);
}

/* ---------------- 소재 ---------------- */
const pct = v => Math.round(v * 100);
function renderAssets() {
  const ol = $('assetList'); if (!ol) return;
  ol.innerHTML = '';
  S.project.assets.forEach((a, i) => {
    const li = document.createElement('li'); li.className = 'asset' + (a.hidden ? ' is-hidden' : '');
    const A = J.ASSETS.get(a.id);
    li.innerHTML = `<canvas class="a-thumb" width="64" height="40"></canvas>
      <div class="a-main"><div class="a-name" title="${escapeHtml(a.name)}">${escapeHtml(a.name)}${A && A.keyed ? ' <span class="muted">(그린백 제거)</span>' : ''}</div>
      <div class="a-row">
        <select class="a-kind" aria-label="${i + 1}번 소재 종류"><option value="overlay">겹치기</option><option value="subject">피사체 뒤로 문자</option></select>
        ${a.kind === 'subject' ? `<button class="small a-mask" title="가사 앞에 다시 그릴 피사체를 칠하거나 AI로 고릅니다">피사체 편집${A && A.subj ? '' : ' (미설정)'}</button>` : ''}
        <select class="a-layer" aria-label="${i + 1}번 소재 위치"${a.kind === 'subject' ? ' hidden' : ''}><option value="back">가사 뒤</option><option value="front">가사 앞</option></select>
        <select class="a-key" aria-label="${i + 1}번 소재 배경 빼기" title="자동: 테두리가 초록이면 그린백으로 보고 뺍니다"><option value="auto">배경: 자동</option><option value="green">그린백 빼기</option><option value="none">그대로</option></select>
        <select class="a-fit" aria-label="${i + 1}번 소재 맞춤"><option value="contain">전체 보이기</option><option value="cover">화면 채우기</option></select>
      </div>
      <div class="a-row a-sliders">
        <label>크기<input class="a-scale" type="range" min="10" max="300" value="${pct(a.scale ?? 1)}"></label>
        <label>가로<input class="a-x" type="range" min="-50" max="50" value="${pct(a.x || 0)}"></label>
        <label>세로<input class="a-y" type="range" min="-50" max="50" value="${pct(a.y || 0)}"></label>
        <label>불투명<input class="a-op" type="range" min="0" max="100" value="${pct(a.opacity ?? 1)}"></label>
      </div></div>
      <div class="a-tools">
        <button class="icon ghost a-hide" title="숨기기" aria-pressed="${a.hidden ? 'true' : 'false'}" aria-label="${i + 1}번 소재 숨기기">◐</button>
        <button class="icon ghost a-del" title="삭제" aria-label="${i + 1}번 소재 삭제">✕</button>
      </div>`;
    const q = s => li.querySelector(s);
    q('.a-kind').value = a.kind || 'overlay';
    q('.a-layer').value = a.layer || 'back'; q('.a-key').value = a.key || 'auto'; q('.a-fit').value = a.fit || 'contain';
    if (A) { const tc = q('.a-thumb'), tx = tc.getContext('2d'), k = Math.min(tc.width / A.w, tc.height / A.h); tx.drawImage(A.img, (tc.width - A.w * k) / 2, (tc.height - A.h * k) / 2, A.w * k, A.h * k); }
    const set = (patch, again) => { Object.assign(a, patch); flushSave(); S.need = true; if (again) J.assetPrepare(a).then(() => { renderAssets(); S.need = true; }); };
    q('.a-layer').addEventListener('change', e => set({ layer: e.target.value }));
    q('.a-kind').addEventListener('change', e => {
      const subject = e.target.value === 'subject';
      set(Object.assign({ kind: e.target.value }, subject ? { fit: 'cover' } : {}), true);
      renderAssets();
      if (subject && !(A && A.mask)) toast('「피사체 편집」에서 가사 앞에 둘 피사체를 칠하거나 AI로 고르세요');
    });
    if (q('.a-mask')) q('.a-mask').addEventListener('click', () => openMaskEditor(a));
    q('.a-key').addEventListener('change', e => set({ key: e.target.value }, true));
    q('.a-fit').addEventListener('change', e => set({ fit: e.target.value }));
    for (const [cls, k, f] of [['.a-scale', 'scale', v => v / 100], ['.a-x', 'x', v => v / 100], ['.a-y', 'y', v => v / 100], ['.a-op', 'opacity', v => v / 100]])
      q(cls).addEventListener('input', e => set({ [k]: f(+e.target.value) }));
    q('.a-hide').addEventListener('click', () => { set({ hidden: !a.hidden }); renderAssets(); });
    q('.a-del').addEventListener('click', () => {
      if (!window.confirm(`「${a.name}」 소재를 지울까요?`)) return;
      removeAsset(a);
    });
    ol.appendChild(li);
  });
}
/* ---- 피사체 편집: the mask = (AI selection ∪ painted) − erased, at the image's resolution ---- */
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
// the AI model is downloaded only after this dialog is accepted (remembered in this browser until 초기화)
function mlConsent() {
  try { if (localStorage.getItem('jizura.mlConsent') === '1') return Promise.resolve(true); } catch (e) {}
  let dlg = $('mlDlg');
  if (!dlg) {
    dlg = document.createElement('dialog'); dlg.id = 'mlDlg'; dlg.className = 'terms'; dlg.setAttribute('aria-labelledby', 'mlTitle');
    dlg.innerHTML = `<h2 id="mlTitle">AI 피사체 선택</h2>
      <p>이 기능은 Google MediaPipe의 이미지 분할 모델(약 30MB)과 실행 파일(약 10MB)을 <strong>인터넷에서 내려받아</strong> 씁니다.</p>
      <ul class="reset-list"><li>내려받는 곳: cdn.jsdelivr.net, storage.googleapis.com</li>
        <li>사진은 내려받은 모델로 이 브라우저 안에서만 처리되며, 어디에도 보내지 않습니다.</li>
        <li>동의하지 않아도 브러시로 직접 칠해서 쓸 수 있습니다.</li></ul>
      <p class="terms-sub">동의는 이 브라우저에 기억됩니다(초기화하면 지워집니다).</p>
      <div class="outbtns"><button class="ghost ml-no">취소</button><button class="primary ml-yes">동의하고 내려받기</button></div>`;
    document.body.appendChild(dlg);
  }
  return new Promise(res => {
    const done = ok => { dlg.close(); if (ok) { try { localStorage.setItem('jizura.mlConsent', '1'); } catch (e) {} } res(ok); };
    dlg.querySelector('.ml-yes').onclick = () => done(true);
    dlg.querySelector('.ml-no').onclick = () => done(false);
    dlg.oncancel = () => res(false);
    dlg.showModal();
  });
}
function openMaskEditor(a) {
  const A = J.ASSETS.get(a.id); if (!A) return;
  let dlg = $('maskDlg');
  if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'maskDlg'; dlg.className = 'terms mask-dlg'; dlg.setAttribute('aria-labelledby', 'maskTitle'); document.body.appendChild(dlg); }
  dlg.innerHTML = `<h2 id="maskTitle">피사체 편집 — ${escapeHtml(a.name)}</h2>
    <div class="mask-tools">
      <button class="m-ai" aria-pressed="false" title="피사체를 클릭하면 AI가 골라 줍니다. Shift+클릭(또는 우클릭)은 빼기">AI 자동 선택</button>
      <button class="m-add" aria-pressed="true">칠하기</button>
      <button class="m-erase" aria-pressed="false">지우기</button>
      <label class="m-size-l">브러시<input class="m-size" type="range" min="4" max="200" value="40"></label>
      <button class="ghost m-clear">전부 지우기</button>
    </div>
    <p class="note m-hint">밝게 보이는 부분이 가사 앞에 다시 그려지는 피사체입니다. 칠하기/지우기로 다듬으세요.</p>
    <div class="mask-wrap"><canvas class="mask-view" width="${A.w}" height="${A.h}"></canvas></div>
    <div class="outbtns"><button class="ghost m-cancel">취소</button><button class="primary m-done">완료</button></div>`;
  const q = s => dlg.querySelector(s), view = q('.mask-view'), vx = view.getContext('2d'), W = A.w, H = A.h;
  const ai = mkCanvas(W, H), add = mkCanvas(W, H), erase = mkCanvas(W, H), mask = mkCanvas(W, H), tint = mkCanvas(W, H);
  if (A.mask) add.getContext('2d').drawImage(A.mask, 0, 0, W, H);         // earlier edits stay editable
  let tool = 'add', seg = null, points = [], last = null;
  const compose = () => {
    const m = mask.getContext('2d'); m.globalCompositeOperation = 'copy'; m.drawImage(ai, 0, 0);
    m.globalCompositeOperation = 'source-over'; m.drawImage(add, 0, 0);
    m.globalCompositeOperation = 'destination-out'; m.drawImage(erase, 0, 0); m.globalCompositeOperation = 'source-over';
    return mask;
  };
  const draw = () => {
    compose();
    vx.globalCompositeOperation = 'copy'; vx.drawImage(A.img, 0, 0);
    vx.globalCompositeOperation = 'source-over'; vx.fillStyle = 'rgba(0,0,0,0.62)'; vx.fillRect(0, 0, W, H);
    const t = tint.getContext('2d'); t.globalCompositeOperation = 'copy'; t.drawImage(A.img, 0, 0);
    t.globalCompositeOperation = 'destination-in'; t.drawImage(mask, 0, 0);
    t.globalCompositeOperation = 'source-atop'; t.fillStyle = 'rgba(245,165,12,0.18)'; t.fillRect(0, 0, W, H);
    vx.drawImage(tint, 0, 0);
  };
  const setTool = k => { tool = k; for (const [c, v] of [['.m-add', 'add'], ['.m-erase', 'erase'], ['.m-ai', 'ai']]) q(c).setAttribute('aria-pressed', String(tool === v)); };
  const toImg = e => { const r = view.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height, W / r.width]; };
  const paint = (x, y, k) => {
    const [on, off] = tool === 'add' ? [add, erase] : [erase, add], r = +q('.m-size').value * k;
    for (const [c, op] of [[on, 'source-over'], [off, 'destination-out']]) {
      const g = c.getContext('2d'); g.globalCompositeOperation = op; g.strokeStyle = g.fillStyle = '#fff'; g.lineWidth = r; g.lineCap = 'round';
      g.beginPath(); if (last) { g.moveTo(last[0], last[1]); g.lineTo(x, y); g.stroke(); } else { g.arc(x, y, r / 2, 0, 7); g.fill(); }
    }
    last = [x, y]; draw();
  };
  view.addEventListener('contextmenu', e => e.preventDefault());
  view.addEventListener('pointerdown', e => {
    const [x, y, k] = toImg(e);
    if (tool === 'ai') {
      if (!seg) return;
      points.push({ x: x / W, y: y / H, neg: e.shiftKey || e.button === 2 });
      try { const r = J.segmentPoints(seg, points, W, H), g = ai.getContext('2d'); g.globalCompositeOperation = 'copy'; g.drawImage(r, 0, 0); }
      catch (err) { console.warn(err); toast('AI 선택에 실패했습니다'); }
      draw(); return;
    }
    view.setPointerCapture(e.pointerId); last = null; paint(x, y, k);
  });
  view.addEventListener('pointermove', e => { if (last && tool !== 'ai') { const [x, y, k] = toImg(e); paint(x, y, k); } });
  const end = () => { last = null; };
  view.addEventListener('pointerup', end); view.addEventListener('pointercancel', end);
  q('.m-add').onclick = () => setTool('add');
  q('.m-erase').onclick = () => setTool('erase');
  q('.m-clear').onclick = () => { for (const c of [ai, add, erase]) c.getContext('2d').clearRect(0, 0, W, H); points = []; draw(); };
  q('.m-ai').onclick = async () => {
    if (seg) { setTool('ai'); return; }
    if (!(await mlConsent())) return;
    q('.m-hint').textContent = 'AI 모델을 내려받는 중…(처음 한 번은 수십 초 걸릴 수 있습니다)';
    try {
      seg = await J.loadSegmenter(); seg.setImage(A.img);
      setTool('ai'); q('.m-hint').textContent = '피사체를 클릭하세요. Shift+클릭(또는 우클릭)은 그 부분을 뺍니다. 칠하기/지우기로 이어서 다듬을 수 있습니다.';
    } catch (err) { console.warn(err); seg = null; q('.m-hint').textContent = 'AI 모델을 불러오지 못했습니다(인터넷 연결을 확인하세요). 브러시로 칠해서 쓸 수 있습니다.'; }
  };
  q('.m-cancel').onclick = () => dlg.close();
  q('.m-done').onclick = async () => {
    await J.assetSetMask(a, compose());
    dlg.close(); renderAssets(); S.need = true; toast('피사체를 저장했습니다');
  };
  draw(); dlg.showModal();
}
async function addAssetFiles(files) {
  for (const f of files) {
    try { const a = await J.assetAdd(f); S.project.assets.push(a); await J.assetPrepare(a); }
    catch (e) { toast(`「${f.name}」을(를) 불러오지 못했습니다: ${e.message || e}`); }
  }
  replan(); flushSave(); renderAssets();
}
function removeAsset(a) {
  S.project.assets = S.project.assets.filter(x => x.id !== a.id);
  queueAssetDeletion(a.id);
  replan(); flushSave(); renderAssets();
}
async function prepareAssets() {
  await Promise.all(S.project.assets.map(a => J.assetPrepare(a).catch(() => null)));
  S.need = true; renderAssets();
}

// replace the project; 소재 and 배경·전경 files the new one does not use are queued for deletion (Ctrl+Z can still bring
// the previous project back with its files; they go on pagehide / next start when no current setting uses them).
// A file saved with 「곡·소재 포함 저장」 carries p.bundle (older files: p.media with .files and no .items):
// its files go into this browser's storage first.
// (project.media is also the 背景 cut settings, which have items[] and no files{}: only the bundle form is taken out)
async function openProject(p) {
  let bundle = p && p.bundle;
  if (!bundle && p && p.media && p.media.files && !Array.isArray(p.media.items)) { bundle = p.media; delete p.media; }
  if (p) delete p.bundle;
  if (bundle) {
    for (const [k, r] of Object.entries(bundle.files || {})) await J.idbPut(k, { name: r.name, type: r.type, data: fromB64(r.data) });
    for (const [id, r] of Object.entries(bundle.mediaFiles || {})) await J.storeMedia(id, new File([fromB64(r.data)], r.name, { type: r.type || '' }));
  }
  const mediaIds = P => [...P.media.items, ...P.foreground.items].map(item => item.id);
  const old = S.project.assets.map(a => a.id), oldMedia = mediaIds(S.project);
  S.project = mergeProject(p); syncUI(); replan();
  const keep = new Set(S.project.assets.map(a => a.id)), keepMedia = new Set(mediaIds(S.project));
  for (const id of old) if (!keep.has(id)) queueAssetDeletion(id);
  for (const id of oldMedia) if (!keepMedia.has(id)) queueMediaDeletion(id);
  await prepareAssets();
  await Promise.all([restoreMediaAssets(), restoreFonts()]); fontKey = ''; ensureFonts();
  if (bundle && bundle.song) {
    const f = new File([fromB64(bundle.song.data)], bundle.song.name, { type: bundle.song.type || '' }), snap = S.project.timing.snap;
    S.audio = null;
    if (await loadAudioFile(f)) { S.project.timing.snap = snap; replan(); }
  }
  flushSave();
}

/* ---------------- 곡·소재 포함 저장: the project plus the song and every 소재 file, base64 in one .json ---------------- */
const toB64 = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = b64 => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
async function saveBundle() {
  showMsg('곡과 소재를 모으는 중…');
  try {
    const bundle = { version: 2, files: {}, mediaFiles: {} };
    const song = S.audio && J.loadSong ? await J.loadSong() : null;
    const hasSong = !!(song && song.name === S.project.audioName);
    if (hasSong) bundle.song = { name: song.name, type: song.type, data: toB64(await song.arrayBuffer()) };
    for (const a of S.project.assets) for (const k of ['asset:', 'mask:']) {
      const r = await J.idbGet(k + a.id);
      if (r) bundle.files[k + a.id] = { name: r.name, type: r.type, data: toB64(r.data) };
    }
    for (const item of [...S.project.media.items, ...S.project.foreground.items]) {
      const f = await J.loadMedia(item.id).catch(() => null);
      if (f) bundle.mediaFiles[item.id] = { name: item.name, type: f.type || '', data: toB64(await f.arrayBuffer()) };
    }
    const text = JSON.stringify(Object.assign({}, S.project, { bundle }));
    showMsg(null);
    await J.saveFile(baseName() + '_all.jizura.json', text);
    toast(`저장했습니다(${(text.length / 1048576).toFixed(1)}MB${hasSong ? ' · 곡 포함' : ''} · 소재 ${S.project.assets.length}개 · 배경·전경 ${Object.keys(bundle.mediaFiles).length}개)` + (S.audio && !hasSong ? '. 곡은 이 브라우저에 보관되지 않아 빠졌습니다' : ''));
  } catch (e) { showMsg(null); toast('저장하지 못했습니다: ' + (e.message || e)); }
}

/* ---------------- 곡에서 초안 ---------------- */
async function draftFromSong() {
  if (!S.audio) { toast('먼저 곡을 불러오세요'); return; }
  const lines = S.plan.lines; if (!lines.length || S.tap) return;
  showMsg('곡에서 행의 시작을 찾는 중…');
  let ts = [];
  try { ts = await J.draftLineStarts(S.audio, lines.map(l => l.text)); } catch (e) { console.warn(e); }
  showMsg(null);
  if (ts.length !== lines.length) { toast('곡에서 행의 시작을 찾지 못했습니다'); return; }
  const base = lineShiftBase();
  S.project.timing.lineTimes = {}; ts.forEach((t, i) => { S.project.timing.lineTimes[i] = t; });
  replan(); followLineStarts(base); flushSave();
  toast(`${lines.length}행의 시작을 곡에서 추정했습니다(초안). 어긋난 행은 ◎ Shift+클릭이나 타임라인으로 고치세요. Ctrl+Z로 되돌릴 수 있습니다`);
}

/* ---------------- tap sync ---------------- */
// start from any line: playback begins a little before that line, earlier lines keep their times
// (single: only that one line is re-tapped, then tap sync ends). On the 前景 / 背景 tabs the media cuts are tapped from the first.
function startTap(from = 0, single = false) {
  const layer = activeMediaLayer();
  if (!(layer ? S.plan[layer].cuts.length || S.project[layer].loop : S.plan.lines.length)) return;
  if (layer) { from = 0; single = false; }
  else from = J.clamp(from | 0, 0, S.plan.lines.length - 1);
  S.tap = { i: from, from, done: [], single, layer, append: !!layer && S.project[layer].loop, base: layer ? null : lineShiftBase() };
  if (!S.project.timing.lineTimes) S.project.timing.lineTimes = {};
  $('tapHint').textContent = S.tap.append ? '탭할 때마다 배경·전경 파일을 순환하며 컷을 추가합니다. 종료할 때까지 계속할 수 있습니다.' : '곡에 맞춰 각 행·컷이 시작되는 순간 Space나 버튼을 누르세요.';
  $('tapPanel').hidden = false; $('btnTap').setAttribute('aria-pressed', 'true');
  $('tapPanel').classList.remove('compact');
  let t0 = 0;
  if (!layer && from > 0) {
    const prev = S.plan.lines[from - 1], cur = S.plan.lines[from];
    t0 = Math.max(0, prev.start + 0.01, cur.start - 2.5);      // a little before the line, never before the previous one
  }
  if (S.tap.append && !S.audio) extendTapPreview(0);
  seek(t0); play(); updateTap();
  $('tapBtn').focus();
  if (single) toast(`${from + 1}행만 다시 탭합니다(${J.fmtTime(t0)}부터 재생)`);
  else if (from > 0) toast(`${from + 1}행부터 탭으로 동기화합니다(${J.fmtTime(t0)}부터 재생)`);
}
function tapNow() {
  if (!S.tap) return;
  if (S.tap.append) {
    const i = S.tap.i;
    const m = S.project[S.tap.layer];
    if (i === 0) { m.timing.lineTimes = {}; m.cutOverrides = {}; m.manualCuts = true; }
    m.cutCount = i + 1;
    const order = J.mediaOrder(S.project, S.tap.layer);
    m.cutOverrides[i] = { itemId: order.length ? order[i % order.length].id : null };
    m.timing.lineTimes[i] = +S.t.toFixed(3);
    S.tap.i++;
    replan();
    if (S.tap.i >= 1000) { pause(); stopTap(); toast('컷 수 상한에 도달했습니다'); }
    else updateTap();
    return;
  }
  const layer = S.tap.layer, LT = (layer ? S.project[layer].timing : S.project.timing).lineTimes, i = S.tap.i, t = +S.t.toFixed(3);
  S.tap.done.push({ i, had: LT[i] });
  LT[i] = t;
  // later lines tapped earlier (a previous pass) must not come before this one
  if (!layer) for (const k of Object.keys(LT)) if (+k > i && LT[k] <= t + 0.2) delete LT[k];
  S.tap.i++;
  if (S.tap.single) { stopTap(); toast(`${i + 1}행의 시작을 ${J.fmtTime(t)}로 맞췄습니다`); return; }
  replan(); followLineStarts(S.tap.base);
  if (S.tap.i >= (layer ? S.plan[layer].cuts.length : S.plan.lines.length)) stopTap(); else updateTap();
}
function tapBack() {                    // 1つ戻る: undo the last tap and jump back a little
  if (!S.tap || !S.tap.done.length) return;
  const d = S.tap.done.pop(), LT = (S.tap.layer ? S.project[S.tap.layer].timing : S.project.timing).lineTimes;
  if (d.had != null) LT[d.i] = d.had; else delete LT[d.i];
  S.tap.i = d.i; replan(); followLineStarts(S.tap.base); updateTap();
  seek(Math.max(0, S.t - 3)); if (!S.playing) play();
}
function stopTap() { const base = S.tap && S.tap.base; S.tap = null; $('tapPanel').hidden = true; $('btnTap').setAttribute('aria-pressed', 'false'); replan(); followLineStarts(base); flushSave(); }
function updateTap() {
  const bb = $('tapBack'); if (bb) bb.disabled = !S.tap.done.length;
  $('tapPanel').classList.toggle('compact', S.tap.done.length > 0);   // 最初の数回が終わったら説明を畳んで、固定しても邪魔にならないように
  if (S.tap.append) {
    const order = J.mediaOrder(S.project, S.tap.layer);
    $('tapLine').textContent = `${S.tap.i + 1}. ${order.length ? order[S.tap.i % order.length].name : '이미지 없음'}`; return;
  }
  const ln = S.tap.layer ? S.plan[S.tap.layer].cuts[S.tap.i] : S.plan.lines[S.tap.i];
  $('tapLine').textContent = ln ? `${S.tap.i + 1}. ${S.tap.layer ? ln.name : ln.interlude ? '[간주]' : ln.text}${S.tap.single ? ' (이 행만)' : ''}` : '—';
}

/* ---------------- sync all inputs from project ---------------- */
function syncUI() {
  $('songTitle').value = S.project.title || ''; $('songArtist').value = S.project.artist || '';
  $('lyrics').value = S.project.lyrics;
  $('aiPrompt').value = S.project.aiPrompt || '';
  $('bpm').value = S.project.timing.bpm > 0 ? S.project.timing.bpm : '';
  $('bpm').placeholder = S.audio ? `자동 ${S.audio.bpm}` : '없음';
  $('offset').value = S.project.timing.offset ?? 0.4;
  $('lineScale').value = S.project.timing.lineScale ?? 1;
  $('snap').checked = !!S.project.timing.snap;
  document.querySelectorAll('.wa-toggle').forEach(el => { el.checked = S.project.wa !== false; });
  document.querySelectorAll('.extra-toggle').forEach(el => { el.checked = S.project.extra === true; });
  for (const set of J.SET_ORDER) document.querySelectorAll('.' + set + '-toggle').forEach(el => { el.checked = J.setOn(S.project, set); });
  document.querySelectorAll('.unify-toggle').forEach(el => { el.checked = S.project.unify === true; });
  document.querySelectorAll('.typeset-toggle').forEach(el => { el.checked = S.project.typeset === true; });
  $('lyricLang').value = J.LANG_LABEL[S.project.lang] ? S.project.lang : 'auto'; langNote();
  renderFontRoles(); renderColors(); renderFx(); renderTech(); syncOut(); drawStyleGrid();
}

/* ---------------- wiring ---------------- */
function bind() {
  $('timelineZoomOut').addEventListener('click', () => setTimelineZoom(S.timelineZoom / 1.5));
  $('timelineZoomIn').addEventListener('click', () => setTimelineZoom(S.timelineZoom * 1.5));
  $('timelineZoomOut').disabled = true;
  $('sourceLyrics').addEventListener('click', () => { cancelAreaEditor(); S.sourceTab = 'lyrics'; syncSourceTab(); });
  $('sourceMedia').addEventListener('click', () => { cancelAreaEditor(); S.sourceTab = 'media'; renderMediaList(); renderMediaLines(); });
  $('sourceForeground').addEventListener('click', () => { cancelAreaEditor(); S.sourceTab = 'foreground'; renderMediaList(); renderMediaLines(); });
  const areaOverlay = $('areaEditOverlay');
  areaOverlay.addEventListener('pointerdown', e => {
    if (!S.areaEdit) return;
    const handle = e.target.closest('[data-handle]'), mode = handle ? handle.dataset.handle : mediaHit(e);
    if (!mode) return;
    e.preventDefault(); areaOverlay.setPointerCapture(e.pointerId);
    S.areaEdit.drag = { start: mediaPointer(e), previous: { ...S.areaEdit.draft }, previousAngle: S.areaEdit.angle, pointerAngle: mediaPointerAngle(e, S.areaEdit.draft), handle: mode };
    areaOverlay.style.cursor = mode === 'rotate' ? 'var(--rotate-cursor)' : '';
    $('areaEditRect').style.cursor = mode === 'rotate' ? 'var(--rotate-cursor)' : '';
  });
  areaOverlay.addEventListener('pointermove', e => {
    if (!S.areaEdit) return;
    if (S.areaEdit.drag) moveMediaDraft(e);
    else {
      const mode = mediaHit(e), cursor = mode === 'rotate' ? 'var(--rotate-cursor)' : mode === 'move' ? 'move' : 'default';
      areaOverlay.style.cursor = cursor; $('areaEditRect').style.cursor = cursor;
    }
  });
  areaOverlay.addEventListener('pointerup', e => {
    if (!S.areaEdit) return;
    S.areaEdit.drag = null; areaOverlay.style.cursor = ''; $('areaEditRect').style.cursor = '';
  });
  areaOverlay.addEventListener('pointercancel', () => { if (!S.areaEdit) return; if (S.areaEdit.drag) { S.areaEdit.draft = S.areaEdit.drag.previous; S.areaEdit.angle = S.areaEdit.drag.previousAngle; } S.areaEdit.drag = null; areaOverlay.style.cursor = ''; $('areaEditRect').style.cursor = ''; showAreaDraft(); });
  $('mediaAreaAspectLock').addEventListener('change', e => { if (!S.areaEdit) return; S.areaEdit.lockAspect = e.target.checked; if (e.target.checked) S.areaEdit.ratio = S.areaEdit.draft.h / S.areaEdit.draft.w; showAreaDraft(); });
  $('mediaAreaWidth').addEventListener('change', e => { if (!S.areaEdit) return; const w = J.clamp(+e.target.value / 100, 0.005, S.areaEdit.kind === 'lyric' ? 1 : 4); setMediaDraftSize(w, S.areaEdit.lockAspect ? w * S.areaEdit.ratio : S.areaEdit.draft.h); });
  $('mediaAreaHeight').addEventListener('change', e => { if (!S.areaEdit) return; const h = J.clamp(+e.target.value / 100, 0.005, S.areaEdit.kind === 'lyric' ? 1 : 4); setMediaDraftSize(S.areaEdit.lockAspect ? h / S.areaEdit.ratio : S.areaEdit.draft.w, h); });
  $('mediaAreaAngle').addEventListener('input', e => { if (!S.areaEdit || e.target.value === '') return; S.areaEdit.angle = J.clamp(+e.target.value || 0, -180, 180); showAreaDraft(); });
  $('areaResetFull').addEventListener('click', () => { if (!S.areaEdit || S.areaEdit.kind !== 'lyric') return; S.areaEdit.draft = { x: 0, y: 0, w: 1, h: 1 }; S.areaEdit.ratio = 1; S.areaEdit.angle = 0; showAreaDraft(); });
  $('areaApplyOne').addEventListener('click', () => applyAreaEditor(false));
  $('areaApplyFollowing').addEventListener('click', () => applyAreaEditor(true));
  $('areaCancel').addEventListener('click', cancelAreaEditor);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.areaEdit) { e.preventDefault(); cancelAreaEditor(); } });
  $('mediaFiles').addEventListener('change', async e => { const files = Array.from(e.target.files || []); e.target.value = ''; await addMediaFiles(files, activeMediaLayer() || 'media'); });
  const mediaPane = $('mediaPane');
  const hasFiles = e => Array.from(e.dataTransfer && e.dataTransfer.types || []).includes('Files');
  mediaPane.addEventListener('dragover', e => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; mediaPane.classList.add('media-drop-active'); });
  mediaPane.addEventListener('dragleave', e => { if (!mediaPane.contains(e.relatedTarget)) mediaPane.classList.remove('media-drop-active'); });
  mediaPane.addEventListener('drop', async e => {
    if (!hasFiles(e)) return;
    e.preventDefault(); mediaPane.classList.remove('media-drop-active');
    await addMediaFiles(Array.from(e.dataTransfer.files || []), activeMediaLayer() || 'media');
  });
  $('mediaRandom').addEventListener('change', e => { S.project[activeMediaLayer()].randomOrder = e.target.checked; replan(); });
  $('mediaLoop').addEventListener('change', e => {
    const m = S.project[activeMediaLayer()]; m.loop = e.target.checked;
    if (e.target.checked && !m.cutCount) m.cutCount = Math.min(1000, m.items.length * 2);
    replan();
  });
  $('mediaCutCount').addEventListener('change', e => {
    const layer = activeMediaLayer(), m = S.project[layer], count = J.clamp(Math.floor(+e.target.value || 0), 0, 1000);
    if (count !== S.plan[layer].cuts.length) {
      freezeMediaCuts(layer);
      for (let i = m.cutCount; i < count; i++) m.cutOverrides[i] = { itemId: null };
      for (const key of Object.keys(m.cutOverrides)) if (+key >= count) delete m.cutOverrides[key];
      for (const key of Object.keys(m.timing.lineTimes)) if (+key >= count) delete m.timing.lineTimes[key];
    }
    m.cutCount = count;
    replan();
  });
  $('lyricBlend').addEventListener('change', e => { S.project.media.blend = e.target.value; replan(); });
  $('lyricOpacity').addEventListener('change', e => { S.project.media.opacity = J.clamp(+e.target.value || 0, 0, 100); replan(); });
  $('mediaBlend').addEventListener('change', e => { S.project.foreground.blend = e.target.value; replan(); });
  $('mediaOpacity').addEventListener('change', e => { S.project.foreground.opacity = J.clamp(+e.target.value || 0, 0, 100); replan(); });
  $('lyrics').addEventListener('input', e => {
    const changedCount = reconcileLyricLines(S.project.lyrics, e.target.value);
    S.project.lyrics = e.target.value;
    markUndoGroup('lyrics');
    if (changedCount) { clearTimeout(replanTimer); replan(); }
    else replanSoon(260);
  });
  $('aiPrompt').addEventListener('input', e => { S.project.aiPrompt = e.target.value; markUndoGroup('aiPrompt'); autosave(); });
  $('lyricLang').addEventListener('change', e => {
    remember();
    S.project.lang = e.target.value; replan(); renderFontRoles(); commit(); flushSave();
    const l = J.resolveLang(S.project);
    toast((S.project.lang === 'auto' ? '가사 언어: 자동 판정 → ' : '가사 언어: ') + J.LANG_LABEL[l]);
  });
  $('songTitle').addEventListener('input', e => { S.project.title = e.target.value; markUndoGroup('title'); replanSoon(300); });
  $('songArtist').addEventListener('input', e => { S.project.artist = e.target.value; markUndoGroup('artist'); replanSoon(300); });
  $('btnSyntax').addEventListener('click', e => { const s = $('syntax'); s.hidden = !s.hidden; e.target.setAttribute('aria-expanded', String(!s.hidden)); });
  $('bpm').addEventListener('change', e => { S.project.timing.bpm = Math.max(0, parseFloat(e.target.value) || 0); replan(); });
  $('offset').addEventListener('change', e => { S.project.timing.offset = Math.max(0, parseFloat(e.target.value) || 0); replan(); });
  $('lineScale').addEventListener('change', e => { S.project.timing.lineScale = J.clamp(parseFloat(e.target.value) || 1, 0.3, 4); replan(); });
  $('snap').addEventListener('change', e => { S.project.timing.snap = e.target.checked; replan(); });
  $('btnResetTimes').addEventListener('click', () => { const layer = activeMediaLayer(), timing = layer ? S.project[layer].timing : S.project.timing; timing.lineTimes = {}; if (!layer) timing.cutTimes = {}; replan(); });
  $('audioFile').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) loadAudioFile(f); });
  $('btnRemoveAudio').addEventListener('click', removeAudio);
  $('btnTap').addEventListener('click', () => (S.tap ? stopTap() : startTap()));
  $('btnDraft').addEventListener('click', draftFromSong);
  $('assetFile').addEventListener('change', e => { const fs = [...e.target.files]; e.target.value = ''; if (fs.length) addAssetFiles(fs); });
  $('tapBtn').addEventListener('click', tapNow);
  $('tapStop').addEventListener('click', () => { pause(); stopTap(); });
  $('btnPlay').addEventListener('click', () => (S.playing ? pause() : play()));
  $('btnUndo').addEventListener('click', () => undoMove(-1));
  $('btnRedo').addEventListener('click', () => undoMove(1));
  const cutPickAuto = $('cutPickAuto'), cutPickClose = $('cutPickClose');
  if (cutPickClose) cutPickClose.addEventListener('click', () => { closeCutPick(); updateCutInfo(); });
  if (cutPickAuto) cutPickAuto.addEventListener('click', () => {
    if (!cutPick.g) return;
    setCutTech(cutPick.line, cutPick.k, cutPick.g, '');
    replan();
  });
  $('btnLoop').addEventListener('click', () => {
    const i = LOOP_CYCLE.indexOf(S.loop);
    S.loop = LOOP_CYCLE[(i < 0 ? 0 : i + 1) % LOOP_CYCLE.length];
    syncLoopBtn(); S.need = true;
  });
  $('btnShuffle').addEventListener('click', () => { remember(); S.project.seed = (Math.random() * 1e9) | 0; $('seed').value = S.project.seed; replan(); commit(); });
  const sc = $('scrub');
  sc.addEventListener('input', () => { S.scrubbing = true; seek(sc.value / 10000 * S.plan.duration); });
  sc.addEventListener('change', () => { S.scrubbing = false; });
  const durationValue = $('timeDur'), durationInput = $('timeDurInput'), durationHandle = $('timelineDurationHandle');
  const closeDurationInput = save => {
    if (durationInput.hidden) return;
    const raw = durationInput.value.trim();
    durationInput.hidden = true; durationValue.hidden = false;
    if (save) setProjectDuration(raw ? parseProjectDuration(raw) : null);
    updateTimeUI();
  };
  durationValue.addEventListener('click', () => {
    if (S.exporting || S.tap) return;
    pause(); durationValue.hidden = true; durationInput.hidden = false;
    durationInput.value = J.fmtTime(S.plan.duration); durationInput.focus(); durationInput.select();
  });
  durationInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); closeDurationInput(true); }
    else if (e.key === 'Escape') { e.preventDefault(); closeDurationInput(false); }
  });
  durationInput.addEventListener('blur', () => closeDurationInput(true));
  durationHandle.addEventListener('pointerdown', e => {
    if (S.exporting || S.tap) return;
    e.preventDefault();
    closeDurationInput(false); pause();
    S.durationDrag = { pointerId: e.pointerId, originX: e.clientX, originDuration: S.plan.duration, preview: S.plan.duration, moved: false };
    durationHandle.setPointerCapture(e.pointerId);
    durationHandle.classList.add('dragging');
  });
  durationHandle.addEventListener('pointermove', e => {
    const drag = S.durationDrag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const width = Math.max(1, $('timelineStack').clientWidth);
    if (Math.abs(e.clientX - drag.originX) >= 2) drag.moved = true;
    drag.preview = Math.round(J.clamp(drag.originDuration * (1 + (e.clientX - drag.originX) / width), minimumProjectDuration(), 21600) * 100) / 100;
    durationHandle.style.transform = `translateX(${(drag.preview / drag.originDuration - 1) * width}px)`;
    updateTimeUI();
  });
  durationHandle.addEventListener('pointerup', e => {
    const drag = S.durationDrag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    S.durationDrag = null; durationHandle.classList.remove('dragging'); durationHandle.style.transform = '';
    if (drag.moved) setProjectDuration(drag.preview);
    else durationValue.click();
    updateTimeUI();
  });
  durationHandle.addEventListener('pointercancel', () => {
    S.durationDrag = null; durationHandle.classList.remove('dragging'); durationHandle.style.transform = ''; updateTimeUI();
  });
  for (const tl of [$('timeline'), $('mediaTimeline'), $('foregroundTimeline')]) {
    const layer = tl.id === 'timeline' ? 'lyrics' : tl.id === 'foregroundTimeline' ? 'foreground' : 'media';
    let drag = null, raf = 0;
    tl.addEventListener('pointerdown', e => {
      // lyric timeline: the line-start handles in the top band (snap to the beat; Shift: free)
      const h = layer === 'lyrics' && !S.tap && !S.exporting ? tlHandleAt(e) : -1;
      if (h >= 0) { tl.setPointerCapture(e.pointerId); TL.drag = h; TL.base = lineShiftBase(); pause(); tl.style.cursor = 'ew-resize'; drag = { mode: 'handle' }; return; }
      const boundary = !S.exporting && !S.tap && timelineBoundaryAt(e, layer);
      const limits = boundary && boundaryGroupLimits(boundary.ref);
      drag = boundary && limits && limits.max > limits.min ? { ...boundary, min: limits.min, max: limits.max, mode: 'boundary', originX: e.clientX, preview: boundary.start, moved: false, duration: S.plan.duration } : { mode: 'seek' };
      tl.setPointerCapture(e.pointerId);
      if (boundary) { pause(); S.timelineDrag = drag; }
      else timelineSeek(e);
    });
    tl.addEventListener('pointermove', e => {
      if (drag && drag.mode === 'handle') { const ev = { clientX: e.clientX, clientY: e.clientY, shiftKey: e.shiftKey }, i = TL.drag; cancelAnimationFrame(raf); raf = requestAnimationFrame(() => tlDragTo(i, ev)); return; }
      if (!drag && layer === 'lyrics') {
        const hv = S.tap || S.exporting ? -1 : tlHandleAt(e);
        if (hv !== TL.hover) { TL.hover = hv; drawTimeline(); }
        if (hv >= 0) { tl.style.cursor = 'ew-resize'; return; }
      }
      if (!drag) { tl.style.cursor = !S.exporting && !S.tap && timelineBoundaryAt(e, layer) ? 'ew-resize' : 'pointer'; return; }
      if (drag.mode === 'seek') { timelineSeek(e); return; }
      if (Math.abs(e.clientX - drag.originX) >= 3) drag.moved = true;
      if (!drag.moved) return;
      const rect = tl.getBoundingClientRect();
      drag.preview = J.clamp((e.clientX - rect.left) / rect.width * drag.duration, drag.min, drag.max);
      drawTimeline();
      drawTimelineLinks();
    });
    tl.addEventListener('pointerup', () => {
      if (!drag) return;
      if (drag.mode === 'handle') { cancelAnimationFrame(raf); TL.drag = -1; flushSave(); renderLines(); drawTimeline(); }
      else if (drag.mode === 'boundary') {
        S.timelineDrag = null;
        if (drag.moved) commitTimelineBoundary(drag);
        else seek(drag.start);
        drawTimeline();
        drawTimelineLinks();
      }
      drag = null;
    });
    tl.addEventListener('pointercancel', () => { if (drag && drag.mode === 'handle') { cancelAnimationFrame(raf); TL.drag = -1; flushSave(); renderLines(); } drag = null; S.timelineDrag = null; drawTimeline(); drawTimelineLinks(); });
    if (layer === 'lyrics') tl.addEventListener('pointerleave', () => { if (TL.hover >= 0 && TL.drag < 0) { TL.hover = -1; drawTimeline(); } });
  }
  // wheel over the lyric timeline zooms (Shift / sideways: the stack scrolls natively)
  $('timeline').addEventListener('wheel', e => {
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault(); setTimelineZoom(S.timelineZoom * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025)), e.clientX);
  }, { passive: false });
  $('tapBack').addEventListener('click', tapBack);
  bindRangeUI();
  const linkSvg = $('timelineLinks');
  linkSvg.addEventListener('pointerdown', e => {
    const action = e.target.closest('.timeline-action');
    if (action) { e.preventDefault(); e.stopPropagation(); performTimelineAction(action); return; }
    const remove = e.target.closest('.link-remove');
    if (remove) {
      e.preventDefault(); e.stopPropagation();
      S.project.timelineLinks.splice(+remove.dataset.edge, 1);
      drawTimelineLinks(); autosave();
      return;
    }
    const handle = e.target.closest('.link-handle');
    if (!handle || S.exporting || S.tap) return;
    e.preventDefault(); e.stopPropagation(); pause();
    const marker = timelineMarkers().find(m => m.ref === handle.dataset.ref);
    if (!marker) return;
    S.linkDrag = { source: marker.ref, sourceLayer: marker.layer, sourceX: marker.x, sourceY: marker.y, x: marker.x, y: marker.y };
    linkSvg.setPointerCapture(e.pointerId);
    drawTimelineLinks();
  });
  linkSvg.addEventListener('pointermove', e => {
    if (!S.linkDrag) return;
    const rect = $('timelineStack').getBoundingClientRect();
    S.linkDrag.x = e.clientX - rect.left; S.linkDrag.y = e.clientY - rect.top;
    drawTimelineLinks();
  });
  linkSvg.addEventListener('pointerup', e => {
    if (!S.linkDrag) return;
    const drag = S.linkDrag, target = markerNear(e.clientX, e.clientY, drag.sourceLayer);
    S.linkDrag = null;
    if (target) connectTimelineBoundaries(drag.source, target.ref);
    drawTimelineLinks();
  });
  linkSvg.addEventListener('pointercancel', () => { S.linkDrag = null; drawTimelineLinks(); });
  linkSvg.addEventListener('keydown', e => {
    const action = e.target.closest('.timeline-action');
    if (action && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); performTimelineAction(action); }
  });
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    document.querySelectorAll('.tabpane').forEach(p => { p.hidden = p.dataset.pane !== b.dataset.tab; });
    if (b.dataset.tab === 'out') codecNote();
    if (b.dataset.tab === 'tech') kickPreviewLoop();
    loadThumbFonts();
  }));
  $('fxFlash').addEventListener('change', e => { S.project.fx.flash = e.target.checked; replan(); });
  $('techFilter').addEventListener('input', () => renderTech());
  const setSwitch = (cls, key, on, msgOn, msgOff) => document.querySelectorAll('.' + cls).forEach(el => el.addEventListener('change', e => {
    remember();
    S.project[key] = e.target.checked;
    document.querySelectorAll('.' + cls).forEach(x => { x.checked = e.target.checked; });
    renderTech(); drawStyleGrid(); replan(); commit(); flushSave();
    toast(e.target.checked ? msgOn : msgOff);
  }));
  setSwitch('extra-toggle', 'extra', true, '추가 연출: 사용', '추가 연출: 사용 안 함 (초기 공개판 연출만)');
  setSwitch('wa-toggle', 'wa', true, '일본풍 연출: 사용', '일본풍 연출: 사용 안 함 (자동 생성·셔플에서 제외)');
  setSwitch('typo-toggle', 'typo', true, '文字PV系の部品：使う', '文字PV系の部品：使わない（おまかせ・シャッフルで選ばれません）');
  setSwitch('kinetic-toggle', 'kinetic', true, 'キネティックの部品：使う', 'キネティックの部品：使わない（おまかせ・シャッフルで選ばれません）');
  setSwitch('horror-toggle', 'horror', true, 'ホラーの演出：使う（おまかせの雰囲気に「ホラー」が加わります）', 'ホラーの演出：使わない');
  setSwitch('unify-toggle', 'unify', true, '통일감: 켬(파트별로 맞추고 킬링 파트·모프·굵기도 사용)', '통일감: 끔');
  setSwitch('typeset-toggle', 'typeset', true, '문자 정렬: 켬(자간·조사·영문·0.2초 먼저·효과 절제)', '문자 정렬: 끔');
  $('fxKoma').addEventListener('change', e => { const k = +e.target.value; S.project.fx.koma = k; S.project.fx.onTwos = k > 0; S.project.mood = null; replan(); });
  $('fxHud').addEventListener('change', e => { S.project.fx.hud = e.target.value; replan(); });
  $('fxInterCount').addEventListener('change', e => { S.project.fx.interCount = e.target.value; replan(); });
  $('fxInterCredit').addEventListener('change', e => { S.project.fx.interCredit = e.target.checked; replan(); });
  $('seed').addEventListener('change', e => { S.project.seed = parseInt(e.target.value, 10) || 0; replan(); });
  $('btnSeed').addEventListener('click', () => { S.project.seed = (Math.random() * 1e9) | 0; $('seed').value = S.project.seed; replan(); });
  const colorToggle = (flag, keys) => e => {
    remember();
    const c = S.project.colors; c[flag] = e.target.checked;
    if (c[flag]) { const sc0 = J.STYLES[S.project.style].schemes[0]; keys.forEach(([k]) => { if (!c[k]) c[k] = sc0[k]; }); }
    renderColors(); replan(); commit();
  };
  $('colorOn').addEventListener('change', colorToggle('enabled', BASE_KEYS));
  $('accentOn').addEventListener('change', colorToggle('accentOn', ACCENT_KEYS));
  $('btnRandPalette').addEventListener('click', randomPalette);
  $('btnAddFont').addEventListener('click', () => {
    const name = $('localFont').value.trim(); if (!name) return;
    const key = 'local_' + name.replace(/\s+/g, '_');
    const weight = /bold|太|black|heavy|w[6-9]|[6-9]00/i.test(name) ? 700 : 400;
    J.addUserFont(key, name + ' (PC)', name, weight);
    S.project.userFonts = (S.project.userFonts || []).filter(u => u.key !== key).concat([{ key, label: name + ' (PC)', family: name, weight }]);
    S.project.fonts.display = key; $('localFont').value = '';
    fontKey = ''; renderFontRoles(); replan();
  });
  $('btnListFonts').addEventListener('click', async () => {
    if (typeof window.queryLocalFonts !== 'function') { toast('이 브라우저에서는 PC 글꼴 목록을 가져올 수 없습니다'); return; }
    try {
      const fonts = await window.queryLocalFonts();
      const unique = new Map();
      for (const font of fonts) if (font.family) unique.set(`${font.family}\u0000${font.style}`, font);
      const selector = $('installedFonts'); selector.innerHTML = '';
      for (const font of [...unique.values()].sort((a, b) => (a.family + a.style).localeCompare(b.family + b.style))) {
        const option = document.createElement('option'); option.value = font.postscriptName || font.fullName; option.textContent = font.fullName || `${font.family} ${font.style}`;
        option.style.fontFamily = `"${font.family.replace(/"/g, '')}"`; option._font = font; selector.appendChild(option);
      }
      selector.hidden = !$('installedFonts').options.length; $('btnImportFont').hidden = selector.hidden;
      if (selector.hidden) toast('글꼴을 찾을 수 없습니다');
    } catch (error) { toast('PC 글꼴 목록 가져오기가 허용되지 않았습니다'); }
  });
  $('btnImportFont').addEventListener('click', () => {
    const selector = $('installedFonts'), font = selector.selectedOptions[0]?._font;
    if (!font) return;
    const family = font.family, weight = /bold|black|heavy|太|[6-9]00/i.test(font.style || '') ? 700 : 400;
    const key = 'local_' + Array.from(family + '_' + (font.style || '')).map(ch => ch.codePointAt(0).toString(16)).join('_');
    const label = font.fullName || `${family} ${font.style || ''}`;
    J.addUserFont(key, label, family, weight);
    S.project.userFonts = (S.project.userFonts || []).filter(item => item.key !== key).concat([{ key, label, family, weight }]);
    S.project.fonts.display = key; fontKey = ''; renderFontRoles(); replan();
  });
  $('btnSaveComposite').addEventListener('click', () => {
    const name = $('compositeName').value.trim(), base = $('compositeBase').value;
    if (!name || !J.FONTS[base] || J.FONTS[base].composite) { toast('설정 이름과 기준 글꼴을 지정해 주세요'); return; }
    const parts = Object.fromEntries([...$('compositeParts').querySelectorAll('select')].filter(el => el.value && J.FONTS[el.value] && !J.FONTS[el.value].composite).map(el => [el.dataset.part, el.value]));
    const key = 'composite_' + Math.random().toString(36).slice(2, 11);
    S.project.compositeFonts.push({ key, name, base, parts }); J.setCompositeFonts(S.project.compositeFonts);
    S.project.fonts.display = key; $('compositeName').value = ''; fontKey = ''; renderFontRoles(); replan();
  });
  $('compositeList').addEventListener('click', e => {
    const button = e.target.closest('[data-key]'); if (!button) return;
    S.project.compositeFonts = S.project.compositeFonts.filter(def => def.key !== button.dataset.key);
    for (const role of Object.keys(S.project.fonts)) if (S.project.fonts[role] === button.dataset.key) delete S.project.fonts[role];
    J.setCompositeFonts(S.project.compositeFonts); fontKey = ''; renderFontRoles(); replan();
  });
  $('fontFile').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try {
      const uf = await J.loadFontFile(f);
      S.project.userFonts = (S.project.userFonts || []).filter(x => x.key !== uf.key).concat([uf]);
      S.project.fonts.display = uf.key; fontKey = ''; renderFontRoles(); replan(); flushSave();
    }
    catch (err) { showMsg('글꼴을 불러올 수 없습니다'); setTimeout(() => showMsg(null), 2500); }
  });
  ['outAspect', 'eAspect'].forEach(id => $(id).addEventListener('change', e => { S.project.aspect = e.target.value; syncOut(); replan(); codecNote(); }));
  ['outRes', 'eRes'].forEach(id => $(id).addEventListener('change', e => { S.project.res = +e.target.value; syncOut(); autosave(); codecNote(); }));
  for (const id of ['out', 'e']) {
    $(`${id}VideoSize`).addEventListener('change', e => {
      const choice = e.target.value;
      S.project.videoSizeMode = choice === 'custom' ? 'custom' : 'preset';
      if (choice === 'legacy') S.project.videoSize = null;
      else if (choice === 'custom') {
        const [w, h] = J.outputSize(S.project); S.project.videoSize = { w, h };
      } else { const [w, h] = choice.split('x').map(Number); S.project.videoSize = { w, h }; }
      syncOut(); replan(); codecNote();
    });
    for (const dimension of ['Width', 'Height']) $(`${id}Video${dimension}`).addEventListener('change', e => {
      const n = Math.round(+e.target.value / 2) * 2;
      if (!Number.isFinite(n) || n < 16 || n > 8192) { syncOut(); return; }
      const [w, h] = J.outputSize(S.project);
      S.project.videoSize = { w: dimension === 'Width' ? n : w, h: dimension === 'Height' ? n : h };
      syncOut(); replan(); codecNote();
    });
  }
  ['outFps', 'eFps'].forEach(id => $(id).addEventListener('change', e => { S.project.fps = +e.target.value; syncOut(); replan(); codecNote(); }));
  $('outQuality').addEventListener('change', e => { S.project.quality = e.target.value; autosave(); });
  ['outKey', 'eKey'].forEach(id => $(id).addEventListener('change', e => {
    S.project.keyBg = e.target.value; syncOut(); replan(); flushSave();
    const k = J.keyMode(S.project);
    toast(k ? `배경: ${k === 'green' ? '그린 스크린' : '블랙 배경'}(흰 글자와 연출만)` : '배경: 일반(스타일 색 배합)');
  }));
  $('outAudio').addEventListener('change', e => { S.project.includeAudio = e.target.checked; autosave(); });
  document.querySelectorAll('.centerDirSel').forEach(el => el.addEventListener('change', e => {
    S.project.centerDir = e.target.value; syncOut(); replan(); flushSave();
    toast(e.target.value === 'lr' ? '세로 화면: 좌우로 나눕니다' : '세로 화면: 위아래로 나눕니다');
  }));
  ['outCenter', 'eCenter'].forEach(id => $(id).addEventListener('change', e => {
    S.project.centerFree = e.target.checked; syncOut(); replan(); flushSave();
    const tall = S.plan.H > S.plan.W * 1.1 && S.project.centerDir !== 'lr';
    toast(e.target.checked ? `가운데를 비웠습니다: 문자와 연출을 ${tall ? '위아래' : '좌우'}에 배치합니다` : '가운데 비우기를 해제했습니다');
  }));
  $('btnMP4').addEventListener('click', () => runExport('mp4'));
  ['btnMP4File', 'eMP4File'].forEach(id => $(id).addEventListener('click', () => runExport('mp4file')));
  $('btnPNG').addEventListener('click', () => runExport('png'));
  $('btnPNGA').addEventListener('click', () => runExport('pnga'));
  $('btnPNGL').addEventListener('click', () => runExport('pngl'));
  document.querySelectorAll('.exp-cancel').forEach(b => b.addEventListener('click', () => { if (S.exporting) S.exporting.abort(); }));
  $('eMP4').addEventListener('click', () => runExport('mp4'));
  // かんたんモード
  $('modeEasy').addEventListener('click', () => setMode('easy'));
  $('modeMobile').addEventListener('click', () => setMode('mobile'));
  $('btnOmakaseTop').addEventListener('click', omakase);
  $('btnMenu').addEventListener('click', () => { const on = !$('app').classList.contains('menu-open'); $('app').classList.toggle('menu-open', on); $('btnMenu').setAttribute('aria-expanded', String(on)); mobileBar(); });
  document.querySelectorAll('.sec > .sec-h h2').forEach(h => h.addEventListener('click', () => { if (S.mode === 'mobile') h.closest('.sec').classList.toggle('fold'); }));
  if (window.ResizeObserver) new ResizeObserver(mobileBar).observe(document.querySelector('.bar'));
  $('modePro').addEventListener('click', () => setMode('pro'));
  $('btnOmakase').addEventListener('click', omakase);
  $('btnOmakaseBig').addEventListener('click', omakase);
  $('btnAiPick').addEventListener('click', aiPick);
  $('btnAiPickBig').addEventListener('click', aiPick);
  ['btnPrev', 'btnPrev2'].forEach(id => $(id).addEventListener('click', () => histGo(-1)));
  ['btnNext', 'btnNext2'].forEach(id => $(id).addEventListener('click', () => histGo(1)));
  $('eStyle').addEventListener('click', () => rerollPart('style'));
  $('eMood').addEventListener('click', () => rerollPart('mood'));
  $('eCut').addEventListener('click', () => rerollPart('cut'));
  $('ePalette').addEventListener('click', () => { randomPalette(); restartPreview(); });
  // 利用について（出力物の権利・ライセンス）
  const dlg = $('termsDlg');
  const openTerms = () => { if (dlg.showModal) { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', ''); };
  document.querySelectorAll('.terms-open').forEach(b => b.addEventListener('click', openTerms));
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close ? dlg.close() : dlg.removeAttribute('open'); });   // click on the backdrop
  $('btnSave').addEventListener('click', () => J.saveFile(baseName() + '.jizura.json', JSON.stringify(Object.assign({}, S.project, { appVersion: '@VERSION@' }), null, 1)));
  $('btnSaveAll').addEventListener('click', saveBundle);
  $('btnAE').addEventListener('click', () => J.saveFile(baseName() + rangeSuffix() + '_ae.json', JSON.stringify(J.planForAE(S.plan, S.project, exportRange()), null, 1)));
  audioNameDefault = $('audioName').textContent;
  $('btnClearLyrics').addEventListener('click', clearLyrics);
  $('btnReset').addEventListener('click', () => {
    const dlg = $('resetDlg');
    if (!dlg || typeof dlg.showModal !== 'function') { if (window.confirm('가사·음원·설정·기록을 모두 지우고 처음 상태로 되돌릴까요? 되돌릴 수 없습니다.')) resetAll(); return; }
    dlg.returnValue = ''; dlg.showModal();
  });
  $('resetDlg').addEventListener('close', () => { if ($('resetDlg').returnValue === 'reset') resetAll(); });
  $('fileProject').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { await openProject(JSON.parse(await f.text())); }
    catch (err) { showMsg('프로젝트를 불러올 수 없습니다'); setTimeout(() => showMsg(null), 2500); }
    e.target.value = '';
  });
  document.addEventListener('keydown', e => {
    const tag = (e.target && e.target.tagName) || '';
    const typing = (e.target && e.target.isContentEditable) || /INPUT|TEXTAREA|SELECT/.test(tag) && e.target.type !== 'range' && e.target.type !== 'checkbox';
    if (!typing && !e.altKey && (e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); undoMove(e.shiftKey ? 1 : -1); return; }
    if (!typing && !e.altKey && e.ctrlKey && e.code === 'KeyY') { e.preventDefault(); undoMove(1); return; }
    if (S.tap && (e.code === 'Space' || e.code === 'Enter') && !typing) { e.preventDefault(); tapNow(); return; }
    if (S.tap && e.code === 'Escape') { pause(); stopTap(); return; }
    if (S.tap && e.code === 'Backspace' && !typing) { e.preventDefault(); tapBack(); return; }
    if (typing || $('termsDlg').open || $('resetDlg').open) return;
    if (e.code === 'Space') { e.preventDefault(); S.playing ? pause() : play(); }
    else if (e.code === 'ArrowRight') seek(S.t + (e.shiftKey ? 1 : 1 / S.plan.fps));
    else if (e.code === 'ArrowLeft') seek(S.t - (e.shiftKey ? 1 : 1 / S.plan.fps));
    else if (e.code === 'KeyR' && !e.metaKey && !e.ctrlKey && !e.altKey && !S.exporting) { e.preventDefault(); omakase(); }
  });
  window.addEventListener('resize', () => { sizeViewport(); drawTimeline(); drawTimelineLinks(); });
  if (window.ResizeObserver) new ResizeObserver(() => { sizeViewport(); drawTimeline(); drawTimelineLinks(); }).observe($('viewport'));
  if (window.ResizeObserver) new ResizeObserver(drawTimelineLinks).observe($('timelineStack'));
  bindFollow();
}

/* song file -> beat analysis (file input, or a host such as the After Effects panel) */
let audioSeq = 0;
async function loadAudioFile(f, restored) {
  const my = ++audioSeq;                      // only the latest choice may win (an earlier, slower analysis is dropped)
  $('audioName').textContent = '분석 중…';
  try {
    pause();
    const a = await J.analyzeAudio(f);
    if (my !== audioSeq) return false;
    S.audio = a;
    $('audioName').textContent = `${f.name} (${J.fmtTime(S.audio.duration)} · 약 ${S.audio.bpm}BPM)` + (restored ? ' · 지난번 음원' : '');
    S.project.audioName = f.name;
    if (!restored && J.saveSong) J.saveSong(f);             // kept in this browser: a reload does not drop the song from exports
    $('btnRemoveAudio').hidden = false;
    S.project.timing.snap = true;
    syncUI(); replan();
    return true;
  } catch (err) { if (my !== audioSeq) return false; $('audioName').textContent = '불러올 수 없습니다: ' + err.message; S.audio = null; $('btnRemoveAudio').hidden = true; return false; }
}

/* ---------------- かんたんモードの案内ツアー ---------------- */
const TOUR = [
  { t: () => $('lyrics'), title: '1. 가사 넣기', text: '한 행이 한 프레이즈가 됩니다. 빈 행은 약간 간격을 두고, [간주 8]이라고 쓰면 8초 간주(배경과 장식만)가 됩니다.' },
  { t: () => $('audioFile').closest('label') || $('audioFile'), title: '2. 곡 불러오기', text: 'mp3 등을 불러오면 박자를 감지해 컷 전환을 맞춥니다. 곡이 없어도 만들 수 있습니다. 「탭으로 동기화」로 행의 시작을 맞출 수도 있습니다.' },
  { t: () => $('btnOmakaseBig'), title: '3. 자동으로 만들기', text: '스타일·분위기·동작·배색·구성을 통째로 정합니다. 누를 때마다 다른 안이 되고, 「◀ 이전 안」으로 돌아갈 수 있습니다.' },
  { t: () => $('btnPlay'), title: '4. 재생해서 확인하기', text: '재생해 보세요. 아래 타임라인에서는 행 구분을 드래그해 옮길 수 있습니다(＋−로 확대).' },
  { t: () => $('lineList'), title: '5. 마음에 걸리는 행만 고치기', text: '행마다 가사 고치기(✎), 컷 수 정하기, 이 행부터 다시 탭하기(◎), 이 행만 다시 만들기(주사위)를 할 수 있습니다.' },
  { t: () => $('eMP4').closest('.easy-sec') || $('eMP4'), title: '6. 내보내기', text: '화면 비율(세로 9:16 등)과 해상도를 골라 MP4로 내보냅니다. 「내보낼 범위」로 고른 행만 내보낼 수도 있습니다.' },
];
const TR = { i: -1 };
function tourShow(i) {
  const el = $('tour'), n = TOUR.length;
  if (i < 0 || i >= n) return tourEnd();
  TR.i = i;
  const st = TOUR[i], tg = st.t();
  el.hidden = false;
  el.querySelector('.tour-step').textContent = `${i + 1} / ${n}`;
  el.querySelector('.tour-title').textContent = st.title;
  el.querySelector('.tour-text').textContent = st.text;
  el.querySelector('.tour-prev').disabled = i === 0;
  el.querySelector('.tour-next').textContent = i === n - 1 ? '시작하기' : '다음';
  if (tg && tg.scrollIntoView) tg.scrollIntoView({ block: 'center', behavior: 'auto' });
  requestAnimationFrame(() => tourPlace(tg));
  el.querySelector('.tour-next').focus();
}
function tourPlace(tg) {
  const el = $('tour'), spot = el.querySelector('.tour-spot'), bub = el.querySelector('.tour-bub');
  const vw = window.innerWidth, vh = window.innerHeight, pad = 6;
  const r = tg ? tg.getBoundingClientRect() : { left: vw / 2, top: vh / 2, width: 0, height: 0, right: vw / 2, bottom: vh / 2 };
  const x0 = Math.max(4, r.left - pad), y0 = Math.max(4, r.top - pad), x1 = Math.min(vw - 4, r.right + pad), y1 = Math.min(vh - 4, r.bottom + pad);
  Object.assign(spot.style, { left: x0 + 'px', top: y0 + 'px', width: Math.max(0, x1 - x0) + 'px', height: Math.max(0, y1 - y0) + 'px' });
  const bw = bub.offsetWidth, bh = bub.offsetHeight, gap = 12;
  let top = y1 + gap <= vh - bh - 8 ? y1 + gap : y0 - gap - bh >= 8 ? y0 - gap - bh : Math.max(8, vh - bh - 8);
  let left = J.clamp(x0 + (x1 - x0) / 2 - bw / 2, 8, vw - bw - 8);
  Object.assign(bub.style, { top: top + 'px', left: left + 'px' });
}
function tourStart() {
  if (S.exporting || S.tap) return;
  if (S.mode !== 'easy') setMode('easy');
  pause(); tourShow(0);
}
function tourEnd() {
  $('tour').hidden = true; TR.i = -1;
  try { localStorage.setItem('jizura.tourDone', '1'); } catch (e) {}
}
function bindTour() {
  const el = $('tour');
  el.querySelector('.tour-next').addEventListener('click', () => tourShow(TR.i + 1));
  el.querySelector('.tour-prev').addEventListener('click', () => tourShow(TR.i - 1));
  el.querySelector('.tour-skip').addEventListener('click', tourEnd);
  $('btnTour').addEventListener('click', tourStart);
  document.addEventListener('keydown', e => {
    if (TR.i < 0) return;
    if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); tourShow(TR.i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); tourShow(TR.i - 1); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); tourEnd(); }
    else if (e.key !== 'Tab') { e.stopImmediatePropagation(); }
  }, true);
  window.addEventListener('resize', () => { if (TR.i >= 0) tourPlace(TOUR[TR.i].t()); });
  window.addEventListener('scroll', () => { if (TR.i >= 0) tourPlace(TOUR[TR.i].t()); }, true);
}

/* uploaded faces: bring them back from this browser; say so when a project uses one that is not here */
async function restoreFonts() {
  const list = S.project.userFonts || [];
  if (!list.length) return;
  const missing = await J.restoreUserFonts(list);
  fontKey = ''; renderFontRoles(); replan();
  if (missing.length) toast(`読み込んだ書体（${missing.join('・')}）がこのブラウザにありません。「フォント」から同じファイルを読み込み直してください（それまでは近い書体で表示します）`);
}

/* ---------------- boot ---------------- */
function boot() {
  S.project = loadLocal();
  cleanupDeletedMedia();
  cleanupDeletedAssets();
  initUndo();
  bind(); initVolume(); syncUI(); syncLoopBtn(); replan();
  restoreMediaAssets();
  restoreFonts();
  // first visit on a phone: スマホ mode
  let mode = window.matchMedia && window.matchMedia('(max-width: 760px)').matches ? 'mobile' : 'easy';
  try { mode = localStorage.getItem('jizura.mode') || mode; } catch (e) {}
  setMode(mode); commit();
  bindTour();
  let seen = false; try { seen = localStorage.getItem('jizura.tourDone') === '1'; } catch (e) {}
  if (!seen && S.mode === 'easy' && !window.__adobe_cep__) setTimeout(tourStart, 600);   // first visit: show the tour once
  // open on a representative frame (end of the first cut's entrance)
  const c0 = S.plan.cuts.find(c => c.line >= 0);
  if (c0) seek(c0.start + Math.min(c0.dur * 0.6, c0.inDur + 0.25));
  requestAnimationFrame(tick);
  // the song used last time (same name as the saved project's) comes back after a reload
  if (J.loadSong && S.project.audioName) J.loadSong().then(f => { if (f && f.name === S.project.audioName && !S.audio) loadAudioFile(f, true); });
  prepareAssets();                                         // 소재 images come back from this browser's storage
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
J.ui = S;
// hooks for hosts that embed the app (the After Effects CEP panel)
J.uiApi = { toast, replan, syncUI, pause, seek, flushSave, loadAudioFile, restartPreview, exportRange, exportRangeLines, saveBundle, openProject, removeAsset };
})();
