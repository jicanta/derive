import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

// actions.ts opens the database on import; point it at a scratch directory first.
process.env.DERIVE_DATA_DIR = mkdtempSync(join(tmpdir(), 'derive-test-'));
const { parseReply } = await import('../src/actions.js');

describe('parseReply for a quiz card', () => {
  it('reads a letter, a number, and several picks', () => {
    assert.deepEqual(parseReply('quiz', 'B', 3), { selected: [1], sure: true, note: undefined });
    assert.deepEqual(parseReply('quiz', '2.', 3), { selected: [1], sure: true, note: undefined });
    assert.deepEqual(parseReply('quiz', 'a and c', 3), { selected: [0, 2], sure: true, note: undefined });
  });

  it('flags an unsure pick', () => {
    assert.deepEqual(parseReply('quiz', 'B?', 3), { selected: [1], sure: false, note: undefined });
    assert.deepEqual(parseReply('quiz', 'I think B', 3), { selected: [1], sure: false, note: undefined });
    assert.deepEqual(parseReply('quiz', 'b, not sure but the slope has to be positive', 3), { selected: [1], sure: false, note: 'the slope has to be positive' });
  });

  it('treats "I don\'t know" as the don\'t-know option', () => {
    assert.deepEqual(parseReply('quiz', '?', 3), { idk: true, note: undefined });
    assert.deepEqual(parseReply('quiz', "I don't know, is it about the sign?", 3), { idk: true, note: 'is it about the sign?' });
  });

  it('treats a sentence as a message to the tutor, not a pick', () => {
    assert.deepEqual(parseReply('quiz', 'a car is not a fruit', 3), { steer: 'a car is not a fruit' });
    assert.deepEqual(parseReply('quiz', 'D', 3), { steer: 'D' });
  });
});

describe('parseReply for a plan card', () => {
  it('approves on yes and passes anything else back as feedback', () => {
    assert.deepEqual(parseReply('plan', 'yes', 0), { approved: true });
    assert.deepEqual(parseReply('plan', 'dale', 0), { approved: true });
    assert.deepEqual(parseReply('plan', 'swap the first two nodes', 0), { approved: false, feedback: 'swap the first two nodes' });
  });
});
