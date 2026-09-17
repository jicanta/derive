---
last_mapped_commit: 7d7db1f8c9352186f02b02ddb34172e66fef5eb5
last_mapped_at: 2026-09-17
---
# Coding Conventions

**Analysis Date:** 2026-09-17

## Naming Patterns

**Files:**

- Server modules: lowercase, one word where possible, kebab-case when two: `server/src/db.ts`, `server/src/schedule.ts`, `server/src/codex-mirror.ts`. Each file is a topic (the database, the scheduler, the prompts), not a layer.
- Web components: PascalCase `.tsx`, one exported component per file, file name equals component name: `web/src/components/QuizCard.tsx` exports `QuizCard`.
- Web pages: PascalCase `.tsx` in `web/src/pages/`, exported as `XxxPage` (`web/src/pages/Home.tsx` exports `HomePage`).
- Web hooks and helpers: camelCase `.ts` in `web/src/lib/`; hooks are `useXxx.ts` (`web/src/lib/useLesson.ts`, `web/src/lib/useMaterials.ts`, `web/src/lib/useVoiceMode.ts`).
- Tests: `server/test/<module>.test.ts`, named after the module or feature under test (`schedule.test.ts`, `reply.test.ts`, `api.test.ts`).
- Standalone scripts: `.mjs` with a `#!/usr/bin/env node` shebang (`scripts/doctor.mjs`, `plugin/hooks/mirror.mjs`).

**Functions:**

- camelCase, verb-first, short: `getLesson`, `listNodes`, `replaceGraph`, `setNodeStatus`, `emit`, `subscribe`, `parseReply`.
- Database accessors in `server/src/db.ts` follow a fixed verb vocabulary: `create*`, `get*`, `find*`, `list*`, `update*`, `set*`, `delete*`, `rename*`, `sweep*`.
- Predicates read as booleans: `isBusy`, `hasPending`, `hasUnderstandingPass`, `claudeLoggedIn`, `codexLoggedIn`, `isKind`.
- "Of" helpers compute something for one input: `learnerOf(c)`, `purposeOf(lessonId, nodeId)`, `cardOf(node, now)`, `tagsOf`, `segmentsOf`.
- When importing a name that would collide, alias with a short suffix: `import { readMaterial as readMat, searchMaterial as searchMat } from './materials.js'` (`server/src/actions.ts`).
- Small helpers are `const` arrow functions; anything with a doc comment and more than a few lines is a `function` declaration.

**Variables:**

- camelCase for locals and parameters; snake_case is reserved for fields that mirror the SQLite schema or the wire format (`node_id`, `review_at`, `depends_on`, `learner_id`, `answer_in`). Do not rename those to camelCase when passing through; `rowsToNodes` in `web/src/lib/useLesson.ts` is the one place a row is reshaped.
- Module-level constants are UPPER_SNAKE: `PORT`, `DATA_DIR`, `DB_PATH`, `DEFAULT_LEARNER_ID`, `DERIVE_TOOL_NAMES`, `TOOL_LABELS`, `QUIZ_PURPOSES`, `MATERIAL_ACCEPT`, `LEARNER_KEY`. A shared time constant is `const DAY = 86_400_000;` (used in `server/src/schedule.ts` and the tests).
- Single-letter names are fine in tight scopes: `c` for a Hono `Context`, `e` for a caught error or DOM event, `l` for a lesson/learner in a loop, `r` for a response, `n` for a node.

**Types:**

- PascalCase `type` aliases; interfaces are not used. Union-of-string-literal types for enums: `type NodeKind = 'truth' | 'derived' | 'goal'`, `type Backend = 'claude' | 'codex'`, `type Grade = 'again' | 'hard' | 'good'`.
- Rows from SQLite are `XxxRow` (`NodeRow`, `MaterialRow`, `StoredEvent`); tool argument shapes are `XxxArgs` (`QuizArgs`); event payloads on the web are `XxxPayload` (`AskPayload`, `QuizResultPayload`).
- Types are exported alongside functions with inline `type` modifiers: `import { appendEvent, type StoredEvent } from './db.js'`.
- Runtime lists that double as types use `as const` and `typeof`: `DERIVE_TOOL_NAMES` in `server/src/tools.ts`, `RESOURCE_KINDS` in `server/src/library.ts`, `QUIZ_TESTS` in `server/src/db.ts`.

## Code Style

**Formatting:**

- No Prettier, ESLint, Biome or `.editorconfig` in the repo. Formatting is by hand and consistent; match the surrounding file.
- Single quotes everywhere (zero double-quoted strings in `web/src/lib/api.ts`); semicolons always; trailing commas in multi-line literals and argument lists; 2-space indent.
- Long lines are accepted. Nearly 500 lines exceed 140 columns; a single-statement route handler or a `assert.deepEqual` call stays on one line rather than wrapping. Do not reflow existing lines to a narrower width.
- Prefer the ternary chain over `if/else` for value selection: `const state = i < idx ? 'done' : i === idx ? 'active' : 'todo';` (`web/src/components/PhaseBar.tsx`).
- Single-statement `if` bodies stay on the same line without braces: `if (!lesson) return c.json({ error: 'lesson not found' }, 404);`.
- `for (const x of xs)` over `forEach` in server code; array methods (`map`, `filter`, `some`) for expressions.
- Nullish coalescing and optional chaining are the default: `process.env.PORT ?? 4310`, `listeners.get(lessonId) ?? []`, `lesson?.mode`.
- Numeric literals with underscores for readability: `86_400_000`, `20_000`.

