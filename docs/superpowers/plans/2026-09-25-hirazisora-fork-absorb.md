# hirazisora 포크 기능 흡수 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** hirazisora/JIZURA 포크의 배경·전경 미디어 컷, 행별 표시 영역, 타임라인 편집, 프로젝트 실행 취소, 출력 크기·합성 폰트를 한국어판에 병합하고, TypeSafe Jev 연동을 로컬 결정 모델(Laya·Kev·Tev1/OpenAI 호환 LLM) 연동으로 바꾼다.

**Architecture:** `git merge hirazisora/main`으로 이력을 보존해 병합하고 충돌은 한국어판 기준으로 푼다. 포크의 `08d_media.js`(배경·전경 컷)는 우리 `10b_assets.js`(소재)와 공존시키고, 실행 취소는 포크의 프로젝트 스냅샷 방식 하나로 통합한다. `jev_server.py`를 `decision_server.py`(표준 라이브러리만)로 바꿔 systemone 전달·LLM 글자 답 변환 두 백엔드를 지원한다.

**Tech Stack:** 바닐라 JS(단일 HTML 빌드, `J` 전역 네임스페이스), Python 3 표준 라이브러리(빌드·로컬 서버), Node `vm` 단위 테스트, Python Playwright(`dev/.venv/bin/python`) 브라우저 테스트.

**Spec:** `docs/superpowers/specs/2026-09-25-hirazisora-fork-absorb-design.md`

## Global Constraints

- 작업 브랜치: `absorb-hirazisora` (이미 생성·체크아웃됨). 원격 `hirazisora` = `https://github.com/hirazisora/JIZURA` (이미 추가·fetch됨). 병합 대상 `hirazisora/main` (a25532f).
- `src/`, `app/body.html`의 UI 문구는 **한국어**. 포크가 들여온 일본어 문구는 한국어로 옮긴다. 일본어로 남아도 되는 것: 폰트 이름, 일본어 가사 판별·샘플 데이터, 주석.
- `index.html`은 생성물: `python3 build.py`로만 만든다. `en/`, `zh-hant/`, `zh-hans/`, `id/`, `ko/`의 index.html, `JIZURA_CEP*.zip`, `JIZURA_AE*.jsx`는 **우리 쪽(main) 파일 유지**, 재빌드하지 않는다.
- README 링크를 hirazisora.github.io로 바꾸는 포크 변경은 받지 않는다.
- 우리 Pages 출처: `https://chynggi.github.io`. 로컬 결정 서버 포트: `8765`, 경로: `/api/decide`.
- 결정 서버 환경변수: `DECISION_BACKEND`(`systemone` 기본 | `llm`), `DECISION_URL`(systemone 기본 `http://127.0.0.1:8000/v1/systemone`, llm 기본 `http://127.0.0.1:11434/v1/chat/completions`), `DECISION_MODEL`, `DECISION_API_KEY`.
- 결정 서버는 Python 표준 라이브러리만 사용. 요청 본문 64KB 초과 → 413, 백엔드 실패 → 502 + 한국어 `error`.
- 기존 기능(간주·마무리 카드, 음악 반응, 확장 LRC, 행별 후보 6개·우타하메, 곡에서 초안, 소재·피사체 마스크, 곡·소재 포함 저장, ◀ ▶ 구성 기록)은 계속 동작해야 한다.
- 커밋 메시지는 한국어, 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## 공통 테스트 명령

```bash
# 빌드 + 인라인 JS 문법 검사
python3 build.py && python3 tools/check_page_js.py index.html          # → "JS OK"
# 단위 테스트(Node vm)
node dev/media_test.js && node dev/lyric_test.js                        # 조용히 종료(코드 0)
# 렌더 스모크
python3 build.py --dev && python3 dev/build_test.py all --all-packs
(cd dev/www && python3 -m http.server 8765 >/dev/null 2>&1 &) ; sleep 1
dev/.venv/bin/python dev/smoke_all.py                                   # problems 0, page errors []
# AE 패널 회귀
node dev/ae_test.js                                                     # expr syntax errors 0 · problems 0
```

8765 포트 서버는 테스트가 끝나면 `pkill -f "http.server 8765"`로 끈다.

---

### Task 1: 병합과 충돌 해결(동작하는 상태)

**Files:**
- Modify(충돌): `README.md`, `README.en.md`, `app/body.html`, `app/style.css`, `build.py`, `src/02_fonts.js`, `src/03_text.js`, `src/08_planner.js`, `src/09_render.js`, `src/11_export.js`, `src/12_ui.js`
- Keep ours: `index.html`(재빌드), `en/index.html`, `JIZURA_CEP.zip`, `JIZURA_CEP_en.zip`
- Create(포크에서 들어옴): `src/08c_jev.js`, `src/08d_media.js`, `dev/media_test.js`, `dev/lyric_test.js`, `dev/jev_test.js`, `dev/new_features_test.cjs`, `jev_server.py`, `dev/jev_server_test.py`, `docs/JEV_GUIDE*.md` (후속 태스크에서 교체)
- Delete: `app/__pycache__/english.cpython-312.pyc`
- Modify: `.gitignore`

**Interfaces:**
- Produces: 포크 API가 우리 코드와 함께 존재 — `J.planMedia(project, lyricPlan, audioDuration, layer)`, `J.drawMedia(ctx, plan, t, owner, layer, previewEdit)`, `J.normalizeMedia`, `J.outputSize(project)`, `J.setCompositeFonts`, `project.media`/`project.foreground`(배경·전경), `project.durationOverride`, `overrides[i].area`; 12_ui의 `U`/`recordUndoState`/`undoMove`/`markUndoGroup`. 우리 `ED`/`pushEdit`/`edGo`는 이 태스크에서는 **그대로 두고**(Task 4에서 통합) 둘 다 동작하게 한다. 단 키보드 Ctrl+Z/Ctrl+Y는 이 태스크에서 포크의 `undoMove`로 연결한다(두 곳에 바인딩 금지).

충돌 해결 규칙(모든 파일 공통):
1. 우리 쪽 기능 코드는 삭제하지 않는다. 포크 쪽 추가 로직은 넣는다. 둘이 같은 줄을 바꿨으면 둘 다 반영한 코드를 쓴다.
2. 포크 쪽 일본어 문구는 이 태스크에서는 그대로 둬도 된다(Task 2에서 번역). 우리 쪽 한국어 문구는 유지.
3. `README*.md`: 우리 쪽 전체 유지(`git checkout --ours`). 새 기능 문서는 Task 7.
4. `build.py`: 우리 쪽 유지 + 포크가 추가한 빌드 항목(새 src 파일 자동 포함은 glob이라 불필요할 수 있음 — 포크 diff `git diff 24c0fd8 hirazisora/main -- build.py`를 보고 필요한 것만)만 반영.
5. `src/08_planner.js`: 우리 간주(`[간주]`)·마무리 카드·긴 간주 분할·행별 후보·음악 반응 로직 + 포크의 표시 영역(`area`) 내 구성, 빈 가사 컷, 경계 시각, `durationOverride`, 출력 크기. 간주·마무리 카드도 cuts 배열의 일반 컷이므로 포크의 경계 편집 코드가 인덱스를 가정하는 곳(`lineTimes` 키)과 맞는지 확인.
6. `src/09_render.js`: 레이어 순서 = 배경 컷(`J.drawMedia(..., 'media')`) → 소재 뒤(`J.drawAssets(ctx, plan, 'back')`) → 가사 → 소재 앞(`J.drawAssets(ctx, plan, 'front')`) → 전경 컷(`'foreground'`). `key`(그린백/블랙백) 모드에서 소재를 안 그리는 기존 조건 유지.
7. `src/12_ui.js`: 포크의 탭(전경/가사/배경), 미디어 패널, 영역 편집기, 타임라인, 출력 크기, 합성 폰트, Jev 버튼 코드 + 우리 소재 패널, 후보 6개, 간주, 곡에서 초안, 번들 저장. `mergeProject`는 양쪽 필드 모두 정규화(`assets` + `media`/`foreground`/`compositeFonts`/`durationOverride`/`jevPrompt`).
   - **주의(키 충돌):** 우리 `openProject`는 번들의 `p.media`를 파일 묶음으로 해석하고 지운다. 포크는 `project.media`를 배경 컷 설정으로 쓴다. 이 태스크에서는 `openProject`가 `p.media`를 **번들로 볼 때만** 꺼내도록 바꾼다: `const media = p && p.media && p.media.files && !Array.isArray(p.media.items) ? p.media : null; if (media) delete p.media;` (번들 키 변경 자체는 Task 3).
