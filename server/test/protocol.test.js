import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findMissingTutorCoverage,
  findDeterministicTutorIssues,
  findTutorTopicMismatches,
  latestTutorQuestion,
  isTargetedTutorFollowUp,
  sanitizeTutorChatRequest,
  validateExperimentPlan,
  validateModelResponse,
  validateTutorChatResponse,
  validateTutorResponse,
  validateVisualSpec
} from '../src/protocol.js';

test('confusion follows the previous explanation without requiring every original topic again', () => {
  const request = sanitizeTutorChatRequest({ message: '我还是没懂，换一种说法', responseLevel: 'explain',
    history: [{ role: 'assistant', content: '先看向心力方向。' }],
    context: { mode: 'question', originalQuestion: '小球在圆形轨道中运动，求速度和支持力。' } });
  assert.equal(isTargetedTutorFollowUp(request), true);
  assert.deepEqual(findTutorTopicMismatches(request, { summary: '你卡在受力方向，还是把力代入公式这一步？' }), []);
  assert.equal(isTargetedTutorFollowUp({ ...request, message: '请从头完整解答所有小问' }), false);
});

test('experiment quotes can start a targeted discussion without prior chat history', () => {
  const request = sanitizeTutorChatRequest({
    message: '【引用片段，仅作提问材料】\n1. 实验公式："s=v²/2a"\n【本次问题】\n这个关系为什么成立？',
    responseLevel: 'explain', history: [], context: { mode: 'question', originalQuestion: '小球沿圆形轨道运动。' }
  });
  assert.equal(isTargetedTutorFollowUp(request), true);
  assert.deepEqual(findTutorTopicMismatches(request, { summary: '这个公式要求加速度恒定，应先确认是否满足。' }), []);
});

test('history character limits keep the latest turns rather than the oldest accepted turns', () => {
  const history = Array.from({ length: 12 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: `${index}:` + '长'.repeat(1490) }));
  const request = sanitizeTutorChatRequest({ message: '再解释最后一步', history, context: { mode: 'question' } });
  assert.match(request.history.at(-1).content, /^11:/);
  assert.ok(request.history.reduce((sum, entry) => sum + entry.content.length, 0) <= 8000);
});

test('optional follow-up suggestions cannot turn malformed metadata into an invalid answer', () => {
  const request = sanitizeTutorChatRequest({ message: '为什么分母不能为零？', responseLevel: 'explain', context: { mode: 'question' } });
  const question = '分母趋近于零时，分式的值会怎样变化？';
  const result = validateTutorChatResponse({ mode: 'explain', summary: '除法中的除数不能为零。',
    suggestedQuestions: [null, {}, 'Yes', '查看完整步骤', '<img src=x>', 'https://example.com', question, ` ${question} `] }, request);
  assert.equal(result.summary, '除法中的除数不能为零。');
  assert.deepEqual(result.suggestedQuestions, [question]);
  const legacy = validateTutorChatResponse({ mode: 'explain', summary: '除数不能为零。' }, request);
  assert.deepEqual(legacy.suggestedQuestions, []);
  const clarification = validateTutorChatResponse({ mode: 'clarification', summary: '请提供分式。', suggestedQuestions: [question] }, request);
  assert.deepEqual(clarification.suggestedQuestions, []);
});

test('quoted old goals do not expand a targeted follow-up into the full original problem', () => {
  const request = sanitizeTutorChatRequest({
    message: '【引用片段，仅作提问材料】\n1. AI 回答："求加速度、所需时间、产生的热量，并核对能量关系。"\n【本次问题】\n请解释这里为什么用能量守恒。\n\n【回答规范】覆盖全部小问。',
    responseLevel: 'explain', history: [{ role: 'assistant', content: '先分析摩擦力。' }],
    context: { mode: 'question', originalQuestion: '求加速度、所需时间、产生的热量，并核对能量关系。' }
  });
  assert.equal(latestTutorQuestion(request), '请解释这里为什么用能量守恒。');
  const missing = findMissingTutorCoverage(request, { summary: '需要把机械能和内能一同考虑。', steps: [], formulas: [] });
  assert.ok(!missing.includes('产生的热量'));
  assert.ok(!missing.includes('所需时间'));
  const focused = { ...request, context: { ...request.context, originalQuestion: '小球在光滑圆形轨道上运动，求多个位置的速度。' } };
  assert.deepEqual(findTutorTopicMismatches(focused, { summary: '没有非保守力做功时机械能守恒。' }), []);
});

