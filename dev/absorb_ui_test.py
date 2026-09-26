"""Browser checks for the absorbed fork features. Serves the repo root on 8766 itself.
usage: dev/.venv/bin/python dev/absorb_ui_test.py"""
import asyncio, base64, contextlib, http.server, json, os, re, threading
from functools import partial
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')
# 로컬 글꼴 가져오기 단언용: Windows 전용 C:/Windows/Fonts/arial.ttf 대신 이 환경의 실제 ttf를 쓴다
LOCAL_TTF = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

@contextlib.contextmanager
def serve(port=8766):
    h = partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    h.log_message = lambda *a: None
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', port), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try: yield f'http://127.0.0.1:{port}/index.html'
    finally: srv.shutdown()

async def open_app(b, url):
    pg = await b.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    # 첫 방문 투어는 캡처 단계에서 키 입력을 삼킨다(Ctrl+Z 테스트가 헛돈다): 본 것으로 표시해 둔다
    await pg.add_init_script("try { localStorage.setItem('jizura.tourDone', '1'); } catch (e) {}")
    await pg.goto(url); await pg.wait_for_function('window.J && J.ui && J.ui.project')
    return pg, errs

async def test_layer_order(pg):
    # 배경 컷 → 소재 뒤 → 가사 → 소재 앞 → 전경 컷: 스텁 "호출 순서"가 아니라 실제로 합성된
    # 픽셀로 검증한다. (호출 순서만 보면, 09_render.js에서 배경 미디어 그리기와 콘텐츠
    # 합성을 맞바꿔도 — 배경이 전부를 덮어버려도 — 순서 기록상으로는 안 걸릴 수 있다.)
    # 각 레이어를 겹치는 불투명한 색으로 칠하고, 세 지점의 "맨 위" 색으로 media<back,
    # back<front, front<foreground 세 관계를 증명한다(전이적으로 전체 순서가 확인됨).
    px = await pg.evaluate('''() => {
      const dm = J.drawMedia, da = J.drawAssets, dc = J.Renderer.prototype.drawCut;
      J.drawMedia = (ctx, plan, t, o, layer) => {
        const w = ctx.canvas.width, h = ctx.canvas.height;
        if (layer === 'media') { ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, w, h); }             // 배경: 전체 빨강
        else if (layer === 'foreground') { ctx.fillStyle = '#ffff00'; ctx.fillRect(w * 0.7, 0, w * 0.3, h); } // 전경: 오른쪽 30% 노랑
      };
      J.drawAssets = (ctx, plan, layer) => {
        const w = ctx.canvas.width, h = ctx.canvas.height;
        if (layer === 'back') { ctx.fillStyle = '#00ff00'; ctx.fillRect(0, 0, w * 0.8, h); }         // 소재 뒤: 왼쪽 80% 초록
        else if (layer === 'front') { ctx.fillStyle = '#0000ff'; ctx.fillRect(w * 0.5, 0, w * 0.4, h); } // 소재 앞: 50~90% 파랑
      };
      J.Renderer.prototype.drawCut = () => null;   // 가사·장식 없음: 표본 지점에 글자가 겹치지 않게
      const plan = J.ui.plan, cut = plan.cuts[0];
      cut.frontmost = false;
      plan.assets = [{ id: 'x' }];
      plan.media = { cuts: [{ start: 0, end: 999, index: 0, itemId: 'm' }], opacity: 100, blend: 'normal' };
      plan.foreground = { cuts: [{ start: 0, end: 999, index: 0, itemId: 'f' }], opacity: 100, blend: 'normal' };
      J.mediaAssets.set('m', {}); J.mediaAssets.set('f', {});
      const cv = document.createElement('canvas'); cv.width = 160; cv.height = 90;
      const ctx = cv.getContext('2d');
      let out = null;
      try {
        // noPost/noHud/noTrans/noGhost: 그레인·비네트·전환·고스트 패스가 표본 색을 물들이지 않게
        new J.Renderer().frame(ctx, plan, (cut.start + cut.end) / 2, { noPost: true, noHud: true, noTrans: true, noGhost: true });
        const at = fx => Array.from(ctx.getImageData(Math.round(cv.width * fx), Math.round(cv.height / 2), 1, 1).data);
        out = { back: at(0.2), front: at(0.6), fg: at(0.85) };
      } finally {
        J.drawMedia = dm; J.drawAssets = da; J.Renderer.prototype.drawCut = dc;
        J.mediaAssets.delete('m'); J.mediaAssets.delete('f');
      }
      return out;
    }''')
    def near(rgba, rgb, tol=30):
        return rgba[3] > 200 and all(abs(rgba[i] - rgb[i]) <= tol for i in range(3))
    assert near(px['back'], (0, 255, 0)), f'media < 소재 뒤 순서가 틀렸습니다(x=20% 표본이 초록이어야 함): {px["back"]}'
    assert near(px['front'], (0, 0, 255)), f'소재 뒤 < 소재 앞 순서가 틀렸습니다(x=60% 표본이 파랑이어야 함): {px["front"]}'
    assert near(px['fg'], (255, 255, 0)), f'소재 앞 < 전경 컷 순서가 틀렸습니다(x=85% 표본이 노랑이어야 함): {px["fg"]}'

