/**
 * Things that happened while the tutor was mid-turn or idle and that it must
 * hear about at its next chance: material attached while a card was pending,
 * material removed. Delivered once, either prepended to the next prompt
 * (agent.ts) or attached to the next tool result (actions.ts, index.ts).
 */
const notices = new Map<string, string[]>();

export function addNotice(lessonId: string, text: string) {
  notices.set(lessonId, [...(notices.get(lessonId) ?? []), text]);
}

export function takeNotices(lessonId: string): string[] {
  const n = notices.get(lessonId) ?? [];
  notices.delete(lessonId);
  return n;
}
