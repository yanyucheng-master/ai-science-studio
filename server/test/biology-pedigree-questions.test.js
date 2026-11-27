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

test('explicit sample references with or without the grade prefix stay local and report unknown versions', () => {
  for (const prefix of ['高中', '']) for (const reference of ['P99-v1', 'P02-v1']) {
    const source = `${prefix}遗传系谱图 ${reference}`;
    assert.equal(Q.candidate(source), true);
    const parse = Q.parse(source);
    assert.equal(parse.ok, false);
    assert.ok(parse.message.includes('未知系谱图样例或版本'));
  }
  assert.equal(Q.candidate('遗传系谱图 P02-v2'), true);
  assert.ok(Q.parse('遗传系谱图 P02-v2').message.includes('缺少或改动了题给条件'));
  const data = Q.preset('P04');
  const source = Q.question(1, 1, data.fixed).replace('高中遗传系谱图', '遗传系谱图');
  assert.equal(Q.parse(source).ok, true);
  assert.equal(Q.parse(source).fixed.levelLocked, true);
  for (const input of ['展示卡片写着遗传系谱图P99-v1。另有平面镜成像题。', '遗传系谱图的符号有哪些？']) assert.equal(Q.candidate(input), false);
});

test('pure and paired P04 asks roundtrip without an unasked unconditional event in the model conclusion', () => {
  const data = Q.find('P04'), fixed = Q.preset('P04').fixed;
  for (const asks of [[data.asks[1]], [data.asks[2]], data.asks.slice(1)]) {
    const input = Q.question(1, 1, { ...fixed, asks: asks.join('|') });
    const parsed = template.parseQuestion(input);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.fixed.asks, asks.join('|'));
    const conclusion = template.model(1, 1, parsed.fixed).conclusion;
    assert.equal(conclusion.includes('已知下一子代为男孩时受累概率：1/2'), asks.includes(data.asks[1]));
    assert.equal(conclusion.includes('下一子代为受累男孩概率：1/4'), asks.includes(data.asks[2]));
    assert.ok(!conclusion.includes('下一子代受累概率：'));
  }
});
