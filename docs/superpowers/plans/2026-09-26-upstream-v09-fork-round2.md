# 2차 흡수(업스트림 v0.9.0 + 포크 8c0be6a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 업스트림 852wa/JIZURA v0.9.0과 hirazisora 포크 8c0be6a의 새 변경을 한국어판 `absorb-hirazisora` 브랜치에 병합·한국어화하고, 포함 저장을 바이너리 형식으로 통일하며, 컷 편집 UI를 한 패널로 모은다.

**Architecture:** 업스트림 → 포크 순서로 `git merge`하고, 각 병합 뒤 한국어화 태스크를 둔다. 이어서 1차 잔여(실행 취소 2단계), 바이너리 포함 저장, 컷 패널 통합, 테마·AI 공존과 포크 테스트 이식, 문서·최종 검증을 한다.

**Tech Stack:** 바닐라 JS(`J` 네임스페이스, 단일 HTML 빌드), ExtendScript(AE 패널, `ae/*.jsx` → `build_ae.py`), Python 3 표준 라이브러리, Node `vm` 테스트, Python Playwright(`dev/.venv/bin/python`).

**Spec:** `docs/superpowers/specs/2026-09-26-upstream-v09-fork-round2-design.md` (1차: `docs/superpowers/specs/2026-09-25-hirazisora-fork-absorb-design.md`)

## Global Constraints

- 브랜치 `absorb-hirazisora`(체크아웃됨). 원격 `upstream` = `https://github.com/852wa/JIZURA`(fetch됨, `upstream/main` = bae339e), `hirazisora`(fetch됨, `hirazisora/main` = 8c0be6a).
- `src/`, `app/body.html`, `ae/*.jsx`의 UI 문구는 **한국어**. 일본어로 남아도 되는 것: 폰트 이름, 일본어 가사 판별·샘플 데이터, 주석.
- 받지 않는 것: 포크 사이트 이름 「JIZURA ONE STOP EDITION」/「字面一」, hirazisora.github.io 링크, 포크의 Jev 제거로 생긴 「AI로 고르기」 삭제(우리 것은 유지), 포크 `.jizuraichi` 확장자로 저장(열기만 지원).
- 포함 저장 확장자 `.jizura`, 열기 허용 `.jizura,.jizuraichi,.json`. 바이너리 매직 `JIZURA01`.
- `index.html`은 `python3 build.py`로만 생성. 이번에는 `en/`, `zh-hant/`, `zh-hans/`, `id/`, `ko/`, `vi/`의 index.html과 `JIZURA_AE_en.jsx`, `JIZURA_CEP_en.zip`을 **업스트림본(upstream/main)** 으로 갱신한다. `JIZURA_AE.jsx`는 `python3 build_ae.py`, `JIZURA_CEP.zip`은 `python3 build_cep.py`로 재생성.
- 포트 8765는 사용자 서버 — 바인딩·종료 금지. 테스트 서버는 8766(앱), 8767(결정 서버), 8768(스모크), 8799(가짜 백엔드).
- `dev/`는 gitignore됨 → 새 dev 파일은 `git add -f`, `git ls-files dev`로 확인.
- 테스트 훅은 `J.uiApi`(J.ui는 UI 상태 S).
- 행 overrides·컷 설정의 필드는 공존한다: 어느 경로도 다른 필드를 지우지 않는다(`Object.assign({}, 기존, patch)`).
- 커밋 메시지 한국어, 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## 공통 테스트 명령

```bash
python3 build.py && python3 tools/check_page_js.py index.html                      # JS OK
node dev/media_test.js && node dev/lyric_test.js && node dev/decide_test.js && echo UNIT OK
python3 dev/decision_server_test.py
dev/.venv/bin/python dev/absorb_ui_test.py                                           # ABSORB UI OK
python3 build.py --dev && python3 dev/build_test.py all --all-packs
(cd dev/www && python3 -m http.server 8768 >/dev/null 2>&1 & echo $! > /tmp/claude-smoke.pid); sleep 1
dev/.venv/bin/python -c "import sys; src=open('dev/smoke_all.py').read().replace('localhost:8765','localhost:8768'); sys.argv=['smoke_all.py']; exec(compile(src,'smoke_all.py','exec'))"
kill $(cat /tmp/claude-smoke.pid)
cd dev && npm install --silent && cd .. ; python3 build_ae.py && node dev/ae_test.js | tail -3   # 오류 0
```

---

### Task 1: 업스트림 v0.9.0 병합(동작하는 상태)

**Files:**
- Modify(충돌): `.gitignore`, `README.md`, `app/body.html`, `app/style.css`, `build.py`, `docs/EXPRESSION_PACKS.md`, `src/02_fonts.js`, `src/05_anim.js`, `src/08_planner.js`, `src/08b_omakase.js`, `src/11_export.js`, `src/11p_enter.js`, `src/11p_layoutsB.js`, `src/11q_sets.js`, `src/12_ui.js`, `ae/90_ui.jsx`, `ae/data.json`
- Take theirs: `en/index.html`, `zh-hant/index.html`, `zh-hans/index.html`, `id/index.html`, `ko/index.html`, `vi/index.html`(신규), `JIZURA_AE_en.jsx`, `JIZURA_CEP_en.zip`
- Regenerate: `index.html`, `JIZURA_AE.jsx`, `JIZURA_CEP.zip`, `ae/data.json`

