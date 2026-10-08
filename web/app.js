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
    metrics: [["速度 v", "m/s"], ["位移 x", "m"], ["时间 t", "s"]],
    params: [
      { label: "初速度 v₀", desc: "调整车辆起始速度", unit: "m/s", min: 5, max: 80, step: 1, value: 20 },
      { label: "加速度 a", desc: "调整刹车减速度", unit: "m/s²", min: 1, max: 20, step: 1, value: 5, prefix: "−" }
    ],
    steps: [
      ["题干条件", "v₀ = 20m/s，a = −5m/s²，v = 0", "先识别初速度、刹车加速度和末速度。"],
      ["选择公式", "v² − v₀² = 2ax", "题目没有给出时间，所以选择不含 t 的速度位移公式。"],
      ["代入求解", "0² − 20² = 2×(−5)×x", "代入数据后得到刹车距离 x = 40m。"],
      ["现象验证", "速度归零，停止点 40m", "结果为正且单位正确，并与实验停止点一致。"]
    ],
    mentor: "为什么这里选 <strong>v² − v₀² = 2ax</strong>？因为题目没有给时间，却给了速度、加速度和位移关系。",
    hint: "小提示：题目给出了 <strong>初速度、末速度和加速度</strong>，但没有给时间。哪条公式不含 t？",
    challenge: "很好！现在初速度变成了 <strong>30m/s</strong>。预测一下：刹车距离会变成原来的多少倍？"
  },
  "化学": {
    question: "将 5.6g 铁粉加入含有 0.20mol 硫酸铜的溶液中，充分反应。请计算最多生成多少 mol 铜？生成铜的质量是多少？并判断哪种反应物过量。",
    title: "铁与硫酸铜反应：定量观察铜的生成",
    description: "Fe + CuSO₄ = FeSO₄ + Cu，铁表面析出红色铜，溶液由蓝色逐渐变为浅绿色。",
    engine: "典型题型模板演示",
    ar: "移动端扩展可继续展示铁与硫酸铜反应的沉积过程。",
    metrics: [["Fe 投入", "g"], ["生成 Cu", "mol"], ["Cu 质量", "g"]],
    params: [
      { label: "铁粉质量 m(Fe)", desc: "调整投入铁粉质量", unit: "g", min: 2.8, max: 16.8, step: 2.8, value: 5.6 },
      { label: "硫酸铜 n(CuSO₄)", desc: "调整硫酸铜物质的量", unit: "mol", min: 0.05, max: 0.3, step: 0.05, value: 0.2 }
    ],
    steps: [
      ["提取条件", "Fe = 5.6g，CuSO₄ = 0.20mol", "先识别铁的质量和硫酸铜的物质的量。"],
      ["换算物质的量", "n(Fe) = m/M = 5.6 g ÷ 56 g/mol = 0.10 mol", "把铁的质量换算成物质的量。"],
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
    title: "植物细胞：结构与功能",
    description: "从细胞壁、细胞膜到中央液泡，点击结构，观察形态与功能。",
    engine: "典型题型模板演示",
    ar: "移动端扩展可继续展示植物细胞截面、结构标注与 360° 观察。",
    metrics: [["可点结构", "个"], ["旋转视角", "°"], ["观察时间", "s"]],
    params: [
      { label: "观察角度", desc: "拖拽或滑动倾转分层剖面", unit: "°", min: -45, max: 45, step: 5, value: -10 },
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
  projectileGravity: 9.8,
  extraFixed: {},
  circuitSolve: null,
  chemGiven: null,
  brakeAsk: null,
  projectileAsk: null,
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
  cellLevel: "senior",
  cellLabelsVisible: true,
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

// Cell structures follow 人教版 textbooks: 七年级上册（光学显微镜下的基本结构）and
// 必修1《分子与细胞》第3章（电子显微镜下的亚显微结构）. Wording stays close to the textbooks.
const CELL_LEVEL_LABELS = {
  junior: "初中 · 显微结构",
  senior: "高中 · 亚显微结构"
};

const CELL_LEVEL_SOURCES = {
  junior: "人教版七年级上册",
  senior: "人教版必修1《分子与细胞》"
};

const CELL_STRUCTURE_TEXT = {
  cellWall: {
    name: "细胞壁",
    junior: {
      type: "植物细胞特有结构",
      function: "保护和支持细胞",
      memory: "植物细胞有细胞壁，动物细胞没有细胞壁"
    },
    senior: {
      type: "细胞最外层 · 全透性",
      function: "主要由纤维素和果胶构成，对细胞起支持与保护作用",
      memory: "细胞壁不是细胞的边界；细胞的边界是细胞膜"
    }
  },
  cellMembrane: {
    name: "细胞膜",
    junior: {
      type: "细胞的边界",
      function: "控制物质的进出，使细胞拥有比较稳定的内部环境",
      memory: {
        plant: "细胞膜很薄，紧贴细胞壁内侧，在光学显微镜下不易看清",
        animal: "动物细胞没有细胞壁，细胞膜是最外层结构"
      }
    },
    senior: {
      type: "细胞的边界",
      function: "将细胞与外界环境分隔开；控制物质进出细胞；进行细胞间的信息交流",
      memory: "细胞膜主要由脂质和蛋白质组成"
    }
  },
  cytoplasm: {
    name: "细胞质",
    junior: {
      type: "细胞膜以内、细胞核以外的部分",
      function: "细胞质能够流动，加快细胞与外界环境的物质交换",
      memory: {
        plant: "液泡、叶绿体和线粒体等结构都位于细胞质中",
        animal: "线粒体等结构位于细胞质中"
      }
    },
    senior: {
      type: "细胞质基质 + 细胞器",
      function: "细胞质基质呈溶胶状，是多种化学反应进行的场所",
      memory: "各种细胞器分布在细胞质基质中"
    }
  },
  nucleus: {
    name: "细胞核",
    junior: {
      type: "细胞生命活动的控制中心",
      function: "细胞核内含有遗传物质，控制着生物的发育和遗传",
      memory: "遗传物质 DNA 主要存在于细胞核中"
    },
    senior: {
      type: "遗传信息库 · 双层核膜",
      function: "细胞核是遗传信息库，是细胞代谢和遗传的控制中心",
      memory: "核膜为双层膜，核孔实现核质间物质交换和信息交流；核仁与某种 RNA 的合成及核糖体的形成有关；染色质主要由 DNA 和蛋白质组成"
    }
  },
  vacuole: {
    name: "液泡",
    junior: {
      type: "植物细胞特有（与动物细胞相比）",
      function: "液泡内含细胞液，溶解着多种物质，如糖分和色素等",
      memory: "成熟植物细胞中常有一个很大的中央液泡"
    },
    senior: {
      type: "单层膜细胞器",
      function: "内有细胞液，含糖类、无机盐、色素和蛋白质等，可以调节植物细胞内的环境，充盈的液泡还可以使植物细胞保持坚挺",
      memory: "液泡由单层液泡膜包围，主要存在于植物细胞中"
    }
  },
  chloroplast: {
    name: "叶绿体",
    junior: {
      type: "能量转换器",
      function: "光合作用的场所，能将光能转变为化学能储存在有机物中",
      memory: "叶绿体只存在于植物体的绿色部分，如叶肉细胞"
    },
    senior: {
      type: "双层膜细胞器",
      function: "绿色植物能进行光合作用的细胞含有叶绿体，是光合作用的场所",
      memory: "“养料制造车间”和“能量转换站”；内有许多由类囊体堆叠而成的基粒"
    }
  },
  mitochondrion: {
    name: "线粒体",
    junior: {
      type: "能量转换器",
      function: "呼吸作用的场所，能将有机物中的化学能释放出来，供细胞利用",
      memory: "动物细胞和植物细胞都有线粒体"
    },
    senior: {
      type: "双层膜细胞器",
      function: "细胞进行有氧呼吸的主要场所",
      memory: "“动力车间”；内膜向内折叠形成嵴，增大膜面积"
    }
  },
  endoplasmicReticulum: {
    name: "内质网",
    senior: {
      type: "单层膜细胞器",
      function: "由膜连接而成的网状结构，是细胞内蛋白质等大分子物质的合成、加工场所和运输通道",
      memory: "粗面内质网上附着有核糖体；内质网膜与外层核膜相连"
    }
  },
  golgi: {
    name: "高尔基体",
    senior: {
      type: "单层膜细胞器",
      function: "对来自内质网的蛋白质进行加工、分类和包装的“车间”及“发送站”",
      memory: {
        plant: "在植物细胞中，高尔基体与细胞壁的形成有关",
        animal: "分泌蛋白经内质网加工后以囊泡运到高尔基体，再以囊泡运往细胞膜"
      }
    }
  },
  ribosome: {
    name: "核糖体",
    senior: {
      type: "无膜细胞器",
      function: "“生产蛋白质的机器”，是合成蛋白质的场所",
      memory: "有的附着在内质网上，有的游离分布在细胞质中；体积很小，图中已放大"
    }
  },
  lysosome: {
    name: "溶酶体",
    senior: {
      type: "单层膜细胞器",
      function: "“消化车间”，内含多种水解酶，能分解衰老、损伤的细胞器，吞噬并杀死侵入细胞的病毒或细菌",
      memory: "主要分布在动物细胞中"
    }
  },
  centrosome: {
    name: "中心体",
    senior: {
      type: "无膜细胞器",
      function: "由两个互相垂直排列的中心粒及周围物质组成，与细胞的有丝分裂有关",
      memory: "见于动物和某些低等植物细胞，高等植物细胞没有中心体"
    }
  }
};

const CELL_STRUCTURE_SETS = {
  plant: {
    junior: ["cellWall", "cellMembrane", "cytoplasm", "nucleus", "vacuole", "chloroplast", "mitochondrion"],
    senior: ["cellWall", "cellMembrane", "cytoplasm", "nucleus", "vacuole", "chloroplast", "mitochondrion", "endoplasmicReticulum", "golgi", "ribosome"]
  },
  animal: {
    junior: ["cellMembrane", "cytoplasm", "nucleus", "mitochondrion"],
    senior: ["cellMembrane", "cytoplasm", "nucleus", "mitochondrion", "endoplasmicReticulum", "golgi", "ribosome", "lysosome", "centrosome"]
  }
};

function normalizeCellLevel(level) {
  return level === "junior" ? "junior" : "senior";
}

function cellStructureEntry(id, type = "plant", level = "senior") {
  const source = CELL_STRUCTURE_TEXT[id];
  if (!source) return null;
  const detail = source[normalizeCellLevel(level)] || source.senior || source.junior;
  const pick = value => (value && typeof value === "object" ? value[type] || value.plant : value);
  return {
    id,
    name: source.name,
    type: pick(detail.type),
    function: pick(detail.function),
    memory: pick(detail.memory)
  };
}

function cellStructureList(type = "plant", level = "senior") {
  const set = CELL_STRUCTURE_SETS[type] || CELL_STRUCTURE_SETS.plant;
  return set[normalizeCellLevel(level)].map(id => cellStructureEntry(id, type, level));
}

const CELL_TYPE_LABELS = {
  plant: "植物细胞",
  animal: "动物细胞"
};

const CELL_ORGANELLE_MAP = new Map(
  Object.keys(CELL_STRUCTURE_TEXT).map(id => [id, cellStructureEntry(id, "plant", "senior")])
);

/* ---------- Cell model drawing (SVG, viewBox 500 × 300) ---------- */

const CELL_SHAPES = {
  plant: {
    wall: "M80 30 L418 26 Q444 28 446 56 L442 246 Q440 272 412 274 L88 272 Q60 270 58 244 L60 58 Q62 32 80 30 Z",
    membrane: "M86 39.5 L414 35.5 Q435.5 37.5 436.5 60 L432.5 242 Q430.5 263.5 408 264.5 L92 262.5 Q69.5 260.5 68.5 240 L70 62 Q71.5 41.5 86 39.5 Z",
    vacuole: "M190 70 C250 58 350 60 392 74 C412 84 412 140 408 186 C404 226 376 238 310 238 C250 240 196 238 176 214 C160 194 158 110 190 70 Z"
  },
  animal: {
    membrane: "M104 94 C116 50 196 38 262 42 C330 34 396 54 414 102 C434 150 424 216 370 242 C314 266 250 254 194 262 C132 270 86 240 80 188 C74 150 84 120 104 94 Z"
  }
};

const CELL_LAYOUTS = {
  plant: {
    nucleus: { cx: 112, cy: 150, r: 26 },
    chloroplasts: [[200, 51, -4], [318, 50, 3], [422, 116, 88], [322, 250, -2], [208, 251, 3], [100, 74, -32]],
    mitochondria: [[262, 51, 2], [421, 176, 90], [265, 251, 0]],
    erArcs: [{ r: 35, from: -160, to: -18 }, { r: 42, from: -150, to: -28 }],
    golgi: { cx: 116, cy: 216, rot: 0, scale: 0.9 },
    ribosomes: [[150, 44], [236, 45], [352, 46], [396, 44], [424, 84], [428, 146], [426, 222], [392, 254], [356, 256], [238, 257], [176, 256], [146, 246], [84, 190], [150, 186], [88, 108], [140, 76], [428, 238], [288, 46], [172, 62]],
    labels: {
      junior: [
        ["cellWall", 61, 64, "left", 48],
        ["chloroplast", 94, 70, "left", 84],
        ["nucleus", 98, 150, "left", 150],
        ["cellMembrane", 69.2, 222, "left", 214],
        ["cytoplasm", 142, 238, "left", 262],
        ["vacuole", 356, 150, "right", 132],
        ["mitochondrion", 421, 176, "right", 196]
      ],
      senior: [
        ["cellWall", 61, 60, "left", 38],
        ["chloroplast", 94, 70, "left", 72],
        ["endoplasmicReticulum", 96, 112, "left", 108],
        ["nucleus", 100, 150, "left", 148],
        ["golgi", 104, 216, "left", 190],
        ["cellMembrane", 69.2, 232, "left", 228],
        ["cytoplasm", 146, 236, "left", 264],
        ["ribosome", 424, 84, "right", 70],
        ["vacuole", 356, 150, "right", 132],
        ["mitochondrion", 421, 176, "right", 196]
      ]
    }
  },
  animal: {
    nucleus: { cx: 220, cy: 150, r: 38 },
    mitochondria: [[128, 116, 30], [376, 150, 80], [268, 234, -8], [132, 198, -40]],
    erArcs: [{ r: 48, from: 8, to: 112 }, { r: 56, from: 12, to: 104 }, { r: 64, from: 18, to: 96 }],
    smoothEr: "M300 204 C310 196 318 212 328 204 S344 196 350 208 M306 216 C316 210 326 224 336 218",
    golgi: { cx: 322, cy: 124, rot: 90, scale: 1 },
    lysosomes: [[340, 232, 6.5], [150, 232, 6], [360, 88, 5.5]],
    centrosome: { cx: 262, cy: 84 },
    ribosomes: [[160, 70], [206, 62], [300, 62], [330, 170], [398, 176], [300, 244], [232, 246], [180, 240], [110, 160], [150, 96], [392, 112], [404, 206], [240, 60], [338, 58], [112, 226], [300, 176], [180, 104], [372, 222]],
    labels: {
      junior: [
        ["mitochondrion", 122, 112, "left", 96],
        ["nucleus", 196, 150, "left", 150],
        ["cellMembrane", 80.5, 196, "left", 204],
        ["cytoplasm", 150, 236, "left", 262]
      ],
      senior: [
        ["mitochondrion", 122, 112, "left", 84],
        ["nucleus", 196, 150, "left", 126],
        ["cellMembrane", 80.5, 196, "left", 212],
        ["cytoplasm", 190, 250, "left", 266],
        ["centrosome", 262, 84, "right", 34],
        ["golgi", 322, 124, "right", 84],
        ["ribosome", 398, 176, "right", 138],
        ["endoplasmicReticulum", 262, 186, "right", 196],
        ["lysosome", 340, 232, "right", 250]
      ]
    }
  }
};

// Which depth layer each structure is drawn in (base → mid → top).
const CELL_STRUCTURE_LAYER = {
  cellWall: "base",
  cellMembrane: "base",
  cytoplasm: "base",
  vacuole: "mid",
  nucleus: "mid",
  endoplasmicReticulum: "mid",
  golgi: "mid",
  chloroplast: "top",
  mitochondrion: "top",
  ribosome: "top",
  lysosome: "top",
  centrosome: "top"
};

const cellNum = value => Number(value.toFixed(2));

function cellOrganelleGroup(id, inner, extra = "") {
  const name = CELL_STRUCTURE_TEXT[id]?.name || "细胞结构";
  return `<g class="cell-organelle cell-${id}" data-organelle="${id}" role="button" tabindex="0" aria-label="${name}"${extra}>${inner}</g>`;
}

function cellChloroplast(cx, cy, rot, level) {
  const body = level === "senior"
    ? `<ellipse class="chl-outer" rx="17" ry="8.2"/><ellipse class="chl-inner" rx="15.2" ry="6.6"/>
       <path class="chl-lamella" d="M-12 0H12M-8 -2.4L-3 1.6M3 -1.6L8 2.4"/>
       ${[-10, -3.5, 3.5, 10].map((x, index) => `<g transform="translate(${x} ${index % 2 ? 0.6 : -0.6})">${[-3.4, -1.7, 0, 1.7].map(y => `<rect class="chl-granum" x="-2.3" y="${y}" width="4.6" height="1" rx="0.45"/>`).join("")}</g>`).join("")}`
    : `<ellipse class="chl-outer junior" rx="17" ry="8.2"/>
       ${[[-10, -2], [-4, 2], [2, -2.4], [8, 1.6], [12, -1], [-13, 2.2]].map(([x, y]) => `<circle class="chl-grain" cx="${x}" cy="${y}" r="1.7"/>`).join("")}`;
  return `<g transform="translate(${cx} ${cy}) rotate(${rot})"><ellipse class="cell-hit" rx="21" ry="12"/>${body}</g>`;
}

function cellMitochondrion(cx, cy, rot) {
  const cristae = [-7, -3.4, 0.2, 3.8, 7.2].map((x, index) => (
    index % 2 ? `<path class="mito-crista" d="M${x} 3.9V-0.6"/>` : `<path class="mito-crista" d="M${x} -3.9V0.6"/>`
  )).join("");
  return `<g transform="translate(${cx} ${cy}) rotate(${rot})"><ellipse class="cell-hit" rx="15" ry="9"/>
    <ellipse class="mito-outer" rx="11.5" ry="5.6"/><ellipse class="mito-inner" rx="9.8" ry="4.1"/>${cristae}</g>`;
}

function cellNucleus({ cx, cy, r }, level) {
  if (level !== "senior") {
    return `<g transform="translate(${cx} ${cy})"><circle class="cell-hit" r="${r + 4}"/>
      <circle class="nuc-body junior" r="${r}"/>
      ${[[-9, -8], [8, -10], [-11, 7], [10, 9], [0, 12], [-2, -14], [13, -1]].map(([x, y]) => `<circle class="nuc-grain" cx="${cellNum(x * r / 26)}" cy="${cellNum(y * r / 26)}" r="1.3"/>`).join("")}
      <circle class="nuc-core junior" cx="${cellNum(r * 0.12)}" cy="${cellNum(-r * 0.08)}" r="${cellNum(r * 0.26)}"/></g>`;
  }
  const pores = [20, 70, 125, 170, 215, 262, 312, 345].map(angle => {
    const rad = (angle * Math.PI) / 180;
    const x = cellNum(Math.cos(rad) * (r - 1.2));
    const y = cellNum(Math.sin(rad) * (r - 1.2));
    return `<rect class="nuc-pore" x="-1.2" y="-2.6" width="2.4" height="5.2" transform="translate(${x} ${y}) rotate(${angle})"/>`;
  }).join("");
  const s = r / 26;
  const chromatin = [
    "M-14 -6 C-10 -12 -4 -8 -6 -2 S-12 4 -8 8",
    "M4 -14 C10 -12 12 -6 8 -4",
    "M10 6 C16 8 14 14 8 14 S2 12 4 16",
    "M-16 10 C-12 8 -8 14 -12 16"
  ].map(d => `<path class="nuc-chromatin" d="${d}" transform="scale(${cellNum(s)})"/>`).join("");
  return `<g transform="translate(${cx} ${cy})"><circle class="cell-hit" r="${r + 4}"/>
    <circle class="nuc-envelope" r="${r}"/><circle class="nuc-envelope-inner" r="${cellNum(r - 2.6)}"/>${pores}${chromatin}
    ${[[-4, 8], [12, -8], [-8, -12], [0, -16], [14, 2]].map(([x, y]) => `<circle class="nuc-grain" cx="${cellNum(x * s)}" cy="${cellNum(y * s)}" r="1.2"/>`).join("")}
    <circle class="nuc-core" cx="${cellNum(2 * s)}" cy="${cellNum(-1 * s)}" r="${cellNum(r * 0.25)}"/></g>`;
}

function cellArcPath(cx, cy, r, from, to) {
  const point = angle => {
    const rad = (angle * Math.PI) / 180;
    return [cellNum(cx + Math.cos(rad) * r), cellNum(cy + Math.sin(rad) * r)];
  };
  const [x1, y1] = point(from);
  const [x2, y2] = point(to);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  const sweep = to > from ? 1 : 0;
  return `M${x1} ${y1}A${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`;
}

function cellRoughEr(nucleus, arcs, extra = "") {
  const { cx, cy, r } = nucleus;
  const sheets = arcs.map(arc => {
    const d = cellArcPath(cx, cy, arc.r, arc.from, arc.to);
    const dots = [];
    for (let angle = arc.from + 6; angle < arc.to - 3; angle += 11) {
      [arc.r - 3.3, arc.r + 3.3].forEach((radius, side) => {
        const rad = ((angle + side * 5) * Math.PI) / 180;
        dots.push(`<circle class="ribo-bound" cx="${cellNum(cx + Math.cos(rad) * radius)}" cy="${cellNum(cy + Math.sin(rad) * radius)}" r="1.05"/>`);
      });
    }
    return `<path class="er-sheet" d="${d}"/><path class="er-lumen" d="${d}"/>${dots.join("")}`;
  }).join("");
  const mid = (arcs[0].from + arcs[0].to) / 2;
  const rad = (mid * Math.PI) / 180;
  const link = `M${cellNum(cx + Math.cos(rad) * r)} ${cellNum(cy + Math.sin(rad) * r)}L${cellNum(cx + Math.cos(rad) * arcs[0].r)} ${cellNum(cy + Math.sin(rad) * arcs[0].r)}`;
  const hit = cellArcPath(cx, cy, (arcs[0].r + arcs[arcs.length - 1].r) / 2, arcs[0].from, arcs[0].to);
  return `<path class="cell-hit-stroke" d="${hit}" style="stroke-width:${arcs[arcs.length - 1].r - arcs[0].r + 16}"/>
    <path class="er-sheet" d="${link}"/><path class="er-lumen" d="${link}"/>${sheets}${extra}`;
}

function cellGolgi({ cx, cy, rot, scale }) {
  const cisternae = [[-12, 30], [-6, 26], [0, 22], [6, 18], [12, 13]].map(([y, w]) => {
    const d = `M${-w / 2} ${y}Q0 ${y + 7} ${w / 2} ${y}`;
    return `<path class="golgi-sac" d="${d}"/><path class="golgi-lumen" d="${d}"/>`;
  }).join("");
  const vesicles = [[-18, -9, 2.4], [18, -7, 2.2], [-15, 4, 2], [14, 8, 2.3], [0, 21, 2.6], [-8, 24, 1.9]].map(([x, y, rr]) => `<circle class="golgi-vesicle" cx="${x}" cy="${y}" r="${rr}"/>`).join("");
  return `<g transform="translate(${cx} ${cy}) rotate(${rot}) scale(${scale})"><ellipse class="cell-hit" rx="22" ry="22"/>${cisternae}${vesicles}</g>`;
}

function cellFreeRibosomes(points) {
  return points.map(([x, y]) => `<circle class="cell-hit" cx="${x}" cy="${y}" r="5"/><circle class="ribo-free" cx="${x}" cy="${y}" r="1.15"/>`).join("");
}

function cellLysosome(cx, cy, r) {
  return `<g transform="translate(${cx} ${cy})"><circle class="cell-hit" r="${r + 4}"/><circle class="lyso-body" r="${r}"/>
    ${[[-2, -2], [2, 1], [-1, 2.5], [2.5, -2.5]].map(([x, y]) => `<circle class="lyso-grain" cx="${cellNum(x * r / 6.5)}" cy="${cellNum(y * r / 6.5)}" r="0.9"/>`).join("")}</g>`;
}

function cellCentrosome({ cx, cy }) {
  const stripes = "M-4 -2.6V2.6M0 -2.6V2.6M4 -2.6V2.6";
  return `<g transform="translate(${cx} ${cy})"><circle class="cell-hit" r="15"/><circle class="centro-matrix" r="12"/>
    <g transform="translate(-3 -2)"><rect class="centriole" x="-7" y="-3" width="14" height="6" rx="1.2"/><path class="centriole-line" d="${stripes}"/></g>
    <g transform="translate(5 3) rotate(90)"><rect class="centriole" x="-7" y="-3" width="14" height="6" rx="1.2"/><path class="centriole-line" d="${stripes}"/></g></g>`;
}

function cellLabelMarkup([id, ax, ay, side, ly]) {
  const name = CELL_STRUCTURE_TEXT[id]?.name || "";
  const textX = side === "left" ? 52 : 448;
  const lineX = side === "left" ? 55 : 445;
  return `<g class="cell-label" data-organelle="${id}" aria-hidden="true">
    <path class="cell-label-line" d="M${lineX} ${ly - 4}L${ax} ${ay}"/>
    <text x="${textX}" y="${ly}" text-anchor="${side === "left" ? "end" : "start"}">${name}</text></g>`;
}

function buildCellLayers(type = "plant", level = "senior") {
  const lvl = normalizeCellLevel(level);
  const layout = CELL_LAYOUTS[type] || CELL_LAYOUTS.plant;
  const available = new Set(CELL_STRUCTURE_SETS[type][lvl]);
  const layers = { slab: "", base: "", mid: "", top: "" };
  const add = (id, layer, markup) => {
    if (available.has(id)) layers[layer] += cellOrganelleGroup(id, markup);
  };

  if (type === "plant") {
    const shape = CELL_SHAPES.plant;
    layers.slab = `<path class="cell-slab plant" d="${shape.wall}"/>`;
    add("cellWall", "base", `<path class="wall-body" d="${shape.wall}"/><path class="wall-texture" d="${shape.wall}"/>`);
    add("cytoplasm", "base", `<path class="cyto-body plant" d="${shape.membrane}"/>`);
    add("cellMembrane", "base", `<path class="cell-hit-stroke" d="${shape.membrane}" style="stroke-width:9"/><path class="membrane-line plant" d="${shape.membrane}"/>`);
    add("vacuole", "mid", `<path class="vacuole-body" d="${shape.vacuole}"/><path class="vacuole-shine" d="M206 86 C250 74 318 74 356 84"/>`);
    add("nucleus", "mid", cellNucleus(layout.nucleus, lvl));
    add("endoplasmicReticulum", "mid", cellRoughEr(layout.nucleus, layout.erArcs));
    add("golgi", "mid", cellGolgi(layout.golgi));
    add("chloroplast", "top", layout.chloroplasts.map(([x, y, r]) => cellChloroplast(x, y, r, lvl)).join(""));
    add("mitochondrion", "top", layout.mitochondria.map(([x, y, r]) => cellMitochondrion(x, y, r)).join(""));
    add("ribosome", "top", cellFreeRibosomes(layout.ribosomes));
  } else {
    const shape = CELL_SHAPES.animal;
    layers.slab = `<path class="cell-slab animal" d="${shape.membrane}"/>`;
    add("cytoplasm", "base", `<path class="cyto-body animal" d="${shape.membrane}"/>`);
    add("cellMembrane", "base", `<path class="cell-hit-stroke" d="${shape.membrane}" style="stroke-width:10"/><path class="membrane-line animal" d="${shape.membrane}"/>`);
    add("nucleus", "mid", cellNucleus(layout.nucleus, lvl));
    add("endoplasmicReticulum", "mid", cellRoughEr(layout.nucleus, layout.erArcs, `<path class="er-smooth" d="${layout.smoothEr}"/><path class="er-smooth-lumen" d="${layout.smoothEr}"/>`));
    add("golgi", "mid", cellGolgi(layout.golgi));
    add("mitochondrion", "top", layout.mitochondria.map(([x, y, r]) => cellMitochondrion(x, y, r)).join(""));
    add("ribosome", "top", cellFreeRibosomes(layout.ribosomes));
    add("lysosome", "top", layout.lysosomes.map(([x, y, r]) => cellLysosome(x, y, r)).join(""));
    add("centrosome", "top", cellCentrosome(layout.centrosome));
  }

  (layout.labels[lvl] || []).forEach(label => {
    if (!available.has(label[0])) return;
    const layer = CELL_STRUCTURE_LAYER[label[0]] || "top";
    layers[layer] += cellLabelMarkup(label);
  });
  return layers;
}

function renderCellModelMarkup(type = state.cellType, level = state.cellLevel) {
  const model = elements.plantCellModel;
  if (!model) return;
  const key = `${type}:${normalizeCellLevel(level)}`;
  if (model.dataset.rendered === key) return;
  const layers = buildCellLayers(type, level);
  const svg = (name, body) => `<svg class="cell-layer layer-${name}" viewBox="0 0 500 300" aria-hidden="${name === "slab"}" focusable="false">${body}</svg>`;
  model.innerHTML = `
    <svg class="cell-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
      <filter id="cellActiveGlow" x="-40%" y="-40%" width="180%" height="180%">
        <feMorphology in="SourceAlpha" operator="dilate" radius="1.6" result="grow"/>
        <feFlood flood-color="#2f6fd6" flood-opacity="0.9"/><feComposite in2="grow" operator="in" result="ring"/>
        <feGaussianBlur in="ring" stdDeviation="1.4" result="soft"/>
        <feMerge><feMergeNode in="soft"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs></svg>
    ${svg("slab", layers.slab)}${svg("base", layers.base)}${svg("mid", layers.mid)}${svg("top", layers.top)}`;
  model.dataset.rendered = key;
}

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
  cellLabelButton: $("#cellLabelButton"),
  mathGraph: $("#mathGraph"),
  cellSourceNote: $("#cellSourceNote"),
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
  generationTitle: $("#generationTitle"),
  generationKicker: $("#generationKicker"),
  generationQuestion: $("#generationQuestion"),
  generationSteps: $("#generationSteps"),
  generationStepsHighlight: $(".gen-steps-highlight"),
  demoStepIndicator: $("#demoStepIndicator")
};

renderCellModelMarkup(state.cellType, state.cellLevel);

if (elements.mathGraph && "ResizeObserver" in window) {
  new ResizeObserver(() => {
    if (state.subject === "数学" && Number.isFinite(state.mathGraphX)) renderMathGraph(currentMathModel(), state.mathGraphX);
  }).observe(elements.mathGraph);
}

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
    cellLevel: state.cellLevel,
    mathModelSpec: state.mathModel?.spec || null,
    projectileGravity: state.projectileGravity,
    extraFixed: JSON.parse(JSON.stringify(state.extraFixed || {})),
    circuitSolve: state.circuitSolve ? { ...state.circuitSolve } : null,
    brakeAsk: state.brakeAsk ? { ...state.brakeAsk } : null,
    projectileAsk: state.projectileAsk ? { ...state.projectileAsk } : null,
    chemGiven: state.chemGiven ? { ...state.chemGiven } : null,
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
    state.projectileGravity = snapshot.projectileGravity ?? PROJECTILE_LIMITS.gravity;
    state.extraFixed = snapshot.extraFixed ? JSON.parse(JSON.stringify(snapshot.extraFixed)) : {};
    state.circuitSolve = snapshot.circuitSolve || null;
    state.brakeAsk = snapshot.brakeAsk || null;
    state.projectileAsk = snapshot.projectileAsk || null;
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
    state.cellLevel = normalizeCellLevel(snapshot.cellLevel || state.cellLevel);
    state.selectedOrganelle = snapshot.selectedOrganelle || "nucleus";
    syncBiologyContent(state.cellType);
    setCellRotation(snapshot.cellRotateX ?? -4, snapshot.cellRotateY ?? -10);
  }
  if (subject === "化学") {
    state.chemGiven = snapshot.chemGiven || null;
  }
  if (subject === "数学") {
    state.mathModel = createMathModel(snapshot.mathModelSpec || defaultMathSpec());
    syncMathContent(state.p1, state.mathModel);
  }
  return true;
}

