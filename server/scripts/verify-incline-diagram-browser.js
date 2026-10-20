// Local-only integration checks. Every nonlocal request is intercepted; credentials are fixtures.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
const phase = process.argv.includes('--guard-only') ? 1 : process.argv.includes('--competition') ? 4 : process.argv.includes('--render') ? 3 : 2;
const output = process.env.DIAGRAM_QA_OUTPUT || resolve(root, `artifacts/incline-competition-2026-10-20/step${phase}-browser`);
const bank = JSON.parse(await readFile(resolve(root, 'server/eval/tutor-diagram-bank.json'), 'utf8'));
await mkdir(output, { recursive: true });
const web = resolve(root, 'web'), mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' };
const server = createServer(async (req, res) => {
  const file = resolve(web, decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1) || 'index.html');
  if (!file.startsWith(web + sep)) { res.writeHead(400); res.end(); return; }
  try { res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }); res.end(await readFile(file)); }
  catch { res.writeHead(404); res.end(); }
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const report = { phase, root, cases: [] };
const legacyFixture = q => ({ version: 1, status: 'scene', subject: '物理', title: '斜面受力图', givens: [q], basis: ['静摩擦力阻碍下滑趋势。'], assumptions: [], explanation: ['重力向下，支持力向左上，静摩擦力向右上。'], objects: [
  { id: 'surface', type: 'line', role: 'surface', from: [80, 330], to: [520, 220] },
  { id: 'body', type: 'polygon', role: 'body', color: 'ink', fill: 'pale', points: [[240, 290], [320, 270], [308.8, 225.4], [228.8, 245.4]] },
  { id: 'gravity', type: 'arrow', role: 'gravity', color: 'orange', from: [274, 258], to: [274, 320] },
  { id: 'normal_force', type: 'arrow', role: 'normal_force', color: 'blue', from: [274, 258], to: [257, 190] },
  { id: 'friction', type: 'arrow', role: 'friction', color: 'teal', from: [274, 258], to: [342, 241] }
], labels: [{ target: 'surface', text: '粗糙斜面' }, { target: 'body', text: '物块' }, { target: 'gravity', text: '重力 G' }, { target: 'normal_force', text: '支持力 N' }, { target: 'friction', text: '静摩擦力 f' }], relations: [], calculations: [] });
const reply = { mode: 'explain', summary: '题目条件不属于本次图示范围，保留文字分析。', steps: [], formulas: [], finalAnswer: null, warnings: [], suggestedQuestions: [] };
async function run(name, width, personal, action) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, reducedMotion: 'reduce' });
  await context.addInitScript(({ base, personal }) => { window.MASTER_LAB_API_URL = base; if (personal) localStorage.setItem('masterLab.deepseekApiKey', 'fixture-only-never-valid'); }, { base, personal });
  const page = await context.newPage(), row = { name, width, personal, coordinateRequests: 0, chatRequests: 0, errors: [] };
  page.on('pageerror', e => row.errors.push(e.message));
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()), json = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.pathname === '/health') return json({ ok: true, aiConfigured: true });
    if (url.pathname === '/api/v1/scene/generate' || url.pathname === '/chat/completions') {
      const body = req.postDataJSON(), coordinate = url.pathname.includes('/scene/') || body.messages?.[0]?.content.includes('科学可视化设计师');
      if (coordinate) { row.coordinateRequests++; const scene = legacyFixture(bank[0].q); return json(url.pathname.includes('/scene/') ? { mode: 'instant', scene } : { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(scene) } }] }); }
      row.chatRequests++; return json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(reply) } }] });
    }
    if (url.pathname === '/api/v1/tutor/chat') { row.chatRequests++; return json(reply); }
    if (url.origin !== base) return route.fulfill({ status: 503, body: 'External network blocked by test' });
    return route.continue();
  });
  try {
    await page.goto(base + '/#/ai-tutor'); await page.waitForFunction(() => window.MasterLabInstant && window.MasterLabAITutor);
    await action(page, row);
    assert.deepEqual(row.errors, []); row.pass = true; console.log('PASS ' + name);
  } catch (error) { row.pass = false; row.failure = error.stack; process.exitCode = 1; console.error('FAIL ' + name + ': ' + error.message); }
  finally { await page.screenshot({ path: resolve(output, name + '.png'), fullPage: true }); report.cases.push(row); await context.close(); }
}
async function send(page, q) {
  await page.locator('#aiTutorInput').fill(q); await page.locator('#aiTutorSendButton').click();
  await page.waitForFunction(() => document.querySelector('#aiTutorWorkspace').getAttribute('aria-busy') === 'false');
}
async function verifyFigure(page) {
  const measured = await page.evaluate(() => {
    const svg = document.querySelector('.ai-diagram-canvas svg');
    if (!svg) return { missing: true };
    const content = svg.querySelector('.instant-content'), b = content.getBBox(), v = svg.viewBox.baseVal, r = svg.getBoundingClientRect();
    const scale = r.width / v.width;
    const labels = [...svg.querySelectorAll('.instant-force-label')].map(node => {
      const b = node.getBBox(), force = svg.querySelector('[data-object-id="' + node.dataset.labelTarget + '"]');
      return { text: node.textContent, box: [b.x,b.y,b.x+b.width,b.y+b.height], size: +node.getAttribute('font-size') * scale,
        color: node.getAttribute('fill'), forceColor: force.getAttribute('stroke') };
    });
    const segments = [...svg.querySelectorAll('.instant-objects line, .instant-wedge polygon')].flatMap(node => {
      if (node.tagName === 'line') return [[[+node.getAttribute('x1'),+node.getAttribute('y1')],[+node.getAttribute('x2'),+node.getAttribute('y2')]]];
      const p = [...node.points].map(p=>[p.x,p.y]); return p.map((a,i)=>[a,p[(i+1)%p.length]]);
    });
    const body = svg.querySelector('[data-object-id="body"] polygon'), p = [...body.points].map(p=>[p.x,p.y]);
    segments.push(...p.map((a,i)=>[a,p[(i+1)%p.length]]));
    const collisions = labels.some((l,i)=>labels.some((o,j)=>i!==j&&MasterLabInstantRenderer.boxesOverlap(l.box,o.box,2/scale))
      ||segments.some(([a,b])=>MasterLabInstantRenderer.segmentHitsBox(a,b,l.box,2/scale)));
    const sub = svg.querySelector('.instant-force-subscript');
    return { labels, scale, width:r.width, height:r.height, collisions,
      margins:[b.x-v.x,b.y-v.y,v.x+v.width-b.x-b.width,v.y+v.height-b.y-b.height].map(n=>n*scale),
      legend:svg.querySelectorAll('.instant-legend,.instant-pin,.instant-legend-right').length,
      mobileLegend:document.querySelectorAll('.ai-diagram-canvas .instant-mobile-legend').length,
      wedge:svg.querySelector('.instant-wedge polygon').points.numberOfItems,
      hatches:svg.querySelectorAll('.instant-rough-hatching line').length,
      rightAngle:svg.querySelector('.instant-right-angle')?.points.numberOfItems,
      subscript:+sub.getAttribute('font-size')*scale,
      canvasBackground:getComputedStyle(svg.parentElement).backgroundColor,
      overflow:document.documentElement.scrollWidth>innerWidth+1 };
  });
  assert.equal(measured.missing,undefined,'renderer must keep a complete diagram');
  assert.equal(measured.height<=320.1,true); assert.equal(measured.overflow,false);
  assert.equal(measured.collisions,false,'direct labels must avoid each other and line segments');
  assert.equal(measured.labels.length,3); assert.deepEqual(measured.labels.map(x=>x.text),['G','FN','f']);
  for(const l of measured.labels){ assert(l.size>=15.8&&l.size<=16.2,'force letter must remain 16 screen px'); assert.equal(l.color,l.forceColor); }
  assert(measured.subscript>=11.8&&measured.subscript<=12.2);
  assert(measured.margins.every(n=>n>=27&&n<=29),'measured content must have 28 screen px margins');
  assert.equal(measured.legend,0); assert.equal(measured.mobileLegend,0); assert.equal(measured.wedge,3);
  assert(measured.hatches>=10); assert.equal(measured.rightAngle,3); assert.equal(measured.canvasBackground,'rgba(0, 0, 0, 0)');
  return measured;
}
try {
  for (const width of [1366, 820, 390]) await run('original-' + width, width, false, async (page, row) => {
    await send(page, bank[0].q);
    assert.equal(await page.locator('.ai-diagram-canvas svg').count(), 1);
    assert.equal(row.coordinateRequests, phase === 1 ? 1 : 0); assert.equal(row.chatRequests, 0);
    const geometry = await page.evaluate(() => {
      const svg = document.querySelector('.ai-diagram-canvas svg');
      const arrow = id => { const line = svg.querySelector(`[data-object-id="${id}"] line`); return { from: [+line.getAttribute('x1'), +line.getAttribute('y1')], to: [+line.getAttribute('x2'), +line.getAttribute('y2')] }; };
      return { forces: ['gravity', 'normal_force', 'friction'].map(arrow), overflow: document.documentElement.scrollWidth > innerWidth + 1,
        viewBox: svg.getAttribute('viewBox'), legacyLegend: svg.querySelectorAll('.instant-legend-right').length };
    });
    assert.equal(geometry.overflow, false);
    for (const force of geometry.forces) assert.deepEqual(force.from, geometry.forces[0].from);
    if (phase >= 2) { const lengths = geometry.forces.map(f => Math.hypot(f.to[0] - f.from[0], f.to[1] - f.from[1])); assert(lengths.every(n => Math.abs(n - lengths[0]) < 1e-8)); }
    row.geometry = geometry;
    if (phase >= 3) row.layout = await verifyFigure(page);
    await page.locator('.ai-diagram').screenshot({ path: resolve(output, 'figure-' + width + '.png') });
    await page.reload(); await page.waitForSelector('.ai-diagram-canvas svg');
    assert.equal(row.coordinateRequests, phase === 1 ? 1 : 0, 'restoration must not call a scene provider');
  });
  if (phase >= 3) {
    for (const id of ['static-left','uniform-down-right','uniform-down-left']) await run('mobile-'+id,390,false,async (page,row)=>{
      await send(page,bank.find(r=>r.id===id).q); row.layout=await verifyFigure(page);
    });
    await run('responsive-resize',1366,false,async (page,row)=>{
      await send(page,bank[0].q); await verifyFigure(page);
      await page.setViewportSize({width:390,height:844}); await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      row.layout=await verifyFigure(page); await page.setViewportSize({width:820,height:900});
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))); await verifyFigure(page);
    });
  }
  await run('personal-original', 1366, true, async (page, row) => {
    await send(page, bank[0].q); assert.equal(await page.locator('.ai-diagram-canvas svg').count(), 1);
    assert.equal(row.coordinateRequests, phase === 1 ? 1 : 0); assert.equal(row.chatRequests, 0);
  });
  await run('unsupported-bank-no-coordinate-requests', 820, false, async (page, row) => {
    for (const q of bank.filter(r => r.expect === 'text').map(r => r.q)) {
      const result = await page.evaluate(q => window.MasterLabInstant.createScene(q), q);
      assert.equal(result.mode, 'explanation', q); assert.equal(result.code, 'DECLINED', q);
    }
    assert.equal(row.coordinateRequests, 0); assert.equal(row.chatRequests, 0);
    await send(page, bank.find(r => r.id === 'smooth-static').q);
    assert.equal(await page.locator('.ai-diagram-canvas svg').count(), 0); assert.equal(row.chatRequests, 1);
    assert.match(await page.locator('.ai-message.assistant').innerText(), /文字|光滑/);
  });
  if (phase >= 2) await run('legacy-scene-rebuilt-locally', 820, false, async (page, row) => {
    await send(page, bank[0].q);
    const old = await page.evaluate(scene => {
      const data = JSON.parse(localStorage.getItem('masterLab.tutorSessions.v1'));
      const message = data.sessions.flatMap(s => s.messages).find(m => m.scene);
      message.scene = scene;
      return data;
    }, legacyFixture(bank[0].q));
    await page.addInitScript(data => localStorage.setItem('masterLab.tutorSessions.v1', JSON.stringify(data)), old);
    await page.reload(); await page.waitForSelector('.ai-diagram-canvas svg');
    const rebuilt = await page.evaluate(q => {
      const expected = MasterLabInclineDiagram.createScene(q).scene.objects.filter(o => o.type === 'arrow');
      return expected.every(o => {
        const line = document.querySelector('[data-object-id="' + o.id + '"] line');
        return line && ['x1', 'y1', 'x2', 'y2'].every((a, i) => Math.abs(+line.getAttribute(a) - [...o.from, ...o.to][i]) < 1e-8);
      });
    }, bank[0].q);
    assert.equal(rebuilt, true, 'old valid AI coordinates must be replaced with program geometry');
    assert.equal(row.coordinateRequests, 0); assert.equal(row.chatRequests, 0);
  });
  await run('supported-session-and-tampering', 820, false, async (page, row) => {
    await send(page, bank[0].q);
    const tampered = await page.evaluate(() => { const data = JSON.parse(localStorage.getItem('masterLab.tutorSessions.v1')); const message = data.sessions.flatMap(s => s.messages).find(m => m.scene); message.scene.objects.find(o => o.role === 'friction').to = [206, 275]; return data; });
    await page.addInitScript(data => localStorage.setItem('masterLab.tutorSessions.v1', JSON.stringify(data)), tampered);
    await page.reload(); await page.waitForFunction(() => document.querySelector('.ai-message.assistant'));
    assert.equal(await page.locator('.ai-diagram-canvas svg').count(), 0, 'tampered saved scene must become text');
    assert.equal(row.coordinateRequests, phase === 1 ? 1 : 0);
  });
} finally { await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n'); await browser.close(); server.close(); }
