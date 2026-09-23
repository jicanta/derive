---
gsd_state_version: "1.0"
current_phase: 2
current_phase_name: Settings and Secrets
status: planning
stopped_at: Phase 01 complete, ready to plan Phase 2
last_updated: "2026-09-20T18:54:58.575Z"
last_activity: 2026-09-20
last_activity_desc: Phase 01 complete, transitioned to Phase 2
state_head: 8ba7c71593df7f987ccd6bb5df3702607a5252b4
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 22
  completed_plans: 22
  percent: 14
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-20)

**Core value:** A learner can sit down with any model they have access to and be taught the Derive way: the dependency graph, the understanding gate, the review loop, with nothing lost between providers.
**Simplicity rule (binding):** one screen, one next step. The default UI shows the lesson and what to do next; everything else lives behind Settings. No feature ships without a one-sentence reason tied to learning better.
**Current focus:** Phase 2 — Settings and Secrets

## Current Position

Phase: 2 — Settings and Secrets
Plan: Not started
Status: Ready to plan
Last activity: 2026-09-23 - Completed quick task 260923-bus: fix GitHub issue 10: update pnpm from 10.33.2 to 12.5.1 and move onlyBuiltDependencies to pnpm-workspace.yaml allowBuilds

Progress: [█░░░░░░░░░] 14%

## Performance Metrics

**Velocity:**

- Total plans completed: 22
- Average duration: -
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 22 | - | - |

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

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2]: Anthropic consumer-OAuth policy and Gemini CLI third-party terms are MEDIUM confidence; re-verify before the settings page ships
- [Phase 3]: AI SDK 7 API shapes, OpenRouter per-response cost field path, and context compaction strategy are unverified in this repo
- [Phase 4]: No measurement yet of which local models pass the understanding gate; the harness produces the answer
- [Phase 7]: npm package name not yet reserved (`derive` is taken)

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

Last session: 2026-09-20T18:55:59.259038+00:00
Stopped at: Phase 01 verified (UAT 4/4, security threats_open 0), ready to plan Phase 2
Resume file: None
