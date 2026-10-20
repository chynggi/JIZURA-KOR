/* Display names for effect-specific detail parameters (shared by all layouts): key|Korean|English. */
(() => {
'use strict';
const names = {};
for(const line of `
accentIdx|강조 위치|Accent position
accentN|강조 개수|Accent count
cls|분류|Category
ctx|그리기 영역|Drawing context
cx|중심 가로 위치|Center X
cy|중심 세로 위치|Center Y
diag|대각선|Diagonal
dims|치수|Dimensions
fl|왼쪽 보조값|Left factor
fm|가운데 보조값|Middle factor
fo|바깥쪽 보조값|Outer factor
fr|오른쪽 보조값|Right factor
fulc|받침점|Fulcrum
fx|연출|Effects
g1|첫째 간격|First gap
g2|둘째 간격|Second gap
glass|유리|Glass
grade|농담|Gradation
guide|가이드|Guide
guides|가이드 목록|Guides
hc|제목 색|Heading color
id|종류|Type
key|식별 이름|Identifier
kicker|작은 제목|Subheading
lab|라벨 설정|Label settings
lam|빛의 세기|Light amount
link|연결|Connection
main|주요 요소|Main element
marquee|흐르는 글자|Marquee
mods|변화 설정|Modifiers
motion|움직임 강도|Motion amount
name|이름|Name
nl|행 수 보조값|Line count factor
pen|붓 굵기|Pen width
pick|선택 방식|Selection mode
piece|조각|Piece
plus|추가량|Additional amount
rim|가장자리|Rim
schemes|배색 목록|Color schemes
scr|화면 설정|Screen settings
seg|분할 수|Segment count
sep|구분자|Separator
shots|연속 표시 수|Shot count
sign|간판|Sign
slash|사선|Slash
sleeve|덮개|Sleeve
sq|정사각형|Square
stack|겹치는 방식|Stacking
stagger|시간차|Delay
sweep|쓸어 가는 움직임|Sweep
table|표|Table
tag|태그|Tag
tail|끝부분|Tail
take|꺼낼 개수|Item limit
tc|글자색 보조값|Text color factor
tie|연결 부분|Tie
tombo|재단 표시|Crop marks
tread|발자국|Tread
tube|통|Tube
tune|조정값|Adjustment
turb|난류 세기|Turbulence
under|밑줄|Underline
vcols|세로쓰기 열|Vertical columns
vol|양|Amount
was|이전 상태|Previous state
wedge|쐐기|Wedge
win|창|Window
zip|여닫는 세기|Opening amount
drawing|자체 그리기|Custom drawing
note|루비·주석|Ruby / note
fonts|역할별 글꼴|Font roles
fontParams|레이아웃 안 글꼴|Layout fonts
effectStyle|질감·색 어긋남|Texture / color shift
independentPhases|등장·퇴장을 따로 적용|Independent entrance / exit
display|제목용|Display
body|본문용|Body
serif|명조체용|Serif
mono|고정폭 글자용|Monospace
texture|질감 세기|Texture amount
grain|입자 노이즈|Film grain
paper|종이 질감|Paper texture
scan|주사선|Scan lines
ghost|색 어긋남 배율|Color shift multiplier
glow|빛 번짐|Glow
useGrad|그러데이션 사용|Use gradient
glitch|글리치 세기|Glitch amount
chroma|색 어긋남 세기|Color shift amount
koma|움직임 갱신 횟수(초당)|Animation steps per second
right|오른쪽에 배치|Place on right
low|아래쪽에 배치|Place lower
corner|모서리에 배치|Place in corner
big|크게 표시|Large display
mode|표시 방식|Display mode
from|시작값|Starting value
to|끝값|Ending value
v|변형|Variation
r|회전·변화량|Rotation / variation
n|개수|Count
sx|가로 배율|Horizontal scale
sy|세로 배율|Vertical scale
ox|가로 오프셋|Horizontal offset
oy|세로 오프셋|Vertical offset
dx|가로 이동량|Horizontal displacement
dy|세로 이동량|Vertical displacement
x|가로 위치|Horizontal position
y|세로 위치|Vertical position
s|크기 배율|Size multiplier
fs|글자 크기|Font size
ang|각도|Angle
rot|회전 각도|Rotation angle
rotAmp|회전 진폭|Rotation amplitude
rots|회전 각도 목록|Rotation angles
amp|강도|Strength
spd|속도|Speed
freq|주파수|Frequency
phase|위상|Phase
ph|위상 차|Phase offset
seed|무작위 시드|Random seed
track|자간|Letter spacing
gap|간격|Gap
pad|여백|Padding
margin|여백|Margin
cols|열 수|Column count
rows|행 수|Row count
rowsN|행 수|Row count
col|열|Column
row|행|Row
dir|방향|Direction
align|정렬|Alignment
orient|방향|Orientation
vertical|세로쓰기|Vertical text
vert|세로 방향|Vertical
vertNote|주석을 세로쓰기로|Vertical annotation
rtl|오른쪽에서 왼쪽으로|Right to left
tate|세로쓰기|Vertical text
unit|글자 묶음|Text unit
units|글자 단위 설정|Text units
chunks|가사 묶음|Lyric chunks
msgs|메시지 목록|Messages
text|텍스트|Text
lines|행 목록|Lines
line|선|Line
widths|너비 목록|Widths
fontBig|큰 글자 글꼴|Large text font
fontSmall|작은 글자 글꼴|Small text font
fontB|보조 글자 글꼴|Secondary font
fontC|가운데 글자 글꼴|Center font
fontH|제목 글꼴|Heading font
fontL|라벨 글꼴|Label font
bigFont|큰 글자 글꼴|Large text font
capFont|캡션 글꼴|Caption font
edgeFont|가장자리 글자 글꼴|Edge font
fillFont|채운 글자 글꼴|Fill font
markFont|마크 글꼴|Mark font
numFont|숫자 글꼴|Number font
sealFont|도장 글꼴|Seal font
tileFont|타일 글자 글꼴|Tile font
font|글꼴|Font
sf|보조 글자 크기|Secondary font size
hf|제목 글자 크기|Heading font size
nf|숫자 글자 크기|Number font size
gf|배경 글자 크기|Background font size
qf|인용 글자 크기|Quote font size
rf|루비 글자 크기|Ruby font size
df|제목 글자 크기|Display font size
fb|굵은 글꼴|Bold font
fc|가운데 글자 크기|Center font size
fg|글자색|Text color
bg|배경색|Background color
sub|보조 글자색|Secondary color
accent|강조|Accent
accent2|강조색 2|Accent color 2
ink|장식색|Decoration color
dim|배경 글자색|Background text color
ghostA|색 어긋남 A|Color shift A
ghostB|색 어긋남 B|Color shift B
grad|그러데이션|Gradient
swap|색 바꾸기|Swap colors
fill|채우기|Fill
fillMode|채우는 방식|Fill mode
outline|윤곽선|Outline
outlineK|윤곽선 배율|Outline multiplier
shadow|그림자|Shadow
shape|도형|Shape
small|작게 표시|Small display
smallK|작은 글자 배율|Small text multiplier
smalls|작은 글자 목록|Small text items
wide|가로로 넓히기|Wide
thin|가는 선|Thin lines
tilt|기울기|Tilt
tilts|기울기 목록|Tilts
slant|비스듬한 기울기|Slant
lean|글자 기울기|Text lean
stretch|늘이고 줄이기|Stretch
squash|찌그러짐|Squash
ratio|비율|Ratio
asp|가로세로 비율|Aspect ratio
anchor|기준점|Anchor
center|가운데에 배치|Center placement
centre|중심점|Center point
inner|안쪽 양|Inner amount
outer|바깥쪽 양|Outer amount
edge|가장자리 양|Edge amount
pos|위치|Position
place|배치|Placement
side|측면|Side
side0|시작 측|Starting side
top|위쪽에 배치|Place on top
up|위 방향|Upward
back|뒷면|Back
front|앞면|Front
start|시작|Start
end|끝|End
first|맨 앞|First
last|맨 끝|Last
at|나타나는 위치|Appearance position
pause|정지 시간|Pause duration
period|주기|Period
rate|변화율|Rate
tempo|템포|Tempo
speed|속도|Speed
step|단계|Step
span|범위|Span
spread|퍼짐|Spread
travel|이동 거리|Travel distance
orbit|공전|Orbit
radius|반지름|Radius
arc|호의 양|Arc amount
arm|팔 길이|Arm length
angle|각도|Angle
half|절반으로|Half
flip|뒤집기|Flip
flips|뒤집기 설정 목록|Flip settings
rev|역방향|Reverse
inv|반전|Invert
dbl|이중으로|Double
two|두 개 표시|Two items
alt|번갈아 표시|Alternating
order|순서|Order
idx|항목 번호|Item index
num|숫자|Number
num0|시작 번호|Starting number
count|개수|Count
cnt|개수|Count
per|한 묶음 개수|Items per group
perCol|한 열 개수|Items per column
every|반복 간격|Repeat interval
len|길이|Length
life|수명|Lifetime
peak|정점|Peak
peaks|정점 목록|Peaks
copies|복제 수|Copy count
copy|복제|Copy
extra|추가 요소|Extra element
extras|추가 요소 목록|Extra elements
ant|예고|Anticipation
acc|가속도|Acceleration
jitter|떨림|Jitter
jit|떨림 양|Jitter amount
jerk|급한 움직임|Jerking motion
wob|흔들림 폭|Wobble
breathe|숨 쉬는 움직임|Breathing
sway|좌우 흔들림|Sway
swing|진자 운동|Swing
spin|회전|Spin
turn|선회|Turn
twist|비틀림|Twist
swirl|소용돌이|Swirl
ripple|물결|Ripple
wave|파도|Wave
rise|상승|Rise
fall|낙하|Fall
drift|떠다님|Drift
hop|튀는 움직임|Hop
kick|튕겨 나감|Kick
knock|충격|Impact
burst|방사|Burst
explode|폭발|Explosion
shoot|튀어나옴|Launch
shrink|축소|Shrink
grow|확대|Grow
lift|들어 올림|Lift
sink|가라앉음|Sink
roll|구름|Roll
rpm|회전 속도|Rotation speed
pitch|세로 회전|Pitch
yaw|가로 회전|Yaw
persp|원근감|Perspective
dist|거리|Distance
strength|세기|Strength
clear|투명화|Clear
crop|잘라내기|Crop
split|분할|Split
slice|슬라이스|Slice
slices|슬라이스 수|Slice count
tile|타일|Tile
cell|셀 크기|Cell size
grid|격자|Grid
stripe|줄무늬|Stripes
band|띠|Band
bar|막대|Bar
box|테두리 상자|Box
frame|틀|Frame
round|둥글기|Roundness
sharp|날카로움|Sharpness
blur|흐림|Blur
flicker|깜빡임|Flicker
flash|섬광|Flash
flick|어른거림|Flick
beam|광선|Beam
leak|빛 새기|Light leak
fog|안개|Fog
mist|연무|Mist
dust|먼지|Dust
motes|떠다니는 입자|Floating particles
spark|불꽃|Spark
debris|파편|Debris
stains|얼룩|Stains
scratch|긁힌 자국|Scratch
dark|어두움|Darkness
red|붉은 기|Red tint
tint|색조|Tint
tone|색감|Tone
shade|음영|Shade
opacity|불투명도|Opacity
bgText|배경 글자|Background text
header|헤더|Header
head|제목|Heading
cap|캡션|Caption
caps|대문자 표시|Uppercase
label|라벨|Label
labels|라벨 목록|Labels
legend|범례|Legend
info|정보|Information
desc|설명|Description
meta|보조 정보|Metadata
attrib|출처|Attribution
quote|인용|Quote
word|단어|Word
letter|글자|Letter
latin|알파벳|Latin letters
condensed|글자를 세로로 길게|Condensed text
seal|도장|Seal
stamp|스탬프|Stamp
stampAng|스탬프 각도|Stamp angle
mark|마크|Mark
marks|마크 목록|Marks
markC|마크 색|Mark color
lineC|선 색|Line color
rule|괘선|Rule
rules|괘선 목록|Rules
rail|레일|Rail
rails|레일 목록|Rails
rings|링 수|Ring count
dots|점 개수|Dot count
dot|점|Dot
ticks|눈금|Ticks
spikes|돌기|Spikes
lobes|곡선 봉우리 수|Curve lobes
pips|작은 점|Pips
pin|핀|Pin
pinch|잘록함|Pinch
spot|스폿|Spot
fold|접힌 자국|Fold
pleats|주름|Pleats
cloth|천|Cloth
stitch|바느질 자국|Stitch
thread|실|Thread
tape|테이프|Tape
trim|테두리|Trim
tear|찢어진 틈|Tear
torn|찢김|Torn
drape|늘어짐|Drape
trail|잔상|Trail
tracks|궤적|Tracks
flow|흐름|Flow
wind|바람|Wind
rain|비|Rain
drops|물방울|Drops
drips|흘러내림|Drips
sun|해|Sun
mount|산|Mountain
floor|바닥|Floor
shell|껍데기|Shell
plate|판|Plate
panel|패널|Panel
page|페이지|Page
page0|시작 페이지|Starting page
folio|쪽 번호|Page number
serial|일련번호|Serial number
issue|호수|Issue number
mast|제호|Masthead
books|책 설정|Books
covers|표지|Covers
rack|선반|Rack
posts|기둥|Posts
doors|문|Doors
lamps|조명|Lights
cat|고양이|Cat
cats|고양이 목록|Cats
eye|눈|Eye
face|얼굴|Face
hand|손|Hand
mainHand|주된 손|Main hand
handle|손잡이|Handle
joint|관절|Joint
art|그림|Artwork
img|이미지|Image
hero|주인공|Hero
emblem|문장|Emblem
motif|무늬|Motif
scene|장면|Scene
style|표시 스타일|Display style
variant|변형|Variant
rowStyle|행 표시 방식|Row style
look|모습|Appearance
reveal|드러남|Reveal
peek|엿보기|Peek
chase|쫓는 움직임|Chase
pulls|당기는 힘|Pulls
prompt|입력 안내|Prompt
sugg|후보 글자|Suggested text
wrong|틀린 글자|Wrong text
decoys|가짜 글자|Decoy text
clue|힌트|Clue
bug|흐트러짐|Distortion
codes|코드 글자|Code text
nums|숫자 목록|Numbers
price|가격 표시|Price display
score|점수|Score
rank|순위|Rank
rk|순위 설정|Rank settings
val|값|Value
value|값|Value
level|단계|Level
lvl|단계|Level
day|일|Day
days|일수|Days
month|월|Month
mon|월 표시|Month display
hour|시|Hour
hr|시각|Hour
second|초|Second
beat|박|Beat
hz|진동수|Frequency
fin|끝단|Ending
app|적용량|Application amount
act|동작|Action
assemble|조립|Assembly
barrier|가림막|Occlusion
bgSwitch|배경 전환 빈도|Background change frequency
bias|추첨 경향|Selection bias
layout|레이아웃|Layout
enter|등장|Entrance
exit|퇴장|Exit
hud|보조 정보 표시|HUD
onTwos|프레임 스텝|Stepped animation
density|밀도|Density
dens|밀도|Density
decor|장식|Decoration
deco|꾸밈|Ornament
indent|들여쓰기|Indent
gut|단 사이|Column gutter
colOff|열 어긋남|Column offset
cutY|전환 세로 위치|Vertical cut position
tabY|탭 세로 위치|Tab vertical position
w1|첫째 너비|First width
w2|둘째 너비|Second width
dw|너비 변화량|Width change
hgt|높이|Height
sh|세로 보조 배율|Height modifier
th|두께|Thickness
lo|하한|Lower bound
hi|상한|Upper bound
frac|비율|Fraction
sgn|방향 부호|Direction sign
off|오프셋|Offset
offs|오프셋 목록|Offsets
ol|바깥 너비|Outer width
sp|간격|Spacing
q|변화율|Change ratio
p|진행도|Progress
t|시간|Time
u|가로 보조값|Horizontal factor
vx|가로 속도|Horizontal velocity
vy|세로 속도|Vertical velocity
z|깊이|Depth
xs|가로 위치 목록|Horizontal positions
cam0|카메라 처음 상태|Initial camera state
c0|처음 색|Initial color
s0|처음 배율|Initial scale
a0|처음 각도|Initial angle
l0|처음 길이|Initial length
self|자신의 표시량|Self display amount
path|경로|Path
D|깊이 보조값|Depth factor
L|길이 보조값|Length factor
N|개수 보조값|Count factor
R|반지름 보조값|Radius factor
S|배율 보조값|Scale factor
` .trim().split('\n')){const [key,ko,en]=line.split('|');names[key]=[ko,en];}
J.detailFieldNames=names;
J.detailFieldLabel=key=>{
 if(names[key])return J.mediaLabel(...names[key]);
 if(/^\d+$/.test(key))return J.mediaLabel(`항목 ${Number(key)+1}`,`Item ${Number(key)+1}`);
 if(/^[a-z]$/.test(key))return J.mediaLabel(`보조값 ${key.toUpperCase()}`,`${key.toUpperCase()} factor`);
 const words=key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ');
 return J.mediaLabel(`보조 설정(${words})`,words.charAt(0).toUpperCase()+words.slice(1));
};
})();
