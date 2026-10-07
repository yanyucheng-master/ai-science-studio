/* 题目解析守卫（2026-10-05）
   各实验模板共用：抽取题目里所有带单位的量、所问的内容，供模板逐项核对。
   原则：
   1. 题目里出现的每一个量，都必须被模板用到且数值一致；
   2. 题目问的内容，必须是模板能给出的结果；
   3. 缺条件、超出演示范围、含模板不支持的条件时一律不匹配，交给 AI，绝不套用默认值。 */
(() => {
  const SUPERSCRIPT = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-" };
  const CN_DIGIT = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

  // 只做与语义无关的统一：全角字符、上下标、空白。不改写汉字，便于各模板做意图判断。
  function normalize(text) {
    return String(text || "")
      .replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
      .replace(/　/g, " ")
      .replace(/[−–—﹣]/g, "-")
      .replace(/µ/g, "μ")
      .replace(/[ΩΩ]/g, "Ω")
      .replace(/°\s*C|摄氏度/g, "℃")
      .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, s => `^${[...s].map(ch => SUPERSCRIPT[ch]).join("")}`)
      .replace(/[₀-₉]/g, ch => String(ch.charCodeAt(0) - 0x2080))
      .replace(/[·•∙⋅]/g, "·")
      .replace(/\s+/g, " ")
      .trim();
  }

  // 单位表：按长度从长到短匹配；factor 把数值换算到基准单位
  const UNIT_TABLE = [
    ["J/(kg·℃)", "specificHeat", 1], ["J/(kg℃)", "specificHeat", 1], ["J/kg·℃", "specificHeat", 1],
    ["km/h", "speed", 1 / 3.6], ["km·h^-1", "speed", 1 / 3.6], ["千米/时", "speed", 1 / 3.6], ["千米每小时", "speed", 1 / 3.6],
    ["公里/小时", "speed", 1 / 3.6], ["公里每小时", "speed", 1 / 3.6], ["km/s", "speed", 1000], ["cm/s", "speed", 0.01],
    ["m/s^2", "accel", 1], ["m·s^-2", "accel", 1], ["m/s2", "accel", 1], ["米每二次方秒", "accel", 1],
    ["m/s", "speed", 1], ["m·s^-1", "speed", 1], ["米/秒", "speed", 1], ["米每秒", "speed", 1],
    ["N/kg", "gfield", 1], ["kg/m^3", "density", 1], ["kg/m3", "density", 1], ["kg·m^-3", "density", 1],
    ["g/cm^3", "density", 1000], ["g/cm3", "density", 1000], ["g/mL", "density", 1000],
    ["kg/s", "dragK", 1], ["N·s/m", "dragK", 1],
    ["kW·h", "energy", 3.6e6], ["kWh", "energy", 3.6e6], ["kJ", "energy", 1000], ["J", "energy", 1], ["焦耳", "energy", 1], ["焦", "energy", 1],
    ["kW", "power", 1000], ["W", "power", 1], ["瓦特", "power", 1], ["瓦", "power", 1],
    ["kPa", "pressure", 1000], ["Pa", "pressure", 1], ["帕斯卡", "pressure", 1], ["帕", "pressure", 1],
    ["kHz", "frequency", 1000], ["Hz", "frequency", 1], ["赫兹", "frequency", 1],
    ["kV", "voltage", 1000], ["mV", "voltage", 0.001], ["V", "voltage", 1], ["伏特", "voltage", 1], ["伏", "voltage", 1],
    ["mA", "current", 0.001], ["毫安", "current", 0.001], ["A", "current", 1], ["安培", "current", 1], ["安", "current", 1],
    ["kΩ", "resistance", 1000], ["MΩ", "resistance", 1e6], ["Ω", "resistance", 1], ["欧姆", "resistance", 1], ["欧", "resistance", 1],
    ["m^3", "volume", 1e6], ["m3", "volume", 1e6], ["dm^3", "volume", 1000], ["dm3", "volume", 1000], ["cm^3", "volume", 1], ["cm3", "volume", 1],
    ["mL", "volume", 1], ["ml", "volume", 1], ["毫升", "volume", 1], ["L", "volume", 1000], ["升", "volume", 1000],
    ["m^2", "area", 1], ["dm^2", "area", 0.01], ["cm^2", "area", 1e-4], ["mm^2", "area", 1e-6],
    ["g/mol", "molarMass", 1], ["g·mol^-1", "molarMass", 1], ["kg/mol", "molarMass", 1000],
    ["mol", "amount", 1], ["摩尔", "amount", 1],
    ["min", "time", 60], ["分钟", "time", 60], ["ms", "time", 0.001], ["h", "time", 3600], ["小时", "time", 3600], ["s", "time", 1], ["秒", "time", 1],
    ["km", "length", 1000], ["千米", "length", 1000], ["公里", "length", 1000], ["mm", "length", 0.001], ["毫米", "length", 0.001],
    ["cm", "length", 0.01], ["厘米", "length", 0.01], ["dm", "length", 0.1], ["分米", "length", 0.1], ["m", "length", 1], ["米", "length", 1],
    ["kg", "mass", 1], ["千克", "mass", 1], ["公斤", "mass", 1], ["mg", "mass", 1e-6], ["毫克", "mass", 1e-6], ["g", "mass", 0.001], ["克", "mass", 0.001],
    ["t", "mass", 1000], ["吨", "mass", 1000],
    ["kN", "force", 1000], ["N", "force", 1], ["牛顿", "force", 1], ["牛", "force", 1],
    ["℃", "temperature", 1], ["%", "percent", 1], ["°", "angle", 1], ["度", "angle", 1],
    ["匝", "turns", 1], ["段", "count", 1], ["股", "count", 1]
  ];
  const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const UNIT_SOURCE = UNIT_TABLE.map(([unit]) => unit).sort((a, b) => b.length - a.length).map(escapeRe).join("|");
  const UNIT_INFO = new Map(UNIT_TABLE.map(([unit, cls, factor]) => [unit, { cls, factor }]));
  const NUMBER_SOURCE = String.raw`(-?\d+(?:\.\d+)?)(?:\s*[×xX*✕]\s*10\s*\^\s*\(?\s*(-?\d+)\s*\)?)?`;
  // 数字后接单位；单位后不能紧跟字母（避免把 5mA 拆成 5m + A）
  const QUANTITY_RE = new RegExp(`${NUMBER_SOURCE}\\s*(${UNIT_SOURCE})(?![A-Za-z])`, "g");

  function readNumber(mantissa, exponent) {
    const value = Number(mantissa) * (exponent === undefined ? 1 : 10 ** Number(exponent));
    return Number.isFinite(value) ? value : NaN;
  }

  // 抽取题目中的全部数量（含单位换算后的基准值）；同时识别 g、动摩擦因数、绳子段数、分数等无单位的量
  function extractQuantities(text) {
    const source = normalize(text);
    const tokens = [];
    const covered = [];
    const push = (token, start, end) => { tokens.push({ ...token, index: start }); covered.push([start, end]); };
    for (const match of source.matchAll(QUANTITY_RE)) {
      const start = match.index;
      const before = source.slice(Math.max(0, start - 1), start);
      if (/[A-Za-z_]/.test(before) && !/^-/.test(match[1])) continue; // R1、F2、t1 这类下标不算数量
      const unit = match[3];
      const info = UNIT_INFO.get(unit);
      let cls = info.cls;
      const raw = readNumber(match[1], match[2]);
      if (!Number.isFinite(raw)) continue;
      let value = raw * info.factor;
      const lead = source.slice(Math.max(0, start - 12), start);
      if (cls === "angle" && /温度|气温|水温/.test(lead)) cls = "temperature";
      if ((cls === "gfield" || cls === "accel") && /(?:g|重力加速度)\s*(?:取|=|为|是|:|约为|约)?\s*$/.test(lead)) cls = "g";
      if (cls === "gfield") cls = "g";
      push({ cls, value, raw, unit, text: match[0] }, start, start + match[0].length);
    }
    const free = (start, end) => !covered.some(([a, b]) => start < b && end > a);
    // g 取 10（无单位）
    for (const match of source.matchAll(/(?:g|重力加速度)\s*(?:取|=|为|是|:|约为)\s*(\d+(?:\.\d+)?)(?!\s*(?:\.\d|[A-Za-z]|\/))/g)) {
      const start = match.index + match[0].lastIndexOf(match[1]);
      if (free(start, start + match[1].length)) push({ cls: "g", value: Number(match[1]), raw: Number(match[1]), unit: "", text: match[0] }, start, start + match[1].length);
    }
    // 动摩擦因数、阻力系数等无单位系数
    for (const match of source.matchAll(/(?:μ\s*\d?|动摩擦因数|滑动摩擦因数|动摩擦系数|滑动摩擦系数|摩擦因数|摩擦系数)\s*(?:均)?\s*(?:为|是|=|:|约为|约)?\s*(\d+(?:\.\d+)?)(?!\s*(?:\d|[A-Za-z%]|\/))/g)) {
      const start = match.index + match[0].lastIndexOf(match[1]);
      if (free(start, start + match[1].length)) push({ cls: "coef", value: Number(match[1]), raw: Number(match[1]), unit: "", text: match[0] }, start, start + match[1].length);
    }
    // 承担物重的绳子段数 n=3
    for (const match of source.matchAll(/(?:^|[^A-Za-z])n\s*=\s*(\d+)(?!\s*(?:\.\d|[A-Za-z]))/g)) {
      const start = match.index + match[0].lastIndexOf(match[1]);
      if (free(start, start + match[1].length)) push({ cls: "count", value: Number(match[1]), raw: Number(match[1]), unit: "", text: match[0] }, start, start + match[1].length);
    }
    // 两段、三股（汉字数字）；“一段导体”“一段时间”里的“一段”不是绳子段数
    for (const match of source.matchAll(/([二两三四五六七八九十])\s*(段|股)/g)) {
      push({ cls: "count", value: CN_DIGIT[match[1]], raw: CN_DIGIT[match[1]], unit: match[2], text: match[0] }, match.index, match.index + match[0].length);
    }
    // 几个钩码
    for (const match of source.matchAll(/(\d+|[一二两三四五六七八九十])\s*个\s*钩码/g)) {
      const value = CN_DIGIT[match[1]] ?? Number(match[1]);
      push({ cls: "hooks", value, raw: value, unit: "个钩码", text: match[0] }, match.index, match.index + match[0].length);
    }
    // 倍数（“原来的 2 倍”“两倍”“加倍”“翻倍”“减半”）：模板只按题目原数据演示，出现即视为未消化的条件
    for (const match of source.matchAll(/(\d+(?:\.\d+)?)\s*倍|([一二两三四五六七八九十])\s*倍|加倍|翻倍|减半|翻一番/g)) {
      if (!free(match.index, match.index + match[0].length)) continue;
      const value = match[1] ? Number(match[1]) : match[2] ? CN_DIGIT[match[2]] : NaN;
      push({ cls: "times", value, raw: match[0], unit: "倍", text: match[0] }, match.index, match.index + match[0].length);
    }
    // 分数、一半：模板都不处理，出现即视为未消化的条件
    for (const match of source.matchAll(/(\d+)\s*\/\s*(\d+)(?!\s*[A-Za-z])/g)) {
      if (free(match.index, match.index + match[0].length)) push({ cls: "fraction", value: Number(match[1]) / Number(match[2]), raw: match[0], unit: "", text: match[0] }, match.index, match.index + match[0].length);
    }
    for (const match of source.matchAll(/[一二三四五六七八九十]分之[一二三四五六七八九十]|一半|三成|五成/g)) {
      push({ cls: "fraction", value: NaN, raw: match[0], unit: "", text: match[0] }, match.index, match.index + match[0].length);
    }
    return tokens.sort((a, b) => a.index - b.index);
  }

  const approx = (a, b, tol = 1e-6) => Math.abs(a - b) <= Math.max(1e-9, tol * Math.max(Math.abs(a), Math.abs(b)));

  // used：模板实际用到的量 [{ cls, value, abs?, tol? }]。题目里每个量都必须能在 used 中找到同类同值项。
  function unconsumed(text, used, options = {}) {
    const tokens = Array.isArray(text) ? text : extractQuantities(text);
    if (!Array.isArray(text)) options = { ...options, source: normalize(text) };
    return tokens.filter(token => {
      if (options.ignore?.some(rule => rule(token, options.source || ""))) return false;
      return !used.some(item => item && item.cls === token.cls && Number.isFinite(item.value) && Number.isFinite(token.value)
        && approx(item.abs ? Math.abs(item.value) : item.value, item.abs ? Math.abs(token.value) : token.value, item.tol));
    });
  }

  // 所问内容：“求……”“计算……”“判断……”之后的部分，以及含“多少/多大/是否”等疑问的分句，再按“和、与、及、、”拆成小项
  function askItems(text) {
    const source = normalize(text);
    const segments = [];
    for (const match of source.matchAll(/(?:试求|求出|求得|(?<![要需请追恳])求(?!助)|计算出|计算(?!题)|算出|估算|判断出|判断|确定|说出|指出)\s*[:：]?\s*([^。；;？?！!]*)/g)) segments.push(match[1]);
    for (const clause of source.split(/[，,。；;？?！!]/)) {
      if (/多少|多大|多长|多远|多久|多高|多重|几秒|几米|是否|怎样|如何|什么|哪(?:个|种|端|一|里|些)|会不会|能否|能不能/.test(clause)) segments.push(clause);
    }
    const items = [];
    for (const segment of segments) {
      for (const part of segment.split(/以及|及其|和|与|及|并且|并|、|，|,|;|；|\(\d\)|（\d）|①|②|③|④/)) {
        const item = part.replace(/^\s*(?:出|一下|下列|该|这个|此时|这时|此)\s*/, "").trim();
        if (item.length >= 2) items.push(item);
      }
    }
    return [...new Set(items)];
  }

  const NEUTRAL_ASK = /^(?:请)?(?:观察|体会|感受|思考|说明理由|说明原因|解释|验证|分析|画出|作出|写出计算过程|写出过程)|^理由$|^原因$/;
  // 含有物理量、结论或疑问词的才算“所问内容”；“滑块”“该点处”这类主语不算
  const ASK_HINT = /距离|位移|路程|时间|多久|速度|加速度|电流|电压|电阻|阻值|功率|功|能|压强|压力|浮力|重力|效率|温度|热量|像|斜率|导数|切线|变化|质量|物质的量|体积|密度|示数|磁极|极|磁性|方向|音调|响度|波长|频率|周期|力|结构|功能|作用|名称|颜色|现象|是否|多少|多大|多长|多远|怎样|如何|什么|哪|几|平衡|下沉|滑落|过量|剩余|关系|比|值|坐标|轨迹|射程|落点|铜|Cu/;

  // supported：模板能回答的内容；unsupported：明确回答不了的内容（优先判定）
  function checkAsks(text, supported, unsupported) {
    const items = askItems(text);
    for (const item of items) {
      if (unsupported && unsupported.test(item)) return { ok: false, item };
      if (NEUTRAL_ASK.test(item) || !ASK_HINT.test(item)) continue;
      if (!supported.test(item)) return { ok: false, item };
    }
    return { ok: true, items };
  }

  function gravityOf(text) {
    const values = extractQuantities(text).filter(token => token.cls === "g").map(token => token.value);
    if (!values.length) return { stated: false, value: 9.8 };
    const unique = [...new Set(values.map(value => Number(value.toFixed(3))))];
    if (unique.length !== 1 || ![9.8, 9.81, 10].includes(unique[0])) return { stated: true, value: NaN };
    return { stated: true, value: unique[0] };
  }

  // 把数值整理成适合显示的有限位小数，避免 0.1+0.2 之类的浮点尾巴
  const tidy = value => Number(Number(value).toPrecision(12));

  const api = Object.freeze({ normalize, extractQuantities, unconsumed, askItems, checkAsks, gravityOf, tidy, approx });
  const root = typeof window !== "undefined" ? window : globalThis;
  root.MasterLabQuestionGuard = api;
})();

