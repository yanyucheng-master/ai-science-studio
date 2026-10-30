// 第 2 周：通用模板跨学科登记、学段（初中 / 高中）与各学科预设菜单的单元测试。
// 页面上的交互（学段切换、菜单分组、推荐、AI 上下文）由 npm run test:week2 在浏览器里核对。
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const web = path => readFile(new URL(`../../web/${path}`, import.meta.url), 'utf8');
const physicsSource = await web('physics-extra.js');
const mathSource = await web('math-extra.js');
const mathExperimentsSource = await web('math-experiments.js');
const unitCircleSource = await web('unit-circle.js');
const chemistrySource = await web('chemistry-extra.js');
const chemistryExperimentsSource = await web('chemistry-experiments.js');
const equilibriaSources = await Promise.all(['chemistry-equilibria.js','chemistry-equilibria-questions.js','chemistry-equilibria-experiments.js'].map(web));
const mendelSources = await Promise.all(['biology-mendel-core.js','biology-mendel.js'].map(web));
const html = await web('index.html');
const app = await web('app.js');
const bank = JSON.parse(await readFile(new URL('../eval/local-template-bank.json', import.meta.url), 'utf8'));

function load() {
  const errors = [];
  const sandbox = { ScienceMotion: { circuitMarkup: () => '' }, console: { log() {}, warn() {}, error: (...args) => errors.push(args.join(' ')) } };
  sandbox.window = sandbox;
  vm.runInNewContext(physicsSource, sandbox);
  vm.runInNewContext(mathSource, sandbox);
  vm.runInNewContext(mathExperimentsSource, sandbox);
  vm.runInNewContext(unitCircleSource, sandbox);
  vm.runInNewContext(chemistrySource, sandbox);
  vm.runInNewContext(chemistryExperimentsSource, sandbox);
  equilibriaSources.forEach(source=>vm.runInNewContext(source,sandbox));
  mendelSources.forEach(source=>vm.runInNewContext(source,sandbox));
  return { sandbox, errors };
}
const { sandbox } = load();
const registry = sandbox.MASTER_LAB_TEMPLATES;
const physics = sandbox.EXTRA_PHYSICS_TEMPLATES;
const friction = registry.friction;
const JUNIOR_FRICTION = '用弹簧测力计沿水平方向拉着木块在长木板上做匀速直线运动，探究滑动摩擦力的大小与压力大小、接触面粗糙程度的关系。';
const attrs = tag => Object.fromEntries([...tag.matchAll(/\s(data-[\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const menu = [...html.matchAll(/<button class="preset-option"[^>]*>/g)].map(match => attrs(match[0]));

test('one registry holds every generic template; the physics view is its physics subset', () => {
  assert.deepEqual(Object.keys(physics).sort(), Object.keys(registry).filter(id => registry[id].subject === '物理').sort());
  for (const template of Object.values(registry)) {
    assert.ok(['物理', '化学', '数学', '生物'].includes(template.subject), template.id);
    assert.deepEqual([...template.levels], template.level === 'both' ? ['junior', 'senior'] : [template.level], template.id);
    const content = template.content();
    assert.equal(content.subject, template.subject, template.id);
    assert.ok(['junior', 'senior'].includes(content.level), template.id);
  }
  assert.ok(Object.isFrozen(sandbox.MasterLabTemplateKit) && Object.isFrozen(sandbox.MasterLabTemplateKit.helpers));
});

test('templates of other subjects register through the kit and keep the strict rules', () => {
  const { sandbox: box, errors } = load();
  const { register, helpers: { fmt, fmtInput, fact, miss, tokensOf } } = box.MasterLabTemplateKit;
  const square = {
    id: 'demoSquare', subject: '数学', level: 'junior', menuTitle: '正方形面积', menuMeta: 'S = a²', stage: '初中核心', block: '函数',
    title: '正方形面积', defaults: [2, 1], keywords: /正方形/,
    params: [
      { label: '边长 a', desc: '', unit: 'cm', min: 1, max: 10, step: 1, value: 2 },
      { label: '个数 n', desc: '', unit: '', min: 1, max: 5, step: 1, value: 1 }
    ],
    strict: {
      intent: { require: [/正方形/] },
      values: (source, tokens) => {
        const lengths = tokensOf(tokens, 'length');
        return lengths.length === 1 ? { ok: true, p1: lengths[0].value * 100, p2: 1 } : miss('需要边长。');
      },
      used: a => [{ cls: 'length', value: a / 100 }],
      asks: { supported: /面积/, unsupported: /周长/ }
    },
    failMessage: '需要边长。',
    question: a => `正方形边长为 ${fmtInput(a)}cm，求面积。`,
    model: a => ({
      metrics: [a, 1, a * a], metricUnit: 'cm²', facts: [fact('面积 S', `${fmt(a * a)} cm²`)], conclusion: `面积为 ${fmt(a * a)}cm²。`,
      formula: 'S = a²', formulaDetail: `S = ${fmt(a)}² = ${fmt(a * a)} cm²`, readout: `S = ${fmt(a * a)}cm²`, badge: '面积'
    }),
    recognition: model => `正方形面积｜${model.formulaDetail}`
  };
  register({ demoSquare: square });
  assert.equal(box.MASTER_LAB_TEMPLATES.demoSquare, square);
  assert.equal('demoSquare' in box.EXTRA_PHYSICS_TEMPLATES, false, 'the physics view only lists physics templates');
  const parsed = square.parseQuestion('正方形边长为 3cm，求面积。');
  assert.equal(parsed.ok, true, parsed.message);
  assert.equal(parsed.subject, '数学');
  assert.equal(parsed.p1, 3);
  for (const question of ['正方形边长为 3cm，求周长。', '正方形边长为 3cm，面积为 9cm^2，求面积。', '正方形边长为 30cm，求面积。']) {
    assert.equal(square.parseQuestion(question).ok, false, question);
  }
  const content = square.content(3, 1);
  assert.equal(content.subject, '数学');
  assert.equal(content.level, 'junior');
  assert.equal(content.visualHtml, '');
  assert.equal(content.graph, null);
  // 标识在各学科之间唯一：重复登记不会替换已有模板
  register({ again: { ...square } });
  register({ lever: { ...square, id: 'lever' } });
  assert.equal(box.MASTER_LAB_TEMPLATES.demoSquare, square);
  assert.equal(box.MASTER_LAB_TEMPLATES.lever.subject, '物理');
  assert.equal(errors.length, 2);
});

test('friction: the junior inquiry form never shows μ; the senior form keeps f = μF压', () => {
  const junior = friction.parseQuestion(JUNIOR_FRICTION);
  assert.equal(junior.ok, true, junior.message);
  assert.equal(junior.fixed.level, 'junior');
  assert.equal(junior.fixed.levelLocked, true);
  assert.equal(friction.contentLevel(junior.fixed), 'junior');
  const content = friction.content(junior.p1, junior.p2, junior.fixed);
  assert.equal(content.level, 'junior');
  assert.deepEqual([...content.params.map(param => param.label)], ['压力 F压', '接触面']);
  assert.doesNotMatch(JSON.stringify({ ...content, model: null }), /μ|动摩擦因数|摩擦系数/);
  assert.equal(friction.protocolCompatible(junior.fixed), false, 'materials are not a friction coefficient for the AI protocol');
  assert.equal(friction.question(junior.p1, junior.p2, junior.fixed), JUNIOR_FRICTION);
  // 接触面依次换成木板、棉布、毛巾，示数随之增大（模拟值，只用于比较）
  const surfaces = [1, 2, 3].map(index => friction.model(10, index, junior.fixed));
  assert.deepEqual(surfaces.map(model => model.metrics[1]), ['木板', '棉布', '毛巾']);
  assert.ok(surfaces[0].metrics[2] < surfaces[1].metrics[2] && surfaces[1].metrics[2] < surfaces[2].metrics[2]);
  assert.deepEqual({ ...friction.variant(10, 3, junior.fixed) }, { p1: 10, p2: 1 });

  const senior = friction.parseQuestion('用弹簧测力计水平匀速拉动木块，木块对木板的压力为 10N，动摩擦因数为 0.3。求滑动摩擦力。');
  assert.equal(senior.ok, true, senior.message);
  assert.equal(senior.fixed.level, 'senior');
  assert.equal(friction.protocolCompatible(senior.fixed), true);
  assert.match(friction.content(senior.p1, senior.p2, senior.fixed).steps[1][1], /f = μF压/);

  for (const level of ['junior', 'senior']) {
    const preset = friction.presetFor(level);
    const roundTrip = friction.parseQuestion(friction.question(preset.p1, preset.p2, preset.fixed));
    assert.equal(roundTrip.ok, true, level);
    assert.equal(roundTrip.fixed.level, level);
  }
  // AI 把超出范围的题改写成初中预设题时，原题核对不能通过
  assert.equal(friction.checkQuestion('滑动摩擦力的大小与哪些因素有关？', junior.p1, junior.p2, junior.fixed).ok, true);
  assert.equal(friction.checkQuestion('滑动摩擦力的大小与接触面积有关吗？', junior.p1, junior.p2, junior.fixed).ok, false);
});

for (const item of bank.filter(entry => (entry.templateId || entry.target) === 'friction')) {
  test(`friction bank ${item.expect}: ${item.q}`, () => {
    const parsed = friction.parseQuestion(item.q, { gradeLevel: item.level || 'senior' });
    assert.equal(parsed.ok, item.expect === 'local', parsed.message);
    if (parsed.ok && item.answer?.level) assert.equal(friction.contentLevel(parsed.fixed), item.answer.level);
  });
}

test('preset menu: every option names its subject, grade level and block', () => {
  const blocks = JSON.parse(app.match(/const PRESET_BLOCK_ORDER = Object\.freeze\((\[[^\]]*\])\)/)[1]);
  const dedicated = { brake: 'senior', projectile: 'senior', boardSlider: 'senior', circuit: 'junior', solenoid: 'junior', feCuSO4: 'both', tangent: 'senior', cellPlant: 'both', cellAnimal: 'both' };
  const ids = menu.map(option => option['data-preset']);
  assert.equal(new Set(ids).size, ids.length, 'no duplicate menu entries');
  for (const option of menu) {
    const id = option['data-preset'];
    assert.ok(['物理', '化学', '数学', '生物'].includes(option['data-subject']), id);
    assert.ok(['junior', 'senior', 'both'].includes(option['data-level']), id);
    assert.ok(blocks.includes(option['data-block']), `${id}: unknown block ${option['data-block']}`);
    const template = registry[id];
    if (template) {
      assert.equal(option['data-subject'], template.subject, id);
      assert.equal(option['data-level'], template.level, id);
      assert.equal(option['data-block'], template.block, id);
    } else if (dedicated[id]) {
      assert.equal(option['data-level'], dedicated[id], id);
    }
    if (option['data-level'] === 'both' && template) assert.ok(template.presetFor, `${id}: a two-level template needs a preset per level`);
  }
  for (const id of Object.keys(physics)) assert.ok(ids.includes(id), `${id} is missing from the preset menu`);
  for (const subject of ['物理', '化学', '数学', '生物']) assert.ok(menu.some(option => option['data-subject'] === subject), subject);
});

test('grade level guides keep junior tutoring on junior methods without changing the protocol', () => {
  const guides = vm.runInNewContext(`(${app.match(/const GRADE_LEVEL_GUIDES = Object\.freeze\((\{[\s\S]*?\})\);/)[1]})`);
  assert.match(guides.junior, /不用物质的量/);
  assert.match(guides.junior, /不用导数/);
  assert.match(guides.junior, /照常解答/);
  assert.match(guides.senior, /物质的量/);
  // 学段放在 deterministicResult 里，不新增上下文顶层字段
  assert.match(app, /deterministicResult: \{[\s\S]{0,400}?\.\.\.gradeLevelContext\(/);
  assert.match(app, /const GRADE_LEVEL_STORAGE_KEY = "masterLab\.gradeLevel\.v1";/);
});
