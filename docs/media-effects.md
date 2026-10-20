# 전경·배경 연출 / Media effects

전경·배경의 각 컷에서 기법·등장·퇴장을 독립적으로 선택합니다. 등장·퇴장의 초깃값은 「자동」입니다.

- **효과 없음**: 유지 중 모션·가공을 넣지 않습니다. 완전히 즉시 표시하려면 등장·퇴장도 「즉시(없음)」으로 설정합니다. 동영상 자체의 재생은 계속됩니다.
- **자동**: 상세 → 전경/배경에서 각각 활성화한 기법 중에서 고릅니다.
- **기법 이름**: 유지 중 모션·가공·전환을 고정합니다. 등장·퇴장은 따로 지정할 수 있습니다.

등장 55종·퇴장 55종과 유지 중 기법 146종(컷 간 전환·가사 카메라 포함)을 고를 수 있습니다. 상세 카테고리는 「등장」「퇴장」「카메라」「다이내믹 모션」「BPM 동기화」「색·질감」「분할·잔상·글리치」「컷 간 전환」입니다. 기존 마스크·출현 카테고리와 등장용 연출은 등장·퇴장으로 정리했습니다. 각 「자동」은 해당 카테고리의 활성화된 후보 중에서만 고르며, 후보가 없으면 즉시 표시가 됩니다. 상세 탭에서는 움직임 강도, 가공 강도, 등장·퇴장 시간(초)과 자동 선정에 포함할 기법을 설정할 수 있습니다. 상세의 「전경」「배경」 탭에서 각각 따로 설정할 수 있습니다. 자동 배치의 켜기·끄기도 따로 지정할 수 있습니다. 이전의 공통 설정은 두 레이어에 그대로 이어집니다.

각 기법의 ▶로 여는 연출 미리보기에는 움직임 강도·가공 강도·등장·퇴장 시간 슬라이더가 있습니다. 초깃값은 상세의 현재값이며, 바꿔도 미리보기에만 반영됩니다(프로젝트는 바뀌지 않습니다). 미리보기 아래에는 재생 위치를 나타내는 시크 바(표시 전용)가 있습니다. 등장 미리보기는 등장이 끝나고 약 1초 뒤에 반복합니다.

상세의 각 카테고리는 제목을 클릭해 접고 펼 수 있습니다. 제목에는 활성화된 기법 수／전체 수를 표시하며, 카테고리별로 「모두 켜기」「모두 끄기」「반전」으로 한꺼번에 바꿀 수 있습니다.

「자동으로 만들기」는 전경·배경 각각의 기법 체크를 독립적으로 무작위 설정합니다. 움직임·가공 강도, 등장·퇴장 시간, 자동 배치 설정은 유지됩니다. 바뀐 체크는 「실행 취소／다시 실행」「이전 안／다음 안」과 프로젝트 저장에 대응합니다.

각 탭의 「전경 섞기」「배경 섞기」는 대상 레이어만 다시 뽑습니다. 일반 셔플은 두 레이어의 자동 파일 컷을 모두 다시 뽑습니다. 셔플에서는 기법 체크가 유지됩니다. 명시적으로 고른 기법·효과 없음·잠긴 컷은 그대로 유지됩니다. 각 컷의 주사위는 그 컷을 자동으로 바꾼 뒤 다시 뽑습니다.

「무작위 순서로 삽입」은 파일이 2개 이상 있으면 컷 추가·삭제나 탭 동기화 이후에도 사용할 수 있습니다. 켜져 있는 동안에는 파일 목록에서 무작위 순서로 배정해 반복 표시합니다. 빈 컷과 잠긴 컷은 그대로 유지됩니다. 파일 개별 지정은 끄면 다시 사용할 수 있으며 원래 배정으로 돌아갑니다.