async def test_binary_bundle_roundtrip(b, url):
    pg, errs = await open_app(b, url)
    r = await pg.evaluate('''async (png) => {
      const bytes = Uint8Array.from(atob(png), c => c.charCodeAt(0));
      const file = new File([bytes], 'bg.png', { type: 'image/png' });
      const item = { id: 'bgtest', name: 'bg.png', type: 'image', size: file.size };
      await J.storeMedia(item.id, file); J.ui.project.media.items.push(item);
      const a = await J.assetAdd(new File([bytes], 's.png', { type: 'image/png' }));
      J.ui.project.assets.push(a);
      await J.idbPut('mask:' + a.id, { name: 'm.png', type: 'image/png', data: bytes.buffer.slice(0) });
      let saved = null, savedName = ''; const orig = J.saveFile;
      J.saveFile = async (name, data) => { saved = data; savedName = name; };
      try { await J.uiApi.saveBundle(); } finally { J.saveFile = orig; }
      const head = new TextDecoder().decode(new Uint8Array(await saved.slice(0, 8).arrayBuffer()));
      await J.removeMedia(item.id); await J.idbDel('asset:' + a.id); await J.idbDel('mask:' + a.id);
      await J.uiApi.openFile(new File([saved], savedName));
      const m = await J.loadMedia('bgtest'), s = await J.idbGet('asset:' + a.id), k = await J.idbGet('mask:' + a.id);
      // 포크 확장자(.jizuraichi)로 된 같은 바이너리도 열린다
      await J.idbDel('mask:' + a.id);
      await J.uiApi.openFile(new File([saved], 'old.jizuraichi'));
      const k2 = await J.idbGet('mask:' + a.id);
      return { head, savedName, isBlob: saved instanceof Blob, media: m && m.size, asset: !!s, mask: !!k, ichi: !!k2,
               items: J.ui.project.media.items.length, assets: J.ui.project.assets.length };
    }''', base64.b64encode(PNG).decode())
    assert r['head'] == 'JIZURA01' and r['isBlob'] and r['savedName'].endswith('.jizura'), r
    assert r['media'] == len(PNG) and r['asset'] and r['mask'], r
    assert r['items'] == 1 and r['assets'] == 1, r
    assert r['ichi'], r
    # 구형 JSON 번들 v2도 열린다
    legacy = await pg.evaluate('''async () => {
      const p = JSON.parse(JSON.stringify(J.ui.project)); p.bundle = { version: 2, files: {}, mediaFiles: {} };
      await J.uiApi.openFile(new File([JSON.stringify(p)], 'old_all.jizura.json', { type: 'application/json' }));
      return Array.isArray(J.ui.project.media.items) && !('bundle' in J.ui.project);
    }''')
    assert legacy
    assert await pg.evaluate("document.querySelector('#fileProject').getAttribute('accept')") == '.jizura,.jizuraichi,.json'
    assert not errs, errs
    await pg.close()

WAV_JS = '''(() => { const sr = 22050, n = sr * 3, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0,'RIFF'); v.setUint32(4,36+n*2,true); w(8,'WAVE'); w(12,'fmt '); v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
  v.setUint32(24,sr,true); v.setUint32(28,sr*2,true); v.setUint16(32,2,true); v.setUint16(34,16,true); w(36,'data'); v.setUint32(40,n*2,true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i*2, (i % (sr/2) < 400 ? 12000 : 0) * Math.sin(i/5), true);
  return buf; })()'''
SEED_SONG = '''async () => {
  const buf = %s;
  await J.idbPut('song', { name: 't.wav', type: 'audio/wav', data: buf });
  J.ui.project.audioName = 't.wav'; delete J.ui.project.audioAsset; J.uiApi.flushSave();
  return buf.byteLength;
}''' % WAV_JS

async def test_legacy_song_migration(b, url):
    # 예전 'song' 레코드(다른 언어판도 같은 출처에서 읽고 씀)는 audioAsset으로 옮겨지되 지워지지 않는다
    pg, errs = await open_app(b, url)
    size = await pg.evaluate(SEED_SONG)
    await pg.reload(); await pg.wait_for_function('window.J && J.ui && J.ui.audio && J.ui.project.audioAsset', timeout=20000)
    r = await pg.evaluate('''async () => {
      const id = J.ui.project.audioAsset.id, f = await J.loadMedia(id), song = await J.idbGet('song');
      const saved = JSON.parse(localStorage.getItem('jizura.project.v1'));
      return { size: f && f.size, song: !!song, saved: saved.audioAsset && saved.audioAsset.id === id };
    }''')
    assert r == {'size': size, 'song': True, 'saved': True}, r
    assert not errs, errs
    await pg.close()
    # 미디어 저장소에 쓰지 못하면: 'song'에서 그대로 재생하고, 없는 파일을 가리키는 audioAsset은 남기지 않는다
    pg, errs = await open_app(b, url)
    await pg.evaluate(SEED_SONG)
    await pg.add_init_script("""const iv = setInterval(() => { if (window.J && J.storeMedia) { J.storeMedia = () => Promise.reject(new Error('quota')); clearInterval(iv); } }, 0);""")
    await pg.reload(); await pg.wait_for_function('window.J && J.ui && J.ui.audio', timeout=20000)
    r = await pg.evaluate('''async () => {
      J.uiApi.flushSave();
      const saved = JSON.parse(localStorage.getItem('jizura.project.v1'));
      return { asset: !!J.ui.project.audioAsset, savedAsset: !!saved.audioAsset, name: saved.audioName, song: !!(await J.idbGet('song')) };
    }''')
    assert r == {'asset': False, 'savedAsset': False, 'name': 't.wav', 'song': True}, r
    assert not errs, errs
    await pg.close()

async def test_undo_covers_our_edits(b, url):
    pg, errs = await open_app(b, url)
    # 편집마다 J.uiApi.flushSave()로 기록을 확정해 autosave 700ms 디바운스·묶음 창(1200ms)에 기대지 않는다
    r = await pg.evaluate('''async () => {
      const P = () => J.ui.project;
      document.querySelector('#modePro') && document.querySelector('#modePro').click();
      const ta = document.querySelector('#lyrics');
      ta.value = '하나\\n둘\\n셋'; ta.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 1500)); J.uiApi.flushSave();
      P().overrides[1] = Object.assign({}, P().overrides[1], { area: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 }, lock: true });
      J.uiApi.flushSave();
      ta.value = '하나\\n둘'; ta.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 1500)); J.uiApi.flushSave();
      ta.blur();
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', key: 'z', ctrlKey: true, bubbles: true }));
      await new Promise(r => setTimeout(r, 300));
      return { lyrics: P().lyrics, area: !!(P().overrides[1] && P().overrides[1].area),
               oldBtn: !!document.querySelector('#btnUndoEdit'), hasED: typeof window.edGo === 'function' };
    }''')
    assert r['lyrics'] == '하나\n둘\n셋', r
    assert r['area'], 'area override lost after undo'
    assert not r['oldBtn'], 'btnUndoEdit must be removed'
    assert not errs, errs
    await pg.close()

