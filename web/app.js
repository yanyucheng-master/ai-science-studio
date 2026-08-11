const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

function fractionHtml(numerator, denominator) {
  return `<span class="vfrac"><span class="vfrac-num">${numerator}</span><span class="vfrac-den">${denominator}</span></span>`;
}

function sqrtHtml(content) {
  return `<span class="sqrt-formula"><span class="sqrt-sign">√</span><span class="sqrt-radicand">${content}</span></span>`;
}

function verticalizeFormulaHtml(value) {
  let html = String(value ?? "");
  const replacements = [
    [/√\(2h\/g\)/g, sqrtHtml(fractionHtml("2h", "g"))],
    [/1\/\(2√x\)/g, fractionHtml("1", "2√x")],
    [/1\/f/g, fractionHtml("1", "f")],
    [/1\/u/g, fractionHtml("1", "u")],
    [/1\/v/g, fractionHtml("1", "v")],
    [/1\/x/g, fractionHtml("1", "x")],
    [/uf\/\(u−f\)/g, fractionHtml("uf", "u−f")],
    [/2h\/g/g, fractionHtml("2h", "g")],
    [/1\/2(?=g?t²|gt²|g)/g, fractionHtml("1", "2")],
    [/U\s*\/\s*\(R₁\s*\+\s*R₂\)/g, fractionHtml("U", "R₁ + R₂")],
    [/U\s*\/\s*R(?![₁₂A-Za-z0-9])/g, fractionHtml("U", "R")],
    [/W有\s*\/\s*W总/g, fractionHtml("W有", "W总")],
    [/Gh\s*\/\s*Fs/g, fractionHtml("Gh", "Fs")],
    [/G\/\(nF\)/g, fractionHtml("G", "nF")],
    [/v₀²\/\(2μg\)/g, fractionHtml("v₀²", "2μg")],
    [/m\s*v₀\/k/g, fractionHtml("mv₀", "k")],
    [/dv\/dt/g, fractionHtml("dv", "dt")],
    [/kt\/m/g, fractionHtml("kt", "m")],
    [/k\/m/g, fractionHtml("k", "m")],
    [/m\/k/g, fractionHtml("m", "k")],
    [/f\/m/g, fractionHtml("f", "m")]
  ];
  replacements.forEach(([pattern, replacement]) => {
    html = html.replace(pattern, replacement);
  });
  return html;
}

function setFormulaHtml(element, html) {
  if (!element) return;
  element.innerHTML = verticalizeFormulaHtml(html);
}

function observeFormulaContainer(element) {
  if (!element) return;
  const observer = new MutationObserver(() => {
    if (element.dataset.formulaFormatting === "1") return;
    const formatted = verticalizeFormulaHtml(element.innerHTML);
    if (formatted === element.innerHTML) return;
    element.dataset.formulaFormatting = "1";
    element.innerHTML = formatted;
    delete element.dataset.formulaFormatting;
  });
  observer.observe(element, { childList: true, subtree: true, characterData: true });
}

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
    metrics: [["点 P 横坐标", ""], ["切线斜率 k", ""], ["函数值 y", ""]],
    params: [
      { label: "观察点横坐标 x", desc: "拖动观察斜率 k = 2x", unit: "", min: -5, max: 5, step: 1, value: 3 },
      { label: "静态观察模式", desc: "本题不需要播放进度", unit: "", min: 1, max: 1, step: 1, value: 1 }
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

const FAVORITES_STORAGE_KEY = "master-lab-favorites-v1";
const FAVORITE_LIMIT = 8;
const FAVORITE_VISUALS = new Set(["brake", "gravity", "solenoid", "circuit", "flask", "math", "cell", "physics"]);
const DEFAULT_FAVORITES = Object.freeze([
  {
    subject: "物理",
    question: SUBJECTS["物理"].question,
    title: "刹车距离实验 · 速度如何归零",
    detail: "物理 · 运动学模板",
    visual: "brake"
  },
  {
    subject: "化学",
    question: SUBJECTS["化学"].question,
    title: "铁与硫酸铜定量反应",
    detail: "化学 · 定量反应模板",
    visual: "flask"
  }
]);

const state = {
  subject: "物理",
  playing: false,
  time: 0,
  lastFrame: 0,
  p1: 20,
  p2: 5,
  physicsTemplate: "brake",
  brakeMode: "constant",
  brakeGravity: 9.8,
  brakeMass: 1000,
  boardSliderParams: {
    blockMass: 1,
    boardMass: 1,
    boardLength: 2,
    frictionCoefficient: 0.2,
    initialSpeed: 4,
    gravity: 10,
    gravityWasDefaulted: false
  },
  solenoidViewEnd: "left",
  solenoidWindingDirection: "counterclockwise",
  solenoidHasCore: false,
  solenoidPaused: false,
  solenoidRotateX: 0,
  solenoidRotateY: 0,
  solenoidZoom: 1,
  solenoidDrag: null,
  solenoidCanvasReady: false,
  playbackRate: 1,
  reasonStep: 1,
  hasGenerated: false,
  generatedQuestion: "",
  generatedSubjects: new Set(),
  subjectSnapshots: {},
  generated: 2,
  favorite: false,
  mathModel: null,
  cellType: "plant",
  selectedOrganelle: "nucleus",
  cellRotateX: -4,
  cellRotateY: -10,
  cellAutoRotate: false,
  cellDrag: null,
  toastTimer: null,
  demoTimers: [],
  reasoningTimers: [],
  reasoningAutoRun: 0,
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

const SOLENOID_LIMITS = {
  currentMin: 0.1,
  currentMax: 2,
  turnsMin: 100,
  turnsMax: 500
};

const PHYSICS_FRICTION_BRAKE_LIMITS = {
  muMin: 0.05,
  muMax: 1.2,
  gravityMin: 9.8,
  gravityMax: 10
};

const PHYSICS_LINEAR_DRAG_LIMITS = {
  kMin: 20,
  kMax: 2000,
  massMin: 100,
  massMax: 5000,
  durationMin: 1,
  durationMax: 60,
  endSpeedRatio: 0.01
};

const BOARD_SLIDER_DEFAULTS = Object.freeze({
  blockMass: 1,
  boardMass: 1,
  boardLength: 2,
  frictionCoefficient: 0.2,
  initialSpeed: 4,
  gravity: 10,
  gravityWasDefaulted: false
});

const BOARD_SLIDER_LIMITS = Object.freeze({
  blockMassMin: 0.1,
  blockMassMax: 10,
  boardMassMin: 0.1,
  boardMassMax: 20,
  boardLengthMin: 1,
  boardLengthMax: 5,
  frictionMin: 0.05,
  frictionMax: 0.8,
  speedMin: 1,
  speedMax: 8,
  gravityMin: 9.8,
  gravityMax: 10,
  epsilon: 1e-6
});

const BOARD_SLIDER_DEFAULT_QUESTION = "光滑水平地面上放有一块质量为1.0kg、长度为2.0m的木板B。质量为1.0kg的滑块A可视为质点，最初位于木板左端，以4.0m/s的初速度沿木板向右滑动。滑块与木板间的动摩擦因数为0.20，取g=10m/s²。求滑块和木板的加速度、达到共同速度所需时间，并判断滑块是否会从木板右端滑落。";

const PROJECTILE_LIMITS = {
  speedMin: 2,
  speedMax: 30,
  heightMin: 1,
  heightMax: 80,
  gravity: 9.8
};

const CIRCUIT_LIMITS = {
  voltageMin: 1,
  voltageMax: 24,
  resistanceMin: 1,
  resistanceMax: 20
};

const EXTRA_PHYSICS_TEMPLATES = window.EXTRA_PHYSICS_TEMPLATES || {};
const EXTRA_PHYSICS_IDS = Object.keys(EXTRA_PHYSICS_TEMPLATES);

function isExtraPhysicsTemplate(id = state.physicsTemplate) {
  return Boolean(EXTRA_PHYSICS_TEMPLATES[id]);
}

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
  experimentCard: $(".experiment-card"),
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
  stopDistanceCaption: $("#distanceFlag span"),
  brakeModelIndicator: $("#brakeModelIndicator"),
  brakeModelLabel: $("#brakeModelLabel"),
  brakeModelFormula: $("#brakeModelFormula"),
  boardSliderStage: $("#boardSliderStage"),
  boardSliderWorld: $("#boardSliderWorld"),
  boardSliderBoard: $("#boardSliderBoard"),
  boardSliderBlock: $("#boardSliderBlock"),
  boardSliderTrace: $("#boardSliderTrace"),
  boardSliderStatus: $("#boardSliderStatus"),
  boardSliderRelation: $("#boardSliderRelation"),
  boardSliderFrictionText: $("#boardSliderFrictionText"),
  boardSliderRelativeText: $("#boardSliderRelativeText"),
  boardSliderBlockSpeed: $("#boardSliderBlockSpeed"),
  boardSliderBoardSpeed: $("#boardSliderBoardSpeed"),
  boardSliderBlockMass: $("#boardSliderBlockMass"),
  boardSliderBoardMass: $("#boardSliderBoardMass"),
  boardSliderMu: $("#boardSliderMu"),
  boardSliderGravity: $("#boardSliderGravity"),
  sceneTip: $("#sceneTip"),
  mentorMessage: $("#mentorMessage"),
  mentorFeedback: $("#mentorFeedback"),
  parseFeedback: $("#parseFeedback"),
  fullscreenButtons: [$("#fullscreenButton"), $("#sceneFullscreenButton")].filter(Boolean),
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
  solenoidCanvas: $("#solenoidCanvas"),
  projectileBall: $("#projectileBall"),
  projectileShadow: $("#projectileShadow"),
  projectileHeightText: $("#projectileHeightText"),
  projectileResultText: $("#projectileResultText"),
  projectileTimeText: $("#projectileTimeText"),
  projectileRangeText: $("#projectileRangeText"),
  projectileVyText: $("#projectileVyText"),
  circuitVoltageText: $("#circuitVoltageText"),
  circuitVoltmeterText: $("#circuitVoltmeterText"),
  circuitResistanceText: $("#circuitResistanceText"),
  circuitCurrentText: $("#circuitCurrentText"),
  circuitResultText: $("#circuitResultText"),
  circuitReadoutVoltage: $("#circuitReadoutVoltage"),
  circuitReadoutResistance: $("#circuitReadoutResistance"),
  circuitReadoutCurrent: $("#circuitReadoutCurrent"),
  circuitPowerText: $("#circuitPowerText"),
  circuitResistor: $("#circuitResistor"),
  genericPhysicsVisual: $("#genericPhysicsVisual"),
  genericPhysicsMeta: $("#genericPhysicsMeta"),
  genericPhysicsResult: $("#genericPhysicsResult"),
  genericPhysicsDescription: $("#genericPhysicsDescription"),
  genericPhysicsFacts: $("#genericPhysicsFacts"),
  toast: $("#toast"),
  generationOverlay: $("#generationOverlay"),
  generationStatus: $("#generationStatus"),
  generationProgress: $("#generationProgress"),
  demoStepIndicator: $("#demoStepIndicator")
};

[
  elements.sceneTip,
  elements.mentorMessage,
  elements.mentorFeedback,
  elements.parseFeedback,
  $("#problemText"),
  elements.generationStatus
].forEach(observeFormulaContainer);

const GENERATION_STAGES = [
  { label: "识别条件", text: "识别题干条件与问题目标", progress: 28 },
  { label: "匹配实验模板", text: "匹配可视化实验模板", progress: 63 },
  { label: "生成实验场景", text: "生成实验场景、公式与思维链", progress: 100 }
];

function config() {
  return SUBJECTS[state.subject];
}

function normalizeFavoriteQuestion(question) {
  return String(question || "").replace(/\s+/g, " ").trim().slice(0, 1200);
}

function favoriteRecordId(subject, question) {
  return `${subject}::${encodeURIComponent(normalizeFavoriteQuestion(question))}`;
}

function sanitizeFavoriteRecord(record) {
  const subject = typeof record?.subject === "string" && SUBJECTS[record.subject] ? record.subject : "";
  const question = normalizeFavoriteQuestion(record?.question);
  if (!subject || !question) return null;
  const title = String(record?.title || SUBJECTS[subject].title || "已收藏实验").trim().slice(0, 80);
  const detail = String(record?.detail || `${subject} · 典型题型模板`).trim().slice(0, 80);
  const visual = FAVORITE_VISUALS.has(record?.visual) ? record.visual : subject === "化学" ? "flask" : subject === "数学" ? "math" : subject === "生物" ? "cell" : "physics";
  return { id: favoriteRecordId(subject, question), subject, question, title, detail, visual };
}

function loadFavoriteRecords() {
  try {
    const stored = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    const source = stored === null ? DEFAULT_FAVORITES : JSON.parse(stored);
    if (!Array.isArray(source)) return DEFAULT_FAVORITES.map(sanitizeFavoriteRecord).filter(Boolean);
    return source.map(sanitizeFavoriteRecord).filter(Boolean).slice(0, FAVORITE_LIMIT);
  } catch {
    return DEFAULT_FAVORITES.map(sanitizeFavoriteRecord).filter(Boolean);
  }
}

function persistFavoriteRecords() {
  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteRecords));
  } catch {
    showToast("收藏已更新，但当前浏览器无法长期保存");
  }
}

function favoriteVisualForCurrentExperiment() {
  if (state.subject === "化学") return "flask";
  if (state.subject === "数学") return "math";
  if (state.subject === "生物") return "cell";
  if (state.physicsTemplate === "solenoid") return "solenoid";
  if (state.physicsTemplate === "circuit") return "circuit";
  if (state.physicsTemplate === "projectile") return "gravity";
  if (state.physicsTemplate === "brake" || state.physicsTemplate === "boardSlider") return "brake";
  return "physics";
}

function currentFavoriteRecord() {
  const hasActiveExperiment = state.hasGenerated && !document.body.classList.contains("awaiting-generation");
  const question = normalizeFavoriteQuestion(state.generatedQuestion || (hasActiveExperiment ? $("#questionInput")?.value : ""));
  if (!hasActiveExperiment || !question) return null;
  const subject = state.subject;
  const title = String($("#experimentTitle")?.textContent || config()?.title || "实验记录").trim();
  const engine = String($("#engineBadge")?.textContent || "典型题型模板").trim();
  return sanitizeFavoriteRecord({
    subject,
    question,
    title,
    detail: `${subject} · ${engine}`,
    visual: favoriteVisualForCurrentExperiment()
  });
}

function createFavoriteChevron() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "m9 18 6-6-6-6");
  svg.append(path);
  return svg;
}

function renderFavoriteList() {
  const list = $("#favoriteList");
  const empty = $("#favoriteEmpty");
  const count = $("#favoriteCount");
  if (!list || !empty || !count) return;

  count.textContent = `${favoriteRecords.length} 个`;
  empty.hidden = favoriteRecords.length > 0;
  list.replaceChildren();

  favoriteRecords.forEach(record => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-item favorite-item";
    button.dataset.favoriteId = record.id;
    button.dataset.subject = record.subject;
    button.dataset.question = record.question;
    button.setAttribute("aria-label", `载入收藏实验：${record.title}`);

    const visual = document.createElement("span");
    visual.className = `history-visual ${record.visual}`;
    visual.setAttribute("aria-hidden", "true");

    const copy = document.createElement("div");
    const title = document.createElement("strong");
    const detail = document.createElement("small");
    title.textContent = record.title;
    detail.textContent = record.detail;
    copy.append(title, detail);

    button.append(visual, copy, createFavoriteChevron());
    list.append(button);
  });
}

function syncFavoriteState() {
  const current = currentFavoriteRecord();
  state.favorite = Boolean(current && favoriteRecords.some(record => record.id === current.id));
  $$(".favorite-item").forEach(item => {
    item.classList.toggle("current", Boolean(current && item.dataset.favoriteId === current.id));
  });
  [$("#promptFavoriteButton"), $("#favoriteButton")].filter(Boolean).forEach(button => {
    button.classList.toggle("selected", state.favorite);
    button.setAttribute("aria-pressed", String(state.favorite));
    const label = !current ? "生成实验后可收藏" : state.favorite ? "取消收藏当前实验" : "收藏当前实验";
    button.setAttribute("aria-label", label);
    button.title = label;
  });
}

function toggleCurrentFavorite(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  const current = currentFavoriteRecord();
  if (!current) {
    showToast("请先生成实验，再收藏当前实验");
    return;
  }
  const index = favoriteRecords.findIndex(record => record.id === current.id);
  if (index >= 0) {
    favoriteRecords.splice(index, 1);
  } else {
    favoriteRecords.unshift(current);
    favoriteRecords = favoriteRecords.slice(0, FAVORITE_LIMIT);
  }
  persistFavoriteRecords();
  renderFavoriteList();
  syncFavoriteState();
  const trigger = event?.currentTarget;
  if (trigger instanceof HTMLElement) {
    trigger.classList.remove("favorite-pulse");
    void trigger.offsetWidth;
    trigger.classList.add("favorite-pulse");
    window.setTimeout(() => trigger.classList.remove("favorite-pulse"), 520);
  }
  showToast(state.favorite ? "已收藏到右侧实验列表" : "已取消收藏");
}

let favoriteRecords = loadFavoriteRecords();

function updateSubjectBodyClass(subject = state.subject) {
  document.body.classList.toggle("subject-physics-active", subject === "物理");
  document.body.classList.toggle("subject-chemistry-active", subject === "化学");
  document.body.classList.toggle("subject-math-active", subject === "数学");
  document.body.classList.toggle("subject-biology-active", subject === "生物");
  document.body.classList.toggle("subject-solenoid-active", subject === "物理" && state.physicsTemplate === "solenoid" && state.hasGenerated);
  document.body.classList.toggle("subject-circuit-active", subject === "物理" && state.physicsTemplate === "circuit" && state.hasGenerated);
  document.body.classList.toggle("subject-board-slider-active", subject === "物理" && state.physicsTemplate === "boardSlider" && state.hasGenerated);
  document.body.classList.toggle("subject-extra-physics-active", subject === "物理" && isExtraPhysicsTemplate() && state.hasGenerated);
}

function saveCurrentSubjectSnapshot() {
  if (!state.subject || !state.hasGenerated) return;
  state.subjectSnapshots[state.subject] = {
    p1: state.p1,
    p2: state.p2,
    generatedQuestion: state.generatedQuestion || $("#questionInput")?.value || SUBJECTS[state.subject]?.question || "",
    time: state.time,
    physicsTemplate: state.physicsTemplate,
    brakeMode: state.brakeMode,
    brakeGravity: state.brakeGravity,
    brakeMass: state.brakeMass,
    boardSliderParams: { ...state.boardSliderParams },
    solenoidViewEnd: state.solenoidViewEnd,
    solenoidWindingDirection: state.solenoidWindingDirection,
    solenoidHasCore: state.solenoidHasCore,
    solenoidRotateX: state.solenoidRotateX,
    solenoidRotateY: state.solenoidRotateY,
    solenoidZoom: state.solenoidZoom,
    selectedOrganelle: state.selectedOrganelle,
    cellType: state.cellType,
    mathModelSpec: state.mathModel?.spec || null,
    cellRotateX: state.cellRotateX,
    cellRotateY: state.cellRotateY
  };
  syncFavoriteState();
}

