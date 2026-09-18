import type { Atlas, DueNode, Learner, LearnerPrefs, Lesson, LessonSummary, Library, Material, NodeRow, Resource, Stats, StoredEvent } from './types';

/**
 * The selected learner profile, kept in this browser. Sent on every request
 * so lessons, the atlas and the review queue are theirs. Empty means the
 * first learner.
 */
const LEARNER_KEY = 'derive.learner';
export const currentLearner = (): string => {
  try {
    return localStorage.getItem(LEARNER_KEY) ?? '';
  } catch {
    return '';
  }
};
export const selectLearner = (id: string) => {
  try {
    if (id) localStorage.setItem(LEARNER_KEY, id);
    else localStorage.removeItem(LEARNER_KEY);
  } catch {
    /* private mode */
  }
};
/**
 * The install token, put into this document by the server that served it.
 * Empty in development, where the page comes from Vite and its /api proxy
 * adds the header instead. Read once; never stored anywhere else and never
 * logged, since it is already in the document the page arrived as.
 */
let token: string | null = null;
export const deriveToken = (): string => {
  if (token === null) token = document.querySelector<HTMLMetaElement>('meta[name="derive-token"]')?.content ?? '';
  return token;
};
const headers = (extra: Record<string, string> = {}) => {
  const l = currentLearner();
  const t = deriveToken();
  return { ...extra, ...(t ? { 'x-derive-token': t } : {}), ...(l ? { 'x-derive-learner': l } : {}) };
};
const get = (url: string) => fetch(url, { headers: headers() });
const del = (url: string) => fetch(url, { method: 'DELETE', headers: headers() });

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

const post = (url: string, body?: unknown, method = 'POST') =>
  fetch(url, { method, headers: headers({ 'content-type': 'application/json' }), body: body ? JSON.stringify(body) : undefined });

export const api = {
  stats: () => get('/api/stats').then((r) => j<Stats>(r)),
  learners: () => get('/api/learners').then((r) => j<{ learners: Learner[]; current: string }>(r)),
  createLearner: (name: string) => post('/api/learners', { name }).then((r) => j<Learner>(r)),
  renameLearner: (id: string, name: string) => post(`/api/learners/${id}`, { name }, 'PATCH').then((r) => j<Learner>(r)),
  /** How this learner wants to be taught. Fields merge; an empty string clears one. */
  setPrefs: (id: string, prefs: Partial<Record<keyof LearnerPrefs, string>>) => post(`/api/learners/${id}`, { prefs }, 'PATCH').then((r) => j<Learner>(r)),
  /** What the tutor knows about the current learner: the notes it kept, open misconceptions, what is due. */
  profile: () => get('/api/profile').then((r) => j<{ memory: string[]; misconceptions: { topic: string; picked: string; correct: string }[]; learner?: Learner }>(r)),
  deleteLearner: (id: string) => del(`/api/learners/${id}`).then((r) => j<{ ok: true }>(r)),
  lessons: () => get('/api/lessons').then((r) => j<LessonSummary[]>(r)),
  lesson: (id: string) =>
    get(`/api/lessons/${id}`).then((r) =>
      j<{ lesson: Lesson; nodes: NodeRow[]; materials: Material[]; events: StoredEvent[]; busy: boolean; pending: boolean }>(r),
    ),
  createLesson: (topic: string, materials: string[] = []) => post('/api/lessons', { topic, materials }).then((r) => j<Lesson>(r)),
  /** Upload files; with a lesson id they attach at once, without one they wait for createLesson. */
  uploadMaterials: (files: File[], lessonId?: string) => {
    const form = new FormData();
    if (lessonId) form.set('lesson_id', lessonId);
    for (const f of files) form.append('files', f, f.name);
    return fetch('/api/materials', { method: 'POST', headers: headers(), body: form }).then((r) => j<{ materials: Material[]; errors: { name: string; error: string }[] }>(r));
  },
  /** Import a repository as material: a folder on this machine, a GitHub URL, or a git URL. */
  importRepo: (source: string, lessonId?: string) =>
    post('/api/materials/repo', { source, lesson_id: lessonId }).then((r) => j<{ materials: Material[]; errors: { name: string; error: string }[] }>(r)),
  deleteMaterial: (id: string) => del(`/api/materials/${id}`).then((r) => j<{ ok: true }>(r)),
  deleteLesson: (id: string) => del(`/api/lessons/${id}`).then((r) => j<{ ok: true }>(r)),
  message: (id: string, text: string) => post(`/api/lessons/${id}/message`, { text }).then((r) => j<{ ok: true; note?: string }>(r)),
  answer: (id: string, prompt_id: string, answer: Record<string, unknown>) =>
    post(`/api/lessons/${id}/answer`, { prompt_id, ...answer }).then((r) => j<{ ok: true }>(r)),
  interrupt: (id: string) => post(`/api/lessons/${id}/interrupt`).then((r) => j<{ ok: true }>(r)),
  /** Tell the tutor the learner switched voice mode on or off (it writes for the ear when on). */
  voice: (id: string, on: boolean) => post(`/api/lessons/${id}/voice`, { on }).then((r) => j<{ ok: true }>(r)),
  exportMarkdown: (id: string) => get(`/api/lessons/${id}/export`).then((r) => r.text()),
  exportToVault: (id: string) => post(`/api/lessons/${id}/export`).then((r) => j<{ ok: true; path: string }>(r)),
  due: () => get('/api/review').then((r) => j<DueNode[]>(r)),
  startReview: () => post('/api/review').then((r) => j<Lesson>(r)),
  atlas: () => get('/api/atlas').then((r) => j<Atlas>(r)),
  /** The learner's library: links, videos, books, papers, courses and notes the tutor can read and point to. */
  library: (f: { q?: string; kind?: string; tag?: string } = {}) => {
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
    return get(`/api/library${qs ? `?${qs}` : ''}`).then((r) => j<Library>(r));
  },
  addResource: (body: { url?: string; title?: string; kind?: string; author?: string; note?: string; tags?: string[] }) =>
    post('/api/library', body).then((r) => j<Resource & { existing: boolean }>(r)),
  editResource: (id: string, body: { title?: string; kind?: string; author?: string | null; note?: string | null; tags?: string[] }) =>
    post(`/api/library/${id}`, body, 'PATCH').then((r) => j<Resource>(r)),
  refetchResource: (id: string) => post(`/api/library/${id}/refetch`).then((r) => j<Resource>(r)),
  deleteResource: (id: string) => del(`/api/library/${id}`).then((r) => j<{ ok: true }>(r)),
};
