import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const directory = path.dirname(fileURLToPath(import.meta.url));
const questionsPath = path.resolve(directory, '../eval/questions.json');
const apiBaseUrl = (process.env.MASTER_LAB_API_URL || 'http://127.0.0.1:10000').replace(/\/$/, '');
const delayMs = Number.parseInt(process.env.EVAL_DELAY_MS || '500', 10);
const questions = JSON.parse(await readFile(questionsPath, 'utf8'));

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2')
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (digit) => '₀₁₂₃₄₅₆₇₈₉'.indexOf(digit))
    .replace(/[\s，。；：、,.;:∶（）()]/g, '')
    .replace(/²/g, '2')
    .replace(/₁/g, '1')
    .replace(/₂/g, '2');
}

function responseText(payload) {
  return [
    payload.summary,
    ...(payload.steps || []),
    ...(payload.formulas || []),
    payload.finalAnswer,
    ...(payload.checks || [])
  ].filter(Boolean).join('\n');
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const results = [];
for (const [index, item] of questions.entries()) {
  const response = await fetch(`${apiBaseUrl}/api/v1/tutor/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: `eval-${item.id}`,
      message: '请给出完整、可核查的分步解答，并检查单位和结论。',
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
    })
  });
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = { error: 'INVALID_JSON' };
  }
  const output = responseText(payload);
  const normalizedOutput = normalize(output);
  const missing = item.mustInclude.filter((checkpoint) => !normalizedOutput.includes(normalize(checkpoint)));
  const passed = response.ok && missing.length === 0;
  results.push({
    id: item.id,
    subject: item.subject,
    question: item.question,
    passed,
    status: response.status,
    missing,
    output,
    requestId: payload.requestId || null
  });
  console.log(`${String(index + 1).padStart(2, '0')}/${questions.length} ${passed ? 'PASS' : 'FAIL'} ${item.id}`);
  if (delayMs > 0 && index < questions.length - 1) await wait(delayMs);
}

const passedCount = results.filter((item) => item.passed).length;
const accuracy = results.length ? passedCount / results.length : 0;
const report = {
  generatedAt: new Date().toISOString(),
  apiBaseUrl,
  model: 'deepseek-v4-pro',
  passed: passedCount,
  total: results.length,
  accuracy,
  manualReviewRequired: true,
  results
};
const stamp = report.generatedAt.replace(/[:.]/g, '-');
const outputPath = path.resolve(directory, `../eval-results-${stamp}.json`);
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Result: ${passedCount}/${results.length} (${(accuracy * 100).toFixed(1)}%)`);
console.log(`Report: ${outputPath}`);
if (accuracy < 0.95) process.exitCode = 1;
