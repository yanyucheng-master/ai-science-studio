import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import Core from '../../web/instant-scene.js';
import Incline from '../../web/incline-diagram.js';

const source = (await readFile(new URL('../../web/ai-tutor.js', import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
const checks = await readFile(new URL('../../web/tutor-checks.js', import.meta.url), 'utf8');
function load(fetchImpl = () => { throw new Error('Unexpected network'); }) {
  const node = { addEventListener() {}, before() {} };
  const sandbox = { document: { body: { append() {} }, querySelector: () => node, querySelectorAll: () => [],
    createComment: () => ({}), addEventListener() {} }, localStorage: { getItem: () => 'fixture-only' },
    AbortController, TextDecoder, TextEncoder, Response, fetch: fetchImpl, setTimeout, clearTimeout,
    location: { hostname: 'localhost' }, addEventListener() {}, MasterLabInstantScene: Core };
  sandbox.window = sandbox;
  vm.runInNewContext(checks, sandbox);
  vm.runInNewContext(source.replace(/\n  initializeTutor\(\);/, '\n  globalThis.api = { completeTutorChat, getAnswerPresentation, gatewayChatRequest, answerPlainText, savedSession, state };'), sandbox);
  return sandbox.api;
}
const answer = { mode: 'steps', summary: '', steps: [String.raw`列式：由 \(G=mg\) 计算重力。`,
  String.raw`代入：\(G=2\times10=20\,\mathrm{N}\)。`, '结论：重力为20 N，方向竖直向下。'],
  formulas: ['G=mg', String.raw`N=mg\cos\theta`], finalAnswer: '重力为20 N，方向竖直向下。', checks: ['已核算'], warnings: [] };

test('presentation: provider reasoning and elapsed thinking never become saved, copied or returned teaching content', async () => {
  const secret = 'PRIVATE_REASONING_SENTINEL';
  const frame = delta => `data: ${JSON.stringify({ choices: [{ delta, finish_reason: null }] })}\n\n`;
  const api = load(async () => new Response(frame({ reasoning_content: secret }) + frame({ content: JSON.stringify(answer) }) +
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } }));
  const result = await api.completeTutorChat([], { responseLevel: 'steps' }, { thinking: true, timeoutMs: 1000, maxTokens: 16000 });
  assert.equal(result.finalAnswer, answer.finalAnswer);
  assert.equal(result.reasoning || '', '', 'provider reasoning must not remain in an answer payload');
  assert.equal(result.thinkingSeconds, undefined);
  assert.doesNotMatch(api.answerPlainText(result, { responseLevel: 'steps' }), new RegExp(secret));
  const saved = api.savedSession({ id: 'presentation', context: {}, messages: [{ role: 'assistant', payload: result, level: 'steps' }] });
  assert.doesNotMatch(JSON.stringify(saved), new RegExp(secret));
});

test('presentation: full solutions omit already shown formulas but retain missing relationships and subanswers', () => {
  const api = load(), shown = api.getAnswerPresentation(answer, { responseLevel: 'steps' });
  assert.deepEqual(Array.from(shown.formulas), [String.raw`N=mg\cos\theta`]);
  assert.equal(shown.steps.length, 3);
  assert.equal(shown.result, '');
  const multi = api.getAnswerPresentation({ ...answer, finalAnswer: '重力20 N；支持力约17.3 N。' }, { responseLevel: 'steps' });
  assert.match(multi.result, /17.3/);
});

test('presentation: old gateway receives the same concise final-answer and no-character-diagram rules', () => {
  const api = load();
  for (const responseLevel of ['hint', 'explain', 'steps', 'check', 'variant']) {
    const request = api.gatewayChatRequest({ message: '测试题', responseLevel, context: {}, history: [] });
    assert.match(request.message, /不展示.*思考/);
    assert.match(request.message, /字符画/);
    assert.match(request.message, /正文.*重复|重复.*正文/);
    assert(request.message.length < 2000);
  }
});

test('acceptance bank: all supported numeric scenes keep original evidence; unsupported cases stay text', async () => {
  const bank = JSON.parse(await readFile(new URL('../eval/tutor-acceptance-bank.json', import.meta.url), 'utf8'));
  for (const row of bank.filter(row => row.scene === 'incline')) {
    const result = Incline.createScene(row.q);
    assert.equal(result.mode, row.expect === 'draw' ? 'instant' : 'explanation', row.id);
    if (row.expect !== 'draw') continue;
    assert.deepEqual(result.annotations.map(a => a.text), row.labels, row.id);
    assert(result.annotations.every(a => row.q.includes(a.quote)), row.id);
    assert.deepEqual(result.scene.calculations, [], row.id);
    assert.equal(result.forces.length, 3, row.id);
  }
});
