export const TEMPLATE_IDS = Object.freeze([
  'brake',
  'fe_cuso4',
  'tangent',
  'cell',
  'solenoid',
  'board_slider',
  'projectile',
  'ohm_circuit',
  'lever',
  'lens',
  'buoyancy',
  'friction',
  'lamp_power',
  'series_circuit',
  'heat_balance',
  'liquid_pressure',
  'efficiency',
  'sound'
]);

export const NATIVE_TEMPLATE_IDS = Object.freeze(['brake', 'fe_cuso4', 'tangent', 'cell']);

export const COMBINATION_PAIRS = Object.freeze([
  'friction>brake',
  'ohm_circuit>solenoid',
  'series_circuit>lamp_power',
  'friction>board_slider',
  'liquid_pressure>buoyancy',
  'brake>tangent'
]);

export const VISUAL_KINDS = Object.freeze([
  'none',
  'function_plot',
  'data_chart',
  'relation_diagram',
  'scientific_schematic'
]);

export const SCHEMATIC_IDS = Object.freeze([
  'force_diagram',
  'ray_diagram',
  'series_circuit',
  'particle_model',
  'cell_basic'
]);

export const PARAMETER_LIMITS = Object.freeze({
  brake: Object.freeze({ initialSpeed: [5, 40], deceleration: [1, 12] }),
  fe_cuso4: Object.freeze({ ironMass: [0.5, 30], copperSulfateMass: [1, 80] }),
  tangent: Object.freeze({ coefficient: [0.25, 3], pointX: [-3, 3] }),
  cell: Object.freeze({ cellType: [0, 1] }),
  solenoid: Object.freeze({ current: [0.1, 2], turns: [100, 500] }),
  board_slider: Object.freeze({ initialSpeed: [1, 8], boardLength: [1, 5] }),
  projectile: Object.freeze({ horizontalSpeed: [2, 30], height: [1, 80] }),
  ohm_circuit: Object.freeze({ voltage: [1, 24], resistance: [1, 20] }),
  lever: Object.freeze({ leftForce: [1, 10], leftArm: [10, 50] }),
  lens: Object.freeze({ objectDistance: [6, 60], focalLength: [5, 25] }),
  buoyancy: Object.freeze({ displacedVolume: [50, 800], density: [700, 1300] }),
  friction: Object.freeze({ normalForce: [2, 30], frictionCoefficient: [0.1, 0.8] }),
  lamp_power: Object.freeze({ voltage: [0.5, 6], current: [0.05, 1] }),
  series_circuit: Object.freeze({ voltage: [3, 12], resistance: [2, 20] }),
  heat_balance: Object.freeze({ hotWaterMass: [50, 500], hotTemperature: [30, 95] }),
  liquid_pressure: Object.freeze({ depthCm: [5, 100], density: [700, 1300] }),
  efficiency: Object.freeze({ loadForce: [5, 80], pullForce: [3, 40] }),
  sound: Object.freeze({ frequency: [100, 1000], amplitudePercent: [10, 100] })
});

const MAX_VISUAL_MAGNITUDE = 1_000_000;
const CHAT_RESPONSE_LEVELS = Object.freeze(['hint', 'explain', 'check', 'variant', 'steps']);
const CHAT_RESPONSE_MODES = Object.freeze(['hint', 'explain', 'steps', 'answer', 'clarification', 'refusal']);
const CHAT_SUBJECTS = Object.freeze(['物理', '化学', '数学', '生物', 'physics', 'chemistry', 'mathematics', 'biology']);
const MAX_CHAT_HISTORY_ITEMS = 12;
const MAX_CHAT_HISTORY_CHARS = 8000;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function boundedVisualNumber(value) {
  return finiteNumber(value) && Math.abs(value) <= MAX_VISUAL_MAGNITUDE;
}

function shortText(value, maximum) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maximum;
}

function sanitizeText(value, maximum, fallback = '') {
  if (typeof value !== 'string') {
    return fallback;
  }
  return value.trim().slice(0, maximum);
}