function restoreSubjectSnapshot(subject) {
  const snapshot = state.subjectSnapshots[subject];
  if (!snapshot) return false;
  state.p1 = snapshot.p1;
  state.p2 = snapshot.p2;
  state.generatedQuestion = snapshot.generatedQuestion || SUBJECTS[subject]?.question || "";
  state.time = Number.isFinite(snapshot.time) ? snapshot.time : 0;
  if (subject === "物理") {
    state.physicsTemplate = snapshot.physicsTemplate || "brake";
    state.brakeMode = snapshot.brakeMode || "constant";
    state.brakeGravity = snapshot.brakeGravity || 9.8;
    state.brakeMass = snapshot.brakeMass || 1000;
    state.boardSliderParams = { ...BOARD_SLIDER_DEFAULTS, ...(snapshot.boardSliderParams || {}) };
    state.solenoidViewEnd = snapshot.solenoidViewEnd || "left";
    state.solenoidWindingDirection = snapshot.solenoidWindingDirection || "counterclockwise";
    state.solenoidHasCore = Boolean(snapshot.solenoidHasCore);
    state.solenoidRotateX = snapshot.solenoidRotateX || 0;
    state.solenoidRotateY = snapshot.solenoidRotateY || 0;
    state.solenoidZoom = snapshot.solenoidZoom || 1;
    if (state.physicsTemplate === "boardSlider") syncPhysicsBoardSliderContent(state.boardSliderParams);
    else if (state.physicsTemplate === "solenoid") syncPhysicsSolenoidContent();
    else if (state.physicsTemplate === "projectile") syncPhysicsProjectileContent();
    else if (state.physicsTemplate === "circuit") syncPhysicsCircuitContent();
    else if (isExtraPhysicsTemplate(state.physicsTemplate)) syncExtraPhysicsContent(state.physicsTemplate);
    else syncPhysicsBrakeContent();
  }
  if (subject === "生物") {
    state.cellType = snapshot.cellType || "plant";
    state.selectedOrganelle = snapshot.selectedOrganelle || "nucleus";
    syncBiologyContent(state.cellType);
    setCellRotation(snapshot.cellRotateX ?? -4, snapshot.cellRotateY ?? -10);
  }
  if (subject === "数学") {
    state.mathModel = createMathModel(snapshot.mathModelSpec || defaultMathSpec());
    syncMathContent(state.p1, state.mathModel);
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

function linearDragKBounds(mass = state.brakeMass || 1000) {
  const scale = Number(mass) * Math.log(1 / PHYSICS_LINEAR_DRAG_LIMITS.endSpeedRatio);
  const min = Math.max(
    PHYSICS_LINEAR_DRAG_LIMITS.kMin,
    Math.ceil(scale / PHYSICS_LINEAR_DRAG_LIMITS.durationMax / 10) * 10
  );
  const max = Math.min(
    PHYSICS_LINEAR_DRAG_LIMITS.kMax,
    Math.floor(scale / PHYSICS_LINEAR_DRAG_LIMITS.durationMin / 10) * 10
  );
  return { min, max: Math.max(min, max) };
}

function physicsBrakeModel(v0 = state.p1, parameter = state.p2, options = {}) {
  const mode = options.mode || state.brakeMode || "constant";
  if (mode === "friction") {
    const mu = Number(parameter);
    const gravity = Number(options.gravity ?? state.brakeGravity ?? 9.8);
    const aAbs = mu * gravity;
    const stopTime = v0 / aAbs;
    const stopDistance = (v0 * v0) / (2 * aAbs);
    return {
      mode,
      v0,
      parameter: mu,
      mu,
      gravity,
      aAbs,
      stopTime,
      duration: stopTime,
      stopDistance,
      markerLabel: "停止点"
    };
  }

  if (mode === "linear_drag") {
    const k = Number(parameter);
    const mass = Number(options.mass ?? state.brakeMass ?? 1000);
    const endSpeedRatio = PHYSICS_LINEAR_DRAG_LIMITS.endSpeedRatio;
    const tau = mass / k;
    const duration = tau * Math.log(1 / endSpeedRatio);
    const stopDistance = (mass * v0) / k;
    return {
      mode,
      v0,
      parameter: k,
      k,
      mass,
      tau,
      aAbs: (k * v0) / mass,
      stopTime: Infinity,
      duration,
      stopDistance,
      practicalDistance: stopDistance * (1 - endSpeedRatio),
      practicalSpeed: v0 * endSpeedRatio,
      endSpeedRatio,
      markerLabel: "极限位置"
    };
  }

  const aAbs = Number(parameter);
  const stopTime = v0 / aAbs;
  const stopDistance = (v0 * v0) / (2 * aAbs);
  return {
    mode: "constant",
    v0,
    parameter: aAbs,
    aAbs,
    stopTime,
    duration: stopTime,
    stopDistance,
    markerLabel: "停止点"
  };
}

function physicsVisualDistanceMax(stopDistance = physicsBrakeModel().stopDistance) {
  const target = Math.max(40, stopDistance);
  const scales = [40, 80, 120, 160, 240, 320, 480, 640];
  return scales.find(scale => target <= scale) || Math.ceil(target / 160) * 160;
}

function physicsStopLeftPercent(stopDistance = physicsBrakeModel().stopDistance) {
  const roadWidth = physicsRoadWidth();
  const start = clamp(8 + (carNoseOffsetPx() / roadWidth) * 100, 16, 28);
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

function buildPhysicsBrakeContent(v0 = state.p1, parameter = state.p2, options = {}) {
  const model = physicsBrakeModel(v0, parameter, options);
  const vText = smartNumber(model.v0);
  const aText = smartNumber(model.aAbs);
  const tText = smartNumber(model.duration, 2);
  const sText = smartNumber(model.stopDistance);
  const challengeSpeed = smartNumber(model.v0 * 1.5);

  if (model.mode === "friction") {
    const muText = smartNumber(model.mu, 2);
    const gText = smartNumber(model.gravity);
    const frictionAText = String(Number(model.aAbs.toFixed(2)));
    const nextMu = clamp(model.mu + 0.1, PHYSICS_FRICTION_BRAKE_LIMITS.muMin, PHYSICS_FRICTION_BRAKE_LIMITS.muMax);
    return {
      title: "摩擦制动：路面摩擦如何决定刹车距离",
      description: `按水平路面、车轮滑动且摩擦力为主要制动力建模：μ = ${muText}，减速度 μg = ${frictionAText}m/s²，停止距离 ${sText}m。`,
      engine: "摩擦制动典型题模板",
      ar: "网页端展示滑动摩擦、减速度与停止距离的定量关系。",
      params: [
        { label: "初速度 v₀", desc: "调整车辆开始制动时的速度", unit: "m/s", min: PHYSICS_BRAKE_LIMITS.speedMin, max: PHYSICS_BRAKE_LIMITS.speedMax, step: 1, value: model.v0 },
        { label: "动摩擦因数 μ", desc: "水平路面且车轮发生滑动", unit: "", min: PHYSICS_FRICTION_BRAKE_LIMITS.muMin, max: PHYSICS_FRICTION_BRAKE_LIMITS.muMax, step: 0.05, value: model.mu }
      ],
      steps: [
        ["提取条件", `v₀ = ${vText}m/s，μ = ${muText}，g = ${gText}m/s²`, "明确水平路面、滑动摩擦为主要制动力。"],
        ["受力求加速度", `f = μN = μmg，a = −f/m = −μg = −${frictionAText}m/s²`, "质量在求加速度时约去，减速度由 μ 和 g 决定。"],
        ["代入运动学", `0² − ${vText}² = 2×(−${frictionAText})×s`, `计算得到停止距离 s = ${sText}m。`],
        ["现象验证", `速度归零，停止点 ${sText}m`, "路面越粗糙，μ 越大，停止距离越短。"]
      ],
      mentor: `为什么汽车质量没有出现在最终刹车距离中？因为 <strong>f = μmg</strong>，再由 <strong>a = f/m</strong> 得到 <strong>a = μg</strong>。`,
      hint: "先画水平路面受力图：竖直方向 N = mg，水平方向只有与运动方向相反的滑动摩擦力。",
      challenge: `如果动摩擦因数增大到 <strong>${smartNumber(nextMu, 2)}</strong>，停止距离会怎样变化？`,
      generationStages: [
        { label: "识别条件", text: `识别 v₀ = ${vText}m/s，μ = ${muText}，g = ${gText}m/s²`, progress: 28 },
        { label: "建立受力模型", text: `由 f = μN 与 F = ma 得 a = −${aText}m/s²`, progress: 63 },
        { label: "生成制动过程", text: `速度匀减至 0，停止点锁定 ${sText}m`, progress: 100 }
      ],
      recognitionText: `摩擦制动｜v₀ = ${vText}m/s｜μ = ${muText}｜g = ${gText}m/s²｜a = −${frictionAText}m/s²｜停止距离 ${sText}m`,
      formulaLabel: "摩擦制动",
      formula: "f = μN，a = −μg",
      formulaHtml: `N = mg，f = μN = μmg<br>a = −f/m = −μg = −${frictionAText}m/s²<br>s = v₀²/(2μg) = ${sText}m`,
      sceneTip: `水平路面上按滑动摩擦制动建模：μ = ${muText}，速度每秒约减少 ${frictionAText}m/s。`,
      indicatorLabel: "滑动摩擦制动",
      indicatorFormula: `a = −μg = −${frictionAText}m/s²`,
      stopTimeText: tText,
      stopDistanceText: sText,
      model
    };
  }

  if (model.mode === "linear_drag") {
    const kText = smartNumber(model.k);
    const massText = smartNumber(model.mass);
    const tauText = smartNumber(model.tau, 2);
    const practicalSpeedText = smartNumber(model.practicalSpeed, 2);
    const practicalDistanceText = smartNumber(model.practicalDistance, 1);
    const kBounds = linearDragKBounds(model.mass);
    const nextK = clamp(model.k * 1.5, kBounds.min, kBounds.max);
    return {
      title: "线性阻力制动：f = kv 时速度如何衰减",
      description: `高中拓展模型：阻力大小 f = kv、方向与速度相反。速度按指数规律衰减，极限位移为 ${sText}m。`,
      engine: "高中拓展 · 线性阻力模型",
      ar: "网页端展示速度相关阻力下的指数衰减与极限位移。",
      params: [
        { label: "初速度 v₀", desc: "调整物体进入线性阻力区的速度", unit: "m/s", min: PHYSICS_BRAKE_LIMITS.speedMin, max: PHYSICS_BRAKE_LIMITS.speedMax, step: 1, value: model.v0 },
        { label: "阻力系数 k", desc: `质量 m = ${massText}kg；k 的单位为 kg/s`, unit: "kg/s", min: kBounds.min, max: kBounds.max, step: 10, value: model.k }
      ],
      steps: [
        ["提取条件", `v₀ = ${vText}m/s，m = ${massText}kg，k = ${kText}kg/s`, "阻力大小与速率成正比，方向始终与速度相反。"],
        ["建立动力学方程", "m dv/dt = −kv", "取运动方向为正，阻力在方程中带负号。"],
        ["求速度与位移", `v(t) = v₀e<sup>−kt/m</sup>，x(t) = mv₀/k(1−e<sup>−kt/m</sup>)`, "速度和位移都按指数函数变化。"],
        ["判断极限", `τ = m/k = ${tauText}s，x∞ = mv₀/k = ${sText}m`, `动画在 v = 1%v₀ 时结束：t ≈ ${tText}s，x ≈ ${practicalDistanceText}m。`]
      ],
      mentor: "为什么这里不能使用匀变速公式？因为 <strong>f = kv</strong> 随速度减小，因而加速度 <strong>a = −kv/m</strong> 也不断变化。",
      hint: "先由牛顿第二定律写出 m·dv/dt = −kv，再分离变量求解指数函数。",
      challenge: `如果 k 增大到 <strong>${smartNumber(nextK)}kg/s</strong>，时间常数和极限位移会怎样变化？`,
      generationStages: [
        { label: "识别条件", text: `识别 v₀、m 与线性阻力系数 k = ${kText}kg/s`, progress: 28 },
        { label: "建立变力模型", text: "建立 m·dv/dt = −kv，求指数衰减解", progress: 63 },
        { label: "生成衰减过程", text: `演示至 v = 1%v₀；极限位置 ${sText}m`, progress: 100 }
      ],
      recognitionText: `高中拓展｜线性阻力 f = kv｜v₀ = ${vText}m/s｜m = ${massText}kg｜k = ${kText}kg/s｜τ = ${tauText}s｜极限位移 ${sText}m`,
      formulaLabel: "线性阻力",
      formula: "m dv/dt = −kv",
      formulaHtml: `v(t) = v₀e<sup>−kt/m</sup><br>x(t) = mv₀/k(1−e<sup>−kt/m</sup>)<br>x∞ = mv₀/k = ${sText}m`,
      sceneTip: `线性阻力适用于题设模型或低速黏性介质近似；动画终点为 v = ${practicalSpeedText}m/s（初速度的 1%），理论速度只会渐近于 0。`,
      indicatorLabel: "线性阻力模型",
      indicatorFormula: `f = −kv｜τ = ${tauText}s`,
      stopTimeText: tText,
      stopDistanceText: sText,
      model
    };
  }

  return {
    title: "刹车距离实验 · 速度如何归零",
    description: `从题目生成刹车实验：速度从 ${vText}m/s 逐步归零，停止点对应 ${sText}m。`,
    engine: "运动过程可视化",
    ar: "移动端扩展可继续展示汽车刹车实验。",
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
    formulaLabel: "核心公式",
    formula: "v² − v₀² = 2as",
    formulaHtml: `0² − ${vText}² = 2 × (−${aText}) × s，得到 s = ${sText}m`,
    sceneTip: `刹车开始后，速度每秒减少 ${aText}m/s。`,
    indicatorLabel: "恒定减速度",
    indicatorFormula: `a = −${aText}m/s²`,
    stopTimeText: tText,
    stopDistanceText: sText,
    model
  };
}

function buildPhysicsBrakeQuestionText(v0 = state.p1, parameter = state.p2, options = {}) {
  const model = physicsBrakeModel(v0, parameter, options);
  if (model.mode === "friction") {
    return `一辆汽车以 ${smartNumber(v0)}m/s 的速度在水平路面行驶，紧急刹车后车轮发生滑动，轮胎与路面的动摩擦因数为 ${smartNumber(model.mu, 2)}，取 g = ${smartNumber(model.gravity)}m/s²。求刹车距离。`;
  }
  if (model.mode === "linear_drag") {
    return `质量为 ${smartNumber(model.mass)}kg 的小车以 ${smartNumber(v0)}m/s 行驶，随后只受大小满足 f = kv、方向与速度相反的阻力，k = ${smartNumber(model.k)}kg/s。求速度随时间的关系和极限位移。`;
  }
  return `一辆汽车以 ${smartNumber(v0)}m/s 的速度行驶，紧急刹车后加速度大小为 ${smartNumber(model.aAbs)}m/s²，求刹车距离。`;
}

function boardSliderNumber(value, decimals = 3) {
  return String(Number(Number(value).toFixed(decimals)));
}

function boardSliderModel(params = state.boardSliderParams) {
  const blockMass = Number(params.blockMass);
  const boardMass = Number(params.boardMass);
  const boardLength = Number(params.boardLength);
  const frictionCoefficient = Number(params.frictionCoefficient);
  const initialSpeed = Number(params.initialSpeed);
  const gravity = Number(params.gravity);
  const friction = frictionCoefficient * blockMass * gravity;
  const blockAcceleration = -frictionCoefficient * gravity;
  const boardAcceleration = friction / boardMass;
  const relativeDeceleration = frictionCoefficient * gravity * (1 + blockMass / boardMass);
  const syncTime = initialSpeed / relativeDeceleration;
  const relativeStopDistance = (initialSpeed * initialSpeed) / (2 * relativeDeceleration);
  const commonSpeed = (blockMass * initialSpeed) / (blockMass + boardMass);
  const criticalSpeed = Math.sqrt(2 * relativeDeceleration * boardLength);
  const difference = relativeStopDistance - boardLength;
  const outcome = Math.abs(difference) <= BOARD_SLIDER_LIMITS.epsilon
    ? "critical"
    : difference < 0
      ? "safe"
      : "fall";
  const discriminant = Math.max(0, initialSpeed * initialSpeed - 2 * relativeDeceleration * boardLength);
  const exitTime = outcome === "fall"
    ? (initialSpeed - Math.sqrt(discriminant)) / relativeDeceleration
    : null;
  const endTime = outcome === "fall"
    ? exitTime
    : outcome === "safe"
      ? syncTime + 1
      : syncTime;
  const remainingDistance = Math.max(0, boardLength - relativeStopDistance);
  const outcomeLabel = outcome === "safe" ? "未滑落" : outcome === "critical" ? "临界" : "已滑落";
  const relationSymbol = outcome === "safe" ? "<" : outcome === "critical" ? "=" : ">";
  const conclusion = outcome === "safe"
    ? `滑块先与木板达到共同速度，最大相对位移 ${boardSliderNumber(relativeStopDistance)}m，小于木板长度；随后二者共同匀速运动。`
    : outcome === "critical"
      ? "临界：滑块恰好到达木板右端时与木板相对静止。"
      : `最大相对位移 ${boardSliderNumber(relativeStopDistance)}m 大于木板长度，滑块在 ${boardSliderNumber(exitTime)}s 时从右端滑出。`;
  const recognitionText = `木板—滑块｜m=${boardSliderNumber(blockMass)}kg｜M=${boardSliderNumber(boardMass)}kg｜L=${boardSliderNumber(boardLength)}m｜μ=${boardSliderNumber(frictionCoefficient, 2)}｜v₀=${boardSliderNumber(initialSpeed)}m/s｜${outcomeLabel}`;

  return {
    blockMass,
    boardMass,
    boardLength,
    frictionCoefficient,
    initialSpeed,
    gravity,
    gravityWasDefaulted: Boolean(params.gravityWasDefaulted),
    friction,
    blockAcceleration,
    boardAcceleration,
    relativeDeceleration,
    syncTime,
    relativeStopDistance,
    commonSpeed,
    criticalSpeed,
    outcome,
    outcomeLabel,
    relationSymbol,
    exitTime,
    endTime,
    remainingDistance,
    conclusion,
    recognitionText
  };
}

function buildPhysicsBoardSliderQuestionText(params = state.boardSliderParams) {
  const model = boardSliderModel(params);
  const isDefault = ["blockMass", "boardMass", "boardLength", "frictionCoefficient", "initialSpeed", "gravity"]
    .every(key => Math.abs(model[key] - BOARD_SLIDER_DEFAULTS[key]) <= BOARD_SLIDER_LIMITS.epsilon);
  if (isDefault && !model.gravityWasDefaulted) return BOARD_SLIDER_DEFAULT_QUESTION;
  return `光滑水平地面上有一块质量为${boardSliderNumber(model.boardMass)}kg、长度为${boardSliderNumber(model.boardLength)}m且初始静止的木板B。质量为${boardSliderNumber(model.blockMass)}kg的滑块A从木板左端以${boardSliderNumber(model.initialSpeed)}m/s向右滑动，二者间动摩擦因数μ=${boardSliderNumber(model.frictionCoefficient, 2)}，取g=${boardSliderNumber(model.gravity)}m/s²。求两者加速度、共同速度时间，并判断滑块是否从右端滑落。`;
}

function buildPhysicsBoardSliderContent(params = state.boardSliderParams) {
  const model = boardSliderModel(params);
  const m = boardSliderNumber(model.blockMass);
  const M = boardSliderNumber(model.boardMass);
  const L = boardSliderNumber(model.boardLength);
  const mu = boardSliderNumber(model.frictionCoefficient, 2);
  const v0 = boardSliderNumber(model.initialSpeed);
  const g = boardSliderNumber(model.gravity);
  const f = boardSliderNumber(model.friction);
  const aA = boardSliderNumber(Math.abs(model.blockAcceleration));
  const aB = boardSliderNumber(model.boardAcceleration);
  const aRel = boardSliderNumber(model.relativeDeceleration);
  const tSync = boardSliderNumber(model.syncTime);
  const sRel = boardSliderNumber(model.relativeStopDistance);
  const vCommon = boardSliderNumber(model.commonSpeed);
  const relation = `${sRel}m ${model.relationSymbol} ${L}m`;
  const gravityNote = model.gravityWasDefaulted ? "｜未识别到g，当前按10m/s²计算" : "";
  const blockAccelerationSymbol = "a<sub>A</sub>";
  const boardAccelerationSymbol = "a<sub>B</sub>";
  const relativeAccelerationSymbol = "a<sub>相</sub>";
  const relativeDisplacementSymbol = "Δx<sub>相</sub>";
  const boardAccelerationFormula = fractionHtml("μmg", "M");
  const massRatioFormula = fractionHtml("m", "M");
  const relativeDistanceFormula = fractionHtml("v₀²", `2${relativeAccelerationSymbol}`);

  return {
    title: "木板—滑块：相对运动与临界滑落",
    description: `光滑地面上的双物体相对运动：分别追踪滑块A和木板B，再用相对位移判断是否滑落。当前结论：${model.outcomeLabel}。`,
    engine: "高中拓展 · 双物体相对运动",
    ar: "网页端展示滑块与木板分别运动、摩擦力方向和相对位移判定。",
    metrics: [["滑块速度", "m/s"], ["木板速度", "m/s"], ["相对位移 Δx", "m"]],
    params: [
      { label: "滑块初速度 v₀", desc: "调整滑块相对地面的初速度", unit: "m/s", min: BOARD_SLIDER_LIMITS.speedMin, max: BOARD_SLIDER_LIMITS.speedMax, step: 0.5, value: model.initialSpeed },
      { label: "木板长度 L", desc: "调整可供滑块相对运动的有效长度", unit: "m", min: BOARD_SLIDER_LIMITS.boardLengthMin, max: BOARD_SLIDER_LIMITS.boardLengthMax, step: 0.25, value: model.boardLength }
    ],
    steps: [
      ["判断摩擦方向", `滑块相对木板向右：A受摩擦力向左，B受摩擦力向右；f = μmg = ${f}N`, "两个摩擦力大小相等、方向相反，但作用在不同物体上。"],
      ["分别使用牛顿第二定律", `${blockAccelerationSymbol} = −μg = −${aA}m/s²；${boardAccelerationSymbol} = ${boardAccelerationFormula} = ${aB}m/s²`, "木板质量不同，二者加速度大小不一定相同。"],
      ["转化为相对运动", `相对加速度大小 ${relativeAccelerationSymbol} = μg(1 + ${massRatioFormula}) = ${aRel}m/s²；最大相对位移 ${relativeDisplacementSymbol} = ${relativeDistanceFormula} = ${sRel}m`, `达到共同速度需 ${tSync}s，共同速度为 ${vCommon}m/s。`],
      ["与木板长度比较", `${relation}，结论：${model.outcomeLabel}`, model.conclusion]
    ],
    mentor: "为什么这里不能直接把滑块对地面的位移与木板长度比较？",
    hint: "木板本身也在运动。判断滑块是否滑落，应该观察滑块相对木板移动了多远。",
    challenge: "保持其他条件不变，如果滑块初速度改为 5m/s，它会不会从木板右端滑落？",
    generationStages: [
      { label: "识别双物体", text: `识别滑块m=${m}kg、木板M=${M}kg、长度L=${L}m与μ=${mu}`, progress: 28 },
      { label: "建立相对运动模型", text: `分别求滑块加速度−${aA}m/s²、木板加速度${aB}m/s²与相对加速度大小${aRel}m/s²`, progress: 63 },
      { label: "判断临界状态", text: `比较最大相对位移 ${sRel}m 与木板长度 ${L}m：${model.outcomeLabel}`, progress: 100 }
    ],
    recognitionText: `${model.recognitionText}｜相对加速度大小=${aRel}m/s²｜最大相对位移=${sRel}m${gravityNote}`,
    formulaLabel: "相对运动判定",
    formula: "比较最大相对位移与 L",
    formulaHtml: `f = μmg = ${f}N<br>${blockAccelerationSymbol} = −μg = −${aA}m/s²；${boardAccelerationSymbol} = ${boardAccelerationFormula} = ${aB}m/s²<br>相对加速度大小 ${relativeAccelerationSymbol} = μg(1 + ${massRatioFormula}) = ${aRel}m/s²<br>最大相对位移 ${relativeDisplacementSymbol} = ${relativeDistanceFormula} = ${sRel}m<br><b>${relation}｜${model.outcomeLabel}</b>`,
    sceneTip: model.outcome === "critical"
      ? `最大相对位移 ${Number(model.relativeStopDistance).toFixed(1)}m，等于木板长度 ${Number(model.boardLength).toFixed(1)}m，当前为临界状态。`
      : model.conclusion,
    model
  };
}

function syncPhysicsBoardSliderContent(params = state.boardSliderParams) {
  const merged = { ...BOARD_SLIDER_DEFAULTS, ...params };
  state.physicsTemplate = "boardSlider";
  state.boardSliderParams = merged;
  state.p1 = Number(merged.initialSpeed);
  state.p2 = Number(merged.boardLength);
  const content = buildPhysicsBoardSliderContent(merged);
  const physics = SUBJECTS["物理"];
  physics.question = buildPhysicsBoardSliderQuestionText(merged);
  physics.title = content.title;
  physics.description = content.description;
  physics.engine = content.engine;
  physics.ar = content.ar;
  physics.metrics = content.metrics;
  physics.params = content.params;
  physics.steps = content.steps;
  physics.mentor = content.mentor;
  physics.hint = content.hint;
  physics.challenge = content.challenge;
  physics.generationStages = content.generationStages;
  physics.recognitionText = content.recognitionText;
  return content.model;
}

function boardSliderValuesAt(time, sourceModel = boardSliderModel()) {
  const model = sourceModel;
  const t = clamp(time, 0, model.endTime);
  const slidingEnd = model.outcome === "fall" ? model.exitTime : model.syncTime;
  const slidingTime = Math.min(t, slidingEnd);
  let blockSpeed = Math.max(0, model.initialSpeed + model.blockAcceleration * slidingTime);
  let boardSpeed = model.boardAcceleration * slidingTime;
  let blockPosition = model.initialSpeed * slidingTime + 0.5 * model.blockAcceleration * slidingTime * slidingTime;
  let boardPosition = 0.5 * model.boardAcceleration * slidingTime * slidingTime;
  let relativePosition = blockPosition - boardPosition;

  if (model.outcome !== "fall" && t > model.syncTime) {
    const sharedTime = t - model.syncTime;
    blockSpeed = model.commonSpeed;
    boardSpeed = model.commonSpeed;
    blockPosition += model.commonSpeed * sharedTime;
    boardPosition += model.commonSpeed * sharedTime;
    relativePosition = model.relativeStopDistance;
  }

  const frictionActive = t < slidingEnd - BOARD_SLIDER_LIMITS.epsilon;
  const reachedEnd = t >= model.endTime - BOARD_SLIDER_LIMITS.epsilon;
  return {
    progress: model.endTime > 0 ? t / model.endTime : 1,
    timelineProgress: model.endTime > 0 ? t / model.endTime : 1,
    metrics: [blockSpeed, boardSpeed, relativePosition],
    boardSlider: {
      ...model,
      t,
      blockSpeed,
      boardSpeed,
      blockPosition,
      boardPosition,
      relativePosition,
      frictionActive,
      reachedEnd
    }
  };
}

function renderBoardSliderScene(values = boardSliderValuesAt(state.time)) {
  const data = values.boardSlider || boardSliderValuesAt(state.time).boardSlider;
  const world = elements.boardSliderWorld;
  if (!world || !elements.boardSliderBoard || !elements.boardSliderBlock) return;
  const endData = boardSliderValuesAt(data.endTime, data).boardSlider;
  const worldWidth = world.clientWidth || 760;
  const blockWidth = elements.boardSliderBlock.offsetWidth || 68;
  const liveCard = world.querySelector(".board-slider-live-card");
  const liveCardWidth = liveCard?.offsetWidth || 0;
  const origin = Math.max(blockWidth / 2 + 88, worldWidth * 0.14);
  const rightReserve = liveCardWidth + 150;
  const availableTrackWidth = Math.max(24, worldWidth - origin - rightReserve);
  const maxGroundPosition = Math.max(endData.blockPosition, endData.boardPosition + data.boardLength, data.boardLength);
  const scale = Math.min(150, availableTrackWidth / Math.max(1, maxGroundPosition));
  const boardLeft = origin + data.boardPosition * scale;
  const blockLeft = origin + data.blockPosition * scale;
  const boardWidth = data.boardLength * scale;
  const relativeRatio = clamp(data.relativePosition / data.boardLength, 0, 1);

  world.style.setProperty("--board-origin-x", `${origin}px`);
  elements.boardSliderBoard.style.left = `${boardLeft}px`;
  elements.boardSliderBoard.style.width = `${boardWidth}px`;
  elements.boardSliderBlock.style.left = `${blockLeft}px`;
  if (elements.boardSliderTrace) elements.boardSliderTrace.style.width = `${relativeRatio * 100}%`;
  elements.boardSliderStage?.classList.toggle("friction-off", !data.frictionActive);
  elements.boardSliderStage?.classList.toggle("motion-complete", data.reachedEnd);
  elements.boardSliderStage?.setAttribute("data-outcome", data.outcome);
  elements.boardSliderBlock.classList.toggle("exited", data.outcome === "fall" && data.reachedEnd);
  world.style.setProperty("--board-block-speed", String(clamp(data.blockSpeed / Math.max(1, data.initialSpeed), 0.08, 1)));
  world.style.setProperty("--board-board-speed", String(clamp(data.boardSpeed / Math.max(1, data.initialSpeed), 0.08, 1)));

  if (elements.boardSliderStatus) {
    const statusText = data.outcome === "fall"
      ? data.reachedEnd ? "已从右端滑出" : "将从右端滑出"
      : data.outcome === "safe" && data.t >= data.syncTime - BOARD_SLIDER_LIMITS.epsilon
        ? "共同运动"
        : data.outcome === "critical" && data.reachedEnd
          ? "临界到达"
          : data.outcomeLabel;
    elements.boardSliderStatus.textContent = statusText;
    elements.boardSliderStatus.dataset.status = data.outcome;
  }
  if (elements.boardSliderRelation) {
    elements.boardSliderRelation.textContent = `${boardSliderNumber(data.relativeStopDistance)}m ${data.relationSymbol} ${boardSliderNumber(data.boardLength)}m`;
  }
  if (elements.boardSliderFrictionText) {
    elements.boardSliderFrictionText.textContent = data.frictionActive ? `f = μmg = ${boardSliderNumber(data.friction)}N` : "共同运动：f = 0";
  }
  if (elements.boardSliderRelativeText) elements.boardSliderRelativeText.textContent = `Δx = ${boardSliderNumber(data.relativePosition)}m`;
  if (elements.boardSliderBlockSpeed) elements.boardSliderBlockSpeed.textContent = `滑块 ${boardSliderNumber(data.blockSpeed)}m/s`;
  if (elements.boardSliderBoardSpeed) elements.boardSliderBoardSpeed.textContent = `木板 ${boardSliderNumber(data.boardSpeed)}m/s`;
  if (elements.boardSliderBlockMass) elements.boardSliderBlockMass.textContent = `${boardSliderNumber(data.blockMass)}kg`;
  if (elements.boardSliderBoardMass) elements.boardSliderBoardMass.textContent = `${boardSliderNumber(data.boardMass)}kg`;
  if (elements.boardSliderMu) elements.boardSliderMu.textContent = boardSliderNumber(data.frictionCoefficient, 2);
  if (elements.boardSliderGravity) elements.boardSliderGravity.textContent = `${boardSliderNumber(data.gravity)}m/s²`;
}

function resetBoardSliderAnimation() {
  state.time = 0;
  renderBoardSliderScene(boardSliderValuesAt(0));
}

function solenoidModel(
  current = state.p1,
  turns = state.p2,
  viewEnd = state.solenoidViewEnd,
  windingDirection = state.solenoidWindingDirection,
  hasCore = state.solenoidHasCore
) {
  const observedPole = windingDirection === "counterclockwise" ? "N" : "S";
  const leftPole = viewEnd === "left" ? observedPole : (observedPole === "N" ? "S" : "N");
  const rightPole = leftPole === "N" ? "S" : "N";
  const base = (current / 0.5) * (turns / 200) * (hasCore ? 1.65 : 1);
  const strengthLevel = base < 0.75 ? "较弱" : base < 1.6 ? "中等" : base < 3 ? "较强" : "很强";
  const visualStrength = clamp((base - 0.25) / 4, 0.16, 1);
  return {
    current,
    turns,
    viewEnd,
    windingDirection,
    hasCore,
    leftPole,
    rightPole,
    strengthLevel,
    visualStrength,
    observedPole,
    isReversed: leftPole === "S"
  };
}

function buildSolenoidQuestionText(model = solenoidModel()) {
  const directionText = model.windingDirection === "counterclockwise" ? "逆时针" : "顺时针";
  const viewText = model.viewEnd === "left" ? "左端" : "右端";
  return `一个${Math.round(model.turns)}匝的通电螺线管接入${formatAmp(model.current)}A电流。从${viewText}观察，线圈中的电流沿${directionText}方向。请判断螺线管左右两端的磁极。若将电流增大到1.0A、线圈匝数增加到400匝，并在线圈中插入铁芯，磁性将如何变化？`;
}

function formatAmp(value) {
  return Number(value).toFixed(2).replace(/0$/, "").replace(/\.0$/, ".0");
}

function solenoidDirectionText(direction = state.solenoidWindingDirection) {
  return direction === "counterclockwise" ? "逆时针" : "顺时针";
}

function solenoidViewText(viewEnd = state.solenoidViewEnd) {
  return viewEnd === "left" ? "左端" : "右端";
}

function buildPhysicsSolenoidContent(
  current = state.p1,
  turns = state.p2,
  options = {}
) {
  const viewEnd = options.viewEnd || state.solenoidViewEnd || "left";
  const windingDirection = options.windingDirection || state.solenoidWindingDirection || "counterclockwise";
  const hasCore = options.hasCore ?? state.solenoidHasCore;
  const model = solenoidModel(current, turns, viewEnd, windingDirection, hasCore);
  const currentText = formatAmp(model.current);
  const turnsText = Math.round(model.turns);
  const directionText = solenoidDirectionText(model.windingDirection);
  const viewText = solenoidViewText(model.viewEnd);
  const observedText = model.viewEnd === "left" ? `左端为${model.leftPole}极` : `右端为${model.rightPole}极`;
  const coreText = model.hasCore ? "已插入" : "未插入";
  return {
    title: "通电螺线管：磁场方向与电磁铁磁性",
    description: "调节电流、匝数和铁芯，观察磁极与磁场变化。",
    engine: "电磁学典型题模板",
    ar: "移动端扩展可继续展示螺线管空间磁场与观察端切换。",
    metrics: [["左端磁极", ""], ["右端磁极", ""], ["当前磁性", ""]],
    params: [
      { label: "电流大小 I", desc: "调整传统电流大小", unit: "A", min: SOLENOID_LIMITS.currentMin, max: SOLENOID_LIMITS.currentMax, step: 0.1, value: model.current },
      { label: "线圈匝数 N", desc: "其他条件与长度基本相同时", unit: "匝", min: SOLENOID_LIMITS.turnsMin, max: SOLENOID_LIMITS.turnsMax, step: 50, value: model.turns }
    ],
    steps: [
      ["提取条件", `从${viewText}观察，电流沿${directionText}方向。`, `电流 I = ${currentText}A，线圈匝数 N = ${turnsText}匝，铁芯：${coreText}。`],
      ["使用安培定则", "右手四指沿传统电流方向弯曲", "大拇指所指方向为螺线管内部磁场方向，也指向 N 极。"],
      ["判断磁极", `${observedText}，另一端相反。`, `所以左端为${model.leftPole}极，右端为${model.rightPole}极。`],
      ["分析磁性", "电流越大、匝数越多、插入铁芯，磁性越强。", "匝数规律需限定在其他条件和线圈长度基本相同时。"]
    ],
    mentor: "为什么反转电流后，电磁铁的 N、S 极会交换，但磁性不一定减弱？",
    hint: "分别考虑“电流方向”和“电流大小”影响的是磁场的哪个属性：方向改变会交换磁极，大小改变才影响强弱。",
    challenge: "将电流由 <strong>0.5A</strong> 增大到 <strong>1.0A</strong>，同时反转电流方向。磁极和磁性分别怎样变化？",
    generationStages: [
      { label: "识别电磁题", text: `识别 ${turnsText}匝、${currentText}A、${viewText}${directionText}`, progress: 28 },
      { label: "生成螺线管", text: "生成3D线圈、传统电流箭头与闭合磁感线", progress: 63 },
      { label: "判断磁极", text: `${viewText}${directionText} → ${observedText}`, progress: 100 }
    ],
    recognitionText: `从${viewText}观察电流为${directionText}｜左端${model.leftPole}极｜右端${model.rightPole}极｜磁性：${model.strengthLevel}`,
    formulaHtml: `观察端：逆时针 → N 极；顺时针 → S 极<br>磁感线闭合：外部 N → S，内部 S → N<br>强弱看电流、匝数、铁芯；不显示伪精确 B 值。`,
    sceneTip: `当前：左端 ${model.leftPole} 极，右端 ${model.rightPole} 极；I=${currentText}A，N=${turnsText}匝，铁芯${coreText}，磁性${model.strengthLevel}。`,
    model
  };
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

function defaultMathSpec() {
  return { kind: "polynomial", a: 1, b: 0, c: 0 };
}

function formatMathNumber(value, decimals = 2) {
  if (!Number.isFinite(value)) return "--";
  const rounded = Number(Number(value).toFixed(decimals));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(decimals);
}

function formatSignedTerm(value, body, isFirst = false) {
  if (!value) return "";
  const sign = value < 0 ? "-" : isFirst ? "" : "+";
  const abs = Math.abs(value);
  const coeff = abs === 1 && body ? "" : formatMathNumber(abs);
  return `${sign}${coeff}${body}`;
}

function formatPolynomialSpec(spec) {
  const terms = [
    formatSignedTerm(spec.a, "x²", true),
    formatSignedTerm(spec.b, "x", !spec.a),
    spec.c ? `${spec.c < 0 ? "-" : (!spec.a && !spec.b ? "" : "+")}${formatMathNumber(Math.abs(spec.c))}` : ""
  ].filter(Boolean);
  return terms.join(" ") || "0";
}

function formatPolynomialDerivative(spec) {
  const linear = {
    a: 0,
    b: 2 * (spec.a || 0),
    c: spec.b || 0
  };
  const expression = formatPolynomialSpec(linear).replace(/x²/g, "x");
  return expression === "0" ? "0" : expression;
}

function polynomialValue(spec, x) {
  return (spec.a || 0) * x * x + (spec.b || 0) * x + (spec.c || 0);
}

function polynomialDerivativeValue(spec, x) {
  return 2 * (spec.a || 0) * x + (spec.b || 0);
}

function parsePolynomialExpression(expression) {
  const raw = String(expression || "")
    .replace(/\s+/g, "")
    .replace(/\*/g, "")
    .replace(/²/g, "^2")
    .replace(/x2/g, "x^2")
    .replace(/X/g, "x");
  if (!raw || /[^0-9x+\-.^]/i.test(raw)) return null;
  const normalized = raw.startsWith("-") ? raw : `+${raw}`;
  const terms = normalized.match(/[+-][^+-]+/g);
  if (!terms) return null;
  const spec = { kind: "polynomial", a: 0, b: 0, c: 0 };
  for (const term of terms) {
    let match = term.match(/^([+-])(\d*(?:\.\d+)?)?x\^2$/i);
    if (match) {
      const coeff = match[2] === "" || match[2] === undefined ? 1 : Number(match[2]);
      spec.a += match[1] === "-" ? -coeff : coeff;
      continue;
    }
    match = term.match(/^([+-])(\d*(?:\.\d+)?)?x$/i);
    if (match) {
      const coeff = match[2] === "" || match[2] === undefined ? 1 : Number(match[2]);
      spec.b += match[1] === "-" ? -coeff : coeff;
      continue;
    }
    match = term.match(/^([+-])(\d+(?:\.\d+)?)$/);
    if (match) {
      spec.c += match[1] === "-" ? -Number(match[2]) : Number(match[2]);
      continue;
    }
    return null;
  }
  if (!spec.a && !spec.b && !spec.c) return null;
  return spec;
}

function normalizeMathExpression(expression) {
  return String(expression || "")
    .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[＝]/g, "=")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/[－−–—]/g, "-")
    .replace(/×/g, "*")
    .replace(/²/g, "^2")
    .replace(/\s+/g, "")
    .toLowerCase()
    .replace(/lnx/g, "ln(x)")
    .replace(/sinx/g, "sin(x)")
    .replace(/cosx/g, "cos(x)")
    .replace(/sqrtx/g, "sqrt(x)")
    .replace(/√x/g, "sqrt(x)")
    .replace(/(\d)(x)/g, "$1*$2")
    .replace(/x2/g, "x^2");
}

function createMathModel(spec = defaultMathSpec()) {
  const safeSpec = { ...defaultMathSpec(), ...spec };
  if (safeSpec.kind === "ln") {
    return {
      spec: { kind: "ln" },
      expression: "ln x",
      derivativeText: "1/x",
      domainMin: 0.2,
      domainMax: 6,
      step: 0.1,
      defaultX: 3,
      challengeX: 5,
      value: x => Math.log(x),
      derivative: x => 1 / x
    };
  }
  if (safeSpec.kind === "sin") {
    return {
      spec: { kind: "sin" },
      expression: "sin x",
      derivativeText: "cos x",
      domainMin: -6.3,
      domainMax: 6.3,
      step: 0.1,
      defaultX: 1,
      challengeX: 2,
      value: x => Math.sin(x),
      derivative: x => Math.cos(x)
    };
  }
  if (safeSpec.kind === "cos") {
    return {
      spec: { kind: "cos" },
      expression: "cos x",
      derivativeText: "-sin x",
      domainMin: -6.3,
      domainMax: 6.3,
      step: 0.1,
      defaultX: 1,
      challengeX: 2,
      value: x => Math.cos(x),
      derivative: x => -Math.sin(x)
    };
  }
  if (safeSpec.kind === "exp") {
    return {
      spec: { kind: "exp" },
      expression: "e^x",
      derivativeText: "e^x",
      domainMin: -2,
      domainMax: 2,
      step: 0.1,
      defaultX: 1,
      challengeX: 2,
      value: x => Math.exp(x),
      derivative: x => Math.exp(x)
    };
  }
  if (safeSpec.kind === "sqrt") {
    return {
      spec: { kind: "sqrt" },
      expression: "√x",
      derivativeText: "1/(2√x)",
      domainMin: 0.1,
      domainMax: 9,
      step: 0.1,
      defaultX: 4,
      challengeX: 9,
      value: x => Math.sqrt(x),
      derivative: x => 1 / (2 * Math.sqrt(x))
    };
  }

  const polynomialSpec = {
    kind: "polynomial",
    a: Number(safeSpec.a) || 0,
    b: Number(safeSpec.b) || 0,
    c: Number(safeSpec.c) || 0
  };
  return {
    spec: polynomialSpec,
    expression: formatPolynomialSpec(polynomialSpec),
    derivativeText: formatPolynomialDerivative(polynomialSpec),
    domainMin: -5,
    domainMax: 5,
    step: 0.1,
    defaultX: 3,
    challengeX: 5,
    value: x => polynomialValue(polynomialSpec, x),
    derivative: x => polynomialDerivativeValue(polynomialSpec, x)
  };
}

function currentMathModel() {
  if (!state.mathModel) state.mathModel = createMathModel(defaultMathSpec());
  return state.mathModel;
}

function createMathModelFromExpression(expression) {
  const normalized = normalizeMathExpression(expression);
  if (/^(ln|log)\(x\)$/.test(normalized)) return createMathModel({ kind: "ln" });
  if (/^sin\(x\)$/.test(normalized)) return createMathModel({ kind: "sin" });
  if (/^cos\(x\)$/.test(normalized)) return createMathModel({ kind: "cos" });
  if (/^(e\^x|exp\(x\))$/.test(normalized)) return createMathModel({ kind: "exp" });
  if (/^sqrt\(x\)$/.test(normalized)) return createMathModel({ kind: "sqrt" });
  const polynomial = parsePolynomialExpression(normalized);
  return polynomial ? createMathModel(polynomial) : null;
}

function extractMathExpression(text) {
  const raw = String(text || "").replace(/[；;。]/g, "，");
  const match = raw.match(/y\s*(?:=|＝|为|是)\s*([^，,]+?)(?=(?:上|运动|，|当|求|处|$))/i);
  return match ? match[1].trim() : "";
}

function extractMathX(text, model) {
  const normalized = normalizeQuestionText(text);
  const match = normalized.match(/x\s*(?:=|为|是|:|：)\s*(-?\d+(?:\.\d+)?)/i);
  const parsed = match ? Number(match[1]) : model.defaultX;
  return Number.isFinite(parsed) ? parsed : model.defaultX;
}

function buildMathQuestionText(x = state.p1, model = currentMathModel()) {
  return `点 P 在函数 y = ${model.expression} 上运动，当 x = ${formatMathNumber(x)} 时，求该点处切线斜率，并观察 x 改变时斜率如何变化。`;
}

function syncMathContent(x = state.p1, model = currentMathModel()) {
  state.mathModel = model;
  const safeX = clamp(Number(x), model.domainMin, model.domainMax);
  state.p1 = Number(formatMathNumber(safeX, 2));
  const y = model.value(state.p1);
  const slope = model.derivative(state.p1);
  const xText = formatMathNumber(state.p1);
  const yText = formatMathNumber(y);
  const slopeText = formatMathNumber(slope);
  const math = SUBJECTS["数学"];
  math.question = buildMathQuestionText(state.p1, model);
  math.description = `函数 y = ${model.expression}，导数 y′ = ${model.derivativeText}；当 x = ${xText} 时，切线斜率 k = ${slopeText}。`;
  math.params[0] = { label: "自变量 x", desc: `拖动观察 y = ${model.expression}`, unit: "", min: model.domainMin, max: model.domainMax, step: model.step, value: state.p1 };
  math.params[1] = { label: "缩放倍率", desc: "保持图像清晰展示", unit: "x", min: 1, max: 1, step: 1, value: 1 };
  math.steps = [
    ["提取函数", `y = ${model.expression}，x = ${xText}`, "识别函数表达式和题目给定位置。"],
    ["求导", `y′ = ${model.derivativeText}`, "导函数在给定点的值表示该点处切线斜率。"],
    ["代入坐标", `x = ${xText}，k = ${slopeText}`, `函数值 y = ${yText}，切线斜率 k = ${slopeText}。`],
    ["观察变化", "拖动 x，图像与切线同步更新", "通过动点观察切线斜率随横坐标改变而变化。"]
  ];
  math.mentor = `为什么函数 y = ${model.expression} 在 x = ${xText} 处的切线斜率等于 <strong>${slopeText}</strong>？`;
  math.hint = `先求导得到 y′ = ${model.derivativeText}，再把 x = ${xText} 代入；导函数值就是该点切线斜率。`;
  math.challenge = `如果 <strong>x = ${formatMathNumber(model.challengeX)}</strong>，切线斜率是多少？`;
  math.recognitionText = `函数 y = ${model.expression}｜导数 y′ = ${model.derivativeText}｜x = ${xText}｜y = ${yText}｜切线斜率 k = ${slopeText}`;
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
  clearReasoningTimers();
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
  if ($("#arDescription")) $("#arDescription").textContent = content.ar;
  $("#engineBadge").textContent = "典型题型模板演示";
  if (options.updateQuestion !== false) $("#questionInput").value = content.question;
  state.generatedQuestion = $("#questionInput").value || content.question;
  if (state.hasGenerated) saveCurrentSubjectSnapshot();
}

function syncPhysicsBrakeContent(v0 = state.p1, parameter = state.p2, options = {}) {
  state.physicsTemplate = "brake";
  state.brakeMode = options.mode || state.brakeMode || "constant";
  if (Number.isFinite(options.gravity)) state.brakeGravity = options.gravity;
  if (Number.isFinite(options.mass)) state.brakeMass = options.mass;
  const content = buildPhysicsBrakeContent(v0, parameter, {
    mode: state.brakeMode,
    gravity: state.brakeGravity,
    mass: state.brakeMass
  });
  const physics = SUBJECTS["物理"];
  physics.question = buildPhysicsBrakeQuestionText(v0, parameter, {
    mode: state.brakeMode,
    gravity: state.brakeGravity,
    mass: state.brakeMass
  });
  physics.title = content.title;
  physics.description = content.description;
  physics.engine = content.engine;
  physics.ar = content.ar;
  physics.metrics = [["速度 v", "m/s"], ["位移 s", "m"], ["时间 t", "s"]];
  physics.params = content.params;
  physics.steps = content.steps;
  physics.mentor = content.mentor;
  physics.hint = content.hint;
  physics.challenge = content.challenge;
  physics.generationStages = content.generationStages;
  physics.recognitionText = content.recognitionText;
  return content.model;
}

function syncPhysicsSolenoidContent(current = state.p1, turns = state.p2, options = {}) {
  state.physicsTemplate = "solenoid";
  const content = buildPhysicsSolenoidContent(current, turns, options);
  const physics = SUBJECTS["物理"];
  physics.question = buildSolenoidQuestionText(content.model);
  physics.title = content.title;
  physics.description = content.description;
  physics.engine = content.engine;
  physics.ar = content.ar;
  physics.metrics = content.metrics;
  physics.params = content.params;
  physics.steps = content.steps;
  physics.mentor = content.mentor;
  physics.hint = content.hint;
  physics.challenge = content.challenge;
  physics.generationStages = content.generationStages;
  physics.recognitionText = content.recognitionText;
  return content.model;
}

function projectileModel(speed = state.p1, height = state.p2) {
  const g = PROJECTILE_LIMITS.gravity;
  const fallTime = Math.sqrt((2 * height) / g);
  const range = speed * fallTime;
  const verticalSpeed = g * fallTime;
  return { speed, height, gravity: g, fallTime, range, verticalSpeed };
}

function buildPhysicsProjectileQuestionText(speed = state.p1, height = state.p2) {
  return `小球以 ${smartNumber(speed)}m/s 的水平速度从 ${smartNumber(height)}m 高的平台水平抛出，不计空气阻力。求落地时间和水平位移，并观察运动轨迹。`;
}

function buildPhysicsProjectileContent(speed = state.p1, height = state.p2) {
  const model = projectileModel(speed, height);
  const vText = smartNumber(model.speed);
  const hText = smartNumber(model.height);
  const tText = smartNumber(model.fallTime, 2);
  const xText = smartNumber(model.range, 1);
  const vyText = smartNumber(model.verticalSpeed, 1);
  return {
    title: "平抛运动：水平位移与落地时间",
    description: `把平抛运动拆成水平匀速和竖直自由落体：落地时间 ${tText}s，水平位移 ${xText}m。`,
    engine: "运动合成模板演示",
    ar: "移动端扩展可继续展示平抛轨迹与速度分解。",
    metrics: [["水平速度 v₀", "m/s"], ["落地时间 t", "s"], ["水平位移 x", "m"]],
    params: [
      { label: "水平速度 v₀", desc: "调整小球抛出时的水平速度", unit: "m/s", min: PROJECTILE_LIMITS.speedMin, max: PROJECTILE_LIMITS.speedMax, step: 1, value: model.speed },
      { label: "释放高度 h", desc: "调整平台到地面的高度", unit: "m", min: PROJECTILE_LIMITS.heightMin, max: PROJECTILE_LIMITS.heightMax, step: 1, value: model.height }
    ],
    steps: [
      ["提取条件", `v₀ = ${vText}m/s，h = ${hText}m`, "识别水平初速度、释放高度和不计空气阻力。"],
      ["拆分运动", "水平方向匀速，竖直方向自由落体", "平抛运动可以看作两个方向的独立运动。"],
      ["计算时间", `h = 1/2gt²，t = ${tText}s`, "落地时间只由竖直高度决定。"],
      ["计算位移", `x = v₀t = ${xText}m`, "水平位移由水平速度和落地时间共同决定。"]
    ],
    mentor: `为什么平抛的落地时间只由 <strong>高度 ${hText}m</strong> 决定？因为竖直方向初速度为 0，只受重力加速度影响。`,
    hint: "小提示：先不要把曲线当成一个整体算，把水平方向和竖直方向分开看。",
    challenge: `如果水平速度变为 <strong>${smartNumber(model.speed * 1.5)}m/s</strong>，落地时间会变吗？水平位移会怎样变化？`,
    generationStages: [
      { label: "识别条件", text: `识别平抛条件：v₀ = ${vText}m/s，h = ${hText}m`, progress: 28 },
      { label: "拆分运动", text: "建立水平匀速 + 竖直自由落体模型", progress: 63 },
      { label: "生成轨迹", text: `生成平抛轨迹：落地点约 ${xText}m`, progress: 100 }
    ],
    recognitionText: `水平速度 ${vText}m/s｜高度 ${hText}m｜落地时间 ${tText}s｜水平位移 ${xText}m`,
    formulaHtml: `由竖直运动得 t = √(2h/g) = ${tText}s<br>水平方向：x = v₀t = ${vText} × ${tText} = ${xText}m<br>落地瞬间竖直速度约 ${vyText}m/s`,
    sceneTip: `小球从 ${hText}m 高处水平抛出，约 ${tText}s 后落地，水平位移约 ${xText}m。`,
    model
  };
}

function syncPhysicsProjectileContent(speed = state.p1, height = state.p2) {
  state.physicsTemplate = "projectile";
  const content = buildPhysicsProjectileContent(speed, height);
  const physics = SUBJECTS["物理"];
  physics.question = buildPhysicsProjectileQuestionText(speed, height);
  physics.title = content.title;
  physics.description = content.description;
  physics.engine = content.engine;
  physics.ar = content.ar;
  physics.metrics = content.metrics;
  physics.params = content.params;
  physics.steps = content.steps;
  physics.mentor = content.mentor;
  physics.hint = content.hint;
  physics.challenge = content.challenge;
  physics.generationStages = content.generationStages;
  physics.recognitionText = content.recognitionText;
  return content.model;
}

function circuitModel(voltage = state.p1, resistance = state.p2) {
  const current = voltage / resistance;
  const power = voltage * current;
  const brightness = clamp(power / 24, 0.12, 1);
  return { voltage, resistance, current, power, brightness };
}

function buildPhysicsCircuitQuestionText(voltage = state.p1, resistance = state.p2) {
  return `某纯电阻电路两端电压为 ${smartNumber(voltage)}V，电阻为 ${smartNumber(resistance)}Ω。求电路中的电流，并观察电压或电阻改变时电流如何变化。`;
}

function buildPhysicsCircuitContent(voltage = state.p1, resistance = state.p2) {
  const model = circuitModel(voltage, resistance);
  const uText = smartNumber(model.voltage);
  const rText = smartNumber(model.resistance);
  const iText = smartNumber(model.current, 2);
  const pText = smartNumber(model.power, 1);
  return {
    title: "欧姆定律电路：电压、电阻与电流",
    description: `纯电阻电路中 I = U / R：电压 ${uText}V，电阻 ${rText}Ω，电流 ${iText}A。电流粒子仅表示传统电流方向与相对快慢。`,
    engine: "电路定量模板演示",
    ar: "移动端扩展可继续展示电路连接与电流变化。",
    metrics: [["电压 U", "V"], ["电阻 R", "Ω"], ["电流 I", "A"]],
    params: [
      { label: "电压 U", desc: "调整电源两端电压", unit: "V", min: CIRCUIT_LIMITS.voltageMin, max: CIRCUIT_LIMITS.voltageMax, step: 1, value: model.voltage },
      { label: "电阻 R", desc: "调整纯电阻阻值", unit: "Ω", min: CIRCUIT_LIMITS.resistanceMin, max: CIRCUIT_LIMITS.resistanceMax, step: 1, value: model.resistance }
    ],
    steps: [
      ["提取条件", `U = ${uText}V，R = ${rText}Ω`, "识别电路两端电压和电阻。"],
      ["选择公式", "I = U / R", "纯电阻电路中电流与电压成正比，与电阻成反比。"],
      ["代入计算", `I = ${uText} ÷ ${rText} = ${iText}A`, "用欧姆定律求出电流。"],
      ["现象验证", `电流 ${iText}A，电阻功率 P = ${pText}W`, "电压增大或电阻改变时，电流与电阻消耗的功率同步变化。"]
    ],
    mentor: `为什么电阻变大后电流会变小？因为在电压 ${uText}V 不变时，<strong>I = U / R</strong> 中分母变大。`,
    hint: "小提示：先确认这是纯电阻电路，再直接使用欧姆定律 I = U / R。",
    challenge: `如果电压变为 <strong>${smartNumber(model.voltage * 2)}V</strong>，电阻不变，电流会怎样变化？`,
    generationStages: [
      { label: "识别电路条件", text: `识别 U = ${uText}V，R = ${rText}Ω`, progress: 28 },
      { label: "匹配欧姆定律", text: "匹配纯电阻电路模板：I = U / R", progress: 63 },
      { label: "生成电路反馈", text: `生成电流 ${iText}A 与电阻功率 ${pText}W`, progress: 100 }
    ],
    recognitionText: `电压 ${uText}V｜电阻 ${rText}Ω｜电流 ${iText}A｜功率约 ${pText}W`,
    formulaHtml: `代入：I = ${uText} ÷ ${rText} = ${iText}A<br>电阻功率：P = UI = ${pText}W`,
    sceneTip: `电压 ${uText}V、电阻 ${rText}Ω 时，电流为 ${iText}A；运动粒子表示传统电流方向与相对快慢，不表示电子运动方向或真实漂移速度。`,
    model
  };
}

function syncPhysicsCircuitContent(voltage = state.p1, resistance = state.p2) {
  state.physicsTemplate = "circuit";
  const content = buildPhysicsCircuitContent(voltage, resistance);
  const physics = SUBJECTS["物理"];
  physics.question = buildPhysicsCircuitQuestionText(voltage, resistance);
  physics.title = content.title;
  physics.description = content.description;
  physics.engine = content.engine;
  physics.ar = content.ar;
  physics.metrics = content.metrics;
  physics.params = content.params;
  physics.steps = content.steps;
  physics.mentor = content.mentor;
  physics.hint = content.hint;
  physics.challenge = content.challenge;
  physics.generationStages = content.generationStages;
  physics.recognitionText = content.recognitionText;
  return content.model;
}

function extraPhysicsTemplate(id = state.physicsTemplate) {
  return EXTRA_PHYSICS_TEMPLATES[id] || null;
}

function buildExtraPhysicsContent(id = state.physicsTemplate, p1 = state.p1, p2 = state.p2) {
  const template = extraPhysicsTemplate(id);
  if (!template) return null;
  return template.content(p1, p2);
}

function buildExtraPhysicsQuestionText(id = state.physicsTemplate, p1 = state.p1, p2 = state.p2) {
  const template = extraPhysicsTemplate(id);
  if (!template) return buildPhysicsBrakeQuestionText();
  return template.question(p1, p2);
}

function syncExtraPhysicsContent(id = state.physicsTemplate, p1 = state.p1, p2 = state.p2) {
  const template = extraPhysicsTemplate(id);
  if (!template) return syncPhysicsBrakeContent();
  state.physicsTemplate = id;
  const content = buildExtraPhysicsContent(id, p1, p2);
  const physics = SUBJECTS["物理"];
  physics.question = buildExtraPhysicsQuestionText(id, p1, p2);
  physics.title = content.title;
  physics.description = content.description;
  physics.engine = content.engine;
  physics.ar = content.ar;
  physics.metrics = content.metrics;
  physics.params = content.params;
  physics.steps = content.steps;
  physics.mentor = content.mentor;
  physics.hint = content.hint;
  physics.challenge = content.challenge;
  physics.generationStages = content.generationStages;
  physics.recognitionText = content.recognitionText;
  return content.model;
}

function identifyExtraPhysicsTemplate(text) {
  const source = normalizeQuestionText(text);
  return EXTRA_PHYSICS_IDS.find(id => EXTRA_PHYSICS_TEMPLATES[id].keywords?.test(source)) || "";
}

function parseExtraPhysicsQuestion(text, preferredId = "") {
  const id = preferredId && isExtraPhysicsTemplate(preferredId) ? preferredId : identifyExtraPhysicsTemplate(text);
  const template = extraPhysicsTemplate(id);
  if (!template) {
    return { ok: false, message: "暂未识别该物理题型，请尝试选择一个物理预设模板。" };
  }
  const result = template.parseQuestion(text);
  if (!result.ok) return result;
  return {
    ...result,
    templateId: id,
    message: result.message || `已识别：${result.recognitionText}`
  };
}

function renderExtraPhysicsVisual(content = buildExtraPhysicsContent()) {
  if (!content || !elements.genericPhysicsVisual) return;
  elements.genericPhysicsVisual.innerHTML = content.visualHtml || "";
  if (elements.genericPhysicsMeta) elements.genericPhysicsMeta.textContent = `${content.stage} · ${content.block}`;
  setFormulaHtml(elements.genericPhysicsResult, content.resultTitle);
  setFormulaHtml(elements.genericPhysicsDescription, content.resultDescription);
  if (elements.genericPhysicsFacts) {
    elements.genericPhysicsFacts.innerHTML = content.facts
      .map(item => `<div><dt>${item.label}</dt><dd>${verticalizeFormulaHtml(item.value)}</dd></div>`)
      .join("");
  }
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
    <strong>${verticalizeFormulaHtml(content.formula)}</strong>
    <p>${verticalizeFormulaHtml(content.formulaHtml)}</p>
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
  const failMessage = "暂未识别该刹车题，请输入初速度，并给出刹车加速度、动摩擦因数，或线性阻力模型中的质量 m 与系数 k。";
  if (!normalized) return { ok: false, message: failMessage };
  const linearDragCandidate = /(?:f|F)(?:阻)?\s*(?:=|＝)\s*-?\s*k\s*v/i.test(normalized)
    || /线性阻力|阻力[^。；]{0,28}(?:与速度成正比|正比于速度)/.test(normalized);
  const frictionCandidate = /动摩擦因数|滑动摩擦系数|摩擦系数|μ/.test(normalized) && !linearDragCandidate;
  if (!/刹车|制动|减速|减速度|停止|停下|停车|阻力|极限位移/.test(normalized) && !linearDragCandidate) {
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

  if (!Number.isFinite(v0)) {
    return { ok: false, message: "未识别到初速度，请使用“初速度为20m/s”或“以20m/s行驶”等写法。" };
  }

  v0 = Math.abs(v0);
  if (v0 < PHYSICS_BRAKE_LIMITS.speedMin || v0 > PHYSICS_BRAKE_LIMITS.speedMax) {
    return { ok: false, message: `识别到初速度 ${smartNumber(v0)}m/s，但当前演示范围为 ${PHYSICS_BRAKE_LIMITS.speedMin}–${PHYSICS_BRAKE_LIMITS.speedMax}m/s。` };
  }

  if (linearDragCandidate) {
    const massMatch = normalized.match(/(?:质量|m)\s*(?:为|是|=|:|：)?\s*(\d+(?:\.\d+)?)\s*(kg|千克|t|吨)/i);
    const kMatch = normalized.match(/(?:阻力系数|比例系数|系数|k)\s*(?:为|是|=|:|：)?\s*(\d+(?:\.\d+)?)\s*(?:kg\s*\/\s*s|N\s*[·・*]?\s*s\s*\/\s*m|牛\s*[·・*]?\s*秒\s*\/\s*米)?/i);
    if (!massMatch || !kMatch) {
      return { ok: false, message: "线性阻力题需要同时给出质量 m 和阻力系数 k，例如：m=1000kg，f=kv，k=250kg/s。" };
    }
    let mass = Number(massMatch[1]);
    if (/t|吨/i.test(massMatch[2])) mass *= 1000;
    const k = Math.abs(Number(kMatch[1]));
    if (mass < PHYSICS_LINEAR_DRAG_LIMITS.massMin || mass > PHYSICS_LINEAR_DRAG_LIMITS.massMax) {
      return { ok: false, message: `识别到质量 ${smartNumber(mass)}kg，但当前线性阻力演示范围为 ${PHYSICS_LINEAR_DRAG_LIMITS.massMin}–${PHYSICS_LINEAR_DRAG_LIMITS.massMax}kg。` };
    }
    if (k < PHYSICS_LINEAR_DRAG_LIMITS.kMin || k > PHYSICS_LINEAR_DRAG_LIMITS.kMax) {
      return { ok: false, message: `识别到 k = ${smartNumber(k)}kg/s，但当前演示范围为 ${PHYSICS_LINEAR_DRAG_LIMITS.kMin}–${PHYSICS_LINEAR_DRAG_LIMITS.kMax}kg/s。` };
    }
    const model = physicsBrakeModel(v0, k, { mode: "linear_drag", mass });
    if (model.duration < PHYSICS_LINEAR_DRAG_LIMITS.durationMin || model.duration > PHYSICS_LINEAR_DRAG_LIMITS.durationMax) {
      return {
        ok: false,
        message: `该参数组合使“速度降至初速度1%”的时间为 ${smartNumber(model.duration, 2)}s，超出当前 1–60s 演示范围；请适当调整质量 m 或阻力系数 k。`
      };
    }
    const recognitionText = `高中拓展｜线性阻力 f = kv｜v₀ = ${smartNumber(v0)}m/s｜m = ${smartNumber(mass)}kg｜k = ${smartNumber(k)}kg/s｜τ = ${smartNumber(model.tau, 2)}s｜极限位移 ${smartNumber(model.stopDistance)}m`;
    return {
      ok: true,
      subject: "物理",
      type: "linear_drag_braking",
      mode: "linear_drag",
      v0,
      k,
      parameter: k,
      mass,
      tau: model.tau,
      stopTime: Infinity,
      practicalTime: model.duration,
      stopDistance: model.stopDistance,
      recognitionText,
      message: `已识别：线性阻力 f = kv，m = ${smartNumber(mass)}kg，k = ${smartNumber(k)}kg/s`
    };
  }

  if (frictionCandidate) {
    const mu = firstNumberByPatterns(normalized, [
      /(?:动摩擦因数|滑动摩擦系数|摩擦系数|μ)\s*(?:为|是|=|:|：)?\s*(\d+(?:\.\d+)?)/i
    ]);
    const gravity = firstNumberByPatterns(normalized, [
      /(?:重力加速度|g)\s*(?:取|为|是|=|:|：)?\s*(9\.8|10)(?:\s*m\s*\/\s*s\s*(?:2|\^\s*2))?/i
    ]) ?? 9.8;
    if (!Number.isFinite(mu)) {
      return { ok: false, message: "摩擦制动题需要给出动摩擦因数 μ，例如：μ=0.5。" };
    }
    if (mu < PHYSICS_FRICTION_BRAKE_LIMITS.muMin || mu > PHYSICS_FRICTION_BRAKE_LIMITS.muMax) {
      return { ok: false, message: `识别到 μ = ${smartNumber(mu, 2)}，但当前演示范围为 ${PHYSICS_FRICTION_BRAKE_LIMITS.muMin}–${PHYSICS_FRICTION_BRAKE_LIMITS.muMax}。` };
    }
    const model = physicsBrakeModel(v0, mu, { mode: "friction", gravity });
    const preciseAcceleration = String(Number(model.aAbs.toFixed(2)));
    const recognitionText = `摩擦制动｜v₀ = ${smartNumber(v0)}m/s｜μ = ${smartNumber(mu, 2)}｜g = ${smartNumber(gravity)}m/s²｜a = −${preciseAcceleration}m/s²｜停止距离 ${smartNumber(model.stopDistance)}m`;
    return {
      ok: true,
      subject: "物理",
      type: "friction_braking",
      mode: "friction",
      v0,
      mu,
      parameter: mu,
      gravity,
      aAbs: model.aAbs,
      stopTime: model.stopTime,
      stopDistance: model.stopDistance,
      recognitionText,
      message: `已识别：初速度 ${smartNumber(v0)}m/s，动摩擦因数 ${smartNumber(mu, 2)}，减速度 ${preciseAcceleration}m/s²`
    };
  }

  let aAbs = firstNumberByPatterns(normalized, [
    /(?:刹车|制动)?\s*(?:加速度大小|加速度|减速度|减速加速度|制动加速度)\s*(?:大小)?\s*(?:为|是|=|:|：)?\s*(-?\d+(?:\.\d+)?)/i,
    /(?:^|[，,；;\s])a\s*(?:=|为|是|:|：)\s*(-?\d+(?:\.\d+)?)/i
  ]);

  if (aAbs === null) {
    const accelMatches = [...normalized.matchAll(/(-?\d+(?:\.\d+)?)\s*m\s*\/\s*s\s*(?:²|2|\^\s*2)/gi)];
    if (accelMatches.length) aAbs = Number(accelMatches[0][1]);
  }

  if (!Number.isFinite(aAbs)) {
    return { ok: false, message: failMessage };
  }

  aAbs = Math.abs(aAbs);
  if (aAbs <= 0) return { ok: false, message: failMessage };

  if (aAbs < PHYSICS_BRAKE_LIMITS.accelMin || aAbs > PHYSICS_BRAKE_LIMITS.accelMax) {
    return { ok: false, message: `识别到刹车加速度 ${smartNumber(aAbs)}m/s²，但当前演示范围为 ${PHYSICS_BRAKE_LIMITS.accelMin}–${PHYSICS_BRAKE_LIMITS.accelMax}m/s²。` };
  }

  const model = physicsBrakeModel(v0, aAbs, { mode: "constant" });
  return {
    ok: true,
    subject: "物理",
    type: "braking_distance",
    mode: "constant",
    v0,
    parameter: aAbs,
    aAbs,
    stopTime: model.stopTime,
    stopDistance: model.stopDistance,
    message: `已识别：初速度 ${smartNumber(v0)}m/s，刹车加速度 ${smartNumber(aAbs)}m/s²`
  };
}

window.parsePhysicsBrakeQuestion = parsePhysicsBrakeQuestion;

function isPhysicsBoardSliderQuestion(text) {
  const source = normalizeQuestionText(text);
  return /木板|长木板/.test(source)
    && /滑块|物块|小物块/.test(source)
    && /摩擦|动摩擦因数|相对滑动|相对运动|滑落|μ/.test(source);
}

function parsePhysicsBoardSliderQuestion(text) {
  const source = normalizeQuestionText(text);
  const scopeMessage = "当前演示支持光滑地面上，滑块以初速度滑上静止木板的典型模型。";
  const missingMessage = "当前木板—滑块模板需要滑块质量、木板质量、木板长度、初速度和动摩擦因数。";
  if (!isPhysicsBoardSliderQuestion(source)) return { ok: false, message: missingMessage };

  const unsupported = [
    /粗糙(?:的)?(?:水平)?地面|地面[^。；]{0,10}(?:粗糙|有摩擦)/,
    /斜面|斜板|倾斜木板/,
    /弹簧|碰撞|木板固定|固定木板/,
    /多个滑块|多个物块|两(?:个|块|只)(?:滑块|物块)|静摩擦临界|临界启动/,
    /(?:受到|施加|作用|用)[^。；]{0,12}(?:水平)?(?:外力|恒力|拉力)|(?:水平)?(?:外力|恒力|拉力)[^。；]{0,12}(?:作用|拉动)/
  ];
  if (unsupported.some(pattern => pattern.test(source))) return { ok: false, message: scopeMessage };
  if (/(?:最初|初始|开始)[^。；]{0,12}右端|从右端|向左(?:滑动|运动)/.test(source)) {
    return { ok: false, message: scopeMessage };
  }

  const boardInitialSpeedMatch = source.match(/(?:木板|木板B|B板)[^。；]{0,18}(?:初速度|速度)\s*(?:为|是|=|:|：)?\s*(-?\d+(?:\.\d+)?)\s*m\s*\/\s*s/i);
  if (boardInitialSpeedMatch && Math.abs(Number(boardInitialSpeedMatch[1])) > BOARD_SLIDER_LIMITS.epsilon) {
    return { ok: false, message: scopeMessage };
  }

  const equalMass = firstNumberByPatterns(source, [
    /(?:二者|两者|滑块与木板|木板与滑块)\s*(?:的)?质量\s*均\s*(?:为|是|=|:|：)?\s*(\d+(?:\.\d+)?)\s*kg/i,
    /质量\s*均\s*(?:为|是|=|:|：)?\s*(\d+(?:\.\d+)?)\s*kg/i
  ]);

  const blockMass = equalMass ?? firstNumberByPatterns(source, [
    /(?:滑块|小物块|物块)\s*A?[^。；，,]{0,18}?质量\s*(?:m\s*)?(?:为|是|=|:|：)?\s*(\d+(?:\.\d+)?)\s*kg/i,
    /质量\s*(?:为|是|=|:|：)?\s*(\d+(?:\.\d+)?)\s*kg[^。；]{0,22}?(?:滑块|小物块|物块)\s*A/i,
    /(?:^|[，,；;\s])m\s*(?:=|:|：)\s*(\d+(?:\.\d+)?)\s*kg/
  ]);
  const boardMass = equalMass ?? firstNumberByPatterns(source, [
    /(?:长木板|木板)\s*B?[^。；，,]{0,20}?质量\s*(?:M\s*)?(?:为|是|=|:|：)?\s*(\d+(?:\.\d+)?)\s*kg/,
    /质量\s*(?:为|是|=|:|：)?\s*(\d+(?:\.\d+)?)\s*kg[^。；]{0,24}?(?:长木板|木板)\s*B/,
    /(?:^|[，,；;\s])M\s*(?:=|:|：)\s*(\d+(?:\.\d+)?)\s*kg/
  ]);
  const boardLength = firstNumberByPatterns(source, [
    /(?:长木板|木板)\s*B?[^。；]{0,42}?(?:长度|长|L)\s*(?:为|是|=|:|：)?\s*(\d+(?:\.\d+)?)\s*m(?!\s*\/)/i,
    /(?:长度|板长|L)\s*(?:为|是|=|:|：)?\s*(\d+(?:\.\d+)?)\s*m(?!\s*\/)/i,
    /(?:长度|长)\s*(?:为|是|=|:|：)?\s*(\d+(?:\.\d+)?)\s*m[^。；]{0,20}?(?:长木板|木板)\s*B/i
  ]);
  const initialSpeed = firstNumberByPatterns(source, [
    /(?:初速度|初速|v\s*0)\s*(?:为|是|=|:|：)?\s*(\d+(?:\.\d+)?)\s*m\s*\/\s*s/i,
    /以\s*(\d+(?:\.\d+)?)\s*m\s*\/\s*s\s*(?:的)?初速度/i,
    /(?:滑块|物块|小物块)[^。；]{0,30}?以\s*(\d+(?:\.\d+)?)\s*m\s*\/\s*s/i
  ]);
  const frictionCoefficient = firstNumberByPatterns(source, [
    /(?:动摩擦因数|滑动摩擦因数|动摩擦系数|摩擦因数|μ)\s*(?:为|是|=|:|：)?\s*(\d+(?:\.\d+)?)/i
  ]);
  const gravityParsed = firstNumberByPatterns(source, [
    /(?:重力加速度|g)\s*(?:取|为|是|=|:|：)?\s*(\d+(?:\.\d+)?)(?:\s*m\s*\/\s*s\s*(?:2|\^\s*2))?/i
  ]);
  const gravity = gravityParsed ?? 10;
  const gravityWasDefaulted = gravityParsed === null;

  if (![blockMass, boardMass, boardLength, initialSpeed, frictionCoefficient].every(Number.isFinite)) {
    return { ok: false, message: missingMessage };
  }

  const ranges = [
    ["滑块质量", blockMass, BOARD_SLIDER_LIMITS.blockMassMin, BOARD_SLIDER_LIMITS.blockMassMax, "kg"],
    ["木板质量", boardMass, BOARD_SLIDER_LIMITS.boardMassMin, BOARD_SLIDER_LIMITS.boardMassMax, "kg"],
    ["木板长度", boardLength, BOARD_SLIDER_LIMITS.boardLengthMin, BOARD_SLIDER_LIMITS.boardLengthMax, "m"],
    ["初速度", initialSpeed, BOARD_SLIDER_LIMITS.speedMin, BOARD_SLIDER_LIMITS.speedMax, "m/s"],
    ["动摩擦因数", frictionCoefficient, BOARD_SLIDER_LIMITS.frictionMin, BOARD_SLIDER_LIMITS.frictionMax, ""],
    ["重力加速度", gravity, BOARD_SLIDER_LIMITS.gravityMin, BOARD_SLIDER_LIMITS.gravityMax, "m/s²"]
  ];
  const invalid = ranges.find(([, value, min, max]) => value < min || value > max);
  if (invalid) {
    const [label, value, min, max, unit] = invalid;
    return { ok: false, message: `识别到${label} ${boardSliderNumber(value)}${unit}，当前演示范围为 ${min}–${max}${unit}。` };
  }

  const params = {
    blockMass,
    boardMass,
    boardLength,
    frictionCoefficient,
    initialSpeed,
    gravity,
    gravityWasDefaulted
  };
  const model = boardSliderModel(params);
  const gravityNote = gravityWasDefaulted ? "｜未识别到g，当前按10m/s²计算" : "";
  const recognitionText = `${model.recognitionText}｜相对加速度大小=${boardSliderNumber(model.relativeDeceleration)}m/s²｜最大相对位移=${boardSliderNumber(model.relativeStopDistance)}m${gravityNote}`;
  return {
    ok: true,
    subject: "物理",
    type: "board_slider",
    direction: "right",
    ...params,
    params,
    model,
    recognitionText,
    message: `已识别木板—滑块相对运动题：${model.outcomeLabel}`
  };
}

window.parsePhysicsBoardSliderQuestion = parsePhysicsBoardSliderQuestion;

function parsePhysicsSolenoidQuestion(text) {
  const normalized = normalizeQuestionText(text);
  const failMessage = "当前电磁学演示支持通电螺线管磁极判断题，请输入包含电流、匝数、观察端和顺/逆时针绕向的题目。";
  if (!/螺线管|电磁铁|线圈|磁极|安培定则|铁芯/.test(normalized)) {
    return { ok: false, message: failMessage };
  }

  let current = null;
  const currentMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(mA|毫安|A|安)/i);
  if (currentMatch) {
    current = Number(currentMatch[1]);
    if (/mA|毫安/i.test(currentMatch[2])) current /= 1000;
  }

  const turns = firstNumberByPatterns(normalized, [
    /(\d+(?:\.\d+)?)\s*匝/,
    /匝数\s*(?:为|是|=|:|：)?\s*(\d+(?:\.\d+)?)/,
    /(\d+(?:\.\d+)?)\s*(?:圈|组线圈)/
  ]);

  const viewEnd = /右端|从右/.test(normalized) ? "right" : "left";
  let windingDirection = null;
  if (/逆时针|逆时針|counterclockwise/i.test(normalized)) windingDirection = "counterclockwise";
  if (/顺时针|順时針|clockwise/i.test(normalized)) windingDirection = "clockwise";
  const hasFutureCoreChange = /若|如果|将/.test(normalized) && /插入铁芯|加入铁芯/.test(normalized);
  const hasCore = !hasFutureCoreChange && /已插入铁芯|插有铁芯|装有铁芯|有铁芯/.test(normalized) && !/无铁芯|未插入|拔出/.test(normalized);

  if (!Number.isFinite(current) || !Number.isFinite(turns) || !windingDirection) {
    return { ok: false, message: failMessage };
  }
  if (current < SOLENOID_LIMITS.currentMin || current > SOLENOID_LIMITS.currentMax) {
    return { ok: false, message: `识别到电流 ${formatAmp(current)}A，但当前演示范围为 ${SOLENOID_LIMITS.currentMin}–${SOLENOID_LIMITS.currentMax}A。` };
  }
  if (turns < SOLENOID_LIMITS.turnsMin || turns > SOLENOID_LIMITS.turnsMax) {
    return { ok: false, message: `识别到线圈 ${Math.round(turns)}匝，但当前演示范围为 ${SOLENOID_LIMITS.turnsMin}–${SOLENOID_LIMITS.turnsMax}匝。` };
  }

  const model = solenoidModel(current, turns, viewEnd, windingDirection, hasCore);
  return {
    ok: true,
    subject: "物理",
    type: "solenoid_electromagnet",
    current,
    turns,
    viewEnd,
    windingDirection,
    hasCore,
    leftPole: model.leftPole,
    rightPole: model.rightPole,
    strengthLevel: model.strengthLevel,
    message: `已识别：从${solenoidViewText(viewEnd)}观察电流为${solenoidDirectionText(windingDirection)}，${solenoidViewText(viewEnd)}为${model.observedPole}极`,
    recognitionText: buildPhysicsSolenoidContent(current, turns, { viewEnd, windingDirection, hasCore }).recognitionText
  };
}

window.parsePhysicsSolenoidQuestion = parsePhysicsSolenoidQuestion;

function parsePhysicsProjectileQuestion(text) {
  const normalized = normalizeQuestionText(text);
  const failMessage = "当前物理演示支持平抛运动模板，请输入含有水平速度和高度的平抛题。";
  if (!/平抛|水平抛|水平速度|水平位移|落地|抛出|平台/.test(normalized)) {
    return { ok: false, message: failMessage };
  }

  let speed = firstNumberByPatterns(normalized, [
    /(?:水平速度|水平初速度|v\s*0|v₀)\s*(?:为|是|=|:|：)?\s*(\d+(?:\.\d+)?)\s*m\s*\/\s*s/i,
    /以\s*(\d+(?:\.\d+)?)\s*m\s*\/\s*s\s*(?:的)?水平速度/i,
    /(\d+(?:\.\d+)?)\s*m\s*\/\s*s\s*(?:的)?水平速度/i
  ]);

  if (speed === null) {
    const speedMatches = [...normalized.matchAll(/(\d+(?:\.\d+)?)\s*m\s*\/\s*s(?!\s*(?:²|2|\^\s*2))/gi)];
    if (speedMatches.length) speed = Number(speedMatches[0][1]);
  }

  let height = firstNumberByPatterns(normalized, [
    /(?:高度|高|距地面|离地面|平台高|平台高度)\s*(?:为|是|=|:|：)?\s*(\d+(?:\.\d+)?)\s*m/i,
    /从\s*(\d+(?:\.\d+)?)\s*m\s*(?:高|高度)?(?:的)?(?:平台|处)/i,
    /(\d+(?:\.\d+)?)\s*m\s*高/i
  ]);

  if (!Number.isFinite(speed) || !Number.isFinite(height)) {
    return { ok: false, message: failMessage };
  }
  if (speed < PROJECTILE_LIMITS.speedMin || speed > PROJECTILE_LIMITS.speedMax) {
    return { ok: false, message: `识别到水平速度 ${smartNumber(speed)}m/s，但当前演示范围为 ${PROJECTILE_LIMITS.speedMin}–${PROJECTILE_LIMITS.speedMax}m/s。` };
  }
  if (height < PROJECTILE_LIMITS.heightMin || height > PROJECTILE_LIMITS.heightMax) {
    return { ok: false, message: `识别到高度 ${smartNumber(height)}m，但当前演示范围为 ${PROJECTILE_LIMITS.heightMin}–${PROJECTILE_LIMITS.heightMax}m。` };
  }

  const model = projectileModel(speed, height);
  return {
    ok: true,
    subject: "物理",
    type: "projectile_motion",
    speed,
    height,
    fallTime: model.fallTime,
    range: model.range,
    message: `已识别：水平速度 ${smartNumber(speed)}m/s，高度 ${smartNumber(height)}m`,
    recognitionText: buildPhysicsProjectileContent(speed, height).recognitionText
  };
}

window.parsePhysicsProjectileQuestion = parsePhysicsProjectileQuestion;

function parsePhysicsCircuitQuestion(text) {
  const normalized = normalizeQuestionText(text).replace(/Ω/g, "欧");
  const failMessage = "当前物理演示支持欧姆定律纯电阻电路题，请输入电压和电阻。";
  if (!/欧姆|电压|电阻|电流|纯电阻|电路|欧/.test(normalized)) {
    return { ok: false, message: failMessage };
  }

  let voltage = firstNumberByPatterns(normalized, [
    /(?:电压|U)\s*(?:为|是|=|:|：)?\s*(\d+(?:\.\d+)?)\s*V/i,
    /两端(?:电压)?\s*(?:为|是|=|:|：)?\s*(\d+(?:\.\d+)?)\s*V/i,
    /(\d+(?:\.\d+)?)\s*V\s*(?:电压|电源)?/i
  ]);

  let resistance = firstNumberByPatterns(normalized, [
    /(?:电阻|R|阻值)\s*(?:为|是|=|:|：)?\s*(\d+(?:\.\d+)?)\s*(?:欧|ohm|Ω)/i,
    /(\d+(?:\.\d+)?)\s*(?:欧|ohm|Ω)\s*(?:电阻|阻值)?/i
  ]);

  if (!Number.isFinite(voltage) || !Number.isFinite(resistance)) {
    return { ok: false, message: failMessage };
  }
  if (voltage < CIRCUIT_LIMITS.voltageMin || voltage > CIRCUIT_LIMITS.voltageMax) {
    return { ok: false, message: `识别到电压 ${smartNumber(voltage)}V，但当前演示范围为 ${CIRCUIT_LIMITS.voltageMin}–${CIRCUIT_LIMITS.voltageMax}V。` };
  }
  if (resistance < CIRCUIT_LIMITS.resistanceMin || resistance > CIRCUIT_LIMITS.resistanceMax) {
    return { ok: false, message: `识别到电阻 ${smartNumber(resistance)}Ω，但当前演示范围为 ${CIRCUIT_LIMITS.resistanceMin}–${CIRCUIT_LIMITS.resistanceMax}Ω。` };
  }

  const model = circuitModel(voltage, resistance);
  return {
    ok: true,
    subject: "物理",
    type: "ohms_law_circuit",
    voltage,
    resistance,
    current: model.current,
    power: model.power,
    message: `已识别：电压 ${smartNumber(voltage)}V，电阻 ${smartNumber(resistance)}Ω`,
    recognitionText: buildPhysicsCircuitContent(voltage, resistance).recognitionText
  };
}

window.parsePhysicsCircuitQuestion = parsePhysicsCircuitQuestion;

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
  const failMessage = "当前数学演示支持简单函数切线斜率题，请输入类似 y=2x^2、y=lnx，并给出或默认观察 x 值。";
  const expression = extractMathExpression(text);
  const model = createMathModelFromExpression(expression || "x^2");
  const normalized = normalizeQuestionText(text);
  const hasTangentTask = /切线|斜率|导数|变化|观察/.test(normalized);
  if (!model || (!expression && !/抛物线/.test(normalized)) || (!hasTangentTask && !expression)) {
    return { ok: false, message: failMessage };
  }
  const x = extractMathX(text, model);
  if (x < model.domainMin || x > model.domainMax) {
    return { ok: false, message: `识别到 x = ${formatMathNumber(x)}，但函数 y = ${model.expression} 的当前演示范围为 ${formatMathNumber(model.domainMin)} 到 ${formatMathNumber(model.domainMax)}。` };
  }
  const y = model.value(x);
  const slope = model.derivative(x);
  if (!Number.isFinite(y) || !Number.isFinite(slope)) return { ok: false, message: failMessage };
  return {
    ok: true,
    subject: "数学",
    type: "function_tangent_slope",
    model,
    modelSpec: model.spec,
    expression: model.expression,
    derivativeText: model.derivativeText,
    x,
    y,
    slope,
    recognitionText: `函数 y = ${model.expression}｜导数 y′ = ${model.derivativeText}｜x = ${formatMathNumber(x)}｜y = ${formatMathNumber(y)}｜切线斜率 k = ${formatMathNumber(slope)}`
  };
}

window.parseMathTangentQuestion = parseMathTangentQuestion;

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
  if (state.subject === "物理" && state.physicsTemplate === "brake") return physicsBrakeModel().duration;
  if (state.subject === "物理" && state.physicsTemplate === "boardSlider") return boardSliderModel().endTime;
  if (state.subject === "物理" && state.physicsTemplate === "solenoid") return 8;
  if (state.subject === "物理" && state.physicsTemplate === "projectile") return projectileModel().fallTime;
  if (state.subject === "物理" && state.physicsTemplate === "circuit") return 6;
  if (state.subject === "物理" && isExtraPhysicsTemplate()) return 6;
  if (state.subject === "数学") return 8 / state.p2;
  return 8;
}