// 能用 maxPlaces 位以内小数精确写出的数返回小数位数（31.25 → 2），除不尽的返回 null
function exactPlaces(value, maxPlaces = 4) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  for (let places = 0; places <= maxPlaces; places += 1) {
    if (Math.abs(number - Number(number.toFixed(places))) <= 1e-9 * Math.max(1, Math.abs(number))) return places;
  }
  return null;
}

// 结果被近似时写“≈ / 约”，能精确写出时写“=”
function eqSign(value, maxPlaces = 4) {
  return exactPlaces(value, maxPlaces) === null ? "≈" : "=";
}

function aboutText(value, maxPlaces = 4) {
  return exactPlaces(value, maxPlaces) === null ? "约 " : "";
}

// 显示数值：能精确写出的（≤3 位小数，如 31.25、0.125）不四舍五入；除不尽的保留 decimals 位
function smartNumber(value, decimals = 1) {
  const number = Number(value);
  const places = exactPlaces(number, 4);
  const digits = places !== null && places > decimals ? places : decimals;
  const rounded = Number(number.toFixed(digits));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(digits);
}

function plainNumber(value, decimals = 2) {
  return String(Number(smartNumber(value, decimals)));
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

// 距离 → 路面位置（占路面宽度的百分比）。车头、停止线和刻度尺都用这一换算，读数才能一一对应。
// 0 m 对应车头起点：窄屏上车身较宽，起点随之右移，保证整辆车在路面内。
function physicsDistanceLeftPercent(distance, visualMax) {
  const roadWidth = physicsRoadWidth();
  const start = clamp(8 + (carNoseOffsetPx() / roadWidth) * 100, 16, 50);
  const end = 86;
  const cappedDistance = Math.max(0, Math.min(visualMax, distance));
  return start + (cappedDistance / visualMax) * (end - start);
}

function physicsStopLeftPercent(stopDistance = physicsBrakeModel().stopDistance) {
  return physicsDistanceLeftPercent(stopDistance, physicsVisualDistanceMax(stopDistance));
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
  // 刻度位置与车头、停止线同一换算（路面近边缘处），不再在整条路上平均分布
  const ratios = [0, 0.25, 0.5, 0.75, 1];
  const lefts = ratios.map(ratio => physicsDistanceLeftPercent(visualMax * ratio, visualMax));
  elements.ruler.innerHTML = ratios.map((ratio, index) => {
    return `<span${index === 4 ? ' class="ruler-last"' : ""} style="left:${lefts[index].toFixed(3)}%">${smartNumber(visualMax * ratio)}</span>`;
  }).join("");
  // 路面上同步画出对应的距离线：它们与小车同在透视路面上，小车在远处车道时也能对齐读数
  const road = elements.car?.parentElement;
  if (road) {
    let marks = road.querySelector(".road-distance-marks");
    if (!marks) {
      marks = document.createElement("div");
      marks.className = "road-distance-marks";
      marks.setAttribute("aria-hidden", "true");
      road.insertBefore(marks, road.firstChild);
    }
    marks.innerHTML = lefts.map(left => `<i style="left:${left.toFixed(3)}%"></i>`).join("");
  }
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

function buildPhysicsBrakeContentBase(v0 = state.p1, parameter = state.p2, options = {}) {
  const model = physicsBrakeModel(v0, parameter, options);
  const vText = smartNumber(model.v0);
  const aText = smartNumber(model.aAbs);
  const tText = smartNumber(model.duration, 2);
  const sText = smartNumber(model.stopDistance);
  // 停止距离除不尽时写“≈ / 约”，能精确写出时写“=”
  const sEq = eqSign(model.stopDistance);
  const sAbout = aboutText(model.stopDistance);
  const challengeSpeed = smartNumber(nextPhysicsChallengeSpeed(model.v0));

  if (model.mode === "friction") {
    const muText = smartNumber(model.mu, 2);
    const gText = smartNumber(model.gravity);
    const frictionAText = plainNumber(model.aAbs, 2);
    const aEq = eqSign(model.aAbs);
    const nextMu = frictionChallengeMu(model.mu);
    return {
      title: "摩擦制动：路面摩擦如何决定刹车距离",
      description: `按水平路面、车轮滑动且摩擦力为主要制动力建模：μ = ${muText}，减速度 μg ${aEq} ${frictionAText}m/s²，停止距离 ${sAbout}${sText}m。`,
      engine: "摩擦制动典型题模板",
      ar: "网页端展示滑动摩擦、减速度与停止距离的定量关系。",
      params: [
        { label: "初速度 v₀", desc: "调整车辆开始制动时的速度", unit: "m/s", min: PHYSICS_BRAKE_LIMITS.speedMin, max: PHYSICS_BRAKE_LIMITS.speedMax, step: 1, value: model.v0 },
        { label: "动摩擦因数 μ", desc: "水平路面且车轮发生滑动", unit: "", min: PHYSICS_FRICTION_BRAKE_LIMITS.muMin, max: PHYSICS_FRICTION_BRAKE_LIMITS.muMax, step: 0.05, value: model.mu }
      ],
      steps: [
        ["提取条件", `v₀ = ${vText}m/s，μ = ${muText}，g 取 ${gText}m/s²`, "明确水平路面、滑动摩擦为主要制动力。"],
        ["受力求加速度", `f = μF压 = μmg，a = −f/m = −μg ${aEq} −${frictionAText}m/s²`, "质量在求加速度时约去，减速度由 μ 和 g 决定。"],
        ["代入运动学", `0² − ${vText}² = 2×(−${frictionAText})×x`, `计算得到停止距离 x ${sEq} ${sText}m。`],
        ["现象验证", `速度归零，停止点 ${sAbout}${sText}m`, "路面越粗糙，μ 越大，停止距离越短。"]
      ],
      mentor: `为什么汽车质量没有出现在最终刹车距离中？因为 <strong>f = μmg</strong>，再由 <strong>a = f/m</strong> 得到 <strong>a = μg</strong>。`,
      hint: "先画水平路面受力图：竖直方向 N = mg，水平方向只有与运动方向相反的滑动摩擦力。",
      challenge: `如果动摩擦因数${nextMu > model.mu ? "增大" : "减小"}到 <strong>${smartNumber(nextMu, 2)}</strong>，停止距离会怎样变化？`,
      generationStages: [
        { label: "识别条件", text: `识别 v₀ = ${vText}m/s，μ = ${muText}，g 取 ${gText}m/s²`, progress: 28 },
        { label: "建立受力模型", text: `由 f = μF压 与 F = ma 得 a ${aEq} −${frictionAText}m/s²`, progress: 63 },
        { label: "生成制动过程", text: `速度匀减至 0，停止点锁定 ${sAbout}${sText}m`, progress: 100 }
      ],
      recognitionText: `摩擦制动｜v₀ = ${vText}m/s｜μ = ${muText}｜g 取 ${gText}m/s²｜a ${aEq} −${frictionAText}m/s²｜停止距离 ${sAbout}${sText}m`,
      formulaLabel: "摩擦制动",
      formula: "f = μF压，a = −μg",
      formulaHtml: `F压 = mg，f = μF压 = μmg<br>a = −f/m = −μg ${aEq} −${frictionAText}m/s²<br>x = v₀²/(2μg) ${sEq} ${sText}m`,
      sceneTip: `水平路面上按滑动摩擦制动建模：μ = ${muText}，速度每秒${aEq === "≈" ? "约" : ""}减少 ${frictionAText}m/s。`,
      indicatorLabel: "滑动摩擦制动",
      indicatorFormula: `a = −μg ${aEq} −${frictionAText}m/s²`,
      stopTimeText: tText,
      stopDistanceText: sText,
      model
    };
  }

  if (model.mode === "linear_drag") {
    const kText = smartNumber(model.k);
    const massText = smartNumber(model.mass);
    const tauText = smartNumber(model.tau, 2);
    const tauEq = eqSign(model.tau);
    const practicalSpeedText = smartNumber(model.practicalSpeed, 2);
    const practicalDistanceText = smartNumber(model.practicalDistance, 1);
    const kBounds = linearDragKBounds(model.mass);
    const nextK = linearDragChallengeK(model.k, model.mass);
    return {
      title: "线性阻力制动：f = kv 时速度如何衰减",
      description: `高中拓展模型：阻力大小 f = kv、方向与速度相反。速度按指数规律衰减，极限位移${sAbout ? "约为" : "为"} ${sText}m。`,
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
        ["判断极限", `τ = m/k ${tauEq} ${tauText}s，x∞ = mv₀/k ${sEq} ${sText}m`, `动画在 v = 1%v₀ 时结束：t ${eqSign(model.duration)} ${tText}s，x ${eqSign(model.practicalDistance)} ${practicalDistanceText}m。`]
      ],
      mentor: "为什么这里不能使用匀变速公式？因为 <strong>f = kv</strong> 随速度减小，因而加速度 <strong>a = −kv/m</strong> 也不断变化。",
      hint: "先由牛顿第二定律写出 m·dv/dt = −kv，再分离变量求解指数函数。",
      challenge: `如果 k ${nextK > model.k ? "增大" : "减小"}到 <strong>${smartNumber(nextK)}kg/s</strong>，时间常数和极限位移会怎样变化？`,
      generationStages: [
        { label: "识别条件", text: `识别 v₀、m 与线性阻力系数 k = ${kText}kg/s`, progress: 28 },
        { label: "建立变力模型", text: "建立 m·dv/dt = −kv，求指数衰减解", progress: 63 },
        { label: "生成衰减过程", text: `演示至 v = 1%v₀；极限位置 ${sAbout}${sText}m`, progress: 100 }
      ],
      recognitionText: `高中拓展｜线性阻力 f = kv｜v₀ = ${vText}m/s｜m = ${massText}kg｜k = ${kText}kg/s｜τ ${tauEq} ${tauText}s｜极限位移 ${sAbout}${sText}m`,
      formulaLabel: "线性阻力",
      formula: "m dv/dt = −kv",
      formulaHtml: `v(t) = v₀e<sup>−kt/m</sup><br>x(t) = mv₀/k(1−e<sup>−kt/m</sup>)<br>x∞ = mv₀/k ${sEq} ${sText}m`,
      sceneTip: `线性阻力适用于题设模型或低速黏性介质近似；动画终点为 v = ${practicalSpeedText}m/s（初速度的 1%），理论速度只会渐近于 0。`,
      indicatorLabel: "线性阻力模型",
      indicatorFormula: `f = −kv｜τ ${tauEq} ${tauText}s`,
      stopTimeText: tText,
      stopDistanceText: sText,
      model
    };
  }

  return {
    title: "刹车距离实验 · 速度如何归零",
    description: `从题目生成刹车实验：速度从 ${vText}m/s 逐步归零，停止点对应 ${sAbout}${sText}m。`,
    engine: "运动过程可视化",
    ar: "移动端扩展可继续展示汽车刹车实验。",
    params: [
      { label: "初速度 v₀", desc: "调整车辆起始速度", unit: "m/s", min: PHYSICS_BRAKE_LIMITS.speedMin, max: PHYSICS_BRAKE_LIMITS.speedMax, step: 1, value: model.v0 },
      { label: "加速度 a", desc: "调整刹车减速度", unit: "m/s²", min: PHYSICS_BRAKE_LIMITS.accelMin, max: PHYSICS_BRAKE_LIMITS.accelMax, step: 1, value: model.aAbs, prefix: "−" }
    ],
    steps: [
      ["题干条件", `v₀ = ${vText}m/s，a = −${aText}m/s²，v = 0`, "先识别初速度、刹车加速度和末速度。"],
      ["选择公式", "v² − v₀² = 2ax", "题目没有给出时间，所以选择不含 t 的速度位移公式。"],
      ["代入求解", `0² − ${vText}² = 2×(−${aText})×x`, `计算得到刹车距离 x ${sEq} ${sText}m。`],
      ["现象验证", `速度归零，停止点 ${sAbout}${sText}m`, "结果与实验停止点一致。"]
    ],
    mentor: `为什么这里选 <strong>v² − v₀² = 2ax</strong>？因为题目没有给时间，却给了初速度 ${vText}m/s、末速度 0 和加速度 −${aText}m/s²。`,
    hint: "小提示：题目给出了初速度、末速度和加速度，但没有给时间。哪条公式不含 t？",
    challenge: `如果初速度变为 <strong>${challengeSpeed}m/s</strong>，刹车距离会怎样变化？`,
    generationStages: [
      { label: "识别条件", text: `识别题干条件：v₀ = ${vText}m/s，a = −${aText}m/s²`, progress: 28 },
      { label: "匹配模板", text: "匹配刹车实验模板：速度递减至 0", progress: 63 },
      { label: "锁定停止点", text: `生成可视化过程：停止点锁定 ${sAbout}${sText}m`, progress: 100 }
    ],
    recognitionText: `初速度 ${vText}m/s｜刹车加速度 ${aText}m/s²｜停止距离 ${sAbout}${sText}m`,
    formulaLabel: "核心公式",
    formula: "v² − v₀² = 2ax",
    formulaHtml: `0² − ${vText}² = 2 × (−${aText}) × x，得到 x ${sEq} ${sText}m`,
    sceneTip: `刹车开始后，速度每秒减少 ${aText}m/s。`,
    indicatorLabel: "恒定减速度",
    indicatorFormula: `a = −${aText}m/s²`,
    stopTimeText: tText,
    stopDistanceText: sText,
    model
  };
}

// 题目问的量只在参数仍与原题一致时采用；拖动滑块后按“求刹车距离”展示
function brakeAskFor(model, ask = state.brakeAsk) {
  const fallback = { time: false, distance: true };
  if (!ask || ask.mode !== model.mode) return fallback;
  const parameter = model.mode === "friction" ? model.mu : model.mode === "linear_drag" ? model.k : model.aAbs;
  return Math.abs(ask.v0 - model.v0) < 1e-9 && Math.abs(ask.parameter - parameter) < 1e-9 ? ask : fallback;
}

// 题目问刹车时间（或时间和距离）时，公式卡、步骤和识别结果都以所问的量为准
function buildPhysicsBrakeContent(v0 = state.p1, parameter = state.p2, options = {}) {
  const content = buildPhysicsBrakeContentBase(v0, parameter, options);
  const model = content.model;
  if (model.mode === "linear_drag") return content;
  const ask = options.ask || brakeAskFor(model);
  if (!ask.time) return content;
  const both = Boolean(ask.distance);
  const friction = model.mode === "friction";
  const vText = smartNumber(model.v0);
  const aText = friction ? plainNumber(model.aAbs, 2) : smartNumber(model.aAbs);
  const tText = smartNumber(model.duration, 2);
  const sText = content.stopDistanceText;
  const tEq = eqSign(model.duration);
  const sEq = eqSign(model.stopDistance);
  const tAbout = aboutText(model.duration);
  const sAbout = aboutText(model.stopDistance);
  const timeSolve = `${friction ? "t = v₀/(μg)" : "t = v₀/a"} ${tEq} ${tText}s`;
  const distanceSolve = `${friction ? "x = v₀²/(2μg)" : "x = v₀²/(2a)"} ${sEq} ${sText}m`;
  const steps = content.steps.map(step => [...step]);
  if (friction) {
    steps[2] = ["代入运动学", both ? `${timeSolve}；${distanceSolve}` : `0 = ${vText} − ${aText}t`,
      both ? "分别由速度公式和速度位移公式求出刹车时间和刹车距离。" : `计算得到刹车时间 ${timeSolve}。`];
  } else {
    steps[1] = ["选择公式", both ? "v = v₀ + at；v² − v₀² = 2ax" : "v = v₀ + at",
      both ? "求时间用速度公式，求距离用不含 t 的速度位移公式。" : "题目问刹车时间，选择含 t 的速度公式。"];
    steps[2] = ["代入求解", both ? `${timeSolve}；${distanceSolve}` : `0 = ${vText} + (−${aText})t`,
      both ? "分别求出刹车时间和刹车距离。" : `计算得到刹车时间 ${timeSolve}。`];
  }
  steps[3] = ["现象验证", `速度归零用时 ${tAbout}${tText}s，停止点 ${sAbout}${sText}m`, "结果与实验的停止时刻和停止点一致。"];
  const answer = both ? `刹车时间 ${tAbout}${tText}s，停止距离 ${sAbout}${sText}m` : `刹车时间 ${tAbout}${tText}s`;
  return {
    ...content,
    steps,
    formula: friction ? content.formula : both ? "v = v₀ + at，v² − v₀² = 2ax" : "v = v₀ + at",
    recognitionText: content.recognitionText.replace(/｜停止距离 [^｜]*$/, `｜${answer}`),
    formulaHtml: friction
      ? content.formulaHtml.replace(/<br>x = v₀²\/\(2μg\)[^<]*$/, `<br>${both ? `${timeSolve}<br>${distanceSolve}` : timeSolve}`)
      : both
        ? `0 = ${vText} + (−${aText}) × t，得到 t ${tEq} ${tText}s<br>0² − ${vText}² = 2 × (−${aText}) × x，得到 x ${sEq} ${sText}m`
        : `0 = ${vText} + (−${aText}) × t，得到 t ${tEq} ${tText}s`,
    mentor: friction ? content.mentor : both
      ? "为什么这里用两条公式？题目同时问时间和距离：求时间用 <strong>v = v₀ + at</strong>，求距离用不含 t 的 <strong>v² − v₀² = 2ax</strong>。"
      : `为什么这里选 <strong>v = v₀ + at</strong>？因为题目问的是刹车时间，已知初速度 ${vText}m/s、末速度 0 和加速度 −${aText}m/s²。`,
    hint: friction ? content.hint : "小提示：末速度为 0，把 v₀ 和 a 代入 v = v₀ + at 就能解出 t。"
  };
}

function buildPhysicsBrakeQuestionText(v0 = state.p1, parameter = state.p2, options = {}) {
  const model = physicsBrakeModel(v0, parameter, options);
  if (model.mode === "friction") {
    return `一辆汽车以 ${exactNumber(v0)}m/s 的速度在水平路面行驶，紧急刹车后车轮发生滑动，轮胎与路面的动摩擦因数为 ${exactNumber(model.mu)}，取 g = ${exactNumber(model.gravity)}m/s²。求刹车距离。`;
  }
  if (model.mode === "linear_drag") {
    return `质量为 ${exactNumber(model.mass)}kg 的小车以 ${exactNumber(v0)}m/s 行驶，随后只受大小满足 f = kv、方向与速度相反的阻力，k = ${exactNumber(model.k)}kg/s。求速度随时间的关系和极限位移。`;
  }
  return `一辆汽车以 ${exactNumber(v0)}m/s 的速度行驶，紧急刹车后加速度大小为 ${exactNumber(model.aAbs)}m/s²，求刹车距离。`;
}

function boardSliderNumber(value, decimals = 3) {
  const places = exactPlaces(value, 4);
  return String(Number(Number(value).toFixed(places !== null && places > decimals ? places : decimals)));
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
    ? `滑块先与木板达到共同速度，最大相对位移${eqSign(relativeStopDistance, 4) === "≈" ? "约为" : "为"} ${boardSliderNumber(relativeStopDistance)}m，小于木板长度；随后二者共同匀速运动。`
    : outcome === "critical"
      ? "临界：滑块恰好到达木板右端时与木板相对静止。"
      : `最大相对位移${eqSign(relativeStopDistance, 4) === "≈" ? "约为" : "为"} ${boardSliderNumber(relativeStopDistance)}m，大于木板长度，滑块${eqSign(exitTime, 4) === "≈" ? "约在" : "在"} ${boardSliderNumber(exitTime)}s 时从右端滑出。`;
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
  const relation = `${eqSign(model.relativeStopDistance, 4) === "≈" ? "≈" : ""}${sRel}m ${model.relationSymbol} ${L}m`;
  const timeNote = model.outcome === "fall"
    ? `（${aboutText(model.exitTime, 4) ? "约" : ""}${boardSliderNumber(model.exitTime)}s 时滑出）`
    : model.outcome === "critical"
      ? `（${aboutText(model.syncTime, 4) ? "约" : ""}${tSync}s 时恰好到达右端）`
      : `（${aboutText(model.syncTime, 4) ? "约" : ""}${tSync}s 后共速）`;
  // 除不尽的结果写“≈”
  const fEq = eqSign(model.friction, 4);
  const aAEq = eqSign(Math.abs(model.blockAcceleration), 4);
  const aBEq = eqSign(model.boardAcceleration, 4);
  const aRelEq = eqSign(model.relativeDeceleration, 4);
  const sRelEq = eqSign(model.relativeStopDistance, 4);
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
      ["提取条件", `m = ${m}kg，M = ${M}kg，L = ${L}m，v₀ = ${v0}m/s，μ = ${mu}，g 取 ${g}m/s²`, "光滑水平地面：木板只受滑块对它的摩擦力。"],
      ["受力与加速度", `f = μmg ${fEq} ${f}N；${blockAccelerationSymbol} = −μg ${aAEq} −${aA}m/s²；${boardAccelerationSymbol} = ${boardAccelerationFormula} ${aBEq} ${aB}m/s²`, "滑块受摩擦力向左减速，木板受摩擦力向右加速；两个摩擦力大小相等、方向相反，二者加速度大小不一定相同。"],
      ["转化为相对运动", `相对加速度大小 ${relativeAccelerationSymbol} = μg(1 + ${massRatioFormula}) ${aRelEq} ${aRel}m/s²；最大相对位移 ${relativeDisplacementSymbol} = ${relativeDistanceFormula} ${sRelEq} ${sRel}m`, model.outcome === "fall"
        ? `若木板足够长，需${aboutText(model.syncTime, 4) ? "约" : ""} ${tSync}s 才能共速；实际上滑块在此之前已从右端滑出。`
        : `达到共同速度需${aboutText(model.syncTime, 4) ? "约" : ""} ${tSync}s，共同速度${aboutText(model.commonSpeed, 4) ? "约为" : "为"} ${vCommon}m/s。`],
      ["与木板长度比较", `${relation}，结论：${model.outcomeLabel}${timeNote}`, model.conclusion]
    ],
    mentor: "为什么这里不能直接把滑块对地面的位移与木板长度比较？",
    hint: "木板本身也在运动。判断滑块是否滑落，应该观察滑块相对木板移动了多远。",
    challenge: "保持其他条件不变，如果滑块初速度改为 5m/s，它会不会从木板右端滑落？",
    generationStages: [
      { label: "识别双物体", text: `识别滑块m=${m}kg、木板M=${M}kg、长度L=${L}m与μ=${mu}`, progress: 28 },
      { label: "建立相对运动模型", text: `分别求滑块加速度${aAEq === "≈" ? "约 " : ""}−${aA}m/s²、木板加速度${aboutText(model.boardAcceleration, 4)}${aB}m/s²与相对加速度大小${aboutText(model.relativeDeceleration, 4)}${aRel}m/s²`, progress: 63 },
      { label: "判断临界状态", text: `比较最大相对位移 ${aboutText(model.relativeStopDistance, 4)}${sRel}m 与木板长度 ${L}m：${model.outcomeLabel}`, progress: 100 }
    ],
    recognitionText: `${model.recognitionText}｜相对加速度大小${aRelEq}${aRel}m/s²｜最大相对位移${sRelEq}${sRel}m${gravityNote}`,
    formulaLabel: "相对运动判定",
    formula: "比较最大相对位移与 L",
    formulaHtml: `f = μmg ${fEq} ${f}N<br>${blockAccelerationSymbol} = −μg ${aAEq} −${aA}m/s²；${boardAccelerationSymbol} = ${boardAccelerationFormula} ${aBEq} ${aB}m/s²<br>相对加速度大小 ${relativeAccelerationSymbol} = μg(1 + ${massRatioFormula}) ${aRelEq} ${aRel}m/s²<br>最大相对位移 ${relativeDisplacementSymbol} = ${relativeDistanceFormula} ${sRelEq} ${sRel}m<br><b>${relation}｜${model.outcomeLabel}</b>`,
    sceneTip: model.outcome === "critical"
      ? `最大相对位移 ${sRel}m，等于木板长度 ${L}m，当前为临界状态。`
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
  // 窄屏：受力与速度箭头改为紧凑排布，两侧只留箭头所需空间，木板按比例显示，不再被压成细条
  const compact = worldWidth < 520;
  world.classList.toggle("board-slider-compact", compact);
  const blockWidth = elements.boardSliderBlock.offsetWidth || 68;
  const liveCard = world.querySelector(".board-slider-live-card");
  const liveCardWidth = liveCard?.offsetWidth || 0;
  const origin = compact ? 78 : Math.max(blockWidth / 2 + 88, worldWidth * 0.14);
  const rightReserve = compact ? Math.max(blockWidth / 2, 44) + 6 : liveCardWidth + 150;
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
    elements.boardSliderRelation.textContent = `${eqSign(data.relativeStopDistance, 4) === "≈" ? "≈" : ""}${boardSliderNumber(data.relativeStopDistance)}m ${data.relationSymbol} ${boardSliderNumber(data.boardLength)}m`;
  }
  if (elements.boardSliderFrictionText) {
    elements.boardSliderFrictionText.textContent = data.frictionActive ? `f = μmg ${eqSign(data.friction, 4)} ${boardSliderNumber(data.friction)}N` : data.outcome === "fall" ? "接触结束：f = 0" : "共同运动：f = 0";
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
  const changes = [];
  if (model.current < 1 - 1e-9) changes.push("将电流增大到1.0A");
  if (model.turns < 400) changes.push(changes.length ? "线圈匝数增加到400匝" : "将线圈匝数增加到400匝");
  let hypothesis = changes.join("、");
  if (!model.hasCore) hypothesis = hypothesis ? `${hypothesis}，并在线圈中插入铁芯` : "在线圈中插入铁芯";
  const tail = hypothesis ? `若${hypothesis}，磁性将如何变化？` : "";
  return `一个${Math.round(model.turns)}匝的通电螺线管接入${decimalPlaces(model.current) > 2 ? exactNumber(model.current) : formatAmp(model.current)}A电流${model.hasCore ? "，线圈中已插入铁芯" : ""}。从${viewText}观察，线圈中的电流沿${directionText}方向。请判断螺线管左右两端的磁极。${tail}`;
}

