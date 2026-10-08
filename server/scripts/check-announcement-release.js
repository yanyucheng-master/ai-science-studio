// Read-only publication check. Does not run tests, browsers, builds, or AI calls.
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const feedPath = 'web/announcements.json';

function git(args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 4 * 1024 * 1024,
  });
}

function parseOptions() {
  const args = process.argv.slice(2);
  let base;
  let mode;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--base' && !base && args[index + 1] && !args[index + 1].startsWith('--')) {
      base = args[++index];
    } else if ((arg === '--staged' || arg === '--committed') && !mode) {
      mode = arg;
    } else {
      throw new Error(`无法识别或重复的参数：${arg}`);
    }
  }
  if (!base || !mode) {
    throw new Error('用法：node server/scripts/check-announcement-release.js --base <基线引用> --staged|--committed');
  }
  return { base, mode };
}

function validateFeed(raw, label) {
  const feed = JSON.parse(raw);
  const text = (value, limit) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
  if (feed?.version !== 1 || !Array.isArray(feed.announcements) || feed.announcements.length > 100) {
    throw new Error(`${label}：公告文件格式或条数无效`);
  }
  const ids = new Set();
  let previousDate;
  for (const item of feed.announcements) {
    if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || ids.has(item.id)
      || !Number.isSafeInteger(item.revision) || item.revision < 1
      || typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)
      || !Number.isFinite(Date.parse(item.date)) || new Date(item.date).toISOString().slice(0, 10) !== item.date
      || !text(item.title, 100) || !text(item.summary, 300)
      || !Array.isArray(item.details) || item.details.length < 1 || item.details.length > 8
      || !item.details.every(line => text(line, 1000))) {
      throw new Error(`${label}：公告条目无效（${typeof item?.id === 'string' ? item.id : '缺少有效 id'}）`);
    }
    if (previousDate && item.date > previousDate) {
      throw new Error(`${label}：公告应按日期从新到旧排列`);
    }
    ids.add(item.id);
    previousDate = item.date;
  }
  return feed.announcements;
}

function contentOf(item) {
  return JSON.stringify({ date: item.date, title: item.title, summary: item.summary, details: item.details });
}

try {
  const { base, mode } = parseOptions();
  const baseSha = git(['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`]).trim();
  git(['merge-base', '--is-ancestor', baseSha, 'HEAD']);
  const target = mode === '--staged' ? `:${feedPath}` : `HEAD:${feedPath}`;
  const next = validateFeed(git(['show', target]), '待发布版本');
  const previous = validateFeed(git(['show', `${baseSha}:${feedPath}`]), '基线版本');
  const diffArgs = ['diff', '--name-only', '--no-renames', '-z'];
  if (mode === '--staged') diffArgs.push('--cached');
  diffArgs.push(baseSha);
  if (mode === '--committed') diffArgs.push('HEAD');
  diffArgs.push('--');
  const changedPaths = git(diffArgs).split('\0').filter(Boolean);
  const previousById = new Map(previous.map(item => [item.id, item]));
  const nextById = new Map(next.map(item => [item.id, item]));
  const recorded = [];
  for (const item of previous) {
    if (!nextById.has(item.id)) throw new Error(`已有公告 ${item.id} 被删除或更换标识，请保留历史记录`);
  }
  for (const item of next) {
    const old = previousById.get(item.id);
    if (!old) {
      recorded.push(item);
      continue;
    }
    if (item.revision < old.revision) throw new Error(`公告 ${item.id} 的 revision 不得降低`);
    if (contentOf(item) !== contentOf(old)) {
      if (item.revision <= old.revision) throw new Error(`公告 ${item.id} 修改了内容，必须增加 revision`);
      recorded.push(item);
    }
  }
  if (changedPaths.length && !recorded.length) {
    throw new Error(`待发布范围有 ${changedPaths.length} 个文件变化，但没有新增公告或有效内容修订；请先在 ${feedPath} 写明本轮更新`);
  }
  console.log(`公告发布静态核查通过：${changedPaths.length} 个文件变化，${recorded.length} 条新增或修订公告，总计 ${next.length} 条。`);
  for (const item of recorded) console.log(`  ${item.date} · ${item.title} · ${item.id}@${item.revision}`);
  console.log('需人工确认公告覆盖全部已完成改动；此检查不代表功能测试或公网部署通过。');
} catch (error) {
  console.error(`公告发布静态核查失败：${error.message}`);
  process.exitCode = 1;
}
