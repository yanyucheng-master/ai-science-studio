const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const SUBJECTS = {
  "物理": {
    question: "一辆汽车以 20m/s 的速度行驶，紧急刹车后加速度大小为 5m/s²，求刹车距离。",
    title: "刹车距离实验 · 速度如何归零",
    description: "从自然语言题目生成刹车实验：速度逐步归零，停止点对应 40m。",
    engine: "运动过程可视化",
    ar: "移动端扩展可继续展示汽车刹车实验。",
    metrics: [["速度 v", "m/s"], ["位移 s", "m"], ["时间 t", "s"]],
    params: [
      { label: "初速度 v₀", desc: "调整车辆起始速度", unit: "m/s", min: 10, max: 30, step: 1, value: 20 },
      { label: "加速度 a", desc: "调整刹车减速度", unit: "m/s²", min: 2, max: 10, step: 1, value: 5, prefix: "−" }
    ],
    steps: [
      ["题干条件", "v₀ = 20m/s，a = −5m/s²，v = 0", "先识别初速度、刹车加速度和末速度。"],
      ["选择公式", "v² − v₀² = 2as", "题目没有给出时间，所以选择不含 t 的速度位移公式。"],
      ["代入求解", "0² − 20² = 2×(−5)×s", "代入数据后得到刹车距离 s = 40m。"],
      ["现象验证", "速度归零，停止点 40m", "结果为正且单位正确，并与实验停止点一致。"]
    ],
    mentor: "为什么这里选 <strong>v² − v₀² = 2as</strong>？因为题目没有给时间，却给了速度、加速度和位移关系。",
    hint: "小提示：题目给出了 <strong>初速度、末速度和加速度</strong>，但没有给时间。哪条公式不含 t？",
    challenge: "很好！现在初速度变成了 <strong>30m/s</strong>。预测一下：刹车距离会变成原来的多少倍？"
  },
  "化学": {
    question: "改变反应物浓度，观察化学反应速率的变化。",
    title: "浓度对反应速率的影响",
    description: "调节反应物浓度与温度，观察气泡生成和反应速率变化。",
    engine: "分子动力学实时演算",
    ar: "使用移动设备扫码，即可在 AR 中观察烧杯内的粒子碰撞与反应过程。",
    metrics: [["当前浓度", "mol/L"], ["生成气体", "mL"], ["实验时间", "s"]],
    params: [
      { label: "反应物浓度 c", desc: "调整溶液初始浓度", unit: "mol/L", min: 0.5, max: 2, step: 0.1, value: 1 },
      { label: "反应温度 T", desc: "调整反应体系温度", unit: "°C", min: 20, max: 80, step: 5, value: 25 }
    ],
    steps: [
      ["识别实验变量", "自变量：反应物浓度", "保持其他条件相同，只改变反应物浓度。"],
      ["建立碰撞模型", "有效碰撞频率增加", "浓度升高后，单位体积内粒子数增加。"],
      ["观察反应现象", "气泡生成速度加快", "比较相同时间内生成气体的体积。"],
      ["得出实验结论", "浓度越高，反应越快", "在其他条件相同时，浓度升高会加快反应速率。"]
    ],
    mentor: "浓度升高后，为什么烧杯中的<strong>气泡会产生得更快</strong>？",
    hint: "小提示：想一想单位体积内的<strong>反应粒子数量和碰撞次数</strong>发生了什么变化。",
    challenge: "挑战开始！温度已升高到 <strong>55°C</strong>。观察它和提高浓度产生的效果是否相同。"
  },
  "数学": {
    question: "点 P 在抛物线 y = x² 上运动，观察切线斜率的变化。",
    title: "抛物线上的动点与切线",
    description: "让点 P 沿抛物线运动，联动观察坐标与切线斜率。",
    engine: "解析几何实时绘制",
    ar: "使用移动设备扫码，即可在真实空间中观察抛物线、动点和切线。",
    metrics: [["点 P 横坐标", "x"], ["切线斜率", "k"], ["实验时间", "s"]],
    params: [
      { label: "起始横坐标 x₀", desc: "调整动点初始位置", unit: "", min: -3, max: 1, step: 0.1, value: -2 },
      { label: "运动速度", desc: "调整点 P 的移动速度", unit: "×", min: 0.5, max: 2, step: 0.5, value: 1 }
    ],
    steps: [
      ["建立函数模型", "y = x²", "识别抛物线函数及动点 P 的坐标关系。"],
      ["观察局部变化", "割线逐渐逼近切线", "让相邻两点距离不断减小，观察斜率变化。"],
      ["得到斜率规律", "k = 2x", "切线斜率随横坐标 x 线性变化。"],
      ["连接导数概念", "y′ = 2x", "将动点实验结果概括为导函数。"]
    ],
    mentor: "点 P 从左向右运动时，切线为什么会从<strong>向下倾斜</strong>逐渐变为向上倾斜？",
    hint: "小提示：观察点 P 位于 y 轴左侧、原点和右侧时，<strong>切线斜率的正负</strong>。",
    challenge: "挑战开始！运动速度调整为 <strong>2×</strong>，试着在斜率为 0 时暂停。"
  },
  "生物": {
    question: "观察细胞膜的流动镶嵌结构与物质运输过程。",
    title: "细胞膜流动镶嵌模型",
    description: "观察膜蛋白与磷脂分子的运动，以及物质跨膜运输过程。",
    engine: "亚显微结构动态模拟",
    ar: "使用移动设备扫码，即可放大观察细胞膜结构和物质运输过程。",
    metrics: [["膜流动性", "%"], ["运输分子", "个"], ["实验时间", "s"]],
    params: [
      { label: "环境温度", desc: "调整细胞所处温度", unit: "°C", min: 15, max: 45, step: 1, value: 25 },
      { label: "膜外浓度", desc: "调整待运输分子浓度", unit: "mmol/L", min: 1, max: 10, step: 1, value: 5 }
    ],
    steps: [
      ["识别膜结构", "磷脂双分子层 + 膜蛋白", "观察膜的基本组成与镶嵌结构。"],
      ["追踪分子运动", "磷脂与蛋白持续运动", "细胞膜不是静止结构，而具有流动性。"],
      ["观察跨膜运输", "分子沿浓度梯度移动", "记录通过膜蛋白进入细胞的分子数量。"],
      ["概括结构功能", "结构决定选择透过性", "流动镶嵌结构支持物质交换与信息传递。"]
    ],
    mentor: "细胞膜为什么既能保持完整，又允许膜蛋白和磷脂分子<strong>持续运动</strong>？",
    hint: "小提示：细胞膜不是坚硬外壳，关注<strong>磷脂分子之间的作用力</strong>。",
    challenge: "挑战开始！环境温度调整为 <strong>37°C</strong>，观察膜流动性和运输效率的变化。"
  }
};

