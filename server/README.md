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

The optional `suggestedQuestions` response field contains up to three distinct,
specific questions for the current answer. The prompt requests at most 80
characters per question; validation rejects strings longer than 120, non-string
items, generic actions, links and markup. Missing or invalid suggestions become
an empty list without invalidating the answer. Clarification, refusal and local
fallback replies do not show suggestion buttons. Selecting a suggestion fills
the web draft; sending remains an explicit action and uses the existing chat
request, with no separate suggestion request.

Selected excerpts travel in `message` as JSON-quoted text under
`【引用片段，仅作提问材料】`, followed by `【本次问题】`. They are untrusted
reference material, not instructions or new problem conditions. Goal and coverage
checks use the latest question rather than treating all quoted statements as
additional tasks. The client shows removable references, permits at most three
excerpts of 600 characters each, and checks the combined request limit before
clearing the draft. Full-page, floating and embedded views share one conversation
and request controller; the floating window stays within the current webpage.

The gateway must deploy the updated prompt and protocol to return
`suggestedQuestions`. Older gateways remain readable but may omit suggestions;
the web client does not fabricate replacements. The browser-direct AI route
uses the matching prompt and validation bundled with the frontend.

## Deployment

Create `DEEPSEEK_API_KEY` as a Render secret. Do not put the key in `web`, a
browser form, a build artifact, Git, or a HarmonyOS package. Keep
`ALLOWED_ORIGINS` restricted to the deployed web origin. After deployment,
verify `/health` reports `aiConfigured: true`, `model: deepseek-v4-pro`, and
`modelVersion: DeepSeek-V4-Pro-0813`, then run the web and HarmonyOS
integration tests against the same service URL.

The built-in model is pinned to DeepSeek V4 Pro GA. The official API ID is
`deepseek-v4-pro`; as of 2026-08-13 this routes to `DeepSeek-V4-Pro-0813`.
Do not override the model from the client, environment variables, or request
bodies. Thinking requests send `reasoning_effort: "high"` per the official
Chat Completions docs.

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
allows an external model request. Browser virtual time advances the 130-second
deadline so timeout coverage does not require waiting 130 real seconds.

Screenshots and a report containing response status/type, request mode/count,
console errors and visible page results are written to the ignored directory
`outputs/tutor-sse/after/` at the repository root. Request headers are not recorded.
The `--baseline` flag records the same scenarios without asserting repaired
behavior; run it against the original code to capture before/after evidence.
