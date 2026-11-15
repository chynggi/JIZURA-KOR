// 간주에 다음 가사: 끄면 간주 컷이 다음 가사 미리보기(preview)를 고르지 않는다.
// usage: node dev/interlude_test.js
const assert = require('node:assert/strict');
const J = require('./plan_harness')();

const lyrics = '[00:02.00]첫 번째 가사\n[00:20.00]다음 가사\n[00:24.00]마지막 가사';
const variants = interPreview => {
  const out = [];
  for (let seed = 1; seed <= 40; seed++) {
    const p = Object.assign(J.defaultProject(), { lyrics, seed, extra: true });
    if (interPreview != null) p.fx = Object.assign({}, p.fx, { interPreview });
    for (const c of J.plan(p, null).cuts) if (c.layout === 'interlude') out.push(c.params.variant);
  }
  return out;
};
assert.ok(variants(null).includes('preview'), 'by default an interlude may preview the next line');
assert.ok(variants(true).includes('preview'));
const off = variants(false);
assert.ok(off.length > 0, 'interludes are still planned');
assert.ok(!off.includes('preview'), 'turned off: no interlude previews the next line');

const project = Object.assign(J.defaultProject(), { lyrics: '[00:01.00]첫 가사\n[00:04.00]｜　｜\n[00:12.00]끝' });
const legacy = J.plan(project, null);
const blank = legacy.cuts.find(c => c.line === 1 && c.part === 0);
assert.equal(legacy.lines[1].interlude, true);
assert.deepEqual([blank.start, blank.end, blank.layout], [4, 12, 'interlude']);
assert.equal(blank.params.scenes.length, 2, 'long scenes change without splitting the saved cut');
assert.equal(blank.params.scenes[0].start, 0);
assert.equal(blank.params.scenes.at(-1).end, 8);
assert.notEqual(blank.params.scenes[0].id, blank.params.scenes[1].id);
assert.equal(JSON.stringify(J.plan(project, null).cuts), JSON.stringify(legacy.cuts));

for (const text of ['[간주]\n첫 가사', '마지막 가사\n[간주]', '[간주 3]']) {
  const plan = J.plan({ ...project, lyrics: text }, null);
  assert.equal(plan.cuts.filter(c => c.layout === 'interlude' && c.params.scenes.length).length, 1, text);
}
const marked = J.plan({ ...project, lyrics: '[00:01.00]첫 가사\n[00:04.00][간주 | Solo]\n[00:08.00]끝' }, null);
const cut = marked.cuts.find(c => c.layout === 'interlude');
assert.deepEqual([cut.start, cut.end, cut.params.caption], [4, 8, 'Solo']);
const credited = J.plan({ ...project, title: 'Track', artist: 'Artist', fx: { ...project.fx, interCredit: true } }, null);
assert.equal(credited.cuts.find(c => c.layout === 'interlude').params.variant, 'credit');
const retimed = J.plan({ ...project, lyricCutOptions: { '1:0': { untilNext: false, endTime: 9 } } }, null);
assert.equal(retimed.cuts.find(c => c.line === 1 && c.part === 0).end, 9);
const aligned = J.interludeSequence(10, 'noir', 18, .5, false, () => false, 0);
assert.deepEqual(Array.from(aligned, scene => scene.start), [0, 4, 6]);
assert.ok(aligned.every(scene => scene.id !== 'photo' && scene.id !== 'glyph'));
const automatic = J.plan({ ...project, lyrics: '[00:01]one\n[00:14]two', seed: 2 }, null);
const scenes = automatic.cuts.filter(c => c.layout === 'interlude').flatMap(c => c.params.scenes);
assert.ok(scenes.length > 1 && scenes.slice(1).every((scene, i) => scene.id !== scenes[i].id));

const seen = new Set();
for (const style of J.STYLE_ORDER) for (let seed = 1; seed <= 40; seed++) {
  for (const scene of J.interludeSequence(8, style, seed, .5, '가사', () => true)) seen.add(scene.id);
}
assert.deepEqual([...seen].sort(), ['blueprint','chroma','domino','frame','glyph','ink','light','panel','paper','photo','pulse','radar','route']);
console.log('Interlude tests passed');