**Interfaces:**
- Produces: 업스트림 새 부품 파일(`src/11p_typo1..3.js`, `11p_kinetic1..3.js`, `11p_horror1..3.js`, `ae/p_typo*.jsx` 등)과 세트 스위치, 컷별 선택(per-cut picks) 코드, 루프 버튼, 잠금 유지가 우리 코드와 함께 동작. 이 태스크에서는 새 일본어 문구가 남아도 된다(Task 2에서 번역).

충돌 해결 규칙:
1. 어느 쪽 기능도 삭제하지 않는다. 우리 쪽: 1차 흡수 전부(배경·전경 컷, 표시 영역, 타임라인 편집, 실행 취소 U, 소재, 번들, AI로 고르기, 컷 경계 따라가기), 간주·마무리 카드, 후보 6개 등. 업스트림 쪽: 위 Produces.
2. 우리 한국어 문구 유지. 업스트림이 기존 문구를 바꾼 곳은 **의미 변경만** 한국어로 반영.
3. `README.md`: 우리 것 유지(`git checkout --ours README.md`). `docs/EXPRESSION_PACKS.md`: 우리 한국어 문서 유지 + 업스트림이 추가한 새 세트 절을 한국어로 요약 추가(짧게).
4. `.gitignore`: 두 쪽 줄 합집합.
5. `build.py`: 우리 구조(한국어판만 빌드) 유지. 언어 메뉴 `editions`에 `('vi/index.html', 'vi', 'Tiếng Việt')`를 `id` 뒤에 추가.
6. 업스트림의 컷별 선택(per-cut picks)과 우리/포크 컷 관련 UI가 같은 자리를 두고 충돌하면 **둘 다 남긴다**(통합은 Task 7).
7. `ae/`: 우리 한국어 `ae/90_ui.jsx` 기준 + 업스트림의 새 스위치·호러 분위기 UI. `ae/data.json`은 손으로 풀지 말고 병합 후 `node tools/export_ae_data.js`로 다시 만든다.

- [ ] **Step 1: 병합 시작**

```bash
cd /home/chynggi/JIZURA-KOR
git merge --no-ff --no-commit upstream/main
git checkout --theirs en/index.html zh-hant/index.html zh-hans/index.html id/index.html ko/index.html JIZURA_AE_en.jsx JIZURA_CEP_en.zip
git checkout --ours README.md index.html JIZURA_AE.jsx JIZURA_CEP.zip
git status --short | grep -E '^(UU|AA|DU|UD)'
```

- [ ] **Step 2: 소스 충돌 해결** — 규칙대로. 파일마다 `git diff 8bd7abc upstream/main -- <file>`(업스트림 변경)과 `git diff 8bd7abc HEAD -- <file>`(우리 변경)을 읽고 합친다. 확인:
```bash
grep -rn '^<<<<<<<\|^=======$\|^>>>>>>>' src app ae build.py .gitignore docs README.md || echo "no markers"
grep -o 'id="[^"]*"' app/body.html | sort | uniq -d     # 출력 없음
```

- [ ] **Step 3: 재생성과 테스트**
```bash
node tools/export_ae_data.js && python3 build_ae.py && python3 build_cep.py
python3 build.py && python3 tools/check_page_js.py index.html
```
그리고 「공통 테스트 명령」 전부. 스모크에 새 부품이 포함돼야 한다(`counts` 합계가 병합 전보다 약 153 증가). 페이지 오류 검사: 8766에서 index.html을 열어 `#modePro` 클릭 후 모든 `[data-tab]` 클릭, `pageerror` 없음(1차 Task 1 Step 4의 스크립트를 포트 8766으로).