async def test_asset_delete_is_undoable(b, url):
    pg, errs = await open_app(b, url)
    r = await pg.evaluate('''async (png) => {
      const bytes = Uint8Array.from(atob(png), c => c.charCodeAt(0));
      const a = await J.assetAdd(new File([bytes], 's.png', { type: 'image/png' }));
      J.ui.project.assets.push(a); J.uiApi.flushSave();
      J.uiApi.removeAsset(a);                    // 소재 삭제 버튼과 같은 경로
      await new Promise(r => setTimeout(r, 100));
      const stillStored = !!(await J.idbGet('asset:' + a.id));
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', key: 'z', ctrlKey: true, bubbles: true }));
      await new Promise(r => setTimeout(r, 300));
      return { stillStored, back: J.ui.project.assets.some(x => x.id === a.id) };
    }''', base64.b64encode(PNG).decode())
    assert r == {'stillStored': True, 'back': True}, r
    assert not errs, errs
    await pg.close()

async def test_ai_pick_end_to_end(b, url):
    # R9: 8765는 사용자 자신의 서버가 점유하므로 테스트에서 바인딩하지 않는다. 앱은 그대로 8766에서
    # 서빙하고, decision_server.py는 PORT=8767로, 가짜 systemone 백엔드는 8799로 띄운 뒤, 페이지가
    # http://127.0.0.1:8765/api/decide 로 보내는 요청을 Playwright route로 가로채 8767로 전달한다
    # (decision_server는 자기 출처·Origin이 아니면 403을 돌려주므로 전달 시 Origin을 8767로 맞춘다).
    import socket, subprocess, sys, tempfile, time

    def wait_port(port, timeout=5.0):
        deadline = time.time() + timeout
        while time.time() < deadline:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(0.2)
                if s.connect_ex(('127.0.0.1', port)) == 0:
                    return
            time.sleep(0.05)
        raise TimeoutError(f'port {port} did not open in time')

    capture_fd, capture_path = tempfile.mkstemp(suffix='.json')
    os.close(capture_fd)
    # R5: 가짜 백엔드는 모든 질문에서 criteria의 "첫 키"를 고른다. 실제로 무엇이 첫 키였는지는
    # 필터링(J.randomOk 등)에 따라 달라지므로, 받은 요청 본문을 파일에 남겨 나중에 그대로 검증한다.
    fake = subprocess.Popen([sys.executable, '-c', '''
import http.server, json, os
CAPTURE = os.environ["CAPTURE_PATH"]
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        with open(CAPTURE, "w") as f:
            json.dump(body, f)
        ans = {q: {"type": "choice", "choice": list(v["criteria"])[0]} for q, v in body["questions"].items()}
        raw = json.dumps({"answers": ans}).encode()
        self.send_response(200); self.send_header("Content-Length", str(len(raw))); self.end_headers(); self.wfile.write(raw)
http.server.HTTPServer(("127.0.0.1", 8799), H).serve_forever()
'''], env=dict(os.environ, CAPTURE_PATH=capture_path))
    env = dict(os.environ, DECISION_BACKEND='systemone', DECISION_URL='http://127.0.0.1:8799/v1/systemone', PORT='8767')
    srv = subprocess.Popen([sys.executable, os.path.join(ROOT, 'decision_server.py')], env=env)
    try:
        wait_port(8799); wait_port(8767)
        pg, errs = await open_app(b, url)

        async def route_decide(route):
            req = route.request
            real_origin = req.headers.get('origin')  # 페이지의 실제 출처(8766) — 브라우저는 응답의 CORS 헤더를 이 값과 비교한다
            headers = {k: v for k, v in req.headers.items() if k.lower() != 'host'}
            headers['origin'] = 'http://127.0.0.1:8767'  # decision_server 자신의 출처 검사(403)를 통과시키기 위함
            resp = await route.fetch(url='http://127.0.0.1:8767/api/decide', headers=headers)
            body = await resp.body()
            resp_headers = dict(resp.headers)
            if real_origin:  # decision_server가 8767로 착각해 돌려준 CORS 헤더를 실제 출처로 되돌려 붙인다
                resp_headers['access-control-allow-origin'] = real_origin
                resp_headers['vary'] = 'Origin'
            await route.fulfill(status=resp.status, headers=resp_headers, body=body)
        await pg.route('http://127.0.0.1:8765/api/decide', route_decide)

        await pg.click('#modePro')
        await pg.fill('#lyrics', '밤하늘\n별빛')
        await pg.wait_for_timeout(400)  # 가사 입력 핸들러가 S.project.lyrics에 반영될 시간
        await pg.click('#btnAiPick')
        await pg.wait_for_function(
            "document.querySelector('#toast') && !document.querySelector('#toast').hidden"
            " && document.querySelector('#toast').textContent.includes('AI로 고르기')",
            timeout=8000)
        toast_text = await pg.evaluate("document.querySelector('#toast').textContent")
        assert 'AI로 고르기: ' in toast_text and '×' in toast_text, toast_text  # 성공 토스트인지 확인(오류 토스트에는 × 가 없음)

        with open(capture_path, encoding='utf-8') as f:
            sent = json.load(f)
        expected_style = list(sent['questions']['style']['criteria'])[0]
        expected_layout = list(sent['questions']['layout_0']['criteria'])[0]

        state = await pg.evaluate('''() => ({
          style: J.ui.project.style,
          overrides: J.ui.project.overrides,
        })''')
        assert state['style'] == expected_style, (state['style'], expected_style)
        overs = state['overrides'] or {}
        assert any(o and o.get('layout') == expected_layout for o in overs.values()), (overs, expected_layout)
        assert not errs, errs
        await pg.close()
    finally:
        srv.terminate(); srv.wait(timeout=5)
        fake.terminate(); fake.wait(timeout=5)
        try: os.remove(capture_path)
        except OSError: pass

