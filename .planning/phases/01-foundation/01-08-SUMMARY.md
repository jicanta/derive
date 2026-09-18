---
phase: 01-foundation
plan: 08
subsystem: api
tags: [security, redaction, secrets, ssrf, dns, path-traversal, obsidian, parity]

# Dependency graph
requires:
  - phase: 01-07
    provides: the /api/* auth middleware and the 0600 per-install token — the one live secret this plan had to protect and must not weaken
  - phase: 01-04
    provides: the Driver/EventSink seam, whose endTurn error path is one of the egress points now redacted
  - phase: 01-02
    provides: server/test/mcp.test.ts and the wire-surface fixture the plugin self-consistency check reads
provides:
  - "server/src/secrets.ts: registerSecret, redact, redactDeep, redactErrors, safeMessage, secretCount, clearSecrets, REDACTED"
  - "one exact-match chokepoint on every egress: emit, emitUpdate, checkpoint, emitEphemeral, renderMarkdown"
  - "the key-shaped pattern backstop confined to errors and logs (D-11), proven by a test that a teaching example reaches the vault byte-intact"
  - "server/src/library.ts assertPublicHost + isPrivateAddress, and fetchPublic() — a manual redirect loop that re-checks every hop"
  - "server/src/repo.ts isSecretName, the / and ~ root refusal, https-only fromGitClone, and readCapped + a timeout on the GitHub tarball"
  - "server/test/secrets.test.ts (14 cases) and server/test/guards.test.ts (18 cases), both offline"
affects: [phase 02 (provider keys land in a process where registerSecret already exists), phase 03 (the tutor's own web fetch runs behind the same host guard)]

actuals:
  tokens: 44458
  tasks: 3
  commits: 2
  plan_head_before: 8afb2ead51006c699ba62be7c6b8db8a4d3b2409

tech-stack:
  added: []
  patterns:
    - "Exact-match redaction is safe everywhere because it can only remove a value the process itself registered; pattern matching is not, so it is confined to errors and logs"
    - "One chokepoint at the fan-out rather than at each writer, so the database, the SSE stream and the vault mirror all see the same already-clean payload"
    - "A destination guard resolves before it trusts, and runs again on every redirect hop — a name check alone is not a check"
    - "A guard that precedes a process spawn sits before the spawn, not inside a try around it"

key-files:
  created:
    - server/src/secrets.ts
    - server/test/secrets.test.ts
    - server/test/guards.test.ts
  modified:
    - server/src/events.ts
    - server/src/export.ts
    - server/src/index.ts
    - server/src/agent.ts
    - server/src/codex.ts
    - server/src/migrations.ts
    - server/src/library.ts
    - server/src/repo.ts
    - server/test/security.test.ts

key-decisions:
  - "A 16-character minimum on a registered value, refused silently rather than thrown. A blank or tiny registered secret would turn redact() into a text shredder that eats ordinary lesson prose, and the failure would be invisible — the lesson would simply come out wrong. Throwing was rejected because the caller in Phase 2 will be loading a key that may legitimately be absent, and a boot that dies because no key is configured is worse than one that registers nothing."
  - "Redaction happens inside events.ts at the fan-out, not at each emit() caller. Doing it per caller leaves a window where an unredacted payload exists downstream (the database write, a late subscriber), and it is a rule every future writer has to remember. One chokepoint is the whole point of D-11."
  - "renderMarkdown() is redacted rather than exportToVault(), so the debounced mirror, the explicit export and the /api export route are all covered by one call in one place."
  - "redact uses split/join over a regex. No escaping, no catastrophic backtracking, and longest-value-first ordering is then trivially correct when one registered secret contains another."
  - "safeMessage(e) was added rather than wrapping each site by hand, because every catch in the server already spells `e instanceof Error ? e.message : String(e)`; folding the narrowing and the redaction into one named helper keeps eleven sites readable and makes the twelfth hard to get wrong."
  - "ensureToken()'s own two error messages are left unredacted. They run before registerSecret and name the token path, never the token value; redacting them would be theatre."
  - "get() in library.ts was renamed to fetchPublic() and exported. The name now states what the function guarantees, and exporting it is what lets the per-hop redirect check be proven offline against a fixture on this machine — which is otherwise untestable, since the fixture is loopback and hop one would be refused."
  - "fetchPublic carries an optional guard parameter, used only by that test and documented as such. The alternative — allowing loopback under an env flag — would have put a real bypass in the product to serve a test."
  - "isPrivateAddress returns true for anything that is not a parseable address. A guard that cannot tell where a request is going must not let it go."
  - "normalizeUrl now refuses a non-http scheme by name rather than letting `data:` and `javascript:` fall through to the incidental `not a URL` message. The scheme regex excludes a digit after the colon so `example.com:8080/x` is still a host and a port, not a scheme."
  - "isSecretName is applied in walk() as well as in fromDirectory()'s filter, so a credential file is never collected, not merely dropped later."
  - "readCapped takes its cap as an argument and builds its message from that argument, so the one production call and the tests describe the same limit honestly."

patterns-established:
  - "A new secret value in this codebase is registered with registerSecret() at the moment it is read or created, before anything can serve a request; nothing else is needed for it to be safe in errors, logs, events and the vault"
  - "A new outbound fetch goes through fetchPublic(); a new repository path goes through isSecretName()"

requirements-completed: [FOUND-06, FOUND-04]

coverage:
  - id: D1
    description: "No registered secret reaches an event, the database, the SSE stream, the Markdown export or the vault mirror"
    requirement: FOUND-06
    verification:
      - kind: unit
        ref: "server/test/secrets.test.ts#takes a registered secret out of an event, however deeply it sits"
        status: pass
      - kind: unit
        ref: "server/test/secrets.test.ts#takes it out of the rendered Markdown the vault gets"
        status: pass
      - kind: unit
        ref: "server/test/secrets.test.ts#leaves no fragment when one registered secret contains another"
        status: pass
    human_judgment: false
  - id: D2
    description: "No registered secret and no key-shaped string reaches an error body or a [tag] log line"
    requirement: FOUND-06
    verification:
      - kind: integration
        ref: "server/test/security.test.ts#an error body that would have carried the token / says [redacted] instead"
        status: pass
      - kind: unit
        ref: "server/test/secrets.test.ts#catches an unregistered key in an error message"
        status: pass
      - kind: other
        ref: "grep of server/src/index.ts — every catch-built { error } body and every [tag] console line goes through safeMessage; the only two remaining raw narrowings are inside ensureToken, which runs before registration and names only a path"
        status: pass
    human_judgment: false
  - id: D3
    description: "The pattern backstop never touches lesson events, exports or the vault mirror — a lesson that teaches about API credentials survives byte-intact (D-11)"
    requirement: FOUND-06
    verification:
      - kind: unit
        ref: "server/test/secrets.test.ts#survives byte-intact through the event stream and the vault, and is still cleaned out of an error body"
        status: pass
      - kind: unit
        ref: "server/test/secrets.test.ts#is the only thing doing pattern matching: plain redact leaves a key-shaped string alone"
        status: pass
      - kind: unit
        ref: "server/test/secrets.test.ts#round-trips a payload deep-equal when nothing is registered"
        status: pass
    human_judgment: false
  - id: D4
    description: "Registering an empty, blank or too-short value is a no-op, so redaction cannot become a text shredder"
    requirement: FOUND-06
    verification:
      - kind: unit
        ref: "server/test/secrets.test.ts#ignores empty, blank and too-short values"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every library fetch resolves the host and refuses private, loopback, link-local, CGNAT and unique-local destinations, re-checked on every redirect hop (D-10)"
    requirement: FOUND-06
    verification:
      - kind: unit
        ref: "server/test/guards.test.ts#knows every range a fetch must not reach / lets an ordinary public address through"
        status: pass
      - kind: unit
        ref: "server/test/guards.test.ts#refuses a literal on this machine or this network / refuses a hostname that resolves to loopback"
        status: pass
      - kind: integration
        ref: "server/test/guards.test.ts#checks the second hop, not only the first (local fixture server, 302 to loopback)"
        status: pass
      - kind: other
        ref: "grep -c assertPublicHost server/src/library.ts = 2 (the definition and the call inside the redirect loop)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Repo import refuses / and ~, skips secret-shaped filenames, and clones only over https (D-10)"
    requirement: FOUND-06
    verification:
      - kind: unit
        ref: "server/test/guards.test.ts#refuses the whole disk and the whole home folder"
        status: pass
      - kind: unit
        ref: "server/test/guards.test.ts#imports the ordinary file and nothing else (credentials, id_rsa, .env, .env.example, config/auth.json present; only README.md imported)"
        status: pass
      - kind: unit
        ref: "server/test/guards.test.ts#refuses anything that is not https, before git is spawned (no clone- scratch directory created)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The GitHub tarball fetch carries a timeout and a size cap, bounding the in-memory decompression"
    requirement: FOUND-06
    verification:
      - kind: unit
        ref: "server/test/guards.test.ts#refuses a declared length over the cap before a byte is buffered / bounds the read when nothing is declared / carries a timeout"
        status: pass
    human_judgment: false
  - id: D8
    description: "The machine half of the plugin and Codex parity proof: the full model-free gate, an unmoved wire surface, and a self-consistent plugin"
    requirement: FOUND-04
    verification:
      - kind: other
        ref: "pnpm method:check (6 rendered copies match), pnpm typecheck, pnpm build, pnpm test (121 pass / 0 fail), node scripts/doctor.mjs (exit 0, all green)"
        status: pass
      - kind: other
        ref: "git diff --quiet 8afb2ea..HEAD -- server/test/wire-surface.json exits 0; the file was last touched in 01-02"
        status: pass
      - kind: other
        ref: "plugin/.mcp.json resolves to server/dist/mcp.js (exists); plugin.json version 0.4.0 equals /api/health version 0.4.0; learn.md's 21 and review.md's 15 mcp__ names are all in the 22-name tools/list fixture, tail WebSearch/WebFetch/Skill excluded"
        status: pass
    human_judgment: false
  - id: D9
    description: "A real lesson through the Claude Code plugin and a real lesson through the Codex skills both complete exactly as before"
    requirement: FOUND-04
    verification: []
    human_judgment: true
    rationale: "Needs a real model and a real login on two terminals. Carried as the <human-check> on task 3 and queued for the end-of-phase UAT harvest (workflow.human_verify_mode is end-of-phase). NOT performed in this plan."

duration: 52 min
completed: 2026-09-18
status: complete
---

# Phase 01 Plan 08: Redaction, Destination Guards and the Parity Proof Summary

One `redact()` chokepoint takes registered secrets out of every egress with exact
matching, the key-shaped backstop stays on errors and logs so a lesson about API
credentials still reaches Obsidian intact, and the library fetch, the repo import
and `git clone` can no longer be pointed at this machine.

## Accomplishments

**`server/src/secrets.ts` — the one place a secret leaves the process.**
`registerSecret` takes a live value and ignores anything empty, whitespace-only or
under sixteen characters. `redact` replaces exact occurrences, longest value first
so no fragment of an overlapping secret survives, and short-circuits on an empty
registry because it runs on every emitted event. `redactDeep` is the same walk over
a JSON-serialisable value, which is the form an event payload takes. `redactErrors`
is `redact` plus the key-shaped patterns D-11 names (`sk-ant-`, `sk-`, `AIza`,
`Bearer …`) and is the only function in the codebase that matches on shape.
`safeMessage(e)` folds the narrowing every catch already spells into one call.

**The exact-match chokepoint.** `emit`, `emitUpdate`, `checkpoint` and
`emitEphemeral` run `redactDeep` before anything is persisted or fanned out, so the
database, the SSE stream and every subscriber see the same clean payload with no
window downstream. `renderMarkdown` runs `redact` on the finished note, which covers
`exportToVault` and the debounced `mirrorToVault` in one place.

**The backstop, where D-11 put it.** Every catch-built `{ error }` body in
`server/src/index.ts` and every `[tag]`-prefixed console line — `[turn]`, `[vault]`,
`[codex]`, `[migrate]` — plus the driver-level `endTurn({ ok: false, error })` in
both `agent.ts` and `codex.ts` go through `safeMessage`/`redactErrors`. Nothing
else does. The most explicit test in the file proves the consequence: a
`sk-ant-…` example inside teaching prose reaches the learner's vault byte-intact
while the same string is stripped from an error body.

**The install token is registered immediately after `ensureToken()` returns**, before
a single route is declared, so no request can be served while the value can still
reach a log line, an error or a lesson note.

**Destination guards (D-10).** `assertPublicHost` resolves a hostname with
`node:dns/promises` and judges every address it answers with — loopback,
unspecified, link-local including 169.254.169.254, the three RFC-1918 blocks,
carrier-grade NAT, multicast and reserved space, and the IPv6 equivalents including
unique-local `fc00::/7` and IPv4-mapped forms. A literal is judged directly. `get()`
became `fetchPublic()`: a manual redirect loop bounded at five hops that checks
where each hop actually goes before taking it, keeping the existing timeout, size
caps, accept headers and final-URL return exactly as they were.

**Ingest guards (D-10).** `isSecretName` denies `credentials`, any `.pem` or `.key`,
any `id_*`, `.netrc`, `.npmrc`, `auth.json` and any `.env*`, applied in `walk` as
well as in `fromDirectory`'s filter so a matching file is never even collected.
`fromDirectory` refuses a root that resolves to the filesystem root or the home
directory. `fromGitClone` refuses anything that is not `https://` before the temp
directory is made and before git is spawned. The GitHub tarball fetch gained a
60-second timeout, a 60 MB cap checked on the declared length, and a bounded read
so a server that declares nothing cannot grow the buffer — which is what bounds the
in-memory gunzip that follows.

## Task 3: the machine half of the parity proof (FOUND-04)

Everything a machine can prove, proven and recorded.

| Gate | Result |
|---|---|
| `pnpm method:check` | `method: 6 rendered copies match method/` |
| `pnpm typecheck` | clean, server and web |
| `pnpm build` | clean |
| `pnpm test` | **121 pass / 0 fail**, 39 suites (was 88 at the start of this plan; +14 secrets, +18 guards, +1 security) |
| `node scripts/doctor.mjs` | exit 0 — Node, pnpm, Claude login, dependencies, build, data folder, install token (0600), server all green |
| `git diff --quiet -- server/test/wire-surface.json` | exit 0, working tree and across `8afb2ea..HEAD`; last touched in 01-02 |

**The plugin is self-consistent without running a model.**
`plugin/.mcp.json` points at `${CLAUDE_PLUGIN_ROOT}/../server/dist/mcp.js`, which
exists after `pnpm build`. `plugin/.claude-plugin/plugin.json` reports `0.4.0` and
`/api/health` reports `0.4.0`. `learn.md`'s 21 `mcp__plugin_derive_derive__*` names
and `review.md`'s 15 are all inside the 22-name `tools/list` set frozen in
`server/test/wire-surface.json` — the same set `server/test/mcp.test.ts` asserts the
built stdio binary actually serves — with the three non-registry tail entries
(`WebSearch`, `WebFetch`, `Skill`) excluded from the comparison.

**The server is running and the human needs to set nothing up.**

- URL: `http://localhost:4310` (`/api/health` → `{"ok":true,"version":"0.4.0","backend":"claude","backend_source":"auto"}`)
- Repository: `/home/jicanta/derive`
- Install token: `/home/jicanta/.derive/token`, mode `0600`, 64 hex characters
- Started with `node server/dist/index.js` from the repository root; log at `/tmp/derive-server-01-08.log`

One note for whoever picks this up: the process was started **without** the repo's
`.env` (the execution sandbox refuses to read that file). Defaults therefore apply —
port 4310, data in `~/.derive`, backend auto-detected as Claude. If your `.env` sets
`DERIVE_VAULT_DIR`, `DERIVE_BACKEND`, `DERIVE_MODEL` or `DERIVE_EFFORT` and you want
those for the parity run, stop this process and start it again with `pnpm start`.

## Queued for the phase UAT: the human half of FOUND-04

`workflow.human_verify_mode` is `end-of-phase`, so this was **recorded, not
performed**, and no claim is made about its outcome. Harvest it into the phase
verification pass verbatim:

> Run one real lesson through each terminal path and confirm both complete exactly
> as before. The Derive server is already running and the token is already in place;
> nothing needs setting up.
>
> 1. **Claude Code plugin:** in a Claude Code session with the plugin installed from
>    this repo, run `/derive:learn` on any small topic. Confirm: the companion page
>    opens in the browser; the tutor probes before planning; `set_plan` renders a
>    graph and waits for your approval; a check question renders as a card and
>    grades; locking a node lights the graph; and `/derive:review` on a later run
>    offers the nodes that are due.
> 2. **Codex skills:** in a Codex session with the Derive skills installed, run the
>    `derive-learn` skill on any small topic and confirm the same sequence. This is
>    also the first run where the Codex skill has a real method body rather than
>    tool descriptions alone — confirm the tutor teaches rather than just quizzing.
> 3. Confirm nothing the learner sees has changed from before this phase: same
>    cards, same graph, same phases, same wording of the refusals when you try to
>    lock a node on a procedure question alone.
>
> Report anything that behaves differently from the pre-phase build, however small.

## Deviations from Plan

**1. [Rule 2 — missing critical] `get()` renamed to `fetchPublic()` and exported, with an injectable guard**
- **Found during:** Task 2
- **Issue:** The plan's acceptance criterion asks for "a redirect chain whose second
  hop points at a loopback address is refused; assert with a local fixture server
  rather than a real remote host." A fixture server is on 127.0.0.1, so the real
  guard refuses hop one and the per-hop behaviour — the thing being asserted — is
  never reached. The criterion is untestable as written against a private function.
- **Fix:** `get()` is now `export async function fetchPublic(url, accept, maxBytes, guard?)`.
  The name states what the function guarantees. The optional `guard` is documented as
  existing only so the per-hop check can be proven offline; nothing in the server
  passes it, and the loop still reads `await (guard ?? assertPublicHost)(current)`.
  The rejected alternative was an env flag allowing loopback, which would have put a
  real bypass in the product to serve a test.
- **Files modified:** `server/src/library.ts` (four call sites), `server/test/guards.test.ts`
- **Verification:** `server/test/guards.test.ts#checks the second hop, not only the first` fails if the guard is hoisted out of the loop
- **Commit:** `0891e9d`

**2. [Rule 2 — missing critical] `normalizeUrl` refuses a non-http scheme by name**
- **Found during:** Task 2
- **Issue:** The plan asks to "keep the existing http/https scheme restriction in
  `normalizeUrl` and make it explicit rather than incidental." It was incidental:
  `data:text/html,hi` never reached the protocol check at all — the `://` heuristic
  prepended `https://` and it died as `not a URL: data:text/html,hi`. A message that
  says the wrong thing about why something was refused is a message nobody can act on.
- **Fix:** A scheme is now read off the front of the string and refused by name
  before anything else, with `(?!\d)` so `example.com:8080/x` is still a host and a
  port rather than a scheme.
- **Files modified:** `server/src/library.ts`
- **Verification:** `server/test/guards.test.ts#refuses a scheme that is not http(s)` covers `file:`, `data:` and `ftp:`
- **Commit:** `0891e9d`

**3. [Rule 1 — bug] `readCapped`'s refusal message ignored its own argument**
- **Found during:** Task 2
- **Issue:** The helper took `maxBytes` but built its error from the module constant,
  so a call with any other cap reported "larger than 60 MB" regardless. Only one
  production call exists today, but a parameter the message contradicts is a trap.
- **Fix:** `tooBig(maxBytes)` builds the message from the argument.
- **Files modified:** `server/src/repo.ts`
- **Verification:** `server/test/guards.test.ts#refuses a declared length over the cap before a byte is buffered`
- **Commit:** `0891e9d`

**4. [Process] Commits landed on `main`**
- `git.branching_strategy` is `"none"` for this project and every GSD commit in this
  repository, plans 01-01 through 01-07 included, is on `main`. This is the
  configured behaviour, recorded here the way the earlier plans recorded it.

**Total deviations:** 3 auto-fixed (2 missing-critical, 1 bug) plus 1 process note.
**Impact:** None on scope. Each of the three made an acceptance criterion actually
checkable rather than nominally satisfied.

## Deferred Issues

**An ordinary public URL fetch was not exercised end to end.** The execution
environment has no DNS and no outbound network — `dns.lookup('example.com')` and a
bare `fetch('https://example.com/')` both fail with `ENOTFOUND`, identically to each
other, so the guard introduces no divergence that could be observed here. The
redirect loop's mechanics are covered by the local fixture, and `normalizeUrl` and
`assertPublicHost` are covered directly. Logged to `.planning/WINDOWS.md` as an
`unrun-verify` against `server/src/library.ts`; the phase UAT parity run, which does
have a network, is where a real page fetch gets confirmed.

**One residual risk accepted by the plan's own threat model (T-08-09):** DNS
rebinding between `assertPublicHost`'s lookup and the fetch that follows leaves a
time-of-check-to-time-of-use window, as it does for any userland guard in Node.
Bounded by the loopback bind and the token from 01-07; closing it fully needs a
socket-level custom lookup and is out of scope for this phase.

**One behavioural narrowing worth naming:** a host Derive cannot resolve is now
refused rather than attempted. Behind an HTTP proxy that does its own resolution,
a reachable page would be turned away. Derive is local-first and a corporate proxy
is not a supported deployment, and D-10 asks for exactly this posture, so it is
recorded rather than worked around.

## Threat Flags

None. This plan added no network endpoint, no auth path and no schema change; it
removed reach from three existing ones.

## Self-Check: PASSED

- `server/src/secrets.ts` — FOUND
- `server/test/secrets.test.ts` — FOUND
- `server/test/guards.test.ts` — FOUND
- commit `ded2e72` — FOUND
- commit `0891e9d` — FOUND
- `pnpm method:check`, `pnpm typecheck`, `pnpm build`, `pnpm test` (121/0), `node scripts/doctor.mjs` — all re-run after the last commit, all green
- `git diff --quiet 8afb2ea..HEAD -- server/test/wire-surface.json` — exit 0

## Next

Phase 01 is complete: eight plans, eight summaries. Ready for the phase
verification pass, which must harvest the `<human-check>` above — the two real
lessons through the Claude Code plugin and the Codex skills — as the outstanding
half of FOUND-04 and of the phase's first success criterion.
