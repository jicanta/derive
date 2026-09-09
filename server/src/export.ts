import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { VAULT_DIR } from './config.js';
import { getLesson, listEvents, listMaterials, listNodes, type Lesson, type StoredEvent } from './db.js';

const LETTERS = 'ABCDEFG';

type QuizEv = { id: string; question: string; options: string[]; multi: boolean; node_id: string | null };
type QuizRes = { id: string; selected: number[]; correct: number[]; explanation: string; result: string; note: string | null };

function quizBlock(qz: QuizEv, res: QuizRes | undefined) {
  const lines: string[] = [];
  const header = !res
    ? '> [!question] Quiz — unanswered'
    : res.result === 'skipped'
      ? '> [!question] Quiz — answered in the chat instead'
      : res.result === 'correct'
      ? '> [!success] Quiz — correct ✓'
      : res.result === 'incorrect'
        ? '> [!failure] Quiz — incorrect ✗'
        : "> [!question] Quiz — I don't know";
  lines.push(header);
  lines.push(`> ${qz.question.replace(/\n/g, '\n> ')}`);
  lines.push('>');
  qz.options.forEach((opt, i) => {
    const isCorrect = res?.correct.includes(i);
    const picked = res?.selected.includes(i);
    const mark = isCorrect ? '✓' : picked && res?.result === 'incorrect' ? '✗' : ' ';
    lines.push(`> ${mark} ${LETTERS[i]}. ${opt}`);
  });
  if (res && res.result === 'skipped') {
    if (res.note) lines.push('>', `> You wrote: ${res.note}`);
  } else if (res) {
    const your = res.result === 'dont_know' ? "I don't know" : res.selected.map((i) => LETTERS[i]).join(', ');
    const corr = res.correct.map((i) => LETTERS[i]).join(', ');
    lines.push('>');
    lines.push(`> Your answer: ${your} · Correct answer: ${corr}`);
    if (res.note) lines.push(`> Note: ${res.note}`);
    lines.push('>');
    lines.push(`> ${res.explanation.replace(/\n/g, '\n> ')}`);
  }
  return lines.join('\n');
}

/**
 * The tutor draws figures as ```svg fences, which the app renders inline.
 * Obsidian shows a fence as code, so for the note the fence becomes inline
 * HTML: the SVG inside a dark box, since the tutor draws light strokes on a
 * dark background. Script and event handlers are stripped, as in the app.
 */
function inlineSvgFences(md: string): string {
  return md.replace(/```svg[^\n]*\n([\s\S]*?)```/g, (block, body: string) => {
    const safe = body
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+="[^"]*"/gi, '')
      .replace(/\son\w+='[^']*'/gi, '')
      .replace(/href="javascript:[^"]*"/gi, '')
      .trim();
    if (!/^<svg[\s>]/i.test(safe)) return block;
    // Blank lines around it make it an HTML block; no indentation inside, or Markdown treats it as code.
    return `\n<div style="background:#131110;border-radius:12px;padding:12px;display:flex;justify-content:center">\n${safe.replace(/\n[ \t]+/g, '\n')}\n</div>\n`;
  });
}

