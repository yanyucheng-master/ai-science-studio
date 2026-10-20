import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Scene from '../../web/instant-scene.js';

const bank = JSON.parse(await readFile(new URL('../eval/tutor-diagram-bank.json', import.meta.url), 'utf8'));
const question = bank[0].q;
function fixture(q = question) {
  return { version: 1, status: 'scene', subject: '物理', title: '斜面受力图', givens: [q],
    basis: ['静摩擦力阻碍沿斜面下滑的趋势。'], assumptions: ['图形仅作示意，不按比例。'], explanation: ['只表示方向。'],
    objects: [
      { id: 's', type: 'line', role: 'surface', from: [80, 330], to: [520, 220] },
      { id: 'b', type: 'polygon', role: 'body', points: [[240, 290], [320, 270], [308.8, 225.4], [228.8, 245.4]] },
      { id: 'g', type: 'arrow', role: 'gravity', from: [274, 258], to: [274, 320] },
      { id: 'n', type: 'arrow', role: 'normal_force', from: [274, 258], to: [257, 190] },
      { id: 'f', type: 'arrow', role: 'friction', from: [274, 258], to: [342, 241] }
    ], labels: [{ target: 'g', text: '重力 G' }, { target: 'n', text: '支持力 N' }, { target: 'f', text: '静摩擦力 f' }],
    relations: [], calculations: [] };
}
for (const row of bank) test(`diagram admission: ${row.id} -> ${row.expect}`, () => {
  const result = Scene.inspectIncline(row.q);
  assert.equal(result.ok, row.expect === 'draw');
  if (row.expect === 'draw') {
    assert.deepEqual(result.conditions, { scene: 'incline', rises: row.rises, surface: 'rough', motion: row.motion,
      otherForces: [], directionOnly: row.directionOnly, asks: ['force_diagram'] });
  } else assert.ok(result.code);
});
test('original scene remains valid in shared and strict diagram validation', () => {
  assert.equal(Scene.validate(fixture(), question).ok, true);
  assert.equal(Scene.validateDiagram(fixture(), question).ok, true);
});
const mutations = [
  ['reverse friction', raw => { raw.objects[4].to = [206, 275]; }],
  ['omit friction', raw => { raw.objects.pop(); raw.labels.pop(); }],
  ['omit friction label', raw => { raw.labels.pop(); }],
  ['mirror against question', raw => { for (const o of raw.objects) { if (o.from) { o.from = [600 - o.from[0], o.from[1]]; o.to = [600 - o.to[0], o.to[1]]; } if (o.points) o.points = o.points.map(p => [600 - p[0], p[1]]); } }],
  ['different origin', raw => { raw.objects[2].from[0] += 40; raw.objects[2].to[0] += 40; }],
  ['common origin outside body', raw => { for (const o of raw.objects.filter(o => o.type === 'arrow')) { o.from[0] += 90; o.to[0] += 90; } }],
  ['extra unclassified force', raw => { raw.objects.push({ id: 'extra', type: 'arrow', from: [274, 258], to: [350, 258] }); }],
  ['extra tension', raw => { raw.objects.push({ id: 'extra', type: 'arrow', role: 'tension', from: [274, 258], to: [350, 258] }); }]
];
for (const [name, change] of mutations) test(`strict diagram mutation rejects ${name}`, () => {
  const raw = fixture(); change(raw);
  assert.equal(Scene.validateDiagram(raw, question).ok, false);
});
test('shared friction check recognizes both no-other-force phrasings', () => {
  for (const row of [bank[0], bank[2]]) {
    const raw = fixture(row.q); raw.objects[4].to = [206, 275];
    assert.equal(Scene.validate(raw, row.q).code, 'WRONG_FRICTION');
    raw.objects.pop(); raw.labels.pop();
    assert.equal(Scene.validate(raw, row.q).ok, false);
  }
});
for (const id of ['smooth-static', 'missing-no-other-force', 'push', 'pull-contradicts-none']) test(`strict diagram rejects changed question ${id}`, () => {
  const q = bank.find(row => row.id === id).q;
  assert.equal(Scene.validateDiagram(fixture(q), q).ok, false);
});
