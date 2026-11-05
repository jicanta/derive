---
phase: 05-learning-experience
reviewed: 2026-11-05T12:07:17Z
depth: standard
files_reviewed: 50
files_reviewed_list:
  - codex/skills/derive-due/agents/openai.yaml
  - codex/skills/derive-due/SKILL.md
  - plugin/commands/due.md
  - scripts/conformance.mjs
  - scripts/render-method.mjs
  - server/src/actions.ts
  - server/src/db.ts
  - server/src/index.ts
  - server/src/mcp.ts
  - server/src/migrations.ts
  - server/src/prompts.ts
  - server/src/prompt.ts
  - server/src/schedule.ts
  - server/src/tools.ts
  - server/test/api.test.ts
  - server/test/mcp.test.ts
  - server/test/migrations.test.ts
  - server/test/reducer.test.ts
  - server/test/retention.test.ts
  - server/test/schedule.test.ts
  - server/test/tx.test.ts
  - server/test/voice.test.ts
  - server/test/wire-surface.json
  - server/test/wire-surface.test.ts
  - web/src/components/AskCard.tsx
  - web/src/components/DuePill.tsx
  - web/src/components/ExplainCard.tsx
  - web/src/components/Graph.tsx
  - web/src/components/KeyHelp.tsx
  - web/src/components/NextStep.tsx
  - web/src/components/PageHeader.tsx
  - web/src/components/PlanCard.tsx
  - web/src/components/QuizCard.tsx
  - web/src/components/RetentionPanel.tsx
  - web/src/index.css
  - web/src/lib/api.ts
  - web/src/lib/htmlAttr.ts
  - web/src/lib/lessonReducer.ts
  - web/src/lib/locales.ts
  - web/src/lib/types.ts
  - web/src/lib/useLesson.ts
  - web/src/lib/useVoiceMode.ts
  - web/src/lib/voice.ts
  - web/src/pages/Atlas.tsx
  - web/src/pages/Home.tsx
  - web/src/pages/Lesson.tsx
  - web/src/pages/Library.tsx
  - web/src/pages/Settings.tsx
  - web/src/pages/Usage.tsx
  - web/src/pages/You.tsx
findings:
  critical: 2
  warning: 6
  info: 5
  total: 13
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-11-05T12:07:17Z
**Depth:** standard
**Files Reviewed:** 50
**Status:** issues_found

## Summary

Reviewed the phase 05 diff (`7bd7de6c^..HEAD`, ~3900 insertions across 50 files) against the project conventions in `.claude/CLAUDE.md`. `pnpm -r typecheck` passes for both packages. The persisted-prompt design (migration 11, `prompts.ts` as resolver-only, `gradeRestored` in `index.ts`) is sound in its main path and well tested, the retention arithmetic in `db.ts` is correct and bounded, `weakestFirst` is pure and pinned, and the web extraction of the reducer is a faithful move with `pending` as the only addition.

The two blocking findings are both interaction bugs between new mechanisms and existing paths that the new tests do not reach:

1. The remediation gate (`nameWeakest` → `openRemediation`) is opened on every non-pretest/probe miss and on every `node_status(shaky)`, including in **review sessions**, where `buildReviewGraph` copies dependencies into the lesson. The review prompt in the same diff tells the model to mark a twice-missed node shaky and immediately ask the next due node's question in the same turn; the gate refuses that quiz. The review session stalls on a refusal the prompt told the model to walk into.
2. `/api/lessons/:id/message` still calls `answerPrompt(id, pid, { steer })` for whatever `pendingId` returns. After a restart that row has no live resolver, so `answerPrompt` settles it with no grading, emits no `*_result` event, and the route returns early before `addNotice` — the learner's typed message is dropped on the floor and the card stays visibly open in the browser.

