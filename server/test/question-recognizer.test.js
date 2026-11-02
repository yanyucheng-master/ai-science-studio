import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createMasterLabServer, RateLimiter } from '../src/server.js';
import {
  MAX_IMAGE_BYTES,
  QuestionRecognizer,
  RECOGNIZE_SYSTEM_PROMPT,
  parseRecognizeResponse,
  sanitizeRecognizeRequest,
  sniffImageMime
} from '../src/question-recognizer.js';

const JPEG_HEAD = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP_HEAD = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')]);

function imageBytes(head, size = 400) {
  return Buffer.concat([head, Buffer.alloc(Math.max(0, size - head.length), 0x41)]);
}

function dataUrl(mime, bytes) {
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

const GOOD = dataUrl('image/jpeg', imageBytes(JPEG_HEAD));

test('accepts JPEG, PNG and WebP photos whose bytes match the declared type', () => {
  for (const [mime, head] of [['image/jpeg', JPEG_HEAD], ['image/png', PNG_HEAD], ['image/webp', WEBP_HEAD]]) {
    const input = sanitizeRecognizeRequest({ image: dataUrl(mime, imageBytes(head)) });
    assert.equal(input?.mime, mime);
    assert.equal(input.bytes, 400);
  }
  assert.equal(sniffImageMime(imageBytes(JPEG_HEAD)), 'image/jpeg');
  assert.equal(sniffImageMime(Buffer.from('GIF89a')), '');
});

test('rejects anything that is not a plain JPEG, PNG or WebP photo', () => {
  const rejected = [
    null,
    [],
    {},
    { image: 42 },
    { image: 'https://example.com/a.jpg' },
    { image: dataUrl('image/gif', imageBytes(Buffer.from('GIF89a'))) },
    { image: dataUrl('image/svg+xml', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'.padEnd(200, ' '))) },
    { image: dataUrl('text/html', Buffer.from('<script>alert(1)</script>'.padEnd(200, ' '))) },
    { image: dataUrl('image/jpeg', imageBytes(PNG_HEAD)) },
    { image: dataUrl('image/png', imageBytes(JPEG_HEAD)) },
    { image: dataUrl('image/webp', imageBytes(Buffer.from('RIFF....WAVE'))) },
    { image: 'data:image/jpeg;base64,@@@@' },
    { image: dataUrl('image/jpeg', imageBytes(JPEG_HEAD, 32)) },
    { image: dataUrl('image/jpeg', imageBytes(JPEG_HEAD, MAX_IMAGE_BYTES + 1)) }
  ];
  for (const body of rejected) assert.equal(sanitizeRecognizeRequest(body), null, JSON.stringify(body)?.slice(0, 80));
});

test('parses the model reply into a normalised result', () => {
  assert.deepEqual(parseRecognizeResponse('{"isQuestion":true,"text":"求刹车距离。","unclear":false,"multiple":false}'),
    { isQuestion: true, text: '求刹车距离。', unclear: false, multiple: false });
  assert.equal(parseRecognizeResponse('```json\n{"isQuestion":true,"text":"a"}\n```').text, 'a');
  assert.equal(parseRecognizeResponse('结果如下：{"isQuestion":true,"text":"b"} 谢谢').text, 'b');
  assert.deepEqual(parseRecognizeResponse('{"isQuestion":false,"text":"风景照"}'), { isQuestion: false, text: '', unclear: false, multiple: false });
  assert.equal(parseRecognizeResponse('{"isQuestion":true,"text":"   "}'), null);
  assert.equal(parseRecognizeResponse('{"isQuestion":true,"text":"v = [?]m/s"}').unclear, true);
  assert.equal(parseRecognizeResponse('{"isQuestion":true,"text":"x < 2，y > 3\\n\\n\\n\\n求"}').text, 'x < 2，y > 3\n\n求');
  assert.equal(parseRecognizeResponse('{"isQuestion":true,"text":"x","multiple":true}').multiple, true);
  const long = parseRecognizeResponse(JSON.stringify({ isQuestion: true, text: '题'.repeat(3000) }));
  assert.equal(long.text.length, 1500);
  assert.equal(long.truncated, true);
  assert.equal(parseRecognizeResponse('一辆汽车以 20m/s 行驶，求刹车距离。'), null);
  assert.equal(parseRecognizeResponse('{"isQuestion":"true","text":"题目"}'), null);
  assert.equal(parseRecognizeResponse('{"isQuestion":true}'), null);
  assert.equal(parseRecognizeResponse(''), null);
  assert.equal(parseRecognizeResponse(undefined), null);
});

function fakeFetch(handler) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return handler(url, options, calls.length);
  };
  return { fetchImpl, calls };
}

function upstreamReply(content) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
}