const state = {
  subject: "物理",
  playing: false,
  time: 0,
  lastFrame: 0,
  p1: 20,
  p2: 5,
  playbackRate: 1,
  reasonStep: 1,
  generated: 2,
  favorite: false,
  toastTimer: null,
  demoTimers: [],
  generationTimers: []
};

const elements = {
  scene: $("#scene"),
  car: $("#car"),
  brakeTrace: $("#brakeTrace"),
  distanceFlag: $("#distanceFlag"),
  metricValues: [$("#speedValue"), $("#distanceValue"), $("#timeValue")],
  metricLabels: [$("#metricLabel1"), $("#metricLabel2"), $("#metricLabel3")],
  metricUnits: [$("#metricUnit1"), $("#metricUnit2"), $("#metricUnit3")],
  timeline: $("#timeline"),
  playButton: $("#playButton"),
  currentTime: $("#currentTime"),
  totalTime: $("#totalTime"),
  ranges: [$("#speedRange"), $("#accelRange")],
  paramValues: [$("#speedParam"), $("#accelParam")],
  paramLabels: [$("#paramLabel1"), $("#paramLabel2")],
  paramDescriptions: [$("#paramDesc1"), $("#paramDesc2")],
  paramUnits: [$("#paramUnit1"), $("#paramUnit2")],
  stopDistanceLabel: $("#stopDistanceLabel"),
  sceneTip: $("#sceneTip"),
  mentorMessage: $("#mentorMessage"),
  toast: $("#toast"),
  generationOverlay: $("#generationOverlay"),
  generationStatus: $("#generationStatus"),
  generationProgress: $("#generationProgress")
};

const GENERATION_STAGES = [
  { text: "识别题干条件：v₀ = 20m/s，a = −5m/s²", progress: 28 },
  { text: "匹配刹车实验场景：速度递减至 0", progress: 63 },
  { text: "生成可视化过程：停止点锁定 40m", progress: 100 }
];

function config() {
  return SUBJECTS[state.subject];
}

function duration() {
  if (state.subject === "物理") return state.p1 / state.p2;
  if (state.subject === "数学") return 8 / state.p2;
  return 8;
}

