---
phase: 03-owned-loop-api-keys-and-gateways
plan: 09
subsystem: ui
tags: [settings, web-search, tavily, searxng, prices, tailwind-4, cdp, node-test, in-process-server]

# Dependency graph
requires:
  - phase: 03-owned-loop-api-keys-and-gateways
    provides: "plan 03-06's three search routes (PUT /api/settings/search, DELETE .../key, POST .../test), the `search` block on settingsView() with its `native` boolean, and `searchReady()` — the rule that a half-configured choice counts as no search at all"
  - phase: 03-owned-loop-api-keys-and-gateways
    provides: "plan 03-02's PRICES_AS_OF and pricesFileError(), which the one new Settings sentence renders"
  - phase: 03-owned-loop-api-keys-and-gateways
    provides: "plan 03-01's owned loop (drivers/api.ts) with setModelOverride, and plan 03-08's lesson cost on the lesson view"
  - phase: 02-settings-and-secrets
    provides: "ProviderRow's field vocabulary, the 1800 ms saved tick, blurOnEnter and the whole KeyField write-only state machine — lifted here rather than re-derived"
provides:
  - "web/src/components/fields.ts: the one definition of field, pill, textButton, tickLine, errLine, noteLine, blurOnEnter and useTick, imported by both cards and by the page"
  - "KeyField exported from ProviderRow.tsx and parameterised on its two writes, so a second key field reuses the masked machine including the `keep` button's mouse-down guard"
  - "web/src/components/WebSearchCard.tsx: the one web-search card — three native choices, the one field the choice needs, saved on blur or Enter, and a muted line naming what is missing"
  - "SearchView on the web, plus search / prices_as_of / prices_error on Settings; api.setSearch, api.removeSearchKey and api.testSearch"
  - "The fourth Settings section and the prices sentence as the page's last element, with no price editor anywhere"
  - "prices_as_of and prices_error on settingsView(), so both ride the read the page already awaits"
  - "server/test/spawn.ts startInProcessServer(): the real routes inside the test's own process, so an in-process override reaches them"
  - "Five api.test.ts cases driving a lesson through the owned loop over HTTP on a stub model, with the understanding gate's refusal asserted there"
affects: [04 the usage page and local models, 04 the conformance harness, 05 method quality, 06 personalization]

actuals:
  tokens: 12832   # chars/4 over the realized diff 9f12b5b..90ccf9a (51,330 chars)
  tasks: 3
  commits: 3
  plan_head_before: 9f12b5b837aa211a51e9996e32945a00d7bb2342

tech-stack:
  added: []
  patterns:
    - "A shared `.ts` module of class constants and hooks beside the components that render them: lifted, not copied, so the 32px hit area has one definition and a caller that needs one more utility composes `${textButton} gap-1.5` rather than restating the string"
    - "A state machine parameterised on its two writes rather than on the row it was written for, so a second consumer reuses the behaviour (including a guard that is easy to lose) instead of a second implementation"
    - "An in-process server for a suite whose subject is an in-process override: the listening socket is captured from node:http and closed in `after`, rather than changing the program's startup side effects to suit a test"
    - "A card whose empty state is a sentence and nothing else: zero inputs and zero buttons, asserted in the browser"

key-files:
  created:
    - web/src/components/fields.ts
    - web/src/components/WebSearchCard.tsx
  modified:
    - web/src/components/ProviderRow.tsx
    - web/src/pages/Settings.tsx
    - web/src/lib/api.ts
    - web/src/lib/types.ts
    - server/src/index.ts
    - .env.example
    - scripts/doctor.mjs
    - server/test/api.test.ts
    - server/test/spawn.ts

key-decisions:
  - "SearchView mirrors what the server actually sends — `key: { set, hint }` beside a separate `key_locked` — rather than the merged `{ set, hint, locked }` the plan declared; the card composes the two at the one call site instead of reshaping a route 03-06 already smoke-tested"
  - "api.setSearch answers SearchView, not Settings: the route returns searchView(), so the card's onChange replaces the block and the page merges it with `{ ...s, search }`"
  - "The three-way choice is a native radio group in a flex-wrap row rather than a select, because the UI-SPEC's layout clause is written for a row of three and a learner should see that Tavily and SearXNG exist without opening anything; the radio's checked dot is accent-ink-100, so gold stays reserved"
  - "KeyField stays in ProviderRow.tsx and is exported from there: fields.ts carries no JSX by design, and the component count gate allows exactly one new .tsx file"
  - "No lock sentence on the SearXNG address field, because no environment variable sets that address — the file states only what the code does"
  - "The A4 error variant renders pricesFileError()'s sentence verbatim with nothing appended, because that sentence already names the path and the reason"
  - "The API suite runs the server in its own process (the plan's preferred option 2) rather than falling back to driving runTurn directly, because setModelOverride is reachable from nowhere else and the criterion asks for the API surface"

