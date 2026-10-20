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
const phase = process.argv.includes('--guard-only') ? 1 : 2;
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
    if (phase === 2) { const lengths = geometry.forces.map(f => Math.hypot(f.to[0] - f.from[0], f.to[1] - f.from[1])); assert(lengths.every(n => Math.abs(n - lengths[0]) < 1e-8)); }
    row.geometry = geometry;
    await page.locator('.ai-diagram').screenshot({ path: resolve(output, 'figure-' + width + '.png') });
    await page.reload(); await page.waitForSelector('.ai-diagram-canvas svg');
    assert.equal(row.coordinateRequests, phase === 1 ? 1 : 0, 'restoration must not call a scene provider');
  });
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
  await run('supported-session-and-tampering', 820, false, async (page, row) => {
    await send(page, bank[0].q);
    const tampered = await page.evaluate(() => { const data = JSON.parse(localStorage.getItem('masterLab.tutorSessions.v1')); const message = data.sessions.flatMap(s => s.messages).find(m => m.scene); message.scene.objects.find(o => o.role === 'friction').to = [206, 275]; return data; });
    await page.addInitScript(data => localStorage.setItem('masterLab.tutorSessions.v1', JSON.stringify(data)), tampered);
    await page.reload(); await page.waitForFunction(() => document.querySelector('.ai-message.assistant'));
    assert.equal(await page.locator('.ai-diagram-canvas svg').count(), 0, 'tampered saved scene must become text');
    assert.equal(row.coordinateRequests, phase === 1 ? 1 : 0);
  });
} finally { await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n'); await browser.close(); server.close(); }
