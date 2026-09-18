---
schema_version: 1
open_count: 3
waived_count: 0
fixed_count: 0
total_count: 3
last_updated: 2026-09-18T13:16:03.682Z
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
  }
]
````
