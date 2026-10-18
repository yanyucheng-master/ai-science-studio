import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import Scene from '../../web/instant-scene.js';
import { InstantSceneService, DeepSeekSceneProvider } from '../src/instant-scene-service.js';
import { createMasterLabServer } from '../src/server.js';

const question = '画两条垂直的线段作为几何示意，不求数值。';
const fixture = () => ({ version: 1, status: 'scene', subject: '数学', title: '垂直线段', givens: [question], basis: ['两直线相交成直角。'], assumptions: ['图形仅作示意，不按比例。'], explanation: ['两线相互垂直。'], objects: [{ id: 'a', type: 'line', from: [100, 200], to: [400, 200] }, { id: 'b', type: 'line', from: [250, 80], to: [250, 320] }], labels: [{ target: 'a', text: '线段 a' }, { target: 'b', text: '线段 b' }], relations: [{ type: 'perpendicular', objects: ['a', 'b'] }], calculations: [] });

test('portable JSON Schema stays synchronized with the shared contract', async () => {
  assert.deepEqual(JSON.parse(await readFile(new URL('../schema/instant-scene-v1.schema.json', import.meta.url), 'utf8')), Scene.schema());
});

test('display conversion distinguishes branch enumeration from mathematical ratios', () => {
  assert.equal(Scene.displayText('不是串联在R1/R2或R3/R4支路中。'), '不是串联在R1、R2或R3、R4支路中。');
  assert.equal(Scene.displayText('支路电阻比值R1/R2'), '支路电阻比值R1/R2');
  assert.equal(Scene.displayText('y=sqrt(x+1)'), 'y=√(x+1)');
});

test('scene budget counts UTF-8 bytes including Chinese text', () => {
  const q = '科'.repeat(1800), s = fixture(); s.givens = Array(12).fill(q);
  assert.equal(Scene.validate(s, q).code, 'SCENE_TOO_LARGE');
});

test('shared schema accepts independently perpendicular geometry and rejects a false claim', () => {
  assert.equal(Scene.validate(fixture(), question).ok, true);
  const bad = fixture(); bad.objects[1].to = [370, 320];
  assert.equal(Scene.validate(bad, question).code, 'RELATION_MISMATCH');
});
const mutations = [
  ['script element', s => { s.objects[0].type = 'script'; }],
  ['foreignObject', s => { s.objects[0].type = 'foreignObject'; }],
  ['external resource', s => { s.objects[0].href = 'https://evil.invalid/pixel'; }],
  ['event handler', s => { s.objects[0].onload = 'alert(1)'; }],
  ['style injection', s => { s.objects[0].style = 'background:url(https://evil.invalid)'; }],
  ['arbitrary path', s => { s.objects[0].d = 'M0 0L10 10'; }],
  ['markup text', s => { s.labels[0].text = '<svg onload=alert(1)>'; }],
  ['TeX resource', s => { s.labels[0].text = '\\href{https://evil.invalid}{x}'; }],
  ['prototype key', s => { s.objects[0] = JSON.parse('{"__proto__":{"polluted":true}}'); }],
  ['numeric string', s => { s.objects[0].from[0] = '100'; }],
  ['NaN', s => { s.objects[0].from[0] = NaN; }],
  ['infinite coordinate', s => { s.objects[0].to[1] = Infinity; }],
  ['outside viewport', s => { s.objects[0].from[0] = -1; }],
  ['oversized radius', s => { s.objects.push({ id: 'c', type: 'circle', cx: 300, cy: 200, r: 250 }); }],
  ['duplicate object id', s => { s.objects[1].id = 'a'; }],
  ['unknown label target', s => { s.labels[0].target = 'missing'; }],
  ['too many objects', s => { s.objects = Array.from({ length: 49 }, (_, i) => ({ id: `o${i}`, type: 'line', from: [100, 100], to: [200, 200] })); }],
  ['too many points', s => { s.objects[0] = { id: 'a', type: 'polyline', points: Array(97).fill([100, 100]) }; }],
  ['invented condition', s => { s.givens = ['取光滑斜面']; }],
  ['invented scientific assumption', s => { s.assumptions = ['假设接触面光滑，仅作示意。']; }],
  ['unverified numerical conclusion', s => { s.explanation = ['电流等于10A']; }],
  ['excessive output', s => { s.explanation = ['x'.repeat(50000)]; }],
  ['unknown root field', s => { s.scripts = []; }]
];
for (const [name, change] of mutations) test(`security: rejects ${name}`, () => { const bad = fixture(); change(bad); assert.equal(Scene.validate(bad, question).ok, false); });

