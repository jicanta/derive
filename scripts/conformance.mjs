#!/usr/bin/env node
/**
 * `pnpm conformance`: replays one scripted lesson on every provider this
 * environment can reach, and reports per provider and model whether the method
 * actually held — the pretest ran before the teaching, the understanding gate
 * passed on the node that was taught, and the cumulative quiz fired and was
 * answered.
 *
 * It drives real configured models, and it has to. The question is whether a
 * *particular* model follows the method through Derive's own tool surface, and
 * a stub that always calls the tools correctly answers a different question. So
 * a weak local model failing the gate is an expected and useful finding here,
 * not a bug in this script: it is the thing the report exists to tell you.
 *
 * Every provider is either tested or named as skipped with its reason. A report
 * that silently dropped what it could not reach would say the method holds
 * everywhere while having checked almost nothing, and a reader would believe
 * it. An all-skipped report is therefore a complete report and exits 0; a row
 * that failed a verdict exits non-zero, which is what makes a nightly failure
 * visible. The decision is `exitCodeFor` below — a pure function of the
 * finished report, exported so the failing path can be exercised on a machine
 * with no provider, no key and no model.
 *
 * The replay runs against the built server in a throwaway data directory, so no
 * lesson, node, FSRS interval or usage row of the learner's own record is ever
 * touched — the same reason plan 04-03's teaching proof uses a scratch lesson.
 * Keys come from the environment, which is how both CI and a local `.env`
 * supply them, and never from the learner's secrets file. `DERIVE_BACKEND` and
 * `DERIVE_MODEL` are deliberately not passed through: both are install-wide
 * locks, and a harness whose whole job is to drive every row cannot run under a
 * lock naming one provider or one model id.
 *
 * Redaction first, before any provider request. This script is outside the
 * server's egress chokepoints, so it inherits neither `events.ts`'s redaction
 * nor the route layer's `safeMessage` for free: every key it reads is
 * registered with the server's own `registerSecret` at startup, and every
 * sentence it records — a provider's error body, a thrown message, a skip
 * reason — goes through `safeMessage` before it reaches the report. A 401 body
 * from a cloud provider can echo the key that caused it, and
 * `actions/upload-artifact` publishes whatever a run wrote.
 */
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The one way a sentence leaves this script, for the two paths that are not a
 * report row: the throw a failed spawn carries, and the entry point's last
 * catch.
 *
 * Both of those handle text Derive never composed — the child server's own
 * stderr, and whatever message an unhandled failure arrived with — and both
 * reach a job log that is public on a public repository. They cannot take
 * `main`'s own `safe`, because they also have to work before `loadServer` has
 * run and before a single key has been registered. So this starts as the
 * narrowing every catch does and nothing more, and `main` rebinds it to the
 * server's own `safeMessage` the moment the keys are registered.
 */
let safeOut = (e) => String(e instanceof Error ? e.message : (e ?? ''));

// ---------- the exit code, as a pure function of the report ----------

/**
 * Non-zero when any row failed a verdict, zero when every row either passed or
 * was skipped.
 *
 * A complete all-skipped report is a correct outcome, not a failure: the first
 * green nightly run can legitimately report every cloud provider skipped
 * because no secret exists yet. Pure and exported on purpose — it is the only
 * part of the harness a machine with no model can check, and it is the half
 * that decides whether a nightly failure is ever noticed.
 */
export function exitCodeFor(report) {
  const rows = Array.isArray(report?.rows) ? report.rows : [];
  return rows.some((r) => r?.status === 'failed') ? 1 : 0;
}

// ---------- the scripted lesson ----------

/** The node the lesson teaches, gates on and quizzes; the one `hasUnderstandingPass` is asked about. */
const GOAL_NODE = 'sum-even';

/** The derived node under it. Both non-truth nodes get a cumulative question, so `cumulativeStatus` has nothing pending. */
const STEP_NODE = 'two-doubles';

const TOPIC = 'Why the sum of two even numbers is even';

const GOAL = 'Know why adding two even numbers always gives an even number';

