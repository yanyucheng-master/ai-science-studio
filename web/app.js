const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const params = new URLSearchParams(window.location.search);
const isDemoMode = params.get("demo") === "1" || params.get("mode") === "demo";
if (isDemoMode) {
  document.body.classList.add("demo-mode");
}

const SUBJECTS = {
  "物理": {
    question: "一辆汽车以 20m/s 的速度行驶，紧急刹车后加速度大小为 5m/s²，求刹车距离。",
    title: "刹车距离实验 · 速度如何归零",
    description: "从自然语言题目生成刹车实验：速度逐步归零，停止点对应 40m。",
    engine: "运动过程可视化",
    ar: "移动端扩展可继续展示汽车刹车实验。",
    metrics: [["速度 v", "m/s"], ["位移 s", "m"], ["时间 t", "s"]],
    params: [
      { label: "初速度 v₀", desc: "调整车辆起始速度", unit: "m/s", min: 5, max: 80, step: 1, value: 20 },
      { label: "加速度 a", desc: "调整刹车减速度", unit: "m/s²", min: 1, max: 20, step: 1, value: 5, prefix: "−" }
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
    question: "将 5.6g 铁粉加入含有 0.20mol 硫酸铜的溶液中，充分反应。请计算最多生成多少 mol 铜？生成铜的质量是多少？并判断哪种反应物过量。",
    title: "铁与硫酸铜反应：定量观察铜的生成",
    description: "Fe(s) + CuSO₄(aq) → FeSO₄(aq) + Cu(s)，铁表面析出红色铜，溶液由蓝色逐渐变为浅绿色。",
    engine: "典型题型模板演示",
    ar: "移动端扩展可继续展示铁与硫酸铜反应的沉积过程。",
    metrics: [["Fe 投入", "g"], ["生成 Cu", "mol"], ["Cu 质量", "g"]],
    params: [
      { label: "铁粉质量 m(Fe)", desc: "调整投入铁粉质量", unit: "g", min: 2.8, max: 16.8, step: 2.8, value: 5.6 },
      { label: "硫酸铜 n(CuSO₄)", desc: "调整硫酸铜物质的量", unit: "mol", min: 0.05, max: 0.3, step: 0.05, value: 0.2 }
    ],
    steps: [
      ["提取条件", "Fe = 5.6g，CuSO₄ = 0.20mol", "先识别铁的质量和硫酸铜的物质的量。"],
      ["换算物质的量", "n(Fe) = 5.6 ÷ 56 = 0.10mol", "把铁的质量换算成物质的量。"],
      ["判断限量反应物", "1:1 反应，Fe 为限量反应物", "比较 Fe 与 CuSO₄ 的物质的量，较少者限量，过量者剩余。"],
      ["计算生成物", "n(Cu)=0.10mol，m(Cu)=6.4g", "由 1:1 计量关系计算铜的物质的量和质量。"]
    ],
    mentor: "为什么不能直接用 <strong>0.20mol 硫酸铜</strong> 计算铜的质量？",
    hint: "先把铁的质量换算成物质的量，再根据方程式 1:1 的计量关系比较 Fe 和 CuSO₄，较少的一方决定生成铜的量。",
    challenge: "如果铁粉增加到 <strong>11.2g</strong>，而硫酸铜仍为 <strong>0.20mol</strong>，生成铜的质量会变吗？为什么？"
  },
  "数学": {
    question: "点 P 在抛物线 y = x² 上运动，当 x = 3 时，求该点处切线斜率，并观察 x 改变时斜率如何变化。",
    title: "抛物线上的动点与切线",
    description: "函数 y = x²，导数 y′ = 2x；当 x = 3 时，切线斜率 k = 6。",
    engine: "典型题型模板演示",
    ar: "移动端扩展可继续展示抛物线、动点和切线的空间观察。",
    metrics: [["点 P 横坐标", "x"], ["切线斜率", "k"], ["实验时间", "s"]],
    params: [
      { label: "指定横坐标 x", desc: "调整题目给定横坐标", unit: "", min: -5, max: 5, step: 1, value: 3 },
      { label: "运动速度", desc: "调整点 P 的移动速度", unit: "×", min: 0.5, max: 2, step: 0.5, value: 1 }
    ],
    steps: [
      ["提取函数", "y = x²，x = 3", "识别函数表达式和题目给定位置。"],
      ["求导", "y′ = 2x", "导函数在给定点的值表示该点处切线斜率。"],
      ["代入坐标", "k = 2 × 3 = 6", "把 x = 3 代入导函数得到斜率。"],
      ["观察变化", "k = 2x 随 x 线性变化", "通过动点观察切线斜率随横坐标改变而变化。"]
    ],
    mentor: "为什么抛物线 y = x² 在 x = 3 处的切线斜率等于 <strong>6</strong>？",
    hint: "先求导得到导函数 y′ = 2x，再把题目给出的 x = 3 代入；导函数值就是该点切线斜率。",
    challenge: "如果 <strong>x = 5</strong>，切线斜率是多少？"
  },
  "生物": {
    question: "请观察植物细胞的亚显微结构截面图，识别细胞壁、细胞膜、细胞核、液泡、叶绿体和线粒体等结构，并说明它们在细胞生命活动中的主要作用。",
    title: "植物细胞结构识别：3D 截面模型",
    description: "植物细胞结构识别｜3D 截面模型｜点击查看功能。",
    engine: "典型题型模板演示",
    ar: "移动端扩展可继续展示植物细胞截面、结构标注与 360° 观察。",
    metrics: [["可点结构", "个"], ["旋转视角", "°"], ["观察时间", "s"]],
    params: [
      { label: "观察角度", desc: "拖拽或滑动旋转 3D 截面", unit: "°", min: -180, max: 180, step: 15, value: -10 },
      { label: "结构数量", desc: "本题要求识别的核心结构", unit: "个", min: 1, max: 7, step: 1, value: 6 }
    ],
    steps: [
      ["观察截面", "先区分外层边界、内部细胞器和中央液泡", "从整体截面入手，先看边界，再看内部结构。"],
      ["识别结构", "点击细胞壁、细胞膜、细胞核、叶绿体、线粒体等结构", "通过交互标注把图像结构和名称对应起来。"],
      ["关联功能", "叶绿体进行光合作用，线粒体是有氧呼吸主要场所", "把结构名称进一步连接到生命活动中的作用。"],
      ["对比记忆", "典型植物细胞常见细胞壁、叶绿体和大液泡", "用与动物细胞的差异形成记忆抓手。"]
    ],
    mentor: "为什么典型植物细胞图中常重点标出<strong>细胞壁、叶绿体和大液泡</strong>？",
    hint: "可以从典型植物细胞的结构特点思考：细胞壁负责支持，叶绿体是光合作用场所，成熟植物细胞常有明显中央液泡。",
    challenge: "请点击模型中的 <strong>叶绿体</strong>，并说明它与光合作用有什么关系。",
    generationStages: [
      { label: "识别题型", text: "识别植物细胞结构识别题", progress: 28 },
      { label: "生成截面", text: "构建植物细胞 3D 截面模型", progress: 63 },
      { label: "绑定标注", text: "绑定可点击结构与功能解析", progress: 100 }
    ]
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
  hasGenerated: false,
  generatedQuestion: "",
  generatedSubjects: new Set(),
  subjectSnapshots: {},
  generated: 2,
  favorite: false,
  cellType: "plant",
  selectedOrganelle: "nucleus",
  cellRotateX: -4,
  cellRotateY: -10,
  cellAutoRotate: false,
  cellDrag: null,
  toastTimer: null,
  demoTimers: [],
  generationTimers: [],
  generationStages: null,
  autoDemoTimer: null,
  userGeneratedOnce: false,
  autoDemoStarted: false
};

const PHYSICS_BRAKE_LIMITS = {
  speedMin: 5,
  speedMax: 80,
  accelMin: 1,
  accelMax: 20
};

const CHEMISTRY_CONSTANTS = {
  feMolarMass: 56,
  cuMolarMass: 64,
  feMassMin: 2.8,
  feMassMax: 16.8,
  cuso4MolMin: 0.05,
  cuso4MolMax: 0.3
};

const CELL_ORGANELLES = [
  {
    id: "cellWall",
    name: "细胞壁",
    type: "植物细胞相对动物细胞的特征结构",
    function: "支持和保护细胞，维持细胞形态",
    memory: "典型植物细胞有细胞壁，动物细胞没有细胞壁"
  },
  {
    id: "cellMembrane",
    name: "细胞膜",
    type: "边界结构",
    function: "控制物质进出细胞，维持细胞内环境稳定",
    memory: "选择透过性是细胞膜的重要特征"
  },
  {
    id: "nucleus",
    name: "细胞核",
    type: "遗传控制中心",
    function: "储存遗传信息，控制细胞生命活动",
    memory: "细胞核中含有 DNA"
  },
  {
    id: "vacuole",
    name: "液泡",
    type: "植物细胞常见结构",
    function: "储存水分、无机盐和代谢产物，维持细胞渗透压",
    memory: "成熟植物细胞通常有较大的中央液泡"
  },
  {
    id: "chloroplast",
    name: "叶绿体",
    type: "绿色植物细胞常见结构",
    function: "进行光合作用，将光能转化为有机物中的化学能",
    memory: "叶绿体是绿色植物细胞进行光合作用的主要场所"
  },
  {
    id: "mitochondrion",
    name: "线粒体",
    type: "能量转换结构",
    function: "有氧呼吸的主要场所，为细胞生命活动提供能量",
    memory: "线粒体与细胞能量转换密切相关"
  },
  {
    id: "cytoplasm",
    name: "细胞质",
    type: "细胞内部环境",
    function: "为多种细胞器提供存在环境，是许多代谢反应发生的场所",
    memory: "细胞器分布在细胞质中"
  }
];

const ANIMAL_CELL_ORGANELLES = [
  {
    id: "cellMembrane",
    name: "细胞膜",
    type: "边界结构",
    function: "控制物质进出细胞，维持细胞内环境稳定",
    memory: "动物细胞没有细胞壁，最外层边界是细胞膜"
  },
  {
    id: "cytoplasm",
    name: "细胞质",
    type: "细胞内部环境",
    function: "为细胞器提供存在环境，是许多代谢反应发生的场所",
    memory: "动物细胞的细胞器分布在细胞质中"
  },
  {
    id: "nucleus",
    name: "细胞核",
    type: "遗传控制中心",
    function: "储存遗传信息，控制细胞生命活动",
    memory: "细胞核中含有 DNA"
  },
  {
    id: "mitochondrion",
    name: "线粒体",
    type: "能量转换结构",
    function: "有氧呼吸的主要场所，为细胞生命活动提供能量",
    memory: "线粒体与细胞能量转换密切相关"
  },
  {
    id: "endoplasmicReticulum",
    name: "内质网",
    type: "物质合成与运输结构",
    function: "参与蛋白质和脂质的合成、加工与运输",
    memory: "粗面内质网上附着核糖体"
  },
  {
    id: "golgi",
    name: "高尔基体",
    type: "加工与分泌结构",
    function: "对蛋白质进行加工、分类和包装",
    memory: "高尔基体像细胞内的分拣与包装站"
  },
  {
    id: "ribosome",
    name: "核糖体",
    type: "蛋白质合成场所",
    function: "合成蛋白质",
    memory: "核糖体可以游离在细胞质中，也可以附着在内质网上"
  }
];

const CELL_TYPE_LABELS = {
  plant: "植物细胞",
  animal: "动物细胞"
};

const CELL_ORGANELLE_DATA = {
  plant: CELL_ORGANELLES,
  animal: ANIMAL_CELL_ORGANELLES
};

const CELL_ORGANELLE_MAP = new Map(
  [...CELL_ORGANELLES, ...ANIMAL_CELL_ORGANELLES].map(item => [item.id, item])
);

const elements = {
  scene: $("#scene"),
  car: $("#car"),
  brakeTrace: $("#brakeTrace"),
  distanceFlag: $("#distanceFlag"),
  roadStopLine: $("#roadStopLine"),
  ruler: $("#ruler"),
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
  mentorFeedback: $("#mentorFeedback"),
  parseFeedback: $("#parseFeedback"),
  plantCellModel: $("#plantCellModel"),
  plantCellViewport: $("#plantCellViewport"),
  cellResetButton: $("#cellResetButton"),
  cellAutoButton: $("#cellAutoButton"),
  cellDetailName: $("#cellDetailName"),
  cellDetailType: $("#cellDetailType"),
  cellDetailFunction: $("#cellDetailFunction"),
  cellDetailMemory: $("#cellDetailMemory"),
  cellSelectionName: $("#cellSelectionName"),
  cellSelectionFunction: $("#cellSelectionFunction"),
  cuso4Solution: $("#cuso4Solution"),
  toast: $("#toast"),
  generationOverlay: $("#generationOverlay"),
  generationStatus: $("#generationStatus"),
  generationProgress: $("#generationProgress"),
  demoStepIndicator: $("#demoStepIndicator")
};

const GENERATION_STAGES = [
  { label: "识别条件", text: "识别题干条件与问题目标", progress: 28 },
  { label: "匹配实验模板", text: "匹配可视化实验模板", progress: 63 },
  { label: "生成实验场景", text: "生成实验场景、公式与思维链", progress: 100 }
];

function config() {
  return SUBJECTS[state.subject];
}

function updateSubjectBodyClass(subject = state.subject) {
  document.body.classList.toggle("subject-physics-active", subject === "物理");
  document.body.classList.toggle("subject-chemistry-active", subject === "化学");
  document.body.classList.toggle("subject-math-active", subject === "数学");
  document.body.classList.toggle("subject-biology-active", subject === "生物");
}

function saveCurrentSubjectSnapshot() {
  if (!state.subject || !state.hasGenerated) return;
  state.subjectSnapshots[state.subject] = {
    p1: state.p1,
    p2: state.p2,
    generatedQuestion: state.generatedQuestion || $("#questionInput")?.value || SUBJECTS[state.subject]?.question || "",
    selectedOrganelle: state.selectedOrganelle,
    cellType: state.cellType,
    cellRotateX: state.cellRotateX,
    cellRotateY: state.cellRotateY
  };
}

function restoreSubjectSnapshot(subject) {
  const snapshot = state.subjectSnapshots[subject];
  if (!snapshot) return false;
  state.p1 = snapshot.p1;
  state.p2 = snapshot.p2;
  state.generatedQuestion = snapshot.generatedQuestion || SUBJECTS[subject]?.question || "";
  if (subject === "生物") {
    state.cellType = snapshot.cellType || "plant";
    state.selectedOrganelle = snapshot.selectedOrganelle || "nucleus";
    syncBiologyContent(state.cellType);
    setCellRotation(snapshot.cellRotateX ?? -4, snapshot.cellRotateY ?? -10);
  }
  return true;
}

function smartNumber(value, decimals = 1) {
  const rounded = Number(Number(value).toFixed(decimals));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(decimals);
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function physicsBrakeModel(v0 = state.p1, aAbs = state.p2) {
  const stopTime = v0 / aAbs;
  const stopDistance = (v0 * v0) / (2 * aAbs);
  return { v0, aAbs, stopTime, stopDistance };
}

function physicsVisualDistanceMax(stopDistance = physicsBrakeModel().stopDistance) {
  const target = Math.max(40, stopDistance);
  const scales = [40, 80, 120, 160, 240, 320, 480, 640];
  return scales.find(scale => target <= scale) || Math.ceil(target / 160) * 160;
}

function physicsStopLeftPercent(stopDistance = physicsBrakeModel().stopDistance) {
  const start = 8;
  const end = 86;
  const visualMax = physicsVisualDistanceMax(stopDistance);
  const cappedDistance = Math.max(0, Math.min(visualMax, stopDistance));
  return start + (cappedDistance / visualMax) * (end - start);
}

function physicsRoadWidth() {
  const road = elements.car?.parentElement;
  return road?.clientWidth || road?.getBoundingClientRect().width || 1;
}

function physicsStopLeftPx(stopDistance = physicsBrakeModel().stopDistance) {
  return (physicsStopLeftPercent(stopDistance) / 100) * physicsRoadWidth();
}

function carNoseOffsetPx() {
  const carWidth = elements.car?.offsetWidth || 88;
  return carWidth * 1.05;
}

function updatePhysicsRuler(stopDistance = physicsBrakeModel().stopDistance) {
  if (!elements.ruler) return;
  const visualMax = physicsVisualDistanceMax(stopDistance);
  elements.ruler.innerHTML = [0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
    const value = smartNumber(visualMax * ratio);
    return `<span>${value}${index === 4 ? " m" : ""}</span>`;
  }).join("");
}

function setPhysicsStopMarker(stopDistance = physicsBrakeModel().stopDistance) {
  const leftPx = physicsStopLeftPx(stopDistance);
  if (elements.roadStopLine) {
    elements.roadStopLine.style.left = `${leftPx}px`;
    const lineRect = elements.roadStopLine.getBoundingClientRect();
    const areaRect = elements.distanceFlag.parentElement.getBoundingClientRect();
    const lineCenter = lineRect.left + lineRect.width / 2 - areaRect.left;
    elements.distanceFlag.style.left = `${lineRect.width && areaRect.width ? lineCenter : leftPx}px`;
  } else {
    elements.distanceFlag.style.left = `${leftPx}px`;
  }
  updatePhysicsRuler(stopDistance);
}

function buildPhysicsBrakeContent(v0 = state.p1, aAbs = state.p2) {
  const model = physicsBrakeModel(v0, aAbs);
  const vText = smartNumber(model.v0);
  const aText = smartNumber(model.aAbs);
  const tText = smartNumber(model.stopTime);
  const sText = smartNumber(model.stopDistance);
  const challengeSpeed = smartNumber(model.v0 * 1.5);

  return {
    description: `从题目生成刹车实验：速度从 ${vText}m/s 逐步归零，停止点对应 ${sText}m。`,
    params: [
      { label: "初速度 v₀", desc: "调整车辆起始速度", unit: "m/s", min: PHYSICS_BRAKE_LIMITS.speedMin, max: PHYSICS_BRAKE_LIMITS.speedMax, step: 1, value: model.v0 },
      { label: "加速度 a", desc: "调整刹车减速度", unit: "m/s²", min: PHYSICS_BRAKE_LIMITS.accelMin, max: PHYSICS_BRAKE_LIMITS.accelMax, step: 1, value: model.aAbs, prefix: "−" }
    ],
    steps: [
      ["题干条件", `v₀ = ${vText}m/s，a = −${aText}m/s²，v = 0`, "先识别初速度、刹车加速度和末速度。"],
      ["选择公式", "v² − v₀² = 2as", "题目没有给出时间，所以选择不含 t 的速度位移公式。"],
      ["代入求解", `0² − ${vText}² = 2×(−${aText})×s`, `计算得到刹车距离 s = ${sText}m。`],
      ["现象验证", `速度归零，停止点 ${sText}m`, "结果与实验停止点一致。"]
    ],
    mentor: `为什么这里选 <strong>v² − v₀² = 2as</strong>？因为题目没有给时间，却给了初速度 ${vText}m/s、末速度 0 和加速度 −${aText}m/s²。`,
    hint: "小提示：题目给出了初速度、末速度和加速度，但没有给时间。哪条公式不含 t？",
    challenge: `如果初速度变为 <strong>${challengeSpeed}m/s</strong>，刹车距离会怎样变化？`,
    generationStages: [
      { label: "识别条件", text: `识别题干条件：v₀ = ${vText}m/s，a = −${aText}m/s²`, progress: 28 },
      { label: "匹配模板", text: "匹配刹车实验模板：速度递减至 0", progress: 63 },
      { label: "锁定停止点", text: `生成可视化过程：停止点锁定 ${sText}m`, progress: 100 }
    ],
    recognitionText: `初速度 ${vText}m/s｜刹车加速度 ${aText}m/s²｜停止距离 ${sText}m`,
    stopTimeText: tText,
    stopDistanceText: sText
  };
}

function buildPhysicsBrakeQuestionText(v0 = state.p1, aAbs = state.p2) {
  return `一辆汽车以 ${smartNumber(v0)}m/s 的速度行驶，紧急刹车后加速度大小为 ${smartNumber(aAbs)}m/s²，求刹车距离。`;
}

function formatMol(value) {
  return Number(value).toFixed(2);
}

function formatGram(value) {
  return Number(value).toFixed(1);
}

function cleanChemNumber(value) {
  return Math.abs(value) < 1e-10 ? 0 : Number(value.toFixed(12));
}

function chemistryFeCuSO4Model(feMass = state.p1, cuso4Mol = state.p2) {
  const feMol = cleanChemNumber(feMass / CHEMISTRY_CONSTANTS.feMolarMass);
  const reactedMol = cleanChemNumber(Math.min(feMol, cuso4Mol));
  const cuMol = reactedMol;
  const cuMass = cleanChemNumber(cuMol * CHEMISTRY_CONSTANTS.cuMolarMass);
  const diff = feMol - cuso4Mol;
  let limiting = "恰好完全反应";
  if (diff < -1e-9) limiting = "Fe";
  if (diff > 1e-9) limiting = "CuSO₄";
  const cuso4Left = cleanChemNumber(Math.max(0, cuso4Mol - reactedMol));
  const feLeftMol = cleanChemNumber(Math.max(0, feMol - reactedMol));
  return {
    feMass,
    cuso4Mol,
    feMol,
    limiting,
    reactedMol,
    cuMol,
    cuMass,
    cuso4Left,
    feLeftMol
  };
}

function chemistryReactionJudgement(model) {
  if (model.limiting === "恰好完全反应") {
    return {
      short: "恰好完全反应",
      limitLine: "Fe 与 CuSO₄ 恰好完全反应",
      detail: "Fe 与 CuSO₄ 物质的量相等，二者均完全反应。"
    };
  }
  return {
    short: `${model.limiting} 为限量反应物`,
    limitLine: `${model.limiting} 为限量反应物`,
    detail: "比较 Fe 与 CuSO₄ 的物质的量，较少者限量，过量者剩余。"
  };
}

function buildChemistryQuestionText(feMass = state.p1, cuso4Mol = state.p2) {
  return `将 ${formatGram(feMass)}g 铁粉加入含有 ${formatMol(cuso4Mol)}mol 硫酸铜的溶液中，充分反应。请计算最多生成多少 mol 铜？生成铜的质量是多少？并判断哪种反应物过量。`;
}

function buildChemistryFeCuSO4Content(feMass = state.p1, cuso4Mol = state.p2) {
  const model = chemistryFeCuSO4Model(feMass, cuso4Mol);
  const judgement = chemistryReactionJudgement(model);
  const feMassText = formatGram(model.feMass);
  const feMolText = formatMol(model.feMol);
  const cuso4Text = formatMol(model.cuso4Mol);
  const cuMolText = formatMol(model.cuMol);
  const cuMassText = formatGram(model.cuMass);
  const cuso4LeftText = formatMol(model.cuso4Left);
  const feLeftText = formatMol(model.feLeftMol);

  return {
    description: `Fe(s) + CuSO₄(aq) → FeSO₄(aq) + Cu(s)；铁表面析出红色铜，溶液由蓝色逐渐变为浅绿色。最多生成 Cu ${cuMolText}mol / ${cuMassText}g。`,
    params: [
      { label: "铁粉质量 m(Fe)", desc: "调整投入铁粉质量", unit: "g", min: CHEMISTRY_CONSTANTS.feMassMin, max: CHEMISTRY_CONSTANTS.feMassMax, step: 2.8, value: model.feMass },
      { label: "硫酸铜 n(CuSO₄)", desc: "调整硫酸铜物质的量", unit: "mol", min: CHEMISTRY_CONSTANTS.cuso4MolMin, max: CHEMISTRY_CONSTANTS.cuso4MolMax, step: 0.05, value: model.cuso4Mol }
    ],
    steps: [
      ["提取条件", `Fe = ${feMassText}g，CuSO₄ = ${cuso4Text}mol`, "先识别铁的质量和硫酸铜的物质的量。"],
      ["换算物质的量", `n(Fe) = ${feMassText} ÷ 56 = ${feMolText}mol`, "把铁的质量换算成物质的量。"],
      ["判断反应物关系", `1:1 反应，${judgement.limitLine}`, judgement.detail],
      ["现象验证", `n(Cu)=${cuMolText}mol，m(Cu)=${cuMassText}g`, "铁表面析出红色固体，溶液颜色由蓝色逐渐变为浅绿色。"]
    ],
    mentor: `为什么不能直接用 <strong>${cuso4Text}mol 硫酸铜</strong> 计算铜的质量？`,
    hint: `先把铁的质量换算成 <strong>${feMolText}mol</strong>，再根据方程式 1:1 的计量关系与硫酸铜 <strong>${cuso4Text}mol</strong> 比较，较少的一方决定生成铜的量。`,
    challenge: "如果铁粉增加到 <strong>11.2g</strong>，而硫酸铜仍为 <strong>0.20mol</strong>，生成铜的质量会变吗？为什么？",
    generationStages: [
      { label: "识别条件", text: `识别 Fe ${feMassText}g 与 CuSO₄ ${cuso4Text}mol`, progress: 28 },
      { label: "判断关系", text: `按 1:1 比较，${judgement.short}`, progress: 63 },
      { label: "生成结果", text: `生成 Cu ${cuMolText}mol / ${cuMassText}g`, progress: 100 }
    ],
    recognitionText: `Fe = ${feMassText}g｜CuSO₄ = ${cuso4Text}mol｜反应判断：${judgement.short}｜生成 Cu = ${cuMolText}mol / ${cuMassText}g`,
    formulaHtml: `n(Fe) = ${feMassText} ÷ 56 = ${feMolText}mol<br>n(CuSO₄) = ${cuso4Text}mol<br>n(Cu) = min(${feMolText}, ${cuso4Text}) = ${cuMolText}mol<br>m(Cu) = ${cuMolText} × 64 = ${cuMassText}g`,
    sceneTip: `铁丝进入硫酸铜溶液后，铁表面逐渐析出红色铜；溶液由蓝色变浅绿色。生成 Cu ${cuMolText}mol / ${cuMassText}g；CuSO₄ 剩余 ${cuso4LeftText}mol，Fe 剩余 ${feLeftText}mol。`,
    model
  };
}

function syncChemistryFeCuSO4Content(feMass = state.p1, cuso4Mol = state.p2) {
  const content = buildChemistryFeCuSO4Content(feMass, cuso4Mol);
  const chemistry = SUBJECTS["化学"];
  chemistry.description = content.description;
  chemistry.params = content.params;
  chemistry.steps = content.steps;
  chemistry.mentor = content.mentor;
  chemistry.hint = content.hint;
  chemistry.challenge = content.challenge;
  chemistry.generationStages = content.generationStages;
  chemistry.recognitionText = content.recognitionText;
  return content.model;
}

function buildMathQuestionText(x = state.p1) {
  return `点 P 在抛物线 y = x² 上运动，当 x = ${smartNumber(x)} 时，求该点处切线斜率，并观察 x 改变时斜率如何变化。`;
}

function syncMathContent(x = state.p1) {
  const xText = smartNumber(x);
  const slopeText = smartNumber(2 * x);
  const math = SUBJECTS["数学"];
  math.question = buildMathQuestionText(x);
  math.description = `函数 y = x²，导数 y′ = 2x；当 x = ${xText} 时，切线斜率 k = ${slopeText}。`;
  math.params[0].value = x;
  math.steps = [
    ["提取函数", `y = x²，x = ${xText}`, "识别函数表达式和题目给定位置。"],
    ["求导", "y′ = 2x", "导函数在给定点的值表示该点处切线斜率。"],
    ["代入坐标", `k = 2 × ${xText} = ${slopeText}`, "把给定 x 代入导函数得到斜率。"],
    ["观察变化", "k = 2x 随 x 线性变化", "通过动点观察切线斜率随横坐标改变而变化。"]
  ];
  math.mentor = `为什么抛物线 y = x² 在 x = ${xText} 处的切线斜率等于 <strong>${slopeText}</strong>？`;
  math.hint = `先求导得到导函数 y′ = 2x，再把题目给出的 x = ${xText} 代入；导函数值就是该点切线斜率。`;
  math.challenge = "如果 <strong>x = 5</strong>，切线斜率是多少？";
  math.recognitionText = `函数 y = x²｜导数 y′ = 2x｜x = ${xText}｜切线斜率 k = ${slopeText}`;
}

function normalizeBiologyCellType(text = "") {
  return /动物|animal/i.test(text) ? "animal" : "plant";
}

function currentCellOrganelles(type = state.cellType) {
  return CELL_ORGANELLE_DATA[type] || CELL_ORGANELLE_DATA.plant;
}

function currentCellOrganelleMap(type = state.cellType) {
  return new Map(currentCellOrganelles(type).map(item => [item.id, item]));
}

function defaultOrganelleForCellType(type = state.cellType) {
  return type === "animal" ? "cellMembrane" : "nucleus";
}

function buildBiologyQuestionText(type = state.cellType) {
  if (type === "animal") {
    return "请观察动物细胞的亚显微结构截面图，识别细胞膜、细胞质、细胞核、线粒体、内质网、高尔基体和核糖体等结构，并说明它们的主要作用。";
  }
  return "请观察植物细胞的亚显微结构截面图，识别细胞壁、细胞膜、细胞核、液泡、叶绿体和线粒体等结构，并说明它们在细胞生命活动中的主要作用。";
}

function biologyRecognitionText(type = state.cellType) {
  if (type === "animal") {
    return "动物细胞结构识别题｜截面模型｜可点击结构：细胞膜、细胞质、细胞核、线粒体、内质网、高尔基体、核糖体";
  }
  return "植物细胞结构识别题｜截面模型｜可点击结构：细胞壁、细胞膜、细胞核、液泡、叶绿体、线粒体";
}

function selectedOrganelle() {
  const map = currentCellOrganelleMap();
  return map.get(state.selectedOrganelle) || map.get(defaultOrganelleForCellType()) || CELL_ORGANELLE_MAP.get("nucleus");
}

function buildBiologyContent(type = state.cellType) {
  const label = CELL_TYPE_LABELS[type] || CELL_TYPE_LABELS.plant;
  const structures = currentCellOrganelles(type).map(item => item.name).join("、");
  if (type === "animal") {
    return {
      question: buildBiologyQuestionText("animal"),
      title: "动物细胞结构识别：3D 截面模型",
      description: "动物细胞结构识别｜3D 截面模型｜点击查看功能。",
      ar: "移动端扩展可继续展示动物细胞截面、结构标注与 360° 观察。",
      params: [
        { label: "观察角度", desc: "拖拽或滑动旋转 3D 截面", unit: "°", min: -180, max: 180, step: 15, value: state.cellRotateY || -10 },
        { label: "结构数量", desc: "本题要求识别的核心结构", unit: "个", min: 1, max: 7, step: 1, value: currentCellOrganelles("animal").length }
      ],
      steps: [
        ["观察截面", "先找细胞膜、细胞质和细胞核", "动物细胞没有细胞壁，外层边界是细胞膜。"],
        ["识别结构", "点击线粒体、内质网、高尔基体、核糖体等结构", "通过交互标注把细胞器名称和形态对应起来。"],
        ["关联功能", "线粒体参与有氧呼吸，核糖体合成蛋白质", "把结构名称进一步连接到生命活动中的作用。"],
        ["对比记忆", "动物细胞通常无细胞壁、叶绿体和中央大液泡", "用与典型植物细胞的差异形成记忆抓手。"]
      ],
      mentor: "动物细胞结构和植物细胞有什么区别？重点看有没有<strong>细胞壁、叶绿体和中央大液泡</strong>。",
      hint: "动物细胞最外层是细胞膜，没有细胞壁；通常没有叶绿体，也没有成熟植物细胞那样明显的中央大液泡。",
      challenge: "切换回 <strong>植物细胞</strong>，对比哪些结构是植物细胞特有或更明显的。",
      generationStages: [
        { label: "识别题型", text: "识别动物细胞结构识别题", progress: 28 },
        { label: "生成截面", text: "构建动物细胞 3D 截面模型", progress: 63 },
        { label: "绑定标注", text: "绑定可点击结构与功能解析", progress: 100 }
      ],
      recognitionText: biologyRecognitionText("animal"),
      structures,
      label
    };
  }
  return {
    question: buildBiologyQuestionText("plant"),
    title: "植物细胞结构识别：3D 截面模型",
    description: "植物细胞结构识别｜3D 截面模型｜点击查看功能。",
    ar: "移动端扩展可继续展示植物细胞截面、结构标注与 360° 观察。",
    params: [
      { label: "观察角度", desc: "拖拽或滑动旋转 3D 截面", unit: "°", min: -180, max: 180, step: 15, value: state.cellRotateY || -10 },
      { label: "结构数量", desc: "本题要求识别的核心结构", unit: "个", min: 1, max: 7, step: 1, value: currentCellOrganelles("plant").length }
    ],
    steps: [
      ["观察截面", "先区分外层边界、内部细胞器和中央液泡", "从整体截面入手，先看边界，再看内部结构。"],
      ["识别结构", "点击细胞壁、细胞膜、细胞核、叶绿体、线粒体等结构", "通过交互标注把图像结构和名称对应起来。"],
      ["关联功能", "叶绿体进行光合作用，线粒体是有氧呼吸主要场所", "把结构名称进一步连接到生命活动中的作用。"],
      ["对比记忆", "典型植物细胞常见细胞壁、叶绿体和大液泡", "用与动物细胞的差异形成记忆抓手。"]
    ],
    mentor: "植物细胞结构和动物细胞有什么区别？重点看<strong>细胞壁、叶绿体和大液泡</strong>。",
    hint: "典型植物细胞有细胞壁；绿色植物细胞常见叶绿体；成熟植物细胞常有较大的中央液泡。动物细胞没有细胞壁，通常没有叶绿体。",
    challenge: "切换到 <strong>动物细胞</strong>，观察它和植物细胞相比少了哪些结构。",
    generationStages: [
      { label: "识别题型", text: "识别植物细胞结构识别题", progress: 28 },
      { label: "生成截面", text: "构建植物细胞 3D 截面模型", progress: 63 },
      { label: "绑定标注", text: "绑定可点击结构与功能解析", progress: 100 }
    ],
    recognitionText: biologyRecognitionText("plant"),
    structures,
    label
  };
}

function syncBiologyContent(type = state.cellType) {
  state.cellType = type;
  const content = buildBiologyContent(type);
  const biology = SUBJECTS["生物"];
  biology.question = content.question;
  biology.title = content.title;
  biology.description = content.description;
  biology.ar = content.ar;
  biology.params = content.params;
  biology.steps = content.steps;
  biology.mentor = content.mentor;
  biology.hint = content.hint;
  biology.challenge = content.challenge;
  biology.generationStages = content.generationStages;
  biology.recognitionText = content.recognitionText;
  return content;
}

function setCellRotation(x = state.cellRotateX, y = state.cellRotateY) {
  state.cellRotateX = Math.max(-28, Math.min(18, x));
  state.cellRotateY = ((y + 180) % 360 + 360) % 360 - 180;
  if (elements.plantCellModel) {
    elements.plantCellModel.style.setProperty("--cell-rotate-x", `${state.cellRotateX}deg`);
    elements.plantCellModel.style.setProperty("--cell-rotate-y", `${state.cellRotateY}deg`);
  }
}

function setCellAutoRotate(enabled) {
  state.cellAutoRotate = Boolean(enabled);
  if (elements.plantCellModel) elements.plantCellModel.classList.toggle("auto-rotate", state.cellAutoRotate);
  if (elements.cellAutoButton) {
    elements.cellAutoButton.classList.toggle("active", state.cellAutoRotate);
    elements.cellAutoButton.textContent = state.cellAutoRotate ? "停止旋转" : "自动旋转";
  }
}

function updateCellModelMode() {
  if (!elements.plantCellModel) return;
  const isAnimal = state.cellType === "animal";
  elements.plantCellModel.classList.toggle("animal-cell-mode", isAnimal);
  elements.plantCellModel.classList.toggle("plant-cell-mode", !isAnimal);
  elements.plantCellModel.setAttribute("aria-label", `${CELL_TYPE_LABELS[state.cellType]} 3D 截面模型`);
  const title = $(".cell-viewer-head > span");
  if (title) title.textContent = `${CELL_TYPE_LABELS[state.cellType]} 3D 截面`;
  $$(".cell-organelle").forEach(node => {
    const allowed = currentCellOrganelleMap().has(node.dataset.organelle);
    node.classList.toggle("unavailable", !allowed);
    node.setAttribute("aria-hidden", String(!allowed));
  });
  $$(".cell-structure-tag").forEach(node => {
    const allowed = currentCellOrganelleMap().has(node.dataset.organelle);
    node.classList.toggle("unavailable", !allowed);
    node.setAttribute("aria-hidden", String(!allowed));
  });
}

function renderCellDetail(id = state.selectedOrganelle) {
  updateCellModelMode();
  const map = currentCellOrganelleMap();
  const organelle = map.get(id) || map.get(defaultOrganelleForCellType());
  state.selectedOrganelle = organelle.id;

  $$(".cell-organelle").forEach(node => {
    node.classList.toggle("active", node.dataset.organelle === organelle.id);
  });
  $$(".cell-structure-tag").forEach(node => {
    node.classList.toggle("active", node.dataset.organelle === organelle.id);
  });

  if (elements.cellDetailName) elements.cellDetailName.textContent = organelle.name;
  if (elements.cellDetailType) elements.cellDetailType.textContent = organelle.type;
  if (elements.cellDetailFunction) elements.cellDetailFunction.textContent = organelle.function;
  if (elements.cellDetailMemory) elements.cellDetailMemory.textContent = organelle.memory;
  if (elements.cellSelectionName) elements.cellSelectionName.textContent = organelle.name;
  if (elements.cellSelectionFunction) elements.cellSelectionFunction.textContent = organelle.function;
  if ($("#bioFluidity")) $("#bioFluidity").textContent = organelle.name;

  if (state.subject === "生物" && state.hasGenerated) {
    elements.sceneTip.innerHTML = `<span>结构解析</span>${organelle.name}：${organelle.function}`;
  }
}

function selectBioOrganelle(id) {
  if (state.subject !== "生物" || !state.hasGenerated) return;
  if (!currentCellOrganelleMap().has(id)) return;
  setCellAutoRotate(false);
  renderCellDetail(id);
  setReasoningStep(2, `<span>结构识别</span>已选中${selectedOrganelle().name}，继续关联它的主要功能。`);
  showToast(`已选中：${selectedOrganelle().name}`);
}

function resetBiologyCellModel() {
  setCellAutoRotate(false);
  setCellRotation(-4, -10);
  updateCellModelMode();
  renderCellDetail(state.selectedOrganelle || defaultOrganelleForCellType());
}

function switchBiologyCellType(type, options = {}) {
  if (state.subject !== "生物") return;
  state.cellType = type;
  const content = syncBiologyContent(type);
  state.selectedOrganelle = defaultOrganelleForCellType(type);
  resetBiologyCellModel();
  updateFormulaSpotlight("生物");
  renderReasoning();
  elements.mentorMessage.innerHTML = config().mentor;
  setRecognitionFeedback(biologyTemplateRecognition());
  $("#experimentTitle").textContent = content.title;
  $("#problemText").textContent = options.problemText || content.question;
  $("#arDescription").textContent = content.ar;
  $("#engineBadge").textContent = "典型题型模板演示";
  if (options.updateQuestion !== false) $("#questionInput").value = content.question;
  state.generatedQuestion = $("#questionInput").value || content.question;
  if (state.hasGenerated) saveCurrentSubjectSnapshot();
}

function syncPhysicsBrakeContent(v0 = state.p1, aAbs = state.p2) {
  const content = buildPhysicsBrakeContent(v0, aAbs);
  const physics = SUBJECTS["物理"];
  physics.description = content.description;
  physics.params = content.params;
  physics.steps = content.steps;
  physics.mentor = content.mentor;
  physics.hint = content.hint;
  physics.challenge = content.challenge;
  physics.generationStages = content.generationStages;
  physics.recognitionText = content.recognitionText;
  return physicsBrakeModel(v0, aAbs);
}

function hideMentorFeedback() {
  if (!elements.mentorFeedback) return;
  elements.mentorFeedback.className = "mentor-feedback";
  elements.mentorFeedback.innerHTML = "";
}

function showMentorFormulaFeedback() {
  if (!elements.mentorFeedback) return;
  const content = buildPhysicsBrakeContent();
  elements.mentorFeedback.className = "mentor-feedback show formula";
  elements.mentorFeedback.innerHTML = `
    <span>核心公式</span>
    <strong>v² − v₀² = 2as</strong>
    <p>题目没有给时间 t，所以先用速度—位移关系。代入后可得到停止距离 <b>${content.stopDistanceText}m</b>。</p>
  `;
}

function showMentorChallengeFeedback(previous, next) {
  if (!elements.mentorFeedback) return;
  elements.mentorFeedback.className = "mentor-feedback show challenge";
  elements.mentorFeedback.innerHTML = `
    <span>变式题已加载</span>
    <strong>题目参数已同步更新</strong>
    <p>初速度 <em>${smartNumber(previous.v0)} → ${smartNumber(next.v0)}m/s</em>｜停止距离 <em>${smartNumber(previous.stopDistance)} → ${smartNumber(next.stopDistance)}m</em></p>
  `;
}

function nextPhysicsChallengeSpeed(currentSpeed) {
  let next = Math.round(currentSpeed * 1.5);
  if (next > PHYSICS_BRAKE_LIMITS.speedMax || next === currentSpeed) {
    next = Math.round(currentSpeed * 0.75);
  }
  if (next === currentSpeed) next += currentSpeed < PHYSICS_BRAKE_LIMITS.speedMax ? 5 : -5;
  return Math.max(PHYSICS_BRAKE_LIMITS.speedMin, Math.min(PHYSICS_BRAKE_LIMITS.speedMax, next));
}

function normalizeQuestionText(text) {
  return String(text || "")
    .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/．/g, ".")
    .replace(/[－−–—]/g, "-")
    .replace(/₀/g, "0")
    .replace(/₁/g, "1")
    .replace(/₂/g, "2")
    .replace(/₃/g, "3")
    .replace(/₄/g, "4")
    .replace(/²/g, "2")
    .replace(/\s+/g, " ")
    .trim();
}

function firstNumberByPatterns(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

function parsePhysicsBrakeQuestion(text) {
  const normalized = normalizeQuestionText(text);
  const failMessage = "暂未识别该题型，请尝试输入含有初速度和刹车加速度的刹车距离题。";
  if (!normalized) return { ok: false, message: failMessage };
  if (!/刹车|制动|减速|减速度|停止|停下|停车/.test(normalized)) {
    return { ok: false, message: failMessage };
  }

  let v0 = firstNumberByPatterns(normalized, [
    /(?:初速度|初速|v\s*0|v₀)\s*(?:为|是|=|:|：)?\s*(-?\d+(?:\.\d+)?)\s*m\s*\/\s*s/i,
    /以\s*(-?\d+(?:\.\d+)?)\s*m\s*\/\s*s\s*(?:的)?速度/i,
    /(?:^|[，,。；;\s])速度(?:大小)?\s*(?:为|是|=|:|：)\s*(-?\d+(?:\.\d+)?)\s*m\s*\/\s*s/i
  ]);

  if (v0 === null) {
    const speedMatches = [...normalized.matchAll(/(-?\d+(?:\.\d+)?)\s*m\s*\/\s*s(?!\s*(?:²|2|\^\s*2))/gi)];
    if (speedMatches.length) v0 = Number(speedMatches[0][1]);
  }

  let aAbs = firstNumberByPatterns(normalized, [
    /(?:刹车|制动)?\s*(?:加速度大小|加速度|减速度|减速加速度|制动加速度)\s*(?:大小)?\s*(?:为|是|=|:|：)?\s*(-?\d+(?:\.\d+)?)/i,
    /(?:^|[，,；;\s])a\s*(?:=|为|是|:|：)\s*(-?\d+(?:\.\d+)?)/i
  ]);

  if (aAbs === null) {
    const accelMatches = [...normalized.matchAll(/(-?\d+(?:\.\d+)?)\s*m\s*\/\s*s\s*(?:²|2|\^\s*2)/gi)];
    if (accelMatches.length) aAbs = Number(accelMatches[0][1]);
  }

  if (!Number.isFinite(v0) || !Number.isFinite(aAbs)) {
    return { ok: false, message: failMessage };
  }

  v0 = Math.abs(v0);
  aAbs = Math.abs(aAbs);
  if (v0 <= 0 || aAbs <= 0) return { ok: false, message: failMessage };

  if (v0 < PHYSICS_BRAKE_LIMITS.speedMin || v0 > PHYSICS_BRAKE_LIMITS.speedMax) {
    return { ok: false, message: `识别到初速度 ${smartNumber(v0)}m/s，但当前演示范围为 ${PHYSICS_BRAKE_LIMITS.speedMin}–${PHYSICS_BRAKE_LIMITS.speedMax}m/s。` };
  }
  if (aAbs < PHYSICS_BRAKE_LIMITS.accelMin || aAbs > PHYSICS_BRAKE_LIMITS.accelMax) {
    return { ok: false, message: `识别到刹车加速度 ${smartNumber(aAbs)}m/s²，但当前演示范围为 ${PHYSICS_BRAKE_LIMITS.accelMin}–${PHYSICS_BRAKE_LIMITS.accelMax}m/s²。` };
  }

  const model = physicsBrakeModel(v0, aAbs);
  return {
    ok: true,
    subject: "物理",
    type: "braking_distance",
    v0,
    aAbs,
    stopTime: model.stopTime,
    stopDistance: model.stopDistance,
    message: `已识别：初速度 ${smartNumber(v0)}m/s，刹车加速度 ${smartNumber(aAbs)}m/s²`
  };
}

window.parsePhysicsBrakeQuestion = parsePhysicsBrakeQuestion;

function parseChemistryFeCuSO4Question(text) {
  const normalized = normalizeQuestionText(text);
  const failMessage = "当前化学演示支持铁与硫酸铜的定量反应题，请输入铁的质量和硫酸铜的物质的量。";
  if (!normalized) return { ok: false, message: failMessage };
  if (!/(铁|Fe)/i.test(normalized) || !/(硫酸铜|CuSO4|CuSO₄)/i.test(normalized)) {
    return { ok: false, message: failMessage };
  }

  const feMass = firstNumberByPatterns(normalized, [
    /(?:铁粉|铁|Fe)\s*(?:粉|的)?\s*(?:质量|质量为|为|=|:|：)?\s*(\d+(?:\.\d+)?)\s*g/i,
    /(\d+(?:\.\d+)?)\s*g\s*(?:铁粉|铁|Fe)/i
  ]);

  const cuso4Mol = firstNumberByPatterns(normalized, [
    /(?:硫酸铜|CuSO4)\s*(?:溶液)?\s*(?:的)?\s*(?:物质的量|为|=|:|：)?\s*(\d+(?:\.\d+)?)\s*mol/i,
    /(?:含有|加入|与|和)?\s*(\d+(?:\.\d+)?)\s*mol\s*(?:硫酸铜|CuSO4)/i,
    /(\d+(?:\.\d+)?)\s*mol\s*(?:CuSO4)/i
  ]);

  if (!Number.isFinite(feMass) || !Number.isFinite(cuso4Mol) || feMass <= 0 || cuso4Mol <= 0) {
    return { ok: false, message: failMessage };
  }

  const model = chemistryFeCuSO4Model(feMass, cuso4Mol);
  const content = buildChemistryFeCuSO4Content(feMass, cuso4Mol);
  const judgement = chemistryReactionJudgement(model);
  return {
    ok: true,
    subject: "化学",
    type: "fe_cuso4_stoichiometry",
    feMass,
    cuso4Mol,
    feMol: model.feMol,
    limiting: model.limiting,
    cuMol: model.cuMol,
    cuMass: model.cuMass,
    cuso4Left: model.cuso4Left,
    feLeftMol: model.feLeftMol,
    recognitionText: content.recognitionText,
    message: `已识别：Fe ${formatGram(feMass)}g，CuSO₄ ${formatMol(cuso4Mol)}mol，${judgement.short}`
  };
}

function parseMathTangentQuestion(text) {
  const normalized = normalizeQuestionText(text);
  const failMessage = "当前数学演示支持 y = x² 的切线斜率题，请输入包含函数 y = x² 和指定 x 值的题目。";
  if (!normalized) return { ok: false, message: failMessage };
  const hasParabola = /抛物线/.test(normalized) || /y\s*(?:=|为|是)\s*x\s*(?:\^?\s*2|平方)/i.test(normalized);
  const hasTangentTask = /切线|斜率|导数/.test(normalized);
  const match = normalized.match(/x\s*(?:=|为|是|:|：)\s*(-?\d+(?:\.\d+)?)/i);
  if (!hasParabola || !hasTangentTask || !match) {
    return { ok: false, message: failMessage };
  }
  const x = Number(match[1]);
  if (!Number.isFinite(x)) return { ok: false, message: failMessage };
  if (x < -5 || x > 5) {
    return { ok: false, message: `识别到 x = ${smartNumber(x)}，但当前演示范围为 -5 到 5。` };
  }
  const safeX = x;
  return {
    ok: true,
    subject: "数学",
    type: "parabola_tangent_slope",
    x: safeX,
    slope: 2 * safeX,
    recognitionText: `函数 y = x²｜导数 y′ = 2x｜x = ${smartNumber(safeX)}｜切线斜率 k = ${smartNumber(2 * safeX)}`
  };
}

function biologyTemplateRecognition() {
  return {
    ok: true,
    subject: "生物",
    type: `${state.cellType}_cell_structure_identification`,
    recognitionText: biologyRecognitionText(state.cellType)
  };
}

window.parseChemistryFeCuSO4Question = parseChemistryFeCuSO4Question;

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
    const stopDistance = (state.p1 * state.p1) / (2 * state.p2);
    const experimentProgress = Math.min(1, distance / stopDistance);
    return { progress: experimentProgress, experimentProgress, timelineProgress: t / duration(), metrics: [speed, distance, t] };
  }

  if (state.subject === "化学") {
    const chem = chemistryFeCuSO4Model(state.p1, state.p2);
    return { progress, metrics: [chem.feMass, chem.cuMol, chem.cuMass], chem };
  }

  if (state.subject === "数学") {
    const x = state.p1 + (3 - state.p1) * progress;
    return { progress, metrics: [x, 2 * x, t], x };
  }

  return { progress, metrics: [currentCellOrganelles().length, Math.round(state.cellRotateY), t] };
}

