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

export const config = Object.freeze({
  port: integerFromEnv('PORT', 10000, 1, 65535),
  deepSeekApiKey: process.env.DEEPSEEK_API_KEY || '',
  deepSeekModel: 'deepseek-v4-pro',
  deepSeekBaseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, ''),
  requestTimeoutMs: integerFromEnv('REQUEST_TIMEOUT_MS', 20000, 2000, 20000),
  thinkingTimeoutMs: integerFromEnv('THINKING_TIMEOUT_MS', 75000, 10000, 120000),
  rateLimitMax: integerFromEnv('RATE_LIMIT_MAX', 30, 1, 500),
  rateLimitWindowMs: integerFromEnv('RATE_LIMIT_WINDOW_MS', 600000, 60000, 3600000),
  allowedOrigins: listFromEnv('ALLOWED_ORIGINS')
});
