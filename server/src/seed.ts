/**
 * Seed a realistic learner history so a fresh install (or a demo) has an
 * Atlas, a review queue, memory and misconceptions to show. Idempotent-ish:
 * refuses to run on a database that already has lessons unless --force.
 *
 *   pnpm demo:seed            # ~/.derive (or DERIVE_DATA_DIR)
 *   pnpm demo:seed -- --force # wipe seeded lessons first
 */
import { randomUUID } from 'node:crypto';
import {
  addMemory,
  addMisconception,
  appendEvent,
  createLesson,
  db,
  listLessons,
  recordQuiz,
  replaceGraph,
  resolveMisconceptions,
  setGoal,
  setPhase,
  type GraphNodeInput,
} from './db.js';

const DAY = 86_400_000;
const now = Date.now();
const force = process.argv.includes('--force');

type SeedNode = GraphNodeInput & { status: 'locked' | 'shaky' | 'teaching' | 'pending'; lockedDaysAgo?: number; reps?: number };
type SeedLesson = {
  topic: string;
  goal: string;
  daysAgo: number;
  mode?: 'agent' | 'external';
  nodes: SeedNode[];
  opening: string;
  quizzes: { question: string; options: string[]; correct: number; picked: number; node: string; explanation: string }[];
  misconceptions?: { node: string; question: string; picked: string; correct: string; explanation: string; resolved: boolean }[];
  memory?: { fact: string; kind: 'learner' | 'preference' | 'strength' | 'gap' }[];
};

