---
phase: 01-foundation
verified: 2026-09-19T22:15:00Z
status: gaps_found
score: 3/5 must-haves verified
covered_files:
  - .env.example
  - .github/workflows/ci.yml
  - .planning/REQUIREMENTS.md
  - .planning/phases/01-foundation/01-01-PLAN.md
  - .planning/phases/01-foundation/01-01-SUMMARY.md
  - .planning/phases/01-foundation/01-02-PLAN.md
  - .planning/phases/01-foundation/01-02-SUMMARY.md
  - .planning/phases/01-foundation/01-03-PLAN.md
  - .planning/phases/01-foundation/01-03-SUMMARY.md
  - .planning/phases/01-foundation/01-04-PLAN.md
  - .planning/phases/01-foundation/01-04-SUMMARY.md
  - .planning/phases/01-foundation/01-05-PLAN.md
  - .planning/phases/01-foundation/01-05-SUMMARY.md
  - .planning/phases/01-foundation/01-06-PLAN.md
  - .planning/phases/01-foundation/01-06-SUMMARY.md
  - .planning/phases/01-foundation/01-07-PLAN.md
  - .planning/phases/01-foundation/01-07-SUMMARY.md
  - .planning/phases/01-foundation/01-08-PLAN.md
  - .planning/phases/01-foundation/01-08-SUMMARY.md
  - .planning/phases/01-foundation/01-09-PLAN.md
  - .planning/phases/01-foundation/01-09-SUMMARY.md
  - .planning/phases/01-foundation/01-10-PLAN.md
  - .planning/phases/01-foundation/01-10-SUMMARY.md
  - .planning/phases/01-foundation/01-11-PLAN.md
  - .planning/phases/01-foundation/01-11-SUMMARY.md
  - .planning/phases/01-foundation/01-12-PLAN.md
  - .planning/phases/01-foundation/01-12-SUMMARY.md
  - .planning/phases/01-foundation/01-13-PLAN.md
  - .planning/phases/01-foundation/01-13-SUMMARY.md
  - .planning/phases/01-foundation/01-14-PLAN.md
  - .planning/phases/01-foundation/01-14-SUMMARY.md
  - .planning/phases/01-foundation/01-15-PLAN.md
  - .planning/phases/01-foundation/01-15-SUMMARY.md
  - .planning/phases/01-foundation/01-REVIEW.md
  - README.md
  - codex/skills/derive-learn/SKILL.md
  - codex/skills/derive-review/SKILL.md
  - method/00-identity.md
  - method/10-philosophy.md
  - method/20-tools.md
  - method/30-quiz-options.md
  - method/40-discipline.md
  - method/50-checks.md
  - method/60-process.md
  - method/70-material.md
  - method/80-library.md
  - method/90-preferences.md
  - method/95-writing-style.md
  - method/surfaces/app.md
  - method/surfaces/claude-code.md
  - method/surfaces/codex-learn.md
  - method/surfaces/codex-review.md
  - package.json
  - plugin/commands/learn.md
  - plugin/commands/review.md
  - plugin/hooks/mirror.mjs
  - plugin/skills/teach/SKILL.md
  - pnpm-lock.yaml
  - scripts/check-method.mjs
  - scripts/doctor.mjs
  - scripts/render-method.mjs
  - server/package.json
  - server/src/agent.ts
  - server/src/codex.ts
  - server/src/config.ts
  - server/src/db.ts
  - server/src/driver.ts
  - server/src/drivers/fake.ts
  - server/src/events.ts
  - server/src/export.ts
  - server/src/index.ts
  - server/src/library.ts
  - server/src/mcp.ts
  - server/src/method.generated.ts
  - server/src/migrations.ts
  - server/src/prompt.ts
  - server/src/repo.ts
  - server/src/secrets.ts
  - server/src/tools.ts
  - server/test/api.test.ts
  - server/test/driver.test.ts
  - server/test/guards.test.ts
  - server/test/mcp.test.ts
  - server/test/migrations.test.ts
  - server/test/secrets.test.ts
  - server/test/security.test.ts
  - server/test/tx.test.ts
  - server/test/usage.test.ts
  - server/test/wire-surface.json
  - server/test/wire-surface.test.ts
  - web/src/lib/api.ts
  - web/src/lib/useLesson.ts
  - web/vite.config.ts