function formatNumber(value) {
  return Number(value).toFixed(1);
}

function formatMetricValue(value, index) {
  if (state.subject === "化学") {
    if (index === 1) return formatMol(value);
    return formatGram(value);
  }
  if (state.subject === "数学" && index < 2) return smartNumber(value);
  if (state.subject === "生物" && index < 2) return Number(value).toFixed(0);
  return formatNumber(value);
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
    const roadWidth = physicsRoadWidth();
    const startLeftPx = roadWidth * 0.08;
    const startTracePx = roadWidth * 0.09;
    const noseOffsetPx = carNoseOffsetPx();
    const startNosePx = startLeftPx + noseOffsetPx;
    const stopNosePx = Math.max(startNosePx, physicsStopLeftPx());
    const nosePx = startNosePx + (stopNosePx - startNosePx) * (values.experimentProgress ?? values.progress);
    const carLeftPx = nosePx - noseOffsetPx;
    elements.car.style.left = `${carLeftPx}px`;
    elements.brakeTrace.style.width = `${Math.max(0, nosePx - startTracePx)}px`;
    elements.car.classList.toggle("moving", state.playing && values.metrics[0] > 0);
  }

  if (state.subject === "化学") {
    const label = $(".chem-label span");
    if (label) label.textContent = "定量反应模板";
    const feRatio = clamp(
      (values.chem.feMass - CHEMISTRY_CONSTANTS.feMassMin) /
      (CHEMISTRY_CONSTANTS.feMassMax - CHEMISTRY_CONSTANTS.feMassMin)
    );
    const concentrationRatio = clamp(
      (values.chem.cuso4Mol - CHEMISTRY_CONSTANTS.cuso4MolMin) /
      (CHEMISTRY_CONSTANTS.cuso4MolMax - CHEMISTRY_CONSTANTS.cuso4MolMin)
    );
    const reactedFraction = values.chem.cuso4Mol > 0 ? clamp(values.chem.cuMol / values.chem.cuso4Mol) : 0;
    const finalCopperAmount = clamp(0.18 + (values.chem.cuMol / CHEMISTRY_CONSTANTS.cuso4MolMax) * 0.82);
    const progress = values.progress;
    const greenAmount = clamp(progress * (0.24 + reactedFraction * 0.62));
    const startColor = {
      r: Math.round(83 - concentrationRatio * 48),
      g: Math.round(180 - concentrationRatio * 76),
      b: Math.round(240 - concentrationRatio * 34)
    };
    const endColor = { r: 142, g: 210, b: 170 };
    const solutionR = Math.round(startColor.r + (endColor.r - startColor.r) * greenAmount);
    const solutionG = Math.round(startColor.g + (endColor.g - startColor.g) * greenAmount);
    const solutionB = Math.round(startColor.b + (endColor.b - startColor.b) * greenAmount);

    elements.scene.style.setProperty("--iron-scale", String(0.78 + feRatio * 0.5));
    elements.scene.style.setProperty("--iron-drop", String(clamp(progress * 1.2)));
    elements.scene.style.setProperty("--chem-reaction-progress", String(progress));
    elements.scene.style.setProperty("--copper-amount", String(clamp(progress * finalCopperAmount)));
    elements.scene.style.setProperty("--solution-green", String(greenAmount));
    if (elements.cuso4Solution) {
      elements.cuso4Solution.style.setProperty("--cuso4-color", `rgb(${solutionR}, ${solutionG}, ${solutionB})`);
      elements.cuso4Solution.style.filter = `saturate(${1 + concentrationRatio * 0.72 - greenAmount * 0.32}) brightness(${1 - concentrationRatio * 0.06 + greenAmount * 0.05})`;
    }
    $("#chemRate").textContent = `${Math.round(progress * finalCopperAmount * 100)}%析铜`;
  }

  if (state.subject === "数学") {
    const x = values.x;
    const y = x * x;
    const xScale = 45;
    const yScale = 8;
    const cx = 300 + x * xScale;
    const cy = 225 - y * yScale;
    const x1 = x - 1.4;
    const x2 = x + 1.4;
    $("#mathPoint").setAttribute("cx", cx);
    $("#mathPoint").setAttribute("cy", cy);
    $("#tangentLine").setAttribute("x1", 300 + x1 * xScale);
    $("#tangentLine").setAttribute("y1", 225 - (y + 2 * x * (x1 - x)) * yScale);
    $("#tangentLine").setAttribute("x2", 300 + x2 * xScale);
    $("#tangentLine").setAttribute("y2", 225 - (y + 2 * x * (x2 - x)) * yScale);
    $("#mathCoordinate").textContent = `(${x.toFixed(1)}, ${y.toFixed(1)})`;
  }

  if (state.subject === "生物") renderCellDetail(state.selectedOrganelle);
}

