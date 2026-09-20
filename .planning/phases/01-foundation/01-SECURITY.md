---
phase: "01"
slug: "foundation"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-20"
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Register origin: authored at plan time. 21 of the phase's 22 plans carry a
`<threat_model>` block; plan 01-22 removes surface (`POST /api/handoff`, the `?ticket=`
credential branch) and adds none, so it registers no new threat. Verification depth is
ASVS L1 (`workflow.security_asvs_level: 1`); the blocking threshold is
`workflow.security_block_on: high`.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| any local process or browser tab → HTTP API | every `/api` route but health requires the per-install bearer token; the server binds loopback unless `DERIVE_HOST` widens it | lesson content, learner profile, usage ledger |
| network interface → server | `serve()` binds loopback by default; a widened bind keeps the token mandatory and warns loudly at startup | all API traffic |
| browser document → API credential | document routes are Host- and Origin-checked; the browser session is an HMAC cookie, minted only on a loopback-verified request | `derive_session` cookie |
| token file → consumers | `~/.derive/token` at 0600, read live per request (one-second window); the stdio MCP server and the plugin hook each read once at their own start | the install token |
| learner-supplied URL / repo → server | SSRF guard (`assertPublicHost`), `https://`-only clone, hardened git argv, symlink and secret-name filters on the import walk | fetched pages, cloned trees |
| provider transcript → event log / vault | one redaction chokepoint (`registerSecret` / `redact` / `redactErrors`) on every event, export and error body | model output, error text |
| npm registry → build | no dependency added across the phase; every `T-*-SC` row is a no-install assertion | `pnpm-lock.yaml` |
| migration → learner database | each migration applies inside a transaction; a pre-migration snapshot is written under `DATA_DIR` | `~/.derive/derive.db` |

---

## Threat Register

