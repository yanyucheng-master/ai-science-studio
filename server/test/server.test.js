import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createMasterLabServer, RateLimiter } from '../src/server.js';

async function withServer(run, options = {}) {
  const server = createMasterLabServer({
    deepSeekClient: options.deepSeekClient || { configured: false },
    allowedOrigins: []
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
    assert.equal(body.model, 'deepseek-v4-pro');
    assert.equal(body.modelVersion, 'DeepSeek-V4-Pro-0813');
    assert.equal(body.modelLabel, 'DeepSeek V4 Pro 正式版');
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
