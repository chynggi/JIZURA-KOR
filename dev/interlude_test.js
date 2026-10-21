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
console.log('Interlude tests passed');
