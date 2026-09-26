"""hirazisora 포크의 Node + Windows Edge 전제 Playwright 테스트(dev/*_test.cjs 16개, 삭제됨)를 Python Playwright로 옮긴 것.
저장소 루트를 8766에서 직접 서빙한다(8765는 사용자 서버 — 쓰지 않는다).
usage: dev/.venv/bin/python dev/fork_ui_test.py [test_name ...]

공통 조정: en/ 로케일 루프 제외(루트 index.html만), Edge executablePath 제거, 일본어 UI 단언은 현재 한국어 라벨로,
C:/Windows/Fonts/arial.ttf 대신 LOCAL_TTF, 스크린샷은 ../*.png 대신 dev/www/fork-*.png.
포크 저장 흐름(#btnSave → 파일 이름 대화상자 → .jizuraichi)은 우리 #btnSaveAll(대화상자 없이 .jizura)로 바꿨다.
Task 7에서 옮겨진 컷별 컨트롤은 J.uiApi.selectCut(i)로 컷을 고른 뒤 #cutPanel에서 찾는다."""
import asyncio, json, math, os, re, struct, sys
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from absorb_ui_test import serve, ROOT, LOCAL_TTF

SHOTS = os.path.join(ROOT, 'dev', 'www')
LAYER_PANEL = '#cutPanel [data-cut-section="layer"]'

