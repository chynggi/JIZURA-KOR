# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 이 저장소

JIZURA 字面(가사 → 문자 PV 자동 구성, 브라우저에서 MP4 내보내기)의 **한국어 포크**입니다. 원격은 `origin`(이 포크), `upstream`(852wa/JIZURA, 일본어 원본), `hira`(hirazisora 포크 — 기능을 흡수해 옴). 소스의 UI 문구는 한국어이며, upstream 병합 후 남은 일본어 UI 문구는 `tools/check_fork_ko.sh [BASE]`로 찾습니다.

## 빌드 (생성물은 직접 고치지 말 것)

| 고친 곳 | 명령 | 생성물 |
|---|---|---|
| `src/` `app/` `vendor/` | `python build.py` (`--dev`면 `dev/www/jizura.js`·`test.html`도) | `index.html` |
| AE와 공유하는 데이터(스타일·부품 메타) in `src/` | `node tools/export_ae_data.js` | `ae/data.json` |
| `ae/` | `python build_ae.py` (`--packs p_a,p_b --out dev/www/ae_x.jsx`로 일부 팩만) | `JIZURA_AE.jsx` |
| `cep/` 또는 위 전부 | `python build_cep.py [--debug]` (먼저 `build.py`) | `build/com.852wa.jizura/`, `build/JIZURA_CEP.zip` |

- `index.html`(약 6.6MB)·`JIZURA_AE*.jsx`·`JIZURA_CEP*.zip`은 커밋되는 빌드 결과물입니다. 소스를 바꾼 뒤 반드시 다시 빌드해 함께 반영합니다. 읽을 때도 이 거대 파일 대신 소스를 보세요.
- `build.py`는 **한국어판 `index.html`만** 만듭니다. `en/` `zh-hant/` `zh-hans/` `id/` `ko/` `vi/`의 `index.html`은 upstream 배포본을 그대로 둔 것이라 손대지 않습니다. `app/english.py`·`app/i18n*.py`는 일본어 원본 기준 번역 모듈입니다.
- 빌드에는 Python 3와 Node.js만 필요합니다(npm 패키지 불필요). 버전은 `VERSION`, 소스의 `@VERSION@`이 치환됩니다.

## 실행

- 미리보기: `python preview_server.py` → <http://127.0.0.1:8766/> (`.claude/launch.json`의 `jizura-preview`, `start_jizura.bat`도 같은 서버). 매 요청마다 디스크의 `index.html`을 읽으므로 **빌드 후 새로고침만** 하면 됩니다.
- **포트 8765는 사용자의 결정 서버(`decision_server.py`) 전용 — 테스트에 쓰지 말 것.** 8766은 미리보기 서버와 일부 UI 테스트가 겹치므로, UI 테스트 전에 미리보기 서버를 끕니다. 테스트 번들용 정적 서버는 8768.

## 테스트

전체 절차는 `docs/LOCAL_SETUP.md`. 자주 쓰는 것:

```
node dev/media_test.js && node dev/lyric_test.js && node dev/decide_test.js   # 노드 단위 테스트(파일 하나씩 실행)
node dev/cut_fx_test.js ; node dev/interlude_test.js ; node dev/lyric_blend_test.js
python dev/decision_server_test.py                                           # 결정 서버(오프라인)
dev/.venv/bin/python dev/fork_ui_test.py [test_name ...]                     # 브라우저 UI(Playwright, 8766 자체 서빙), 이름으로 개별 실행
dev/.venv/bin/python dev/absorb_ui_test.py
cd dev && npm install && cd .. && python build_ae.py && node dev/ae_test.js   # AE 패널(모의 AE 객체 모델, acorn 필요)
node dev/ae_check.js --jsx dev/www/ae_x.jsx --group layout --ids a,b         # AE 부품 단위 검사
python tools/check_page_js.py index.html                                     # 빌드된 페이지 인라인 스크립트 문법 검사
```

렌더링 전수 검사: `python build.py --dev` → `python dev/build_test.py all --all-packs` → `dev/www`를 8768로 서빙 → `dev/smoke_all.py`·`dev/cost_scan.py`·`dev/overview.py GROUP OUTDIR`. `smoke_all.py`/`pack_sheet.py`는 소스에 `localhost:8765`가 박혀 있으니 8768로 바꿔 실행합니다(LOCAL_SETUP.md 참고). 노드 테스트는 프레임워크 없이 `node:assert`를 쓰고, 플래너 테스트는 `dev/plan_harness.js`(src의 `01…08*`와 `11p_`/`11q_` 파일을 vm에 로드해 `J` 반환)를 씁니다.

## 아키텍처

**브라우저 앱 = `src/*.js`를 파일 이름 순으로 이어 붙인 단일 스크립트.** 모듈 시스템이 없고 모두 전역 네임스페이스 `window.J`에 붙습니다. 그래서 **파일 이름의 번호가 곧 로드 순서이자 의존 순서**입니다(새 파일은 의존하는 파일보다 뒤 번호로). `app/body.html`(마크업)·`app/style.css`·`vendor/mp4-muxer.min.js`와 함께 `build.py`가 `index.html` 하나로 인라인합니다.

