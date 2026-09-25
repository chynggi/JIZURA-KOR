/* ============================================================
   JIZURA — planner: lyrics -> lines -> chunks -> timed cuts + events
   ============================================================ */
(() => {
'use strict';

J.SAMPLE_LYRICS = `새벽의 색을/기억해
풀린 목소리가 멀리에서 울렸다
야, 아직 늦지 않았을까
*투명*한 채로는 끝내지 못해!`;

J.defaultProject = () => ({
  version: 1,
  title: '', artist: '',
  lyrics: J.SAMPLE_LYRICS,
  style: 'noir', mood: null,
  extra: false,                   // random picks may use the parts added after the first version (追加分)
  wa: true,                       // …and the 和風 motifs (提灯・障子・家紋…) — applied after 'extra'
  lang: 'auto',                   // 歌詞の言語: 'auto' | 'ja' | 'zh-Hant' | 'zh-Hans' | 'ko' — picks the faces each font key is drawn with
  keyBg: 'off',                   // 合成用の背景: 'off' | 'green' (グリーンバック) | 'black' (ブラックバック)
  unify: false,                   // 統一感: part palettes, repeats shown the same way, キメ, モーフ, 太さ
  typeset: false,                 // 文字整列: kana tracking, small particles / big first character, Latin sizing, 0.2 s lead, restraint
  centerDir: 'tb',                // 中央を空ける on tall frames: 'tb' = top / bottom, 'lr' = left / right
  centerFree: false,              // 中央を空ける: lay the cuts out in side bands (left / right or top / bottom) around a character
  seed: 20260922,
  aspect: '16:9', res: 1080, fps: 24,
  fx: { motion: 0.7, glitch: 0.55, chroma: 0.7, decor: 0.5, density: 0.55, texture: 0.6, flash: true, onTwos: true, koma: 12, hud: 'auto', interCount: 'auto', interCredit: false, bgSwitch: 0.35, react: 0 },
  enabled: Object.fromEntries(J.GROUP_KEYS.map(g => [g, Object.fromEntries(J.order(g).map(k => [k, true]))])),
  timing: { bpm: 0, offset: 0.4, snap: true, tail: 0.9, lineTimes: {}, lineScale: 1 },
  overrides: {},
  colors: { enabled: false },
  fonts: {},
});

/* the original (After Effects-implemented) sets, captured before any expression pack registers */
J.CORE_ORDER = { layout: J.LAYOUT_ORDER.slice(), enter: J.ENTER_ORDER.slice(), exit: J.EXIT_ORDER.slice(), hold: J.HOLD_ORDER.slice(), decor: J.DECOR_ORDER.slice() };

/* animation step length: 'koma' = drawings per second on a 24fps timebase (12 = on twos, 8 = on threes, 0 = every output frame) */
J.komaOf = fx => (fx.koma != null ? +fx.koma : (fx.onTwos === false ? 0 : 12));
J.stepDur = (fx, fps) => { const k = J.komaOf(fx); return k > 0 ? 1 / k : 1 / (fps || 24); };

/* ---------------- lyric parsing ---------------- */
J.parseLyrics = (raw) => {
  const lines = []; const meta = {};
  let pendingGap = false, pendingBreak = null, outro = null;
  const rows = String(raw || '').replace(/\r/g, '').split('\n');
  for (let ri = 0; ri < rows.length; ri++) {
    const s0 = rows[ri].trim();
    if (!s0) { if (lines.length) pendingGap = true; continue; }
    if (s0.startsWith('#')) continue;
    const mm = s0.match(/^\[(ti|ar|al|by|offset):(.*)\]$/i);
    if (mm) { meta[mm[1].toLowerCase()] = mm[2].trim(); continue; }
    // [간주] / [간주 8] / [간주 8초] / [간주 8 | 문구] / [01:20.00][간주] : interlude before the next line
    // (N = extra seconds for auto timing, 문구 = small caption, timestamp = the previous line ends and the interlude starts there)
    // upstream spellings are accepted too: [間奏] [间奏] [interlude] [instrumental] [inst] [간주: 8]
    const bm = s0.match(/^(?:\[(\d+):(\d+(?:[.:]\d+)?)\])?\[\s*(?:간주|間奏|间奏|interlude|instrumental|inst)(?:\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(?:초|秒|sec|s)?)?\s*(?:\|\s*([^\]]*?)\s*)?\]$/i);
    if (bm) { pendingBreak = { sec: bm[3] != null ? +bm[3] : null, at: bm[1] != null ? +bm[1] * 60 + parseFloat(bm[2].replace(':', '.')) : null, text: bm[4] || null }; continue; }
    // [마무리] / [End 8] / [03:45.00][마무리] : end card after the last line (at = start time, N = length when there is no song)
    const om = s0.match(/^(?:\[(\d+):(\d+(?:[.:]\d+)?)\])?\[(?:마무리|end)(?:\s+(\d+(?:\.\d+)?)\s*(?:초|s)?)?\]$/i);
    if (om) { outro = { at: om[1] != null ? +om[1] * 60 + parseFloat(om[2].replace(':', '.')) : null, sec: om[3] != null ? +om[3] : null }; continue; }
    let s = s0; const times = [];
    let m;
    while ((m = s.match(/^\[(\d+):(\d+(?:[.:]\d+)?)\]/))) { times.push(+m[1] * 60 + parseFloat(m[2].replace(':', '.'))); s = s.slice(m[0].length); }
    s = s.trim();
    let note = null;
    const bar = s.indexOf('|');
    if (bar >= 0) { note = s.slice(bar + 1).trim() || null; s = s.slice(0, bar).trim(); }
    // extended LRC word times: <mm:ss.xx> before a word marks when it is sung (kept as \u0001 until the text is final)
    const WT = /<(\d+):(\d+(?:[.:]\d+)?)>[ \t]*/g, wt = [];
    if (note) note = note.replace(WT, '').trim() || null;
    s = s.replace(WT, (_, a, b) => { wt.push(+a * 60 + parseFloat(b.replace(':', '.'))); return '\u0001'; });
    const wtail = wt.length ? (s.match(/\s*\u0001+$/) || [''])[0] : '';
    if (wtail) s = s.slice(0, s.length - wtail.length);
    let impact = false;
    if (/[!！]$/.test(s) && s.length > 1 && /!$/.test(s)) { impact = true; s = s.slice(0, -1).trim(); }
    const emph = [];
    s = s.replace(/\*([^*]+)\*/g, (_, w) => { emph.push(w); return w; });
    let manual = null;
    if (s.includes('/')) {
      manual = s.split('/').map(x => x.trim()).filter(Boolean);
      const latin = manual.some(x => /[A-Za-z]/.test(x));
      s = manual.join(latin ? ' ' : '');
    }
    let marks = null;
    if (wt.length) {
      s += wtail.replace(/\s/g, '');
      marks = []; let ci = 0, q = 0;
      for (const ch of s) { if (ch === '\u0001') marks.push({ t: wt[q++], ci }); else ci++; }
      const strip = x => x.replace(/\u0001/g, '');
      s = strip(s).trim(); if (manual) manual = manual.map(strip).filter(Boolean); emph.forEach((w, i) => { emph[i] = strip(w); });
      if (!times.length && marks.length) times.push(marks[0].t);
    }
    if (!s) continue;
    outro = null; // [마무리] only counts after the last line
    const base = { text: s, note, impact, emph, manual, gapBefore: pendingGap, breakBefore: pendingBreak, src: ri };
    pendingGap = false; pendingBreak = null;
    // a repeated line ([00:10][00:40]…) reuses its word times shifted to each start
    if (times.length) times.forEach(t => lines.push(Object.assign({}, base, { lrc: t }, marks ? { marks: marks.map(k => ({ t: k.t + t - times[0], ci: k.ci })) } : {})));
    else lines.push(Object.assign({}, base, { lrc: null }));
  }
  if (lines.some(l => l.lrc != null)) lines.sort((a, b) => (a.lrc ?? 1e9) - (b.lrc ?? 1e9));
  return { lines, meta, outro };
};

/* ---------------- chunking (bunsetsu-ish) ---------------- */
const segmenters = {};   // one per lyric language (J.segLocale: ja / zh-Hant / zh-Hans / ko)
const segmenterOf = () => {
  if (typeof Intl === 'undefined' || !Intl.Segmenter) return null;
  const loc = J.segLocale ? J.segLocale() : 'ja';
  if (!(loc in segmenters)) { try { segmenters[loc] = new Intl.Segmenter(loc, { granularity: 'word' }); } catch (e) { segmenters[loc] = null; } }
  return segmenters[loc];
};
const segType = s => {
  if (/^\s+$/.test(s)) return 'S';
  if ([...s].every(c => J.isPunct(c))) return 'P';
  if ([...s].some(c => J.isKanji(c))) return 'K';
  if ([...s].every(c => J.isHira(c) || c === 'ー')) return 'H';
  if ([...s].every(c => J.isKata(c) || c === 'ー')) return 'T';
  if (/[A-Za-z0-9]/.test(s)) return 'L';
  return 'O';
};
J.segments = (text) => {
  const segmenter = segmenterOf();
  if (segmenter) return [...segmenter.segment(text)].map(x => x.segment);
  const out = []; let cur = '', ct = '';
  for (const c of text) {
    const t = segType(c);
    if (cur && t !== ct && !(ct === 'K' && t === 'H')) { out.push(cur); cur = ''; }
    cur += c; ct = t;
  }
  if (cur) out.push(cur);
  return out;
};
J.chunkText = (text) => {
  const segs = J.segments(text);
  const chunks = []; let cur = null;
  const close = () => { if (cur && cur.s.trim()) chunks.push(cur.s.trim()); cur = null; };
  for (const sg of segs) {
    const t = segType(sg);
    if (t === 'S') { close(); continue; }
    if (t === 'P') { if (cur) cur.s += sg; else if (chunks.length) chunks[chunks.length - 1] += sg; else cur = { s: sg, k: 'P', hasH: false }; continue; }
    if (!cur) { cur = { s: sg, k: t, hasH: t === 'H' }; continue; }
    if (t === 'H') {
      const len = [...sg].length;
      if (len <= 3 || (cur.k !== 'H' && !cur.hasH) || (cur.k === 'H' && [...cur.s].length + len <= 4)) { cur.s += sg; cur.hasH = true; continue; }
      close(); cur = { s: sg, k: 'H', hasH: true }; continue;
    }
    if (t === 'K' && cur.k === 'K' && !cur.hasH && [...(cur.s + sg)].length <= 6) { cur.s += sg; continue; }
    if (t === 'T' && cur.k === 'T') { cur.s += sg; continue; }
    if (t === 'L' && cur.k === 'L') { cur.s += sg; continue; }
    close(); cur = { s: sg, k: t, hasH: t === 'H' };
  }
  close();
  // split very long chunks, merge lonely single kana
  const out = [];
  for (const c of chunks) {
    const n = [...c].length;
    if (n > 10) { J.splitLines(c, Math.ceil(n / Math.ceil(n / 8))).split('\n').forEach(x => out.push(x)); }
    else out.push(c);
  }
  for (let i = out.length - 1; i > 0; i--) {
    if ([...out[i]].length === 1 && !J.isKanji(out[i])) { out[i - 1] += out[i]; out.splice(i, 1); }
  }
  return out.length ? out : [text];
};

/* English lyrics: cut by short phrases, not word by word (a Japanese chunk holds about as much as 2–3 English words) */
J.phraseChunks = (words) => {
  const out = []; let cur = [], letters = 0;
  const flush = () => { if (cur.length) out.push(cur.join(' ')); cur = []; letters = 0; };
  for (const w of words) {
    const n = (w.match(/[A-Za-z\u00c0-\u024f0-9]/g) || []).length;
    cur.push(w); letters += n;
    if (letters >= 9 || cur.length >= 3 || /[,.;:!?]$/.test(w)) flush();
  }
  flush();
  // a lone short word at the end joins the previous phrase
  if (out.length >= 2 && out[out.length - 1].replace(/[^A-Za-z]/g, '').length <= 4) { const last = out.pop(); out[out.length - 1] += ' ' + last; }
  return out.length ? out : words;
};

/* ---------------- timing ---------------- */
J.computeTiming = (project, parsed, audio) => {
  const T = project.timing || {};
  const lines = parsed.lines;
  const beat = T.bpm > 0 ? 60 / T.bpm : 0;
  const starts = [];
  const allLrc = lines.length && lines.every(l => l.lrc != null);
  let t = T.offset ?? 0.4;
  lines.forEach((l, i) => {
    const man = T.lineTimes && T.lineTimes[i] != null ? +T.lineTimes[i] : null;
    let s;
    if (man != null && isFinite(man)) s = man;          // a hand-set time (typed, tapped, dragged) wins over the LRC tag
    else if (allLrc) s = l.lrc;
    else {
      if (i > 0) {
        const n = [...lines[i - 1].text].length;
        let d = J.clamp(0.8 + n * 0.17, 1.3, 5.2) * (T.lineScale || 1);
        if (beat) d = Math.max(2, Math.round(d / beat)) * beat;
        s = starts[i - 1] + d + (l.breakBefore && l.breakBefore.sec != null ? l.breakBefore.sec : l.gapBefore || l.breakBefore ? (beat ? beat * 2 : 0.8) : 0);
      } else s = t + (l.breakBefore && l.breakBefore.sec != null ? l.breakBefore.sec : 0);
    }
    starts.push(s);
  });
  const outro = parsed.outro && lines.length ? parsed.outro : null;
  const ends = starts.map((s, i) => {
    const nb = i < starts.length - 1 ? lines[i + 1].breakBefore : null;
    if (nb && nb.at != null) return Math.max(s + 0.35, Math.min(nb.at, starts[i + 1]));
    if (i < starts.length - 1) return Math.max(s + 0.35, starts[i + 1]);
    if (outro && outro.at != null) return Math.max(s + 0.35, outro.at);
    const n = [...lines[i].text].length;
    let d = J.clamp(0.8 + n * 0.17, 1.5, 5.2) * (T.lineScale || 1);
    if (beat) d = Math.max(2, Math.round(d / beat)) * beat;
    const mk = lines[i].marks;   // word times: the last line lasts until its last sung word
    return Math.max(s + d, mk && mk.length ? mk[mk.length - 1].t + 0.4 : 0);
  });
  let duration = (ends.length ? ends[ends.length - 1] : 3) + (outro ? outro.sec ?? 4 : T.tail ?? 0.9);
  if (audio && audio.duration && T.useAudioLength !== false) duration = Math.max(audio.duration, ends.length ? ends[ends.length - 1] + 0.2 : 1);
  return { starts, ends, duration };
};

/* ---------------- planning ---------------- */
const wkey = (obj, k, d = 1) => (obj && obj[k] != null ? obj[k] : d);

J.plan = (project, audio) => {
  const st = J.resolveStyle(project);
  const fx = Object.assign({}, J.defaultProject().fx, project.fx || {});
  const parsed = J.parseLyrics(project.lyrics);
  const title = project.title || parsed.meta.ti || '';
  const artist = project.artist || parsed.meta.ar || '';
  const tm = J.computeTiming(project, parsed, audio);
  // 文字整列: the lyrics appear 0.2 s before the voice (reading ahead feels in time)
  if (project.typeset) {
    const LEAD = 0.2;
    tm.starts = tm.starts.map(t => Math.max(0, t - LEAD));
    tm.ends = tm.ends.map((t, i) => Math.max(tm.starts[i] + 0.3, t - LEAD));
  }
  const [W, H] = J.designSize(project.aspect);
  // enabled map: anything not explicitly switched off is on (new pack entries appear enabled in old projects);
  // then the 追加分 / 和風 switches decide what random picks may use (a per-line override still works)
  const en = {};
  for (const g of J.GROUP_KEYS) { en[g] = {}; const src = (project.enabled || {})[g] || {}; for (const k of J.order(g)) en[g][k] = src[k] !== false && (!J.randomOk || J.randomOk(project, g, k)); }
  // 中央を空ける (キャラクター用): every cut is laid out in a side band — left / right on wide frames, top / bottom on tall
  // ones — alternating line by line; the centre keeps only the full-frame background and screen effects
  const zones = project.centerFree ? J.sideZones(W, H, project.centerDir) : null;
  // the lyric of every cut is split in two: the first half in band 0 (left / top), the second in band 1 (right / bottom)
  const zoneOf = () => (zones ? Object.assign({}, zones[0]) : null);
  if (zones && en.bg) en.bg.bigChar = false;               // the one background that draws the lyric itself (big, centred)
  const plan = {
    version: 1, generator: 'JIZURA', title, artist, W, H, fps: project.fps || 24,
    duration: tm.duration, styleKey: project.style, style: st, fx, seed: project.seed,
    lines: [], cuts: [], events: [], beats: audio && audio.beats ? audio.beats.slice() : [],
    hud: fx.hud === 'on' ? true : fx.hud === 'off' ? false : !!st.hud,
    keyBg: J.keyMode ? J.keyMode(project) : null,   // 'green' | 'black' | null — 合成用の背景
    centerFree: !!zones, zones,
    typeset: !!project.typeset, unify: !!project.unify,
    lang: J.resolveLang ? J.resolveLang(project) : 'ja',   // 歌詞の言語 (auto → detected)
  };
  if (J.setLang) J.setLang(plan.lang);                     // chunking + measuring below use this language
  if (J.setTypeset) J.setTypeset(plan.typeset);
  const beats = plan.beats;
  const snap = (t) => {
    if (!beats.length || !(project.timing && project.timing.snap)) return t;
    let lo = 0, hi = beats.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (beats[mid] < t) lo = mid + 1; else hi = mid; }
    let best = t, bd = 0.13;
    for (const k of [lo - 1, lo]) if (k >= 0 && k < beats.length && Math.abs(beats[k] - t) < bd) { bd = Math.abs(beats[k] - t); best = beats[k]; }
    return best;
  };
  const history = [], bgHistory = [], fxHistory = [];
  let schemeIdx = 0, creditDone = false;
  const nSchemes = st.schemes.length;
  const addEvent = (t, type, amp, dur) => plan.events.push({ t, type, amp, dur });

  // title card
  const firstStart = tm.starts.length ? tm.starts[0] : 0;
  if (title && firstStart >= 1.1) {
    const rng = J.rng(J.h(project.seed, 999));
    plan.cuts.push(makeCut({ text: title, note: artist, lineText: title, line: -1, start: 0.1, end: firstStart - 0.04, layout: 'title', enter: rng.pick(['blur', 'type', 'wipe', 'assemble']), exit: rng.pick(['blur', 'drift', 'wipe']), hold: 'still', params: J.LAYOUTS.title.plan(rng, {}, st), decor: [], scheme: 0, seed: J.h(project.seed, 999, 1) }));
  }

  // 統一感: sections, repeated lines, キメ lines and the per-section palettes (see makeUnify below)
  const U = plan.unify ? makeUnify(parsed.lines, { st, en, fx, history, lang: plan.lang, seed: project.seed }) : null;
  parsed.lines.forEach((ln, li) => {
    const s = tm.starts[li], e = tm.ends[li];
    const ov = (project.overrides || {})[li] || {};
    const lineSeed = ov.lock && ov.lockedSeed != null ? ov.lockedSeed : J.h(project.seed, li + 1, ov.seed | 0);
    const rng = J.rng(lineSeed);
    if (ln.interlude) {                                    // [間奏]: background, decorations and screen effects only
      plan.lines.push({ index: li, src: ln.src, text: '', interlude: true, secs: ln.secs, start: s, end: e, visEnd: e, note: null, impact: false, emph: [], chunks: [], seed: lineSeed });
      const bg = ov.bg && J.BG[ov.bg] ? ov.bg : pickBg(rng, st, en, fx, bgHistory); bgHistory.push(bg);
      const dur = e - s, showTitle = dur >= 6 && !!(title || artist);
      plan.cuts.push(makeCut({ text: '', lineText: '', line: li, start: s, end: e, layout: 'interlude', enter: 'blur', exit: 'blur', hold: 'still', inDur: 0.4, outDur: 0.4,
        params: { variant: 'quiet', showTitle, titleText: showTitle ? [title, artist].filter(Boolean).join('  /  ') : '' }, decor: Array.isArray(ov.decor) ? ov.decor.filter(id => J.DECOR[id]).map(id => decorParams(rng, id)) : pickDecor(rng, st, en, Object.assign({}, fx, { decor: Math.max(0.6, fx.decor) }), 'interlude', history),
        scheme: schemeIdx, seed: J.h(lineSeed, 405), bg, bgP: J.BG[bg] && J.BG[bg].plan ? J.BG[bg].plan(rng, st) : {}, cam: 'push', camP: {} }));
      if (en.fx == null || en.fx.chroma !== false) addEvent(s, 'chroma', 1 + fx.chroma, 0.25);
      for (let t = s + 1.2; t < e - 0.8; t += J.clamp(dur / 4, 1.6, 3.2)) {          // a few effect accents so a long interlude keeps moving
        const pick = pickFx(rng, st, en, fx, false, fxHistory, 'mid');
        if (pick) { const D2 = J.FXE[pick]; addEvent(t, pick, (D2.amp || 1) * 0.6, (D2.dur || 3) / 24); fxHistory.push(pick); }
      }
      return;
    }
    const n = [...ln.text.replace(/\s+/g, '')].length;
    let visEnd = Math.min(e, s + Math.max(3.6, n * 0.5 + 1.2));
    // before a marked [간주] the line only keeps its natural length, the rest of the gap becomes the interlude
    // (with a timestamp on the marker the line already ends there)
    const nb = li < parsed.lines.length - 1 ? parsed.lines[li + 1].breakBefore : null;
    if (nb && nb.at == null) {
      const T = project.timing || {}, beat = T.bpm > 0 ? 60 / T.bpm : 0;
      let d = J.clamp(0.8 + [...ln.text].length * 0.17, 1.3, 5.2) * (T.lineScale || 1);
      if (beat) d = Math.max(2, Math.round(d / beat)) * beat;
      visEnd = Math.min(visEnd, s + d);
    }
    // word times (<mm:ss.xx>): keep the line up until its last sung word
    const mk = ln.marks && ln.marks.length ? ln.marks : null;
    if (mk) visEnd = Math.min(e, Math.max(visEnd, mk[mk.length - 1].t + 0.4));
    const D = visEnd - s;
    plan.lines.push({ index: li, src: ln.src, text: ln.text, start: s, end: e, visEnd, note: ln.note, impact: ln.impact, emph: ln.emph, chunks: null, seed: lineSeed });
    const chunks = ln.manual || (plan.lang === 'en' ? J.phraseChunks(J.chunkText(ln.text)) : J.chunkText(ln.text));
    plan.lines[li].chunks = chunks;
    const L = J.lerp(1.3, 0.5, fx.density);
    let nC = Math.round(D / L);
    const maxC = chunks.length + (chunks.length >= 2 && D > 2.0 ? 1 : 0);
    nC = J.clamp(nC, 1, Math.max(1, maxC));
    const ovAny = Object.keys(ov).some(k2 => !['lock', 'lockedSeed', 'seed'].includes(k2));
    const kime = !!(U && U.kime.has(li) && !ov.cuts);
    if (ov.single || kime) nC = 1;
    if (zones) nC = Math.max(1, Math.min(nC, Math.floor(chunks.length / 2)));   // 中央を空ける: each cut is split in two, so keep ≥ 2 words per cut
    // カット数の指定 (per line): exactly that many cuts — chunks are split further when the line has fewer
    const fixedN = ov.cuts > 0 ? Math.min(12, ov.cuts | 0) : 0;
    let chunks2 = chunks;
    if (fixedN) { nC = fixedN; chunks2 = splitToCount(chunks, fixedN); }
    // groups of chunks
    let groups;
    const nG = Math.min(nC, chunks2.length);
    if (nG <= 1) groups = [ln.text];
    else groups = partition(chunks2, nG).map(g => g.join(/[A-Za-z]/.test(g.join('')) ? ' ' : ''));
    const recap = !mk && !fixedN && nC > groups.length && groups.length >= 2;
    const units = groups.map(g => ({ text: g, w: [...g].length + 1.6 }));
    if (recap) units.push({ text: ln.text, w: (units.reduce((a, u) => a + u.w, 0) / units.length) * 1.25, recap: true });
    const tot = units.reduce((a, u) => a + u.w, 0);
    let acc = s; const bounds = [s];
    units.forEach((u, k) => { acc += D * u.w / tot; bounds.push(k === units.length - 1 ? visEnd : acc); });
    // with word times each cut starts when its first word is sung
    const uci = mk ? unitCharStarts(ln.text, units) : null;
    if (uci) for (let k = 1; k < units.length; k++) bounds[k] = markTime(mk, uci[k], [...ln.text].length, visEnd);
    for (let k = 1; k < bounds.length - 1; k++) bounds[k] = J.clamp(uci ? bounds[k] : snap(bounds[k]), bounds[k - 1] + 0.22, bounds[k + 1] - 0.22);
    // scheme per line
    if (nSchemes > 1 && li > 0 && (U ? U.sectionStart(li) && rng.chance(0.25 + fx.bgSwitch) : rng.chance(fx.bgSwitch * (ln.impact ? 1.8 : 1)))) schemeIdx = (schemeIdx + 1 + rng.int(0, nSchemes - 2)) % nSchemes;
    const emphLine = ln.impact || ln.emph.length > 0;
    // background graphic: chosen per line, occasionally re-rolled per cut
    let lineBg = ov.bg && J.BG[ov.bg] ? ov.bg : pickBg(rng, st, en, fx, bgHistory);
    bgHistory.push(lineBg);
    let lineBgP = J.BG[lineBg] && J.BG[lineBg].plan ? J.BG[lineBg].plan(rng, st) : {};
    units.forEach((u, k) => {
      const cs = bounds[k], ce = bounds[k + 1], dur = ce - cs;
      const halves = zones ? splitHalf(u.text, plan.lang) : null;               // 中央を空ける: 「花が」｜「咲いた」
      const txt = halves ? halves[0] : u.text;
      const nn = Math.max(...(halves || [u.text]).map(t => [...t.replace(/\s+/g, '')].length));
      const emph = kime || ln.impact && (k === 0 || u.recap) || ln.emph.some(w => u.text.includes(w));
      const Z = zoneOf(li), LW = Z ? Z.w : W, LH = Z ? Z.h : H;       // the frame this cut is laid out in
      const UU = U && !ovAny ? U : null;                              // per-line settings always win over 統一感
      let layout = ov.layout && J.LAYOUTS[ov.layout] ? ov.layout : pickLayout(rng, st, en, nn, dur, history, emph, u.recap, LH > LW);
      if (UU) layout = UU.layout(li, layout, { nn, dur, emph, kime, rng, portrait: LH > LW, recap: u.recap });
      let enter = ov.enter && J.ENTER[ov.enter] ? ov.enter : pickEnter(rng, st, en, layout, dur, history, emph, nn);
      let exit = ov.exit && J.EXIT[ov.exit] ? ov.exit : pickExit(rng, st, en, layout, dur, k === units.length - 1, history);
      let hold = ov.hold && J.HOLD[ov.hold] ? ov.hold : pickHold(rng, en, fx, history);
      let weightGrow = false;
      if (UU) {
        enter = UU.enter(li, enter, { layout, dur, emph, kime, rng, nn });
        exit = UU.exit(li, exit, { layout, dur, kime, rng });
        hold = UU.hold(li, hold, { kime, rng });
        weightGrow = UU.weightGrow({ kime, nn, rng, dur });
        if (weightGrow) enter = UU.softEnter(enter, rng);
      }
      const durs = (en2, ex2) => {
        let a = J.clamp(dur * 0.36, 0.12, 0.6);
        if (en2 === 'type') a = J.clamp(nn * 0.055 + 0.1, 0.15, dur * 0.65);
        if (en2 === 'assemble') a = J.clamp(dur * 0.45, 0.22, 0.75);
        if (J.ENTER[en2] && J.ENTER[en2].inDur) a = J.ENTER[en2].inDur(dur, nn);
        if (en2 === 'cut') a = 0.12;
        let b = ex2 === 'cut' ? 0 : J.clamp(dur * 0.3, 0.14, 0.55);
        if (['explode', 'fall', 'drift'].includes(ex2)) b = J.clamp(dur * 0.38, 0.25, 0.7);
        if (J.EXIT[ex2] && J.EXIT[ex2].outDur) b = J.EXIT[ex2].outDur(dur, nn);
        if (a + b > dur * 0.92) { const f = dur * 0.92 / (a + b); a *= f; b *= f; }
        return [a, b];
      };
      let [inDur, outDur] = durs(enter, exit);
      let sch = schemeIdx;
      if (!U && nSchemes > 1 && k > 0 && rng.chance(0.12 * fx.bgSwitch)) sch = (schemeIdx + 1) % nSchemes;
      let LD = J.LAYOUTS[layout];
      let params = LD.plan(rng, { text: txt, n: nn, W: LW, H: LH, dur }, st);
      let decor = Array.isArray(ov.decor) ? ov.decor.filter(id => J.DECOR[id]).map(id => decorParams(rng, id)) : pickDecor(rng, st, en, fx, layout, history);
      let treat = ov.treat && J.TREAT[ov.treat] ? ov.treat : pickTreat(rng, st, en, fx, LD, emph, history, !!mk);
      if (UU) { decor = UU.decor(li, decor, { layout, kime, rng }); treat = UU.treat(li, treat, { kime, rng, LD }); }
      let treatP = J.TREAT[treat].plan ? J.TREAT[treat].plan(rng, st) : {};
      if (!ov.bg && k > 0 && !U && rng.chance(0.18 * fx.bgSwitch + 0.04)) { lineBg = pickBg(rng, st, en, fx, bgHistory); lineBgP = J.BG[lineBg].plan ? J.BG[lineBg].plan(rng, st) : {}; }
      let bg = LD.busy && !(J.BG[lineBg] && J.BG[lineBg].subtle) ? 'none' : lineBg;
      let cam = ov.cam && J.CAMERA[ov.cam] ? ov.cam : pickCam(rng, st, en, fx, LD, emph, history);
      if (UU) cam = UU.cam(li, cam, { kime, emph, rng });
      let camP = J.CAMERA[cam].plan ? J.CAMERA[cam].plan(rng, st) : {};
      let cutSeed = J.h(lineSeed, k, 17);
      // 統一感: a line that comes back (サビ etc.) is shown exactly as the first time
      const again = UU ? UU.again(li, k, txt) : null;
      if (again) {
        ({ layout, enter, exit, hold, params, decor, treat, treatP, cam, camP, weightGrow } = again);
        sch = again.scheme; cutSeed = again.seed; LD = J.LAYOUTS[layout];
        if (again.bg && again.bg !== 'none') { bg = again.bg; lineBgP = again.bgP; lineBg = bg; }
        [inDur, outDur] = durs(enter, exit);
      }
      // cut-to-cut transition (replaces the previous cut's exit and this cut's entrance)
      const prevCut = plan.cuts[plan.cuts.length - 1];
      let trans = null, transP = {}, transDur = 0, morph = null;
      const canTrans = prevCut && Math.abs(prevCut.end - cs) < 0.06 && prevCut.layout !== 'interlude' && dur > 0.5;
      // 統一感: モーフ — the next part of the same line grows out of this one (shared characters glide, the rest melts)
      if (canTrans && UU && k > 0 && !kime && (again ? again.morph : rng.chance(u.recap ? 0.85 : 0.4))) {
        morph = { dur: J.clamp(dur * 0.45, 0.28, 0.6) };
        enter = 'cut'; inDur = 0.12; prevCut.exit = 'cut'; prevCut.outDur = 0;
      } else if (canTrans) {
        trans = ov.trans && J.TRANS[ov.trans] ? ov.trans : pickTrans(rng, st, en, fx, emph, history);
        if (trans && UU) trans = UU.trans(li, trans, { rng });
        if (trans) {
          const TD = J.TRANS[trans];
          transDur = J.clamp(TD.dur || 0.35, 0.12, Math.min(0.6, dur * 0.45));
          transP = TD.plan ? TD.plan(rng, st) : {};
          enter = 'cut'; inDur = 0.12;
          prevCut.exit = 'cut'; prevCut.outDur = 0;
        }
      }
      const cut = makeCut({ text: txt, lineText: ln.text, note: ln.note, line: li, start: cs, end: ce, layout, enter, exit, hold, inDur, outDur, params, decor, scheme: sch, seed: cutSeed, emph, recap: !!u.recap, words: J.chunkText(txt), stagger: rng.range(0.025, 0.06),
        treat, treatP, bg, bgP: bg === lineBg ? lineBgP : {}, cam, camP, trans, transP, transDur, zone: Z });
      // karaoke sync: [time since cut start, share of this cut's text already sung]
      if (uci && !u.recap) {
        const N = [...ln.text].length, c0 = uci[k], c1 = k + 1 < units.length ? uci[k + 1] : N, span = Math.max(1, c1 - c0);
        cut.sync = [[markTime(mk, c0, N, visEnd) - cs, 0]].concat(mk.filter(q => q.ci > c0 && q.ci < c1).map(q => [q.t - cs, (q.ci - c0) / span]), [[markTime(mk, c1, N, visEnd) - cs, 1]]);
      }
      if (kime) cut.kime = true;
      if (weightGrow) cut.weightGrow = true;
      if (morph) cut.morph = morph;
      if (UU) UU.remember(li, k, txt, cut);
      if (zones) splitCut(cut, halves, zones, st, dur);
      // 文字整列: effects don't pile up — one decoration, no text treatment on top of it
      if (plan.typeset) { cut.decor = cut.decor.slice(0, 1); if (cut.decor.length && cut.treat !== 'none') { cut.treat = 'none'; cut.treatP = {}; } }
      plan.cuts.push(cut);
      const evMark = plan.events.length;
      history.push({ layout, enter, exit, hold, treat, cam, trans, decor: decor.map(d => d.id) });
      // events at cut start
      // events at cut start — durations are on a 24fps timebase so every output rate looks the same
      const g = fx.glitch * (st.glitchBoost || 1);
      const fxOn = k2 => en.fx == null || en.fx[k2] !== false;
      const F = 1 / 24;
      if (fxOn('chroma')) addEvent(cs, 'chroma', 1.4 + rng.range(0, 2) * fx.chroma + (emph ? 2.5 : 0), 0.25);
      if (fxOn('slice') && rng.chance(g * 0.5 + (emph ? 0.3 : 0))) addEvent(cs, 'slice', 0.6 + rng.range(0, 0.8) * g + (emph ? 0.5 : 0), rng.pick([2, 3, 4]) * F);
      if (fxOn('block') && rng.chance(g * 0.22)) addEvent(cs + rng.range(0, 0.05), 'block', 0.5 + g, rng.pick([2, 4]) * F);
      if (fxOn('shake') && (emph || rng.chance(fx.motion * 0.18))) addEvent(cs, 'shake', (emph ? 1 : 0.5) * fx.motion, 0.3);
      if (fxOn('flash') && fx.flash && (ln.impact && k === 0 || kime)) addEvent(cs, 'flash', 1, 3 * F);
      if (kime) {                                  // キメ: a hard accent where the line lands
        if (fxOn('zoom')) addEvent(cs, 'zoom', 1.1, 0.25);
        if (fxOn('shake')) addEvent(cs + 0.04, 'shake', 1.1 * Math.max(0.5, fx.motion), 0.35);
      }
      if (fxOn('invert') && rng.chance(0.035 * g)) addEvent(cs, 'invert', 1, 2 * F);
      if (fxOn('zoom') && (emph && rng.chance(0.6) || rng.chance(0.06 * fx.motion))) addEvent(cs, 'zoom', 0.7 + 0.5 * fx.motion, 0.22);
      if (fxOn('mosaic') && rng.chance(0.04 * g)) addEvent(cs, 'mosaic', 1, 3 * F);
      if (fxOn('slice') && dur > 0.8 && rng.chance(g * 0.4)) addEvent(cs + rng.range(0.35, 0.8) * dur, 'slice', 0.4 + g * 0.4, 2 * F);
      // the newer effect library: at most one per cut boundary (plus rare mid-cut accents)
      if (plan.cuts.length > 1 || k > 0 || li > 0) {
        const pick = pickFx(rng, st, en, fx, emph, fxHistory, 'edge');
        if (pick) { const D2 = J.FXE[pick]; const d = (D2.dur || 4) * F; addEvent(cs - (D2.pre ? D2.pre * F : 0), pick, (D2.amp || 1) * (0.7 + 0.5 * g + (emph ? 0.3 : 0)), d); fxHistory.push(pick); }
      }
      if (dur > 1.1) { const pick = pickFx(rng, st, en, fx, emph, fxHistory, 'mid'); if (pick) { const D2 = J.FXE[pick]; addEvent(cs + rng.range(0.4, 0.75) * dur, pick, (D2.amp || 1) * (0.5 + 0.4 * g), (D2.dur || 3) * F); } }
      // 文字整列: at most one screen effect per cut besides the colour split (the キメ line keeps its accents)
      if (plan.typeset && !cut.kime) {
        const mine = plan.events.splice(evMark);
        let extra = 0;
        for (const e of mine) if (e.type === 'chroma' || e.type === 'shake' && emph || extra++ < 1) plan.events.push(e);
      }
    });
    // interlude in long gaps, or wherever the lyrics mark one with [간주]
    const nextStart = li < parsed.lines.length - 1 ? tm.starts[li + 1] : null;
    const marked = !!nb;
    const iStart = nb && nb.at != null ? Math.max(visEnd, e) : visEnd;
    if (nextStart != null && nextStart - iStart > (marked ? 0.3 : 1.3)) {
      const r2 = J.rng(J.h(lineSeed, 404));
      // marked interlude: one random screen effect from the library, no lyric text
      if (marked) { const pick = pickFx(r2, st, en, fx, true, fxHistory, 'force'); if (pick) { const D2 = J.FXE[pick]; addEvent(iStart - (D2.pre ? D2.pre / 24 : 0), pick, D2.amp || 1, (D2.dur || 4) / 24); fxHistory.push(pick); } }
      // long interludes (> 6 s) become 2–3 cuts, each boundary snapped to the nearest beat
      const L = nextStart - iStart, nSeg = L > 6 ? Math.min(3, Math.ceil(L / 4)) : 1, bounds = [iStart];
      for (let k = 1; k < nSeg; k++) bounds.push(snap(iStart + L * k / nSeg));
      bounds.push(nextStart);
      const next = parsed.lines[li + 1].text;
      for (let k = 0; k < nSeg; k++) {
        const rk = k ? J.rng(J.h(lineSeed, 404, k)) : r2;
        const params = Object.assign(J.LAYOUTS.interlude.plan(rk), fx.interCount === 'on' ? { variant: 'counter' } : fx.interCount === 'off' ? { variant: 'rings' } : {});
        // 추가 연출: countdown / next-line preview / progress bar / energy bars (countdown only on the last part)
        if (project.extra === true && fx.interCount !== 'on' && (fx.interCount === 'off' || rk.chance(0.67))) {
          const pool = k === nSeg - 1 ? INTER_EXTRA : INTER_EXTRA.filter(v => v !== 'countdown');
          params.variant = fx.interCount === 'off' ? rk.pick(pool.concat('rings')) : rk.pick(pool);
        }
        if (nSeg > 1) params.end = nextStart;
        if (params.variant === 'preview') params.next = next;
        if (params.variant === 'countdown') params.beat = project.timing && project.timing.bpm > 0 ? 60 / project.timing.bpm : 0;
        // 첫 간주에 크레딧: the first interlude long enough shows the song title and artist
        const credit = k === 0 && fx.interCredit && title && !creditDone && bounds[1] - bounds[0] >= 2;
        if (credit) { params.variant = 'credit'; creditDone = true; }
        const sch = k && nSchemes > 1 ? (schemeIdx + k) % nSchemes : schemeIdx;
        plan.cuts.push(makeCut({ text: credit ? title : (nb && nb.text) || title || '', note: credit ? artist : null, lineText: '', line: li, start: bounds[k], end: bounds[k + 1], layout: 'interlude', enter: 'blur', exit: 'blur', hold: 'still', inDur: 0.3, outDur: 0.3, params, decor: pickDecor(rk, st, en, Object.assign({}, fx, { decor: 1 }), 'interlude'), scheme: sch, seed: k ? J.h(lineSeed, 405, k) : J.h(lineSeed, 405) }));
      }
    }
  });
  // end card for [마무리]: title (or END) + artist from the last line's end to the end of the video
  if (parsed.outro && parsed.lines.length) {
    const os = tm.ends[parsed.lines.length - 1], oe = tm.duration - 0.05;
    if (oe - os > 0.5) {
      const rng = J.rng(J.h(project.seed, 998));
      plan.cuts.push(makeCut({ text: title || 'END', note: artist, lineText: title || 'END', line: -1, start: os, end: oe, layout: 'title', enter: rng.pick(['blur', 'type', 'wipe', 'assemble']), exit: 'blur', hold: 'still', outDur: J.clamp((oe - os) * 0.3, 0.3, 1.2), params: J.LAYOUTS.title.plan(rng, {}, st), decor: [], scheme: schemeIdx, seed: J.h(project.seed, 998, 1) }));
    }
  }
  plan.cuts.sort((a, b) => a.start - b.start);
  plan.cuts.forEach((c, i) => {
    c.index = i;
    if (!zones || c.zone) return;
    if (c.layout === 'interlude') { c.params = Object.assign({}, c.params, { showTitle: false }); return; }   // no lyric: the whole frame
    c.zone = zoneOf(c.line);
  });
  plan.events.sort((a, b) => a.t - b.t);
  plan.energy = audio && audio.energy ? audio.energy : null;
  plan.energyRate = audio && audio.energyRate ? audio.energyRate : 0;
  return plan;
};

