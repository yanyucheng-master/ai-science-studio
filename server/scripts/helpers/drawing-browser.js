// Shared, offline-only harness for the current drawing UI contract.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';

export const inclineQuestion = '一个物块静止在左低右高的粗糙斜面上，除重力和斜面对它的接触力外，不受其他外力。请画出物块的受力示意图，分别标注重力、支持力和静摩擦力，只表示方向，不设定质量、角度或力的数值。';
export const unsupportedQuestion = '画两条互相垂直的线段，仅用来说明垂直关系，不求长度或角度数值。';
export const mappedQuestion = '一辆车的速度是20米每秒，刹车时加速度大小为5米每二次方秒，刹车距离是多少？';
export const mapped = { schemaVersion: '1.0', mode: 'experiment', title: '刹车距离', answer: '由本地实验计算。', plan: { schemaVersion: '1.0', title: '刹车距离', subject: '物理', modules: [{ id: 'm1', templateId: 'brake', parameters: { initialSpeed: 20, deceleration: 5 } }], links: [], steps: [] }, visual: { kind: 'none', title: '' } };
export const noMapping = { mode: 'explanation', title: '未匹配', answer: '暂无模板', plan: null };
export const textAnswer = { mode: 'explain', summary: '依据原题分析；当前不支持的图示保留文字讲解，不从示意图测量数值。', steps: [], formulas: [], finalAnswer: null, checks: [], followUp: '', warnings: [], parameterPatch: null };

export async function createDrawingHarness(output) {
  const root = fileURLToPath(new URL('../../../', import.meta.url)), web = resolve(root, 'web');
  output = resolve(root, output);
  await mkdir(output, { recursive: true });
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
  const server = createServer(async (req, res) => {
    try {
      const file = resolve(web, decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1) || 'index.html');
      if (!file.startsWith(web + sep)) { res.writeHead(400); res.end(); return; }
      const bytes = await readFile(file);
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(bytes);
    } catch { res.writeHead(404); res.end(); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
  let browser;
  try { browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true }); }
  catch (error) { await new Promise(r => server.close(r)); throw error; }
  const report = { browser: browser.version(), mockOnly: true, cases: [] };

  async function run(name, action, { personal = false, width = 1366, search = '', mapping = 'none', touch = false } = {}) {
    const context = await browser.newContext({ viewport: { width, height: 960 }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const row = { name, mapping: 0, scenes: 0, tutor: 0, order: [], errors: [], unexpected: [] };
    // Only synthetic credentials in a new context; never use the user's profile.
    await context.addInitScript(({ base, personal }) => {
      window.MASTER_LAB_API_URL = base;
      if (personal) localStorage.setItem('masterLab.deepseekApiKey', 'fixture-only-never-valid');
    }, { base, personal });
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      const record = kind => { row[kind]++; row.order.push(kind); row.lastQuestion = req.postDataJSON().question; };
      if (url.origin === base && url.pathname === '/health') return json({ ok: true, aiConfigured: true, aiAvailable: false });
      if (url.origin === base && url.pathname.startsWith('/api/')) {
        assert.equal(req.headers().authorization, undefined, 'personal credentials must not reach the gateway');
        if (url.pathname === '/api/v1/scene/generate') { record('scenes'); return json({ error: 'UNEXPECTED_COORDINATE_REQUEST' }, 500); }
        if (url.pathname === '/api/v1/experiment/generate') {
          record('mapping'); row.mappingQuestion = row.lastQuestion;
          if (mapping === 'offline') return json({ error: 'AI_NOT_CONFIGURED' }, 503);
          return json(mapping === 'mapped' ? mapped : mapping === 'local-fallback' ? { ...noMapping, source: 'local_fallback' } : noMapping);
        }
        if (url.pathname === '/api/v1/tutor/chat') { record('tutor'); row.lastChat = req.postDataJSON(); return json(textAnswer); }
        row.unexpected.push(req.url()); return json({ error: 'UNEXPECTED_API' }, 500);
      }
      if (url.origin === 'https://api.deepseek.com' && url.pathname === '/chat/completions') {
        const body = req.postDataJSON(), system = body.messages[0].content;
        assert.equal(req.headers().authorization, 'Bearer fixture-only-never-valid');
        let payload;
        if (system.includes('科学可视化设计师')) { record('scenes'); payload = { version: 1, status: 'declined', reason: '旧坐标端点不应被请求。' }; }
        else if (system.includes('AI 导师')) { record('tutor'); row.lastChat = body; payload = textAnswer; }
        else { record('mapping'); row.mappingQuestion = body.messages.at(-1).content; payload = mapping === 'mapped' ? mapped : noMapping; }
        return json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(payload) } }] });
      }
      // Fonts are optional UI resources, supplied empty so QA stays offline.
      if (['fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname)) return route.fulfill({ status: 200, body: '' });
      if (url.origin !== base) { row.unexpected.push(req.url()); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', e => row.errors.push(e.message));
    try {
      await page.goto(base + '/' + search);
      await page.waitForFunction(() => window.MasterLabInstant && window.MasterLabAITutor);
      if (!search.includes('demo=1')) await page.evaluate(() => { if (state.autoDemoTimer) clearTimeout(state.autoDemoTimer); });
      await action({ page, row, context });
      assert.equal(row.scenes, 0, 'current frontend must never request AI coordinates');
      assert.deepEqual(row.unexpected, [], 'all network traffic must stay within explicit fixture routes');
      assert.deepEqual(row.errors, []);
      row.pass = true; console.log('PASS ' + name);
    } catch (error) { row.pass = false; row.failure = error.stack; process.exitCode = 1; console.error('FAIL ' + name + ': ' + error.message); }
    finally {
      try { await page.screenshot({ path: resolve(output, name + '.png'), fullPage: true }); }
      finally { report.cases.push(row); await context.close(); }
    }
  }
  async function close() {
    try { await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n'); }
    finally { await browser.close(); await new Promise(r => server.close(r)); }
  }
  return { run, close, output };
}

export async function generate(page, question) {
  await page.locator('#questionInput').fill(question); await page.locator('#generateButton').click();
  await page.waitForFunction(() => !document.querySelector('#generateButton').classList.contains('loading'));
}