function valuesAt(time) {
  const t = Math.min(time, duration());
  const progress = Math.min(1, t / duration());

  if (state.subject === "物理" && state.physicsTemplate === "brake") {
    const model = physicsBrakeModel();
    if (model.mode === "linear_drag") {
      const decay = Math.exp(-(model.k / model.mass) * t);
      const speed = model.v0 * decay;
      const distance = model.stopDistance * (1 - decay);
      const experimentProgress = Math.min(1, distance / model.stopDistance);
      return {
        progress: experimentProgress,
        experimentProgress,
        timelineProgress: t / model.duration,
        metrics: [speed, distance, t],
        brake: model
      };
    }
    const speed = Math.max(0, model.v0 - model.aAbs * t);
    const distance = model.v0 * t - 0.5 * model.aAbs * t * t;
    const experimentProgress = Math.min(1, distance / model.stopDistance);
    return {
      progress: experimentProgress,
      experimentProgress,
      timelineProgress: t / model.duration,
      metrics: [speed, distance, t],
      brake: model
    };
  }

  if (state.subject === "物理" && state.physicsTemplate === "boardSlider") {
    return boardSliderValuesAt(t);
  }

  if (state.subject === "物理" && state.physicsTemplate === "solenoid") {
    const solenoid = solenoidModel();
    return {
      progress,
      metrics: [solenoid.leftPole, solenoid.rightPole, solenoid.strengthLevel],
      solenoid
    };
  }

  if (state.subject === "物理" && state.physicsTemplate === "projectile") {
    const projectile = projectileModel();
    const localT = Math.min(t, projectile.fallTime);
    const x = projectile.speed * localT;
    const yDrop = 0.5 * projectile.gravity * localT * localT;
    return {
      progress,
      timelineProgress: progress,
      metrics: [projectile.speed, localT, x],
      projectile: { ...projectile, t: localT, x, yDrop }
    };
  }

  if (state.subject === "物理" && state.physicsTemplate === "circuit") {
    const circuit = circuitModel();
    return {
      progress,
      timelineProgress: progress,
      metrics: [circuit.voltage, circuit.resistance, circuit.current],
      circuit
    };
  }

  if (state.subject === "物理" && isExtraPhysicsTemplate()) {
    const content = buildExtraPhysicsContent();
    return {
      progress,
      timelineProgress: progress,
      metrics: content.model.metrics,
      extraPhysics: content
    };
  }

  if (state.subject === "化学") {
    const chem = chemistryFeCuSO4Model(state.p1, state.p2);
    return { progress, metrics: [chem.feMass, chem.cuMol, chem.cuMass], chem };
  }

  if (state.subject === "数学") {
    const x = state.p1;
    const model = currentMathModel();
    const y = model.value(x);
    const slope = model.derivative(x);
    return { progress: 0, timelineProgress: 0, metrics: [x, slope, y], x, y, slope };
  }

  return { progress, metrics: [currentCellOrganelles().length, Math.round(state.cellRotateY), t] };
}

