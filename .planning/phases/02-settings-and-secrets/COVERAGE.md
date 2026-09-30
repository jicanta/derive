# API Coverage — Phase 2 provider endpoints

> Full coverage by default. Opt-outs are explicit, reasoned decisions. Detector fired on the phase scope (`api` surface in D-05); this matrix is the decision record the seal-time gate reads.

The phase talks to each provider's cheapest authenticated read (its models list, or a local server's models/health endpoint) to detect, list models and test a connection. Running a lesson on any of these providers is Phase 3 (keys, gateways) and Phase 4 (local models); those capabilities are opted out here and integrated there.

## Anthropic (api.anthropic.com)

| capability | decision | reason |
|---|---|---|
| list_models (`GET /v1/models?limit=1000`, `x-api-key` + `anthropic-version`) | INTEGRATE | model list and connection test, plan 03 |
| messages / chat completion | OPT-OUT | the owned agent loop is Phase 3 (PROV-01) |
| count_tokens, batches, files | OPT-OUT | not needed to choose or test a provider |

## OpenAI (api.openai.com)

| capability | decision | reason |
|---|---|---|
| list_models (`GET /v1/models`, Bearer) | INTEGRATE | plan 03 |
| responses / chat completions | OPT-OUT | Phase 3 (PROV-02) |
| embeddings, files, fine-tuning, audio, images | OPT-OUT | not part of the Derive method |

## Google Gemini (generativelanguage.googleapis.com)

| capability | decision | reason |
|---|---|---|
| models.list (`GET /v1beta/models?pageSize=1000`, `x-goog-api-key` header; `nextPageToken` followed only if present) | INTEGRATE | plan 03; filtered to `generateContent`-capable models |
| generateContent / streamGenerateContent | OPT-OUT | Phase 3 (PROV-03) |
| `?key=` query authentication | OPT-OUT | header only — a key in a URL lands in logs and proxies (RESEARCH Pitfall 4) |
| Gemini CLI OAuth | OPT-OUT | forbidden for third-party tools by Google's service update; Gemini is API-key only (D-05) |

## OpenRouter (openrouter.ai/api)

| capability | decision | reason |
|---|---|---|
| list_models (`GET /v1/models`, Bearer) | INTEGRATE | plan 03; one request proves the key and gives the count |
| `GET /v1/key` (key metadata, credit) | OPT-OUT | the models list already proves the key; credit display is Phase 3/4 cost work (COST-02/03) |
| chat completions | OPT-OUT | Phase 3 (PROV-04) |

## OpenAI-compatible endpoint (learner's base URL)

| capability | decision | reason |
|---|---|---|
| list_models (`GET {base}/v1/models`, Bearer when a key is set) | INTEGRATE | plan 03; also the test-suite double on loopback |
| chat completions | OPT-OUT | Phase 3 (PROV-05) |

## Ollama (default 127.0.0.1:11434, `OLLAMA_HOST`)

| capability | decision | reason |
|---|---|---|
| `GET /api/tags` | INTEGRATE | detection shape check (plan 01) and model list / test (plan 03) |
| `GET /v1/models` (OpenAI-compatible) | OPT-OUT | `/api/tags` is the documented native list; one endpoint per row |
| `GET /api/show` (context length) | OPT-OUT | Phase 4 `num_ctx` work (PROV-06) |
| `GET /` banner "Ollama is running" | OPT-OUT | folklore not confirmed in documentation; not relied on |
| chat / generate | OPT-OUT | Phase 4 |

## LM Studio (default 127.0.0.1:1234)

| capability | decision | reason |
|---|---|---|
| `GET /api/v0/models` (loaded state) | INTEGRATE | detection shape check and model list / test, loaded models first |
| `GET /v1/models` | OPT-OUT | the native list carries `state`, which the UI orders by |
| chat completions | OPT-OUT | Phase 4 (PROV-07) |

## llama.cpp server (default 127.0.0.1:8080)

| capability | decision | reason |
|---|---|---|
| `GET /health` (200 ok / 503 loading) | INTEGRATE | detection shape check (plan 01) |
| `GET /v1/models` | INTEGRATE | model list and connection test (plan 03) |
| `GET /props` (template support) | OPT-OUT | Phase 4 (PROV-07) |
| completions | OPT-OUT | Phase 4 |

## Claude Code and Codex logins (no HTTP API)

| capability | decision | reason |
|---|---|---|
| `claude auth status` → `loggedIn` only | INTEGRATE | login detection and connection test; identity fields deliberately dropped (RESEARCH Pitfall 2) |
| `~/.codex/auth.json` presence | INTEGRATE | login detection and connection test |
| Claude.ai OAuth credentials for in-app use | OPT-OUT | Anthropic's terms forbid third-party intermediation; in-app Claude is API-key only from Phase 3 (D-05) |
