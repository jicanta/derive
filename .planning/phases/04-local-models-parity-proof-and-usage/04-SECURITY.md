---
phase: "04"
slug: "local-models-parity-proof-and-usage"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-23"
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

First audit (State B): no prior `04-SECURITY.md`. The register was authored at plan time — all six
PLANs carry a `<threat_model>` block — so the auditor verified mitigations rather than scanning for
new threats. 19/19 closed, `threats_open: 0`.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Learner-typed base URL → local model server | `settings.ts` accepts an http(s) origin the learner types and Derive then issues outbound requests to it. Inbound-local by design (loopback default, `config.ts:26`), but the destination is learner-controlled | Lesson prose, tool schemas, the learner's own material |
| Provider credentials at rest | Keys live in `~/.derive`, never leave the machine except to the provider they belong to | API keys, session tokens |
| Conformance report → CI artifact | `scripts/conformance.mjs` writes `report.json`, uploaded as a workflow artifact | Provider verdicts and failure reasons, which could otherwise carry key material |
| Server → browser | What the tutor and the ledger are allowed to show the learner | Lesson events, usage figures; the tool-rejection ledger and browser-side number formatting are both prohibited |
| SQLite migrations | `migrations.ts` alters the learner's single local database in place | Every learner record |
| `/api/*` surface | `guardLocal` + token/session on every route except the pre-existing `/api/health` (`index.ts:254-266`) | All API traffic |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-SC | Tampering | `ai-sdk-ollama@4.4.0` install | high | mitigate | Exact pin, no caret (`server/package.json:25`); sha512 integrity in `pnpm-lock.yaml:1190`; manifest + lockfile in one commit (`2216399`); `--frozen-lockfile` in `ci.yml:29` and `conformance.yml:47` | closed |
| T-04-01 | Information Disclosure | `scripts/conformance.mjs` → `report.json` → artifact | high | mitigate | Every key registered before the first provider request (`conformance.mjs:562`); `safe`/`safeOut` at `:563,:566`; every `reason` redacted (`:453,:456,:494,:596`); entry-point catch uses `safeOut` (`:613`). `keyNames` (`:291`) is a superset of the four workflow secrets. Control: `secrets.ts:35,42-45,105,112`, covered by `secrets.test.ts:36-107`. See advisory 1 | closed |
| T-04-09 | Spoofing / Information Disclosure | `POST /api/settings/:provider/test-teaching` | high | mitigate | Route never reads the body; learner is `learnerOf(c)` (`index.ts:821-830`). `createLesson` takes the learner from that parameter only (`capability.ts:765`). Exercised at `api.test.ts:562-575` | closed |
| T-04-07 | Spoofing / Information Disclosure | `GET /api/usage` learner scope | high | mitigate | `learnerUsage(learnerOf(c))` (`index.ts:1183`) → `listUsage({ learner })` → `WHERE learner_id = ?` (`db.ts:247`). Asserted both ways at `usage.test.ts:662-681`, including a GET whose body carries another learner id and changes nothing | closed |
| T-04-05 | Integrity (ledger / Usage total) | scratch lesson lifecycle | medium | mitigate | `scratch-lesson` migration (`migrations.ts:307,315`); `sweepScratchLessons` (`db.ts:544`) on the boot pass (`index.ts:85`); `deleteLesson` is one `withTx` with usage before turns (`db.ts:507-527`). Crash case asserted at `api.test.ts:646-687` | closed |
| T-04-06 | Tampering | `capability.ts` metadata parsers | medium | mitigate | `probeJson` keeps the status and nulls the body on non-JSON (`probe.ts:67-72`); typed predicates rather than status gates (`capability.ts:168,213-214,221,241,247`); HTML fixture test at `capability.test.ts:91,212-213` | closed |
| T-04-08 | Information Disclosure | capability verdict `error` field | medium | mitigate | `capabilityOf` answers rather than throws (`capability.ts:560-574`); `safeMessage` at `:570`; `hintFor` emits Derive-authored sentences only (`probe.ts:284-291`); route returns the verdict verbatim with no second path (`index.ts:802`) | closed |
| T-04-10 | Information Disclosure | `testTeaching` fail reason | medium | mitigate | `safeMessage` on every reason (`capability.ts:761,786,803`); `TIMED_OUT`/`NO_TOOLS`/`UNGRADABLE` are module constants (`:755-756`); returns `TeachingTest` on every path so no throw bypasses the chokepoint. Approved sentence asserted at `api.test.ts:568` | closed |
| T-04-12 | Information Disclosure | repository secrets in workflow env | medium | mitigate | The four keys appear in exactly one step's `env` (`conformance.yml:64-68`); no step echoes the environment; the report goes to `${{ runner.temp }}/conformance` (`:63,:77`), never the repo tree | closed |
| T-04-06-01 | Tampering | the two source gates in `server/test/usage.test.ts` | medium | mitigate | Gate A (`usage.test.ts:695-707`) carries the permanent `export function UsagePage` sentinel at `:705`; Gate B (`:709-727`) the three-files-in-three-subdirectories anti-vacuity loop at `:717-719`. Red-first evidence quoted verbatim in `04-06-SUMMARY.md:107-127` | closed |
| T-04-02 | Tampering / Information Disclosure | learner-typed base URL, outbound requests | medium | accept | Bounding facts all hold: non-http(s), credentials-in-URL, query and fragment refused (`settings.ts:123-133`); `redirect: 'manual'` on every outbound (`probe.ts:67,328,350`, `adapters.ts:59`); 3xx refused rather than followed (`probe.ts:310`, `adapters.ts:60`); `noRedirectFetch` wired into all nine provider factories; loopback bind by default (`config.ts:26`) | closed (accepted) |
| T-04-13 | Tampering | `actions/*` and `pnpm/action-setup` pins | medium | accept | checkout@v7, action-setup@v6, setup-node@v7, upload-artifact@v7 (`conformance.yml:36,38,41,74`) — same majors as `ci.yml:18,20,23` and `release.yml:17-19`, all first-party GitHub/pnpm | closed (accepted) |
| T-04-03 | Denial of Service | `num_ctx` on `SettingsWrite` | low | accept | `.int`, `.min(NUM_CTX_FLOOR)`, `.max(1_048_576)` with the in-source comment stating it is "A politeness bound, NOT a security control"; body `.strict()` (`index.ts:394-421`) | closed (accepted) |
| T-04-04 | Information Disclosure | model id in `usage.model`, header pill, export | low | accept | Advice, not control, as declared: the llama.cpp catalogue note recommends `--alias` and names the three surfaces (`providers.ts:207`); truncated display with the full value in `title` (`Usage.tsx:94,103`); boundary restated at `usage.ts:54` and `types.ts:192` | closed (accepted) |
| T-04-11 | Denial of Service | repeated `test teaching` presses | low | accept | `disabled={teachTesting \|\| unusable}` (`ProviderRow.tsx:636`); per-press scratch lesson so two presses cannot contend (`capability.ts:765`); run bounded by `proofMs()` (`:779-782`) | closed (accepted) |
| T-04-14 | Repudiation | silently dead nightly | low | accept | The comment above the cron records both the 60-day public-repo auto-disable and the scheduled-run delay (`conformance.yml:3-16`); `workflow_dispatch` present at `:20` | closed (accepted) |
| T-04-15 | Denial of Service | whole-list metadata pass; grouped aggregate | low | accept | Bounded by construction: runs only over local rows a detection found (`index.ts:750-751`); every read at `LOCAL_MS`, none against a completion endpoint; one pass, no timer. Read side uses the `usage_learner (learner_id, ts)` index (`migrations.ts:227`) then groups in memory (`usage.ts:173-186`) | closed (accepted) |
| T-04-06-02 | Information Disclosure | PROV-13 gate's recursive read of `web/src` | low | accept | `readdirSync(webSrc, { recursive: true })` confined to `web/src`, filtered to `.ts`/`.tsx`/`.css`, read-only, reporting a relative path plus the matched identifier (`usage.test.ts:711-727`) | closed (accepted) |
| T-04-06-03 | Information Disclosure | lesson refusal card wrap classes | low | accept | `Lesson.tsx:361` adds `max-w-[62ch] break-words` to the existing card and nothing else; the sentence is still composed server-side (`context.ts:37,52,91-92`) | closed (accepted) |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-04-01 | T-04-02 | Derive exists to talk to a server the learner chose. The URL is learner-supplied by design; the risk is bounded by scheme/credential/query refusal, manual redirect handling on every outbound path, and a loopback-by-default bind — not by refusing the feature | Phase 04 plan register | 2026-10-23 |
| R-04-02 | T-04-13 | Major-version action pins match the repo's three other workflows; all are first-party GitHub/pnpm actions. SHA-pinning every action is a repo-wide change, not this phase's | Phase 04 plan register | 2026-10-23 |
| R-04-03 | T-04-03 | `num_ctx` is a politeness bound on a local field the learner sets for their own server. Stated in-source as not a security control | Phase 04 plan register | 2026-10-23 |
| R-04-04 | T-04-04 | A llama.cpp model id can be a file path and so may carry a local directory name into the header pill, Usage page and exported note. Advice (`--alias`), not a control, because Derive must not rename what the learner's server reports | Phase 04 plan register | 2026-10-23 |
| R-04-05 | T-04-11 | Local-only surface; the button self-disables while a test runs and each press gets its own scratch lesson, so repeated presses waste the learner's own compute and nothing else | Phase 04 plan register | 2026-10-23 |
| R-04-06 | T-04-14 | GitHub's own 60-day auto-disable and scheduled-run delay are outside Derive's control; both are recorded beside the cron and `workflow_dispatch` gives a manual path | Phase 04 plan register | 2026-10-23 |
| R-04-07 | T-04-15 | The metadata pass runs only over servers a detection actually found, at the local timeout, once per request, with no timer; the aggregate is one indexed read grouped in memory | Phase 04 plan register | 2026-10-23 |
| R-04-08 | T-04-06-02 | A test-time, read-only directory walk confined to `web/src`, reporting relative paths only | Phase 04 plan register | 2026-10-23 |
| R-04-09 | T-04-06-03 | Two CSS utilities on an existing element; the refusal sentence is still composed server-side | Phase 04 plan register | 2026-10-23 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-23 | 19 | 19 | 0 | gsd-security-auditor (ASVS L1, block_on: high) |

---

## Advisory Notes

Non-blocking; recorded so they are not rediscovered.

1. **T-04-01's declared test does not exist.** The register promises "A test asserts a known fake key does not survive into the written report." No test imports `scripts/conformance.mjs`; `exitCodeFor` is exported for exactly this purpose but never exercised. The plan's own verification for this threat was a grep for `registerSecret|safeMessage` (`04-04-PLAN.md:276`), which passes. At ASVS L1 the control is present at every recorded-sentence site, so the threat is closed — but the assurance artifact is absent and the register overstates its coverage. Worth a follow-up test.
2. **`registerSecret`'s 16-character floor** means a repository secret shorter than 16 chars is covered only by `redactErrors`' shape patterns, not by value redaction. This is the documented tradeoff in T-04-01's own mitigation plan (`secrets.ts:30-35`), not a new finding.
3. **Template-compliance gap, not a security one:** the `04-03`, `04-04` and `04-06` SUMMARYs carry no `## Threat Flags` section at all. Their plans' registers were verified directly, so no threat went unchecked.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-23
