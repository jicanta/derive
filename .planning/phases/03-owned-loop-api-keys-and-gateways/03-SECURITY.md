---
phase: "03"
slug: "owned-loop-api-keys-and-gateways"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-12"
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
>
> The register was authored at plan time: all nine `03-0*-PLAN.md` files carry a parseable
> `<threat_model>` block, so this audit **verifies the mitigations exist** rather than building a
> register retroactively. ASVS level 1 (grep-depth), block threshold `high`.

---

## Trust Boundaries

| Boundary | Description (the data crossing) | Source plan |
|----------|-------------------------------|-------------|
| Derive server → provider API | The learner's API key crosses here, in a header, to a host the catalogue names | plan 03-01 |
| provider response → Derive's tool dispatch | Model-authored tool arguments cross here and reach `actions.ts`, which writes FSRS rows and node statuses | plan 03-01 |
| provider response → the lesson's durable event log | Model-authored prose crosses here into SQLite, the SSE stream and the Obsidian mirror | plan 03-01 |
| `~/.derive/prices.json` → the cost path | Learner-editable JSON crosses here and becomes the rates every figure is computed from | plan 03-02 |
| `usage` rows → the learner's cost figure | Recorded counts cross here and become a money claim shown on two screens | plan 03-02 |
| Derive server → four more provider APIs | The learner's key crosses here to OpenAI, Google, OpenRouter, or a host the learner themself named | plan 03-03 |
| learner-supplied base URL → the request | A learner-typed origin becomes the host a bearer token is sent to | plan 03-03 |
| provider response metadata → the usage ledger | Vendor-authored JSON becomes a money figure on the learner's screen | plan 03-03 |
| persisted `turn_messages` → the next provider request | Stored, model-authored JSON crosses here back into a request body | plan 03-04 |
| persisted `tool_results` → the tool's return value | A stored result crosses here and is returned to the model as though the tool had just run | plan 03-04 |
| `prices`/`settings`/`learners` rows → migration 7 | Stored learner preferences are rewritten in place | plan 03-04 |
| provider error body → the learner's screen | Vendor-authored error text crosses here into a rendered sentence | plan 03-05 |
| provider response headers → Derive's wait | A vendor-supplied `Retry-After` crosses here and decides how long Derive sleeps | plan 03-05 |
| persisted history size → the request | Stored, model-grown state crosses here and decides whether a request is made at all | plan 03-05 |
| model-supplied URL → `fetch_page` | A URL the model chose crosses here and becomes an outbound request from the learner's machine | plan 03-06 |
| search provider response → the tutor's context | Third-party result text crosses here and is read by the model as evidence | plan 03-06 |
| fetched page text → the tutor's context | Arbitrary web text crosses here and is read by the model as evidence | plan 03-06 |
| learner-supplied SearXNG base URL → an outbound request | A learner-typed origin, very often on localhost, becomes a request target | plan 03-06 |
| model-authored tool arguments → `actions.ts` | Arguments shaped by whatever schema the provider enforced cross here into code that writes FSRS rows and node statuses | plan 03-07 |
| the registry → five provider wire formats | One contract crosses here into four projections, each of which a provider may normalise further | plan 03-07 |
| `usage` rows → a money claim on two screens | Recorded counts and a learner-editable price table cross here and become a statement about what the learner was charged | plan 03-08 |
| the stable system prefix → a provider's cache | Derive's method text crosses here and is retained by the provider for the cache TTL | plan 03-08 |
| learner-typed search key / base URL → storage | A secret and an origin cross here from the browser into `secrets.json` and the settings table | plan 03-09 |
| `pricesFileError()` → the Settings page | A server-authored sentence naming a path crosses here into rendered text | plan 03-09 |
| the doctor → the terminal | Facts about files in the data directory cross here into a shell a learner may paste elsewhere | plan 03-09 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01 | Information Disclosure | `server/src/drivers/adapters.ts` provider factories | high | mitigate | `noRedirectFetch` passed as `fetch:` to every factory: `redirect: 'manual'` and a thrown lowercase sentence on any 3xx. | closed |
| T-03-02 | Tampering | model-authored tool arguments reaching `actions.ts` | high | mitigate | The driver dispatches, it never grades: every tool call goes through `actions.runTool`, and `actions.ts` validates and decides. | closed |
| T-03-03 | Information Disclosure | provider error sentences reaching `turn_end` | high | mitigate | Every error reaching `endTurn` goes through `secrets.ts` `safeMessage`, which redacts registered secrets and narrows a non-`Error` throw. | closed |
| T-03-04 | Denial of Service (wallet) | the unbounded tool-calling loop | high | mitigate | `stopWhen: isStepCount(400)` is passed explicitly, because `streamText`'s own default is one step and omitting it would leave no cap at all once a… | closed |
| T-03-05 | Information Disclosure | reasoning parts of `fullStream` | medium | mitigate | `reasoning-start` produces the ephemeral `status` line `Thinking`; | closed |
| T-03-06 | Tampering | `server/package.json` dependency install | high | mitigate | Task 1's `gate="blocking-human"` package-legitimacy checkpoint runs before the install and is never auto-approved; | closed |
| T-03-07 | Repudiation | `turns.driver` for an owned-loop turn | medium | mitigate | `Driver.name` is the catalogue `ProviderId`, so the ledger and the header pill record which provider ran a turn; | closed |
| T-03-08 | Spoofing | provider identity on a learner-supplied base URL | low | accept | No base-URL row teaches in this plan (`anthropic` only, whose endpoint is the catalogue's). | closed |
| T-03-09 | Tampering | `server/src/prices.ts` reading `~/.derive/prices.json` | medium | mitigate | Validate as learner-editable input, the way `keys.ts` validates `secrets.json`: top-level object, known provider ids, every rate a finite number… | closed |
| T-03-10 | Information Disclosure | `pricesFileError()` sentence | low | mitigate | The sentence names the path, the model and the field only. | closed |
| T-03-11 | Tampering | runtime price fetching | medium | mitigate | `pricing.ts` and `prices.ts` are gated by a negative grep for `fetch(`, so prices cannot become a network read. | closed |
| T-03-12 | Repudiation | a cost figure whose firmness is overstated | medium | mitigate | `weakestSource` makes the label a total, order-independent function of the rows' sources, and `costLabel` keeps the four words; | closed |
| T-03-13 | Denial of Service | `estimateTokens` over a very large prompt | low | accept | The estimate is one `String.length` division; | closed |
| T-03-14 | Elevation of Privilege | `prices.json` written by another process | low | accept | The file lives under the learner's own uid in `DATA_DIR`, which `config.ts` already resolves and the doctor already reports on. | closed |
| T-03-15 | Information Disclosure | `createOpenAICompatible` against a learner-supplied base URL | high | mitigate | `noRedirectFetch` is passed as `fetch:` to this factory too, so a 3xx from the learner's endpoint is refused rather than followed — the fetch spec… | closed |
| T-03-16 | Tampering | `providerMetadata.openrouter.usage.cost` | medium | mitigate | Read defensively through an explicit cast and a `?? null`, because the streaming path types provider metadata as `Record<string, JSONObject>`. | closed |
| T-03-17 | Spoofing | a Gemini lesson taught with no Derive tools | high | mitigate | The loop aborts and ends the turn `ok: false` on the `unsupported` combination warning, rather than letting the model talk with every function… | closed |
| T-03-18 | Information Disclosure | OpenAI Responses API transcript retention | medium | mitigate | `providerOptions.openai.store: false` so a Derive lesson is not retained on the provider's side; | closed |
| T-03-19 | Information Disclosure | provider error text reaching the learner | medium | mitigate | Unchanged from plan 03-01: every sentence through `safeMessage`, every provider sentence through `probe.ts` `providerSentence`/`hintFor`. | closed |
| T-03-20 | Denial of Service (wallet) | a gateway model slug that does not exist | low | mitigate | The corrected `anthropic/claude-opus-5.5` default plus the `settings.test.ts` assertion that every teaching row's default is usable; | closed |
| T-03-21 | Repudiation | which provider ran a turn | medium | mitigate | The table-driven suite asserts `turns.driver` and every `usage.driver` equal the catalogue id for all five rows. | closed |
| T-03-22 | Tampering | a replay re-running a graded tool | high | mitigate | `recordedToolResult(turnId, callId)` is consulted inside the mutex before the action runs, and `recordToolResult` is an `INSERT OR IGNORE` so the… | closed |
| T-03-23 | Tampering | one provider's signatures replayed into another | high | mitigate | `loadTurnMessages` compares the stored driver and returns an empty array on a mismatch, and `agent.ts` clears the rows on the same comparison that… | closed |
| T-03-24 | Information Disclosure | `turn_messages` as a new export-adjacent surface | medium | mitigate | The blob holds the tutor's prose and tool arguments and never a key, because keys live only in headers built inside the adapters. | closed |
| T-03-25 | Access Control | `turn_messages` / `tool_results` scoping | high | mitigate | `learner_id` is read off the lesson row inside `saveTurnMessages` and never taken from a caller, matching `recordUsage`'s stated rule; | closed |
| T-03-26 | Tampering | migration 7 rewriting a stored preference | medium | mitigate | The conversion runs inside the runner's own transaction with its version bump, the runner snapshots an existing database with `VACUUM INTO` before… | closed |
| T-03-27 | Denial of Service | an unbounded message history | medium | mitigate | Plan 03-05's pre-request headroom check is what bounds it: a lesson whose persisted history would outgrow the model's window is refused with… | closed |
| T-03-28 | Repudiation | a turn that ends twice | medium | mitigate | `sinkFor`'s `endTurn` guard is unchanged and the suite asserts exactly one `turn_end` event per aborted turn. | closed |
| T-03-29 | Denial of Service | a vendor-supplied `Retry-After` of hours | high | mitigate | `retryDelay` clamps every delay so the cumulative wait cannot exceed `RETRY_WINDOW_MS` (120 s), and `ctx.isStopping()` is checked on every tick… | closed |
| T-03-30 | Denial of Service (wallet) | retrying a non-retryable failure | high | mitigate | Retry only on `isRetryable === true`, or on 429 / 5xx when the flag is absent. | closed |
| T-03-31 | Denial of Service | an unbounded prompt reaching the provider | high | mitigate | `headroomCheck` runs before the request and refuses at 80% of the known window with a conservative over-counting estimate, so a runaway history is… | closed |
| T-03-32 | Information Disclosure | provider error body rendered to the learner | medium | mitigate | `providerSentence` collapses the body to one line and cuts it at 300 characters, and every string reaching `endTurn` passes through `safeMessage`,… | closed |
| T-03-33 | Tampering | the countdown entering the durable record | low | mitigate | The countdown is `emitEphemeral` only, gated by a grep that counts the three status uses and by `git diff --quiet` over `useLesson.ts`; | closed |
| T-03-34 | Denial of Service | a prompt exceeding an unlisted model's window | low | accept | A model absent from the window table abstains from the check. | closed |
| T-03-35 | Repudiation | a failed turn mistaken for an interrupted one | medium | mitigate | Three endings, three asserted shapes: a Stop and the step cap carry `interrupted: true` with no `error`; | closed |
| T-03-36 | Tampering / Information Disclosure | SSRF through a model-supplied URL to `fetch_page` | high | mitigate | `actions.fetchPage` calls `library.ts`'s `fetchPublic` with `assertPublicHost` as the guard — the DNS-resolved private-range check, the per-hop… | closed |
| T-03-37 | Information Disclosure | the Tavily key | high | mitigate | Stored through `keys.ts`, which calls `registerSecret` before it writes, so the value is redacted from every event, log, export and error from the… | closed |
| T-03-38 | Information Disclosure | the search key on a redirect | high | mitigate | Both search backends use `redirect: 'manual'`, matching `probe.ts`'s posture, so a 3xx is a failure sentence rather than a hop that could carry a… | closed |
| T-03-39 | Tampering | prompt injection from a fetched page or a search result | medium | accept | Inherent to the method and already present — the material and library tools already fetch arbitrary text. | closed |
| T-03-40 | Spoofing | a learner's local SearXNG refused by the destination guard | medium | mitigate | `assertPublicHost` is deliberately **not** applied to the configured search endpoint, gated by a negative grep over `search.ts`; | closed |
| T-03-41 | Spoofing | a tutor offered two ways to search in one turn | medium | mitigate | The loop registers the native tool **or** the `web_search` row, never both, computed from the same helper the prompt's `WebSurface` uses — so the… | closed |
| T-03-42 | Repudiation | a search that is not counted | low | mitigate | The `verified` counter is incremented on the native search tool and on `fetch_page`, gated by a grep, so `Lesson.tsx`'s `facts verified on the… | closed |
| T-03-43 | Tampering | the frozen tool contract moved to make a test pass | high | mitigate | The two assertion moves are named, reasoned and reviewed in this task; | closed |
| T-03-44 | Denial of Service | an unbounded fetched page entering the prompt | medium | mitigate | `fetchPublic`'s existing content-length and byte caps bound the download, and `fetchPage` bounds the returned extract; | closed |
| T-03-45 | Tampering | a tool call whose arguments a narrow dialect could not constrain | high | mitigate | `validateToolInput` `safeParse`s against the **full** zod schema inside the mutex, before `actions.runTool`, and throws a field-naming sentence on… | closed |
| T-03-46 | Tampering | the frozen contract reshaped to satisfy a dialect | high | mitigate | Only the projection adapts; | closed |
| T-03-47 | Spoofing | a projection that is stable and wrong | high | mitigate | D-29's second half: the dialect rules are asserted outright against the committed fixture, so a snapshot that froze an invalid schema fails rather… | closed |
| T-03-48 | Information Disclosure | a schema sent to a provider that differs from the recorded one | medium | mitigate | A pre-projected `jsonSchema(...)` is handed to the provider, never a zod schema, so the SDK's own draft-07 conversion never runs and the bytes on… | closed |
| T-03-49 | Denial of Service | a 400 from Google on every Gemini lesson | medium | mitigate | The Gemini dialect is the safe subset of the keyword inventory the registry actually emits, asserted both in the fixture and in the rules check,… | closed |
| T-03-50 | Repudiation | an unvalidated call recorded as executed | medium | mitigate | Order is fixed and documented: the replay guard first (a recorded result is returned without re-validating a call that already succeeded), then… | closed |
| T-03-51 | Repudiation | a per-turn figure shown as a lesson total | high | mitigate | `turn_end` carries `lesson_cost` as a separate field beside `cost_usd`, both pages are gated by a negative grep for `lastCost`, and a suite case… | closed |
| T-03-52 | Repudiation | a stale figure after an unusual ending | medium | mitigate | `lesson_cost` is attached to every `endTurn` path — success, stopping, catch and refusal — gated by a grep requiring at least four occurrences,… | closed |
| T-03-53 | Tampering | a cost figure overstating its firmness | high | mitigate | The label comes from `weakestSource` over the lesson's rows and `costLabel`'s four words, both pure and unit-tested in plan 03-02; | closed |
| T-03-54 | Information Disclosure | the method text retained in a provider's prompt cache | low | accept | The stable prefix is Derive's own published method text plus the tool contract — no learner data, no key, no lesson content. | closed |
| T-03-55 | Denial of Service | the cost query on a hot view | low | mitigate | `listUsage({ lesson })` is an indexed read and `priceTable()` is cached for a second, so both views do one indexed query per lesson rather than a… | closed |
| T-03-56 | Tampering | a new event type carrying a transient figure | medium | mitigate | `git diff --quiet` over `web/src/lib/useLesson.ts` fails the task if `EVENT_TYPES` or `applyEvent` is touched, so a cost value cannot enter the… | closed |
| T-03-57 | Spoofing | a colour class that silently renders nothing | low | mitigate | A check asserts every token the new markup names is declared in `web/src/index.css`'s `@theme`, because a Tailwind 4 class naming an undeclared… | closed |
| T-03-58 | Information Disclosure | the Tavily key in the browser | high | mitigate | The key field is write-only and reuses `KeyField`'s existing state machine: the row is answered as `{ set, hint, locked }` with at most the last… | closed |
| T-03-59 | Tampering | a blur-save firing on the way to `keep` | medium | mitigate | `KeyField`'s `keep` button swallows `onMouseDown`, which is why the machine is reused rather than re-derived; | closed |
| T-03-60 | Elevation of Privilege | the environment lock bypassed from the page | medium | mitigate | `PUT /api/settings/search` answers 409 naming `TAVILY_API_KEY` when it is set, reusing `lockedBy` and the existing lock-sentence shape; | closed |
| T-03-61 | Information Disclosure | a key reaching the terminal through the doctor | high | mitigate | No search-key line is added at all, with the reason recorded in a comment; | closed |
| T-03-62 | Information Disclosure | `pricesFileError()` rendered on the page | low | mitigate | The sentence names the path, the model and the field only — `prices.json` holds no secret and has no write path — and it reaches the browser… | closed |
| T-03-63 | Spoofing | a selection that does not mean what it says | medium | mitigate | An unconfigured choice behaves as no search on the server and the card says what is missing, rather than silently falling back to the provider's… | closed |
| T-03-64 | Tampering | a class that silently renders nothing | low | mitigate | Every colour token the card names is asserted present in `web/src/index.css` `@theme`, because a Tailwind 4 class naming an undeclared token… | closed |
| T-03-65 | Repudiation | a suite that reads as coverage it does not have | medium | mitigate | The API suite's header records which halves of Success Criteria 1 and 2 cannot be automated in an environment with no provider key, and every plan… | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

Mitigation text is the control as the plan's own register states it, trimmed to its first clause;
the full wording stays in each `03-0*-PLAN.md` `<threat_model>` block.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-03-01 | T-03-08 | Provider identity on a learner-supplied base URL: no base-URL row teaches in 03-01 (`anthropic` only, the catalogue's own endpoint); 03-03 carries that row and inherits `noRedirectFetch` and `normaliseBaseUrl` | owner | 2026-10-12 |
| R-03-02 | T-03-13 | `estimateTokens` over a very large prompt is one `String.length` division on a string already in memory — no parsing, no allocation proportional to anything new | owner | 2026-10-12 |
| R-03-03 | T-03-14 | `prices.json` written by another process: the file lives under the learner's own uid in `DATA_DIR`; the input validation (T-03-09) is the mitigation that matters | owner | 2026-10-12 |
| R-03-04 | T-03-34 | A prompt exceeding an unlisted model's window: the check abstains rather than refusing a capable endpoint on a guessed window; sizing unlisted windows is Phase 4's `/api/show` work (PROV-06) | owner | 2026-10-12 |
| R-03-05 | T-03-39 | Prompt injection from a fetched page or a search result: inherent to the method and already present via material and library tools. The structural mitigation is unchanged — grading and node-locking live server-side in `actions.ts`, and both new tools are read-only | owner | 2026-10-12 |
| R-03-06 | T-03-54 | The method text retained in a provider's prompt cache: the stable prefix is Derive's own published method text plus the tool contract — no learner data, no key, no lesson content. The volatile tail carrying learner material is not marked cacheable | owner | 2026-10-12 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-12 | 65 | 65 | 0 | /gsd-secure-phase (orchestrator, L1 short-circuit) |

### Verification evidence (2026-10-12)

L1 grep-depth verification against the implementation, plus the phase's own suite:

- `pnpm test` — 396 tests, 94 suites, **396 pass / 0 fail**.
- Redirect posture (T-03-01, T-03-15, T-03-38): `noRedirectFetch` in `server/src/drivers/adapters.ts` (6 uses) with `redirect: 'manual'`; `server/src/search.ts` carries its own two.
- Grading stays server-side (T-03-02, T-03-45, T-03-50): `actions.runTool` is the only dispatch path; `validateToolInput` `safeParse`s the full zod schema in `server/src/drivers/api.ts` and `server/src/tools.ts` before it, and `recordToolResult` runs after.
- Error vocabulary (T-03-03, T-03-19, T-03-32): `safeMessage` (6 uses across `drivers/api.ts` and `secrets.ts`); provider sentences only from `probe.ts` `providerSentence`.
- Wallet caps (T-03-04, T-03-29, T-03-30, T-03-31): `stopWhen: isStepCount(stepCap())` with `STEP_CAP = 400`; `RETRY_WINDOW_MS`, `isRetryable` and `headroomCheck` all present.
- Nothing transient reaches the durable record (T-03-05, T-03-33, T-03-51, T-03-56): `reasoning-delta` discarded; the countdown is `emitEphemeral` only; `lastCost` appears nowhere outside `web/src/lib/useLesson.ts` (a Lesson.tsx comment explains why it is not read), and no phase-03 commit touched that file.
- Learner-editable input validated (T-03-09, T-03-10, T-03-62): `prices.json` validation and `pricesFileError()` in `server/src/prices.ts`; negative grep for `fetch(` over `prices.ts`/`pricing.ts` holds (T-03-11 — zero hits, as required).
- Replay and cross-provider safety (T-03-22, T-03-23, T-03-25): `INSERT OR IGNORE` in `db.ts`, `loadTurnMessages` driver comparison, `saveTurnMessages` reading `learner_id` off the lesson row.
- Migration 7 (T-03-26): present in `server/src/migrations.ts` with the runner's `VACUUM INTO` snapshot; `migrations.test.ts` covers both shapes.
- Search surface (T-03-36, T-03-37, T-03-40, T-03-41, T-03-42): `fetchPublic(` is the only fetcher (6 uses), `registerSecret` before every key write, `isLocalUrl` for the configured endpoint, one search affordance per turn, and the `verified` counter increments in `drivers/api.ts` (`verifies(part.toolName)`).
- Frozen contract (T-03-43, T-03-46, T-03-47, T-03-48): `server/test/wire-surface.json` committed (152 KB) with `wire-surface.test.ts` and the dialect-rules suite green.
- Write-only key field (T-03-58, T-03-59, T-03-60, T-03-63): `KeyField` reused in the web card, `lockedBy` 409 path in the server, `WebSearchCard.tsx` calls no `fetch` of its own and carries the explicit "no search of their own" sentence.
- Doctor stays quiet about secrets (T-03-61): `Price overrides` reports presence only, no read of the file.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-12
