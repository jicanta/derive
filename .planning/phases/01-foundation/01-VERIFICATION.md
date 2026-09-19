---
phase: 01-foundation
verified: 2026-09-19T15:30:00Z
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
  - .planning/phases/01-foundation/01-REVIEW.md
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
covered_digest: "v1:sha256:cae55ac06964d659e9bf8fa32d29cbdabd37240a1948070c685d59e346669b21"
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "The per-install token is injected into index.html and served by / , /index.html and the catch-all — reproduced closed: GET / returns 0 matches for the token"
    - "The document routes run no Host or Origin check — reproduced closed: Host: evil.com and Origin: http://evil.com are both refused 403 on /"
    - "ALLOWED_HOSTS is built from the literal bind string — reproduced closed: with DERIVE_HOST=0.0.0.0 a LAN request naming its own address is admitted 200 and a forged Host: 127.0.0.1 from the LAN is refused 403"
    - "The token is harvestable over the LAN — reproduced closed: GET / from the LAN returns 401 and issues no cookie; the ?token= handoff returns 302 + cookie"
    - "fromGitClone never calls assertPublicHost — closed: the call is at repo.ts:276, before mkdtempSync and before the git spawn; guards.test.ts now drives collectRepo at four private addresses"
    - "guards.test.ts's doc comment claimed a guarantee its cases did not exercise — closed: the doc now enumerates only what the cases drive"
    - "deleteLesson / deleteLearner leave turns and usage rows behind (WR-01) — reproduced closed: a learner with one turn and one usage row leaves 0 of each after deleteLearner"
    - "The comments at server/src/index.ts:101 and scripts/doctor.mjs:80 stated guarantees the code did not deliver — closed: index.ts:102 and doctor.mjs:74-75 now describe the mechanism honestly"
  gaps_remaining:
    - "Success Criterion 5 — the authentication boundary. The specific disclosure the prior pass found is genuinely gone, but the credential boundary it was replaced with is defeated by a different reproduced path, and the install token is still obtainable by a caller that presents nothing."
  regressions:
    - "server/src/index.ts:1075-1077 — the comment that replaced the one the prior pass flagged states a NEW guarantee the code does not deliver ('The document routes are protected at least as well as the API they unlock'). Plan 01-09's own prohibition forbids exactly this."
    - "server/test/security.test.ts:5-8 — the suite doc now claims the API 'used to be open to any process on the machine ... These cases are the proof that it is not.' It is still open to any process on the machine; no case bounds who can reach the credential-issuing route."
gaps:
  - truth: "The server answers only on 127.0.0.1 with a per-install token, rejects foreign Host and Origin, and no secret appears in any error, log, event, export or vault-mirror path"
    status: partial
    reason: >-
      Four of the five prior sub-failures are genuinely closed and I reproduced
      each one. What remains is not the old defect: it is that the replacement
      boundary grants full API authority to a caller that presents no
      credential, and that the install token is still reachable through a route
      from that position. I chained both in one reproduction against the built
      server on a scratch data dir: GET / with no headers -> derive_session
      cookie -> POST /api/materials/repo on a folder holding
      `notes.md -> DATA_DIR/token` -> GET /api/materials/:id?text=1 returns the
      64-hex install token in full. No token was presented at any step. The
      usage ledger (COST-01) and the redaction chokepoint remain verified.
    artifacts:
      - path: "server/src/index.ts"
        issue: >-
          Lines 1087-1104 and 1064-1072: on a loopback connection the document
          middleware returns early (`if (!here || isLoopback(here)) return
          next();`) and serveApp calls issueSession unconditionally, so one
          unauthenticated GET converts "can open a TCP socket to the port" into
          "can do everything the API can do". Reproduced: cookie len 64, cookie
          != token file, `/api/lessons` 401 without it and 200 with it. The
          comment at 1075-1077 says the document routes are "protected at least
          as well as the API they unlock"; they are strictly weaker — the API
          requires a credential, the document route requires none and issues
          one. The comment at 102 says the token is "never returned by any
          route"; `GET /api/materials/:id?text=1` returns it (below).
      - path: "server/src/repo.ts"
        issue: >-
          Lines 122-143 (`walk`) and 145-173 (`fromDirectory`) resolve every
          entry with statSync/readFileSync, both of which follow symlinks, and
          `isSecretName` is applied to the repo-relative path only. A link named
          anything ordinary reads its target from anywhere on disk into course
          material. Reproduced directly: a folder holding
          `notes.md -> DATA_DIR/token` imported the token's bytes as a segment,
          and the HTTP response body of `GET /api/materials/:id?text=1` carried
          the install token verbatim. Material text does not pass the `emit`
          redaction chokepoint (materialEvent at index.ts:475 carries metadata
          only) and goes to the tutor model, so this is also how the token
          leaves the machine. The reachable entry point is the one
          guards.test.ts:4-7 names: the model calls attach_material with a repo
          URL, collectRepo routes it to fromGitClone, fromGitClone hands the
          clone to fromDirectory (repo.ts:286).
      - path: "server/src/repo.ts"
        issue: >-
          Lines 274-279: assertPublicHost judges the URL the caller supplied and
          `git clone` is then spawned with no `-c http.followRedirects=false`.
          `man git-config` on this machine, verbatim: "If set to initial, git
          will follow redirects only for the initial request to a remote ... The
          default is initial." The initial request is the one the guard was
          judging, so a public URL that 302s to 10.0.0.5 or 169.254.169.254 is
          followed unchecked. Plan 01-08's must-have says every library and repo
          fetch resolves the host "re-checking after each redirect"; fetchPublic
          does (library.ts:332-340), the clone path does not. Not reproduced
          live — git has no working outbound HTTP in this environment (two
          loopback fixture servers received 0 requests, and WINDOWS.md #3 records
          the same constraint) — so this rests on the documented default plus
          the absent flag.
      - path: "server/test/security.test.ts"
        issue: >-
          Lines 5-8: "used to be open to any process on the machine ... These
          cases are the proof that it is not." Every case that touches the
          document route (280-337) exercises the credential-issuing path and
          asserts it succeeds; none bounds who may reach it. The suite is green
          over a guarantee the code does not have — the same shape plan 01-09's
          prohibition names as "the failure being repaired here".
    missing:
      - "Decide and then state the loopback posture, but not neither. Either require the token on the document route on loopback too (with a one-time ?token= handoff printed on the startup line, exactly as the widened bind already does), or move to a unix socket; or, if a local process is accepted as trusted, correct server/src/index.ts:1075-1077 and 1081-1082 and server/test/security.test.ts:5-8 to say what actually holds — scripts/doctor.mjs:74-75 already says it correctly ('or who can reach the port from this machine')."
      - "Refuse symlinks in the repo importer rather than following them: lstatSync in walk() and in fromDirectory's read loop, plus a realpathSync root pin for the git ls-files path, so no import reads a byte outside the tree. Add a guards.test.ts case that builds a repo with `notes.md -> <outside>` and asserts files.map(f => f.path) is ['README.md']."
      - "Apply isSecretName on the GitHub tarball path too (repo.ts:255), so the guard's own stated invariant — 'both when the list is built and when the tree is walked' — is true of both import shapes."
      - "Pin the clone to the URL the guard judged: `-c http.followRedirects=false -c protocol.allow=never -c protocol.https.allow=always`, and GIT_TERMINAL_PROMPT=0 so a credential prompt cannot hold the request open for 120s."
      - "Close the fail-open at server/src/index.ts:1093: `if (here && isLoopback(here)) return next();` so an unknown local address takes the token path, matching hostNames' own fail-closed choice at index.ts:152."
      - "Remove web/src/lib/api.ts deriveToken() and the useLesson.ts query-string branch, both of which now read a meta tag the server no longer writes, and say in their place that the browser authenticates with the derive_session cookie."
