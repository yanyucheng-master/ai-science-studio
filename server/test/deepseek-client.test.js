import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTutorGuardrails, DeepSeekClient, shouldUseThinkingMode } from '../src/deepseek-client.js';

function jsonResponse(content) {
  return {
    ok: true,
    status: 200,
    async json() {
      return { choices: [{ message: { content } }] };
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
  assert.equal(requests[0].model, 'deepseek-v4-pro');
  assert.deepEqual(requests[0].thinking, { type: 'disabled' });
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

test('uses thinking mode only for full tutor steps', async () => {
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
  await client.chat({ ...base, responseLevel: 'hint' });
  await client.chat({ ...base, responseLevel: 'steps' });
  assert.deepEqual(requests[0].thinking, { type: 'disabled' });
  assert.deepEqual(requests[1].thinking, { type: 'enabled' });
  assert.equal(requests[0].temperature, 0.2);
  assert.equal(Object.hasOwn(requests[1], 'temperature'), false);
  assert.equal(requests[1].max_tokens, 4200);
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

test('uses fast mode for a targeted follow-up instead of restarting long reasoning', async () => {
  const targeted = {
    responseLevel: 'steps',
    history: [{ role: 'assistant', content: '前面已经求出相对加速度。' }],
    message: '不要重复前面的步骤，只补充热量和能量核对。',
    context: { mode: 'question', subject: '物理', originalQuestion: '木板滑块问题' }
  };
  assert.equal(shouldUseThinkingMode(targeted), false);
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
