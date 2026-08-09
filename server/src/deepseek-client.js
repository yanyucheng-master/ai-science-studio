import { config } from './config.js';

const GENERATE_SYSTEM_PROMPT = `你是“大师实验室”的理科题目解析器。你必须只返回 JSON 对象，禁止 Markdown 代码块。

任务分两种模式：
1. 题目能映射到受支持实验时，mode=experiment，返回受限声明式实验计划。
2. 没有相应模板时，mode=explanation，只做路由判断：说明“暂无对应实验模板”或指出缺少的建模条件。不要在本接口完成数值解题；完整讲解由导师接口负责。

支持模板 ID：brake, fe_cuso4, tangent, cell, solenoid, board_slider, projectile, ohm_circuit, lever, lens, buoyancy, friction, lamp_power, series_circuit, heat_balance, liquid_pressure, efficiency, sound。
最多组合两个模板，且只允许：friction>brake、ohm_circuit>solenoid、series_circuit>lamp_power、friction>board_slider、liquid_pressure>buoyancy、brake>tangent。
当前 HarmonyOS 第一阶段客户端优先使用单模板；除非一道题确实必须由上述白名单中的两个模块串联解释，否则只返回一个模块。

experiment JSON：
{"mode":"experiment","title":"...","answer":"简短解释","plan":{"title":"...","subject":"physics|chemistry|mathematics|biology","modules":[{"id":"m1","templateId":"brake","parameters":{"initialSpeed":20,"deceleration":5}}],"links":[],"steps":["..."]},"visual":{"kind":"none","title":""}}

模板参数（只能使用列出的键和值域）：
- brake: initialSpeed 5..40, deceleration 1..12
- fe_cuso4: ironMass 0.5..30, copperSulfateMass 1..80
- tangent: coefficient 0.25..3, pointX -3..3
- cell: cellType 0(动物)或1(植物)
- solenoid: current 0.1..2, turns 100..500
- board_slider: initialSpeed 1..8, boardLength 1..5
- projectile: horizontalSpeed 2..30, height 1..80
- ohm_circuit: voltage 1..24, resistance 1..20
- lever: leftForce 1..10, leftArm 10..50（cm）
- lens: objectDistance 6..60, focalLength 5..25（cm）
- buoyancy: displacedVolume 50..800（mL）, density 700..1300（kg/m³）
- friction: normalForce 2..30, frictionCoefficient 0.1..0.8
- lamp_power: voltage 0.5..6, current 0.05..1
- series_circuit: voltage 3..12, resistance 2..20
- heat_balance: hotWaterMass 50..500（g）, hotTemperature 30..95（℃）
- liquid_pressure: depthCm 5..100, density 700..1300（kg/m³）
- efficiency: loadForce 5..80, pullForce 3..40
- sound: frequency 100..1000, amplitudePercent 10..100
只使用题目中明确出现、物理意义正确且处于上述范围的参数。缺少建立实验所需的关键参数时，必须返回 mode=explanation，指出缺少哪些条件并提出一个明确追问，禁止自行补造教材常见值。

explanation JSON：
{"mode":"explanation","title":"...","answer":"暂无对应实验模板；若条件不足，指出缺失条件并提出一个明确追问","plan":null,"visual":VISUAL}

VISUAL 只允许以下一种：
- {"kind":"none","title":""}
- {"kind":"function_plot","title":"...","points":[{"x":0,"y":0},...]}, 最多64点
- {"kind":"data_chart","title":"...","labels":["..."],"values":[1,2]}, 最多12项
- {"kind":"relation_diagram","title":"...","nodes":["..."],"edges":[{"from":0,"to":1,"label":"..."}]}, 最多10节点
- {"kind":"scientific_schematic","title":"...","schematicId":"force_diagram|ray_diagram|series_circuit|particle_model|cell_basic","labels":["..."]}

涉及计算、方程或推导时，输出 JSON 前必须独立复核最终结论：把结果代回原方程，检查量纲，并核对全部初始条件和边界条件；发现任一不满足时先纠正。answer 中给出可供读者检查的关键方程，不能跳过决定答案的代数步骤。
function_plot 只能表示一条由 title 明确命名的曲线；如果需要同时说明多条曲线或多个对象，改用 relation_diagram，不能让标题声称绘制了 points 实际没有区分的多条曲线。
严禁输出代码、SVG、HTML、URL、脚本、自由表达式或声称不存在的实验结果。数值不确定时说明假设。`;

