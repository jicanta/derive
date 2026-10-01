---
phase: 02
phase_name: "Settings and Secrets"
project: "Derive"
generated: "2026-10-01"
counts:
  decisions: 10
  lessons: 8
  patterns: 8
  surprises: 7
missing_artifacts: []
---

# Phase 02 Learnings: Settings and Secrets

Extracted from 7 PLAN.md, 7 SUMMARY.md, 02-VERIFICATION.md (63/63, `passed`), 02-UAT.md (5/5,
`passed`), 02-REVIEW.md, 02-UI-REVIEW.md and .planning/STATE.md.

## Decisions

### Two resolver modes on one shared helper
`resolveTutor()` may refresh the provider observation; `currentTutor()` never spawns a process.
`GET`/`POST /api/settings/active` use the refreshing form because a fresh observation costs nothing
there and the plugin asks once per lesson; every hot path reads `currentTutor()` or the turns row.

**Rationale:** Detection shells out to `claude auth status`; putting that behind a single helper with
two modes keeps the cost at the call site's discretion instead of hiding a spawn in a hot path.
**Source:** 02-01-SUMMARY.md

### A plaintext 0600 secrets file is the deliberate posture
Keys live in `~/.derive/secrets.json` at mode 0600, not encrypted, and the reasoning is written into
the `keys.ts` module header.

**Rationale:** The same trust boundary already holds the per-install token and the SQLite database.
Encrypting one of the three without a key-management story would be security theatre, not defence.
**Source:** 02-02-SUMMARY.md

### Environment keys answer with `hint: null`
A key the learner pasted returns its last four characters; a key from the environment returns no hint.

**Rationale:** The hint exists so a learner can recognise which key they pasted. A value they never
typed has nothing to recognise, and echoing four characters of it is a leak with no benefit.
**Source:** 02-02-SUMMARY.md

### Local versus remote is judged on the literal host, with no lookup
Loopback, link-local, RFC 1918, CGNAT, `localhost`, `.local`, `::1`, `fc00::/7` and `fe80::/10` are
read straight off the request URL to pick the timeout and the "nothing answered" sentence.

**Rationale:** This decides *which sentence to write*, never whether a request is allowed, so it does
not need to be lookup-accurate — and a DNS lookup inside an error path would add a failure mode to
error handling. T-02-17 is accepted on that basis.
**Source:** 02-03-SUMMARY.md

### `requestFor` omits the Authorization header entirely when no key is set
Not an empty header — no header at all.

**Rationale:** A key row tested before a key is pasted then reads the provider's own 401 plus Derive's
hint, which is the useful failure; and a local server with no token never sees an `Authorization`
line it would have to ignore.
**Source:** 02-03-SUMMARY.md

### The header pill is a record of the turn, never of Settings
`st.tutor` is seeded from the turns row on replay, and the `turn_start` case replaces it only when
`typeof ev.payload?.provider === 'string'`.

**Rationale:** A provider change applies from the next turn, so showing it before that turn would be a
lie about what is teaching. The pill holds the old value until the turn that actually uses the new one
(D-15, D-04).
**Source:** 02-04-SUMMARY.md

### The learner model tier sits inside `chooseModel`
The per-learner override is resolved between the environment and the install setting, in one function;
`currentTutor()` and the read-only routes are untouched.

**Rationale:** `DERIVE_MODEL` must stay the first tier in exactly one place. Threading the learner
through the read-only routes would have duplicated the precedence chain.
**Source:** 02-05-SUMMARY.md

### One learner-aware settings route, not a learner parameter everywhere
`GET /api/settings/active` is the single route that resolves per learner; an unnamed request resolves
for the default learner.

**Rationale:** One learner's override cannot leak into another's answer if only one route is
learner-scoped and it always names whose answer it is giving.
**Source:** 02-05-SUMMARY.md

### A destructive colour is an override at the call site, not a variant of the shared constant
`remove the key` composes `${textButton} text-rust-400 hover:text-rust-500` rather than forking
`textButton` into a destructive twin.

**Rationale:** The shared constant keeps one meaning. Composing also gave the button the 32px hit area
in the same edit that fixed its dead hover token.
**Source:** 02-07-SUMMARY.md

### A long model id scrolls inside its field rather than widening the page
The `/you` Section 07 input lost its `max-w-[320px]` cap and fills its column; a 59-character id still
scrolls, and that is accepted.