function updateScene() {
  const values = valuesAt(state.time);
  values.metrics.forEach((value, index) => {
    elements.metricValues[index].textContent = formatMetricValue(value, index);
  });
  elements.timeline.value = (values.timelineProgress ?? values.progress) * 100;
  elements.currentTime.textContent = formatTime(state.time);
  updateSubjectVisuals(values);

  const completed = (values.timelineProgress ?? values.progress) >= 1;
  if (completed) {
    pauseExperiment();
    const conclusions = {
      "物理": `车辆在 ${duration().toFixed(1)} 秒后停止，刹车距离为 ${values.metrics[1].toFixed(1)} 米。`,
      "化学": `铁表面析出红色铜，溶液由蓝色变为浅绿色；${chemistryReactionJudgement(values.chem).short}，生成 Cu ${formatMol(values.chem.cuMol)}mol / ${formatGram(values.chem.cuMass)}g。`,
      "数学": `当 x = ${smartNumber(state.p1)} 时，切线斜率 k = ${smartNumber(2 * state.p1)}。`,
      "生物": `已完成植物细胞截面识别，可点击结构查看名称、类型和功能。`
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
  setReasonProgress(state.reasonStep);
}

function setActiveSubjectTab(subject) {
  $$(".subject-tab").forEach(tab => {
    const active = tab.dataset.subject === subject;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
}

function updateFormulaSpotlight(subject) {
  const spotlight = $(".formula-spotlight");
  if (!spotlight) return;
  const physics = buildPhysicsBrakeContent();
  const chemistry = buildChemistryFeCuSO4Content();
  const mathValue = subject === "数学" ? state.p1 : SUBJECTS["数学"].params[0].value;
  const mathSlope = smartNumber(2 * mathValue);
  const mathX = smartNumber(mathValue);

  const biologyConcept = state.cellType === "animal"
    ? [
        "核心概念",
        "动物细胞 = 细胞膜 + 细胞质 + 细胞核 + 多种细胞器",
        "线粒体：有氧呼吸主要场所<br>内质网：合成与运输<br>高尔基体：加工、分类和包装<br>区别：通常无细胞壁、叶绿体和中央大液泡"
      ]
    : [
        "核心概念",
        "典型植物细胞 = 细胞壁 + 细胞膜 + 细胞质 + 细胞核 + 多种细胞器",
        "叶绿体：光合作用<br>线粒体：有氧呼吸主要场所<br>液泡：维持渗透压<br>区别：常见细胞壁、叶绿体和较大液泡"
      ];

  const formulas = {
    "物理": [
      "核心公式",
      "v² − v₀² = 2as",
      `0² − ${smartNumber(state.p1)}² = 2 × (−${smartNumber(state.p2)}) × s，得到 s = ${physics.stopDistanceText}m`
    ],
    "化学": [
      "核心关系",
      "Fe + CuSO₄ → FeSO₄ + Cu",
      `计量关系：1mol Fe : 1mol CuSO₄ : 1mol Cu<br>${chemistry.formulaHtml}`
    ],
    "数学": [
      "导数关系",
      "y′ = 2x",
      `函数 y = x²；当 x = ${mathX} 时，斜率 k = ${mathSlope}`
    ],
    "生物": biologyConcept
  };

  const [label, formula, desc] = formulas[subject] || formulas["物理"];
  const labelEl = $("span", spotlight);
  const formulaEl = $("strong", spotlight);
  const descEl = $("p", spotlight);

  if (labelEl) labelEl.textContent = label;
  if (formulaEl) formulaEl.textContent = formula;
  if (descEl) descEl.innerHTML = desc;
}

function setReasonProgress(step) {
  const progress = Math.max(0, Math.min(4, Number(step) || 0));
  const progressEl = $("#reasonProgress");
  if (!progressEl) return;
  progressEl.textContent = String(progress);
  progressEl.parentElement.style.setProperty("--reason-progress", `${(progress / 4) * 100}%`);
}

function updateGreeting() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好";
  const greetingTitle = $(".topbar h1");
  if (greetingTitle) greetingTitle.textContent = `${greeting}，同学`;
}

function setDemoStep(step, text) {
  if (!elements.demoStepIndicator) return;
  const numberEl = $(".demo-step-number", elements.demoStepIndicator);
  const textEl = $("strong", elements.demoStepIndicator);
  if (numberEl) numberEl.textContent = `Step ${step}`;
  if (textEl) textEl.textContent = text;
}

function scheduleAutoDemo() {
  if (!document.body.classList.contains("demo-mode")) return;
  state.autoDemoTimer = setTimeout(() => {
    if (state.userGeneratedOnce) return;
    state.autoDemoStarted = true;
    $("#generateButton")?.click();
  }, 3000);
}

function setRange(range, param) {
  range.min = param.min;
  range.max = param.max;
  range.step = param.step;
  range.value = param.value;
}

function formatParam(param, value) {
  const decimals = String(param.step).includes(".")
    ? String(param.step).split(".")[1].length
    : 0;
  return `${param.prefix || ""}${Number(value).toFixed(decimals)}`;
}

function setRecognitionFeedback(result, isError = false) {
  if (!elements.parseFeedback) return;
  elements.parseFeedback.classList.add("show");
  elements.parseFeedback.classList.toggle("error", isError);
  elements.parseFeedback.classList.remove("pending");
  if (isError) {
    elements.parseFeedback.innerHTML = `<span>识别提示</span><strong>${result.message}</strong>`;
    return;
  }
  let recognitionText = result.recognitionText;
  if (!recognitionText && result.type === "braking_distance") {
    recognitionText = buildPhysicsBrakeContent(result.v0, result.aAbs).recognitionText;
  }
  if (!recognitionText && state.subject === "化学") {
    recognitionText = buildChemistryFeCuSO4Content().recognitionText;
  }
  if (!recognitionText) recognitionText = result.message || "已识别典型题型模板";
  elements.parseFeedback.innerHTML = `<span>识别结果</span><strong>${recognitionText}</strong>`;
}

function setRecognitionPending(message = "题目已修改，点击“生成实验”重新识别。") {
  if (!elements.parseFeedback) return;
  elements.parseFeedback.classList.add("show", "pending");
  elements.parseFeedback.classList.remove("error");
  elements.parseFeedback.innerHTML = `<span>待重新识别</span><strong>${message}</strong>`;
}

function clearRecognitionFeedback() {
  if (!elements.parseFeedback) return;
  elements.parseFeedback.classList.remove("show", "error", "pending");
  elements.parseFeedback.innerHTML = "";
}

function syncPhysicsQuestionFromState() {
  const question = buildPhysicsBrakeQuestionText();
  $("#questionInput").value = question;
  $("#problemText").textContent = question;
  state.generatedQuestion = question;
  return question;
}

function syncSubjectQuestionFromState(subject = state.subject) {
  if (subject === "物理") return syncPhysicsQuestionFromState();
  let question = SUBJECTS[subject]?.question || "";
  if (subject === "化学") question = buildChemistryQuestionText();
  if (subject === "数学") question = buildMathQuestionText();
  if (subject === "生物") question = buildBiologyQuestionText();
  $("#questionInput").value = question;
  $("#problemText").textContent = question;
  state.generatedQuestion = question;
  return question;
}

function syncPhysicsControlsFromState() {
  pauseExperiment();
  state.time = 0;
  const current = SUBJECTS["物理"];
  current.params.forEach((param, index) => {
    elements.paramLabels[index].textContent = param.label;
    elements.paramDescriptions[index].textContent = param.desc;
    elements.paramUnits[index].textContent = param.unit;
    setRange(elements.ranges[index], param);
    elements.paramValues[index].textContent = formatParam(param, index === 0 ? state.p1 : state.p2);
  });
  elements.totalTime.textContent = formatTime(duration());
  const content = buildPhysicsBrakeContent();
  elements.stopDistanceLabel.textContent = `${content.stopDistanceText} m`;
  setPhysicsStopMarker();
  elements.currentTime.textContent = "00:00";
  elements.timeline.value = 0;
  if (state.hasGenerated) updateScene();
}

function renderWaitingReasoning() {
  $(".side-card-header .section-kicker").textContent = "等待题目解析";
  $(".side-card-header h2").textContent = "思维链将在生成后出现";
  setReasonProgress(0);
  const spotlight = $(".formula-spotlight");
  if (spotlight) {
    $("span", spotlight).textContent = "等待生成";
    $("strong", spotlight).textContent = "公式将在这里呈现";
    $("p", spotlight).textContent = "AI 会根据题干条件选择公式，并展示代入与验证过程。";
  }
  $(".reasoning-steps").innerHTML = [
    ["识别题干条件", "点击生成后开始分析"],
    ["选择适用公式", "生成后展示推理路径"],
    ["代入数据求解", "生成后联动实验结果"],
    ["检验学习结论", "生成后形成总结"]
  ].map((step, index) => `<button class="reason-step pending-placeholder" data-step="${index + 1}">
      <span class="step-index">${index + 1}</span>
      <div><small>等待</small><strong>${step[0]}</strong><p>${step[1]}</p></div>
      <i><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></i>
    </button>`).join("");
  elements.mentorMessage.innerHTML = "生成实验后，我会根据题目给出关键追问、提示和变式迁移。";
  hideMentorFeedback();
}

function applyWaitingState(subject = state.subject, options = {}) {
  clearDemoTimers();
  pauseExperiment();
  state.hasGenerated = false;
  state.generatedQuestion = "";
  state.subject = subject;
  updateSubjectBodyClass(subject);
  state.reasonStep = 0;
  if (subject === "物理" && options.presetQuestion) {
    state.p1 = 20;
    state.p2 = 5;
    syncPhysicsBrakeContent();
  }
  if (subject === "化学" && options.presetQuestion) {
    state.p1 = 5.6;
    state.p2 = 0.2;
    syncChemistryFeCuSO4Content();
  }
  if (subject === "数学" && options.presetQuestion) {
    state.p1 = 3;
    state.p2 = 1;
    syncMathContent(3);
  }
  if (subject === "生物" && options.presetQuestion) {
    state.cellType = "plant";
    syncBiologyContent("plant");
    state.p1 = -10;
    state.p2 = 6;
    state.selectedOrganelle = defaultOrganelleForCellType();
    resetBiologyCellModel();
  }
  document.body.classList.add("awaiting-generation");
  setActiveSubjectTab(subject);
  clearRecognitionFeedback();
  if (options.clearInput) $("#questionInput").value = "";
  if (options.presetQuestion) $("#questionInput").value = SUBJECTS[subject]?.question || "";
  $("#experimentTitle").textContent = "等待生成实验";
  $("#problemText").textContent = "输入题目并点击“生成实验”后，这里会构建对应的可视化实验。";
  $("#engineBadge").textContent = "等待题目输入";
  $("#arDescription").textContent = "生成实验后，可继续扩展移动端空间展示。";
  elements.scene.className = "scene subject-pending";
  $("#viewButton").classList.remove("selected");
  $("#annotationButton").classList.remove("selected");
  elements.metricLabels[0].textContent = "参数识别";
  elements.metricLabels[1].textContent = "过程建模";
  elements.metricLabels[2].textContent = "实验输出";
  elements.metricValues.forEach(value => { value.textContent = "--"; });
  elements.metricUnits.forEach(unit => { unit.textContent = ""; });
  elements.stopDistanceLabel.textContent = "--";
  elements.sceneTip.innerHTML = `<span>等待生成</span>输入题目后，AI 会识别条件并生成实验场景。`;
  elements.currentTime.textContent = "00:00";
  elements.timeline.value = 0;
  renderWaitingReasoning();
}

function updateParameters(reset = true, options = {}) {
  state.p1 = Number(elements.ranges[0].value);
  state.p2 = Number(elements.ranges[1].value);
  if (state.subject === "物理") {
    syncPhysicsBrakeContent();
  }
  if (state.subject === "化学") {
    syncChemistryFeCuSO4Content();
  }
  if (state.subject === "数学") {
    syncMathContent();
  }
  config().params.forEach((param, index) => {
    elements.paramValues[index].textContent = formatParam(param, index === 0 ? state.p1 : state.p2);
  });
  elements.totalTime.textContent = formatTime(duration());

  if (state.subject === "物理") {
    const stop = (state.p1 * state.p1) / (2 * state.p2);
    const content = buildPhysicsBrakeContent();
    elements.stopDistanceLabel.textContent = `${content.stopDistanceText} m`;
    setPhysicsStopMarker(stop);
    updateFormulaSpotlight("物理");
    if (state.hasGenerated) {
      if (options.syncQuestion) syncPhysicsQuestionFromState();
      renderReasoning();
      elements.mentorMessage.innerHTML = config().mentor;
      setRecognitionFeedback({ ok: true, v0: state.p1, aAbs: state.p2 });
    }
  }

  if (state.subject === "化学") {
    const content = buildChemistryFeCuSO4Content();
    updateFormulaSpotlight("化学");
    elements.sceneTip.innerHTML = `<span>定量结论</span>${content.sceneTip}`;
    if (state.hasGenerated) {
      if (options.syncQuestion) syncSubjectQuestionFromState("化学");
      renderReasoning();
      elements.mentorMessage.innerHTML = config().mentor;
      setRecognitionFeedback({ ok: true, subject: "化学", type: "fe_cuso4_stoichiometry", recognitionText: content.recognitionText });
    }
  }

  if (state.subject === "数学") {
    updateFormulaSpotlight("数学");
    if (state.hasGenerated) {
      if (options.syncQuestion) syncSubjectQuestionFromState("数学");
      renderReasoning();
      elements.mentorMessage.innerHTML = config().mentor;
      setRecognitionFeedback(parseMathTangentQuestion($("#questionInput").value || buildMathQuestionText()));
    }
  }

  if (state.subject === "生物") {
    setCellRotation(-8, state.p1);
    updateFormulaSpotlight("生物");
    if (state.hasGenerated) {
      if (options.syncQuestion) syncSubjectQuestionFromState("生物");
      renderReasoning();
      elements.mentorMessage.innerHTML = config().mentor;
      setRecognitionFeedback(biologyTemplateRecognition());
      renderCellDetail(state.selectedOrganelle);
    }
  }
  if (reset) resetExperiment();
}

function applySubject(subject, updateQuestion = true, options = {}) {
  clearDemoTimers();
  pauseExperiment();
  document.body.classList.remove("awaiting-generation");
  state.hasGenerated = true;
  state.subject = subject;
  updateSubjectBodyClass(subject);
  const restored = options.restore && restoreSubjectSnapshot(subject);
  if (subject === "物理" && updateQuestion && !restored) {
    state.p1 = 20;
    state.p2 = 5;
    syncPhysicsBrakeContent();
  }
  if (subject === "化学" && updateQuestion && !restored) {
    state.p1 = 5.6;
    state.p2 = 0.2;
    syncChemistryFeCuSO4Content();
  }
  if (subject === "数学" && updateQuestion && !restored) {
    state.p1 = 3;
    state.p2 = 1;
    syncMathContent(3);
  }
  if (subject === "生物" && updateQuestion && !restored) {
    syncBiologyContent(state.cellType || "plant");
    state.p1 = -10;
    state.p2 = 6;
    state.selectedOrganelle = defaultOrganelleForCellType();
    resetBiologyCellModel();
  }
  state.reasonStep = 1;
  state.favorite = false;
  updateFormulaSpotlight(subject);
  hideMentorFeedback();
  const current = config();
  $(".side-card-header .section-kicker").textContent = subject === "生物" ? "结构 × 功能联动" : "公式 × 过程联动";
  $(".side-card-header h2").textContent = subject === "生物" ? "结构识别路径" : "解题思维链";

  setActiveSubjectTab(subject);
  if (subject !== "物理") clearRecognitionFeedback();
  if (updateQuestion) $("#questionInput").value = restored ? state.generatedQuestion : current.question;
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
  if (restored && state.generatedQuestion) {
    $("#problemText").textContent = state.generatedQuestion;
    setRecognitionFeedback(
      subject === "物理" ? { ok: true, v0: state.p1, aAbs: state.p2 } :
      subject === "化学" ? { ok: true, recognitionText: buildChemistryFeCuSO4Content().recognitionText } :
      subject === "数学" ? parseMathTangentQuestion(state.generatedQuestion) :
      biologyTemplateRecognition()
    );
  }
}

function playExperiment() {
  if (state.time >= duration()) state.time = 0;
  state.playing = true;
  state.lastFrame = performance.now();
  elements.playButton.classList.add("playing");
  if (document.body.classList.contains("demo-mode")) setDemoStep(4, "看见速度如何归零");
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
    "化学": buildChemistryFeCuSO4Content().sceneTip,
    "数学": `观察 x = ${smartNumber(state.p1)} 时，导数 y′ = 2x 如何给出切线斜率。`,
    "生物": `点击模型中的${selectedOrganelle().name}，查看结构类型、主要功能和记忆点。`
  };
  const tipLabel = state.subject === "化学" ? "实验现象" : "观察提示";
  elements.sceneTip.innerHTML = `<span>${tipLabel}</span>${tips[state.subject]}`;
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
  const stages = state.generationStages || GENERATION_STAGES;
  const stage = stages[index];
  if (!stage) return;
  elements.generationStatus.textContent = stage.text;
  elements.generationProgress.style.width = `${stage.progress}%`;
  $$(".generation-steps span").forEach((item, itemIndex) => {
    item.classList.toggle("active", itemIndex <= index);
  });
}

function showGenerationOverlay(stages = null) {
  clearGenerationTimers();
  state.generationStages = stages;
  setDemoStep(2, "识别题干并匹配实验");
  elements.generationOverlay.classList.add("show");
  elements.generationOverlay.setAttribute("aria-hidden", "false");
  const activeStages = state.generationStages || GENERATION_STAGES;
  $$(".generation-steps span").forEach((item, index) => {
    item.textContent = activeStages[index]?.label || GENERATION_STAGES[index]?.label || item.textContent;
  });
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
  state.generationStages = null;
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
  setDemoStep(3, "观察实验过程");
  const content = buildPhysicsBrakeContent();
  const vText = smartNumber(state.p1);
  const aText = smartNumber(state.p2);
  const sText = content.stopDistanceText;
  const playStartMs = 820;
  const experimentMs = (duration() / state.playbackRate) * 1000;
  const solveMs = playStartMs + Math.max(1200, experimentMs * 0.38);
  const verifyMs = playStartMs + Math.max(2400, experimentMs * 0.72);
  const finishMs = playStartMs + experimentMs + 160;
  setReasoningStep(1, `<span>观察目标</span>先看速度如何从 ${vText}m/s 逐步归零。`);
  state.demoTimers = [
    setTimeout(() => setReasoningStep(2, "<span>公式选择</span>没有给时间 t，直接用速度—位移关系式。"), 520),
    setTimeout(() => playExperiment(), 820),
    setTimeout(() => setReasoningStep(3, `<span>代入求解</span>0² − ${vText}² = 2 × (−${aText}) × s，所以 s = ${sText}m。`), solveMs),
    setTimeout(() => setReasoningStep(4, `<span>现象验证</span>小车速度归零时，停止点对应 ${sText}m。`), verifyMs),
    setTimeout(() => {
      state.time = duration();
      updateScene();
      setReasoningStep(4, `<span>现象验证</span>速度归零，刹车距离稳定对应 ${sText}m。`);
    }, finishMs)
  ];
}

function detectSubject(question) {
  if (/反应|浓度|溶液|化学|铁粉|硫酸铜|CuSO|Fe\b|生成铜|生成 Cu/i.test(question)) return "化学";
  if (/函数|抛物线|斜率|切线|数学/.test(question)) return "数学";
  if (/细胞|生物|植物|动物|亚显微|细胞壁|细胞膜|细胞核|液泡|叶绿体|线粒体|细胞质|内质网|高尔基体|核糖体|DNA/.test(question)) return "生物";
  if (/汽车|车辆|速度|加速度|减速度|刹车|制动|停止|运动|受力|落下|物理/.test(question)) return "物理";
  return state.subject;
}

function getGenerationSubject(question) {
  const selectedPreset = SUBJECTS[state.subject]?.question;
  if (selectedPreset && question === selectedPreset) return state.subject;
  return detectSubject(question);
}

elements.playButton.addEventListener("click", () => {
  if (state.subject === "生物") {
    showToast("生物模型支持拖动旋转和点击识别，无需播放进度");
    return;
  }
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
  updateParameters(true, { syncQuestion: true });
}));

$$(".number-control button").forEach(button => {
  button.addEventListener("click", () => {
    const input = $(`#${button.dataset.target}`);
    const next = Number(input.value) + Number(button.dataset.delta) * Number(input.step);
    input.value = Math.max(Number(input.min), Math.min(Number(input.max), next));
    clearDemoTimers();
    updateParameters(true, { syncQuestion: true });
  });
});

$$("[data-toast]").forEach(button => button.addEventListener("click", () => showToast(button.dataset.toast)));

$("#questionInput").addEventListener("input", () => {
  if (!state.hasGenerated) {
    clearRecognitionFeedback();
    return;
  }
  const currentQuestion = $("#questionInput").value.trim();
  if (currentQuestion && currentQuestion !== state.generatedQuestion) {
    pauseExperiment();
    clearDemoTimers();
    setRecognitionPending();
    hideMentorFeedback();
    $("#problemText").textContent = "题目已修改，点击“生成实验”后将重新识别并更新实验。";
    setDemoStep(2, "题目已修改，等待重新生成");
  }
});

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
    const targetSubject = button.dataset.subject;
    saveCurrentSubjectSnapshot();
    if (state.generatedSubjects.has(targetSubject)) {
      applySubject(targetSubject, true, { restore: true });
      showToast(`已切换到${targetSubject}实验`);
      return;
    }
    applyWaitingState(targetSubject, { presetQuestion: true });
    showToast(`已切换到${targetSubject}预设题，点击生成实验`);
  });
});

