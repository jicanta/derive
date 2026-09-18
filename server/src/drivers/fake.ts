/**
 * A driver that talks to no model: it replays a scripted sequence of sink
 * calls and resolves.
 *
 * This is a permanent fixture, not a throwaway. It is the proof that the
 * driver seam holds: a third driver that is not a provider at all reaches the
 * learner through the same `runTurn(ctx, sink)` and the same event sink as
 * the Claude and Codex paths, and the web app, the SSE stream and the
 * terminal mirrors cannot tell the difference. It also makes the whole turn
 * path — turn_start, a growing assistant block, a status line, a session id,
 * turn_end — testable with no login, no network and no model, which is what
 * `server/test/driver.test.ts` drives.
 *
 * It imports no SDK and performs no I/O beyond the sink it is handed.
 */
import { type UsageInput } from '../db.js';
import { type Driver, type EventSink, type TurnContext } from '../driver.js';

/** One thing a driver does. The union covers the sink calls a real driver makes, and nothing else. */
export type FakeStep =
  /** A text block starts: persisted at once so a stop or a restart keeps it. */
  | { kind: 'block_start'; id: string }
  /** The block grows: fanned out as a delta and checkpointed in place. */
  | { kind: 'block_delta'; text: string }
  /** The block is final: rewritten under its original seq. */
  | { kind: 'block_end' }
  /** A status line the learner sees while the turn runs. */
  | { kind: 'status'; text: string }
  /** The provider's conversation id, so the next turn resumes. */
  | { kind: 'session'; id: string }
  /** What one model request cost, as a real driver reports it once per request. */
  | { kind: 'usage'; row: UsageInput }
  /** The turn's result. */
  | { kind: 'end'; payload: Record<string, unknown> };

const script: FakeStep[] = [];

/** Set what the next turn on the fake driver does. Replaces any script left by an earlier test. */
export function setFakeScript(steps: FakeStep[]) {
  script.length = 0;
  script.push(...steps);
}

export const fakeDriver: Driver = {
  name: 'fake',
  async runTurn(_ctx: TurnContext, sink: EventSink) {
    let blockId: string | null = null;
    let blockSeq: number | null = null;
    let blockText = '';
    const steps = script.splice(0, script.length);
    for (const step of steps) {
      switch (step.kind) {
        case 'block_start':
          blockId = step.id;
          blockText = '';
          blockSeq = sink.emit('assistant', { id: blockId, text: '', partial: true }).seq;
          break;
        case 'block_delta':
          if (!blockId || blockSeq === null) throw new Error('fake driver: a block delta with no block started');
          blockText += step.text;
          sink.emitEphemeral('delta', { id: blockId, text: step.text });
          sink.checkpoint(blockSeq, { id: blockId, text: blockText, partial: true });
          break;
        case 'block_end':
          if (!blockId || blockSeq === null) throw new Error('fake driver: a block end with no block started');
          sink.emitUpdate(blockSeq, 'assistant', { id: blockId, text: blockText });
          blockId = null;
          blockSeq = null;
          blockText = '';
          break;
        case 'status':
          sink.emitEphemeral('status', { text: step.text });
          break;
        case 'session':
          sink.setSessionId(step.id);
          break;
        case 'usage':
          sink.usage(step.row);
          break;
        case 'end':
          sink.endTurn(step.payload);
          break;
      }
    }
  },
};