async def test_fork_features(b, url):
    # hirazisora/main:dev/new_features_test.cjs 이식. en/ 로케일은 재빌드하지 않으므로 루트 index.html만 검사한다.
    # Windows Edge 전제(executablePath, C:/... 경로)는 걷어내고 이 환경의 기본 Chromium과 실제 ttf를 쓴다.
    def svg_img(name):
        return {'name': name, 'mimeType': 'image/svg+xml',
                'buffer': b'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="red"/></svg>'}

    pg = await b.new_page(viewport={'width': 1400, 'height': 950})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    # 첫 방문 투어가 클릭을 삼키지 않게 미리 본 것으로 표시(open_app과 동일한 처리)
    await pg.add_init_script("try { localStorage.setItem('jizura.tourDone', '1'); } catch (e) {}")
    await pg.add_init_script(
        "window.queryLocalFonts = async () => [{ family: 'Arial', fullName: 'Arial Regular', "
        "postscriptName: 'ArialMT', style: 'Regular' }];")
    await pg.goto(url)
    await pg.wait_for_function('window.J && J.ui && J.ui.project')

    await pg.locator('#modePro').click()
    await pg.locator('[data-tab="out"]').click()
    await pg.locator('#outVideoSize').select_option('1080x1920')
    assert await pg.evaluate('J.outputSize(J.ui.project)') == [1080, 1920]
    assert await pg.locator('#eVideoSize').input_value() == '1080x1920'
    await pg.locator('#outVideoSize').select_option('custom')
    await pg.locator('#outVideoWidth').fill('1500'); await pg.locator('#outVideoWidth').dispatch_event('change')
    await pg.locator('#outVideoHeight').fill('900'); await pg.locator('#outVideoHeight').dispatch_event('change')
    assert await pg.evaluate('J.outputSize(J.ui.project)') == [1500, 900]
    assert await pg.locator('#outVideoSize').input_value() == 'custom'

    await pg.locator('#timelineZoomIn').click(); await pg.locator('#timelineZoomIn').click()
    widths = await pg.evaluate(
        "() => [document.querySelector('#timelineScroll').clientWidth, document.querySelector('#timelineStack').clientWidth]")
    assert widths[1] > widths[0] * 2, f'timeline width: {widths}'

    await pg.locator('[data-tab="style"]').click()
    # 포크는 /Noto Sans JP/를 직접 단언했다. 한글판 기본 프로젝트는 샘플 가사(J.SAMPLE_LYRICS)가 한국어라
    # 언어 자동판정이 'ko'가 되고, 이 언어에서 gothic_bold는 src/02b_lang.js의 ko.map에 따라 Noto Sans KR
    # 700으로 그려진다. 기대값을 UI와 같은 J.faceOf() 호출로 만들면 동어반복 검증이 되므로, 이 빌드에서
    # 실제로 쓰여야 하는 값을 하드코딩하고 언어가 정말 'ko'로 판정됐는지도 별도로 확인한다.
    assert await pg.evaluate('J.lang') == 'ko', await pg.evaluate('J.lang')
    style_family = await pg.locator('#fontRoles option[value="gothic_bold"]').first.evaluate('el => el.style.fontFamily')
    assert 'Noto Sans KR' in style_family, style_family
    await pg.locator('#btnListFonts').click()
    assert await pg.locator('#installedFonts option').count() == 1
    await pg.locator('#btnImportFont').click()
    labels = await pg.locator('#fontRoles option').all_text_contents()
    assert any('Arial' in label for label in labels), labels

    await pg.locator('#compositeName').fill('Mixed test')
    await pg.locator('#compositeBase').select_option('gothic_bold')
    # 가져온 PC 글꼴의 실제 키(local_ + 16진수)를 하드코딩 대신 페이지에서 직접 읽는다(생성 규칙은 원본과 동일)
    latin_key = await pg.evaluate("Object.keys(J.FONTS).find(k => J.FONTS[k].label === 'Arial Regular')")
    assert latin_key and latin_key.startswith('local_'), latin_key
    await pg.locator('#compositeParts [data-part="latin"]').select_option(latin_key)
    await pg.locator('#btnSaveComposite').click()
    composite = await pg.evaluate('''() => {
      const def = J.ui.project.compositeFonts[0];
      return { name: def.name, latin: J.fontForChar(def.key, 'A'), kana: J.fontForChar(def.key, '\u3042'),
               punctuation: J.compositeCategory('\u30fb'), gaiji: J.compositeCategory('\ue000'),
               size: J.outputSize(J.ui.project), role: J.plan(J.ui.project, null).style.fonts.display[0],
               css: J.fontCSS(def.key, 40, 'A') };
    }''')
    assert composite['name'] == 'Mixed test', composite
    assert composite['latin'] == latin_key, composite
    assert composite['kana'] == 'gothic_bold', composite
    assert composite['punctuation'] == 'punctuation', composite
    assert composite['gaiji'] == 'gaiji', composite
    assert composite['role'].startswith('composite_'), composite
    assert 'Arial' in composite['css'], composite
    assert composite['size'] == [1500, 900], composite

    await pg.locator('#fontFile').set_input_files(LOCAL_TTF)
    await pg.wait_for_function('() => J.ui.project.userFonts.some(font => font.file)')
    ttf_base = os.path.splitext(os.path.basename(LOCAL_TTF))[0]
    expected_uf_family = 'UF_' + re.sub(r'[^\w]', '_', ttf_base)
    # 원본 포크 테스트처럼 명시적 flushSave 없이 reload한다 — pagehide 핸들러(src/12_ui.js ~161)가
    # 저장을 맡는 실제 경로를 그대로 검증한다.
    await pg.reload()
    await pg.wait_for_function('window.J && J.ui && J.ui.project')
    assert await pg.locator('#compositeList .composite-saved').count() == 1
    assert await pg.evaluate('J.outputSize(J.ui.project)') == [1500, 900]
    await pg.wait_for_function(
        "(fam) => [...document.fonts].some(face => face.family === fam)", arg=expected_uf_family)

    await pg.locator('#sourceMedia').click()
    await pg.locator('#mediaFiles').set_input_files([svg_img('one.svg'), svg_img('two.svg'), svg_img('three.svg')])
    await pg.locator('#mediaRandom').check(); await pg.locator('#mediaLoop').check(); await pg.locator('#btnTapMedia').click()  # 포크: 배경·전경 탭에서는 곡·타이밍 섹션이 숨고 이 버튼을 쓴다
    for i in range(5):
        await pg.evaluate("(t) => { J.ui.t = t; document.querySelector('#tapBtn').click(); }", i + 0.3)
    order_ok = await pg.evaluate('''() => {
      const order = J.mediaOrder(J.ui.project, 'media').map(item => item.id);
      return J.ui.plan.media.cuts.map((cut, index) => cut.itemId === order[index % order.length]);
    }''')
    assert order_ok == [True] * 5, order_ok
    await pg.locator('#tapStop').click()

    await pg.locator('.foreground-placement-open').first.click()
    await pg.evaluate('''() => {
      const el = document.querySelector('#areaEditOverlay'), rect = document.querySelector('#areaEditRect').getBoundingClientRect();
      el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: rect.x + rect.width / 2, clientY: rect.y + 3 }));
    }''')
    rotation_cursor = await pg.locator('#areaEditOverlay').evaluate(
        "el => ({ inline: el.style.cursor, computed: getComputedStyle(el).cursor, rect: document.querySelector('#areaEditRect').style.cursor })")
    assert re.search(r'data:image/svg\+xml', rotation_cursor['computed']), rotation_cursor
    await pg.locator('#areaCancel').click()

    await pg.locator('#sourceForeground').click()
    await pg.locator('#mediaFiles').set_input_files([svg_img('front-one.svg'), svg_img('front-two.svg')])
    await pg.locator('#mediaLoop').check(); await pg.locator('#btnTapMedia').click()
    for i in range(3):
        await pg.evaluate("(t) => { J.ui.t = t; document.querySelector('#tapBtn').click(); }", i + 0.4)
    order_ok2 = await pg.evaluate('''() => {
      const order = J.mediaOrder(J.ui.project, 'foreground').map(item => item.id);
      return J.ui.plan.foreground.cuts.map((cut, index) => cut.itemId === order[index % order.length]);
    }''')
    assert order_ok2 == [True] * 3, order_ok2
    await pg.locator('#tapStop').click()

    assert not errs, errs
    await pg.close()