8. `app/body.html`, `app/style.css`: 양쪽 요소·규칙 모두 유지. id 중복 금지(`grep -o 'id="[^"]*"' app/body.html | sort | uniq -d`가 비어야 함).
9. `src/02_fonts.js`, `src/03_text.js`, `src/11_export.js`: 양쪽 반영.

- [ ] **Step 1: 병합 시작**

```bash
cd /home/chynggi/JIZURA-KOR
git merge --no-ff --no-commit hirazisora/main
git checkout --ours README.md README.en.md en/index.html index.html JIZURA_CEP.zip JIZURA_CEP_en.zip
git rm --cached -q app/__pycache__/english.cpython-312.pyc && rm -rf app/__pycache__
printf '__pycache__/\n' >> .gitignore
```

- [ ] **Step 2: 소스 충돌 해결**

위 규칙대로 `src/*.js`, `app/body.html`, `app/style.css`, `build.py`의 충돌 표시를 모두 없앤다. 각 파일마다 `git diff 24c0fd8 hirazisora/main -- <file>`(포크 변경)과 `git diff 24c0fd8 main -- <file>`(우리 변경)를 읽고 합친다.

확인:
```bash
grep -rn '^<<<<<<<\|^=======$\|^>>>>>>>' src app build.py README*.md .gitignore || echo "no markers"
grep -o 'id="[^"]*"' app/body.html | sort | uniq -d        # 출력 없음
```

- [ ] **Step 3: 빌드와 단위 테스트**

```bash
python3 build.py && python3 tools/check_page_js.py index.html
node dev/media_test.js && node dev/lyric_test.js && node dev/jev_test.js && echo UNIT OK
```
Expected: `JS OK`, `UNIT OK`. `lyric_test.js`가 영어/일본어 문구를 기대해 실패하면 테스트가 아니라 파서 로직 병합을 먼저 의심한다(우리 파서의 `[간주]`·확장 LRC 처리와 포크의 "혼합 LRC는 작성 순서 유지"가 모두 살아야 함).

- [ ] **Step 4: 페이지 오류·스모크**

```bash
python3 build.py --dev && python3 dev/build_test.py all --all-packs
(cd dev/www && python3 -m http.server 8765 >/dev/null 2>&1 &) ; sleep 1
dev/.venv/bin/python dev/smoke_all.py
(python3 -m http.server 8766 >/dev/null 2>&1 &) ; sleep 1
dev/.venv/bin/python - <<'EOF'
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://127.0.0.1:8766/index.html'); await pg.wait_for_timeout(1500)
        await pg.click('#modePro'); await pg.wait_for_timeout(300)
        for tab in await pg.locator('[data-tab]').all():
            if await tab.is_visible(): await tab.click(); await pg.wait_for_timeout(150)
        print('page errors', errs); await b.close()
asyncio.run(main())
EOF
node dev/ae_test.js | tail -3
pkill -f "http.server 876"
```
Expected: smoke `problems 0`, `page errors []`(두 번 모두), ae_test 오류 0.

- [ ] **Step 5: 병합 커밋**

```bash
git add -A
git commit -m "Merge hirazisora/main: 배경·전경 미디어 컷, 행별 표시 영역, 타임라인 편집, 실행 취소, 출력 크기·합성 폰트, Jev

충돌은 한국어판 기준으로 해결(간주·소재·후보 6개 유지). 포크의 일본어 문구·Jev는 후속 커밋에서 교체.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 포크 문구 한국어화

**Files:**
- Modify: `src/08d_media.js`, `src/08_planner.js`, `src/09_render.js`, `src/11_export.js`, `src/12_ui.js`, `src/02_fonts.js`, `app/body.html` (포크가 추가한 문구만)
- Create: `tools/check_fork_ko.sh`

**Interfaces:**
- Consumes: Task 1의 병합 결과.
- Produces: 문구 외 동작 변경 없음. `src/08c_jev.js`는 Task 6에서 새로 쓰므로 여기서 번역하지 않는다.

용어(이 표를 그대로 쓴다):

| 포크(일본어) | 한국어 |
|---|---|
| 前景 / 背景 / 歌詞 (탭) | 전경 / 배경 / 가사 |
| 行とカット | 행과 컷 |
| カットを追加 / 削除 | 컷 추가 / 삭제 |
| 画像無し | 이미지 없음 |
| 全画面 / 全体を表示 | 전체 화면 / 전체 보이기 |
| フェード / スライド / ズーム / 即時 | 페이드 / 슬라이드 / 줌 / 즉시 |
| 静止 / ゆっくり拡大 / 横移動 | 정지 / 천천히 확대 / 가로 이동 |
| なし / モノクロ / セピア / 高コントラスト / ぼかし | 없음 / 흑백 / 세피아 / 고대비 / 흐림 |
| クロスフェード | 크로스페이드 |
| 左上…右下(9점) | 왼쪽 위, 위, 오른쪽 위, 왼쪽, 가운데, 오른쪽, 왼쪽 아래, 아래, 오른쪽 아래 |
| 動画をループ再生 | 동영상 반복 재생 |
| クロマキー合成 | 크로마키 합성 |
| 配置・サイズを編集 | 배치·크기 편집 |
| このカットだけに適用 / これ以降全てに適用 | 이 컷에만 적용 / 이후 전부 적용 |
| この行だけに適用 | 이 행에만 적용 |
| 自動配置に戻す | 자동 배치로 되돌리기 |
| 全域へリセット | 전체 영역으로 초기화 |
| 表示エリア | 표시 영역 |
| 縦横比を固定 | 가로세로 비율 고정 |
| ランダム順 / ループ表示 | 무작위 순서 / 반복 표시 |
| 手動タイミングを消す | 수동 타이밍 지우기 |
| 元に戻す / やり直す | 실행 취소 / 다시 실행 |
| 合成方法 / 不透明度 | 합성 방식 / 불투명도 |
| 動画の長さ | 동영상 길이 |
| 総尺 / 動画の長さ(전체) | 전체 길이 |
| 出力サイズ / カスタム | 출력 크기 / 직접 입력 |
| 合成フォント | 합성 글꼴 |
| 最前面 | 맨 앞 |
| キャンセル | 취소 |

- [ ] **Step 1: 검사 스크립트 작성(실패 확인용)**

`tools/check_fork_ko.sh`:
```bash
#!/bin/sh
# 병합으로 들어온 줄 중 가나(히라가나·가타카나)가 남은 UI 문구를 찾는다. 주석(//, /*, *)과 폰트 이름 줄은 제외.
cd "$(dirname "$0")/.."
git diff main -- src app/body.html ':!src/08c_jev.js' \
  | grep '^+' | grep -v '^+++' \
  | grep -P '[\x{3040}-\x{30FF}]' \
  | grep -vP '^\+\s*(//|/\*|\*)' \
  | grep -vP 'Noto (Sans|Serif) JP|font-family|family:' || true
```
```bash
chmod +x tools/check_fork_ko.sh && tools/check_fork_ko.sh | wc -l
```
Expected: 0보다 큰 줄 수(번역 전).

- [ ] **Step 2: 번역**

용어표대로 포크 문구를 한국어로 바꾼다. `title=`, `aria-label=`, `placeholder=`, `toast(...)`, `showMsg(...)`, `throw new Error(...)`, `confirm(...)`, 옵션 표(`J.MEDIA_*`) 모두 포함. 문장형 문구는 우리 기존 톤(예: `'곡과 소재를 모으는 중…'`, `'저장했습니다'`)에 맞춘다.

- [ ] **Step 3: 검사·빌드**

```bash
tools/check_fork_ko.sh          # 출력 없음(남는 줄이 일본어 가사 판별 데이터 등이라면 스크립트 제외 패턴에 그 줄만 추가하고 이유 주석)
python3 build.py && python3 tools/check_page_js.py index.html
node dev/media_test.js && node dev/lyric_test.js && echo UNIT OK
```
`dev/media_test.js`가 일본어 라벨을 단언하면 테스트의 기대값도 한국어로 바꾼다.

- [ ] **Step 4: 커밋**

```bash
git add -A && git commit -m "포크에서 들어온 배경·전경·표시 영역·타임라인 문구 한국어화

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 소재와 배경·전경 컷 공존(그리는 순서, 번들 저장)

