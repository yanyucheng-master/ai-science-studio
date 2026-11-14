/* Small, dependency-free geometry and an owned RAF clock. Scientific values stay in app.js. */
(function (root) {
  "use strict";
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  function createClock({ request, cancel, active, render }) {
    let id = null;
    let last = null;
    let rendering = false;
    function stop() {
      if (id !== null) cancel(id);
      id = null;
      last = null;
    }
    function reconcile() {
      if (!active()) { stop(); return; }
      if (id === null && !rendering) id = request(frame);
    }
    function frame(timestamp) {
      id = null;
      if (!active()) { last = null; return; }
      const dt = last === null ? 0 : clamp((timestamp - last) / 1000, 0, 0.06);
      last = timestamp;
      rendering = true;
      try { render(dt, timestamp); } finally { rendering = false; reconcile(); }
    }
    return { reconcile, stop, get pending() { return id !== null; } };
  }

  function projectileGeometry(model, time) {
    const t = clamp(time, 0, model.fallTime);
    // One spatial scale for both axes; one separate velocity scale for all vectors.
    const scale = Math.min(390 / model.range, 130 / model.height);
    const velocityScale = Math.min(90 / model.speed, 60 / model.verticalSpeed);
    const origin = { x: 80, y: 200 - model.height * scale };
    const at = s => ({ x: origin.x + model.speed * s * scale,
      y: origin.y + 0.5 * model.gravity * s * s * scale });
    const point = at(t);
    const path = end => Array.from({ length: 49 }, (_, i) => {
      const p = at(end * i / 48);
      return `${i ? "L" : "M"}${p.x.toFixed(3)} ${p.y.toFixed(3)}`;
    }).join(" ");
    // Fixed physical interval (0.2 s), not a fraction of flight duration.
    const ghosts = Array.from({ length: Math.floor((t + 1e-9) / 0.2) + 1 }, (_, i) => at(i * 0.2));
    return { t, point, origin, scale, velocityScale, trail: path(t), prediction: path(model.fallTime),
      ghosts, vx: model.speed, vy: model.gravity * t,
      dx: model.speed * velocityScale, dy: model.gravity * t * velocityScale };
  }

  function reactionAt(model, progress) {
    const p = clamp(progress, 0, 1);
    // Staged presentation only: no kinetic rate is supplied by this question.
    const contact = clamp(p / 0.15, 0, 1);
    const extent = clamp((p - 0.15) / 0.75, 0, 1);
    const producedMol = model.reactedMol * extent;
    return { contact, extent, producedMol, producedMass: producedMol * 64,
      feLeftMol: Math.max(0, model.feMol - producedMol),
      cuso4Left: Math.max(0, model.cuso4Mol - producedMol),
      stage: p < 0.15 ? "加入铁粉 · 尚未接触" : extent === 0 ? "接触溶液 · 反应开始" :
        extent < 1 ? "铁表面析铜 · 溶液逐渐变色" : "限量反应物耗尽 · 反应停止" };
  }

  const currentSpeed = current => current > 0 ? 80 * Math.sqrt(current) : 0;
  function circuitMarkup(path) {
    return `<g class="circuit-current-pulses" aria-hidden="true">
      <path class="current-loop" d="${path}" fill="none" stroke="none"></path>
      ${Array.from({ length: 8 }, () => '<circle class="circuit-current-pulse" r="4"></circle>').join("")}
      <path class="current-direction" d="M-6 -4L0 0L-6 4"></path>
      <path class="current-direction" d="M-6 -4L0 0L-6 4"></path>
    </g>`;
  }

  // 电流脉冲层放在导线之上、元件和文字之下：元件体是不透明的白底，脉冲经过时被挡住，
  // 不会再盖住“R = 3Ω”之类的标注（原先追加在 SVG 末尾，压在所有东西上面）。
  function seatPulseLayer(svg) {
    const layer = svg.querySelector(".circuit-current-pulses");
    const wire = svg.querySelector("g.edu-wire") || svg.querySelector(".edu-wire");
    if (!layer || !wire || layer.dataset.seated) return;
    let anchor = wire;
    while (anchor.parentNode && anchor.parentNode !== svg) anchor = anchor.parentNode;
    if (anchor.parentNode === svg && anchor.nextSibling !== layer) anchor.after(layer);
    layer.dataset.seated = "1";
  }

  // 方向箭头不放在元件、开关、读数和文字上：从默认位置沿回路往前找第一段空闲的直线导线
  const ARROW_DEFAULTS = [0.19, 0.74];
  const ARROW_KEEPOUT = ".edu-meter circle, .resistor-body, .edu-variable-resistor rect, .lamp-circle, .lamp-halo, .edu-switch, .edu-source, .junction, .rheostat-terminal, .svg-reading-badge, text";
  function arrowFractions(svg, path, length) {
    const matrix = svg.getScreenCTM?.();
    if (!matrix || !length) return ARROW_DEFAULTS.slice();
    const inverse = matrix.inverse();
    const zones = [...svg.querySelectorAll(ARROW_KEEPOUT)]
      .filter(node => !node.closest("defs") && !node.closest(".circuit-current-pulses"))
      .map(node => {
        const box = node.getBoundingClientRect();
        if (!box.width && !box.height) return null;
        const a = new DOMPoint(box.left, box.top).matrixTransform(inverse);
        const b = new DOMPoint(box.right, box.bottom).matrixTransform(inverse);
        const pad = node.matches("text") ? 6 : 12;
        return { l: Math.min(a.x, b.x) - pad, r: Math.max(a.x, b.x) + pad, t: Math.min(a.y, b.y) - pad, b: Math.max(a.y, b.y) + pad };
      }).filter(Boolean);
    const free = d => {
      const p = path.getPointAtLength(d);
      return !zones.some(z => p.x >= z.l && p.x <= z.r && p.y >= z.t && p.y <= z.b);
    };
    const straight = d => {
      const p0 = path.getPointAtLength(Math.max(0, d - 9)), p1 = path.getPointAtLength(Math.min(length, d + 9));
      const mid = path.getPointAtLength(d);
      return Math.abs((p1.x - p0.x) * (mid.y - p0.y) - (p1.y - p0.y) * (mid.x - p0.x)) < 1.5 * Math.hypot(p1.x - p0.x, p1.y - p0.y);
    };
    return ARROW_DEFAULTS.map(start => {
      for (let step = 0; step <= 1000; step += 1) {
        for (const sign of step ? [1, -1] : [1]) {
          const fraction = start + sign * step / 1000;
          if (fraction < 0.03 || fraction > 0.97) continue;
          const d = fraction * length;
          if (free(d) && straight(d)) return fraction;
        }
      }
      return start;
    });
  }

  function bindCircuit(svg, phase = 0) {
    seatPulseLayer(svg);
    const path = svg.querySelector(".current-loop");
    const length = path.getTotalLength();
    const dots = [...svg.querySelectorAll(".circuit-current-pulse")];
    const arrows = [...svg.querySelectorAll(".current-direction")];
    let fractions = ARROW_DEFAULTS.slice();
    let measured = false;
    const motion = { svg, current: 0, phase, get closed() { return !!svg.querySelector(".edu-switch-closed"); },
      render(dt = 0, reduced = false) {
        // 隐藏（display:none）时取不到屏幕矩阵；等画面出现后再量一次
        if (!measured && svg.getScreenCTM?.()) { fractions = arrowFractions(svg, path, length); measured = true; }
        const conducting = motion.current > 0 && motion.closed;
        if (conducting && !reduced) motion.phase = (motion.phase + currentSpeed(motion.current) * dt / length) % 1;
        svg.dataset.current = String(motion.current);
        dots.forEach((dot, i) => {
          dot.style.display = conducting && !reduced ? "" : "none";
          const p = path.getPointAtLength(((motion.phase + i / dots.length) % 1) * length);
          dot.setAttribute("transform", `translate(${p.x} ${p.y})`);
        });
        arrows.forEach((arrow, i) => {
          arrow.style.display = conducting ? "" : "none";
          const distance = length * fractions[i];
          const p = path.getPointAtLength(distance), next = path.getPointAtLength(distance + 1);
          arrow.setAttribute("transform", `translate(${p.x} ${p.y}) rotate(${Math.atan2(next.y-p.y, next.x-p.x)*180/Math.PI})`);
        });
      }
    };
    return motion;
  }

  const api = { createClock, projectileGeometry, reactionAt, currentSpeed, circuitMarkup, bindCircuit };
  root.ScienceMotion = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
