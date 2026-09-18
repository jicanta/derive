/**
 * The seam every driver runs behind.
 *
 * A driver is one way of running a lesson turn on a model: the Claude Agent
 * SDK on a Claude Code login, the Codex SDK on a ChatGPT login, and later an
 * API key, a gateway or a local model. What they have in common is not how
 * they reach a model but what they report while they do it, so that is what
 * this module fixes. A driver implements `runTurn(ctx, sink)` and says
 * everything it has to say through the sink, which means adding a provider
 * costs one `runTurn` and nothing else: no new event type, no change to the
 * SSE stream, the web app or the terminal mirrors.
 *
 * The sink is deliberately no wider than `server/src/events.ts` already is —
 * emit, emitUpdate, checkpoint, emitEphemeral — plus the session-id write a
 * resumable driver needs and one `endTurn`. `endTurn` is idempotent and the
 * guard lives here rather than once per driver, so a turn ends exactly once
 * however many times its driver says so; a driver that reports nothing at all
 * still ends its turn, because `runTurn` in `server/src/agent.ts` closes it
 * in a finally.
 *
 * External lessons stay outside this seam on purpose. A lesson with mode
 * 'external' is driven by a terminal — Claude Code or the Codex CLI is
 * running the model and calling Derive, not the other way round — so it
 * arrives through the HTTP action route and the mirrors, never through a
 * driver. Forcing it through `runTurn` would invert that relationship.
 */
import { finishTurn, setSessionId, turnStatusOf, type StoredEvent } from './db.js';
import { checkpoint, emit, emitEphemeral, emitUpdate } from './events.js';

/** A turn in flight, as the lesson's bookkeeping holds it: the one thing a driver must let the learner do is stop. */
export type Active = { interrupt: () => Promise<void> };

/** How hard the model should think, as both provider SDKs spell it. */
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/** Everything a driver needs to run one turn. A driver reads its inputs here and nowhere else, so it has no hidden state. */
export type TurnContext = {
  lessonId: string;
  /** The learner's message, with any pending notices already folded in. */
  prompt: string;
  /** The whole system prompt: the method, the material, the library and the learner profile. */
  instructions: string;
  /** The model override, or undefined to take the provider's own default. */
  model: string | undefined;
  effort: Effort;
  /** The provider's id for this lesson's conversation, to resume it; null on the first turn. */
  sessionId: string | null;
  /** True once the learner has pressed Stop: a turn that ends now was interrupted, not broken. */
  isStopping: () => boolean;
  /** How a driver hands its interrupt back to the turn bookkeeping, instead of reaching into the active map itself. */
  onActive: (handle: Active) => void;
};

/** The one way a driver reports. Exactly the vocabulary of server/src/events.ts, bound to one lesson, plus a session-id write and one turn end. */
export type EventSink = {
  /** Persist an event and fan it out. */
  emit: (type: string, payload: unknown) => StoredEvent;
  /** Rewrite an already persisted event under the same seq and fan the new payload out. */
  emitUpdate: (seq: number, type: string, payload: unknown) => StoredEvent;
  /** Persist without fanning out, for the checkpoints of a growing block. */
  checkpoint: (seq: number, payload: unknown) => void;
  /** Fan out without persisting, for status lines and high-frequency text deltas. */
  emitEphemeral: (type: string, payload: unknown) => void;
  /** Record the provider's conversation id so the next turn resumes it. */
  setSessionId: (id: string) => void;
  /** End the turn. Idempotent: the first call wins and every later one is ignored. */
  endTurn: (payload: Record<string, unknown>) => void;
};

/** One way of running a lesson turn. This signature is the whole contract; a new provider implements it and nothing else. */
export type Driver = {
  name: string;
  runTurn(ctx: TurnContext, sink: EventSink): Promise<void>;
};

/**
 * The sink for one lesson's turn. Built once per turn, because the idempotent
 * `endTurn` guard it carries is what makes "exactly one turn_end" true no
 * matter how many times the driver and the bookkeeping around it both try.
 *
 * `turnId` is the row this turn was opened as. The guard closes it before the
 * event goes out, so the turn's row and the lesson's narrative say the same
 * thing about how it ended, and neither can be written twice.
 */
export function sinkFor(lessonId: string, turnId: string): EventSink {
  let ended = false;
  return {
    emit: (type, payload) => emit(lessonId, type, payload),
    emitUpdate: (seq, type, payload) => emitUpdate(lessonId, seq, type, payload),
    checkpoint: (seq, payload) => checkpoint(lessonId, seq, payload),
    emitEphemeral: (type, payload) => emitEphemeral(lessonId, type, payload),
    setSessionId: (id) => setSessionId(lessonId, id),
    endTurn: (payload) => {
      if (ended) return;
      ended = true;
      finishTurn(turnId, turnStatusOf(payload));
      emit(lessonId, 'turn_end', payload);
    },
  };
}

/**
 * A driver installed in place of the one the backend would pick. It exists for
 * tests and for `server/src/drivers/fake.ts`: no route, header, environment
 * variable or config file can set it, and the production dispatch still reads
 * `backend()`. It is also what keeps the import graph acyclic — this module
 * imports no driver; every driver imports it.
 */
let override: Driver | null = null;

export function setDriverOverride(d: Driver | null) {
  override = d;
}

export function driverOverride(): Driver | null {
  return override;
}
