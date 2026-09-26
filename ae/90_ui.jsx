// ================================================================ ScriptUI panel
var JZ_SECTION = 'JIZURA';
function jzGet(key, def) { try { if (app.settings.haveSetting(JZ_SECTION, key)) return decodeURIComponent(app.settings.getSetting(JZ_SECTION, key)); } catch (e) {} return def; }
function jzPut(key, v) { try { app.settings.saveSetting(JZ_SECTION, key, encodeURIComponent(String(v))); } catch (e) {} }

var JZ_SAMPLE = '새벽의 색을/기억해\n풀린 목소리가 멀리서 울렸어\n그래, 아직 늦지 않았을까\n*투명*한 채로는 끝낼 수 없어!';

function jzUI(thisObj) {
    var win = (thisObj instanceof Panel) ? thisObj : new Window('palette', 'JIZURA', undefined, { resizeable: true });
    win.orientation = 'column'; win.alignChildren = ['fill', 'top']; win.spacing = 6; win.margins = 10;
    var head = win.add('group'); head.alignChildren = ['left', 'center'];
    var ttl = head.add('statictext', undefined, 'JIZURA 字面  lyric motion  v' + JZ_PANEL_VERSION + ' (' + jzPartsCount() + '개 부품)'); try { ttl.graphics.font = ScriptUI.newFont(ttl.graphics.font.name, 'BOLD', 14); } catch (e) {}

    var tp = win.add('tabbedpanel'); tp.alignChildren = ['fill', 'top'];
    // ---------------- tab 1: from lyrics
    var t1 = tp.add('tab', undefined, '가사로 만들기'); t1.orientation = 'column'; t1.alignChildren = ['fill', 'top']; t1.spacing = 6; t1.margins = 8;
    t1.add('statictext', undefined, '가사(1줄=1구절　/ 구분　*강조*　줄끝! 임팩트)');
    var lyr = t1.add('edittext', undefined, jzGet('lyrics', JZ_SAMPLE), { multiline: true, wantReturn: true, scrolling: true }); lyr.preferredSize = [340, 150];
    var gT = t1.add('group'); gT.add('statictext', undefined, '곡명'); var eTitle = gT.add('edittext', undefined, jzGet('title', '')); eTitle.preferredSize.width = 120;
    gT.add('statictext', undefined, '아티스트'); var eArtist = gT.add('edittext', undefined, jzGet('artist', '')); eArtist.preferredSize.width = 100;
    var bOmk = t1.add('button', undefined, '랜덤 생성(누를 때마다 다른 연출)');
    bOmk.helpTip = '스타일·분위기·연출 강도·배합·시드를 통째로 무작위로 정해 새 컴포를 만듭니다';
    try { bOmk.preferredSize.height = 34; bOmk.graphics.font = ScriptUI.newFont(bOmk.graphics.font.name, 'BOLD', 13); } catch (e) {}
    var gSw = t1.add('group'); gSw.orientation = 'column'; gSw.alignChildren = ['left', 'top']; gSw.spacing = 2;
    var cExtra = gSw.add('checkbox', undefined, '추가분 연출도 사용'); cExtra.value = jzGet('extra', '0') === '1';
    cExtra.helpTip = '끄면 최초 공개판의 연출(356개 부품·스타일 12종)만 사용합니다. 켜면 나중에 추가된 연출·스타일·서체도 후보가 됩니다';
    var cWa = gSw.add('checkbox', undefined, '일본풍 연출도 사용'); cWa.value = jzGet('wa', '1') === '1';
    cWa.helpTip = '초롱·엽서·장지문·부채·가문(家紋)·세이가이하 물결·벚꽃잎 등의 일본풍 그래픽과 일본풍 스타일. 끄면 자동으로 선택되지 않습니다(추가분 판정 이후에 적용)';
    var cTypo = gSw.add('checkbox', undefined, '타이포 부품도 사용'); cTypo.value = jzGet('typo', '1') === '1';
    cTypo.helpTip = '선·숫자·글자 배치만으로 보여주는, 타이포다운 부품(약 50개)';
    var cKin = gSw.add('checkbox', undefined, '키네틱 부품도 사용'); cKin.value = jzGet('kinetic', '1') === '1';
    cKin.helpTip = '단어마다 움직이고 튀고 쌓이는, 움직임 중심의 부품(약 50개)';
    var cHor = gSw.add('checkbox', undefined, '호러 연출도 사용'); cHor.value = jzGet('horror', '0') === '1';
    cHor.helpTip = '으스스한 분위기의 부품(약 50개)과 배색 세트 3종. 켜면 자동으로 만들기의 분위기에 「호러」가 추가됩니다(호러 부품은 분위기가 「호러」일 때만 사용합니다)';
    var gLang = gSw.add('group'); gLang.spacing = 4; gLang.add('statictext', undefined, '가사 언어');
    var JZ_LANG_KEYS = ['auto', 'ja', 'zh-Hant', 'zh-Hans', 'ko', 'en'];
    var ddLang = gLang.add('dropdownlist', undefined, ['자동 판정', '日本語', '繁體中文', '简体中文', '한국어', 'English']); ddLang.selection = parseInt(jzGet('lang', '0'), 10) || 0;
    ddLang.helpTip = '중국어(번체·간체)나 한국어 가사는 그 문자를 가진 서체로 조판합니다(각 스타일 서체의 분위기에 가까운 것으로 대체). 자동 판정은 가나·한글·번체/간체 고유 글자로 판단합니다';
    function switches() { return { extra: cExtra.value, wa: cWa.value, typo: cTypo.value, kinetic: cKin.value, horror: cHor.value, lang: JZ_LANG_KEYS[ddLang.selection ? ddLang.selection.index : 0] }; }
    var gS = t1.add('group'); gS.add('statictext', undefined, '스타일');
    var styleNames = [], i;
    for (i = 0; i < JZ_DATA.styleOrder.length; i++) { var stI = JZ_DATA.styles[JZ_DATA.styleOrder[i]]; styleNames.push(stI.name + (stI.extra || stI.wa ? '  〔' + (stI.extra ? '추가' : '') + (stI.extra && stI.wa ? '·' : '') + (stI.wa ? '일본풍' : '') + '〕' : '') + (stI.set === 'horror' ? '  〔호〕' : '')); }
    var ddStyle = gS.add('dropdownlist', undefined, styleNames); ddStyle.selection = parseInt(jzGet('style', '0'), 10) || 0;
    var gC = t1.add('group'); gC.add('statictext', undefined, '크기');
    var sizes = ['활성 컴포와 같게', '1920×1080', '1080×1920', '1080×1080', '3840×2160', '1280×720', '1440×1080 (4:3)', '1080×1440 (3:4)'];
    var ddSize = gC.add('dropdownlist', undefined, sizes); ddSize.selection = parseInt(jzGet('size', '1'), 10) || 0;
    gC.add('statictext', undefined, 'fps'); var ddFps = gC.add('dropdownlist', undefined, ['24', '30', '60']); ddFps.selection = parseInt(jzGet('fps', '0'), 10) || 0;
    var gK = t1.add('group'); gK.add('statictext', undefined, '배경');
    var ddKey = gK.add('dropdownlist', undefined, ['일반(스타일 배경)', '그린 스크린(합성용)', '블랙 배경(합성용)']); ddKey.selection = parseInt(jzGet('key', '0'), 10) || 0;
    ddKey.helpTip = '그린 스크린/블랙 배경: 흰 글자와 연출만 단색 배경 위에 만듭니다(배경 무늬·종이·입자·주변 감광 없음). 그린은 키잉, 블랙은 스크린 합성으로 뺄 수 있습니다';
    var cCenter = t1.add('checkbox', undefined, '가운데 비우기(캐릭터용: 가로 화면은 좌우·세로 화면은 위아래에 배치)'); cCenter.value = jzGet('center', '0') === '1';
    cCenter.helpTip = '가운데에 캐릭터 등을 겹칠 것을 전제로, 문자와 연출을 컷마다 띠(가로 화면은 좌우, 세로 화면은 위아래, 행마다 번갈아)에 배치합니다. 배경과 화면 효과는 화면 전체 그대로입니다';
    var gCD = t1.add('group'); gCD.add('statictext', undefined, '　세로 화면일 때'); var ddCDir = gCD.add('dropdownlist', undefined, ['위아래로 나누기', '좌우로 나누기']); ddCDir.selection = parseInt(jzGet('centerDir', '0'), 10) || 0;
    var cLight = t1.add('checkbox', undefined, '경량(AE에서 재생을 가볍게)'); cLight.value = jzGet('light', '0') === '1';
    cLight.helpTip = '색 어긋남 복제·종이 질감·글로·입자·일부 화면 효과를 생략해 After Effects에서의 재생을 가볍게 합니다(긴 곡에 추천)';

    var pT = t1.add('panel', undefined, '타이밍'); pT.alignChildren = ['left', 'top']; pT.margins = 10;
    var rAuto = pT.add('radiobutton', undefined, '자동(글자 수·BPM 기준) / LRC 시각');
    var rLayer = pT.add('radiobutton', undefined, '선택 레이어 마커를 줄 시작에 사용');
    var rComp = pT.add('radiobutton', undefined, '컴포 마커를 줄 시작에 사용');
    var tm = jzGet('timing', 'auto'); rAuto.value = tm === 'auto'; rLayer.value = tm === 'layer'; rComp.value = tm === 'comp';
    var gB = pT.add('group'); gB.add('statictext', undefined, 'BPM'); var eBpm = gB.add('edittext', undefined, jzGet('bpm', '')); eBpm.preferredSize.width = 50;
    gB.add('statictext', undefined, '줄 길이'); var eScale = gB.add('edittext', undefined, jzGet('lineScale', '1')); eScale.preferredSize.width = 40;
    var cAudio = pT.add('checkbox', undefined, '선택한 오디오 레이어를 새 컴포에 넣기'); cAudio.value = jzGet('audio', '1') === '1';

    var pF = t1.add('panel', undefined, '연출'); pF.alignChildren = ['fill', 'top']; pF.margins = 10;
    var gM = pF.add('group'); gM.add('statictext', undefined, '분위기').preferredSize.width = 86;
    var moodNames = ['기본(모든 기법 사용)'];
    for (i = 0; i < JZ_DATA.moodOrder.length; i++) moodNames.push(JZ_DATA.moods[JZ_DATA.moodOrder[i]].name);
    var ddMood = gM.add('dropdownlist', undefined, moodNames); ddMood.selection = parseInt(jzGet('mood', '0'), 10) || 0;
    ddMood.helpTip = '분위기별로 사용할 레이아웃·등장·퇴장 기법이 좁혀집니다(시드로 재현)';
    function slider(parent, label, key, def) {
        var g = parent.add('group'); g.add('statictext', undefined, label).preferredSize.width = 86;
        var v = parseFloat(jzGet(key, String(def)));
        var s = g.add('slider', undefined, v, 0, 100); s.preferredSize.width = 170;
        var t = g.add('statictext', undefined, String(Math.round(v))); t.preferredSize.width = 30;
        s.onChanging = function () { t.text = String(Math.round(s.value)); };
        s.key = key; s.lbl = t; return s;
    }
    var sMotion = slider(pF, '움직임 강도', 'motion', 70), sGlitch = slider(pF, '글리치', 'glitch', 55), sChroma = slider(pF, '색 어긋남', 'chroma', 70);
    var sDecor = slider(pF, '장식 양', 'decor', 50), sDensity = slider(pF, '컷 세분화', 'density', 55), sTexture = slider(pF, '질감', 'texture', 60), sBg = slider(pF, '배경 전환', 'bgSwitch', 35);
    var gO = pF.add('group');
    var cTwos = gO.add('checkbox', undefined, '2커마(12fps)'); cTwos.value = jzGet('twos', '1') === '1';
    var cFlash = gO.add('checkbox', undefined, '플래시'); cFlash.value = jzGet('flash', '1') === '1';
    gO.add('statictext', undefined, 'HUD'); var ddHud = gO.add('dropdownlist', undefined, ['스타일에 따름', '표시', '숨기기']); ddHud.selection = parseInt(jzGet('hud', '0'), 10) || 0;
    var gO2 = pF.add('group'); gO2.add('statictext', undefined, '간주 남은 초'); var ddInter = gO2.add('dropdownlist', undefined, ['무작위', '항상 표시', '숨김']); ddInter.selection = parseInt(jzGet('interCount', '0'), 10) || 0;
    var cCredit = gO2.add('checkbox', undefined, '첫 간주에 크레딧'); cCredit.value = jzGet('interCredit', '0') === '1';
    var gSeed = t1.add('group'); gSeed.add('statictext', undefined, '시드');
    var eSeed = gSeed.add('edittext', undefined, jzGet('seed', '20260922')); eSeed.preferredSize.width = 110;
    var bShuffle = gSeed.add('button', undefined, '셔플');
    bShuffle.onClick = function () { eSeed.text = String(Math.floor(Math.random() * 999999999)); };

    var pP = t1.add('panel', undefined, '강조색·어긋남 색'); pP.alignChildren = ['fill', 'top']; pP.margins = 10; pP.spacing = 6;
    var gP1 = pP.add('group');
    var cPal = gP1.add('checkbox', undefined, '스타일 색 덮어쓰기'); cPal.value = jzGet('palOn', '0') === '1';
    var bPal = gP1.add('button', undefined, '무작위 배합');
    bPal.helpTip = '배경에 어울리는 강조색과 어긋남 색 A/B를 무작위로 선택합니다(밝기는 배경에 맞춰 자동 조정)';
    var gP2 = pP.add('group'); gP2.spacing = 10;
    function colorField(label, key) {
        var g = gP2.add('group'); g.orientation = 'column'; g.alignChildren = ['left', 'top']; g.spacing = 2;
        g.add('statictext', undefined, label);
        var row = g.add('group'); row.spacing = 4;
        var sw = row.add('group'); sw.preferredSize = [16, 16];
        var e = row.add('edittext', undefined, jzGet('pal_' + key, '')); e.characters = 8;
        var f = { e: e, sw: sw, key: key };
        e.onChange = function () { var h = jzCleanHex(e.text); if (h) { e.text = h; cPal.value = true; } paint(f); };
        return f;
    }
    function paint(f) {
        var h = jzCleanHex(f.e.text); if (!h) return;
        try { var c = jzHex(h); f.sw.graphics.backgroundColor = f.sw.graphics.newBrush(f.sw.graphics.BrushType.SOLID_COLOR, [c[0], c[1], c[2], 1]); } catch (e) {}
    }
    var fAcc = colorField('강조색', 'accent'), fGA = colorField('어긋남 색 A', 'ghostA'), fGB = colorField('어긋남 색 B', 'ghostB'), palFields = [fAcc, fGA, fGB];
    function curStyle() { return JZ_DATA.styles[JZ_DATA.styleOrder[ddStyle.selection ? ddStyle.selection.index : 0]] || JZ_DATA.styles.noir; }
    function setPal(p) { fAcc.e.text = p.accent; fGA.e.text = p.ghostA; fGB.e.text = p.ghostB; for (var q = 0; q < 3; q++) paint(palFields[q]); }
    function showStylePal() { var sc = curStyle().schemes[0]; setPal({ accent: sc.accent, ghostA: sc.ghostA, ghostB: sc.ghostB }); }
    if (!cPal.value || !jzCleanHex(fAcc.e.text)) showStylePal(); else setPal({ accent: fAcc.e.text, ghostA: fGA.e.text, ghostB: fGB.e.text });
    ddStyle.onChange = function () { if (!cPal.value) showStylePal(); };
    bPal.onClick = function () { setPal(jzRandomPalette(curStyle().schemes[0].bg)); cPal.value = true; status.text = '배합을 변경했습니다 — 「컴포 생성」을 눌러 적용하세요'; };
    cPal.onClick = function () { if (!cPal.value) showStylePal(); };

    var gGo = t1.add('group'); gGo.alignChildren = ['fill', 'center'];
    var bBuild = gGo.add('button', undefined, '컴포 생성'); bBuild.alignment = ['fill', 'center'];

    // ---------------- tab 2: from JSON
    var t2 = tp.add('tab', undefined, 'JSON에서'); t2.orientation = 'column'; t2.alignChildren = ['fill', 'top']; t2.margins = 8;
    t2.add('statictext', undefined, '브라우저 버전 JIZURA의 「AE용으로 내보내기」로 만든 .json을 불러와,', undefined, { multiline: true });
    t2.add('statictext', undefined, '같은 타이밍·레이아웃·연출로 편집 가능한 컴포를 구성합니다.', undefined, { multiline: true });
    var cAudio2 = t2.add('checkbox', undefined, '선택한 오디오 레이어도 넣기'); cAudio2.value = true;
    var bJson = t2.add('button', undefined, 'JSON 선택 후 생성…');
    t2.add('statictext', undefined, '생각대로 만들어지지 않을 때는 아래 버튼으로 진단 리포트(JIZURA_report.txt)를 저장해 보내 주세요.', undefined, { multiline: true });
    var bDiag = t2.add('button', undefined, '진단 리포트 저장(마지막으로 만든 컴포)');

    // ---------------- tab 3: fonts
    var t3 = tp.add('tab', undefined, '폰트'); t3.orientation = 'column'; t3.alignChildren = ['fill', 'top']; t3.margins = 8;
    t3.add('statictext', undefined, 'PostScript 이름으로 지정(찾을 수 없는 항목은 여기에 표시됩니다)', undefined, { multiline: true });
    function fontRow(label, key, def) { var g = t3.add('group'); g.add('statictext', undefined, label).preferredSize.width = 70; var e = g.add('edittext', undefined, jzGet('font_' + key, def)); e.preferredSize.width = 230; return e; }
    var fDisplay = fontRow('제목', 'display', 'MalgunGothic-Bold'), fSerif = fontRow('명조', 'serif', 'Batang-Bold'), fBody = fontRow('작은 글씨', 'body', 'MalgunGothic-Regular'), fMono = fontRow('고정폭', 'mono', 'Consolas');
    var cForce = t3.add('checkbox', undefined, '항상 이 4개 서체 사용(자동 선택 안 함)'); cForce.value = jzGet('forceFonts', '0') === '1';
    var bPick = t3.add('button', undefined, '선택한 텍스트 레이어 서체를 「제목」으로');
    bPick.onClick = function () {
        var c = app.project.activeItem;
        if (!(c instanceof CompItem) || !c.selectedLayers.length) { alert('텍스트 레이어를 선택하세요'); return; }
        try { fDisplay.text = c.selectedLayers[0].property('ADBE Text Properties').property('ADBE Text Document').value.font; } catch (e) { alert('텍스트 레이어가 아닙니다'); }
    };
    t3.add('statictext', undefined, 'Noto Sans JP / Noto Serif JP / Dela Gothic One 등이 있으면 자동으로 사용합니다(AE 2024 이후).', undefined, { multiline: true });

    var status = win.add('statictext', undefined, '준비 완료', { truncate: 'end' });
    var gRun = win.add('group'); gRun.alignChildren = ['fill', 'center'];
    var pbar = gRun.add('progressbar', undefined, 0, 100); pbar.alignment = ['fill', 'center']; pbar.preferredSize.height = 6;
    var bStop = gRun.add('button', undefined, '중지'); bStop.enabled = false; bStop.helpTip = '생성을 멈춥니다(거기까지의 컷으로 컴포를 마무리합니다)';
    tp.selection = t1;

    // ---- build in short steps: After Effects gets control back between steps (app.scheduleTask), so long songs
    //      don't freeze it into "not responding"; the bar shows progress and 中止 finishes with the cuts built so far
    var RUN = null;
    function setRunning(on) { bBuild.enabled = bOmk.enabled = bJson.enabled = !on; bStop.enabled = on; if (!on) pbar.value = 0; }
    function runBuild(plan, bo, undoName, done) {
        if (RUN) { alert('JIZURA: 지금 생성 중입니다. 끝날 때까지 기다리거나 「중지」를 누르세요'); return; }
        var job = null;
        app.beginUndoGroup(undoName);
        try { job = jzBuildStart(plan, bo); }
        catch (e) { alert('생성 중 오류: ' + e.toString() + (e.line ? ' (line ' + e.line + ')' : '')); }
        finally { app.endUndoGroup(); }
        if (!job) { done(null); return; }
        RUN = { job: job, done: done, name: undoName, t0: new Date().getTime() };
        setRunning(true);
        $.global.__JZ_TICK = tick;
        if (!schedule()) { while (RUN) tick(true); }          // no scheduleTask: plain loop (the old behaviour)
    }
    function schedule() { try { app.scheduleTask('if ($.global.__JZ_TICK) $.global.__JZ_TICK();', 20, false); return true; } catch (e) { return false; } }
    function tick(sync) {
        var R = RUN; if (!R) return;
        var err = null, job = R.job;
        app.beginUndoGroup(R.name);
        try { job.step(sync ? 1e9 : 900); }
        catch (e) { err = e.toString() + (e.line ? ' (line ' + e.line + ')' : ''); }
        finally { app.endUndoGroup(); }
        if (err || job.finished) {
            RUN = null; $.global.__JZ_TICK = null; setRunning(false);
            if (err) alert('생성 중 오류: ' + err);
            R.done(err ? null : job.comp, job);
            return;
        }
        var k = job.phase === 'cuts' ? job.done / Math.max(1, job.total) * 0.9 : 0.9 + 0.1 * job.eventsDone / Math.max(1, job.events);
        pbar.value = Math.round(k * 100);
        status.text = '생성 중… ' + Math.round(k * 100) + '%(' + (job.phase === 'cuts' ? job.done + ' / ' + job.total + '컷' : '효과 추가 중') + ')';
        try { if (win.update) win.update(); } catch (eu) {}
        if (!sync && !schedule()) { while (RUN) tick(true); }
    }
    bStop.onClick = function () { if (RUN) { RUN.job.cancelled = true; status.text = '중지하는 중…(이미 만든 컷으로 마무리합니다)'; } };

    function roles() {
        jzPut('font_display', fDisplay.text); jzPut('font_serif', fSerif.text); jzPut('font_body', fBody.text); jzPut('font_mono', fMono.text); jzPut('forceFonts', cForce.value ? '1' : '0');
        return { display: fDisplay.text, serif: fSerif.text, body: fBody.text, mono: fMono.text, __force: cForce.value };
    }
    function audioSel(on) {
        var c = app.project.activeItem;
        if (!on || !(c instanceof CompItem) || !c.selectedLayers.length) return null;
        var L = c.selectedLayers[0];
        try { if (L.hasAudio && L.source) return { item: L.source, start: L.startTime }; } catch (e) {}
        return null;
    }
    var fontNoted = false, lastComp = null, lastPlan = null;
    function report(comp, t0, label) {
        var s = (label ? label + '  ' : '') + (comp ? comp.name : '') + ' — ' + ((new Date().getTime() - t0) / 1000).toFixed(1) + 's';
        if (JZLOG.length) { s += ' / 주의 ' + JZLOG.length + '건'; alert('JIZURA: 생성했지만 일부에 주의가 있습니다:\n\n' + JZLOG.slice(0, 14).join('\n')); }
        var mf = comp ? jzMissingFonts() : [];
        if (mf.length) {
            s += ' / 서체 대체 ' + mf.length; status.helpTip = '이 PC에 없는 서체: ' + mf.join(', ');
            if (!fontNoted) {
                fontNoted = true;
                alert('JIZURA: 다음 서체가 이 PC에 없어 비슷한 서체로 만들었습니다.\n\n' + mf.join('\n') +
                    '\n\n모두 Google Fonts(fonts.google.com)에서 무료로 설치할 수 있습니다. 설치 후 After Effects를 다시 시작하고 다시 만들면 브라우저 버전과 같은 서체가 됩니다.');
            }
        }
        if (comp && JZ_FONT_NOAPI && !fontNoted) {
            fontNoted = true;
            alert('JIZURA: 이 After Effects에서는 서체 설치 여부를 확인할 수 없어(AE 2024 이전) 「폰트」 탭에서 지정한 서체로 만들었습니다.\n\n브라우저 버전과 같은 서체로 하려면 사용된 서체(Google Fonts)를 설치해 「폰트」 탭에서 지정하거나 AE 2024 이후 버전에서 만들어 주세요.');
        }
        status.text = s;
    }

    function moodKey() { var ix = ddMood.selection ? ddMood.selection.index : 0; return ix > 0 ? JZ_DATA.moodOrder[ix - 1] : null; }
    function doBuild(label) {
        var t0 = new Date().getTime();
        jzPut('mood', ddMood.selection ? ddMood.selection.index : 0); jzPut('palOn', cPal.value ? '1' : '0');
        for (var pf = 0; pf < palFields.length; pf++) jzPut('pal_' + palFields[pf].key, palFields[pf].e.text);
        jzPut('lyrics', lyr.text); jzPut('title', eTitle.text); jzPut('artist', eArtist.text); jzPut('style', ddStyle.selection.index);
        jzPut('size', ddSize.selection.index); jzPut('fps', ddFps.selection.index); jzPut('timing', rLayer.value ? 'layer' : rComp.value ? 'comp' : 'auto');
        jzPut('bpm', eBpm.text); jzPut('lineScale', eScale.text); jzPut('audio', cAudio.value ? '1' : '0'); jzPut('seed', eSeed.text);
        jzPut('twos', cTwos.value ? '1' : '0'); jzPut('flash', cFlash.value ? '1' : '0'); jzPut('hud', ddHud.selection.index); jzPut('interCount', ddInter.selection.index); jzPut('interCredit', cCredit.value ? '1' : '0');
        jzPut('extra', cExtra.value ? '1' : '0'); jzPut('wa', cWa.value ? '1' : '0'); jzPut('typo', cTypo.value ? '1' : '0'); jzPut('kinetic', cKin.value ? '1' : '0'); jzPut('horror', cHor.value ? '1' : '0'); jzPut('key', ddKey.selection.index); jzPut('center', cCenter.value ? '1' : '0'); jzPut('centerDir', ddCDir.selection ? ddCDir.selection.index : 0); jzPut('light', cLight.value ? '1' : '0'); jzPut('lang', ddLang.selection ? ddLang.selection.index : 0);
        var sl = [sMotion, sGlitch, sChroma, sDecor, sDensity, sTexture, sBg]; for (var k = 0; k < sl.length; k++) jzPut(sl[k].key, sl[k].value);
        var active = app.project.activeItem, W = 1920, H = 1080, fps = [24, 30, 60][ddFps.selection.index], dur = null;
        var sz = ddSize.selection.index;
        if (sz === 0) { if (active instanceof CompItem) { W = active.width; H = active.height; fps = active.frameRate; } }
        else { var wh = sizes[sz].split('×'); W = parseInt(wh[0], 10); H = parseInt(wh[1], 10); }
        var starts = null, mk, j;
        if (rLayer.value || rComp.value) {
            if (!(active instanceof CompItem)) { alert('마커를 쓰려면 컴포를 열어주세요'); return; }
            try {
                if (rLayer.value) { if (!active.selectedLayers.length) { alert('마커가 있는 레이어를 선택하세요'); return; } mk = active.selectedLayers[0].property('ADBE Marker'); }
                else mk = active.markerProperty;
                starts = []; for (j = 1; j <= mk.numKeys; j++) starts.push(mk.keyTime(j));
                if (!starts.length) { alert('마커를 찾을 수 없습니다'); return; }
                dur = active.duration;
            } catch (e) { alert('마커를 읽을 수 없습니다: ' + e.toString()); return; }
        }
        var au = audioSel(cAudio.value); if (au && !dur) dur = null;
        var sw = switches(), en = jzMoodEnabled(moodKey(), parseInt(eSeed.text, 10) || 1, sw);
        var o = {
            lyrics: lyr.text, title: eTitle.text, artist: eArtist.text, style: JZ_DATA.styleOrder[ddStyle.selection.index], seed: parseInt(eSeed.text, 10) || 1,
            fx: { motion: sMotion.value / 100, glitch: sGlitch.value / 100, chroma: sChroma.value / 100, decor: sDecor.value / 100, density: sDensity.value / 100, texture: sTexture.value / 100, bgSwitch: sBg.value / 100, onTwos: cTwos.value, flash: cFlash.value, hud: false, interCount: ['auto', 'on', 'off'][ddInter.selection.index], interCredit: cCredit.value },
            width: W, height: H, fps: fps, bpm: parseFloat(eBpm.text) || 0, starts: starts, enabled: en, offset: 0.4, lineScale: parseFloat(eScale.text) || 1, duration: dur,
            extra: sw.extra, wa: sw.wa, typo: sw.typo, kinetic: sw.kinetic, horror: sw.horror, lang: sw.lang, centerFree: cCenter.value, centerDir: ddCDir.selection && ddCDir.selection.index === 1 ? 'lr' : 'tb'
        };
        var st = JZ_DATA.styles[o.style];
        o.fx.hud = ddHud.selection.index === 1 ? true : ddHud.selection.index === 2 ? false : !!st.hud;
        var plan;
        try { plan = jzMakePlan(o); } catch (e1) { alert('구성 계산 중 오류: ' + e1.toString() + (e1.line ? ' (line ' + e1.line + ')' : '')); return; }
        if (!plan.cuts.length) { alert('가사가 비어 있습니다'); return; }
        plan.hud = o.fx.hud;
        if (cPal.value) {
            var pal = { accent: jzCleanHex(fAcc.e.text), ghostA: jzCleanHex(fGA.e.text), ghostB: jzCleanHex(fGB.e.text) };
            if (!pal.accent && !pal.ghostA && !pal.ghostB) jzWarn('배합 값을 읽을 수 없어 스타일 색을 그대로 두었습니다(#RRGGBB 형식으로 입력)');
            else plan.style = jzStyleWithPalette(plan.style, pal);
        }
        var keyI = ddKey.selection ? ddKey.selection.index : 0;
        if (keyI > 0) { plan.keyBg = keyI === 1 ? 'green' : 'black'; plan.style = jzKeyStyle(plan.style); }
        status.text = '생성 중… (' + plan.cuts.length + ' cuts)';
        runBuild(plan, { roles: roles(), audioItem: au ? au.item : null, audioStart: au ? au.start : 0, light: cLight.value }, 'JIZURA build', function (comp, job) {
            if (comp) { lastComp = comp; lastPlan = plan; }
            report(comp, t0, jobLabel(label, job));
        });
    }
    function jobLabel(label, job) { return job && job.cancelled ? '중지(' + job.done + ' / ' + job.total + '컷)' + (label ? ' ' + label : '') : label; }
    bBuild.onClick = function () { doBuild(''); };

    // おまかせ: roll every setting on the panel, show it, then build a fresh comp
    bOmk.onClick = function () {
        var r = jzOmakase(moodKey(), JZ_DATA.styleOrder[ddStyle.selection ? ddStyle.selection.index : 0], null, switches());
        ddStyle.selection = jzIndexOf(JZ_DATA.styleOrder, r.style);
        ddMood.selection = jzIndexOf(JZ_DATA.moodOrder, r.mood) + 1;
        var map = [[sMotion, 'motion'], [sGlitch, 'glitch'], [sChroma, 'chroma'], [sDecor, 'decor'], [sDensity, 'density'], [sTexture, 'texture'], [sBg, 'bgSwitch']];
        for (var q = 0; q < map.length; q++) if (r.fx[map[q][1]] != null) { map[q][0].value = Math.round(r.fx[map[q][1]] * 100); map[q][0].lbl.text = String(map[q][0].value); }
        cTwos.value = r.onTwos; cFlash.value = r.flash; ddHud.selection = r.hud; eSeed.text = String(r.seed);
        if (r.palette) { setPal(r.palette); cPal.value = true; } else { cPal.value = false; showStylePal(); }
        doBuild('랜덤 생성: ' + JZ_DATA.styles[r.style].name + ' × ' + JZ_DATA.moods[r.mood].name + (r.palette ? '·무작위 배합' : ''));
    };

    bJson.onClick = function () {
        var f = File.openDialog('JIZURA AE JSON', 'JSON:*.json', false);
        if (!f) return;
        var t0 = new Date().getTime(), plan;
        try { f.encoding = 'UTF-8'; f.open('r'); var s = f.read(); f.close(); plan = jzParseJSON(s); }
        catch (e) { alert('JSON을 읽을 수 없습니다: ' + e.toString()); return; }
        if (!plan || !plan.cuts || !plan.style) { alert('JIZURA의 AE용 JSON이 아닌 것 같습니다'); return; }
        var note = plan.aeNote ? String(plan.aeNote) : '';
        if (plan.version !== 2 && !note) note = '';
        var au = audioSel(cAudio2.value);
        status.text = '생성 중… (' + plan.cuts.length + ' cuts)';
        // a line-range JSON starts part-way into the song: slide the song layer left by the same amount
        var off = +plan.audioOffset || 0;
        runBuild(plan, { roles: roles(), audioItem: au ? au.item : null, audioStart: au ? au.start - off : 0, light: cLight.value }, 'JIZURA build from JSON', function (comp, job) {
            if (comp) { lastComp = comp; lastPlan = plan; }
            if (JZ_FALLBACKS > 0) {
                note = (note ? note + ' / ' : '') + '이 패널에 없는 표현 ' + JZ_FALLBACKS + '곳을 비슷한 표현으로 만들었습니다';
                alert('JIZURA: 이 JSON에는 이 패널이 만들 수 없는 표현이 ' + JZ_FALLBACKS + '곳 있어 비슷한 표현으로 바꿨습니다.\n\n' + JZ_FALLBACK_KEYS.slice(0, 12).join(', ') +
                    '\n\n브라우저 버전보다 오래된 패널을 쓰고 있을 수 있습니다. 최신 JIZURA_AE.jsx(v' + JZ_PANEL_VERSION + '·860개 부품)로 교체한 뒤 After Effects를 다시 시작해 주세요.');
            }
            report(comp, t0, jobLabel(note ? '교체 있음' : '', job));
            if (note) status.helpTip = note;
        });
    };
    bDiag.onClick = function () {
        if (!lastComp) { alert('먼저 컴포를 만들어 주세요(이 패널에서 마지막으로 만든 컴포를 조사합니다)'); return; }
        var ok = false; try { ok = !!lastComp.name; } catch (e) { ok = false; }
        if (!ok) { alert('마지막으로 만든 컴포를 찾을 수 없습니다(삭제되었을 수 있습니다)'); return; }
        status.text = '진단 중…(수십 초 걸릴 수 있습니다)';
        var r = jzDiagnose(lastComp, lastPlan, 120), path = jzSaveReport(r.text);
        status.text = '진단: 표현식 오류 ' + r.errors + ' / ' + r.expressions + (r.partial ? '(일부만)' : '');
        alert('JIZURA 진단: 표현식 ' + r.expressions + '개 중 오류 ' + r.errors + '개' + (r.partial ? '(시간 제한으로 일부만)' : '') + '\n\n' +
            (path ? '리포트를 저장했습니다:\n' + path : '리포트를 저장할 수 없었습니다(환경 설정 → 스크립팅 및 표현식 → 「스크립트의 파일 쓰기 및 네트워크 액세스 허용」을 켜 주세요).\n\n' + r.text.substr(0, 1500)));
    };

    win.onResizing = win.onResize = function () { try { this.layout.resize(); } catch (e) {} };
    if (win instanceof Window) { win.center(); win.show(); } else { win.layout.layout(true); win.layout.resize(); }
    return win;
}