function formatNumber(value) {
  return Number(value).toFixed(1);
}

function formatMetricValue(value, index) {
  if (typeof value === "string") return value;
  if (state.subject === "化学") {
    if (index === 1) return formatMol(value);
    return formatGram(value);
  }
  if (state.subject === "数学" && index < 3) return smartNumber(value);
  if (state.subject === "生物" && index < 2) return Number(value).toFixed(0);
  if (state.subject === "物理" && state.physicsTemplate === "projectile") {
    if (index === 1) return smartNumber(value, 2);
    return smartNumber(value, 1);
  }
  if (state.subject === "物理" && state.physicsTemplate === "circuit") {
    if (index === 2) return smartNumber(value, 2);
    return smartNumber(value, 1);
  }
  if (state.subject === "物理" && state.physicsTemplate === "boardSlider") return smartNumber(value, index === 2 ? 3 : 2);
  if (state.subject === "物理" && isExtraPhysicsTemplate()) return smartNumber(value, index === 2 ? 2 : 1);
  return formatNumber(value);
}

function mathGraphBounds(model = currentMathModel()) {
  const values = [0];
  const minX = model.domainMin;
  const maxX = model.domainMax;
  for (let i = 0; i <= 96; i += 1) {
    const x = minX + ((maxX - minX) * i) / 96;
    const y = model.value(x);
    if (Number.isFinite(y)) values.push(y);
  }
  const currentY = model.value(state.p1);
  if (Number.isFinite(currentY)) values.push(currentY);
  let minY = Math.min(...values);
  let maxY = Math.max(...values);
  if (Math.abs(maxY - minY) < 0.1) {
    maxY += 1;
    minY -= 1;
  }
  const pad = Math.max(0.3, (maxY - minY) * 0.14);
  return {
    minX,
    maxX,
    minY: minY - pad,
    maxY: maxY + pad
  };
}