전경·배경의 「행과 컷」 위에 있는 「가사에 맞춰 일괄 삽입」으로 가사에 맞춘 파일 컷을 만들고 시작 프레임을 링크할 수 있습니다. 「일괄 삽입 기준」에서 「행에 맞추기」(초깃값) 또는 「컷에 맞추기」를 선택합니다. 행 단위에서는 각 행의 맨 앞, 컷 단위에서는 행 안의 분할·간주·무표시 컷을 포함한 링크 가능한 경계가 대상입니다. 자동 생성된 타이틀 카드는 대상에서 제외됩니다. 선택은 전경·배경별로 저장됩니다. 무작위 순서 OFF에서는 업로드 순서, ON에서는 무작위 순서로 배정합니다. 반복 OFF에서는 파일 수까지, ON에서는 파일을 반복해 대상 경계마다 만듭니다(최대 1000컷). 대상 레이어의 기존 컷과 그 링크는 교체되며, 「실행 취소」 한 번으로 복원할 수 있습니다. 전경·배경 양쪽에서 실행하면 가사를 포함한 3개 레이어의 시작 위치가 서로 링크됩니다. 컷 수 입력란은 없어졌으며, 개별 추가·삭제, 일괄 삽입, 탭 동기화로 컷을 만듭니다.

이전 프로젝트에서 개별 지정한 6개 항목은 「기존 설정」으로 유지됩니다. 다른 기법을 고르면 새 설정이 우선됩니다. 배치·크기는 수동 설정이 없으면 연출에 맞춰 자동으로 선정되며, 셔플로 바뀝니다. 가로세로 비율을 유지한 채 중앙·좌우·상하·네 모서리 등의 구도와 크기를 고릅니다. 배경의 자동 크기와 위치는 배경 배치 패턴(아래)으로 정해집니다. 수동 배치와 잠긴 배치는 그대로 유지됩니다. 「자동 배치로 되돌리기」로 다시 자동 선정할 수 있습니다. 상세의 「배치·크기에도 자동으로 변화를 줍니다」를 끄면 중앙 전체 표시로 돌아갑니다(수동 배치·잠금은 제외). 효과 없음과 기존 설정은 종전 그대로의 배치입니다. 동영상 반복 재생, 크로마키, 시작 시각은 기법과 독립적입니다. 전환은 인접한 파일 컷이 있을 때 적용됩니다.

## BPM 동기화

10종류(줌, 바운스, 스웨이, 궤도, 회전, 셰이크, 하트비트, 2박 호흡, 스텝, 페이드)를 추가했습니다. 「곡과 타이밍」의 BPM을 사용하며, 설정하지 않으면 120 BPM입니다. 박자 위치는 동영상 전체 시간과 박자 오프셋을 기준으로 하므로 컷마다 박자가 리셋되지 않습니다. 동영상 파일의 재생 속도는 바꾸지 않습니다. 등장·퇴장이나 수동 지정은 유지한 채 BPM 동기화 기법을 선택할 수 있습니다.

## 추가 변형(2차)

33종류를 추가했습니다. 각 컷의 기법 선택은 카테고리별로 표시됩니다.

| 카테고리 | 추가 내용 |
| --- | --- |
| 시네마·모션(8종류) | 아치 이동, 8자, 깊이 궤도, 스파이럴 착지, 슬링샷, 홉핑, 지그재그, 부메랑 |
| 마스크·출현(10종류) | 대각선 슬릿, 부채꼴, 크로스, 허니컴, 웨이브, 픽셀 흩날림, 동심원, 교차 셔터, 쉐브론, 대각선 모자이크 |
| 분할·잔상(10종류) | 웨이브 슬라이스, 줌 잔향, 4분할 미러, 필름스트립, 만화경, 미러 듀오, 위성, 픽셀 모자이크, 리본 분해, 색수차 분리 |
| 색·질감(5종류) | 잉크 실루엣, 그라데이션 톤, 네온 윤곽, 라이트 스윕, 도트 프린트 |

투명 파일·크로마키 처리 후의 동영상에도 사용할 수 있습니다. 마스크와 가공은 파일의 투명도를 이용해 그리며, 원본 동영상의 프레임 갱신에도 따라갑니다.

## 추가 변형(3차)

전경·배경에 공통으로 다음을 더했습니다. 모두 곡 테마(자동 연출의 테마) 후보에 반영되어 있습니다. 소재의 투명한 부분·크로마키로 뺀 부분은 채우지 않습니다.

