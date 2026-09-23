# 간주 연출 확장 · 표현 로드맵 (A–F) 설계

작성일 2026-09-24. 사용자 Goal: A부터 F까지 설계 → 구현 → 검증 → README 반영 → 커밋·push를 단계별로 진행.
설계 승인 절차는 Goal로 사전 위임되었으므로, 애매한 결정은 추천안으로 정하고 이 문서에 기록한다.

## 공통 원칙

- **기존 결과 보존**: 새 옵션의 기본값은 기존 동작과 같게 한다(슬라이더 0, 체크 해제, `auto`). 새 표기를 쓰지 않은 가사는 같은 시드에서 같은 구성이 나와야 한다.
- **브라우저 우선, AE는 계획(plan) 호환**: 가사 파싱·타이밍·컷 구성은 브라우저(`src/08_planner.js`)와 AE(`ae/00_core.jsx`, `ae/15_plan.jsx`) 양쪽에 구현한다. 새 렌더링 부품(레이아웃 변형·등장·카메라·스타일)은 기존 규칙대로 브라우저 전용이며, AE는 가장 가까운 기본 부품으로 대체된다(`ae` 대응 필드 / 변형 대체).
- **새 부품은 팩 파일**: `src/11p_<pack>.js`에 `J.register`로 등록(코어 수정 최소화). 새 팩은 `J.BASE_PACKS`에 없으므로 「추가 연출」로 분류된다.
- **검증**: 각 단계마다 node 계획 테스트(웹·AE 결과 비교), `dev/ae_test.js`, Playwright `smoke_all.py`(problems 0 / page errors 없음), 새 부품은 `pack_sheet.py` 시트를 눈으로 확인.
- **커밋 단위**: 단계(A…F)마다 README 반영 후 커밋·push.

## 기존 부품과의 중복 조사 결과

이미 있는 것: 글자 가공 `karaoke`(컷 길이 기준 채움), 등장 `strokeDraw` `strokeOrder` `brushReveal` `outlineFill` `neonOn` `crtOn`,
레이아웃 `perspective` `tunnel` `depthStack` `neon` `swissGrid` `cassette` `vinyl` `bubble`, 카메라 28종(`vertigo` `dollyIn` `beatPunch` 등),
화면 효과 `vhsRoll` `vhsBand` `crtOff` `filmBurn` `focusLines` `halftone`, 배경 `retroGrid` `squareTunnel` `speedLines`, 스타일 `synth80` `vapor`.
렌더러는 박 위치로 색 어긋남을 이미 약하게 펄스시키고(`beatPulse`), `env.energy`/`env.beat`를 모든 부품에 넘긴다.
→ D·E·F는 **없는 기능만** 추가하고 기존 부품은 스타일 바이어스로 묶어 활용한다.

---

## A. 간주 표기 확장

| 표기 | 의미 |
|---|---|
| `[간주 8 \| Guitar Solo]`, `[간주 \| 문구]` | 간주 화면 아래 작은 글자를 곡 제목 대신 이 문구로 |
| `[01:20.00][간주]`, `[01:20.00][간주 8 \| 문구]` | 앞 행이 그 시각에 끝나고 간주가 그 시각에 시작 (`[마무리]`와 같은 규칙) |

- 파서: `breakBefore = { sec, at, text }`. `at`은 앞 행의 `end`를 `at`으로 고정(`max(s+0.35, at)`)하고, 앞 행 표시는 `min(기존 상한, at)`, 간주 컷은 `at`에서 시작. 다음 행의 시작 시각은 바꾸지 않는다(시각은 LRC·수동 시간이 결정).
- **곡 중간 크레딧**: 연출 옵션 「첫 간주에 크레딧」(`fx.interCredit`, 기본 OFF). 켜면 첫 간주 컷(표기·자동 모두)이 `variant: 'credit'`이 되어 곡 제목을 크게, 아티스트를 작게 보여준다. 제목이 없으면 적용하지 않는다. 2초 미만 간주에는 적용하지 않는다.
  - 브라우저: `J.LAYOUTS.interlude`에 `credit` 변형 렌더 추가. AE: `JZ_LAYOUTS.interlude`에 같은 변형 추가(제목 텍스트 + 아티스트 소형).
- UI: 브라우저 「연출」 탭 체크박스, AE 패널 체크박스(설정 기억).

## B. 간주 화면 팩

간주 레이아웃 `variant` 추가 (브라우저 전용 렌더, AE는 `rings`로 대체):

| variant | 화면 |
|---|---|
| `countdown` | 간주 마지막 3박(박 정보 없으면 마지막 3초)에 3·2·1 숫자가 박마다 튀어나옴. 그 전에는 원 |
| `preview` | 다음 가사를 흐리게(sc.dim) 작게 보여주고, 끝나갈수록 선명해짐 |
| `progress` | 곡 전체 진행 바 + `현재 / 전체` 타임코드 |
| `wave` | 에너지 막대(스펙트럼 느낌). 곡 에너지가 없으면 시드 기반 가짜 파형 |

- **변형 선택**: `interCount`가 `auto`면 전체 6종(`counter rings countdown preview progress wave`)에서, `on`이면 `counter`, `off`면 `counter`를 뺀 나머지에서 무작위. 크레딧(A)이 우선.
- **박 펄스**: 모든 간주 변형에서 원·막대가 `env.beat`에 맞춰 튄다(박 정보 없으면 `bpm`, 그것도 없으면 펄스 없음). 크기는 `fx.motion` 비례.
- **긴 간주 분할**: 간주가 6초를 넘으면 `ceil(len/4)`개(최대 3개) 컷으로 나누고, 컷마다 다른 변형·색 스킴·장식을 고른다. 분할 경계는 박이 있으면 가장 가까운 박으로 스냅. AE 계획도 같은 규칙으로 분할(변형은 counter/rings).
- 계획 데이터: 간주 컷 `params`에 `next`(다음 행 텍스트), `total`(영상 길이) 추가.

