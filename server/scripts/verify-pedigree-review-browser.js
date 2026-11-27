// Only isolated profiles, local files and mock HTTP responses are used here.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.env.PEDIGREE_REVIEW_ROOT ? resolve(process.env.PEDIGREE_REVIEW_ROOT) : fileURLToPath(new URL('../../', import.meta.url));
const web = resolve(root, 'web');
const output = process.env.PEDIGREE_QA_OUTPUT || resolve(root, 'artifacts/pedigree-v1');
await mkdir(output, { recursive: true });
const report = { sourceSha: process.env.PROTOCOL_SOURCE_SHA || 'working-tree', browser: '',
  checks: [], requests: [], pages: [], errors: [], layouts: [], restores: [], refusals: [] };
const check = (condition, label) => {
  assert.ok(condition, label);
  report.checks.push(label);
  console.log('PASS', label);
};
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://local').pathname;
  if (pathname.startsWith('/api/')) {
    report.requests.push({ method: request.method, path: pathname });
    response.writeHead(503, { 'Content-Type': 'application/json' });
    response.end('{"error":"local mock unavailable"}');
    return;
  }
  if (pathname === '/health') {
    response.setHeader('Content-Type', 'application/json');
    response.end('{"ok":true,"aiConfigured":false}');
    return;
  }
  if (pathname === '/away') {
    response.setHeader('Content-Type', 'text/html');
    response.end('<title>Local away</title>Local BFCache destination');
    return;
  }
  const baselineRequest = pathname.startsWith('/baseline/') && process.env.PEDIGREE_BASELINE_ROOT;
  const servedRoot = baselineRequest ? resolve(process.env.PEDIGREE_BASELINE_ROOT, 'web') : web;
  const relativePath = baselineRequest ? pathname.slice('/baseline/'.length) : pathname.slice(1);
  const file = resolve(servedRoot, relativePath || 'index.html');
  if (!file.startsWith(servedRoot + sep)) { response.writeHead(400); response.end(); return; }
  try {
    let data = await readFile(file);
    if (extname(file) === '.html') data = data.toString().replace(/<link\b[^>]*href="https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>/g, '');
    if (extname(file) === '.css') data = data.toString().replace(/@import\s+url\([^)]*fonts\.googleapis\.com[^)]*\);?/g, '');
    response.writeHead(200, { 'Content-Type': ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html',
      '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' })[extname(file)] || 'application/octet-stream' });
    response.end(data);
  } catch { response.writeHead(404); response.end(); }
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true,
  ignoreDefaultArgs: ['--disable-back-forward-cache'] });
report.browser = browser.version();
const contexts = [];

async function context(width = 1366, height = 1000, { noTutor = false, routing = true } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: width <= 844,
    isMobile: width <= 844, reducedMotion: 'reduce' });
  contexts.push(context);
  if (routing) await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (noTutor && url.pathname === '/ai-tutor.js') return route.fulfill({ status: 200, body: '// Tutor intentionally absent.' });
    return url.origin === base ? route.continue() : route.fulfill({ status: 204, body: '' });
  });
  await context.addInitScript(base => {
    window.MASTER_LAB_API_URL = base;
    window.__copies = [];
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => window.__copies.push(text) } });
    window.addEventListener('pageshow', event => { window.__persisted = event.persisted; });
  }, base);
  context.on('page', page => page.on('pageerror', error => report.errors.push(error.message)));
  return context;
}

async function open(context, url = base) {
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForFunction(() => Boolean(window.MasterLabPedigreeQuestions && window.planLocalExperiment));
  return page;
}

async function question(page, id) {
  return page.evaluate(id => {
    const preset = MasterLabPedigreeQuestions.preset(id);
    return MasterLabPedigreeQuestions.question(1, 1, preset.fixed);
  }, id);
}

async function settled(page, id) {
  await page.waitForFunction(id => state.hasGenerated && activeGenericId() === 'pedigree'
    && state.extraFixed.pedigree.caseId === id && !document.querySelector('#generateButton').classList.contains('loading'), id);
  await page.waitForFunction(() => !document.querySelector('#generationOverlay').classList.contains('show'));
}

