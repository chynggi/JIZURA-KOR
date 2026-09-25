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
    await pg.goto(url); await pg.wait_for_function('window.J && J.ui && J.ui.project')
    return pg, errs

async def test_layer_order(pg):
    # 배경 컷 → 소재 뒤 → 가사 → 소재 앞 → 전경 컷
    order = await pg.evaluate('''() => {
      const calls = [], dm = J.drawMedia, da = J.drawAssets;
      J.drawMedia = (ctx, plan, t, o, layer, e) => { calls.push('media:' + layer); };
      J.drawAssets = (ctx, plan, layer) => { calls.push('assets:' + layer); };
      const plan = J.ui.plan, cut = plan.cuts[0];
      plan.assets = [{ id: 'x' }];
      plan.media = { cuts: [{ start: 0, end: 999, index: 0, itemId: 'm' }], opacity: 100, blend: 'normal' };
      plan.foreground = { cuts: [{ start: 0, end: 999, index: 0, itemId: 'f' }], opacity: 100, blend: 'normal' };
      J.mediaAssets.set('m', {}); J.mediaAssets.set('f', {});
      const cv = document.createElement('canvas'); cv.width = 160; cv.height = 90;
      try { new J.Renderer().frame(cv.getContext('2d'), plan, (cut.start + cut.end) / 2); }
      finally { J.drawMedia = dm; J.drawAssets = da; J.mediaAssets.delete('m'); J.mediaAssets.delete('f'); }
      return calls;
    }''')
    # frame()은 배경 미디어(media)를 별도 캔버스에 합성해 opacity/blend를 적용하므로,
    # 콘텐츠(소재+가사)는 그 버퍼 안에 먼저 그려지고 media:media 호출은 그 뒤, 최종적으로
    # ctx 위에 미디어→콘텐츠 순으로 그려져 시각적 순서(배경→소재 뒤→가사→소재 앞→전경)는 유지된다.
    want = ['assets:back', 'assets:front', 'media:media', 'media:foreground']
    got = [c for c in order if c in want]
    assert got == want, f'layer order {order}'

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

TESTS = []
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