const TUTOR_COVERAGE_SIGNALS = Object.freeze([
  {
    label: '是否发生相对滑动',
    requested: /(?:是否|判断).{0,10}(?:相对)?(?:滑动|运动)/,
    answered: /(?:发生|不发生|会|不会|保持|判定|确定).{0,8}(?:相对)?(?:滑动|运动|静止)/
  },
  {
    label: '加速度',
    requested: /加速度/,
    answered: /加速度|a(?:[_A-Za-z0-9₀-₉]*\s*[=＝])/i
  },
  {
    label: '所需时间',
    requested: /(?:多久|多长时间|所需时间|经过时间|时间为|(?:求|计算|、|和).{0,4}时间|求\s*t\b)/i,
    answered: /(?:时间|t\s*[=＝]).{0,30}(?:秒|\bs\b)/i
  },
  {
    label: '产生的热量',
    requested: /热量|摩擦生热|求\s*Q\b/i,
    answered: /(?:热量|摩擦生热|Q\s*[=＝]).{0,80}(?:焦耳|J)/i
  },
  {
    label: '能量核对',
    requested: /能量.{0,8}(?:核对|验证|守恒|关系)|(?:核对|验证).{0,8}能量|(?:功|机械能).{0,8}(?:核对|验证|关系)/,
    answered: /(?:外力做功|动能|机械能|能量守恒|功能关系)/
  }
]);

function tutorResponseText(response) {
  return [
    response.summary,
    ...(response.steps || []),
    ...(response.formulas || []),
    response.finalAnswer,
    ...(response.checks || [])
  ].filter(Boolean).join('\n');
}

const TUTOR_TOPIC_ANCHORS = Object.freeze([
  { requested: /圆形轨道/, answered: /圆形轨道|圆周运动/ },
  { requested: /金属棒|导体棒/, answered: /金属棒|导体棒/ },
  { requested: /匀强磁场|磁感应强度/, answered: /磁场|磁感应强度|安培力|感应电动势/ },
  { requested: /电源.{0,12}内阻|内阻.{0,12}电源/, answered: /内阻/ },
  { requested: /凸透镜/, answered: /凸透镜|薄透镜|透镜成像/ },
  { requested: /子弹/, answered: /子弹/ },
  { requested: /弹簧/, answered: /弹簧|弹性势能/ },
  { requested: /\|x.{0,20}\|=a|绝对值/, answered: /绝对值|\|x/ },
  { requested: /镁|Mg/i, answered: /镁|Mg/i },
  { requested: /铝|Al/i, answered: /铝|Al/i },
  { requested: /DNA/i, answered: /DNA/i },
  { requested: /15N/i, answered: /15N/i }
]);

export function findTutorTopicMismatches(request, response) {
  if (!request || !response || request.context?.mode !== 'question') {
    return [];
  }
  const question = request.context.originalQuestion || '';
  const responseText = tutorResponseText(response);
  return TUTOR_TOPIC_ANCHORS
    .filter((anchor) => anchor.requested.test(question) && !anchor.answered.test(responseText))
    .map((anchor) => anchor.requested.source);
}

function canonicalMathText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[−–—]/g, '-')
    .replace(/\s+/g, '')
    .replace(/\d+(?:\.\d+)?/g, (number) => String(Number(number)));
}

function readQuestionNumber(question, pattern) {
  const match = String(question || '').match(pattern);
  const value = Number(match?.[1]);
  return Number.isFinite(value) ? value : null;
}

function stableDecimal(value) {
  return Number(Number(value).toFixed(8));
}

