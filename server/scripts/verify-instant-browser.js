// Deterministic browser acceptance for program-owned incline diagrams. No saved AI output.
import assert from 'node:assert/strict';
import { createDrawingHarness, generate, inclineQuestion, unsupportedQuestion, mappedQuestion } from './helpers/drawing-browser.js';
const harness = await createDrawingHarness(process.env.INSTANT_BROWSER_OUTPUT || 'artifacts/instant-browser');
const q = inclineQuestion;
const newerQuestion = '一个物块静止在左高右低的粗糙斜面上，不受其他外力。请画出物块的受力示意图，只表示方向。';

async function checkLayout(page) {
  const layout = await page.evaluate(() => {
    const svg = document.querySelector('#instantCanvas svg'), r = svg.getBoundingClientRect(), v = svg.viewBox.baseVal;
    const labels = [...svg.querySelectorAll('.instant-force-label')].map(n => {
      const b = n.getBBox(); return { text: n.textContent, box: [b.x,b.y,b.x+b.width,b.y+b.height], size: +n.getAttribute('font-size') * r.width / v.width };
    });
    const segments = [...svg.querySelectorAll('.instant-objects line')].map(n => [[+n.getAttribute('x1'),+n.getAttribute('y1')],[+n.getAttribute('x2'),+n.getAttribute('y2')]]);
    const collisions = labels.some((l,i) => labels.some((o,j) => i !== j && MasterLabInstantRenderer.boxesOverlap(l.box,o.box))
      || segments.some(([a,b]) => MasterLabInstantRenderer.segmentHitsBox(a,b,l.box)));
    return { height: r.height, labels, collisions, clipped: labels.some(l => l.box[0]<v.x || l.box[1]<v.y || l.box[2]>v.x+v.width || l.box[3]>v.y+v.height),
      overflow: document.documentElement.scrollWidth>innerWidth+1, unsafe: svg.querySelectorAll('script,foreignObject,image,a,use,[onload],[onclick]').length };
  });
  assert.deepEqual(layout.labels.map(l=>l.text), ['G','FN','f']);
  assert(layout.labels.every(l=>l.size>=15.8&&l.size<=16.2));
  assert(layout.height<=320.1); assert.equal(layout.collisions,false); assert.equal(layout.clipped,false);
  assert.equal(layout.overflow,false); assert.equal(layout.unsafe,0);
  return layout;
}

