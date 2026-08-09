function numbersFromText(text) {
  const withoutAsciiIdentifiers = text.replace(/[A-Za-z][A-Za-z0-9]*/g, ' ');
  return (withoutAsciiIdentifiers.match(/-?\d+(?:\.\d+)?/g) || [])
    .map(Number)
    .filter(Number.isFinite);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function firstMeasurement(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = Number(match?.groups?.value);
    if (Number.isFinite(value)) {
      return { value, unit: (match.groups.unit || '').toLowerCase() };
    }
  }
  return null;
}

function extractFeCuSO4Inputs(text) {
  const iron = firstMeasurement(text, [
    /(?:铁粉?|Fe)\s*(?:的)?\s*(?:质量)?\s*(?:为|是|=)?\s*(?<value>\d+(?:\.\d+)?)\s*(?<unit>g)/i,
    /(?<value>\d+(?:\.\d+)?)\s*(?<unit>g)\s*(?:的)?\s*(?:铁粉?|Fe)/i
  ]);
  const copperSulfate = firstMeasurement(text, [
    /(?:硫酸铜|CuSO(?:4|₄))\s*(?:溶液)?\s*(?:的)?\s*(?:质量|物质的量)?\s*(?:为|是|=)?\s*(?<value>\d+(?:\.\d+)?)\s*(?<unit>mol|g)/i,
    /(?<value>\d+(?:\.\d+)?)\s*(?<unit>mol|g)\s*(?:的)?\s*(?:硫酸铜|CuSO(?:4|₄))(?:溶液)?/i
  ]);
  return { iron, copperSulfate };
}

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
  const values = numbersFromText(question);
  const isFeCuSO4Question = /(?:铁|Fe)/i.test(question) && /(?:硫酸铜|CuSO(?:4|₄))/i.test(question);
  if (isFeCuSO4Question) {
    const { iron, copperSulfate } = extractFeCuSO4Inputs(question);
    if (!iron || !copperSulfate) {
      return missingConditions('请补充铁的质量和硫酸铜的质量或物质的量，系统不会自行补造题设数值。');
    }
    const copperSulfateMass = copperSulfate.unit === 'mol'
      ? copperSulfate.value * 160
      : copperSulfate.value;
    return experiment(
      '铁与硫酸铜置换反应',
      'chemistry',
      'fe_cuso4',
      {
        ironMass: clamp(iron.value, 0.5, 30),
        copperSulfateMass: clamp(copperSulfateMass, 1, 80)
      },
      '已使用本地规则识别置换反应，计算由设备端确定性引擎完成。',
      ['换算反应物的物质的量', '按 1∶1 计量比确定限量试剂', '计算铜的理论生成量并观察现象']
    );
  }
  if (/切线|导数|斜率/.test(question)) {
    if (values.length < 2) {
      return missingConditions('请补充函数表达式和切点横坐标，系统不会自行补造题设数值。');
    }
    return experiment(
      '函数切线与导数',
      'mathematics',
      'tangent',
      {
        coefficient: clamp(values[0] ?? 1, 0.25, 3),
        pointX: clamp(values[1] ?? 1, -3, 3)
      },
      '已使用本地规则匹配二次函数切线实验。',
      ['确定函数与切点', '计算导数值', '拖动切点比较切线斜率']
    );
  }
  if (/细胞|叶绿体|线粒体|细胞核/.test(question)) {
    return experiment(
      '细胞结构识别',
      'biology',
      'cell',
      { cellType: /动物/.test(question) ? 0 : 1 },
      '已使用本地规则匹配细胞结构实验。',
      ['选择细胞类型', '定位细胞器', '比较结构与功能']
    );
  }
  const explicitlyAboutBraking = /刹车|制动|停车|减速度/.test(question) ||
    (/初速度/.test(question) && /汽车|车辆|小车/.test(question));
  if (explicitlyAboutBraking) {
    if (values.length < 2) {
      return missingConditions('请补充初速度和刹车加速度（或减速度），系统不会自行补造题设数值。');
    }
    return experiment(
      '制动距离实验',
      'physics',
      'brake',
      {
        initialSpeed: clamp(values[0] ?? 20, 5, 40),
        deceleration: clamp(values[1] ?? 5, 1, 12)
      },
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
    brake: '可以比较初速度翻倍前后的停车距离。根据 s = v₀²/(2a)，减速度不变时停车距离会变为原来的四倍。',
    fe_cuso4: '先分别换算铁和硫酸铜的物质的量，再利用 1∶1 计量比判断哪一种反应物先耗尽。',
    tangent: '尝试把切点从正半轴移动到负半轴，观察导数符号和函数增减性的对应关系。',
    cell: '先选择一个结构，再结合它的位置和功能比较植物细胞与动物细胞的差异。',
    solenoid: '先只改变电流或匝数中的一个，比较磁场强弱；判断磁极时再结合电流方向使用安培定则。',
    board_slider: '分别对滑块和木板列牛顿第二定律，再用相对位移与木板长度比较是否滑落。',
    projectile: '把平抛运动分解为水平方向匀速运动和竖直方向自由落体，先由高度求运动时间。',
    ohm_circuit: '保持电阻不变调整电压，比较 I = U/R；再保持电压不变调整电阻做对照。',
    lever: '分别计算支点两侧的力矩 F×L，比较力矩大小即可判断转动方向或是否平衡。',
    lens: '先比较物距与焦距、二倍焦距的关系，再结合 1/f = 1/u + 1/v 判断像的位置和性质。',
    buoyancy: '只改变排液体积或液体密度中的一个，用 F浮 = ρgV排 比较浮力变化。',
    friction: '分别控制压力和接触面的粗糙程度，使用 f = μN 分析滑动摩擦力。',
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
