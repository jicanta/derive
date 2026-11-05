---
phase: 05-learning-experience
plan: 02
subsystem: ui
tags: [voice, speech-synthesis, speech-recognition, bcp-47, react, streaming, node-test]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: the committed pure-data discipline of server/src/pricing.ts (as-of date, no I/O, no import-time side effect) that locales.ts copies
provides:
  - "`sentences(text, from)` in web/src/lib/voice.ts — a pure splitter returning only complete sentences plus the first unconsumed index"
  - "streaming sentence-by-sentence speech in web/src/lib/useVoiceMode.ts, with a per-item character offset instead of a spoken/not-spoken flag"
  - "a mic-arming guard that holds the microphone shut while any assistant block is still arriving, plus arming on the edge where streaming stops"
  - "web/src/lib/locales.ts — a committed name→BCP-47 table (21 languages, English names and endonyms) with `localeOf` returning null for the unknown"
  - "`setVoiceLang(tag)` in voice.ts, which also invalidates the memoised voice"
  - "an optional `lang` option on useVoiceMode, resolved through `localeOf` before it reaches either speech engine — the seam 05-07 connects"
  - "server/test/voice.test.ts — the pure halves of voice under test with no browser and no new dependency"
affects: [05-07]

actuals:
  tokens: 8308         # chars/4 over the 4 files actually changed (33,234 chars) — the plan estimated 35,000
  diff_tokens: 5572    # chars/4 over the realized diff alone (22,288 chars)
  tasks: 2
  commits: 2           # MEASURED: git rev-list --count 0a880d67..HEAD at SUMMARY time (2 production commits; the docs commits follow)
plan_head_before: 0a880d673c5ddbe9b63a67acb81bc0c00df2435d

tech-stack:
  added: []
  patterns:
    - "A browser-dependent lookup replaced by a committed table, so the behaviour is reviewable in a diff and assertable with no browser"
    - "Per-item spoken-character offset: the idempotence key for a block that is rewritten with more text on every delta flush"
    - "A web module tested from the server package, because web/ has no runner and voice.ts guards every browser touch"

key-files:
  created:
    - web/src/lib/locales.ts
    - server/test/voice.test.ts
  modified:
    - web/src/lib/voice.ts
    - web/src/lib/useVoiceMode.ts

key-decisions:
  - "The sentence floor is 24 characters and is lifted at the end of the text: a short sentence waits to be prepended to the next one, but a block ending on a short sentence must not be swallowed — this is what makes both the `Yes.` case and the `Next one.` case true at once"
  - "`sentences` returns `{ complete, next }` and never a fragment; `next` is the index just past the last punctuation consumed, and each returned sentence is trimmed"
  - "A full stop is suppressed by three rules in order: a preceding digit (3.14), a letter preceded by a dot (U.S., e.g.), and a trailing word in a committed 12-entry abbreviation list"
  - "`LOCALES` keys stay in their own script with their own accents and are folded at lookup time inside `localeOf` (lower-case, NFD, combining marks dropped, whitespace collapsed, 60-char bound) — a reviewer reads `español` and `日本語` in the diff, and the folding still matches `ESPAÑOL` and `espanol`"
  - "`localeOf` folds both sides in one function with no helper at module scope, so the file's only top-level bindings are its three exports"
  - "Mic arming has two triggers, not one: the streaming guard in `afterSpeech` plus an effect on the streaming true→false edge, because the last sentence of a block is normally spoken before that edge"

patterns-established:
  - "Red before kept: both new subjects were observed failing before the gate was kept, and the failure lines are quoted below"
  - "The streaming guard carries its own reason inline, naming the symptom (mic indicator flickering mid-explanation, dictation capturing the tutor's own voice) so it is not simplified away"

requirements-completed: [LEARN-10]

