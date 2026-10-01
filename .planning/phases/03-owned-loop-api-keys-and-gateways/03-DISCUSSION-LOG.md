# Phase 3: Owned Loop: API Keys and Gateways - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-01
**Phase:** 3-owned-loop-api-keys-and-gateways
**Areas discussed:** Loop foundation & adapters, What the learner sees mid-turn, Cost in the lesson, Web search & fetch parity, Outgrowing the context window, Catalogue flip & the WR-01 defect, Schema projection strictness

Four areas were selected from the initial set; all four were selected. After they closed, three further gray areas were offered and all three were taken. 23 questions, 23 selections, every one the recommended option.

---

## Loop foundation & adapters

### What is Derive's own agent loop built on?

| Option | Description | Selected |
|--------|-------------|----------|
| Vercel AI SDK v7 | One `streamText` loop with `stopWhen`; `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`, `@openrouter/ai-sdk-provider`, `createOpenAICompatible`. ~5 new deps; MEDIUM-confidence `providerMetadata` path for OpenRouter cost. Phase 4's local providers ride the same loop. | ✓ |
| Native provider SDKs + own loop | Exact per-provider fidelity; three message shapes, three tool-call shapes, three stream parsers to maintain. | |
| Hand-rolled fetch, no SDKs | Zero new deps, nothing between Derive and the wire; Derive maintains every wire shape and stream parser. | |

**User's choice:** Vercel AI SDK v7
**Notes:** Presented with the repo's own counter-evidence — `probe.ts` already talks to every provider with plain `fetch`, and the dependency list is nine pinned packages. The deciding factor accepted was that a streaming tool-call loop is a different order of surface from a models list.

### How are per-provider differences shaped?

| Option | Description | Selected |
|--------|-------------|----------|
| One driver + adapter table | One `api` driver, one loop, a table keyed by `ProviderId` for model factory, dialect, native search, cache hook, cost reader. A sixth provider is one row. | ✓ |
| One driver per provider | Five files, each owning its quirks; the loop, retry policy and tool dispatch exist five times. | |
| One driver, branch inline | One file with `if (provider === …)` where behaviour differs. | |

**User's choice:** One driver + adapter table
**Notes:** Mirrors how `probe.ts` already switches on a `ProviderSpec`.

### What happens when OpenRouter's per-response cost field is missing?

| Option | Description | Selected |
|--------|-------------|----------|
| Fall back to the pricing table | `cost_source: 'table'`; the learner's label moves from billed to estimated. The roadmap's own stated fallback. | ✓ |
| Record tokens only, cost unknown | Strictest reading of D-16; learner sees a partial total on a paid provider. | |
| Ask OpenRouter for it | Second call to `/api/v1/generation` for the authoritative figure; a round trip and a failure mode inside the turn. | |

**User's choice:** Fall back to the pricing table
**Notes:** The honesty lives in the label rather than in a gap.

### Does Phase 2 D-04 still hold now that Derive owns the messages?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep D-04: fresh start on switch | `turn_messages` holds provider-neutral `ModelMessage`s for resume within one provider; a provider change drops them and the tutor rebuilds from events and nodes. | ✓ |
| Carry the history across the switch | One sanitised array surviving a provider change; reverses a Phase 2 decision marked costly. | |
| One thread per provider, kept | Parked threads per provider; no answer to which is the lesson's real history. | |

**User's choice:** Keep D-04: fresh start on switch
**Notes:** The concrete reason recorded: carrying history across a switch means replaying Anthropic thinking parts and Gemini thought signatures into a provider that rejects them.

### What bounds a turn, and what does the learner see at the bound?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep ~400, end continuably | Same bound as today's `maxTurns: 400`; hitting it ends the turn through normal `turn_end` with a continuable status. A runaway guard, not a teaching limit. | ✓ |
| A much lower cap | ~30 steps surfaces a loop as a visible failure; trips on a legitimately long first turn. | |
| No step cap | Bounded only by the context refusal and Stop. | |