patterns-established:
  - "Lift a shared constant the first time a second component needs it, and compose the odd case: `ml-auto gap-1.5 ${textButton}`"
  - "A new gate is kept only after being seen fail with the mechanism removed: the understanding-gate refusal assertion was run with the first check switched to `intuition`, and failed with its own message"

requirements-completed: [PROV-09, COST-04, PROV-01, PROV-02, PROV-03, PROV-05]

coverage:
  - id: D1
    description: "Settings carries one web-search section with one card: three native choices, and only the selected option's field"
    requirement: PROV-09
    verification:
      - kind: automated_ui
        ref: "headless Chrome over CDP: the eyebrows read ['logins','keys','on this machine','web search'] in page order; the three radio labels are the approved copy; Tavily shows one password field and no address field, SearXNG shows one address field and no password field"
        status: pass
      - kind: other
        ref: "node -e verbatim-copy script over WebSearchCard.tsx -> `card copy ok` (six approved strings plus the fields import)"
        status: pass
    human_judgment: false
  - id: D2
    description: "With nothing configured the card renders the provider's-own choice and the right one of two sentences, never a blank card and never a bare control"
    requirement: PROV-09
    verification:
      - kind: automated_ui
        ref: "headless Chrome on a fresh data dir: checked choice `provider`, the no-search sentence verbatim, and 0 inputs and 0 buttons inside the card; after POST /api/settings/active {anthropic} the sentence is `This provider searches with its own tool. Nothing to configure.`"
        status: pass
    human_judgment: false
  - id: D3
    description: "A chosen search provider that is not configured behaves as no search and says what is missing, rather than falling back to the provider's own"
    requirement: PROV-09
    verification:
      - kind: automated_ui
        ref: "headless Chrome: Tavily with no key shows `Add a key to turn search on. Until then the tutor has no way to check a fact.` in rgb(106,98,87) (ink-500); SearXNG with no address shows the address wording"
        status: pass
      - kind: unit
        ref: "server/test/search.test.ts#searchReady is false for both half-configured shapes (03-06, unchanged)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every field saves itself on blur or Enter with the 1800 ms tick; there is no page-level Save"
    requirement: PROV-09
    verification:
      - kind: automated_ui
        ref: "headless Chrome: picking a choice shows `saved · applies from the next turn`, gone after 1.8 s; typing a 111-character address and clicking away stores it and ticks; `test search` reads `testing…` disabled in flight and one line after"
        status: pass
    human_judgment: false
  - id: D5
    description: "The search key reuses KeyField's write-only machine, including the `keep` button that must not let a blur-save fire on the way to it"
    requirement: PROV-09
    verification:
      - kind: automated_ui
        ref: "headless Chrome: the masked hint reads `•••• •••• wxyz`; `remove` then `keep` leaves GET /api/settings answering `{set:true,hint:\"wxyz\"}`"
        status: pass
      - kind: other
        ref: "one definition of KeyField in web/src (grep), imported by WebSearchCard.tsx"
        status: pass
    human_judgment: false
  - id: D6
    description: "A rejected value or a failed test shows the server's own sentence in rust with the typed value left in the field"
    requirement: PROV-09
    verification:
      - kind: automated_ui
        ref: "headless Chrome: `test search` against an address that does not answer renders `nothing answered at 10.255.255.1:8888` in rgb(217,139,106) (rust-400) and the typed value is still in the input"
        status: pass
    human_judgment: true
    rationale: "The SearXNG json-disabled case — the one failure the server names specifically, pointing at settings.yml — needs a real SearXNG instance with the json format switched off. The sentence is asserted at the server by server/test/search.test.ts (03-06); that the card renders that particular sentence unchanged is inferred from rendering this one unchanged. Recorded in .planning/WINDOWS.md."
  - id: D7
    description: "The card and the page hold their shape: one column on mobile, two above, a long address scrolling inside its field, no sideways scroll at 375px or 1280px"
    requirement: PROV-09
    verification:
      - kind: automated_ui
        ref: "headless Chrome: a 111-character address gives scrollWidth 956 against clientWidth 313 (it scrolls inside); card 696px at 1280px and 327px at 375px; documentElement.scrollWidth equals window.innerWidth at both widths"
        status: pass
    human_judgment: true
    rationale: "The plan carries this truth as `backstop`: the 120-character case is settled by inheriting the `w-full` field class the Phase 2 UAT already accepted for a long model id. 111 characters was measured rather than 120, and Tailwind v4 gates `hover:` behind @media (hover:hover), which no headless mode satisfies, so hover feedback on the two text buttons is unverified in the browser."
  - id: D8
    description: "Settings carries one sentence naming ~/.derive/prices.json and the as-of date, last on the page, with no price editor"
    requirement: COST-04
    verification:
      - kind: automated_ui
        ref: "headless Chrome: `Prices come from a table shipped with Derive, as of 2026-10-06. To use your own, put them in ~/.derive/prices.json.` in ink-500 at max-width 578px (62ch), the last element of its container, 0 controls after it and 0 number inputs on the page"
        status: pass
      - kind: automated_ui
        ref: "headless Chrome with an unparseable prices.json: the sentence is replaced by `<path> could not be read: it is not valid JSON` in rust-400, still last, and the normal sentence is gone"
        status: pass
    human_judgment: false
  - id: D9
    description: ".env.example documents the search variable and the override file; the doctor reports the override file's presence and never a key"
    requirement: COST-04
    verification:
      - kind: other
        ref: "grep -c TAVILY_API_KEY .env.example -> 1; grep -c prices.json .env.example -> 1; doctor prints `Price overrides  none; Derive uses its shipped price table` and, with a file present, the path plus `(merged over the shipped table)`; no readFileSync/JSON.parse on that path; `doctor scope ok`"
        status: pass
    human_judgment: false
  - id: D10
    description: "The API suite passes through the owned loop with a stub model, asserting the understanding gate holds there as it does on the Claude Code path"
    requirement: PROV-01
    verification:
      - kind: integration
        ref: "server/test/api.test.ts#creates a lesson over HTTP and runs the first turn on the loop, with the plan approved from the browser"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts#grades the check itself and hands the model a result it was never asked to compute"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts#refuses the lock with no understanding pass, in the method's own words, and writes nothing"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts#lets the lock through once an intuition question has passed, so the gate is a gate and not a wall"
        status: pass
      - kind: integration
        ref: "server/test/api.test.ts#filed the turn in the ledger, so the lesson carries a cost the pages can show"
        status: pass
    human_judgment: false
  - id: D11
    description: "A whole lesson actually runs on an Anthropic, an OpenAI, a Gemini, an OpenRouter and a base-URL key, and the Claude Code plugin and Codex skills still work"
    requirement: PROV-02
    verification: []
    human_judgment: true
    rationale: "No provider key exists in this environment, so the real-key halves of Success Criteria 1 and 2 cannot be shown by any automated test here. The api.test.ts header says so in as many words and names where they are carried; the plan's Task 3 human check lists all seven runs. Recorded in .planning/WINDOWS.md."