- [ ] **Step 4: 커밋**
```bash
git add -A && git add -f dev/*.js dev/*.py 2>/dev/null; git status --short dev/
git commit -m "Merge upstream/main v0.9.0: 타이포·키네틱·호러 세트, 컷별 선택, 잠금 유지, 루프, 베트남어판, AE 새 세트

충돌은 한국어판 기준으로 해결. 새 일본어 문구는 후속 커밋에서 한국어화.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 업스트림 추가분 한국어화(웹 + AE)

**Files:**
- Modify: `src/11p_typo1..3.js`, `src/11p_kinetic1..3.js`, `src/11p_horror1..3.js`, 업스트림이 바꾼 `src/*.js`·`app/body.html`의 새 문구, `ae/90_ui.jsx` 등 AE 새 문구
- Modify: `tools/check_fork_ko.sh`
- Regenerate: `index.html`, `JIZURA_AE.jsx`, `JIZURA_CEP.zip`, `ae/data.json`

**Interfaces:**
- Produces: `tools/check_fork_ko.sh [BASE]` — BASE 기본값 `main`. 가나 검사 + 한자 검사(한글·가나가 없는 추가 줄 중 CJK 한자 `[\x{4E00}-\x{9FFF}]`를 포함하고 따옴표 문자열 안에 있는 것).

- [ ] **Step 1: 검사 스크립트 보강(RED)**

`tools/check_fork_ko.sh`를 아래로 바꾼다(기존 허용 목록 줄이 있으면 유지해 합친다):
```sh
#!/bin/sh
# 병합으로 들어온 줄 중 한국어로 옮기지 않은 UI 문구를 찾는다. usage: tools/check_fork_ko.sh [BASE=main]
cd "$(dirname "$0")/.."
BASE="${1:-main}"
added() { git diff "$BASE" -- src app/body.html ae ':!ae/data.json' | grep '^+' | grep -v '^+++' | grep -vP '^\+\s*(//|/\*|\*)'; }
# 1) 가나
added | grep -P '[\x{3040}-\x{30FF}]' | grep -vP 'Noto (Sans|Serif) JP|font-family|family:' || true
# 2) 한자만(한글·가나 없음) 들어간 따옴표 문자열
added | grep -vP '[\x{AC00}-\x{D7A3}\x{3040}-\x{30FF}]' | grep -P "['\"\`][^'\"\`]*[\x{4E00}-\x{9FFF}][^'\"\`]*['\"\`]" | grep -vP 'Noto|字面|family' || true
```
```bash
tools/check_fork_ko.sh 0578b12 | wc -l     # 0보다 큼(번역 전)
```

- [ ] **Step 2: 번역**

- 부품 파일: 기존 `src/11p_*.js`의 번역 관례를 따른다 — `name`, `desc`, `tags`(표시되는 것) 값만 한국어, 키·코드 식별자 유지. 예시는 `git diff 24c0fd8 main -- src/11p_enter.js | head -80`로 기존 번역 방식을 확인한다.
- 새 스타일·분위기(호러 등) 이름과 설명, 세트 스위치 라벨(타이포/키네틱/호러), 루프 버튼(행 루프·컷 루프), 컷별 선택 패널 문구, 잠금 관련 문구.
- 용어: 타이포그래피 세트 → 「타이포」, 키네틱 → 「키네틱」, 호러 → 「호러」, 行ループ → 「행 반복」, カットループ → 「컷 반복」, このカットだけシャッフル → 「이 컷만 섞기」, おまかせ → 「자동으로 만들기」(기존 용어), ロック → 「잠금」.
- AE: `ae/*.jsx`의 새 문구를 같은 방식으로.
- 문장 톤은 기존 우리 문구(~합니다/~하세요)에 맞춘다.

- [ ] **Step 3: 검사·재생성·테스트**
```bash
tools/check_fork_ko.sh 0578b12        # 출력 없음(가사 판별 데이터 등 정당한 줄은 스크립트에 주석과 함께 제외 패턴 추가)
node tools/export_ae_data.js && python3 build_ae.py && python3 build_cep.py && node dev/ae_test.js | tail -3
python3 build.py && python3 tools/check_page_js.py index.html
```
그리고 스모크(공통 명령).

- [ ] **Step 4: 커밋**
```bash
git add -A && git commit -m "업스트림 v0.9.0 추가분 한국어화(새 부품·스타일·호러 분위기·컷별 선택·AE)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 포크 8c0be6a 병합(동작하는 상태)

**Files:**
- Modify(충돌 예상): `app/body.html`, `app/style.css`, `src/02_fonts.js`, `src/06_layouts.js`, `src/08_planner.js`, `src/08b_omakase.js`, `src/08d_media.js`, `src/09_render.js`, `src/11_export.js`, `src/12_ui.js`, `README*.md`, `build.py`
- Create(포크에서): `src/08e_lyric_features.js`, `src/08e_media_effects.js`, `src/08f_media_variations.js`, `src/08g_media_phases.js`, `src/08g_media_rhythm.js`, `src/08h_cut_details.js`, `src/11b_project_file.js`, `src/11r_themes.js`, `docs/media-effects.md`, `preview_server.py`, `dev/project_file_test.cjs`, `dev/themes_test.cjs` 및 포크의 기타 새 dev 테스트
- Keep deleted/ours: 포크가 지운 `src/08c_jev.js`·`jev_server.py`·Jev 가이드 — 우리는 이미 `08c_jev.js`를 「AI로 고르기」로 바꿨으므로 **우리 `src/08c_jev.js` 유지**(삭제 충돌은 ours). `jev_server.py`·`docs/JEV_GUIDE*`는 우리도 지웠으므로 삭제 유지.

**Interfaces:**
- Produces: 포크 새 API가 동작 — `J.mediaLabel(ja, en)`(Task 4에서 제거 예정), `J.THEMES`(테마 12종), `J.packProject(project, audioFile) → Blob`, `J.unpackProject(file) → {project, files...}`(정확한 반환은 `src/11b_project_file.js` 확인), `J.MEDIA_TECH`, 컷 상세 편집기. 포크 새 일본어 문구는 Task 4에서 번역.

충돌 해결 규칙:
1. 어느 쪽 기능도 지우지 않는다. 우리 쪽: Task 1·2까지 전부 + 「AI로 고르기」(`btnAiPick`, `btnAiPickBig`, `aiPrompt`, `08c_jev.js`, `decision_server.py`). 포크가 Jev 버튼 자리를 테마 UI로 바꿨으면 **테마 UI와 AI 버튼을 나란히** 둔다.
2. 사이트 이름·제목(「JIZURA ONE STOP EDITION」, 「字面一」, `<title>`, 브랜드 태그)과 hirazisora.github.io 링크 변경은 받지 않는다. 포크의 `preview_server.py`는 받되 기본 포트가 8765면 **8766**으로 바꾸거나 README에 결정 서버와 겹친다고 적는다(결정 서버가 앱도 제공하므로 둘 중 하나만 쓰게 안내).
3. 포크의 프로젝트 파일 저장·열기 UI(`#fileProject accept=".jizuraichi"`, 저장 메뉴)는 코드째 들여오되, 우리 「곡·소재 포함 저장」 메뉴 항목과 겹치면 둘 다 남긴다(통일은 Task 6).
4. 업스트림 컷별 선택(Task 1), 포크 컷 상세 편집기, 우리 후보 6개가 같은 자리에서 충돌하면 셋 다 남긴다(통합은 Task 7).
5. `src/09_render.js`: 1차 레이어 순서(배경 컷 → 소재 뒤 → 가사 → 소재 앞 → 전경 컷, frontmost는 noAssets, 레이어 PNG 규칙, 빈 컷에서도 소재)를 유지하면서 포크의 미디어 효과·단계·리듬 그리기를 합친다.
6. `README*.md`: 우리 것 유지.

- [ ] **Step 1: 병합 시작**
```bash
git merge --no-ff --no-commit hirazisora/main
git checkout --ours README.md README.en.md index.html
git status --short | grep -E '^(UU|AA|DU|UD)'
```
`src/08c_jev.js`가 `DU`/`UD`면 `git checkout --ours src/08c_jev.js && git add src/08c_jev.js`.

- [ ] **Step 2: 충돌 해결** — 규칙대로. `git diff a25532f hirazisora/main -- <file>`(포크 변경)과 `git diff a25532f HEAD -- <file>`(우리+업스트림)을 읽고 합친다. 마커·id 중복 검사는 Task 1 Step 2와 같다.

- [ ] **Step 3: 테스트** — 「공통 테스트 명령」 전부 + 페이지 오류 검사(8766). `dev/.venv/bin/python dev/absorb_ui_test.py`가 깨지면 병합 로직을 먼저 의심한다(1차 기능 회귀). 포크 새 Node 테스트 중 `vm`만 쓰는 것은 `node dev/<file>`로 돌리고, Playwright/Edge를 쓰는 `.cjs`는 이 태스크에서는 돌리지 않는다(Task 8에서 이식).

- [ ] **Step 4: 커밋**
```bash
git add -A && git add -f dev/*.cjs dev/*.js 2>/dev/null; git status --short dev/
git commit -m "Merge hirazisora/main 8c0be6a: 미디어 효과·단계·BPM 리듬, 레이어 가사 그룹, 컷 상세 편집기, 테마 프리셋, 휴대용 프로젝트 파일

사이트 이름 변경은 받지 않고, 「AI로 고르기」는 유지. 새 일본어 문구는 후속 커밋에서 한국어화.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 포크 추가분 한국어화

**Files:**
- Modify: `src/08e_*.js`, `src/08f_*.js`, `src/08g_*.js`, `src/08h_cut_details.js`, `src/11b_project_file.js`, `src/11r_themes.js`, `src/08d_media.js`, `src/12_ui.js`, `app/body.html`, `docs/media-effects.md`
- Regenerate: `index.html`

**Interfaces:**
- Produces: `J.mediaLabel` 호출이 모두 한국어 문자열 리터럴로 바뀌고, 더 이상 쓰이지 않으면 `J.mediaLabel` 정의도 삭제. 테마 이름: pop 「팝」, ballad 「발라드」, rock 「록」, dance 「댄스·EDM」, hiphop 「힙합」, jazz 「재즈」, acoustic 「어쿠스틱」, cool 「쿨」, cute 「귀여움」, elegant 「우아함」, dreamy 「몽환」, retro 「레트로」. 테마 분류 genre 「장르」, taste 「취향」.

- [ ] **Step 1: 실패 확인**
```bash
tools/check_fork_ko.sh 80159a2 | wc -l          # 0보다 큼
grep -rn "J.mediaLabel(" src | wc -l            # 0보다 큼
```
(80159a2 = 2차 설계 커밋. Task 1·2가 그 뒤에 있으므로 그 번역분은 이미 한국어라 걸리지 않는다.)

- [ ] **Step 2: 번역** — `J.mediaLabel('日本語','English')` → `'한국어'`. 1차 용어표(전경/배경/가사, 행과 컷, 이 컷에만 적용 등)와 Task 2 용어를 따른다. 미디어 효과 이름은 포크 영어 이름을 참고해 짧은 한국어로(예: pushIn 「밀어 들어가기」, pullOut 「빠져나오기」, drift 「표류」, panorama 「파노라마」, rackFocus 「초점 이동」, beatPulse 「박자 맥동」, beatBounce 「박자 튀기」, chromaticSplit 「색수차 분리」, glitch 「글리치」). `docs/media-effects.md`는 한국어로 옮긴다.

- [ ] **Step 3: 검사·빌드·테스트**
```bash
tools/check_fork_ko.sh 80159a2       # 출력 없음
grep -rn "mediaLabel" src || echo "mediaLabel gone"
python3 build.py && python3 tools/check_page_js.py index.html
node dev/media_test.js && node dev/lyric_test.js && node dev/decide_test.js && echo UNIT OK
dev/.venv/bin/python dev/absorb_ui_test.py
```
테스트가 일본어 라벨을 단언하면 기대값을 한국어로 바꾼다.

- [ ] **Step 4: 커밋**
```bash
git add -A && git commit -m "포크 8c0be6a 추가분 한국어화(미디어 효과·테마·컷 상세·프로젝트 파일)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 1차 잔여 — 행 시작 변경을 실행 취소 1단계로

**Files:**
- Modify: `src/12_ui.js` (`draftFromSong`, 행 목록 시각 입력란 change 핸들러, `tapNow`의 single 경로/`stopTap`, `followLineStarts`, `recordUndoState`)
- Test: `dev/absorb_ui_test.py`

**Interfaces:**
- Consumes: `lineShiftBase()`, `followLineStarts(base)`, `recordUndoState(force)`, `replan()`, `U`(실행 취소 스택), `J.uiApi`.
- Produces: 세 경로 모두 실행 취소 스택에 **정확히 1개** 항목을 추가.

- [ ] **Step 1: 실패하는 테스트 추가** — `dev/absorb_ui_test.py`에:
```python
async def test_line_start_change_is_one_undo_step(b, url):
    pg, errs = await open_app(b, url)
    r = await pg.evaluate('''async () => {
      const P = () => J.ui.project;
      document.querySelector('#modePro') && document.querySelector('#modePro').click();
      const ta = document.querySelector('#lyrics');
      ta.value = '하나\\n둘\\n셋'; ta.dispatchEvent(new Event('input', { bubbles: true }));
      J.uiApi.flushSave(); await new Promise(r => setTimeout(r, 300));
      P().timing.lineTimes = { 0: 2, 1: 6, 2: 10 }; P().timing.cutTimes = Object.assign({}, P().timing.cutTimes, { '0:1': 4 });
      J.uiApi.flushSave(); ta.blur();
      const before = JSON.stringify({ lt: P().timing.lineTimes, ct: P().timing.cutTimes });
      // 행 목록 시각 입력란 경로: 0행 시작 2 → 8
      J.uiApi.setLineStart(0, 8);
      await new Promise(r => setTimeout(r, 300));
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', key: 'z', ctrlKey: true, bubbles: true }));
      await new Promise(r => setTimeout(r, 300));
      return { before, after: JSON.stringify({ lt: P().timing.lineTimes, ct: P().timing.cutTimes }) };
    }''')
    assert r['after'] == r['before'], r
    assert not errs, errs
    await pg.close()
```
`J.uiApi.setLineStart(i, t)`: 행 목록 시각 입력란의 change 핸들러 본문을 함수로 뽑아 노출한다(입력란 핸들러는 이 함수를 호출). 곡에서 초안·한 행 탭도 같은 방식으로 한 번씩 확인하는 단언을 이 테스트에 추가한다(곡에서 초안은 `J.draftLineStarts`를 스텁으로 바꿔 고정 시각 배열을 돌려주게 하고, 곡이 필요하면 `J.ui.audio`에 가짜 객체를 넣는다; 한 행 탭은 `startTap(0, true)` 경로를 `J.uiApi.startTap`으로 노출해 `tapNow`를 한 번 호출).
`TESTS`에 추가.

- [ ] **Step 2: 실패 확인**
```bash
python3 build.py && dev/.venv/bin/python dev/absorb_ui_test.py
```
Expected: `after != before`(중간 상태로 돌아감) 또는 `J.uiApi.setLineStart` 없음으로 FAIL.

- [ ] **Step 3: 구현** — 세 경로에서 행 시작을 바꾸는 첫 `replan()`이 실행 취소를 기록하지 않게 한다. 방법: `U.hold` 플래그를 두고 `recordUndoState`가 `U.hold`면 반환(`S.tap`/`TL.drag` 가드와 같은 위치). 각 경로:
```js
U.hold = true;
try { /* 행 시작 변경 */ replan(); followLineStarts(base); }
finally { U.hold = false; }
flushSave();              // 여기서 1단계만 기록
```
`followLineStarts` 안의 `replan()`도 hold 중이므로 기록되지 않는다.

- [ ] **Step 4: 통과 확인** — `dev/.venv/bin/python dev/absorb_ui_test.py` → `ABSORB UI OK`, `python3 tools/check_page_js.py index.html`.

- [ ] **Step 5: 커밋**
```bash
git add -A && git add -f dev/absorb_ui_test.py && git commit -m "행 시작 변경(곡에서 초안·시각 입력·한 행 탭)을 실행 취소 1단계로

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 포함 저장을 바이너리 `.jizura`로 통일

