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

  function bindCircuit(svg, phase = 0) {
    const path = svg.querySelector(".current-loop");
    const length = path.getTotalLength();
    const dots = [...svg.querySelectorAll(".circuit-current-pulse")];
    const arrows = [...svg.querySelectorAll(".current-direction")];
    const motion = { svg, current: 0, phase, get closed() { return !!svg.querySelector(".edu-switch-closed"); },
      render(dt = 0, reduced = false) {
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
          const distance = length * (i ? 0.74 : 0.19);
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
