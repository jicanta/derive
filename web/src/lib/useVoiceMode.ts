import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import type { TimelineItem } from './types';
import { isSpeaking, listen, parseSpokenChoice, speak, spokenChoices, spokenQuiz, spokenText, stopSpeaking, voiceSupport, type ListenHandle } from './voice';

const KEY = 'derive.voice';
const APPROVE = /^(yes|yeah|yep|ok|okay|sure|approve|approved|looks (good|right|fine)|go ahead|teach me|sí|si|dale|vamos|perfecto|de acuerdo)[.!]?$/i;

type ActiveCard = { kind: 'quiz' | 'ask' | 'explain' | 'plan'; id: string; options: string[] } | null;

/**
 * Voice mode for a lesson: new prose and cards are read aloud as they
 * arrive, and when the tutor stops talking the microphone opens for the
 * reply. A short reply to a quiz ("B", "the second one", "I don't know")
 * answers the card; anything longer goes to the tutor as a message.
 */
export function useVoiceMode({
  lessonId,
  items,
  busy,
  external,
  activeCard,
  answer,
  send,
}: {
  lessonId: string | undefined;
  items: TimelineItem[];
  busy: boolean;
  external: boolean;
  activeCard: ActiveCard;
  answer: (promptId: string, a: Record<string, unknown>) => Promise<unknown>;
  send: (text: string) => Promise<unknown>;
}) {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      return voiceSupport.speak && localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [dictation, setDictation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const spoken = useRef(new Set<string>());
  const handle = useRef<ListenHandle | null>(null);
  const activeRef = useRef<ActiveCard>(activeCard);
  activeRef.current = activeCard;
  const idleRef = useRef({ busy, external });
  idleRef.current = { busy, external };
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const stopListening = useCallback(() => {
    handle.current?.stop();
    handle.current = null;
    setListening(false);
  }, []);

  const handleFinal = useCallback(
    (text: string) => {
      handle.current = null;
      setListening(false);
      setDictation('');
      if (!text) return;
      const card = activeRef.current;
      const run = (p: Promise<unknown>) => p.catch((e) => setError((e as Error).message));
      if (card?.kind === 'quiz') {
        const c = parseSpokenChoice(text, card.options.length);
        if (c?.idk) return run(answer(card.id, { idk: true }));
        if (c?.index !== undefined) return run(answer(card.id, { selected: [c.index], sure: c.sure !== false }));
        return run(send(text));
      }
      if (card?.kind === 'ask') {
        const c = card.options.length ? parseSpokenChoice(text, card.options.length) : null;
        return run(answer(card.id, { text: c?.index !== undefined ? card.options[c.index] : text }));
      }
      if (card?.kind === 'explain') return run(answer(card.id, { text }));
      if (card?.kind === 'plan') return run(APPROVE.test(text.trim()) ? answer(card.id, { approved: true }) : answer(card.id, { approved: false, feedback: text }));
      return run(send(text));
    },
    [answer, send],
  );

  const startListening = useCallback(
    (long = false) => {
      if (!voiceSupport.listen || handle.current) return;
      stopSpeaking();
      setSpeaking(false);
      setError(null);
      setDictation('');
      const h = listen(
        {
          onInterim: setDictation,
          onFinal: handleFinal,
          onError: (e) => setError(e === 'not-allowed' ? 'Microphone access was refused.' : e === 'network' ? 'Speech recognition needs a network connection.' : `Microphone: ${e}`),
        },
        { silenceMs: long ? 4000 : 1800 },
      );
      handle.current = h;
      setListening(!!h);
    },
    [handleFinal],
  );

  /** After the tutor has been heard: open the mic if there is something to answer. */
  const afterSpeech = useCallback(() => {
    if (!enabledRef.current || isSpeaking()) return;
    setSpeaking(false);
    const card = activeRef.current;
    const { busy: b, external: ext } = idleRef.current;
    if (card || (!b && !ext)) startListening(card?.kind === 'explain');
  }, [startListening]);

  const say = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      setSpeaking(true);
      void speak(text).then(afterSpeech);
    },
    [afterSpeech],
  );

  // Switching on: nothing already on screen is read back, except a card that is waiting.
  useEffect(() => {
    if (!enabled) {
      stopSpeaking();
      stopListening();
      setSpeaking(false);
      return;
    }
    for (const it of items) {
      const k = keyOf(it);
      if (k) spoken.current.add(k);
      if (it.kind === 'quiz' && !it.result) spoken.current.delete(k);
      if (it.kind === 'ask' && it.answer === undefined) spoken.current.delete(k);
      if (it.kind === 'explain' && it.answer === undefined) spoken.current.delete(k);
      if (it.kind === 'plan' && it.approved === undefined) spoken.current.delete(k);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Read what is new: finished prose, cards as they open, verdicts as they land.
  useEffect(() => {
    if (!enabled) return;
    for (const it of items) {
      const k = keyOf(it);
      if (!k) continue;
      switch (it.kind) {
        case 'assistant':
          if (it.streaming || !it.text.trim()) continue;
          spoken.current.add(k);
          say(spokenText(it.text));
          break;
        case 'quiz': {
          if (!spoken.current.has(k)) {
            spoken.current.add(k);
            if (!it.result) say(spokenQuiz(it.quiz.question, it.quiz.options));
          }
          const rk = `${k}:result`;
          if (it.result && !spoken.current.has(rk)) {
            spoken.current.add(rk);
            if (it.result.result !== 'skipped') {
              const verdict = it.result.result === 'correct' ? 'Correct.' : it.result.result === 'incorrect' ? 'Not quite.' : 'No problem.';
              say(`${verdict} ${spokenText(it.result.explanation)}`);
            }
          }
          break;
        }
        case 'ask':
          if (spoken.current.has(k)) continue;
          spoken.current.add(k);
          if (it.answer === undefined) say(spokenChoices(it.ask.question, it.ask.options));
          break;
        case 'explain':
          if (spoken.current.has(k)) continue;
          spoken.current.add(k);
          if (it.answer === undefined) say(`${spokenText(it.explain.prompt)} Explain it in your own words; I will stop listening after a longer pause.`);
          break;
        case 'plan':
          if (spoken.current.has(k)) continue;
          spoken.current.add(k);
          if (it.approved === undefined) {
            const truths = it.plan.nodes.filter((n) => n.kind === 'truth').map((n) => n.label);
            const rest = it.plan.nodes.filter((n) => n.kind !== 'truth').map((n) => n.label);
            say(`Here is the plan. Goal: ${it.plan.goal}. Ground truths: ${truths.join('; ')}. Then: ${rest.join('; ')}. Say yes to approve, or say what should change.`);
          }
          break;
        case 'node_start':
          if (spoken.current.has(k)) continue;
          spoken.current.add(k);
          say(`Next: ${it.label}.`);
          break;
        default:
          spoken.current.add(k);
      }
    }
  }, [items, enabled, say]);

  // A card that appears while nothing is being said (e.g. after a reconnect) still opens the mic.
  useEffect(() => {
    if (enabled && activeCard && !isSpeaking() && !handle.current) {
      const t = setTimeout(afterSpeech, 400);
      return () => clearTimeout(t);
    }
  }, [enabled, activeCard, afterSpeech]);

  useEffect(() => () => stopListening(), [stopListening]);

  const toggle = useCallback(() => {
    setEnabled((v) => {
      const next = !v;
      try {
        localStorage.setItem(KEY, next ? '1' : '0');
      } catch {
        /* private mode */
      }
      if (lessonId) void api.voice(lessonId, next).catch(() => undefined);
      return next;
    });
  }, [lessonId]);

  const toggleListening = useCallback(() => {
    if (handle.current) stopListening();
    else startListening(activeRef.current?.kind === 'explain');
  }, [startListening, stopListening]);

  return { enabled, toggle, listening, speaking, dictation, error, toggleListening, supported: voiceSupport };
}

function keyOf(it: TimelineItem): string {
  switch (it.kind) {
    case 'assistant':
      return `a:${it.id}`;
    case 'quiz':
      return `q:${it.quiz.id}`;
    case 'ask':
      return `k:${it.ask.id}`;
    case 'explain':
      return `e:${it.explain.id}`;
    case 'plan':
      return `p:${it.plan.id}`;
    default:
      return `${it.kind}:${it.seq}`;
  }
}
