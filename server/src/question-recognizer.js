// 照片识题：把学生拍下的理科题目照片转写成文字。
// 只做转写，不解题；结果由前端填入输入框，学生核对后才会生成实验。
// 本文件只依赖 ./config.js，便于原样移植到其他网关分支。
import { config } from './config.js';

export const MAX_RECOGNIZE_BODY_BYTES = 3 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_QUESTION_CHARS = 1500;

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

export const RECOGNIZE_SYSTEM_PROMPT = `你是“大师实验室”的题目转写助手。任务：把照片里的理科题目（数学、物理、化学、生物）原样转写成文字，供学生核对后再使用。
规则：
1. 只转写，不解题、不补充条件、不改动数据、不翻译；保留所有小问、已知数据和单位。
2. 公式用普通文字与 Unicode 符号书写（如 v₀、m/s²、H₂SO₄、√、×、÷、≤、≥），不要使用 LaTeX 或 Markdown。
3. 看不清或无法确定的字符、数字、符号一律写成 [?]，绝不猜测。
4. 图片中的示意图、表格只转写其中的文字；表格写成“列名：数值”的文字。题目需要看图才能完成时，在末尾另起一行写“（原题含图，请在输入框补充图中条件）”。
5. 照片里不是理科题目（人像、风景、空白页等）时，isQuestion 为 false，text 为空字符串。
6. 照片里有多道题时，只转写最靠近画面中央的一道完整题，并把 multiple 设为 true。
7. 只输出一个 JSON 对象，不要输出任何其他内容：{"isQuestion":true,"text":"题目原文","unclear":false,"multiple":false}`;

export function sniffImageMime(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes.subarray(1, 4).toString('latin1') === 'PNG'
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('latin1') === 'RIFF'
    && bytes.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return '';
}

// 返回 { dataUrl, mime, bytes } 或 null。只接受 JPEG / PNG / WebP，且文件头必须与声明一致。
export function sanitizeRecognizeRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.image !== 'string') return null;
  const match = DATA_URL.exec(body.image);
  if (!match) return null;
  const decoded = Buffer.from(match[2], 'base64');
  if (decoded.length < 64 || decoded.length > MAX_IMAGE_BYTES) return null;
  if (sniffImageMime(decoded) !== match[1]) return null;
  return { dataUrl: body.image, mime: match[1], bytes: decoded.length };
}

function extractJsonObject(content) {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function cleanText(value) {
  return String(value)
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// 把模型返回的内容规整成 { isQuestion, text, unclear, multiple }；无法解析返回 null。
export function parseRecognizeResponse(content) {
  if (typeof content !== 'string' || content.trim().length === 0) return null;
  const parsed = extractJsonObject(content);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
    || typeof parsed.isQuestion !== 'boolean' || typeof parsed.text !== 'string'
    || (parsed.unclear !== undefined && typeof parsed.unclear !== 'boolean')
    || (parsed.multiple !== undefined && typeof parsed.multiple !== 'boolean')) return null;
  if (!parsed.isQuestion) return { isQuestion: false, text: '', unclear: false, multiple: false };
  // The client inserts this into a textarea, never HTML. Preserve comparison
  // signs: stripping "tags" would corrupt conditions such as "x < 2，y > 3".
  let text = cleanText(parsed.text);
  if (!text) return null;
  const unclear = parsed.unclear === true;
  const multiple = parsed.multiple === true;
  let truncated = false;
  if (text.length > MAX_QUESTION_CHARS) {
    text = text.slice(0, MAX_QUESTION_CHARS);
    truncated = true;
  }
  return { isQuestion: true, text, unclear: unclear || text.includes('[?]'), multiple, ...(truncated ? { truncated } : {}) };
}

export class QuestionRecognizer {
  constructor(options = {}) {
    this.apiKey = options.apiKey ?? config.deepSeekApiKey;
    this.baseUrl = String(options.baseUrl ?? config.deepSeekBaseUrl).replace(/\/$/, '');
    this.model = options.model ?? config.deepSeekModel;
    this.timeoutMs = options.timeoutMs ?? config.recognizeTimeoutMs;
    this.maxConcurrentRequests = options.maxConcurrentRequests ?? config.recognizeMaxConcurrentRequests;
    this.activeRequests = 0;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  get configured() {
    return typeof this.apiKey === 'string' && this.apiKey.length > 0;
  }

  async recognize(input, options = {}) {
    if (!this.configured) {
      const error = new Error('DeepSeek API key is not configured');
      error.code = 'AI_AUTH_FAILED';
      throw error;
    }
    if (this.activeRequests >= this.maxConcurrentRequests) {
      const error = new Error('Recognition concurrency limit reached');
      error.code = 'AI_BUSY';
      throw error;
    }
    this.activeRequests += 1;
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (options.signal) {
      if (options.signal.aborted) controller.abort();
      else options.signal.addEventListener('abort', abort, { once: true });
    }
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      let response;
      try {
        response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: 'system', content: RECOGNIZE_SYSTEM_PROMPT },
              {
                role: 'user',
                content: [
                  { type: 'text', text: '请转写这张照片里的题目。' },
                  { type: 'image_url', image_url: { url: input.dataUrl } }
                ]
              }
            ],
            thinking: { type: 'disabled' },
            response_format: { type: 'json_object' },
            temperature: 0,
            max_tokens: 1800
          }),
          signal: controller.signal
        });
      } catch (cause) {
        if (controller.signal.aborted || cause?.name === 'AbortError') {
          const error = new Error(`Recognition timed out after ${this.timeoutMs}ms`);
          error.code = options.signal?.aborted ? 'AI_ABORTED' : 'AI_TIMEOUT';
          throw error;
        }
        const error = new Error('Recognition upstream unreachable');
        error.code = 'AI_UPSTREAM_ERROR';
        throw error;
      }
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        const error = new Error(`DeepSeek HTTP ${response.status}`);
        error.code = response.status === 401 || response.status === 403 ? 'AI_AUTH_FAILED'
          : response.status === 429 ? 'AI_RATE_LIMITED' : 'AI_UPSTREAM_ERROR';
        throw error;
      }
      let payload;
      try {
        payload = await response.json();
      } catch (cause) {
        const error = new Error('DeepSeek returned invalid response JSON');
        error.code = controller.signal.aborted ? 'AI_TIMEOUT' : 'INVALID_AI_RESPONSE';
        throw error;
      }
      const parsed = parseRecognizeResponse(payload?.choices?.[0]?.message?.content);
      if (!parsed || (payload?.choices?.[0]?.finish_reason && payload.choices[0].finish_reason !== 'stop')) {
        const error = new Error('Recognition response could not be parsed');
        error.code = 'INVALID_AI_RESPONSE';
        throw error;
      }
      return { ...parsed, model: this.model };
    } finally {
      this.activeRequests -= 1;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
    }
  }
}