deferred: []
advisory:
  - finding: "server/src/index.ts:69-71 — the boot sweep closes turns without calling closeUsage, so a restart breaks the ledger invariant db.ts:635-648 states ('Every turn gets a usage row, whichever driver ran it')."
    category: other
    reason: >-
      Carried over from the first review as WR-02 and still open. It is a real
      inconsistency and the fix is one line inside closeOpenTurns, but it was
      present and unflagged through the first verification, no named test fails
      because of it, and I did not reproduce a broken reconciliation. Raised, not
      blocking. Resolved by moving the closeUsage call inside closeOpenTurns and
      asserting it in tx.test.ts.
    evidence_status: "none provided — code read only; no failing test, no reproduction attempted"
  - finding: "server/src/index.ts:202 — the Host check requires an explicit port, so PORT=80 or PORT=443 refuses every browser (a browser omits the default port from Host)."
    category: other
    reason: >-
      PORT is a documented first-class knob. The defect is real by reading, but
      binding port 80 needs privileges this environment does not have, so I did
      not reproduce it. Resolved by treating an absent port as the scheme default.
    evidence_status: "none provided — not reproduced (binding a privileged port was not possible here)"
  - finding: "server/src/index.ts:1101 — c.redirect(c.req.path) puts a caller-supplied path in Location, which is a protocol-relative open redirect for '//evil.example' and an ERR_INVALID_CHAR 500 for an encoded CR/LF."
    category: security
    reason: >-
      Only reachable on a widened bind and only after a correct token was
      presented, which is why the reviewer rated it a warning. Not reproduced.
      Resolved by normalising the path before it is used as Location.
    evidence_status: "none provided — not reproduced"
  - finding: "server/src/index.ts:228 — /api/health is exempt from guardLocal entirely, not only from the credential, so a DNS-rebound page can read version, backend and backend_source."
    category: security
    reason: >-
      Deliberate-looking but under-justified: the comment at index.ts:218-220
      justifies the credential exemption only, and doctor.mjs:92 needs only the
      credential exemption. Resolved by running guardLocal on health and exempting
      the credential alone.
    evidence_status: "none provided — code read only"
  - finding: "server/src/repo.ts:122-143 — walk() follows directory symlinks with no cycle guard, so a self-referential link recurses until the stack overflows and a link to / walks the disk."
    category: other
    reason: >-
      Same root cause as the blocking symlink finding and closed by the same
      lstatSync fix; listed separately because the failure mode and its test
      differ. Not separately reproduced.
    evidence_status: "none provided — not reproduced"
  - finding: "server/src/index.ts:312-322 — DELETE /api/learners/:id leaves pending prompts, held cards and recentCards entries alive for the lessons it deletes; recentCards is never deleted on either route."
    category: other
    reason: >-
      In-memory leak plus a card that can settle against a deleted lesson row.
      Pre-existing in the lesson-delete asymmetry; not reproduced.
    evidence_status: "none provided — code read only"
