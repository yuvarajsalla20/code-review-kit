// Reads agent and skill files: front matter, body and where each line sits.
import { listFiles, readText } from '../lib/files.mjs';

const MARKDOWN = /\.md$/i;

/** `{ front, body, offset }`: the `key: value` lines between the two `---` marks, the rest, and the lines before the body. */
export function parseFront(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { front: null, body: text, offset: 0 };
  const front = Object.fromEntries(m[1].split(/\r?\n/).map((l) => l.match(/^([\w-]+):\s*(.*)$/)).filter(Boolean).map(([, k, v]) => [k, v.trim()]));
  return { front, body: m[2], offset: text.slice(0, text.length - m[2].length).split('\n').length - 1 };
}

/** Every agent file under `dirs`: its path, category folder (the folder under the agents root, or null), name from the file, front matter, tools and body lines. */
export function loadAgents(root, dirs = ['agents']) {
  return dirs.flatMap((dir) =>
    listFiles(root, [dir], { match: MARKDOWN }).map((file) => {
      const parts = file.split('/');
      const { front, body, offset } = parseFront(readText(root, file));
      return {
        file,
        category: parts.length > 2 ? parts[1] : null,
        stem: parts.at(-1).replace(MARKDOWN, ''),
        front,
        tools: (front?.tools ?? '').split(',').map((t) => t.trim()).filter(Boolean),
        body,
        offset,
        lines: body.split('\n'),
      };
    }),
  );
}

/** Skill files (`SKILL.md`) under `dirs`, as `{ file, text }`. */
export const loadSkills = (root, dirs = ['skills']) => listFiles(root, dirs, { match: /SKILL\.md$/i }).map((file) => ({ file, text: readText(root, file) }));
