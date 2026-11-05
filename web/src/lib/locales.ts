/**
 * The learner's language as a BCP-47 tag, from a table that ships with Derive.
 *
 * `prefs.language` is free text — "Spanish", "español", "Brazilian Portuguese"
 * — and both speech engines want a tag. This table is the whole of that
 * translation, and it is committed data rather than a runtime lookup.
 *
 * That is the design, not a shortcut. The obvious alternative is to match the
 * learner's text against the browser's installed voices, which can only ever
 * find a voice that happens to be on this machine, differs by operating system
 * and browser, cannot be read in a diff, and cannot be exercised by a test with
 * no browser — and voice is the part of Derive the author is least able to watch
 * failing. A table can be all four: adding a language is a one-line reviewable
 * diff with a date on it, and `LOCALES_AS_OF` is that date.
 *
 * A name absent from the table resolves to null, never to a guess. The caller
 * falls back to the browser's own language and the lesson is still spoken aloud,
 * which is the right failure — a guessed tag would read a Spanish lesson in an
 * English accent, and the learner would blame the tutor rather than the table.
 * Absent is unknown.
 *
 * Pure data with no I/O and no import-time side effect, so anything may import
 * it, including a test with no browser behind it.
 */

/**
 * The day the names and tags below were last checked. Every tag was confirmed
 * to parse as a BCP-47 language tag, and the list covers the languages Derive's
 * own copy and the method already reach for.
 */
export const LOCALES_AS_OF = '2026-11-04';

/**
 * Every language name Derive recognises, keyed by what a learner would type —
 * the English name and the endonym, plus the one regional variant that is a
 * different voice rather than a different language. Keys are lower case and keep
 * their own accents; `localeOf` folds both sides, so "ESPAÑOL", "español" and
 * "espanol" all arrive at the same row.
 */
export const LOCALES: Readonly<Record<string, string>> = {
  english: 'en',
  spanish: 'es',
  español: 'es',
  portuguese: 'pt',
  português: 'pt',
  'brazilian portuguese': 'pt-BR',
  'português do brasil': 'pt-BR',
  french: 'fr',
  français: 'fr',
  german: 'de',
  deutsch: 'de',
  italian: 'it',
  italiano: 'it',
  dutch: 'nl',
  nederlands: 'nl',
  swedish: 'sv',
  svenska: 'sv',
  polish: 'pl',
  polski: 'pl',
  turkish: 'tr',
  türkçe: 'tr',
  greek: 'el',
  ελληνικά: 'el',
  catalan: 'ca',
  català: 'ca',
  russian: 'ru',
  русский: 'ru',
  ukrainian: 'uk',
  українська: 'uk',
  hebrew: 'he',
  עברית: 'he',
  arabic: 'ar',
  العربية: 'ar',
  hindi: 'hi',
  हिन्दी: 'hi',
  japanese: 'ja',
  日本語: 'ja',
  korean: 'ko',
  한국어: 'ko',
  mandarin: 'zh-CN',
  chinese: 'zh-CN',
  中文: 'zh-CN',
};

/**
 * One language name as a BCP-47 tag, or null when the table has never heard of
 * it. The match is exact after folding — trimmed, bounded to the 60 characters
 * `prefs.language` is stored in, lower-cased, accent-tolerant, and run over both
 * sides — so no part of the learner's text is ever interpolated into a tag.
 * Null is the answer for unknown, and the caller's fallback is the browser's own
 * language.
 */
export function localeOf(text: string): string | null {
  const fold = (s: string) =>
    s
      .slice(0, 60)
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Mn}/gu, '')
      .replace(/\s+/g, ' ');
  const key = fold(text);
  if (!key) return null;
  for (const [name, tag] of Object.entries(LOCALES)) if (fold(name) === key) return tag;
  return null;
}
