# hirazisora 포크 기능 흡수 설계

- 날짜: 2026-09-25
- 대상: <https://github.com/hirazisora/JIZURA> `main` (a25532f, 병합 기준 24c0fd8 이후 포크 전용 커밋 42개)
- 제외: 포크의 `feature/media-effects`, `test` 브랜치(미병합 실험), TypeSafe Jev 직접 연동

## 목표

포크 전용 기능 중 아래를 한국어판에 흡수한다. 기존 한국어판 기능(간주·마무리 카드, 음악 반응, 확장 LRC, 행별 후보 6개·우타하메, 곡에서 행 시작 자동 초안, 소재·피사체 마스크, 곡·소재 포함 저장)은 그대로 동작해야 한다.

| 묶음 | 내용 |
|---|---|
| B | 배경·전경 미디어 컷: 이미지·동영상, 컷별 소재 선택·시작 시각·표시 방법·등장/유지/퇴장/가공·컷 간 전환, 동영상 루프·크로마키, 배치·크기·회전 드래그 편집, 랜덤 순서·루프 표시, 빈 컷 삽입·삭제 |
| C | 행별 가사 표시 영역(사각형) 편집: 이 행만 / 이후 전부 적용, 전역 리셋 |
| D | 타임라인: 컷 경계 드래그(가사·전경·배경 연동), 빈 가사 컷, 가사 텍스트 라벨, 타임라인 위 리롤·잠금, 전체 길이 편집, 타임라인 확대 |
| E | 프로젝트 실행 취소 / 다시 실행 |
| F | 출력 크기 지정, 합성 폰트, 행 삽입 시 타이밍·연결 유지, 컷별 최전면 가사 |
| A′ | Jev 대신 로컬 결정 모델("AI로 고르기(β)") |

## 1. 병합 방식

- `hirazisora` 원격을 추가하고 `git merge hirazisora/main` 으로 실제 병합한다(포크 이력·기여자 보존). 작업은 `main`에서 분기한 브랜치에서 한다.
- 충돌 파일(README.md, README.en.md, app/body.html, app/style.css, build.py, index.html, en/index.html, src/02_fonts.js, src/03_text.js, src/08_planner.js, src/09_render.js, src/11_export.js, src/12_ui.js, JIZURA_CEP_en.zip)은 **우리 쪽을 기준**으로 풀고 포크 로직을 끼워 넣는다.
- 포크가 추가한 일본어 UI 문구는 모두 한국어로 옮긴다(우리 `src/`는 한국어 원본).
- `index.html`은 `python3 build.py` 결과로 다시 만든다. `en/`·기타 언어판과 `JIZURA_CEP*.zip`·`JIZURA_AE*.jsx`는 우리 쪽 파일을 유지한다(build.py 주석대로 여기서 재빌드하지 않음). 포크의 `app/english.py` 변경은 자동 병합분을 받아들이되 영어판 재빌드는 하지 않는다.
- 포크가 커밋한 `app/__pycache__/*.pyc`는 제거하고 `.gitignore`에 `__pycache__/`를 추가한다.
- README는 우리 문서를 유지하고, 새 기능 설명(배경·전경, 표시 영역, 타임라인, AI로 고르기)을 한국어로 추가한다. 포크의 URL 교체(hirazisora.github.io)는 받아들이지 않는다.

## 2. B — 미디어 컷과 소재의 공존

- 포크의 `src/08d_media.js`(계획·IndexedDB `jizura-media-v1`·그리기)를 그대로 들여오고 문구만 한국어화한다.
- 그리는 순서(아래→위): 배경 컷(`project.media`) → 소재 뒤(`plan.assets` back, 피사체 사진) → 가사·장식 → 소재 앞·피사체 → 전경 컷(`project.foreground`).
- 크로마키/그린백 합성 출력(`key` 모드)에서는 기존 규칙대로 소재를 그리지 않으며, 미디어 컷도 포크 규칙을 따른다.
- 왼쪽 패널 탭: 포크의 「전경 / 가사 / 배경」 탭 구조를 가져오고, 우리 「소재」 패널은 가사 탭 안(현재 위치)에 둔다. 두 기능의 이름을 구분한다: 포크 것은 「배경 컷」「전경 컷」, 우리 것은 「소재」.
- 「곡·소재 포함 저장」: 번들에 `jizura-media-v1`의 배경·전경 파일도 넣고, 불러올 때 복원한다. 번들이 아닌 일반 프로젝트 JSON은 포크와 같이 설정만 담는다.
- 키 충돌: 기존 번들은 파일 묶음을 `p.media`에 담았는데 포크는 `project.media`를 배경 컷 설정으로 쓴다. 번들 키를 `p.bundle`(v2)로 바꾸고, `p.media`에 `files`가 있고 `items`가 없으면 구형 v1 번들로 읽는다.

## 3. C·D·E·F

