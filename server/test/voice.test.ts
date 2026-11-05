/**
 * Voice, tested from the server package because `web/` has no test runner — no
 * `test` script, no `tsx` in its dependencies — while `voice.ts` guards every
 * browser touch (`typeof window === 'undefined'`, `typeof navigator !==
 * 'undefined'`, the `voiceschanged` listener behind `voiceSupport.speak`), so
 * the module loads and its pure halves run under plain node. Moving this file
 * into `web/` would cost a dependency, a script and a CI step for a cosmetic
 * win: it lives here on purpose, and `node --import tsx --test` resolves the
 * cross-package import for free.
 *
 * What is covered: the sentence splitter the streaming chunks are built on, the
 * committed name→BCP-47 table `prefs.language` is resolved through, and the two
 * shipped pure helpers (`spokenText`, `parseSpokenChoice`). What is not: the
 * speech engines themselves. `speechSynthesis` and `SpeechRecognition` are
 * absent here by definition, so mic arming and voice selection are a human
 * check in a real browser, not this file's claim.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LOCALES, LOCALES_AS_OF, localeOf } from '../../web/src/lib/locales';
import { parseSpokenChoice, sentences, spokenText, voiceSupport } from '../../web/src/lib/voice';

describe('voiceSupport', () => {
  it('reports no speech engine under node, which is why only the pure halves are asserted here', () => {
    assert.equal(voiceSupport.speak, false);
    assert.equal(voiceSupport.listen, false);
  });
});

describe('spokenText', () => {
  it('reads markdown as prose: no heading marks, no emphasis, a blank line as a full stop', () => {
    assert.equal(spokenText('# Hi\n\n**there**'), 'Hi. there');
  });
});

describe('parseSpokenChoice', () => {
  it('takes "option B" as the second option', () => {
    assert.deepEqual(parseSpokenChoice('option B', 3), { index: 1 });
  });
});

describe('sentences', () => {
  it('splits after a full stop but not inside a decimal', () => {
    const text = 'Pi is 3.14 and that is that. Next one.';
    const { complete, next } = sentences(text, 0);
    assert.deepEqual(complete, ['Pi is 3.14 and that is that.', 'Next one.']);
    assert.equal(next, text.length);
  });

  it('does not say a sentence shorter than the floor on its own: "Yes." waits for the next one', () => {
    const text = 'Yes. The sum of two even numbers is even.';
    const { complete, next } = sentences(text, 0);
    assert.deepEqual(complete, ['Yes. The sum of two even numbers is even.']);
    assert.equal(next, text.length);
  });

  it('returns nothing for a trailing fragment, and consumes none of it', () => {
    assert.deepEqual(sentences('An incomplete frag', 0), { complete: [], next: 0 });
  });

  it('does not split an abbreviation or an initialism', () => {
    assert.deepEqual(sentences('Take e.g. the even numbers, which are closed under addition.', 0).complete, [
      'Take e.g. the even numbers, which are closed under addition.',
    ]);
    assert.deepEqual(sentences('The U.S. uses the same notation as everyone else does.', 0).complete, ['The U.S. uses the same notation as everyone else does.']);
  });

  it('says each sentence exactly once as a block grows', () => {
    // The 60 ms delta flush and the rewrite-under-the-original-seq both hand
    // the hook the same block with more text; the offset is what makes that
    // idempotent, and nothing may be said twice or skipped.
    const whole = 'The derivative of a constant is zero. That is the first thing to see. Now the product rule.';
    let from = 0;
    const said: string[] = [];
    for (const upto of [20, 45, 70, whole.length]) {
      const r = sentences(whole.slice(0, upto), from);
      said.push(...r.complete);
      from = r.next;
    }
    assert.equal(said.join(' '), whole);
    assert.equal(from, whole.length);
  });
});

describe('localeOf', () => {
  it('resolves an English name, an endonym, and the same endonym shouted and padded', () => {
    assert.equal(localeOf('Spanish'), 'es');
    assert.equal(localeOf('español'), 'es');
    assert.equal(localeOf(' ESPAÑOL '), 'es');
  });

  it('keeps a regional variant distinct from its language', () => {
    assert.equal(localeOf('Brazilian Portuguese'), 'pt-BR');
    assert.equal(localeOf('Portuguese'), 'pt');
  });

  it('returns null for a name it does not know, so the caller falls back to navigator.language', () => {
    assert.equal(localeOf('Klingon'), null);
    assert.equal(localeOf(''), null);
  });
});

describe('LOCALES', () => {
  it('every tag is a BCP-47 tag the platform can parse', () => {
    const tags = Object.entries(LOCALES);
    assert.ok(tags.length >= 20, `expected the languages the method already reaches for, got ${tags.length}`);
    for (const [name, tag] of tags) assert.doesNotThrow(() => new Intl.Locale(tag), `${name} → ${tag}`);
  });

  it('carries an as-of date, like the prices table whose discipline it copies', () => {
    assert.match(LOCALES_AS_OF, /^\d{4}-\d{2}-\d{2}$/);
  });
});
