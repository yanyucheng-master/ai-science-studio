import { randomUUID } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { config, DEEPSEEK_OFFICIAL_MODEL } from './config.js';
import { DeepSeekClient } from './deepseek-client.js';
import { localGenerateFallback, localTutorChatFallback, localTutorFallback } from './local-fallback.js';
import {
  sanitizeTutorChatRequest,
  sanitizeQuestionRequest,
  validateExperimentPlan,
  validateModelResponse,
  validateTutorChatResponse,
  validateTutorResponse
} from './protocol.js';

const MAX_BODY_BYTES = 16 * 1024;
const MAX_RATE_LIMIT_KEYS = 10_000;

export class RateLimiter {
  constructor(limit, windowMs) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.entries = new Map();
  }

  allow(key, now = Date.now()) {
    const current = this.entries.get(key);
    if (!current) {
      if (this.entries.size >= MAX_RATE_LIMIT_KEYS) {
        this.cleanup(now);
      }
      if (this.entries.size >= MAX_RATE_LIMIT_KEYS) {
        const oldestKey = this.entries.keys().next().value;
        if (oldestKey !== undefined) {
          this.entries.delete(oldestKey);
        }
      }
      this.entries.set(key, { startedAt: now, count: 1 });
      return true;
    }
    if (now - current.startedAt >= this.windowMs) {
      this.entries.set(key, { startedAt: now, count: 1 });
      return true;
    }
    current.count += 1;
    return current.count <= this.limit;
  }

  cleanup(now = Date.now()) {
    for (const [key, value] of this.entries) {
      if (now - value.startedAt >= this.windowMs) {
        this.entries.delete(key);
      }
    }
  }
}

function clientAddress(request) {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return request.socket.remoteAddress || 'unknown';
}

function applyCors(request, response, allowedOrigins) {
  const origin = request.headers.origin;
  if (!origin) {
    return true;
  }
  if (!allowedOrigins.includes(origin)) {
    return false;
  }
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Vary', 'Origin');
  return true;
}

function sendJson(response, status, payload, requestId) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Request-Id': requestId
  });
  response.end(body);
}

function aiErrorStatus(error) {
  if (error?.code === 'AI_AUTH_FAILED') return { status: 503, error: 'AI_NOT_CONFIGURED' };
  if (error?.code === 'AI_RATE_LIMITED') return { status: 429, error: 'AI_RATE_LIMITED' };
  if (error?.code === 'AI_TIMEOUT') return { status: 504, error: 'AI_TIMEOUT' };
  return { status: 503, error: 'AI_UNAVAILABLE' };
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error('BODY_TOO_LARGE');
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) {
    throw new Error('EMPTY_BODY');
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('INVALID_JSON');
  }
}