**Linting:**

- TypeScript `strict: true` in both `server/tsconfig.json` and `web/tsconfig.app.json` is the only enforced check (`pnpm typecheck` runs in CI, `.github/workflows/ci.yml`).
- Web additionally sets `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `isolatedModules` (`web/tsconfig.app.json`). Unused imports fail the build.
- Four `// eslint-disable-next-line react-hooks/exhaustive-deps` comments exist in `web/src/components/{AskCard,PlanCard,QuizCard}.tsx` and `web/src/lib/useVoiceMode.ts` even though ESLint is not installed; they mark keydown effects that intentionally omit `send` from deps. Keep the comment when copying that pattern.
- No `@ts-ignore` or `@ts-expect-error` anywhere. Narrow with type guards (`(f): f is File => f instanceof File`) or a targeted `as` cast instead.

## Import Organization

**Order:**

1. `node:` builtins, alphabetical by module (`node:crypto`, `node:fs`, `node:path`, `node:url`).
2. Third-party packages (`@hono/node-server`, `hono`, `ts-fsrs`, `zod`, `react`).
3. Local modules, relative, alphabetical by path (`./actions.js`, `./agent.js`, `./backend.js`, `./config.js`, `./db.js` ...).
4. Named imports inside a brace are alphabetical, with `type` imports mixed in at their alphabetical position (`import { Hono, type Context } from 'hono'`).

**Path Aliases:**

- None. Relative paths only.
- Server (`module: NodeNext`) imports local files with the `.js` extension even though the source is `.ts`: `import { emit } from './events.js'`. Tests import source the same way: `from '../src/schedule.js'`.
- Web (`moduleResolution: bundler`) imports without an extension: `import { api } from './api'`, `import type { Material } from '../lib/types'`.
- A web file that only needs types uses `import type { ... }` as a whole statement (`web/src/lib/api.ts` line 1).

## Error Handling

**Patterns:**

- Throw plain `Error` with a lowercase, human-readable message that can be shown to the learner or the model as-is: `throw new Error('learner not found')`, `throw new Error('the first learner cannot be removed; rename it instead')` (`server/src/db.ts`), `throw new Error('No active lesson. Call start_lesson first.')` (`server/src/mcp.ts`). No custom error classes, no error codes.
- HTTP routes in `server/src/index.ts` translate a thrown error into `{ error: message }` with a 4xx status:
  ```ts
  try {
    return c.json(createLearner(String(body.name ?? '')), 201);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
  ```
  Validation failures return early with the same shape: `return c.json({ error: 'lesson not found' }, 404)`. A refusal the model should act on adds `refused: true` beside `error` (see the `node_status` lock gate; asserted in `server/test/api.test.ts`).
- Always narrow the caught value with `e instanceof Error ? e.message : String(e)`; never assume `e` is an `Error` on the server. On the web, `(e as Error).message` is accepted inside hooks (`web/src/lib/useMaterials.ts`).
- Fire-and-forget promises are marked `void` and given a logging catch: `void runTurn(id, text).catch((e) => console.error('[turn]', e));`.
- Best-effort operations swallow with an empty catch that carries a one-word comment saying why: `catch { /* not installed */ }` (`server/src/backend.ts`), `catch { /* private mode */ }` (`web/src/lib/api.ts`), `catch { /* not up yet */ }` (`server/test/api.test.ts`). Use `.catch(() => undefined)` or `.catch(() => null)` for the promise form.
- The web API client (`web/src/lib/api.ts`, function `j<T>`) turns a non-OK response into a thrown `Error` whose message is the server's `error` field, so components only need `try { await api.x() } catch (e) { setError(...) }`.
- Component state carries errors as `error: string | null` (`LessonState` in `web/src/lib/useLesson.ts`, `useMaterials`), never as an `Error` object.

## Logging

**Framework:** `console` only. No logging library.

**Patterns:**

- The server logs almost nothing. Two startup lines in `server/src/index.ts` (`derive server on http://localhost:...`, `tutor runs on ...`) and error lines with a bracketed subsystem tag: `console.error('[turn]', e)`, `console.error('[vault]', ...)`, `console.warn('[codex] ...')`.
- When adding a log line, prefix it with a `[tag]` naming the subsystem and log only failures or startup facts. Do not log per-request.
- Everything the learner or the model should see goes through the event stream (`emit` in `server/src/events.ts`) or the tool result, not the console.
- `scripts/doctor.mjs` is the exception: it is a report and prints with `console.log` through `ok/warn/fail` collectors.
- The web has no console output outside error boundaries; surface problems in state (`error` fields) and render them.

## Comments

**When to Comment:**

