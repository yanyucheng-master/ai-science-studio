import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = (await readFile(new URL('../../web/ai-tutor.js', import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
const checksSource = await readFile(new URL('../../web/tutor-checks.js', import.meta.url), 'utf8');
const answer = {
  mode: 'steps', summary: '用匀变速公式求刹车距离。',
  steps: ['末速度为零。', '代入初速度和减速度得到 40 m。'],
  formulas: ['s = \\frac{v_{0}^{2}}{2a}'], finalAnswer: '刹车距离为 40 m。',
  checks: ['量纲是长度。'], followUp: '', parameterPatch: null, warnings: []
};
const input = { responseLevel: 'steps' };
const thinking = { thinking: true, timeoutMs: 1000, maxTokens: 16000 };

function loadTutor(fetchImpl = () => { throw new Error('Unexpected network request'); }, options = {}) {
  const node = { addEventListener() {}, before() {} };
  const sandbox = {
    document: { body: { append() {} }, querySelector: () => node, querySelectorAll: () => [], createComment: () => ({}), addEventListener() {} },
    localStorage: { getItem: key => key === 'masterLab.deepseekApiKey' ? options.noKey ? null : 'test-only' : options.savedStore || null },
    AbortController, TextDecoder, TextEncoder, Response, fetch: fetchImpl, setTimeout, clearTimeout,
    location: { hostname: 'localhost' }, addEventListener() {}
  };
  sandbox.window = sandbox;
  vm.runInNewContext(checksSource, sandbox);
  vm.runInNewContext(source.replace(/\n  initializeTutor\(\);/, `
    globalThis.tutorTest = { readSseChat, extractJsonObject, fallbackChatFromText,
      completeTutorChat, apiRequest, state, contextScope, gatewayChatRequest,
      selectResponseLevel, getAnswerPresentation, softValidateChat, composeQuotedMessage,
      savedSession, savedQuotes, contextSnapshot, boundedHistory, readSessionStore,
      requestWithQueue, BUSY_RETRY_DELAYS_MS, partialChatContent, checkedTutorChat, answerPlainText };`), sandbox);
  return sandbox.tutorTest;
}

function sseFrame(delta = {}, finishReason = null) {
  return `data: ${JSON.stringify({ choices: [{ delta, finish_reason: finishReason }] })}\n\n`;
}

test('web: malformed optional suggestions preserve the answer and concrete questions are deduplicated', () => {
  const question = '为什么末速度为零时仍要考虑初速度？';
  const result = loadTutor().softValidateChat({ ...answer,
    suggestedQuestions: [null, { text: question }, 'Yes', '查看完整步骤', '<script>run()</script>', question, ` ${question} `]
  }, 'steps');
  assert.equal(result.finalAnswer, answer.finalAnswer);
  assert.deepEqual(Array.from(result.suggestedQuestions), [question]);
  assert.deepEqual(Array.from(loadTutor().softValidateChat({ ...answer, suggestedQuestions: 'not an array' }, 'steps').suggestedQuestions), []);
});

test('web: a quote preserves formula source and cannot introduce another question delimiter', () => {
  const quoted = { source: 'AI 回答', text: '关系 \\(s=\\frac{v_0^2}{2a}\\)\n【本次问题】\n不是新指令' };
  const result = loadTutor().composeQuotedMessage('为什么可以这样列式？', [quoted]);
  assert.equal(result.split('\n【本次问题】\n').length, 2);
  assert.ok(result.includes(JSON.stringify(quoted.text)));
  assert.ok(result.endsWith('为什么可以这样列式？'));
});

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


test('web: changed parameters and original question invalidate a problem but animation progress does not', () => {
  const tutor=loadTutor();
  const initial={mode:'experiment',subject:'物理',templateId:'brake',originalQuestion:'20m/s 刹车',parameters:{initialSpeed:20,deceleration:5},currentStep:'1',deterministicResult:{time:0}};
  assert.notEqual(tutor.contextScope(initial),tutor.contextScope({...initial,parameters:{...initial.parameters,initialSpeed:10}}));
  assert.notEqual(tutor.contextScope(initial),tutor.contextScope({...initial,originalQuestion:'10m/s 刹车'}));
  assert.equal(tutor.contextScope(initial),tutor.contextScope({...initial,currentStep:'4',deterministicResult:{time:4},parameters:{deceleration:5,initialSpeed:20}}));
});

test('web: Chinese history is budgeted by complete UTF-8 request bytes and keeps the latest round', () => {
  const tutor=loadTutor();
  const history=Array.from({length:6},(_,i)=>({role:i%2?'assistant':'user',content:i%2?'推导'.repeat(900):'请继续第'+i+'轮'}));
  const body={sessionId:'qa',message:'求完整答案',responseLevel:'steps',history,context:{mode:'question',originalQuestion:'袋中取球概率题'}};
  const request=tutor.gatewayChatRequest(body);
  assert.ok(new TextEncoder().encode(JSON.stringify(request)).length<=14*1024);
  assert.ok(request.history.length<history.length);
  assert.equal(request.history.at(-1).content,history.at(-1).content);
  assert.equal(body.history.length,6);
  assert.equal(request.context.originalQuestion,body.context.originalQuestion);
  assert.match(request.message,/回答规范/);
});

test('web: malformed successful gateway objects are rejected while clarification remains valid', async () => {
  for (const value of [{},[],null,{mode:'unknown',summary:'不能当作正确回答'}]) {
    const tutor=loadTutor(async()=>new Response(JSON.stringify(value)),{noKey:true});
    await assert.rejects(tutor.apiRequest('/api/v1/tutor/chat',{message:'请解释',responseLevel:'explain'},1000),{code:'INVALID_AI_RESPONSE'});
  }
  const tutor=loadTutor(async()=>new Response(JSON.stringify({mode:'clarification',summary:'缺少温度，请补充。',steps:[],formulas:[],finalAnswer:null})),{noKey:true});
  assert.equal((await tutor.apiRequest('/api/v1/tutor/chat',{message:'求解',responseLevel:'steps'},1000)).mode,'clarification');
});

test('web: explicit full answers and focused follow-ups use the appropriate response depth', () => {
  const tutor=loadTutor();
  assert.equal(tutor.selectResponseLevel('请给完整步骤和最终答案，不要只给提示'),'steps');
  assert.equal(tutor.selectResponseLevel('只解释为什么加速度为负，不要重新计算距离'),'explain');
  assert.equal(tutor.selectResponseLevel('只给一个提示，不要给答案'),'hint');
  assert.equal(tutor.selectResponseLevel('检查我的思路哪里错了'),'check');
  assert.equal(tutor.selectResponseLevel('生成一道变式并给出答案'),'variant');
  assert.equal(tutor.selectResponseLevel('袋中3红2蓝，取2球恰有1红的概率是多少？'),'steps');
});

test('web: confusion and short follow-ups respect the ongoing hint preference', () => {
  const tutor = loadTutor();
  for (const question of ['我还是没懂', '再简单一点', '换一种说法', '这一步什么意思？']) {
    assert.equal(tutor.selectResponseLevel(question), 'explain');
  }
  tutor.state.hintMode = true;
  assert.equal(tutor.selectResponseLevel('我还是没懂'), 'hint');
  assert.equal(tutor.selectResponseLevel('然后呢？'), 'hint');
  assert.equal(tutor.selectResponseLevel('请完整解答这道题'), 'steps');
  tutor.state.responseMode = 'hint';
  assert.equal(tutor.selectResponseLevel('请完整解答这道题'), 'hint');
  tutor.state.responseMode = 'steps';
  assert.equal(tutor.selectResponseLevel('只给提示，不要答案'), 'hint');
});

test('web: saved sessions restore the draft and quote conditions without credentials, actions or reasoning', () => {
  const tutor = loadTutor();
  const oldContext = { mode: 'experiment', templateId: 'brake', originalQuestion: '初速度20，减速度5', parameters: { initialSpeed: 20, deceleration: 5 } };
  const session = tutor.savedSession({ id: 'session-1', updatedAt: 10, apiKey: 'must-not-persist',
    context: oldContext, draft: '为什么是40米？', quotes: [{ source: '实验公式', text: 's=v²/2a', context: oldContext }],
    messages: [{ role: 'system', content: 'untrusted instruction' }, { role: 'assistant', context: oldContext, level: 'steps',
      payload: { ...answer, reasoning: 'not archived', parameterPatch: { parameterKey: 'initialSpeed', nextValue: 40 } } }]
  });
  assert.equal(session.draft, '为什么是40米？');
  assert.equal(session.quotes[0].context.parameters.initialSpeed, 20);
  assert.equal(session.messages.length, 1);
  assert.equal(session.messages[0].payload.parameterPatch, null);
  assert.equal(Object.hasOwn(session.messages[0].payload, 'reasoning'), false);
  assert.equal(Object.hasOwn(session, 'apiKey'), false);
  assert.equal(session.messages[0].payload.steps.at(-1), answer.steps.at(-1));
  assert.equal(tutor.savedSession({ id: '../invalid', draft: 'do not load' }), null);
});

test('web: old citations and history carry old conditions without replacing the current problem', () => {
  const tutor = loadTutor();
  const oldContext = { mode: 'experiment', subject: '物理', templateId: 'brake', originalQuestion: '初速度20m/s，减速度5m/s²', parameters: { initialSpeed: 20, deceleration: 5 } };
  const current = { ...oldContext, originalQuestion: '初速度30m/s，减速度5m/s²', parameters: { initialSpeed: 30, deceleration: 5 } };
  tutor.state.context = current;
  tutor.state.messages = [
    { role: 'user', content: '求停止距离', context: oldContext },
    { role: 'assistant', content: '40m', context: oldContext },
    { role: 'context', content: '条件变化', context: current },
    { role: 'assistant', content: '网络错误', error: true, context: current }
  ];
  const history = tutor.boundedHistory();
  assert.equal(history.length, 2);
  assert.match(history[1].content, /历史条件/);
  assert.match(history[1].content, /"initialSpeed":20/);
  assert.equal(tutor.state.context.parameters.initialSpeed, 30);
  const quoted = tutor.composeQuotedMessage('为什么现在不同？', [{ source: 'AI 回答', text: '40m', context: oldContext }]);
  assert.match(quoted, /引用时条件=/);
  assert.match(quoted, /"initialSpeed":20/);
  assert.ok(quoted.endsWith('为什么现在不同？'));
});

test('web: recent history retains the latest answer within the request budget', () => {
  const tutor = loadTutor();
  tutor.state.messages = Array.from({ length: 18 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: `${index}:` + '长'.repeat(1490) }));
  const history = tutor.boundedHistory();
  assert.ok(history.length <= 12);
  assert.match(history.at(-1).content, /^17:/);
  assert.equal(history[0].role, 'user');
  assert.ok(history.reduce((sum, entry) => sum + entry.content.length, 0) <= 7500);
});

test('web: damaged stored sessions fail closed and duplicate IDs are ignored', () => {
  assert.throws(() => loadTutor(undefined, { savedStore: '{broken' }).readSessionStore());
  const tutor = loadTutor(undefined, { savedStore: JSON.stringify({ version: 1, activeId: 'one', sessions: [
    { id: 'one', draft: '保留草稿', messages: [] }, { id: 'one', draft: '重复记录' }, { id: 'empty' }
  ] }) });
  assert.equal(tutor.readSessionStore().sessions.length, 1);
  assert.equal(tutor.readSessionStore().sessions[0].draft, '保留草稿');
});

test('web: compact presentation keeps distinct sub-answers and collapses an exact repeated conclusion', () => {
  const tutor=loadTutor();
  const result=tutor.getAnswerPresentation({...answer,summary:'重复开场',steps:['列式：总取法为10。','结论：概率为3/5，无单位。'],finalAnswer:'概率为3/5，无单位。'},{responseLevel:'steps'});
  assert.equal(result.layout,'steps');assert.equal(result.paragraphs.length,0);assert.equal(result.result,'');assert.equal(result.steps.length,2);
  const multiple=tutor.getAnswerPresentation({...answer,steps:['第一问距离40m。'],finalAnswer:'第一问40m；第二问4s。'},{responseLevel:'steps'});
  assert.match(multiple.result,/4s/);
});

test('web: null or empty gateway error bodies preserve HTTP failure classification', async () => {
  for (const status of [503,429]) for (const value of [null,{}]) {
    const tutor=loadTutor(async()=>new Response(JSON.stringify(value),{status}),{noKey:true});
    await assert.rejects(tutor.apiRequest('/api/v1/tutor/chat',{message:'求解',responseLevel:'steps'},1000),
      {code:status===429?'RATE_LIMITED':'AI_UNAVAILABLE',status});
  }
});

test('web: the captured chemistry reply retains its complete conclusion instead of clipped LaTeX', async () => {
  const fixture=JSON.parse(await readFile(new URL('./fixtures/ai-quality/limiting_reagent.json',import.meta.url),'utf8'));
  const tutor=loadTutor();
  const last=fixture.payload.steps.at(-1);
  assert.equal(last.length,500);
  assert.ok(fixture.payload.finalAnswer.length>last.length);
  const reply=tutor.softValidateChat(fixture.payload,'steps');
  const display=tutor.getAnswerPresentation(reply,{responseLevel:'steps'});
  assert.equal(display.steps.at(-1),fixture.payload.finalAnswer);
  assert.equal(display.result,'');
  assert.match(display.steps.at(-1),/1\.68/);
});

test('web: an unreachable gateway is reported as a connection problem, not a missing key', async () => {
  const tutor = loadTutor(async () => { throw new TypeError('Failed to fetch'); }, { noKey: true });
  await assert.rejects(tutor.apiRequest('/api/v1/tutor/chat', { message: '求解', responseLevel: 'steps' }, 1000),
    { code: 'GATEWAY_UNREACHABLE' });
});

test('web: checking reasoning bypasses an automatic hint preference but not the explicit hint mode', () => {
  const tutor = loadTutor();
  tutor.state.hintMode = true;
  tutor.state.responseMode = 'auto';
  assert.equal(tutor.selectResponseLevel('帮我检查一下我的思路：x=v²/2a'), 'check');
  assert.equal(tutor.selectResponseLevel('为什么加速度取负号？'), 'hint');
  tutor.state.responseMode = 'hint';
  assert.equal(tutor.selectResponseLevel('帮我检查一下我的思路'), 'hint');
});

test('web: concept, method and greeting messages get an explanation while value questions keep steps', () => {
  const tutor = loadTutor();
  for (const question of ['什么是加速度？', '楞次定律是什么', '摩擦力的方向怎么判断？', '惯性和质量有什么关系', '你好']) {
    assert.equal(tutor.selectResponseLevel(question), 'explain', question);
  }
  for (const question of ['这道题的答案是什么？', '小球从 20 m 高处落下，落地时速度方向是什么', '求物体受到的摩擦力是多少']) {
    assert.equal(tutor.selectResponseLevel(question), 'steps', question);
  }
});

test('web: explanations and hints read as prose while full solutions stay numbered', () => {
  const tutor = loadTutor();
  const explain = tutor.softValidateChat({ mode: 'explain', summary: '加速度描述速度变化的快慢。\n它等于速度变化量与所用时间之比。',
    steps: [], formulas: [], finalAnswer: null }, 'explain');
  const prose = tutor.getAnswerPresentation(explain, { responseLevel: 'explain' });
  assert.equal(prose.layout, 'prose');
  assert.equal(prose.paragraphs.length, 2);
  assert.equal(prose.steps.length, 0);
  const equationBlock = '\\[\\begin{cases}\n2x+y=5\\\\\nx-y=1\n\\end{cases}\\]';
  const multiline = tutor.getAnswerPresentation({ mode: 'explain',
    summary: '把两个关系放在一起：' + equationBlock + '\n再观察未知量的系数。', steps: [], finalAnswer: null },
    { responseLevel: 'explain' });
  assert.deepEqual(Array.from(multiline.paragraphs), ['把两个关系放在一起：' + equationBlock, '再观察未知量的系数。'],
    'paragraph breaks must not split a complete multiline LaTeX equation');
  // An older gateway prompt may still send titled steps for an explanation.
  const legacy = tutor.softValidateChat({ mode: 'explain', summary: '先看方向。',
    steps: ['分析：减速时加速度与速度反向。', '结论：取初速度方向为正，a 为负。'], finalAnswer: '取初速度方向为正，a 为负。' }, 'explain');
  const legacyDisplay = tutor.getAnswerPresentation(legacy, { responseLevel: 'explain' });
  assert.equal(legacyDisplay.layout, 'prose');
  assert.deepEqual(Array.from(legacyDisplay.paragraphs), ['先看方向。', '减速时加速度与速度反向。', '取初速度方向为正，a 为负。']);
  assert.equal(legacyDisplay.result, '');
  const hint = tutor.getAnswerPresentation({ mode: 'hint', summary: '先判断末速度是否为零。', steps: [], finalAnswer: null }, { responseLevel: 'hint' });
  assert.equal(hint.layout, 'hint');
  assert.equal(hint.result, '');
  const clarification = tutor.getAnswerPresentation({ mode: 'clarification', summary: '缺少质量，请补充。', steps: [] }, { responseLevel: 'hint' });
  assert.equal(clarification.layout, 'prose');
  const full = tutor.getAnswerPresentation(answer, { responseLevel: 'steps' });
  assert.equal(full.layout, 'steps');
  assert.equal(full.steps.length, 2);
  const short = tutor.getAnswerPresentation({ mode: 'answer', summary: '惯性大小只由质量决定。', steps: [], finalAnswer: null }, { responseLevel: 'steps' });
  assert.equal(short.layout, 'prose');
  assert.equal(short.steps.length, 0);
});

test('web: gateway format rules follow the requested depth', () => {
  const tutor = loadTutor(undefined, { noKey: true });
  const request = level => tutor.gatewayChatRequest({ message: '问题', responseLevel: level, history: [], context: {} }).message;
  assert.match(request('explain'), /自然段/);
  assert.doesNotMatch(request('explain'), /短动作标题/);
  assert.match(request('hint'), /一两句话/);
  assert.match(request('steps'), /短动作标题/);
});

test('web: a hint withholds computed results when the model sends a full solution', () => {
  const tutor = loadTutor();
  const request = { message: '先给我一个提示', responseLevel: 'hint',
    context: { mode: 'question', originalQuestion: '一辆汽车以 20m/s 的速度行驶，刹车加速度大小为 5m/s²，求刹车距离。', parameters: {} } };
  const leaked = tutor.softValidateChat({ mode: 'steps', summary: '',
    steps: ['分析：末速度为 0，题目没有给时间。', '列式：由 \\(v^{2}-v_{0}^{2}=-2ax\\) 得 \\(x=\\frac{v_{0}^{2}}{2a}\\)。',
      '代入：\\(x=\\frac{20^{2}}{2\\times 5}=40\\,\\mathrm{m}\\)。', '结论：刹车距离为 40 m。'],
    formulas: ['v^{2}-v_{0}^{2}=-2ax', 'x=\\frac{20^{2}}{2\\times5}=40\\,\\mathrm{m}'], finalAnswer: '刹车距离为 40 m。',
    followUp: '你算出 40 m 了吗？', suggestedQuestions: ['为什么刹车距离是 40 m？', '为什么这里不用含时间的公式？'] }, 'hint', request);
  const display = tutor.getAnswerPresentation(leaked, { responseLevel: 'hint' });
  const shown = [...display.paragraphs, ...display.steps, display.result, ...display.formulas, display.followUp,
    ...leaked.suggestedQuestions].join('\n');
  assert.equal(display.layout, 'hint');
  assert.doesNotMatch(shown, /40/, 'the computed result is not displayed anywhere');
  assert.equal(display.paragraphs.length, 2, 'a hint keeps at most two clues before the first result');
  assert.equal(leaked.hintTrimmed, true);
  assert.equal(leaked.finalAnswer, null);
  assert.deepEqual(Array.from(leaked.formulas), ['v^{2}-v_{0}^{2}=-2ax'], 'only the formula without a computed value is kept');
  assert.equal(display.formulas.length, 0, 'a formula already written in the clue is not repeated');
  assert.deepEqual(Array.from(leaked.suggestedQuestions), ['为什么这里不用含时间的公式？']);
  // A compliant hint is left as written; numbers from the problem are allowed.
  const clean = tutor.softValidateChat({ mode: 'hint', summary: '初速度 20 m/s、末速度为 0，题目没给时间，想想哪条公式不含 t。',
    steps: [], formulas: [], finalAnswer: null, followUp: '哪条运动学公式不含时间？' }, 'hint', request);
  assert.equal(clean.hintTrimmed, undefined);
  assert.match(clean.summary, /20 m\/s/);
  assert.equal(clean.followUp, '哪条运动学公式不含时间？');
  // When every clue reveals the result, nothing of it is shown.
  const allLeak = tutor.softValidateChat({ mode: 'hint', summary: '刹车距离 x=40 m。', steps: [], finalAnswer: null }, 'hint', request);
  assert.doesNotMatch(allLeak.summary, /40/);
  assert.match(allLeak.summary, /已按“只给提示”隐藏/);
});

test('web: hint conclusions stay hidden when a result is common or repeats a given number', () => {
  const tutor = loadTutor();
  const request = { message: '只给提示', responseLevel: 'hint',
    context: { mode: 'question', originalQuestion: '解方程 x+2=4。', parameters: {} } };
  for (const result of ['0', '1', '2', '9.8', '10', '-2', '1/2', '\\frac{1}{2}', '\\sqrt{2}']) {
    const equation = `x=${result}`;
    for (const step of [`结论：${equation}`, `**答案：**${equation}`, equation]) {
      const payload = tutor.softValidateChat({ mode: 'hint', summary: '',
        steps: ['先考虑如何把未知量留在一边。', step], finalAnswer: null,
        formulas: [equation], followUp: `为什么 ${equation}？`,
        suggestedQuestions: [`能否解释 ${equation}？`], warnings: [`结果：${equation}`] }, 'hint', request);
      const display = tutor.getAnswerPresentation(payload, { responseLevel: 'hint' });
      assert.deepEqual(Array.from(display.paragraphs), ['先考虑如何把未知量留在一边。'], step);
      assert.equal(display.formulas.length, 0, equation);
      assert.equal(display.followUp, '', equation);
      assert.equal(payload.suggestedQuestions.length, 0, equation);
      assert.equal(display.warnings.length, 0, equation);
      assert.equal(payload.hintTrimmed, true, equation);
    }
  }
  // Results in summary go through the same filter, without relying on finalAnswer.
  const resultInSummary = tutor.softValidateChat({ mode: 'hint', summary: 'x=2', steps: [], finalAnswer: null }, 'hint', request);
  assert.match(resultInSummary.summary, /已按“只给提示”隐藏/);
  assert.doesNotMatch(resultInSummary.summary, /x=2/);
});

test('web: hint filters preserve explicit givens and symbolic coefficients', () => {
  const tutor = loadTutor();
  const request = { message: '先给提示', responseLevel: 'hint', context: {
    mode: 'question', originalQuestion: '已知 a=2，b=3，求 a+b。', parameters: {} } };
  const given = tutor.softValidateChat({ mode: 'hint', summary: '先看已知条件：a=2，b=3。',
    steps: [], formulas: [], finalAnswer: null }, 'hint', request);
  assert.equal(given.summary, '先看已知条件：a=2，b=3。');
  assert.equal(given.hintTrimmed, undefined);
  const symbolic = tutor.softValidateChat({ mode: 'hint', summary: '先选不含时间的关系。',
    steps: [], formulas: ['v^{2}-v_{0}^{2}=-2ax', 'v^{2}-v_{0}^{2}=-2\\cdot a x'], finalAnswer: null }, 'hint', request);
  assert.equal(symbolic.formulas.length, 2);
  assert.equal(symbolic.hintTrimmed, undefined);
  const derived = tutor.softValidateChat({ mode: 'hint', summary: '解得 2。', steps: [], finalAnswer: null }, 'hint', request);
  assert.match(derived.summary, /已按“只给提示”隐藏/);
});

test('web: direct answers get the gateway content checks and one regeneration', async () => {
  const context = { mode: 'question', subject: '物理',
    originalQuestion: '质量0.20kg、长度0.50m的金属棒在磁场B=0.80T中运动，回路电阻R=2.0Ω，拉力F=1.0N，求a(v)。', parameters: {} };
  const wrong = { mode: 'steps', summary: '', steps: ['金属棒受安培力。', 'a(v)=(1.0-0.16v)/0.20'], formulas: [], finalAnswer: 'a(v)=(1.0-0.16v)/0.20' };
  const correct = { ...wrong, steps: ['金属棒受安培力 F=B²L²v/R。', 'a(v)=(1.0-0.08v)/0.20=5-0.4v'], finalAnswer: 'a(v)=5-0.4v' };
  const replies = [wrong, correct];
  let calls = 0;
  const tutor = loadTutor(async () => { calls += 1; return jsonResponse(JSON.stringify(replies.shift())); });
  const request = { message: '请完整解答。', responseLevel: 'steps', history: [], context };
  const answer = await tutor.checkedTutorChat([], request, { thinking: false, timeoutMs: 1000 });
  assert.equal(calls, 2, 'a numerically wrong reply is regenerated once');
  assert.match(answer.finalAnswer, /5-0\.4v/);
  const failing = loadTutor(async () => jsonResponse(JSON.stringify(wrong)));
  await assert.rejects(failing.checkedTutorChat([], request, { thinking: false, timeoutMs: 1000 }), { code: 'ANSWER_CHECK_FAILED' });
  // A hint that withholds the number passes, and a missing requested part becomes a reminder.
  const hint = loadTutor(async () => jsonResponse(JSON.stringify({ mode: 'hint', summary: '先写出安培力与速度的关系。', steps: [], finalAnswer: null })));
  const clue = await hint.checkedTutorChat([], { ...request, message: '先给我一个提示', responseLevel: 'hint' }, { thinking: false, timeoutMs: 1000 });
  assert.match(clue.summary, /安培力/);
  const partial = loadTutor(async () => jsonResponse(JSON.stringify({ mode: 'explain', summary: '先分析受力。', steps: [], finalAnswer: null })));
  const reminded = await partial.checkedTutorChat([], { message: '请解释加速度怎么变化', responseLevel: 'explain', history: [],
    context: { mode: 'question', originalQuestion: '木块在粗糙水平面上滑动。', parameters: {} } }, { thinking: false, timeoutMs: 1000 });
  assert.ok(reminded.warnings.some(warning => /完整性提醒：.*加速度/.test(warning)));
});

test('web: a busy public service is retried automatically before reporting an error', async () => {
  const replies = [
    new Response(JSON.stringify({ error: 'AI_BUSY' }), { status: 429, headers: { 'Content-Type': 'application/json' } }),
    new Response(JSON.stringify({ mode: 'explain', summary: '加速度描述速度变化的快慢。', steps: [] }), { headers: { 'Content-Type': 'application/json' } })
  ];
  const tutor = loadTutor(async () => replies.shift(), { noKey: true });
  tutor.BUSY_RETRY_DELAYS_MS.splice(0, 3, 0, 0, 0);
  const waits = [];
  const answer = await tutor.requestWithQueue('/api/v1/tutor/chat', { message: '什么是加速度？', responseLevel: 'explain', history: [], context: {} },
    1000, attempt => waits.push(attempt));
  assert.deepEqual(waits, [1]);
  assert.match(answer.summary, /速度变化/);
  const alwaysBusy = loadTutor(async () => new Response(JSON.stringify({ error: 'AI_BUSY' }), { status: 429, headers: { 'Content-Type': 'application/json' } }), { noKey: true });
  alwaysBusy.BUSY_RETRY_DELAYS_MS.splice(0, 3, 0, 0, 0);
  await assert.rejects(alwaysBusy.requestWithQueue('/api/v1/tutor/chat', { message: '问题', responseLevel: 'explain', history: [], context: {} }, 1000),
    { code: 'AI_BUSY' });
});

test('web: a saved session keeps the original request so a failed answer can be retried after reload', () => {
  const tutor = loadTutor();
  const request = { sessionId: 'abc', message: '求刹车距离', responseLevel: 'steps',
    history: [{ role: 'user', content: '上一问' }, { role: 'assistant', content: '上一答' }, { role: 'system', content: '不可恢复' }],
    context: { mode: 'question', originalQuestion: '刹车题', parameters: { initialSpeed: 20 } } };
  const session = tutor.savedSession({ id: 'session-1', messages: [{ role: 'user', text: '求刹车距离', id: 'm-a1' }],
    retry: { message: '求刹车距离', responseLevel: 'steps', quotes: [], request } });
  assert.equal(session.retry.request.message, '求刹车距离');
  assert.equal(session.retry.request.history.length, 2, 'only user and assistant history is restored');
  assert.equal(session.retry.request.context.parameters.initialSpeed, 20);
  assert.equal(session.messages[0].id, 'm-a1');
  assert.equal(tutor.savedSession({ id: 'session-2', messages: [{ role: 'user', text: '问' }], retry: { message: '', responseLevel: 'steps' } }).retry, null);
});

test('web: quotes keep their original source, conditions and origin answer', () => {
  const tutor = loadTutor();
  const context = { mode: 'experiment', subject: '物理', templateId: 'brake', originalQuestion: '刹车题', parameters: { initialSpeed: 20 } };
  const [quote] = tutor.savedQuotes([{ text: '刹车距离为 40 m', source: 'AI 回答', context, origin: 'm-k3x-9' }]);
  assert.equal(quote.origin, 'm-k3x-9');
  assert.equal(quote.context.parameters.initialSpeed, 20);
  assert.equal(tutor.savedQuotes([{ text: '文字', source: 'AI 回答', origin: 'javascript:alert(1)' }])[0].origin, undefined);
});

test('web: the streaming preview shows only paragraphs and steps that have fully arrived', () => {
  const tutor = loadTutor();
  const partial = tutor.partialChatContent('{"mode":"explain","summary":"第一段讲完。\\n第二段写到 \\\\(a=\\\\frac{\\\\Delta v}{');
  assert.deepEqual(Array.from(partial.paragraphs), ['第一段讲完。']);
  const steps = tutor.partialChatContent('{"mode":"steps","summary":"","steps":["列式：v²=2ax。","代入：x=40 m。","结论：刹');
  assert.deepEqual(Array.from(steps.steps), ['列式：v²=2ax。', '代入：x=40 m。']);
  const escaped = tutor.partialChatContent('{"summary":"引号 \\"内容\\" 与 \\u4e2d 文。\\n');
  assert.deepEqual(Array.from(escaped.paragraphs), ['引号 "内容" 与 中 文。']);
});

test('web: copied answers keep readable formulas and the conditions they used', () => {
  const tutor = loadTutor();
  const copied = tutor.answerPlainText(answer, { responseLevel: 'steps',
    context: { mode: 'experiment', originalQuestion: '刹车题', parameters: { initialSpeed: 20, deceleration: 5 } } });
  assert.match(copied, /^1\. 末速度为零。/m);
  assert.match(copied, /关键公式：\\\(s = \\frac\{v_\{0\}\^\{2\}\}\{2a\}\\\)/);
  assert.match(copied, /题目：刹车题/);
  assert.match(copied, /参数：初速度 20；减速度 5/);
});
