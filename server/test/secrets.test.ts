/**
 * Redaction, and the line it must not cross.
 *
 * Two halves. The first is that a registered secret cannot survive any
 * egress: not an event payload however deeply nested, not the rendered
 * Markdown the Obsidian vault gets, not an error body. The second, and the
 * one worth the most care, is that the key-shaped pattern backstop stays
 * where D-11 put it — on errors and logs, never on lesson content. Derive
 * teaches anything, including API security, so a lesson whose prose contains
 * `sk-ant-...` as a worked example has to reach the learner's durable record
 * byte for byte. A redactor that "helpfully" scrubs that is a defect.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, it } from 'node:test';

// db.ts opens the database on import, and events.ts pulls it in; point it at a scratch directory first.
process.env.DERIVE_DATA_DIR = mkdtempSync(join(tmpdir(), 'derive-secrets-'));

const { clearSecrets, redact, redactDeep, redactErrors, registerSecret, safeMessage, secretCount, REDACTED } = await import('../src/secrets.js');
const { emit } = await import('../src/events.js');
const { renderMarkdown } = await import('../src/export.js');
const { createLesson, getLesson, listEvents } = await import('../src/db.js');

const TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
/** A key-shaped string that is not a secret of this install: exactly what a lesson about API credentials would put on the page. */
const TEACHING_EXAMPLE = 'sk-ant-api03-EXAMPLEKEYFROMTHEDOCSf0r-teaching';

beforeEach(() => {
  clearSecrets();
});

describe('registering a secret', () => {
  it('ignores empty, blank and too-short values', () => {
    registerSecret('');
    registerSecret(' ');
    registerSecret('   \n\t ');
    registerSecret('abcde');
    registerSecret(null);
    registerSecret(undefined);
    assert.equal(secretCount(), 0);
  });

  it('takes a real one, once', () => {
    registerSecret(TOKEN);
    registerSecret(TOKEN);
    assert.equal(secretCount(), 1);
  });
});

describe('redact', () => {
  it('is a pass-through with nothing registered', () => {
    const prose = `Here is a key: ${TOKEN}, and here is ${TEACHING_EXAMPLE}.`;
    assert.equal(redact(prose), prose);
  });

  it('replaces every occurrence of a registered value', () => {
    registerSecret(TOKEN);
    assert.equal(redact(`${TOKEN} and again ${TOKEN}`), `${REDACTED} and again ${REDACTED}`);
  });

  it('leaves no fragment when one registered secret contains another', () => {
    const inner = 'abcdefghijklmnopqrstuvwx';
    const outer = `prefix-${inner}-suffix-padding`;
    registerSecret(inner);
    registerSecret(outer);
    const out = redact(`before ${outer} after ${inner} end`);
    assert.ok(!out.includes(inner), out);
    assert.ok(!out.includes(outer), out);
    assert.ok(!out.includes('prefix-'), out);
    assert.ok(!out.includes('-suffix-padding'), out);
    assert.equal(out, `before ${REDACTED} after ${REDACTED} end`);
  });

  it('walks into objects and arrays', () => {
    registerSecret(TOKEN);
    const out = redactDeep({ a: TOKEN, b: [1, TOKEN, { c: `x ${TOKEN} y` }], n: 3, t: true, z: null });
    assert.deepEqual(out, { a: REDACTED, b: [1, REDACTED, { c: `x ${REDACTED} y` }], n: 3, t: true, z: null });
  });
});

describe('the key-shaped backstop', () => {
  it('catches an unregistered key in an error message', () => {
    assert.ok(!redactErrors(`request failed with ${TEACHING_EXAMPLE}`).includes(TEACHING_EXAMPLE));
    assert.ok(!redactErrors('authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9').includes('eyJhbGciOiJIUzI1NiI'));
    assert.ok(!redactErrors('key AIzaSyA1B2C3D4E5F6G7H8I9J0KLMNOPQRSTUV rejected').includes('AIzaSyA1B2C3D4E5F6G7H8I9J0KLMNOPQRSTUV'));
    assert.ok(!redactErrors('sk-proj-0123456789abcdefghijklmnop was refused').includes('sk-proj-0123456789abcdefghijklmnop'));
  });

  it('is the only thing doing pattern matching: plain redact leaves a key-shaped string alone', () => {
    const prose = `An Anthropic key looks like ${TEACHING_EXAMPLE}.`;
    assert.equal(redact(prose), prose);
  });

  it('keeps the word Bearer so the message still reads', () => {
    assert.match(redactErrors('sent Bearer abcdefghijklmnopqrstuvwxyz'), /Bearer \[redacted\]/);
  });

  it('safeMessage narrows and redacts a caught value', () => {
    registerSecret(TOKEN);
    assert.equal(safeMessage(new Error(`bad token ${TOKEN}`)), `bad token ${REDACTED}`);
    assert.ok(!safeMessage(`raw ${TEACHING_EXAMPLE}`).includes(TEACHING_EXAMPLE));
  });
});

describe('every egress', () => {
  it('takes a registered secret out of an event, however deeply it sits', () => {
    registerSecret(TOKEN);
    const lesson = createLesson(randomUUID(), 'redaction', { mode: 'external' });
    emit(lesson.id, 'assistant', { text: `the token is ${TOKEN}`, extra: { list: [TOKEN] } });
    const stored = listEvents(lesson.id).at(-1)!;
    assert.deepEqual(stored.payload, { text: `the token is ${REDACTED}`, extra: { list: [REDACTED] } });
    assert.ok(!JSON.stringify(listEvents(lesson.id)).includes(TOKEN));
  });

  it('takes it out of the rendered Markdown the vault gets', () => {
    registerSecret(TOKEN);
    const lesson = createLesson(randomUUID(), 'redaction export', { mode: 'external' });
    emit(lesson.id, 'assistant', { text: `secret ${TOKEN} here` });
    const md = renderMarkdown(getLesson(lesson.id)!);
    assert.ok(!md.includes(TOKEN));
    assert.ok(md.includes(REDACTED));
  });

  it('round-trips a payload deep-equal when nothing is registered', () => {
    const payload = { text: `a key like ${TEACHING_EXAMPLE} and a token like ${TOKEN}`, n: 7, deep: { arr: [TOKEN, 1, null] } };
    const lesson = createLesson(randomUUID(), 'no secrets', { mode: 'external' });
    const ev = emit(lesson.id, 'assistant', payload);
    assert.deepEqual(ev.payload, payload);
    assert.deepEqual(listEvents(lesson.id).at(-1)!.payload, payload);
  });
});

describe('a lesson that teaches about credentials', () => {
  it('survives byte-intact through the event stream and the vault, and is still cleaned out of an error body', () => {
    registerSecret(TOKEN);
    const prose = `An Anthropic key is a string beginning \`sk-ant-\`, for example ${TEACHING_EXAMPLE}. Never paste one into a chat.`;
    const lesson = createLesson(randomUUID(), 'api keys', { mode: 'external' });
    emit(lesson.id, 'assistant', { text: prose });

    // The learner's live view and the database.
    assert.equal((listEvents(lesson.id).at(-1)!.payload as { text: string }).text, prose);

    // The learner's durable Obsidian record.
    const md = renderMarkdown(getLesson(lesson.id)!);
    assert.ok(md.includes(TEACHING_EXAMPLE), 'the teaching example must reach the vault unharmed');

    // And an error body, where the backstop does apply.
    assert.ok(!safeMessage(new Error(`upstream rejected ${TEACHING_EXAMPLE}`)).includes(TEACHING_EXAMPLE));
  });
});