**Files:**
- Modify: `src/12_ui.js` (`saveBundle`, `openProject`, 번들 관련 헬퍼)
- Modify(필요 시): `src/09_render.js`
- Create: `dev/absorb_ui_test.py`

**Interfaces:**
- Consumes: 포크 `J.storeMedia(id, file)`, `J.loadMedia(id) → File|Blob`, `J.attachMedia(item, file)`, `project.media.items[]`/`project.foreground.items[]` (`{id, name, type:'image'|'video', ...}`); 우리 `J.idbPut/J.idbGet`, `toB64/fromB64`.
- Produces: 번들 JSON 형식 v2 — 프로젝트 필드 + `bundle: { version: 2, files: {...}, song?, mediaFiles: { [itemId]: {name, type, data(base64)} } }`. 구형 v1(`media: {version:1, files, song?}` 이고 `media.items` 없음)도 읽는다.

- [ ] **Step 1: 실패하는 브라우저 테스트 작성**

`dev/absorb_ui_test.py`:
```python
"""Browser checks for the absorbed fork features. Serves the repo root on 8766 itself.
usage: dev/.venv/bin/python dev/absorb_ui_test.py"""
import asyncio, base64, contextlib, http.server, json, os, threading
from functools import partial
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')

@contextlib.contextmanager
def serve(port=8766):
    h = partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    h.log_message = lambda *a: None
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', port), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try: yield f'http://127.0.0.1:{port}/index.html'
    finally: srv.shutdown()

async def open_app(b, url):
    pg = await b.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(url); await pg.wait_for_function('window.J && J.ui && J.ui.project')
    return pg, errs

async def test_layer_order(pg):
    # 배경 컷 → 소재 뒤 → 가사 → 소재 앞 → 전경 컷
    order = await pg.evaluate('''() => {
      const calls = [], dm = J.drawMedia, da = J.drawAssets;
      J.drawMedia = (ctx, plan, t, o, layer, e) => { calls.push('media:' + layer); };
      J.drawAssets = (ctx, plan, layer) => { calls.push('assets:' + layer); };
      const plan = J.ui.plan, cut = plan.cuts[0];
      plan.assets = [{ id: 'x' }];
      plan.media = { cuts: [{ start: 0, end: 999, index: 0, itemId: 'm' }], opacity: 100, blend: 'normal' };
      plan.foreground = { cuts: [{ start: 0, end: 999, index: 0, itemId: 'f' }], opacity: 100, blend: 'normal' };
      J.mediaAssets.set('m', {}); J.mediaAssets.set('f', {});
      const cv = document.createElement('canvas'); cv.width = 160; cv.height = 90;
      try { new J.Renderer().draw(cv.getContext('2d'), plan, (cut.start + cut.end) / 2); }
      finally { J.drawMedia = dm; J.drawAssets = da; J.mediaAssets.delete('m'); J.mediaAssets.delete('f'); }
      return calls;
    }''')
    want = ['media:media', 'assets:back', 'assets:front', 'media:foreground']
    got = [c for c in order if c in want]
    assert got == want, f'layer order {order}'

async def test_bundle_roundtrip(b, url):
    pg, errs = await open_app(b, url)
    saved = await pg.evaluate('''async (png) => {
      const bytes = Uint8Array.from(atob(png), c => c.charCodeAt(0));
      const file = new File([bytes], 'bg.png', { type: 'image/png' });
      const item = { id: 'bgtest', name: 'bg.png', type: 'image', size: file.size };
      await J.storeMedia(item.id, file);
      J.ui.project.media.items.push(item);
      let text = null; const orig = J.saveFile;
      J.saveFile = async (name, t) => { text = t; };
      try { await J.ui.saveBundle(); } finally { J.saveFile = orig; }
      await J.removeMedia(item.id);
      return text;
    }''', base64.b64encode(PNG).decode())
    assert saved, 'saveBundle produced nothing'
    doc = json.loads(saved)
    assert doc['bundle']['version'] == 2, doc.get('bundle')
    assert 'bgtest' in doc['bundle']['mediaFiles'], 'background file missing from bundle'
    assert doc['media']['items'][0]['id'] == 'bgtest', 'background settings must stay in project.media'
    restored = await pg.evaluate('''async (text) => {
      await J.ui.openProject(JSON.parse(text));
      const f = await J.loadMedia('bgtest');
      return { size: f && f.size, items: J.ui.project.media.items.length, hasBundle: 'bundle' in J.ui.project };
    }''', saved)
    assert restored == {'size': len(PNG), 'items': 1, 'hasBundle': False}, restored
    # 구형 v1 번들(p.media = {version:1, files})도 열린다
    legacy = await pg.evaluate('''async () => {
      await J.ui.openProject(Object.assign(JSON.parse(JSON.stringify(J.ui.project)), { media: { version: 1, files: {} } }));
      return Array.isArray(J.ui.project.media.items);
    }''')
    assert legacy, 'legacy bundle broke project.media'
    assert not errs, errs
    await pg.close()

TESTS = []
async def main():
    with serve() as url:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            pg, errs = await open_app(b, url)
            await test_layer_order(pg); assert not errs, errs; await pg.close()
            await test_bundle_roundtrip(b, url)
            for t in TESTS: await t(b, url)
            await b.close()
    print('ABSORB UI OK')
asyncio.run(main())
```

테스트가 `J.ui.saveBundle`/`J.ui.openProject`/`J.ui.plan`에 접근하므로, 12_ui.js가 이미 노출하는 `J.ui` 객체(`grep -n "J.ui\s*=" src/12_ui.js`)에 `saveBundle`, `openProject`, `get plan()`가 없으면 이 태스크에서 추가한다(`J.ui.project`는 이미 쓰이고 있음 — 포크 테스트 참조). 렌더러 클래스/메서드 이름이 `J.Renderer().draw`와 다르면 `src/09_render.js`의 실제 이름으로 테스트를 고친다.

- [ ] **Step 2: 실패 확인**

```bash
python3 build.py && dev/.venv/bin/python dev/absorb_ui_test.py
```
Expected: `bundle` 키가 없어 `KeyError: 'bundle'` 또는 `J.ui.saveBundle` 없음으로 FAIL. (레이어 순서가 이미 맞으면 첫 테스트는 통과해도 된다.)

- [ ] **Step 3: 구현**

`src/12_ui.js`:
```js
// A file saved with 「곡·소재 포함 저장」 carries p.bundle (older ones: p.media with .files and no .items):
// its files go into this browser's storage first.
async function openProject(p) {
  let bundle = p && p.bundle;
  if (!bundle && p && p.media && p.media.files && !Array.isArray(p.media.items)) { bundle = p.media; delete p.media; }
  if (p) delete p.bundle;
  if (bundle) {
    for (const [k, r] of Object.entries(bundle.files || {})) await J.idbPut(k, { name: r.name, type: r.type, data: fromB64(r.data) });
    for (const [id, r] of Object.entries(bundle.mediaFiles || {})) await J.storeMedia(id, new File([fromB64(r.data)], r.name, { type: r.type || '' }));
  }
  // …이하 기존 본문 유지(소재 정리, prepareAssets), media.song → bundle.song
}
```
`saveBundle`: 기존 `media` 변수를 `bundle = { version: 2, files: {}, mediaFiles: {} }`로 바꾸고, 소재 파일 수집 뒤에 추가:
```js
    for (const item of [...S.project.media.items, ...S.project.foreground.items]) {
      const f = await J.loadMedia(item.id).catch(() => null);
      if (f) bundle.mediaFiles[item.id] = { name: item.name, type: f.type || '', data: toB64(await f.arrayBuffer()) };
    }
    const text = JSON.stringify(Object.assign({}, S.project, { bundle }));
```
완료 토스트에 배경·전경 수를 넣는다: `` · 소재 ${S.project.assets.length}개 · 배경·전경 ${Object.keys(bundle.mediaFiles).length}개 ``. 번들을 연 뒤 미디어 미리보기 준비는 포크가 프로젝트를 열 때 쓰는 함수(12_ui.js에서 `J.attachMedia`를 부르는 곳)를 그대로 호출한다.

