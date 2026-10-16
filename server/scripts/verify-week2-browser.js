// 第 2 周验收（学段切换、各学科预设菜单、双学段实验、新数学模板）：不发 AI 请求、不用真实浏览器配置。
// 用法：npm run test:week2（需要 Playwright；BROWSER_CHANNEL 默认 msedge，可设为 chromium）
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = process.env.WEEK2_QA_OUTPUT || resolve(root, 'artifacts/week2-2026-10-16');
await mkdir(output, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const server = createServer(async (req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1) || 'index.html';
  if (name.includes('..')) { res.writeHead(400); res.end(); return; }
  try {
    const data = await readFile(resolve(root, 'web', name));
    res.writeHead(200, { 'Content-Type': `${mime[extname(name)] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const report = { browser: browser.version(), checks: [], failures: [] };
const GRADE_KEY = 'masterLab.gradeLevel.v1';
const FAVORITES_KEY = 'master-lab-favorites-v1';
const JUNIOR_FRICTION = '用弹簧测力计沿水平方向拉着木块在长木板上做匀速直线运动，探究滑动摩擦力的大小与压力大小、接触面粗糙程度的关系。';
const BRAKE = '一辆汽车以 20m/s 的速度行驶，紧急刹车后加速度大小为 5m/s²，求刹车距离。';
let section = '';
const check = (condition, message, detail) => {
  report.checks.push({ section, message, ok: Boolean(condition) });
  if (!condition) report.failures.push(`${section}：${message}${detail === undefined ? '' : ` ${JSON.stringify(detail)}`}`);
};

async function fresh({ width = 1366, height = 900, storage = {}, init, initArg } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  // 只放行本地页面；AI 网关、字体等外部请求一律拒绝，保证不发真实 AI 请求
  await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.fulfill({ status: 503, body: '' }));
  await context.addInitScript(entries => {
    if (sessionStorage.getItem('week2-seeded')) return;
    sessionStorage.setItem('week2-seeded', '1');
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
  }, storage);
  if (init) await context.addInitScript(init, initArg);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.waitForFunction(() => typeof planLocalExperiment === 'function');
  await page.evaluate(() => { if (state.autoDemoTimer) clearTimeout(state.autoDemoTimer); });
  return { context, page, errors };
}
async function generate(page, q) {
  await page.locator('#questionInput').fill(q);
  await page.locator('#generateButton').click();
  await page.waitForFunction(q => state.hasGenerated && state.generatedQuestion === q && !document.querySelector('#generateButton').classList.contains('loading')
    && !document.querySelector('#generationOverlay').classList.contains('show'), q, { timeout: 15000 });
  await page.evaluate(() => { clearReasoningTimers(); clearDemoTimers(); });
}
const snapshot = page => page.evaluate(key => ({
  level: state.gradeLevel,
  stored: (() => { try { return localStorage.getItem(key); } catch { return 'unavailable'; } })(),
  pressed: [...document.querySelectorAll('.grade-switch-header [aria-pressed="true"]')].map(node => node.dataset.grade),
  input: document.querySelector('#questionInput').value,
  subject: state.subject,
  template: state.physicsTemplate,
  favoritesTitle: document.querySelector('#favoritesTitle').textContent,
  recommendations: [...document.querySelectorAll('.favorite-item[data-recommended="true"] strong')].map(node => node.textContent),
  tag: document.querySelector('#experimentGradeTag').hidden ? '' : document.querySelector('#experimentGradeTag').textContent,
  otherLevel: document.querySelector('#experimentGradeTag').classList.contains('is-other-level'),
  toast: document.querySelector('#toast.show p')?.textContent || ''
}), GRADE_KEY);
async function openMenu(page) {
  if (!(await page.locator('#physicsPresetDropdown.show').count())) await page.locator('#physicsPresetToggle').click();
  return page.evaluate(() => {
    const dropdown = document.querySelector('#physicsPresetDropdown');
    const box = dropdown.getBoundingClientRect();
    const groupOf = node => node.closest('.preset-other') ? 'other' : 'mine';
    const items = [...dropdown.querySelectorAll('.preset-option')].filter(node => !node.hidden).map(node => {
      const rect = node.getBoundingClientRect();
      return { id: node.dataset.preset, subject: node.dataset.subject, level: node.dataset.level, group: groupOf(node),
        block: node.closest('.preset-group')?.querySelector('.preset-group-title')?.textContent || '',
        meta: node.querySelector(':scope > small')?.textContent || '', visible: rect.height > 0 && rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1 };
    });
    const other = dropdown.querySelector('.preset-other');
    const summary = other?.querySelector('summary');
    const summaryRect = summary?.getBoundingClientRect();
    return {
      head: dropdown.querySelector('.preset-menu-head')?.textContent || '',
      blocks: [...dropdown.querySelectorAll(':scope > .preset-group .preset-group-title')].map(node => node.textContent),
      items,
      other: summary ? { text: summary.textContent, open: other.open, reachable: summaryRect.height > 0 } : null,
      empty: dropdown.querySelector('.preset-menu-empty')?.textContent || '',
      scrollable: dropdown.scrollHeight > dropdown.clientHeight + 1,
      hint: dropdown.classList.contains('has-more') && getComputedStyle(dropdown.querySelector('.preset-scroll-hint span')).opacity === '1',
      height: box.height,
      viewportFits: box.bottom <= innerHeight + 1 && box.right <= innerWidth + 1 && box.left >= -1
    };
  });
}
async function closeMenu(page) {
  if (await page.locator('#physicsPresetDropdown.show').count()) await page.locator('#physicsPresetToggle').click();
}
async function pickPreset(page, id) {
  await openMenu(page);
  const folded = page.locator(`#physicsPresetDropdown details.preset-other:not([open]):has([data-preset="${id}"]) > summary`);
  if (await folded.count()) await folded.click();
  await page.locator(`#physicsPresetDropdown [data-preset="${id}"]`).click();
}
const aiContext = page => page.evaluate(() => buildMasterLabAIContext());
// 示意图文字：不重叠、不出界、屏幕字号不小于 15.5px（与第 1 周的布局检查一致）
const diagramGeometry = (page, selector = '#genericPhysicsVisual svg') => page.evaluate(selector => {
  const svg = document.querySelector(selector);
  if (!svg) return { missing: true };
  const texts = [...svg.querySelectorAll('text')].filter(node => node.getClientRects().length).map(node => ({ text: node.textContent, box: node.getBBox(), node }));
  const overlap = [];
  for (let i = 0; i < texts.length; i += 1) for (let j = i + 1; j < texts.length; j += 1) {
    const a = texts[i].box, b = texts[j].box;
    if (Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1) overlap.push([texts[i].text, texts[j].text]);
  }
  const view = svg.viewBox.baseVal;
  const clipping = texts.filter(({ box }) => box.x < -0.5 || box.y < -0.5 || box.x + box.width > view.width + 0.5 || box.y + box.height > view.height + 0.5).map(item => item.text);
  const minFont = Math.min(...texts.map(({ node }) => parseFloat(getComputedStyle(node).fontSize) * Math.abs(node.getScreenCTM().a)));
  return { texts: texts.length, overlap, clipping, minFont: Number(minFont.toFixed(1)), pageOverflow: document.documentElement.scrollWidth - innerWidth };
}, selector);
const geometryOk = (geo, minFont = 15.5) => !geo.missing && !geo.overlap.length && !geo.clipping.length && geo.minFont >= minFont - 0.05 && geo.pageOverflow <= 1;
// 数学画面：非刻度标注互不重叠、都在图内；刻度可以让位（被删掉）
const mathGraphGeometry = page => page.evaluate(() => {
  const svg = document.querySelector('#mathGraph');
  const view = svg.viewBox.baseVal;
  const labels = [...svg.querySelectorAll('text:not(.math-tick-label)')].map(node => ({ text: node.textContent, box: node.getBBox(), cls: node.getAttribute('class') }));
  const overlap = [];
  for (let i = 0; i < labels.length; i += 1) for (let j = i + 1; j < labels.length; j += 1) {
    const a = labels[i].box, b = labels[j].box;
    if (Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1) overlap.push([labels[i].text, labels[j].text]);
  }
  const clipping = labels.filter(({ box }) => box.x < -0.5 || box.y < -0.5 || box.x + box.width > view.width + 0.5 || box.y + box.height > view.height + 0.5).map(item => item.text);
  return {
    labels: labels.map(item => item.text),
    points: [...svg.querySelectorAll('.math-point')].map(node => node.getAttribute('class').replace('math-point', '').trim()),
    overlap,
    clipping,
    minFont: Math.min(...[...svg.querySelectorAll('text')].map(node => parseFloat(getComputedStyle(node).fontSize))),
    pageOverflow: document.documentElement.scrollWidth - innerWidth,
    sliders: [...document.querySelectorAll('.parameters .parameter')].map(node => getComputedStyle(node).display !== 'none'),
    stageLabel: document.querySelector('.math-label')?.innerText.replace(/\s+/g, ' ').trim(),
    note: document.querySelector('#mathSlopeNote')?.textContent || '',
    aria: svg.getAttribute('aria-label'),
    view: JSON.stringify(svg._templateView?.bounds || null)
  };
});
async function setSlider(page, selector, value) {
  await page.locator(selector).evaluate((node, value) => { node.value = String(value); node.dispatchEvent(new Event('input', { bubbles: true })); }, value);
  await settle(page);
}

async function settle(page) {
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  await page.waitForTimeout(250);
}
const visibleText = page => page.evaluate(() => [...document.querySelectorAll('.experiment-card, .reasoning-card, .mentor-card')].map(node => node.innerText).join('\n'));

try {
  // 1. 新访客：默认高中，推荐刹车与铁 + 硫酸铜；菜单按板块分组，初中实验折叠在底部
  section = '新访客（高中）';
  {
    const { context, page, errors } = await fresh();
    const s = await snapshot(page);
    check(s.level === 'senior' && s.pressed.join() === 'senior' && s.stored === null, '默认高中且未写入学段', s);
    check(s.input === BRAKE && s.template === 'brake', '默认题为刹车', s.input);
    check(s.favoritesTitle === '推荐实验' && s.recommendations.join('|') === '刹车距离实验 · 速度如何归零|铁与硫酸铜定量反应', '高中推荐：刹车、铁 + 硫酸铜', s.recommendations);
    const menu = await openMenu(page);
    check(menu.head === '高中 · 物理实验', '菜单标题', menu.head);
    check(menu.items.filter(item => item.group === 'mine').every(item => item.level !== 'junior') && menu.items.filter(item => item.group === 'other').every(item => item.level === 'junior'), '高中实验在前，初中实验在折叠组', menu.items);
    check(!menu.items.some(item => item.id === 'brake'), '当前实验（刹车）不重复列出');
    check(menu.other && !menu.other.open && /^初中实验（\d+ 个）$/.test(menu.other.text) && menu.other.reachable, '初中实验折叠组可见', menu.other);
    check(menu.items.filter(item => item.group === 'mine').every(item => item.visible), '高中实验一屏内可见', menu.items.filter(item => item.group === 'mine'));
    check(menu.viewportFits, '菜单不超出视口', menu);
    await page.locator('#physicsPresetDropdown').screenshot({ path: resolve(output, '1366-menu-senior.png') });
    await page.locator('#physicsPresetDropdown details.preset-other > summary').click();
    // details 的 toggle 事件在下一个任务里派发：等一帧再读滚动提示
    await settle(page);
    const expanded = await openMenu(page);
    check(expanded.other.open && expanded.scrollable === expanded.hint, '展开初中实验后可滚动时显示滚动提示', { scrollable: expanded.scrollable, hint: expanded.hint });
    const blocks = [...new Set(expanded.items.filter(item => item.group === 'other').map(item => item.block))];
    check(blocks.join() === '力学,电学,电磁学,光学,热学,声学', '初中实验按板块分组', blocks);
    check(expanded.items.some(item => item.id === 'parallelCircuit') && expanded.items.some(item => item.id === 'planeMirror'), '并联、平面镜在菜单中');
    check(!errors.length, '无页面错误', errors);
    await context.close();
  }

  // 2. 切换到初中：默认题、推荐、菜单随学段变化，选择写入本机；刷新后保留
  section = '切换初中';
  {
    const { context, page, errors } = await fresh();
    await page.locator('.grade-switch-header [data-grade="junior"]').click();
    const s = await snapshot(page);
    const leverQuestion = await page.evaluate(() => GENERIC_TEMPLATES.lever.examples[0].question);
    check(s.level === 'junior' && s.pressed.join() === 'junior' && s.stored === 'junior', '学段为初中并保存', s);
    check(s.input === leverQuestion && s.template === 'lever', '未改动的默认题换成初中默认题（杠杆）', s.input);
    check(s.recommendations.join('|') === '杠杆平衡条件探究|浮力与阿基米德原理验证', '初中推荐：杠杆、浮力', s.recommendations);
    check(s.toast === '已切换到初中学段', '切换提示', s.toast);
    check(await page.evaluate(key => localStorage.getItem(key), FAVORITES_KEY) === null, '推荐不写入收藏');
    const menu = await openMenu(page);
    check(menu.head === '初中 · 物理实验', '菜单标题', menu.head);
    const mineBlocks = [...new Set(menu.items.filter(item => item.group === 'mine').map(item => item.block))];
    check(mineBlocks.join() === '力学,电学,电磁学,光学,热学,声学', '初中实验按板块排序', mineBlocks);
    check(!menu.items.some(item => item.id === 'lever'), '当前实验（杠杆）不重复列出');
    check(menu.other && /^高中实验（3 个）$/.test(menu.other.text) && !menu.other.open, '高中实验（刹车、木板—滑块、平抛）折叠在底部', menu.other);
    const friction = menu.items.find(item => item.id === 'friction');
    check(friction?.group === 'mine' && /压力大小/.test(friction.meta) && !/μ/.test(friction.meta), '摩擦在初中组且摘要不出现 μ', friction);
    check(menu.scrollable && menu.hint, '菜单内容超出时显示“向下滚动查看更多”', { scrollable: menu.scrollable, hint: menu.hint });
    await page.locator('#physicsPresetDropdown').evaluate(node => { node.scrollTop = node.scrollHeight; node.dispatchEvent(new Event('scroll')); });
    check(!(await openMenu(page)).hint, '滚到底部后提示消失');
    check(menu.items.find(item => item.id === 'parallelCircuit')?.block === '电学' && menu.items.find(item => item.id === 'planeMirror')?.block === '光学', '并联在电学组、平面镜在光学组');
    await page.locator('#physicsPresetDropdown').screenshot({ path: resolve(output, '1366-menu-junior.png') });
    await closeMenu(page);
    await page.reload();
    await page.waitForFunction(() => typeof planLocalExperiment === 'function');
    const again = await snapshot(page);
    check(again.level === 'junior' && again.pressed.join() === 'junior' && again.input === leverQuestion, '刷新后保留初中学段', again);
    // 学生自己输入的题：切换学段不改写
    await page.locator('#questionInput').fill('我自己的题：杠杆为什么能省力？');
    await page.locator('.grade-switch-header [data-grade="senior"]').click();
    check((await snapshot(page)).input === '我自己的题：杠杆为什么能省力？', '切换学段不改写学生输入的题');
    check(!errors.length, '无页面错误', errors);
    await context.close();
  }

  // 3. 摩擦（双学段）：初中讲法不出现 μ；在显示预设实验时切换学段，换成对应学段的预设
  section = '摩擦双学段';
  {
    const { context, page, errors } = await fresh({ storage: { [GRADE_KEY]: 'junior' } });
    await pickPreset(page, 'friction');
    const question = await page.locator('#questionInput').inputValue();
    check(question === JUNIOR_FRICTION, '初中学段的摩擦预设题', question);
    await generate(page, question);
    const s = await snapshot(page);
    check(s.tag === '初中内容' && !s.otherLevel, '标“初中内容”', s);
    const labels = await page.evaluate(() => [document.querySelector('#paramLabel1').textContent, document.querySelector('#paramLabel2').textContent, document.querySelector('#accelParam').textContent]);
    check(labels.join('|') === '压力 F压|接触面|木板', '参数为压力与接触面（木板）', labels);
    check(!/μ|动摩擦因数/.test(await visibleText(page)), '页面上不出现 μ 与动摩擦因数');
    await page.locator('#accelRange').fill('3');
    const surface = await page.evaluate(() => document.querySelector('#accelParam').textContent);
    check(surface === '毛巾', '拖动接触面滑块换成毛巾', surface);
    const ai = await aiContext(page);
    check(ai.mode === 'question' && ai.templateId === '' && ai.deterministicResult.gradeLevel === '初中' && /不用物质的量/.test(ai.deterministicResult.levelGuide), 'AI 上下文：question 模式并带初中学段', ai);
    await page.screenshot({ path: resolve(output, '1366-friction-junior.png') });
    // 摩擦示意图沿用第 1 周之前的版式（手机上靠放大按钮查看），这里只要求初中讲法不比高中讲法更挤、更小
    const juniorGeometry = {};
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await settle(page);
      juniorGeometry[width] = await diagramGeometry(page);
      if (width === 390) await page.locator('#scene').screenshot({ path: resolve(output, '390-friction-junior.png') });
    }
    await page.setViewportSize({ width: 1366, height: 900 });
    await settle(page);
    await page.locator('#accelRange').fill('1');
    await page.locator('.grade-switch-header [data-grade="senior"]').click();
    const senior = await page.evaluate(() => ({ question: state.generatedQuestion, label: document.querySelector('#paramLabel2').textContent, tag: document.querySelector('#experimentGradeTag').textContent, ai: buildMasterLabAIContext() }));
    check(/动摩擦因数为 0\.3/.test(senior.question) && /μ/.test(senior.label) && senior.tag === '高中内容', '显示预设实验时切换到高中：换成 f = μF压 的预设', senior);
    check(senior.ai.mode === 'experiment' && senior.ai.templateId === 'friction' && senior.ai.deterministicResult.gradeLevel === '高中', 'AI 上下文：高中讲法按实验模板发送', senior.ai);
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await settle(page);
      const seniorGeometry = await diagramGeometry(page);
      check(geometryOk(juniorGeometry[width], seniorGeometry.minFont), `${width} 宽：初中摩擦示意图文字不重叠、不出界，字号不小于高中讲法`, { junior: juniorGeometry[width], senior: seniorGeometry });
    }
    await page.setViewportSize({ width: 1366, height: 900 });
    check(!errors.length, '无页面错误', errors);
    await context.close();
  }

  // 4. 输入的题目不受学段限制：初中学段输入高中题照常生成，标“高中内容”，学段不变
  section = '题型不受学段限制';
  {
    const { context, page, errors } = await fresh({ storage: { [GRADE_KEY]: 'junior' } });
    await generate(page, BRAKE);
    const s = await snapshot(page);
    check(s.template === 'brake' && s.tag === '高中内容' && s.otherLevel && s.level === 'junior', '初中学段生成刹车题，标“高中内容”', s);
    const ai = await aiContext(page);
    check(ai.deterministicResult.contentLevel === '高中内容' && ai.deterministicResult.gradeLevel === '初中', 'AI 上下文带学段与内容学段', ai.deterministicResult);
    await page.locator('#experimentTitle').screenshot({ path: resolve(output, '1366-other-level-tag.png') }).catch(() => {});
    await generate(page, '滑动摩擦力的大小与哪些因素有关？');
    check((await snapshot(page)).tag === '初中内容', '无数值的摩擦探究题按初中讲法');
    check(!errors.length, '无页面错误', errors);
    await context.close();
  }

  // 5. 细胞：题目没写学段时跟随全局学段；写了（电子显微镜等）就锁定
  section = '细胞学段';
  {
    const { context, page, errors } = await fresh();
    await page.locator('.subject-tab[data-subject="生物"]').click();
    await generate(page, '观察动物细胞的结构示意图，说出细胞膜、细胞质和细胞核的功能。');
    check(await page.evaluate(() => state.cellLevel) === 'senior', '高中学段：亚显微结构');
    await page.locator('.grade-switch-header [data-grade="junior"]').click();
    const after = await page.evaluate(() => ({ level: state.cellLevel, input: document.querySelector('#questionInput').value, tag: document.querySelector('#experimentGradeTag').textContent }));
    check(after.level === 'junior' && after.input === '观察动物细胞的结构示意图，说出细胞膜、细胞质和细胞核的功能。' && after.tag === '初中内容', '切到初中：细胞层跟随，学生的题不改写', after);
    await generate(page, '在电子显微镜下观察动物细胞，说出内质网的功能。');
    await page.locator('.grade-switch-header [data-grade="senior"]').click();
    await page.locator('.grade-switch-header [data-grade="junior"]').click();
    const locked = await page.evaluate(() => ({ level: state.cellLevel, locked: state.cellLevelLocked, tag: document.querySelector('#experimentGradeTag').textContent, other: document.querySelector('#experimentGradeTag').classList.contains('is-other-level') }));
    check(locked.level === 'senior' && locked.locked && locked.tag === '高中内容' && locked.other, '题目写明电子显微镜：保持高中讲法', locked);
    check(!errors.length, '无页面错误', errors);
    await context.close();
  }

  // 5b. 数学 · 二次函数（初中 / 高中）：滑块 b、c，拖 c 看 Δ 变号；与切线模板共用画布
  section = '二次函数';
  for (const width of [1366, 390]) {
    const { context, page, errors } = await fresh({ width, height: 900, storage: { [GRADE_KEY]: 'junior' } });
    await page.locator('.subject-tab[data-subject="数学"]').click();
    const question = await page.locator('#questionInput').inputValue();
    check(/^二次函数 y = x² − 4x \+ 3，/.test(question), `${width}：初中数学默认题为二次函数`, question);
    const menu = await openMenu(page);
    check(!menu.items.some(item => item.id === 'quadratic') && menu.items.some(item => item.id === 'tangent' && item.group === 'other'), `${width}：初中数学菜单把切线放在高中折叠组`, menu.items);
    check(menu.items.find(item => item.id === 'linearSystem')?.block === '方程（组）', `${width}：方程组在初中数学的“方程（组）”组`, menu.items);
    await closeMenu(page);
    await generate(page, question);
    await settle(page);
    const s = await snapshot(page);
    const geo = await mathGraphGeometry(page);
    check(s.tag === '初中内容' && await page.evaluate(() => state.subjectTemplates['数学']) === 'quadratic', `${width}：生成二次函数（初中内容）`, s);
    check(geo.sliders.join() === 'true,true', `${width}：b、c 两个滑块都显示`, geo.sliders);
    check(geo.points.join() === 'vertex,root,root,intercept' && !geo.overlap.length && !geo.clipping.length && geo.minFont >= 11 && geo.pageOverflow <= 1, `${width}：图像标出顶点、两个交点和与 y 轴交点，标注不重叠`, geo);
    check(geo.note === '对称轴 x = 2 · Δ = 4 > 0', `${width}：图上写对称轴与 Δ`, geo.note);
    const text = await visibleText(page);
    check(/y = \(x − 2\)/.test(text) && !/零点|导数/.test(text), `${width}：初中讲法配方求顶点，不出现零点、导数`);
    const ai = await aiContext(page);
    check(ai.mode === 'question' && ai.templateId === '' && ai.deterministicResult.gradeLevel === '初中' && /顶点：\(2, −1\)/.test(ai.deterministicResult.metrics), `${width}：AI 上下文带二次函数结果与初中学段`, ai);
    if (width === 1366) await page.locator('.content-grid').screenshot({ path: resolve(output, `${width}-quadratic-junior.png`) });
    else await page.screenshot({ path: resolve(output, `${width}-quadratic-junior.png`), fullPage: true });
    await setSlider(page, '#accelRange', 4);
    const touching = await mathGraphGeometry(page);
    check(touching.note === '对称轴 x = 2 · Δ = 0' && touching.points.join() === 'vertex,intercept' && touching.view === geo.view, `${width}：c = 4 时 Δ = 0，顶点落在 x 轴上，坐标系不动`, touching);
    await setSlider(page, '#accelRange', 6);
    const apart = await mathGraphGeometry(page);
    check(/Δ = −8 < 0/.test(apart.note) && apart.points.join() === 'vertex,intercept' && /与 x 轴没有交点/.test(await visibleText(page)), `${width}：c = 6 时 Δ < 0，抛物线与 x 轴没有交点`, apart);
    check((await page.locator('#questionInput').inputValue()).includes('y = x² − 4x + 6'), `${width}：拖动滑块后题目同步`);
    await setSlider(page, '#accelRange', 3);
    await page.locator(width === 390 ? '.grade-switch-inline [data-grade="senior"]' : '.grade-switch-header [data-grade="senior"]').click();
    await settle(page);
    const senior = await page.evaluate(() => ({ question: state.generatedQuestion, tag: document.querySelector('#experimentGradeTag').textContent, text: [...document.querySelectorAll('.reasoning-card')].map(node => node.innerText).join('') }));
    check(/^已知函数 f\(x\) = x² − 4x \+ 3，求函数的单调区间/.test(senior.question) && senior.tag === '高中内容' && /单调递减/.test(senior.text) && /零点/.test(senior.text), `${width}：切到高中，预设题换成单调区间与零点的讲法`, senior);
    if (width === 1366) await page.locator('.content-grid').screenshot({ path: resolve(output, `${width}-quadratic-senior.png`) });
    // 切回切线模板：标签、滑块、读屏说明恢复切线图的样子
    await pickPreset(page, 'tangent');
    await generate(page, await page.locator('#questionInput').inputValue());
    await settle(page);
    const tangent = await mathGraphGeometry(page);
    check(tangent.stageLabel.startsWith('动点 P') && tangent.sliders.join() === 'true,false' && tangent.aria === '函数图像、动点 P 与切线' && /切线斜率/.test(tangent.note), `${width}：切线模板恢复动点 P 与单个滑块`, tangent);
    check(!errors.length, `${width}：无页面错误`, errors);
    await context.close();
  }

  // 5c. 数学 · 二元一次方程组 = 两直线交点（初中）：滑块调两个常数项；平行无解、重合无数组解
  section = '方程组';
  for (const width of [1366, 390]) {
    const { context, page, errors } = await fresh({ width, height: 900 });
    await page.locator('.subject-tab[data-subject="数学"]').click();
    await pickPreset(page, 'linearSystem');
    const question = await page.locator('#questionInput').inputValue();
    check(question === '解方程组：2x + y = 5，x − y = 1，并说明它的解与两条直线交点的关系。', `${width}：高中学段也能从折叠组选方程组`, question);
    await generate(page, question);
    await settle(page);
    const s = await snapshot(page);
    const geo = await mathGraphGeometry(page);
    check(s.tag === '初中内容' && s.otherLevel, `${width}：高中学段下标“初中内容”`, s);
    check(geo.points.join() === 'solution' && /交点 \(2, 1\)/.test(geo.labels.join()) && !geo.overlap.length && !geo.clipping.length && geo.sliders.join() === 'true,true', `${width}：两条直线交于 (2, 1)，标注不重叠`, geo);
    check(/① \+ ②，消去 y：3x = 6，x = 2/.test(await visibleText(page)), `${width}：加减消元步骤`);
    await setSlider(page, '#accelRange', 4);
    const moved = await mathGraphGeometry(page);
    check(/交点 \(3, −1\)/.test(moved.labels.join()) && moved.note === '两直线交于 (3, −1)', `${width}：c₂ = 4 时交点移到 (3, −1)`, moved);
    check((await page.locator('#questionInput').inputValue()).includes('x − y = 4'), `${width}：拖动滑块后题目同步`);
    await generate(page, '方程组 x + y = 3，2x + 2y = 8 有解吗？');
    await settle(page);
    const parallel = await mathGraphGeometry(page);
    check(!parallel.points.length && parallel.note === '两直线平行：方程组无解' && /无解/.test(parallel.stageLabel), `${width}：平行无解`, parallel);
    await generate(page, '方程组 x + y = 3，2x + 2y = 6 的解有几组？');
    await settle(page);
    const same = await page.evaluate(() => ({ note: document.querySelector('#mathSlopeNote').textContent, dashed: document.querySelectorAll('#mathGraph .math-line.coincide').length }));
    check(same.note === '两直线重合：方程组有无数组解' && same.dashed === 1, `${width}：重合时第二条直线画成虚线`, same);
    if (width === 1366) await page.locator('.content-grid').screenshot({ path: resolve(output, `${width}-linear-system.png`) });
    const ai = await aiContext(page);
    check(ai.mode === 'question' && /方程组的解：方程组有无数组解/.test(ai.deterministicResult.metrics) && ai.deterministicResult.contentLevel === '初中内容', `${width}：AI 上下文带方程组结果`, ai.deterministicResult);
    check(!errors.length, `${width}：无页面错误`, errors);
    await context.close();
  }

  // 5d. 化学 · 铁 + 硫酸铜：初中按质量比列比例式（含“足量”），高中按物质的量；含物质的量的题锁定高中讲法
  section = '铁与硫酸铜';
  {
    const JUNIOR_CHEM = '将 5.6g 铁粉加入足量的硫酸铜溶液中，充分反应后生成铜的质量是多少？';
    const { context, page, errors } = await fresh({ storage: { [GRADE_KEY]: 'junior' } });
    await page.locator('.subject-tab[data-subject="化学"]').click();
    check(await page.locator('#questionInput').inputValue() === JUNIOR_CHEM, '初中化学默认题：铁与足量硫酸铜');
    await generate(page, JUNIOR_CHEM);
    const junior = await page.evaluate(() => ({
      tag: document.querySelector('#experimentGradeTag').textContent,
      locked: document.querySelector('#accelRange').disabled,
      buttons: [...document.querySelectorAll('#accelRange ~ .number-control button, .parameter:nth-child(2) .number-control button')].every(button => button.disabled),
      value: document.querySelector('#accelParam').textContent,
      ai: buildMasterLabAIContext()
    }));
    const text = await visibleText(page);
    check(junior.tag === '初中内容' && junior.locked && junior.buttons && junior.value === '足量', '“足量”的硫酸铜滑块锁定并显示“足量”', junior);
    check(/设生成铜的质量为 x/.test(text) && /答：生成铜的质量为 6\.4 g/.test(text) && !/mol|物质的量/.test(text), '初中讲法列比例式，不出现物质的量');
    check(junior.ai.mode === 'question' && junior.ai.templateId === '' && junior.ai.deterministicResult.gradeLevel === '初中', '足量题不按协议参数发送 AI 请求', junior.ai);
    await page.locator('.content-grid').screenshot({ path: resolve(output, '1366-chemistry-junior.png') });
    await setSlider(page, '#speedRange', 11.2);
    check((await page.locator('#questionInput').inputValue()) === '将 11.2g 铁粉加入足量的硫酸铜溶液中，充分反应后生成铜的质量是多少？' && /答：生成铜的质量为 12\.8 g/.test(await visibleText(page)), '拖动铁粉质量：题目与结论同步');
    await page.locator('.grade-switch-header [data-grade="senior"]').click();
    await settle(page);
    const senior = await page.evaluate(() => ({ tag: document.querySelector('#experimentGradeTag').textContent, question: document.querySelector('#questionInput').value, text: ScienceFormula.sourceText(document.querySelector('.reasoning-card')) }));
    check(senior.tag === '高中内容' && /n\(Fe\) = m\/M = 11\.2 g ÷ 56 g\/mol = 0\.20 mol/.test(senior.text.replace(/\s+/g, ' ')) && senior.question.includes('11.2g 铁粉加入足量'), '只给质量的题切到高中：同一道题换成物质的量讲法', senior);
    await page.locator('.grade-switch-header [data-grade="junior"]').click();
    await generate(page, '将 8.4g 铁粉加入含 16g 硫酸铜的溶液中，求生成铜的质量。');
    const both = await page.evaluate(() => ({ ai: buildMasterLabAIContext(), p2: state.p2, label: document.querySelector('#paramLabel2').textContent }));
    check(/铁过量/.test(await visibleText(page)) && /剩余铁 2\.8 g/.test(await visibleText(page)), '两种都给出质量：按质量比判断铁过量');
    check(both.ai.templateId === 'fe_cuso4' && both.ai.parameters.ironMass === 8.4 && both.ai.parameters.copperSulfateMass === 16 && both.p2 === 16 && /m\(CuSO/.test(both.label), '初中讲法的硫酸铜滑块按质量（g），AI 参数一致', both);
    await page.locator('.grade-switch-header [data-grade="senior"]').click();
    await settle(page);
    const converted = await page.evaluate(() => ({ p2: state.p2, label: document.querySelector('#paramLabel2').textContent, ai: buildMasterLabAIContext().parameters }));
    check(Math.abs(converted.p2 - 0.1) < 1e-9 && /n\(CuSO/.test(converted.label) && converted.ai.copperSulfateMass === 16, '切到高中：硫酸铜换算成 0.1 mol，AI 参数仍为 16 g', converted);
    await generate(page, '将 5.6g 铁粉加入含有 0.20mol 硫酸铜的溶液中，充分反应。请计算最多生成多少 mol 铜？生成铜的质量是多少？并判断哪种反应物过量。');
    await page.locator('.grade-switch-header [data-grade="junior"]').click();
    await settle(page);
    const swapped = await page.evaluate(() => ({ question: document.querySelector('#questionInput').value, tag: document.querySelector('#experimentGradeTag').textContent }));
    check(swapped.question === JUNIOR_CHEM && swapped.tag === '初中内容', '显示高中预设题时切到初中：换成初中预设题', swapped);
    await generate(page, '将 5.6g 铁粉加入含 0.2mol 硫酸铜的溶液中，求生成铜的质量。');
    const locked = await page.evaluate(() => ({ tag: document.querySelector('#experimentGradeTag').textContent, other: document.querySelector('#experimentGradeTag').classList.contains('is-other-level'), form: state.chemForm }));
    check(locked.tag === '高中内容' && locked.other && locked.form.levelLocked, '初中学段输入含物质的量的题：按高中讲法并标“高中内容”', locked);
    check(!errors.length, '无页面错误', errors);
    await context.close();
  }

  // 5e. 在别的学科里切换学段后，回到已生成实验的学科：恢复的实验也按当前学段换讲法（学生的题不改写）
  section = '恢复实验跟随学段';
  {
    const { context, page, errors } = await fresh();
    await page.locator('.subject-tab[data-subject="生物"]').click();
    await generate(page, '观察动物细胞的结构示意图，说出线粒体的功能。');
    await page.locator('.subject-tab[data-subject="化学"]').click();
    await generate(page, '将 5.6g 铁粉加入足量的硫酸铜溶液中，充分反应后生成铜的质量是多少？');
    await page.locator('.subject-tab[data-subject="物理"]').click();
    await page.locator('.grade-switch-header [data-grade="junior"]').click();
    await page.locator('.subject-tab[data-subject="生物"]').click();
    const cell = await page.evaluate(() => ({ level: state.cellLevel, tag: document.querySelector('#experimentGradeTag').textContent, question: document.querySelector('#questionInput').value }));
    check(cell.level === 'junior' && cell.tag === '初中内容' && cell.question === '观察动物细胞的结构示意图，说出线粒体的功能。', '回到生物：细胞层跟随初中', cell);
    await page.locator('.subject-tab[data-subject="化学"]').click();
    const chem = await page.evaluate(() => ({ level: state.chemForm.level, tag: document.querySelector('#experimentGradeTag').textContent, text: ScienceFormula.sourceText(document.querySelector('.reasoning-card')) }));
    check(chem.level === 'junior' && chem.tag === '初中内容' && /设生成铜的质量为 x/.test(chem.text), '回到化学：只给质量的题换成初中讲法', chem);
    check(!errors.length, '无页面错误', errors);
    await context.close();
  }

  // 6. 各学科菜单只列本学科实验，并按当前学段分组
  section = '各学科菜单';
  {
    for (const level of ['senior', 'junior']) {
      const { context, page, errors } = await fresh({ storage: { [GRADE_KEY]: level } });
      for (const subject of ['化学', '数学', '生物']) {
        await page.locator(`.subject-tab[data-subject="${subject}"]`).click();
        const menu = await openMenu(page);
        const label = level === 'junior' ? '初中' : '高中';
        check(menu.head === `${label} · ${subject}实验`, `${label}${subject}菜单标题`, menu.head);
        check(menu.items.every(item => item.subject === subject), `${label}${subject}菜单只列${subject}实验`, menu.items);
        check(menu.items.length > 0 || menu.empty, `${label}${subject}菜单有实验或说明`, menu);
        await page.locator('#physicsPresetDropdown').screenshot({ path: resolve(output, `1366-menu-${level}-${subject}.png`) });
        await closeMenu(page);
      }
      check(!errors.length, '无页面错误', errors);
      await context.close();
    }
  }

  // 7. 老用户：已保存过收藏的浏览器不显示推荐，切换学段不改收藏
  section = '收藏与推荐';
  {
    const saved = JSON.stringify([{ id: 'saved-1', subject: '物理', question: BRAKE, title: '我的刹车题', detail: '物理', visual: 'brake' }]);
    const { context, page, errors } = await fresh({ storage: { [FAVORITES_KEY]: saved } });
    await page.locator('.grade-switch-header [data-grade="junior"]').click();
    const s = await snapshot(page);
    check(s.favoritesTitle === '已收藏的实验' && !s.recommendations.length, '已有收藏时不显示推荐', s);
    check(await page.evaluate(key => localStorage.getItem(key), FAVORITES_KEY) === saved, '切换学段不改动收藏');
    check(!errors.length, '无页面错误', errors);
    await context.close();
  }

  // 8. 存储不可用或内容损坏：默认高中，本页仍可切换
  section = '存储异常';
  {
    // 隐私模式等情况：读写学段键都抛异常（页面脚本运行前就替换存储接口）
    const blocked = await fresh({
      initArg: GRADE_KEY,
      init: key => {
        const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
        Storage.prototype.getItem = function (name) { if (name === key) throw new DOMException('blocked', 'SecurityError'); return get.call(this, name); };
        Storage.prototype.setItem = function (name, value) { if (name === key) throw new DOMException('blocked', 'QuotaExceededError'); return set.call(this, name, value); };
      }
    });
    check((await snapshot(blocked.page)).level === 'senior', '读不到学段时默认高中');
    await blocked.page.locator('.grade-switch-header [data-grade="junior"]').click();
    const s = await snapshot(blocked.page);
    check(s.level === 'junior' && /无法长期保存/.test(s.toast), '写不进学段时本页仍切换并提示', s);
    check(!blocked.errors.length, '无页面错误', blocked.errors);
    await blocked.context.close();
    const corrupt = await fresh({ storage: { [GRADE_KEY]: 'grade-9' } });
    check((await snapshot(corrupt.page)).level === 'senior', '无法识别的学段值按高中处理');
    await corrupt.context.close();
  }

  // 9. 手机宽度：学段开关移到学科行，页面不横向溢出；菜单不超出屏幕
  section = '手机 390';
  {
    const { context, page, errors } = await fresh({ width: 390, height: 844, storage: { [GRADE_KEY]: 'junior' } });
    const layout = await page.evaluate(() => ({
      header: getComputedStyle(document.querySelector('.grade-switch-header')).display,
      inline: getComputedStyle(document.querySelector('.grade-switch-inline')).display,
      overflow: document.documentElement.scrollWidth - innerWidth,
      button: Math.min(...[...document.querySelectorAll('.grade-switch-inline [data-grade]')].map(node => node.getBoundingClientRect().height))
    }));
    check(layout.header === 'none' && layout.inline !== 'none' && layout.overflow <= 1 && layout.button >= 30, '学段开关在学科行且可点', layout);
    await page.locator('.grade-switch-inline [data-grade="senior"]').click();
    check((await snapshot(page)).level === 'senior', '手机上切换学段');
    await page.locator('.grade-switch-inline [data-grade="junior"]').click();
    await page.screenshot({ path: resolve(output, '390-junior.png') });
    const menu = await openMenu(page);
    check(menu.viewportFits && menu.hint === menu.scrollable, '手机菜单在屏幕内并有滚动提示', menu);
    await page.screenshot({ path: resolve(output, '390-menu-junior.png') });
    check(!errors.length, '无页面错误', errors);
    await context.close();
  }
} catch (error) {
  report.failures.push(`${section}：${error.stack || error}`);
} finally {
  await writeFile(resolve(output, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  server.close();
}
console.log(`Week 2: ${report.checks.length} checks, ${report.failures.length} failures.`);
if (report.failures.length) {
  console.log(report.failures.join('\n'));
  process.exitCode = 1;
}
