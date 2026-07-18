(() => {
  const G = 9.8;
  const AIR_SPEED = 340;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value)));
  const fmt = (value, decimals = 1) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return "--";
    return number.toFixed(decimals).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  };
  const normalize = text => String(text || "")
    .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/．/g, ".")
    .replace(/[－−–—]/g, "-")
    .replace(/Ω/g, "欧")
    .replace(/²/g, "2")
    .replace(/\s+/g, " ")
    .trim();
  const firstNumber = (text, patterns) => {
    const source = normalize(text);
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match) {
        const value = match.slice(1).find(item => item !== undefined);
        if (value !== undefined) return Number(value);
      }
    }
    return null;
  };
  const readNumber = (source, patterns) => firstNumber(source, patterns);
  const materialValue = (source, values) => {
    for (const [pattern, value] of values) {
      if (pattern.test(source)) return value;
    }
    return null;
  };
  const semanticNumbers = (id, source) => {
    switch (id) {
      case "lever":
        return {
          p1: readNumber(source, [
            /左侧[^。；，,]*?(?:施加|拉力|动力)[^0-9-]*(\d+(?:\.\d+)?)\s*N/i,
            /(?:左侧拉力|动力|F1|F₁)[^0-9-]*(\d+(?:\.\d+)?)\s*N/i,
            /(?:拉力|动力)[^0-9-]*(\d+(?:\.\d+)?)\s*N/i
          ]),
          p2: readNumber(source, [
            /左侧[\s\S]{0,60}?(?:力臂|动力臂)[^0-9-]*(\d+(?:\.\d+)?)\s*cm/i,
            /若左侧[\s\S]{0,70}?(?:力臂|动力臂)[^0-9-]*(\d+(?:\.\d+)?)\s*cm/i,
            /(?:动力臂|l1|l₁)[^0-9-]*(\d+(?:\.\d+)?)\s*cm/i,
            /(?:左力臂|左侧力臂)\D{0,8}(\d+(?:\.\d+)?)\s*cm/i
          ])
        };
      case "lens":
        return {
          p1: readNumber(source, [
            /(?:物距|u)[^0-9-]*(\d+(?:\.\d+)?)\s*cm/i,
            /(?:凸透镜|透镜)前\s*(\d+(?:\.\d+)?)\s*cm/i,
            /物体[^。；，,]*?(?:放在|距离|距)[^0-9-]*(\d+(?:\.\d+)?)\s*cm/i
          ]),
          p2: readNumber(source, [
            /(?:焦距|f)[^0-9-]*(\d+(?:\.\d+)?)\s*cm/i
          ])
        };
      case "buoyancy":
        return {
          p1: readNumber(source, [
            /(?:排开|浸入|体积|V排)[^0-9-]*(\d+(?:\.\d+)?)\s*(?:mL|毫升|cm3|cm³)/i,
            /(\d+(?:\.\d+)?)\s*(?:mL|毫升|cm3|cm³)[^。；，,]*?(?:液体|水)/i
          ]),
          p2: readNumber(source, [
            /(?:密度|ρ)[^0-9-]*(\d+(?:\.\d+)?)\s*kg\s*\/?\s*m/i
          ]) ?? materialValue(source, [[/盐水/, 1100], [/酒精|煤油|油/, 800], [/水/, 1000]])
        };
      case "friction":
        return {
          p1: readNumber(source, [
            /(?:压力|正压力|N)[^0-9-]*(\d+(?:\.\d+)?)\s*N/i
          ]),
          p2: readNumber(source, [
            /(?:摩擦因数|粗糙程度|μ)[^0-9-]*(\d+(?:\.\d+)?)/i
          ]) ?? materialValue(source, [[/粗糙|砂纸/, 0.55], [/光滑/, 0.15], [/木板|普通/, 0.3]])
        };
      case "lampPower":
        return {
          p1: readNumber(source, [
            /(?:电压|额定电压|U)[^0-9-]*(\d+(?:\.\d+)?)\s*V/i
          ]),
          p2: readNumber(source, [
            /(?:电流|I)[^0-9-]*(\d+(?:\.\d+)?)\s*A/i
          ])
        };
      case "seriesCircuit":
        return {
          p1: readNumber(source, [
            /(?:电源电压|总电压|电压|U)[^0-9-]*(\d+(?:\.\d+)?)\s*V/i
          ]),
          p2: readNumber(source, [
            /(?:R2|R₂|滑动变阻器|变阻器|滑变)[^0-9-]*(\d+(?:\.\d+)?)\s*(?:欧|Ω)/i
          ])
        };
      case "heatBalance":
        return {
          p1: readNumber(source, [
            /(?:将|把)\s*(\d+(?:\.\d+)?)\s*g[\s\S]{0,24}?热水/i,
            /(\d+(?:\.\d+)?)\s*g[\s\S]{0,16}?热水/i,
            /热水质量[^0-9-]*(\d+(?:\.\d+)?)\s*g/i
          ]),
          p2: readNumber(source, [
            /热水[^。；，,]*?(?:初温|温度)[^0-9-]*(\d+(?:\.\d+)?)\s*(?:℃|摄氏度|度)/i,
            /g[、,，]\s*(\d+(?:\.\d+)?)\s*(?:℃|摄氏度|度)[^。；，,]*热水/i,
            /(?:初温|温度)[^0-9-]*(\d+(?:\.\d+)?)\s*(?:℃|摄氏度|度)/i
          ])
        };
      case "liquidPressure":
        return {
          p1: readNumber(source, [
            /(?:深度|h)[^0-9-]*(\d+(?:\.\d+)?)\s*cm/i,
            /(\d+(?:\.\d+)?)\s*cm[^。；，,]*深/i
          ]),
          p2: readNumber(source, [
            /(?:密度|ρ)[^0-9-]*(\d+(?:\.\d+)?)\s*kg\s*\/?\s*m/i
          ]) ?? materialValue(source, [[/盐水/, 1100], [/酒精|煤油|油/, 800], [/水/, 1000]])
        };
      case "efficiency":
        return {
          p1: readNumber(source, [
            /(?:物重|重物|重力|G)[^0-9-]*(\d+(?:\.\d+)?)\s*N/i
          ]),
          p2: readNumber(source, [
            /(?:绳端拉力|拉力|F)[^0-9-]*(\d+(?:\.\d+)?)\s*N/i
          ])
        };
      case "sound":
        return {
          p1: readNumber(source, [
            /(?:频率|f)[^0-9-]*(\d+(?:\.\d+)?)\s*Hz/i
          ]),
          p2: readNumber(source, [
            /(?:振幅|响度)[^0-9-]*(\d+(?:\.\d+)?)\s*%?/i
          ])
        };
      default:
        return { p1: null, p2: null };
    }
  };
  const templateParse = (template, text) => {
    const source = normalize(text);
    const semantic = semanticNumbers(template.id, source);
    const p1 = semantic.p1 ?? firstNumber(source, template.parse.p1) ?? template.defaults[0];
    const p2 = semantic.p2 ?? firstNumber(source, template.parse.p2) ?? template.defaults[1];
    if (!Number.isFinite(p1) || !Number.isFinite(p2)) {
      return { ok: false, message: template.failMessage };
    }
    const a = clamp(p1, template.params[0].min, template.params[0].max);
    const b = clamp(p2, template.params[1].min, template.params[1].max);
    const model = template.model(a, b);
    return {
      ok: true,
      subject: "物理",
      type: template.id,
      p1: a,
      p2: b,
      message: `已识别：${template.recognition(model)}`,
      recognitionText: template.recognition(model)
    };
  };
  const stages = (a, b, c) => [
    { label: "识别题型", text: a, progress: 28 },
    { label: "建立模型", text: b, progress: 63 },
    { label: "生成实验", text: c, progress: 100 }
  ];
  const commonSteps = (model, titles) => [
    ["提取条件", titles[0], "把题干中的可变量转成实验参数。"],
    ["选择公式", titles[1], "选择与题型匹配的核心关系式。"],
    ["代入计算", titles[2], "用当前参数计算关键物理量。"],
    ["现象验证", titles[3], "通过模型变化检验计算结论。"]
  ];
  const fact = (label, value) => ({ label, value });

  function genericShell(model, bodyHtml) {
    return `
      <div class="generic-physics-scene ${model.visual}">
        <div class="generic-visual-grid">
          ${bodyHtml}
        </div>
      </div>`;
  }

  const templates = {
    lever: {
      id: "lever",
      menuTitle: "杠杆平衡条件探究",
      menuMeta: "力 × 力臂 · 判断是否平衡",
      stage: "初中核心",
      block: "力学",
      title: "杠杆平衡条件：力与力臂如何配合",
      defaults: [4, 30],
      keywords: /杠杆|力臂|力矩|钩码|支点|平衡条件/,
      params: [
        { label: "左侧拉力 F₁", desc: "调整左侧钩码或拉力", unit: "N", min: 1, max: 10, step: 1, value: 4 },
        { label: "左侧力臂 l₁", desc: "调整拉力到支点的距离", unit: "cm", min: 10, max: 50, step: 5, value: 30 }
      ],
      parse: {
        p1: [/(?:左侧|拉力|动力|F1|F₁)\D{0,8}(\d+(?:\.\d+)?)\s*N/i, /(\d+(?:\.\d+)?)\s*N\s*(?:的)?(?:拉力|动力)/i],
        p2: [/左侧[\s\S]{0,60}?(?:力臂|动力臂)\D{0,8}(\d+(?:\.\d+)?)\s*cm/i, /(?:动力臂|左力臂|左侧力臂|l1|l₁)\D{0,8}(\d+(?:\.\d+)?)\s*cm/i, /(\d+(?:\.\d+)?)\s*cm\s*(?:的)?(?:动力臂|左力臂|左侧力臂)/i]
      },
      failMessage: "当前杠杆模板需要识别拉力和力臂，例如：左侧拉力4N，力臂30cm。",
      question: (p1, p2) => `杠杆右侧挂 6N 重物，阻力臂为 20cm。若左侧施加 ${fmt(p1)}N 的力，力臂为 ${fmt(p2)}cm，请判断杠杆是否平衡。`,
      model: (p1, p2) => {
        const load = 6;
        const loadArm = 20;
        const leftMoment = p1 * p2;
        const rightMoment = load * loadArm;
        const diff = leftMoment - rightMoment;
        const balanced = Math.abs(diff) < 1e-9;
        return {
          visual: "visual-lever",
          metrics: [p1, p2, leftMoment],
          metricUnit: "N·cm",
          facts: [fact("左力矩", `${fmt(leftMoment)} N·cm`), fact("右力矩", `${fmt(rightMoment)} N·cm`), fact("状态", balanced ? "平衡" : diff > 0 ? "左端下沉" : "右端下沉")],
          conclusion: balanced ? "两侧力矩相等，杠杆平衡。" : diff > 0 ? "左侧力矩较大，杠杆会向左端下沉。" : "右侧力矩较大，杠杆会向右端下沉。",
          formula: "F₁l₁ = F₂l₂",
          formulaDetail: `${fmt(p1)} × ${fmt(p2)} = ${fmt(leftMoment)} N·cm；6 × 20 = ${fmt(rightMoment)} N·cm`,
          readout: `${fmt(leftMoment)} vs ${fmt(rightMoment)} N·cm`,
          badge: "杠杆平衡"
        };
      },
      visual: model => {
        const force = model.metrics[0];
        const leftArm = model.metrics[1];
        const leftPos = clamp(50 - (leftArm / 50) * 38, 10, 43);
        const rightPos = 50 + (20 / 50) * 38;
        const leftSize = clamp(42 + force * 3.2, 44, 76);
        const rightSize = 60;
        return genericShell(model, `
        <div class="lever-beam ${model.facts[2].value === "左端下沉" ? "tilt-left" : model.facts[2].value === "右端下沉" ? "tilt-right" : ""}">
          <i class="lever-left-weight" style="left:${leftPos}%;height:${leftSize}px"></i>
          <i class="lever-right-weight" style="left:${rightPos}%;height:${rightSize}px"></i>
          <span class="lever-ruler"></span>
          <span class="lever-arm lever-arm-left" style="left:${leftPos}%;right:50%"></span>
          <span class="lever-arm lever-arm-right" style="left:50%;right:${100 - rightPos}%"></span>
        </div>
        <div class="lever-fulcrum"></div>
        <div class="generic-label label-left">F₁=${fmt(force)}N｜l₁=${fmt(leftArm)}cm</div>
        <div class="generic-label label-right">F₂=6N｜l₂=20cm</div>`);
      },
      recognition: model => `杠杆平衡｜${model.formulaDetail}｜${model.facts[2].value}`,
      content: null
    },

    lens: {
      id: "lens",
      menuTitle: "凸透镜成像规律判断",
      menuMeta: "物距 · 焦距 · 像距与性质",
      stage: "初中核心",
      block: "光学",
      title: "凸透镜成像：物距改变时像如何变化",
      defaults: [30, 10],
      keywords: /凸透镜|成像|物距|像距|焦距|光屏|实像|虚像/,
      params: [
        { label: "物距 u", desc: "调整物体到透镜的距离", unit: "cm", min: 6, max: 60, step: 1, value: 30 },
        { label: "焦距 f", desc: "调整凸透镜焦距", unit: "cm", min: 5, max: 25, step: 1, value: 10 }
      ],
      parse: {
        p1: [/(?:物距|u)\D{0,8}(\d+(?:\.\d+)?)\s*cm/i, /物体(?:到|距).*?(\d+(?:\.\d+)?)\s*cm/i],
        p2: [/(?:焦距|f)\D{0,8}(\d+(?:\.\d+)?)\s*cm/i]
      },
      failMessage: "当前凸透镜模板需要识别物距和焦距，例如：物距30cm，焦距10cm。",
      question: (p1, p2) => `将物体放在凸透镜前 ${fmt(p1)}cm 处，凸透镜焦距为 ${fmt(p2)}cm。请判断像距和成像性质。`,
      model: (u, f) => {
        let v = null;
        let nature = "";
        let scale = "";
        if (Math.abs(u - f) < 0.1) {
          nature = "不成清晰像";
          scale = "平行出射";
        } else if (u > f) {
          v = (u * f) / (u - f);
          nature = v > 0 ? "倒立实像" : "正立虚像";
          scale = u > 2 * f ? "缩小" : Math.abs(u - 2 * f) < 0.1 ? "等大" : "放大";
        } else {
          v = (u * f) / (u - f);
          nature = "正立虚像";
          scale = "放大";
        }
        const vText = v === null ? "无穷远" : `${fmt(Math.abs(v), 1)}cm`;
        const signedVText = v === null ? "无穷远" : `${fmt(v, 1)}cm`;
        const formulaDetail = v === null
          ? "u = f，折射光近似平行，不能在光屏上成清晰像。"
          : v < 0
            ? `由成像公式得 v = uf/(u−f) = ${signedVText}，负号表示像在物体同侧，虚像距 ${vText}`
            : `由成像公式得 v = uf/(u−f) = ${vText}`;
        return {
          visual: "visual-lens",
          metrics: [u, f, v === null ? 0 : Math.abs(v)],
          metricUnit: "cm",
          imageDistance: v,
          facts: [fact("像距", vText), fact("性质", nature), fact("大小", scale)],
          conclusion: `物距 ${fmt(u)}cm、焦距 ${fmt(f)}cm 时，成像性质为${scale}${nature}。`,
          formula: "1/f = 1/u + 1/v",
          formulaDetail,
          readout: `${nature} · ${scale}`,
          badge: "光路成像"
        };
      },
      visual: model => {
        const u = model.metrics[0];
        const v = model.imageDistance;
        const isVirtual = model.facts[1].value.includes("虚");
        const objectDist = clamp((u / 60) * 38, 8, 40);
        const objectX = 50 - objectDist;
        const imageDist = v === null ? 42 : clamp((Math.abs(v) / 60) * 38, 8, 40);
        const imageX = v === null ? 90 : v >= 0 ? 50 + imageDist : 50 - imageDist;
        const objectHeight = 86;
        const imageHeight = v === null ? 42 : clamp(objectHeight * Math.abs(v / u), 30, 118);
        const objectTop = 56 - objectHeight / 4.2;
        const imageTip = isVirtual ? 56 - imageHeight / 4.2 : 56 + imageHeight / 4.2;
        const noFiniteImage = v === null;
        const actualRayX = 94;
        const centralSlope = (56 - objectTop) / Math.max(1, 50 - objectX);
        const centralActualY = clamp(56 + centralSlope * (actualRayX - 50), 4, 96);
        const parallelSlope = noFiniteImage
          ? centralSlope
          : (objectTop - imageTip) / Math.max(1, 50 - imageX);
        const parallelActualY = clamp(objectTop + parallelSlope * (actualRayX - 50), 4, 96);
        const rayMarkup = isVirtual
          ? `<line x1="${objectX}" y1="${objectTop}" x2="50" y2="56"></line>
             <line x1="50" y1="56" x2="${actualRayX}" y2="${centralActualY}"></line>
             <line x1="${objectX}" y1="${objectTop}" x2="50" y2="${objectTop}"></line>
             <line x1="50" y1="${objectTop}" x2="${actualRayX}" y2="${parallelActualY}"></line>
             <line class="virtual-ray" x1="${imageX}" y1="${imageTip}" x2="50" y2="56"></line>
             <line class="virtual-ray" x1="${imageX}" y1="${imageTip}" x2="50" y2="${objectTop}"></line>`
          : noFiniteImage
            ? `<line x1="${objectX}" y1="${objectTop}" x2="50" y2="56"></line>
               <line x1="50" y1="56" x2="${actualRayX}" y2="${centralActualY}"></line>
               <line x1="${objectX}" y1="${objectTop}" x2="50" y2="${objectTop}"></line>
               <line x1="50" y1="${objectTop}" x2="${actualRayX}" y2="${parallelActualY}"></line>`
            : `<line x1="${objectX}" y1="${objectTop}" x2="50" y2="56"></line>
               <line x1="50" y1="56" x2="${imageX}" y2="${imageTip}"></line>
               <line x1="${objectX}" y1="${objectTop}" x2="50" y2="${objectTop}"></line>
               <line x1="50" y1="${objectTop}" x2="${imageX}" y2="${imageTip}"></line>`;
        return genericShell(model, `
          <div class="lens-axis"></div><div class="lens-body"></div>
          <svg class="lens-rays" viewBox="0 0 100 100" aria-hidden="true">
            ${rayMarkup}
          </svg>
          <div class="object-arrow" style="left:${objectX}%;height:${objectHeight}px"></div>
          ${noFiniteImage ? "" : `<div class="image-arrow ${isVirtual ? "virtual" : "inverted"}" style="left:${imageX}%;height:${imageHeight}px"></div>`}
          <div class="generic-label lens-object-label" style="left:${objectX}%">物体</div>
          <div class="generic-label lens-image-label" style="left:${noFiniteImage ? 82 : imageX}%">${noFiniteImage ? "像在无穷远" : "像"}</div>`);
      },
      recognition: model => `凸透镜成像｜${model.facts[0].value}｜${model.facts[2].value}${model.facts[1].value}`
    },

    buoyancy: {
      id: "buoyancy",
      menuTitle: "浮力与阿基米德原理验证",
      menuMeta: "F浮 = ρgV排 · 称重法",
      stage: "初中核心",
      block: "力学",
      title: "浮力实验：排开液体越多，浮力越大",
      defaults: [300, 1000],
      keywords: /浮力|阿基米德|排开|浸入/,
      params: [
        { label: "排液体积 V排", desc: "调整物体浸入液体体积", unit: "mL", min: 50, max: 800, step: 50, value: 300 },
        { label: "液体密度 ρ", desc: "调整液体密度", unit: "kg/m³", min: 700, max: 1300, step: 50, value: 1000 }
      ],
      parse: {
        p1: [/(?:排开|浸入|体积|V排)\D{0,8}(\d+(?:\.\d+)?)\s*(?:mL|毫升|cm3|cm³)/i],
        p2: [/(?:密度|ρ)\D{0,8}(\d+(?:\.\d+)?)\s*kg\s*\/?\s*m/i]
      },
      failMessage: "当前浮力模板需要识别排液体积和液体密度，例如：排开300mL，液体密度1000kg/m³。",
      question: (p1, p2) => `一个物体浸入液体后排开 ${fmt(p1)}mL 液体，液体密度为 ${fmt(p2)}kg/m³。请计算浮力并验证阿基米德原理。`,
      model: (volumeMl, density) => {
        const force = density * G * volumeMl * 1e-6;
        const objectWeight = 12;
        const apparent = objectWeight - force;
        return {
          visual: "visual-buoyancy",
          metrics: [volumeMl, density, force],
          metricUnit: "N",
          objectWeight,
          facts: [fact("浮力", `${fmt(force, 2)} N`), fact("测力计", `${fmt(apparent, 2)} N`), fact("验证", "F浮 = G排")],
          conclusion: `配套物体重力为 ${fmt(objectWeight)}N；排开液体重力约 ${fmt(force, 2)}N，浮力同为 ${fmt(force, 2)}N，测力计示数约 ${fmt(apparent, 2)}N。`,
          formula: "F浮 = ρgV排",
          formulaDetail: `${fmt(density)} × 9.8 × ${fmt(volumeMl)}×10⁻⁶ = ${fmt(force, 2)}N`,
          readout: `F浮 = ${fmt(force, 2)}N`,
          badge: "阿基米德原理"
        };
      },
      visual: model => genericShell(model, `
        <div class="tank"></div><div class="water-level"></div><div class="floating-block" style="top:${32 + clamp(model.metrics[0] / 800, 0, 1) * 18}%"></div>
        <div class="spring-scale"></div><div class="displaced-water" style="height:${clamp(model.metrics[0] / 8, 8, 88)}px"></div>
        <div class="generic-label label-left">物重 ${fmt(model.objectWeight)}N</div><div class="generic-label label-right">排开液体</div>`),
      recognition: model => `浮力实验｜${model.formulaDetail}｜${model.facts[0].value}`
    },

    friction: {
      id: "friction",
      menuTitle: "滑动摩擦力影响因素",
      menuMeta: "f = μN · 压力与粗糙程度",
      stage: "初中核心",
      block: "力学",
      title: "滑动摩擦：压力和接触面如何影响摩擦力",
      defaults: [10, 0.3],
      keywords: /摩擦|粗糙|木板|接触面|匀速拉动/,
      params: [
        { label: "压力 N", desc: "调整物体对接触面的压力", unit: "N", min: 2, max: 30, step: 1, value: 10 },
        { label: "摩擦因数 μ", desc: "调整接触面粗糙程度", unit: "", min: 0.1, max: 0.8, step: 0.05, value: 0.3 }
      ],
      parse: {
        p1: [/(?:压力|正压力|N)\D{0,8}(\d+(?:\.\d+)?)\s*N/i],
        p2: [/(?:摩擦因数|粗糙程度|μ)\D{0,8}(\d+(?:\.\d+)?)/i]
      },
      failMessage: "当前摩擦力模板需要识别压力和摩擦因数，例如：压力10N，摩擦因数0.3。",
      question: (p1, p2) => `用弹簧测力计匀速拉动物块，物块对水平面的压力为 ${fmt(p1)}N，接触面摩擦因数约为 ${fmt(p2, 2)}。求滑动摩擦力。`,
      model: (normal, mu) => {
        const friction = normal * mu;
        return {
          visual: "visual-friction",
          metrics: [normal, mu, friction],
          metricUnit: "N",
          facts: [fact("摩擦力", `${fmt(friction, 2)} N`), fact("运动条件", "匀速拉动"), fact("控制变量", "压力/粗糙程度")],
          conclusion: `匀速拉动时，弹簧测力计读数约等于滑动摩擦力 ${fmt(friction, 2)}N。`,
          formula: "f = μN",
          formulaDetail: `${fmt(mu, 2)} × ${fmt(normal)} = ${fmt(friction, 2)}N`,
          readout: `f = ${fmt(friction, 2)}N`,
          badge: "控制变量法"
        };
      },
      visual: model => {
        const normal = model.metrics[0];
        const mu = model.metrics[1];
        const friction = model.metrics[2];
        const roughness = clamp(mu / 0.8, 0.12, 1);
        const arrow = clamp(62 + friction * 13, 72, 190);
        const blockMass = clamp(1 + normal / 34, 1.05, 1.85);
        return genericShell(model, `
        <div class="rough-surface" style="--roughness:${roughness}"></div>
        <div class="friction-block" style="--block-mass:${blockMass}"><span>N=${fmt(normal)}N</span></div>
        <div class="pull-gauge"><strong>${fmt(friction, 2)}N</strong></div>
        <div class="force-arrow" style="width:${arrow}px"></div>
        <div class="generic-label label-left">接触面 μ=${fmt(mu, 2)}</div><div class="generic-label label-right">匀速读数=f</div>`);
      },
      recognition: model => `滑动摩擦｜${model.formulaDetail}｜${model.facts[0].value}`
    },

    lampPower: {
      id: "lampPower",
      menuTitle: "测量小灯泡电功率",
      menuMeta: "P = UI · 额定电压与亮度",
      stage: "初中核心",
      block: "电学",
      title: "小灯泡电功率：调到额定电压再读数",
      defaults: [2.5, 0.3],
      keywords: /小灯泡|电功率|额定电压|实际功率|灯泡/,
      params: [
        { label: "灯泡电压 U", desc: "调整电压表示数", unit: "V", min: 0.5, max: 6, step: 0.1, value: 2.5 },
        { label: "灯泡电流 I", desc: "调整电流表示数", unit: "A", min: 0.05, max: 1, step: 0.05, value: 0.3 }
      ],
      parse: {
        p1: [/(?:电压|U|额定电压)\D{0,8}(\d+(?:\.\d+)?)\s*V/i],
        p2: [/(?:电流|I)\D{0,8}(\d+(?:\.\d+)?)\s*A/i]
      },
      failMessage: "当前小灯泡功率模板需要识别电压和电流，例如：电压2.5V，电流0.3A。",
      question: (p1, p2) => `测量小灯泡电功率时，电压表示数为 ${fmt(p1, 1)}V，电流表示数为 ${fmt(p2, 2)}A。求小灯泡实际功率，并判断亮度变化。`,
      model: (u, i) => {
        const power = u * i;
        const rated = Math.abs(u - 2.5) <= 0.15 ? "接近额定电压" : u > 2.5 ? "高于额定电压" : "低于额定电压";
        const brightness = power > 0.9 ? "偏亮" : power < 0.6 ? "偏暗" : "接近正常";
        return {
          visual: "visual-lamp",
          metrics: [u, i, power],
          metricUnit: "W",
          facts: [fact("实际功率", `${fmt(power, 2)} W`), fact("电压状态", rated), fact("亮度趋势", brightness)],
          conclusion: `根据电压表和电流表读数，实际功率 P = ${fmt(power, 2)}W；亮度只作同一灯泡在不同实际功率下的定性比较。`,
          formula: "P = UI",
          formulaDetail: `${fmt(u, 1)} × ${fmt(i, 2)} = ${fmt(power, 2)}W`,
          readout: `P = ${fmt(power, 2)}W`,
          badge: "电功率测量"
        };
      },
      visual: model => {
        const voltage = model.metrics[0];
        const current = model.metrics[1];
        const power = model.metrics[2];
        const lampLevel = clamp(power / 2, .15, 1);
        return genericShell(model, `
          <div class="circuit-standard-badge generic-circuit-badge">教材电路图 · 电流表串联 · 电压表并联</div>
          <svg class="edu-circuit-svg generic-edu-circuit lamp-power-schematic" viewBox="0 0 760 400" role="img" aria-label="测量小灯泡电功率电路：电源、开关、电流表、滑动变阻器和小灯泡串联，电压表并联在小灯泡两端" style="--lamp-level:${lampLevel}">
            <g class="edu-wire">
              <path d="M110 145V78H215"></path>
              <path d="M280 78H396"></path>
              <path d="M464 78H650V260H588"></path>
              <path d="M512 260H350"></path>
              <path d="M230 260H110V175"></path>
            </g>

            <g class="edu-source" aria-label="电源">
              <line class="source-long" x1="78" y1="145" x2="142" y2="145"></line>
              <line class="source-short" x1="91" y1="175" x2="129" y2="175"></line>
              <text class="polarity positive" x="68" y="150">+</text>
              <text class="polarity negative" x="76" y="184">−</text>
              <text class="component-label" x="110" y="211" text-anchor="middle">电源 ${fmt(voltage, 1)}V</text>
            </g>

            <g class="edu-switch edu-switch-closed" aria-label="闭合开关">
              <circle cx="220" cy="78" r="5"></circle>
              <circle cx="275" cy="78" r="5"></circle>
              <line x1="225" y1="78" x2="270" y2="78"></line>
              <text class="component-label" x="248" y="50" text-anchor="middle">开关 S</text>
            </g>

            <g class="edu-meter" aria-label="电流表串联">
              <circle cx="430" cy="78" r="34"></circle>
              <text class="meter-letter" x="430" y="87" text-anchor="middle">A</text>
              <text class="component-value" x="430" y="132" text-anchor="middle">${fmt(current, 2)}A</text>
            </g>

            <g class="edu-variable-resistor" aria-label="滑动变阻器串联">
              <rect x="230" y="242" width="120" height="36"></rect>
              <line class="slider-arrow" x1="270" y1="215" x2="318" y2="248"></line>
              <path class="slider-arrow-head" d="M318 248L305 245M318 248L313 236"></path>
              <text class="component-symbol" x="290" y="266" text-anchor="middle">Rₚ</text>
              <text class="component-label" x="290" y="306" text-anchor="middle">滑动变阻器</text>
            </g>

            <g class="edu-lamp" aria-label="小灯泡，符号为圆圈内交叉线">
              <circle class="lamp-halo" cx="550" cy="260" r="52"></circle>
              <circle class="lamp-circle" cx="550" cy="260" r="38"></circle>
              <line class="lamp-filament" x1="526" y1="236" x2="574" y2="284"></line>
              <line class="lamp-filament" x1="574" y1="236" x2="526" y2="284"></line>
              <text class="component-label" x="550" y="319" text-anchor="middle">小灯泡 · P=${fmt(power, 2)}W</text>
            </g>

            <g class="edu-voltmeter-branch" aria-label="电压表并联在小灯泡两端">
              <path class="edu-wire" d="M490 260V354H520M580 354H610V260"></path>
              <circle class="junction" cx="490" cy="260" r="5"></circle>
              <circle class="junction" cx="610" cy="260" r="5"></circle>
              <g class="edu-meter">
                <circle cx="550" cy="354" r="30"></circle>
                <text class="meter-letter" x="550" y="363" text-anchor="middle">V</text>
              </g>
              <text class="component-value" x="626" y="361">${fmt(voltage, 1)}V</text>
            </g>
          </svg>`);
      },
      recognition: model => `小灯泡功率｜${model.formulaDetail}｜${model.facts[1].value}`
    },

    seriesCircuit: {
      id: "seriesCircuit",
      menuTitle: "串联电路动态分析",
      menuMeta: "滑动变阻器 · 电流与电压变化",
      stage: "初中核心",
      block: "电学",
      title: "串联电路动态：电阻变大时电流怎样变",
      defaults: [6, 8],
      keywords: /串联|滑动变阻器|动态电路|电压表|电流表|电阻变大|电阻变小|R1|R2|R₁|R₂|总电阻/,
      params: [
        { label: "电源电压 U", desc: "调整电源电压", unit: "V", min: 3, max: 12, step: 1, value: 6 },
        { label: "滑变电阻 R₂", desc: "调整滑动变阻器阻值", unit: "Ω", min: 2, max: 20, step: 1, value: 8 }
      ],
      parse: {
        p1: [/(?:电源电压|电压|U)\D{0,8}(\d+(?:\.\d+)?)\s*V/i],
        p2: [/(?:滑动变阻器|滑变|R2|R₂|电阻)\D{0,8}(\d+(?:\.\d+)?)\s*(?:欧|Ω)/i]
      },
      failMessage: "当前串联动态模板需要识别电源电压和滑动变阻器阻值，例如：电源6V，滑变8Ω。",
      question: (p1, p2) => `R₁=4Ω 与滑动变阻器 R₂ 串联，电源电压为 ${fmt(p1)}V，R₂=${fmt(p2)}Ω。求电路电流和 R₂ 两端电压。`,
      model: (u, r2) => {
        const r1 = 4;
        const current = u / (r1 + r2);
        const v2 = current * r2;
        return {
          visual: "visual-series",
          metrics: [u, r2, current],
          metricUnit: "A",
          facts: [fact("总电阻", `${fmt(r1 + r2)} Ω`), fact("电流", `${fmt(current, 2)} A`), fact("U₂", `${fmt(v2, 2)} V`)],
          conclusion: `串联电路总电阻为 ${fmt(r1 + r2)}Ω，电流为 ${fmt(current, 2)}A，R₂ 分得 ${fmt(v2, 2)}V。`,
          formula: "I = U / (R₁ + R₂)",
          formulaDetail: `${fmt(u)} ÷ (4 + ${fmt(r2)}) = ${fmt(current, 2)}A`,
          readout: `I = ${fmt(current, 2)}A`,
          badge: "串联规律"
        };
      },
      visual: model => {
        const voltage = model.metrics[0];
        const r2 = model.metrics[1];
        const current = model.metrics[2];
        const slider = clamp((r2 - 2) / 18, 0, 1);
        const sliderX = 444 + slider * 92;
        const v2 = current * r2;
        return genericShell(model, `
          <div class="circuit-standard-badge generic-circuit-badge">教材电路图 · R₁、R₂ 串联 · 电压表测 R₂</div>
          <svg class="edu-circuit-svg generic-edu-circuit series-circuit-schematic" viewBox="0 0 760 400" role="img" aria-label="串联动态电路：电源、开关、电流表、定值电阻和滑动变阻器串联，电压表并联在滑动变阻器两端">
            <g class="edu-wire">
              <path d="M105 145V76H205"></path>
              <path d="M270 76H431"></path>
              <path d="M499 76H650V270H560"></path>
              <path d="M420 270H320"></path>
              <path d="M200 270H105V175"></path>
            </g>

            <g class="edu-source" aria-label="电源">
              <line class="source-long" x1="73" y1="145" x2="137" y2="145"></line>
              <line class="source-short" x1="86" y1="175" x2="124" y2="175"></line>
              <text class="polarity positive" x="63" y="150">+</text>
              <text class="polarity negative" x="71" y="184">−</text>
              <text class="component-label" x="105" y="211" text-anchor="middle">电源 ${fmt(voltage)}V</text>
            </g>

            <g class="edu-switch edu-switch-closed" aria-label="闭合开关">
              <circle cx="210" cy="76" r="5"></circle>
              <circle cx="265" cy="76" r="5"></circle>
              <line x1="215" y1="76" x2="260" y2="76"></line>
              <text class="component-label" x="238" y="48" text-anchor="middle">开关 S</text>
            </g>

            <g class="edu-meter" aria-label="电流表串联">
              <circle cx="465" cy="76" r="34"></circle>
              <text class="meter-letter" x="465" y="85" text-anchor="middle">A</text>
              <text class="component-value" x="465" y="130" text-anchor="middle">${fmt(current, 2)}A</text>
            </g>

            <g class="edu-resistor" aria-label="定值电阻 R1">
              <rect class="resistor-body" x="200" y="252" width="120" height="36"></rect>
              <text class="component-symbol" x="260" y="276" text-anchor="middle">R₁</text>
              <text class="component-value" x="260" y="316" text-anchor="middle">4Ω</text>
            </g>

            <g class="edu-variable-resistor" aria-label="滑动变阻器 R2">
              <rect x="420" y="252" width="140" height="36"></rect>
              <line class="slider-arrow" x1="${sliderX - 35}" y1="216" x2="${sliderX}" y2="252"></line>
              <path class="slider-arrow-head" d="M${sliderX} 252L${sliderX - 14} 247M${sliderX} 252L${sliderX - 5} 238"></path>
              <text class="component-symbol" x="490" y="276" text-anchor="middle">R₂</text>
              <text class="component-value" x="490" y="316" text-anchor="middle">${fmt(r2)}Ω</text>
            </g>

            <g class="edu-voltmeter-branch" aria-label="电压表并联在 R2 两端">
              <path class="edu-wire" d="M390 270V360H456M524 360H590V270"></path>
              <circle class="junction" cx="390" cy="270" r="5"></circle>
              <circle class="junction" cx="590" cy="270" r="5"></circle>
              <g class="edu-meter">
                <circle cx="490" cy="360" r="34"></circle>
                <text class="meter-letter" x="490" y="369" text-anchor="middle">V</text>
              </g>
              <text class="component-value" x="545" y="368">${fmt(v2, 2)}V</text>
            </g>
          </svg>`);
      },
      recognition: model => `串联电路｜${model.formulaDetail}｜${model.facts[2].value}`
    },

    heatBalance: {
      id: "heatBalance",
      menuTitle: "比热容与热平衡计算",
      menuMeta: "Q = cmΔt · 热量守恒",
      stage: "初中核心",
      block: "热学",
      title: "热平衡：热水和冷水混合后的温度",
      defaults: [100, 80],
      keywords: /比热容|热平衡|热量|吸热|放热|混合|初温|水温/,
      params: [
        { label: "热水质量 m₁", desc: "调整热水质量", unit: "g", min: 50, max: 500, step: 10, value: 100 },
        { label: "热水初温 t₁", desc: "调整热水初温", unit: "℃", min: 30, max: 95, step: 1, value: 80 }
      ],
      parse: {
        p1: [/(?:将|把)\s*(\d+(?:\.\d+)?)\s*g[\s\S]{0,24}?热水/i, /(\d+(?:\.\d+)?)\s*g[\s\S]{0,16}?热水/i, /(?:热水质量|m1|m₁)\D{0,8}(\d+(?:\.\d+)?)\s*g/i],
        p2: [/(?:热水初温|初温|温度|t1|t₁)\D{0,8}(\d+(?:\.\d+)?)\s*(?:℃|摄氏度|度)/i]
      },
      failMessage: "当前热平衡模板需要识别热水质量和热水初温，例如：热水100g，初温80℃。",
      question: (p1, p2) => `将 ${fmt(p1)}g、${fmt(p2)}℃ 的热水与 200g、20℃ 的冷水混合，不计热量损失，求热平衡温度。`,
      model: (mHot, tHot) => {
        const mCold = 200;
        const tCold = 20;
        const t = (mHot * tHot + mCold * tCold) / (mHot + mCold);
        const q = 4.2 * mHot * (tHot - t);
        return {
          visual: "visual-heat",
          metrics: [mHot, tHot, t],
          metricUnit: "℃",
          facts: [fact("平衡温度", `${fmt(t, 1)}℃`), fact("热水放热", `${fmt(q, 0)} J`), fact("条件", "不计热损失")],
          conclusion: `同种物质水混合时，热水放热等于冷水吸热，平衡温度约 ${fmt(t, 1)}℃。`,
          formula: "Q吸 = Q放",
          formulaDetail: `m₁(t₁−t)=m₂(t−20)，t≈${fmt(t, 1)}℃`,
          readout: `t = ${fmt(t, 1)}℃`,
          badge: "热量守恒"
        };
      },
      visual: model => genericShell(model, `
        <div class="cup hot-cup" style="--liquid-level:${clamp(model.metrics[0] / 500, .18, 1)}"><span>${fmt(model.metrics[0])}g · ${fmt(model.metrics[1])}℃</span></div>
        <div class="cup cold-cup" style="--liquid-level:.4"><span>200g · 20℃</span></div><div class="heat-arrow"></div>
        <div class="thermometer"><i style="height:${clamp(model.metrics[2], 18, 88)}%"></i></div>`),
      recognition: model => `热平衡｜${model.formulaDetail}｜${model.facts[0].value}`
    },

    liquidPressure: {
      id: "liquidPressure",
      menuTitle: "液体压强与深度关系",
      menuMeta: "p = ρgh · 深度越大压强越大",
      stage: "初中核心",
      block: "力学",
      title: "液体压强：深度和密度如何改变压强",
      defaults: [30, 1000],
      keywords: /液体压强|压强计|深度|p=ρgh|rho|盐水|水银/,
      params: [
        { label: "探头深度 h", desc: "调整探头到液面的深度", unit: "cm", min: 5, max: 100, step: 5, value: 30 },
        { label: "液体密度 ρ", desc: "调整液体种类或密度", unit: "kg/m³", min: 700, max: 1300, step: 50, value: 1000 }
      ],
      parse: {
        p1: [/(?:深度|h)\D{0,8}(\d+(?:\.\d+)?)\s*cm/i],
        p2: [/(?:密度|ρ)\D{0,8}(\d+(?:\.\d+)?)\s*kg/i]
      },
      failMessage: "当前液体压强模板需要识别深度和液体密度，例如：深度30cm，密度1000kg/m³。",
      question: (p1, p2) => `将压强计探头放入液体中，深度为 ${fmt(p1)}cm，液体密度为 ${fmt(p2)}kg/m³。求该处液体压强。`,
      model: (hCm, rho) => {
        const p = rho * G * hCm / 100;
        return {
          visual: "visual-pressure",
          metrics: [hCm, rho, p],
          metricUnit: "Pa",
          facts: [fact("压强", `${fmt(p, 0)} Pa`), fact("影响因素", "ρ 与 h"), fact("方向", "同液同深，各向压强相等")],
          conclusion: `液体内部压强随深度和液体密度增大而增大，此处约 ${fmt(p, 0)}Pa。`,
          formula: "p = ρgh",
          formulaDetail: `${fmt(rho)} × 9.8 × ${fmt(hCm / 100, 2)} = ${fmt(p, 0)}Pa`,
          readout: `p = ${fmt(p, 0)}Pa`,
          badge: "液体压强"
        };
      },
      visual: model => genericShell(model, `
        <div class="pressure-tank"></div><div class="pressure-water"></div>
        <div class="pressure-probe" style="top:${clamp(46 + model.metrics[0] * 1.1, 56, 168)}px"></div>
        <div class="u-tube"><i style="height:${clamp(model.metrics[2] / 120, 12, 88)}px"></i></div>`),
      recognition: model => `液体压强｜${model.formulaDetail}｜${model.facts[0].value}`
    },

    efficiency: {
      id: "efficiency",
      menuTitle: "机械效率实验",
      menuMeta: "η = W有 / W总 · 滑轮组",
      stage: "初中核心",
      block: "力学",
      title: "机械效率：有用功占总功多少",
      defaults: [30, 12],
      keywords: /机械效率|有用功|总功|滑轮组|额外功|提升|绳端拉力/,
      params: [
        { label: "物重 G", desc: "调整被提升物体重力", unit: "N", min: 5, max: 80, step: 5, value: 30 },
        { label: "绳端拉力 F", desc: "调整拉力读数", unit: "N", min: 3, max: 40, step: 1, value: 12 }
      ],
      parse: {
        p1: [/(?:物重|重物|G)\D{0,8}(\d+(?:\.\d+)?)\s*N/i],
        p2: [/(?:拉力|F)\D{0,8}(\d+(?:\.\d+)?)\s*N/i]
      },
      failMessage: "当前机械效率模板需要识别物重和绳端拉力，例如：物重30N，拉力12N。",
      question: (p1, p2) => `用三段绳承担重物的滑轮组提升物体，物重 ${fmt(p1)}N，绳端拉力 ${fmt(p2)}N。求机械效率。`,
      model: (load, force) => {
        const n = 3;
        const rawEta = load / (n * force);
        const eta = clamp(rawEta, 0, 1);
        const etaText = rawEta > 1 ? "超过100%（读数异常）" : `${fmt(rawEta * 100, 1)}%`;
        const conclusion = rawEta > 1
          ? "机械效率不可能超过 100%，该组读数说明拉力、承担绳段或实验记录需要复核。"
          : `同一高度下 η = G/(nF)，该滑轮组机械效率约 ${fmt(rawEta * 100, 1)}%。`;
        return {
          visual: "visual-efficiency",
          metrics: [load, force, rawEta * 100],
          metricUnit: "%",
          facts: [fact("机械效率", etaText), fact("承担绳段", "3 段"), fact("额外功", rawEta <= 1 ? "存在" : "读数需复核")],
          conclusion,
          formula: "η = W有 / W总 = Gh / Fs",
          formulaDetail: `η = ${fmt(load)} ÷ (3 × ${fmt(force)}) = ${fmt(rawEta * 100, 1)}%`,
          readout: rawEta > 1 ? "读数需复核" : `η = ${fmt(rawEta * 100, 1)}%`,
          badge: "机械效率"
        };
      },
      visual: model => {
        const load = model.metrics[0];
        const force = model.metrics[1];
        const eta = model.metrics[2];
        const invalid = eta > 100;
        const loadScale = clamp(load / 45, .85, 1.55);
        const pullHeight = clamp(80 + force * 2, 90, 150);
        const etaGlow = clamp(Math.min(eta, 100) / 100, .25, 1);
        return genericShell(model, `
        <div class="pulley top-pulley"></div><div class="pulley move-pulley"></div><div class="pulley-rope"></div>
        <div class="lift-load" style="--load-scale:${loadScale}"><strong>${fmt(load)}N</strong></div>
        <div class="pull-arrow" style="height:${pullHeight}px;--eta-glow:${etaGlow}"><span>F=${fmt(force)}N</span></div>
        <div class="generic-label label-right">${invalid ? "读数异常：η > 100%" : `η=${fmt(eta, 1)}%`}</div>`);
      },
      recognition: model => `机械效率｜${model.formulaDetail}｜${model.facts[0].value}`
    },

    sound: {
      id: "sound",
      menuTitle: "声音的传播与音调响度",
      menuMeta: "频率定音调 · 振幅定响度",
      stage: "初中核心",
      block: "声学",
      title: "声音波形：频率和振幅分别改变什么",
      defaults: [440, 50],
      keywords: /声音|声波|音调|响度|频率|振幅|介质|波形/,
      params: [
        { label: "频率 f", desc: "调整声源振动频率", unit: "Hz", min: 100, max: 1000, step: 20, value: 440 },
        { label: "振幅 A", desc: "调整声源振动幅度", unit: "%", min: 10, max: 100, step: 5, value: 50 }
      ],
      parse: {
        p1: [/(?:频率|f)\D{0,8}(\d+(?:\.\d+)?)\s*Hz/i],
        p2: [/(?:振幅|响度|A)\D{0,8}(\d+(?:\.\d+)?)\s*%?/i]
      },
      failMessage: "当前声音模板需要识别频率和振幅，例如：频率440Hz，振幅50%。",
      question: (p1, p2) => `声源频率为 ${fmt(p1)}Hz，振幅为 ${fmt(p2)}%。按空气中声速约 340m/s，判断音调、响度并估算波长。`,
      model: (freq, amp) => {
        const wavelength = AIR_SPEED / freq;
        return {
          visual: "visual-sound",
          metrics: [freq, amp, wavelength],
          metricUnit: "m",
          facts: [fact("波长", `${fmt(wavelength, 2)} m`), fact("音调", freq > 600 ? "较高" : freq < 260 ? "较低" : "中等"), fact("响度", amp > 70 ? "较强" : amp < 30 ? "较弱" : "中等")],
          conclusion: `频率决定音调，振幅影响响度；按空气中声速约 340m/s 估算，波长约 ${fmt(wavelength, 2)}m。`,
          formula: "v = fλ",
          formulaDetail: `λ = 340 ÷ ${fmt(freq)} = ${fmt(wavelength, 2)}m`,
          readout: `λ = ${fmt(wavelength, 2)}m`,
          badge: "声音三要素"
        };
      },
      visual: model => {
        const amp = clamp(model.metrics[1] / 100, .1, 1);
        const cycles = clamp(model.metrics[0] / 120, 1.2, 8);
        return genericShell(model, `
          <svg class="sound-wave" viewBox="0 0 520 220" preserveAspectRatio="none">
            <path d="${Array.from({ length: 80 }, (_, i) => {
              const x = (i / 79) * 520;
              const y = 110 + Math.sin((i / 79) * Math.PI * 2 * cycles) * 74 * amp;
              return `${i ? "L" : "M"}${fmt(x, 1)} ${fmt(y, 1)}`;
            }).join(" ")}"></path>
          </svg>
          <div class="speaker"></div><div class="generic-label label-right">空气传播</div>`);
      },
      recognition: model => `声音波形｜${model.formulaDetail}｜音调${model.facts[1].value}、响度${model.facts[2].value}`
    }
  };

  templates.lens.content = null;

  Object.values(templates).forEach(template => {
    const nextA = clamp(template.defaults[0] + Number(template.params[0].step) * 2, template.params[0].min, template.params[0].max);
    const nextB = clamp(template.defaults[1] + Number(template.params[1].step) * 2, template.params[1].min, template.params[1].max);
    template.examples = [
      { p1: template.defaults[0], p2: template.defaults[1], question: template.question(template.defaults[0], template.defaults[1]) },
      { p1: nextA, p2: nextB, question: template.question(nextA, nextB) }
    ];
    template.content = (p1 = template.defaults[0], p2 = template.defaults[1]) => {
      const model = template.model(Number(p1), Number(p2));
      return {
        title: template.title,
        description: `${template.stage}｜${template.block}｜${model.conclusion}`,
        engine: `${template.stage} · ${template.block}模板`,
        ar: "当前为网页端典型题型模板演示，可继续扩展移动端空间观察。",
        metrics: [
          [template.params[0].label.replace(/\s.+$/, ""), template.params[0].unit],
          [template.params[1].label.replace(/\s.+$/, ""), template.params[1].unit],
          [model.facts[0].label, model.metricUnit || ""]
        ],
        params: template.params.map((param, index) => ({ ...param, value: index === 0 ? Number(p1) : Number(p2) })),
        steps: commonSteps(model, [
          `${template.params[0].label} = ${fmt(p1)}${template.params[0].unit}，${template.params[1].label} = ${fmt(p2)}${template.params[1].unit}`,
          model.formula,
          model.formulaDetail,
          model.conclusion
        ]),
        mentor: `关键追问：这个题型中，哪个量是被控制的变量？哪个量会随着参数变化而改变？`,
        hint: `小提示：先锁定核心公式 <strong>${model.formula}</strong>，再逐一代入题目给出的物理量。`,
        challenge: `试试看：拖动下方参数，观察 <strong>${model.facts[0].label}</strong> 如何变化，并用公式解释。`,
        generationStages: stages(`识别${template.menuTitle}条件`, `匹配核心关系：${model.badge}`, `生成结论：${model.readout}`),
        recognitionText: template.recognition(model),
        formulaHtml: `${model.formulaDetail}<br>${model.conclusion}`,
        sceneTip: model.conclusion,
        model,
        stage: template.stage,
        block: template.block,
        facts: model.facts,
        visualHtml: template.visual(model),
        resultTitle: model.readout,
        resultDescription: model.conclusion
      };
    };
    template.parseQuestion = text => templateParse(template, text);
  });

  window.EXTRA_PHYSICS_TEMPLATES = templates;
})();