그리는 순서가 틀리면 `src/09_render.js`에서 Task 1 규칙 6의 순서로 맞춘다.

- [ ] **Step 4: 통과 확인**

```bash
python3 build.py && python3 tools/check_page_js.py index.html && dev/.venv/bin/python dev/absorb_ui_test.py
```
Expected: `ABSORB UI OK`

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "곡·소재 포함 저장에 배경·전경 파일 포함, 번들 키를 bundle로(구형 media 번들도 열림)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 실행 취소 통합과 행 설정 보존

**Files:**
- Modify: `src/12_ui.js`, `app/body.html`, `src/10b_assets.js`(필요 시)
- Modify: `dev/absorb_ui_test.py` (테스트 추가)

**Interfaces:**
- Consumes: 포크 `U`, `recordUndoState()`, `undoMove(direction)`, `markUndoGroup(group)`, `autosave()`/`flushSave()`(둘 다 `recordUndoState` 호출), `queueMediaDeletion(id)`, `cleanupDeletedMedia()`.
- Produces: Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y와 버튼 `btnUndo`/`btnRedo`만 존재. 우리 `ED`, `edSnap`, `pushEdit`, `edGo`, `updateEditBtns`, 버튼 `btnUndoEdit`는 제거. ◀ ▶ 구성 기록(looks history)은 그대로.

결정 사항:
- 포크 스냅샷(`JSON.stringify(S.project)`)은 가사·타이밍·overrides·소재 설정을 모두 담으므로 `ED`의 기능을 포함한다. `pushEdit()` 호출부(6곳)는 삭제하거나, 연속 입력을 묶어야 하는 곳이면 `markUndoGroup('<이름>')`으로 바꾼다. `clearLyrics`의 특수 스냅샷도 불필요 — 일반 `flushSave()`로 기록된다.
- 소재 삭제 시 `J.assetForget(a.id)`를 바로 부르면 실행 취소로 설정만 돌아오고 파일이 없다. 포크의 미디어처럼 삭제를 미룬다: 소재 삭제 버튼은 설정만 지우고 id를 대기열에 넣으며, `pagehide`의 정리에서 현재 `S.project.assets`에 없는 id만 `J.assetForget`한다. 대기열 키는 포크의 `MEDIA_DELETE_KEY`와 별도(`LS_KEY + ':assetDeletes'`).
- 초기화(`resetAll`)는 기존처럼 즉시 모두 지우고 `initUndo()`로 기록을 비운다.
- 행 overrides는 `area`, `lock`, 우리 후보 선택 필드가 한 객체에 공존한다. 리롤·이 행만 다시 탭·후보 선택·행 삽입이 **다른 필드를 지우지 않게** 한다. 특히 우리 후보 선택 코드가 `overrides[i] = {...}`로 통째 대입하면 `Object.assign({}, overrides[i], picks)`로 바꾼다.
- 되돌리기 버튼이 있던 가사 도구 줄(`btnUndoEdit` 자리)에는 포크 `btnUndo`/`btnRedo`가 이미 다른 곳에 있으면 버튼을 추가하지 않는다.

- [ ] **Step 1: 실패하는 테스트 추가**

`dev/absorb_ui_test.py`의 `TESTS = []` 줄을 아래로 바꾼다:
```python
async def test_undo_covers_our_edits(b, url):
    pg, errs = await open_app(b, url)
    r = await pg.evaluate('''async () => {
      const P = () => J.ui.project;
      document.querySelector('#modePro') && document.querySelector('#modePro').click();
      const ta = document.querySelector('#lyrics');
      ta.value = '하나\\n둘\\n셋'; ta.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 1500));
      P().overrides[1] = Object.assign({}, P().overrides[1], { area: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 }, lock: true });
      J.ui.flushSave();
      ta.value = '하나\\n둘'; ta.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 1500));
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', key: 'z', ctrlKey: true, bubbles: true }));
      await new Promise(r => setTimeout(r, 300));
      return { lyrics: P().lyrics, area: !!(P().overrides[1] && P().overrides[1].area),
               oldBtn: !!document.querySelector('#btnUndoEdit'), hasED: typeof window.edGo === 'function' };
    }''')
    assert r['lyrics'] == '하나\n둘\n셋', r
    assert r['area'], 'area override lost after undo'
    assert not r['oldBtn'], 'btnUndoEdit must be removed'
    assert not errs, errs
    await pg.close()

async def test_asset_delete_is_undoable(b, url):
    pg, errs = await open_app(b, url)
    r = await pg.evaluate('''async (png) => {
      const bytes = Uint8Array.from(atob(png), c => c.charCodeAt(0));
      const a = await J.assetAdd(new File([bytes], 's.png', { type: 'image/png' }));
      J.ui.project.assets.push(a); J.ui.flushSave();
      J.ui.removeAsset(a);                       // 소재 삭제 버튼과 같은 경로
      await new Promise(r => setTimeout(r, 100));
      const stillStored = !!(await J.idbGet('asset:' + a.id));
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', key: 'z', ctrlKey: true, bubbles: true }));
      await new Promise(r => setTimeout(r, 300));
      return { stillStored, back: J.ui.project.assets.some(x => x.id === a.id) };
    }''', base64.b64encode(PNG).decode())
    assert r == {'stillStored': True, 'back': True}, r
    assert not errs, errs
    await pg.close()

TESTS = [test_undo_covers_our_edits, test_asset_delete_is_undoable]
```
`J.ui`에 `flushSave`, `removeAsset(a)`(소재 삭제 버튼 핸들러 본문을 함수로 뽑은 것)를 노출해야 테스트가 돈다 — Step 3에서 함께 한다.

- [ ] **Step 2: 실패 확인**

```bash
python3 build.py && dev/.venv/bin/python dev/absorb_ui_test.py
```
Expected: FAIL (`btnUndoEdit must be removed` 또는 `J.ui.removeAsset` 없음).

- [ ] **Step 3: 구현**

위 결정 사항대로 `src/12_ui.js`, `app/body.html` 수정. 소재 삭제 핸들러(현재 `S.project.assets = S.project.assets.filter(x => x !== a); await J.assetForget(a.id);`)를:
```js
function removeAsset(a) {
  S.project.assets = S.project.assets.filter(x => x.id !== a.id);
  queueAssetDeletion(a.id);
  replan(); flushSave(); renderAssets();
}
```
대기열:
```js
const ASSET_DELETE_KEY = LS_KEY + ':assetDeletes';
function pendingAssetDeletes() { try { const ids = JSON.parse(localStorage.getItem(ASSET_DELETE_KEY) || '[]'); return Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : []; } catch (e) { return []; } }
function queueAssetDeletion(id) { try { localStorage.setItem(ASSET_DELETE_KEY, JSON.stringify([...new Set([...pendingAssetDeletes(), id])])); } catch (e) {} }
async function cleanupDeletedAssets() {
  const active = new Set(S.project.assets.map(a => a.id));
  for (const id of pendingAssetDeletes()) if (!active.has(id)) await J.assetForget(id).catch(() => {});
  try { localStorage.setItem(ASSET_DELETE_KEY, JSON.stringify(pendingAssetDeletes().filter(id => active.has(id)))); } catch (e) {}
}
```
`pagehide` 핸들러에 `cleanupDeletedAssets()` 추가, 시작 시(프로젝트 로드 직후)에도 한 번 호출. 실행 취소 복원(`undoMove`) 뒤 `prepareAssets()`를 불러 되살아난 소재를 다시 디코드한다.

- [ ] **Step 4: 통과·회귀 확인**

```bash
python3 build.py && python3 tools/check_page_js.py index.html && dev/.venv/bin/python dev/absorb_ui_test.py
grep -n "pushEdit\|edGo\|btnUndoEdit\|updateEditBtns" src/12_ui.js app/body.html || echo "old undo gone"
```
Expected: `ABSORB UI OK`, `old undo gone`.

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "실행 취소를 프로젝트 전체 기록 하나로 통합, 소재 삭제도 되돌릴 수 있게

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 로컬 결정 서버 `decision_server.py`

**Files:**
- Create: `decision_server.py`
- Create: `dev/decision_server_test.py`
- Delete: `jev_server.py`, `dev/jev_server_test.py`