const TUTOR_SYSTEM_PROMPT = `你是“大师实验室”的实验导师。只返回 JSON 对象，不使用代码块。
返回 {"message":"解释和引导","patch":null}，或在确有教学价值时返回
{"message":"解释和引导","patch":{"parameterKey":"现有参数键","nextValue":数值,"reason":"为什么建议比较该值"}}。
只能建议修改传入实验计划中已经存在的参数，不得添加参数、代码、公式实现或自动执行操作。用户确认后应用会自行校验。`;

const CHAT_SYSTEM_PROMPT = `你是“大师实验室”的中学数理化生 AI 导师。只返回 JSON 对象，禁止 Markdown 代码块、HTML、URL、代码和隐藏推理过程。

教学原则：
1. 只回答中学数学、物理、化学、生物学习问题；无关请求 mode=refusal。
2. 默认分层引导。responseLevel=hint 时只给关键线索和一个追问，finalAnswer 必须为 null；不要直接交出完整答案。
3. responseLevel=explain 时解释当前概念或步骤；responseLevel=steps 时给出可核查的分步解答；responseLevel=check 时检查学生思路；responseLevel=variant 时给出同类型变式或受限参数建议。
4. context.mode=experiment 时，deterministicResult 和 formula 来自本地确定性实验引擎，是当前数值和结论的唯一依据。不得改写、覆盖或编造与之冲突的结果。
5. context.mode=question 时，题设条件不足或矛盾必须 mode=clarification，指出缺失条件并追问，禁止自行补造数值。
6. 涉及计算时检查公式适用条件、单位、量纲、代入和边界；不确定时明确说明。
7. 只能给学生可阅读的教学步骤，不得声称展示模型内部思维链，不得称答案为权威教材答案。
8. originalQuestion 中的显式条件是不可改写的约束。不得引入题目未给出的力、接触面、反应物、边界条件或数值；摩擦因数只能用于题目明确指定的两个接触物体。
9. 最新一条 message 的要求优先于历史内容。若学生说“只补充”“不要重复”“解释这一小步”，只回答该子问题，不得从第一步重新讲起。
10. requestedGoals 是题目或最新追问要求覆盖的小问清单。responseLevel=steps 时必须逐项作答并在 checks 中逐项自检，不得只完成前半题。
11. explicitConstraints 是从原题提取的硬约束，必须逐条遵守；如果与历史回答冲突，以 explicitConstraints 为准并主动纠正旧回答。
12. 摩擦力方向必须依据接触面间的相对运动或相对运动趋势判断，不能依据物体相对地面的速度判断。提到方向后，必须核对它与加速度方向及摩擦功正负是否自洽。局部追问中不要引入回答该问题不需要的新方向或新数值。
13. responseLevel=steps 时，finalAnswer 必须是非空字符串，按原题顺序列出每个小问的最终结论、数值和单位；summary 或 checks 不能代替 finalAnswer。
14. 分段、分类、计数或概率问题必须核对“各分支数量之和”与最终总数一致；同一回答中的公式、文字说明和最终答案不得互相矛盾。
15. 不得偷换题设模型或术语，例如“圆形轨道内侧”不能改写为“轻杆模型”。只展开决定答案的步骤，避免与题目无关的延伸结论。
16. 完整解答控制在 4 至 8 个紧凑步骤；每个小问至少在 steps 中计算一次，并在 checks 中用代回、守恒、边界或数量求和中的一种方法复核。
17. 若同时求函数关系和稳定值、平衡值或临界值，必须把最终数值代回最终函数并写出等式；代回不满足零、守恒或边界条件时必须先纠正系数，禁止只写“代回正确”。

返回结构：
{"mode":"hint|explain|steps|answer|clarification|refusal","summary":"简洁说明","steps":["步骤1"],"formulas":["公式"],"finalAnswer":"完整结论；hint 时为 null","checks":["自检"],"followUp":"推荐追问","parameterPatch":null,"warnings":[]}

parameterPatch 仅在 context.mode=experiment、responseLevel=variant 且确有教学价值时使用：
{"parameterKey":"context.parameters 中已有的键","nextValue":数值,"reason":"建议理由"}
不得增加新参数，也不得要求应用自动执行。`;

