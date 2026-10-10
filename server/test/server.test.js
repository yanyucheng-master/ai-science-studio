import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createMasterLabServer, RateLimiter } from '../src/server.js';
import { DeepSeekClient } from '../src/deepseek-client.js';

async function withServer(run, options = {}) {
  const server = createMasterLabServer({
    deepSeekClient: options.deepSeekClient || { configured: false },
    allowedOrigins: [],
    rateLimiter: options.rateLimiter
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('returns local experiment guidance from the generic chat endpoint when offline', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/tutor/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '给我一点提示',
        responseLevel: 'hint',
        context: {
          mode: 'experiment',
          subject: '物理',
          templateId: 'brake',
          parameters: { initialSpeed: 20, deceleration: 5 },
          formula: 's = v₀²/(2a)'
        }
      })
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.mode, 'hint');
    assert.equal(body.source, 'local_fallback');
    assert.match(body.summary, /停车距离|初速度/);
  });
});

test('does not fabricate an offline answer for a question without a template', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/tutor/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '请给出具体步骤',
        responseLevel: 'steps',
        context: { mode: 'question', subject: '物理', originalQuestion: '求自由落体时间' }
      })
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, 'AI_NOT_CONFIGURED');
  });
});

for (const experiment of [false, true]) {
  test(`a stalled upstream body ${experiment ? 'uses labelled local guidance for an experiment' : 'returns HTTP 504 AI_TIMEOUT for a question'}`, async () => {
    let calls = 0;
    const deepSeekClient = new DeepSeekClient({
      apiKey: 'test-only', timeoutMs: 5,
      fetchImpl: async (_url, options) => {
        calls += 1;
        return new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"choices":['));
            options.signal.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')));
          }
        }));
      }
    });
    await withServer(async baseUrl => {
      const response = await fetch(`${baseUrl}/api/v1/tutor/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '给我一点提示', responseLevel: 'hint', context: experiment
          ? { mode: 'experiment', templateId: 'brake', parameters: { initialSpeed: 20, deceleration: 5 } }
          : { mode: 'question', originalQuestion: '求自由落体时间' } })
      });
      const body = await response.json();
      assert.equal(calls, 1);
      if (experiment) {
        assert.equal(response.status, 200);
        assert.equal(body.source, 'local_fallback');
        assert.equal(body.mode, 'hint');
        assert.equal(body.finalAnswer, null);
      } else {
        assert.equal(response.status, 504);
        assert.equal(body.error, 'AI_TIMEOUT');
      }
    }, { deepSeekClient });
  });
}

test('returns a validated structured DeepSeek tutor reply', async () => {
  const deepSeekClient = {
    configured: true,
    async chat() {
      return {
        mode: 'steps',
        summary: '先确定研究对象。',
        steps: ['列出已知条件', '选择公式'],
        formulas: ['h = 1/2 gt²'],
        finalAnswer: '代入题目数值后求 t',
        checks: ['时间单位应为 s'],
        followUp: '题目给出的高度是多少？',
        parameterPatch: null,
        warnings: []
      };
    }
  };
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/tutor/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '请给出具体步骤',
        responseLevel: 'steps',
        context: { mode: 'question', subject: '物理', originalQuestion: '求自由落体时间' }
      })
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.source, 'deepseek');
    assert.equal(body.steps.length, 2);
    assert.match(body.warnings.join(''), /AI 讲解/);
  }, { deepSeekClient });
});

test('does not reject a valid explain-mode DeepSeek reply', async () => {
  const deepSeekClient = {
    configured: true,
    async chat() {
      return {
        mode: 'explain',
        summary: '静摩擦力不是固定等于最大静摩擦力。',
        steps: ['先求维持相对静止所需的静摩擦力，再与最大静摩擦力比较。'],
        formulas: ['0 ≤ f_s ≤ μ_sN'],
        finalAnswer: null,
        checks: [],
        followUp: '所需静摩擦力是否超过上限？',
        parameterPatch: null,
        warnings: []
      };
    }
  };
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/tutor/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '解释为什么静摩擦力不一定等于μ_sN。',
        responseLevel: 'explain',
        context: { mode: 'question', subject: '物理', originalQuestion: '木板滑块问题' }
      })
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).mode, 'explain');
  }, { deepSeekClient });
});

test('reports health without exposing secrets', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.model, 'deepseek-flash');
    assert.equal(body.modelVersion, 'DeepSeek-V4.1-Flash');
    assert.equal(body.modelLabel, 'DeepSeek V4.1 Flash');
    assert.equal(body.thinking, 'enabled');
    assert.equal(body.reasoningEffort, 'max');
    assert.equal(body.aiConfigured, false);
    assert.equal(JSON.stringify(body).includes('apiKey'), false);
  });
});

test('generates a local offline experiment when AI is unavailable', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/experiment/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: '汽车以20m/s行驶，制动减速度为5m/s²' })
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.mode, 'experiment');
    assert.equal(body.plan.modules[0].templateId, 'brake');
    assert.equal(body.source, 'local_fallback');
  });
});

test('converts copper sulfate amount in mol to the shared chemistry mass parameter', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/experiment/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: '将5.6g铁粉加入0.20mol硫酸铜溶液中，求生成铜的质量' })
    });
    const body = await response.json();
    assert.equal(body.mode, 'experiment');
    assert.equal(body.plan.modules[0].templateId, 'fe_cuso4');
    assert.equal(body.plan.modules[0].parameters.ironMass, 5.6);
    assert.equal(body.plan.modules[0].parameters.copperSulfateMass, 32);
  });
});

test('does not fake an answer for an unmatched offline question', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/experiment/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: '解释量子纠缠中的贝尔不等式' })
    });
    const body = await response.json();
    assert.equal(body.mode, 'unavailable');
    assert.equal(body.source, 'local_fallback');
  });
});

test('does not misclassify an initial-velocity oscillator question as braking', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/experiment/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: '耦合振子初速度为零，求两个简正模频率' })
    });
    const body = await response.json();
    assert.equal(body.mode, 'unavailable');
    assert.equal(body.source, 'local_fallback');
  });
});

test('returns template-specific local tutor guidance for compatibility experiments', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/tutor/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: {
          title: '通电螺线管',
          subject: 'physics',
          modules: [{ id: 'm1', templateId: 'solenoid', parameters: { current: 0.5, turns: 200 } }],
          links: [],
          steps: ['观察磁场']
        },
        message: '怎样比较磁场强弱？'
      })
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.match(body.message, /电流|匝数/);
    assert.doesNotMatch(body.message, /植物细胞|动物细胞/);
  });
});

test('does not invent missing chemistry quantities from formula subscripts', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/experiment/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Fe 与 CuSO4 发生置换反应' })
    });
    const body = await response.json();
    assert.equal(body.mode, 'unavailable');
    assert.equal(body.plan, null);
    assert.match(body.answer, /补充铁的质量/);
  });
});

test('does not invent missing braking parameters in offline fallback', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/experiment/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: '一辆汽车紧急刹车，求停止距离' })
    });
    const body = await response.json();
    assert.equal(body.mode, 'unavailable');
    assert.match(body.answer, /初速度和刹车加速度/);
  });
});

test('bounds rate-limiter memory even with many distinct client keys', () => {
  const limiter = new RateLimiter(30, 600_000);
  for (let index = 0; index < 10_050; index += 1) {
    assert.equal(limiter.allow(`client-${index}`, 1_000), true);
  }
  assert.ok(limiter.entries.size <= 10_000);
});

test('a zero limit disables address quotas without retaining client addresses', () => {
  const limiter = new RateLimiter(0, 600_000);
  for (let index = 0; index < 12_000; index += 1) {
    assert.equal(limiter.allow('same-client', 1_000), true);
    assert.equal(limiter.allow(`client-${index}`, 1_000), true);
  }
  assert.equal(limiter.entries.size, 0);
});

test('an explicitly enabled address quota still expires correctly', () => {
  const limiter = new RateLimiter(2, 600_000);
  assert.equal(limiter.allow('client', 1_000), true);
  assert.equal(limiter.allow('client', 1_001), true);
  assert.equal(limiter.allow('client', 1_002), false);
  assert.equal(limiter.allow('client', 601_000), true);
});

test('disabled quotas allow more than ten same-address POSTs without calling AI', async () => {
  const rateLimiter = new RateLimiter(0, 600_000);
  await withServer(async baseUrl => {
    for (let index = 0; index < 12; index += 1) {
      const response = await fetch(`${baseUrl}/api/v1/experiment/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
      });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error, 'INVALID_QUESTION');
    }
    const health = await (await fetch(`${baseUrl}/health`)).json();
    assert.equal(health.perAddressRateLimitEnabled, false);
    assert.equal(health.maxConcurrentAiRequests, 2);
  }, { rateLimiter });
  assert.equal(rateLimiter.entries.size, 0);
});

