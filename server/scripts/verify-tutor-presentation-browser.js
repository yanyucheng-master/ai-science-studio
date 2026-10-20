// Isolated browser QA: fixture credentials only; every external request is blocked.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url)), web = resolve(root, 'web');
const alwaysThinking = (await readFile(resolve(web,'ai-tutor.js'),'utf8')).includes('thinking: { type: "enabled" }');
const output = process.env.TUTOR_PRESENTATION_OUTPUT || resolve(root, 'artifacts/tutor-presentation-qa');
const bank = JSON.parse(await readFile(resolve(root, 'server/eval/tutor-acceptance-bank.json'), 'utf8'));
const liveFixtures = process.env.TUTOR_LIVE_FIXTURES ? JSON.parse(await readFile(process.env.TUTOR_LIVE_FIXTURES, 'utf8')).cases.filter(row=>row.status===200&&row.protocolAccepted) : [];
await mkdir(output, { recursive: true });
const sentinel = 'PRIVATE_REASONING_SENTINEL';
const reply = { mode: 'steps', summary: '', steps: [
  '分析：物块受重力、支持力和静摩擦力。重力竖直向下，支持力垂直斜面指向外侧，静摩擦力沿斜面向上。',
  String.raw`列式：\(G=mg\)，平衡时 \(N=mg\cos\theta\)，\(f=mg\sin\theta\)。`,
  String.raw`代入：\(G=2\times10=20\,\mathrm{N}\)，\(N=20\cos30^\circ=10\sqrt{3}\,\mathrm{N}\)，\(f=20\sin30^\circ=10\,\mathrm{N}\)。`,
  '结论：重力20 N、支持力约17.3 N、静摩擦力10 N，方向如上所述。'],
  formulas: ['G=mg', String.raw`N=mg\cos\theta`, String.raw`f=mg\sin\theta`],
  finalAnswer: '重力20 N、支持力约17.3 N、静摩擦力10 N，方向如上所述。', checks: ['内部核验'], warnings: [], followUp: '',
  suggestedQuestions: ['支持力为什么垂直于斜面？', '质量加倍后各力的大小怎样变化？'] };