const GOAL_RULES = Object.freeze([
  ['判断是否发生相对滑动', /(?:是否|判断).{0,10}(?:相对)?(?:滑动|运动)/],
  ['求各研究对象的加速度', /加速度/],
  ['求过程所需时间', /(?:多久|多长时间|所需时间|经过时间|时间为|(?:求|计算|、|和).{0,4}时间|求\s*t\b)/i],
  ['求产生的热量', /热量|摩擦生热|求\s*Q\b/i],
  ['核对能量关系', /能量.{0,8}(?:核对|验证|守恒|关系)|(?:核对|验证).{0,8}能量|(?:功|机械能).{0,8}(?:核对|验证|关系)/],
  ['判断力的方向', /(?:摩擦力|支持力|拉力|合力).{0,8}方向|方向.{0,8}(?:摩擦力|支持力|拉力|合力)/],
  ['求速度', /(?:求|计算).{0,8}(?<!加)速度/],
  ['求位移或距离', /(?:求|计算).{0,8}(?:位移|距离)/]
]);

function unique(items) {
  return [...new Set(items)];
}

function isTargetedFollowUp(input) {
  return Array.isArray(input.history) && input.history.length > 0 &&
    /(?:只|仅)(?:补|解释|回答|计算|核对)|补充|漏了|不要重复|上一(?:步|次|个回答)|这一(?:步|问)|刚才/.test(input.message || '');
}

export function buildTutorGuardrails(input) {
  const originalQuestion = input.context?.originalQuestion || '';
  const latestMessage = input.message || '';
  const targetedFollowUp = isTargetedFollowUp(input);
  const rawGoalText = input.responseLevel === 'steps' && !targetedFollowUp
    ? `${originalQuestion}\n${latestMessage}`
    : latestMessage;
  const goalText = rawGoalText.replace(/(?:不要|无需|不必|不用).{0,40}?(?:[，,。；;]|$)/g, '');
  const requestedGoals = GOAL_RULES
    .filter(([, pattern]) => pattern.test(goalText))
    .map(([label]) => label);
  const explicitConstraints = [];
  if (/光滑.{0,8}(?:地面|水平面|平面)|(?:地面|水平面|平面).{0,8}光滑/.test(originalQuestion)) {
    explicitConstraints.push('题设指定的地面或水平面光滑，因此该接触面不提供摩擦力。');
  }
  if (/不计空气阻力|忽略空气阻力/.test(originalQuestion)) {
    explicitConstraints.push('空气阻力按题意取零。');
  }
  if (/(?:A[、与和及/\-]?B|滑块.{0,8}木板|木板.{0,8}滑块).{0,24}(?:摩擦因数|摩擦系数)/i.test(originalQuestion)) {
    explicitConstraints.push('题目给出的摩擦因数只适用于滑块与木板（A、B）接触面，不能移用于地面。');
  }
  if (/摩擦|粗糙|摩擦因数|摩擦系数/.test(originalQuestion)) {
    explicitConstraints.push('滑动摩擦力阻碍接触面间的相对运动；方向必须按相对运动趋势判断，并与加速度和摩擦功符号交叉核对。');
  }
  if (/均?由静止开始|初始静止|初速度均?为零/.test(originalQuestion)) {
    explicitConstraints.push('各研究对象按题意由静止开始。');
  }
  return {
    latestRequest: latestMessage,
    requestedGoals: unique(requestedGoals),
    explicitConstraints: unique(explicitConstraints),
    replyScope: targetedFollowUp
      ? '这是局部追问：只回答 latestRequest 指定的子问题，不得重讲完整原题。'
      : input.history?.length
      ? '优先回答最新请求；已解释过的步骤只在纠错所必需时简短引用。'
      : '从原题条件开始，按 responseLevel 控制答案深度。'
  };
}

