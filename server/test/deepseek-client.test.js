import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTutorGuardrails, DeepSeekClient, shouldUseThinkingMode } from '../src/deepseek-client.js';

function jsonResponse(content, finishReason = 'stop', model = 'deepseek-flash') {
  return {
    ok: true,
    status: 200,
    async json() {
      return { model, choices: [{ message: { content }, finish_reason: finishReason }] };
    }
  };
}

test('uses the fixed model and retries only once', async () => {
  let calls = 0;
  const requests = [];
  const client = new DeepSeekClient({
    apiKey: 'test-only',
    model: 'untrusted-model-override',
    timeoutMs: 1000,
    fetchImpl: async (_url, options) => {
      calls += 1;
      requests.push(JSON.parse(options.body));
      if (calls === 1) {
        throw new Error('temporary failure');
      }
      return jsonResponse('{"mode":"explanation","title":"答案","answer":"解释","plan":null,"visual":{"kind":"none","title":""}}');
    }
  });

  const result = await client.generate('测试题目');
  assert.equal(result.mode, 'explanation');
  assert.equal(calls, 2);
  assert.equal(requests[0].model, 'deepseek-flash');
  assert.deepEqual(requests[0].thinking, { type: 'enabled' });
  assert.equal(requests[0].reasoning_effort, 'max');
  assert.equal(requests[0].max_tokens, 32768);
  assert.equal(Object.hasOwn(requests[0], 'temperature'), false);
  assert.deepEqual(requests[0].response_format, { type: 'json_object' });
});

test('stops after two failed attempts', async () => {
  let calls = 0;
  const client = new DeepSeekClient({
    apiKey: 'test-only',
    timeoutMs: 1000,
    fetchImpl: async () => {
      calls += 1;
      throw new Error('offline');
    }
  });
  await assert.rejects(() => client.generate('测试题目'), /offline/);
  assert.equal(calls, 2);
});

test('does not retry permanent authentication failures', async () => {
  let calls = 0;
  const client = new DeepSeekClient({
    apiKey: 'test-only',
    timeoutMs: 1000,
    fetchImpl: async () => {
      calls += 1;
      return { ok: false, status: 401 };
    }
  });
  await assert.rejects(() => client.generate('测试题目'), /DeepSeek HTTP 401/);
  assert.equal(calls, 1);
});

test('does not retry a client-side timeout', async () => {
  let calls = 0;
  const client = new DeepSeekClient({
    apiKey: 'test-only',
    timeoutMs: 5,
    fetchImpl: async (_url, options) => {
      calls += 1;
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    }
  });
  await assert.rejects(() => client.generate('测试题目'), /timed out/);
  assert.equal(calls, 1);
});

test('preserves timeout classification when the response body stalls after HTTP 200', async () => {
  let calls = 0;
  const client = new DeepSeekClient({
    apiKey: 'test-only',
    timeoutMs: 5,
    fetchImpl: async (_url, options) => {
      calls += 1;
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"choices":['));
          options.signal.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')));
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    }
  });
  await assert.rejects(client.generate('测试题目'), { code: 'AI_TIMEOUT', retryable: false });
  assert.equal(calls, 1);
});

test('does not retry an empty model answer', async () => {
  let calls = 0;
  const client = new DeepSeekClient({
    apiKey: 'test-only',
    timeoutMs: 1000,
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse('');
    }
  });
  await assert.rejects(() => client.generate('测试题目'), /empty content/);
  assert.equal(calls, 1);
});

test('does not retry invalid model JSON', async () => {
  let calls = 0;
  const client = new DeepSeekClient({
    apiKey: 'test-only',
    timeoutMs: 1000,
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse('not-json');
    }
  });
  await assert.rejects(() => client.generate('测试题目'), /invalid JSON/);
  assert.equal(calls, 1);
});

test('uses maximum thinking for every tutor level without changing teaching depth', async () => {
  const requests = [];
  const client = new DeepSeekClient({
    apiKey: 'test-only',
    timeoutMs: 1000,
    fetchImpl: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return jsonResponse('{"mode":"steps","summary":"分析","steps":["第一步"],"formulas":[],"finalAnswer":null,"checks":[],"followUp":"","parameterPatch":null,"warnings":[]}');
    }
  });
  const base = {
    history: [],
    message: '测试',
    context: { mode: 'question', subject: '物理', originalQuestion: '测试题' }
  };
  for (const responseLevel of ['hint', 'explain', 'steps', 'check', 'variant']) {
    await client.chat({ ...base, responseLevel });
  }
  for (const request of requests) {
    assert.deepEqual(request.thinking, { type: 'enabled' });
    assert.equal(request.reasoning_effort, 'max');
    assert.equal(Object.hasOwn(request, 'temperature'), false);
    assert.equal(request.max_tokens, 32768);
  }
  assert.match(requests[1].messages.at(-1).content, /【唯一原题】/);
  assert.match(requests[1].messages.at(-1).content, /originalQuestion: 测试题/);
});

