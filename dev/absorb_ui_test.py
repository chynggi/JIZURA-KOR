"""Browser checks for the absorbed fork features. Serves the repo root on 8766 itself.
usage: dev/.venv/bin/python dev/absorb_ui_test.py"""
import asyncio, base64, contextlib, http.server, json, os, threading
from functools import partial
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')

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

async def test_bundle_roundtrip(b, url):
    pg, errs = await open_app(b, url)
    saved = await pg.evaluate('''async (png) => {
      const bytes = Uint8Array.from(atob(png), c => c.charCodeAt(0));
      const file = new File([bytes], 'bg.png', { type: 'image/png' });
      const item = { id: 'bgtest', name: 'bg.png', type: 'image', size: file.size };
      await J.storeMedia(item.id, file);
      J.ui.project.media.items.push(item);
      let text = null; const orig = J.saveFile;
      J.saveFile = async (name, t) => { text = t; };
      try { await J.uiApi.saveBundle(); } finally { J.saveFile = orig; }
      await J.removeMedia(item.id);
      return text;
    }''', base64.b64encode(PNG).decode())
    assert saved, 'saveBundle produced nothing'
    doc = json.loads(saved)
    assert doc['bundle']['version'] == 2, doc.get('bundle')
    assert 'bgtest' in doc['bundle']['mediaFiles'], 'background file missing from bundle'
    assert doc['media']['items'][0]['id'] == 'bgtest', 'background settings must stay in project.media'
    restored = await pg.evaluate('''async (text) => {
      await J.uiApi.openProject(JSON.parse(text));
      const f = await J.loadMedia('bgtest');
      return { size: f && f.size, items: J.ui.project.media.items.length, hasBundle: 'bundle' in J.ui.project };
    }''', saved)
    assert restored == {'size': len(PNG), 'items': 1, 'hasBundle': False}, restored
    # 구형 v1 번들(p.media = {version:1, files})도 열린다
    legacy = await pg.evaluate('''async () => {
      await J.uiApi.openProject(Object.assign(JSON.parse(JSON.stringify(J.ui.project)), { media: { version: 1, files: {} } }));
      return Array.isArray(J.ui.project.media.items);
    }''')
    assert legacy, 'legacy bundle broke project.media'
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

TESTS = [test_undo_covers_our_edits, test_asset_delete_is_undoable]
async def main():
    with serve() as url:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            pg, errs = await open_app(b, url)
            await test_layer_order(pg); assert not errs, errs; await pg.close()
            await test_bundle_roundtrip(b, url)
            for t in TESTS: await t(b, url)
            await b.close()
    print('ABSORB UI OK')
asyncio.run(main())