export function renderMarkdown(lesson: Lesson): string {
  const events = listEvents(lesson.id);
  const nodes = listNodes(lesson.id);
  const results = new Map<string, QuizRes>();
  const askResults = new Map<string, string>();
  const explainResults = new Map<string, string>();
  for (const e of events) {
    if (e.type === 'quiz_result') results.set((e.payload as QuizRes).id, e.payload as QuizRes);
    if (e.type === 'ask_result') askResults.set((e.payload as { id: string }).id, (e.payload as { text: string }).text);
    if (e.type === 'explain_result') explainResults.set((e.payload as { id: string }).id, (e.payload as { text: string }).text);
  }

  const out: string[] = [];
  out.push('---');
  out.push(`title: ${lesson.topic}`);
  out.push(`created: ${new Date(lesson.created_at).toISOString()}`);
  out.push('tags: [derive, lesson]');
  out.push('---');
  out.push('');
  out.push(`# ${lesson.topic}`);
  if (lesson.goal) out.push(`\n> [!abstract] Goal\n> ${lesson.goal}`);
  const materials = listMaterials(lesson.id);
  if (materials.length) {
    out.push('\n> [!info] Course material');
    for (const m of materials) out.push(`> - ${m.name} (${m.pages} ${m.unit}${m.pages === 1 ? '' : 's'})`);
  }

  if (nodes.length) {
    out.push('\n## Dependency map\n');
    out.push('```mermaid');
    out.push('graph BT');
    for (const n of nodes) {
      const shape = n.kind === 'truth' ? `[["${n.label}"]]` : n.kind === 'goal' ? `((("${n.label}")))` : `["${n.label}"]`;
      out.push(`  ${n.node_id}${shape}`);
    }
    for (const n of nodes) {
      for (const d of JSON.parse(n.depends_on) as string[]) out.push(`  ${d} --> ${n.node_id}`);
    }
    out.push('```');
    out.push('');
    out.push('| Node | Kind | Status |');
    out.push('|---|---|---|');
    for (const n of nodes) out.push(`| ${n.label} | ${n.kind} | ${n.status} |`);
  }

  out.push('\n## Lesson\n');
  for (const e of events) {
    switch (e.type) {
      case 'user':
        out.push(`> [!quote] YOU\n> ${String((e.payload as { text: string }).text).replace(/\n/g, '\n> ')}\n`);
        break;
      case 'assistant': {
        const t = (e.payload as { text: string }).text;
        if (t.trim()) out.push(`${inlineSvgFences(t)}\n`);
        break;
      }
      case 'quiz':
        out.push(quizBlock(e.payload as QuizEv, results.get((e.payload as QuizEv).id)) + '\n');
        break;
      case 'ask': {
        const p = e.payload as { id: string; question: string };
        const a = askResults.get(p.id);
        out.push(`> [!info] ${p.question.replace(/\n/g, ' ')}\n> ${a ? `**You:** ${a}` : '_unanswered_'}\n`);
        break;
      }
      case 'explain': {
        const p = e.payload as { id: string; prompt: string };
        const a = explainResults.get(p.id);
        out.push(`> [!example] Teach it back: ${p.prompt.replace(/\n/g, ' ')}\n> ${a ? `**You:** ${a.replace(/\n/g, '\n> ')}` : '_unanswered_'}\n`);
        break;
      }
      case 'memory':
        out.push(`> [!note] The tutor noted: ${(e.payload as { fact: string }).fact}\n`);
        break;
      case 'phase':
        out.push(`\n### Phase: ${(e.payload as { phase: string }).phase}\n`);
        break;
      case 'node_status': {
        const p = e.payload as { id: string; status: string };
        const n = nodes.find((x) => x.node_id === p.id);
        if (n && p.status !== 'teaching') out.push(`> [!${p.status === 'locked' ? 'tip' : 'warning'}] ${p.status === 'locked' ? 'Locked' : 'Shaky'}: ${n.label}\n`);
        break;
      }
      default:
        break;
    }
  }
  return out.join('\n');
}

export function exportToVault(lesson: Lesson): string | null {
  if (!VAULT_DIR) return null;
  mkdirSync(VAULT_DIR, { recursive: true });
  const safe = lesson.topic.replace(/[\\/:*?"<>|]/g, '-').slice(0, 80);
  const path = join(VAULT_DIR, `${safe}.md`);
  writeFileSync(path, renderMarkdown(lesson));
  return path;
}

/**
 * Live mirror: with a vault configured, every persisted event rewrites the
 * lesson's note, so Obsidian shows the lesson as it happens (the md-log idea
 * from the original learn tool). Debounced, since a turn emits bursts.
 */
const mirrorTimers = new Map<string, NodeJS.Timeout>();

export function mirrorToVault(lessonId: string, delayMs = 600) {
  if (!VAULT_DIR) return;
  clearTimeout(mirrorTimers.get(lessonId));
  mirrorTimers.set(
    lessonId,
    setTimeout(() => {
      mirrorTimers.delete(lessonId);
      const lesson = getLesson(lessonId);
      if (!lesson) return;
      try {
        exportToVault(lesson);
      } catch (e) {
        console.error('[vault]', e instanceof Error ? e.message : e);
      }
    }, delayMs),
  );
}

export type { StoredEvent };
