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
const { costLabel, costOf, weakestSource } = await import('../src/cost.js');
const { CHARS_PER_TOKEN, HEADROOM_FRACTION, estimateTokens, headroomCheck } = await import('../src/context.js');

// A dynamic import cannot carry types across, and a static one would resolve
// PRICES_PATH before the scratch directory above is set; these are type
// positions only, so nothing is imported at run time. db.ts is never imported
// as a value anywhere in this suite — cost.ts takes its row types with `import
// type`, which is what keeps the database out of the cost path.
type ModelPrice = import('../src/pricing.js').ModelPrice;
type CostRow = import('../src/cost.js').CostRow;

const PRICES_FILE = join(scratch, 'prices.json');

/** The verbatim refusal from 03-UI-SPEC.md §Copywriting Contract → Context-window refusal (A6). */
const REFUSAL = 'This lesson has grown too long to continue. Everything you locked is saved — start a review lesson on these nodes from Home.';

/** A usage row built by hand: every field present, nothing read from a database. */
const row = (over: Partial<CostRow> = {}): CostRow => ({
  id: 1,
  turn_id: 'turn-1',
  lesson_id: 'lesson-1',
  learner_id: 'me',
  driver: 'anthropic',
  model: 'claude-opus-5-5',
  input_tokens: null,
  output_tokens: null,
  cache_read_tokens: null,
  cache_write_tokens: null,
  reasoning_tokens: null,
  cost_source: 'table',
  cost_usd: null,
  ts: 0,
  ...over,
});