test('sends the photo to the vision model only in a user message and returns the transcription', async () => {
  const { fetchImpl, calls } = fakeFetch(() => upstreamReply('{"isQuestion":true,"text":"题目","unclear":false,"multiple":false}'));
  const recognizer = new QuestionRecognizer({ apiKey: 'sk-test', baseUrl: 'https://api.example.test/', model: 'deepseek-flash', fetchImpl, timeoutMs: 1000 });
  const result = await recognizer.recognize({ dataUrl: GOOD });
  assert.equal(result.text, '题目');
  assert.equal(result.model, 'deepseek-flash');
  const [call] = calls;
  assert.equal(call.url, 'https://api.example.test/chat/completions');
  assert.equal(call.options.headers.Authorization, 'Bearer sk-test');
  assert.equal(call.body.model, 'deepseek-flash');
  assert.deepEqual(call.body.thinking, { type: 'disabled' });
  assert.equal(call.body.messages[0].role, 'system');
  assert.equal(call.body.messages[0].content, RECOGNIZE_SYSTEM_PROMPT);
  assert.equal(typeof call.body.messages[0].content, 'string');
  const user = call.body.messages[1];
  assert.equal(user.role, 'user');
  assert.deepEqual(user.content[1], { type: 'image_url', image_url: { url: GOOD } });
  assert.equal(JSON.stringify(call.body.messages[0]).includes('data:image'), false);
});

test('maps upstream failures to stable error codes', async () => {
  const cases = [
    [401, 'AI_AUTH_FAILED'],
    [403, 'AI_AUTH_FAILED'],
    [429, 'AI_RATE_LIMITED'],
    [500, 'AI_UPSTREAM_ERROR'],
    [400, 'AI_UPSTREAM_ERROR']
  ];
  for (const [status, code] of cases) {
    const { fetchImpl } = fakeFetch(() => new Response('{}', { status }));
    const recognizer = new QuestionRecognizer({ apiKey: 'k', fetchImpl });
    await assert.rejects(recognizer.recognize({ dataUrl: GOOD }), error => error.code === code, String(status));
  }
  const unparsable = new QuestionRecognizer({ apiKey: 'k', fetchImpl: fakeFetch(() => upstreamReply('{"isQuestion":true}')).fetchImpl });
  await assert.rejects(unparsable.recognize({ dataUrl: GOOD }), error => error.code === 'INVALID_AI_RESPONSE');
  const network = new QuestionRecognizer({ apiKey: 'k', fetchImpl: async () => { throw new TypeError('fetch failed'); } });
  await assert.rejects(network.recognize({ dataUrl: GOOD }), error => error.code === 'AI_UPSTREAM_ERROR');
  const missingKey = new QuestionRecognizer({ apiKey: '' });
  assert.equal(missingKey.configured, false);
  await assert.rejects(missingKey.recognize({ dataUrl: GOOD }), error => error.code === 'AI_AUTH_FAILED');
});

test('times out a stalled upstream and honours the caller abort signal', async () => {
  const stalled = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  });
  const slow = new QuestionRecognizer({ apiKey: 'k', timeoutMs: 20, fetchImpl: async (u, o) => stalled(u, o) });
  await assert.rejects(slow.recognize({ dataUrl: GOOD }), error => error.code === 'AI_TIMEOUT');
  const controller = new AbortController();
  const cancellable = new QuestionRecognizer({ apiKey: 'k', timeoutMs: 5000, fetchImpl: async (u, o) => stalled(u, o) });
  const pending = cancellable.recognize({ dataUrl: GOOD }, { signal: controller.signal });
  setTimeout(() => controller.abort(), 10);
  await assert.rejects(pending, error => error.code === 'AI_ABORTED');
});

