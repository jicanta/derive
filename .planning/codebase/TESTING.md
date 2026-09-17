---
last_mapped_commit: 7d7db1f8c9352186f02b02ddb34172e66fef5eb5
last_mapped_at: 2026-09-17
---
# Testing Patterns

**Analysis Date:** 2026-09-17

## Test Framework

**Runner:**

- Node's built-in test runner (`node:test`), Node 22.5+ (`engines.node >= 22.5` in `package.json`). No Jest, Vitest or Mocha.
- Config: none. The runner is invoked from `server/package.json`: `"test": "node --import tsx --test test/*.test.ts"`. `tsx` (devDependency) transpiles TypeScript on the fly; there is no separate test tsconfig.
- The root script `pnpm test` (`package.json`) runs `pnpm --filter server test`. Only the `server` package has tests; `web`, `plugin`, `codex` and `scripts` have none.

**Assertion Library:**

- `node:assert/strict` imported as `assert`. Used: `assert.equal`, `assert.deepEqual`, `assert.ok`, `assert.match`, `assert.doesNotMatch`.

**Run Commands:**

```bash
pnpm test                                   # all server tests (from repo root)
pnpm --filter server test                   # same, explicit
cd server && node --import tsx --test test/schedule.test.ts   # one file
cd server && node --import tsx --test --test-name-pattern="lapse" test/*.test.ts   # by name
cd server && node --import tsx --test --watch test/*.test.ts   # watch mode (node:test flag; no script alias)
pnpm build && pnpm test                     # required order: api.test.ts runs server/dist/index.js
pnpm typecheck                              # tsc --noEmit in both packages; the type check is part of the test gate in CI
```

## Test File Organization

**Location:**

- Separate directory: `server/test/`, beside `server/src/`. No co-located `*.test.ts` in `src`.
- `server/tsconfig.json` includes only `src`, so test files are not part of `pnpm typecheck` or the build; type errors in tests surface only when the test runs through `tsx`.

**Naming:**

- `<subject>.test.ts`: `schedule.test.ts` (unit, pure functions), `reply.test.ts` (unit, one parser that needs the DB), `api.test.ts` (end to end over HTTP).

**Structure:**

```
server/
├── src/            # implementation
│   ├── schedule.ts
│   ├── actions.ts
│   └── index.ts
├── test/
│   ├── schedule.test.ts   # pure FSRS scheduling: grade, schedule, implicitRepetition, retrievability
│   ├── reply.test.ts      # parseReply for quiz and plan cards
│   └── api.test.ts        # spawns dist/index.js, drives a full lesson through /api/external/*
└── dist/           # built by `pnpm build`; api.test.ts asserts dist/index.js exists
```

## Test Structure

**Suite Organization:**

```ts
// server/test/schedule.test.ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { grade, implicitLapse, implicitRepetition, retrievability, schedule } from '../src/schedule.js';

const DAY = 86_400_000;
const fresh = { stability: null, difficulty: null, reps: 0, lapses: 0, last_review: null, review_at: null, interval_days: 1 };

describe('schedule', () => {
  it('gives a confident pass a longer first interval than an unsure one', () => {
    const now = Date.now();
    const good = schedule(fresh, 'good', now);
    const hard = schedule(fresh, 'hard', now);
    assert.ok(good.interval_days >= hard.interval_days, `${good.interval_days} >= ${hard.interval_days}`);
    assert.ok(good.review_at >= now + DAY, 'never due before tomorrow');
  });
});
```

**Patterns:**