/** The graph the script fixes. Three nodes because `set_plan`'s own schema requires at least three. */
const PLAN_NODES = [
  { id: 'even', kind: 'truth', label: 'An even number is twice a whole number', summary: 'Every even number can be written as two times some whole number.' },
  { id: STEP_NODE, kind: 'derived', label: 'Two doubles add to a double', summary: 'Adding two multiples of two gives another multiple of two.', depends_on: ['even'] },
  { id: GOAL_NODE, kind: 'goal', label: 'Two even numbers add to an even number', summary: 'The sum of any two even numbers is even.', depends_on: [STEP_NODE] },
];

/**
 * Every question the script asks, and its own answer key.
 *
 * One table, read twice: the prompt below is rendered from it, and the card
 * answers are looked up in it. That is what keeps the two from disagreeing —
 * a second copy of the key is how a harness starts marking a correct answer
 * wrong. The key is matched on the option's *text*, so a model that reorders
 * the options still has its own key honoured, and `actions.ts` does the
 * grading exactly as it does for a learner. The model never grades itself.
 */
const QUIZZES = [
  {
    node: GOAL_NODE,
    purpose: 'pretest',
    tests: 'intuition',
    question: 'Before any explanation: add two even numbers. What is the sum?',
    options: ['Always even', 'Always odd'],
    correct: 'Always even',
    explanation: 'Two even numbers are each twice a whole number, so their sum is twice a whole number too.',
  },
  {
    node: GOAL_NODE,
    purpose: 'check',
    tests: 'intuition',
    question: 'Why must the sum of two even numbers be even?',
    options: ['Because it is twice the sum of their halves', 'Because adding anything to an even number keeps it even'],
    correct: 'Because it is twice the sum of their halves',
    explanation: '2a + 2b = 2(a + b), which is twice a whole number. The distractor is false: 2 + 3 is odd.',
  },
  {
    node: STEP_NODE,
    purpose: 'cumulative',
    tests: 'transfer',
    question: 'Add three multiples of ten. What must the total be?',
    options: ['A multiple of ten', 'A multiple of three'],
    correct: 'A multiple of ten',
    explanation: 'The same argument with ten in place of two: 10a + 10b + 10c = 10(a + b + c).',
  },
  {
    node: GOAL_NODE,
    purpose: 'cumulative',
    tests: 'transfer',
    question: 'One even number and one odd number are added. What must the sum be?',
    options: ['Odd', 'Even'],
    correct: 'Odd',
    explanation: '2a + (2b + 1) = 2(a + b) + 1, which is one more than a double.',
  },
];

/** What a card that wants prose gets. Fixed, so it is the same sentence on every row. */
const PROSE_ANSWER = 'Two even numbers are each two times a whole number, so their sum is two times the sum of those whole numbers, which is even. This is Derive\'s own conformance check rather than a lesson.';

/** One `quiz` step of the scripted prompt, written so the model has nothing to invent. */
const quizStep = (q, n) =>
  `${n}. Call quiz with node_id "${q.node}", purpose "${q.purpose}", tests "${q.tests}", question "${q.question}", options exactly ${JSON.stringify(q.options)}, correct [${q.options.indexOf(q.correct)}] — the correct option is "${q.correct}" — and explanation "${q.explanation}".`;

/**
 * The turn the harness sends.
 *
 * The same text on every row, so a difference in the report is a difference in
 * the model rather than a difference in what it was asked. It rides the whole
 * method prompt, as any turn does, so it has to say plainly that this is not a
 * lesson: a model doing the right thing would otherwise open with probe
 * questions and the replay would time out on Derive's own method. Every
 * question is fixed because the card payload does not carry the answer — the
 * browser must not see it — so the only way the method's own server-side
 * grading can decide a verdict is for the script to have declared the key.
 */
function scriptPrompt() {
  const steps = [
    `1. Call set_plan with the goal "${GOAL}" and exactly these three nodes: ${PLAN_NODES.map((n) => JSON.stringify(n)).join(', ')}.`,
    quizStep(QUIZZES[0], 2),
    `3. Call node_status with id "${GOAL_NODE}" and status "teaching", then write two or three sentences establishing it.`,
    quizStep(QUIZZES[1], 4),
    `5. Call node_status with id "${GOAL_NODE}" and status "locked".`,
    quizStep(QUIZZES[2], 6),
    quizStep(QUIZZES[3], 7),
  ];
  return `This is Derive's own conformance check, not a lesson, and nobody is learning from it. Ask no probe questions and do not re-plan. Run exactly these steps in order and then end the turn:\n\n${steps.join('\n')}\n\nCall no other tool, attach nothing, search for nothing, and ask nothing else.`;
}