**User's choice:** Keep ~400, end continuably

### Does prompt caching ship in this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, stable-prefix split in v1 | Stable prefix (method text, tool contract) with Anthropic `cache_control`; volatile tail after it. OpenAI and Gemini need only the prefix byte-stable. COST-01 already records cache tokens. | ✓ |
| Only where it is free | Order the prompt well, write no `cache_control` breakpoints. | |
| Defer caching entirely | Build the loop first, optimise later with ledger data. | |

**User's choice:** Yes, stable-prefix split in v1
**Notes:** `method.generated.ts` is ~29KB and the loop resends it every step; the saving is visible in the ledger from day one.

### Where does tool-call idempotency live?

| Option | Description | Selected |
|--------|-------------|----------|
| Persist executed call ids + results | Stored next to `turn_messages`; a replay after a crash returns the recorded result. Protects the FSRS record and stops a card re-opening. | ✓ |
| In-memory per turn | Covers a provider retry, not a restart — and the restart case damages the memory record. | |
| Lean on the tools being idempotent | 22 places that each have to stay correct forever; grading is inherently not idempotent. | |

**User's choice:** Persist executed call ids + results

### How are parallel tool calls handled?

| Option | Description | Selected |
|--------|-------------|----------|
| Serialise, and disable where supported | Provider flag off where it exists, serialise unconditionally as the backstop. | ✓ |
| Serialise only | Model keeps emitting pairs Derive quietly queues; wasted tokens, misleading transcript. | |
| Refuse the extras | Error `tool_result` teaching the model one card at a time; a wasted step each time. | |

**User's choice:** Serialise, and disable where supported

---

## What the learner sees mid-turn

### Does the learner see the model's reasoning?

| Option | Description | Selected |
|--------|-------------|----------|
| No — keep the "Thinking" status | What `agent.ts` emits today; identical on every provider (some return only a count or an encrypted blob); the durable record stays the teaching, not the scratchpad. | ✓ |
| Yes, collapsed | A block the learner can open; adds a surface the simplicity rule would question, and it would differ per provider. | |
| Yes, streamed inline | Least dead air; puts unpolished half-thoughts in front of a learner building a mental model. | |

**User's choice:** No — keep the "Thinking" status

### Is the "provider busy" card part of the lesson's permanent record?

| Option | Description | Selected |
|--------|-------------|----------|
| Ephemeral while retrying, `turn_end` if it runs out | No new event type, nothing in `EVENT_TYPES`, `applyEvent` or the Obsidian mirror. A transient stall is not part of what they learned. | ✓ |
| Persist it as an event | The record shows where the provider stalled; costs a new event type in two places and puts provider weather in the learner's notes. | |
| Ephemeral only, silent on failure | A turn that stops with no sentence saying why — the thing Phase 2 worked hardest to avoid. | |

**User's choice:** Ephemeral while retrying, `turn_end` if it runs out

### How patient is the retry?

| Option | Description | Selected |
|--------|-------------|----------|
| Patient, up to ~2 minutes | Honour `Retry-After`, exponential backoff with jitter otherwise, countdown visible, Stop working throughout. | ✓ |
| Brisk — 3 attempts, ~30 seconds | Fast feedback; turns a recoverable stall into a failed turn on a slow free tier. | |
| Retry once, then hand it over | Learner in control; the most common transient 429 interrupts teaching. | |

**User's choice:** Patient, up to ~2 minutes
**Notes:** A free-tier Gemini or OpenRouter limit can be a full minute, and a lesson that dies on it is a dead lesson.

### What does Stop do to the lesson?

| Option | Description | Selected |
|--------|-------------|----------|
| Abort, patch orphans, stay resumable | Synthesized error `tool_result` per orphan so `turn_messages` stays valid; turn ends interrupted, not failed; the next message continues. | ✓ |
| Abort and clear the history | Nothing malformed can reach a provider because nothing is kept; the tutor repeats itself. | |
| Let the step finish | No orphans possible; Stop stops feeling like Stop on a slow model. | |