export function findDeterministicTutorIssues(request, response) {
  if (!request || !response || request.context?.mode !== 'question') {
    return [];
  }
  const question = request.context.originalQuestion || '';
  if (!/(?:金属棒|导体棒)/.test(question) || !/a\s*\(\s*v\s*\)/i.test(question) || !/(?:磁场|磁感应强度)/.test(question)) {
    return [];
  }
  const mass = readQuestionNumber(question, /质量\s*([0-9.]+)\s*kg/i);
  const length = readQuestionNumber(question, /长度\s*([0-9.]+)\s*m/i);
  const magneticField = readQuestionNumber(question, /B\s*=\s*([0-9.]+)\s*T/i);
  const resistance = readQuestionNumber(question, /R\s*=\s*([0-9.]+)\s*Ω/i);
  const force = readQuestionNumber(question, /F\s*=\s*([0-9.]+)\s*N/i);
  if (![mass, length, magneticField, resistance, force].every((value) => Number.isFinite(value) && value > 0)) {
    return [];
  }
  const accelerationIntercept = stableDecimal(force / mass);
  const accelerationSlope = stableDecimal(magneticField ** 2 * length ** 2 / (resistance * mass));
  const text = canonicalMathText(tutorResponseText(response));
  const slopeTerm = canonicalMathText(`${accelerationSlope}v`);
  const interceptTerm = canonicalMathText(`${accelerationIntercept}-`);
  if (!text.includes(slopeTerm) || !text.includes(interceptTerm)) {
    return ['INDUCTION_ROD_ACCELERATION_MISMATCH'];
  }
  return [];
}

export function findMissingTutorCoverage(request, response) {
  if (!request || !response || !['steps', 'explain', 'check'].includes(request.responseLevel)) {
    return [];
  }
  const targetedFollowUp = Array.isArray(request.history) && request.history.length > 0 &&
    /(?:只|仅)(?:补|解释|回答|计算|核对)|补充|漏了|不要重复|上一(?:步|次|个回答)|这一(?:步|问)|刚才/.test(request.message || '');
  const rawRequestText = request.responseLevel === 'steps' && !targetedFollowUp
    ? `${request.context?.originalQuestion || ''}\n${request.message || ''}`
    : request.message || '';
  const requestText = rawRequestText.replace(/(?:不要|无需|不必|不用).{0,40}?(?:[，,。；;]|$)/g, '');
  const responseText = tutorResponseText(response);
  return TUTOR_COVERAGE_SIGNALS
    .filter((signal) => {
      if (signal.label === '产生的热量' && /(?:为什么|为何|怎么理解)/.test(requestText) &&
          !/(?:求|计算|多少|数值)/.test(requestText)) {
        return false;
      }
      return signal.requested.test(requestText) && !signal.answered.test(responseText);
    })
    .map((signal) => signal.label);
}

function sanitizeScalarRecord(value, maximumEntries = 16) {
  if (!isPlainObject(value)) {
    return {};
  }
  const result = {};
  for (const [rawKey, rawValue] of Object.entries(value).slice(0, maximumEntries)) {
    const key = sanitizeText(rawKey, 50);
    if (!key || !/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }
    if (finiteNumber(rawValue) || typeof rawValue === 'boolean') {
      result[key] = rawValue;
      continue;
    }
    if (typeof rawValue === 'string') {
      result[key] = sanitizeText(rawValue, 300);
    }
  }
  return result;
}

function sanitizeChatHistory(rawHistory) {
  if (!Array.isArray(rawHistory)) {
    return [];
  }
  const history = [];
  let totalCharacters = 0;
  for (const item of rawHistory.slice(-MAX_CHAT_HISTORY_ITEMS)) {
    if (!isPlainObject(item) || !['user', 'assistant'].includes(item.role)) {
      continue;
    }
    const content = sanitizeText(item.content, 1600);
    if (!content || totalCharacters + content.length > MAX_CHAT_HISTORY_CHARS) {
      continue;
    }
    totalCharacters += content.length;
    history.push({ role: item.role, content });
  }
  return history;
}

function validateParameters(templateId, parameters) {
  if (!isPlainObject(parameters)) {
    return null;
  }
  const limits = PARAMETER_LIMITS[templateId];
  if (!limits) {
    return null;
  }
  const expectedKeys = Object.keys(limits);
  const providedKeys = Object.keys(parameters);
  if (providedKeys.length !== expectedKeys.length) {
    return null;
  }
  const sanitized = {};
  for (const key of expectedKeys) {
    const value = parameters[key];
    const range = limits[key];
    if (!range || !finiteNumber(value) || value < range[0] || value > range[1]) {
      return null;
    }
    if ((templateId === 'cell' && key === 'cellType' && value !== 0 && value !== 1) ||
      (templateId === 'solenoid' && key === 'turns' && !Number.isInteger(value))) {
      return null;
    }
    sanitized[key] = value;
  }
  return sanitized;
}