- 포크의 `08_planner.js` 변경(영역 안에서 구성, 빈 컷, 경계 시각, 총 길이 `durationOverride`, 출력 크기)을 우리 플래너(간주·마무리 카드, 긴 간주 분할, 행별 후보, 음악 반응)에 합친다. 간주·마무리 카드도 타임라인 경계 드래그 대상이 되며, 빈 가사 컷과 같은 방식으로 다룬다.
- 행 overrides는 한 객체에 `area`(C), `lock`, 우리 후보 선택 필드가 함께 있을 수 있다. 어느 경로(리롤·다시 탭·AI 선택·행 삽입)에서도 다른 필드를 지우지 않는다.
- 실행 취소/다시 실행(E)은 포크의 프로젝트 스냅샷 방식(`U`) 하나로 통합하고 우리 가사·타이밍 전용 기록(`ED`, 「되돌리기」 버튼)은 없앤다(스냅샷이 그 기능을 포함). 우리 편집 동작(후보 선택, 이 행만 다시 탭, 소재 편집)도 자동으로 기록된다. 파일 본체(IndexedDB)는 기록하지 않으므로, 소재 삭제는 포크 미디어처럼 파일 삭제를 페이지를 떠날 때까지 미뤄 되돌릴 수 있게 한다.
- 합성 폰트·출력 크기(F)는 우리 한국어 폰트 목록(`02_fonts.js`)과 합친다.

## 4. A′ — 로컬 결정 모델

### 브라우저(`src/08c_jev.js` → 이름 유지, 문구·함수명은 `J.decideSuggest` / `J.applyDecide`)

- 요청 형식은 Jev와 같은 `{state, questions}`(`type: 'choice'`, `instructions`, `criteria`)를 유지한다. 한 요청에 최대 12행.
- 주소: 페이지가 `http://127.0.0.1:8765`·`http://localhost:8765`에서 열렸으면 `/api/decide`, 그 밖(우리 GitHub Pages, 파일로 연 경우)은 `http://127.0.0.1:8765/api/decide`.
- 버튼 「AI로 고르기(β)」와 「AI에게 추가 지시」 입력, 실패 시 현재 안 유지는 포크와 같다.

### 로컬 서버(`jev_server.py` → `decision_server.py`, 표준 라이브러리만)

- 앱 정적 파일을 제공하고 `POST /api/decide`를 받는다. CORS 허용 출처: 로컬 자신 + 우리 Pages 출처(`https://chynggi.github.io`).
- 환경변수:
  - `DECISION_BACKEND`: `systemone`(기본) 또는 `llm`
  - `DECISION_URL`: systemone 기본 `http://127.0.0.1:8000/v1/systemone`(laya-serve), llm 기본 `http://127.0.0.1:11434/v1/chat/completions`(Ollama)
  - `DECISION_MODEL`: llm 백엔드의 모델 이름(Tev1 파인튜닝 결과, Qwen 등)
  - `DECISION_API_KEY`: 있으면 `Authorization: Bearer`로 붙인다(laya-serve의 `LAYA_API_KEY`, TypeSafe 키 등)
- `systemone`: 요청을 그대로 전달하고 응답의 `answers`를 돌려준다. Laya(`laya-serve`, :8000), Kev(`python -m kev.serve`, :8009), TypeSafe Jev가 모두 여기에 붙는다.
- `llm`(Tev1 방식): 각 choice 질문을 아래 프롬프트로 바꿔 질문마다 한 번씩 호출한다(`temperature: 0`, `max_tokens: 2`, 생각 모드 끔). 답의 첫 글자를 선택지 키로 되돌려 `{type:'choice', choice:<key>}`로 모은다. 알 수 없는 글자면 그 질문만 빠진다(브라우저가 이미 무시함).

  ```
  State
  <state JSON>
  Question
  <instructions>
  Options
  A: <key>: <설명>
  B: ...
  Answer with one letter only.
  ```

- 요청 크기 64KB 초과는 413, 백엔드 실패는 502 + 한국어 오류 메시지.
- 테스트: `dev/decision_server_test.py`가 가짜 systemone·OpenAI 백엔드를 띄워 두 경로의 요청 변환·응답 변환·오류 처리를 확인한다.

### 문서·안내

- `docs/DECISION_GUIDE.md`(한국어): Laya·Kev·Tev1(+Ollama/llama.cpp) 각각의 실행 예와 환경변수 설정. Tev1은 가중치가 공개 번들되지 않아 레시피로 직접 파인튜닝해 OpenAI 호환 서버로 띄워야 한다는 점, Laya는 사전학습만 된 상태(zero-shot)의 정확도가 낮다는 점을 적는다.
- 이용 안내(README·앱의 「이용에 대하여」): 평소에는 브라우저 안에서만 처리하며, AI로 고르기를 쓰면 가사·곡명·아티스트·추가 지시가 사용자가 설정한 결정 서버로 전송된다(기본은 PC 안의 로컬 서버). 음성·이미지·동영상은 보내지 않는다.

## 5. 검증

- 포크 테스트 `dev/media_test.js`, `dev/new_features_test.cjs`, `dev/lyric_test.js`, `dev/jev_test.js`(이름·주소 변경 반영)를 통과시킨다.
- 기존 `dev/build_test.py`, `dev/smoke_all.py`, `tools/check_page_js.py`를 통과시킨다.
- `dev/decision_server_test.py`를 통과시킨다.
- `python3 build.py`로 `index.html`을 만들고 브라우저에서 확인한다: 배경·전경 컷 추가·재생·MP4 내보내기, 소재와의 겹침 순서, 표시 영역 편집, 경계 드래그, 실행 취소/다시 실행, 곡·소재 포함 저장→불러오기(미디어 포함), AI로 고르기(가짜 백엔드).