coverage:
  - id: D1
    description: "Each completed sentence of a streaming assistant block is spoken once as it completes, with no trailing fragment and no sub-24-character utterance on its own"
    requirement: "LEARN-10"
    verification:
      - kind: unit
        ref: "server/test/voice.test.ts#splits after a full stop but not inside a decimal"
        status: pass
      - kind: unit
        ref: "server/test/voice.test.ts#does not say a sentence shorter than the floor on its own: \"Yes.\" waits for the next one"
        status: pass
      - kind: unit
        ref: "server/test/voice.test.ts#returns nothing for a trailing fragment, and consumes none of it"
        status: pass
      - kind: unit
        ref: "server/test/voice.test.ts#does not split an abbreviation or an initialism"
        status: pass
      - kind: unit
        ref: "server/test/voice.test.ts#says each sentence exactly once as a block grows"
        status: pass
    human_judgment: false
  - id: D2
    description: "The hook reads streaming assistant items and tracks spoken length per item key, so the tutor starts talking about a sentence into a block rather than after the paragraph"
    requirement: "LEARN-10"
    verification:
      - kind: other
        ref: "test \"$(sed -E 's;//.*$;;' web/src/lib/useVoiceMode.ts | sed -E '/^[[:space:]]*\\*/d' | grep -c 'it.streaming || !it.text.trim()')\" = 0"
        status: pass
      - kind: unit
        ref: "server/test/voice.test.ts#says each sentence exactly once as a block grows (the growing-block idempotence the offset provides)"
        status: pass
    human_judgment: true
    rationale: "The splitter and the offset arithmetic are asserted, but that the learner actually hears the first sentence early — latency, prosody, the gap between utterances — needs a speech engine. `speechSynthesis` is absent headless, so this is the end-of-phase human check the plan's <human-check> carries."
  - id: D3
    description: "The microphone does not open between two sentences of a block that is still streaming; it arms after the block's last sentence (prohibition T-05-08)"
    requirement: "LEARN-10"
    verification:
      - kind: other
        ref: "code gate: afterSpeech early-returns on streamingRef.current alongside isSpeaking(), and the only other arming path is the streaming true→false edge effect"
        status: pass
    human_judgment: true
    rationale: "No headless browser has `SpeechRecognition`, so no automated run here can observe the mic. The guard is code-level evidence; that the indicator does not flicker during a long explanation is the human check."
  - id: D4
    description: "`prefs.language` free text resolves to a BCP-47 tag through a committed table, case- and accent-tolerantly, with null for the unknown and `navigator.language` as the fallback"
    requirement: "LEARN-10"
    verification:
      - kind: unit
        ref: "server/test/voice.test.ts#resolves an English name, an endonym, and the same endonym shouted and padded"
        status: pass
      - kind: unit
        ref: "server/test/voice.test.ts#keeps a regional variant distinct from its language"
        status: pass
      - kind: unit
        ref: "server/test/voice.test.ts#returns null for a name it does not know, so the caller falls back to navigator.language"
        status: pass
      - kind: unit
        ref: "server/test/voice.test.ts#every tag is a BCP-47 tag the platform can parse"
        status: pass
    human_judgment: false
  - id: D5
    description: "locales.ts is committed pure data: no I/O, no import-time side effect, no import of anything outside the file (threat T-05-09)"
    requirement: "LEARN-10"
    verification:
      - kind: other
        ref: "test \"$(sed -E 's;//.*$;;' web/src/lib/locales.ts | sed -E '/^[[:space:]]*\\*/d' | grep -cE 'fetch\\(|localStorage|navigator\\.')\" = 0"
        status: pass
      - kind: other
        ref: "grep -cE '^import ' web/src/lib/locales.ts = 0; the only top-level bindings are LOCALES_AS_OF, LOCALES and localeOf"
        status: pass
      - kind: unit
        ref: "server/test/voice.test.ts (the whole file imports locales.ts under plain node with no browser and no database)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The memoised chosen voice is invalidated when the voice language changes, so the first-picked voice does not stick"
    requirement: "LEARN-10"
    verification:
      - kind: other
        ref: "code gate: `voice = undefined` inside the exported setVoiceLang, asserted on the comment-stripped source"
        status: pass
    human_judgment: true
    rationale: "`speechSynthesis.getVoices()` returns nothing headless, so the memo cannot be observed changing without a real browser. Switching `prefs.language` to `español` and hearing the next block in Spanish is the human check."
  - id: D7
    description: "server/test/voice.test.ts runs under the shipped `node --import tsx --test` runner from the server package with no new dependency, no new script and no CI change"
    requirement: "LEARN-10"
    verification:
      - kind: unit
        ref: "pnpm --filter server exec node --import tsx --test test/voice.test.ts (13 pass / 0 fail)"
        status: pass
      - kind: unit
        ref: "pnpm test (518 pass / 0 fail — the file is picked up by the shipped test/*.test.ts glob)"
        status: pass
    human_judgment: false

# Metrics
duration: 9 min
completed: 2026-11-04
status: complete
---

# Phase 05 Plan 02: Voice in sentences, in the learner's language Summary