- `describe` names the function or the scenario in plain words (`'parseReply for a quiz card'`, `'a lesson, end to end'`, `'the next lesson'`); `it` names are full sentences describing the behaviour, not the implementation (`'will not lock a derived node on procedure alone'`).
- Setup: module-level fixtures (`fresh`, `DAY`) and small local factories (`const locked = (now) => ({ ...fresh, ...schedule(fresh, 'good', now) })`). `before`/`after` from `node:test` are used only in `api.test.ts` to spawn and kill the server.
- Teardown: `after(() => { server?.kill(); rmSync(dataDir, { recursive: true, force: true }); })`.
- Assertions: every `assert.ok` carries a message that reads as the claim being made (`'stability drops'`, `'the older, more forgotten node comes first'`). For HTTP results the message is `JSON.stringify(opened.json)` so a failure prints the server's error.
- Time is injected: every scheduler call receives an explicit `now`; tests advance it by `n * DAY` rather than mocking `Date`.
- Test order matters inside `api.test.ts`: `it` blocks share `let lesson = ''` and build on each other (create lesson, approve plan, teach, lock, cumulative quiz, then the next lesson's warm-up). Add new steps at the point in the sequence where the state they need exists; do not reorder existing `it`s.
- Comments inside tests explain the learning-science reason for a setup step (why a dependency is aged three weeks before an implicit review is expected to credit it).

## Mocking

**Framework:** None. `node:test`'s `mock` is not used, and there are no stubs of internal modules.

**Patterns:**

```ts
// server/test/reply.test.ts — isolate a module that opens SQLite on import
process.env.DERIVE_DATA_DIR = mkdtempSync(join(tmpdir(), 'derive-test-'));
const { parseReply } = await import('../src/actions.js');
```

```ts
// server/test/api.test.ts — real server, scratch data dir, random port, no model
server = spawn(process.execPath, [entry], {
  env: { ...process.env, PORT: String(port), DERIVE_DATA_DIR: dataDir, DERIVE_BACKEND: 'claude' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
// poll /api/health for up to 20 s, 200 ms apart
```

```ts
// server/test/api.test.ts — reach into the DB to fake the passage of time
const db = new DatabaseSync(join(dataDir, 'derive.db'));
db.prepare('UPDATE nodes SET last_review = ?, review_at = ? WHERE lesson_id = ? AND node_id = ?').run(Date.now() - 21 * DAY, Date.now() - DAY, lesson, 'slope');
db.close();
```

**What to Mock:**

- Nothing, by design. Substitute the environment instead: `DERIVE_DATA_DIR` for a scratch SQLite file, `PORT` for a free port, `DERIVE_BACKEND` to pin the backend.
- The model is kept out by using the *external lesson* path (`POST /api/external/lessons` with `answer_in: 'terminal'`): those endpoints never call the Claude or Codex SDK, and terminal-answered cards resolve at once through `/answer`. Everything the tutor would do is done by the test posting `set_plan`, `node_status`, `mirror` (prose), `quiz` and `answer`. Use this path for any new mechanic test; do not spawn a model.
- Clock changes go through direct SQL on the scratch DB (`node:sqlite` `DatabaseSync`), not through a fake timer.

**What NOT to Mock:**

- The database: `server/src/db.ts` runs against a real `node:sqlite` file in a temp dir.
- HTTP: `api.test.ts` uses global `fetch` against the spawned process.
- `ts-fsrs`: scheduling tests run the real algorithm with `enable_fuzz: false` (set in `server/src/schedule.ts`) so results are deterministic.

## Fixtures and Factories

**Test Data:**

```ts
// server/test/api.test.ts — a quiz card factory with overrides
const quiz = (node_id: string, extra: Record<string, unknown> = {}) => ({
  question: `About ${node_id}?`,
  options: ['the right claim', 'a tempting wrong claim'],
  correct: [0],
  explanation: 'because',
  node_id,
  purpose: 'check',
  ...extra,
});
// helpers that wrap the API
const act = (lesson, action, body) => api(`/api/external/lessons/${lesson}/${action}`, body);
const askAndAnswer = async (lesson, quiz, reply) => { /* open card, assert pending, post reply, return graded result */ };
const teachProse = (lesson, node) => act(lesson, 'mirror', { role: 'assistant', text: `Teaching ${node}. `.repeat(30), uid: `${node}-prose` });
const nodes = async (lesson) => new Map((await api(`/api/lessons/${lesson}`)).json.nodes.map((n) => [n.node_id, n]));
```

- `teachProse` exists because the server refuses a teach-phase `quiz` until at least 240 characters of prose have been mirrored since the node was marked `teaching` (`teachingGap` in `server/src/index.ts`); any new lesson-flow test must call it (or pass `already_held: true`) before a check.
- Graphs are three-node minimal chains (`truth -> derived -> goal`) with `depends_on`; reuse that shape.

**Location:**

- Inline at the top of each test file. No `fixtures/` directory, no JSON fixture files, no shared test helper module. If a helper is needed by a second file, create `server/test/helpers.ts` and import it with the `.js` suffix.

## Coverage

**Requirements:** None enforced. No coverage threshold, no coverage upload in CI.

**View Coverage:**

```bash
cd server && node --import tsx --test --experimental-test-coverage test/*.test.ts
```

Coverage today, by module (from reading the tests, not a tool):

- Covered: `server/src/schedule.ts` (all exports), `parseReply` in `server/src/actions.ts`, the external-lesson routes in `server/src/index.ts` (`/api/external/lessons`, `set_plan`, `set_phase`, `node_status`, `quiz`, `answer`, `mirror`), warm-up building (`buildWarmup` in `server/src/db.ts`), implicit repetition and the cumulative quiz gate.
- Not covered: `server/src/agent.ts`, `server/src/codex.ts`, `server/src/codex-mirror.ts`, `server/src/mcp.ts`, `server/src/materials.ts`, `server/src/repo.ts`, `server/src/library.ts`, `server/src/export.ts`, `server/src/prompt.ts`, learners CRUD, the browser-answered (`answer_in: 'browser'`) path, SSE streaming, and all of `web/src`.

## Test Types

**Unit Tests:**

- `server/test/schedule.test.ts`: pure functions with injected time; checks ordering relations (`good >= hard`, `stability drops`) rather than exact FSRS numbers, so parameter tweaks do not break them.
- `server/test/reply.test.ts`: table-style `assert.deepEqual` on a parser's output for many inputs, grouped by card kind.

**Integration Tests:**

- `server/test/api.test.ts`: black-box, over HTTP, against the built server in a child process with a scratch SQLite. One `describe` walks a whole lesson; a nested `describe('the next lesson')` covers the warm-up on the forgetting curve. This is the place for learning-mechanics tests (warm-up, understanding gate, cumulative quiz, implicit repetition) because those live server-side.
- Prerequisite: `pnpm build` (the test asserts `server/dist/index.js` exists with the message `build first`).

**E2E Tests:**

- Not automated. Manual end-to-end runs (browser lessons, plugin lessons via `claude --plugin-dir ./plugin -p "/derive:learn ..."`, headless Chrome captures, a 72-check Python API run) are described in the user's memory notes, not in the repo. `scripts/doctor.mjs` (`pnpm check`) is a read-only environment check, not a test.

**CI:**

- `.github/workflows/ci.yml` on push to `main` and on pull requests: `pnpm install --frozen-lockfile` -> `pnpm typecheck` -> `pnpm build` -> `pnpm test` (with `CI=true`) -> `node scripts/doctor.mjs || true`. Node 22, pnpm from `packageManager`, 15-minute timeout, concurrency cancels superseded runs.
- `.github/workflows/release.yml` on `v*` tags repeats typecheck, build and test before packing tarballs.
- Web has no test step; `pnpm build` (`tsc -b && vite build`) is its only gate.

## Common Patterns

**Async Testing:**

```ts
// Plain async `it`; no done callbacks. Await each API call, assert on status first with the body in the message.
it('starts a terminal-answered lesson with no warm-up on a fresh learner', async () => {
  const r = await api<{ id: string; warmup?: string }>('/api/external/lessons', { topic: 'why gradient descent works', answer_in: 'terminal' });
  assert.equal(r.status, 201);
  assert.equal(r.json.warmup, undefined);
  lesson = r.json.id;
});
```

```ts
// Readiness polling instead of fixed sleeps
const deadline = Date.now() + 20_000;
while (Date.now() < deadline) {
  try { const r = await fetch(`${base}/api/health`); if (r.ok) return; } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 200));
}
throw new Error('server did not start');
```

**Error Testing:**

```ts
// Errors are HTTP 400 with { error, refused? }; match on the message text the model would read.
const early = await act(lesson, 'quiz', quiz('slope', { tests: 'procedure' }));
assert.equal(early.status, 400);
assert.match(String(early.json.error), /Teach first/);

const refused = await act(lesson, 'node_status', { id: 'step', status: 'locked' });
assert.equal(refused.status, 400);
assert.equal(refused.json.refused, true);
assert.match(String(refused.json.error), /intuition|transfer/);
```

- For thrown errors in unit code, use `assert.throws(() => fn(), /message/)`; no existing example, but the same regex-on-message style applies.
- Instruction strings returned to the model are asserted with `assert.match` on a distinctive phrase (`/cumulative quiz/`, `/shaky/`, `/\[goal\]/`) rather than full equality, so prompt wording can change without breaking tests.

**Adding a test:**

1. Pure logic (scheduling, parsing, ordering): new `server/test/<module>.test.ts`, import from `../src/<module>.js`, inject `now`.
2. Anything that imports `db.ts` or `actions.ts` transitively: set `process.env.DERIVE_DATA_DIR` to a `mkdtempSync` dir *before* a dynamic `await import`.
3. A learning mechanic or a route: add an `it` to the sequence in `server/test/api.test.ts` (or a new `describe` with its own `before` that spawns a server on another random port in `4400..4899`), drive it through `/api/external/lessons/:id/*`, and run `pnpm build` first.
4. Web code has no runner; if one is added, `vitest` with `@vitejs/plugin-react` fits the existing Vite setup (`web/vite.config.ts`), and `web/tsconfig.app.json` would need `include` extended to the test files.

---

*Testing analysis: 2026-09-17*