export function validateExperimentPlan(rawPlan) {
  if (!isPlainObject(rawPlan) || !Array.isArray(rawPlan.modules)) {
    return null;
  }
  if (rawPlan.modules.length < 1 || rawPlan.modules.length > 2) {
    return null;
  }
  const modules = [];
  const moduleIds = new Set();
  for (const rawModule of rawPlan.modules) {
    if (!isPlainObject(rawModule) || !shortText(rawModule.id, 40) || !TEMPLATE_IDS.includes(rawModule.templateId)) {
      return null;
    }
    if (moduleIds.has(rawModule.id)) {
      return null;
    }
    const parameters = validateParameters(rawModule.templateId, rawModule.parameters);
    if (!parameters) {
      return null;
    }
    moduleIds.add(rawModule.id);
    modules.push({ id: rawModule.id, templateId: rawModule.templateId, parameters });
  }

  const links = [];
  if (modules.length === 2) {
    if (!Array.isArray(rawPlan.links) || rawPlan.links.length !== 1) {
      return null;
    }
    const first = modules[0];
    const second = modules[1];
    if (!COMBINATION_PAIRS.includes(`${first.templateId}>${second.templateId}`)) {
      return null;
    }
    const rawLink = rawPlan.links[0];
    if (!isPlainObject(rawLink) || rawLink.from !== first.id || rawLink.to !== second.id) {
      return null;
    }
    links.push({
      from: first.id,
      to: second.id,
      mapping: sanitizeText(rawLink.mapping, 120, 'validated_parameter_transfer')
    });
  }

  const steps = Array.isArray(rawPlan.steps)
    ? rawPlan.steps.slice(0, 8).map((step) => sanitizeText(step, 180)).filter(Boolean)
    : [];
  if (steps.length === 0) {
    return null;
  }

  return {
    schemaVersion: '1.0',
    title: sanitizeText(rawPlan.title, 100, '交互实验'),
    subject: sanitizeText(rawPlan.subject, 30, 'science'),
    modules,
    links,
    steps
  };
}

function validatePoints(points) {
  if (!Array.isArray(points) || points.length < 2 || points.length > 64) {
    return null;
  }
  const clean = [];
  for (const point of points) {
    if (!isPlainObject(point) || !boundedVisualNumber(point.x) || !boundedVisualNumber(point.y)) {
      return null;
    }
    clean.push({ x: point.x, y: point.y });
  }
  return clean;
}

