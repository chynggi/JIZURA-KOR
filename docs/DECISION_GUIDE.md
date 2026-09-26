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

선택지 수: `llm` 방식은 선택지가 24개를 넘으면(예: 스타일 목록) 24개씩 나눠 묻고, 그 승자끼리 다시 묻는 토너먼트로 정합니다. Laya는 선택지가 20개 정도를 넘으면 정확도가 떨어지는 편입니다.

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

AI가 고르는 선택지는 지금 켜 둔 연출 범위를 따릅니다. 타이포·키네틱·호러 세트 스위치가 꺼진 부품은 선택지에서 빠지고, 「호러」 분위기는 호러 스위치를 켰을 때만 나옵니다. 테마를 골라 두면 그 테마 안에서만 고릅니다.

## 보내는 데이터

가사·곡명·아티스트·추가 지시와 선택지 목록을 `DECISION_URL`로 보냅니다. 기본값은 모두 내 PC 안(127.0.0.1)입니다. 음성·이미지·동영상은 보내지 않습니다. 고르기에 실패하면 현재 구성은 바뀌지 않습니다.

## 연결되지 않을 때

- `decision_server.py`와 결정 모델 서버가 둘 다 실행 중인지 확인합니다.
- 오류 문구에 나온 주소가 결정 모델 서버 주소와 맞는지 확인합니다.
- Pages 판에서 안 되면 <http://127.0.0.1:8765/>에서 씁니다.