test('expression grammar computes scientific functions without executing code', () => {
  assert.equal(Scene.expression('abs(x-1)+0.5')(1), .5);
  assert.equal(Scene.expression('sqrt(x+1)')(8), 3);
  assert.ok(Math.abs(Scene.expression('sin(x)+0.5*x')(Math.PI) - Math.PI / 2) < 1e-10);
  assert.equal(Scene.expression('-x^2')(2), -4);
  for (const code of ['globalThis.process.exit()', 'x.constructor', 'alert(1)', 'x=1', 'x;2', '1e9999', 'x^999', 'sqrt('.repeat(50)]) assert.throws(() => Scene.expression(code));
});

test('computed results require original values, units and rule preconditions', () => {
  const q = '直角三角形的两条直角边为3cm和4cm，只画示意。';
  const s = fixture(); s.givens = [q]; s.calculations = [{ rule: 'pythagoras', inputs: [{ name: 'a', value: 3, unit: 'cm', quote: '3cm' }, { name: 'b', value: 4, unit: 'cm', quote: '4cm' }] }];
  assert.equal(Scene.validate(s, q).results[0].value, 5);
  s.calculations[0].inputs[1].value = 5; assert.equal(Scene.validate(s, q).ok, false);
});

test('scientific checks cannot be bypassed by omitting claimed relations', () => {
  const q = '画斜面物块的重力受力示意。', s = fixture(); s.subject = '物理'; s.givens = [q]; s.relations = [];
  s.objects[0] = { id: 'a', type: 'arrow', role: 'gravity', from: [200, 200], to: [200, 100] };
  assert.equal(Scene.validate(s, q).code, 'WRONG_GRAVITY');
  s.objects[0].to = [200, 300]; assert.equal(Scene.validate(s, q).code, 'MISSING_SCIENCE_ANCHOR');
});

test('free fall does not invent a normal force and numeric units must belong to the value', () => {
  const q = '只画自由落体的重力受力示意。', s = fixture(); s.subject = '物理'; s.givens = [q]; s.relations = [];
  s.objects[0] = { id: 'a', type: 'arrow', role: 'gravity', from: [200, 200], to: [200, 300] };
  assert.equal(Scene.validate(s, q).ok, true);
  const text = '电压3V，电阻4Ω。'; s.givens = [text];
  s.calculations = [{ rule: 'ohm', inputs: [{ name: 'U', value: 4, unit: 'V', quote: text }, { name: 'R', value: 3, unit: 'Ω', quote: text }] }];
  assert.equal(Scene.validate(s, text).code, 'UNVERIFIED_INPUT');
});

test('gravity decomposition must close a common-origin vector triangle', () => {
  const q = '物块在斜面上，画重力分解。', s = fixture(); s.subject = '物理'; s.givens = [q]; s.relations = [];
  s.objects = [
    { id: 'a', type: 'line', role: 'surface', from: [100, 300], to: [400, 150] },
    { id: 'b', type: 'arrow', role: 'gravity', from: [250, 200], to: [250, 300] },
    { id: 'p', type: 'arrow', role: 'gravity_parallel', from: [250, 200], to: [210, 220] },
    { id: 'n', type: 'arrow', role: 'gravity_normal', from: [250, 200], to: [290, 280] }
  ];
  assert.equal(Scene.validate(s, q).ok, true);
  s.objects[2].to = [190, 230]; assert.equal(Scene.validate(s, q).code, 'WRONG_VECTOR_SUM');
});

test('thin lens checks reject missing roles, converging rays and mismatched virtual extensions', () => {
  const q = '凹透镜对平行于主光轴的光发散。', s = fixture(); s.subject = '物理'; s.givens = [q]; s.relations = []; s.explanation = ['采用薄透镜光路示意。'];
  s.objects = [
    { id: 'a', role: 'lens', type: 'polygon', points: [[285, 100], [315, 100], [305, 200], [315, 300], [285, 300], [295, 200]] },
    { id: 'b', role: 'optical_axis', type: 'line', from: [60, 200], to: [530, 200] },
    { id: 'f', role: 'virtual_focus', type: 'circle', cx: 180, cy: 200, r: 4 },
    { id: 'i', role: 'incident_ray', type: 'arrow', from: [80, 150], to: [300, 150] },
    { id: 'o', role: 'refracted_ray', type: 'arrow', from: [300, 150], to: [480, 75] },
    { id: 'e', role: 'ray_extension', type: 'line', dashed: true, from: [300, 150], to: [180, 200] }
  ];
  assert.equal(Scene.validate(s, q).ok, true);
  const noRole = structuredClone(s); delete noRole.objects[0].role; assert.equal(Scene.validate(noRole, q).code, 'MISSING_SCIENCE_ANCHOR');
  const converging = structuredClone(s); converging.objects[4].to = [480, 225]; assert.equal(Scene.validate(converging, q).code, 'WRONG_LENS_RAY');
  s.objects[5].dashed = false; assert.equal(Scene.validate(s, q).code, 'WRONG_LENS_RAY');
});

