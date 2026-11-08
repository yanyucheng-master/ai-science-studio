// All resources and transports are isolated and intercepted.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const web = resolve(root, 'web');
const output = process.env.PROTOCOL_QA_OUTPUT || resolve(root, 'artifacts/photosynthesis-learning');
const report = { sourceSha: process.env.PROTOCOL_SOURCE_SHA || 'working-tree', cases: [], errors: [], api: [] };
await mkdir(output, { recursive: true });
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/health') { res.setHeader('Content-Type','application/json'); res.end('{"ok":true}'); return; }
  const file = resolve(web, path.slice(1) || 'index.html');
  if (!file.startsWith(web + sep)) { res.writeHead(400); res.end(); return; }
  try {
    const mime = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png' };
    res.writeHead(200, {'Content-Type':mime[extname(file)] || 'application/octet-stream'});
    res.end(await readFile(file));
  } catch { res.end(); }
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge', headless:true, ignoreDefaultArgs:['--disable-back-forward-cache']});
report.browser = browser.version();
const widthList = (process.env.LEARNING_WIDTHS || '1366,820,390,360,844').split(',').map(Number);

async function context(width) {
  const c = await browser.newContext({viewport:{width,height:width===844?390:950}, hasTouch:width<=844, isMobile:width<=844, reducedMotion:'reduce'});
  await c.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/')) {
      report.api.push({path:url.pathname,method:route.request().method()});
      return route.fulfill({status:503,body:''});
    }
    return url.origin === base ? route.continue() : route.fulfill({status:204,body:''});
  });
  await c.addInitScript(origin => {
    window.MASTER_LAB_API_URL = origin;
    window.learningLinks = [];
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>window.learningLinks.push(value)}});
  }, base);
  c.on('page', p => p.on('pageerror', error => report.errors.push(error.message)));
  return c;
}
const scene = id => id === 'photosynthesis' ? '.biology-photosynthesis-scene' : '.biology-leaf-disks-scene';
const left = id => id === 'photosynthesis' ? '[data-photosynthesis-step]' : '[data-leaf-step]';
const field = (p, name) => p.locator('[data-learning="'+name+'"]');
async function generate(p, question) {
  await p.locator('#questionInput').fill(question);
  await p.locator('#generateButton').click();
  await p.waitForFunction(q => state.generatedQuestion===q && !document.querySelector('#generationOverlay.show'), question);
  await p.waitForTimeout(150); // The app focuses the experiment after generation.
}
async function atStep(p, id, step) {
  const observed = await p.evaluate(selector => ({
    scene:Number(document.querySelector(selector).dataset.step),
    reasoning:Number(document.querySelector('.reason-step[aria-current="step"]')?.dataset.step),
    progress:Number(document.querySelector('#reasonProgress').textContent),
    total:Number(document.querySelector('#reasonTotal').textContent),
    time:state.time / duration(),
    playing:state.playing,
    dots:document.querySelectorAll('.um-rail-dot').length,
  }), scene(id));
  assert.deepEqual([observed.scene, observed.reasoning, observed.progress, observed.total],[step,step,step,6]);
  if (observed.dots) assert.equal(observed.dots,6);
  return observed;
}

