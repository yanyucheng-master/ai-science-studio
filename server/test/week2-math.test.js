// 第 2 周数学通用模板（web/math-extra.js）：严格解析、精确计算与两种讲法。
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const web = path => readFile(new URL(`../../web/${path}`, import.meta.url), 'utf8');
const sandbox = { ScienceMotion: { circuitMarkup: () => '' }, console };
sandbox.window = sandbox;
vm.runInNewContext(await web('physics-extra.js'), sandbox);
vm.runInNewContext(await web('math-extra.js'), sandbox);
const registry = sandbox.MASTER_LAB_TEMPLATES;
const bank = JSON.parse(await readFile(new URL('../eval/local-template-bank.json', import.meta.url), 'utf8'));
const near = (actual, expected, label = '') => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-9 * Math.max(1, Math.abs(expected)), `${label} ${actual} != ${expected}`);
const quadratic = registry.quadratic;

test('math templates register under 数学 and never enter the physics view', () => {
  assert.equal(quadratic.subject, '数学');
  assert.equal(quadratic.level, 'both');
  assert.equal(quadratic.scene, 'math');
  assert.equal(quadratic.block, '函数');
  assert.equal('quadratic' in sandbox.EXTRA_PHYSICS_TEMPLATES, false);
  const content = quadratic.content(-4, 3, { a: 1 });
  assert.equal(content.subject, '数学');
  assert.equal(content.visualHtml, '');
  assert.ok(content.graph && content.graph.curves.length === 1);
});

const answerOf = (template, parsed) => {
  const model = template.model(parsed.p1, parsed.p2, template.fixedWithDefaults(parsed.fixed));
  return { p1: parsed.p1, p2: parsed.p2, a: parsed.fixed.a, vertexX: model.h, vertexY: model.k, delta: model.delta, rootsText: model.rootsText, level: template.contentLevel(parsed.fixed), solutionKind: model.solutionKind, solX: model.x, solY: model.y };
};
for (const item of bank.filter(entry => registry[entry.templateId || entry.target]?.subject === '数学')) {
  test(`math bank ${item.expect}: ${item.q}`, () => {
    const template = registry[item.templateId || item.target];
    const parsed = template.parseQuestion(item.q, { gradeLevel: item.level || 'senior' });
    assert.equal(parsed.ok, item.expect === 'local', parsed.message);
    if (!parsed.ok) return;
    const actual = answerOf(template, parsed);
    for (const [key, expected] of Object.entries(item.answer || {})) {
      if (typeof expected === 'number') near(actual[key], expected, key);
      else assert.ok(String(actual[key]).includes(expected), `${key}: ${actual[key]} should include ${expected}`);
    }
    assert.doesNotMatch(JSON.stringify({ ...template.content(parsed.p1, parsed.p2, parsed.fixed), graph: null, model: null }), /NaN|undefined|Infinity/);
  });
}

test('quadratic: vertex, roots and Δ are exact across the slider range', () => {
  for (const a of [1, -1, 2, -3, 0.5, 0.25]) {
    for (let b = -10; b <= 10; b += 1) {
      for (let c = -10; c <= 10; c += 1) {
        const m = quadratic.model(b, c, { a });
        const f = x => a * x * x + b * x + c;
        near(m.h, -b / (2 * a), 'h');
        near(f(m.h), m.k, 'k');
        near(m.delta, b * b - 4 * a * c, 'Δ');
        assert.equal(m.roots.length, m.delta > 1e-12 ? 2 : Math.abs(m.delta) <= 1e-12 ? 1 : 0, `${a},${b},${c}`);
        for (const root of m.roots) assert.ok(Math.abs(f(root.value)) < 1e-7, `root ${root.text} of ${m.expr}`);
        assert.doesNotMatch(m.conclusion, /NaN|undefined|Infinity|Δ = 0 = 0|\+ −|− −/);
        assert.match(m.conclusion, a > 0 ? /开口向上/ : /开口向下/);
      }
    }
  }
});

test('quadratic: textbook notation for fractions and radicals', () => {
  const half = quadratic.model(1, 1, { a: 1 });
  assert.equal(half.vertex, '(−1/2, 3/4)');
  assert.equal(half.vertexForm, '(x + 1/2)² + 3/4');
  const surd = quadratic.model(-2, -1, { a: 1 });
  assert.equal(surd.rootsText, '1 ± √2');
  assert.deepEqual([...surd.roots.map(root => root.text)], ['1 − √2', '1 + √2']);
  assert.match(surd.conclusion, /x ≈ −0\.414、x ≈ 2\.414/);
  const golden = quadratic.model(1, -1, { a: 1 });
  assert.equal(golden.rootsText, '(−1 ± √5)/2');
  const decimal = quadratic.model(0.5, -0.25, { a: 0.5 });
  assert.equal(decimal.vertex, '(−0.5, −0.375)');
  assert.equal(quadratic.model(-4, 4, { a: 1 }).deltaClause, 'Δ = 0');
});

