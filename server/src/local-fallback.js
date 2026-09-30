import { offlineInputs } from './offline-inputs.js';

function experiment(title, subject, templateId, parameters, answer, steps) {
  return {
    schemaVersion: '1.0',
    mode: 'experiment',
    title,
    answer,
    plan: {
      schemaVersion: '1.0',
      title,
      subject,
      modules: [{ id: 'm1', templateId, parameters }],
      links: [],
      steps
    },
    visual: { kind: 'none', title: '' }
  };
}

function missingConditions(message) {
  return {
    schemaVersion: '1.0',
    mode: 'unavailable',
    title: '题目条件不完整',
    answer: message,
    plan: null,
    visual: { kind: 'none', title: '' }
  };
}

export function localGenerateFallback(question) {
  const isFeCuSO4Question = /(?:铁|Fe)/i.test(question) && /(?:硫酸铜|CuSO(?:4|₄))/i.test(question);
  if (isFeCuSO4Question) {
    const parameters = offlineInputs(question, 'fe_cuso4');
    if (!parameters) {
      return missingConditions('请补充铁的质量和硫酸铜溶质的质量或物质的量，并使用实验范围内的数值；不能直接把溶液质量当作溶质质量。系统不会自行补造题设或截断数值。');
    }
    return experiment(
      '铁与硫酸铜置换反应',
      'chemistry',
      'fe_cuso4',
      parameters,
      '已使用本地规则识别置换反应，计算由设备端确定性引擎完成。',
      ['换算反应物的物质的量', '按 1∶1 计量比确定限量试剂', '计算铜的理论生成量并观察现象']
    );
  }
  if (/切线|导数|斜率/.test(question)) {
    const parameters = offlineInputs(question, 'tangent');
    if (!parameters) {
      return missingConditions('离线切线模板仅支持 y=ax²（0.25≤a≤3，−3≤x₀≤3）。请明确函数表达式和切点横坐标，系统不会补造或截断数值。');
    }
    return experiment(
      '函数切线与导数',
      'mathematics',
      'tangent',
      parameters,
      '已使用本地规则匹配二次函数切线实验。',
      ['确定函数与切点', '计算导数值', '拖动切点比较切线斜率']
    );
  }
  if (/细胞|叶绿体|线粒体|细胞核/.test(question)) {
    const parameters = offlineInputs(question, 'cell');
    if (!parameters) return missingConditions('请明确选择植物细胞或动物细胞，或从实验库打开预设。');
    return experiment(
      '细胞结构识别',
      'biology',
      'cell',
      parameters,
      '已使用本地规则匹配细胞结构实验。',
      ['选择细胞类型', '定位细胞器', '比较结构与功能']
    );
  }
  const explicitlyAboutBraking = /刹车|制动|停车/.test(question) ||
    (/初速度|减速度/.test(question) && /汽车|车辆|小车/.test(question));
  if (explicitlyAboutBraking) {
    const parameters = offlineInputs(question, 'brake');
    if (!parameters) {
      return missingConditions('请补充带单位的初速度和刹车加速度（或减速度），并使用实验范围内的数值；系统不会自行补造题设或截断数值。');
    }
    return experiment(
      '制动距离实验',
      'physics',
      'brake',
      parameters,
      '已使用本地规则识别匀减速制动模型。',
      ['提取初速度和减速度', '计算停车时间', '验证停车距离与速度的平方关系']
    );
  }
  return {
    schemaVersion: '1.0',
    mode: 'unavailable',
    title: '当前无法联网讲解',
    answer: '该题没有匹配到本地实验模板，AI 服务当前不可用。请联网重试，或从实验库选择相关预设实验。',
    plan: null,
    visual: { kind: 'none', title: '' }
  };
}

export function localTutorFallback(plan) {
  const templateId = plan?.modules?.[0]?.templateId;
  const messages = {
    brake: '可以比较初速度翻倍前后的刹车距离。由 v² − v₀² = 2ax 得 x = v₀²/(2a)，加速度大小不变时刹车距离会变为原来的四倍。',
    fe_cuso4: '先分别换算铁和硫酸铜的物质的量，再利用 1∶1 计量比判断哪一种反应物先耗尽。',
    tangent: '尝试把切点从正半轴移动到负半轴，观察导数符号和函数增减性的对应关系。',
    cell: '先选择一个结构，再结合它的位置和功能比较植物细胞与动物细胞的差异。',
    solenoid: '先只改变电流或匝数中的一个，比较磁场强弱；判断磁极时再结合电流方向使用安培定则。',
    board_slider: '分别对滑块和木板列牛顿第二定律，再用相对位移与木板长度比较是否滑落。',
    projectile: '把平抛运动分解为水平方向匀速运动和竖直方向自由落体，先由高度求运动时间。',
    ohm_circuit: '保持电阻不变调整电压，比较 I = U/R；再保持电压不变调整电阻做对照。',
    lever: '分别计算支点两侧的“力×力臂”，比较 F₁l₁ 与 F₂l₂：相等时杠杆平衡，不相等时乘积大的一端下沉。',
    lens: '先比较物距 u 与焦距 f、二倍焦距 2f 的关系，再按凸透镜成像规律判断像的正倒、大小、虚实和像距范围。',
    buoyancy: '只改变排开液体的体积或液体密度中的一个，用 F浮 = G − F示 测量，再与 G排 = ρ液gV排 比较。',
    friction: '分别控制压力和接触面的粗糙程度；匀速直线拉动时拉力等于滑动摩擦力，高中可用 f = μF压 计算。',
    lamp_power: '记录灯泡两端电压与通过它的电流，用 P = UI 计算功率并比较亮度。',
    series_circuit: '先求串联总电阻，再用 I = U/R总 求电流，最后分析各元件分压。',
    heat_balance: '按 Q = cmΔt 分别写出放热与吸热，忽略热损失时令两者相等。',
    liquid_pressure: '保持液体密度不变调整深度，再保持深度不变调整密度，用 p = ρgh 比较。',
    efficiency: '分别计算有用功与总功，再用 η = W有/W总；结果应处于 0 到 100% 之间。',
    sound: '保持振幅不变调整频率观察音调，再保持频率不变调整振幅观察响度。'
  };
  return {
    message: messages[templateId] || '每次只改变一个参数，记录结果并与原状态对照，再根据公式或实验现象归纳规律。',
    patch: null
  };
}

export function localTutorChatFallback(request) {
  if (request?.context?.mode !== 'experiment' || !request.context.templateId) {
    return null;
  }
  const plan = {
    modules: [{ templateId: request.context.templateId }]
  };
  const guidance = localTutorFallback(plan).message;
  return {
    schemaVersion: '1.0',
    mode: 'hint',
    summary: guidance,
    steps: [],
    formulas: request.context.formula ? [request.context.formula] : [],
    finalAnswer: null,
    checks: [],
    followUp: '你可以先说出自己的判断，我再帮你检查下一步。',
    parameterPatch: null,
    warnings: ['当前为本地教学提示，联网后可继续向 AI 导师追问。']
  };
}