## C. 음악 반응

연출 슬라이더 「음악 반응」(`fx.react` 0..1, 기본 0 = 기존과 동일). 브라우저 전용.

- 렌더러 공통부(`src/09_render.js`)에서 한 번 계산: `pulse = 박 직후 감쇠(exp)`, `lvl = energy`(없으면 0).
- 적용: (1) 컨텐츠 전체 스케일 `1 + react·(0.035·pulse + 0.03·lvl)` (2) 색 어긋남 양 `× (1 + react·(1.2·pulse + 0.8·lvl))` (3) 흔들림 `react·0.35·pulse`(motion 비례).
- 곡이 없으면 아무 변화 없음. 오마카세의 분위기별 값 범위에 `react` 추가(팝·글리치·감성 높게, 차분함 낮게) — 단 사용자가 슬라이더를 만진 적이 없어도 자동 생성 시에만 들어간다.

## D. 가사 싱크 강화 (확장 LRC)

- 표기: 확장 LRC 단어 시각 `[00:12.00]<00:12.00>나는 <00:12.48>너를 <00:13.10>사랑해` (A2 형식). 행 안 `<mm:ss.xx>` 태그를 지우고 `ln.marks = [{t, ci}]`(ci = 태그 직후 글자 위치)로 저장.
- 컷 분할: marks가 있는 행은 컷 경계를 비율 대신 marks 시각에 맞춘다(각 컷의 시작 = 그 컷 첫 글자 직전 mark).
- 카라오케: 컷 `params.charT`(컷 글자별 시작 시각, 컷 기준 상대초)를 계획에 넣고, 글자 가공 `karaoke`가 `charT`가 있으면 컷 길이 대신 실제 시각으로 채운다. marks가 있는 행에서는 `karaoke` 가공이 선택될 가중치를 올린다(×3).
- AE: 태그 제거와 컷 경계 정렬만 적용(채움 연출은 브라우저 전용).

## E. 공간·카메라 / 손글씨·획

새 팩 `src/11p_space.js`. 기존과 원리가 다른 것만:

- 레이아웃 `parallax`: 행의 청크를 앞·중·뒤 3개 깊이 층에 배치하고 층마다 다른 속도·크기·흐림으로 흘러감(뒤 = 작고 흐리고 느림). ae: `scatter`.
- 레이아웃 `approach`: 소실점에서 글자가 한 청크씩 원근 확대되어 다가오고 앞에 멈춤(z 깊이 스케일 + 뒤쪽 잔상 층). ae: `stack`.
- 카메라 `yawTurn`(가로 회전): 세로축 기준으로 화면이 살짝 돌아가는 의사 3D(가로 눌림 sx + 기울기 skx + 가까운 쪽으로 이동). 구현 중 `panL`/`panR`가 이미 가로 이동을 하므로 `parallaxPan` 대신 이것으로 변경.
- 등장 `penWrite`: 글자별 외곽선을 순서대로 그리는 동안 펜촉이 획 끝을 따라가고, 다 그린 글자는 채워짐(`clipX` 순차 + 펜촉, 펜촉은 첫 아이템에만). ae: `type`.
- ~~장식 `markerSwipe`~~: 기존 `highlightMark`(형광펜)와 원리가 같아서 제외.

## F. 스타일 4종

`src/11p_styles.js`에 추가(스키마 동일, `J.BASE_STYLES`에 없으므로 추가 연출):

| key | 이름 | 색·서체 | 바이어스(기존 부품 활용) |
|---|---|---|---|
| `retro` | 레트로 미디어 | 탁한 남색·바랜 크림·빨강/시안 어긋남, mono·gothic | layout `cassette vinyl ticker subtitleBar`, enter `crtOn interlace type`, fx `vhsRoll trackingNoise crtOff filmBurn`, decor `timecodeBar mediaControls` |
| `manga` | 만화·스크린톤 | 흰 종이·먹색·스크린톤 회색, 굵은 고딕·팝 | layout `bubble crowdBubbles burst panels`, fx `focusLines speedLines halftone`, treat `outline hardShadow`, decor `starburst halftonePatch` |
| `neonCity` | 네온·시티 | 짙은 남보라 밤·핑크/시안 발광 | layout `neon ledScroll billboard`, enter `neonOn flicker`, treat `neonOutline glow`, bg `skyline rainWindow`, glow 높음 |
| `swiss` | 미니멀·스위스 | 흰/미색 + 검정 + 빨강 1색, gothic 계열 | layout `swissGrid poster columnsBig justified`, enter `wipe slideL`, decor `rulerEdge guides` 낮은 장식, ghost 낮음 |

- 스타일의 `bias`가 treat/bg/fx까지 받는지 코드로 확인하고, 받지 않는 그룹은 지원하는 그룹만 사용.
- AE: `ae/data.json`은 기본 12종만 내보내므로 AE 패널 목록에는 추가하지 않는다(브라우저 JSON 가져오기로 색·서체 사용 가능 — 기존 규칙).

## 테스트 계획(단계 공통)

1. node 스크립트로 웹·AE `plan` 비교(표기별 컷 시작/끝, 변형, 분할 수).
2. `node dev/ae_test.js` → `expr errors 0`, `alerts 0`.
3. `python3 build.py --dev && python3 dev/build_test.py all --all-packs` 후 `dev/.venv/bin/python dev/smoke_all.py` → `problems 0`, `page errors []`.
4. 새 렌더(B, E, F)는 `pack_sheet.py`/`overview.py` 이미지 확인.