covered_digest: "v1:sha256:530db952a6deb12030d8eb2c0cafed52627a4c6bb1b893459bed7deb5e232678"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "The repo importer followed symlinks out of the tree — reproduced closed: a folder holding README.md plus notes.md -> DATA_DIR/token, sub/hosts.md -> /etc/passwd and linkeddir -> an outside folder imported as text \"README.md\\n# A normal readme\" and nothing else; GET /api/materials/:id?text=1 returned 0 occurrences of the install token and 0 of /etc/passwd's root line."
    - "The document route handed an API credential to a caller that presented nothing — reproduced closed: GET / with no headers on 127.0.0.1 is 401 with no Set-Cookie; GET /?token=<install token> is 302 with Location `/` (query dropped) and Set-Cookie derive_session=<HMAC, != token>; that cookie then drives GET /api/lessons to 200."
    - "server/src/index.ts:1075-1077 no longer claims the document routes are held to the API's standard; index.ts:102 now states the startup-line exception explicitly instead of claiming the token is never written out."
    - "The boot sweep left swept turns without a usage row — reproduced closed: an open turn, SIGKILL of the server, restart; the turn came back `interrupted` with exactly one usage row, and turns(2) == usage(2)."
    - "deleteLearner left turns and usage rows behind (WR-01) — reproduced closed: a learner with one lesson, one turn and one usage row leaves 0/0/0 after deleteLearner."
  gaps_remaining:
    - "Success Criterion 5 — a repo import still executes a command the imported repository carries, and the install token still comes back out of GET /api/materials/:id?text=1. The symlink path the prior pass found is genuinely closed; the same observable is reached by a different mechanism I reproduced end to end against the built server."
    - "Success Criterion 5 (usage half) — on any database upgraded from a pre-phase install, the turns the migration backfills carry no usage row, so db.ts:640's 'Every turn gets a usage row, whichever driver ran it' is false on every existing learner's file."
  regressions: []