behavior_unverified_items:
  - truth: "A lesson run through the Claude Code plugin and one run through the Codex skills both complete exactly as before"
    test: >-
      (1) In a Claude Code session with the plugin installed from this repo, run
      /derive:learn on a small topic. Confirm the companion page opens, the tutor
      probes before planning, set_plan renders a graph and waits for approval, a
      check question renders as a card and grades, locking a node lights the
      graph, and /derive:review on a later run offers the nodes that are due.
      (2) In a Codex session with the Derive skills installed, run derive-learn on
      a small topic and confirm the same sequence — this is the first run where
      the Codex skill has a real method body rather than tool descriptions alone,
      so confirm the tutor teaches rather than only quizzing.
      (3) Confirm nothing the learner sees changed: same cards, same graph, same
      phases, same wording of the refusal when you try to lock a node on a
      procedure question alone.
    expected: "Both lessons complete exactly as they did before the phase, with no behavioural difference reported."
    why_human: >-
      Needs a real model and a real login on two separate terminals. Confirmed
      still unperformed rather than taken on trust: the plugin is not registered
      in ~/.claude/plugins/config.json and ~/.codex/skills does not exist.
      WINDOWS.md #5 records it as unrun-verify. The machine half (wire-surface
      snapshot, stdio MCP smoke test) is verified and survived the gap closure
      unchanged.
coincidental_reliance_items: []
human_verification:
  - test: "Run one real lesson through the Claude Code plugin (/derive:learn, then /derive:review) and one through the Codex derive-learn skill, per the three-step script above (WINDOWS.md #5, HC-2)."
    expected: "Both complete exactly as before the phase; the Codex skill now teaches rather than only quizzing."
    why_human: "Requires a model and a provider login; no automated path exists. Should run after the Criterion 5 gaps close, since step 1 opens the browser companion page."
  - test: "Open http://localhost:4310 in a real browser, start a lesson, answer a card, and watch the graph update (WINDOWS.md #4, HC-1)."
    expected: "The page loads, the SSE stream connects, cards render and answers land — all on the derive_session cookie, with no x-derive-token header sent by the page."
    why_human: "No automated test drives a real browser. curl proves the cookie authenticates /api/lessons and the SSE stream; it cannot prove the page's own fetch and EventSource send it, which now matters more because web/src/lib/api.ts still reads a meta tag the server no longer writes (WR-09) and therefore sends no header at all."
---

# Phase 1: Foundation Verification Report

**Phase Goal:** The tutor's 14 tools and its method text exist once and feed every surface; every driver sits behind one interface and one event sink; every turn's raw usage is recorded; the database migrates transactionally; the local server is hardened before it ever holds a key — and the Claude Code plugin and Codex paths are proven unchanged throughout.
**Verified:** 2026-09-19T15:30:00Z
**Status:** gaps_found
**Re-verification:** Yes — after gap closure (plans 01-09, 01-10, 01-11, 01-12)

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criteria) | Status | Evidence |
|---|---|---|---|
| 1 | Plugin and Codex lessons complete as before; wire-surface snapshot unchanged; stdio MCP smoke test passes with no model | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Machine half re-confirmed after the authentication change: `git diff --quiet 239d5f1..HEAD -- server/test/wire-surface.json` exits 0, the wire-surface suite is `ok 42 - the wire surface` with 11 subtests, and the stdio smoke suite driving `server/dist/mcp.js` passes inside the 144/144 run. `git diff --quiet 239d5f1..HEAD -- web/` exits 0, so the gap closure touched nothing the browser runs. Human half still not performed — and not on the summary's word: `~/.codex/skills` does not exist and `~/.claude/plugins/config.json` contains no `derive` entry, so neither run could have happened. |
| 2 | Editing a tool schema or a method sentence in its single source updates every rendered copy together; CI fails on drift | ✓ VERIFIED | Regression check: `node scripts/check-method.mjs` → exit 0, "method: 6 rendered copies match method/". `.github/workflows/ci.yml:37` runs `pnpm method:check`, `:40` typecheck, `:49` test, none with `|| true`. The prior pass proved propagation and drift behaviourally (append a rule to `method/10-philosophy.md` → 4 targets drift together; 9 chars inside the markers → exit 1 with a diff; remove `method/50-checks.md` → named error); nothing in the gap closure touched `method/`, `scripts/` or the registry. |
| 3 | A new driver is added by implementing one `Driver.runTurn(ctx, sink)`, with no change to web UI, SSE or terminal mirrors (proven by a fake driver) | ✓ VERIFIED | `server/src/driver.ts:86` is still `runTurn(ctx: TurnContext, sink: EventSink): Promise<void>`; `EventSink` (line 56) is emit / emitUpdate / checkpoint / emitEphemeral / setSessionId / usage / endTurn. `server/src/drivers/fake.ts` is 86 lines and a permanent fixture. `git diff --stat b8f255ce..HEAD -- web/src/lib/useLesson.ts` is 4 insertions / 2 deletions across the whole phase — the import line and the EventSource URL; `EVENT_TYPES` and `applyEvent` are untouched, so no new event type was introduced. Driver suite green in the 144/144 run. |
| 4 | An existing DB opens and migrates forward under a numbered, transactional runner; an interrupted replaceGraph or deleteLesson leaves no partial state | ✓ VERIFIED | Re-checked live, with the WR-01 closure now included. The real `~/.derive/derive.db` (created Sep 17, pre-phase) reports `PRAGMA user_version = 3` and carries `turns` and `usage` alongside the nine original tables. On a scratch DB I created a learner, a lesson, a turn and a usage row, then called `deleteLearner`: turns 1 → 0 and usage 1 → 0, scoped by `learner_id`. `tx.test.ts` (now 133 lines changed) covers the orphan path and counts over the whole table. All migration and transaction suites green. |
| 5 | Server answers only on 127.0.0.1 with a per-install token, rejects foreign Host and Origin; no secret in any error/log/event/export/vault path; every turn stores raw usage with model id and cost source | ✗ FAILED | **Usage half verified. Redaction chokepoint verified. Host/Origin verified. The credential half still fails, by a different path than before.** All eight prior FAIL rows reproduce as PASS (table below) — the token is genuinely out of the markup and the document routes are genuinely behind the Host/Origin guard. But `GET /` on loopback still hands a full API credential to a request that presented nothing, and from there the install token is still obtainable: I chained `GET /` → `derive_session` → `POST /api/materials/repo` on a folder holding `notes.md -> DATA_DIR/token` → `GET /api/materials/:id?text=1`, which returned the 64-hex token verbatim, with no credential presented at any step. See Gaps Summary. |

