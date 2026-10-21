/* 「AI로 고르기」: a decision model on this PC (decision_server.py) chooses from JIZURA's own vocabulary. */
(() => {
'use strict';

const CORE = {
  layout: ['center', 'condensed', 'huge', 'tile', 'marquee', 'vcols', 'scatter', 'stack', 'gloss', 'circle', 'type', 'mixed', 'wave', 'labels', 'pill', 'ring', 'diag'],
  enter: ['slice', 'scramble', 'assemble', 'flicker', 'zoom', 'stretch', 'blur', 'type', 'wipe', 'pop', 'drop', 'spin'],
  exit: ['glitch', 'slice', 'explode', 'fall', 'blur', 'drift', 'wipe', 'shrink', 'scatter', 'stretch'],
};
const criteria = (keys, table) => Object.fromEntries(keys.filter(k => table[k]).map(k => [k, `${table[k].name}${table[k].tags ? ' / ' + table[k].tags.join(', ') : ''}`]));
const choice = (instructions, options) => ({ type: 'choice', instructions, criteria: options });
const valid = (answer, options) => answer && answer.type === 'choice' && Object.hasOwn(options, answer.choice) ? answer.choice : null;
J.decideEndpoint = (loc = location) => /^http:\/\/(127\.0\.0\.1|localhost):8765$/.test(loc.origin) ? '/api/decide' : 'http://127.0.0.1:8765/api/decide';

// what both modes share: the user's direction and the choices the switches and themes allow
const scope = project => {
  const userDirection = String(project.aiPrompt || '').trim().slice(0, 1000);
  const directionRule = userDirection ? '가사와 사용자의 추가 지시를 모두 고려한다.' : '가사를 고려한다.';
  // same rule as 자동(J.omakase): a mood tied to a part set (호러) is offered only while that set's switch is on
  const moodOk = k => !J.MOODS[k].set || (J.setOn && J.setOn(project, J.MOODS[k].set));
  // with themes chosen, offer only what those themes allow (J.omakase then keeps the choice); never leave a question empty
  const themes = J.themeIds ? J.themeIds(project).map(id => ({ theme: J.THEMES[id], pools: J.themeCandidates(project, id) })) : [];
  const inTheme = (g, k) => !themes.length || themes.some(({ theme, pools }) => g === 'mood' ? theme.moods.includes(k) : g === 'style' ? pools.styles.includes(k) : pools.lyrics[g].includes(k));
  const themed = (g, keys) => { const inside = keys.filter(k => inTheme(g, k)); return inside.length ? inside : keys; };
  const allowed = (g, k) => !J.randomOk || J.randomOk(project, g, k);
  return {
    userDirection, directionRule, themed, allowed,
    moodOptions: criteria(themed('mood', Object.keys(J.MOODS).filter(k => k !== 'chaos' && moodOk(k))), J.MOODS),
    styleOptions: Object.fromEntries(themed('style', J.STYLE_ORDER.filter(k => allowed('style', k))).map(k => [k, `${J.STYLES[k].name}：${J.STYLES[k].desc}`])),
  };
};
const ask = async (state, questions, signal) => {
  if (signal && signal.aborted) throw new Error('취소했습니다');
  let response;
  try {
    response = await fetch(J.decideEndpoint(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state, questions }), signal });
  } catch (error) {
    if (signal && signal.aborted) throw new Error('취소했습니다');
    throw new Error('로컬 결정 서버에 연결할 수 없습니다. decision_server.py가 실행 중인지, 브라우저의 로컬 네트워크 접근 허용을 확인하세요');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `결정 서버: HTTP ${response.status}`);
  return data.answers || {};
};
const baseState = (project, S, lines) => ({
  title: (project.title || '').slice(0, 120),
  artist: (project.artist || '').slice(0, 120),
  lyrics: lines.map(l => l.text).join('\n').slice(0, 6000),
  ...(S.userDirection ? { userDirection: S.userDirection } : {}),
});
const lookQuestions = S => ({
  mood: choice(`${S.directionRule} 가사 전체에 가장 어울리는 영상 분위기를 고른다.`, S.moodOptions),
  style: choice(`${S.directionRule} 가사 전체에 가장 어울리는 문자 PV 배색·서체 스타일을 고른다.`, S.styleOptions),
});
const pickLook = (answers, S) => {
  const mood = valid(answers.mood, S.moodOptions), style = valid(answers.style, S.styleOptions);
  if (!mood || !style) throw new Error('분위기·스타일 선택 결과를 확인하지 못했습니다');
  return { mood, style };
};

