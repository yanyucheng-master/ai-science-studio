import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const box = { console };
box.window = box;
for (const file of ['physics-extra.js', 'biology-pedigree-cases.js', 'biology-pedigree-core.js', 'biology-pedigree-questions.js', 'biology-pedigree.js']) {
  vm.runInNewContext(await readFile(new URL('../../web/' + file, import.meta.url), 'utf8'), box);
}
const Q = box.MasterLabPedigreeQuestions, template = box.MASTER_LAB_TEMPLATES.pedigree;

for (const data of box.MasterLabPedigreeCases.cases) {
  const { fixed } = Q.preset(data.id), original = Q.question(1, 1, fixed);
  test(data.id + ' full template roundtrip stays below favorite limit', () => {
    assert.ok(original.length < 1200);
    assert.equal(template.parseQuestion(original).ok, true, template.parseQuestion(original).message);
    const restored = template.parseQuestion(original, { gradeLevel: 'junior' });
    assert.equal(restored.fixed.level, 'senior');
    assert.equal(restored.fixed.caseId, data.id);
    assert.equal(restored.fixed.version, data.version);
    assert.equal(restored.fixed.asks, fixed.asks);
  });
  test(data.id + ' allowed punctuation, whitespace and independent clause order', () => {
    const clauses = original.split('。').filter(Boolean);
    const ask = clauses.pop();
    for (const separator of [' ', '、', '\n，\n', '']) {
      const source = [ask, ...clauses.reverse()].join(separator);
      assert.equal(template.parseQuestion(source).ok, true, source);
    }
  });
  test(data.id + ' refuses missing facts and any additional condition or subquestion', () => {
    for (const source of [original.replace('完全外显。', ''), original.replace('无新突变', '有新突变'),
      original + '求至少两个子代受累概率。', original + '另外求圆的面积。',
      original.replace('男性表型', '女性表型'), original + '<b>标记</b>',
      original.replace(/v\d/, 'v999'), original + '男女机会相等且无存活选择。']) {
      assert.equal(template.parseQuestion(source).ok, false, source);
    }
  });
}

test('single or multiple supported asks preserve the complete condition set', () => {
  const { fixed } = Q.preset('P02');
  for (const ask of fixed.asks.split('|')) {
    assert.equal(template.parseQuestion(Q.question(1, 1, { ...fixed, asks: ask })).fixed.asks, ask);
  }
  assert.equal(Q.parse(Q.question(1, 1, fixed).replace('P02-v2', 'P02-v1')).ok, false);
  assert.equal(Q.parse(Q.question().replace('P01-v1', 'P99-v1')).ok, false);
});

test('pedigree routing candidates do not include ordinary concepts or quoted background', () => {
  assert.equal(Q.candidate('高中遗传系谱图P99-v1。求方式判读。'), true);
  assert.equal(Q.candidate('高中遗传系谱图 P99 - v1。求方式判读。'), true);
  assert.equal(Q.candidate('求方式判读 高中遗传系谱图 P99-v1'), true);
  for (const input of ['光合作用的原料是什么？', '系谱图的符号有哪些？', '遗传系谱图的符号有哪些？',
    '展示卡片写着高中遗传系谱图P01-v1。另有平面镜成像题。',
    '孟德尔的豌豆杂交实验如何开展？']) assert.equal(Q.candidate(input), false, input);
});
