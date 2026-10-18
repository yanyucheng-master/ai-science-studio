import Scene from '../../web/instant-scene.js';
import { config } from './config.js';

export async function readBoundedJson(response, limit = 96000) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('EMPTY_RESPONSE');
  let size = 0; const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > limit) throw new Error('RESPONSE_TOO_LARGE');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const all = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(all));
}

// Provider boundary: generate(question, {signal}) -> {raw, model, usage}.
// A future supplier must implement this interface; it cannot bypass Scene.validate.
export class DeepSeekSceneProvider {
  constructor(options = {}) {
    this.apiKey = options.apiKey ?? config.deepSeekApiKey;
    this.baseUrl = options.baseUrl ?? config.deepSeekBaseUrl;
    this.model = options.model ?? Scene.DEFAULT_MODEL;
    this.fetch = options.fetch ?? globalThis.fetch;
  }
  get configured() { return typeof this.apiKey === 'string' && this.apiKey.length > 0; }
  async generate(question, { signal }) {
    const response = await this.fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(Scene.requestBody(question, this.model)), signal
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new Error(response.status === 429 ? 'AI_RATE_LIMITED' : response.status === 401 || response.status === 403 ? 'AI_NOT_CONFIGURED' : 'AI_UNAVAILABLE');
    }
    const payload = await readBoundedJson(response);
    const usage = {};
    for (const key of ['prompt_tokens', 'completion_tokens', 'total_tokens', 'prompt_cache_hit_tokens', 'prompt_cache_miss_tokens']) {
      if (Number.isSafeInteger(payload.usage?.[key]) && payload.usage[key] >= 0) usage[key] = payload.usage[key];
    }
    if (payload?.choices?.[0]?.finish_reason !== 'stop') throw Object.assign(new Error('INCOMPLETE_RESPONSE'), { usage, model: this.model });
    const content = payload.choices[0].message?.content;
    if (typeof content !== 'string' || content.length > Scene.LIMITS.bytes) throw Object.assign(new Error('INVALID_RESPONSE'), { usage, model: this.model });
    return { raw: JSON.parse(content), model: this.model, usage };
  }
}

export class InstantSceneService {
  constructor({ provider = new DeepSeekSceneProvider(), timeoutMs = Scene.LIMITS.timeout, maxConcurrent = 2 } = {}) {
    this.provider = provider; this.timeoutMs = timeoutMs; this.maxConcurrent = maxConcurrent;
    this.active = 0; this.cache = new Map();
  }
  async generate(question, { signal } = {}) {
    const started = Date.now();
    const fallback = code => ({ mode: 'explanation', code, reason: '本次未生成可核查的图示，将保留题目并转入 AI 导师。', durationMs: Date.now() - started });
    if (typeof question !== 'string' || !question.trim() || question.length > 2000) return fallback('INVALID_QUESTION');
    if (signal?.aborted) return fallback('ABORTED');
    const cached = this.cache.get(question);
    if (cached && Date.now() - cached.time < 300000) return { ...structuredClone(cached.value), cached: true, durationMs: 0, usage: {} };
    if (!this.provider.configured) return fallback('AI_NOT_CONFIGURED');
    if (this.active >= this.maxConcurrent) return fallback('AI_BUSY');
    this.active++;
    const controller = new AbortController();
    const abort = () => controller.abort('cancelled'); signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort('timeout'), this.timeoutMs);
    try {
      // Race also bounds injected/future providers that fail to honour AbortSignal.
      const result = await Promise.race([
        this.provider.generate(question, { signal: controller.signal }),
        new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error(controller.signal.reason === 'timeout' ? 'AI_TIMEOUT' : 'ABORTED')), { once: true }))
      ]);
      if (controller.signal.aborted) return fallback('ABORTED');
      const checked = Scene.validate(result.raw, question);
      if (!checked.ok) return { ...fallback(checked.code), ...(checked.code === 'DECLINED' ? { reason: checked.reason } : {}), usage: result.usage || {}, model: result.model };
      const value = { mode: 'instant', scene: checked.scene, checks: checked.checks, results: checked.results, source: 'ai-scene', model: result.model, usage: result.usage || {}, durationMs: Date.now() - started };
      if (this.cache.size >= 24) this.cache.delete(this.cache.keys().next().value);
      this.cache.set(question, { value: structuredClone(value), time: Date.now() });
      return value;
    } catch (error) {
      const allowed = ['AI_TIMEOUT', 'ABORTED', 'AI_RATE_LIMITED', 'AI_NOT_CONFIGURED', 'AI_UNAVAILABLE', 'INCOMPLETE_RESPONSE', 'RESPONSE_TOO_LARGE'];
      return { ...fallback(controller.signal.aborted ? (controller.signal.reason === 'timeout' ? 'AI_TIMEOUT' : 'ABORTED') : allowed.includes(error.message) ? error.message : 'INVALID_RESPONSE'), ...(error.usage ? { usage: error.usage, model: error.model } : {}) };
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); this.active--; }
  }
}
