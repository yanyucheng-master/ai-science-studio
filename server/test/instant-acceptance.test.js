import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createMasterLabServer, RateLimiter } from '../src/server.js';
import { InstantSceneService } from '../src/instant-scene-service.js';
import Scene from '../../web/instant-scene.js';

const question = '画两条线段的示意，不计算数值。';
const fixture = (q = question) => ({ version: 1, status: 'scene', subject: '物理', title: '线段', givens: [q], basis: ['表示位置关系。'], assumptions: [], explanation: ['仅作示意。'], objects: [{ id: 'a', type: 'line', from: [100, 100], to: [400, 100] }], labels: [{ target: 'a', text: '线段' }], relations: [], calculations: [] });

for (const hops of [0, 1, 2]) test(`rate limit cannot be bypassed by forged forwarding prefixes with ${hops} trusted proxies`, async () => {
  const server = createMasterLabServer({ deepSeekClient: { configured: false }, trustedProxyHops: hops, rateLimiter: new RateLimiter(1, 60000) });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const suffix = hops === 0 ? '' : hops === 1 ? ', 198.51.100.7' : ', 198.51.100.7, 10.0.0.3';
  const call = prefix => fetch(`http://127.0.0.1:${server.address().port}/api/v1/experiment/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': prefix + suffix }, body: JSON.stringify({ question: '请说明这道题。' }) });
  try {
    const first = await call('203.0.113.11'); assert.equal(first.status, 200); await first.text();
    const second = await call('203.0.113.12'); assert.equal(second.status, 429); assert.equal((await second.json()).error, 'RATE_LIMITED');
  } finally { server.close(); await once(server, 'close'); }
});

test('missing or invalid trusted proxy suffix fails closed to the socket peer', async () => {
  for (const headers of [['203.0.113.1', '203.0.113.2'], ['203.0.113.1, invalid', '203.0.113.2, invalid']]) {
    const server = createMasterLabServer({ deepSeekClient: { configured: false }, trustedProxyHops: 2, rateLimiter: new RateLimiter(1, 60000) });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    try {
      const codes = [];
      for (const header of headers) { const r = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/experiment/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': header }, body: JSON.stringify({ question: '画示意图。' }) }); codes.push(r.status); await r.text(); }
      assert.deepEqual(codes, [200, 429]);
    } finally { server.close(); await once(server, 'close'); }
  }
});

test('bidi controls are rejected in all model prose and quoted text', () => {
  for (const code of [0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069]) {
    const bad = String.fromCharCode(code);
    for (const field of ['title', 'givens', 'basis', 'explanation', 'label', 'reason']) {
      let raw = fixture();
      if (field === 'label') raw.labels[0].text += bad;
      else if (field === 'reason') raw = { version: 1, status: 'declined', reason: '无法确定' + bad };
      else if (Array.isArray(raw[field])) raw[field][0] += bad;
      else raw[field] += bad;
      assert.equal(Scene.validate(raw, question).ok, false, `${field} U+${code.toString(16)}`);
    }
  }
});

test('bidi question rejection happens before any provider call, including verbatim givens', async () => {
  let calls = 0;
  const service = new InstantSceneService({ provider: { configured: true, async generate(q) { calls++; return { raw: fixture(q) }; } } });
  for (const c of ['\u202e', '\u2066', '\u2069']) assert.equal((await service.generate(question + c)).code, 'INVALID_QUESTION');
  assert.equal(calls, 0);
  assert.equal((await service.generate('若a<b，画两条线段。')).mode, 'instant');
  assert.equal(calls, 1);
});

test('normal incidence keeps its direction instead of failing the oblique-ray sign test', () => {
  const q = '光从空气垂直射入水中，画出折射光路。', raw = fixture(q);
  raw.objects = [{ id: 'face', type: 'line', role: 'interface', from: [60, 220], to: [500, 220] }, { id: 'n', type: 'line', role: 'normal', from: [280, 60], to: [280, 400] }, { id: 'in', type: 'arrow', role: 'incident_ray', from: [280, 100], to: [280, 220] }, { id: 'out', type: 'arrow', role: 'refracted_ray', from: [280, 220], to: [280, 360] }];
  raw.labels = [{ target: 'face', text: '界面' }];
  assert.equal(Scene.validate(raw, q).ok, true);
  raw.objects[3].to = [330, 360]; assert.equal(Scene.validate(raw, q).code, 'WRONG_REFRACTION');
});

test('rough static incline requires friction even when omitted or explicitly without external force', () => {
  const q = '物块静止在左高右低的粗糙斜面上，不受外力，画出受力示意图。', raw = fixture(q);
  raw.objects = [{ id: 's', type: 'line', role: 'surface', from: [80, 100], to: [480, 300] }, { id: 'g', type: 'arrow', role: 'gravity', from: [260, 160], to: [260, 300] }, { id: 'n', type: 'arrow', role: 'normal_force', from: [260, 160], to: [300, 80] }];
  raw.labels = [{ target: 'g', text: '重力' }];
  assert.equal(Scene.validate(raw, q).code, 'MISSING_SCIENCE_ANCHOR');
  raw.objects.push({ id: 'f', type: 'arrow', role: 'friction', from: [260, 160], to: [360, 210] });
  assert.equal(Scene.validate(raw, q).code, 'WRONG_FRICTION');
  raw.objects.at(-1).to = [160, 110]; assert.equal(Scene.validate(raw, q).ok, true);
});

test('f(x) notation has the same domain and axes constraints as y notation', () => {
  const q = '画函数 f(x)=x^2 在 x=-3 到 x=3 的图像。', raw = fixture(q); raw.subject = '数学';
  const frame = { x: 60, y: 60, width: 450, height: 320, xMin: -2, xMax: 2, yMin: -1, yMax: 10 };
  raw.objects = [{ id: 'a', type: 'axes', ...frame }, { id: 'c', type: 'curve', ...frame, expression: 'x^2', quote: 'f(x)=x^2' }]; raw.labels = [{ target: 'c', text: '抛物线' }];
  assert.equal(Scene.validate(raw, q).code, 'WRONG_DOMAIN');
  for (const o of raw.objects) { o.xMin = -3; o.xMax = 3; }
  assert.equal(Scene.validate(raw, q).ok, true);
  raw.objects[0].yMax = 9; assert.equal(Scene.validate(raw, q).code, 'INCONSISTENT_AXES');
});

test('numeric evidence preserves the sign and the complete unit', () => {
  const q = '已知速度为5m/s，加速度大小为2m/s²，画一条线段作为符号说明。', raw = fixture(q);
  raw.explanation = ['速度为-5m/s。']; assert.equal(Scene.validate(raw, q).code, 'UNVERIFIED_NUMERIC_CLAIM');
  raw.explanation = ['速度为2m/s。']; assert.equal(Scene.validate(raw, q).code, 'UNVERIFIED_NUMERIC_CLAIM');
  raw.explanation = ['加速度大小为2m/s²。']; assert.equal(Scene.validate(raw, q).ok, true);
  raw.explanation = ['加速度大小为3m/s²。']; assert.equal(Scene.validate(raw, q).code, 'UNVERIFIED_NUMERIC_CLAIM');
});

test('explicit normal incidence verifies zero degrees but never a made-up nonzero angle', () => {
  const q = '光从空气垂直射入水中，画出折射光路。', raw = fixture(q);
  raw.objects = [{ id: 'face', type: 'line', role: 'interface', from: [60, 220], to: [500, 220] }, { id: 'n', type: 'line', role: 'normal', from: [280, 60], to: [280, 400] }, { id: 'in', type: 'arrow', role: 'incident_ray', from: [280, 100], to: [280, 220] }, { id: 'out', type: 'arrow', role: 'refracted_ray', from: [280, 220], to: [280, 360] }];
  raw.labels = [{ target: 'face', text: '界面' }];
  raw.explanation = ['入射角为0°，折射角为0°。'];
  assert.equal(Scene.validate(raw, q).ok, true);
  raw.explanation = ['折射角为5°。']; assert.equal(Scene.validate(raw, q).code, 'UNVERIFIED_NUMERIC_CLAIM');
  raw.explanation = ['光线入水。']; raw.objects[2].from = [180, 100];
  assert.equal(Scene.validate(raw, q).code, 'WRONG_INCIDENT_ANGLE');
});
