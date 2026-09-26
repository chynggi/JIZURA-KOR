/* ============================================================
   JIZURA — audio: decode, energy envelope, onset, BPM & beat grid
   ============================================================ */
(() => {
'use strict';

J.analyzeAudio = async (file) => {
  const buf = await file.arrayBuffer();
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();
  let audioBuffer;
  try { audioBuffer = await ac.decodeAudioData(buf.slice(0)); } finally { try { ac.close(); } catch (e) {} }
  const sr = audioBuffer.sampleRate, len = audioBuffer.length, ch = audioBuffer.numberOfChannels;
  const mono = new Float32Array(len);
  for (let c = 0; c < ch; c++) { const d = audioBuffer.getChannelData(c); for (let i = 0; i < len; i++) mono[i] += d[i] / ch; }
  const rate = 50, hop = Math.round(sr / rate), n = Math.floor(len / hop);
  const energy = new Float32Array(n), flux = new Float32Array(n);
  let prevHP = 0, prevX = 0;
  for (let f = 0; f < n; f++) {
    let e = 0, eh = 0;
    for (let i = f * hop, end = Math.min(len, (f + 1) * hop); i < end; i++) {
      const x = mono[i]; e += x * x;
      const hp = 0.92 * (prevHP + x - prevX); prevHP = hp; prevX = x; eh += hp * hp;
    }
    energy[f] = Math.sqrt(e / hop);
    flux[f] = Math.sqrt(eh / hop);
  }
  // onset strength: positive change of log high-passed energy vs local mean
  const onset = new Float32Array(n);
  for (let f = 1; f < n; f++) {
    const cur = Math.log(1e-4 + flux[f]);
    let m = 0, k = 0; for (let j = Math.max(0, f - 4); j < f; j++) { m += Math.log(1e-4 + flux[j]); k++; }
    onset[f] = Math.max(0, cur - m / Math.max(1, k));
  }
  // tempo via autocorrelation (70..180 BPM)
  const minLag = Math.round(rate * 60 / 180), maxLag = Math.round(rate * 60 / 70);
  let best = 0, bestLag = Math.round(rate * 0.5);
  const scores = [];
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0; for (let f = lag; f < n; f++) s += onset[f] * onset[f - lag];
    const bpm = 60 * rate / lag;
    const w = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 125) / 0.7, 2));
    s *= w; scores[lag] = s;
    if (s > best) { best = s; bestLag = lag; }
  }
  let lagF = bestLag;
  if (scores[bestLag - 1] != null && scores[bestLag + 1] != null) {
    const a = scores[bestLag - 1], b = scores[bestLag], c = scores[bestLag + 1];
    const d = (a - 2 * b + c); if (d !== 0) lagF = bestLag + 0.5 * (a - c) / d;
  }
  const period = lagF / rate;
  // phase
  let bestPh = 0, bestPS = -1;
  for (let ph = 0; ph < lagF; ph += 0.5) {
    let s = 0; for (let t = ph; t < n; t += lagF) s += onset[Math.round(t)] || 0;
    if (s > bestPS) { bestPS = s; bestPh = ph; }
  }
  const beats = [];
  for (let t = bestPh / rate; t < audioBuffer.duration; t += period) beats.push(+t.toFixed(4));
  // normalised energy (0..1, 95th percentile)
  const sorted = Array.from(energy).sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 1;
  const energyN = new Float32Array(n);
  for (let f = 0; f < n; f++) energyN[f] = Math.min(1, energy[f] / p95);
  // waveform peaks for the timeline
  const bins = 1600, peaks = new Float32Array(bins), per = Math.max(1, Math.floor(len / bins));
  for (let b = 0; b < bins; b++) { let m = 0; for (let i = b * per, e = Math.min(len, (b + 1) * per); i < e; i += 4) { const v = Math.abs(mono[i]); if (v > m) m = v; } peaks[b] = m; }
  return {
    name: file.name, duration: audioBuffer.duration, sampleRate: sr, buffer: audioBuffer,
    bpm: Math.round(60 / period * 10) / 10, beats, energy: energyN, energyRate: rate, peaks,
  };
};

/* 16-bit PCM WAV of an AudioBuffer, cut / padded to `duration` seconds (the soundtrack next to an MP4 whose
   audio track some players cannot play, or when the browser has no audio encoder) */
