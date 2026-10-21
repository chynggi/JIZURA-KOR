// 컷별 지정 cutTech.fx: 그 컷 경계의 화면 효과를 지정한 것으로 바꾸거나('none') 없앤다
// usage: node dev/cut_fx_test.js
const assert = require('node:assert/strict');
const J = require('./plan_harness')();

const lyrics = '[00:02.00]첫 번째 가사\n[00:03.00]둘\n[00:04.00]셋';
const libFx = k => J.FXE[k] && !J.FXE[k].builtin;
const edgeOf = (tech, seed) => {
  const p = Object.assign(J.defaultProject(), { lyrics, seed, typeset: false, overrides: tech ? { 1: { cutTech: { 0: tech } } } : {} });
  return J.plan(p, null).events.filter(e => e.cutOwner === '1:0' && libFx(e.type)).map(e => e.type);
};
const pick = J.FXE_ORDER.find(k => libFx(k) && J.FXE[k].edge !== false);
for (let seed = 1; seed <= 10; seed++) {
  assert.deepEqual(Array.from(edgeOf({ fx: pick }, seed)), [pick], 'the chosen edge effect replaces the random one');
  assert.deepEqual(Array.from(edgeOf({ fx: 'none' }, seed)), [], '"none" leaves the cut edge without a library effect');
}
assert.ok(Array.from({ length: 10 }, (_, i) => edgeOf(null, i + 1).length).some(n => n > 0), 'without a choice the planner still picks some');
console.log('Cut fx tests passed');
