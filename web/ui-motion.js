/* 界面动效与交互（2026-11-06）：按下回弹、生成扫光、思维链流光、读数滚入、滑块气泡 / 原题刻度 / 吸附、
   手机参数底栏、右栏收起、时间轴刻度、快捷键、数值直接输入、公式联动、卡片聚光、手机手势、命令面板、对比残影。
   只读写 app.js 已有的全局状态与函数，不改科学计算、题目解析、AI 请求和存储协议；读数文字始终是最终值，只做视觉层。
   实验动画按“同一时刻只有一个待执行的动画帧”验收，本文件不申请 requestAnimationFrame：
   动效交给 CSS，指针移动按事件时间戳节流，计时器都是短时、一次性并会清理。
   鸿蒙包内（body.harmony-compat-mode）只保留按下态和滑块数值气泡。 */
(() => {
  "use strict";

  const doc = document;
  const root = doc.documentElement;
  const body = doc.body;
  const $ = (selector, scope = doc) => scope.querySelector(selector);
  const $$ = (selector, scope = doc) => [...scope.querySelectorAll(selector)];
  const media = query => window.matchMedia(query);
  const reducedQuery = media("(prefers-reduced-motion: reduce)");
  const fineQuery = media("(hover: hover) and (pointer: fine)");
  const coarseQuery = media("(pointer: coarse)");
  const dockQuery = media("(max-width: 640px) and (orientation: portrait)");
  const wideQuery = media("(min-width: 1101px)");
  const reduced = () => reducedQuery.matches;
  const compat = () => body.classList.contains("harmony-compat-mode");
  const appReady = () => typeof state !== "undefined" && typeof config === "function" && typeof elements !== "undefined";
  const generated = () => appReady() && state.hasGenerated;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const shown = el => Boolean(el) && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";

  root.classList.add("um-on");
  if (window.CSS?.registerProperty) root.classList.add("um-prop");

  function vibrate(ms) {
    try { if (/Android/i.test(navigator.userAgent) && typeof navigator.vibrate === "function") navigator.vibrate(ms); } catch { /* 不支持时忽略 */ }
  }
  // 重启一次性动画：在两个效果相同、名字不同的类之间切换，不强制重排
  function replay(el, a, b) {
    const next = el.classList.contains(a) ? b : a;
    el.classList.remove(a, b);
    el.classList.add(next);
  }

  // 本文件新增的浮层、角标、刻度等只在用到时挂到页面上：实验页每次改参数都会触发几次大范围的样式失效，
  // 已挂载的节点（即使隐藏）都会被一并重算；闲置时摘下，拖动参数时不额外增加样式重算。
  const attach = (node, parent, before = null) => { if (parent && node.parentNode !== parent) parent.insertBefore(node, before); };
  const detach = node => { if (node.parentNode) node.remove(); };
  const later = (fn, ms) => setTimeout(fn, ms);
  // 背景光斑漂移在拖动滑块 / 时间轴、生成遮罩显示期间暂停（ui-motion.css 的 :root.um-still），各原因独立计数
  const stillReasons = new Set();
  function setStill(reason, on) {
    if (on) stillReasons.add(reason); else stillReasons.delete(reason);
    const still = stillReasons.size > 0;
    if (root.classList.contains("um-still") !== still) root.classList.toggle("um-still", still);
  }

  /* ---------- 页面隐藏 / 元素离开视口：暂停循环动画 ---------- */
  const syncHidden = () => root.classList.toggle("um-hidden", doc.hidden);
  doc.addEventListener("visibilitychange", syncHidden);
  syncHidden();
  if ("IntersectionObserver" in window) {
    const offscreen = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.target.toggleAttribute("data-um-off", !entry.isIntersecting));
    });
    [".prompt-input-wrap", ".reasoning-card .reasoning-steps", "#aiTutorWorkspace", ".experiment-card .transport"]
      .map(selector => $(selector)).filter(Boolean).forEach(node => offscreen.observe(node));
  }

  /* ==================== A1 按下态：松开回弹 ==================== */
  const PRESSABLE = 'button, [role="button"], summary, .subject-tab, .preset-option, .reason-step, .square-button, .mini-control, .play-button, .generate-button, .mobile-dock button, .mq-item, .favorite-item, .cell-structure-tag';
  let pressed = null;
  doc.addEventListener("touchstart", () => {}, { passive: true }); // iOS Safari 需要它才会应用 :active
  doc.addEventListener("pointerdown", event => {
    pressed = event.button > 0 ? null : event.target.closest?.(PRESSABLE) || null;
  }, { capture: true, passive: true });
  doc.addEventListener("pointerup", () => {
    const el = pressed;
    pressed = null;
    if (!el || el.disabled || el.getAttribute("aria-disabled") === "true" || reduced()) return;
    replay(el, "um-release-a", "um-release-b");
  }, { capture: true, passive: true });
  doc.addEventListener("pointercancel", () => { pressed = null; }, { capture: true, passive: true });

  // 一次性动画结束后去掉触发类
  const ONE_SHOT = /^um-(release|roll|fade)-[ab]$|^um-sweep-x2?$/;
  doc.addEventListener("animationend", event => {
    if (!ONE_SHOT.test(event.animationName)) return;
    if (/^um-roll-/.test(event.animationName)) event.target.parentElement?.classList.remove("um-roll-host");
    event.target.classList.remove("um-release-a", "um-release-b", "um-roll-a", "um-roll-b", "um-fade-a", "um-fade-b", "um-sweep", "um-capsule-a", "um-capsule-b");
  });

  /* ==================== A3 生成按钮扫光；遮罩从按钮中心展开 ==================== */
  const generateButton = $("#generateButton");
  const generationStage = $("#generationOverlay .generation-stage");
  generateButton?.addEventListener("click", () => {
    if (compat() || reduced() || generateButton.classList.contains("loading")) return;
    generateButton.classList.remove("um-sweep");
    void generateButton.offsetWidth; // 点击时重启扫光（一次性）
    generateButton.classList.add("um-sweep");
    // 现有入场动画（上移 + 缩放 .955 → 1）保持不变，只把缩放原点放到按钮中心
    if (generationStage) {
      const button = generateButton.getBoundingClientRect();
      const stage = generationStage.getBoundingClientRect();
      if (stage.width && stage.height) {
        generationStage.style.transformOrigin = `${(button.left + button.width / 2 - stage.left).toFixed(1)}px ${(button.top + button.height / 2 - stage.top).toFixed(1)}px`;
      }
    }
  }, true);

  /* ==================== 播放状态 ==================== */
  const playButton = $("#playButton");
  // 暂停时记下思维链光点停在哪里（只在播放→暂停时读一次样式），伪元素据此静止显示
  const syncPlaying = () => {
    const playing = Boolean(playButton?.classList.contains("playing"));
    if (!playing && body.classList.contains("um-playing")) {
      const host = $(".reasoning-card .reasoning-steps");
      const t = host ? parseFloat(getComputedStyle(host, "::after").getPropertyValue("--um-dot-t")) : NaN;
      if (host && Number.isFinite(t)) host.style.setProperty("--um-dot-rest", (t % 1).toFixed(3));
    }
    body.classList.toggle("um-playing", playing);
  };

  /* ==================== 原题参数（复用 app.js 已有的原题状态，不另存） ==================== */
  let baselineMemo = { key: "", values: [null, null] };
  function originalValues() {
    const none = [null, null];
    if (!generated()) return none;
    try {
      const generic = activeGenericTemplate();
      if (generic) {
        const baseline = state.genericQuestionBaseline;
        if (!generic.resetToQuestion || baseline?.id !== generic.id || typeof generic.parseQuestion !== "function") return none;
        const key = `${generic.id}|${state.gradeLevel}|${baseline.question}`;
        if (baselineMemo.key !== key) {
          const parsed = generic.parseQuestion(baseline.question, { gradeLevel: state.gradeLevel });
          baselineMemo = { key, values: parsed?.ok ? [parsed.p1, parsed.p2] : none };
        }
        return baselineMemo.values;
      }
      if (state.subject === "物理" && state.physicsTemplate === "brake") {
        const ask = state.brakeAsk;
        return ask && ask.mode === state.brakeMode && Number.isFinite(ask.v0) ? [ask.v0, ask.parameter] : none;
      }
      if (state.subject === "物理" && state.physicsTemplate === "projectile") {
        const ask = state.projectileAsk;
        return ask && Number.isFinite(ask.speed) ? [ask.speed, ask.height] : none;
      }
      if (state.subject === "化学") {
        const given = state.chemGiven;
        return given && Number.isFinite(given.feMass) ? [given.feMass, given.cuso4Mol] : none;
      }
    } catch { /* 读不到时不标原题值 */ }
    return none;
  }
  const paramRanges = () => (appReady() ? [...elements.ranges] : $$(".experiment-card .parameter > input[type=range]"));
  const rangeIndex = input => paramRanges().indexOf(input);
  const paramSpec = index => { try { return config().params[index] || null; } catch { return null; } };
  function originalFor(input) {
    const index = rangeIndex(input);
    if (index < 0 || input.disabled || input.closest(".parameter")?.classList.contains("is-locked")) return null;
    const value = originalValues()[index];
    return Number.isFinite(value) && value >= Number(input.min) - 1e-9 && value <= Number(input.max) + 1e-9 ? value : null;
  }

  /* ==================== A7 / B3 滑块：填充比例、原题刻度、气泡、吸附 ==================== */
  const timeline = $("#timeline");
  const fraction = input => {
    const min = Number(input.min) || 0, max = Number(input.max), value = Number(input.value);
    return max > min ? clamp((value - min) / (max - min), 0, 1) : 0;
  };
  // B3 步骤刻度盖在时间轴上：滑块停在刻度处（生成后在 0% 的第 1 步）时，按下命中的是刻度按钮，滑块拖不动。
  // 与滑块重叠的刻度暂时不接收指针（.is-covered），按下的就是滑块；其余刻度照常点击跳转，键盘操作不变。
  // 尺寸在摆放刻度时记下（layoutMarks），这里随时间轴每次改值只比较数值，不读布局。
  const MARK_HALF = 9; // .um-tl-mark 宽 18px（ui-motion.css）
  let markCover = null; // { track, reach, items: [[button, at]] }
  function coverMarks() {
    if (!markCover) return;
    const at = fraction(timeline);
    markCover.items.forEach(([button, markAt]) => {
      const covered = Math.abs(at - markAt) * markCover.track < markCover.reach;
      if (button.classList.contains("is-covered") !== covered) button.classList.toggle("is-covered", covered);
    });
  }
  // 比例按 0.1% 量化成两个类名（见 ui-motion.css 的 um-p / um-o 类）；只在变化时替换，不写行内样式
  const levelClasses = new WeakMap();
  function setLevel(input, key, value) {
    const tenths = Math.round(clamp(value, 0, 1) * 1000);
    const next = [`um-${key}-${Math.floor(tenths / 10)}`, `um-${key}f-${tenths % 10}`];
    const store = levelClasses.get(input) || {};
    const prev = store[key] || [];
    next.forEach((name, i) => {
      if (prev[i] === name) return;
      if (prev[i] && input.classList.contains(prev[i])) input.classList.replace(prev[i], name); else input.classList.add(name);
    });
    store[key] = next;
    levelClasses.set(input, store);
  }
  function paintRange(input) {
    setLevel(input, "p", fraction(input));
    if (input === timeline) { coverMarks(); return; }
    const orig = originalFor(input);
    input.classList.toggle("um-has-orig", orig !== null);
    if (orig !== null) {
      const min = Number(input.min), max = Number(input.max);
      setLevel(input, "o", max > min ? (orig - min) / (max - min) : 0);
    }
  }
  const allRanges = () => [...paramRanges(), timeline].filter(Boolean);
  const paintAll = () => allRanges().forEach(paintRange);
  // app.js 用 .value 赋值同步滑块（含播放中逐帧更新的时间轴），拦截实例上的赋值以更新填充比例
  const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  allRanges().forEach(input => {
    if (nativeValue?.get && nativeValue?.set) {
      Object.defineProperty(input, "value", {
        configurable: true,
        get() { return nativeValue.get.call(this); },
        set(next) { nativeValue.set.call(this, next); paintRange(this); }
      });
    }
    input.addEventListener("input", () => paintRange(input));
    new MutationObserver(() => paintRange(input)).observe(input, { attributes: true, attributeFilter: ["min", "max", "step", "disabled"] });
  });

  // 拖动时的数值气泡（滑块与时间轴共用；鸿蒙包内也保留）。
  // 本文件常驻实验卡附近的节点不用 div/span/button 等标签：页面已有的几条 :has() 规则每次改参数都会按这些标签名
  // 把整片元素标为待重算（每次输入约 6 遍），换成 output/nav/section 就不会被一并重算
  const bubble = doc.createElement("output");
  bubble.className = "um-bubble";
  bubble.setAttribute("aria-hidden", "true");
  const bubbleNode = bubble.appendChild(doc.createTextNode(""));
  let bubbleTimer = 0;
  let drag = null; // { input, rect, thumb, bx, by }
  function bubbleText(input) {
    if (input === timeline) return $("#currentTime")?.textContent || "";
    const row = input.closest(".parameter");
    const value = row?.querySelector(".number-control strong")?.textContent.trim() || input.value;
    const unit = row?.querySelector(".number-control small")?.textContent.trim() || "";
    return unit ? `${value} ${unit}` : value;
  }
  function placeBubble() {
    if (!drag) return;
    const { input, rect, thumb } = drag;
    const x = rect.left + thumb / 2 + fraction(input) * (rect.width - thumb);
    // 只改变化了的部分（同一个文字节点、相同坐标不重写），拖动中每次输入少一些样式与布局失效
    const text = bubbleText(input);
    if (bubbleNode.data !== text) bubbleNode.data = text;
    const bx = `${x.toFixed(1)}px`, by = `${(rect.top + rect.height / 2 - thumb / 2 - 8).toFixed(1)}px`;
    if (drag.bx !== bx) { drag.bx = bx; bubble.style.setProperty("--um-bx", bx); }
    if (drag.by !== by) { drag.by = by; bubble.style.setProperty("--um-by", by); }
  }
  function endDrag() {
    if (!drag) return;
    const finished = drag;
    finished.input.classList.remove("um-dragging");
    drag = null;
    setStill("drag", false);
    bubble.classList.remove("is-on");
    clearTimeout(bubbleTimer);
    bubbleTimer = later(() => { if (!drag) detach(bubble); }, 160);
    // 拖参数时实验时长在变，步骤刻度先收起，松手后按新时长重新摆放
    if (finished.hidMarks) { marksKey = ""; layoutMarks(); }
    // 拖动过程中只更新气泡和符号发光；松手后再统一做读数滚入、结果扫光和残影（避免每一帧都触发额外的布局）
    if (finished.param && finished.changed) {
      rollChanged();
      if (!compat()) renderGhost();
      acceptParamQuestion();
    } else readoutBefore = null;
  }
  doc.addEventListener("pointerdown", event => {
    const input = event.target.closest?.('.experiment-card .parameter > input[type="range"], .experiment-card #timeline');
    if (!input || input.disabled || event.button > 0) return;
    // 只在按下时量一次位置，拖动过程中不再读布局
    drag = { input, param: input !== timeline, changed: false, rect: input.getBoundingClientRect(), thumb: parseFloat(getComputedStyle(input).getPropertyValue("--um-thumb")) || 16 };
    if (drag.param) snapshotReadouts(); // 拖动开始时的读数，松手时与之比较
    if (drag.param && marks.isConnected && !marks.hidden) { marks.hidden = true; drag.hidMarks = true; }
    setStill("drag", true);
    input.classList.add("um-dragging");
    clearTimeout(bubbleTimer);
    attach(bubble, body);
    placeBubble();
    bubble.classList.add("is-on");
  }, true);
  ["pointerup", "pointercancel"].forEach(type => doc.addEventListener(type, endDrag, true));
  window.addEventListener("blur", endDrag);

  // 吸附：只在指针拖动中、接近原题值时（取“1 个步长”与“量程 2%”中较大者）；
  // 在 input 事件的捕获阶段改值，现有监听器随同一事件拿到原题值并更新（与另派发一次等效，且不重复计算）
  let snapTimer = 0;
  function maybeSnap(input) {
    if (!drag || drag.input !== input || compat()) return;
    const orig = originalFor(input);
    if (orig === null) return;
    const value = Number(input.value);
    const threshold = Math.max(Number(input.step) || 1, (Number(input.max) - Number(input.min)) * 0.02);
    if (Math.abs(value - orig) < 1e-9 || Math.abs(value - orig) > threshold + 1e-9) return;
    input.value = String(orig);
    input.classList.add("um-snap");
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => input.classList.remove("um-snap"), 320);
    vibrate(8);
  }

  /* ==================== A6 读数滚入 / 结果胶囊扫光 ==================== */
  const READOUTS = [
    "#scene .metric-panel strong", "#stopDistanceLabel", "#genericPhysicsResult", "#scene .generic-physics-readout dd",
    "#mathCoordinate", "#chemRate", "#scene .population-answer", "#scene .mendel-prob-row strong",
    "#scene .projectile-readout strong", "#scene .circuit-readout strong", "#scene .board-slider-live-card strong",
    ".experiment-card .number-control strong", ".formula-spotlight p.formula-result > span"
  ].join(", ");
  const displayCache = new WeakMap();
  const lastRoll = new WeakMap();
  let readoutBefore = null;
  let capsuleAt = 0;
  const rollHosts = new Set();
  let rollHostTimer = 0;
  function snapshotReadouts() {
    readoutBefore = compat() || reduced() || !generated() ? null : $$(READOUTS).map(node => node.textContent);
  }
  function rollChanged() {
    const before = readoutBefore;
    readoutBefore = null;
    if (!before) return;
    const nodes = $$(READOUTS);
    if (nodes.length !== before.length) return; // 结构变了（换模板）就不做
    const t = performance.now();
    const changed = nodes.filter((node, index) => node.textContent !== before[index]);
    if (!changed.length) return;
    // 先统一读，再统一写
    const plan = changed.map(node => {
      if (!node.getClientRects().length) return null;
      if (node.matches(".formula-spotlight p.formula-result > span")) return { node: node.parentElement, capsule: true };
      if (t - (lastRoll.get(node) || 0) < 120) return null; // 连续拖动时不每一帧都重启
      let display = displayCache.get(node);
      if (!display) { display = getComputedStyle(node).display; displayCache.set(node, display); }
      return { node, inline: display === "inline" };
    }).filter(Boolean);
    if (plan.some(item => !item.capsule && !item.inline)) {
      // 节点在动画中被整体替换时收不到 animationend，按时清掉父元素的临时裁切
      clearTimeout(rollHostTimer);
      rollHostTimer = setTimeout(() => { rollHosts.forEach(host => host.classList.remove("um-roll-host")); rollHosts.clear(); }, 240);
    }
    plan.forEach(item => {
      if (item.capsule) {
        if (t - capsuleAt < 360) return;
        capsuleAt = t;
        replay(item.node, "um-capsule-a", "um-capsule-b");
        return;
      }
      lastRoll.set(item.node, t);
      if (item.inline) { replay(item.node, "um-fade-a", "um-fade-b"); return; }
      const host = item.node.parentElement;
      if (host) { host.classList.add("um-roll-host"); rollHosts.add(host); }
      replay(item.node, "um-roll-a", "um-roll-b");
    });
  }

  /* ==================== C1 公式联动：参数 → 公式符号 ==================== */
  // science-formulas.js 在带 data-fx-symbols 的公式卡里给原子加 data-sym（只加属性，文字与 sourceText 不变）
  const spotlight = $(".formula-spotlight");
  // 公式卡只给当前模板映射到的符号加标记（每次改参数公式卡都会重绘，少生成节点）；换模板后下一次重绘生效
  function syncSymbolList() {
    if (!spotlight) return;
    if (compat()) { spotlight.removeAttribute("data-fx-symbols"); return; }
    const list = (SYMBOLS[templateKey()] || []).filter(Boolean).join(" ");
    if (spotlight.dataset.fxSymbols === list) return;
    spotlight.dataset.fxSymbols = list;
    // 立即按新清单重绘一次公式卡（只是重绘，不改数值）
    if (generated() && typeof updateFormulaSpotlight === "function") { try { updateFormulaSpotlight(state.subject); } catch { /* 忽略 */ } }
  }
  // 只收录核对过、参数与符号一一对应的模板（覆盖清单见 docs/ui-motion-2026-11-06.md）
  const SYMBOLS = {
    brake: ["v0", "a"], projectile: ["v0", "h"], circuit: ["U", "R"],
    lever: ["F1", "l1"], lens: ["u", "f"], buoyancy: ["V排", "ρ液"], lampPower: ["U", "I"],
    parallelCircuit: ["R1", "R2"], planeMirror: ["u", null], seriesCircuit: ["U", "R2"], liquidPressure: ["h", "ρ"],
    efficiency: ["G", "F"], sound: ["f", "A"], naclSolution: [null, "w"], kno3Cooling: ["W", "T"],
    pythagoras: ["a", "b"], unitCircle: ["θ", null], tangent: ["x", null], population: ["λ", null]
  };
  function templateKey() {
    if (!appReady()) return "";
    try {
      const generic = activeGenericTemplate();
      if (generic) return generic.id;
      if (state.subject === "物理") return state.physicsTemplate === "brake" && state.brakeMode !== "constant" ? "brake-other" : state.physicsTemplate;
      if (state.subject === "化学") return "feCuSO4";
      if (state.subject === "数学") return "tangent";
      if (state.subject === "生物") return "cell";
    } catch { /* 忽略 */ }
    return "";
  }
  // 公式卡每次改参数都会整体重绘，新节点本来就要算样式：只给新节点补上类（改样式表会让整页重算，代价更大）
  let symbolTimer = 0;
  function glowSymbols(index) {
    if (!spotlight || compat() || reduced()) return;
    const symbol = SYMBOLS[templateKey()]?.[index];
    if (!symbol) return;
    spotlight.querySelectorAll("strong [data-sym]").forEach(node => {
      const on = node.dataset.sym === symbol;
      if (node.classList.contains("um-sym-on") !== on) node.classList.toggle("um-sym-on", on);
    });
    clearTimeout(symbolTimer);
    symbolTimer = setTimeout(() => spotlight.querySelectorAll(".um-sym-on").forEach(node => node.classList.remove("um-sym-on")), 650);
  }

  /* ==================== C5 对比残影（刹车、平抛、木板—滑块） ==================== */
  const ghost = { snapshot: null, armed: false, nodes: [] };
  function removeGhostNodes() { ghost.nodes.forEach(node => node.remove()); ghost.nodes = []; }
  function clearGhost() { removeGhostNodes(); ghost.snapshot = null; }
  function ghostLabel(snapshot) {
    const parts = [0, 1].filter(i => Math.abs(snapshot.values[i] - (i ? state.p2 : state.p1)) > 1e-9).map(i => {
      const symbol = String(snapshot.labels[i] || "").trim().split(/\s+/).pop();
      return `${symbol}=${snapshot.texts[i]}`;
    });
    return parts.length ? `上次 ${parts.join("，")}` : "";
  }
  function takeGhostSnapshot() {
    if (!generated() || compat()) return;
    const kind = templateKey();
    if (!["brake", "projectile", "boardSlider"].includes(kind)) return;
    try {
      const snapshot = { kind, values: [state.p1, state.p2], labels: [paramSpec(0)?.label, paramSpec(1)?.label], texts: [...elements.paramValues].map(n => n.textContent.trim()) };
      if (kind === "brake") snapshot.stop = physicsBrakeModel().stopDistance;
      if (kind === "projectile") { const m = projectileModel(); snapshot.model = { speed: m.speed, height: m.height, gravity: m.gravity, fallTime: m.fallTime }; }
      if (kind === "boardSlider") snapshot.relative = buildPhysicsBoardSliderContent().model.relativeStopDistance;
      removeGhostNodes();
      ghost.snapshot = snapshot;
    } catch { ghost.snapshot = null; }
  }
  function ghostTag(label) {
    const tag = doc.createElement("button");
    tag.type = "button";
    tag.className = "um-ghost-label";
    tag.textContent = label;
    tag.title = "清除对比残影";
    tag.addEventListener("click", event => { event.stopPropagation(); clearGhost(); });
    return tag;
  }
  function renderGhost() {
    const snapshot = ghost.snapshot;
    removeGhostNodes();
    if (!snapshot || compat() || !generated() || templateKey() !== snapshot.kind) return;
    const label = ghostLabel(snapshot);
    if (!label) return;
    try {
      if (snapshot.kind === "brake") {
        const road = elements.car?.parentElement;
        const max = physicsVisualDistanceMax(physicsBrakeModel().stopDistance);
        if (!road || snapshot.stop > max + 1e-9) return; // 超出当前路面比例时不画
        const left = physicsDistanceLeftPercent(snapshot.stop, max);
        const line = doc.createElement("i");
        line.className = "um-ghost um-ghost-stop";
        line.style.left = `${left}%`;
        road.append(line);
        ghost.nodes.push(line);
        // 路面有透视变换：标签放在不变换的 road-area 里，按虚线的实际位置摆放（与原有“停止点”标签同样的做法）
        const area = road.parentElement;
        if (area) {
          const lineBox = line.getBoundingClientRect();
          const areaBox = area.getBoundingClientRect();
          const tag = ghostTag(label);
          Object.assign(tag.style, { left: `${(lineBox.left + lineBox.width / 2 - areaBox.left).toFixed(1)}px`, top: `${(lineBox.top - areaBox.top - 28).toFixed(1)}px`, transform: "translateX(-50%)" });
          area.append(tag);
          ghost.nodes.push(tag);
        }
      } else if (snapshot.kind === "boardSlider") {
        const board = elements.boardSliderBoard;
        const length = state.boardSliderParams?.boardLength || state.p2;
        if (!board || !(length > 0) || snapshot.relative > length + 1e-9) return;
        const left = clamp(snapshot.relative / length, 0, 1) * 100;
        const line = doc.createElement("i");
        line.className = "um-ghost um-ghost-board";
        line.style.left = `${left}%`;
        const tag = ghostTag(label);
        Object.assign(tag.style, { left: `${left}%`, bottom: "calc(100% + 16px)", transform: "translateX(-50%)" });
        board.append(line, tag);
        ghost.nodes.push(line, tag);
      } else if (snapshot.kind === "projectile") {
        const svg = $("#projectileStage .projectile-diagram");
        const prediction = $("#projectilePrediction");
        if (!svg || !prediction || !window.ScienceMotion?.projectileGeometry) return;
        // 按当前画面的同一比例画上一次的轨迹（坐标换算与 ScienceMotion.projectileGeometry 相同）
        const scale = window.ScienceMotion.projectileGeometry(projectileModel(), 0).scale;
        const { speed, height, gravity, fallTime } = snapshot.model;
        const at = s => ({ x: 80 + speed * s * scale, y: 200 - height * scale + 0.5 * gravity * s * s * scale });
        const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("class", "um-ghost um-ghost-path");
        path.setAttribute("d", Array.from({ length: 49 }, (_, i) => { const p = at(fallTime * i / 48); return `${i ? "L" : "M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`; }).join(" "));
        prediction.before(path);
        const end = at(fallTime);
        const text = doc.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("class", "um-ghost-svg-label");
        text.setAttribute("x", Math.min(560, Math.max(60, end.x)).toFixed(1));
        text.setAttribute("y", Math.max(20, end.y - 14).toFixed(1));
        text.setAttribute("text-anchor", "middle");
        text.textContent = label;
        text.addEventListener("click", clearGhost);
        svg.append(text);
        // 示意图按比例缩放，标签换算成屏幕上不小于 12px 的字号
        const ratio = Math.abs(svg.getScreenCTM?.()?.a || 1);
        text.setAttribute("font-size", Math.max(13, 12.5 / ratio).toFixed(1));
        ghost.nodes.push(path, text);
      }
    } catch { /* 画不出残影时不影响实验 */ }
  }
  // 播放开始：把当前参数记为“这一次”；重置、换题、换实验时清除
  playButton?.addEventListener("click", () => { ghost.armed = true; }, true);
  $("#resetButton")?.addEventListener("click", () => { clearGhost(); ghost.armed = true; }, true);
  let lastQuestion = "";
  let lastTemplate = "";
  function watchExperimentChange() {
    if (!appReady()) return;
    const question = state.hasGenerated ? state.generatedQuestion || "" : "";
    const template = `${state.subject}|${templateKey()}`;
    if (template !== lastTemplate || question !== lastQuestion) {
      clearGhost();
      ghost.armed = state.hasGenerated;
    }
    lastQuestion = question;
    lastTemplate = template;
  }
  // 拖动参数时 app.js 会按新数值改写题干，这不算“换题”
  const acceptParamQuestion = () => { if (appReady()) lastQuestion = state.hasGenerated ? state.generatedQuestion || "" : ""; };
  function beforeParamChange() {
    if (ghost.armed && !compat()) { takeGhostSnapshot(); ghost.armed = false; }
    snapshotReadouts();
  }
  function afterParamChange(index) {
    layoutMarks();
    rollChanged();
    glowSymbols(index);
    if (!compat()) renderGhost();
    acceptParamQuestion();
  }

  /* ==================== 参数 input：捕获阶段（改前）/ 冒泡阶段（改后） ==================== */
  doc.addEventListener("input", event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "range" || input === timeline || rangeIndex(input) < 0) return;
    if (drag?.input === input) {
      // 指针拖动中：读数快照已在按下时取好，这里只记下残影的“上一次”并处理吸附
      if (ghost.armed && !compat()) { takeGhostSnapshot(); ghost.armed = false; }
    } else beforeParamChange();
    maybeSnap(input);
  }, true);
  doc.addEventListener("input", event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "range") return;
    if (input === timeline) { if (drag?.input === timeline) placeBubble(); refreshMarks(); return; }
    const index = rangeIndex(input);
    if (index < 0) return;
    if (drag?.input === input) {
      drag.changed = true;
      glowSymbols(index);
      placeBubble();
      acceptParamQuestion();
      return;
    }
    afterParamChange(index);
  });
  // −/+ 与重置按钮：同样在点击前后比较读数
  doc.addEventListener("click", event => {
    const target = event.target.closest?.(".experiment-card .number-control button, #resetButton");
    if (!target || target.disabled) return;
    if (target.id === "resetButton") snapshotReadouts(); else beforeParamChange();
  }, true);
  doc.addEventListener("click", event => {
    const target = event.target.closest?.(".experiment-card .number-control button, #resetButton");
    if (!target || target.disabled) return;
    paintAll();
    if (target.id === "resetButton") { rollChanged(); acceptParamQuestion(); return; }
    afterParamChange(rangeIndex($(`#${target.dataset.target}`)));
  });

  /* ==================== B5 数值直接输入；双击回到原题值；长按 −/+ 连续步进 ==================== */
  let editClickTimer = 0;
  let tipShownAt = 0;
  let editing = null; // { field, strong, input, control }
  function restoreOriginal(input) {
    const orig = originalFor(input);
    if (orig === null || Math.abs(Number(input.value) - orig) < 1e-9) return false;
    input.value = String(orig);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  const inputForValue = strong => strong.closest(".parameter")?.querySelector('input[type="range"]') || null;
  function finishEditor() {
    const session = editing;
    editing = null;
    if (!session) return;
    session.field.remove();
    session.control.classList.remove("um-editing");
    session.strong.classList.remove("um-edit-hidden");
    doc.removeEventListener("pointerdown", session.outside, true);
  }
  function commitEditor({ refocus }) {
    const session = editing;
    if (!session) return;
    const { field, input, control } = session;
    const spec = paramSpec(rangeIndex(input));
    const unit = control.querySelector("small")?.textContent.trim() || "";
    let text = field.value.trim().replace(/[−–—]/g, "-").replace(/．/g, ".").replace(/[\s,，]/g, "");
    if (unit && text.endsWith(unit)) text = text.slice(0, -unit.length);
    if (spec?.prefix?.trim() === "−" && text.startsWith("-")) text = text.slice(1); // 显示为“−5”的量，滑块存的是 5
    const value = Number(text);
    if (!text || !Number.isFinite(value) || value < Number(input.min) - 1e-9 || value > Number(input.max) + 1e-9) {
      const prefix = spec?.prefix || "";
      field.title = `可用范围 ${prefix}${input.min} – ${prefix}${input.max}${unit ? ` ${unit}` : ""}`;
      replay(field, "is-invalid", "is-invalid-b");
      if (refocus) field.focus();
      return; // 不提交，也不夹回范围内
    }
    finishEditor();
    if (Math.abs(value - Number(input.value)) > 1e-12) {
      input.value = String(value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
  function openEditor(strong) {
    const input = inputForValue(strong);
    const control = strong.closest(".number-control");
    if (!input || !control || input.disabled || compat() || !generated()) return;
    const spec = paramSpec(rangeIndex(input));
    if (!spec || typeof spec.valueText === "function") return; // 文字型参数（如“接触面”）不做数字输入
    finishEditor();
    const field = doc.createElement("input");
    field.type = "text";
    field.inputMode = "decimal";
    field.className = "um-num-edit";
    field.setAttribute("aria-label", `${spec.label || "参数"}的数值`);
    field.value = strong.textContent.trim();
    const style = getComputedStyle(strong);
    Object.assign(field.style, {
      left: `${strong.offsetLeft}px`, top: `${strong.offsetTop}px`,
      width: `${Math.max(strong.offsetWidth, 28)}px`, height: `${strong.offsetHeight}px`,
      fontSize: style.fontSize, fontWeight: style.fontWeight, textAlign: style.textAlign
    });
    control.classList.add("um-editing");
    strong.classList.add("um-edit-hidden");
    control.append(field);
    const outside = event => { if (event.target !== field) finishEditor(); };
    editing = { field, strong, input, control, outside };
    field.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.isComposing) { event.preventDefault(); commitEditor({ refocus: true }); }
      else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); finishEditor(); strong.focus(); }
    });
    // 失焦时确认；超出范围时抖动并保留，点别处再放弃
    field.addEventListener("blur", () => { if (editing?.field === field) { commitEditor({ refocus: false }); if (editing?.field === field) doc.addEventListener("pointerdown", outside, true); } });
    field.addEventListener("dblclick", event => { event.preventDefault(); finishEditor(); restoreOriginal(input); });
    field.focus();
    field.select();
  }
  doc.addEventListener("click", event => {
    const strong = event.target.closest?.(".experiment-card .number-control strong");
    if (!strong || compat()) return;
    clearTimeout(editClickTimer);
    if (event.detail > 1 || performance.now() - tipShownAt < 700) return;
    editClickTimer = setTimeout(() => openEditor(strong), 230); // 留出双击的时间
  });
  doc.addEventListener("dblclick", event => {
    const target = event.target.closest?.('.experiment-card .number-control strong, .experiment-card .parameter > input[type="range"]');
    if (!target || compat()) return;
    clearTimeout(editClickTimer);
    const input = target.matches("input") ? target : inputForValue(target);
    if (input && !input.disabled) restoreOriginal(input);
  });
  doc.addEventListener("keydown", event => {
    const strong = event.target.closest?.(".experiment-card .number-control strong");
    if (!strong || compat() || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    event.stopPropagation();
    openEditor(strong);
  }, true);
  if (!compat()) {
    $$(".experiment-card .number-control strong").forEach(strong => {
      strong.tabIndex = 0;
      strong.title = "点击输入数值 · 双击回到原题值";
    });
  }

  // 长按 −/+：400ms 后开始连续步进并逐渐加速；松开后不再补一次点击
  let repeat = null; // { button, timer, delay, fired }
  let suppressClick = null;
  function stopRepeat() {
    if (!repeat) return;
    clearTimeout(repeat.timer);
    if (repeat.fired) suppressClick = repeat.button;
    repeat = null;
  }
  doc.addEventListener("pointerdown", event => {
    const button = event.target.closest?.(".experiment-card .number-control button");
    stopRepeat();
    suppressClick = null;
    if (!button || button.disabled || event.button > 0 || compat()) return;
    const session = { button, timer: 0, delay: 170, fired: false };
    const tick = () => {
      if (repeat !== session || button.disabled) return;
      session.fired = true;
      button.click();
      session.delay = Math.max(40, session.delay * 0.8);
      session.timer = setTimeout(tick, session.delay);
    };
    session.timer = setTimeout(tick, 400);
    repeat = session;
  }, true);
  doc.addEventListener("pointerup", stopRepeat, true);
  doc.addEventListener("pointercancel", stopRepeat, true);
  doc.addEventListener("pointerout", event => { if (repeat && event.target === repeat.button && !repeat.button.contains(event.relatedTarget)) stopRepeat(); }, true);
  doc.addEventListener("click", event => {
    if (!suppressClick) return;
    const button = suppressClick;
    suppressClick = null;
    if (event.isTrusted && event.target.closest?.(".number-control button") === button) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }, true);

  /* ==================== A4 思维链竖线 ==================== */
  const stepsHost = $(".reasoning-card .reasoning-steps");
  let activeStep = 0;
  function measureChain() {
    if (!stepsHost) return;
    const steps = $$(".reason-step", stepsHost);
    const active = steps.find(step => step.classList.contains("active"));
    const target = active || (steps.length && steps.every(step => step.classList.contains("done")) ? steps.at(-1) : null);
    const top = 22;
    const length = target && !target.classList.contains("pending-placeholder") ? Math.max(0, target.offsetTop + target.offsetHeight / 2 - top) : 0;
    const max = Math.max(0, stepsHost.offsetHeight - top * 2);
    stepsHost.style.setProperty("--um-chain", `${Math.min(length, max).toFixed(1)}px`);
    stepsHost.style.setProperty("--um-chain-on", length > 0 ? "1" : "0");
    stepsHost.classList.toggle("um-chain-lit", length > 0); // 伪元素只在有亮段时生成
  }
  function syncChain() {
    if (!stepsHost) return;
    const steps = $$(".reason-step", stepsHost);
    const activeIndex = steps.findIndex(step => step.classList.contains("active")) + 1;
    syncRail(steps);
    if (activeIndex === activeStep) return;
    const previous = activeStep;
    activeStep = activeIndex;
    measureChain();
    refreshMarks();
    const node = steps[activeIndex - 1];
    if (node && previous && !reduced() && !compat()) {
      node.classList.add("um-step-sweep");
      node.addEventListener("animationend", () => node.classList.remove("um-step-sweep"), { once: true });
    }
  }

  /* ==================== B3 时间轴步骤刻度（刹车：沿用演示模式已有的步骤—时间对应） ==================== */
  const transport = $(".experiment-card .transport");
  const marks = doc.createElement("nav");
  marks.className = "um-tl-marks";
  marks.setAttribute("aria-label", "解题步骤刻度");
  marks.hidden = true;
  function stepTimes() {
    if (!generated() || compat() || templateKey() !== "brake") return null;
    // playDemoSequence：第 1 步在起点；第 3 步在 max(1.2s, 38%)；第 4 步在 max(2.4s, 72%)（按实验时长与倍速换算）；第 2 步没有时间点
    const ms = (duration() / state.playbackRate) * 1000;
    if (!(ms > 0)) return null;
    return [[1, 0], [3, Math.min(1, Math.max(1200, ms * 0.38) / ms)], [4, Math.min(1, Math.max(2400, ms * 0.72) / ms)]];
  }
  let marksKey = "";
  function layoutMarks() {
    if (!transport || !timeline) return;
    const times = stepTimes();
    const visibleNow = Boolean(times) && getComputedStyle(transport).display !== "none" && timeline.offsetWidth > 0;
    marks.hidden = !visibleNow;
    if (!visibleNow) { marksKey = ""; markCover = null; detach(marks); return; }
    attach(marks, transport);
    const key = `${state.playbackRate}|${times.map(t => t[1].toFixed(3)).join(",")}|${timeline.offsetLeft}|${timeline.offsetWidth}|${timeline.offsetTop}|${timeline.offsetHeight}`;
    if (key !== marksKey) {
      marksKey = key;
      const thumb = parseFloat(getComputedStyle(timeline).getPropertyValue("--um-thumb")) || 14;
      const track = Math.max(0, timeline.offsetWidth - thumb);
      Object.assign(marks.style, {
        left: `${timeline.offsetLeft + thumb / 2}px`,
        width: `${track}px`,
        top: `${timeline.offsetTop + timeline.offsetHeight / 2}px`
      });
      marks.replaceChildren(...times.map(([step, at]) => {
        const button = doc.createElement("button");
        button.type = "button";
        button.className = "um-tl-mark";
        button.dataset.step = String(step);
        button.dataset.at = String(at);
        button.style.left = `${(at * 100).toFixed(2)}%`;
        button.setAttribute("aria-label", `跳到第 ${step} 步`);
        button.title = `第 ${step} 步`;
        return button;
      }));
      markCover = { track, reach: thumb / 2 + MARK_HALF + 2, items: $$(".um-tl-mark", marks).map(button => [button, Number(button.dataset.at)]) };
      coverMarks();
    }
    refreshMarks();
  }
  function refreshMarks() {
    if (marks.hidden || !timeline || !appReady()) return;
    const progress = fraction(timeline);
    $$(".um-tl-mark", marks).forEach(button => {
      button.classList.toggle("is-reached", progress >= Number(button.dataset.at) - 1e-6);
      button.classList.toggle("is-current", Number(button.dataset.step) === state.reasonStep);
    });
  }
  marks.addEventListener("click", event => {
    const button = event.target.closest(".um-tl-mark");
    if (!button || !generated()) return;
    timeline.value = String(Number(button.dataset.at) * 100);
    timeline.dispatchEvent(new Event("input", { bubbles: true }));
    activateReasoningStep(Number(button.dataset.step), { manual: true });
  });

  /* ==================== B4 快捷键 ==================== */
  const RATES = [0.5, 1, 1.5, 2];
  const keysPanel = doc.createElement("div");
  keysPanel.className = "um-keys";
  keysPanel.hidden = true;
  keysPanel.setAttribute("role", "dialog");
  keysPanel.setAttribute("aria-label", "快捷键");
  const KEY_ROWS = [
    [["空格"], "播放 / 暂停"], [["←", "→"], "上一步 / 下一步"], [["Shift", "←→"], "进度 ±5%"], [["R"], "重置"],
    [["F"], "全屏"], [["Esc"], "退出"], [["/"], "输入题目"], [["[", "]"], "降速 / 提速"], [["Ctrl", "K"], "命令面板"], [["?"], "快捷键一览"]
  ];
  keysPanel.innerHTML = `<dl class="um-keys-list">${KEY_ROWS.map(([keys, text]) => `<dt class="um-keys-keys">${keys.map(k => `<kbd class="um-kbd">${k}</kbd>`).join("")}</dt><dd class="um-keys-text">${text}</dd>`).join("")}</dl>`;
  const toggleKeys = force => {
    const show = force === undefined ? keysPanel.hidden : force;
    keysPanel.hidden = !show;
    if (show) attach(keysPanel, body); else detach(keysPanel);
  };
  doc.addEventListener("pointerdown", event => { if (!keysPanel.hidden && !keysPanel.contains(event.target)) toggleKeys(false); }, true);

  function setRate(rate) {
    if (!appReady() || state.playbackRate === rate) return;
    state.playbackRate = rate;
    const button = $("#playbackButton");
    if (button) button.textContent = `${rate}×`;
    if (typeof showToast === "function") showToast(`播放速度已调整为 ${rate}×`);
    marksKey = "";
    layoutMarks();
  }
  // 倍速按钮的点击处理在 app.js（不经过 setRate）；本文件晚于 app.js 加载，同一元素上的监听排在其后，此时倍速已更新
  $("#playbackButton")?.addEventListener("click", () => { marksKey = ""; layoutMarks(); });
  function stepBy(delta) {
    if (!generated()) return false;
    const total = Math.max(config().steps.length, 4);
    const next = clamp((state.reasonStep || 1) + delta, 1, total);
    if (next === state.reasonStep) return false;
    activateReasoningStep(next, { manual: true });
    return true;
  }
  function seekBy(delta) {
    if (!timeline || !shown(timeline) || timeline.disabled) return false;
    timeline.value = String(clamp(Number(timeline.value) + delta, 0, 100));
    timeline.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }
  // 盖在实验前面的层（2026-11-07 盘点）：原生 dialog（命令面板、公告、示意图放大、题目条件确认）、
  // .modal-backdrop.show（个人密钥）、拍照识题、生成遮罩、AI 问答全屏路由。快捷键、Ctrl+K、? 一览、手机手势共用这一个判断。
  const blockingLayerOpen = () => Boolean($("dialog[open], .modal-backdrop.show, #photoCamera:not([hidden]), #generationOverlay.show"))
    || ["announcements-open", "photo-camera-open", "ai-tutor-route"].some(name => body.classList.contains(name));
  // 下拉菜单（menu-select.js）的触发按钮替代了原生 select，同样不触发实验快捷键
  const typingTarget = target => Boolean(target?.closest?.('input:not([type="range"]), textarea, select, [data-menu-select-trigger], .menu-select-panel, [contenteditable]:not([contenteditable="false"]), summary'));
  doc.addEventListener("keydown", event => {
    if (event.defaultPrevented || compat() || event.isComposing) return;
    const { key } = event;
    if (key === "Escape" && !keysPanel.hidden) { toggleKeys(false); event.preventDefault(); return; }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    // 与空格快捷键相同的排除：输入框、文本域、可编辑区域、对话框、AI 问答页（Esc 由原有逻辑处理）
    if (blockingLayerOpen() || typingTarget(event.target)) return;
    const onRange = Boolean(event.target?.matches?.('input[type="range"]'));
    let handled = false;
    if (key === "ArrowLeft" || key === "ArrowRight") {
      if (onRange) return; // 方向键留给获得焦点的滑块
      const dir = key === "ArrowRight" ? 1 : -1;
      handled = event.shiftKey ? seekBy(dir * 5) : stepBy(dir);
    } else if (key === "r" || key === "R") {
      const reset = $("#resetButton");
      if (generated() && shown(reset)) { reset.click(); handled = true; }
    } else if (key === "f" || key === "F") {
      const button = [$("#fullscreenButton"), $("#sceneFullscreenButton")].find(shown);
      if (generated() && button) { button.click(); handled = true; }
    } else if (key === "/") {
      const input = $("#questionInput");
      if (input) { input.focus(); input.select?.(); handled = true; }
    } else if (key === "[" || key === "]") {
      if (appReady()) {
        const index = RATES.indexOf(state.playbackRate);
        setRate(RATES[clamp((index < 0 ? 1 : index) + (key === "]" ? 1 : -1), 0, RATES.length - 1)]);
        handled = true;
      }
    } else if (key === "?") {
      toggleKeys();
      handled = true;
    }
    if (handled) event.preventDefault();
  });
  // 相关按钮的提示带上快捷键
  // 播放键的类在每次改参数时都会被重写（观察器随之触发），这里只在提示文字确实变化时才写，避免每次输入都改一遍属性
  const setTitle = (el, title) => { if (el && el.getAttribute("title") !== title) el.setAttribute("title", title); };
  function setTitles() {
    if (compat()) return;
    [["#resetButton", "重置（R）"], ["#playbackButton", "倍速（[ / ]）"], ["#fullscreenButton", "全屏（F）"], ["#sceneFullscreenButton", "全屏（F）"],
      ["#physicsPresetToggle", "实验库（Ctrl K）"]].forEach(([selector, title]) => setTitle($(selector), title));
    setTitle(playButton, playButton?.classList.contains("playing") ? "暂停（空格）" : "播放（空格）");
  }

  /* ==================== B1 手机参数底栏 ==================== */
  const parameters = $(".experiment-card .parameters");
  const card = $(".experiment-card");
  const scene = $("#scene");
  const dock = doc.createElement("section");
  dock.className = "um-dock";
  dock.setAttribute("aria-label", "实验参数");
  dock.innerHTML = '<button type="button" class="um-dock-handle" aria-expanded="false" aria-label="展开参数"></button><section class="um-dock-body"></section>';
  const dockHandle = $(".um-dock-handle", dock);
  const dockBody = $(".um-dock-body", dock);
  let docked = false;
  // 提示条按底栏高度上移；变量写在提示条自身，不写在 body 上（避免整页继承变量表变化）
  const toastNode = $("#toast");
  const setDockHeight = () => toastNode?.style.setProperty("--um-dock-h", `${dock.offsetHeight}px`);
  function rowsVisible() {
    if (!parameters || getComputedStyle(parameters).display === "none") return false;
    return $$(".parameter", parameters).some(row => getComputedStyle(row).display !== "none");
  }
  function dockEligible() {
    if (!parameters || !card || !scene || compat() || !dockQuery.matches || !generated()) return false;
    if (["awaiting-generation", "fullscreen-lock", "ai-tutor-route", "announcements-open", "demo-mode"].some(name => body.classList.contains(name))) return false;
    return !card.classList.contains("immersive-mode") && rowsVisible();
  }
  function setDocked(on) {
    if (on === docked || !parameters) return;
    docked = on;
    if (on) {
      parameters.style.minHeight = `${parameters.offsetHeight}px`; // 原位置保留同样高度，页面不跳
      dock.classList.toggle("is-week1", Boolean(card.querySelector(".week1-scene")));
      attach(dock, parameters);
      dockBody.append(...[...parameters.children].filter(node => node !== dock));
      body.classList.add("um-docked");
      setDockHeight();
    } else {
      dock.classList.remove("is-expanded");
      dockHandle.setAttribute("aria-expanded", "false");
      dockHandle.setAttribute("aria-label", "展开参数");
      [...dockBody.children].forEach(node => parameters.insertBefore(node, dock));
      detach(dock);
      parameters.style.minHeight = "";
      body.classList.remove("um-docked");
    }
  }
  function updateDock() {
    if (!parameters) return;
    if (!dockEligible()) { setDocked(false); return; }
    const sceneBox = scene.getBoundingClientRect();
    const slot = parameters.getBoundingClientRect();
    // 实验画面在视口内、参数在原位置看不全时固定到底部；滚到参数整块露出（底栏之上）时放回原位
    const sceneInView = sceneBox.bottom > 60 && sceneBox.top < innerHeight - 140;
    const slotCovered = docked ? slot.bottom > innerHeight - dock.offsetHeight + 2 : slot.bottom > innerHeight + 4;
    setDocked(sceneInView && slotCovered);
  }
  function toggleDock(expand = !dock.classList.contains("is-expanded")) {
    if (dock.classList.contains("is-week1")) return; // 并联电路、平面镜保持原来的三行参数
    dock.classList.toggle("is-expanded", expand);
    dockHandle.setAttribute("aria-expanded", String(expand));
    dockHandle.setAttribute("aria-label", expand ? "收起参数" : "展开参数");
    setDockHeight();
  }
  let handleStart = null;
  dockHandle.addEventListener("pointerdown", event => { handleStart = { y: event.clientY, moved: false }; try { dockHandle.setPointerCapture(event.pointerId); } catch { /* 忽略 */ } });
  dockHandle.addEventListener("pointermove", event => {
    if (!handleStart || handleStart.moved) return;
    const dy = event.clientY - handleStart.y;
    if (Math.abs(dy) > 24) { handleStart.moved = true; toggleDock(dy < 0); }
  });
  dockHandle.addEventListener("click", () => { if (!handleStart?.moved) toggleDock(); handleStart = null; });
  dockHandle.addEventListener("pointercancel", () => { handleStart = null; });
  window.addEventListener("scroll", updateDock, { passive: true });
  window.addEventListener("resize", () => { setDocked(false); updateDock(); });

  /* ==================== B2 电脑端右侧栏收起 ==================== */
  const insight = $(".insight-column");
  const INSIGHT_KEY = "masterLab.insightCollapsed.v1";
  const rail = doc.createElement("nav");
  rail.className = "um-rail";
  rail.setAttribute("aria-label", "右侧栏");
  rail.innerHTML = `
    <button type="button" class="um-rail-btn um-rail-steps" data-open=".reasoning-card" aria-label="展开解题思维链" title="解题思维链"><i class="um-rail-dot"></i><i class="um-rail-dot"></i><i class="um-rail-dot"></i><i class="um-rail-dot"></i></button>
    <button type="button" class="um-rail-btn um-rail-icon" data-open=".mentor-card" aria-label="展开 AI 导师" title="AI 导师"><b class="um-rail-ai" aria-hidden="true">AI</b></button>
    <button type="button" class="um-rail-btn um-rail-icon" data-open=".favorites-card" aria-label="展开已收藏的实验" title="已收藏的实验"><svg class="um-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.8 4.8L19 9.5l-4.2 3.1 1.5 5-4.3-3-4.3 3 1.5-5L5 9.5l5.2-1.7z"/></svg></button>`;
  const insightToggle = doc.createElement("button");
  insightToggle.type = "button";
  insightToggle.className = "um-insight-toggle";
  insightToggle.setAttribute("aria-label", "收起右侧栏");
  insightToggle.title = "收起右侧栏";
  insightToggle.innerHTML = '<svg class="um-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
  // 两栏布局（≥1101px）时才挂到右栏上
  const placeInsightControls = () => {
    if (!insight || compat() || !wideQuery.matches) { detach(insightToggle); detach(rail); return; }
    attach(rail, insight, insight.firstChild);
    attach(insightToggle, insight, rail);
  };
  placeInsightControls();
  wideQuery.addEventListener?.("change", placeInsightControls);
  function readCollapsed() { try { return localStorage.getItem(INSIGHT_KEY) === "1"; } catch { return false; } }
  function writeCollapsed(on) { try { localStorage.setItem(INSIGHT_KEY, on ? "1" : "0"); } catch { /* 浏览器禁止存储时只在本页生效 */ } }
  // 过渡只用透明度与位移：收起时右栏先淡出右移，再切换布局，实验卡随之加宽并淡入；展开时反向
  let collapseTimer = 0;
  function setCollapsed(on, { animate = true, focus = null } = {}) {
    clearTimeout(collapseTimer);
    const apply = () => {
      body.classList.remove("um-insight-leaving");
      body.classList.toggle("um-insight-collapsed", on);
      if (animate && !reduced()) {
        const experimentCard = $(".experiment-card");
        if (experimentCard) replay(experimentCard, "um-widen-a", "um-widen-b");
        if (!on) $$(":scope > .card", insight).forEach(cardNode => replay(cardNode, "um-enter-a", "um-enter-b"));
      }
      if (focus) $(focus)?.scrollIntoView({ block: "nearest" });
    };
    if (on && animate && !reduced() && wideQuery.matches) {
      body.classList.add("um-insight-leaving");
      collapseTimer = setTimeout(apply, 180);
    } else apply();
    writeCollapsed(on);
  }
  doc.addEventListener("animationend", event => {
    if (/^um-(widen|enter)-[ab]$/.test(event.animationName)) event.target.classList.remove("um-widen-a", "um-widen-b", "um-enter-a", "um-enter-b");
  });
  insightToggle.addEventListener("click", () => setCollapsed(true));
  rail.addEventListener("click", event => {
    const button = event.target.closest("button[data-open]");
    if (button) setCollapsed(false, { focus: button.dataset.open });
  });
  function syncRail(steps) {
    $$(".um-rail-dot", rail).forEach((dot, index) => {
      dot.classList.toggle("is-done", Boolean(steps[index]?.classList.contains("done")));
      dot.classList.toggle("is-active", Boolean(steps[index]?.classList.contains("active")));
    });
  }
  if (insight && !compat() && readCollapsed()) setCollapsed(true, { animate: false });

  /* ==================== C2 卡片聚光、学科标签指示块（仅鼠标设备） ==================== */
  const LIT = ".experiment-card, .reasoning-card, .mentor-card, .favorites-card";
  let litCard = null;
  let lastMove = -Infinity;
  const unlight = () => { litCard?.classList.remove("um-lit"); litCard = null; };
  doc.addEventListener("pointermove", event => {
    if (event.pointerType !== "mouse" || compat() || !fineQuery.matches) return;
    if (event.timeStamp - lastMove < 16) return; // 按事件时间戳节流，不另申请动画帧
    lastMove = event.timeStamp;
    const cardNode = event.target.closest?.(LIT) || null;
    if (cardNode !== litCard) { unlight(); litCard = cardNode; litCard?.classList.add("um-lit"); }
    if (!cardNode) return;
    const rect = cardNode.getBoundingClientRect();
    cardNode.style.setProperty("--um-mx", `${(event.clientX - rect.left).toFixed(0)}px`);
    cardNode.style.setProperty("--um-my", `${(event.clientY - rect.top).toFixed(0)}px`);
  }, { passive: true });
  doc.addEventListener("mouseout", event => { if (!event.relatedTarget) unlight(); });

  const tabs = $(".subject-tabs");
  const glider = doc.createElement("span");
  glider.className = "um-tab-glider";
  glider.setAttribute("aria-hidden", "true");
  const TAB_TINTS = { "物理": "#e3eeff", "化学": "#dff6ee", "数学": "#eee4ff", "生物": "#ffeedd" };
  let gliderKey = "";
  function placeGlider() {
    if (!tabs) return;
    const on = fineQuery.matches && !compat();
    tabs.classList.toggle("um-has-glider", on);
    if (!on) { detach(glider); gliderKey = ""; return; }
    attach(glider, tabs); // 放在最后，不改变 .subject-tab:nth-child(n) 的学科配色
    const active = $(".subject-tab.active", tabs);
    if (!active || !active.offsetWidth) return;
    const key = `${active.dataset.subject}|${active.offsetLeft}|${active.offsetTop}|${active.offsetWidth}|${active.offsetHeight}`;
    if (key === gliderKey) return;
    const switched = Boolean(gliderKey) && gliderKey.split("|")[0] !== active.dataset.subject;
    gliderKey = key;
    Object.assign(glider.style, { width: `${active.offsetWidth}px`, height: `${active.offsetHeight}px`, transform: `translate(${active.offsetLeft}px, ${active.offsetTop}px)` });
    glider.style.setProperty("--um-glider-tint", TAB_TINTS[active.dataset.subject] || "#e3eeff");
    if (switched && !reduced()) { glider.classList.remove("um-glint"); void glider.offsetWidth; glider.classList.add("um-glint"); }
  }
  glider.addEventListener("animationend", () => glider.classList.remove("um-glint"));
  if (tabs) {
    $$(".subject-tab", tabs).forEach(tab => new MutationObserver(placeGlider).observe(tab, { attributes: true, attributeFilter: ["class"] }));
    if ("ResizeObserver" in window) new ResizeObserver(() => { gliderKey = ""; placeGlider(); }).observe(tabs);
    fineQuery.addEventListener?.("change", () => { gliderKey = ""; placeGlider(); });
  }

  /* ==================== C3 手机手势（仅触屏） ==================== */
  // 自带拖动交互的区域不接管手势（排除清单见记录文档）
  const GESTURE_EXCLUDE = "#plantCellViewport, .cell-explorer, #solenoidLab, .math-unit-circle, .biology-microscope-scene, .biology-population-scene, .diagram-zoomed .diagram-pan-viewport, input, button, select, textarea, a, summary, details";
  const zoomBadge = doc.createElement("span");
  zoomBadge.className = "um-zoom-badge";
  zoomBadge.setAttribute("aria-hidden", "true");
  const zoom = { scale: 1, x: 0, y: 0, originX: 0, originY: 0, pointers: new Map(), pinch: null, pan: null, swipe: null, lastTap: 0, badgeTimer: 0, targets: [] };
  const gestureReady = () => Boolean(scene) && coarseQuery.matches && !compat() && generated();
  const syncGestureClass = () => scene?.classList.toggle("um-gestures", gestureReady());
  const zoomTargets = () => [...scene.children].filter(el => el !== zoomBadge && !el.matches(".scene-top") && el.getClientRects().length);
  function applyZoom() {
    const zoomed = zoom.scale > 1.001;
    scene.classList.toggle("um-zoomed", zoomed);
    if (zoomed && !zoom.targets.length) zoom.targets = zoomTargets();
    zoom.targets.forEach(el => {
      if (!zoomed) { el.style.scale = ""; el.style.translate = ""; el.style.transformOrigin = ""; return; }
      el.style.transformOrigin = `${(zoom.originX - el.offsetLeft).toFixed(1)}px ${(zoom.originY - el.offsetTop).toFixed(1)}px`;
      el.style.scale = zoom.scale.toFixed(3);
      el.style.translate = `${zoom.x.toFixed(1)}px ${zoom.y.toFixed(1)}px`;
    });
    if (!zoomed) zoom.targets = [];
  }
  function showBadge() {
    zoomBadge.textContent = `${zoom.scale.toFixed(1)}×`;
    attach(zoomBadge, scene);
    zoomBadge.classList.add("is-on");
    clearTimeout(zoom.badgeTimer);
    zoom.badgeTimer = setTimeout(() => { zoomBadge.classList.remove("is-on"); zoom.badgeTimer = later(() => detach(zoomBadge), 220); }, 900);
  }
  function resetZoom(badge = true) {
    if (zoom.scale <= 1.001 && !zoom.targets.length) return;
    zoom.scale = 1; zoom.x = 0; zoom.y = 0;
    applyZoom();
    if (badge) showBadge();
  }
  function clampPan() {
    const w = scene.clientWidth, h = scene.clientHeight, k = zoom.scale - 1;
    const maxX = k * Math.max(zoom.originX, w - zoom.originX), maxY = k * Math.max(zoom.originY, h - zoom.originY);
    zoom.x = clamp(zoom.x, -maxX, maxX);
    zoom.y = clamp(zoom.y, -maxY, maxY);
  }
  scene?.addEventListener("pointerdown", event => {
    if (event.pointerType !== "touch" || !gestureReady() || blockingLayerOpen() || event.target.closest(GESTURE_EXCLUDE)) return;
    zoom.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (zoom.pointers.size === 2) {
      const [a, b] = [...zoom.pointers.values()];
      if (zoom.scale <= 1.001) {
        const rect = scene.getBoundingClientRect();
        zoom.originX = (a.x + b.x) / 2 - rect.left;
        zoom.originY = (a.y + b.y) / 2 - rect.top;
        zoom.targets = zoomTargets();
      }
      zoom.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, scale: zoom.scale };
      zoom.swipe = null;
      zoom.pan = null;
    } else if (zoom.pointers.size === 1) {
      zoom.swipe = { x: event.clientX, y: event.clientY, t: event.timeStamp };
      zoom.pan = zoom.scale > 1.001 ? { x: event.clientX, y: event.clientY, ox: zoom.x, oy: zoom.y } : null;
    }
  });
  scene?.addEventListener("pointermove", event => {
    if (!zoom.pointers.has(event.pointerId)) return;
    zoom.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (zoom.pinch && zoom.pointers.size >= 2) {
      const [a, b] = [...zoom.pointers.values()];
      zoom.scale = clamp(zoom.pinch.scale * (Math.hypot(a.x - b.x, a.y - b.y) / zoom.pinch.dist), 1, 2.5);
      clampPan();
      applyZoom();
      showBadge();
    } else if (zoom.pan) {
      zoom.x = zoom.pan.ox + (event.clientX - zoom.pan.x);
      zoom.y = zoom.pan.oy + (event.clientY - zoom.pan.y);
      clampPan();
      applyZoom();
    }
  });
  function endPointer(event) {
    if (!zoom.pointers.has(event.pointerId)) return;
    zoom.pointers.delete(event.pointerId);
    if (zoom.pointers.size < 2) zoom.pinch = null;
    const swipe = zoom.swipe;
    zoom.swipe = null;
    if (event.type === "pointerup" && swipe && zoom.pointers.size === 0) {
      const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y, dt = event.timeStamp - swipe.t;
      if (blockingLayerOpen()) { /* 手势期间弹出了弹层：不切换步骤 */ }
      else if (zoom.scale <= 1.001 && Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.6 && dt < 900) {
        if (stepBy(dx < 0 ? 1 : -1)) vibrate(8);
      } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 300) {
        if (event.timeStamp - zoom.lastTap < 320 && zoom.scale > 1.001) { resetZoom(); zoom.lastTap = 0; }
        else zoom.lastTap = event.timeStamp;
      }
    }
    if (!zoom.pointers.size) zoom.pan = null;
  }
  ["pointerup", "pointercancel"].forEach(type => scene?.addEventListener(type, endPointer));

  // 长按读数：弹出一句它的含义（取现有标签、单位与说明），松手消失
  const tip = doc.createElement("div");
  tip.className = "um-tip";
  tip.setAttribute("role", "tooltip");
  let tipDetachTimer = 0;
  let tipTimer = 0;
  let tipStart = null;
  function readoutMeaning(node) {
    const metric = node.closest(".metric-panel > div");
    if (metric) {
      const label = metric.querySelector("span")?.textContent.trim();
      const unit = metric.querySelector("small")?.textContent.trim();
      return [label, unit && `单位 ${unit}`].filter(Boolean).join("，");
    }
    const row = node.closest(".parameter");
    if (!row) return "";
    const label = row.querySelector(".parameter-label strong")?.textContent.trim();
    const desc = row.querySelector(".parameter-label small")?.textContent.trim();
    const unit = row.querySelector(".number-control small")?.textContent.trim();
    return [label && desc ? `${label}：${desc}` : label, unit && `单位 ${unit}`].filter(Boolean).join("，");
  }
  const hideTip = () => {
    clearTimeout(tipTimer);
    tipStart = null;
    if (!tip.parentNode) return;
    tip.classList.remove("is-on");
    clearTimeout(tipDetachTimer);
    tipDetachTimer = later(() => detach(tip), 160);
  };
  doc.addEventListener("pointerdown", event => {
    if (event.pointerType !== "touch" || compat()) return;
    const node = event.target.closest?.(".metric-panel > div, .experiment-card .number-control strong, .experiment-card .parameter-label");
    if (!node) return;
    clearTimeout(tipTimer);
    tipStart = { x: event.clientX, y: event.clientY };
    tipTimer = setTimeout(() => {
      const text = readoutMeaning(node);
      if (!text) return;
      tip.textContent = text;
      clearTimeout(tipDetachTimer);
      attach(tip, body);
      const rect = node.getBoundingClientRect();
      tip.style.setProperty("--um-tx", `${clamp(rect.left + rect.width / 2, 150, innerWidth - 150).toFixed(0)}px`);
      tip.style.setProperty("--um-ty", `${Math.max(64, rect.top).toFixed(0)}px`);
      tip.classList.add("is-on");
      tipShownAt = performance.now();
      clearTimeout(editClickTimer);
    }, 450);
  }, true);
  doc.addEventListener("pointermove", event => {
    if (tipStart && Math.hypot(event.clientX - tipStart.x, event.clientY - tipStart.y) > 10) hideTip();
  }, { passive: true, capture: true });
  ["pointerup", "pointercancel"].forEach(type => doc.addEventListener(type, hideTip, true));
  doc.addEventListener("contextmenu", event => {
    if (event.target.closest?.(".metric-panel, .experiment-card .number-control, .experiment-card .parameter-label, .um-dock, .um-bubble, .um-tip")) event.preventDefault();
  });

  /* ==================== C4 命令面板 ==================== */
  const palette = doc.createElement("dialog");
  palette.className = "um-palette";
  palette.setAttribute("aria-label", "命令面板");
  palette.innerHTML = `
    <input class="um-palette-input" type="text" role="combobox" aria-expanded="true" aria-controls="umPaletteList" aria-autocomplete="list" aria-label="搜索实验与操作" autocomplete="off" spellcheck="false">
    <ul class="um-palette-list" id="umPaletteList" role="listbox" aria-label="结果"></ul>`;
  palette.addEventListener("close", () => detach(palette));
  const paletteInput = $(".um-palette-input", palette);
  const paletteList = $(".um-palette-list", palette);
  const PALETTE_LIMIT = 60;
  let paletteItems = [];
  let paletteIndex = 0;
  const LEVEL_TEXT = { junior: "初中", senior: "高中", both: "初中 高中" };
  const visibleButton = selector => $$(selector).find(shown) || $(selector);
  function paletteSource() {
    const items = [];
    const options = typeof PRESET_OPTIONS !== "undefined" ? PRESET_OPTIONS : $$("#physicsPresetDropdown .preset-option");
    options.forEach(option => {
      if (typeof presetOptionAvailable === "function" && !presetOptionAvailable(option)) return;
      const name = option.querySelector(":scope > span")?.textContent.trim() || option.dataset.preset;
      const subject = option.dataset.subject || "";
      const level = LEVEL_TEXT[option.dataset.level] || "";
      const block = option.dataset.block || "";
      items.push({ kind: subject, name, meta: [subject, level.replace(" ", "·"), block].filter(Boolean).join(" · "), search: `${name} ${subject} ${level} ${block}`, run: () => runPreset(option) });
    });
    $$("#favoriteList .favorite-item").forEach(item => {
      const name = item.querySelector("strong")?.textContent.trim() || item.textContent.trim().slice(0, 40);
      items.push({ kind: "favorite", name, meta: `收藏 · ${item.dataset.subject || ""}`, search: `${name} 收藏 ${item.dataset.subject || ""}`, run: () => item.click() });
    });
    const action = (name, run, extra = "") => items.push({ kind: "action", name, meta: "操作", search: `${name} ${extra}`, run });
    ["物理", "化学", "数学", "生物"].forEach(subject => action(`切换到${subject}`, () => $(`.subject-tab[data-subject="${subject}"]`)?.click(), "学科"));
    [["junior", "初中"], ["senior", "高中"]].forEach(([level, text]) => action(`学段：${text}`, () => visibleButton(`.grade-seg [data-grade="${level}"]`)?.click(), "学段"));
    action("AI 导师全屏问答", () => $("#aiTutorEntryButton")?.click(), "导师 问答");
    action("更新公告", () => $("#announcementsButton")?.click(), "公告");
    action("实验全屏", () => [$("#fullscreenButton"), $("#sceneFullscreenButton")].find(shown)?.click(), "全屏 F");
    action("重置实验", () => $("#resetButton")?.click(), "重置 R");
    action("切换倍速", () => $("#playbackButton")?.click(), "倍速 速度");
    action("快捷键一览", () => toggleKeys(true), "快捷键 帮助 ?");
    return items;
  }
  function runPreset(option) {
    // 与下拉菜单的操作顺序一致：先切到对应学科（学科页签的点击处理是同步的），再载入这一项。
    // 菜单只挂当前学科的选项（renderPresetMenu 用 replaceChildren），跨学科时目标选项不在菜单里，点击冒泡不到委托监听，
    // 所以直接调用菜单点击用的同一个入口 applyPhysicsPresetChoice。
    if (option.dataset.subject && appReady() && state.subject !== option.dataset.subject) $(`.subject-tab[data-subject="${option.dataset.subject}"]`)?.click();
    if (typeof applyPhysicsPresetChoice === "function") applyPhysicsPresetChoice(option); else option.click();
    $("#generateButton")?.focus();
  }
  function renderPalette() {
    const terms = paletteInput.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const source = paletteSource();
    paletteItems = (terms.length ? source.filter(item => terms.every(term => item.search.toLowerCase().includes(term))) : source).slice(0, PALETTE_LIMIT);
    paletteIndex = clamp(paletteIndex, 0, Math.max(0, paletteItems.length - 1));
    paletteList.replaceChildren(...paletteItems.map((item, index) => {
      const li = doc.createElement("li");
      li.className = "um-pal-item";
      li.id = `umPaletteOpt${index}`;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(index === paletteIndex));
      const dot = doc.createElement("i");
      dot.className = "um-pal-dot";
      dot.dataset.kind = item.kind;
      dot.setAttribute("aria-hidden", "true");
      const name = doc.createElement("span");
      name.className = "um-pal-name";
      name.textContent = item.name;
      const meta = doc.createElement("small");
      meta.className = "um-pal-meta";
      meta.textContent = item.meta;
      li.append(dot, name, meta);
      return li;
    }));
    if (paletteItems.length) paletteInput.setAttribute("aria-activedescendant", `umPaletteOpt${paletteIndex}`);
    else paletteInput.removeAttribute("aria-activedescendant");
  }
  function moveSelection(delta) {
    if (!paletteItems.length) return;
    paletteIndex = (paletteIndex + delta + paletteItems.length) % paletteItems.length;
    $$("li", paletteList).forEach((li, index) => li.setAttribute("aria-selected", String(index === paletteIndex)));
    paletteInput.setAttribute("aria-activedescendant", `umPaletteOpt${paletteIndex}`);
    $(`#umPaletteOpt${paletteIndex}`)?.scrollIntoView({ block: "nearest" });
  }
  function runSelection(index = paletteIndex) {
    const item = paletteItems[index];
    if (!item) return;
    palette.close();
    item.run();
  }
  function openPalette() {
    if (palette.open || compat()) return;
    toggleKeys(false);
    paletteInput.value = "";
    paletteIndex = 0;
    renderPalette();
    attach(palette, body);
    try { palette.showModal(); } catch { palette.show(); }
    paletteInput.focus();
  }
  paletteInput.addEventListener("input", () => { paletteIndex = 0; renderPalette(); });
  paletteInput.addEventListener("keydown", event => {
    if (event.key === "ArrowDown") { event.preventDefault(); moveSelection(1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); moveSelection(-1); }
    else if (event.key === "Enter" && !event.isComposing) { event.preventDefault(); runSelection(); }
  });
  paletteList.addEventListener("click", event => {
    const li = event.target.closest("li[role=option]");
    if (li) runSelection([...paletteList.children].indexOf(li));
  });
  palette.addEventListener("click", event => { if (event.target === palette) palette.close(); });
  doc.addEventListener("keydown", event => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== "k" || compat()) return;
    if (palette.open) { event.preventDefault(); palette.close(); return; }
    if (blockingLayerOpen()) return; // 其他弹层打开时不在其上方弹出命令面板
    event.preventDefault();
    openPalette();
  });

  /* ==================== 状态同步 ==================== */
  let wasFullscreen = body.classList.contains("fullscreen-lock");
  function onStateChange() {
    syncSymbolList();
    syncGestureClass();
    paintAll();
    watchExperimentChange();
    updateDock();
    placeGlider();
    marksKey = "";
    layoutMarks();
    syncChain();
    setTitles();
    const fullscreen = body.classList.contains("fullscreen-lock");
    if (fullscreen !== wasFullscreen || !gestureReady()) resetZoom(false);
    wasFullscreen = fullscreen;
  }
  if (playButton) new MutationObserver(() => { syncPlaying(); setTitles(); }).observe(playButton, { attributes: true, attributeFilter: ["class"] });
  if (stepsHost) {
    new MutationObserver(syncChain).observe(stepsHost, { childList: true });
    if ("ResizeObserver" in window) new ResizeObserver(() => { if (activeStep) measureChain(); }).observe(stepsHost);
  }
  if (timeline && "ResizeObserver" in window) new ResizeObserver(() => { marksKey = ""; layoutMarks(); }).observe(timeline);
  let bodyClass = body.className;
  new MutationObserver(() => {
    // 只在与本文件无关的类变化时同步（自己加的 um-* 类不触发）
    const next = body.className.split(/\s+/).filter(name => !name.startsWith("um-")).join(" ");
    if (next === bodyClass) return;
    bodyClass = next;
    onStateChange();
  }).observe(body, { attributes: true, attributeFilter: ["class"] });
  bodyClass = body.className.split(/\s+/).filter(name => !name.startsWith("um-")).join(" ");
  const title = $("#experimentTitle");
  if (title) new MutationObserver(() => { resetZoom(false); onStateChange(); }).observe(title, { childList: true, characterData: true, subtree: true });
  const overlay = $("#generationOverlay");
  if (overlay) new MutationObserver(() => {
    const showing = overlay.classList.contains("show");
    setStill("generate", showing);
    if (!showing) onStateChange();
  }).observe(overlay, { attributes: true, attributeFilter: ["class"] });
  coarseQuery.addEventListener?.("change", syncGestureClass);
  dockQuery.addEventListener?.("change", () => { setDocked(false); updateDock(); });
  syncPlaying();
  onStateChange();
})();