**User's choice:** Abort, patch orphans, stay resumable

---

## Cost in the lesson

### Where does "about $X.XX" go on the lesson screen?

| Option | Description | Selected |
|--------|-------------|----------|
| Into the same pill, after the model | `anthropic · claude-opus-5-5 · about $0.14 estimated`; the model id takes the truncation, the cost never does. One element, not two. | ✓ |
| Its own element beside the pill | Never competes for width; adds a second thing to the 60px header. | |
| Below the title, outside the header | Most readable; puts money in the learner's eyeline every time. | |

**User's choice:** Into the same pill, after the model

### How does `cost_source: 'unknown'` read?

| Option | Description | Selected |
|--------|-------------|----------|
| A fourth label: "not reported" | D-16 introduced `unknown` so the honest blank could be said out loud; migration 4 backfilled it. | ✓ |
| Fold unknown into "not billed" | Three labels as COST-02 wrote them; labels a genuine gap as a certainty. | |
| Show no cost when unknown | Nothing misleading; learner cannot tell free from unrecorded. | |

**User's choice:** A fourth label: "not reported"

### Where does the versioned pricing table live?

| Option | Description | Selected |
|--------|-------------|----------|
| A committed module, like `providers.ts` | Pure data with `PRICES_AS_OF`, no I/O, no import-time side effect; a reviewable diff, works offline, nothing in the cost path can fail. | ✓ |
| Fetched at runtime, cached | Never stale; a network call behind a cost figure, against the local-first constraint. | |
| Shipped table plus an optional refresh | Best of both; two sources of truth for one number. | |

**User's choice:** A committed module, like `providers.ts`

### How does the learner override prices locally (COST-04)?

| Option | Description | Selected |
|--------|-------------|----------|
| A JSON file under `~/.derive`, no UI | `prices.json` merged over the table, read live, following the `keys.ts` / `credentials.ts` pattern. `/settings` gains one sentence and no new control. | ✓ |
| Fields in Settings | Discoverable and usable by a non-technical learner; adds up to twenty number inputs to the page. | |
| No override, just show the date | Nothing to maintain; leaves COST-04 unmet. | |

**User's choice:** A JSON file under `~/.derive`, no UI

### Does the figure tick up during a turn?

| Option | Description | Selected |
|--------|-------------|----------|
| Only at turn end | Recomputed at `turn_end` from the rows the turn wrote; no new ephemeral traffic; same honesty rule as the Phase 2 D-15 pill. | ✓ |
| Live, per model request | A learner on a paid key can stop before it gets expensive; puts a money counter in motion next to a quiz. | |
| Live but coarse | Step-boundary updates; still a ticking number and still a new event type. | |

**User's choice:** Only at turn end

### What does the Home row carry?

| Option | Description | Selected |
|--------|-------------|----------|
| The lesson's total, same wording | A `SUM` over that lesson's usage rows, given D-13's per-request grain. Phase 5 inherits one short string per row. | ✓ |
| Only on the most recent lesson | Most faithful to "one screen, one next step"; COST-02 says the Home row. | |
| Nothing on Home; cost lives in the lesson | Cleanest Home; leaves half of COST-02 unmet. | |

**User's choice:** The lesson's total, same wording

### How is a sub-cent figure written?

| Option | Description | Selected |
|--------|-------------|----------|
| Two decimals, with a floor of "under $0.01" | Money in the units a learner thinks in; the one case two decimals would lie about gets its own words. | ✓ |
| More decimals when small | Always precise; reads like telemetry rather than a price. | |
| Round to the cent, no floor | Simplest; tells a learner on a metered key something was free when it was not. | |

**User's choice:** Two decimals, with a floor of "under $0.01"

---

## Web search & fetch parity

