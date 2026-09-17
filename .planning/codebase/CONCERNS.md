---
last_mapped_commit: 7d7db1f8c9352186f02b02ddb34172e66fef5eb5
last_mapped_at: 2026-09-17
---
# Codebase Concerns

**Analysis Date:** 2026-09-17

## Tech Debt

**Two drivers, one method, three copies of the tool contract:**

- Issue: The tutor's tool surface is defined three times with hand-synchronised descriptions and schemas: the in-process Claude tools (`server/src/agent.ts` `buildTools`, `TOOL_DESCRIPTIONS`, `nodeSchema`), the stdio MCP server for the plugin / Codex (`server/src/mcp.ts`, its own `nodeSchema`, `KINDS`, per-tool descriptions), and the HTTP action switch that the MCP server proxies to (`server/src/index.ts` `POST /api/external/lessons/:id/:action`). The teaching method itself is also written twice: `server/src/prompt.ts` (system prompt for the app) and `plugin/skills/teach/SKILL.md` (166 lines for the plugin), plus a third partial retelling in `plugin/commands/learn.md`.
- Files: `server/src/agent.ts`, `server/src/mcp.ts`, `server/src/index.ts`, `server/src/prompt.ts`, `plugin/skills/teach/SKILL.md`, `plugin/commands/learn.md`
- Impact: Every change to a tool argument (the `tests` field, `already_held`, `purpose`) has to land in three places; the two prompts already drift (the app prompt has a "Math Academy" discipline section the plugin skill paraphrases differently). A missed spot shows up as a model calling a tool the server rejects.
- Fix approach: Move the zod schemas and descriptions into one module (`server/src/tools.ts` already holds names and labels; extend it with `{ name, description, schema }` per tool) and have both `buildTools` and `mcp.ts` iterate it. Generate the HTTP action validation from the same schemas (see the "Input handling" entry below).

**Duplicated text-search, range-read and word-count helpers between material and library:**

- Issue: `searchMaterial` in `server/src/materials.ts` and `searchLibrary` in `server/src/library.ts` contain the same ~30-line term-scoring loop (indexOf counting to 5, +10 when every term hits, snippet with ellipses). `readMaterial` and `readResource` share the same `from`/`to` clamp and `READ_CHARS` chunking loop. `words()` (chars / 6, "k words") and the HTML/XML entity decoders (`decodeEntities` in library.ts, `decodeXml` in materials.ts) are copy-pasted.
- Files: `server/src/materials.ts` (lines ~330-416), `server/src/library.ts` (lines ~520-600)
- Impact: A ranking or snippet fix has to be made twice; the two already differ subtly (min term length 2 vs 3, snippet window 420 vs 380).
- Fix approach: Extract `scoreSegments(segments, terms)`, `readRange(segments, from, to, unit)`, `words(chars)` and one entity decoder into a `server/src/text.ts` used by both.

**Version strings scattered and out of sync:**

- Issue: `package.json` says `0.1.0`; `/api/health` returns a hardcoded `'0.4.0'` (`server/src/index.ts`); the MCP server says `0.4.0` (`server/src/mcp.ts`); the SDK MCP server says `0.2.0` and `CLAUDE_AGENT_SDK_CLIENT_APP: 'derive/0.2.0'` (`server/src/agent.ts`); the library fetch user-agent says `Derive/0.3` (`server/src/library.ts`); the plugin manifest says `0.4.0` (`plugin/.claude-plugin/plugin.json`).
- Files: `package.json`, `server/package.json`, `server/src/index.ts`, `server/src/mcp.ts`, `server/src/agent.ts`, `server/src/library.ts`, `plugin/.claude-plugin/plugin.json`
- Impact: `scripts/doctor.mjs` prints the health version, so users are told a version that matches nothing in git; releases tagged `vX.Y.Z` (`.github/workflows/release.yml`) do not update any of these.
- Fix approach: Read the version from `server/package.json` once (`createRequire(import.meta.url)('../package.json').version`) and export it from `server/src/config.ts`; bump `package.json` / plugin manifest in the release workflow.

**Stale and missing Codex setup pieces:**

- Issue: `server/src/mcp.ts` documents `pnpm codex:setup` ("writes the Codex config, links the skills") but no such script exists in any `package.json`. `codex/skills/derive-learn` and `codex/skills/derive-review` contain only `agents/openai.yaml`; there is no `SKILL.md` body, so the Codex skills carry no teaching instructions of their own and depend entirely on the MCP tool descriptions.
- Files: `server/src/mcp.ts` (header comment), `codex/skills/derive-learn/agents/openai.yaml`, `codex/skills/derive-review/agents/openai.yaml`, `package.json`
- Impact: A Codex user following the in-code instructions hits a missing script; the Codex terminal path gets a weaker method than the Claude plugin (which has the 166-line `teach` skill).
- Fix approach: Either add the `codex:setup` script or delete the comment; add `SKILL.md` files under `codex/skills/*` generated from the same source as `plugin/skills/teach/SKILL.md`.