function formatAmp(value) {
  const places = exactPlaces(value, 4);
  if (places !== null && places > 2) return String(Number(Number(value).toFixed(places)));
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
      { label: "电流大小 I", desc: "调整电流大小", unit: "A", min: SOLENOID_LIMITS.currentMin, max: SOLENOID_LIMITS.currentMax, step: 0.1, value: model.current },
      { label: "线圈匝数 N", desc: "其他条件与长度基本相同时", unit: "匝", min: SOLENOID_LIMITS.turnsMin, max: SOLENOID_LIMITS.turnsMax, step: 50, value: model.turns }
    ],
    steps: [
      ["提取条件", `从${viewText}观察，电流沿${directionText}方向。`, `电流 I = ${currentText}A，线圈匝数 N = ${turnsText}匝，铁芯：${coreText}。`],
      ["使用安培定则", "右手握住螺线管，四指指向电流的方向", "大拇指所指的那端就是螺线管的 N 极。"],
      ["判断磁极", `${observedText}，另一端相反。`, `所以左端为${model.leftPole}极，右端为${model.rightPole}极。`],
      ["分析磁性", "电流越大、匝数越多、插入铁芯，磁性越强。", "匝数规律需限定在其他条件和线圈长度基本相同时。"]
    ],
    mentor: "为什么反转电流后，电磁铁的 N、S 极会交换，但磁性不一定减弱？",
    hint: "分别考虑“电流方向”和“电流大小”影响的是磁场的哪个属性：方向改变会交换磁极，大小改变才影响强弱。",
    challenge: `将电流由 <strong>${currentText}A</strong> ${solenoidChallengeCurrent(model.current) > model.current ? "增大" : "减小"}到 <strong>${formatAmp(solenoidChallengeCurrent(model.current))}A</strong>，同时反转电流方向（匝数和铁芯不变）。磁极和磁性分别怎样变化？`,
    generationStages: [
      { label: "识别电磁题", text: `识别 ${turnsText}匝、${currentText}A、${viewText}${directionText}`, progress: 28 },
      { label: "生成螺线管", text: "生成3D线圈、电流方向箭头与闭合磁感线", progress: 63 },
      { label: "判断磁极", text: `${viewText}${directionText} → ${observedText}`, progress: 100 }
    ],
    recognitionText: `从${viewText}观察电流为${directionText}｜左端${model.leftPole}极｜右端${model.rightPole}极｜磁性：${model.strengthLevel}`,
    formulaHtml: `观察端：逆时针 → N 极；顺时针 → S 极<br>磁感线闭合：外部 N → S，内部 S → N<br>强弱看电流、匝数、铁芯；不显示伪精确 B 值。`,
    sceneTip: `当前：左端 ${model.leftPole} 极，右端 ${model.rightPole} 极；I=${currentText}A，N=${turnsText}匝，铁芯${coreText}，磁性${model.strengthLevel}。`,
    model
  };
}

// 物质的量：能精确写出的原样显示（0.125、0.0625），除不尽的保留 3 位
function formatMol(value) {
  const places = exactPlaces(value, 4);
  return Number(value).toFixed(places === null ? 3 : Math.max(2, places));
}

// 质量：能精确写出的原样显示（6.4、5.65），除不尽的保留 2 位
function formatGram(value) {
  const places = exactPlaces(value, 3);
  return Number(value).toFixed(places === null ? 2 : Math.max(1, places));
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
  const feText = decimalPlaces(feMass) > 1 ? exactNumber(feMass) : formatGram(feMass);
  const molText = decimalPlaces(cuso4Mol) > 2 ? exactNumber(cuso4Mol) : formatMol(cuso4Mol);
  return `将 ${feText}g 铁粉加入含有 ${molText}mol 硫酸铜的溶液中，充分反应。请计算最多生成多少 mol 铜？生成铜的质量是多少？并判断哪种反应物过量。`;
}

// 题目原来给的是质量还是物质的量：数值未被拖动改变时，条件按原题形式书写
function chemistryGivenForms(feMass, cuso4Mol, given = state.chemGiven) {
  if (!given) return null;
  return Math.abs(given.feMass - feMass) < 1e-9 && Math.abs(given.cuso4Mol - cuso4Mol) < 1e-9 ? given : null;
}