def svg(name, body, w=120, h=80):
    return {'name': name, 'mimeType': 'image/svg+xml',
            'buffer': f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">{body}</svg>'.encode()}

def json_file(name, obj):
    return {'name': name, 'mimeType': 'application/json', 'buffer': json.dumps(obj).encode()}

async def ready(pg):
    await pg.wait_for_function('window.J && J.ui && J.ui.project && J.ui.plan')

async def new_page(b, url, width=1500, height=1000):
    pg = await b.new_page(viewport={'width': width, 'height': height}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script("try { localStorage.setItem('jizura.tourDone', '1'); } catch (e) {}")
    await pg.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(content_type='text/css', body=''))
    await pg.goto(url); await ready(pg)
    return pg, errs

async def reload(pg):
    await pg.reload(); await ready(pg)

async def select_lyric_cut(pg, line, part):
    """옛 행 목록의 컷 상자(.lyric-cut-option[data-line][data-part]) 대신: 그 컷을 패널에서 고른다."""
    i = await pg.evaluate("([l, p]) => J.ui.plan.cuts.findIndex(c => c.line === l && c.part === p)", [line, part])
    assert i >= 0, (line, part)
    await pg.evaluate("i => J.uiApi.selectCut(i)", i)
    return pg.locator(LAYER_PANEL)

async def download_bytes(dl):
    with open(await dl.path(), 'rb') as f:
        return f.read()

def wav_tone():
    n = 16000; data = bytearray(44 + n * 2)
    data[0:4] = b'RIFF'; struct.pack_into('<I', data, 4, len(data) - 8); data[8:16] = b'WAVEfmt '
    struct.pack_into('<IHHIIHH', data, 16, 16, 1, 1, 16000, 32000, 2, 16); data[36:40] = b'data'
    struct.pack_into('<I', data, 40, len(data) - 44)
    for i in range(n): struct.pack_into('<h', data, 44 + i * 2, round(math.sin(i / 16000 * 440 * 2 * math.pi) * 3000))
    return bytes(data)

# ---------------------------------------------------------------- themes_test.cjs
THEME_REPORT = r'''() => {
 const failures=[],check=(v,m)=>{if(!v)failures.push(m)};let runs=0;
 for(const [id,theme] of Object.entries(J.THEMES)){
  for(const key of theme.styles)check(!!J.STYLES[key],id+': style '+key);
  for(const key of theme.media)check(!!J.MEDIA_TECH[key],id+': media '+key);
  for(let seed=1;seed<=24;seed++){
   const p=J.defaultProject();p.themes=[id];p.extra=seed%2===0;p.wa=seed%3===0;p.overrides={0:{lock:true,layout:'center',seed:123}};
   const result=J.omakase(p,J.rng(seed)),pool=J.themeCandidates(p,id);runs++;
   check(pool.styles.includes(result.style),id+': style escaped');check(theme.moods.includes(result.mood),id+': mood escaped');
   for(const group of J.GROUP_KEYS)for(const [key,on] of Object.entries(result.enabled[group]))if(on)check(pool.lyrics[group].includes(key),id+': lyric escaped '+group+':'+key);
   for(const layer of ['foreground','media']){
    const on=Object.keys(result[layer].effects.enabled).filter(k=>result[layer].effects.enabled[k]);check(on.every(k=>pool.media.includes(k)),id+': media escaped');
    for(const stage of [undefined,'enter','exit'])check(on.some(k=>J.MEDIA_TECH[k].stage===stage),id+': empty '+stage);
   }
   check(JSON.stringify(result.overrides[0])===JSON.stringify(p.overrides[0]),id+': lost lock');
   check(!result.colors.enabled&&!result.colors.accentOn&&Object.keys(result.fonts).length===0,id+': random palette/fonts');
   J.plan({...p,...result});
  }
 }
 const p=J.defaultProject();p.themes=['ballad','cute','unknown','cute'];check(JSON.stringify(J.themeIds(p))==='["ballad","cute"]','normalize');const seen=new Set();for(let i=1;i<=60;i++)seen.add(J.omakase(p,J.rng(i)).appliedTheme);check(seen.size===2&&[...seen].every(id=>p.themes.includes(id)),'multi selection');
 return {failures:[...new Set(failures)],runs,themes:Object.keys(J.THEMES).length};
}'''

async def test_themes(b, url):
    pg, errs = await new_page(b, url)
    await pg.locator('#modePro').click()
    # 포크: Jev 버튼 0개·/api/jev 501 → 우리는 「AI로 고르기」를 유지한다(1개). /api/jev 단언은 뺐다(우리 서버에 그 경로가 없다).
    assert await pg.locator('#btnAiPick').count() == 1
    report = await pg.evaluate(THEME_REPORT)
    assert report['failures'] == [], report
    labels = pg.locator('#themeLabels .theme-label')
    before = await pg.evaluate('J.ui.project.style')
    await pg.locator('#btnThemes').click(); await pg.locator('[data-theme="ballad"]').check(); await pg.locator('[data-theme="cute"]').check()
    await pg.locator('#btnApplyThemes').click()
    assert await labels.count() == 2
    assert await pg.evaluate('J.ui.project.style') == before
    await pg.locator('#btnUndo').click(); assert await labels.count() == 0
    await pg.locator('#btnRedo').click(); assert await labels.count() == 2
    await pg.locator('#btnOmakase').click()
    assert await pg.evaluate('J.ui.project.appliedTheme') in ('ballad', 'cute')
    await pg.locator('#btnThemes').click(); await pg.locator('#btnClearThemes').click()
    await pg.locator('#themesDlg button[value="cancel"]').click()
    assert await labels.count() == 2
    await pg.evaluate('J.uiApi.flushSave()'); await reload(pg)
    assert await labels.count() == 2
    roundtrip = await pg.evaluate('async () => (await J.unpackProject(await J.packProject(J.ui.project, null))).project.themes')
    assert roundtrip == ['ballad', 'cute'], roundtrip
    await pg.locator('#btnThemes').click(); await pg.screenshot(path=os.path.join(SHOTS, 'fork-themes-ko.png'))
    await pg.locator('#btnClearThemes').click(); await pg.locator('#btnApplyThemes').click()
    await pg.locator('#modeEasy').click(); await pg.locator('#btnOmakaseBig').click()
    assert not errs, errs
    print('  themes', {'runs': report['runs'], 'themes': report['themes']})
    await pg.close()

# ---------------------------------------------------------------- project_file_test.cjs
MAKE_WEBM = r'''async()=>{const c=document.createElement('canvas');c.width=120;c.height=80;const ctx=c.getContext('2d');const stream=c.captureStream(10),rec=new MediaRecorder(stream,{mimeType:'video/webm'}),parts=[];rec.ondataavailable=e=>parts.push(e.data);const done=new Promise(r=>rec.onstop=r);rec.start();for(let i=0;i<5;i++){ctx.fillStyle=i%2?'blue':'red';ctx.fillRect(0,0,120,80);await new Promise(r=>setTimeout(r,110))}rec.stop();await done;stream.getTracks().forEach(t=>t.stop());return Array.from(new Uint8Array(await new Blob(parts).arrayBuffer()))}'''

async def test_project_file(b, url):
    wav = wav_tone(); errors = []; pages = []
    async def setup():
        pg, errs = await new_page(b, url); pages.append(pg)
        pg.on('pageerror', lambda e: errors.append(str(e)))
        await pg.locator('#modePro').click()
        return pg
    p = await setup()
    # 포크 제목 「字面一 JIZURA ONE STOP EDITION」·accept '.jizuraichi'는 받지 않았다 → 우리 <title>과 우리 accept
    title = re.search(r'<title>([^<]*)</title>', open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()).group(1)
    assert await p.title() == title and 'ONE STOP' not in title, title
    assert await p.locator('#fileProject').get_attribute('accept') == '.jizura,.jizuraichi,.json'
    await p.locator('#projectMenu summary').click(); await p.locator('#btnNew').click()
    await p.locator('#newProjectAspect').select_option('9:16'); await p.locator('#btnCreateProject').click()
    assert await p.evaluate('[J.ui.project.lyrics,J.ui.project.aspect,J.ui.plan.cuts.length,J.mediaAssets.size,J.ui.audio]') == ['', '9:16', 0, 0, None]
    await p.locator('#songTitle').fill('Portable test'); await p.locator('#songTitle').dispatch_event('input')
    await p.locator('#sourceForeground').click()
    img = b'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><circle cx="60" cy="40" r="30" fill="red"/></svg>'
    await p.locator('#mediaFiles').set_input_files({'name': '원.svg', 'mimeType': 'image/svg+xml', 'buffer': img})
    video = bytes(await p.evaluate(MAKE_WEBM))
    await p.locator('#sourceMedia').click()
    await p.locator('#mediaFiles').set_input_files({'name': 'clip.webm', 'mimeType': 'video/webm', 'buffer': video})
    await p.locator('#audioFile').set_input_files({'name': 'tone.wav', 'mimeType': 'audio/wav', 'buffer': wav})
    await p.wait_for_function('!!J.ui.audioFile')
    await p.locator('#sourceLyrics').click()   # 배경·전경 탭에서는 곡·타이밍 섹션(#bpm)이 숨는다
    await p.locator('#bpm').fill('144'); await p.locator('#bpm').dispatch_event('change')
    await p.locator('#fontFile').set_input_files(LOCAL_TTF)
    await p.wait_for_function('J.ui.project.userFonts?.some(f=>f.file)')
    before = await p.evaluate('JSON.parse(JSON.stringify(J.ui.project))')
    # 포크: #btnSave → 이름 대화상자 → '....jizuraichi'. 우리: 「곡·소재 포함 저장」(#btnSaveAll)은 대화상자 없이 곡 제목.jizura
    await p.locator('#projectMenu summary').click()
    async with p.expect_download() as dl:
        await p.locator('#btnSaveAll').click()
    download = await dl.value
    assert download.suggested_filename == 'Portable test.jizura', download.suggested_filename
    data = await download_bytes(download)
    assert data[:8] == b'JIZURA01'
    q = await setup()
    await q.locator('#fileProject').set_input_files({'name': 'portable.jizura', 'mimeType': 'application/octet-stream', 'buffer': data})
    await q.wait_for_function("J.ui.project.title==='Portable test'&&!J.ui.projectBusy")
    assert await q.evaluate('JSON.parse(JSON.stringify(J.ui.project))') == before
    got = await q.evaluate('[J.mediaAssets.size,!!J.ui.audio,J.ui.audioFile.size,Array.from(J.mediaAssets.values()).map(a=>a.element.videoWidth||a.element.naturalWidth)]')
    assert got == [2, True, len(wav), [120, 120]], got
    sizes = await q.evaluate('async()=>{const data=await J.unpackProject(await J.packProject(J.ui.project,J.ui.audioFile));return data.files.map(e=>[e.kind,e.file.size])}')
    assert sizes[:3] == [['media', len(video)], ['media', len(img)], ['audio', len(wav)]], sizes
    assert sizes[3][0] == 'font' and sizes[3][1] > 1000, sizes
    # 잘린 파일은 현재 편집을 바꾸지 않고 거절한다
    await q.locator('#fileProject').set_input_files({'name': 'bad.jizura', 'mimeType': 'application/octet-stream', 'buffer': data[:-5]})
    await q.wait_for_function('!J.ui.projectBusy')
    assert await q.locator('#songTitle').input_value() == 'Portable test'
    await q.reload(); await q.wait_for_function('!!(window.J&&J.ui&&J.ui.audio)&&J.mediaAssets.size===2')
    assert await q.evaluate('J.ui.project.timing.bpm') == 144
    await q.locator('#btnRemoveAudio').click(); assert await q.evaluate('J.ui.audio') is None
    await q.locator('#btnUndo').click(); await q.wait_for_function('!!J.ui.audio')
    await q.locator('#btnRedo').click(); assert await q.evaluate('J.ui.audio') is None
    await q.screenshot(path=os.path.join(SHOTS, 'fork-portable-project-ko.png'), full_page=True)
    await q.locator('#projectMenu summary').click(); await q.locator('#btnNew').click()
    await q.locator('#newProjectAspect').select_option('1:1')
    await q.screenshot(path=os.path.join(SHOTS, 'fork-new-project-ko.png'))
    await q.locator('#btnCreateProject').click()
    state = await q.evaluate('[J.ui.project.title,J.ui.project.lyrics,J.ui.project.aspect,J.ui.project.timing.bpm,J.ui.audio,J.ui.project.audioAsset||null,J.mediaAssets.size,J.ui.plan.cuts.length,J.ui.project.media.items.length,J.ui.project.foreground.items.length]')
    assert state == ['', '', '1:1', 0, None, None, 0, 0, 0, 0], state
    assert await q.locator('#btnUndo').is_disabled() and await q.locator('#btnPrev').is_disabled()
    # 설정만 담긴 옛 JSON도 열리고, 이전 곡을 끌고 오지 않는다
    legacy = dict(before, title='Legacy', media={'items': []}, foreground={'items': []}); legacy.pop('audioAsset', None)
    await q.locator('#fileProject').set_input_files(json_file('old.json', legacy))
    await q.wait_for_function("J.ui.project.title==='Legacy'&&!J.ui.projectBusy")
    assert await q.evaluate('J.ui.audio') is None
    assert not errors, errors
    for pg in pages: await pg.close()

# ---------------------------------------------------------------- export_menu_test.cjs
async def test_export_menu(b, url):
    pg, errs = await new_page(b, url)
    await pg.locator('#btnTerms').click()
    text = await pg.locator('.terms-fork').inner_text()
    assert '이 사이트는 오리지널판을 기반으로 한 fork판입니다.' in text and '브라우저 안에서만 처리합니다' in text, text   # 포크 일본어 문구 → 우리 한국어 문구
    assert await pg.locator('.terms-fork a').get_attribute('href') == 'https://github.com/hirazisora/JIZURA'
    await pg.locator('#termsDlg button').click()
    await pg.locator('#projectMenu summary').click(); assert await pg.locator('#btnNew').is_visible()
    await pg.locator('#outputMenu summary').click()
    assert not await pg.locator('#btnNew').is_visible() and await pg.locator('#btnAE').is_visible()
    await pg.evaluate('''()=>{J.ui.project.videoSize={w:64,h:64};J.ui.project.durationOverride=.15;J.ui.project.lyrics='A';J.uiApi.syncUI();J.uiApi.replan();window.exportCalls=[];for(const key of ['exportMP4','exportPNGZip']){const original=J[key];J[key]=async opts=>{window.exportCalls.push({key,transparent:opts.transparent,quality:opts.quality,size:J.outputSize(opts.project)});return original(opts)}}}''')
    for menu, button, kind in [('menuMP4', 'btnMP4', 'mp4'), ('menuPNG', 'btnPNG', 'png'), ('menuPNGA', 'btnPNGA', 'pnga')]:
        if not await pg.locator('#outputMenu').evaluate('el=>el.open'): await pg.locator('#outputMenu summary').click()
        await pg.locator('#' + menu).click()
        assert await pg.locator('#exportDlg').is_visible() and await pg.locator('#outAspect').count() == 1
        assert await pg.locator('#outQuality').is_visible() == (kind == 'mp4')
        assert await pg.locator('#outAudio').is_visible() == (kind == 'mp4')
        assert await pg.locator('#outKey').is_visible() == (kind != 'pnga')
        if kind == 'mp4':
            await pg.locator('#outQuality').select_option('standard'); await pg.locator('#outFps').select_option('30')
        name = '동영상 테스트_' + kind
        await pg.locator('#exportFilename').fill(name + ('.mp4' if kind == 'mp4' else ''))
        await pg.screenshot(path=os.path.join(SHOTS, f'fork-export-{kind}-ko.png'))
        async with pg.expect_download() as dl:
            await pg.locator('#' + button).click()
        download = await dl.value
        assert download.suggested_filename == name + ('.mp4' if kind == 'mp4' else '.zip'), download.suggested_filename
        assert len(await download_bytes(download)) > 100
        await pg.wait_for_function('!J.ui.exporting'); await pg.locator('#btnCloseExport').click()
        await pg.wait_for_function("document.querySelector('#exportSettings').parentElement.id==='exportSettingsHome'")
        assert await pg.locator('#outFps').input_value() == '30'
    calls = await pg.evaluate('window.exportCalls')
    assert calls[0]['quality'] == 'standard' and [c['size'] for c in calls] == [[64, 64]] * 3, calls
    assert calls[1]['transparent'] is False and calls[2]['transparent'] is True, calls
    await pg.locator('#modePro').click(); await pg.locator('[data-tab="out"]').click()
    assert await pg.locator('#outQuality').is_visible() and await pg.locator('#btnPNG').is_visible()
    await pg.locator('#outputMenu summary').click(); await pg.locator('#menuPNG').click(); await pg.keyboard.press('Escape')
    await pg.wait_for_function("!document.querySelector('#exportDlg').open&&document.querySelector('#exportSettings').parentElement.id==='exportSettingsHome'")
    assert await pg.locator('#btnMP4').is_visible()
    normalized = await pg.evaluate("[['a.mp4','.mp4'],['a.MP4','.mp4'],['  a/b:c?  ','.zip'],['CON','.json'],['...','.zip'],['','.mp4']].map(([name,ext])=>J.exportFilename(name,ext,'fallback'))")
    assert normalized == ['a.mp4', 'a.mp4', 'a_b_c_.zip', '_CON.json', 'fallback.zip', 'fallback.mp4'], normalized
    await pg.locator('#outputMenu summary').click(); await pg.locator('#btnAE').click(); await pg.locator('#saveFilename').fill('AE 테스트')
    async with pg.expect_download() as dl:
        await pg.locator('#filenameDlg button[value="save"]').click()
    assert (await dl.value).suggested_filename == 'AE 테스트.json'
    # 포크: #btnSave의 이름 대화상자를 취소해도 projectBusy가 남지 않는다. 우리 포함 저장에는 이름 대화상자가 없어,
    # 같은 대화상자(#filenameDlg)를 쓰는 AE 내보내기에서 취소 경로를 확인한다.
    await pg.locator('#outputMenu summary').click(); await pg.locator('#btnAE').click()
    await pg.locator('#filenameDlg button[value="cancel"]').click()
    assert await pg.evaluate('!!J.ui.projectBusy') is False and not await pg.locator('#filenameDlg').is_visible()
    assert not errs, errs
    await pg.close()

# ---------------------------------------------------------------- cropped_edges_test.cjs
CROPPED_REPORT = r'''()=>{
 const failures=[],check=(v,msg)=>{if(!v)failures.push(msg)},edges=['left','right','top','bottom'];
 for(const layer of ['media','foreground'])for(const type of ['image','video'])for(const [width,height] of [[1920,1080],[1080,1920],[100,2000],[2000,100]])for(let mask=1;mask<16;mask++)for(let seed=0;seed<8;seed++){
  const p=J.defaultProject(),item={id:'test',name:'test',type,width,height,croppedEdges:Object.fromEntries(edges.map((e,i)=>[e,!!(mask&(1<<i))]))};
  const placement=J.autoMediaPlacement(p,{itemId:item.id,seed,technique:'pushIn'},item,{W:1920,H:1080},layer),r=J.mediaPlacementRect(placement,width,height,1920,1080);
  check(!(mask&1)||-r.x/r.w>=.2-1e-8,'left');check(!(mask&2)||(r.x+r.w-1)/r.w>=.2-1e-8,'right');check(!(mask&4)||-r.y/r.h>=.2-1e-8,'top');check(!(mask&8)||(r.y+r.h-1)/r.h>=.2-1e-8,'bottom');check(Math.abs(r.w*1920/(r.h*1080)-width/height)<1e-8,'aspect');
 }
 const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
 let strong=0,weak=0;
 for(let seed=1;seed<=40;seed++){
  const p=J.defaultProject();p.seed=seed;p.lyrics='test';p.lyricEffects={autoPlacement:true,avoidForeground:true,avoidanceStrength:1};p.foreground={items:[{id:'fg',name:'fg',type:'image',width:1920,height:1080}],cutOverrides:{0:{technique:'none',placement:{cx:.5,cy:.5,w:.55}}}};
  const plan=J.plan(p),a=plan.cuts.find(c=>c.line>=0),box={x:.225,y:.225,w:.55,h:.55};strong+=overlap(a.area,box);
  p.lyricEffects.avoidanceStrength=.5;weak+=overlap(J.plan(p).cuts.find(c=>c.line>=0).area,box);
  p.lyricEffects.avoidanceStrength=0;const zero=J.plan(p).cuts.find(c=>c.line>=0).area;p.lyricEffects.avoidForeground=false;check(JSON.stringify(zero)===JSON.stringify(J.plan(p).cuts.find(c=>c.line>=0).area),'zero matches off');
 }
 check(strong<1e-8,'full avoidance');check(weak>strong+.1,'weaker allows overlap');check(J.lyricEffectSettings({}).avoidanceStrength===1,'default');
 return {failures:[...new Set(failures)],strong,weak};
}'''

async def test_cropped_edges(b, url):
    pg, errs = await new_page(b, url)
    await pg.locator('#modePro').click()
    result = await pg.evaluate(CROPPED_REPORT)
    assert result['failures'] == [], result
    edge = pg.locator('[data-cropped-edge="left"]')
    for layer in ['foreground', 'media']:
        await pg.locator('#sourceForeground' if layer == 'foreground' else '#sourceMedia').click()
        await pg.locator('#mediaFiles').set_input_files(svg('test.svg', '<rect width="100" height="100" fill="red"/>', 100, 100))
        await pg.locator('.media-technique').select_option('pushIn')
        await edge.check()
        assert await pg.evaluate('layer=>J.ui.project[layer].items[0].croppedEdges.left', layer) is True
        await pg.locator('#btnUndo').click(); assert not await edge.is_checked()
        await pg.locator('#btnRedo').click(); assert await edge.is_checked()
    await pg.locator('[data-tab="tech"]').click(); await pg.locator('#lyricAutoPlacement').check()
    await pg.locator('#lyricAvoidanceStrength').evaluate("el=>{el.value='0.5';}")
    await pg.locator('#lyricAvoidanceStrength').dispatch_event('input'); await pg.wait_for_timeout(200)
    assert await pg.evaluate('J.ui.project.lyricEffects.avoidanceStrength') == .5
    await reload(pg); await pg.locator('#sourceForeground').click()
    assert await edge.is_checked()
    assert await pg.evaluate('J.ui.project.lyricEffects.avoidanceStrength') == .5
    await pg.locator('[data-tab="tech"]').click()
    await pg.screenshot(path=os.path.join(SHOTS, 'fork-cropped-edges-ko.png'), full_page=True)
    assert not errs, errs
    await pg.close()

# ---------------------------------------------------------------- cut_details_test.cjs
async def test_cut_details(b, url):
    pg, errs = await new_page(b, url)
    await pg.evaluate('''()=>{
      const p=J.defaultProject();p.lyrics='[00:00]처음 가사/다음 가사\\n[00:04]마지막 가사';p.durationOverride=8;
      for(const layer of ['foreground','media'])p[layer]={...p[layer],manualCuts:true,cutCount:2,timing:{lineTimes:{0:0,1:4}},cutOverrides:{0:{technique:'none'},1:{technique:'none'}}};
      J.ui.project=p;J.uiApi.syncUI();J.uiApi.replan();
    }''')
    assert not errs, errs
    original = await pg.evaluate('JSON.stringify(J.ui.project)')
    modal = pg.locator('#cutDetailsDialog')
    await pg.locator('#timelineLinks [data-action="details"][data-layer="lyrics"]').first.dispatch_event('pointerdown', {'button': 0})
    await modal.locator('[data-detail-field="text"]').fill('변경 취소')
    await modal.get_by_role('button', name='취소', exact=True).click()
    assert await pg.evaluate('JSON.stringify(J.ui.project)') == original
    # 포크: 행 목록 #lineList .cut-details-open → 컷 패널 ②의 상세 편집 버튼(Task 7)
    panel = await select_lyric_cut(pg, 0, 0)
    await panel.locator('[data-cut-ctl="details"]').click()
    await modal.locator('[data-detail-field="text"]').fill('편집한 컷')
    await modal.locator('[data-detail-field="opacity"]').fill('42')
    await modal.locator('[data-detail-field="blend"]').select_option('overlay')
    await modal.locator('[data-detail-field="hold"]').select_option('still')
    await modal.locator('[data-detail-field="area.w"]').fill('0.6')
    await modal.get_by_role('button', name='적용', exact=True).click()
    saved = await pg.evaluate('()=>{J.uiApi.replan();return J.ui.plan.cuts.filter(c=>c.line>=0&&Number.isInteger(c.part)).map(c=>({text:c.text,opacity:c.opacity,blend:c.blend,area:c.area}));}')
    assert saved[0]['text'] == '편집한 컷' and saved[0]['opacity'] == 42 and saved[0]['blend'] == 'overlay' and saved[0]['area']['w'] == .6, saved[0]
    assert saved[1]['text'] != saved[0]['text']
    for layer in ['foreground', 'media']:
        await pg.locator(f'#timelineLinks [data-action="details"][data-layer="{layer}"]').first.dispatch_event('pointerdown', {'button': 0})
        await modal.locator('[data-detail-field="technique"]').select_option('beatPulse')
        await modal.locator('[data-detail-field="bpm"]').fill('90')
        await modal.locator('[data-detail-field="placement.angle"]').fill('25')
        await modal.get_by_role('button', name='적용', exact=True).click()
        value = await pg.evaluate('layer=>{J.uiApi.replan();return J.ui.plan[layer].cuts[0];}', layer)
        assert value['technique'] == 'beatPulse' and value['bpm'] == 90 and value['placement']['angle'] == 25, value
    await pg.evaluate("()=>{J.ui.project.timelineLinks=[{a:'l:1:0',b:'f:1'}];J.uiApi.replan();}")
    await pg.locator('#timelineLinks [data-action="details"][data-layer="foreground"][data-index="1"]').dispatch_event('pointerdown', {'button': 0})
    await modal.locator('[data-detail-field="start"]').fill('4.5')
    await modal.get_by_role('button', name='적용', exact=True).click()
    starts = '[J.ui.plan.cuts.find(c=>c.line===1&&c.part===0).start,J.ui.plan.foreground.cuts[1].start]'
    assert await pg.evaluate(starts) == [4.5, 4.5]
    await pg.locator('#btnUndo').click()
    assert await pg.evaluate(starts) == [4, 4]
    await pg.evaluate('J.uiApi.flushSave()'); await reload(pg)
    assert await pg.evaluate('J.ui.plan.cuts.find(c=>c.line===0&&c.part===0).text') == '편집한 컷'
    assert await pg.evaluate('J.ui.plan.media.cuts[0].bpm') == 90
    assert not errs, errs
    await pg.close()

# ---------------------------------------------------------------- emphasis_frontmost_test.cjs
EMPHASIS = r'''() => {
  const project = J.defaultProject();
  project.title = ''; project.durationOverride = 4;
  project.fx = { ...project.fx, koma: 0, chroma: 0, texture: 0, hud: 'off' };
  project.overrides = { 0: { single: true }, 1: { single: true } };
  const element = document.createElement('canvas'); element.width = 320; element.height = 180;
  const x = element.getContext('2d'); x.fillStyle = '#ff0000'; x.fillRect(0, 0, 320, 180);
  const item = { id: 'emphasis-foreground', name: 'red.png', type: 'image', width: 320, height: 180 };
  J.mediaAssets.set(item.id, { element, type: 'image' });
  project.foreground = { ...project.foreground, items: [item], manualCuts: true, cutCount: 1, timing: { lineTimes: { 0: 0 } },
    cutOverrides: { 0: { itemId: item.id, technique: 'none', entrance: 'none', departure: 'none', placement: { cx: .5, cy: .5, w: 1, h: 1, lockAspect: false } } } };
  J.LAYOUTS.__emphasisProbe = { render(env) { env.rect(env.W * .2, env.H * .2, env.W * .6, env.H * .6, '#ffffff'); } };
  const cases = [
    { name: 'strong default', lyrics: '[00:00]*강조 표시*', front: true },
    { name: 'strong with saved OFF', lyrics: '[00:00]*강조 표시*', override: false, front: true },
    { name: 'normal OFF', lyrics: '[00:00]일반 표시', override: false, front: false },
    { name: 'normal ON', lyrics: '[00:00]일반 표시', override: true, front: true },
    { name: 'escaped asterisks', lyrics: '[00:00]\\*강조 표시\\*', front: false },
    { name: 'retained strong with saved OFF', lyrics: '{\n[00:00]*강조 표시*\n[00:01]일반 표시\n}', override: false, front: true, time: 1.5 },
  ];
  const out = cases.map(test => {
    const p = { ...project, lyrics: test.lyrics, lyricCutOptions: test.override == null ? {} : { '0:0': { frontmost: test.override } } };
    const plan = J.plan(p); plan.media = J.planMedia(p, plan); plan.foreground = J.planMedia(p, plan, null, 'foreground');
    plan.events = []; plan.hud = false;
    for (const cut of plan.cuts) Object.assign(cut, { layout: '__emphasisProbe', cam: 'none', decor: [], trans: null, enter: 'cut', exit: 'cut', hold: 'still', groupExit: 'cut', groupOutDur: 0 });
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = Math.round(320 * plan.H / plan.W);
    const ctx = canvas.getContext('2d'), renderer = new J.Renderer();
    renderer.frame(ctx, plan, test.time || .5, { scale: 320 / plan.W, noPost: true, noGhost: true, noHud: true });
    return { name: test.name, expected: test.front, frontmost: plan.cuts[0].frontmost,
      pixel: [...ctx.getImageData(160, Math.floor(canvas.height / 2), 1, 1).data] };
  });
  delete J.LAYOUTS.__emphasisProbe; J.mediaAssets.delete(item.id);
  return out;
}'''

async def test_emphasis_frontmost(b, url):
    pg, errs = await new_page(b, url)
    for r in await pg.evaluate(EMPHASIS):
        assert r['frontmost'] == r['expected'], r
        assert r['pixel'] == ([255, 255, 255, 255] if r['expected'] else [255, 0, 0, 255]), r
    assert not errs, errs
    await pg.close()

# ---------------------------------------------------------------- lyric_compositing_test.cjs
COMPOSITING = r'''async () => {
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const p=J.defaultProject();p.lyrics='[00:00]Same words';p.videoSize={w:320,h:180};
  p.fx={...p.fx,koma:0,chroma:0,texture:0,hud:'off',density:1};p.overrides={0:{single:true}};
  const defaults=J.plan(p).cuts[0];
  check(defaults.blend==='normal'&&defaults.opacity===100,'new cuts default to Normal and 100%');
  const values=plan=>plan.cuts.filter(c=>Number.isInteger(c.part)).map(c=>({blend:c.blend,opacity:c.opacity}));
  const randomProject={...p,lyrics:'{\n[00:00]First/phrase\n[00:02]*Second*\n[00:04]~Third~\n}',overrides:{},
    lyricEffects:{randomBlend:true,randomOpacity:true,opacityMin:20,opacityMax:80}};
  const randomPlan=J.plan(randomProject), randomCuts=randomPlan.cuts.filter(c=>Number.isInteger(c.part));
  check(randomCuts.length>=4,'manual phrase cuts receive separate settings');
  check(equal(values(randomPlan),values(J.plan(randomProject))),'random settings are stable during preview/export');
  check(!equal(values(randomPlan),values(J.plan({...randomProject,seed:p.seed+1}))),'shuffle rerolls the cut settings');
  check(randomCuts.every(c=>c.opacity>=20&&c.opacity<=80&&J.LYRIC_BLENDS.includes(c.blend)),'random values stay inside the configured range');
  check(randomCuts.find(c=>c.emphasis).opacity>=60&&randomCuts.find(c=>c.suppressed).opacity<=40,'emphasis selects the upper third and suppression the lower third');
  for(const seed of [1,2,3,4,5]) {
    const q={...p,seed,lyricEffects:randomProject.lyricEffects};
    const plain=J.plan(q).cuts[0], strong=J.plan({...q,lyrics:'[00:00]*Same words*'}).cuts[0], soft=J.plan({...q,lyrics:'[00:00]~Same words~'}).cuts[0];
    check(strong.opacity>=plain.opacity&&plain.opacity>=soft.opacity,'control characters bias otherwise identical draws');
  }
  const fixed=J.plan({...randomProject,lyricEffects:{randomOpacity:true,opacityMin:37,opacityMax:37}});
  check(values(fixed).every(c=>c.opacity===37),'equal min/max is supported');
  const fractional=J.plan({...randomProject,lyricEffects:{randomOpacity:true,opacityMin:37.2,opacityMax:37.6}});
  check(values(fractional).every(c=>c.opacity>=37.2&&c.opacity<=37.6),'fractional imported bounds must also be respected');
  const manual=J.plan({...randomProject,lyricCutOptions:{'0:0':{blend:'overlay',opacity:0}}});
  check(manual.cuts[0].blend==='overlay'&&manual.cuts[0].opacity===0,'manual settings override randomization, including zero');
  const invalid=J.plan({...p,lyricCutOptions:{'0:0':{blend:'invalid',opacity:'invalid'}}}).cuts[0];
  check(invalid.blend==='normal'&&invalid.opacity===100,'invalid imported values fall back safely');
  const cv=document.createElement('canvas');cv.width=320;cv.height=180;
  const ctx=cv.getContext('2d'), renderer=new J.Renderer();
  const colors=[[208,112,48],[32,96,192]];
  const asset=(id,color)=>{
    const element=document.createElement('canvas');element.width=320;element.height=180;
    const x=element.getContext('2d');x.fillStyle=color;x.fillRect(0,0,320,180);
    J.mediaAssets.set(id,{element,type:'image'});
    return {id,name:id+'.png',type:'image',width:320,height:180};
  };
  const bg=asset('blend-background','#4080c0'), fg=asset('blend-foreground','#6096d2');
  const layer=item=>({...J.defaultProject().media,items:[item],manualCuts:true,cutCount:1,
    timing:{lineTimes:{0:0}},cutOverrides:{0:{itemId:item.id,technique:'none',placement:{cx:.5,cy:.5,w:1,h:1,lockAspect:false,angle:0}}}});
  J.LAYOUTS.__blendProbe={render(env){
    const color=colors[env.cut.line%2];
    for(let i=0;i<2;i++)env.rect(env.W*.2,env.H*.2,env.W*.6,env.H*.6,`rgb(${color.join(',')})`);
  }};
  const makePlan=project=>{
    const plan=J.plan(project);plan.media=J.planMedia(project,plan);plan.foreground=J.planMedia(project,plan,null,'foreground');
    plan.events=[];plan.hud=false;
    for(const c of plan.cuts)Object.assign(c,{layout:'__blendProbe',cam:'none',decor:[],trans:null,contentScale:1,groupExit:'cut',groupOutDur:0});
    return plan;
  };
  const pixel=()=>Array.from(ctx.getImageData(160,90,1,1).data).slice(0,3);
  const mix=(base,source,mode,opacity)=>base.map((b,i)=>{
    const s=source[i], blended=mode==='multiply'?b*s/255:mode==='screen'?255-(255-b)*(255-s)/255:mode==='overlay'?(b<128?2*b*s/255:255-2*(255-b)*(255-s)/255):s;
    return Math.round(b+(blended-b)*opacity/100);
  });
  const close=(actual,expected,label)=>check(actual.every((c,i)=>Math.abs(c-expected[i])<=2),`${label}: ${actual} vs ${expected}`);
  const opts={scale:320/J.plan(p).W,noPost:true,noGhost:true,noHud:true};
  let cases=0;
  for(const scene of ['none','background','foreground','both']) {
    const q={...p,media:scene==='background'||scene==='both'?layer(bg):p.media,foreground:scene==='foreground'||scene==='both'?layer(fg):p.foreground};
    const plan=makePlan(q), cut=plan.cuts[0];cut.frontmost=true;
    renderer.frame(ctx,plan,.5,{...opts,noLyrics:true});const base=pixel();
    for(const blend of J.LYRIC_BLENDS)for(const opacity of [0,25,100]) {
      Object.assign(cut,{blend,opacity});renderer.frame(ctx,plan,.5,opts);
      close(pixel(),mix(base,colors[0],blend,opacity),`${scene} ${blend} ${opacity}%`);cases++;
    }
  }
  for(const scene of ['background','foreground']) {
    const q={...p,lyrics:'[00:00]First\n[00:01]Second',durationOverride:2,
      media:scene==='background'?layer(bg):p.media,foreground:scene==='foreground'?layer(fg):p.foreground,
      lyricCutOptions:{'0:0':{blend:'multiply',opacity:35},'1:0':{blend:'overlay',opacity:72}}};
    const plan=makePlan(q);plan.cuts.forEach(c=>{c.frontmost=scene==='foreground';});
    Object.assign(plan.cuts[1],{trans:'wipe',transDur:.4,transP:{dir:'R'}});
    renderer.frame(ctx,plan,1.1,{...opts,noLyrics:true});const base=pixel();
    for(const t of [1.0834,1.3334,1.0834]) {
      renderer.frame(ctx,plan,t,opts);
      const previous=t<1.2;
      close(pixel(),mix(base,colors[previous?0:1],previous?'multiply':'overlay',previous?35:72),`${scene} transition preserves each cut's composite`);
    }
  }
  const stackedProject={...p,lyrics:'{\n[00:00]First\n[00:01]Second\n}',media:layer(bg),durationOverride:2,
    lyricCutOptions:{'0:0':{blend:'multiply',opacity:35},'1:0':{blend:'overlay',opacity:72}}};
  const stacked=makePlan(stackedProject);
  renderer.frame(ctx,stacked,1.5,{...opts,noLyrics:true});const base=pixel();
  renderer.frame(ctx,stacked,1.5,opts);
  const expected=mix(mix(base,colors[0],'multiply',35),colors[1],'overlay',72);
  close(pixel(),expected,'retained cuts use separate compositing');
  const buffer=renderer.lyricCutLayer;
  for(let i=0;i<12;i++)renderer.frame(ctx,stacked,1+i/24,opts);
  check(renderer.lyricCutLayer===buffer,'retained cuts reuse one composite canvas');
  const encoded=await J.exportMP4({plan:stacked,project:stackedProject,quality:'standard'});
  const video=document.createElement('video'),url=URL.createObjectURL(encoded.blob);
  try {
    video.src=url;
    await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=()=>reject(new Error('MP4 decode failed'));});
    await new Promise(resolve=>{video.onseeked=resolve;video.currentTime=1.5;});
    ctx.drawImage(video,0,0,320,180);
    check(pixel().every((c,i)=>Math.abs(c-expected[i])<10),'MP4 export preserves per-cut blending');
  }finally{video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
  J.mediaAssets.delete(bg.id);J.mediaAssets.delete(fg.id);delete J.LAYOUTS.__blendProbe;
  return {fixture:randomProject,cases,bytes:encoded.blob.size};
}'''

async def test_lyric_compositing(b, url):
    pg, errs = await new_page(b, url)
    report = await pg.evaluate(COMPOSITING)
    print('  lyric compositing', report['cases'], report['bytes'])
    async def load(project):
        await pg.locator('#fileProject').set_input_files(json_file('composite.json', project))
        await pg.wait_for_function('lyrics=>J.ui.project.lyrics===lyrics', arg=project['lyrics'])
    project = lambda: pg.evaluate('structuredClone(J.ui.project)')
    cuts = lambda: pg.evaluate('J.ui.plan.cuts.filter(c=>Number.isInteger(c.part)).map(c=>({line:c.line,part:c.part,blend:c.blend,opacity:c.opacity}))')
    await pg.locator('#modePro').click()
    await load(dict(report['fixture'], lyricEffects={}))
    assert await pg.locator('#lyricBlend, #lyricOpacity').count() == 0, 'global lyric controls are removed'
    # 포크: 행 목록의 .lyric-cut-option[data-line="0"][data-part="0"] → 컷 패널 ②(Task 7). 다시 그리면 요소가 바뀌므로 매번 고른다.
    async def first():
        return await select_lyric_cut(pg, 0, 0)
    assert await (await first()).locator('.lyric-cut-blend').input_value() == 'normal'
    assert await (await first()).locator('.lyric-cut-opacity').input_value() == '100'
    await (await first()).locator('.lyric-cut-blend').select_option('overlay')
    op = (await first()).locator('.lyric-cut-opacity'); await op.fill('48'); await op.press('Tab')
    assert (await cuts())[0] == {'line': 0, 'part': 0, 'blend': 'overlay', 'opacity': 48}
    assert (await cuts())[1]['opacity'] == 100, 'editing one cut leaves the adjacent cut at its default'
    await pg.locator('#btnUndo').click(); assert (await cuts())[0]['opacity'] == 100
    await pg.locator('#btnRedo').click(); assert (await cuts())[0]['opacity'] == 48
    await pg.locator('[data-tab="tech"]').click()
    assert not await pg.locator('#lyricOpacityRange').is_visible()
    await pg.locator('#lyricRandomBlend').check(); await pg.locator('#lyricRandomOpacity').check()
    assert await pg.locator('#lyricOpacityRange').is_visible()
    for sel, value in [('#lyricOpacityMin', '20'), ('#lyricOpacityMax', '80')]:
        await pg.locator(sel).fill(value); await pg.locator(sel).press('Tab')
    await pg.locator('#btnShuffle').click()
    assert (await cuts())[0]['opacity'] == 48, 'manual opacity survives shuffle'
    assert (await cuts())[0]['blend'] == 'overlay', 'manual blend survives shuffle'
    await (await first()).locator('.lyric-composite-auto').click()
    assert (await project())['lyricCutOptions'].get('0:0') is None
    assert await (await first()).locator('.lyric-cut-blend').input_value() == ''
    await pg.locator('#lineList .lock').first.click()
    locked = [c for c in await cuts() if c['line'] == 0]
    await pg.locator('#btnShuffle').click()
    assert [c for c in await cuts() if c['line'] == 0] == locked, 'locked cuts preserve their random blend and opacity'
    await (await first()).locator('.lyric-cut-blend').select_option('screen')
    locked_opacity = locked[0]['opacity']
    await pg.locator('#lyricOpacityMax').fill('25'); await pg.locator('#lyricOpacityMax').press('Tab')
    assert (await cuts())[0]['opacity'] == locked_opacity, 'editing a locked blend must not unlock its opacity'
    await pg.locator('#btnUndo').click(); await pg.locator('#btnUndo').click()
    assert [c for c in await cuts() if c['line'] == 0] == locked
    # 뒤집힌 끝값은 UI에서 바로잡는다
    await pg.locator('#lyricOpacityMin').fill('90'); await pg.locator('#lyricOpacityMin').press('Tab')
    assert await pg.locator('#lyricOpacityMax').input_value() == '90'
    await pg.locator('#btnUndo').click()
    saved, resolved = await project(), await cuts()
    await pg.evaluate('J.uiApi.flushSave()'); await pg.reload()
    await pg.wait_for_function("window.J&&J.ui&&J.ui.project&&J.ui.project.lyrics.includes('Third')")
    assert await project() == saved and await cuts() == resolved
    await pg.locator('[data-tab="tech"]').click()
    await pg.screenshot(path=os.path.join(SHOTS, 'fork-lyric-compositing-ko.png'), full_page=True)
    legacy = dict(report['fixture'], lyricEffects={}, lyricCutOptions={}, overrides={}, media=dict(report['fixture']['media'], blend='screen', opacity=45))
    await load(legacy)
    await pg.wait_for_function("J.ui.plan.cuts.filter(c=>Number.isInteger(c.part)).every(c=>c.blend==='screen'&&c.opacity===45)")
    assert (await project())['media']['opacity'] == 100, 'legacy global settings are migrated exactly once'
    await pg.evaluate('J.uiApi.flushSave()'); await pg.reload()
    await pg.wait_for_function('window.J&&J.ui&&J.ui.plan&&J.ui.plan.cuts[0].opacity===45')
    assert not errs, errs
    await pg.close()

# ---------------------------------------------------------------- lyric_features_test.cjs
LYRIC_FEATURES = r'''async () => {
  const check = (condition, label) => { if (!condition) throw new Error(label); };
  const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  const overlap = (a,b) => Math.max(0, Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)) * Math.max(0, Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  const p = J.defaultProject();
  p.lyrics = '{\n[00:00]First/phrase\n[00:02]*Second*\n[00:04]~Third~\n}\n[00:06]Fourth\\nFifth';
  p.fx.density = 1; p.fx.koma = 0; p.fx.hud = 'off'; p.videoSize = {w:320,h:180};
  const plan = J.plan(p), group = plan.cuts.filter(c => c.group != null);
  check(group.length === 4, 'separate phrase cuts must remain in the timeline');
  check(group.every(c => c.displayEnd === 6), 'a group lasts through its last lyric cut');
  check(group[0].end < group[0].displayEnd, 'retention must not change timeline boundaries');
  check(J.lyricCutsAt(plan,4.5).length === 4 && J.lyricCutsAt(plan,.1).length === 1, 'seek backward and forward must reconstruct the stack');
  check(J.lyricCutsAt(plan,6).every(c => c.group == null), 'group disappears at its end');
  const multiline = plan.cuts.filter(c => c.line === 3);
  check(multiline.length === 1 && multiline[0].text === 'Fourth\nFifth', 'inline line breaks stay inside one cut');
  check(J.splitLines(multiline[0].text,2) === multiline[0].text, 'explicit rows are not rewrapped');
  const glyphs = J.layoutText({text:multiline[0].text,font:multiline[0].params.font,size:40});
  check(new Set(glyphs.map(g => g.y)).size === 2 && !glyphs.some(g => g.ch === '\n'), 'line breaks render as two rows');
  check(group.find(c => c.line === 1).frontmost, 'asterisk emphasis enables frontmost');
  check(group.find(c => c.line === 2).motionScale < 1, 'suppression reduces motion');
  check(plan.cuts.every(c => !c.area), 'automatic areas default to off');
  const fg = {id:'lyric-test-foreground',name:'foreground.png',type:'image',width:640,height:360};
  const placement = {cx:.65,cy:.5,w:.4,h:.8,lockAspect:false,angle:15};
  p.foreground = {...p.foreground,items:[fg],manualCuts:true,cutCount:2,
    cutOverrides:{0:{itemId:fg.id,technique:'none',placement},1:{itemId:fg.id,technique:'none',placement:{...placement,cx:.6,angle:-15}}},timing:{lineTimes:{0:0,1:3}}};
  p.lyricEffects = {autoPlacement:true,avoidForeground:true};
  const auto = J.plan(p), fore = J.planMedia(p,auto,null,'foreground');
  for (const cut of auto.cuts.filter(c => c.line < 3 && !c.emphasis)) {
    for (const f of fore.cuts.filter(f => f.start < cut.end && f.end + .6 > cut.start))
      check(overlap(cut.area,J.foregroundBounds(p,auto,f)) < 1e-8, 'automatic area must avoid all overlapping foreground cuts');
  }
  const words = '[00:00]First\n[00:01]Second\n[00:02]Third';
  const groupedProject = {...p,seed:1234,lyrics:`{\n${words}\n}\n[00:04]Outside`,overrides:{},
    foreground:{...p.foreground,cutOverrides:{
      0:{itemId:fg.id,technique:'none',placement:{cx:.65,cy:.5,w:.7,h:1,angle:0,lockAspect:false}},
      1:{itemId:fg.id,technique:'none',placement:{cx:.5,cy:.3,w:1,h:.6,angle:0,lockAspect:false}},
    },timing:{lineTimes:{0:0,1:2}}}};
  const groupedPlan = J.plan(groupedProject);
  const individualPlan = J.plan({...groupedProject,lyrics:words+'\n[00:04]Outside'});
  const retained = groupedPlan.cuts.filter(c => c.group != null);
  check(retained.length === 3 && retained.every(c => c.displayEnd === 4), 'independent areas preserve grouped lifetimes');
  check(new Set(retained.map(c => JSON.stringify(c.area))).size === 3, 'retained cuts must receive their own varied areas');
  check(same(groupedPlan.cuts.map(c => c.area),individualPlan.cuts.map(c => c.area)), 'braces must not change per-cut automatic placement');
  const active = J.lyricCutsAt(groupedPlan,2.5).map(J.lyricRenderCut);
  check(active.length === 3 && same(active.map(c => c.area),retained.map(c => c.area)), 'simultaneously retained lyrics render with their individual areas');
  check(same(retained.map(c => c.area),J.plan(groupedProject).cuts.filter(c => c.group != null).map(c => c.area)), 'grouped areas are reproducible');
  check(!same(retained.map(c => c.area),J.plan({...groupedProject,seed:1235}).cuts.filter(c => c.group != null).map(c => c.area)), 'shuffle varies grouped areas');
  const strong = auto.cuts.find(c => c.emphasis);
  check(overlap(strong.area,J.foregroundBounds(p,auto,fore.cuts[0])) > .05, 'emphasis ignores foreground avoidance');
  const noAvoid = J.plan({...p,lyricEffects:{autoPlacement:true,avoidForeground:false}});
  check(noAvoid.cuts[0].area.w * noAvoid.cuts[0].area.h > auto.cuts[0].area.w * auto.cuts[0].area.h, 'avoidance off restores unconstrained area');
  const variant = type => {
    const q = {...p,lyrics:type === 'strong' ? '*Same words*' : type === 'soft' ? '~Same words~' : 'Same words',overrides:{0:{single:true}},lyricEffects:{autoPlacement:true,avoidForeground:false}};
    return J.plan(q).cuts[0];
  };
  const normal = variant('normal'), big = variant('strong'), small = variant('soft');
  check(big.area.w * big.area.h > normal.area.w * normal.area.h && small.area.w * small.area.h < normal.area.w * normal.area.h, 'control characters scale the area');
  check(same(auto.cuts.map(c => c.area),J.plan(p).cuts.map(c => c.area)), 'placement must be deterministic');
  check(!same(auto.cuts.map(c => c.area),J.plan({...p,seed:p.seed+1}).cuts.map(c => c.area)), 'shuffle changes automatic placement');
  const manual = {x:.1,y:.1,w:.3,h:.2,angle:20,lockAspect:true};
  const manualProject = {...p,overrides:{0:{area:manual}}};
  check(same(J.plan(manualProject).cuts[0].area,manual), 'manual area wins over automatic placement');
  const shuffled = {...manualProject,...J.omakase(manualProject)};
  check(same(J.plan(shuffled).cuts[0].area,manual), 'omakase retains a manual area');
  const cover = {...p,foreground:{...p.foreground,cutCount:1,cutOverrides:{0:{itemId:fg.id,technique:'none',layout:'cover'}},timing:{lineTimes:{0:0}}}};
  check(J.plan(cover).cuts.every(c => !c.area || c.area.w > 0 && c.area.h > 0), 'full-stage foreground must not create an empty or invalid area');
  const short = J.plan({...p,durationOverride:6.1});
  check(short.cuts.every(c => (c.displayEnd ?? c.end) <= short.duration), 'retention respects the video duration');
  const span = J.plan({...p,lyrics:'*First/Second*',overrides:{},lyricEffects:{autoPlacement:false}});
  check(span.cuts.filter(c => Number.isInteger(c.part)).every(c => c.frontmost), 'emphasis spans manual cut boundaries');
  const animated = J.plan({...p,lyrics:'Same words',overrides:{0:{single:true,enter:'zoom',exit:'cut',hold:'still',treat:'none'}},lyricEffects:{autoPlacement:false}});
  const motionCanvas = document.createElement('canvas'), motionRenderer = new J.Renderer(), drawFx = J.drawFx;
  const motions = [];
  try {
    J.drawFx = (env,item) => { motions.push({x:item.x,y:item.y,size:item.size,sx:item.sx??1,sy:item.sy??1}); };
    for(const motionScale of [1,.25]) {
      const cut = {...animated.cuts[0],motionScale}, lt = cut.inDur*.4;
      const env=motionRenderer.makeEnv(motionCanvas.getContext('2d'),animated,cut,animated.style.schemes[0],{pass:'main',t:lt,lt,ltb:lt,step:2,scale:1,allowFilter:false});
      J.mainDraw(env,{text:cut.text,font:cut.params.font||'gothic_black',size:80,x:100,y:100});
    }
  } finally {J.drawFx=drawFx;}
  const distance = item => Math.abs(item.size-80)+Math.abs(item.sx-1)*80+Math.abs(item.sy-1)*80+Math.abs(item.x-100)+Math.abs(item.y-100);
  check(distance(motions[0])>0 && distance(motions[1])<distance(motions[0])*.5, 'suppression must actually reduce animation amplitude');
  const cv = document.createElement('canvas'); cv.width=320; cv.height=180;
  const ctx = cv.getContext('2d'), source = document.createElement('canvas'); source.width=640;source.height=360;
  source.getContext('2d').fillStyle='#00ff00';source.getContext('2d').fillRect(0,0,640,360);
  J.mediaAssets.set(fg.id,{element:source,type:'image'});
  const renderProject = {...p,lyricEffects:{autoPlacement:false},foreground:{...p.foreground,cutCount:1,
    cutOverrides:{0:{itemId:fg.id,technique:'none',entrance:'none',departure:'none',placement:{cx:.5,cy:.5,w:.6,h:.6,lockAspect:false,angle:0}}},timing:{lineTimes:{0:0}}}};
  const rp = J.plan(renderProject);rp.foreground=J.planMedia(renderProject,rp,null,'foreground');
  rp.media={cuts:[],opacity:100,blend:'normal'};rp.events=[];rp.fx.chroma=0;rp.fx.texture=0;
  const calls=[];
  J.LAYOUTS.__lyricProbe={render(env){
    calls.push({line:env.cut.line,out:env.pOut,end:env.cut.end});
    const rects=[[0,.1,.6,.6,'#ff0000'],[.25,.25,.5,.5,'#0000ff'],[.4,.1,.3,.6,'#ffff00']];
    const r=rects[env.cut.line];if(r)env.rect(r[0]*env.W,r[1]*env.H,r[2]*env.W,r[3]*env.H,r[4]);
  }};
  for(const c of rp.cuts) Object.assign(c,{layout:'__lyricProbe',cam:'none',decor:[],trans:null,contentScale:1,groupExit:'cut',groupOutDur:0});
  const renderer=new J.Renderer(), options={scale:cv.width/rp.W,noPost:true,noGhost:true,noHud:true};
  const pixel=(x,y)=>Array.from(ctx.getImageData(Math.floor(x*320),Math.floor(y*180),1,1).data).slice(0,3).join(',');
  renderer.frame(ctx,rp,4.5,options);
  check(pixel(.1,.3)==='255,0,0', 'an early group cut must remain visible');
  check(pixel(.23,.3)==='0,255,0', 'foreground must cover regular retained lyrics');
  check(pixel(.5,.5)==='0,0,255', 'frontmost retained lyrics must stay above foreground and later regular lyrics');
  check(pixel(.65,.15)==='255,255,0', 'new regular lyrics must stack above previous regular lyrics');
  check(calls.filter(c=>c.line===0).every(c=>c.out===0&&c.end===6), 'old cuts must not exit at their original boundary');
  const savedForeground=rp.foreground;rp.foreground=null;
  renderer.frame(ctx,rp,4.5,options);check(pixel(.5,.5)==='0,0,255','frontmost stack order must also hold during empty foreground cuts');
  rp.foreground=savedForeground;
  renderer.frame(ctx,rp,.25,options);check(pixel(.5,.5)==='0,255,0','seeking backward must remove later lyrics');
  renderer.frame(ctx,rp,6.1,options);check(pixel(.5,.5)==='0,255,0','retained frontmost lyrics must disappear at group end');
  J.CAMERA.__lyricBlur={get:()=>({blur:25})};
  rp.cuts.find(c=>c.line===2).cam='__lyricBlur';
  renderer.frame(ctx,rp,4.5,options);
  const reused=renderer.camLayer;
  check(pixel(.1,.3)==='255,0,0','a later focus blur must not blur earlier retained lyrics');
  for(let i=0;i<20;i++)renderer.frame(ctx,rp,4+i/40,options);
  check(renderer.camLayer===reused,'retained cuts must reuse their camera canvas');
  rp.cuts.find(c=>c.line===2).cam='none';delete J.CAMERA.__lyricBlur;
  const encoded=await J.exportMP4({plan:rp,project:renderProject,quality:'standard'});
  const video=document.createElement('video'),url=URL.createObjectURL(encoded.blob);
  try {
    video.src=url;
    await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=()=>reject(new Error('MP4 decode failed'));});
    await new Promise(resolve=>{video.onseeked=resolve;video.currentTime=4.5;});
    ctx.drawImage(video,0,0,320,180);
    const px=ctx.getImageData(160,90,1,1).data;
    check(px[2]>220&&px[0]<35&&px[1]<35,'exported MP4 must preserve retained frontmost compositing');
  } finally {video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
  delete J.LAYOUTS.__lyricProbe;J.mediaAssets.delete(fg.id);
  return {fixture:p,bytes:encoded.blob.size,cuts:group.length};
}'''

async def test_lyric_features(b, url):
    pg, errs = await new_page(b, url)
    result = await pg.evaluate(LYRIC_FEATURES)
    print('  lyric features', {'bytes': result['bytes'], 'cuts': result['cuts']})
    await pg.locator('#fileProject').set_input_files(json_file('lyrics.json', result['fixture']))
    await pg.wait_for_function("J.ui.project.lyrics.includes('Fourth')")
    await pg.locator('#modePro').click(); await pg.locator('[data-tab="tech"]').click()
    assert await pg.locator('#lyricAutoPlacement').is_checked() and await pg.locator('#lyricAvoidForeground').is_checked()
    await pg.locator('#lyricAutoPlacement').uncheck()
    await pg.wait_for_function('J.ui.plan.cuts.every(c=>!c.area)')
    await pg.locator('#btnUndo').click()
    await pg.wait_for_function('J.ui.project.lyricEffects.autoPlacement')
    assert await pg.locator('#lyricAutoPlacement').is_checked()
    first_area = await pg.evaluate('J.ui.plan.cuts[0].area')
    await pg.locator('#lineList .lyric-area-thumb').first.click()
    assert await pg.locator('#areaResetAuto').is_visible()
    assert await pg.evaluate('J.ui.areaEdit.draft') == first_area, 'area editor starts at the resolved automatic area'
    await pg.locator('#areaResetFull').click(); await pg.locator('#areaApplyOne').click()
    await pg.wait_for_function('J.ui.plan.cuts[0].area.w===1')
    await pg.locator('#btnShuffle').click()
    assert await pg.evaluate('J.ui.plan.cuts[0].area.w') == 1, 'manual full-stage reset survives shuffle'
    await pg.locator('#lineList .lyric-area-thumb').first.click()
    await pg.locator('#areaResetAuto').click(); await pg.locator('#areaApplyOne').click()
    await pg.wait_for_function("J.ui.plan.cuts[0].areaMode==='auto'")
    await pg.locator('#lineList .lock').first.click()
    locked = await pg.evaluate('J.ui.plan.cuts.filter(c=>c.line===0).map(c=>c.area)')
    await pg.locator('#btnShuffle').click()
    assert await pg.evaluate('J.ui.plan.cuts.filter(c=>c.line===0).map(c=>c.area)') == locked, 'locked areas survive shuffle'
    # 포크: #lineList .lyric-ln(1) .lyric-frontmost input(강조 *Second*)을 끄면 frontmost=false.
    # 이후 포크(emphasis_frontmost)와 우리 패널은 강조 컷의 맨 앞을 고정한다(체크·비활성, 저장값 OFF보다 강조가 이김).
    # 그래서 강조 컷은 「켜져 있고 끌 수 없음」을, 「자동 맨 앞 덮어쓰기」는 강조가 아닌 1행 첫 컷에서 켜는 쪽으로 확인한다.
    strong = (await select_lyric_cut(pg, 1, 0)).locator('.lyric-frontmost input')
    assert await strong.is_checked() and await strong.is_disabled()
    plain = (await select_lyric_cut(pg, 0, 0)).locator('.lyric-frontmost input')
    assert not await plain.is_checked() and await pg.evaluate('J.ui.plan.cuts.find(c=>c.line===0&&c.part===0).frontmost') is False
    await plain.check()
    assert await pg.evaluate('J.ui.plan.cuts.find(c=>c.line===0&&c.part===0).frontmost') is True, 'automatic frontmost can be overridden'
    await pg.evaluate('J.uiApi.flushSave()'); await pg.reload()
    await pg.wait_for_function('window.J&&J.ui&&J.ui.plan&&J.ui.plan.lines.length===4')
    assert await pg.evaluate('J.ui.project.lyricEffects.autoPlacement') is True
    assert await pg.evaluate('J.ui.plan.cuts.find(c=>c.line===0&&c.part===0).frontmost') is True
    assert not errs, errs
    await pg.locator('[data-tab="tech"]').click(); await pg.evaluate('J.uiApi.seek(4.5)')
    await pg.screenshot(path=os.path.join(SHOTS, 'fork-lyric-features-ko.png'), full_page=True)
    await pg.close()

# ---------------------------------------------------------------- media_rhythm_test.cjs
MEDIA_RHYTHM = r"""()=>{
const keys=[...J.MEDIA_RHYTHM_KEYS,...Object.values(J.mediaBpmHoldAliases)], failures=[];
const source=document.createElement('canvas');source.width=160;source.height=90;const x=source.getContext('2d');x.fillStyle='cyan';x.fillRect(20,20,90,40);
const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const ctx=canvas.getContext('2d');
for(const hold of keys){const cut={start:0,end:8,hold,bpm:120,beatOffset:.25,seed:7,enter:'cut',exit:'cut',treat:'none',effectSettings:{motion:1,treatment:1}};
const state=(c,time)=>J.mediaBeatState(c,(time-c.start)/(c.end-c.start),160,90);
const samples=[.25,.33,.51,.75,1.2,1.8,2.9].map(time=>state(cut,time));
if(samples.some(s=>Object.values(s).some(v=>!Number.isFinite(v))))failures.push(hold+' nonfinite');
if(new Set(samples.map(JSON.stringify)).size<2)failures.push(hold+' static');
for(const time of [.33,.51,1.2]){
 const a=state(cut,time),b=state({...cut,start:-2,end:20},time),c=state({...cut,bpm:60,beatOffset:.5},time*2);
 for(const k of Object.keys(a))if(Math.abs(a[k]-b[k])>1e-9||Math.abs(a[k]-c[k])>1e-9)failures.push(hold+' timing '+k);
 ctx.save();ctx.clearRect(0,0,320,180);ctx.translate(160,90);J.paintMediaEffect(ctx,source,[160,90],cut,time/8,1,1);ctx.restore();
 if(!ctx.getImageData(0,0,320,180).data.some((v,i)=>i%4===3&&v))failures.push(hold+' invisible');
}
}
for(const layer of ['foreground','media']){const project=J.defaultProject();project[layer].manualCuts=true;project[layer].cutCount=1;project[layer].cutOverrides={0:{technique:'beatSquash',entrance:'none',departure:'none'}};project.timing.bpm=null;const cut=J.planMedia(project,J.plan(project),null,layer).cuts[0];if(cut.bpm!==120||cut.hold!=='beatSquash')failures.push(layer+' default tempo');}
const covered=new Set();
for(const key of Object.keys(J.THEMES)) {
 const project=J.defaultProject();project.themes=[key];
 const pool=J.themeCandidates(project,key).media;pool.forEach(id=>covered.add(id));
 const look=J.omakase(project,()=>.1);
 for(const layer of ['foreground','media']) {
  const enabled=Object.entries(look[layer].effects.enabled).filter(([,on])=>on).map(([id])=>id);
  if(enabled.some(id=>!pool.includes(id)))failures.push(key+' outside theme');
  for(const id of pool.filter(id=>J.MEDIA_RHYTHM_KEYS.includes(id)))if(!enabled.includes(id))failures.push(key+' missing '+id);
 }
}
for(const id of J.MEDIA_RHYTHM_KEYS)if(!covered.has(id))failures.push('No theme for '+id);
return {failures,count:keys.length,migrated:Object.values(J.MEDIA_TECH).filter(d=>d.group==='bpm'&&d.hold.startsWith('sync_')).length};
}"""

async def test_media_rhythm(b, url):
    pg, errs = await new_page(b, url)
    result = await pg.evaluate(MEDIA_RHYTHM)
    assert result['failures'] == [], result
    assert not errs, errs
    print('  media rhythm', {k: result[k] for k in ('count', 'migrated')})
    await pg.close()

# ---------------------------------------------------------------- media_size_slider_test.cjs
async def test_media_size_slider(b, url):
    pg, errs = await new_page(b, url)
    assert not errs, 'Editor initialization must complete without errors'
    await pg.locator('#modePro').click()
    for layer in ['foreground', 'media']:
        await pg.locator('#sourceForeground' if layer == 'foreground' else '#sourceMedia').click()
        await pg.locator('#mediaFiles').set_input_files(svg('circle.svg', '<circle cx="80" cy="45" r="30" fill="cyan"/>', 160, 90))
        await pg.wait_for_function('layer => J.ui.plan[layer].cuts[0]?.placement', arg=layer)
    for layer in ['foreground', 'media']:
        other = 'media' if layer == 'foreground' else 'foreground'
        untouched = await pg.evaluate('other => JSON.stringify(J.ui.project[other].effects)', other)
        await pg.locator(f'[data-tab="{layer}Fx"]').click()
        panel = pg.locator(f'#{layer}EffectsPanel')
        mn, mx = panel.locator('[data-media-size="min"]'), panel.locator('[data-media-size="max"]')
        width_before = await pg.evaluate('layer => J.ui.plan[layer].cuts[0].placement.w', layer)
        await mn.scroll_into_view_if_needed()
        box = await mn.bounding_box()
        await pg.mouse.move(box['x'] + 7 + (box['width'] - 14) * .15, box['y'] + box['height'] / 2)
        await pg.mouse.down()
        await pg.mouse.move(box['x'] + 7 + (box['width'] - 14) * .4, box['y'] + box['height'] / 2, steps=8)
        await pg.mouse.up()
        raw = await mn.input_value(); value = int(float(raw))
        assert value > 125, 'Dragging the minimum thumb must change the range'
        assert await mx.input_value() == raw, 'Crossing the maximum must move both bounds'
        assert await panel.locator('[data-media-size-value="min"]').text_content() == f'{raw}%'
        assert await panel.locator('[data-media-size-value="max"]').text_content() == f'{raw}%'
        await pg.wait_for_function('({layer, value}) => J.ui.plan[layer].cuts[0].effectSettings.sizeMin === value', arg={'layer': layer, 'value': float(raw)})
        assert await pg.evaluate('({layer, w}) => J.ui.plan[layer].cuts[0].placement.w > w', {'layer': layer, 'w': width_before}), 'The preview plan must use the new size'
        await mx.focus(); await mx.press('Home')
        await pg.wait_for_function('layer => J.ui.plan[layer].cuts[0].effectSettings.sizeMax === 0', arg=layer)
        assert await mn.input_value() == '0'
        assert await panel.locator('[data-media-size-value="max"]').text_content() == '0%'
        await panel.locator('[data-media-setting="autoPlacement"]').uncheck()
        assert not await panel.locator('[data-media-size-range]').is_visible()
        await panel.locator('[data-media-setting="autoPlacement"]').check()
        assert await mn.input_value() == '0', 'Rebuilding the panel must preserve the range'
        assert await pg.evaluate('other => JSON.stringify(J.ui.project[other].effects)', other) == untouched, 'Settings must stay local to their layer'
    assert not errs, 'Slider operations must not throw: ' + repr(errs)
    await pg.close()

# ---------------------------------------------------------------- media_phases_test.cjs
MEDIA_PHASES = r"""()=>{
 const failures=[],check=(ok,s)=>{if(!ok)failures.push(s)},item=J.ui.project.foreground.items[0];
 const plan=(ov={},bpm=0,layer='foreground',enabled={})=>J.planMedia({seed:33,timing:{bpm},[layer]:{items:[item],effects:{enabled},cutOverrides:{0:{technique:'none',...ov}}}},{duration:4,lines:[]},0,layer).cuts[0];
 const ids=Object.keys(J.MEDIA_TECH),only=Object.fromEntries(ids.map(k=>[k,['enter_flipX','exit_flipY','beatPulse'].includes(k)]));
 for(const layer of ['foreground','media']) {
  const c=plan({technique:null},0,layer,only);check(c.enter==='flipX'&&c.exit==='flipY'&&c.hold==='beatPulse',layer+': independent pools');
  check(JSON.stringify(c)===JSON.stringify(plan({technique:null},0,layer,only)),layer+': deterministic');
 }
 const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const ctx=canvas.getContext('2d');
 const raster=(c,t)=>{ctx.clearRect(0,0,320,180);J.drawMediaCut(ctx,c,t);return canvas.toDataURL()};
 for(const [key,def] of Object.entries(J.MEDIA_TECH).filter(([,d])=>d.stage)) {
  const c=plan({entrance:def.stage==='enter'?key:'none',departure:def.stage==='exit'?key:'none',placement:{cx:.5,cy:.5,w:.4}});
  const mid=raster(c,2),edge=raster(c,def.stage==='enter'?.015:3.985);
  check(mid!==edge,key+': phase must animate');check(raster(c,2)===mid,key+': seek deterministic');
 }
 for(const [key] of Object.entries(J.MEDIA_TECH).filter(([,d])=>d.group==='bpm')) {
  const c=plan({technique:key,entrance:'none',departure:'none',placement:{cx:.5,cy:.5,w:.4}},120);
  check(raster(c,1.01)!==raster(c,key==='beatStep'?1.63:1.13),key+': visible beat motion');
  const state=(cut,t)=>J.mediaBeatState(cut,(t-cut.start)/(cut.end-cut.start),120,80);
  const a=state(c,1.125),b=state({...c,start:.7,end:6.1},1.125),fast=state({...c,bpm:240},.5625);
  for(const k of Object.keys(a)){check(Math.abs(a[k]-b[k])<1e-9,key+': absolute clock '+k);check(Math.abs(a[k]-fast[k])<1e-9,key+': BPM speed '+k)}
  const offset=state({...c,beatOffset:.2},1.325);for(const k of Object.keys(a))check(Math.abs(a[k]-offset[k])<1e-9,key+': offset '+k);
 }
 const old=plan({technique:'iris'});check(old.enter==='iris'&&old.exit===J.MEDIA_TECH.iris.exit,'legacy explicit reveal');
 return {failures,entrances:J.mediaPhaseOptions('enter').length,exits:J.mediaPhaseOptions('exit').length,bpm:Object.values(J.MEDIA_TECH).filter(d=>d.group==='bpm').length};
}"""

async def test_media_phases(b, url):
    pg, errs = await new_page(b, url)
    await pg.locator('#modePro').click()
    enter, exit_ = pg.locator('[data-media-phase="entrance"]'), pg.locator('[data-media-phase="departure"]')
    cut0 = 'layer=>{const c=J.ui.plan[layer].cuts[0];return %s}'
    for layer in ['foreground', 'media']:
        src = '#sourceForeground' if layer == 'foreground' else '#sourceMedia'
        await pg.locator(src).click()
        await pg.locator('#mediaFiles').set_input_files(svg('phases.svg', '<rect x="10" y="10" width="90" height="55" fill="red"/><circle cx="65" cy="30" r="20" fill="blue"/>'))
        assert await enter.input_value() == '' and await exit_.input_value() == ''
        assert await pg.locator('.media-technique option[value="iris"]').count() == 0
        await pg.locator('.media-technique').select_option('beatPulse')
        await enter.select_option('enter_flipX'); await exit_.select_option('exit_fade')
        assert await pg.evaluate(cut0 % '[c.hold,c.enter,c.exit,c.bpm]', layer) == ['beatPulse', 'flipX', 'fade', 120]
        # 배경·전경 탭에서는 곡·타이밍 섹션(#bpm)이 숨으므로 가사 탭에서 바꾸고 돌아온다
        await pg.locator('#sourceLyrics').click()
        await pg.locator('#bpm').fill('180'); await pg.locator('#bpm').dispatch_event('change')
        assert await pg.evaluate('layer=>J.ui.plan[layer].cuts[0].bpm', layer) == 180
        await pg.locator('#bpm').fill(''); await pg.locator('#bpm').dispatch_event('change')
        await pg.locator(src).click()
        await pg.locator(f'[data-tab="{layer}Fx"]').click()
        await pg.locator(f'#{layer}EffectsPanel [data-media-action="shuffle"]').click()
        assert await enter.input_value() == 'enter_flipX' and await exit_.input_value() == 'exit_fade'
        await enter.select_option(''); await exit_.select_option('')
        await pg.locator('#mediaLineList .lock').click()
        locked = await pg.evaluate(cut0 % '[c.entrance,c.departure]', layer)
        await pg.locator(f'#{layer}EffectsPanel [data-media-action="disable"]').click()
        await pg.locator(f'#{layer}EffectsPanel [data-media-action="shuffle"]').click()
        assert await pg.evaluate(cut0 % '[c.entrance,c.departure]', layer) == locked
        await pg.locator('#mediaLineList .lock').click()
        assert await pg.evaluate(cut0 % '[c.enter,c.exit]', layer) == ['cut', 'cut']
        await pg.locator(f'#{layer}EffectsPanel [data-media-action="enable"]').click()
        await enter.select_option('enter_flipY'); await exit_.select_option('exit_squeezeX')
        await pg.locator('#btnUndo').click(); assert await exit_.input_value() == ''
        await pg.locator('#btnRedo').click(); assert await exit_.input_value() == 'exit_squeezeX'
    report = await pg.evaluate(MEDIA_PHASES)
    assert report['failures'] == [], report
    await reload(pg); await pg.locator('#sourceMedia').click()
    assert await enter.input_value() == 'enter_flipY' and await exit_.input_value() == 'exit_squeezeX'
    assert not errs, errs
    print('  media phases', {k: report[k] for k in ('entrances', 'exits', 'bpm')})
    await pg.close()

# ---------------------------------------------------------------- media_random_order_test.cjs
async def test_media_random_order(b, url):
    pg, errs = await new_page(b, url)
    await pg.locator('#modePro').click()
    rnd, ids = pg.locator('#mediaRandom'), 'layer=>J.ui.plan[layer].cuts.map(c=>c.itemId)'
    for layer in ['foreground', 'media']:
        src = '#sourceMedia' if layer == 'media' else '#sourceForeground'
        await pg.locator(src).click()
        await pg.locator('#mediaFiles').set_input_files([svg(c + '.svg', f'<circle cx="60" cy="40" r="30" fill="{c}"/>') for c in ['cyan', 'coral', 'gold']])
        await pg.wait_for_function('layer=>J.ui.project[layer].items.length===3&&J.ui.plan[layer].cuts.length===3', arg=layer)
        await pg.locator('#mediaLoop').check()
        await pg.locator('#mediaLineList .media-cut-insert button').nth(2).click()
        assert await pg.evaluate('layer=>J.ui.project[layer].manualCuts', layer) is True
        assert await rnd.is_enabled(), 'manual edits must not disable random order'
        baseline = await pg.evaluate('layer=>({ids:J.ui.plan[layer].cuts.map(c=>c.itemId),times:J.ui.plan[layer].cuts.map(c=>c.start),overrides:structuredClone(J.ui.project[layer].cutOverrides)})', layer)
        await rnd.check()
        shuffled = await pg.evaluate("""layer=>{
          const cuts=J.ui.plan[layer].cuts,order=J.mediaOrder(J.ui.project,layer).map(i=>i.id);
          return {ids:cuts.map(c=>c.itemId),times:cuts.map(c=>c.start),sequence:cuts.filter(c=>c.itemId).map((c,i)=>c.itemId===order[i%order.length]),sources:cuts.map(c=>c.sourceItemId),overrides:J.ui.project[layer].cutOverrides};
        }""", layer)
        assert all(shuffled['sequence']) and shuffled['ids'][2] is None, shuffled
        assert shuffled['sources'] == baseline['ids'] and shuffled['times'] == baseline['times'] and shuffled['overrides'] == baseline['overrides']
        assert await pg.locator('.media-cut-file').first.is_disabled()
        await rnd.uncheck()
        assert await pg.evaluate(ids, layer) == baseline['ids']
        assert await pg.locator('.media-cut-file').first.is_enabled()
        await pg.locator('#btnUndo').click(); assert await rnd.is_checked()
        await pg.locator('#btnRedo').click(); assert not await rnd.is_checked()
        await rnd.check()
        await pg.locator('#mediaLineList .lock').first.click()
        locked = await pg.evaluate('layer=>J.ui.plan[layer].cuts[0].itemId', layer)
        await pg.locator(f'[data-tab="{layer}Fx"]').click(); await pg.locator(f'#{layer}EffectsPanel [data-media-action="shuffle"]').click()
        assert await pg.evaluate('layer=>J.ui.plan[layer].cuts[0].itemId', layer) == locked
        # 섞인 상태에서 컷 구조를 바꿔도 밑의 수동 순서는 지켜진다
        await pg.locator('#mediaLineList .media-cut-insert button').last.click()
        await pg.locator('#mediaLineList .remove-media-cut').last.click()
        await rnd.uncheck()
        assert await pg.evaluate(ids, layer) == [locked] + baseline['ids'][1:]
        await rnd.check(); before_reload = await pg.evaluate(ids, layer)
        await reload(pg); await pg.locator(src).click()
        assert await rnd.is_enabled() and await rnd.is_checked()
        assert await pg.evaluate(ids, layer) == before_reload
        # 반복 탭 동기화도 같은 순서를 쓰고, 뒤에 켜고 끌 수 있다. 포크는 곡·타이밍의 #btnTap을 눌렀지만
        # 배경·전경 탭에서는 그 섹션이 숨으므로(포크 자신의 new_features 테스트처럼) 이 탭의 #btnTapMedia를 쓴다.
        await pg.locator('#btnTapMedia').click()
        for i in range(7): await pg.evaluate("t=>{J.ui.t=t;document.querySelector('#tapBtn').click()}", .4 + i)
        await pg.locator('#tapStop').click()
        assert await rnd.is_enabled()
        assert await pg.evaluate('layer=>{const order=J.mediaOrder(J.ui.project,layer);return J.ui.plan[layer].cuts.every((c,i)=>c.itemId===order[i%order.length].id)}', layer)
        await rnd.uncheck()
        assert await pg.evaluate('layer=>{const items=J.ui.project[layer].items;return J.ui.plan[layer].cuts.every((c,i)=>c.itemId===items[i%items.length].id)}', layer)
        await rnd.check()
        await pg.locator('#mediaList .media-item button').last.click()
        await pg.locator('#mediaList .media-item button').last.click()
        assert await rnd.is_enabled(), 'a checked option must remain switchable with one asset'
        await rnd.uncheck(); assert await rnd.is_disabled()
    assert not errs, errs
    await pg.close()

# ---------------------------------------------------------------- media_auto_placement_test.cjs
AUTO_PLACEMENT = r"""()=>{
  const failures=[], same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  for(const [width,height,type] of [[1024,1024,'image'],[1920,1080,'image'],[720,1280,'video']]) {
    for(const [W,H] of [[1920,1080],[1080,1920]]) for(const layer of ['foreground','media']) {
      const item={id:'fixture',name:'fixture',type,width,height};
      const project={seed:3,[layer]:{items:[item],loop:true,cutCount:12,seed:1,cutOverrides:Object.fromEntries(Array.from({length:12},(_,i)=>[i,{technique:null}]))}};
      const lyric={duration:24,lines:[],W,H}, saved=JSON.stringify(project);
      const plan=()=>J.planMedia(project,lyric,null,layer).cuts;
      const first=plan();
      if(!same(first,plan()))failures.push('non-deterministic planning');
      if(JSON.stringify(project)!==saved)failures.push('planner mutated saved project');
      if(new Set(first.map(c=>c.placement?.w.toFixed(4))).size<4)failures.push('too few sizes');
      if(new Set(first.map(c=>c.placement?.cx.toFixed(2)+':'+c.placement?.cy.toFixed(2))).size<4)failures.push('too few positions');
      for(const cut of first) {
        const r=J.mediaPlacementRect(cut.placement,width,height,W,H);
        if(Math.abs(r.w*W/(r.h*H)-width/height)>1e-8)failures.push('aspect ratio changed');
        if(layer==='media') {
          const fit=J.mediaPlacementRect(null,width,height,W,H);
          if(r.w<fit.w-1e-9||r.h<fit.h-1e-9)failures.push('background smaller than 100% full fit');
          for(const [start,extent] of [[r.x,r.w],[r.y,r.h]]) {
            if(extent>=1 && (start>1e-9||start+extent<1-1e-9))failures.push('enlarged background exposes an edge');
            if(extent<1 && (start<0||start+extent>1))failures.push('background cropped on the smaller axis');
          }
        } else if(r.x<.025||r.y<.025||r.x+r.w> .975||r.y+r.h>.975)failures.push('base placement outside safe bounds');
      }
      project.seed=200;
      if(same(first.map(c=>c.placement),plan().map(c=>c.placement)))failures.push('shuffle did not change placement');
      const locked=first[0];
      project[layer].cutOverrides[0]={technique:null,lock:true,lockedSeed:locked.seed,lockedTechnique:locked.technique,lockedPlacement:locked.placement,lockedPlacementMode:'auto'};
      project.mediaEffects={autoPlacement:false};
      if(!same(plan()[0].placement,locked.placement))failures.push('lock did not preserve framing');
      if(plan()[1].placement!==null)failures.push('disabled automatic placement still active');
      const manual={cx:.2,cy:.7,w:.34,h:.25,lockAspect:false,angle:27};
      project[layer].cutOverrides[0]={technique:'iris',placement:manual};
      if(!same(plan()[0].placement,manual))failures.push('manual placement changed');
      delete project.mediaEffects;
      project[layer].cutOverrides[0]={technique:'none'};
      if(plan()[0].placement!==null)failures.push('no-effects framing changed');
      project[layer].cutOverrides[0]={enter:'slide',layout:'cover'};
      if(plan()[0].placement!==null)failures.push('legacy framing changed');
      project[layer].cutOverrides[0]={technique:'iris',lock:true,lockedSeed:2};
      if(plan()[0].placement!==null)failures.push('old locked framing changed');
    }
  }
  return failures;
}"""

async def test_media_auto_placement(b, url):
    pg, errs = await new_page(b, url)
    await pg.locator('#modePro').click()
    assert await pg.evaluate(AUTO_PLACEMENT) == []
    current = lambda layer: pg.evaluate('layer=>J.ui.plan[layer].cuts[0].placement', layer)
    for layer in ['foreground', 'media']:
        src, fx = ('#sourceMedia' if layer == 'media' else '#sourceForeground'), f'#{layer}EffectsPanel'
        await pg.locator(src).click()
        await pg.locator('#mediaFiles').set_input_files(svg(layer + '.svg', '<circle cx="90" cy="160" r="80" fill="cyan"/>', 180, 320))
        await pg.locator('.media-technique').wait_for()
        assert await pg.evaluate('layer=>[J.ui.project[layer].items[0].width,J.ui.project[layer].items[0].height]', layer) == [180, 320]
        # 포크는 'iris'를 골랐지만 iris는 이제 등장/퇴장 단계(media_phases: 기법 목록에 iris 없음) → 자동 배치를 쓰는 유지 기법 pushIn
        assert await pg.locator('.media-technique option[value="iris"]').count() == 0
        await pg.locator('.media-technique').select_option('pushIn')
        initial = await current(layer); assert initial
        await pg.locator(f'[data-tab="{layer}Fx"]').click()
        await pg.locator(f'{fx} [data-media-action="shuffle"]').click()
        assert await current(layer) != initial
        await pg.locator('#mediaLineList .lock').click(); locked = await current(layer)
        await pg.locator(f'{fx} [data-media-action="shuffle"]').click(); assert await current(layer) == locked
        await pg.locator('#mediaLineList .lock').click()
        await pg.locator('.foreground-placement-open').click()
        box = await pg.locator('#areaEditRect').bounding_box()
        await pg.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2); await pg.mouse.down()
        await pg.mouse.move(box['x'] + box['width'] / 2 + 25, box['y'] + box['height'] / 2 + 10, steps=5); await pg.mouse.up()
        await pg.locator('#areaApplyOne').click(); manual = await current(layer)
        assert await pg.evaluate('layer=>J.ui.plan[layer].cuts[0].placementMode', layer) == 'manual'
        await pg.locator(f'{fx} [data-media-action="shuffle"]').click(); assert await current(layer) == manual
        await pg.locator('.foreground-placement-reset').click()
        assert await pg.evaluate('layer=>J.ui.plan[layer].cuts[0].placementMode', layer) == 'auto'
        await pg.locator('#btnUndo').click(); assert await current(layer) == manual
        await pg.locator('#btnRedo').click()
        await pg.locator(f'{fx} [data-media-setting="autoPlacement"]').uncheck(); assert await current(layer) is None
        await pg.locator(f'{fx} [data-media-setting="autoPlacement"]').check(); restored = await current(layer); assert restored
        await pg.reload(); await pg.wait_for_function('window.J&&J.ui&&J.ui.plan&&J.mediaAssets.size>0'); await pg.locator(src).click()
        assert await current(layer) == restored
    assert not errs, errs
    await pg.close()