test('rejects a tutor reply that silently changes the scientific model', () => {
  const request = sanitizeTutorChatRequest({
    message: '请完整解答。',
    responseLevel: 'steps',
    context: {
      mode: 'question',
      subject: '物理',
      originalQuestion: '小球在光滑竖直圆形轨道内侧运动，求最低点速度。'
    }
  });
  const offTopic = {
    mode: 'clarification',
    summary: '请补充滑块质量和碰撞类型。',
    steps: [],
    formulas: [],
    finalAnswer: null,
    checks: [],
    warnings: []
  };
  assert.deepEqual(findTutorTopicMismatches(request, offTopic), ['圆形轨道']);
  assert.equal(validateTutorChatResponse(offTopic, request), null);
});

test('rejects an induction answer whose numeric acceleration drops the circuit resistance', () => {
  const request = sanitizeTutorChatRequest({
    message: '请完整解答。',
    responseLevel: 'steps',
    context: {
      mode: 'question',
      subject: '物理',
      originalQuestion: '质量0.20kg、长度0.50m的金属棒在磁场B=0.80T中运动，回路电阻R=2.0Ω，拉力F=1.0N，求a(v)。'
    }
  });
  const wrong = {
    mode: 'steps',
    summary: '导体棒切割磁感线。',
    steps: ['a(v)=(1.0-0.16v)/0.20'],
    formulas: ['a(v)=(F-B²L²v/R)/m'],
    finalAnswer: 'a(v)=(1.0-0.16v)/0.20',
    checks: ['代回正确。'],
    warnings: []
  };
  const correct = {
    ...wrong,
    steps: ['a(v)=(1.0-0.08v)/0.20=5-0.4v'],
    finalAnswer: 'a(v)=5-0.4v'
  };
  assert.deepEqual(findDeterministicTutorIssues(request, wrong), ['INDUCTION_ROD_ACCELERATION_MISMATCH']);
  assert.equal(validateTutorChatResponse(wrong, request), null);
  assert.deepEqual(findDeterministicTutorIssues(request, correct), []);
  assert.ok(validateTutorChatResponse(correct, request));
});

test('accepts explain mode for explain-level tutor replies', () => {
  const request = sanitizeTutorChatRequest({
    message: '请解释为什么这里要先判断是否相对滑动。',
    responseLevel: 'explain',
    context: { mode: 'question', subject: '物理', originalQuestion: '木板滑块问题' }
  });
  const result = validateTutorChatResponse({
    mode: 'explain',
    summary: '先检验静摩擦力是否足够。',
    steps: ['假设相对静止，再比较所需静摩擦力与最大静摩擦力。'],
    formulas: [],
    finalAnswer: null,
    checks: [],
    followUp: '',
    parameterPatch: null,
    warnings: []
  }, request);
  assert.equal(result?.mode, 'explain');
});

test('flags missing requested sub-answers in a full solution', () => {
  const request = sanitizeTutorChatRequest({
    message: '请给出完整步骤并核对能量。',
    responseLevel: 'steps',
    context: {
      mode: 'question',
      subject: '物理',
      originalQuestion: '判断A、B是否相对滑动，求滑块离开木板的时间和产生的热量。'
    }
  });
  const response = {
    summary: 'A、B会发生相对滑动。',
    steps: ['A、B会发生相对滑动，再计算相对加速度。', '时间 t = 1.15 s。'],
    formulas: ['t = 1.15 s'],
    finalAnswer: '经过1.15 s滑块离开木板。',
    checks: []
  };
  assert.deepEqual(findMissingTutorCoverage(request, response), ['产生的热量', '能量核对']);
});