### Native provider search, or the pluggable provider?

| Option | Description | Selected |
|--------|-------------|----------|
| Native where it exists, pluggable otherwise | PROV-09's own wording. Three of five providers need no second account. Research must confirm coexistence with the strict schema projection and that the separate per-call charge lands in the ledger. | ✓ |
| Always the pluggable provider | One code path; costs every learner a second account before the tutor can check a fact. | |
| Native by default, overridable in Settings | Both paths stay tested; adds a control the simplicity rule would question. | |

**User's choice:** Native where it exists, pluggable otherwise

### How does fetch work on the owned loop?

| Option | Description | Selected |
|--------|-------------|----------|
| One Derive tool over `fetchPublic` | Identical on all five providers; one SSRF guard from D-10, one status line, visible in the wire-surface snapshot. `{{WEB_TOOLS}}` gains a third rendering. | ✓ |
| Reuse `add_resource` | No new tool; makes every glanced-at page a permanent library entry the method limits to one or two per lesson. | |
| Native where it exists, Derive's tool elsewhere | Cheapest requests on those providers; two paths for one method sentence, and the provider's fetch bypasses the guard. | |

**User's choice:** One Derive tool over `fetchPublic`

### Where is the fallback search configured?

| Option | Description | Selected |
|--------|-------------|----------|
| One small block on `/settings` | Choice of provider's own / Tavily / SearXNG; key in `secrets.json` behind the `{ set, hint }` shape, URL in the settings table, save-as-you-go. | ✓ |
| Environment variables only | Adds nothing to the page; a learner silently loses the verification discipline with no way to find out why. | |
| Catalogue rows beside the providers | Free key field, test button and pill; puts non-teaching things in a list whose rows answer "what is teaching". | |

**User's choice:** One small block on `/settings`
**Notes:** The one-sentence learning reason accepted: the method requires the tutor to verify a fact before teaching it, and a learner on OpenRouter cannot without this.

### What happens when no search is available at all?

| Option | Description | Selected |
|--------|-------------|----------|
| Swap the method's wording, say so | `{{WEB_TOOLS}}` renders as "no web search here; say when you are unsure rather than guess". One render change, no rule lost, inside Phase 1 D-02's bounded variation. | ✓ |
| Refuse to teach without search | Strongest method fidelity; blocks the free OpenRouter path and Phase 4's offline promise. | |
| Leave the method text alone | Byte-identical prompt; instructs the tutor to call a tool that is not there. | |

**User's choice:** Swap the method's wording, say so

---

## Outgrowing the context window

### What happens when a lesson outgrows the window?

| Option | Description | Selected |
|--------|-------------|----------|
| Refuse with a clear card, graph intact | The roadmap's stated first version; nodes, FSRS rows and graph already persisted, review path already exists. No silent truncation can drop the gate. | ✓ |
| Compact the middle, keep teaching | No mid-derivation wall; the gate then rests on a summary the model wrote about itself. | |
| Refuse, and offer to continue in a new lesson | Smoothest recovery; lesson-splitting machinery and a second meaning for "this lesson". | |

**User's choice:** Refuse with a clear card, graph intact

### How is the limit detected?

| Option | Description | Selected |
|--------|-------------|----------|
| Estimate before the request, with headroom | Derive's own sentence rather than a provider error, identical on five providers, and the estimator Phase 4 needs for Ollama's `num_ctx`. | ✓ |
| Let the provider say no, then handle it | Always accurate; five error shapes, a wasted request each time, raw errors on an unrecognised wording. | |
| Both — estimate, and catch the error | Nothing slips through; two paths that must agree on what the card says. | |

**User's choice:** Estimate before the request, with headroom

---

## Catalogue flip & the WR-01 defect