**Voice now speaks each sentence as it completes while the block is still arriving — with a 24-character floor, decimal/initialism/abbreviation suppression and a per-item character offset that makes a block rewritten on every delta flush idempotent — and `prefs.language` reaches both speech engines as a BCP-47 tag from a committed 21-language table, with the microphone held shut until the block's last sentence.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-11-04T23:54:00Z
- **Completed:** 2026-11-05T00:03:00Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- **`sentences(text, from)` in `web/src/lib/voice.ts`** — a pure forward scan returning the complete sentences at or after `from` plus the index of the first unconsumed character. A trailing fragment is never returned, so the caller cannot say half a thought now and the same half again when the rest arrives.
- **The splitting rule as fixed in the plan**, with one judgement call the plan left open resolved explicitly: a sentence under 24 characters waits and is prepended to the next one, **except at the end of the text**, where there is no next one and the alternative is never saying it at all. That single exception is what makes both acceptance cases true at once — `Yes.` is not its own utterance, and `Next one.` at the end of a block still is one.
- **Full stops that do not end a sentence**: a preceding digit (`3.14`, `Chapter 3.`), a letter preceded by a dot (`U.S.`, `e.g.`), and a trailing word in a committed 12-entry `ABBREVIATIONS` list.
- **`web/src/lib/useVoiceMode.ts` reads streaming blocks.** The `spoken` `Set<string>` is now a `Map<string, number>` of characters already said per item key, and the `if (it.streaming || …) continue` skip is gone. Only text past the recorded offset is ever queued, which is what makes the 60 ms delta flush and the rewrite-under-the-original-seq idempotent.
- **The microphone is guarded twice over.** `afterSpeech` early-returns while any assistant block is still arriving — `isSpeaking()` has no notion of "more text is coming" and would otherwise arm in every inter-sentence gap — and a second effect arms on the streaming true→false edge, because the block's last sentence is normally spoken *before* that edge and nothing would be left to resolve.
- **`web/src/lib/locales.ts`** — committed pure data in the discipline `server/src/pricing.ts` states: a prose header saying what it is, why it is a table rather than a browser-dependent `getVoices()` match, that a new language is a one-line reviewable diff, that absent is null and never a guess, and that it has no I/O and no import-time side effect. 21 languages by English name and endonym, plus `pt-BR` as the one regional variant that is a different voice.
- **`setVoiceLang(tag)`** records the tag `voiceLang()` returns and resets the memoised voice, so the first-picked voice does not keep talking after a language change. The three existing `voiceLang()` read sites are untouched.
- **`server/test/voice.test.ts`** — 13 assertions over the splitter, the table, `spokenText` and `parseSpokenChoice`, under the shipped runner with no new dependency, no new script and no CI change. Full suite: 505 → 518 tests, 0 fail.

## Task Commits

1. **Task 1: sentences, not paragraphs — and the mic still waits for the block to finish** — `d4cb5f2` (feat)
2. **Task 2: the learner's language through a committed table, with voice under test** — `8d70636` (feat)

## Files Created/Modified

- `web/src/lib/locales.ts` **(new)** — `LOCALES` (21 languages, keys in their own script), `LOCALES_AS_OF` (`2026-11-04`), `localeOf(text)` folding both sides inside the function so the file's only top-level bindings are its three exports
- `web/src/lib/voice.ts` — a `// ---------- sentences ----------` section with `ABBREVIATIONS`, `SENTENCE_ENDS`, the exported `sentences` and the private `endsSentence`; `prefLang` + the rewritten `voiceLang()`; the exported `setVoiceLang` beside `pickVoice`'s memo
- `web/src/lib/useVoiceMode.ts` — the offset `Map`, the rewritten `assistant` branch, the `streaming`/`streamingRef`/`sawStreaming` bookkeeping, the guard inside `afterSpeech` with its reason inline, the streaming-edge arming effect, and the `lang` option resolved through `localeOf`
- `server/test/voice.test.ts` **(new)** — the module header stating why a web module is tested from the server package, then six suites

## Red observed before each gate was kept

Per CONTEXT.md D-27, a gate is kept only after it has been seen failing with its subject absent. Both subjects were planted-absent against the pre-change tree at `0a880d67`.

**The whole file, with `locales.ts` absent** (`pnpm --filter server exec node --import tsx --test test/voice.test.ts`):