function syncBiologyRotationUi() {
  if (state.subject !== "生物") return;
  state.p1 = Math.round(state.cellRotateY);
  if (elements.ranges[0]) elements.ranges[0].value = state.p1;
  if (elements.paramValues[0]) elements.paramValues[0].textContent = `${state.p1}`;
  if (state.hasGenerated) updateScene();
}

$$(".cell-organelle").forEach(node => {
  const chooseOrganelle = event => {
    event.stopPropagation();
    selectBioOrganelle(node.dataset.organelle);
  };
  node.addEventListener("click", chooseOrganelle);
  node.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") chooseOrganelle(event);
  });
});

$$(".cell-structure-tag").forEach(tag => {
  tag.addEventListener("pointerdown", event => event.stopPropagation());
  tag.addEventListener("pointerenter", () => tag.classList.add("hover"));
  tag.addEventListener("pointerleave", () => tag.classList.remove("hover"));
  tag.addEventListener("click", event => {
    event.stopPropagation();
    selectBioOrganelle(tag.dataset.organelle);
  });
});

function selectNearestBioOrganelle(clientX, clientY) {
  const candidates = $$(".cell-organelle").filter(node => {
    if (!currentCellOrganelleMap().has(node.dataset.organelle)) return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }).map(node => {
    const rect = node.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return {
      node,
      distance: Math.hypot(clientX - cx, clientY - cy)
    };
  }).sort((a, b) => a.distance - b.distance);
  const match = candidates[0];
  if (match && match.distance < 76) selectBioOrganelle(match.node.dataset.organelle);
}

