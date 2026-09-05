import type { DueNode, Lesson, LessonSummary, NodeRow, Stats, StoredEvent } from './types';

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = ((await res.json()) as { error?: string }).error ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

const post = (url: string, body?: unknown) =>
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });

export const api = {
  stats: () => fetch('/api/stats').then((r) => j<Stats>(r)),
  lessons: () => fetch('/api/lessons').then((r) => j<LessonSummary[]>(r)),
  lesson: (id: string) =>
    fetch(`/api/lessons/${id}`).then((r) =>
      j<{ lesson: Lesson; nodes: NodeRow[]; events: StoredEvent[]; busy: boolean; pending: boolean }>(r),
    ),
  createLesson: (topic: string) => post('/api/lessons', { topic }).then((r) => j<Lesson>(r)),
  deleteLesson: (id: string) => fetch(`/api/lessons/${id}`, { method: 'DELETE' }).then((r) => j<{ ok: true }>(r)),
  message: (id: string, text: string) => post(`/api/lessons/${id}/message`, { text }).then((r) => j<{ ok: true }>(r)),
  answer: (id: string, prompt_id: string, answer: Record<string, unknown>) =>
    post(`/api/lessons/${id}/answer`, { prompt_id, ...answer }).then((r) => j<{ ok: true }>(r)),
  interrupt: (id: string) => post(`/api/lessons/${id}/interrupt`).then((r) => j<{ ok: true }>(r)),
  exportMarkdown: (id: string) => fetch(`/api/lessons/${id}/export`).then((r) => r.text()),
  exportToVault: (id: string) => post(`/api/lessons/${id}/export`).then((r) => j<{ ok: true; path: string }>(r)),
  due: () => fetch('/api/review').then((r) => j<DueNode[]>(r)),
  startReview: () => post('/api/review').then((r) => j<Lesson>(r)),
};
