import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

// prices.ts resolves PRICES_PATH from config.ts at import time, so the data
// directory has to be pinned to a scratch folder before anything under src/ is
// imported. Nothing in this suite may touch the developer's own ~/.derive, and
// nothing in it opens the database or the network: every module under test is
// pure, and the one that reads a file reads only the fixture written below.
const scratch = mkdtempSync(join(tmpdir(), 'derive-test-'));
process.env.DERIVE_DATA_DIR = scratch;

const { PRICES, PRICES_AS_OF, priceOf, windowOf } = await import('../src/pricing.js');
const { priceTable, pricesFileError, resetPriceCache } = await import('../src/prices.js');
const { PROVIDERS } = await import('../src/providers.js');

// A dynamic import cannot carry types across, and a static one would resolve
// PRICES_PATH before the scratch directory above is set; these are type
// positions only, so nothing is imported at run time.
type ModelPrice = import('../src/pricing.js').ModelPrice;

const PRICES_FILE = join(scratch, 'prices.json');

/** Write a fixture and drop the cache, so the next read goes to the file. */
const write = (body: string): void => {
  writeFileSync(PRICES_FILE, body);
  resetPriceCache();
};

/** Remove the fixture and drop the cache: the fresh-install case. */
const clear = (): void => {
  if (existsSync(PRICES_FILE)) unlinkSync(PRICES_FILE);
  resetPriceCache();
};

after(() => rmSync(scratch, { recursive: true, force: true }));

describe('the price table', () => {
  it('carries a rate for every catalogue model the app can actually teach on', () => {
    for (const p of PROVIDERS) {
      if (!p.teaches || !p.defaultModel) continue;
      assert.ok(priceOf(p.id, p.defaultModel), `${p.id}'s catalogue default ${p.defaultModel} has no row in PRICES; a default that drifts away from the table prices every lesson as unknown`);
    }
  });

  it('records the day the rates were checked', () => {
    assert.match(PRICES_AS_OF, /^\d{4}-\d{2}-\d{2}$/, 'PRICES_AS_OF must be a YYYY-MM-DD date, because COST-04 is the promise that the learner can see how old the figure is');
  });

  it('prices the Anthropic and the OpenRouter spelling of the same model separately', () => {
    assert.ok(priceOf('anthropic', 'claude-opus-5-5'), 'the native Anthropic id uses dashes');
    assert.ok(priceOf('openrouter', 'anthropic/claude-opus-5.5'), "OpenRouter's slug uses dots, and a learner may run either");
  });

  it('returns undefined rather than a record of zeros for anything it does not know', () => {
    assert.equal(priceOf('no-such-provider', 'claude-opus-5-5'), undefined, 'an unknown provider');
    assert.equal(priceOf('anthropic', null), undefined, 'a lesson whose model was never recorded');
    assert.equal(priceOf('anthropic', 'no-such-model'), undefined, 'a model absent from the table must price as unknown, never as free');
  });

  it('knows the window of a listed model and abstains on an unlisted one', () => {
    assert.equal(windowOf('anthropic', 'claude-opus-5-5'), 1_000_000);
    assert.equal(windowOf('openai-compatible', 'anything'), undefined, "the model behind a learner's own endpoint is not knowable from a table");
  });
});

describe('the override file', () => {
  it('is silent when it is absent', () => {
    clear();
    assert.deepEqual(priceTable(), PRICES, 'no file means the shipped table, unchanged');
    assert.equal(pricesFileError(), null, 'a fresh install has no prices.json, and that is a fact rather than a fault');
  });

  it('lays one model over the shipped table and leaves its siblings alone', () => {
    write(JSON.stringify({ anthropic: { 'claude-opus-5-5': { input: 0.000009 } } }));
    const table = priceTable();
    assert.equal(pricesFileError(), null, 'a well-formed file reports no error');
    assert.equal(table.anthropic?.['claude-opus-5-5']?.input, 0.000009, 'the named rate is the one the learner wrote');
    assert.equal(table.anthropic?.['claude-opus-5-5']?.output, PRICES.anthropic?.['claude-opus-5-5']?.output, 'a field the learner did not name keeps the shipped value');
    assert.deepEqual(table.anthropic?.['claude-sonnet-5-5'], PRICES.anthropic?.['claude-sonnet-5-5'], 'naming one model must not delete its siblings');
    assert.deepEqual(table.openai, PRICES.openai, 'naming one provider must not delete the others');
  });

  it('merges nothing and says why when the file is not valid JSON', () => {
    write('not json at all');
    assert.deepEqual(priceTable(), PRICES, 'nothing merges while the error stands');
    const error = pricesFileError() ?? '';
    assert.ok(error.includes(PRICES_FILE), `the sentence must name the path; got ${error}`);
    assert.ok(error.includes('not valid JSON'), `the sentence must say what is wrong; got ${error}`);
  });

  it('merges nothing and names the model and the field when a rate is negative', () => {
    write(JSON.stringify({ anthropic: { 'claude-opus-5-5': { input: -1, output: 0.00002 } } }));
    assert.deepEqual(priceTable(), PRICES, 'a malformed file must never make a paid lesson read as free');
    const error = pricesFileError() ?? '';
    assert.ok(error.includes('claude-opus-5-5'), `the sentence must name the model; got ${error}`);
    assert.ok(error.includes('input'), `the sentence must name the field; got ${error}`);
  });

  it('merges nothing when the top level is not a JSON object', () => {
    write(JSON.stringify([{ anthropic: {} }]));
    assert.deepEqual(priceTable(), PRICES);
    assert.ok((pricesFileError() ?? '').includes('not a JSON object'), 'an array at the top level is named for what it is');
  });

  it('serves the last read for a second rather than reading the file per call', () => {
    write(JSON.stringify({ anthropic: { 'claude-opus-5-5': { input: 0.000009 } } }));
    assert.equal(priceTable().anthropic?.['claude-opus-5-5']?.input, 0.000009);
    writeFileSync(PRICES_FILE, JSON.stringify({ anthropic: { 'claude-opus-5-5': { input: 0.000001 } } }));
    assert.equal(priceTable().anthropic?.['claude-opus-5-5']?.input, 0.000009, 'a second call inside the cache window must not have gone to disk');
    resetPriceCache();
    assert.equal(priceTable().anthropic?.['claude-opus-5-5']?.input, 0.000001, 'a call after the reset reads the file again');
    clear();
  });

  it('never hands back a rate record that is not fully populated', () => {
    clear();
    const price: ModelPrice | undefined = priceTable().anthropic?.['claude-opus-5-5'];
    assert.ok(price, 'the shipped Anthropic row survives the merge');
    assert.equal(typeof price?.input, 'number');
    assert.equal(typeof price?.output, 'number');
  });
});
