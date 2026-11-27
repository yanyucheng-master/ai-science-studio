import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { cleanupShares, createShareServer, initializeShares } from "./src/server.js";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
const site = new URL(process.env.SHORT_SHARE_TEST_SITE || "http://127.0.0.1:8765");
assert.equal(site.hostname, "127.0.0.1", "Use isolated local loopback services.");
const database = new PGlite();
const pool = {
  async query(sql, params = []) {
    if (!params.length && sql.startsWith("CREATE TABLE")) return database.exec(sql);
    const result = await database.query(sql, params);
    return { ...result, rowCount: result.affectedRows ?? result.rows.length };
  }
};
await initializeShares(pool);
await pool.query(
  "INSERT INTO experiment_shares (code, payload, expires_at) VALUES ($1, $2, CURRENT_TIMESTAMP - INTERVAL '1 second')",
  ["expired000", "{}"]
);
const backend = createShareServer({ pool, siteOrigin: site.origin });
backend.listen(0, "127.0.0.1");
await once(backend, "listening");
const api = new URL("http://127.0.0.1:" + backend.address().port);

const web = fileURLToPath(new URL("../web", import.meta.url));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2" };
const frontend = createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, site);
    if (pathname.startsWith("/s/")) {
      const next = new URL("/", site);
      next.searchParams.set("s", pathname.slice(3));
      res.writeHead(301, { Location: next.pathname + next.search });
      res.end();
      return;
    }
    if (pathname === "/short-share-config.js") {
      res.writeHead(200, { "Content-Type": types[".js"] });
      res.end("window.MASTER_LAB_SHORT_SHARE_API = " + JSON.stringify(api.origin));
      return;
    }
    const file = resolve(web, decodeURIComponent(pathname).slice(1) || "index.html");
    if (!file.startsWith(web + sep)) {
      res.writeHead(400).end();
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
frontend.listen(Number(site.port), site.hostname);
await once(frontend, "listening");

const question = "汽车以20m/s的初速度行驶，刹车加速度大小为5m/s²，求停止距离。";
const legacy = { v: 1, subject: "物理", question, grade: "senior", template: "brake", params: [20, 5],
  mode: { braking: "constant" } };
const errors = [];
const aiRequests = [];
let browser;

async function browserContext(width, allowApi = true) {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width, height: 850 },
    isMobile: width < 500, hasTouch: width < 500 });
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin === api.origin && !allowApi) return route.abort();
    if (/\/api\/v1\/|\/chat\/completions/.test(url.pathname)) aiRequests.push(url.pathname);
    if (url.origin === site.origin || url.origin === api.origin) return route.continue();
    return route.fulfill({ status: 204, body: "" });
  });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  return { context, page };
}

async function expectExperiment(page, url, initialSpeed, stopDistance) {
  const response = await page.goto(url, { waitUntil: "domcontentloaded" });
  assert.equal(response.status(), 200);
  await page.waitForFunction(speed => state.hasGenerated && state.p1 === speed, initialSpeed);
  assert.equal(await page.evaluate(() => physicsBrakeModel().stopDistance), stopDistance);
  assert.equal(await page.evaluate(() => state.playing), false);
}