# ---------------------------------------------------------------- media_effects_test.cjs
MEDIA_EFFECTS = r"""() => {
  const failures=[], signatures = new Set(), c=document.createElement('canvas'); c.width=320;c.height=180;
  const ctx=c.getContext('2d'), item=J.ui.project.foreground.items[0];
  for (const key of ['none', ...Object.keys(J.MEDIA_TECH)]) {
    const project = structuredClone(J.ui.project); project.foreground = {items:[item],cutOverrides:{0:{technique:key,entrance:J.MEDIA_TECH[key]?.stage==='enter'?key:'none',departure:J.MEDIA_TECH[key]?.stage==='exit'?key:'none',placement:{cx:.5,cy:.5,w:.4}}}};
    const plan=J.planMedia(project,{duration:4,lines:[]},0,'foreground'), cut=plan.cuts[0];
    for (const p of [.01,.05,.5,.95,.99]) {
      ctx.clearRect(0,0,320,180); J.drawMediaCut(ctx,cut,p*4);
      const data=ctx.getImageData(0,0,320,180).data;
      if (!data.some((value,index) => index%4===3 && value>0)) failures.push(key+':empty:'+p);
      if(!data.some((value,index)=>index%4===3 && value===0)) failures.push(key+':lost transparent surroundings:'+p);
      if(p===.05) signatures.add(c.toDataURL());
    }
    if(key==='none') {
      ctx.clearRect(0,0,320,180);J.drawMediaCut(ctx,cut,0);
      if(ctx.getImageData(160,90,1,1).data[3]!==255) failures.push('none: not instant');
    }
  }
  for (const layer of ['media','foreground']) for (const key of Object.keys(J.MEDIA_TECH).filter(k => k.startsWith('transition_'))) {
    const project=structuredClone(J.ui.project);
    project[layer]={items:[item],manualCuts:true,cutCount:2,cutOverrides:{0:{technique:'none'},1:{technique:key}},timing:{lineTimes:{0:0,1:2}}};
    const plan=J.plan(project,null);plan[layer]=J.planMedia(project,plan,0,layer);
    const cut=plan[layer].cuts[1];
    if(!cut.trans) failures.push(key+':missing transition');
    for(const p of [.1,.5,.9]) {ctx.clearRect(0,0,320,180);J.drawMedia(ctx,plan,cut.start+cut.transDur*p,{},layer);}
  }
  const source=document.createElement('canvas');source.width=120;source.height=80;
  const x=source.getContext('2d');x.fillStyle='#00ff00';x.fillRect(0,0,120,80);x.fillStyle='red';x.fillRect(40,20,40,40);
  const video={id:'keyed',name:'keyed',type:'video'};J.mediaAssets.set(video.id,{element:source});
  for (const key of ['none','iris','echo','glitch']) {
    const plan=J.planMedia({seed:1,foreground:{items:[video],cutOverrides:{0:{technique:key,chromaKey:true,placement:{cx:.5,cy:.5,w:.84375}}}}},{duration:4,lines:[]},0,'foreground');
    ctx.clearRect(0,0,320,180);ctx.globalAlpha=.3;J.drawMediaCut(ctx,plan.cuts[0],2);ctx.globalAlpha=1;
    if(ctx.getImageData(40,50,1,1).data[3]) failures.push(key+':chroma leaked');
    if(!ctx.getImageData(160,90,1,1).data[3]) failures.push(key+':subject disappeared');
  }
  for (const key of J.MEDIA_VARIATION_KEYS) {
    const project={seed:3,foreground:{items:[video],cutOverrides:{0:{technique:key,entrance:J.MEDIA_TECH[key]?.stage==='enter'?key:'none',departure:J.MEDIA_TECH[key]?.stage==='exit'?key:'none',placement:{cx:.5,cy:.5,w:.4}}}}};
    const cut=J.planMedia(project,{duration:4,lines:[]},0,'foreground').cuts[0];
    const snapshots=[];
    for(const offset of [0,30]) {
      x.clearRect(0,0,120,80); x.fillStyle='#ff4060';x.fillRect(25+offset,20,20,25);
      ctx.clearRect(0,0,320,180);ctx.globalAlpha=.3;J.drawMediaCut(ctx,cut,2);ctx.globalAlpha=1;
      if(ctx.getImageData(0,0,1,1).data[3])failures.push(key+':transparent corner filled');
      snapshots.push(c.toDataURL());
    }
    if(snapshots[0]===snapshots[1])failures.push(key+':video frame did not update');
    ctx.clearRect(0,0,320,180);J.drawMediaCut(ctx,cut,.12);const first=c.toDataURL();
    ctx.clearRect(0,0,320,180);J.drawMediaCut(ctx,cut,3.9);
    ctx.clearRect(0,0,320,180);J.drawMediaCut(ctx,cut,.12);
    if(c.toDataURL()!==first)failures.push(key+':seeking changed rendering');
  }
  J.mediaAssets.delete(video.id);
  return {failures,distinct:signatures.size,total:Object.keys(J.MEDIA_TECH).length};
}"""

