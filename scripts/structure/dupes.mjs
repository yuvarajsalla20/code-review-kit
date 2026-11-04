// Repeated code: the same run of lines in more than one place, and the same list or text written out again and again.
import { lineFinder, withoutImports } from '../lib/source.mjs';

const TRIVIAL = /^[\]\)\}\{,;:>/]+$|^<\/?>$/;

/** The lines that carry meaning: trimmed, one space between words, with blank, bracket-only and import lines left out. */
function keptLines(clean) {
  const kept = [];
  withoutImports(clean)
    .split('\n')
    .forEach((raw, i) => {
      const t = raw.replace(/\s+/g, ' ').trim();
      if (t.length >= 3 && !TRIVIAL.test(t)) kept.push({ line: i + 1, t });
    });
  return kept;
}

/**
 * Runs of at least `minLines` meaningful lines that appear in two or more places (and at least `minChars` long, so a
 * run of short lines does not count). Identical runs are grouped, so one block copied into three files is one finding.
 */
export function findDuplicateBlocks(texts, { minLines = 6, minChars = 120 } = {}) {
  const lines = new Map([...texts].map(([f, clean]) => [f, keptLines(clean)]));
  const windows = new Map();
  for (const [file, kept] of lines) {
    for (let i = 0; i + minLines <= kept.length; i++) {
      const key = kept.slice(i, i + minLines).map((k) => k.t).join('\n');
      if (key.length < minChars) continue;
      if (!windows.has(key)) windows.set(key, []);
      windows.get(key).push({ file, i });
    }
  }

  // Pairs of matching positions, then runs of neighbouring pairs on the same diagonal join into one longer block.
  const pairs = [];
  for (const places of windows.values()) {
    for (let a = 0; a < places.length; a++) {
      for (let b = a + 1; b < places.length; b++) {
        const x = places[a];
        const y = places[b];
        if (x.file === y.file && Math.abs(x.i - y.i) < minLines) continue;
        pairs.push(x.file < y.file || (x.file === y.file && x.i < y.i) ? [x, y] : [y, x]);
      }
    }
  }
  pairs.sort((p, q) => p[0].file.localeCompare(q[0].file) || p[1].file.localeCompare(q[1].file) || p[0].i - q[0].i || p[1].i - q[1].i);

  const runs = [];
  const open = new Map();
  for (const [x, y] of pairs) {
    const diagonal = `${x.file}|${y.file}|${x.i - y.i}`;
    const run = open.get(diagonal);
    if (run && run.x + run.length - minLines + 1 === x.i) run.length++;
    else {
      const fresh = { a: x.file, b: y.file, x: x.i, y: y.i, length: minLines };
      runs.push(fresh);
      open.set(diagonal, fresh);
    }
  }

  const groups = new Map();
  for (const r of runs) {
    const first = lines.get(r.a);
    const text = first.slice(r.x, r.x + r.length).map((k) => k.t).join('\n');
    if (!groups.has(text)) groups.set(text, { lines: r.length, places: new Map() });
    const g = groups.get(text);
    for (const [file, start] of [[r.a, r.x], [r.b, r.y]]) {
      const kept = lines.get(file);
      g.places.set(`${file}:${start}`, { file, from: kept[start].line, to: kept[start + r.length - 1].line });
    }
  }
  return [...groups.values()]
    .map((g) => ({ lines: g.lines, places: [...g.places.values()].sort((p, q) => p.file.localeCompare(q.file) || p.from - q.from) }))
    .sort((a, b) => b.lines * b.places.length - a.lines * a.places.length);
}

const NUMBER_LIST = /\[\s*(?:-?\d+(?:\.\d+)?\s*,\s*){3,}-?\d+(?:\.\d+)?\s*,?\s*\]/g;
const WORD_LIST = /\[\s*(?:(['"])[^'"\n]{1,30}\1\s*,\s*){3,}(['"])[^'"\n]{1,30}\2\s*,?\s*\]/g;
const LONG_STRING = /(['"])((?:\\.|(?!\1)[^\\\n]){10,})\1/g;

const place = (map, key, file, line) => {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push({ file, line });
};

/**
 * The same value written out in several places, so changing one copy would leave the others behind: lists of four or
 * more numbers or words that appear twice or more, and text of ten or more characters used in `minFiles` or more files.
 */
export function findRepeatedValues(texts, { minFiles = 3, ignore = [] } = {}) {
  const lists = new Map();
  const strings = new Map();
  for (const [file, clean] of texts) {
    const body = withoutImports(clean);
    const at = lineFinder(body);
    for (const re of [NUMBER_LIST, WORD_LIST]) {
      for (const m of body.matchAll(re)) place(lists, m[0].replace(/\s+/g, '').replace(/,\]$/, ']').replace(/"/g, "'"), file, at(m.index));
    }
    for (const m of body.matchAll(LONG_STRING)) if (!ignore.includes(m[2])) place(strings, m[2], file, at(m.index));
  }
  const spread = (list) => new Set(list.map((p) => p.file)).size;
  return [
    ...[...lists].filter(([, p]) => p.length >= 2).map(([value, places]) => ({ kind: 'list', value, places })),
    ...[...strings].filter(([, p]) => spread(p) >= minFiles).map(([value, places]) => ({ kind: 'text', value, places })),
  ].sort((a, b) => b.places.length - a.places.length || a.value.localeCompare(b.value));
}