function clearBioHoverLabels() {
  $$(".cell-organelle.hover, .cell-structure-tag.hover").forEach(node => node.classList.remove("hover"));
}

function updateBioHoverLabel(clientX, clientY) {
  if (state.subject !== "生物" || !state.hasGenerated) return;
  const targets = [...$$(".cell-structure-tag"), ...$$(".cell-organelle")];
  let hovered = null;
  for (const node of targets) {
    if (node.classList.contains("unavailable")) continue;
    const rect = node.getBoundingClientRect();
    if (
      rect.width > 0 &&
      rect.height > 0 &&
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    ) {
      hovered = node;
      break;
    }
  }
  clearBioHoverLabels();
  if (hovered) hovered.classList.add("hover");
}

if (elements.plantCellViewport) {
  elements.plantCellViewport.addEventListener("mousemove", event => {
    updateBioHoverLabel(event.clientX, event.clientY);
  });

  elements.plantCellViewport.addEventListener("mouseleave", clearBioHoverLabels);

  elements.plantCellViewport.addEventListener("pointerdown", event => {
    if (state.subject !== "生物" || !state.hasGenerated) return;
    setCellAutoRotate(false);
    state.cellDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      directOrganelle: event.target.closest(".cell-organelle, .cell-structure-tag")?.dataset.organelle || "",
      distance: 0,
      rotateX: state.cellRotateX,
      rotateY: state.cellRotateY
    };
    elements.plantCellViewport.setPointerCapture(event.pointerId);
  });

  elements.plantCellViewport.addEventListener("pointermove", event => {
    if (!state.cellDrag || state.cellDrag.pointerId !== event.pointerId) return;
    const dx = event.clientX - state.cellDrag.startX;
    const dy = event.clientY - state.cellDrag.startY;
    state.cellDrag.distance = Math.max(state.cellDrag.distance || 0, Math.hypot(dx, dy));
    setCellRotation(state.cellDrag.rotateX - dy * 0.12, state.cellDrag.rotateY + dx * 0.42);
    syncBiologyRotationUi();
  });

  const endCellDrag = event => {
    if (!state.cellDrag || state.cellDrag.pointerId !== event.pointerId) return;
    const wasTap = (state.cellDrag.distance || 0) < 8;
    const directOrganelle = state.cellDrag.directOrganelle;
    state.cellDrag = null;
    if (elements.plantCellViewport.hasPointerCapture(event.pointerId)) {
      elements.plantCellViewport.releasePointerCapture(event.pointerId);
    }
    if (wasTap) {
      if (directOrganelle) selectBioOrganelle(directOrganelle);
      else selectNearestBioOrganelle(event.clientX, event.clientY);
    }
  };
  elements.plantCellViewport.addEventListener("pointerup", endCellDrag);
  elements.plantCellViewport.addEventListener("pointercancel", endCellDrag);
}