let fixtureMode = 'answer', calls = [], activeReply = reply;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' };
const frame = (delta, finish_reason = null) => `data: ${JSON.stringify({ choices: [{ delta, finish_reason }] })}\n\n`;
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/fixture/chat/completions') {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    calls.push({ thinking: body.thinking, model: body.model, stream: body.stream });
    if (body.stream) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.flushHeaders();
      res.write(frame({ reasoning_content: sentinel }));
      if (fixtureMode === 'stop') return;
      setTimeout(() => { if (!res.destroyed) res.end(frame({ content: JSON.stringify(activeReply) }, 'stop') + 'data: [DONE]\n\n'); }, 150);
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(activeReply), reasoning_content: sentinel } }] }));
    }
    return;
  }
  if (url.pathname === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true,"aiConfigured":true}'); return; }
  const file = resolve(web, decodeURIComponent(url.pathname).slice(1) || 'index.html');
  if (!file.startsWith(web + sep)) { res.writeHead(400); res.end(); return; }
  try {
    let content = await readFile(file);
    if (file.endsWith('ai-tutor.js')) content = Buffer.from(content.toString().replace('const DEEPSEEK_BASE_URL = "https://api.deepseek.com";', 'const DEEPSEEK_BASE_URL = window.location.origin + "/fixture";'));
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }); res.end(content);
  } catch { res.writeHead(404); res.end(); }
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`, report = { root, mockOnly: true, cases: [] };
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
async function run(name, width, action, { personal = true, search = '' } = {}) {
  fixtureMode = 'answer'; activeReply = reply; calls = [];
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 960 }, reducedMotion: 'reduce' });
  await context.addInitScript(({ base, personal }) => {
    window.MASTER_LAB_API_URL = base;
    if (personal) localStorage.setItem('masterLab.deepseekApiKey', 'fixture-only-never-valid');
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.qaCopied = text; } } });
  }, { base, personal });
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  const page = await context.newPage(), row = { name, width, errors: [] };
  page.on('pageerror', error => row.errors.push(error.message));
  try {
    await page.goto(base + '/' + search + '#/ai-tutor');
    await page.waitForFunction(() => window.MasterLabAITutor && window.MasterLabInclineDiagram);
    await action(page, row);
    assert.deepEqual(row.errors, []);
    row.pass = true; console.log('PASS ' + name);
  } catch (error) { row.pass = false; row.failure = error.stack; process.exitCode = 1; console.error('FAIL ' + name + ': ' + error.message); }
  finally { row.calls = calls; await page.screenshot({ path: resolve(output, name + '.png'), fullPage: true }); report.cases.push(row); await context.close(); }
}
async function send(page, q) {
  await page.locator('#aiTutorInput').fill(q); await page.locator('#aiTutorSendButton').click();
  await page.waitForFunction(() => document.querySelector('#aiTutorWorkspace').getAttribute('aria-busy') === 'false');
}
async function measure(page) {
  return page.evaluate(() => {
    const visible = node => node.getClientRects().length > 0;
    const overflows = [...document.querySelectorAll('.ai-message-bubble, .ai-tutor-header, .ai-composer-input')].filter(visible)
      .filter(n => n.scrollWidth > n.clientWidth + 2).map(n => n.className);
    const formulas = [...document.querySelectorAll('.ai-formula-line')].map(n => ({ border: getComputedStyle(n).borderTopWidth, background: getComputedStyle(n).backgroundColor }));
    return { overflow: document.documentElement.scrollWidth > innerWidth + 1, overflows, formulas,
      traces: document.querySelectorAll('.ai-thinking-trace, .ai-thinking-trace-text, .ai-reasoning-block, .ai-reasoning-toggle').length,
      text: document.querySelector('#aiTutorMessages').innerText,
      bubbleBorder: getComputedStyle(document.querySelector('.ai-message.assistant .ai-message-bubble')).borderTopWidth,
      scrollBorder: getComputedStyle(document.querySelector('#aiTutorMessages')).borderTopWidth,
      header: document.querySelector('.ai-tutor-header').getBoundingClientRect().toJSON() };
  });
}
async function diagram(page, expected) {
  const data = await page.evaluate(() => {
    const svg = document.querySelector('.ai-diagram-canvas svg'), R = window.MasterLabInstantRenderer;
    if (!svg) return { missing: true };
    const v = svg.viewBox.baseVal, rect = svg.getBoundingClientRect(), scale = rect.width / v.width;
    const labels = [...svg.querySelectorAll('.instant-force-label, .instant-data-label')].map(node => {
      const b = node.getBBox(); return { text: node.textContent, quote: node.dataset.sourceQuote, data: node.classList.contains('instant-data-label'), box: [b.x,b.y,b.x+b.width,b.y+b.height], size: +node.getAttribute('font-size')*scale };
    });
    const solids = [...svg.querySelectorAll('.instant-wedge polygon, [data-object-id="body"] polygon')].map(node => [...node.points].map(p => [p.x,p.y]));
    const segments = [...svg.querySelectorAll('.instant-objects line')].map(n => [[+n.getAttribute('x1'),+n.getAttribute('y1')],[+n.getAttribute('x2'),+n.getAttribute('y2')]]);
    const collisions = labels.some((l,i) => labels.some((o,j) => i!==j&&R.boxesOverlap(l.box,o.box,2/scale)) || segments.some(([a,b]) => R.segmentHitsBox(a,b,l.box,2/scale)) || (l.data&&solids.some(p=>R.boxHitsPolygon(l.box,p,2/scale))));
    return { labels, collisions, height: rect.height,
      clipped: labels.some(l=>l.box[0]<v.x||l.box[1]<v.y||l.box[2]>v.x+v.width||l.box[3]>v.y+v.height),
      overflow: document.documentElement.scrollWidth>innerWidth+1 };
  });
  assert.equal(data.missing, undefined); assert.equal(data.collisions, false); assert.equal(data.clipped, false); assert.equal(data.overflow, false); assert(data.height <= 320.1);
  assert.deepEqual(data.labels.filter(l=>l.data).map(l=>l.text), expected.labels);
  for (const label of data.labels.filter(l=>l.data)) { assert(expected.q.includes(label.quote)); assert(label.size >= 12); }
  return data;
}
try {
  if (!process.argv.includes('--replay-only')) {
  for (const width of [1366,820,390]) {
    for (const row of bank.filter(r=>r.expect==='draw')) await run(row.id+'-'+width,width,async(page,result)=>{
      await send(page,row.q); result.diagram=await diagram(page,row); assert.equal(calls.length,0,'drawing remains deterministic');
      assert.equal(await page.locator('.ai-reasoning-toggle').count(),0);
      await page.locator('.ai-diagram').screenshot({ path: resolve(output,row.id+'-'+width+'-figure.png') });
    });
    await run('full-answer-'+width,width,async(page,result)=>{
      await page.locator('#aiTutorResponseMode').selectOption('steps');
      await send(page,'一个质量为2 kg的物块静止在倾角30°的粗糙斜面上，不受其他外力，取g=10 N/kg。请完整解答三个力的大小与方向。');
      result.ui=await measure(page); assert.equal(result.ui.traces,0); assert.doesNotMatch(result.ui.text,new RegExp(sentinel+'|已思考|思维链|内部核验'));
      assert.equal(result.ui.bubbleBorder,'0px'); assert.equal(result.ui.scrollBorder,'0px'); assert.equal(result.ui.overflow,false); assert.deepEqual(result.ui.overflows,[]);
      assert.equal(result.ui.formulas.length,0,'relations already appear in the steps');
      await page.screenshot({path:resolve(output,'full-answer-'+width+'-clean.png'),fullPage:true});
      await page.locator('.ai-copy-answer').click(); const copied=await page.evaluate(()=>window.qaCopied); assert.match(copied,/17.3/); assert.doesNotMatch(copied,/PRIVATE_REASONING|内部核验/);
      await page.locator('#aiTutorMore summary').click(); assert(await page.locator('#aiTutorHistoryButton').isVisible()); await page.keyboard.press('Escape');
      assert.equal(await page.locator('#aiTutorMore').evaluate(n=>n.open),false); assert.equal(new URL(page.url()).hash,'#/ai-tutor');
      await page.locator('#aiTutorMore summary').click(); await page.locator('#aiTutorInput').click(); assert.equal(await page.locator('#aiTutorMore').evaluate(n=>n.open),false);
      await page.locator('#aiTutorMore summary').click(); await page.locator('#aiTutorHistoryButton').click(); assert(await page.locator('#aiTutorHistoryPanel').isVisible()); await page.keyboard.press('Escape');
      await page.locator('#aiTutorMore summary').click(); const download=page.waitForEvent('download'); await page.locator('#aiTutorExportButton').click(); assert.match((await download).suggestedFilename(),/大师实验室.*\.md$/);
      const count=calls.length; await page.locator('.ai-suggested-question').first().click(); assert.match(await page.locator('#aiTutorInput').inputValue(),/支持力/); assert.equal(calls.length,count);
      await page.locator('#aiTutorInput').fill('');
    });
  }
  await run('stop-retry',390,async(page,row)=>{
    fixtureMode='stop'; await page.locator('#aiTutorResponseMode').selectOption('steps');
    await page.locator('#aiTutorInput').fill('请完整解释这道题的计算。'); await page.locator('#aiTutorSendButton').click();
    await page.waitForFunction(()=>document.querySelector('.ai-thinking-stage'));
    row.pending=await page.evaluate(()=>({ traces:document.querySelectorAll('.ai-thinking-trace-text,.ai-reasoning-toggle').length,text:document.querySelector('#aiTutorMessages').innerText }));
    assert.equal(row.pending.traces,0); assert.doesNotMatch(row.pending.text,new RegExp(sentinel));
    await page.locator('#aiTutorStopButton').click(); await page.waitForFunction(()=>document.querySelector('#aiTutorWorkspace').getAttribute('aria-busy')==='false');
    assert.match(await page.locator('#aiTutorMessages').innerText(),/已停止/); fixtureMode='answer';
    await page.locator('#aiTutorRetryButton').click(); await page.waitForFunction(()=>document.querySelector('#aiTutorWorkspace').getAttribute('aria-busy')==='false');
    assert.match(await page.locator('#aiTutorMessages').innerText(),/17.3/);
  });
  await run('hint-and-window-controls',820,async(page,row)=>{
    activeReply={mode:'hint',summary:'先判断重力沿斜面的分量指向哪里。',steps:[],formulas:[],finalAnswer:null,warnings:[],suggestedQuestions:[]};
    await page.locator('#aiTutorResponseMode').selectOption('hint'); await send(page,'请给一个受力分析的提示，不要给完整答案。');
    assert.equal(await page.locator('.ai-final-step').count(),0); assert.equal(calls[0].thinking.type,alwaysThinking?'enabled':'disabled','preserve the branch-specific thinking policy');
    await page.locator('#aiTutorMore summary').click(); await page.locator('#aiTutorFloatButton').click(); assert(await page.locator('#aiTutorWorkspace').evaluate(n=>n.classList.contains('is-floating')));
    await page.locator('#aiTutorMore summary').click(); await page.locator('#aiTutorPageButton').click(); assert.equal(new URL(page.url()).hash,'#/ai-tutor');
    await page.locator('#aiTutorNewButton').click(); assert.equal(await page.locator('.ai-message').count(),0);
    await page.locator('#aiTutorMore summary').click(); await page.locator('#aiTutorHistoryButton').click();
    const saved=page.locator('.ai-session-open').filter({hasText:'请给一个受力分析的提示'}); await saved.click();
    assert.equal(await page.locator('.ai-hint-card').count(),1); assert.equal(await page.locator('.ai-reasoning-toggle,.ai-thinking-trace-text').count(),0);
  });
  await run('diagram-switch',390,async(page,row)=>{
    await page.locator('#aiTutorResponseMode').selectOption('steps'); await send(page,bank[0].q);
    assert.equal(await page.locator('.ai-diagram').count(),0); assert.equal(calls.length,1); assert.match(await page.locator('#aiTutorMessages').innerText(),/17.3/);
  },{search:'?diagram=0'});
  for (const width of [1366,820,390]) await run('additional-formula-'+width,width,async(page,row)=>{
    activeReply={...reply,steps:['分析：质量和倾角确定后，根据垂直斜面的平衡条件求支持力。','结论：支持力垂直于斜面，指向斜面外侧。'],formulas:[String.raw`N=mg\cos\theta`],finalAnswer:'支持力垂直于斜面，指向斜面外侧。',suggestedQuestions:[]};
    await page.locator('#aiTutorResponseMode').selectOption('steps'); await send(page,'请完整说明斜面支持力的一般关系，不代入数值。');
    row.ui=await measure(page); assert.equal(row.ui.formulas.length,1); assert(row.ui.formulas.every(f=>f.border==='0px'&&f.background==='rgba(0, 0, 0, 0)'));
    assert.equal(row.ui.overflow,false); assert.deepEqual(row.ui.overflows,[]);
  });
  }
  for(const fixture of liveFixtures)for(const width of [1366,820,390])await run('live-replay-'+fixture.id+'-'+width,width,async(page,row)=>{
    activeReply=fixture.response; await page.locator('#aiTutorResponseMode').selectOption('steps'); await send(page,fixture.q);
    row.realAiReplay=fixture.id;row.ui=await measure(page);assert.equal(row.ui.traces,0);assert.equal(row.ui.overflow,false);assert.deepEqual(row.ui.overflows,[]);
    assert.doesNotMatch(row.ui.text,/PRIVATE_REASONING|已思考|思维链/);
    assert(row.ui.formulas.every(f=>f.border==='0px'&&f.background==='rgba(0, 0, 0, 0)'));
    await page.locator('#aiTutorInput').blur();
  });
} finally {
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));
  await browser.close(); server.closeAllConnections(); server.close();
}
console.log(`${report.cases.filter(c=>c.pass).length}/${report.cases.length} passed`);