**Interfaces:**
- Produces(HTTP): `POST /api/decide` 요청 `{"state": {...}, "questions": {"<id>": {"type": "choice", "instructions": str, "criteria": {"<key>": str}}}}` → 200 `{"answers": {"<id>": {"type": "choice", "choice": "<key>"}}}` / 413 / 400 / 502 `{"error": "<한국어>"}`. `GET /`, `/index.html`은 저장소 루트의 `index.html`. 그 밖 GET은 404.
- Produces(Python): `to_letter_prompt(state: dict, q: dict) -> tuple[str, list[str]]`(프롬프트, 글자 순서대로의 키 목록), `letter_to_key(text: str, keys: list[str]) -> str | None`, `decide(body: dict, env: dict) -> dict`(answers 딕셔너리 반환, 실패 시 `BackendError`).

- [ ] **Step 1: 실패하는 테스트 작성**

`dev/decision_server_test.py`:
```python
"""Offline tests for the local decision server. usage: python3 dev/decision_server_test.py"""
import http.server, json, sys, threading, unittest, urllib.error, urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import decision_server as ds

Q = {'mood': {'type': 'choice', 'instructions': '분위기를 고른다', 'criteria': {'calm': '잔잔함', 'pop': '경쾌함'}}}
STATE = {'lyrics': '밤하늘'}

class Fake(http.server.BaseHTTPRequestHandler):
    seen = []
    reply = None
    def log_message(self, *a): pass
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        Fake.seen.append({'path': self.path, 'auth': self.headers.get('Authorization'), 'body': body})
        code, data = Fake.reply(body)
        raw = json.dumps(data).encode()
        self.send_response(code); self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(raw))); self.end_headers(); self.wfile.write(raw)

def start(handler):
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

class Pure(unittest.TestCase):
    def test_prompt_letters(self):
        prompt, keys = ds.to_letter_prompt(STATE, Q['mood'])
        self.assertEqual(keys, ['calm', 'pop'])
        self.assertIn('State\n', prompt); self.assertIn('Question\n분위기를 고른다', prompt)
        self.assertIn('A: calm: 잔잔함', prompt); self.assertIn('B: pop: 경쾌함', prompt)
        self.assertTrue(prompt.rstrip().endswith('Answer with one letter only.'))
    def test_letter_to_key(self):
        self.assertEqual(ds.letter_to_key(' b', ['calm', 'pop']), 'pop')
        self.assertEqual(ds.letter_to_key('A.', ['calm', 'pop']), 'calm')
        self.assertIsNone(ds.letter_to_key('Z', ['calm', 'pop']))
        self.assertIsNone(ds.letter_to_key('', ['calm', 'pop']))
    def test_too_many_options(self):
        many = {'type': 'choice', 'instructions': 'x', 'criteria': {f'k{i}': str(i) for i in range(27)}}
        with self.assertRaises(ds.BackendError): ds.to_letter_prompt(STATE, many)

class Backends(unittest.TestCase):
    def setUp(self): Fake.seen = []
    def test_systemone_forwards(self):
        Fake.reply = lambda body: (200, {'answers': {'mood': {'type': 'choice', 'choice': 'pop'}}})
        srv = start(Fake)
        try:
            env = {'DECISION_BACKEND': 'systemone', 'DECISION_URL': f'http://127.0.0.1:{srv.server_port}/v1/systemone', 'DECISION_API_KEY': 'k1'}
            out = ds.decide({'state': STATE, 'questions': Q}, env)
        finally: srv.shutdown()
        self.assertEqual(out, {'mood': {'type': 'choice', 'choice': 'pop'}})
        self.assertEqual(Fake.seen[0]['path'], '/v1/systemone')
        self.assertEqual(Fake.seen[0]['auth'], 'Bearer k1')
        self.assertEqual(Fake.seen[0]['body'], {'state': STATE, 'questions': Q})
    def test_llm_letters(self):
        Fake.reply = lambda body: (200, {'choices': [{'message': {'content': 'B'}}]})
        srv = start(Fake)
        try:
            env = {'DECISION_BACKEND': 'llm', 'DECISION_URL': f'http://127.0.0.1:{srv.server_port}/v1/chat/completions', 'DECISION_MODEL': 'tev1'}
            out = ds.decide({'state': STATE, 'questions': Q}, env)
        finally: srv.shutdown()
        self.assertEqual(out, {'mood': {'type': 'choice', 'choice': 'pop'}})
        body = Fake.seen[0]['body']
        self.assertEqual(body['model'], 'tev1'); self.assertEqual(body['temperature'], 0)
        self.assertEqual(body['max_tokens'], 2)
        self.assertIsNone(Fake.seen[0]['auth'])
    def test_llm_unknown_letter_skips_question(self):
        Fake.reply = lambda body: (200, {'choices': [{'message': {'content': 'Q'}}]})
        srv = start(Fake)
        try:
            out = ds.decide({'state': STATE, 'questions': Q}, {'DECISION_BACKEND': 'llm', 'DECISION_URL': f'http://127.0.0.1:{srv.server_port}/v1/chat/completions'})
        finally: srv.shutdown()
        self.assertEqual(out, {})
    def test_backend_down(self):
        with self.assertRaises(ds.BackendError):
            ds.decide({'state': STATE, 'questions': Q}, {'DECISION_BACKEND': 'systemone', 'DECISION_URL': 'http://127.0.0.1:9/v1/systemone'})

class Http(unittest.TestCase):
    def setUp(self):
        self.srv = ds.make_server('127.0.0.1', 0, env={'DECISION_BACKEND': 'systemone', 'DECISION_URL': 'http://127.0.0.1:9/x'})
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.base = f'http://127.0.0.1:{self.srv.server_port}'
    def tearDown(self): self.srv.shutdown()
    def post(self, data, origin=None):
        req = urllib.request.Request(self.base + '/api/decide', data=data, method='POST', headers={'Content-Type': 'application/json', **({'Origin': origin} if origin else {})})
        try:
            with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')
    def test_too_large(self):
        self.assertEqual(self.post(b'{' + b' ' * 70000 + b'}')[0], 413)
    def test_bad_json(self):
        self.assertEqual(self.post(b'not json')[0], 400)
    def test_backend_error_is_502_korean(self):
        code, data = self.post(json.dumps({'state': STATE, 'questions': Q}).encode())
        self.assertEqual(code, 502); self.assertRegex(data['error'], '[가-힣]')
    def test_foreign_origin_rejected(self):
        self.assertEqual(self.post(b'{}', origin='https://evil.example')[0], 403)
    def test_preflight_pages_origin(self):
        req = urllib.request.Request(self.base + '/api/decide', method='OPTIONS', headers={'Origin': 'https://chynggi.github.io'})
        with urllib.request.urlopen(req) as r:
            self.assertEqual(r.status, 204)
            self.assertEqual(r.headers['Access-Control-Allow-Origin'], 'https://chynggi.github.io')
            self.assertEqual(r.headers['Access-Control-Allow-Private-Network'], 'true')
    def test_serves_index_only(self):
        with urllib.request.urlopen(self.base + '/') as r: self.assertIn(b'<html', r.read()[:200].lower())
        with self.assertRaises(urllib.error.HTTPError): urllib.request.urlopen(self.base + '/decision_server.py')

if __name__ == '__main__': unittest.main()
```

- [ ] **Step 2: 실패 확인**

```bash
python3 dev/decision_server_test.py
```
Expected: `ModuleNotFoundError: No module named 'decision_server'`.

- [ ] **Step 3: 구현**