// 2026-10-10: production returned 503 AI_UNAVAILABLE ("余额不足或临时故障") for unusable model
// output. Unusable answers are now 502 INVALID_AI_RESPONSE with a reason code, and logs carry
// only failure codes, never the question or answer text.
test('unusable tutor answers are reported as such, with a reason and content-free logs', async () => {
  const logs = [];
  const originalInfo = console.info;
  console.info = (line) => logs.push(String(line));
  let calls = 0;
  const deepSeekClient = new DeepSeekClient({
    apiKey: 'test-only',
    timeoutMs: 1000,
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, status: 200, async json() { return { model: 'deepseek-flash', choices: [{ message: { content: '秘密答案 not-json' }, finish_reason: 'stop' }] }; } };
    }
  });
  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/tutor/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '学生的私人问题', responseLevel: 'steps', context: { mode: 'question', subject: '物理', originalQuestion: '求自由落体时间' } })
      });
      assert.equal(response.status, 502);
      assert.deepEqual(await response.json(), { error: 'INVALID_AI_RESPONSE', reason: 'INVALID_JSON' });
    }, { deepSeekClient });
  } finally {
    console.info = originalInfo;
  }
  assert.equal(calls, 3);
  const entry = logs.map((line) => JSON.parse(line)).find((item) => item.path === '/api/v1/tutor/chat');
  assert.deepEqual(entry.aiError, { code: 'INVALID_AI_RESPONSE', reason: 'INVALID_JSON', attempts: 3 });
  assert.equal(logs.join('\n').includes('秘密答案') || logs.join('\n').includes('学生的私人问题'), false);
});