**`teachingGap` waits 600 ms and re-reads the whole event log:**

- Issue: The teach-first gate in `server/src/index.ts` (`teachingGap`, `MIN_TEACHING_CHARS = 240`) scans every event of the lesson, and when it fails it sleeps 600 ms and scans again to give the Codex mirror time to post prose. This is a timing guess, not a synchronisation.
- Files: `server/src/index.ts` (`case 'quiz'`, `teachingGap`)
- Impact: On a slow machine or a long Codex message the gate still rejects a legitimate check; on a long lesson the double scan is O(events) per quiz call.
- Fix approach: Have the mirror endpoint bump a per-lesson "prose since node X" counter kept in memory (updated in `mirror` and `node_status`), and have the MCP server's `flushed()` (already called before `quiz`) be the only synchronisation point; drop the sleep.

**The Codex backend rebuilds its config and instructions file every turn:**

- Issue: `runCodexTurn` in `server/src/codex.ts` writes `instructions.md` and constructs a new `Codex` client with a full `mcp_servers=` TOML override on every turn, and spawns a fresh `server/dist/mcp.js` subprocess per turn (`mcpCommand()` in `server/src/backend.ts`).
- Files: `server/src/codex.ts`, `server/src/backend.ts`
- Impact: Extra process spawn and 60 s startup timeout per turn; the hand-rolled `toml()` serialiser will throw on `undefined` values and does not escape keys.
- Fix approach: Cache the `Codex` client per lesson and rewrite the instructions file only when the prompt inputs (material, library, profile) change.

**No linter or formatter configured:**

- Issue: `web/src` carries `// eslint-disable-next-line react-hooks/exhaustive-deps` comments (`web/src/lib/useVoiceMode.ts:140`, `web/src/components/AskCard.tsx:44`, `PlanCard.tsx:45`, `QuizCard.tsx:83`) but there is no ESLint or Prettier config anywhere in the repo, and CI (`.github/workflows/ci.yml`) runs only typecheck, build, test.
- Files: `.github/workflows/ci.yml`, `web/package.json`, `server/package.json`
- Impact: Style drifts silently; the hook-dependency suppressions hide real stale-closure bugs nobody checks.
- Fix approach: Add `eslint.config.js` with `typescript-eslint` and `eslint-plugin-react-hooks`, a Prettier config matching the existing 2-space / single-quote / 200-col style, and a `lint` step in CI.

## Known Bugs

**`replaceGraph` and `deleteLesson` are not transactional:**

- Symptoms: If the process dies between the `DELETE` and the `INSERT ... ON CONFLICT` loop in `replaceGraph` (`server/src/db.ts`), a lesson is left with a partial graph; `deleteLesson` runs seven separate `DELETE`s outside a transaction, so a crash leaves orphan events/nodes/quiz rows with no lesson row.
- Files: `server/src/db.ts` (`replaceGraph`, `deleteLesson`, `deleteLearner`)
- Trigger: Crash or `kill` during plan approval or lesson deletion.
- Workaround: None; orphan rows are invisible but never cleaned.
- Fix: Wrap in `db.exec('BEGIN')` / `COMMIT` (node:sqlite has no `transaction()` helper; a small `withTx(fn)` wrapper is enough). Also prepare the per-id `DELETE FROM nodes` statement once instead of `db.prepare` inside the loop.

**Pending cards and held cards vanish on restart:**

- Symptoms: After a server restart, a companion lesson's open card (`held` map in `server/src/index.ts`, `pending` map in `server/src/prompts.ts`, `notices` in `server/src/notices.ts`, `recentCards`) is gone. The browser still shows the card (its `quiz` event is persisted) but `POST /api/lessons/:id/answer` returns 409, and the `answer` action tells the model "the server may have restarted".
- Files: `server/src/prompts.ts`, `server/src/index.ts` (`held`, `recentCards`), `server/src/notices.ts`
- Trigger: Restart while a terminal-answered lesson has a card open.
- Workaround: The model is told to ask again; the learner sees a dead card.
- Fix: Persist open prompts (id, lesson, kind, payload, held) in a `prompts` table and rehydrate on boot, or at least emit a `prompt_cancelled` event on boot for every `quiz`/`ask`/`plan`/`explain` event without a matching result so the UI closes it.

