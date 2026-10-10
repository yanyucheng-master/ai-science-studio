# Master Lab AI Gateway

This service is the single AI gateway shared by the Master Lab web client and
the HarmonyOS client. Existing experiment calculations remain deterministic on
the client; the model may classify an unmatched question or explain a verified
experiment, but it cannot inject experiment HTML or bypass local parameter
validation.

## Local development

1. Copy `.env.example` to `.env` and set `DEEPSEEK_API_KEY` only on the server.
2. Add the local web origin to `ALLOWED_ORIGINS`, for example
   `http://127.0.0.1:8765,http://localhost:8765`.
3. Run `npm run start:local` from this directory. This command explicitly
   loads the ignored local `.env` file. Production continues to use `npm start`
   and receives secrets from the deployment environment.
4. Serve the `web` directory at `http://127.0.0.1:8765`.

Without a key, `/health` and all existing local experiments still work. The
tutor can return deterministic local hints for an active experiment, while an
unmatched question returns `AI_NOT_CONFIGURED` instead of a fabricated answer.

## Endpoints

- `GET /health`
- `POST /api/v1/experiment/generate`
- `POST /api/v1/tutor/suggest` for HarmonyOS compatibility
- `POST /api/v1/tutor/chat` for structured multi-turn tutoring

The chat response is validated into controlled text, step, formula, check and
optional parameter-patch fields. A parameter patch can only target an existing
parameter and the web client requires explicit confirmation before applying it.

The chat protocol matches the public web client (`codex/public-demo-byo-key`):
up to three sanitized `suggestedQuestions` (empty for clarification, refusal and
local fallback), steps up to 1200 characters, and quoted excerpts under
`【引用片段，仅作提问材料】` followed by `【本次问题】`. Goal, topic and coverage
checks use only the latest question, so quoted text is never treated as new
tasks; a request for the full steps of one named sub-question ("只补充第(3)问的
完整步骤") stays a targeted follow-up. Topic anchors (for example 弹簧 but not 弹簧测力计, 镁,
¹⁵N) are required only in a full solution, not in a hint, an explanation or a
sub-question answer. The induction-rod check compares an `a(v)` only where the
answer states one with numbers, evaluated as a line in `v` so that `5-0.4v`,
`(1.0-0.08v)/0.20` and `5-\frac{2}{5}v` are equal; it skips variants and the
student's own `a(v)` quoted back for checking. When history exceeds its
8000-character budget, the newest turns are kept. Clients that send no quotes
or suggestions are unaffected.

## Deployment

Create `DEEPSEEK_API_KEY` as a Render secret. Do not put the key in `web`, a
client-side browser storage, a build artifact, Git, or a HarmonyOS package. Keep
`ALLOWED_ORIGINS` restricted to the deployed web origin. After deployment,
verify `/health` reports `aiConfigured: true`, `model: deepseek-flash`,
`modelVersion: DeepSeek-V4.1-Flash`, and `reasoningEffort: max`, then run the web and HarmonyOS
integration tests against the same service URL.

The configured model is DeepSeek V4.1 Flash. The official API ID is
`deepseek-flash`; as of 2026-09-30 this routes to `DeepSeek-V4.1-Flash`.
Do not override the model from the client, environment variables, or request
bodies. All requests send `thinking: {"type":"enabled"}` and
`reasoning_effort: "max"` per the official Chat Completions docs. Teaching
depth remains independent: hint mode still withholds the final answer.

The output budget is 32768 tokens, not a claim of unlimited reasoning. Upstream
requests have a 240-second deadline; timeout, cut-off (`length`), filtered and
wrong-model responses are never retried or silently downgraded. Network and
retryable HTTP errors get one retry. An answer that arrives but is unusable —
empty content, JSON that cannot be parsed even after repair, or
`insufficient_system_resource` (after a 2 s, then 4 s pause) — may be retried
twice, and no such retry starts more than 120 seconds after the first call.
Once the browser disconnects the upstream call is abandoned and no retry
starts, so an unread answer does not hold one of the two concurrent upstream
slots; retries stay within the same slot.

