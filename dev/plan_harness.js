// loads the real planner modules (src/01 … 08*, plus the 11p/11q effect packs and part sets) into a vm context and returns J
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

module.exports = () => {
  const src = path.join(__dirname, '..', 'src');
  // the planner modules only touch the DOM lazily; a do-nothing stand-in lets them load
  const stub = () => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : stub(), apply: () => stub(), construct: () => stub() });
  const context = vm.createContext({ console, setTimeout, clearTimeout, Intl, TextEncoder, TextDecoder, performance: { now: () => 0 }, navigator: { userAgent: '', language: 'ko' }, localStorage: { getItem: () => null, setItem() {} }, document: stub(), Image: function () {}, addEventListener() {}, location: { search: '', hash: '' } });
  context.window = context; context.self = context;
  for (const f of fs.readdirSync(src).filter(f => f.endsWith('.js') && (f < '09' || /^11[pq]_/.test(f))).sort()) vm.runInContext(fs.readFileSync(path.join(src, f), 'utf8'), context, { filename: f });
  return context.J;
};
