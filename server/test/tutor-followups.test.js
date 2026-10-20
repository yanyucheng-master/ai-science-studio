import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import Scene from '../../web/instant-scene.js';

const source = (await readFile(new URL('../../web/ai-tutor.js', import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
const checks = await readFile(new URL('../../web/tutor-checks.js', import.meta.url), 'utf8');
function load(fetchImpl = () => { throw new Error('Unexpected network'); }) {
  const node = { addEventListener() {}, before() {} };
  const sandbox = { document: { body: { append() {} }, querySelector: () => node, querySelectorAll: () => [],
    createComment: () => ({}), addEventListener() {} }, localStorage: { getItem: () => 'fixture-only-never-valid' },
    AbortController, TextDecoder, TextEncoder, Response, fetch: fetchImpl, setTimeout, clearTimeout,
    location: { hostname: 'localhost' }, addEventListener() {}, MasterLabInstantScene: Scene };
  sandbox.window = sandbox;
  vm.runInNewContext(checks, sandbox);
  vm.runInNewContext(source.replace(/\n  initializeTutor\(\);/, `
    globalThis.testApi = { extractJsonObject, completeTutorChat, savedSession,
      diagramSuggestedQuestions: typeof diagramSuggestedQuestions === 'function' ? diagramSuggestedQuestions : null };`), sandbox);
  return sandbox.testApi;
}
const rawMath = String.raw`{"mode":"explain","summary":"将端点代入 \\(y=|x-1|+0.5\\)。区间为 \(-2\le x\le4\)，端点为 \((-2,3.5)\) 与 \((4,3.5)\)。","steps":[],"formulas":["\frac{1}{2}","\theta+\beta","\sqrt{2}"],"finalAnswer":null}`;

test('followups: completed JSON repairs only known single-escaped math without corrupting valid escapes', () => {
  const api = load(), parsed = api.extractJsonObject(rawMath);
  assert.ok(parsed, 'a complete response with textbook math must be readable');
  assert.match(parsed.summary, /\\\(-2\\le x\\le4\\\)/);
  assert.equal(parsed.formulas[0], String.raw`\frac{1}{2}`);
  assert.equal(parsed.formulas[1], String.raw`\theta+\beta`);
  const value = { mode: 'explain', summary: '第一行\n第二行 "引号" \\(x\\le4\\) 与 C:\\notes\\file', formulas: ['\\frac{1}{2}'] };
  assert.deepEqual(JSON.parse(JSON.stringify(api.extractJsonObject(JSON.stringify(value)))), value);
});

test('followups: math repair never completes truncated or unknown invalid JSON', () => {
  const api = load();
  for (const raw of [rawMath.slice(0, -1), String.raw`{"summary":"\unknown{x}"}`, '{"summary":"未完成',
    '{"summary":"完成", "steps": [broken]}']) {
    assert.equal(api.extractJsonObject(raw), null, raw);
  }
});

test('followups: a completed mathematical SSE reply succeeds once at the requested thinking level', async () => {
  let calls = 0;
  const api = load(async () => {
    calls++;
    return new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: rawMath }, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`,
      { headers: { 'Content-Type': 'text/event-stream' } });
  });
  const result = await api.completeTutorChat([], { responseLevel: 'explain', message: String.raw`若观察区间改为 \(-2\le x\le4\)，图像的端点坐标会怎样变化？` },
    { thinking: true, timeoutMs: 1000 });
  assert.equal(calls, 1, 'no second request or lower-thinking fallback');
  assert.match(result.summary, /3\.5/);
});

test('followups: truncated math stays rejected before JSON repair', async () => {
  const api = load(async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: rawMath } }] }),
    { headers: { 'Content-Type': 'application/json' } }));
  await assert.rejects(api.completeTutorChat([], { responseLevel: 'steps' }, { thinking: true, timeoutMs: 1000 }), { code: 'INVALID_AI_RESPONSE' });
});

test('followups: diagrams offer specific questions without inventing numeric conditions', () => {
  const api = load();
  assert.equal(typeof api.diagramSuggestedQuestions, 'function');
  const curves = api.diagramSuggestedQuestions({ subject: '数学', objects: [{ type: 'curve' }] });
  assert.equal(curves.length, 3); assert.match(curves.join(''), /区间.*端点|两端.*坐标/);
  assert.doesNotMatch(curves.join(''), /\d|最低点/);
  const forces = api.diagramSuggestedQuestions({ subject: '物理', objects: [{ role: 'gravity' }] });
  assert.match(forces.join(''), /力.*方向|方向.*力/);
  const optics = api.diagramSuggestedQuestions({ subject: '物理', objects: [{ role: 'lens' }] });
  assert.match(optics.join(''), /光线/);
  for (const subject of ['化学', '生物']) {
    const questions = api.diagramSuggestedQuestions({ subject, objects: [] });
    assert.equal(questions.length, 3); assert.equal(new Set(questions).size, 3);
    assert.doesNotMatch(questions.join(''), /\d/);
  }
});

test('followups: unsupported saved diagrams retain text without drawing suggestions', () => {
  const api = load(), q = '画一条线段。';
  const scene = { version: 1, status: 'scene', subject: '物理', title: '线段', givens: [q], basis: ['表示位置关系。'],
    assumptions: [], explanation: ['线段示意。'], objects: [{ id: 'a', type: 'line', from: [100, 100], to: [400, 100] }],
    labels: [{ target: 'a', text: '线段' }], relations: [], calculations: [] };
  const message = { role: 'assistant', level: 'explain', question: q, sceneQuestion: q, scene,
    payload: { mode: 'explain', summary: '线段示意。', steps: [], formulas: [], finalAnswer: null } };
  const restore = () => api.savedSession({ id: 'old-diagram', context: {}, messages: [message] }).messages[0];
  assert.equal(restore().scene, undefined);
  assert.equal(restore().payload.suggestedQuestions.length, 0);
  scene.objects[0].onclick = 'unsafe()';
  assert.equal(restore().scene, undefined);
  assert.equal(restore().payload.suggestedQuestions.length, 0);
});
