# JIZURA 표현 팩 — 기여자 가이드

JIZURA는 브라우저 리릭 비디오(문자 PV) 엔진입니다: 가사 → 타이밍이 붙은 "컷", 각 컷 = **레이아웃**(구성) 하나 +
**등장** + **유지**(대기 동작) + **퇴장** + **장식** 그래픽 0..n개 (+ 가공 / 배경 / 카메라 / 효과,
이것들은 다른 팩이 담당). 모든 것은 *설계 공간*의 Canvas2D에 렌더링되며 시드로부터 결정론적으로 동작합니다.

팩은 파일 하나입니다: `src/11p_<pack>.js`. 새 항목만 등록하며, 코어 파일은 절대 수정하지 않습니다.

먼저 읽어야 할 기존 구현(코드 스타일과 모든 관용구를 보여줍니다):
`src/06_layouts.js`(레이아웃, `J.mainDraw`, `J.drawFx`), `src/05_anim.js`(등장/유지/퇴장), `src/07_decor.js`(장식),
`src/03_text.js`(`J.drawItem` — 텍스트 아이템 모델), `src/09_render.js`(`makeEnv` 드로잉 헬퍼).

## 파일 골격

```js
/* JIZURA pack: <pack> — <one line> */
(() => {
'use strict';
const E = J.E;
const P = '<pack>';            // pack name for J.register
J.register('layout', 'myKey', { name: '한글 이름', tags: ['pop', 'graphic'], w: 1, fits: n => n <= 12, plan(rng, cut, st) { … }, render(env) { … } }, P);
})();
```
`J.register(group, key, def, pack)`는 항목을 레지스트리와 순서 배열에 추가합니다. key는 고유한 camelCase여야 하며
기존 key와 충돌하면 안 됩니다(`J.order(group)`으로 확인하세요). `name`(한국어, 짧게 2–7자)은 UI에 표시됩니다.
`tags` = 어울리는 분위기로 다음 중 아무거나: `glitch calm pop graphic editorial emotional horror`(`horror`는 호러 세트 전용). `w` = 기본 선택 가중치(1 = 보통;
0.4–0.7 = 기발하거나 아주 특정한 룩; 1.2–1.5 = 강한 범용).

## 설계 공간 & 환경

화면 비율별 설계 크기: 16:9 1920×1080 · 9:16 1080×1920 · 4:3 1440×1080 · 3:4 1080×1440 · 1:1 1440×1440 · 4:5 1440×1800 · 21:9 2520×1080.
위치/크기는 항상 `W`/`H`(그리고 `Math.min(W, H)`) 기준으로 두세요; 모든 레이아웃은 가로형과 세로형 모두에서 올바르게 보여야 합니다.

모든 render/draw/apply는 `env`를 받습니다:

| 필드 | 의미 |
|---|---|
| `ctx` | CanvasRenderingContext2D, 이미 설계 공간(및 카메라)으로 변환됨 |
| `W`, `H` | 설계 크기 |
| `sc` | 색 스킴: `bg fg sub accent accent2 ink dim ghostA ghostB` (+ 선택적 `grad:[a,b]`). `ink` = 스티커/판 색, `dim` = 흐린 배경 글자 색. 오직 이 색만 사용하세요(대비 판단에는 `J.lum`로 `#000/#fff`를 쓸 수 있음). |
| `st` | 스타일 팩: `st.fonts.display/serif/body/mono` = 폰트 키의 배열 |
| `fx` | 슬라이더 0..1: `motion glitch chroma decor density texture bgSwitch` |
| `cut` | `text`(이 컷의 텍스트), `lineText`(전체 가사 행), `note`, `line`(인덱스), `index`, `start end dur inDur outDur`, `params`(당신의 plan() 출력), `seed`, `emph`(강조됨), `words`(청크) |
| `lt` | 컷 시작 이후의 로컬 시간(초). **패스마다 지연**됩니다(고스트 참조) |
| `ltb` | `lt` + 패스 지연 — 고스트가 올바르게 뒤쳐지도록 연속 동작(스크롤, 회전)에는 이것을 사용하세요 |
| `pIn`, `pOut` | 컷의 등장 / 퇴장 진행도 0..1 |
| `step` | 정수 무작위 클럭(≤24 Hz) — 깜빡임/지터의 무작위성용 |
| `pass` | `'B'`, `'A'`(크로매틱 고스트 패스, 먼저 그려지고 틴팅됨) 또는 `'main'` |
| `scale` | 설계→픽셀 스케일(픽셀 크기의 스트로크/필터용) |
| `allowFilter` | 빠른 미리보기에서는 false — false일 때 `ctx.filter` 블러를 건너뜁니다 |
| `energy` | 0..1 오디오 라우드니스 또는 null · `beat` = `{since, len, index}` 또는 null |

