/* Search vocabulary shared by the cut-detail dropdowns: Korean, Japanese and English aliases of one concept. */
(() => {
'use strict';
const normalize = value => String(value).normalize('NFKC')
  .replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  .replace(/[\u30a1-\u30f6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
  .replace(/[‐‑–—−_-]/g, ' ').replace(/[・･]/g, '');
// Keep concepts separate (for example, enlarging and shrinking). Match aliases
// against the original text only, so overlapping concepts do not propagate.
const groups = [
  ['흐림','흐리게','블러','초점','포커스','ぼかし','ぼかす','ぼけ','ボケ','暈し','ブラー','blur','blurring','defocus','ピント送り','rack focus'],
  ['회전','돌기','스핀','回転','かいてん','回る','回って','スピン','ローテーション','rotate','rotation','rotating','spin','spinning'],
  ['확대','크게','줌인','다가가기','푸시인','拡大','かくだい','大きく','ズームイン','寄る','プッシュイン','zoom in','zoomIn','push in','pushIn','enlarge','enlargement'],
  ['축소','작게','줌아웃','멀어지기','풀아웃','縮小','しゅくしょう','小さく','ズームアウト','遠ざかる','プルアウト','zoom out','zoomOut','pull out','pullOut','shrink','shrinking'],
  ['줌','확대축소','스케일','배율','ズーム','zoom','拡大縮小','スケール','scale','scaling'],
  ['흔들림','흔들기','떨림','진동','셰이크','揺れ','揺れる','ゆれ','ゆれる','揺らぎ','ゆらぎ','振動','震える','シェイク','shake','shaking','jitter','vibration'],
  ['튀기','튀어오름','바운드','바운스','통통','跳ねる','はねる','跳ね','弾む','はずむ','バウンド','バウンス','bounce','bouncing','spring'],
  ['깜빡임','점멸','명멸','플리커','点滅','てんめつ','明滅','フリッカー','blink','blinking','flicker'],
  ['발광','빛남','빛나기','글로','블룸','発光','光る','ひかる','輝く','グロー','glow','glowing','bloom'],
  ['섬광','플래시','閃光','フラッシュ','flash','flashing'],
  ['잔상','에코','꼬리','残像','ざんぞう','残響','エコー','afterimage','echo','echoes','trail'],
  ['윤곽','외곽선','테두리','아웃라인','輪郭','りんかく','縁取り','ふちどり','フチ取り','アウトライン','outline','stroke'],
  ['그림자','음영','섀도','影','かげ','陰影','シャドウ','shadow'],
  ['흑백','모노','모노크롬','회색조','그레이스케일','白黒','しろくろ','モノクロ','モノクローム','グレースケール','グレイスケール','mono','monochrome','grayscale','greyscale','black and white'],
  ['반전','네거티브','역상','反転','はんてん','ネガ','invert','inverted','negative'],
  ['거울','미러','대칭','鏡','かがみ','鏡像','ミラー','mirror','mirrored'],
  ['노이즈','잡음','ノイズ','雑音','ざつおん','noise','noisy'],
  ['글리치','버그','깨짐','왜곡','グリッチ','バグ','乱れ','glitch','glitching','distortion'],
  ['색 어긋남','색어긋남','색수차','크로마','色ずれ','色ズレ','色収差','しきしゅうさ','クロマ','chroma','chromatic','rgb shift'],
  ['입자','파티클','粒子','りゅうし','粒','パーティクル','particle','particles'],
  ['입자감','거칠기','그레인','粒状','ざらざら','ざらつき','グレイン','grain','grainy'],
  ['모자이크','픽셀','도트','モザイク','ピクセル','ドット','mosaic','pixel','pixelate','pixelation'],
  ['페이드','서서히','フェード','フェイド','fade','fading'],
  ['디졸브','녹아내림','녹기','ディゾルブ','ディゾルヴ','溶ける','dissolve','dissolving'],
  ['미끄러짐','슬라이드','滑る','すべる','スライド','slide','sliding'],
  ['상승','위로','올라감','上昇','じょうしょう','上へ','上に','rise','rising','ascent','upward'],
  ['하강','낙하','떨어짐','가라앉음','아래로','下降','かこう','落下','らっか','沈む','下へ','下に','fall','falling','drop','sink','downward'],
  ['부유','떠다님','둥둥','플로트','浮遊','ふゆう','浮く','ふわふわ','フロート','float','floating','drift'],
  ['파도','물결','파형','웨이브','波','なみ','波形','波紋','ウェーブ','ウエーブ','wave','waves','ripple'],
  ['맥동','고동','박동','펄스','脈動','鼓動','拍動','パルス','pulse','pulsing','heartbeat'],
  ['진자','흔들이','스윙','振り子','ふりこ','スイング','swing','swinging','pendulum'],
  ['원','원형','동그라미','링','고리','円','円形','円環','丸','まる','サークル','circle','circular','ring'],
  ['사각','사각형','직사각형','네모','정사각형','四角','しかく','矩形','長方形','四角形','rectangle','rect','rectangular','square'],
  ['마름모','다이아','다이아몬드','ひし形','菱形','ダイヤ','ダイヤモンド','diamond','rhombus'],
  ['세로','수직','縦','たて','垂直','vertical'],
  ['가로','수평','横','よこ','水平','horizontal'],
  ['비스듬히','대각','대각선','사선','斜め','ななめ','対角','diagonal'],
  ['가운데','중앙','센터','中央','ちゅうおう','真ん中','まんなか','センター','center','centre','centered'],
  ['분할','나누기','쪼개기','스플릿','分割','ぶんかつ','割れる','スプリット','split','splitting'],
  ['격자','그리드','바둑판','格子','こうし','グリッド','grid','lattice'],
  ['체크','체커','체스판','市松','いちまつ','チェッカー','checker','checkerboard'],
  ['입체','3차원','돌출','立体','りったい','3D','三次元','押し出し','extrude','extrusion'],
  ['주석','루비','후리가나','注釈','ちゅうしゃく','ルビ','ふりがな','振り仮名','ruby','annotation','note'],
  ['자동','알아서','自動','じどう','おまかせ','auto','automatic'],
  ['없음','끔','사용 안 함','なし','無し','無効','オフ','none','off','disabled'],
  ['표준','보통','일반','노멀','通常','つうじょう','標準','ノーマル','normal'],
  ['곱하기','멀티플라이','乗算','じょうざん','multiply'],
  ['스크린','スクリーン','screen'],
  ['오버레이','オーバーレイ','overlay'],
  // Mask pack (詳細 → 背景の演出 → マスク).
  ['마스크','마스킹','도려내기','マスク','ますく','マスキング','型抜き','くり抜き','mask','masks','masked','masking'],
  ['이중 노출','다중 노출','더블 익스포저','二重露光','多重露光','にじゅうろこう','ダブルエクスポージャー','double exposure','multiple exposure'],
  ['시네마스코프','레터박스','와이드스크린','シネマスコープ','シネスコ','レターボックス','ワイドスクリーン','cinemascope','letterbox','widescreen'],
  ['패럴랙스','시차','パララックス','視差','parallax'],
  ['비트','박자','리듬','ビート','拍子','リズム','beat','beats','rhythm'],
  ['셔터','블라인드','슬릿','シャッター','ブラインド','スリット','shutter','shutters','blinds','slit','slits','slat','slats'],
  ['창','윈도','窓','ウィンドウ','ウインドウ','window','windows'],
].map(aliases => [...new Set(aliases.map(normalize))]);
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const aliasGroups = new Map();
groups.forEach((aliases, id) => aliases.forEach(alias => aliasGroups.set(alias, id)));
const pattern = [...aliasGroups.keys()].sort((a,b) => b.length-a.length).map(alias =>
  (/^[a-z0-9]/.test(alias)?'(?<![a-z0-9])':'') + escape(alias).replace(/ /g,'\\s*') + (/[a-z0-9]$/.test(alias)?'(?![a-z0-9])':'')
).join('|');
const concepts = text => {
  const ids = new Set();
  const rest = text.replace(new RegExp(pattern,'g'), match => {
    const id=aliasGroups.get(match) ?? aliasGroups.get(match.replace(/\s+/g,' '));
    // Multiword aliases may also be entered without spaces.
    const resolved=id ?? [...aliasGroups].find(([alias])=>alias.replace(/\s/g,'')===match.replace(/\s/g,''))?.[1];
    if(resolved!==undefined)ids.add(resolved);
    return ' ';
  });
  return {ids,rest};
};
const subsequence = (text,query) => {
  let pos=0;for(const char of query){pos=text.indexOf(char,pos);if(pos<0)return false;pos++;}return true;
};
J.detailSearchQuery = query => {
  const normalized=normalize(query).trim(), parsed=concepts(normalized);
  const words=normalized.split(/\s+/), remaining=parsed.rest.trim().split(/\s+/).filter(Boolean);
  return value => {
    const text=normalize(value);
    if(words.every(word=>subsequence(text,word)))return true;
    if(!parsed.ids.size)return false;
    const candidate=concepts(text);
    return [...parsed.ids].every(id=>candidate.ids.has(id)) && remaining.every(word=>subsequence(text,word));
  };
};
})();
