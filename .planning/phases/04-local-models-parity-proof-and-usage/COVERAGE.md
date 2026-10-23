# API Coverage — Ollama native API · llama.cpp server · LM Studio REST

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
>
> **Why this file exists.** The deterministic detector returned `detected: false`
> when run over the ROADMAP section alone (no PLAN.md existed yet, so the scope was
> 3,261 characters of roadmap prose). The phase nevertheless integrates three
> external HTTP APIs — Ollama's native API, llama.cpp's server, and LM Studio's
> REST surface — and the seal-time gate re-runs the detector over the PLAN.md
> bodies, where the signal is present. The matrix is produced at plan time as the
> checkpoint instructs rather than left for seal time.
>
> **Second-integration rule applied.** Each of the three servers is re-decided from
> the same full-coverage baseline; the first server's opt-outs are not carried over
> silently.

## Ollama — native API (`http://127.0.0.1:11434`)

| capability | decision | reason |
|---|---|---|
| `GET /api/tags` — model list | INTEGRATE | |
| `POST /api/show` — capabilities + `model_info` max window | INTEGRATE | |
| `POST /api/chat` — chat with `tools` and `options.num_ctx` | INTEGRATE | |
| `GET /api/version` | OPT-OUT | not needed — `/api/tags` already proves it is Ollama answering, and no behaviour depends on the daemon version |
| `POST /api/generate` — completion | OPT-OUT | explicitly out of scope — the tutor is a tool-calling chat loop; a completion endpoint cannot carry the method's tools |
| `POST /api/embed` | OPT-OUT | explicitly out of scope — Derive stores no embeddings (REQUIREMENTS.md names no retrieval feature) |
| Ollama model-library mutation endpoints (6) | OPT-OUT | `/api/pull` `/push` `/create` `/copy` `/delete` `/blobs` — explicitly out of scope: Derive never mutates the learner's model library (04-CONTEXT.md D-05) |
| `GET /api/ps` — loaded instances | OPT-OUT | not needed — D-05 makes Ollama the one server Derive *tells* the window to, so what is currently loaded changes nothing Derive decides |
| Ollama cloud `web_search` | OPT-OUT | explicitly out of scope — needs an Ollama account key the offline path has none of; 03 D-20 puts the row on the fallback search path (04-CONTEXT.md §Deferred) |

## llama.cpp — server (`http://127.0.0.1:8080` by default)

| capability | decision | reason |
|---|---|---|
| `GET /health` — liveness | INTEGRATE | |
| `GET /v1/models` — model list + `meta.n_ctx_train` | INTEGRATE | |
| `GET /props` — template caps + default window | INTEGRATE | reads `chat_template_caps.supports_tools` and `default_generation_settings.n_ctx` |
| `POST /v1/chat/completions` — chat with `tools` | INTEGRATE | |
| `POST /completion` · `/infill` | OPT-OUT | explicitly out of scope — not a tool-calling chat surface |
| `POST /embedding` | OPT-OUT | explicitly out of scope — Derive stores no embeddings |
| `POST /tokenize` · `/detokenize` | OPT-OUT | explicitly out of scope — REQUIREMENTS.md §Out of Scope forbids client-side tokenizers for cost; `estimateTokens` is the one estimator |
| `GET /slots` · `POST /slots/:id?action=…` | OPT-OUT | not needed — Derive runs one turn per lesson and keeps no server-side slot state |
| `GET /lora-adapters` · `POST /lora-adapters` | OPT-OUT | explicitly out of scope — adapter selection is the learner's own server configuration (D-05) |
| `GET /metrics` | OPT-OUT | not needed — the conformance harness measures the method, not the server's throughput |
| `POST /apply-template` | OPT-OUT | not needed — `/props` reports template capability directly, which is the cheap read D-06 asks for |

## LM Studio — REST (`http://127.0.0.1:1234`)

| capability | decision | reason |
|---|---|---|
| `GET /api/v0/models` — discovery shape + `max_context_length` (older builds) | INTEGRATE | |
| `GET /api/v1/models` — tool-use + window | INTEGRATE | reads `capabilities.trained_for_tool_use`, `max_context_length`, and `loaded_instances[].config.context_length` |
| `POST /v1/chat/completions` (LM Studio) — chat with `tools` | INTEGRATE | same OpenAI-compatible path llama.cpp exposes, but a different server — kept as its own row so each server's matrix stands alone |
| `POST /v1/completions` · `POST /api/v0/completions` | OPT-OUT | explicitly out of scope — not a tool-calling chat surface |
| `POST /v1/embeddings` · `POST /api/v0/embeddings` | OPT-OUT | explicitly out of scope — Derive stores no embeddings |
| `GET /api/v0/models/{model}` — single-model detail | OPT-OUT | not needed — the list endpoints already carry every field the capability probe reads, in one request for the whole list (D-07) |
| model load/unload control | OPT-OUT | explicitly out of scope — D-05 makes LM Studio read-only; Derive never changes a server's loaded instance |

## Cross-cutting posture (applies to all three)

| capability | decision | reason |
|---|---|---|
| Bearer token on a server started with one | INTEGRATE | `optionalKey: true` already on the LM Studio and llama.cpp catalogue rows |
| Redirect following | OPT-OUT | explicitly out of scope — every outbound request keeps `redirect: 'manual'`; a 3xx could carry a key to a host the catalogue never named |
| Streaming token usage (`stream_options.include_usage`) | INTEGRATE | `includeUsage: true` on the OpenAI-compatible rows; an endpoint that still reports nothing degrades to `not reported` |
