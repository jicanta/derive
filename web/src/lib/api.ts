import type { Atlas, DueNode, Lesson, LessonSummary, Material, NodeRow, Stats, StoredEvent } from './types';

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
      j<{ lesson: Lesson; nodes: NodeRow[]; materials: Material[]; events: StoredEvent[]; busy: boolean; pending: boolean }>(r),
    ),
  createLesson: (topic: string, materials: string[] = []) => post('/api/lessons', { topic, materials }).then((r) => j<Lesson>(r)),
  /** Upload files; with a lesson id they attach at once, without one they wait for createLesson. */
  uploadMaterials: (files: File[], lessonId?: string) => {
    const form = new FormData();
    if (lessonId) form.set('lesson_id', lessonId);
    for (const f of files) form.append('files', f, f.name);
    return fetch('/api/materials', { method: 'POST', body: form }).then((r) => j<{ materials: Material[]; errors: { name: string; error: string }[] }>(r));
  },
  deleteMaterial: (id: string) => fetch(`/api/materials/${id}`, { method: 'DELETE' }).then((r) => j<{ ok: true }>(r)),
  deleteLesson: (id: string) => fetch(`/api/lessons/${id}`, { method: 'DELETE' }).then((r) => j<{ ok: true }>(r)),
  message: (id: string, text: string) => post(`/api/lessons/${id}/message`, { text }).then((r) => j<{ ok: true; note?: string }>(r)),
  answer: (id: string, prompt_id: string, answer: Record<string, unknown>) =>
    post(`/api/lessons/${id}/answer`, { prompt_id, ...answer }).then((r) => j<{ ok: true }>(r)),
  interrupt: (id: string) => post(`/api/lessons/${id}/interrupt`).then((r) => j<{ ok: true }>(r)),
  exportMarkdown: (id: string) => fetch(`/api/lessons/${id}/export`).then((r) => r.text()),
  exportToVault: (id: string) => post(`/api/lessons/${id}/export`).then((r) => j<{ ok: true; path: string }>(r)),
  due: () => fetch('/api/review').then((r) => j<DueNode[]>(r)),
  startReview: () => post('/api/review').then((r) => j<Lesson>(r)),
  atlas: () => fetch('/api/atlas').then((r) => j<Atlas>(r)),
};
