/**
 * Voice mode, on the browser's own speech engines: the tutor's prose and
 * the cards are read aloud with speechSynthesis, and the learner's reply is
 * taken from SpeechRecognition. Nothing leaves the machine beyond what the
 * browser's recognizer does itself. Chrome has both; other browsers may
 * only speak.
 */

type RecognitionCtor = new () => SpeechRecognitionLike;
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

const w = typeof window === 'undefined' ? ({} as Record<string, unknown>) : (window as unknown as Record<string, unknown>);
const Recognition = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as RecognitionCtor | undefined;

export const voiceSupport = {
  speak: typeof window !== 'undefined' && 'speechSynthesis' in window,
  listen: !!Recognition,
};

/** The tag pushed in by `setVoiceLang`, or null while nobody has chosen one. */
let prefLang: string | null = null;

/** The language to speak and listen in: the learner's, then the browser's, then English. */
export const voiceLang = () => prefLang || (typeof navigator !== 'undefined' && navigator.language) || 'en-US';

/**
 * Markdown as it should be heard: no fences, no link targets, no emphasis
 * marks, headings as sentences, math replaced by a short cue so the sentence
 * still parses. A figure or a table is named, not read.
 */
export function spokenText(md: string): string {
  return md
    .replace(/```(mermaid|svg)[\s\S]*?```/g, ' There is a figure on screen. ')
    .replace(/```[\s\S]*?```/g, ' There is a code block on screen. ')
    .replace(/^\s*\|.*\|\s*$/gm, '')
    .replace(/\$\$[\s\S]*?\$\$/g, ' the formula on screen ')
    .replace(/\$[^$\n]+\$/g, ' the formula on screen ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/[*_`~]+/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s*\n\s*\n\s*/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\.\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const LETTERS = 'ABCDEFG';

/** A quiz as a spoken prompt: the question, the options by letter, how to answer. */
export function spokenQuiz(question: string, options: string[]): string {
  const opts = options.map((o, i) => `Option ${LETTERS[i]}: ${spokenText(o)}.`).join(' ');
  const letters = options.map((_, i) => LETTERS[i]);
  return `${spokenText(question)} ${opts} Say ${letters.slice(0, -1).join(', ')} or ${letters.at(-1)}, or say "I don't know".`;
}

export function spokenChoices(question: string, options: string[]): string {
  const opts = options.length ? ' ' + options.map((o, i) => `${i + 1}: ${spokenText(o)}.`).join(' ') + ' Say a number, or answer in your own words.' : '';
  return `${spokenText(question)}${opts}`;
}

// ---------- sentences ----------

/**
 * Words whose full stop ends the word, not the sentence. Committed data like
 * the rest of this file's vocabulary: a new one is a one-line reviewable diff.
 */
const ABBREVIATIONS = ['e.g', 'i.e', 'etc', 'vs', 'cf', 'dr', 'mr', 'mrs', 'ms', 'fig', 'no', 'approx'];

/** Where a sentence may end, in the scripts the tutor writes in. */
const SENTENCE_ENDS = '.!?…。！？';

/**
 * The tutor's prose cut into complete sentences, so a block can be spoken while
 * it is still arriving instead of after the whole paragraph. Returns the
 * sentences found at or after `from` and the index of the first unconsumed
 * character — never a trailing fragment, because the caller would otherwise say
 * half a thought now and the same half again when the rest arrived.
 *
 * A sentence shorter than 24 characters is not said on its own: it waits and is
 * prepended to the next one, so a bare "Yes." is not its own utterance with its
 * own pause before and after it. The floor is lifted at the end of the text,
 * where there is no next sentence to wait for and the alternative is never
 * saying it at all.
 *
 * A full stop does not end a sentence when it belongs to a decimal (`3.14`), to
 * an initialism (`e.g.`, `U.S.`) or to one of the abbreviations above. The scan
 * is a single pass forward with no backtracking.
 */
export function sentences(text: string, from = 0): { complete: string[]; next: number } {
  const complete: string[] = [];
  const hasMore = (at: number) => {
    for (let j = at; j < text.length; j++) if (!/\s/.test(text[j])) return true;
    return false;
  };
  let start = Math.min(Math.max(from, 0), text.length);
  let next = start;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (!SENTENCE_ENDS.includes(c)) continue;
    const after = text[i + 1];
    if (after !== undefined && !/\s/.test(after)) continue;
    if (c === '.' && !endsSentence(text, i)) continue;
    const chunk = text.slice(start, i + 1).trim();
    if (chunk && chunk.length < 24 && hasMore(i + 1)) continue;
    if (chunk) complete.push(chunk);
    start = i + 1;
    next = start;
  }
  return { complete, next };
}

/** False when the full stop at `i` belongs to a decimal, an initialism or an abbreviation. */
function endsSentence(text: string, i: number): boolean {
  const prev = text[i - 1];
  if (prev !== undefined && /[0-9]/.test(prev)) return false;
  if (prev !== undefined && /[A-Za-z]/.test(prev) && text[i - 2] === '.') return false;
  const word = /[A-Za-z.]+$/.exec(text.slice(0, i))?.[0] ?? '';
  return !ABBREVIATIONS.includes(word.toLowerCase());
}

// ---------- speaking ----------

let queue: { text: string; resolve: () => void }[] = [];
let current: SpeechSynthesisUtterance | null = null;
let voice: SpeechSynthesisVoice | null | undefined;

function pickVoice(): SpeechSynthesisVoice | null {
  if (!voiceSupport.speak) return null;
  if (voice !== undefined) return voice;
  const all = speechSynthesis.getVoices();
  if (!all.length) return null; // not loaded yet; try again next time
  const lang = voiceLang().toLowerCase();
  const base = lang.split('-')[0];
  // A natural-sounding voice for the page's language, then any voice for it, then the default.
  voice =
    all.find((v) => v.lang.toLowerCase() === lang && /natural|neural|premium|enhanced|google|siri/i.test(v.name)) ??
    all.find((v) => v.lang.toLowerCase().startsWith(base) && /natural|neural|premium|enhanced|google|siri/i.test(v.name)) ??
    all.find((v) => v.lang.toLowerCase() === lang) ??
    all.find((v) => v.lang.toLowerCase().startsWith(base)) ??
    all.find((v) => v.default) ??
    null;
  return voice;
}

/**
 * Speak and listen in this tag from now on; null means fall back to the
 * browser's own language. This also drops the memoised voice: `pickVoice` caches
 * its choice in a module-level binding that is otherwise only invalidated when
 * the browser's voice list changes, so without the reset the first-picked voice
 * would keep talking after the learner changed language.
 */
export function setVoiceLang(tag: string | null) {
  if (prefLang === tag) return;
  prefLang = tag;
  voice = undefined;
}

if (voiceSupport.speak) {
  speechSynthesis.addEventListener?.('voiceschanged', () => {
    voice = undefined;
  });
}

function next() {
  if (current || !queue.length) return;
  const item = queue.shift()!;
  const u = new SpeechSynthesisUtterance(item.text);
  u.lang = voiceLang();
  const v = pickVoice();
  if (v) u.voice = v;
  u.rate = 1.02;
  const done = () => {
    if (current !== u) return;
    current = null;
    item.resolve();
    next();
  };
  u.onend = done;
  u.onerror = done;
  current = u;
  speechSynthesis.speak(u);
}

/** Say something after whatever is already queued. Resolves when it has been said (or cut off). */
export function speak(text: string): Promise<void> {
  if (!voiceSupport.speak || !text.trim()) return Promise.resolve();
  return new Promise((resolve) => {
    queue.push({ text, resolve });
    next();
  });
}

export function stopSpeaking() {
  if (!voiceSupport.speak) return;
  const pending = queue;
  queue = [];
  current = null;
  speechSynthesis.cancel();
  for (const p of pending) p.resolve();
}

export const isSpeaking = () => voiceSupport.speak && (speechSynthesis.speaking || queue.length > 0);

// ---------- listening ----------

export type ListenHandle = { stop: () => void };

/**
 * One reply from the microphone. `onInterim` fires as words arrive,
 * `onFinal` once with the settled transcript (empty when nothing was heard),
 * then the recognizer ends. Listening continues across short pauses and
 * stops after `silenceMs` without new words, or when `stop` is called.
 */
export function listen(
  opts: { onInterim?: (t: string) => void; onFinal: (t: string) => void; onError?: (e: string) => void },
  { silenceMs = 1800, maxMs = 90_000 }: { silenceMs?: number; maxMs?: number } = {},
): ListenHandle | null {
  if (!Recognition) return null;
  const rec = new Recognition();
  rec.lang = voiceLang();
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  let final = '';
  let interim = '';
  let ended = false;
  let silence: ReturnType<typeof setTimeout> | null = null;
  const stop = () => {
    try {
      rec.stop();
    } catch {
      /* already stopped */
    }
  };
  const armSilence = () => {
    if (silence) clearTimeout(silence);
    silence = setTimeout(stop, silenceMs);
  };
  const cap = setTimeout(stop, maxMs);
  const finish = () => {
    if (ended) return;
    ended = true;
    if (silence) clearTimeout(silence);
    clearTimeout(cap);
    opts.onFinal((final + ' ' + interim).replace(/\s+/g, ' ').trim());
  };
  rec.onresult = (e) => {
    interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) final += ' ' + r[0].transcript;
      else interim += ' ' + r[0].transcript;
    }
    opts.onInterim?.((final + ' ' + interim).replace(/\s+/g, ' ').trim());
    armSilence();
  };
  rec.onerror = (e) => {
    // "no-speech" and "aborted" are ordinary ends; the rest the caller may want to show.
    if (e.error !== 'no-speech' && e.error !== 'aborted') opts.onError?.(e.error);
    finish();
  };
  rec.onend = finish;
  try {
    rec.start();
    // Nothing said at all: give up after a while rather than listening forever.
    silence = setTimeout(stop, Math.max(silenceMs * 4, 7000));
  } catch {
    return null;
  }
  return { stop };
}