**Score:** 3/5 truths verified (1 present, behavior-unverified; 1 failed)

### Deferred Items

None. Phase 2 (Settings and Secrets) puts provider keys into this same process;
none of its success criteria address the loopback credential, the symlink read
or the clone redirect. The phase goal's own wording — "the local server is
hardened **before it ever holds a key**" — makes these blocking for Phase 2
rather than deferrable to it.

### Advisory (New Scope, Unevidenced)

New-scope findings with no deterministic evidence — reported, not blocking, and
they do not revert a completed must-have.

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | Boot sweep closes turns without `closeUsage`, breaking the ledger invariant on every restart (`index.ts:69-71`) | other | new-scope, code read only, no failing test |
| 2 | Host check requires an explicit port, so `PORT=80`/`443` refuses every browser (`index.ts:202`) | other | new-scope, not reproduced (no privileged port here) |
| 3 | `c.redirect(c.req.path)` is a protocol-relative open redirect and a CRLF 500 (`index.ts:1101`) | security | new-scope, reachable only post-token on a widened bind, not reproduced |
| 4 | `/api/health` is exempt from `guardLocal` entirely, not only from the credential (`index.ts:228`) | security | new-scope, code read only |
| 5 | `walk()` follows directory symlinks with no cycle guard (`repo.ts:122-143`) | other | new-scope, same fix as the blocking symlink finding, not separately reproduced |
| 6 | `DELETE /api/learners/:id` leaves pending prompts, held cards and `recentCards` alive (`index.ts:312-322`) | other | new-scope, code read only |