| 분류 | 추가 내용 |
| --- | --- |
| 등장·퇴장(각 14종) | 떨어지며 튀기, 탄성 줌, 소용돌이, 일어나기(퇴장은 접기), 명멸, 셰이크, 고무 스냅, 시계 방향 리빌, 별 아이리스, 하트 아이리스, 랜덤 바, 붓터치, 물방울 리빌, 대각 스플릿 |
| 카메라(4종) | 켄 번스, 더치 앵글, 크레인 상승, 핸드헬드 |
| 다이내믹 모션(4종) | 롤링 횡단, 슬램 줌, 천천히 1회전, 3단 줌 |
| BPM 동기화(7종) | 비트 젤리, 킥 줌아웃, 박자마다 좌우 기울기, 박자마다 좌우 슬라이드, 4박 플립, 비트 반사 이동, 8박 빌드업 |
| 색·질감(8종) | 라이트 리크, 필름 그레인, 비네트, 색상 순환, 브라운관, 서모그래피, 소프트 블룸, 청사진 |
| 분할·잔상·글리치(6종) | 줌 터널, 타일 스크롤, 세로 웨이브 슬라이스, 스트로보 잔상, 띠 어긋내기, 유리 파편 |
| 컷 간 전환(5종) | 블라인드 연결, 슬립 어긋내기 연결, 모자이크 연결, 괘선 와이프 연결, 격자 넘김 연결 |

더한 전환은 기법으로 골랐을 때만 씁니다. 기존 설정 컷이 무작위로 고르는 전환 후보는 바뀌지 않습니다.
## 가사 카메라 재사용

상세 → 기법의 「카메라」(가사용 카메라워크 36종)를 전경·배경의 「카메라」에도 「카메라: ○○」로 더했습니다. 가사와 같은 움직임을 소재 틀에 맞춘 크기로 적용합니다. 박자에 맞추는 카메라는 가사와 같은 박(음원 분석 결과 또는 BPM 설정)을 씁니다. 움직임의 강도는 상세 → 전경/배경의 「움직임 강도」로 조절할 수 있습니다.

자동 선정의 초깃값은 가사 무작위 규칙을 따릅니다. 추가분·일본풍·부품 세트(호러 등) 설정으로 무작위 대상에서 빠진 카메라는 처음에 OFF입니다(수동으로는 항상 고를 수 있습니다). 곡 테마에서는 각 테마의 가사 카메라 후보가 전경·배경에도 쓰입니다.
## 장식 재사용

상세 → 전경/배경의 「장식을 켜기」(초깃값: OFF)를 ON으로 하면 기법이 「자동」인 이미지·동영상 컷에 상세 → 기법의 「장식」을 붙입니다. 후보는 상세 → 전경/배경의 「장식」 칸에서 전경·배경별로 체크할 수 있고(초깃값은 소재 앞에 그리는 장식이 ON, 뒤쪽 장식이 OFF), 무작위 규칙(추가분·일본풍·부품 세트)도 따릅니다. 컷마다 1~2개를 고릅니다. 「자동 연출」에서는 장식 체크도 무작위로 설정하고, 곡 테마에서는 테마의 장식 후보를 반영합니다. 섞기로 바뀌고, 잠근 컷에서는 유지됩니다. 수동으로 고른 기법·연출 없음·기존 설정 컷에는 붙이지 않습니다.

장식은 소재의 틀을 가사 표시 범위로 보고 그리며, 소재와 같은 움직임·마스크·가공이 걸립니다. 컷의 상세 편집 「장식」에서 어떤 컷에도 수동으로 더하거나 뺄 수 있습니다(뒤쪽 장식은 소재 아래에 그리므로 투명 소재에서 쓸 수 있습니다). 연출 복사·붙여넣기 대상에도 들어갑니다.
## 컷 마스크

컷의 상세 편집 「마스크」(초깃값: 끔)로 전경·배경·가사 컷을 마스크할 수 있습니다. 기준 이미지 위에 도형(원·사각·둥근 사각·삼각·마름모·오각·육각·별·하트)을 놓고, 도형 안쪽을 끌어 이동, 모서리 핸들로 확대·축소, 도형 둘레를 끌어 회전(Shift로 15° 단위)할 수 있습니다. 숫자로도 모양·위치·크기·각도를 지정할 수 있고, 「가로세로 비율 고정」(초깃값: ON)으로 비율을 유지합니다. 도형의 겹침은 합으로 표시 범위가 됩니다. 「마스크 반전」으로 도형 바깥을 표시합니다.