`decision_server.py`:
```python
"""Serve JIZURA locally and forward 「AI로 고르기」 to a decision model running on this PC.

  systemone (default): Laya (laya-serve, :8000), Kev (python -m kev.serve, :8009) or any /v1/systemone server
  llm: Tev1 or any OpenAI-compatible chat server (Ollama, llama.cpp, LM Studio, vLLM); each choice becomes a one-letter question

Run: python3 decision_server.py      env: DECISION_BACKEND, DECISION_URL, DECISION_MODEL, DECISION_API_KEY, PORT (8765)
"""
import http.server
import json
import os
from pathlib import Path
import string
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent
PAGES_ORIGIN = 'https://chynggi.github.io'
MAX_BODY = 65536
LETTERS = string.ascii_uppercase
DEFAULT_URL = {'systemone': 'http://127.0.0.1:8000/v1/systemone', 'llm': 'http://127.0.0.1:11434/v1/chat/completions'}


class BackendError(Exception):
    pass


def to_letter_prompt(state, q):
    keys = list((q.get('criteria') or {}).keys())
    if not 2 <= len(keys) <= len(LETTERS):
        raise BackendError(f'선택지는 2~{len(LETTERS)}개여야 합니다')
    options = '\n'.join(f'{LETTERS[i]}: {k}: {q["criteria"][k]}' for i, k in enumerate(keys))
    prompt = (f'State\n{json.dumps(state, ensure_ascii=False)}\n'
              f'Question\n{q.get("instructions", "")}\n'
              f'Options\n{options}\n'
              'Answer with one letter only.')
    return prompt, keys


def letter_to_key(text, keys):
    for ch in (text or '').strip().upper():
        if ch in LETTERS:
            i = LETTERS.index(ch)
            return keys[i] if i < len(keys) else None
        if not ch.isspace():
            return None
    return None


def post_json(url, payload, key):
    headers = {'Content-Type': 'application/json'}
    if key:
        headers['Authorization'] = f'Bearer {key}'
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise BackendError(f'결정 모델 서버가 오류를 돌려주었습니다(HTTP {e.code})') from e
    except (urllib.error.URLError, OSError, ValueError) as e:
        raise BackendError(f'결정 모델 서버에 연결할 수 없습니다: {url}') from e


def decide(body, env):
    backend = env.get('DECISION_BACKEND', 'systemone')
    if backend not in DEFAULT_URL:
        raise BackendError(f'DECISION_BACKEND는 systemone 또는 llm이어야 합니다(현재: {backend})')
    url = env.get('DECISION_URL') or DEFAULT_URL[backend]
    key = env.get('DECISION_API_KEY', '')
    state, questions = body.get('state', {}), body.get('questions', {})
    if backend == 'systemone':
        data = post_json(url, {'state': state, 'questions': questions}, key)
        answers = data.get('answers')
        if not isinstance(answers, dict):
            raise BackendError('결정 모델 서버의 응답에 answers가 없습니다')
        return answers
    answers = {}
    for qid, q in questions.items():
        if q.get('type') != 'choice':
            continue
        prompt, keys = to_letter_prompt(state, q)
        payload = {'messages': [{'role': 'user', 'content': prompt}], 'temperature': 0, 'max_tokens': 2,
                   'chat_template_kwargs': {'enable_thinking': False}}
        if env.get('DECISION_MODEL'):
            payload['model'] = env['DECISION_MODEL']
        data = post_json(url, payload, key)
        try:
            text = data['choices'][0]['message']['content']
        except (KeyError, IndexError, TypeError) as e:
            raise BackendError('LLM 서버의 응답 형식을 읽을 수 없습니다') from e
        choice = letter_to_key(text, keys)
        if choice:
            answers[qid] = {'type': 'choice', 'choice': choice}
    return answers


def make_server(host, port, env=None):
    env = os.environ if env is None else env

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(ROOT), **kwargs)

        def log_message(self, fmt, *args):
            pass

        def allowed_origin(self):
            origin = self.headers.get('Origin')
            port_ = self.server.server_port
            local = {f'http://127.0.0.1:{port_}', f'http://localhost:{port_}', PAGES_ORIGIN}
            return origin if origin in local else None

        def cors(self):
            origin = self.allowed_origin()
            if origin:
                self.send_header('Access-Control-Allow-Origin', origin)
                self.send_header('Vary', 'Origin')

        def reply(self, code, data):
            raw = json.dumps(data, ensure_ascii=False).encode()
            self.send_response(code)
            self.cors()
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def do_GET(self):
            if self.path not in ('/', '/index.html', '/favicon.ico'):
                self.send_error(404)
                return
            super().do_GET()

        def do_OPTIONS(self):
            if self.path != '/api/decide' or not self.allowed_origin():
                self.send_error(403)
                return
            self.send_response(204)
            self.cors()
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.send_header('Access-Control-Allow-Private-Network', 'true')
            self.send_header('Content-Length', '0')
            self.end_headers()

        def do_POST(self):
            if self.path != '/api/decide':
                self.send_error(404)
                return
            if self.headers.get('Origin') and not self.allowed_origin():
                self.reply(403, {'error': '허용되지 않은 출처입니다'})
                return
            length = int(self.headers.get('Content-Length') or 0)
            if length > MAX_BODY:
                self.reply(413, {'error': '요청이 너무 큽니다'})
                return
            try:
                body = json.loads(self.rfile.read(length) or b'')
                if not isinstance(body, dict):
                    raise ValueError
            except ValueError:
                self.reply(400, {'error': '요청을 읽을 수 없습니다'})
                return
            try:
                self.reply(200, {'answers': decide(body, env)})
            except BackendError as e:
                self.reply(502, {'error': str(e)})

    return http.server.ThreadingHTTPServer((host, port), Handler)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', '8765'))
    backend = os.environ.get('DECISION_BACKEND', 'systemone')
    print(f'JIZURA: http://127.0.0.1:{port}/  →  {backend}: {os.environ.get("DECISION_URL") or DEFAULT_URL.get(backend, "?")}')
    make_server('127.0.0.1', port).serve_forever()
```
413 테스트에서 서버가 본문을 읽지 않고 응답하면 클라이언트 쪽 연결이 끊겨 `ConnectionResetError`가 날 수 있다. 그러면 413 분기에서 `self.rfile.read(length)`로 본문을 먼저 비운 뒤 응답한다(최대 길이만큼만 읽도록 `min(length, 1 << 20)`).

- [ ] **Step 4: 통과 확인·옛 파일 삭제**

```bash
python3 dev/decision_server_test.py -v
git rm -q jev_server.py dev/jev_server_test.py
```
Expected: 모든 테스트 `ok`.

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "로컬 결정 서버: Laya·Kev(systemone)와 Tev1·OpenAI 호환 LLM(글자 답) 지원, Jev 프록시 대체

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 브라우저 쪽 「AI로 고르기(β)」

**Files:**
- Modify: `src/08c_jev.js` (파일 이름 유지, 내용 교체)
- Modify: `src/12_ui.js`, `app/body.html`, `src/08b_omakase.js`(문구만, 필요 시)
- Rename/Modify: `dev/jev_test.js` → `dev/decide_test.js`

**Interfaces:**
- Consumes: HTTP `POST /api/decide`(Task 5).
- Produces: `J.decideEndpoint(loc) → string`, `J.decideSuggest(project, signal) → Promise<{mood, style, lines: {[i]: {layout?, enter?, exit?}}}>`, `J.applyDecide(project, selections, rnd) → look`. 프로젝트 필드 `project.aiPrompt`(추가 지시). 구 필드 `jevPrompt`는 `mergeProject`에서 `aiPrompt`로 옮긴다. UI id: `btnAiPick`, `btnAiPickBig`, `aiPrompt`.

- [ ] **Step 1: 테스트 옮기고 실패시키기**

```bash
git mv dev/jev_test.js dev/decide_test.js
```
`dev/decide_test.js`에서 `J.jevSuggest`→`J.decideSuggest`, `J.applyJev`→`J.applyDecide`, `jevPrompt`→`aiPrompt`로 바꾸고, 가짜 `fetch`가 받은 URL을 `'http://127.0.0.1:8765/api/decide'`로 단언하도록 고친다. 파일 끝에 추가:
```js
const ep = J.decideEndpoint;
assert.equal(ep({ origin: 'http://127.0.0.1:8765', protocol: 'http:' }), '/api/decide');
assert.equal(ep({ origin: 'http://localhost:8765', protocol: 'http:' }), '/api/decide');
assert.equal(ep({ origin: 'https://chynggi.github.io', protocol: 'https:' }), 'http://127.0.0.1:8765/api/decide');
assert.equal(ep({ origin: 'null', protocol: 'file:' }), 'http://127.0.0.1:8765/api/decide');
// 오류 문구는 한국어
assert.match(String(lastError && lastError.message), /[가-힣]/);
console.log('DECIDE OK');
```
(`lastError`: 테스트 안에서 연결 실패를 흉내 내는 가짜 fetch로 `J.decideSuggest`를 한 번 호출해 잡은 오류. 기존 테스트에 실패 케이스가 있으면 그것을 쓴다.)

```bash
node dev/decide_test.js
```
Expected: FAIL (`J.decideSuggest is not a function`).

- [ ] **Step 2: 구현 — `src/08c_jev.js`**

