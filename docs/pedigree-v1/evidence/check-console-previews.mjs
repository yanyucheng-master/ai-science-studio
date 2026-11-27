import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(process.argv[2] || '.');
const output = resolve(process.env.PEDIGREE_AUDIT_OUTPUT || 'artifacts/pedigree-console-previews');
await mkdir(output, { recursive: true });
const report = { sourceSha: process.env.PROTOCOL_SOURCE_SHA || 'working-tree', browser: '', checks: [],
  consoleErrors: [], pageErrors: [], apiRequests: [], previews: [],
  previewState: 'Corrected standalone XML in final documentation. Web runtime source is unchanged.' };
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://local').pathname;
  if (pathname.startsWith('/api/')) {
    report.apiRequests.push({ method: request.method, path: pathname });
    response.writeHead(503); response.end('local mock'); return;
  }
  if (pathname === '/health') {
    response.setHeader('Content-Type', 'application/json'); response.end('{"ok":true,"aiConfigured":false}'); return;
  }
  const preview = /^\/preview\/(P0[1-6])\.svg$/.exec(pathname);
  const folder = resolve(root, preview ? 'docs/pedigree-v1/previews' : 'web');
  const file = resolve(folder, preview ? preview[1] + '.svg' : pathname.slice(1) || 'index.html');
  if (!file.startsWith(folder + sep)) { response.writeHead(400); response.end(); return; }
  try {
    let data = await readFile(file);
    if (extname(file) === '.html') data = data.toString().replace(/<link\b[^>]*href="https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>/g, '');
    if (extname(file) === '.css') data = data.toString().replace(/@import\s+url\([^)]*fonts\.googleapis\.com[^)]*\);?/g, '');
    response.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
      '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' })[extname(file)] || 'application/octet-stream' });
    response.end(data);
  } catch { response.writeHead(404); response.end(); }
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
report.browser = browser.version();
const context = await browser.newContext({ viewport: { width: 1366, height: 1000 }, reducedMotion: 'reduce' });
await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.fulfill({ status: 204, body: '' }));
await context.addInitScript(base => { window.MASTER_LAB_API_URL = base; }, base);
const page = await context.newPage();
page.on('pageerror', error => report.pageErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
const check = (condition, label) => { assert.ok(condition, label); report.checks.push(label); };
try {
  await page.goto(base);
  await page.waitForFunction(() => Boolean(window.MasterLabPedigreeQuestions));
  await page.locator('.subject-tab[data-subject="生物"]').click();
  await page.locator('[data-grade="senior"]').first().click();
  await page.locator('#physicsPresetToggle').click();
  await page.locator('.preset-group[aria-label="高中 · 遗传"] [data-preset="pedigree"]').click();
  check((await page.locator('#questionInput').inputValue()).includes('P01-v1'), 'senior biology genetics menu loads the versioned pedigree sample');
  await page.locator('#generateButton').click();
  await page.waitForFunction(() => activeGenericId() === 'pedigree' && state.hasGenerated
    && !document.querySelector('#generateButton').classList.contains('loading'));
  check(await page.locator('.biology-pedigree-scene').getAttribute('data-case') === 'P01', 'normal library entry generates pedigree');
  for (const id of ['P01', 'P02', 'P03', 'P04', 'P05', 'P06']) {
    const question = await page.evaluate(id => MasterLabPedigreeQuestions.question(1, 1, MasterLabPedigreeQuestions.preset(id).fixed), id);
    await page.locator('#questionInput').fill(question); await page.locator('#generateButton').click();
    await page.waitForFunction(id => activeGenericId() === 'pedigree' && state.extraFixed.pedigree.caseId === id
      && !document.querySelector('#generateButton').classList.contains('loading'), id);
    await page.waitForFunction(() => !document.querySelector('#generationOverlay').classList.contains('show'));
    const member = page.locator('.pedigree-svg [data-pedigree-member]').first();
    await member.focus(); await page.keyboard.press('Space');
    check(await member.getAttribute('aria-pressed') === 'true', id + ' space key selects SVG member');
    await page.locator('[data-experiment-step="2"]').click();
    await page.locator('[data-pedigree-mode="XR"]').click();
    await page.locator('[data-experiment-step="4"]').click();
    check(await page.locator('.biology-pedigree-scene').getAttribute('data-case') === id, id + ' normal generation and explanation');
  }
  check(report.apiRequests.every(request => request.method !== 'POST'), 'six fixed samples generate and explain without automatic AI POST');
  const before = await page.evaluate(() => ({ question: state.generatedQuestion, time: state.time }));
  await page.locator('.subject-tab[data-subject="数学"]').click();
  await page.locator('.subject-tab[data-subject="生物"]').click();
  check(await page.evaluate(before => activeGenericId() === 'pedigree' && state.generatedQuestion === before.question
    && state.time === before.time, before), 'subject roundtrip retains the active pedigree and step');
  const requestsBeforeTutor = report.apiRequests.length;
  await page.locator('#aiTutorEntryButton').click();
  await page.waitForFunction(() => document.body.classList.contains('ai-tutor-route'));
  report.tutorContext = await page.evaluate(() => buildMasterLabAIContext());
  check(report.tutorContext.originalQuestion === before.question && report.tutorContext.currentStep.includes('P06-v1'),
    'actual tutor entry retains current graph and step context');
  await page.locator('#aiTutorBackButton').click();
  await page.waitForFunction(() => !document.body.classList.contains('ai-tutor-route'));
  check(await page.evaluate(before => state.generatedQuestion === before.question && state.time === before.time, before),
    'actual tutor return retains graph step');
  report.userInitiatedTutorRequests = report.apiRequests.slice(requestsBeforeTutor);
  check(!report.consoleErrors.length && !report.pageErrors.length, 'no console errors or page exceptions during six-sample operation');
  const counts = [7, 6, 7, 7, 6, 5];
  for (const [index, id] of ['P01', 'P02', 'P03', 'P04', 'P05', 'P06'].entries()) {
    await page.goto(base + '/preview/' + id + '.svg');
    const details = await page.evaluate(() => {
      const svg = document.documentElement;
      return { root: svg.localName, members: svg.querySelectorAll('[data-pedigree-member]').length,
        families: [...svg.querySelectorAll('[data-pedigree-family]')].map(node => node.getAttribute('data-pedigree-family')),
        labels: [...svg.querySelectorAll('.pedigree-id')].map(node => node.textContent),
        scripts: svg.querySelectorAll('script').length };
    });
    check(details.root === 'svg' && details.members === counts[index] && details.scripts === 0, id + ' standalone SVG parses and contains the correct members');
    const bytes = await readFile(resolve(root, 'docs/pedigree-v1/previews', id + '.svg'));
    report.previews.push({ id, ...details, sha256: createHash('sha256').update(bytes).digest('hex') });
    if (id === 'P02') await page.screenshot({ path: resolve(output, 'standalone-P02.png') });
  }
  check(!report.consoleErrors.length && !report.pageErrors.length, 'standalone previews introduce no console errors or script exceptions');
} catch (error) {
  report.failure = error.stack;
  console.error(error.stack); process.exitCode = 1;
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  await context.close(); await browser.close(); server.close();
}