async function generate(page, text, id) {
  await page.locator('#questionInput').fill(text);
  await page.locator('#generateButton').click();
  await settled(page, id);
}

async function seek(page, step) {
  await page.locator(`.biology-pedigree-scene [data-experiment-step="${step - 1}"]`).click();
  await page.waitForFunction(step => document.querySelector('.biology-pedigree-scene').dataset.step === String(step), step);
  check(await page.evaluate(step => state.reasonStep === step && !state.playing, step), `manual step ${step} synchronizes reasoning`);
}

async function snapshot(page) {
  return page.evaluate(() => ({ fixed: state.extraFixed.pedigree, question: state.generatedQuestion,
    time: state.time, step: document.querySelector('.biology-pedigree-scene')?.dataset.step,
    context: buildMasterLabAIContext() }));
}

async function copyShare(page) {
  const before = await page.evaluate(() => window.__copies.length);
  await page.locator('#shareButton').click();
  await page.waitForFunction(before => window.__copies.length > before, before);
  return page.evaluate(() => window.__copies.at(-1));
}

async function geometry(page, id, width) {
  const layout = await page.evaluate(() => {
    const scene = document.querySelector('.biology-pedigree-scene');
    const svg = scene.querySelector('svg'), svgRect = svg.getBoundingClientRect(), view = svg.viewBox.baseVal;
    const people = [...svg.querySelectorAll('[data-pedigree-member]')].map(node => {
      const hit = node.querySelector('.pedigree-hit').getBoundingClientRect();
      const text = node.querySelector('.pedigree-id').getBBox();
      return { id: node.dataset.pedigreeMember, hit: { width: hit.width, height: hit.height }, label: { x: text.x, y: text.y, width: text.width, height: text.height } };
    });
    const families = [...svg.querySelectorAll('[data-pedigree-family]')].map(node => ({
      id: node.dataset.pedigreeFamily, path: node.querySelector('path').getAttribute('d')
    }));
    const outside = [...scene.querySelectorAll('h3,h4,p,table,fieldset,nav')].filter(node => node.checkVisibility())
      .filter(node => node.scrollWidth > node.clientWidth + 2).map(node => node.textContent.slice(0, 80));
    return { width: innerWidth, documentWidth: document.documentElement.scrollWidth, people, families, outside,
      xScale: svgRect.width / view.width, yScale: svgRect.height / view.height,
      legendVisible: scene.querySelector('.pedigree-legend').checkVisibility() };
  });
  report.layouts.push({ id, viewport: width, ...layout });
  check(layout.documentWidth <= layout.width + 1 && !layout.outside.length, `${id} ${width}px text and page fit`);
  check(Math.abs(layout.xScale - layout.yScale) < 0.005 && layout.legendVisible, `${id} ${width}px equal SVG scale and visible legend`);
  check(layout.people.every(person => person.hit.width >= 44 && person.hit.height >= 44), `${id} ${width}px SVG targets at least 44px`);
  const people = await page.evaluate(() => buildGenericContent().model.data.people);
  check(layout.people.length === people.length, `${id} all member IDs rendered`);
  const expected = await page.evaluate(() => {
    const data = buildGenericContent().model.data, people = Object.fromEntries(data.people.map(p => [p.id, p]));
    return data.families.map(f => ({ id: f.id, father: people[f.father], mother: people[f.mother], children: f.children.map(id => people[id]) }));
  });
  for (const family of expected) {
    const path = layout.families.find(row => row.id === family.id).path;
    const y = 65 + (family.father.generation - 1) * 135;
    check(path.startsWith(`M${family.father.x + 18} ${y}H${family.mother.x - 18}`), `${id} ${family.id} spouse connection uses correct endpoints`);
    for (const child of family.children) check(path.includes(`M${child.x} ${y + 57}V${65 + (child.generation - 1) * 135 - 18}`), `${id} ${family.id} child ${child.id} connects to sibling bar`);
  }
}

