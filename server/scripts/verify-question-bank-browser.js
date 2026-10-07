// 题目解析回归：本地模板只在题目条件完全吻合时生成实验，且生成后数值不被滑块等环节改动。
// 用法：npm run test:questions（需要 Playwright；BROWSER_CHANNEL 默认 msedge，可设为 chromium）
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { extname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
const bank = JSON.parse(await readFile(resolve(root, 'server/eval/local-template-bank.json'), 'utf8'));
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const name = path === '/' ? 'index.html' : path.slice(1);
  if (name.includes('..')) { res.writeHead(400); res.end(); return; }
  try {
    const body = await readFile(resolve(root, 'web', name));
    res.writeHead(200, { 'Content-Type': `${mime[extname(name)] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end();
  }
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const failures = [];
const near = (actual, expected) => Math.abs(actual - expected) <= Math.max(1e-6, 1e-4 * Math.abs(expected));

async function freshPage() {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: 'reduce' });
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1'
    ? route.continue() : route.fulfill({ status: 503, body: '' }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/');
  await page.waitForFunction(() => typeof window.planLocalExperiment === 'function');
  await page.evaluate(() => { if (window.state?.autoDemoTimer) clearTimeout(state.autoDemoTimer); });
  return { context, page, errors };
}

// 1. 规划层：是否匹配本地模板、匹配到哪个模板、关键结果是否正确
const { context: planContext, page: planPage, errors: planErrors } = await freshPage();
const plans = await planPage.evaluate(items => items.map(item => {
  const plan = planLocalExperiment(item.q, { subject: '物理', physicsTemplate: 'brake', presetQuestion: '' });
  if (!plan.ok) return { ok: false, message: plan.parse?.message || '' };
  const p = plan.parse;
  const values = { kind: plan.kind, templateId: plan.templateId || '' };
  if (plan.kind === 'brake') Object.assign(values, { v0: p.v0, aAbs: p.aAbs, stopDistance: p.stopDistance, stopTime: p.stopTime, p1: p.v0, p2: p.parameter ?? p.aAbs });
  if (plan.kind === 'projectile') Object.assign(values, { fallTime: p.fallTime, range: p.range, gravity: p.gravity, p1: p.speed, p2: p.height });
  if (plan.kind === 'circuit') Object.assign(values, { voltage: p.voltage, resistance: p.resistance, current: p.current, p1: p.voltage, p2: p.resistance });
  if (plan.kind === 'solenoid') Object.assign(values, { leftPole: p.leftPole, rightPole: p.rightPole, p1: p.current, p2: p.turns });
  if (plan.kind === 'boardSlider') Object.assign(values, { p1: p.initialSpeed, p2: p.boardLength });
  if (plan.kind === 'chemistry') Object.assign(values, { cuMol: p.cuMol, cuMass: p.cuMass, limiting: p.limiting, p1: p.feMass, p2: p.cuso4Mol });
  if (plan.kind === 'math') Object.assign(values, { slope: p.slope, x: p.x, p1: p.x });
  if (plan.kind === 'biology') Object.assign(values, { cellType: p.cellType });
  if (plan.kind === 'extra') {
    const template = EXTRA_PHYSICS_TEMPLATES[plan.templateId];
    const model = template.model(p.p1, p.p2, p.fixed);
    const metric = model.metrics[2];
    Object.assign(values, { p1: p.p1, p2: p.p2, r1: p.fixed?.r1, mCold: p.fixed?.mCold, readout: model.readout,
      force: metric, power: metric, current: metric, t: metric, pressure: metric, eta: metric, wavelength: metric });
  }
  return { ok: true, values };
}), bank);

const localItems = [];
bank.forEach((item, index) => {
  const plan = plans[index];
  const label = `#${index + 1} ${item.q.slice(0, 36)}`;
  if (item.expect === 'ai') {
    if (plan.ok) failures.push(`${label}：应交给 AI，却匹配了本地模板 ${plan.values.kind}${plan.values.templateId ? `/${plan.values.templateId}` : ''}（${item.note || ''}）`);
    return;
  }
  if (!plan.ok) { failures.push(`${label}：应由本地模板处理，却未匹配（${plan.message}）`); return; }
  if (plan.values.kind !== item.kind || (item.templateId && plan.values.templateId !== item.templateId)) {
    failures.push(`${label}：匹配到 ${plan.values.kind}/${plan.values.templateId}，应为 ${item.kind}/${item.templateId || ''}`);
    return;
  }
  for (const [key, expected] of Object.entries(item.answer || {})) {
    const actual = plan.values[key];
    const ok = typeof expected === 'number' ? Number.isFinite(actual) && near(actual, expected) : String(actual).includes(expected);
    if (!ok) failures.push(`${label}：${key} = ${actual}，应为 ${expected}`);
  }
  localItems.push({ item, index, values: plan.values });
});
await planContext.close();

// 2. 页面层：真正点“生成实验”后，状态与滑块必须保留题目数值，结果与规划一致
for (const { item, index, values } of localItems) {
  const { context, page, errors } = await freshPage();
  const label = `#${index + 1} ${item.q.slice(0, 36)}`;
  await page.locator('#questionInput').fill(item.q);
  await page.locator('#generateButton').click();
  await page.waitForFunction(() => state.hasGenerated && !document.querySelector('#generateButton').classList.contains('loading')
    && !document.querySelector('#generationOverlay')?.classList.contains('show'), null, { timeout: 15000 });
  const after = await page.evaluate(() => ({
    subject: state.subject,
    template: state.physicsTemplate,
    p1: state.p1,
    p2: state.p2,
    slider1: Number(document.querySelectorAll('.parameters input[type=range]')[0]?.value),
    slider2: Number(document.querySelectorAll('.parameters input[type=range]')[1]?.value),
    text: document.querySelector('.experiment-card')?.innerText + document.querySelector('.reasoning-card')?.innerText,
    question: document.querySelector('#questionInput').value
  }));
  // 播放到终点后核对页面上的结论文字：精确值不能被四舍五入，近似值要写“≈ / 约”，已知条件要列全
  const finalText = await page.evaluate(() => {
    if (typeof duration === 'function') { state.time = duration(); updateScene(); }
    return [...document.querySelectorAll('.experiment-card, .reasoning-card, .mentor-card')].map(node => node.innerText).join('\n');
  });
  const squash = text => String(text).replace(/\s+/g, '');
  for (const expected of item.show || []) {
    if (!squash(finalText).includes(squash(expected))) failures.push(`${label}：页面上没有“${expected}”`);
  }
  if (Number.isFinite(values.p1) && !near(after.p1, values.p1)) failures.push(`${label}：生成后参数1 = ${after.p1}，题目为 ${values.p1}`);
  if (Number.isFinite(values.p2) && item.kind !== 'math' && !near(after.p2, values.p2)) failures.push(`${label}：生成后参数2 = ${after.p2}，题目为 ${values.p2}`);
  if (Number.isFinite(values.p1) && item.kind !== 'biology' && !near(after.slider1, after.p1)) failures.push(`${label}：滑块1 = ${after.slider1}，状态为 ${after.p1}`);
  if (Number.isFinite(values.p2) && !['math', 'biology'].includes(item.kind) && !near(after.slider2, after.p2)) failures.push(`${label}：滑块2 = ${after.slider2}，状态为 ${after.p2}`);
  if (/NaN|Infinity|undefined/.test(after.text)) failures.push(`${label}：页面出现 NaN/Infinity/undefined`);
  if (after.question !== item.q) failures.push(`${label}：输入框题目被改写`);
  if (errors.length) failures.push(`${label}：页面错误 ${errors[0]}`);
  await context.close();
}

await browser.close();
server.close();
console.log(`题库 ${bank.length} 题：本地 ${localItems.length}，交给 AI ${bank.length - localItems.length}`);
if (failures.length) {
  console.log(failures.join('\n'));
  assert.fail(`${failures.length} 项不符合预期`);
}
console.log('全部通过');
