import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = (await readFile(new URL('../../web/ai-tutor.js', import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
const answer = {
  mode: 'steps', summary: '用匀变速公式求刹车距离。',
  steps: ['末速度为零。', '代入初速度和减速度得到 40 m。'],
  formulas: ['s = \\frac{v_{0}^{2}}{2a}'], finalAnswer: '刹车距离为 40 m。',
  checks: ['量纲是长度。'], followUp: '', parameterPatch: null, warnings: []
};
const input = { responseLevel: 'steps' };
const thinking = { thinking: true, timeoutMs: 1000, maxTokens: 16000 };

function loadTutor(fetchImpl = () => { throw new Error('Unexpected network request'); }, options = {}) {
  const node = { addEventListener() {} };
  const sandbox = {
    document: { querySelector: () => node, querySelectorAll: () => [], addEventListener() {} },
    localStorage: { getItem: () => options.noKey ? null : 'test-only' },
    AbortController, TextDecoder, Response, fetch: fetchImpl, setTimeout, clearTimeout,
    location: { hostname: 'localhost' }, addEventListener() {}
  };
  sandbox.window = sandbox;
  vm.runInNewContext(source.replace(/\n  syncApiKeyUi\(\);\n  updateRoute\(\);/, `
    globalThis.tutorTest = { readSseChat, extractJsonObject, fallbackChatFromText,
      completeTutorChat, apiRequest, state };`), sandbox);
  return sandbox.tutorTest;
}

function sseFrame(delta = {}, finishReason = null) {
  return `data: ${JSON.stringify({ choices: [{ delta, finish_reason: finishReason }] })}\n\n`;
}

function sseResponse(body, splitBytes = 7) {
  const bytes = new TextEncoder().encode(body);
  return new Response(new ReadableStream({
    start(controller) {
      for (let offset = 0; offset < bytes.length; offset += splitBytes) {
        controller.enqueue(bytes.slice(offset, offset + splitBytes));
      }
      controller.close();
    }
  }), { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } });
}

function jsonResponse(content = JSON.stringify(answer)) {
  return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

test('web: full steps preserve split UTF-8, CRLF, reasoning and escaped formulas', async () => {
  const requests = [];
  const tutor = loadTutor(async (_url, options) => {
    requests.push(JSON.parse(options.body));
    const content = JSON.stringify(answer);
    return sseResponse((sseFrame({ reasoning_content: '正在核对条件。' }) +
      sseFrame({ content: content.slice(0, 40) }) + sseFrame({ content: content.slice(40) }, 'stop') +
      'data: [DONE]\n\n').replaceAll('\n', '\r\n'), 1);
  });
  const result = await tutor.completeTutorChat([], input, thinking);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].stream, true);
  assert.equal(result.finalAnswer, answer.finalAnswer);
  assert.equal(result.formulas[0], answer.formulas[0]);
});

test('web: the final SSE frame without a newline is consumed instead of retrying', async () => {
  let calls = 0;
  const tutor = loadTutor(async () => {
    calls += 1;
    return calls === 1
      ? sseResponse(sseFrame({ content: JSON.stringify(answer) }, 'stop').trimEnd())
      : jsonResponse();
  });
  assert.equal((await tutor.completeTutorChat([], input, thinking)).finalAnswer, answer.finalAnswer);
  assert.equal(calls, 1);
});

test('web: SSE joins multiple data lines into one event', async () => {
  const tutor = loadTutor();
  const event = `data: {"choices":\ndata: [{"delta":{"content":${JSON.stringify(JSON.stringify(answer))}},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n`;
  const result = await tutor.readSseChat(sseResponse(event), new AbortController());
  assert.equal(result.content, JSON.stringify(answer));
});

test('web: DONE ends the stream without waiting for the connection to close', async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(sseFrame({ content: JSON.stringify(answer) }, 'stop') + 'data: [DONE]\n\n'));
    }, cancel() { cancelled = true; }
  }), { headers: { 'Content-Type': 'text/event-stream' } });
  const result = await Promise.race([
    loadTutor().readSseChat(response, new AbortController()),
    new Promise(resolve => setTimeout(() => resolve(null), 80))
  ]);
  assert.ok(result, 'completed SSE must not wait for EOF');
  assert.equal(cancelled, true);
  assert.equal(response.body.locked, false);
});

