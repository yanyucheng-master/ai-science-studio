import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import Core from '../../web/instant-scene.js';
import Incline from '../../web/incline-diagram.js';

const bank = JSON.parse(await readFile(new URL('../eval/tutor-diagram-bank.json', import.meta.url), 'utf8'));
const q = bank[0].q;
const roleObject = (scene, role) => scene.objects.find(o => o.role === role);
const vector = o => [o.to[0] - o.from[0], o.to[1] - o.from[1]];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

for (const row of bank) test(`program diagram: ${row.id}`, () => {
  const result = Incline.createScene(row.q);
  assert.equal(result.mode, row.expect === 'draw' ? 'instant' : 'explanation');
  if (row.expect === 'text') { assert.equal(result.scene, undefined); return; }
  assert.equal(result.source, 'program-incline');
  assert.deepEqual(result.forces, row.forces);
  assert.equal(Core.validateDiagram(result.scene, row.q).ok, true);
  const surface = roleObject(result.scene, 'surface'), body = roleObject(result.scene, 'body');
  const forces = ['gravity', 'normal_force', 'friction'].map(role => roleObject(result.scene, role));
  const center = [0, 1].map(axis => body.points.reduce((sum, p) => sum + p[axis], 0) / 4);
  const slope = vector(surface), n = vector(forces[1]), f = vector(forces[2]);
  near(slope[0] * n[0] + slope[1] * n[1], 0);
  near(slope[0] * f[1] - slope[1] * f[0], 0);
  assert.ok(n[1] < 0 && f[1] < 0);
  assert.equal(n[0] < 0, row.rises === 'right');
  assert.equal(f[0] > 0, row.rises === 'right');
  assert.ok(forces.every(force => force.from.every((value, axis) => Math.abs(value - center[axis]) < 1e-8)));
  const lengths = forces.map(force => Math.hypot(...vector(force)));
  for (const length of lengths) near(length, lengths[0]);
  near(Math.abs(Math.atan2(slope[1], slope[0])) * 180 / Math.PI, 28);
  for (const point of body.points.slice(0, 2)) near(slope[0] * (point[1] - surface.from[1]) - slope[1] * (point[0] - surface.from[0]), 0);
  const label = result.scene.labels.find(l => l.target === forces[2].id).text;
  assert.match(label, row.motion === 'static' ? /静摩擦/ : /滑动摩擦/);
});
test('program geometry is independent of numerical data, and repeated calls cannot mutate each other', () => {
  const first = Incline.createScene(q), numerical = Incline.createScene(bank.find(r => r.id === 'numbers-remain-schematic').q);
  assert.deepEqual(first.scene.objects, numerical.scene.objects);
  const expected = structuredClone(first.scene.objects);
  first.scene.objects[0].from[0] = -999;
  assert.deepEqual(Incline.createScene(q).scene.objects, expected);
});
test('optional AI conditions are cross-checked against all independently extracted fields', () => {
  const conditions = Core.inspectIncline(q).conditions;
  assert.equal(Incline.createScene(q, { aiConditions: structuredClone(conditions) }).mode, 'instant');
  for (const [field, value] of [['scene', 'pendulum'], ['rises', 'left'], ['surface', 'smooth'], ['motion', 'uniform_down'],
    ['otherForces', ['push']], ['directionOnly', false], ['asks', ['force_magnitude']]]) {
    const result = Incline.createScene(q, { aiConditions: { ...conditions, [field]: value } });
    assert.equal(result.mode, 'explanation', field); assert.equal(result.scene, undefined);
  }
  for (const field of Object.keys(conditions)) {
    const incomplete = { ...conditions }; delete incomplete[field];
    assert.equal(Incline.createScene(q, { aiConditions: incomplete }).mode, 'explanation', field);
  }
});
test('AI coordinates, force claims, extra fields and malformed containers never become a fallback', () => {
  const conditions = Core.inspectIncline(q).conditions;
  for (const extra of [{ objects: [] }, { labels: [] }, { forces: [] }, { mass: 2 }, { angle: 30 }, { script: 'run()' }]) {
    assert.equal(Incline.createScene(q, { aiConditions: { ...conditions, ...extra } }).mode, 'explanation');
  }
  for (const value of [[], 'incline', 1, { objects: [], labels: [] }, JSON.parse('{"__proto__":{},"scene":"incline"}')]) {
    assert.equal(Incline.createScene(q, { aiConditions: value }).mode, 'explanation');
  }
  const left = bank.find(r => r.id === 'static-left').q;
  assert.equal(Incline.createScene(left, { aiConditions: conditions }).mode, 'explanation');
  assert.equal(Incline.createScene(bank.find(r => r.id === 'missing-no-other-force').q, { aiConditions: conditions }).mode, 'explanation');
});
test('missing AI condition output uses only the complete local extraction', () => {
  for (const aiConditions of [undefined, null]) {
    assert.equal(Incline.createScene(q, { aiConditions }).mode, 'instant');
    assert.equal(Incline.createScene(bank.find(r => r.id === 'smooth-down').q, { aiConditions }).mode, 'explanation');
  }
  const schema = Incline.schema();
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, ['scene', 'rises', 'surface', 'motion', 'otherForces', 'directionOnly', 'asks']);
  assert.equal(schema.properties.otherForces.maxItems, 0);
});
test('browser entry has zero network requests for allowed, denied and mismatched conditions', async () => {
  const file = await readFile(new URL('../../web/instant-experiment.js', import.meta.url), 'utf8');
  const node = { hidden: true, addEventListener() {}, setAttribute() {}, classList: { remove() {}, add() {} } };
  let requests = 0, credentialReads = 0;
  const sandbox = { MasterLabInstantScene: Core, MasterLabInclineDiagram: Incline, document: { querySelector: () => node, getElementById: () => node },
    fetch() { requests++; throw new Error('No network allowed'); }, localStorage: { getItem() { credentialReads++; throw new Error('No credentials needed'); } },
    addEventListener() {}, AbortController, DOMException, setTimeout, clearTimeout, setInterval, clearInterval };
  sandbox.window = sandbox;
  vm.runInNewContext(file, sandbox);
  assert.equal((await sandbox.MasterLabInstant.createScene(q)).mode, 'instant');
  assert.equal((await sandbox.MasterLabInstant.createScene(bank.find(r => r.id === 'circuit-without-layout').q)).mode, 'explanation');
  assert.equal((await sandbox.MasterLabInstant.createScene(q, { aiConditions: { objects: [] } })).mode, 'explanation');
  const controller = new AbortController(); controller.abort();
  await assert.rejects(sandbox.MasterLabInstant.createScene(q, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(requests, 0); assert.equal(credentialReads, 0);
  assert.doesNotMatch(file, /chat\/completions|scene\/generate|Core\.requestBody/);
});