(() => {
  const G = 9.8;
  const AIR_SPEED = 340;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value)));
  // 能用 4 位以内小数精确写出的数（31.25、0.125）原样显示，除不尽的才按 decimals 位近似
  const exactPlaces = value => {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    for (let places = 0; places <= 4; places += 1) {
      if (Math.abs(number - Number(number.toFixed(places))) <= 1e-9 * Math.max(1, Math.abs(number))) return places;
    }
    return null;
  };
  const fmt = (value, decimals = 1) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return "--";
    const places = exactPlaces(number);
    return number.toFixed(places === null ? decimals : places).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  };
  // 结果被近似时写“≈ / 约”，能精确写出时写“=”
  const eq = value => (exactPlaces(value) === null ? "≈" : "=");
  const about = value => (exactPlaces(value) === null ? "约 " : "");
  const mark = value => (exactPlaces(value) === null ? "≈" : "");
  const fmtInput = value => fmt(value, 3);
  const gravityClause = (fixed = {}) => Number.isFinite(fixed.g) && Math.abs(fixed.g - G) > 1e-9 ? `（g 取 ${fmtInput(fixed.g)}N/kg）` : "";
  const guard = () => window.MasterLabQuestionGuard;
  const tokensOf = (tokens, cls) => tokens.filter(token => token.cls === cls);
  const leadOf = (source, token, size = 14) => source.slice(Math.max(0, token.index - size), token.index);
  const tailOf = (source, token, size = 12) => source.slice(token.index + token.text.length, token.index + token.text.length + size);
  const miss = message => ({ ok: false, message });
  // 取数量前最近的一个标签词（如“R2”“拉力”“焦距”），用来区分同类量的身份
  const lastLabel = (source, token, pattern, size = 16) => {
    const lead = leadOf(source, token, size);
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const hits = [...lead.matchAll(new RegExp(pattern.source, flags))];
    return hits.length ? hits[hits.length - 1][0] : "";
  };

  // 只认教材常用的标准液体密度：水 1.0×10³、酒精和煤油 0.8×10³ kg/m³；其他液体必须在题目中给出密度
  const standardLiquidDensity = source => {
    const text = source.replace(/水平|水面|水槽|水杯/g, "");
    const named = text.match(/盐水|海水|水银|汽油|柴油|食用油|植物油|花生油|牛奶|蜂蜜|硫酸|煤油|酒精|某种液体|某液体|未知液体|另一种液体/g) || [];
    const kinds = new Set(named);
    if (!kinds.size) return /水/.test(text) ? 1000 : NaN;
    const onlyAlcohol = [...kinds].every(kind => kind === "酒精" || kind === "煤油");
    if (onlyAlcohol && !/水/.test(text.replace(/酒精|煤油/g, ""))) return 800;
    return NaN;
  };
  const liquidDensity = (source, tokens) => {
    const densities = tokensOf(tokens, "density");
    if (densities.length > 1) return NaN;
    return densities.length ? densities[0].value : standardLiquidDensity(source);
  };

  const fixedWithDefaults = (template, fixed = {}) => ({ ...(template.strict?.fixedDefaults || {}), ...(fixed || {}) });
  const askRules = (template, source) => typeof template.strict.asks === "function" ? template.strict.asks(source) : template.strict.asks;
  const intentProblem = (template, source) => {
    const intent = template.strict.intent;
    if (!intent.require.every(pattern => pattern.test(source))) return template.failMessage;
    const blocked = intent.forbid?.find(pattern => pattern.test(source));
    if (blocked) return `题目包含“${source.match(blocked)[0]}”，超出“${template.menuTitle}”模板的建模范围。`;
    return "";
  };
  const rangeOf = (template, index) => template.strict.caps?.[index] || [template.params[index].min, template.params[index].max];
  const rangeProblem = (template, values) => {
    for (const [index, value] of values.entries()) {
      const param = template.params[index];
      const [min, max] = rangeOf(template, index);
      if (!Number.isFinite(value) || value < min - 1e-9 || value > max + 1e-9) {
        return `识别到${param.label}为 ${fmtInput(value)}${param.unit}，超出当前演示范围（${min}–${max}${param.unit}）。`;
      }
    }
    return "";
  };

  // 用模板的数值核对原题：题中每个量都要被模板用到，所问内容模板必须能回答
  const checkQuestion = (template, text, p1, p2, fixed = {}, options = {}) => {
    const G = guard();
    const source = G.normalize(text);
    if (!options.skipIntent) {
      const problem = intentProblem(template, source);
      if (problem) return { ok: false, message: problem };
    }
    const full = fixedWithDefaults(template, fixed);
    const leftovers = G.unconsumed(source, template.strict.used(p1, p2, full), { ignore: template.strict.ignore });
    if (leftovers.length) {
      return { ok: false, message: `题目中的“${leftovers[0].text}”不在“${template.menuTitle}”模板的计算范围内。` };
    }
    const asks = askRules(template, source);
    const answer = G.checkAsks(source, asks.supported, asks.unsupported);
    if (!answer.ok) return { ok: false, message: `“${template.menuTitle}”模板不能直接回答“${answer.item}”。` };
    return { ok: true };
  };

  // 严格解析：条件缺一不可、不夹值、不套默认值；任何一项不满足都返回未匹配，由 AI 继续分析
  const templateParse = (template, text) => {
    const G = guard();
    const source = G.normalize(text);
    const intent = intentProblem(template, source);
    if (intent) return miss(intent);
    const values = template.strict.values(source, G.extractQuantities(source));
    if (!values?.ok) return miss(values?.message || template.failMessage);
    const p1 = G.tidy(values.p1);
    const p2 = G.tidy(values.p2);
    const range = rangeProblem(template, [p1, p2]);
    if (range) return miss(range);
    const fixed = fixedWithDefaults(template, values.fixed);
    const fixedProblem = template.strict.checkFixed?.(fixed, p1, p2);
    if (fixedProblem) return miss(fixedProblem);
    const check = checkQuestion(template, source, p1, p2, fixed, { skipIntent: true });
    if (!check.ok) return miss(check.message);
    const model = template.model(p1, p2, fixed);
    return {
      ok: true,
      subject: "物理",
      type: template.id,
      p1,
      p2,
      fixed,
      message: `已识别：${template.recognition(model)}`,
      recognitionText: template.recognition(model)
    };
  };

  // 参数超出默认滑块范围但在模板允许的上限内时，按数值放宽滑块范围
  const niceBound = (value, up) => {
    const magnitude = 10 ** Math.floor(Math.log10(Math.max(Math.abs(value), 1e-9)));
    const step = magnitude / 2;
    return up ? Math.ceil(value / step) * step : Math.floor(value / step) * step;
  };
  const adaptParam = (template, index, value) => {
    const param = template.params[index];
    if (!template.strict?.caps?.[index]) return { ...param, value };
    const [capMin, capMax] = template.strict.caps[index];
    const min = value < param.min ? Math.max(capMin, niceBound(value, false)) : param.min;
    const max = value > param.max ? Math.min(capMax, niceBound(value * 1.25, true)) : param.max;
    return { ...param, min, max, value };
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
  // 科学记数法只保留到尾数的精确位数，尾数被近似时写“≈”
  const sciEq = value => {
    const number = Number(value);
    if (!Number.isFinite(number) || number === 0) return "=";
    const exp = Math.floor(Math.log10(Math.abs(number)));
    return exp < 4 ? eq(number) : eq(number / 10 ** exp);
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

  function buoyancyDiagram(volumeMl, density, force, weight, reading, weightSource = "assumed") {
    const surface = 250;
    const blockH = 80;
    const immersed = blockH * clamp(volumeMl / 800, 0, 1);
    const blockTop = surface + immersed - blockH;
    const scaleTop = 42;
    // 测力计量程随物重放大（15、30、45……N），指针不会跑出刻度
    const dialMax = [15, 30, 45, 60, 75, 90, 150].find(max => max >= weight - 1e-9) ?? 150;
    const perN = 90 / dialMax;
    const pointerY = scaleTop + 14 + reading * perN;
    const bucketWater = 58 * clamp(volumeMl / 800, 0, 1);
    const tint = clamp((density - 700) / 600, 0, 1);
    const liquid = `rgba(${Math.round(120 - 60 * tint)}, ${Math.round(180 - 40 * tint)}, ${Math.round(236 - 20 * tint)}, ${n2(0.36 + 0.24 * tint)})`;
    const ticks = Array.from({ length: 16 }, (_, index) => {
      const y = scaleTop + 14 + index * 6;
      return `<line class="dg-scale-tick" x1="${index % 5 ? 344 : 340}" y1="${n2(y)}" x2="350" y2="${n2(y)}"/>${index % 5 ? "" : `<text class="dg-scale-num" x="356" y="${n2(y + 4)}">${index * dialMax / 15}</text>`}`;
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
      <text class="dg-value-text" x="300" y="${scaleTop + 80}" text-anchor="end">F示 ${eq(reading)} ${fmt(reading, 2)} N</text>
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
        <text x="12" y="28">${weightSource === "assumed" ? "设物重" : "物重"} G ${eq(weight)} ${fmt(weight, 2)} N</text>
        <text x="12" y="56">F示 ${eq(reading)} ${fmt(reading, 2)} N</text>
        <text x="12" y="84">F浮 = G − F示</text>
        <text class="dg-value-text" x="12" y="114">${eq(force)} ${fmt(force, 2)} N</text>
        <text x="12" y="142">G排 ${eq(force)} ${fmt(force, 2)} N</text>
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
      <text class="dg-small" x="700" y="304" text-anchor="end">长木板 · 动摩擦因数 μ = ${fmt(mu, 2)}</text>
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
      <text class="dg-force-text dg-blue" x="642" y="212">F ${eq(friction)} ${fmt(friction, 2)} N</text>
      <line class="dg-force" x1="296" y1="258" x2="${n2(296 - len)}" y2="258" marker-end="url(#dgArrowRed)"/>
      <text class="dg-force-text" x="${n2(290 - len)}" y="250" text-anchor="end">f ${eq(friction)} ${fmt(friction, 2)} N</text>
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
      <text class="dg-small" x="240" y="392" text-anchor="middle">ρ液 = ${fmt(density)} kg/m³ · p = ρgh ${eq(pressure)} ${fmt(pressure, 0)} Pa</text>`);
  }

  function heatDiagram(mHot, tHot, t, mCold = 200, tCold = 20) {
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
        <text class="dg-value-text" x="${x + width - 36}" y="${base - 172}" text-anchor="end">${mark(temp)}${fmt(temp, 1)} ℃</text>`;
    };
    return diagram("dg-heat", "热水与冷水混合：不计热量损失时热水放出的热量等于冷水吸收的热量", `
      ${caption("不计热量损失：Q放 = Q吸")}
      ${beaker(52, 150, 150, mHot, tHot, `热水 m₁ = ${fmt(mHot)} g`, "rgba(242, 128, 96, .42)")}
      <text class="dg-big" x="226" y="290">+</text>
      ${beaker(262, 150, 150, mCold, tCold, `冷水 m₂ = ${fmt(mCold, 3)} g`, "rgba(96, 160, 236, .42)")}
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
        <text class="dg-value-text" x="12" y="140">${invalid ? "= 读数异常" : `${eq(eta)} ${fmt(eta, 1)}%`}</text>
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
      ? dimension(compressions[0], 36, compressions[0] + lambdaPx, 36, `λ ${eq(wavelength)} ${fmt(wavelength, 2)} m`, compressions[0] + lambdaPx / 2, 30)
      : `<text class="dg-dim-text" x="${stripRight}" y="30" text-anchor="end">λ ${eq(wavelength)} ${fmt(wavelength, 2)} m（大于图示范围）</text>`;
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
      strict: {
        intent: { require: [/杠杆/], forbid: [/滑轮|轮轴|斜面|机械效率|功率|做功|钩码重|每个钩码/, /斜向|斜拉|斜着|与杠杆成|与水平方向成|与竖直方向成|夹角|成\s*\d+(?:\.\d+)?\s*°/] },
        fixedDefaults: { load: 6, loadArm: 20 },
        values(source, tokens) {
          const forces = tokensOf(tokens, "force");
          const lengths = tokensOf(tokens, "length");
          if (forces.length !== 2 || lengths.length !== 2) return miss("当前杠杆模板需要左右两侧的力和力臂。");
          const side = token => {
            // 题目只标右侧（阻力）时，其余的力和力臂按左侧（动力）处理；右侧必须恰好各一个
            const label = lastLabel(source, token, /左|右|动力|阻力|F1|F2|重物|拉力/, 12);
            return /右|阻力|F2|重物/.test(label) ? "right" : "left";
          };
          const rightForce = forces.filter(token => side(token) === "right");
          const leftForce = forces.filter(token => side(token) === "left");
          const rightArm = lengths.filter(token => side(token) === "right");
          const leftArm = lengths.filter(token => side(token) === "left");
          if ([rightForce, leftForce, rightArm, leftArm].some(list => list.length !== 1)) return miss("当前杠杆模板需要分清左侧（动力）与右侧（阻力）的力和力臂。");
          return { ok: true, p1: leftForce[0].value, p2: leftArm[0].value * 100, fixed: { load: rightForce[0].value, loadArm: rightArm[0].value * 100 } };
        },
        checkFixed: (fixed, p1) => Math.abs(fixed.load - 6) > 1e-9 || Math.abs(fixed.loadArm - 20) > 1e-9
          ? "当前杠杆模板右侧固定为 6N 重物、阻力臂 20cm。"
          : !Number.isInteger(p1) ? "当前杠杆模板按每个钩码 1N 演示，左侧的力需为整数牛。" : "",
        used: (p1, p2, fixed) => [{ cls: "force", value: p1 }, { cls: "length", value: p2 / 100 }, { cls: "force", value: fixed.load }, { cls: "length", value: fixed.loadArm / 100 }],
        asks: { supported: /平衡|下沉|倾斜|转动|哪(?:一)?端|偏/, unsupported: /多少|多大|多长|几个|大小|距离/ }
      },
      failMessage: "当前杠杆模板需要识别拉力和力臂，例如：左侧拉力4N，力臂30cm。",
      question: (p1, p2) => `杠杆右侧挂 6N 重物，阻力臂为 20cm。若左侧施加 ${fmtInput(p1)}N 的力，力臂为 ${fmtInput(p2)}cm，请判断杠杆是否平衡。`,
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
      strict: {
        intent: { require: [/凸透镜|放大镜/], forbid: [/凹透镜|平面镜|小孔|凹面镜|凸面镜|眼镜|近视|远视|两个透镜|透镜组/] },
        values(source, tokens) {
          const lengths = tokensOf(tokens, "length");
          if (lengths.length !== 2) return miss("当前凸透镜模板需要物距和焦距。");
          const isFocal = token => /焦距|f/.test(lastLabel(source, token, /焦距|物距|f|u|物体|蜡烛|透镜前|放在|置于|距|离/, 10));
          const focal = lengths.filter(isFocal);
          const object = lengths.filter(token => !isFocal(token));
          if (focal.length !== 1 || object.length !== 1) return miss("当前凸透镜模板需要物距和焦距。");
          if (!lastLabel(source, object[0], /物距|u|物体|蜡烛|透镜前|放在|置于|距|离/, 16)) return miss("当前凸透镜模板需要明确的物距。");
          return { ok: true, p1: object[0].value * 100, p2: focal[0].value * 100 };
        },
        used: (u, f) => [{ cls: "length", value: u / 100 }, { cls: "length", value: f / 100 }],
        asks: { supported: /像距|像的|成像|成什么|什么(?:样的)?像|倒立|正立|放大|缩小|实像|虚像|应用|照相机|投影仪|幻灯机|放大镜|像在/, unsupported: /像高|物高|放大率|倍数|焦距(?:是|为)?多|物距(?:是|为)?多|光屏(?:应|要|需)?(?:向|往)|移动/ }
      },
      failMessage: "当前凸透镜模板需要识别物距和焦距，例如：物距30cm，焦距10cm。",
      question: (p1, p2) => `将物体放在凸透镜前 ${fmtInput(p1)}cm 处，凸透镜焦距为 ${fmtInput(p2)}cm。请判断像距和成像性质。`,
      model: (u, f) => {
        const rule = lensRule(u, f);
        const v = rule.key === "focus" ? null : (u * f) / (u - f);
        const vText = v === null ? "不成像" : rule.key === "virtual" ? `虚像距透镜${about(v) ? "约 " : " "}${fmt(Math.abs(v), 1)}cm` : `${about(v)}${fmt(v, 1)}cm`;
        const computed = v === null ? "" : `（拓展：由透镜成像公式 1/u + 1/v = 1/f 计算，${rule.key === "virtual" ? `虚像距透镜${about(v) ? "约 " : " "}${fmt(Math.abs(v), 1)}cm` : `v ${eq(v)} ${fmt(v, 1)}cm`}）`;
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
      strict: {
        intent: { require: [/浮力|阿基米德/], forbid: [/漂浮|悬浮|露出|一半|部分|沉底|下沉|上浮|密度计|轮船|潜水艇|气球|飞艇|压力差|上下表面/] },
        fixedDefaults: { g: G, weight: 12 },
        values(source, tokens) {
          const volumes = tokensOf(tokens, "volume");
          if (volumes.length !== 1) return miss("当前浮力模板需要排开液体的体积。");
          const label = lastLabel(source, volumes[0], /排开|排出|溢出|V排|体积/, 16);
          const displaced = /排开|排出|溢出|V排/.test(label) || (label === "体积" && /浸没|全部浸入|完全浸入/.test(source));
          if (!displaced) return miss("当前浮力模板需要明确的排开液体体积（或浸没时物体的体积）。");
          const density = liquidDensity(source, tokens);
          if (!Number.isFinite(density)) return miss("当前浮力模板需要液体密度（水、酒精、煤油可直接识别）。");
          const gravity = guard().gravityOf(source);
          if (!Number.isFinite(gravity.value)) return miss("题目中的 g 取值无法识别。");
          const fixed = { g: gravity.value, weightSource: tokensOf(tokens, "force").length ? "given" : "assumed" };
          // 题目点名的金属块（浸没时 V物 = V排）按教材密度表算出物重，演示与题中物体一致
          const metal = source.match(/(铝|铁|钢|铜|铅)(?:块|球|柱|锭|片|圆柱体|立方体|制|质)/);
          if (metal && fixed.weightSource === "assumed") {
            if (/空心/.test(source)) return miss("空心物体的重力无法由体积求出。");
            if (!/浸没|全部浸入|完全浸入/.test(source)) return miss("金属块没有完全浸没时，物体体积与排开液体的体积不同，模板无法求出物重。");
            const rho = { 铝: 2700, 铁: 7900, 钢: 7900, 铜: 8900, 铅: 11300 }[metal[1]];
            Object.assign(fixed, { weightSource: "material", material: metal[1], materialDensity: rho, weight: rho * gravity.value * volumes[0].value * 1e-6 });
          }
          return { ok: true, p1: volumes[0].value, p2: density, fixed };
        },
        used: (volumeMl, density, fixed) => [{ cls: "volume", value: volumeMl }, { cls: "density", value: density }, { cls: "g", value: fixed.g }, { cls: "force", value: fixed.weight }],
        asks: { supported: /浮力|F浮|阿基米德|排开(?:的)?(?:液体|水)?(?:的)?(?:重力|重)|G排/, unsupported: /密度|质量|示数|拉力|物重|体积/ }
      },
      failMessage: "当前浮力模板需要识别排液体积和液体密度，例如：排开300mL，液体密度1000kg/m³。",
      question: (p1, p2, fixed = {}) => `一个物体浸入液体后排开 ${fmtInput(p1)}mL 液体，液体密度为 ${fmtInput(p2)}kg/m³${gravityClause(fixed)}。请计算浮力并验证阿基米德原理。`,
      model: (volumeMl, density, fixed = {}) => {
        const g = fixed.g ?? G;
        const force = density * g * volumeMl * 1e-6;
        const objectWeight = fixed.weight ?? 12;
        const apparent = objectWeight - force;
        return {
          visual: "visual-buoyancy",
          metrics: [volumeMl, density, force],
          metricUnit: "N",
          objectWeight,
          facts: fixed.weightSource === "assumed"
            ? [fact("浮力 F浮", `${mark(force)}${fmt(force, 2)} N`), fact("排开液体重 G排", `${mark(force)}${fmt(force, 2)} N`), fact("验证", "F浮 = G排")]
            : [fact("浮力 F浮", `${mark(force)}${fmt(force, 2)} N`), fact("测力计示数 F示", `${mark(apparent)}${fmt(apparent, 2)} N`), fact("验证", "F浮 = G排")],
          weightSource: fixed.weightSource || "assumed",
          conclusion: `${fixed.weightSource === "material"
            ? `${fixed.material}块重 G = ρ${fixed.material}gV ${eq(objectWeight)} ${fmt(objectWeight, 2)}N（查密度表 ρ${fixed.material} = ${sci(fixed.materialDensity)}kg/m³）`
            : fixed.weightSource === "given" ? `物重 G = ${fmt(objectWeight)}N` : `演示中假设物重 G = ${fmt(objectWeight)}N（题目未给出物重）`}，浸入后测力计示数 F示 ${eq(apparent)} ${fmt(apparent, 2)}N，F浮 = G − F示 ${eq(force)} ${fmt(force, 2)}N；排开液体重 G排 ${eq(force)} ${fmt(force, 2)}N，F浮 = G排。`,
          formula: "F浮 = G排 = ρ液gV排",
          formulaDetail: `F浮 = ρ液gV排 = ${fmtInput(density)} kg/m³ × ${fmtInput(g)} N/kg × ${fmtInput(volumeMl)}×10⁻⁶ m³ ${eq(force)} ${fmt(force, 2)} N`,
          readout: `F浮 ${eq(force)} ${fmt(force, 2)}N`,
          badge: "阿基米德原理"
        };
      },
      visual: model => genericShell(model, buoyancyDiagram(model.metrics[0], model.metrics[1], model.metrics[2], model.objectWeight, model.objectWeight - model.metrics[2], model.weightSource)),
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
      strict: {
        intent: { require: [/摩擦/], forbid: [/静摩擦|静止|没有拉动|未拉动|没拉动|拉不动|斜面|倾角|竖直|墙|叠放|上面放|两个|加速|减速|刹车|滚动/] },
        values(source, tokens) {
          const forces = tokensOf(tokens, "force");
          const coefs = tokensOf(tokens, "coef");
          if (forces.length !== 1 || coefs.length !== 1) return miss("当前摩擦力模板需要压力和动摩擦因数。");
          if (!/压力/.test(lastLabel(source, forces[0], /压力|拉力|重力|重|F/, 10))) return miss("当前摩擦力模板需要明确的压力。");
          return { ok: true, p1: forces[0].value, p2: coefs[0].value };
        },
        used: (normal, mu) => [{ cls: "force", value: normal }, { cls: "coef", value: mu }],
        asks: source => ({
          supported: /匀速/.test(source) && /水平/.test(source) ? /摩擦力|f(?:的)?大小|示数|拉力/ : /摩擦力|f(?:的)?大小/,
          unsupported: /加速度|速度|功|时间|压力(?:是|为)?多|因数|系数/
        })
      },
      failMessage: "当前摩擦力模板需要识别压力和动摩擦因数，例如：压力10N，动摩擦因数0.3。",
      question: (p1, p2) => `用弹簧测力计水平匀速拉动木块，木块对木板的压力为 ${fmtInput(p1)}N，动摩擦因数为 ${fmtInput(p2)}。求滑动摩擦力。`,
      model: (normal, mu) => {
        const friction = normal * mu;
        return {
          visual: "visual-friction",
          metrics: [normal, mu, friction],
          metricUnit: "N",
          facts: [fact("滑动摩擦力 f", `${mark(friction)}${fmt(friction, 2)} N`), fact("测量方法", "匀速拉动时 F = f"), fact("控制变量", "压力 / 接触面粗糙程度")],
          conclusion: `匀速直线拉动时，拉力与滑动摩擦力是一对平衡力，弹簧测力计示数等于滑动摩擦力，${about(friction) ? "约为" : "为"} ${fmt(friction, 2)}N。`,
          formula: "f = μF压",
          formulaDetail: `f = μF压 = ${fmtInput(mu)} × ${fmtInput(normal)} N ${eq(friction)} ${fmt(friction, 2)} N`,
          readout: `f ${eq(friction)} ${fmt(friction, 2)}N`,
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
      strict: {
        intent: { require: [/灯泡|小灯/], forbid: [/两(?:个|只|盏)|并联|电能|消耗|时间|分钟|小时|秒|电热|焦耳|千瓦时|kW/] },
        fixedDefaults: { rated: 2.5, ratedStated: true },
        values(source, tokens) {
          const volts = tokensOf(tokens, "voltage");
          const amps = tokensOf(tokens, "current");
          if (/标有|铭牌/.test(source)) {
            if (!/正常发光|正常工作/.test(source)) return miss("铭牌上是额定值，灯泡不正常发光时实际电流未知，模板不能计算实际功率。");
            if (volts.length !== 1 || amps.length !== 1) return miss("当前小灯泡功率模板需要铭牌上的额定电压和额定电流。");
            if (Math.abs(volts[0].value - 2.5) > 1e-9) return miss("当前小灯泡功率模板按额定电压 2.5V 的小灯泡演示。");
            return { ok: true, p1: volts[0].value, p2: amps[0].value, fixed: { ratedStated: true, nameplate: true } };
          }
          if (amps.length !== 1 || !volts.length || volts.length > 2) return miss("当前小灯泡功率模板需要灯泡两端的电压和通过的电流。");
          const isRated = token => /额定/.test(leadOf(source, token, 8));
          const rated = volts.filter(isRated);
          const actual = volts.filter(token => !isRated(token));
          if (rated.length > 1 || actual.length > 1) return miss("当前小灯泡功率模板需要灯泡两端的电压和通过的电流。");
          if (rated.length && Math.abs(rated[0].value - 2.5) > 1e-9) return miss("当前小灯泡功率模板按额定电压 2.5V 的小灯泡演示。");
          if (!actual.length && !/正常发光|正常工作/.test(source)) return miss("需要灯泡两端的实际电压。");
          const u = actual.length ? actual[0].value : rated[0].value;
          const asks = guard().askItems(source);
          if (asks.some(item => /额定功率/.test(item)) && Math.abs(u - 2.5) > 1e-9) return miss("实际电压不等于额定电压时，模板不能直接给出额定功率。");
          if (!rated.length && asks.some(item => /亮|暗|发光/.test(item))) return miss("题目没有给出额定电压，无法判断亮度与正常发光相比如何。");
          return { ok: true, p1: u, p2: amps[0].value, fixed: { ratedStated: rated.length > 0 } };
        },
        used: (u, i, fixed) => [{ cls: "voltage", value: u }, { cls: "current", value: i }, { cls: "voltage", value: fixed.rated }],
        asks: { supported: /功率|亮度|亮暗|明暗|发光|亮/, unsupported: /电阻|电能|电流(?:是|为)?多|电压(?:是|为)?多/ }
      },
      failMessage: "当前小灯泡功率模板需要识别电压和电流，例如：电压2.5V，电流0.3A。",
      question: (p1, p2) => `测量额定电压为 2.5V 的小灯泡电功率时，电压表示数为 ${fmtInput(p1)}V，电流表示数为 ${fmtInput(p2)}A。求小灯泡实际功率，并判断亮度变化。`,
      model: (u, i, fixed = {}) => {
        const power = u * i;
        const ratedVoltage = fixed.rated ?? 2.5;
        const ratedKnown = fixed.ratedStated !== false;
        const atRated = Math.abs(u - ratedVoltage) <= 1e-9;
        // 同一灯泡：实际电压低于额定电压时实际功率小于额定功率，亮度比正常发光暗；反之更亮
        const rated = !ratedKnown ? "未给出额定电压" : atRated ? "等于额定电压" : u > ratedVoltage ? "高于额定电压" : "低于额定电压";
        const brightness = !ratedKnown ? "无法判断" : atRated ? "正常发光" : u > ratedVoltage ? "比正常发光亮" : "比正常发光暗";
        return {
          visual: "visual-lamp",
          metrics: [u, i, power],
          metricUnit: "W",
          facts: [fact("实际功率", `${mark(power)}${fmt(power, 3)} W`), fact("电压状态", rated), fact("亮度", brightness)],
          conclusion: ratedKnown
            ? `小灯泡两端电压 ${fmtInput(u)}V、通过的电流 ${fmtInput(i)}A，实际功率 P = UI ${eq(power)} ${fmt(power, 3)}W${atRated ? "（正常发光，等于额定功率）" : ""}；实际电压${rated.replace("额定电压", "")}额定电压 ${fmtInput(ratedVoltage)}V，灯泡${brightness}。`
            : `小灯泡两端电压 ${fmtInput(u)}V、通过的电流 ${fmtInput(i)}A，实际功率 P = UI ${eq(power)} ${fmt(power, 3)}W；题目未给出额定电压，无法与正常发光比较亮度。`,
          formula: "P = UI",
          formulaDetail: `P = UI = ${fmtInput(u)} V × ${fmtInput(i)} A ${eq(power)} ${fmt(power, 3)} W`,
          readout: `P ${eq(power)} ${fmt(power, 3)}W`,
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
      strict: {
        intent: { require: [/串联/], forbid: [/并联|R3|三个电阻|灯泡|小灯|电动机|内阻|电动势|功率|电热|电能|焦耳|最大|最小|范围|允许|保护|量程|短路|断路/, /电压表[^。；？]{0,12}(?:R1|R₁|定值电阻)|(?:R1|R₁|定值电阻)[^。；？]{0,10}电压表/] },
        fixedDefaults: { r1: 4 },
        values(source, tokens) {
          const volts = tokensOf(tokens, "voltage");
          // 同一阻值在所问部分再次出现（如“求 8Ω 电阻两端电压”）时只算一次
          const ohms = tokensOf(tokens, "resistance").filter((token, index, list) => list.findIndex(other => Math.abs(other.value - token.value) < 1e-9) === index);
          if (volts.length !== 1 || ohms.length !== 2) return miss("当前串联电路模板需要电源电压以及 R₁、R₂ 的阻值。");
          const voltLabel = lastLabel(source, volts[0], /电压表|示数|电源|总电压|两端|接在|接入|电压|U/, 14);
          if (!voltLabel || /电压表|示数/.test(voltLabel)) return miss("当前串联电路模板需要电源（总）电压。");
          const role = token => {
            const label = lastLabel(source, token, /R1|R2|定值电阻|滑动变阻器|变阻器|滑变/, 14);
            return /R2|变阻器|滑变/.test(label) ? "r2" : label ? "r1" : "";
          };
          let r1 = ohms.filter(token => role(token) === "r1");
          let r2 = ohms.filter(token => role(token) === "r2");
          if (r1.length > 1 || r2.length > 1) return miss("当前串联电路模板需要分清 R₁ 和 R₂。");
          if (!r1.length && !r2.length) { r1 = [ohms[0]]; r2 = [ohms[1]]; }
          if (!r1.length) r1 = ohms.filter(token => token !== r2[0]);
          if (!r2.length) r2 = ohms.filter(token => token !== r1[0]);
          if (r1.length !== 1 || r2.length !== 1) return miss("当前串联电路模板需要分清 R₁ 和 R₂。");
          return { ok: true, p1: volts[0].value, p2: r2[0].value, fixed: { r1: r1[0].value } };
        },
        checkFixed: fixed => fixed.r1 < 1 || fixed.r1 > 20 ? `识别到 R₁ = ${fmtInput(fixed.r1)}Ω，超出当前演示范围（1–20Ω）。` : "",
        used: (u, r2, fixed) => [{ cls: "voltage", value: u }, { cls: "resistance", value: r2 }, { cls: "resistance", value: fixed.r1 }],
        asks: { supported: /电流|电压|示数|总电阻|等效电阻|变化|变大|变小|怎样变|如何变|之比|分压/, unsupported: /功率|电能|电热|热量|最大|最小|范围|(?<!总|等效)电阻(?:是|为)?多|阻值(?:是|为)?多/ }
      },
      failMessage: "当前串联动态模板需要识别电源电压和滑动变阻器阻值，例如：电源6V，滑变8Ω。",
      question: (p1, p2, fixed = {}) => `R₁=${fmtInput(fixed.r1 ?? 4)}Ω 与滑动变阻器 R₂ 串联，电源电压为 ${fmtInput(p1)}V，R₂ 接入电路的阻值为 ${fmtInput(p2)}Ω。求电路电流和 R₂ 两端电压。`,
      model: (u, r2, fixed = {}) => {
        const r1 = fixed.r1 ?? 4;
        const current = u / (r1 + r2);
        const v1 = current * r1;
        const v2 = current * r2;
        return {
          visual: "visual-series",
          r1,
          metrics: [u, r2, current],
          metricUnit: "A",
          facts: [
            fact("电流", `${mark(current)}${fmt(current, 3)} A`),
            fact("总电阻", `${fmtInput(r1 + r2)} Ω`),
            fact("电压分配", `U₁ ${mark(v1)}${fmt(v1, 2)} V · U₂ ${mark(v2)}${fmt(v2, 2)} V`)
          ],
          conclusion: `串联总电阻 ${fmtInput(r1 + r2)}Ω，电流${about(current) ? "约为" : "为"} ${fmt(current, 3)}A；R₁ 两端电压${about(v1) ? "约为" : "为"} ${fmt(v1, 2)}V，R₂ 两端电压${about(v2) ? "约为" : "为"} ${fmt(v2, 2)}V。`,
          formula: "I = U / (R₁ + R₂)",
          formulaDetail: `I = U/(R₁ + R₂) = ${fmtInput(u)} V ÷ (${fmtInput(r1)} Ω + ${fmtInput(r2)} Ω) ${eq(current)} ${fmt(current, 3)} A`,
          readout: `I ${eq(current)} ${fmt(current, 3)}A`,
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
                <text x="46" y="21" text-anchor="middle">${fmt(current, 3)}A</text>
              </g>
            </g>

            <g class="edu-resistor" aria-label="定值电阻 R1">
              <rect class="resistor-body" x="200" y="252" width="120" height="36"></rect>
              <text class="component-body-value" x="260" y="276" text-anchor="middle">R₁ = ${fmtInput(model.r1)}Ω</text>
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
                <text x="56" y="21" text-anchor="middle">U₂ ${eq(v2)} ${fmt(v2, 2)}V</text>
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
      strict: {
        intent: { require: [/混合/, /热水/, /冷水/], forbid: [/金属|铁块|铜块|铝块|铅块|煤油|酒精|沙|冰|熔化|汽化|沸腾|加热|电热|燃烧|燃料|热值|效率|损失了|损失为|散失|吸收了|放出了/] },
        fixedDefaults: { mCold: 200, tCold: 20 },
        values(source) {
          const parts = { 热水: [], 冷水: [] };
          const grams = (value, unit) => /kg|千克/.test(unit) ? Number(value) * 1000 : Number(value);
          const lead = /(\d+(?:\.\d+)?)\s*(kg|g|千克|克)\s*[、，,和]?\s*(?:温度为|初温为|温度是|初温是|初温|温度)?\s*(-?\d+(?:\.\d+)?)\s*℃\s*(?:的)?\s*(热水|冷水)/g;
          const trail = /(热水|冷水)\s*(?:的)?\s*(?:质量)?\s*(?:为|是|=|:)?\s*(\d+(?:\.\d+)?)\s*(kg|g|千克|克)\s*[、，,]?\s*(?:温度|初温)?\s*(?:为|是|=|:)?\s*(-?\d+(?:\.\d+)?)\s*℃/g;
          for (const match of source.matchAll(lead)) parts[match[4]].push({ mass: grams(match[1], match[2]), temp: Number(match[3]) });
          for (const match of source.matchAll(trail)) parts[match[1]].push({ mass: grams(match[2], match[3]), temp: Number(match[4]) });
          if (parts.热水.length !== 1 || parts.冷水.length !== 1) return miss("当前热平衡模板需要热水和冷水各自的质量与初温。");
          return { ok: true, p1: parts.热水[0].mass, p2: parts.热水[0].temp, fixed: { mCold: parts.冷水[0].mass, tCold: parts.冷水[0].temp } };
        },
        checkFixed: (fixed, mHot, tHot) => fixed.mCold < 50 || fixed.mCold > 500 ? "冷水质量超出当前演示范围（50–500g）。"
          : fixed.tCold < 0 || fixed.tCold >= tHot ? "冷水初温需不低于 0℃ 且低于热水初温。"
          : mHot + fixed.mCold > 780 ? "热水与冷水总质量超出当前演示范围（780g）。" : "",
        used: (mHot, tHot, fixed) => [{ cls: "mass", value: mHot / 1000 }, { cls: "temperature", value: tHot }, { cls: "mass", value: fixed.mCold / 1000 }, { cls: "temperature", value: fixed.tCold }, { cls: "specificHeat", value: 4200 }],
        asks: { supported: /混合后|末温|最终温度|热平衡|共同温度|温度|热量|Q放|Q吸/, unsupported: /比热容|质量(?:是|为)?多|初温(?:是|为)?多|降低了多少|升高了多少|变化了多少|降低多少|升高多少|降低了几|升高了几|温度变化|Δt/ }
      },
      failMessage: "当前热平衡模板需要识别热水质量和热水初温，例如：热水100g，初温80℃。",
      question: (p1, p2, fixed = {}) => `将 ${fmtInput(p1)}g、${fmtInput(p2)}℃ 的热水与 ${fmtInput(fixed.mCold ?? 200)}g、${fmtInput(fixed.tCold ?? 20)}℃ 的冷水混合，不计热量损失，求热平衡温度。`,
      model: (mHot, tHot, fixed = {}) => {
        const mCold = fixed.mCold ?? 200;
        const tCold = fixed.tCold ?? 20;
        const t = (mHot * tHot + mCold * tCold) / (mHot + mCold);
        const q = 4.2 * mHot * (tHot - t);
        return {
          visual: "visual-heat",
          mCold,
          tCold,
          metrics: [mHot, tHot, t],
          metricUnit: "℃",
          facts: [fact("混合后温度 t", `${mark(t)}${fmt(t, 1)}℃`), fact("Q放 = Q吸", `${sciEq(q) === "≈" ? "≈" : ""}${sci(q)} J`), fact("条件", "不计热量损失")],
          conclusion: `不计热量损失时，热水放出的热量等于冷水吸收的热量，Q吸 = Q放 ${sciEq(q)} ${sci(q)} J；混合后温度${about(t) ? "约为" : "为"} ${fmt(t, 1)}℃。`,
          formula: "Q放 = Q吸，Q = cmΔt",
          formulaDetail: `c水m₁(t₁ − t) = c水m₂(t − t₂)，得 t ${eq(t)} ${fmt(t, 1)}℃；${exactPlaces(tHot - t) === null ? `Q吸 = Q放 = c水m₁(t₁ − t) ${sciEq(q)} ${sci(q)} J` : `Q吸 = Q放 = 4.2×10³ J/(kg·℃) × ${fmt(mHot / 1000, 3)} kg × ${fmt(tHot - t, 1)}℃ ${sciEq(q)} ${sci(q)} J`}`,
          readout: `t ${eq(t)} ${fmt(t, 1)}℃`,
          badge: "热量守恒"
        };
      },
      visual: model => genericShell(model, heatDiagram(model.metrics[0], model.metrics[1], model.metrics[2], model.mCold, model.tCold)),
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
      keywords: /液体压强|压强计|压强|深度|p=ρgh|rho|盐水|水银/,
      params: [
        { label: "探头深度 h", desc: "调整探头到液面的深度", unit: "cm", min: 5, max: 100, step: 5, value: 30 },
        { label: "液体密度 ρ", desc: "调整液体种类或密度", unit: "kg/m³", min: 700, max: 1300, step: 50, value: 1000 }
      ],
      strict: {
        intent: { require: [/压强/], forbid: [/压力(?!计)|大气压|气压|连通器|面积|固体|托里拆利|高度差(?:是|为)?多/] },
        fixedDefaults: { g: G },
        values(source, tokens) {
          const lengths = tokensOf(tokens, "length");
          if (lengths.length !== 1) return miss("当前液体压强模板需要一个深度值。");
          const near = leadOf(source, lengths[0], 12) + tailOf(source, lengths[0], 4);
          if (!/深度|深|h|水下|液面下|水面下|液体中|水中/.test(near)) return miss("当前液体压强模板需要探头所在的深度。");
          const density = liquidDensity(source, tokens);
          if (!Number.isFinite(density)) return miss("当前液体压强模板需要液体密度（水、酒精、煤油可直接识别）。");
          const gravity = guard().gravityOf(source);
          if (!Number.isFinite(gravity.value)) return miss("题目中的 g 取值无法识别。");
          return { ok: true, p1: lengths[0].value * 100, p2: density, fixed: { g: gravity.value } };
        },
        used: (hCm, rho, fixed) => [{ cls: "length", value: hCm / 100 }, { cls: "density", value: rho }, { cls: "g", value: fixed.g }],
        asks: { supported: /压强|p(?:的)?大小/, unsupported: /压力|深度(?:是|为)?多|密度(?:是|为)?多/ }
      },
      failMessage: "当前液体压强模板需要识别深度和液体密度，例如：深度30cm，密度1000kg/m³。",
      question: (p1, p2, fixed = {}) => `将压强计探头放入液体中，深度为 ${fmtInput(p1)}cm，液体密度为 ${fmtInput(p2)}kg/m³${gravityClause(fixed)}。求该处液体压强。`,
      model: (hCm, rho, fixed = {}) => {
        const g = fixed.g ?? G;
        const p = rho * g * hCm / 100;
        return {
          visual: "visual-pressure",
          metrics: [hCm, rho, p],
          metricUnit: "Pa",
          facts: [fact("液体压强 p", `${mark(p)}${fmt(p, 0)} Pa`), fact("影响因素", "液体密度 ρ 与深度 h"), fact("规律", "同深度各方向相等")],
          conclusion: `液体内部压强随深度和液体密度增大而增大，此处压强${about(p) ? "约为" : "为"} ${fmt(p, 0)}Pa。`,
          formula: "p = ρgh",
          formulaDetail: `p = ρgh = ${fmtInput(rho)} kg/m³ × ${fmtInput(g)} N/kg × ${fmtInput(hCm / 100)} m ${eq(p)} ${fmt(p, 0)} Pa`,
          readout: `p ${eq(p)} ${fmt(p, 0)}Pa`,
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
      strict: {
        intent: { require: [/滑轮组/], forbid: [/斜面|杠杆|动滑轮(?:的)?重|滑轮(?:的)?重|摩擦(?:力)?为|功率|时间|速度|水平(?:地面|面|方向)|拉动物体/] },
        fixedDefaults: { n: 3 },
        caps: [[1, 2000], [1, 2000]],
        values(source, tokens) {
          const forces = tokensOf(tokens, "force");
          if (forces.length !== 2) return miss("当前机械效率模板需要物重和绳端拉力。");
          const role = token => {
            const label = lastLabel(source, token, /拉力|绳端|自由端|用力|施加|F|物重|重物|重力|重|G|物体/, 12);
            return /拉力|绳端|自由端|用力|施加|F/.test(label) ? "pull" : label ? "load" : "";
          };
          const pull = forces.filter(token => role(token) === "pull");
          const load = forces.filter(token => role(token) === "load");
          if (pull.length !== 1 || load.length !== 1) return miss("当前机械效率模板需要分清物重和绳端拉力。");
          const counts = tokensOf(tokens, "count");
          if (counts.length > 1) return miss("承担物重的绳子段数不明确。");
          let n = counts.length ? counts[0].value : null;
          const lengths = tokensOf(tokens, "length");
          let h = null;
          let s = null;
          if (lengths.length) {
            if (lengths.length !== 2) return miss("当前机械效率模板需要同时给出物体上升高度和绳端移动距离。");
            const isRope = token => /绳|自由端|拉过|拉下|移动/.test(lastLabel(source, token, /绳|自由端|拉过|拉下|移动|物体|上升|提升|升高|高/, 12));
            const rope = lengths.filter(isRope);
            const lift = lengths.filter(token => !isRope(token));
            if (rope.length !== 1 || lift.length !== 1) return miss("当前机械效率模板需要分清物体上升高度和绳端移动距离。");
            s = rope[0].value;
            h = lift[0].value;
            const ratio = s / h;
            if (n === null) n = ratio;
            else if (Math.abs(n - ratio) > 1e-9) return miss("绳端移动距离与承担物重的绳子段数不一致。");
          }
          if (n === null) return miss("当前机械效率模板需要承担物重的绳子段数（或绳端移动距离与物体上升高度）。");
          if (Math.abs(n - 3) > 1e-9) return miss("当前滑轮组图示为 3 段绳承担物重。");
          if (load[0].value / (3 * pull[0].value) > 1 + 1e-9) return miss("按三段绳计算的机械效率超过 100%，题目数据不符合实际。");
          return { ok: true, p1: load[0].value, p2: pull[0].value, fixed: { n: 3, h, s } };
        },
        used: (load, force, fixed) => [
          { cls: "force", value: load },
          { cls: "force", value: force },
          { cls: "count", value: 3 },
          Number.isFinite(fixed.h) && { cls: "length", value: fixed.h },
          Number.isFinite(fixed.s) && { cls: "length", value: fixed.s }
        ],
        asks: { supported: /机械效率|效率|η/, unsupported: /有用功|总功|额外功|功率|动滑轮|拉力(?:是|为)?多|速度|时间|物重(?:是|为)?多/ }
      },
      failMessage: "当前机械效率模板需要识别物重和绳端拉力，例如：物重30N，拉力12N。",
      question: (p1, p2) => `用三段绳承担重物的滑轮组提升物体，物重 ${fmtInput(p1)}N，绳端拉力 ${fmtInput(p2)}N。求机械效率。`,
      model: (load, force) => {
        const n = 3;
        const rawEta = load / (n * force);
        const eta = clamp(rawEta, 0, 1);
        const etaText = rawEta > 1 ? "超过100%（读数异常）" : `${mark(rawEta * 100)}${fmt(rawEta * 100, 1)}%`;
        const conclusion = rawEta > 1
          ? "机械效率不可能超过 100%，该组读数说明拉力、承担绳段或实验记录需要复核。"
          : `s = 3h，η = W有/W总 = Gh/(Fs) = G/(3F)，该滑轮组机械效率${about(rawEta * 100) ? "约为" : "为"} ${fmt(rawEta * 100, 1)}%。`;
        return {
          visual: "visual-efficiency",
          metrics: [load, force, rawEta * 100],
          metricUnit: "%",
          facts: [fact("机械效率 η", etaText), fact("承担物重的绳子段数", "n = 3"), fact("额外功 W额", rawEta <= 1 ? "W额 > 0" : "读数需复核")],
          conclusion,
          formula: "η = W有 / W总 = Gh / Fs",
          formulaDetail: `η = G/(3F) = ${fmtInput(load)} N ÷ (3 × ${fmtInput(force)} N) × 100% ${eq(rawEta * 100)} ${fmt(rawEta * 100, 1)}%`,
          readout: rawEta > 1 ? "读数需复核" : `η ${eq(rawEta * 100)} ${fmt(rawEta * 100, 1)}%`,
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
      strict: {
        intent: { require: [/声|音/], forbid: [/回声|超声|次声|水中|钢|铁管|固体|液体中|传播时间|多远|距离|声速(?:是|为)?多|光速|闪电|雷|分贝|dB/, /(?:若|如果|假如|当)[^。？]*?(?:提高|增大|降低|减小|增加|减少|变大|变小|加快|变慢|变为|变成)/] },
        values(source, tokens) {
          const freqs = tokensOf(tokens, "frequency");
          const amps = tokensOf(tokens, "percent");
          if (freqs.length !== 1 || amps.length !== 1 || !/振幅/.test(leadOf(source, amps[0], 8))) return miss("当前声音模板需要频率和以百分比表示的振幅。");
          const speeds = tokensOf(tokens, "speed");
          if (speeds.length > 1 || (speeds.length && Math.abs(speeds[0].value - AIR_SPEED) > 1e-9)) return miss("当前声音模板按空气中声速 340m/s 计算。");
          return { ok: true, p1: freqs[0].value, p2: amps[0].value };
        },
        used: (freq, amp) => [{ cls: "frequency", value: freq }, { cls: "percent", value: amp }, { cls: "speed", value: AIR_SPEED }],
        asks: { supported: /音调|响度|波长|λ|高低|强弱|大小/, unsupported: /频率(?:是|为)?多|周期|时间|距离|声速/ }
      },
      failMessage: "当前声音模板需要识别频率和振幅，例如：频率440Hz，振幅50%。",
      question: (p1, p2) => `声源频率为 ${fmtInput(p1)}Hz，振幅为 ${fmtInput(p2)}%。按空气中声速约 340m/s，判断音调、响度并估算波长。`,
      model: (freq, amp) => {
        const wavelength = AIR_SPEED / freq;
        return {
          visual: "visual-sound",
          metrics: [freq, amp, wavelength],
          metricUnit: "m",
          facts: [fact("波长 λ（拓展）", `${mark(wavelength)}${fmt(wavelength, 2)} m`), fact("音调", freq > 600 ? "较高" : freq < 260 ? "较低" : "中等"), fact("响度", amp > 70 ? "较大" : amp < 30 ? "较小" : "中等")],
          conclusion: `音调与频率有关，频率越高音调越高；响度与振幅有关，振幅越大响度越大。按空气中声速约 340m/s 估算，波长${about(wavelength) ? "约为" : "为"} ${fmt(wavelength, 2)}m。`,
          formula: "音调 ← 频率 f；响度 ← 振幅 A；v = λf",
          formulaDetail: `λ = v / f = 340 m/s ÷ ${fmtInput(freq)} Hz ${eq(wavelength)} ${fmt(wavelength, 2)} m`,
          readout: `λ ${eq(wavelength)} ${fmt(wavelength, 2)}m`,
          badge: "声音三要素"
        };
      },
      visual: model => genericShell(model, soundDiagram(model.metrics[0], model.metrics[1], model.metrics[2])),
      recognition: model => `声音波形｜${model.formulaDetail}｜音调${model.facts[1].value}、响度${model.facts[2].value}`
    }
  };

  templates.lens.content = null;

  const gText = fixed => `g 取 ${fmtInput(fixed.g ?? G)}N/kg`;
  templates.lever.given = (p1, p2) => `左侧 F₁ = ${fmtInput(p1)}N，l₁ = ${fmtInput(p2)}cm；右侧 F₂ = 6N，l₂ = 20cm`;
  templates.buoyancy.given = (v, rho, fixed) => `V排 = ${fmtInput(v)}cm³，ρ液 = ${fmtInput(rho)}kg/m³，${gText(fixed)}${fixed.weightSource === "material" ? `；${fixed.material}块浸没（查表 ρ${fixed.material} = ${sci(fixed.materialDensity)}kg/m³）` : fixed.weightSource === "given" ? `；物重 G = ${fmtInput(fixed.weight)}N` : ""}`;
  templates.lampPower.given = (u, i, fixed) => fixed.nameplate
    ? `铭牌：额定电压 ${fmtInput(u)}V、额定电流 ${fmtInput(i)}A；正常发光时 U = ${fmtInput(u)}V，I = ${fmtInput(i)}A`
    : `U = ${fmtInput(u)}V，I = ${fmtInput(i)}A${fixed.ratedStated === false ? "（未给出额定电压）" : `，额定电压 ${fmtInput(fixed.rated ?? 2.5)}V`}`;
  templates.seriesCircuit.given = (u, r2, fixed) => `电源电压 U = ${fmtInput(u)}V，R₁ = ${fmtInput(fixed.r1 ?? 4)}Ω，R₂ = ${fmtInput(r2)}Ω`;
  templates.heatBalance.given = (mHot, tHot, fixed) => `热水 m₁ = ${fmtInput(mHot)}g、t₁ = ${fmtInput(tHot)}℃；冷水 m₂ = ${fmtInput(fixed.mCold ?? 200)}g、t₂ = ${fmtInput(fixed.tCold ?? 20)}℃`;
  templates.liquidPressure.given = (h, rho, fixed) => `h = ${fmtInput(h)}cm，ρ液 = ${fmtInput(rho)}kg/m³，${gText(fixed)}`;
  templates.efficiency.given = (load, force, fixed) => `G = ${fmtInput(load)}N，F = ${fmtInput(force)}N，n = 3${Number.isFinite(fixed.h) ? `，h = ${fmtInput(fixed.h)}m` : ""}${Number.isFinite(fixed.s) ? `，s = ${fmtInput(fixed.s)}m` : ""}`;
  templates.sound.given = (f, a) => `f = ${fmtInput(f)}Hz，振幅 A = ${fmtInput(a)}%，空气中声速 v = 340m/s`;

  Object.values(templates).forEach(template => {
    const nextA = clamp(template.defaults[0] + Number(template.params[0].step) * 2, template.params[0].min, template.params[0].max);
    const nextB = clamp(template.defaults[1] + Number(template.params[1].step) * 2, template.params[1].min, template.params[1].max);
    template.examples = [
      { p1: template.defaults[0], p2: template.defaults[1], question: template.question(template.defaults[0], template.defaults[1]) },
      { p1: nextA, p2: nextB, question: template.question(nextA, nextB) }
    ];
    template.content = (p1 = template.defaults[0], p2 = template.defaults[1], fixed) => {
      const model = template.model(Number(p1), Number(p2), fixedWithDefaults(template, fixed));
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
        params: [adaptParam(template, 0, Number(p1)), adaptParam(template, 1, Number(p2))],
        steps: commonSteps(model, [
          template.given
            ? template.given(Number(p1), Number(p2), fixedWithDefaults(template, fixed))
            : `${template.params[0].label} = ${fmtInput(p1)}${template.params[0].unit}，${template.params[1].label} = ${fmtInput(p2)}${template.params[1].unit}`,
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
    template.checkQuestion = (text, p1, p2, fixed) => checkQuestion(template, text, p1, p2, fixed);
    template.fixedWithDefaults = fixed => fixedWithDefaults(template, fixed);
  });

  window.EXTRA_PHYSICS_TEMPLATES = templates;
})();