# Metrics
duration: 95 min
completed: 2026-10-12
status: complete
---

# Phase 03 Plan 09: The Two Things a Learner Configures Summary

**One web-search card in Settings — three native choices, the one field each needs, saved as you go on the masked key machine `ProviderRow` already had — plus one sentence naming `~/.derive/prices.json`, and an API suite that now runs a whole graded, gated lesson through Derive's own agent loop over HTTP on a stub model.**

## Performance

- **Duration:** ~95 min
- **Started:** 2026-10-12T20:25Z (base `9f12b5b`)
- **Completed:** 2026-10-12T22:00Z
- **Tasks:** 3
- **Files modified:** 11 (2 created, 9 modified)

## Accomplishments

- **The field vocabulary has one definition.** `web/src/components/fields.ts` now owns `field`, `pill`, `textButton`, `tickLine`, `errLine`, `noteLine`, `blurOnEnter` and `useTick`. `ProviderRow.tsx` imports them back and renders byte-identically; `Settings.tsx`'s own duplicate `pill` and `textButton` are gone. The one place the strings genuinely differed — the rescan button needs `gap-1.5` for its icon — composes `ml-auto gap-1.5 ${textButton}` rather than restating the class, which is the Phase 2 gap-closure precedent applied rather than re-learned.
- **`KeyField` is reused, not re-derived.** It is exported from `ProviderRow.tsx` and parameterised on its two writes (`save(key)`, `remove()`) instead of on a provider row. Both consumers get the same machine: write-only, `{ set, hint, locked }`, `•••• •••• {hint}`, `replace` with a way back, the inline two-step remove with no dialog, and — the reason this mattered — the `keep` button that swallows `onMouseDown` so the input cannot blur-save on the way to the button that means "do not save". That sequence was driven in a real browser on the search key and the key survived.
- **One card, three choices, one field.** `WebSearchCard` is a sibling of `ProviderRow`, not a generalisation of it. A native radio group picks the provider's own search, Tavily or SearXNG; only the selected option's field renders; `the provider's own` renders a sentence and *nothing else* — zero inputs and zero buttons, measured in the browser. The two sentences for that choice branch on the server's `native` boolean, so the browser hard-codes no provider fact.
- **A selection means what it says.** Tavily with no key, or SearXNG with no address, shows `Add a key to turn search on. Until then the tutor has no way to check a fact.` in muted ink and nothing falls back to the provider's own tool — which is exactly what the server already does (`searchReady()` makes a half-configured choice `none` on both the prompt side and the tool side, 03-06). The card and the loop now say the same thing.
- **The prices sentence, and only a sentence.** `Prices come from a table shipped with Derive, as of 2026-10-06. To use your own, put them in ~/.derive/prices.json.` is the last element on the page, `max-w-[62ch]`, muted, with no control beside it and no number input anywhere. `settingsView()` carries `prices_as_of` and `prices_error`, so it rides the read the page already awaits — no second request, no skeleton, no flash. An unreadable file replaces the sentence with the server's own line in rust; an absent file is silent, because the normal sentence already names the place to put one.
- **The two configuration surfaces say what the code does.** `.env.example` documents `TAVILY_API_KEY` in the file's existing commented form, names the three cases that have no search of their own (OpenRouter, an OpenAI-compatible endpoint, Gemini before 3), and says the variable locks the Settings field; a second block documents `prices.json` with no variable beneath it because there is none. The doctor gains one `Price overrides` line that reads `ok` whether the file is absent or present and never opens it — and a comment recording why no line reports whether a search key is set.
- **The API suite now passes through the owned loop.** Five new cases drive `POST /api/lessons`, `POST /api/lessons/:id/message` and `POST /api/lessons/:id/answer` against the real routes with a stub `LanguageModel`: a nine-step script plans a graph, has the plan approved from the browser, teaches, asks a `procedure` check, is told the learner was right by the *server*, tries to lock, is refused in the method's own words, asks an `intuition` question, and locks. Every pre-existing external-path case is untouched. `doStreamCalls.length === 9` is the positive evidence the loop ran rather than being skipped; `396 tests pass` against `391` at the dispatch base.
- **The refusal gate was seen failing.** With the first check switched from `procedure` to `intuition` — so the lock at step six is allowed — the refusal case fails with its own message (`the refusal did not reach the model as a refusal`) and the `node_status` event sequence goes to three. The gate is a gate, by the project's own 01-21 rule.