J.audioWav = (buffer, duration, offset = 0) => {
  const sr = buffer.sampleRate, chn = Math.min(2, buffer.numberOfChannels);
  const n = Math.max(1, Math.round((duration > 0 ? duration : buffer.duration) * sr));
  const bytes = n * chn * 2, ab = new ArrayBuffer(44 + bytes), v = new DataView(ab);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + bytes, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, chn, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * chn * 2, true); v.setUint16(32, chn * 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, bytes, true);
  const ch = []; for (let c = 0; c < chn; c++) ch.push(buffer.getChannelData(c));
  const L = buffer.length, i0 = Math.max(0, Math.round(offset * sr)); let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < chn; c++) {
    const j = i + i0, x = j < L ? Math.max(-1, Math.min(1, ch[c][j])) : 0;
    v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true); o += 2;
  }
  return new Blob([ab], { type: 'audio/wav' });
};

/* the last song, kept in this browser (IndexedDB) so a reload does not silently drop the audio from exports */
const IDB = { db: null };
IDB.open = () => IDB.db || (IDB.db = new Promise((res, rej) => {
  if (typeof indexedDB === 'undefined') return rej(new Error('no IndexedDB'));
  const r = indexedDB.open('jizura', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('files'); };
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
}));
J.loadSong = async () => {
  try {
    const db = await IDB.open();
    const rec = await new Promise((res, rej) => { const tx = db.transaction('files', 'readonly'); const q = tx.objectStore('files').get('song'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    if (!rec || !rec.data) return null;
    return new File([rec.data], rec.name || 'song', { type: rec.type || '' });
  } catch (e) { return null; }
};
J.saveFontData = async (key, data) => {
  try { const db = await IDB.open(); await new Promise((res, rej) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put({ data }, 'font:' + key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); return true; } catch (e) { return false; }
};
J.loadFontData = async (key) => {
  try { const db = await IDB.open(); const rec = await new Promise((res, rej) => { const tx = db.transaction('files', 'readonly'); const q = tx.objectStore('files').get('font:' + key); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); return rec && rec.data ? rec.data : null; } catch (e) { return null; }
};
J.forgetSong = async () => {
  try { const db = await IDB.open(); await new Promise(res => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').delete('song'); tx.oncomplete = res; tx.onerror = res; }); } catch (e) {}
};
/* other files kept in the same store (소재 images and their masks): { name, type, data: ArrayBuffer } */
J.idbPut = async (key, rec) => {
  try {
    const db = await IDB.open();
    await new Promise((res, rej) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put(rec, key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    return true;
  } catch (e) { return false; }
};
J.idbGet = async (key) => {
  try {
    const db = await IDB.open();
    return await new Promise((res, rej) => { const tx = db.transaction('files', 'readonly'); const q = tx.objectStore('files').get(key); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); });
  } catch (e) { return null; }
};
J.idbDel = async (key) => {
  try { const db = await IDB.open(); await new Promise(res => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').delete(key); tx.oncomplete = res; tx.onerror = res; }); } catch (e) {}
};

/* 곡에서 초안: guess where each lyric line starts from the song alone.
   The voice band (200 Hz – 3.5 kHz) is followed at 100 fps; a phrase start is a clear rise of that level after a
   quieter stretch. Then one start per line is chosen in order (dynamic programming): strong rises, with the gaps
   between them close to what the lengths of the lines suggest. Returns seconds, one per line (a draft to fix by hand). */
J.draftLineStarts = async (audio, texts) => {
  const n = texts.length, buf = audio && audio.buffer;
  if (!n || !buf) return [];
  const sr = Math.min(22050, buf.sampleRate), len = Math.ceil(buf.duration * sr);
  const oc = new OfflineAudioContext(1, len, sr);
  const src = oc.createBufferSource(); src.buffer = buf;
  const hp = oc.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 200;
  const lp = oc.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3500;
  src.connect(hp); hp.connect(lp); lp.connect(oc.destination); src.start();
  const x = (await oc.startRendering()).getChannelData(0);
  const rate = 100, hop = Math.round(sr / rate), F = Math.floor(x.length / hop);
  const db = new Float32Array(F);
  for (let f = 0; f < F; f++) { let e = 0; for (let i = f * hop, end = i + hop; i < end; i++) e += x[i] * x[i]; db[f] = 10 * Math.log10(e / hop + 1e-10); }
  // activity 0..1 between the noise floor (20th percentile) and the loud parts (97th), lightly smoothed
  const sorted = Array.from(db).sort((a, b) => a - b), lo = sorted[Math.floor(F * 0.2)], hi = sorted[Math.floor(F * 0.97)];
  const act = new Float32Array(F);
  for (let f = 0; f < F; f++) { let s = 0, k = 0; for (let j = Math.max(0, f - 2); j <= Math.min(F - 1, f + 2); j++) { s += db[j]; k++; } act[f] = J.clamp((s / k - lo) / Math.max(1, hi - lo)); }
  const mean = (a, b) => { a = Math.max(0, a); b = Math.min(F, b); let s = 0; for (let f = a; f < b; f++) s += act[f]; return b > a ? s / (b - a) : 0; };
  // phrase-start candidates: local maxima of "level after − level before"
  const rise = new Float32Array(F);
  for (let f = 1; f < F - 1; f++) { const after = mean(f, f + 30), before = mean(f - 40, f - 3); rise[f] = Math.max(0, after - before) * (after > 0.35 ? 1 : 0.3); }
  const cand = [];
  for (let f = 1; f < F - 1; f++) {
    if (rise[f] < 0.08) continue;
    let top = true; for (let j = Math.max(0, f - 30); j <= Math.min(F - 1, f + 30); j++) if (rise[j] > rise[f] || (rise[j] === rise[f] && j < f)) { top = false; break; }
    if (!top) continue;
    // exact start: where the level first crosses halfway between before and after, searching back from the peak
    const before = mean(f - 40, f - 3), after = mean(f, f + 30), mid = (before + after) / 2;
    let s = f; for (let j = f + 15; j >= f - 20; j--) if (j >= 0 && j < F && act[j] >= mid && (j === 0 || act[j - 1] < mid)) { s = j; break; }
    cand.push({ t: s / rate, w: rise[f] });
  }
  const chars = texts.map(t => Math.max(2, [...String(t).replace(/\s+/g, '')].length));
  if (cand.length < n) {                        // too few clear starts: spread the lines by length over the song
    const t0 = cand.length ? cand[0].t : 0.5, t1 = Math.max(t0 + n, audio.duration - 1), tot = chars.reduce((a, b) => a + b, 0);
    let acc = t0; return chars.map(c => { const s = acc; acc += (t1 - t0) * c / tot; return +s.toFixed(3); });
  }
  // seconds per character, from the part of the song that has voice
  const m = cand.length, span = cand[m - 1].t - cand[0].t, per = span > 0 ? span / chars.slice(0, -1).reduce((a, b) => a + b, 1) : 0.3;
  const pen = (gap, exp) => (gap < 0.5 ? 1e9 : gap < exp ? Math.pow(Math.log(exp / gap), 2) * 1.2 : Math.pow(Math.log(gap / exp), 2) * 0.25);
  // best[k][j]: best score with line k starting at candidate j
  const best = [], from = [];
  for (let k = 0; k < n; k++) {
    best.push(new Float64Array(m).fill(-Infinity)); from.push(new Int32Array(m).fill(-1));
    for (let j = k; j < m - (n - 1 - k); j++) {
      if (k === 0) { best[0][j] = cand[j].w; continue; }
      const exp = chars[k - 1] * per;
      for (let i = k - 1; i < j; i++) {
        if (best[k - 1][i] === -Infinity) continue;
        const v = best[k - 1][i] + cand[j].w - 0.4 * pen(cand[j].t - cand[i].t, exp);
        if (v > best[k][j]) { best[k][j] = v; from[k][j] = i; }
      }
    }
  }
  let j = 0; for (let q = 1; q < m; q++) if (best[n - 1][q] > best[n - 1][j]) j = q;
  const out = new Array(n);
  for (let k = n - 1; k >= 0; k--) { out[k] = +cand[j].t.toFixed(3); j = from[k][j]; }
  return out;
};

/* rebuild a beat grid from a user BPM + first-beat offset */
J.beatGrid = (bpm, offset, duration) => {
  const out = []; if (!(bpm > 0)) return out;
  const p = 60 / bpm;
  for (let t = offset; t < duration + 0.01; t += p) if (t >= 0) out.push(+t.toFixed(4));
  return out;
};
})();