The model writes LaTeX inside JSON strings and often uses single backslashes
(`\(`, `\frac`, `\mathrm`). `src/model-json.js` keeps genuine JSON escapes and
turns LaTeX backslashes into literal ones before parsing. `\b` or `\f` before a
letter is always LaTeX; `\n`, `\r` and `\t` count as LaTeX when they start a
known command (`\nu`, `\rho`, `\times`), and short ones such as `\ne` only in a
string that is evidently written with single backslashes. Inside an
environment (`cases`, `aligned`, `array`) such a string writes a row break as a
doubled backslash, so `\\` before anything but a known command name is a row
break; an environment that writes row breaks as `\\\\` keeps `\\` as an escaped
backslash and only repairs one that cannot be meant that way (before a digit,
a sign, `&` or a lone letter). Outside an environment `\\` stays an escaped backslash
(`\ `, `\cong`, `\(`). A row break before `(` or `[` gets a space, since
the client reads `\\(` as a math delimiter and KaTeX reads `\\[` as a
spacing argument. On 2026-10-10 single-backslash answers caused about half
of the public demo's tutor answers to fail as `AI_UNAVAILABLE`.

AI failures carry a `reason` code (for example `INVALID_JSON`,
`EMPTY_CONTENT`, `TRUNCATED`, `MODEL_MISMATCH`, `HTTP_500`, `TIMEOUT`,
`CLIENT_GONE`). An
unusable answer is returned as `502 INVALID_AI_RESPONSE` rather than
`503 AI_UNAVAILABLE`, which clients present as an outage; provider overload
that outlasts its retries is `429 AI_BUSY`. Request logs add only
`aiError: {code, reason, attempts}`; question, answer and provider text are
never logged. `RATE_LIMIT_MAX=0` disables per-address rate quotas without
retaining address counters. There is no daily quota; capacity, request-size,
response-validation and timeout protections remain enabled. This public demo
can exhaust the owner's finite API balance. It is not authentication or a
guaranteed spending cap, and it never triggers an automatic recharge.
Web visitors without a personal key use this server's secret. A personal key
keeps the existing browser-to-DeepSeek route and is never sent to this gateway;
personal-key errors do not automatically fall back to the public balance.
`/health` reports configuration, not evidence of a successful paid model call.

For unmatched questions, the generate endpoint returns the complete checked
explanation and an optional declarative visualization: the HarmonyOS client
does not make an additional chat request. Never execute model-generated code.

## Model evaluation

`eval/questions.json` contains 30 middle-school science benchmark questions
with compact reference checkpoints. With the configured server running, use
`npm run eval`. The script stores a timestamped JSON report and exits with a
failure status when fewer than 95% of the reference checkpoints are present.
This automated screen does not replace manual review: every failed item and
every scientifically suspicious answer must still be inspected before release.

## Tutor transport regression checks

Run `npm test` to check the server protocol and the actual browser tutor script
in a Node VM, including SSE framing, split UTF-8, stream completion, JSON parsing,
bounded fallback, cancellation and timeouts. These tests use only in-memory
fixtures and do not load `.env` or call the upstream AI service.

For browser acceptance, run `npm run test:browser` with Playwright available.
`PLAYWRIGHT_MODULE` can point to an existing Playwright package directory;
`BROWSER_CHANNEL` defaults to `msedge`. The script opens a fresh isolated browser,
serves this project's web files and synthetic SSE/JSON on loopback, and uses the
real gateway with AI disabled for offline cases. It never saves a credential or
allows an external model request. Browser virtual time advances the configured
deadline so timeout coverage does not require waiting in real time.

Screenshots and a report containing response status/type, request mode/count,
console errors and visible page results are written to the ignored directory
`outputs/tutor-sse/after/` at the repository root. Request headers are not recorded.
The `--baseline` flag records the same scenarios without asserting repaired
behavior; run it against the original code to capture before/after evidence.