async def test_media_effects(b, url):
    pg, errs = await new_page(b, url)
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'warning' and m.text.startswith('media trans') else None)
    await pg.locator('#modePro').click()
    tech, cut0 = pg.locator('.media-technique'), 'layer => J.ui.plan[layer].cuts[0].%s'
    for layer in ['media', 'foreground']:
        fx = f'#{layer}EffectsPanel'
        await pg.locator('#sourceMedia' if layer == 'media' else '#sourceForeground').click()
        await pg.locator('#mediaFiles').set_input_files(svg('test.svg', '<rect width="120" height="80" fill="#ffae42"/><circle cx="35" cy="30" r="22" fill="#185ace"/><path d="M70 10L110 70H50Z" fill="#da185c"/>'))
        await pg.locator('#mediaLineList .media-technique').wait_for()
        assert await pg.locator('#mediaLineList .tools select').count() == 1
        assert await tech.locator('option').first.get_attribute('value') == 'none'
        await tech.select_option('')
        assert await pg.evaluate('layer => !!J.MEDIA_TECH[J.ui.plan[layer].cuts[0].technique]', layer)
        await pg.locator('#mediaLineList .lock').click()
        locked = await pg.evaluate(cut0 % 'technique', layer)
        await pg.locator(f'[data-tab="{layer}Fx"]').click()
        await pg.locator(f'{fx} [data-media-action="shuffle"]').click()
        assert await pg.evaluate(cut0 % 'technique', layer) == locked
        await pg.locator('#mediaLineList .lock').click()
        await tech.select_option('pushIn')
        await pg.locator(f'{fx} [data-media-action="shuffle"]').click()
        assert await pg.evaluate(cut0 % 'technique', layer) == 'pushIn'
        await tech.select_option('')
        await pg.locator(f'{fx} [data-media-action="disable"]').click()
        assert await pg.evaluate(cut0 % 'technique', layer) == 'none'
        await pg.locator(f'{fx} details').filter(has=pg.locator('[data-media-tech="pixelScatter"]')).locator('summary').click()
        await pg.locator(f'{fx} [data-media-tech="pixelScatter"]').check()
        assert await pg.evaluate(cut0 % 'entrance', layer) == 'pixelScatter'
        assert await pg.evaluate(cut0 % 'technique', layer) == 'none'
        await pg.locator(f'{fx} [data-media-action="enable"]').click()
        await tech.select_option('none')
        await pg.locator(f'{fx} [data-media-action="shuffle"]').click()
        assert await pg.evaluate(cut0 % 'technique', layer) == 'none'
    report = await pg.evaluate(MEDIA_EFFECTS)
    assert report['failures'] == [], report['failures'][:20]
    assert report['distinct'] >= 60 and report['total'] > 120, report
    await tech.select_option('neonContour')
    await pg.locator('#btnUndo').click(); assert await tech.input_value() == 'none'
    await pg.locator('#btnRedo').click(); assert await tech.input_value() == 'neonContour'
    await pg.screenshot(path=os.path.join(SHOTS, 'fork-media-effects-ui.png'), full_page=True)
    await reload(pg); await pg.locator('#sourceForeground').click()
    assert await tech.input_value() == 'neonContour'
    assert not errs, errs
    print('  media effects', {'distinct': report['distinct'], 'total': report['total']})
    await pg.close()

