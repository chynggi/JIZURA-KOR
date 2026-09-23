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
  STYLE_ORDER: ['noir', 'paper'],
  STYLES: { noir: { name: 'Noir', desc: 'dark' }, paper: { name: 'Paper', desc: 'soft' } },
  registry: g => registries[g],
  parseLyrics: lyrics => ({ lines: lyrics.split('\n').map(text => ({ text })) }),
  omakase: (project, rnd, choices) => ({ mood: choices.mood, style: choices.style, overrides: { 1: { lock: true, layout: 'huge' } } }),
};
const requests = [];
const context = { J, fetch: async (url, options) => {
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
  const project = { lyrics: Array.from({ length: 13 }, (_, i) => `line ${i}`).join('\n') };
  const selected = await J.jevSuggest(project);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, '/api/jev');
  assert.equal(Object.keys(requests[0].payload.questions).length, 38);
  assert.equal(Object.keys(requests[1].payload.questions).length, 3);
  assert.equal(selected.mood, 'calm');
  assert.equal(selected.style, 'paper');
  assert.equal(Object.keys(selected.lines).length, 13);
  const look = J.applyJev(project, selected);
  assert.equal(look.overrides[0].layout, 'center');
  assert.equal(look.overrides[1].layout, 'huge');
  assert.equal(look.overrides[1].lock, true);
  console.log('Jev selection and locked-line tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
