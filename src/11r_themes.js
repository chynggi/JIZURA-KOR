/* Local, curated theme presets. No network or audio classification required. */
(() => {
'use strict';
const presets = {
  typo: { category:'taste', name:'문자 PV', set:'typo', moods:['editorial','graphic'], styles:['mono','paper','specimen'], media:['panorama','pushIn','drift'], phases:['wipe','enter_slide','enter_fade'], motion:[.35,.8], duration:[.25,.65], flash:false },
  kinetic: { category:'taste', name:'키네틱', set:'kinetic', moods:['pop','glitch'], styles:['magenta','caution','mono'], media:['tumble','pulse','beatBounce','beatTurn'], phases:['pop','enter_zoom','enter_slide'], motion:[.8,1.4], duration:[.15,.4], flash:true },
  wa: { category:'taste', name:'일본풍', wa:true, moods:['editorial','calm'], styles:['sakura','sumi'], media:['pushIn','drift','panorama'], phases:['enter_fade','curtain','enter_blur'], motion:[.2,.6], duration:[.5,1], flash:false },
  horror: { category:'taste', name:'호러', moods:['horror'], styles:['hrRuin','hrNightRec','hrCurse'], media:['glitch','rackFocus','drift'], phases:['enter_blur','enter_glitch'], motion:[.35,.65], duration:[.3,.8], flash:false },
  pop: { category:'genre', name:'팝', moods:['pop'], styles:['magenta','caution','transit','rouge'], media:['pulse','swing','orbit','beatBounce','beatPulse'], phases:['pop','iris','enter_slide','enter_zoom'], motion:[.7,1.2], duration:[.2,.45], flash:true },
  ballad: { category:'genre', name:'발라드', moods:['calm','emotional'], styles:['paper','specimen','noir'], media:['pushIn','pullOut','drift','rackFocus','beatBreathe'], phases:['enter_fade','enter_blur','curtain'], motion:[.25,.55], duration:[.65,1.2], flash:false },
  rock: { category:'genre', name:'록', moods:['glitch','emotional'], styles:['crimson','noir','mono'], media:['pulse','tumble','glitch','chromaticSplit','beatShake','beatTurn'], phases:['impact','whip','enter_glitch'], motion:[1,1.6], duration:[.12,.3], flash:true },
  dance: { category:'genre', name:'댄스·EDM', moods:['glitch','graphic'], styles:['mint','blueprint','hud','magenta'], media:['beatPulse','beatTurn','beatStep','beatFade','chromaticSplit','neonContour'], phases:['tiles','scan','enter_flipX'], motion:[.8,1.4], duration:[.12,.35], flash:true },
  hiphop: { category:'genre', name:'힙합', moods:['graphic','glitch'], styles:['mono','caution','crimson'], media:['beatStep','beatSway','beatPulse','panorama','glitch'], phases:['wipe','enter_slide','enter_squeezeX'], motion:[.6,1.1], duration:[.2,.4], flash:false },
  jazz: { category:'genre', name:'재즈', moods:['editorial','calm'], styles:['specimen','noir','paper'], media:['panorama','drift','pullOut','beatSway'], phases:['enter_fade','wipe','enter_blur'], motion:[.3,.65], duration:[.4,.8], flash:false },
  acoustic: { category:'genre', name:'어쿠스틱', moods:['calm','editorial'], styles:['paper','specimen'], media:['pushIn','drift','rise','beatBreathe'], phases:['enter_fade','enter_rise','curtain'], motion:[.2,.5], duration:[.55,1], flash:false },
  cool: { category:'taste', name:'쿨', moods:['graphic','editorial'], styles:['noir','mono','blueprint','hud'], media:['panorama','diagonal','rackFocus','beatStep'], phases:['wipe','scan','enter_slide'], motion:[.4,.8], duration:[.25,.5], flash:false },
  cute: { category:'taste', name:'귀여움', moods:['pop'], styles:['magenta','rouge'], media:['swing','orbit','beatBounce','beatHeart','drift'], phases:['pop','iris','enter_squeezeY'], motion:[.5,.9], duration:[.3,.6], flash:false },
  elegant: { category:'taste', name:'우아함', moods:['editorial','calm'], styles:['specimen','paper','mono'], media:['pushIn','pullOut','rackFocus','drift'], phases:['enter_fade','enter_blur','curtain'], motion:[.2,.45], duration:[.7,1.2], flash:false },
  dreamy: { category:'taste', name:'몽환', moods:['calm','emotional'], styles:['hud','noir','magenta'], media:['drift','orbit','rackFocus','beatBreathe'], phases:['enter_blur','iris','enter_fade'], motion:[.3,.7], duration:[.65,1.3], flash:false },
  retro: { category:'taste', name:'레트로', moods:['editorial','graphic'], styles:['paper','caution','transit'], media:['panorama','pullOut','filmstrip','stipplePrint','beatSway'], phases:['blinds','wipe','enter_fade'], motion:[.35,.7], duration:[.35,.7], flash:false },
};
// Mask pack (background only): framing that suits each theme's pace.
const masksByTheme = {
  typo: ['maskCinemascope','maskSplitScreen','maskSlashParallax'],
  kinetic: ['maskBeatWindows','maskShutterBeat','maskSlashParallax','maskDetailGrid'],
  wa: ['maskCinemascope','maskDoubleExposure'],
  horror: ['maskCinemascope','maskShutterBeat'],
  pop: ['maskShapeZoom','maskDotMatrix','maskBeatWindows','maskDetailGrid'],
  ballad: ['maskDoubleExposure','maskCinemascope','maskRings'],
  rock: ['maskShutterBeat','maskSlashParallax','maskBeatWindows'],
  dance: ['maskBeatWindows','maskShutterBeat','maskDotMatrix','maskRings','maskDetailGrid'],
  hiphop: ['maskSplitScreen','maskDetailGrid','maskBeatWindows'],
  jazz: ['maskCinemascope','maskSplitScreen'],
  acoustic: ['maskDoubleExposure','maskCinemascope'],
  cool: ['maskSplitScreen','maskSlashParallax','maskCinemascope','maskDetailGrid'],
  cute: ['maskShapeZoom','maskDotMatrix','maskRings'],
  elegant: ['maskCinemascope','maskDoubleExposure','maskRings'],
  dreamy: ['maskDoubleExposure','maskShapeZoom','maskRings'],
  retro: ['maskDotMatrix','maskSplitScreen','maskCinemascope'],
};
for (const [key, masks] of Object.entries(masksByTheme)) presets[key].media.push(...masks);
// Curated additions from the rhythmic media pack; keep gentle themes restrained.
const rhythmByTheme = {
  pop: ['beatSideHop','beatZoomSteps','beatSpring','beatSquash','beatTwistHop','beatSwayZoom'],
  ballad: ['beatPendulum','beatWaltz'],
  rock: ['beatSpring','beatStretch','beatTwistHop','beatZoomSteps'],
  dance: ['beatBox','beatDiamond','beatZoomSteps','beatSquash','beatStretch','beatSpiral','beatSwayZoom'],
  hiphop: ['beatSideHop','beatBox','beatZoomSteps','beatSquash','beatSwayZoom'],
  jazz: ['beatPendulum','beatWaltz','beatSwayZoom'],
  acoustic: ['beatPendulum','beatWaltz'],
  cool: ['beatBox','beatDiamond','beatZoomSteps'],
  cute: ['beatSideHop','beatSpring','beatSquash','beatTwistHop','beatWaltz'],
  elegant: ['beatPendulum','beatWaltz'],
  dreamy: ['beatPendulum','beatSpiral','beatSwayZoom'],
  retro: ['beatSideHop','beatPendulum','beatWaltz'],
};
for (const [key, motions] of Object.entries(rhythmByTheme)) presets[key].media.push(...motions);
// Third media pack: main techniques/transitions, then entrances (exits follow).
const scenesByTheme = {
  horror: [['dutchTilt','handheld','filmGrain','vignette','scanlines','thermal','glassShards'],['flicker','shakeIn']],
  pop: [['rollAcross','zoomStages','beatJelly','beatTilt','beatFlip','beatBounceWall','tileScroll'],['dropBounce','elasticZoom','starIris','heartIris','dotGrid']],
  ballad: [['kenBurns','craneUp','lightLeak','vignette','softBloom','transition_blinds'],['brushStroke']],
  rock: [['dutchTilt','handheld','slamZoom','beatKick','beatTilt','beatDrop','zoomTunnel','stutterEcho','splitShift','glassShards','transition_sliceShift'],['flicker','shakeIn','stretchSnap','randomBars','diagonalSplit']],
  dance: [['slamZoom','turnOnce','zoomStages','beatKick','beatSlide','beatFlip','beatDrop','hueCycle','scanlines','zoomTunnel','columnWave','stutterEcho','transition_sliceShift','transition_pixelate'],['elasticZoom','swirl','stretchSnap','randomBars']],
  hiphop: [['handheld','slamZoom','zoomStages','beatKick','beatTilt','beatSlide','stutterEcho','splitShift','transition_sliceShift'],['dropBounce','shakeIn','stretchSnap','diagonalSplit']],
  jazz: [['kenBurns','filmGrain','vignette','cyanotype','transition_blinds','transition_tyRuleWipe'],['foldUp','clockReveal','brushStroke']],
  acoustic: [['kenBurns','handheld','lightLeak','transition_tyRuleWipe'],['brushStroke']],
  cool: [['dutchTilt','zoomStages','beatSlide','scanlines','thermal','cyanotype','splitShift','glassShards','transition_tyGridCells'],['foldUp','clockReveal','randomBars','diagonalSplit']],
  cute: [['rollAcross','beatJelly','beatBounceWall','softBloom','tileScroll'],['dropBounce','elasticZoom','swirl','starIris','heartIris','dotGrid']],
  elegant: [['kenBurns','craneUp','vignette','softBloom','cyanotype','transition_blinds'],['foldUp','brushStroke']],
  dreamy: [['craneUp','turnOnce','lightLeak','hueCycle','softBloom','zoomTunnel','columnWave'],['swirl','starIris']],
  retro: [['kenBurns','beatBounceWall','lightLeak','filmGrain','scanlines','tileScroll','transition_blinds','transition_pixelate','transition_tyRuleWipe','transition_tyGridCells'],['foldUp','clockReveal','dotGrid']],
};
for (const [key, [media, phases]] of Object.entries(scenesByTheme)) { presets[key].media.push(...media); presets[key].phases.push(...phases.map(id => 'enter_' + id)); }
const descriptions = {
  typo:'문자가 주인공인 구성·문자 PV 연출',
  kinetic:'문자가 튀는·움직임이 강한 연출',
  wa:'화지·붓·일본 전통 무늬를 쓴 연출',
  horror:'어두운 배색·불온한 문자와 영상',
  pop:'밝은 배색·튀는 움직임', ballad:'차분한 배색·느긋한 여운',
  rock:'강한 대비·격렬한 움직임', dance:'선명한 배색·비트 동기화',
  hiphop:'굵은 글자·리듬감 있는 전환', jazz:'단정한 글자·매끄러운 움직임',
  acoustic:'종이 같은 색감·차분한 움직임', cool:'차가운 색조·샤프한 구성',
  cute:'핑크 계열·부드럽게 튀는 움직임', elegant:'정돈된 글자·차분한 움직임',
  dreamy:'블러·부유감·느린 움직임', retro:'종이·필름·도트 질감',
};
for (const [key,theme] of Object.entries(presets)) theme.description = descriptions[key];
J.THEMES = presets;
J.themeIds = project => [...new Set((Array.isArray(project.themes) ? project.themes : []).filter(key=>Object.hasOwn(presets,key)))];
const neutral = {layout:['center'],enter:['cut'],exit:['cut'],hold:['still'],decor:[],treat:['none'],bg:['none'],cam:['push'],fx:[],trans:[]};
const themeSwitches = (project,key) => { const t = presets[key]; return key === 'horror' ? {...project,horror:true} : t?.set ? {...project,[t.set]:true} : t?.wa ? {...project,wa:true,extra:true} : project; };
J.themeCandidates = (project,key) => {
  const theme = presets[key]; if (!theme) return null;
  const themedProject = themeSwitches(project,key);
  const allowed = (group,id) => !J.randomOk || J.randomOk(themedProject,group,id);
  const lyrics = {};
  for (const group of J.GROUP_KEYS) {
    const wanted = new Set(neutral[group] || []);
    for (const mood of theme.moods) {
      for (const id of J.taggedWith(group,mood)) wanted.add(id);
      if (Array.isArray(J.MOODS[mood][group])) for (const id of J.MOODS[mood][group]) wanted.add(id);
    }
    if(theme.set||theme.wa){
      wanted.clear();
      for(const id of neutral[group]||[])wanted.add(id);
      for(const id of J.order(group))if(theme.set?J.setOf(group,id)===theme.set:J.isWa(group,id))wanted.add(id);
    }
    lyrics[group] = J.order(group).filter(id=>wanted.has(id) && !J.registry(group)[id]?.special && allowed(group,id));
  }
  const phases = theme.phases.flatMap(id=>[id,id.startsWith('enter_') ? 'exit_'+id.slice(6) : 'exit_'+id]);
  // Media layers share the theme's lyric camera pool (詳細 → 手法 → カメラ).
  const cameras = (lyrics.cam || []).map(id=>'cam_'+id);
  return {styles:theme.styles.filter(id=>J.STYLES[id] && allowed('style',id)),lyrics,media:[...new Set([...theme.media,...phases,...cameras])].filter(id=>J.MEDIA_TECH[id])};
};
const unrestricted = J.omakase;
J.omakase = (project,rnd=Math.random,choices={}) => {
  const ids = J.themeIds(project); if (!ids.length) return {...unrestricted(project,rnd,choices),appliedTheme:null};
  const pick = a=>a[Math.min(a.length-1,Math.floor(rnd()*a.length))];
  // A mood/style chosen by 「AI로 고르기」 is kept when a selected theme allows it.
  const fits = id => (!choices.mood || presets[id].moods.includes(choices.mood)) && (!choices.style || J.themeCandidates(project,id).styles.includes(choices.style));
  const fitting = ids.filter(fits), key = pick(fitting.length ? fitting : ids), theme = presets[key], pools = J.themeCandidates(project,key);
  const mood = theme.moods.includes(choices.mood) ? choices.mood : pick(theme.moods), styles = pools.styles.filter(id=>id!==project.style);
  const themeProject = themeSwitches(project,key);
  const look = unrestricted(themeProject,rnd,{mood,style:pools.styles.includes(choices.style) ? choices.style : pick(styles.length ? styles : pools.styles),themeId:choices.themeId});
  // No out-of-theme "sprinkle" or random palette/font override.
  look.fonts = {}; look.colors = {...project.colors,enabled:false,accentOn:false};
  look.fx.flash = theme.flash && rnd()<.5;
  look.fx.motion = Math.min(1,J.lerp(...theme.motion,rnd()));
  if (!theme.flash) {look.fx.glitch=Math.min(look.fx.glitch,.2);look.fx.chroma=Math.min(look.fx.chroma,.4);}
  for (const group of J.GROUP_KEYS) {
    const pool = pools.lyrics[group], selected = pool.filter(()=>rnd()<(project.themeBalance==='unified'?.4:.75));
    if (!selected.length && pool.length) selected.push(pick(pool));
    for (const id of neutral[group] || []) if (pool.includes(id)) selected.push(id);
    const enabled = new Set(selected);
    look.enabled[group] = Object.fromEntries(J.order(group).map(id=>[id,enabled.has(id)]));
  }
  for (const layer of ['foreground','media']) {
    const settings = J.mediaEffectSettings(project,layer), on = new Set();
    // Preserve a usable independent pool for main motion, entrance and exit.
    for (const stage of [undefined,'enter','exit']) {
      const pool = pools.media.filter(id=>J.MEDIA_TECH[id].stage===stage && J.mediaTechAllowed(id,layer));
      for (const id of pool) if (rnd()<(project.themeBalance==='unified'?.3:.65)) on.add(id);
      if (pool.length && !pool.some(id=>on.has(id))) on.add(pick(pool));
    }
    settings.enabled = Object.fromEntries(Object.keys(J.MEDIA_TECH).filter(id=>J.mediaTechAllowed(id,layer)).map(id=>[id,on.has(id)]));
    // Media decorations follow the theme's lyric decoration pool (front ones only).
    settings.decorEnabled = Object.fromEntries(J.order('decor').filter(id=>J.DECOR[id]).map(id=>[id,!!look.enabled.decor?.[id] && J.DECOR[id].layer==='front']));
    settings.motion = J.lerp(...theme.motion,rnd()); settings.duration = J.lerp(...theme.duration,rnd());
    look[layer] = {...project[layer],effects:settings};
  }
  if (key === 'horror') look.horror = true;
  look.appliedTheme = key;
  return look;
};
})();