function mathSvgPoint(x, model = currentMathModel(), bounds = mathGraphBounds(model)) {
  const y = model.value(x);
  const safeY = Number.isFinite(y) ? y : 0;
  const cx = 70 + ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * 460;
  const cy = 230 - ((safeY - bounds.minY) / (bounds.maxY - bounds.minY)) * 200;
  return {
    x,
    y: safeY,
    cx,
    cy
  };
}

function mathParabolaPath(model = currentMathModel(), bounds = mathGraphBounds(model)) {
  const points = [];
  let started = false;
  for (let i = 0; i <= 120; i += 1) {
    const x = bounds.minX + ((bounds.maxX - bounds.minX) * i) / 120;
    const y = model.value(x);
    if (!Number.isFinite(y)) {
      started = false;
      continue;
    }
    const point = mathSvgPoint(x, model, bounds);
    points.push(`${started ? "L" : "M"}${smartNumber(point.cx, 1)} ${smartNumber(point.cy, 1)}`);
    started = true;
  }
  return points.join(" ");
}

function updateMathAxis(model, bounds) {
  const axisY = $(".axis-y");
  const axisX = $(".axis-x");
  const axisYLabel = $(".math-axis-y");
  const axisXLabel = $(".math-axis-x");
  const xRange = bounds.maxX - bounds.minX;
  const yRange = bounds.maxY - bounds.minY;
  const yAxisPercent = clamp((0 - bounds.minX) / xRange, 0, 1) * 80 + 10;
  const xAxisBottom = 58 + (1 - clamp((0 - bounds.minY) / yRange, 0, 1)) * 200;
  if (axisY) axisY.style.left = `${yAxisPercent}%`;
  if (axisYLabel) axisYLabel.style.left = `${Math.min(90, yAxisPercent + 1)}%`;
  if (axisX) axisX.style.bottom = `${xAxisBottom}px`;
  if (axisXLabel) axisXLabel.style.bottom = `${xAxisBottom + 8}px`;

  const midX = bounds.minX <= 0 && bounds.maxX >= 0 ? 0 : (bounds.minX + bounds.maxX) / 2;
  const ticks = [
    [$(".tick-x-left"), bounds.minX, 10],
    [$(".tick-x-mid"), midX, 10 + ((midX - bounds.minX) / xRange) * 80],
    [$(".tick-x-right"), bounds.maxX, 90]
  ];
  ticks.forEach(([node, value, left]) => {
    if (!node) return;
    node.textContent = formatMathNumber(value);
    node.style.left = `${left}%`;
  });
  const topTick = $(".tick-y-top");
  if (topTick) topTick.textContent = formatMathNumber(bounds.maxY);
}

function formatTime(seconds) {
  const rounded = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(rounded / 60)).padStart(2, "0")}:${String(rounded % 60).padStart(2, "0")}`;
}

function formatTimelineTime(seconds) {
  if (
    state.subject === "物理" &&
    ["brake", "boardSlider", "projectile"].includes(state.physicsTemplate)
  ) {
    return `${Math.max(0, Number(seconds) || 0).toFixed(2)}s`;
  }
  return formatTime(seconds);
}

function experimentPlaybackTimeScale() {
  if (state.subject !== "物理") return 1;
  const physicalDuration = Math.max(0.01, duration());
  let presentationDuration = physicalDuration;
  if (state.physicsTemplate === "boardSlider") {
    presentationDuration = clamp(physicalDuration * 2 + 1, 2.8, 4.5);
  } else if (state.physicsTemplate === "projectile") {
    presentationDuration = clamp(physicalDuration * 1.25 + 2.2, 3.2, 5.5);
  } else if (state.physicsTemplate === "brake") {
    presentationDuration = state.brakeMode === "linear_drag"
      ? clamp(physicalDuration * 0.7 + 2, 4, 8)
      : clamp(physicalDuration, 3.2, 8);
  }
  return physicalDuration / presentationDuration;
}

function resizeSolenoidCanvas() {
  const canvas = elements.solenoidCanvas;
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(rect.width * dpr);
  const height = Math.round(rect.height * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { canvas, ctx, width: rect.width, height: rect.height };
}

function solenoidRenderState(time = performance.now()) {
  const model = solenoidModel();
  return {
    current: model.current,
    turns: model.turns,
    core: model.hasCore,
    reversed: model.leftPole === "S",
    leftPole: model.leftPole,
    rightPole: model.rightPole,
    strength: model.visualStrength,
    yaw: (-0.18 + state.solenoidRotateY * Math.PI / 180),
    pitch: (-0.12 + state.solenoidRotateX * Math.PI / 180),
    zoom: state.solenoidZoom || 1,
    time: state.solenoidPaused ? 0 : time
  };
}

function rotateSolenoidPoint(point, renderState) {
  const cy = Math.cos(renderState.yaw);
  const sy = Math.sin(renderState.yaw);
  const cp = Math.cos(renderState.pitch);
  const sp = Math.sin(renderState.pitch);
  const x1 = point.x * cy + point.z * sy;
  const z1 = -point.x * sy + point.z * cy;
  const y1 = point.y * cp - z1 * sp;
  const z2 = point.y * sp + z1 * cp;
  return { x: x1, y: y1, z: z2 };
}

function projectSolenoidPoint(point, renderState, bounds) {
  const rotated = rotateSolenoidPoint(point, renderState);
  const scale = renderState.zoom * Math.min(bounds.width / 780, bounds.height / 500) * 1.12;
  const perspective = 820 / (820 + rotated.z);
  return {
    x: bounds.width * 0.5 + rotated.x * scale * perspective,
    y: bounds.height * 0.54 + rotated.y * scale * perspective,
    depth: rotated.z,
    scale: scale * perspective
  };
}

function drawSolenoidPath(ctx, points, renderState, bounds, stroke, width, alpha = 1, dash = null) {
  if (!points.length) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  points.forEach((point, index) => {
    const projected = projectSolenoidPoint(point, renderState, bounds);
    if (index === 0) ctx.moveTo(projected.x, projected.y);
    else ctx.lineTo(projected.x, projected.y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawSolenoidArrow(ctx, start, end, renderState, bounds, color, size = 7, alpha = 1) {
  const p1 = projectSolenoidPoint(start, renderState, bounds);
  const p2 = projectSolenoidPoint(end, renderState, bounds);
  const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.translate(p2.x, p2.y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, size * 0.55);
  ctx.lineTo(-size, -size * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function solenoidFieldPoint(t, radius, plane) {
  let x;
  let radial;
  if (t <= Math.PI) {
    x = -270 * Math.cos(t);
    radial = radius * Math.sin(t);
  } else {
    const u = (t - Math.PI) / Math.PI;
    x = 270 - u * 540;
    radial = 12 * Math.sin(u * Math.PI);
  }
  return { x, y: radial * Math.cos(plane), z: radial * Math.sin(plane) };
}

function drawSolenoidFieldLines(ctx, renderState, bounds) {
  const relative = Math.min(2.4, (renderState.current / 0.5) * (renderState.turns / 200) * (renderState.core ? 1.65 : 1));
  const alpha = 0.18 + Math.min(0.42, relative * 0.14);
  const radii = relative > 1.3 ? [98, 136, 174] : [110, 158];
  const planes = relative > 2 ? [0, Math.PI / 3, 2 * Math.PI / 3] : [0, Math.PI / 2];
  planes.forEach((plane) => {
    radii.forEach((radius, index) => {
      const points = [];
      for (let i = 0; i <= 100; i += 1) {
        points.push(solenoidFieldPoint(i / 100 * Math.PI * 2, radius, plane));
      }
      drawSolenoidPath(ctx, points, renderState, bounds, "#1b71d8", 1.4 + relative * 0.18, Math.max(0.12, alpha - index * 0.035), [8, 8]);
      const direction = renderState.reversed ? -1 : 1;
      const t1 = direction > 0 ? 0.62 : 0.38;
      const t2 = t1 + direction * 0.035;
      drawSolenoidArrow(
        ctx,
        solenoidFieldPoint(t1 * Math.PI, radius, plane),
        solenoidFieldPoint(t2 * Math.PI, radius, plane),
        renderState,
        bounds,
        "#1f69e8",
        7,
        0.65
      );
    });
  });
}

function roundedCanvasRect(ctx, x, y, width, height, radius) {
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
}

function drawSolenoidCore(ctx, renderState, bounds) {
  const start = projectSolenoidPoint({ x: -215, y: 0, z: 0 }, renderState, bounds);
  const end = projectSolenoidPoint({ x: 215, y: 0, z: 0 }, renderState, bounds);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const radius = 32 * (start.scale + end.scale) / 2;
  ctx.save();
  ctx.translate(start.x, start.y);
  ctx.rotate(angle);
  const gradient = ctx.createLinearGradient(0, -radius, 0, radius);
  if (renderState.core) {
    gradient.addColorStop(0, "#687385");
    gradient.addColorStop(0.46, "#d1d8e3");
    gradient.addColorStop(1, "#596575");
    ctx.globalAlpha = 0.96;
  } else {
    gradient.addColorStop(0, "#dce7f2");
    gradient.addColorStop(0.5, "#fbfdff");
    gradient.addColorStop(1, "#c9d7e8");
    ctx.globalAlpha = 0.36;
  }
  ctx.fillStyle = gradient;
  ctx.beginPath();
  roundedCanvasRect(ctx, 0, -radius, length, radius * 2, radius);
  ctx.fill();
  ctx.strokeStyle = renderState.core ? "#657283" : "#a9bdd4";
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.restore();
}

function drawSolenoidInternalField(ctx, renderState, bounds) {
  [-13, 0, 13].forEach((offset) => {
    const points = [];
    for (let i = 0; i <= 34; i += 1) {
      points.push({ x: -205 + i * 12, y: offset, z: 4 });
    }
    drawSolenoidPath(ctx, points, renderState, bounds, "#1f69e8", 1.5, renderState.core ? 0.72 : 0.48, [5, 5]);
  });
  const direction = renderState.reversed ? 1 : -1;
  drawSolenoidArrow(
    ctx,
    { x: direction > 0 ? -28 : 28, y: 0, z: 8 },
    { x: direction > 0 ? 28 : -28, y: 0, z: 8 },
    renderState,
    bounds,
    "#1f69e8",
    8,
    0.9
  );
}

function drawSolenoidCoil(ctx, renderState, bounds) {
  const visibleTurns = Math.round(13 + (renderState.turns - 100) / 400 * 12);
  const segments = visibleTurns * 22;
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const u = i / segments;
    const angle = u * Math.PI * 2 * visibleTurns;
    points.push({ x: -220 + u * 440, y: Math.cos(angle) * 56, z: Math.sin(angle) * 56 });
  }

  for (let i = 0; i < points.length - 1; i += 1) {
    const p = projectSolenoidPoint(points[i], renderState, bounds);
    const q = projectSolenoidPoint(points[i + 1], renderState, bounds);
    const depth = Math.max(0, Math.min(1, (p.depth + 280) / 560));
    ctx.save();
    ctx.strokeStyle = depth > 0.5 ? "#f39a56" : "#9d4327";
    ctx.globalAlpha = 0.7 + depth * 0.3;
    ctx.lineWidth = 2.2 + depth * 1.9;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
    ctx.restore();
  }

  const speed = renderState.reversed ? -1 : 1;
  const timeFactor = renderState.time * 0.00008 * speed;
  for (let index = 0; index < 8; index += 1) {
    let u = (index / 8 + timeFactor) % 1;
    if (u < 0) u += 1;
    const nextU = Math.max(0, Math.min(1, u + 0.006 * speed));
    const angle = u * Math.PI * 2 * visibleTurns;
    const nextAngle = nextU * Math.PI * 2 * visibleTurns;
    const start = { x: -220 + u * 440, y: Math.cos(angle) * 56, z: Math.sin(angle) * 56 };
    const end = { x: -220 + nextU * 440, y: Math.cos(nextAngle) * 56, z: Math.sin(nextAngle) * 56 };
    drawSolenoidArrow(ctx, start, end, renderState, bounds, "#fff4d0", 7, 0.95);
  }
}

function solenoidDipoleField(pos, renderState) {
  const m = renderState.reversed ? 1 : -1;
  const x = pos.x / 100;
  const y = pos.y / 100;
  const r2 = x * x + y * y + 0.45;
  const r5 = Math.pow(r2, 2.5);
  return {
    x: (3 * x * (m * x) / r5) - m / Math.pow(r2, 1.5),
    y: 3 * y * (m * x) / r5
  };
}

function drawSolenoidCompass(ctx, pos, renderState, bounds) {
  const center = projectSolenoidPoint({ x: pos.x, y: pos.y, z: 8 }, renderState, bounds);
  const field = solenoidDipoleField(pos, renderState);
  const tip = projectSolenoidPoint({ x: pos.x + field.x * 26, y: pos.y + field.y * 26, z: 8 }, renderState, bounds);
  const angle = Math.atan2(tip.y - center.y, tip.x - center.x);
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.fillStyle = "rgba(255,255,255,.88)";
  ctx.strokeStyle = "#9fb3c8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.rotate(angle);
  ctx.fillStyle = "#e34a5f";
  ctx.beginPath();
  ctx.moveTo(11, 0);
  ctx.lineTo(-1, 3.4);
  ctx.lineTo(-1, -3.4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#2567e8";
  ctx.beginPath();
  ctx.moveTo(-11, 0);
  ctx.lineTo(1, 3.4);
  ctx.lineTo(1, -3.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#526b86";
  ctx.font = "800 10px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("磁针", center.x, center.y + 27);
  ctx.restore();
}

function drawSolenoidPoleLabel(ctx, world, pole, renderState, bounds) {
  const point = projectSolenoidPoint(world, renderState, bounds);
  ctx.save();
  ctx.font = "900 22px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const gradient = ctx.createLinearGradient(point.x - 22, point.y - 22, point.x + 22, point.y + 22);
  if (pole === "N") {
    gradient.addColorStop(0, "#ff6874");
    gradient.addColorStop(1, "#d83246");
  } else {
    gradient.addColorStop(0, "#4b8dff");
    gradient.addColorStop(1, "#1749c8");
  }
  ctx.shadowColor = "rgba(31, 72, 132, .18)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 9;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(255,255,255,.9)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.fillText(pole, point.x, point.y + 1);
  ctx.restore();
}

function drawSolenoidClips(ctx, renderState, bounds) {
  const pull = 1 + renderState.strength * 38;
  const baseX = 300 - pull;
  const opacity = 0.32 + renderState.strength * 0.55;
  ctx.save();
  ctx.globalAlpha = opacity;
  for (let i = 0; i < 4; i += 1) {
    const p = projectSolenoidPoint({ x: baseX + i * 18, y: 76 + (i % 2) * 9, z: 10 }, renderState, bounds);
    ctx.strokeStyle = "rgba(74, 91, 117, .78)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 5, 15, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSolenoidCanvas(time = performance.now()) {
  const setup = resizeSolenoidCanvas();
  if (!setup) return;
  const { ctx, width, height } = setup;
  const renderState = solenoidRenderState(time);
  ctx.clearRect(0, 0, width, height);

  const ground = ctx.createRadialGradient(width * 0.5, height * 0.72, 10, width * 0.5, height * 0.72, width * 0.42);
  ground.addColorStop(0, "rgba(61, 95, 138, .18)");
  ground.addColorStop(1, "rgba(61, 95, 138, 0)");
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, width, height);

  const bounds = { width, height };
  drawSolenoidFieldLines(ctx, renderState, bounds);
  drawSolenoidCore(ctx, renderState, bounds);
  drawSolenoidInternalField(ctx, renderState, bounds);
  drawSolenoidCoil(ctx, renderState, bounds);
  [
    { x: -285, y: -145 },
    { x: 0, y: -195 },
    { x: 285, y: -145 },
    { x: -285, y: 145 },
    { x: 0, y: 195 },
    { x: 285, y: 145 }
  ].forEach(point => drawSolenoidCompass(ctx, point, renderState, bounds));
  drawSolenoidPoleLabel(ctx, { x: -250, y: 0, z: 0 }, renderState.leftPole, renderState, bounds);
  drawSolenoidPoleLabel(ctx, { x: 250, y: 0, z: 0 }, renderState.rightPole, renderState, bounds);
  drawSolenoidClips(ctx, renderState, bounds);
}

function solenoidAnimationFrame(time) {
  if (state.subject === "物理" && state.physicsTemplate === "solenoid" && state.hasGenerated) {
    drawSolenoidCanvas(time);
  }
  requestAnimationFrame(solenoidAnimationFrame);
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

  if (state.subject === "物理" && state.physicsTemplate === "brake") {
    const model = values.brake || physicsBrakeModel();
    const content = buildPhysicsBrakeContent();
    elements.scene.classList.toggle("brake-friction", model.mode === "friction");
    elements.scene.classList.toggle("brake-linear", model.mode === "linear_drag");
    const forceLevel = model.mode === "linear_drag"
      ? clamp(values.metrics[0] / model.v0, 0.08, 1)
      : model.mode === "friction"
        ? clamp(model.mu / PHYSICS_FRICTION_BRAKE_LIMITS.muMax, 0.08, 1)
        : clamp(model.aAbs / PHYSICS_BRAKE_LIMITS.accelMax, 0.08, 1);
    elements.scene.style.setProperty("--brake-force-level", String(forceLevel));
    if (elements.stopDistanceCaption) elements.stopDistanceCaption.textContent = model.markerLabel;
    if (elements.brakeModelLabel) elements.brakeModelLabel.textContent = content.indicatorLabel;
    if (elements.brakeModelFormula) setFormulaHtml(elements.brakeModelFormula, content.indicatorFormula);
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

  if (state.subject === "物理" && state.physicsTemplate === "boardSlider") {
    renderBoardSliderScene(values);
  }

  if (state.subject === "物理" && state.physicsTemplate === "solenoid") {
    const model = values.solenoid || solenoidModel();
    const strength = model.visualStrength;
    const density = clamp((model.turns - SOLENOID_LIMITS.turnsMin) / (SOLENOID_LIMITS.turnsMax - SOLENOID_LIMITS.turnsMin));
    elements.scene.style.setProperty("--solenoid-strength", String(strength));
    elements.scene.style.setProperty("--solenoid-opacity", String(0.34 + strength * 0.44));
    elements.scene.style.setProperty("--solenoid-field-width", `${2.2 + strength * 2}px`);
    elements.scene.style.setProperty("--solenoid-inner-field-width", `${2 + strength * 1.6}px`);
    elements.scene.style.setProperty("--solenoid-coil-width", `${14 + density * 8}px`);
    elements.scene.style.setProperty("--solenoid-clip-shift", `${strength * -22}px`);
    elements.scene.style.setProperty("--solenoid-extra-clip-opacity", String(0.15 + strength * 0.85));
    elements.scene.style.setProperty("--solenoid-rotate-x", `${state.solenoidRotateX}deg`);
    elements.scene.style.setProperty("--solenoid-rotate-y", `${state.solenoidRotateY}deg`);
    elements.scene.classList.toggle("solenoid-reversed", model.isReversed);
    elements.scene.classList.toggle("solenoid-core-on", model.hasCore);
    elements.scene.classList.toggle("solenoid-paused", state.solenoidPaused);
    const leftPole = $("#solenoidLeftPole");
    const rightPole = $("#solenoidRightPole");
    if (leftPole) {
      leftPole.textContent = model.leftPole;
      leftPole.dataset.pole = model.leftPole;
    }
    if (rightPole) {
      rightPole.textContent = model.rightPole;
      rightPole.dataset.pole = model.rightPole;
    }
    const viewText = $("#solenoidViewText");
    const coreText = $("#solenoidCoreText");
    const ruleText = $("#solenoidRuleText");
    const currentText = $("#solenoidCurrentText");
    const turnsText = $("#solenoidTurnsText");
    const coreStateText = $("#solenoidCoreStateText");
    const strengthText = $("#solenoidStrengthText");
    if (viewText) viewText.textContent = solenoidViewText(model.viewEnd);
    if (coreText) coreText.textContent = model.hasCore ? "已插入" : "未插入";
    if (ruleText) {
      const observed = model.viewEnd === "left" ? `左端为 ${model.leftPole} 极` : `右端为 ${model.rightPole} 极`;
      ruleText.textContent = `从${solenoidViewText(model.viewEnd)}观察${solenoidDirectionText(model.windingDirection)} → ${observed}`;
    }
    if (currentText) currentText.textContent = `${formatAmp(model.current)}A`;
    if (turnsText) turnsText.textContent = `${Math.round(model.turns)}匝`;
    if (coreStateText) coreStateText.textContent = model.hasCore ? "已插入" : "未插入";
    if (strengthText) strengthText.textContent = model.strengthLevel;
    drawSolenoidCanvas();
  }

  if (state.subject === "物理" && state.physicsTemplate === "projectile") {
    const model = values.projectile || projectileModel();
    const progress = values.progress ?? 0;
    const xPct = 18 + progress * 66;
    const worldHeight = elements.projectileBall?.parentElement?.clientHeight || 300;
    const ballRadius = (elements.projectileBall?.offsetHeight || 30) / 2;
    const groundTop = worldHeight - 68;
    const startYPct = 34;
    const landingYPct = clamp(((groundTop - ballRadius) / worldHeight) * 100, 58, 74);
    const yPct = startYPct + progress * progress * (landingYPct - startYPct);
    elements.scene.style.setProperty("--projectile-progress", String(progress));
    elements.scene.style.setProperty("--projectile-x", `${xPct}%`);
    elements.scene.style.setProperty("--projectile-y", `${yPct}%`);
    if (elements.projectileBall) {
      elements.projectileBall.style.left = `${xPct}%`;
      elements.projectileBall.style.top = `${yPct}%`;
    }
    if (elements.projectileShadow) {
      elements.projectileShadow.style.left = `${xPct}%`;
      elements.projectileShadow.style.opacity = String(0.16 + progress * 0.42);
      elements.projectileShadow.style.transform = `translateX(-50%) scale(${0.6 + progress * 0.55})`;
    }
    if (elements.projectileHeightText) elements.projectileHeightText.textContent = `${smartNumber(model.height)} m`;
    if (elements.projectileResultText) {
      elements.projectileResultText.textContent = `t = ${smartNumber(model.fallTime, 2)}s，x = ${smartNumber(model.range, 1)}m`;
    }
    if (elements.projectileTimeText) elements.projectileTimeText.textContent = `${smartNumber(model.fallTime, 2)}s`;
    if (elements.projectileRangeText) elements.projectileRangeText.textContent = `${smartNumber(model.range, 1)}m`;
    if (elements.projectileVyText) elements.projectileVyText.textContent = `${smartNumber(model.verticalSpeed, 1)}m/s`;
  }

  if (state.subject === "物理" && state.physicsTemplate === "circuit") {
    const model = values.circuit || circuitModel();
    elements.scene.style.setProperty("--circuit-current", String(clamp(model.current / 4, 0.12, 1)));
    elements.scene.style.setProperty("--circuit-speed", `${3.8 - clamp(model.current / 4, 0.12, 1) * 1.9}s`);
    if (elements.circuitVoltageText) elements.circuitVoltageText.textContent = `U = ${smartNumber(model.voltage)}V`;
    if (elements.circuitVoltmeterText) elements.circuitVoltmeterText.textContent = `${smartNumber(model.voltage)}V`;
    if (elements.circuitResistanceText) elements.circuitResistanceText.textContent = `R = ${smartNumber(model.resistance)}Ω`;
    if (elements.circuitCurrentText) elements.circuitCurrentText.textContent = `${smartNumber(model.current, 2)}A`;
    if (elements.circuitResultText) elements.circuitResultText.textContent = `I = ${smartNumber(model.voltage)} ÷ ${smartNumber(model.resistance)} = ${smartNumber(model.current, 2)}A`;
    if (elements.circuitReadoutVoltage) elements.circuitReadoutVoltage.textContent = `${smartNumber(model.voltage)}V`;
    if (elements.circuitReadoutResistance) elements.circuitReadoutResistance.textContent = `${smartNumber(model.resistance)}Ω`;
    if (elements.circuitReadoutCurrent) elements.circuitReadoutCurrent.textContent = `${smartNumber(model.current, 2)}A`;
    if (elements.circuitPowerText) elements.circuitPowerText.textContent = `${smartNumber(model.power, 1)}W`;
    const pulseDuration = 3.8 - clamp(model.current / 4, 0.12, 1) * 1.9;
    document.querySelectorAll("#circuitStage .current-pulse-motion").forEach((motion) => {
      motion.setAttribute("dur", `${smartNumber(pulseDuration, 2)}s`);
    });
    if (elements.circuitResistor) {
      elements.circuitResistor.style.setProperty("--resistor-heat", String(model.brightness));
    }
  }

  if (state.subject === "物理" && isExtraPhysicsTemplate()) {
    renderExtraPhysicsVisual(values.extraPhysics || buildExtraPhysicsContent());
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
    const model = currentMathModel();
    const bounds = mathGraphBounds(model);
    const point = mathSvgPoint(x, model, bounds);
    const slope = model.derivative(x);
    const dx = (bounds.maxX - bounds.minX) * 0.16;
    const x1 = clamp(x - dx, bounds.minX, bounds.maxX);
    const x2 = clamp(x + dx, bounds.minX, bounds.maxX);
    const tangentY1 = point.y + slope * (x1 - x);
    const tangentY2 = point.y + slope * (x2 - x);
    const tangentPoint1 = mathSvgPoint(x1, { ...model, value: () => tangentY1 }, bounds);
    const tangentPoint2 = mathSvgPoint(x2, { ...model, value: () => tangentY2 }, bounds);
    $("#parabolaCurve")?.setAttribute("d", mathParabolaPath(model, bounds));
    $("#mathPoint").setAttribute("cx", point.cx);
    $("#mathPoint").setAttribute("cy", point.cy);
    $("#tangentLine").setAttribute("x1", tangentPoint1.cx);
    $("#tangentLine").setAttribute("y1", tangentPoint1.cy);
    $("#tangentLine").setAttribute("x2", tangentPoint2.cx);
    $("#tangentLine").setAttribute("y2", tangentPoint2.cy);
    $("#mathCoordinate").textContent = `(${formatMathNumber(x)}, ${formatMathNumber(point.y)})`;
    const slopeNote = $("#mathSlopeNote");
    if (slopeNote) slopeNote.textContent = `y = ${model.expression}｜k = ${formatMathNumber(slope)}`;
    updateMathAxis(model, bounds);
  }

  if (state.subject === "生物") renderCellDetail(state.selectedOrganelle);
}

function updateScene() {
  state.time = clamp(state.time, 0, duration());
  const values = valuesAt(state.time);
  values.metrics.forEach((value, index) => {
    elements.metricValues[index].textContent = formatMetricValue(value, index);
  });
  elements.timeline.value = (values.timelineProgress ?? values.progress) * 100;
  elements.currentTime.textContent = formatTimelineTime(state.time);
  updateSubjectVisuals(values);

  const completed = (values.timelineProgress ?? values.progress) >= 1;
  if (completed) {
    pauseExperiment();
    let conclusion = "";
    if (state.subject === "物理") {
      if (state.physicsTemplate === "boardSlider") {
        const model = values.boardSlider || boardSliderValuesAt(state.time).boardSlider;
        conclusion = model.conclusion;
      } else if (state.physicsTemplate === "solenoid") {
        conclusion = `左端为 ${values.solenoid.leftPole} 极，右端为 ${values.solenoid.rightPole} 极；当前磁性${values.solenoid.strengthLevel}。`;
      } else if (state.physicsTemplate === "projectile") {
        conclusion = `小球约 ${smartNumber(values.projectile.fallTime, 2)} 秒落地，水平位移约 ${smartNumber(values.projectile.range, 1)} 米。`;
      } else if (state.physicsTemplate === "circuit") {
        conclusion = `电路电流 I = ${smartNumber(values.circuit.current, 2)}A，纯电阻消耗功率 P = ${smartNumber(values.circuit.power, 2)}W。`;
      } else if (isExtraPhysicsTemplate() && values.extraPhysics) {
        conclusion = values.extraPhysics.model.conclusion;
      } else {
        const brake = values.brake || physicsBrakeModel();
        if (brake.mode === "linear_drag") {
          conclusion = `经过 ${smartNumber(brake.duration, 2)} 秒，速度衰减到初速度的 1%，位移约 ${smartNumber(values.metrics[1], 1)} 米；理论极限位移为 ${smartNumber(brake.stopDistance)} 米，速度只会渐近于 0。`;
        } else if (brake.mode === "friction") {
          conclusion = `由滑动摩擦产生 ${smartNumber(brake.aAbs)}m/s² 的减速度，车辆在 ${smartNumber(brake.duration, 2)} 秒后停止，刹车距离为 ${smartNumber(values.metrics[1], 1)} 米。`;
        } else {
          conclusion = `车辆在 ${smartNumber(brake.duration, 2)} 秒后停止，刹车距离为 ${smartNumber(values.metrics[1], 1)} 米。`;
        }
      }
    } else if (state.subject === "化学" && values.chem) {
      conclusion = `铁表面析出红色铜，溶液由蓝色变为浅绿色；${chemistryReactionJudgement(values.chem).short}，生成 Cu ${formatMol(values.chem.cuMol)}mol / ${formatGram(values.chem.cuMass)}g。`;
    } else if (state.subject === "数学") {
      conclusion = `函数 y = ${currentMathModel().expression}；当 x = ${formatMathNumber(state.p1)} 时，切线斜率 k = ${formatMathNumber(currentMathModel().derivative(state.p1))}。`;
    } else if (state.subject === "生物") {
      conclusion = `已完成植物细胞截面识别，可点击结构查看名称、类型和功能。`;
    }
    if (conclusion) elements.sceneTip.innerHTML = `<span>实验结论</span>${conclusion}`;
  }
}

function renderReasoning() {
  const steps = config().steps;
  $(".reasoning-steps").innerHTML = steps.map((step, index) => {
    const number = index + 1;
    const status = number < state.reasonStep ? "done" : number === state.reasonStep ? "active" : "";
    const statusText = number < state.reasonStep ? "已完成" : number === state.reasonStep ? "当前步骤" : "待探索";
    const icon = number < state.reasonStep ? '<path d="m5 12 4 4L19 6"/>' : '<path d="m9 18 6-6-6-6"/>';
    const formulaClass = index === 1 || /[=≈<>]|<sub>|vfrac/.test(String(step[1])) ? "formula" : "";
    return `<button class="reason-step ${status}" data-step="${number}">
      <span class="step-index">${number}</span>
      <div><small>${statusText}</small><strong>${step[0]}</strong><p class="${formulaClass}">${verticalizeFormulaHtml(step[1])}</p></div>
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
  const solenoid = buildPhysicsSolenoidContent();
  const projectile = buildPhysicsProjectileContent();
  const circuit = buildPhysicsCircuitContent();
  const boardSlider = buildPhysicsBoardSliderContent();
  const extraPhysics = isExtraPhysicsTemplate() ? buildExtraPhysicsContent() : null;
  const chemistry = buildChemistryFeCuSO4Content();
  const mathModel = currentMathModel();
  const mathValue = subject === "数学" ? state.p1 : SUBJECTS["数学"].params[0].value;
  const mathSlope = formatMathNumber(mathModel.derivative(mathValue));
  const mathX = formatMathNumber(mathValue);
  const mathY = formatMathNumber(mathModel.value(mathValue));

  const biologyConcept = state.cellType === "animal"
    ? [
        "核心概念",
        "结构定位 → 功能对应",
        `<span class="bio-concept-line"><b>边界</b>细胞膜 + 细胞质</span>
         <span class="bio-concept-line"><b>控制</b>细胞核</span>
         <span class="bio-concept-line"><b>细胞器</b>线粒体、内质网、高尔基体、核糖体</span>
         <span class="bio-concept-line"><b>区别</b>通常无细胞壁、叶绿体和中央大液泡</span>`
      ]
    : [
        "核心概念",
        "结构定位 → 功能对应",
        `<span class="bio-concept-line"><b>边界</b>细胞壁 + 细胞膜 + 细胞质</span>
         <span class="bio-concept-line"><b>细胞器</b>细胞核、叶绿体、线粒体、液泡</span>
         <span class="bio-concept-line"><b>区别</b>典型植物细胞常见细胞壁、叶绿体和较大液泡</span>`
      ];

  const physicsFormula = state.physicsTemplate === "boardSlider"
    ? [
        boardSlider.formulaLabel,
        boardSlider.formula,
        boardSlider.formulaHtml
      ]
    : extraPhysics
    ? [
        extraPhysics.model.badge,
        extraPhysics.model.formula,
        extraPhysics.formulaHtml
      ]
    : state.physicsTemplate === "solenoid"
    ? [
        "安培定则",
        "四指沿传统电流方向，大拇指指向 N 极",
        solenoid.formulaHtml
      ]
    : state.physicsTemplate === "projectile"
      ? [
          "运动合成",
          "h = 1/2gt²，x = v₀t",
          projectile.formulaHtml
        ]
        : state.physicsTemplate === "circuit"
        ? [
            "欧姆定律",
            "I = U / R",
            circuit.formulaHtml
          ]
        : [
            physics.formulaLabel,
            physics.formula,
            physics.formulaHtml
          ];

  const formulas = {
    "物理": physicsFormula,
    "化学": [
      "核心关系",
      "Fe + CuSO₄ → FeSO₄ + Cu",
      `计量关系：1mol Fe : 1mol CuSO₄ : 1mol Cu<br>${chemistry.formulaHtml}`
    ],
    "数学": [
      "导数关系",
      `y′ = ${mathModel.derivativeText}`,
      `函数 y = ${mathModel.expression}；当 x = ${mathX} 时，y = ${mathY}，斜率 k = ${mathSlope}`
    ],
    "生物": biologyConcept
  };

  const [label, formula, desc] = formulas[subject] || formulas["物理"];
  const labelEl = $("span", spotlight);
  const formulaEl = $("strong", spotlight);
  const descEl = $("p", spotlight);

  if (labelEl) labelEl.textContent = label;
  setFormulaHtml(formulaEl, formula);
  setFormulaHtml(descEl, desc);
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
  elements.parseFeedback.innerHTML = `<span>识别结果</span><strong>${verticalizeFormulaHtml(recognitionText)}</strong>`;
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
  const question = state.physicsTemplate === "solenoid"
    ? buildSolenoidQuestionText()
    : state.physicsTemplate === "boardSlider"
      ? buildPhysicsBoardSliderQuestionText()
    : state.physicsTemplate === "projectile"
      ? buildPhysicsProjectileQuestionText()
      : state.physicsTemplate === "circuit"
        ? buildPhysicsCircuitQuestionText()
        : isExtraPhysicsTemplate()
          ? buildExtraPhysicsQuestionText()
          : buildPhysicsBrakeQuestionText();
  $("#questionInput").value = question;
  $("#problemText").textContent = question;
  state.generatedQuestion = question;
  syncFavoriteState();
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
  syncFavoriteState();
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
  elements.totalTime.textContent = formatTimelineTime(duration());
  if (state.physicsTemplate === "brake") {
    const content = buildPhysicsBrakeContent();
    elements.stopDistanceLabel.textContent = `${content.stopDistanceText} m`;
    setPhysicsStopMarker();
  } else if (state.physicsTemplate === "boardSlider") {
    const content = buildPhysicsBoardSliderContent();
    elements.stopDistanceLabel.textContent = `${boardSliderNumber(content.model.relativeStopDistance)} m`;
  } else if (state.physicsTemplate === "projectile") {
    elements.stopDistanceLabel.textContent = `${smartNumber(projectileModel().range, 1)} m`;
  } else if (state.physicsTemplate === "circuit") {
    elements.stopDistanceLabel.textContent = `${smartNumber(circuitModel().current, 2)} A`;
  } else if (isExtraPhysicsTemplate()) {
    const content = buildExtraPhysicsContent();
    elements.stopDistanceLabel.textContent = content.model.readout;
  } else {
    const solenoid = solenoidModel();
    elements.stopDistanceLabel.textContent = `${solenoid.leftPole}/${solenoid.rightPole}`;
  }
  elements.currentTime.textContent = formatTimelineTime(0);
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
  clearReasoningTimers();
  pauseExperiment();
  state.hasGenerated = false;
  state.generatedQuestion = "";
  state.subject = subject;
  updateSubjectBodyClass(subject);
  state.reasonStep = 0;
  if (subject === "物理" && options.presetQuestion) {
    state.physicsTemplate = "brake";
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
    state.mathModel = createMathModel(defaultMathSpec());
    syncMathContent(3, state.mathModel);
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
  if ($("#arDescription")) $("#arDescription").textContent = "生成实验后，可继续扩展移动端空间展示。";
  elements.scene.className = "scene subject-pending";
  $("#viewButton")?.classList.remove("selected");
  $("#annotationButton")?.classList.remove("selected");
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
  syncFavoriteState();
}

