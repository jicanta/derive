/**
 * What learning has cost this learner, as the Usage page reads it.
 *
 * The lesson header answers one lesson; this answers all of them. It is the
 * same question asked at a different grain, so it is the same arithmetic:
 * `costOf` prices a set of rows and `costLabel` turns the pair into the one
 * sentence a learner reads. Nothing here invents a second way to say what a
 * figure is worth, and nothing here formats money — a page that formatted its
 * own would be the day the header and the total start disagreeing.
 *
 * It lives in its own module rather than in `cost.ts`, which is pure by design
 * (no SQL, no clock, every case readable from literals in a test), and rather
 * than in `index.ts`, which starts a server. That is `lessonCost`'s reason in
 * `drivers/api.ts` too; the only difference is the filter.
 *
 * One read, not one per group. `listUsage({ learner })` goes through the
 * `usage_learner (learner_id, ts)` index and the grouping happens in memory
 * over that one result, because `node:sqlite` is synchronous and a query per
 * provider would block the event loop once per group for a page that shows a
 * total.
 *
 * Every line is composed here rather than in the browser, counts and nouns
 * included. The UI contract fixes the label vocabulary at four words and says
 * money is produced once, server-side; carrying a raw number to the page and
 * letting it decide how to print it is how a second vocabulary starts. So the
 * page prints strings, and the only numbers on the wire are the counts a test
 * asserts against.
 *
 * The provider word comes from the catalogue through `labelOf`, so a line on a
 * non-Ollama local server reads `lm studio` or `llama.cpp` rather than being
 * mislabelled as the one local provider everybody has heard of.
 */
import { costLabel, costOf } from './cost.js';
import { getLesson, listUsage, type UsageRow } from './db.js';
import { priceTable } from './prices.js';
import { labelOf, providerOfDriver } from './providers.js';

/** One lesson's line, under the model it ran on. */
export type UsageLesson = {
  /** The lesson this cost belongs to, so the line can be followed back to it. */
  id: string;
  /** What the lesson is about; the lesson's own id when the row has outlived it. */
  topic: string;
  /** The whole line as the learner reads it, already composed. */
  line: string;
  /** The lesson's own label, produced by `costLabel`. */
  cost: string | null;
  /** The tokens this lesson reported on this model, or null when nothing was reported. */
  tokens: number | null;
};

/** One model under a provider, with the lessons it taught. */
export type UsageModel = {
  /** The model id verbatim — on llama.cpp started without `--alias` this is a file path, which is why the page truncates it. */
  model: string | null;
  line: string;
  cost: string | null;
  tokens: number | null;
  /** How many distinct lessons ran on this model. */
  lessons: number;
  rows: UsageLesson[];
};

/** One provider group: the catalogue id, the word a learner reads, and the models beneath it. */
export type UsageGroup = {
  /** The catalogue id, which is also the key the page renders this group under. */
  provider: string;
  /** The word a learner reads, lowercased for the line: `ollama`, `lm studio`, `llama.cpp`. */
  label: string;
  line: string;
  cost: string | null;
  tokens: number | null;
  lessons: number;
  models: UsageModel[];
};

/**
 * The whole page in one read. `total` is null only when this learner has no
 * usage rows at all, which is the page's unambiguous empty signal — it is
 * never a zero standing in for an unknown.
 */
export type UsageView = {
  /** The grand total over every row, labelled by the same function every line uses, or null when there is nothing to say. */
  total: string | null;
  /** The one line under the total: how many lessons and how many tokens it covers. Null when there is nothing to say. */
  summary: string | null;
  /** How many distinct lessons have a usage row. Zero is the empty case. */
  lessons: number;
  /** Every token reported across every provider, or null when nothing was reported anywhere. */
  tokens: number | null;
  groups: UsageGroup[];
};

/**
 * What one request reported, or null when it reported nothing.
 *
 * Reasoning tokens are deliberately left out of the sum: every adapter reports
 * them as a component of the output count, so adding them would charge the
 * learner's eye for the same tokens twice. A row with no counts at all stays
 * null rather than becoming a zero — the same discipline `recordUsage` keeps
 * on the way in, because a blank read as a measured zero is the lie this whole
 * path exists to avoid.
 */
const tokensOf = (r: UsageRow): number | null => {
  const parts = [r.input_tokens, r.output_tokens, r.cache_read_tokens, r.cache_write_tokens].filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  return parts.length ? parts.reduce((a, b) => a + b, 0) : null;
};

/** The tokens a set of rows reported. Null when not one of them reported a count, so a group of silent rows never reads as a group that cost nothing. */
const sumTokens = (rows: readonly UsageRow[]): number | null => {
  let total: number | null = null;
  for (const r of rows) {
    const t = tokensOf(r);
    if (t !== null) total = (total ?? 0) + t;
  }
  return total;
};

