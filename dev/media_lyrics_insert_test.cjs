const {chromium} = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  try {
    for (const locale of ['', 'en/']) {
      const page = await browser.newPage({viewport:{width:1500,height:1000}}), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://127.0.0.1:8765/' + locale);
      await page.locator('#modePro').click();
      const insert = page.locator('#btnMediaFromLyrics');
      assert.equal(await insert.isVisible(), false, 'lyrics tab must not show the media action');
      for (const layer of ['foreground','media']) {
        await page.locator(layer === 'media' ? '#sourceMedia' : '#sourceForeground').click();
        assert.equal(await insert.isDisabled(), true, 'files are required');
        await page.locator('#mediaFiles').setInputFiles(['circle','square'].map((name,i) => ({
          name:name + '.svg',mimeType:'image/svg+xml',
          buffer:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90">${i ? '<rect x="45" y="10" width="70" height="70" fill="coral"/>' : '<circle cx="80" cy="45" r="35" fill="cyan"/>'}</svg>`),
        })));
        await page.waitForFunction(layer => J.ui.project[layer].items.length === 2, layer);
      }
      const fixture = await page.evaluate(() => {
        const p = structuredClone(J.ui.project);
        p.lyrics = '[00:01.125]夜明けの空/遠くへ続く\n[00:04.250]風が吹く/声を運ぶ\n[00:08.375]白い雲/空に浮かぶ\n[00:12.500]街を抜け/海へ向かう\n[00:16.625]波の音/今日も響く';
        p.title = 'Title card'; p.fps = 30;
        p.lyricBlankCuts = [{id:'blank-test',beforeLine:2,start:7}];
        p.fx.density = 1;
        return p;
      });
      await page.locator('#fileProject').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
      await page.waitForFunction(() => J.ui.plan.lines.length === 5);
      assert.equal(await page.evaluate(() => J.ui.plan.cuts.some(c => c.part === 1) && J.ui.plan.cuts.some(c => c.blank) && J.ui.plan.cuts.some(c => c.line === -1)), true);
      const project = () => page.evaluate(() => structuredClone(J.ui.project));

      for (const layer of ['foreground','media']) {
        await page.locator(layer === 'media' ? '#sourceMedia' : '#sourceForeground').click();
        assert.equal(await insert.innerText(), locale ? 'Insert cuts aligned to lyrics' : '歌詞に合わせて一括挿入');
        for (const loop of [false,true]) for (const random of [false,true]) {
          await page.locator('#mediaLoop').setChecked(loop);
          await page.locator('#mediaRandom').setChecked(random);
          await page.locator('#mediaLineList .media-technique').first().selectOption('iris');
          await page.locator('#mediaLineList .lock').first().click();
          const before = await project();
          await insert.click();
          const after = await project();
          const report = await page.evaluate(layer => {
            const p = J.ui.project, cuts = J.ui.plan[layer].cuts;
            const heads = J.ui.plan.cuts.filter(c => c.line >= 0 && c.part === 0);
            const order = J.mediaOrder(p, layer);
            return {cuts:cuts.map((c,i) => ({
              start:c.start,lineStart:heads[i].start,id:c.itemId,expectedId:order[i % order.length].id,
              ref:(layer === 'media' ? 'm:' : 'f:') + i,lyricRef:`l:${heads[i].line}:0`,
            })),links:p.timelineLinks};
          }, layer);
          assert.equal(report.cuts.length, loop ? 5 : 2, 'one cut per lyric line, limited by non-looping file count');
          for (const cut of report.cuts) {
            assert.equal(cut.start, cut.lineStart, 'fractional-frame start time must be copied exactly');
            assert.equal(cut.id, cut.expectedId);
            assert.ok(report.links.some(link => link.a === cut.ref && link.b === cut.lyricRef));
          }
          const other = layer === 'media' ? 'foreground' : 'media', prefix = layer === 'media' ? 'm:' : 'f:';
          assert.deepEqual(after[other], before[other], 'the other layer settings must be preserved');
          assert.deepEqual(after.timing, before.timing, 'lyrics timing must stay unchanged');
          const otherLinks = links => links.filter(link => !link.a.startsWith(prefix) && !link.b.startsWith(prefix));
          assert.deepEqual(otherLinks(after.timelineLinks), otherLinks(before.timelineLinks));
          await page.locator('#btnUndo').click();
          assert.deepEqual(await project(), before, 'one Undo restores cuts and links');
          await page.locator('#btnRedo').click();
          assert.deepEqual(await project(), after);
          await insert.click();
          assert.deepEqual(await project(), after, 'repeating the action must not duplicate cuts or links');
        }
      }
      assert.equal(await page.locator('#timelineLinks .link-wire').count(), 10, 'both layers link to five lyric line starts');
      // Drag one background boundary and check the entire three-layer group moves.
      const timing = await page.evaluate(() => ({start:J.ui.plan.media.cuts[1].start,duration:J.ui.plan.duration}));
      const box = await page.locator('#mediaTimeline').boundingBox(), y = box.y + box.height - 8;
      await page.mouse.move(box.x + timing.start / timing.duration * box.width, y);
      await page.mouse.down();
      await page.mouse.move(box.x + (timing.start + .5) / timing.duration * box.width, y, {steps:8});
      await page.mouse.up();
      const starts = await page.evaluate(() => [J.ui.plan.media.cuts[1].start,J.ui.plan.foreground.cuts[1].start,J.ui.plan.lines[1].start]);
      assert.ok(starts[0] > timing.start + .2, 'boundary drag must move');
      assert.equal(starts[0], starts[1]); assert.equal(starts[0], starts[2]);
      // Existing unlink controls and structural edits must work on the new links.
      const linked = await project();
      await page.locator('#timelineLinks .link-remove').first().click();
      assert.equal((await project()).timelineLinks.length, linked.timelineLinks.length - 1);
      await page.locator('#btnUndo').click();
      assert.deepEqual((await project()).timelineLinks, linked.timelineLinks);
      await page.locator('#mediaLineList .media-cut-insert button').first().click();
      assert.ok((await project()).timelineLinks.some(link => link.a === 'm:1' && link.b === 'l:0:0'));
      await page.locator('#btnUndo').click();
      assert.deepEqual(await project(), linked);
      await page.evaluate(() => J.uiApi.flushSave());
      await page.reload();
      await page.waitForFunction(() => J.mediaAssets.size === 4);
      assert.deepEqual(await project(), linked, 'cuts and links must survive reload');
      await page.locator('#sourceMedia').click();
      await page.locator('#mediaLyricInsert').scrollIntoViewIfNeeded();
      await page.screenshot({path:`../media-lyrics-insert-${locale ? 'en' : 'ja'}.png`,fullPage:true});
      await page.locator('#sourceLyrics').click();
      await page.locator('#lyrics').fill('');
      await page.waitForFunction(() => J.ui.plan.lines.length === 0);
      await page.locator('#sourceMedia').click();
      assert.equal(await insert.isDisabled(), true, 'lyrics are required');
      assert.deepEqual(errors, []);
      console.log(locale || 'ja', 'bulk insertion, loop/random order, three-layer links, undo and reload: OK');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => {console.error(e);process.exit(1);});