```
# Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/jicanta/derive/web/src/lib/locales' imported from /home/jicanta/derive/server/test/voice.test.ts
not ok 1 - test/voice.test.ts
  error: 'test failed'
# pass 0
# fail 1
```

**The splitter assertions, with `sentences` absent** (the same file with the `locales` import and the locale suites stripped, so the three shipped helpers still prove the harness works):

```
    not ok 1 - splits after a full stop but not inside a decimal
      error: 'sentences is not a function'
    not ok 2 - does not say a sentence shorter than the floor on its own: "Yes." waits for the next one
      error: 'sentences is not a function'
    not ok 3 - returns nothing for a trailing fragment, and consumes none of it
      error: 'sentences is not a function'
    not ok 4 - does not split an abbreviation or an initialism
      error: 'sentences is not a function'
    not ok 5 - says each sentence exactly once as a block grows
      error: 'sentences is not a function'
# pass 3
# fail 5
```

The three passes in that run are `voiceSupport`, `spokenText` and `parseSpokenChoice` — the shipped helpers — which is the evidence that the red above is the subject's absence and not a broken harness.

## Decisions Made

Every entry in the plan's `<decisions_resolved_here>` was followed as written: the splitting rule and its three suppressions, the 24-character floor, the locale table's entries, the fold-and-bound matching, null for the absent name, and the hook taking the resolved tag as an option with `05-07` supplying it. Three calls the plan left to the executor:

- **The floor is lifted at the end of the text.** The two acceptance cases are in direct tension under a floor applied everywhere: `'Pi is 3.14 and that is that. Next one.'` must yield two sentences, and `'Next one.'` is nine characters. The resolution is that the floor only applies when non-whitespace text follows the boundary — a short sentence with more behind it waits, a short sentence at the end of what has arrived is said. The cost is honest and documented in the function's doc comment: a delta flush that lands exactly on a short sentence boundary will say it alone.
- **`LOCALES` keys keep their own script and accents; folding happens at lookup.** The plan calls `LOCALES` "the lookup from a case-folded, trimmed name or endonym to a BCP-47 tag". Storing pre-folded keys would have written `espanol` and a combining-mark-stripped `हिन्दी` into the diff, which defeats the one property the table was chosen for — that it is reviewable. Keys are lower case (so, case-folded) in their natural spelling, and `localeOf` folds both sides with the same local function. `Object.entries` over 42 rows runs once per language change.
- **Mic arming needed a second trigger.** See deviation 1: the streaming guard alone would have left the mic closed after any block whose last sentence was already spoken, which is the common case.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] arming also has to fire on the streaming→finished edge**

