// Only isolated profiles, local files and mock HTTP responses are used here.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
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

try {
  const ids = ['P01', 'P02', 'P03', 'P04', 'P05', 'P06'];
  const widths = process.env.PEDIGREE_QUICK ? [390] : [1366, 820, 390, 360, 844];
  for (const width of widths) {
    const current = await context(width, width === 844 ? 390 : 1100), page = await open(current);
    for (const id of ids) {
      const text = await question(page, id);
      await generate(page, text, id);
      const initial = await snapshot(page);
      check(text.length < 1200 && initial.fixed.level === 'senior', `${id} ${width}px full versioned question and senior content`);
      await geometry(page, id, width);
      await page.locator('.pedigree-svg [data-pedigree-member]').first().focus();
      await page.keyboard.press('Enter');
      check(await page.locator('[data-pedigree-selection]').textContent() !== '点选一个成员查看其亲缘与题给信息。', `${id} keyboard member selection`);
      for (let step = 1; step <= 6; step++) await seek(page, step);
      await page.locator('.reason-step[data-step="2"]').click();
      check(await page.locator('.biology-pedigree-scene').getAttribute('data-step') === '2', `${id} right path seeks scene`);
      await page.locator('[data-pedigree-predict="AR"]').click();
      await seek(page, 3);
      await page.locator('[data-pedigree-evidence="F1"]').click();
      check(await page.locator('[data-pedigree-family="F1"]').getAttribute('class')?.then(value => value?.includes('chosen')), `${id} evidence highlights actual family`);
      if (id === 'P02') {
        await seek(page, 4);
        check(await page.locator('[data-genotype-row="II-4"] [data-carrier-source]').getAttribute('data-carrier-source') === 'given', 'P02 given carrier origin');
        check(await page.locator('[data-genotype-row="I-1"] [data-carrier-source]').getAttribute('data-carrier-source') === 'inferred', 'P02 inferred carrier origin');
        await seek(page, 5);
        check((await page.locator('[data-carrier-probability]').evaluate(node => ScienceFormula.sourceText(node))).includes('2/3'), 'P02 explicit conditional 2/3 derivation');
      }
      if (id === 'P04') {
        await seek(page, 5);
        const row = await page.locator('[data-pedigree-probabilities] tbody tr').first().evaluate(node => ScienceFormula.sourceText(node));
        check(row.includes('1/2') && row.includes('1/4'), 'P04 conditional and joint probabilities');
      }
      if (id === 'P05') {
        await seek(page, 3);
        for (const mode of ['AD', 'AR', 'XD', 'XR']) {
          await page.locator(`[data-pedigree-mode="${mode}"]`).click();
          check((await page.locator('[data-mode-result]').textContent()).includes('有可行'), 'P05 feasible ' + mode);
        }
        await seek(page, 5);
        const conditionsSource = await page.locator('[data-p05-conditions]').evaluate(node => ScienceFormula.sourceText(node));
        report.p05ConditionsSource = conditionsSource;
        check(conditionsSource.replace(/\s/g, '').replace(/−/g, '-').includes('II-3为AA时0、为Aa时1/4'), 'P05 outsider conditions displayed');
      }
      if (id === 'P06') {
        await seek(page, 3);
        for (const [mode, family] of [['AD', 'F2'], ['AR', 'F1'], ['XD', 'F2'], ['XR', 'F1']]) {
          await page.locator(`[data-pedigree-mode="${mode}"]`).click();
          check(await page.locator(`[data-conflict="${family}"]`).count() > 0, 'P06 conflict text ' + mode);
          check(await page.locator(`[data-pedigree-family="${family}"]`).getAttribute('class').then(value => value.includes('conflict')), 'P06 actual conflict line ' + mode);
        }
      }
      await seek(page, 6);
      const conclusion = id === 'P05' ? 'many' : id === 'P06' ? 'none' : 'one';
      await page.locator(`input[name="pedigree-explanation"][value="${conclusion}"]`).check();
      await page.locator('[data-pedigree-check]').click();
      check((await page.locator('[data-explanation-feedback]').textContent()).includes('一致'), `${id} compare and explanation feedback`);
      if ([390, 360].includes(width)) {
        await seek(page, id === 'P06' ? 3 : id === 'P05' ? 5 : 4);
        await page.waitForFunction(() => !document.querySelector('#toast').classList.contains('show'));
        const name = `${id}-${width}.png`;
        await page.locator('.biology-pedigree-scene').screenshot({ path: resolve(output, name) });
        report.pages.push({ id, width, file: name, question: text, snapshot: await snapshot(page) });
      }
      await page.locator('[data-experiment-reset]').click();
      check(await page.locator('.biology-pedigree-scene').getAttribute('data-step') === '1', `${id} reset initial step`);
      await seek(page, 2);
      check((await page.locator('[data-prediction]').textContent()).includes('尚未选择'), `${id} reset clears learning draft`);
    }
    await current.close();
  }

  const source = await context(), page = await open(source);
  await generate(page, await question(page, 'P01'), 'P01');
  const links = [];
  for (const id of ids) {
    await page.locator(`[data-pedigree-case="${id}"]`).click();
    // These are the next normal buttons after switching the case.
    await page.locator('#favoriteButton').click();
    await settled(page, id);
    const url = await copyShare(page), current = await snapshot(page);
    check(await page.evaluate(q => favoriteRecords.some(record => record.question === q), current.question), `${id} immediate next favorite uses selected graph`);
    const receiver = await context(), rp = await open(receiver, url);
    await settled(rp, id);
    const restored = await snapshot(rp);
    check(JSON.stringify(restored.fixed) === JSON.stringify(current.fixed) && restored.question === current.question,
      `${id} independent share restores case, version, facts and asks`);
    check(restored.step === '1', `${id} independent share begins at initial step`);
    await seek(rp, 4);
    await rp.reload(); await settled(rp, id);
    check((await snapshot(rp)).step === '1', `${id} share refresh starts initial step`);
    const favoriteId = await page.evaluate(q => favoriteRecords.find(record => record.question === q).id, current.question);
    links.push({ id, url, question: current.question, fixed: current.fixed, favoriteId });
    await receiver.close();
  }
  report.restores = links.map(({ url, ...row }) => row);
  await page.locator('[data-grade="junior"]').first().click();
  for (const row of links) {
    await page.locator(`.favorite-item[data-favorite-id="${row.favoriteId}"]`).click();
    await page.locator('#generateButton').click(); await settled(page, row.id);
    check((await snapshot(page)).fixed.level === 'senior', `${row.id} senior favorite restored from junior selection`);
    await seek(page, 5); await page.locator('[data-experiment-reset]').click();
    check((await snapshot(page)).question === row.question && (await snapshot(page)).step === '1', `${row.id} favorite owns original reset baseline`);
  }
  await generate(page, links[0].question, 'P01');
  for (const row of [links[0], links[4], links[0]]) {
    await page.goto(row.url); await settled(page, row.id);
    check((await snapshot(page)).fixed.caseId === row.id, 'A B A route restores ' + row.id);
  }

  for (const noTutor of [false, true]) {
    const current = await context(390, 1100, { noTutor }), p = await open(current);
    const q = await question(p, 'P02'); await generate(p, q, 'P02'); await seek(p, 4);
    for (const invalid of [q.replace('P02-v2', 'P99-v1'), q + '另外求连续两次受累概率。',
      q.replace('完全外显。', ''), q + '<b>标记</b> & "中文"']) {
      const before = await snapshot(p), count = report.requests.length;
      await p.locator('#questionInput').fill(invalid); await p.locator('#generateButton').click();
      await p.waitForFunction(() => document.querySelector('#parseFeedback.error.show'));
      const after = await snapshot(p), feedback = await p.locator('#parseFeedback').innerText();
      check(before.time === after.time && before.question === after.question && before.step === after.step, 'refusal preserves graph and step');
      check(report.requests.length === count, 'fixed graph refusal makes zero automatic AI POST');
      check(after.context.originalQuestion === invalid && !after.context.deterministicResult.resultText, 'new question tutor contains no old answer');
      check(after.context.currentStep.includes('系谱图本地核对'), 'new question tutor receives local gap');
      check(!await p.locator('#parseFeedback b').count(), 'refusal text cannot insert input DOM');
      report.refusals.push({ noTutor, invalid, feedback, requests: report.requests.slice(count), before, after });
    }
    await current.close();
  }

  const cache = await context(1366, 1000, { routing: false }), cp = await open(cache, links[1].url);
  await settled(cp, 'P02'); await seek(cp, 4);
  await cp.goto(base + '/away'); await cp.evaluate(() => history.back());
  await cp.waitForFunction(() => window.__persisted === true && state.hasGenerated);
  check((await snapshot(cp)).step === '4', 'real BFCache retains current active graph step');

  await page.goto(base);
  const mendel = await page.evaluate(() => MASTER_LAB_TEMPLATES.mendel.question(400, 1));
  await page.locator('#questionInput').fill(mendel); await page.locator('#generateButton').click();
  await page.waitForFunction(() => state.hasGenerated && activeGenericId() === 'mendel');
  check(await page.evaluate(() => buildGenericContent().model.probabilities.aa === .25), 'existing Mendel entry still calculates 1/4');
  await page.waitForFunction(() => !document.querySelector('#generateButton').classList.contains('loading'));
  const ordinaryStart = report.requests.length;
  await page.locator('#questionInput').fill('遗传系谱图的符号有哪些？');
  await page.locator('#generateButton').click();
  await page.waitForFunction(() => !document.querySelector('#generateButton').classList.contains('loading'));
  check(report.requests.length > ordinaryStart, 'ordinary pedigree concept retains original mock AI fallback');
  report.ordinaryConcept = { question: '遗传系谱图的符号有哪些？', requests: report.requests.slice(ordinaryStart), feedback: await page.locator('#parseFeedback').innerText() };
  if (process.env.PEDIGREE_BASELINE_ROOT) {
    const background = '展示卡片写着高中遗传系谱图P01-v1。另有一道物理题：平面镜成像，物体距镜面20cm，物高5cm，求像距和物像距离及像高。';
    const comparison = [];
    const baselineContext = await context(), baselinePage = await baselineContext.newPage();
    await baselinePage.goto(base + '/baseline/');
    await baselinePage.waitForFunction(() => typeof planLocalExperiment === 'function');
    for (const [name, activePage] of [['candidate', page], ['baseline', baselinePage]]) {
      await activePage.locator('.subject-tab[data-subject="物理"]').click();
      const before = report.requests.length;
      await activePage.locator('#questionInput').fill(background);
      const response = activePage.waitForResponse(response => response.url().endsWith('/api/v1/experiment/generate'));
      await activePage.locator('#generateButton').click();
      await response;
      await activePage.waitForFunction(() => !document.querySelector('#generateButton').classList.contains('loading'));
      comparison.push({ name, plan: await activePage.evaluate(q => planLocalExperiment(q), background),
        feedback: await activePage.locator('#parseFeedback').innerText(), requests: report.requests.slice(before) });
    }
    check(!comparison[0].plan.ok && !comparison[1].plan.ok && !comparison[0].plan.localOnly
      && comparison[0].requests.length === comparison[1].requests.length, 'genetics-background classification matches existing baseline limitation');
    report.backgroundBaselineComparison = comparison;
    await baselineContext.close();
  }
  const mirror = '平面镜成像，物体距镜面20cm，物高5cm，求像距和物像距离及像高。';
  await page.locator('#questionInput').fill(mirror); await page.locator('#generateButton').click();
  await page.waitForFunction(() => state.hasGenerated && activeGenericId() === 'planeMirror'
    && !document.querySelector('#generateButton').classList.contains('loading'));
  check(await page.evaluate(() => buildGenericContent().model.imageDistance === 20 && buildGenericContent().model.imageHeight === 5), 'supported mirror control remains 20cm and 5cm');
  check(!report.errors.length, 'no page script errors');
} catch (error) {
  report.failure = error.stack;
  console.error(error.stack);
  process.exitCode = 1;
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  await Promise.allSettled(contexts.map(context => context.close()));
  await browser.close(); server.close();
}