test('named electrical components cannot be silently left unlabelled', () => {
  const q = '画电阻R1和R2。', s = fixture(); s.givens = [q];
  s.labels = [{ target: 'a', text: 'R1' }, { target: 'b', text: 'B（R2端点）' }];
  assert.equal(Scene.validate(s, q).code, 'MISSING_COMPONENT_LABEL');
  s.labels[1].text = 'R_2'; assert.equal(Scene.validate(s, q).ok, true);
});

test('water displacement apparatus requires an open submerged mouth and a sealed connected source', () => {
  const q = '用排水法收集氧气的装置示意。', s = fixture(); s.subject = '化学'; s.givens = [q]; s.relations = [];
  s.objects = [
    { id: 'a', type: 'polygon', role: 'reaction_vessel', points: [[80, 360], [200, 360], [160, 270], [160, 210], [120, 210], [120, 270]] },
    { id: 'b', type: 'polyline', role: 'collection_vessel', points: [[420, 340], [420, 130], [460, 130], [460, 340]] },
    { id: 'tube', type: 'polyline', role: 'gas_tube', points: [[140, 240], [140, 140], [340, 140], [340, 350], [440, 350]] },
    { id: 'stop', type: 'rect', role: 'stopper', x: 118, y: 195, width: 44, height: 15 },
    { id: 'tank', type: 'rect', role: 'water_trough', x: 330, y: 300, width: 200, height: 100 },
    { id: 'water', type: 'rect', role: 'water', x: 332, y: 320, width: 196, height: 78 }
  ];
  assert.equal(Scene.validate(s, q).ok, true);
  const closed = structuredClone(s); closed.objects[1].type = 'polygon'; assert.equal(Scene.validate(closed, q).code, 'UNVERIFIED_GAS_COLLECTION');
  const disconnected = structuredClone(s); disconnected.objects[2].points[0] = [140, 195]; assert.equal(Scene.validate(disconnected, q).code, 'DISCONNECTED_GAS_TUBE');
  const leaking = structuredClone(s); leaking.objects[3].x = 130; assert.equal(Scene.validate(leaking, q).code, 'UNSEALED_REACTION_VESSEL');
});

test('service bounds time even if a provider ignores cancellation', async () => {
  const service = new InstantSceneService({ provider: { configured: true, generate: () => new Promise(() => {}) }, timeoutMs: 15 });
  assert.equal((await service.generate(question)).code, 'AI_TIMEOUT'); assert.equal(service.active, 0);
});
test('service preserves input and retries only when explicitly requested; cache is copied', async () => {
  let calls = 0; const service = new InstantSceneService({ provider: { configured: true, async generate() { calls++; return { raw: fixture(), model: 'fixture', usage: { total_tokens: 100 } }; } } });
  const first = await service.generate(question); first.scene.title = 'changed';
  const second = await service.generate(question);
  assert.equal(calls, 1); assert.equal(second.cached, true); assert.equal(second.scene.title, '垂直线段'); assert.deepEqual(second.usage, {});
});
test('failed and cancelled generations do not become cached successes', async () => {
  let calls = 0; const service = new InstantSceneService({ provider: { configured: true, async generate() { calls++; throw new Error('AI_RATE_LIMITED'); } } });
  assert.equal((await service.generate(question)).code, 'AI_RATE_LIMITED');
  assert.equal((await service.generate(question)).code, 'AI_RATE_LIMITED'); assert.equal(calls, 2);
  const controller = new AbortController(); controller.abort(); assert.equal((await service.generate(question, { signal: controller.signal })).code, 'ABORTED'); assert.equal(calls, 2);
});
test('provider limits response bytes and rejects truncated model output', async () => {
  const provider = new DeepSeekSceneProvider({ apiKey: 'fixture-only', fetch: async () => new Response('x'.repeat(96001)) });
  await assert.rejects(provider.generate(question, {}), /RESPONSE_TOO_LARGE/);
  provider.fetch = async () => Response.json({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] });
  await assert.rejects(provider.generate(question, {}), /INCOMPLETE_RESPONSE/);
});
test('scene endpoint validates input and applies CORS without changing tutor routes', async () => {
  const server = createMasterLabServer({ deepSeekClient: { configured: false }, instantSceneService: new InstantSceneService({ provider: { configured: true, async generate() { return { raw: fixture(), model: 'fixture' }; } } }), allowedOrigins: ['https://allowed.invalid'] });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const call = (body, origin) => fetch(`${base}/api/v1/scene/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body) });
    assert.equal((await call({ question: 1 })).status, 400);
    assert.equal((await call({ question }, 'https://other.invalid')).status, 403);
    const result = await call({ question }, 'https://allowed.invalid'); assert.equal(result.status, 200); assert.equal((await result.json()).mode, 'instant');
  } finally { server.close(); await once(server, 'close'); }
});