const LESSONS: SeedLesson[] = [
  {
    topic: 'Why is the sky blue?',
    goal: 'Explain, from how light scatters off air, why the sky is blue and not violet.',
    daysAgo: 9,
    opening:
      'You already hold that light is an electromagnetic wave and that air is mostly molecules far smaller than a wavelength. We will build from those two facts to Rayleigh scattering, then ask why the answer is blue rather than violet.',
    nodes: [
      { id: 'em', label: 'Light is an oscillating field', kind: 'truth', status: 'locked', lockedDaysAgo: 8, reps: 4, summary: 'Visible light is an electromagnetic wave with wavelengths of roughly 400 to 700 nm.' },
      { id: 'small', label: 'Air molecules are far smaller than a wavelength', kind: 'truth', status: 'locked', lockedDaysAgo: 8, reps: 4 },
      { id: 'dipole', label: 'A driven molecule re-radiates', kind: 'derived', depends_on: ['em', 'small'], status: 'locked', lockedDaysAgo: 8, reps: 4, summary: 'The field drives the electrons; the accelerating charge radiates.' },
      { id: 'rayleigh', label: 'Scattered power grows as 1/λ⁴', kind: 'derived', depends_on: ['dipole'], status: 'locked', lockedDaysAgo: 8, reps: 4 },
      { id: 'solar', label: 'Sunlight falls off toward violet', kind: 'truth', status: 'locked', lockedDaysAgo: 8, reps: 2 },
      { id: 'cones', label: 'The eye is three broad cone curves', kind: 'truth', status: 'locked', lockedDaysAgo: 8, reps: 2 },
      { id: 'goal', label: 'Why the sky is blue, not violet', kind: 'goal', depends_on: ['rayleigh', 'solar', 'cones'], status: 'locked', lockedDaysAgo: 8, reps: 2 },
    ],
    quizzes: [
      { node: 'rayleigh', question: 'Halve the wavelength. By what factor does the scattered power change?', options: ['It doubles', 'It grows 16 times', 'It grows 4 times'], correct: 1, picked: 1, explanation: 'Power scales as $1/\\lambda^4$, so halving $\\lambda$ multiplies it by $2^4 = 16$.' },
      { node: 'goal', question: 'Violet scatters more than blue. Why does the sky not look violet?', options: ['The atmosphere absorbs violet', 'Less violet arrives from the sun and the eye weights it less', 'Violet scatters back into space'], correct: 1, picked: 0, explanation: 'Two multiplications: the solar spectrum is weaker in violet, and the cones respond weakly there. Absorption is negligible at these wavelengths.' },
      { node: 'goal', question: 'Which combination produces the perceived colour of the sky?', options: ['Scattering law × solar spectrum × cone response', 'Scattering law alone', 'Solar spectrum × cone response'], correct: 0, picked: 0, explanation: 'Colour is a projection of the whole scattered spectrum onto three cone curves.' },
    ],
    misconceptions: [
      { node: 'goal', question: 'Violet scatters more than blue. Why does the sky not look violet?', picked: 'The atmosphere absorbs violet', correct: 'Less violet arrives from the sun and the eye weights it less', explanation: 'Absorption is negligible at these wavelengths.', resolved: true },
    ],
    memory: [
      { fact: 'Prefers Socratic questions over narration once the ground truths are in place.', kind: 'preference' },
      { fact: 'Comfortable with basic E&M and wave language; no need to re-derive what a field is.', kind: 'strength' },
    ],
  },
  {
    topic: 'How does the Internet route a packet?',
    goal: 'See why a packet gets across the world with no router knowing the whole path.',
    daysAgo: 6,
    opening:
      'Nobody holds a map of the Internet. Every router knows only its neighbours and a table of prefixes. We will derive why that is enough, starting from what IP does and does not promise.',
    nodes: [
      { id: 'best_effort', label: 'IP is best effort', kind: 'truth', status: 'locked', lockedDaysAgo: 6, reps: 4, summary: 'Routers forward packets toward the destination with no promise they arrive.' },
      { id: 'prefix', label: 'Addresses are hierarchical', kind: 'truth', status: 'locked', lockedDaysAgo: 6, reps: 4 },
      { id: 'hop', label: 'Each hop decides alone', kind: 'derived', depends_on: ['best_effort', 'prefix'], status: 'locked', lockedDaysAgo: 6, reps: 4 },
      { id: 'longest', label: 'Longest prefix wins', kind: 'derived', depends_on: ['prefix'], status: 'locked', lockedDaysAgo: 6, reps: 4 },
      { id: 'goal', label: 'Routing without a map', kind: 'goal', depends_on: ['hop', 'longest'], status: 'locked', lockedDaysAgo: 6, reps: 4 },
    ],
    quizzes: [
      { node: 'hop', question: 'A router receives a packet for an address it has never seen. What does it do?', options: ['Drops it and reports an error to the sender', 'Matches the address against its prefix table and forwards on the best match', 'Floods it to every neighbour'], correct: 1, picked: 1, explanation: 'A router never needs to have seen the address before. Prefixes aggregate whole regions of the address space.' },
    ],
  },
  {
    topic: 'How does TCP make an unreliable network reliable?',
    goal: 'Derive acks, sequence numbers, timers and windows as forced consequences of a best-effort network.',
    daysAgo: 4,
    mode: 'external',
    opening:
      'IP promises nothing: packets may be lost, duplicated, reordered or delayed. Every TCP mechanism is a forced move against one of those four failures. We will derive each one from the failure that forces it.',
    nodes: [
      { id: 'best_effort', label: 'IP is best effort', kind: 'truth', status: 'locked', lockedDaysAgo: 4, reps: 2, summary: 'Routers forward packets toward the destination with no promise they arrive.' },
      { id: 'no_news', label: 'Silence is not evidence', kind: 'truth', status: 'locked', lockedDaysAgo: 4, reps: 2 },
      { id: 'ack', label: 'Acknowledgments are forced', kind: 'derived', depends_on: ['best_effort', 'no_news'], status: 'locked', lockedDaysAgo: 4, reps: 2 },
      { id: 'timeout', label: 'Timers and a measured RTO', kind: 'derived', depends_on: ['ack'], status: 'locked', lockedDaysAgo: 4, reps: 1 },
      { id: 'seq', label: 'Sequence numbers', kind: 'derived', depends_on: ['timeout'], status: 'locked', lockedDaysAgo: 4, reps: 1 },
      { id: 'window', label: 'A window keeps the pipe full', kind: 'derived', depends_on: ['seq'], status: 'shaky', lockedDaysAgo: 3, reps: 0 },
      { id: 'congestion', label: 'The network is also a receiver', kind: 'derived', depends_on: ['window', 'timeout'], status: 'pending' },
      { id: 'goal', label: 'Why TCP is reliable', kind: 'goal', depends_on: ['seq', 'window', 'congestion'], status: 'pending' },
    ],
    quizzes: [
      { node: 'ack', question: 'Sender A wants to be certain B received a packet. What is the strongest thing A can learn?', options: ['Certainty once an ack for that packet arrives', 'Never certainty, only lower uncertainty', 'Certainty after waiting the maximum delay'], correct: 0, picked: 0, explanation: 'An ack for that specific packet proves B had it. The absence of an ack proves nothing.' },
      { node: 'seq', question: 'A retransmits after a timeout, but the first copy had arrived and only its ack was lost. What does B need?', options: ['Nothing; the duplicate arrives soon after', 'A per-packet identifier', 'A retransmission flag'], correct: 1, picked: 1, explanation: 'Only an identity per byte lets B recognise data it already holds. A flag does not help when the original was the one lost.' },
      { node: 'window', question: 'RTT is 100 ms and at most 64 KB may be unacknowledged. Best sustained throughput?', options: ['About 640 KB/s', 'About 6.4 MB/s', 'Unlimited'], correct: 0, picked: 1, explanation: 'One window per round trip: $W / RTT = 64\\,\\text{KB} / 0.1\\,\\text{s} = 640\\,\\text{KB/s}$.' },
      { node: 'window', question: 'Which expression bounds sustained throughput?', options: ['$W / RTT$', '$W \\cdot RTT$', '$W / RTT^2$'], correct: 0, picked: 1, explanation: 'The sender emits $W$ bytes then idles one RTT for the first ack.' },
    ],
    misconceptions: [
      { node: 'window', question: 'Which expression bounds sustained throughput?', picked: '$W \\cdot RTT$', correct: '$W / RTT$', explanation: 'One window per round trip.', resolved: false },
    ],
    memory: [{ fact: 'Tends to treat the window as a burst limit rather than a rate limit; re-derive throughput from one-window-per-RTT before building on it.', kind: 'gap' }],
  },
  {
    topic: 'What is a monad, really?',
    goal: 'See a monad as the minimal structure that lets you sequence computations that carry context.',
    daysAgo: 1,
    opening:
      'Forget the word for a moment. Start from a problem you already have: functions that return a value plus some context, and the need to chain them without hand-threading that context every time.',
    nodes: [
      { id: 'fn', label: 'A pure function is a rule', kind: 'truth', status: 'locked', lockedDaysAgo: 0, reps: 1 },
      { id: 'ctx', label: 'Some results carry context', kind: 'truth', status: 'locked', lockedDaysAgo: 0, reps: 1, summary: 'Maybe-absent, many results, a log, a state, an effect.' },
      { id: 'compose', label: 'Ordinary composition breaks', kind: 'derived', depends_on: ['fn', 'ctx'], status: 'locked', lockedDaysAgo: 0, reps: 1 },
      { id: 'bind', label: 'bind: chain and re-wrap', kind: 'derived', depends_on: ['compose'], status: 'teaching' },
      { id: 'unit', label: 'return: the do-nothing wrap', kind: 'derived', depends_on: ['ctx'], status: 'pending' },
      { id: 'laws', label: 'The laws are just sanity', kind: 'derived', depends_on: ['bind', 'unit'], status: 'pending' },
      { id: 'goal', label: 'A monad is composable context', kind: 'goal', depends_on: ['laws'], status: 'pending' },
    ],
    quizzes: [
      { node: 'compose', question: 'f: A → Maybe B and g: B → Maybe C. What blocks g ∘ f?', options: ['g expects a B but f hands it a Maybe B', 'Maybe values cannot be passed to functions', 'f and g must return the same type'], correct: 0, picked: 0, explanation: 'The shapes do not line up: the output is wrapped and the input is not. Something must unwrap, apply, and re-wrap.' },
    ],
  },
];