export function shouldUseThinkingMode(input) {
  if (!['steps', 'check'].includes(input.responseLevel)) {
    return false;
  }
  return !isTargetedFollowUp(input);
}

export class DeepSeekClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey ?? config.deepSeekApiKey;
    this.baseUrl = options.baseUrl ?? config.deepSeekBaseUrl;
    this.model = 'deepseek-v4-pro';
    this.timeoutMs = options.timeoutMs ?? config.requestTimeoutMs;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  get configured() {
    return typeof this.apiKey === 'string' && this.apiKey.length > 0;
  }

  async generate(question, preferredSubject = '') {
    return this.#requestJson([
      { role: 'system', content: GENERATE_SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({ question, preferredSubject }, null, 0)
      }
    ]);
  }

  async tutor(plan, message) {
    return this.#requestJson([
      { role: 'system', content: TUTOR_SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({ plan, question: message }, null, 0)
      }
    ]);
  }

  async chat(input) {
    const useThinking = shouldUseThinkingMode(input);
    const history = input.history.map((item) => ({ role: item.role, content: item.content }));
    const guardrails = buildTutorGuardrails(input);
    const requestEnvelope = {
      originalQuestion: input.context.originalQuestion,
      latestStudentRequest: input.message,
      responseLevel: input.responseLevel,
      subject: input.context.subject,
      context: input.context,
      guardrails
    };
    return this.#requestJson([
      { role: 'system', content: CHAT_SYSTEM_PROMPT },
      ...history,
      {
        role: 'user',
        content: [
          '【唯一原题】只允许解答 originalQuestion，不得替换、联想或补写成另一道题。',
          `originalQuestion: ${input.context.originalQuestion}`,
          `latestStudentRequest: ${input.message}`,
          `structuredInput: ${JSON.stringify(requestEnvelope, null, 0)}`
        ].join('\n')
      }
    ], {
      thinking: useThinking,
      timeoutMs: useThinking ? config.thinkingTimeoutMs : this.timeoutMs,
      maxTokens: useThinking ? 4200 : 2200
    });
  }

  async #requestJson(messages, options = {}) {
    if (!this.configured) {
      throw new Error('DeepSeek API key is not configured');
    }
    let lastError = new Error('DeepSeek request failed');
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.#singleRequest(messages, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown DeepSeek error');
        if (lastError.retryable === false) {
          break;
        }
      }
    }
    throw lastError;
  }

  async #singleRequest(messages, options = {}) {
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          thinking: { type: options.thinking ? 'enabled' : 'disabled' },
          response_format: { type: 'json_object' },
          max_tokens: options.maxTokens ?? 2500,
          ...(!options.thinking ? { temperature: 0.2 } : {})
        }),
        signal: controller.signal
      });
      if (!response.ok) {
        const error = new Error(`DeepSeek HTTP ${response.status}`);
        error.status = response.status;
        error.code = response.status === 401 || response.status === 403
          ? 'AI_AUTH_FAILED'
          : response.status === 429
            ? 'AI_RATE_LIMITED'
            : 'AI_UPSTREAM_ERROR';
        error.retryable = response.status === 408 || response.status === 409 || response.status === 425 ||
          response.status === 429 || response.status >= 500;
        throw error;
      }
      let payload;
      try {
        payload = await response.json();
      } catch {
        const error = new Error('DeepSeek returned invalid response JSON');
        error.retryable = false;
        throw error;
      }
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.trim().length === 0) {
        const error = new Error('DeepSeek returned empty content');
        error.retryable = false;
        throw error;
      }
      try {
        return JSON.parse(content);
      } catch {
        const error = new Error('DeepSeek returned invalid JSON');
        error.retryable = false;
        throw error;
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new Error(`DeepSeek request timed out after ${timeoutMs}ms`);
        timeoutError.code = 'AI_TIMEOUT';
        timeoutError.retryable = false;
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
