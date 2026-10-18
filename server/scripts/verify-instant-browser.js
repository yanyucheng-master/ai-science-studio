// Real Chromium/Edge UI acceptance. Replays saved live responses; never reads credentials.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import { createMasterLabServer, RateLimiter } from '../src/server.js';
import { InstantSceneService } from '../src/instant-scene-service.js';
import Scene from '../../web/instant-scene.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = resolve(root, process.env.INSTANT_BROWSER_OUTPUT || 'artifacts/instant-engine-2026-10-18/browser');
const liveDir = resolve(root, process.env.INSTANT_LIVE_DIR || 'artifacts/instant-engine-2026-10-18/live-final');
await mkdir(output, { recursive: true });
const bank = JSON.parse(await readFile(new URL('../eval/instant-scene-bank.json', import.meta.url), 'utf8'));
const q = '画两条互相垂直的线段，仅用来说明垂直关系，不求长度或角度数值。';
function fixture(question = q) {
  return { version: 1, status: 'scene', subject: '数学', title: '两线的垂直关系', givens: [question], basis: ['两线相交成直角。'], assumptions: ['图形仅作示意，不按比例。'], explanation: ['两条线段互相垂直。'], objects: [{ id: 'a', type: 'line', from: [100, 240], to: [460, 240] }, { id: 'b', type: 'line', from: [280, 80], to: [280, 380], color: 'teal' }], labels: [{ target: 'a', text: '线段 a' }, { target: 'b', text: '线段 b' }], relations: [{ type: 'perpendicular', objects: ['a', 'b'] }], calculations: [] };
}
let mode = 'ok', calls = 0, tutorCalls = 0, latest = null;
const provider = { configured: true, async generate(question, { signal }) {
  calls++;
  if (mode === 'hang') await new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('ABORTED')), { once: true }));
  if (mode === 'slow') await new Promise(resolve => setTimeout(resolve, 250));
  if (mode === 'error') throw new Error('AI_UNAVAILABLE');
  if (mode === 'decline') return { raw: { version: 1, status: 'declined', reason: '缺少确定空间关系的条件。' } };
  const raw = mode === 'live' ? latest : fixture(question);
  if (mode === 'malicious') raw.objects[0].onload = 'window.__unsafeScene=1';
  return { raw, model: 'fixture' };
} };
const service = new InstantSceneService({ provider, timeoutMs: 90000 });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const web = createServer(async (req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1) || 'index.html';
  if (name.includes('..') || name.includes('\\')) { res.writeHead(400); res.end(); return; }
  try { const data = await readFile(resolve(root, 'web', name)); res.writeHead(200, { 'Content-Type': mime[extname(name)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data); }
  catch { res.writeHead(404); res.end(); }
});
web.listen(0, '127.0.0.1'); await once(web, 'listening');
const base = `http://127.0.0.1:${web.address().port}`;
const gateway = createMasterLabServer({ instantSceneService: service, allowedOrigins: [base], rateLimiter: new RateLimiter(300, 600000), deepSeekClient: { configured: true, async chat() { tutorCalls++; return { mode: 'explain', summary: '保留原题中的条件，根据题目明确的关系进行分析。缺少关键条件时先补充信息，再判断能否绘图。', steps: [], formulas: [], finalAnswer: null, checks: [], followUp: '可以补充题目中的空间关系。', parameterPatch: null, warnings: [] }; } } });
gateway.listen(0, '127.0.0.1'); await once(gateway, 'listening');
const gatewayBase = `http://127.0.0.1:${gateway.address().port}`;
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const report = { browser: browser.version(), checks: [], consoleErrors: [], bank: [], viewports: [] };
let currentContext;
async function pageAt(width = 1366, suffix = '') {
  if (currentContext) await currentContext.close();
  currentContext = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
  await currentContext.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.fulfill({ status: 204, body: '' }));
  const page = await currentContext.newPage();
  page.on('pageerror', error => report.consoleErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  await page.addInitScript(url => { window.MASTER_LAB_API_URL = url; }, gatewayBase);
  await page.goto(base + suffix);
  await page.waitForFunction(() => window.MasterLabInstant && window.MasterLabAITutor);
  return page;
}
const mark = name => { report.checks.push(name); console.log(`PASS ${name}`); };
async function generate(page, question = q) {
  await page.locator('#questionInput').fill(question);
  await page.locator('#generateButton').click();
  await page.waitForFunction(() => !document.querySelector('#generateButton').classList.contains('loading'), null, { timeout: 10000 });
}
async function checkLayout(page) {
  const layout = await page.evaluate(() => {
    const svg = document.querySelector('#instantCanvas svg'), box = svg.getBoundingClientRect();
    const labels = [...svg.querySelectorAll('.instant-label')].map(n => { const b = n.getBoundingClientRect(); return { text: n.getAttribute('aria-label') || n.textContent, x: b.x - box.x, y: b.y - box.y, width: b.width, height: b.height }; });
    const pins = [...svg.querySelectorAll('.instant-pin')].map(n => [Number(n.getAttribute('cx')), Number(n.getAttribute('cy'))]);
    const axisText = [...svg.querySelectorAll('.instant-axis-label')].map(n => { const b = n.getBBox(); return { text: n.textContent, x: b.x, y: b.y, width: b.width, height: b.height }; });
    return { width: box.width, height: box.height, compact: document.querySelector('#instantCanvas').classList.contains('is-compact'), nodes: svg.querySelectorAll('*').length, labels, pins, axisText, unsafeNodes: svg.querySelectorAll('script,foreignObject,image,a,use').length };
  });
  assert.equal(layout.unsafeNodes, 0); assert.ok(layout.nodes <= Scene.LIMITS.nodes);
  assert.ok(layout.pins.every(p => p[0] >= 10 && p[0] <= 565 && p[1] >= 10 && p[1] <= 440), 'number bubbles stay within viewBox');
  assert.ok(layout.pins.every((p, i) => layout.pins.slice(i + 1).every(q => Math.hypot(p[0] - q[0], p[1] - q[1]) >= 24)), 'number bubbles do not overlap');
  assert.ok(layout.pins.every(p => layout.axisText.every(b => Math.hypot(p[0] - Math.max(b.x, Math.min(b.x + b.width, p[0])), p[1] - Math.max(b.y, Math.min(b.y + b.height, p[1]))) >= 18)), 'number bubbles leave axis ticks and titles readable, including the mobile radius');
  assert.ok(layout.axisText.every(b => b.x >= 0 && b.y >= 0 && b.x + b.width <= 575 && b.y + b.height <= 450), 'axis text stays within the mobile viewBox');
  assert.ok(layout.axisText.every((b, i) => layout.axisText.slice(i + 1).every(c => b.x + b.width <= c.x || c.x + c.width <= b.x || b.y + b.height <= c.y || c.y + c.height <= b.y)), 'axis ticks do not overlap each other');
  if (!layout.compact) {
    assert.ok(layout.labels.every(b => b.x >= 0 && b.y >= 0 && b.x + b.width <= layout.width + 1 && b.y + b.height <= layout.height + 1), 'legend stays within canvas');
    assert.ok(layout.labels.every((b, i) => i === 0 || b.y >= layout.labels[i - 1].y + layout.labels[i - 1].height), 'legend rows do not overlap');
  }
  return layout;
}
try {
  let page = await pageAt();
  const plans = await page.evaluate(items => items.map(item => ({ id: item.id, local: window.planLocalExperiment(item.q, { subject: '物理', physicsTemplate: 'brake', presetQuestion: '', gradeLevel: 'senior' }).ok })), bank);
  assert.ok(plans.every(p => !p.local), JSON.stringify(plans.filter(p => p.local))); report.bank = plans; mark('all 30 questions are outside strict local templates');
  const before = calls; await generate(page, '一辆汽车以 20m/s 的速度行驶，紧急刹车后加速度大小为 5m/s²，求刹车距离。');
  assert.equal(calls, before); assert.equal(await page.locator('#instantExperiment').isVisible(), false); mark('matched templates make zero scene requests');
  const originalContext = await page.evaluate(() => window.MasterLabAIHost.getContext());
  await generate(page); await page.waitForSelector('#instantCanvas svg');
  assert.equal(await page.evaluate(() => window.MasterLabAIHost.getContext().originalQuestion), q); mark('unknown question renders a safe scene with its own tutor context');
  const savedFavorites = await page.evaluate(() => localStorage.getItem('master-lab-favorites-v1'));
  assert.equal(await page.locator('#promptFavoriteButton').isDisabled(), true);
  await page.locator('#instantExpand').click(); assert.equal(await page.locator('#instantZoom').evaluate(e => e.open), true);
  await page.locator('#instantZoomRange').fill('200'); await page.locator('#instantZoomClose').click(); mark('zoom modal and slider work');
  await page.locator('#instantBack').click();
  const restored = await page.evaluate(() => window.MasterLabAIHost.getContext()); assert.deepEqual(restored.parameters, originalContext.parameters); assert.equal(restored.originalQuestion, originalContext.originalQuestion); mark('return preserves original experiment parameters and question');
  assert.equal(await page.locator('#promptFavoriteButton').isDisabled(), false);
  assert.equal(await page.evaluate(() => localStorage.getItem('master-lab-favorites-v1')), savedFavorites); mark('instant view cannot accidentally favorite the retained experiment');
  await generate(page); const cachedCalls = calls; await generate(page); assert.equal(calls, cachedCalls); mark('identical requests reuse bounded session cache');
  await page.locator('#instantAsk').click(); await page.waitForFunction(() => document.body.classList.contains('ai-tutor-route'));
  await page.waitForFunction(() => document.querySelector('#aiTutorStopButton').disabled && document.querySelector('.ai-message.assistant:not(.pending)'));
  await page.locator('#aiTutorBackButton').click(); await page.waitForSelector('#instantExperiment:visible');
  assert.equal(await page.evaluate(() => window.MasterLabInstant.getContext().originalQuestion), q); mark('tutor round trip retains the instant scene and question');
  await page.locator('.subject-tab[data-subject="化学"]').click();
  assert.equal(await page.locator('#instantExperiment').isVisible(), false); assert.equal(await page.evaluate(() => window.MasterLabInstant.getContext()), null); mark('subject switch clears instant context and restores normal controls');

  page = await pageAt(); let directCalls = 0; const beforeDirect = calls;
  await page.route('https://api.deepseek.com/chat/completions', async route => {
    const req = route.request(), body = req.postDataJSON(); directCalls++;
    assert.equal(req.headers().authorization, 'Bearer fixture-only-never-valid');
    assert.equal(body.model, Scene.DEFAULT_MODEL); assert.equal(body.stream, false); assert.equal(body.max_tokens, Scene.LIMITS.tokens);
    assert.ok(body.messages[0].content.includes('科学可视化设计师'));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(fixture(q)) } }] }) });
  });
  await page.evaluate(() => localStorage.setItem('masterLab.deepseekApiKey', 'fixture-only-never-valid'));
  await generate(page); await page.waitForSelector('#instantCanvas svg'); assert.equal(directCalls, 1); assert.equal(calls, beforeDirect); mark('personal key route calls the provider directly without sending a key or question to the gateway');

  for (const failure of ['malicious', 'decline', 'error']) {
    mode = failure; service.cache.clear(); page = await pageAt(); const initial = tutorCalls;
    await generate(page, q + `（${({ malicious: '安全拦截', decline: '缺少条件', error: '服务故障' })[failure]}测试）`);
    assert.equal(await page.locator('#instantCanvas svg').count(), 0); assert.ok(tutorCalls > initial);
    assert.equal(await page.locator('.ai-message.error').count(), 0);
    assert.equal(await page.evaluate(() => window.__unsafeScene || false), false); mark(`${failure} falls back to the text tutor without a diagram`);
  }
  mode = 'hang'; service.cache.clear(); page = await pageAt();
  await page.locator('#questionInput').fill(q); await page.locator('#generateButton').click(); await page.waitForSelector('#instantCancel:visible');
  const initialTutorCalls = tutorCalls; await page.locator('#instantCancel').click();
  await page.waitForFunction(() => !document.querySelector('#generateButton').classList.contains('loading'));
  assert.equal(tutorCalls, initialTutorCalls); assert.equal(await page.locator('#instantExperiment').isVisible(), false); mark('user cancellation neither draws nor automatically spends on tutor');
  mode = 'slow'; service.cache.clear();
  await page.locator('#questionInput').fill(q + '甲'); await page.locator('#generateButton').click(); await page.waitForSelector('#instantCancel:visible');
  await page.locator('#questionInput').fill(q + '乙'); await page.waitForFunction(() => !document.querySelector('#generateButton').classList.contains('loading'));
  await page.locator('#generateButton').click(); await page.waitForSelector('#instantCanvas svg');
  assert.equal(await page.evaluate(() => window.MasterLabInstant.getContext().originalQuestion), q + '乙'); mark('cancelled older request cannot overwrite a newer question');
  mode = 'hang'; service.cache.clear(); page = await pageAt(); await page.clock.install();
  await page.locator('#questionInput').fill(q); await page.locator('#generateButton').click(); await page.waitForSelector('#instantCancel:visible');
  await page.clock.fastForward(95001); await page.waitForFunction(() => !document.querySelector('#generateButton').classList.contains('loading'));
  assert.equal(await page.locator('#instantCanvas svg').count(), 0); mark('client timeout falls back and releases loading state');

  mode = 'ok'; service.cache.clear(); page = await pageAt();
  const formulaQuestion = '展示化学式H_2O、CO_2、上下标v^2和F_{合}、分式a/b、根式sqrt(x+1)的符号示意，不计算数值。';
  const formula = fixture(formulaQuestion); formula.labels = ['H_2O', 'CO_2', 'v^2', 'F_{合}', 'a/b', 'sqrt(x+1)'].map(text => ({ target: 'a', text }));
  const formulaInfo = await page.evaluate(({ scene, question }) => {
    document.querySelector('#instantExperiment').hidden = false;
    window.MasterLabInstantRenderer.draw(document.querySelector('#instantCanvas'), scene, question);
    return { rules: document.querySelectorAll('#instantCanvas .science-formula-rule').length, scripts: document.querySelectorAll('#instantCanvas text tspan').length, source: [...document.querySelectorAll('#instantCanvas [data-math-source]')].map(n => n.dataset.mathSource) };
  }, { scene: formula, question: formulaQuestion });
  assert.ok(formulaInfo.rules >= 2 && formulaInfo.scripts >= 10); await page.locator('#instantCanvas').screenshot({ path: resolve(output, 'formula-layout.png') }); mark('fractions radicals Chinese subscripts and chemical formulae use real SVG layout');
  const cramped = fixture(); cramped.objects.push({ id: 'cramped', type: 'axes', x: 80, y: 80, width: 30, height: 300, xMin: -10000, xMax: 10000, yMin: -1, yMax: 1 });
  const axisFailure = await page.evaluate(({ scene, question }) => {
    try { window.MasterLabInstantRenderer.draw(document.querySelector('#instantCanvas'), scene, question); return null; }
    catch (error) { return error.message; }
  }, { scene: cramped, question: q });
  assert.equal(axisFailure, 'AXIS_TEXT_COLLISION'); mark('unreadably cramped axis layouts are rejected instead of displaying overlapping values');

  const responsiveScene = JSON.parse(await readFile(resolve(liveDir, 'E01.json'), 'utf8'));
  for (const width of [390, 768, 1366, 1920]) {
    mode = 'live'; latest = responsiveScene.raw; service.cache.clear(); page = await pageAt(width); await generate(page, responsiveScene.q);
    await page.waitForSelector('#instantCanvas svg');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
    assert.equal(overflow, false, `page overflow ${width}`);
    await page.screenshot({ path: resolve(output, `viewport-${width}.png`), fullPage: true });
    report.viewports.push({ width, horizontalPageOverflow: overflow, layout: await checkLayout(page) });
  }
  mark('390 768 1366 and 1920 layouts have no page overflow');
  mode = 'ok'; page = await pageAt(1366, '/?demo=1');
  await page.waitForFunction(() => window.MasterLabAIHost.getContext().mode === 'experiment', { timeout: 15000 }); mark('demo=1 still generates a preset experiment');

  // Live output acceptance is a replay of saved real responses, not new model calls.
  page = await pageAt(); mode = 'live';
  for (const item of bank) {
    const entry = report.bank.find(p => p.id === item.id);
    let saved; try { saved = JSON.parse(await readFile(resolve(liveDir, `${item.id}.json`), 'utf8')); } catch { entry.live = 'not-yet-available'; continue; }
    if (!saved.raw || saved.raw.status === 'declined') { entry.live = saved.result.code || 'declined'; continue; }
    const check = Scene.validate(saved.raw, item.q);
    if (!check.ok) { entry.live = check.code; continue; }
    latest = saved.raw; service.cache.clear();
    await page.goto(base); await generate(page, item.q);
    if (!(await page.locator('#instantCanvas svg').count())) { entry.live = 'RENDER_REJECTED'; continue; }
    await page.locator('#instantExperiment').screenshot({ path: resolve(output, `${item.id}.png`) });
    entry.live = 'rendered';
    entry.layout = await checkLayout(page);
    if (item.id.startsWith('G')) {
      await page.setViewportSize({ width: 390, height: 960 });
      await page.waitForSelector('#instantCanvas.is-compact');
      entry.mobileLayout = await checkLayout(page);
      await page.locator('#instantExperiment').screenshot({ path: resolve(output, `${item.id}-390.png`) });
      await page.setViewportSize({ width: 1366, height: 960 });
    }
    if (item.id === 'O01') {
      const arcAnchors = await page.evaluate(scene => scene.objects.filter(o => o.type === 'arc').every(o => {
        const line = document.querySelector(`#instantCanvas [data-label-target="${o.id}"]`); if (!line) return true;
        return Math.abs(Math.hypot(Number(line.getAttribute('x2')) - o.cx, Number(line.getAttribute('y2')) - o.cy) - o.r) < .01;
      }), saved.raw);
      assert.equal(arcAnchors, true); mark('angle annotations terminate on their actual arcs');
    }
  }
  for (const item of bank) assert.equal(report.bank.find(entry => entry.id === item.id)?.live, item.expected === 'scene' ? 'rendered' : 'DECLINED', `final live outcome ${item.id}`);
  mark('all 24 drawable live responses render and six insufficient or invalid questions are declined');
  mark('function annotation bubbles avoid axis tick text on desktop and 390px layouts');
  assert.deepEqual(report.consoleErrors, []);
} catch (error) { report.failure = error.stack; console.error(error); process.exitCode = 1; }
finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close(); web.close(); gateway.close();
}
