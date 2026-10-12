---
phase: 03-owned-loop-api-keys-and-gateways
reviewed: 2026-10-12T00:00:00Z
depth: standard
files_reviewed: 45
files_reviewed_list:
  - server/src/search.ts
  - server/src/drivers/api.ts
  - server/src/drivers/adapters.ts
  - server/src/tools.ts
  - server/src/actions.ts
  - server/src/agent.ts
  - server/src/index.ts
  - server/src/settings.ts
  - server/src/providers.ts
  - server/src/probe.ts
  - server/src/prompt.ts
  - server/src/config.ts
  - server/src/context.ts
  - server/src/cost.ts
  - server/src/prices.ts
  - server/src/pricing.ts
  - server/src/db.ts
  - server/src/migrations.ts
  - server/src/driver.ts
  - server/src/library.ts
  - web/src/components/WebSearchCard.tsx
  - web/src/components/ProviderRow.tsx
  - web/src/components/fields.ts
  - web/src/pages/Settings.tsx
  - web/src/pages/Lesson.tsx
  - web/src/pages/Home.tsx
  - web/src/pages/You.tsx
  - web/src/lib/api.ts
  - web/src/lib/types.ts
  - server/test/api.test.ts
  - server/test/api-driver.test.ts
  - server/test/search.test.ts
  - server/test/wire-surface.test.ts
  - server/test/wire-surface.json
  - server/test/mcp.test.ts
  - server/test/cost.test.ts
  - server/test/usage.test.ts
  - server/test/settings.test.ts
  - server/test/migrations.test.ts
  - server/test/tx.test.ts
  - server/test/spawn.ts
  - scripts/doctor.mjs
  - .env.example
  - server/package.json
  - pnpm-lock.yaml
findings:
  critical: 2
  warning: 4
  info: 7
  total: 13
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-10-12
**Depth:** standard
**Files Reviewed:** 45
**Status:** issues_found

## Summary

The owned loop, the five adapter rows, the dialect projection and the new Settings surface were read
in full, with the Claude/Codex drivers, `cost.ts`/`prices.ts`/`pricing.ts`, the new migrations and the
suite read alongside them. `pnpm -r typecheck` is clean, `pnpm --filter server test` is 396/396 green,
and `pnpm install --frozen-lockfile` is in step.

The destination guard question in the brief checks out on the paths that matter. `actions.fetchPage`
goes through `library.ts`'s `fetchPublic` with `assertPublicHost` on **every hop** — I confirmed at
runtime that `fetch_page` against `http://127.0.0.1:<port>/paper.pdf` is refused with library.ts's own
sentence rather than fetched. Every new outbound request (`tavilySearch`, `searxngSearch`,
`noRedirectFetch` behind all five provider factories) sets `redirect: 'manual'` and refuses a 3xx, so
no key-bearing request can be walked to a host the catalogue never named. Keys are stored under
`keys.ts` behind `registerSecret`, and every sentence that can carry a provider's body back to the
learner passes through `safeMessage`.

What does not hold up is the money and two of the loop's own guards.

Two findings are proven at runtime, not inferred. **CR-01**: the per-call charge for a provider's
native web search is computed by the adapter, written into `usage.cost_usd`, and then silently
dropped by the only function that renders a lesson total — a lesson the adapter priced at $0.034
displays as `under $0.01 estimated`. That is exactly the outcome D-20 and `adapters.ts`'s own comment
say must not happen, in the one module whose stated purpose is that "a figure may never claim more
firmness than its weakest input". **WR-01**: D-07's replay guard is keyed on `(lesson_id, call_id)`
and never compares the tool name it recorded, so a later turn's `node_status` call that happens to
reuse a call id is answered with an earlier `quiz` result and the real tool never runs — I reproduced
that against the real `db.ts`.

**CR-02** is a code-reading finding with no ambiguity: `fetch_page` hands the model the raw bytes of
any non-HTML document, which for the PDF papers `library.ts` goes out of its way to support means
14,000 characters of binary noise reported as `ok: true` with a title, then persisted into
`turn_messages` and resent on every later turn of the lesson.

The rest are smaller: a retry path that tells the model the learner stopped the turn when they did
not, a `limit` the Tavily request never sends, and the one address the SearXNG guard-bypass comment
itself cites as the reason the guard exists being the one address the bypass now permits.

Style was judged against `.claude/CLAUDE.md`. Long lines, brace-less single-statement `if` bodies,
`.js` import extensions, snake_case wire fields, named-exports-only and the reasoned empty catches
are house convention and are not reported.

## Critical Issues

### CR-01: A provider's native web-search charge is priced, stored, and then dropped from the lesson total