// ---------- what was said ----------

const IDK = /\b(i don'?t know|don'?t know|no idea|not sure|no s[eé]|no lo s[eé]|ni idea|pass|skip)\b/i;
const WORD_INDEX: Record<string, number> = {
  a: 0, b: 1, c: 2, d: 3,
  one: 0, two: 1, three: 2, four: 3,
  first: 0, second: 1, third: 2, fourth: 3,
  uno: 0, dos: 1, tres: 2, cuatro: 3,
  primera: 0, segunda: 1, tercera: 2, cuarta: 3,
  primero: 0, segundo: 1, tercero: 2, cuarto: 3,
  '1': 0, '2': 1, '3': 2, '4': 3,
};

/**
 * A short spoken reply as a pick: "B", "option b", "the second one", "two",
 * "la segunda", "I don't know". Longer utterances are not picks; they are
 * things to say to the tutor.
 */
/** "B, not sure", "probably the second one", "I guess A": the learner flagging a pick as unsure. */
const UNSURE = /\b(not\s+(?:so\s+|too\s+)?sure|unsure|guess(?:ing)?|maybe|probably|i\s+think|no\s+(?:estoy\s+)?segur[oa]|creo|quiz[aá]s?|tal\s+vez|dudo)\b/;

export function parseSpokenChoice(text: string, optionCount: number): { index?: number; idk?: boolean; sure?: boolean } | null {
  let t = text.trim().toLowerCase().replace(/[.,!?]/g, '');
  if (!t) return null;
  if (IDK.test(t)) return { idk: true };
  const unsure = UNSURE.test(t);
  if (unsure) t = t.replace(UNSURE, ' ').replace(/\b(but|pero|and|y)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const words = t.split(/\s+/);
  if (words.length > 6) return null;
  const filler = new Set(['option', 'opción', 'opcion', 'the', 'la', 'el', 'one', 'answer', 'is', 'it', "it's", 'its', 'i', 'think', 'say', 'choose', 'pick', 'letter', 'number', 'creo', 'que', 'es', 'elijo', 'go', 'with']);
  const core = words.filter((x) => !filler.has(x));
  // "the second one": "one" is filler unless it is the only word left.
  const cand = core.length ? core : words.includes('one') ? ['one'] : [];
  if (cand.length !== 1) return null;
  const idx = WORD_INDEX[cand[0]];
  if (idx === undefined || idx >= optionCount) return null;
  return unsure ? { index: idx, sure: false } : { index: idx };
}