**Files:**
- Modify: `src/11b_project_file.js`, `src/12_ui.js`(`saveBundle`→바이너리, `openProject`/파일 열기), `app/body.html`(메뉴·`accept`)
- Test: `dev/absorb_ui_test.py`

**Interfaces:**
- Consumes: 포크 `J.packProject(project, audioFile) → Blob`, `J.unpackProject(file)`; 우리 `J.idbGet/J.idbPut`(`asset:<id>`, `mask:<id>` 레코드 `{name, type, data: ArrayBuffer}`), `J.storeMedia/J.loadMedia`, `openProject(p)`(v1·v2 JSON 번들 읽기 포함).
- Produces: 바이너리 목록 `entries[].kind` ∈ `media`, `audio`, `font`, **`asset`**, **`mask`**. `J.uiApi.saveBundle()`은 바이너리 Blob을 `J.saveFile(baseName() + '.jizura', blob)`로 저장. 파일 열기는 매직 `JIZURA01`이면 바이너리, 아니면 JSON(일반 프로젝트·번들 v1/v2).

- [ ] **Step 1: 실패하는 테스트** — `dev/absorb_ui_test.py`의 `test_bundle_roundtrip`을 바이너리 기준으로 바꾸고 소재·마스크를 추가:
```python
async def test_binary_bundle_roundtrip(b, url):
    pg, errs = await open_app(b, url)
    r = await pg.evaluate('''async (png) => {
      const bytes = Uint8Array.from(atob(png), c => c.charCodeAt(0));
      const file = new File([bytes], 'bg.png', { type: 'image/png' });
      const item = { id: 'bgtest', name: 'bg.png', type: 'image', size: file.size };
      await J.storeMedia(item.id, file); J.ui.project.media.items.push(item);
      const a = await J.assetAdd(new File([bytes], 's.png', { type: 'image/png' }));
      J.ui.project.assets.push(a);
      await J.idbPut('mask:' + a.id, { name: 'm.png', type: 'image/png', data: bytes.buffer.slice(0) });
      let saved = null, savedName = ''; const orig = J.saveFile;
      J.saveFile = async (name, data) => { saved = data; savedName = name; };
      try { await J.uiApi.saveBundle(); } finally { J.saveFile = orig; }
      const head = new TextDecoder().decode(new Uint8Array(await saved.slice(0, 8).arrayBuffer()));
      await J.removeMedia(item.id); await J.idbDel('asset:' + a.id); await J.idbDel('mask:' + a.id);
      await J.uiApi.openFile(new File([saved], savedName));
      const m = await J.loadMedia('bgtest'), s = await J.idbGet('asset:' + a.id), k = await J.idbGet('mask:' + a.id);
      return { head, savedName, isBlob: saved instanceof Blob, media: m && m.size, asset: !!s, mask: !!k,
               items: J.ui.project.media.items.length, assets: J.ui.project.assets.length };
    }''', base64.b64encode(PNG).decode())
    assert r['head'] == 'JIZURA01' and r['isBlob'] and r['savedName'].endswith('.jizura'), r
    assert r['media'] == len(PNG) and r['asset'] and r['mask'], r
    assert r['items'] == 1 and r['assets'] == 1, r
    # 구형 JSON 번들 v2도 열린다
    legacy = await pg.evaluate('''async () => {
      const p = JSON.parse(JSON.stringify(J.ui.project)); p.bundle = { version: 2, files: {}, mediaFiles: {} };
      await J.uiApi.openFile(new File([JSON.stringify(p)], 'old_all.jizura.json', { type: 'application/json' }));
      return Array.isArray(J.ui.project.media.items) && !('bundle' in J.ui.project);
    }''')
    assert legacy
    assert await pg.evaluate("document.querySelector('#fileProject').getAttribute('accept')") == '.jizura,.jizuraichi,.json'
    assert not errs, errs
    await pg.close()
```
`test_bundle_roundtrip`(1차, JSON 저장 기준)은 삭제하고 이것으로 대체. `J.uiApi.openFile(file)`: 프로젝트 파일 입력(`#fileProject`)의 change 핸들러 본문을 함수로 뽑아 노출.

