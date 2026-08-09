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

## Deployment

Create `DEEPSEEK_API_KEY` as a Render secret. Do not put the key in `web`, a
browser form, a build artifact, Git, or a HarmonyOS package. Keep
`ALLOWED_ORIGINS` restricted to the deployed web origin. After deployment,
verify `/health` reports `aiConfigured: true` and run the web and HarmonyOS
integration tests against the same service URL.

## Model evaluation

`eval/questions.json` contains 30 middle-school science benchmark questions
with compact reference checkpoints. With the configured server running, use
`npm run eval`. The script stores a timestamped JSON report and exits with a
failure status when fewer than 95% of the reference checkpoints are present.
This automated screen does not replace manual review: every failed item and
every scientifically suspicious answer must still be inspected before release.
