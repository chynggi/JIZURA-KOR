/* Lyric display lifetimes and deterministic, foreground-aware placement. */
(() => {
'use strict';

J.LYRIC_BLENDS = ['normal', 'multiply', 'screen', 'overlay'];
const percent = (value, fallback) => value != null && value !== '' && Number.isFinite(+value) ? J.clamp(+value, 0, 100) : fallback;
J.lyricEffectSettings = project => {
  const settings = project.lyricEffects || {};
  const min = percent(settings.opacityMin, 0), max = percent(settings.opacityMax, 100);
  return {
    autoPlacement: settings.autoPlacement === true, avoidForeground: settings.avoidForeground !== false,
    avoidanceStrength: settings.avoidanceStrength != null && Number.isFinite(+settings.avoidanceStrength) ? J.clamp(+settings.avoidanceStrength, 0, 1) : 1,
    randomBlend: settings.randomBlend === true, randomOpacity: settings.randomOpacity === true,
    opacityMin: Math.min(min, max), opacityMax: Math.max(min, max),
  };
};

J.lyricComposite = (project, cut, settings = J.lyricEffectSettings(project)) => {
  const options = project.lyricCutOptions?.[`${cut.line}:${cut.part}`] || {};
  const line = project.overrides?.[cut.line];
  const locked = line?.lock ? line.lockedComposites?.[cut.part] : null;
  const blend = J.LYRIC_BLENDS.includes(options.blend) ? options.blend : J.LYRIC_BLENDS.includes(locked?.blend) ? locked.blend
    : settings.randomBlend ? J.rng(J.h(cut.seed, 953)).pick(J.LYRIC_BLENDS) : 'normal';
  const random = J.rng(J.h(cut.seed, 967))();
  const strength = cut.emphasis ? (2 + random) / 3 : cut.suppressed ? random / 3 : random;
  const opacity = percent(options.opacity, null) ?? percent(locked?.opacity, null)
    ?? (settings.randomOpacity ? J.clamp(Math.round(J.lerp(settings.opacityMin, settings.opacityMax, strength)), settings.opacityMin, settings.opacityMax) : 100);
  return { blend, opacity };
};

// Older projects stored one lyric blend/opacity on the background layer.
// Transfer a non-default setting to the existing cuts once, preserving edits.
J.migrateLyricCompositing = project => {
  const media = project.media;
  if (!media || (media.blend === 'normal' && media.opacity === 100)) return;
  const blend = J.LYRIC_BLENDS.includes(media.blend) ? media.blend : 'normal';
  const opacity = percent(media.opacity, 100);
  const options = project.lyricCutOptions || (project.lyricCutOptions = {});
  for (const cut of J.plan(project).cuts) if (cut.line >= 0 && Number.isInteger(cut.part)) {
    const key = `${cut.line}:${cut.part}`;
    options[key] = { blend, opacity, ...options[key] };
  }
  media.blend = 'normal'; media.opacity = 100;
};

// Use the actual fitted source rectangle, including its rotation. Coordinates are
// normalized to the stage; rotation is calculated in pixels to preserve aspect.
J.foregroundBounds = (project, plan, cut) => {
  if (!cut.itemId) return null;
  const item = project.foreground?.items?.find(item => item.id === cut.itemId);
  if (!item) return null;
  const source = J.mediaAssets?.get(cut.itemId)?.element;
  const sw = source && (source.videoWidth || source.naturalWidth || source.width) || item.width || plan.W;
  const sh = source && (source.videoHeight || source.naturalHeight || source.height) || item.height || plan.H;
  const r = !cut.placement && cut.layout === 'cover' ? { x: 0, y: 0, w: 1, h: 1 }
    : J.mediaPlacementRect(cut.placement, sw, sh, plan.W, plan.H);
  if (!r) return null;
  const a = (cut.placement?.angle || 0) * J.DEG, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const w = r.w * c + r.h * plan.H / plan.W * s;
  const h = r.h * c + r.w * plan.W / plan.H * s;
  return { x: r.x + r.w / 2 - w / 2, y: r.y + r.h / 2 - h / 2, w, h };
};

const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

function emptyRegions(obstacles) {
  let regions = [{ x: .025, y: .025, w: .95, h: .95 }];
  for (const b of obstacles) {
    const next = [];
    for (const a of regions) {
      if (!overlap(a, b)) { next.push(a); continue; }
      const x0 = Math.max(a.x, b.x), x1 = Math.min(a.x + a.w, b.x + b.w);
      const y0 = Math.max(a.y, b.y), y1 = Math.min(a.y + a.h, b.y + b.h);
      next.push({ x: a.x, y: a.y, w: x0 - a.x, h: a.h },
        { x: x1, y: a.y, w: a.x + a.w - x1, h: a.h },
        { x: x0, y: a.y, w: x1 - x0, h: y0 - a.y },
        { x: x0, y: y1, w: x1 - x0, h: a.y + a.h - y1 });
    }
    // Bound work even for a lyric spanning hundreds of foreground cuts.
    regions = next.filter(r => r.w >= .04 && r.h >= .04).sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 64);
    if (!regions.length) break;
  }
  return regions;
}

J.autoLyricArea = (cut, plan, obstacles = []) => {
  const rng = J.rng(J.h(cut.seed, 947));
  const portrait = plan.W < plan.H;
  let w = cut.emphasis ? rng.range(.82, .95) : cut.suppressed ? rng.range(.28, .4) : rng.range(.48, .72);
  let h = cut.emphasis ? rng.range(.7, .92) : cut.suppressed ? rng.range(.2, .3) : rng.range(.4, .62);
  if (portrait && !cut.emphasis) { w = Math.min(.9, w * 1.2); h *= .8; }
  const regions = emptyRegions(obstacles);
  if (regions.length) {
    const candidates = regions.map(r => ({ r, w: Math.min(w, r.w), h: Math.min(h, r.h) }));
    const best = Math.max(...candidates.map(c => c.w * c.h));
    const fit = rng.pick(candidates.filter(c => c.w * c.h >= best * .8));
    w = fit.w; h = fit.h;
    const x = fit.r.x + rng.pick([0, .5, 1]) * (fit.r.w - w);
    const y = fit.r.y + rng.pick([0, .5, 1]) * (fit.r.h - h);
    return { x, y, w, h, angle: 0, lockAspect: true };
  }
  // A full-stage foreground can leave no empty rectangle. Keep the lyric
  // readable in the least covered candidate instead of generating a zero area.
  const candidates = [];
  for (const x of [0, .25, .5, .75, 1]) for (const y of [0, .25, .5, .75, 1]) {
    const r = { x: .025 + x * (.95 - w), y: .025 + y * (.95 - h), w, h, angle: 0, lockAspect: true };
    candidates.push({ r, score: obstacles.reduce((sum, b) => sum + overlap(r, b), 0) });
  }
  const min = Math.min(...candidates.map(c => c.score));
  return rng.pick(candidates.filter(c => c.score <= min + 1e-8)).r;
};

J.finishLyricPlan = (project, plan, audio) => {
  const groups = new Map();
  for (const cut of plan.cuts) if (cut.group != null && Number.isInteger(cut.part)) {
    if (!groups.has(cut.group)) groups.set(cut.group, []);
    groups.get(cut.group).push(cut);
  }
  plan.retainedCutIndices = [];
  for (const cuts of groups.values()) {
    const last = cuts[cuts.length - 1];
    for (const cut of cuts) {
      cut.displayEnd = last.end;
      cut.groupExit = last.exit;
      cut.groupOutDur = last.outDur;
      plan.retainedCutIndices.push(cut.index);
    }
  }
  const settings = J.lyricEffectSettings(project);
  const foreground = settings.autoPlacement && settings.avoidForeground && J.planMedia
    ? J.planMedia(project, plan, audio?.duration, 'foreground') : null;
  const bounds = foreground && foreground.opacity > 0 ? foreground.cuts.map(cut => ({ cut, box: J.foregroundBounds(project, plan, cut) })) : [];
  for (const cut of plan.cuts) {
    if (cut.line < 0 || !Number.isInteger(cut.part)) continue;
    Object.assign(cut, J.lyricComposite(project, cut, settings));
    cut.areaMode = cut.area ? 'manual' : 'default';
    if (cut.area || !settings.autoPlacement) continue;
    const locked = project.overrides?.[cut.line];
    const lockedArea = locked?.lock && locked.lockedAreas?.[cut.part];
    if (lockedArea !== undefined && lockedArea !== false) {
      cut.area = J.lyricArea(lockedArea);
      cut.areaMode = cut.area ? 'auto' : 'default';
    } else {
      // Retention extends rendering only. Place each cut using its own time slot
      // so later foregrounds do not force a whole group into one shared area.
      const obstacles = cut.emphasis || settings.avoidanceStrength === 0 ? [] : bounds
        .filter(({ cut: f, box }) => box && f.start < cut.end && f.end + .6 > cut.start)
        .map(({ box }) => {
          const s = settings.avoidanceStrength;
          // Lower strengths allow overlap around the foreground's perimeter.
          const w = (box.w + .04) * s, h = (box.h + .04) * s;
          return { x: box.x + box.w / 2 - w / 2, y: box.y + box.h / 2 - h / 2, w, h };
        });
      cut.area = J.autoLyricArea(cut, plan, obstacles);
      cut.areaMode = 'auto';
    }
    // Some layouts choose columns or orientation during planning. Give those
    // choices the resolved area dimensions as well as using them at render time.
    if (cut.area && J.LAYOUTS[cut.layout]?.plan) {
      cut.params = J.LAYOUTS[cut.layout].plan(J.rng(J.h(cut.seed, 318)), {
        text: cut.text, n: [...cut.text.replace(/\s/g, '')].length,
        W: plan.W * cut.area.w, H: plan.H * cut.area.h, dur: cut.dur,
      }, plan.style);
      if (cut.text.includes('\n')) cut.params.sx = 1;
    }
  }
};

// Timing/linking uses the original start/end; rendering alone extends a group's
// lifetime. Store indices rather than references to avoid duplicating cut graphs.
J.lyricCutsAt = (plan, t) => {
  const current = J.cutAt(plan, t), cuts = [];
  for (const index of plan.retainedCutIndices || []) {
    const cut = plan.cuts[index];
    if (cut && cut.start <= t && t < cut.displayEnd) cuts.push(cut);
  }
  if (current && !current.blank && !cuts.includes(current)) cuts.push(current);
  return cuts.sort((a, b) => a.index - b.index);
};
J.lyricRenderCut = cut => cut.displayEnd != null ? Object.assign({}, cut, {
  end: cut.displayEnd, dur: cut.displayEnd - cut.start,
  exit: cut.groupExit, outDur: cut.groupOutDur,
}) : cut;
})();
