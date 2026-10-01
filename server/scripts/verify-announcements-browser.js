// Local-only announcement lifecycle QA. Uses isolated browser storage and blocks external requests.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = resolve(root, 'artifacts/announcement-qa');
await mkdir(output, { recursive: true });
const originalFeed = JSON.parse(await readFile(resolve(root, 'web/announcements.json'), 'utf8'));
let feed = structuredClone(originalFeed);
let mode = 'valid';
let feedRequests = 0;
const files = new Set(['index.html', 'styles.css', 'app.js', 'physics-extra.js', 'science-motion.js', 'ai-tutor.js', 'announcements.js']);
const mime = { html: 'text/html', css: 'text/css', js: 'text/javascript' };
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/announcements.json') {
    feedRequests += 1;
    res.writeHead(mode === 'unavailable' ? 503 : 200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    if (mode === 'stalled') { res.flushHeaders(); return; }
    res.end(mode === 'invalid' ? '{broken' : JSON.stringify(feed));
    return;
  }
  const name = path === '/' ? 'index.html' : path.slice(1);
  if (!files.has(name)) { res.writeHead(204); res.end(); return; }
  const body = await readFile(resolve(root, 'web', name));
  res.writeHead(200, { 'Content-Type': `${mime[name.split('.').at(-1)]}; charset=utf-8`, 'Cache-Control': 'no-store' });
  res.end(body);
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const reports = [];
const errors = [];
const contexts = [];
const readKey = 'masterLab.announcementReads.v1';

async function newContext(viewport = { width: 1280, height: 800 }, blockStorage = false) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  context.setDefaultTimeout(10000);
  context.setDefaultNavigationTimeout(15000);
  contexts.push(context);
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1'
    ? route.continue() : route.fulfill({ status: 204, body: '' }));
  await context.addInitScript(({ readKey, blockStorage }) => {
    if (location.hostname !== '127.0.0.1') return;
    localStorage.setItem('announcement.qa.keep', 'untouched');
    if (!blockStorage) return;
    for (const method of ['getItem', 'setItem']) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function (name, ...args) {
        if (name === readKey) throw new DOMException('Storage blocked', 'SecurityError');
        return original.call(this, name, ...args);
      };
    }
  }, { readKey, blockStorage });
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  return context;
}

async function ready(page) {
  await page.waitForFunction(() => !document.querySelector('#announcementsRefresh').disabled
    && !document.querySelector('#announcementsCount').textContent.includes('正在'));
}
async function countIs(page, value) {
  await page.waitForFunction(value => document.querySelector('#announcementsCount').textContent === value, value);
}
async function open(page) {
  await page.locator('#announcementsButton').click();
  await ready(page);
  assert.equal(await page.locator('#announcementsDialog').evaluate(node => node.open), true);
}
async function refresh(page) {
  await page.locator('#announcementsRefresh').click();
  await ready(page);
}
function pass(name) { reports.push({ name, passed: true }); console.log(`PASS ${name}`); }

