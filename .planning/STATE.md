---
gsd_state_version: "1.0"
current_phase: 04
current_phase_name: Local Models, Parity Proof and Usage
status: executing
stopped_at: Completed 04-02-PLAN.md
last_updated: "2026-10-22T20:45:27.683Z"
last_activity: 2026-10-22
last_activity_desc: Phase 04 execution started
state_head: 9116cfe512452de146ff931df16ffeb7490e9715
progress:
  total_phases: 7
  completed_phases: 3
  total_plans: 43
  completed_plans: 40
  percent: 43
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-14)

**Core value:** A learner can sit down with any model they have access to and be taught the Derive way: the dependency graph, the understanding gate, the review loop, with nothing lost between providers.
**Simplicity rule (binding):** one screen, one next step. The default UI shows the lesson and what to do next; everything else lives behind Settings. No feature ships without a one-sentence reason tied to learning better.
**Current focus:** Phase 04 — Local Models, Parity Proof and Usage

## Current Position

Phase: 04 (Local Models, Parity Proof and Usage) — EXECUTING
Plan: 3 of 5
Status: Ready to execute
Last activity: 2026-10-22 — Phase 04 execution started

Progress: [████░░░░░░] 43%

## Performance Metrics

**Velocity:**

- Total plans completed: 38
- Average duration: -
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 22 | - | - |
| 02 | 7 | - | - |
| 03 | 9 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P02 | 45 min | 3 tasks | 5 files |
| Phase 01 P03 | 70 min | 3 tasks | 26 files |
| Phase 01 P04 | 14 min | 3 tasks | 5 files |
| Phase 01 P05 | 17 min | 3 tasks | 4 files |
| Phase 01 P06 | 25 min | 3 tasks | 11 files |
| Phase 01 P07 | 18 min | 3 tasks | 17 files |
| Phase 01 P08 | 52 min | 3 tasks | 12 files |
| Phase 01 P09 | 28 min | 2 tasks | 4 files |
| Phase 01 P10 | 4 min | 2 tasks | 5 files |
| Phase 01 P11 | 6 min | 2 tasks | 2 files |
| Phase 01 P12 | 8 min | 2 tasks | 0 files |
| Phase 01 P13 | 8 min | 2 tasks | 3 files |
| Phase 01 P14 | 41 min | 2 tasks | 8 files |
| Phase 01 P15 | 22 min | 2 tasks | 4 files |
| Phase 01 P20 | 116 min | 3 tasks | 7 files |
| Phase 01 P21 | 9 min | 2 tasks | 2 files |
| Phase 01 P22 | 14 min | 3 tasks | 6 files |
| Phase 02 P01 | 11 min | 2 tasks | 9 files |
| Phase 02 P06 | 10 min | 2 tasks | 9 files |
| Phase 02 P02 | 3 min | 2 tasks | 9 files |
| Phase 02 P03 | 11 min | 2 tasks | 6 files |
| Phase 02 P04 | 5 min | 3 tasks | 9 files |
| Phase 02 P05 | 3 min | 2 tasks | 8 files |
| Phase 02 P07 | 4min | 1 tasks | 5 files |
| Phase 03 P01 | 14 min | 2 tasks | 9 files |
| Phase 03 P02 | 22 min | 3 tasks | 6 files |
| Phase 03 P03 | 39 min | 2 tasks | 6 files |
| Phase 03 P04 | 28 min | 3 tasks | 13 files |
| Phase 03 P05 | 9 min | 3 tasks | 3 files |
| Phase 03 P06 | 30 min | 3 tasks | 16 files |
| Phase 03 P07 | 22 min | 2 tasks | 6 files |
| Phase 03 P08 | 42 min | 3 tasks | 11 files |
| Phase 03 P09 | 95 min | 3 tasks | 11 files |
| Phase 04 P01 | 25 min | 4 tasks | 18 files |
| Phase 04 P02 | 32 min | 3 tasks | 14 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Provider block order is fixed — contract and method, then seam/sink/ledger/migrations/hardening (all Phase 1), then settings and secrets (2), then the owned loop on API keys and gateways (3), then local models with the parity harness (4); cost display follows the ledger (per-lesson in 3, usage page in 4)
- [Roadmap]: Copilot and Gemini CLI drivers deferred to v2; in-app Claude uses an API key through the owned loop, the Claude Code plugin stays the subscription route (verify Anthropic and Google terms at Phase 2)
- [Roadmap]: Personalization (Phase 6) is independent of the provider block and may run in parallel with Phases 3–5; adoption (Phase 7) is last so docs describe the finished thing
- [Roadmap]: Learning-experience method changes (Phase 5) land after the conformance harness (Phase 4) so they are measured on every provider
- [Roadmap revision]: Simplicity rule applied on 2026-09-17 — streaks, daily goals, reminders, budgets, cost-per-node units, cache-savings display, capability badges, density, panel position and the voice picker moved to v2 (COST-08..10, LEARN-16/17, PROV-18, STYLE-07/08); Phase 4 keeps the usage page as a running total only, Phase 5 keeps the due count and a stability-coloured Atlas, Phase 6 keeps theme, font, size, reduced motion, tone and language
- [Phase 01]: Per-surface tool contract differences are declared in server/src/tools.ts under per_surface, and the wire-surface test asserts the declared set equals the shown set in both directions
- [Phase 01]: tools/list now emits registry declaration order; order is not the MCP contract, the tool set and every description are, and both are asserted against the pre-phase binary
- [Phase 01]: Method text: the canonical method is eleven Markdown sections under method/ plus four short per-surface preambles, rendered by pnpm method into six committed copies; pnpm method:check fails CI on any byte of drift
- [Phase 01]: The app surface leaves {{WEB_TOOLS}} unsubstituted at render time because the app runs on either backend; systemPrompt(backend) still substitutes it at runtime, now with replaceAll
- [Phase 01]: plugin/commands allowed-tools are projected from the registry in declaration order; the tool sets are unchanged (21 in learn.md, 15 in review.md, 22 on the mcp wire) and library stays excluded by name and reason
- [Phase 01]: Every driver runs behind Driver.runTurn(ctx, sink); the idempotent turn-end guard lives once in the sink (server/src/driver.ts), and a fake driver in server/src/drivers/fake.ts is the permanent proof that a new provider costs one runTurn and no change to the web app, the SSE stream or the terminal mirrors
- [Phase 01]: External lessons (mode 'external') stay outside the driver seam: they are driven by a terminal through the HTTP action route and the mirrors, and never reach runTurn
- [Phase 01]: Schema changes run through server/src/migrations.ts: numbered { version, name, up } entries on PRAGMA user_version, each applying inside a transaction that carries its own version bump; migration 1 is the old inline schema verbatim so an existing ~/.derive/derive.db and a fresh one converge on byte-identical DDL
- [Phase 01]: An existing database is snapshotted with VACUUM INTO as derive.db.bak-v<version left behind> before the first pending migration (WAL makes a raw file copy unsafe); a fresh database is never snapshotted and an existing snapshot is never overwritten
- [Phase 01]: withTx(fn) in server/src/db.ts is re-entrant via a depth counter, so deleteLearner looping over deleteLesson is one transaction; replaceGraph, deleteLesson and deleteLearner are now atomic
- [Phase 01]: The turns/usage column set was fixed as proposed: usage carries lesson, learner, driver and model denormalised, and recordUsage is the one write path that fills them from the turn
- [Phase 01]: Usage is a sink method, never an event, so the browser reducer, the SSE stream and the Obsidian mirror stay untouched
- [Phase 01]: A turn with no reported counts still gets a row: nulls and cost_source 'unknown', never an estimate
- [Phase 01]: The local server answers on 127.0.0.1 only behind a 0600 per-install token; /api/health is the one exemption, and Host plus a whole-string Origin allowlist close DNS rebinding and hostile pages
- [Phase 01]: Per D-09 the token is injected into the served index.html and read from the file by the MCP server, the plugin hook and the Vite dev proxy; no endpoint hands it out, and the stream route is the only place it may ride in the query string because EventSource cannot set a header
- [Phase 01]: Per D-12 DERIVE_HOST past loopback is an explicit opt-in that prints one loud startup warning and weakens no check; DERIVE_ORIGINS extends the browser allowlist
- [Phase 01]: VERSION is read once from server/package.json in server/src/config.ts and replaces five literals; root and server manifests now match plugin.json at 0.4.0, and @anthropic-ai/claude-agent-sdk is pinned to ^0.3.261 with the resolved version unchanged
- [Phase 01]: Per D-11 one exact-match redact() chokepoint covers every egress (emit, emitUpdate, checkpoint, emitEphemeral, renderMarkdown); the key-shaped pattern backstop is confined to errors and logs, and a test proves a key-shaped teaching example reaches the Obsidian vault byte-intact
- [Phase 01]: A registered secret must be at least 16 characters and empty, blank or short values are a silent no-op, because a tiny registered value would turn redaction into a text shredder that mangles lesson prose invisibly
- [Phase 01]: Redaction lives in events.ts at the fan-out rather than at each emit() caller, so the database, the SSE stream and the vault mirror all see the same already-clean payload and no future writer has to remember the rule
- [Phase 01]: Per D-10 assertPublicHost resolves the host and judges every answered address (loopback, unspecified, link-local including the metadata address, RFC-1918, CGNAT, multicast and reserved, ::1, fc00::/7, fe80::/10 and IPv4-mapped forms); library get() became fetchPublic(), a manual five-hop redirect loop that re-checks every hop
- [Phase 01]: Per D-10 repo import refuses / and ~ as roots, denies credentials, *.pem, *.key, id_*, .netrc, .npmrc, auth.json and .env* in both the walker and the collector, clones over https only with the check before the spawn, and caps and times out the GitHub tarball
- [Phase 01]: The human half of FOUND-04, one real lesson through the Claude Code plugin and one through the Codex skills, is recorded in 01-08-SUMMARY.md for the end-of-phase UAT harvest and was not performed in the plan
- [Phase 01]: Per 01-09 the install token never leaves the server process: the index.html injection is deleted and the browser is handed HMAC-SHA256(token, 'derive browser session v1') as an HttpOnly, SameSite=Strict derive_session cookie, registered as a secret; the x-derive-token header path for the MCP server, the plugin hook and the Vite dev proxy is unchanged
- [Phase 01]: Per 01-09 one guardLocal(c) runs the Host and Origin checks on every route — the document routes, serveStatic and the catch-all as well as /api/* — in a fixed order (health exemption, Host, Origin, credential) so a request failing both Host and credential is a 403
- [Phase 01]: Per 01-09 the allowed Host names are computed per request from the connection's own local address (c.env.incoming.socket.localAddress), never from the DERIVE_HOST string; the set seeds from DERIVE_ORIGINS and not ALLOWED_ORIGINS, because the built-in loopback origins would re-admit a forged Host: 127.0.0.1 from the LAN; 0.0.0.0, :: and [::] are refused as names everywhere
- [Phase 01]: Per 01-09 D-12 is literal: on a widened bind a non-loopback document request gets no cookie until it presents the install token once, and is answered with a 302 that drops the token from the URL
- [Phase 01]: assertPublicHost is imported into repo.ts rather than copied, accepting a real repo -> library -> materials -> repo import ring: two copies of a destination guard drift apart until one egress is weaker than the rest
- [Phase 01]: The https-only scheme check stays ahead of the host guard, and the host guard stays ahead of mkdtempSync, so a refusal keeps its own sentence and leaves no scratch directory
- [Phase 01]: A load-bearing import-ring condition is recorded at the line that would break it (library.ts:31), not only in the module that closes the ring
- [Phase 01]: deleteLesson and deleteLearner clear the turns and usage rows in the transaction they already open; the learner-scoped pair stays because recordUsage/startTurn denormalise learner_id, so a row can outlive its lesson row
- [Phase 01]: A per-lesson or per-learner table is not finished until the delete functions clear it and a case counts the rows; tx.test.ts compares whole row-count objects so a forgotten table shows up as a diff
- [Phase 01]: Per 01-12 every ✗ FAIL row of the verification's behavioural spot-check table was re-run with the verifier's own instrument (raw curl against server/dist/index.js on a scratch DERIVE_DATA_DIR, a direct collectRepo drive, a scratch-database row count) and reproduces as a pass; none was recorded as unrunnable
- [Phase 01]: Per 01-12 the widened-bind LAN pair was run for real on 192.168.0.166:4988 rather than inferred: an honest Host is admitted and a forged Host: 127.0.0.1 from that address is refused
- [Phase 01]: Per 01-12 the plugin and the Codex skills are NOT installed into the user's agent configuration by a plan; the documented invocations (claude --plugin-dir ./plugin, codex/skills/* into $CODEX_HOME/skills) are recorded in the human check instead
- [Phase 01]: Per 01-12 FOUND-04's human half (one lesson through the Claude Code plugin and one through the Codex derive-learn skill) is queued as HC-2 for the phase UAT and remains the phase's last open question
- [Phase 01]: Per 01-13 the repo-import token disclosure is closed at the importer, not by redaction: walk() and fromDirectory lstat the entry so a symlink is neither a file nor a directory, and every git ls-files candidate must realpath under realpathSync(dir) compared on the separator
- [Phase 01]: Per 01-13 the same lstatSync substitution closes the directory-symlink cycle (advisory finding 5) as a consequence rather than a second mechanism, and an out-of-tree candidate increments the existing skipped count so the number the UI shows stays honest
- [Phase 01]: Per 01-13 git clone is pinned with git config flags (http.followRedirects off, every protocol denied, https re-allowed) plus a disabled terminal prompt rather than a second copy of assertPublicHost, because git cannot re-check per hop the way fetchPublic does and two destination guards drift apart
- [Phase 01]: Per 01-13 the tarball and clone cases are source assertions, matching the suite's AbortSignal.timeout precedent: git has no outbound HTTP offline, so the honest claim is that the absence of the flags is the regression to catch, and no doc-comment clause claims a redirect is refused in practice
- [Phase 01]: Per 01-21 Gap 2 (FOUND-06) is closed by adding the pins rather than narrowing the sentence: fromGitClone's argv now carries the ssh-command, credential-helper, fsmonitor, hooks-path and pager pins beside its three transport flags and drops the machine's system config, so both git invocations in repo.ts have one machine-config posture — A clone is the path that opens a transport and can be asked for a credential, so those knobs belong on its argv; command-line -c is the one layer of git's config precedence a repository's own file cannot outrank, and five flags on a call that already carries three cost nothing
- [Phase 01]: Per 01-21 the gitListFiles rationale names which knobs ride on which argv AND names the three that ride on neither (check-in content filters, an external diff driver, the pack-objects hook) with the reason, because a sentence listing only what is handled reads as coverage — Naming six knobs and pinning five is the same defect as naming six and pinning one, one knob narrower; the omission is what drifted last time
- [Phase 01]: Per 01-21 the comment and the argv are held together by a case: argvOf slices from the execFileSync call, never from the function declaration, so the rationale comment is outside the slice by construction; the case was seen red with a pin removed and green with it restored — An assertion a comment can satisfy is not an assertion, and a gate that has not been seen failing is not known to be a gate
- [Phase 01]: Per 01-22 the one-time handoff ticket is deleted rather than repaired: server/src/tickets.ts, POST /api/handoff and the ?ticket= branch are gone, and the MCP server opens the bare lesson URL, so the /proc/<pid>/cmdline exposure is closed by construction instead of by a sixty-second lifetime — Five gap rounds each added a credential path and each manufactured the next round's blocker; the mcp.ts no-credential fallback already existed and was already documented as acceptable, so making it the only path shrinks the surface instead of growing it
- [Phase 01]: Per 01-22 the document middleware decides on a ?token= in the URL before the session cookie and the x-derive-token header: a match issues the session and 302s to the bare path even for an already-signed-in browser, a non-match is a 401, and both the cookie and the header pass straight through — The cookie short-circuit was what left the install token in a signed-in browser's address bar and what made four learner-facing sentences about renewing the cookie false; the header is a pass-through because there is nothing in a header to strip from a URL and redirecting it would let a header client loop
- [Phase 01]: Per 01-22 credentials() requires a non-negative cache age as well as one below TOKEN_CACHE_MS, so a backwards wall-clock step no longer suspends revocation; TOKEN_CACHE_MS, the forward boundary and the docstring are unchanged — The docstring already said the window is a bound and not an approximation; the code arrived at the sentence rather than the sentence being qualified away
- [Phase 01]: Per 01-22 no new security prose was written: .env.example, README.md and scripts/doctor.mjs are byte-identical, and every sentence touched was either deleted alongside its mechanism or was already true — A new claim is a new blocking condition for the next verification; delete-or-leave is the only safe move in a gap-closure round
- [Phase 02]: Per 02-06 detection is a probe of a JSON shape, never an open port: each local server is asked the one endpoint only it answers (Ollama /api/tags, LM Studio /api/v0/models, llama.cpp /health) and is found only when the body has that shape; a foreign process on a default port (FreqUI on 8080) reads not configured — 8080 and 1234 are the most reused developer ports; an open-port check lies on real machines
- [Phase 02]: Per 02-06 one awaited pass per POST /api/settings/detect (async claude auth status plus loopback probes in one Promise.all, 400 ms per probe) runs only when the page opens and on rescan; nothing polls, and the page paints stored config first with checking on unobserved rows — D-13 and the simplicity rule: first paint never waits on the CLI, and a background prober is a feature with no learning reason
- [Phase 02]: Per 02-06 a learner-typed base URL is normalised once at the write (http/https only, no credentials, no query or fragment, origin plus path with no trailing slash) and refused with the exact sentence otherwise; fixed-endpoint rows refuse a base URL outright — Every later probe and request joins a path onto the stored base, and a key must never ride a redirect or a credentialed URL to a third host
- [Phase 02]: Per 02-06 the settings page renders what GET /api/settings returns and hard-codes no provider fact; every field saves itself on the row (no page-level Save), and Use this provider is optimistic with a verbatim refusal and revert — One catalogue module is the source of truth (D-06); D-03 save-as-you-go
- [Phase 02]: Per 02-02 keys live in one plaintext 0600 secrets.json beside derive.db, written to a sibling temp file and renamed into place, read live behind a one-second cache, every loaded value registered for redaction; an absent file is the fresh install, an unreadable one is reported through secrets_error and never overwritten
- [Phase 02]: Per 02-02 the key API is write-only: rows answer { set, hint, locked } with hint the last four of a key at least eight long; an environment key (ENV_KEYS, Google before Gemini) locks its row with hint null and a 409 naming the variable on PUT and DELETE, and OLLAMA_HOST locks the Ollama address
- [Phase 02]: Per 02-02 remove is an inline two-step (remove the key · keep) with no dialog, the removed sentence says the process still redacts the value until restart, and the keep-the-current-key button swallows mousedown so blur-save cannot fire on the way to it
- [Phase 02]: Per 02-03 every provider call goes through one adapter table in probe.ts: requestFor puts the key in the header each provider reads (x-api-key + anthropic-version, x-goog-api-key, Bearer) and never in a URL, only to that row's catalogue host or the learner's stored base URL; getJson uses redirect: 'manual' and reports any 3xx as a failure sentence
- [Phase 02]: Per 02-03 a provider failure is `${status} ${sentence}` verbatim, collapsed to one line and cut at 300, and Derive's fix hint (401/402/429 and the refused-key shapes) is a separate field beside it; a host that never answered gets Derive's own sentence (`nothing answered at host:port` locally, `could not reach host: reason` remotely) and is never quoted as the provider's
- [Phase 02]: Per 02-03 local versus remote is judged on the literal host of the request URL with no lookup (isLocalUrl): it picks the 4 s / 8 s bound and the unreachable sentence, and decides nothing about whether the request is allowed
- [Phase 02]: Per 02-03 the model field is one native <input list> + <datalist> combobox whose list is empty until a fetch, so a failed fetch shows the provider's sentence under a field that still saves and no second control ever appears (D-08); the test result is one mono line with role=status, truncated with the full text in title, the hint on its own line
- [Phase 02]: Per 02-03 the suite never calls a real host: a loopback fakeProvider (good-key list with a duplicate, two-line 401, a 302, an HTML 200) covers the shared getJson path through the OpenAI-compatible row, the remote rows are asserted as pure request data, and every response body is checked for both keys
- [Phase 02]: Per 02-04 the header pill is a record of the turn, never the current setting: LessonState.tutor is seeded from lessonView.tutor after the event replay and replaced only by a turn_start payload carrying a provider string, so a change made in Settings shows on the next turn and never before (D-15, D-04)
- [Phase 02]: Per 02-04 external lessons get no second pill and no link: the existing companion pill grows to companion · {driver} · terminal model and stays a span, with the driver label codex cli for Codex (D-16, UI-SPEC A5)
- [Phase 02]: Per 02-04 the browser renders the provider as the catalogue id with dashes read as spaces while the plugin sentence keeps the raw id; neither side carries a provider table
- [Phase 02]: Per 02-04 the doctor's Secrets file line treats absence as ok, skips the mode on win32 and never opens the file, so no key or fragment of one can reach the terminal; .env.example states only what config.ts and settings.ts do
- [Phase 02]: Per 02-05 the learner model tier sits inside chooseModel(provider, learnerId?) so DERIVE_MODEL stays first in one place: env > learner > settings > catalogue default, reported as modelSource 'learner'; currentTutor() and every read-only route are unchanged
- [Phase 02]: Per 02-05 GET /api/settings/active is the only learner-aware settings route (learnerOf(c)); an unnamed request resolves for the default learner so one learner's override never reaches another's answer, and start_lesson asks it with ?learner= for its own learner
- [Phase 02]: Per 02-05 the learner model id is a preference the tutor must not read: LearnerPrefs.model and cleanPrefs (200 chars, [A-Za-z0-9._:/-]) carry it through the unchanged PATCH path, preferencesSection and describePrefs render no line for it, and the suite asserts learnerProfile text lacks the id
- [Phase 02]: Phase 2 gap closure: the text-button 32px hit area lives only in ProviderRow's shared textButton constant; a button that hand-rolls its class string opts out silently, so the destructive confirm composes ${textButton} plus its rust override
- [Phase 02]: A Tailwind 4 colour class compiles to nothing unless @theme declares the token: hover:text-rust-300 was inert with no build error, so hover feedback is checked against the emitted CSS, not the source
- [Phase 03]: Per 03-01 the fourteen tutor tools are dispatched from one place: actions.ts exports TUTOR_TOOL_HANDLERS and runTool, agent.ts buildTools calls it and its local handlers record is gone, so the Claude driver and the owned loop cannot offer a different fourteen — tools.ts's own module header records that the tutor's tools used to be written out three times and the copies had already drifted; a drifting copy is a drifting tutor
- [Phase 03]: Per 03-01 Driver.name on the owned loop is the catalogue ProviderId (apiDriverFor(provider)), never the literal 'api', and apiDriver's name is a getter over currentTutor().provider — providerOfDriver is the identity outside 'claude', lessonView feeds it to the header pill and recordUsage denormalises turn.driver onto every usage row, so one driver named api would collapse five providers into one label in the ledger and in front of the learner
- [Phase 03]: Per 03-01 usage.input_tokens on the owned loop is mapped from usage.inputTokenDetails.noCacheTokens, one row per finish-step, with cost_usd null and cost_source 'unknown' until the pricing table arrives — usage.inputTokens is a total that already includes cache reads and writes, where this repo's input_tokens column means the uncached part; mapping the total would make a well-cached lesson read as roughly twice the input it paid for
- [Phase 03]: Per 03-01 a tool-serialisation assertion must be seen failing with the chain removed: the first version passed either way because every tutor action is synchronous, so two blocking ask cards are what proves it — An assertion the mechanism's absence can satisfy is not an assertion, and a gate that has not been seen failing is not known to be a gate (the project's own 01-21 rule)
- [Phase 03]: Per 03-03 Adapter.cost takes a fourth parameter, the loop's count of provider-executed search tool calls, because the three-parameter type the plan declared cannot express the plan's own fallback — Anthropic's metadata count is preferred and the loop's count stands behind it, and the charge is folded into that request's cost_usd through cost.ts's costOf rather than given a column
- [Phase 03]: Per 03-03 an adapter's table fallback prices through cost.ts's costOf with a synthesised ledger row rather than re-implementing the per-token arithmetic — a second copy is how a request's figure starts disagreeing with the lesson total printed beside it, and costOf's rules (unknown for a model the table lacks, no money for four null counts) come for free
- [Phase 03]: Per 03-03 the catalogue now has seven teaching rows, not the six the plan's gate asserted: the four key-and-gateway flips plus claude-code, codex and anthropic; no row was demoted to satisfy the wrong number
- [Phase 03]: Per 03-03 the openai-compatible row refuses with 'Choose a model for the endpoint first' when no model id resolves, because it is the one teaching row the catalogue carries no default for and an empty id would come back as somebody else's 400
- [Phase 03]: Per 03-03 a model that silently lost all fourteen tools is a refusal, not a status line: the @ai-sdk/google unsupported-combination warning ends the turn ok false with a lowercase Derive sentence and persists no prose, because teaching with no tools is not teaching
- [Phase 03]: Per 03-03 every new gate was seen failing with its mechanism removed before being kept (the refusal short-circuited, the per-lesson chain removed, the dotted OpenRouter slug restored to dashes), following the project's own 01-21 rule
- [Phase 03]: 03-05: the retry window bounds the waiting the loop chose, not the wall clock — a provider's own latency is slowness, not busyness, and must not be charged against the learner's patience
- [Phase 03]: 03-05: a Retry-After of zero falls through to the jittered backoff, because 'retry immediately' from a provider that just said it was busy is how a rate limit becomes a tight loop
- [Phase 03]: 03-05: the countdown ticks once per whole second of the delay rather than polling the clock, so the number the learner reads and the time actually waited are the same number
- [Phase 03]: 03-05: three endings keep three shapes — a Stop and the step cap are continuable ({ ok: true, interrupted: true }), the context refusal is failed ({ ok: false, error })
- [Phase 03]: 03-05: the refusal card names Home as a link and adds no button, because api.startReview() builds from the due queue across every lesson rather than from this lesson's nodes
- [Phase 03]: 03-05: setSleepOverride is the only seam into the wait, in the same posture as setModelOverride — no route, header, environment variable or config file reaches it
- [Phase 03]: Web search is native where the provider has one (Anthropic, OpenAI, Gemini 3+) and a pluggable fallback otherwise (Tavily or SearXNG); exactly one search source is registered per turn, so the tutor is never offered two ways to search
- [Phase 03]: Derive's own loop is a fourth tool surface, 'api', carrying the fourteen tutor tools plus fetch_page and web_search; the agent (14), mcp (22) and http (16) surfaces are byte-unchanged and the wire-surface fixture gained only the new api key
- [Phase 03]: fetch_page is one tool on library.ts's fetchPublic plus assertPublicHost — no second fetcher, no second SSRF guard, no second byte cap
- [Phase 03]: The learner's configured SearXNG address is deliberately NOT run through assertPublicHost (a local instance is the normal case); the guard is applied to the result URLs the tutor then fetches, and the json-disabled failure gets its own sentence naming settings.yml
- [Phase 03]: searchMode(provider, modelId) is the one three-way decision the tool registration and the {{WEB_TOOLS}} rendering both read, so the method text and the tool set cannot disagree; a selected-but-unconfigured fallback counts as no search at all
- [Phase 03]: systemPrompt takes a WebSurface rather than a two-value backend; the api/none rendering tells the tutor to admit uncertainty rather than guess, with method/ and method.generated.ts byte-unchanged
- [Phase 03]: io stays at zod's default 'output' in jsonSchemaOf: io 'input' is semantically right for a tool input schema but drops additionalProperties: false from all 24 tools on all four surfaces, which both moves the frozen fixture and removes the one keyword OpenAI's strict mode requires
- [Phase 03]: The strict dialect ships built and CI-validated and selected by no adapter row: strict mode is opt-in per tool and would cost the four bounds set_plan (3-12 nodes) and quiz (2-3 options) hold the model to, so Phase 4's conformance harness switches it on and measures rather than inventing it
- [Phase 03]: The Gemini dialect is an allow-list of six keywords rather than a deny-list, because its exact rejected set is LOW confidence: an allow-list is wrong only in the safe direction and drops a keyword a future registry row introduces automatically
- [Phase 03]: Validation is against the full zod schema at the boundary that writes, never against the dialect the provider was shown: the SDK's jsonSchema() carries no validator unless the caller supplies one, so before this the registry's bounds were documentation on the api surface rather than enforcement
- [Phase 03]: The lesson's cost is one server-computed string: lessonCost() over the lesson's usage rows, formatted once by cost.ts's costLabel, carried on the lesson view, on every GET /api/lessons row and on every ending of a turn — so the header pill and the Home row can never show different numbers
- [Phase 03]: D-06's prompt cache split is additive: TurnContext gains instructionsStable and instructionsVolatile beside the unchanged instructions, so the Claude and Codex drivers are untouched; Anthropic's ephemeral breakpoint rides the stable prefix through a per-row Adapter.cacheHook and the other four rows attach nothing on purpose
- [Phase 03]: An ending's lesson total counts the blank unknown row closeUsage is about to write, because a payload is built before sink.endTurn runs — without it a stop before the provider answered reported 'estimated' while both screens said 'not reported' a moment later
- [Phase 03]: 03-09: SearchView on the web mirrors what searchView() actually sends (key {set,hint} beside key_locked), and api.setSearch answers that block rather than the whole Settings object — the card composes the two where KeyField needs them instead of reshaping a route 03-06 already smoke-tested
- [Phase 03]: 03-09: the field vocabulary (field, pill, textButton, tickLine, errLine, noteLine, blurOnEnter, useTick) has one definition in web/src/components/fields.ts, and the one site that needs more composes it (ml-auto gap-1.5 ${textButton}) rather than restating the string
- [Phase 03]: 03-09: KeyField is exported from ProviderRow.tsx parameterised on its two writes, so the search key reuses the masked write-only machine including the keep button's mouse-down guard; fields.ts stays JSX-free and the component count stays 13 plus one new card
- [Phase 03]: 03-09: no lock sentence on the SearXNG address field, because no environment variable sets that address — a branch for a variable that does not exist would claim a feature the code does not have
- [Phase 03]: 03-09: the API suite serves the real routes inside its own process (startInProcessServer in server/test/spawn.ts), capturing the listening socket from node:http with syncBuiltinESMExports so it can be closed — because setModelOverride is reachable from nowhere else and index.ts's startup side effects must not change to suit a test
- [Phase 04]: ai-sdk-ollama is pinned to 4.4.0, not latest: 4.4.0 peers ai ^7.0.103 which this repo's pinned ai@7.0.126 satisfies, where 4.5.x peers ^7.0.137 and does not; the owner approved the install after the SUS too-new verdict was rebutted signal by signal (SLSA provenance on 4.4.0, 14.5 months old, no install scripts)
- [Phase 04]: 04-01: Ollama is the only local row Derive sends a window to. options.num_ctx is the whole reason that row is not on the OpenAI-compatible route, which carries no options object and so silently accepts Ollama's 4,096-token default and truncates the method's gate text; D-05 leaves LM Studio and llama.cpp serving whatever their server was started with, and plan 04-02's capability read supplies their window to headroomCheck
- [Phase 04]: 04-01: amendment A-01 is in code as two constants and the test measured the arithmetic that forced the split — NUM_CTX_FLOOR 16384 is D-04's refusal floor, NUM_CTX_DEFAULT 32768 is the editable field's default, because 0.8x16384 leaves about eleven estimated tokens over the measured ~13,096-token prompt floor and the learner's own first message is what pushes a floor-sized window over
- [Phase 04]: 04-01: headroomCheck now counts the serialised tool projection the request will actually carry, in the same surface-and-dialect pair it goes out in — a fifth of a 16k window it was blind to — and takes a caller-resolved window that outranks the price table, because an observation beats a listing; neither source carrying one still abstains
- [Phase 04]: 04-01: a refusal sentence and its one link are one unit — two constants with one link each, never one parameterised sentence. The num_ctx fix is on the model's row in Settings and the lesson-growth fix is a review lesson from Home, so Lesson.tsx picks from an ordered table with Settings checked first because that fix is on this turn
- [Phase 04]: 04-01: every catalogue row now teaches, so the unwired note helper is deleted with its last caller and no row is left for the teaches-false branch to exercise — the three cases that used one now drive the identical providerOf(stored) teaches path through an id this build does not carry, which is also the real case: a settings row can outlive the build that named its provider

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2]: Gemini CLI third-party terms are MEDIUM confidence; re-verify if that driver ever leaves v2 (the Anthropic half is settled — in-app Claude runs on an API key, the plugin keeps the subscription)
- [Phase 3]: Two advisory reports are open and carried forward, not closed: `03-REVIEW.md` (`issues_found`) and `03-UI-REVIEW.md` (15/24 — chiefly the cost segment squeezing the lesson topic to 0px in the header at 1024px, Home's rows overlapping at 375px, the web-search card telling a default Claude Code install it has no search, and a 23px radio hit area against the 32px rule)
- [Phase 4]: No measurement yet of which local models pass the understanding gate; the harness produces the answer
- [Phase 4]: Two Phase 3 deferrals are owed here, both named with their seam in `03/deferred-items.md`: the Ollama search backend (`SEARCH_PROVIDERS` in `server/src/search.ts`, one entry plus one function — PROV-09's third backend) and lifting `/you`'s field string onto the shared `fields.ts` vocabulary
- [Phase 7]: npm package name not yet reserved (`derive` is taken)
- Phase 4: research assumption A7 is still open — whether think:false is accepted by every tool-capable Ollama model without breaking tool calling cannot be settled without a local server; plan 04-04's conformance harness is the detector and should carry think as a harness variable

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260923-bus | fix GitHub issue 10: update pnpm from 10.33.2 to 12.5.1 and move onlyBuiltDependencies to pnpm-workspace.yaml allowBuilds | 2026-09-23 | f041709 | [260923-bus-fix-github-issue-10-update-pnpm-from-10-](./quick/260923-bus-fix-github-issue-10-update-pnpm-from-10-/) |

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-10-22T20:45:27.594Z
Stopped at: Completed 04-02-PLAN.md
Resume file: None