try {
  await harness.run('strict-template-no-ai', async ({ page, row }) => {
    await generate(page, '一辆汽车以 20m/s 的速度行驶，紧急刹车后加速度大小为 5m/s²，求刹车距离。');
    assert.equal(await page.evaluate(() => state.physicsTemplate), 'brake');
    assert.deepEqual([row.mapping,row.tutor], [0,0]);
    assert.equal(await page.locator('#instantExperiment').isVisible(),false);
  });
  await harness.run('diagram-return-zoom-favorites-and-tutor', async ({ page, row }) => {
    await generate(page, mappedQuestion);
    const original = await page.evaluate(() => MasterLabAIHost.getContext());
    const favorites = await page.evaluate(() => localStorage.getItem('master-lab-favorites-v1'));
    await generate(page, q); await page.waitForSelector('#instantCanvas svg');
    assert.equal(await page.evaluate(() => MasterLabAIHost.getContext().originalQuestion),q);
    assert.equal(await page.locator('#promptFavoriteButton').isDisabled(),true);
    await checkLayout(page);
    await page.locator('#instantExpand').click();
    assert.equal(await page.locator('#instantZoom').evaluate(e=>e.open),true);
    const before = await page.locator('#instantZoomCanvas svg').boundingBox();
    await page.locator('#instantZoomRange').evaluate(e=>{e.value='200';e.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const after = await page.locator('#instantZoomCanvas svg').boundingBox(); assert(after.width>before.width*1.5);
    await page.locator('#instantZoomClose').click();
    await page.locator('#instantAsk').click();
    await page.waitForFunction(() => document.body.classList.contains('ai-tutor-route') && document.querySelector('#aiTutorStopButton').disabled);
    assert.equal(row.tutor,1); assert.equal(row.lastChat.context.originalQuestion,q);
    await page.locator('#aiTutorBackButton').click(); await page.waitForSelector('#instantExperiment:visible');
    assert.equal(await page.evaluate(() => MasterLabInstant.getContext().originalQuestion),q);
    await page.locator('#instantBack').click();
    const restored = await page.evaluate(() => MasterLabAIHost.getContext());
    assert.deepEqual(restored.parameters,original.parameters); assert.equal(restored.originalQuestion,original.originalQuestion);
    assert.equal(await page.locator('#promptFavoriteButton').isDisabled(),false);
    assert.equal(await page.evaluate(() => localStorage.getItem('master-lab-favorites-v1')),favorites);
  }, { mapping: 'mapped', width: 390 });
  for (const personal of [false,true]) await harness.run('local-repeat-and-subject-reset-'+personal, async ({ page,row }) => {
    await generate(page,q); await page.waitForSelector('#instantCanvas svg');
    assert.match(await page.locator('#instantCanvas svg').textContent(),/重力/);
    await generate(page,q); await page.waitForSelector('#instantCanvas svg');
    assert.equal(row.mapping,2); assert.equal(row.tutor,0);
    assert.equal(await page.evaluate(() => MasterLabInstant.getContext().originalQuestion),q);
    await page.locator('.subject-tab[data-subject="化学"]').click();
    assert.equal(await page.locator('#instantExperiment').isVisible(),false);
    assert.equal(await page.evaluate(() => MasterLabInstant.getContext()),null);
    assert.equal(await page.locator('#promptFavoriteButton').isDisabled(),false);
  }, { personal });
  await harness.run('unsupported-question-text-without-stale-panel', async ({ page,row }) => {
    await generate(page,unsupportedQuestion);
    assert.equal(row.tutor,1); await page.locator('#aiTutorBackButton').click();
    assert.equal(await page.locator('#instantExperiment').isVisible(),false);
    assert.equal(await page.locator('#instantCanvas svg').count(),0);
    assert.match(await page.locator('#parseFeedback').textContent(),/仅支持.*粗糙斜面/);
  });
  // The local engine is synchronous. Exercise the real async generate boundary in
  // one task, before its await continuation, instead of inventing a provider hang.
  await harness.run('cancel-and-newer-request-win', async ({ page,row }) => {
    const cancelled = await page.evaluate(async q => {
      const pending = MasterLabInstant.generate(q);
      document.querySelector('#instantCancel').click(); return pending;
    },q);
    assert.equal(cancelled.mode,'cancelled');
    assert.equal(await page.locator('#instantExperiment').isVisible(),false);
    assert.equal(await page.evaluate(() => MasterLabInstant.getContext()),null);
    const results = await page.evaluate(async ({q,newerQuestion}) => {
      const old = MasterLabInstant.generate(q), latest = MasterLabInstant.generate(newerQuestion);
      return Promise.all([old,latest]);
    },{q,newerQuestion});
    assert.deepEqual(results.map(r=>r.mode),['cancelled','instant']);
    assert.equal(await page.evaluate(() => MasterLabInstant.getContext().originalQuestion),newerQuestion);
    assert.equal(await page.locator('#instantExperiment').getAttribute('aria-busy'),'false');
    assert.deepEqual([row.mapping,row.tutor],[0,0]);
  });
  await harness.run('pre-aborted-input-and-renderer-safety', async ({ page,row }) => {
    const result = await page.evaluate(async q => {
      const controller = new AbortController(); controller.abort();
      let abort; try { await MasterLabInstant.createScene(q,{signal:controller.signal}); } catch(e) { abort=e.name; }
      const valid = await MasterLabInstant.createScene(q);
      const mutations = [s=>{s.objects[0].onload='window.__unsafeScene=1';},s=>{s.objects[0].type='foreignObject';},s=>{s.labels[0].text='<svg onload="window.__unsafeScene=1">';},s=>{s.objects[0].href='https://evil.invalid/pixel';}];
      const rejected = mutations.map(mutate => {
        const raw=JSON.parse(JSON.stringify(valid.scene)); mutate(raw);
        const host=document.createElement('div'); document.body.append(host);
        try { MasterLabInstantRenderer.draw(host,raw,q); return false; }
        catch { return host.childNodes.length===0; } finally { host.remove(); }
      });
      return {abort,rejected,executed:!!window.__unsafeScene};
    },q);
    assert.equal(result.abort,'AbortError'); assert.deepEqual(result.rejected,[true,true,true,true]);
    assert.equal(result.executed,false); assert.deepEqual([row.mapping,row.tutor],[0,0]);
  });
  await harness.run('local-engine-failure-releases-panel', async ({page,row})=>{
    const result=await page.evaluate(q=>{
      window.MasterLabInclineDiagram={...MasterLabInclineDiagram,createCompetitionScene(){throw new Error('FIXTURE_ENGINE_FAILURE');}};
      return MasterLabInstant.generate(q);
    },q);
    assert.equal(result.mode,'explanation');assert.equal(result.code,'FIXTURE_ENGINE_FAILURE');
    assert.equal(await page.locator('#instantExperiment').isVisible(),false);
    assert.equal(await page.locator('#instantExperiment').getAttribute('aria-busy'),'false');
    assert.equal(await page.locator('#instantCanvas svg').count(),0);
    assert.equal(await page.evaluate(()=>MasterLabInstant.getContext()),null);
    assert.deepEqual([row.mapping,row.tutor],[0,0]);
  });
  for(const width of [390,768,1366,1920]) await harness.run('responsive-'+width, async ({page,row})=>{
    await generate(page,q); await page.waitForSelector('#instantCanvas svg'); row.layout=await checkLayout(page);
    assert.equal(row.mapping,1); assert.equal(row.tutor,0);
  },{width});
  await harness.run('demo-preset-still-works',async({page,row})=>{
    await page.waitForFunction(()=>MasterLabAIHost.getContext().mode==='experiment');
    assert.deepEqual([row.mapping,row.tutor],[0,0]);
  },{search:'?demo=1'});
} finally { await harness.close(); }