export function createMasterLabServer(options = {}) {
  const deepSeek = options.deepSeekClient || new DeepSeekClient();
  const allowedOrigins = options.allowedOrigins || config.allowedOrigins;
  const limiter = options.rateLimiter || new RateLimiter(config.rateLimitMax, config.rateLimitWindowMs);

  return createHttpServer(async (request, response) => {
    const startedAt = Date.now();
    const requestId = randomUUID();
    const method = request.method || 'GET';
    const url = new URL(request.url || '/', 'http://localhost');
    let status = 500;

    try {
      if (!applyCors(request, response, allowedOrigins)) {
        status = 403;
        sendJson(response, status, { error: 'ORIGIN_NOT_ALLOWED' }, requestId);
        return;
      }
      if (method === 'OPTIONS') {
        response.writeHead(204, {
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '600'
        });
        response.end();
        status = 204;
        return;
      }
      if (method === 'GET' && url.pathname === '/health') {
        status = 200;
        sendJson(response, status, {
          ok: true,
          service: 'master-lab-api',
          model: DEEPSEEK_OFFICIAL_MODEL.id,
          modelVersion: DEEPSEEK_OFFICIAL_MODEL.version,
          modelLabel: DEEPSEEK_OFFICIAL_MODEL.label,
          aiConfigured: deepSeek.configured
        }, requestId);
        return;
      }
      if (method !== 'POST') {
        status = 404;
        sendJson(response, status, { error: 'NOT_FOUND' }, requestId);
        return;
      }
      if (!limiter.allow(clientAddress(request))) {
        status = 429;
        sendJson(response, status, { error: 'RATE_LIMITED' }, requestId);
        return;
      }

      if (url.pathname === '/api/v1/experiment/generate') {
        const body = await readJsonBody(request);
        const input = sanitizeQuestionRequest(body);
        if (!input) {
          status = 400;
          sendJson(response, status, { error: 'INVALID_QUESTION' }, requestId);
          return;
        }
        if (deepSeek.configured) {
          try {
            const raw = await deepSeek.generate(input.question, input.preferredSubject);
            const validated = validateModelResponse(raw);
            if (validated) {
              status = 200;
              sendJson(response, status, { ...validated, source: 'deepseek', requestId }, requestId);
              return;
            }
          } catch {
            // Fall through to deterministic local matching. Request bodies and model errors are not logged.
          }
        }
        const fallback = localGenerateFallback(input.question);
        status = 200;
        sendJson(response, status, { ...fallback, source: 'local_fallback', requestId }, requestId);
        return;
      }

      if (url.pathname === '/api/v1/tutor/suggest') {
        const body = await readJsonBody(request);
        const plan = validateExperimentPlan(body?.plan);
        const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 1200) : '';
        if (!plan || message.length === 0) {
          status = 400;
          sendJson(response, status, { error: 'INVALID_TUTOR_REQUEST' }, requestId);
          return;
        }
        if (deepSeek.configured) {
          try {
            const raw = await deepSeek.tutor(plan, message);
            const validated = validateTutorResponse(raw, plan);
            if (validated) {
              status = 200;
              sendJson(response, status, { ...validated, source: 'deepseek', requestId }, requestId);
              return;
            }
          } catch {
            // Use local teaching guidance after the single automatic retry fails.
          }
        }
        const fallback = localTutorFallback(plan);
        status = 200;
        sendJson(response, status, { ...fallback, source: 'local_fallback', requestId }, requestId);
        return;
      }

      if (url.pathname === '/api/v1/tutor/chat') {
        const body = await readJsonBody(request);
        const input = sanitizeTutorChatRequest(body);
        if (!input) {
          status = 400;
          sendJson(response, status, { error: 'INVALID_TUTOR_CHAT_REQUEST' }, requestId);
          return;
        }
        if (!deepSeek.configured) {
          const fallback = localTutorChatFallback(input);
          if (fallback) {
            status = 200;
            sendJson(response, status, { ...fallback, source: 'local_fallback', requestId }, requestId);
            return;
          }
          status = 503;
          sendJson(response, status, { error: 'AI_NOT_CONFIGURED' }, requestId);
          return;
        }
        try {
          const raw = await deepSeek.chat(input);
          const validated = validateTutorChatResponse(raw, input);
          if (!validated) {
            status = 502;
            sendJson(response, status, { error: 'INVALID_AI_RESPONSE' }, requestId);
            return;
          }
          status = 200;
          sendJson(response, status, { ...validated, source: 'deepseek', requestId }, requestId);
          return;
        } catch (error) {
          const fallback = localTutorChatFallback(input);
          if (fallback) {
            status = 200;
            sendJson(response, status, { ...fallback, source: 'local_fallback', requestId }, requestId);
            return;
          }
          const mapped = aiErrorStatus(error);
          status = mapped.status;
          sendJson(response, status, { error: mapped.error }, requestId);
          return;
        }
      }

      status = 404;
      sendJson(response, status, { error: 'NOT_FOUND' }, requestId);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'INTERNAL_ERROR';
      status = code === 'BODY_TOO_LARGE' ? 413 : code === 'INVALID_JSON' || code === 'EMPTY_BODY' ? 400 : 500;
      sendJson(response, status, { error: status === 500 ? 'INTERNAL_ERROR' : code }, requestId);
    } finally {
      console.info(JSON.stringify({ requestId, method, path: url.pathname, status, durationMs: Date.now() - startedAt }));
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createMasterLabServer();
  server.listen(config.port, '0.0.0.0', () => {
    console.info(JSON.stringify({
      event: 'server_started',
      port: config.port,
      model: DEEPSEEK_OFFICIAL_MODEL.id,
      modelVersion: DEEPSEEK_OFFICIAL_MODEL.version
    }));
  });
}