async function withServer(run, options = {}) {
  const server = createMasterLabServer({
    deepSeekClient: { configured: false },
    allowedOrigins: options.allowedOrigins || [],
    questionRecognizer: options.questionRecognizer,
    recognizeRateLimiter: options.recognizeRateLimiter
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
    server.closeAllConnections?.();
    await once(server, 'close');
  }
}

const post = (baseUrl, path, body, headers = {}) => fetch(`${baseUrl}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body)
});

function fakeRecognizer(handler) {
  const calls = [];
  return {
    calls,
    configured: true,
    async recognize(input, options) {
      calls.push(input);
      return handler(input, options);
    }
  };
}

test('POST /api/v1/question/recognize returns the transcription without logging the photo', async () => {
  const recognizer = fakeRecognizer(() => ({ isQuestion: true, text: '一辆汽车以 20m/s 行驶，求刹车距离。', unclear: false, multiple: false, model: 'deepseek-flash' }));
  const logged = [];
  const originalInfo = console.info;
  console.info = (...args) => logged.push(args.join(' '));
  try {
    await withServer(async baseUrl => {
      const response = await post(baseUrl, '/api/v1/question/recognize', { image: GOOD });
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.text, '一辆汽车以 20m/s 行驶，求刹车距离。');
      assert.equal(body.source, 'deepseek');
      assert.ok(body.requestId);
      assert.equal(recognizer.calls.length, 1);
      assert.equal(recognizer.calls[0].dataUrl, GOOD);
    }, { questionRecognizer: recognizer });
  } finally {
    console.info = originalInfo;
  }
  assert.ok(logged.some(line => line.includes('/api/v1/question/recognize')));
  assert.equal(logged.some(line => line.includes('data:image') || line.includes('刹车')), false);
});

test('the recognize route accepts a larger body than other routes but still has a cap', async () => {
  const recognizer = fakeRecognizer(() => ({ isQuestion: true, text: 'ok', unclear: false, multiple: false, model: 'm' }));
  await withServer(async baseUrl => {
    const mid = dataUrl('image/jpeg', imageBytes(JPEG_HEAD, 300 * 1024));
    assert.equal((await post(baseUrl, '/api/v1/question/recognize', { image: mid })).status, 200);
    assert.equal((await post(baseUrl, '/api/v1/tutor/chat', { image: mid })).status, 413);
    const huge = JSON.stringify({ image: dataUrl('image/jpeg', imageBytes(JPEG_HEAD, 3 * 1024 * 1024 + 4096)) });
    assert.equal((await post(baseUrl, '/api/v1/question/recognize', huge)).status, 413);
    assert.equal(recognizer.calls.length, 1);
  }, { questionRecognizer: recognizer });
});

test('the recognize route validates input and reports configuration problems', async () => {
  const recognizer = fakeRecognizer(() => ({ isQuestion: true, text: 'ok', unclear: false, multiple: false, model: 'm' }));
  await withServer(async baseUrl => {
    for (const body of [{}, { image: 'nope' }, { image: dataUrl('image/gif', imageBytes(Buffer.from('GIF89a'))) }, { image: dataUrl('image/jpeg', imageBytes(PNG_HEAD)) }]) {
      const response = await post(baseUrl, '/api/v1/question/recognize', body);
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error, 'INVALID_IMAGE');
    }
    const broken = await post(baseUrl, '/api/v1/question/recognize', '{oops');
    assert.equal(broken.status, 400);
    assert.equal((await broken.json()).error, 'INVALID_JSON');
    assert.equal(recognizer.calls.length, 0);
  }, { questionRecognizer: recognizer });
  await withServer(async baseUrl => {
    const response = await post(baseUrl, '/api/v1/question/recognize', { image: GOOD });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, 'AI_NOT_CONFIGURED');
  }, { questionRecognizer: { configured: false } });
});

test('the recognize route maps upstream failures to HTTP statuses', async () => {
  for (const [code, status, error] of [
    ['AI_TIMEOUT', 504, 'AI_TIMEOUT'],
    ['AI_RATE_LIMITED', 429, 'AI_RATE_LIMITED'],
    ['AI_BUSY', 429, 'AI_BUSY'],
    ['AI_AUTH_FAILED', 503, 'AI_NOT_CONFIGURED'],
    ['INVALID_AI_RESPONSE', 502, 'INVALID_AI_RESPONSE'],
    ['AI_UPSTREAM_ERROR', 503, 'AI_UNAVAILABLE']
  ]) {
    const recognizer = fakeRecognizer(() => { throw Object.assign(new Error('x'), { code }); });
    await withServer(async baseUrl => {
      const response = await post(baseUrl, '/api/v1/question/recognize', { image: GOOD });
      assert.equal(response.status, status, code);
      assert.equal((await response.json()).error, error, code);
    }, { questionRecognizer: recognizer });
  }
});

test('the recognize route has its own stricter rate limit', async () => {
  const recognizer = fakeRecognizer(() => ({ isQuestion: true, text: 'ok', unclear: false, multiple: false, model: 'm' }));
  await withServer(async baseUrl => {
    assert.equal((await post(baseUrl, '/api/v1/question/recognize', { image: GOOD })).status, 200);
    assert.equal((await post(baseUrl, '/api/v1/question/recognize', { image: GOOD })).status, 200);
    const limited = await post(baseUrl, '/api/v1/question/recognize', { image: GOOD });
    assert.equal(limited.status, 429);
    assert.equal((await limited.json()).error, 'RATE_LIMITED');
    assert.equal(recognizer.calls.length, 2);
  }, { questionRecognizer: recognizer, recognizeRateLimiter: new RateLimiter(2, 60000) });
});

test('CORS preflight for the recognize route follows the allowed origins', async () => {
  const recognizer = fakeRecognizer(() => ({ isQuestion: true, text: 'ok', unclear: false, multiple: false, model: 'm' }));
  await withServer(async baseUrl => {
    const preflight = await fetch(`${baseUrl}/api/v1/question/recognize`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://site.test', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' }
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://site.test');
    const blocked = await post(baseUrl, '/api/v1/question/recognize', { image: GOOD }, { Origin: 'https://evil.test' });
    assert.equal(blocked.status, 403);
    assert.equal(recognizer.calls.length, 0);
  }, { questionRecognizer: recognizer, allowedOrigins: ['https://site.test'] });
});