function updateParameters(reset = true, options = {}) {
  state.p1 = Number(elements.ranges[0].value);
  state.p2 = Number(elements.ranges[1].value);
  if (state.subject === "物理") {
    if (state.physicsTemplate === "boardSlider") {
      state.boardSliderParams = {
        ...state.boardSliderParams,
        initialSpeed: state.p1,
        boardLength: state.p2
      };
      syncPhysicsBoardSliderContent(state.boardSliderParams);
    } else if (state.physicsTemplate === "solenoid") {
      syncPhysicsSolenoidContent();
    } else if (state.physicsTemplate === "projectile") {
      syncPhysicsProjectileContent();
    } else if (state.physicsTemplate === "circuit") {
      syncPhysicsCircuitContent();
    } else if (isExtraPhysicsTemplate()) {
      syncExtraPhysicsContent(state.physicsTemplate);
    } else {
      syncPhysicsBrakeContent();
    }
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
  elements.totalTime.textContent = formatTimelineTime(duration());

  if (state.subject === "物理" && state.physicsTemplate === "brake") {
    const content = buildPhysicsBrakeContent();
    const model = content.model;
    elements.stopDistanceLabel.textContent = `${content.stopDistanceText} m`;
    if (elements.stopDistanceCaption) elements.stopDistanceCaption.textContent = model.markerLabel;
    if (elements.brakeModelLabel) elements.brakeModelLabel.textContent = content.indicatorLabel;
    if (elements.brakeModelFormula) setFormulaHtml(elements.brakeModelFormula, content.indicatorFormula);
    setPhysicsStopMarker(model.stopDistance);
    updateFormulaSpotlight("物理");
    if (state.hasGenerated) {
      if (options.syncQuestion) syncPhysicsQuestionFromState();
      renderReasoning();
      elements.mentorMessage.innerHTML = config().mentor;
      setRecognitionFeedback({
        ok: true,
        subject: "物理",
        type: model.mode === "linear_drag" ? "linear_drag_braking" : model.mode === "friction" ? "friction_braking" : "braking_distance",
        recognitionText: content.recognitionText
      });
    }
  }

  if (state.subject === "物理" && state.physicsTemplate === "boardSlider") {
    const content = buildPhysicsBoardSliderContent();
    elements.stopDistanceLabel.textContent = `${boardSliderNumber(content.model.relativeStopDistance)} m`;
    if (elements.stopDistanceCaption) elements.stopDistanceCaption.textContent = "最大相对位移";
    updateFormulaSpotlight("物理");
    elements.sceneTip.innerHTML = `<span>相对运动判定</span>${content.sceneTip}`;
    renderBoardSliderScene(boardSliderValuesAt(state.time));
    if (state.hasGenerated) {
      if (options.syncQuestion) syncPhysicsQuestionFromState();
      renderReasoning();
      elements.mentorMessage.innerHTML = config().mentor;
      setRecognitionFeedback({ ok: true, subject: "物理", type: "board_slider", recognitionText: content.recognitionText });
    }
  }

  if (state.subject === "物理" && state.physicsTemplate === "solenoid") {
    const content = buildPhysicsSolenoidContent();
    updateFormulaSpotlight("物理");
    elements.sceneTip.innerHTML = `<span>实时结论</span>${content.sceneTip}`;
    if (state.hasGenerated) {
      if (options.syncQuestion) syncPhysicsQuestionFromState();
      renderReasoning();
      elements.mentorMessage.innerHTML = config().mentor;
      setRecognitionFeedback({ ok: true, subject: "物理", type: "solenoid_electromagnet", recognitionText: content.recognitionText });
    }
  }

  if (state.subject === "物理" && state.physicsTemplate === "projectile") {
    const content = buildPhysicsProjectileContent();
    elements.stopDistanceLabel.textContent = `${smartNumber(content.model.range, 1)} m`;
    updateFormulaSpotlight("物理");
    elements.sceneTip.innerHTML = `<span>实时结论</span>${content.sceneTip}`;
    if (state.hasGenerated) {
      if (options.syncQuestion) syncPhysicsQuestionFromState();
      renderReasoning();
      elements.mentorMessage.innerHTML = config().mentor;
      setRecognitionFeedback({ ok: true, subject: "物理", type: "projectile_motion", recognitionText: content.recognitionText });
    }
  }

  if (state.subject === "物理" && state.physicsTemplate === "circuit") {
    const content = buildPhysicsCircuitContent();
    elements.stopDistanceLabel.textContent = `${smartNumber(content.model.current, 2)} A`;
    updateFormulaSpotlight("物理");
    elements.sceneTip.innerHTML = `<span>实时结论</span>${content.sceneTip}`;
    if (state.hasGenerated) {
      if (options.syncQuestion) syncPhysicsQuestionFromState();
      renderReasoning();
      elements.mentorMessage.innerHTML = config().mentor;
      setRecognitionFeedback({ ok: true, subject: "物理", type: "ohms_law_circuit", recognitionText: content.recognitionText });
    }
  }

  if (state.subject === "物理" && isExtraPhysicsTemplate()) {
    const content = buildExtraPhysicsContent();
    elements.stopDistanceLabel.textContent = content.model.readout;
    updateFormulaSpotlight("物理");
    elements.sceneTip.innerHTML = `<span>实时结论</span>${content.sceneTip}`;
    renderExtraPhysicsVisual(content);
    if (state.hasGenerated) {
      if (options.syncQuestion) syncPhysicsQuestionFromState();
      renderReasoning();
      elements.mentorMessage.innerHTML = config().mentor;
      setRecognitionFeedback({ ok: true, subject: "物理", type: state.physicsTemplate, recognitionText: content.recognitionText });
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
      setRecognitionFeedback({ ok: true, subject: "数学", type: "function_tangent_slope", recognitionText: config().recognitionText });
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
  if (state.hasGenerated) dispatchAIContextChanged();
}

const AI_TEMPLATE_ID_MAP = Object.freeze({
  brake: "brake",
  solenoid: "solenoid",
  boardSlider: "board_slider",
  projectile: "projectile",
  circuit: "ohm_circuit",
  lever: "lever",
  lens: "lens",
  buoyancy: "buoyancy",
  friction: "friction",
  lampPower: "lamp_power",
  seriesCircuit: "series_circuit",
  heatBalance: "heat_balance",
  liquidPressure: "liquid_pressure",
  efficiency: "efficiency",
  sound: "sound"
});

const AI_PARAMETER_NAMES = Object.freeze({
  lever: ["leftForce", "leftArm"],
  lens: ["objectDistance", "focalLength"],
  buoyancy: ["displacedVolume", "density"],
  friction: ["normalForce", "frictionCoefficient"],
  lamp_power: ["voltage", "current"],
  series_circuit: ["voltage", "resistance"],
  heat_balance: ["hotWaterMass", "hotTemperature"],
  liquid_pressure: ["depthCm", "density"],
  efficiency: ["loadForce", "pullForce"],
  sound: ["frequency", "amplitudePercent"]
});

function currentAITemplateId() {
  if (state.subject === "化学") return "fe_cuso4";
  if (state.subject === "数学") return "tangent";
  if (state.subject === "生物") return "cell";
  return AI_TEMPLATE_ID_MAP[state.physicsTemplate] || "";
}

function currentAIParameters(templateId = currentAITemplateId()) {
  if (templateId === "brake") {
    const model = physicsBrakeModel();
    return { initialSpeed: model.v0, deceleration: model.aAbs };
  }
  if (templateId === "solenoid") return { current: state.p1, turns: state.p2 };
  if (templateId === "board_slider") return { initialSpeed: state.p1, boardLength: state.p2 };
  if (templateId === "projectile") return { horizontalSpeed: state.p1, height: state.p2 };
  if (templateId === "ohm_circuit") return { voltage: state.p1, resistance: state.p2 };
  if (templateId === "fe_cuso4") return { ironMass: state.p1, copperSulfateMass: state.p2 * 160 };
  if (templateId === "tangent") return { coefficient: 1, pointX: state.p1 };
  if (templateId === "cell") return { cellType: state.cellType === "animal" ? 0 : 1 };
  const parameterNames = AI_PARAMETER_NAMES[templateId];
  return parameterNames ? { [parameterNames[0]]: state.p1, [parameterNames[1]]: state.p2 } : {};
}

function dispatchAIContextChanged() {
  window.dispatchEvent(new CustomEvent("masterlab:context-changed"));
}

function buildMasterLabAIContext() {
  const inputQuestion = $("#questionInput")?.value.trim() || "";
  const generatedQuestion = state.generatedQuestion || "";
  const currentExperimentIsActive = state.hasGenerated && generatedQuestion && inputQuestion === generatedQuestion;
  if (!currentExperimentIsActive) {
    return {
      mode: "question",
      subject: state.subject,
      originalQuestion: inputQuestion,
      templateId: "",
      parameters: {},
      deterministicResult: {},
      formula: "",
      currentStep: ""
    };
  }
  const metricText = elements.metricLabels.map((label, index) => {
    const value = elements.metricValues[index]?.textContent || "";
    const unit = elements.metricUnits[index]?.textContent || "";
    return `${label?.textContent || "参数"} ${value}${unit}`.trim();
  }).join("｜");
  const currentReasoning = $(".reason-step.active") || $(`.reason-step[data-step="${state.reasonStep}"]`);
  return {
    mode: "experiment",
    subject: state.subject,
    title: config().title,
    originalQuestion: generatedQuestion,
    templateId: currentAITemplateId(),
    parameters: currentAIParameters(),
    deterministicResult: {
      resultText: (elements.sceneTip?.textContent || "").trim().slice(0, 300),
      metrics: metricText.slice(0, 300)
    },
    formula: ($(".formula-spotlight strong")?.textContent || "").trim().slice(0, 600),
    currentStep: (currentReasoning?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 600)
  };
}

function applyAIParameterPatch(patch) {
  if (!state.hasGenerated || !patch || currentAITemplateId() === "") {
    return { ok: false, message: "请先生成一个可交互实验" };
  }
  const templateId = currentAITemplateId();
  if (templateId === "cell" && patch.parameterKey === "cellType") {
    switchBiologyCellType(Number(patch.nextValue) === 0 ? "animal" : "plant");
    saveCurrentSubjectSnapshot();
    dispatchAIContextChanged();
    showToast("已按确认切换细胞模型");
    return { ok: true };
  }
  const bindings = {
    brake: { initialSpeed: [0, value => value], deceleration: [1, value => value] },
    solenoid: { current: [0, value => value], turns: [1, value => value] },
    board_slider: { initialSpeed: [0, value => value], boardLength: [1, value => value] },
    projectile: { horizontalSpeed: [0, value => value], height: [1, value => value] },
    ohm_circuit: { voltage: [0, value => value], resistance: [1, value => value] },
    fe_cuso4: { ironMass: [0, value => value], copperSulfateMass: [1, value => value / 160] },
    tangent: { pointX: [0, value => value] }
  };
  const extraNames = AI_PARAMETER_NAMES[templateId];
  if (extraNames) {
    bindings[templateId] = {
      [extraNames[0]]: [0, value => value],
      [extraNames[1]]: [1, value => value]
    };
  }
  const binding = bindings[templateId]?.[patch.parameterKey];
  if (!binding) return { ok: false, message: "当前实验不支持应用这项参数建议" };
  const [rangeIndex, convert] = binding;
  const range = elements.ranges[rangeIndex];
  const converted = Number(convert(Number(patch.nextValue)));
  if (!range || !Number.isFinite(converted) || converted < Number(range.min) || converted > Number(range.max)) {
    return { ok: false, message: "建议值超出当前实验允许范围" };
  }
  range.value = String(converted);
  updateParameters(true, { syncQuestion: true });
  saveCurrentSubjectSnapshot();
  dispatchAIContextChanged();
  showToast("已按确认应用 AI 导师的参数建议");
  return { ok: true };
}

window.MasterLabAIHost = Object.freeze({
  getContext: buildMasterLabAIContext,
  applyParameterPatch: applyAIParameterPatch,
  showToast,
  setMentorSummary(message) {
    if (elements.mentorMessage) elements.mentorMessage.textContent = String(message || "");
  }
});

function physicsSceneClassName() {
  if (state.physicsTemplate === "boardSlider") return "board-slider";
  if (state.physicsTemplate === "solenoid") return "solenoid";
  if (state.physicsTemplate === "projectile") return "projectile";
  if (state.physicsTemplate === "circuit") return "circuit";
  if (isExtraPhysicsTemplate()) return "generic-physics";
  return "physics";
}

function physicsSideKicker() {
  if (state.physicsTemplate === "boardSlider") return "高中拓展 × 相对运动";
  if (state.physicsTemplate === "solenoid") return "安培定则 × 变量探究";
  if (state.physicsTemplate === "projectile") return "运动合成 × 轨迹验证";
  if (state.physicsTemplate === "circuit") return "欧姆定律 × 变量探究";
  if (isExtraPhysicsTemplate()) {
    const content = buildExtraPhysicsContent();
    return `${content.block} × 典型题型模板`;
  }
  if (state.brakeMode === "friction") return "受力分析 × 摩擦制动";
  if (state.brakeMode === "linear_drag") return "高中拓展 × 变力模型";
  return "公式 × 过程联动";
}

function physicsRecognitionResult() {
  if (state.physicsTemplate === "boardSlider") {
    return { ok: true, subject: "物理", type: "board_slider", recognitionText: buildPhysicsBoardSliderContent().recognitionText };
  }
  if (state.physicsTemplate === "solenoid") {
    return { ok: true, subject: "物理", type: "solenoid_electromagnet", recognitionText: buildPhysicsSolenoidContent().recognitionText };
  }
  if (state.physicsTemplate === "projectile") {
    return { ok: true, subject: "物理", type: "projectile_motion", recognitionText: buildPhysicsProjectileContent().recognitionText };
  }
  if (state.physicsTemplate === "circuit") {
    return { ok: true, subject: "物理", type: "ohms_law_circuit", recognitionText: buildPhysicsCircuitContent().recognitionText };
  }
  if (isExtraPhysicsTemplate()) {
    return { ok: true, subject: "物理", type: state.physicsTemplate, recognitionText: buildExtraPhysicsContent().recognitionText };
  }
  const content = buildPhysicsBrakeContent();
  return {
    ok: true,
    subject: "物理",
    type: content.model.mode === "linear_drag" ? "linear_drag_braking" : content.model.mode === "friction" ? "friction_braking" : "braking_distance",
    recognitionText: content.recognitionText
  };
}

function refreshGeneratedSubjectSurface(subject = state.subject, options = {}) {
  const current = config();
  $(".side-card-header .section-kicker").textContent = subject === "生物"
    ? "结构 × 功能联动"
    : subject === "物理"
      ? physicsSideKicker()
      : "公式 × 过程联动";
  $(".side-card-header h2").textContent = subject === "生物"
    ? "结构识别路径"
    : subject === "物理" && state.physicsTemplate !== "brake"
      ? "解题路径"
      : "解题思维链";

  setActiveSubjectTab(subject);
  if (!options.preserveProblemText) $("#problemText").textContent = current.description;
  $("#experimentTitle").textContent = current.title;
  $("#engineBadge").textContent = current.engine;
  if ($("#arDescription")) $("#arDescription").textContent = current.ar;
  elements.scene.className = `scene subject-${subject === "物理" ? physicsSceneClassName() : subject === "化学" ? "chemistry" : subject === "数学" ? "math" : "biology"}`;
  current.metrics.forEach((metric, index) => {
    elements.metricLabels[index].textContent = metric[0];
    elements.metricUnits[index].textContent = metric[1];
  });
  current.params.forEach((param, index) => {
    elements.paramLabels[index].textContent = param.label;
    elements.paramDescriptions[index].textContent = param.desc;
    elements.paramUnits[index].textContent = param.unit;
    setRange(elements.ranges[index], param);
    elements.paramValues[index].textContent = formatParam(param, index === 0 ? state.p1 : state.p2);
  });
  elements.mentorMessage.innerHTML = current.mentor;
  renderReasoning();
  updateFormulaSpotlight(subject);
  updateSubjectBodyClass(subject);
}

function applySubject(subject, updateQuestion = true, options = {}) {
  clearDemoTimers();
  clearReasoningTimers();
  pauseExperiment();
  document.body.classList.remove("awaiting-generation");
  state.hasGenerated = true;
  state.subject = subject;
  updateSubjectBodyClass(subject);
  const restored = options.restore && restoreSubjectSnapshot(subject);
  const restoredTime = restored ? state.time : 0;
  if (subject === "物理" && updateQuestion && !restored) {
    state.physicsTemplate = "brake";
    state.brakeMode = "constant";
    state.brakeGravity = 9.8;
    state.brakeMass = 1000;
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
    state.mathModel = createMathModel(defaultMathSpec());
    syncMathContent(3, state.mathModel);
  }
  if (subject === "生物" && updateQuestion && !restored) {
    syncBiologyContent(state.cellType || "plant");
    state.p1 = -10;
    state.p2 = 6;
    state.selectedOrganelle = defaultOrganelleForCellType();
    resetBiologyCellModel();
  }
  state.reasonStep = 1;
  updateFormulaSpotlight(subject);
  hideMentorFeedback();
  const current = config();
  $(".side-card-header .section-kicker").textContent = subject === "生物"
    ? "结构 × 功能联动"
    : subject === "物理"
      ? physicsSideKicker()
      : "公式 × 过程联动";
  $(".side-card-header h2").textContent = subject === "生物"
    ? "结构识别路径"
    : subject === "物理" && state.physicsTemplate !== "brake"
      ? "解题路径"
      : "解题思维链";

  setActiveSubjectTab(subject);
  if (subject !== "物理") clearRecognitionFeedback();
  if (updateQuestion) $("#questionInput").value = restored ? state.generatedQuestion : current.question;
  $("#experimentTitle").textContent = current.title;
  $("#problemText").textContent = current.description;
  $("#engineBadge").textContent = current.engine;
  if ($("#arDescription")) $("#arDescription").textContent = current.ar;
  elements.scene.className = `scene subject-${subject === "物理" ? physicsSceneClassName() : subject === "化学" ? "chemistry" : subject === "数学" ? "math" : "biology"}`;
  $("#viewButton")?.classList.remove("selected");
  $("#annotationButton")?.classList.remove("selected");

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
  renderReasoning();
  updateParameters();
  refreshGeneratedSubjectSurface(subject);
  updateSubjectBodyClass(subject);
  if (restored) {
    state.time = clamp(restoredTime, 0, duration());
    updateScene();
  }
  if (restored && state.generatedQuestion) {
    $("#problemText").textContent = state.generatedQuestion;
    setRecognitionFeedback(
      subject === "物理" ? physicsRecognitionResult() :
      subject === "化学" ? { ok: true, recognitionText: buildChemistryFeCuSO4Content().recognitionText } :
      subject === "数学" ? parseMathTangentQuestion(state.generatedQuestion) :
      biologyTemplateRecognition()
    );
  }
  syncFavoriteState();
  dispatchAIContextChanged();
}

function playExperiment() {
  if (state.subject === "物理" && state.physicsTemplate === "solenoid") {
    showToast("螺线管为交互观察：请使用反转电流、铁芯和滑块探究变化");
    return;
  }
  if (state.subject === "物理" && state.physicsTemplate === "circuit") {
    showToast("欧姆定律为稳态变量探究：拖动电压或电阻即可同步电流");
    return;
  }
  if (state.subject === "物理" && isExtraPhysicsTemplate()) {
    showToast("该题型为参数即时探究：拖动下方滑块即可同步公式和结论");
    return;
  }
  if (state.subject === "数学") {
    showToast("数学题型为静态参数观察：拖动 x 滑块即可同步斜率");
    return;
  }
  if (state.subject === "生物") {
    showToast("生物模型支持拖动旋转和点击识别，无需播放进度");
    return;
  }
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
  const physicsTip = state.physicsTemplate === "boardSlider"
    ? buildPhysicsBoardSliderContent().sceneTip
    : state.physicsTemplate === "solenoid"
    ? buildPhysicsSolenoidContent().sceneTip
    : state.physicsTemplate === "projectile"
      ? buildPhysicsProjectileContent().sceneTip
      : state.physicsTemplate === "circuit"
        ? buildPhysicsCircuitContent().sceneTip
        : isExtraPhysicsTemplate()
          ? buildExtraPhysicsContent().sceneTip
          : buildPhysicsBrakeContent().sceneTip;
  const tips = {
    "物理": physicsTip,
    "化学": buildChemistryFeCuSO4Content().sceneTip,
    "数学": `观察函数 y = ${currentMathModel().expression} 在 x = ${formatMathNumber(state.p1)} 时，导数 y′ = ${currentMathModel().derivativeText} 如何给出切线斜率。`,
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
  state.time = Math.min(
    duration(),
    state.time + delta * state.playbackRate * experimentPlaybackTimeScale()
  );
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

function focusExperimentCard() {
  if (!elements.experimentCard) return;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const top = elements.experimentCard.getBoundingClientRect().top + window.scrollY - 18;
  window.scrollTo({
    top: Math.max(0, top),
    behavior: reducedMotion ? "auto" : "smooth"
  });
}

function setReasoningStep(step, message) {
  state.reasonStep = step;
  renderReasoning();
  if (message) elements.sceneTip.innerHTML = message;
}

function clearReasoningTimers() {
  state.reasoningTimers.forEach(timer => clearTimeout(timer));
  state.reasoningTimers = [];
  state.reasoningAutoRun += 1;
}

function reasoningStepMessage(step) {
  const item = config().steps[step - 1];
  if (!item) return "";
  return `<span>${item[0]}</span>${item[2] || item[1]}`;
}

function applyReasoningStepEffect(step) {
  if (state.subject !== "生物") return;
  if (step === 2) renderCellDetail(defaultOrganelleForCellType());
  if (step === 3) {
    const target = state.cellType === "animal" ? "mitochondrion" : "chloroplast";
    if (currentCellOrganelleMap().has(target)) renderCellDetail(target);
  }
}

function activateReasoningStep(step, options = {}) {
  const maxStep = Math.max(config().steps.length, 4);
  const nextStep = Math.max(1, Math.min(maxStep, Number(step) || 1));
  if (options.manual) clearReasoningTimers();
  applyReasoningStepEffect(nextStep);
  setReasoningStep(nextStep, reasoningStepMessage(nextStep));
}

function scheduleReasoningAutoAdvance() {
  clearReasoningTimers();
  if (!state.hasGenerated) return;
  const runId = state.reasoningAutoRun;
  const subject = state.subject;
  const question = state.generatedQuestion;
  const steps = Math.max(config().steps.length, 4);
  const delays = [300, 1500, 2700, 3900];

  for (let step = 1; step <= steps; step += 1) {
    const timer = setTimeout(() => {
      if (!state.hasGenerated || state.subject !== subject || state.generatedQuestion !== question) return;
      if (runId !== state.reasoningAutoRun) return;
      activateReasoningStep(step);
    }, delays[step - 1] ?? (420 + (step - 1) * 1800));
    state.reasoningTimers.push(timer);
  }
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
  if (isPhysicsBoardSliderQuestion(question)) return "物理";
  if (/(?:f|F)(?:阻)?\s*(?:=|＝)\s*-?\s*k\s*v|阻力.{0,12}(?:速度|速率).{0,8}成正比|(?:质量|m\s*(?:=|＝)).{0,12}(?:kg|千克|吨).{0,24}(?:初速度|速度)|(?:动摩擦因数|摩擦系数|车轮抱死)/i.test(question)) return "物理";
  if (/函数|抛物线|斜率|切线|导数|数学|y\s*(?:=|＝)|ln\s*x|sin\s*x|cos\s*x|e\^x|exp\s*\(|sqrt|√/i.test(question)) return "数学";
  if (identifyExtraPhysicsTemplate(question)) return "物理";
  if (/汽车|车辆|速度|加速度|减速度|刹车|制动|停止|运动|受力|落下|物理|螺线管|电磁铁|磁极|安培定则|线圈|匝|铁芯|磁感线|平抛|水平抛|水平速度|落地|水平位移|欧姆|电压|电阻|电流|纯电阻|电路|Ω/.test(question)) return "物理";
  if (/细胞|生物|植物|动物|亚显微|细胞壁|细胞膜|细胞核|液泡|叶绿体|线粒体|细胞质|内质网|高尔基体|核糖体|DNA/.test(question)) return "生物";
  return state.subject;
}

function getGenerationSubject(question) {
  const selectedPreset = SUBJECTS[state.subject]?.question;
  if (selectedPreset && question === selectedPreset) return state.subject;
  return detectSubject(question);
}

elements.playButton.addEventListener("click", () => {
  if (state.subject === "数学" || state.subject === "生物") {
    clearReasoningTimers();
    playExperiment();
    return;
  }
  clearDemoTimers();
  clearReasoningTimers();
  state.playing ? pauseExperiment() : playExperiment();
});
$("#resetButton").addEventListener("click", () => {
  clearDemoTimers();
  clearReasoningTimers();
  resetExperiment();
});

elements.timeline.addEventListener("input", event => {
  clearDemoTimers();
  clearReasoningTimers();
  pauseExperiment();
  state.time = (Number(event.target.value) / 100) * duration();
  updateScene();
});

elements.ranges.forEach(input => input.addEventListener("input", () => {
  clearDemoTimers();
  clearReasoningTimers();
  updateParameters(true, { syncQuestion: true });
}));

$$(".number-control button").forEach(button => {
  button.addEventListener("click", () => {
    const input = $(`#${button.dataset.target}`);
    const next = Number(input.value) + Number(button.dataset.delta) * Number(input.step);
    input.value = Math.max(Number(input.min), Math.min(Number(input.max), next));
    clearDemoTimers();
    clearReasoningTimers();
    updateParameters(true, { syncQuestion: true });
  });
});

$$("[data-toast]").forEach(button => button.addEventListener("click", () => showToast(button.dataset.toast)));

function hidePhysicsPresetDropdown() {
  const dropdown = $("#physicsPresetDropdown");
  const toggle = $("#physicsPresetToggle");
  dropdown?.classList.remove("show");
  dropdown?.setAttribute("aria-hidden", "true");
  toggle?.classList.remove("open");
  toggle?.setAttribute("aria-expanded", "false");
}

function currentPhysicsPresetKey() {
  if (state.subject !== "物理") return "";
  const questionText = $("#questionInput")?.value || "";
  if (state.physicsTemplate === "solenoid" || /螺线管|电磁铁|磁极|安培定则|线圈|匝|铁芯|磁感线/.test(questionText)) return "solenoid";
  if (state.physicsTemplate === "boardSlider" || isPhysicsBoardSliderQuestion(questionText)) return "boardSlider";
  if (state.physicsTemplate === "projectile" || /平抛|水平抛|水平速度|水平位移|落地|抛出|平台/.test(questionText)) return "projectile";
  if (isExtraPhysicsTemplate()) return state.physicsTemplate;
  const extra = identifyExtraPhysicsTemplate(questionText);
  if (extra) return extra;
  if (state.physicsTemplate === "circuit" || /欧姆|电压|电阻|电流|纯电阻|电路|Ω|V\b/.test(questionText)) return "circuit";
  return "brake";
}

function updatePhysicsPresetOption() {
  const currentPreset = currentPhysicsPresetKey();
  $$("#physicsPresetDropdown [data-preset]").forEach(option => {
    option.hidden = option.dataset.preset === currentPreset;
  });
}

function togglePhysicsPresetDropdown() {
  if (state.subject !== "物理") return;
  const dropdown = $("#physicsPresetDropdown");
  const toggle = $("#physicsPresetToggle");
  if (!dropdown || !toggle) return;
  const opening = !dropdown.classList.contains("show");
  if (opening) updatePhysicsPresetOption();
  dropdown.classList.toggle("show", opening);
  dropdown.setAttribute("aria-hidden", String(!opening));
  toggle.classList.toggle("open", opening);
  toggle.setAttribute("aria-expanded", String(opening));
}

function preselectBrakeQuestion() {
  clearDemoTimers();
  pauseExperiment();
  applyWaitingState("物理", { presetQuestion: false });
  state.subject = "物理";
  state.physicsTemplate = "brake";
  state.brakeMode = "constant";
  state.brakeGravity = 9.8;
  state.brakeMass = 1000;
  state.p1 = 20;
  state.p2 = 5;
  syncPhysicsBrakeContent(20, 5);
  $("#questionInput").value = buildPhysicsBrakeQuestionText(20, 5);
  $("#problemText").textContent = "已预选刹车距离题，点击“生成实验”后将生成运动过程可视化场景。";
  setActiveSubjectTab("物理");
  clearRecognitionFeedback();
  updatePhysicsPresetOption();
  showToast("已预选默认刹车距离题目");
}

function preselectSolenoidQuestion() {
  clearDemoTimers();
  pauseExperiment();
  applyWaitingState("物理", { presetQuestion: false });
  state.subject = "物理";
  state.physicsTemplate = "solenoid";
  state.p1 = 0.5;
  state.p2 = 200;
  state.solenoidViewEnd = "left";
  state.solenoidWindingDirection = "counterclockwise";
  state.solenoidHasCore = false;
  state.solenoidPaused = false;
  state.solenoidRotateX = 0;
  state.solenoidRotateY = 0;
  state.solenoidZoom = 1;
  syncPhysicsSolenoidContent(0.5, 200, {
    viewEnd: "left",
    windingDirection: "counterclockwise",
    hasCore: false
  });
  const question = buildSolenoidQuestionText(solenoidModel(0.5, 200, "left", "counterclockwise", false));
  $("#questionInput").value = question;
  $("#problemText").textContent = "已预选通电螺线管题，点击“生成实验”后将生成电磁学可视化场景。";
  setActiveSubjectTab("物理");
  clearRecognitionFeedback();
  updatePhysicsPresetOption();
  showToast("已预选默认通电螺线管题目");
}

function preselectBoardSliderQuestion() {
  clearDemoTimers();
  pauseExperiment();
  applyWaitingState("物理", { presetQuestion: false });
  state.subject = "物理";
  state.physicsTemplate = "boardSlider";
  state.boardSliderParams = { ...BOARD_SLIDER_DEFAULTS };
  state.p1 = BOARD_SLIDER_DEFAULTS.initialSpeed;
  state.p2 = BOARD_SLIDER_DEFAULTS.boardLength;
  syncPhysicsBoardSliderContent(state.boardSliderParams);
  $("#questionInput").value = BOARD_SLIDER_DEFAULT_QUESTION;
  $("#problemText").textContent = "已预选木板—滑块相对运动题，点击“生成实验”后将生成双物体运动与临界判定场景。";
  setActiveSubjectTab("物理");
  clearRecognitionFeedback();
  updatePhysicsPresetOption();
  showToast("已预选木板—滑块相对运动题目");
}

function preselectProjectileQuestion() {
  clearDemoTimers();
  pauseExperiment();
  applyWaitingState("物理", { presetQuestion: false });
  state.subject = "物理";
  state.physicsTemplate = "projectile";
  state.p1 = 12;
  state.p2 = 20;
  syncPhysicsProjectileContent(12, 20);
  $("#questionInput").value = buildPhysicsProjectileQuestionText(12, 20);
  $("#problemText").textContent = "已预选平抛运动题，点击“生成实验”后将生成轨迹与分运动可视化。";
  setActiveSubjectTab("物理");
  clearRecognitionFeedback();
  updatePhysicsPresetOption();
  showToast("已预选默认平抛运动题目");
}

function preselectCircuitQuestion() {
  clearDemoTimers();
  pauseExperiment();
  applyWaitingState("物理", { presetQuestion: false });
  state.subject = "物理";
  state.physicsTemplate = "circuit";
  state.p1 = 6;
  state.p2 = 3;
  syncPhysicsCircuitContent(6, 3);
  $("#questionInput").value = buildPhysicsCircuitQuestionText(6, 3);
  $("#problemText").textContent = "已预选欧姆定律电路题，点击“生成实验”后将生成电路变量可视化。";
  setActiveSubjectTab("物理");
  clearRecognitionFeedback();
  updatePhysicsPresetOption();
  showToast("已预选默认欧姆定律题目");
}

function preselectExtraPhysicsQuestion(id) {
  const template = extraPhysicsTemplate(id);
  if (!template) return;
  clearDemoTimers();
  pauseExperiment();
  applyWaitingState("物理", { presetQuestion: false });
  state.subject = "物理";
  state.physicsTemplate = id;
  state.p1 = template.defaults[0];
  state.p2 = template.defaults[1];
  syncExtraPhysicsContent(id, state.p1, state.p2);
  $("#questionInput").value = buildExtraPhysicsQuestionText(id, state.p1, state.p2);
  $("#problemText").textContent = `已预选${template.menuTitle}，点击“生成实验”后将生成${template.block}可视化场景。`;
  setActiveSubjectTab("物理");
  clearRecognitionFeedback();
  updatePhysicsPresetOption();
  showToast(`已预选${template.menuTitle}`);
}

$("#physicsPresetToggle")?.addEventListener("click", event => {
  event.stopPropagation();
  togglePhysicsPresetDropdown();
});

function applyPhysicsPresetChoice(option) {
  if (!option) return;
  const preset = option.dataset.preset;
  hidePhysicsPresetDropdown();
  if (preset === "solenoid") preselectSolenoidQuestion();
  else if (preset === "boardSlider") preselectBoardSliderQuestion();
  else if (preset === "projectile") preselectProjectileQuestion();
  else if (preset === "circuit") preselectCircuitQuestion();
  else if (preset === "brake") preselectBrakeQuestion();
  else if (isExtraPhysicsTemplate(preset)) preselectExtraPhysicsQuestion(preset);
}

$("#physicsPresetDropdown")?.addEventListener("click", event => {
  const option = event.target.closest("[data-preset]");
  if (!option) return;
  event.preventDefault();
  event.stopPropagation();
  applyPhysicsPresetChoice(option);
});

$("#questionInput").addEventListener("input", () => {
  hidePhysicsPresetDropdown();
  if (state.subject === "物理" && !state.hasGenerated) {
    updatePhysicsPresetOption();
  }
  if (!state.hasGenerated) {
    clearRecognitionFeedback();
    dispatchAIContextChanged();
    return;
  }
  const currentQuestion = $("#questionInput").value.trim();
  if (currentQuestion && currentQuestion !== state.generatedQuestion) {
    pauseExperiment();
    clearDemoTimers();
    clearReasoningTimers();
    setRecognitionPending();
    hideMentorFeedback();
    $("#problemText").textContent = "题目已修改，点击“生成实验”后将重新识别并更新实验。";
    setDemoStep(2, "题目已修改，等待重新生成");
  }
  dispatchAIContextChanged();
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

document.addEventListener("click", event => {
  if (event.target.closest("#physicsPresetToggle, #physicsPresetDropdown")) return;
  hidePhysicsPresetDropdown();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") hidePhysicsPresetDropdown();
});

$$(".subject-tab").forEach(button => {
  button.addEventListener("click", () => {
    hidePhysicsPresetDropdown();
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
    clearReasoningTimers();
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
  clearReasoningTimers();
  resetBiologyCellModel();
  syncBiologyRotationUi();
  showToast(`已重置${CELL_TYPE_LABELS[state.cellType] || "细胞"}观察视角`);
});

elements.cellAutoButton?.addEventListener("click", event => {
  event.stopPropagation();
  if (state.subject !== "生物") return;
  clearReasoningTimers();
  setCellAutoRotate(!state.cellAutoRotate);
  showToast(state.cellAutoRotate ? `${CELL_TYPE_LABELS[state.cellType] || "细胞"}模型开始自动旋转` : "已暂停自动旋转");
});

async function handOffUnmatchedQuestion(parseResult, question, detected, allowAiFallback) {
  const message = parseResult?.message || "当前题目没有匹配到本地实验模板。";
  if (!allowAiFallback || !window.MasterLabAITutor?.resolveUnmatchedQuestion) {
    setRecognitionFeedback({ message }, true);
    showToast(message);
    return { mode: "unavailable" };
  }
  const button = $("#generateButton");
  setRecognitionPending("本地模板暂未匹配，正在请 AI 判断题型与所需条件……");
  button.classList.add("loading");
  $("span", button).textContent = "AI 分析中";
  try {
    const result = await window.MasterLabAITutor.resolveUnmatchedQuestion({
      question,
      preferredSubject: detected,
      localMessage: message
    });
    if (result?.mode === "explanation") {
      setRecognitionPending("当前题目暂无可视化实验模板，已转入 AI 导师讲解。");
    } else if (result?.mode === "unavailable") {
      setRecognitionFeedback({ message: "未匹配实验模板；AI 服务暂未完成分析，可在问答页重试。" }, true);
    }
    return result || { mode: "unavailable" };
  } finally {
    button.classList.remove("loading");
    $("span", button).textContent = "生成实验";
  }
}

async function generateExperiment(options = {}) {
  const button = $("#generateButton");
  if (button.classList.contains("loading")) return;
  const allowAiFallback = options.allowAiFallback !== false;
  state.userGeneratedOnce = true;
  if (state.autoDemoTimer) clearTimeout(state.autoDemoTimer);
  clearReasoningTimers();
  let question = String(options.questionOverride ?? $("#questionInput").value).trim();
  const displayQuestion = String(options.displayQuestion ?? question).trim();
  if (!question) {
    showToast("请先输入一道理科题目");
    return;
  }

  const detected = getGenerationSubject(question);
  let physicsParse = null;
  let boardSliderParse = null;
  let solenoidParse = null;
  let projectileParse = null;
  let circuitParse = null;
  let extraPhysicsParse = null;
  let chemistryParse = null;
  let mathParse = null;
  let templateRecognition = null;
  if (detected === "物理") {
    const boardSliderCandidate = isPhysicsBoardSliderQuestion(question);
    const solenoidCandidate = /螺线管|电磁铁|磁极|安培定则|线圈|匝|铁芯|磁感线/.test(question);
    const projectileCandidate = /平抛|水平抛|水平速度|水平位移|落地|抛出|平台/.test(question);
    const circuitCandidate = /欧姆|电压|电阻|电流|纯电阻|电路|Ω|V\b/.test(question);
    const brakeCandidate = /刹车|制动|停车|停下|停止距离|极限位移|(?:f|F)(?:阻)?\s*(?:=|＝)\s*-?\s*k\s*v/i.test(question);
    const currentExtraCandidate = !boardSliderCandidate && !brakeCandidate && isExtraPhysicsTemplate() && extraPhysicsTemplate()?.keywords?.test(normalizeQuestionText(question))
      ? state.physicsTemplate
      : "";
    const extraPhysicsCandidate = boardSliderCandidate || brakeCandidate ? "" : currentExtraCandidate || identifyExtraPhysicsTemplate(question);
    if (boardSliderCandidate) {
      boardSliderParse = parsePhysicsBoardSliderQuestion(question);
      if (!boardSliderParse.ok) {
        const remote = await handOffUnmatchedQuestion(boardSliderParse, displayQuestion, detected, allowAiFallback);
        if (remote?.mode === "experiment") {
          $("#questionInput").value = remote.question;
          await generateExperiment({ questionOverride: remote.question, displayQuestion, allowAiFallback: false });
        }
        return;
      }
      state.subject = "物理";
      state.physicsTemplate = "boardSlider";
      state.boardSliderParams = { ...boardSliderParse.params };
      state.p1 = boardSliderParse.initialSpeed;
      state.p2 = boardSliderParse.boardLength;
      syncPhysicsBoardSliderContent(state.boardSliderParams);
      setRecognitionFeedback(boardSliderParse);
    } else if (solenoidCandidate) {
      solenoidParse = parsePhysicsSolenoidQuestion(question);
      if (!solenoidParse.ok) {
        const remote = await handOffUnmatchedQuestion(solenoidParse, displayQuestion, detected, allowAiFallback);
        if (remote?.mode === "experiment") {
          $("#questionInput").value = remote.question;
          await generateExperiment({ questionOverride: remote.question, displayQuestion, allowAiFallback: false });
        }
        return;
      }
      state.subject = "物理";
      state.physicsTemplate = "solenoid";
      state.p1 = solenoidParse.current;
      state.p2 = solenoidParse.turns;
      state.solenoidViewEnd = solenoidParse.viewEnd;
      state.solenoidWindingDirection = solenoidParse.windingDirection;
      state.solenoidHasCore = solenoidParse.hasCore;
      state.solenoidPaused = false;
      state.solenoidRotateX = 0;
      state.solenoidRotateY = 0;
      state.solenoidZoom = 1;
      syncPhysicsSolenoidContent(solenoidParse.current, solenoidParse.turns, solenoidParse);
      setRecognitionFeedback(solenoidParse);
    } else if (projectileCandidate) {
      projectileParse = parsePhysicsProjectileQuestion(question);
      if (!projectileParse.ok) {
        const remote = await handOffUnmatchedQuestion(projectileParse, displayQuestion, detected, allowAiFallback);
        if (remote?.mode === "experiment") {
          $("#questionInput").value = remote.question;
          await generateExperiment({ questionOverride: remote.question, displayQuestion, allowAiFallback: false });
        }
        return;
      }
      state.subject = "物理";
      state.physicsTemplate = "projectile";
      state.p1 = projectileParse.speed;
      state.p2 = projectileParse.height;
      syncPhysicsProjectileContent(projectileParse.speed, projectileParse.height);
      syncPhysicsControlsFromState();
      setRecognitionFeedback(projectileParse);
    } else if (extraPhysicsCandidate) {
      extraPhysicsParse = parseExtraPhysicsQuestion(question, extraPhysicsCandidate);
      if (!extraPhysicsParse.ok) {
        const remote = await handOffUnmatchedQuestion(extraPhysicsParse, displayQuestion, detected, allowAiFallback);
        if (remote?.mode === "experiment") {
          $("#questionInput").value = remote.question;
          await generateExperiment({ questionOverride: remote.question, displayQuestion, allowAiFallback: false });
        }
        return;
      }
      state.subject = "物理";
      state.physicsTemplate = extraPhysicsParse.templateId;
      state.p1 = extraPhysicsParse.p1;
      state.p2 = extraPhysicsParse.p2;
      syncExtraPhysicsContent(extraPhysicsParse.templateId, extraPhysicsParse.p1, extraPhysicsParse.p2);
      syncPhysicsControlsFromState();
      setRecognitionFeedback(extraPhysicsParse);
    } else if (circuitCandidate) {
      circuitParse = parsePhysicsCircuitQuestion(question);
      if (!circuitParse.ok) {
        const remote = await handOffUnmatchedQuestion(circuitParse, displayQuestion, detected, allowAiFallback);
        if (remote?.mode === "experiment") {
          $("#questionInput").value = remote.question;
          await generateExperiment({ questionOverride: remote.question, displayQuestion, allowAiFallback: false });
        }
        return;
      }
      state.subject = "物理";
      state.physicsTemplate = "circuit";
      state.p1 = circuitParse.voltage;
      state.p2 = circuitParse.resistance;
      syncPhysicsCircuitContent(circuitParse.voltage, circuitParse.resistance);
      syncPhysicsControlsFromState();
      setRecognitionFeedback(circuitParse);
    } else {
      physicsParse = parsePhysicsBrakeQuestion(question);
      if (!physicsParse.ok) {
        const remote = await handOffUnmatchedQuestion(physicsParse, displayQuestion, detected, allowAiFallback);
        if (remote?.mode === "experiment") {
          $("#questionInput").value = remote.question;
          await generateExperiment({ questionOverride: remote.question, displayQuestion, allowAiFallback: false });
        }
        return;
      }
      state.subject = "物理";
      state.physicsTemplate = "brake";
      state.brakeMode = physicsParse.mode || "constant";
      state.brakeGravity = physicsParse.gravity || 9.8;
      state.brakeMass = physicsParse.mass || state.brakeMass || 1000;
      state.p1 = physicsParse.v0;
      state.p2 = physicsParse.parameter ?? physicsParse.aAbs;
      syncPhysicsBrakeContent(state.p1, state.p2, {
        mode: state.brakeMode,
        gravity: state.brakeGravity,
        mass: state.brakeMass
      });
      syncPhysicsControlsFromState();
      setRecognitionFeedback(physicsParse);
    }
  }
  if (detected === "化学") {
    chemistryParse = parseChemistryFeCuSO4Question(question);
    if (!chemistryParse.ok) {
      const remote = await handOffUnmatchedQuestion(chemistryParse, displayQuestion, detected, allowAiFallback);
      if (remote?.mode === "experiment") {
        $("#questionInput").value = remote.question;
        await generateExperiment({ questionOverride: remote.question, displayQuestion, allowAiFallback: false });
      }
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
      const remote = await handOffUnmatchedQuestion(mathParse, displayQuestion, detected, allowAiFallback);
      if (remote?.mode === "experiment") {
        $("#questionInput").value = remote.question;
        await generateExperiment({ questionOverride: remote.question, displayQuestion, allowAiFallback: false });
      }
      return;
    }
    state.subject = "数学";
    state.mathModel = mathParse.model;
    state.p1 = mathParse.x;
    state.p2 = 1;
    syncMathContent(mathParse.x, mathParse.model);
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
  const generationStages = solenoidParse
    ? SUBJECTS["物理"].generationStages
    : boardSliderParse
    ? SUBJECTS["物理"].generationStages
    : projectileParse
    ? SUBJECTS["物理"].generationStages
    : circuitParse
    ? SUBJECTS["物理"].generationStages
    : extraPhysicsParse
    ? SUBJECTS["物理"].generationStages
    : physicsParse
    ? SUBJECTS["物理"].generationStages
    : chemistryParse
      ? SUBJECTS["化学"].generationStages
      : mathParse
        ? SUBJECTS["数学"].generationStages
        : templateRecognition
          ? SUBJECTS["生物"].generationStages
      : null;
  await showGenerationOverlay(generationStages);
  applySubject(detected, false);
  if (extraPhysicsParse) {
    syncExtraPhysicsContent(extraPhysicsParse.templateId, extraPhysicsParse.p1, extraPhysicsParse.p2);
    syncPhysicsControlsFromState();
    refreshGeneratedSubjectSurface("物理", { preserveProblemText: true });
  }
  $("#questionInput").value = displayQuestion;
  $("#problemText").textContent = displayQuestion;
  state.generatedQuestion = displayQuestion;
  if (solenoidParse) setRecognitionFeedback(solenoidParse);
  if (boardSliderParse) setRecognitionFeedback(boardSliderParse);
  if (projectileParse) setRecognitionFeedback(projectileParse);
  if (circuitParse) setRecognitionFeedback(circuitParse);
  if (extraPhysicsParse) setRecognitionFeedback(extraPhysicsParse);
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
  setTimeout(focusExperimentCard, 80);
  scheduleReasoningAutoAdvance();
  dispatchAIContextChanged();
  setDemoStep(3, "点击播放或请求 AI 导师提示");
  showToast(boardSliderParse ? "木板—滑块实验已生成，点击播放观察相对运动" : solenoidParse ? "通电螺线管实验已生成，可反转电流或插入铁芯观察" : projectileParse ? "平抛实验已生成，点击播放观察轨迹" : circuitParse ? "欧姆定律电路已生成，可调电压和电阻观察电流" : extraPhysicsParse ? "物理典型题模板已生成，可拖动参数观察变化" : detected === "生物" ? "生物模型已生成，可拖动旋转或点击结构识别" : `${detected}实验已生成，点击播放开始观察`);
}

$("#generateButton").addEventListener("click", () => generateExperiment());

$(".reasoning-steps").addEventListener("click", event => {
  const step = event.target.closest(".reason-step");
  if (!step) return;
  activateReasoningStep(Number(step.dataset.step), { manual: true });
});

function refreshSolenoidAfterControl(syncQuestion = true) {
  syncPhysicsSolenoidContent();
  updateParameters(true, { syncQuestion });
  setRecognitionFeedback({ ok: true, subject: "物理", type: "solenoid_electromagnet", recognitionText: buildPhysicsSolenoidContent().recognitionText });
  updateScene();
}

$("#solenoidStage")?.addEventListener("click", event => {
  const button = event.target.closest("[data-solenoid-action]");
  if (!button || state.subject !== "物理" || state.physicsTemplate !== "solenoid") return;
  clearReasoningTimers();
  const action = button.dataset.solenoidAction;
  if (action === "view") {
    state.solenoidViewEnd = state.solenoidViewEnd === "left" ? "right" : "left";
    refreshSolenoidAfterControl(true);
    showToast(`已切换为从${solenoidViewText(state.solenoidViewEnd)}观察`);
  }
  if (action === "reverse") {
    state.solenoidWindingDirection = state.solenoidWindingDirection === "counterclockwise" ? "clockwise" : "counterclockwise";
    refreshSolenoidAfterControl(true);
    setReasoningStep(3, `<span>电流反转</span>传统电流方向反向，磁感线方向与小磁针同步反转，N/S 极交换；磁性强弱不因方向反转而减弱。`);
    showToast("电流已反转：磁极交换，强弱基本不变");
  }
  if (action === "core") {
    state.solenoidHasCore = !state.solenoidHasCore;
    refreshSolenoidAfterControl(true);
    showToast(state.solenoidHasCore ? "已插入铁芯：磁性明显增强" : "已拔出铁芯：磁性回到线圈状态");
  }
  if (action === "pause") {
    state.solenoidPaused = !state.solenoidPaused;
    updateScene();
    button.textContent = state.solenoidPaused ? "继续动画" : "暂停动画";
    showToast(state.solenoidPaused ? "已暂停磁感线与电流动画" : "动画已继续");
  }
  if (action === "reset") {
    state.p1 = 0.5;
    state.p2 = 200;
    state.solenoidViewEnd = "left";
    state.solenoidWindingDirection = "counterclockwise";
    state.solenoidHasCore = false;
    state.solenoidPaused = false;
    state.solenoidRotateX = 0;
    state.solenoidRotateY = 0;
    state.solenoidZoom = 1;
    refreshSolenoidAfterControl(true);
    const pauseButton = $("#solenoidStage")?.querySelector('[data-solenoid-action="pause"]');
    if (pauseButton) pauseButton.textContent = "暂停动画";
    showToast("已恢复螺线管默认实验");
  }
});

$("#solenoidLab")?.addEventListener("pointerdown", event => {
  if (state.subject !== "物理" || state.physicsTemplate !== "solenoid") return;
  if (event.target.closest("button")) return;
  clearReasoningTimers();
  state.solenoidDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    rotateX: state.solenoidRotateX,
    rotateY: state.solenoidRotateY
  };
  $("#solenoidLab").setPointerCapture(event.pointerId);
  elements.solenoidCanvas?.classList.add("dragging");
});

$("#solenoidLab")?.addEventListener("pointermove", event => {
  if (!state.solenoidDrag || state.solenoidDrag.pointerId !== event.pointerId) return;
  const dx = event.clientX - state.solenoidDrag.startX;
  const dy = event.clientY - state.solenoidDrag.startY;
  state.solenoidRotateY = clamp(state.solenoidDrag.rotateY + dx * 0.32, -62, 62);
  state.solenoidRotateX = clamp(state.solenoidDrag.rotateX + dy * 0.16, -34, 34);
  updateScene();
});

const endSolenoidDrag = event => {
  if (!state.solenoidDrag || state.solenoidDrag.pointerId !== event.pointerId) return;
  state.solenoidDrag = null;
  elements.solenoidCanvas?.classList.remove("dragging");
};

$("#solenoidLab")?.addEventListener("pointerup", endSolenoidDrag);
$("#solenoidLab")?.addEventListener("pointercancel", endSolenoidDrag);
$("#solenoidLab")?.addEventListener("wheel", event => {
  if (state.subject !== "物理" || state.physicsTemplate !== "solenoid") return;
  event.preventDefault();
  clearReasoningTimers();
  state.solenoidZoom = clamp((state.solenoidZoom || 1) - event.deltaY * 0.0008, 0.72, 1.45);
  drawSolenoidCanvas();
}, { passive: false });

$("#hintButton").addEventListener("click", () => {
  if (window.MasterLabAITutor?.askQuickAction?.("hint")) return;
  if (!state.hasGenerated) {
    showToast("请先生成实验，再向 AI 导师提问");
    return;
  }
  clearReasoningTimers();
  setDemoStep(5, "AI 导师追问与迁移");
  elements.mentorMessage.innerHTML = config().hint;
  if (state.subject === "物理") {
    updateFormulaSpotlight("物理");
    if (state.physicsTemplate === "boardSlider") {
      setReasoningStep(1, `<span>AI 提示</span>木板本身也在运动，先把观察量改成 xA − xB，而不是滑块对地位移。`);
      elements.mentorFeedback.className = "mentor-feedback show challenge";
      elements.mentorFeedback.innerHTML = `<span>进一步追问</span><strong>两个摩擦力大小相等，为什么滑块和木板的加速度不一定相等？</strong>`;
      showToast("AI 导师已提示关注相对位移");
    } else if (state.physicsTemplate === "solenoid") {
      setReasoningStep(2, `<span>AI 提示</span>先分清：电流绕向决定磁极方向，电流大小、匝数和铁芯影响磁性强弱。`);
      hideMentorFeedback();
      showToast("AI 导师已给出安培定则提示");
    } else if (state.physicsTemplate === "projectile") {
      setReasoningStep(2, `<span>AI 提示</span>把平抛拆成两个方向：水平匀速，竖直自由落体。先由高度求时间，再求水平位移。`);
      hideMentorFeedback();
      showToast("AI 导师已给出平抛分解提示");
    } else if (state.physicsTemplate === "circuit") {
      setReasoningStep(2, `<span>AI 提示</span>确认是纯电阻电路后，直接用 I = U / R；注意电压、电阻和电流单位。`);
      hideMentorFeedback();
      showToast("AI 导师已给出欧姆定律提示");
    } else if (isExtraPhysicsTemplate()) {
      const content = buildExtraPhysicsContent();
      setReasoningStep(2, `<span>AI 提示</span>${content.hint.replace(/<[^>]+>/g, "")}`);
      hideMentorFeedback();
      showToast("AI 导师已给出当前题型公式提示");
    } else {
      setReasoningStep(2, `<span>AI 提示</span>题目没有给时间 t，先找不含 t 的速度—位移公式。`);
      showMentorFormulaFeedback();
      showToast("核心公式已浮现");
    }
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
  if (window.MasterLabAITutor?.askQuickAction?.("variant")) return;
  if (!state.hasGenerated) {
    showToast("请先生成实验，再加载变式挑战");
    return;
  }
  clearReasoningTimers();
  setDemoStep(5, "AI 导师追问与迁移");
  clearDemoTimers();

  if (state.subject === "物理" && state.physicsTemplate === "boardSlider") {
    state.boardSliderParams = { ...state.boardSliderParams, initialSpeed: 5 };
    state.p1 = 5;
    state.p2 = state.boardSliderParams.boardLength;
    syncPhysicsBoardSliderContent(state.boardSliderParams);
    syncPhysicsControlsFromState();
    updateParameters(true, { syncQuestion: true });
    const model = boardSliderModel();
    const exitValues = boardSliderValuesAt(model.exitTime ?? model.syncTime, model).boardSlider;
    setReasoningStep(4, `<span>变式挑战</span>最大相对位移 = ${boardSliderNumber(model.relativeStopDistance)}m ${model.relationSymbol} L = ${boardSliderNumber(model.boardLength)}m，结论：${model.outcomeLabel}。`);
    elements.mentorMessage.innerHTML = model.outcome === "fall"
      ? `初速度改为 <strong>5m/s</strong> 后，相对加速度大小为 <strong>${boardSliderNumber(model.relativeDeceleration)}m/s²</strong>，最大相对位移为 <strong>${boardSliderNumber(model.relativeStopDistance)}m</strong>，大于木板长度。滑块在 <strong>${boardSliderNumber(model.exitTime)}s</strong> 从右端滑出；此时 v<sub>A</sub> = <strong>${boardSliderNumber(exitValues.blockSpeed)}m/s</strong>，v<sub>B</sub> = <strong>${boardSliderNumber(exitValues.boardSpeed)}m/s</strong>。`
      : model.outcome === "critical"
        ? `初速度改为 <strong>5m/s</strong> 后，最大相对位移恰好等于木板长度 <strong>${boardSliderNumber(model.boardLength)}m</strong>；滑块到达右端时与木板达到共同速度 <strong>${boardSliderNumber(model.commonSpeed)}m/s</strong>。`
        : `初速度改为 <strong>5m/s</strong> 后，最大相对位移为 <strong>${boardSliderNumber(model.relativeStopDistance)}m</strong>，仍小于木板长度；二者在 <strong>${boardSliderNumber(model.syncTime)}s</strong> 后以 <strong>${boardSliderNumber(model.commonSpeed)}m/s</strong> 共同匀速运动。`;
    hideMentorFeedback();
    showToast(model.outcome === "fall" ? `木板—滑块变式已同步：${boardSliderNumber(model.exitTime)}s 从右端滑出` : `木板—滑块变式已同步：${model.outcomeLabel}`);
    return;
  }

  if (state.subject === "物理" && state.physicsTemplate === "solenoid") {
    state.p1 = 1;
    state.p2 = Math.max(400, state.p2);
    state.solenoidWindingDirection = state.solenoidWindingDirection === "counterclockwise" ? "clockwise" : "counterclockwise";
    state.solenoidHasCore = true;
    state.solenoidPaused = false;
    syncPhysicsSolenoidContent();
    elements.ranges[0].value = state.p1;
    elements.ranges[1].value = state.p2;
    updateParameters(true, { syncQuestion: true });
    const content = buildPhysicsSolenoidContent();
    setReasoningStep(4, `<span>变式挑战</span>电流增大且方向反转：N/S 极交换，磁性增强。`);
    elements.mentorMessage.innerHTML = `现在电流为 <strong>${formatAmp(state.p1)}A</strong>，方向已反转，并插入铁芯。结论：<strong>N、S 极交换</strong>，同时电流增大与铁芯使磁性<strong>${content.model.strengthLevel}</strong>。`;
    showToast("电磁变式已同步：磁极交换，磁性增强");
    return;
  }

  if (state.subject === "物理" && state.physicsTemplate === "projectile") {
    const previous = projectileModel();
    const nextSpeed = clamp(Math.round(state.p1 * 1.5), PROJECTILE_LIMITS.speedMin, PROJECTILE_LIMITS.speedMax);
    state.p1 = nextSpeed;
    syncPhysicsProjectileContent(nextSpeed, state.p2);
    syncPhysicsControlsFromState();
    updateParameters(true, { syncQuestion: true });
    const next = projectileModel();
    setReasoningStep(4, `<span>变式挑战</span>水平速度增大，落地时间不变，水平位移随 v₀ 增大。`);
    elements.mentorMessage.innerHTML = `我已把水平速度从 <strong>${smartNumber(previous.speed)}m/s</strong> 改为 <strong>${smartNumber(next.speed)}m/s</strong>。高度不变，所以落地时间仍约 <strong>${smartNumber(next.fallTime, 2)}s</strong>，水平位移变为 <strong>${smartNumber(next.range, 1)}m</strong>。`;
    hideMentorFeedback();
    showToast("平抛变式题已同步");
    return;
  }

  if (state.subject === "物理" && state.physicsTemplate === "circuit") {
    const nextVoltage = clamp(state.p1 * 2, CIRCUIT_LIMITS.voltageMin, CIRCUIT_LIMITS.voltageMax);
    state.p1 = nextVoltage;
    syncPhysicsCircuitContent(nextVoltage, state.p2);
    syncPhysicsControlsFromState();
    updateParameters(true, { syncQuestion: true });
    const next = circuitModel();
    setReasoningStep(3, `<span>变式挑战</span>电阻不变时，电压增大，电流按比例增大。`);
    elements.mentorMessage.innerHTML = `电阻保持 <strong>${smartNumber(next.resistance)}Ω</strong>，电压变为 <strong>${smartNumber(next.voltage)}V</strong>，所以电流变为 <strong>${smartNumber(next.current, 2)}A</strong>。`;
    hideMentorFeedback();
    showToast("欧姆定律变式题已同步");
    return;
  }

  if (state.subject === "物理" && isExtraPhysicsTemplate()) {
    const template = extraPhysicsTemplate();
    const nextP1 = clamp(state.p1 + Number(template.params[0].step) * 2, template.params[0].min, template.params[0].max);
    const nextP2 = clamp(state.p2 + Number(template.params[1].step) * 2, template.params[1].min, template.params[1].max);
    state.p1 = nextP1 === state.p1 ? template.defaults[0] : nextP1;
    state.p2 = nextP2 === state.p2 ? template.defaults[1] : nextP2;
    syncExtraPhysicsContent(state.physicsTemplate, state.p1, state.p2);
    syncPhysicsControlsFromState();
    updateParameters(true, { syncQuestion: true });
    const content = buildExtraPhysicsContent();
    setReasoningStep(4, `<span>变式挑战</span>${content.model.conclusion}`);
    elements.mentorMessage.innerHTML = `我已生成同类型变式：<strong>${content.recognitionText}</strong>。请用 <strong>${content.model.formula}</strong> 解释变化。`;
    hideMentorFeedback();
    showToast("物理模板变式题已同步");
    return;
  }

  if (state.subject === "物理" && state.physicsTemplate === "brake" && state.brakeMode === "friction") {
    const previous = physicsBrakeModel();
    const nextMu = clamp(state.p2 + 0.1, PHYSICS_FRICTION_BRAKE_LIMITS.muMin, PHYSICS_FRICTION_BRAKE_LIMITS.muMax);
    state.p2 = nextMu === state.p2 ? Math.max(PHYSICS_FRICTION_BRAKE_LIMITS.muMin, state.p2 - 0.1) : nextMu;
    syncPhysicsBrakeContent(state.p1, state.p2, { mode: "friction", gravity: state.brakeGravity });
    syncPhysicsControlsFromState();
    updateParameters(true, { syncQuestion: true });
    const next = physicsBrakeModel();
    setReasoningStep(4, `<span>变式挑战</span>μ 增大使减速度增大，停止距离缩短。`);
    elements.mentorMessage.innerHTML = `动摩擦因数从 <strong>${smartNumber(previous.mu, 2)}</strong> 变为 <strong>${smartNumber(next.mu, 2)}</strong>，减速度由 <strong>${smartNumber(previous.aAbs)}m/s²</strong> 增至 <strong>${smartNumber(next.aAbs)}m/s²</strong>，停止距离缩短为 <strong>${smartNumber(next.stopDistance)}m</strong>。`;
    hideMentorFeedback();
    showToast(`摩擦制动变式已同步：停止距离 ${smartNumber(next.stopDistance)}m`);
    return;
  }

  if (state.subject === "物理" && state.physicsTemplate === "brake" && state.brakeMode === "linear_drag") {
    const previous = physicsBrakeModel();
    const kBounds = linearDragKBounds(state.brakeMass);
    const nextK = clamp(state.p2 * 1.5, kBounds.min, kBounds.max);
    state.p2 = nextK === state.p2 ? Math.max(kBounds.min, state.p2 * 0.75) : nextK;
    syncPhysicsBrakeContent(state.p1, state.p2, { mode: "linear_drag", mass: state.brakeMass });
    syncPhysicsControlsFromState();
    updateParameters(true, { syncQuestion: true });
    const next = physicsBrakeModel();
    setReasoningStep(4, `<span>变式挑战</span>k 增大，时间常数 τ=m/k 与极限位移 mv₀/k 同时减小。`);
    elements.mentorMessage.innerHTML = `阻力系数从 <strong>${smartNumber(previous.k)}kg/s</strong> 增至 <strong>${smartNumber(next.k)}kg/s</strong>，时间常数由 <strong>${smartNumber(previous.tau, 2)}s</strong> 减至 <strong>${smartNumber(next.tau, 2)}s</strong>，极限位移变为 <strong>${smartNumber(next.stopDistance)}m</strong>。`;
    hideMentorFeedback();
    showToast(`线性阻力变式已同步：极限位移 ${smartNumber(next.stopDistance)}m`);
    return;
  }

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
    syncFavoriteState();
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
    const model = currentMathModel();
    const nextX = clamp(model.challengeX ?? model.defaultX, model.domainMin, model.domainMax);
    elements.ranges[0].value = nextX;
    updateParameters(true, { syncQuestion: true });
    const slope = model.derivative(nextX);
    setReasoningStep(3, `<span>变式挑战</span>x = ${formatMathNumber(nextX)} 时，代入 y′ = ${model.derivativeText}，得到 k = ${formatMathNumber(slope)}。`);
    elements.mentorMessage.innerHTML = `如果 <strong>x = ${formatMathNumber(nextX)}</strong>，代入 <strong>y′ = ${model.derivativeText}</strong>，可得切线斜率 <strong>k = ${formatMathNumber(slope)}</strong>。`;
    showToast(`数学变式题已同步：k = ${formatMathNumber(slope)}`);
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

$("#favoriteList")?.addEventListener("click", event => {
  const item = event.target.closest(".favorite-item");
  if (!item) return;
  applyWaitingState(item.dataset.subject);
  $("#questionInput").value = item.dataset.question;
  window.scrollTo({ top: 0, behavior: "smooth" });
  showToast(`${item.dataset.subject}收藏实验已载入，点击生成实验开始建模`);
});

$("#playbackButton").addEventListener("click", event => {
  const rates = [1, 1.5, 2];
  state.playbackRate = rates[(rates.indexOf(state.playbackRate) + 1) % rates.length];
  event.currentTarget.textContent = `${state.playbackRate}×`;
  showToast(`播放速度已调整为 ${state.playbackRate}×`);
});

function syncFullscreenButtons() {
  const active = elements.experimentCard?.classList.contains("immersive-mode") || document.fullscreenElement === elements.experimentCard;
  elements.fullscreenButtons.forEach(button => {
    button.classList.toggle("fullscreen-active", active);
    button.setAttribute("aria-label", active ? "退出全屏" : "全屏查看实验");
    button.setAttribute("aria-pressed", String(active));
  });
}

function setExperimentFullscreen(active) {
  elements.experimentCard?.classList.toggle("immersive-mode", active);
  document.body.classList.toggle("fullscreen-lock", active);
  syncFullscreenButtons();
}

function toggleExperimentFullscreen() {
  setExperimentFullscreen(!elements.experimentCard?.classList.contains("immersive-mode"));
}

elements.fullscreenButtons.forEach(button => {
  button.addEventListener("click", toggleExperimentFullscreen);
});

document.addEventListener("fullscreenchange", syncFullscreenButtons);

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && elements.experimentCard?.classList.contains("immersive-mode")) {
    setExperimentFullscreen(false);
  }
});

[$("#promptFavoriteButton"), $("#favoriteButton")].filter(Boolean).forEach(button => {
  button.addEventListener("click", toggleCurrentFavorite);
});

$("#shareButton").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(`${location.href}#${encodeURIComponent(state.subject)}`);
    showToast("实验分享链接已复制");
  } catch {
    showToast("复制失败，请检查浏览器权限");
  }
});

document.addEventListener("keydown", event => {
  if (event.code === "Space" && event.target.tagName !== "INPUT") {
    event.preventDefault();
    if (state.subject === "数学" || state.subject === "生物") {
      playExperiment();
      return;
    }
    state.playing ? pauseExperiment() : playExperiment();
  }
});

window.addEventListener("resize", () => {
  if (state.subject === "物理") {
    setPhysicsStopMarker();
    updateScene();
  }
  if (state.subject === "物理" && state.physicsTemplate === "solenoid") {
    drawSolenoidCanvas();
  }
  if (state.subject === "物理" && state.physicsTemplate === "boardSlider") {
    renderBoardSliderScene(valuesAt(state.time));
  }
});

renderFavoriteList();
syncFavoriteState();
updateGreeting();
applyWaitingState("物理", { presetQuestion: true });
updatePhysicsPresetOption();
setDemoStep(1, "输入题目，生成实验");
requestAnimationFrame(solenoidAnimationFrame);
if (document.body.classList.contains("demo-mode")) {
  scheduleAutoDemo();
}

window.addEventListener("pageshow", event => {
  if (!event.persisted) return;
  updateGreeting();
  applyWaitingState("物理", { presetQuestion: true });
});