- **Found during:** Task 1
- **Issue:** The plan specifies one change to mic arming — an explicit "not streaming" check beside `isSpeaking()`. That guard alone is not sufficient: with one utterance per sentence, the block's **last** sentence is normally queued while the block is still streaming, so by the time `speak(...)` resolves and calls `afterSpeech` the guard is still true, and the later non-partial `assistant` event adds no new text and therefore queues no new utterance. The mic would never open after a plain explanation — the learner would be left with no way to reply but the keyboard, which is the whole of voice mode broken in the ordinary case.
- **Fix:** Kept the guard exactly as specified, and added one effect that arms on the `streaming` true→false edge (a `sawStreaming` ref consumes the edge, a 200 ms timeout lets a trailing utterance win the race, and `afterSpeech` is reached through a ref so the effect's deps stay `[enabled, streaming]` and cannot be cancelled by an identity change). The effect does nothing on mount, so voice mode still never opens the mic just because the page loaded.
- **Files modified:** `web/src/lib/useVoiceMode.ts`
- **Verification:** `pnpm --filter web typecheck`; the arming paths were read against all three callers (`say`'s resolve, the activeCard effect, the new edge effect) and the guard gate is green
- **Committed in:** `d4cb5f2`

**2. [Rule 1 - Bug] the shipped assistant branch re-said every finished block on every render**

- **Found during:** Task 1
- **Issue:** The branch being replaced had no `spoken.current.has(k)` check — unlike every other case in the same switch — so each time `items` changed (every SSE event), every finished assistant block was passed to `say` again and re-queued. The must-have "the same assistant block is never spoken twice" was therefore false before this plan, not only at risk from it.
- **Fix:** No extra code: the per-item character offset is the fix. `from >= prose.length` short-circuits a block with nothing new, and `sentences(prose, from)` returns nothing when no new boundary has arrived.
- **Files modified:** `web/src/lib/useVoiceMode.ts`
- **Verification:** `server/test/voice.test.ts#says each sentence exactly once as a block grows` asserts the offset is idempotent across four growing snapshots of one block
- **Committed in:** `d4cb5f2`

**3. [Rule 3 - Blocking] the enable effect had to learn the offset vocabulary**

- **Found during:** Task 1
- **Issue:** "Switching on: nothing already on screen is read back" was implemented by adding every item key to the `Set`. With a `Map` of offsets, a bare mark would read as offset 0 for a prose block and the whole backlog would be read aloud the moment voice was switched on.
- **Fix:** That effect now records `spokenText(it.text).length` for an assistant item and `1` for everything else; the four `delete` lines that deliberately re-open an unanswered card are unchanged.
- **Files modified:** `web/src/lib/useVoiceMode.ts`
- **Verification:** full suite green; the behaviour is unchanged by construction (an offset at the end of the text says nothing, which is what the `Set` membership meant)
- **Committed in:** `d4cb5f2`

---

**Total deviations:** 3 auto-fixed (1 bug, 1 missing critical functionality, 1 blocking). **Impact on plan:** no scope creep — all three are inside the two files the plan names, and each is the minimum needed for a stated must-have to be true. The plan's export surface, signatures, table entries and splitting rule are as written.

## Issues Encountered

- **`spokenText` is applied to a growing block, and the markdown→prose transform is not strictly prefix-stable** (an opening code fence can swallow text that had already been rendered as prose). The plan fixes this design — pass `spokenText(it.text)` and the offset to `sentences(...)` — so it was followed; the exposure is bounded by the `from >= prose.length` guard, which skips a snapshot whose prose shrank rather than slicing out of range. In the worst case a sentence spanning a newly-opened fence is skipped, never duplicated.
- **The human check cannot be run here at all.** `speechSynthesis` and `SpeechRecognition` are both absent headless (asserted, not assumed: `voiceSupport.speak === false` is the first thing the test file checks), and Tailwind v4's `hover:` gating means no headless mode helps either. Mic arming, voice selection and the latency win itself are coverage D2/D3/D6 above, carried to end-of-phase UAT exactly as the plan's `<human-check>` specifies.

## Threat Flags

None. No new endpoint, auth path, file access or schema change. The register's four rows are each as planned: **T-05-08** mitigated by the streaming guard in `afterSpeech` with its reason stated inline (and the edge effect that keeps arming correct without weakening it); **T-05-09** mitigated by `locales.ts` being pure committed data, asserted on the comment-stripped source; **T-05-10** mitigated by exact matching after fold-and-bound with null for the unmatched and no learner text interpolated into a tag; **T-05-11** accepted — `sentences` is one forward pass with no backtracking regex, and `hasMore` breaks on the first non-whitespace character.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **`05-07` owns the last wire.** `useVoiceMode` accepts `lang?: string | null` and nothing passes it yet, so voice currently runs on `navigator.language` exactly as it did before. `05-07`'s single `api.stats()` call in `Lesson.tsx` — the one it needs anyway for the due pill — returns `learner.prefs.language`; passing it as `lang` is the whole of the connection. RESEARCH §2.8 is explicit that this must be one fetch serving two decisions.
- **Three human checks carry to end-of-phase UAT** (coverage D2, D3, D6): that the tutor starts speaking about a sentence into a long explanation rather than after it, that the microphone indicator does not flicker between sentences and opens once the paragraph ends, and that setting `prefs.language` to `español` on the You page has the next block spoken in Spanish. Nothing in CI can render any of the three.
- **No blockers.** `pnpm method:check && pnpm typecheck && pnpm build && pnpm test` is green, and `server/test/voice.test.ts` is the third of D-27's three gates.

---
*Phase: 05-learning-experience*
*Completed: 2026-11-04*

## Self-Check: PASSED

All four files named in `key-files` exist on disk (`web/src/lib/locales.ts`,
`web/src/lib/voice.ts`, `web/src/lib/useVoiceMode.ts`,
`server/test/voice.test.ts`), and both task commits (`d4cb5f2`, `8d70636`) are
in the log. The plan-level verification was re-run whole: `pnpm method:check`
(6 rendered copies match `method/`), `pnpm typecheck` (server and web, no
`error TS`), `pnpm build`, and `pnpm test` (518 pass / 0 fail). All six Task 1
and all six Task 2 acceptance criteria were executed as commands and logged
PASS.