### 크로매틱 고스트 패스(중요)
각 레이아웃의 `render` / 장식의 `draw`는 프레임당 세 번 호출됩니다: 패스 B, 패스 A(시간 지연, 주 이미지 아래 단일 고스트 색으로
그려짐), 그리고 메인 패스. 이걸 env 헬퍼가 대신 처리해 줍니다:
- `env.draw(item)` / `J.mainDraw(env, item)` — 텍스트; 고스트 패스는 같은 글자를 고스트 색으로 그립니다. 크로매틱 고스트를
  받으면 안 되는 보조 텍스트에는 `ghost: false`를 설정하세요.
- `env.rect(x, y, w, h, color, alpha = 1, ghost = true)`, `env.line(pts, color, lw, alpha, ghost)`, `env.polyPartial(pts, e, color, lw, alpha, ghost)`,
  `env.circle(cx, cy, r, fill, stroke, lw, alpha, ghost)`, `env.arc(cx, cy, r, a0deg, a1deg, color, lw, alpha, ghost)`,
  `env.rrect(x, y, w, h, r, fill, alpha, ghost, stroke, lw)`, `env.poly(pts, color, alpha, ghost)`, `env.blob(pts, color, alpha, ghost)`.
  `ghost=false`면 그 도형은 메인 패스에서만 그려집니다. 분할되어야 할 굵은 그래픽 도형에만 `ghost=true`를 사용하세요.
- `ctx`로 직접 그리는 경우(그라디언트, 클립 패스, 이미지…)에는 반드시 가드하세요: `if (env.pass === 'main') { … }`,
  아니면 실제 색으로 3번 그려집니다. 변환/클립/알파/합성 변경 전후로 `ctx.save()/restore()`.

## 텍스트 아이템(`J.drawItem` 모델)

`{ text, font, size, x, y, color, align:'center'|'left'|'right', vertical, lead, track, sx, sy, rot, skew, alpha,
   fill (default true), stroke (px), strokeColor, strokeUnder, strokeDash:[a,b], gradient:[c1,c2] or [[offset,colour],…],
   pattern:'dots'|'stripes'|'hatch'|'grid'|'lines' (+patternColor, patternBg), shadow:{color,blur,dx,dy}, extrude:{n,dx,dy,color,fade,a},
   fillAlpha, dash (0..1 stroke draw-on progress), blur, blend, ghost:false, mi (motion index for stagger), plain:true (skip treatments),
   enter/exit/hold (per-item override keys), noHold }`
글자는 `(x, y)`에 중앙 정렬됩니다(다중 줄은 `\n`; `lead` = 줄 간격 계수). `J.measure(item)` → `{w, h, lay}`,
`J.fitSize(text, font, maxW, maxH, {sx, sy, track, lead, vertical})` → 들어맞는 크기, `J.itemBox(item)` → `{x0 y0 x1 y1 w h cx cy}`,
`J.splitLines(text, maxPerLine)` 균형 잡힌 일본어 줄바꿈, `J.glyphCount(text)`, `J.fontsOf(st, ['display','serif'])` → 폰트 키,
`J.metrics.adv(fontKey, ch)` em 단위 advance. 폰트: `gothic_black gothic_bold gothic_med gothic_light dela zenkaku mincho_black mincho_bold
mincho mincho_light tokumin round pop dot brush mono sansui` — 스타일의 역할 폰트(`st.fonts.*`)를 우선 사용하세요.

