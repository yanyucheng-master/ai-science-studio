import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const [physicsSource, conditionsSource, appSource, tutorSource] = await Promise.all([
  'physics-extra.js', 'question-conditions.js', 'app.js', 'ai-tutor.js'
].map(file => readFile(new URL(`../../web/${file}`, import.meta.url), 'utf8')));
const original = '一辆汽车以20m/s的速度行驶，紧急刹车后加速度大小为5m/s²，摩擦系数0.4，求刹车距离。';

function load() {
  class Element extends EventTarget {
    constructor(tagName) { super(); this.tagName = tagName; this.children = []; this.open = false; this.isConnected = true; }
    setAttribute() {}
    append(...nodes) { this.children.push(...nodes); }
    showModal() { this.open = true; }
    close() { this.open = false; this.dispatchEvent(new Event('close')); }
    remove() { this.isConnected = false; }
    focus() {}
    click() { this.dispatchEvent(new Event('click')); }
  }
  const events = new EventTarget();
  const body = new Element('body');
  const sandbox = { Event, EventTarget, ScienceMotion: { circuitMarkup: () => '' },
    document: { body, activeElement: null, createElement: tag => new Element(tag) },
    addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events) };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(physicsSource, sandbox);
  vm.runInContext(conditionsSource, sandbox);
  return { sandbox, guard: sandbox.MasterLabQuestionGuard, conditions: sandbox.MasterLabQuestionConditions,
    dialog: () => body.children.findLast(node => node.isConnected && node.tagName === 'dialog'), events };
}
const buttons = fixture => fixture.dialog().children.find(node => node.tagName === 'div').children;
const nextTurn = () => new Promise(resolve => setImmediate(resolve));

test('missing g is unknown; invalid or contradictory g values are never rounded or defaulted', () => {
  const { guard } = load();
  assert.equal(guard.gravityOf('求浮力').stated, false);
  assert(Number.isNaN(guard.gravityOf('求浮力').value));
  for (const value of [9.8, 9.81, 10]) assert.equal(guard.gravityOf(`取g=${value}m/s²`).value, value);
  assert.equal(guard.gravityOf('月球表面g=1.6m/s²', { allowAny: true }).value, 1.6);
  for (const question of ['g=9.8001m/s²', 'g=9.8m/s²，g=10N/kg', '重力加速度未知']) {
    assert(Number.isNaN(guard.gravityOf(question).value), question);
  }
});

test('calculations needing gravity stop, while known acceleration, normal force and direction-only diagrams proceed', () => {
  const { conditions } = load();
  for (const question of [original,
    '小球以12m/s从20m高的平台水平抛出，求落地时间。',
    '木板质量1kg，滑块质量1kg，长度2m，初速度4m/s，动摩擦因数0.2，求加速度。',
    '排开200cm³的水，求浮力。', '酒精中深0.5m处的压强是多少？',
    '质量2kg的物体，求它受到的重力。', '摆长1m的单摆，求周期。',
    '汽车刹车加速度大小5m/s²，求轮胎与路面的摩擦系数。']) {
    assert.equal(conditions.inspect(question)?.code, 'MISSING_GRAVITY', question);
  }
  for (const question of [
    '汽车初速度20m/s，刹车加速度大小5m/s²，求刹车距离。',
    '压力为10N，动摩擦因数0.4，求滑动摩擦力。',
    '电阻5Ω，电压10V，求电流。', '求函数y=x²的导数。',
    '物体重5N，浸水后测力计示数3N，求浮力。',
    '物块质量2kg，在倾角30°的粗糙斜面上静止。请画受力示意图，标出重力、支持力和摩擦力的方向。',
    '为什么浮力与排开液体的体积有关？',
    '月球表面g=1.6m/s²，小球自由落体2s，求速度。']) assert.equal(conditions.inspect(question), null, question);
});