# ---------------------------------------------------------------- media_layer_settings_test.cjs
RANDOM_CHECKS = r"""() => {
  const failures=[], p=structuredClone(J.ui.project), original=JSON.stringify(p);
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b), keys=Object.keys(J.MEDIA_TECH);
  for(const seed of [12,71,2026]) {
    const a=J.omakase(p,J.rng(seed)), b=J.omakase(p,J.rng(seed));
    for(const layer of ['foreground','media']) {
      const effects=a[layer].effects, on=keys.filter(key=>effects.enabled[key]);
      if(!on.length||on.length===keys.length)failures.push('random subset missing on/off values');
      if(!same(effects,b[layer].effects))failures.push('seeded randomization is not reproducible');
      for(const key of ['motion','treatment','duration','autoPlacement'])if(effects[key]!==p[layer].effects[key])failures.push('randomization changed '+key);
    }
    if(same(a.foreground.effects.enabled,a.media.effects.enabled))failures.push('layers share one random subset');
  }
  for(const value of [0,.999]) {
    const settings=J.randomMediaEffectSettings(p,'foreground',()=>value);
    const on=keys.filter(key=>settings.enabled[key]);
    if(!on.length||on.length===keys.length)failures.push('degenerate random source leaves no variation');
  }
  if(JSON.stringify(p)!==original)failures.push('randomization mutated the input project');
  return failures;
}"""