`J.mainDraw(env, item)`는 컷의 등장/유지/퇴장/가공이 적용된 상태로 가사를 그리고 그 bbox
`{x0,y0,x1,y1,cx,cy,boxes}`를 반환합니다(숨겨져 있는 동안은 null). `env.draw(item)`는 일반 텍스트(동작 없음)를 그립니다 — 보조 텍스트에
사용하세요. bbox는 `J.unionBB(a, b)`로 합치고, 대체용으로 `J.centerBB(env, bb)`.

enter/exit/hold가 아이템에 설정할 수 있는 동작 추가 속성: `clip:[x0,x1]`(가로 창), `clipY:[y0,y1]`, `clipFn(ctx, env, it)`
(경로를 추가하면 그것이 클립이 됨), `bands:[[y0,y1,dx],…]`(시프트된 가로 슬라이스), `vbands:[[x0,x1,dy],…]`(세로 슬라이스),
`streak:{n,dx,dy,a}`(모션 트레일 사본), `echo:{n,dx,dy,a,decay,scale,rot,outline,color}`(뒤쪽 단계 사본),
`wipeBar:{x,h}`, `cursorAt`, `pre(env,it)` / `post(env,it,bb)` 훅, 그리고 위의 어떤 아이템 필드든.
헬퍼: `J.itemBands(env, it, n, (i,n)=>dx)`, `J.itemVBands(env, it, n, (i,n)=>dy)`.
글자별 함수: `(i, g, n) => ({dx, dy, rot, s, sx, sy, a, color, ch, hide, skew, blur, outline, clipX:[a,b], clipY:[a,b]})`
를 `it.charFns`에 push하세요(`i` = 글자 인덱스, `n` = 글자 수, `g` = 글자 레이아웃으로 `g.w g.h g.x g.y`; clipX/clipY는 글자 박스의
비율이고 중심이 0, 예: `clipY:[-0.7, 0.2]`는 윗부분을 보여줍니다). "변경 없음"은 `null`을 반환. 획 조각별 함수(고급):
`it.pieceFns.push((ci, pj, piece, ox, oy) => J.PT(dx, dy, rot, s, stretch, stretchDir, a))`, 유지에는 `J.PID`를, 숨김에는 `null`을 반환;
레시피에 `pieces: true`를 설정하세요(05_anim.js의 `assemble`, `explode` 참조).

## 무작위, 이징, 색
결정론적으로만 — render/draw/apply에 `Math.random()`은 절대 금지. `plan(rng, …)`에서는 `rng()`, `rng.range(a,b)`, `rng.int(a,b)`,
`rng.pick(arr)`, `rng.chance(p)`를 사용하세요. 렌더링 시에는 해시: `J.r(a,b,c,d,e)` 0..1, `J.rs(…)` −1..1, `J.rr(lo,hi,…)`, `J.h(…)` uint,
키는 `env.cut.seed`, `it.seed`, 인덱스, `env.step`. `J.noise1(x, seed)`는 매끄러운 노이즈. 이징 `J.E.lin inQuad outQuad inCubic outCubic inOutCubic
outExpo inExpo inOutExpo outBack(x, s) outElastic inOutSine`. `J.clamp(x,a=0,b=1) J.lerp J.smooth(a,b,x) J.TAU J.DEG`.
색: `J.lum(hex)` 0..1, `J.mix(a, b, t)`, `J.rgba(hex, alpha)`, `J.fitContrast(hex, bg, ratio)`. 스크립트 테스트: `J.isKanji J.isHira J.isKata J.isLatin J.isPunct J.isSmallKana`.
`J.romaji(kana)`(한자가 있으면 null), `J.fmtTime(t)`.

## 그룹 계약