test('extracts immutable question constraints and every requested goal', () => {
  const guardrails = buildTutorGuardrails({
    responseLevel: 'steps',
    history: [],
    message: '请完整解答并核对能量。',
    context: {
      mode: 'question',
      originalQuestion: '光滑水平地面上，A、B间动摩擦因数为0.20。判断是否相对滑动，求加速度、时间和产生的热量。'
    }
  });
  assert.match(guardrails.explicitConstraints.join(''), /地面.*光滑/);
  assert.match(guardrails.explicitConstraints.join(''), /摩擦因数.*A、B/);
  assert.deepEqual(guardrails.requestedGoals, [
    '判断是否发生相对滑动',
    '求各研究对象的加速度',
    '求过程所需时间',
    '求产生的热量',
    '核对能量关系'
  ]);
});

test('keeps maximum thinking for targeted follow-ups while restricting their answer scope', async () => {
  const targeted = {
    responseLevel: 'steps',
    history: [{ role: 'assistant', content: '前面已经求出相对加速度。' }],
    message: '不要重复前面的步骤，只补充热量和能量核对。',
    context: { mode: 'question', subject: '物理', originalQuestion: '木板滑块问题' }
  };
  assert.equal(shouldUseThinkingMode(targeted), true);
  assert.deepEqual(buildTutorGuardrails(targeted).requestedGoals, ['求产生的热量', '核对能量关系']);
  assert.match(buildTutorGuardrails(targeted).replyScope, /局部追问/);
  assert.equal(shouldUseThinkingMode({ ...targeted, history: [], message: '请给出完整步骤。' }), true);
});

test('does not turn an explicitly excluded old step into a new requested goal', () => {
  const guardrails = buildTutorGuardrails({
    responseLevel: 'steps',
    history: [{ role: 'assistant', content: '已经算完加速度。' }],
    message: '不要重复前面的受力和加速度计算，只解释这一点：为什么热量使用相对位移？',
    context: { mode: 'question', subject: '物理', originalQuestion: '木板滑块问题' }
  });
  assert.deepEqual(guardrails.requestedGoals, ['求产生的热量']);
});

test('parameter suggestions use the same fixed maximum-thinking profile', async () => {
  let request;
  const client = new DeepSeekClient({
    apiKey: 'test-only',
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return jsonResponse('{"message":"先比较两次实验","patch":null}');
    }
  });
  await client.tutor({}, '如何比较？');
  assert.equal(request.model, 'deepseek-flash');
  assert.equal(request.reasoning_effort, 'max');
  assert.deepEqual(request.thinking, { type: 'enabled' });
});

for (const finishReason of ['length', 'content_filter', 'aborted', 'insufficient_system_resource', undefined]) {
  test(`rejects incomplete upstream output even when JSON is valid (${finishReason})`, async () => {
    let calls = 0;
    const client = new DeepSeekClient({
      apiKey: 'test-only',
      fetchImpl: async () => {
        calls += 1;
        const result = jsonResponse('{"mode":"explanation"}', finishReason);
        if (finishReason === undefined) {
          result.json = async () => ({ model: 'deepseek-flash', choices: [{ message: { content: '{}' } }] });
        }
        return result;
      }
    });
    await assert.rejects(client.generate('测试'), { code: 'INVALID_AI_RESPONSE', retryable: false });
    assert.equal(calls, 1);
    assert.equal(client.activeRequests, 0);
  });
}

test('rejects a different upstream model without retrying or accepting its answer', async () => {
  let calls = 0;
  const client = new DeepSeekClient({
    apiKey: 'test-only',
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse('{}', 'stop', 'deepseek-v4-pro');
    }
  });
  await assert.rejects(client.generate('测试'), { code: 'AI_MODEL_MISMATCH', retryable: false });
  assert.equal(calls, 1);
});

test('limits concurrent upstream calls and releases slots after completion', async () => {
  const releases = [];
  let calls = 0;
  const client = new DeepSeekClient({
    apiKey: 'test-only',
    maxConcurrentRequests: 2,
    fetchImpl: async () => {
      calls += 1;
      await new Promise(resolve => releases.push(resolve));
      return jsonResponse('{}');
    }
  });
  const first = client.generate('一');
  const second = client.generate('二');
  await assert.rejects(client.generate('三'), { code: 'AI_BUSY', retryable: false });
  assert.equal(calls, 2);
  assert.equal(client.activeRequests, 2);
  releases.forEach(resolve => resolve());
  await Promise.all([first, second]);
  assert.equal(client.activeRequests, 0);
});

test('unmatched HarmonyOS questions ask the model for a standalone explanation, not a route-only notice', async () => {
  let request;
  const client = new DeepSeekClient({
    apiKey: 'test-only',
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return jsonResponse('{}');
    }
  });
  await client.generate('圆周运动问题');
  assert.match(request.messages[0].content, /不会再调用导师接口/);
  assert.match(request.messages[0].content, /最终数值和单位/);
});