J.decideSuggest = async (project, signal) => {
  const lines = J.parseLyrics(project.lyrics).lines;
  if (!lines.length) throw new Error('가사를 입력하세요');
  const S = scope(project);
  const options = Object.fromEntries(Object.entries(CORE).map(([g, keys]) => [g, criteria(S.themed(g, keys.filter(k => S.allowed(g, k))), J.registry(g))]));
  const selections = { lines: {} };
  // Keep each request bounded; later batches use the globally chosen look as context.
  for (let start = 0; start < lines.length; start += 12) {
    const batch = lines.slice(start, start + 12);
    const questions = start === 0 ? lookQuestions(S) : {};
    batch.forEach((line, i) => {
      const n = start + i;
      for (const g of Object.keys(CORE)) questions[`${g}_${n}`] = choice(`${S.directionRule} 행 ${n + 1}에 어울리는 ${{ layout: '문자 레이아웃', enter: '등장 동작', exit: '퇴장 동작' }[g]}을 고른다.`, options[g]);
    });
    const state = Object.assign(baseState(project, S, lines), {
      selectedMood: selections.mood || null,
      selectedStyle: selections.style || null,
      targetLines: batch.map((line, i) => ({ index: start + i + 1, text: line.text, impact: !!line.impact })),
    });
    const answers = await ask(state, questions, signal);
    if (start === 0) Object.assign(selections, pickLook(answers, S));
    batch.forEach((line, i) => {
      const n = start + i, picked = {};
      for (const g of Object.keys(CORE)) {
        const key = valid(answers[`${g}_${n}`], options[g]);
        if (key) picked[g] = key;
      }
      if (Object.keys(picked).length) selections.lines[n] = picked;
    });
  }
  return selections;
};

J.applyDecide = (project, selections, rnd = Math.random) => {
  const look = J.omakase(project, rnd, selections);
  const overrides = look.overrides;
  for (const [index, picks] of Object.entries(selections.lines || {})) {
    if (overrides[index] && overrides[index].lock) continue;
    overrides[index] = Object.assign({}, overrides[index], picks);
  }
  return look;
};

/* 「AI에게 전부 맡기기」: the model picks every line's cut count, then all ten effects of every cut */
const DIRECT = ['layout', 'enter', 'exit', 'hold', 'decor', 'treat', 'bg', 'cam', 'trans', 'fx'];
const OPTIONAL = ['decor', 'treat', 'trans', 'fx'];          // 「없음」 is a choice too
const LABEL = { layout: '문자 레이아웃', enter: '등장 동작', exit: '퇴장 동작', hold: '유지 동작', decor: '장식', treat: '문자 처리', bg: '배경', cam: '카메라 움직임', trans: '앞 컷에서 넘어오는 전환', fx: '컷이 바뀔 때의 화면 효과' };
const SHORT_BAD = ['wave', 'ring', 'labels', 'gloss', 'type', 'tile'];   // the planner keeps these off cuts under 0.5 s
const BUDGET = 60000;                                         // decision_server.py refuses bodies over 64 KB
const MAX_CUTS = 6;
const bytes = s => { let n = 0; for (const ch of s) { const c = ch.codePointAt(0); n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; } return n; };
// one request per run of items whose questions still fit under the server's body limit
const askInBatches = async (items, questionsOf, stateOf, signal, onBatch) => {
  const answers = {};
  for (let i = 0; i < items.length;) {
    let batch = [items[i]], questions = questionsOf(items[i++]);
    while (i < items.length) {
      const more = Object.assign({}, questions, questionsOf(items[i]));
      if (bytes(JSON.stringify({ state: stateOf(batch.concat(items[i]), answers), questions: more })) > BUDGET) break;
      batch.push(items[i++]); questions = more;
    }
    Object.assign(answers, await ask(stateOf(batch, answers), questions, signal));
    if (onBatch) onBatch(i);
  }
  return answers;
};
// a pick that only works with some layouts (the same limits the planner keeps when it chooses)
const suitsLayout = (g, k, LD) => {
  if (!LD || k === 'none') return true;
  const D = J.registry(g)[k];
  if (g === 'decor') return !(LD.busy && D.layer === 'back' && !D.subtle);
  if (g === 'treat') return LD.treat !== false && (LD.treat !== 'safe' || D.safe);
  if (g === 'bg') return !(LD.busy && !D.subtle);
  if (g === 'cam') return LD.cam !== false || k === 'push';
  return true;
};