test('web: a JSON response to a streaming request is parsed without an unnecessary retry', async () => {
  let calls = 0;
  const tutor = loadTutor(async () => { calls += 1; return jsonResponse(); });
  assert.equal((await tutor.completeTutorChat([], input, thinking)).finalAnswer, answer.finalAnswer);
  assert.equal(calls, 1);
});

test('web: token truncation followed by malformed JSON never becomes a successful answer', async () => {
  let calls = 0;
  const broken = '{"mode":"steps","summary":"先求刹车距离","steps":["代入';
  const tutor = loadTutor(async () => ++calls === 1
    ? sseResponse(sseFrame({ content: broken }, 'length') + 'data: [DONE]\n\n')
    : jsonResponse(broken));
  await assert.rejects(tutor.completeTutorChat([], input, thinking), { code: 'INVALID_AI_RESPONSE' });
  assert.equal(calls, 2);
});

test('web: finish_reason length rejects even syntactically valid partial answers', async () => {
  const tutor = loadTutor();
  await assert.rejects(tutor.readSseChat(sseResponse(sseFrame({ content: JSON.stringify(answer) }, 'length') +
    'data: [DONE]\n\n'), new AbortController()), { code: 'INVALID_AI_RESPONSE' });
});

test('web: an unfinished stream or malformed event is rejected', async () => {
  const tutor = loadTutor();
  for (const body of [sseFrame({ content: JSON.stringify(answer) }),
    'data: {broken}\n\n' + sseFrame({ content: JSON.stringify(answer) }, 'stop') + 'data: [DONE]\n\n']) {
    await assert.rejects(tutor.readSseChat(sseResponse(body), new AbortController()), { code: 'INVALID_AI_RESPONSE' });
  }
});

test('web: reasoning JSON is never promoted to the final answer', async () => {
  let calls = 0;
  const tutor = loadTutor(async () => ++calls === 1
    ? sseResponse(sseFrame({ reasoning_content: JSON.stringify(answer) }, 'stop') + 'data: [DONE]\n\n')
    : jsonResponse());
  const result = await tutor.completeTutorChat([], input, thinking);
  assert.equal(calls, 2);
  assert.equal(result.finalAnswer, answer.finalAnswer);
  assert.equal(result.reasoning, '');
  assert.match(result.warnings.join(''), /快速模式/);
});

test('web: fenced and trailing-comma JSON preserve escaped textbook formulas', () => {
  const tutor = loadTutor();
  for (const content of [JSON.stringify(answer), '```json\n' + JSON.stringify(answer) + '\n```',
    JSON.stringify(answer).slice(0, -1) + ',}']) {
    const result = tutor.extractJsonObject(content);
    assert.equal(result.finalAnswer, answer.finalAnswer);
    assert.equal(result.formulas[0], answer.formulas[0]);
  }
});

test('web: non-stream finish_reason length cannot become a text fallback', async () => {
  const tutor = loadTutor(async () => new Response(JSON.stringify({ choices: [{
    message: { content: JSON.stringify(answer) }, finish_reason: 'length'
  }] }), { headers: { 'Content-Type': 'application/json' } }));
  await assert.rejects(tutor.completeTutorChat([], { responseLevel: 'hint' }, { thinking: false, timeoutMs: 1000 }),
    { code: 'INVALID_AI_RESPONSE' });
});

