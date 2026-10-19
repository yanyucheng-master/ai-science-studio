// Regression contract: mapping always precedes scenes; no credentials or real AI.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = process.env.INSTANT_BROWSER_OUTPUT || resolve(root, 'artifacts/instant-routing');
await mkdir(output, { recursive: true });
const web = resolve(root, 'web'), mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const file = resolve(web, decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1) || 'index.html');
  if (!file.startsWith(web + sep)) { res.writeHead(400); res.end(); return; }
  try { const bytes = await readFile(file); res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }); res.end(bytes); }
  catch { res.writeHead(404); res.end(); }
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const question = '一辆车的速度是20米每秒，刹车时加速度大小为5米每二次方秒，刹车距离是多少？';
const mapped = { schemaVersion: '1.0', mode: 'experiment', title: '刹车距离', answer: '由本地实验计算。', plan: { schemaVersion: '1.0', title: '刹车距离', subject: '物理', modules: [{ id: 'm1', templateId: 'brake', parameters: { initialSpeed: 20, deceleration: 5 } }], links: [], steps: [] }, visual: { kind: 'none', title: '' } };
const cases = ['gateway', 'personal-key', 'no-ai', 'gateway-offline-fallback', 'gateway-decline', 'gateway-scene-error', 'personal-decline'];
const report = { browser: browser.version(), cases: [] };
try {
  for (const name of cases) {
    const fallback = /decline|scene-error/.test(name);
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: 'reduce' });
    await context.addInitScript(({ base, direct }) => { window.MASTER_LAB_API_URL = base; if (direct) localStorage.setItem('masterLab.deepseekApiKey', 'fixture-only-never-valid'); }, { base, direct: name.startsWith('personal') });
    const page = await context.newPage(), entry = { name, mapping: 0, scenes: 0, tutor: 0, errors: [], order: [] };
    page.on('pageerror', e => entry.errors.push(e.message));
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
      const noMapping = { mode: 'explanation', title: '未匹配', answer: '暂无模板', plan: null };
      const answer = { mode: 'steps', summary: '依据初速度和减速度求刹车距离。', steps: ['初速度为20m/s，减速度大小为5m/s²。', '由速度位移公式求得刹车距离40m。'], formulas: [], finalAnswer: '40m', checks: [], followUp: '', warnings: [], parameterPatch: null };
      if (url.pathname === '/health') return json({ ok: true, aiAvailable: false }); // a health hint must not suppress mapping
      if (url.pathname === '/api/v1/experiment/generate') {
        entry.mapping++; entry.order.push('mapping');
        assert.equal(request.postDataJSON().question, question);
        if (name === 'no-ai') return json({ error: 'AI_NOT_CONFIGURED' }, 503);
        if (name === 'gateway-offline-fallback') return json({ mode: 'explanation', source: 'local_fallback', plan: null });
        if (fallback) return json(noMapping);
        return json(mapped);
      }
      if (url.pathname === '/chat/completions') {
        const body = request.postDataJSON(); assert.equal(request.headers().authorization, 'Bearer fixture-only-never-valid');
        let payload = mapped;
        if (body.messages[0].content.includes('科学可视化设计师')) { entry.scenes++; entry.order.push('scene'); payload = { version: 1, status: 'declined', reason: '缺少附图，无法确定画面关系。' }; }
        else if (body.messages[0].content.includes('AI 导师')) { entry.tutor++; payload = answer; }
        else { entry.mapping++; entry.order.push('mapping'); if (fallback) payload = noMapping; }
        return json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(payload) } }] });
      }
      if (url.pathname === '/api/v1/scene/generate') { entry.scenes++; entry.order.push('scene'); return json({ mode: 'explanation', code: name === 'gateway-scene-error' ? 'INVALID_SCENE' : 'DECLINED', reason: '缺少附图，无法确定画面关系。' }); }
      if (url.pathname === '/api/v1/tutor/chat') { entry.tutor++; return fallback ? json(answer) : json({ error: 'AI_NOT_CONFIGURED' }, 503); }
      if (url.origin !== base) return route.fulfill({ status: 204, body: '' });
      return route.continue();
    });
    try {
      await page.goto(base); await page.waitForFunction(() => window.MasterLabInstant && window.MasterLabAITutor);
      await page.locator('#questionInput').fill(question); await page.locator('#generateButton').click();
      await page.waitForFunction(() => !document.querySelector('#generateButton').classList.contains('loading'));
      if (fallback && await page.locator('#aiTutorBackButton').isVisible()) await page.locator('#aiTutorBackButton').click();
      entry.state = await page.evaluate(() => ({ generated: state.hasGenerated, template: state.physicsTemplate, original: state.generatedQuestion, input: document.querySelector('#questionInput').value, parameters: [state.p1, state.p2], context: window.MasterLabAIHost.getContext(), feedback: document.querySelector('#parseFeedback').textContent }));
      entry.panelVisible = await page.locator('#instantExperiment').isVisible();
      if (fallback) {
        // Assert the failure UI independently of mapping so the old build proves
        // the lost refusal and stale-building-panel bugs, not just routing order.
        if (name.includes('decline')) assert.match(entry.state.feedback, /缺少附图，无法确定画面关系/);
        assert.equal(entry.panelVisible, false, 'no stale building panel after returning');
        assert.equal(await page.locator('#instantCanvas svg').count(), 0);
        assert.equal(entry.scenes, 1); assert.equal(entry.tutor, 1);
      } else { assert.equal(entry.mapping, 1); assert.equal(entry.scenes, 0); assert.equal(entry.tutor, 0); assert.equal(entry.panelVisible, false); }
      assert.deepEqual(entry.errors, []);
      if (['gateway', 'personal-key'].includes(name)) {
        assert.equal(entry.state.generated, true); assert.equal(entry.state.template, 'brake'); assert.equal(entry.state.original, question); assert.deepEqual(entry.state.parameters, [20, 5]); assert.equal(entry.state.context.originalQuestion, question);
      } else if (!fallback) { assert.equal(entry.state.input, question); assert.match(entry.state.feedback, /密钥|暂不可用/); }
      entry.pass = true; console.log(`PASS ${name}`);
    } catch (error) { entry.pass = false; entry.failure = error.stack; console.error(`FAIL ${name}: ${error.message}`); process.exitCode = 1; }
    finally { await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true }); report.cases.push(entry); await context.close(); }
  }
} finally { await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n'); await browser.close(); server.close(); }