- **마스크 대상: 소재** 전경·배경은 소재 이미지를 기준으로 소재 자체를 마스크하고, 마스크한 소재에 연출·이펙트가 걸립니다. 가사는 표시 범위를 기준으로 마스크하고 카메라 같은 연출과 함께 움직입니다.
- **마스크 대상: 컷** 화면 전체를 기준으로 연출·이펙트를 적용한 뒤의 컷을 마스크합니다. 전경을 마스크한 부분에는 아래 레이어가 보입니다.

마스크 안의 「모션」으로 도형에 전경·배경과 같은 움직임을 줄 수 있습니다(기법: 카메라·다이내믹 모션·BPM 동기화 움직임, 등장·퇴장, 움직임 강도, 등장·퇴장 시간. 초깃값은 모두 「없음」). 움직임은 컷 구간에 맞춰 붙고, 와이프나 아이리스 같은 등장·퇴장은 마스크 모양으로 작동합니다. 페이드는 마스크의 진하기가 바뀝니다.

마스크는 표시 범위처럼 모양 설정이므로 연출 복사·붙여넣기 대상이 아니고, 붙여넣을 곳의 마스크를 유지합니다.
## 자동 배치의 구도

전경의 자동 배치는 화면 전체의 균형을 맞춘 구도(좌우 분할·상하 분할·네 모서리·작은 창·주역·아주 작은 액센트·화면을 덮는 거대 배치·삼분할·가운데 작게 등 20종)에서 고릅니다. 구도마다 전경의 위치·크기 범위와 가사를 둘 구역이 정해지고, 아주 작음부터 거대함까지의 크기 차이는 구도 자체가 만듭니다(상세의 최소·최대 크기 배율 수동 설정은 없앴습니다). 소재에 「잘린 변」을 설정한 전경은 그 변을 화면 끝에서 잘라내는 전용 구도에서 고릅니다. 1변은 가운데·위쪽·아래쪽·거대·살짝만 보이기 5종, 이웃한 2변은 모서리에 놓기·모서리에서 크게·모서리에서 살짝 보이기 3종입니다. 마주 보는 2변은 화면을 가로지르는(세로로 꿰는) 띠가 되고, 3변·4변도 잘리는 변에 맞춰 놓습니다. 가사는 비어 있는 쪽 구역에 두고, 띠가 소재의 가로세로 비율로 두꺼워지면 전경이 비운 가장 넓은 곳을 구역으로 합니다. 바로 앞 컷과 같은 구도는 잇달아 쓰지 않고, 섞기·자동 연출 때마다 구도가 바뀝니다.