test('a tutor answer with single-backslash LaTeX is served instead of an outage', async () => {
  const content = String.raw`{"mode":"steps","summary":"","steps":["列式：\(h=\frac{1}{2}gt^{2}\)","结论：\(t=3\ \mathrm{s}\)"],"formulas":["h=\frac{1}{2}gt^{2}"],"finalAnswer":"结论：\(t=3\ \mathrm{s}\)","checks":[],"followUp":"","suggestedQuestions":["若高度变为 80m，落地时间是多少？"],"parameterPatch":null,"warnings":[]}`;
  const deepSeekClient = new DeepSeekClient({
    apiKey: 'test-only',
    timeoutMs: 1000,
    fetchImpl: async () => ({ ok: true, status: 200, async json() { return { model: 'deepseek-flash', choices: [{ message: { content }, finish_reason: 'stop' }] }; } })
  });
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/tutor/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '请完整解答', responseLevel: 'steps', context: { mode: 'question', subject: '物理', originalQuestion: '物体从 45m 高处自由下落，g 取 10m/s²，求落地时间。' } })
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.steps[0], String.raw`列式：\(h=\frac{1}{2}gt^{2}\)`);
    assert.deepEqual(body.suggestedQuestions, ['若高度变为 80m，落地时间是多少？']);
  }, { deepSeekClient });
});