function valuesAt(time) {
  const t = Math.min(time, duration());
  const progress = Math.min(1, t / duration());

  if (state.subject === "物理") {
    const speed = Math.max(0, state.p1 - state.p2 * t);
    const distance = state.p1 * t - 0.5 * state.p2 * t * t;
    return { progress: distance / ((state.p1 * state.p1) / (2 * state.p2)), timelineProgress: t / duration(), metrics: [speed, distance, t] };
  }

  if (state.subject === "化学") {
    const rate = state.p1 * (1 + (state.p2 - 20) / 80);
    const gas = 100 * (1 - Math.exp(-rate * t / 3));
    return { progress, metrics: [state.p1, gas, t], rate };
  }

  if (state.subject === "数学") {
    const x = state.p1 + (3 - state.p1) * progress;
    return { progress, metrics: [x, 2 * x, t], x };
  }

  const fluidity = Math.min(98, 43 + state.p1 * 1.05);
  const transported = Math.round(progress * state.p2 * 8);
  return { progress, metrics: [fluidity, transported, t] };
}

function formatNumber(value) {
  return Number(value).toFixed(1);
}

function formatTime(seconds) {
  const rounded = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(rounded / 60)).padStart(2, "0")}:${String(rounded % 60).padStart(2, "0")}`;
}

function updateSubjectVisuals(values) {
  elements.scene.style.setProperty("--experiment-progress", values.progress);
  elements.scene.style.setProperty("--chem-rise", `${-values.progress * 105}px`);
  elements.scene.style.setProperty("--chem-rise-short", `${-values.progress * 78}px`);
  elements.scene.style.setProperty("--chem-rise-mid", `${-values.progress * 92}px`);
  elements.scene.style.setProperty("--chem-rise-long", `${-values.progress * 118}px`);
  elements.scene.style.setProperty("--bio-travel", `${values.progress * 260}px`);
  elements.scene.style.setProperty("--bio-travel-short", `${values.progress * 210}px`);
  elements.scene.style.setProperty("--bio-travel-mid", `${values.progress * 235}px`);

  if (state.subject === "物理") {
    const trackProgress = 8 + values.progress * 78;
    elements.car.style.left = `${trackProgress}%`;
    elements.brakeTrace.style.width = `${Math.max(0, trackProgress - 8)}%`;
    elements.car.classList.toggle("moving", state.playing && values.metrics[0] > 0);
  }

  if (state.subject === "化学") {
    $("#chemRate").textContent = `${values.rate.toFixed(2)}×`;
  }

  if (state.subject === "数学") {
    const x = values.x;
    const y = x * x;
    const cx = 300 + x * 80;
    const cy = 225 - y * 22;
    const x1 = x - 1.4;
    const x2 = x + 1.4;
    $("#mathPoint").setAttribute("cx", cx);
    $("#mathPoint").setAttribute("cy", cy);
    $("#tangentLine").setAttribute("x1", 300 + x1 * 80);
    $("#tangentLine").setAttribute("y1", 225 - (y + 2 * x * (x1 - x)) * 22);
    $("#tangentLine").setAttribute("x2", 300 + x2 * 80);
    $("#tangentLine").setAttribute("y2", 225 - (y + 2 * x * (x2 - x)) * 22);
    $("#mathCoordinate").textContent = `(${x.toFixed(1)}, ${y.toFixed(1)})`;
  }

  if (state.subject === "生物") {
    $("#bioFluidity").textContent = `${values.metrics[0].toFixed(0)}%`;
  }
}

function updateScene() {
  const values = valuesAt(state.time);
  values.metrics.forEach((value, index) => {
    elements.metricValues[index].textContent = formatNumber(value);
  });
  elements.timeline.value = (values.timelineProgress ?? values.progress) * 100;
  elements.currentTime.textContent = formatTime(state.time);
  updateSubjectVisuals(values);

  if (values.progress >= 1) {
    pauseExperiment();
    const conclusions = {
      "物理": `车辆在 ${duration().toFixed(1)} 秒后停止，刹车距离为 ${values.metrics[1].toFixed(1)} 米。`,
      "化学": `反应结束，本组条件下共生成约 ${values.metrics[1].toFixed(1)} mL 气体。`,
      "数学": `点 P 运动至右侧，切线斜率随横坐标增大而增大。`,
      "生物": `本组条件下共有 ${values.metrics[1].toFixed(0)} 个分子完成跨膜运输。`
    };
    elements.sceneTip.innerHTML = `<span>实验结论</span>${conclusions[state.subject]}`;
  }
}

function renderReasoning() {
  const steps = config().steps;
  $(".reasoning-steps").innerHTML = steps.map((step, index) => {
    const number = index + 1;
    const status = number < state.reasonStep ? "done" : number === state.reasonStep ? "active" : "";
    const statusText = number < state.reasonStep ? "已完成" : number === state.reasonStep ? "当前步骤" : "待探索";
    const icon = number < state.reasonStep ? '<path d="m5 12 4 4L19 6"/>' : '<path d="m9 18 6-6-6-6"/>';
    return `<button class="reason-step ${status}" data-step="${number}">
      <span class="step-index">${number}</span>
      <div><small>${statusText}</small><strong>${step[0]}</strong><p class="${index === 1 ? "formula" : ""}">${step[1]}</p></div>
      <i><svg viewBox="0 0 24 24">${icon}</svg></i>
    </button>`;
  }).join("");
  $("#reasonProgress").textContent = state.reasonStep;
}

function setRange(range, param) {
  range.min = param.min;
  range.max = param.max;
  range.step = param.step;
  range.value = param.value;
}

function formatParam(param, value) {
  const decimals = String(param.step).includes(".") ? 1 : 0;
  return `${param.prefix || ""}${Number(value).toFixed(decimals)}`;
}

function updateParameters(reset = true) {
  state.p1 = Number(elements.ranges[0].value);
  state.p2 = Number(elements.ranges[1].value);
  config().params.forEach((param, index) => {
    elements.paramValues[index].textContent = formatParam(param, index === 0 ? state.p1 : state.p2);
  });
  elements.totalTime.textContent = formatTime(duration());

  if (state.subject === "物理") {
    const stop = (state.p1 * state.p1) / (2 * state.p2);
    elements.stopDistanceLabel.textContent = `${stop.toFixed(0)} m`;
    elements.distanceFlag.style.left = `${Math.min(90, 46 + stop)}%`;
  }
  if (reset) resetExperiment();
}

function applySubject(subject, updateQuestion = true) {
  clearDemoTimers();
  pauseExperiment();
  state.subject = subject;
  state.reasonStep = 1;
  state.favorite = false;
  const current = config();

  $$(".subject-tab").forEach(tab => {
    const active = tab.dataset.subject === subject;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  if (updateQuestion) $("#questionInput").value = current.question;
  $("#experimentTitle").textContent = current.title;
  $("#problemText").textContent = current.description;
  $("#engineBadge").textContent = current.engine;
  $("#arDescription").textContent = current.ar;
  elements.scene.className = `scene subject-${subject === "物理" ? "physics" : subject === "化学" ? "chemistry" : subject === "数学" ? "math" : "biology"}`;
  $("#viewButton").classList.remove("selected");
  $("#annotationButton").classList.remove("selected");

  current.metrics.forEach((metric, index) => {
    elements.metricLabels[index].textContent = metric[0];
    elements.metricUnits[index].textContent = metric[1];
  });
  current.params.forEach((param, index) => {
    elements.paramLabels[index].textContent = param.label;
    elements.paramDescriptions[index].textContent = param.desc;
    elements.paramUnits[index].textContent = param.unit;
    setRange(elements.ranges[index], param);
  });

  elements.mentorMessage.innerHTML = current.mentor;
  $("#favoriteButton").classList.remove("selected");
  renderReasoning();
  updateParameters();
}

function playExperiment() {
  if (state.time >= duration()) state.time = 0;
  state.playing = true;
  state.lastFrame = performance.now();
  elements.playButton.classList.add("playing");
  requestAnimationFrame(animationFrame);
}

function pauseExperiment() {
  state.playing = false;
  elements.playButton.classList.remove("playing");
  elements.car.classList.remove("moving");
}

function resetExperiment() {
  pauseExperiment();
  state.time = 0;
  const tips = {
    "物理": `刹车开始后，速度每秒减少 ${state.p2}m/s。`,
    "化学": "观察相同时间内两组烧瓶产生气泡的数量差异。",
    "数学": "观察点 P 横坐标变化时，切线方向如何改变。",
    "生物": "追踪发光分子穿过细胞膜的运动路径。"
  };
  elements.sceneTip.innerHTML = `<span>观察提示</span>${tips[state.subject]}`;
  updateScene();
}

function animationFrame(timestamp) {
  if (!state.playing) return;
  const delta = Math.min(0.06, (timestamp - state.lastFrame) / 1000);
  state.lastFrame = timestamp;
  state.time += delta * state.playbackRate;
  updateScene();
  if (state.playing) requestAnimationFrame(animationFrame);
}

function showToast(message) {
  clearTimeout(state.toastTimer);
  $("p", elements.toast).textContent = message;
  elements.toast.classList.add("show");
  state.toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2200);
}

function clearDemoTimers() {
  state.demoTimers.forEach(timer => clearTimeout(timer));
  state.demoTimers = [];
}

function clearGenerationTimers() {
  state.generationTimers.forEach(timer => clearTimeout(timer));
  state.generationTimers = [];
}

function setGenerationStage(index) {
  const stage = GENERATION_STAGES[index];
  if (!stage) return;
  elements.generationStatus.textContent = stage.text;
  elements.generationProgress.style.width = `${stage.progress}%`;
  $$(".generation-steps span").forEach((item, itemIndex) => {
    item.classList.toggle("active", itemIndex <= index);
  });
}

function showGenerationOverlay() {
  clearGenerationTimers();
  elements.generationOverlay.classList.add("show");
  elements.generationOverlay.setAttribute("aria-hidden", "false");
  setGenerationStage(0);

  return new Promise(resolve => {
    state.generationTimers = [
      setTimeout(() => setGenerationStage(1), 620),
      setTimeout(() => setGenerationStage(2), 1280),
      setTimeout(resolve, 1850)
    ];
  });
}

function hideGenerationOverlay() {
  clearGenerationTimers();
  elements.generationOverlay.classList.remove("show");
  elements.generationOverlay.setAttribute("aria-hidden", "true");
}

function setReasoningStep(step, message) {
  state.reasonStep = step;
  renderReasoning();
  if (message) elements.sceneTip.innerHTML = message;
}

function playDemoSequence() {
  clearDemoTimers();
  resetExperiment();
  setReasoningStep(1, "<span>观察目标</span>先看速度如何从 20m/s 逐步归零。");
  state.demoTimers = [
    setTimeout(() => setReasoningStep(2, "<span>公式选择</span>没有给时间 t，直接用速度—位移关系式。"), 520),
    setTimeout(() => playExperiment(), 820),
    setTimeout(() => setReasoningStep(3, "<span>代入求解</span>0² − 20² = 2 × (−5) × s，所以 s = 40m。"), 1900),
    setTimeout(() => setReasoningStep(4, "<span>现象验证</span>小车速度归零时，停止点正好对应 40m。"), 3400)
  ];
}

function detectSubject(question) {
  if (/反应|浓度|溶液|化学/.test(question)) return "化学";
  if (/函数|抛物线|斜率|切线|数学/.test(question)) return "数学";
  if (/细胞|生物|膜|DNA/.test(question)) return "生物";
  if (/汽车|速度|加速度|运动|受力|落下|物理/.test(question)) return "物理";
  return state.subject;
}

elements.playButton.addEventListener("click", () => {
  clearDemoTimers();
  state.playing ? pauseExperiment() : playExperiment();
});
$("#resetButton").addEventListener("click", () => {
  clearDemoTimers();
  resetExperiment();
});

elements.timeline.addEventListener("input", event => {
  clearDemoTimers();
  pauseExperiment();
  state.time = (Number(event.target.value) / 100) * duration();
  updateScene();
});

elements.ranges.forEach(input => input.addEventListener("input", () => {
  clearDemoTimers();
  updateParameters();
}));

$$(".number-control button").forEach(button => {
  button.addEventListener("click", () => {
    const input = $(`#${button.dataset.target}`);
    const next = Number(input.value) + Number(button.dataset.delta) * Number(input.step);
    input.value = Math.max(Number(input.min), Math.min(Number(input.max), next));
    clearDemoTimers();
    updateParameters();
  });
});