가사의 자동 배치(상세 → 기법의 「가사 위치와 크기를 자동으로 변화」)에서는 삼분할선이나 여백에 맞춘 후보 중에서 구도의 가사 구역에 들어가고 전경 반대쪽에서 균형을 이루는 위치를 고릅니다. 겹침 회피가 ON이면 전경과 겹치지 않는 위치를 우선하고(강도도 반영), 둘 수 없으면 빈 영역으로 줄여 배치합니다. 크기 표기(예: 30:가사)의 크기는 그대로 쓰고 위치만 정리합니다. 「화면 가운데를 피하기」(간편 모드의 「가사가 화면 가운데를 피하기」와 같은 설정)가 켜져 있을 때는 *강조* 외의 가사를 화면 가운데에 두지 않고, 위아래 띠·좌우 열 같은 구역과 띠·좌우 열·네 모서리·L자 등 가운데를 비운 배치를 씁니다. 전경이 없는 장면은 가운데·아래·위·좌우·대각·띠·기둥·전면 등 10종의 구역에서 고르고, 구역마다 작음·중간·큼의 크기 경향을 붙입니다. 가사 표기의 강조(\*…*\)는 크게, 억제(\~…~\)는 작게 표시합니다. 강조는 가운데·전면·띠 구역을 큰 채로 쓰고, 억제는 위아래나 모서리 구역에 작게 둡니다. 억제라도 표시 범위는 화면 너비 30%·높이 17% 아래로 내려가지 않고, 전경의 빈 곳이 모자라면 줄이지 않고 가장 겹침이 적은 위치에 둡니다(자동 배치에서는 글자의 0.7배 축소를 겹치지 않습니다). 전경이 있는 장면의 강조는 전경에 겹쳐 크게 앞에 표시하는 배치, 또는 전경 반대쪽에서 크게 균형을 맞추는 배치가 되고, 구도의 가사 구역으로는 줄이지 않습니다. 강조 가사와 겹치는 전경은 약 4할 확률로 전경도 가사도 크게 표시하는 구도(큰 전경 위에 큰 가사를 앞에 겹치는)가 됩니다. 여러 가사의 배치에서도 강조는 크게, 억제는 작은 틀이 됩니다. 가사의 자동 배치가 OFF일 때는 강조를 1.15배, 억제를 0.7배 글자 크기로 표시합니다. 전경이 있는 장면에서는 겹치지 않고 1장면의 여러 가사를 구도의 가사 구역을 우선해 배치합니다. 전경이 없는 장면에서는 여러 가사를 디자인된 배치(대각 계단·지그재그·캐스케이드·앞/끝을 주역·엇갈린 2열·흩뿌리기·물결·세로 쌓기·피라미드·방사·대소 대비·액자 등 16종)로 크기에 기복을 주어 배치합니다. 겹치지 않는 1장면은 겹치지 않고(겹침 회피의 강도를 반영), 1장면은 가사의 자동 배치가 ON일 때 겹쳐 표시할 여지를 남기면서(작은 쪽 면적의 1/3까지) 흐름 있는 배치로 합니다. 배치는 섞기·자동 연출·재배치 때마다 바뀌고, 수동 표시 범위는 유지합니다. 배경은 배치 패턴(전체 표시·화면 채우기·가운데 줌·좌우상하로 붙기·대각으로 붙기·디테일 확대·삼분할로 붙기 11종)에서 고르고, 어떤 패턴도 화면 끝이 비지 않는 범위에서 확대·이동합니다. 바로 앞 컷과 같은 패턴은 잇달아 쓰지 않고, 재배치·섞기로 바뀝니다. 수동 배치와 잠금은 바뀌지 않습니다.
## English

Choose a main technique, **Entrance**, and **Exit** independently on each foreground/background cut. Entrance and Exit default to **Auto**. **No effects** disables the main motion/treatment; choose **Instant (none)** for both phases too to display the file instantly. Videos continue playing normally. Each automatic phase uses only its enabled category; an empty pool means Instant. Explicit selections and locked phases survive shuffle.

The effect preview (▶) has Motion intensity, Treatment intensity and Entrance / exit sliders. They start from the current Details values and change the preview only, not the project. A display-only seek bar shows the playback position, and entrance previews replay about one second after the entrance finishes.

Click a category heading in Details to expand or collapse it. Headings show the enabled/total technique count. Each category has **Enable all**, **Disable all**, and **Invert** controls.

**Randomize** chooses a random set of checked techniques independently for foreground and background. It preserves motion/treatment intensity, entrance/exit duration, and automatic placement settings. The selections support Undo/Redo, Previous/Next variation, and project saving. **Shuffle** keeps the checked set and rerolls the automatic cuts within it.

**Details → Foreground / Background** contains 55 entrances, 55 exits, and 146 main techniques (including transitions and lyric cameras). Categories are Entrance, Exit, Camera, Dynamic motion, BPM sync, Color/texture, Panels/echoes/glitch, and Cut transitions. Existing reveal effects have moved into the phase categories. Adjust motion and treatment intensity, entrance/exit duration, and the techniques included in Auto. Each layer has its own settings, including automatic placement. Previously shared settings are copied to both layers when an older project is opened.

