/* 手机端外壳（2026-10-25）：题目输入框自动增高、生成前的快速开始、题干折叠、底部快捷条。
   只读写 app.js 已有的全局状态与函数，不改动实验计算；宽屏下除 Enter 生成外不改变原有行为。 */
(() => {
  "use strict";

  const phoneQuery = window.matchMedia("(max-width: 640px)");
  const isPhone = () => phoneQuery.matches;
  const $ = (selector, root = document) => root.querySelector(selector);
  // app.js 是普通脚本，state、PRESET_OPTIONS 等顶层声明可直接按名称访问
  const appReady = () => typeof state !== "undefined" && typeof PRESET_OPTIONS !== "undefined";

  /* ---------- 题目输入框 ---------- */
  const input = $("#questionInput");
  let fitFrame = 0;

  function fitQuestion() {
    fitFrame = 0;
    if (!input || input.tagName !== "TEXTAREA") return;
    if (!isPhone()) {
      // 宽屏保持原来的单行输入框外观：不折行，长题横向滚动
      input.setAttribute("wrap", "off");
      input.style.height = "";
      input.style.overflowY = "";
      return;
    }
    input.setAttribute("wrap", "soft");
    input.style.height = "auto";
    const style = getComputedStyle(input);
    const max = parseFloat(style.maxHeight) || Infinity;
    const borders = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    const wanted = input.scrollHeight + borders;
    input.style.height = `${Math.ceil(Math.min(wanted, max))}px`;
    input.style.overflowY = wanted > max + 1 ? "auto" : "hidden";
  }

  function queueFit() {
    if (!fitFrame) fitFrame = requestAnimationFrame(fitQuestion);
  }

  if (input && input.tagName === "TEXTAREA") {
    // app.js 通过 .value 放入预设题；拦截赋值以便同步高度
    const native = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
    if (native?.get && native?.set) {
      Object.defineProperty(input, "value", {
        configurable: true,
        get() { return native.get.call(this); },
        set(next) { native.set.call(this, next); queueFit(); }
      });
    }
    input.addEventListener("input", queueFit);
    input.addEventListener("keydown", event => {
      if (event.key !== "Enter" || event.isComposing || event.keyCode === 229) return;
      if (event.shiftKey) {
        if (!isPhone()) event.preventDefault(); // 单行外观下不插入看不见的换行
        return;
      }
      event.preventDefault();
      if (isPhone()) input.blur();
      $("#generateButton")?.click();
    });
    queueFit();
    document.fonts?.ready?.then(queueFit).catch(() => {});
  }

  /* ---------- 生成前：快速开始 ---------- */
  const QUICK_LIMIT = 6;
  const promptPanel = $(".prompt-panel");
  const quick = document.createElement("section");
  quick.className = "mobile-quickstart card";
  quick.setAttribute("aria-labelledby", "mobileQuickTitle");
  quick.innerHTML = `
    <div class="mq-head">
      <div>
        <span class="mq-kicker">快速开始</span>
        <h2 class="mq-title" id="mobileQuickTitle">选择一个实验</h2>
      </div>
      <button type="button" class="mq-library" aria-controls="physicsPresetDropdown">全部实验</button>
    </div>
    <div class="mq-grid" role="list"></div>
    <p class="mq-note">点一下直接生成实验；也可以在上方输入或粘贴自己的题目。</p>`;
  // 放在 AI 即时示意图之后、实验卡之前；示意图出现时由样式隐藏
  const contentGrid = $(".content-grid");
  if (contentGrid) contentGrid.before(quick); else promptPanel?.after(quick);
  const quickGrid = $(".mq-grid", quick);
  const quickLibrary = $(".mq-library", quick);
  let quickKey = "";

  function quickOptions() {
    const subject = state.subject;
    const level = state.gradeLevel;
    return PRESET_OPTIONS.filter(option => option.dataset.subject === subject
      && (typeof presetOptionAvailable !== "function" || presetOptionAvailable(option))
      && (typeof presetOptionLevels !== "function" || presetOptionLevels(option).includes(level)));
  }

  function renderQuickStart(force = false) {
    if (!appReady()) return;
    const key = `${state.subject}|${state.gradeLevel}`;
    if (!force && key === quickKey) return;
    quickKey = key;
    const levelLabel = state.gradeLevel === "junior" ? "初中" : "高中";
    $(".mq-title", quick).textContent = `${levelLabel}${state.subject}实验`;
    const options = quickOptions();
    const shown = options.slice(0, QUICK_LIMIT);
    quickGrid.replaceChildren(...shown.map(option => {
      if (typeof syncPresetOptionText === "function") syncPresetOptionText(option, state.gradeLevel);
      const item = document.createElement("button");
      item.type = "button";
      item.className = "mq-item";
      item.setAttribute("role", "listitem");
      item.dataset.quickPreset = option.dataset.preset;
      const title = document.createElement("strong");
      title.textContent = option.querySelector(":scope > span")?.textContent.trim() || option.dataset.preset;
      const meta = document.createElement("small");
      meta.innerHTML = option.querySelector(":scope > small")?.innerHTML || "";
      item.append(title, meta);
      return item;
    }));
    quickLibrary.textContent = `全部 ${options.length} 个`;
    quickLibrary.hidden = options.length <= shown.length; // 都列出来了就不再重复“实验库”入口
    quick.hidden = options.length === 0;
  }

  quickGrid.addEventListener("click", event => {
    const item = event.target.closest("[data-quick-preset]");
    if (!item || !appReady()) return;
    const option = PRESET_OPTIONS.find(node => node.dataset.preset === item.dataset.quickPreset && node.dataset.subject === state.subject);
    if (!option || typeof applyPhysicsPresetChoice !== "function") return;
    applyPhysicsPresetChoice(option);
    $("#generateButton")?.click();
  });

  quickLibrary.addEventListener("click", () => {
    const dropdown = $("#physicsPresetDropdown");
    if (!dropdown?.classList.contains("show")) $("#physicsPresetToggle")?.click();
    promptPanel?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  });

  /* ---------- 题干折叠 ---------- */
  const problem = $("#problemText");
  const problemToggle = document.createElement("button");
  problemToggle.type = "button";
  problemToggle.className = "problem-toggle";
  problemToggle.hidden = true;
  problemToggle.setAttribute("aria-controls", "problemText");
  problem?.after(problemToggle);
  let problemFrame = 0;

  function syncProblemToggle() {
    problemFrame = 0;
    if (!problem) return;
    const expanded = problem.classList.contains("is-expanded");
    if (!isPhone()) {
      problemToggle.hidden = true;
      return;
    }
    const clipped = problem.scrollHeight > problem.clientHeight + 2;
    problemToggle.hidden = !(clipped || expanded);
    problemToggle.textContent = expanded ? "收起题干" : "展开全文";
    problemToggle.setAttribute("aria-expanded", String(expanded));
  }

  function queueProblemSync() {
    if (!problemFrame) problemFrame = requestAnimationFrame(syncProblemToggle);
  }

  problemToggle.addEventListener("click", () => {
    problem.classList.toggle("is-expanded");
    syncProblemToggle();
  });
  if (problem) {
    new MutationObserver(() => {
      problem.classList.remove("is-expanded");
      queueProblemSync();
    }).observe(problem, { childList: true, characterData: true, subtree: true });
  }

  /* ---------- 底部快捷条：换题 / 问导师 ---------- */
  const dock = document.createElement("nav");
  dock.className = "mobile-dock";
  dock.setAttribute("aria-label", "快捷操作");
  dock.innerHTML = `
    <button type="button" class="mobile-dock-edit">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/></svg>
      <span>换题</span>
    </button>
    <button type="button" class="mobile-dock-ai">
      <b aria-hidden="true">AI</b>
      <span>问导师</span>
    </button>`;
  document.body.append(dock);

  $(".mobile-dock-edit", dock).addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });
  $(".mobile-dock-ai", dock).addEventListener("click", () => $("#aiTutorEntryButton")?.click());

  if (promptPanel && "IntersectionObserver" in window) {
    new IntersectionObserver(entries => {
      const entry = entries[entries.length - 1];
      document.body.classList.toggle("prompt-offscreen", !entry.isIntersecting);
    }, { rootMargin: "-40px 0px 0px 0px" }).observe(promptPanel);
    // 只在看思维链、导师卡时出现，避免挡住实验卡底部的参数
    const insight = $(".insight-column");
    if (insight) {
      new IntersectionObserver(entries => {
        const entry = entries[entries.length - 1];
        document.body.classList.toggle("insight-inview", entry.isIntersecting);
      }, { rootMargin: "0px 0px -35% 0px" }).observe(insight);
    }
  }

  /* ---------- 状态同步 ---------- */
  new MutationObserver(() => {
    renderQuickStart();
    queueProblemSync();
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  document.querySelectorAll(".grade-seg button").forEach(button => {
    new MutationObserver(() => renderQuickStart()).observe(button, { attributes: true, attributeFilter: ["aria-pressed"] });
  });

  const onLayoutChange = () => {
    queueFit();
    queueProblemSync();
  };
  phoneQuery.addEventListener?.("change", onLayoutChange);
  window.addEventListener("resize", onLayoutChange);

  renderQuickStart(true);
  queueProblemSync();
})();