**File:** `server/src/cost.ts:105-112`, `server/src/drivers/api.ts:834-845`, `server/src/db.ts:698-708`, `server/src/migrations.ts:209-229`

**Issue:** `adapters.ts` prices a step's native searches into `CostRead.cost_usd` and returns the
count in `CostRead.searches` (`adapters.ts:140-160`, `adapters.ts:267-276`). `usageOf` in
`drivers/api.ts:834-845` writes `cost_usd` and `cost_source` but **discards `searches`** — `UsageInput`
has no such field and the `usage` table has no such column. `costOf` then re-derives the money for
every `table` row from the token columns and `num(r.searches)`, and **never reads `r.cost_usd`**:

```ts
// cost.ts:110
usd += num(r.input_tokens) * price.input + ... + num(r.searches) * num(price.web_search);
```

A row read back from SQLite has no `searches`, so the term is zero and the charge vanishes. Proven
against the real modules:

```
adapter CostRead: { cost_usd: 0.034, cost_source: 'table', searches: 3 }
lesson total shown to the learner: under $0.01 estimated
tokens alone would be: 0.004 + 3 searches at $0.01 = 0.034
```

Three consequences. The figure in the lesson header and the Home row understates a searching lesson
by $0.01 per Anthropic/OpenAI search and $0.014 per Gemini grounding call — on a tutor whose method
tells it to verify before it teaches, that is the dominant term on a cheap lesson. `usage.cost_usd`
becomes write-only data for every `table` row, so the stored figure and the displayed figure already
disagree and any later reader (a Phase 4 usage page) will show a third number. And `adapters.ts:66-69`
documents the opposite of what the code does ("folded into `cost_usd` here through the same `costOf`
the lesson header totals with ... lands in the ledger rather than vanishing from the lesson's cost"),
so the next reader has no reason to look.

`cost.test.ts:220-221` passes only because it builds a `CostRow` literal that carries `searches`; no
test takes the adapter → `recordUsage` → `lessonCost` path, which is where the field is lost.

**Fix:** persist the count, since `CostRow` already has the optional field and `costOf` already prices
it. One migration and three plumbing lines:

```ts
// migrations.ts — migration 8
db.exec('ALTER TABLE usage ADD COLUMN searches INTEGER');

// db.ts — UsageRow and UsageInput
searches: number | null;      // UsageRow
searches?: number | null;     // UsageInput

// db.ts — recordUsage, in the INSERT's column list and bind order
count(row.searches),

// drivers/api.ts — usageOf
searches: cost.searches,
```

With the column present, `listUsage` rows carry `searches` and `costOf` needs no change at all. Do
**not** "fix" this by making `costOf` trust `r.cost_usd` for `table` rows: that would freeze the
figure at the table version in force when the row was written and silently stop `~/.derive/prices.json`
from correcting past turns, which is the one thing `prices.ts` exists for.

---

### CR-02: `fetch_page` returns raw binary for any non-HTML document, and persists it into the lesson history

**File:** `server/src/actions.ts:512-527` (the decision is line 517)

**Issue:** The content-type branch treats anything that is not HTML as readable text:

```ts
const raw = buf.toString('utf8');
const body = type.includes('text/html') || type.includes('xhtml') || /^\s*<(?:!doctype|html)/i.test(raw) ? htmlToText(raw) : raw;
```

`PAGE_ACCEPT` ends in `*/*;q=0.5`, so a server will happily serve a PDF, and `fetchPublic` enforces no
content type. For `application/pdf` the condition is false on all three clauses (`%PDF-1.7` is not
`<html`), so `body` is the PDF's bytes decoded as UTF-8. The function then returns
`{ ok: true, title: titleOf(text), text, truncated: ... }` — binary noise presented to the model as a
page it may cite, with a `title` scraped out of the noise.

This is not an exotic input. `library.ts` carries a whole arXiv/PDF extraction path
(`library.ts:407-447`, `pdfSegments`, `MAX_PDF_BYTES`) precisely because papers are what a tutor
fetches, and `fetch_page`'s own description names "a source you are about to cite". The new tool is the
one fetcher in the codebase that does not handle them.

It is worse than a wasted call, because the result is durable: `drivers/api.ts:459` passes the tool
output to `answer`, which pushes it into `messages` and calls `persist()`, so up to 14,000 characters of
binary junk land in `turn_messages` and are re-sent to the provider on every subsequent turn of that
lesson for as long as the history survives.

**Fix:** reuse the extraction the library already has, and refuse what neither branch can read, rather
than passing bytes through:

```ts
const { type, buf, url: finalUrl } = await fetchPublic(url, PAGE_ACCEPT, MAX_PDF_BYTES, assertPublicHost);
const html = type.includes('text/html') || type.includes('xhtml');
const pdf = type.includes('application/pdf') || buf.subarray(0, 5).toString('latin1') === '%PDF-';
if (!html && !pdf && !type.startsWith('text/') && !/^\s*<(?:!doctype|html)/i.test(buf.subarray(0, 64).toString('utf8'))) {
  throw new Error(`that address answered with ${type || 'an unknown type'}, which is not a page derive can read`);
}
const body = pdf ? (await pdfSegments(buf)).join('\n\n') : html ? htmlToText(buf.toString('utf8')) : buf.toString('utf8');
```

`pdfSegments` is already in `library.ts` (line 353) and is one more export away; the byte cap should
move to `MAX_PDF_BYTES` for the same reason the library uses it. The refusal sentence reaches the model
as a tool error it can act on, which is the right shape — a URL the tutor cannot read is the tutor's
problem to route around, not a lesson to poison.

## Warnings

### WR-01: The replay guard is lesson-scoped and ignores the tool name, so a reused call id returns another tool's result

**File:** `server/src/db.ts:866-876` (and the query at `server/src/db.ts:186`), `server/src/drivers/api.ts:443-448`

**Issue:** `recordedToolResult` resolves the lesson off the turn and then looks the call up by
`(lesson_id, call_id)` with `ORDER BY ts LIMIT 1` — the **earliest** row for that id anywhere in the
lesson's history. The row stores `tool`, and nothing ever compares it to the tool now being invoked.
`drivers/api.ts:443-448` answers from that row and returns, so the tool does not run:

```ts
const recorded = recordedToolResult(ctx.turnId, toolCallId);
if (recorded) {
  answer(toolCallId, spec.name, { type: 'json', value: recorded.output as never });
  return recorded.output;
}
```

Reproduced against the real `db.ts` with two turns of one lesson on the `openai-compatible` row, where a
local endpoint numbers its tool calls from zero on each request:

```
what the loop replays for node_status/call_0 on turn 2: { tool: 'quiz', output: { result: 'correct', confidence: 'sure' } }
```

The second turn's `node_status` never ran, and the model was handed a quiz grade in its place. The
lesson-wide scope is deliberate and right for the restart case D-07 is about, but it widens the guard
from "this call, after a crash" to "this id, ever in this lesson", and the suite's own case
(`api-driver.test.ts:827-862`) exercises precisely the collision — a model legitimately calling
`remember` on a later turn with the same id — and asserts the no-op as correct. `openai-compatible` is a
`teaches: true` row in this phase, and the id is whatever the learner's endpoint chose.

Two smaller edges in the same mechanism: `agent.ts:275-278` drops the history on a provider change but
leaves `tool_results` in place, so the stale ids outlive the conversation they belonged to; and a
replayed call is answered but never pushed into `messages` (its id is already in `called`), so the
persisted history omits a call the model made and had answered.

**Fix:** make the row's own `tool` part of the match, which costs nothing and turns a wrong answer into
a fresh run:

```ts
// db.ts
export function recordedToolResult(turnId: string, callId: string, tool?: string): { tool: string; output: unknown } | null {
  const turn = getTurn(turnId);
  if (!turn) return null;
  const row = q.getToolResult.get(turn.lesson_id, callId) as { tool: string; output: string } | undefined;
  // A recorded result answers only the tool it was recorded for: a provider that
  // numbers its call ids per request will reuse one across turns, and replaying
  // a quiz grade for a node_status call is worse than running the call.
  if (!row || (tool !== undefined && row.tool !== tool)) return null;
  ...
}

// drivers/api.ts
const recorded = recordedToolResult(ctx.turnId, toolCallId, spec.name);
```

and clear the guard with the history it belongs to, in `agent.ts`'s provider-change branch:

```ts
if (lesson.session_id) clearSessionId(lessonId);
clearTurnMessages(lessonId);
clearToolResults(lessonId);   // new, wrapping q.deleteToolResultsByLesson
```

### WR-02: A retried request tells the model the learner stopped the turn

**File:** `server/src/drivers/api.ts:299`, `server/src/drivers/api.ts:345-359`, `server/src/drivers/api.ts:761-776`

**Issue:** `patchOrphans` writes one sentence for every unanswered tool call:

```ts
const STOPPED_BEFORE_TOOL = 'The learner stopped the turn before this tool ran.';
```

It is called on the abort part, in the catch, in the finally — and, at `drivers/api.ts:772`, inside the
wrapper that settles state *before a retryable error escapes to `withRetries`*. So a 429 or a 5xx that
arrives after the model opened a tool call makes the next attempt carry a history that states the
learner stopped, when the learner did nothing. The tutor reads that as a fact about the session and
will apologise for, or work around, an interruption that never happened; on a provider that was merely
busy for a second this is the common path, not an edge.

The same patch also loses a real result: if the tool was already running (a card is open), the patch
answers the id first, and the tool's own `answer(...)` is then dropped by the `answered` guard at
`drivers/api.ts:552` — while `recordToolResult` at line 458 still records what it actually returned. The
history says the call did not run and the ledger says it did.

**Fix:** say what happened. One sentence per cause, chosen by the caller:

```ts
const STOPPED_BEFORE_TOOL = 'The learner stopped the turn before this tool ran.';
const FAILED_BEFORE_TOOL = 'The request failed before this tool ran; it was not executed.';

export function patchOrphans(messages: ModelMessage[], answered: Set<string> = answeredIds(messages), reason: string = STOPPED_BEFORE_TOOL): number
```

and pass `FAILED_BEFORE_TOOL` from the settle at line 772 and from the `catch (err)` at line 803,
keeping the default for the abort part and the finally. Both sentences stay idempotent and the
provider-accepted shape of the history is unchanged.

### WR-03: `web_search` advertises up to 10 results but the Tavily request never asks for more than its default

**File:** `server/src/search.ts:177-196` (the body is line 185), `server/src/tools.ts:399`

**Issue:** The tool contract tells the model it may ask for 1–10 results and `MAX_HITS` is 10, but the
request body is `JSON.stringify({ query })` — `max_results` is never sent, so Tavily answers with its
own default (5) and `hitsOf` slices a list that was never longer than that. A tutor that asks for ten
results silently gets five, and `limit` above 5 is a field the model can set and nothing honours.
`search.test.ts:201-208` only exercises `limit` **below** the default, so the suite cannot see it.

The asymmetry is Tavily-specific: SearXNG returns a full page of results, so the same `limit` works
there, which makes the behaviour differ per backend for one documented parameter.

**Fix:** send the bound Derive already clamped:

```ts
export async function tavilySearch(query: string, limit: number): Promise<SearchHit[]> {
  ...
  body: JSON.stringify({ query, max_results: limit }),
```

`searchWeb` has already clamped `limit` to `1..MAX_HITS`, so nothing further is needed, and the
positional mapping in `hitsOf` keeps its "no sort, no re-rank" property unchanged.

### WR-04: The SearXNG guard-bypass admits the one address its own comment cites as the reason the guard exists

**File:** `server/src/search.ts:199-217` (lines 205-206), `server/src/settings.ts:98-109`

**Issue:** Skipping `assertPublicHost` for the learner's own instance is the right call and is well
argued — a SearXNG instance is usually on `localhost` or a `.local` name, which the guard refuses by
design. But the bypass is total, and `normaliseBaseUrl` constrains only the scheme, the credentials and
the query, so `http://169.254.169.254/...` is an accepted address. `search.ts:21-25` and
`library.ts:115-123` both name 169.254.169.254 explicitly as the thing the guard is for; after this
change it is reachable from the authenticated-local `POST /api/settings/search/test` and from every
`web_search` call the tutor makes.

Exploitability is genuinely limited and the severity reflects that: the learner has to store the
address themselves, and only entries of a JSON `results[]` array with a `url` reach the model, so a
metadata endpoint's response is not echoed back. But no SearXNG instance has ever lived on the
link-local range, so permitting it buys nothing that the stated goal needs.

**Fix:** keep the bypass for the addresses it was argued for and refuse the one it was not, at the
write rather than per request, so the learner reads the sentence while they are typing:

```ts
// index.ts, in PUT /api/settings/search
if (base_url) {
  const base = normaliseBaseUrl(base_url);
  // The bypass below exists for localhost and .local names, not for the cloud
  // metadata range: no searxng instance has ever been there.
  if (isLinkLocal(base)) return c.json({ error: 'that address is the cloud metadata range, which is never a searxng instance' }, 400);
  setSetting(SEARCH_BASE_URL, base);
}
```

`probe.ts:160-175` `isLocalUrl` already does the literal-host parse this needs; a narrow
`isLinkLocal` beside it (`169.254.x.x`, `fe80::/10`) reuses the same parse without a second guard.

## Info

### IN-01: A refused 3xx leaves its response body unread

**File:** `server/src/drivers/adapters.ts:55-59`, `server/src/search.ts:192`, `server/src/search.ts:210`

**Issue:** `noRedirectFetch` and both search backends throw on a 3xx without reading or cancelling
`res.body`, so the socket is held until undici reclaims it. `fetchPublic` already does this correctly
(`library.ts:339`: `await res.body?.cancel().catch(() => undefined)`).

**Fix:** mirror `fetchPublic` — `await res.body?.cancel().catch(() => undefined);` immediately before each
redirect throw.

### IN-02: `TutorChoice.modelSource` on the web omits the `'learner'` the server can return

**File:** `web/src/lib/types.ts:73` vs `server/src/settings.ts:42`

**Issue:** The server's `ModelSource` is `'environment' | 'learner' | 'settings' | 'default' | null`;
the hand-mirrored web type drops `'learner'`. `GET /api/settings/active` is the one learner-aware
settings route (`index.ts:475` calls `resolveTutor(learnerOf(c))`) and `You.tsx` calls it, so the value
is reachable. Nothing reads the field today, which is why the compiler is quiet — these types mirror the
server by hand (`CLAUDE.md`, "Shared web types ... mirror the server's row and payload shapes by hand"),
so the drift is the finding.

**Fix:** add `'learner'` to the union in `web/src/lib/types.ts`.

### IN-03: A comment describes a string the code cannot produce

**File:** `server/src/drivers/api.ts:62-73`

**Issue:** The `UNREPORTED` rationale contrasts `about $0.40 estimated` with `about $0.40 not reported`,
but `costLabel` returns the bare label for `unknown` (`cost.ts:130`) and `cost.test.ts:261` asserts it —
`about $0.40 not reported` is unreachable. The code is right and well tested; the example misdescribes
it, which is the kind of comment a later reader "fixes" the code to match.

**Fix:** restate the contrast as what actually happens: the ending and both views read `not reported`,
with the figure dropped, and that agreement is the property being preserved.

### IN-04: `fetchPublic`'s doc now contradicts its caller

**File:** `server/src/library.ts:322-332` vs `server/src/actions.ts:515`

**Issue:** "`guard` exists so the per-hop check can be proven against a fixture server on this machine
... nothing in the server ever passes it" — `actions.fetchPage` passes it (as the default value, so the
behaviour is unchanged).

