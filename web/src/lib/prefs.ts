import type { LearnerPrefs } from './types';

export const STYLES: { id: NonNullable<LearnerPrefs['style']>; label: string; hint: string }[] = [
  { id: 'adaptive', label: 'Adaptive', hint: 'Questions where you can reason it out, narration where you cannot. The tutor decides per step.' },
  { id: 'socratic', label: 'Socratic', hint: 'Lead with questions. Slower, and the click is yours.' },
  { id: 'narrated', label: 'Narrated', hint: 'Explain each step cleanly, then test it. Told, then checked.' },
];

export const PACES: { id: NonNullable<LearnerPrefs['pace']>; label: string; hint: string }[] = [
  { id: 'brisk', label: 'Brisk', hint: 'Short prose, one example, move on once a check passes.' },
  { id: 'standard', label: 'Standard', hint: 'A few paragraphs per node, examples where the probe showed you need them.' },
  { id: 'thorough', label: 'Thorough', hint: 'The first example worked fully, smaller nodes, time on the connections.' },
];

/** One line naming what is set, for the timeline and the menu. */
export function describePrefs(p: LearnerPrefs): string {
  const bits: string[] = [];
  if (p.language) bits.push(`in ${p.language}`);
  if (p.style && p.style !== 'adaptive') bits.push(p.style);
  if (p.pace && p.pace !== 'standard') bits.push(p.pace);
  if (p.examples) bits.push(`examples from ${p.examples}`);
  if (p.how) bits.push('how you learn');
  if (p.background) bits.push('background');
  return bits.length ? bits.join(' · ') : 'nothing set';
}

export const hasPrefs = (p: LearnerPrefs | undefined) => !!p && Object.keys(p).length > 0;