**Rationale:** Owner's call on 2026-10-01. Reaching 520px means widening the approved 760px form or
shrinking its 200px label column, re-rhythming all seven sections — and `/settings` already behaves
this way and was accepted there in UAT test 3. Recorded as an amended expectation with the owner
named, never as a silently met must-have.
**Source:** 02-UAT.md (`expected_amended`), 02-VERIFICATION.md (`overrides[0]`)

---

## Lessons

### A plan's literal grep guard can be tripped by the module's own prose
`settings.ts`'s header said the module "never touches `process.env`", and the plan's acceptance check
was a literal `! grep -q "process.env"` over the file. The comment failed the guard the comment was
describing. Reworded to "never reads it directly"; no code changed.

**Context:** Found during 02-01 Task 1 verification and auto-fixed under Rule 1.
**Source:** 02-01-SUMMARY.md

### A `.then` chain split across lines defeats a literal call-site grep
The first draft of the `/you` fetch wrapped `api.activeTutor()` across lines in the file's existing
style, which the plan's literal grep and the `must_haves` `key_link` pattern could not see. Collapsed
onto one line before the commit.

**Context:** Formatting that matches the surrounding file can still fail a verification written as a
single-line pattern — worth knowing when a plan's guard is a grep rather than a test.
**Source:** 02-05-SUMMARY.md

### The repo's `block-no-verify` hook rejects any Bash call pairing a gsd guard with `git commit`
It happened on the first commit of three separate plans. The fix is always the same: run the guards in
one call, then a plain `git commit` in another. No `--no-verify` was ever used.

**Context:** Recurred in 02-03, 02-04 and 02-06; 02-07 avoided it by splitting from the start, citing
this repo's own memory note. A recurring friction worth doing by reflex rather than rediscovering.
**Source:** 02-03-SUMMARY.md, 02-04-SUMMARY.md, 02-06-SUMMARY.md, 02-07-SUMMARY.md

### A bad fixture can make correct code look broken
The pure `providerSentence` case failed first time because a raw newline inside a single-quoted
TypeScript string is not valid JSON, so the function correctly fell back to raw text. The fixture
needed a JSON `\n` escape, matching what the fake provider's `JSON.stringify` sends over HTTP.
Production code was unchanged.

**Context:** Suspect the fixture before the function when a parser-adjacent test fails on its first run.
**Source:** 02-03-SUMMARY.md

### Closing a visual finding in source is not the same as closing it
02-07 removed the `max-w-[320px]` cap that the UAT blamed for the `/you` id not fitting, verified the
compiled CSS, and reported the finding closed. Re-driving the browser showed the id still did not fit:
the column is 464px and the text needs 520px. The cap was never the whole cause.

**Context:** A fix that removes the named constraint can still miss the requirement when the real limit
is downstream of it. The re-run is what separated "the edit landed" from "the behaviour changed".
**Source:** 02-07-SUMMARY.md (`Re-verification Needed`), 02-UAT.md (`Re-verification`)

### Headless Chrome cannot verify any hover in this app
Tailwind v4 compiles every `hover:` utility inside `@media (hover:hover)`. Headless Chrome 148 reports
that false in both `--headless=new` and `--headless=old`, `Emulation.setEmulatedMedia` cannot override
it, and no Xvfb is installed — so a before/after `getComputedStyle` read is always identical even
though `el.matches(':hover')` correctly returns `true`.

**Context:** This suppresses every hover in the app, not one button, so it is a harness limit rather
than a finding. Verify a hover fix from the served CSS and the custom property instead; a dead Tailwind
token shows up as an **undefined** custom property, which is how `hover:text-rust-300` was caught.
**Source:** 02-UAT.md (`Re-verification`), 02-VERIFICATION.md (`advisory[1]`)

### An interrupted session should verify and continue, not redo
02-02 was interrupted between its Task 1 commit and Task 2. The continuation re-verified Task 1's
acceptance criteria against the existing commit and then started Task 2; nothing was redone.

**Context:** The cheap check (re-run the criteria) is what makes resuming safe, and it is much cheaper
than re-executing a task whose commit already landed.
**Source:** 02-02-SUMMARY.md

