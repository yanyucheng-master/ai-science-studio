// Only isolated profiles, local files and mock HTTP responses are used here.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(process.argv[2] || '.');
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

report.eventRoutes=[];
try {
  const c=await context(390,1100),p=await open(c),links=[];
  const conditional='II-1与II-2已知下一子代为男孩时受累概率';
  const joint='II-1与II-2下一子代为受累男孩概率';
  for(const asks of [conditional,joint,conditional+'|'+joint]){
    const q=await p.evaluate(asks=>{const f=MasterLabPedigreeQuestions.preset('P04').fixed;return MasterLabPedigreeQuestions.question(1,1,{...f,asks});},asks);
    await generate(p,q,'P04');links.push({asks,url:await copyShare(p)});
  }
  const receiver=await context(390,1100),rp=await open(receiver,links[0].url);
  await settled(rp,'P04');await rp.evaluate(()=>window.__sameDocument='pedigree-event-route');
  for(const row of [links[0],links[1],links[2],links[0]]){
    if((await snapshot(rp)).fixed.asks!==row.asks)await rp.goto(row.url);
    await rp.waitForFunction(asks=>state.extraFixed.pedigree?.asks===asks&&!document.querySelector('#generateButton').classList.contains('loading'),row.asks);
    check(await rp.evaluate(()=>window.__sameDocument)==='pedigree-event-route','same-document share navigation preserves the original JS document');
    check((await snapshot(rp)).step==='1','changing only the P04 subquestions starts at the reset baseline');
    await seek(rp,5);
    const fields=await rp.locator('[data-pedigree-probability-result]').evaluateAll(nodes=>nodes.map(node=>({field:node.dataset.pedigreeProbabilityResult,text:ScienceFormula.sourceText(node)})));
    check(fields.length===(row.asks.includes('|')?2:1),'same case and same parameters restore exactly the requested event columns');
    check(fields.some(f=>f.field==='boyConditional'&&f.text.includes('1/2'))===row.asks.includes(conditional),'same-document conditional result matches 1/2 only when asked');
    check(fields.some(f=>f.field==='affectedBoy'&&f.text.includes('1/4'))===row.asks.includes(joint),'same-document joint result matches 1/4 only when asked');
    report.eventRoutes.push({asks:row.asks,fields,state:await snapshot(rp)});
  }
  const before=await snapshot(rp);
  await rp.locator('#aiTutorEntryButton').click();await rp.locator('#aiTutorBackButton').click();
  const after=await snapshot(rp);
  check(after.fixed.asks===conditional&&after.step===before.step,'AI page roundtrip keeps the single active conditional question and step');
  await rp.locator('[data-experiment-reset]').click();
  check((await snapshot(rp)).fixed.asks===conditional&&(await snapshot(rp)).step==='1','reset preserves the original single subquestion');
  check(report.requests.length===0,'same-document event sharing and AI page roundtrip send zero automatic AI POST');
  check(report.errors.length===0,'same-document event sharing has no page exceptions');
}catch(error){report.failure=error.stack;console.error(error.stack);process.exitCode=1;}
finally{await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));await Promise.allSettled(contexts.map(c=>c.close()));await browser.close();server.close();}