try {
  const context = await newContext();
  const page = await context.newPage();
  await page.clock.install();
  await page.goto(base);
  await ready(page);
  const total = originalFeed.announcements.length;
  assert.equal(await page.locator('.streak').count(), 0);
  assert.equal(await page.locator('.topbar').innerText().then(text => /连续探索|本周完成/.test(text)), false);
  assert.equal(await page.locator('#announcementsDot').isVisible(), true);
  await countIs(page, `${total} 条公告 · ${total} 条未读`);
  assert.equal(await page.locator('#announcementsButton').getAttribute('data-toast'), null);
  pass('header removes fake statistics; unread reflects the actual feed');

  await page.locator('#announcementsButton').press('Space');
  await ready(page);
  assert.equal(await page.locator('#announcementsDialog').evaluate(node => node.open), true);
  assert.equal(await page.locator('body').evaluate(node => node.classList.contains('awaiting-generation')), true);
  for (let index = 0; index < 9; index += 1) {
    await page.keyboard.press('Tab');
    const active = await page.evaluate(() => ({ inside: Boolean(document.activeElement.closest('#announcementsDialog')), tag: document.activeElement.tagName, id: document.activeElement.id }));
    assert.ok(active.inside, `Tab ${index + 1} left the dialog: ${JSON.stringify(active)}`);
  }
  await page.locator('.announcement-item summary').first().press('Enter');
  await countIs(page, `${total} 条公告 · ${total - 1} 条未读`);
  assert.equal(await page.evaluate(readKey => JSON.parse(localStorage.getItem(readKey)).length, readKey), 1);
  await page.locator('#announcementsReadAll').click();
  await countIs(page, `${total} 条公告 · 全部已读`);
  assert.equal(await page.locator('#announcementsDot').isVisible(), false);
  await page.screenshot({ path: resolve(output, 'desktop-announcements.png') });
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#announcementsDialog').evaluate(node => node.open), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'announcementsButton');
  await page.screenshot({ path: resolve(output, 'desktop-home.png') });
  await page.reload();
  await ready(page);
  await countIs(page, `${total} 条公告 · 全部已读`);
  assert.equal(await page.evaluate(() => localStorage.getItem('announcement.qa.keep')), 'untouched');
  pass('keyboard activation, focus trapping, single/all read and persistence');

  feed.announcements.unshift({ id: 'qa-new', revision: 1, date: '2026-10-02', title: '本地测试：新增公告', summary: '仅用于检查新公告提示。', details: ['该内容不写入真实公告文件。'] });
  const beforePoll = feedRequests;
  await page.clock.fastForward(5 * 60 * 1000 + 1);
  await countIs(page, `${total + 1} 条公告 · 1 条未读`);
  assert.ok(feedRequests > beforePoll);
  assert.equal(await page.locator('#announcementsDot').isVisible(), true);
  await page.clock.resume();
  const otherPage = await context.newPage();
  await otherPage.goto(base);
  await ready(otherPage);
  await open(otherPage);
  await otherPage.locator('.announcement-item summary').first().click();
  await countIs(page, `${total + 1} 条公告 · 全部已读`);
  feed.announcements[0].revision = 2;
  await refresh(otherPage);
  await countIs(otherPage, `${total + 1} 条公告 · 1 条未读`);
  pass('periodic update detection, cross-tab read sync and revised announcements');

  mode = 'invalid';
  await refresh(otherPage);
  assert.equal(await otherPage.locator('#announcementsStatus').isVisible(), true);
  assert.match(await otherPage.locator('#announcementsStatus').innerText(), /上次加载/);
  assert.equal(await otherPage.locator('.announcement-item').count(), total + 1);
  mode = 'unavailable';
  await refresh(otherPage);
  assert.match(await otherPage.locator('#announcementsStatus').innerText(), /上次加载/);
  mode = 'valid';
  await refresh(otherPage);
  assert.equal(await otherPage.locator('#announcementsStatus').isVisible(), false);
  await otherPage.clock.install();
  mode = 'stalled';
  const beforeStall = feedRequests;
  await otherPage.locator('#announcementsRefresh').click();
  await otherPage.waitForFunction(() => document.querySelector('#announcementsRefresh').disabled);
  while (feedRequests === beforeStall) await new Promise(resolve => setTimeout(resolve, 10));
  await otherPage.clock.fastForward(8001);
  await ready(otherPage);
  assert.match(await otherPage.locator('#announcementsStatus').innerText(), /上次加载/);
  await otherPage.clock.resume();
  mode = 'valid';
  await refresh(otherPage);
  pass('invalid JSON, HTTP failure, stalled body timeout and retry preserve content');

  mode = 'invalid';
  const failedContext = await newContext();
  const failedPage = await failedContext.newPage();
  await failedPage.goto(base);
  await ready(failedPage);
  await open(failedPage);
  assert.match(await failedPage.locator('#announcementsStatus').innerText(), /公告加载失败/);
  assert.equal(await failedPage.locator('#announcementsEmpty').isVisible(), false);
  assert.equal(await failedPage.locator('#announcementsDot').isVisible(), false);
  mode = 'valid';
  await refresh(failedPage);
  assert.equal(await failedPage.locator('.announcement-item').count(), total + 1);
  feed = { version: 1, announcements: [] };
  await refresh(failedPage);
  assert.equal(await failedPage.locator('#announcementsEmpty').isVisible(), true);
  assert.equal(await failedPage.locator('#announcementsReadAll').isDisabled(), true);
  pass('initial load error is distinct from empty feed; empty feed is readable');

  feed = structuredClone(originalFeed);
  const corruptContext = await newContext();
  await corruptContext.addInitScript(readKey => {
    if (location.hostname === '127.0.0.1') localStorage.setItem(readKey, '{broken');
  }, readKey);
  const corruptPage = await corruptContext.newPage();
  await corruptPage.goto(base);
  await ready(corruptPage);
  await open(corruptPage);
  await corruptPage.locator('.announcement-item summary').first().click();
  await countIs(corruptPage, `${total} 条公告 · ${total - 1} 条未读`);
  assert.equal(await corruptPage.evaluate(readKey => JSON.parse(localStorage.getItem(readKey)).length, readKey), 1);
  assert.equal(await corruptPage.locator('#announcementsStorageNote').isVisible(), false);
  const blockedContext = await newContext(undefined, true);
  const blockedPage = await blockedContext.newPage();
  await blockedPage.goto(base);
  await ready(blockedPage);
  await open(blockedPage);
  await blockedPage.locator('.announcement-item summary').first().click();
  await countIs(blockedPage, `${total} 条公告 · ${total - 1} 条未读`);
  assert.equal(await blockedPage.locator('#announcementsStorageNote').isVisible(), true);
  feed.announcements[0].title = '<img src=x onerror="window.qaInjected=true">';
  await refresh(blockedPage);
  assert.equal(await blockedPage.locator('#announcementsList img').count(), 0);
  assert.equal(await blockedPage.evaluate(() => window.qaInjected), undefined);
  assert.match(await blockedPage.locator('.announcement-item h3').first().innerText(), /<img/);
  pass('corrupt/blocked storage recovers or degrades; announcement strings stay plain text');

  feed = structuredClone(originalFeed);
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
    const mobileContext = await newContext(viewport);
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(base);
    await ready(mobilePage);
    await open(mobilePage);
    await mobilePage.locator('.announcement-item summary').first().click();
    const layout = await mobilePage.locator('#announcementsDialog').evaluate(node => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, overflowX: node.scrollWidth > node.clientWidth };
    });
    assert.ok(layout.left >= 0 && layout.right <= viewport.width && layout.top >= 0 && layout.bottom <= viewport.height);
    assert.equal(layout.overflowX, false);
    assert.equal(await mobilePage.locator('#announcementsReadAll').isVisible(), true);
    await mobilePage.screenshot({ path: resolve(output, `mobile-${viewport.width}-announcements.png`) });
    const scrollable = await mobilePage.locator('#announcementsList').evaluate(node => node.scrollHeight > node.clientHeight);
    if (scrollable) {
      await mobilePage.locator('.announcement-item summary').last().scrollIntoViewIfNeeded();
      assert.ok(await mobilePage.locator('#announcementsList').evaluate(node => node.scrollTop > 0));
    }
    const footer = await mobilePage.locator('.announcements-footer').boundingBox();
    assert.ok(footer.y >= layout.top && footer.y + footer.height <= layout.bottom);
    await mobilePage.mouse.click(2, 2);
    assert.equal(await mobilePage.locator('#announcementsDialog').evaluate(node => node.open), false);
  }
  pass('390px and 320px mobile layouts fit, scroll, and close through backdrop');
  assert.deepEqual(errors, []);
  pass('no uncaught browser errors');
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ passed: reports.length, cases: reports, browserErrors: errors }, null, 2));
  await Promise.all(contexts.map(context => context.close()));
  await browser.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