**Restart-recovery loop reads every event of every lesson at boot:**

- Symptoms: `server/src/index.ts` top-level loop calls `listEvents(l.id)` for every lesson to find the last `turn_start`/`turn_end`. `busy()` does the same per request, and `GET /api/lessons` calls `busy()` and `listNodes()` for every lesson.
- Files: `server/src/index.ts` (boot loop, `busy`, `GET /api/lessons`)
- Trigger: Grows linearly with lesson history; a learner with a year of lessons pays a full-table JSON parse on every home-page load.
- Fix: Add a `lessons.last_turn` column (or `SELECT type FROM events WHERE lesson_id=? AND type IN (...) ORDER BY seq DESC LIMIT 1`) and a single aggregate query for node counts.

**`POST /api/lessons/:id/answer`, `/interrupt` do not check the lesson exists:**

- Symptoms: `answerPrompt` / `interrupt` on an unknown id return `{ ok: true }` or a 409 instead of 404.
- Files: `server/src/index.ts`
- Trigger: Stale tab after a lesson is deleted.
- Fix: Add the `getLesson(id)` guard used by the sibling routes.

**Learner lookup silently falls back to the default learner:**

- Symptoms: `learnerOf()` in `server/src/index.ts` maps any unknown `x-derive-learner` header, `?learner=` query or body `learner` to `DEFAULT_LEARNER_ID`. A typo in `DERIVE_LEARNER` or a deleted learner writes lessons, memory and resources into the first learner's profile without any signal.
- Files: `server/src/index.ts` (`learnerOf`), `server/src/mcp.ts` (`LEARNER`)
- Trigger: `DERIVE_LEARNER=Anna` when the learner is named `Ana`; deleting a learner while a tab still has it selected.
- Fix: Return 404 for an explicit unknown learner on write routes; keep the fallback only for the web app's stale selection on read routes (or clear `localStorage` in `web/src/lib/api.ts` on 404).

**`propagate` credit skips a dependency that is itself a warm-up copy of an unlocked source:**

- Symptoms: In `server/src/db.ts` `propagate`, a dependency whose `memory` (source node) is not `locked` is skipped, but the `seen` set already contains it, so nothing below it is reached at depth 2 either. Credit that should flow through a `shaky` intermediate to a locked root is lost.
- Files: `server/src/db.ts` (`propagate`)
- Trigger: Lock a node whose direct dependency is shaky but whose grand-dependency is locked.
- Fix: Continue the traversal (`next.push(d)`) before the `status !== 'locked'` check.

## Security Considerations

**No authentication, CORS `*`, and the server listens on all interfaces:**

- Risk: `app.use('/api/*', cors({ origin: '*' }))` in `server/src/index.ts` and `serve({ port })` (no `hostname`) expose every route, including the ones below, to any process or web page that can reach the port. On a laptop this is any tab open in the browser (a malicious page can `fetch('http://localhost:4310/api/materials/repo', ...)`); on a shared network it is anyone on the LAN.
- Files: `server/src/index.ts`, `server/src/config.ts`
- Current mitigation: None; the product assumes a single trusted user.
- Recommendations: Bind to `127.0.0.1` by default (`serve({ fetch, port, hostname: '127.0.0.1' })`); restrict CORS to `http://localhost:5173` and the same origin; add a per-install bearer token written to `~/.derive/token` that the web app, `plugin/.mcp.json` and `server/src/mcp.ts` send.

**Arbitrary local directory read via `/api/materials/repo`:**

- Risk: `POST /api/materials/repo` with `source: "/"` or `"~"` calls `collectRepo` → `fromDirectory` (`server/src/repo.ts`), which walks any readable directory (up to 1500 text files, 400 KB each) and stores it in SQLite where the model and `/api/materials/:id?text=1` can read it. With the CORS/no-auth issue above, any web page can exfiltrate `~/.ssh/config`, `~/.aws/credentials` (`.conf`/`.ini`-like files are in `TEXT_EXTS`; `.env.example` is, `.env` is not, but `credentials` has no extension and matches nothing, while `.ini`, `.cfg`, `.toml`, `.json`, `.yaml` all do).
- Files: `server/src/repo.ts` (`fromDirectory`, `TEXT_EXTS`), `server/src/index.ts` (`/api/materials/repo`)
- Current mitigation: `SKIP_DIRS` skips build folders only. `gitListFiles` respects `.gitignore` only when the folder is a git repo.
- Recommendations: Allow local paths only from the MCP server (which runs as the user in their terminal) by requiring the auth token above, or restrict to an allow-list root (`DERIVE_REPO_ROOTS`); add a deny-list for secret-shaped file names (`credentials`, `*.pem`, `*.key`, `id_*`, `.npmrc`, `.netrc`, `auth.json`, `.env*`).