def near(rgba, rgb, tol=30):
    return rgba[3] > 200 and all(abs(rgba[i] - rgb[i]) <= tol for i in range(3))

async def test_cut_times_follow_line(b, url):
    # 손으로 정한 컷 경계(timing.cutTimes, 초)는 행 시작이 움직이면 같이 움직여야 한다.
    # 재현: 경계 0:1 = 4.0, 0행을 2 s → 8 s로 옮기면 고치기 전에는 첫 컷이 8.00–8.22 s가 됐다.
    pg, errs = await open_app(b, url)
    r = await pg.evaluate('''async () => {
      document.querySelector('#modePro').click();
      const ta = document.querySelector('#lyrics');
      ta.value = '밤하늘에 빛나는 별들을 보며\\n둘째 줄'; ta.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 1500));
      const P = J.ui.project;
      P.overrides = { 0: { cuts: 2 } };
      P.timing.lineTimes = { 0: 2, 1: 20 }; P.timing.cutTimes = { '0:1': 4 };
      J.uiApi.replan();
      const first = () => { const c = J.ui.plan.cuts.find(c => c.line === 0 && c.part === 0); return { start: c.start, end: c.end }; };
      const out = { before: first() };
      // 탭 동기화(버튼과 같은 경로): 0행을 8 s에 탭하고 종료
      document.querySelector('#btnTap').click();
      J.ui.t = 8; document.querySelector('#tapBtn').click();
      document.querySelector('#tapStop').click();
      out.tap = Object.assign(first(), { ct: P.timing.cutTimes['0:1'] });
      // 행 목록의 시각 입력란: 0행을 5 s로
      const f = J.ui.lineEls[0].querySelector('.time'); f.value = '5'; f.dispatchEvent(new Event('change'));
      out.field = Object.assign(first(), { ct: J.ui.project.timing.cutTimes['0:1'] });
      // 가사 지우기: 행 번호에 묶인 것은 모두 지운다
      J.ui.project.lyricCutOptions = { '0:0': { frontmost: true } };
      J.ui.project.lyricBlankCuts = [{ id: 'bx', beforeLine: 1, start: 15 }];
      document.querySelector('#btnClearLyrics').click();
      const Q = J.ui.project;
      out.cleared = { cutTimes: Object.keys(Q.timing.cutTimes || {}).length, opts: Object.keys(Q.lyricCutOptions || {}).length,
                      blanks: (Q.lyricBlankCuts || []).length, links: (Q.timelineLinks || []).length };
      return out;
    }''')
    assert abs(r['before']['start'] - 2) < 1e-6 and abs(r['before']['end'] - 4) < 1e-6, r
    assert abs(r['tap']['start'] - 8) < 1e-6, r
    assert r['tap']['end'] - r['tap']['start'] > 0.5, f'첫 컷이 너무 짧습니다(경계가 따라오지 않음): {r}'
    assert abs(r['tap']['ct'] - 10) < 1e-6, f'경계가 Δ(+6 s)만큼 옮겨지지 않았습니다: {r}'
    assert abs(r['field']['start'] - 5) < 1e-6 and abs(r['field']['ct'] - 7) < 1e-6, f'시각 입력란 경로: {r}'
    assert r['cleared'] == {'cutTimes': 0, 'opts': 0, 'blanks': 0, 'links': 0}, r
    assert not errs, errs
    await pg.close()