**Fix:** either drop the redundant argument at `actions.ts:515` or amend the sentence to say that
`fetch_page` passes the default explicitly, so the reader is not told to look for a caller that exists.

### IN-05: Two schema dialects are built, frozen and selected by nothing

**File:** `server/src/tools.ts:53`, `server/src/drivers/adapters.ts` (every row is `'full'` or `'gemini'`)

**Issue:** `'openai-strict'` and `'compact'` are projected, snapshotted in `wire-surface.json` and
asserted in `wire-surface.test.ts`, but no adapter row returns either, so `project`'s strict branch
(`tools.ts:604-611`), `nullable` (`tools.ts:585-590`) and `shortened` (`tools.ts:514-527`) are dead on
every production path. The reason is stated at `adapters.ts:286-301` and is a sound one (Phase 4's
conformance harness measures what strict costs), so this is recorded rather than objected to — but the
cost is real: three code paths with no production reader, kept correct only by the fixture.

**Fix:** none now. When Phase 4 lands, either a row selects them or they go; a comment at `TOOL_DIALECTS`
naming the release that decides would keep the clock visible.

### IN-06: A provider that re-sends a search call id double-counts the charge

**File:** `server/src/drivers/api.ts:671` vs `server/src/drivers/api.ts:675`

**Issue:** `searches += 1` runs before the once-per-id guard, so a provider retry that re-sends the same
`tool-call` part counts the search twice, where `verified` (line 681) is correctly counted after the
guard. Harmless today only because CR-01 discards the count entirely; it becomes a wrong figure the
moment CR-01 is fixed.

**Fix:** move the increment below `called.add(part.toolCallId)`, beside the `verified` increment that
already sits there.

### IN-07: The replay record is written after the tool's effect, not with it

**File:** `server/src/drivers/api.ts:457-458`

**Issue:** `await actions.runTool(...)` commits the graded writes (`recordQuiz`, `addMisconception`,
`propagate`) and `recordToolResult` runs afterwards, in a later microtask. A process killed in between
leaves an effect with no record, which is the one state D-07 exists to prevent — the resumed turn would
run the graded tool a second time. The window is sub-millisecond and both halves are synchronous SQLite
writes, so this is a note rather than a defect.

**Fix:** if it is ever worth closing, `db.ts` already has `withTx`; wrapping the action's writes and the
record together would need the action to stop awaiting the learner inside the transaction, so the
honest change is to record a placeholder row before the call and update it after, both under one
transaction. Not worth doing on this evidence.

---

_Reviewed: 2026-10-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
