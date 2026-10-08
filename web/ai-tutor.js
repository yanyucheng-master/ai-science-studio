(() => {
  "use strict";

  const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);
  const DEFAULT_REMOTE_API = "https://masterlab-harmony-ai-2026.onrender.com";
  const API_BASE_URL = String(window.MASTER_LAB_API_URL ||
    (LOCAL_HOSTS.has(window.location.hostname) ? "http://127.0.0.1:10000" : DEFAULT_REMOTE_API)).replace(/\/$/, "");
  const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
  const DEEPSEEK_MODEL = "deepseek-flash";
  const DEEPSEEK_MODEL_VERSION = "DeepSeek-V4.1-Flash";
  const DEEPSEEK_MODEL_LABEL = "DeepSeek V4.1 Flash";
  const API_KEY_STORAGE = "masterLab.deepseekApiKey";
  const CHAT_TIMEOUT_MS = 540000;
  const GENERATE_TIMEOUT_MS = 540000;
  const MAX_HISTORY_ITEMS = 12;
  const MAX_CHAT_REQUEST_BYTES = 14 * 1024;

  const CHAT_SYSTEM_PROMPT = `你是“大师实验室”的中学数理化生 AI 导师。只返回一个 JSON 对象，不输出 HTML、URL、代码或内部推理过程。
教学与核验规则：
1. 原题及最新请求是约束，最新请求优先于历史。完整解题必须覆盖所有小问；只解释某一步时仅回答该子问题。
2. 学科题目没有实验模板也必须正常解答。不得把“无模板”说成“无法解题”；题设充分就作答，缺少必要条件或条件矛盾才用 clarification，明确指出缺失条件并追问，不补造数值、接触面、反应物或模型。
3. hint 只给一条关键线索和必要追问，不给完整答案；explain 解释指定概念；steps 完整解答；check 核对学生思路；variant 给请求的变式。无关请求用 refusal。
4. 精简展示不等于省略验证。输出前独立复核公式适用条件、计算、单位、量纲、边界及所有小问。分类或概率核对各分支之和；函数与临界值代回；化学先配平并核对限量反应物；遗传题区分基因型与表现型。复核不成立时先纠正，不用泛泛的“检查无误”代替实际核算。
5. 实验参数和原题条件不得改写；deterministicResult 可能是当前动画时刻，求最终值应按原题参数与公式计算，不把初始位移或当前速度当最终答案。摩擦方向按接触面间相对运动或趋势判断。
6. 格式简要：steps 是主体，每步做一个必要动作，以“列式：”“代入：”“结论：”等短标题开始。简单题通常 2 至 4 步，复杂题按小问最多 8 步，不机械凑步数。所有小问的答案必须出现在 steps；有物理量时标明单位，纯数学不补“无单位”说明；计算放在前面的步骤，最后一步只列各小问的简短结论，避免再重复推导。
7. 有 steps 时 summary 留空。finalAnswer 只能逐字复制最后一步中的结论，不得再写一段同义总结；hint、clarification、refusal 的 finalAnswer 为 null。checks 仅承载已完成的内部复核，不另写展示段落；用户要求证明或核验时，将相关工作放入 steps。
8. formulas 只列 1 至 3 条真正关键且不重复的关系，概念题可为空。行内公式用 \\( ... \\) 包围，formulas 项只写 LaTeX 本体。分式用 \\frac{分子}{分母}，根号用 \\sqrt{}，下标和幂用 v_{0}、v^{2}；单位用 \\mathrm{m}\\cdot\\mathrm{s}^{-1} 等规范写法。化学式用 \\ce{}。化学式应整体放在同一数学片段内，勿仅把下标单独围起来。不要输出未闭合括号或不完整公式，不用斜杠代替教材分式。
9. followUp 默认返回空字符串，仅 hint、variant、必要澄清或用户要求时给出。warnings 只写影响答案的条件矛盾、适用范围或不确定性，不重复通用免责声明，不向学生提及内部字段。
返回结构：
{"mode":"hint|explain|steps|answer|clarification|refusal","summary":"","steps":["必要步骤，最后一步含所有最终结论"],"formulas":["关键 LaTeX 公式"],"finalAnswer":"最后一步的原文结论或 null","checks":["实际复核"],"followUp":"","parameterPatch":null,"warnings":[]}
mode 不使用 check 或 variant；需要时用 explain。parameterPatch 只可在实验变式中建议一个已有参数，不能自动应用。`;

  const GENERATE_SYSTEM_PROMPT = `你是“大师实验室”的理科题目解析器。只返回 JSON 对象，禁止 Markdown 代码块。
支持模板 ID：brake, fe_cuso4, tangent, cell, solenoid, board_slider, projectile, ohm_circuit, lever, lens, buoyancy, friction, lamp_power, series_circuit, heat_balance, liquid_pressure, efficiency, sound。
有对应模板时：
{"mode":"experiment","title":"...","answer":"简短解释","plan":{"title":"...","subject":"physics|chemistry|mathematics|biology","modules":[{"id":"m1","templateId":"brake","parameters":{"initialSpeed":20,"deceleration":5}}],"links":[],"steps":["..."]},"visual":{"kind":"none","title":""}}
无模板或条件不足时：
{"mode":"explanation","title":"...","answer":"说明缺失条件或暂无模板","plan":null,"visual":{"kind":"none","title":""}}
严禁输出代码、SVG、HTML、URL。`;

  const ACTIONS = {
    hint: {
      level: "hint",
      message: "请只给我一个关键提示，并用一个问题引导我继续思考，不要直接给最终答案。"
    },
    explain: {
      level: "explain",
      message: "请结合当前题目和实验参数，解释当前解题步骤为什么成立。"
    },
    check: {
      level: "check",
      message: "请检查当前解题路径中的公式适用条件、单位、代入和结论是否一致，并指出最容易出错的一步。"
    },
    variant: {
      level: "variant",
      message: "请生成一道同知识点的变式；如果当前实验支持参数调整，可以建议修改一个已有参数，但不要自动执行。"
    },
    steps: {
      level: "steps",
      message: "请完整解答，保留必要条件、关键公式与代入；最后一步写出全部小问的结论和单位。"
    }
  };

  const state = {
    open: false,
    route: false,
    sessionId: globalThis.crypto?.randomUUID?.() || `master-lab-${Date.now()}`,
    messages: [],
    context: null,
    controller: null,
    timeoutId: null,
    pendingNode: null,
    pendingTimer: null,
    pendingStartedAt: 0,
    pendingReasoning: "",
    pendingExpanded: false,
    requestSerial: 0,
    lastRequest: null,
    lastError: null
  };

  const elements = {
    grid: document.querySelector(".content-grid"),
    workspace: document.querySelector("#aiTutorWorkspace"),
    status: document.querySelector("#aiTutorStatus"),
    contextTitle: document.querySelector("#aiTutorContextTitle"),
    contextText: document.querySelector("#aiTutorContextText"),
    messages: document.querySelector("#aiTutorMessages"),
    empty: document.querySelector("#aiTutorEmpty"),
    form: document.querySelector("#aiTutorForm"),
    input: document.querySelector("#aiTutorInput"),
    send: document.querySelector("#aiTutorSendButton"),
    stop: document.querySelector("#aiTutorStopButton"),
    retry: document.querySelector("#aiTutorRetryButton"),
    clear: document.querySelector("#aiTutorClearButton"),
    close: document.querySelector("#aiTutorCloseButton"),
    back: document.querySelector("#aiTutorBackButton"),
    page: document.querySelector("#aiTutorPageButton"),
    expand: document.querySelector("#mentorExpandButton"),
    openPage: document.querySelector("#mentorOpenPageButton"),
    apiKeyModal: document.querySelector("#apiKeyModal"),
    apiKeyInput: document.querySelector("#apiKeyInput"),
    apiKeyStatus: document.querySelector("#apiKeyStatus"),
    apiKeySave: document.querySelector("#apiKeySaveButton"),
    apiKeyClear: document.querySelector("#apiKeyClearButton"),
    apiKeyClose: document.querySelector("#apiKeyModalClose")
  };

  if (!elements.workspace || !elements.messages || !elements.form) {
    return;
  }

  class TutorRequestError extends Error {
    constructor(code, status = 0) {
      super(code);
      this.name = "TutorRequestError";
      this.code = code;
      this.status = status;
    }
  }

  function host() {
    return window.MasterLabAIHost || {};
  }

  function text(value, fallback = "") {
    return typeof value === "string" ? value.trim() : fallback;
  }

  function smartNumber(value, decimals = 2) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "--";
    return number.toFixed(decimals).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  }

  function subjectLabel(subject) {
    return ({ physics: "物理", chemistry: "化学", mathematics: "数学", biology: "生物" })[subject] || subject || "理科";
  }

  function createElement(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }

  function setBusy(isBusy, message = "") {
    elements.workspace.classList.toggle("is-busy", isBusy);
    elements.workspace.setAttribute("aria-busy", String(isBusy));
    elements.send.disabled = isBusy;
    elements.stop.disabled = !isBusy;
    if (message) elements.status.textContent = message;
  }

  function errorMessage(error) {
    const code = error?.code || error?.message;
    const messages = {
      AI_NOT_CONFIGURED: "公益默认 AI 服务尚未就绪。可稍后重试，或右键烧瓶图标配置个人密钥。",
      AI_AUTH_FAILED: "个人 API 密钥无效或已失效，请右键烧瓶图标重新配置；本次不会切换到公益默认服务。",
      AI_RATE_LIMITED: "AI 请求较多，请稍后再试。",
      RATE_LIMITED: "AI 请求较多，请稍后再试。",
      BODY_TOO_LARGE: "题目或对话内容过长，请精简本次提问或清空对话后重试。",
      MESSAGE_TOO_LONG: "本次提问过长，请精简后发送；原题和已有对话已保留。",
      INVALID_MATH: "本次公式未通过排版校验，请重试以重新生成完整公式。",
      AI_BUSY: "公益后台的 AI 并发容量已满，请稍后重试。",
      AI_TIMEOUT: "这道题分析时间较长，本次请求已超时。你可以重试，或先请求一个简短提示。",
      AI_UNAVAILABLE: hasBrowserApiKey()
        ? "个人 AI 接口暂时不可用，题目和实验状态已保留；不会自动使用公益余额。"
        : "公益默认 AI 服务暂时不可用（可能余额不足或临时故障）。题目已保留，可稍后重试或配置个人密钥。",
      INVALID_AI_RESPONSE: "AI 返回格式不符合约定，已拦截显示。请再试一次，或换个问法。",
      ORIGIN_NOT_ALLOWED: "当前网页地址尚未加入 AI 服务允许列表。",
      ABORTED: "已停止本次回答。",
      NETWORK_ERROR: "暂时无法连接 AI 服务，请检查网络后重试。免费后台闲置后首次唤醒可能需要约一分钟。"
    };
    return messages[code] || "AI 导师暂时没有完成回答，请稍后重试。";
  }

  function readStoredApiKey() {
    try {
      return String(localStorage.getItem(API_KEY_STORAGE) || "").trim();
    } catch {
      return "";
    }
  }

  function writeStoredApiKey(value) {
    const key = String(value || "").trim();
    try {
      if (!key) localStorage.removeItem(API_KEY_STORAGE);
      else localStorage.setItem(API_KEY_STORAGE, key);
    } catch {
      /* ignore quota / private mode */
    }
    return key;
  }

  function maskApiKey(key) {
    const value = String(key || "");
    if (value.length < 10) return value ? "已配置" : "";
    return `${value.slice(0, 6)}…${value.slice(-4)}`;
  }

  function hasBrowserApiKey() {
    return readStoredApiKey().length > 0;
  }

  function notify(message) {
    if (typeof window.showToast === "function") {
      window.showToast(message);
      return;
    }
    const toast = document.querySelector("#toast");
    const textNode = toast?.querySelector("p");
    if (!toast || !textNode) return;
    textNode.textContent = message;
    toast.classList.add("show");
    window.setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function syncApiKeyUi() {
    const key = readStoredApiKey();
    const ready = key.length > 0;
    document.querySelectorAll(".mentor-card .online, .ai-tutor-identity .online").forEach((node) => {
      const label = node.childNodes[node.childNodes.length - 1];
      if (label && label.nodeType === Node.TEXT_NODE) {
        label.textContent = ready ? " 个人密钥模式" : "";
      }
      // 默认（公益）模式不显示状态行；配置个人密钥后显示“个人密钥模式”
      node.hidden = !ready;
      node.title = ready
        ? `个人密钥优先 · ${DEEPSEEK_MODEL_LABEL} · 最高思考 max`
        : `使用后台公益密钥 · ${DEEPSEEK_MODEL_LABEL} · 最高思考 max；右键烧瓶可配置个人密钥`;
    });
    if (elements.apiKeyStatus) {
      elements.apiKeyStatus.textContent = ready
        ? `个人密钥 ${maskApiKey(key)} 优先直连 DeepSeek · ${DEEPSEEK_MODEL_LABEL} · 最高思考 max；失败时不会使用公益余额`
        : `未配置个人密钥：使用后台公益默认服务 · ${DEEPSEEK_MODEL_LABEL} · 最高思考 max；公益余额有限`;
      elements.apiKeyStatus.classList.toggle("is-ready", ready);
    }
    if (elements.apiKeyInput && document.activeElement !== elements.apiKeyInput) {
      elements.apiKeyInput.value = "";
      elements.apiKeyInput.placeholder = ready ? maskApiKey(key) : "sk-…";
    }
  }

  function openApiKeyModal() {
    if (!elements.apiKeyModal) return;
    syncApiKeyUi();
    elements.apiKeyModal.classList.add("show");
    elements.apiKeyModal.setAttribute("aria-hidden", "false");
    window.setTimeout(() => elements.apiKeyInput?.focus(), 40);
  }

  function closeApiKeyModal() {
    if (!elements.apiKeyModal) return;
    elements.apiKeyModal.classList.remove("show");
    elements.apiKeyModal.setAttribute("aria-hidden", "true");
    if (elements.apiKeyInput) elements.apiKeyInput.value = "";
  }

  function saveApiKeyFromModal() {
    const next = String(elements.apiKeyInput?.value || "").trim();
    if (!next) {
      notify("请先粘贴有效的 API 密钥");
      elements.apiKeyInput?.focus();
      return;
    }
    if (!/^sk-[A-Za-z0-9._-]{10,}$/.test(next)) {
      notify("密钥格式看起来不正确，请检查后重试");
      return;
    }
    writeStoredApiKey(next);
    syncApiKeyUi();
    closeApiKeyModal();
    notify("个人密钥已保存在本机，后续请求优先使用个人接口");
  }

  function clearApiKeyFromModal() {
    writeStoredApiKey("");
    syncApiKeyUi();
    if (elements.apiKeyInput) {
      elements.apiKeyInput.value = "";
      elements.apiKeyInput.placeholder = "sk-…";
    }
    notify("已清除个人密钥，后续请求使用公益默认服务");
  }

  function extractJsonObject(rawText) {
    const source = String(rawText || "").trim();
    if (!source) return null;
    const candidates = [source];
    const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) candidates.push(fenced[1].trim());
    const start = source.indexOf("{");
    const end = source.lastIndexOf("}");
    if (start >= 0 && end > start) candidates.push(source.slice(start, end + 1));
    for (const candidate of candidates) {
      const parsed = tryParseJson(candidate) || tryParseJson(repairJsonText(candidate));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    }
    return null;
  }

  function tryParseJson(value) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function repairJsonText(value) {
    return String(value || "")
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ");
  }

  function asTextList(value, limit, itemLimit) {
    if (Array.isArray(value)) {
      return value.map((item) => {
        if (typeof item === "string") return text(item).slice(0, itemLimit);
        if (item && typeof item === "object") {
          return text(item.text || item.content || item.step || item.formula || item.check || item.summary).slice(0, itemLimit);
        }
        return "";
      }).filter(Boolean).slice(0, limit);
    }
    const single = text(value);
    if (!single) return [];
    return single.split(/\n+/).map((line) => line.replace(/^\d+[\.、)\s]+/, "").trim()).filter(Boolean).slice(0, limit);
  }

  function normalizeChatMode(rawMode, responseLevel) {
    const mode = text(rawMode).toLowerCase();
    const allowed = new Set(["hint", "explain", "steps", "answer", "clarification", "refusal"]);
    if (allowed.has(mode)) return mode;
    if (mode === "variant" || mode === "check") return "explain";
    if (responseLevel === "hint") return "hint";
    if (responseLevel === "steps") return "steps";
    if (responseLevel === "check" || responseLevel === "variant" || responseLevel === "explain") return "explain";
    return "answer";
  }

  function softValidateChat(raw, responseLevel) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const mode = normalizeChatMode(raw.mode, responseLevel);
    const summary = text(raw.summary || raw.message || raw.answer || raw.finalAnswer || raw.content).slice(0, 1000);
    const steps = asTextList(raw.steps, 8, 1200);
    const finalAnswer = responseLevel === "hint" ? null :
      (text(raw.finalAnswer || raw.answer || (mode === "steps" ? steps.at(-1) : "")).slice(0, 1200) || null);
    // Some deployed gateways clip a step to 500 characters while retaining the
    // complete finalAnswer. Restore it only when it is the exact same prefix.
    if (steps.length && finalAnswer?.startsWith(steps.at(-1)) && finalAnswer.length > steps.at(-1).length) {
      steps[steps.length - 1] = finalAnswer;
    }
    if (!summary && !steps.length) return null;
    const warnings = asTextList(raw.warnings, 4, 300);
    return {
      schemaVersion: "1.0",
      mode,
      summary: steps.length && !["clarification", "refusal"].includes(mode) ? "" : summary,
      steps,
      formulas: asTextList(raw.formulas, 8, 300),
      finalAnswer,
      checks: asTextList(raw.checks, 6, 400),
      followUp: text(raw.followUp).slice(0, 500),
      parameterPatch: null,
      warnings,
      source: "deepseek-browser",
      model: DEEPSEEK_MODEL
    };
  }

  function fallbackChatFromText(rawText, responseLevel) {
    const source = text(rawText);
    // A broken JSON document is not a readable answer, especially for full steps.
    if (responseLevel === "steps" || /```|^\s*[\[{]|[\[{]\s*"|"(?:mode|summary|steps|finalAnswer)"\s*:/.test(source)) return null;
    const cleaned = source.slice(0, 1000);
    if (cleaned.length < 8) return null;
    return softValidateChat({
      mode: normalizeChatMode("", responseLevel),
      summary: cleaned,
      steps: [],
      formulas: [],
      finalAnswer: responseLevel === "hint" ? null : cleaned,
      checks: [],
      followUp: "",
      warnings: ["模型未按约定 JSON 返回，已转为可读文本。"]
    }, responseLevel);
  }

  function softValidateGenerate(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (raw.mode !== "experiment" && raw.mode !== "explanation") return null;
    return {
      ...raw,
      source: "deepseek-browser",
      model: DEEPSEEK_MODEL
    };
  }

  async function readJsonChat(response) {
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new TutorRequestError("INVALID_AI_RESPONSE", response.status);
    }
    const choice = payload?.choices?.[0];
    if (choice?.finish_reason && choice.finish_reason !== "stop") {
      throw new TutorRequestError("INVALID_AI_RESPONSE", response.status);
    }
    const message = choice?.message || {};
    return {
      content: typeof message.content === "string" ? message.content : "",
      reasoning: typeof message.reasoning_content === "string" ? message.reasoning_content : ""
    };
  }

  async function readSseChat(response, controller, onDelta) {
    if (response.headers?.get("content-type")?.includes("application/json") || !response.body?.getReader) {
      return readJsonChat(response);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    let reasoning = "";
    let dataLines = [];
    let finished = false;
    let finishReason = null;

    function dispatchEvent() {
      const data = dataLines.join("\n").trim();
      dataLines = [];
      if (!data) return;
      if (data === "[DONE]") {
        finished = true;
        return;
      }
      const chunk = tryParseJson(data);
      if (!chunk || chunk.error) throw new TutorRequestError("INVALID_AI_RESPONSE");
      const choice = chunk.choices?.[0];
      if (choice?.finish_reason) {
        finishReason = choice.finish_reason;
        if (finishReason !== "stop") throw new TutorRequestError("INVALID_AI_RESPONSE");
      }
      const delta = choice?.delta || {};
      if (typeof delta.reasoning_content === "string" && delta.reasoning_content) {
        reasoning += delta.reasoning_content;
        onDelta?.({ reasoning, content, kind: "reasoning" });
      }
      if (typeof delta.content === "string" && delta.content) {
        content += delta.content;
        onDelta?.({ reasoning, content, kind: "content" });
      }
    }

    function consumeLine(line) {
      if (!line) dispatchEvent();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
    }

    function consumeBuffer(atEnd = false) {
      let match;
      while (!finished && (match = /\r\n|\r|\n/.exec(buffer))) {
        // A CR at a chunk boundary may be the first half of CRLF.
        if (!atEnd && match[0] === "\r" && match.index === buffer.length - 1) break;
        const line = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        consumeLine(line);
      }
      if (atEnd && !finished) {
        consumeLine(buffer);
        buffer = "";
        dispatchEvent();
      }
    }

    try {
      while (!finished) {
        if (controller.signal.aborted) {
          throw new TutorRequestError(controller.signal.reason === "timeout" ? "AI_TIMEOUT" : "ABORTED");
        }
        const { done, value } = await reader.read();
        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
        consumeBuffer(done);
        if (done) break;
      }
      if (!finished && finishReason !== "stop") throw new TutorRequestError("INVALID_AI_RESPONSE");
      return { content, reasoning };
    } finally {
      try { await reader.cancel(); } catch { /* preserve the original read/abort error */ }
      reader.releaseLock();
    }
  }

  async function callDeepSeek(messages, options = {}) {
    const apiKey = readStoredApiKey();
    if (!apiKey) throw new TutorRequestError("AI_NOT_CONFIGURED");
    if (state.controller) state.controller.abort();
    const controller = new AbortController();
    state.controller = controller;
    const timeoutMs = options.timeoutMs || CHAT_TIMEOUT_MS;
    const useStream = Boolean(options.stream);
    const timeoutId = window.setTimeout(() => controller.abort("timeout"), timeoutMs);
    state.timeoutId = timeoutId;
    try {
      let response;
      try {
        response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages,
            thinking: { type: "enabled" },
            response_format: { type: "json_object" },
            max_tokens: 32768,
            stream: useStream,
            reasoning_effort: "max"
          }),
          signal: controller.signal
        });
      } catch (error) {
        if (controller.signal.aborted) {
          throw new TutorRequestError(controller.signal.reason === "timeout" ? "AI_TIMEOUT" : "ABORTED");
        }
        throw new TutorRequestError("NETWORK_ERROR");
      }
      if (!response.ok) {
        let payload = {};
        try {
          payload = await response.json();
        } catch {
          payload = {};
        }
        if (response.status === 401 || response.status === 403) {
          throw new TutorRequestError("AI_AUTH_FAILED", response.status);
        }
        if (response.status === 429) {
          throw new TutorRequestError("AI_RATE_LIMITED", response.status);
        }
        const code = payload && typeof payload.error === "string" ? payload.error :
          (response.status === 429 ? "RATE_LIMITED" : "AI_UNAVAILABLE");
        throw new TutorRequestError(code, response.status);
      }
      let content = "";
      let reasoning = "";
      if (useStream) {
        const streamed = await readSseChat(response, controller, ({ reasoning: next }) => {
          state.pendingReasoning = next;
          options.onReasoning?.(next);
        });
        content = streamed.content;
        reasoning = streamed.reasoning || state.pendingReasoning;
      } else {
        const message = await readJsonChat(response);
        content = message.content;
        reasoning = message.reasoning;
        if (reasoning) {
          state.pendingReasoning = reasoning;
          options.onReasoning?.(reasoning);
        }
      }
      if (reasoning && !state.pendingReasoning) state.pendingReasoning = reasoning;
      // Only final content is an answer. Reasoning can contain tentative JSON.
      const parsed = extractJsonObject(content);
      if (parsed) return parsed;
      const error = new TutorRequestError("INVALID_AI_RESPONSE", response.status);
      error.rawText = content;
      throw error;
    } catch (error) {
      // fetch resolves at headers; abort can also occur during SSE or JSON body reads.
      if (controller.signal.aborted) {
        throw new TutorRequestError(controller.signal.reason === "timeout" ? "AI_TIMEOUT" : "ABORTED");
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
      if (state.timeoutId === timeoutId) state.timeoutId = null;
      if (state.controller === controller) state.controller = null;
    }
  }

  function withReasoning(payload) {
    if (!payload || typeof payload !== "object") return payload;
    payload.reasoning = state.pendingReasoning || payload.reasoning || "";
    payload.thinkingSeconds = state.pendingStartedAt
      ? Math.max(1, Math.round((Date.now() - state.pendingStartedAt) / 1000))
      : payload.thinkingSeconds;
    return payload;
  }

  async function completeTutorChat(messages, request, options) {
    const requestOptions = {
      ...options,
      stream: Boolean(options.thinking),
      onReasoning: (value) => updatePendingReasoning(value)
    };
    try {
      const raw = await callDeepSeek(messages, requestOptions);
      const validated = withReasoning(softValidateChat(raw, request.responseLevel));
      if (validated) return validated;
      if (!options.thinking) {
        const fallback = withReasoning(fallbackChatFromText([raw.summary, raw.message, raw.answer, raw.content].filter(Boolean).join("\n"), request.responseLevel));
        if (fallback) return fallback;
      }
    } catch (error) {
      // Max is an explicit user requirement. A failed or truncated answer
      // is terminal, never a reason to make a second, lower-effort call.
      throw error;
    }
    throw new TutorRequestError("INVALID_AI_RESPONSE");
  }

  async function browserTutorChat(request) {
    const history = (request.history || []).map((item) => ({ role: item.role, content: item.content }));
    const messages = [
      { role: "system", content: CHAT_SYSTEM_PROMPT },
      ...history,
      {
        role: "user",
        content: [
          "【唯一原题】只允许解答 originalQuestion，不得替换或补写成另一道题。",
          `originalQuestion: ${request.context?.originalQuestion || ""}`,
          `latestStudentRequest: ${request.message}`,
          `structuredInput: ${JSON.stringify({
            responseLevel: request.responseLevel,
            subject: request.context?.subject || "",
            context: request.context || {}
          }, null, 0)}`,
          "只返回一个 JSON 对象，不要输出 Markdown 或解释文字。"
        ].join("\n")
      }
    ];
    return completeTutorChat(messages, request, {
      thinking: true,
      timeoutMs: CHAT_TIMEOUT_MS
    });
  }

  async function browserGenerate(question, preferredSubject = "") {
    const raw = await callDeepSeek([
      { role: "system", content: GENERATE_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify({ question, preferredSubject }, null, 0) }
    ], { thinking: true, timeoutMs: GENERATE_TIMEOUT_MS });
    const validated = softValidateGenerate(raw);
    if (!validated) throw new TutorRequestError("INVALID_AI_RESPONSE");
    return validated;
  }

  function selectResponseLevel(message) {
    const value = text(message).replace(/不要(?:只|仅)(?:给|给我)?(?:提示|线索)/g, "");
    if (/(?:只|仅).{0,6}(?:解释|说明|分析原因)/.test(value)) return "explain";
    if (/只.{0,8}(?:提示|线索)|不要.{0,6}(?:答案|解答)|先.{0,4}提示/.test(value)) return "hint";
    if (/检查|核对|是否正确|哪里错|纠错/.test(value)) return "check";
    if (/变式|类似题|再出.{0,4}题/.test(value)) return "variant";
    if (/完整|分步|步骤|解答|求解|计算|求出|答案|证明|推导/.test(value)) return "steps";
    if (/为什么|解释|含义|理解|区别|原因|只|仅/.test(value)) return "explain";
    return "steps";
  }

  function gatewayChatRequest(body) {
    const rule = body.responseLevel === "hint"
      ? "只给一条关键提示，勿给最终答案。"
      : body.responseLevel === "explain"
      ? "只解释本次指定的概念或子问题，不重讲整题。"
      : "覆盖本次要求的全部小问；条件充分即解答，条件不足则指出缺失条件，勿补造数值。";
    const message = body.message + "\n\n【回答规范】" + rule +
      "输出前复核条件、计算、单位和边界。用必要的紧凑步骤，以短动作标题开始，不添加开场总结；计算放在前面的步骤，最后一步仅汇总各小问的简短结论，有物理量时写单位，纯数学不补“无单位”说明；finalAnswer 逐字复制该步结论，勿同义重写。核心公式用 LaTeX，行内公式用 \\( \\) 包围，分式用 \\frac，根号用 \\sqrt，下标和幂用花括号；化学式应整体放在同一数学片段内，勿只包住下标；formulas 不带分隔符且只列真正关键的关系。followUp 除提示、变式或必要澄清外留空。";
    if (message.length > 2000) throw new TutorRequestError("MESSAGE_TOO_LONG");
    const request = { ...body, message, history: (body.history || []).map(item => ({ ...item })) };
    while (request.history.length && new TextEncoder().encode(JSON.stringify(request)).length > MAX_CHAT_REQUEST_BYTES) {
      request.history.shift();
      if (request.history[0]?.role === "assistant") request.history.shift();
    }
    if (new TextEncoder().encode(JSON.stringify(request)).length > MAX_CHAT_REQUEST_BYTES) throw new TutorRequestError("BODY_TOO_LARGE");
    return request;
  }

  function validateGatewayChat(raw, responseLevel) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw) ||
      !["hint", "explain", "steps", "answer", "clarification", "refusal"].includes(raw.mode)) {
      throw new TutorRequestError("INVALID_AI_RESPONSE");
    }
    const value = softValidateChat(raw, responseLevel);
    if (!value) throw new TutorRequestError("INVALID_AI_RESPONSE");
    return { ...value, source: text(raw.source) || "gateway", model: raw.model || value.model,
      parameterPatch: raw.parameterPatch || null };
  }

  async function apiRequest(path, body, timeoutMs) {
    if (hasBrowserApiKey()) {
      if (path === "/api/v1/tutor/chat") return browserTutorChat(body);
      if (path === "/api/v1/experiment/generate") {
        return browserGenerate(body.question, body.preferredSubject || "");
      }
    }
    if (path === "/api/v1/tutor/chat") body = gatewayChatRequest(body);
    if (state.controller) state.controller.abort();
    const controller = new AbortController();
    state.controller = controller;
    const timeoutId = window.setTimeout(() => controller.abort("timeout"), timeoutMs);
    state.timeoutId = timeoutId;
    try {
      let response;
      try {
        response = await fetch(`${API_BASE_URL}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal
        });
      } catch (error) {
        if (controller.signal.aborted) {
          throw new TutorRequestError(controller.signal.reason === "timeout" ? "AI_TIMEOUT" : "ABORTED");
        }
        throw new TutorRequestError("NETWORK_ERROR");
      }
      let payload = {};
      try {
        payload = await response.json();
      } catch {
        // 网关休眠或故障时返回 HTML 或空内容：提示“服务暂不可用”，不要说成“返回格式不符合约定”
        if (!response.ok) throw new TutorRequestError(response.status === 429 ? "RATE_LIMITED" : "AI_UNAVAILABLE", response.status);
        throw new TutorRequestError("INVALID_AI_RESPONSE", response.status);
      }
      if (!response.ok) {
        const code = payload && typeof payload.error === "string" ? payload.error :
          (response.status === 429 ? "RATE_LIMITED" : "AI_UNAVAILABLE");
        throw new TutorRequestError(code, response.status);
      }
      return path === "/api/v1/tutor/chat" ? validateGatewayChat(payload, body.responseLevel) : payload;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new TutorRequestError(controller.signal.reason === "timeout" ? "AI_TIMEOUT" : "ABORTED");
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
      if (state.timeoutId === timeoutId) state.timeoutId = null;
      if (state.controller === controller) state.controller = null;
    }
  }

  function currentHostContext() {
    const context = host().getContext?.();
    if (context && typeof context === "object") return context;
    const question = document.querySelector("#questionInput")?.value?.trim() || "";
    return {
      mode: "question",
      subject: "",
      originalQuestion: question,
      templateId: "",
      parameters: {},
      deterministicResult: {},
      formula: "",
      currentStep: ""
    };
  }

  function updateContext(context = currentHostContext()) {
    state.context = context;
    const isExperiment = context.mode === "experiment" && context.templateId;
    const subject = subjectLabel(context.subject);
    elements.contextTitle.textContent = isExperiment
      ? `${subject} · ${context.title || "当前实验"}`
      : `${subject} · AI 题目讲解`;
    elements.contextText.textContent = context.originalQuestion ||
      (isExperiment ? "我会结合当前参数、公式和实验结论回答。" : "输入一道中学数理化生题目开始提问。 ");
    elements.status.textContent = isExperiment
      ? "已连接当前实验的确定性计算结果"
      : "当前题目暂无可视化模板，由 AI 导师提供分步讲解";
  }

  function updateRoute() {
    state.route = window.location.hash.startsWith("#/ai-tutor");
    document.body.classList.toggle("ai-tutor-route", state.route);
    if (state.route) {
      openWorkspace(false);
      updateContext(state.context || currentHostContext());
    }
  }

  function openWorkspace(scroll = true) {
    state.open = true;
    elements.grid?.classList.add("ai-tutor-open");
    elements.workspace.setAttribute("aria-hidden", "false");
    updateContext(state.context || currentHostContext());
    if (scroll) {
      window.setTimeout(() => elements.workspace.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth", block: "start" }), 40);
    }
  }

  function closeWorkspace() {
    if (state.route) {
      window.location.hash = "";
      return;
    }
    state.open = false;
    elements.grid?.classList.remove("ai-tutor-open");
    elements.workspace.setAttribute("aria-hidden", "true");
  }

  function openStandalone(context = currentHostContext()) {
    adoptContext(context);
    if (!window.location.hash.startsWith("#/ai-tutor")) {
      window.location.hash = "#/ai-tutor";
    } else {
      updateRoute();
    }
  }

  function stopRequest() {
    if (!state.controller) return;
    const controller = state.controller;
    state.controller = null;
    controller.abort("user");
  }

  function contextScope(context) {
    if (!context || typeof context !== "object") return "";
    const parameters = Object.entries(context.parameters || {}).sort(([a], [b]) => a.localeCompare(b));
    // Animation time and teaching step changes do not change the problem.
    return JSON.stringify([context.mode, context.subject, context.templateId,
      text(context.originalQuestion), parameters]);
  }

  function resetConversation(statusMessage = "对话已清空，可以从当前题目重新开始") {
    state.requestSerial += 1;
    stopRequest();
    clearPending();
    setBusy(false);
    state.messages = [];
    state.lastRequest = null;
    state.lastError = null;
    state.sessionId = globalThis.crypto?.randomUUID?.() || `master-lab-${Date.now()}`;
    elements.messages.querySelectorAll(".ai-message").forEach((node) => node.remove());
    elements.empty.hidden = false;
    elements.status.textContent = statusMessage;
  }

  function adoptContext(nextContext, options = {}) {
    const next = nextContext || currentHostContext();
    const previousScope = contextScope(state.context);
    const nextScope = contextScope(next);
    if (options.resetOnScopeChange !== false && previousScope && nextScope && previousScope !== nextScope && state.messages.length) {
      resetConversation("题目或参数已切换，旧回答已停止，已开始新的导师会话");
    }
    state.context = next;
    return next;
  }

  function clearPending() {
    if (state.pendingTimer) {
      window.clearInterval(state.pendingTimer);
      state.pendingTimer = null;
    }
    state.pendingNode?.remove();
    state.pendingNode = null;
    state.pendingStartedAt = 0;
    state.pendingExpanded = false;
  }

  function thinkingCopy(responseLevel) {
    const titles = {
      hint: "正在提炼一个关键线索",
      explain: "正在连接实验现象与公式",
      check: "正在核对条件、单位与结论",
      variant: "正在设计一组可比较的变式",
      steps: "正在整理可核查的分步解答"
    };
    return {
      title: titles[responseLevel] || "正在理解你的问题",
      stages: [
        "正在读取题目条件与实验上下文",
        "正在组织公式、概念与讲解顺序",
        "正在核对单位、表达与结论"
      ]
    };
  }

  function randomUnit() {
    if (globalThis.crypto?.getRandomValues) {
      const value = new Uint32Array(1);
      globalThis.crypto.getRandomValues(value);
      return value[0] / 0xFFFFFFFF;
    }
    return Math.random();
  }

  function applyThinkingPalette(field) {
    const baseHue = Math.round(randomUnit() * 359);
    const ringHue = (baseHue + 95 + Math.round(randomUnit() * 35)) % 360;
    const moonHue = (baseHue + 205 + Math.round(randomUnit() * 35)) % 360;
    field.style.setProperty("--thinking-planet-hue", String(baseHue));
    field.style.setProperty("--thinking-ring-hue", String(ringHue));
    field.style.setProperty("--thinking-moon-hue", String(moonHue));
    field.style.setProperty("--thinking-spectrum-delay", `${(-randomUnit() * 9).toFixed(2)}s`);
    field.style.setProperty("--thinking-orbit-delay", `${(-randomUnit() * 3.4).toFixed(2)}s`);
  }

  function attachThinkingPointerEffects(field) {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const reset = () => {
      field.classList.remove("is-pointer-active");
      field.style.setProperty("--thinking-tilt-x", "0deg");
      field.style.setProperty("--thinking-tilt-y", "0deg");
      field.style.setProperty("--thinking-light-x", "50%");
      field.style.setProperty("--thinking-light-y", "52%");
    };
    field.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch" || reducedMotion?.matches) return;
      const bounds = field.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const xRatio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
      const yRatio = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
      field.style.setProperty("--thinking-tilt-x", `${((xRatio - .5) * 10).toFixed(2)}deg`);
      field.style.setProperty("--thinking-tilt-y", `${((.5 - yRatio) * 8).toFixed(2)}deg`);
      field.style.setProperty("--thinking-light-x", `${Math.round(28 + xRatio * 44)}%`);
      field.style.setProperty("--thinking-light-y", `${Math.round(30 + yRatio * 42)}%`);
      field.classList.add("is-pointer-active");
    });
    field.addEventListener("pointerleave", reset);
    field.addEventListener("pointercancel", reset);
  }

  function thinkingElapsedLabel(seconds, live = true) {
    if (seconds < 1) return live ? "刚刚开始" : "已思考";
    return live ? `思考中 · ${seconds} 秒` : `已思考 ${seconds} 秒`;
  }

  function updatePendingReasoning(value) {
    state.pendingReasoning = String(value || "");
    const trace = state.pendingNode?.querySelector(".ai-thinking-trace-text");
    const empty = state.pendingNode?.querySelector(".ai-thinking-trace-empty");
    if (trace) {
      trace.textContent = state.pendingReasoning;
      if (state.pendingExpanded) {
        const panel = state.pendingNode.querySelector(".ai-thinking-trace");
        if (panel) panel.scrollTop = panel.scrollHeight;
      }
    }
    if (empty) empty.hidden = Boolean(state.pendingReasoning);
  }

  function setPendingExpanded(expanded) {
    state.pendingExpanded = Boolean(expanded);
    const card = state.pendingNode?.querySelector(".ai-thinking-card");
    const toggle = state.pendingNode?.querySelector(".ai-thinking-badge");
    const panel = state.pendingNode?.querySelector(".ai-thinking-trace");
    card?.classList.toggle("is-expanded", state.pendingExpanded);
    if (toggle) {
      toggle.setAttribute("aria-expanded", String(state.pendingExpanded));
      const caret = toggle.querySelector(".ai-thinking-caret");
      if (caret) caret.textContent = state.pendingExpanded ? "▾" : "▸";
    }
    if (panel) {
      panel.hidden = !state.pendingExpanded;
      if (state.pendingExpanded) panel.scrollTop = panel.scrollHeight;
    }
  }

  function updatePendingMessage() {
    if (!state.pendingNode || !state.pendingStartedAt) return;
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - state.pendingStartedAt) / 1000));
    const badge = state.pendingNode.querySelector(".ai-thinking-badge-label");
    const elapsed = state.pendingNode.querySelector(".ai-thinking-elapsed");
    const liveThinking = state.pendingNode.querySelector(".ai-thinking-badge")?.tagName === "BUTTON";
    if (badge) badge.textContent = liveThinking ? "思考中" : "正在生成";
    if (elapsed) elapsed.textContent = liveThinking ? thinkingElapsedLabel(elapsedSeconds, true) : "已等待 " + elapsedSeconds + " 秒";
  }

  function addPendingMessage(responseLevel = "hint") {
    clearPending();
    elements.empty.hidden = true;
    state.pendingReasoning = "";
    state.pendingExpanded = false;
    const copy = thinkingCopy(responseLevel);
    const row = createElement("div", "ai-message assistant pending ai-thinking-row");
    row.setAttribute("role", "status");
    row.setAttribute("aria-live", "polite");
    row.setAttribute("aria-label", `AI 导师正在处理：${copy.title}`);

    const bubble = createElement("div", "ai-message-bubble ai-thinking-card");
    const header = createElement("div", "ai-thinking-header");
    header.append(createElement("span", "ai-message-source", "大师 · AI 导师"));
    const useThinking = hasBrowserApiKey() && (responseLevel === "steps" || responseLevel === "check");
    const badge = createElement(useThinking ? "button" : "span", "ai-thinking-badge");
    if (useThinking) {
      badge.type = "button";
      badge.setAttribute("aria-expanded", "false");
      badge.setAttribute("aria-controls", "aiThinkingTrace");
      badge.title = "点击查看实时思考过程";
    }
    badge.append(createElement("i"));
    badge.append(createElement("span", "ai-thinking-badge-label", useThinking ? "思考中" : "正在生成"));
    if (useThinking) badge.append(createElement("span", "ai-thinking-caret", "▸"));
    if (useThinking) {
      badge.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setPendingExpanded(!state.pendingExpanded);
      });
    }
    header.append(badge);

    const body = createElement("div", "ai-thinking-body");
    const visual = createElement("div", "ai-thinking-visual");
    visual.setAttribute("aria-hidden", "true");
    const field = createElement("div", "ai-thinking-field");
    applyThinkingPalette(field);
    attachThinkingPointerEffects(field);
    const orbit = createElement("span", "ai-thinking-orbit");
    const planet = createElement("span", "ai-thinking-planet");
    planet.append(createElement("span", "ai-thinking-planet-core"));
    const moon = createElement("span", "ai-thinking-moon");
    moon.append(createElement("span", "ai-thinking-moon-core"));
    orbit.append(
      createElement("span", "ai-thinking-orbit-track orbit-back"),
      planet,
      createElement("span", "ai-thinking-orbit-track orbit-front"),
      moon
    );
    field.append(orbit);
    visual.append(field);

    const copyNode = createElement("div", "ai-thinking-copy");
    copyNode.append(createElement("strong", "", copy.title));
    copyNode.append(createElement("p", "ai-thinking-stage", useThinking
      ? "思维链已折叠，点击“思考中”可查看实时过程。"
      : "正在等待 AI 回答，可随时停止。"));
    const meta = createElement("div", "ai-thinking-meta");
    meta.append(
      createElement("span", "ai-thinking-elapsed", "刚刚开始"),
      createElement("span", "", "可随时点击“停止”")
    );
    copyNode.append(meta);
    body.append(visual, copyNode);

    const trace = createElement("div", "ai-thinking-trace");
    trace.id = "aiThinkingTrace";
    trace.hidden = true;
    const empty = createElement("p", "ai-thinking-trace-empty", useThinking
      ? "正在进入思考，展开后会实时显示过程。"
      : "当前为快速模式，没有深度思考过程。");
    const textNode = createElement("pre", "ai-thinking-trace-text");
    trace.append(empty, textNode);

    bubble.append(header, body, trace);
    row.append(bubble);
    elements.messages.append(row);
    state.pendingNode = row;
    state.pendingStartedAt = Date.now();
    state.pendingTimer = window.setInterval(() => updatePendingMessage(), 1000);
    updatePendingMessage();
    elements.messages.scrollTop = elements.messages.scrollHeight;
  }

  function createReasoningToggle(reasoning, seconds) {
    const details = createElement("div", "ai-reasoning-block");
    const button = createElement("button", "ai-thinking-badge ai-reasoning-toggle");
    button.type = "button";
    button.setAttribute("aria-expanded", "false");
    button.append(createElement("i"));
    button.append(createElement("span", "", thinkingElapsedLabel(seconds || 0, false)));
    button.append(createElement("span", "ai-thinking-caret", "▸"));
    const panel = createElement("pre", "ai-thinking-trace-text ai-reasoning-panel");
    panel.hidden = true;
    panel.textContent = reasoning;
    button.addEventListener("click", () => {
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!expanded));
      button.classList.toggle("is-expanded", !expanded);
      panel.hidden = expanded;
      button.querySelector(".ai-thinking-caret").textContent = expanded ? "▸" : "▾";
    });
    details.append(button, panel);
    return details;
  }

  const NEGATIVE_UNIT_POWER = Object.freeze({
    "1": "⁻¹",
    "2": "⁻²",
    "3": "⁻³",
    "¹": "⁻¹",
    "²": "⁻²",
    "³": "⁻³"
  });

  const POSITIVE_UNIT_POWER = Object.freeze({
    "1": "¹",
    "2": "²",
    "3": "³",
    "¹": "¹",
    "²": "²",
    "³": "³"
  });

  function unitPowerToken(value, fallback = "1") {
    return text(value).match(/[123¹²³]/)?.[0] || fallback;
  }

  function normalizeMathSource(value) {
    let source = text(value)
      .replace(/\\(?:left|right)/g, "")
      .replace(/\\dfrac/g, "\\frac")
      .replace(/\\tfrac/g, "\\frac")
      .replace(/\\times/g, "×")
      .replace(/\\cdot/g, "·")
      .replace(/\\div/g, "÷")
      .replace(/\\leq?/g, "≤")
      .replace(/\\geq?/g, "≥")
      .replace(/\\neq/g, "≠")
      .replace(/\\approx/g, "≈")
      .replace(/\\pm/g, "±")
      .replace(/\\Delta/g, "Δ")
      .replace(/\\theta/g, "θ")
      .replace(/\\omega/g, "ω")
      .replace(/\\rho/g, "ρ")
      .replace(/\\mu/g, "μ")
      .replace(/\\(?:mathrm|text)\{([^{}]+)\}/g, "$1")
      .replace(/\\[()[\]]/g, "")
      .replace(/\$+/g, "")
      .replace(/\\[,;!]/g, " ")
      .replace(/([0-9A-Za-z)])\s*\*\s*(?=[(0-9A-Za-z−-])/g, "$1 × ")
      .replace(/-(?=\d)/g, "−");

    source = source
      .replace(/J\s*\/\s*\(\s*kg\s*[·×*]\s*(?:℃|°C|K)\s*\)/g, (unit) => {
        const temperatureUnit = /K/.test(unit) ? "K" : "℃";
        return `J·kg⁻¹·${temperatureUnit}⁻¹`;
      })
      .replace(/\b(m|km|cm|mm|kg|g|N|J|W|Pa|mol)(?:\s*((?:\^|\*\*)\s*[123]|[¹²³]))?\s*\/\s*(s|h|kg|m|cm|L)(?:\s*((?:\^|\*\*)\s*[123]|[¹²³]))?/g,
        (_, numerator, numeratorPowerSource, denominator, denominatorPowerSource) => {
          const numeratorPower = numeratorPowerSource
            ? POSITIVE_UNIT_POWER[unitPowerToken(numeratorPowerSource)]
            : "";
          const denominatorPower = NEGATIVE_UNIT_POWER[unitPowerToken(denominatorPowerSource)];
          return `${numerator}${numeratorPower}·${denominator}${denominatorPower}`;
        });

    return source;
  }

  function readBalancedGroup(source, startIndex, opener = "{", closer = "}") {
    if (source[startIndex] !== opener) return null;
    let depth = 0;
    for (let index = startIndex; index < source.length; index += 1) {
      if (source[index] === opener) depth += 1;
      if (source[index] === closer) depth -= 1;
      if (depth === 0) {
        return {
          value: source.slice(startIndex + 1, index),
          end: index + 1
        };
      }
    }
    return null;
  }

  function readScriptToken(source, startIndex) {
    if (source[startIndex] === "{") return readBalancedGroup(source, startIndex);
    if (source[startIndex] === "(") return readBalancedGroup(source, startIndex, "(", ")");
    if (/[+\-−]/.test(source[startIndex] || "") && /[A-Za-z0-9]/.test(source[startIndex + 1] || "")) {
      let end = startIndex + 2;
      while (/\d/.test(source[end] || "")) end += 1;
      return { value: source.slice(startIndex, end), end };
    }
    if (!source[startIndex]) return null;
    return { value: source[startIndex], end: startIndex + 1 };
  }

  function appendScriptedText(container, value) {
    const source = text(value);
    const basePattern = /[A-Za-zΑ-Ωα-ω]/;
    for (let index = 0; index < source.length;) {
      const base = source[index];
      if (base === "\\" && source[index + 1] === "_") {
        container.append(document.createTextNode("_"));
        index += 2;
        continue;
      }
      if (base === "^") {
        const superscript = readScriptToken(source, index + 1);
        if (superscript) {
          const node = document.createElement("sup");
          appendScriptedText(node, superscript.value.replace(/-/g, "−"));
          container.append(node);
          index = superscript.end;
          continue;
        }
      }
      if (!basePattern.test(base)) {
        container.append(document.createTextNode(base));
        index += 1;
        continue;
      }

      container.append(document.createTextNode(base));
      let cursor = index + 1;
      let subscript = null;
      let superscript = null;

      if (source[cursor] === "_") {
        subscript = readScriptToken(source, cursor + 1);
        if (subscript) cursor = subscript.end;
      } else if (/\d/.test(source[cursor] || "")) {
        const previous = source[index - 1] || "";
        const canUseImplicitSubscript = !/[A-Za-z]/.test(previous) || /[A-Z]/.test(base);
        if (canUseImplicitSubscript) {
          let end = cursor + 1;
          while (/\d/.test(source[end] || "")) end += 1;
          subscript = { value: source.slice(cursor, end), end };
          cursor = end;
        }
      } else if (/[AB]/.test(source[cursor] || "") && /[avFxy]/.test(base)) {
        const after = source[cursor + 1] || "";
        if (!/[A-Za-z]/.test(after)) {
          subscript = { value: source[cursor], end: cursor + 1 };
          cursor += 1;
        }
      }

      if (source[cursor] === "^") {
        superscript = readScriptToken(source, cursor + 1);
        if (superscript) cursor = superscript.end;
      }

      if (subscript) {
        const node = document.createElement("sub");
        appendScriptedText(node, subscript.value);
        container.append(node);
      }
      if (superscript) {
        const node = document.createElement("sup");
        appendScriptedText(node, superscript.value.replace(/-/g, "−"));
        container.append(node);
      }
      index = cursor;
    }
  }

  function findLatexFraction(source, startIndex) {
    const index = source.indexOf("\\frac", startIndex);
    if (index < 0) return null;
    let cursor = index + 5;
    while (/\s/.test(source[cursor] || "")) cursor += 1;
    const numerator = readBalancedGroup(source, cursor);
    if (!numerator) return null;
    cursor = numerator.end;
    while (/\s/.test(source[cursor] || "")) cursor += 1;
    const denominator = readBalancedGroup(source, cursor);
    if (!denominator) return null;
    return {
      index,
      end: denominator.end,
      numerator: numerator.value,
      denominator: denominator.value
    };
  }

  function looksLikeMathAtom(value) {
    const atom = text(value).replace(/^\(|\)$/g, "");
    return /\d/.test(atom) || /^[A-Za-zΑ-Ωα-ω](?:[_^²³⁻⁺].*)?$/.test(atom);
  }

  function findSlashFraction(source, startIndex, aggressive = false) {
    const atom = "(?:\\([^()\\n]{1,64}\\)|[-+−]?[A-Za-zΑ-Ωα-ω0-9_{}^²³⁻⁺.·×]+)";
    const pattern = new RegExp(`(${atom})\\s*\\/\\s*(${atom})`, "g");
    pattern.lastIndex = startIndex;
    let match;
    while ((match = pattern.exec(source))) {
      if (source.slice(Math.max(0, match.index - 3), match.index + 1).includes("://")) continue;
      if (!aggressive && (!looksLikeMathAtom(match[1]) || !looksLikeMathAtom(match[2]))) continue;
      return {
        index: match.index,
        end: match.index + match[0].length,
        numerator: match[1],
        denominator: match[2]
      };
    }
    return null;
  }

  function appendFraction(container, numerator, denominator) {
    const fraction = createElement("span", "ai-safe-fraction");
    fraction.setAttribute("aria-label", `${numerator} 除以 ${denominator}`);
    const numeratorNode = createElement("span", "ai-safe-fraction-num");
    const denominatorNode = createElement("span", "ai-safe-fraction-den");
    appendMathContent(numeratorNode, numerator, { aggressiveFractions: true });
    appendMathContent(denominatorNode, denominator, { aggressiveFractions: true });
    fraction.append(numeratorNode, denominatorNode);
    container.append(fraction);
  }

  function appendLegacyMathContent(container, value, options = {}) {
    const source = normalizeMathSource(value);
    container.classList.add("ai-rich-math");
    let cursor = 0;
    while (cursor < source.length) {
      const latexFraction = findLatexFraction(source, cursor);
      const slashFraction = findSlashFraction(source, cursor, options.aggressiveFractions);
      const candidates = [latexFraction, slashFraction].filter(Boolean).sort((a, b) => a.index - b.index);
      const nextFraction = candidates[0];
      if (!nextFraction) {
        appendScriptedText(container, source.slice(cursor));
        break;
      }
      if (nextFraction.index > cursor) appendScriptedText(container, source.slice(cursor, nextFraction.index));
      appendFraction(container, nextFraction.numerator, nextFraction.denominator);
      cursor = nextFraction.end;
    }
  }

  function appendKatex(container, source, inline = true) {
    const node = createElement("span", inline ? "ai-inline-math" : "ai-display-math");
    if (!window.katex) return false;
    try {
      window.katex.render(source, node, { throwOnError: true, trust: false,
        strict: "ignore", output: "htmlAndMathml", maxExpand: 1000, maxSize: 10, displayMode: false });
    } catch {
      throw new TutorRequestError("INVALID_MATH");
    }
    container.append(node);
    return true;
  }

  function appendMathContent(container, value, options = {}) {
    const source = text(value);
    if ((source.match(/\\\(/g) || []).length !== (source.match(/\\\)/g) || []).length ||
      (source.match(/\\\[/g) || []).length !== (source.match(/\\\]/g) || []).length) throw new TutorRequestError("INVALID_MATH");
    container.classList.add("ai-rich-math");
    const hasDelimitedMath = source.includes("\\(") || source.includes("\\[") || source.includes("$");
    if (options.aggressiveFractions && !hasDelimitedMath && window.katex && !/<\/?(?:img|svg|script|iframe|div|span)\b/i.test(source)) {
      const formula = source.replace(/^\s*(?:\$\$?|\\\(|\\\[)/, "").replace(/(?:\$\$?|\\\)|\\\])\s*$/, "");
      appendKatex(container, formula, false);
      return;
    }
    const pattern = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/g;
    let cursor = 0;
    for (const match of source.matchAll(pattern)) {
      appendLegacyMathContent(container, source.slice(cursor, match.index), options);
      const formula = match[1] ?? match[2] ?? match[3] ?? match[4];
      if (!appendKatex(container, formula)) appendLegacyMathContent(container, formula, options);
      cursor = match.index + match[0].length;
    }
    appendLegacyMathContent(container, source.slice(cursor), options);
  }

  function createMathElement(tagName, className, value, options = {}) {
    const node = createElement(tagName, className);
    appendMathContent(node, value, options);
    return node;
  }

  function stripStepNumber(value) {
    return text(value).replace(/^\s*(?:步骤\s*)?\d+\s*[.、:：]\s*/, "");
  }

  function appendFormula(container, formula) {
    const line = createElement("div", "ai-formula-line");
    appendMathContent(line, formula, { aggressiveFractions: true });
    container.append(line);
  }

  function createStepElement(className, step) {
    const item = createElement("li", className);
    const title = step.match(/^(条件|分析|列式|代入|求解|计算|分类|核对|检验|结论|答案|取正方向)\s*[:：]/);
    if (title) {
      item.append(createElement("strong", "ai-step-title", title[0]));
      appendMathContent(item, step.slice(title[0].length));
    } else appendMathContent(item, step);
    return item;
  }

  function answerTextKey(value) {
    return normalizeMathSource(text(value)).replace(/[\s，,。.;；:：]/g, "");
  }

  function getAnswerPresentation(payload, options = {}) {
    const level = options.responseLevel || payload.mode;
    const steps = asTextList(payload.steps, 8, 1200).map(stripStepNumber);
    const summary = text(payload.summary);
    let lead = !steps.length || ["clarification", "refusal"].includes(payload.mode) ? summary : "";
    let result = level === "hint" || payload.mode === "hint" ? "" : text(payload.finalAnswer);
    if (result && steps.length) {
      // Only collapse literal equivalents. Similar numbers are not proof that
      // every requested sub-answer is present in the last step.
      const lastKey = answerTextKey(steps.at(-1));
      const resultKey = answerTextKey(result);
      const conclusionOnly = steps.at(-1).match(/^(?:最终(?:答案|结论)|答案|结论|结果)\s*[:：]\s*(.+)$/s);
      if (lastKey.includes(resultKey)) {
        result = "";
      } else if (conclusionOnly && resultKey.includes(answerTextKey(conclusionOnly[1]))) {
        // A final-answer-only step may omit a subject prefix. Replacing it is
        // safe only when all its text is literally contained in finalAnswer.
        steps[steps.length - 1] = result;
        result = "";
      }
    } else if (result && !steps.length) {
      if (answerTextKey(lead) === answerTextKey(result)) lead = "";
      steps.push(result);
      result = "";
    }
    const seen = new Set();
    const formulas = asTextList(payload.formulas, 8, 300).filter((formula) => {
      const key = answerTextKey(formula);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const requestedFollowUp = ["hint", "variant"].includes(level) || payload.mode === "clarification" ||
      /追问|变式|练习|类似题|再出.{0,8}题|提问|问题引导/.test(options.message || "");
    return {
      lead, steps, result, formulas,
      followUp: requestedFollowUp ? text(payload.followUp) : "",
      // Remove only the duplicate page-level disclaimer. Actual limitations,
      // incomplete-answer alerts and offline-status warnings remain visible.
      warnings: asTextList(payload.warnings, 5, 300).filter((warning) =>
        warning !== "AI 讲解可能存在误差，请结合教材与教师要求核对。")
    };
  }

  function structuredToHistoryText(payload, options = {}) {
    const display = getAnswerPresentation(payload, options);
    return [display.lead, ...display.steps, display.result, ...display.formulas,
      display.followUp, ...display.warnings].filter(Boolean).join("\n").slice(0, 1800);
  }

  function renderAssistantPayload(bubble, payload, options = {}) {
    const display = getAnswerPresentation(payload, options);
    if (display.lead) bubble.append(createMathElement("p", "ai-answer-summary", display.lead));
    if (display.steps.length) {
      const section = createElement("section", "ai-answer-section solution-section");
      section.append(createElement("h4", "", "解题步骤"));
      const list = createElement("ol");
      display.steps.forEach((step, index) => {
        const last = index === display.steps.length - 1;
        const item = createStepElement(last ? "ai-final-step" : "", step);
        if (last && display.result) item.append(createMathElement("p", "ai-step-result", display.result));
        list.append(item);
      });
      section.append(list);
      bubble.append(section);
    }
    if (display.formulas.length) {
      const section = createElement("section", "ai-answer-section formula-section");
      section.append(createElement("h4", "", "关键公式"));
      display.formulas.forEach((formula) => appendFormula(section, formula));
      bubble.append(section);
    }
    if (display.followUp) bubble.append(createMathElement("p", "ai-follow-up", display.followUp));
    if (payload.parameterPatch) bubble.append(renderPatch(payload.parameterPatch));
    if (display.warnings.length) {
      const warning = createElement("div", "ai-answer-warning");
      display.warnings.forEach((item) => warning.append(createMathElement("span", "", item)));
      bubble.append(warning);
    }
  }

  function renderPatch(patch) {
    const card = createElement("div", "ai-parameter-patch");
    const copy = createElement("div");
    copy.append(createElement("span", "", "参数建议"));
    copy.append(createElement("strong", "", `${patch.parameterKey} → ${smartNumber(patch.nextValue)}`));
    copy.append(createElement("p", "", patch.reason || "用于比较变量变化"));
    const button = createElement("button", "", "确认应用到实验");
    button.type = "button";
    button.addEventListener("click", () => {
      if (!window.confirm("确认把这项参数建议应用到当前实验吗？")) return;
      const result = host().applyParameterPatch?.(patch);
      if (result?.ok) {
        button.disabled = true;
        button.textContent = "已应用";
        updateContext(currentHostContext());
      } else {
        host().showToast?.(result?.message || "当前实验暂不支持应用这项参数");
      }
    });
    card.append(copy, button);
    return card;
  }

  function addMessage(role, payload, options = {}) {
    elements.empty.hidden = true;
    const row = createElement("div", `ai-message ${role}${options.error ? " error" : ""}`);
    const bubble = createElement("div", "ai-message-bubble");
    bubble.append(createElement("span", "ai-message-source", role === "user" ? "你" : options.source === "local_fallback" ? "大师 · 本地提示" : "大师 · AI 导师"));
    if (role === "user") {
      bubble.append(createElement("p", "", text(payload)));
      state.messages.push({ role, content: text(payload) });
    } else if (options.error) {
      bubble.append(createElement("p", "", text(payload)));
    } else {
      if (payload.reasoning) {
        bubble.append(createReasoningToggle(payload.reasoning, payload.thinkingSeconds));
      }
      renderAssistantPayload(bubble, payload, options);
      state.messages.push({ role, content: structuredToHistoryText(payload, options) });
    }
    row.append(bubble);
    elements.messages.append(row);
    elements.messages.scrollTop = elements.messages.scrollHeight;
    return row;
  }

  function boundedHistory() {
    return state.messages.slice(-MAX_HISTORY_ITEMS).map(({ role, content }) => ({ role, content }));
  }

  async function sendChat(message, responseLevel = "hint", options = {}) {
    const content = text(message);
    if (!content || state.controller) return null;
    const requestSerial = ++state.requestSerial;
    openWorkspace(false);
    updateContext(state.context || currentHostContext());
    const history = boundedHistory();
    if (!options.silentUser) addMessage("user", content);
    const request = {
      sessionId: state.sessionId,
      message: content,
      responseLevel,
      history,
      context: JSON.parse(JSON.stringify(state.context))
    };
    state.lastRequest = {
      message: content,
      responseLevel,
      options: { silentUser: Boolean(options.silentUser) }
    };
    state.lastError = null;
    addPendingMessage(responseLevel);
    setBusy(true, responseLevel === "steps" || responseLevel === "check" ? "正在严谨核对步骤，这可能需要更长时间" : "正在结合当前题目整理提示");
    try {
      const payload = await apiRequest("/api/v1/tutor/chat", request, CHAT_TIMEOUT_MS);
      if (requestSerial !== state.requestSerial) return null;
      clearPending();
      addMessage("assistant", payload, { source: payload.source, responseLevel, message: content });
      elements.status.textContent = payload.source === "local_fallback" ? "AI 未连接，当前显示本地教学提示" : "回答完成，可继续追问";
      return payload;
    } catch (error) {
      if (requestSerial !== state.requestSerial) return null;
      clearPending();
      state.lastError = error;
      addMessage("assistant", errorMessage(error), { error: true });
      elements.status.textContent = "本次回答未完成，题目与实验状态已保留";
      return null;
    } finally {
      if (requestSerial === state.requestSerial) setBusy(false);
    }
  }

  function planToQuestion(plan) {
    if (!plan?.modules || plan.modules.length !== 1) return null;
    const module = plan.modules[0];
    const p = module.parameters || {};
    const extraIdMap = {
      lever: "lever",
      lens: "lens",
      buoyancy: "buoyancy",
      friction: "friction",
      lamp_power: "lampPower",
      series_circuit: "seriesCircuit",
      heat_balance: "heatBalance",
      liquid_pressure: "liquidPressure",
      efficiency: "efficiency",
      sound: "sound"
    };
    if (extraIdMap[module.templateId]) {
      const template = window.EXTRA_PHYSICS_TEMPLATES?.[extraIdMap[module.templateId]];
      const parameterPairs = {
        lever: [p.leftForce, p.leftArm],
        lens: [p.objectDistance, p.focalLength],
        buoyancy: [p.displacedVolume, p.density],
        friction: [p.normalForce, p.frictionCoefficient],
        lamp_power: [p.voltage, p.current],
        series_circuit: [p.voltage, p.resistance],
        heat_balance: [p.hotWaterMass, p.hotTemperature],
        liquid_pressure: [p.depthCm, p.density],
        efficiency: [p.loadForce, p.pullForce],
        sound: [p.frequency, p.amplitudePercent]
      };
      const pair = parameterPairs[module.templateId];
      if (template?.question && pair?.every(Number.isFinite)) {
        return { question: template.question(pair[0], pair[1]), subject: "物理" };
      }
      return null;
    }
    if (module.templateId === "brake") {
      return { question: `一辆汽车以 ${smartNumber(p.initialSpeed)}m/s 的速度行驶，紧急刹车后加速度大小为 ${smartNumber(p.deceleration)}m/s²，求刹车距离。`, subject: "物理" };
    }
    if (module.templateId === "solenoid") {
      return { question: `一个${smartNumber(p.turns, 0)}匝的通电螺线管接入${smartNumber(p.current)}A电流。从左端观察，线圈中的电流沿逆时针方向，请判断左右两端磁极。`, subject: "物理" };
    }
    if (module.templateId === "board_slider") {
      return { question: `光滑水平地面上放有一块质量为1.0kg、长度为${smartNumber(p.boardLength)}m的木板B。质量为1.0kg的滑块A位于木板左端，以${smartNumber(p.initialSpeed)}m/s向右滑动，动摩擦因数为0.20，取g=10m/s²，判断是否滑落。`, subject: "物理" };
    }
    if (module.templateId === "projectile") {
      return { question: `小球以${smartNumber(p.horizontalSpeed)}m/s的水平速度从${smartNumber(p.height)}m高的平台水平抛出，不计空气阻力，求落地时间和水平位移。`, subject: "物理" };
    }
    if (module.templateId === "ohm_circuit") {
      return { question: `某纯电阻电路两端电压为${smartNumber(p.voltage)}V，电阻为${smartNumber(p.resistance)}Ω，求电路中的电流。`, subject: "物理" };
    }
    if (module.templateId === "fe_cuso4") {
      const mol = Number.isFinite(p.copperSulfateMass) ? p.copperSulfateMass / 160 : NaN;
      if (!Number.isFinite(p.ironMass) || !Number.isFinite(mol)) return null;
      return { question: `将${smartNumber(p.ironMass)}g铁粉加入含有${smartNumber(mol)}mol硫酸铜的溶液中，充分反应，求生成铜的物质的量和质量，并判断限量反应物。`, subject: "化学" };
    }
    if (module.templateId === "tangent") {
      return { question: `点P在抛物线 y=${smartNumber(p.coefficient)}x² 上，当x=${smartNumber(p.pointX)}时，求该点处切线斜率并观察斜率变化。`, subject: "数学" };
    }
    if (module.templateId === "cell") {
      const type = p.cellType === 0 ? "动物" : "植物";
      return { question: `请观察${type}细胞的亚显微结构截面图，识别主要结构并说明它们在细胞生命活动中的作用。`, subject: "生物" };
    }
    return null;
  }

  // acceptPlan：由页面核对 AI 改写后的模板题是否仍符合原题全部条件；不符合时改走导师讲解
  async function resolveUnmatchedQuestion({ question, preferredSubject = "", localMessage = "", acceptPlan = null }) {
    const cleanQuestion = text(question);
    if (!cleanQuestion) return { mode: "unavailable" };
    host().setMentorSummary?.("本地模板暂未匹配，正在请 AI 判断题型与所需条件……");
    try {
      const response = await apiRequest("/api/v1/experiment/generate", {
        question: cleanQuestion,
        preferredSubject
      }, GENERATE_TIMEOUT_MS);
      if (response.mode === "experiment") {
        const mapped = planToQuestion(response.plan);
        if (mapped && (typeof acceptPlan !== "function" || acceptPlan(mapped, response) !== false)) {
          host().setMentorSummary?.(`AI 已识别为“${response.title || "已有实验模板"}”，将由本地计算引擎生成。`);
          return { mode: "experiment", ...mapped, response };
        }
      }
      adoptContext({
        mode: "question",
        subject: preferredSubject,
        originalQuestion: cleanQuestion,
        templateId: "",
        parameters: {},
        deterministicResult: {},
        formula: "",
        currentStep: ""
      });
      openStandalone(state.context);
      addMessage("user", cleanQuestion);
      host().setMentorSummary?.("当前题目暂无可视化实验模板，已转入 AI 导师核对题设并分步讲解。");
      const tutorial = await sendChat(
        "请完整解答原题，覆盖所有小问，用必要的紧凑步骤列式、代入并得出结论和单位；无实验模板也正常解答，缺少必要条件时明确追问，勿补造题设。",
        "steps",
        { silentUser: true }
      );
      return { mode: tutorial ? "explanation" : "unavailable", response, tutorial };
    } catch (error) {
      adoptContext({
        mode: "question",
        subject: preferredSubject,
        originalQuestion: cleanQuestion,
        templateId: "",
        parameters: {},
        deterministicResult: {},
        formula: "",
        currentStep: ""
      });
      openStandalone(state.context);
      addMessage("user", cleanQuestion);
      addMessage("assistant", errorMessage(error), { error: true });
      state.lastRequest = { message: "请分析原题并给出分步提示。", responseLevel: "steps" };
      state.lastError = error;
      host().setMentorSummary?.("AI 服务暂未完成分析，题目已保留，可稍后重试。");
      return { mode: "unavailable", error };
    }
  }

  function askQuickAction(actionName) {
    const action = ACTIONS[actionName];
    if (!action) return false;
    adoptContext(currentHostContext());
    openWorkspace(true);
    sendChat(action.message, action.level);
    return true;
  }

  elements.expand?.addEventListener("click", () => {
    adoptContext(currentHostContext());
    openWorkspace(true);
  });
  elements.openPage?.addEventListener("click", () => openStandalone(currentHostContext()));
  elements.page?.addEventListener("click", () => openStandalone(state.context || currentHostContext()));
  elements.back?.addEventListener("click", () => { window.location.hash = ""; });
  elements.close?.addEventListener("click", closeWorkspace);
  elements.stop?.addEventListener("click", stopRequest);
  elements.clear?.addEventListener("click", () => {
    resetConversation();
  });
  elements.retry?.addEventListener("click", () => {
    if (!state.lastRequest || state.controller) return;
    sendChat(state.lastRequest.message, state.lastRequest.responseLevel, state.lastRequest.options || {});
  });
  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = elements.input.value.trim();
    if (!message) return;
    elements.input.value = "";
    state.context = state.context || currentHostContext();
    sendChat(message, selectResponseLevel(message));
  });
  elements.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      elements.form.requestSubmit();
    }
  });
  document.querySelectorAll("[data-ai-action]").forEach((button) => {
    button.addEventListener("click", () => askQuickAction(button.dataset.aiAction));
  });
  document.querySelectorAll(".mentor-mark").forEach((mark) => {
    mark.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openApiKeyModal();
    });
  });
  elements.apiKeySave?.addEventListener("click", saveApiKeyFromModal);
  elements.apiKeyClear?.addEventListener("click", clearApiKeyFromModal);
  elements.apiKeyClose?.addEventListener("click", closeApiKeyModal);
  elements.apiKeyModal?.addEventListener("click", (event) => {
    if (event.target === elements.apiKeyModal) closeApiKeyModal();
  });
  elements.apiKeyInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveApiKeyFromModal();
    }
    if (event.key === "Escape") closeApiKeyModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.apiKeyModal?.classList.contains("show")) {
      closeApiKeyModal();
    }
  });
  window.addEventListener("hashchange", updateRoute);
  window.addEventListener("masterlab:context-changed", () => {
    if (!state.route) adoptContext(currentHostContext());
    if (state.open) updateContext(state.context);
  });

  window.MasterLabAITutor = Object.freeze({
    askQuickAction,
    openInline() {
      adoptContext(currentHostContext());
      openWorkspace(true);
    },
    openStandalone() {
      openStandalone(currentHostContext());
    },
    resolveUnmatchedQuestion,
    openApiKeySettings: openApiKeyModal,
    get apiBaseUrl() {
      return hasBrowserApiKey() ? DEEPSEEK_BASE_URL : API_BASE_URL;
    },
    get hasLocalApiKey() {
      return hasBrowserApiKey();
    }
  });

  syncApiKeyUi();
  updateRoute();
})();