**Server-side request forgery through library fetch and repo import:**

- Risk: `addResource` → `fetchResource` (`server/src/library.ts`) and `fromGitHub` / `fromGitClone` (`server/src/repo.ts`) fetch any `http(s)` URL the caller supplies, follow redirects, and store the body. Nothing blocks `http://127.0.0.1:...`, `http://169.254.169.254/` or RFC 1918 addresses, so the server can be used to read internal services and the result is readable via `/api/library/:id?text=1`. `git clone` additionally accepts `git@`/`ssh://` URLs and will use the user's SSH keys.
- Files: `server/src/library.ts` (`get`, `fetchPage`, `fetchVideo`), `server/src/repo.ts` (`fromGitHub`, `fromGitClone`, `isRepoUrl`)
- Current mitigation: `normalizeUrl` limits the scheme to http/https for the library; size caps (6 MB HTML, 25 MB PDF) and a 20 s timeout on the library fetch.
- Recommendations: Resolve the host and refuse loopback, link-local and private ranges before fetching (and re-check after each redirect, e.g. `redirect: 'manual'` loop); restrict `fromGitClone` to `https://`; the GitHub tarball fetch has no timeout and no size cap (`res.arrayBuffer()` of an arbitrary tarball, then `gunzipSync` in memory): add both.

**Regex-based SVG sanitiser and `securityLevel: 'loose'` in Mermaid:**

