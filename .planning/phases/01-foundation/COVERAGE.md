# API Coverage — Derive's MCP / tutor tool surface

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

**Scope note.** Phase 1 consumes no *new* external API. The three SDKs already in
the tree (`@anthropic-ai/claude-agent-sdk`, `@openai/codex-sdk`,
`@modelcontextprotocol/sdk`) are being moved behind a `Driver` seam, not newly
integrated — their capability decisions belong to Phase 3 (owned loop). What this
phase *does* define is the capability surface Derive **exposes**: the tool
contract the Claude Code plugin, the Codex skills and the HTTP action route all
speak. D-05 locks that surface at all 21 tools, so the matrix below is the
subtraction record for it.

| capability | decision | reason |
|---|---|---|
| quiz | INTEGRATE | |
| ask | INTEGRATE | |
| set_plan | INTEGRATE | |
| node_status | INTEGRATE | |
| set_phase | INTEGRATE | |
| explain_back | INTEGRATE | |
| remember | INTEGRATE | |
| set_preferences | INTEGRATE | |
| read_material | INTEGRATE | |
| search_material | INTEGRATE | |
| search_library | INTEGRATE | |
| read_resource | INTEGRATE | |
| suggest_resource | INTEGRATE | |
| add_resource | INTEGRATE | |
| start_lesson | INTEGRATE | MCP-only driver tool; in the registry per D-05 |
| attach_material | INTEGRATE | MCP-only driver tool; in the registry per D-05 |
| answer | INTEGRATE | MCP-only driver tool; in the registry per D-05 |
| answer_in | INTEGRATE | MCP-only driver tool; in the registry per D-05 |
| learner_profile | INTEGRATE | MCP-only driver tool; in the registry per D-05 |
| learners | INTEGRATE | MCP-only driver tool; in the registry per D-05 |
| end_lesson | INTEGRATE | MCP-only driver tool; in the registry per D-05 |
| library | INTEGRATE | MCP-only catalog tool registered in `server/src/mcp.ts`; surfaces marked `mcp` only |

**Nothing is opted out.** D-05 is explicit that the registry covers the whole
surface because Phase 3's owned loop and Phase 4's description compaction both
need to enumerate it, and because the wire-surface snapshot (D-08) is only
meaningful if it covers everything the plugin sees.

*Produced at plan time for Phase 1 — Foundation.*
