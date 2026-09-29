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

  /* ---------- Textbook-style SVG diagrams (viewBox 760 × 400) ---------- */
  const n2 = value => Number(Number(value).toFixed(2));
  const sci = value => {
    const number = Number(value);
    if (!Number.isFinite(number) || number === 0) return "0";
    const exp = Math.floor(Math.log10(Math.abs(number)));
    if (exp < 4) return fmt(number, 0);
    const mantissa = number / 10 ** exp;
    return `${fmt(mantissa, 2)}×10${String(exp).split("").map(ch => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(ch)]).join("")}`;
  };
  const diagramDefs = `<defs>
      <marker id="dgArrowRed" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#d9412f"/></marker>
      <marker id="dgArrowBlue" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#2563c9"/></marker>
      <marker id="dgArrowGreen" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#1b9270"/></marker>
      <marker id="dgArrowInk" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#445a78"/></marker>
      <marker id="dgRayArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1.5L8 5L1 8.5" fill="none" stroke="#d9412f" stroke-width="1.6"/></marker>
      <pattern id="dgHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V8" stroke="#6b7f99" stroke-width="1.4"/></pattern>
    </defs>`;
  const diagram = (className, label, body) => `
    <svg class="edu-circuit-svg edu-diagram ${className}" viewBox="0 0 760 400" role="img" aria-label="${label}">
      ${diagramDefs}${body}
    </svg>`;
  const dimension = (x1, y1, x2, y2, text, textX, textY, anchor = "middle") => `
    <line class="dg-dim" x1="${n2(x1)}" y1="${n2(y1)}" x2="${n2(x2)}" y2="${n2(y2)}" marker-start="url(#dgArrowInk)" marker-end="url(#dgArrowInk)"/>
    <text class="dg-dim-text" x="${n2(textX)}" y="${n2(textY)}" text-anchor="${anchor}">${text}</text>`;
  const caption = (text, x = 380, y = 26) => `<text class="dg-caption" x="${x}" y="${y}" text-anchor="middle">${text}</text>`;

  function leverDiagram(force, arm, status) {
    const cx = 380;
    const cy = 150;
    const scale = 6;
    const angle = status === "左端下沉" ? -5 : status === "右端下沉" ? 5 : 0;
    const rad = (angle * Math.PI) / 180;
    const place = dx => ({ x: cx + dx * Math.cos(rad), y: cy + dx * Math.sin(rad) });
    const left = place(-arm * scale);
    const right = place(20 * scale);
    const ticks = [];
    for (let cm = -50; cm <= 50; cm += 5) {
      const x = cx + cm * scale;
      ticks.push(`<line class="dg-lever-tick" x1="${x}" y1="${cm % 10 ? cy - 3 : cy - 6}" x2="${x}" y2="${cy + 6}"/>`);
      if (cm && cm % 10 === 0) ticks.push(`<text class="dg-lever-mark" x="${x}" y="${cy - 10}" text-anchor="middle">${Math.abs(cm)}</text>`);
    }
    const weights = (point, count, side) => {
      const top = point.y + 24;
      const blocks = Array.from({ length: count }, (_, index) => {
        const y = top + index * 11;
        return `<rect class="dg-weight" x="${n2(point.x - 12)}" y="${n2(y)}" width="24" height="9.5" rx="2.5"/>`;
      }).join("");
      const arrowX = point.x + (side === "left" ? -24 : 24);
      const length = 26 + count * 7;
      return `<line class="dg-string" x1="${n2(point.x)}" y1="${n2(point.y + 6)}" x2="${n2(point.x)}" y2="${n2(top)}"/>${blocks}
        <line class="dg-force" x1="${n2(arrowX)}" y1="${n2(point.y + 8)}" x2="${n2(arrowX)}" y2="${n2(point.y + 8 + length)}" marker-end="url(#dgArrowRed)"/>`;
    };
    const armY = 350;
    const leftForceLabel = left.x < 140
      ? { x: 22, y: 76, anchor: "start" }
      : { x: left.x - 30, y: left.y + 40 + force * 7, anchor: "end" };
    return diagram("dg-lever", `杠杆平衡条件实验：支点 O 在中点，左侧挂 ${force} 个钩码距支点 ${arm}cm，右侧挂 6 个钩码距支点 20cm`, `
      ${caption(status === "平衡" ? "杠杆在水平位置平衡：F₁l₁ = F₂l₂" : `F₁l₁ ${status === "左端下沉" ? ">" : "<"} F₂l₂，杠杆${status}`)}
      <text class="dg-note" x="748" y="394" text-anchor="end">每个钩码重 1 N · 刻度单位 cm</text>
      <path class="dg-support" d="M${cx} ${cy + 4}L${cx - 22} ${cy + 58}H${cx + 22}Z"/>
      <rect class="dg-base" x="${cx - 60}" y="${cy + 58}" width="120" height="9" rx="2"/>
      <g transform="rotate(${angle} ${cx} ${cy})">
        <rect class="dg-lever-bar" x="${cx - 312}" y="${cy - 6}" width="624" height="12" rx="3"/>
        ${ticks.join("")}
      </g>
      <circle class="dg-pivot" cx="${cx}" cy="${cy}" r="4.5"/>
      <text class="dg-label" x="${cx + 10}" y="${cy + 26}">O</text>
      ${weights(left, force, "left")}
      ${weights(right, 6, "right")}
      <text class="dg-force-text" x="${n2(leftForceLabel.x)}" y="${n2(leftForceLabel.y)}" text-anchor="${leftForceLabel.anchor}">F₁ = ${fmt(force)} N</text>
      <text class="dg-force-text" x="${n2(right.x + 30)}" y="${n2(right.y + 82)}">F₂ = 6 N</text>
      <line class="dg-extension" x1="${cx}" y1="${cy + 70}" x2="${cx}" y2="${armY + 8}"/>
      <line class="dg-extension" x1="${n2(left.x)}" y1="${n2(left.y + 34 + force * 11)}" x2="${n2(left.x)}" y2="${armY + 8}"/>
      <line class="dg-extension" x1="${n2(right.x)}" y1="${n2(right.y + 96)}" x2="${n2(right.x)}" y2="${armY + 8}"/>
      ${dimension(left.x, armY, cx, armY, `l₁ = ${fmt(arm)} cm`, (left.x + cx) / 2, armY - 8)}
      ${dimension(cx, armY, right.x, armY, "l₂ = 20 cm", (cx + right.x) / 2, armY - 8)}`);
  }

  function lensRule(u, f) {
    if (Math.abs(u - f) < 0.01) return { key: "focus", nature: "不成像", range: "u = f", image: "折射光平行射出", use: "获得平行光" };
    if (u < f) return { key: "virtual", nature: "正立、放大的虚像", range: "u < f", image: "像与物体在透镜同侧", use: "放大镜" };
    if (Math.abs(u - 2 * f) < 0.01) return { key: "equal", nature: "倒立、等大的实像", range: "u = 2f", image: "v = 2f", use: "测焦距" };
    if (u > 2 * f) return { key: "small", nature: "倒立、缩小的实像", range: "u > 2f", image: "f < v < 2f", use: "照相机" };
    return { key: "large", nature: "倒立、放大的实像", range: "f < u < 2f", image: "v > 2f", use: "投影仪" };
  }

  function lensDiagram(u, f, v) {
    const rule = lensRule(u, f);
    const axisY = 205;
    const lensX = 380;
    const base = Math.max(u, 2 * f);
    const leftCm = Math.max(u, 2 * f, v !== null && v < 0 ? Math.min(-v, 2.6 * base) : 0);
    const rightCm = Math.max(2 * f, v !== null && v > 0 ? Math.min(v, 2.6 * base) : 0);
    const s = Math.min(330 / leftCm, 330 / rightCm);
    const hObj = 58;
    const xo = lensX - u * s;
    const tip = { x: xo, y: axisY - hObj };
    const X = cm => n2(lensX + cm * s);
    const rays = [];
    const extra = [];
    const edge = 748;
    const lineTo = (x1, y1, x2, y2, cls = "dg-ray", mid = true) => `<path class="${cls}" d="M${n2(x1)} ${n2(y1)}L${n2(x2)} ${n2(y2)}" ${mid ? 'marker-mid="url(#dgRayArrow)"' : ""}/>`;
    const withMid = (x1, y1, x2, y2, cls) => `<path class="${cls}" d="M${n2(x1)} ${n2(y1)}L${n2((x1 + x2) / 2)} ${n2((y1 + y2) / 2)}L${n2(x2)} ${n2(y2)}" marker-mid="url(#dgRayArrow)"/>`;
    const extend = (x1, y1, x2, y2, toX) => {
      const k = (y2 - y1) / (x2 - x1);
      return { x: toX, y: y1 + k * (toX - x1) };
    };
    // Ray 1: parallel to the principal axis, refracted through the far focus F.
    rays.push(withMid(tip.x, tip.y, lensX, tip.y, "dg-ray"));
    const r1 = extend(lensX, tip.y, lensX + f * s, axisY, edge);
    rays.push(withMid(lensX, tip.y, r1.x, r1.y, "dg-ray"));
    // Ray 2: through the optical centre, undeviated.
    const r2 = extend(tip.x, tip.y, lensX, axisY, edge);
    rays.push(withMid(tip.x, tip.y, r2.x, r2.y, "dg-ray"));
    // Ray 3: through the near focus, refracted parallel (only when it actually reaches the lens).
    if (u > f + 0.01) {
      const hit = extend(tip.x, tip.y, lensX - f * s, axisY, lensX);
      if (Math.abs(hit.y - axisY) < 112) {
        rays.push(withMid(tip.x, tip.y, lensX, hit.y, "dg-ray dg-ray-3"));
        rays.push(withMid(lensX, hit.y, edge, hit.y, "dg-ray dg-ray-3"));
      }
    }
    let image = "";
    let note = "";
    if (v !== null) {
      const hImg = hObj * Math.abs(v / u);
      const xi = lensX + v * s;
      const visible = Math.abs(v) <= 2.6 * base + 0.01 && hImg <= 175;
      if (v > 0 && visible) {
        const crowded = xi - lensX < 95;
        const labelX = crowded ? Math.max(xi + 36, lensX + 2 * f * s + 16) : xi;
        const labelY = crowded ? axisY + 50 : Math.min(axisY + hImg + 30, 386);
        image = `<line class="dg-image" x1="${n2(xi)}" y1="${axisY}" x2="${n2(xi)}" y2="${n2(axisY + hImg)}" marker-end="url(#dgArrowBlue)"/>
          <text class="dg-label dg-blue" x="${n2(labelX)}" y="${n2(labelY)}" text-anchor="${crowded ? "start" : "middle"}">像（实像）</text>`;
      } else if (v < 0 && visible) {
        image = `<line class="dg-image dg-virtual" x1="${n2(xi)}" y1="${axisY}" x2="${n2(xi)}" y2="${n2(axisY - hImg)}" marker-end="url(#dgArrowBlue)"/>
          <text class="dg-label dg-blue" x="${n2(xi - 8)}" y="${n2(axisY - hImg - 8)}" text-anchor="end">像（虚像）</text>`;
        const top = { x: xi, y: axisY - hImg };
        extra.push(lineTo(lensX, tip.y, top.x, top.y, "dg-ray-back", false));
        extra.push(lineTo(lensX, axisY, top.x, top.y, "dg-ray-back", false));
      } else {
        note = v > 0 ? "像距很大，像在视野之外" : "虚像在视野之外";
      }
    } else {
      note = "物体在焦点上：折射光平行射出，不成像";
    }
    const marks = [[-2 * f, "2F"], [-f, "F"], [f, "F"], [2 * f, "2F"]].map(([cm, name]) => `
      <circle class="dg-focus" cx="${X(cm)}" cy="${axisY}" r="3.2"/>
      <text class="dg-small" x="${X(cm)}" y="${axisY + 20}" text-anchor="middle">${name}</text>`).join("");
    const uLine = dimension(xo, 330, lensX, 330, `u = ${fmt(u)} cm`, (xo + lensX) / 2, 322);
    const fLine = dimension(lensX, 360, lensX + f * s, 360, `f = ${fmt(f)} cm`, lensX + (f * s) / 2, 352);
    return diagram("dg-lens", `凸透镜成像光路图：${rule.range}，${rule.nature}`, `
      ${caption(`${rule.range}：${rule.nature}（${rule.use}）`)}
      <line class="dg-axis" x1="12" y1="${axisY}" x2="748" y2="${axisY}"/>
      <path class="dg-lens-body" d="M${lensX} ${axisY - 118}Q${lensX + 20} ${axisY} ${lensX} ${axisY + 118}Q${lensX - 20} ${axisY} ${lensX} ${axisY - 118}Z"/>
      <text class="dg-small" x="${lensX + 8}" y="${axisY + 20}">O</text>
      ${marks}
      ${extra.join("")}${rays.join("")}
      <line class="dg-object" x1="${n2(xo)}" y1="${axisY}" x2="${n2(xo)}" y2="${n2(tip.y)}" marker-end="url(#dgArrowGreen)"/>
      <text class="dg-label dg-green" x="${n2(xo - 8)}" y="${n2(axisY - hObj / 2)}" text-anchor="end">物体</text>
      ${image}
      ${note ? `<text class="dg-note dg-warn" x="740" y="58" text-anchor="end">${note}</text>` : ""}
      ${uLine}${fLine}`);
  }

  function buoyancyDiagram(volumeMl, density, force, weight, reading) {
    const surface = 250;
    const blockH = 80;
    const immersed = blockH * clamp(volumeMl / 800, 0, 1);
    const blockTop = surface + immersed - blockH;
    const scaleTop = 42;
    const perN = 6;
    const pointerY = scaleTop + 14 + reading * perN;
    const bucketWater = 58 * clamp(volumeMl / 800, 0, 1);
    const tint = clamp((density - 700) / 600, 0, 1);
    const liquid = `rgba(${Math.round(120 - 60 * tint)}, ${Math.round(180 - 40 * tint)}, ${Math.round(236 - 20 * tint)}, ${n2(0.36 + 0.24 * tint)})`;
    const ticks = Array.from({ length: 16 }, (_, index) => {
      const y = scaleTop + 14 + index * perN;
      return `<line class="dg-scale-tick" x1="${index % 5 ? 344 : 340}" y1="${n2(y)}" x2="350" y2="${n2(y)}"/>${index % 5 ? "" : `<text class="dg-scale-num" x="356" y="${n2(y + 4)}">${index}</text>`}`;
    }).join("");
    const spring = Array.from({ length: 9 }, (_, index) => {
      const y1 = scaleTop + 12 + (index * (pointerY - scaleTop - 14)) / 9;
      const y2 = scaleTop + 12 + ((index + 0.5) * (pointerY - scaleTop - 14)) / 9;
      return `L${index % 2 ? 322 : 338} ${n2(y1)}L${index % 2 ? 338 : 322} ${n2(y2)}`;
    }).join("");
    return diagram("dg-buoyancy", "阿基米德原理实验：弹簧测力计吊着物体浸入溢水杯，排开的液体流入小桶", `
      ${caption("称重法测浮力：F浮 = G − F示；阿基米德原理：F浮 = G排")}
      <rect class="dg-scale-case" x="312" y="${scaleTop}" width="54" height="118" rx="8"/>
      <path class="dg-spring" d="M330 ${scaleTop + 10}${spring}L330 ${n2(pointerY)}"/>
      ${ticks}
      <path class="dg-pointer" d="M318 ${n2(pointerY)}H352"/>
      <text class="dg-small" x="372" y="${scaleTop + 12}">N</text>
      <line class="dg-string" x1="330" y1="${scaleTop + 118}" x2="330" y2="${n2(blockTop)}"/>
      <text class="dg-label" x="300" y="${scaleTop + 50}" text-anchor="end">弹簧测力计</text>
      <text class="dg-value-text" x="300" y="${scaleTop + 80}" text-anchor="end">F示 = ${fmt(reading, 2)} N</text>
      <path class="dg-liquid" style="fill:${liquid}" d="M254 ${surface}H406V366H254Z"/>
      <rect class="dg-object-block" x="285" y="${n2(blockTop)}" width="90" height="${blockH}" rx="4"/>
      <path class="dg-liquid-front" style="fill:${liquid}" d="M285 ${surface}H375V${n2(Math.max(surface, blockTop + blockH))}H285Z"/>
      <path class="dg-glass" d="M250 150V370H410V${surface - 4}L470 ${surface + 26}"/>
      <path class="dg-glass" d="M410 ${surface + 8}L466 ${surface + 36}"/>
      <path class="dg-drip" d="M468 ${surface + 32}Q478 ${surface + 52} 486 ${surface + 60}"/>
      <text class="dg-label" x="244" y="186" text-anchor="end">溢水杯</text>
      <path class="dg-liquid" style="fill:${liquid}" d="M474 ${n2(368 - bucketWater)}H552V368H474Z"/>
      <path class="dg-glass" d="M470 300V372H556V300"/>
      <text class="dg-label" x="513" y="294" text-anchor="middle">小桶</text>
      <text class="dg-small" x="513" y="392" text-anchor="middle">排开液体 V排 = ${fmt(volumeMl)} mL</text>
      <text class="dg-small" x="252" y="392">ρ液 = ${fmt(density)} kg/m³</text>
      <g class="dg-table" transform="translate(596 110)">
        <rect width="156" height="150" rx="10"/>
        <text x="12" y="28">物重 G = ${fmt(weight)} N</text>
        <text x="12" y="56">F示 = ${fmt(reading, 2)} N</text>
        <text x="12" y="84">F浮 = G − F示</text>
        <text class="dg-value-text" x="12" y="114">= ${fmt(force, 2)} N</text>
        <text x="12" y="142">G排 = ${fmt(force, 2)} N</text>
      </g>`);
  }

  function frictionDiagram(pressure, mu, friction) {
    const extra = clamp(Math.round((pressure - 2) / 4), 0, 7);
    const weights = Array.from({ length: extra }, (_, index) => `<rect class="dg-weight" x="${292 + (index % 2) * 4}" y="${188 - index * 9}" width="36" height="8" rx="2"/>`).join("");
    const bumps = Array.from({ length: 64 }, (_, index) => {
      const x = 60 + index * 10;
      const height = 1.5 + mu * 7 * (index % 3 === 0 ? 1 : 0.55);
      return `L${x + 5} ${n2(262 - height)}L${x + 10} 262`;
    }).join("");
    const len = clamp(friction * 5, 16, 130);
    const gaugeMax = 25;
    const pointerX = 452 + (clamp(friction, 0, gaugeMax) / gaugeMax) * 140;
    const gaugeTicks = Array.from({ length: 6 }, (_, index) => {
      const x = 452 + index * 28;
      return `<line class="dg-scale-tick" x1="${x}" y1="224" x2="${x}" y2="${index % 1 ? 229 : 232}"/><text class="dg-scale-num" x="${x}" y="218" text-anchor="middle">${index * 5}</text>`;
    }).join("");
    return diagram("dg-friction", "探究滑动摩擦力：用弹簧测力计水平拉动木块在长木板上做匀速直线运动", `
      ${caption("匀速直线运动：拉力 F 与滑动摩擦力 f 是一对平衡力，f = F")}
      <path class="dg-board-surface" d="M60 262${bumps}V284H60Z"/>
      <text class="dg-small" x="66" y="304">长木板 · 接触面粗糙程度 μ = ${fmt(mu, 2)}</text>
      <rect class="dg-block" x="270" y="200" width="100" height="62" rx="4"/>
      <text class="dg-label" x="320" y="236" text-anchor="middle">木块</text>
      ${weights}
      ${extra ? `<text class="dg-small" x="336" y="${184 - extra * 9}">砝码</text>` : ""}
      <line class="dg-string" x1="370" y1="226" x2="432" y2="226"/>
      <rect class="dg-scale-case" x="432" y="210" width="176" height="32" rx="8"/>
      ${gaugeTicks}
      <path class="dg-pointer" d="M${n2(pointerX)} 214V240"/>
      <line class="dg-string" x1="608" y1="226" x2="632" y2="226"/>
      <text class="dg-label" x="520" y="262" text-anchor="middle">弹簧测力计（N）</text>
      <line class="dg-force dg-blue-force" x1="636" y1="226" x2="${n2(636 + Math.min(len, 100))}" y2="226" marker-end="url(#dgArrowBlue)"/>
      <text class="dg-force-text dg-blue" x="642" y="212">F = ${fmt(friction, 2)} N</text>
      <line class="dg-force" x1="296" y1="258" x2="${n2(296 - len)}" y2="258" marker-end="url(#dgArrowRed)"/>
      <text class="dg-force-text" x="${n2(290 - len)}" y="250" text-anchor="end">f = ${fmt(friction, 2)} N</text>
      <line class="dg-force dg-ink-force" x1="320" y1="262" x2="320" y2="${n2(262 + clamp(pressure * 3, 14, 90))}" marker-end="url(#dgArrowInk)"/>
      <text class="dg-force-text dg-ink" x="330" y="${n2(262 + clamp(pressure * 3, 14, 90))}">F压 = ${fmt(pressure)} N</text>
      <line class="dg-velocity" x1="270" y1="180" x2="330" y2="180" marker-end="url(#dgArrowGreen)"/>
      <text class="dg-small dg-green" x="236" y="184" text-anchor="middle">v（匀速）</text>`);
  }

  function pressureDiagram(depthCm, density, pressure) {
    const surface = 84;
    const px = 2.5;
    const probeY = surface + depthCm * px;
    const tint = clamp((density - 700) / 600, 0, 1);
    const liquid = `rgba(${Math.round(120 - 60 * tint)}, ${Math.round(180 - 40 * tint)}, ${Math.round(236 - 20 * tint)}, ${n2(0.34 + 0.26 * tint)})`;
    const deltaCm = depthCm * density / 1000;
    const k = 0.95;
    const half = (deltaCm * k) / 2;
    const rest = 232;
    const leftLevel = rest + half;
    const rightLevel = rest - half;
    const ruler = Array.from({ length: 11 }, (_, index) => {
      const y = surface + index * 10 * px;
      return `<line class="dg-scale-tick" x1="${index % 5 ? 104 : 98}" y1="${y}" x2="112" y2="${y}"/><text class="dg-scale-num" x="94" y="${y + 4}" text-anchor="end">${index * 10}</text>`;
    }).join("");
    return diagram("dg-pressure", "用 U 形管压强计探究液体内部压强：探头在液体中的深度越大，U 形管两侧液面高度差越大", `
      ${caption("U 形管两侧液面高度差反映探头处液体压强的大小")}
      <path class="dg-liquid" style="fill:${liquid}" d="M124 ${surface}H356V352H124Z"/>
      <path class="dg-glass" d="M120 56V356H360V56"/>
      ${ruler}
      <text class="dg-small" x="70" y="${surface - 20}">深度/cm</text>
      <path class="dg-tube" d="M258 ${n2(probeY - 8)}V70Q258 48 280 48H511Q533 48 533 70"/>
      <rect class="dg-probe" x="232" y="${n2(probeY - 10)}" width="52" height="20" rx="4"/>
      <line class="dg-membrane" x1="234" y1="${n2(probeY + 10)}" x2="282" y2="${n2(probeY + 10)}"/>
      ${dimension(206, surface, 206, probeY, "", 0, 0)}
      <text class="dg-dim-text" x="200" y="${n2((surface + probeY) / 2 + 4)}" text-anchor="end">h = ${fmt(depthCm)} cm</text>
      <path class="dg-u-liquid" d="M540 ${n2(leftLevel)}V330Q540 356 571 356Q602 356 602 330V${n2(rightLevel)}H616V330Q616 370 571 370Q526 370 526 330V${n2(leftLevel)}Z"/>
      <path class="dg-glass dg-u-tube" d="M526 76V330Q526 370 571 370Q616 370 616 330V76M540 76V330Q540 356 571 356Q602 356 602 330V76"/>
      <line class="dg-extension" x1="516" y1="${n2(leftLevel)}" x2="640" y2="${n2(leftLevel)}"/>
      <line class="dg-extension" x1="600" y1="${n2(rightLevel)}" x2="640" y2="${n2(rightLevel)}"/>
      ${deltaCm > 1 ? dimension(634, rightLevel, 634, leftLevel, "", 0, 0) : ""}
      <text class="dg-dim-text" x="646" y="${n2((leftLevel + rightLevel) / 2 + 4)}">Δh ≈ ${fmt(deltaCm, 1)} cm</text>
      <text class="dg-label" x="571" y="392" text-anchor="middle">U 形管压强计（管内为水）</text>
      <text class="dg-small" x="240" y="392" text-anchor="middle">ρ液 = ${fmt(density)} kg/m³ · p = ρgh = ${fmt(pressure, 0)} Pa</text>`);
  }

  function heatDiagram(mHot, tHot, t) {
    const mCold = 200;
    const tCold = 20;
    const pxPerG = 0.25;
    const beaker = (x, width, height, mass, temp, label, color) => {
      const base = 360;
      const level = base - mass * pxPerG;
      const column = 18 + (temp / 100) * 120;
      return `
        <path class="dg-liquid" style="fill:${color}" d="M${x + 4} ${n2(level)}H${x + width - 4}V${base - 4}H${x + 4}Z"/>
        <path class="dg-glass" d="M${x} ${base - height}V${base}H${x + width}V${base - height}"/>
        <rect class="dg-thermo" x="${x + width - 26}" y="${base - 170}" width="10" height="160" rx="5"/>
        <rect class="dg-thermo-red" x="${x + width - 23.5}" y="${n2(base - 12 - column)}" width="5" height="${n2(column)}" rx="2.5"/>
        <circle class="dg-thermo-bulb" cx="${x + width - 21}" cy="${base - 12}" r="7"/>
        <text class="dg-label" x="${x + width / 2 - 8}" y="${base + 22}" text-anchor="middle">${label}</text>
        <text class="dg-value-text" x="${x + width - 36}" y="${base - 172}" text-anchor="end">${fmt(temp, 1)} ℃</text>`;
    };
    return diagram("dg-heat", "热水与冷水混合：不计热量损失时热水放出的热量等于冷水吸收的热量", `
      ${caption("不计热量损失：Q放 = Q吸")}
      ${beaker(52, 150, 150, mHot, tHot, `热水 m₁ = ${fmt(mHot)} g`, "rgba(242, 128, 96, .42)")}
      <text class="dg-big" x="226" y="290">+</text>
      ${beaker(262, 150, 150, mCold, tCold, `冷水 m₂ = ${mCold} g`, "rgba(96, 160, 236, .42)")}
      <line class="dg-velocity" x1="430" y1="280" x2="496" y2="280" marker-end="url(#dgArrowGreen)"/>
      <text class="dg-small dg-green" x="463" y="268" text-anchor="middle">混合</text>
      ${beaker(510, 200, 200, mHot + mCold, t, `混合后 ${fmt(mHot + mCold)} g`, "rgba(170, 146, 220, .4)")}`);
  }

  function pulleyDiagram(load, force, eta, invalid) {
    const m = 400;
    const R = 30;
    const fixedY = 96;
    const startY = 262;
    const liftPx = 36;
    const ym = startY - liftPx;
    const seg = y => ({ left: m - R, mid: m, right: m + R, top: fixedY, bottom: y });
    const rope = seg(ym);
    const endStart = 206;
    const endNow = endStart - 3 * liftPx;
    const boxTop = ym + R + 30;
    const ghostTop = startY + R + 30;
    const label = (x, y, text) => `<g class="dg-seg-no"><circle cx="${x}" cy="${y}" r="9"/><text x="${x}" y="${y + 4}" text-anchor="middle">${text}</text></g>`;
    return diagram("dg-pulley", "滑轮组：一个定滑轮和一个动滑轮，承担物重的绳子段数 n = 3，绳子自由端向上拉", `
      ${caption(invalid ? "η > 100%：读数异常，请复核拉力或承担物重的绳子段数" : "承担物重的绳子段数 n = 3：s = 3h，η = W有 / W总", 380, 394)}
      <rect class="dg-ceiling" x="300" y="34" width="118" height="12" fill="url(#dgHatch)"/>
      <line class="dg-line" x1="300" y1="46" x2="418" y2="46"/>
      <line class="dg-line" x1="${m - R / 2}" y1="46" x2="${m - R / 2}" y2="${fixedY - R / 2 - 2}"/>
      <circle class="dg-pulley-wheel" cx="${m - R / 2}" cy="${fixedY}" r="${R / 2}"/><circle class="dg-axle" cx="${m - R / 2}" cy="${fixedY}" r="3"/>
      <text class="dg-small" x="${m - R / 2 - 22}" y="${fixedY + 4}" text-anchor="end">定滑轮</text>
      <path class="dg-rope" d="M${rope.left} ${rope.bottom}V${fixedY}A${R / 2} ${R / 2} 0 0 1 ${rope.mid} ${fixedY}V${ym - R - 12}"/>
      <path class="dg-rope" d="M${rope.left} ${ym}A${R} ${R} 0 0 0 ${rope.right} ${ym}V${endNow - 20}"/>
      <circle class="dg-pulley-wheel" cx="${m}" cy="${ym}" r="${R}"/><circle class="dg-axle" cx="${m}" cy="${ym}" r="3.5"/>
      <path class="dg-frame" d="M${m} ${ym}V${ym - R - 12}M${m} ${ym}V${ym + R + 14}"/>
      <circle class="dg-hook" cx="${m}" cy="${ym - R - 12}" r="3"/>
      <text class="dg-small" x="${m - R - 14}" y="${ym + 4}" text-anchor="end">动滑轮</text>
      ${label(rope.left - 14, (fixedY + ym) / 2, "1")}${label(rope.mid + 14, (fixedY + ym - R) / 2 + 6, "2")}${label(rope.right + 14, (fixedY + ym) / 2 + 10, "3")}
      <rect class="dg-ghost" x="${m - 48}" y="${ghostTop}" width="96" height="46" rx="4"/>
      <line class="dg-string" x1="${m}" y1="${ym + R + 14}" x2="${m}" y2="${boxTop}"/>
      <rect class="dg-load" x="${m - 48}" y="${boxTop}" width="96" height="46" rx="4"/>
      <text class="dg-label dg-on-dark" x="${m}" y="${boxTop + 29}" text-anchor="middle">G = ${fmt(load)} N</text>
      ${dimension(m - 62, ghostTop + 46, m - 62, boxTop + 46, "", 0, 0)}
      <text class="dg-dim-text" x="${m - 70}" y="${boxTop + 46 + liftPx / 2 + 4}" text-anchor="end">h</text>
      <circle class="dg-rope-mark dg-ghost-mark" cx="${rope.right}" cy="${endStart}" r="5"/>
      <circle class="dg-rope-mark" cx="${rope.right}" cy="${endNow}" r="5"/>
      ${dimension(rope.right + 40, endStart, rope.right + 40, endNow, "", 0, 0)}
      <text class="dg-dim-text" x="${rope.right + 48}" y="${(endStart + endNow) / 2 + 4}">s = 3h</text>
      <line class="dg-force dg-blue-force" x1="${rope.right}" y1="${endNow - 22}" x2="${rope.right}" y2="${endNow - 74}" marker-end="url(#dgArrowBlue)"/>
      <text class="dg-force-text dg-blue" x="${rope.right + 10}" y="${endNow - 58}">F = ${fmt(force)} N</text>
      <g class="dg-table" transform="translate(574 110)">
        <rect width="178" height="150" rx="10"/>
        <text x="12" y="28">W有 = Gh</text>
        <text x="12" y="54">W总 = Fs = F·3h</text>
        <text x="12" y="80">η = W有 / W总</text>
        <text x="12" y="110">&#8195;= G / (3F)</text>
        <text class="dg-value-text" x="12" y="140">= ${invalid ? "读数异常" : `${fmt(eta, 1)}%`}</text>
      </g>`);
  }

  function soundDiagram(freq, amp, wavelength) {
    const stripLeft = 116;
    const stripRight = 744;
    const metres = 2;
    const pxPerM = (stripRight - stripLeft) / metres;
    const lambdaPx = wavelength * pxPerM;
    const disp = 3 + 7 * (amp / 100);
    const dots = [];
    for (let row = 0; row < 6; row += 1) {
      for (let col = 0; col < 78; col += 1) {
        const x0 = stripLeft + col * 8 + ((row * 37) % 8) * 0.5;
        const x = x0 - disp * Math.sin((2 * Math.PI * (x0 - stripLeft)) / lambdaPx);
        if (x < stripLeft - 2 || x > stripRight) continue;
        dots.push(`<circle class="dg-air" cx="${n2(x)}" cy="${48 + row * 14 + (col % 2) * 3}" r="2"/>`);
      }
    }
    const compressions = [];
    for (let x = stripLeft; x <= stripRight && compressions.length < 6; x += lambdaPx) compressions.push(x);
    const marks = compressions.slice(0, 1).map(x => `<text class="dg-small" x="${n2(x)}" y="148" text-anchor="middle">密部</text>`).join("")
      + (lambdaPx / 2 + stripLeft < stripRight ? `<text class="dg-small" x="${n2(stripLeft + lambdaPx / 2)}" y="148" text-anchor="middle">疏部</text>` : "");
    const lambdaDim = lambdaPx + stripLeft < stripRight - 10
      ? dimension(compressions[0], 36, compressions[0] + lambdaPx, 36, `λ ≈ ${fmt(wavelength, 2)} m`, compressions[0] + lambdaPx / 2, 30)
      : `<text class="dg-dim-text" x="${stripRight}" y="30" text-anchor="end">λ ≈ ${fmt(wavelength, 2)} m（大于图示范围）</text>`;
    const scopeX = 150;
    const scopeY = 176;
    const scopeW = 540;
    const scopeH = 200;
    const cycles = freq / 100;
    const ampPx = (amp / 100) * 75;
    const wave = Array.from({ length: 361 }, (_, index) => {
      const x = scopeX + (index / 360) * scopeW;
      const y = scopeY + scopeH / 2 - Math.sin((index / 360) * cycles * 2 * Math.PI) * ampPx;
      return `${index ? "L" : "M"}${n2(x)} ${n2(y)}`;
    }).join("");
    const grid = [];
    for (let i = 1; i < 10; i += 1) grid.push(`M${scopeX + i * scopeW / 10} ${scopeY}V${scopeY + scopeH}`);
    for (let j = 1; j < 8; j += 1) grid.push(`M${scopeX} ${scopeY + j * scopeH / 8}H${scopeX + scopeW}`);
    return diagram("dg-sound", "声音在空气中以声波形式传播（疏密相间），示波器显示声音的波形", `
      <path class="dg-speaker" d="M34 70H56L84 48V124L56 102H34Z"/>
      <path class="dg-speaker-wave" d="M94 70Q102 86 94 102M102 62Q114 86 102 110"/>
      <text class="dg-small" x="60" y="146" text-anchor="middle">声源</text>
      ${dots.join("")}
      ${marks}
      ${lambdaDim}
      <rect class="dg-scope" x="${scopeX}" y="${scopeY}" width="${scopeW}" height="${scopeH}" rx="6"/>
      <path class="dg-scope-grid" d="${grid.join("")}"/>
      <path class="dg-scope-axis" d="M${scopeX} ${scopeY + scopeH / 2}H${scopeX + scopeW}"/>
      <path class="dg-scope-wave" d="${wave}"/>
      <text class="dg-small" x="${scopeX - 10}" y="${scopeY + 12}" text-anchor="end">示波器</text>
      <text class="dg-small" x="${scopeX - 10}" y="${scopeY + 38}" text-anchor="end">1 ms/格</text>
      <text class="dg-small" x="${scopeX + scopeW}" y="${scopeY + scopeH + 18}" text-anchor="end">横轴：时间 t　纵轴：振动幅度　周期 T = 1/f ≈ ${fmt(1000 / freq, 2)} ms</text>`);
  }


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
      keywords: /杠杆|力臂|钩码|支点|平衡条件/,
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
          facts: [fact("F₁l₁", `${fmt(leftMoment)} N·cm`), fact("F₂l₂", `${fmt(rightMoment)} N·cm`), fact("状态", balanced ? "平衡" : diff > 0 ? "左端下沉" : "右端下沉")],
          conclusion: balanced
            ? "F₁l₁ = F₂l₂，杠杆平衡（动力×动力臂 = 阻力×阻力臂）。"
            : diff > 0 ? "F₁l₁ > F₂l₂，杠杆左端下沉。" : "F₁l₁ < F₂l₂，杠杆右端下沉。",
          formula: "F₁l₁ = F₂l₂",
          formulaDetail: `F₁l₁ = ${fmt(p1)} N × ${fmt(p2)} cm = ${fmt(leftMoment)} N·cm；F₂l₂ = 6 N × 20 cm = ${fmt(rightMoment)} N·cm`,
          readout: balanced ? "F₁l₁ = F₂l₂ · 平衡" : diff > 0 ? "F₁l₁ > F₂l₂ · 左端下沉" : "F₁l₁ < F₂l₂ · 右端下沉",
          badge: "杠杆平衡"
        };
      },
      visual: model => genericShell(model, leverDiagram(model.metrics[0], model.metrics[1], model.facts[2].value)),
      recognition: model => `杠杆平衡｜${model.formulaDetail}｜${model.facts[2].value}`,
      content: null
    },

    lens: {
      id: "lens",
      menuTitle: "凸透镜成像规律判断",
      menuMeta: "物距与 f、2f 比较 · 像的性质",
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
        const rule = lensRule(u, f);
        const v = rule.key === "focus" ? null : (u * f) / (u - f);
        const vText = v === null ? "不成像" : rule.key === "virtual" ? `虚像距透镜约 ${fmt(Math.abs(v), 1)}cm` : `${fmt(v, 1)}cm`;
        const computed = v === null ? "" : `（拓展：由透镜成像公式 1/u + 1/v = 1/f 计算，${rule.key === "virtual" ? `虚像距透镜约 ${fmt(Math.abs(v), 1)}cm` : `v ≈ ${fmt(v, 1)}cm`}）`;
        const formulaDetail = rule.key === "focus"
          ? `u = f = ${fmt(f)}cm：物体在焦点上，折射光平行射出，不能成像。`
          : `u = ${fmt(u)}cm，f = ${fmt(f)}cm，2f = ${fmt(2 * f)}cm：${rule.range}，成${rule.nature}，${rule.image}${computed}`;
        return {
          visual: "visual-lens",
          metrics: [u, f, v === null ? 0 : Math.abs(v)],
          metricUnit: "cm",
          imageDistance: v,
          facts: [fact("像距", vText), fact("像的性质", rule.nature), fact("应用", rule.use)],
          conclusion: rule.key === "focus"
            ? `物距等于焦距（${fmt(u)}cm）时不成像。`
            : `物距 ${fmt(u)}cm、焦距 ${fmt(f)}cm（${rule.range}）时，成${rule.nature}，${rule.image}；应用：${rule.use}。`,
          formula: `${rule.range}：${rule.nature}`,
          formulaDetail,
          readout: rule.nature,
          badge: "凸透镜成像规律"
        };
      },
      visual: model => genericShell(model, lensDiagram(model.metrics[0], model.metrics[1], model.imageDistance)),
      recognition: model => `凸透镜成像｜${model.facts[1].value}｜像距：${model.facts[0].value}｜应用：${model.facts[2].value}`
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
          facts: [fact("浮力 F浮", `${fmt(force, 2)} N`), fact("测力计示数 F示", `${fmt(apparent, 2)} N`), fact("验证", "F浮 = G排")],
          conclusion: `物重 G = ${fmt(objectWeight)}N，浸入后测力计示数 F示 = ${fmt(apparent, 2)}N，F浮 = G − F示 = ${fmt(force, 2)}N；排开液体重 G排 = ${fmt(force, 2)}N，F浮 = G排。`,
          formula: "F浮 = G排 = ρ液gV排",
          formulaDetail: `F浮 = ρ液gV排 = ${fmt(density)} kg/m³ × 9.8 N/kg × ${fmt(volumeMl)}×10⁻⁶ m³ = ${fmt(force, 2)} N`,
          readout: `F浮 = ${fmt(force, 2)}N`,
          badge: "阿基米德原理"
        };
      },
      visual: model => genericShell(model, buoyancyDiagram(model.metrics[0], model.metrics[1], model.metrics[2], model.objectWeight, model.objectWeight - model.metrics[2])),
      recognition: model => `浮力实验｜${model.formulaDetail}｜${model.facts[0].value}`
    },

    friction: {
      id: "friction",
      menuTitle: "滑动摩擦力影响因素",
      menuMeta: "f = μF压 · 压力与粗糙程度",
      stage: "高中必修1",
      block: "力学",
      title: "滑动摩擦：压力和接触面如何影响摩擦力",
      defaults: [10, 0.3],
      keywords: /摩擦|粗糙|木板|接触面|匀速拉动/,
      params: [
        { label: "压力 F压", desc: "调整木块对木板的压力", unit: "N", min: 2, max: 30, step: 1, value: 10 },
        { label: "动摩擦因数 μ", desc: "与接触面的材料和粗糙程度有关", unit: "", min: 0.1, max: 0.8, step: 0.05, value: 0.3 }
      ],
      parse: {
        p1: [/(?:压力|正压力|N)\D{0,8}(\d+(?:\.\d+)?)\s*N/i],
        p2: [/(?:摩擦因数|粗糙程度|μ)\D{0,8}(\d+(?:\.\d+)?)/i]
      },
      failMessage: "当前摩擦力模板需要识别压力和动摩擦因数，例如：压力10N，动摩擦因数0.3。",
      question: (p1, p2) => `用弹簧测力计水平匀速拉动木块，木块对木板的压力为 ${fmt(p1)}N，动摩擦因数为 ${fmt(p2, 2)}。求滑动摩擦力。`,
      model: (normal, mu) => {
        const friction = normal * mu;
        return {
          visual: "visual-friction",
          metrics: [normal, mu, friction],
          metricUnit: "N",
          facts: [fact("滑动摩擦力 f", `${fmt(friction, 2)} N`), fact("运动条件", "匀速直线运动"), fact("控制变量", "压力 / 接触面粗糙程度")],
          conclusion: `匀速直线拉动时，拉力与滑动摩擦力是一对平衡力，弹簧测力计示数等于滑动摩擦力 ${fmt(friction, 2)}N。`,
          formula: "f = μF压",
          formulaDetail: `f = μF压 = ${fmt(mu, 2)} × ${fmt(normal)} N = ${fmt(friction, 2)} N`,
          readout: `f = ${fmt(friction, 2)}N`,
          badge: "控制变量法"
        };
      },
      visual: model => genericShell(model, frictionDiagram(model.metrics[0], model.metrics[1], model.metrics[2])),
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
        const rheostatSliderX = 310;
        return genericShell(model, `
          <div class="circuit-standard-badge generic-circuit-badge">电压表测灯泡电压，电流表测灯泡电流 · 绿点表示电流方向</div>
          <svg class="edu-circuit-svg generic-edu-circuit lamp-power-schematic" viewBox="0 0 760 400" role="img" aria-label="测量小灯泡电功率电路：电源、开关、电流表、滑动变阻器和小灯泡串联，电压表并联在小灯泡两端" style="--lamp-level:${lampLevel}">
            <g class="edu-wire">
              <path d="M110 145V78H220"></path>
              <path d="M287 78H396"></path>
              <path d="M464 78H650V260H582"></path>
              <path d="M518 260H390V206H${rheostatSliderX}"></path>
              <path d="M230 260H110V175"></path>
            </g>

            <g class="edu-source" aria-label="电源">
              <line class="source-long" x1="78" y1="145" x2="142" y2="145"></line>
              <line class="source-short" x1="91" y1="175" x2="129" y2="175"></line>
              <text class="polarity positive" x="154" y="151">+</text>
              <text class="polarity negative" x="142" y="181">−</text>
              <text class="circuit-reading-text" x="28" y="211">电源</text>
            </g>

            <g class="edu-switch edu-switch-closed" aria-label="闭合开关">
              <circle cx="220" cy="78" r="5"></circle>
              <circle cx="275" cy="68" r="5"></circle>
              <line class="switch-blade" x1="225" y1="78" x2="270" y2="69"></line>
              <line class="switch-terminal-lead" x1="280" y1="68" x2="287" y2="78"></line>
              <text class="component-label switch-label" x="248" y="44" text-anchor="middle">开关 S · 闭合</text>
            </g>

            <g class="edu-meter" aria-label="电流表串联">
              <circle cx="430" cy="78" r="34"></circle>
              <text class="meter-letter" x="430" y="87" text-anchor="middle">A</text>
              <g class="svg-reading-badge" transform="translate(472 106)">
                <rect width="90" height="32" rx="10"></rect>
                <text x="45" y="21" text-anchor="middle">${fmt(current, 2)}&#8239;A</text>
              </g>
            </g>

            <g class="edu-variable-resistor" aria-label="滑动变阻器一上一下接入：左端接线柱与滑片 P 之间的电阻丝接入电路">
              <rect class="resistor-body" x="230" y="242" width="120" height="36"></rect>
              <line class="rheostat-active-track" x1="230" y1="271" x2="${rheostatSliderX}" y2="271"></line>
              <circle class="rheostat-terminal connected" cx="230" cy="260" r="4.5"></circle>
              <circle class="rheostat-terminal" cx="350" cy="260" r="4.5"></circle>
              <line class="slider-arrow" x1="${rheostatSliderX}" y1="206" x2="${rheostatSliderX}" y2="242"></line>
              <path class="slider-arrow-head" d="M${rheostatSliderX - 6} 232L${rheostatSliderX} 242L${rheostatSliderX + 6} 232"></path>
              <text class="component-symbol" x="${rheostatSliderX + 12}" y="222">P</text>
              <text class="component-symbol" x="290" y="265" text-anchor="middle">Rₚ</text>
              <text class="rheostat-connection-label" x="290" y="307" text-anchor="middle">接入电阻丝：左端 → 滑片 P</text>
            </g>

            <g class="edu-lamp" aria-label="小灯泡，符号为圆圈内交叉线">
              <circle class="lamp-halo" cx="550" cy="260" r="44"></circle>
              <circle class="lamp-circle" cx="550" cy="260" r="32"></circle>
              <line class="lamp-filament" x1="530" y1="240" x2="570" y2="280"></line>
              <line class="lamp-filament" x1="570" y1="240" x2="530" y2="280"></line>
              <text class="component-label" x="550" y="307" text-anchor="middle">小灯泡</text>
            </g>

            <g class="edu-voltmeter-branch" aria-label="电压表并联在小灯泡两端">
              <path class="edu-wire" d="M490 260V354H520M580 354H610V260"></path>
              <circle class="junction" cx="490" cy="260" r="5"></circle>
              <circle class="junction" cx="610" cy="260" r="5"></circle>
              <g class="edu-meter">
                <circle cx="550" cy="354" r="30"></circle>
                <text class="meter-letter" x="550" y="363" text-anchor="middle">V</text>
              </g>
              <g class="svg-reading-badge" transform="translate(620 320)">
                <rect width="92" height="32" rx="10"></rect>
                <text x="46" y="21" text-anchor="middle">${fmt(voltage, 1)}&#8239;V</text>
              </g>
            </g>
            ${ScienceMotion.circuitMarkup(`M110 145V78H220L275 68L287 78H650V260H390V206H${rheostatSliderX}V260H110V145Z`)}
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
        { label: "滑变接入阻值 R₂", desc: "移动滑片，改变接入电阻丝长度", unit: "Ω", min: 2, max: 20, step: 1, value: 8 }
      ],
      parse: {
        p1: [/(?:电源电压|电压|U)\D{0,8}(\d+(?:\.\d+)?)\s*V/i],
        p2: [/(?:滑动变阻器|滑变|R2|R₂|电阻)\D{0,8}(\d+(?:\.\d+)?)\s*(?:欧|Ω)/i]
      },
      failMessage: "当前串联动态模板需要识别电源电压和滑动变阻器阻值，例如：电源6V，滑变8Ω。",
      question: (p1, p2) => `R₁=4Ω 与滑动变阻器 R₂ 串联，电源电压为 ${fmt(p1)}V，R₂ 接入电路的阻值为 ${fmt(p2)}Ω。求电路电流和 R₂ 两端电压。`,
      model: (u, r2) => {
        const r1 = 4;
        const current = u / (r1 + r2);
        const v1 = current * r1;
        const v2 = current * r2;
        return {
          visual: "visual-series",
          metrics: [u, r2, current],
          metricUnit: "A",
          facts: [
            fact("电流", `${fmt(current, 2)} A`),
            fact("总电阻", `${fmt(r1 + r2)} Ω`),
            fact("电压分配", `U₁ ${fmt(v1, 2)} V · U₂ ${fmt(v2, 2)} V`)
          ],
          conclusion: `串联总电阻 ${fmt(r1 + r2)}Ω，电流 ${fmt(current, 2)}A；R₁ 两端 ${fmt(v1, 2)}V，R₂ 两端 ${fmt(v2, 2)}V。`,
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
        const sliderX = 432 + slider * 116;
        const v2 = current * r2;
        return genericShell(model, `
          <div class="circuit-standard-badge generic-circuit-badge">教材电路图 · R₁、R₂ 串联 · 电压表测 R₂</div>
          <svg class="edu-circuit-svg generic-edu-circuit series-circuit-schematic" viewBox="0 0 760 400" role="img" aria-label="串联动态电路：电源、开关、电流表、定值电阻和滑动变阻器串联，电压表并联在滑动变阻器两端">
            <g class="edu-wire">
              <path d="M105 145V76H210"></path>
              <path d="M277 76H431"></path>
              <path d="M499 76H650V220H${sliderX}"></path>
              <path d="M420 270H320"></path>
              <path d="M200 270H105V175"></path>
            </g>

            <g class="edu-source" aria-label="电源">
              <line class="source-long" x1="73" y1="145" x2="137" y2="145"></line>
              <line class="source-short" x1="86" y1="175" x2="124" y2="175"></line>
              <text class="polarity positive" x="149" y="151">+</text>
              <text class="polarity negative" x="137" y="181">−</text>
              <text class="circuit-reading-text" x="28" y="211">U = ${fmt(voltage)}V</text>
            </g>

            <g class="edu-switch edu-switch-closed" aria-label="闭合开关">
              <circle cx="210" cy="76" r="5"></circle>
              <circle cx="265" cy="66" r="5"></circle>
              <line class="switch-blade" x1="215" y1="76" x2="260" y2="67"></line>
              <line class="switch-terminal-lead" x1="270" y1="66" x2="277" y2="76"></line>
              <text class="component-label switch-label" x="238" y="42" text-anchor="middle">开关 S · 闭合</text>
            </g>

            <g class="edu-meter" aria-label="电流表串联">
              <circle cx="465" cy="76" r="34"></circle>
              <text class="meter-letter" x="465" y="85" text-anchor="middle">A</text>
              <g class="svg-reading-badge" transform="translate(505 104)">
                <rect width="92" height="32" rx="10"></rect>
                <text x="46" y="21" text-anchor="middle">${fmt(current, 2)}A</text>
              </g>
            </g>

            <g class="edu-resistor" aria-label="定值电阻 R1">
              <rect class="resistor-body" x="200" y="252" width="120" height="36"></rect>
              <text class="component-body-value" x="260" y="276" text-anchor="middle">R₁ = 4Ω</text>
            </g>

            <g class="edu-variable-resistor" aria-label="滑动变阻器 R2 一上一下接入：左端接线柱与滑片 P 之间的电阻丝接入电路，当前接入阻值 ${fmt(r2)} 欧姆">
              <rect class="resistor-body" x="420" y="252" width="140" height="36"></rect>
              <line class="rheostat-active-track" x1="420" y1="282" x2="${sliderX}" y2="282"></line>
              <circle class="rheostat-terminal connected" cx="420" cy="270" r="4.5"></circle>
              <circle class="rheostat-terminal" cx="560" cy="270" r="4.5"></circle>
              <line class="slider-arrow" x1="${sliderX}" y1="220" x2="${sliderX}" y2="252"></line>
              <path class="slider-arrow-head" d="M${sliderX - 6} 242L${sliderX} 252L${sliderX + 6} 242"></path>
              <text class="component-symbol" x="${sliderX + 10}" y="238">P</text>
              <text class="component-body-value" x="490" y="275" text-anchor="middle">R₂</text>
              <text class="rheostat-connection-label" x="505" y="197" text-anchor="middle">接入电阻丝：左端 → 滑片 P</text>
              <text class="rheostat-state-label" x="490" y="310" text-anchor="middle">当前接入：${fmt(r2)}Ω</text>
            </g>

            <g class="edu-voltmeter-branch" aria-label="电压表并联在 R2 两端">
              <path class="edu-wire" d="M390 270V360H456M524 360H620V220"></path>
              <circle class="junction" cx="390" cy="270" r="5"></circle>
              <circle class="junction" cx="620" cy="220" r="5"></circle>
              <g class="edu-meter">
                <circle cx="490" cy="360" r="34"></circle>
                <text class="meter-letter" x="490" y="369" text-anchor="middle">V</text>
              </g>
              <g class="svg-reading-badge" transform="translate(625 365)">
                <rect width="112" height="32" rx="10"></rect>
                <text x="56" y="21" text-anchor="middle">U₂ = ${fmt(v2, 2)}V</text>
              </g>
            </g>
            ${ScienceMotion.circuitMarkup(`M105 145V76H210L265 66L277 76H650V220H${sliderX}V270H105V145Z`)}
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
          facts: [fact("混合后温度 t", `${fmt(t, 1)}℃`), fact("热水放热 Q放", `${sci(q)} J`), fact("条件", "不计热量损失")],
          conclusion: `不计热量损失时，热水放出的热量等于冷水吸收的热量，混合后温度约 ${fmt(t, 1)}℃。`,
          formula: "Q放 = Q吸，Q = cmΔt",
          formulaDetail: `c水m₁(t₁ − t) = c水m₂(t − t₂)，得 t = ${fmt(t, 1)}℃；Q放 = 4.2×10³ J/(kg·℃) × ${fmt(mHot / 1000, 3)} kg × ${fmt(tHot - t, 1)}℃ = ${sci(q)} J`,
          readout: `t = ${fmt(t, 1)}℃`,
          badge: "热量守恒"
        };
      },
      visual: model => genericShell(model, heatDiagram(model.metrics[0], model.metrics[1], model.metrics[2])),
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
          facts: [fact("液体压强 p", `${fmt(p, 0)} Pa`), fact("影响因素", "液体密度 ρ 与深度 h"), fact("规律", "同深度各方向相等")],
          conclusion: `液体内部压强随深度和液体密度增大而增大，此处约 ${fmt(p, 0)}Pa。`,
          formula: "p = ρgh",
          formulaDetail: `p = ρgh = ${fmt(rho)} kg/m³ × 9.8 N/kg × ${fmt(hCm / 100, 2)} m = ${fmt(p, 0)} Pa`,
          readout: `p = ${fmt(p, 0)}Pa`,
          badge: "液体压强"
        };
      },
      visual: model => genericShell(model, pressureDiagram(model.metrics[0], model.metrics[1], model.metrics[2])),
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
          : `s = 3h，η = W有/W总 = Gh/(Fs) = G/(3F)，该滑轮组机械效率约 ${fmt(rawEta * 100, 1)}%。`;
        return {
          visual: "visual-efficiency",
          metrics: [load, force, rawEta * 100],
          metricUnit: "%",
          facts: [fact("机械效率 η", etaText), fact("承担物重的绳子段数", "n = 3"), fact("额外功 W额", rawEta <= 1 ? "W额 > 0" : "读数需复核")],
          conclusion,
          formula: "η = W有 / W总 = Gh / Fs",
          formulaDetail: `η = G/(3F) = ${fmt(load)} N ÷ (3 × ${fmt(force)} N) × 100% = ${fmt(rawEta * 100, 1)}%`,
          readout: rawEta > 1 ? "读数需复核" : `η = ${fmt(rawEta * 100, 1)}%`,
          badge: "机械效率"
        };
      },
      visual: model => genericShell(model, pulleyDiagram(model.metrics[0], model.metrics[1], model.metrics[2], model.metrics[2] > 100)),
      recognition: model => `机械效率｜${model.formulaDetail}｜${model.facts[0].value}`
    },

    sound: {
      id: "sound",
      menuTitle: "声音的传播与音调响度",
      menuMeta: "频率定音调 · 振幅定响度",
      stage: "初中核心",
      block: "声学",
      title: "声音的特性：音调与响度",
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
          facts: [fact("波长 λ（拓展）", `${fmt(wavelength, 2)} m`), fact("音调", freq > 600 ? "较高" : freq < 260 ? "较低" : "中等"), fact("响度", amp > 70 ? "较大" : amp < 30 ? "较小" : "中等")],
          conclusion: `音调与频率有关，频率越高音调越高；响度与振幅有关，振幅越大响度越大。按空气中声速约 340m/s 估算，波长约 ${fmt(wavelength, 2)}m。`,
          formula: "音调 ← 频率 f；响度 ← 振幅 A；v = λf",
          formulaDetail: `λ = v / f = 340 m/s ÷ ${fmt(freq)} Hz ≈ ${fmt(wavelength, 2)} m`,
          readout: `λ = ${fmt(wavelength, 2)}m`,
          badge: "声音三要素"
        };
      },
      visual: model => genericShell(model, soundDiagram(model.metrics[0], model.metrics[1], model.metrics[2])),
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
