import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const sandbox = {ScienceMotion:{circuitMarkup:()=>''}};
sandbox.window = sandbox;
vm.runInNewContext(await readFile(new URL('../../web/physics-extra.js', import.meta.url),'utf8'), sandbox);
const templates = sandbox.EXTRA_PHYSICS_TEMPLATES;
const bank = JSON.parse(await readFile(new URL('../eval/local-template-bank.json', import.meta.url),'utf8'));
const near = (a,b) => assert.ok(Number.isFinite(a) && Math.abs(a-b)<Math.max(1e-9,Math.abs(b)*1e-9), `${a} != ${b}`);

for (const item of bank.filter(x => ['parallelCircuit','planeMirror'].includes(x.templateId || x.target))) {
  test(`${item.expect}: ${item.q}`, () => {
    const template = templates[item.templateId || item.target];
    assert.ok(template, 'template registered');
    const parsed = template.parseQuestion(item.q);
    assert.equal(parsed.ok, item.expect==='local', parsed.message);
    if (!parsed.ok) return;
    const model = template.model(parsed.p1,parsed.p2,parsed.fixed);
    const actual = {...model, p1:parsed.p1, p2:parsed.p2, current:model.metrics[2]};
    for(const [key,value] of Object.entries(item.answer || {})) typeof value === 'number' ? near(actual[key],value) : assert.match(actual[key],new RegExp(value));
    const content = template.content(parsed.p1,parsed.p2,parsed.fixed);
    assert.doesNotMatch(JSON.stringify(content),/NaN|undefined|Infinity/);
    assert.equal(template.parseQuestion(template.question(parsed.p1,parsed.p2,parsed.fixed)).ok,true,'interactive question round trip');
  });
}

test('parallel: independent branches obey Ohm and Kirchhoff laws across the slider range', () => {
  for(const r1 of [.1,1,3,6,30,1000]) for(const r2 of [.1,2,3,60,1000]) for(const voltage of [0,.01,6,12,1000]) {
    const m = templates.parallelCircuit.model(r1,r2,{voltage});
    near(m.i1*r1,voltage); near(m.i2*r2,voltage);
    near(m.metrics[2],m.i1+m.i2); near(1/m.equivalentResistance,1/r1+1/r2);
    assert.ok(m.equivalentResistance<Math.min(r1,r2));
  }
});

test('mirror: missing dimensions stay unknown in answers and generated questions', () => {
  const t=templates.planeMirror;
  const a=t.parseQuestion('平面镜成像，物体距镜面20cm，像距镜面多远？');
  const m=t.model(a.p1,a.p2,a.fixed);
  assert.equal(m.imageHeight,null);
  assert.match(m.conclusion,/物高未给出/);
  assert.doesNotMatch(t.question(a.p1,a.p2,a.fixed),/物高.*\d/);
  // An AI rewrite cannot add a height and use the schematic's default as evidence.
  assert.equal(t.checkQuestion('平面镜成像，物体距镜面20cm，像距镜面多远？',20,5,{distanceKnown:true,heightKnown:true}).ok,false);
});

test('all generic templates expose a recognized grade level', () => {
  assert.equal(Object.keys(templates).length,12);
  for(const t of Object.values(templates)) assert.ok(['junior','senior','both'].includes(t.level),t.id);
  // Week 2 adds the junior inquiry form (no μ); both forms share one template.
  assert.equal(templates.friction.level,'both');
});

test('new templates preserve accepted input precision and reject silent rounding', () => {
  for(const [id,q,expected] of [
    ['parallelCircuit','R1=0.1234Ω 与 R2=3.2Ω 并联接在6.1234V电源上，求干路电流。',0.1234],
    ['planeMirror','平面镜前物距 u=12.1234cm，物高 h=2.5cm，求像距和像高。',12.1234]
  ]) {
    const t=templates[id],parsed=t.parseQuestion(q);
    assert.equal(parsed.ok,true,parsed.message);
    const c=t.content(parsed.p1,parsed.p2,parsed.fixed);
    assert.ok(c.steps[0][1].includes(String(expected)));
    const roundTrip=t.parseQuestion(t.question(parsed.p1,parsed.p2,parsed.fixed));
    near(roundTrip.p1,expected);
    const param=c.params[0],ticks=(expected-param.min)/param.step;
    near(ticks,Math.round(ticks));
  }
  for(const [id,q] of [
    ['parallelCircuit','R1=0.123456Ω 与 R2=3Ω 并联接在6V电源上，求干路电流。'],
    ['parallelCircuit','R1=6Ω 与 R2=3Ω 并联接在6.123456V电源上，求干路电流。'],
    ['planeMirror','平面镜前物距 u=12.123456cm，物高 h=2.5cm，求像距和像高。']
  ]) assert.equal(templates[id].parseQuestion(q).ok,false,q);
});

test('unevaluated expressions and inequalities never become misleading numeric inputs', () => {
  for(const q of [
    'R1=6/2Ω 与 R2=3Ω 并联接在6V电源上，求干路电流。',
    'R1=6+3Ω 与 R2=3Ω 并联接在6V电源上，求干路电流。',
    'R1大于6Ω 与 R2=3Ω 并联接在6V电源上，求干路电流。',
    'R1=2R2=6Ω 与另一电阻3Ω并联接在6V电源上，求干路电流。'
  ]) assert.equal(templates.parallelCircuit.parseQuestion(q).ok,false,q);
  for(const q of ['物体距平面镜20/2cm，求像距。','物体距平面镜20cm，物高大于5cm，求像高。','物体距平面镜20cm，镜面向前平移一段距离，求新的像距。'])
    assert.equal(templates.planeMirror.parseQuestion(q).ok,false,q);
});