elements.cellResetButton?.addEventListener("click", event => {
  event.stopPropagation();
  if (state.subject !== "生物") return;
  resetBiologyCellModel();
  syncBiologyRotationUi();
  showToast(`已重置${CELL_TYPE_LABELS[state.cellType] || "细胞"}观察视角`);
});

elements.cellAutoButton?.addEventListener("click", event => {
  event.stopPropagation();
  if (state.subject !== "生物") return;
  setCellAutoRotate(!state.cellAutoRotate);
  showToast(state.cellAutoRotate ? `${CELL_TYPE_LABELS[state.cellType] || "细胞"}模型开始自动旋转` : "已暂停自动旋转");
});

$("#generateButton").addEventListener("click", async () => {
  const button = $("#generateButton");
  if (button.classList.contains("loading")) return;
  state.userGeneratedOnce = true;
  if (state.autoDemoTimer) clearTimeout(state.autoDemoTimer);
  let question = $("#questionInput").value.trim();
  if (!question) {
    showToast("请先输入一道理科题目");
    return;
  }

  const detected = getGenerationSubject(question);
  let physicsParse = null;
  let chemistryParse = null;
  let mathParse = null;
  let templateRecognition = null;
  if (detected === "物理") {
    physicsParse = parsePhysicsBrakeQuestion(question);
    if (!physicsParse.ok) {
      setRecognitionFeedback(physicsParse, true);
      showToast(physicsParse.message);
      return;
    }
    state.subject = "物理";
    state.p1 = physicsParse.v0;
    state.p2 = physicsParse.aAbs;
    syncPhysicsBrakeContent(physicsParse.v0, physicsParse.aAbs);
    syncPhysicsControlsFromState();
    setRecognitionFeedback(physicsParse);
  }
  if (detected === "化学") {
    chemistryParse = parseChemistryFeCuSO4Question(question);
    if (!chemistryParse.ok) {
      setRecognitionFeedback(chemistryParse, true);
      showToast(chemistryParse.message);
      return;
    }
    state.subject = "化学";
    state.p1 = chemistryParse.feMass;
    state.p2 = chemistryParse.cuso4Mol;
    syncChemistryFeCuSO4Content(chemistryParse.feMass, chemistryParse.cuso4Mol);
    setRecognitionFeedback(chemistryParse);
  }
  if (detected === "数学") {
    mathParse = parseMathTangentQuestion(question);
    if (!mathParse.ok) {
      setRecognitionFeedback(mathParse, true);
      showToast(mathParse.message);
      return;
    }
    state.subject = "数学";
    state.p1 = mathParse.x;
    state.p2 = SUBJECTS["数学"].params[1].value;
    syncMathContent(mathParse.x);
    setRecognitionFeedback(mathParse);
  }
  if (detected === "生物") {
    const cellType = normalizeBiologyCellType(question);
    state.cellType = cellType;
    syncBiologyContent(cellType);
    templateRecognition = biologyTemplateRecognition();
    state.subject = "生物";
    state.p1 = -10;
    state.p2 = 6;
    state.selectedOrganelle = defaultOrganelleForCellType(cellType);
    resetBiologyCellModel();
    setRecognitionFeedback(templateRecognition);
  }

  clearDemoTimers();
  button.classList.add("loading");
  $("span", button).textContent = "生成中";
  const generationStages = physicsParse
    ? SUBJECTS["物理"].generationStages
    : chemistryParse
      ? SUBJECTS["化学"].generationStages
      : templateRecognition
        ? SUBJECTS["生物"].generationStages
      : null;
  await showGenerationOverlay(generationStages);
  applySubject(detected, false);
  $("#problemText").textContent = question;
  state.generatedQuestion = question;
  if (physicsParse) setRecognitionFeedback(physicsParse);
  if (chemistryParse) setRecognitionFeedback(chemistryParse);
  if (mathParse) setRecognitionFeedback(mathParse);
  if (templateRecognition) setRecognitionFeedback(templateRecognition);
  state.generatedSubjects.add(detected);
  saveCurrentSubjectSnapshot();
  state.generated = Math.min(3, state.generated + 1);
  button.classList.remove("loading");
  $("span", button).textContent = "生成实验";
  hideGenerationOverlay();
  clearDemoTimers();
  resetExperiment();
  setDemoStep(3, "点击播放或请求 AI 导师提示");
  showToast(detected === "生物" ? "生物模型已生成，可拖动旋转或点击结构识别" : `${detected}实验已生成，点击播放开始观察`);
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
  if (!state.hasGenerated) {
    showToast("请先生成实验，再向 AI 导师提问");
    return;
  }
  setDemoStep(5, "AI 导师追问与迁移");
  elements.mentorMessage.innerHTML = config().hint;
  if (state.subject === "物理") {
    updateFormulaSpotlight("物理");
    setReasoningStep(2, `<span>AI 提示</span>题目没有给时间 t，先找不含 t 的速度—位移公式。`);
    showMentorFormulaFeedback();
    showToast("核心公式已浮现");
    return;
  }
  if (state.subject === "生物") {
    const tip = state.cellType === "animal"
      ? "先抓动物细胞特征：没有细胞壁，通常没有叶绿体和中央大液泡，最外层是细胞膜。"
      : "先抓典型植物细胞特征：细胞壁、叶绿体和成熟细胞中较大的中央液泡。";
    setReasoningStep(4, `<span>AI 提示</span>${tip}`);
    hideMentorFeedback();
    showToast("AI 导师已给出结构识别提示");
    return;
  }
  hideMentorFeedback();
  showToast("AI 导师给出了一条启发式提示");
});

