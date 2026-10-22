---
schema_version: 1
open_count: 26
waived_count: 0
fixed_count: 0
total_count: 26
last_updated: 2026-10-22T20:40:59.733Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | deviation | plugin/commands/learn.md |  | allowed-tools is rendered in registry declaration order rather than the committed hand-curated order; tool sets verified identical to b8f255ce | open |  | 2026-09-18T11:42:20.112Z |  |
| 2 | 01 | deviation | server/src/agent.ts |  | buildTools read the registry off spec.description/spec.shape instead of descriptionFor/shapeFor; fixed in 646451c | open |  | 2026-09-18T11:58:40.950Z |  |
| 3 | 01 | unrun-verify | server/src/library.ts |  | An ordinary public URL fetch through fetchPublic could not be exercised: the execution environment has no DNS or outbound network. Re-check during the phase UAT parity run. | open |  | 2026-09-18T13:16:03.682Z |  |
| 4 | 01 | unrun-verify | .planning/phases/01-foundation/01-12-SUMMARY.md |  | HC-1 browser session-cookie smoke recorded but not performed (no automated test drives a real browser) | open |  | 2026-09-19T14:47:16.295Z |  |
| 5 | 01 | unrun-verify | .planning/phases/01-foundation/01-12-SUMMARY.md |  | HC-2 plugin + Codex parity run (FOUND-04 human half) recorded but not performed; needs a real model and login on two terminals | open |  | 2026-09-19T14:47:16.434Z |  |
| 6 | 01 | deviation | server/test/guards.test.ts |  | Clone pinning and tarball secret-name filter are asserted at the source, not driven: git has no outbound HTTP offline, so no case drives a real redirect | open |  | 2026-09-19T17:53:25.199Z |  |
| 7 | 01 | deviation | server/test/security.test.ts |  | The install token's absence from the MCP browser-open command line is asserted by reading server/src/mcp.ts, not driven: the exposure is /proc/<pid>/cmdline, which a sandboxed test cannot observe | open |  | 2026-09-20T13:28:49.826Z |  |
| 8 | 01 | deviation | server/test/security.test.ts |  | hostNames' fail-closed empty-set branch is asserted by reading server/src/index.ts, not driven: a connection's local address cannot be made undefined from outside the process | open |  | 2026-09-20T13:28:50.181Z |  |
| 9 | 01 | deviation | server/test/security.test.ts |  | Rotating the token also signing out the stdio MCP server and the plugin hook is asserted by reading their boot-time token reads (server/src/mcp.ts:75, plugin/hooks/mirror.mjs:33), not driven: a stdio MCP server's credential lifetime cannot be observed from inside this suite | open |  | 2026-09-20T17:19:15.030Z |  |
| 10 | 01 | unrun-verify | .planning/phases/01-foundation/01-20-PLAN.md |  | HC-1's expected result changed with this plan: step 5 now expects 401 after deleting ~/.derive/token with the server left RUNNING, no restart. The corrected six-step sequence is in 01-20-PLAN.md Task 3; still not performed by a human | open |  | 2026-09-20T17:19:15.256Z |  |
| 11 | 01 | unrun-verify | server/test/guards.test.ts |  | The five clone-argv pins 01-21 added (ssh command, credential helper, fsmonitor, hooks path, pager) are asserted at the source, not driven: fromGitClone refuses anything that is not https:// before git is spawned and there is no DNS or outbound network here. Fold one repo import by GitHub URL into HC-2's run and confirm it still imports normally. | open |  | 2026-09-20T17:35:28.787Z |  |
| 12 | 01 | deviation | server/test/security.test.ts |  | Deleting the ticket describe block also deleted its source-assertion that server/src/mcp.ts contains no exec( shell spawn and no searchParams.set('token'); nothing now goes red if a future change puts the install token back into the browser-opener URL | open |  | 2026-09-20T18:26:11.288Z |  |
| 13 | 02 | unrun-verify | .planning/phases/02-settings-and-secrets/02-UAT.md |  | Phase 2 UAT is status: partial — the four visual findings 02-07 closed in source (375px header truncation, 32px text-button hit area, /you Section 07 id fit, tutor pill 40ch) were verified against the emitted CSS, not re-driven in headless Chrome; UAT tests 4 and 5 need a re-run to close | open |  | 2026-10-01T10:54:49.674Z |  |
| 14 | 03 | unrun-verify | server/src/drivers/api.ts |  | 03-01 human check unrun: one real Anthropic-key lesson to a locked node (streaming pill, Thinking line with no reasoning in the record or vault, clean Stop) — no provider key exists in this environment | open |  | 2026-10-06T21:40:44.849Z |  |
| 15 | 03 | unrun-verify | server/src/drivers/adapters.ts |  | 03-03 human check unrun: one real lesson each on an OpenAI key, a Gemini key (graph actually drawn), an OpenRouter key (usage rows read cost_source provider with a non-null cost_usd) and a learner base URL, plus a Stop-and-resume — no provider key exists in this environment | open |  | 2026-10-06T22:51:41.778Z |  |
| 16 | 03 | unrun-verify | .planning/phases/03-owned-loop-api-keys-and-gateways/03-04-PLAN.md |  | Plan 03-04 human check unrun: a real Stop-and-continue, a mid-card Stop with the quiz_results count unchanged, and a provider switch mid-lesson all need a real provider key, and none exists in this environment | open |  | 2026-10-06T23:30:48.227Z |  |
| 17 | 03 | unrun-verify | .planning/phases/03-owned-loop-api-keys-and-gateways/03-05-PLAN.md |  | Plan 03-05 human check unrun: a real free-tier rate limit survived with the countdown visible and Stop responsive, a wrong key failing immediately in the provider's own words, the countdown's absence from the Obsidian note after a reload, and the refusal card read at 375px and 1280px all need a real provider key, and none exists in this environment | open |  | 2026-10-12T18:30:07.458Z |  |
| 18 | 03 | unrun-verify | .planning/phases/03-owned-loop-api-keys-and-gateways/03-06-PLAN.md |  | 03-06 Task 3 human check unrun: no provider key in this environment, so the native search status line and the rising verified count, the no-search provider admitting uncertainty, the Tavily-configured search, and the SearXNG json-disabled sentence are all unconfirmed on a real key | open |  | 2026-10-12T19:01:18.699Z |  |
| 19 | 03 | unrun-verify | server/test/wire-surface.json |  | Gemini dialect real-key confirmation unrun: no Gemini key in this environment, so that Google accepts the six-keyword projection of set_plan (03-RESEARCH A3, LOW confidence) is still an assumption; one real lesson that draws its graph settles it | open |  | 2026-10-12T19:26:42.613Z |  |
| 20 | 03 | unrun-verify | server/src/drivers/adapters.ts |  | OpenAI non-strict bounds confirmation unrun: no OpenAI key, so that a real lesson still plans with 3-12 nodes and quizzes with 2-3 options on the non-strict default is asserted on the wire only | open |  | 2026-10-12T19:26:50.891Z |  |
| 21 | 03 | unrun-verify | web/src/pages/Lesson.tsx |  | 03-08 A1 loading: that the lesson cost holds still for the whole of a live turn on a real metered provider is unobserved — no provider key exists here; proven statically (no timer, no poll, refetch only on mount and on busy going false) | open |  | 2026-10-12T20:04:39.820Z |  |
| 22 | 03 | unrun-verify | server/src/drivers/adapters.ts |  | 03-08 D-06: that a real Anthropic lesson's second request reports a non-zero cache_read_tokens is unobserved — the breakpoint is asserted on the wire, not against Anthropic's own cache | open |  | 2026-10-12T20:04:49.634Z |  |
| 23 | 03 | unrun-verify | server/test/api.test.ts |  | The real-key halves of Success Criteria 1 and 2: a whole lesson each on an Anthropic, OpenAI, Gemini, OpenRouter (billed cost in the usage table) and base-URL key, plus one lesson through the Claude Code plugin and one through the Codex skills. No provider key exists in this environment. | open |  | 2026-10-12T20:57:31.595Z |  |
| 24 | 03 | unrun-verify | web/src/components/WebSearchCard.tsx |  | The SearXNG json-disabled sentence naming settings.yml is asserted at the server (search.test.ts) but not observed rendered on the card: it needs a real SearXNG instance with the json format off. | open |  | 2026-10-12T20:57:31.805Z |  |
| 25 | 03 | unrun-verify | web/src/components/WebSearchCard.tsx |  | Hover feedback on the card's text buttons is unverified in the browser: Tailwind v4 gates hover: behind @media (hover:hover), which no headless Chrome mode satisfies. Checked statically against the emitted CSS instead. | open |  | 2026-10-12T20:57:32.013Z |  |
| 26 | 04 | unmet-truth | server/src/drivers/api.ts | 530 | The per-lesson window refusal on the LM Studio and llama.cpp rows uses the num_ctx sentence, whose first fix (raise num_ctx in Settings) does nothing on a row D-05 makes read-only; only its second (pick a model with room) is actionable. Neither locked UI-SPEC sentence fits a read-only row and a third is a Copywriting Contract change. Pinned by server/test/local.test.ts#measures a read-only row against the window its server reported. | open |  | 2026-10-22T20:40:59.733Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "01",
    "file": "plugin/commands/learn.md",
    "line": null,
    "description": "allowed-tools is rendered in registry declaration order rather than the committed hand-curated order; tool sets verified identical to b8f255ce",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-18T11:42:20.112Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 2,
    "kind": "deviation",
    "phase": "01",
    "file": "server/src/agent.ts",
    "line": null,
    "description": "buildTools read the registry off spec.description/spec.shape instead of descriptionFor/shapeFor; fixed in 646451c",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-18T11:58:40.950Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "01",
    "file": "server/src/library.ts",
    "line": null,
    "description": "An ordinary public URL fetch through fetchPublic could not be exercised: the execution environment has no DNS or outbound network. Re-check during the phase UAT parity run.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-18T13:16:03.682Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 4,
    "kind": "unrun-verify",
    "phase": "01",
    "file": ".planning/phases/01-foundation/01-12-SUMMARY.md",
    "line": null,
    "description": "HC-1 browser session-cookie smoke recorded but not performed (no automated test drives a real browser)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-19T14:47:16.295Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 5,
    "kind": "unrun-verify",
    "phase": "01",
    "file": ".planning/phases/01-foundation/01-12-SUMMARY.md",
    "line": null,
    "description": "HC-2 plugin + Codex parity run (FOUND-04 human half) recorded but not performed; needs a real model and login on two terminals",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-19T14:47:16.434Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 6,
    "kind": "deviation",
    "phase": "01",
    "file": "server/test/guards.test.ts",
    "line": null,
    "description": "Clone pinning and tarball secret-name filter are asserted at the source, not driven: git has no outbound HTTP offline, so no case drives a real redirect",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-19T17:53:25.199Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 7,
    "kind": "deviation",
    "phase": "01",
    "file": "server/test/security.test.ts",
    "line": null,
    "description": "The install token's absence from the MCP browser-open command line is asserted by reading server/src/mcp.ts, not driven: the exposure is /proc/<pid>/cmdline, which a sandboxed test cannot observe",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-20T13:28:49.826Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 8,
    "kind": "deviation",
    "phase": "01",
    "file": "server/test/security.test.ts",
    "line": null,
    "description": "hostNames' fail-closed empty-set branch is asserted by reading server/src/index.ts, not driven: a connection's local address cannot be made undefined from outside the process",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-20T13:28:50.181Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 9,
    "kind": "deviation",
    "phase": "01",
    "file": "server/test/security.test.ts",
    "line": null,
    "description": "Rotating the token also signing out the stdio MCP server and the plugin hook is asserted by reading their boot-time token reads (server/src/mcp.ts:75, plugin/hooks/mirror.mjs:33), not driven: a stdio MCP server's credential lifetime cannot be observed from inside this suite",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-20T17:19:15.030Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 10,
    "kind": "unrun-verify",
    "phase": "01",
    "file": ".planning/phases/01-foundation/01-20-PLAN.md",
    "line": null,
    "description": "HC-1's expected result changed with this plan: step 5 now expects 401 after deleting ~/.derive/token with the server left RUNNING, no restart. The corrected six-step sequence is in 01-20-PLAN.md Task 3; still not performed by a human",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-20T17:19:15.256Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 11,
    "kind": "unrun-verify",
    "phase": "01",
    "file": "server/test/guards.test.ts",
    "line": null,
    "description": "The five clone-argv pins 01-21 added (ssh command, credential helper, fsmonitor, hooks path, pager) are asserted at the source, not driven: fromGitClone refuses anything that is not https:// before git is spawned and there is no DNS or outbound network here. Fold one repo import by GitHub URL into HC-2's run and confirm it still imports normally.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-20T17:35:28.787Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 12,
    "kind": "deviation",
    "phase": "01",
    "file": "server/test/security.test.ts",
    "line": null,
    "description": "Deleting the ticket describe block also deleted its source-assertion that server/src/mcp.ts contains no exec( shell spawn and no searchParams.set('token'); nothing now goes red if a future change puts the install token back into the browser-opener URL",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-20T18:26:11.288Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 13,
    "kind": "unrun-verify",
    "phase": "02",
    "file": ".planning/phases/02-settings-and-secrets/02-UAT.md",
    "line": null,
    "description": "Phase 2 UAT is status: partial — the four visual findings 02-07 closed in source (375px header truncation, 32px text-button hit area, /you Section 07 id fit, tutor pill 40ch) were verified against the emitted CSS, not re-driven in headless Chrome; UAT tests 4 and 5 need a re-run to close",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-01T10:54:49.674Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 14,
    "kind": "unrun-verify",
    "phase": "03",
    "file": "server/src/drivers/api.ts",
    "line": null,
    "description": "03-01 human check unrun: one real Anthropic-key lesson to a locked node (streaming pill, Thinking line with no reasoning in the record or vault, clean Stop) — no provider key exists in this environment",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-06T21:40:44.849Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 15,
    "kind": "unrun-verify",
    "phase": "03",
    "file": "server/src/drivers/adapters.ts",
    "line": null,
    "description": "03-03 human check unrun: one real lesson each on an OpenAI key, a Gemini key (graph actually drawn), an OpenRouter key (usage rows read cost_source provider with a non-null cost_usd) and a learner base URL, plus a Stop-and-resume — no provider key exists in this environment",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-06T22:51:41.778Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 16,
    "kind": "unrun-verify",
    "phase": "03",
    "file": ".planning/phases/03-owned-loop-api-keys-and-gateways/03-04-PLAN.md",
    "line": null,
    "description": "Plan 03-04 human check unrun: a real Stop-and-continue, a mid-card Stop with the quiz_results count unchanged, and a provider switch mid-lesson all need a real provider key, and none exists in this environment",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-06T23:30:48.227Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 17,
    "kind": "unrun-verify",
    "phase": "03",
    "file": ".planning/phases/03-owned-loop-api-keys-and-gateways/03-05-PLAN.md",
    "line": null,
    "description": "Plan 03-05 human check unrun: a real free-tier rate limit survived with the countdown visible and Stop responsive, a wrong key failing immediately in the provider's own words, the countdown's absence from the Obsidian note after a reload, and the refusal card read at 375px and 1280px all need a real provider key, and none exists in this environment",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-12T18:30:07.458Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 18,
    "kind": "unrun-verify",
    "phase": "03",
    "file": ".planning/phases/03-owned-loop-api-keys-and-gateways/03-06-PLAN.md",
    "line": null,
    "description": "03-06 Task 3 human check unrun: no provider key in this environment, so the native search status line and the rising verified count, the no-search provider admitting uncertainty, the Tavily-configured search, and the SearXNG json-disabled sentence are all unconfirmed on a real key",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-12T19:01:18.699Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 19,
    "kind": "unrun-verify",
    "phase": "03",
    "file": "server/test/wire-surface.json",
    "line": null,
    "description": "Gemini dialect real-key confirmation unrun: no Gemini key in this environment, so that Google accepts the six-keyword projection of set_plan (03-RESEARCH A3, LOW confidence) is still an assumption; one real lesson that draws its graph settles it",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-12T19:26:42.613Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 20,
    "kind": "unrun-verify",
    "phase": "03",
    "file": "server/src/drivers/adapters.ts",
    "line": null,
    "description": "OpenAI non-strict bounds confirmation unrun: no OpenAI key, so that a real lesson still plans with 3-12 nodes and quizzes with 2-3 options on the non-strict default is asserted on the wire only",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-12T19:26:50.891Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 21,
    "kind": "unrun-verify",
    "phase": "03",
    "file": "web/src/pages/Lesson.tsx",
    "line": null,
    "description": "03-08 A1 loading: that the lesson cost holds still for the whole of a live turn on a real metered provider is unobserved — no provider key exists here; proven statically (no timer, no poll, refetch only on mount and on busy going false)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-12T20:04:39.820Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 22,
    "kind": "unrun-verify",
    "phase": "03",
    "file": "server/src/drivers/adapters.ts",
    "line": null,
    "description": "03-08 D-06: that a real Anthropic lesson's second request reports a non-zero cache_read_tokens is unobserved — the breakpoint is asserted on the wire, not against Anthropic's own cache",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-12T20:04:49.634Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 23,
    "kind": "unrun-verify",
    "phase": "03",
    "file": "server/test/api.test.ts",
    "line": null,
    "description": "The real-key halves of Success Criteria 1 and 2: a whole lesson each on an Anthropic, OpenAI, Gemini, OpenRouter (billed cost in the usage table) and base-URL key, plus one lesson through the Claude Code plugin and one through the Codex skills. No provider key exists in this environment.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-12T20:57:31.595Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 24,
    "kind": "unrun-verify",
    "phase": "03",
    "file": "web/src/components/WebSearchCard.tsx",
    "line": null,
    "description": "The SearXNG json-disabled sentence naming settings.yml is asserted at the server (search.test.ts) but not observed rendered on the card: it needs a real SearXNG instance with the json format off.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-12T20:57:31.805Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 25,
    "kind": "unrun-verify",
    "phase": "03",
    "file": "web/src/components/WebSearchCard.tsx",
    "line": null,
    "description": "Hover feedback on the card's text buttons is unverified in the browser: Tailwind v4 gates hover: behind @media (hover:hover), which no headless Chrome mode satisfies. Checked statically against the emitted CSS instead.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-12T20:57:32.013Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 26,
    "kind": "unmet-truth",
    "phase": "04",
    "file": "server/src/drivers/api.ts",
    "line": 530,
    "description": "The per-lesson window refusal on the LM Studio and llama.cpp rows uses the num_ctx sentence, whose first fix (raise num_ctx in Settings) does nothing on a row D-05 makes read-only; only its second (pick a model with room) is actionable. Neither locked UI-SPEC sentence fits a read-only row and a third is a Copywriting Contract change. Pinned by server/test/local.test.ts#measures a read-only row against the window its server reported.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-22T20:40:59.733Z",
    "resolved_at": null,
    "milestone": null
  }
]
````