### Is WR-01 fixed in this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Fix it here, keyed by provider | `LearnerPrefs.model` becomes `Record<provider, modelId>`; `chooseModel` reads `prefs.model?.[provider]`; a migration converts the existing bare string. Already an Active requirement with no phase assigned. | ✓ |
| Clear the override on a provider switch | No schema, no migration; the learner silently loses a preference, repeatedly. | |
| Leave it for Phase 5 | Keeps scope as the roadmap drew it; ships a provider-switching phase with a provider-switching bug. | |

**User's choice:** Fix it here, keyed by provider
**Notes:** The reason it belongs here: this phase takes teaching providers from two to seven, which is what makes the latent bug reachable.

### What does the Claude Code catalogue row become?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep it, reworded as the subscription route | Stays `teaches: true`; its note points a learner who wants in-app Claude at the Anthropic row. PROJECT.md's decision was about which route Derive recommends. | ✓ |
| Demote it to "use the plugin" | Cleanest reading of the terms; removes a path that works today. | |
| Leave the note exactly as it is | Smallest diff; leaves a "next release" promise standing in the release that delivers it. | |

**User's choice:** Keep it, reworded as the subscription route

---

## Schema projection strictness

### Which side gives when a shape will not survive OpenAI strict mode?

| Option | Description | Selected |
|--------|-------------|----------|
| The projection adapts; the registry is untouched | `jsonSchemaOf` gains per-dialect projection; the full zod schema stays what the server validates against, so a narrow dialect never narrows what Derive accepts. | ✓ |
| Simplify the registry to a common subset | One shape everywhere; lets the weakest dialect dictate the contract for every provider. | |
| Strict only where required, loose elsewhere | Least work; non-strict modes are where models invent fields, which is what PROV-10's validation exists to catch. | |

**User's choice:** The projection adapts; the registry is untouched

### How does CI validate the projections?

| Option | Description | Selected |
|--------|-------------|----------|
| Extend the snapshot, plus a dialect validator | Projections in `wire-surface.json` for the diff, and the dialect rules asserted outright — a snapshot alone would freeze an invalid schema. | ✓ |
| Snapshot only | One mechanism; freezes whatever the projector produces, valid or not. | |
| Rules only, no snapshot | Less diff churn; a silent description change across a dialect stops being visible in review. | |

**User's choice:** Extend the snapshot, plus a dialect validator

---

## Claude's Discretion

The user did not open these; they are recorded in CONTEXT.md under `### Claude's Discretion` with the direction to follow:

- Where the API driver file and its adapter table live under `server/src/drivers/`.
- The `turn_messages` schema and whether the executed-call record of D-07 is one table or two (the grain is not discretionary).
- Exact SDK and provider package pins — exact versions, never `latest`.
- Which models the pricing table covers at launch; an absent model prices as `unknown` → `not reported`, never zero.
- The concrete step-cap number and the headroom fraction for the context estimate.
- Where cost is computed — a pure function over usage rows and the pricing table, testable the way `schedule.ts` is.
- Status-line labels for the new search and fetch tools; reuse today's wording so the learner sees no change between the plugin and the owned loop.
- How the API suite drives the owned loop with a stub model — a fake `LanguageModel` inside the real loop serves Success Criterion 1 better than a fake driver.
- `.env.example` and `scripts/doctor.mjs` entries for the search provider and the price override file.

## Deferred Ideas

Nothing was deferred out of scope — the discussion stayed inside the phase boundary, and two items that could have been deferred were deliberately folded in (WR-01, the catalogue note rewrite) with the reason recorded on each.

Two options were **rejected rather than deferred**, and reopening either needs a learning reason:

- Live cost ticking during a turn (D-17).
- Showing the model's reasoning to the learner (D-09).

Already placed elsewhere by the roadmap, listed in CONTEXT.md `<deferred>` so nobody re-opens them during Phase 3: local models and capability probes, "test teaching", the conformance harness, the usage page (all Phase 4); per-lesson model switching and tiered roles, Copilot and Gemini CLI drivers, budgets and cost-per-node analytics (all out of scope or v2 per PROJECT.md).