대략의 층:
- `01_util`(수학·이징·시드 RNG·색) → `02_fonts`·`02b_lang` → `03_text`(`J.drawItem` 텍스트 아이템 모델) → `04_styles`(스타일 팩) → `05_anim`(등장/유지/퇴장) → `05b_registry`(그룹별 레지스트리와 `J.register`) → `06_layouts`·`07_decor`
- `08_planner`(가사 파싱·타이밍·컷 구성) + `08b_omakase`(자동/간편 모드) + `08c…08m`(미디어 레이어, 가사 기능, 컷 상세 편집, 마스크, 인물 컷아웃 등 — 대부분 이 포크가 추가)
- `09_render`(프레임 렌더, `makeEnv` 드로잉 헬퍼) → `10_audio`(박자 감지) → `11_export`(MP4/PNG/AE JSON)·`11b_project_file`(`.jizura` 저장)
- `11p_*.js` = **표현 팩**(부품만 `J.register`로 추가, 코어 수정 금지), `11q…11y` = 세트·테마·즐겨찾기 등 → `12_ui.js`(에디터 UI 전체, 가장 큼)

**표현 부품 모델**: 가사 → 시간 붙은 "컷", 컷마다 레이아웃 1 + 등장 + 유지 + 퇴장 + 장식 0..n (+ treat/bg/cam/fx/trans). 그룹·레지스트리·순서 배열 표는 `src/05b_registry.js` 머리 주석에 있습니다. 렌더링은 시드 기반 결정론적 Canvas2D이며, 레이아웃 `render`/장식 `draw`는 **프레임당 3번(B·A 크로매틱 고스트 패스, main)** 호출됩니다 — `ctx`를 직접 쓰는 그리기는 `env.pass === 'main'`으로 가드해야 합니다. 부품을 추가·수정할 땐 `docs/EXPRESSION_PACKS.md`를 먼저 읽으세요(env 필드, 설계 공간 크기, 화면 비율 대응 규칙).

**After Effects 쪽은 별도 재구현입니다.** `ae/*.jsx`(ExtendScript/ES3)가 같은 결정을 AE 레이어·익스프레션으로 다시 그리고, `ae/p_*.jsx`가 `src/11p_*.js` 팩에 대응합니다. 무엇을 고를지에 대한 메타데이터만 `ae/data.json`으로 공유합니다. 따라서:
- 가사 파싱·타이밍·구성 로직을 바꾸면 `src/08_planner.js`와 `ae/00_core.jsx`·`ae/15_plan.jsx`를 **함께** 고쳐야 결과가 같아집니다.
- `src/`에 `window`/DOM을 로드 시점에 건드리는 코드를 넣으면 `tools/export_ae_data.js`(vm 스텁 위에서 src 로드)가 죽을 수 있습니다 — 필요하면 그 스텁을 보강합니다.
- `build_ae.py`는 모든 비ASCII 문자를 `\uXXXX`로 이스케이프합니다(ExtendScript 인코딩 대비).

CEP 패널(`cep/`) = 빌드된 브라우저 앱 + `cep/cep.js`(AE 브리지) + `cep/host.jsx` + `build_ae.py --core`로 만든 엔진.

**`decision_server.py`(포크 전용, 「AI로 고르기(β)」)**: 앱을 서빙하면서 로컬 결정 모델(systemone 또는 OpenAI 호환 LLM)로 선택 질문을 중계합니다. 설정은 환경변수 `DECISION_BACKEND/URL/MODEL/API_KEY/PORT`, 안내는 `docs/DECISION_GUIDE.md`. upstream의 방침(외부 송수신·AI 연동 금지, `CONTRIBUTING.md`)과 충돌하는 기능이므로 **upstream에 보낼 변경에는 섞지 마세요.** 그 외 기능은 이 방침(외부 통신은 Google Fonts뿐)을 따릅니다.

## 주의

- `.gitignore`에 `dev/`가 있지만 `dev/`의 테스트 파일은 추적 중입니다. 새 테스트 파일은 `git add -f`가 필요하고, `dev/www/`·`dev/.venv`·`dev/node_modules`는 커밋하지 않습니다. `.claude/`도 커밋하지 않습니다.
- `core.fileMode=false`(Windows 실행 비트 노이즈 방지). `tools/check_fork_ko.sh`는 `git update-index --chmod=+x`로 755를 유지합니다.
- Bash heredoc에서는 백슬래시·한국어가 깨질 수 있으니, 일회성 스크립트는 파일로 써서 실행하세요. PowerShell에서는 `"stash@{0}"`처럼 따옴표가 필요합니다.
- 진행 중인 큰 작업의 인수인계 노트는 `.claude/handoff/HANDOFF.md`, 설계/계획 문서는 `docs/superpowers/`에 있습니다.
