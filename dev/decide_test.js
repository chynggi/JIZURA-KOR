const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const names = ['layout', 'enter', 'exit'];
const registries = Object.fromEntries(names.map(g => [g, {}]));
for (const g of names) for (const key of ({
  layout: ['center', 'huge'], enter: ['blur', 'pop'], exit: ['drift', 'fall'],
})[g]) registries[g][key] = { name: key };
const J = {
  MOODS: { calm: { name: 'Calm' }, pop: { name: 'Pop' }, chaos: { name: 'Chaos' } },
  STYLE_ORDER: ['noir', 'paper', 'sakura'],
  STYLES: { noir: { name: 'Noir', desc: 'dark' }, paper: { name: 'Paper', desc: 'soft' }, sakura: { name: 'Sakura', desc: 'extra' } },
  randomOk: (project, group, key) => !(group === 'style' && key === 'sakura' && project.extra !== true),
  registry: g => registries[g],
  parseLyrics: lyrics => ({ lines: lyrics.split('\n').map(text => ({ text })) }),
  omakase: (project, rnd, choices) => ({ mood: choices.mood, style: choices.style, overrides: { 0: { area: project.overrides[0].area }, 1: { lock: true, layout: 'huge' } } }),
};
const requests = [];
let failNext = false;
const context = { J, location: { origin: 'https://chynggi.github.io' }, fetch: async (url, options) => {
  if (failNext) throw new Error('network down');
  const payload = JSON.parse(options.body);
  requests.push({ url, payload });
  const answers = {};
  for (const [key, q] of Object.entries(payload.questions)) {
    const pick = ({ mood: 'calm', style: 'paper' })[key] || Object.keys(q.criteria)[0];
    answers[key] = { type: 'choice', choice: pick };
  }
  return { ok: true, json: async () => ({ answers }) };
} };
vm.createContext(context);
vm.runInContext(fs.readFileSync('src/08c_jev.js', 'utf8'), context);

(async () => {
  const project = { lyrics: Array.from({ length: 13 }, (_, i) => `line ${i}`).join('\n'), aiPrompt: '사비는 대담하게', overrides: { 0: { area: { x: 0.2, y: 0.1, w: 0.5, h: 0.6 } } } };
  const selected = await J.decideSuggest(project);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, 'http://127.0.0.1:8765/api/decide');
  assert.equal(Object.keys(requests[0].payload.questions).length, 38);
  assert.equal(Object.keys(requests[1].payload.questions).length, 3);
  assert.equal(Object.hasOwn(requests[0].payload.questions.style.criteria, 'sakura'), false);
  assert.equal(requests[0].payload.state.userDirection, '사비는 대담하게');
  assert.equal(requests[1].payload.state.userDirection, '사비는 대담하게');
  assert.match(requests[0].payload.questions.mood.instructions, /추가 지시/);
  assert.equal(selected.mood, 'calm');
  assert.equal(selected.style, 'paper');
  assert.equal(Object.keys(selected.lines).length, 13);
  const look = J.applyDecide(project, selected);
  assert.equal(look.overrides[0].layout, 'center');
  assert.equal(look.overrides[0].area.x, 0.2);
  assert.equal(look.overrides[1].layout, 'huge');
  assert.equal(look.overrides[1].lock, true);
  context.location.origin = 'http://127.0.0.1:8765';
  await J.decideSuggest({ lyrics: 'one line' });
  assert.equal(requests.at(-1).url, '/api/decide');
  assert.equal(Object.hasOwn(requests.at(-1).payload.state, 'userDirection'), false);
  await J.decideSuggest({ lyrics: 'one line', extra: true });
  assert.equal(Object.hasOwn(requests.at(-1).payload.questions.style.criteria, 'sakura'), true);

  let lastError = null;
  failNext = true;
  try { await J.decideSuggest({ lyrics: 'one line' }); } catch (error) { lastError = error; } finally { failNext = false; }

  const ep = J.decideEndpoint;
  assert.equal(ep({ origin: 'http://127.0.0.1:8765', protocol: 'http:' }), '/api/decide');
  assert.equal(ep({ origin: 'http://localhost:8765', protocol: 'http:' }), '/api/decide');
  assert.equal(ep({ origin: 'https://chynggi.github.io', protocol: 'https:' }), 'http://127.0.0.1:8765/api/decide');
  assert.equal(ep({ origin: 'null', protocol: 'file:' }), 'http://127.0.0.1:8765/api/decide');
  // 오류 문구는 한국어
  assert.match(String(lastError && lastError.message), /[가-힣]/);
  console.log('DECIDE OK');
})().catch(error => { console.error(error); process.exitCode = 1; });

