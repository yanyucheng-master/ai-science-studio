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

// Independent acceptance 2026-10-18: rules must follow the physics of the stated situation, not the wording of the 30 samples.
const sceneFor = (q, subject, objects, labels, extra = {}) => ({ version: 1, status: 'scene', subject, title: '示意', givens: [q], basis: ['依据。'], assumptions: [], explanation: ['示意。'], objects, labels, relations: [], calculations: [], ...extra });
const rays = (incidentFrom, outgoingTo) => [
  { id: 'face', type: 'line', role: 'interface', from: [80, 240], to: [500, 240] },
  { id: 'nrm', type: 'line', role: 'normal', from: [290, 90], to: [290, 390], dashed: true },
  { id: 'inc', type: 'arrow', role: 'incident_ray', from: incidentFrom, to: [290, 240] },
  { id: 'out', type: 'arrow', role: 'refracted_ray', from: [290, 240], to: outgoingTo }
];
const rayLabels = [{ target: 'face', text: '界面' }, { target: 'nrm', text: '法线' }, { target: 'inc', text: '入射光线' }, { target: 'out', text: '折射光线' }];

test('refraction bends toward the normal into water and away from it into air', () => {
  const up = '一束光从水中斜射入空气中，画出界面、法线、入射光线和折射光线。';
  assert.equal(Scene.validate(sceneFor(up, '物理', rays([190, 390], [470, 110]), rayLabels), up).ok, true);
  assert.equal(Scene.validate(sceneFor(up, '物理', rays([190, 390], [340, 90]), rayLabels), up).code, 'WRONG_REFRACTION');
  const down = '一束光从空气斜射入水中，画出界面、法线、入射光线和折射光线。';
  assert.equal(Scene.validate(sceneFor(down, '物理', rays([130, 90], [340, 390]), rayLabels), down).ok, true);
  assert.equal(Scene.validate(sceneFor(down, '物理', rays([190, 90], [470, 370]), rayLabels), down).code, 'WRONG_REFRACTION');
});

test('friction from a fixed rough desk opposes the motion; only belt cases point forward', () => {
  const desk = '木块在粗糙水平桌面上受到向右的水平拉力，向右加速运动。画出木块的受力示意图（重力、支持力、拉力和摩擦力）。';
  const forces = to => [
    { id: 'box', type: 'rect', role: 'body', x: 230, y: 200, width: 120, height: 70 },
    { id: 'desk', type: 'line', role: 'surface', from: [60, 270], to: [520, 270] },
    { id: 'g', type: 'arrow', role: 'gravity', from: [290, 235], to: [290, 380] },
    { id: 'n', type: 'arrow', role: 'normal_force', from: [290, 235], to: [290, 90] },
    { id: 't', type: 'arrow', role: 'tension', from: [350, 235], to: [500, 235] },
    { id: 'f', type: 'arrow', role: 'friction', from: [230, 262], to }
  ];
  const labels = [{ target: 'g', text: '重力G' }, { target: 'n', text: '支持力N' }, { target: 't', text: '拉力F' }, { target: 'f', text: '摩擦力f' }];
  assert.equal(Scene.validate(sceneFor(desk, '物理', forces([90, 262]), labels), desk).ok, true);
  assert.equal(Scene.validate(sceneFor(desk, '物理', forces([370, 262]), labels), desk).code, 'WRONG_FRICTION');
  const belt = '水平传送带向右加速，箱子与传送带保持相对静止且一起加速。画箱子的受力示意，标出静摩擦力方向。';
  assert.equal(Scene.validate(sceneFor(belt, '物理', forces([370, 262]), labels), belt).ok, true);
  assert.equal(Scene.validate(sceneFor(belt, '物理', forces([90, 262]), labels), belt).code, 'WRONG_FRICTION');
});

test('static friction on a rough incline at rest without applied force acts up the slope', () => {
  const q = '一个物块静止在左高右低的粗糙固定斜面上，画出物块受到的重力、支持力和静摩擦力示意图。';
  const s = { id: 's', type: 'line', role: 'surface', from: [80, 140], to: [500, 380] };
  const len = Math.hypot(420, 240), ux = 420 / len, uy = 240 / len, nx = uy, ny = -ux, c = [290, 260], h = 50, w = 90;
  const p0 = [c[0] - ux * w / 2, c[1] - uy * w / 2], p1 = [c[0] + ux * w / 2, c[1] + uy * w / 2], m = [c[0] + nx * h / 2, c[1] + ny * h / 2];
  const objects = f => [s, { id: 'b', type: 'polygon', role: 'body', points: [p0, p1, [p1[0] + nx * h, p1[1] + ny * h], [p0[0] + nx * h, p0[1] + ny * h]] },
    { id: 'g', type: 'arrow', role: 'gravity', from: m, to: [m[0], m[1] + 120] },
    { id: 'n', type: 'arrow', role: 'normal_force', from: m, to: [m[0] + nx * 110, m[1] + ny * 110] },
    { id: 'f', type: 'arrow', role: 'friction', from: m, to: [m[0] + f * ux * 100, m[1] + f * uy * 100] }];
  const labels = [{ target: 'g', text: '重力G' }, { target: 'n', text: '支持力N' }, { target: 'f', text: '静摩擦力f' }];
  assert.equal(Scene.validate(sceneFor(q, '物理', objects(-1), labels), q).ok, true);
  assert.equal(Scene.validate(sceneFor(q, '物理', objects(1), labels), q).code, 'WRONG_FRICTION');
});

