import { useCallback, useState } from 'react';
import { api } from './api';
import type { Material } from './types';

export const MATERIAL_ACCEPT = '.pdf,.pptx,.docx,.md,.markdown,.mdx,.txt,.tex,.rst,.org';

/**
 * Upload state for course material. Before a lesson exists the uploads are
 * parked on the server and their ids go to createLesson; with a lesson id
 * they attach immediately and arrive back through the event stream.
 */
export function useMaterials(lessonId?: string) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [uploading, setUploading] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const add = useCallback(
    async (input: FileList | File[] | null | undefined) => {
      const files = Array.from(input ?? []);
      if (!files.length) return;
      setError(null);
      setUploading((u) => [...u, ...files.map((f) => f.name)]);
      try {
        const r = await api.uploadMaterials(files, lessonId);
        setMaterials((m) => [...m, ...r.materials]);
        if (r.errors.length) setError(r.errors.map((e) => `${e.name}: ${e.error}`).join(' · '));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setUploading((u) => u.filter((n) => !files.some((f) => f.name === n)));
      }
    },
    [lessonId],
  );

  const remove = useCallback(async (id: string) => {
    setMaterials((m) => m.filter((x) => x.id !== id));
    await api.deleteMaterial(id).catch(() => undefined);
  }, []);

  return { materials, uploading, error, add, remove };
}

export const describeMaterial = (m: Pick<Material, 'pages' | 'unit' | 'chars'>) => {
  const w = Math.round(m.chars / 6);
  const words = w >= 1000 ? `${Math.round(w / 1000)}k words` : `${w} words`;
  return `${m.pages} ${m.unit}${m.pages === 1 ? '' : 's'} · ${words}`;
};
