import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const names = ['physics-extra.js', 'biology-leaf-disks-core.js', 'biology-leaf-disks-questions.js', 'biology-leaf-disks.js'];
const sources = await Promise.all(names.map(name => readFile(new URL('../../web/' + name, import.meta.url), 'utf8')));
const box = { console }; box.window = box;
sources.forEach(source => vm.runInNewContext(source, box));
const C = box.MasterLabLeafDisks, Q = box.MasterLabLeafDiskQuestions, T = box.MASTER_LAB_TEMPLATES.leafDisks;
const plain = value => JSON.parse(JSON.stringify(value));
// Independently transcribed givens/asks from the selected textbook reference case.
const sample = '按人教版高中生物学必修1教材，探究光照强度对光合作用强度的影响，取生长旺盛的菠菜绿叶，用直径0.6cm的打孔器避开大叶脉制备30片圆形小叶片，注射器吸入清水并排尽残留空气后堵住前孔缓拉活塞使叶片内气体逸出并沉底，处理后的叶片在黑暗处清水中待用，三只小烧杯加入富含CO2的清水，每杯放入10片叶圆片，以5W的LED灯作光源并用米尺比较距灯远近形成强中弱三组光照，其他条件相同且适宜，观察并记录同一时间段内各组叶片浮起数量，未提供实际观察数据，说明实验步骤、操作目的、实验变量、观察指标、结果分析边界。';

