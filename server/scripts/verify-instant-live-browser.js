// One explicitly authorized end-to-end browser -> local gateway -> real DeepSeek run.
// Load a temporary credential with Node --env-file; never write headers or credentials.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import { createMasterLabServer } from '../src/server.js';
import { InstantSceneService, DeepSeekSceneProvider } from '../src/instant-scene-service.js';

if (!process.argv.includes('--live')) throw new Error('Use --live only for an explicitly authorized real API call.');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = resolve(root, process.env.INSTANT_SMOKE_OUTPUT || 'artifacts/instant-engine-2026-10-18/live-smoke');
await mkdir(output, { recursive: true });
const bank = JSON.parse(await readFile(new URL('../eval/instant-scene-bank.json', import.meta.url), 'utf8'));
const item = bank.find(q => q.id === 'G03');
const provider = new DeepSeekSceneProvider();
if (!provider.configured) throw new Error('No configured credential.');
const service = new InstantSceneService({ provider });
const originalGenerate = service.generate.bind(service);
const report = { date: new Date().toISOString(), id: item.id, question: item.q, sceneRequests: 0, consoleErrors: [] };
service.generate = async (...args) => { report.sceneRequests++; report.result = await originalGenerate(...args); return report.result; };
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const web = createServer(async (req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1) || 'index.html';
  if (name.includes('..') || name.includes('\\')) { res.writeHead(400); res.end(); return; }
  try { const bytes = await readFile(resolve(root, 'web', name)); res.writeHead(200, { 'Content-Type': mime[extname(name)] || 'application/octet-stream' }); res.end(bytes); }
  catch { res.writeHead(404); res.end(); }
});
web.listen(0, '127.0.0.1'); await once(web, 'listening');
const base = `http://127.0.0.1:${web.address().port}`;
const gateway = createMasterLabServer({ instantSceneService: service, allowedOrigins: [base] });
gateway.listen(0, '127.0.0.1'); await once(gateway, 'listening');
const gatewayBase = `http://127.0.0.1:${gateway.address().port}`;
let browser;
try {
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
  report.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1366, height: 960 }, reducedMotion: 'reduce' });
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.fulfill({ status: 204, body: '' }));
  const page = await context.newPage();
  page.on('pageerror', e => report.consoleErrors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') report.consoleErrors.push(msg.text()); });
  await page.addInitScript(url => { window.MASTER_LAB_API_URL = url; }, gatewayBase);
  await page.goto(base);
  await page.locator('#questionInput').fill(item.q);
  await page.locator('#generateButton').click();
  await page.waitForSelector('#instantCancel:visible');
  await page.locator('#instantExperiment').screenshot({ path: resolve(output, 'loading.png') });
  await page.waitForFunction(() => !document.querySelector('#generateButton').classList.contains('loading'), null, { timeout: 130000 });
  assert.equal(report.result?.mode, 'instant', report.result?.code);
  await page.waitForSelector('#instantCanvas svg');
  assert.equal(report.sceneRequests, 1);
  assert.equal(await page.locator('#instantCanvas .science-formula-rule').count() > 0, true, 'sqrt is typeset with an actual radical rule');
  assert.equal(await page.evaluate(() => localStorage.getItem('masterLab.deepseekApiKey')), null, 'server credential never reaches browser storage');
  assert.deepEqual(report.consoleErrors, []);
  await page.locator('#instantExperiment').screenshot({ path: resolve(output, 'result.png') });
  report.passed = true;
} catch (error) { report.passed = false; report.failure = error.message; process.exitCode = 1; }
finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, model: report.result?.model, durationMs: report.result?.durationMs, tokens: report.result?.usage?.total_tokens, failure: report.failure }));
  await browser?.close(); web.close(); gateway.close();
}