**Shuffle foreground** and **Shuffle background** reroll automatic cuts only in the corresponding layer. The main Shuffle button still rerolls both layers. Explicit selections and locked cuts are preserved. A cut's dice button switches it to Auto and rerolls it. Existing projects keep their individual settings as **Legacy settings** until a new technique is selected. With automatic placement enabled, effect cuts without manual placement vary their position and size on shuffle, preserving the source aspect ratio. Automatic background size and position follow the background framing patterns (see below). Manual placement and locked cuts stay fixed. Use Reset automatic placement to return a manually placed cut to automatic composition. Disable Vary position and size automatically in Details to keep automatic cuts centered at full fit. No effects and Legacy settings retain their original framing. Video looping, chroma key, and timing remain independent of technique selection. Transitions apply between adjacent media cuts.

**BPM sync** adds ten motions: zoom, bounce, sway, orbit, turn, shake, double heartbeat, two-beat breathing, steps, and fade. They use the configured BPM, falling back to 120 when unset. The global timeline and beat offset keep beats aligned across cuts. Source video playback speed is unchanged.

The second pack adds 33 techniques: 8 camera/motion variations, 10 masks/reveals, 10 panel/echo effects, and 5 color/texture treatments. Per-cut choices are grouped by category. New effects support transparent assets and live video frames; selection is deterministic for the same seed.

The third pack adds, for both foreground and background: 14 entrances and 14 matching exits (drop and bounce, elastic zoom, swirl, fold up, flicker, shake, rubber snap, clock reveal, star iris, heart iris, random bars, brush strokes, polka-dot reveal, diagonal split); 4 camera moves (Ken Burns, Dutch angle, crane up, handheld); 4 dynamic motions (roll across, slam zoom, slow full turn, three-step zoom); 7 BPM motions (jelly, kick zoom out, tilt, side slide, four-beat flip, wall bounce, eight-beat build-up); 8 textures (light leak, film grain, vignette, hue cycle, CRT scanlines, thermal, soft bloom, cyanotype); 6 panel effects (zoom tunnel, tile scroll, column wave, strobe echoes, band shift, glass shards); and 5 transitions (blinds, slice shift, pixelate, rule wipe, grid cells). All of them are included in the curated themes. Transparent and chroma-keyed areas stay transparent. The new transitions are used only when selected as a technique; random transitions for legacy cuts are unchanged.

The 36 lyric cameras (Details → Techniques → Camera) are also available as **Camera: …** techniques under Camera for the foreground and background. They move with the media frame, follow the same beats as the lyrics, and scale with Motion intensity. By default, Auto uses the cameras that lyric random picks may use (Extra parts, Japanese motifs and part sets such as Horror); the others start unchecked but can always be chosen by hand. Themes share their lyric camera pool with both media layers.

