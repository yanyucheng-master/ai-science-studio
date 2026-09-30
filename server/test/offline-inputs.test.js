import test from 'node:test';
import assert from 'node:assert/strict';
import { localGenerateFallback } from '../src/local-fallback.js';
import { offlineInputs } from '../src/offline-inputs.js';

const cases = [
  ['brake', '汽车制动，减速度为5 m/s²，初速度为72 km/h', { initialSpeed: 20, deceleration: 5 }],
  ['brake', '汽车以20m/s行驶，制动减速度为5m/s²', { initialSpeed: 20, deceleration: 5 }],
  ['brake', '汽车制动，初速度为20米每秒，加速度为-5米每秒平方', { initialSpeed: 20, deceleration: 5 }],
  ['brake', '汽车初速度为20m/s，求制动距离', null],
  ['brake', '汽车刹车，初速度为200m/s，减速度为5m/s²', null],
  ['brake', '汽车刹车，初速度为20，减速度为5', null],
  ['brake', '汽车刹车，减速度为5m/s²', null],
  ['fe_cuso4', '0.1mol CuSO4 与5.6g铁反应', { ironMass: 5.6, copperSulfateMass: 16 }],
  ['fe_cuso4', 'Fe质量为0.0056kg，CuSO₄质量为16克', { ironMass: 5.6, copperSulfateMass: 16 }],
  ['fe_cuso4', 'Fe与CuSO4反应', null],
  ['fe_cuso4', '5.6g铁加入100g硫酸铜溶液', null],
  ['fe_cuso4', '56g铁与16g硫酸铜反应', null],
  ['tangent', '求y=2x^2在x=1处的切线', { coefficient: 2, pointX: 1 }],
  ['tangent', '求f(x)=x²在x=-2处的导数', { coefficient: 1, pointX: -2 }],
  ['tangent', '求y=2x^2+3x在x=1处的切线', null],
  ['tangent', '求y=2x²的切线', null],
  ['tangent', '求y=2x²在x=5处的切线', null],
  ['cell', '观察动物细胞线粒体', { cellType: 0 }],
  ['cell', '观察植物细胞', { cellType: 1 }],
  ['cell', '观察细胞', null]
];
export { cases };
for (const [id, question, expected] of cases) {
  test('offline inputs: ' + question, () => {
    assert.deepEqual(offlineInputs(question, id), expected);
    const body = localGenerateFallback(question);
    assert.equal(body.mode, expected ? 'experiment' : 'unavailable');
    if (expected) assert.deepEqual(body.plan.modules[0].parameters, expected);
    else assert.equal(body.plan, null);
  });
}
test('offline oscillator question never becomes a braking model', () => {
  assert.equal(localGenerateFallback('弹簧振子的初速度为2m/s，减速度为1m/s²，求周期').mode, 'unavailable');
});
