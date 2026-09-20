---
schema_version: 1
open_count: 11
waived_count: 0
fixed_count: 0
total_count: 11
last_updated: 2026-09-20T17:35:28.787Z
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
  }
]
````
