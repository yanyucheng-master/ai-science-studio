// Local-only browser QA. No .env, real credentials, or external AI requests.
// Use PLAYWRIGHT_MODULE to point to an existing Playwright installation if needed.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createMasterLabServer } from '../src/server.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
const baseline = process.argv.includes('--baseline');
const output = resolve(root, 'outputs/tutor-sse', baseline ? 'before' : 'after');
await mkdir(output, { recursive: true });
const answer = {
  mode: 'steps', summary: '本题 context.mode=question，parameters 与 deterministicResult 为空。',
  steps: ['已知初速度 v0 = 20 m/s，减速度大小 a = 5 m/s²。',
    '由 v² − v0² = −2as，代入求得 s = 40 m。'],
  formulas: ['s = \\frac{v_{0}^{2}}{2a}'], finalAnswer: '刹车距离为 40 m。',
  checks: ['内部复核专用：代入后末速度为零，距离单位是 m。'],
  followUp: '如果初速度加倍，刹车距离如何变化？', parameterPatch: null,
  warnings: ['AI 讲解可能存在误差，请结合教材与教师要求核对。']
};
const broken = '{"mode":"steps","summary":"先求刹车距离","steps":["代入';
const frame = (delta, finish = null) => `data: ${JSON.stringify({ choices: [{ delta, finish_reason: finish }] })}\n\n`;
let scenario;
let upstreamCalls = [];
let gatewayCalls = 0;
let gatewayBase;
function fixtureAnswer() {
  // Replay the visible content captured from the one real public AI reply.
  // This is a DOM-based fixture, not another paid request or raw API record.
  if (scenario === 'default_live_replay') return { ...answer, summary: '', steps: [
    '取初速度方向为正方向。汽车初速度 v_{0}=20m·s^{-1}，末速度 v=0；刹车加速度大小为 5m·s^{-2}，方向与初速度相反，因此取 a=-5m·s^{-2}。',
    '由匀变速直线运动速度与位移关系 v^{2}-v_{0}^{2}=2as，代入已知量：0^{2}-20^{2}=2×(-5)×s，即 -400=-10s。',
    '解得 s=40m。因此汽车的刹车距离为 40m；同时，汽车刹车加速度大小为 5m·s^{-2}，方向与初速度方向相反。',
    '最终答案：刹车加速度大小为 5m·s^{-2}，方向与初速度方向相反（取初速度方向为正时 a=-5m·s^{-2}）；刹车距离 s=40m。'],
    finalAnswer: '汽车刹车加速度大小为 5m·s^{-2}，方向与初速度方向相反（取初速度方向为正时 a=-5m·s^{-2}）；刹车距离 s=40m。',
    formulas: ['v^{2}-v_{0}^{2}=2as', 's=\\frac{v_{0}^{2}}{2a}（a为刹车加速度大小）'], followUp: '' };
  if (scenario === 'default_concept') return { ...answer, mode: 'explain',
    summary: '植物细胞具有细胞壁，细胞膜控制物质进出。', steps: [], formulas: [],
    finalAnswer: '植物细胞具有细胞壁，细胞膜控制物质进出。' };
  if (scenario === 'default_clarification') return { ...answer, mode: 'clarification',
    summary: '题目没有给出物体质量，无法确定合力的数值。',
    steps: ['已知加速度仍不足以计算合力。'], formulas: ['F=ma'], finalAnswer: null,
    followUp: '请补充物体的质量是多少。', warnings: ['关键条件不足：缺少物体质量。'] };
  if (scenario === 'default_warning') return { ...answer, warnings: [...answer.warnings,
    '完整性提醒：当前回答未明确覆盖产生的热量。', '该公式仅适用于加速度恒定的阶段。'] };
  if (scenario === 'default_multi_goals') return { ...answer, steps: [
    '根据速度变化，加速度 a=3 m·s^{-2}。', '由 F=ma 得 F=6 N，由 W=Fs 得 W=36 J。'],
    formulas: ['F=ma', 'F = ma', 'W=Fs', 'W=ΔE_{k}'],
    finalAnswer: '加速度为 3 m·s^{-2}，合力为 6 N，做功为 36 J。' };
  if (scenario === 'default_mobile_long_formula') return { ...answer,
    formulas: ['a(v)=\\frac{F-\\frac{B^{2}L^{2}v}{R}}{m}', 'v_{临界}=\\frac{FR}{B^{2}L^{2}}'] };
  if (scenario === 'default_safe_math') return { ...answer,
    steps: [...answer.steps, '<img src="invalid" onerror="window.fixtureUnsafe=true"> 仅作为文本处理。'],
    formulas: [...answer.formulas, '<svg onload="window.fixtureUnsafe=true">'] };
  return answer;
}
const mime = { html: 'text/html', css: 'text/css', js: 'text/javascript' };
const webFiles = new Set(['index.html', 'styles.css', 'app.js', 'physics-extra.js', 'science-motion.js', 'ai-tutor.js']);
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/fixture/chat/completions') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    upstreamCalls.push({ stream: body.stream, thinking: body.thinking.type, model: body.model,
      reasoningEffort: body.reasoning_effort, maxTokens: body.max_tokens });
    if (scenario === 'personal_auth_failure') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end('{"error":"fixture invalid personal credential"}');
      return;
    }
    const first = upstreamCalls.length === 1;
    if (body.stream) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' });
      res.flushHeaders();
      if (scenario === 'timeout' || scenario === 'stop') {
        res.write(frame({ reasoning_content: '本地测试：等待响应。' }));
        return;
      }
      const hint = body.messages.at(-1).content.includes('"responseLevel":"hint"');
      const content = ['invalid_twice', 'fallback_recovered'].includes(scenario) && first ? broken : JSON.stringify(hint
        ? { ...answer, mode: 'hint', summary: '先观察末速度是否为零，再选择运动学公式。', steps: [], finalAnswer: null }
        : answer);
      const finish = content === broken ? 'length' : 'stop';
      const bodyText = scenario === 'missing_tail'
        ? frame({ content }, finish).trimEnd()
        : frame({ reasoning_content: '本地测试：核对已知条件。' }) + frame({ content }, finish) + 'data: [DONE]\n\n';
      const bytes = Buffer.from(bodyText.replaceAll('\n', '\r\n'));
      for (let i = 0; i < bytes.length; i += 11) {
        if (res.destroyed) break;
        res.write(bytes.subarray(i, i + 11));
        await new Promise(resolve => setTimeout(resolve, 1));
      }
      res.end();
      return;
    }
    const content = scenario === 'invalid_twice' ? broken : JSON.stringify(body.messages.at(-1).content.includes('"responseLevel":"hint"')
      ? { ...answer, mode: 'hint', summary: '先观察末速度是否为零，再选择运动学公式。', steps: [], finalAnswer: null }
      : answer);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }));
    return;
  }
  const name = path === '/' ? 'index.html' : path.slice(1);
  if (!webFiles.has(name)) { res.writeHead(204); res.end(); return; }
  let body = await readFile(resolve(root, 'web', name), 'utf8');
  if (name === 'ai-tutor.js') {
    body = body.replace('const DEEPSEEK_BASE_URL = "https://api.deepseek.com";',
      'const DEEPSEEK_BASE_URL = window.location.origin + "/fixture";');
  }
  res.writeHead(200, { 'Content-Type': `${mime[name.split('.').at(-1)]}; charset=utf-8`, 'Cache-Control': 'no-store' });
  res.end(body);
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const gateway = createMasterLabServer({ deepSeekClient: {
  get configured() { return scenario?.startsWith('default_') || scenario?.startsWith('personal_'); },
  async chat() {
    gatewayCalls += 1;
    if (scenario === 'default_unavailable') throw Object.assign(new Error('fixture unavailable'), { code: 'AI_UNAVAILABLE' });
    return fixtureAnswer();
  }
}, allowedOrigins: [base] });
gateway.listen(0, '127.0.0.1');
await once(gateway, 'listening');
gatewayBase = `http://127.0.0.1:${gateway.address().port}`;
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const reports = [];
try {
  for (scenario of ['full_steps', 'missing_tail', 'invalid_twice', 'fallback_recovered', 'hint', 'timeout', 'stop', 'no_key_experiment', 'no_key_question', 'default_question', 'default_unavailable', 'personal_auth_failure', 'personal_cleared',
    'default_concept', 'default_clarification', 'default_warning', 'default_multi_goals',
    'default_mobile_steps', 'default_mobile_long_formula', 'default_safe_math', 'default_live_replay']) {
    upstreamCalls = [];
    gatewayCalls = 0;
    const noKey = scenario.startsWith('no_key') || scenario.startsWith('default_');
    const mobile = scenario.startsWith('default_mobile');
    const context = await browser.newContext({ viewport: mobile ? { width: 375, height: 812 } : { width: 1366, height: 900 },
      reducedMotion: mobile ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    const consoleErrors = [];
    const network = [];
    page.on('pageerror', error => consoleErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('response', response => {
      if (/completions|tutor\/chat/.test(response.url())) network.push({
        path: new URL(response.url()).pathname, status: response.status(), type: response.headers()['content-type']
      });
    });
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue() : route.fulfill({ status: 204, body: '' }));
    await page.addInitScript(({ gatewayBase, noKey }) => {
      window.MASTER_LAB_API_URL = gatewayBase;
      const original = Storage.prototype.getItem;
      const remove = Storage.prototype.removeItem;
      let sentinel = noKey ? null : 'test-only';
      Storage.prototype.getItem = function (name) {
        // An in-memory, non-credential sentinel selects the browser branch; nothing is saved.
        if (name === 'masterLab.deepseekApiKey') return sentinel;
        return original.call(this, name);
      };
      Storage.prototype.removeItem = function (name) {
        if (name === 'masterLab.deepseekApiKey') { sentinel = null; return; }
        return remove.call(this, name);
      };
    }, { gatewayBase, noKey });
    await page.goto(base);
    if (scenario === 'personal_cleared') {
      await page.evaluate(() => window.MasterLabAITutor.openApiKeySettings());
      await page.locator('#apiKeyClearButton').click();
      await page.locator('#apiKeyModalClose').click();
    }
    if (scenario === 'no_key_experiment') {
      await page.locator('#generateButton').click();
      await page.waitForFunction(() => window.MasterLabAIHost?.getContext?.().mode === 'experiment');
    }
    // Exercise the same visible entry point as a visitor, not just its JS API.
    await page.locator('#mentorOpenPageButton').click();
    await page.waitForURL('**/#/ai-tutor');
    if (scenario === 'timeout') await page.clock.install();
    await page.locator(`[data-ai-action="${scenario === 'hint' ? 'hint' : 'steps'}"]`).click();
    if (scenario === 'timeout' || scenario === 'stop') {
      await page.waitForFunction(() => document.querySelector('.ai-thinking-trace-text')?.textContent.includes('本地测试'));
      if (scenario === 'timeout') await page.clock.fastForward(540001);
      else await page.locator('#aiTutorStopButton').click();
    }
    await page.waitForFunction(() => document.querySelector('#aiTutorWorkspace')?.getAttribute('aria-busy') === 'false');
    const ui = await page.evaluate(() => ({
      status: document.querySelector('#aiTutorStatus').textContent,
      text: document.querySelector('#aiTutorMessages').innerText,
      error: Boolean(document.querySelector('.ai-message.error')),
      steps: document.querySelectorAll('.ai-answer-section ol li').length,
      fractions: document.querySelectorAll('.ai-safe-fraction').length,
      subscripts: document.querySelectorAll('.ai-message.assistant sub').length,
      final: document.querySelector('.ai-final-step')?.innerText || '',
      appendedResults: document.querySelectorAll('.ai-step-result').length,
      oldSections: document.querySelectorAll('.final-section, .check-section').length,
      followUps: document.querySelectorAll('.ai-follow-up').length,
      warning: document.querySelector('.ai-answer-warning')?.innerText || '',
      formulas: document.querySelectorAll('.ai-formula-line').length,
      bodySize: parseFloat(getComputedStyle(document.querySelector('.ai-message.assistant .ai-message-bubble')).fontSize),
      formulaSize: document.querySelector('.ai-formula-line') ? parseFloat(getComputedStyle(document.querySelector('.ai-formula-line')).fontSize) : 0,
      formulaBackground: document.querySelector('.ai-formula-line') ? getComputedStyle(document.querySelector('.ai-formula-line')).backgroundColor : '',
      horizontalOverflow: [...document.querySelectorAll('#aiTutorWorkspace, .ai-message.assistant .ai-message-bubble')]
        .some(node => node.scrollWidth > node.clientWidth + 2),
      unsafeNodes: document.querySelectorAll('.ai-message.assistant img, .ai-message.assistant svg, .ai-message.assistant script').length,
      unsafeExecuted: Boolean(window.fixtureUnsafe),
      provider: (node => node && !node.hidden ? node.textContent : '')(document.querySelector('.ai-tutor-identity .online')),
      pending: Boolean(document.querySelector('.ai-message.pending')),
      busy: document.querySelector('#aiTutorWorkspace').getAttribute('aria-busy'),
      sendEnabled: !document.querySelector('#aiTutorSendButton').disabled
    }));
    await page.locator('#aiTutorWorkspace').screenshot({ path: resolve(output, `${scenario}.png`) });
    reports.push({ scenario, upstreamCalls: [...upstreamCalls], gatewayCalls, network, consoleErrors, ui });
    await context.close();
  }
  await writeFile(resolve(output, 'report.json'), JSON.stringify(reports, null, 2));
  for (const report of reports) console.log(JSON.stringify(report));
  if (!baseline) {
    for (const report of reports) {
      const { scenario: name, upstreamCalls: calls, ui } = report;
      assert.equal(ui.busy, 'false', name);
      assert.equal(ui.sendEnabled, true, name);
      assert.equal(ui.pending, false, name);
      assert.doesNotMatch(ui.text, /\{"mode"|"summary"\s*:/, name);
      assert.equal(ui.oldSections, 0, name);
      assert.doesNotMatch(ui.text, /结果自检|内部复核专用|context\.mode|deterministicResult/, name);
      assert.equal(ui.bodySize, 14, name);
      assert.ok(ui.formulaSize <= ui.bodySize, name);
      assert.equal(ui.horizontalOverflow, false, name);
      if (ui.formulas) assert.equal(ui.formulaBackground, 'rgba(0, 0, 0, 0)', name);
      if (name !== 'hint' && name !== 'default_clarification') assert.equal(ui.followUps, 0, name);
      for (const call of calls) {
        assert.equal(call.model, 'deepseek-flash', name);
        assert.equal(call.thinking, 'enabled', name);
        assert.equal(call.reasoningEffort, 'max', name);
      }
      if (['full_steps', 'missing_tail'].includes(name)) {
        assert.equal(ui.steps, 2, name);
        assert.match(ui.final, /40 m/, name);
        assert.ok(ui.fractions > 0 && ui.subscripts > 0, name);
        assert.equal(calls.length, 1, name);
      }
      if (['fallback_recovered', 'invalid_twice'].includes(name)) {
        assert.equal(ui.error, true); assert.equal(calls.length, 1);
        assert.doesNotMatch(ui.text, /已改用快速模式重新生成/);
      }
      if (name === 'hint') { assert.equal(calls.length, 1); assert.equal(calls[0].stream, true); assert.equal(ui.final, ''); }
      if (['timeout', 'stop'].includes(name)) { assert.equal(calls.length, 1); assert.equal(ui.error, true); }
      if (name === 'timeout') assert.match(ui.text, /已超时/);
      if (name === 'stop') assert.match(ui.text, /已停止/);
      if (name === 'no_key_experiment') { assert.equal(calls.length, 0); assert.match(ui.text, /大师 · 本地提示/); }
      if (name === 'no_key_question') { assert.equal(calls.length, 0); assert.equal(ui.error, true); }
      if (['default_question', 'personal_cleared'].includes(name)) {
        assert.equal(calls.length, 0); assert.equal(report.gatewayCalls, 1);
        assert.equal(ui.error, false); assert.match(ui.final, /40 m/);
        assert.equal(ui.provider, '', name); // 默认（公益）模式不显示状态行
      }
      if (name === 'default_unavailable') {
        assert.equal(calls.length, 0); assert.equal(report.gatewayCalls, 1);
        assert.equal(ui.error, true); assert.match(ui.text, /公益默认.*可能余额不足或临时故障/);
      }
      if (name === 'personal_auth_failure') {
        assert.equal(calls.length, 1); assert.equal(report.gatewayCalls, 0);
        assert.equal(ui.error, true); assert.match(ui.text, /不会切换到公益默认服务/);
      }
      if (name.startsWith('default_') && !['default_unavailable'].includes(name)) {
        assert.equal(report.gatewayCalls, 1, name);
        assert.equal(calls.length, 0, name);
        assert.equal(ui.error, false, name);
      }
      if (name === 'default_concept') {
        assert.equal(ui.formulas, 0, name);
        assert.match(ui.final, /植物细胞.*细胞壁.*细胞膜/, name);
      }
      if (name === 'default_clarification') {
        assert.match(ui.text, /题目没有给出物体质量/, name);
        assert.match(ui.text, /请补充物体的质量/, name);
        assert.match(ui.warning, /关键条件不足/, name);
      }
      if (name === 'default_warning') {
        assert.match(ui.warning, /完整性提醒.*热量/, name);
        assert.match(ui.warning, /加速度恒定/, name);
        assert.doesNotMatch(ui.warning, /AI 讲解可能存在误差/, name);
      }
      if (name === 'default_multi_goals') {
        assert.equal(ui.formulas, 3, name);
        assert.match(ui.final, /3 m.*6 N.*36 J/, name);
      }
      if (name === 'default_live_replay') {
        assert.equal(ui.appendedResults, 0, name);
        assert.equal(ui.steps, 4, name);
        assert.match(ui.final, /刹车距离 s=40m/, name);
        assert.match(ui.final, /a=[−-]5m/, name);
      }
      if (name === 'default_safe_math') {
        assert.equal(ui.unsafeNodes, 0, name);
        assert.equal(ui.unsafeExecuted, false, name);
      }
      assert.equal(report.consoleErrors.filter(message => !/503|401/.test(message)).length, 0, name);
    }
  }
} finally {
  await browser.close();
  server.closeAllConnections();
  gateway.closeAllConnections();
  await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => gateway.close(resolve))]);
}