test('an experiment needing g also stops when the question only requests an animation', () => {
  const { conditions } = load();
  const question = '小球以12m/s从20m高的平台水平抛出，观察运动轨迹。';
  assert.equal(conditions.inspect(question), null, 'a conceptual tutor request needs no numeric g');
  assert.equal(conditions.inspect(question, { forExperiment: true }).code, 'MISSING_GRAVITY');
});

test('the screenshot problem first confirms g, then the model, and retains both confirmations', async () => {
  const fixture = load();
  const pending = fixture.conditions.resolve(original);
  assert.match(fixture.dialog().children[0].textContent, /重力加速度/);
  buttons(fixture)[0].click();
  await nextTurn();
  assert.match(fixture.dialog().children[1].textContent, /μg = 4 m\/s²/);
  buttons(fixture)[0].click();
  const result = await pending;
  assert.equal(result.ok, true);
  assert(result.question.startsWith(original));
  assert.match(result.question, /用户确认：g = 10m\/s²/);
  assert.equal(fixture.guard.brakingOf(result.question).backgroundConfirmed, true);
  assert.equal(fixture.conditions.inspect(result.question), null);
  assert.equal(fixture.conditions.pending, false);
});

test('cancel, Escape, route changes and stale questions never count as approval', async () => {
  for (const action of ['button', 'escape', 'route', 'stale']) {
    const fixture = load();
    let current = true;
    const pending = fixture.conditions.resolve(original, { isCurrent: () => current });
    if (action === 'button') buttons(fixture).at(-1).click();
    if (action === 'escape') fixture.dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
    if (action === 'route') fixture.events.dispatchEvent(new Event('hashchange'));
    if (action === 'stale') { current = false; buttons(fixture)[0].click(); }
    const result = await pending;
    assert.equal(result.ok, false, action);
    assert.equal(result.cancelled, true, action);
    assert.equal(fixture.conditions.pending, false, action);
  }
});

test('one question never supplies a default g to another, and duplicate submissions do not approve a dialog', async () => {
  const fixture = load();
  const first = fixture.conditions.resolve('小球从20m高处平抛，求落地时间。');
  assert.equal((await fixture.conditions.resolve(original)).ok, false);
  buttons(fixture)[1].click();
  assert.match((await first).question, /9.8m\/s²/);
  const second = fixture.conditions.resolve(original);
  assert.match(fixture.dialog().children[1].textContent, /是否取 g = 10/);
  buttons(fixture).at(-1).click();
  await second;
});

test('friction-only contradictions cannot be bypassed by the background-data choice', () => {
  const { conditions, guard } = load();
  const question = original + '汽车仅受滑动摩擦力制动，取g=10m/s²。';
  assert.equal(conditions.inspect(question).allowBackground, false);
  assert.equal(conditions.inspect(question + guard.BRAKE_BACKGROUND_CONFIRMATION).allowBackground, false);
});

test('inclines and multiple braking phases are not judged using the simple horizontal a=μg relation', () => {
  const { conditions } = load();
  assert.equal(conditions.inspect('汽车在斜坡上刹车，加速度大小5m/s²，摩擦因数0.4，g=10m/s²，求刹车距离。'), null);
  assert.equal(conditions.inspect('汽车分段刹车，第一段加速度大小5m/s²，第二段加速度大小2m/s²，求刹车距离。'), null);
});