/** The scripted row for a card, matched on the question the model actually asked. */
const scriptedFor = (question) => QUIZZES.find((q) => normalise(q.question) === normalise(question));

const normalise = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * The option carrying the answer the script fixed, by its text.
 *
 * A question the script asked is answered from its own row. A question the
 * model invented is answered by any scripted key that happens to be among the
 * options, and otherwise by the first option — so a card is always settled and
 * the turn never hangs waiting on a learner who does not exist. A wrong answer
 * there is a failed verdict, which is the honest outcome for a model that did
 * not ask what it was told to ask.
 */
function correctIndex(payload) {
  const options = Array.isArray(payload?.options) ? payload.options : [];
  if (!options.length) return 0;
  const own = scriptedFor(payload?.question);
  const keys = own ? [own.correct] : QUIZZES.map((q) => q.correct);
  for (const key of keys) {
    const at = options.findIndex((o) => normalise(o) === normalise(key));
    if (at >= 0) return at;
  }
  return 0;
}

/** The card events the harness settles, and what it answers each with. */
function answerFor(type, payload) {
  if (type === 'plan') return { approved: true };
  if (type === 'quiz') return { selected: [correctIndex(payload)], sure: true };
  if (type === 'ask' || type === 'explain') return { text: PROSE_ANSWER };
  return null;
}

// ---------- the environment this run has ----------

/** How long one row's whole replay may take before it is recorded as a failure. */
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * What the Ollama adapter passes for `reliableToolCalling`, recorded in every
 * run header. False, fixed in `server/src/drivers/adapters.ts`, and stated here
 * because the report would otherwise be readable as healthier than it is: that
 * layer retries and normalises a malformed tool call behind Derive's back, so
 * with it on the rejection count below would measure the wrapper rather than
 * the model — the one thing a conformance harness must not do.
 */
const RELIABLE_TOOL_CALLING = false;

const USAGE = `derive conformance: replay one scripted lesson per reachable provider and report whether the method held.

  node scripts/conformance.mjs [options]

  --out <dir>        where the dated .json and .md reports are written
                     (default: <data dir>/conformance)
  --think <value>    the Ollama thinking setting the local rows run under:
                     false (default), low, medium or high. Research assumption
                     A7 is unsettled: a model that stops calling tools under
                     think:false can be re-run at low and the difference read
                     off two reports.
  --timeout <sec>    how long one row's replay may take (default: 600)
  --logins           include the Claude Code and Codex rows. Off by default: a
                     login row spends the owner's own subscription rather than a
                     key configured for this, and no CI runner has one. They are
                     reported as skipped with that reason when it is off.
  --help             print this and exit`;

/** The flags, with every default stated. Unknown flags are refused rather than ignored, so a typo is not a silently narrower run. */
function parseArgs(argv) {
  const opts = { out: null, think: 'false', timeoutMs: DEFAULT_TIMEOUT_MS, logins: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--logins') opts.logins = true;
    else if (arg === '--out') opts.out = argv[++i];
    else if (arg === '--think') opts.think = argv[++i];
    else if (arg === '--timeout') opts.timeoutMs = Number(argv[++i]) * 1000;
    else throw new Error(`unknown option ${arg}. Run with --help.`);
  }
  if (opts.out !== null && !opts.out) throw new Error('--out needs a directory');
  if (!['false', 'low', 'medium', 'high'].includes(String(opts.think))) throw new Error(`--think takes false, low, medium or high, not ${opts.think}`);
  if (!Number.isFinite(opts.timeoutMs) || opts.timeoutMs <= 0) throw new Error('--timeout takes a number of seconds');
  return opts;
}

