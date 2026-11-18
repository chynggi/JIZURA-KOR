// 한국어 컷 나누기: 붙여 둘 어절 사이(관형사+체언, 관형형+의존명사, 보조용언)에서 컷을 끊지 않고,
// Enhanced LRC의 음절 단위 태그(끝 시각이 띄어쓰기 앞에 붙은 것 포함)도 어절 경계를 잃지 않는다.
// usage: node dev/ko_cut_test.js
const assert = require('node:assert/strict');
const J = require('./plan_harness')();

// --- Enhanced LRC: syllable tags, with and without an end time before the space
const syl = J.parseLyrics('[00:01.00]<00:01.00>혹<00:01.10>시<00:01.20>나<00:01.25> <00:01.30>너<00:01.40>도<00:01.50>').lines[0];
assert.equal(syl.text, '혹시나 너도', 'an end tag before the space keeps the word break');
assert.deepEqual(Array.from(syl.marks, m => m.ci), [0, 1, 2, 3, 4, 5, 6]);
assert.equal(J.parseLyrics('[00:01.00]<00:01.00>혹<00:01.10>시<00:01.20>나 <00:01.30>너<00:01.40>도').lines[0].text, '혹시나 너도');
assert.equal(J.parseLyrics('[00:01.00]<00:01.00> Berry <00:01.40>Very').lines[0].text, 'Berry Very', 'word tags (A2) as before');
assert.equal(J.parseLyrics('[00:01.00]혹<00:01.10>시나 <00:01.30> 너도<00:01.50> ').lines[0].text, '혹시나 너도', 'no doubled or trailing space');

// --- break costs
const glued = [['한', '번쯤은'], ['이런', '경험한'], ['짜릿한', '걸까'], ['딸기', '중에'], ['경험한', '적'], ['적', '있을까?'],
  ['만나게', '된'], ['맛보고', '싶어'], ['녹을', '것'], ['것', '같아'], ['잡아먹어', '버릴'], ['헤매', '왔던'], ['딸기', '같은'], ['가지', '마'],
  ['너', '때문에'], ['우리', '사이'], ['내', '맘속까지'], ['오직', '너만'], ['할', '수'], ['수', '없어'], ['꿈', '같아'], ['앉아', '있어'], ['갈', '겁니다']];
for (const [a, b] of glued) assert.ok(J.koBreakCost(a, b) >= 3, `${a}|${b} stays together`);
const free = [['혹시나', '너도'], ['속에서', '오직'], ['네가', '와'], ['너를', '보고'], ['그리고', '나는'], ['바쁘고', '바쁘고'],
  ['우리', '같이'], ['그리고', '있잖아'], ['속에서', '와'], ['그대', '가']];
for (const [a, b] of free) assert.ok(J.koBreakCost(a, b) < 3, `${a}|${b} may break`);
assert.ok(J.koBreakCost('그래,', '우린') < 0, 'a comma is a good place to cut');
// AE reads the same dictionary from ae/data.json (re-run node tools/export_ae_data.js after editing src/02c_ko_dict.js)
const aeData = JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'ae', 'data.json'), 'utf8'));
assert.equal(JSON.stringify(aeData.koDict), JSON.stringify(J.KO_DICT), 'ae/data.json koDict is up to date');

// --- whole plan: no cut of a Korean line starts at a glued boundary, at any density / seed
const line = '혹시나 너도 한 번쯤은 이런 경험한 적 있을까?';
const tagged = '[00:01.00]' + [...line].map((c, i) => c === ' ' ? ' ' : `<00:${String(1 + i * 0.15).padStart(5, '0').slice(0, 5)}>${c}`).join('');
for (const lyrics of [`[00:01.00]${line}\n[00:06.00]끝`, `${tagged}\n[00:06.00]끝`]) {
  for (const density of [0.3, 0.55, 1]) for (let seed = 1; seed <= 12; seed++) {
    const p = Object.assign(J.defaultProject(), { lyrics, seed });
    p.fx = Object.assign({}, p.fx, { density });
    const cuts = J.plan(p, null).cuts.filter(c => c.line === 0 && !c.recap && c.text !== line);
    for (let k = 1; k < cuts.length; k++) {
      const a = J.chunkText(cuts[k - 1].text).pop(), b = J.chunkText(cuts[k].text)[0];
      assert.ok(J.koBreakCost(a, b) < 3, `seed ${seed} density ${density}: cut between ${a}|${b} (${cuts.map(c => c.text).join(' / ')})`);
    }
  }
}
// a cut count set by hand still wins
const fixed = Object.assign(J.defaultProject(), { lyrics: `[00:01.00]${line}\n[00:06.00]끝`, overrides: { 0: { cuts: 6 } } });
assert.equal(J.plan(fixed, null).cuts.filter(c => c.line === 0).length, 6);
console.log('Korean cut tests passed');