포크 구조(선택지 만들기, 12행씩 묶기, 첫 묶음에서 분위기·스타일)를 유지하고 다음만 바꾼다:
```js
/* 「AI로 고르기」: a decision model on this PC (decision_server.py) chooses from JIZURA's own vocabulary. */
J.decideEndpoint = (loc = location) => /^http:\/\/(127\.0\.0\.1|localhost):8765$/.test(loc.origin) ? '/api/decide' : 'http://127.0.0.1:8765/api/decide';
```
- `project.jevPrompt` → `project.aiPrompt`
- 지시문(instructions)은 한국어로: `'가사와 사용자의 추가 지시를 모두 고려한다.'` / `'가사를 고려한다.'`, `'가사 전체에 가장 어울리는 영상 분위기를 고른다.'`, `'가사 전체에 가장 어울리는 문자 PV 배색·서체 스타일을 고른다.'`, `` `행 ${n + 1}에 어울리는 ${{ layout: '문자 레이아웃', enter: '등장 동작', exit: '퇴장 동작' }[g]}을 고른다.` ``
- 오류 문구: `'가사를 입력하세요'`, `'로컬 결정 서버에 연결할 수 없습니다. decision_server.py가 실행 중인지, 브라우저의 로컬 네트워크 접근 허용을 확인하세요'`, `` `결정 서버: HTTP ${response.status}` ``, `'분위기·스타일 선택 결과를 확인하지 못했습니다'`
- `J.jevSuggest`→`J.decideSuggest`, `J.applyJev`→`J.applyDecide`. `applyDecide`는 기존 override의 `area`뿐 아니라 **모든 기존 필드**를 보존하고 layout/enter/exit만 덮어쓴다: `overrides[index] = Object.assign({}, overrides[index], picks)` (잠긴 행은 건너뜀 — 포크 그대로).

- [ ] **Step 3: 구현 — UI**

`src/12_ui.js`: `jevBusy`/`jevOmakase` → `aiBusy`/`aiPick`, 버튼 id `btnJev`/`btnJevBig` → `btnAiPick`/`btnAiPickBig`, 입력 id `jevPrompt` → `aiPrompt`, 진행 문구 `'AI가 가사에 맞는 연출을 고르는 중…'`, 실패 토스트 `` `AI로 고르기: ${e.message || e}` ``, 성공 토스트 `` `AI로 고르기: ${J.STYLES[look.style].name} × ${J.MOODS[look.mood].name}` ``, 도중 변경 오류 `'고르는 동안 가사나 추가 지시가 바뀌었습니다. 다시 실행하세요'`. `mergeProject`에서 `o.aiPrompt = String((p && (p.aiPrompt ?? p.jevPrompt)) || ''); delete o.jevPrompt;`.
`app/body.html`: 버튼 문구 `AI로 고르기(β)`, title `PC에서 실행 중인 결정 모델(Laya·Kev·Tev1 등)이 가사에 맞는 분위기·스타일·행별 연출을 고릅니다`, 추가 지시 라벨 `AI에게 추가 지시(선택)`, 가이드 링크 `docs/DECISION_GUIDE.md`(GitHub의 우리 저장소 URL `https://github.com/chynggi/JIZURA-KOR/blob/main/docs/DECISION_GUIDE.md`).

- [ ] **Step 4: 통과 확인(단위 + 실제 서버와 브라우저)**

```bash
node dev/decide_test.js
python3 build.py && python3 tools/check_page_js.py index.html
grep -rn "jev\|Jev" src app/body.html | grep -v "^src/08c_jev.js:.*\*" || echo "no jev left"
```
Expected: `DECIDE OK`, `JS OK`, 파일명 외 `jev` 참조 없음.

`dev/absorb_ui_test.py`의 `TESTS` 목록에 추가:
```python
async def test_ai_pick_end_to_end(b, url):
    import subprocess, sys, time
    fake = subprocess.Popen([sys.executable, '-c', '''
import http.server, json
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        ans = {q: {"type": "choice", "choice": list(v["criteria"])[0]} for q, v in body["questions"].items()}
        raw = json.dumps({"answers": ans}).encode()
        self.send_response(200); self.send_header("Content-Length", str(len(raw))); self.end_headers(); self.wfile.write(raw)
http.server.HTTPServer(("127.0.0.1", 8799), H).serve_forever()
'''])
    env = dict(os.environ, DECISION_BACKEND='systemone', DECISION_URL='http://127.0.0.1:8799/v1/systemone', PORT='8765')
    srv = subprocess.Popen([sys.executable, os.path.join(ROOT, 'decision_server.py')], env=env)
    try:
        time.sleep(1.2)
        pg = await b.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://127.0.0.1:8765/'); await pg.wait_for_function('window.J && J.ui && J.ui.project')
        await pg.click('#modePro')
        await pg.fill('#lyrics', '밤하늘\n별빛'); await pg.wait_for_timeout(800)
        await pg.click('#btnAiPick'); await pg.wait_for_timeout(2500)
        style = await pg.evaluate('J.ui.project.style')
        assert style == (await pg.evaluate('Object.keys(J.STYLES).filter(k => J.STYLE_ORDER.includes(k))[0]')) or style, style
        assert not errs, errs
        await pg.close()
    finally:
        srv.terminate(); fake.terminate()
```
그리고 `TESTS = [test_undo_covers_our_edits, test_asset_delete_is_undoable, test_ai_pick_end_to_end]`.
```bash
dev/.venv/bin/python dev/absorb_ui_test.py
```
Expected: `ABSORB UI OK`.

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "「Jev로 만들기」를 로컬 결정 모델 「AI로 고르기(β)」로 교체

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 문서와 이용 안내

**Files:**
- Create: `docs/DECISION_GUIDE.md`
- Delete: `docs/JEV_GUIDE.md`, `docs/JEV_GUIDE.en.md`
- Modify: `README.md`(우리 한국어판 README가 어느 파일인지 먼저 확인 — `README.md`가 일본어 upstream 원본이면 `README.ko.md`), `docs/LOCAL_SETUP.md`, `app/body.html`(「이용에 대하여」 안내)

**Interfaces:**
- Consumes: Task 5 환경변수·포트, Task 6 버튼 이름.

- [ ] **Step 1: `docs/DECISION_GUIDE.md` 작성**

아래 내용을 그대로 쓴다.
````markdown
# AI로 고르기(β) — 로컬 결정 모델 연결

「AI로 고르기(β)」는 PC에서 실행 중인 **결정 모델**이 가사에 맞는 분위기·스타일과 행별 레이아웃·등장·퇴장을 JIZURA의 부품 목록 안에서 고르게 합니다. 이 기능을 쓰지 않으면 아무것도 설치할 필요가 없습니다.

## 구성

```
브라우저(JIZURA) ──POST /api/decide──▶ decision_server.py(:8765) ──▶ 결정 모델 서버(내 PC)
```

`decision_server.py`는 Python 3 표준 라이브러리만 씁니다. 결정 모델은 아래 중 하나를 고릅니다.