gaps:
  - truth: "The server answers only on 127.0.0.1 with a per-install token, rejects foreign Host and Origin, and no secret appears in any error, log, event, export or vault-mirror path"
    status: partial
    reason: >-
      The front door is genuinely closed and I reproduced every clause of it:
      loopback-only bind, 401 with no credential, the one-time ?token= handoff,
      foreign Host and Origin refused 403 on both the API and the document
      routes, no token in the served markup, and the redaction chokepoint live
      on the export path. What fails is the confinement of the repo importer.
      `gitListFiles` (server/src/repo.ts:112-120) runs git with a bare argv
      while the sibling clone path was pinned, and `git ls-files --others`
      spawns whatever `core.fsmonitor` the imported repository's own
      `.git/config` names. I chained it against the built server on a scratch
      data dir and port: POST /api/materials/repo on an ordinary local git repo
      whose config set core.fsmonitor to a shell command copied the 0600
      install token into the repo tree, and the same import then read it back —
      GET /api/materials/:id?text=1 returned the 64-hex token verbatim, one
      occurrence. Material text does not pass the `emit` redaction chokepoint
      (D-11, deliberate), so this is also how the token reaches the tutor model.
      Plan 01-13's own truth — "A repo import reads no byte outside the tree it
      was given" — is false as written. The second item below is separate: the
      usage ledger's stated invariant does not survive the migration that
      creates it.
    artifacts:
      - path: "server/src/repo.ts"
        issue: >-
          Lines 112-120: execFileSync('git', ['-C', dir, 'ls-files', '-z',
          '--cached', '--others', '--exclude-standard']) with no `-c
          core.fsmonitor=false`, no `-c core.hooksPath=/dev/null`, no
          GIT_CONFIG_NOSYSTEM, no GIT_TERMINAL_PROMPT=0 and no timeout — while
          the clone path 20 lines below carries `-c http.followRedirects=false
          -c protocol.allow=never -c protocol.https.allow=always` and
          GIT_TERMINAL_PROMPT=0 for exactly the same reason. Reproduced twice:
          directly (git 2.43.0, `git -C repo ls-files -z --cached --others
          --exclude-standard` on a repo with core.fsmonitor set wrote the
          sentinel and the stolen file, then listed STOLEN.txt among its output)
          and through the server (POST /api/materials/repo → sentinel written,
          token copied, token returned by GET /api/materials/:id?text=1). The
          process is spawned before a single lstat/realpath check in
          fromDirectory runs, so none of 01-13's confinement work is reached.
          Reachable from the tutor model through `attach_material` with a folder
          path — the entry point guards.test.ts:4-7 names in its own threat
          model — and from the ordinary learner chain: clone a hostile repo,
          ask Derive to study it.
      - path: "server/src/migrations.ts"
        issue: >-
          Migration 2 backfills one `turns` row per turn_start in the event log
          (line 244 backfillTurns); migration 3 creates the `usage` table and
          backfills nothing. The boot sweep only closes `status = 'running'`, so
          a backfilled turn that the log shows as finished never gets a row.
          Reproduced with real pre-phase code: a database built by
          `server/src/db.ts` at b8f255c (one lesson, two nodes, three events),
          opened with HEAD, migrated 0 → 3, kept every row and wrote
          derive.db.bak-v0 — and left `turns: 1, usage: 0`, the one turn status
          'ok' with usage_rows 0. That makes db.ts:640 ("Every turn gets a usage
          row, whichever driver ran it ... turn counts reconcile across every
          view") false on every upgraded install, which is the majority case.
          The honest row is the one closeUsage already writes for terminal
          turns: nulls with cost_source 'unknown'.
      - path: "server/test/guards.test.ts"
        issue: >-
          The suite's module doc puts a hostile repo handed over by the tutor
          model inside the threat model, and cases cover leaf symlinks,
          symlinked intermediate directories, ancestor loops and the clone
          flags — but nothing covers a repository whose own `.git/config`
          names a command. The suite is green over the confinement guarantee
          01-13 states, while the reproduction above walks past it. This is the
          shape 01-13's and 01-14's standing prohibition names.
    missing:
      - "Pin the ls-files argv the way the clone argv is pinned, and neutralise the config that can spawn a process: `git -c core.fsmonitor=false -c core.hooksPath=/dev/null -C <dir> ls-files ...` with `env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' }` and a timeout. Anything short of neutralising the spawning config leaves the same class open (core.pager, core.sshCommand, and the alias/hook surface git reads from a repo)."
      - "Add a guards.test.ts case beside the symlink ones: a scratch repo with core.fsmonitor set to a command that writes a sentinel, imported with fromDirectory, and the sentinel asserted absent. It drives offline exactly as cheaply as the symlink cases do."
      - "Correct the reach of 01-13's claim, or make it true: `fromDirectory` refuses to read outside the tree, but the import as a whole currently runs code the tree carries, so the sentence in repo.ts and in guards.test.ts's doc has to say which of the two it means."
      - "Give backfilled turns the same honest blank the sweep gives swept ones — a fourth migration that writes one nulls/'unknown' usage row per turn with no row — or narrow db.ts:640 to say the invariant holds from the ledger's first version forward and that pre-ledger turns are unreported. One or the other; not neither."
      - "Wrap the sibling `finishTurn` + `closeUsage` pairs at server/src/index.ts:1000-1002 and server/src/driver.ts:113-115 in withTx the way closeOpenTurns already does, or fold the pair into one exported endTurn(turnId, status) in db.ts, so a crash between the two statements cannot leave a turn that no sweep can ever reach."
deferred: []
advisory:
  - finding: "server/src/mcp.ts:191-206 and 244 — openBrowser(withToken(l.url)) hands the long-lived install token to exec(), which spawns /bin/sh -c and then the browser, so the credential lands in two process command lines for as long as the browser runs."
    category: security
    reason: >-
      New scope this round (withToken was added by 01-14, and mcp.ts is
      git-modified in cc1f818..HEAD), and the mechanism is plain in the source,
      but I could not reproduce it here — /proc/<pid>/cmdline for a spawned
      child is not readable from this sandbox. It is also outside Success
      Criterion 5's own enumeration (error, log, event, export, vault-mirror),
      so it is raised rather than counted. Resolved by minting a single-use,
      short-TTL handoff ticket the document middleware accepts once in place of
      ?token=, which is safe to put in a URL and in the `url` field the model
      reports; switching to execFile does not resolve it on its own.
    evidence_status: "mechanism read from source and confirmed by the code path; live /proc reproduction blocked by the sandbox"
  - finding: "server/src/index.ts:1126 — the startup line prints http://localhost:<port>/?token=<install token> to stdout on every start."
    category: security
    reason: >-
      Reproduced: the captured stdout of the scratch server contains the 64-hex
      token (grep -c = 1), in a file with ordinary permissions, while the token
      file itself is 0600. Unlike the prior round this is now a stated decision
      rather than a silent one — index.ts:102 names the startup line as the one
      place the token is written out, and the comment at 1125 gives the reason
      (a browser cannot read a 0600 file). Raised because under systemd/journald,
      pm2 or `nohup … > out.log` it is a durable copy, and because the /api/*
      comment at 230-234 removes a credential from a URL for exactly the reason
      that applies here. Resolved by the same one-time ticket as the finding
      above, which is safe to print because it expires.
    evidence_status: "reproduced — token present in the captured server stdout log"
  - finding: "server/src/index.ts:150-152 — hostNames returns the loopback name set when the connection's local address is unavailable, and its comment calls that 'fail closed to loopback'."
    category: security
    reason: >-
      The returned set admits localhost / 127.0.0.1 / ::1 / [::1], which is the
      forged loopback Host the check exists to refuse on a widened bind; failing
      closed would be an empty set. Plan 01-14's own truth #2 asserts 'where an
      address is consulted at all it fails closed, matching hostNames' own
      choice at server/src/index.ts:152' — the choice at 152 is the permissive
      one, so the plan's sentence and the code disagree. Impact is bounded: the
      credential check stands behind it and the default bind is 127.0.0.1, and I
      could not force localAddress to be undefined. Resolved by returning an
      empty set and correcting the comment.
    evidence_status: "code read; not reproduced — localAddress could not be made undefined from outside the process"
  - finding: "server/src/mcp.ts:253 — start_lesson still returns a tokenless `url`, so with open_browser:false or DRIVER='app' the model reports a link that 401s."
    category: other
    reason: >-
      withToken was wired to the browser-open call only. The 401 body does say
      what to do, but it asks a learner mid-lesson to read a 0600 file out of
      their data directory, which is a live cost against the one-screen-one-next-
      step rule. The default plugin path is unaffected (openBrowser fires and
      the page opens authenticated), so this rides with the human parity check
      rather than blocking. Resolved by the ticket in the first advisory.
    evidence_status: "code read; the default path is covered by mcp.test.ts, the non-default ones by nothing"
  - finding: "The cookie issueSession sets carries no Max-Age and no Expires, so it dies with the browser session, while the startup line, README.md, .env.example and scripts/doctor.mjs all say 'once per browser'."
    category: other
    reason: >-
      Reproduced: Set-Cookie: derive_session=…; Path=/; HttpOnly; SameSite=Strict
      and nothing else. The code comment states the session-cookie choice
      deliberately; four learner-facing strings then overstate it. Because the
      handoff link is only printed at server start, a learner who closes their
      browser on a long-running server has no printed link to return to.
      Resolved by picking one — a maxAge, or 'once per browser session' in all
      four strings plus a way to reprint the link.
    evidence_status: "reproduced — the Set-Cookie header carries no expiry attribute"
  - finding: "`pnpm test` exited 1 with 6 cancelled subtests on its first invocation and 0 with 159/159 on an identical second one."
    category: other
    reason: >-
      Consistent with 01-REVIEW.md IN-05: security.test.ts:93/258 and
      api.test.ts:53 pick a random port with no retry, and node:test runs files
      concurrently, so a clash burns the 20-second start deadline and reads as a
      product failure. Raised because a suite that fails one run in N is a CI
      gate nobody trusts. Resolved by spawning with PORT=0 and reading the port
      off the child's first stdout line.
    evidence_status: "reproduced once — first run exit 1 / 6 cancelled, second run exit 0 / 159 passed"
human_verification:
  - test: "Run one real lesson through the Claude Code plugin (/derive:learn, then /derive:review) and one through the Codex derive-learn skill, per WINDOWS.md #5 (HC-2). Run it after the Criterion 5 gap closes, since step 1 opens the browser companion page."
    expected: "Both complete exactly as before the phase: the plan lands, a quiz is asked and graded, nodes lock, the review session runs. The Codex skill teaches rather than only quizzing."
    why_human: "Requires a model and a provider login. mcp.test.ts drives the identical stdio wire with no model and is green, but it cannot exercise a model's own tool-selection, the transcript hook, or the Codex rollout mirror."
  - test: "Open the printed http://localhost:4310/?token=… link in a real browser, start a lesson, answer a card, and watch the graph update (WINDOWS.md #4, HC-1). Then close the browser entirely, reopen it and go to http://localhost:4310/ with no query string."
    expected: "The page loads after the 302, the SSE stream connects, cards render and answers land — all on the derive_session cookie, with no x-derive-token header sent by the page. After the browser restart the page is expected to 401, because the cookie has no expiry; confirm the learner has a usable way back in."
    why_human: "No automated test drives a real browser. curl proves the cookie authenticates /api/lessons and that the handoff 302 sets it; nothing proves the page's own fetch and EventSource carry it, and no case covers the lesson stream on the cookie at all (01-REVIEW.md WR-09)."
---

# Phase 1: Foundation Verification Report

**Phase Goal:** The tutor's 14 tools and its method text exist once and feed every surface; every driver sits behind one interface and one event sink; every turn's raw usage is recorded; the database migrates transactionally; the local server is hardened before it ever holds a key — and the Claude Code plugin and Codex paths are proven unchanged throughout.

**Verified:** 2026-09-19T22:15:00Z
**Status:** gaps_found
**Re-verification:** Yes — third round, after gap plans 01-13, 01-14 and 01-15. Every verdict below was re-established against the current tree; none was carried forward from the stale report.

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | A lesson through the Claude Code plugin and one through the Codex skills both complete exactly as before; the wire-surface snapshot is unchanged and a stdio MCP smoke test (`tools/list`, `start_lesson`, `quiz`, `answer`, `end_lesson`) passes with no model | ? UNCERTAIN (machine half verified, human half outstanding) | `mcp.test.ts` drives `server/dist/mcp.js` over real stdio JSON-RPC: `tools/list` returns 22 tools in registry declaration order and its sorted name set equals the pre-phase binary's (`MCP_TOOLS_BEFORE`, from `git show b8f255ce`); then `start_lesson` → `set_plan` → `answer` → `set_phase` → `node_status` → mirrored prose → `quiz` → `answer` (server-graded `correct`, with an `instruction`) → `end_lesson`, no model anywhere. `wire-surface.test.ts` holds the 14 tutor tools, their order and their status labels against the pre-phase source, and `git diff --quiet 239d5f1..HEAD -- server/test/wire-surface.json` exits 0. The human half — a real lesson on each of the two terminals — needs a model and a login; no automated path exists. |
| 2 | Editing a tool's schema or a sentence of the method in its single source updates the app system prompt, the plugin skill, the Codex skills, the `allowed-tools` lists and the HTTP action validation together; CI fails when any rendered copy drifts from the source | ✓ VERIFIED | Proven by two mutations, both reverted. (a) Appended one sentence to `method/10-philosophy.md`: `node scripts/check-method.mjs` exited 1 naming `server/src/method.generated.ts`, `plugin/skills/teach/SKILL.md` and both Codex `SKILL.md`s as drifted. (b) Added one tool to `server/src/tools.ts`: `wire-surface.test.ts` failed on the agent, mcp and http projections; after regenerating the fixture, `check-method` exited 1 again and, once its count guard was bumped, rendered `mcp__plugin_derive_derive__verifier_probe` into both `plugin/commands/*.md` `allowed-tools` lines; and `toolsFor('http')` — the source of `ACTION_SCHEMAS` at `index.ts:845` — carried the new tool. `.github/workflows/ci.yml` runs `pnpm method:check` before typecheck, build and test. |
| 3 | A new driver is added by implementing one `Driver.runTurn(ctx, sink)` and reporting through the sink, with no change to the web UI, the SSE stream or the terminal mirrors (proven by a fake driver in tests) | ✓ VERIFIED | `server/src/driver.ts` declares `Driver = { name, runTurn(ctx, sink) }` and an `EventSink` no wider than `events.ts` plus `setSessionId`, `usage` and an idempotent `endTurn`. Three implementations satisfy it — `claudeDriver` (agent.ts:153), `codexDriver` (codex.ts:36), `fakeDriver` (drivers/fake.ts:44) — and dispatch is one line, `agent.ts:274`. `driver.test.ts` runs a whole scripted turn on the fake driver and asserts every stored and live event type is in a copy of `EVENT_TYPES` taken verbatim from `web/src/lib/useLesson.ts:236`; I diffed the two lists and they are identical. Suite green. |
| 4 | An existing `~/.derive` database opens on the new version and migrates forward under a numbered, transactional runner; an interrupted `replaceGraph` or `deleteLesson` leaves no partial state | ✓ VERIFIED | Reproduced with the real pre-phase code, not a fixture: a git worktree at `b8f255c` ran its own `server/src/db.ts` against a scratch data dir to create a lesson, a two-node graph, three events and a locked node (`user_version` 0, no `turns`/`usage` tables). Opening that same file with HEAD's `db.ts` migrated it to `user_version` 3, added `turns` and `usage`, backfilled 1 turn from the event log, wrote `derive.db.bak-v0`, and returned every row unchanged (`limits:locked, deriv:pending`). Transactionality reproduced directly: a `replaceGraph` that throws on its second node left the original graph `a,b` intact; `deleteLesson` left 0 lessons / 0 nodes / 0 events; `deleteLearner` left 0 turns / 0 usage / 0 lessons for that learner. |
| 5 | The server answers only on 127.0.0.1 with a per-install token, rejects foreign Host and Origin, and no secret appears in any error, log, event, export or vault-mirror path; every turn stores raw usage (input, output, cache read, cache write, reasoning tokens) with the model id at that time and a cost source | ✗ FAILED | The front door reproduces clean (table below). What fails: `POST /api/materials/repo` on a local git repo whose own `.git/config` sets `core.fsmonitor` executes that command as the server process — `git ls-files --others` spawns it — which copied the 0600 install token into the repo tree, and the same import then returned it verbatim from `GET /api/materials/:id?text=1`. Separately, on any database upgraded from a pre-phase install the migration-backfilled turns carry no usage row, so the ledger invariant `db.ts:640` states is false there. Details under Gaps Summary. |

**Score:** 3/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `server/src/tools.ts` | The one tool contract: 22 entries, 14 on the agent surface, per-surface differences declared | ✓ VERIFIED | `toolsFor` / `descriptionFor` / `shapeFor` / `jsonSchemaOf` are the only readers; duplicate names throw at load; `ALL_TOOL_NAMES` = 22, `DERIVE_TOOL_NAMES` = 14 |
| `server/src/agent.ts`, `codex.ts`, `mcp.ts`, `index.ts` | Every surface derives its tools from the registry | ✓ VERIFIED | agent.ts:77-80 `toolsFor('agent')`; codex.ts:54 `DERIVE_TOOL_NAMES`; mcp.ts:297-300 `toolsFor('mcp')`; index.ts:845 `ACTION_SCHEMAS = toolsFor('http')`. No hand-written description or schema left on any of them |
| `method/` + `scripts/render-method.mjs` + `scripts/check-method.mjs` | One method source, six committed rendered copies, a gate that fails on drift | ✓ VERIFIED | 11 body sections + 4 surface preambles → 6 targets; `check-method` exits 1 and names each drifted file; CI runs it first |
| `server/src/driver.ts`, `server/src/drivers/fake.ts` | One driver seam and one event sink; a fake driver in tests | ✓ VERIFIED | See truth 3 |
| `server/src/migrations.ts` | Numbered, transactional migrations with a pre-migration snapshot | ✓ VERIFIED | 3 migrations; each `up` inside `BEGIN … PRAGMA user_version = n … COMMIT` with `ROLLBACK` + a redacted `[migrate]` line on failure; `VACUUM INTO` snapshot written once per upgrade |
| `server/src/secrets.ts` + its call sites | One redaction chokepoint on errors, events, export and the vault mirror | ✓ VERIFIED | `redactDeep` on all four of `emit` / `emitUpdate` / `checkpoint` / `emitEphemeral`; `redact` on the exported note; `safeMessage` on every error body and every `console.error` in the server. Live: an export read back `the install token is [redacted] ok` |
| `server/src/index.ts` (front door) | Loopback bind, per-install token, Host and Origin checks | ✓ VERIFIED | See the front-door table below |
| `server/src/db.ts` (usage ledger) | Raw counts + model + cost source per turn | ⚠️ PARTIAL | Correct for every turn the ledger opens (live row below); absent for turns the migration backfills |
| `server/src/repo.ts` | An importer confined to the tree it was given | ✗ FAILED | Symlink confinement holds; command execution from the repo's own config defeats it before any check runs |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `server/src/tools.ts` | agent / mcp / http surfaces | `toolsFor`, `descriptionFor`, `shapeFor` | ✓ WIRED | Adding one registry entry propagated to all three, reproduced |
| `server/test/wire-surface.json` | `plugin/commands/*.md` `allowed-tools` | `render-method.mjs` `mcpToolNames()` | ✓ WIRED | Two-step chain (registry → fixture → allowed-tools), with a CI gate on each step; reproduced |
| `agent.ts runTurn` | `claudeDriver` / `codexDriver` / override | `driverOverride() ?? backend()` | ✓ WIRED | agent.ts:274, 297 |
| driver `sink.usage` / `sink.endTurn` | `usage` table | `recordUsage` / `closeUsage` in `sinkFor` | ✓ WIRED | driver.ts:107-115 |
| boot sweep | `usage` table | `closeOpenTurns` → `closeUsage` inside one `withTx` | ✓ WIRED | Reproduced across a SIGKILL |
| external `end` action | `usage` table | `finishTurn` + `closeUsage`, **not** in one transaction | ⚠️ PARTIAL | index.ts:1000-1002 and driver.ts:113-115; a crash between the two leaves a turn no sweep can reach |
| `POST /api/materials/repo` | `fromDirectory` confinement checks | `ingestRepo` → `collectRepo` → `fromDirectory` → `gitListFiles` | ✗ NOT_WIRED | `gitListFiles` spawns git before any confinement check runs; the checks are bypassed, not defeated |
| migration 2 backfill | `usage` table | nothing | ✗ NOT_WIRED | Backfilled turns have no usage row and no later path writes one |
| web page | `/api/*` and the SSE stream | `derive_session` cookie, same-origin default credentials | ✓ WIRED (untested end to end) | The dead meta-tag token path is gone from `api.ts` and `useLesson.ts`; both now document the cookie. No case drives the stream on it — human item HC-1 |

### Front Door — reproduced against the built server (scratch port 4922, scratch `DERIVE_DATA_DIR`)

| Check | Request | Result |
|---|---|---|
| Bind | `ss -ltnp` | `LISTEN 127.0.0.1:4922` only |
| LAN reachability | `curl http://192.168.0.166:4922/` | connection refused |
| Token file | `ls -la` | mode `-rw-------` (0600), 64 hex bytes |
| Document route, no credential | `GET /` | **401**, no `Set-Cookie` |
| Lesson page, no credential | `GET /lesson/abc` | **401** |
| API, no credential | `GET /api/lessons` | **401** |
| One-time handoff | `GET /?token=<token>` | **302**, `Location: /` (query dropped), `Set-Cookie: derive_session=<64 hex>; Path=/; HttpOnly; SameSite=Strict`; the value is **not** the token |
| Cookie drives the API | `GET /api/lessons` + cookie | **200** |
| Header token drives the API | `GET /api/lessons` + `x-derive-token` | **200** |
| Foreign Host, API | `Host: evil.com` + token | **403** |
| Foreign Origin, API | `Origin: http://evil.com` + token | **403** |
| Foreign Host, document route | `Host: evil.com` + `?token=` | **403** |
| Foreign Origin, document route | `Origin: http://evil.com` + `?token=` | **403** |
| Health under the Host guard | `GET /api/health` / with `Host: evil.com` | **200** / **403** |
| Token in an API query string | `GET /api/lessons?token=<token>` | **401** (no longer accepted) |
| Token in the served markup | `GET /` after the handoff | 0 occurrences |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Produces real data | Status |
|---|---|---|---|---|
| `usage` table | input/output/cache-read/cache-write/reasoning + model + cost_source | `recordUsage` from `sink.usage`; `closeUsage` for unreported turns | Yes | ✓ FLOWING — live row for a terminal turn: `driver 'claude-code', model null, all five counts null, cost_source 'unknown'`, exactly the honest blank the design specifies |
| `turns` ↔ `usage` reconciliation | counts | `closeOpenTurns` → `closeUsage` | Yes, for turns the ledger opens | ⚠️ STATIC on upgraded databases — migration-backfilled turns have no row |
| Exported note / vault mirror | lesson prose | `export.ts:176 redact(...)` | Yes | ✓ FLOWING — live export rendered `the install token is [redacted] ok` |
| Material text | course material | `materials.ts` segments, **not** through `emit` | Yes | ✗ HOLLOW against the token: material text deliberately bypasses redaction (D-11), so the importer is the only control, and it is defeated |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Workspace typechecks | `pnpm -r typecheck` | server Done, web Done | ✓ PASS |
| Server builds | `pnpm --filter server build` | exit 0 | ✓ PASS |
| Full suite | `pnpm test` (scratch `DERIVE_DATA_DIR`) | 159 tests, 159 pass, 0 fail — on the second invocation; the first exited 1 with 6 cancelled (port clash, IN-05) | ⚠️ PASS, flaky |
| Method drift gate bites | one sentence appended to `method/10-philosophy.md`, then `node scripts/check-method.mjs` | exit 1, 4 copies named | ✓ PASS |
| Registry propagates | one tool added to `server/src/tools.ts` | wire-surface fails on all 3 surfaces; after regeneration, both `allowed-tools` lines and `toolsFor('http')` carry it | ✓ PASS |
| Pre-phase DB migrates forward | b8f255c worktree writes the DB, HEAD opens it | `user_version` 0 → 3, rows intact, `.bak-v0` written | ✓ PASS |
| `replaceGraph` atomicity | a replacement that throws on its second node | original graph `a,b` intact | ✓ PASS |
| Restart sweep closes the ledger | SIGKILL an open turn, restart | turn `interrupted`, 1 usage row, turns == usage | ✓ PASS |
| Symlink import refused | folder with 3 symlinks out of the tree → `POST /api/materials/repo` → `GET …?text=1` | only `README.md`; 0 token occurrences, 0 `/etc/passwd` | ✓ PASS |
| Redaction on export | mirror prose carrying the token → `GET …/export` | `the install token is [redacted] ok` | ✓ PASS |
| **Repo import executes repo config** | repo with `core.fsmonitor` set → `POST /api/materials/repo` | sentinel written, token copied into the tree, **token returned by `GET /api/materials/:id?text=1`** | ✗ **FAIL** |

### Probe Execution

| Probe | Command | Result | Status |
|---|---|---|---|
| — | — | No `scripts/*/tests/probe-*.sh` exists and no plan declares one | ? SKIP (no probes in this project) |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| FOUND-01 | 01-01, 01-02, 01-03, 01-15 | 14 tutor tools defined once; every driver, the MCP server and the HTTP action validation derive from it | ✓ SATISFIED | Truth 2; registry propagation reproduced to all three surfaces |
| FOUND-02 | 01-03, 01-15 | Method text defined once, rendered everywhere, CI fails on drift | ✓ SATISFIED | Truth 2; drift gate reproduced |
| FOUND-03 | 01-04, 01-15 | One driver interface, one event sink; a provider changes neither UI, SSE nor mirrors | ✓ SATISFIED | Truth 3 |
| FOUND-04 | 01-01, 01-02, 01-08, 01-12, 01-14, 01-15 | Plugin and Codex paths keep working, proven by a wire-surface snapshot and a modelless stdio smoke test | ? NEEDS HUMAN | Machine half green and re-run (`mcp.test.ts`, `wire-surface.test.ts`); the real-terminal half is HC-2 below. REQUIREMENTS.md already records this as Needs Human — correct |
| FOUND-05 | 01-05, 01-06, 01-11, 01-15 | Numbered transactional migrations; `replaceGraph` and `deleteLesson` transactional; existing DBs migrate forward | ✓ SATISFIED | Truth 4, reproduced with real pre-phase code |
| FOUND-06 | 01-07 … 01-10, 01-12, 01-13, 01-14, 01-15 | Loopback bind, Host and Origin checks, per-install token, secrets redacted from every error, log, event and export path before any key is stored | ✗ BLOCKED | The bind, token, Host, Origin and redaction halves all reproduce clean. The importer executes attacker-supplied commands as the server process and returns the install token through the materials route. REQUIREMENTS.md already records this as Gaps Found — correct |
| COST-01 | 01-06, 01-11, 01-15 | Every turn persists raw usage with the model id and a cost source | ⚠️ PARTIAL | Live row confirms all five counters, model and cost source for turns the ledger opens, and the restart sweep now closes them; migration-backfilled turns carry no row |

No orphaned requirements: REQUIREMENTS.md maps exactly FOUND-01..06 and COST-01 to Phase 1, and every one of those IDs appears in at least one plan's `requirements` frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `server/src/repo.ts` | 112-120 | Unpinned `execFileSync('git', …)` on attacker-controlled data, while the sibling call 170 lines down is pinned | 🛑 Blocker | Arbitrary command execution as the server process; reproduced end to end |
| `server/src/migrations.ts` | 202-228 | Migration creates the `usage` table but backfills nothing, while `db.ts:640` states the invariant unconditionally | 🛑 Blocker | Ledger does not reconcile on any upgraded install; reproduced |
| `server/src/index.ts` | 1000-1002 | `finishTurn` + `closeUsage` outside a transaction, where the sibling `closeOpenTurns` wraps them | ⚠️ Warning | A crash between them leaves a turn no sweep can reach (`WHERE status = 'running'`) |
| `server/src/index.ts` | 150-152 | `if (!addr) return new Set(LOOPBACK_NAMES)` documented as "fail closed" | ⚠️ Warning | Permissive polarity; plan 01-14's truth #2 asserts the opposite of what the line does |
| `server/src/mcp.ts` | 203-206, 244 | Long-lived credential into `exec()`'s shell command line | ⚠️ Warning | Token readable from `/proc/<pid>/cmdline` by any local account for the browser's lifetime |
| `server/src/index.ts` | 1126 | Install token printed to stdout every start | ⚠️ Warning | Durable copy of the credential under any log-capturing supervisor; now a stated decision |
| `README.md`, `.env.example`, `scripts/doctor.mjs`, startup line | — | "once per browser" over a cookie with no expiry | ⚠️ Warning | Learner-facing sentence overstates what the cookie does |
| `server/src/repo.ts` | 42, 211, 225 | Dead `TEXT_EXTS` entries and unreachable tar type branches | ℹ️ Info | Reads as handling a case it cannot reach (01-REVIEW.md IN-01, IN-02) |
| `server/src/config.ts` | 8 | `PORT` unvalidated; `PORT=abc` makes `guardLocal` compare against the string `'NaN'` | ℹ️ Info | The server binds and then 403s every request (01-REVIEW.md IN-06) |

No `TBD`, `FIXME` or `XXX` markers exist anywhere under `server/src`, `web/src`, `scripts/` or `method/`.

### Human Verification Required

#### 1. Plugin and Codex parity run (HC-2)

**Test:** Run one real lesson through the Claude Code plugin (`/derive:learn`, then `/derive:review`) and one through the Codex `derive-learn` skill, per WINDOWS.md #5. Run it after the Criterion 5 gap closes, since step 1 opens the browser companion page.
**Expected:** Both complete exactly as before the phase — the plan lands, a quiz is asked and graded, nodes lock, the review session runs — and the Codex skill teaches rather than only quizzing.
**Why human:** Requires a model and a provider login. `mcp.test.ts` drives the identical stdio wire with no model and is green, but it cannot exercise a model's own tool selection, the transcript hook, or the Codex rollout mirror.

#### 2. Real-browser session smoke (HC-1)

**Test:** Open the printed `http://localhost:4310/?token=…` link in a real browser, start a lesson, answer a card, watch the graph update. Then close the browser entirely, reopen it, and go to `http://localhost:4310/` with no query string.
**Expected:** The page loads after the 302, the SSE stream connects, cards render and answers land — all on the `derive_session` cookie, with no `x-derive-token` header sent by the page. After the browser restart the page is expected to 401 (the cookie has no expiry); confirm the learner has a usable way back in.
**Why human:** No automated test drives a real browser. curl proves the cookie authenticates `/api/lessons` and that the handoff 302 sets it; nothing proves the page's own `fetch` and `EventSource` carry it, and no case covers the lesson stream on the cookie at all.

### Gaps Summary

Four of the five criteria hold, and three of them I re-established from scratch rather than accepting: the single-source contract bites under mutation, the driver seam is a real interface with three implementations and a test that pins the browser's own event vocabulary, and a database written by the pre-phase code at `b8f255c` migrates forward under the numbered runner with every row intact and a snapshot beside it. The front door is no longer the one the last report found: an unauthenticated `GET /` on loopback is now 401 and issues nothing, the `?token=` handoff drops the credential out of the URL in a 302 and hands back a derived cookie, foreign `Host` and `Origin` are refused on the document routes as well as the API, and the redaction chokepoint visibly holds on the export path. The four sub-failures the last round listed are genuinely closed and I reproduced each closure.

What remains is the same **observable** as last round reached by a different mechanism, and it is the reason this phase cannot be called done. `git ls-files --others` runs `core.fsmonitor` from the target repository's own `.git/config` — a command git spawns. `gitListFiles` invokes it with a bare argv, while `git clone` twenty lines away was pinned by 01-13 with `protocol.allow=never`, `http.followRedirects=false` and `GIT_TERMINAL_PROMPT=0` for exactly this class of reason. I built a repo whose config set `core.fsmonitor` to a shell command, posted it to `/api/materials/repo` on the built server, and watched the command run as the server: it wrote a sentinel outside the tree and copied the 0600 install token into the tree, after which the very same import read the token back and `GET /api/materials/:id?text=1` returned it verbatim. Every `lstat` and `realpath` check 01-13 added is downstream of the spawn and never runs. The plan's own sentence — "A repo import reads no byte outside the tree it was given" — is false as written, and `guards.test.ts` is green over it because no case hands the importer a repository that carries a command. Material text deliberately does not pass the redaction chokepoint (D-11, and rightly so: a tutor that shreds a lesson about API credentials has broken the product), so the importer's refusal is the only control there is.

This matters more than a local-machine footnote because of what the phase goal says it is for: "the local server is hardened **before it ever holds a key**." Phase 2 puts provider API keys in this process. A repo import that executes attacker-chosen code as that process reads them directly, past the token, past the Host check, past redaction. The realistic path needs no exotic attacker: the learner clones a hostile repository the ordinary way and asks Derive to study it, or a prompt-injected tutor calls `attach_material` with a folder path — the entry point `guards.test.ts`'s own module doc names.

The second gap is smaller and is the sibling of the one 01-15 just fixed. `closeOpenTurns` now gives every swept turn a usage row, which I confirmed across a SIGKILL. But migration 2 backfills turns out of the event log and migration 3 backfills no usage for them, and the boot sweep only reaches rows still marked `running` — so on the pre-phase database I migrated, the one backfilled turn came back `status 'ok', usage_rows 0`. `db.ts:640` says without qualification that every turn gets a usage row and that turn counts reconcile across every view; on every upgraded install — which is every existing learner — that is not true. The fix is the same honest blank the sweep already writes, or a sentence that says which turns the invariant covers. One or the other, not neither: that is the standing prohibition three of these plans carry, and it is the reason this is recorded as a gap rather than as a note.

---

_Verified: 2026-09-19T22:15:00Z_
_Verifier: Claude (gsd-verifier)_