test('quadratic: junior and senior explanations differ only in wording', () => {
  const junior = quadratic.content(-4, 3, { a: 1, level: 'junior' });
  const senior = quadratic.content(-4, 3, { a: 1, level: 'senior', notation: 'f' });
  const text = content => JSON.stringify([content.steps, content.description, content.mentor, content.hint, content.challenge, content.sceneTip]);
  assert.equal(junior.level, 'junior');
  assert.doesNotMatch(text(junior), /零点|单调|导数|值域|f\(x\)/);
  assert.match(text(junior), /y 随 x 的增大而减小/);
  assert.match(text(senior), /单调递减/);
  assert.match(text(senior), /零点为 x = 1 和 x = 3/);
  assert.match(text(senior), /f\(x\) = \(x − 2\)² − 1/);
  for (const content of [junior, senior]) assert.match(text(content), /顶点 \(2, −1\)/);
});

test('quadratic: generated questions parse back to the same experiment', () => {
  for (const level of ['junior', 'senior']) {
    const preset = quadratic.presetFor(level);
    const parsed = quadratic.parseQuestion(quadratic.question(preset.p1, preset.p2, preset.fixed));
    assert.equal(parsed.ok, true, parsed.message);
    assert.equal(parsed.fixed.level, level);
    assert.equal(parsed.fixed.levelLocked, true);
  }
  for (const a of [1, -1, 2, 0.5]) {
    for (let b = -10; b <= 10; b += 1) {
      for (let c = -10; c <= 10; c += 1) {
        for (const level of ['junior', 'senior']) {
          const fixed = { a, level, levelLocked: true, notation: level === 'senior' ? 'f' : 'y' };
          const parsed = quadratic.parseQuestion(quadratic.question(b, c, fixed));
          assert.equal(parsed.ok, true, `${quadratic.question(b, c, fixed)}: ${parsed.message}`);
          assert.equal(parsed.p1, b);
          assert.equal(parsed.p2, c);
          assert.equal(parsed.fixed.a, a);
          assert.equal(parsed.fixed.level, level);
        }
      }
    }
  }
});

test('quadratic: neutral questions follow the grade level, cues lock it', () => {
  const neutral = '抛物线 y = x² − 4x + 3 的顶点坐标是什么？';
  assert.equal(quadratic.parseQuestion(neutral, { gradeLevel: 'junior' }).fixed.level, 'junior');
  assert.equal(quadratic.parseQuestion(neutral, { gradeLevel: 'senior' }).fixed.level, 'senior');
  assert.equal(quadratic.parseQuestion(neutral, { gradeLevel: 'junior' }).fixed.levelLocked, false);
  const zeros = quadratic.parseQuestion('函数 y = x² − 4x + 3 的零点是什么？', { gradeLevel: 'junior' });
  assert.equal(zeros.fixed.level, 'senior');
  assert.equal(zeros.fixed.levelLocked, true);
});

test('quadratic: AI rewrites must keep every condition of the original question', () => {
  const plan = quadratic.parseQuestion('二次函数 y = x² − 4x + 3，求图像的对称轴。', { gradeLevel: 'junior' });
  assert.equal(quadratic.checkQuestion('抛物线 y=x^2-4x+3 的对称轴是什么？', plan.p1, plan.p2, plan.fixed).ok, true);
  assert.equal(quadratic.checkQuestion('已知二次函数 y = x² + mx + 3 的对称轴是直线 x = 2，求 m 的值。', plan.p1, plan.p2, plan.fixed).ok, false);
  assert.equal(quadratic.checkQuestion('抛物线 y = x² − 4x + 5 的对称轴是什么？', plan.p1, plan.p2, plan.fixed).ok, false);
});

test('quadratic: graph marks each key point once', () => {
  const graph = (b, c, a = 1) => quadratic.content(b, c, { a }).graph;
  assert.deepEqual([...graph(-4, 3).points.map(point => point.cls)], ['vertex', 'root', 'root', 'intercept']);
  // Δ = 0：顶点就是与 x 轴的交点；c = 0：原点既是交点也是与 y 轴交点；b = 0：顶点在 y 轴上
  assert.deepEqual([...graph(-4, 4).points.map(point => point.cls)], ['vertex', 'intercept']);
  assert.deepEqual([...graph(4, 0, -1).points.map(point => point.cls)], ['vertex', 'root', 'root']);
  assert.deepEqual([...graph(0, -2, 2).points.map(point => point.cls)], ['vertex', 'root', 'root']);
  for (const point of graph(-2, -1).points) assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y) && point.label);
  const variant = quadratic.variant(-4, 3, { a: 1 });
  assert.equal(quadratic.model(variant.p1, variant.p2, { a: 1 }).delta, 0);
});

