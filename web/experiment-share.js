/* share-v1: loaded after app.js. All calculations and generation use its local planners.
   This module owns transport/validation only; URL objects never become application state. */
(() => {
  "use strict";
  const PREFIX = "#/share/";
  const MAX_URL = 12000;
  const MAX_BYTES = 8000;
  const MAX_ENCODED = Math.ceil(MAX_BYTES / 3) * 4;
  const MAX_QUESTION = 2000;
  const SUBJECT_NAMES = ["物理", "化学", "数学", "生物"];
  const SPECIAL = Object.freeze({ brake: "物理", boardSlider: "物理", solenoid: "物理", projectile: "物理", circuit: "物理", chemistry: "化学", math: "数学", biology: "生物" });
  const preparedValues = new WeakSet();
  let lastRoute = null;
  let restoring = false;

  const fail = message => { throw new Error(message); };
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const same = (left, right) => {
    if (typeof left === "number" && typeof right === "number") return Math.abs(left - right) <= 1e-9;
    if (left === right) return true;
    if (!record(left) || !record(right)) return false;
    return Object.keys(left).length === Object.keys(right).length
      && Object.keys(left).every(key => own(right, key) && same(left[key], right[key]));
  };
  function keys(value, names, label) {
    if (!record(value) || Object.keys(value).length !== names.length
      || names.some(name => !own(value, name))) fail(`${label}字段缺失或含有不支持的字段`);
  }
  function level(value) {
    if (value !== "junior" && value !== "senior") fail("学段必须为初中或高中");
    return value;
  }
  function numberIn(value, min, max, label) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) fail(`${label}超出允许范围（${min}–${max}）`);
  }
  function paramIn(value, param) {
    numberIn(value, param.min, param.max, param.label);
    if (param.locked && value !== param.value) fail(`${param.label}是锁定参数`);
    if (!param.locked && typeof param.valueText === "function" && !Number.isInteger(value)) fail(`${param.label}必须为整数选项`);
  }
  function encode(data) {
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    if (bytes.length > MAX_BYTES) fail("分享数据过长，请缩短题目后重新生成实验");
    return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(""))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function decode(hash) {
    if (location.href.length > MAX_URL || hash.length > PREFIX.length + MAX_ENCODED) fail("分享链接过长");
    const encoded = hash.slice(PREFIX.length);
    if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded) || encoded.length % 4 === 1) fail("分享链接编码已损坏");
    let data;
    try {
      const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - encoded.length % 4) % 4));
      if (binary.length > MAX_BYTES) fail("分享数据过长");
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch {
      fail("分享链接编码或 JSON 数据已损坏");
    }
    if (encode(data) !== encoded) fail("分享链接编码不规范或已损坏");
    return data;
  }

  function modeKeys(template) {
    if (template === "brake") return ["braking"];
    if (template === "solenoid") return ["viewEnd", "windingDirection", "hasCore"];
    if (template === "biology" || template === "chemistry"
      || (own(GENERIC_TEMPLATES, template) && GENERIC_TEMPLATES[template].level === "both")) return ["level", "locked"];
    return [];
  }

  // Returned data is reconstructed by trusted parsers, not merged from the URL.
  function prepare(data) {
    keys(data, ["v", "subject", "question", "grade", "template", "params", "mode"], "分享数据");
    if (data.v !== 1) fail("不支持此分享版本，请使用分享者相同或更新的网页版本");
    if (!SUBJECT_NAMES.includes(data.subject)) fail("分享学科无效");
    level(data.grade);
    if (typeof data.question !== "string" || !data.question.trim() || data.question !== data.question.trim()
      || data.question.length > MAX_QUESTION) fail("题目为空、格式无效或超过 2000 字符");
    if (typeof data.template !== "string" || !(own(SPECIAL, data.template) || own(GENERIC_TEMPLATES, data.template))) fail("未知实验模板，当前网页无法恢复");
    const subject = own(SPECIAL, data.template) ? SPECIAL[data.template] : GENERIC_TEMPLATES[data.template].subject;
    if (subject !== data.subject) fail("学科与实验模板不一致");
    keys(data.mode, modeKeys(data.template), "实验模式");
    if (own(data.mode, "level")) level(data.mode.level);
    if (own(data.mode, "locked")) {
      if (typeof data.mode.locked !== "boolean") fail("学段锁定模式无效");
      if (!data.mode.locked && data.mode.level !== data.grade) fail("未锁定的实验讲法必须与所选学段一致");
    }
    const plan = planLocalExperiment(data.question, {
      subject: data.subject, physicsTemplate: data.template, presetQuestion: "",
      gradeLevel: data.mode.level || data.grade
    });
    if (!plan.ok) fail(`题目不能在本地恢复：${plan.parse?.message || "未匹配到本地实验"}`);
    const templateId = plan.kind === "extra" ? plan.templateId : plan.kind;
    if (plan.subject !== data.subject || templateId !== data.template) fail("题目与分享学科或模板不一致");
    if (!Array.isArray(data.params) || data.params.length !== (plan.kind === "biology" ? 0 : 2)
      || data.params.some(value => typeof value !== "number" || !Number.isFinite(value))) fail("实验参数类型或数量无效");
    const parse = plan.parse;
    const [p1, p2] = data.params;
    let expectedMode = {};
    let params;
    if (plan.kind === "extra") {
      const template = GENERIC_TEMPLATES[plan.templateId];
      const fixed = template.fixedWithDefaults(parse.fixed);
      if (template.level === "both") {
        expectedMode = { level: template.contentLevel(fixed), locked: data.mode.locked };
        parse.fixed = { ...parse.fixed, levelLocked: data.mode.locked };
      }
      data.params.forEach((value, index) => {
        const bounds = template.strict.rangeFor?.(index, fixed) || template.strict.caps?.[index]
          || [template.params[index].min, template.params[index].max];
        numberIn(value, bounds[0], bounds[1], template.params[index].label);
      });
      const issue = template.strict.checkFixed?.(fixed, p1, p2);
      if (issue) fail(issue);
      // Reuse the template's strict parser for relationships such as efficiency <= 100%.
      // Some exploratory sliders are not stated quantities (e.g. junior friction),
      // so this checks validity without requiring the parser's demonstration defaults to equal them.
      const current = template.parseQuestion(template.question(p1, p2, fixed), { gradeLevel: data.mode.level || data.grade });
      if (!current.ok) fail(`当前参数组合不能本地恢复：${current.message}`);
      params = template.content(p1, p2, fixed).params;
    } else if (plan.kind === "brake") {
      expectedMode = { braking: parse.mode || "constant" };
      params = buildPhysicsBrakeContentBase(parse.v0, parse.parameter ?? parse.aAbs, {
        mode: parse.mode || "constant", gravity: parse.gravity || 9.8, mass: parse.mass || 1000
      }).params;
    } else if (plan.kind === "boardSlider") {
      params = buildPhysicsBoardSliderContent(parse.params).params;
    } else if (plan.kind === "solenoid") {
      expectedMode = { viewEnd: parse.viewEnd, windingDirection: parse.windingDirection, hasCore: parse.hasCore };
      params = buildPhysicsSolenoidContent(parse.current, parse.turns, parse).params;
      if (!Number.isInteger(p2)) fail("线圈匝数必须为整数");
    } else if (plan.kind === "projectile") {
      params = buildPhysicsProjectileContent(parse.speed, parse.height, parse.gravity, parse.projectileAsk).params;
    } else if (plan.kind === "circuit") {
      params = buildPhysicsCircuitContent(parse.voltage, parse.resistance, parse.circuitSolve).params;
    } else if (plan.kind === "chemistry") {
      expectedMode = { level: parse.chemForm.level, locked: data.mode.locked };
      parse.chemForm = { ...parse.chemForm, levelLocked: data.mode.locked };
      params = chemistryParams(parse.chemForm, parse.p1, parse.p2);
    } else if (plan.kind === "math") {
      params = [{ label: "自变量 x", min: parse.model.domainMin, max: parse.model.domainMax }, { label: "缩放倍率", min: 1, max: 1 }];
    } else if (plan.kind === "biology") {
      // The cell panel can explicitly select its own level even when the question names a level.
      expectedMode = { level: data.mode.level, locked: data.mode.locked };
    }
    if (!same(data.mode, expectedMode)) fail("实验模式与题目条件不一致");
    if (params) data.params.forEach((value, index) => paramIn(value, params[index]));
    // Copy only the validated whitelist. The planner's objects remain internal.
    const payload = { v: 1, subject: data.subject, question: data.question, grade: data.grade,
      template: data.template, params: [...data.params], mode: { ...expectedMode } };
    const prepared = { payload, plan };
    preparedValues.add(prepared);
    return prepared;
  }

  function capture() {
    if (restoring || $("#generateButton").classList.contains("loading")) fail("实验正在生成，请完成后再分享");
    if (!state.hasGenerated || !state.generatedSubjects.has(state.subject)) fail("请先生成实验，再分享当前实验");
    const generic = activeGenericTemplate();
    const template = generic?.id || (state.subject === "物理" ? state.physicsTemplate
      : state.subject === "化学" ? "chemistry" : state.subject === "数学" ? "math" : "biology");
    let mode = {};
    if (generic?.level === "both") mode = { level: generic.contentLevel(state.extraFixed[generic.id]), locked: Boolean(generic.fixedWithDefaults(state.extraFixed[generic.id]).levelLocked) };
    else if (template === "brake") mode = { braking: state.brakeMode };
    else if (template === "solenoid") mode = { viewEnd: state.solenoidViewEnd, windingDirection: state.solenoidWindingDirection, hasCore: state.solenoidHasCore };
    else if (template === "chemistry") mode = { level: chemistryForm().level, locked: chemistryForm().levelLocked };
    else if (template === "biology") mode = { level: state.cellLevel, locked: state.cellLevelLocked };
    const prepared = prepare({ v: 1, subject: state.subject, question: state.generatedQuestion,
      grade: state.gradeLevel, template, params: template === "biology" ? [] : [state.p1, state.p2], mode });
    const parse = prepared.plan.parse;
    // Confirm all fixed conditions that affect results; slider values may differ from the original question.
    let matches = true;
    if (generic) matches = same(generic.fixedWithDefaults(state.extraFixed[generic.id]), generic.fixedWithDefaults(parse.fixed));
    else if (template === "brake") matches = (state.brakeMode !== "friction" || same(state.brakeGravity, parse.gravity || 9.8))
      && (state.brakeMode !== "linear_drag" || same(state.brakeMass, parse.mass || 1000));
    else if (template === "boardSlider") matches = ["blockMass", "boardMass", "frictionCoefficient", "gravity"].every(key => same(state.boardSliderParams[key], parse.params[key]));
    else if (template === "projectile") matches = same(state.projectileGravity, parse.gravity);
    else if (template === "chemistry") matches = chemistryForm().excess === parse.chemForm.excess;
    else if (template === "math") matches = same(state.mathModel.spec, parse.model.spec);
    else if (template === "biology") matches = state.cellType === parse.cellType;
    if (!matches) fail("当前实验的固定条件无法由原题完整恢复，请重新生成后分享");
    return prepared;
  }

  function trusted(prepared) {
    if (!preparedValues.has(prepared)) fail("分享配置尚未通过校验");
    return prepared;
  }
  function applyParameters(value) {
    const { payload, plan } = trusted(value);
    if (plan.kind === "biology") {
      state.cellLevel = payload.mode.level;
      state.cellLevelLocked = payload.mode.locked;
      state.p1 = -10;
      state.p2 = currentCellOrganelles().length;
      syncBiologyContent(state.cellType, state.cellLevel);
      resetBiologyCellModel();
    } else {
      [state.p1, state.p2] = payload.params;
      if (plan.kind === "extra") syncGenericContent(plan.templateId);
      else if (plan.kind === "brake") syncPhysicsBrakeContent();
      else if (plan.kind === "boardSlider") {
        state.boardSliderParams = { ...state.boardSliderParams, initialSpeed: state.p1, boardLength: state.p2 };
        syncPhysicsBoardSliderContent();
      } else if (plan.kind === "solenoid") syncPhysicsSolenoidContent();
      else if (plan.kind === "projectile") syncPhysicsProjectileContent();
      else if (plan.kind === "circuit") syncPhysicsCircuitContent();
      else if (plan.kind === "chemistry") syncChemistryFeCuSO4Content();
      else if (plan.kind === "math") syncMathContent();
    }
    refreshGeneratedSubjectSurface(payload.subject);
    updateParameters();
    if (plan.kind !== "biology" && (!same(state.p1, payload.params[0]) || !same(state.p2, payload.params[1]))) fail("浏览器无法精确恢复这些参数");
    pauseExperiment();
    if (plan.kind === "solenoid") state.solenoidPaused = true;
    setCellAutoRotate(false);
    state.time = 0;
  }

  async function copy() {
    let url;
    try {
      const prepared = capture();
      if (location.protocol !== "https:" && location.protocol !== "http:") fail("请通过 HTTP 或 HTTPS 网页打开实验后分享");
      url = new URL(location.pathname, location.origin);
      url.hash = PREFIX + encode(prepared.payload);
      if (url.href.length > MAX_URL) fail("分享链接过长，请缩短题目后重新生成实验");
    } catch (error) {
      showToast(`无法分享：${error.message}`);
      return;
    }
    try {
      if (!navigator.clipboard?.writeText) fail("剪贴板不可用");
      await navigator.clipboard.writeText(url.href);
      showToast("实验分享链接已复制");
    } catch {
      showToast("复制失败，链接未复制；请检查浏览器的剪贴板权限及安全连接");
    }
  }

  async function restoreRoute(force = false) {
    const hash = location.hash;
    if ((!force && hash === lastRoute) || restoring) return;
    if (!hash.startsWith("#/share")) {
      // Legacy fragments only select a subject; no experiment was encoded in them.
      let subject;
      try { subject = decodeURIComponent(hash.slice(1)); } catch { return; }
      if (!SUBJECT_NAMES.includes(subject)) return;
      lastRoute = hash;
      state.userGeneratedOnce = true;
      if (state.autoDemoTimer) clearTimeout(state.autoDemoTimer);
      saveCurrentSubjectSnapshot();
      applyWaitingState(subject, { presetQuestion: true });
      showToast("旧链接仅包含学科，请输入题目并生成实验");
      return;
    }
    if ($("#generateButton").classList.contains("loading")) {
      showToast("实验正在生成；完成后请重新打开分享链接");
      return;
    }
    lastRoute = hash;
    // An invalid share must not start the optional homepage demo either.
    state.userGeneratedOnce = true;
    if (state.autoDemoTimer) clearTimeout(state.autoDemoTimer);
    let prepared;
    try {
      if (!hash.startsWith(PREFIX)) fail("分享链接格式无效");
      prepared = prepare(decode(hash));
    } catch (error) {
      reportFailure(`未恢复实验：${error.message}`);
      return;
    }
    restoring = true;
    const previousGrade = state.gradeLevel;
    const previousSnapshot = state.subjectSnapshots[prepared.payload.subject];
    const previouslyGenerated = state.generatedSubjects.has(prepared.payload.subject);
    try {
      saveCurrentSubjectSnapshot();
      // Do not run the grade-switch handler: it would rewrite the receiver's current experiment.
      state.gradeLevel = prepared.payload.grade;
      syncGradeSwitches();
      renderFavoriteList();
      const restored = await generateExperiment({ shared: prepared, questionOverride: prepared.payload.question, allowAiFallback: false });
      if (!restored) fail("实验生成未完成，请手动重试");
      showToast("已恢复分享实验、学段与参数，动画从初始暂停状态开始");
    } catch (error) {
      // Unexpected rendering failures leave an explicit waiting surface, never a default experiment.
      state.gradeLevel = previousGrade;
      syncGradeSwitches();
      renderFavoriteList();
      if (previousSnapshot) state.subjectSnapshots[prepared.payload.subject] = previousSnapshot;
      else delete state.subjectSnapshots[prepared.payload.subject];
      if (!previouslyGenerated) state.generatedSubjects.delete(prepared.payload.subject);
      applyWaitingState(prepared.payload.subject);
      $("#questionInput").value = prepared.payload.question;
      $("#generateButton").classList.remove("loading");
      $("#generateButton span").textContent = "生成实验";
      reportFailure(`恢复失败：${error.message}；仍可手动生成实验`);
    } finally {
      restoring = false;
    }
  }

  function reportFailure(message) {
    showToast(message);
    // Parser errors can quote URL text. Keep the persistent reason strictly text-only.
    if (!elements.parseFeedback) return;
    const label = document.createElement("span");
    label.textContent = "分享提示";
    const reason = document.createElement("strong");
    reason.textContent = message;
    elements.parseFeedback.replaceChildren(label, reason);
    elements.parseFeedback.classList.add("show", "error");
    elements.parseFeedback.classList.remove("pending");
  }

  window.MasterLabShare = Object.freeze({ copy, restoreRoute, applyParameters,
    planFor: value => trusted(value).plan });
  window.addEventListener("hashchange", () => restoreRoute());
  restoreRoute();
})();