/**
 * The built server's own modules, loaded after the data directory is pinned.
 *
 * `db.js` opens the database at import time, so `DERIVE_DATA_DIR` has to name
 * the throwaway directory before this runs. Dynamic rather than a top-level
 * import so this file can be imported on an unbuilt tree — which is exactly
 * what the gate on `exitCodeFor` does — and so a missing build is Derive's own
 * sentence rather than a module-resolution stack.
 */
async function loadServer() {
  const entry = join(root, 'server/dist/index.js');
  if (!existsSync(entry)) throw new Error('run `pnpm build` first: the harness drives the built server, and server/dist is missing');
  const [db, secrets, providers] = await Promise.all([
    import(join(root, 'server/dist/db.js')),
    import(join(root, 'server/dist/secrets.js')),
    import(join(root, 'server/dist/providers.js')),
  ]);
  return { entry, db, secrets, providers };
}

/** Every variable a provider key can arrive in, from the catalogue plus the fallback search key, which has no row to declare it. */
const keyNames = (providers) => [...new Set([...providers.PROVIDERS.flatMap((p) => p.envKeys), 'TAVILY_API_KEY'])];

/** A port the operating system has just confirmed free, as `server/test/spawn.ts` explains at length: picking a number is how two runs collide. */
function freePort() {
  return new Promise((res, rej) => {
    const probe = createServer();
    probe.on('error', rej);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => res(port));
    });
  });
}

/** How many times a spawn is retried on a fresh port before the failure is reported as real. The posture, and the reason for it, is `server/test/spawn.ts`'s. */
const SPAWN_ATTEMPTS = 5;