- [ ] **Step 2: 실패 확인** — `python3 build.py && dev/.venv/bin/python dev/absorb_ui_test.py` → FAIL(`head != JIZURA01` 또는 `openFile` 없음).

- [ ] **Step 3: 구현**
- `src/11b_project_file.js` `J.packProject`: `project.assets`마다 `J.idbGet('asset:'+id)`, `J.idbGet('mask:'+id)` 레코드가 있으면 `add('asset', id, new Blob([r.data], {type: r.type}), r.name)` / `add('mask', id, …)`. 곡은 포크 방식(`audioAsset`) 또는 우리 `J.loadSong()`(이름이 `project.audioName`과 같을 때) 중 실제 이 브랜치에 있는 경로를 쓴다.
- `J.unpackProject`: `asset`/`mask` 항목을 `J.idbPut(kind + ':' + id, { name, type, data: await blob.arrayBuffer() })`로 복원.
- `saveBundle`: base64 JSON 경로 삭제, `J.packProject`로 Blob을 만들어 `.jizura`로 저장. 완료 토스트는 기존 형식 유지(크기 MB, 곡 포함 여부, 소재 N개, 배경·전경 N개).
- 파일 열기: 앞 8바이트가 `JIZURA01`이면 `J.unpackProject` → 프로젝트 적용(포크 경로) 후 우리 `openProject`의 후처리(소재 정리 대기열, `prepareAssets`, 미디어 준비)를 거친다. 아니면 텍스트로 읽어 `openProject(JSON.parse(text))`(v1·v2 번들 포함).
- `#fileProject`의 `accept=".jizura,.jizuraichi,.json"`. 저장 메뉴 이름은 「곡·소재 포함 저장(.jizura)」, 포크의 별도 휴대용 저장 메뉴 항목이 있으면 이것으로 합친다(메뉴 하나).
- `J.saveFile(name, data)`가 Blob을 받는지 확인하고, 문자열만 받으면 Blob도 받게 고친다.

