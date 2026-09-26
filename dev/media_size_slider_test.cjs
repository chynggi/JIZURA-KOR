const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  try {
    for (const locale of ['', 'en/']) {
      const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
      const errors = [], url = 'http://127.0.0.1:8765/' + locale;
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => route.request().url() === url
        ? route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(__dirname, '..', locale, 'index.html')) })
        : route.abort());
      await page.goto(url);
      assert.deepEqual(errors, [], 'Editor initialization must complete without errors');
      await page.waitForFunction(() => J.ui.plan !== null);
      await page.locator('#modePro').click();
      for (const layer of ['foreground', 'media']) {
        await page.locator(layer === 'foreground' ? '#sourceForeground' : '#sourceMedia').click();
        await page.locator('#mediaFiles').setInputFiles({ name: 'circle.svg', mimeType: 'image/svg+xml',
          buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><circle cx="80" cy="45" r="30" fill="cyan"/></svg>') });
        await page.waitForFunction(layer => J.ui.plan[layer].cuts[0]?.placement, layer);
      }
      for (const layer of ['foreground', 'media']) {
        const other = layer === 'foreground' ? 'media' : 'foreground';
        const untouched = await page.evaluate(other => JSON.stringify(J.ui.project[other].effects), other);
        await page.locator(`[data-tab="${layer}Fx"]`).click();
        const panel = page.locator(`#${layer}EffectsPanel`);
        const min = panel.locator('[data-media-size="min"]'), max = panel.locator('[data-media-size="max"]');
        const widthBefore = await page.evaluate(layer => J.ui.plan[layer].cuts[0].placement.w, layer);
        await min.scrollIntoViewIfNeeded();
        const bounds = await min.boundingBox();
        await page.mouse.move(bounds.x + 7 + (bounds.width - 14) * .15, bounds.y + bounds.height / 2);
        await page.mouse.down();
        await page.mouse.move(bounds.x + 7 + (bounds.width - 14) * .4, bounds.y + bounds.height / 2, { steps: 8 });
        await page.mouse.up();
        const value = +(await min.inputValue());
        assert.ok(value > 125, 'Dragging the minimum thumb must change the range');
        assert.equal(await max.inputValue(), String(value), 'Crossing the maximum must move both bounds');
        assert.equal(await panel.locator('[data-media-size-value="min"]').textContent(), `${value}%`);
        assert.equal(await panel.locator('[data-media-size-value="max"]').textContent(), `${value}%`);
        await page.waitForFunction(({ layer, value }) => J.ui.plan[layer].cuts[0].effectSettings.sizeMin === value, { layer, value });
        assert.ok(await page.evaluate(({ layer, widthBefore }) => J.ui.plan[layer].cuts[0].placement.w > widthBefore, { layer, widthBefore }), 'The preview plan must use the new size');
        await max.focus(); await max.press('Home');
        await page.waitForFunction(layer => J.ui.plan[layer].cuts[0].effectSettings.sizeMax === 0, layer);
        assert.equal(await min.inputValue(), '0');
        assert.equal(await panel.locator('[data-media-size-value="max"]').textContent(), '0%');
        await panel.locator('[data-media-setting="autoPlacement"]').uncheck();
        assert.equal(await panel.locator('[data-media-size-range]').isVisible(), false);
        await panel.locator('[data-media-setting="autoPlacement"]').check();
        assert.equal(await min.inputValue(), '0', 'Rebuilding the panel must preserve the range');
        assert.equal(await page.evaluate(other => JSON.stringify(J.ui.project[other].effects), other), untouched, 'Settings must stay local to their layer');
      }
      assert.deepEqual(errors, [], 'Slider operations must not throw');
      await page.close();
      console.log(`${locale || 'ja/'} media size slider: passed`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
