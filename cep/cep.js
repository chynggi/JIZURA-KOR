/* ============================================================
   JIZURA — After Effects CEP panel bridge
   Runs only inside the AE panel (window.__adobe_cep__). Adds "build the comp in AE",
   "use the song / markers of the selected AE layer", native save dialogs and external links.
   Talks to ../jsx/host.jsx (JZCEP.*) with evalScript; every host call returns JSON.
   ============================================================ */
(() => {
'use strict';
const CEP = window.__adobe_cep__;
if (!CEP) return;
const J = window.J, S = J.ui, UI = J.uiApi || {};
const $ = id => document.getElementById(id);
document.documentElement.classList.add('cep');

// Node.js (enabled in the manifest): cep_node in CEP 8+, or a plain require in mixed context
const nodeReq = (window.cep_node && window.cep_node.require) || (typeof window.require === 'function' ? window.require : null);
const fs = nodeReq ? nodeReq('fs') : null, os = nodeReq ? nodeReq('os') : null, pathM = nodeReq ? nodeReq('path') : null;
const NodeBuffer = (window.cep_node && window.cep_node.Buffer) || (typeof window.Buffer === 'function' ? window.Buffer : null);

const ev = code => new Promise(res => { try { CEP.evalScript(code, r => res(r)); } catch (e) { res('EvalScript error.'); } });
const parse = r => { try { const o = JSON.parse(r); return o && typeof o === 'object' ? o : { ok: false, error: String(r) }; } catch (e) { return { ok: false, error: String(r || 'no answer') }; } };
const toast = m => { try { UI.toast ? UI.toast(m) : console.log(m); } catch (e) {} };
function extRoot() {
  let p = '';
  try { p = decodeURI(CEP.getSystemPath('extension')); } catch (e) {}
  p = p.replace(/^file:\/\//, '');
  if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1);      // Windows: /C:/… -> C:/…
  return p;
}

// ---------------- connection to AE ----------------
let ready = false, connecting = null, aeAudio = null;
function status(m, bad) { document.querySelectorAll('.ae-status').forEach(el => { el.textContent = m; el.classList.toggle('bad', !!bad); }); }
function connect() {
  if (ready) return Promise.resolve(true);
  if (connecting) return connecting;
  connecting = (async () => {
    status('After Effects에 연결 중…(처음에는 몇 초 걸립니다)');
    const root = extRoot();
    if ((await ev('typeof JZCEP')) !== 'object' && root) await ev('$.evalFile(File(' + JSON.stringify(root + '/jsx/host.jsx') + '))');
    const r = parse(await ev('JZCEP.init(' + JSON.stringify(root) + ')'));
    ready = !!r.ok;
    status(ready ? `After Effects ${String(r.app || '').split('x')[0]}에 연결했습니다` : 'After Effects에 연결할 수 없었습니다: ' + r.error, !ready);
    connecting = null;
    return ready;
  })();
  return connecting;
}

// ---------------- build the comp ----------------
let building = false;
async function buildInAE() {
  if (building) return;
  if (!(await connect())) { toast('After Effects에 연결할 수 없었습니다'); return; }
  building = true; setBusy(true);
  try {
    UI.pause && UI.pause();
    const plan = J.planForAE(S.plan, S.project), txt = JSON.stringify(plan);
    const useAudio = aeAudio && (!$('aeAudioIn') || $('aeAudioIn').checked);
    const aid = useAudio ? (aeAudio.id | 0) : 0;
    status(`컴포 생성 중…(${plan.cuts.length}컷)`);
    await new Promise(r => setTimeout(r, 30));              // let the status paint before AE blocks
    let r;
    if (fs && os && pathM) {
      const p = pathM.join(os.tmpdir(), 'jizura_plan_' + Date.now() + '.json');
      fs.writeFileSync(p, txt, 'utf8');
      r = parse(await ev('JZCEP.buildFromFile(' + JSON.stringify(p) + ',' + aid + ')'));
    } else {
      r = parse(await ev('JZCEP.buildFromString(' + JSON.stringify(encodeURIComponent(txt)) + ',' + aid + ')'));
    }
    if (r.ok) {
      let m = `「${r.name}」을(를) 만들었습니다(${r.cuts}컷·${(+r.secs).toFixed(1)}초${r.audio ? '·곡 포함' : ''})`;
      if (r.fallbacks > 0) m += ` / 비슷한 표현으로 교체 ${r.fallbacks}곳`;
      if (r.notesTotal > 0) m += ` / 주의 ${r.notesTotal}건`;
      if (r.missingFonts && r.missingFonts.length) m += ` / 이 PC에 없는 서체(${r.missingFonts.join('·')})는 비슷한 서체로 만들었습니다. Google Fonts에서 설치하고 AE를 다시 시작하면 같은 서체가 됩니다`;
      if (r.fontCheck === false) m += ' / 이 AE(2024 이전)에서는 서체 설치 여부를 확인할 수 없어 스크립트 버전 패널 「폰트」 탭의 서체(설정하지 않았으면 맑은 고딕·바탕)로 만들었습니다';
      status(m); toast('After Effects에 컴포를 만들었습니다');
      if (r.notes && r.notes.length) console.warn('JIZURA AE notes', r.notes);
    } else { status('만들 수 없었습니다: ' + r.error, true); toast('만들 수 없었습니다'); }
  } catch (e) { status('만들 수 없었습니다: ' + (e && e.message ? e.message : e), true); }
  finally { building = false; setBusy(false); }
}
function setBusy(b) { document.querySelectorAll('.ae-build').forEach(el => { el.disabled = b; }); }
async function diagnose() {
  if (!(await connect())) return;
  status('진단 중…(수십 초 걸릴 수 있습니다)');
  await new Promise(r => setTimeout(r, 30));
  const r = parse(await ev('JZCEP.diagnose()'));
  if (!r.ok) { status(r.error, true); toast(r.error); return; }
  status(`진단: 표현식 ${r.expressions}개 중 오류 ${r.errors}개${r.partial ? '(일부만)' : ''}` + (r.path ? ` / 리포트: ${r.path}` : ' / 리포트를 저장할 수 없었습니다(AE 환경 설정 「스크립트의 파일 쓰기… 허용」을 켜 주세요)'));
}

// ---------------- song / markers from the AE timeline ----------------
async function useAEAudio() {
  if (!(await connect())) return;
  const r = parse(await ev('JZCEP.selectedAudio()'));
  if (!r.ok) { toast(r.error); status(r.error, true); return; }
  if (!fs) { toast('이 패널에서는 곡 파일을 직접 읽을 수 없습니다. 「곡 불러오기」에서 골라 주세요'); return; }
  try {
    const buf = fs.readFileSync(r.path), u8 = new Uint8Array(buf.length); u8.set(buf);
    const ok = UI.loadAudioFile ? await UI.loadAudioFile(new File([u8], r.name)) : false;
    if (ok) {
      aeAudio = { id: r.id, name: r.name, start: r.start };
      document.querySelectorAll('.ae-audio-row').forEach(el => { el.hidden = false; });
      document.querySelectorAll('.ae-audio-name').forEach(el => { el.textContent = r.name; });
      toast(`AE의 「${r.name}」로 박자를 맞췄습니다`);
    } else toast('이 곡 파일은 불러올 수 없었습니다(wav / mp3 / m4a 등을 사용해 주세요)');
  } catch (e) { toast('곡 파일을 읽을 수 없었습니다: ' + e.message); }
}
async function useAEMarkers() {
  if (!(await connect())) return;
  const r = parse(await ev('JZCEP.markers()'));
  if (!r.ok) { toast(r.error); status(r.error, true); return; }
  const n = S.plan.lines.length, lt = {};
  r.times.slice(0, n).forEach((t, i) => { lt[i] = +(+t).toFixed(3); });
  S.project.timing.lineTimes = lt;
  UI.replan && UI.replan(); UI.syncUI && UI.syncUI(); UI.flushSave && UI.flushSave();
  toast(`${r.source === 'layer' ? '레이어' : '컴포'} 마커 ${Object.keys(lt).length}개를 행 시작 시각으로 했습니다` + (r.times.length < n ? `(나머지 ${n - r.times.length}행은 자동)` : ''));
}

// ---------------- UI ----------------
function btn(id, text, cls, fn) { const b = document.createElement('button'); b.id = id; b.textContent = text; if (cls) b.className = cls; b.addEventListener('click', fn); return b; }
function inject() {
  // header: "AE用に書き出し" (JSON) -> build right here
  const hb = $('btnAE');
  if (hb) {
    const nb = hb.cloneNode(true); hb.replaceWith(nb);
    nb.textContent = 'AE에서 컴포 생성'; nb.title = '현재 구성으로 After Effects에 컴포를 만듭니다'; nb.classList.add('ae-build');
    nb.addEventListener('click', buildInAE);
  }
  // song & timing: take them from the AE timeline
  const tim = $('audioFile') && $('audioFile').closest('.row');
  if (tim) {
    const row = document.createElement('div'); row.className = 'row wrap ae-row';
    row.append(btn('aeAudio', 'AE에서 선택한 곡', 'small', useAEAudio), btn('aeMarkers', 'AE 마커를 행 시작에', 'small', useAEMarkers));
    row.querySelector('#aeAudio').title = 'AE에서 선택한 곡 레이어를 불러와 박자에 맞춥니다(컴포를 만들 때 그 곡도 들어갑니다)';
    row.querySelector('#aeMarkers').title = '선택 레이어(없으면 컴포)의 마커를 각 행의 시작 시각으로 씁니다';
    tim.after(row);
  }
  $('audioFile') && $('audioFile').addEventListener('change', () => { aeAudio = null; document.querySelectorAll('.ae-audio-row').forEach(el => { el.hidden = true; }); });
  // easy mode export: AE first
  const eMP4 = $('eMP4');
  if (eMP4) {
    eMP4.classList.remove('primary');
    const box = document.createElement('div'); box.className = 'ae-box';
    box.innerHTML = '<div class="outbtns"></div><label class="row ae-audio-row" hidden><input type="checkbox" class="ae-audio-in" checked><span>곡(<span class="ae-audio-name"></span>)을 컴포에 넣기</span></label><p class="note ae-status">—</p>';
    box.querySelector('.outbtns').append(btn('eAEBuild', 'After Effects에 컴포 만들기', 'primary ae-build', buildInAE));
    eMP4.closest('.outbtns').before(box);
  }
  // pro mode: an After Effects block at the top of the output tab
  const pane = document.querySelector('[data-pane="out"]');
  if (pane) {
    const box = document.createElement('div'); box.className = 'ae-box';
    box.innerHTML = '<h3>After Effects</h3><div class="outbtns"></div><label class="row ae-audio-row" hidden><input id="aeAudioIn" type="checkbox" class="ae-audio-in" checked><span>곡(<span class="ae-audio-name"></span>)을 컴포에 넣기</span></label><p class="note ae-status">—</p><h3>동영상·이미지</h3>';
    box.querySelector('.outbtns').append(btn('aeBuild', 'AE에서 컴포 생성', 'primary ae-build', buildInAE), btn('aeDiag', '진단 리포트 저장', 'small', diagnose));
    box.querySelector('#aeDiag').title = '마지막으로 만든 컴포를 조사해 JIZURA_report.txt를 저장합니다(잘 만들어지지 않을 때 보내 주세요)';
    pane.prepend(box);
    const m = $('btnMP4'); m && m.classList.remove('primary');
  }
  // keep the two "include the song" checkboxes in step
  document.querySelectorAll('.ae-audio-in').forEach(cb => cb.addEventListener('change', () => { document.querySelectorAll('.ae-audio-in').forEach(o => { o.checked = cb.checked; }); }));
  const style = document.createElement('style');
  style.textContent = '.ae-row{margin-top:8px;gap:6px}.ae-box{margin-bottom:12px}.ae-box h3{margin:0 0 8px}.ae-status{margin-top:8px}.ae-status.bad{color:#ff8a80;border-left-color:#ff8a80}';
  document.head.appendChild(style);
}

// ---------------- native save dialog + external links ----------------
const origSave = J.saveFile;
J.saveFile = async (filename, data) => {
  const cfs = window.cep && window.cep.fs;
  if (!cfs || typeof cfs.showSaveDialogEx !== 'function' || !fs) return origSave(filename, data);
  let res;
  try { res = cfs.showSaveDialogEx('저장', '', [filename.split('.').pop()], filename); } catch (e) { return origSave(filename, data); }
  const p = res && res.data;
  if (!p) return 'declined';
  const blob = data instanceof Blob ? data : new Blob([data]);
  const u8 = new Uint8Array(await blob.arrayBuffer());
  fs.writeFileSync(p, NodeBuffer ? NodeBuffer.from(u8) : u8);
  toast('저장했습니다: ' + p);
  return 'saved';
};
document.addEventListener('click', e => {
  const a = e.target && e.target.closest ? e.target.closest('a[href^="http"]') : null;
  if (!a) return;
  e.preventDefault();
  try { window.cep.util.openURLInDefaultBrowser(a.href); } catch (err) {}
}, true);

// the app binds its own buttons on DOMContentLoaded — add ours after that
const start = () => { inject(); connect(); };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 0)); else setTimeout(start, 0);
J.cep = { connect, buildInAE, useAEAudio, useAEMarkers, diagnose, ev };
})();