test('hidden verification and an omitted summary cannot satisfy visible answer coverage', () => {
  const request = sanitizeTutorChatRequest({
    message: '请完整解答并核对能量。', responseLevel: 'steps',
    context: { mode: 'question', subject: '物理', originalQuestion: '求产生的热量并核对能量关系。' }
  });
  const response = {
    mode: 'steps', summary: '热量 Q=4 J，符合能量守恒。',
    steps: ['分析受力，再计算运动过程。'], formulas: [], finalAnswer: '运动时间为 1 s。',
    checks: ['热量 Q=4 J，符合能量守恒。']
  };
  assert.deepEqual(findMissingTutorCoverage(request, response), ['产生的热量', '能量核对']);
  const validated = validateTutorChatResponse(response, request);
  assert.match(validated.warnings.join(''), /完整性提醒.*产生的热量.*能量核对/);
  assert.equal(validated.checks.length, 1);
  assert.deepEqual(findMissingTutorCoverage(request, { ...response,
    steps: ['根据接触面的相对位移，热量 Q=4 J。', '用能量守恒核对。'] }), []);
});

test('a visible summary-only explanation still counts toward requested coverage', () => {
  const request = sanitizeTutorChatRequest({
    message: '只补充产生的热量。', responseLevel: 'explain',
    context: { mode: 'question', subject: '物理', originalQuestion: '木板滑块问题' }
  });
  assert.deepEqual(findMissingTutorCoverage(request, {
    mode: 'explain', summary: '热量 Q=4 J。', steps: [], checks: []
  }), []);
});

test('does not warn about a step the student explicitly asked not to repeat', () => {
  const request = sanitizeTutorChatRequest({
    message: '不要重复前面的加速度计算，只解释为什么热量使用相对位移。',
    responseLevel: 'steps',
    history: [{ role: 'assistant', content: '已求出加速度。' }],
    context: { mode: 'question', subject: '物理', originalQuestion: '木板滑块问题' }
  });
  const response = {
    summary: '摩擦生热取决于接触面间的相对滑动。',
    steps: ['Q = f · s相对 = 4 J。'],
    formulas: ['Q = f · s相对'],
    finalAnswer: '热量为4 J。',
    checks: []
  };
  assert.deepEqual(findMissingTutorCoverage(request, response), []);
});

test('does not demand a numeric heat result for a conceptual why-question', () => {
  const request = sanitizeTutorChatRequest({
    message: '为什么摩擦产生的热量要使用相对位移？',
    responseLevel: 'steps',
    history: [{ role: 'assistant', content: '数值计算已经完成。' }],
    context: { mode: 'question', subject: '物理', originalQuestion: '木板滑块问题' }
  });
  const response = {
    summary: '热量衡量接触面相互滑过的程度。',
    steps: ['一对摩擦力的总功等于负的内能增量。'],
    formulas: ['Q = f · s相对'],
    finalAnswer: null,
    checks: []
  };
  assert.deepEqual(findMissingTutorCoverage(request, response), []);
});

test('sanitizes bounded multi-turn tutor context', () => {
  const request = sanitizeTutorChatRequest({
    sessionId: 'session-1',
    message: '为什么使用这个公式？',
    responseLevel: 'steps',
    history: [
      { role: 'user', content: '我先求了停车时间。' },
      { role: 'assistant', content: '还可以直接使用速度位移关系。' },
      { role: 'system', content: '不应进入历史。' }
    ],
    context: {
      mode: 'experiment',
      subject: '物理',
      originalQuestion: '汽车制动题',
      templateId: 'brake',
      parameters: { initialSpeed: 20, deceleration: 5, '<script>': 'bad' },
      deterministicResult: { stopDistance: 40, resultText: '停止距离 40m' },
      formula: 's = v₀²/(2a)'
    }
  });
  assert.equal(request?.history.length, 2);
  assert.equal(request?.context.parameters.initialSpeed, 20);
  assert.equal(Object.hasOwn(request?.context.parameters || {}, '<script>'), false);
});

