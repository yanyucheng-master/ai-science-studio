/* Deterministic incline conditions -> forces -> legacy scene primitives. No network or credentials. */
(() => {
  'use strict';
  const Core = typeof module !== 'undefined' && module.exports ? require('./instant-scene.js') : window.MasterLabInstantScene;
  const FIELDS = ['scene', 'rises', 'surface', 'motion', 'otherForces', 'directionOnly', 'asks'];
  const VERSION = 2;
  function schema() {
    return { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', additionalProperties: false, required: [...FIELDS], properties: {
      scene: { const: 'incline' }, rises: { enum: ['left', 'right'] }, surface: { enum: ['rough', 'smooth'] },
      motion: { enum: ['static', 'uniform_down', 'uniform_up', 'accelerating'] }, otherForces: { type: 'array', maxItems: 0 },
      directionOnly: { type: 'boolean' }, asks: { type: 'array', items: { const: 'force_diagram' }, minItems: 1, maxItems: 1 }
    } };
  }
  function validConditions(value) {
    return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === FIELDS.length
      && FIELDS.every(key => Object.hasOwn(value, key)) && value.scene === 'incline'
      && ['left', 'right'].includes(value.rises) && ['rough', 'smooth'].includes(value.surface)
      && ['static', 'uniform_down', 'uniform_up', 'accelerating'].includes(value.motion)
      && Array.isArray(value.otherForces) && value.otherForces.length === 0 && typeof value.directionOnly === 'boolean'
      && Array.isArray(value.asks) && value.asks.length === 1 && value.asks[0] === 'force_diagram';
  }
  function derive(conditions) {
    const right = conditions.rises === 'right';
    return [{ role: 'gravity', direction: 'down' }, { role: 'normal_force', direction: right ? 'up_left' : 'up_right' },
      { role: 'friction', kind: conditions.motion === 'static' ? 'static' : 'kinetic', direction: right ? 'up_right' : 'up_left' }];
  }
  function layout(question, c) {
    // The drawing angle and lengths are display constants, never physical inputs or magnitudes.
    const angle = 28 * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle), right = c.rises === 'right';
    const tangent = [cos, right ? -sin : sin], normal = [tangent[1], -tangent[0]], uphill = right ? tangent : tangent.map(v => -v);
    const foot = [280, 265], height = 46, width = 90, length = 70;
    const shift = (p, v, k) => [p[0] + v[0] * k, p[1] + v[1] * k];
    const center = shift(foot, normal, height / 2), p0 = shift(foot, tangent, -width / 2), p1 = shift(foot, tangent, width / 2);
    const surfaceFrom = [70, foot[1] - tangent[1] / tangent[0] * 210], surfaceTo = [490, foot[1] + tangent[1] / tangent[0] * 210];
    const frictionName = c.motion === 'static' ? '静摩擦力' : '滑动摩擦力';
    const arrow = (id, role, direction, color) => ({ id, role, type: 'arrow', color, from: [...center], to: shift(center, direction, length) });
    return { version: 1, status: 'scene', subject: '物理', title: c.motion === 'static' ? '斜面上静止物块受力示意图' : '斜面上匀速下滑物块受力示意图',
      givens: [question], basis: ['重力方向竖直向下。', '斜面对物块的支持力垂直斜面并指向外侧。',
        c.motion === 'static' ? '物块有沿斜面下滑的趋势，静摩擦力沿斜面向上。' : '物块相对斜面向下滑动，滑动摩擦力沿斜面向上。'],
      assumptions: ['图形仅作示意，不按比例。'], explanation: [c.motion === 'static' ? '物块静止，受到重力、支持力和静摩擦力。' : '物块匀速下滑，受到重力、支持力和滑动摩擦力。',
        `重力竖直向下；支持力指向${right ? '左上' : '右上'}；${frictionName}沿斜面向${right ? '右上' : '左上'}。`,
        '箭头等长只为表示方向，不表示各力大小相等；图中的倾角与长度不用于数值计算。'],
      objects: [{ id: 'surface', type: 'line', role: 'surface', color: 'ink', from: surfaceFrom, to: surfaceTo },
        { id: 'body', type: 'polygon', role: 'body', color: 'ink', fill: 'pale', points: [p0, p1, shift(p1, normal, height), shift(p0, normal, height)] },
        arrow('gravity', 'gravity', [0, 1], 'orange'), arrow('normal_force', 'normal_force', normal, 'blue'), arrow('friction', 'friction', uphill, 'teal')],
      labels: [{ target: 'surface', text: '粗糙斜面' }, { target: 'body', text: '物块' }, { target: 'gravity', text: '重力 G' },
        { target: 'normal_force', text: '支持力 N' }, { target: 'friction', text: frictionName + ' f' }],
      relations: [{ type: 'perpendicular', objects: ['surface', 'normal_force'] }, { type: 'parallel', objects: ['surface', 'friction'] },
        { type: 'equalLength', objects: ['gravity', 'normal_force'] }, { type: 'equalLength', objects: ['gravity', 'friction'] }], calculations: [] };
  }
  function createScene(question, { aiConditions } = {}) {
    const decline = reason => ({ mode: 'explanation', code: 'DECLINED', reason });
    const local = Core.inspectIncline(question);
    if (!local.ok) return decline(local.reason);
    if (aiConditions !== undefined && aiConditions !== null) {
      if (!validConditions(aiConditions)) return decline('条件对象格式不符合约定，保留文字讲解。');
      if (!FIELDS.every(key => JSON.stringify(aiConditions[key]) === JSON.stringify(local.conditions[key]))) return decline('条件输出与原题独立核对不一致，保留文字讲解。');
    }
    const conditions = local.conditions;
    if (!validConditions(conditions) || conditions.surface !== 'rough' || !['static', 'uniform_down'].includes(conditions.motion)) return decline('当前条件没有可靠的受力图模型。');
    const checked = Core.validateDiagram(layout(question, conditions), question);
    if (!checked.ok) return decline('程序受力图未通过独立几何核对，保留文字讲解。');
    return { mode: 'instant', source: 'program-incline', layoutVersion: VERSION, conditions, forces: derive(conditions), scene: checked.scene, checks: checked.checks };
  }
  const api = Object.freeze({ VERSION, schema, createScene });
  if (typeof window !== 'undefined') window.MasterLabInclineDiagram = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
