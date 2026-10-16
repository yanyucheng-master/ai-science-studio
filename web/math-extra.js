/* 数学通用模板（2026-10-16）
   通过 physics-extra.js 的 MasterLabTemplateKit 登记，与物理通用模板共用严格解析：
   题中每个数都要用到、所问内容要能回答；形式不符、缺条件、超出演示范围时一律交给 AI，绝不套用默认值。
   - 二次函数图像与性质（初中 / 高中）：只接一般式 y = ax² + bx + c；a 来自题目，滑块调 b、c
   - 二元一次方程组 = 两直线交点（初中）：两个方程、x 与 y 的系数来自题目，滑块调两个常数项；识别无解（平行）与无数组解（重合）
   含“切线、斜率、导数”的题由 app.js 先交给切线模板。 */
(() => {
  const kit = window.MasterLabTemplateKit;
  if (!kit) return;
  const { register, helpers } = kit;
  const { exactPlaces, fact, miss, stages } = helpers;

  // ---------- 数的写法：负号用“−”；有限小数原样写，除不尽的写分数，无理数写根式并给近似值 ----------
  const minus = text => String(text).replace(/-/g, "−");
  const plain = value => {
    const places = exactPlaces(value);
    const number = places === null ? Number(Number(value).toFixed(3)) : Number(Number(value).toFixed(places));
    return minus(String(Object.is(number, -0) ? 0 : number));
  };
  const approx = value => minus(String(Number(Number(value).toFixed(3)) || 0));
  const gcd = (a, b) => {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y) [x, y] = [y, x % y];
    return x || 1;
  };
  const rational = (n, d) => {
    const sign = d < 0 ? -1 : 1;
    const g = gcd(n, d);
    return { n: (sign * n) / g, d: Math.abs(d) / g };
  };
  const ratValue = r => r.n / r.d;
  // 系数都是整数时按教材写分数（−1/2、5/4）；系数带小数时，能写成有限小数的写小数
  const ratText = (r, preferFraction = false) => {
    if (r.d === 1 || (!preferFraction && exactPlaces(r.n / r.d) !== null)) return plain(r.n / r.d);
    return `${r.n < 0 ? "−" : ""}${Math.abs(r.n)}/${r.d}`;
  };
  const cmpText = value => (value > 0 ? ">" : value < 0 ? "<" : "=");
  // 根式化简：D = m²·n（n 不含平方因子）
  const splitRoot = D => {
    let m = 1;
    let n = D;
    for (let f = 2; f * f <= n; f += 1) {
      while (n % (f * f) === 0) {
        n /= f * f;
        m *= f;
      }
    }
    return { m, n };
  };
  // 系数按两位小数以内放大成整数，顶点、判别式、根都用整数精确计算
  const scaleOf = values => 10 ** Math.max(0, ...values.map(value => exactPlaces(value) ?? 4));

  const term = (value, body, first) => {
    if (!value) return "";
    const sign = value < 0 ? (first ? "−" : " − ") : first ? "" : " + ";
    const abs = Math.abs(value);
    return `${sign}${abs === 1 && body ? "" : plain(abs)}${body}`;
  };
  const polyText = (a, b, c) => [term(a, "x²", true), term(b, "x", !a), term(c, "", !a && !b)].join("").trim() || "0";

  // ---------- 从题目里找出 y = ax² + bx + c（或 f(x) = …）----------
  const EXPRESSION_RE = /(^|[^A-Za-z])(y|f\s*\(\s*x\s*\))\s*=\s*([0-9x.+\-^*\s]+?)(?=\s*(?:[^0-9x.+\-^*\s]|$))/i;
  function findQuadratic(source) {
    const match = source.match(EXPRESSION_RE);
    if (!match) return miss("当前二次函数模板需要一般式 y = ax² + bx + c，例如：y = x² − 4x + 3。");
    const start = match.index + match[1].length;
    const end = match.index + match[0].length;
    const raw = match[3].replace(/\s+/g, "").replace(/\*/g, "");
    if (!raw || !/x\^2/.test(raw)) return miss("当前二次函数模板需要含 x² 的一般式 y = ax² + bx + c。");
    const terms = (raw.startsWith("-") || raw.startsWith("+") ? raw : `+${raw}`).match(/[+-][^+-]+/g);
    if (!terms) return miss("没有识别出二次函数的解析式。");
    const coefficients = {};
    for (const item of terms) {
      const found = item.match(/^([+-])(\d+(?:\.\d+)?)?(x\^2|x)?$/);
      if (!found || (!found[2] && !found[3])) return miss("当前二次函数模板只接一般式 y = ax² + bx + c（不含括号、分数和其他字母）。");
      const degree = found[3] === "x^2" ? "a" : found[3] === "x" ? "b" : "c";
      if (degree in coefficients) return miss("解析式里有同类项，请先合并成一般式。");
      const magnitude = found[2] === undefined ? 1 : Number(found[2]);
      coefficients[degree] = found[1] === "-" ? -magnitude : magnitude;
    }
    const { a = 0, b = 0, c = 0 } = coefficients;
    if (!a) return miss("二次项系数不能为 0。");
    if (Object.values(coefficients).some(value => value === 0)) return miss("解析式里有系数为 0 的项，请先化简。");
    return { ok: true, start, end, a, b, c, notation: /^f/i.test(match[2]) ? "f" : "y" };
  }

  // 学段线索：f(x)、单调、零点、值域属于高中说法；“y 随 x 的增大而……”、增减性属于初中说法
  const SENIOR_CUE = /f\s*\(\s*x\s*\)|单调|递增|递减|零点|值域|高中|必修/;
  const JUNIOR_CUE = /随\s*x\s*(?:的)?\s*增大|增减性|九年级|初三|初中/;

  function quadraticModel(b, c, fixed = {}) {
    const a = Number(fixed.a) || 1;
    const level = fixed.level === "junior" ? "junior" : "senior";
    const S = scaleOf([a, b, c]);
    const A = Math.round(a * S);
    const B = Math.round(b * S);
    const C = Math.round(c * S);
    const hRat = rational(-B, 2 * A);
    const kRat = rational(4 * A * C - B * B, 4 * A * S);
    const D = B * B - 4 * A * C;
    const deltaRat = rational(D, S * S);
    const h = ratValue(hRat);
    const k = ratValue(kRat);
    const delta = ratValue(deltaRat);
    const fractions = [a, b, c].every(Number.isInteger);
    const hText = ratText(hRat, fractions);
    const kText = ratText(kRat, fractions);
    const deltaText = ratText(deltaRat, fractions);
    const fn = fixed.notation === "f" ? "f(x)" : "y";
    const expr = polyText(a, b, c);
    const opening = a > 0 ? "向上" : "向下";
    const extreme = a > 0 ? "最小值" : "最大值";
    // 根：Δ > 0 两个、Δ = 0 一个（顶点）、Δ < 0 没有；无理根写成 p ± q√n 或 (p ± q√n)/r
    let roots = [];
    let rootsText = "";
    if (D === 0) {
      roots = [{ value: h, text: hText, graph: `(${hText}, 0)` }];
      rootsText = hText;
    } else if (D > 0) {
      const s = Math.round(Math.sqrt(D));
      if (s * s === D) {
        roots = [rational(-B - s, 2 * A), rational(-B + s, 2 * A)]
          .map(r => ({ value: ratValue(r), text: ratText(r, fractions) }))
          .sort((x, y) => x.value - y.value)
          .map(root => ({ ...root, graph: `(${root.text}, 0)` }));
        rootsText = roots.map(root => root.text).join("、");
      } else {
        const { m, n } = splitRoot(D);
        const g = gcd(gcd(B, m), 2 * A);
        let p = -B / g;
        const q = m / g;
        let r = (2 * A) / g;
        if (r < 0) {
          p = -p;
          r = -r;
        }
        const surd = `${q === 1 ? "" : q}√${n}`;
        const pText = p ? plain(p) : "";
        const one = sign => (r === 1
          ? `${pText}${pText ? ` ${sign} ` : sign === "−" ? "−" : ""}${surd}`
          : `${pText ? `(${pText} ${sign} ${surd})` : `${sign === "−" ? "−" : ""}${surd}`}/${r}`);
        const values = [(p - q * Math.sqrt(n)) / r, (p + q * Math.sqrt(n)) / r];
        // 图上标注只写近似横坐标（窄屏放得下），根式写在步骤和结论里
        roots = [one("−"), one("+")].map((text, index) => ({ value: values[index], text, approx: approx(values[index]), graph: `x ≈ ${minus(String(Number(values[index].toFixed(2))))}` }));
        rootsText = r === 1
          ? `${pText ? `${pText} ± ` : "±"}${surd}`
          : `${pText ? `(${pText} ± ${surd})` : `±${surd}`}/${r}`;
      }
    }
    const irrational = roots.some(root => root.approx);
    const rootApprox = irrational ? `（x ≈ ${roots.map(root => root.approx).join("、x ≈ ")}）` : "";
    const hFactor = h === 0 ? "x" : `(x ${h > 0 ? "−" : "+"} ${ratText({ n: Math.abs(hRat.n), d: hRat.d }, fractions)})`;
    const lead = a === 1 ? "" : a === -1 ? "−" : plain(a);
    const vertexForm = `${lead}${hFactor}²${k === 0 ? "" : ` ${k > 0 ? "+" : "−"} ${ratText({ n: Math.abs(kRat.n), d: kRat.d }, fractions)}`}`;
    const vertex = `(${hText}, ${kText})`;
    const xAxis = D > 0
      ? `与 x 轴交于 ${roots.map(root => `(${root.text}, 0)`).join("、")}${rootApprox}`
      : D === 0 ? `与 x 轴只有一个交点 (${hText}, 0)（顶点在 x 轴上）` : "与 x 轴没有交点";
    const zeros = D > 0
      ? `零点为 x = ${roots[0].text} 和 x = ${roots[1].text}${rootApprox}，即图像与 x 轴交于 ${roots.map(root => `(${root.text}, 0)`).join("、")}`
      : D === 0 ? `有一个零点 x = ${hText}（图像与 x 轴只有一个交点 (${hText}, 0)）` : "没有零点（图像与 x 轴没有交点）";
    const deltaClause = D === 0 ? "Δ = 0" : `Δ = ${deltaText} ${cmpText(delta)} 0`;
    const deltaFormula = `Δ = b² − 4ac = ${deltaText}${D === 0 ? "" : ` ${cmpText(delta)} 0`}`;
    const cText = plain(c);
    const yAxis = `与 y 轴交于 (0, ${cText})`;
    const down = a > 0 ? "减小" : "增大";
    const up = a > 0 ? "增大" : "减小";
    const juniorTrend = `当 x < ${hText} 时，y 随 x 的增大而${down}；当 x > ${hText} 时，y 随 x 的增大而${up}`;
    const seniorTrend = `在 (−∞, ${hText}] 上单调${a > 0 ? "递减" : "递增"}，在 [${hText}, +∞) 上单调${a > 0 ? "递增" : "递减"}`;
    const range = a > 0 ? `[${kText}, +∞)` : `(−∞, ${kText}]`;
    const conclusion = level === "junior"
      ? `${fn} = ${expr} = ${vertexForm}：开口${opening}，顶点 ${vertex}，对称轴 x = ${hText}，${extreme}为 ${kText}；${deltaClause}，${xAxis}；${yAxis}。`
      : `${fn} = ${expr} = ${vertexForm}：图像开口${opening}，对称轴 x = ${hText}，顶点 ${vertex}；${seniorTrend}，${extreme}为 ${kText}，值域为 ${range}；${deltaClause}，${zeros}。`;
    return {
      kind: "quadratic",
      level,
      a,
      b,
      c,
      h,
      k,
      delta,
      hText,
      kText,
      cText,
      deltaText,
      fn,
      expr,
      vertexForm,
      vertex,
      opening,
      extreme,
      roots,
      rootsText,
      xAxis,
      zeros,
      yAxis,
      juniorTrend,
      seniorTrend,
      range,
      deltaClause,
      deltaFormula,
      crossings: D > 0 ? 2 : D === 0 ? 1 : 0,
      metrics: [b, c, delta],
      metricUnit: "",
      facts: [
        fact("判别式 Δ", `${deltaText}（${D > 0 ? "两个交点" : D === 0 ? "一个交点" : "没有交点"}）`),
        fact("顶点", vertex),
        fact("对称轴", `x = ${hText}`),
        fact("开口", `${opening}，${extreme} ${kText}`),
        fact(level === "senior" ? "零点" : "与 x 轴交点", D > 0 ? roots.map(root => root.text).join("、") : D === 0 ? hText : "无"),
        fact("与 y 轴交点", `(0, ${cText})`)
      ],
      conclusion,
      formula: "y = a(x − h)² + k",
      formulaDetail: `${fn} = ${expr} = ${vertexForm}，顶点 ${vertex}`,
      readout: `顶点 ${vertex}，${deltaClause}`,
      badge: level === "senior" ? "配方 · 单调性与零点" : "配方法 · 顶点与交点"
    };
  }

  const fullQuadratic = fixed => ({ a: 1, level: "senior", levelLocked: false, notation: "y", ...(fixed || {}) });
  const quadraticQuestion = (b, c, fixed) => {
    const full = fullQuadratic(fixed);
    const expr = polyText(full.a, b, c);
    return full.level === "junior"
      ? `二次函数 y = ${expr}，求图像的开口方向、顶点坐标和对称轴，说明 y 随 x 的增大怎样变化，并求图像与坐标轴的交点。`
      : `已知函数 ${full.notation === "f" ? "f(x)" : "y"} = ${expr}，求函数的单调区间、${full.a > 0 ? "最小值" : "最大值"}和零点。`;
  };

  // ---------- 二元一次方程组：每个方程整理成 ax + by = c ----------
  // 一边的线性式：±k·x、±k·y、±k 的和；同类项、乘积、乘方一律不认
  function linearSide(side) {
    const raw = side.replace(/\s+/g, "");
    if (!raw) return null;
    const terms = (raw.startsWith("-") || raw.startsWith("+") ? raw : `+${raw}`).match(/[+-][^+-]*/g);
    const sum = { x: 0, y: 0, c: 0 };
    const seen = new Set();
    for (const item of terms || []) {
      const found = item.match(/^([+-])(\d+(?:\.\d+)?)?([xy])?$/);
      if (!found || (!found[2] && !found[3])) return null;
      const key = found[3] || "c";
      if (seen.has(key)) return null;
      seen.add(key);
      const magnitude = found[2] === undefined ? 1 : Number(found[2]);
      sum[key] = found[1] === "-" ? -magnitude : magnitude;
    }
    return sum;
  }

  const EQUATION_RE = /[0-9xy.+\-^*\s]*=[0-9xy.+\-^*\s]*/gi;
  function findLinearSystem(source) {
    const equations = [];
    for (const match of source.matchAll(EQUATION_RE)) {
      const textPart = match[0].trim();
      if (!textPart.replace(/[=\s]/g, "")) continue;
      const start = match.index + match[0].indexOf(textPart);
      const sides = textPart.split("=");
      if (sides.length !== 2 || /[\^*]|xy|yx/i.test(textPart)) return miss("当前方程组模板只接两个二元一次方程（不含乘积、乘方和其他字母）。");
      const left = linearSide(sides[0]);
      const right = linearSide(sides[1]);
      if (!left || !right) return miss("没有识别出完整的二元一次方程，请写成 2x + y = 5 这样的形式。");
      const a = left.x - right.x;
      const b = left.y - right.y;
      const c = right.c - left.c;
      if (!a && !b) return miss("方程里没有未知数。");
      // 斜截式 y = kx + m 原样保留写法，滑块改的是 m
      const slope = /^y$/i.test(sides[0].trim()) && b === 1;
      equations.push({ a, b, c, start, end: start + textPart.length, form: slope ? "slope" : "standard" });
    }
    if (equations.length !== 2) return miss(equations.length > 2 ? "题目里有两个以上的方程，当前模板只接两个方程组成的方程组。" : "当前方程组模板需要两个二元一次方程，例如：2x + y = 5，x − y = 1。");
    if (!equations.some(equation => equation.a) || !equations.some(equation => equation.b)) return miss("方程组需要同时含有 x 和 y。");
    return { ok: true, equations };
  }

  const linearLeft = (a, b) => `${term(a, "x", true)}${term(b, "y", !a)}`.trim();
  const equationText = (a, b, c, form) => {
    if (form === "slope" && b === 1) {
      const k = -a;
      const right = `${term(k, "x", true)}${term(c, "", !k)}`.trim() || "0";
      return `y = ${right}`;
    }
    return `${linearLeft(a, b)} = ${plain(c)}`;
  };
  const fullLinear = fixed => ({ a1: 2, b1: 1, a2: 1, b2: -1, form1: "standard", form2: "standard", wording: "system", ...(fixed || {}) });
  const linearQuestion = (c1, c2, fixed) => {
    const f = fullLinear(fixed);
    const first = equationText(f.a1, f.b1, c1, f.form1);
    const second = equationText(f.a2, f.b2, c2, f.form2);
    return f.wording === "lines"
      ? `直线 ${first} 与直线 ${second} 的交点坐标是多少？`
      : `解方程组：${first}，${second}，并说明它的解与两条直线交点的关系。`;
  };

  // 加减消元：系数相等或相反时直接相减或相加，否则先乘再加减；有一个方程只含一个未知数时直接求出
  function eliminate(e1, e2, fractions) {
    const show = value => plain(value);
    const times = value => (Math.abs(value) === 1 ? "" : ` × ${show(Math.abs(value))}`);
    const single = (e, name) => (!e.b ? { variable: "x", text: `由${name}得 x = ${ratText(rational(...ratPair(e.c, e.a)), fractions)}` }
      : !e.a ? { variable: "y", text: `由${name}得 y = ${ratText(rational(...ratPair(e.c, e.b)), fractions)}` } : null);
    const direct = single(e1, "①") || single(e2, "②");
    if (direct) return direct;
    const target = Math.abs(e1.b) === Math.abs(e2.b) || Math.abs(e1.a) !== Math.abs(e2.a) ? "y" : "x";
    const k1 = target === "y" ? e1.b : e1.a;
    const k2 = target === "y" ? e2.b : e2.a;
    // 乘数取对方系数的绝对值，再约去公因数（系数相等或相反时直接加减）
    const g = Number.isInteger(k1) && Number.isInteger(k2) ? gcd(k1, k2) : 1;
    const m1 = Math.abs(k2) / g;
    const m2 = Math.abs(k1) / g;
    const subtract = Math.sign(k1) === Math.sign(k2);
    const op = subtract ? "−" : "+";
    const combine = (u, v) => (subtract ? u * m1 - v * m2 : u * m1 + v * m2);
    const keep = target === "y" ? "x" : "y";
    const coef = combine(target === "y" ? e1.a : e1.b, target === "y" ? e2.a : e2.b);
    const rhs = combine(e1.c, e2.c);
    const label = `①${times(m1)} ${op} ②${times(m2)}`;
    return { variable: keep, label, coef: Number(coef.toPrecision(12)), rhs: Number(rhs.toPrecision(12)) };
  }
  // 两个十进制数之比化成整数分子分母
  const ratPair = (n, d) => {
    const S = scaleOf([n, d]);
    return [Math.round(n * S), Math.round(d * S)];
  };

  function linearModel(c1, c2, fixed = {}) {
    const f = fullLinear(fixed);
    const e1 = { a: f.a1, b: f.b1, c: c1 };
    const e2 = { a: f.a2, b: f.b2, c: c2 };
    const fractions = [e1.a, e1.b, e1.c, e2.a, e2.b, e2.c].every(Number.isInteger);
    const scaled = e => {
      const S = scaleOf([e.a, e.b, e.c]);
      return { A: Math.round(e.a * S), B: Math.round(e.b * S), C: Math.round(e.c * S) };
    };
    const s1 = scaled(e1);
    const s2 = scaled(e2);
    const D = s1.A * s2.B - s2.A * s1.B;
    const text1 = equationText(e1.a, e1.b, e1.c, f.form1);
    const text2 = equationText(e2.a, e2.b, e2.c, f.form2);
    let kind = "unique";
    let x = null;
    let y = null;
    let xText = "";
    let yText = "";
    if (D !== 0) {
      const xr = rational(s1.C * s2.B - s2.C * s1.B, D);
      const yr = rational(s1.A * s2.C - s2.A * s1.C, D);
      x = ratValue(xr);
      y = ratValue(yr);
      xText = ratText(xr, fractions);
      yText = ratText(yr, fractions);
    } else {
      kind = s1.A * s2.C - s2.A * s1.C === 0 && s1.B * s2.C - s2.B * s1.C === 0 ? "infinite" : "none";
    }
    const point = kind === "unique" ? `(${xText}, ${yText})` : "";
    const step = eliminate(e1, e2, fractions);
    let solveText;
    let substitute;
    if (step.text) {
      // 一个方程只含一个未知数
      solveText = step.text;
      substitute = kind === "unique"
        ? `把 ${step.variable} = ${step.variable === "x" ? xText : yText} 代入${e1.a && e1.b ? "①" : "②"}，得 ${step.variable === "x" ? `y = ${yText}` : `x = ${xText}`}`
        : kind === "none" ? "两个方程对同一个未知数给出不同的值，方程组无解" : "两个方程相同，方程组有无数组解";
    } else if (kind === "unique") {
      solveText = `${step.label}，消去 ${step.variable === "x" ? "y" : "x"}：${plain(step.coef)}${step.variable} = ${plain(step.rhs)}，${step.variable} = ${step.variable === "x" ? xText : yText}`;
      substitute = `把 ${step.variable} = ${step.variable === "x" ? xText : yText} 代入①，得 ${step.variable === "x" ? `y = ${yText}` : `x = ${xText}`}`;
    } else {
      solveText = `${step.label}：0 = ${plain(step.rhs)}`;
      substitute = kind === "none" ? `0 = ${plain(step.rhs)} 不成立，方程组无解` : "0 = 0 恒成立：两个方程实际上是同一个方程，方程组有无数组解";
    }
    const answer = kind === "unique" ? `x = ${xText}，y = ${yText}` : kind === "none" ? "方程组无解" : "方程组有无数组解";
    const geometry = kind === "unique"
      ? `两条直线交于点 ${point}，方程组的解就是交点的坐标`
      : kind === "none" ? "两条直线平行（没有公共点），所以方程组无解" : "两条直线重合（有无数个公共点），所以方程组有无数组解";
    const conclusion = `方程组 ① ${text1}，② ${text2}：${kind === "unique" ? `解为 ${answer}` : answer}；${geometry}。`;
    return {
      kind: "linearSystem",
      level: "junior",
      equations: [{ ...e1, text: text1 }, { ...e2, text: text2 }],
      solutionKind: kind,
      x,
      y,
      xText,
      yText,
      point,
      answer,
      geometry,
      solveText,
      substitute,
      metrics: [c1, c2, kind === "unique" ? point : kind === "none" ? "无解" : "无数组解"],
      metricUnit: "",
      facts: [
        fact("交点", kind === "unique" ? point : kind === "none" ? "无（两直线平行）" : "无数个（两直线重合）"),
        fact("方程组的解", answer),
        fact("方程 ①", text1),
        fact("方程 ②", text2)
      ],
      conclusion,
      formula: "方程组的解 = 两直线交点",
      formulaDetail: `① ${text1}，② ${text2}：${solveText}`,
      readout: kind === "unique" ? `交点 ${point}：${answer}` : answer,
      badge: "加减消元 · 两直线交点"
    };
  }

  const templates = {
    quadratic: {
      id: "quadratic",
      subject: "数学",
      level: "both",
      scene: "math",
      menuTitle: "二次函数图像与性质",
      menuMeta: "单调性 · 最值 · 零点",
      stage: "高中必修1",
      block: "函数",
      title: "二次函数：图像与性质",
      defaults: [-4, 3],
      keywords: /二次函数|抛物线|x\s*\^?\s*2/,
      params: [
        { label: "一次项系数 b", desc: "改变 b：对称轴 x = −b/(2a) 左右移动", unit: "", min: -10, max: 10, step: 1, value: -4 },
        { label: "常数项 c", desc: "改变 c：抛物线上下平移，Δ 随之变号", unit: "", min: -10, max: 10, step: 1, value: 3 }
      ],
      strict: {
        intent: {
          require: [/二次函数|抛物线|函数|x\s*\^\s*2/],
          forbid: [/切线|斜率|导数|导函数|变化率|平移|对称点|面积|周长|三角形|四边形|△|一次函数|反比例|不等式|解集|取值范围|参数|恒成立|定义域|区间上|闭区间|经过点|过点|图象经过|图像经过|解析式|待定系数|方程组|根与系数|韦达|整数解|利润|成本|售价|销量|如图|图中|[<>≤≥]/]
        },
        sameConditions: true,
        caps: [[-20, 20], [-20, 20]],
        preciseParams: true,
        fixedDefaults: { a: 1, level: "senior", levelLocked: false, notation: "y" },
        values(source, tokens, context = {}) {
          // “对称轴是直线 x = …”是教材说法；其他“直线”（与直线的交点等）超出本模板范围
          if (/直线/.test(source.replace(/对称轴(?:是|为)?(?:哪一?条)?直线/g, "对称轴"))) return miss("题目涉及直线，超出二次函数图像与性质模板的范围。");
          if (tokens.length) return miss("题目中有带单位或分数形式的量，超出二次函数模板的范围。");
          const found = findQuadratic(source);
          if (!found.ok) return found;
          const residue = `${source.slice(0, found.start)} ${source.slice(found.end)}`
            .replace(/[(（]\s*\d\s*[)）]|第\s*\d+\s*(?:问|小题)|[①②③④]/g, " ")
            .replace(/f\s*\(\s*x\s*\)/gi, " ");
          if (/\d/.test(residue)) return miss("题目中还有解析式以外的数值（区间、点或函数值），超出二次函数模板的范围。");
          if (/[a-wzA-WZ]/.test(residue)) return miss("题目含字母参数或点的名称，超出二次函数模板的范围。");
          for (const value of [found.a, found.b, found.c]) {
            if ((exactPlaces(value) ?? 9) > 2) return miss("二次函数模板的系数最多支持两位小数。");
          }
          if (Math.abs(found.a) > 10) return miss(`二次项系数 a = ${plain(found.a)} 超出当前演示范围（|a| ≤ 10）。`);
          const senior = SENIOR_CUE.test(source);
          const junior = JUNIOR_CUE.test(source);
          const level = senior ? "senior" : junior ? "junior" : context.gradeLevel === "junior" ? "junior" : "senior";
          return { ok: true, p1: found.b, p2: found.c, fixed: { a: found.a, level, levelLocked: senior || junior, notation: found.notation } };
        },
        used: () => [],
        asks: {
          supported: /顶点|对称轴|开口|方向|最大值|最小值|最值|交点|零点|图像|图象|性质|增减|单调|随|递增|递减|变化|判别式|Δ|坐标|配方|值域|几个|位置|形状/,
          unsupported: /切线|斜率|导数|面积|周长|距离|长度|平移|对称点|解析式|表达式|定义域|取值范围|解集|函数值|y\s*的值|利润|成本|销量/
        }
      },
      failMessage: "当前二次函数模板支持一般式 y = ax² + bx + c 的开口、顶点、对称轴、最值、增减性（单调性）与坐标轴交点（零点）。",
      question: quadraticQuestion,
      presetFor: level => level === "junior"
        ? { p1: -4, p2: 3, fixed: { a: 1, level: "junior", levelLocked: true, notation: "y" } }
        : { p1: -4, p2: 3, fixed: { a: 1, level: "senior", levelLocked: true, notation: "f" } },
      model: quadraticModel,
      recognition: model => `二次函数｜${model.fn} = ${model.expr}｜顶点 ${model.vertex}｜对称轴 x = ${model.hText}｜${model.deltaClause}`,
      formatMetric: value => plain(value),
      // 变式：让 Δ 变成 0（顶点落到 x 轴上）；做不到时把 c 加 2
      variant: (b, c, fixed) => {
        const a = fullQuadratic(fixed).a;
        const touching = (b * b) / (4 * a);
        if (Math.abs(touching - c) > 1e-9 && Math.abs(touching) <= 20 && (exactPlaces(touching) ?? 9) <= 2) return { p1: b, p2: touching };
        return { p1: b, p2: c + 2 > 20 ? -20 : c + 2 };
      },
      graph: (model, fixed) => {
        const near = (x, y) => Math.abs(x - y) < 1e-9;
        const points = [{ x: model.h, y: model.k, label: `顶点 ${model.vertex}`, cls: "vertex", place: model.a > 0 ? "below" : "above" }];
        // 两个交点的标注放在抛物线开口内侧（向上开口时在 x 轴上方），避开曲线
        model.roots.forEach((root, index) => {
          const inner = model.roots.length === 2 ? (index === 0 ? "right" : "left") : "right";
          if (!near(root.value, model.h) || !near(model.k, 0)) points.push({ x: root.value, y: 0, label: root.graph, cls: "root", place: `${model.a > 0 ? "above" : "below"}-${inner}` });
        });
        const interceptShown = points.some(point => near(point.x, 0) && near(point.y, model.c));
        // 与 y 轴交点的标注放在曲线不经过的一侧：曲线在该点向右上升时放右下方，向右下降时放右上方
        if (!interceptShown) points.push({ x: 0, y: model.c, label: `(0, ${model.cText})`, cls: "intercept", place: model.b > 0 ? "below-right" : "above-right" });
        return {
          key: `quadratic|${model.a}`,
          center: model.h,
          focus: [{ x: model.h, y: model.k }, ...model.roots.map(root => ({ x: root.value, y: 0 })), { x: 0, y: model.c }],
          curves: [{ fn: x => model.a * x * x + model.b * x + model.c, label: `${model.fn} = ${model.expr}` }],
          guides: [{ x: model.h, label: `x = ${model.hText}` }],
          points,
          note: `对称轴 x = ${model.hText} · ${model.deltaClause}`,
          badge: { title: "顶点", value: model.vertex },
          ariaLabel: `二次函数 ${model.fn} = ${model.expr} 的图像：顶点 ${model.vertex}，对称轴 x = ${model.hText}`
        };
      },
      copy: (model, b, c, fixed, base) => {
        const junior = model.level === "junior";
        const coefficients = `a = ${plain(model.a)}，b = ${plain(model.b)}，c = ${model.cText}`;
        return {
          stage: junior ? "初中核心" : "高中必修1",
          engine: junior ? "初中核心 · 函数模板" : "高中必修1 · 函数模板",
          description: `${junior ? "初中核心" : "高中必修1"}｜函数｜${model.conclusion}`,
          steps: junior ? [
            ["识别函数", `y = ${model.expr}（${coefficients}）`, "二次函数的一般式 y = ax² + bx + c（a ≠ 0）。"],
            ["配方求顶点", `y = ${model.vertexForm}，顶点 ${model.vertex}，对称轴 x = ${model.hText}`, "也可以用顶点坐标公式 (−b/(2a), (4ac − b²)/(4a)) 计算。"],
            ["开口与增减性", `a ${cmpText(model.a)} 0，开口${model.opening}；${model.juniorTrend}`, `顶点处取得${model.extreme} ${model.kText}。`],
            ["与坐标轴交点", `${model.deltaFormula}，${model.xAxis}；${model.yAxis}`, "Δ 的符号决定抛物线与 x 轴的交点个数。"]
          ] : [
            ["识别函数", `${model.fn} = ${model.expr}（${coefficients}）`, "二次函数的一般式 f(x) = ax² + bx + c（a ≠ 0）。"],
            ["配方", `${model.fn} = ${model.vertexForm}，对称轴 x = ${model.hText}，顶点 ${model.vertex}`, "配方后直接读出对称轴和顶点。"],
            ["单调性与最值", `${model.seniorTrend}；${model.extreme}为 ${model.kText}`, `值域为 ${model.range}。`],
            ["零点", `${model.deltaFormula}，${model.zeros}；${model.yAxis}`, "零点是方程 f(x) = 0 的实数根，也就是图像与 x 轴交点的横坐标。"]
          ],
          mentor: junior
            ? "关键追问：拖动 <strong>c</strong> 让抛物线上下平移，Δ 什么时候由正变负？抛物线与 x 轴的交点怎样变化？"
            : "关键追问：保持 a、b 不变，<strong>c</strong> 增大时，函数的最值和零点个数怎样变化？",
          hint: junior
            ? "小提示：先配方写成 y = a(x − h)² + k，顶点是 (h, k)；再算 Δ = b² − 4ac，判断抛物线与 x 轴有几个交点。"
            : "小提示：配方得 f(x) = a(x − h)² + k；a > 0 时在 x = h 处取得最小值，零点个数由 Δ 的符号决定。",
          challenge: "试试看：调节 <strong>c</strong>，让 <strong>Δ = 0</strong>，这时抛物线与 x 轴有几个公共点？",
          // 数学画面的观察提示压在图像左下角，只写一句实时结论；完整结论在步骤和公式卡里
          sceneTip: junior
            ? `${model.deltaClause}：抛物线与 x 轴${["没有交点", "只有一个交点", "有两个交点"][model.crossings]}，${model.extreme}为 ${model.kText}。`
            : `${model.deltaClause}：函数${["没有零点", "有一个零点", "有两个零点"][model.crossings]}，${model.extreme}为 ${model.kText}。`,
          generationStages: stages(`识别二次函数 ${model.fn} = ${model.expr}`, `配方：${model.fn} = ${model.vertexForm}`, `生成图像：顶点 ${model.vertex}`)
        };
      }
    },
    linearSystem: {
      id: "linearSystem",
      subject: "数学",
      level: "junior",
      scene: "math",
      menuTitle: "二元一次方程组与两直线交点",
      menuMeta: "加减消元 · 交点坐标 · 无解与无数组解",
      stage: "初中核心",
      block: "方程（组）",
      title: "二元一次方程组：解与两直线的交点",
      defaults: [5, 1],
      keywords: /方程组|二元一次|直线|交点|一次函数/,
      params: [
        { label: "①常数项 c₁", desc: "改变方程 ① 右边的常数：直线 ① 平移", unit: "", min: -10, max: 10, step: 1, value: 5 },
        { label: "②常数项 c₂", desc: "改变方程 ② 右边的常数：直线 ② 平移", unit: "", min: -10, max: 10, step: 1, value: 1 }
      ],
      strict: {
        intent: {
          require: [/方程|直线|交点|函数|解|[xy]\s*(?:的值|和|与|、)/],
          forbid: [/三元|不等式|[<>≤≥]|应用|如图|图中|参数|取值范围|恒成立|面积|距离|周长|夹角|平移|垂直|斜率|截距|经过点|过点|图像经过|图象经过|整数解|正整数|非负|最大|最小|利润|价格|每个|每件|共花|千米|速度|工程|绝对值|\|/]
        },
        sameConditions: true,
        caps: [[-20, 20], [-20, 20]],
        preciseParams: true,
        fixedDefaults: { a1: 2, b1: 1, a2: 1, b2: -1, form1: "standard", form2: "standard", wording: "system" },
        values(source, tokens) {
          if (tokens.length) return miss("题目中有带单位或分数形式的量，超出方程组模板的范围。");
          const found = findLinearSystem(source);
          if (!found.ok) return found;
          const [e1, e2] = found.equations;
          let residue = source;
          for (const equation of [e2, e1]) residue = `${residue.slice(0, equation.start)} ${residue.slice(equation.end)}`;
          residue = residue
            .replace(/[(（]\s*\d\s*[)）]|第\s*\d+\s*(?:问|小题)|[①②③④{}｛｝]/g, " ")
            .replace(/(?:^|[^A-Za-z])l\s*[12](?![0-9])/gi, " ");
          if (/\d/.test(residue)) return miss("题目中还有方程以外的数值，超出方程组模板的范围。");
          if (/[a-wzA-WZ]/.test(residue)) return miss("题目含字母参数或其他未知数，超出方程组模板的范围。");
          for (const equation of found.equations) {
            for (const value of [equation.a, equation.b, equation.c]) {
              if ((exactPlaces(value) ?? 9) > 2) return miss("方程组模板的系数最多支持两位小数。");
            }
            if (Math.abs(equation.a) > 10 || Math.abs(equation.b) > 10) return miss("未知数的系数超出当前演示范围（绝对值不超过 10）。");
          }
          const wording = /直线|交点/.test(source) && !/方程组/.test(source) ? "lines" : "system";
          return {
            ok: true,
            p1: e1.c,
            p2: e2.c,
            fixed: { a1: e1.a, b1: e1.b, a2: e2.a, b2: e2.b, form1: e1.form, form2: e2.form, wording }
          };
        },
        used: () => [],
        asks: {
          supported: /解|交点|坐标|值|几组|有没有|是否|无解|无数|位置|平行|重合|相交|关系|多少|是什么/,
          // 另求代数式（x + y 的值）不在范围内；方程本身（2x − 1 = …）不算所问内容
          unsupported: /[xy]\s*[-+*/×÷·]\s*(?:\d+(?:\.\d+)?)?\s*[xy]?\s*(?:的值|是多少|等于多少)|^\s*(?:\d+(?:\.\d+)?)?[xy]\s*[-+*/×÷·]\s*(?:\d+(?:\.\d+)?)?[xy]\s*$|面积|距离|斜率|截距|周长|夹角|最大|最小|整数解/
        }
      },
      failMessage: "当前方程组模板支持两个二元一次方程组成的方程组（如 2x + y = 5，x − y = 1），求解并判断无解、无数组解。",
      question: linearQuestion,
      model: linearModel,
      recognition: model => `二元一次方程组｜① ${model.equations[0].text}｜② ${model.equations[1].text}｜${model.answer}`,
      formatMetric: value => (typeof value === "string" ? value : plain(value)),
      // 变式：把常数项 c₂ 改成让方程组“无解”或回到有唯一解的情况，体会常数项只平移直线
      variant: (c1, c2) => ({ p1: c1, p2: c2 + 2 > 20 ? -20 : c2 + 2 }),
      graph: model => {
        const [e1, e2] = model.equations;
        const intercepts = e => [
          ...(e.a ? [{ x: e.c / e.a, y: 0 }] : []),
          ...(e.b ? [{ x: 0, y: e.c / e.b }] : [])
        ];
        const points = model.solutionKind === "unique"
          ? [{ x: model.x, y: model.y, label: `交点 ${model.point}`, cls: "solution", place: "above" }]
          : [];
        return {
          key: `linearSystem|${e1.a},${e1.b},${e2.a},${e2.b}`,
          focus: model.solutionKind === "unique" ? [{ x: model.x, y: model.y }, ...intercepts(e1), ...intercepts(e2)] : [...intercepts(e1), ...intercepts(e2)],
          lines: [
            { a: e1.a, b: e1.b, c: e1.c, label: `① ${e1.text}`, cls: "math-line" },
            { a: e2.a, b: e2.b, c: e2.c, label: `② ${e2.text}`, cls: `math-line line-2${model.solutionKind === "infinite" ? " coincide" : ""}`, spots: [0.14, 0.3, 0.86, 0.7] }
          ],
          points,
          note: model.solutionKind === "unique" ? `两直线交于 ${model.point}` : model.solutionKind === "none" ? "两直线平行：方程组无解" : "两直线重合：方程组有无数组解",
          badge: { title: model.solutionKind === "unique" ? "交点" : "解的情况", value: model.solutionKind === "unique" ? model.point : model.solutionKind === "none" ? "无解" : "无数组解" },
          ariaLabel: `方程组 ① ${e1.text}、② ${e2.text} 对应的两条直线：${model.geometry}`
        };
      },
      copy: model => ({
        steps: [
          ["列出方程组", `① ${model.equations[0].text}；② ${model.equations[1].text}`, "两个方程、两个未知数，每个方程的图像都是一条直线。"],
          ["加减消元", model.solveText, "把两个方程相加或相减，消去一个未知数。"],
          ["求出另一个未知数", model.substitute, "代入任意一个含有该未知数的方程。"],
          ["图像解释", model.geometry, "拖动常数项，直线平移，交点随之移动；两直线平行时方程组无解。"]
        ],
        mentor: "关键追问：只改变常数项 c₂，直线 ② 会怎样移动？什么情况下方程组会<strong>无解</strong>？",
        hint: "小提示：先观察两个方程中同一个未知数的系数，相同就相减、相反就相加；不同时先乘一个数再加减。",
        challenge: "试试看：调节 <strong>c₂</strong>，观察交点怎样移动；再想一想，把方程 ② 的系数改成和 ① 成比例时会怎样？",
        sceneTip: model.solutionKind === "unique"
          ? `两直线交于 ${model.point}：方程组的解是 ${model.answer}。`
          : model.solutionKind === "none" ? "两直线平行，没有交点：方程组无解。" : "两直线重合：方程组有无数组解。",
        generationStages: stages(`识别方程组 ① ${model.equations[0].text}，② ${model.equations[1].text}`, `加减消元：${model.solveText}`, `生成图像：${model.solutionKind === "unique" ? `交点 ${model.point}` : model.answer}`)
      })
    }

  };

  register(templates);
})();