/** Start the built server on a free port in the throwaway data directory, and resolve once `/api/health` answers. The final throw carries the last line the child wrote to stderr: a server that genuinely cannot start must still fail the run. */
async function startServer(entry, dataDir, env) {
  let stderr = '';
  for (let attempt = 1; attempt <= SPAWN_ATTEMPTS; attempt++) {
    const port = await freePort();
    const base = `http://127.0.0.1:${port}`;
    const child = spawn(process.execPath, [entry], {
      env: { ...env, PORT: String(port), DERIVE_DATA_DIR: dataDir },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    let exited = false;
    child.once('exit', () => {
      exited = true;
    });
    const deadline = Date.now() + 20_000;
    while (!exited && Date.now() < deadline) {
      const up = await fetch(`${base}/api/health`).then((r) => r.ok).catch(() => false);
      if (up) return { child, base, token: readFileSync(join(dataDir, 'token'), 'utf8').trim() };
      await sleep(200);
    }
    child.kill();
  }
  // `last` is a raw line of the child's stderr, so it goes through the same
  // redaction every recorded sentence does: a server that dies with an
  // unhandled error can carry a credential in it, and this message reaches the
  // job log.
  const last = stderr.trim().split('\n').filter(Boolean).at(-1) ?? 'it wrote nothing to stderr';
  throw new Error(safeOut(`the derive server did not start in ${SPAWN_ATTEMPTS} attempts: ${last}`));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The server's API, with the install token on every call. A non-ok answer throws the server's own sentence, which is the shape every caller here wants. */
function client(base, token) {
  return async (path, init = {}) => {
    const res = await fetch(`${base}${path}`, {
      method: init.method ?? 'GET',
      headers: { 'content-type': 'application/json', 'x-derive-token': token },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(String(body?.error ?? `${res.status} ${res.statusText}`));
    return body;
  };
}

// ---------- one row ----------

/** Why a row is not being driven, or null when it is. Absence of a key, a server or a model is a fact to report, never a failure. */
function skipReason(row, spec, opts) {
  if (!row.teaches) return 'no driver for this row in this build';
  if (row.auth === 'login') {
    if (!opts.logins) return 'subscription logins run only with --logins: a login row spends the owner\'s own subscription, and no CI runner has one';
    return row.status === 'logged in' ? null : 'no login found';
  }
  if (row.group === 'local') {
    return row.status.startsWith('found on port') ? null : `no ${row.label} server answered at ${row.base_url ?? row.base_url_default ?? 'its default address'}`;
  }
  if (row.auth === 'key+url' && !row.base_url) return 'no endpoint configured';
  if (!row.key?.set) return `no key in the environment (${spec.envKeys.join(' or ') || 'none declared'})`;
  return null;
}

/** The model this row runs on: the one the server's own resolver would use, else the first id the server itself lists. No model id is named here — a harness that carried its own default would report on a model nobody configured. */
async function chooseModel(api, row) {
  if (row.model) return { model: row.model };
  if (row.group === 'local') {
    const { models } = await api(`/api/settings/${row.id}/models`, { method: 'POST', body: {} });
    const model = Array.isArray(models) ? models[0] : undefined;
    if (!model) return { skip: `${row.label} answered with no models` };
    await api(`/api/settings/${row.id}`, { method: 'PUT', body: { model } });
    return { model };
  }
  if (row.default_model) return { model: row.default_model };
  return { skip: 'no model configured' };
}

/** Quiet the organic first turn: `POST /api/lessons` always opens one with the probe prompt, and the script is the turn after it. Interrupt is idempotent, so it is simply re-sent until the lesson is idle. */
async function quiet(api, id, deadline) {
  while (Date.now() < deadline) {
    await api(`/api/lessons/${id}/interrupt`, { method: 'POST', body: {} }).catch(() => undefined);
    const view = await api(`/api/lessons/${id}`);
    if (!view.busy && !view.pending) return true;
    await sleep(500);
  }
  return false;
}

/** How long the scripted turn has to actually open before the row is recorded as a failure. `POST /message` fires the turn and answers at once, so an idle lesson is not yet evidence that anything ran. */
const TURN_START_MS = 90_000;

/**
 * Drive the lesson to its end, settling every card the way the app's own user
 * would: approve the plan, pick the option the script declared correct, write
 * the fixed prose. Each card is answered once; the event stays in the log after
 * it is settled, which is what the answered set is for.
 *
 * Only events past `sinceSeq` are looked at, which is both halves of one point:
 * the interrupted opening turn's own cards are not this script's to answer, and
 * "the lesson is idle" only means the replay is over once the scripted turn has
 * been seen to start. Without that the first poll after `POST /message` — which
 * returns before the turn opens — would read as a finished lesson with no
 * events, and every verdict would fail for a model that was about to do fine.
 */
async function drive(api, id, deadline, sinceSeq) {
  const answered = new Set();
  const startBy = Math.min(deadline, Date.now() + TURN_START_MS);
  let events = [];
  let opened = false;
  while (Date.now() < deadline) {
    const view = await api(`/api/lessons/${id}`);
    events = (view.events ?? []).filter((ev) => ev.seq > sinceSeq);
    if (!opened) opened = events.some((ev) => ev.type === 'turn_start');
    for (const ev of events) {
      const promptId = ev?.payload?.id;
      if (typeof promptId !== 'string' || answered.has(promptId)) continue;
      const answer = answerFor(ev.type, ev.payload);
      if (!answer) continue;
      answered.add(promptId);
      await api(`/api/lessons/${id}/answer`, { method: 'POST', body: { prompt_id: promptId, ...answer } }).catch(() => undefined);
    }
    if (opened && !view.busy && !view.pending) return { events, timedOut: false };
    if (!opened && Date.now() > startBy) return { events, timedOut: false, neverOpened: true };
    await sleep(1000);
  }
  return { events, timedOut: true };
}

/** The loop's own refusal sentence for this lesson, when a turn ended with one. It names the real problem — a model the ladder refused, a window too small, a key the provider rejected — better than any verdict could. */
function refusalIn(events) {
  const end = [...events].reverse().find((ev) => ev.type === 'turn_end' && ev.payload?.ok === false);
  return end ? String(end.payload?.error ?? 'the turn failed') : null;
}

/** One provider and model: the replay, the three verdicts read from the server's own state, and the row the report carries. */
async function runRow(ctx, row, spec) {
  const started = Date.now();
  const { api, opts, db } = ctx;
  const base = { provider: row.id, label: row.label, group: row.group };

  const skip = skipReason(row, spec, opts);
  if (skip) return { ...base, model: null, status: 'skipped', reason: ctx.safe(skip) };

  const chosen = await chooseModel(api, row);
  if (chosen.skip) return { ...base, model: null, status: 'skipped', reason: ctx.safe(chosen.skip) };
  const model = chosen.model ?? null;

  await api('/api/settings/active', { method: 'POST', body: { provider: row.id } });
  const { id } = await api('/api/lessons', { method: 'POST', body: { topic: TOPIC } });
  const deadline = started + opts.timeoutMs;
  const settled = await quiet(api, id, deadline);
  if (!settled) return { ...base, model, status: 'failed', reason: 'the opening turn could not be brought to an idle state within the timeout', ms: Date.now() - started };
  const sinceSeq = Math.max(0, ...(await api(`/api/lessons/${id}`)).events.map((ev) => ev.seq));
  await api(`/api/lessons/${id}/message`, { method: 'POST', body: { text: scriptPrompt() } });
  const { events, timedOut, neverOpened } = await drive(api, id, deadline, sinceSeq);

  const quizzes = db.quizzesOn(id, GOAL_NODE);
  const cumulative = db.cumulativeStatus(id);
  const verdicts = {
    pretest: quizzes.some((r) => r.purpose === 'pretest'),
    gate: db.hasUnderstandingPass(id, GOAL_NODE),
    cumulative: cumulative.done.length > 0 && cumulative.missed.length === 0 && cumulative.pending.length === 0,
  };
  const missed = Object.entries(verdicts).filter(([, held]) => !held).map(([name]) => name);
  const refusal = refusalIn(events);
  const trailer = missed.length ? ` (${missed.join(', ')} did not hold)` : '';
  const reason = neverOpened
    ? `the scripted turn never opened within ${Math.round(TURN_START_MS / 1000)}s${trailer}`
    : timedOut
      ? `the lesson did not finish within ${Math.round(opts.timeoutMs / 1000)}s${trailer}`
      : refusal
        ? `${refusal}${trailer}`
        : missed.length
          ? `${missed.join(', ')} did not hold`
          : null;

  return {
    ...base,
    model,
    // The verdicts decide, and nothing else does: a turn that errored after the
    // last question still held the method, and the sentence is kept beside it.
    status: missed.length || timedOut || neverOpened ? 'failed' : 'passed',
    ...(reason ? { reason: ctx.safe(reason) } : {}),
    verdicts,
    cumulative_nodes: { done: cumulative.done.length, missed: cumulative.missed.length, pending: cumulative.pending.length },
    // Schema-rejected calls only, for this provider and this model (D-19,
    // D-20). It is a diagnostic about a model, never shown to a learner.
    rejections: db.toolRejectionRate(row.id, model),
    ms: Date.now() - started,
  };
}

// ---------- the report ----------

/** The Markdown summary, rendered from the finished JSON so the two can never disagree. */
function markdownFor(report) {
  const mark = { passed: 'pass', failed: 'FAIL', skipped: 'skipped' };
  const lines = [
    `# Derive conformance — ${report.run.started}`,
    '',
    `Derive ${report.run.version} · run \`${report.run.id}\` · think \`${report.run.think}\` · reliableToolCalling \`${report.run.reliable_tool_calling}\` · timeout ${Math.round(report.run.timeout_ms / 1000)}s · logins ${report.run.logins_included ? 'included' : 'skipped'}`,
    '',
    'Every provider appears exactly once: either its three verdicts, or an explicit skipped line with the reason. A model that failed a verdict is a finding, not a bug in the harness. Rejected counts tool calls whose arguments failed the full server-side schema — nothing else.',
    '',
    '| Provider | Model | Result | Pretest | Gate | Cumulative | Rejected | Detail |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  const cell = (v) => (v === true ? 'held' : v === false ? 'no' : '—');
  const rejected = (r) => (r.rejections ? `${r.rejections.rejected}/${r.rejections.rejected + r.rejections.executed} calls` : '—');
  for (const r of report.rows) {
    lines.push(
      `| ${r.label} | ${r.model ?? '—'} | ${mark[r.status] ?? r.status} | ${cell(r.verdicts?.pretest)} | ${cell(r.verdicts?.gate)} | ${cell(r.verdicts?.cumulative)} | ${rejected(r)} | ${r.reason ?? ''} |`,
    );
  }
  const counts = ['passed', 'failed', 'skipped'].map((s) => `${report.rows.filter((r) => r.status === s).length} ${s}`);
  lines.push('', `${report.rows.length} providers: ${counts.join(', ')}.`, '', `Finished ${report.run.finished}.`);
  return `${lines.join('\n')}\n`;
}

/** Both files, under the same run id, in the directory the run was given. Dated rather than overwritten: the value of this report is the trend. */
function write(dir, report) {
  mkdirSync(dir, { recursive: true });
  const stem = `${report.run.started.slice(0, 10)}-${report.run.id}`;
  const json = join(dir, `${stem}.json`);
  const md = join(dir, `${stem}.md`);
  writeFileSync(json, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(md, markdownFor(report), 'utf8');
  return { json, md };
}

// ---------- the run ----------

async function main(argv) {
  const opts = parseArgs(argv);
  if (opts.help) {
    console.log(USAGE);
    return { rows: [] };
  }

  // Resolved before the data directory is repointed, so the report lands in the
  // learner's own ~/.derive (or DERIVE_DATA_DIR) while the replay runs in a
  // throwaway one.
  const outDir = opts.out ?? join(resolve(process.env.DERIVE_DATA_DIR ?? join(homedir(), '.derive')), 'conformance');
  const dataDir = mkdtempSync(join(tmpdir(), 'derive-conformance-'));
  process.env.DERIVE_DATA_DIR = dataDir;

  const { entry, db, secrets, providers } = await loadServer();
  // Before any provider request, and before any sentence is recorded: this
  // script is outside the server's egress chokepoints, and the report is a
  // published CI artifact.
  for (const name of keyNames(providers)) secrets.registerSecret(process.env[name]);
  const safe = (text) => secrets.safeMessage(text);
  // From here on the two paths outside a report row redact too — the spawn
  // throw below and the entry point's last catch.
  safeOut = safe;

  const started = new Date().toISOString();
  const run = {
    id: randomUUID().slice(0, 8),
    started,
    finished: started,
    version: JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version,
    think: opts.think === 'false' ? false : opts.think,
    reliable_tool_calling: RELIABLE_TOOL_CALLING,
    logins_included: opts.logins,
    timeout_ms: opts.timeoutMs,
    script: { topic: TOPIC, goal_node: GOAL_NODE, quizzes: QUIZZES.length },
  };
  const rows = [];
  let server;
  try {
    // DERIVE_BACKEND and DERIVE_MODEL are stripped: both lock a field this
    // harness has to set per row, and a locked provider would make the report
    // selective — the one thing it must not be.
    const { DERIVE_BACKEND: _backend, DERIVE_MODEL: _model, ...env } = process.env;
    server = await startServer(entry, dataDir, { ...env, DERIVE_OLLAMA_THINK: String(opts.think) });
    const api = client(server.base, server.token);
    const view = await api('/api/settings/detect', { method: 'POST', body: {} });
    const ctx = { api, opts, db, safe };
    for (const row of view.rows) {
      const spec = providers.providerOf(row.id);
      try {
        rows.push(await runRow(ctx, row, spec));
      } catch (e) {
        rows.push({ provider: row.id, label: row.label, group: row.group, model: row.model ?? null, status: 'failed', reason: secrets.safeMessage(e) });
      }
    }
  } finally {
    server?.child.kill();
    rmSync(dataDir, { recursive: true, force: true });
  }

  const report = { run: { ...run, finished: new Date().toISOString() }, rows };
  const files = write(outDir, report);
  for (const r of rows) console.log(`${r.status.padEnd(7)} ${r.label}${r.model ? ` · ${r.model}` : ''}${r.reason ? ` — ${r.reason}` : ''}`);
  console.log(`\n${rows.length} providers: ${['passed', 'failed', 'skipped'].map((s) => `${rows.filter((r) => r.status === s).length} ${s}`).join(', ')}.`);
  console.log(`${files.json}\n${files.md}`);
  return report;
}

// Only when this file is the process entry point, so importing it to check the
// exit decision contacts nothing and reports on nothing.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = await main(process.argv.slice(2));
    process.exit(exitCodeFor(report));
  } catch (e) {
    console.error(safeOut(e));
    process.exit(1);
  }
}