$$("[data-toast]").forEach(button => button.addEventListener("click", () => showToast(button.dataset.toast)));

$$(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    if (button.dataset.nav === "实验台") {
      showToast("当前已在实验台");
      return;
    }
    showToast(`${button.dataset.nav}将在下一版开放`);
  });
});

$$(".subject-tab").forEach(button => {
  button.addEventListener("click", () => {
    applySubject(button.dataset.subject);
    showToast(`已切换到${button.dataset.subject}实验`);
  });
});

$("#generateButton").addEventListener("click", async () => {
  const button = $("#generateButton");
  const demoMode = document.body.classList.contains("demo-mode");
  let question = $("#questionInput").value.trim();
  if (!question) {
    showToast("请先输入一道理科题目");
    return;
  }
  if (demoMode) {
    question = SUBJECTS["物理"].question;
    $("#questionInput").value = question;
  }
  clearDemoTimers();
  button.classList.add("loading");
  $("span", button).textContent = "生成中";
  await showGenerationOverlay();
  const detected = demoMode ? "物理" : detectSubject(question);
  applySubject(detected, false);
  $("#problemText").textContent = question;
  state.generated = Math.min(3, state.generated + 1);
  $("#freeCountCurrent").textContent = state.generated;
  button.classList.remove("loading");
  $("span", button).textContent = "生成实验";
  hideGenerationOverlay();
  showToast(`${detected}实验已生成，正在播放可视化过程`);
  playDemoSequence();
});

