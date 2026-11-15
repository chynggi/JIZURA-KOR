/* Use one set of scenes without changing the identity or timing of saved cuts. */
(() => {
'use strict';
J.interludeSequence = jzInterludeSequence;

function photoAt(plan, t) {
  if (plan.layerVisibility?.media === false) return null;
  const cuts = J.mediaCutsAt(plan, t);
  return cuts.findLast(cut => cut.type === 'image' && cut.opacity > 0 && J.mediaAssets.has(cut.itemId));
}

J.refreshInterludeScenes = (plan, timing) => {
  const beats = plan.beats || [];
  const beat = beats.length > 1 ? (beats.at(-1) - beats[0]) / (beats.length - 1) : timing?.bpm > 0 ? 60 / timing.bpm : 0;
  const origin = beats[0] ?? timing?.beatOffset ?? 0;
  let previous = '';
  let lineIndex = 0;
  let previousEnd = -Infinity, previousScene = '';
  for (const cut of plan.cuts) {
    while (lineIndex < plan.lines.length && plan.lines[lineIndex].start <= cut.start + 1e-6) {
      const line = plan.lines[lineIndex++];
      if (!line.interlude && line.text.trim()) previous = line.text.trim();
    }
    if (cut.layout !== 'interlude' || cut.dur <= 0) continue;
    const glyphs = [...previous.replace(/\s/g, '')].slice(-12);
    const scenes = J.interludeSequence(cut.dur, plan.styleKey, cut.seed, beat, glyphs.length,
      local => !!photoAt(plan, cut.start + local), origin - cut.start,
      Math.abs(cut.start - previousEnd) < .001 ? previousScene : '');
    cut.params = { ...cut.params, scenes, glyphs, sceneBeat: beat, sceneBeatOffset: origin - cut.start };
    previousEnd = cut.end;
    previousScene = scenes.at(-1).id;
  }
};

const planLyrics = J.plan;
J.plan = (project, ...args) => {
  const plan = planLyrics(project, ...args);
  for (const cut of plan.cuts) {
    if (!cut.effectsOnly) continue;
    cut.layout = 'interlude';
    cut.text = ''; cut.lineText = ''; cut.words = [];
    cut.params = { variant: plan.fx.interCount === 'on' ? 'counter' : 'quiet', caption: cut.note };
    cut.companion = null; cut.zone = null;
    delete cut.effectsOnly;
    const line = plan.lines[cut.line];
    if (line) line.interlude = true;
  }
  if (plan.fx.interCredit && plan.title) {
    const first = plan.cuts.find(cut => cut.layout === 'interlude' && cut.dur >= 2);
    if (first) {
      first.params = { ...first.params, variant: 'credit' };
      first.text = plan.title;
      first.note = plan.artist;
    }
  }
  J.refreshInterludeScenes(plan, project.timing);
  return plan;
};

J.drawInterludeScene = env => {
  if (env.pass !== 'main') return;
  const { ctx, W, H, cut, plan, sc } = env;
  const local = env.ltb;
  const scene = cut.params.scenes?.find(entry => local >= entry.start && local <= entry.end);
  if (!scene) return;
  const q = J.clamp((local - scene.start) / (scene.end - scene.start));
  const beat = env.beat?.len || cut.params.sceneBeat || Math.max(.25, (scene.end - scene.start) / 4);
  const beatTime = (local - (cut.params.sceneBeat ? cut.params.sceneBeatOffset : scene.start)) / beat;
  const beatIndex = env.beat?.index ?? Math.floor(beatTime);
  const phase = env.beat ? J.clamp(env.beat.since / beat) : beatTime - beatIndex;
  const strong = Math.exp(-phase * 6) * (beatIndex % 4 === 0 ? 1 : .4);
  const photo = scene.id === 'photo' && !env.transparent && photoAt(plan, env.t);
  const image = photo && J.mediaAssets.get(photo.itemId)?.element;
  const sw = image?.naturalWidth || image?.width, sh = image?.naturalHeight || image?.height;
  const shapes = jzInterludeFrame(scene.id === 'photo' && !(sw && sh) ? { ...scene, id: 'light' } : scene, W, H, q, phase, strong);
  for (const shape of shapes) {
    const color = sc[shape.color];
    if (shape.width) env.line(shape.close ? [...shape.points, shape.points[0]] : shape.points, color, shape.width, shape.alpha, false);
    else env.poly(shape.points, color, shape.alpha, false);
    if (shape.photo && sw && sh) {
      const { x, y, size, angle, index } = shape.photo;
      const cropW = Math.min(sw, sh * 1.35) * .65, cropH = cropW / 1.35;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.globalAlpha = shape.alpha;
      ctx.drawImage(image, (sw - cropW) * index / 3, (sh - cropH) * (3 - index) / 3,
        cropW, cropH, -size * .46, -size * .36, size * .92, size * .68);
      ctx.restore();
    }
    if (shape.glyph && cut.params.glyphs?.length) {
      const { x, y, angle, index } = shape.glyph;
      const size = Math.min(W, H) * .11;
      const glyph = cut.params.glyphs[index % cut.params.glyphs.length];
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.rect(-size * .43, size * (index % 5 - 2) * .13 - size * .08, size * .86, size * .16);
      ctx.clip();
      ctx.globalAlpha = shape.alpha;
      ctx.fillStyle = color;
      ctx.font = J.fontCSS(env.st.fonts.display[0], size, glyph);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(glyph, 0, 0);
      ctx.restore();
    }
  }
};
})();