async def test_media_layer_settings(b, url):
    pg, errs = await new_page(b, url)
    await pg.locator('#modePro').click()
    for layer in ['foreground', 'media']:
        await pg.locator('#sourceMedia' if layer == 'media' else '#sourceForeground').click()
        await pg.locator('#mediaFiles').set_input_files([svg(c + '.svg', f'<circle cx="80" cy="45" r="35" fill="{c}"/>', 160, 90) for c in ['cyan', 'coral', 'gold']])
        await pg.wait_for_function('layer => J.ui.project[layer].items.length === 3 && J.ui.plan[layer].cuts.length === 3', arg=layer)
    # 공유 설정·자동 컷을 가진 실제 옛 형식 프로젝트를 불러온다
    legacy = await pg.evaluate('''() => {
      const p = structuredClone(J.ui.project); p.lyrics = '';
      p.mediaEffects = {motion:.65,treatment:.4,duration:.6,autoPlacement:false,enabled:Object.fromEntries(Object.keys(J.MEDIA_TECH).map(key => [key,key === 'neonContour']))};
      for (const layer of ['foreground','media']) {
        delete p[layer].effects;
        Object.assign(p[layer], {loop:true,cutCount:6,randomOrder:true,cutOverrides:Object.fromEntries(Array.from({length:6},(_,i) => [i,{technique:null}]))});
      }
      return p;
    }''')
    await pg.locator('#fileProject').set_input_files(json_file('shared.jizura.json', legacy))
    await pg.wait_for_function('J.ui.plan.foreground.cuts.length === 6')
    snapshot = lambda layer: pg.evaluate('layer => ({project:J.ui.project[layer],cuts:J.ui.plan[layer].cuts})', layer)
    for layer in ['foreground', 'media']:
        initial = await snapshot(layer)
        # 옛 공유 값은 그대로 옮겨진다. 그 뒤 포크에 생긴 크기 범위(sizeMin/sizeMax)는 기본값으로 채워진다(포크 테스트가 더 오래됨)
        size_defaults = await pg.evaluate("(({sizeMin, sizeMax}) => ({sizeMin, sizeMax}))(J.mediaEffectSettings({}, 'media'))")
        expected = dict(legacy['mediaEffects'], **size_defaults)
        assert initial['project']['effects'] == expected, 'old shared values must survive migration'
        assert all(c['technique'] == 'neonContour' and c['placement'] is None for c in initial['cuts'])
        assert all(c['effectSettings'] == expected for c in initial['cuts']), initial['cuts'][0]['effectSettings']
    assert await pg.evaluate('J.ui.project.foreground.effects.enabled === J.ui.project.media.effects.enabled') is False
    assert await pg.evaluate("Object.hasOwn(J.ui.project, 'mediaEffects')") is False
    tech_count = await pg.evaluate('Object.keys(J.MEDIA_TECH).length')
    for layer in ['foreground', 'media']:
        other = 'media' if layer == 'foreground' else 'foreground'; untouched = await snapshot(other)
        tab, panel = pg.locator(f'[data-tab="{layer}Fx"]'), pg.locator(f'#{layer}EffectsPanel')
        await tab.click()
        assert await tab.inner_text() == ('전경' if layer == 'foreground' else '배경')   # 포크 前景/背景
        assert await panel.is_visible() and not await pg.locator(f'#{other}EffectsPanel').is_visible()
        assert await panel.locator('[data-media-tech]').count() == tech_count
        assert await panel.locator('details[data-media-group]').count() == 8
        assert await panel.locator('details[open]').count() == 0, 'categories initially collapse independently per layer'
        assert not await panel.locator('[data-media-tech]').first.is_visible()
        cinema = panel.locator('[data-media-group="cinema"]'); total = await cinema.locator('[data-media-tech]').count()
        await cinema.locator('summary').click()
        await cinema.locator('[data-media-group-action="on"]').click()
        assert await cinema.locator('.tg-cnt').inner_text() == f'{total}/{total}'
        assert await cinema.locator('[data-media-tech]:checked').count() == total
        await cinema.locator('[data-media-group-action="flip"]').click()
        assert await cinema.locator('.tg-cnt').inner_text() == f'0/{total}'
        await cinema.locator('[data-media-tech]').first.check()
        assert await cinema.locator('.tg-cnt').inner_text() == f'1/{total}'
        await cinema.locator('[data-media-group-action="off"]').click()
        assert await cinema.evaluate('el=>el.open') is True, 'bulk edits keep the category expanded'
        await cinema.locator('summary').click()
        assert not await panel.locator('[data-media-tech]').first.is_visible()
        assert await snapshot(other) == untouched, 'category actions must stay local to the tab'
        # 포크의 en/ 전용 단언(요약에 일본어 없음)을 우리 한국어판에 맞춰: 분류 이름에 가나가 남지 않는다
        assert not re.search(r'[぀-ヿ]', ' '.join(await panel.locator('summary').all_text_contents()))
        values = {'motion': 1.6, 'treatment': .8, 'duration': .25} if layer == 'foreground' else {'motion': .3, 'treatment': .1, 'duration': 1.2}
        for key, value in values.items():
            await panel.locator(f'[data-media-setting="{key}"]').evaluate("(el,value) => {el.value = value; el.dispatchEvent(new Event('input',{bubbles:true}));}", str(value))
            await pg.wait_for_function('({layer,key,value}) => J.ui.plan[layer].cuts.every(c => c.effectSettings[key] === value)', arg={'layer': layer, 'key': key, 'value': value})
        await panel.locator('[data-media-setting="autoPlacement"]').check()
        assert all(c['placementMode'] == 'auto' for c in (await snapshot(layer))['cuts'])
        assert await snapshot(other) == untouched, 'sliders and automatic placement must stay local to the tab'
        await panel.locator('[data-media-action="disable"]').click()
        assert all(c['technique'] == 'none' for c in (await snapshot(layer))['cuts'])
        technique = 'neonContour' if layer == 'foreground' else 'pushIn'
        await panel.locator('details').filter(has=pg.locator(f'[data-media-tech="{technique}"]')).locator('summary').click()
        await panel.locator(f'[data-media-tech="{technique}"]').check()
        assert all(c['technique'] == technique for c in (await snapshot(layer))['cuts'])
        await pg.locator('#btnUndo').click()
        assert all(c['technique'] == 'none' for c in (await snapshot(layer))['cuts'])
        assert not await panel.locator(f'[data-media-tech="{technique}"]').is_checked()
        await pg.locator('#btnRedo').click()
        assert all(c['technique'] == technique for c in (await snapshot(layer))['cuts'])
        await panel.locator('[data-media-action="enable"]').click()
        assert await panel.locator('[data-media-tech]:checked').count() == tech_count
        assert await snapshot(other) == untouched, 'enable/disable and undo must stay local to the tab'
        await pg.locator('#btnUndo').click()
        before_shuffle = await snapshot(layer)
        await panel.locator('[data-media-action="shuffle"]').click()
        after_shuffle = await snapshot(layer)
        assert [c['placement'] for c in after_shuffle['cuts']] != [c['placement'] for c in before_shuffle['cuts']]
        assert after_shuffle['project']['effects'] == before_shuffle['project']['effects']
        assert await snapshot(other) == untouched, 'tab shuffle must not change the other layer or its material order'
    before_global = {l: await snapshot(l) for l in ['foreground', 'media']}
    await pg.locator('#btnShuffle').click()
    for layer in ['foreground', 'media']:
        now = await snapshot(layer)
        assert [c['seed'] for c in now['cuts']] != [c['seed'] for c in before_global[layer]['cuts']]
        assert now['project']['effects'] == before_global[layer]['project']['effects']
    assert await pg.evaluate(RANDOM_CHECKS) == []
    await pg.evaluate('''() => {
      for(const layer of ['foreground','media'])Object.assign(J.ui.project[layer].cutOverrides,{
        0:{technique:'iris'},1:{technique:'none'},
        2:{technique:null,lock:true,lockedTechnique:'glitch',lockedSeed:42,lockedItemId:J.ui.project[layer].items[0].id,lockedPlacement:{cx:.5,cy:.5,w:.5}},
        3:{itemId:null,technique:null},
      });
      J.uiApi.replan();
    }''')
    before_random = {l: await snapshot(l) for l in ['foreground', 'media']}
    await pg.locator('#btnOmakase').click()
    after_random = {l: await snapshot(l) for l in ['foreground', 'media']}
    for layer in ['foreground', 'media']:
        before, after = before_random[layer], after_random[layer]
        effects = after['project']['effects']
        rest = lambda proj: {k: v for k, v in proj.items() if k != 'effects'}
        assert rest(after['project']) == rest(before['project']), 'omakase changes media candidate checks without changing material/cut settings'
        assert effects['enabled'] != before['project']['effects']['enabled']
        assert [c['technique'] for c in after['cuts'][:3]] == ['iris', 'none', 'glitch'], 'manual, no-effects and locked cuts stay fixed'
        assert after['cuts'][3]['itemId'] is None
        assert all(effects['enabled'].get(c['technique']) for c in after['cuts'][4:]), 'automatic cuts must use enabled techniques'
        panel = pg.locator(f'#{layer}EffectsPanel')
        ui_checks = await panel.locator('[data-media-tech]').evaluate_all('inputs=>Object.fromEntries(inputs.map(el=>[el.dataset.mediaTech,el.checked]))')
        assert ui_checks == effects['enabled'], 'omakase updates visible checkbox state'
        for group in await panel.locator('details').all():
            total = await group.locator('[data-media-tech]').count(); on = await group.locator('[data-media-tech]:checked').count()
            assert await group.locator('.tg-cnt').inner_text() == f'{on}/{total}'
    await pg.locator('#btnUndo').click()
    for layer in ['foreground', 'media']:
        assert (await snapshot(layer))['project']['effects'] == before_random[layer]['project']['effects'], 'undo restores randomized candidates'
    await pg.locator('#btnRedo').click()
    for layer in ['foreground', 'media']:
        assert (await snapshot(layer))['project']['effects'] == after_random[layer]['project']['effects'], 'redo restores randomized candidates'
    await pg.evaluate('()=>{J.ui.project.foreground.timing.lineTimes[0]=.25;J.uiApi.replan();}')
    await pg.locator('#btnPrev').click()
    for layer in ['foreground', 'media']:
        assert (await snapshot(layer))['project']['effects'] == before_random[layer]['project']['effects'], 'previous variation restores media candidates'
    assert (await snapshot('foreground'))['project']['timing']['lineTimes']['0'] == .25, 'look history must preserve timing edits'
    await pg.locator('#btnNext').click()
    for layer in ['foreground', 'media']:
        assert (await snapshot(layer))['project']['effects'] == after_random[layer]['project']['effects'], 'next variation restores media candidates'
    assert (await snapshot('foreground'))['project']['timing']['lineTimes']['0'] == .25
    saved = {l: await snapshot(l) for l in ['foreground', 'media']}
    # 포크: #btnSave → 이름 대화상자 → .jizuraichi. 우리: #btnSaveAll → .jizura(같은 JIZURA01 헤더 + JSON 매니페스트)
    await pg.locator('#projectMenu summary').click()
    async with pg.expect_download() as dl:
        await pg.locator('#btnSaveAll').click()
    download = await dl.value
    assert download.suggested_filename.endswith('.jizura'), download.suggested_filename
    data = await download_bytes(download)
    manifest = json.loads(data[12:12 + struct.unpack_from('<I', data, 8)[0]])
    assert manifest['project']['foreground']['effects'] == saved['foreground']['project']['effects']
    assert manifest['project']['media']['effects'] == saved['media']['project']['effects']
    await pg.reload(); await pg.wait_for_function('window.J&&J.ui&&J.ui.plan&&J.mediaAssets.size === 6')
    for layer in ['foreground', 'media']:
        assert await snapshot(layer) == saved[layer], 'autosave reload must preserve each layer'
    await pg.locator('#fileProject').set_input_files({'name': 'split.jizura', 'mimeType': 'application/octet-stream', 'buffer': data})
    await pg.wait_for_function("document.querySelector('#fileProject').value === '' && !J.ui.projectBusy")
    for layer in ['foreground', 'media']:
        assert await snapshot(layer) == saved[layer], 'saved file must preserve each layer'
    await pg.locator('[data-tab="foregroundFx"]').click()
    await pg.screenshot(path=os.path.join(SHOTS, 'fork-media-layer-settings-ko.png'), full_page=True)
    assert not errs, errs
    await pg.close()

