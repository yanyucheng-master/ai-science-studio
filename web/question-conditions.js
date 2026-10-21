/* Shared preflight for experiment generation and tutor questions. No AI requests. */
(() => {
  "use strict";
  const guard = () => window.MasterLabQuestionGuard;
  let activeDialog = null;

  function gravityReason(question, { forExperiment = false } = {}) {
    const G = guard(), source = G.normalize(question);
    // Direction-only diagrams and conceptual explanations need no numerical g.
    const asks = G.askItems(source).join("；");
    if (/画|绘|作图|示意图|受力图/.test(source) && /受力|力的方向/.test(source)
      && !/大小|多少|数值|加速度|时间|位移|距离|路程|射程|速度|压强|功|能量/.test(asks)) return "";
    const numericAsk = /计算|算出|估算|试求|求出|求得|(?<![要需请追恳])求(?!助)|多少|多大|多远|多久|几秒|几米/.test(source)
      && /距离|位移|时间|速度|加速度|力|压强|压力|功|能|质量|示数|读数|深度|高度|密度|滑落|周期|频率|摆长|摩擦因数|摩擦系数|μ/.test(asks || source);
    if (!numericAsk && !forExperiment) return "";
    if (!numericAsk && !G.extractQuantities(source).some(token => ["mass", "speed", "length", "volume", "density", "coef"].includes(token.cls))) return "";
    const brake = G.brakingOf(source);
    if (brake.candidate) return !brake.backgroundConfirmed && (brake.muValues.length || /摩擦(?:因数|系数)|μ/.test(asks)) ? "核对摩擦制动条件" : "";
    if (/平抛|水平抛|水平方向抛出|水平速度|水平初速度|沿水平方向|水平飞出|水平射出|自由落体|竖直.{0,3}抛/.test(source)) return "计算重力作用下的运动";
    if (/(?:木板|长木板)/.test(source) && /滑块|物块/.test(source) && /摩擦|μ/.test(source)) return "计算木板与滑块的摩擦和运动";
    if (/浮力|阿基米德/.test(source) && /体积|密度|排开|浸没/.test(source)) {
      const measuredForces = G.extractQuantities(source).filter(token => token.cls === "force");
      if (!(measuredForces.length >= 2 && /物重|重力|空气中/.test(source) && /测力计|示数|读数/.test(source))) return "由排液量计算浮力";
    }
    if (/压强|液体压力/.test(source) && /液体|水|酒精|煤油|深度|水深/.test(source)) return "计算液体压强";
    if (/\bmg\b|ρ\s*g|重力势能|重力做功/.test(source)) return "计算重力或重力势能";
    if (/单摆|摆长/.test(source) && /周期|频率|摆长/.test(asks)) return "计算单摆运动";
    const tokens = G.extractQuantities(source);
    const normalGiven = tokens.some(token => token.cls === "force"
      && /(?:压力|支持力|正压力|法向力|N)\s*(?:为|是|=|:)?\s*$/.test(source.slice(Math.max(0, token.index - 12), token.index)));
    if (normalGiven && /摩擦力/.test(asks) && !/重力|加速度|支持力|压力/.test(asks)) return "";
    if (tokens.some(token => token.cls === "mass")
      && /重力|物重|支持力|压力|下落|斜面|上坡|下坡|摩擦/.test(source)
      && /重力|物重|支持力|压力|摩擦力|加速度|做功|动能|势能/.test(asks)) return "由质量计算重力或摩擦作用";
    return "";
  }

  function inspect(question, options = {}) {
    const G = guard();
    if (!G) return { code: "CONDITIONS_UNAVAILABLE", message: "题目条件检查组件未加载，请刷新后重试。" };
    const brake = G.brakingOf(question), gravity = G.gravityOf(question, { allowAny: true });
    if (brake.candidate && brake.simpleModel && (brake.accelValues.length > 1 || brake.muValues.length > 1)) return {
      code: "CONFLICTING_BRAKE_VALUES", message: "题目对加速度或摩擦因数给出了不同数值，请先核对并修改条件。"
    };
    const reason = gravityReason(question, options);
    if (reason && !Number.isFinite(gravity.value)) return gravity.stated
      ? { code: "INVALID_GRAVITY", message: "题目中的 g 无法识别、数值冲突或不是正数，请核对后明确填写 g 的数值与单位。" }
      : { code: "MISSING_GRAVITY", message: `本题需要 g 来${reason}，题干尚未给出。是否取 g = 10 m/s²？` };
    if (reason && brake.candidate && brake.simpleModel && brake.muValues.length && brake.accelValues.length && !brake.backgroundConfirmed
      && !G.approx(brake.acceleration, brake.mu * gravity.value)) return {
      code: "BRAKE_MODEL_REQUIRED", allowBackground: !brake.soleFriction,
      message: `题给加速度大小为 ${brake.acceleration} m/s²、摩擦因数为 ${brake.mu}；在水平滑动摩擦模型下，μg = ${G.tidy(brake.mu * gravity.value)} m/s²，二者不一致。`
        + (brake.soleFriction ? "题干明确只有摩擦制动，请返回修改条件后再解答。"
          : "题干未明确减速是否完全由摩擦提供。请确认按已给加速度处理、将摩擦因数保留为背景信息，或返回修改题目。")
    };
    return null;
  }

  function ask(issue, isCurrent) {
    if (activeDialog || !document.body) return Promise.resolve(null);
    return new Promise(resolve => {
      const previousFocus = document.activeElement;
      const dialog = document.createElement("dialog");
      dialog.id = "questionConditionsDialog";
      dialog.className = "question-conditions-dialog";
      dialog.setAttribute("aria-labelledby", "questionConditionsTitle");
      dialog.setAttribute("aria-describedby", "questionConditionsDescription");
      const heading = document.createElement("h2");
      heading.id = "questionConditionsTitle";
      heading.textContent = issue.code === "MISSING_GRAVITY" ? "确认重力加速度" : "请先核对题目条件";
      const description = document.createElement("p");
      description.id = "questionConditionsDescription";
      description.textContent = issue.message;
      const actions = document.createElement("div");
      actions.className = "question-conditions-actions";
      const finish = value => {
        if (activeDialog !== dialog) return;
        activeDialog = null;
        window.removeEventListener("hashchange", cancel);
        window.removeEventListener("pagehide", cancel);
        if (dialog.open) dialog.close();
        dialog.remove();
        if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
        resolve(isCurrent() ? value : null);
      };
      const cancel = () => finish(null);
      const button = (label, value, primary = false) => {
        const element = document.createElement("button");
        element.type = "button";
        element.textContent = label;
        if (primary) { element.className = "is-primary"; element.autofocus = true; }
        element.addEventListener("click", () => finish(value));
        actions.append(element);
      };
      if (issue.code === "MISSING_GRAVITY") {
        button("是，取 10 m/s²", "10", true);
        button("取 9.8 m/s²", "9.8");
      } else if (issue.code === "BRAKE_MODEL_REQUIRED" && issue.allowBackground) {
        button("按已给加速度，μ 仅作背景", "background", true);
      }
      button("返回补充或修改", null);
      dialog.append(heading, description, actions);
      dialog.addEventListener("cancel", event => { event.preventDefault(); cancel(); });
      dialog.addEventListener("close", cancel);
      window.addEventListener("hashchange", cancel);
      window.addEventListener("pagehide", cancel);
      document.body.append(dialog);
      activeDialog = dialog;
      try { dialog.showModal(); } catch { cancel(); }
    });
  }

  async function resolve(question, { isCurrent = () => true, forExperiment = false } = {}) {
    if (activeDialog) return { ok: false, cancelled: true };
    let prepared = String(question || "").trim();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (!isCurrent()) return { ok: false, cancelled: true };
      const issue = inspect(prepared, { forExperiment });
      if (!issue) return { ok: true, question: prepared, changed: prepared !== String(question).trim() };
      const answer = await ask(issue, isCurrent);
      if (!answer) return { ok: false, cancelled: true, issue };
      prepared += answer === "background" ? `\n（${guard().BRAKE_BACKGROUND_CONFIRMATION}）`
        : `\n（用户确认：g = ${answer}m/s²。）`;
    }
    return { ok: false, cancelled: true };
  }

  window.MasterLabQuestionConditions = Object.freeze({ inspect, resolve, gravityReason, get pending() { return Boolean(activeDialog); } });
})();