Object.assign(report, { probabilities: [], references: [], derivations: [], keyboard: [] });
const normalized = async locator => locator.evaluate(node => ScienceFormula.sourceText(node).replace(/\s/g, '').replace(/[−–]/g, '-'));
async function expectedAnswers(page, asks) {
  await seek(page, 5);
  const results = page.locator('[data-pedigree-probability-result]');
  check(await results.count() === asks.length, 'primary results contain exactly the requested probability events');
  for (const [ask, field, value, denominator] of asks) {
    const text = await normalized(page.locator(`[data-pedigree-probability-result="${field}"]`));
    check(text.includes(ask) && text.includes(`为${value}`) && text.includes(denominator), `${field} primary statement, value and denominator match the subquestion`);
  }
  const stateNow = await snapshot(page);
  check(stateNow.fixed.asks === asks.map(row => row[0]).join('|'), 'active asks match the restored subquestions');
  check(!await page.locator('[data-pedigree-probability-result="probability"]').count(), 'P04 has no unasked unconditional primary result');
  check(await page.locator('[data-pedigree-probabilities] thead th').count() === asks.length + 1, 'table columns follow the requested events');
  const summary = await normalized(page.locator('[data-pedigree-probability-summary]'));
  return { asks: stateNow.fixed.asks, summary, tutor: stateNow.context.deterministicResult, step: stateNow.step };
}
try {
  const conditional = ['II-1与II-2已知下一子代为男孩时受累概率', 'boyConditional', '1/2', '分母为男孩，题设机会为1/2'];
  const joint = ['II-1与II-2下一子代为受累男孩概率', 'affectedBoy', '1/4', '分母为全部子代，机会为1'];
  const mainContext = await context(390, 1100), page = await open(mainContext);
  for (const [name, asks] of [['conditional', [conditional]], ['joint', [joint]], ['both', [conditional, joint]]]) {
    const text = await page.evaluate(asks => {
      const fixed = MasterLabPedigreeQuestions.preset('P04').fixed;
      return MasterLabPedigreeQuestions.question(1, 1, { ...fixed, asks: asks.join('|') });
    }, asks.map(row => row[0]));
    const count = report.requests.length;
    await generate(page, text, 'P04');
    const normal = await expectedAnswers(page, asks);
    await page.locator('#favoriteButton').click();
    const url = await copyShare(page);
    const favorite = await page.evaluate(q => favoriteRecords.find(record => record.question === q), text);
    check(Boolean(favorite), 'pure or paired subquestions saved by the normal favorite button');
    await generate(page, await question(page, 'P01'), 'P01');
    await page.locator('.subject-tab[data-subject="生物"]').click();
    await page.locator(`.favorite-item[data-favorite-id="${favorite.id}"]`).click();
    await page.locator('#generateButton').click(); await settled(page, 'P04');
    const favoriteRestored = await expectedAnswers(page, asks);
    const receiver = await context(390, 1100), independent = await open(receiver, url);
    await settled(independent, 'P04');
    check((await snapshot(independent)).step === '1', 'independent share starts at the initial step');
    const shareRestored = await expectedAnswers(independent, asks);
    await independent.reload(); await settled(independent, 'P04');
    const refreshed = await expectedAnswers(independent, asks);
    await independent.locator('[data-experiment-reset]').click();
    check((await snapshot(independent)).step === '1', 'subquestion reset returns to the initial step');
    const reset = await expectedAnswers(independent, asks);
    check(report.requests.length === count, 'probability generation and all restore paths make zero automatic AI POST');
    const file = `P04-${name}-390.png`;
    await independent.waitForFunction(() => !document.querySelector('#toast').classList.contains('show'));
    await independent.locator('.biology-pedigree-scene').screenshot({ path: resolve(output, file) });
    report.probabilities.push({ name, question: text, normal, favoriteRestored, shareRestored, refreshed, reset, requests: report.requests.slice(count), file });
    await receiver.close();
  }

  for (const noTutor of [false, true]) {
    const isolated = await context(390, 1100, { noTutor }), page = await open(isolated);
    await generate(page, await question(page, 'P02'), 'P02'); await seek(page, 4);
    for (const input of ['遗传系谱图 P99-v1', '遗传系谱图 P02-v1', '高中遗传系谱图 P99-v1', '高中遗传系谱图 P02-v1', '遗传系谱图 P02-v2']) {
      const before = await snapshot(page), count = report.requests.length;
      await page.locator('#questionInput').fill(input); await page.locator('#generateButton').click();
      await page.waitForFunction(() => document.querySelector('#parseFeedback.error.show'));
      const after = await snapshot(page), feedback = await page.locator('#parseFeedback').innerText();
      check(feedback.includes(input.includes('v2') ? '缺少或改动了题给条件' : '未知系谱图样例或版本'), 'explicit sample reference displays the actual local gap');
      check(before.time === after.time && before.step === after.step && before.question === after.question, 'reference refusal preserves current graph and step');
      check(JSON.stringify(before.fixed) === JSON.stringify(after.fixed), 'reference refusal preserves complete graph identity');
      check(after.context.originalQuestion === input && !after.context.deterministicResult.resultText, 'reference refusal tutor sees the new question without the old answer');
      check(after.context.currentStep.includes('系谱图本地核对'), 'reference refusal tutor retains the specific local gap');
      check(report.requests.length === count, 'reference refusal sends zero automatic AI POST');
      report.references.push({ input, noTutor, feedback, before, after, requests: report.requests.slice(count) });
    }
    await isolated.close();
  }

  for (const width of [390, 360]) {
    const c = await context(width, 1100), p = await open(c);
    for (const [id, person, mode, expected] of [
      ['P01', 'II-2', 'AD', ['至少有一个显性A', 'F2', 'III-2为aa', '双亲必须各提供a', '排除AA，剩余Aa']],
      ['P02', 'I-1', 'AR', ['II-1为aa', '排除AA，剩余Aa']],
      ['P02', 'II-4', 'AR', ['题给为携带者', '不是从子女表现推断']],
      ['P02', 'II-2', 'AR', ['全图仍允许AA或Aa', '不能给未知基因型等权先验']],
      ['P05', 'II-3', 'AR', ['全图仍允许AA或Aa', 'III-1表型未知']],
      ['P05', 'II-3', 'XR', ['III-1表型未知', '不能给未知基因型等权先验']]
    ]) {
      await generate(p, await question(p, id), id); await seek(p, 4);
      await p.locator(`[data-pedigree-mode="${mode}"]`).click();
      await p.locator(`.pedigree-members [data-pedigree-person="${person}"]`).click();
      const panel = await normalized(p.locator('[data-pedigree-derivation]'));
      const selection = await normalized(p.locator('[data-pedigree-selection]'));
      check(expected.every(text => panel.includes(text) && selection.includes(text)), 'selected member and derivation show the actual relation and remaining possibilities');
      await geometry(p, id + '-' + person + '-' + mode, width);
      const file = `${id}-${person}-${mode}-${width}.png`;
      if (width === 390) {
        await p.waitForFunction(() => !document.querySelector('#toast').classList.contains('show'));
        await p.locator('.biology-pedigree-scene').screenshot({ path: resolve(output, file) });
      }
      report.derivations.push({ width, id, person, mode, panel, selection, file: width === 390 ? file : null });
    }
    await generate(p, await question(p, 'P04'), 'P04'); await seek(p, 2);
    const keyboard = [];
    async function focusIs(selector, label) {
      const focused = await p.locator(selector).evaluate(node => node === document.activeElement);
      check(focused, label); keyboard.push({ label, selector, focused });
    }
    await p.locator('[data-pedigree-predict="XR"]').focus(); await p.keyboard.press('Enter');
    await focusIs('[data-pedigree-predict="XR"]', 'Enter prediction retains XR focus');
    check(await p.locator('[data-pedigree-predict="XR"]').getAttribute('aria-pressed') === 'true', 'Enter prediction changes state');
    await p.keyboard.press('Space'); await focusIs('[data-pedigree-predict="XR"]', 'Space prediction retains XR focus');
    check(await p.locator('[data-pedigree-predict="XR"]').getAttribute('aria-pressed') === 'false', 'Space prediction toggles state');
    await p.keyboard.press('Shift+Tab'); await focusIs('[data-pedigree-predict="XD"]', 'backward tab continues at the adjacent prediction');
    await p.keyboard.press('Enter'); await focusIs('[data-pedigree-predict="XD"]', 'second prediction keeps focus');
    await p.keyboard.press('Tab'); await focusIs('[data-pedigree-predict="XR"]', 'forward tab continues at the adjacent prediction');
    await seek(p, 3);
    await p.locator('[data-pedigree-evidence="F1"]').focus(); await p.keyboard.press('Space');
    await focusIs('[data-pedigree-evidence="F1"]', 'evidence selection retains focus');
    await p.keyboard.press('Tab'); await focusIs('[data-pedigree-evidence="F2"]', 'evidence tab continues to the second family');
    await p.keyboard.press('Enter'); await focusIs('[data-pedigree-evidence="F2"]', 'second family selection retains focus');
    await p.locator('[data-pedigree-mode="AR"]').focus(); await p.keyboard.press('Enter');
    await focusIs('[data-pedigree-mode="AR"]', 'candidate model switch retains focus');
    await p.keyboard.press('Tab'); await focusIs('[data-pedigree-mode="XD"]', 'candidate tab continues at adjacent model');
    await p.keyboard.press('Space'); await focusIs('[data-pedigree-mode="XD"]', 'Space candidate keeps focus');
    await seek(p, 4); await p.locator('[data-pedigree-mode="XR"]').click();
    await p.locator('[data-genotype-row="II-2"] [data-pedigree-person]').focus(); await p.keyboard.press('Enter');
    await focusIs('[data-genotype-row="II-2"] [data-pedigree-person]', 'table member selection retains focus');
    check(await p.locator('[data-pedigree-derivation]').count() === 1, 'keyboard table member opens its derivation');
    await seek(p, 6);
    await p.locator('input[name="pedigree-explanation"][value="one"]').focus(); await p.keyboard.press('ArrowRight');
    await focusIs('input[name="pedigree-explanation"][value="many"]', 'radio arrow selection retains focus');
    check(await p.locator('input[value="many"][name="pedigree-explanation"]').isChecked(), 'radio state follows arrow selection');
    await p.keyboard.press('ArrowRight'); await focusIs('input[name="pedigree-explanation"][value="none"]', 'second radio arrow continues in group');
    await p.keyboard.press('Tab'); await focusIs('[data-pedigree-check]', 'Tab from explanation continues to check button');
    await p.keyboard.press('Enter'); await focusIs('[data-pedigree-check]', 'checking explanation retains focus');
    check((await p.locator('[data-explanation-feedback]').innerText()).includes('重新判断'), 'keyboard check displays actual explanation feedback');
    report.keyboard.push({ width, checks: keyboard });
    await c.close();
  }
  const conceptStart = report.requests.length;
  await page.locator('#questionInput').fill('遗传系谱图的符号有哪些？'); await page.locator('#generateButton').click();
  await page.waitForFunction(() => !document.querySelector('#generateButton').classList.contains('loading'));
  check(report.requests.length === conceptStart + 1, 'ordinary concept question keeps the original single mock AI fallback');
  report.ordinaryConcept = { question: '遗传系谱图的符号有哪些？', requests: report.requests.slice(conceptStart), responseStatus: 503, feedback: await page.locator('#parseFeedback').innerText() };
  check(!report.errors.length, 'review paths have no page script exceptions');
} catch (error) {
  report.failure = error.stack;
  console.error(error.stack);
  process.exitCode = 1;
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  await Promise.allSettled(contexts.map(context => context.close()));
  await browser.close(); server.close();
}
