/* Local design-preview checks only; this is not the product acceptance suite. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const repo = path.resolve(__dirname, '../../..');
const out = path.resolve(process.env.PREVIEW_OUT || path.join(repo, '../.handoff/pedigree-v2-design-20261128/run'));
fs.mkdirSync(out, { recursive: true });
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.md':'text/plain; charset=utf-8' };
const server = http.createServer((req,res) => {
  const file = path.resolve(repo, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if (!file.startsWith(repo + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(file).pipe(res);
});
let browser;
const report = { scope:'Two review-only textbook previews; no product entry/favorites/share/full regression claims', checks:[], screenshots:[], outbound:[], posts:[], errors:[] };
const note = (label, detail) => report.checks.push({label, result:'pass', detail});
async function snapshot(page, name) {
  const filename = path.join(out, name+'.png');
  await page.screenshot({path:filename,fullPage:false});
  report.screenshots.push({name:path.basename(filename),sha256:crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex')});
}
async function shapeState(page) {
  return page.locator('.gp-glyph').evaluateAll(items=>items.map(e=>({box:[e.getBBox().x,e.getBBox().y,e.getBBox().width,e.getBBox().height],fill:getComputedStyle(e).fill,stroke:getComputedStyle(e).stroke})));
}
(async () => {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true});
  report.browser={version:browser.version(),channel:process.env.BROWSER_CHANNEL || 'msedge',platform:process.platform,node:process.version};
  const context=await browser.newContext({viewport:{width:1366,height:900}});
  context.on('request',r=>{if(r.method()==='POST')report.posts.push(new URL(r.url()).pathname);});
  await context.route('**/*', route=>{
    if(new URL(route.request().url()).origin===origin) return route.continue();
    report.outbound.push(route.request().url()); return route.abort();
  });
  const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(origin+'/docs/genetics-textbook-v2/preview/index.html');
  await page.locator('[data-person="II-3"]').waitFor();
  assert.equal(await page.locator('[data-person]').count(),20);
  assert.equal(await page.locator('[data-person="III-10"]').getAttribute('aria-label'),'Ⅲ–10，女性，表型正常');
  assert.equal(await page.locator('[data-person="III-11"]').getAttribute('aria-label'),'Ⅲ–11，女性，表型正常');
  assert.equal(await page.locator('.gp-glyph.affected').count(),4);
  const fullGraph=await page.locator('#graph-viewport').evaluate(e=>({client:e.clientWidth,scroll:e.scrollWidth}));
  assert.equal(fullGraph.scroll,fullGraph.client,'1366 desktop must show the full family without internal clipping');
  note('p35 complete family','20 members; III-10 and III-11 female; four male affected members');
  await snapshot(page,'p35-desktop-1366');
  const before=await shapeState(page);
  await page.locator('[data-person="II-3"]').click();
  assert.match(await page.locator('#member-info').innerText(),/Ⅰ–1 的女儿/);
  assert.deepEqual(await shapeState(page),before);
  await page.locator('[data-person="III-6"]').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('[data-person="III-6"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-person="II-3"]').focus(); await page.keyboard.press('Space');
  assert.equal(await page.locator('[data-person="II-3"]').getAttribute('aria-pressed'),'true');
  note('selection and keyboard','Click and Enter change only selection outline/info; glyph geometry, fill and stroke remain unchanged');
  for(let i=0;i<4;i++) { await page.locator(`[data-step="${i}"]`).click(); assert.equal(await page.locator('#step-count').innerText(),`${i+1} / 4`); }
  await page.locator('[data-extension="son"]').click(); assert.match(await page.locator('#extension-result').innerText(),/1\/2/);
  await page.locator('[data-extension="boy"]').click(); assert.match(await page.locator('#extension-result').innerText(),/1\/4/);
  await page.locator('#reset').click();
  assert.equal(await page.locator('#step-count').innerText(),'1 / 4');
  assert.equal(await page.locator('[data-person][aria-pressed="true"]').count(),0);
  assert.match(await page.locator('#extension-result').innerText(),/选择一个明确/);
  note('p35 steps and reset','All four actual step buttons, separate conditional/joint questions, reset clears selection and extension');
  await page.locator('[data-case="combined"]').click();
  assert.equal(await page.locator('[data-person]').count(),3);
  await page.evaluate(()=>scrollTo(0,0)); await snapshot(page,'p38-desktop-1366');
  const bothBefore=await shapeState(page);
  await page.locator('[data-person="I-2"]').click();
  assert.deepEqual(await shapeState(page),bothBefore);
  for(let i=0;i<4;i++) { await page.locator(`[data-step="${i}"]`).click(); assert.equal(await page.locator('#step-count').innerText(),`${i+1} / 4`); }
  for (const [key,value] of [['neither','9/16'],['albino','3/16'],['colorblind','3/16'],['both','1/16'],['boy-both','1/8']]) {
    await page.locator(`[data-extension="${key}"]`).click(); assert.match(await page.locator('#extension-result').innerText(),new RegExp(value));
  }
  const normalCells=await page.locator('#step-content td').allTextContents();
  assert.equal(normalCells.filter(s=>s.trim()).length,6);
  note('p38 original vs extensions','Three people only, pattern+dot dual mark, six normal genotypes, five separately selected probability extensions');
  for(const width of [360,390,820,1366,844]) {
    await page.setViewportSize({width,height:width===844?390:900});
    for(const name of ['color','combined']) {
      await page.locator(`[data-case="${name}"]`).click();
      const layout=await page.evaluate(()=>({width:innerWidth,body:document.documentElement.scrollWidth,hits:[...document.querySelectorAll('.gp-hit')].map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))}));
      assert.ok(layout.body<=layout.width,`${name} ${width}: page overflow ${JSON.stringify(layout)}`);
      assert.ok(layout.hits.every(e=>e.w>=44&&e.h>=44),`${name} ${width}: touch target too small`);
      await page.locator('#reset').click();
      if(width===390) { await page.evaluate(()=>scrollTo(0,0)); await snapshot(page,name==='color'?'p35-mobile-390':'p38-mobile-390'); }
    }
  }
  note('responsive geometry','360/390/820/1366 and 844×390: no document horizontal overflow; every member hit target ≥44 CSS px; p35 uses internal pan');
  // One short actual interaction recording; no time-lapse or generated animation.
  if(process.env.RECORD_PREVIEW==='1') {
    const videoContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,recordVideo:{dir:out,size:{width:390,height:844}}});
    videoContext.on('request',r=>{if(r.method()==='POST')report.posts.push(new URL(r.url()).pathname);});
    await videoContext.route('**/*',r=>{
      if(new URL(r.request().url()).origin===origin)return r.continue();
      report.outbound.push(r.request().url());return r.abort();
    });
    const vp=await videoContext.newPage();
    vp.on('pageerror',e=>report.errors.push(e.message));
    await vp.goto(origin+'/docs/genetics-textbook-v2/preview/index.html');
    const pause=()=>vp.waitForTimeout(1600);
    await pause(); await vp.locator('[data-person="II-3"]').click(); await pause();
    await vp.locator('#reason-title').scrollIntoViewIfNeeded();
    for(let i=0;i<4;i++){
      await vp.locator(`[data-step="${i}"]`).click();await pause();
      if(i===1){await vp.locator('[data-person="II-3"]').scrollIntoViewIfNeeded();await pause();}
    }
    await vp.locator('[data-case="combined"]').click(); await vp.evaluate(()=>scrollTo(0,0)); await pause();
    await vp.locator('[data-person="I-2"]').click(); await pause();
    await vp.locator('#reason-title').scrollIntoViewIfNeeded();
    for(let i=0;i<4;i++){
      await vp.locator(`[data-step="${i}"]`).click();await pause();
      if(i===1){await vp.locator('[data-person="I-2"]').scrollIntoViewIfNeeded();await pause();}
    }
    await vp.locator('[data-extension="boy-both"]').click(); await pause();
    await vp.locator('#reset').click(); await vp.evaluate(()=>scrollTo(0,0)); await pause();
    const video=vp.video(); await videoContext.close();
    const raw=await video.path(); const target=path.join(out,'textbook-walkthrough-390.webm');fs.renameSync(raw,target);
    report.recording={name:path.basename(target),sha256:crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')};
    note('touch-context recording','Actual step/case/member/reset buttons in a clean 390×844 Chromium-engine context; no AI requests');
  }
  assert.deepEqual(report.outbound,[]); assert.deepEqual(report.posts,[]); assert.deepEqual(report.errors,[]);
  note('network and runtime','0 outbound requests, 0 page errors; the preview contains no AI/API/storage integration');
  report.result='pass'; await context.close();
})().catch(e=>{report.result='fail';report.failure=e.stack;process.exitCode=1;}).finally(async()=>{
  if(browser) await browser.close(); server.close();
  fs.writeFileSync(path.join(out,'preview-report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({result:report.result,checks:report.checks.length,report:path.join(out,'preview-report.json'),failure:report.failure}));
});