$(".reasoning-steps").addEventListener("click", event => {
  const step = event.target.closest(".reason-step");
  if (!step) return;
  state.reasonStep = Number(step.dataset.step);
  renderReasoning();
  elements.sceneTip.innerHTML = `<span>思维联动</span>${config().steps[state.reasonStep - 1][2]}`;
  if (state.reasonStep === 4) {
    state.time = duration();
    updateScene();
  }
});

$("#hintButton").addEventListener("click", () => {
  elements.mentorMessage.innerHTML = config().hint;
  showToast("大狮给出了一条启发式提示");
});

$("#challengeButton").addEventListener("click", () => {
  const challengeValues = { "物理": 30, "化学": 55, "数学": 2, "生物": 37 };
  const rangeIndex = state.subject === "物理" || state.subject === "生物" ? 0 : 1;
  elements.ranges[rangeIndex].value = challengeValues[state.subject];
  updateParameters();
  elements.mentorMessage.innerHTML = config().challenge;
  showToast("变式挑战已加载");
});

$$(".history-item").forEach(item => {
  item.addEventListener("click", () => {
    applySubject(item.dataset.subject);
    $("#questionInput").value = item.dataset.question;
    window.scrollTo({ top: 0, behavior: "smooth" });
    showToast(`${item.dataset.subject}历史题目已载入`);
  });
});