test('a plotted curve must be the stated function over the stated observation window', () => {
  const q = '绘制函数 y=sin(x)+0.5*x 在 x=-4 到 x=4 的图像，说明正弦振荡叠加线性趋势。';
  const frame = { x: 60, y: 60, width: 460, height: 330, xMin: -4, xMax: 4, yMin: -3, yMax: 3 };
  const plot = (expression, window = {}) => sceneFor(q, '数学', [{ id: 'ax', type: 'axes', ...frame, ...window }, { id: 'cv', type: 'curve', ...frame, ...window, expression, quote: 'sin(x)+0.5*x' }], [{ target: 'cv', text: 'y=sin(x)+0.5*x' }]);
  assert.equal(Scene.validate(plot('sin(x)+0.5*x'), q).ok, true);
  for (const fragment of ['sin(x)', '0.5*x', 'x']) assert.equal(Scene.validate(plot(fragment), q).code, 'FUNCTION_MISMATCH');
  assert.equal(Scene.validate(plot('sin(x)+0.5*x', { xMin: -1, xMax: 1 }), q).code, 'WRONG_DOMAIN');
  const p = '绘制函数 y=-x^2+4 在 x=-3 到 x=3 的图像。', f2 = { ...frame, xMin: -3, xMax: 3, yMin: -6, yMax: 5 };
  const parabola = expression => sceneFor(p, '数学', [{ id: 'ax', type: 'axes', ...f2 }, { id: 'cv', type: 'curve', ...f2, expression, quote: 'y=-x^2+4' }], [{ target: 'cv', text: 'y=-x^2+4' }]);
  assert.equal(Scene.validate(parabola('-x^2+4'), p).ok, true);
  assert.equal(Scene.validate(parabola('x^2+4'), p).code, 'FUNCTION_MISMATCH');
});

test('an angle with the mirror fixes the incident angle, and only that verified value may be stated', () => {
  const q = '一束光与水平放置的平面镜成30°角射到镜面上。画出入射光线、法线和反射光线，并标出反射角的度数。';
  const mirror = (incidence, label) => {
    const a = incidence * Math.PI / 180, P = [290, 330], L = 200;
    return sceneFor(q, '物理', [
      { id: 'mir', type: 'line', role: 'mirror', from: [80, 330], to: [500, 330] },
      { id: 'nrm', type: 'line', role: 'normal', from: [290, 100], to: [290, 330], dashed: true },
      { id: 'inc', type: 'arrow', role: 'incident_ray', from: [P[0] - L * Math.sin(a), P[1] - L * Math.cos(a)], to: P },
      { id: 'ref', type: 'arrow', role: 'reflected_ray', from: P, to: [P[0] + L * Math.sin(a), P[1] - L * Math.cos(a)] }
    ], [{ target: 'mir', text: '平面镜' }, { target: 'nrm', text: '法线' }, { target: 'inc', text: '入射光线' }, { target: 'ref', text: label }]);
  };
  assert.equal(Scene.validate(mirror(60, '反射角=60°'), q).ok, true);
  assert.equal(Scene.validate(mirror(30, '反射光线'), q).code, 'WRONG_INCIDENT_ANGLE');
  assert.equal(Scene.validate(mirror(60, '反射角=50°'), q).code, 'UNVERIFIED_NUMERIC_CLAIM');
});