# 레이어 픽셀 스텁: 배경 컷 = 전체 빨강, 전경 컷 = 오른쪽 30% 노랑, 소재 뒤 = 왼쪽 40% 초록, 소재 앞 = 40~60% 파랑
STUB_LAYERS = '''
  const dm = J.drawMedia, da = J.drawAssets, dc = J.Renderer.prototype.drawCut;
  J.drawMedia = (ctx, plan, t, o, layer) => {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    if (layer === 'media') { ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, w, h); }
    else if (layer === 'foreground') { ctx.fillStyle = '#ffff00'; ctx.fillRect(w * 0.7, 0, w * 0.3, h); }
  };
  J.drawAssets = (ctx, plan, layer) => {
    const w = plan.W, h = plan.H;
    if (layer === 'back') { ctx.fillStyle = '#00ff00'; ctx.fillRect(0, 0, w * 0.4, h); }
    else if (layer === 'front') { ctx.fillStyle = '#0000ff'; ctx.fillRect(w * 0.4, 0, w * 0.2, h); }
  };
  J.Renderer.prototype.drawCut = () => null;
  const restore = () => { J.drawMedia = dm; J.drawAssets = da; J.Renderer.prototype.drawCut = dc; J.mediaAssets.delete('m'); J.mediaAssets.delete('f'); };
  const cv = document.createElement('canvas'); cv.width = 160; cv.height = 90;
  const ctx = cv.getContext('2d');
  const at = fx => Array.from(ctx.getImageData(Math.round(cv.width * fx), Math.round(cv.height / 2), 1, 1).data);
  const OPT = { noPost: true, noHud: true, noTrans: true, noGhost: true, scale: cv.width / J.ui.plan.W };
'''

async def test_layered_export_media(b, url):
    # 투명 PNG 앞/뒤 레이어(11_export.js: R.frame(..., { transparent: true, layer: 'back' | 'front' })):
    # 배경 컷은 뒤 레이어에만, 전경 컷은 앞 레이어에만 들어가야 한다
    pg, errs = await open_app(b, url)
    px = await pg.evaluate('() => {' + STUB_LAYERS + '''
      const plan = J.ui.plan, cut = plan.cuts.find(c => !c.blank) || plan.cuts[0];
      cut.frontmost = false; plan.assets = [];
      plan.media = { cuts: [{ start: 0, end: 999, index: 0, itemId: 'm' }], opacity: 100, blend: 'normal' };
      plan.foreground = { cuts: [{ start: 0, end: 999, index: 0, itemId: 'f' }], opacity: 100, blend: 'normal' };
      J.mediaAssets.set('m', {}); J.mediaAssets.set('f', {});
      const t = (cut.start + cut.end) / 2, out = {};
      try {
        for (const layer of ['back', 'front']) {
          new J.Renderer().frame(ctx, plan, t, Object.assign({ transparent: true, layer }, OPT));
          out[layer] = { left: at(0.2), right: at(0.85) };
        }
      } finally { restore(); }
      return out;
    }''')
    assert near(px['back']['left'], (255, 0, 0)), f'뒤 레이어에 배경 컷이 없습니다: {px}'
    assert near(px['back']['right'], (255, 0, 0)), f'뒤 레이어에 전경 컷이 들어갔습니다: {px}'
    assert near(px['front']['right'], (255, 255, 0)), f'앞 레이어에 전경 컷이 없습니다: {px}'
    assert px['front']['left'][3] < 10, f'앞 레이어에 배경 컷이 들어갔습니다: {px}'
    assert not errs, errs
    await pg.close()

async def test_blank_cut_keeps_assets(b, url):
    # 빈 가사 컷에서도 소재(뒤·앞)는 보여야 한다
    pg, errs = await open_app(b, url)
    r = await pg.evaluate('''async () => {
      document.querySelector('#modePro').click();
      const ta = document.querySelector('#lyrics');
      ta.value = '하나\\n둘'; ta.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 1500));
      const P = J.ui.project;
      P.timing.lineTimes = { 0: 2, 1: 10 }; P.lyricBlankCuts = [{ id: 'b1', beforeLine: 1, start: 7 }];
      J.uiApi.replan();''' + STUB_LAYERS + '''
      const plan = J.ui.plan, blank = plan.cuts.find(c => c.blank);
      plan.assets = [{ id: 'x' }]; plan.media = { cuts: [] }; plan.foreground = { cuts: [] };
      const out = { blank: !!blank };
      try {
        new J.Renderer().frame(ctx, plan, (blank.start + blank.end) / 2, OPT);
        out.back = at(0.2); out.front = at(0.5);
      } finally { restore(); }
      return out;
    }''')
    assert r['blank'], r
    assert near(r['back'], (0, 255, 0)), f'빈 컷에서 소재(뒤)가 사라졌습니다: {r}'
    assert near(r['front'], (0, 0, 255)), f'빈 컷에서 소재(앞)가 사라졌습니다: {r}'
    assert not errs, errs
    await pg.close()