- [ ] **Step 4: 통과 확인** — `ABSORB UI OK`, `JS OK`.

- [ ] **Step 5: 커밋**
```bash
git add -A && git add -f dev/absorb_ui_test.py && git commit -m "곡·소재 포함 저장을 바이너리 .jizura로 통일(소재·마스크 포함, 구형 JSON 번들·.jizuraichi 열기)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 컷 편집 UI를 한 패널로 통합

**Files:**
- Modify: `src/12_ui.js`, `app/body.html`, `app/style.css`, `src/08h_cut_details.js`(필요 시)
- Test: `dev/absorb_ui_test.py`

**Interfaces:**
- Consumes: 업스트림 컷별 선택 패널(Task 1; 컷 정보 행·재생 추적), 포크 컷 상세 편집기(`08h_cut_details.js`), 우리 후보 6개·우타하메 UI(행 목록 안).
- Produces: 컷 하나를 편집하는 UI가 **한 패널**(업스트림 컷 정보 패널을 바탕, id는 업스트림 것 유지)에 세 기능 절로 모인다: ① 레이아웃·수법 교체와 「이 컷만 섞기/자동」(업스트림), ② 레이어 상세(가사·미디어 블렌딩·불투명도 등, 포크), ③ 이 행의 후보 6개·우타하메(우리; 가사 컷일 때만). 같은 동작(예: 레이아웃 선택)이 두 곳이면 하나만 남긴다.

- [ ] **Step 1: 현황 조사와 배치 결정** — 병합된 앱을 8766에서 열어 컷 하나를 선택했을 때 세 UI가 어디에 뜨는지 스크린샷(`dev/www/cutpanel_before.png`)을 찍고 Read 도구로 본다. 중복 동작 목록을 보고서에 적고, 남길 쪽을 정한다(기준: 업스트림 컷 패널에 있는 컨트롤을 남기고, 포크·우리 쪽 중복 컨트롤은 제거; 데이터 필드는 건드리지 않음).

- [ ] **Step 2: 실패하는 테스트** — `dev/absorb_ui_test.py`에:
```python
async def test_cut_panel_unified(b, url):
    pg, errs = await open_app(b, url)
    await pg.click('#modePro')
    await pg.fill('#lyrics', '하나\n둘\n셋'); await pg.wait_for_function("J.ui.plan && J.ui.plan.cuts.length >= 3")
    await pg.evaluate("J.uiApi.selectCut(1)")
    panel = pg.locator(await pg.evaluate("J.uiApi.cutPanelSelector"))
    assert await panel.count() == 1
    # 세 절이 모두 같은 패널 안에 있다
    for sel in await pg.evaluate("J.uiApi.cutPanelSections"):
        assert await panel.locator(sel).count() >= 1, sel
    # 레이아웃 선택 컨트롤은 화면 전체에서 이 컷에 대해 하나
    assert await pg.locator('[data-cut-layout]').count() == 1
    assert not errs, errs
    await pg.close()
