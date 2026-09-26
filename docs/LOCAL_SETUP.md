# 로컬 설치 및 구동 가이드

JIZURA를 내 PC에서 실행·수정·빌드·테스트하는 방법을 정리합니다. 쓰기만 할 거라면 [웹 버전](https://852wa.github.io/JIZURA/)을 여는 것으로 충분합니다.

## 1. 준비물

| 용도 | 필요한 것 |
|---|---|
| 앱 실행만 | Chrome / Edge(권장). MP4 내보내기는 WebCodecs 지원 브라우저가 필요합니다 |
| 빌드 | Python 3, Node.js (npm 패키지 불필요) |
| AE 패널 테스트 | 위 + `dev/`에서 `npm install`(acorn) |
| 렌더링 테스트 | 위 + Python 패키지 `playwright`, `Pillow`와 Chromium |

## 2. 받기

```
git clone https://github.com/chynggi/JIZURA-KOR.git
cd JIZURA-KOR
```

## 3. 앱 실행

`index.html`은 빌드된 단일 파일이라 별도 설치 없이 동작합니다.

- **간단히**: `index.html`을 브라우저로 엽니다(더블클릭).
- **권장(로컬 서버)**: 브라우저에 따라 `file://`에서 일부 기능이 제한될 수 있으므로 서버로 여는 편이 안전합니다.
  ```
  python3 -m http.server 8000
  ```
  → <http://localhost:8000/> 접속
  저장소 루트의 `preview_server.py`를 쓰면 `python3 preview_server.py`로 <http://127.0.0.1:8766/>에서 바로 열립니다(8765는 결정 서버의 기본 포트라 피합니다).

글꼴은 Google Fonts에서 받아오므로 인터넷 연결이 필요합니다(오프라인이면 PC 글꼴로 대체됩니다).

## 4. 소스 수정 후 빌드

`index.html`과 `JIZURA_AE.jsx`는 생성물입니다. 직접 고치지 말고 소스를 고친 뒤 빌드하세요.

| 수정한 곳 | 실행할 명령 | 결과물 |
|---|---|---|
| `src/` `app/` `vendor/` | `python3 build.py` | `index.html` |
| `ae/` | `python3 build_ae.py` | `JIZURA_AE.jsx` |
| 스타일·레이아웃 목록 등 AE와 공유하는 데이터 (`src/`) | `node tools/export_ae_data.js` → `python3 build_ae.py` | `ae/data.json` → `JIZURA_AE.jsx` |

가사 파싱·타이밍·구성 로직은 브라우저(`src/08_planner.js`)와 AE(`ae/00_core.jsx`, `ae/15_plan.jsx`)에 따로 구현되어 있으므로, 이 부분을 바꿀 때는 양쪽을 함께 수정해야 결과가 같아집니다.

## 5. After Effects 패널 설치

1. `python3 build_ae.py`로 만든(또는 저장소에 있는) `JIZURA_AE.jsx`를 다음 폴더에 복사합니다.
   - Windows: `C:\Program Files\Adobe\Adobe After Effects <버전>\Support Files\Scripts\ScriptUI Panels\`
   - Mac: `/Applications/Adobe After Effects <버전>/Scripts/ScriptUI Panels/`
2. AE를 재시작하고 「창(Window)」→「JIZURA_AE.jsx」를 엽니다.

시험 삼아 한 번만 돌려 보려면 「파일 → 스크립트 → 스크립트 파일 실행」으로도 됩니다.

## 6. 테스트

### AE 패널 (모의 AE 환경)

```
cd dev && npm install && cd ..
python3 build_ae.py
node dev/ae_test.js
```

`expr syntax errors 0`·`problems 0`·`warnings 0`이면 정상입니다. 브라우저에서 내보낸 AE용 JSON도 인자로 넘겨 검증할 수 있습니다: `node dev/ae_test.js plan_ae.json`

### 브라우저 렌더링 (Playwright)

```
pip install playwright pillow
python3 -m playwright install chromium

python3 build.py --dev                          # dev/www/ 에 테스트용 번들 생성
python3 dev/build_test.py all --all-packs       # dev/www/t_all.html 생성
(cd dev/www && python3 -m http.server 8768 &)   # 8765는 결정 서버 기본 포트라 겹치므로 피하고 8768을 씁니다

python3 dev/smoke_all.py        # 모든 부품 조합 렌더링: 콘솔 오류·예외·느린 프레임 확인
python3 dev/cost_scan.py        # 부품별 렌더링 비용
python3 dev/overview.py layout out/overview   # 그룹별 한눈에 보기 이미지
```

`dev/smoke_all.py`는 접속 포트가 소스에 `localhost:8765`로 박혀 있으므로, 8768로 돌리려면 소스를 바꿔 실행합니다.

```
dev/.venv/bin/python -c "import sys; src=open('dev/smoke_all.py').read().replace('localhost:8765','localhost:8768'); sys.argv=['smoke_all.py']; exec(compile(src,'smoke_all.py','exec'))"
```

`dev/www/`는 빌드 산출물이므로 커밋하지 않습니다.

### 이 포크에서 추가한 테스트

```
python3 dev/decision_server_test.py     # 로컬 결정 서버
node dev/media_test.js && node dev/lyric_test.js && node dev/decide_test.js
dev/.venv/bin/python dev/absorb_ui_test.py   # 배경·전경·번들(.jizura)·실행 취소·AI로 고르기(브라우저)
dev/.venv/bin/python dev/fork_ui_test.py      # 포크 기능(테마·미디어 효과·가사·프로젝트 파일, 브라우저)
```

## 7. 내 저장소로 공개(GitHub Pages)

README의 「자신의 저장소로 공개하기」를 참고하세요. `index.html`이 루트에 있는 상태로 push하고 **Settings → Pages**에서 `main` / `/ (root)`를 지정하면 됩니다.

## 문제 해결

- **MP4 내보내기 버튼이 동작하지 않음**: 브라우저가 WebCodecs(H.264)를 지원하지 않는 경우입니다. Chrome / Edge를 쓰거나 연속 PNG로 내보내세요.
- **글꼴이 바뀌지 않음**: 인터넷 연결을 확인하세요. 오프라인이면 PC 글꼴로 대체됩니다.
- **소스를 고쳤는데 앱에 반영되지 않음**: `python3 build.py`를 다시 실행했는지, 브라우저 캐시를 새로고침(Ctrl+Shift+R)했는지 확인하세요.
- **`node dev/ae_test.js`에서 `Cannot find module 'acorn'`**: `cd dev && npm install`을 먼저 실행하세요.