async def test_line_start_change_is_one_undo_step(b, url):
    # 행 시작을 바꾸면(곡에서 초안 / 시각 입력란 / 한 행 탭) 안에서 replan()이 두 번 돈다(새 시작 → 컷 경계가
    # 따라옴). 이 둘이 실행 취소 2단계로 남으면 Ctrl+Z 한 번이 중간 상태(새 시작 + 옛 경계)로만 돌아간다.
    pg, errs = await open_app(b, url)
    r = await pg.evaluate('''async () => {
      const P = () => J.ui.project;
      const setup = () => {
        P().timing.lineTimes = { 0: 2, 1: 6, 2: 10 };
        P().timing.cutTimes = Object.assign({}, P().timing.cutTimes, { '0:1': 4 });
        J.uiApi.flushSave();
        return JSON.stringify({ lt: P().timing.lineTimes, ct: P().timing.cutTimes });
      };
      const snap = () => JSON.stringify({ lt: P().timing.lineTimes, ct: P().timing.cutTimes });
      const undo = async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', key: 'z', ctrlKey: true, bubbles: true }));
        await new Promise(r => setTimeout(r, 300));
      };
      document.querySelector('#modePro') && document.querySelector('#modePro').click();
      const ta = document.querySelector('#lyrics');
      ta.value = '하나\\n둘\\n셋'; ta.dispatchEvent(new Event('input', { bubbles: true }));
      J.uiApi.flushSave(); await new Promise(r => setTimeout(r, 300));
      ta.blur();

      // 1) 행 목록 시각 입력란 경로: 0행 시작 2 → 8
      const before1 = setup();
      J.uiApi.setLineStart(0, 8);
      await new Promise(r => setTimeout(r, 300));
      await undo();
      const field = { before: before1, after: snap() };

      // 2) 곡에서 초안 경로: J.draftLineStarts를 스텁으로 바꿔 고정 시각을 돌려준다
      const before2 = setup();
      const origAudio = J.ui.audio, origDraft = J.draftLineStarts;
      J.ui.audio = { duration: 30 };
      J.draftLineStarts = async () => [1, 5, 9];
      document.querySelector('#btnDraft').click();
      await new Promise(r => setTimeout(r, 300));
      await undo();
      const draft = { before: before2, after: snap() };
      J.ui.audio = origAudio; J.draftLineStarts = origDraft;

      // 3) 한 행 탭 경로: startTap(0, true) → tapNow 한 번 → single이라 곧바로 stopTap
      const before3 = setup();
      J.uiApi.startTap(0, true);
      J.ui.t = 8;
      document.querySelector('#tapBtn').click();
      await new Promise(r => setTimeout(r, 300));
      await undo();
      const tap = { before: before3, after: snap() };

      return { field, draft, tap };
    }''')
    assert r['field']['after'] == r['field']['before'], f"시각 입력란 경로: {r['field']}"
    assert r['draft']['after'] == r['draft']['before'], f"곡에서 초안 경로: {r['draft']}"
    assert r['tap']['after'] == r['tap']['before'], f"한 행 탭 경로: {r['tap']}"
    assert not errs, errs
    await pg.close()

