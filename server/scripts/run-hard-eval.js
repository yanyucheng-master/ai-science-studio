import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DeepSeekClient } from '../src/deepseek-client.js';
import { sanitizeTutorChatRequest, validateTutorChatResponse } from '../src/protocol.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const questionsPath = path.resolve(directory, '../eval/hard-questions.json');
const apiBaseUrl = (process.env.MASTER_LAB_API_URL || 'http://127.0.0.1:10000').replace(/\/$/, '');
const delayMs = Number.parseInt(process.env.EVAL_DELAY_MS || '1200', 10);
const directMode = process.env.EVAL_DIRECT === '1';
const selectedIds = new Set((process.env.EVAL_FILTER || '').split(',').map((item) => item.trim()).filter(Boolean));
const allQuestions = JSON.parse(await readFile(questionsPath, 'utf8'));
const questions = selectedIds.size > 0 ? allQuestions.filter((item) => selectedIds.has(item.id)) : allQuestions;
const directClient = directMode ? new DeepSeekClient() : null;

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (digit) => '0123456789'['⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(digit)])
    .replace(/[\s，。；：、,.。;:（）()]/g, '')
    .replace(/≈/g, '=')
    .replace(/ω/g, 'Ω');
}

function responseText(payload) {
  return [
    payload.summary,
    ...(payload.steps || []),
    ...(payload.formulas || []),
    payload.finalAnswer,
    ...(payload.checks || []),
    ...(payload.warnings || [])
  ].filter(Boolean).join('\n');
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1);
  return sorted[index];
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const results = [];
for (const [index, item] of questions.entries()) {
  const requestBody = {
    sessionId: `hard-eval-${item.id}`,
    message: '我完全没学懂。请给出完整、可核查的分步解答，逐项回答所有小问，并检查公式适用条件、单位、边界和最终结果。',
    responseLevel: 'steps',
    history: [],
    context: {
      mode: 'question',
      subject: item.subject,
      originalQuestion: item.question,
      templateId: '',
      parameters: {},
      deterministicResult: {}
    }
  };
  const startedAt = performance.now();
  let response;
  let payload = {};
  let transportError = null;
  try {
    if (directMode) {
      const input = sanitizeTutorChatRequest(requestBody);
      const raw = input ? await directClient.chat(input) : null;
      const validated = input && raw ? validateTutorChatResponse(raw, input) : null;
      response = { ok: Boolean(validated), status: validated ? 200 : 502 };
      payload = validated
        ? { ...validated, source: 'deepseek_direct', model: 'deepseek-v4-pro' }
        : { error: 'INVALID_AI_RESPONSE', rawModelResponse: raw };
    } else {
      response = await fetch(`${apiBaseUrl}/api/v1/tutor/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      try {
        payload = await response.json();
      } catch {
        payload = { error: 'INVALID_JSON' };
      }
    }
  } catch (error) {
    transportError = error instanceof Error ? error.message : String(error);
    payload = { error: error?.code || 'DIRECT_REQUEST_FAILED' };
    response = { ok: false, status: 503 };
  }
  const elapsedMs = Math.round(performance.now() - startedAt);
  const output = responseText(payload);
  const normalizedOutput = normalize(output);
  const missingGroups = item.mustIncludeAny.filter((alternatives) =>
    !alternatives.some((checkpoint) => normalizedOutput.includes(normalize(checkpoint)))
  );
  const responseOk = Boolean(response?.ok);
  const checkpointPassed = responseOk && missingGroups.length === 0;
  const completenessWarnings = (payload.warnings || []).filter((warning) =>
    String(warning).includes('完整性提醒')
  );
  results.push({
    id: item.id,
    subject: item.subject,
    question: item.question,
    reference: item.reference,
    responseOk,
    checkpointPassed,
    status: response?.status || 0,
    elapsedMs,
    source: payload.source || null,
    model: payload.model || null,
    mode: payload.mode || null,
    apiError: payload.error || null,
    rawModelResponse: payload.rawModelResponse || null,
    missingGroups,
    completenessWarnings,
    transportError,
    output,
    requestId: payload.requestId || null
  });
  console.log(`${String(index + 1).padStart(2, '0')}/${questions.length} ${checkpointPassed ? 'CHECKPOINT-PASS' : 'REVIEW'} ${item.id} ${elapsedMs}ms`);
  if (delayMs > 0 && index < questions.length - 1) await wait(delayMs);
}

const latencies = results.filter((item) => item.responseOk).map((item) => item.elapsedMs).sort((a, b) => a - b);
const checkpointPassed = results.filter((item) => item.checkpointPassed).length;
const report = {
  generatedAt: new Date().toISOString(),
  apiBaseUrl,
  model: 'deepseek-v4-pro',
  evaluationType: directMode ? 'hard-question-pre-demo-review-direct' : 'hard-question-pre-demo-review-api',
  automatedCheckpointPassed: checkpointPassed,
  total: results.length,
  checkpointRate: results.length ? checkpointPassed / results.length : 0,
  manualReviewRequired: true,
  latencyMs: {
    minimum: latencies[0] ?? null,
    median: percentile(latencies, 0.5),
    p95: percentile(latencies, 0.95),
    maximum: latencies.at(-1) ?? null,
    average: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null
  },
  results
};

const stamp = report.generatedAt.replace(/[:.]/g, '-');
const outputPath = path.resolve(directory, `../eval-results-hard-${stamp}.json`);
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Checkpoints: ${checkpointPassed}/${results.length} (${(report.checkpointRate * 100).toFixed(1)}%)`);
console.log(`Latency ms: median=${report.latencyMs.median}, p95=${report.latencyMs.p95}, max=${report.latencyMs.maximum}`);
console.log(`Report: ${outputPath}`);
if (checkpointPassed !== results.length) process.exitCode = 1;
