import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import pg from "pg";

const CODE = /^[A-Za-z0-9_-]{10}$/;
const PUBLIC_PATH = "/v1/shares";
const MAX_BYTES = 8000;
const RETENTION_MS = 24 * 60 * 60 * 1000;

function exactKeys(value, names) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === names.length
    && names.every(name => Object.hasOwn(value, name));
}

const validLevel = value => value === "junior" || value === "senior";

function validMode(value) {
  if (exactKeys(value, [])) return true;
  if (exactKeys(value, ["braking"])) return ["constant", "friction", "linear_drag"].includes(value.braking);
  if (exactKeys(value, ["level", "locked"])) return validLevel(value.level) && typeof value.locked === "boolean";
  return exactKeys(value, ["viewEnd", "windingDirection", "hasCore"])
    && ["left", "right"].includes(value.viewEnd)
    && ["clockwise", "counterclockwise"].includes(value.windingDirection)
    && typeof value.hasCore === "boolean";
}

function validPayload(value) {
  return exactKeys(value, ["v", "subject", "question", "grade", "template", "params", "mode"])
    && value.v === 1 && ["物理", "化学", "数学", "生物"].includes(value.subject)
    && typeof value.question === "string" && value.question.length > 0 && value.question.length <= 2000
    && value.question.trim() === value.question
    && validLevel(value.grade)
    && typeof value.template === "string" && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value.template)
    && Array.isArray(value.params) && [0, 2].includes(value.params.length)
    && value.params.every(Number.isFinite) && validMode(value.mode);
}

async function readPayload(request) {
  const chunks = [];
  let length = 0;
  try {
    for await (const chunk of request.iterator({ destroyOnReturn: false })) {
      length += chunk.length;
      if (length > MAX_BYTES) {
        request.resume();
        return null;
      }
      chunks.push(chunk);
    }
    const payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, length)));
    return validPayload(payload) ? JSON.stringify(payload) : null;
  } catch {
    return null;
  }
}

function rateLimit(maximum) {
  let minute = -1;
  let count = 0;
  return () => {
    const now = Math.floor(Date.now() / 60000);
    if (minute !== now) {
      minute = now;
      count = 0;
    }
    return count++ < maximum;
  };
}

export async function initializeShares(pool) {
  const schema = await readFile(new URL("../schema.sql", import.meta.url), "utf8");
  await pool.query(schema);
}

export async function cleanupShares(pool) {
  await pool.query("DELETE FROM experiment_shares WHERE expires_at <= CURRENT_TIMESTAMP");
}

export function createShareServer({ pool, siteOrigin, storageEnd = Infinity }) {
  const allowCreate = rateLimit(60);
  const allowRead = rateLimit(300);
  const acceptingShares = () => Date.now() + RETENTION_MS < storageEnd;

  return createServer({ requestTimeout: 15000, headersTimeout: 10000 }, async (request, response) => {
    const pathname = (request.url || "/").split("?")[0];
    const atCollection = pathname === PUBLIC_PATH;
    const code = pathname.startsWith(PUBLIC_PATH + "/") ? pathname.slice(PUBLIC_PATH.length + 1) : "";
    const atRecord = CODE.test(code);
    const origin = request.headers.origin;
    const allowedOrigin = origin === siteOrigin;
    const method = request.method;
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Vary", "Origin");
    if (allowedOrigin) response.setHeader("Access-Control-Allow-Origin", origin);
    const send = (status, body) => {
      if (response.destroyed) return;
      response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(body));
    };

    if (method === "GET" && pathname === "/health") {
      send(200, { ok: true, acceptingShares: acceptingShares() });
      return;
    }
    if (!atCollection && !atRecord) return send(404, { error: "NOT_FOUND" });
    if (origin && !allowedOrigin) return send(403, { error: "ORIGIN_NOT_ALLOWED" });

    if (method === "OPTIONS" && allowedOrigin && atCollection) {
      response.writeHead(204, {
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "600"
      });
      response.end();
      return;
    }

    try {
      if (atCollection && method === "POST") {
        if (!allowedOrigin) return send(403, { error: "ORIGIN_NOT_ALLOWED" });
        if (!/^application\/json(?:\s*;|$)/i.test(request.headers["content-type"] || "")) {
          return send(415, { error: "INVALID_CONTENT_TYPE" });
        }
        if (!acceptingShares()) return send(503, { error: "SHARE_CREATION_PAUSED" });
        if (!allowCreate()) return send(429, { error: "RATE_LIMITED" });
        const payload = await readPayload(request);
        if (payload === null) return send(400, { error: "INVALID_SHARE" });
        const expiresAt = Date.now() + RETENTION_MS;
        if (expiresAt >= storageEnd) return send(503, { error: "SHARE_CREATION_PAUSED" });
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const newCode = randomBytes(8).toString("base64url").slice(0, 10);
          const result = await pool.query(
            "INSERT INTO experiment_shares (code, payload, expires_at) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING",
            [newCode, payload, new Date(expiresAt)]
          );
          if (result.rowCount === 1) return send(201, { code: newCode, expiresAt: Math.floor(expiresAt / 1000) });
        }
        return send(503, { error: "SHARE_UNAVAILABLE" });
      }
      if (atRecord && method === "GET") {
        if (!allowRead()) return send(429, { error: "RATE_LIMITED" });
        const { rows } = await pool.query(
          "SELECT payload FROM experiment_shares WHERE code = $1 AND expires_at > CURRENT_TIMESTAMP", [code]
        );
        return rows.length ? send(200, { payload: rows[0].payload }) : send(404, { error: "NOT_FOUND" });
      }
    } catch {
      return send(503, { error: "SHARE_UNAVAILABLE" });
    }
    send(405, { error: "METHOD_NOT_ALLOWED" });
  });
}

async function start() {
  const { DATABASE_URL: databaseUrl, SITE_ORIGIN: siteOrigin, SHARE_STORAGE_END: end, RENDER, PORT } = process.env;
  if (!databaseUrl || !siteOrigin) throw new Error("Missing share service configuration");
  const storageEnd = end ? Date.parse(end) : RENDER ? 0 : Infinity;
  if (Number.isNaN(storageEnd)) throw new Error("Invalid storage end timestamp");

  const pool = new pg.Pool({ connectionString: databaseUrl, max: 4, connectionTimeoutMillis: 4000, query_timeout: 6000 });
  const logUnavailable = () => console.error("Share storage temporarily unavailable");
  pool.on("error", logUnavailable);
  await initializeShares(pool);
  await cleanupShares(pool);
  const timer = setInterval(() => cleanupShares(pool).catch(logUnavailable), 60 * 60 * 1000).unref();
  const server = createShareServer({ pool, siteOrigin, storageEnd });
  server.listen(Number(PORT || 8787), "0.0.0.0", () => console.log("Share service ready"));
  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.once(signal, () => {
      clearInterval(timer);
      server.close(() => pool.end());
    });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  start().catch(() => {
    console.error("Share service startup failed");
    process.exit(1);
  });
}
