(() => {
  "use strict";

  const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);
  const DEFAULT_REMOTE_API = "https://master-lab-api.onrender.com";
  const API_BASE_URL = String(window.MASTER_LAB_API_URL ||
    (LOCAL_HOSTS.has(window.location.hostname) ? "http://127.0.0.1:10000" : DEFAULT_REMOTE_API)).replace(/\/$/, "");
  const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
  const DEEPSEEK_MODEL = "deepseek-v4-pro";
  const API_KEY_STORAGE = "masterLab.deepseekApiKey";
  const CHAT_TIMEOUT_MS = 130000;
  const GENERATE_TIMEOUT_MS = 45000;
  const MAX_HISTORY_ITEMS = 12;

  const CHAT_SYSTEM_PROMPT = `你是“大师实验室”的中学数理化生 AI 导师。只返回 JSON 对象，禁止 Markdown 代码块、HTML、URL、代码和隐藏推理过程。

教学原则：
1. 只回答中学数学、物理、化学、生物学习问题；无关请求 mode=refusal。
2. 默认分层引导。responseLevel=hint 时只给关键线索和一个追问，finalAnswer 必须为 null。
3. responseLevel=explain 时解释当前概念或步骤；responseLevel=steps 时给出可核查分步解答；responseLevel=check 时检查思路；responseLevel=variant 时给变式。
4. context.mode=experiment 时，deterministicResult 与 formula 是本地确定性结果，不得改写冲突。
5. context.mode=question 且条件不足时 mode=clarification，禁止自行补造数值。
6. 涉及计算时检查公式适用条件、单位、量纲与边界。

返回结构：
{"mode":"hint|explain|steps|answer|clarification|refusal","summary":"简洁说明","steps":["步骤1"],"formulas":["公式"],"finalAnswer":"完整结论；hint 时为 null","checks":["自检"],"followUp":"推荐追问","parameterPatch":null,"warnings":[]}
注意：即使 responseLevel 是 variant 或 check，mode 也只能取上述枚举，不要返回 mode=variant 或 mode=check。`;

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
      message: "请给出清晰、可核查的完整解题步骤，包括关键公式、代入、结果和自检。"
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
      AI_NOT_CONFIGURED: "尚未配置 DeepSeek 密钥。请右键点击烧瓶图标，粘贴 API 密钥后重试。",
      AI_AUTH_FAILED: "API 密钥无效或已失效，请右键烧瓶图标重新配置。",
      AI_RATE_LIMITED: "AI 请求较多，请稍后再试。",
      RATE_LIMITED: "AI 请求较多，请稍后再试。",
      AI_TIMEOUT: "这道题分析时间较长，本次请求已超时。你可以重试，或先请求一个简短提示。",
      AI_UNAVAILABLE: "AI 服务暂时不可用，题目和当前实验状态均已保留。",
      INVALID_AI_RESPONSE: "AI 返回格式不符合约定，已拦截显示。请再试一次，或换个问法。",
      ORIGIN_NOT_ALLOWED: "当前网页地址尚未加入 AI 服务允许列表。",
      ABORTED: "已停止本次回答。",
      NETWORK_ERROR: "暂时无法连接 DeepSeek，请检查网络，或确认密钥是否正确。"
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
        label.textContent = ready ? " AI 导师在线" : " 待配置密钥";
      }
      node.title = ready
        ? `已启用本地密钥 · ${DEEPSEEK_MODEL}`
        : "右键烧瓶图标配置 DeepSeek API 密钥";
    });
    if (elements.apiKeyStatus) {
      elements.apiKeyStatus.textContent = ready
        ? `已启用本地密钥 ${maskApiKey(key)} · 模型 ${DEEPSEEK_MODEL}`
        : "尚未配置密钥";
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
    notify("密钥已保存在本机，AI 导师已启用");
  }

  function clearApiKeyFromModal() {
    writeStoredApiKey("");
    syncApiKeyUi();
    if (elements.apiKeyInput) {
      elements.apiKeyInput.value = "";
      elements.apiKeyInput.placeholder = "sk-…";
    }
    notify("已清除本机 API 密钥");
  }

  function extractJsonObject(rawText) {
    const source = String(rawText || "").trim();
    if (!source) return null;
    try {
      return JSON.parse(source);
    } catch {
      /* continue */
    }
    const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {
        /* continue */
      }
    }
    const start = source.indexOf("{");
    const end = source.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(source.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
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
    if (!raw || typeof raw !== "object") return null;
    const mode = normalizeChatMode(raw.mode, responseLevel);
    const summary = text(raw.summary || raw.message || raw.answer).slice(0, 1000);
    const steps = Array.isArray(raw.steps)
      ? raw.steps.map((step) => text(step).slice(0, 500)).filter(Boolean).slice(0, 8)
      : [];
    if (!summary && !steps.length) return null;
    const warnings = Array.isArray(raw.warnings)
      ? raw.warnings.map((item) => text(item).slice(0, 300)).filter(Boolean).slice(0, 4)
      : [];
    return {
      schemaVersion: "1.0",
      mode,
      summary,
      steps,
      formulas: Array.isArray(raw.formulas)
        ? raw.formulas.map((item) => text(item).slice(0, 300)).filter(Boolean).slice(0, 8)
        : [],
      finalAnswer: responseLevel === "hint" ? null : (text(raw.finalAnswer || raw.answer).slice(0, 1200) || null),
      checks: Array.isArray(raw.checks)
        ? raw.checks.map((item) => text(item).slice(0, 400)).filter(Boolean).slice(0, 6)
        : [],
      followUp: text(raw.followUp).slice(0, 500),
      parameterPatch: null,
      warnings,
      source: "deepseek-browser",
      model: DEEPSEEK_MODEL
    };
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

  async function callDeepSeek(messages, options = {}) {
    const apiKey = readStoredApiKey();
    if (!apiKey) throw new TutorRequestError("AI_NOT_CONFIGURED");
    if (state.controller) state.controller.abort();
    const controller = new AbortController();
    state.controller = controller;
    const timeoutMs = options.timeoutMs || CHAT_TIMEOUT_MS;
    state.timeoutId = window.setTimeout(() => controller.abort("timeout"), timeoutMs);
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
            thinking: { type: options.thinking ? "enabled" : "disabled" },
            response_format: { type: "json_object" },
            max_tokens: options.maxTokens || 2200,
            ...(!options.thinking ? { temperature: 0.2 } : {})
          }),
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
        throw new TutorRequestError("INVALID_AI_RESPONSE", response.status);
      }
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new TutorRequestError("AI_AUTH_FAILED", response.status);
        }
        if (response.status === 429) {
          throw new TutorRequestError("AI_RATE_LIMITED", response.status);
        }
        throw new TutorRequestError(payload.error || "AI_UNAVAILABLE", response.status);
      }
      const message = payload?.choices?.[0]?.message || {};
      const content = typeof message.content === "string" ? message.content : "";
      const reasoning = typeof message.reasoning_content === "string" ? message.reasoning_content : "";
      const parsed = extractJsonObject(content) || extractJsonObject(reasoning);
      if (!parsed) {
        throw new TutorRequestError("INVALID_AI_RESPONSE", response.status);
      }
      return parsed;
    } finally {
      window.clearTimeout(state.timeoutId);
      state.timeoutId = null;
      if (state.controller === controller) state.controller = null;
    }
  }

  async function browserTutorChat(request) {
    const useThinking = request.responseLevel === "steps" || request.responseLevel === "check";
    const history = (request.history || []).map((item) => ({ role: item.role, content: item.content }));
    const raw = await callDeepSeek([
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
          }, null, 0)}`
        ].join("\n")
      }
    ], {
      thinking: useThinking,
      timeoutMs: useThinking ? CHAT_TIMEOUT_MS : 45000,
      maxTokens: useThinking ? 4200 : 2200
    });
    const validated = softValidateChat(raw, request.responseLevel);
    if (!validated) throw new TutorRequestError("INVALID_AI_RESPONSE");
    return validated;
  }

  async function browserGenerate(question, preferredSubject = "") {
    const raw = await callDeepSeek([
      { role: "system", content: GENERATE_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify({ question, preferredSubject }, null, 0) }
    ], { thinking: false, timeoutMs: GENERATE_TIMEOUT_MS, maxTokens: 1800 });
    const validated = softValidateGenerate(raw);
    if (!validated) throw new TutorRequestError("INVALID_AI_RESPONSE");
    return validated;
  }

  async function apiRequest(path, body, timeoutMs) {
    if (hasBrowserApiKey()) {
      if (path === "/api/v1/tutor/chat") return browserTutorChat(body);
      if (path === "/api/v1/experiment/generate") {
        return browserGenerate(body.question, body.preferredSubject || "");
      }
    }
    if (state.controller) state.controller.abort();
    const controller = new AbortController();
    state.controller = controller;
    state.timeoutId = window.setTimeout(() => controller.abort("timeout"), timeoutMs);
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
        throw new TutorRequestError(hasBrowserApiKey() ? "NETWORK_ERROR" : "AI_NOT_CONFIGURED");
      }
      let payload = {};
      try {
        payload = await response.json();
      } catch {
        throw new TutorRequestError("INVALID_AI_RESPONSE", response.status);
      }
      if (!response.ok) {
        throw new TutorRequestError(payload.error || "AI_UNAVAILABLE", response.status);
      }
      return payload;
    } finally {
      window.clearTimeout(state.timeoutId);
      state.timeoutId = null;
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
      window.setTimeout(() => elements.workspace.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
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
    state.context = context;
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
    if (context.mode === "experiment" && context.templateId) {
      return `experiment:${context.subject || "science"}:${context.templateId}`;
    }
    return `question:${context.subject || "science"}:${text(context.originalQuestion)}`;
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
      resetConversation("题目或实验已切换，已开始新的导师会话");
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

  function updatePendingMessage(copy) {
    if (!state.pendingNode || !state.pendingStartedAt) return;
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - state.pendingStartedAt) / 1000));
    const stageIndex = Math.min(copy.stages.length - 1, Math.floor(elapsedSeconds / 4));
    const stage = state.pendingNode.querySelector(".ai-thinking-stage");
    const elapsed = state.pendingNode.querySelector(".ai-thinking-elapsed");
    const longWait = state.pendingNode.querySelector(".ai-thinking-long-wait");
    const card = state.pendingNode.querySelector(".ai-thinking-card");
    const phases = state.pendingNode.querySelectorAll(".ai-thinking-phase");
    if (stage) stage.textContent = copy.stages[stageIndex];
    if (elapsed) elapsed.textContent = elapsedSeconds < 1 ? "刚刚开始" : `已等待 ${elapsedSeconds} 秒`;
    if (longWait) longWait.hidden = elapsedSeconds < 12;
    if (card) card.dataset.stage = String(stageIndex);
    phases.forEach((phase, index) => {
      phase.classList.toggle("is-active", index === stageIndex);
      phase.classList.toggle("is-complete", index < stageIndex);
    });
  }

  function addPendingMessage(responseLevel = "hint") {
    clearPending();
    elements.empty.hidden = true;
    const copy = thinkingCopy(responseLevel);
    const row = createElement("div", "ai-message assistant pending ai-thinking-row");
    row.setAttribute("role", "status");
    row.setAttribute("aria-live", "polite");
    row.setAttribute("aria-label", `AI 导师正在处理：${copy.title}`);

    const bubble = createElement("div", "ai-message-bubble ai-thinking-card");
    const header = createElement("div", "ai-thinking-header");
    header.append(createElement("span", "ai-message-source", "大师 · AI 导师"));
    const badge = createElement("span", "ai-thinking-badge", "正在思考");
    badge.prepend(createElement("i"));
    header.append(badge);

    const body = createElement("div", "ai-thinking-body");
    const visual = createElement("div", "ai-thinking-visual");
    visual.setAttribute("aria-hidden", "true");
    const field = createElement("div", "ai-thinking-field");
    applyThinkingPalette(field);
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
    copyNode.append(createElement("p", "ai-thinking-stage", copy.stages[0]));
    const meta = createElement("div", "ai-thinking-meta");
    meta.append(
      createElement("span", "ai-thinking-elapsed", "刚刚开始"),
      createElement("span", "", "可随时点击“停止”")
    );
    copyNode.append(meta);
    const longWait = createElement("p", "ai-thinking-long-wait", "复杂题目可能需要更久，当前请求仍在进行。 ");
    longWait.hidden = true;
    copyNode.append(longWait);
    body.append(visual, copyNode);

    const phases = createElement("div", "ai-thinking-phases");
    phases.setAttribute("aria-hidden", "true");
    ["理解题意", "组织推理", "校验表达"].forEach((label, index) => {
      const phase = createElement("span", "ai-thinking-phase", label);
      phase.dataset.phase = String(index);
      phase.prepend(createElement("i"));
      phases.append(phase);
    });
    bubble.append(header, body, phases);
    row.append(bubble);
    elements.messages.append(row);
    state.pendingNode = row;
    state.pendingStartedAt = Date.now();
    state.pendingTimer = window.setInterval(() => updatePendingMessage(copy), 1000);
    updatePendingMessage(copy);
    elements.messages.scrollTop = elements.messages.scrollHeight;
  }

  function appendFormula(container, formula) {
    const line = createElement("div", "ai-formula-line");
    const source = text(formula);
    const fractionPattern = /\\frac\{([^{}]+)\}\{([^{}]+)\}/g;
    let cursor = 0;
    let match;
    while ((match = fractionPattern.exec(source))) {
      if (match.index > cursor) line.append(document.createTextNode(source.slice(cursor, match.index)));
      const fraction = createElement("span", "ai-safe-fraction");
      fraction.append(createElement("span", "ai-safe-fraction-num", match[1]));
      fraction.append(createElement("span", "ai-safe-fraction-den", match[2]));
      line.append(fraction);
      cursor = match.index + match[0].length;
    }
    if (cursor < source.length) line.append(document.createTextNode(source.slice(cursor)));
    container.append(line);
  }

  function structuredToHistoryText(payload) {
    return [
      payload.summary,
      ...(payload.steps || []),
      ...(payload.formulas || []),
      payload.finalAnswer,
      ...(payload.checks || [])
    ].filter(Boolean).join("\n").slice(0, 1800);
  }

  function renderAssistantPayload(bubble, payload) {
    if (payload.summary) bubble.append(createElement("p", "ai-answer-summary", payload.summary));
    if (payload.steps?.length) {
      const section = createElement("section", "ai-answer-section");
      section.append(createElement("h4", "", "分步讲解"));
      const list = createElement("ol");
      payload.steps.forEach((step) => list.append(createElement("li", "", step)));
      section.append(list);
      bubble.append(section);
    }
    if (payload.formulas?.length) {
      const section = createElement("section", "ai-answer-section formula-section");
      section.append(createElement("h4", "", "关键公式"));
      payload.formulas.forEach((formula) => appendFormula(section, formula));
      bubble.append(section);
    }
    if (payload.finalAnswer) {
      const section = createElement("section", "ai-answer-section final-section");
      section.append(createElement("h4", "", "当前结论"));
      section.append(createElement("p", "", payload.finalAnswer));
      bubble.append(section);
    }
    if (payload.checks?.length) {
      const section = createElement("section", "ai-answer-section check-section");
      section.append(createElement("h4", "", "结果自检"));
      payload.checks.forEach((check) => section.append(createElement("p", "", check)));
      bubble.append(section);
    }
    if (payload.followUp) bubble.append(createElement("p", "ai-follow-up", payload.followUp));
    if (payload.parameterPatch) bubble.append(renderPatch(payload.parameterPatch));
    if (payload.warnings?.length) {
      const warning = createElement("div", "ai-answer-warning");
      payload.warnings.forEach((item) => warning.append(createElement("span", "", item)));
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
      renderAssistantPayload(bubble, payload);
      state.messages.push({ role, content: structuredToHistoryText(payload) });
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
      context: state.context
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
      addMessage("assistant", payload, { source: payload.source });
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

  async function resolveUnmatchedQuestion({ question, preferredSubject = "", localMessage = "" }) {
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
        if (mapped) {
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
        "请先逐字核对原题全部显式条件，说明考查目标，并给出适合零基础学生理解的第一步。不得补造题目未给出的条件，也不要把其他接触面的摩擦因数移用到本题。",
        "explain",
        { silentUser: true }
      );
      if (!tutorial && localMessage) {
        elements.status.textContent = localMessage;
      }
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
    sendChat(message, "hint");
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