async function submit(payload, origin = site.origin) {
  return fetch(new URL("/v1/shares", api), {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

try {
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "msedge", headless: true });
  const { context: senderContext, page: sender } = await browserContext(1366);
  await senderContext.grantPermissions(["clipboard-read", "clipboard-write"], { origin: site.origin });
  await sender.goto(site.href, { waitUntil: "domcontentloaded" });
  await sender.locator("#questionInput").fill(question);
  await sender.locator("#generateButton").click();
  await sender.waitForFunction(() => state.hasGenerated && !document.querySelector("#generateButton").classList.contains("loading"));
  await sender.evaluate(() => {
    elements.ranges[0].value = 25;
    elements.ranges[0].dispatchEvent(new Event("input", { bubbles: true }));
  });
  const expectedQuestion = await sender.evaluate(() => state.generatedQuestion);
  const created = sender.waitForResponse(response => response.request().method() === "POST" && response.url() === api.origin + "/v1/shares");
  await sender.locator("#shareButton").click();
  const response = await created;
  assert.equal(response.status(), 201, await response.text());
  const { code, expiresAt } = await response.json();
  assert.match(code, /^[A-Za-z0-9_-]{10}$/);
  const hours = (expiresAt * 1000 - Date.now()) / 3600000;
  assert.ok(hours > 23.99 && hours <= 24);
  await sender.waitForFunction(() => document.querySelector("#toast").textContent.includes("短链接已复制"));
  const link = await sender.evaluate(() => navigator.clipboard.readText());
  assert.equal(link, site.origin + "/s/" + code);
  console.log("PASS real clipboard, ten-character short code and 24-hour expiry");

  const { page: receiver } = await browserContext(390);
  await expectExperiment(receiver, link, 25, 62.5);
  assert.equal(new URL(receiver.url()).searchParams.get("s"), code);
  assert.equal(await receiver.evaluate(() => state.generatedQuestion), expectedQuestion);
  assert.equal(await receiver.evaluate(() => state.gradeLevel), "senior");
  await receiver.waitForFunction(() => scrollY > 0);
  await receiver.reload();
  await receiver.waitForFunction(() => state.hasGenerated && state.p1 === 25);
  console.log("PASS 390px clean session restores the adjusted experiment after opening and reloading");

  const record = await fetch(new URL("/v1/shares/" + code, api));
  assert.equal(record.headers.get("cache-control"), "no-store");
  assert.deepEqual(await record.json(), { payload: { ...legacy, question: expectedQuestion, params: [25, 5] } });
  assert.equal((await submit({ ...legacy, extra: "discard" })).status, 400);
  assert.equal((await submit({ ...legacy, question: "中文".repeat(1500) })).status, 400);
  assert.equal((await submit(legacy, "https://unrelated.invalid")).status, 403);
  const preflight = await fetch(new URL("/v1/shares", api), {
    method: "OPTIONS", headers: { Origin: site.origin, "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "Content-Type" }
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), site.origin);
  console.log("PASS storage reads, bounded payload, exact fields and CORS");

  for (const absent of ["missing000", "expired000", "invalid"]) {
    await receiver.goto(site.origin + "/s/" + absent);
    await receiver.waitForFunction(() => document.querySelector("#parseFeedback").textContent.includes("未恢复实验"));
    assert.equal(await receiver.evaluate(() => state.hasGenerated), false);
    const error = await receiver.locator("#parseFeedback").textContent();
    assert.match(error, absent === "invalid" ? /格式无效/ : /不存在或已过期/);
  }
  await cleanupShares(pool);
  const afterCleanup = await pool.query("SELECT code FROM experiment_shares");
  assert.deepEqual(afterCleanup.rows, [{ code }]);
  console.log("PASS invalid, missing and expired links show an explanation; cleanup preserves valid shares");

  const drainingBackend = createShareServer({ pool, siteOrigin: site.origin, storageEnd: Date.now() + 3600000 });
  drainingBackend.listen(0, "127.0.0.1");
  await once(drainingBackend, "listening");
  try {
    const drainingUrl = "http://127.0.0.1:" + drainingBackend.address().port + "/v1/shares";
    const duringDrain = await fetch(drainingUrl, {
      method: "POST", headers: { Origin: site.origin, "Content-Type": "application/json" }, body: JSON.stringify(legacy)
    });
    assert.equal(duringDrain.status, 503);
    assert.deepEqual(await duringDrain.json(), { error: "SHARE_CREATION_PAUSED" });
    assert.equal((await fetch(drainingUrl + "/" + code)).status, 200);
    console.log("PASS database cutoff stops new shares and continues to serve stored shares");
  } finally {
    drainingBackend.close();
  }

  await sender.route(api.origin + "/v1/shares", route => route.abort());
  await sender.locator("#shareButton").click();
  await sender.waitForFunction(() => document.querySelector("#toast").textContent.includes("已复制完整分享链接"));
  const fallback = await sender.evaluate(() => navigator.clipboard.readText());
  assert.ok(new URL(fallback).searchParams.has("share"));
  const { page: offlineReader } = await browserContext(390, false);
  await expectExperiment(offlineReader, fallback, 25, 62.5);
  const oldHash = "#/share/" + Buffer.from(JSON.stringify(legacy)).toString("base64url");
  await expectExperiment(offlineReader, site.href + oldHash, 20, 40);
  console.log("PASS failed short-link creation copies a working self-contained link and v1 remains readable");

  const unconnected = await browserContext(390, false);
  await unconnected.page.goto(link);
  await unconnected.page.waitForFunction(() => document.querySelector("#parseFeedback").textContent.includes("短链接服务连接失败"));
  assert.equal(await unconnected.page.evaluate(() => state.hasGenerated), false);
  assert.deepEqual(errors, []);
  assert.deepEqual(aiRequests, []);
  console.log("PASS lookup outage gives a retry message and sharing makes no AI requests");

  console.log(JSON.stringify({ browser: browser.version(), code, expiresAt, linkLengthOnPublicDomain:
    "https://ai-science-studio.onrender.com/s/".length + code.length }));
} finally {
  await browser?.close();
  backend.close();
  await new Promise((resolveClose, reject) => frontend.close(error => error ? reject(error) : resolveClose()));
  await database.close();
}
