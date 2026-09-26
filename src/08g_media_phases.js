/* Independent media entrances/exits and motions on the project's beat clock. */
(() => {
'use strict';
const moved = new Set(['dissolve', 'pop', 'spin', 'whip', 'impact', 'spiralApproach', 'rubberLaunch', 'boomerang']);
for (const [key, def] of Object.entries(J.MEDIA_TECH)) {
  if (def.group !== 'mask' && !moved.has(key)) continue;
  def.group = 'enter'; def.stage = 'enter'; def.motion = def.enter;
  J.MEDIA_TECH['exit_' + key] = { ...def, name: '퇴장: ' + def.name, group: 'exit', stage: 'exit', motion: def.exit };
}
for (const [motion, name] of [
  ['fade', '페이드'], ['slide', '오른쪽에서 슬라이드'],
  ['slideLeft', '왼쪽에서 슬라이드'], ['rise', '아래에서 슬라이드'],
  ['fall', '위에서 슬라이드'], ['diagonal', '대각선 슬라이드'],
  ['zoom', '줌'], ['shrink', '스케일'], ['blur', '블러'],
  ['swing', '스윙'], ['glitch', '글리치'],
  ['flipX', '가로 플립'], ['flipY', '세로 플립'],
  ['squeezeX', '가로 스트레치'], ['squeezeY', '세로 스트레치'],
]) for (const stage of ['enter', 'exit']) {
  const prefix = stage === 'enter' ? '등장: ' : '퇴장: ';
  J.MEDIA_TECH[stage + '_' + motion] = { name: prefix + (stage === 'exit' && ({slide:1,slideLeft:1,rise:1,fall:1})[motion] ? ({slide:'왼쪽으로 슬라이드',slideLeft:'오른쪽으로 슬라이드',rise:'위로 슬라이드',fall:'아래로 슬라이드'})[motion] : name), group: stage, stage, motion,
    enter: stage === 'enter' ? motion : 'cut', exit: stage === 'exit' ? motion : 'cut', hold: 'still', treat: 'none', trans: 'none' };
}
for (const [key, name] of [
  ['beatPulse', '박자 맥동'], ['beatBounce', '박자 튀기'],
  ['beatSway', '박자 스웨이'], ['beatOrbit', '박자 궤도'],
  ['beatTurn', '박자마다 회전'], ['beatShake', '박자 셰이크'],
  ['beatHeart', '더블 하트비트'], ['beatBreathe', '2박 호흡'],
  ['beatStep', '박자 스텝'], ['beatFade', '박자 페이드'],
]) J.MEDIA_TECH[key] = { name, group: 'bpm', enter: 'cut', hold: key, exit: 'cut', treat: 'none', trans: 'none' };

J.mediaPhaseOptions = stage => Object.entries(J.MEDIA_TECH).filter(([, def]) => def.stage === stage);
J.applyMediaPhases = (project, cut, ov, layer) => {
  cut.bpm = Number.isFinite(+project.timing?.bpm) && +project.timing.bpm > 0 ? +project.timing.bpm : 120;
  cut.beatOffset = Number.isFinite(+project.timing?.beatOffset) ? +project.timing.beatOffset : 0;
  const settings = cut.effectSettings || J.mediaEffectSettings(project, layer);
  for (const [stage, field, lockedField, salt] of [['enter', 'entrance', 'lockedEntrance', 821], ['exit', 'departure', 'lockedDeparture', 823]]) {
    // Keep saved six-option recipes until this phase is explicitly changed.
    if (cut.technique === 'legacy' && ov[field] === undefined) continue;
    let key = ov.lock && ov[lockedField] != null ? ov[lockedField] : ov[field];
    // Old explicit reveal recipes remain readable without appearing in the
    // new main-motion menu. New cuts use independent automatic phase pools.
    if (key === undefined && J.MEDIA_TECH[ov.technique]?.stage === 'enter') key = stage === 'enter' ? ov.technique : 'exit_' + ov.technique;
    if (key !== 'none' && J.MEDIA_TECH[key]?.stage !== stage) {
      const pool = J.mediaPhaseOptions(stage).filter(([id]) => settings.enabled[id] !== false);
      key = pool.length ? J.rng(J.h(cut.seed, salt)).pick(pool)[0] : 'none';
    }
    cut[field] = key;
    cut[stage] = J.MEDIA_TECH[key]?.motion || 'cut';
    cut.independentPhases = true;
  }
  if (cut.independentPhases) cut.effectSettings = settings;
};

J.mediaBeatState = (cut, p, w, h) => {
  const v = { x: 0, y: 0, rotation: 0, scale: 1, alpha: 1 };
  const beat = (cut.start + p * (cut.end - cut.start) - (cut.beatOffset || 0)) * (cut.bpm || 120) / 60;
  const phase = ((beat % 1) + 1) % 1, a = Math.exp(-phase * 8), t = beat * Math.PI * 2;
  switch (cut.hold) {
    case 'beatPulse': v.scale = 1 + a * .18; break;
    case 'beatBounce': v.y = -Math.abs(Math.sin(beat * Math.PI)) * h * .16; break;
    case 'beatSway': v.rotation = Math.sin(t) * .12; break;
    case 'beatOrbit': v.x = Math.sin(t) * w * .08; v.y = Math.cos(t) * h * .08; break;
    case 'beatTurn': v.rotation = (Math.floor(beat) + 1 - Math.pow(1 - Math.min(1, phase * 4), 3)) * Math.PI / 2; break;
    case 'beatShake': v.x = Math.sin(phase * 61) * w * .025 * a; v.y = Math.cos(phase * 47) * h * .025 * a; break;
    case 'beatHeart': v.scale = 1 + .16 * Math.max(a, phase >= .3 ? .65 * Math.exp(-(phase - .3) * 14) : 0); break;
    case 'beatBreathe': v.scale = 1 + (1 - Math.cos(t / 2)) * .06; break;
    case 'beatStep': { const step = Math.floor(beat); v.x = J.rs(step, cut.seed, 11) * w * .12; v.y = J.rs(step, cut.seed, 12) * h * .12; break; }
    case 'beatFade': v.alpha = .4 + .6 * a; break;
  }
  return v;
};
})();