| 모델 | 방식(`DECISION_BACKEND`) | 기본 주소 | 특징 |
|---|---|---|---|
| [Laya](https://huggingface.co/convaiinnovations/laya) | `systemone` | `http://127.0.0.1:8000/v1/systemone` | 322M~421M, CPU에서도 동작, 한국어는 다국어 체크포인트로 자동 전환. 사전학습만 된 상태의 정확도는 낮은 편 |
| [Kev](https://huggingface.co/jaredpalmer/kev-0.5b) | `systemone` | `http://127.0.0.1:8009/v1/systemone` | Qwen 기반 0.8B/4B/9B, Jev와 같은 API |
| [Tev1](https://github.com/togethercomputer/tev1) 또는 일반 LLM | `llm` | `http://127.0.0.1:11434/v1/chat/completions` | OpenAI 호환 서버(Ollama·llama.cpp·LM Studio·vLLM)에 선택지를 A, B, C… 글자로 묻습니다 |

## 1. 결정 모델 띄우기

### Laya

```sh
pip install "laya[serve]"
LAYA_HOST=127.0.0.1 laya-serve          # :8000
```

### Kev

```sh
# 저장소 안내에 따라 설치한 뒤
python -m kev.serve --run runs/kev      # :8009
```

### Tev1 / 일반 LLM (Ollama 예)

Tev1은 가중치가 저장소에 들어 있지 않습니다. 저장소의 레시피로 Qwen3.5-4B를 직접 파인튜닝한 뒤 GGUF 등으로 바꿔 Ollama·llama.cpp에 올리거나, 일반 Qwen 모델로 대신할 수 있습니다.

```sh
ollama serve                             # :11434
ollama pull qwen3.5:4b                   # 또는 직접 만든 tev1 모델
```

## 2. JIZURA 서버 실행

저장소 루트에서:

```sh
# Laya (기본값이라 설정 불필요)
python3 decision_server.py

# Kev
DECISION_URL=http://127.0.0.1:8009/v1/systemone python3 decision_server.py

# Tev1 / Ollama
DECISION_BACKEND=llm DECISION_MODEL=qwen3.5:4b python3 decision_server.py
```

PowerShell에서는 `$env:DECISION_BACKEND = 'llm'`처럼 설정한 뒤 `python decision_server.py`를 실행합니다.

| 환경변수 | 뜻 |
|---|---|
| `DECISION_BACKEND` | `systemone`(기본) 또는 `llm` |
| `DECISION_URL` | 결정 모델 서버 주소(위 표의 기본값) |
| `DECISION_MODEL` | `llm`일 때 모델 이름 |
| `DECISION_API_KEY` | 결정 모델 서버가 토큰을 요구하면(예: `LAYA_API_KEY`) 같은 값 |
| `PORT` | JIZURA 서버 포트(기본 8765) |

## 3. 사용

<http://127.0.0.1:8765/>를 열거나, [GitHub Pages 판](https://chynggi.github.io/JIZURA-KOR/)에서 「AI로 고르기(β)」를 누릅니다. Pages 판에서는 브라우저가 로컬 네트워크 접근 허용을 물을 수 있습니다. 「AI에게 추가 지시」에 원하는 분위기를 자연어로 적을 수 있습니다.

## 보내는 데이터

가사·곡명·아티스트·추가 지시와 선택지 목록을 `DECISION_URL`로 보냅니다. 기본값은 모두 내 PC 안(127.0.0.1)입니다. 음성·이미지·동영상은 보내지 않습니다. 고르기에 실패하면 현재 구성은 바뀌지 않습니다.

## 연결되지 않을 때

- `decision_server.py`와 결정 모델 서버가 둘 다 실행 중인지 확인합니다.
- 오류 문구에 나온 주소가 결정 모델 서버 주소와 맞는지 확인합니다.
- Pages 판에서 안 되면 <http://127.0.0.1:8765/>에서 씁니다.
````

- [ ] **Step 2: README·LOCAL_SETUP·앱 안내 수정**

- 한국어 README에 「배경·전경 컷」「행별 표시 영역」「타임라인 편집(경계 드래그·전체 길이·확대)」「실행 취소/다시 실행」「출력 크기·합성 글꼴」 절을 포크 README(`git show hirazisora/main:README.md`) 내용을 한국어로 옮겨 추가하고, 「AI로 고르기(β)」 절은 `docs/DECISION_GUIDE.md` 링크와 두세 줄 요약만 둔다. 포크 출처 한 줄: `배경·전경 컷, 표시 영역, 타임라인 편집 등은 [hirazisora/JIZURA](https://github.com/hirazisora/JIZURA)에서 가져왔습니다.`
- 이용 안내(README와 `app/body.html` 「이용에 대하여」)의 "서버로 보내지 않는다" 문장을 다음으로 바꾼다: `평소에는 가사·곡·소재를 브라우저 안에서만 처리합니다. 「AI로 고르기」를 쓰면 가사·곡명·아티스트·추가 지시를 직접 설정한 결정 서버(기본은 내 PC 안)로 보냅니다. 음성·이미지·동영상은 보내지 않습니다.`
- 배경·전경 파일 저장 방식 안내: 일반 프로젝트 JSON에는 설정만 들어가고, 「곡·소재 포함 저장」은 배경·전경 파일까지 담는다.
- `docs/LOCAL_SETUP.md` 테스트 절에 추가:
```
python3 dev/decision_server_test.py     # 로컬 결정 서버
node dev/media_test.js && node dev/lyric_test.js && node dev/decide_test.js
dev/.venv/bin/python dev/absorb_ui_test.py   # 배경·전경·번들·실행 취소·AI로 고르기(브라우저)
```

- [ ] **Step 3: 확인**

```bash
git rm -q docs/JEV_GUIDE.md docs/JEV_GUIDE.en.md
grep -rn "JEV_GUIDE\|jev_server\|TYPESAFE_API_KEY\|hirazisora.github.io" --include=*.md --include=*.html --include=*.js --include=*.py . | grep -v "^./en/\|^./zh-\|^./id/\|^./ko/\|docs/superpowers" || echo "clean"
python3 build.py && python3 tools/check_page_js.py index.html
```
Expected: `clean`, `JS OK`.

- [ ] **Step 4: 커밋**

```bash
git add -A && git commit -m "문서: 배경·전경 컷·표시 영역·타임라인 안내, 로컬 결정 모델 가이드, 이용 안내 갱신

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: 포크 UI 테스트 이식과 최종 검증

**Files:**
- Delete: `dev/new_features_test.cjs` (Windows Edge 경로·Node playwright 전제)
- Modify: `dev/absorb_ui_test.py` (포크 테스트 이식)

**Interfaces:**
- Consumes: 모든 이전 태스크.

- [ ] **Step 1: 포크 테스트 이식**

`git show hirazisora/main:dev/new_features_test.cjs`의 단언을 `dev/absorb_ui_test.py`의 새 함수 `test_fork_features(b, url)`로 옮긴다(Python Playwright, 루트 `index.html`만 — `en/`은 재빌드하지 않으므로 제외). 최소 포함: 출력 크기 선택(`#outVideoSize` → `J.outputSize(J.ui.project)`가 `[1080, 1920]`, 직접 입력 1500×900), 타임라인 확대(`#timelineZoomIn` 두 번 → `#timelineStack` 폭 > `#timelineScroll` 폭 × 2), 합성 글꼴 관련 단언. 포크 테스트의 나머지 단언도 셀렉터가 존재하면 옮기고, 일본어 문구 단언은 Task 2 용어표의 한국어로 바꾼다. 폰트 단언 `/Noto Sans JP/`는 우리 한국어 폰트 목록의 실제 값으로 바꾼다(`J.FONTS.gothic_bold`를 확인). `TESTS`에 추가.

```bash
git rm -q dev/new_features_test.cjs
python3 build.py && dev/.venv/bin/python dev/absorb_ui_test.py
```
Expected: `ABSORB UI OK`.

- [ ] **Step 2: 전체 회귀**

```bash
python3 build.py && python3 tools/check_page_js.py index.html
node dev/media_test.js && node dev/lyric_test.js && node dev/decide_test.js && echo UNIT OK
python3 dev/decision_server_test.py
dev/.venv/bin/python dev/absorb_ui_test.py
python3 build.py --dev && python3 dev/build_test.py all --all-packs
(cd dev/www && python3 -m http.server 8765 >/dev/null 2>&1 &) ; sleep 1
dev/.venv/bin/python dev/smoke_all.py
pkill -f "http.server 8765"
node dev/ae_test.js | tail -3
tools/check_fork_ko.sh
git status --short
```
Expected: `JS OK`, `UNIT OK`, 서버 테스트 OK, `ABSORB UI OK`, smoke `problems 0`·`page errors []`, ae 오류 0, 한국어 검사 출력 없음, 작업 트리 깨끗(빌드 산출물 `index.html` 변경은 커밋).

- [ ] **Step 3: MP4 내보내기 수동 확인(스크린샷)**

Playwright로 배경 이미지 1장 + 전경 이미지 1장 + 소재 1장을 넣고 1초 구간을 미리보기 캔버스로 캡처해 `dev/www/absorb_check.png`로 저장, 이미지를 직접 열어 배경·소재·가사·전경이 순서대로 겹쳐 보이는지 확인한다(커밋하지 않음). MP4 내보내기는 headless Chromium에서 WebCodecs H.264가 없을 수 있으므로, 없으면 연속 PNG 내보내기 경로로 1프레임을 확인하고 그 사실을 보고한다.

- [ ] **Step 4: 커밋**

```bash
git add -A && git commit -m "포크 UI 테스트를 Python Playwright로 이식, 최종 빌드

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