export function validateVisualSpec(rawVisual) {
  if (!isPlainObject(rawVisual) || !VISUAL_KINDS.includes(rawVisual.kind)) {
    return { kind: 'none', title: '' };
  }
  const title = sanitizeText(rawVisual.title, 100);
  if (rawVisual.kind === 'none') {
    return { kind: 'none', title };
  }
  if (rawVisual.kind === 'function_plot') {
    const points = validatePoints(rawVisual.points);
    return points ? { kind: 'function_plot', title, points } : { kind: 'none', title: '' };
  }
  if (rawVisual.kind === 'data_chart') {
    if (!Array.isArray(rawVisual.labels) || !Array.isArray(rawVisual.values) ||
      rawVisual.labels.length < 1 || rawVisual.labels.length > 12 || rawVisual.labels.length !== rawVisual.values.length) {
      return { kind: 'none', title: '' };
    }
    const labels = rawVisual.labels.map((label) => sanitizeText(label, 30)).filter(Boolean);
    const values = rawVisual.values.filter((value) => boundedVisualNumber(value));
    if (labels.length !== rawVisual.labels.length || values.length !== rawVisual.values.length) {
      return { kind: 'none', title: '' };
    }
    return { kind: 'data_chart', title, labels, values };
  }
  if (rawVisual.kind === 'relation_diagram') {
    if (!Array.isArray(rawVisual.nodes) || !Array.isArray(rawVisual.edges) ||
      rawVisual.nodes.length < 2 || rawVisual.nodes.length > 10 || rawVisual.edges.length > 15) {
      return { kind: 'none', title: '' };
    }
    const nodes = rawVisual.nodes.map((node) => sanitizeText(node, 40)).filter(Boolean);
    const edges = rawVisual.edges
      .filter((edge) => isPlainObject(edge) && Number.isInteger(edge.from) && Number.isInteger(edge.to) &&
        edge.from >= 0 && edge.to >= 0 && edge.from < nodes.length && edge.to < nodes.length)
      .map((edge) => ({ from: edge.from, to: edge.to, label: sanitizeText(edge.label, 30) }));
    if (nodes.length !== rawVisual.nodes.length || edges.length !== rawVisual.edges.length) {
      return { kind: 'none', title: '' };
    }
    return { kind: 'relation_diagram', title, nodes, edges };
  }
  if (!SCHEMATIC_IDS.includes(rawVisual.schematicId)) {
    return { kind: 'none', title: '' };
  }
  const labels = Array.isArray(rawVisual.labels)
    ? rawVisual.labels.slice(0, 8).map((label) => sanitizeText(label, 40)).filter(Boolean)
    : [];
  return { kind: 'scientific_schematic', title, schematicId: rawVisual.schematicId, labels };
}

export function validateModelResponse(raw) {
  if (!isPlainObject(raw) || !['experiment', 'explanation'].includes(raw.mode)) {
    return null;
  }
  const title = sanitizeText(raw.title, 100, raw.mode === 'experiment' ? '交互实验' : 'AI 讲解');
  const answer = sanitizeText(raw.answer, 5000);
  if (!answer) {
    return null;
  }
  if (raw.mode === 'experiment') {
    const plan = validateExperimentPlan(raw.plan);
    if (!plan) {
      return null;
    }
    return { schemaVersion: '1.0', mode: 'experiment', title, answer, plan, visual: { kind: 'none', title: '' } };
  }
  return {
    schemaVersion: '1.0',
    mode: 'explanation',
    title,
    answer,
    plan: null,
    visual: validateVisualSpec(raw.visual)
  };
}

export function validateTutorResponse(raw, plan) {
  if (!isPlainObject(raw) || !shortText(raw.message, 3000)) {
    return null;
  }
  const result = { message: sanitizeText(raw.message, 3000), patch: null };
  if (raw.patch === null || raw.patch === undefined) {
    return result;
  }
  if (!isPlainObject(raw.patch) || !shortText(raw.patch.parameterKey, 60) || !finiteNumber(raw.patch.nextValue)) {
    return null;
  }
  const module = plan?.modules?.find((item) => isPlainObject(item) && isPlainObject(item.parameters) &&
    Object.hasOwn(item.parameters, raw.patch.parameterKey));
  if (!module) {
    return null;
  }
  const limits = PARAMETER_LIMITS[module.templateId]?.[raw.patch.parameterKey];
  if (!limits || raw.patch.nextValue < limits[0] || raw.patch.nextValue > limits[1]) {
    return null;
  }
  result.patch = {
    parameterKey: raw.patch.parameterKey,
    nextValue: raw.patch.nextValue,
    reason: sanitizeText(raw.patch.reason, 300, '用于比较变量变化对结果的影响')
  };
  return result;
}

function validateChatPatch(rawPatch, context) {
  if (rawPatch === null || rawPatch === undefined) {
    return null;
  }
  if (!isPlainObject(rawPatch) || !shortText(rawPatch.parameterKey, 60) || !finiteNumber(rawPatch.nextValue)) {
    return null;
  }
  if (!context.templateId || !Object.hasOwn(context.parameters, rawPatch.parameterKey)) {
    return null;
  }
  const limits = PARAMETER_LIMITS[context.templateId]?.[rawPatch.parameterKey];
  if (!limits || rawPatch.nextValue < limits[0] || rawPatch.nextValue > limits[1]) {
    return null;
  }
  return {
    parameterKey: rawPatch.parameterKey,
    nextValue: rawPatch.nextValue,
    reason: sanitizeText(rawPatch.reason, 300, '用于比较变量变化对结果的影响')
  };
}