The warnings cover the restart lifecycle beyond the happy path (restored rows silently cancelled by `runTurn`'s `finally`, results graded mid-turn never reaching the model, the boot sweep discarding uncollected companion results), and three correctness defects in the new voice sentence chunker.

## Critical Issues

### CR-01: Remediation gate contradicts the review and warm-up prompts and stalls review sessions

**File:** `server/src/actions.ts:147` (`afterQuiz` miss path), `server/src/actions.ts:517` (`nodeStatus` shaky branch), `server/src/prompt.ts:133` (`reviewTurnPrompt`)
**Issue:** `afterQuiz` returns early for `cumulative`, `pretest` and `probe`, but a miss with `purpose === 'review'` falls through to `const step = ctx.nodeId ? nameWeakest(ctx.lessonId, ctx.nodeId) : null;`, and `nodeStatus(..., 'shaky')` calls `nameWeakest` unconditionally. `nameWeakest` calls `openRemediation(lessonId, nodeId, weakest.node_id)`, after which `remediationRefusal` rejects any `quiz` not on that pair. In a review session `buildReviewGraph` (`db.ts:1412-1440`) copies each due node's dependencies to depth 2 with `depends_on` populated, so `rankedDependencies` always finds something and the gate always opens. The review prompt added in this same phase says: "If that misses too, re-derive ... then `node_status(id, "shaky")`" followed by "Stay in this turn until the list is done: the moment you have acted on a verdict, ask the next due node's question in the same turn". The next due node is neither `open.node` nor `open.dependency`, so that quiz is refused with "Not that node yet". The model is now holding two contradictory server instructions; in practice the review either stalls until the learner types, or the model starts re-teaching a dependency — exactly what the review prompt says not to do ("do not re-teach it now"). The gate is also opened for a review quiz whose `node_id` is a review copy even though `needsUnderstanding` already treats `source_lesson` copies as outside the teaching gate. Warm-up copies happen to escape only because `buildWarmup` writes `depends_on = '[]'`. None of the new `api.test.ts` cases run the gate inside a review lesson.
**Fix:**
```ts
// actions.ts, afterQuiz miss path: the one-step-down rule is for the teaching
// loop; a review session re-derives and moves on by its own prompt.
const step = ctx.nodeId && purpose !== 'review' ? nameWeakest(ctx.lessonId, ctx.nodeId) : null;

// actions.ts, nodeStatus shaky branch: a review copy never opens the gate.
if (a.status === 'shaky') {
  const step = node.source_lesson ? null : nameWeakest(lessonId, a.id);
  ...
}
```
Add an `api.test.ts` case that starts a review lesson (`POST /api/review`), misses a review quiz, marks the copy shaky, and asserts a quiz on the next due copy returns 200.

### CR-02: `/message` on a restored card settles it ungraded and drops the learner's text

**File:** `server/src/index.ts:962-964` (external branch), `server/src/index.ts:971-973` (agent mid-turn branch)
**Issue:** Both branches do `const pid = pendingId(id); if (pid && answerPrompt(id, pid, { steer: text })) return c.json({ ok: true ... });`. `pendingId` now reads the `prompts` table, so after a restart it returns the restored row. `answerPrompt` (`prompts.ts:76-82`) settles that row and calls `resolve`, which is a no-op when `live` has no entry. Nothing is graded, no `quiz_result`/`ask_result`/`plan_result`/`explain_result` is emitted, `withNotice` never runs, and because the route returns inside the `if`, `addNotice` on line 973 is skipped. Consequences: (a) agent lesson, turn running (e.g. the learner typed once to resume, then typed again while the model worked): the second message is lost entirely — not answered, not queued, not shown as a steer; (b) external lesson: the browser card stays open with no result event, and the terminal's next `answer`/`collect` returns 409 `gone` because `pendingPrompt` is now null and `heldCard().result` is null, so the model never learns the learner wrote anything. The `gradeRestored` helper written three screens below exists precisely for this and is not used here. The restored-card test (`api.test.ts` "answering a card that was restored after a restart") exercises only `/answer`.
**Fix:**
```ts
/** Settle an open card with the learner's text, live or restored, and say whether anything was settled. */
function steerCard(lessonId: string, text: string): boolean {
  const pid = pendingId(lessonId);
  if (!pid) return false;
  if (isLivePrompt(pid)) return answerPrompt(lessonId, pid, { steer: text });
  return gradeRestored(lessonId, pid, { steer: text }) !== null;
}
// external branch
if (steerCard(id, text)) return c.json({ ok: true, note: 'Your message closed the open card; the tutor reads it at its next turn.' });
// agent mid-turn branch
if (steerCard(id, text)) return c.json({ ok: true });
addNotice(id, ...);
```
`gradeQuiz`/`settleAsk`/`settlePlan`/`settleExplain` already handle `steer` (emit the skipped result, call `withNotice`, clear the remediation gate), so routing through `gradeRestored` gives the restored card the same behaviour as a live one. Note `gradeRestored` is declared after the route; hoist it or move the route below it.

## Warnings

### WR-01: A restored card is cancelled silently by the next turn's `finally`, leaving a live-looking card that 409s

**File:** `server/src/agent.ts:367` (`cancelPending` in `runTurn` finally), `server/src/agent.ts:42` (`interrupt`), `server/src/prompts.ts:101-108` (`cancelPending`), `web/src/lib/lessonReducer.ts:112-125` (`turn_end`), `web/src/pages/Lesson.tsx:124`
**Issue:** `runTurn` ends every turn with `cancelPending(lessonId)`, which now walks `unsettledPromptRows` and settles each non-held row with `{ interrupted: true }`. For a row this process did not open, `resolve` is a no-op, so no settle function runs and no event is emitted. The non-busy branch of `/message` (`index.ts:976`) starts exactly such a turn with the restored card still open. The browser seeded `state.pending` from `lessonView` once and never clears it; `activePromptId` returns `state.pending.id` as long as the timeline item has no result, which it never gets. The learner is shown a live card after the turn; answering it hits `/answer` → `isLivePrompt` false → `gradeRestored` → `pendingPrompt` null → 409 "no such pending prompt". Same sequence on Esc/stop via `interrupt`.
**Fix:** Two halves. Server: when `cancelPending` settles a row with no live resolver, emit the kind's result event so the browser closes the card (e.g. `emit(lessonId, 'quiz_result', { id, selected: [], correct: [], explanation: '', result: 'skipped', note: null })`, or call the matching settle function via `graderFor` with `{ interrupted: true }` and have those emit on interrupt). Browser: in `lessonReducer.ts` `turn_end`, drop the seeded card unless it is held: `pending: heldOpen ? s.pending : null`. Also consider settling the restored card explicitly in the non-busy `/message` branch (via the `steerCard` helper from CR-02) before `runTurn`, so the typed message is handed to the model as the card's steer rather than racing it.

### WR-02: Restored card answered while an agent turn is running: graded, then the result goes nowhere

**File:** `server/src/index.ts:1109-1116`
**Issue:** The restored path only starts a turn when `lesson?.mode === 'agent' && !isBusy(id)`. If a turn is running (the learner resumed by typing, then answered the old card), `gradeRestored` writes the quiz row, the FSRS schedule and the misconception, but the model that is mid-turn is never told: no `addNotice`, no turn. The learner sees a graded card; the tutor carries on as if it never happened and may re-ask the same question.
**Fix:**
```ts
if (lesson?.mode === 'agent') {
  const text = restoredAnswerPrompt(open.kind, result);
  if (isBusy(id)) addNotice(id, text);
  else {
    if (!resumeCarries(id)) emit(id, 'notice', { text: 'graded and saved · starting a fresh turn, without the earlier conversation' });
    void runTurn(id, text).catch((e) => console.error('[turn]', safeMessage(e)));
  }
}
```

### WR-03: Boot sweep deletes settled held cards the terminal has not collected

**File:** `server/src/index.ts:113` (`sweepSettledPrompts()`), `server/src/db.ts:263` (`sweepSettledPrompts: DELETE FROM prompts WHERE settled = 1`), `server/src/migrations.ts:396-402` (rationale comment)
**Issue:** The migration comment and the boot comment both assume "a settled row's card text is only useful inside a terminal session that the restart has already ended". That is false for companion lessons: the Claude Code / Codex terminal and `mcp.js` are separate processes that proxy over HTTP and survive a Derive server restart. Sequence: held quiz opened from the terminal → learner answers in the browser → `holdCard`'s `.then` writes `{ answer, result }` onto the row → server restarts before the model calls `answer`/`collect` → sweep deletes the row → `heldCard` returns null → `answer` returns 409 "No card is waiting for a reply ... Ask again with a fresh quiz", and the UserPromptSubmit hook's `collect` returns `{ settled: null }`. The quiz row and FSRS write already happened, so the model now re-asks a question that has been graded and scheduled. The phase's own goal was that no card dies with the process.
**Fix:**
```sql
-- keep a held result until the terminal has taken it
DELETE FROM prompts
WHERE settled = 1
  AND (held = 0 OR json_extract(answer, '$.collected') = 1)
```
(`node:sqlite` builds with JSON1.) Update the two comments to say what is actually swept.

### WR-04: Voice never speaks the tail of a block that does not end in a sentence terminator

**File:** `web/src/lib/useVoiceMode.ts:177-191` (`case 'assistant'`), `web/src/lib/voice.ts:109-130` (`sentences`)
**Issue:** The old code spoke the whole block once `it.streaming` was false. The new code only ever queues `sentences(prose, from).complete`, which by design never returns a trailing fragment. There is no branch for "the block has finished and text remains after `next`". Any tutor block ending in `:` (the common "Let's check:" before a quiz), a list item, a short final clause without punctuation, or a sentence ending in `no.`/`e.g.` (see WR-06) is never spoken. The `sawStreaming` edge effect only re-arms the microphone; it does not flush text. `voice.test.ts` covers `sentences` only on fully terminated input.
**Fix:**
```ts
case 'assistant': {
  const prose = spokenText(it.text);
  const from = spoken.current.get(k) ?? 0;
  if (from >= prose.length) break;
  const { complete, next } = sentences(prose, from);
  for (const s of complete) say(s);
  let at = next;
  if (!it.streaming) {
    const tail = prose.slice(next).trim();
    if (tail) say(tail);
    at = prose.length;
  }
  if (complete.length || !it.streaming) spoken.current.set(k, at);
  break;
}
```

### WR-05: Sentence offsets index into `spokenText` output, which is not prefix-stable while streaming

**File:** `web/src/lib/useVoiceMode.ts:183-189`, `web/src/lib/voice.ts:42-63` (`spokenText`)
**Issue:** `spoken.current` stores a character offset into `spokenText(it.text)`. Several `spokenText` rewrites change the *length of earlier text* once later text arrives: an opening ``` is left verbatim until the closing fence arrives, then the whole block collapses to " There is a code block on screen. "; `[label` is literal until `](url)` arrives, then becomes `label`; a `$...$` formula is literal until its closing `$`. While a fence is open the chunker happily speaks lines of code as sentences; when it closes, the recorded offset now points far past the collapsed prose, so `from >= prose.length` breaks out and every following sentence is skipped until the text grows past the stale offset, after which the next spoken chunk starts mid-sentence. The comment on the case says the offset "is what makes that idempotent", which holds only if the prefix never shrinks.
**Fix:** Anchor on content rather than position. Store the last spoken sentence string per key and recompute `from` as `prose.lastIndexOf(lastSaid) + lastSaid.length` (falling back to 0 when not found), or hold back speaking while the raw markdown has an unmatched ``` / `$$` / `[` — e.g. `if (/```(?![\s\S]*```)/.test(it.text)) break;` before chunking.

### WR-06: `no` is treated as an abbreviation and CJK terminators can never match

**File:** `web/src/lib/voice.ts:84` (`ABBREVIATIONS`), `web/src/lib/voice.ts:87` (`SENTENCE_ENDS`), `web/src/lib/voice.ts:120` (whitespace-after check)
**Issue:** `ABBREVIATIONS` contains `'no'`, so "The answer is no. Here is why." is one unsplit chunk and, combined with WR-04, its tail may never be spoken — `no` is far more often the English word than "No." for number in tutor prose. Separately, `SENTENCE_ENDS` includes `。！？` but the scan requires `after` to be whitespace or end-of-text (`if (after !== undefined && !/\s/.test(after)) continue;`); Chinese and Japanese prose has no space after `。`, so those terminators only ever match at the very end of the text. The locale table advertises `zh-CN` and `ja`.
**Fix:** Remove `'no'` from `ABBREVIATIONS` (or require it to be followed by a digit: `/\bno\.\s*\d/i`). For the CJK set, skip the whitespace requirement when `c` is one of `。！？`: `if (!'。！？'.includes(c) && after !== undefined && !/\s/.test(after)) continue;`. Add `sentences('是的。然后呢。')` and `'The answer is no. Next.'` cases to `voice.test.ts`.

## Info

### IN-01: "Nothing due today. Next review today."

**File:** `server/src/mcp.ts:204-207` (`relativeOf`)
**Issue:** `relativeOf` returns `'today'` for `d <= 0`. `retentionNext` selects `review_at > $now`, so a review due later today yields the terminal copy "Nothing due today. Next review today." Accurate but reads as a contradiction.
**Fix:** `return d <= 0 ? 'later today' : d === 1 ? 'tomorrow' : \`in ${d} days\`;` and mirror the phrase in `plugin/commands/due.md` / the Codex skill if either lists allowed values.

### IN-02: Comment claims `openPrompt` refuses to write without a lesson row; it does not

**File:** `server/src/db.ts:561-572` (deleteLearner comment), `server/src/prompts.ts:50-60`, `server/src/migrations.ts:403-412`
**Issue:** The deleteLearner comment says "their only writers — saveTurnMessages, recordToolResult and openPrompt — refuse to write at all without the lesson or turn row they read their scope off". `openPrompt` → `insertPrompt` does not read the lesson and the table has no foreign key, so an orphan row is possible if a caller passes a stale id. Today's callers (`index.ts` external routes, `agent.ts` tools) do check the lesson first, so this is a documentation inaccuracy rather than a live bug, but the comment is the thing a future reader trusts.
**Fix:** Either add `if (!getLesson(lessonId)) throw new Error('lesson not found');` at the top of `openPrompt`, or reword the comment to say the callers guard it.

### IN-03: Remediation gate entries are never removed on lesson delete or end

**File:** `server/src/actions.ts:230` (`remediation` Map), `server/src/index.ts:912-917` (`DELETE /api/lessons/:id`), `server/src/index.ts:1758` (`end` action)
**Issue:** `remediation` is keyed by lesson id and only cleared by `clearRemediation`. Deleting a lesson or ending an external turn leaves the entry. Lesson ids are UUIDs so a collision is not a concern, but the map grows for the life of the process and the `notices`/`held` siblings it is modelled on are both cleared on delete.
**Fix:** Call `actions.clearRemediation(id)` in the delete route beside `cancelPending(id, { held: true })`.

### IN-04: ExplainCard's window-level Enter steals activation from focused header buttons

**File:** `web/src/components/ExplainCard.tsx:43-57`
**Issue:** The new global handler runs `e.preventDefault(); void send();` for any Enter outside a text field while the card is active. With focus on the voice, export, or "Change something" buttons (or the KeyHelp dialog), Enter now submits the teach-back instead of activating the focused control, because `preventDefault` on keydown suppresses the button's synthetic click. `QuizCard` has the same global Enter but only when `picked.length > 0`, which is a narrower trigger.
**Fix:** Bail when the target is a button or link: `if (t && (t.tagName === 'BUTTON' || t.tagName === 'A' || t.closest('[role="dialog"]'))) return;`.

### IN-05: `f` toggles focus mode while the key-help dialog is open

**File:** `web/src/pages/Lesson.tsx:225-245`
**Issue:** The help overlay traps Tab but the page-level handler still runs for `f` (target is the dialog `div`, not a text field), so pressing `f` while reading the help toggles focus mode behind the overlay. Harmless, but the dialog's own copy says only `?`/Esc are live there.
**Fix:** `if (help && e.key !== '?' && e.key !== 'Escape') return;` at the top of the handler, or `e.stopPropagation()` on the dialog's `onKeyDown`.

---

_Reviewed: 2026-11-05T12:07:17Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