/** A count with its own thousands separators rather than `toLocaleString`'s, whose output changes with the process locale and would make one install's page disagree with another's. */
const digits = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** A count and its noun, singular at one. The page never does this: a browser that pluralises is a browser that has started composing copy. */
const plural = (n: number, noun: string): string => `${digits(n)} ${noun}${n === 1 ? '' : 's'}`;

/** The segments of a line, joined the way the copy contract joins them, with anything absent left out rather than rendered empty. */
const compose = (...parts: (string | null)[]): string => parts.filter((p): p is string => !!p).join(' · ');

/**
 * The tokens segment, shown only where there is no money.
 *
 * A priced line already says what it cost; repeating the raw counts beside the
 * figure is noise. A subscription or local line has no figure at all, and the
 * token count is the only thing it can honestly report — which is exactly what
 * the copy contract asks for on those two lines.
 */
const tokenSegment = (tokens: number | null, cost: string | null): string | null => {
  if (tokens === null || cost?.includes('$')) return null;
  return plural(tokens, 'token');
};

/** The label for a set of rows. A set with no rows has no source, so `costLabel` answers null and the caller renders no segment instead of an empty one. */
const labelFor = (rows: readonly UsageRow[]): string | null => {
  const { usd, source } = costOf(rows, priceTable());
  return costLabel(usd, rows.length ? source : null);
};

/** How many distinct lessons a set of rows belongs to. */
const lessonsIn = (rows: readonly UsageRow[]): number => new Set(rows.map((r) => r.lesson_id)).size;

/** Rows keyed in first-seen order, which the callers then sort by recency. */
function groupBy<K>(rows: readonly UsageRow[], key: (r: UsageRow) => K): Map<K, UsageRow[]> {
  const out = new Map<K, UsageRow[]>();
  for (const r of rows) {
    const k = key(r);
    const got = out.get(k);
    if (got) got.push(r);
    else out.set(k, [r]);
  }
  return out;
}

/** The most recent moment a set of rows was written, which is what the page orders by: what a learner just ran is what they came to look at. */
const latest = (rows: readonly UsageRow[]): number => rows.reduce((n, r) => (r.ts > n ? r.ts : n), 0);

/**
 * The learner's running total, by provider, then model, then lesson.
 *
 * Scoped by the caller, never by anything a request carried: `index.ts`
 * resolves the learner and hands the id in, exactly as `recordUsage` takes the
 * learner off the turn on the way in.
 */
export function learnerUsage(learnerId: string): UsageView {
  const rows = listUsage({ learner: learnerId });
  if (!rows.length) return { total: null, summary: null, lessons: 0, tokens: null, groups: [] };

  const total = labelFor(rows);
  const tokens = sumTokens(rows);
  const lessons = lessonsIn(rows);

  const groups: UsageGroup[] = [...groupBy(rows, (r) => providerOfDriver(r.driver))]
    .sort((a, b) => latest(b[1]) - latest(a[1]))
    .map(([provider, ofProvider]) => {
      const groupCost = labelFor(ofProvider);
      const groupTokens = sumTokens(ofProvider);
      const groupLessons = lessonsIn(ofProvider);
      const label = labelOf(provider).toLowerCase();

      const models: UsageModel[] = [...groupBy(ofProvider, (r) => r.model)]
        .sort((a, b) => latest(b[1]) - latest(a[1]))
        .map(([model, ofModel]) => {
          const modelCost = labelFor(ofModel);
          const modelTokens = sumTokens(ofModel);

          const perLesson: UsageLesson[] = [...groupBy(ofModel, (r) => r.lesson_id)]
            .sort((a, b) => latest(b[1]) - latest(a[1]))
            .map(([id, ofLesson]) => {
              const cost = labelFor(ofLesson);
              const lessonTokens = sumTokens(ofLesson);
              // A lesson deleted after its rows were written leaves the id as
              // the only honest name for it; inventing one would be worse.
              const topic = getLesson(id)?.topic ?? id;
              return { id, topic, line: compose(topic, tokenSegment(lessonTokens, cost), cost), cost, tokens: lessonTokens };
            });

          return {
            model,
            line: compose(label, model, plural(perLesson.length, 'lesson'), tokenSegment(modelTokens, modelCost), modelCost),
            cost: modelCost,
            tokens: modelTokens,
            lessons: perLesson.length,
            rows: perLesson,
          };
        });

      return {
        provider,
        label,
        line: compose(label, plural(groupLessons, 'lesson'), tokenSegment(groupTokens, groupCost), groupCost),
        cost: groupCost,
        tokens: groupTokens,
        lessons: groupLessons,
        models,
      };
    });

  return { total, summary: compose(`across ${plural(lessons, 'lesson')}`, tokens === null ? null : plural(tokens, 'token')), lessons, tokens, groups };
}
