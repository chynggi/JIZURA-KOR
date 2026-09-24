const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = vm.createContext({ window: {} });
for (const file of ['01_util.js', '08d_media.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8'), context);
const J = context.window.J;
const items = ['a', 'b', 'c'].map(id => ({ id, name: id + '.png', type: 'image' }));
const project = { seed: 42, media: { items, randomOrder: true, seed: 4, timing: { lineTimes: { 1: 3 } }, overrides: { a: { layout: 'contain' } }, blend: 'screen', opacity: 40 } };
const lyric = { duration: 9, lines: [{ start: 0.4 }, { start: 2 }, { start: 5 }] };
const a = J.planMedia(project, lyric);
const b = J.planMedia(project, lyric);
assert.equal(JSON.stringify(a), JSON.stringify(b), 'random order must be deterministic');
assert.deepEqual(Array.from(a.cuts.map(c => c.start)), [0.4, 3, 5]);
assert.equal(a.cuts[2].end, 9);
assert.equal(a.blend, 'screen');
assert.equal(a.opacity, 40);
assert.equal(J.mediaAt({ media: a }, 3.2).index, 1);
assert.equal(items.length, 3, 'planning must not mutate uploaded order');
const solo = J.planMedia({ seed: 1, media: { items: [{ id: 'v', name: 'v.webm', type: 'video', duration: 7 }] } }, { duration: 3, lines: [] });
assert.equal(solo.duration, 7);
assert.equal(solo.cuts.length, 1);
assert.equal(solo.cuts[0].videoLoop, false);
assert.equal(solo.cuts[0].chromaKey, false);
const loopingVideo = J.planMedia({ seed: 1, media: { items: [{ id: 'v', name: 'v.webm', type: 'video', duration: 1 }], cutOverrides: { 0: { videoLoop: true } } } }, { duration: 4, lines: [] });
assert.equal(loopingVideo.cuts[0].videoLoop, true);
assert.ok(Math.abs(J.mediaVideoTime(loopingVideo.cuts[0], loopingVideo.cuts[0].start + 2.25, 1) - 0.25) < 1e-9);
assert.equal(J.mediaVideoTime(solo.cuts[0], solo.cuts[0].start + 8, 1), 0.999);
const layered = { seed: 1, media: { items: [{ id: 'bg', name: 'bg.png', type: 'image' }] }, foreground: { items: [{ id: 'fg', name: 'fg.webm', type: 'video', duration: 1 }], cutOverrides: { 0: { chromaKey: true, chromaColor: '#112233' } } } };
const bgPlan = J.planMedia(layered, { duration: 4, lines: [] });
const fgPlan = J.planMedia(layered, { duration: 4, lines: [] }, undefined, 'foreground');
assert.equal(bgPlan.cuts[0].itemId, 'bg');
assert.equal(fgPlan.cuts[0].itemId, 'fg');
assert.equal(fgPlan.cuts[0].chromaKey, true);
assert.equal(fgPlan.cuts[0].chromaColor, '#112233');
for (const layer of ['media', 'foreground']) {
  const fresh = J.planMedia({ seed: 1, [layer]: { items: [{ id: 'new', name: 'new.png', type: 'image' }] } }, { duration: 4, lines: [] }, undefined, layer);
  assert.deepEqual(Array.from(['layout', 'enter', 'hold', 'exit', 'treat', 'zoom', 'focus'].map(k => fresh.cuts[0][k])), ['contain', 'cut', 'still', 'cut', 'none', 100, 'mc']);
}
const positioned = J.planMedia({ seed: 1, foreground: { items: [{ id: 'fg', name: 'fg.webm', type: 'video', duration: 1 }], cutOverrides: { 0: { placement: { cx: 0.35, cy: 0.6, w: 0.4 } } } } }, { duration: 4, lines: [] }, undefined, 'foreground');
assert.equal(positioned.cuts[0].placement.cx, 0.35);
const widePlacement = J.mediaPlacementRect(positioned.cuts[0].placement, 160, 90, 1280, 720);
assert.ok(Math.abs(widePlacement.x - 0.15) < 1e-9 && Math.abs(widePlacement.y - 0.4) < 1e-9 && Math.abs(widePlacement.w - 0.4) < 1e-9 && Math.abs(widePlacement.h - 0.4) < 1e-9);
const tallPlacement = J.mediaPlacementRect(positioned.cuts[0].placement, 90, 160, 1280, 720);
assert.ok(Math.abs(tallPlacement.w / tallPlacement.h * 1280 / 720 - 90 / 160) < 1e-9, 'placement must preserve each asset aspect ratio');
const largePlacement = J.mediaPlacementRect({ cx: 0.5, cy: 0.5, w: 2.5, h: 0.2, lockAspect: false }, 160, 90, 1280, 720);
assert.equal(largePlacement.w, 2.5, 'placement may exceed the canvas width');
assert.equal(largePlacement.h, 0.2, 'unlocked placement uses independent height');
const tinyPlacement = J.mediaPlacementRect({ cx: 0.5, cy: 0.5, w: 0.005, lockAspect: true }, 160, 90, 1280, 720);
assert.equal(tinyPlacement.w, 0.005, 'placement may be smaller than the previous minimum');
const backgroundPlacement = J.planMedia({ seed: 1, media: { items: [{ id: 'bg', name: 'bg.png', type: 'image' }], cutOverrides: { 0: { placement: { cx: 0.4, cy: 0.6, w: 1.5, h: 0.3, lockAspect: false } } } } }, { duration: 4, lines: [] });
assert.equal(backgroundPlacement.cuts[0].placement.lockAspect, false);
assert.equal(backgroundPlacement.cuts[0].placement.w, 1.5);
const rotated = J.planMedia({ seed: 1, foreground: { items: [{ id: 'image', name: 'image.png', type: 'image' }], cutOverrides: { 0: { placement: { cx: 0.5, cy: 0.5, w: 0.4, angle: 90 }, zoom: 225, focus: 'tr' } } } }, { duration: 4, lines: [] }, undefined, 'foreground');
assert.equal(rotated.cuts[0].placement.angle, 90);
assert.equal(rotated.cuts[0].zoom, 100, 'legacy image zoom is ignored');
assert.equal(rotated.cuts[0].focus, 'mc', 'legacy image focus is ignored');
J.mediaAssets.set('image', { element: { naturalWidth: 160, naturalHeight: 90 } });
const rotations = [], context2d = { canvas: { width: 1280, height: 720 }, save() {}, restore() {}, translate() {}, scale() {}, rotate: radians => rotations.push(radians), drawImage() {} };
assert.equal(J.drawMediaCut(context2d, rotated.cuts[0], 1), true);
assert.ok(Math.abs(rotations[0] - Math.PI / 2) < 1e-9, 'image rotation is applied to the canvas renderer');
const loop = J.planMedia({ seed: 1, media: { items: items.slice(0, 2), loop: true, cutCount: 5, cutOverrides: { 0: { layout: 'cover' }, 2: { layout: 'contain' } } } }, { duration: 8, lines: [] });
assert.deepEqual(Array.from(loop.cuts.map(c => c.itemId)), ['a', 'b', 'a', 'b', 'a']);
assert.equal(loop.cuts[2].layout, 'contain');
assert.equal(loop.cuts[0].layout === 'contain', false, 'repeated cuts can have independent settings');
assert.equal(loop.duration, 20, 'media-only duration includes repeated cuts');
assert.equal(J.mediaAt({ media: loop }, loop.cuts[4].start + 0.1).itemId, 'a');
const noLoop = J.planMedia({ seed: 1, media: { items: items.slice(0, 2), loop: false, cutCount: 5 } }, { duration: 8, lines: [] });
assert.equal(noLoop.cuts.length, 2);
const shuffled = J.planMedia({ seed: 42, media: { items, loop: true, cutCount: 8, randomOrder: true } }, { duration: 10, lines: [] });
assert.deepEqual(Array.from(shuffled.cuts.slice(0, 3).map(c => c.itemId)), Array.from(shuffled.cuts.slice(3, 6).map(c => c.itemId)));
assert.deepEqual(Array.from(J.mediaOrder({ seed: 42, media: { items, randomOrder: true } }).map(x => x.id)), Array.from(shuffled.cuts.slice(0, 3).map(c => c.itemId)));
const tapped = J.planMedia({ seed: 1, media: { items, loop: true, cutCount: 1, timing: { lineTimes: { 0: 12 } } } }, { duration: 3, lines: [] });
assert.equal(tapped.cuts.length, 1, 'tap sync may build fewer cuts than uploaded assets');
assert.equal(tapped.cuts[0].start, 12);
assert.equal(tapped.duration, 16, 'late taps extend the timeline');
const zoomed = J.planMedia({ seed: 1, media: { items: [{ id: 'v', name: 'v.webm', type: 'video', duration: 4 }], loop: true, cutCount: 2, cutOverrides: { 0: { zoom: 225, focus: 'tr' }, 1: { zoom: 100, focus: 'bl' } } } }, { duration: 8, lines: [] });
assert.equal(zoomed.cuts[0].zoom, 225);
assert.equal(zoomed.cuts[0].focus, 'tr');
assert.equal(zoomed.cuts[1].zoom, 100);
assert.equal(zoomed.cuts[1].focus, 'bl');
assert.deepEqual(JSON.parse(JSON.stringify(J.mediaFocusPoint('tr', 900, 900))), { x: 300, y: -300 });
assert.deepEqual(JSON.parse(JSON.stringify(J.mediaFocusPoint('mc', 900, 900))), { x: 0, y: 0 });
assert.equal(a.cuts[0].zoom, b.cuts[0].zoom, 'automatic zoom is deterministic');
assert.equal(a.cuts[0].focus, b.cuts[0].focus, 'automatic focus is deterministic');
assert.equal(Object.hasOwn(J.MEDIA_LAYOUT, 'stretch'), false);
J.TRANS = { wipe: { name: 'エッジワイプ', dur: 0.35, plan: () => ({ dir: 'L' }) } };
const transition = J.planMedia({ seed: 1, media: { items: items.slice(0, 2), cutOverrides: { 0: { layout: 'stretch' }, 1: { trans: 'wipe' } } } }, { duration: 8, lines: [], style: {} });
assert.equal(transition.cuts[0].layout, 'cover', 'legacy stretch projects keep aspect ratio');
assert.equal(transition.cuts[1].trans, 'wipe');
assert.equal(transition.cuts[1].transP.dir, 'L');
const disabledTransition = J.planMedia({ seed: 1, media: { items: items.slice(0, 2), cutOverrides: { 1: { trans: 'none' } } } }, { duration: 8, lines: [], style: {} });
assert.equal(disabledTransition.cuts[1].trans, undefined);
context.document = { createElement: () => {
  const canvas = { width: 0, height: 0, data: null };
  canvas.getContext = () => ({
    drawImage: src => { canvas.data = new Uint8ClampedArray(src.pixels); },
    getImageData: () => ({ data: canvas.data.slice() }),
    putImageData: image => { canvas.data = image.data; },
  });
  return canvas;
} };
const chromaPixels = [100, 211, 63, 255, 0, 255, 0, 255, 180, 170, 170, 255, 0, 0, 0, 255];
const keyed = J.chromaSource({ pixels: chromaPixels }, { chromaColor: '#00ff00' }, 4, 1);
assert.deepEqual(Array.from(keyed.data.filter((_, i) => i % 4 === 3)), [0, 0, 255, 0], 'green shades and black padding must be transparent while the subject stays opaque');
const black = [0, 0, 0, 255], green = [100, 211, 63, 255], subject = [180, 170, 170, 255];
const grid = [
  [black, black, black, black, black],
  [black, green, subject, green, black],
  [black, green, black, green, black],
  [black, green, green, green, black],
  [black, black, black, black, black],
].flat(2);
const keyedGrid = J.chromaSource({ pixels: grid }, { chromaColor: '#00ff00' }, 5, 5);
assert.equal(keyedGrid.data[3], 0, 'black padding at the video edge must disappear');
assert.equal(keyedGrid.data[(1 * 5 + 2) * 4 + 3], 255, 'subject must stay visible');
assert.equal(keyedGrid.data[(2 * 5 + 2) * 4 + 3], 255, 'enclosed black subject detail must stay visible');
console.log('Media planning tests passed');
