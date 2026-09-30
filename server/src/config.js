function integerFromEnv(name, fallback, minimum, maximum) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(maximum, Math.max(minimum, parsed));
}

function listFromEnv(name) {
  return (process.env[name] || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const DEEPSEEK_OFFICIAL_MODEL = Object.freeze({
  id: 'deepseek-flash',
  version: 'DeepSeek-V4.1-Flash',
  label: 'DeepSeek V4.1 Flash',
  reasoningEffort: 'max'
});

export const config = Object.freeze({
  port: integerFromEnv('PORT', 10000, 1, 65535),
  deepSeekApiKey: process.env.DEEPSEEK_API_KEY || '',
  deepSeekModel: DEEPSEEK_OFFICIAL_MODEL.id,
  deepSeekBaseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, ''),
  requestTimeoutMs: integerFromEnv('REQUEST_TIMEOUT_MS', 240000, 2000, 240000),
  thinkingTimeoutMs: integerFromEnv('THINKING_TIMEOUT_MS', 240000, 10000, 240000),
  deepSeekMaxTokens: integerFromEnv('DEEPSEEK_MAX_TOKENS', 32768, 4096, 131072),
  maxConcurrentAiRequests: integerFromEnv('MAX_CONCURRENT_AI_REQUESTS', 2, 1, 4),
  // 0 disables address-based quotas; upstream concurrency remains bounded.
  rateLimitMax: integerFromEnv('RATE_LIMIT_MAX', 0, 0, 500),
  rateLimitWindowMs: integerFromEnv('RATE_LIMIT_WINDOW_MS', 600000, 60000, 3600000),
  allowedOrigins: listFromEnv('ALLOWED_ORIGINS')
});