### Phase completion invalidates the phase's own verification digest
`covered_files` in 02-VERIFICATION.md includes `.planning/ROADMAP.md` and
`.planning/REQUIREMENTS.md`, and `gsd_run query phase.complete` rewrites both — so marking the phase
complete flipped `verification status` from `passed` straight back to `stale`, with zero
implementation files changed.

**Context:** Observed immediately after the completion commit this phase, and previously on Phase 01.
It makes the next `/gsd-verify-work 02` open with a false `status=stale` blocker. The structural fix is
to drop those two transition-owned files from `covered_files`; left undone pending the owner, and
recorded here so it is not rediagnosed a third time.
**Source:** 02-VERIFICATION.md (`covered_files`), observed `verification status` after commit 6f2d237

---

## Patterns

### `truncate min-w-0` is the full-page header idiom
All three full-page headers — `Lesson.tsx`, `Settings.tsx`, `You.tsx` — now carry it on their `<h1>`.
`truncate` alone is not enough inside a flex header; the `min-w-0` is what lets the box actually shrink.

**When to use:** Any new full-page header. Copy this pair, not `truncate` alone.
**Source:** 02-07-SUMMARY.md (`Next Phase Readiness`)

### One constant owns the text-button hit-area floor
`textButton` in `ProviderRow.tsx` is now the single place the 32px (`h-8`) minimum lives, so every
call site inherits it.

**When to use:** Any Phase 3 page reusing the provider-row button idiom. Put the floor in the shared
constant rather than on each button, which is how six of seven buttons lost it in the first place.
**Source:** 02-07-SUMMARY.md

### Give each HTTP test group its own spawn and its own fakes
The models/test cases and the detection cases run on separate server spawns with private fakes, and the
detection group gets a private `CODEX_HOME`.

**When to use:** Whenever one group's cases mutate shared state the next group reads — here, later cases
repoint Ollama and LM Studio at a closed port, and a shared `auth.json` would have signed every other
spawn in. Interleaving would have coupled the cases to their execution order.
**Source:** 02-03-SUMMARY.md, 02-06-SUMMARY.md

### Compare a field against its *effective* value, not its stored value
The model field writes only when the typed value differs from "stored, else the catalogue default", so
tabbing through a preselected default writes nothing and the row's `modelSource` stays `default`;
clearing the field still deletes the stored id.

**When to use:** Any save-on-blur field with a meaningful default. It is what stops a pure tab-through
from silently promoting a default into an explicit setting.
**Source:** 02-06-SUMMARY.md

### Swallow `mousedown` on the one button that must not trigger save-on-blur
`keep the current key` swallows `mousedown` so the password input does not blur-save the typed value on
the way to the button whose entire meaning is "do not save".

**When to use:** Save-on-blur plus a cancel control in the same row. The contract stays save-on-blur;
the single contradicting button is the exception.
**Source:** 02-02-SUMMARY.md

### Fix the precedence of a shared status line explicitly
The line under the model combobox orders save states first (lock, save error, saved tick, saving), then
the fetch failure, then the fetched count, then the defaults — so a typed id still shows its tick after
a fetch.

**When to use:** Any one line that several independent actions want to write. Write the order down; the
bug is always two actions both being "current".
**Source:** 02-03-SUMMARY.md

### Check that a string replacement matches exactly once, before writing
Each of 02-07's seven edits was confirmed to match exactly one occurrence in its target file before the
write, making a silent multi-match or no-match impossible.

**When to use:** Any mechanical multi-site edit. It converts the dangerous failure (a quiet wrong-site
replacement) into a loud one.
**Source:** 02-07-SUMMARY.md

### A CDP driver plus a scratch server and a fake local provider is enough for visual UAT
All five UAT items and all six gap re-checks were driven in headless Chrome over raw DevTools Protocol
against a scratch Derive on its own port and `DERIVE_DATA_DIR`, with a ~20-line fake Ollama on 11434 so
detection, `fetch models` and the datalist work offline. Sign the browser in once with the token URL;
same-origin `fetch()` then carries the cookie, so API assertions run inside the page.

**When to use:** Any phase with pixel or layout acceptance criteria, when no Playwright or browser MCP
is installed. Measure geometry (`clientWidth`/`scrollWidth`, `getBoundingClientRect`) rather than
eyeballing screenshots.
**Source:** 02-UAT.md

---

## Surprises

### Every token estimate was roughly 6x too high
Across the seven plans: 365,000 tokens estimated, 59,328 actual — and all six original plans were filed
at `confidence: low`.