## Task Commits

1. **Task 1: the lifted field vocabulary, the web-search card and the prices sentence** — `7c95e6b` (feat)
2. **Task 2: `.env.example` and the doctor describe what this phase added** — `b125669` (docs)
3. **Task 3: the API suite runs through the owned loop on a stub model** — `90ccf9a` (test)

**Plan metadata:** this file (docs: complete plan)

## Files Created/Modified

- `web/src/components/fields.ts` — **new.** The six class constants, `blurOnEnter` and `useTick`, with the doc comments they carried in `ProviderRow` plus a header recording why the module exists (one definition of the 32px hit area) and why it is `.ts` (no JSX, so the one-component-per-file rule and the component count are untouched).
- `web/src/components/WebSearchCard.tsx` — **new.** `CHOICES`, `WHY`, `NATIVE`, `NO_SEARCH`, `missing()`, `resultText()`, the local `SearxngField`, and `WebSearchCard`.
- `web/src/components/ProviderRow.tsx` — the eight lifted names imported rather than declared; `KeyField` exported and parameterised on `value`/`label`/`optional`/`save`/`remove`, with its provider-specific state update moved to the call site.
- `web/src/pages/Settings.tsx` — `pill`/`textButton` imported; the `web search` section fourth with `mt-8` and an `eyebrow`; the prices sentence last with its error variant; `gap-1.5` composed onto the rescan button.
- `web/src/lib/types.ts` — `SearchView`, and `search` / `prices_as_of` / `prices_error` on `Settings`.
- `web/src/lib/api.ts` — `setSearch`, `removeSearchKey`, `testSearch` as three new keys on the one object.
- `server/src/index.ts` — `prices_as_of` and `prices_error` on `settingsView()`, with the reason beside them; two imports.
- `.env.example` — the `TAVILY_API_KEY` block and the `prices.json` block, both in the file's own register.
- `scripts/doctor.mjs` — the `Price overrides` check beside the Secrets file block, and the comment recording the deliberately absent search-key line.
- `server/test/spawn.ts` — `startInProcessServer()` and `InProcessServer`, with the module header now naming both ways out.
- `server/test/api.test.ts` — the rewritten header (what the two halves are, and what no test here can show), and the `the owned loop, through the app's own routes` describe with its nine-step script and five cases.