// AI가 고른 분위기라도 그 세트 스위치가 꺼져 있으면 쓰지 않는다(실제 08b_omakase.js)
{
  const real = vm.createContext({ window: {}, document: { createElement: () => ({ getContext: () => ({}) }), fonts: { add() {} } } });
  const src = require('node:path').join(__dirname, '..', 'src');
  // omakase는 효과 기법 무작위 선택까지 보므로 08c~08e 계열과 11p/11q를 함께 로드한다
  for (const f of fs.readdirSync(src).sort()) if (f.endsWith('.js') && (f < '08c' || /^08[c-e]/.test(f) || /^11[pq]_/.test(f))) vm.runInContext(fs.readFileSync(require('node:path').join(src, f), 'utf8'), real);
  const R = real.window.J, base = R.defaultProject();
  for (let i = 0; i < 20; i++) assert.notEqual(R.omakase(Object.assign({}, base, { horror: false }), Math.random, { mood: 'horror' }).mood, 'horror', 'horror mood with the horror switch off');
  assert.equal(R.omakase(Object.assign({}, base, { horror: true }), Math.random, { mood: 'horror' }).mood, 'horror');
  assert.equal(R.omakase(base, Math.random, { mood: 'calm' }).mood, 'calm');
}

// AI에게 전부 맡기기: 컷 수 → 컷별 연출 10개 항목, 요청 본문은 서버 한도(64KB) 아래
(async () => {
  const reg = {
    layout: { center: { name: 'center', fits: () => true }, huge: { name: 'huge', fits: n => n <= 4 }, wide: { name: 'wide', fits: () => true, busy: true }, long: { name: 'long', fits: n => n >= 9 }, title: { name: 'title', fits: () => true, special: true } },
    enter: { blur: { name: 'blur' }, pop: { name: 'pop', minDur: 1 } },
    exit: { drift: { name: 'drift' }, fall: { name: 'fall' } },
    hold: { still: { name: 'still' }, sway: { name: 'sway' } },
    decor: { dots: { name: 'dots' }, frame: { name: 'frame', layer: 'back' } },
    treat: { none: { name: 'none' }, glow: { name: 'glow' } },
    bg: { none: { name: 'none' }, grid: { name: 'grid' }, soft: { name: 'soft', subtle: true } },
    cam: { push: { name: 'push' }, orbit: { name: 'orbit' } },
    trans: { cut: { name: 'cut' }, wipe: { name: 'wipe' } },
    fx: { chroma: { name: 'chroma', builtin: true }, ripple: { name: 'ripple' }, burst: { name: 'burst', edge: false } },
  };
  // many long layout descriptions: one cut's questions are big, so the cuts must be split over several requests
  for (let i = 0; i < 200; i++) reg.layout[`x${i}`] = { name: 'x'.repeat(100), fits: () => true };
  const J = {
    MOODS: { calm: { name: 'Calm' } }, STYLE_ORDER: ['paper'], STYLES: { paper: { name: 'Paper', desc: 'soft' } },
    registry: g => reg[g], order: g => Object.keys(reg[g]), LAYOUTS: reg.layout, FXE: reg.fx,
    parseLyrics: lyrics => ({ lines: lyrics.split('\n').map(text => ({ text })) }),
    chunkText: text => text.split(' '),
    omakase: (project, rnd, c) => ({ mood: c.mood, style: c.style, overrides: { 2: { lock: true } } }),
    // stand-in planner: line li is split into overrides[li].cuts word groups of 0.4 s each
    plan: p => {
      const cuts = [{ line: -1, part: 0, text: 'title', start: 0, end: 1 }];
      J.parseLyrics(p.lyrics).lines.forEach((ln, li) => {
        const words = ln.text.split(' '), n = (p.overrides[li] || {}).cuts || 1, per = Math.ceil(words.length / n);
        for (let k = 0; k < n; k++) cuts.push({ line: li, part: k, text: words.slice(k * per, k * per + per).join(' '), start: li + k * 0.4, end: li + k * 0.4 + 0.4, emph: false });
        cuts.push({ line: li, part: 'interlude', text: '', start: 9, end: 10 });
      });
      return { cuts };
    },
  };
  const want = { layout: 'wide', enter: 'pop', exit: 'fall', hold: 'sway', decor: 'frame', treat: 'glow', bg: 'grid', cam: 'orbit', trans: 'none', fx: 'ripple' };
  const sent = [];
  const context = { J, location: { origin: 'http://127.0.0.1:8765' }, fetch: async (url, options) => {
    sent.push(options.body);
    const { questions } = JSON.parse(options.body), answers = {};
    for (const [key, q] of Object.entries(questions)) {
      const keys = Object.keys(q.criteria), g = key.split('_')[0];
      answers[key] = { type: 'choice', choice: key === 'hold_0_1' ? 'zzz' : g === 'cuts' ? keys.at(-1) : keys.includes(want[g]) ? want[g] : keys[0] };
    }
    return { ok: true, json: async () => ({ answers }) };
  } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('src/08c_jev.js', 'utf8'), context);
  const project = { lyrics: 'a b c\nd e\nf g h', overrides: { 2: { lock: true } } };
  const progress = [];
  const look = await J.decideDirect(project, { onProgress: p => progress.push(p) });
  const qs = sent.map(b => JSON.parse(b).questions);
  assert.deepEqual(Object.keys(qs[0]).sort(), ['mood', 'style']);
  assert.deepEqual(Object.keys(qs[1]).sort(), ['cuts_0', 'cuts_1'], 'a locked line is not asked');
  assert.deepEqual(Object.keys(qs[1].cuts_0.criteria), ['1', '2', '3']);
  assert.ok(sent.every(b => Buffer.byteLength(b) <= 60000), 'every request stays under the server limit');
  assert.ok(sent.length > 3, 'big option lists split the cuts over several requests');
  const cutQs = Object.assign({}, ...qs.slice(2));
  assert.equal(Object.hasOwn(cutQs.layout_0_0.criteria, 'title'), false, 'special layouts are never offered');
  assert.equal(Object.hasOwn(cutQs.layout_0_0.criteria, 'long'), false, 'a layout that does not fit the text is not offered');
  assert.equal(Object.hasOwn(cutQs, 'enter_0_0'), false, 'with one fitting choice the question is skipped');
  assert.deepEqual(Object.keys(cutQs.fx_0_0.criteria).sort(), ['none', 'ripple']);
  assert.equal(Object.hasOwn(cutQs.bg_0_0.criteria, 'none'), false, 'a background is always shown');
  assert.equal(Object.keys(cutQs).some(k => k.endsWith('_2_0')), false, 'no cut of a locked line is asked');
  assert.equal(look.mood, 'calm');
  assert.equal(look.style, 'paper');
  assert.equal(look.overrides[0].cuts, 3);
  assert.equal(look.overrides[1].cuts, 2);
  assert.deepEqual({ ...look.overrides[0].cutTech[0] }, { layout: 'wide', exit: 'fall', hold: 'sway', treat: 'glow', cam: 'orbit', trans: 'none', fx: 'ripple' },
    'busy layout: the back decor and the non-subtle background are dropped');
  assert.equal(Object.hasOwn(look.overrides[0].cutTech[1], 'hold'), false, 'an answer outside the choices is left to the planner');
  assert.deepEqual({ ...look.overrides[2] }, { lock: true });
  assert.deepEqual({ ...progress.at(-1) }, { stage: 'effects', done: 5, total: 5 });
  const ctl = new AbortController(); ctl.abort();
  await assert.rejects(J.decideDirect(project, { signal: ctl.signal }), /취소/);
  console.log('DIRECT OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
