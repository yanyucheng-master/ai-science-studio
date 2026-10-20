/* Program-owned incline renderer: direct labels, measured bounds and responsive text. */
(() => {
  'use strict';
  const nodeModule = typeof module !== 'undefined' && module.exports;
  const Core = nodeModule ? require('./instant-scene.js') : window.MasterLabInstantScene;
  const Incline = nodeModule ? require('./incline-diagram.js') : window.MasterLabInclineDiagram;
  const NS = 'http://www.w3.org/2000/svg', observers = new WeakMap();
  let serial = 0;
  const svgNode = (tag, attributes = {}, text) => {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const add = (a, b, k = 1) => a.map((v, i) => v + b[i] * k);
  const boxOf = node => { const b = node.getBBox(); return [b.x, b.y, b.x + b.width, b.y + b.height]; };
  const boxesOverlap = (a, b, gap = 0) => a[0] < b[2] + gap && a[2] > b[0] - gap && a[1] < b[3] + gap && a[3] > b[1] - gap;
  // Liang-Barsky clipping catches crossings even when both segment ends lie outside the text.
  function segmentHitsBox(a, b, box, gap = 0) {
    const r = [box[0] - gap, box[1] - gap, box[2] + gap, box[3] + gap], d = b.map((v, i) => v - a[i]);
    let low = 0, high = 1;
    for (let axis = 0; axis < 2; axis++) {
      if (Math.abs(d[axis]) < 1e-10) { if (a[axis] < r[axis] || a[axis] > r[axis + 2]) return false; }
      else {
        const t = [(r[axis] - a[axis]) / d[axis], (r[axis + 2] - a[axis]) / d[axis]].sort((x, y) => x - y);
        low = Math.max(low, t[0]); high = Math.min(high, t[1]); if (low > high) return false;
      }
    }
    return true;
  }
  function placeLabel({ tip, direction }, placed, segments, { scale, measure }) {
    const initial = measure(0, 0), corners = [[0, 1], [0, 3], [2, 1], [2, 3]];
    const near = Math.min(...corners.map(([x, y]) => initial[x] * direction[0] + initial[y] * direction[1]));
    const base = add(tip, direction, 12 / scale - near), sideways = [-direction[1], direction[0]];
    for (const offset of [0, 14, -14, 28, -28, 42, -42, 56, -56, 70, -70]) {
      const position = add(base, sideways, offset / scale), box = measure(...position);
      if (box.every(Number.isFinite) && !placed.some(b => boxesOverlap(b, box, 3 / scale))
        && !segments.some(([a, b]) => segmentHitsBox(a, b, box, 3 / scale))) return { position, box };
    }
    throw new Error('LABEL_COLLISION');
  }
  function draw(host, raw, question) {
    const validated = Core.validateDiagram(raw, question);
    if (!validated.ok) throw new Error(validated.code);
    const program = Incline.createCompetitionScene(question);
    if (program.mode !== 'instant') throw new Error(program.code || 'UNSUPPORTED_LAYOUT');
    const checked = { ...validated, scene: program.scene }, scene = checked.scene;
    observers.get(host)?.disconnect();
    const prefix = `incline-${++serial}`, svg = svgNode('svg', { role: 'img', 'aria-labelledby': `${prefix}-title ${prefix}-desc`, class: 'instant-svg', 'data-scene-layout': 'incline' });
    svg.append(svgNode('title', { id: `${prefix}-title` }, scene.title), svgNode('desc', { id: `${prefix}-desc` },
      `${scene.explanation.join(' ')} 重力 G，支持力 F_N，摩擦力 f。字母紧邻箭头端点，三个箭头等长只表示方向。`));
    const defs = svgNode('defs'), content = svgNode('g', { class: 'instant-content' }); svg.append(defs, content);
    for (const name of ['orange', 'blue', 'teal']) {
      const marker = svgNode('marker', { id: `${prefix}-${name}`, viewBox: '0 0 10 10', refX: 10, refY: 5, markerWidth: 9, markerHeight: 9, markerUnits: 'userSpaceOnUse', orient: 'auto' });
      marker.append(svgNode('path', { d: 'M0 0 L10 5 L0 10 Z', fill: Core.palette[name] })); defs.append(marker);
    }
    const line = (parent, a, b, attributes = {}) => parent.append(svgNode('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], 'vector-effect': 'non-scaling-stroke', ...attributes }));
    const surface = scene.objects.find(o => o.role === 'surface'), body = scene.objects.find(o => o.role === 'body');
    const delta = surface.to.map((v, i) => v - surface.from[i]), length = Math.hypot(...delta), tangent = delta.map(v => v / length), normal = [tangent[1], -tangent[0]];
    const bottom = tangent[1] < 0 ? [surface.to[0], surface.from[1]] : [surface.from[0], surface.to[1]];
    const wedgePoints = [surface.from, surface.to, bottom], points = p => p.map(v => v.join(',')).join(' ');
    const clip = svgNode('clipPath', { id: `${prefix}-wedge-clip` }); clip.append(svgNode('polygon', { points: points(wedgePoints) })); defs.append(clip);
    const wedge = svgNode('g', { class: 'instant-wedge', stroke: Core.palette.ink, 'stroke-width': 1.8, fill: '#f3f7fb' });
    wedge.append(svgNode('polygon', { points: points(wedgePoints), 'vector-effect': 'non-scaling-stroke' })); content.append(wedge);
    const hatches = svgNode('g', { class: 'instant-rough-hatching', stroke: '#a8bdcf', 'stroke-width': 1, 'clip-path': `url(#${prefix}-wedge-clip)` }); content.append(hatches);
    for (let distance = 22; distance < length - 18; distance += 18) {
      const p = add(surface.from, tangent, distance); line(hatches, p, add(add(p, normal, -10), tangent, 5));
    }
    const segments = wedgePoints.map((p, i) => [p, wedgePoints[(i + 1) % 3]]);
    const objects = svgNode('g', { class: 'instant-objects' }); content.append(objects);
    for (const o of scene.objects) {
      const color = Core.palette[o.color || 'ink'], group = svgNode('g', { 'data-object-id': o.id, stroke: color, fill: Core.palette[o.fill || 'none'], 'stroke-width': o.type === 'arrow' ? 2.5 : 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }); objects.append(group);
      if (o.points) {
        group.append(svgNode('polygon', { points: points(o.points), 'vector-effect': 'non-scaling-stroke' }));
        o.points.forEach((p, i) => segments.push([p, o.points[(i + 1) % o.points.length]]));
      } else {
        line(group, o.from, o.to, o.type === 'arrow' ? { 'marker-end': `url(#${prefix}-${o.color})` } : {});
        segments.push([o.from, o.to]);
      }
    }
    const foot = body.points[0].map((v, i) => (v + body.points[1][i]) / 2), center = body.points[0].map((_, i) => body.points.reduce((sum, p) => sum + p[i], 0) / 4);
    const guide = svgNode('g', { class: 'instant-normal-guide', stroke: Core.palette.blue, 'stroke-width': 1, fill: 'none' }); content.append(guide);
    line(guide, foot, center, { 'stroke-dasharray': '3 3' });
    const angle = svgNode('polyline', { class: 'instant-right-angle', 'vector-effect': 'non-scaling-stroke', 'stroke-width': 1.5 }); guide.append(angle);
    content.append(svgNode('circle', { cx: center[0], cy: center[1], r: 2.2, fill: Core.palette.ink }));
    const labelGroup = svgNode('g', { class: 'instant-direct-labels', 'font-family': 'Microsoft YaHei, sans-serif', 'font-weight': 700 }); content.append(labelGroup);
    const labels = scene.objects.filter(o => o.type === 'arrow').map(o => {
      const d = o.to.map((v, i) => v - o.from[i]), direction = d.map(v => v / Math.hypot(...d));
      const text = svgNode('text', { 'data-label-target': o.id, class: 'instant-force-label', 'text-anchor': direction[0] > .25 ? 'start' : direction[0] < -.25 ? 'end' : 'middle', 'dominant-baseline': 'central', fill: Core.palette[o.color], stroke: '#ffffff', 'paint-order': 'stroke' });
      if (o.role === 'normal_force') { text.append(svgNode('tspan', {}, 'F'), svgNode('tspan', { 'baseline-shift': 'sub', class: 'instant-force-subscript' }, 'N')); }
      else text.textContent = o.role === 'gravity' ? 'G' : 'f';
      labelGroup.append(text); return { node: text, tip: o.to, direction };
    });
    host.classList.remove('is-compact'); host.classList.add('is-incline'); host.replaceChildren(svg);
    let lastWidth = 0;
    const layout = () => {
      const width = host.clientWidth || 320; lastWidth = width;
      if (width < 120) throw new Error('LAYOUT_TOO_NARROW');
      const heightLimit = host.closest('dialog') ? Math.max(320, window.innerHeight * .72) : 320;
      let scale = 1, viewBox;
      for (let pass = 0; pass < 12; pass++) {
        const size = 10 / scale;
        angle.setAttribute('points', points([add(foot, tangent, size), add(add(foot, tangent, size), normal, size), add(foot, normal, size)]));
        const placed = [];
        for (const label of labels) {
          label.node.setAttribute('font-size', 16 / scale); label.node.setAttribute('stroke-width', 3 / scale);
          label.node.querySelector('.instant-force-subscript')?.setAttribute('font-size', 12 / scale);
          const measure = (x, y) => { label.node.setAttribute('x', x); label.node.setAttribute('y', y); return boxOf(label.node); };
          placed.push(placeLabel(label, placed, segments, { scale, measure }).box);
        }
        for (const marker of defs.querySelectorAll('marker')) { marker.setAttribute('markerWidth', 9 / scale); marker.setAttribute('markerHeight', 9 / scale); }
        const b = content.getBBox(), pad = 28 / scale;
        viewBox = [b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2];
        const next = Math.min(width / viewBox[2], heightLimit / viewBox[3]);
        if (Math.abs(next - scale) < .0001) break;
        scale = next;
      }
      const factor = Math.min(width / viewBox[2], heightLimit / viewBox[3]);
      svg.setAttribute('viewBox', viewBox.join(' ')); svg.style.width = `${viewBox[2] * factor}px`; svg.style.height = `${viewBox[3] * factor}px`;
      svg.dataset.renderScale = String(factor);
      if (svg.querySelectorAll('*').length > Core.LIMITS.nodes) throw new Error('RENDER_BUDGET');
    };
    try { layout(); } catch (error) { host.replaceChildren(); host.classList.remove('is-incline'); throw error; }
    const observer = new ResizeObserver(() => {
      if (Math.abs(host.clientWidth - lastWidth) < .5) return;
      try { layout(); } catch { observer.disconnect(); host.replaceChildren(document.createTextNode('图示布局空间不足，已保留文字说明。')); }
    });
    observer.observe(host); observers.set(host, observer);
    return { svg, checked };
  }
  const api = Object.freeze({ draw, boxesOverlap, segmentHitsBox, placeLabel });
  if (typeof window !== 'undefined') window.MasterLabInstantRenderer = api;
  if (nodeModule) module.exports = api;
})();