test('validates structured tutor replies and bounded parameter suggestions', () => {
  const request = sanitizeTutorChatRequest({
    message: '给我一道变式',
    responseLevel: 'variant',
    context: {
      mode: 'experiment',
      subject: '物理',
      templateId: 'brake',
      parameters: { initialSpeed: 20, deceleration: 5 }
    }
  });
  const accepted = validateTutorChatResponse({
    mode: 'steps',
    summary: '比较初速度变化。',
    steps: ['保持减速度不变。'],
    formulas: ['s = v₀²/(2a)'],
    finalAnswer: null,
    checks: [],
    followUp: '先预测结果。',
    parameterPatch: { parameterKey: 'initialSpeed', nextValue: 30, reason: '观察平方关系' },
    warnings: []
  }, request);
  const rejected = validateTutorChatResponse({
    mode: 'steps',
    summary: '越界建议。',
    parameterPatch: { parameterKey: 'initialSpeed', nextValue: 300, reason: '错误范围' }
  }, request);
  assert.equal(accepted?.parameterPatch?.nextValue, 30);
  assert.equal(rejected?.parameterPatch, null);
});

test('never exposes a final answer in hint mode', () => {
  const request = sanitizeTutorChatRequest({
    message: '给一点提示',
    responseLevel: 'hint',
    context: { mode: 'question', subject: '数学', originalQuestion: '求方程的根' }
  });
  const result = validateTutorChatResponse({
    mode: 'hint',
    summary: '先把方程整理成标准形式。',
    finalAnswer: 'x=2',
    warnings: []
  }, request);
  assert.equal(result?.finalAnswer, null);
  assert.match(result?.warnings[0] || '', /AI 讲解/);
});

test('accepts a bounded native experiment plan', () => {
  const result = validateModelResponse({
    mode: 'experiment',
    title: '制动距离',
    answer: '使用匀减速模型。',
    plan: {
      title: '制动距离',
      subject: 'physics',
      modules: [
        {
          id: 'm1',
          templateId: 'brake',
          parameters: { initialSpeed: 20, deceleration: 5 }
        }
      ],
      links: [],
      steps: ['提取条件', '计算停车距离']
    }
  });
  assert.equal(result?.mode, 'experiment');
  assert.equal(result?.plan.modules[0].parameters.initialSpeed, 20);
});

test('rejects parameters outside deterministic limits', () => {
  const result = validateExperimentPlan({
    title: '错误制动实验',
    subject: 'physics',
    modules: [
      {
        id: 'm1',
        templateId: 'brake',
        parameters: { initialSpeed: 500, deceleration: 0 }
      }
    ],
    links: [],
    steps: ['计算']
  });
  assert.equal(result, null);
});

test('accepts every bundled compatibility template with renderer-aligned parameters', () => {
  const presets = [
    ['solenoid', { current: 0.5, turns: 200 }],
    ['board_slider', { initialSpeed: 4, boardLength: 2 }],
    ['projectile', { horizontalSpeed: 12, height: 20 }],
    ['ohm_circuit', { voltage: 6, resistance: 3 }],
    ['lever', { leftForce: 4, leftArm: 30 }],
    ['lens', { objectDistance: 30, focalLength: 10 }],
    ['buoyancy', { displacedVolume: 300, density: 1000 }],
    ['friction', { normalForce: 10, frictionCoefficient: 0.3 }],
    ['lamp_power', { voltage: 2.5, current: 0.3 }],
    ['series_circuit', { voltage: 6, resistance: 8 }],
    ['heat_balance', { hotWaterMass: 100, hotTemperature: 80 }],
    ['liquid_pressure', { depthCm: 30, density: 1000 }],
    ['efficiency', { loadForce: 30, pullForce: 12 }],
    ['sound', { frequency: 440, amplitudePercent: 50 }]
  ];

  for (const [templateId, parameters] of presets) {
    const result = validateExperimentPlan({
      title: `兼容模板 ${templateId}`,
      subject: 'physics',
      modules: [{ id: 'm1', templateId, parameters }],
      links: [],
      steps: ['观察参数变化']
    });
    assert.equal(result?.modules[0].templateId, templateId);
    assert.deepEqual(result?.modules[0].parameters, parameters);
  }
});

test('rejects obsolete parameter keys that do not match the bundled renderer', () => {
  const result = validateExperimentPlan({
    title: '错误热平衡协议',
    subject: 'physics',
    modules: [{
      id: 'm1',
      templateId: 'heat_balance',
      parameters: { hotTemperature: 80, coldTemperature: 20 }
    }],
    links: [],
    steps: ['计算温度']
  });
  assert.equal(result, null);
});