- Risk: Model output (and, via `read_resource`, text scraped from arbitrary web pages that the model may quote) is rendered with `dangerouslySetInnerHTML` after a regex strip in `web/src/components/Markdown.tsx` (`InlineSvg`) and `server/src/export.ts` (`inlineSvgFences`). The strip misses `xlink:href="javascript:"`, single-quoted `href='javascript:'`, `<foreignObject>` with HTML, `<use href="data:...">`, `<set attributeName="onload">`, and `<a>` targets. Mermaid is initialised with `securityLevel: 'loose'`, which enables `click` callbacks and HTML labels.
- Files: `web/src/components/Markdown.tsx`, `server/src/export.ts`, `web/src/components/Markdown.tsx` (`loadMermaid`)
- Current mitigation: Only ```` ```svg ```` fences are inlined; script tags and double-quoted `on*=` attributes are removed.
- Recommendations: Use DOMPurify with the SVG profile (`USE_PROFILES: { svg: true, svgFilters: true }`) in the web app; set Mermaid `securityLevel: 'strict'`; in the export, escape rather than inline, or run the same DOMPurify server-side (`isomorphic-dompurify`).

**Uploaded files are held whole in memory, twelve at a time:**

- Risk: `POST /api/materials` (`server/src/index.ts`) uses `c.req.parseBody({ all: true })`, which buffers the whole multipart body, then `Buffer.from(await f.arrayBuffer())` per file; `MAX_FILE_BYTES` (40 MB) is checked after the buffer exists. `unzipSync` for `.pptx`/`.docx` (`server/src/materials.ts`) decompresses without a ratio limit (zip bomb).
- Files: `server/src/index.ts`, `server/src/materials.ts` (`fromPptx`, `fromDocx`)
- Current mitigation: 12 files per request, 40 MB per file (post-buffer).
- Recommendations: Reject on `content-length` before parsing; cap total decompressed bytes from `unzipSync` by checking `zip[k].length` sums; process PDFs in a worker if `unpdf` proves slow on large decks.

**`.env` present at repo root:**

- Risk: `/home/jicanta/derive/.env` exists (gitignored). It is read by `pnpm dev`/`pnpm start` via `--env-file-if-exists`.
- Files: `.env` (contents not read), `.gitignore`
- Current mitigation: Listed in `.gitignore`; `.env.example` documents only non-secret settings.
- Recommendations: Nothing further; keep it out of the release tarball (the release workflow copies `.env.example` only, which is correct).

## Performance Bottlenecks

**Every quiz and status call re-lists the whole graph and quiz history:**

- Problem: `purposeOf`, `needsUnderstanding`, `nodeRecord`, `dependencyRecord`, `cumulativeStatus` and `libraryHint` in `server/src/actions.ts` each call `listNodes` / `quizzesOn` / `listEvents` / `listResources` independently, so one `node_status(locked)` runs a dozen queries plus `suggestedIds` (a full event scan) and `relatedResources` (full library scan with `metaScore`).
- Files: `server/src/actions.ts`, `server/src/db.ts`
- Cause: Convenience functions built on full-table reads; no per-call memoisation.
- Improvement path: Pass a loaded `{ nodes, quizzes }` snapshot into the helpers, or add targeted queries (`SELECT ... WHERE purpose='cumulative'`).

**`searchLibrary` loads every resource's full text:**

- Problem: `searchLibrary` in `server/src/library.ts` calls `getResource(row.id)` (full `text`, up to 400 k chars) for every entry and scans each with `indexOf` per term. A shelf of 200 papers means ~80 MB of string work per search.
- Files: `server/src/library.ts` (`searchLibrary`), `server/src/db.ts` (`resources` table)
- Cause: No full-text index.
- Improvement path: An `FTS5` virtual table over `resources.text` and `materials.text` (node:sqlite builds with FTS5); keep the current scorer as a fallback.

**SSE replay and the Obsidian mirror re-render whole lessons:**

- Problem: `GET /api/lessons/:id/stream` replays events after `?after=` with one `await send()` per event (fine), but `mirrorToVault` (`server/src/export.ts`) is called on every `emit` and `emitUpdate`, and after its 600 ms debounce it calls `renderMarkdown`, which re-reads and re-renders every event of the lesson. During streaming, `emitUpdate` fires at each block end and `checkpoint` every 1.5 s.
- Files: `server/src/events.ts`, `server/src/export.ts`
- Cause: Live mirror implemented as full rewrite.
- Improvement path: Raise the debounce to ~3 s while a turn is active and flush once on `turn_end`; render only once per turn unless the vault is configured.

**`GET /api/library` filters in JavaScript after loading the whole shelf, twice:**

- Problem: The route in `server/src/index.ts` calls `listResources(learner)` for the rows and again for `total`, plus `tagCounts` (a third full read).
- Files: `server/src/index.ts`, `server/src/library.ts`
- Improvement path: One read, derive `total` and tags from it.

## Fragile Areas

**The terminal reply parser (`parseReply`):**

- Files: `server/src/actions.ts` (`IDK_RE`, `QUIZ_PICK_RE`, `UNSURE_PREFIX_RE`, `UNSURE_NOTE_RE`, `YES_RE`, `parseReply`)
- Why fragile: Five hand-tuned bilingual regexes (English/Spanish) decide whether a learner's free text is a pick, an unsure pick, "don't know", or a message. The `ambiguous` heuristic ("a car is not a fruit" vs "B because") is a special case on top of a special case. Only 11 assertions cover it (`server/test/reply.test.ts`).
- Safe modification: Add a table-driven test case for every new phrase before touching a regex; keep `QUIZ_PICK_RE` composed from named fragments (already partly the case).
- Test coverage: No cases for multi-select with "?" suffix, numbers above option count, mixed "1 and B", or non-English "no sé" combined with a note.

**The card-holding state machine for terminal-answered lessons:**

- Files: `server/src/index.ts` (`held`, `holdCard`, `case 'answer'`, `case 'collect'`, `case 'end'`, `withoutCards`, `recentCards`), `server/src/prompts.ts`, `plugin/hooks/mirror.mjs`, `server/src/codex-mirror.ts`
- Why fragile: Four in-memory maps (`held`, `recentCards`, `pending`, `notices`) plus the plugin hook's per-session `seen` file and the Codex mirror's byte offset must agree on which card is open. `withoutCards` de-duplicates the model's verbatim card text by a flattened-string `includes`, which drops any legitimate prose paragraph that happens to be contained in a recent card. The Codex mirror locates the session log by grepping the last two days of `~/.codex/sessions` for the lesson id, then falls back to "the newest log since the server started" after 20 s, which can attach the wrong session.
- Safe modification: Change the `held` lifecycle only together with `plugin/hooks/mirror.mjs` (which reads `active.held`) and `server/test/api.test.ts` (which exercises open → answer). Add an explicit `prompt_id` in every card-related event payload and key `recentCards` by prompt id rather than by text.
- Test coverage: The api test covers the happy path (open card, `answer`). No test for: answering in the browser then `collect`, `answer` with a stale `prompt_id`, `end` with a held card, `withoutCards` filtering, restart mid-card.

**The FSRS propagation and review-copy forwarding:**

- Files: `server/src/db.ts` (`setNodeStatus`, `propagate`, `buildWarmup`, `buildReviewGraph`), `server/src/schedule.ts`
- Why fragile: A review copy (`source_lesson`, `source_node`) forwards every schedule write to its source with two separate `UPDATE`s and no transaction; `buildReviewGraph` assigns ids with a collision loop (`node-2`, `node-3`) that changes across runs, and the `topic` of a review lesson is derived from labels so it can exceed any sane length. `IMPLICIT_CREDIT` / `IMPLICIT_PENALTY` are magic arrays whose depth is also the loop bound.
- Safe modification: Add a unit test in `server/test/schedule.test.ts` style against an in-memory `DatabaseSync(':memory:')` before changing `propagate`; keep `DERIVE_DATA_DIR` pointed at a temp dir (see `server/test/reply.test.ts` for the import-order trick).
- Test coverage: `server/test/api.test.ts` covers credit to depth 1 and one penalty. No coverage for depth-2 credit, penalty across a review copy, `buildReviewGraph` interleaving, or `deps` resolution when a dependency was deleted from the source lesson.

**HTML-to-text extraction with regexes:**

- Files: `server/src/library.ts` (`htmlToText`, `dropElements`, `isFurniture`, `meta`, `metaAll`), `server/src/materials.ts` (`ooxmlParagraphs`)
- Why fragile: Tag pairing is done by regex with a manual depth counter; malformed HTML (unclosed `<div>`, `<p>` inside `<table>`) or attribute values containing `>` break the walk and can drop the whole article. `meta()` builds a `RegExp` from the caller-supplied name without escaping (names are constants today).
- Safe modification: Keep a fixture folder of saved pages and snapshot the extracted text; do not extend the regexes, swap to a real parser (`htmlparser2` or `linkedom`) behind the same `htmlToText` signature.
- Test coverage: None.

**Static file serving depends on `process.cwd()`:**

- Files: `server/src/index.ts` (bottom: `relRoot = distDir.startsWith(process.cwd()) ? ... : distDir`)
- Why fragile: `@hono/node-server`'s `serveStatic` takes a root relative to cwd; the code computes a relative path only when `web/dist` is under cwd, else passes an absolute path that `serveStatic` treats as relative. `pnpm start` from the repo root works; running `node server/dist/index.js` from elsewhere (the release tarball's documented layout, a systemd unit) serves no assets and the SPA fallback `readFileSync` throws per request.
- Safe modification: Use `serveStatic({ root: distDir })` only after `process.chdir` or implement the fallback with an explicit absolute-path handler; read `index.html` once at boot.
- Test coverage: None (the api test runs with `web/dist` absent).

## Scaling Limits

**Single-process, in-memory coordination:**

- Current capacity: One server process, one SQLite file (WAL), all lesson state and SSE subscribers in module-level `Map`s (`server/src/events.ts` `listeners`, `server/src/agent.ts` `active`/`stopping`, `server/src/prompts.ts` `pending`, `server/src/index.ts` `held`).
- Limit: Cannot run two server instances (e.g. one per learner on a shared box) against one database: turns and cards would be invisible across processes; `PRAGMA journal_mode = WAL` is set but `busy_timeout` is not, so a second writer gets `SQLITE_BUSY` immediately.
- Scaling path: Not needed for the single-user design; if ever shared, set `PRAGMA busy_timeout`, move `pending`/`held` to tables, and use SQLite's `data_version` or a notify table for cross-process fan-out.

**Event log growth per lesson:**

- Current capacity: `events` is keyed `(lesson_id, seq)` and `nextSeq` is `MAX(seq)+1` per insert; assistant blocks are rewritten in place. A long lesson is a few hundred rows; fine.
- Limit: `renderMarkdown`, `teachingGap`, `busy`, `suggestedIds` and the boot loop all read the full log; the `payload` column is JSON text with no size cap (a pasted 1.5 M-char material outline never goes there, but a long `explain_result` does).
- Scaling path: Add `(lesson_id, type, seq)` index and the targeted queries listed under Performance.

**Material and library text budgets:**

- Current capacity: 1.5 M chars per material (`server/src/materials.ts` `MAX_CHARS`), 400 k per resource (`server/src/library.ts`), 24 k inlined into the system prompt (`INLINE_CHARS`), 14 k per `read_*` call.
- Limit: `materialsSection` loads every material's full text (`getMaterial` per row) on every turn just to build the outline; a lesson with five 1.5 M-char repos parses 7.5 MB of text per turn.
- Scaling path: Store the outline (titles per segment) as a separate column at ingest and read only that for the prompt.

## Dependencies at Risk

**`@anthropic-ai/claude-agent-sdk` pinned to `latest`:**

- Risk: `server/package.json` declares `"@anthropic-ai/claude-agent-sdk": "latest"`. `pnpm install --frozen-lockfile` in CI uses the lockfile, but any local `pnpm install` without a lockfile update, or `pnpm up`, silently jumps major versions. The code depends on unstable surface: `SDKMessage` shapes, `stream_event` / `content_block_*` events, `options.effort`, `permissionMode: 'dontAsk'`, `settingSources`, `alwaysLoad` on `createSdkMcpServer` (`server/src/agent.ts`).
- Impact: A breaking SDK release breaks every app-mode lesson with no compile-time signal for runtime event shapes.
- Migration plan: Pin to a caret range (`^X.Y.Z`) matching `pnpm-lock.yaml`; add a smoke test that runs `query()` with a stub or at least type-asserts the events consumed.

**`@openai/codex-sdk` 0.154.0 with a vendored binary resolved by path guessing:**

- Risk: `codexBinary()` in `server/src/backend.ts` hard-codes the platform package layout (`@openai/codex-<os>-<arch>/vendor/<triple>/bin/codex`). `runCodexTurn` relies on `configOverrides` accepting a whole-table `mcp_servers=` TOML override and on `features: { plugins, hooks, multi_agent }` keys. `codex-mirror.ts` depends on the JSONL rollout format under `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` and on field names (`response_item`, `event_msg`, `task_complete`, `output_text`).
- Impact: Any Codex CLI layout or log-format change breaks Codex lessons and the terminal mirror silently (the mirror just never finds a file).
- Migration plan: Pin exactly (already 0.154.0) and add a startup check that logs when `codexBinary()` returns undefined; log once when the mirror falls back to "newest log".

**`node:sqlite` requires Node ≥ 22.5 and is still marked experimental:**

- Risk: `server/src/db.ts` uses `DatabaseSync`; `package.json` engines says `>=22.5`; `scripts/doctor.mjs` checks it. Node prints an `ExperimentalWarning` and the API (`throwIfNoEntry`-style options, `prepare().get` typing) has changed between 22.x minors.
- Impact: Users on Node 20 LTS cannot run Derive; a Node 24 API change would break startup.
- Migration plan: Keep the doctor check; wrap the import in one module (`db.ts` already does) so `better-sqlite3` could be swapped in.

**Web app: `mermaid` (~2 MB) and `katex` bundled for every page:**

- Risk: `web/vite.config.ts` raises `chunkSizeWarningLimit` to 2000 to silence the warning; `mermaid` is dynamically imported (`loadMermaid`) but `katex` CSS/JS and `@xyflow/react` are static.
- Impact: Slow first load on the companion page; not a correctness risk.
- Migration plan: Route-level code splitting in `web/src/main.tsx` (`React.lazy` for `Atlas`, `Library`).

## Missing Critical Features

**No request validation layer on the HTTP action route:**

- Problem: `POST /api/external/lessons/:id/:action` in `server/src/index.ts` casts the JSON body with `as` for every action (`a as { id: string; status: ... }`, `a as { fact: string }`, `a as { goal: string; nodes: GraphNodeInput[] }`), validating only `quiz`'s `purpose`/`tests`/`options`. `set_plan` with `nodes: "x"` throws inside `replaceGraph` (500), `node_status` with `status: "done"` writes an unknown status into `nodes.status`, `remember` with a missing `fact` stores `NULL` → SQLite constraint error. The MCP server validates with zod, but the route is reachable directly (see Security).
- Blocks: Safe reuse of the API by any driver other than `server/src/mcp.ts`; stable error codes for the test suite.
- Fix approach: Reuse the zod schemas from the shared tool module (see Tech Debt) with `schema.safeParse(a)` at the top of the switch, returning 400 with the zod message.

**No cleanup of `~/.derive/codex/<lesson>` and `~/.derive/mirror/<session>.json`:**

- Problem: `runCodexTurn` creates a folder per lesson (`server/src/codex.ts`) and `plugin/hooks/mirror.mjs` a JSON file per Claude Code session; `deleteLesson` removes neither. `sweepOrphanMaterials` handles only unbound uploads.
- Blocks: Nothing today; disk grows unbounded with lesson count.
- Fix approach: `rmSync` the codex folder in `DELETE /api/lessons/:id`; prune mirror state files older than 30 days in the boot sweep.

**No graceful shutdown:**

- Problem: `serve()` in `server/src/index.ts` has no `SIGINT`/`SIGTERM` handler; in-flight turns are killed and rely on the boot-time "server restarted" `turn_end` patch. The `mirrorTimers` debounce in `server/src/export.ts` can lose the last vault write.
- Fix approach: On signal, `await interrupt()` for every active lesson, flush `mirrorTimers`, `db.close()`, then exit.

## Test Coverage Gaps

**Web app has zero tests:**

- What's not tested: `web/src/lib/useLesson.ts` reducer (`applyEvent`: delta merging, partial-block replacement, `turn_end` with `held`), `web/src/lib/voice.ts` / `useVoiceMode.ts`, `QuizCard` multi-select and confidence flow, SSE reconnect with `?after=`.
- Files: `web/src/lib/useLesson.ts`, `web/src/components/QuizCard.tsx`, `web/src/lib/voice.ts`, `web/src/lib/useVoiceMode.ts`
- Risk: The reducer is the single place where the persisted event log becomes UI state; a regression (e.g. an `assistant` event with `partial` shrinking text) would only be caught by eye.
- Priority: High. `applyEvent` is a pure function and can be tested with `node --test` without a DOM.

**Material and library ingestion:**

- What's not tested: `partsOf`, `fromPptx`, `fromDocx`, `extractSegments`, `ingestRepo` / `collectRepo` (local dir ordering, `untar`, GitHub subdir handling), `htmlToText`, `normalizeUrl`, `detectKind`, `fetchResource` (needs a local HTTP fixture), `searchMaterial` / `searchLibrary` ranking, `readMaterial` with `path`.
- Files: `server/src/materials.ts`, `server/src/repo.ts`, `server/src/library.ts`
- Risk: These are ~1300 lines of regex and binary parsing with no assertions; a change to `SEP` handling or `partsOf` thresholds silently changes what the tutor reads.
- Priority: High for `partsOf`, `normalizeUrl`, `htmlToText`, `untar`; Medium for the rest.

**HTTP routes outside the external action path:**

- What's not tested: Every `/api/lessons*`, `/api/learners*`, `/api/library*`, `/api/materials*`, `/api/review`, `/api/atlas`, `/api/preferences`, the SSE stream, `/api/lessons/:id/export`. `server/test/api.test.ts` uses only `/api/external/lessons`, `/api/lessons/:id` (GET) and the action route.
- Files: `server/src/index.ts`
- Risk: Learner deletion cascades, library dedup-by-URL, `PATCH /api/learners/:id` prefs cleaning (`cleanPrefs`), and the 404/409 contracts can regress unnoticed.
- Priority: Medium. The existing spawn-the-built-server harness in `server/test/api.test.ts` makes these cheap to add.

**Backend drivers (`agent.ts`, `codex.ts`, `codex-mirror.ts`, `mcp.ts`, `plugin/hooks/mirror.mjs`):**

- What's not tested: Event translation from SDK messages to `emit`/`emitUpdate`/`checkpoint`, interrupt handling, `friendly()` error rewriting, `RolloutMirror.locate`/`handle` on a fixture JSONL, `cleanUser` in both mirrors, `withoutCards`, `sortSources` in `mcp.ts`.
- Files: `server/src/agent.ts`, `server/src/codex.ts`, `server/src/codex-mirror.ts`, `server/src/mcp.ts`, `plugin/hooks/mirror.mjs`
- Risk: These are the pieces most coupled to external formats (SDK stream events, Codex rollout JSONL, Claude Code transcript JSONL) and the ones most likely to break on an upstream release, with no signal until a lesson is run by hand.
- Priority: High for `RolloutMirror.handle` and `mirror.mjs` parsing (pure functions over JSONL lines; capture one real transcript as a fixture); Medium for `agent.ts` (needs a fake `query()`).

**Export and vault mirror:**

- What's not tested: `renderMarkdown` (`server/src/export.ts`) for every event type, `inlineSvgFences`, `vaultDirFor` name sanitising, the debounce in `mirrorToVault`.
- Files: `server/src/export.ts`
- Risk: Obsidian notes are the learner's durable record; a broken callout or unbalanced fence corrupts every note silently.
- Priority: Medium. Snapshot a rendered lesson from the api test's database.

**CI runs the doctor script with `|| true`:**

- What's not tested: `scripts/doctor.mjs` failures are ignored in `.github/workflows/ci.yml` (it necessarily fails on Claude login in CI), so a syntax error in the script passes CI.
- Files: `.github/workflows/ci.yml`, `scripts/doctor.mjs`
- Priority: Low. Run `node --check scripts/doctor.mjs` instead.

---

*Concerns audit: 2026-09-17*