# ---------------------------------------------------------------- media_lyrics_insert_test.cjs
async def test_media_lyrics_insert(b, url):
    pg, errs = await new_page(b, url)
    await pg.locator('#modePro').click()
    insert, mode_select = pg.locator('#btnMediaFromLyrics'), pg.locator('#mediaLyricInsertMode')
    src = lambda layer: '#sourceMedia' if layer == 'media' else '#sourceForeground'
    assert await pg.locator('#mediaCutCount, #mediaCutCountField').count() == 0
    assert not await insert.is_visible(), 'lyrics tab must not show the media action'
    for layer in ['foreground', 'media']:
        await pg.locator(src(layer)).click()
        assert await mode_select.input_value() == 'line', 'old projects default to line alignment'
        assert await insert.is_disabled(), 'files are required'
        await pg.locator('#mediaFiles').set_input_files([
            svg('circle.svg', '<circle cx="80" cy="45" r="35" fill="cyan"/>', 160, 90),
            svg('square.svg', '<rect x="45" y="10" width="70" height="70" fill="coral"/>', 160, 90)])
        await pg.wait_for_function('layer => J.ui.project[layer].items.length === 2', arg=layer)
    fixture = await pg.evaluate('''() => {
      const p = structuredClone(J.ui.project);
      p.lyrics = '[00:01.125]새벽의 하늘/멀리 이어져\\n[00:04.250]바람이 불어/목소리를 싣고\\n[00:08.375]하얀 구름/하늘에 떠서\\n[00:22.500]거리를 지나/바다로 향해\\n[00:32.625]파도 소리/오늘도 울려';
      p.title = 'Title card'; p.fps = 30;
      p.lyricBlankCuts = [{id:'blank-test',beforeLine:2,start:7}];
      p.fx.density = 1;
      return p;
    }''')
    await pg.locator('#fileProject').set_input_files(json_file('fixture.json', fixture))
    await pg.wait_for_function('J.ui.plan.lines.length === 5')
    assert await pg.evaluate('J.ui.plan.cuts.some(c => c.part === 1) && J.ui.plan.cuts.some(c => c.blank) && J.ui.plan.cuts.some(c => c.line === -1)') is True
    project = lambda: pg.evaluate('structuredClone(J.ui.project)')
    lyric_targets = lambda mode: pg.evaluate('''mode => J.ui.plan.cuts
      .filter(c => mode === 'cut' ? c.line >= 0 || c.blank : c.line >= 0 && c.part === 0)
      .map(c => ({start:c.start,ref:c.blank ? `l:blank:${c.blankId}` : `l:${c.line}:${c.part}`}))''', mode)
    starts = lambda layer: pg.evaluate('layer => J.ui.plan[layer].cuts.map(c => c.start)', layer)
    for mode in ['cut', 'line']:
        for layer in ['foreground', 'media']:
            other = 'foreground' if layer == 'media' else 'media'
            await pg.locator(src(layer)).click()
            assert await insert.inner_text() == '가사에 맞춰 일괄 삽입'                      # 포크 歌詞に合わせて一括挿入
            assert await mode_select.locator('option').all_text_contents() == ['행에 맞추기', '컷에 맞추기']   # 포크 行に合わせる / カットに合わせる
            previous = await starts(layer)
            other_mode = (await project())[other].get('lyricInsertMode')
            await mode_select.select_option(mode)
            assert await starts(layer) == previous, 'selecting a mode alone must not replace cuts'
            assert (await project())[other].get('lyricInsertMode') == other_mode
            for loop in [False, True]:
                for random_ in [False, True]:
                    await pg.locator('#mediaLoop').set_checked(loop)
                    await pg.locator('#mediaRandom').set_checked(random_)
                    await pg.locator('#mediaLineList .media-technique').first.select_option('pushIn')   # 포크 'iris'(이제 등장 단계)
                    await pg.locator('#mediaLineList .lock').first.click()
                    before = await project(); expected = await lyric_targets(mode)
                    await insert.click()
                    after = await project()
                    report = await pg.evaluate('''layer => {
                      const p = J.ui.project, cuts = J.ui.plan[layer].cuts, order = J.mediaOrder(p, layer);
                      return {cuts:cuts.map((c,i) => ({start:c.start,id:c.itemId,expectedId:order[i % order.length].id,ref:(layer === 'media' ? 'm:' : 'f:') + i})),links:p.timelineLinks};
                    }''', layer)
                    assert len(report['cuts']) == (len(expected) if loop else min(2, len(expected))), (loop, len(report['cuts']))
                    assert await lyric_targets(mode) == expected, 'insertion must not move lyric boundaries'
                    for i, cut in enumerate(report['cuts']):
                        assert cut['start'] == expected[i]['start'], 'fractional-frame start time must be copied exactly'
                        assert cut['id'] == cut['expectedId']
                        assert any(l['a'] == cut['ref'] and l['b'] == expected[i]['ref'] for l in report['links'])
                    prefix = 'm:' if layer == 'media' else 'f:'
                    assert after[other] == before[other], 'the other layer settings must be preserved'
                    if mode == 'line': assert after['timing'] == before['timing'], 'line mode must not add lyric timing overrides'
                    other_links = lambda links: [l for l in links if not l['a'].startswith(prefix) and not l['b'].startswith(prefix)]
                    assert other_links(after['timelineLinks']) == other_links(before['timelineLinks'])
                    await pg.locator('#btnUndo').click()
                    assert await project() == before, 'one Undo restores cuts and links'
                    await pg.locator('#btnRedo').click()
                    assert await project() == after
                    await insert.click()
                    assert await project() == after, 'repeating the action must not duplicate cuts or links'
        if mode == 'cut':
            targets = await lyric_targets(mode)
            assert len(targets) > 5
            assert any(c['ref'] == 'l:blank:blank-test' for c in targets)
            assert any(c['ref'].endswith(':interlude') for c in targets), targets
            # 긴 간주의 분할 조각(l:N:interlude:k)은 우리 쪽에서 일부러 링크 표시·드래그 대상이 아니다(0578b12) → 선은 그 조각을 뺀 수
            drawn = [c for c in targets if not re.search(r':interlude:\d+$', c['ref'])]
            assert len(drawn) < len(targets)
            assert await pg.locator('#timelineLinks .link-wire').count() == len(drawn) * 2
            # 안쪽 컷과 행 시작을 옮겨도 연결된 경계는 모두 맞춰진다
            for ref in ['l:0:1', 'l:1:0']:
                target = next(c for c in await lyric_targets(mode) if c['ref'] == ref)
                duration = await pg.evaluate('J.ui.plan.duration')
                rect = await pg.locator('#mediaTimeline').bounding_box(); y = rect['y'] + rect['height'] - 8
                await pg.mouse.move(rect['x'] + target['start'] / duration * rect['width'], y); await pg.mouse.down()
                await pg.mouse.move(rect['x'] + (target['start'] + .3) / duration * rect['width'], y, steps=8); await pg.mouse.up()
                moved = await lyric_targets(mode)
                assert next(c for c in moved if c['ref'] == ref)['start'] > target['start'] + .1
                for layer in ['foreground', 'media']:
                    assert await starts(layer) == [c['start'] for c in moved], 'cut links must stay aligned after dragging'
    assert await pg.locator('#timelineLinks .link-wire').count() == 10, 'both layers link to five lyric line starts'
    # 배경 경계 하나를 끌면 세 레이어 묶음 전체가 움직인다
    timing = await pg.evaluate('({start:J.ui.plan.media.cuts[1].start,duration:J.ui.plan.duration})')
    box = await pg.locator('#mediaTimeline').bounding_box(); y = box['y'] + box['height'] - 8
    await pg.mouse.move(box['x'] + timing['start'] / timing['duration'] * box['width'], y); await pg.mouse.down()
    await pg.mouse.move(box['x'] + (timing['start'] + .5) / timing['duration'] * box['width'], y, steps=8); await pg.mouse.up()
    s3 = await pg.evaluate('[J.ui.plan.media.cuts[1].start,J.ui.plan.foreground.cuts[1].start,J.ui.plan.lines[1].start]')
    assert s3[0] > timing['start'] + .2, 'boundary drag must move'
    assert s3[0] == s3[1] == s3[2], s3
    # 기존 연결 해제·구조 편집도 새 연결에서 동작한다
    linked = await project()
    await pg.locator('#timelineLinks .link-remove').first.click()
    assert len((await project())['timelineLinks']) == len(linked['timelineLinks']) - 1
    await pg.locator('#btnUndo').click()
    assert (await project())['timelineLinks'] == linked['timelineLinks']
    await pg.locator('#mediaLineList .media-cut-insert button').first.click()
    assert any(l['a'] == 'm:1' and l['b'] == 'l:0:0' for l in (await project())['timelineLinks'])
    await pg.locator('#btnUndo').click()
    assert await project() == linked
    await pg.locator('#sourceForeground').click(); await mode_select.select_option('cut')
    saved = await project()
    await pg.evaluate('J.uiApi.flushSave()'); await pg.reload()
    await pg.wait_for_function('window.J&&J.ui&&J.ui.plan&&J.mediaAssets.size === 4')
    assert await project() == saved, 'cuts, links and alignment preferences must survive reload'
    await pg.locator('#sourceForeground').click(); assert await mode_select.input_value() == 'cut'
    await pg.locator('#sourceMedia').click(); assert await mode_select.input_value() == 'line'
    await pg.locator('#mediaCutInsert').scroll_into_view_if_needed()   # 포크 #mediaLyricInsert
    await pg.screenshot(path=os.path.join(SHOTS, 'fork-media-lyrics-insert-ko.png'), full_page=True)
    await pg.locator('#sourceLyrics').click(); await pg.locator('#lyrics').fill('')
    await pg.wait_for_function('J.ui.plan.lines.length === 0')
    await pg.locator('#sourceMedia').click()
    assert await insert.is_disabled(), 'lyrics are required'
    assert not errs, errs
    await pg.close()

TESTS = [test_themes, test_project_file, test_export_menu, test_cropped_edges, test_cut_details, test_emphasis_frontmost,
         test_lyric_compositing, test_lyric_features, test_media_rhythm, test_media_size_slider, test_media_phases,
         test_media_random_order, test_media_auto_placement, test_media_effects, test_media_layer_settings, test_media_lyrics_insert]

async def main(names):
    tests = [t for t in TESTS if not names or t.__name__ in names]
    assert tests, names
    with serve() as url:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            for t in tests:
                await t(b, url); print('PASS', t.__name__, flush=True)
            await b.close()
    print('FORK UI OK')

if __name__ == '__main__':
    asyncio.run(main(sys.argv[1:]))