**Automatic composition.** Automatic foreground placement picks a balanced composition (left/right split, top/bottom split, corners, inset, hero, tiny accents, giant frame-fillers, thirds, small centre; 20 in total). Each fixes the foreground's slot, its size range and the zone for the lyrics, so the contrast between tiny and giant comes from the compositions themselves (the manual minimum/maximum size settings were removed); sources with cropped edges (見切れ辺) instead use compositions built around those edges, bleeding off the stage there: five for a single edge (middle, high, low, giant, peek), three for two adjacent edges (corner, big corner, corner peek), and a band across the stage for opposite edges, with the lyric zone on the free side (when a band grows with the source's aspect ratio, the largest strip it leaves free); consecutive cuts never repeat a composition, and Shuffle / Randomize bring new ones. Automatic lyric placement then chooses among positions aligned to the thirds and margins, scored for that zone, balance against the foreground and, with avoidance on, no overlap (weighted by the avoidance strength; if nothing fits, the lyric shrinks into free space). A size notation such as `30:` keeps its size and only the position is composed. With **Avoid the centre of the stage** (the same setting as Easy mode's **Keep lyrics out of the centre**), lyrics other than *emphasis* stay out of the middle, using the top and bottom bands, side columns and centre-free arrangements (bands, side columns, corners, an L shape). Lyric-only scenes use 10 zones (centre, lower, upper, sides, diagonals, band, column, full) each with a small/medium/large size tendency. Emphasis (`*…*`) is shown large and suppression (`~…~`) small: emphasis keeps its size in the centre, full or band zones, suppression sits small near the edges and corners but never below 30% × 17% of the stage (with too little free space it takes the least covered position rather than shrinking, and its automatic area is not reduced again by the 0.7× text scale). With a foreground, an emphasised lyric is either laid large over the foreground (drawn in front of it) or balances it large from the opposite side, never shrunk into the composition zone; about 40% of foregrounds shown with an emphasised lyric instead use a both-large composition (a large foreground with a large lyric in front of it); designed arrangements also give emphasis a larger cell and suppression a smaller one. With automatic lyric placement off, emphasis uses 1.15× and suppression 0.7× text size, and non-overlapping groups pack into the composition zone first when a foreground is shown. Without a foreground, several lyrics use a designed arrangement (diagonal steps, zigzag, cascade, hero first/last, staggered columns, scatter, wave, stack, pyramid, radial, big-and-small, frame; 16 in total) with a rhythm of sizes: non-overlapping groups never overlap (blended by the avoidance strength), and shared scenes with automatic lyric placement flow along the arrangement while still overlapping by up to a third of the smaller area. Arrangements change with Shuffle, Randomize and Re-layout; manual areas are kept. Backgrounds use 11 framing patterns (whole, fill, centre zoom, pushes to each side, diagonal corners, close-up detail, thirds), always zooming and panning without exposing an edge and never repeating the previous cut's pattern; Re-layout and Shuffle change them. Manual placements and locks are unchanged.

**Cut masks** (Mask in the cut details, off by default) work on foreground, background and lyric cuts. Place shapes (circle, rectangle, rounded rectangle, triangle, diamond, pentagon, hexagon, star, heart) on a reference image: drag inside to move, drag the corner handle to resize, drag around the shape to rotate (Shift snaps to 15°), or type shape, position, size and angle. **Lock aspect ratio** (on by default) keeps the proportions. Overlapping shapes add up to the visible area, and **Invert mask** shows the outside instead. With **Source** as the mask target, media masks the source image itself, so techniques and effects apply to the masked source, while lyrics are masked within their display area and move with the camera. With **Cut**, the finished cut is masked after its effects, relative to the whole stage; masked parts of the foreground reveal the layers below. **Motion** inside the mask moves the shapes like a foreground/background cut: a technique from Camera, Dynamic motion or BPM sync, an entrance, an exit, motion intensity and entrance/exit duration (all None by default). The motion is timed over the cut; reveal entrances/exits such as wipes and irises shape the mask, and fades change its strength. Like the display area, masks are shape settings: effect copy/paste leaves the target's mask as it is.

**Enable decorations** in Details → Foreground / Background (off by default) adds lyric decorations from Details → Techniques to Auto image and video cuts. One or two decorations are chosen per cut from the layer's own Decoration group in Details → Foreground / Background (front decorations on and back ones off by default) and the random rules (Extra parts, Japanese motifs, part sets); they change with Shuffle and stay on locked cuts. Randomize also randomizes the decoration checks, and themes apply their decoration pool. Explicit techniques, No effects and Legacy settings stay plain. Decorations use the media frame as their display area and follow its motion, masks and treatments. Add or remove them on any cut under Decoration in the cut details (back decorations sit under the source, so they suit transparent assets); effect copy/paste includes them.

Random order remains available after adding/removing cuts or tap sync when at least two files are uploaded. While enabled, media is assigned in a seeded shuffled cycle; blank and locked cuts are preserved. Turn it off to restore the underlying assignments and select files individually.

Use **Insert cuts aligned to lyrics**, above **Lines and cuts** in the Foreground or Background source tab, to create linked media cuts. Choose **Lyric lines** (default) or **Lyric cuts** under **Align inserted cuts to**. Line mode uses line starts; cut mode includes inner lyric cuts, interludes, and blank cuts. Automatically generated title cards are excluded. Each layer saves its own choice. Files follow upload order or Shuffle order. With Loop cuts off, each file is used once; with it on, files repeat across the selected boundaries (up to 1000 cuts). This replaces the selected layer's cuts and links; one Undo restores them. Run it for both layers to link foreground, lyrics, and background together. The cut-count input has been removed; use individual add/remove buttons, bulk insertion, or tap sync to create cuts.