test('stated values must come from the question or a program check, whatever the phrasing', () => {
  const q = '画出一个静止在水平地面上的木箱的受力示意图，不求数值。';
  const objects = [{ id: 'box', type: 'rect', role: 'body', x: 230, y: 200, width: 120, height: 80 }, { id: 'floor', type: 'line', role: 'surface', from: [60, 280], to: [520, 280] },
    { id: 'g', type: 'arrow', role: 'gravity', from: [290, 240], to: [290, 390] }, { id: 'n', type: 'arrow', role: 'normal_force', from: [290, 240], to: [290, 90] }];
  const labels = [{ target: 'g', text: '重力G' }, { target: 'n', text: '支持力N' }];
  for (const claim of ['重力是 50 N。', '重力约 49 N。', '支持力为50N。', '重力 G≈50 N。', '支持力大小是 50 N。', '重力=50N。']) {
    assert.equal(Scene.validate(sceneFor(q, '物理', objects, labels, { explanation: [claim] }), q).code, 'UNVERIFIED_NUMERIC_CLAIM', claim);
  }
  assert.equal(Scene.validate(sceneFor(q, '物理', objects, labels, { explanation: ['时间约 5 min 的观察不影响受力。'] }), q).ok, true);
  const given = '质量为5kg的木箱静止在水平地面上，画出受力示意图。';
  assert.equal(Scene.validate(sceneFor(given, '物理', objects, labels, { explanation: ['木箱质量为 5 kg。'] }), given).ok, true);
});

test('component ids may carry capitals and wires may meet another segment mid-way', () => {
  const q = '画出电阻R1接在电源两端的电路结构。';
  const s = sceneFor(q, '物理', [{ id: 'res_R1', type: 'rect', x: 200, y: 100, width: 60, height: 24 }, { id: 'plate', type: 'line', from: [103, 205], to: [123, 205] }, { id: 'lead', type: 'line', from: [113, 330], to: [113, 205] }],
    [{ target: 'res_R1', text: 'R1' }], { relations: [{ type: 'connected', objects: ['lead', 'plate'] }] });
  assert.equal(Scene.validate(s, q).ok, true);
  s.objects[2].to = [113, 215]; assert.equal(Scene.validate(s, q).code, 'RELATION_MISMATCH');
  s.objects[0].id = 'R1 '; s.labels[0].target = 'R1 '; assert.equal(Scene.validate(s, q).code, 'INVALID_ID');
});

test('heated test-tube collection needs the tube through the stopper and a mouth that does not point up', () => {
  const q = '用加热高锰酸钾的方法制取氧气，并用排水法收集。画出实验装置示意图（试管、酒精灯、导管、水槽和集气瓶）。';
  const apparatus = () => sceneFor(q, '化学', [
    { id: 'tube', type: 'polygon', role: 'reaction_vessel', points: [[230, 255], [115, 210], [100, 225], [115, 240], [230, 285]] },
    { id: 'stop', type: 'rect', role: 'stopper', x: 228, y: 250, width: 14, height: 35 },
    { id: 'pipe', type: 'polyline', role: 'gas_tube', points: [[190, 245], [230, 265], [245, 265], [300, 270], [380, 300], [410, 320], [465, 350]] },
    { id: 'tank', type: 'polyline', role: 'water_trough', points: [[360, 300], [360, 400], [530, 400], [530, 300]] },
    { id: 'water', type: 'rect', role: 'water', x: 360, y: 300, width: 170, height: 100 },
    { id: 'jar', type: 'polyline', role: 'collection_vessel', points: [[430, 330], [430, 180], [500, 180], [500, 330]] }
  ], [{ target: 'tube', text: '试管' }, { target: 'jar', text: '集气瓶' }]);
  assert.equal(Scene.validate(apparatus(), q).ok, true);
  const upward = apparatus(); upward.objects[0].points = [[230, 200], [115, 245], [100, 230], [115, 215], [230, 170]]; upward.objects[1].y = 165; upward.objects[2].points[0] = [190, 215]; upward.objects[2].points[1] = [230, 180];
  assert.equal(Scene.validate(upward, q).code, 'TEST_TUBE_MOUTH_UPWARD');
  const bypass = apparatus(); bypass.objects[1].y = 120; assert.equal(Scene.validate(bypass, q).code, 'UNSEALED_REACTION_VESSEL');
});

test('inequality questions are valid and invalid questions are refused before any paid call', async () => {
  const q = '已知 a<b，画两条垂直的线段作为几何示意，不求数值。', s = fixture(); s.givens = [q];
  assert.equal(Scene.validate(s, q).ok, true);
  let calls = 0; const service = new InstantSceneService({ provider: { configured: true, async generate(text) { calls++; const r = fixture(); r.givens = [text]; return { raw: r, model: 'fixture' }; } } });
  assert.equal((await service.generate('画图\u0007')).code, 'INVALID_QUESTION'); assert.equal(calls, 0);
  assert.equal((await service.generate(q)).mode, 'instant'); assert.equal(calls, 1);
});

test('display conversion writes absolute values and products in school notation', () => {
  assert.equal(Scene.displayText('y=abs(x-1)+0.5'), 'y=|x-1|+0.5');
  assert.equal(Scene.displayText('曲线 y=sin(x)+0.5*x'), '曲线 y=sin(x)+0.5x');
  assert.equal(Scene.displayText('F=m*a'), 'F=m·a');
});