## Decisions Made

- **`SearchView` matches the wire, not the plan's declaration.** The plan declared `key: { set, hint, locked } | null`; `searchView()` answers `key: { set, hint }` with `key_locked` beside it, because `keyView()` returns two fields and the lock is a separate lookup. The card composes them at its one call site (`value={{ ...search.key, locked: search.key_locked }}`). Reshaping the route instead would have moved a shape 03-06 smoke-tested and documented, for no gain.
- **`api.setSearch` answers `SearchView`.** The plan wrote `j<Settings>`; the route returns `searchView()`. The card's `onChange` therefore replaces the block and `Settings.tsx` merges it (`{ ...s, search }`), which is the same shape `onRowChange` already uses for a provider row.
- **A radio group, not a select.** The UI-SPEC allows either native control, but its layout clause ("the three-way choice and the action row use `flex-wrap`") is written for a row of three, and a learner who cannot see that Tavily and SearXNG exist has to open something to find out. The checked dot is `accent-ink-100`, a declared token, so gold stays reserved for the list the UI-SPEC enumerates. Verified in the emitted CSS (`accent-color:var(--color-ink-100)`), per the Phase 2 lesson that a class naming an undeclared token compiles to nothing with no build error.
- **No lock sentence on the SearXNG address.** The plan asked for one "when one is set", but no environment variable sets that address — `config.ts` carries `TAVILY_API_KEY` only. A branch for a variable that does not exist would be dead code claiming a feature, so the field has no lock state and the comment says why.
- **The A4 error sentence is the server's, verbatim.** The `secrets_error` precedent trims the server's sentence and re-composes it around the file's short name; `pricesFileError()` already answers one lowercase line naming the path and the reason, and the UI-SPEC calls for exactly that line, so nothing is appended to it.
- **The API suite serves the app in its own process.** The plan offered two options and preferred the second "where it is small". It is small — but only because the listening socket can be captured from `node:http` (with `syncBuiltinESMExports`, since `@hono/node-server` imports `createServer` as an ESM named binding) and closed in `after`. Without that capture the test file never exits: `src/index.ts` calls `serve()` at module scope and keeps the handle, and Node's test runner does not force-exit. The alternative the plan allowed — changing those startup side effects — is the one thing it forbade, and driving `runTurn` directly would have moved the criterion from the API surface back to a driver suite. Measured first: an in-process import with no capture hung the runner at exit 124; with the capture it exits 0.
- **The suite configures the provider through the routes.** `PUT /api/settings/anthropic` stores the fixture key and `POST /api/settings/active` makes the row active, so the only thing imported from `src/` is `setModelOverride`. Everything else — the key, the provider, the lesson, the turn, every answered card, and the cost the lesson reports — goes through production HTTP.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's declared `SearchView` and `api.setSearch` return type did not match the routes they describe**

- **Found during:** Task 1
- **Issue:** `SearchView` was specified as `key: { set, hint, locked } | null`, and `setSearch` as answering `Settings`. `searchView()` in `server/src/index.ts` answers `{ provider, key: { set, hint }, key_locked, base_url, native }`, and all three routes answer that block rather than the whole page. A browser type that lies about the wire is the failure the 03-06 summary warned about from the other direction.
- **Fix:** `SearchView` mirrors the wire; the card composes `key` and `key_locked` where `KeyField` needs them; `api.setSearch` answers `SearchView` and the page merges it with `{ ...s, search }`.
- **Files modified:** `web/src/lib/types.ts`, `web/src/lib/api.ts`, `web/src/components/WebSearchCard.tsx`, `web/src/pages/Settings.tsx`
- **Verification:** a scratch server on 127.0.0.1:4411 answered the exact shape for all four calls (`GET /api/settings`, the three writes); `pnpm --filter web build` exits 0 under `strict` plus `noUnusedLocals`.
- **Committed in:** `7c95e6b`