/* ---------- 統一感 (unify): the conventions of a hand-made lyric video ----------
   · each part (a block between blank lines) keeps a small palette of layouts / motions / camera / decorations,
     so the part reads as one idea; a new part may bring a new palette and colour scheme
   · a line that comes back (サビ) is shown exactly as it was the first time
   · directional moves alternate (left ↔ right, up ↔ down), strong moves are kept for the lines that matter
   · キメ: lines ending in ! — or, when none is marked, the first line of a part that repeats — get one big cut
   · モーフ between the parts of a line, and 太さ (thin → bold) now and then */
const DIR_PAIRS = { enter: [['slideL', 'slideR'], ['riseMask', 'dropMask'], ['trackIn', 'trackOut'], ['flipX', 'flipY']],
  exit: [['slideOutL', 'slideOutR'], ['sinkMask', 'riseOut'], ['flipOutX', 'flipOutY']],
  cam: [['panL', 'panR'], ['tiltUp', 'tiltDown'], ['dollyIn', 'pullOut']] };
const STRONG = { enter: ['bounceBig', 'whip', 'spin', 'slingshot', 'crumple', 'stamp', 'zoom', 'glitchIn', 'scramble', 'spiralIn', 'rollIn', 'shuffle', 'windBlown', 'matrixRain', 'stopMotion', 'splitFlap'],
  cam: ['earthquake', 'shakeHard', 'crashZoom', 'barrelRoll', 'whipIn', 'snapPan', 'vertigo', 'roll', 'spiralIn', 'jelly', 'bounce', 'beatPunch', 'stepZoom'] };