// Exercise the actual parser functions with only DOM presentation replaced.
// No UI, provider, browser, or project-wide application initialization is used.
function loadBrakeParser() {
  const fixture = load(), sandbox = fixture.sandbox;
  const source = appSource.replaceAll('\r\n', '\n');
  function declaration(name) {
    const start = source.indexOf(`function ${name}(`);
    assert(start >= 0, `missing function ${name}`);
    const end = source.indexOf('\n}', start + 1);
    assert(end > start, `unterminated function ${name}`);
    return source.slice(start, end + 2);
  }
  for (const name of ['PHYSICS_BRAKE_LIMITS', 'PHYSICS_FRICTION_BRAKE_LIMITS', 'PHYSICS_LINEAR_DRAG_LIMITS', 'QUESTION_SPECS']) {
    const match = source.match(new RegExp(`const ${name} = \\{[\\s\\S]*?\\n\\};`));
    assert(match, name);
    vm.runInContext(match[0], sandbox);
  }
  Object.assign(sandbox, { state: {}, smartNumber: value => String(value),
    buildPhysicsBrakeContent: () => ({ recognitionText: 'parser fixture' }) });
  for (const name of ['normalizeQuestionText', 'firstNumberByPatterns', 'physicsBrakeModel', 'questionGuard',
    'exactNumber', 'strictTemplateCheck', 'convertSpeedUnits', 'brakeStrictCheck', 'brakeAskOf',
    'parsePhysicsBrakeCore', 'parsePhysicsBrakeQuestion']) vm.runInContext(declaration(name), sandbox);
  return { ...fixture, parse: sandbox.parsePhysicsBrakeQuestion };
}

test('the local brake parser rejects unresolved conditions, then computes from the confirmed model', () => {
  const { parse, guard } = loadBrakeParser();
  assert.equal(parse(original).ok, false);
  const clarified = original + '\n（用户确认：g=10m/s²。）\n（' + guard.BRAKE_BACKGROUND_CONFIRMATION + '）';
  const result = parse(clarified);
  assert.equal(result.ok, true, result.message);
  assert.equal(result.mode, 'constant');
  assert.equal(result.stopDistance, 40);
  assert.equal(result.givenMu, 0.4);
  assert.match(result.brakeAsk.conditionNote, /经用户确认/);
  assert.equal(parse(original + '取g=10m/s²。').ok, false, 'g alone must not discard the model conflict');
});

test('consistent acceleration and friction data use the local template, including coefficient aliases and km/h', () => {
  const { parse } = loadBrakeParser();
  for (const label of ['动摩擦因数', '滑动摩擦因数', '动摩擦系数', '滑动摩擦系数', '摩擦因数', '摩擦系数', 'μ=']) {
    const question = `汽车以72km/h行驶，刹车加速度大小4m/s²，${label}0.4，g=10m/s²，求刹车距离。`;
    const result = parse(question);
    assert.equal(result.ok, true, `${label}: ${result.message}`);
    assert.equal(result.mode, 'friction');
    assert.equal(result.stopDistance, 50);
  }
  assert.equal(parse('汽车以20m/s行驶，刹车减速度5m/s²，求刹车距离。').stopDistance, 40);
});

test('AI template reconstruction preserves original g and explicit background-data confirmation', () => {
  const { sandbox, guard } = load();
  const source = tutorSource.replaceAll('\r\n', '\n');
  const start = source.indexOf('  function planToQuestion(');
  const end = source.indexOf('\n  // acceptPlan', start);
  assert(start >= 0 && end > start);
  sandbox.smartNumber = value => String(value);
  vm.runInContext(source.slice(start, end), sandbox);
  const plan = (templateId, parameters) => ({ modules: [{ templateId, parameters }] });
  for (const [id, parameters] of [
    ['projectile', { horizontalSpeed: 12, height: 20 }],
    ['board_slider', { initialSpeed: 4, boardLength: 2 }],
    ['buoyancy', { displacedVolume: 300, density: 1000 }],
    ['liquid_pressure', { depthCm: 30, density: 1000 }]
  ]) {
    const mapped = sandbox.planToQuestion(plan(id, parameters), '原题明确取g=9.81m/s²。');
    assert(mapped, id);
    assert.equal(guard.gravityOf(mapped.question).value, 9.81, id);
    assert.equal(sandbox.planToQuestion(plan(id, parameters), '原题未给出重力加速度。'), null, id);
  }
  const clarified = original + 'g=10m/s²。' + guard.BRAKE_BACKGROUND_CONFIRMATION;
  const mapped = sandbox.planToQuestion(plan('brake', { initialSpeed: 20, deceleration: 5 }), clarified);
  assert.equal(guard.brakingOf(mapped.question).backgroundConfirmed, true);
  assert.equal(guard.gravityOf(mapped.question).value, 10);
});
