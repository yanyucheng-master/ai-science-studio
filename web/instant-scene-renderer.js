(() => {
  'use strict';
  const Core = window.MasterLabInstantScene;
  const NS = 'http://www.w3.org/2000/svg'; let serial = 0;
  const observers = new WeakMap();
  const svgNode = (tag, attributes = {}, content) => {
    const node = document.createElementNS(NS, tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
    if (content !== undefined) node.textContent = content;
    return node;
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const nearestOnSegment = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return [a[0] + t * dx, a[1] + t * dy];
  };
  // Annotations must end on the actual shape, never an empty corner of its bounding box.
  function anchor(o) {
    if (o.to) return o.to;
    if (o.type === 'arc') { const a = (o.start + o.end) / 2 * Math.PI / 180; return [o.cx + o.r * Math.cos(a), o.cy + o.r * Math.sin(a)]; }
    const b = Core.bounds(o), desired = [b[0], (b[1] + b[3]) / 2];
    if (o.points) {
      let best = o.points[0], score = Infinity;
      for (let i = 1; i < o.points.length + (o.type === 'polygon' ? 1 : 0); i++) {
        const p = nearestOnSegment(desired, o.points[i - 1], o.points[i % o.points.length]);
        const d = Math.hypot(p[0] - desired[0], p[1] - desired[1]);
        if (d < score) { best = p; score = d; }
      }
      return best;
    }
    if (o.type === 'curve') {
      const fn = Core.expression(o.expression);
      for (const t of [.65, .35, .8, .2, .5, 0, 1]) {
        const y = fn(o.xMin + t * (o.xMax - o.xMin));
        if (Number.isFinite(y) && y >= o.yMin && y <= o.yMax) return [o.x + t * o.width, o.y + o.height * (1 - (y - o.yMin) / (o.yMax - o.yMin))];
      }
      throw new Error('EMPTY_CURVE');
    }
    return desired;
  }
  function selectPin(target, used, objects, textBounds) {
    const candidates = [];
    for (const radius of [23, 38, 56, 76]) for (let i = 0; i < 8; i++) {
      const angle = (-135 + i * 45) * Math.PI / 180;
      const p = [clamp(target[0] + Math.cos(angle) * radius, 16, 559), clamp(target[1] + Math.sin(angle) * radius, 16, 434)];
      if (used.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 36)) continue;
      // Reserve the largest (mobile) bubble radius plus a gap around axis text.
      if (textBounds.some(b => Math.hypot(p[0] - clamp(p[0], b[0], b[2]), p[1] - clamp(p[1], b[1], b[3])) < 18)) continue;
      // Prefer clear space. Bounding boxes are a conservative layout penalty, not a science check.
      const crowded = objects.filter(o => { const b = Core.bounds(o); return p[0] > b[0] - 7 && p[0] < b[2] + 7 && p[1] > b[1] - 7 && p[1] < b[3] + 7; }).length;
      candidates.push({ p, score: crowded * 80 + radius + i / 10 });
    }
    candidates.sort((a, b) => a.score - b.score);
    if (!candidates.length) throw new Error('LABEL_COLLISION');
    return candidates[0].p;
  }
  function draw(host, raw, question) {
    const checked = Core.validate(raw, question);
    if (!checked.ok) throw new Error(checked.code);
    const scene = checked.scene, prefix = `instant-${++serial}`;
    const svg = svgNode('svg', { viewBox: '0 0 800 450', role: 'img', 'aria-labelledby': `${prefix}-title ${prefix}-desc`, class: 'instant-svg' });
    svg.append(svgNode('title', { id: `${prefix}-title` }, scene.title), svgNode('desc', { id: `${prefix}-desc` }, `${scene.explanation.join(' ')}。图示不按比例，右侧编号与对象对应。`));
    const defs = svgNode('defs'); svg.append(defs);
    for (const [name, color] of Object.entries(Core.palette)) {
      if (name === 'none') continue;
      const marker = svgNode('marker', { id: `${prefix}-${name}`, viewBox: '0 0 10 10', refX: 8.5, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
      marker.append(svgNode('path', { d: 'M0 0 L10 5 L0 10 Z', fill: color })); defs.append(marker);
    }
    svg.append(svgNode('rect', { x: 0, y: 0, width: 800, height: 450, rx: 14, fill: '#f8fbff' }));
    svg.append(svgNode('line', { x1: 575, y1: 25, x2: 575, y2: 425, stroke: '#dbe7f3', 'stroke-width': 1, class: 'instant-legend-right' }));
    const main = svgNode('g', { class: 'instant-objects' }); svg.append(main);
    const byId = new Map(scene.objects.map(o => [o.id, o]));
    const axisTextBounds = [];
    const line = (group, from, to, attrs = {}) => group.append(svgNode('line', { x1: from[0], y1: from[1], x2: to[0], y2: to[1], ...attrs }));
    const axisText = (group, attrs, value) => {
      // Numeric axis text uses a conservative width before the SVG is mounted.
      const size = attrs['font-size'], width = String(value).length * size * .8;
      const x = attrs.x - (attrs['text-anchor'] === 'middle' ? width / 2 : attrs['text-anchor'] === 'end' ? width : 0);
      const left = clamp(x, 4, 571 - width), baseline = clamp(attrs.y, size + 4, 446 - size * .25);
      const box = [left, baseline - size, left + width, baseline + size * .25];
      if (axisTextBounds.some(b => box[0] < b[2] + 2 && box[2] > b[0] - 2 && box[1] < b[3] + 2 && box[3] > b[1] - 2)) throw new Error('AXIS_TEXT_COLLISION');
      axisTextBounds.push(box);
      group.append(svgNode('text', { ...attrs, x: attrs.x + left - x, y: baseline, class: 'instant-axis-label' }, value));
    };
    const drawAxes = (group, o) => {
      const sx = x => o.x + (x - o.xMin) / (o.xMax - o.xMin) * o.width;
      const sy = y => o.y + o.height - (y - o.yMin) / (o.yMax - o.yMin) * o.height;
      const x0 = sx(Math.max(o.xMin, Math.min(o.xMax, 0))), y0 = sy(Math.max(o.yMin, Math.min(o.yMax, 0)));
      for (let i = 0; i <= 4; i++) {
        const x = o.xMin + (o.xMax - o.xMin) * i / 4, y = o.yMin + (o.yMax - o.yMin) * i / 4;
        line(group, [sx(x), o.y], [sx(x), o.y + o.height], { stroke: '#e0eaf4', 'stroke-width': 1 });
        line(group, [o.x, sy(y)], [o.x + o.width, sy(y)], { stroke: '#e0eaf4', 'stroke-width': 1 });
        axisText(group, { x: sx(x), y: y0 + 17, 'text-anchor': 'middle', 'font-size': 12, stroke: 'none', fill: '#586e86' }, Number(x.toPrecision(12)));
        if (Math.abs(y) > 1e-8) axisText(group, { x: x0 - 7, y: sy(y) + 4, 'text-anchor': 'end', 'font-size': 12, stroke: 'none', fill: '#586e86' }, Number(y.toPrecision(12)));
      }
      line(group, [o.x, y0], [o.x + o.width, y0], { 'marker-end': `url(#${prefix}-ink)` });
      line(group, [x0, o.y + o.height], [x0, o.y], { 'marker-end': `url(#${prefix}-ink)` });
      axisText(group, { x: o.x + o.width - 7, y: y0 - 9, 'font-size': 14, fill: '#274363', stroke: 'none' }, 'x');
      axisText(group, { x: x0 + 10, y: o.y + 12, 'font-size': 14, fill: '#274363', stroke: 'none' }, 'y');
    };
    for (const o of scene.objects) {
      const color = o.color || 'blue';
      const group = svgNode('g', { 'data-object-id': o.id, stroke: Core.palette[color], fill: Core.palette[o.fill || 'none'], 'stroke-width': 2.3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...(o.dashed ? { 'stroke-dasharray': '6 5' } : {}) }); main.append(group);
      if (o.type === 'line' || o.type === 'arrow') line(group, o.from, o.to, o.type === 'arrow' ? { 'marker-end': `url(#${prefix}-${color})` } : {});
      else if (['rect', 'circle', 'ellipse'].includes(o.type)) {
        const attrs = {}; for (const k of { rect: ['x', 'y', 'width', 'height'], circle: ['cx', 'cy', 'r'], ellipse: ['cx', 'cy', 'rx', 'ry'] }[o.type]) attrs[k] = o[k];
        group.append(svgNode(o.type, attrs));
      } else if (o.type === 'polygon' || o.type === 'polyline') group.append(svgNode(o.type, { points: o.points.map(p => p.join(',')).join(' ') }));
      else if (o.type === 'arc') {
        const a = o.start * Math.PI / 180, b = o.end * Math.PI / 180;
        group.append(svgNode('path', { d: `M${o.cx + o.r * Math.cos(a)} ${o.cy + o.r * Math.sin(a)} A${o.r} ${o.r} 0 ${Math.abs(o.end - o.start) > 180 ? 1 : 0} ${o.end > o.start ? 1 : 0} ${o.cx + o.r * Math.cos(b)} ${o.cy + o.r * Math.sin(b)}` }));
      } else if (o.type === 'axes') drawAxes(group, o);
      else if (o.type === 'curve') {
        const fn = Core.expression(o.expression); let d = '', previous = null;
        for (let i = 0; i <= 240; i++) {
          const x = o.xMin + (o.xMax - o.xMin) * i / 240, y = fn(x);
          if (!Number.isFinite(y) || y < o.yMin || y > o.yMax) { previous = null; continue; }
          const px = o.x + i / 240 * o.width, py = o.y + o.height - (y - o.yMin) / (o.yMax - o.yMin) * o.height;
          d += `${previous !== null && Math.abs(py - previous) < o.height / 3 ? 'L' : 'M'}${px.toFixed(2)} ${py.toFixed(2)} `; previous = py;
        }
        group.append(svgNode('path', { d, fill: 'none' }));
      }
    }
    const legend = svgNode('g', { class: 'instant-legend', fill: '#274363', 'font-family': 'Microsoft YaHei, sans-serif' }); svg.append(legend);
    const used = [];
    const rowHeight = Math.min(48, 384 / scene.labels.length);
    scene.labels.forEach((label, i) => {
      const o = byId.get(label.target), y = 48 + i * rowHeight;
      const target = anchor(o), pin = selectPin(target, used, scene.objects, axisTextBounds);
      used.push(pin);
      line(legend, pin, target, { stroke: '#8195ac', 'stroke-width': 1, 'data-label-target': label.target });
      legend.append(svgNode('circle', { cx: pin[0], cy: pin[1], r: 10, fill: '#fff', stroke: '#c4d6e8', class: 'instant-pin' }));
      legend.append(svgNode('text', { x: pin[0], y: pin[1], 'dominant-baseline': 'central', 'font-size': 12, 'text-anchor': 'middle', class: 'instant-pin-label' }, i + 1));
      const right = svgNode('g', { class: 'instant-legend-right' }); legend.append(right);
      right.append(svgNode('circle', { cx: 597, cy: y - 5, r: 10, fill: '#e1effc' }));
      right.append(svgNode('text', { x: 597, y: y - 1, 'font-size': 12, 'text-anchor': 'middle' }, i + 1));
      const text = svgNode('text', { x: 615, y, 'font-size': 18, class: 'instant-label' }, Core.displayText(label.text)); right.append(text);
    });
    const mobile = document.createElement('ol'); mobile.className = 'instant-mobile-legend';
    for (const label of scene.labels) { const item = document.createElement('li'); item.textContent = Core.displayText(label.text); mobile.append(item); }
    observers.get(host)?.disconnect(); host.classList.remove('is-compact'); host.replaceChildren(svg, mobile);
    window.ScienceFormula?.enhance(svg);
    for (const node of svg.querySelectorAll('.instant-label')) {
      const box = node.getBBox();
      if (box.width > 166 || box.height > rowHeight - 6) {
        const scale = Math.min(166 / box.width, (rowHeight - 6) / box.height);
        if (scale < .66) { host.replaceChildren(); throw new Error('LABEL_TOO_WIDE'); }
        const group = svgNode('g', { transform: `translate(615 ${node.getAttribute('y')}) scale(${scale}) translate(-615 -${node.getAttribute('y')})` });
        node.before(group); group.append(node);
        while (group.nextElementSibling?.classList.contains('science-formula-rule')) group.append(group.nextElementSibling);
      }
    }
    if (svg.querySelectorAll('*').length > Core.LIMITS.nodes) { host.replaceChildren(); throw new Error('RENDER_BUDGET'); }
    window.ScienceFormula?.enhance(mobile);
    const resize = () => { const compact = !host.closest('dialog') && host.clientWidth < 620; host.classList.toggle('is-compact', compact); svg.setAttribute('viewBox', compact ? '0 0 575 450' : '0 0 800 450'); };
    resize(); const observer = new ResizeObserver(resize); observer.observe(host); observers.set(host, observer);
    return { svg, checked };
  }
  window.MasterLabInstantRenderer = Object.freeze({ draw });
})();