**2. [Rule 3 - Blocking] `Settings.tsx`'s `textButton` was not in fact a duplicate**

- **Found during:** Task 1
- **Issue:** The plan says Settings' `pill` and `textButton` "already duplicate `ProviderRow`'s". `pill` does, byte for byte; `textButton` differs by one utility — Settings' carries `gap-1.5`, which the rescan button needs for the space between its icon and its word. Importing the shared constant unchanged would have closed that gap by 6px.
- **Fix:** The shared constant is imported and the one site composes what it needs (`ml-auto gap-1.5 ${textButton}`), with a comment saying why. This is the Phase 2 gap-closure pattern (the destructive confirm composes `${textButton}` plus its rust override) rather than a new idea.
- **Files modified:** `web/src/pages/Settings.tsx`
- **Verification:** the lift gate (`^const (pill|textButton) =` absent from `Settings.tsx`) passes, and the rescan button still renders with its gap.
- **Committed in:** `7c95e6b`

**3. [Rule 2 - Missing Critical] An in-process server would have hung the test runner forever**

- **Found during:** Task 3
- **Issue:** The plan's preferred option is an in-process variant of `spawn.ts` "that imports the Hono app and serves it in the test's own process". `app` is not exported and `serve()` runs at module scope, keeping its handle; a listening socket nobody can close means the test file never exits, and Node's runner does not force-exit by default. Measured before deciding: a probe suite passed its cases and then hung until the 60 s timeout killed it (exit 124).
- **Fix:** `startInProcessServer()` captures the server from `node:http` for the duration of the import (restoring the real `createServer` immediately, with `syncBuiltinESMExports()` so `@hono/node-server`'s ESM named binding sees the patch) and hands the caller a `close()`. `server/src/index.ts` is untouched — `git diff --quiet -- server/src/index.ts` was clean across Task 3 — and the whole reason is in the function's own comment.
- **Files modified:** `server/test/spawn.ts`
- **Verification:** `test/api.test.ts` → 19 pass, 0 fail, process exits 0 in 4.9 s.
- **Committed in:** `90ccf9a`

**4. [Rule 1 - Bug] The first draft of the owned-loop cases deadlocked on the second card**

- **Found during:** Task 3
- **Issue:** The refusal assertions were written in their own `it`, which waited for the turn to end — but the turn was blocked on the `intuition` quiz card that the *next* case was going to answer. `the turn ending never happened`.
- **Fix:** One case drives the whole second turn (both cards settled, in sequence, each wait bounded by the previous card's seq) and the later cases assert over the recorded `doStreamCalls` and the event log. A card the loop opens must be settled by the case that opened it.
- **Files modified:** `server/test/api.test.ts`
- **Verification:** 19 pass, 0 fail; and with the first check switched to `intuition` the refusal case fails with its own message, which is the gate seen failing.
- **Committed in:** `90ccf9a`

---

**Total deviations:** 4 auto-fixed (2 bugs, 1 blocking, 1 missing critical)
**Impact on plan:** No task's `<done>` was weakened and nothing was added beyond the plan's `files_modified`. Two deviations are the plan's declarations corrected against the code they describe (the wire shape, and a constant that was not a duplicate); two are the plan's own preferred option made to work rather than abandoned.

## Issues Encountered

- **`node --env-file-if-exists=.env scripts/doctor.mjs` could not be run.** The harness refuses any command naming `.env`, to keep secret values out of the transcript. The doctor was run as `node scripts/doctor.mjs` instead — which is the form the plan's own acceptance criterion names — plus a second run with `DERIVE_DATA_DIR` pointed at a scratch directory holding a `prices.json`, to see the present branch as well as the absent one. The env file only supplies `DERIVE_DATA_DIR`/`DERIVE_VAULT_DIR`, neither of which changes the line under test.
- **A `pkill -f` cost two shells.** `pkill -f "remote-debugging-port=933"` matches the command line of the shell running it, and so does a `case` pattern on `cdp-`. Both self-terminated the Bash call mid-run. The project's own note about this (`derive-browser-uat`: never `pkill -f`) is about Derive's servers; it applies to the browser just as much. Scratch servers and every Chrome instance started during this plan are confirmed stopped.
- **`web/src/pages/You.tsx` still declares its own `field` constant.** A fourth copy of the input class, differing by one utility (`disabled:opacity-60`). It is outside this plan's `files_modified` and importing the shared constant would change what `/you` renders for a disabled input, so it was logged to `.planning/phases/03-owned-loop-api-keys-and-gateways/deferred-items.md` rather than fixed.
- **A long-text measurement at 111 characters, not 120.** The address typed into the SearXNG field in the browser was 111 characters. The field's `scrollWidth` (956) is three times its `clientWidth` (313) at that length, and neither the card nor the page gained a pixel of width at 375px or 1280px, so the behaviour is established; the exact 120-character case is the plan's `backstop` truth and is carried as a human check.

## Known Stubs

None. No `TODO`, `FIXME`, `XXX`, `HACK`, "coming soon" or "not available" appears on any line this plan added; the only `placeholder` matches are two HTML `placeholder` attributes and Tailwind's `placeholder:` variant inside the shared `field` class.

## Threat Flags

None. This plan opens no endpoint, adds no auth path and changes no schema: the three search routes and their locks shipped in 03-06, and `settingsView()` gained two read-only fields that are T-03-62 in the plan's own register. The key the card writes never leaves the one `api` object (the card is gated against calling `fetch`), the masked machine is reused rather than re-implemented (T-03-59, exercised in a browser), and the doctor reports a file's presence without opening it (T-03-61).

## User Setup Required

None — no external service configuration is required. A learner who wants web search on a provider that has none picks Tavily and pastes a key, or picks SearXNG and names their instance, in the new Settings block (or sets `TAVILY_API_KEY`). A learner who disagrees with a rate writes `~/.derive/prices.json` by hand; Derive never creates it.

## Next Phase Readiness

- **Phase 03 is complete.** All nine plans have summaries. The owned loop runs on five provider rows with the fourteen tutor tools, its own retries and step cap, a priced usage ledger, a pluggable web search, per-provider tool dialects, the lesson's cost on both screens, and the two things a learner configures for it reachable in one place.
- **Ready for Phase 4** (local models and the conformance harness). The in-process server helper is the seam a conformance harness needs to drive the whole HTTP surface against a scripted model; the `search` block and the price-override file are both read live, so a local row needs no new settings surface.
- **Seven real-key runs are owed and recorded.** No provider key exists in this environment, so Success Criteria 1 and 2 are half-proven: a whole lesson each on Anthropic, OpenAI, Gemini, OpenRouter (with a billed cost in the usage table) and a base-URL endpoint, plus one lesson through the Claude Code plugin and one through the Codex skills. The `api.test.ts` header states this, the plan's Task 3 human check lists them, and they are in `.planning/WINDOWS.md`.
- **One dated obligation carried forward from 03-02, unchanged:** Google's Gemini rates in `PRICES` are promotional through 2026-12-31 and double on 2027-01-01. `PRICES_AS_OF` says so and the new Settings sentence now shows that date to the learner; nothing automated will notice the change.
- **Requirements marked complete:** `PROV-09` (web search on every provider, now configurable in one block), `COST-04` (the price override file, documented on the page and in `.env.example`), and `PROV-01`, `PROV-02`, `PROV-03`, `PROV-05` — the four provider requirements this phase's nine plans delivered and which the shared-ID gate held open until this, the last plan. `PROV-02` and the real-key half of `PROV-01` rest on human checks that are recorded rather than performed; the automated half is `server/test/api.test.ts` and `server/test/api-driver.test.ts`.

## Self-Check: PASSED

- **Files claimed created** — `web/src/components/fields.ts` **FOUND**, `web/src/components/WebSearchCard.tsx` **FOUND**; all nine claimed-modified files **FOUND** on disk. No commit of this plan deleted a tracked file (`git diff --diff-filter=D` empty on all three).
- **Commits** `7c95e6b`, `b125669`, `90ccf9a` — all three **FOUND** in `git log`. `git rev-list --count 9f12b5b837aa211a51e9996e32945a00d7bb2342..HEAD` read **3** at the moment this file was written, which is `actuals.commits`, and `git rev-parse 7c95e6b^` → `9f12b5b`, matching `plan_head_before`. Re-running that count later reads more than 3, by design: the close-out commits (this file, then STATE/ROADMAP) can only land after the figure is written. `git rev-list --count 9f12b5b..90ccf9a` → **3** is the form that reproduces exactly, because it ends at the last production commit rather than at HEAD. A subject grep is *not* the form to use here: `--grep '03-09'` matches the close-out commits too and reads 5 once they land, which is why 03-04 through 03-08's wording is tightened rather than copied.
- **Whole-tree gate** — `pnpm method:check` → `method: 6 rendered copies match method/`; `pnpm typecheck` clean in both packages; `pnpm build` exit 0; `pnpm --filter web build` exit 0; `pnpm test` → **396 tests, 396 pass, 0 fail** (up from 391 at the dispatch base: five new owned-loop cases). `server/test/api.test.ts` and `server/test/spawn.ts` also typecheck clean under `--strict` on their own (the package's `tsconfig` includes `src` only, which is pre-existing).
- **Task 1 gates** — `lift complete`; `card copy ok`; `no direct fetch` (0 matches with comments stripped); `api.setSearch|api.testSearch|api.removeSearchKey` → **5** lines (floor 3); `prices sentence ok`; `card tokens declared`; `ls web/src/components/*.tsx | wc -l` → **14**; `git diff --quiet -- web/src/lib/useLesson.ts` → clean. `grep` for a local `field|pill|textButton|tickLine|errLine|noteLine` declaration under `web/src` → **1**, which is `You.tsx`'s own `field` (deferred, see Issues).
- **Task 2 gates** — `node scripts/doctor.mjs` exits **0** and prints `Price overrides  none; Derive uses its shipped price table`; with a scratch `prices.json` present it prints the path and `(merged over the shipped table)`; `grep -c "Price overrides"` → 1; `TAVILY_API_KEY` in `.env.example` → 1; `prices.json` in `.env.example` → 1; no `readFileSync(.*prices|JSON.parse(.*prices` in the doctor → **no match**; `doctor scope ok`; `git diff --quiet -- README.md` → clean.
- **Task 3 gates** — `api suite drives the loop`; `doStreamCalls` asserted at 3 and 9; no real provider or search host named in the suite → **no match**; `grep -c refused` → **8**; `test/mcp.test.ts test/driver.test.ts test/wire-surface.test.ts` → **25 pass, 0 fail**; `git diff --quiet -- server/src/index.ts` clean across the task, so the startup side effects are unchanged; the fourteen pre-existing cases in `api.test.ts` pass unconverted.
- **Human-check states observed in headless Chrome** (two scratch servers on free ports with scratch data dirs, four viewport widths): **A3 empty** the `web search` section is fourth after `on this machine`, `the provider's own` is selected, the no-search sentence is verbatim, and the card holds 0 inputs and 0 buttons; **the native variant** reads `This provider searches with its own tool. Nothing to configure.` once an Anthropic row is active; **A3 populated** Tavily shows one password field and no address field, SearXNG shows one address field and no password field; **A3 loading** the tick appears and is gone 1.8 s later, `test search` reads `testing…` disabled in flight; **A3 error** the failed test renders the server's sentence in rust-400 with the typed value still in the field; **A3 partial** both missing-value lines in ink-500; **A3 long-text** a 111-character address scrolls inside its field with no page or card growth at 375px and 1280px; **destructive** `remove` → `keep` leaves the key set; **A4** the sentence is last, muted, 62ch, with no control after it, and an unparseable `prices.json` replaces it with the server's rust sentence. Hover feedback is not observable headlessly (Tailwind v4 gates `hover:` behind `@media (hover:hover)`), and the SearXNG json-disabled sentence needs a real instance — both recorded.
- **New gates seen failing** — with the first check switched from `procedure` to `intuition`, so the lock is allowed, `refuses the lock with no understanding pass` fails with `the refusal did not reach the model as a refusal` and the `node_status` sequence becomes three entries; reverted and re-run green.
- **Scratch cleanup** — both scratch servers and every Chrome instance this run started are stopped (verified: both ports answer nothing); `git status --short` shows only the four untracked `.planning/research/.cache` files, `.planning/milestone.lock` and `cleanup-root.sh` that pre-date the dispatch base, plus `.gsd/dispatch-isolation-sentinel.json`, all left alone.

---
*Phase: 03-owned-loop-api-keys-and-gateways*
*Completed: 2026-10-12*