function buildChemistryFeCuSO4Content(feMass = state.p1, cuso4Mol = state.p2, givenForms = state.chemGiven) {
  const model = chemistryFeCuSO4Model(feMass, cuso4Mol);
  const judgement = chemistryReactionJudgement(model);
  const given = chemistryGivenForms(model.feMass, model.cuso4Mol, givenForms);
  const feMassText = formatGram(model.feMass);
  const feMolText = formatMol(model.feMol);
  const cuso4Text = formatMol(model.cuso4Mol);
  const cuMolText = formatMol(model.cuMol);
  const cuMassText = formatGram(model.cuMass);
  const cuso4LeftText = formatMol(model.cuso4Left);
  const feLeftText = formatMol(model.feLeftMol);
  // 除不尽的量写“≈ / 约”，能精确写出的写“=”
  const feEq = eqSign(model.feMol, 4);
  const cuEq = eqSign(model.cuMol, 4);
  const massEq = eqSign(model.cuMass, 3);
  const cuAbout = cuEq === "≈" || massEq === "≈" ? "约 " : "";
  const feInMol = given?.fe === "amount";
  const cuso4InGram = given?.cuso4 === "mass";
  const cuso4GramText = formatGram(model.cuso4Mol * 160);
  const conditionLine = `${feInMol ? `n(Fe) = ${feMolText}mol` : `m(Fe) = ${feMassText}g`}，${cuso4InGram ? `m(CuSO₄) = ${cuso4GramText}g` : `n(CuSO₄) = ${cuso4Text}mol`}`;
  const feMolLine = feInMol ? `n(Fe) = ${feMolText} mol（题目给出）` : `n(Fe) = m/M = ${feMassText} g ÷ 56 g/mol ${feEq} ${feMolText} mol`;
  const cuso4MolLine = cuso4InGram ? `n(CuSO₄) = m/M = ${cuso4GramText} g ÷ 160 g/mol ${eqSign(model.cuso4Mol, 4)} ${cuso4Text} mol` : `n(CuSO₄) = ${cuso4Text} mol`;
  const cuMassLine = cuEq === "=" ? `m(Cu) = n·M = ${cuMolText} mol × 64 g/mol ${massEq} ${cuMassText} g` : `m(Cu) = n·M ${massEq} ${cuMassText} g`;
  const challengeFe = chemistryChallengeFe(model.feMass);
  // 剩余的反应物同时给出物质的量和质量（题目可能问“剩余铁粉的质量”）
  const leftLine = model.feLeftMol > 1e-12
    ? `Fe 剩余 ${aboutText(model.feLeftMol, 4)}${feLeftText}mol（${formatGram(model.feLeftMol * CHEMISTRY_CONSTANTS.feMolarMass)}g）`
    : model.cuso4Left > 1e-12
      ? `CuSO₄ 剩余 ${aboutText(model.cuso4Left, 4)}${cuso4LeftText}mol（${formatGram(model.cuso4Left * 160)}g）`
      : "Fe 与 CuSO₄ 均无剩余";
  const mentor = model.limiting === "Fe"
    ? `为什么不能直接用 <strong>${cuso4Text}mol 硫酸铜</strong> 计算铜的质量？`
    : model.limiting === "CuSO₄"
      ? `为什么这里要用 <strong>${cuso4Text}mol 硫酸铜</strong>，而不是用铁的质量来计算铜的质量？`
      : "铁和硫酸铜恰好完全反应时，用哪一种反应物计算铜的质量结果相同？为什么？";

  return {
    description: `Fe + CuSO₄ = FeSO₄ + Cu；铁表面析出红色铜；消耗蓝色 Cu²⁺ 并生成浅绿色 Fe²⁺，${model.cuso4Left > 1e-12 ? "剩余的 CuSO₄ 使溶液仍呈蓝色" : "CuSO₄ 完全反应后溶液呈浅绿色"}。最多生成 Cu ${cuAbout}${cuMolText}mol / ${cuMassText}g。`,
    params: [
      { label: "铁粉质量 m(Fe)", desc: "调整投入铁粉质量", unit: "g", min: CHEMISTRY_CONSTANTS.feMassMin, max: CHEMISTRY_CONSTANTS.feMassMax, step: 2.8, value: model.feMass },
      { label: "硫酸铜 n(CuSO₄)", desc: "调整硫酸铜物质的量", unit: "mol", min: CHEMISTRY_CONSTANTS.cuso4MolMin, max: CHEMISTRY_CONSTANTS.cuso4MolMax, step: 0.05, value: model.cuso4Mol }
    ],
    steps: [
      ["提取条件", conditionLine, "先识别铁和硫酸铜的已知量。"],
      ["换算物质的量", cuso4InGram ? `${feMolLine}；${cuso4MolLine}` : feMolLine, "把已知量统一换算成物质的量。"],
      ["判断反应物关系", `1:1 反应，${judgement.limitLine}；${leftLine}`, judgement.detail],
      ["现象验证", `n(Cu) ${cuEq} ${cuMolText}mol，m(Cu) ${massEq} ${cuMassText}g`, "铁表面析出红色固体，溶液颜色由蓝色逐渐变为浅绿色。"]
    ],
    mentor,
    hint: `先把铁的量换算成 <strong>${feEq === "≈" ? "约 " : ""}${feMolText}mol</strong>，再根据方程式 1:1 的计量关系与硫酸铜 <strong>${cuso4Text}mol</strong> 比较，较少的一方决定生成铜的量。`,
    challenge: `如果铁粉${challengeFe > model.feMass ? "增加" : "减少"}到 <strong>${formatGram(challengeFe)}g</strong>，而硫酸铜仍为 <strong>${cuso4Text}mol</strong>，生成铜的质量会变吗？为什么？`,
    generationStages: [
      { label: "识别条件", text: `识别 ${conditionLine}`, progress: 28 },
      { label: "判断关系", text: `按 1:1 比较，${judgement.short}`, progress: 63 },
      { label: "生成结果", text: `生成 Cu ${cuAbout}${cuMolText}mol / ${cuMassText}g`, progress: 100 }
    ],
    recognitionText: `${conditionLine.replace(/^m\(Fe\)/, "Fe").replace(/^n\(Fe\)/, "Fe").replace(/，[mn]\(CuSO₄\)/, "｜CuSO₄")}｜反应判断：${judgement.short}｜生成 Cu ${cuEq === "≈" || massEq === "≈" ? "≈" : "="} ${cuMolText}mol / ${cuMassText}g`,
    formulaHtml: `${feMolLine}<br>${cuso4MolLine}<br>Fe 与 CuSO₄ 按 1∶1 反应，${judgement.short}，n(Cu) ${cuEq} ${cuMolText} mol<br>${cuMassLine}`,
    sceneTip: `铁粉与溶液接触后表面析铜；颜色为定性示意，CuSO₄ 过量时仍有蓝色。理论最多生成 Cu ${cuAbout}${cuMolText}mol / ${cuMassText}g；${leftLine}。`,
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
  const places = exactPlaces(value, 4);
  const digits = places !== null && places > decimals ? places : decimals;
  const rounded = Number(Number(value).toFixed(digits));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(digits);
}

// Textbook style: "−0.5x² + 2x + 3" (minus sign, spaced binary operators, no trailing zeros).
function formatCoefficient(value) {
  // 系数按题目原样显示（0.125 不能写成 0.13）
  return String(Number(Number(value).toFixed(exactPlaces(value, 4) ?? 4)));
}

function formatSignedTerm(value, body, isFirst = false) {
  if (!value) return "";
  const sign = value < 0 ? (isFirst ? "−" : "− ") : isFirst ? "" : "+ ";
  const abs = Math.abs(value);
  const coeff = abs === 1 && body ? "" : formatCoefficient(abs);
  return `${sign}${coeff}${body}`;
}

function formatPolynomialSpec(spec) {
  const terms = [
    formatSignedTerm(spec.a, "x²", true),
    formatSignedTerm(spec.b, "x", !spec.a),
    formatSignedTerm(spec.c, "", !spec.a && !spec.b)
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
  if (/^ln\(x\)$/.test(normalized)) return createMathModel({ kind: "ln" });
  if (/^sin\(x\)$/.test(normalized)) return createMathModel({ kind: "sin" });
  if (/^cos\(x\)$/.test(normalized)) return createMathModel({ kind: "cos" });
  if (/^(e\^x|exp\(x\))$/.test(normalized)) return createMathModel({ kind: "exp" });
  if (/^sqrt\(x\)$/.test(normalized)) return createMathModel({ kind: "sqrt" });
  const polynomial = parsePolynomialExpression(normalized);
  return polynomial ? createMathModel(polynomial) : null;
}

function matchMathExpression(text) {
  const raw = String(text || "").replace(/[；;。]/g, "，");
  const match = raw.match(/(?:y|f\s*\(\s*x\s*\))\s*(?:=|＝|为|是)\s*([^，,]+?)(?=\s*(?:在|上|运动|，|,|当|求|处|时|的|点|图像|$))/i);
  return match ? { raw: match[0], expression: match[1].trim() } : null;
}

function extractMathExpression(text) {
  return matchMathExpression(text)?.expression || "";
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
  state.p1 = Number(Number(safeX).toFixed(6));
  const y = model.value(state.p1);
  const slope = model.derivative(state.p1);
  const xText = formatMathNumber(state.p1);
  const yText = formatMathNumber(y);
  const slopeText = formatMathNumber(slope);
  const math = SUBJECTS["数学"];
  math.question = buildMathQuestionText(state.p1, model);
  const yEq = eqSign(y, 4);
  const kEq = eqSign(slope, 4);
  math.title = model.spec.kind === "polynomial" && model.spec.a ? "抛物线上的动点与切线" : "函数图像上的动点与切线";
  math.description = `函数 y = ${model.expression}，导数 y′ = ${model.derivativeText}；当 x = ${xText} 时，切线斜率 k ${kEq} ${slopeText}。`;
  math.params[0] = { label: "自变量 x", desc: `拖动观察 y = ${model.expression}`, unit: "", min: model.domainMin, max: model.domainMax, step: model.step, value: state.p1 };
  math.params[1] = { label: "缩放倍率", desc: "保持图像清晰展示", unit: "x", min: 1, max: 1, step: 1, value: 1 };
  math.steps = [
    ["提取函数", `y = ${model.expression}，x = ${xText}`, "识别函数表达式和题目给定位置。"],
    ["求导", `y′ = ${model.derivativeText}`, "导函数在给定点的值表示该点处切线斜率。"],
    ["代入坐标", `x = ${xText}，k ${kEq} ${slopeText}`, `函数值 y ${yEq} ${yText}，切线斜率 k ${kEq} ${slopeText}。`],
    ["观察变化", "拖动 x，图像与切线同步更新", "通过动点观察切线斜率随横坐标改变而变化。"]
  ];
  math.mentor = `为什么函数 y = ${model.expression} 在 x = ${xText} 处的切线斜率${kEq === "≈" ? "约为" : "等于"} <strong>${slopeText}</strong>？`;
  math.hint = `先求导得到 y′ = ${model.derivativeText}，再把 x = ${xText} 代入；导函数值就是该点切线斜率。`;
  math.challenge = `如果 <strong>x = ${formatMathNumber(model.challengeX)}</strong>，切线斜率是多少？`;
  math.recognitionText = `函数 y = ${model.expression}｜导数 y′ = ${model.derivativeText}｜x = ${xText}｜y ${yEq} ${yText}｜切线斜率 k ${kEq} ${slopeText}`;
}

function normalizeBiologyCellType(text = "") {
  return /动物|animal/i.test(text) ? "animal" : "plant";
}

// 人教版：七年级上册只要求光学显微镜下的基本结构；亚显微结构（内质网、高尔基体等）属于必修1。
function normalizeBiologyCellLevel(text = "", fallback = "junior") {
  const source = String(text || "");
  // “电子显微镜下观察”含有“显微镜下观察”：先判断亚显微结构的说法
  if (/亚显微|电子显微镜|电镜|内质网|高尔基体|核糖体|溶酶体|中心体/.test(source)) return "senior";
  if (/初中|七年级|光学显微镜|显微镜下观察/.test(source)) return "junior";
  if (/高中|必修|细胞器|核膜|核孔|核仁|染色质/.test(source)) return "senior";
  return normalizeCellLevel(fallback);
}

function currentCellOrganelles(type = state.cellType, level = state.cellLevel) {
  return cellStructureList(type, level);
}

function currentCellOrganelleMap(type = state.cellType, level = state.cellLevel) {
  return new Map(currentCellOrganelles(type, level).map(item => [item.id, item]));
}

function defaultOrganelleForCellType(type = state.cellType) {
  return type === "animal" ? "cellMembrane" : "nucleus";
}

function cellStructureNames(type = state.cellType, level = state.cellLevel) {
  return currentCellOrganelles(type, level).map(item => item.name).join("、");
}

function buildBiologyQuestionText(type = state.cellType, level = state.cellLevel) {
  const label = CELL_TYPE_LABELS[type] || CELL_TYPE_LABELS.plant;
  if (normalizeCellLevel(level) === "junior") {
    return `请观察${label}结构示意图，识别${cellStructureNames(type, "junior")}，并说明它们的主要功能。`;
  }
  return `请观察${label}的亚显微结构模式图，识别${cellStructureNames(type, "senior")}等结构，并说明它们的主要功能。`;
}

function biologyRecognitionText(type = state.cellType, level = state.cellLevel) {
  const label = CELL_TYPE_LABELS[type] || CELL_TYPE_LABELS.plant;
  const lvl = normalizeCellLevel(level);
  return `${label}结构识别题｜${CELL_LEVEL_LABELS[lvl]}（${CELL_LEVEL_SOURCES[lvl]}）｜可点击结构：${cellStructureNames(type, lvl)}`;
}

function selectedOrganelle() {
  const map = currentCellOrganelleMap();
  return map.get(state.selectedOrganelle) || map.get(defaultOrganelleForCellType()) || CELL_ORGANELLE_MAP.get("nucleus");
}

function buildBiologyContent(type = state.cellType, level = state.cellLevel) {
  const lvl = normalizeCellLevel(level);
  const label = CELL_TYPE_LABELS[type] || CELL_TYPE_LABELS.plant;
  const structures = cellStructureNames(type, lvl);
  const count = currentCellOrganelles(type, lvl).length;
  const levelName = CELL_LEVEL_LABELS[lvl];
  const params = [
    { label: "观察角度", desc: "拖拽或滑动倾转分层剖面", unit: "°", min: -45, max: 45, step: 5, value: state.cellRotateY || -10 },
    { label: "结构数量", desc: `${levelName}要求识别的结构`, unit: "个", min: 1, max: 12, step: 1, value: count }
  ];
  const generationStages = [
    { label: "识别题型", text: `识别${label}结构识别题（${levelName}）`, progress: 28 },
    { label: "生成截面", text: `按${CELL_LEVEL_SOURCES[lvl]}构建${label}结构模式图`, progress: 63 },
    { label: "绑定标注", text: `绑定 ${count} 个可点击结构与功能解析`, progress: 100 }
  ];
  if (type === "animal") {
    const senior = lvl === "senior";
    return {
      question: buildBiologyQuestionText("animal", lvl),
      title: senior ? "动物细胞：亚显微结构与功能" : "动物细胞：基本结构与功能",
      description: senior
        ? "按必修1模式图：细胞膜、细胞核与各种细胞器，点击结构查看功能。"
        : "按七年级上册：细胞膜、细胞质、细胞核和线粒体，点击结构查看功能。",
      ar: "移动端扩展可继续展示动物细胞截面、结构标注与倾转观察。",
      params,
      steps: senior ? [
        ["观察截面", "先找细胞膜、细胞核，再看细胞质中的细胞器", "动物细胞没有细胞壁，细胞的边界是细胞膜。"],
        ["识别结构", "区分双层膜（线粒体、核膜）、单层膜（内质网、高尔基体、溶酶体）与无膜结构（核糖体、中心体）", "按膜结构分类，便于记忆各细胞器的形态。"],
        ["关联功能", "线粒体是有氧呼吸的主要场所，核糖体是合成蛋白质的场所", "把结构与“动力车间”“生产蛋白质的机器”等功能对应起来。"],
        ["对比记忆", "与高等植物细胞相比：有中心体，无细胞壁、叶绿体和大液泡", "用动植物细胞的差异形成记忆抓手。"]
      ] : [
        ["观察截面", "先找细胞膜、细胞质和细胞核", "动物细胞没有细胞壁，最外层是细胞膜。"],
        ["识别结构", "点击模型或结构名称，查看对应功能", "把示意图中的结构与名称对应起来。"],
        ["关联功能", "线粒体是呼吸作用的场所，为细胞生命活动提供能量", "线粒体是动植物细胞共有的能量转换器。"],
        ["对比记忆", "动物细胞没有细胞壁、叶绿体和液泡", "与植物细胞对比形成记忆抓手。"]
      ],
      mentor: senior
        ? "动物细胞和高等植物细胞在亚显微结构上有什么区别？重点看<strong>中心体、细胞壁、叶绿体和液泡</strong>。"
        : "动物细胞和植物细胞有什么区别？重点看有没有<strong>细胞壁、叶绿体和液泡</strong>。",
      hint: senior
        ? "动物细胞的边界是细胞膜；中心体见于动物和某些低等植物细胞，与有丝分裂有关；溶酶体主要分布在动物细胞中。"
        : "动物细胞最外层是细胞膜，没有细胞壁；也没有叶绿体和液泡。动植物细胞都有细胞膜、细胞质、细胞核和线粒体。",
      challenge: "切换到 <strong>植物细胞</strong>，对比哪些结构是植物细胞特有的。",
      generationStages,
      recognitionText: biologyRecognitionText("animal", lvl),
      structures,
      label
    };
  }
  const senior = lvl === "senior";
  return {
    question: buildBiologyQuestionText("plant", lvl),
    title: senior ? "植物细胞：亚显微结构与功能" : "植物细胞：基本结构与功能",
    description: senior
      ? "按必修1模式图：细胞壁、细胞膜、中央大液泡与各种细胞器，点击结构查看功能。"
      : "按七年级上册：细胞壁、细胞膜、细胞质、细胞核、液泡、叶绿体和线粒体，点击结构查看功能。",
    ar: "移动端扩展可继续展示植物细胞截面、结构标注与倾转观察。",
    params,
    steps: senior ? [
      ["观察截面", "先看细胞壁与紧贴其内侧的细胞膜，再看中央大液泡", "细胞壁全透性，细胞的边界是细胞膜。"],
      ["识别结构", "区分双层膜（叶绿体、线粒体、核膜）、单层膜（内质网、高尔基体、液泡）与无膜结构（核糖体）", "按膜结构分类，便于记忆各细胞器的形态。"],
      ["关联功能", "叶绿体是光合作用的场所，线粒体是有氧呼吸的主要场所", "把结构与“养料制造车间”“动力车间”等功能对应起来。"],
      ["对比记忆", "高等植物细胞有细胞壁、叶绿体和液泡，没有中心体", "用与动物细胞的差异形成记忆抓手。"]
    ] : [
      ["观察截面", "先区分细胞壁、细胞膜和中央的大液泡", "细胞膜很薄，紧贴在细胞壁内侧。"],
      ["识别结构", "点击模型或结构名称，查看对应功能", "把示意图中的结构与名称对应起来。"],
      ["关联功能", "叶绿体和线粒体都是细胞中的能量转换器", "叶绿体是光合作用的场所，线粒体是呼吸作用的场所。"],
      ["对比记忆", "植物细胞有细胞壁、叶绿体和液泡，动物细胞没有", "用与动物细胞的差异形成记忆抓手。"]
    ],
    mentor: senior
      ? "植物细胞的亚显微结构和动物细胞有什么区别？重点看<strong>细胞壁、叶绿体、液泡和中心体</strong>。"
      : "植物细胞结构和动物细胞有什么区别？重点看<strong>细胞壁、叶绿体和液泡</strong>。",
    hint: senior
      ? "高等植物细胞有细胞壁、叶绿体和中央大液泡，没有中心体；植物细胞同样有内质网、高尔基体、核糖体和线粒体。"
      : "植物细胞有细胞壁、叶绿体和液泡；叶绿体只存在于植物体的绿色部分。动物细胞没有细胞壁、叶绿体和液泡。",
    challenge: "切换到 <strong>动物细胞</strong>，观察它和植物细胞相比少了哪些结构。",
    generationStages,
    recognitionText: biologyRecognitionText("plant", lvl),
    structures,
    label
  };
}

function syncBiologyContent(type = state.cellType, level = state.cellLevel) {
  state.cellType = type;
  state.cellLevel = normalizeCellLevel(level);
  const content = buildBiologyContent(type, state.cellLevel);
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
  state.cellRotateY = clamp(y, -45, 45);
  if (elements.plantCellModel) {
    elements.plantCellModel.style.setProperty("--cell-rotate-x", `${state.cellRotateX}deg`);
    elements.plantCellModel.style.setProperty("--cell-rotate-y", `${state.cellRotateY}deg`);
  }
}

function setCellAutoRotate(enabled) {
  state.cellAutoRotate = Boolean(enabled) && !motionPreference.matches;
  cellSweepDirection = state.cellRotateY >= 45 ? -1 : 1;
  if (elements.plantCellModel) elements.plantCellModel.classList.toggle("auto-rotate", state.cellAutoRotate);
  if (elements.cellAutoButton) {
    elements.cellAutoButton.classList.toggle("active", state.cellAutoRotate);
    elements.cellAutoButton.textContent = state.cellAutoRotate ? "停止观察" : "自动观察";
    elements.cellAutoButton.disabled = motionPreference.matches;
  }
  animationClock.reconcile();
}

function updateCellModelMode() {
  if (!elements.plantCellModel) return;
  const isAnimal = state.cellType === "animal";
  const level = normalizeCellLevel(state.cellLevel);
  renderCellModelMarkup(state.cellType, level);
  elements.plantCellModel.classList.toggle("animal-cell-mode", isAnimal);
  elements.plantCellModel.classList.toggle("plant-cell-mode", !isAnimal);
  elements.plantCellModel.classList.toggle("labels-hidden", !state.cellLabelsVisible);
  elements.plantCellModel.dataset.level = level;
  elements.plantCellModel.setAttribute("aria-label", `${CELL_TYPE_LABELS[state.cellType]}${level === "senior" ? "亚显微结构模式图" : "结构示意图"}`);
  elements.plantCellModel.dataset.selected = state.selectedOrganelle;
  const title = $(".cell-viewer-head > span");
  if (title) title.textContent = `${CELL_TYPE_LABELS[state.cellType]} · ${level === "senior" ? "亚显微结构" : "结构示意"}`;
  $$(".cell-level-toggle button").forEach(button => {
    const on = button.dataset.level === level;
    button.classList.toggle("active", on);
    button.setAttribute("aria-pressed", String(on));
  });
  if (elements.cellLabelButton) {
    elements.cellLabelButton.classList.toggle("active", state.cellLabelsVisible);
    elements.cellLabelButton.setAttribute("aria-pressed", String(state.cellLabelsVisible));
    elements.cellLabelButton.textContent = state.cellLabelsVisible ? "隐藏标注" : "显示标注";
  }
  if (elements.cellSourceNote) elements.cellSourceNote.textContent = `依据：${CELL_LEVEL_SOURCES[level]}`;
  const map = currentCellOrganelleMap();
  $$(".cell-organelle").forEach(node => {
    const allowed = map.has(node.dataset.organelle);
    node.classList.toggle("unavailable", !allowed);
    node.setAttribute("aria-hidden", String(!allowed));
    node.setAttribute("aria-label", map.get(node.dataset.organelle)?.name || "细胞结构");
    node.setAttribute("tabindex", allowed ? "0" : "-1");
  });
  $$(".cell-structure-tag").forEach(node => {
    const allowed = map.has(node.dataset.organelle);
    node.classList.toggle("unavailable", !allowed);
    node.setAttribute("aria-hidden", String(!allowed));
    node.tabIndex = allowed ? 0 : -1;
  });
}

function renderCellDetail(id = state.selectedOrganelle) {
  updateCellModelMode();
  const map = currentCellOrganelleMap();
  const organelle = map.get(id) || map.get(defaultOrganelleForCellType());
  state.selectedOrganelle = organelle.id;
  elements.plantCellModel.dataset.selected = organelle.id;

  $$(".cell-organelle").forEach(node => {
    node.classList.toggle("active", node.dataset.organelle === organelle.id);
    node.setAttribute("aria-pressed", String(node.dataset.organelle === organelle.id));
  });
  $$(".cell-label").forEach(node => node.classList.toggle("active", node.dataset.organelle === organelle.id));
  $$(".cell-structure-tag").forEach(node => {
    node.classList.toggle("active", node.dataset.organelle === organelle.id);
    node.setAttribute("aria-pressed", String(node.dataset.organelle === organelle.id));
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
  if (options.level) state.cellLevel = normalizeCellLevel(options.level);
  const content = syncBiologyContent(type, state.cellLevel);
  const keepSelection = options.keepSelection && currentCellOrganelleMap().has(state.selectedOrganelle);
  if (!keepSelection) state.selectedOrganelle = defaultOrganelleForCellType(type);
  state.p2 = currentCellOrganelles().length;
  if (options.keepView) {
    updateCellModelMode();
    renderCellDetail(state.selectedOrganelle);
  } else {
    resetBiologyCellModel();
  }
  refreshGeneratedSubjectSurface("生物", { preserveProblemText: true });
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

function switchBiologyCellLevel(level) {
  if (state.subject !== "生物") return;
  const next = normalizeCellLevel(level);
  if (next === state.cellLevel) return;
  clearReasoningTimers();
  switchBiologyCellType(state.cellType, { level: next, keepSelection: true, keepView: true });
  setReasoningStep(2, `<span>学段切换</span>已切换到${CELL_LEVEL_LABELS[next]}（${CELL_LEVEL_SOURCES[next]}），共 ${currentCellOrganelles().length} 个结构。`);
  showToast(`已切换到${CELL_LEVEL_LABELS[next]}`);
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
  physics.metrics = [["速度 v", "m/s"], ["位移 x", "m"], ["时间 t", "s"]];
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

function projectileModel(speed = state.p1, height = state.p2, gravity = state.projectileGravity ?? PROJECTILE_LIMITS.gravity) {
  const g = gravity;
  const fallTime = Math.sqrt((2 * height) / g);
  const range = speed * fallTime;
  const verticalSpeed = g * fallTime;
  return { speed, height, gravity: g, fallTime, range, verticalSpeed };
}

function buildPhysicsProjectileQuestionText(speed = state.p1, height = state.p2, gravity = state.projectileGravity ?? PROJECTILE_LIMITS.gravity) {
  const gravityText = Math.abs(gravity - PROJECTILE_LIMITS.gravity) > 1e-9 ? `，取 g = ${exactNumber(gravity)}m/s²` : "";
  return `小球以 ${exactNumber(speed)}m/s 的水平速度从 ${exactNumber(height)}m 高的平台水平抛出，不计空气阻力${gravityText}。求落地时间和水平位移，并观察运动轨迹。`;
}

// 题目问的量只在参数仍与原题一致时采用
function projectileAskFor(model, ask = state.projectileAsk) {
  if (!ask) return { vy: false };
  const same = Math.abs(ask.speed - model.speed) < 1e-9 && Math.abs(ask.height - model.height) < 1e-9 && Math.abs(ask.gravity - model.gravity) < 1e-9;
  return same ? ask : { vy: false };
}

function buildPhysicsProjectileContent(speed = state.p1, height = state.p2, gravity = state.projectileGravity ?? PROJECTILE_LIMITS.gravity, askOverride = null) {
  const model = projectileModel(speed, height, gravity);
  const ask = askOverride || projectileAskFor(model);
  const vText = smartNumber(model.speed);
  const hText = smartNumber(model.height);
  const gText = smartNumber(model.gravity);
  const tText = smartNumber(model.fallTime, 2);
  const xText = smartNumber(model.range, 1);
  const vyText = smartNumber(model.verticalSpeed, 1);
  // 落地时间、水平位移除不尽时写“≈ / 约”
  const tEq = eqSign(model.fallTime);
  const xEq = eqSign(model.range);
  const tAbout = aboutText(model.fallTime);
  const xAbout = aboutText(model.range);
  const rangeLine = tEq === "=" ? `x = v₀t = ${vText} × ${tText} ${xEq} ${xText}m` : `x = v₀t ${xEq} ${xText}m`;
  const vyEq = eqSign(model.verticalSpeed);
  const vyLine = tEq === "=" ? `vᵧ = gt = ${gText} × ${tText} ${vyEq} ${vyText}m/s` : `vᵧ = gt ${vyEq} ${vyText}m/s`;
  return {
    title: "平抛运动：水平位移与落地时间",
    description: `把平抛运动拆成水平匀速和竖直自由落体：落地时间 ${tAbout}${tText}s，水平位移 ${xAbout}${xText}m。`,
    engine: "运动合成模板演示",
    ar: "移动端扩展可继续展示平抛轨迹与速度分解。",
    metrics: [["水平速度 v₀", "m/s"], ["落地时间 t", "s"], ["水平位移 x", "m"]],
    params: [
      { label: "水平速度 v₀", desc: "调整小球抛出时的水平速度", unit: "m/s", min: PROJECTILE_LIMITS.speedMin, max: PROJECTILE_LIMITS.speedMax, step: 1, value: model.speed },
      { label: "释放高度 h", desc: "调整平台到地面的高度", unit: "m", min: PROJECTILE_LIMITS.heightMin, max: PROJECTILE_LIMITS.heightMax, step: 1, value: model.height }
    ],
    steps: [
      ["提取条件", `v₀ = ${vText}m/s，h = ${hText}m，g 取 ${gText}m/s²`, "识别水平初速度、释放高度和不计空气阻力。"],
      ["拆分运动", "水平方向匀速，竖直方向自由落体", "平抛运动可以看作两个方向的独立运动。"],
      ["计算时间", `h = 1/2gt²，t = √(2h/g) ${tEq} ${tText}s`, "落地时间只由竖直高度决定。"],
      ask.vy
        ? ["计算竖直分速度", `${rangeLine}；${vyLine}`, "竖直方向做自由落体运动，落地时竖直分速度 vᵧ = gt。"]
        : ["计算位移", rangeLine, "水平位移由水平速度和落地时间共同决定。"]
    ],
    mentor: `为什么平抛的落地时间只由 <strong>高度 ${hText}m</strong> 决定？因为竖直方向初速度为 0，只受重力加速度影响。`,
    hint: "小提示：先不要把曲线当成一个整体算，把水平方向和竖直方向分开看。",
    challenge: `如果水平速度变为 <strong>${smartNumber(projectileChallengeSpeed(model.speed))}m/s</strong>，落地时间会变吗？水平位移会怎样变化？`,
    generationStages: [
      { label: "识别条件", text: `识别平抛条件：v₀ = ${vText}m/s，h = ${hText}m`, progress: 28 },
      { label: "拆分运动", text: "建立水平匀速 + 竖直自由落体模型", progress: 63 },
      { label: "生成轨迹", text: `生成平抛轨迹：水平位移 ${xAbout}${xText}m`, progress: 100 }
    ],
    recognitionText: `水平速度 ${vText}m/s｜高度 ${hText}m｜落地时间 ${tAbout}${tText}s｜水平位移 ${xAbout}${xText}m${ask.vy ? `｜竖直分速度 ${aboutText(model.verticalSpeed)}${vyText}m/s` : ""}`,
    formulaHtml: `由竖直运动得 t = √(2h/g) ${tEq} ${tText}s<br>水平方向：${rangeLine}<br>落地瞬间竖直速度 ${aboutText(model.verticalSpeed)}${vyText}m/s`,
    sceneTip: `小球从 ${hText}m 高处水平抛出，${tAbout}${tText}s 后落地，水平位移${xAbout ? "约为" : "为"} ${xText}m${ask.vy ? `，落地时竖直分速度${vyEq === "≈" ? "约为" : "为"} ${vyText}m/s` : ""}。`,
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
  return `某纯电阻电路两端电压为 ${exactNumber(voltage)}V，电阻为 ${exactNumber(resistance)}Ω。求电路中的电流，并观察电压或电阻改变时电流如何变化。`;
}

// 题目求哪个量：给 U、I 求 R，给 I、R 求 U，其余按 I = U/R 展示。拖动滑块改变数值后回到 I = U/R 的探究形式。
function circuitAskedForm(voltage, resistance, solve = state.circuitSolve) {
  if (!solve || solve.solveFor === "I") return null;
  if (Math.abs(solve.voltage - voltage) > 1e-9 || Math.abs(solve.resistance - resistance) > 1e-9) return null;
  return solve;
}

function circuitResultLine(model, solve = state.circuitSolve) {
  const asked = circuitAskedForm(model.voltage, model.resistance, solve);
  const uText = smartNumber(model.voltage);
  const rText = smartNumber(model.resistance);
  if (asked?.solveFor === "R") return `R = ${uText} V ÷ ${smartNumber(asked.current, 2)} A ${eqSign(model.resistance)} ${rText} Ω`;
  if (asked?.solveFor === "U") return `U = ${smartNumber(asked.current, 2)} A × ${rText} Ω ${eqSign(model.voltage)} ${uText} V`;
  if (asked?.solveFor === "P") {
    // 只用题目给出的两个量计算，避免用四舍五入后的中间量相乘
    const pEq = eqSign(model.power);
    const pText = smartNumber(model.power, 2);
    if (asked.pair === "UR") return `P = U²/R = (${uText} V)² ÷ ${rText} Ω ${pEq} ${pText} W`;
    if (asked.pair === "IR") return `P = I²R = (${smartNumber(asked.current, 2)} A)² × ${rText} Ω ${pEq} ${pText} W`;
    return `P = UI = ${uText} V × ${smartNumber(asked.current, 2)} A ${pEq} ${pText} W`;
  }
  return `I = ${uText} V ÷ ${rText} Ω ${eqSign(model.current)} ${smartNumber(model.current, 2)} A`;
}

function buildPhysicsCircuitContent(voltage = state.p1, resistance = state.p2, solve = state.circuitSolve) {
  const model = circuitModel(voltage, resistance);
  const asked = circuitAskedForm(model.voltage, model.resistance, solve);
  const uText = smartNumber(model.voltage);
  const rText = smartNumber(model.resistance);
  const iText = smartNumber(asked ? asked.current : model.current, 2);
  const pText = smartNumber(model.power, 2);
  const uEq = eqSign(model.voltage);
  const rEq = eqSign(model.resistance);
  const iEq = eqSign(model.current);
  const pEq = eqSign(model.power);
  const pAbout = aboutText(model.power);
  const powerLine = `电阻的电功率：P = UI ${pEq} ${pText} W`;
  const particleNote = "运动粒子表示电流方向与相对快慢，金属导体中自由电子定向移动的方向与电流方向相反，点速也不表示电子运动快慢或真实漂移速度。";
  const shared = {
    title: "欧姆定律电路：电压、电阻与电流",
    engine: "电路定量模板演示",
    ar: "移动端扩展可继续展示电路连接与电流变化。",
    metrics: [["电压 U", "V"], ["电阻 R", "Ω"], ["电流 I", "A"]],
    params: [
      { label: "电压 U", desc: "调整电源两端电压", unit: "V", min: CIRCUIT_LIMITS.voltageMin, max: CIRCUIT_LIMITS.voltageMax, step: 1, value: model.voltage },
      { label: "电阻 R", desc: "调整纯电阻阻值", unit: "Ω", min: CIRCUIT_LIMITS.resistanceMin, max: CIRCUIT_LIMITS.resistanceMax, step: 1, value: model.resistance }
    ],
    challenge: `如果电压变为 <strong>${smartNumber(circuitChallengeVoltage(model.voltage))}V</strong>，电阻不变，电流会怎样变化？`,
    model
  };
  if (asked?.solveFor === "R") {
    return {
      ...shared,
      description: `纯电阻电路中 R = U / I：电压 ${uText}V，电流 ${iText}A，电阻 ${rText}Ω。电流粒子仅表示电流方向与相对快慢。`,
      formula: "R = U / I",
      steps: [
        ["提取条件", `U = ${uText}V，I = ${iText}A`, "识别电阻两端的电压和通过它的电流。"],
        ["选择公式", "R = U / I", "由欧姆定律 I = U / R 变形得到。"],
        ["代入计算", `R = U/I = ${uText} V ÷ ${iText} A ${rEq} ${rText} Ω`, "用欧姆定律求出电阻。"],
        ["现象验证", `R ${rEq} ${rText}Ω，电阻功率 P ${pEq} ${pText}W`, "电阻由导体本身决定；改变电压时电流随之改变，U 与 I 的比值不变。"]
      ],
      mentor: "为什么电压与电流的比值就是电阻？因为欧姆定律 <strong>I = U / R</strong> 可以变形为 <strong>R = U / I</strong>。",
      hint: "小提示：用 R = U / I 求电阻时，U 和 I 必须是同一段导体、同一时刻的电压和电流。",
      generationStages: [
        { label: "识别电路条件", text: `识别 U = ${uText}V，I = ${iText}A`, progress: 28 },
        { label: "匹配欧姆定律", text: "匹配纯电阻电路模板：R = U / I", progress: 63 },
        { label: "生成电路反馈", text: `求得电阻 ${aboutText(model.resistance)}${rText}Ω，电阻功率 ${pAbout}${pText}W`, progress: 100 }
      ],
      recognitionText: `电压 ${uText}V｜电流 ${iText}A｜电阻 ${aboutText(model.resistance)}${rText}Ω｜功率 ${pAbout}${pText}W`,
      formulaHtml: `代入：R = U/I = ${uText} V ÷ ${iText} A ${rEq} ${rText} Ω<br>${powerLine}`,
      sceneTip: `电压 ${uText}V、电流 ${iText}A 时，电阻${rEq === "≈" ? "约为" : "为"} ${rText}Ω；${particleNote}`
    };
  }
  if (asked?.solveFor === "P") {
    const pair = asked.pair || "UR";
    const given = pair === "UI" ? `U = ${uText}V，I = ${iText}A`
      : pair === "IR" ? `I = ${iText}A，R = ${rText}Ω`
        : pair === "UR" ? `U = ${uText}V，R = ${rText}Ω`
          : `U = ${uText}V，I = ${iText}A，R = ${rText}Ω`;
    // 纯电阻电路：给 U、R 用 P = U²/R，给 I、R 用 P = I²R，给 U、I 用 P = UI，都不经过四舍五入的中间量
    const formula = pair === "UR" ? "P = U²/R" : pair === "IR" ? "P = I²R" : "P = UI";
    const powerCalc = pair === "UR" ? `P = U²/R = (${uText} V)² ÷ ${rText} Ω ${pEq} ${pText} W`
      : pair === "IR" ? `P = I²R = (${iText} A)² × ${rText} Ω ${pEq} ${pText} W`
        : `P = UI = ${uText} V × ${iText} A ${pEq} ${pText} W`;
    const why = pair === "UR" ? "纯电阻电路中 I = U/R，代入 P = UI 得 P = U²/R。"
      : pair === "IR" ? "纯电阻电路中 U = IR，代入 P = UI 得 P = I²R。"
        : "电功率等于电压与电流的乘积。";
    return {
      ...shared,
      description: `纯电阻电路中 ${formula}：${pair === "IR" ? `电流 ${iText}A，电阻 ${rText}Ω` : pair === "UR" ? `电压 ${uText}V，电阻 ${rText}Ω` : `电压 ${uText}V，电流 ${iText}A`}，电功率 ${pAbout}${pText}W。电流粒子仅表示电流方向与相对快慢。`,
      formula,
      steps: [
        ["提取条件", given, "识别电阻两端的电压、通过的电流或电阻阻值。"],
        ["选择公式", pair === "UI" ? "P = UI" : `P = UI → ${formula}`, why],
        ["代入计算", powerCalc, "求出电阻消耗的电功率。"],
        ["现象验证", `P ${pEq} ${pText}W`, "电阻一定时，电压越大，电流和电功率都越大。"]
      ],
      mentor: pair === "UI"
        ? "为什么电功率等于电压与电流的乘积？因为 P = W/t，而电流做的功 W = UIt。"
        : `为什么这里用 <strong>${formula}</strong>？题目给的是${pair === "UR" ? "电压和电阻" : "电流和电阻"}，把欧姆定律代入 <strong>P = UI</strong>，就不用先算出${pair === "UR" ? "电流" : "电压"}。`,
      hint: "小提示：先确认已知的是哪两个量，再选 P = UI、P = U²/R 或 P = I²R。",
      generationStages: [
        { label: "识别电路条件", text: `识别 ${given}`, progress: 28 },
        { label: "匹配电功率公式", text: `匹配纯电阻电路模板：${formula}`, progress: 63 },
        { label: "生成电路反馈", text: `求得电功率 ${pAbout}${pText}W`, progress: 100 }
      ],
      recognitionText: `${given.replace(/，/g, "｜")}｜电功率 ${pAbout}${pText}W`,
      formulaHtml: powerCalc,
      sceneTip: `${pair === "IR" ? `电流 ${iText}A、电阻 ${rText}Ω` : pair === "UR" ? `电压 ${uText}V、电阻 ${rText}Ω` : `电压 ${uText}V、电流 ${iText}A`} 时，电阻消耗的电功率${pEq === "≈" ? "约为" : "为"} ${pText}W；${particleNote}`
    };
  }
  if (asked?.solveFor === "U") {
    return {
      ...shared,
      description: `纯电阻电路中 U = IR：电流 ${iText}A，电阻 ${rText}Ω，电压 ${uText}V。电流粒子仅表示电流方向与相对快慢。`,
      formula: "U = IR",
      steps: [
        ["提取条件", `I = ${iText}A，R = ${rText}Ω`, "识别通过电阻的电流和电阻的阻值。"],
        ["选择公式", "U = IR", "由欧姆定律 I = U / R 变形得到。"],
        ["代入计算", `U = IR = ${iText} A × ${rText} Ω ${uEq} ${uText} V`, "用欧姆定律求出电阻两端的电压。"],
        ["现象验证", `U ${uEq} ${uText}V，电阻功率 P ${pEq} ${pText}W`, "电阻一定时，电流越大，电阻两端电压越大。"]
      ],
      mentor: "为什么电流和电阻相乘就得到电压？因为欧姆定律 <strong>I = U / R</strong> 可以变形为 <strong>U = IR</strong>。",
      hint: "小提示：用 U = IR 时，I 和 R 必须对应同一段导体。",
      generationStages: [
        { label: "识别电路条件", text: `识别 I = ${iText}A，R = ${rText}Ω`, progress: 28 },
        { label: "匹配欧姆定律", text: "匹配纯电阻电路模板：U = IR", progress: 63 },
        { label: "生成电路反馈", text: `求得电压 ${aboutText(model.voltage)}${uText}V，电阻功率 ${pAbout}${pText}W`, progress: 100 }
      ],
      recognitionText: `电流 ${iText}A｜电阻 ${rText}Ω｜电压 ${aboutText(model.voltage)}${uText}V｜功率 ${pAbout}${pText}W`,
      formulaHtml: `代入：U = IR = ${iText} A × ${rText} Ω ${uEq} ${uText} V<br>${powerLine}`,
      sceneTip: `电流 ${iText}A、电阻 ${rText}Ω 时，电阻两端电压${uEq === "≈" ? "约为" : "为"} ${uText}V；${particleNote}`
    };
  }
  return {
    ...shared,
    description: `纯电阻电路中 I = U / R：电压 ${uText}V，电阻 ${rText}Ω，电流 ${aboutText(model.current)}${iText}A。电流粒子仅表示电流方向与相对快慢。`,
    formula: "I = U / R",
    steps: [
      ["提取条件", `U = ${uText}V，R = ${rText}Ω`, "识别电路两端电压和电阻。"],
      ["选择公式", "I = U / R", "纯电阻电路中电流与电压成正比，与电阻成反比。"],
      ["代入计算", `I = U/R = ${uText} V ÷ ${rText} Ω ${iEq} ${iText} A`, "用欧姆定律求出电流。"],
      ["现象验证", `电流 ${aboutText(model.current)}${iText}A，电阻功率 P ${pEq} ${pText}W`, "电压增大或电阻改变时，电流与电阻消耗的功率同步变化。"]
    ],
    mentor: `为什么电阻变大后电流会变小？因为在电压 ${uText}V 不变时，<strong>I = U / R</strong> 中分母变大。`,
    hint: "小提示：先确认这是纯电阻电路，再直接使用欧姆定律 I = U / R。",
    generationStages: [
      { label: "识别电路条件", text: `识别 U = ${uText}V，R = ${rText}Ω`, progress: 28 },
      { label: "匹配欧姆定律", text: "匹配纯电阻电路模板：I = U / R", progress: 63 },
      { label: "生成电路反馈", text: `生成电流 ${aboutText(model.current)}${iText}A 与电阻功率 ${pAbout}${pText}W`, progress: 100 }
    ],
    recognitionText: `电压 ${uText}V｜电阻 ${rText}Ω｜电流 ${aboutText(model.current)}${iText}A｜功率 ${pAbout}${pText}W`,
    formulaHtml: `代入：I = U/R = ${uText} V ÷ ${rText} Ω ${iEq} ${iText} A<br>${powerLine}`,
    sceneTip: `电压 ${uText}V、电阻 ${rText}Ω 时，电流${iEq === "≈" ? "约为" : "为"} ${iText}A；${particleNote}`
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
  return template.content(p1, p2, state.extraFixed?.[id]);
}

function buildExtraPhysicsQuestionText(id = state.physicsTemplate, p1 = state.p1, p2 = state.p2) {
  const template = extraPhysicsTemplate(id);
  if (!template) return buildPhysicsBrakeQuestionText();
  return template.question(p1, p2, template.fixedWithDefaults ? template.fixedWithDefaults(state.extraFixed?.[id]) : {});
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
  const html = content.visualHtml || "";
  const diagramId = html.includes('edu-diagram') ? state.physicsTemplate : "";
  if (elements.genericPhysicsVisual.dataset.diagramId !== diagramId) {
    elements.genericPhysicsVisual.classList.remove("diagram-zoomed");
    elements.genericPhysicsVisual.dataset.diagramId = diagramId;
  }
  if (elements.genericPhysicsVisual._visualHtml !== html) {
    elements.genericPhysicsVisual.innerHTML = diagramId
      ? `<div class="diagram-mobile-toolbar"><span>放大后左右滑动看全图</span><button type="button" class="diagram-zoom-toggle" aria-pressed="false">放大图示</button></div>
         <div class="diagram-pan-viewport" role="region" aria-label="教材图示，放大后可左右滚动查看" tabindex="0">${html}</div>`
      : html;
    elements.genericPhysicsVisual._visualHtml = html;
  }
  const zoomButton = elements.genericPhysicsVisual.querySelector(".diagram-zoom-toggle");
  if (zoomButton) {
    const zoomed = elements.genericPhysicsVisual.classList.contains("diagram-zoomed");
    zoomButton.setAttribute("aria-pressed", String(zoomed));
    zoomButton.textContent = zoomed ? "缩小图示" : "放大图示";
  }
  if (elements.genericPhysicsMeta) elements.genericPhysicsMeta.textContent = `${content.stage} · ${content.block}`;
  setFormulaHtml(elements.genericPhysicsResult, content.resultTitle);
  setFormulaHtml(elements.genericPhysicsDescription, content.resultDescription);
  if (elements.genericPhysicsFacts) {
    elements.genericPhysicsFacts.innerHTML = content.facts
      .map(item => `<div><dt>${item.label}</dt><dd>${verticalizeFormulaHtml(item.value)}</dd></div>`)
      .join("");
  }
}

elements.genericPhysicsVisual?.addEventListener("click", event => {
  const button = event.target.closest?.(".diagram-zoom-toggle");
  if (!button) return;
  const visual = elements.genericPhysicsVisual;
  const zoomed = visual.classList.toggle("diagram-zoomed");
  button.setAttribute("aria-pressed", String(zoomed));
  button.textContent = zoomed ? "缩小图示" : "放大图示";
  const pan = visual.querySelector(".diagram-pan-viewport");
  if (pan) pan.scrollLeft = 0;
});

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
    <p>初速度 <em>${smartNumber(previous.v0)} → ${smartNumber(next.v0)}m/s</em>｜停止距离 <em>${aboutText(previous.stopDistance)}${smartNumber(previous.stopDistance)} → ${aboutText(next.stopDistance)}${smartNumber(next.stopDistance)}m</em></p>
  `;
}

function frictionChallengeMu(mu) {
  const up = Number((mu + 0.1).toFixed(6));
  return up <= PHYSICS_FRICTION_BRAKE_LIMITS.muMax ? up : Math.max(PHYSICS_FRICTION_BRAKE_LIMITS.muMin, Number((mu - 0.1).toFixed(6)));
}

function linearDragChallengeK(k, mass = state.brakeMass) {
  const bounds = linearDragKBounds(mass);
  const up = k * 1.5;
  return up <= bounds.max ? up : Math.max(bounds.min, k * 0.75);
}

function projectileChallengeSpeed(speed) {
  let next = Math.round(speed * 1.5);
  if (next > PROJECTILE_LIMITS.speedMax || next === speed) next = Math.round(speed * 0.75);
  return clamp(next, PROJECTILE_LIMITS.speedMin, PROJECTILE_LIMITS.speedMax);
}

function circuitChallengeVoltage(voltage) {
  return voltage * 2 <= CIRCUIT_LIMITS.voltageMax ? voltage * 2 : Math.max(CIRCUIT_LIMITS.voltageMin, voltage / 2);
}

function solenoidChallengeCurrent(current) {
  return current * 2 <= SOLENOID_LIMITS.currentMax ? current * 2 : Math.max(SOLENOID_LIMITS.currentMin, current / 2);
}

function chemistryChallengeFe(feMass) {
  return feMass * 2 <= CHEMISTRY_CONSTANTS.feMassMax ? feMass * 2 : Math.max(CHEMISTRY_CONSTANTS.feMassMin, feMass / 2);
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

function parsePhysicsBrakeCore(text) {
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

// 题目问的是刹车时间、刹车距离还是两者：公式卡、步骤和结论按所问的量来写
function brakeAskOf(text) {
  const guard = questionGuard();
  const source = guard ? guard.normalize(text) : String(text || "");
  const joined = (guard ? guard.askItems(source) : []).join("｜") || source;
  const time = /时间|多久|多长|几秒|用时|多少秒/.test(joined);
  const distance = /距离|位移|路程|多远|滑行/.test(joined);
  return { time, distance: distance || !time };
}

function parsePhysicsBrakeQuestion(text) {
  const result = parsePhysicsBrakeCore(convertSpeedUnits(text));
  if (!result.ok) return result;
  const check = brakeStrictCheck(text, result);
  if (!check.ok) return { ok: false, message: check.message };
  const mode = result.mode || "constant";
  const parameter = result.parameter ?? result.aAbs;
  const ask = { ...brakeAskOf(text), v0: result.v0, mode, parameter };
  const options = { mode, gravity: result.gravity || 9.8, mass: result.mass || 1000, ask };
  return { ...result, brakeAsk: ask, recognitionText: buildPhysicsBrakeContent(result.v0, parameter, options).recognitionText };
}

window.parsePhysicsBrakeQuestion = parsePhysicsBrakeQuestion;

function isPhysicsBoardSliderQuestion(text) {
  const source = normalizeQuestionText(text);
  return /木板|长木板/.test(source)
    && /滑块|物块|小物块/.test(source)
    && /摩擦|动摩擦因数|相对滑动|相对运动|滑落|μ/.test(source);
}

function parsePhysicsBoardSliderCore(text, massOverride = null) {
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

  const blockMass = massOverride?.block ?? equalMass ?? firstNumberByPatterns(source, [
    /(?:滑块|小物块|物块)\s*A?[^。；，,]{0,18}?质量\s*(?:m\s*)?(?:为|是|=|:|：)?\s*(\d+(?:\.\d+)?)\s*kg/i,
    /质量\s*(?:为|是|=|:|：)?\s*(\d+(?:\.\d+)?)\s*kg[^。；]{0,22}?(?:滑块|小物块|物块)\s*A/i,
    /(?:^|[，,；;\s])m\s*(?:=|:|：)\s*(\d+(?:\.\d+)?)\s*kg/
  ]);
  const boardMass = massOverride?.board ?? equalMass ?? firstNumberByPatterns(source, [
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

// 每个质量归属于它所描述的物体：“质量为 0.5kg 的滑块”“质量为 2kg、长 1.5m 的木板”“滑块的质量为 1kg”“M = 2kg”
function boardSliderMassOwners(source, guard) {
  const tokens = guard.extractQuantities(source).filter(token => token.cls === "mass");
  if (/质量\s*(?:均|都)\s*(?:为|是)|质量相(?:等|同)/.test(source)) {
    const values = [...new Set(tokens.map(token => token.value))];
    return values.length === 1 ? { block: values[0], board: values[0] } : null;
  }
  const owners = { block: [], board: [] };
  for (const token of tokens) {
    const end = token.index + token.text.length;
    const after = source.slice(end, end + 18);
    const before = source.slice(Math.max(0, token.index - 16), token.index);
    let owner = "";
    // “0.5kg 的滑块”“2kg、长 1.5m 的木板”；逗号后直接出现名词（“木板质量为2kg，滑块……”）是另一句，不算
    const follow = after.match(/^\s*(?:[、，,]\s*长(?:度)?\s*(?:为|是|L?\s*[=＝])?\s*\d+(?:\.\d+)?\s*m\s*)?的\s*(长木板|木板|平板|小滑块|滑块|小物块|物块|木块)/);
    if (follow) owner = /板/.test(follow[1]) ? "board" : "block";
    else if (/(?:^|[^A-Za-z])m\s*[=＝:：]\s*$/.test(before)) owner = "block";
    else if (/M\s*[=＝:：]\s*$/.test(before)) owner = "board";
    else {
      const clause = before.split(/[，,。；;]/).pop();
      const nouns = [...clause.matchAll(/长木板|木板|平板|滑块|物块|木块/g)];
      if (nouns.length) owner = /板/.test(nouns[nouns.length - 1][0]) ? "board" : "block";
    }
    if (!owner) return null;
    owners[owner].push(token.value);
  }
  const block = [...new Set(owners.block)];
  const board = [...new Set(owners.board)];
  return block.length === 1 && board.length === 1 ? { block: block[0], board: board[0] } : null;
}

function parsePhysicsBoardSliderQuestion(text) {
  const guard = questionGuard();
  if (!guard) return { ok: false, message: "题目解析组件未加载，暂不生成本地实验。" };
  const source = guard.normalize(text);
  // 质量先按所描述的物体归属，再交给核心解析做范围检查（题目不写 A、B 也能识别）
  const masses = boardSliderMassOwners(source, guard);
  const core = parsePhysicsBoardSliderCore(text, masses);
  if (!core.ok) return core;
  // 模板只演示光滑水平地面：没写“光滑”，或给了木板与地面间的摩擦，都交给 AI
  if (!/光滑/.test(source) || /(?:与|和|跟)地面(?:之)?间[^。；，,]{0,4}(?:的)?(?:动)?摩擦|地面(?:的)?(?:动)?摩擦因数|地面[^。；，,]{0,4}粗糙/.test(source)) {
    return { ok: false, message: "当前木板—滑块模板只演示光滑水平地面上的情形。" };
  }
  if (guard.extractQuantities(source).filter(token => token.cls === "coef").length > 1) {
    return { ok: false, message: "题目给出了多个动摩擦因数，超出当前木板—滑块模板的范围。" };
  }
  if (!masses) return { ok: false, message: "未能确定滑块和木板各自的质量。" };
  const params = { ...core.params, blockMass: masses.block, boardMass: masses.board };
  const content = buildPhysicsBoardSliderContent(params);
  const result = {
    ...core,
    ...params,
    params,
    model: content.model,
    recognitionText: content.recognitionText,
    message: `已识别木板—滑块相对运动题：${content.model.outcomeLabel}`
  };
  const check = boardSliderStrictCheck(text, result);
  return check.ok ? result : { ok: false, message: check.message };
}

window.parsePhysicsBoardSliderQuestion = parsePhysicsBoardSliderQuestion;

function parsePhysicsSolenoidCore(text) {
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

  // 观察端只看“从……端看/观察”这类短语；题目问“右端是什么极”并不表示从右端观察
  const viewMatches = [...normalized.matchAll(/(?:从|由|在|面对|对着)[^，,。；;？?]{0,8}?(左|右)(?:端|侧|边|面)?[^，,。；;？?]{0,3}?(?:看|观察|望)|(左|右)端(?:看去|观察|看)|面对[^，,。；;？?]{0,6}?(左|右)端/g)];
  const viewSides = new Set(viewMatches.map(match => match[1] || match[2] || match[3]));
  const viewEnd = viewSides.size === 1 ? ([...viewSides][0] === "右" ? "right" : "left") : null;
  // 同时出现顺、逆时针（如“顺时针还是逆时针”）时绕向不确定
  const counterclockwise = /逆时针|逆时針|counterclockwise/i.test(normalized);
  const clockwise = /顺时针|順时針|(?<!counter)clockwise/i.test(normalized);
  const windingDirection = counterclockwise !== clockwise ? (counterclockwise ? "counterclockwise" : "clockwise") : null;
  // 铁芯逐句判断；“若/如果/假如……插入铁芯”是假设的变化，不算已经插入
  let hasCore = false;
  for (const sentence of normalized.split(/[。；;？?！!]/)) {
    const at = sentence.indexOf("铁芯");
    if (at < 0 || /若|如果|假如|假设|要使/.test(sentence.slice(0, at))) continue;
    if (/无铁芯|没有铁芯|不含铁芯|未插|拔出|取出|抽出/.test(sentence)) hasCore = false;
    else if (/(?:插入|插进|放入|装入|插有|装有|带有|含有|有)[^，,]{0,4}铁芯|铁芯[^，,]{0,4}(?:插入|插进|放入)/.test(sentence)) hasCore = true;
  }

  if (!viewEnd) return { ok: false, message: "请说明从螺线管哪一端观察电流的绕向，例如“从左端看”。" };
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

function parsePhysicsSolenoidQuestion(text) {
  const result = parsePhysicsSolenoidCore(text);
  if (!result.ok) return result;
  if (!Number.isInteger(result.turns)) return { ok: false, message: "线圈匝数需为整数。" };
  const check = solenoidStrictCheck(text, result);
  return check.ok ? result : { ok: false, message: check.message };
}

window.parsePhysicsSolenoidQuestion = parsePhysicsSolenoidQuestion;

function parsePhysicsProjectileCore(text) {
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

function parsePhysicsProjectileQuestion(text) {
  const result = parsePhysicsProjectileCore(text);
  if (!result.ok) return result;
  const guard = questionGuard();
  const gravity = guard ? guard.gravityOf(text) : { stated: false, value: PROJECTILE_LIMITS.gravity };
  if (!Number.isFinite(gravity.value)) return { ok: false, message: "题目中的 g 取值无法识别。" };
  const model = projectileModel(result.speed, result.height, gravity.value);
  const asks = guard ? guard.askItems(guard.normalize(text)).join("｜") : "";
  const projectileAsk = { vy: /竖直(?:分)?速度|vᵧ|vy/i.test(asks), speed: result.speed, height: result.height, gravity: gravity.value };
  const withGravity = {
    ...result,
    gravity: gravity.value,
    fallTime: model.fallTime,
    range: model.range,
    projectileAsk,
    recognitionText: buildPhysicsProjectileContent(result.speed, result.height, gravity.value, projectileAsk).recognitionText
  };
  const check = projectileStrictCheck(text, withGravity);
  return check.ok ? withGravity : { ok: false, message: check.message };
}

window.parsePhysicsProjectileQuestion = parsePhysicsProjectileQuestion;

function parsePhysicsCircuitQuestion(text) {
  const failMessage = "当前物理演示支持欧姆定律纯电阻电路题，请给出电压、电流、电阻中的任意两个。";
  const guard = questionGuard();
  if (!guard) return { ok: false, message: failMessage };
  const source = guard.normalize(text);
  if (!/欧姆|电压|电阻|电流|纯电阻|电路|导体|Ω/.test(source)) return { ok: false, message: failMessage };
  const tokens = guard.extractQuantities(source);
  const pick = cls => tokens.filter(token => token.cls === cls);
  const volts = pick("voltage");
  const amps = pick("current");
  const ohms = pick("resistance");
  if (volts.length > 1 || amps.length > 1 || ohms.length > 1) return { ok: false, message: failMessage };
  let voltage = volts[0]?.value;
  const current = amps[0]?.value;
  let resistance = ohms[0]?.value;
  const given = [voltage, current, resistance].filter(Number.isFinite).length;
  // 题目缺哪个量就求哪个量：给 U、I 求 R，给 I、R 求 U，其余求 I；只问功率时求 P
  const askPower = (() => {
    const targets = new Set();
    for (const raw of guard.askItems(source)) {
      // 所问的量是每一项里最后出现的物理量：“该电阻消耗的电功率”问的是功率，“通过电阻的电流”问的是电流
      const item = raw.replace(/(?:是|为|有|等于)?\s*(?:多少|多大|几)[\s\S]*$/, "");
      let best = "";
      let at = -1;
      for (const [key, pattern] of [["P", /功率|(?<![A-Za-z])P(?![A-Za-z0-9₀-₉])/g], ["R", /电阻|阻值|(?<![A-Za-z])R(?![A-Za-z0-9₀-₉])/g], ["I", /电流|(?<![A-Za-z])I(?![A-Za-z0-9₀-₉])/g], ["U", /电压|(?<![A-Za-z])U(?![A-Za-z0-9₀-₉])/g]]) {
        for (const match of item.matchAll(pattern)) {
          if (match.index > at) {
            at = match.index;
            best = key;
          }
        }
      }
      if (best) targets.add(best);
    }
    return targets.has("P") && targets.size === 1;
  })();
  const pair = `${Number.isFinite(voltage) ? "U" : ""}${Number.isFinite(current) ? "I" : ""}${Number.isFinite(resistance) ? "R" : ""}`;
  const solveFor = askPower ? "P" : given === 3 ? "I" : !Number.isFinite(voltage) ? "U" : !Number.isFinite(resistance) ? "R" : "I";
  if (given < 2) return { ok: false, message: failMessage };
  if (given === 3 && Math.abs(voltage - current * resistance) > 1e-6 * Math.max(1, Math.abs(voltage))) {
    return { ok: false, message: "题目给出的电压、电流、电阻不满足 U = IR。" };
  }
  if (!Number.isFinite(voltage)) voltage = current * resistance;
  if (!Number.isFinite(resistance)) resistance = voltage / current;
  voltage = guard.tidy(voltage);
  resistance = guard.tidy(resistance);
  if (!(voltage > 0) || !(resistance > 0)) return { ok: false, message: failMessage };
  if (voltage < CIRCUIT_LIMITS.voltageMin || voltage > CIRCUIT_LIMITS.voltageMax) {
    return { ok: false, message: `识别到电压 ${exactNumber(voltage)}V，但当前演示范围为 ${CIRCUIT_LIMITS.voltageMin}–${CIRCUIT_LIMITS.voltageMax}V。` };
  }
  if (resistance < CIRCUIT_LIMITS.resistanceMin || resistance > CIRCUIT_LIMITS.resistanceMax) {
    return { ok: false, message: `识别到电阻 ${exactNumber(resistance)}Ω，但当前演示范围为 ${CIRCUIT_LIMITS.resistanceMin}–${CIRCUIT_LIMITS.resistanceMax}Ω。` };
  }
  const model = circuitModel(voltage, resistance);
  const circuitSolve = { solveFor, pair, voltage, resistance, current: Number.isFinite(current) ? current : model.current };
  const message = solveFor === "P"
    ? `已识别：${pair.includes("U") ? `电压 ${exactNumber(voltage)}V，` : ""}${pair.includes("I") ? `电流 ${exactNumber(current)}A，` : ""}${pair.includes("R") ? `电阻 ${exactNumber(resistance)}Ω，` : ""}求电功率`
    : solveFor === "R"
    ? `已识别：电压 ${exactNumber(voltage)}V，电流 ${exactNumber(current)}A，求电阻`
    : solveFor === "U"
      ? `已识别：电流 ${exactNumber(current)}A，电阻 ${exactNumber(resistance)}Ω，求电压`
      : given === 3
        ? `已识别：电压 ${exactNumber(voltage)}V，电流 ${exactNumber(current)}A，电阻 ${exactNumber(resistance)}Ω`
        : `已识别：电压 ${exactNumber(voltage)}V，电阻 ${exactNumber(resistance)}Ω`;
  const result = {
    ok: true,
    subject: "物理",
    type: "ohms_law_circuit",
    voltage,
    resistance,
    current: model.current,
    power: model.power,
    solveFor,
    circuitSolve,
    message,
    recognitionText: buildPhysicsCircuitContent(voltage, resistance, circuitSolve).recognitionText
  };
  const check = circuitStrictCheck(text, result);
  return check.ok ? result : { ok: false, message: check.message };
}

window.parsePhysicsCircuitQuestion = parsePhysicsCircuitQuestion;

function parseChemistryFeCuSO4Question(text) {
  const failMessage = "当前化学演示支持铁与硫酸铜的定量反应题，请输入铁的质量和硫酸铜的物质的量（或质量）。";
  const guard = questionGuard();
  if (!guard) return { ok: false, message: failMessage };
  const source = guard.normalize(text);
  if (!/(铁|Fe)/i.test(source) || !/(硫酸铜|CuSO4)/i.test(source)) return { ok: false, message: failMessage };
  const tokens = guard.extractQuantities(source);
  // 数量属于谁：看紧挨着的前后文字（“5.6g 铁粉”“含 0.20mol 硫酸铜”“硫酸铜 16g”）
  const owner = token => {
    const after = source.slice(token.index + token.text.length, token.index + token.text.length + 6);
    const before = source.slice(Math.max(0, token.index - 12), token.index);
    if (/^\s*(?:的)?\s*(?:铁粉|铁|Fe(?!SO))/i.test(after)) return "fe";
    if (/^\s*(?:的)?\s*(?:硫酸铜|CuSO4)/i.test(after)) return "cuso4";
    const label = before.match(/(铁粉|铁|Fe|硫酸铜|CuSO4)\s*(?:粉)?\s*(?:的)?\s*(?:质量|物质的量)?\s*(?:为|是|=|:|：)?\s*$/i);
    if (!label) return "";
    return /硫酸铜|CuSO4/i.test(label[1]) ? "cuso4" : "fe";
  };
  let feMass = null;
  let cuso4Mol = null;
  let feForm = "mass";
  let cuso4Form = "amount";
  for (const token of tokens) {
    const who = owner(token);
    if (who === "fe" && token.cls === "mass" && feMass === null) feMass = token.value * 1000;
    else if (who === "fe" && token.cls === "amount" && feMass === null) { feMass = token.value * CHEMISTRY_CONSTANTS.feMolarMass; feForm = "amount"; }
    else if (who === "cuso4" && token.cls === "amount" && cuso4Mol === null) cuso4Mol = token.value;
    else if (who === "cuso4" && token.cls === "mass" && cuso4Mol === null) { cuso4Mol = token.value * 1000 / 160; cuso4Form = "mass"; }
  }
  if (!Number.isFinite(feMass) || !Number.isFinite(cuso4Mol) || feMass <= 0 || cuso4Mol <= 0) {
    return { ok: false, message: failMessage };
  }
  feMass = guard.tidy(feMass);
  cuso4Mol = guard.tidy(cuso4Mol);
  if (feMass < CHEMISTRY_CONSTANTS.feMassMin || feMass > CHEMISTRY_CONSTANTS.feMassMax) {
    return { ok: false, message: `识别到铁的质量 ${exactNumber(feMass)}g，当前演示范围为 ${CHEMISTRY_CONSTANTS.feMassMin}–${CHEMISTRY_CONSTANTS.feMassMax}g。` };
  }
  if (cuso4Mol < CHEMISTRY_CONSTANTS.cuso4MolMin || cuso4Mol > CHEMISTRY_CONSTANTS.cuso4MolMax) {
    return { ok: false, message: `识别到硫酸铜 ${exactNumber(cuso4Mol)}mol，当前演示范围为 ${CHEMISTRY_CONSTANTS.cuso4MolMin}–${CHEMISTRY_CONSTANTS.cuso4MolMax}mol。` };
  }

  const model = chemistryFeCuSO4Model(feMass, cuso4Mol);
  const chemGiven = { feMass, cuso4Mol, fe: feForm, cuso4: cuso4Form };
  const content = buildChemistryFeCuSO4Content(feMass, cuso4Mol, chemGiven);
  const judgement = chemistryReactionJudgement(model);
  const result = {
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
    chemGiven,
    recognitionText: content.recognitionText,
    message: `已识别：Fe ${feForm === "amount" ? `${exactNumber(feMass / CHEMISTRY_CONSTANTS.feMolarMass)}mol` : `${exactNumber(feMass)}g`}，CuSO₄ ${cuso4Form === "mass" ? `${exactNumber(cuso4Mol * 160)}g` : `${exactNumber(cuso4Mol)}mol`}，${judgement.short}`
  };
  const check = chemistryStrictCheck(text, result);
  return check.ok ? result : { ok: false, message: check.message };
}

function parseMathTangentQuestion(text) {
  const failMessage = "当前数学演示支持函数在给定点处的切线斜率题，例如：y = x²，当 x = 3 时求切线斜率。";
  const guard = questionGuard();
  if (!guard) return { ok: false, message: failMessage };
  const normalized = normalizeQuestionText(text);
  const spec = QUESTION_SPECS.math;
  if (!spec.require.every(pattern => pattern.test(normalized))) return { ok: false, message: failMessage };
  const blocked = spec.forbid.find(pattern => pattern.test(normalized));
  if (blocked) return { ok: false, message: `题目包含“${normalized.match(blocked)[0]}”，超出函数切线模板的范围。` };
  const expressionMatch = matchMathExpression(text);
  if (!expressionMatch) return { ok: false, message: failMessage };
  const expression = expressionMatch.expression;
  if (!/x/i.test(expression)) return { ok: false, message: failMessage };
  const model = createMathModelFromExpression(expression);
  if (!model) return { ok: false, message: "当前只支持一次、二次多项式及 ln x、sin x、cos x、eˣ、√x。" };
  const residueSource = normalized.replace(normalizeQuestionText(expressionMatch.raw), " ");
  const xMatch = residueSource.match(/(?:^|[^A-Za-z])x\s*(?:=|为|是|:|：)\s*(-?\d+(?:\.\d+)?)/i)
    || residueSource.match(/横坐标\s*(?:为|是|=|:|：)\s*(-?\d+(?:\.\d+)?)/);
  const pointMatch = residueSource.match(/[(（]\s*(-?\d+(?:\.\d+)?)\s*[,，]\s*(-?\d+(?:\.\d+)?)\s*[)）]/);
  let x = null;
  if (xMatch) x = Number(xMatch[1]);
  if (pointMatch) {
    const px = Number(pointMatch[1]);
    const py = Number(pointMatch[2]);
    if (x !== null && Math.abs(x - px) > 1e-9) return { ok: false, message: "题目中的观察点不一致。" };
    if (!Number.isFinite(model.value(px)) || Math.abs(model.value(px) - py) > 1e-6) return { ok: false, message: "题目中的点不在该函数图像上。" };
    x = px;
  }
  if (x === null || !Number.isFinite(x)) return { ok: false, message: "请给出观察点的横坐标，例如“当 x = 3 时”。" };
  if (exactPlaces(x, 4) === null) return { ok: false, message: "观察点横坐标最多支持 4 位小数。" };
  const residue = residueSource
    .replace(xMatch?.[0] || "\u0000", " ")
    .replace(pointMatch?.[0] || "\u0000", " ")
    .replace(/[(（]\s*\d\s*[)）]|第\s*\d+\s*(?:问|小题)|[①②③④]/g, " ");
  if (/\d/.test(residue)) return { ok: false, message: "题目中还有函数和观察点以外的数值，超出函数切线模板的范围。" };
  if (x < model.domainMin || x > model.domainMax) {
    return { ok: false, message: `识别到 x = ${formatMathNumber(x)}，但函数 y = ${model.expression} 的当前演示范围为 ${formatMathNumber(model.domainMin)} 到 ${formatMathNumber(model.domainMax)}。` };
  }
  const asks = guard.checkAsks(normalized, spec.asks.supported, spec.asks.unsupported);
  if (!asks.ok) return { ok: false, message: `函数切线模板不能直接回答“${asks.item}”。` };
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
    recognitionText: `函数 y = ${model.expression}｜导数 y′ = ${model.derivativeText}｜x = ${formatMathNumber(x)}｜y ${eqSign(y, 4)} ${formatMathNumber(y)}｜切线斜率 k ${eqSign(slope, 4)} ${formatMathNumber(slope)}`
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

/* ===== 题目解析守卫（2026-10-05）=====
   本地模板只在“题目条件全部被模板用到、所问内容模板能回答、数值在演示范围内”时生成实验；
   否则一律交给 AI，绝不套用默认值或悄悄改动题目数值。公共工具见 physics-extra.js 顶部。 */
function questionGuard() {
  return window.MasterLabQuestionGuard || null;
}

// 精确显示题目给出的数值（最多 4 位小数），避免 12.25 被显示成 12.3
function exactNumber(value, maxDecimals = 4) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return String(Number(number.toFixed(maxDecimals)));
}

const QUESTION_SPECS = {
  brake: {
    name: "刹车",
    forbid: [/斜坡|斜面|坡道|上坡|下坡|倾角|反应时间|反应距离|追及|追上|相遇|两车|甲车|乙车|前车|后车(?!轮)|超车|弯道|转弯|牵引力|功率|动能|做功|启动|加速行驶|匀加速|由静止/, /几倍|倍数|原来的|加倍|翻倍|减半|变为原来|增大到原来|减小到原来/],
    asks: {
      supported: /距离|位移|路程|多远|时间|多久|多长|几秒|停下|停止|停车/,
      unsupported: /末速度|平均速度|速度(?:是|为|大小)?多|加速度(?:是|为|大小)?多|制动力|阻力(?:是|为|大小)?多|摩擦力|动能|功|第\s*\d|质量/
    }
  },
  brakeLinearDrag: {
    name: "线性阻力",
    forbid: [/斜坡|斜面|坡道|倾角|追及|相遇|两车|牵引力|功率|启动|重力|竖直/],
    asks: {
      supported: /极限位移|位移|距离|多远|速度随时间|关系|时间常数|τ|速度变化|v-t|图像/,
      unsupported: /阻力(?:是|为|大小)?多|加速度(?:是|为|大小)?多|动能|功|热量/
    }
  },
  projectile: {
    name: "平抛运动",
    require: [/平抛|水平抛出|水平方向抛出|水平飞出|水平射出|水平速度|水平初速度|沿水平方向|水平扔出|水平抛/],
    forbid: [/竖直上抛|竖直下抛|竖直向上|竖直向下|斜抛|斜向|与水平方向成|与水平面成|仰角|俯角|自由落体|由静止|静止释放|斜面|台阶|墙|碰撞|反弹|两个小球|两球|甲球|乙球|风/],
    asks: {
      supported: /时间|多久|多长|几秒|水平位移|水平距离|水平射程|射程|落点|竖直(?:分)?速度|轨迹/,
      unsupported: /落地速度|速度大小|速度方向|合速度|角|合位移|位移大小|动能|机械能|加速度/
    }
  },
  circuit: {
    name: "欧姆定律",
    forbid: [/串联|并联|R1|R2|R3|两个电阻|两只|滑动变阻器|变阻器|灯泡|小灯|电动机|电炉|电热|内阻|电动势|电源内|电能|焦耳|时间|分钟|小时|秒|量程|短路/],
    asks: { supported: /电流|电阻|电压|阻值|功率/, unsupported: /电能|热量|电荷|电量|时间/ }
  },
  solenoid: {
    name: "通电螺线管",
    forbid: [/条形磁铁|小磁针|磁感应强度|安培力|电动机|发电机|感应电流|如图/,
      /(?:改变|反转|对调|互换|调换|改为相反)[^。？；]{0,6}(?:电流方向|电流的方向|电源(?:的)?正负极|绕(?:线)?方向)|(?:电流方向|电流的方向|电源(?:的)?正负极)[^。？；]{0,6}(?:改变|反转|对调|互换|相反|反过来)/],
    asks: {
      supported: /磁极|N\s*极|S\s*极|极性|哪(?:一)?端|方向|磁性|强弱|增强|减弱|变化/,
      unsupported: /磁感应强度|磁场强度|B(?:的)?大小|力的大小|电流(?:是|为)?多|匝数(?:是|为)?多/
    },
    // “若将电流增大到 1.0A、匝数增加到 400 匝”这类假设变化只做定性比较
    ignore: [(token, source) => (token.cls === "current" || token.cls === "turns")
      && /增大到|增加到|减小到|减少到|变为|改为|换成|增至|减至|提高到|降低到/.test(source.slice(Math.max(0, token.index - 10), token.index))]
  },
  boardSlider: {
    name: "木板—滑块",
    forbid: [/传送带|皮带/],
    asks: {
      supported: /加速度|速度|共速|时间|多久|多长|位移|距离|滑落|滑离|脱离|离开|是否|能否|会不会|多远|位置|摩擦力/,
      unsupported: /热量|生热|内能|动能|功|冲量|动量/
    }
  },
  chemistry: {
    name: "铁与硫酸铜",
    forbid: [/稀硫酸|盐酸|硝酸|硝酸银|锌|铝|镁|银|铜片|铁片|铁钉|溶液质量|溶液的质量|质量分数|溶质|增加|减少|增重|减轻|固体质量|杂质|纯度|含铁|生铁|铁锈|氧化铁|Fe2O3|Fe3O4|氢气|滤渣|滤液|过滤|固体(?:的)?总质量|剩余固体/],
    asks: {
      supported: /铜|Cu|过量|限量|剩余|反应完|完全反应|物质的量|质量|哪种|颜色|现象/,
      unsupported: /FeSO4|硫酸亚铁|溶液(?:的)?质量|质量分数|浓度|体积|气体/
    }
  },
  math: {
    name: "函数切线",
    require: [/切线|斜率|导数|导函数|变化率/],
    forbid: [/方程组|解方程|方程的解|顶点|对称轴|交点|零点|最大值|最小值|最值|极值|单调|面积|周长|体积|三角形|圆|椭圆|双曲线|数列|概率|向量|不等式|切线方程|切线的方程|法线|积分|参数|恒成立|取值范围/],
    asks: {
      supported: /斜率|导数|导函数|变化率|变化|切线|纵坐标|坐标|函数值/,
      unsupported: /方程|截距|倾斜角|夹角|法线|函数(?:值)?(?:随|如何|怎样)|随\s*x\s*(?:的)?增大/
    }
  },
  biology: {
    name: "细胞结构",
    asks: {
      supported: /结构|名称|功能|作用|识别|特点|组成|部位|细胞器|是什么|有哪些/,
      unsupported: /区别|不同|相同|比较|数量|大小|多少/
    }
  }
};

// 主模板统一核对：意图、题中每个量都被用到、所问内容模板能回答
function strictTemplateCheck(text, spec, used = []) {
  const guard = questionGuard();
  if (!guard) return { ok: false, message: "题目解析组件未加载，暂不生成本地实验。" };
  const source = guard.normalize(text);
  if (spec.require && !spec.require.every(pattern => pattern.test(source))) {
    return { ok: false, message: `题目不符合${spec.name}模板的条件。` };
  }
  const blocked = spec.forbid?.find(pattern => pattern.test(source));
  if (blocked) return { ok: false, message: `题目包含“${source.match(blocked)[0]}”，超出${spec.name}模板的建模范围。` };
  const leftovers = guard.unconsumed(source, used, { ignore: spec.ignore });
  if (leftovers.length) return { ok: false, message: `题目中的“${leftovers[0].text}”不在${spec.name}模板的计算范围内。` };
  const asks = guard.checkAsks(source, spec.asks.supported, spec.asks.unsupported);
  if (!asks.ok) return { ok: false, message: `${spec.name}模板不能直接回答“${asks.item}”。` };
  return { ok: true };
}

// 把 72km/h 这类速度换成 m/s 后再交给刹车解析
function convertSpeedUnits(text) {
  return String(text || "").replace(/(\d+(?:\.\d+)?)\s*(?:km\s*\/\s*h|千米\s*\/\s*时|千米每小时|公里每小时|公里\s*\/\s*小时)/gi,
    (_, value) => `${exactNumber(Number(value) / 3.6, 12)}m/s`);
}

function brakeStrictCheck(text, result) {
  if (result.mode === "linear_drag") {
    return strictTemplateCheck(text, QUESTION_SPECS.brakeLinearDrag, [
      { cls: "speed", value: result.v0 },
      { cls: "mass", value: result.mass },
      { cls: "dragK", value: result.k }
    ]);
  }
  if (result.mode === "friction") {
    return strictTemplateCheck(text, QUESTION_SPECS.brake, [
      { cls: "speed", value: result.v0 },
      { cls: "coef", value: result.mu },
      { cls: "g", value: result.gravity }
    ]);
  }
  return strictTemplateCheck(text, QUESTION_SPECS.brake, [
    { cls: "speed", value: result.v0 },
    { cls: "accel", value: result.aAbs, abs: true }
  ]);
}

function projectileStrictCheck(text, result) {
  const guard = questionGuard();
  const source = guard ? guard.normalize(text) : String(text || "");
  if (/空气阻力/.test(source) && !/(?:不计|忽略|不考虑)空气阻力|空气阻力(?:忽略)?不计/.test(source)) {
    return { ok: false, message: "题目要求考虑空气阻力，超出平抛运动模板的建模范围。" };
  }
  return strictTemplateCheck(text, QUESTION_SPECS.projectile, [
    { cls: "speed", value: result.speed },
    { cls: "length", value: result.height },
    { cls: "g", value: result.gravity }
  ]);
}

function circuitStrictCheck(text, result) {
  return strictTemplateCheck(text, QUESTION_SPECS.circuit, [
    { cls: "voltage", value: result.voltage },
    { cls: "resistance", value: result.resistance },
    { cls: "current", value: result.voltage / result.resistance }
  ]);
}

function solenoidStrictCheck(text, result) {
  return strictTemplateCheck(text, QUESTION_SPECS.solenoid, [
    { cls: "current", value: result.current },
    { cls: "turns", value: result.turns }
  ]);
}

function boardSliderStrictCheck(text, result) {
  const used = [
    { cls: "mass", value: result.blockMass },
    { cls: "mass", value: result.boardMass },
    { cls: "length", value: result.boardLength },
    { cls: "speed", value: result.initialSpeed },
    { cls: "coef", value: result.frictionCoefficient }
  ];
  if (!result.gravityWasDefaulted) used.push({ cls: "g", value: result.gravity });
  return strictTemplateCheck(text, QUESTION_SPECS.boardSlider, used);
}

function chemistryStrictCheck(text, result) {
  return strictTemplateCheck(text, QUESTION_SPECS.chemistry, [
    { cls: "mass", value: result.feMass / 1000 },
    { cls: "amount", value: result.feMass / CHEMISTRY_CONSTANTS.feMolarMass },
    { cls: "amount", value: result.cuso4Mol },
    { cls: "mass", value: result.cuso4Mol * 160 / 1000 },
    // 题目附带的标准摩尔质量（Fe 56、Cu 64、CuSO₄ 160 g/mol）与模板一致，可以出现
    { cls: "molarMass", value: CHEMISTRY_CONSTANTS.feMolarMass },
    { cls: "molarMass", value: CHEMISTRY_CONSTANTS.cuMolarMass },
    { cls: "molarMass", value: 160 }
  ]);
}

// 只认“植物细胞/叶肉细胞”和“动物细胞/口腔上皮细胞/人体细胞”的结构识别题；比较题、特化细胞和其他生物知识点交给 AI
function parseBiologyCellQuestion(text) {
  const failMessage = "当前生物演示支持植物细胞或动物细胞的结构识别题。";
  const guard = questionGuard();
  if (!guard) return { ok: false, message: failMessage };
  const source = guard.normalize(text);
  if (!/细胞/.test(source)) return { ok: false, message: failMessage };
  if (!/结构|细胞器|亚显微|显微|模式图|示意图|截面|识别|观察|功能|作用|组成|名称|部位|特点/.test(source)) return { ok: false, message: failMessage };
  const blocked = source.match(/区别|异同|比较|不同点|相同点|对比|分裂|分化|癌|衰老|凋亡|呼吸作用|光合作用的(?:原料|产物|过程|反应式|条件)|物质运输|渗透|吸水|失水|质壁分离|遗传|DNA复制|基因|染色体数|有丝分裂|减数分裂|细菌|病毒|原核|真菌|酵母|血液|循环|消化|神经|激素|免疫|生态|种群|群落|洋葱|根毛|保卫细胞|红细胞|白细胞|精子|卵细胞|肌细胞|肌肉细胞|神经细胞|上皮组织/);
  if (blocked) return { ok: false, message: `题目包含“${blocked[0]}”，超出细胞结构模板的范围。` };
  const plant = /植物细胞|叶肉细胞/.test(source);
  const animal = /动物细胞|口腔上皮细胞|人体细胞|人的细胞/.test(source);
  if (plant === animal) return { ok: false, message: plant ? "题目同时涉及植物细胞和动物细胞，当前模板一次只展示一种细胞。" : failMessage };
  // 动物细胞没有细胞壁、叶绿体和中央大液泡：问它们在动物细胞中的功能是错误前提，交给 AI 讲解
  if (animal && /细胞壁|叶绿体|液泡/.test(source) && !/有没有|是否(?:有|具有|含有)|有无|没有|不含|不具有|无/.test(source)) {
    return { ok: false, message: "动物细胞没有细胞壁、叶绿体和中央大液泡，题目前提需要 AI 讲解。" };
  }
  if (guard.extractQuantities(source).length) return { ok: false, message: "题目中的数量不在细胞结构模板的范围内。" };
  const asks = guard.checkAsks(source, QUESTION_SPECS.biology.asks.supported, QUESTION_SPECS.biology.asks.unsupported);
  if (!asks.ok) return { ok: false, message: `细胞结构模板不能直接回答“${asks.item}”。` };
  return {
    ok: true,
    subject: "生物",
    cellType: plant ? "plant" : "animal",
    cellLevel: normalizeBiologyCellLevel(text, "junior")
  };
}

/* 本地实验规划：只做识别与核对，不改动页面状态。generateExperiment 和题库测试共用。 */
function planLocalExperiment(question, context = {}) {
  const subjectContext = context.subject ?? state.subject;
  const templateContext = context.physicsTemplate ?? state.physicsTemplate;
  const presetQuestion = context.presetQuestion ?? SUBJECTS[subjectContext]?.question;
  const strictSubject = presetQuestion && question === presetQuestion ? subjectContext : detectSubjectStrict(question);
  const detected = strictSubject || subjectContext;
  const failures = [];
  const attempt = (kind, parse, extra = {}) => {
    if (parse?.ok) return { ok: true, subject: detected, kind, parse, ...extra };
    failures.push(parse || { ok: false });
    return null;
  };

  if (detected === "物理") {
    const boardSliderCandidate = isPhysicsBoardSliderQuestion(question);
    const solenoidCandidate = /螺线管|电磁铁|磁极|安培定则|线圈|匝|铁芯|磁感线/.test(question);
    const projectileCandidate = /平抛|水平抛|水平速度|水平位移|落地|抛出|平台/.test(question);
    const circuitCandidate = /欧姆|电压|电阻|电流|纯电阻|电路|Ω|V\b/.test(question);
    const brakeCandidate = /刹车|制动|停车|停下|停止距离|极限位移|(?:f|F)(?:阻)?\s*(?:=|＝)\s*-?\s*k\s*v/i.test(question);
    const normalizedQuestion = normalizeQuestionText(question);
    const extraIds = boardSliderCandidate || brakeCandidate ? [] : [
      ...(isExtraPhysicsTemplate(templateContext) && EXTRA_PHYSICS_TEMPLATES[templateContext].keywords?.test(normalizedQuestion) ? [templateContext] : []),
      ...EXTRA_PHYSICS_IDS.filter(id => EXTRA_PHYSICS_TEMPLATES[id].keywords?.test(normalizedQuestion))
    ].filter((id, index, list) => list.indexOf(id) === index);

    if (boardSliderCandidate) {
      const plan = attempt("boardSlider", parsePhysicsBoardSliderQuestion(question));
      if (plan) return plan;
    } else if (solenoidCandidate) {
      const plan = attempt("solenoid", parsePhysicsSolenoidQuestion(question));
      if (plan) return plan;
    } else if (projectileCandidate) {
      const plan = attempt("projectile", parsePhysicsProjectileQuestion(question));
      if (plan) return plan;
    }
    if (!boardSliderCandidate && !solenoidCandidate) {
      for (const id of extraIds) {
        const plan = attempt("extra", parseExtraPhysicsQuestion(question, id), { templateId: id });
        if (plan) return plan;
      }
      if (circuitCandidate) {
        const plan = attempt("circuit", parsePhysicsCircuitQuestion(question));
        if (plan) return plan;
      }
      if (!projectileCandidate || brakeCandidate) {
        const plan = attempt("brake", parsePhysicsBrakeQuestion(question));
        if (plan) return plan;
      }
    }
  }
  if (detected === "化学") {
    const plan = attempt("chemistry", parseChemistryFeCuSO4Question(question));
    if (plan) return plan;
  }
  if (detected === "数学") {
    const plan = attempt("math", parseMathTangentQuestion(question));
    if (plan) return plan;
  }
  if (detected === "生物") {
    const plan = attempt("biology", parseBiologyCellQuestion(question));
    if (plan) return plan;
  }
  const generic = { ok: false, message: "当前题目没有匹配到本地实验模板。" };
  return { ok: false, subject: detected, parse: strictSubject ? failures[0] || generic : generic };
}

// 用已规划的模板与数值核对另一道题（AI 改写后的题目要回到原题核对）
function planFitsQuestion(plan, text) {
  const parse = plan.parse;
  switch (plan.kind) {
    case "extra":
      return EXTRA_PHYSICS_TEMPLATES[plan.templateId].checkQuestion(text, parse.p1, parse.p2, parse.fixed);
    case "brake":
      return brakeStrictCheck(text, parse);
    case "projectile":
      return projectileStrictCheck(text, parse);
    case "circuit":
      return circuitStrictCheck(text, parse);
    case "boardSlider":
      return boardSliderStrictCheck(text, parse);
    case "chemistry":
      return chemistryStrictCheck(text, parse);
    case "solenoid": {
      const own = parsePhysicsSolenoidQuestion(text);
      const same = own.ok && own.viewEnd === parse.viewEnd && own.windingDirection === parse.windingDirection && own.hasCore === parse.hasCore
        && Math.abs(own.current - parse.current) < 1e-9 && Math.abs(own.turns - parse.turns) < 1e-9;
      return same ? { ok: true } : { ok: false, message: "螺线管的观察端、绕向或数值与原题不一致。" };
    }
    case "math": {
      const own = parseMathTangentQuestion(text);
      const same = own.ok && own.expression === parse.expression && Math.abs(own.x - parse.x) < 1e-9;
      return same ? { ok: true } : { ok: false, message: "函数或观察点与原题不一致。" };
    }
    case "biology": {
      const own = parseBiologyCellQuestion(text);
      return own.ok && own.cellType === parse.cellType ? { ok: true } : { ok: false, message: "细胞类型与原题不一致。" };
    }
    default:
      return { ok: false, message: "未知模板。" };
  }
}

// AI 把题目改写成本地模板题后，必须仍与原题的全部条件一致才生成实验
function mappedPlanFitsOriginal(originalQuestion, mappedQuestion) {
  const plan = planLocalExperiment(mappedQuestion, { subject: "", physicsTemplate: "", presetQuestion: "" });
  if (!plan.ok) return false;
  return planFitsQuestion(plan, originalQuestion).ok;
}

window.planLocalExperiment = planLocalExperiment;
window.mappedPlanFitsOriginal = mappedPlanFitsOriginal;

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
    const reaction = ScienceMotion.reactionAt(chem, progress);
    return { progress, metrics: [chem.feMass, reaction.producedMol, reaction.producedMass], chem, reaction };
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
  if (state.subject === "数学" && index < 3) return formatMathNumber(value);
  if (state.subject === "生物" && index < 2) return Number(value).toFixed(0);
  if (state.subject === "物理" && state.physicsTemplate === "projectile") {
    const model = projectileModel();
    if (index === 0) return smartNumber(value, 1);
    const places = exactPlaces(index === 1 ? model.fallTime : model.range, 4);
    const base = index === 1 ? 2 : 1;
    return Number(value).toFixed(places === null ? base : clamp(places, base, 4));
  }
  if (state.subject === "物理" && state.physicsTemplate === "circuit") {
    if (index === 2) return smartNumber(value, 2);
    return smartNumber(value, 1);
  }
  if (state.subject === "物理" && state.physicsTemplate === "boardSlider") return smartNumber(value, index === 2 ? 3 : 2);
  if (state.subject === "物理" && state.physicsTemplate === "brake") {
    const model = physicsBrakeModel();
    // 线性阻力动画在 v = 1%v₀ 结束：速度读数的位数跟随这个终点速度
    const reference = index === 0 && model.mode === "linear_drag" ? model.practicalSpeed : [model.v0, model.stopDistance, model.duration][index];
    const places = exactPlaces(reference, 4);
    return Number(value).toFixed(places === null ? (index === 2 ? 2 : 1) : clamp(places, 1, 4));
  }
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

function mathNiceStep(range, target = 6) {
  const raw = Math.max(Math.abs(range) / target, 1e-6);
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}

function mathTickText(value, step) {
  const decimals = step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step)));
  const text = Number(value.toFixed(decimals)).toString();
  return text.replace("-", "−");
}

// One pixel-exact coordinate system for axes, curve, tangent and point (textbook style: O, x, y, arrows).
function renderMathGraph(model = currentMathModel(), x = state.p1) {
  const svg = elements.mathGraph;
  if (!svg) return;
  state.mathGraphX = x;
  const width = Math.max(260, Math.round(svg.clientWidth || 600));
  const height = Math.max(170, Math.round(svg.clientHeight || 280));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const bounds = mathGraphBounds(model);
  const pad = { left: 30, right: 30, top: 18, bottom: 22 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const sx = value => pad.left + ((value - bounds.minX) / (bounds.maxX - bounds.minX)) * plotW;
  const sy = value => pad.top + ((bounds.maxY - value) / (bounds.maxY - bounds.minY)) * plotH;
  const fx = value => Number(value.toFixed(2));
  const within = (value, min, max) => value >= min && value <= max;
  const axisY = within(0, bounds.minY, bounds.maxY) ? sy(0) : sy(bounds.minY > 0 ? bounds.minY : bounds.maxY);
  const axisX = within(0, bounds.minX, bounds.maxX) ? sx(0) : sx(bounds.minX);
  const xStep = mathNiceStep(bounds.maxX - bounds.minX, width < 420 ? 5 : 8);
  const yStep = mathNiceStep(bounds.maxY - bounds.minY, height < 230 ? 4 : 6);
  const parts = [];
  parts.push(`<defs><clipPath id="mathPlotClip"><rect x="${pad.left}" y="${pad.top}" width="${fx(plotW)}" height="${fx(plotH)}"/></clipPath>
    <marker id="mathAxisArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z"/></marker></defs>`);

  const grid = [];
  const ticks = [];
  for (let v = Math.ceil(bounds.minX / xStep) * xStep; v <= bounds.maxX + 1e-9; v += xStep) {
    const px = fx(sx(v));
    grid.push(`M${px} ${pad.top}V${fx(pad.top + plotH)}`);
    if (Math.abs(v) < xStep / 1000) continue;
    ticks.push(`<path class="math-tick-mark" d="M${px} ${fx(axisY - 3)}V${fx(axisY + 3)}"/><text class="math-tick-label" x="${px}" y="${fx(Math.min(axisY + 15, height - 4))}" text-anchor="middle">${mathTickText(v, xStep)}</text>`);
  }
  for (let v = Math.ceil(bounds.minY / yStep) * yStep; v <= bounds.maxY + 1e-9; v += yStep) {
    const py = fx(sy(v));
    grid.push(`M${pad.left} ${py}H${fx(pad.left + plotW)}`);
    if (Math.abs(v) < yStep / 1000) continue;
    ticks.push(`<path class="math-tick-mark" d="M${fx(axisX - 3)} ${py}H${fx(axisX + 3)}"/><text class="math-tick-label" x="${fx(Math.max(axisX - 6, 12))}" y="${fx(py + 4)}" text-anchor="end">${mathTickText(v, yStep)}</text>`);
  }
  parts.push(`<path class="math-grid-line" d="${grid.join("")}"/>`);
  parts.push(`<path class="math-axis-line" d="M${pad.left - 6} ${fx(axisY)}H${fx(pad.left + plotW + 16)}" marker-end="url(#mathAxisArrow)"/>`);
  parts.push(`<path class="math-axis-line" d="M${fx(axisX)} ${fx(pad.top + plotH + 6)}V${pad.top - 12}" marker-end="url(#mathAxisArrow)"/>`);
  parts.push(`<text class="math-axis-name" x="${fx(pad.left + plotW + 18)}" y="${fx(axisY - 7)}">x</text>`);
  parts.push(`<text class="math-axis-name" x="${fx(axisX + 8)}" y="${pad.top - 4}">y</text>`);
  if (within(0, bounds.minX, bounds.maxX) && within(0, bounds.minY, bounds.maxY)) {
    parts.push(`<text class="math-origin" x="${fx(axisX - 5)}" y="${fx(axisY + 14)}" text-anchor="end">O</text>`);
  }
  parts.push(ticks.join(""));

  const samples = [];
  let started = false;
  let lastPoint = null;
  let firstPoint = null;
  for (let i = 0; i <= 240; i += 1) {
    const vx = bounds.minX + ((bounds.maxX - bounds.minX) * i) / 240;
    const vy = model.value(vx);
    if (!Number.isFinite(vy)) {
      started = false;
      continue;
    }
    samples.push(`${started ? "L" : "M"}${fx(sx(vx))} ${fx(sy(vy))}`);
    started = true;
    lastPoint = [sx(vx), sy(vy)];
    if (!firstPoint && vy <= bounds.maxY && vy >= bounds.minY) firstPoint = [sx(vx), sy(vy)];
  }
  const y0 = model.value(x);
  const slope = model.derivative(x);
  const hasPoint = Number.isFinite(y0);
  const plot = [`<path class="math-curve" d="${samples.join(" ")}"/>`];
  const slopeText = [];
  let triangleDir = 0;
  if (hasPoint && Number.isFinite(slope)) {
    const t1 = y0 + slope * (bounds.minX - x);
    const t2 = y0 + slope * (bounds.maxX - x);
    plot.push(`<line class="math-tangent" x1="${fx(sx(bounds.minX))}" y1="${fx(sy(t1))}" x2="${fx(sx(bounds.maxX))}" y2="${fx(sy(t2))}"/>`);
    // Slope triangle: run Δx = one grid step, rise Δy = k·Δx along the tangent.
    const run = xStep;
    const dir = x + run <= bounds.maxX ? 1 : -1;
    triangleDir = dir;
    const xEnd = x + dir * run;
    const yEnd = y0 + slope * dir * run;
    if (within(xEnd, bounds.minX, bounds.maxX) && within(yEnd, bounds.minY, bounds.maxY) && Math.abs(sy(yEnd) - sy(y0)) > 8) {
      const px = sx(x);
      const py = sy(y0);
      const qx = sx(xEnd);
      const qy = sy(yEnd);
      plot.push(`<path class="math-slope-triangle" d="M${fx(px)} ${fx(py)}H${fx(qx)}V${fx(qy)}"/>`);
      slopeText.push(`<text class="math-slope-text" x="${fx((px + qx) / 2)}" y="${fx(py + (qy < py ? 14 : -6))}" text-anchor="middle">Δx = ${mathTickText(run, xStep)}</text>`);
      const riseRight = dir > 0 ? qx + 6 + 60 < width : qx - 6 - 60 < 0;
      slopeText.push(`<text class="math-slope-text" x="${fx(riseRight === (dir > 0) ? qx + 6 : qx - 6)}" y="${fx((py + qy) / 2 + 4)}" text-anchor="${riseRight === (dir > 0) ? "start" : "end"}">Δy ${eqSign(slope * run, 4)} ${formatMathNumber(slope * run)}</text>`);
    }
  }
  parts.push(`<g clip-path="url(#mathPlotClip)">${plot.join("")}</g>${slopeText.join("")}`);
  if (lastPoint && firstPoint) {
    // Put the function name at the curve end farther from P so it never sits on the slope triangle.
    const pointX = hasPoint ? sx(x) : width / 2;
    const useLeft = Math.abs(firstPoint[0] - pointX) > Math.abs(lastPoint[0] - pointX);
    const end = useLeft ? firstPoint : lastPoint;
    const labelY = fx(Math.max(Math.min(end[1] + (end[1] < height / 2 ? 18 : -10), height - 26), 14));
    parts.push(`<text class="math-function-label" x="${fx(useLeft ? Math.max(end[0] + 6, 8) : Math.min(end[0] - 6, width - 8))}" y="${labelY}" text-anchor="${useLeft ? "start" : "end"}">y = ${model.expression}</text>`);
  }
  if (hasPoint) {
    const px = sx(x);
    const py = sy(y0);
    parts.push(`<path class="math-projection" d="M${fx(px)} ${fx(py)}V${fx(axisY)}M${fx(px)} ${fx(py)}H${fx(axisX)}"/>`);
    parts.push(`<circle class="math-point" cx="${fx(px)}" cy="${fx(py)}" r="6.5"/>`);
    const labelRight = triangleDir > 0 ? px - 110 < pad.left : px < pad.left + plotW - 90;
    parts.push(`<text class="math-point-label" x="${fx(px + (labelRight ? 11 : -11))}" y="${fx(py - 10)}" text-anchor="${labelRight ? "start" : "end"}">P(${formatMathNumber(x)}, ${formatMathNumber(y0)})</text>`);
  }
  svg.innerHTML = parts.join("");
  try {
    const keep = [...svg.querySelectorAll(".math-slope-text, .math-point-label, .math-function-label")].map(node => node.getBBox());
    svg.querySelectorAll(".math-tick-label").forEach(label => {
      const box = label.getBBox();
      const hit = keep.some(other => box.x < other.x + other.width + 3 && other.x < box.x + box.width + 3 && box.y < other.y + other.height + 1 && other.y < box.y + box.height + 1);
      if (hit) label.remove();
    });
  } catch {
    // 不可见时无法测量，保持原样
  }
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

function solenoidRenderState(time = solenoidMotionTime) {
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
    time
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

// 线圈画得很小时（窄屏），磁针、磁极圆和回形针随之缩小，磁针标注不再被磁极圆盖住
function solenoidGlyphScale(renderState, bounds) {
  const scale = renderState.zoom * Math.min(bounds.width / 780, bounds.height / 500) * 1.12;
  return clamp(scale / 0.42, 0.68, 1);
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

// Fixed world-space samples are shared between frames; only projection and styling change.
// Four planes so the closed field lines appear on both sides of the coil, as in the textbook figure.
const solenoidFieldGeometry = [0, Math.PI / 2, Math.PI, Math.PI * 1.5].map(plane => ({
  plane,
  lines: [98, 136, 174].map(radius => ({
    radius,
    points: Array.from({ length: 101 }, (_, i) => solenoidFieldPoint(i / 100 * Math.PI * 2, radius, plane))
  }))
}));

function drawSolenoidFieldLines(ctx, renderState, bounds) {
  const relative = Math.min(2.4, (renderState.current / 0.5) * (renderState.turns / 200) * (renderState.core ? 1.65 : 1));
  const alpha = 0.18 + Math.min(0.42, relative * 0.14);
  // Keep the field geometry fixed; strength changes line opacity and width.
  solenoidFieldGeometry.forEach(({ plane, lines }) => {
    lines.forEach(({ radius, points }, index) => {
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
  const k = solenoidGlyphScale(renderState, bounds);
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.scale(k, k);
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
  ctx.font = `800 ${(10 * Math.max(k, 0.8)).toFixed(1)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("磁针", center.x, center.y + 27 * k);
  ctx.restore();
}

function drawSolenoidPoleLabel(ctx, world, pole, renderState, bounds) {
  const point = projectSolenoidPoint(world, renderState, bounds);
  const k = solenoidGlyphScale(renderState, bounds);
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.scale(k, k);
  ctx.font = "900 22px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const gradient = ctx.createLinearGradient(-22, -22, 22, 22);
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
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(255,255,255,.9)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.fillText(pole, 0, 1);
  ctx.restore();
}

function drawSolenoidClips(ctx, renderState, bounds) {
  const pull = 1 + renderState.strength * 38;
  const baseX = 300 - pull;
  const opacity = 0.32 + renderState.strength * 0.55;
  const k = solenoidGlyphScale(renderState, bounds);
  ctx.save();
  ctx.globalAlpha = opacity;
  for (let i = 0; i < 4; i += 1) {
    const p = projectSolenoidPoint({ x: baseX + i * 18, y: 76 + (i % 2) * 9, z: 10 }, renderState, bounds);
    ctx.strokeStyle = "rgba(74, 91, 117, .78)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 5 * k, 15 * k, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSolenoidCanvas(time = solenoidMotionTime) {
  if (document.hidden || !state.hasGenerated || state.subject !== "物理" || state.physicsTemplate !== "solenoid") return;
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

// One clock owns all ongoing scene motion. Pending callbacks never outlive their scene.
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
let solenoidMotionTime = 0;
let cellSweepDirection = 1;
let circuitMotion = null;
const circuitPhases = new Map();
function activeSolenoid() { return state.hasGenerated && state.subject === "物理" && state.physicsTemplate === "solenoid"; }
const animationClock = ScienceMotion.createClock({
  request: callback => requestAnimationFrame(callback),
  cancel: id => cancelAnimationFrame(id),
  active: () => !document.hidden && !location.hash.startsWith("#/ai-tutor") && state.hasGenerated && (state.playing || (!motionPreference.matches && (
    (activeSolenoid() && !state.solenoidPaused) ||
    (state.subject === "生物" && state.cellAutoRotate) ||
    (state.subject === "物理" && circuitMotion?.current > 0 && circuitMotion.closed)
  ))),
  render: dt => {
    if (state.playing) {
      state.time = Math.min(duration(), state.time + dt * state.playbackRate * experimentPlaybackTimeScale());
      updateScene();
    }
    if (motionPreference.matches) return;
    if (activeSolenoid() && !state.solenoidPaused) {
      solenoidMotionTime += dt * 1000;
      drawSolenoidCanvas();
    }
    if (state.subject === "物理" && circuitMotion) {
      circuitMotion.render(dt);
      circuitPhases.set(state.physicsTemplate, circuitMotion.phase);
    }
    if (state.subject === "生物" && state.cellAutoRotate) {
      const next = state.cellRotateY + cellSweepDirection * dt * 12;
      if (Math.abs(next) >= 45) cellSweepDirection *= -1;
      setCellRotation(state.cellRotateX, next);
      syncBiologyRotationUi();
    }
  }
});

function syncCircuitMotion(values) {
  let svg = null;
  let current = 0;
  if (state.subject === "物理" && state.physicsTemplate === "circuit") {
    svg = $("#circuitStage .edu-circuit-svg");
    if (!svg.querySelector(".current-loop")) svg.insertAdjacentHTML("beforeend", ScienceMotion.circuitMarkup("M110 125V60H238L282 50L294 60H610V220H110V125Z"));
    current = values.circuit.current;
  } else if (state.subject === "物理" && ["lampPower", "seriesCircuit"].includes(state.physicsTemplate)) {
    svg = elements.genericPhysicsVisual.querySelector(".edu-circuit-svg");
    current = values.extraPhysics.model.metrics[state.physicsTemplate === "lampPower" ? 1 : 2];
  }
  if (!svg) { circuitMotion = null; return; }
  if (circuitMotion?.svg !== svg) circuitMotion = ScienceMotion.bindCircuit(svg, circuitPhases.get(state.physicsTemplate) || 0);
  circuitMotion.current = current;
  circuitMotion.render(0, motionPreference.matches);
}

function renderProjectile(values) {
  const model = values.projectile;
  const g = ScienceMotion.projectileGeometry(model, model.t);
  const attr = (id, attributes) => { const node = $(id); for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value); };
  attr("#projectileBall", { cx: g.point.x, cy: g.point.y });
  attr("#projectilePlatform", { d: `M48 210V${g.origin.y + 10}H80V210` });
  attr("#projectilePath", { d: g.trail });
  attr("#projectilePrediction", { d: g.prediction });
  const ghosts = $("#projectileGhosts");
  // Only rebuild when another fixed-time sample becomes visible or geometry changes.
  const ghostKey = `${model.speed}/${model.height}/${g.ghosts.length}`;
  if (ghosts.dataset.key !== ghostKey) {
    ghosts.dataset.key = ghostKey;
    ghosts.innerHTML = g.ghosts.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3"/>`).join("");
  }
  attr("#projectileVelocity", { transform: `translate(${g.point.x} ${g.point.y})` });
  attr("#projectileVx", { d: `M0 0H${g.dx}` });
  attr("#projectileVy", { d: `M0 0V${g.dy}`, visibility: g.dy > 0 ? "visible" : "hidden" });
  attr("#projectileV", { d: `M0 0L${g.dx} ${g.dy}`, visibility: g.dy > 0 ? "visible" : "hidden" });
  attr("#projectileVxLabel", { x: g.dx + 8, y: -6 });
  attr("#projectileVyLabel", { x: -24, y: g.dy + 14, visibility: g.dy > 0 ? "visible" : "hidden" });
  attr("#projectileVLabel", { x: g.dx + 8, y: g.dy + 12, visibility: g.dy > 0 ? "visible" : "hidden" });
  $("#projectileVelocityNote").textContent = `vₓ = ${smartNumber(g.vx)} m/s    vᵧ = ${Number(g.vy).toFixed(1)} m/s ↓    |v| = ${Number(Math.hypot(g.vx, g.vy)).toFixed(1)} m/s`;
  $("#projectileMobileVectors").textContent = $("#projectileVelocityNote").textContent;
  elements.projectileHeightText.textContent = `${smartNumber(model.height)} m`;
  // 实时读数的位数随本题答案而定，播放到终点时与结论完全一致
  const tPlaces = exactPlaces(model.fallTime, 4);
  const xPlaces = exactPlaces(model.range, 4);
  elements.projectileResultText.textContent = `t = ${Number(g.t).toFixed(tPlaces === null ? 2 : clamp(tPlaces, 2, 4))}s，x = ${Number(model.x).toFixed(xPlaces === null ? 1 : clamp(xPlaces, 1, 4))}m`;
  elements.projectileTimeText.textContent = `${smartNumber(model.fallTime, 2)}s`;
  elements.projectileRangeText.textContent = `${smartNumber(model.range, 1)}m`;
  elements.projectileVyText.textContent = `${smartNumber(model.verticalSpeed, 1)}m/s`;
}

document.addEventListener("visibilitychange", () => {
  document.body.classList.toggle("motion-suspended", document.hidden);
  animationClock.reconcile();
});
window.addEventListener("hashchange", () => animationClock.reconcile());
motionPreference.addEventListener("change", () => {
  setCellAutoRotate(false);
  if (state.hasGenerated) updateScene();
  animationClock.reconcile();
});

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
    const noseOffsetPx = carNoseOffsetPx();
    const visualMax = physicsVisualDistanceMax(model.stopDistance);
    // 车头起点就是刻度 0 m；停止线在刻度上的读数等于停止距离
    const startNosePx = (physicsDistanceLeftPercent(0, visualMax) / 100) * roadWidth;
    const startLeftPx = startNosePx - noseOffsetPx;
    const startTracePx = startLeftPx + roadWidth * 0.01;
    const stopNosePx = Math.max(startNosePx, physicsStopLeftPx(model.stopDistance));
    const layoutKey = `${Math.round(roadWidth)}|${Math.round(noseOffsetPx)}|${model.stopDistance}`;
    if (elements.ruler && elements.ruler.dataset.layout !== layoutKey) {
      // 路面宽度变化（窗口、全屏、首次显示）后，刻度和停止线随之重新定位
      elements.ruler.dataset.layout = layoutKey;
      setPhysicsStopMarker(model.stopDistance);
    }
    const nosePx = startNosePx + (stopNosePx - startNosePx) * (values.experimentProgress ?? values.progress);
    const carLeftPx = nosePx - noseOffsetPx;
    const wheelRadius = (elements.car.querySelector(".wheel")?.offsetWidth || 17) / 2;
    elements.car.style.left = `${carLeftPx}px`;
    // The friction preset explicitly locks the wheels; rolling presets use s = rθ.
    elements.car.style.setProperty("--wheel-angle", `${model.mode === "friction" ? 0 : (carLeftPx - startLeftPx) / wheelRadius}rad`);
    elements.brakeTrace.style.left = `${startTracePx}px`;
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
    // Active animation paints on its next frame; paused/manual changes paint once.
    if (state.solenoidPaused || motionPreference.matches) drawSolenoidCanvas();
  }

  if (state.subject === "物理" && state.physicsTemplate === "projectile") {
    renderProjectile(values);
  }

  if (state.subject === "物理" && state.physicsTemplate === "circuit") {
    const model = values.circuit || circuitModel();
    elements.scene.style.setProperty("--circuit-current", String(clamp(model.current / 4, 0.12, 1)));
    elements.scene.style.setProperty("--circuit-speed", `${3.8 - clamp(model.current / 4, 0.12, 1) * 1.9}s`);
    if (elements.circuitVoltageText) elements.circuitVoltageText.textContent = `U = ${smartNumber(model.voltage)}V`;
    if (elements.circuitVoltmeterText) elements.circuitVoltmeterText.textContent = `${smartNumber(model.voltage)}V`;
    if (elements.circuitResistanceText) elements.circuitResistanceText.textContent = `R = ${smartNumber(model.resistance)}Ω`;
    if (elements.circuitCurrentText) elements.circuitCurrentText.textContent = `${smartNumber(model.current, 2)}A`;
    if (elements.circuitResultText) elements.circuitResultText.textContent = circuitResultLine(model);
    if (elements.circuitReadoutVoltage) elements.circuitReadoutVoltage.textContent = `${smartNumber(model.voltage)}V`;
    if (elements.circuitReadoutResistance) elements.circuitReadoutResistance.textContent = `${smartNumber(model.resistance)}Ω`;
    if (elements.circuitReadoutCurrent) elements.circuitReadoutCurrent.textContent = `${smartNumber(model.current, 2)}A`;
    if (elements.circuitPowerText) elements.circuitPowerText.textContent = `${smartNumber(model.power, 2)}W`;
    if (elements.circuitResistor) {
      elements.circuitResistor.style.setProperty("--resistor-heat", String(model.brightness));
    }
  }

  if (state.subject === "物理" && isExtraPhysicsTemplate()) {
    renderExtraPhysicsVisual(values.extraPhysics || buildExtraPhysicsContent());
  }

  if (state.subject === "化学") {
    const r = values.reaction;
    const convertedFraction = values.chem.cuso4Mol > 0 ? r.producedMol / values.chem.cuso4Mol : 0;
    const color = [45, 148, 229].map((start, i) => Math.round(start + ([166, 215, 181][i] - start) * convertedFraction));
    elements.scene.style.setProperty("--iron-drop", String(r.contact));
    elements.scene.style.setProperty("--chem-reaction-progress", String(r.extent));
    elements.cuso4Solution.style.setProperty("--cuso4-color", `rgb(${color.join(",")})`);
    $("#ironWire").style.opacity = String(values.chem.feMol ? r.feLeftMol / values.chem.feMol : 0);
    $("#copperCoating").style.opacity = String(r.extent);
    $("#copperCoating").style.strokeWidth = String(2 + r.producedMol / CHEMISTRY_CONSTANTS.cuso4MolMax * 8);
    $(".chem-label span").textContent = "反应完成度";
    $("#chemRate").textContent = `${Math.round(r.extent * 100)}%`;
    $("#chemPhase").textContent = r.stage;
    $("#chemAmounts").textContent = `已生成 Cu ${formatMol(r.producedMol)} mol / ${formatGram(r.producedMass)} g · Fe 剩余 ${formatMol(r.feLeftMol)} mol · CuSO₄ 剩余 ${formatMol(r.cuso4Left)} mol`;
  }

  if (state.subject === "数学") {
    const x = values.x;
    const model = currentMathModel();
    const slope = model.derivative(x);
    renderMathGraph(model, x);
    $("#mathCoordinate").textContent = `(${formatMathNumber(x)}, ${formatMathNumber(model.value(x))})`;
    const slopeNote = $("#mathSlopeNote");
    if (slopeNote) slopeNote.textContent = `切线斜率 k = f′(${formatMathNumber(x)}) ${eqSign(slope, 4)} ${formatMathNumber(slope)}`;
  }

  if (state.subject === "生物") renderCellDetail(state.selectedOrganelle);
  syncCircuitMotion(values);
  animationClock.reconcile();
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
        const vyAsked = projectileAskFor(values.projectile).vy;
        const vy = values.projectile.verticalSpeed;
        conclusion = `小球${aboutText(values.projectile.fallTime) ? "约" : "经"} ${smartNumber(values.projectile.fallTime, 2)} 秒落地，水平位移${aboutText(values.projectile.range) ? "约为" : "为"} ${smartNumber(values.projectile.range, 1)} 米${vyAsked ? `，落地时竖直分速度${aboutText(vy) ? "约为" : "为"} ${smartNumber(vy, 1)}m/s` : ""}。`;
      } else if (state.physicsTemplate === "circuit") {
        const asked = circuitAskedForm(values.circuit.voltage, values.circuit.resistance);
        const powerText = `纯电阻消耗功率 P ${eqSign(values.circuit.power)} ${smartNumber(values.circuit.power, 2)}W`;
        conclusion = asked?.solveFor === "P"
          ? `电阻消耗的电功率 ${asked.pair === "UR" ? "P = U²/R" : asked.pair === "IR" ? "P = I²R" : "P = UI"} ${eqSign(values.circuit.power)} ${smartNumber(values.circuit.power, 2)}W。`
          : asked?.solveFor === "R"
          ? `待测电阻 R = U/I ${eqSign(values.circuit.resistance)} ${smartNumber(values.circuit.resistance)}Ω，${powerText}。`
          : asked?.solveFor === "U"
            ? `电阻两端电压 U = IR ${eqSign(values.circuit.voltage)} ${smartNumber(values.circuit.voltage)}V，${powerText}。`
            : `电路电流 I ${eqSign(values.circuit.current)} ${smartNumber(values.circuit.current, 2)}A，${powerText}。`;
      } else if (isExtraPhysicsTemplate() && values.extraPhysics) {
        conclusion = values.extraPhysics.model.conclusion;
      } else {
        const brake = values.brake || physicsBrakeModel();
        if (brake.mode === "linear_drag") {
          conclusion = `经过约 ${smartNumber(brake.duration, 2)} 秒，速度衰减到初速度的 1%，位移${aboutText(brake.practicalDistance) ? "约为" : "为"} ${smartNumber(brake.practicalDistance, 1)} 米；理论极限位移${aboutText(brake.stopDistance) ? "约为" : "为"} ${smartNumber(brake.stopDistance)} 米，速度只会渐近于 0。`;
        } else if (brake.mode === "friction") {
          conclusion = `由滑动摩擦产生 ${aboutText(brake.aAbs)}${plainNumber(brake.aAbs, 2)}m/s² 的减速度，车辆${aboutText(brake.duration) ? "约" : "在"} ${smartNumber(brake.duration, 2)} 秒后停止，刹车距离${aboutText(brake.stopDistance) ? "约为" : "为"} ${smartNumber(brake.stopDistance, 1)} 米。`;
        } else {
          conclusion = `车辆${aboutText(brake.duration) ? "约" : "在"} ${smartNumber(brake.duration, 2)} 秒后停止，刹车距离${aboutText(brake.stopDistance) ? "约为" : "为"} ${smartNumber(brake.stopDistance, 1)} 米。`;
        }
      }
    } else if (state.subject === "化学" && values.chem) {
      const cuAbout = eqSign(values.chem.cuMol, 4) === "≈" || eqSign(values.chem.cuMass, 3) === "≈" ? "约 " : "";
      const chem = values.chem;
      const leftText = chem.feLeftMol > 1e-12
        ? `Fe 剩余 ${aboutText(chem.feLeftMol, 4)}${formatMol(chem.feLeftMol)}mol（${formatGram(chem.feLeftMol * CHEMISTRY_CONSTANTS.feMolarMass)}g）`
        : chem.cuso4Left > 1e-12 ? `CuSO₄ 剩余 ${aboutText(chem.cuso4Left, 4)}${formatMol(chem.cuso4Left)}mol（${formatGram(chem.cuso4Left * 160)}g）` : "二者均无剩余";
      conclusion = `铁表面析出红色铜；${chem.cuso4Left > 0 ? "CuSO₄ 仍有剩余，保留蓝色" : "CuSO₄ 耗尽，溶液呈浅绿色"}；${chemistryReactionJudgement(chem).short}，生成 Cu ${cuAbout}${formatMol(chem.cuMol)}mol / ${formatGram(chem.cuMass)}g；${leftText}。`;
    } else if (state.subject === "数学") {
      const slopeNow = currentMathModel().derivative(state.p1);
      conclusion = `函数 y = ${currentMathModel().expression}；当 x = ${formatMathNumber(state.p1)} 时，切线斜率 k ${eqSign(slopeNow, 4)} ${formatMathNumber(slopeNow)}。`;
    } else if (state.subject === "生物") {
      conclusion = `已完成${state.cellType === "animal" ? "动物" : "植物"}细胞截面识别，可点击结构查看名称、类型和功能。`;
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
        "先看边界，再辨结构",
        `<span class="bio-concept-line"><b>边界</b>细胞膜</span>
         <span class="bio-concept-line"><b>内部</b>细胞质、细胞核及其他结构</span>
         <span class="bio-concept-line"><b>区别</b>无细胞壁、叶绿体和中央大液泡</span>`
      ]
    : [
        "核心概念",
        "先看边界，再辨结构",
        `<span class="bio-concept-line"><b>边界</b>细胞壁 → 细胞膜</span>
         <span class="bio-concept-line"><b>内部</b>细胞质、细胞核及其他结构</span>
         <span class="bio-concept-line"><b>特征</b>中央大液泡；绿色组织常见叶绿体</span>`
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
        "四指沿电流方向，大拇指指向 N 极",
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
            circuit.formula || "I = U / R",
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
      "Fe + CuSO₄ = FeSO₄ + Cu",
      `计量关系：1mol Fe : 1mol CuSO₄ : 1mol Cu<br>${chemistry.formulaHtml}`
    ],
    "数学": [
      "导数关系",
      `y′ = ${mathModel.derivativeText}`,
      `函数 y = ${mathModel.expression}；当 x = ${mathX} 时，y ${eqSign(mathModel.value(mathValue), 4)} ${mathY}，斜率 k ${eqSign(mathModel.derivative(mathValue), 4)} ${mathSlope}`
    ],
    "生物": biologyConcept
  };

  const [label, formula, desc] = formulas[subject] || formulas["物理"];
  const labelEl = $("span", spotlight);
  const formulaEl = $("strong", spotlight);
  const descEl = $("p", spotlight);

  if (labelEl) labelEl.textContent = label;
  setFormulaHtml(formulaEl, formula);
  const mathSlopeEq = eqSign(mathModel.derivative(mathValue), 4);
  const result = formulaSpotlightResult(subject, { physics, projectile, circuit, solenoid, boardSlider, extraPhysics, chemistry, mathX, mathSlope, mathSlopeEq });
  if (descEl) descEl.classList.toggle("formula-result", Boolean(result));
  // 有明确结果时只显示结果，代入过程留给下面的步骤；生物等概念类保留原说明
  setFormulaHtml(descEl, result ? `<b>结果</b><span>${result}</span>` : desc);
}

// 取各模板已算好的结论（识别摘要或实验读数），不在这里重新计算
function formulaSpotlightResult(subject, parts) {
  const segments = text => String(text || "").split("｜").map(item => item.trim()).filter(Boolean);
  if (subject === "物理") {
    if (parts.extraPhysics) return parts.extraPhysics.model?.readout || "";
    if (state.physicsTemplate === "projectile") return segments(parts.projectile.recognitionText).slice(-2).join(" · ");
    if (state.physicsTemplate === "circuit") return segments(parts.circuit.recognitionText).slice(-2).join(" · ");
    if (state.physicsTemplate === "solenoid") return segments(parts.solenoid.recognitionText).slice(1, 3).join(" · ");
    if (state.physicsTemplate === "boardSlider") return parts.boardSlider.steps[3][1];
    return segments(parts.physics.recognitionText).slice(-1).join("");
  }
  if (subject === "化学") return segments(parts.chemistry.recognitionText).slice(-1).join("");
  if (subject === "数学") return `x = ${parts.mathX} 时，切线斜率 k ${parts.mathSlopeEq || "="} ${parts.mathSlope}`;
  return "";
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

function decimalPlaces(value) {
  const text = String(Number(value));
  if (/e-/i.test(text)) return Number(text.split(/e-/i)[1]) || 0;
  return text.includes(".") ? text.split(".")[1].length : 0;
}

// 滑块步长要能精确表示题目给出的数值，否则浏览器会把 12.5 吸附成 13，实验就和题目不一致了
function rangeStepFor(param) {
  const base = Number(param.step);
  const min = Number(param.min);
  const value = Number(param.value);
  if (!(base > 0) || !Number.isFinite(value) || !Number.isFinite(min)) return param.step;
  const fits = step => {
    const ratio = (value - min) / step;
    return Math.abs(ratio - Math.round(ratio)) < 1e-7;
  };
  if (fits(base)) return param.step;
  for (const divisor of [2, 4, 5, 10, 20, 25, 50, 100, 1000]) {
    const step = Number((base / divisor).toPrecision(12));
    if (fits(step)) return step;
  }
  const finest = 10 ** -Math.min(6, Math.max(decimalPlaces(value), decimalPlaces(min)));
  return fits(finest) ? finest : "any";
}

function setRange(range, param) {
  range.min = param.min;
  range.max = param.max;
  range.step = rangeStepFor(param);
  range.value = param.value;
}

function formatParam(param, value) {
  const valueDecimals = decimalPlaces(Number(Number(value).toFixed(4)));
  const decimals = Math.min(4, Math.max(decimalPlaces(param.step), valueDecimals));
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
    elements.stopDistanceLabel.textContent = `${eqSign(content.model.stopDistance) === "≈" ? "≈" : ""}${content.stopDistanceText} m`;
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
  $(".side-card-header .section-kicker").textContent = "生成实验后展开";
  $(".side-card-header h2").textContent = "解题思维链";
  setReasonProgress(0);
  const spotlight = $(".formula-spotlight");
  if (spotlight) {
    $("span", spotlight).textContent = "等待生成";
    $("strong", spotlight).textContent = "公式将在这里呈现";
    $("p", spotlight).textContent = "AI 会根据题干条件选择公式，并展示代入与验证过程。";
  }
  $(".reasoning-steps").innerHTML = ["识别题干条件", "选择适用公式", "代入数据求解", "检验学习结论"]
    .map((title, index) => `<button class="reason-step pending-placeholder" data-step="${index + 1}">
      <span class="step-index">${index + 1}</span>
      <div><strong>${title}</strong></div>
    </button>`).join("");
  elements.mentorMessage.innerHTML = "生成实验后，我会根据题目给出关键追问、提示和变式迁移。";
  hideMentorFeedback();
}

function applyWaitingState(subject = state.subject, options = {}) {
  clearDemoTimers();
  clearReasoningTimers();
  pauseExperiment();
  state.hasGenerated = false;
  circuitMotion = null;
  setCellAutoRotate(false);
  animationClock.reconcile();
  state.generatedQuestion = "";
  state.subject = subject;
  updateSubjectBodyClass(subject);
  state.reasonStep = 0;
  if (subject === "物理" && options.presetQuestion) {
    state.physicsTemplate = "brake";
    state.brakeMode = "constant";
    state.brakeAsk = null;
    state.p1 = 20;
    state.p2 = 5;
    syncPhysicsBrakeContent();
  }
  if (subject === "化学" && options.presetQuestion) {
    state.chemGiven = null;
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
    state.p2 = currentCellOrganelles().length;
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
    elements.stopDistanceLabel.textContent = `${eqSign(content.model.stopDistance) === "≈" ? "≈" : ""}${content.stopDistanceText} m`;
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
  circuitMotion = null;
  setCellAutoRotate(false);
  state.subject = subject;
  updateSubjectBodyClass(subject);
  const restored = options.restore && restoreSubjectSnapshot(subject);
  const restoredTime = restored ? state.time : 0;
  if (subject === "物理" && updateQuestion && !restored) {
    state.physicsTemplate = "brake";
    state.brakeMode = "constant";
    state.brakeAsk = null;
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
    state.p2 = currentCellOrganelles().length;
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
  if (!state.hasGenerated || state.playing) return;
  if (state.time >= duration()) state.time = 0;
  state.playing = true;
  animationClock.reconcile();
  elements.playButton.classList.add("playing");
  if (document.body.classList.contains("demo-mode")) setDemoStep(4, "看见速度如何归零");
  animationClock.reconcile();
}

function pauseExperiment() {
  state.playing = false;
  elements.playButton.classList.remove("playing");
  elements.car.classList.remove("moving");
  animationClock.reconcile();
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

const GENERATION_TIMING = Object.freeze({
  full: Object.freeze({ stageStarts: [0, 700, 1400], complete: 2080, resolve: 2440, exit: 460 }),
  reduced: Object.freeze({ stageStarts: [0, 260, 520], complete: 760, resolve: 940, exit: 0 })
});

const GENERATION_SUBJECT_KEYS = Object.freeze({ "物理": "physics", "化学": "chemistry", "数学": "mathematics", "生物": "biology" });

const GENERATION_KEYWORDS = /植物细胞|动物细胞|细胞壁|细胞膜|细胞核|液泡|叶绿体|线粒体|抛物线|切线斜率|切线|导数|硫酸铜|铁粉|刹车|制动|平抛|螺线管|欧姆定律|杠杆|凸透镜|浮力|液体压强|热平衡|电功率|机械效率/g;

function generationPrefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

function generationTiming() {
  return generationPrefersReducedMotion() ? GENERATION_TIMING.reduced : GENERATION_TIMING.full;
}

// Highlight the quantities the parser reads, so the "识别条件" step is visible on the user's own text.
function generationQuestionTokens(text) {
  const tokens = [];
  const numberPattern = /[-−]?\d+(?:\.\d+)?\s*(?:m\/s²|m\/s\^?2|m\/s|km\/h|kg\/m³|g\/cm³|mol|kg|cm|mm|m²|m³|m|g|N|V|Ω|A|W|J|Pa|Hz|s|℃|°C|%|匝|倍|个)?/g;
  let match;
  while ((match = numberPattern.exec(text)) && tokens.length < 6) {
    const previous = text[match.index - 1] || "";
    if (/[A-Za-z0-9_.]/.test(previous)) continue;
    tokens.push({ start: match.index, end: match.index + match[0].trimEnd().length });
  }
  // Questions with few quantities (math, biology) also mark their key concepts.
  if (tokens.length < 2) {
    GENERATION_KEYWORDS.lastIndex = 0;
    while ((match = GENERATION_KEYWORDS.exec(text)) && tokens.length < 4) {
      const start = match.index;
      const end = start + match[0].length;
      if (!tokens.some(token => start < token.end && end > token.start)) tokens.push({ start, end });
    }
  }
  return tokens.sort((left, right) => left.start - right.start);
}

function renderGenerationQuestion(question) {
  const container = elements.generationQuestion;
  if (!container) return;
  container.replaceChildren();
  const normalized = String(question ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    container.hidden = true;
    return;
  }
  const limit = 92;
  let cut = normalized.length;
  if (cut > limit) {
    // Do not split a number or unit at the ellipsis ("0.20" must not become "0…").
    cut = limit;
    while (cut > limit - 12 && /[\w.²³]/.test(normalized[cut - 1]) && /[\w.²³/]/.test(normalized[cut])) cut -= 1;
  }
  const text = cut < normalized.length ? `${normalized.slice(0, cut).trimEnd()}…` : normalized;
  let cursor = 0;
  generationQuestionTokens(text).forEach((token, index) => {
    if (token.start > cursor) container.append(document.createTextNode(text.slice(cursor, token.start)));
    const mark = document.createElement("mark");
    mark.className = "gen-token";
    mark.style.setProperty("--i", String(index));
    mark.textContent = text.slice(token.start, token.end);
    container.append(mark);
    cursor = token.end;
  });
  if (cursor < text.length) container.append(document.createTextNode(text.slice(cursor)));
  container.hidden = false;
}

function renderGenerationSteps(stages) {
  const list = elements.generationSteps;
  if (!list) return;
  list.replaceChildren(...stages.map((stage, index) => {
    const item = document.createElement("li");
    item.className = "gen-step";
    item.dataset.state = "pending";
    item.style.setProperty("--i", String(index));
    item.innerHTML = `
      <span class="gen-step-icon" aria-hidden="true"><i class="gen-step-spinner"></i><svg viewBox="0 0 20 20"><path d="m5.4 10.4 3 3 6.2-6.6"/></svg></span>
      <span class="gen-step-copy">
        <strong></strong>
        <span class="gen-step-detail"><span class="gen-step-skeleton" aria-hidden="true"><i></i><i></i></span><span class="gen-step-text"></span></span>
      </span>`;
    $("strong", item).textContent = stage.label;
    const detail = document.createElement("span");
    detail.textContent = stage.text;
    $(".gen-step-text", item).innerHTML = verticalizeFormulaHtml(detail.innerHTML);
    return item;
  }));
}

function moveGenerationHighlight() {
  const highlight = elements.generationStepsHighlight;
  const active = elements.generationSteps && $('.gen-step[data-state="active"]', elements.generationSteps);
  if (!highlight) return;
  if (!active) {
    highlight.classList.remove("show");
    return;
  }
  highlight.style.setProperty("--y", `${active.offsetTop}px`);
  highlight.style.setProperty("--h", `${active.offsetHeight}px`);
  highlight.classList.add("show");
}

function setGenerationStage(index) {
  const stages = state.generationStages || GENERATION_STAGES;
  const stage = stages[index];
  if (!stage) return;
  const timing = generationTiming();
  const nextStart = index + 1 < timing.stageStarts.length ? timing.stageStarts[index + 1] : timing.complete;
  elements.generationOverlay.dataset.stage = String(index);
  elements.generationStatus.textContent = `${stage.label}：${stage.text}`;
  elements.generationProgress.style.transitionDuration = `${Math.max(0, nextStart - timing.stageStarts[index])}ms`;
  elements.generationProgress.style.width = `${stage.progress}%`;
  $$(".gen-step", elements.generationSteps).forEach((item, itemIndex) => {
    item.dataset.state = itemIndex < index ? "done" : itemIndex === index ? "active" : "pending";
  });
  moveGenerationHighlight();
}

function completeGenerationOverlay() {
  const overlay = elements.generationOverlay;
  overlay.dataset.stage = "complete";
  $$(".gen-step", elements.generationSteps).forEach(item => { item.dataset.state = "done"; });
  moveGenerationHighlight();
  elements.generationProgress.style.transitionDuration = "240ms";
  elements.generationProgress.style.width = "100%";
  elements.generationTitle.textContent = "实验已生成";
  elements.generationKicker.textContent = "READY";
  elements.generationStatus.textContent = "实验已生成";
}

function showGenerationOverlay(stages = null, options = {}) {
  clearGenerationTimers();
  state.generationStages = stages;
  setDemoStep(2, "识别题干并匹配实验");
  const overlay = elements.generationOverlay;
  const activeStages = (state.generationStages || GENERATION_STAGES).slice(0, 3).map((stage, index) => ({
    ...GENERATION_STAGES[index],
    ...stage
  }));
  state.generationStages = activeStages;
  overlay.classList.remove("is-leaving");
  overlay.dataset.subject = GENERATION_SUBJECT_KEYS[options.subject] || "physics";
  elements.generationTitle.textContent = "正在把题目生成实验";
  elements.generationKicker.textContent = "SEMANTIC INPUT";
  renderGenerationQuestion(options.question);
  renderGenerationSteps(activeStages);
  elements.generationProgress.style.transitionDuration = "0ms";
  elements.generationProgress.style.width = "0%";
  overlay.classList.add("show");
  overlay.setAttribute("aria-hidden", "false");
  // Bundled local templates do not need the simulated web generation delay.
  if (document.body.classList.contains("harmony-compat-mode")) {
    setGenerationStage(activeStages.length - 1);
    return Promise.resolve();
  }
  // Commit the 0% state before the first stage starts its progress transition.
  void elements.generationProgress.offsetWidth;
  setGenerationStage(0);

  const timing = generationTiming();
  return new Promise(resolve => {
    state.generationTimers = [
      ...timing.stageStarts.slice(1).map((delay, offset) => setTimeout(() => setGenerationStage(offset + 1), delay)),
      setTimeout(completeGenerationOverlay, timing.complete),
      setTimeout(resolve, timing.resolve)
    ];
  });
}

function hideGenerationOverlay() {
  clearGenerationTimers();
  state.generationStages = null;
  const overlay = elements.generationOverlay;
  const wasVisible = overlay.classList.contains("show");
  overlay.classList.remove("show");
  overlay.setAttribute("aria-hidden", "true");
  const exit = generationTiming().exit;
  if (!wasVisible || exit <= 0) return;
  overlay.classList.add("is-leaving");
  state.generationTimers = [setTimeout(() => overlay.classList.remove("is-leaving"), exit)];
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
  const sEq = eqSign(content.model.stopDistance);
  const playStartMs = 820;
  const experimentMs = (duration() / state.playbackRate) * 1000;
  const solveMs = playStartMs + Math.max(1200, experimentMs * 0.38);
  const verifyMs = playStartMs + Math.max(2400, experimentMs * 0.72);
  const finishMs = playStartMs + experimentMs + 160;
  setReasoningStep(1, `<span>观察目标</span>先看速度如何从 ${vText}m/s 逐步归零。`);
  // 演示固定讲“求刹车距离”的预设题
  state.demoTimers = [
    setTimeout(() => setReasoningStep(2, "<span>公式选择</span>没有给时间 t，直接用速度—位移关系式。"), 520),
    setTimeout(() => { if (!motionPreference.matches) playExperiment(); }, 820),
    setTimeout(() => setReasoningStep(3, `<span>代入求解</span>0² − ${vText}² = 2 × (−${aText}) × x，所以 x ${sEq} ${sText}m。`), solveMs),
    setTimeout(() => setReasoningStep(4, `<span>现象验证</span>小车速度归零时，停止点对应 ${aboutText(content.model.stopDistance)}${sText}m。`), verifyMs),
    setTimeout(() => {
      state.time = duration();
      updateScene();
      setReasoningStep(4, `<span>现象验证</span>速度归零，刹车距离稳定对应 ${sText}m。`);
    }, finishMs)
  ];
}

function detectSubjectStrict(question) {
  if (/化学|反应物|生成物|充分反应|恰好反应|完全反应|化学方程式|浓度|溶液|铁粉|硫酸铜|CuSO|Fe\b|生成铜|生成 Cu|物质的量|\dmol/i.test(question)) return "化学";
  if (isPhysicsBoardSliderQuestion(question)) return "物理";
  if (/(?:f|F)(?:阻)?\s*(?:=|＝)\s*-?\s*k\s*v|阻力.{0,12}(?:速度|速率).{0,8}成正比|(?:质量|m\s*(?:=|＝)).{0,12}(?:kg|千克|吨).{0,24}(?:初速度|速度)|(?:动摩擦因数|摩擦系数|车轮抱死)/i.test(question)) return "物理";
  if (/遗传|基因|表现型|杂合|纯合|孟德尔|配子|有丝分裂|减数分裂|DNA/i.test(question)) return "生物";
  if (/重力|斜面|弹簧|简谐|动量|碰撞|磁场|电场|电容|电荷|受力|牛顿|机械能|千克|\bkg\b|m\s*\/\s*s/i.test(question)) return "物理";
  if (/概率|随机|排列|组合|数列|方程|不等式|几何|三角形|圆锥|函数|抛物线|斜率|切线|导数|数学|y\s*(?:=|＝)|ln\s*x|sin\s*x|cos\s*x|e\^x|exp\s*\(|sqrt|√/i.test(question)) return "数学";
  if (identifyExtraPhysicsTemplate(question)) return "物理";
  if (/汽车|车辆|速度|加速度|减速度|刹车|制动|停止|运动|受力|落下|物理|螺线管|电磁铁|磁极|安培定则|线圈|匝|铁芯|磁感线|平抛|水平抛|水平速度|落地|水平位移|欧姆|电压|电阻|电流|纯电阻|电路|Ω/.test(question)) return "物理";
  if (/细胞|生物|植物|动物|亚显微|细胞壁|细胞膜|细胞核|液泡|叶绿体|线粒体|细胞质|内质网|高尔基体|核糖体|DNA/.test(question)) return "生物";
  return "";
}

function detectSubject(question, fallbackSubject = state.subject) {
  return detectSubjectStrict(question) || fallbackSubject;
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
  state.brakeAsk = null;
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
  state.projectileGravity = PROJECTILE_LIMITS.gravity;
  state.projectileAsk = null;
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
  state.circuitSolve = null;
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
  state.extraFixed = { ...(state.extraFixed || {}), [id]: null };
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

// The cell model is re-rendered per cell type and level, so organelle events are delegated.
elements.plantCellModel?.addEventListener("keydown", event => {
  const node = event.target.closest?.(".cell-organelle");
  if (!node || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  event.stopPropagation();
  selectBioOrganelle(node.dataset.organelle);
});

$$(".cell-level-toggle button").forEach(button => {
  button.addEventListener("pointerdown", event => event.stopPropagation());
  button.addEventListener("click", event => {
    event.stopPropagation();
    switchBiologyCellLevel(button.dataset.level);
  });
});

elements.cellLabelButton?.addEventListener("click", event => {
  event.stopPropagation();
  state.cellLabelsVisible = !state.cellLabelsVisible;
  updateCellModelMode();
  showToast(state.cellLabelsVisible ? "已显示结构标注" : "已隐藏标注，可自测识图");
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

function cellTargetAt(clientX, clientY) {
  const hit = document.elementFromPoint(clientX, clientY);
  const node = hit?.closest?.(".cell-organelle, .cell-label, .cell-structure-tag");
  return node && !node.classList.contains("unavailable") ? node : null;
}

function selectNearestBioOrganelle(clientX, clientY) {
  const direct = cellTargetAt(clientX, clientY);
  if (direct) {
    selectBioOrganelle(direct.dataset.organelle);
    return;
  }
  // Distance to the nearest drawn instance (not the group's bounding box, which may span the cell).
  const map = currentCellOrganelleMap();
  let best = null;
  $$(".cell-organelle").forEach(node => {
    if (!map.has(node.dataset.organelle)) return;
    const parts = node.querySelectorAll(".cell-hit, .cell-hit-stroke");
    (parts.length ? [...parts] : [node]).forEach(part => {
      const rect = part.getBoundingClientRect();
      if (!rect.width && !rect.height) return;
      const dx = Math.max(rect.left - clientX, 0, clientX - rect.right);
      const dy = Math.max(rect.top - clientY, 0, clientY - rect.bottom);
      const distance = Math.hypot(dx, dy);
      if (!best || distance < best.distance) best = { node, distance };
    });
  });
  if (best && best.distance < 28) selectBioOrganelle(best.node.dataset.organelle);
}

function clearBioHoverLabels() {
  $$(".cell-organelle.hover, .cell-structure-tag.hover, .cell-label.hover").forEach(node => node.classList.remove("hover"));
}

function updateBioHoverLabel(clientX, clientY) {
  if (state.subject !== "生物" || !state.hasGenerated) return;
  const hovered = cellTargetAt(clientX, clientY);
  clearBioHoverLabels();
  if (!hovered) return;
  const id = hovered.dataset.organelle;
  $$(`.cell-organelle[data-organelle="${id}"], .cell-label[data-organelle="${id}"], .cell-structure-tag[data-organelle="${id}"]`)
    .forEach(node => node.classList.add("hover"));
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
      directOrganelle: event.target.closest(".cell-organelle, .cell-structure-tag, .cell-label")?.dataset.organelle || "",
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
      localMessage: message,
      acceptPlan: mapped => mappedPlanFitsOriginal(question, mapped?.question)
    });
    // 旧版导师脚本不认 acceptPlan 时在这里再核对一次，宁可不生成也不生成错的
    if (result?.mode === "experiment" && !mappedPlanFitsOriginal(question, result.question)) {
      setRecognitionFeedback({ message: "AI 匹配到的实验模板与原题条件不完全一致，为避免给出错误结果，未生成本地实验，可在问答页查看讲解。" }, true);
      return { mode: "unavailable" };
    }
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

  const plan = planLocalExperiment(question);
  const detected = plan.subject;
  if (!plan.ok) {
    const remote = await handOffUnmatchedQuestion(plan.parse, displayQuestion, detected, allowAiFallback);
    if (remote?.mode === "experiment") {
      $("#questionInput").value = remote.question;
      await generateExperiment({ questionOverride: remote.question, displayQuestion, allowAiFallback: false });
    }
    return;
  }
  let physicsParse = null;
  let boardSliderParse = null;
  let solenoidParse = null;
  let projectileParse = null;
  let circuitParse = null;
  let extraPhysicsParse = null;
  let chemistryParse = null;
  let mathParse = null;
  let templateRecognition = null;
  if (plan.kind === "boardSlider") {
    boardSliderParse = plan.parse;
    state.subject = "物理";
    state.physicsTemplate = "boardSlider";
    state.boardSliderParams = { ...boardSliderParse.params };
    state.p1 = boardSliderParse.initialSpeed;
    state.p2 = boardSliderParse.boardLength;
    syncPhysicsBoardSliderContent(state.boardSliderParams);
    setRecognitionFeedback(boardSliderParse);
  } else if (plan.kind === "solenoid") {
    solenoidParse = plan.parse;
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
  } else if (plan.kind === "projectile") {
    projectileParse = plan.parse;
    state.subject = "物理";
    state.physicsTemplate = "projectile";
    state.projectileGravity = projectileParse.gravity;
    state.projectileAsk = projectileParse.projectileAsk || null;
    state.p1 = projectileParse.speed;
    state.p2 = projectileParse.height;
    syncPhysicsProjectileContent(projectileParse.speed, projectileParse.height);
    syncPhysicsControlsFromState();
    setRecognitionFeedback(projectileParse);
  } else if (plan.kind === "extra") {
    extraPhysicsParse = plan.parse;
    state.subject = "物理";
    state.physicsTemplate = extraPhysicsParse.templateId;
    state.extraFixed = { ...state.extraFixed, [extraPhysicsParse.templateId]: extraPhysicsParse.fixed };
    state.p1 = extraPhysicsParse.p1;
    state.p2 = extraPhysicsParse.p2;
    syncExtraPhysicsContent(extraPhysicsParse.templateId, extraPhysicsParse.p1, extraPhysicsParse.p2);
    syncPhysicsControlsFromState();
    setRecognitionFeedback(extraPhysicsParse);
  } else if (plan.kind === "circuit") {
    circuitParse = plan.parse;
    state.subject = "物理";
    state.physicsTemplate = "circuit";
    state.circuitSolve = circuitParse.circuitSolve || null;
    state.p1 = circuitParse.voltage;
    state.p2 = circuitParse.resistance;
    syncPhysicsCircuitContent(circuitParse.voltage, circuitParse.resistance);
    syncPhysicsControlsFromState();
    setRecognitionFeedback(circuitParse);
  } else if (plan.kind === "brake") {
    physicsParse = plan.parse;
    state.subject = "物理";
    state.physicsTemplate = "brake";
    state.brakeMode = physicsParse.mode || "constant";
    state.brakeAsk = physicsParse.brakeAsk || null;
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
  } else if (plan.kind === "chemistry") {
    chemistryParse = plan.parse;
    state.subject = "化学";
    state.chemGiven = chemistryParse.chemGiven || null;
    state.p1 = chemistryParse.feMass;
    state.p2 = chemistryParse.cuso4Mol;
    syncChemistryFeCuSO4Content(chemistryParse.feMass, chemistryParse.cuso4Mol);
    setRecognitionFeedback(chemistryParse);
  } else if (plan.kind === "math") {
    mathParse = plan.parse;
    state.subject = "数学";
    state.mathModel = mathParse.model;
    state.p1 = mathParse.x;
    state.p2 = 1;
    syncMathContent(mathParse.x, mathParse.model);
    setRecognitionFeedback(mathParse);
  } else if (plan.kind === "biology") {
    const cellType = plan.parse.cellType;
    state.cellType = cellType;
    state.cellLevel = plan.parse.cellLevel;
    syncBiologyContent(cellType, state.cellLevel);
    templateRecognition = biologyTemplateRecognition();
    state.subject = "生物";
    state.p1 = -10;
    state.p2 = currentCellOrganelles().length;
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
  await showGenerationOverlay(generationStages, { question: displayQuestion, subject: detected });
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
    setReasoningStep(3, `<span>电流反转</span>电流方向反向，磁感线方向与小磁针同步反转，N/S 极交换；磁性强弱不因方向反转而减弱。`);
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
  if (state.solenoidPaused || motionPreference.matches) drawSolenoidCanvas();
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
      ? (state.cellLevel === "senior"
        ? "先抓动物细胞特征：没有细胞壁、叶绿体和液泡，有中心体；细胞的边界是细胞膜。"
        : "先抓动物细胞特征：没有细胞壁、叶绿体和液泡，最外层是细胞膜。")
      : (state.cellLevel === "senior"
        ? "先抓高等植物细胞特征：有细胞壁、叶绿体和中央大液泡，没有中心体。"
        : "先抓植物细胞特征：有细胞壁、叶绿体和液泡，成熟细胞有很大的中央液泡。");
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
    setReasoningStep(4, `<span>变式挑战</span>最大相对位移 ${eqSign(model.relativeStopDistance, 4)} ${boardSliderNumber(model.relativeStopDistance)}m ${model.relationSymbol} L = ${boardSliderNumber(model.boardLength)}m，结论：${model.outcomeLabel}。`);
    elements.mentorMessage.innerHTML = model.outcome === "fall"
      ? `初速度改为 <strong>5m/s</strong> 后，相对加速度大小为 <strong>${aboutText(model.relativeDeceleration)}${boardSliderNumber(model.relativeDeceleration)}m/s²</strong>，最大相对位移为 <strong>${aboutText(model.relativeStopDistance)}${boardSliderNumber(model.relativeStopDistance)}m</strong>，大于木板长度。滑块在 <strong>${aboutText(model.exitTime)}${boardSliderNumber(model.exitTime)}s</strong> 从右端滑出；此时 v<sub>A</sub> ${eqSign(exitValues.blockSpeed)} <strong>${boardSliderNumber(exitValues.blockSpeed)}m/s</strong>，v<sub>B</sub> ${eqSign(exitValues.boardSpeed)} <strong>${boardSliderNumber(exitValues.boardSpeed)}m/s</strong>。`
      : model.outcome === "critical"
        ? `初速度改为 <strong>5m/s</strong> 后，最大相对位移恰好等于木板长度 <strong>${boardSliderNumber(model.boardLength)}m</strong>；滑块到达右端时与木板达到共同速度 <strong>${aboutText(model.commonSpeed)}${boardSliderNumber(model.commonSpeed)}m/s</strong>。`
        : `初速度改为 <strong>5m/s</strong> 后，最大相对位移为 <strong>${aboutText(model.relativeStopDistance)}${boardSliderNumber(model.relativeStopDistance)}m</strong>，仍小于木板长度；二者在 <strong>${aboutText(model.syncTime)}${boardSliderNumber(model.syncTime)}s</strong> 后以 <strong>${aboutText(model.commonSpeed)}${boardSliderNumber(model.commonSpeed)}m/s</strong> 共同匀速运动。`;
    hideMentorFeedback();
    showToast(model.outcome === "fall" ? `木板—滑块变式已同步：${aboutText(model.exitTime)}${boardSliderNumber(model.exitTime)}s 从右端滑出` : `木板—滑块变式已同步：${model.outcomeLabel}`);
    return;
  }

  if (state.subject === "物理" && state.physicsTemplate === "solenoid") {
    const before = solenoidModel();
    state.p1 = solenoidChallengeCurrent(state.p1);
    state.solenoidWindingDirection = state.solenoidWindingDirection === "counterclockwise" ? "clockwise" : "counterclockwise";
    state.solenoidPaused = false;
    syncPhysicsSolenoidContent();
    setRange(elements.ranges[0], { ...config().params[0], value: state.p1 });
    setRange(elements.ranges[1], { ...config().params[1], value: state.p2 });
    updateParameters(true, { syncQuestion: true });
    const content = buildPhysicsSolenoidContent();
    const currentUp = content.model.current > before.current;
    setReasoningStep(4, `<span>变式挑战</span>电流${currentUp ? "增大" : "减小"}且方向反转：N/S 极交换，磁性${currentUp ? "增强" : "减弱"}。`);
    elements.mentorMessage.innerHTML = `现在电流为 <strong>${formatAmp(content.model.current)}A</strong>，方向已反转，匝数和铁芯不变。结论：<strong>N、S 极交换</strong>（左端 ${content.model.leftPole} 极、右端 ${content.model.rightPole} 极）；电流${currentUp ? "增大" : "减小"}，磁性${currentUp ? "增强" : "减弱"}，当前为<strong>${content.model.strengthLevel}</strong>。`;
    showToast(`电磁变式已同步：磁极交换，磁性${currentUp ? "增强" : "减弱"}`);
    return;
  }

  if (state.subject === "物理" && state.physicsTemplate === "projectile") {
    const previous = projectileModel();
    const nextSpeed = projectileChallengeSpeed(state.p1);
    state.p1 = nextSpeed;
    syncPhysicsProjectileContent(nextSpeed, state.p2);
    syncPhysicsControlsFromState();
    updateParameters(true, { syncQuestion: true });
    const next = projectileModel();
    const speedUp = next.speed > previous.speed;
    setReasoningStep(4, `<span>变式挑战</span>水平速度${speedUp ? "增大" : "减小"}，落地时间不变，水平位移随 v₀ ${speedUp ? "增大" : "减小"}。`);
    elements.mentorMessage.innerHTML = `我已把水平速度从 <strong>${smartNumber(previous.speed)}m/s</strong> 改为 <strong>${smartNumber(next.speed)}m/s</strong>。高度不变，所以落地时间仍为 <strong>${aboutText(next.fallTime)}${smartNumber(next.fallTime, 2)}s</strong>，水平位移变为 <strong>${aboutText(next.range)}${smartNumber(next.range, 1)}m</strong>。`;
    hideMentorFeedback();
    showToast("平抛变式题已同步");
    return;
  }

  if (state.subject === "物理" && state.physicsTemplate === "circuit") {
    const before = circuitModel();
    const nextVoltage = circuitChallengeVoltage(state.p1);
    state.p1 = nextVoltage;
    syncPhysicsCircuitContent(nextVoltage, state.p2);
    syncPhysicsControlsFromState();
    updateParameters(true, { syncQuestion: true });
    const next = circuitModel();
    const voltageUp = next.voltage > before.voltage;
    setReasoningStep(3, `<span>变式挑战</span>电阻不变时，电压${voltageUp ? "增大" : "减小"}，电流按比例${voltageUp ? "增大" : "减小"}。`);
    elements.mentorMessage.innerHTML = `电阻保持 <strong>${smartNumber(next.resistance)}Ω</strong>，电压变为 <strong>${smartNumber(next.voltage)}V</strong>，所以电流变为 <strong>${aboutText(next.current)}${smartNumber(next.current, 2)}A</strong>。`;
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
    state.p2 = frictionChallengeMu(state.p2);
    syncPhysicsBrakeContent(state.p1, state.p2, { mode: "friction", gravity: state.brakeGravity });
    syncPhysicsControlsFromState();
    updateParameters(true, { syncQuestion: true });
    const next = physicsBrakeModel();
    const muUp = next.mu > previous.mu;
    setReasoningStep(4, `<span>变式挑战</span>${muUp ? "μ 增大使减速度增大，停止距离缩短。" : "μ 减小使减速度减小，停止距离变长。"}`);
    elements.mentorMessage.innerHTML = `动摩擦因数从 <strong>${smartNumber(previous.mu, 2)}</strong> 变为 <strong>${smartNumber(next.mu, 2)}</strong>，减速度由 <strong>${plainNumber(previous.aAbs, 2)}m/s²</strong> ${muUp ? "增至" : "减至"} <strong>${plainNumber(next.aAbs, 2)}m/s²</strong>，停止距离${muUp ? "缩短" : "变长"}为 <strong>${aboutText(next.stopDistance)}${smartNumber(next.stopDistance)}m</strong>。`;
    hideMentorFeedback();
    showToast(`摩擦制动变式已同步：停止距离 ${aboutText(next.stopDistance)}${smartNumber(next.stopDistance)}m`);
    return;
  }

  if (state.subject === "物理" && state.physicsTemplate === "brake" && state.brakeMode === "linear_drag") {
    const previous = physicsBrakeModel();
    state.p2 = linearDragChallengeK(state.p2, state.brakeMass);
    syncPhysicsBrakeContent(state.p1, state.p2, { mode: "linear_drag", mass: state.brakeMass });
    syncPhysicsControlsFromState();
    updateParameters(true, { syncQuestion: true });
    const next = physicsBrakeModel();
    const kUp = next.k > previous.k;
    setReasoningStep(4, `<span>变式挑战</span>${kUp ? "k 增大，时间常数 τ=m/k 与极限位移 mv₀/k 同时减小。" : "k 减小，时间常数 τ=m/k 与极限位移 mv₀/k 同时增大。"}`);
    elements.mentorMessage.innerHTML = `阻力系数从 <strong>${smartNumber(previous.k)}kg/s</strong> ${kUp ? "增至" : "减至"} <strong>${smartNumber(next.k)}kg/s</strong>，时间常数由 <strong>${aboutText(previous.tau)}${smartNumber(previous.tau, 2)}s</strong> ${kUp ? "减至" : "增至"} <strong>${aboutText(next.tau)}${smartNumber(next.tau, 2)}s</strong>，极限位移变为 <strong>${aboutText(next.stopDistance)}${smartNumber(next.stopDistance)}m</strong>。`;
    hideMentorFeedback();
    showToast(`线性阻力变式已同步：极限位移 ${aboutText(next.stopDistance)}${smartNumber(next.stopDistance)}m`);
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
    elements.mentorMessage.innerHTML = `我已把题目改成初速度 <strong>${smartNumber(nextV)}m/s</strong>、加速度 <strong>−${smartNumber(nextA)}m/s²</strong>。先别急着播放，预测一下停止距离为什么会变成 <strong>${aboutText(next.stopDistance)}${smartNumber(next.stopDistance)}m</strong>？`;
    showMentorChallengeFeedback(previous, next);
    syncFavoriteState();
    showToast(`变式题已同步：停止距离 ${aboutText(next.stopDistance)}${smartNumber(next.stopDistance)}m`);
    return;
  }

  if (state.subject === "化学") {
    const before = chemistryFeCuSO4Model(state.p1, state.p2);
    setRange(elements.ranges[0], { ...config().params[0], value: chemistryChallengeFe(state.p1) });
    updateParameters(true, { syncQuestion: true });
    const content = buildChemistryFeCuSO4Content();
    const m = content.model;
    const verb = m.feMass > before.feMass ? "增加" : "减少";
    const cuAbout = eqSign(m.cuMol, 4) === "≈" || eqSign(m.cuMass, 3) === "≈" ? "约 " : "";
    setReasoningStep(3, `<span>变式挑战</span>铁粉${verb}到 ${formatGram(m.feMass)}g，重新判断限量反应物。`);
    elements.mentorMessage.innerHTML = `铁粉${verb}到 <strong>${formatGram(m.feMass)}g</strong> 后，n(Fe) ${eqSign(m.feMol, 4)} ${formatMol(m.feMol)}mol，CuSO₄ 仍为 ${formatMol(m.cuso4Mol)}mol，所以 <strong>${chemistryReactionJudgement(m).short}</strong>，生成 Cu <strong>${cuAbout}${formatMol(m.cuMol)}mol / ${formatGram(m.cuMass)}g</strong>。`;
    showToast("化学变式题已同步");
    return;
  }

  if (state.subject === "数学") {
    const model = currentMathModel();
    const nextX = clamp(model.challengeX ?? model.defaultX, model.domainMin, model.domainMax);
    setRange(elements.ranges[0], { ...config().params[0], value: nextX });
    updateParameters(true, { syncQuestion: true });
    const slope = model.derivative(nextX);
    const kEq = eqSign(slope, 4);
    setReasoningStep(3, `<span>变式挑战</span>x = ${formatMathNumber(nextX)} 时，代入 y′ = ${model.derivativeText}，得到 k ${kEq} ${formatMathNumber(slope)}。`);
    elements.mentorMessage.innerHTML = `如果 <strong>x = ${formatMathNumber(nextX)}</strong>，代入 <strong>y′ = ${model.derivativeText}</strong>，可得切线斜率 <strong>k ${kEq} ${formatMathNumber(slope)}</strong>。`;
    showToast(`数学变式题已同步：k ${kEq} ${formatMathNumber(slope)}`);
    return;
  }

  if (state.subject === "生物") {
    const nextType = state.cellType === "animal" ? "plant" : "animal";
    switchBiologyCellType(nextType);
    const label = CELL_TYPE_LABELS[nextType];
    setReasoningStep(4, `<span>对比迁移</span>已切换到${label}，观察它与${nextType === "animal" ? "植物" : "动物"}细胞的结构差异。`);
    elements.mentorMessage.innerHTML = nextType === "animal"
      ? "已切换到 <strong>动物细胞</strong>。请对比：动物细胞没有哪些结构？细胞壁、叶绿体和液泡分别承担什么功能？"
      : "已切换到 <strong>植物细胞</strong>。请对比：植物细胞中的细胞壁、叶绿体和液泡分别对应什么功能？";
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
  window.scrollTo({ top: 0, behavior: motionPreference.matches ? "auto" : "smooth" });
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
  if (event.defaultPrevented || $("#announcementsDialog")?.open || event.target.closest?.("input, textarea, select, button, [contenteditable], summary")) return;
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
});

if (elements.car?.parentElement && "ResizeObserver" in window) {
  new ResizeObserver(() => {
    if (state.hasGenerated && state.subject === "物理" && state.physicsTemplate === "brake") updateScene();
  }).observe(elements.car.parentElement);
}

renderFavoriteList();
syncFavoriteState();
updateGreeting();
applyWaitingState("物理", { presetQuestion: true });
updatePhysicsPresetOption();
setDemoStep(1, "输入题目，生成实验");
animationClock.reconcile();
if (document.body.classList.contains("demo-mode")) {
  scheduleAutoDemo();
}

window.addEventListener("pageshow", event => {
  if (!event.persisted) return;
  updateGreeting();
  applyWaitingState("物理", { presetQuestion: true });
});