const linear = registry.linearSystem;
const COEFFICIENTS = [[2, 1, 1, -1], [3, 2, 1, -2], [1, 1, 2, 2], [1, 0, 1, 1], [0.5, 1, 1, -1], [-1, 3, 2, -6], [4, -3, -2, 5], [0, 1, 1, 0]];

test('linear system: solutions satisfy both equations; parallel and coincident lines are recognized', () => {
  for (const [a1, b1, a2, b2] of COEFFICIENTS) {
    for (let c1 = -10; c1 <= 10; c1 += 1) {
      for (let c2 = -10; c2 <= 10; c2 += 1) {
        const m = linear.model(c1, c2, { a1, b1, a2, b2 });
        const det = a1 * b2 - a2 * b1;
        if (Math.abs(det) > 1e-12) {
          assert.equal(m.solutionKind, 'unique');
          assert.ok(Math.abs(a1 * m.x + b1 * m.y - c1) < 1e-9 && Math.abs(a2 * m.x + b2 * m.y - c2) < 1e-9, `${m.conclusion}`);
        } else {
          const consistent = Math.abs(a1 * c2 - a2 * c1) < 1e-9 && Math.abs(b1 * c2 - b2 * c1) < 1e-9;
          assert.equal(m.solutionKind, consistent ? 'infinite' : 'none', m.conclusion);
        }
        assert.doesNotMatch(m.conclusion + m.solveText + m.substitute, /NaN|undefined|Infinity|\+ −|− −/);
      }
    }
  }
});

test('linear system: elimination reads like the textbook', () => {
  assert.equal(linear.model(5, 1, { a1: 2, b1: 1, a2: 1, b2: -1 }).solveText, '① + ②，消去 y：3x = 6，x = 2');
  assert.equal(linear.model(7, 1, { a1: 3, b1: 2, a2: 1, b2: -2 }).solveText, '① + ②，消去 y：4x = 8，x = 2');
  assert.match(linear.model(4, 5, { a1: 1, b1: 2, a2: 3, b2: -1 }).solveText, /^① \+ ② × 2，消去 y：7x = 14，x = 2$/);
  assert.equal(linear.model(3, 8, { a1: 1, b1: 1, a2: 2, b2: 2 }).substitute, '0 = −2 不成立，方程组无解');
  assert.equal(linear.model(2, 5, { a1: 1, b1: 0, a2: 1, b2: 1 }).solveText, '由①得 x = 2');
  const half = linear.model(1, 2, { a1: 1, b1: 1, a2: 1, b2: -1 });
  assert.equal(half.point, '(3/2, −1/2)');
});

test('linear system: generated questions parse back for every slider position', () => {
  const forms = [['standard', 'standard', 'system'], ['slope', 'slope', 'lines']];
  for (const [a1, b1, a2, b2] of COEFFICIENTS) {
    for (const [form1, form2, wording] of forms) {
      const fixed = { a1, b1, a2, b2, form1: b1 === 1 ? form1 : 'standard', form2: b2 === 1 ? form2 : 'standard', wording };
      for (let c1 = -10; c1 <= 10; c1 += 1) {
        for (let c2 = -10; c2 <= 10; c2 += 1) {
          const question = linear.question(c1, c2, fixed);
          const parsed = linear.parseQuestion(question);
          if ((a1 === 0 && a2 === 0) || (b1 === 0 && b2 === 0)) continue;
          assert.equal(parsed.ok, true, `${question}: ${parsed.message}`);
          assert.deepEqual([parsed.p1, parsed.p2, parsed.fixed.a1, parsed.fixed.b1, parsed.fixed.a2, parsed.fixed.b2], [c1, c2, a1, b1, a2, b2], question);
        }
      }
    }
  }
});

test('linear system: AI rewrites cannot invent constants; graph shows the intersection only when it exists', () => {
  const plan = linear.parseQuestion('解方程组：x + y = 3，x − y = 1。');
  assert.equal(linear.checkQuestion('解方程组：x + y = 3，x − y = 1。', plan.p1, plan.p2, plan.fixed).ok, true);
  assert.equal(linear.checkQuestion('解方程组：x + y = k，x − y = 1。', plan.p1, plan.p2, plan.fixed).ok, false);
  assert.equal(linear.checkQuestion('解方程组：x + y = 4，x − y = 1。', plan.p1, plan.p2, plan.fixed).ok, false);
  const unique = linear.content(5, 1, { a1: 2, b1: 1, a2: 1, b2: -1 }).graph;
  assert.equal(unique.lines.length, 2);
  assert.deepEqual([...unique.points.map(point => point.cls)], ['solution']);
  const parallel = linear.content(3, 8, { a1: 1, b1: 1, a2: 2, b2: 2 }).graph;
  assert.equal(parallel.points.length, 0);
  assert.match(parallel.note, /平行/);
  const same = linear.content(3, 6, { a1: 1, b1: 1, a2: 2, b2: 2 }).graph;
  assert.match(same.lines[1].cls, /coincide/);
  assert.equal(linear.contentLevel({}), 'junior');
});