test('rejects incomplete plans instead of silently relying on client defaults', () => {
  const result = validateExperimentPlan({
    title: '参数不完整的制动实验',
    subject: 'physics',
    modules: [{ id: 'm1', templateId: 'brake', parameters: { initialSpeed: 20 } }],
    links: [],
    steps: ['计算']
  });
  assert.equal(result, null);
});

test('rejects fractional enum and turn-count parameters', () => {
  const cell = validateExperimentPlan({
    title: '错误细胞类型',
    subject: 'biology',
    modules: [{ id: 'm1', templateId: 'cell', parameters: { cellType: 0.5 } }],
    links: [],
    steps: ['观察']
  });
  const solenoid = validateExperimentPlan({
    title: '错误匝数',
    subject: 'physics',
    modules: [{ id: 'm1', templateId: 'solenoid', parameters: { current: 0.5, turns: 200.5 } }],
    links: [],
    steps: ['观察']
  });
  assert.equal(cell, null);
  assert.equal(solenoid, null);
});

test('rejects combinations outside the six-pair whitelist', () => {
  const result = validateExperimentPlan({
    title: '非法组合',
    subject: 'physics',
    modules: [
      { id: 'a', templateId: 'brake', parameters: { initialSpeed: 20, deceleration: 5 } },
      { id: 'b', templateId: 'cell', parameters: { cellType: 1 } }
    ],
    links: [{ from: 'a', to: 'b', mapping: 'anything' }],
    steps: ['尝试组合']
  });
  assert.equal(result, null);
});

test('accepts a complete combination from the six-pair whitelist', () => {
  const result = validateExperimentPlan({
    title: '摩擦与制动组合',
    subject: 'physics',
    modules: [
      { id: 'a', templateId: 'friction', parameters: { normalForce: 10, frictionCoefficient: 0.3 } },
      { id: 'b', templateId: 'brake', parameters: { initialSpeed: 20, deceleration: 5 } }
    ],
    links: [{ from: 'a', to: 'b', mapping: '由摩擦分析制动减速度' }],
    steps: ['先分析摩擦力', '再分析制动距离']
  });
  assert.equal(result?.modules.length, 2);
  assert.equal(result?.links[0].from, 'a');
  assert.equal(result?.links[0].to, 'b');
});

test('accepts only bounded tutor patches for existing parameters', () => {
  const plan = validateExperimentPlan({
    title: '制动距离',
    subject: 'physics',
    modules: [{ id: 'm1', templateId: 'brake', parameters: { initialSpeed: 20, deceleration: 5 } }],
    links: [],
    steps: ['观察变化']
  });
  const accepted = validateTutorResponse({
    message: '比较更高初速度。',
    patch: { parameterKey: 'initialSpeed', nextValue: 30, reason: '观察平方关系' }
  }, plan);
  const rejected = validateTutorResponse({
    message: '越界建议。',
    patch: { parameterKey: 'initialSpeed', nextValue: 300, reason: '错误范围' }
  }, plan);
  assert.equal(accepted?.patch?.nextValue, 30);
  assert.equal(rejected, null);
});

test('never accepts arbitrary SVG or code as a visual', () => {
  const result = validateVisualSpec({
    kind: 'svg',
    title: '危险内容',
    svg: '<svg onload="alert(1)"></svg>',
    code: 'execute()'
  });
  assert.deepEqual(result, { kind: 'none', title: '' });
});

test('accepts bounded function points for explanation mode', () => {
  const result = validateModelResponse({
    mode: 'explanation',
    title: '一次函数图像',
    answer: '斜率决定直线的倾斜程度。',
    plan: null,
    visual: {
      kind: 'function_plot',
      title: 'y=2x+1 的采样点',
      points: [{ x: -1, y: -1 }, { x: 0, y: 1 }, { x: 1, y: 3 }]
    }
  });
  assert.equal(result?.visual.kind, 'function_plot');
  assert.equal(result?.visual.points.length, 3);
});

test('rejects finite but renderer-hostile visual magnitudes', () => {
  const result = validateVisualSpec({
    kind: 'data_chart',
    title: '过大数据',
    labels: ['A', 'B'],
    values: [1, 1e200]
  });
  assert.deepEqual(result, { kind: 'none', title: '' });
});