$("#challengeButton").addEventListener("click", () => {
  if (!state.hasGenerated) {
    showToast("请先生成实验，再加载变式挑战");
    return;
  }
  setDemoStep(5, "AI 导师追问与迁移");
  clearDemoTimers();

  if (state.subject === "物理") {
    const previous = physicsBrakeModel();
    const nextV = nextPhysicsChallengeSpeed(state.p1);
    const nextA = state.p2;
    const question = buildPhysicsBrakeQuestionText(nextV, nextA);
    const next = physicsBrakeModel(nextV, nextA);

    $("#questionInput").value = question;
    $("#problemText").textContent = question;
    state.generatedQuestion = question;
    state.p1 = nextV;
    state.p2 = nextA;
    syncPhysicsBrakeContent(nextV, nextA);
    syncPhysicsControlsFromState();
    updateFormulaSpotlight("物理");
    setRecognitionFeedback({ ok: true, v0: nextV, aAbs: nextA });
    setReasoningStep(3, `<span>变式挑战</span>题目参数已更新，先预测停止距离会怎样变化。`);
    elements.mentorMessage.innerHTML = `我已把题目改成初速度 <strong>${smartNumber(nextV)}m/s</strong>、加速度 <strong>−${smartNumber(nextA)}m/s²</strong>。先别急着播放，预测一下停止距离为什么会变成 <strong>${smartNumber(next.stopDistance)}m</strong>？`;
    showMentorChallengeFeedback(previous, next);
    showToast(`变式题已同步：停止距离 ${smartNumber(next.stopDistance)}m`);
    return;
  }

  if (state.subject === "化学") {
    elements.ranges[0].value = 11.2;
    elements.ranges[1].value = 0.2;
    updateParameters(true, { syncQuestion: true });
    const content = buildChemistryFeCuSO4Content();
    setReasoningStep(3, `<span>变式挑战</span>铁粉增加到 11.2g，重新判断限量反应物。`);
    elements.mentorMessage.innerHTML = `铁粉增加到 <strong>11.2g</strong> 后，n(Fe)=0.20mol，CuSO₄ 仍为 0.20mol，所以 <strong>${chemistryReactionJudgement(content.model).short}</strong>，生成 Cu <strong>${formatMol(content.model.cuMol)}mol / ${formatGram(content.model.cuMass)}g</strong>。`;
    showToast("化学变式题已同步");
    return;
  }

  if (state.subject === "数学") {
    elements.ranges[0].value = 5;
    updateParameters(true, { syncQuestion: true });
    setReasoningStep(3, "<span>变式挑战</span>x = 5 时，k = 2 × 5 = 10。");
    elements.mentorMessage.innerHTML = "如果 <strong>x = 5</strong>，代入 y′ = 2x，可得切线斜率 <strong>k = 10</strong>。";
    showToast("数学变式题已同步：k = 10");
    return;
  }

  if (state.subject === "生物") {
    const nextType = state.cellType === "animal" ? "plant" : "animal";
    switchBiologyCellType(nextType);
    const label = CELL_TYPE_LABELS[nextType];
    setReasoningStep(4, `<span>对比迁移</span>已切换到${label}，观察它与${nextType === "animal" ? "植物" : "动物"}细胞的结构差异。`);
    elements.mentorMessage.innerHTML = nextType === "animal"
      ? "已切换到 <strong>动物细胞</strong>。请对比：动物细胞为什么没有细胞壁，通常也没有叶绿体和中央大液泡？"
      : "已切换到 <strong>植物细胞</strong>。请对比：典型植物细胞中的细胞壁、叶绿体和大液泡分别对应什么功能？";
    showToast(`AI 导师已切换到${label}对比模型`);
    return;
  }

  const challengeMessage = config().challenge;
  const challengeValues = { "物理": 30, "化学": 55, "数学": 2, "生物": 37 };
  const rangeIndex = state.subject === "物理" || state.subject === "生物" ? 0 : 1;
  const nextValue = state.subject === "物理"
    ? Math.min(PHYSICS_BRAKE_LIMITS.speedMax, Math.round(state.p1 * 1.5))
    : challengeValues[state.subject];
  elements.ranges[rangeIndex].value = nextValue;
  updateParameters();
  elements.mentorMessage.innerHTML = challengeMessage;
  hideMentorFeedback();
  showToast("变式挑战已加载");
});

$$(".history-item").forEach(item => {
  item.addEventListener("click", () => {
    applyWaitingState(item.dataset.subject);
    $("#questionInput").value = item.dataset.question;
    window.scrollTo({ top: 0, behavior: "smooth" });
    showToast(`${item.dataset.subject}历史题目已载入，点击生成实验开始建模`);
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
    if (state.subject === "生物") return;
    state.playing ? pauseExperiment() : playExperiment();
  }
  if (event.code === "Escape") closeModal();
});

window.addEventListener("resize", () => {
  if (state.subject !== "物理") return;
  setPhysicsStopMarker();
  updateScene();
});

updateGreeting();
applyWaitingState("物理", { presetQuestion: true });
setDemoStep(1, "输入题目，生成实验");
if (document.body.classList.contains("demo-mode")) {
  scheduleAutoDemo();
}

window.addEventListener("pageshow", event => {
  if (!event.persisted) return;
  updateGreeting();
  applyWaitingState("物理", { presetQuestion: true });
});
