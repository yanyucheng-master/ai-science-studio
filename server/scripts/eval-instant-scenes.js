// Explicit live evaluation. Requires --live; never stores keys or request headers.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DeepSeekSceneProvider, InstantSceneService } from '../src/instant-scene-service.js';
if (!process.argv.includes('--live')) throw new Error('Use --live to authorize actual model calls.');
const bank = JSON.parse(await readFile(new URL('../eval/instant-scene-bank.json', import.meta.url), 'utf8'));
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const idsArg = process.argv.find(a => a.startsWith('--ids='));
const selected = (idsArg ? bank.filter(q => idsArg.slice(6).split(',').includes(q.id)) : bank).slice(0, limitArg ? Number(limitArg.slice(8)) : bank.length);
const out = resolve(process.env.INSTANT_QA_OUTPUT || '../artifacts/instant-engine-2026-10-18/live');
await mkdir(out, { recursive: true });
const results = []; let next = 0;
async function worker() {
  const actual = new DeepSeekSceneProvider();
  if (!actual.configured) throw new Error('No configured existing DeepSeek credential.');
  while (next < selected.length) {
    const item = selected[next++]; let upstream = null;
    const provider = { configured: true, async generate(...args) { upstream = await actual.generate(...args); return upstream; } };
    const service = new InstantSceneService({ provider });
    const result = await service.generate(item.q);
    const report = { ...item, result, raw: upstream?.raw ?? null, scientificReview: 'pending-independent-review', layoutReview: 'pending-browser-review' };
    await writeFile(resolve(out, `${item.id}.json`), JSON.stringify(report, null, 2)); results.push(report);
    console.log(JSON.stringify({ id: item.id, mode: result.mode, code: result.code, ms: result.durationMs, tokens: result.usage?.total_tokens }));
  }
}
await Promise.all([worker(), worker()]);
await writeFile(resolve(out, 'run-summary.json'), JSON.stringify({ date: new Date().toISOString(), completed: results.length, results: results.map(({ raw, ...rest }) => rest) }, null, 2));
