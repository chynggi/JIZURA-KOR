# 오리지널판 연출 가져오기 / Upstream effect integration

출처: https://github.com/852wa/JIZURA/commit/bae339e

## 2026-09-26

- 문자 PV 계열 50, 키네틱 51, 호러 52: 합계 153개 연출과 호러용 스타일 3개를 가져왔습니다.
- 문자 PV 계열·키네틱은 처음부터 ON, 호러는 처음에 OFF입니다. 연출 세트의 체크로 바꿀 수 있습니다.
- 기존 테마에는 각 연출의 분위기 태그에 맞춰 후보를 더했습니다. 호러 테마를 추가했고, 이 테마에서 자동 연출을 실행하면 호러 세트도 켜집니다.
- 한국어·영어 UI, 그리고 After Effects 대응 구현을 갱신했습니다.
- 연출과 필요한 의존 처리만 골라 가져왔습니다. 오리지널판 전체를 병합한 것은 아닙니다.

Imported 153 parts (50 typographic, 51 kinetic, 52 horror) and three horror styles. Typographic and kinetic sets default to on; horror defaults to off. Existing themes include matching mood-tagged parts. The new Horror theme enables the horror set when randomizing. Japanese and English UI labels and corresponding After Effects implementations are included. This is a selective effect integration, not a full upstream merge.