Note on the gate: the two findings that *do* block below are not advisory —
both were reproduced with a command and an output on this machine, and the
evidence gate preserves evidenced security findings as blockers.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `server/src/tools.ts` | 22-tool registry, single source | ✓ VERIFIED | Unchanged by the gap closure; consumed by agent, mcp, index, codex |
| `server/test/wire-surface.json` | Committed 3-surface fixture | ✓ VERIFIED | `git diff --quiet 239d5f1..HEAD` exits 0; 22 mcp / 14 agent / 16 http rows intact |
| `server/test/wire-surface.test.ts` | Fails on any surface drift | ✓ VERIFIED | `ok 42 - the wire surface`, 11 subtests |
| `server/test/mcp.test.ts` | Stdio smoke test, no model | ✓ VERIFIED | Drives `server/dist/mcp.js`; green in the 144/144 run |
| `method/*.md` + `method/surfaces/*.md` | Canonical method source | ✓ VERIFIED | 6 rendered copies match |
| `scripts/check-method.mjs` | Byte-exact drift gate | ✓ VERIFIED | exit 0 on the clean tree; wired at ci.yml:37 |
| `server/src/driver.ts` | Driver + EventSink seam | ✓ VERIFIED | `runTurn(ctx, sink)` at line 86 |
| `server/src/drivers/fake.ts` | Permanent third-driver proof | ✓ VERIFIED | 86 lines |
| `server/src/migrations.ts` | Numbered transactional runner | ✓ VERIFIED | Live DB at `user_version 3` |
| `server/src/db.ts` | Transactional deletes incl. turns/usage | ✓ VERIFIED | WR-01 closed; reproduced 1 → 0 on both tables |
| `server/src/secrets.ts` | redact / redactDeep / redactErrors | ✓ VERIFIED | Wired at events.ts:18,30,40,45 and export.ts:176 |
| `server/test/tx.test.ts` | Row counts on every delete case | ✓ VERIFIED | Counts over the whole table, orphan path included |
| `server/test/guards.test.ts` | Egress destination guards | ✓ VERIFIED | Doc comment corrected to what the cases drive; cloning block now drives `collectRepo` at four private addresses |
| `server/src/repo.ts` | Every egress behind one guard, imports read nothing secret | ⚠️ PARTIAL | `assertPublicHost` now called at line 276 before `mkdtempSync` — that link is genuinely wired. But the guard does not survive git's first redirect, and the importer follows symlinks out of the tree (both below) |
| `server/src/index.ts` | The front door | ⚠️ PARTIAL | Host, Origin, unspecified-name and per-request `hostNames` all correct and reproduced. The loopback document route issues a working API credential for nothing, and the comment at 1075-1077 says otherwise |
| `server/test/security.test.ts` | The front door, proven | ⚠️ INCOMPLETE | 202 lines added and the new cases are real (foreign Host/Origin on `/`, no token in any body or header, cookie != token). The doc comment at 5-8 still states a stronger property than any case bounds |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `server/src/tools.ts` | agent / mcp / index / codex | `toolsFor` + `ACTION_SCHEMAS` | ✓ WIRED | Unchanged by the gap closure |
| `method/*.md` | 6 rendered targets | `renderRegion` markers | ✓ WIRED | `check-method.mjs` exit 0 |
| `driver.ts sinkFor` | `events.ts` / `db.ts recordUsage` | EventSink | ✓ WIRED | driver.ts:99-110 |
| `migrations.ts runMigrations` | `db.ts` import-time slot | before `q` | ✓ WIRED | Live DB at `user_version 3` |
| `secrets.ts redactDeep` | `events.ts` emit/emitUpdate/emitEphemeral | chokepoint | ✓ WIRED | events.ts:18,30,40,45 |
| `secrets.ts redact` | `export.ts renderMarkdown` | final egress | ✓ WIRED | export.ts:176 |
| `library.ts assertPublicHost` | `repo.ts fromGitClone` | host guard | ✓ WIRED | repo.ts:276, before `mkdtempSync` and before the spawn — the prior pass's NOT WIRED link is closed |
| `deleteLesson` / `deleteLearner` | `turns` + `usage` | inside `withTx` | ✓ WIRED | db.ts:366-368, 416-417; reproduced |
| `TOKEN` | `SESSION` | `HMAC-SHA256(TOKEN, 'derive browser session v1')` | ✓ WIRED | index.ts:107; cookie is 64 hex and is not the token file's contents |
| `guardLocal` | `/`, `/index.html`, `serveStatic`, catch-all | `app.use('/*')` | ✓ WIRED | Reproduced: `Host: evil.com` and `Origin: http://evil.com` both 403 on `/` |
| `localAddress(c)` | `hostNames(c)` → the Host allowlist | per-request | ✓ WIRED | Reproduced on a real LAN address in both directions |
| document route | a credential the caller had to present | — | ✗ NOT WIRED | On loopback there is no credential step at all: `issueSession` runs for any request that reached the route |
| `assertPublicHost` | the URL `git` actually fetches | redirect re-check | ✗ NOT WIRED | No `http.followRedirects=false`; git's documented default is `initial`, which follows the one hop that matters |
| `isSecretName` | the bytes an import actually reads | path filter | ✗ NOT WIRED | The filter judges the in-repo name; `statSync`/`readFileSync` follow the link to anywhere on disk |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `usage` table | input/output/cache_read/cache_write/reasoning + model + cost_source | driver `sink.usage(row)` → `recordUsage` | ✓ all seven columns present on the live schema; null rather than estimated when unreported | ✓ FLOWING |
| `turns` table | `busy()` and boot recovery | `turns` rows | ✓ | ✓ FLOWING |
| served `index.html` | document body | `readFileSync(indexPath)` verbatim | ✓ no rewrite, no token | ✓ FLOWING |
| `derive_session` cookie | browser credential | `HMAC-SHA256(TOKEN, …)` | ✓ — but issued to callers that presented nothing | ⚠️ HOLLOW (the value is real; the gate in front of it is not) |
| `materials.text` | course material the model reads | `fromDirectory` → `readFileSync(full)` | ✓ — including files outside the imported tree, the install token among them | ✗ DISCONNECTED from the guard that is supposed to bound it |

### Behavioral Spot-Checks

All eight prior ✗ FAIL rows re-run with my own instruments: `server/dist/index.js`
started on a scratch `DERIVE_DATA_DIR` at port 4931 (loopback) and 4932
(`DERIVE_HOST=0.0.0.0`), raw `curl`, and a direct drive of `fromDirectory`. The
learner's own `~/.derive` and the running server on 4310 were not touched.