$("#playbackButton").addEventListener("click", event => {
  const rates = [1, 1.5, 2];
  state.playbackRate = rates[(rates.indexOf(state.playbackRate) + 1) % rates.length];
  event.currentTarget.textContent = `${state.playbackRate}×`;
  showToast(`播放速度已调整为 ${state.playbackRate}×`);
});

$("#viewButton").addEventListener("click", event => {
  const enabled = elements.scene.classList.toggle("alternate-view");
  event.currentTarget.classList.toggle("selected", enabled);
  showToast(enabled ? "已切换为聚焦视角" : "已恢复全景视角");
});

$("#annotationButton").addEventListener("click", event => {
  const hidden = elements.scene.classList.toggle("hide-annotations");
  event.currentTarget.classList.toggle("selected", !hidden);
  showToast(hidden ? "关键数据标注已隐藏" : "关键数据标注已开启");
});

$("#fullscreenButton").addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) await elements.scene.requestFullscreen();
    else await document.exitFullscreen();
  } catch {
    showToast("当前浏览器暂不支持全屏实验");
  }
});

$("#favoriteButton").addEventListener("click", event => {
  state.favorite = !state.favorite;
  event.currentTarget.classList.toggle("selected", state.favorite);
  showToast(state.favorite ? "实验已收藏" : "已取消收藏");
});

$("#shareButton").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(`${location.href}#${encodeURIComponent(state.subject)}`);
    showToast("实验分享链接已复制");
  } catch {
    showToast("复制失败，请检查浏览器权限");
  }
});

const arModal = $("#arModal");
$("#arButton").addEventListener("click", () => {
  arModal.classList.add("show");
  arModal.setAttribute("aria-hidden", "false");
});

function closeModal() {
  arModal.classList.remove("show");
  arModal.setAttribute("aria-hidden", "true");
}

$("#closeModal").addEventListener("click", closeModal);
arModal.addEventListener("click", event => {
  if (event.target === arModal) closeModal();
});

$("#copyLink").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(`${location.href}#${encodeURIComponent(state.subject)}`);
    showToast("AR 体验链接已复制");
  } catch {
    showToast("复制失败，请检查浏览器权限");
  }
  closeModal();
});

document.addEventListener("keydown", event => {
  if (event.code === "Space" && event.target.tagName !== "INPUT") {
    event.preventDefault();
    state.playing ? pauseExperiment() : playExperiment();
  }
  if (event.code === "Escape") closeModal();
});

applySubject("物理");