test('PEP p105 has six operations in order, not the junior starch assay', () => {
  assert.deepEqual(plain(C.STEPS.map(s => s.title)), ['制备叶圆片', '注射器排气', '暗处待用', '准备供碳液', '分组与光照', '观察与记录']);
  assert.deepEqual(plain(C.CONSTANTS), { diameterCm: .6, totalDisks: 30, groups: 3, disksPerGroup: 10, lampPowerW: 5 });
  assert.equal(C.CONSTANTS.groups * C.CONSTANTS.disksPerGroup, C.CONSTANTS.totalDisks);
  assert.match(C.STEPS[1].action, /排尽残留空气.*堵住前孔.*拉动活塞.*2–3次/);
  assert.match(C.STEPS[2].action, /黑暗处.*清水/);
  assert.match(C.STEPS[5].action, /同一时间段/);
  assert.doesNotMatch(C.STEPS.map(s => s.action).join(''), /一昼夜|碘液|酒精|传感器/);
});
test('materials contain the specified 5W lamp and ruler', () => {
  assert.deepEqual(plain(C.MATERIALS), ['生长旺盛的菠菜绿叶', '直径0.6 cm打孔器', '注射器', '清水', '5 W LED台灯', '米尺', '烧杯']);
});
test('no frame fabricates an observed group count', () => {
  for (let n = 0; n <= 600; n++) assert.deepEqual(plain(C.frame(n / 600).observedCounts), [null, null, null]);
  assert.equal(C.frame(1).observationStage, true);
  assert.equal(C.frame(1).step, 5);
  assert.equal(C.frame(1).mechanismRise, 1);
});
test('degas phases precede submersion and dark standby', () => {
  for (const [p, step, phase, submerged, dark] of [[0,0,null,false,false], [.17,1,0,false,false], [.23,1,1,false,false], [.3,1,2,true,false], [.4,2,null,true,true], [.55,3,null,true,false], [.75,4,null,true,false], [1,5,null,true,false]]) {
    const f = C.frame(p); assert.deepEqual([f.step, f.syringePhase, f.submerged, f.dark], [step, phase, submerged, dark]);
  }
});
test('replay is reversible without history or a second clock', () => {
  const before = plain(C.frame(.3)); C.frame(1); C.frame(.75); assert.deepEqual(plain(C.frame(.3)), before);
  assert.deepEqual(plain(C.frame(0).observedCounts), [null, null, null]);
  assert.ok(Object.isFrozen(C) && Object.isFrozen(C.STEPS) && Object.isFrozen(C.frame(.5)));
});
test('invalid progress is rejected instead of clamped', () => {
  for (const n of [-.001, 1.001, NaN, Infinity, '0.5', null]) assert.throws(() => C.frame(n));
});
test('complete manual textbook question is accepted with fixed senior content', () => {
  const p = T.parseQuestion(sample, { gradeLevel: 'junior' }); assert.ok(p.ok, p.message);
  assert.equal(T.contentLevel(p.fixed), 'senior'); assert.deepEqual([p.p1, p.p2], [1, 1]);
  assert.deepEqual(plain(T.model(1, 1, p.fixed).observedCounts), [null, null, null]);
  const content = T.content(1, 1, p.fixed); assert.ok(content.params.every(p => p.locked));
  assert.match(T.given(), /直径0.6 cm.*30片.*3组各10片/);
});
test('all 31 nonempty supported ask combinations preserve what was asked', () => {
  const names = Object.keys(Q.ASK), givens = sample.split('，说明')[0];
  for (let bits = 1; bits < 32; bits++) {
    const selected = names.filter((_, i) => bits & 1 << i), text = givens + '，说明' + selected.map(k => Q.ASK[k]).join('、') + '。';
    const p = T.parseQuestion(text); assert.ok(p.ok, text); assert.deepEqual(p.fixed.asks.split(',').sort(), selected.sort());
  }
});
test('question first, punctuation, whitespace and independently positioned conditions', () => {
  const clauses = sample.split('，'), ask = clauses.pop();
  for (const q of [ask + '：' + clauses.join('。'), clauses.reverse().join('；') + '。' + ask, sample.replaceAll('，', '：').replace('0.6cm', '0.6 cm')]) assert.ok(T.parseQuestion(q).ok, q);
});
test('only declared equivalent diameter units restore the same condition', () => {
  for (const diameter of ['0.60cm', '6mm', '6.0mm', '6毫米', '0.6厘米']) assert.ok(T.parseQuestion(sample.replace('0.6cm', diameter)).ok, diameter);
  assert.ok(T.parseQuestion(sample.replace('5W', '5瓦')).ok);
});
const bad = [
  ['missing condition', sample.replace('其他条件相同且适宜，', '')],
  ['missing dark standby', sample.replace('处理后的叶片在黑暗处清水中待用，', '')],
  ['one-day junior treatment', sample.replace('黑暗处清水中待用', '黑暗处处理一昼夜')],
  ['different diameter', sample.replace('0.6cm', '0.8cm')],
  ['missing unit', sample.replace('0.6cm', '0.6')],
  ['diameter as radius', sample.replace('直径0.6cm', '半径0.6cm')],
  ['only 20 leaves', sample.replace('30片', '20片')],
  ['different per-group count', sample.replace('10片叶圆片', '5片叶圆片')],
  ['different power', sample.replace('5W', '50W')],
  ['power-as-illumination', sample.replace('5W的LED灯', '5W的照度')],
  ['changed suction sequence', sample.replace('排尽残留空气后堵住前孔缓拉', '堵住前孔后排尽残留空气再缓拉')],
  ['no residual-air removal', sample.replace('并排尽残留空气', '')],
  ['illuminated standby', sample.replace('黑暗处', '阳光下')],
  ['plain water for carbon', sample.replace('富含CO2的清水', '无CO2的清水')],
  ['different carbon mode', sample.replace('富含CO2的清水', '1%NaHCO3溶液')],
  ['unequal observation time', sample.replace('同一时间段内', '不同时段内')],
  ['duplicate given', sample + '每杯放入10片叶圆片。'],
  ['front numeric annotation', sample.replace('5W的', '（光照后）5W的')],
  ['post numeric annotation', sample.replace('30片圆形小叶片', '30片（剩余数量）圆形小叶片')],
  ['end role annotation', sample + '30片为实验后剩余数量。'],
  ['unsupported final conclusion', sample.replace('结果分析边界', '实验结论')],
  ['unsupported amount ask', sample.replace('观察指标', '浮起叶片数量')],
  ['unsupported rate ask', sample + '求光合作用速率。'],
  ['unsupported net/gross calculation', sample + '求总产氧量。'],
  ['unsupported concentration', sample + '说明CO2浓度。'],
  ['unsupported time', sample + '求上浮所需时间。'],
  ['invented observation', sample + '强光组观察到8片上浮。'],
  ['invented illumination', sample + '光照强度为1000lx。'],
  ['invented distance', sample + '距灯为20cm。'],
  ['invented water volume', sample + '每杯加水20mL。'],
  ['invented temperature', sample + '保持25°C。'],
  ['temperature experiment instead', sample.replace('探究光照强度对', '探究温度对')]
];
for (const [name, q] of bad) test('rejects ' + name + ' without inventing a new model', () => { assert.equal(T.parseQuestion(q).ok, false); });
test('front ask cannot hide a posterior bad condition or quantity role', () => {
  const q = sample.split('，说明')[0];
  for (const tail of ['30片为反应后数量。', '求光合速率。', '5W（实验后）。', '观察指标为总产氧量。']) assert.equal(T.parseQuestion('说明实验步骤。' + q + '。' + tail).ok, false);
});
test('restoration whitelist rejects parameters, extra modes and unsupported asks', () => {
  for (const values of [[0,1], [1,2], [NaN,1], [1.01,1]]) assert.throws(() => T.model(...values, Q.DEFAULTS));
  for (const change of [{ level: 'junior' }, { version: 2 }, { curriculum: 'other' }, { temperature: 25 }, { asks: 'steps,steps' }, { asks: 'rate' }]) assert.throws(() => T.model(1, 1, { ...Q.DEFAULTS, ...change }));
  assert.ok(T.parseQuestion(T.question()).ok);
});
test('scene and tutor retain no measured data and distinguish mechanism from group results', () => {
  const m = T.model(1, 1), html = T.visual(m), context = T.stepContext(1);
  assert.equal((html.match(/data-observed-count/g) || []).length, 3);
  assert.match(html, /待观察/); assert.match(html, /动画不预测各组浮起数/);
  assert.match(html, /5 W是灯功率/); assert.match(html, /零片上浮也不等于光合作用为零/);
  assert.match(context, /尚未提供.*实际观察记录/); assert.doesNotMatch(html, /<script|onclick=|setInterval|requestAnimationFrame/);
});
