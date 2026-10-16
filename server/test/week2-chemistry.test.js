// 化学计算工具（web/chemistry-extra.js）：初中“利用化学方程式的简单计算”的相关量与比例式。
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const sandbox = {};
sandbox.window = sandbox;
vm.runInNewContext(await readFile(new URL('../../web/chemistry-extra.js', import.meta.url), 'utf8'), sandbox);
const chemistry = sandbox.MasterLabChemistry;
const equation = 'Fe + CuSO₄ = FeSO₄ + Cu';

test('relative formula masses follow the junior textbook values', () => {
  for (const [formula, mass] of [['Fe', 56], ['Cu', 64], ['CuSO4', 160], ['FeSO4', 152], ['CaCO3', 100], ['H2SO4', 98], ['Ca(OH)2', 74], ['H2O2', 34], ['Fe2O3', 160], ['HCl', 36.5]]) {
    assert.equal(chemistry.relativeMass(formula), mass, formula);
  }
  assert.ok(Number.isNaN(chemistry.relativeMass('Xx2')));
  assert.equal(chemistry.formulaText('CuSO4'), 'CuSO₄');
  assert.ok(Object.isFrozen(chemistry) && Object.isFrozen(chemistry.ATOMIC_MASS));
});

test('proportion writes the textbook steps for iron and copper sulfate', () => {
  const fromIron = chemistry.proportion({ equation, known: { formula: 'Fe', name: '铁', mass: 5.6 }, unknown: { formula: 'Cu', name: '铜' }, ask: '生成铜的质量' });
  assert.equal(fromIron.set, '设生成铜的质量为 x');
  assert.equal(fromIron.relation, 'Fe 56，Cu 64；已知 5.6 g，未知 x');
  assert.equal(fromIron.ratio, '56/64 = 5.6g/x');
  assert.equal(fromIron.solve, 'x = 64 × 5.6 g ÷ 56 = 6.4 g');
  assert.equal(fromIron.answer, '答：生成铜的质量为 6.4 g。');
  const fromSulfate = chemistry.proportion({ equation, known: { formula: 'CuSO4', name: '硫酸铜', mass: 16 }, unknown: { formula: 'Cu', name: '铜' }, ask: '生成铜的质量' });
  assert.equal(fromSulfate.ratio, '160/64 = 16g/x');
  assert.equal(fromSulfate.value, 6.4);
  const need = chemistry.proportion({ equation, known: { formula: 'Fe', mass: 8.4 }, unknown: { formula: 'CuSO4' }, ask: '需要硫酸铜的质量', symbol: 'y' });
  assert.equal(need.valueText, '24');
  assert.match(need.ratio, /\/y$/);
});

test('proportion marks values that cannot be written exactly', () => {
  const result = chemistry.proportion({ equation, known: { formula: 'Fe', mass: 6 }, unknown: { formula: 'Cu' }, ask: '生成铜的质量' });
  assert.equal(result.exact, false);
  assert.equal(result.valueText, '6.86');
  assert.match(result.solve, /≈ 6\.86 g$/);
  assert.equal(result.answer, '答：生成铜的质量约为 6.86 g。');
  const coefficient = chemistry.proportion({ equation: 'CaCO₃ + 2HCl = CaCl₂ + H₂O + CO₂↑', known: { formula: 'CaCO3', mass: 10 }, unknown: { formula: 'HCl', coefficient: 2 }, ask: '参加反应的氯化氢的质量' });
  assert.equal(coefficient.unknownRelative, 73);
  assert.match(coefficient.relation, /HCl 2 × 36\.5/);
  assert.equal(coefficient.valueText, '7.3');
});