try {
  for (const width of widthList) {
    const c = await context(width), p = await c.newPage();
    await p.goto(base);
    await p.waitForFunction(() => typeof planLocalExperiment === 'function');
    const ids = await p.evaluate(() => ['photosynthesis','leafDisks'].filter(id=>MASTER_LAB_TEMPLATES[id]));
    assert.ok(ids.length);
    for (const id of ids) {
      const high = id === 'leafDisks';
      const q = await p.evaluate(id => {
        const t = MASTER_LAB_TEMPLATES[id], a=t.presetFor(t.level);
        return t.question(a.p1,a.p2,a.fixed);
      }, id);
      await generate(p,q);
      const row = { id, width, left:[], right:[] };
      for (const step of [1,2,3,4,5,6]) {
        await p.locator(left(id)).nth(step-1).click();
        const result=await atStep(p,id,step);
        assert.equal(result.playing,false);
        assert.ok(Math.abs(result.time-(step-1)/6)<1e-8);
        row.left.push(step);
      }
      for (const step of [6,5,4,3,2,1]) {
        await p.locator('.reason-step[data-step="'+step+'"]').click();
        const result=await atStep(p,id,step);
        assert.equal(result.playing,false);
        assert.ok(Math.abs(result.time-(step-1)/6)<1e-8);
        row.right.push(step);
      }
      await p.locator('#timeline').fill('16');
      await p.locator('#playButton').click();
      await p.waitForFunction(() => state.playing && state.reasonStep===2);
      await atStep(p,id,2);
      await p.locator('.reason-step[data-step="5"]').click();
      assert.equal((await atStep(p,id,5)).playing,false);
      row.playing=await atStep(p,id,5);
      await p.locator('#resetButton').click();
      await atStep(p,id,1);
      assert.equal(await field(p,'predict0').isEnabled(),true);
      if (high) {
        assert.equal(await field(p,'observed0').inputValue(),'');
        assert.equal(await field(p,'observed0').isEnabled(),false);
        for (const [i,value] of ['3','3','9'].entries()) await field(p,'predict'+i).fill(value);
      } else {
        await field(p,'predict0').selectOption('plain');
        await field(p,'predict1').selectOption('blue');
      }
      await p.locator(left(id)).nth(5).click();
      assert.equal(await field(p,'predict0').isEnabled(),false);
      const comparison=p.locator('[data-comparison]');
      if (high) {
        for (const invalid of ['11','2.5','-1']) {
          await field(p,'observed0').fill(invalid);
          assert.match(await comparison.textContent(), /0–10 的整数/);
        }
        for (const [i,value] of ['0','10','10'].entries()) await field(p,'observed'+i).fill(value);
        assert.match(await comparison.textContent(),/数据来源/);
        await field(p,'source').selectOption('practice');
        await field(p,'minutes').fill('0');
        assert.match(await comparison.textContent(),/大于 0/);
        await field(p,'minutes').fill('1.5');
        assert.match(await comparison.textContent(),/可比/);
        await field(p,'comparable').check();
        assert.match(await comparison.textContent(), /假设练习.*强光 0 片.*中光、弱光记录并列最高/);
        await field(p,'source').selectOption('class');
        assert.match(await comparison.textContent(),/网页未经实测核验/);
        assert.deepEqual(await p.evaluate(()=>MasterLabLeafDisks.frame(1).observedCounts),[null,null,null]);
        await field(p,'reason').selectOption('rate');
        assert.match(await p.locator('[data-explanation-result]').textContent(),/不能直接换算/);
      } else {
        assert.match(await comparison.textContent(),/先完成/);
        await p.locator('#timeline').fill('96');
        assert.match(await comparison.textContent(),/我的预测：原见光区不变蓝，原遮光区变蓝。教材预期：原见光区变蓝，原遮光区不变蓝/);
        await field(p,'variable').selectOption('leaf');
        await field(p,'reason').selectOption('color');
        assert.match(await p.locator('[data-explanation-result]').textContent(),/酒精用于脱色/);
        await field(p,'variable').selectOption('correct');
      }
      await field(p,'reason').selectOption('correct');
      assert.match(await p.locator('[data-explanation-result]').textContent(),/判断正确/);
      row.comparison=await comparison.textContent();
      row.explanation=await p.locator('[data-explanation-result]').textContent();
      assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
      if (width === 390) {
        await p.locator('.photo-learning').last().screenshot({path:resolve(output,id+'-comparison-390.png')});
        await p.locator('#fullscreenButton').click();
        await field(p,'reason').scrollIntoViewIfNeeded();
        assert.equal(await field(p,'reason').isVisible(),true);
        assert.equal(await field(p,'predict0').inputValue(),high?'3':'plain');
        await p.locator('#fullscreenButton').click();
        await p.locator('#questionInput').fill(q+' 求总产氧量。');
        await p.locator('#generateButton').click();
        await p.locator('#parseFeedback.error.show').waitFor();
        assert.equal(await comparison.textContent(),row.comparison);
        await p.locator('#questionInput').fill(q);
        await p.locator('#favoriteButton').click();
        assert.equal(await field(p,'predict0').inputValue(),high?'3':'plain');
        const saved = await p.evaluate(() => localStorage.getItem('master-lab-favorites-v1') || '');
        assert.ok(JSON.parse(saved).some(record => record.question===q));
        assert.doesNotMatch(saved,/predict|observed|comparable/);
        await p.locator('#shareButton').click();
        const link = await p.evaluate(() => learningLinks.at(-1));
        assert.ok(link);
        const other=await context(width), imported=await other.newPage();
        await imported.goto(link);
        await imported.waitForFunction(id => state.hasGenerated && activeGenericId()===id,id);
        assert.equal(await field(imported,'predict0').inputValue(),'');
        if (high) assert.equal(await field(imported,'observed0').inputValue(),'');
        await other.close();
        await p.locator('#favoriteList .favorite-item').first().click();
        await generate(p,q);
        assert.equal(await field(p,'predict0').inputValue(),'');
        await p.reload();
        await p.waitForFunction(() => typeof planLocalExperiment === 'function');
        await generate(p,q);
        assert.equal(await field(p,'predict0').inputValue(),'');
        row.lifecycle=['全屏与失败新题保留当前草稿','收藏保留当前草稿','分享独立打开为空','从收藏重新生成清空','刷新后为空'];
      }
      await p.locator('#resetButton').click();
      assert.equal(await field(p,'predict0').inputValue(),'');
      assert.equal(await field(p,'predict0').isEnabled(),true);
      if (high) assert.equal(await field(p,'observed0').inputValue(),'');
      report.cases.push(row);
      console.log(id,width,'PASS');
    }
    await c.close();
  }
  assert.deepEqual(report.errors,[]);
  assert.deepEqual(report.api,[]);
} catch (error) {
  report.failure=error.stack;
  console.error(error);
  process.exitCode=1;
} finally {
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));
  await browser.close();
  server.close();
}