for (const reason of ['timeout', undefined]) {
  test(`web: abort while reading SSE (${reason || 'user stop'}) is terminal, with no fast retry`, async () => {
    let calls = 0;
    let tutor;
    tutor = loadTutor(async (_url, options) => {
      calls += 1;
      if (calls > 1) return jsonResponse();
      return new Response(new ReadableStream({
        start(controller) {
          options.signal.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')));
          setTimeout(() => tutor.state.controller.abort(reason), 5);
        }
      }), { headers: { 'Content-Type': 'text/event-stream' } });
    });
    await assert.rejects(tutor.completeTutorChat([], input, thinking), { code: reason ? 'AI_TIMEOUT' : 'ABORTED' });
    assert.equal(calls, 1);
    assert.equal(tutor.state.controller, null);
    assert.equal(tutor.state.timeoutId, null);
  });
}

test('web: ordinary hints use non-stream JSON and do not reveal the final answer', async () => {
  let request;
  const tutor = loadTutor(async (_url, options) => {
    request = JSON.parse(options.body);
    return jsonResponse(JSON.stringify({ ...answer, mode: 'hint' }));
  });
  const result = await tutor.completeTutorChat([], { responseLevel: 'hint' }, { thinking: false, timeoutMs: 1000 });
  assert.equal(request.stream, false);
  assert.equal(request.thinking.type, 'disabled');
  assert.equal(result.finalAnswer, null);
});

test('web: broken structured text cannot enter the readable-text fallback', () => {
  const tutor = loadTutor();
  for (const broken of ['{"summary":"未闭合', '```json\n{"steps":[', '[{"summary":"未闭合',
    '以下是结果：\n{"summary":"未闭合']) {
    assert.equal(tutor.fallbackChatFromText(broken, 'hint'), null);
  }
  assert.ok(tutor.fallbackChatFromText('先观察末速度是否为零，再选择合适的运动学公式。', 'hint'));
  assert.equal(tutor.fallbackChatFromText('只有一句话，没有完整步骤和最终结论。', 'steps'), null);
});

test('web: absent browser key selects the gateway and sends no Authorization header', async () => {
  let request;
  const tutor = loadTutor(async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ mode: 'hint', source: 'local_fallback', summary: '本地教学提示' }));
  }, { noKey: true });
  const result = await tutor.apiRequest('/api/v1/tutor/chat', {}, 1000);
  assert.equal(request.url, 'http://127.0.0.1:10000/api/v1/tutor/chat');
  assert.equal(Object.hasOwn(request.options.headers, 'Authorization'), false);
  assert.equal(result.source, 'local_fallback');
});

for (const gateway of [false, true]) {
  test(`web: JSON body timeout remains AI_TIMEOUT (${gateway ? 'gateway' : 'direct hint'})`, async () => {
    let calls = 0;
    const tutor = loadTutor(async (_url, options) => {
      calls += 1;
      return new Response(new ReadableStream({
        start(controller) {
          options.signal.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')));
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    }, { noKey: gateway });
    const request = gateway
      ? tutor.apiRequest('/api/v1/tutor/chat', {}, 5)
      : tutor.completeTutorChat([], { responseLevel: 'hint' }, { thinking: false, timeoutMs: 5 });
    await assert.rejects(request, { code: 'AI_TIMEOUT' });
    assert.equal(calls, 1);
  });

  test(`web: replacing an aborted request keeps the new deadline (${gateway ? 'gateway' : 'direct'})`, async () => {
    const tutor = loadTutor(async (_url, options) => new Response(new ReadableStream({
      start(controller) {
        options.signal.addEventListener('abort', () => {
          setTimeout(() => controller.error(new DOMException('Aborted', 'AbortError')), 1);
        });
      }
    }), { headers: { 'Content-Type': 'application/json' } }), { noKey: gateway });
    const run = timeoutMs => gateway
      ? tutor.apiRequest('/api/v1/tutor/chat', {}, timeoutMs)
      : tutor.completeTutorChat([], { responseLevel: 'hint' }, { thinking: false, timeoutMs });
    const first = run(1000).catch(error => error.code);
    await Promise.resolve();
    const second = run(10).catch(error => error.code);
    assert.equal(await first, 'ABORTED');
    const result = await Promise.race([second, new Promise(resolve => setTimeout(() => resolve('deadline lost'), 100))]);
    assert.equal(result, 'AI_TIMEOUT');
  });
}