| Plan | Estimated | Actual |
|------|-----------|--------|
| 02-01 | 60,000 | 13,820 |
| 02-02 | 55,000 | 14,746 |
| 02-03 | 65,000 | 11,158 |
| 02-04 | 55,000 | 4,011 |
| 02-05 | 40,000 | 2,442 |
| 02-06 | 70,000 | 11,840 |
| 02-07 | 20,000 | 1,311 |

**Impact:** Durations were 3–11 minutes per plan against estimates sized for far more. The one plan
filed at `confidence: high` (02-07) was also the closest in ratio terms but still 15x over. Feeds
`.planning/estimation-calibration.json`.
**Source:** 02-0{1..7}-PLAN.md `estimate`, 02-0{1..7}-SUMMARY.md `actuals`

### Codex's own default model is refused on a ChatGPT login
Selecting Codex with its model left empty — the row's own advice — makes every turn fail with
`The 'gpt-5.4' model is not supported when using Codex with a ChatGPT account`.

**Impact:** The advertised zero-configuration path for one of the two subscription providers does not
work. Derive's own machinery (turn_start, the pill, error rendering) all behaved correctly; the failure
is Codex's default. 02-07 repointed the hint at the Settings row, but a curated Codex default id in the
catalogue is still the open suggestion.
**Source:** 02-UAT.md (test 4, advisory)

### A dead Tailwind token is silent — it just generates no CSS
`hover:text-rust-300` compiled to nothing because `index.css` declares only `rust-400` and `rust-500`,
so the destructive confirm button had no hover feedback at all and nothing anywhere reported an error.

**Impact:** Caught only by a UI audit reading the emitted CSS. The reliable tell is that the custom
property is **undefined** at runtime — `--color-rust-300` resolves to empty while `--color-rust-500`
resolves to `#c9785a`.
**Source:** 02-UI-REVIEW.md (Pillar 3), 02-UAT.md (`Re-verification`)

### Removing the width cap did not make the long id fit
Dropping `max-w-[320px]` was the fix the UAT itself named, and it was not sufficient: the `/you` grid
is `md:grid-cols-[200px_minmax(0,1fr)]` with `gap-x-8` inside `max-w-[760px] px-8`, so the field column
is exactly 464px while a 59-character JetBrains Mono 14px id needs 520px.

**Impact:** Turned a "closed" finding back into an open one, and the resolution was a spec amendment
rather than code. The arithmetic (200 + 32 + 464 = 696) is what made the trade-off legible enough to
decide.
**Source:** 02-UAT.md (`Re-verification`), 02-07-SUMMARY.md

### The phase needed a seventh plan that was never planned
02-01 through 02-06 all completed with zero deviations, and the phase still could not close: the UAT and
UI review between them left six findings open, requiring a `gap_closure: true` plan.

**Impact:** "Every plan executed exactly as written" and "the phase is done" are independent facts. The
gap plan was 7 one-line edits across 5 files and took 4 minutes — the cost was in discovering the
findings, not fixing them.
**Source:** 02-07-PLAN.md (`gap_closure: true`), 02-01..02-06-SUMMARY.md (`Deviations: None`)

### The verification denominator grew when the score was re-checked
The first pass scored 50/58 with `status: human_needed`; the re-verification scored 63/63. The
denominator moved because 02-07 added five new truths and one was deduplicated into an existing one — so
the two scores are not directly comparable.

**Impact:** 4 `behavior_unverified` truths, 4 `insufficient_spec` abstentions and 4 flagged prohibitions
all resolved on the same evidence: the human UAT run. Automated verification had genuinely run out of
things it could settle on its own.
**Source:** 02-VERIFICATION.md (`score`, `previous_score`, `behavior_unverified`, `insufficient_spec`)

### A learner's model override carries no provider
The override is stored as a bare string and resolved against whichever provider is active, so switching
providers can hand a learner's model id to a provider that has never heard of it — in tension with the
phase's own truth 45 clause `on the active provider only`.

**Impact:** Harmless while both wired providers are subscription logins, but Phase 3 puts real API keys
behind the same resolver. Raised as `02-REVIEW` WR-01, carried into PROJECT.md § Active rather than left
in a review file.
**Source:** 02-REVIEW.md (WR-01), 02-VERIFICATION.md (`advisory`)