export function sanitizeTutorChatRequest(raw) {
  if (!isPlainObject(raw) || !shortText(raw.message, 2000)) {
    return null;
  }
  const rawContext = isPlainObject(raw.context) ? raw.context : {};
  const mode = rawContext.mode === 'experiment' ? 'experiment' : 'question';
  const subject = CHAT_SUBJECTS.includes(rawContext.subject) ? rawContext.subject : '';
  const templateId = TEMPLATE_IDS.includes(rawContext.templateId) ? rawContext.templateId : '';
  const context = {
    mode,
    subject,
    originalQuestion: sanitizeText(rawContext.originalQuestion, 2000),
    templateId,
    parameters: sanitizeScalarRecord(rawContext.parameters, 16),
    deterministicResult: sanitizeScalarRecord(rawContext.deterministicResult, 16),
    formula: sanitizeText(rawContext.formula, 600),
    currentStep: sanitizeText(rawContext.currentStep, 600)
  };
  if (mode === 'experiment' && !templateId) {
    return null;
  }
  return {
    sessionId: sanitizeText(raw.sessionId, 80, 'anonymous'),
    message: raw.message.trim(),
    responseLevel: CHAT_RESPONSE_LEVELS.includes(raw.responseLevel) ? raw.responseLevel : 'hint',
    history: sanitizeChatHistory(raw.history),
    context
  };
}

export function validateTutorChatResponse(raw, request) {
  if (!isPlainObject(raw) || !CHAT_RESPONSE_MODES.includes(raw.mode)) {
    return null;
  }
  const summary = sanitizeText(raw.summary, 1000);
  const steps = Array.isArray(raw.steps)
    ? raw.steps.slice(0, 8).map((step) => sanitizeText(step, 500)).filter(Boolean)
    : [];
  if (!summary && steps.length === 0) {
    return null;
  }
  const formulas = Array.isArray(raw.formulas)
    ? raw.formulas.slice(0, 8).map((formula) => sanitizeText(formula, 300)).filter(Boolean)
    : [];
  const checks = Array.isArray(raw.checks)
    ? raw.checks.slice(0, 6).map((check) => sanitizeText(check, 400)).filter(Boolean)
    : [];
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.slice(0, 4).map((warning) => sanitizeText(warning, 300)).filter(Boolean)
    : [];
  if (request.context.mode === 'question' && !warnings.includes('AI 讲解可能存在误差，请结合教材与教师要求核对。')) {
    warnings.push('AI 讲解可能存在误差，请结合教材与教师要求核对。');
  }
  const result = {
    schemaVersion: '1.0',
    mode: raw.mode,
    summary,
    steps,
    formulas,
    finalAnswer: request.responseLevel === 'hint' ? null : sanitizeText(raw.finalAnswer, 1200) || null,
    checks,
    followUp: sanitizeText(raw.followUp, 500),
    parameterPatch: validateChatPatch(raw.parameterPatch, request.context),
    warnings
  };
  if (findTutorTopicMismatches(request, result).length > 0) {
    return null;
  }
  if (findDeterministicTutorIssues(request, result).length > 0) {
    return null;
  }
  const missingCoverage = findMissingTutorCoverage(request, result);
  if (missingCoverage.length > 0) {
    result.warnings.push(`完整性提醒：当前回答未明确覆盖${missingCoverage.join('、')}，请补充后再作为完整解答。`);
  }
  return result;
}

export function sanitizeQuestionRequest(raw) {
  if (!isPlainObject(raw) || !shortText(raw.question, 2000)) {
    return null;
  }
  return {
    question: raw.question.trim(),
    preferredSubject: sanitizeText(raw.preferredSubject, 30)
  };
}