const KIME = { layout: ['huge', 'huge', 'huge', 'columnsBig', 'columnsBig', 'halftoneBig', 'center'], enter: ['stamp', 'zoom', 'bounceBig', 'overexpose', 'slingshot', 'blur'],
  exit: ['zoomThrough', 'blur', 'shrink', 'zoomFar'], hold: ['still', 'pulse', 'heartbeat'], cam: ['beatPunch', 'crashZoom', 'dollyIn', 'push'] };
const SOFT_ENTER = ['blur', 'fadeStagger', 'trackIn', 'blurStagger', 'cut'];
function makeUnify(lines, C) {
  const { st, en, fx, history } = C;
  const norm = t => String(t || '').replace(/[\s、。，．,.!！?？…・「」『』（）()"'“”‘’~〜ー―-]/g, '');
  // sections
  const sec = [], starts = new Set([0]);
  let si = 0;
  lines.forEach((ln, i) => { if (i > 0 && (ln.gapBefore || ln.interlude || lines[i - 1].interlude)) { si++; starts.add(i); } sec.push(si); });
  // repeats
  const first = new Map(), repeatOf = [], count = new Map();
  lines.forEach((ln, i) => { const k = norm(ln.text); if (ln.interlude || k.length < 2) { repeatOf.push(null); return; } count.set(k, (count.get(k) || 0) + 1); if (first.has(k)) repeatOf.push(first.get(k)); else { first.set(k, i); repeatOf.push(null); } });
  // キメ
  const kime = new Set();
  lines.forEach((ln, i) => { if (ln.impact && !ln.interlude) kime.add(i); });
  if (!kime.size) lines.forEach((ln, i) => { if (starts.has(i) && !ln.interlude && (count.get(norm(ln.text)) || 0) >= 2) kime.add(i); });
  const ok = (g, k) => !!(k && en[g] && en[g][k] !== false && (g === 'layout' ? J.LAYOUTS[k] : g === 'enter' ? J.ENTER[k] : g === 'exit' ? J.EXIT[k] : g === 'hold' ? J.HOLD[k] : g === 'cam' ? J.CAMERA[k] : g === 'treat' ? J.TREAT[k] : g === 'trans' ? J.TRANS[k] : null));
  const pals = new Map(), last = new Map();
  const pal = i => { const s2 = sec[i]; if (!pals.has(s2)) pals.set(s2, { layout: [], enter: [], exit: [], hold: [], cam: [], decor: [], treat: [], trans: [] }); return pals.get(s2); };
  // keep up to max distinct picks per part; once full, mostly reuse them
  const sticky = (i, g, v, max, rng, fits = () => true, reuse = 0.85) => {
    const P = pal(i)[g];
    if (P.length >= max && rng.chance(reuse)) { const pool = P.filter(k => ok(g, k) && fits(k)); if (pool.length) return rng.pick(pool); }
    if (!P.includes(v) && P.length < max) P.push(v);
    return v;
  };
  // alternate directions within a part
  const alternate = (i, g, v) => {
    const key = sec[i] + ':' + g, prev = last.get(key);
    for (const pr of DIR_PAIRS[g] || []) {
      const j = pr.indexOf(v);
      if (j >= 0 && prev && pr.includes(prev)) { const w = pr[1 - pr.indexOf(prev)]; if (ok(g, w)) v = w; }
    }
    last.set(key, v);
    return v;
  };
  const strongRun = new Map();                 // was the previous cut of this part strong?
  const calm = (i, g, v, emph, repick, rng) => {
    const key = sec[i] + ':' + g;
    if (!emph && STRONG[g] && STRONG[g].includes(v) && (strongRun.get(key) || rng.chance(0.55))) {
      for (let t = 0; t < 4; t++) { const w = repick(); if (!STRONG[g].includes(w)) { v = w; break; } }
    }
    strongRun.set(key, !!(STRONG[g] && STRONG[g].includes(v)));
    return v;
  };
  const kimePick = (g, v, rng, fits = () => true) => { const pool = KIME[g].filter(k => ok(g, k) && fits(k)); return pool.length ? rng.pick(pool) : v; };
  const specs = new Map();
  return {
    kime,
    sectionStart: i => starts.has(i),
    layout(i, v, o) {
      const fits = k => J.LAYOUTS[k] && J.LAYOUTS[k].fits(o.nn) && (!o.portrait || J.LAYOUTS[k].portrait !== 0);
      if (o.kime) return kimePick('layout', v, o.rng, k => J.LAYOUTS[k].fits(o.nn));
      return sticky(i, 'layout', v, 3, o.rng, fits, 0.9);
    },
    enter(i, v, o) {
      if (o.kime) return kimePick('enter', v, o.rng);
      v = sticky(i, 'enter', v, 2, o.rng);
      v = calm(i, 'enter', v, o.emph, () => pickEnter(o.rng, st, en, o.layout, o.dur, history, false, o.nn), o.rng);
      return alternate(i, 'enter', v);
    },
    exit(i, v, o) { if (o.kime) return kimePick('exit', v, o.rng); return alternate(i, 'exit', sticky(i, 'exit', v, 2, o.rng)); },
    hold(i, v, o) { if (o.kime) return kimePick('hold', v, o.rng); return sticky(i, 'hold', v, 1, o.rng); },
    cam(i, v, o) {
      if (o.kime) return kimePick('cam', v, o.rng);
      v = sticky(i, 'cam', v, 2, o.rng);
      v = calm(i, 'cam', v, o.emph, () => pickCam(o.rng, st, en, fx, J.LAYOUTS.center, false, history), o.rng);
      return alternate(i, 'cam', v);
    },
    decor(i, list, o) {
      if (o.kime) return [];
      const P = pal(i).decor;
      if (P.length >= 2 && o.rng.chance(0.8)) { const id = o.rng.pick(P); return J.DECOR[id] ? [decorParams(o.rng, id)] : list; }
      for (const d of list) if (!P.includes(d.id) && P.length < 2) P.push(d.id);
      return list;
    },
    treat(i, v, o) { if (o.kime) return 'none'; return sticky(i, 'treat', v, 1, o.rng, () => true, 0.75); },
    trans(i, v, o) { return sticky(i, 'trans', v, 2, o.rng); },
    weightGrow(o) { if (!/^(ja|en)$/.test(C.lang || 'ja') || o.nn > 16 || o.dur < 0.7) return false; return o.rng.chance(o.kime ? 0.45 : 0.14); },
    softEnter(v, rng) { const pool = SOFT_ENTER.filter(k => ok('enter', k)); return pool.length ? rng.pick(pool) : v; },
    again(i, k, txt) { const f = repeatOf[i]; if (f == null) return null; const sp = (specs.get(f) || [])[k]; return sp && sp.text === txt ? sp : null; },
    remember(i, k, txt, cut) {
      if (!specs.has(i)) specs.set(i, []);
      specs.get(i)[k] = { text: txt, layout: cut.layout, enter: cut.enter, exit: cut.exit, hold: cut.hold, params: cut.params, decor: cut.decor, treat: cut.treat, treatP: cut.treatP,
        cam: cut.cam, camP: cut.camP, scheme: cut.scheme, seed: cut.seed, bg: cut.bg, bgP: cut.bgP, weightGrow: !!cut.weightGrow, morph: !!cut.morph };
    },
  };
}

/* 中央を空ける: one scene, the lyric split in two — 「花が」 in the left (top) band, 「咲いた」 in the right (bottom) one.
   Both halves use the same layout, motion, decorations and camera (the same random draws), so it reads as one picture
   with the centre left for the character; the second half follows a beat later. */
function splitHalf(text, lang) {
  const t = String(text || '').trim();
  const n = [...t.replace(/\s+/g, '')].length;
  // between words, as near the middle as possible (「花が」｜「咲いた」, "Good night," | "see you tomorrow")
  const words = (lang === 'en' ? J.phraseChunks(J.chunkText(t)) : J.chunkText(t)).map(w => String(w));
  if (words.length >= 2) {
    const L = w => [...w.replace(/\s+/g, '')].length, total = words.reduce((a2, w) => a2 + L(w), 0);
    let acc = 0, best = 1, bd = 1e9;
    for (let k = 1; k < words.length; k++) { acc += L(words[k - 1]); const d = Math.abs(acc - total / 2); if (d < bd) { bd = d; best = k; } }
    const sep = /[A-Za-z]/.test(t) ? ' ' : '';
    return [words.slice(0, best).join(sep).trim(), words.slice(best).join(sep).trim()];
  }
  // one word: short ones (and single English words) stand on both sides; longer ones split near the middle
  if (n <= 3 || /^[A-Za-z0-9'’-]+$/.test(t)) return [t, t];
  const two = splitToCount([t], 2);
  if (two.length < 2) return [t, t];
  let a = two[0].trim(), b = two.slice(1).join('').trim();
  // a half never starts with a particle, punctuation or a small kana: 「夜明けの色を」｜「覚えてる」, not 「…色」｜「を…」
  for (let g = 0; g < 3 && b.length > 1 && HEAD_BAD.test(b[0]); g++) { a += b[0]; b = b.slice(1); }
  return [a, b];
}
const HEAD_BAD = /[、。，．,.!?！？…・ーっッゃゅょャュョぁぃぅぇぉァィゥェォをがはにでとのへもやよね」』）)]/;
function splitCut(cut, halves, zones, st, dur) {
  const LD = J.LAYOUTS[cut.layout], seed = J.h(cut.seed, 23);
  const planFor = (text, z) => LD.plan(J.rng(seed), { text, n: [...text.replace(/\s+/g, '')].length, W: z.w, H: z.h, dur }, st);
  cut.text = halves[0]; cut.lineText = halves[0]; cut.words = J.chunkText(halves[0]); cut.zone = Object.assign({}, zones[0]);
  cut.params = planFor(halves[0], zones[0]);
  const delay = Math.min(0.12, dur * 0.08);
  const twin = Object.assign({}, cut, { text: halves[1], lineText: halves[1], words: J.chunkText(halves[1]), zone: Object.assign({}, zones[1]), params: planFor(halves[1], zones[1]),
    start: cut.start + delay, bg: 'none', bgP: {}, companion: true, trans: null, transP: {}, transDur: 0, morph: cut.morph });
  twin.dur = twin.end - twin.start;
  delete twin.companion_; cut.companion = twin;
}

/* side bands for 中央を空ける: [a, b] in design pixels. Wide frames: left / right thirds (a little narrower on 21:9);
   tall frames: top / bottom; square-ish frames count as wide. */
J.sideZones = (W, H, dir) => {
  if (H > W * 1.1 && dir === 'lr') { const w = Math.round(W * 0.34); return [{ x: 0, y: 0, w, h: H, side: 'left' }, { x: W - w, y: 0, w, h: H, side: 'right' }]; }   // 縦長で左右に分ける
  if (H > W * 1.1) { const h = Math.round(H * 0.33); return [{ x: 0, y: 0, w: W, h, side: 'top' }, { x: 0, y: H - h, w: W, h, side: 'bottom' }]; }
  const w = Math.round(W * (W / H > 2 ? 0.3 : 0.36));
  return [{ x: 0, y: 0, w, h: H, side: 'left' }, { x: W - w, y: 0, w, h: H, side: 'right' }];
};

function makeCut(o) {
  const c = Object.assign({ hold: 'still', inDur: 0.3, outDur: 0.25, stagger: 0.04, decor: [], params: {}, scheme: 0, emph: false, words: [], note: null, treat: 'none', treatP: {}, bg: 'none', bgP: {}, cam: 'push', camP: {} }, o);
  c.dur = c.end - c.start;
  return c;
}
/* split chunks until there are at least n pieces (longest first: words for Latin text, characters otherwise) */
function splitToCount(chunks, n) {
  const out = chunks.slice();
  let guard = 0;
  while (out.length < n && guard++ < 64) {
    let bi = -1, bl = 1;
    out.forEach((c, i) => { const l = /\s/.test(c.trim()) ? c.trim().split(/\s+/).length : [...c].length; if (l > bl) { bl = l; bi = i; } });
    if (bi < 0) break;
    const c = out[bi].trim();
    let a, b;
    if (/\s/.test(c)) { const w = c.split(/\s+/), h = Math.ceil(w.length / 2); a = w.slice(0, h).join(' '); b = w.slice(h).join(' '); }
    else {
      // at a word boundary nearest the middle when there is one (夜明け|の), else between characters
      const ch = [...c], segs = J.segments ? J.segments(c) : [];
      let cut = Math.ceil(ch.length / 2);
      if (segs.length > 1) { let acc = 0, best = -1, bd = 1e9; for (let k = 0; k < segs.length - 1; k++) { acc += [...segs[k]].length; const d = Math.abs(acc - ch.length / 2); if (d < bd) { bd = d; best = acc; } } if (best > 0) cut = best; }
      a = ch.slice(0, cut).join(''); b = ch.slice(cut).join('');
    }
    out.splice(bi, 1, a, b);
  }
  return out;
}
function partition(chunks, k) {
  const lens = chunks.map(c => [...c].length + 1);
  const tot = lens.reduce((a, b) => a + b, 0), target = tot / k;
  const groups = []; let cur = [], acc = 0, remainingGroups = k;
  chunks.forEach((c, i) => {
    const remainingChunks = chunks.length - i;
    if (cur.length && (acc + lens[i] / 2 > target || remainingChunks < remainingGroups) && groups.length < k - 1) { groups.push(cur); cur = []; acc = 0; remainingGroups--; }
    cur.push(c); acc += lens[i];
  });
  if (cur.length) groups.push(cur);
  return groups;
}
function novelty(history, key, val) {
  let w = 1;
  for (let i = history.length - 1, d = 0; i >= 0 && d < 6; i--, d++) if (history[i][key] === val) w *= d < 2 ? 0.2 : 0.6;
  return w;
}
const PORTRAIT_W = { vcols: 1.9, condensed: 1.3, huge: 1.3, center: 1.2, stack: 1.1, mixed: 0.7, marquee: 0.6, wave: 0.6, diag: 0.8, type: 0.8, gloss: 0.5 };
function pickLayout(rng, st, en, n, dur, history, emph, recap, portrait) {
  const cands = [];
  for (const k of J.LAYOUT_ORDER) {
    const L = J.LAYOUTS[k];
    if (!en.layout[k] || !L.fits(n)) continue;
    let w = wkey(st.bias.layout, k, L.w ?? 1) * novelty(history, 'layout', k);
    if (portrait) w *= L.portrait != null ? L.portrait : wkey(PORTRAIT_W, k, 1);
    if (emph && L.emph) w *= L.emph;
    if (emph && ['huge', 'center', 'tile', 'marquee', 'condensed'].includes(k)) w *= 2;
    if (recap && ['center', 'stack', 'marquee', 'tile', 'mixed', 'type', 'gloss'].includes(k)) w *= 1.8;
    if (dur < 0.5 && ['wave', 'ring', 'labels', 'gloss', 'type', 'tile'].includes(k)) w *= 0.3;
    if (dur < 0.5 && ['center', 'huge', 'condensed', 'vcols'].includes(k)) w *= 1.4;
    cands.push([k, w]);
  }
  if (!cands.length) return 'center';
  return rng.wpick(cands);
}
const LAYOUT_ENTER = {
  type: { type: 4, scramble: 1.5 }, ring: { pop: 2, spin: 2, cut: 1, assemble: 0.4, slice: 0.2, wipe: 0.2 }, labels: { cut: 3, pop: 1 },
  wave: { pop: 1.5, drop: 1.5, blur: 1, slice: 0.3 }, tile: { assemble: 1.3, slice: 1.4, zoom: 1.4 }, huge: { zoom: 1.5, wipe: 1.5, slice: 1.4, stretch: 1.3, type: 0.2 },
  mixed: { pop: 1.6, drop: 1.6, spin: 1.3 }, scatter: { pop: 1.5, spin: 1.5, drop: 1.2, assemble: 1.3 }, vcols: { assemble: 1.8, type: 1.2 }, pill: { wipe: 1.8, type: 1.2 },
};
function pickEnter(rng, st, en, layout, dur, history, emph, n) {
  const cands = [];
  for (const k of J.ENTER_ORDER) {
    if (!en.enter[k]) continue;
    const D = J.ENTER[k]; if (!D) continue;
    const LD = J.LAYOUTS[layout] || {};
    let w = wkey(st.bias.enter, k, D.w ?? 1) * novelty(history, 'enter', k) * wkey(LAYOUT_ENTER[layout] || LD.enterBias, k, 1);
    if (D.minDur && dur < D.minDur) w *= 0.15;
    if (D.maxChars && n > D.maxChars) w *= 0.2;
    if (k === 'cut') w *= 0.5;
    if (dur < 0.45 && ['type', 'assemble', 'drop', 'spin', 'pop', 'flicker'].includes(k)) w *= 0.25;
    if (dur < 0.45 && ['cut', 'slice', 'zoom', 'stretch'].includes(k)) w *= 1.8;
    if (k === 'type' && n > 18) w *= 0.3;
    if (emph && ['zoom', 'assemble', 'slice'].includes(k)) w *= 1.8;
    cands.push([k, w]);
  }
  return cands.length ? rng.wpick(cands) : 'cut';
}
function pickExit(rng, st, en, layout, dur, lastOfLine, history) {
  const cands = [];
  for (const k of J.EXIT_ORDER) {
    if (!en.exit[k]) continue;
    const D = J.EXIT[k]; if (!D) continue;
    let w = wkey(st.bias.exit, k, D.w ?? 1) * novelty(history, 'exit', k);
    if (D.minDur && dur < D.minDur) w *= 0.15;
    if (k === 'cut') w *= dur < 0.6 ? 4 : lastOfLine ? 1.2 : 2.2;
    if (dur < 0.6 && k !== 'cut') w *= 0.4;
    if (['labels', 'ring', 'tile'].includes(layout) && ['explode', 'fall', 'drift'].includes(k)) w *= 0.3;
    cands.push([k, w]);
  }
  return cands.length ? rng.wpick(cands) : 'cut';
}
const HOLD_W = { still: 1, jitter: 1.2, drift: 1, breathe: 0.7, wave: 0.4, glitchtick: 0.9 };
function pickHold(rng, en, fx, history) {
  const cands = J.HOLD_ORDER.filter(k => en.hold[k] !== false && J.HOLD[k]).map(k => {
    const D = J.HOLD[k];
    let w = HOLD_W[k] != null ? HOLD_W[k] : (D.w ?? 0.8);
    if (k === 'jitter' || (D.tags && D.tags.includes('glitch'))) w *= 0.4 + fx.motion;
    if (k === 'glitchtick') w *= fx.glitch;
    return [k, w * novelty(history, 'hold', k)];
  });
  return cands.length ? rng.wpick(cands) : 'still';
}
function decorParams(rng, k) {
  return { id: k, seed: rng.int(1, 1e9), n: rng.int(1, 3) + (k === 'shapes' ? 3 : 0) + (k === 'sparks' ? 4 : 0), right: rng.chance(0.5), low: rng.chance(0.5), accent: rng.chance(0.4), corner: rng.chance(0.5), big: rng.chance(0.4), mode: rng.pick(['count', 'index']), from: rng.int(0, 20), to: rng.int(30, 999), v: rng.int(0, 5), r: rng() };
}
const INTER_EXTRA = ['countdown', 'preview', 'progress', 'wave'];
function pickDecor(rng, st, en, fx, layout, history = []) {
  const count = Math.round(fx.decor * 2.8 * rng.range(0.45, 1.15));
  const recent = new Set(history.slice(-2).flatMap(h => h.decor || []));
  const LD = J.LAYOUTS[layout] || {};
  const cands = J.DECOR_ORDER.filter(k => en.decor[k] && J.DECOR[k] && !(LD.busy && J.DECOR[k].layer === 'back' && !J.DECOR[k].subtle))
    .map(k => [k, wkey(st.decor, k, J.DECOR[k].w != null ? J.DECOR[k].w * 0.5 : 0.35) * (recent.has(k) ? 0.35 : 1)]);
  const out = [];
  for (let i = 0; i < count && cands.length; i++) {
    const k = rng.wpick(cands);
    cands.splice(cands.findIndex(c => c[0] === k), 1);
    out.push(decorParams(rng, k));
  }
  return out;
}
// text treatment: plain most of the time; the "decor" slider raises how often a treatment is used
function pickTreat(rng, st, en, fx, LD, emph, history, synced) {
  if (LD.treat === false) return 'none';
  if (!rng.chance(0.18 + 0.42 * (fx.decor ?? 0.5) + (emph ? 0.15 : 0))) return 'none';
  const cands = J.TREAT_ORDER.filter(k => k !== 'none' && en.treat && en.treat[k] !== false && J.TREAT[k] && (LD.treat !== 'safe' || J.TREAT[k].safe))
    .map(k => [k, wkey(st.bias && st.bias.treat, k, J.TREAT[k].w ?? 1) * novelty(history, 'treat', k) * (synced && k === 'karaoke' ? 3 : 1)]);
  return cands.length ? rng.wpick(cands) : 'none';
}
/* character index (in the line text) where each unit starts — units are chunks joined without the original spaces */
function unitCharStarts(text, units) {
  const T = [...text], out = []; let cur = 0;
  for (const u of units) {
    while (cur < T.length && /\s/.test(T[cur])) cur++;
    out.push(cur);
    for (const ch of u.text) { if (/\s/.test(ch)) continue; while (cur < T.length && /\s/.test(T[cur])) cur++; if (T[cur] !== ch) return null; cur++; }
  }
  return out;
}
/* time a character is sung, interpolated between word marks (after the last mark: towards tEnd) */
function markTime(marks, ci, N, tEnd) {
  if (ci <= marks[0].ci) return marks[0].t;
  let i = 0; while (i + 1 < marks.length && marks[i + 1].ci <= ci) i++;
  const a = marks[i], b = marks[i + 1] || { t: Math.max(a.t, tEnd), ci: Math.max(N, a.ci + 1) };
  return a.t + (b.t - a.t) * J.clamp((ci - a.ci) / Math.max(1, b.ci - a.ci));
}
function pickBg(rng, st, en, fx, bgHist) {
  if (!rng.chance(0.2 + 0.35 * (fx.decor ?? 0.5) + 0.2 * (fx.bgSwitch ?? 0.35))) return 'none';
  const last = bgHist.slice(-3);
  const cands = J.BG_ORDER.filter(k => k !== 'none' && en.bg && en.bg[k] !== false && J.BG[k])
    .map(k => [k, wkey(st.bias && st.bias.bg, k, J.BG[k].w ?? 1) * (last.includes(k) ? 0.25 : 1)]);
  return cands.length ? rng.wpick(cands) : 'none';
}
function pickCam(rng, st, en, fx, LD, emph, history) {
  const cands = J.CAMERA_ORDER.filter(k => en.cam && en.cam[k] !== false && J.CAMERA[k]).map(k => {
    const D = J.CAMERA[k];
    let w = wkey(st.bias && st.bias.cam, k, D.w ?? 1) * novelty(history, 'cam', k);
    if (D.strong) w *= 0.25 + 0.9 * (fx.motion ?? 0.7) + (emph ? 0.6 : 0);
    if (LD.cam === false && k !== 'push') w *= 0.05;
    return [k, w];
  });
  return cands.length ? rng.wpick(cands) : 'push';
}
function pickTrans(rng, st, en, fx, emph, history) {
  if (!J.TRANS_ORDER.length) return null;
  if (!rng.chance(0.1 + 0.22 * (fx.motion ?? 0.7) + (emph ? 0.08 : 0))) return null;
  const cands = J.TRANS_ORDER.filter(k => en.trans && en.trans[k] !== false && J.TRANS[k])
    .map(k => [k, wkey(st.bias && st.bias.trans, k, J.TRANS[k].w ?? 1) * novelty(history, 'trans', k)]);
  return cands.length ? rng.wpick(cands) : null;
}
// kind 'edge' = transition at a cut boundary, 'mid' = accent in the middle of a cut, 'force' = an edge effect that always fires
function pickFx(rng, st, en, fx, emph, fxHist, kind) {
  const g = fx.glitch ?? 0.55;
  const p = kind === 'edge' ? 0.12 + 0.38 * g + 0.12 * (fx.motion ?? 0.7) + (emph ? 0.15 : 0) : 0.05 + 0.2 * g;
  if (kind === 'force') kind = 'edge'; else if (!rng.chance(p)) return null;
  const last = fxHist.slice(-3);
  const cands = J.FXE_ORDER.filter(k => { const D = J.FXE[k]; return D && !D.builtin && en.fx && en.fx[k] !== false && (kind === 'edge' ? D.edge !== false : D.mid); })
    .map(k => { const D = J.FXE[k]; let w = wkey(st.bias && st.bias.fx, k, D.w ?? 1) * (last.includes(k) ? 0.2 : 1); if (D.glitchy) w *= 0.3 + g * 1.4; return [k, w]; });
  return cands.length ? rng.wpick(cands) : null;
}

J.designSize = (aspect) => {
  if (aspect === '9:16') return [1080, 1920];
  if (aspect === '1:1') return [1440, 1440];
  if (aspect === '4:5') return [1440, 1800];
  if (aspect === '21:9') return [2520, 1080];
  if (aspect === '4:3') return [1440, 1080];
  if (aspect === '3:4') return [1080, 1440];
  return [1920, 1080];
};
J.outputSize = (project) => {
  const [W, H] = J.designSize(project.aspect);
  const k = (project.res || 1080) / Math.min(W, H);
  return [Math.round(W * k / 2) * 2, Math.round(H * k / 2) * 2];
};
})();