```
`J.uiApi.selectCut(i)`(컷 선택 = 패널 열기), `J.uiApi.cutPanelSelector`(패널 CSS 선택자 문자열), `J.uiApi.cutPanelSections`(세 절의 선택자 배열), 레이아웃 선택 컨트롤에 `data-cut-layout` 속성을 추가한다. `TESTS`에 추가. 기능 회귀 확인도 추가: 패널의 후보 버튼 하나를 눌러 그 행 override에 후보 필드가 생기고 `area`가 남는지, 「이 컷만 섞기」를 눌러 그 컷만 바뀌는지.

- [ ] **Step 3: 실패 확인 → 구현 → 통과 확인** — 결정한 배치대로 옮긴다. 로직 함수는 옮기지 말고 DOM 배치·이벤트 연결만 바꾼다. `dev/www/cutpanel_after.png` 스크린샷을 찍어 Read로 확인하고 보고서에 적는다.

- [ ] **Step 4: 커밋**
```bash
git add -A && git add -f dev/absorb_ui_test.py && git commit -m "컷 편집을 한 패널로: 컷별 선택·레이어 상세·행 후보 6개

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: 테마와 AI로 고르기 공존, 포크 테스트 이식

**Files:**
- Modify: `app/body.html`, `src/12_ui.js`(테마 UI와 AI 버튼 배치), `src/08c_jev.js`(호러 분위기·세트 스위치 반영 확인만)
- Modify: `dev/absorb_ui_test.py`
- Delete: 포크의 Playwright/Edge 전제 `.cjs` 테스트(`dev/project_file_test.cjs`, `dev/themes_test.cjs`, 기타 Task 3에서 들어온 것)