function seed() {
  const existing = listLessons();
  if (existing.length && !force) {
    console.error(`Database already has ${existing.length} lesson(s). Re-run with --force to add the demo history anyway.`);
    process.exit(1);
  }
  for (const L of LESSONS) {
    const created = now - L.daysAgo * DAY;
    const lesson = createLesson(randomUUID(), L.topic, L.mode ?? 'agent');
    db.prepare('UPDATE lessons SET created_at = ?, updated_at = ? WHERE id = ?').run(created, created + 40 * 60_000, lesson.id);
    replaceGraph(lesson.id, L.nodes.map(({ status: _s, lockedDaysAgo: _l, reps: _r, ...n }) => n));
    setGoal(lesson.id, L.goal);
    const done = L.nodes.every((n) => n.status === 'locked');
    setPhase(lesson.id, 'teach');

    appendEvent(lesson.id, 'turn_start', L.mode === 'external' ? { source: 'claude-code' } : {});
    appendEvent(lesson.id, 'phase', { phase: 'plan' });
    appendEvent(lesson.id, 'assistant', { id: randomUUID(), text: L.opening, source: L.mode === 'external' ? 'terminal' : undefined });
    const planId = randomUUID();
    appendEvent(lesson.id, 'plan', { id: planId, goal: L.goal, nodes: L.nodes.map(({ status: _s, lockedDaysAgo: _l, reps: _r, ...n }) => n) });
    appendEvent(lesson.id, 'plan_result', { id: planId, approved: true, feedback: null });
    appendEvent(lesson.id, 'phase', { phase: 'teach' });

    for (const n of L.nodes) {
      if (n.status === 'pending') continue;
      appendEvent(lesson.id, 'node_status', { id: n.id, status: 'teaching' });
      for (const qz of L.quizzes.filter((q) => q.node === n.id)) {
        const qid = randomUUID();
        appendEvent(lesson.id, 'quiz', { id: qid, question: qz.question, options: qz.options, multi: false, node_id: n.id });
        const ok = qz.picked === qz.correct;
        appendEvent(lesson.id, 'quiz_result', { id: qid, selected: [qz.picked], correct: [qz.correct], explanation: qz.explanation, result: ok ? 'correct' : 'incorrect', note: null });
        recordQuiz(lesson.id, n.id, ok);
      }
      if (n.status === 'teaching') continue;
      appendEvent(lesson.id, 'node_status', { id: n.id, status: n.status });
      const lockedAt = now - (n.lockedDaysAgo ?? 0) * DAY;
      if (n.status === 'locked') {
        const reps = n.reps ?? 1;
        // Same schedule as db.setNodeStatus: 1d, then ×2.2 per rep.
        let interval = 1;
        for (let i = 1; i < reps; i++) interval = Math.round(interval * 2.2);
        db.prepare('UPDATE nodes SET status = ?, locked_at = ?, review_at = ?, interval_days = ?, reps = ? WHERE lesson_id = ? AND node_id = ?').run(
          'locked', lockedAt, lockedAt + interval * DAY, interval, reps, lesson.id, n.id,
        );
      } else if (n.status === 'shaky') {
        db.prepare('UPDATE nodes SET status = ?, locked_at = ?, review_at = ?, interval_days = 1, reps = 0 WHERE lesson_id = ? AND node_id = ?').run('shaky', lockedAt, lockedAt + DAY, lesson.id, n.id);
      }
    }
    for (const m of L.misconceptions ?? []) {
      addMisconception({ lessonId: lesson.id, nodeId: m.node, question: m.question, picked: m.picked, correct: m.correct, explanation: m.explanation });
      if (m.resolved) resolveMisconceptions(lesson.id, m.node);
    }
    for (const m of L.memory ?? []) {
      addMemory(m.fact, m.kind, lesson.id);
      appendEvent(lesson.id, 'memory', { fact: m.fact, kind: m.kind });
    }
    if (done) appendEvent(lesson.id, 'assistant', { id: randomUUID(), text: 'The whole graph in one breath: everything above rests on the roots, and the goal is just those roots composed.' });
    appendEvent(lesson.id, 'turn_end', { ok: true, source: L.mode === 'external' ? 'claude-code' : undefined });
    db.prepare('UPDATE events SET ts = ? WHERE lesson_id = ?').run(created + 30 * 60_000, lesson.id);
    db.prepare('UPDATE lessons SET updated_at = ? WHERE id = ?').run(created + 40 * 60_000, lesson.id);
    console.log(`seeded  ${L.topic}  (${L.nodes.filter((n) => n.status === 'locked').length}/${L.nodes.length} locked${L.mode === 'external' ? ', claude code' : ''})`);
  }
  console.log('Done. Open http://localhost:4310 and /atlas.');
}

seed();