async def test_cut_panel_unified(b, url):
    pg, errs = await open_app(b, url)
    await pg.click('#modePro')
    await pg.fill('#lyrics', '하나\n둘\n셋'); await pg.wait_for_function("J.ui.plan && J.ui.plan.cuts.length >= 3")
    await pg.evaluate("J.uiApi.selectCut(1)")
    panel = pg.locator(await pg.evaluate("J.uiApi.cutPanelSelector"))
    assert await panel.count() == 1
    # 세 절이 모두 같은 패널 안에 있다
    for sel in await pg.evaluate("J.uiApi.cutPanelSections"):
        assert await panel.locator(sel).count() >= 1, sel
    # 레이아웃 선택 컨트롤은 화면 전체에서 이 컷에 대해 하나
    assert await pg.locator('[data-cut-layout]').count() == 1
    # 옮긴 컨트롤은 행 목록에 더는 없다(중복 제거)
    for sel in ['.cut-lay', '.cand', '.uta', '.lyric-cut-compositing', '.lyric-frontmost', '.cut-details-open']:
        assert await pg.locator('#lineList ' + sel).count() == 0, sel
    line = await pg.evaluate("J.ui.plan.cuts[1].line")
    # 회귀 1: 패널의 후보 버튼 → 후보 하나 고르기 → 그 행 override에 후보 필드(seed)가 생기고 area는 남는다
    await pg.evaluate("(i) => { J.ui.project.overrides[i] = Object.assign({}, J.ui.project.overrides[i], { area: { x: 0.1, y: 0.2, w: 0.5, h: 0.5 } }); J.uiApi.replan(); J.uiApi.selectCut(1); }", line)
    await panel.locator('[data-cut-section="line"] .cand').click()
    await pg.locator('#candDlg .cand-item').nth(2).click()
    ov = await pg.evaluate("(i) => J.ui.project.overrides[i]", line)
    assert ov.get('seed') is not None, ov
    assert ov.get('area') == {'x': 0.1, 'y': 0.2, 'w': 0.5, 'h': 0.5}, ov
    # 우타하메 토글도 패널에서: 다른 필드는 남는다
    await pg.evaluate("J.uiApi.selectCut(1)")
    await panel.locator('[data-cut-section="line"] .uta').click()
    ov = await pg.evaluate("(i) => J.ui.project.overrides[i]", line)
    assert ov.get('utahame') is True and ov.get('area') and ov.get('seed') is not None, ov
    # 회귀 2: 「이 컷만 섞기」 → 그 컷만 바뀐다(다른 행 override·컷 구성은 그대로, 이 행의 다른 필드도 그대로)
    await pg.evaluate("J.uiApi.selectCut(1)")
    snap = """() => ({ ov: JSON.parse(JSON.stringify(J.ui.project.overrides)),
      cuts: J.ui.plan.cuts.map(c => [c.line, c.layout].join('/')) })"""
    before = await pg.evaluate(snap)
    await pg.locator('#cutInfo button.cut-roll[data-roll="shuffle"]').click()
    after = await pg.evaluate(snap)
    for k, v in before['ov'].items():
        if k != str(line): assert after['ov'].get(k) == v, (k, v, after['ov'].get(k))
    mine = after['ov'][str(line)]
    k = await pg.evaluate("(() => { const c = J.ui.plan.cuts[1]; return J.ui.plan.cuts.filter(x => x.line === c.line && x.index < c.index && J.LAYOUTS[x.layout] && !J.LAYOUTS[x.layout].special).length; })()")
    assert list(mine.get('cutTech', {}).keys()) == [str(k)], mine   # 이 컷의 슬롯에만 썼다
    for f in ['area', 'seed', 'utahame']: assert mine.get(f) == before['ov'][str(line)].get(f), (f, mine)
    # 다른 컷의 레이아웃은 그대로(이웃 컷의 퇴장은 다음 컷에 맞춰 플래너가 다시 고를 수 있으므로 비교하지 않는다)
    for n, (x, y) in enumerate(zip(before['cuts'], after['cuts'])):
        if n != 1: assert x == y, (n, x, y)
    # 레이어 상세(②): 패널의 합성 방법을 바꾸면 그 컷의 lyricCutOptions에 병합된다
    await pg.evaluate("J.uiApi.selectCut(1)")
    part = await pg.evaluate("J.ui.plan.cuts[1].part")
    await panel.locator('[data-cut-section="layer"] .lyric-cut-blend').select_option('screen')
    opt = await pg.evaluate(f"J.ui.project.lyricCutOptions['{line}:{part}']")
    assert opt and opt.get('blend') == 'screen', opt
    # 배경 컷(미디어): ②에 그 컷의 상세 편집 버튼이 붙는다(①·③은 가사 컷 전용)
    await pg.locator('#sourceMedia').click()
    await pg.locator('#mediaFiles').set_input_files([{'name': 'bg.svg', 'mimeType': 'image/svg+xml',
        'buffer': b'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="red"/></svg>'}])
    await pg.wait_for_function("J.ui.plan.media && J.ui.plan.media.cuts.length >= 1")
    await pg.evaluate("J.uiApi.selectCut(1)")
    assert await pg.evaluate("!!J.mediaAt(J.ui.plan, J.ui.t)")
    md = panel.locator('[data-cut-section="layer"] [data-media-details="media"]')
    assert await md.count() == 1
    assert await pg.locator('#mediaLineList .cut-details-open').count() == 0
    await md.click()
    assert await pg.locator('#cutDetailsDialog').count() == 1
    await pg.locator('#cutDetailsDialog').get_by_role('button', name='취소', exact=True).click()
    # 데스크톱: ②·③은 늘 펼쳐져 있고 「컷 편집」 요약 줄은 숨는다
    assert await pg.evaluate("document.querySelector('#cutMore').open") is True
    assert not await pg.locator('#cutMore > summary').is_visible()
    # 접근 가능한 이름: 후보 버튼은 보이는 글자를 포함, 상세 버튼은 컷 번호를 말한다
    await pg.locator('#sourceLyrics').click(); await pg.evaluate("J.uiApi.selectCut(1)")
    assert '후보 6개' in await panel.locator('[data-cut-section="line"] .cand').get_attribute('aria-label')
    assert '2번 컷' in await panel.locator('[data-cut-section="layer"] [data-cut-ctl="details"]').get_attribute('aria-label')
    # 다시 그려도(replan) 포커스가 같은 컨트롤로 돌아온다
    await panel.locator('[data-cut-ctl="uta"]').focus()
    await pg.evaluate("J.uiApi.replan(); J.uiApi.selectCut(1)")
    assert await pg.evaluate("document.activeElement && document.activeElement.dataset.cutCtl") == 'uta'
    # 스마트폰: ②·③은 접힌 「컷 편집」 안 — 고정 무대는 이 태스크 전(②·③ 없음)보다 48px 넘게 커지지 않는다
    for vw, vh in [(390, 844), (360, 740)]:
        await pg.set_viewport_size({'width': vw, 'height': vh})
        await pg.click('#modeMobile'); await pg.evaluate("J.uiApi.selectCut(1)")
        assert await pg.evaluate("document.querySelector('#cutMore').open") is False
        h = await pg.evaluate('''() => { const st = document.querySelector('.col-stage'), m = document.querySelector('#cutMore');
          const closed = st.getBoundingClientRect().height; m.style.display = 'none';
          const without = st.getBoundingClientRect().height; m.style.display = ''; return [closed, without]; }''')
        assert h[0] - h[1] <= 48, (vw, h)
        await pg.locator('#cutMore > summary').click()
        assert await panel.locator('[data-cut-section="line"] .cand').is_visible()
        await pg.evaluate("J.uiApi.selectCut(2)")   # 다른 컷으로 가도 이 세션 동안 펼침 유지
        assert await pg.evaluate("document.querySelector('#cutMore').open") is True
        await pg.locator('#cutMore > summary').click()
    assert not errs, errs
    await pg.close()

TESTS = [test_legacy_song_migration, test_cut_times_follow_line, test_layered_export_media, test_blank_cut_keeps_assets,
         test_line_start_change_is_one_undo_step,
         test_undo_covers_our_edits, test_asset_delete_is_undoable, test_ai_pick_end_to_end, test_fork_features, test_cut_panel_unified]
async def main():
    with serve() as url:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            pg, errs = await open_app(b, url)
            await test_layer_order(pg); assert not errs, errs; await pg.close()
            await test_binary_bundle_roundtrip(b, url)
            for t in TESTS: await t(b, url)
            await b.close()
    print('ABSORB UI OK')
asyncio.run(main())
