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

J.decideSuggest = async (project, signal) => {
  const lines = J.parseLyrics(project.lyrics).lines;
  if (!lines.length) throw new Error('가사를 입력하세요');
  const userDirection = String(project.aiPrompt || '').trim().slice(0, 1000);
  const directionRule = userDirection ? '가사와 사용자의 추가 지시를 모두 고려한다.' : '가사를 고려한다.';
  // same rule as 자동(J.omakase): a mood tied to a part set (호러) is offered only while that set's switch is on
  const moodOk = k => !J.MOODS[k].set || (J.setOn && J.setOn(project, J.MOODS[k].set));
  // with themes chosen, offer only what those themes allow (J.omakase then keeps the choice); never leave a question empty
  const themes = J.themeIds ? J.themeIds(project).map(id => ({ theme: J.THEMES[id], pools: J.themeCandidates(project, id) })) : [];
  const inTheme = (g, k) => !themes.length || themes.some(({ theme, pools }) => g === 'mood' ? theme.moods.includes(k) : g === 'style' ? pools.styles.includes(k) : pools.lyrics[g].includes(k));
  const themed = (g, keys) => { const inside = keys.filter(k => inTheme(g, k)); return inside.length ? inside : keys; };
  const moodOptions = criteria(themed('mood', Object.keys(J.MOODS).filter(k => k !== 'chaos' && moodOk(k))), J.MOODS);
  const allowed = (g, k) => !J.randomOk || J.randomOk(project, g, k);
  const styleOptions = Object.fromEntries(themed('style', J.STYLE_ORDER.filter(k => allowed('style', k))).map(k => [k, `${J.STYLES[k].name}：${J.STYLES[k].desc}`]));
  const options = Object.fromEntries(Object.entries(CORE).map(([g, keys]) => [g, criteria(themed(g, keys.filter(k => allowed(g, k))), J.registry(g))]));
  const selections = { lines: {} };
  // Keep each request bounded; later batches use the globally chosen look as context.
  for (let start = 0; start < lines.length; start += 12) {
    const batch = lines.slice(start, start + 12);
    const questions = {};
    if (start === 0) {
      questions.mood = choice(`${directionRule} 가사 전체에 가장 어울리는 영상 분위기를 고른다.`, moodOptions);
      questions.style = choice(`${directionRule} 가사 전체에 가장 어울리는 문자 PV 배색·서체 스타일을 고른다.`, styleOptions);
    }
    batch.forEach((line, i) => {
      const n = start + i;
      for (const g of Object.keys(CORE)) questions[`${g}_${n}`] = choice(`${directionRule} 행 ${n + 1}에 어울리는 ${{ layout: '문자 레이아웃', enter: '등장 동작', exit: '퇴장 동작' }[g]}을 고른다.`, options[g]);
    });
    const state = {
      title: (project.title || '').slice(0, 120),
      artist: (project.artist || '').slice(0, 120),
      lyrics: lines.map(l => l.text).join('\n').slice(0, 6000),
      ...(userDirection ? { userDirection } : {}),
      selectedMood: selections.mood || null,
      selectedStyle: selections.style || null,
      targetLines: batch.map((line, i) => ({ index: start + i + 1, text: line.text, impact: !!line.impact })),
    };
    let response;
    try {
      response = await fetch(J.decideEndpoint(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state, questions }), signal });
    } catch (error) {
      throw new Error('로컬 결정 서버에 연결할 수 없습니다. decision_server.py가 실행 중인지, 브라우저의 로컬 네트워크 접근 허용을 확인하세요');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `결정 서버: HTTP ${response.status}`);
    const answers = data.answers || {};
    if (start === 0) {
      selections.mood = valid(answers.mood, moodOptions);
      selections.style = valid(answers.style, styleOptions);
      if (!selections.mood || !selections.style) throw new Error('분위기·스타일 선택 결과를 확인하지 못했습니다');
    }
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
})();
