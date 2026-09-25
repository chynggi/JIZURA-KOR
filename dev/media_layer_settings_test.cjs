const {chromium} = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({headless:true, executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  try {
    for (const locale of ['', 'en/']) {
      const page = await browser.newPage({viewport:{width:1500,height:1000}}), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://127.0.0.1:8765/' + locale);
      await page.locator('#modePro').click();
      for (const layer of ['foreground','media']) {
        await page.locator(layer === 'media' ? '#sourceMedia' : '#sourceForeground').click();
        await page.locator('#mediaFiles').setInputFiles(['cyan','coral','gold'].map(color => ({
          name:color + '.svg', mimeType:'image/svg+xml',
          buffer:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><circle cx="80" cy="45" r="35" fill="${color}"/></svg>`),
        })));
        await page.waitForFunction(layer => J.ui.project[layer].items.length === 3 && J.ui.plan[layer].cuts.length === 3, layer);
      }
      // Import a real old-format project with shared settings and automatic cuts.
      const legacy = await page.evaluate(() => {
        const p = structuredClone(J.ui.project); p.lyrics = '';
        p.mediaEffects = {motion:.65,treatment:.4,duration:.6,autoPlacement:false,enabled:Object.fromEntries(Object.keys(J.MEDIA_TECH).map(key => [key,key === 'iris']))};
        for (const layer of ['foreground','media']) {
          delete p[layer].effects;
          Object.assign(p[layer], {loop:true,cutCount:6,randomOrder:true,cutOverrides:Object.fromEntries(Array.from({length:6},(_,i) => [i,{technique:null}]))});
        }
        return p;
      });
      await page.locator('#fileProject').setInputFiles({name:'shared.jizura.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
      await page.waitForFunction(() => J.ui.plan.foreground.cuts.length === 6);
      const snapshot = layer => page.evaluate(layer => ({project:J.ui.project[layer],cuts:J.ui.plan[layer].cuts}), layer);
      for (const layer of ['foreground','media']) {
        const initial = await snapshot(layer);
        assert.deepEqual(initial.project.effects, legacy.mediaEffects, 'old shared values must survive migration');
        assert.ok(initial.cuts.every(c => c.technique === 'iris' && c.placement === null));
        assert.ok(initial.cuts.every(c => JSON.stringify(c.effectSettings) === JSON.stringify(legacy.mediaEffects)));
      }
      assert.equal(await page.evaluate(() => J.ui.project.foreground.effects.enabled === J.ui.project.media.effects.enabled), false);
      assert.equal(await page.evaluate(() => Object.hasOwn(J.ui.project, 'mediaEffects')), false);

      for (const layer of ['foreground','media']) {
        const other = layer === 'foreground' ? 'media' : 'foreground', untouched = await snapshot(other);
        const tab = page.locator(`[data-tab="${layer}Fx"]`), panel = page.locator(`#${layer}EffectsPanel`);
        await tab.click();
        assert.equal(await tab.innerText(), layer === 'foreground' ? (locale ? 'Foreground' : '前景') : (locale ? 'Background' : '背景'));
        assert.equal(await panel.isVisible(), true);
        assert.equal(await page.locator(`#${other}EffectsPanel`).isVisible(), false);
        assert.equal(await panel.locator('[data-media-tech]').count(), 80);
        const values = layer === 'foreground' ? {motion:1.6,treatment:.8,duration:.25} : {motion:.3,treatment:.1,duration:1.2};
        for (const [key,value] of Object.entries(values)) {
          await panel.locator(`[data-media-setting="${key}"]`).evaluate((el,value) => {el.value = value; el.dispatchEvent(new Event('input',{bubbles:true}));}, String(value));
          await page.waitForFunction(({layer,key,value}) => J.ui.plan[layer].cuts.every(c => c.effectSettings[key] === value), {layer,key,value});
        }
        await panel.locator('[data-media-setting="autoPlacement"]').check();
        assert.ok((await snapshot(layer)).cuts.every(c => c.placementMode === 'auto'));
        assert.deepEqual(await snapshot(other), untouched, 'sliders and automatic placement must stay local to the tab');

        await panel.locator('[data-media-action="disable"]').click();
        assert.ok((await snapshot(layer)).cuts.every(c => c.technique === 'none'));
        const technique = layer === 'foreground' ? 'pixelScatter' : 'pushIn';
        await panel.locator(`[data-media-tech="${technique}"]`).check();
        assert.ok((await snapshot(layer)).cuts.every(c => c.technique === technique));
        await page.locator('#btnUndo').click();
        assert.ok((await snapshot(layer)).cuts.every(c => c.technique === 'none'));
        assert.equal(await panel.locator(`[data-media-tech="${technique}"]`).isChecked(), false);
        await page.locator('#btnRedo').click();
        assert.ok((await snapshot(layer)).cuts.every(c => c.technique === technique));
        await panel.locator('[data-media-action="enable"]').click();
        assert.equal(await panel.locator('[data-media-tech]:checked').count(), 80);
        assert.deepEqual(await snapshot(other), untouched, 'enable/disable and undo must stay local to the tab');
        await page.locator('#btnUndo').click();

        const beforeShuffle = await snapshot(layer);
        await panel.locator('[data-media-action="shuffle"]').click();
        const afterShuffle = await snapshot(layer);
        assert.notDeepEqual(afterShuffle.cuts.map(c => c.placement), beforeShuffle.cuts.map(c => c.placement));
        assert.deepEqual(afterShuffle.project.effects, beforeShuffle.project.effects);
        assert.deepEqual(await snapshot(other), untouched, 'tab shuffle must not change the other layer or its material order');
      }
      const beforeGlobal = {foreground:await snapshot('foreground'),media:await snapshot('media')};
      await page.locator('#btnShuffle').click();
      for (const layer of ['foreground','media']) {
        assert.notDeepEqual((await snapshot(layer)).cuts.map(c => c.seed), beforeGlobal[layer].cuts.map(c => c.seed));
        assert.deepEqual((await snapshot(layer)).project.effects, beforeGlobal[layer].project.effects);
      }
      const saved = {foreground:await snapshot('foreground'),media:await snapshot('media')};
      const downloadReady = page.waitForEvent('download');
      await page.locator('#btnSave').click();
      const download = await downloadReady, chunks = [];
      for await (const chunk of await download.createReadStream()) chunks.push(chunk);
      const json = Buffer.concat(chunks);
      assert.deepEqual(JSON.parse(json).foreground.effects, saved.foreground.project.effects);
      assert.deepEqual(JSON.parse(json).media.effects, saved.media.project.effects);
      await page.reload();
      await page.waitForFunction(() => J.mediaAssets.size === 6);
      for (const layer of ['foreground','media']) assert.deepEqual(await snapshot(layer), saved[layer], 'autosave reload must preserve each layer');
      await page.locator('#fileProject').setInputFiles({name:'split.jizura.json',mimeType:'application/json',buffer:json});
      await page.waitForFunction(() => document.querySelector('#fileProject').value === '');
      for (const layer of ['foreground','media']) assert.deepEqual(await snapshot(layer), saved[layer], 'saved JSON must preserve each layer');
      await page.locator('[data-tab="foregroundFx"]').click();
      await page.screenshot({path:`../media-layer-settings-${locale ? 'en' : 'ja'}.png`,fullPage:true});
      assert.deepEqual(errors, []);
      console.log(locale || 'ja', 'independent media settings, legacy import, shuffle, undo, save/reload: OK');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => {console.error(e);process.exit(1);});
