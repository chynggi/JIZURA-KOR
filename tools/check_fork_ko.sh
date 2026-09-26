#!/bin/sh
# 병합으로 들어온 줄 중 한국어로 옮기지 않은 UI 문구를 찾는다. usage: tools/check_fork_ko.sh [BASE=main]
cd "$(dirname "$0")/.."
BASE="${1:-main}"
# src/08c_jev.js: 이미 제거된 기능(Jev)의 잔여 코드라 문구 번역 대상이 아니다(기존 허용 목록).
added() { git diff "$BASE" -- src app/body.html ae ':!ae/data.json' ':!src/08c_jev.js' | grep '^+' | grep -v '^+++' | grep -vP '^\+\s*(//|/\*|\*)'; }
# 정당한 비-UI 줄(문구가 아니라 데이터·코드): 문자 분류용 전각 약물 정규식, 가사 언어 판별용 무작위 글자 풀
# (일본어/번체/간체/한국어/영어를 모두 갖추고 있으며 한국어 풀도 이미 포함), 로마자 변환·작은 가나 판정 같은
# 가사 판별 헬퍼, 글자가 없을 때 쓰는 대체 글자('字')·장식용 가운뎃점('・') 같은 표시되지 않는 기본값.
nonui() {
  grep -vP "return 'punctuation'" \
    | grep -vP "aty_isSmall|aty_isLatinT|aty_roma\(|AHR_KANA|romaOf = t =>|const rj = J\.romaji\(raw\)|charCodeAt\(0\) - 0x60" \
    | grep -vP "\|\| '字'|ch: '・'|J\.pool\('kana'\) \|\| 'あいうえお'|^\+const KANA = 'あいうえお" \
    | grep -vP "kana: 'アイウエオ|half: 'ｱｲｳｴｵ|reel: '夢光影空|scramble: 'アイウエオ|signs: 'アイウエオ|'zh-Hant': \{ kana:|'zh-Hans': \{ kana:|^\+const ZH_T = |^\+const ZH_S = |^\+var JZ_POOLS = \{"
}
# 1) 가나
added | nonui | grep -P '[\x{3040}-\x{30FF}]' | grep -vP 'Noto (Sans|Serif) JP|font-family|family:' || true
# 2) 한자만(한글·가나 없음) 들어간 따옴표 문자열
added | nonui | grep -vP '[\x{AC00}-\x{D7A3}\x{3040}-\x{30FF}]' | grep -P "['\"\`][^'\"\`]*[\x{4E00}-\x{9FFF}][^'\"\`]*['\"\`]" | grep -vP 'Noto|字面|family' || true