167 threats, all closed. Full mitigation prose lives in each plan's `<threat_model>`
block; the Mitigation column here is its first clause.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | tampering | `POST /api/external/lessons/:id/node_status` body | medium | mitigate | D-06 `safeParse` against the registry shape before any method logic; unknown `status` values are rejected 400 instead of being… | closed |
| T-01-02 | tampering | `server/test/wire-surface.json` | medium | mitigate | the fixture is regenerated from the registry in the test, so a hand-edited fixture that does not match the code fails; a code… | closed |
| T-01-03 | information disclosure | tool descriptions in the snapshot | low | accept | descriptions are the teaching method's model-facing text; they contain no secret and D-08 deliberately stores them in full so… | closed |
| T-01-04 | denial of service | zod parse of a large action body | low | accept | the body is already read whole by Hono before this plan; parsing cost is bounded by the existing body size and unchanged by… | closed |
| T-01-05 | repudiation | a silent contract change | medium | mitigate | any change to a name, description or schema fails `server/test/wire-surface.test.ts` and must appear as a fixture diff in the… | closed |
| T-01-SC | tampering | npm/pip/cargo installs | high | mitigate | this plan adds no dependency; `server/package.json`, `package.json` and `pnpm-lock.yaml` are not modified. A package-legitimacy… | closed |
| T-02-01 | tampering | `POST /api/external/lessons/:id/:action` body | high | mitigate | D-06 `safeParse` against the registry shape for every tool-backed action, before method logic; `set_plan` with a non-array… | closed |
| T-02-02 | elevation of privilege | unknown body keys reaching an action handler | medium | mitigate | the handler reads only the parsed value for tool fields; the four non-schema keys it reads (`answer_in`, `already_held`,… | closed |
| T-02-03 | information disclosure | zod issue text in a 400 body | low | mitigate | the 400 carries only the tool name, the issue path and zod's message; no request body, no file path and no environment value is… | closed |
| T-02-04 | spoofing | any local process calling the action route | high | transfer | out of scope for this plan by the phase's fixed internal order; closed in plan 01-07 by loopback binding, Host/Origin checks and… | closed |
| T-02-05 | denial of service | the stdio smoke test hanging CI | low | mitigate | the JSON-RPC helper carries a per-call timeout that fails with a readable sentence, and both children are killed in `after` | closed |
| T-02-SC | tampering | npm/pip/cargo installs | high | mitigate | this plan adds no dependency; manifests and `pnpm-lock.yaml` are untouched. If execution finds it needs a new package, stop and… | closed |
| T-03-01 | tampering | `method/*.md` as model instructions | high | mitigate | every rendered copy is committed and `pnpm method:check` fails CI on drift (D-04), so a change to what any model is told appears… | closed |
| T-03-02 | tampering | `scripts/render-method.mjs` write targets | medium | mitigate | the script writes only to an explicit, enumerated list of target paths under the repo root, resolved from `import.meta.url`; it… | closed |
| T-03-03 | repudiation | CI auto-regenerating the copies | medium | mitigate | D-04 is explicit that CI fails rather than regenerating and pushing; the CI step runs `check`, never `render`, and the… | closed |
| T-03-04 | information disclosure | the render temp directory | low | mitigate | `scripts/check-method.mjs` uses `mkdtempSync` under the system temp dir and removes it; it writes no repository content anywhere… | closed |
| T-03-05 | elevation of privilege | generated `allowed-tools` widening the plugin's capability | high | mitigate | the rendered lists are asserted byte-equivalent to the committed ones by set comparison, exclusions carry reasons, and an… | closed |
| T-03-SC | tampering | npm/pip/cargo installs | high | mitigate | this plan adds no dependency; the scripts run on bare Node with only `node:` imports. If execution finds it needs a package,… | closed |
| T-04-01 | tampering | `setDriverOverride` | medium | mitigate | the override is set only from test code and is never wired to an environment variable, a request header or a config file; the… | closed |
| T-04-02 | spoofing | an event emitted outside the sink | medium | mitigate | after task 3 the only turn-end emitter inside the seam is the sink; the verify step greps both driver files for it | closed |
| T-04-03 | information disclosure | provider text reaching the event log | high | transfer | the single sink is exactly the chokepoint plan 01-08 wires redaction into; concentrating every driver's output here is what… | closed |
| T-04-04 | denial of service | a driver that never resolves | medium | accept | unchanged from today — the SDK's own timeouts and the learner's Stop are the controls; the `active` map and `interrupt()` still… | closed |
| T-04-05 | repudiation | a turn with no turn_end | medium | mitigate | the sink's idempotent guard plus the existing finally block guarantee exactly one `turn_end`; the fake-driver test asserts it… | closed |
| T-04-SC | tampering | npm/pip/cargo installs | high | mitigate | this plan adds no dependency; manifests and `pnpm-lock.yaml` are untouched. If execution finds it needs a package, stop and… | closed |
| T-05-01 | tampering | `PRAGMA user_version` interpolation | high | mitigate | the interpolated value comes only from a migration record's `version` field and is validated as a non-negative integer before… | closed |
| T-05-02 | denial of service | a half-applied migration | high | mitigate | each migration applies inside a transaction that also carries the version bump, and a failure rolls back, logs `[migrate]` and… | closed |
| T-05-03 | tampering | orphan rows from a crashed delete | medium | mitigate | `withTx` around `deleteLesson`, `replaceGraph` and `deleteLearner` | closed |
| T-05-04 | information disclosure | the snapshot file | medium | mitigate | the snapshot is written inside `DATA_DIR`, which already holds the database itself, and inherits the same directory; no snapshot… | closed |
| T-05-05 | denial of service | unbounded snapshot growth | low | accept | one snapshot per version left behind, never overwritten, and the version count grows with releases, not with use | closed |
| T-05-SC | tampering | npm/pip/cargo installs | high | mitigate | this plan adds no dependency; the runner uses only `node:sqlite`, already a built-in. If execution finds it needs a package,… | closed |
| T-06-01 | information disclosure | usage data leaving the machine | high | mitigate | usage is written only through `recordUsage` into the local SQLite file; it is deliberately not an event (D-14), so it cannot… | closed |
| T-06-02 | tampering | a provider over-reporting or under-reporting counts | medium | accept | the provider's own figure is what COST-01 asks to store; Derive records what was reported and labels the source, and… | closed |
| T-06-03 | repudiation | a turn with no usage row | medium | mitigate | D-16's completeness rule, enforced in the sink's end guard and in the external `end` action, and asserted by… | closed |
| T-06-04 | tampering | fabricated token counts | high | mitigate | estimation from transcript length or any proxy is prohibited; an unreported count is null with `cost_source` `unknown`, which is… | closed |
| T-06-05 | denial of service | the backfill pass over the event log | low | mitigate | it runs once, inside migration 2's transaction, and replaces a per-request scan of the same data; a failure rolls back under the… | closed |
| T-06-06 | information disclosure | a model id or cost figure in an error message | low | mitigate | the sink writes usage and does not surface it; error paths are covered by the redaction chokepoint in plan 01-08 | closed |
| T-06-SC | tampering | npm/pip/cargo installs | high | mitigate | this plan adds no dependency; manifests and `pnpm-lock.yaml` are untouched. If execution finds it needs a package, stop and… | closed |
| T-07-01 | spoofing | any web page calling the API from the browser | critical | mitigate | loopback bind, exact-match Origin allowlist, Host check, and a per-install bearer token on every `/api` route but health; a… | closed |
| T-07-02 | elevation of privilege | `POST /api/materials/repo` reachable without auth | critical | mitigate | the token middleware covers it; the remaining path and deny-list hardening for that route lands in plan 01-08 | closed |
| T-07-03 | information disclosure | the token itself | high | mitigate | written 0600, never returned by any endpoint, never logged, never emitted as an event, never exported;… | closed |
| T-07-04 | spoofing | DNS-rebinding against localhost | high | mitigate | the `Host` header must name a loopback host on the server's own port, which is what defeats a rebind that keeps the Origin… | closed |
| T-07-05 | elevation of privilege | `DERIVE_HOST=0.0.0.0` widening exposure | high | mitigate | opt-in only through an environment variable set by the operator, the token stays mandatory, the Origin allowlist is extended… | closed |
| T-07-06 | information disclosure | the token injected into `index.html` | medium | accept | the app's own document is the intended consumer and cannot be read cross-origin now that Origin is checked and CORS is scoped;… | closed |
| T-07-07 | denial of service | a wrong token in a hot loop | low | accept | local-only surface; the comparison is constant-time over equal-length buffers and the failure is a cheap 401 | closed |
| T-07-SC | tampering | npm/pip/cargo installs | high | mitigate | no package is added. The only manifest change is narrowing `@anthropic-ai/claude-agent-sdk` from a floating tag to `^0.3.261`,… | closed |
| T-08-01 | information disclosure | a secret in an event, an export or the vault mirror | critical | mitigate | one exact-match `redact` chokepoint applied in `emit`, `emitUpdate`, `emitEphemeral` and `renderMarkdown`, with the install… | closed |
| T-08-02 | information disclosure | a secret in an error body or a log line | critical | mitigate | `redactErrors` on every catch-built `{ error }` body and every `[tag]` console line, adding the key-shaped pattern backstop on… | closed |
| T-08-03 | information disclosure | SSRF through the library fetch | high | mitigate | host resolution with loopback, link-local, metadata, RFC-1918, CGNAT and unique-local refused, re-checked on every redirect hop… | closed |
| T-08-04 | information disclosure | arbitrary local directory read through `/api/materials/repo` | high | mitigate | `/` and `~` refused as roots, secret-shaped filenames denied in both the collector and the walker, on top of the token… | closed |
| T-08-05 | elevation of privilege | `git clone` over ssh using the learner's keys | high | mitigate | scheme restricted to `https://` before the process is spawned (D-10) | closed |
| T-08-06 | denial of service | an unbounded GitHub tarball buffered and decompressed in memory | medium | mitigate | a timeout and a size cap checked before buffering, bounding the in-memory decompression that follows | closed |
| T-08-07 | tampering | over-broad redaction corrupting a lesson | high | mitigate | the pattern backstop is confined to errors and logs; events, exports and the vault mirror get exact match only; a minimum… | closed |
| T-08-08 | denial of service | redaction cost on every emitted event | low | mitigate | `redact` short-circuits on an empty registry and the registry holds one value today; the walk is over an… | closed |
| T-08-09 | spoofing | DNS rebinding between the guard's lookup and the fetch | medium | accept | a time-of-check-to-time-of-use window remains, as it does for any userland guard in Node; the residual risk is bounded by the… | closed |
| T-08-SC | tampering | npm/pip/cargo installs | high | mitigate | this plan adds no dependency; the guards use only `node:dns/promises` and `node:net`, both built in. If execution finds it needs… | closed |
| T-09-01 | information disclosure | the install token in the served `index.html` (`server/src/index.ts:975-980`) | critical | mitigate | the injection is deleted; the browser is handed `HMAC-SHA256(token, "derive browser session v1")` as an HttpOnly,… | closed |
| T-09-02 | spoofing | document routes served with no Host or Origin check | critical | mitigate | one `guardLocal(c)` shared by the `/api/*` middleware and a new document middleware covering `/`, `/index.html`, `serveStatic`… | closed |
| T-09-03 | spoofing | DNS rebinding to the loopback port from a page the learner has open | high | mitigate | the Host check now binds to the address the connection was accepted on, and `SameSite=Strict` keeps the session cookie off any… | closed |
| T-09-04 | elevation of privilege | a forged `Host: 127.0.0.1` from the LAN on a widened bind… | high | mitigate | allowed Host names are computed per request from `incoming.socket.localAddress`; `0.0.0.0`, `::` and `[::]` are refused as names… | closed |
| T-09-05 | elevation of privilege | a LAN browser obtaining a credential without ever holding the token | high | mitigate | on a non-loopback connection a document route issues no cookie unless the request presents the install token once; D-12's… | closed |
| T-09-06 | information disclosure | another local user harvesting the browser credential by requesting a document… | medium | accept | the cookie is not the install token and cannot be reversed to it, and the 0600 file is unchanged; a local user with shell access… | closed |
| T-09-07 | repudiation | a test that asserts a guarantee it does not exercise | high | mitigate | the suite doc comment is rewritten to match its cases; every new case drives the exact route the verifier reproduced against;… | closed |
| T-09-08 | denial of service | an HMAC computed per request | low | accept | `SESSION` is computed once at boot into a module constant; the per-request cost is one constant-time buffer compare, as today | closed |
| T-09-SC | tampering | npm/pip/cargo installs | high | mitigate | this plan adds no dependency: `createHmac` is `node:crypto` and `setCookie`/`getCookie` are `hono/cookie`, already in the tree.… | closed |
| T-10-01 | information disclosure | SSRF to loopback, RFC-1918, link-local or CGNAT through `fromGitClone`… | high | mitigate | `await assertPublicHost(url)` before `mkdtempSync` and before the git spawn, so the clone path runs the same resolved-address… | closed |
| T-10-02 | information disclosure | the cloud metadata endpoint (`169.254.169.254`) reached as a git host | high | mitigate | covered by the same guard, which already refuses link-local including the metadata address; asserted as its own case | closed |
| T-10-03 | spoofing | a hostname that resolves to a private address slipping past a name-based check | high | mitigate | `assertPublicHost` resolves the name and judges every answered address; a `localhost` case pins that this is resolution and not… | closed |
| T-10-04 | elevation of privilege | `git clone` over ssh using the learner's own keys | high | mitigate | unchanged and still first: the https-only scheme check runs before the host guard, keeping its existing sentence | closed |
| T-10-05 | repudiation | a suite green over a guarantee it does not exercise | high | mitigate | the doc comment is rewritten to match the cases, and each new case asserts both the rejection and that no `clone-` scratch… | closed |
| T-10-06 | spoofing | DNS rebinding between `assertPublicHost`'s lookup and git's own resolution | medium | accept | a time-of-check-to-time-of-use window remains, as it does for any userland guard in Node and as plan 01-08 already recorded for… | closed |
| T-10-08 | repudiation | a load-bearing import-ring constraint that exists only in this plan's prose | medium | mitigate | the ring is recorded at both ends of itself — a comment at `repo.ts`'s new import and one at `server/src/library.ts:31` where a… | closed |
| T-10-07 | denial of service | a clone that never finishes | low | accept | the existing 120-second `execFileSync` timeout is unchanged and already bounds it | closed |
| T-10-SC | tampering | npm/pip/cargo installs | high | mitigate | this plan adds no dependency; `assertPublicHost` already exists in the tree and uses only `node:dns/promises` and `node:net`. If… | closed |
| T-11-01 | information disclosure | a removed learner's model ids, driver names and token counts surviving in… | medium | mitigate | learner-scoped deletes of both tables inside `deleteLearner`'s existing transaction, asserted by a whole-table count after the… | closed |
| T-11-02 | repudiation | doc comments promising complete deletion that the code does not perform | medium | mitigate | both comments rewritten to list the tables they clear; the acceptance criteria check the table names are named | closed |
| T-11-03 | tampering | a delete scoped to one lesson reaching another lesson's rows | high | mitigate | every statement filters on `lesson_id` or `learner_id` with a bound parameter and no string interpolation; an adjacency case… | closed |
| T-11-04 | tampering | a partial delete leaving a usage row pointing at a removed turn | medium | mitigate | both deletes run inside the `withTx` the functions already open, usage before turns; the existing RAISE-trigger failure cases… | closed |
| T-11-05 | denial of service | unbounded growth of `turns` and `usage` on a long-lived install | low | mitigate | deletion now reclaims them; no sweep or retention policy is added, which would be a product decision rather than a gap fix | closed |
| T-11-06 | tampering | a well-meant backfill or cleanup destroying rows the learner did not ask to… | high | mitigate | explicitly prohibited: this plan adds no migration, no sweep and no backfill, and `PRAGMA user_version` stays at 3 — asserted in… | closed |
| T-11-SC | tampering | npm/pip/cargo installs | high | mitigate | this plan adds no dependency; it is four SQL statements and test cases on the built-in `node:sqlite` and `node:test`. If… | closed |
| T-12-01 | repudiation | a spot-check recorded as passing without being run | high | mitigate | every row is recorded with the command and its observed output, and a row that cannot run on this machine is recorded with its… | closed |
| T-12-02 | denial of service | the authentication change breaking the plugin or Codex header path | high | mitigate | `mcp.test.ts` drives the built stdio server through a whole lesson and `wire-surface.test.ts` pins all three surfaces; both are… | closed |
| T-12-03 | tampering | a reproduction run against the learner's real `~/.derive` | medium | mitigate | every command in task 1 uses a scratch `DERIVE_DATA_DIR`; only the human run touches the real database, and it does so by using… | closed |
| T-12-04 | information disclosure | the install token pasted into a summary or a log while recording evidence | high | mitigate | the reproductions record status codes and match counts, never the token value; `registerSecret` already redacts it from errors… | closed |
| T-12-05 | elevation of privilege | a second server left listening on `0.0.0.0` after the widened-bind reproduction | medium | mitigate | both spawned servers are killed as the task ends and the summary records that the port is free again; the wide server uses a… | closed |
| T-12-SC | tampering | npm/pip/cargo installs | high | mitigate | this plan adds no dependency and installs nothing; it runs `pnpm build`, `pnpm test` and `curl` against what the previous plans… | closed |
| T-13-01 | information disclosure | `walk()` / `fromDirectory` read loop following symlinks (`server/src/repo.ts`… | critical | mitigate | `lstatSync` at both call sites makes a symlink neither a file nor a directory, so both branches fall through; asserted by a… | closed |
| T-13-02 | information disclosure | a symlinked *intermediate* directory on the `git ls-files` path, which a leaf… | high | mitigate | every candidate is resolved with `realpathSync` and required to stay under `realpathSync(dir)`, compared on the path separator… | closed |
| T-13-03 | denial of service | `walk()` recursing into a directory symlink that points at its own ancestor,… | medium | mitigate | closed by the same `lstatSync` substitution — a directory link is no longer a directory to recurse into; asserted by a case that… | closed |
| T-13-04 | information disclosure | `fromGitHub`'s tarball filter omitting `isSecretName`, so `auth.json`,… | medium | mitigate | the predicate is added so both filter chains read the same three terms; asserted by a source assertion, the pattern this suite… | closed |
| T-13-05 | spoofing | `git clone` following a redirect from the judged public URL to `10.0.0.5` or… | high | mitigate | the clone argv carries redirect-following off, all protocols denied and https re-allowed; asserted by a source assertion, with a… | closed |
| T-13-06 | denial of service | a credential prompt from `git` holding the request open for the full… | low | mitigate | `GIT_TERMINAL_PROMPT=0` on the spawn env, alongside the existing `timeout` | closed |
| T-13-07 | tampering | an import that silently drops files the learner meant to include, with no signal | low | accept | a skipped entry already increments the existing `skipped` count the importer returns and the UI shows; no new silent-drop path… | closed |
| T-13-SC | tampering | npm/pip/cargo installs | high | mitigate | this plan adds no dependency: `lstatSync`, `realpathSync` and `symlinkSync` are all `node:fs`, already imported in these files'… | closed |
| T-14-01 | elevation of privilege | the loopback document route issuing a working API credential to a caller that… | high | mitigate (branch A) / accept (branch C) | Branch A deletes the address-keyed early return so every document request presents the token once and holds an HttpOnly cookie;… | closed |
| T-14-02 | elevation of privilege | the fail-open at `server/src/index.ts:1093`, where an unknown local address… | high | mitigate | under branch A the condition is deleted outright; under branch C its polarity is inverted to match `hostNames`. Either way no… | closed |
| T-14-03 | information disclosure | `c.redirect(c.req.path)` as a protocol-relative off-site redirect, and an… | medium | mitigate | the path is resolved against a fixed base and only its `pathname` is used as `Location`; asserted by a case that requests a… | closed |
| T-14-04 | information disclosure | `/api/health` exempt from `guardLocal` entirely rather than from the… | medium | mitigate | `guardLocal` runs on health and only the credential step is skipped; asserted by health returning 200 with no credential, 403… | closed |
| T-14-05 | information disclosure | a token accepted in the query string on the lesson stream, landing in server… | medium | mitigate | the term is deleted once its only caller is gone; asserted by a stream request carrying a token only as a query parameter being… | closed |
| T-14-06 | denial of service | the Host check requiring an explicit port, so `PORT=80` or `PORT=443` refuses… | low | mitigate | an absent port part is judged against the scheme default; a present one still has to match exactly | closed |
| T-14-07 | spoofing | DNS rebinding to the loopback port from a page the learner has open | high | mitigate | unchanged and already correct — the Host check binds to the address the connection was accepted on, `SameSite=Strict` keeps the… | closed |
| T-14-08 | repudiation | a suite doc or a source comment stating a guarantee no case or line can be… | high | mitigate | every clause of the three statements is mapped to a case or a line, and the mapping is written into the SUMMARY; the standing… | closed |
| T-14-09 | information disclosure | another local user reading the `Set-Cookie` off a document response | medium | mitigate (branch A) / accept (branch C) | branch A requires the 0600 file to be readable first, which is the same control the rest of the machine already depends on;… | closed |
| T-14-10 | tampering | branch A breaking `/derive:learn` silently by opening a companion page that… | high | mitigate | `server/src/mcp.ts` appends the token it already holds to the URL it opens; the stdio smoke suite stays green and the… | closed |
| T-14-SC | tampering | npm/pip/cargo installs | high | mitigate | this plan adds no dependency: `createHmac` is `node:crypto` and `setCookie`/`getCookie` are `hono/cookie`, both already in the… | closed |
| T-15-01 | repudiation | the boot sweep closing turns without a usage row, so turn counts and usage… | medium | mitigate | `closeUsage` is called for every swept row inside `closeOpenTurns`' existing transaction; `tx.test.ts` asserts the whole… | closed |
| T-15-02 | tampering | a second usage row written for a turn that already reported, inflating the… | low | mitigate | `closeUsage` returns early when the turn has usage; the new case drives that path explicitly rather than assuming it | closed |
| T-15-03 | repudiation | a requirement status recorded as complete on prose rather than on evidence | medium | mitigate | the verification report's Requirements Coverage table is named as the authority, the prose/table discrepancy over FOUND-05 and… | closed |
| T-15-04 | repudiation | a human-only check silently promoted to done | high | mitigate | HC-1 and HC-2 are `<verify><human-check>` entries carrying the verifier's own scripts; the `Needs Human` grep gate fails if… | closed |
| T-15-05 | tampering | a whole-file rewrite of `.planning/ROADMAP.md` dropping phase entries outside… | medium | mitigate | the edit is scoped to the Phase 1 section, and a node check asserts the roadmap still lists exactly seven phases | closed |
| T-15-06 | repudiation | an advisory finding disappearing between verification and the next phase | low | mitigate | all six are accounted for by name in the SUMMARY — five with the plan that closed them, one with the reason it stays open and a… | closed |
| T-15-07 | repudiation | a requirement promoted to `Complete` on evidence that predates this run's own… | medium | mitigate | each of the four is promoted only with a gate green on the tree the run leaves behind (task 1's `tx.test.ts` / `usage.test.ts` /… | closed |
| T-15-08 | repudiation | the exposure test itself going stale — a per-requirement list of "files that… | medium | mitigate | exposure is not read off a list: it is recomputed per requirement from two things read fresh at execution time — the surface the… | closed |
| T-15-SC | tampering | npm/pip/cargo installs | high | mitigate | this plan adds no dependency; the only code change is one existing function call inside another existing function. If execution… | closed |
| T-16-01 | repudiation | the suite as FOUND-04's machine evidence (`server/test/api.test.ts:53`,… | medium | mitigate | every spawn takes a port the OS just confirmed free through `freePort()`, and the acceptance requires five consecutive clean… | closed |
| T-16-02 | tampering | `startDeriveServer`'s retry masking a server that genuinely cannot start | medium | mitigate | the retry is bounded at `SPAWN_ATTEMPTS`, each attempt aborts the moment the child exits, and the final throw carries the… | closed |
| T-16-03 | denial of service | `server/src/config.ts:8` accepting any `PORT`, making `guardLocal` compare… | low | mitigate | `PORT` is validated as an integer in 1..65535 at import time and throws a lowercase sentence naming the value; a case drives… | closed |
| T-16-04 | information disclosure | the child's stderr captured by the spawn helper and reported in a thrown… | low | accept | `server/src/secrets.ts` `safeMessage` already scrubs the token from every `console.error` in the server, and the helper reports… | closed |
| T-16-05 | elevation of privilege | a test helper spawning `process.execPath` with a caller-supplied `entry` | low | accept | the helper is test-only, is never reachable from a route or from `server/src`, and every caller passes a path literal computed… | closed |
| T-16-SC | tampering | npm/pip/cargo installs | high | mitigate | this plan adds no dependency. `node:net`, `node:child_process`, `node:fs` and `node:os` are built in. If execution finds it… | closed |
| T-17-01 | elevation of privilege | `server/src/repo.ts:112-120` `gitListFiles` — arbitrary command execution as… | critical | mitigate | three `-c` pins on the argv (`core.fsmonitor=false`, `core.hooksPath=/dev/null`, `core.pager=cat`) applied where command-line… | closed |
| T-17-02 | information disclosure | the 0600 install token copied into the repository tree by that command and… | critical | mitigate | closed by T-17-01's mitigation at the spawn; asserted directly in the end-to-end case as zero occurrences of the 64-hex token in… | closed |
| T-17-03 | elevation of privilege | the remaining process-spawning git config knobs (`core.sshCommand`,… | medium | accept | not reachable from `ls-files`, which opens no transport, runs no diff, filters no content and serves no pack; already pinned… | closed |
| T-17-04 | tampering | `include.path` / `includeIf` in the imported repository pulling in another… | low | mitigate | anything an included file sets is still outranked by the `-c` values on the argv; the included file is read, not executed | closed |
| T-17-05 | denial of service | a repository whose config makes `ls-files` hang, blocking the single-threaded… | medium | mitigate | `timeout: 30_000` on the call, matching the clone path's own timeout; the existing `catch` turns a timeout into the `walk()`… | closed |
| T-17-06 | repudiation | a regression test that is green because it never hands the importer a hostile… | high | mitigate | both Task 1 and Task 2 require the new cases to have been observed failing with the pins removed, recorded in the SUMMARY; the… | closed |
| T-17-07 | tampering | the confinement sentence in `server/src/repo.ts` and `guards.test.ts` claiming… | medium | mitigate | both sentences are rewritten to name the two halves separately — reads no byte outside the tree, runs no code the tree carries —… | closed |
| T-17-SC | tampering | npm/pip/cargo installs | high | mitigate | this plan adds no dependency; `node:child_process`, `node:fs`, `node:os` and `node:path` are built in and already imported. If… | closed |
| T-18-01 | repudiation | `server/src/migrations.ts:202-228` — migration 3 creates the `usage` table and… | high | mitigate | on the `migration-4` branch, a new migration writes one honest-blank row per ended turn with no row; on the… | closed |
| T-18-02 | tampering | a backfill that invents a figure to fill a column | high | mitigate | every column the driver did not report is written null, never zero; `cost_source` is the literal `'unknown'`; an acceptance… | closed |
| T-18-03 | tampering | a backfill applied to a real learner's database going wrong | medium | mitigate | `runMigrations` wraps each migration in a transaction carrying its own version bump and rolls back on failure; `snapshot(db, 3)`… | closed |
| T-18-04 | repudiation | a turn given two usage rows — once by migration 4 and once by the boot sweep —… | medium | mitigate | migration 4 skips turns still marked `running`, which are exactly the ones `closeOpenTurns` reaches; the `NOT EXISTS` clause… | closed |
| T-18-05 | repudiation | a crash between the turn's status write and its usage row leaving a turn no… | medium | mitigate | both sites move onto one exported `endTurn` inside one `withTx`; a case throws between the halves inside the transaction and… | closed |
| T-18-06 | repudiation | editing migration 3 instead of adding migration 4, so the repair reaches only… | high | mitigate | stated as a schema-gate decision in this plan and gated by a `blocking-human` checkpoint; asserted on the `migration-4` branch… | closed |
| T-18-07 | denial of service | a backfill over a very large `turns` table blocking the event loop at import… | low | accept | the write is one indexed `INSERT … SELECT` over a table whose size is bounded by the learner's own turn history, on a… | closed |
| T-18-08 | information disclosure | a migration failure message carrying a fragment of the learner's data into a… | low | mitigate | unchanged behaviour: `runMigrations` already passes the message through `redactErrors` before the `[migrate]` line and this plan… | closed |
| T-18-SC | tampering | npm/pip/cargo installs | high | mitigate | this plan adds no dependency; `node:sqlite`, `node:crypto` and `node:fs` are built in and already imported. If execution finds… | closed |
| T-19-01 | information disclosure | `server/src/mcp.ts:191-206, 244` — the long-lived install token placed on… | high | mitigate | the browser-open URL carries a single-use ticket with a sixty-second TTL instead of the token, and the opener is spawned with… | closed |
| T-19-02 | spoofing | a guessed or replayed handoff ticket admitting a browser that holds no… | medium | mitigate | 32 bytes from `randomBytes`, single use (the entry is deleted on redeem *and* on a failed redeem), sixty-second TTL, and the… | closed |
| T-19-03 | elevation of privilege | `POST /api/handoff` being reachable without a credential, turning the mint… | high | mitigate | the route sits under the existing `/api/*` middleware, which runs `guardLocal` and then requires the token header or the session… | closed |
| T-19-04 | information disclosure | a ticket leaking into a log, an event or the vault mirror | low | mitigate | no `console` call is added; the ticket is deliberately not registered as a secret, with the reason written down (an unbounded… | closed |
| T-19-05 | spoofing | `hostNames` returning the loopback name set when the connection's local… | medium | mitigate | the branch returns an empty set, so an unnameable connection is refused; the comment is rewritten to state the consequence; the… | closed |
| T-19-06 | denial of service | the fail-closed polarity making the server answer nothing on a runtime that… | low | accept | accepted deliberately and stated in the comment: refusing is the correct failure for a check whose purpose is to refuse names it… | closed |
| T-19-07 | spoofing | a persisted `derive_session` cookie stolen from a browser profile and replayed… | medium | mitigate | the cookie is `HttpOnly`, `SameSite=Strict`, `Path=/`, issued only on a response that already passed the Host and Origin checks,… | closed |
| T-19-08 | repudiation | a learner-facing sentence overstating what the session does, so a learner… | medium | mitigate | all five occurrences (`server/src/index.ts` ×2, `README.md` ×2, `scripts/doctor.mjs`, `.env.example`) are rewritten to the… | closed |
| T-19-09 | repudiation | closing HC-1 on the strength of this plan's automated cases | high | mitigate | HC-1 is carried as a `<verify><human-check>` with the exact five-step sequence, explicitly marked as not closed; the standing… | closed |
| T-19-SC | tampering | npm/pip/cargo installs | high | mitigate | this plan adds no dependency; `node:crypto` and `node:child_process` are built in and already imported, and `hono/cookie`'s… | closed |
| T-20-01 | spoofing | `server/src/index.ts` — both credential middlewares comparing a supplied value… | high | mitigate | both middlewares and `issueSession` read `credentials()`; the boot-derived comparison buffers and the helper beside them are… | closed |
| T-20-02 | tampering | an account that can write `~/.derive/token` replacing it with a value it… | medium | accept | the file is 0600, so this needs the learner's own uid or root; such an account already reads `~/.derive/derive.db` and every… | closed |
| T-20-03 | elevation of privilege | a time-of-check gap between the cached read and the comparison: a credential… | medium | mitigate | the window is one second, is a named exported constant, and is what all three asserting sentences state; no sentence promises… | closed |
| T-20-04 | information disclosure | a rotated-in token never reaching `registerSecret`, so the redaction… | high | mitigate | `credentials()` registers each newly-read token and its derived session at the moment it reads them; a unit case asserts… | closed |
| T-20-05 | elevation of privilege | the live read creating a token when the file is absent, turning a learner's… | high | mitigate | creation lives only in the boot-time function and is documented as the only place; the live read's empty-file branch refuses… | closed |
| T-20-06 | denial of service | a filesystem read per request on a single-threaded, synchronous event loop | low | mitigate | the one-second cache bounds it to one `readFileSync` per second per process regardless of request rate, and the reasoning is… | closed |
| T-20-07 | denial of service | a deleted token file locking the learner out of a running server with no way… | low | accept | that is the revocation, and it is what the sentences now say happens; the next start creates a new file and prints a new link,… | closed |
| T-20-08 | spoofing | a cookie minted from a boot-time session value after a rotation, which the… | medium | mitigate | `issueSession` takes its value from `sessionValue()`, so the mint and the check read one source; Task 2's rotation case asserts… | closed |
| T-20-09 | information disclosure | the registered-secrets set growing one entry per rotation, each an old token,… | low | accept | the registry is a `Set` of exact values scanned longest-first; an old token staying registered is wanted, because it keeps being… | closed |
| T-20-10 | repudiation | a sentence promising revocation the window does not deliver, or omitting the… | high | mitigate | the three asserting places name the window and drop the restart; `issueSession`'s doc names the MCP and plugin cost; a case… | closed |
| T-20-11 | repudiation | closing HC-1 on the strength of this plan's automated cases, when this plan is… | high | mitigate | HC-1 is carried as a `<verify><human-check>` with the corrected six-step sequence, explicitly marked as not closed; the standing… | closed |
| T-20-SC | tampering | npm/pip/cargo installs | high | mitigate | this plan adds no dependency; `node:fs` and `node:crypto` are built in and already imported by the files it touches. If… | closed |
| T-21-01 | repudiation | `server/src/repo.ts:123` — a load-bearing security rationale naming five… | medium | mitigate | the five decided pins go on the clone argv, and the sentence is rewritten to name which knobs ride on which argv and which ride… | closed |
| T-21-02 | elevation of privilege | `git clone` consulting a credential helper or an ssh command from a config… | low | mitigate | `-c credential.helper=` and `-c core.sshCommand=false` on the argv, where command-line `-c` outranks every config file;… | closed |
| T-21-03 | tampering | the machine's system git config reaching the clone, which the listing path… | low | mitigate | `GIT_CONFIG_NOSYSTEM: '1'` in the clone's environment, matching the listing path, so one posture covers both git invocations in… | closed |
| T-21-04 | elevation of privilege | a filesystem monitor, a hook directory or a pager spawned during the checkout… | low | mitigate | `-c core.fsmonitor=false`, `-c core.hooksPath=/dev/null` and `-c core.pager=cat` on the argv — the same three the listing path… | closed |
| T-21-05 | repudiation | the rewritten sentence drifting from the argv again, one knob at a time | medium | mitigate | a case slices the argv text of both git invocations with the comment excluded and asserts the claim set, including that the… | closed |
| T-21-06 | repudiation | claiming the new pins are proven when no clone-argv pin can be driven in this… | medium | mitigate | the backstop truth in `must_haves` says so in the report's own words, the case carries a `//` line saying why it reads the… | closed |
| T-21-07 | denial of service | a wrong flag value making every clone fail, so repo import by URL breaks | low | mitigate | every added flag is a documented git config key with an inert value; `pnpm build`, the guards suite and the whole suite run at… | closed |
| T-21-SC | tampering | npm/pip/cargo installs | high | mitigate | this plan adds no dependency; `node:child_process` and `node:fs` are built in and already imported by both files. If execution… | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Closure evidence (ASVS L1)

Each control below was confirmed present in the implementation at audit time, and the
full suite runs green: **201 tests, 201 pass, 0 fail** (`pnpm test`).

| Control | Where | Threats closed |
|---------|-------|----------------|
| constant-time credential compare + token middleware | `server/src/credentials.ts`, `server/src/index.ts` | T-07-01/02/03, T-09-01, T-14-01, T-20-01/03 |
| loopback bind, `DERIVE_HOST` opt-in widening | `server/src/config.ts`, `server/src/index.ts` | T-07-05, T-09-04 |
| Origin allowlist + Host check (`guardLocal`) | `server/src/index.ts` | T-07-04, T-09-02/03/05, T-14-02/06/07 |
| redaction chokepoint (`registerSecret`, `redact`, `redactErrors`) | `server/src/secrets.ts` | T-04-03, T-08-01/02/07/08, T-20-04/09 |
| SSRF guard (`assertPublicHost`) | `server/src/repo.ts`, `server/src/library.ts` | T-08-03, T-10-01/02/03, T-13-05 |
| symlink confinement (`lstatSync`, `realpathSync`) + `isSecretName` | `server/src/repo.ts` | T-13-01/02/03/04 |
| hardened git argv (`GIT_CONFIG_GLOBAL`/`NOSYSTEM`, protocol pins) | `server/src/repo.ts` | T-08-05, T-10-04, T-17-01/02/03/04, T-21-01…07 |
| transactional migrations + pre-migration snapshot | `server/src/migrations.ts`, `server/src/db.ts` | T-05-01…04, T-18-02/03/06 |
| usage ledger completeness (`recordUsage`, boot sweep, migration 4) | `server/src/db.ts`, `server/src/index.ts` | T-06-01/03/04/05, T-15-01/02, T-18-01/04/05 |
| live credential read with a one-second bound, both directions | `server/src/credentials.ts` | T-20-01/03/05/06 |
| handoff surface removed (`POST /api/handoff`, `?ticket=`) | `server/src/index.ts`, `server/src/mcp.ts` | T-19-01…06 (surface deleted by plan 01-22) |
| wire-surface snapshot + zod `safeParse` on action bodies | `server/src/tools.ts`, `server/test/wire-surface.json` | T-01-01/02/05, T-02-01/02/03 |

The two `transfer` rows are closed by later plans in the same phase, not by a third party:
T-02-04 (any local process calling the action route) is closed by 01-07's token middleware;
T-04-03 (provider text reaching the event log) is closed by 01-08's redaction chokepoint.

T-14-09 and T-19-05 carry a branch-conditional disposition
(`mitigate (branch A) / accept (branch C)`). Branch A shipped — the session cookie is
minted only on a loopback-verified request — so both are closed as mitigated.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01-01 | T-01-03 (low) | descriptions are the teaching method's model-facing text; they contain no secret and D-08 deliberately stores them in full so the diff is readable | jicanta | 2026-09-20 |
| AR-01-02 | T-01-04 (low) | the body is already read whole by Hono before this plan; parsing cost is bounded by the existing body size and unchanged by adding validation | jicanta | 2026-09-20 |
| AR-01-03 | T-04-04 (medium) | unchanged from today — the SDK's own timeouts and the learner's Stop are the controls; the `active` map and `interrupt()` still work through `ctx.onActive` | jicanta | 2026-09-20 |
| AR-01-04 | T-05-05 (low) | one snapshot per version left behind, never overwritten, and the version count grows with releases, not with use | jicanta | 2026-09-20 |
| AR-01-05 | T-06-02 (medium) | the provider's own figure is what COST-01 asks to store; Derive records what was reported and labels the source, and `cost_source` is what lets a reader judge it | jicanta | 2026-09-20 |
| AR-01-06 | T-07-06 (medium) | the app's own document is the intended consumer and cannot be read cross-origin now that Origin is checked and CORS is scoped; D-09 chose injection precisely so that no… | jicanta | 2026-09-20 |
| AR-01-07 | T-07-07 (low) | local-only surface; the comparison is constant-time over equal-length buffers and the failure is a cheap 401 | jicanta | 2026-09-20 |
| AR-01-08 | T-08-09 (medium) | a time-of-check-to-time-of-use window remains, as it does for any userland guard in Node; the residual risk is bounded by the loopback bind and the token from plan… | jicanta | 2026-09-20 |
| AR-01-09 | T-09-06 (medium) | the cookie is not the install token and cannot be reversed to it, and the 0600 file is unchanged; a local user with shell access can still request `/` and read the… | jicanta | 2026-09-20 |
| AR-01-10 | T-09-08 (low) | `SESSION` is computed once at boot into a module constant; the per-request cost is one constant-time buffer compare, as today | jicanta | 2026-09-20 |
| AR-01-11 | T-10-06 (medium) | a time-of-check-to-time-of-use window remains, as it does for any userland guard in Node and as plan 01-08 already recorded for the library fetch; closing it needs a… | jicanta | 2026-09-20 |
| AR-01-12 | T-10-07 (low) | the existing 120-second `execFileSync` timeout is unchanged and already bounds it | jicanta | 2026-09-20 |
| AR-01-13 | T-13-07 (low) | a skipped entry already increments the existing `skipped` count the importer returns and the UI shows; no new silent-drop path is introduced, and a symlinked source… | jicanta | 2026-09-20 |
| AR-01-14 | T-16-04 (low) | `server/src/secrets.ts` `safeMessage` already scrubs the token from every `console.error` in the server, and the helper reports only what the child wrote; no new egress… | jicanta | 2026-09-20 |
| AR-01-15 | T-16-05 (low) | the helper is test-only, is never reachable from a route or from `server/src`, and every caller passes a path literal computed from `import.meta.url`; the runner's glob… | jicanta | 2026-09-20 |
| AR-01-16 | T-17-03 (medium) | not reachable from `ls-files`, which opens no transport, runs no diff, filters no content and serves no pack; already pinned where they are reachable, on the clone argv… | jicanta | 2026-09-20 |
| AR-01-17 | T-18-07 (low) | the write is one indexed `INSERT … SELECT` over a table whose size is bounded by the learner's own turn history, on a single-user local database; migration 2's… | jicanta | 2026-09-20 |
| AR-01-18 | T-19-06 (low) | accepted deliberately and stated in the comment: refusing is the correct failure for a check whose purpose is to refuse names it cannot justify, and the whole suite… | jicanta | 2026-09-20 |
| AR-01-19 | T-20-02 (medium) | the file is 0600, so this needs the learner's own uid or root; such an account already reads `~/.derive/derive.db` and every lesson, and on the old code could write the… | jicanta | 2026-09-20 |
| AR-01-20 | T-20-07 (low) | that is the revocation, and it is what the sentences now say happens; the next start creates a new file and prints a new link, and HC-1's step 6 confirms it | jicanta | 2026-09-20 |
| AR-01-21 | T-20-09 (low) | the registry is a `Set` of exact values scanned longest-first; an old token staying registered is wanted, because it keeps being scrubbed out of anything already… | jicanta | 2026-09-20 |

All 21 accepted risks are low or medium; none sits at or above the `high`
blocking threshold, so none counts toward `threats_open`.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-20 | 167 | 167 | 0 | /gsd-secure-phase (ASVS L1, short-circuit: register authored at plan time, threats_open 0) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-20
