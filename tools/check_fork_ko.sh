#!/bin/sh
# 병합으로 들어온 줄 중 가나(히라가나·가타카나)가 남은 UI 문구를 찾는다. 주석(//, /*, *)과 폰트 이름 줄은 제외.
cd "$(dirname "$0")/.."
git diff main -- src app/body.html ':!src/08c_jev.js' \
  | grep '^+' | grep -v '^+++' \
  | grep -P '[\x{3040}-\x{30FF}]' \
  | grep -vP '^\+\s*(//|/\*|\*)' \
  | grep -vP 'Noto (Sans|Serif) JP|font-family|family:' \
  | grep -vP 'jevPrompt|jev-action|Jevで作る|Jevを使うと|Jev が' \
  | grep -vP "return 'punctuation'" || true
  # 위 두 grep -v는 Task 2 범위 밖: (1) Jev 전용 UI 문구(jevPrompt 필드·힌트, jev-action 버튼·안내,
  #     jevOmakase의 상태 메시지)는 Task 6이 통째로 새로 쓴다.
  #     (2) src/02_fonts.js의 문장부호 판별 정규식(全角 약물 목록)은 문구가 아니라 문자 분류 데이터다.
