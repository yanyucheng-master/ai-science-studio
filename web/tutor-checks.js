// Answer checks for the browser's direct DeepSeek connection (personal API key).
// They mirror server/src/protocol.js, so both connection modes reject the same
// off-topic or numerically wrong replies and add the same completeness reminders.
// server/test/web-tutor-checks.test.js compares the two implementations.
(function (root) {
  "use strict";

  const COVERAGE_SIGNALS = Object.freeze([
    {
      label: "是否发生相对滑动",
      requested: /(?:是否|判断).{0,10}(?:相对)?(?:滑动|运动)/,
      answered: /(?:发生|不发生|会|不会|保持|判定|确定).{0,8}(?:相对)?(?:滑动|运动|静止)/
    },
    {
      label: "加速度",
      requested: /加速度/,
      answered: /加速度|a(?:[_A-Za-z0-9₀-₉]*\s*[=＝])/i
    },
    {
      label: "所需时间",
      requested: /(?:多久|多长时间|所需时间|经过时间|时间为|(?:求|计算|、|和).{0,4}时间|求\s*t\b)/i,
      answered: /(?:时间|t\s*[=＝]).{0,30}(?:秒|\bs\b)/i
    },
    {
      label: "产生的热量",
      requested: /热量|摩擦生热|求\s*Q\b/i,
      answered: /(?:热量|摩擦生热|Q\s*[=＝]).{0,80}(?:焦耳|J)/i
    },
    {
      label: "能量核对",
      requested: /能量.{0,8}(?:核对|验证|守恒|关系)|(?:核对|验证).{0,8}能量|(?:功|机械能).{0,8}(?:核对|验证|关系)/,
      answered: /(?:外力做功|动能|机械能|能量守恒|功能关系)/
    }
  ]);

  const TOPIC_ANCHORS = Object.freeze([
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

  function responseText(response) {
    return [
      response.summary,
      ...(response.steps || []),
      ...(response.formulas || []),
      response.finalAnswer,
      ...(response.checks || [])
    ].filter(Boolean).join("\n");
  }

  // Quoted answer text is supporting material, not an additional set of goals.
  function latestQuestion(request) {
    let message = typeof request?.message === "string" ? request.message : "";
    const boundary = "\n【本次问题】\n";
    const questionIndex = message.lastIndexOf(boundary);
    if (message.startsWith("【引用片段，仅作提问材料】\n") && questionIndex >= 0) {
      message = message.slice(questionIndex + boundary.length);
    }
    const rulesIndex = message.lastIndexOf("\n\n【回答规范】");
    return (rulesIndex >= 0 ? message.slice(0, rulesIndex) : message).trim();
  }

  function isTargetedFollowUp(request) {
    const latest = latestQuestion(request);
    const hasQuote = request?.message?.startsWith("【引用片段，仅作提问材料】\n");
    if (/完整.{0,6}(?:解答|原题|整题)|所有小问|从头.{0,6}(?:讲|解)/.test(latest)) return false;
    if (hasQuote) return true;
    if (!Array.isArray(request?.history) || !request.history.length) return false;
    return /(?:只|仅)(?:补|解释|回答|计算|核对)|补充|漏了|不要重复|上一(?:步|次|条|个回答)|这一?(?:步|问)|刚才|没(?:看|听|弄|想)?懂|不(?:太)?(?:明白|理解|懂)|换(?:个|一种|种).{0,5}(?:说法|解释)|(?:详细|简单)(?:一点|点|些)|再(?:讲|解释)|什么意思|卡(?:在|住)/.test(latest);
  }

  function topicMismatches(request, response) {
    if (!request || !response || request.context?.mode !== "question") return [];
    // Only a full solution must name the original problem's objects.
    if (request.responseLevel !== "steps") return [];
    const targeted = isTargetedFollowUp(request);
    const question = targeted ? latestQuestion(request) : request.context.originalQuestion || "";
    const text = responseText(response);
    return TOPIC_ANCHORS
      .filter(anchor => anchor.requested.test(question) && !anchor.answered.test(text))
      .map(anchor => anchor.requested.source);
  }

  function canonicalMathText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[（]/g, "(")
      .replace(/[）]/g, ")")
      .replace(/[−–—]/g, "-")
      .replace(/\s+/g, "")
      .replace(/\d+(?:\.\d+)?/g, number => String(Number(number)));
  }

  function readQuestionNumber(question, pattern) {
    const value = Number(String(question || "").match(pattern)?.[1]);
    return Number.isFinite(value) ? value : null;
  }

  function stableDecimal(value) {
    return Number(Number(value).toFixed(8));
  }

  // Numeric a(v) statements in a reply, minus those the student wrote.
  function statedNumericAccelerations(request, answerText) {
    const studentText = canonicalMathText([latestQuestion(request),
      ...(request.history || []).filter(item => item.role === "user").map(item => item.content)].join("\n"));
    const statements = String(answerText || "").match(
      /a\s*\\?\(\s*v\s*\\?\)\s*=\s*(?:\(|\\frac\{)?\s*-?\d[-−+*/×·().\d\sA-Za-z\\{}^_]*|加速度.{0,12}?(?:为|是|=)\s*-?\d[\d.]*/gi) || [];
    return statements.filter(statement => !studentText.includes(canonicalMathText(statement).replace(/\\/g, "")) &&
      !studentText.includes(canonicalMathText(statement)));
  }

  function deterministicIssues(request, response) {
    if (!request || !response || request.context?.mode !== "question") return [];
    const question = request.context.originalQuestion || "";
    // Numbers are checked when this turn asks for the full calculation, or when
    // the reply states a numeric a(v) of its own; a variant uses new numbers.
    if (request.responseLevel === "variant") return [];
    const targeted = isTargetedFollowUp(request);
    const answerText = responseText(response);
    const solving = request.responseLevel === "steps" && !targeted;
    if (!solving && !statedNumericAccelerations(request, answerText).length) return [];
    if (targeted && !/加速度|a\s*\(\s*v\s*\)/i.test(latestQuestion(request) + answerText)) return [];
    if (!/(?:金属棒|导体棒)/.test(question) || !/a\s*\(\s*v\s*\)/i.test(question) || !/(?:磁场|磁感应强度)/.test(question)) {
      return [];
    }
    const mass = readQuestionNumber(question, /质量\s*([0-9.]+)\s*kg/i);
    const length = readQuestionNumber(question, /长度\s*([0-9.]+)\s*m/i);
    const magneticField = readQuestionNumber(question, /B\s*=\s*([0-9.]+)\s*T/i);
    const resistance = readQuestionNumber(question, /R\s*=\s*([0-9.]+)\s*Ω/i);
    const force = readQuestionNumber(question, /F\s*=\s*([0-9.]+)\s*N/i);
    if (![mass, length, magneticField, resistance, force].every(value => Number.isFinite(value) && value > 0)) return [];
    const intercept = stableDecimal(force / mass);
    const slope = stableDecimal(magneticField ** 2 * length ** 2 / (resistance * mass));
    const text = canonicalMathText(answerText);
    if (!text.includes(canonicalMathText(`${slope}v`)) || !text.includes(canonicalMathText(`${intercept}-`))) {
      return ["INDUCTION_ROD_ACCELERATION_MISMATCH"];
    }
    return [];
  }

  function missingCoverage(request, response) {
    if (!request || !response || !["steps", "explain", "check"].includes(request.responseLevel)) return [];
    const targeted = isTargetedFollowUp(request);
    const latest = latestQuestion(request);
    const rawRequestText = request.responseLevel === "steps" && !targeted
      ? `${request.context?.originalQuestion || ""}\n${latest}`
      : latest;
    const requestText = rawRequestText.replace(/(?:不要|无需|不必|不用).{0,40}?(?:[，,。；;]|$)/g, "");
    const text = responseText(response);
    return COVERAGE_SIGNALS
      .filter(signal => {
        if (signal.label === "产生的热量" && /(?:为什么|为何|怎么理解)/.test(requestText) &&
          !/(?:求|计算|多少|数值)/.test(requestText)) return false;
        return signal.requested.test(requestText) && !signal.answered.test(text);
      })
      .map(signal => signal.label);
  }

  root.MasterLabTutorChecks = Object.freeze({
    latestQuestion, isTargetedFollowUp, topicMismatches, deterministicIssues, missingCoverage, responseText
  });
})(typeof window !== "undefined" ? window : globalThis);