J.decideDirect = async (project, { audio = null, signal = null, onProgress = null, rnd = Math.random } = {}) => {
  const lines = J.parseLyrics(project.lyrics).lines;
  if (!lines.length) throw new Error('가사를 입력하세요');
  const S = scope(project), base = baseState(project, S, lines);
  const locked = li => !!(project.overrides && project.overrides[li] && project.overrides[li].lock);
  const asked = lines.map((ln, li) => ({ ln, li })).filter(({ ln, li }) => !locked(li) && !ln.effectsOnly && !ln.interlude);
  // 1. the overall look
  const look = J.omakase(project, rnd, pickLook(await ask(base, lookQuestions(S), signal), S));
  const chosen = { selectedMood: look.mood, selectedStyle: look.style };
  // 2. how many cuts each line gets (a line of one word group, or with its own line breaks, keeps the planner's split)
  if (onProgress) onProgress({ stage: 'cuts' });
  const countable = asked.map(a => Object.assign(a, { max: Math.min(MAX_CUTS, a.ln.text.includes('\n') ? 1 : (a.ln.manual || J.chunkText(a.ln.text)).length) })).filter(a => a.max >= 2);
  const countOptions = a => Object.fromEntries(Array.from({ length: a.max }, (_, i) => [String(i + 1), i ? `${i + 1}컷: 행을 ${i + 1}화면으로 나눠 보여 준다` : '1컷: 행 전체를 한 화면에 보여 준다']));
  const counts = await askInBatches(countable,
    a => ({ [`cuts_${a.li}`]: choice(`${S.directionRule} 행 ${a.li + 1}을(를) 몇 컷으로 나눠 보여 줄지 고른다. 빠르게 몰아치는 부분은 잘게, 여운이 있는 부분은 길게.`, countOptions(a)) }),
    batch => Object.assign({}, base, chosen, { targetLines: batch.map(a => ({ index: a.li + 1, text: a.ln.text, impact: !!a.ln.impact })) }), signal);
  const overrides = look.overrides = Object.assign({}, look.overrides);
  for (const a of countable) {
    const n = valid(counts[`cuts_${a.li}`], countOptions(a));
    // a fresh count drops the per-cut picks of an earlier run (they belonged to other cuts)
    if (n && !(overrides[a.li] && overrides[a.li].lock)) { overrides[a.li] = Object.assign({}, overrides[a.li], { cuts: +n }); delete overrides[a.li].cutTech; }
  }
  // 3. the cuts those counts give, from the planner itself
  const mine = new Set(asked.filter(a => !(overrides[a.li] && overrides[a.li].lock)).map(a => a.li));
  const enabled = (g, k) => !(project.enabled && project.enabled[g] && project.enabled[g][k] === false) && S.allowed(g, k);
  const tables = Object.fromEntries(DIRECT.map(g => [g, criteria(S.themed(g, J.order(g).filter(k => {
    const D = J.registry(g)[k];
    return k !== 'none' && D && enabled(g, k) && !(g === 'layout' && D.special) && !(g === 'fx' && (D.builtin || D.edge === false));
  })), J.registry(g))]));
  const cuts = J.plan(Object.assign({}, project, look), audio).cuts.filter(c => typeof c.part === 'number' && mine.has(c.line)).map(c => {
    const n = [...c.text.replace(/\s+/g, '')].length, dur = c.end - c.start;
    const fits = {
      layout: (k, D) => D.fits(n) && !(dur < 0.5 && SHORT_BAD.includes(k)),
      enter: (k, D) => !(D.minDur && dur < D.minDur) && !(D.maxChars && n > D.maxChars),
      exit: (k, D) => !(D.minDur && dur < D.minDur),
    };
    const options = Object.fromEntries(DIRECT.map(g => {
      const keep = Object.fromEntries(Object.entries(tables[g]).filter(([k]) => !fits[g] || fits[g](k, J.registry(g)[k])));
      return [g, OPTIONAL.includes(g) ? Object.assign(keep, { none: '없음' }) : keep];
    }));
    return { line: c.line, part: c.part, text: c.text, dur, emph: !!c.emph, options };
  });
  // 4. every effect of every cut, the cut before as context so the flow carries on
  const id = (g, c) => `${g}_${c.line}_${c.part}`;
  const picksOf = (c, answers) => { const p = {}; for (const g of DIRECT) { const k = valid(answers[id(g, c)], c.options[g]); if (k) p[g] = k; } return p; };
  const total = cuts.length;
  if (onProgress) onProgress({ stage: 'effects', done: 0, total });
  const answers = await askInBatches(cuts,
    c => Object.fromEntries(DIRECT.filter(g => Object.keys(c.options[g]).length >= 2).map(g => [id(g, c), choice(`${S.directionRule} 행 ${c.line + 1}의 ${c.part + 1}번째 컷 「${c.text}」에 어울리는 ${LABEL[g]}을(를) 고른다.`, c.options[g])])),
    (batch, sofar) => {
      const before = cuts[cuts.indexOf(batch[0]) - 1];
      return Object.assign({}, base, chosen, {
        previousCut: before ? Object.assign({ text: before.text }, picksOf(before, sofar)) : null,
        targetCuts: batch.map(c => ({ line: c.line + 1, cut: c.part + 1, text: c.text, lineText: lines[c.line].text, seconds: +c.dur.toFixed(2), emphasis: c.emph })),
      });
    }, signal, done => { if (onProgress) onProgress({ stage: 'effects', done, total }); });
  for (const c of cuts) {
    const tech = picksOf(c, answers), LD = J.LAYOUTS[tech.layout];
    for (const g of Object.keys(tech)) if (!suitsLayout(g, tech[g], LD)) delete tech[g];
    const ov = overrides[c.line] = Object.assign({}, overrides[c.line]);
    ov.cutTech = Object.assign({}, ov.cutTech, { [c.part]: tech });
  }
  return look;
};
})();