**Interfaces:**
- Consumes: `J.THEMES`, `project.themes`(포크), `J.decideSuggest`, `J.randomOk`.

- [ ] **Step 1: 포크 테스트 이식** — `git show hirazisora/main:dev/themes_test.cjs`, `dev/project_file_test.cjs`(및 Task 3에서 들어온 다른 `.cjs`)의 단언을 `test_themes(b, url)`, `test_project_file(b, url)` 등으로 옮긴다. 1차 Task 8과 같은 규칙: `en/` 루프 제외, 일본어 단언은 한국어로, 받지 않은 것(사이트 제목 「字面一 JIZURA ONE STOP EDITION」, `accept='.jizuraichi'`, Jev 버튼 0개·`/api/jev` 501)은 우리 기준으로 바꾼다 — 제목은 우리 `<title>`, accept는 `.jizura,.jizuraichi,.json`, AI 버튼(`#btnAiPick`)은 **1개 있음**. 테마 테스트의 핵심 단언(모든 테마의 styles·media 키가 존재, 테마 적용 후 잠긴 행 유지, 24개 시드에서 오류 없음)은 그대로 둔다. `.cjs` 파일은 `git rm`.

- [ ] **Step 2: AI로 고르기 확인 단언 추가** — `test_ai_pick_end_to_end`에서 가짜 백엔드가 받은 요청의 `mood` 선택지에 호러 분위기 키가 있는지(업스트림 호러 분위기 키 이름은 `src/08b_omakase.js`의 `J.MOODS`에서 확인), 세트 스위치를 끄면 그 세트의 레이아웃 키가 선택지에서 빠지는지 단언.

- [ ] **Step 3: 배치** — 테마 선택 UI와 「AI로 고르기(β)」 버튼·추가 지시 입력이 한 영역에 나란히 보이게 한다(일반·간편 모드 모두). 스크린샷으로 확인.

- [ ] **Step 4: 실행**
```bash
python3 build.py && python3 tools/check_page_js.py index.html && dev/.venv/bin/python dev/absorb_ui_test.py
git ls-files dev | grep -c '\.cjs$'      # 0
```

- [ ] **Step 5: 커밋**
```bash
git add -A && git add -f dev/absorb_ui_test.py && git commit -m "테마 프리셋과 AI로 고르기 나란히, 포크 테스트를 Python Playwright로 이식

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: 문서와 최종 검증

**Files:**
- Modify: `README.md`, `docs/LOCAL_SETUP.md`, `docs/DECISION_GUIDE.md`(호러·세트 스위치 한 줄), `docs/EXPRESSION_PACKS.md`(Task 1에서 안 됐으면)

- [ ] **Step 1: 문서** — `README.md`에 추가·수정:
  - 업스트림 v0.9.0 새 기능 절(타이포·키네틱·호러 세트와 스위치, 호러 분위기, 컷별 선택·이 컷만 섞기, 잠금 유지, 행·컷 반복, 베트남어판) — 부품 수·스타일 수 문장을 실제 수로 갱신(`J.REGISTRY` 합계와 `J.STYLE_ORDER.length`를 페이지에서 읽어 확인).
  - 포크 새 기능 절(미디어 효과·단계·BPM 리듬, 레이어 가사 그룹·줄 안 줄바꿈·자동 표시 영역, 컷 상세, 테마 프리셋, 빈 프로젝트, 파일 이름 지정).
  - 「곡·소재 포함 저장」: `.jizura` 바이너리 한 파일에 곡·소재·피사체 마스크·배경·전경·사용자 글꼴이 들어가며, 예전 `_all.jizura.json`과 포크 `.jizuraichi`도 열린다.
  - 컷 편집 패널 설명.
  - `docs/LOCAL_SETUP.md`: 스모크를 8765가 아닌 포트로 돌리는 방법(결정 서버와 겹침) 한 줄, `preview_server.py` 안내(포트).
- [ ] **Step 2: 전체 회귀** — 「공통 테스트 명령」 전부 + `tools/check_fork_ko.sh main`(출력 없음) + `git status --short`(깨끗).
- [ ] **Step 3: 스크린샷 확인** — 1차 Task 8 Step 3처럼 배경·소재·가사·전경 겹침 1장, 컷 패널 1장을 `dev/www/`에 저장하고 Read로 확인. headless MP4 1초 내보내기 재확인.
- [ ] **Step 4: 커밋**
```bash
git add -A && git commit -m "문서: 2차 흡수 기능 안내, .jizura 포함 저장, 최종 빌드

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