| Behavior | Command | Result | Status |
|---|---|---|---|
| Build | `pnpm build` (dist newer than src, verified by mtime) | up to date | ✓ PASS |
| Full suite (run once) | `pnpm test` | 144 tests, 43 suites, 0 fail | ✓ PASS |
| Method drift gate | `node scripts/check-method.mjs` | exit 0, "6 rendered copies match method/" | ✓ PASS |
| **`/` unauthenticated** (was FAIL) | `curl http://127.0.0.1:4931/` | 1087 bytes, `grep -c "$TOKEN"` = 0, no `derive-token` meta | ✓ PASS |
| **catch-all unauthenticated** (was FAIL) | `curl http://127.0.0.1:4931/anything/at/all` | 0 token matches | ✓ PASS |
| **`/` with foreign Host** (was FAIL) | `Host: evil.com` / `evil.com:4931` | 403 both | ✓ PASS |
| **`/` with foreign Origin** (was FAIL) | `Origin: http://evil.com` | 403 | ✓ PASS |
| **LAN request, `DERIVE_HOST=0.0.0.0`** (was FAIL) | valid token, `Host: 192.168.0.166:4932` | 200 | ✓ PASS |
| **forged loopback Host over LAN** (was FAIL) | valid token, `Host: 127.0.0.1:4932` to `192.168.0.166:4932` | 403 "derive answers on 192.168.0.166 at port 4932" | ✓ PASS |
| **token harvestable over LAN** (was FAIL) | `curl http://192.168.0.166:4932/` | 401, no `Set-Cookie` | ✓ PASS |
| **LAN one-time handoff** | `curl "http://192.168.0.166:4932/?token=$T"` | 302 → `/`, `Set-Cookie: derive_session=…` | ✓ PASS |
| **clone guard wired** (was FAIL) | `grep -c assertPublicHost server/src/repo.ts` + read of 274-279 | called before `mkdtempSync` and before the spawn | ✓ PASS |
| **turns/usage deleted with the learner** (WR-01) | scratch DB: create learner + lesson + turn + usage, `deleteLearner` | turns 1→0, usage 1→0 | ✓ PASS |
| Token file permissions | `stat -c %a DATA_DIR/token` | 600 | ✓ PASS |
| Token absent from server log | `grep -c "$TOKEN" s1.log` | 0 | ✓ PASS |
| `/api/lessons` without credential | `curl`, no header, no cookie | 401 | ✓ PASS |
| SSE stream on the cookie alone | `…/stream?token=` with `Cookie: derive_session=…` | streams; without the cookie, 401 | ✓ PASS |
| Live DB migrated forward | `PRAGMA user_version` on `~/.derive/derive.db` | 3, with `turns` and `usage` | ✓ PASS |
| **unauthenticated `GET /` yields an API credential** | `GET /` → cookie (64 hex, != token file) → `GET /api/lessons` | 401 without it, **200 with it** | ✗ FAIL |
| **repo import reads outside the tree** | `fromDirectory` on a folder holding `notes.md -> ../outside.txt` and `token.md -> <abs path>` | both targets' bytes returned as material | ✗ FAIL |
| **install token returned by a route, no credential presented** | `GET /` → cookie → `POST /api/materials/repo` on a folder holding `notes.md -> DATA_DIR/token` → `GET /api/materials/:id?text=1` | response body contains the 64-hex install token verbatim | ✗ FAIL |
| **clone guard survives a redirect** | two loopback fixture servers, `git clone` through a 302 | inconclusive — git received 0 requests; no outbound HTTP in this environment (WINDOWS.md #3). `man git-config`: "The default is `initial`" | ? SKIP → judged on the documented default + the absent flag |

### Probe Execution

No `scripts/*/tests/probe-*.sh` exist and no plan declares one. **SKIPPED** — the
phase's model-free gate is `pnpm test`, run once above.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| FOUND-01 | 01-01, 01-02, 01-03 | 14 tutor tools defined once; every driver, MCP server and HTTP validation derive from it | ✓ SATISFIED | Registry unchanged by the gap closure; wire-surface fixture `git diff --quiet` clean; all four consumers still read it |
| FOUND-02 | 01-03 | Method defined once, rendered for app/plugin/Codex/docs; CI fails on drift | ✓ SATISFIED | `check-method.mjs` exit 0, "6 rendered copies match"; ci.yml:37 |
| FOUND-03 | 01-04 | Every driver behind one interface and one event sink | ✓ SATISFIED | `runTurn(ctx, sink)`; `EVENT_TYPES`/`applyEvent` untouched across the whole phase |
| FOUND-04 | 01-01, 01-02, 01-08, 01-12 | Plugin and Codex paths keep working, proven by snapshot + model-free stdio smoke test | ⚠️ PARTIAL / NEEDS HUMAN | Machine half proven and re-proven after the authentication change. Human half confirmed unperformed: `~/.codex/skills` absent, no `derive` in `~/.claude/plugins/config.json` |
| FOUND-05 | 01-05, 01-06, 01-11 | Numbered transactional migration runner; transactional deletes; existing DBs migrate forward | ✓ SATISFIED | Live DB at `user_version 3`; WR-01 closed and reproduced |
| FOUND-06 | 01-07, 01-08, 01-09, 01-10 | Loopback only, Host and Origin checks, per-install token, secrets redacted from every error/log/event/export path before any key is stored | ✗ BLOCKED | Host/Origin and the redaction chokepoint verified. The credential is obtainable for nothing on loopback, and the install token itself is still returned by a route from that position |
| COST-01 | 01-06 | Every turn persists raw usage with model id and cost source | ✓ SATISFIED | `usage` carries `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`, `reasoning_tokens`, `model`, `cost_source`, `cost_usd`, `driver`, `lesson_id`, `learner_id`, `ts`; nulls rather than estimates; suites green |

**Orphaned requirements:** none. All 7 IDs mapped to Phase 1 in REQUIREMENTS.md
(lines 143-148, 167) are claimed by at least one plan.

**REQUIREMENTS.md accuracy:** lines 143-148 currently read `Gaps Found` for
FOUND-01 through FOUND-04 and FOUND-06. FOUND-01, FOUND-02 and FOUND-03 should
be flipped to `Complete` — each is independently verified above and none was
touched by the gap closure. FOUND-04 should read `Needs Human` (its machine half
is done; only the parity run is outstanding). **FOUND-06 stays `Gaps Found`.**
The checkbox list at lines 14-19 should match.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | `TBD` / `FIXME` / `XXX` | — | None across the 34 changed code files |
| — | — | `TODO` / `HACK` / `PLACEHOLDER` | — | None |
| `server/src/index.ts` | 1093, 1070 | Document route issues a full API credential to a request that presented none | 🛑 Blocker | Reproduced; see Gaps Summary |
| `server/src/repo.ts` | 139, 161-170 | `statSync`/`readFileSync` follow symlinks; `isSecretName` judges the in-repo name only | 🛑 Blocker | Reproduced; the install token reached an HTTP response body through it |
| `server/src/repo.ts` | 274-279 | Guard judges the supplied URL; `git`'s `http.followRedirects` default is `initial` | 🛑 Blocker | Against 01-08's own must-have "re-checking after each redirect". Documented default + absent flag; not reproduced (no outbound HTTP here) |
| `server/src/index.ts` | 1075-1077 | "The document routes are protected at least as well as the API they unlock" | 🛑 Blocker | Strictly false: the API requires a credential, the document route requires none and issues one. This is the comment that *replaced* the one the prior pass flagged |
| `server/test/security.test.ts` | 5-8 | "used to be open to any process on the machine … These cases are the proof that it is not" | 🛑 Blocker | Still open to any process on the machine; a green suite over a false guarantee, in the file plan 01-09's prohibition names |
| `server/src/index.ts` | 102 | "never logged, never emitted, and never returned by any route" | 🛑 Blocker | Reproduced returned by `GET /api/materials/:id?text=1` |
| `server/src/index.ts` | 1092-1093 | `if (!here || isLoopback(here))` fails open where `hostNames` (152) fails closed | ⚠️ Warning | An unknown local address gets the free credential; the widened-bind protection collapses on the one condition both functions call unknowable |
| `server/src/repo.ts` | 255 | `fromGitHub` filter omits `isSecretName`, which its own doc comment promises runs on both paths | ⚠️ Warning | `auth.json` and `.env.example` are collected from a tarball and refused from a folder, for no stated reason |
| `web/src/lib/api.ts` | 26-33 | `deriveToken()` reads a meta tag the server no longer writes; always returns `''` | ⚠️ Warning | The comment describes a mechanism that no longer exists; every browser request now depends on the cookie by default rather than by anything stated. Same at `useLesson.ts:255-257` and the now-callerless `/stream` query branch at `index.ts:234` |
| `server/test/security.test.ts` | 199-202 | "no Host header" case passes because node's parser rejects the request, with or without `guardLocal` | ⚠️ Warning | Filed under `describe('the Host check')` and will be read as coverage |
| `server/test/security.test.ts` | 88, 229 | Fixed random port ranges (4900+, 5000+) with no `EADDRINUSE` retry | ℹ️ Info | Two concurrent runs, or a stray process, fail the suite with "server did not start" |
| `server/src/index.ts` | 1063 | "No expiry, so it dies with the tab's session" describes the cookie; the server-side value never rotates | ℹ️ Info | A captured `Set-Cookie` stays valid until `~/.derive/token` is deleted; no per-browser revocation |
| `server/src/db.ts` | 413-415 | Comment invokes a FK relationship SQLite is not enforcing (`PRAGMA foreign_keys` is never on) | ℹ️ Info | The ordering is right and harmless, but nothing enforces or tests it |
| `server/src/repo.ts` | 14-15, `library.ts` 31-32 | The `repo → library → materials → repo` ring is enforced by convention only | ℹ️ Info | Traced and it resolves today. A leaf `net-guard.ts` would remove the trap and keep one guard |

### Human Verification Required

#### 1. Plugin and Codex parity run (FOUND-04, Success Criterion 1 — WINDOWS.md #5 / HC-2)

**Test:**
1. In a Claude Code session with the plugin installed from this repo, run
   `/derive:learn` on any small topic. Confirm: the companion page opens; the
   tutor probes before planning; `set_plan` renders a graph and waits for your
   approval; a check question renders as a card and grades; locking a node lights
   the graph; `/derive:review` on a later run offers the nodes that are due.
2. In a Codex session with the Derive skills installed, run `derive-learn` on any
   small topic and confirm the same sequence. This is the first run where the
   Codex skill has a real method body rather than tool descriptions alone —
   confirm the tutor teaches rather than only quizzing.
3. Confirm nothing the learner sees has changed: same cards, same graph, same
   phases, same wording of the refusal when you try to lock a node on a procedure
   question alone.

**Expected:** Both lessons complete exactly as before; report anything that
behaves differently, however small.

**Why human:** Needs a real model and a real login on two terminals. I confirmed
it has not been run rather than taking the summary's word: `~/.codex/skills` does
not exist and `~/.claude/plugins/config.json` has no `derive` entry.

**Note:** run this *after* the Criterion 5 gaps close — step 1 opens the browser
companion page, which is the route the credential defect sits on.

#### 2. Browser session-cookie smoke (WINDOWS.md #4 / HC-1)

**Test:** Open `http://localhost:4310` in a real browser, start a lesson, answer
a card, watch the graph update, and check DevTools' Network tab.

**Expected:** The page loads, the SSE stream connects, cards render and answers
land — all carried by the `derive_session` cookie, with no `x-derive-token`
header sent by the page.

**Why human:** No automated test drives a real browser. `curl` proves the cookie
authenticates both `/api/lessons` and the SSE stream; it cannot prove the page's
own `fetch` and `EventSource` send it. That matters more than it did: `deriveToken()`
now always returns `''` (WR-09), so the page sends no header at all and the whole
browser path rests on a default nothing in the code states.

### Gaps Summary

The gap closure did real work, and I checked it rather than read about it. All
eight spot-checks the prior pass recorded as `✗ FAIL` reproduce as `✓ PASS`
against a freshly started `server/dist/index.js` on a scratch data dir. `GET /`
returns 1087 bytes with zero matches for the install token and no `derive-token`
meta. `Host: evil.com` and `Origin: http://evil.com` are refused 403 on the
document route, not just on `/api/*`. On a real LAN address with
`DERIVE_HOST=0.0.0.0`, a request naming `192.168.0.166:4932` and carrying the
token is admitted 200 while the same connection forging `Host: 127.0.0.1:4932`
is refused with a message naming the address it actually arrived on — both
directions of the broken allowlist are fixed, and the `?token=` handoff returns
a 302 and a cookie exactly as documented. `assertPublicHost` is called inside
`fromGitClone` before `mkdtempSync`, and `guards.test.ts` now drives `collectRepo`
at four private addresses instead of testing the scheme alone — its doc comment
was rewritten to claim only what its cases exercise, which is the right response
to the last pass's complaint. WR-01 is closed: on a scratch database a learner
with one turn and one usage row leaves zero of each. Four of the five success
criteria hold, `pnpm test` is 144/144 across 43 suites, and `git diff --quiet --
web/` is clean across all four plans.

Success Criterion 5 still does not hold. It fails at the same place, by a
different mechanism, and I reproduced it end to end.

The document route on loopback returns early — `if (!here || isLoopback(here))
return next();` (`index.ts:1093`) — and `serveApp` then calls `issueSession`
unconditionally. So one GET with no headers yields a `derive_session` cookie that
the `/api/*` middleware accepts as a credential. I confirmed the cookie is 64 hex
and is *not* the contents of the token file, that `/api/lessons` is 401 without it
and 200 with it, and that the SSE stream behaves the same way. The genuine
improvements over the old defect are that the value is `HttpOnly` (page script
cannot read it) and is not the install token. What did not change is the reach:
any process that can open a socket to the port still gets everything the API can
do, without presenting anything.

From that position the install token itself is still reachable, which is the part
that turns a documented residual into a failure. `fromDirectory` resolves every
entry with `statSync`/`readFileSync`, both of which follow symlinks, and
`isSecretName` is applied to the repo-relative path — so a link named anything
ordinary reads its target from anywhere on disk into course material. I imported
a folder holding `notes.md -> DATA_DIR/token` using only the free cookie, then
read the material back:

```
GET /                                   -> Set-Cookie: derive_session=<64 hex>
POST /api/materials/repo  (cookie only) -> {"id":"f1afadae-…","kind":"repo","pages":2}
GET /api/materials/<id>?text=1          -> "…notes.md\n7014b281…d088713"
```

That last value is the install token, in full, in an HTTP response body, obtained
by a caller that presented no credential at any step. It falsifies `index.ts:102`
("never logged, never emitted, and never returned by any route") and D-09 as plan
01-09 strengthened it ("it now never leaves the server process at all"). Material
text does not pass the `emit` redaction chokepoint — `materialEvent` (`index.ts:475`)
carries metadata only, and the export lists names — so the redaction work, which
is otherwise correct and correctly kept off lesson content, cannot catch this.
And because material text is what the tutor reads, the same path sends the token
off the machine to the model, which is the one thing the milestone constraint in
`CLAUDE.md` forbids. The remote form of this needs no local access at all: a
hostile public repository, or a prompt-injected model choosing one, reaches
`attach_material` → `collectRepo` → `fromGitClone` → `fromDirectory` and reads
`~/.ssh/id_rsa` or `~/.derive/token` the same way. I reproduced the read
mechanism directly; I could not drive a clone because this environment has no
outbound HTTP for git (WINDOWS.md #3 records the same limit), but the two lines
connecting them are a straight read of `repo.ts:286`.

The third item is smaller and sits on the same premise. `fromGitClone` now runs
`assertPublicHost`, which was the prior gap, but it judges only the URL the caller
handed it. `man git-config` on this machine: "If set to `initial`, git will follow
redirects only for the initial request to a remote … The default is `initial`."
The initial request is the one the guard judged. No `-c http.followRedirects=false`
is passed, so a public URL that 302s to `10.0.0.5` or `169.254.169.254` is followed
unchecked. `fetchPublic` already re-checks every hop and its own comment at
`library.ts:322-324` explains why; the clone path does not apply its own module's
lesson, and plan 01-08's must-have says every library and repo fetch re-checks
after each redirect. I could not reproduce this one — git received zero requests
from two loopback fixture servers — so it rests on the documented default and the
absent flag rather than on an observed bypass.

What decides the verdict rather than the individual defects is that two in-repo
statements assert the guarantee the code does not have, in the same files and the
same shape the phase already repaired once. `index.ts:1075-1077` — the comment
that *replaced* the one the prior pass flagged — says "The document routes are
protected at least as well as the API they unlock." They are strictly weaker: the
API requires a credential, the document route requires none and issues one.
`security.test.ts:5-8` says the API "used to be open to any process on the
machine … These cases are the proof that it is not", and every case that touches
the document route exercises the credential-issuing path and asserts it succeeds.
Plan 01-09 carries the prohibition "Never make a test pass by narrowing what it
asserts; this phase already shipped three green suites over guarantees the code
did not deliver, and that is the failure being repaired here." `doctor.mjs:74-75`
*was* corrected honestly ("or who can reach the port from this machine"), which
shows the residual was understood — and makes the two remaining claims a
contradiction inside the same change rather than an oversight.

So the residual is a defensible engineering choice and the prior gap's own text
named a cookie as the acceptable minimum. But it has to be either closed or
stated, and right now it is neither — and while the repo importer follows
symlinks, a caller who never presented a credential can read the install token
out of the server anyway, which is not a residual anyone chose.

One item remains unproven rather than failed. Success Criterion 1's machine half
is solid and survived the authentication change intact (wire-surface fixture
byte-identical, stdio MCP smoke green, `web/` untouched). Its human half — one
real lesson through the Claude Code plugin and one through the Codex skills —
still has not been run, and I verified that rather than inferring it: the plugin
is not registered in `~/.claude/plugins/config.json` and `~/.codex/skills` does
not exist. It should run after Criterion 5 closes, since it walks the browser
companion path.

---

_Verified: 2026-09-19T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