- Every server module opens with a `/** ... */` block explaining what the module is for and, where relevant, the design reasoning (see `server/src/actions.ts`, `server/src/schedule.ts`, `server/src/backend.ts`, `server/src/mcp.ts`, `server/src/notices.ts`). Write these as prose paragraphs, not bullet lists.
- Inline `//` comments explain a non-obvious *why*, usually in one sentence and in plain English: `// pnpm keeps @openai/codex under the SDK's own node_modules, so resolve it from there.` They never restate what the code does.
- Comments reference the learning-science reasoning when it drives a decision (FSRS discounting early reviews, Skycak's implicit repetition) so a future change does not undo it by accident.
- Section separators in long route files: `// ---------- learners ----------` (`server/src/index.ts`).
- No TODO/FIXME markers are in use; unfinished work is not left in comments.

**JSDoc/TSDoc:**

- One-line `/** ... */` on most exported functions, constants and type fields, written as a sentence fragment describing the value or the effect: `/** Persist an event for a lesson and fan it out to live subscribers. */`, `/** Optional Obsidian vault folder to export lessons into. */`.
- No `@param`/`@returns` tags. Parameter meaning goes into the sentence or into the type.
- Type fields get the same one-liners where the name alone is ambiguous: `/** Companion lessons: where cards are answered. */ answer_in: 'browser' | 'terminal';` (`web/src/lib/types.ts`).
- Zod schemas for MCP tools carry `.describe('...')` on every field; those strings are the model-facing documentation (`server/src/mcp.ts`).

## Function Design

**Size:** Small and single-purpose on the server side; helper `const` arrows of 1 to 5 lines are common (`withNotice`, `sameSet`, `learnerOf`, `busy`, `lessonView`). Route handlers in `server/src/index.ts` may run 30 to 60 lines because they inline validation. React pages (`web/src/pages/Lesson.tsx`, `Home.tsx`, `Library.tsx`) are large single components with local helpers; components in `web/src/components/` are under 250 lines.

**Parameters:**

- Positional for one to three arguments; an options object for anything optional (`runTurn(id, text, { echoUser: text })`, `schedule(node, 'good', now)`).
- Time is passed in as `now: number` (ms since epoch) with a `Date.now()` default so callers and tests can pin it: `schedule(node, grade, now = Date.now())` in `server/src/schedule.ts`.
- React components take a single destructured props object typed inline, not a separate `Props` type:
  ```ts
  export function AskCard({ ask, answer, onAnswer, disabled }: { ask: AskPayload; answer?: string; onAnswer: (text: string) => Promise<unknown>; disabled?: boolean }) {
  ```
- Accept the narrowest type that works: `cardOf(node: Pick<NodeRow, 'stability' | 'difficulty' | ...>)`.

**Return Values:**

- Return plain object literals; the result of a tutor action is what the model is told, and often includes an `instruction` string the model should follow next (`server/src/actions.ts`).
- `null` for "not found" on lookups (`getLesson(id)` returns `undefined`, `lessonView` returns `null`); `undefined` for "not configured" (`MODEL`, `VAULT_DIR`, `codexBinary()`).
- Scheduler functions return the delta to spread onto the row (`Scheduled`), and `null` when nothing applies (`implicitRepetition(fresh, 0.5) === null`).
- Subscribe-style functions return their own unsubscribe: `subscribe(lessonId, l): () => void` (`server/src/events.ts`); effects in React return the cleanup from `useEffect`.

## Module Design

**Exports:**

- Named exports only. `export default` appears nowhere in `server/src` or `web/src` (the only default is `vite.config.ts`'s `defineConfig`).
- Modules export a flat set of functions and constants; `server/src/db.ts` exports 82 names, `server/src/actions.ts` 25. No classes except `RolloutMirror` in `server/src/codex-mirror.ts`, which wraps a long-lived watcher.
- Module-level state is allowed when it is the module's purpose and is documented: `notices` Map in `server/src/notices.ts`, `listeners` in `server/src/events.ts`, `resolved` backend cache in `server/src/backend.ts`, the `db` handle in `server/src/db.ts`.
- Side effects on import are real and deliberate: `server/src/db.ts` opens the SQLite file and runs `CREATE TABLE IF NOT EXISTS` at import time; `server/src/index.ts` closes stale turns on boot. Tests that touch `actions.ts` set `DERIVE_DATA_DIR` before a dynamic `await import(...)` for this reason (`server/test/reply.test.ts`).
- Configuration is read from `process.env` exactly once, in `server/src/config.ts`, and exported as constants. Other modules import those constants; they do not read `process.env` themselves (exception: the standalone `server/src/mcp.ts`, which runs as its own process).
- On the web, `web/src/lib/api.ts` exports a single `api` object whose keys are the endpoints; add a new endpoint as a new key there rather than calling `fetch` in a component.
- Shared web types live in `web/src/lib/types.ts` and mirror the server's row and payload shapes by hand; there is no generated client.

**Barrel Files:**

- None. Import from the concrete module (`'./db.js'`, `'../lib/types'`), never from an `index.ts`.
- `server/src/index.ts` is the HTTP entry point, not a barrel; `web/src/main.tsx` is the React entry point.

---

*Convention analysis: 2026-09-17*