**layout** `{ name, tags, w, fits(n) → bool (n = 공백 제외 글자 수, 1..30), plan(rng, cut:{text,n,W,H,dur}, st) → params (일반 JSON: 숫자/문자열/불리언/배열, 함수 없음), render(env) → bbox|null,`
선택적 `portrait`(H > W일 때 가중치 배율, 세로형이 약하면 예: 0.5), `emph`(강조된 행에 대한 가중치 배율),
`treat: false | 'safe'`(false = 텍스트 가공 없음; 가사가 당신의 색판 위에 놓일 때는 'safe'), `busy: true`(당신이 화면을 다 채우면 → 바쁜 배경이 억제됨), `enterBias: {enterKey: mult}` }`
- 가사 자체는 반드시 `J.mainDraw`를 거쳐야 합니다(그래야 모든 등장/퇴장/가공이 적용됨); 여러 아이템에는 스태거를 위해 `mi`를 사용하세요.
- 당신만의 보조 그래픽은 IN(예: `E.outExpo(J.clamp(env.lt / 0.35))`처럼 `env.lt` 사용)과 OUT(`1 - E.inCubic(env.pOut)`)
  애니메이션을 넣어야 합니다.
- 모든 비율에서 정지 상태의 가사를 ~5% 안전 여백 안에 두세요; 1–16글자(`fits`로 안 되는 것은 제외)와 공백이 있는 라틴 텍스트를 처리하세요.
- 파라미터는 `plan`에서 고릅니다(컷마다 다양성을: 2–4개 변형, 크기, 방향… 중에서), 렌더링은 `env.cut.params`를 읽습니다.

**enter** `{ name, tags, w, apply(env, it, p, ctx) }` — `p` 0→1(아이템별 `it.delay`로 이미 지연됨); `ctx = {dur, inDur, outDur}`.
아이템을 변경하거나 charFns를 push해서 p=0이 "아직 보이지 않음", 그리고 **p=1이 정확히 정지 상태의 아이템**이 되게 하세요
(남은 오프셋/알파 없이).
선택적: `inDur(dur, n) → 초`(기본 clamp(dur*0.36, 0.12, 0.6)), `minDur`(이보다 짧은 컷에는 사용 금지), `maxChars`, `pieces: true`.
apply()는 p < 1인 동안에만 호출됩니다.

**exit** `{ name, tags, w, apply(env, it, p, ctx) }` — p 0(정지) → 1(**완전히 사라짐**: 알파 0 / 화면 밖 / 숨김). 선택적 `outDur(dur, n)`, `minDur`.

**hold** `{ name, tags, w, apply(env, it, amt, ctx) }` — 컷이 정지하는 동안의 연속 대기 동작; `amt` 0..1은 등장 후 램프업하고
퇴장 중 램프다운; 효과는 `amt`(0 = 변화 없음)와 `env.fx.motion`에 비례해야 합니다. `env.lt`/`env.ltb`, `env.step`, `env.beat`를 사용하세요. 절제 > 과함.

**decor** `{ name, tags, w, layer: 'back'|'front', subtle?: true (바쁜 레이아웃 뒤에 괜찮음), draw(env, bb, P) }` — `bb` = 가사 bbox(널일 수 있음 → `J.centerBB(env, bb)`).
`P = {id, seed, n (1..3), right, low, accent, corner, big (불리언), mode, from, to, v (정수 0..5 변형), r (0..1)}` — 다양성에 쓰세요.
`env.lt`의 첫 ~0.3–0.5초에 걸쳐 등장시키고, `env.pOut`으로 퇴장시킵니다. 전면 장식은 가사 bbox를 덮으면 안 됩니다(주변/밖 유지);
후면 장식은 텍스트 아래에 놓이는데 — 작지 않은 한 저대비로 유지하세요(`sc.dim`, `sc.sub`, 낮은 알파).

**treat** `{ name, tags, w, safe?, plan?(rng, st) → params, apply(env, it, P) }` — enter/hold/exit이 실행되기 전에 컷의 모든 메인
아이템에 적용되는 텍스트 가공(전체 행, 단일 글자, 세로, 회전, 거대한 글자). `it.fill === false`이거나 알파가 낮은 아이템(레이아웃의
보조 사본)은 건너뜁니다. `it.color`를 텍스트 색으로 유지하고, 보색은 `env.sc`에서 `J.lum`으로 대비를 확인하며 고르세요.
가사가 색판 위에 놓여도 여전히 제대로 보일 때만 `safe: true` — `treat:'safe'`로 표시된 레이아웃은 safe 항목만 받습니다.
마커/박스/밑줄은 `it.pre` / `it.post` 훅을 사용합니다(모든 패스에서 실행됩니다 — env 헬퍼의 고스트 플래그를 의도적으로 쓰세요).

**bg** `{ name, tags, w, subtle?, plan?(rng, st) → params, draw(env, P) }` — 전체 화면 배경 그래픽. 프레임당 한 번만 그려집니다
(메인 패스에만, 카메라의 영향을 받지 않음). 스킴의 배경색을 채운 뒤, 어떤 텍스트보다 먼저 그려집니다. 가사 행마다 선택되므로
연속 동작에는 `env.t`(절대 시간)를 사용하세요. 그 위의 텍스트가 읽히도록 대비는 낮게 유지하세요. `subtle: true` = 바쁜
레이아웃 뒤에 써도 됨.

**cam** `{ name, tags, w, strong?, plan?(rng, st) → params, get(env, P) → {x, y, s, rot, sx, sy, skx, blur} }` — 화면 중심(설계
px / 도) 주위의 컷 콘텐츠 변환. 패스마다 지연된 시간으로 호출됩니다. 가사를 화면 안에 두세요(|x|,|y| ≤ 5%, s 0.92..1.15,
rot ≤ 5°); 큰 움직임은 잠깐만 해야 하고 반드시 정착해야 합니다. `env.fx.motion`로 스케일; 공격적인 움직임에는 `strong: true`.

**fx** `{ name, tags, w, glitchy?, edge? (default true), mid?, dur (frames @24fps, default 4), pre (frames before the cut boundary),
amp, scratch?, ae?, draw(ctx, ev, k, info) }` — 디바이스 픽셀 기준의 후처리(항등 변환). `info = {cw, ch, S (copy of the
frame when scratch:true), sc, st, step, t, scale, allowFilter, opt, tmp(w,h), tmp2(w,h)}`; `k` 0..1 진행도, `ev.amp` 강도.
ctx 상태를 깨끗하게 남기세요. 전체 프레임에 `getImageData` 금지. `ae` = 가장 가까운 After Effects 이벤트 타입
(`chroma shake slice block invert flash zoom mosaic`) 또는 생략.

**trans** (컷 간 전환) `{ name, tags, w, dur (seconds, default 0.35), plan?(rng, st) → params, draw(ctx, A, B, p, info) }` — 이전
컷에서 이번 컷으로 넘어가는 방식. `A` = 이전 컷의 정지 프레임이 담긴 캔버스, `B` = 이번 컷의 프레임이 담긴 캔버스(둘 다 전체
디바이스 픽셀 크기), `p` 0→1(선형; 이징은 직접 하세요). 완전한 합성을 `ctx`에 그리세요(항등 변환, 같은 크기) — p=0에서는 정확히
A처럼, p=1에서는 정확히 B처럼 보여야 합니다. `info = {cw, ch, sc, scPrev, st, P, step, t, scale, allowFilter, seed, tmp(w,h)}`.
전환을 쓰면 플래너는 이전 컷의 퇴장과 이번 컷의 등장을 일반 컷으로 바꿉니다.

**style** (색 배합 세트) — `J.STYLES` + `J.STYLE_ORDER`에 직접 추가됩니다(전체 스키마는 src/04_styles.js 참조): `{ name, desc,
moods: [mood keys], schemes: [2–4 × {bg, fg, sub, accent, accent2, ink, dim, ghostA, ghostB, grad?, paper?}], fonts: {display, serif,
body, mono}, texture: {grain, paper, scan}, ghost, bias: {layout, enter, exit}, decor: {decorKey: weight}, hud, glow?, glitchBoost?, useGrad? }`.

### After Effects 대응 항목 (`ae`)
모든 새 **layout / enter / exit / hold / decor** 항목은 `ae: '<key>'` = 원본 세트에서 가장 가까운 대응 항목을 선언해야 하며,
이는 브라우저가 플랜을 After Effects 패널로 내보낼 때 사용됩니다:
- layout: `center mixed vcols marquee tile scatter ring wave huge labels condensed gloss type diag circle stack pill`
- enter: `cut assemble slice type pop drop stretch wipe blur spin flicker scramble zoom`
- exit: `cut explode fall drift slice wipe shrink blur stretch scatter glitch`
- hold: `still jitter drift breathe wave glitchtick`
- decor: `brackets rings dots arrows slash sparks leaders waveform barcode grid stripes blobs bars shapes counter`

### 글꼴
카탈로그 키: `gothic_black gothic_bold gothic_med gothic_light dela zenkaku mincho_black mincho_bold mincho mincho_light tokumin
round pop dot brush mono sansui` + 더 새로운 페이스 `reggae` (Reggae One, 거칠고 묵직한 디스플레이) `rampart` (Rampart One, 3D 외곽선
디스플레이) `potta` (Potta One, 브러시 팝) `kiwi` (Kiwi Maru, 부드럽고 둥근) `klee` (Klee One, 손글씨 연필 느낌) `shippori`
(Shippori Mincho B1, 우아하고 묵직한 명조체). 페이스는 플랜이 사용할 때에만 지연 로드되므로, 스타일의 역할 폰트(`st.fonts.*`)를
우선하세요. (Google Fonts에 접속할 수 없으면 시트는 시스템 대체 폰트로 렌더링됩니다 — 레이아웃과 동작을 판단하고 활자체는 판단하지
마세요.) 이 포크에는 한국어 페이스 `kr_black kr_bold kr_med kr_light kr_display kr_serif_bold kr_serif kr_ui`(Noto Sans KR /
Black Han Sans / Noto Serif KR / IBM Plex Sans KR)가 있습니다.

### 추가 연출 / 일본풍 (무작위 후보 세트)
`src/11q_sets.js`가 무작위 선택이 무엇을 쓸 수 있는지 결정합니다. `J.BASE_PACKS`에 목록되지 않은 팩의 항목은 추가 항목(뱃지
「추가」)로 취급되며, 프로젝트의 「추가 연출도 사용」 스위치가 켜져 있을 때만 무작위로 선택됩니다. 전통적인 일본 소재·문양·모티프
(등롱, 쇼지, 부채, 가문, 세이가이하 …)를 중심으로 만든 항목은 `J.WA`에 목록되거나 `wa: true`를 달아야 「일본풍 연출도 사용」
스위치가 끌 수 있습니다(일본풍 항목, 뱃지 「일본풍」). 새 스타일은 `J.BASE_STYLES`에 목록되지 않는 한 추가 항목이고, 새 글꼴은
`J.EXTRA_FONTS`에 넣으세요.

### 자체 스위치가 있는 부품 세트 (문자 PV / 키네틱 / 호러)
팩 이름이 `typo`·`kinetic`·`horror`인 항목(또는 `set: '<name>'`을 가진 항목)은 추가 연출이 아니라 자체 스위치를 가진 세트에 속합니다
(`project.typo`·`project.kinetic`은 기본 켬, `project.horror`는 기본 끔). 스타일도 `set: '<name>'`으로 세트에 넣습니다.
호러 분위기(`J.MOODS.horror`)는 호러 스위치가 켜져 있을 때만 자동 생성에 나오며, 호러 항목은 그 분위기에서만 쓰입니다.
key에는 세트 접두사(`ty`, `kn`, `hr`)를 붙이고, 새 세트는 `J.SETS`(src/11q_sets.js)에 항목과 UI 스위치가 필요합니다.

### 중복 피하기
설계하기 전에 그룹에 이미 무엇이 있는지 나열하세요: 시각물에는 `node -e`만으로는 부족합니다 —
`python3 dev/overview.py <group> out/ov t_all`를(`python3 dev/build_test.py all --all-packs` 후) 실행하고 그리드를
살펴보세요. 모든 새 항목은 기존의 모든 항목과 구별되게 달라야 합니다(다른 동작 원리, 구도 또는 그래픽 아이디어 — 숫자만 다른
같은 것이 아니라면).

## 성능 & 견고성
1080p에서 호출당 약 2 ms 예산. `getImageData` 금지, 프레임당 캔버스 생성 금지(사전 렌더링이 꼭 필요하면 파라미터 키의 모듈 수준
Map에 캐시), 무한 루프 금지(개수 상한). `bb === null`, 빈 텍스트, 1글자 텍스트, 아주 긴 텍스트에 대비하세요. 예외 금지.

## 테스트 루프(모든 항목에 이것을 하세요)
```
python3 dev/build_test.py <pack> src/11p_<pack>.js          # builds dev/www/t_<pack>.html (core + your pack only)
(cd dev/www && python3 -m http.server 8765 &)                 # once
python3 dev/pack_sheet.py --page t_<pack> --group layout --ids key1,key2 --out out/<pack>
```
요구 사항: `playwright`(Chromium)와 `Pillow`가 있는 Python 3.
시트 도구는 항목별 콘솔 문제(0이어야 함)와 가장 느린 프레임을 출력하고, id마다 컨택트 시트 PNG 하나를 씁니다
(레이아웃: 텍스트 4개 × 16:9/9:16/4:3/1:1 + 타임라인 행; 등장/퇴장/유지: 4개 레이아웃에 걸친 동작의 프레임; 장식: 세팅 4개 × 시간).
모든 시트를 비판적으로 보세요 — 겹치는 텍스트, 화면 밖 텍스트, 조악한 간격, 평평하거나 기존과 동일한 동작, p=1에서 남는 잔재,
애니메이션 대신 튀어 오르는 그래픽. `python3 dev/build_test.py all --all-packs && python3 dev/smoke_all.py t_all`는 모든
항목을 다양한 조합으로 렌더링하고, `python3 dev/overview.py <group> out/ov t_all`는 그룹마다 개요 그리드를 만듭니다
(그룹: layout enter exit hold decor treat bg cam fx trans style).
`python3 dev/cost_scan.py t_all 45`는 프레임이 45 ms보다 오래 걸리는 항목을 나열합니다.
문법 검사: `node -e "new Function(require('fs').readFileSync('src/11p_<pack>.js','utf8'))"`. 마지막으로 `python3 build.py`를 실행하세요.

## After Effects
AE 패널(`ae/*.jsx`, `python3 build_ae.py`로 빌드)은 자체 레지스트리를 가집니다: `ae/05_reg.jsx`의 `jzReg(group, key, def)`,
코어 항목은 `ae/20_motion.jsx` … `ae/45_core.jsx`, 이식된 팩은 팩마다 파일 하나(`ae/p_*.jsx`). 플래닝 메타데이터(가중치·태그·
추가분/일본풍 플래그·fits·길이)는 `node tools/export_ae_data.js`로 브라우저 엔진에서 `ae/data.json`으로 내보내므로 두 플래너가
같은 결정을 내립니다. 아직 AE 이식이 없는 브라우저 항목은 가장 가까운 이식 항목(`ae` 대응 항목, 위의 "After Effects 대응 항목"
참조; src/11_export.js의 `J.AE_MAP`로 재정의 가능)으로 대체됩니다 — 브라우저 → AE JSON 내보내기가 계속 동작하도록 새 항목에는
계속 `ae` 대응 항목을 부여하세요.
점검(처음 한 번 `cd dev && npm install` 필요): `node dev/ae_test.js`는 ES3 환경의 에뮬레이션된 AE 오브젝트 모델 위에서 모든
스타일 × 여러 시드를 빌드하고, `node dev/ae_check.js --group layout --ids all`은 한 그룹의 이식된 부품을 점검합니다.