/** Money is summed in floating point, so compare to the cent-fraction rather than to the bit. */
const close = (actual: number | null, expected: number, message: string): void => {
  assert.ok(actual !== null && Math.abs(actual - expected) < 1e-12, `${message} (expected ≈ ${expected}, got ${actual})`);
};

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

  it('ships no row that would price a lesson at nothing', () => {
    for (const [provider, models] of Object.entries(PRICES)) {
      for (const [model, price] of Object.entries(models)) {
        assert.ok(price.input > 0, `${provider} ${model} has a zero input rate, which renders as a free lesson on a metered key`);
        assert.ok(price.output > 0, `${provider} ${model} has a zero output rate`);
        assert.ok(price.context === null || price.context > 0, `${provider} ${model} has a zero context window, which would refuse every turn`);
      }
    }
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

  it('merges nothing when a rate is a string, infinite or absent on a model the table does not carry', () => {
    write(JSON.stringify({ anthropic: { 'claude-opus-5-5': { input: '0.000004' } } }));
    assert.deepEqual(priceTable(), PRICES, 'a quoted number is not a number');
    assert.ok((pricesFileError() ?? '').includes('input'), 'the sentence names the field');

    // JSON has no Infinity literal; 1e999 is how one arrives, and it must fail the same way a negative does.
    write('{"anthropic":{"claude-opus-5-5":{"input":1e999}}}');
    assert.deepEqual(priceTable(), PRICES, 'an infinite rate is not a rate');
    assert.ok((pricesFileError() ?? '').includes('claude-opus-5-5'), 'the sentence names the model');

    write(JSON.stringify({ anthropic: { 'claude-opus-9': { output: 0.00002 } } }));
    assert.deepEqual(priceTable(), PRICES, 'a model the shipped table has never heard of must bring both of its own rates');
    assert.ok((pricesFileError() ?? '').includes('input'), 'the sentence names the rate that is missing');
  });

  it('merges nothing when the file names a provider Derive does not have', () => {
    write(JSON.stringify({ 'anthropik-typo': { 'claude-opus-5-5': { input: 0.000004, output: 0.00002 } } }));
    assert.deepEqual(priceTable(), PRICES, 'a typo in a provider id must not silently cost the learner their other overrides');
    assert.ok((pricesFileError() ?? '').includes('anthropik-typo'), 'the sentence names the id so it can be fixed');
  });

  it('merges nothing when a model entry is not an object of rates', () => {
    write(JSON.stringify({ anthropic: { 'claude-opus-5-5': 0.000004 } }));
    assert.deepEqual(priceTable(), PRICES);
    assert.ok((pricesFileError() ?? '').includes('not a JSON object'), 'a bare number where a rate record belongs is named for what it is');
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

describe('the cost arithmetic and the money string', () => {
  it('shows no figure for a lesson that has not run a turn', () => {
    assert.deepEqual(costOf([], PRICES), { usd: null, source: 'unknown' }, 'no rows means no figure, not a zero');
  });

  it("takes the provider's own figure without consulting the table", () => {
    const reported = row({ cost_source: 'provider', cost_usd: 0.0123, model: 'a-model-no-table-has-ever-heard-of', input_tokens: 9_000_000 });
    assert.deepEqual(costOf([reported], PRICES), { usd: 0.0123, source: 'provider' }, 'a figure the provider billed outranks anything a table could say');
  });

  it('prices a lesson from the table when the provider reported no figure', () => {
    const priced = row({ cost_source: 'table', input_tokens: 1000, output_tokens: 500, cache_read_tokens: 2000, cache_write_tokens: 100 });
    const cost = costOf([priced], PRICES);
    assert.equal(cost.source, 'table');
    // 1000 × $0.000004 + 500 × $0.00002 + 2000 × $0.0000002 + 100 × $0.000005
    close(cost.usd, 0.0149, 'the four token columns are priced at their own four rates');
  });

  it('counts a null token column as nothing rather than guessing at it', () => {
    const partial = row({ cost_source: 'table', input_tokens: 1000, output_tokens: null, cache_read_tokens: null, cache_write_tokens: null });
    close(costOf([partial], PRICES).usd, 0.004, 'only the column that was reported is priced');
  });

  it("folds a native search's per-call charge into the same total", () => {
    const searched = row({ cost_source: 'table', input_tokens: 1000, searches: 2 });
    close(costOf([searched], PRICES).usd, 0.004 + 0.02, 'two searches at $0.01 a call land in the lesson total rather than vanishing from it');
  });

  it('contributes no money and carries unknown for a model the table does not have', () => {
    const unlisted = row({ cost_source: 'table', model: 'some-local-gguf', driver: 'ollama', input_tokens: 500_000 });
    assert.deepEqual(costOf([unlisted], PRICES), { usd: null, source: 'unknown' }, 'an unpriceable request must not be priced as free');
  });

  it('never prices a request the provider reported nothing for', () => {
    const silent = row({ cost_source: 'unknown', input_tokens: null, output_tokens: null, cache_read_tokens: null, cache_write_tokens: null });
    assert.deepEqual(costOf([silent], PRICES), { usd: null, source: 'unknown' }, 'no counts and no figure is a blank, not a zero');
  });

  it('lets the weakest source in the lesson decide the word, whatever order the rows arrive in', () => {
    const cases: [import('../src/db.js').CostSource[], string][] = [
      [['provider', 'provider'], 'provider'],
      [['subscription', 'subscription'], 'subscription'],
      [['provider', 'table'], 'table'],
      [['provider', 'subscription'], 'table'],
      [['provider', 'unknown'], 'unknown'],
      [['table', 'unknown'], 'unknown'],
    ];
    for (const [sources, expected] of cases) {
      assert.equal(weakestSource(sources), expected, `${sources.join(' + ')} should read ${expected}`);
      assert.equal(weakestSource([...sources].reverse()), expected, `${sources.join(' + ')} reversed should still read ${expected}`);
    }
  });

  it('takes the whole lesson down to its weakest row', () => {
    const billed = row({ cost_source: 'provider', cost_usd: 0.09 });
    const estimated = row({ cost_source: 'table', input_tokens: 1000 });
    const cost = costOf([billed, estimated], PRICES);
    assert.equal(cost.source, 'table', 'a subscription or billed lesson that ran one table-priced turn reads estimated');
    close(cost.usd, 0.09 + 0.004, 'both halves are still in the total');
  });

  it('says the four words and nothing else', () => {
    assert.equal(costLabel(null, 'unknown'), 'not reported');
    assert.equal(costLabel(0, 'subscription'), 'not billed');
    assert.equal(costLabel(0.42, 'subscription'), 'not billed', 'a subscription path never carries a figure');
    assert.equal(costLabel(0.42, 'unknown'), 'not reported', 'an unreported path never carries a figure');
    assert.equal(costLabel(0.14, 'table'), 'about $0.14 estimated');
    assert.equal(costLabel(0.14, 'provider'), 'about $0.14 billed');
  });

  it('floors a sub-cent lesson at under $0.01 rather than rounding it to nothing', () => {
    assert.equal(costLabel(0, 'provider'), 'billed', 'exactly zero shows its label and no figure');
    assert.equal(costLabel(0.004, 'provider'), 'under $0.01 billed', 'a metered lesson under a cent must not read as free');
    assert.equal(costLabel(0.005, 'provider'), 'about $0.01 billed', 'toFixed(2) renders 0.005 as 0.01, so the boundary sits on the about side');
    assert.equal(costLabel(0.004, 'table'), 'under $0.01 estimated');
  });

  it('returns null rather than an empty string when there is nothing to say', () => {
    assert.equal(costLabel(null, null), null, 'a lesson with no usage rows renders no segment at all, not an empty one');
  });
});

describe('the estimator', () => {
  it('over-counts tokens on purpose', () => {
    assert.equal(estimateTokens(''), 0);
    assert.equal(estimateTokens('x'.repeat(300)), 100, 'three characters per token, where English runs nearer four');
    assert.equal(CHARS_PER_TOKEN, 3);
    assert.equal(HEADROOM_FRACTION, 0.8);
  });

  it('lets a prompt through while it is under the headroom', () => {
    const window = windowOf('anthropic', 'claude-opus-5-5') ?? 0;
    const chars = Math.floor(window * HEADROOM_FRACTION * CHARS_PER_TOKEN) - 3000;
    assert.deepEqual(headroomCheck({ provider: 'anthropic', model: 'claude-opus-5-5', instructions: '', messages: '', prompt: 'x'.repeat(chars), tools: '' }, PRICES), { refuse: false });
  });

  it('refuses before the request once the prompt passes the headroom', () => {
    const window = windowOf('anthropic', 'claude-opus-5-5') ?? 0;
    const chars = Math.ceil(window * HEADROOM_FRACTION * CHARS_PER_TOKEN) + 3000;
    const check = headroomCheck({ provider: 'anthropic', model: 'claude-opus-5-5', instructions: 'x'.repeat(chars), messages: '', prompt: '', tools: '' }, PRICES);
    assert.equal(check.refuse, true, 'a prompt past 80% of a known window is refused with Derive own sentence rather than the provider error');
    assert.equal(check.refuse === true ? check.reason : null, REFUSAL, 'the sentence is the UI-SPEC copy, byte for byte');
  });

  it('sums the three texts rather than measuring only the newest one', () => {
    const window = windowOf('anthropic', 'claude-opus-5-5') ?? 0;
    const third = Math.ceil((window * HEADROOM_FRACTION * CHARS_PER_TOKEN) / 3) + 1000;
    const check = headroomCheck({ provider: 'anthropic', model: 'claude-opus-5-5', instructions: 'x'.repeat(third), messages: 'y'.repeat(third), prompt: 'z'.repeat(third), tools: '' }, PRICES);
    assert.equal(check.refuse, true, 'the system prompt, the history and the new message all occupy the window');
  });

  it('abstains rather than guessing when the window is not in the table', () => {
    const check = headroomCheck({ provider: 'openai-compatible', model: 'some-endpoint-model', instructions: 'x'.repeat(8_000_000), messages: '', prompt: '', tools: '' }, PRICES);
    assert.deepEqual(check, { refuse: false }, "refusing a learner's perfectly capable endpoint on a guessed window would be worse than letting that endpoint's own error through");
  });

  it('counts the serialised tool surface, which a small local window is a fifth of', () => {
    // The gap PROV-06 exists to close: the sixteen `api` tools are 3,349
    // estimated tokens in the compact dialect, 20% of a 16,384 window the
    // estimate used to be blind to. The same text is allowed as `prompt` and
    // refused as `tools` only if `tools` is not counted at all.
    const window = 16_384;
    const under = Math.floor(window * HEADROOM_FRACTION * CHARS_PER_TOKEN) - 300;
    const allowed = headroomCheck({ provider: 'ollama', model: 'a-local-model', instructions: 'x'.repeat(under), messages: '', prompt: '', tools: '', window }, PRICES);
    assert.deepEqual(allowed, { refuse: false }, 'the case rests on the instructions alone fitting');

    const refused = headroomCheck({ provider: 'ollama', model: 'a-local-model', instructions: 'x'.repeat(under), messages: '', prompt: '', tools: 'y'.repeat(3_000), window }, PRICES);
    assert.equal(refused.refuse, true, 'the tool text the request carries must count toward the estimate');
  });

  it('allows an estimate exactly at the headroom and refuses one token over', () => {
    // 20480 rather than the 16384 floor because 16384 × 0.8 × 3 is 39321.6: the
    // boundary is only observable at a window whose headroom lands on a whole
    // number of characters, and 20480 × 0.8 × 3 = 49152 exactly.
    const window = 20_480;
    const exact = window * HEADROOM_FRACTION * CHARS_PER_TOKEN;
    assert.ok(Number.isInteger(exact), 'the boundary case rests on the headroom landing on a whole number of characters');
    assert.deepEqual(
      headroomCheck({ provider: 'ollama', model: 'a-local-model', instructions: 'x'.repeat(exact), messages: '', prompt: '', tools: '', window }, PRICES),
      { refuse: false },
      'exactly at the headroom is inside it: the comparison is <=',
    );
    const over = headroomCheck({ provider: 'ollama', model: 'a-local-model', instructions: 'x'.repeat(exact), messages: '', prompt: '', tools: 'x'.repeat(CHARS_PER_TOKEN), window }, PRICES);
    assert.equal(over.refuse, true, 'one estimated token past the headroom is refused');
  });

  it('lets a caller-supplied window outrank a table row for the same provider and model', () => {
    const big = windowOf('anthropic', 'claude-opus-5-5') ?? 0;
    assert.equal(big, 1_000_000, 'the precedence case rests on the table carrying a large window for this model');
    const chars = Math.ceil(16_384 * HEADROOM_FRACTION * CHARS_PER_TOKEN) + 3_000;

    // Under the table's million-token window, so the table alone would allow it.
    assert.deepEqual(
      headroomCheck({ provider: 'anthropic', model: 'claude-opus-5-5', instructions: 'x'.repeat(chars), messages: '', prompt: '', tools: '' }, PRICES),
      { refuse: false },
      'the listed window is what the table-only path measures against',
    );

    // A window the caller observed is an observation rather than a listing, so
    // it wins — and the refusal it produces is the num_ctx one, not the
    // lesson-growth one.
    const check = headroomCheck({ provider: 'anthropic', model: 'claude-opus-5-5', instructions: 'x'.repeat(chars), messages: '', prompt: '', tools: '', window: 16_384 }, PRICES);
    assert.equal(check.refuse, true, 'a caller-supplied window takes precedence over the table');
    const reason = check.refuse === true ? check.reason : '';
    assert.ok(reason.includes('Settings'), 'a window the learner set is raised in Settings');
    assert.ok(!reason.includes('Home'), 'the two refusals carry one link each and must never be conflated');
  });

  it('still abstains when neither the table nor the caller has a window', () => {
    const check = headroomCheck({ provider: 'llamacpp', model: 'a-model-the-server-was-started-with', instructions: 'x'.repeat(8_000_000), messages: '', prompt: '', tools: '' }, PRICES);
    assert.deepEqual(check, { refuse: false }, 'a local server whose capability read found no window abstains exactly as an unlisted endpoint does');
  });
});
