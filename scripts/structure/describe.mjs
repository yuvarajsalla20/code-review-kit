// The wording of each finding: what is wrong, how to fix it, how big the job is. One function per kind of finding.

const effortForLines = (n) => (n < 12 ? 'small' : n < 40 ? 'medium' : 'large');
const spot = (p) => (p.to && p.to !== p.from ? `${p.file}:${p.from}-${p.to}` : `${p.file}:${p.from ?? p.line}`);
const short = (text, n = 60) => (text.length > n ? `${text.slice(0, n - 1)}…` : text);
const at = (file, line) => [{ file, from: line }];

export const cycle = (c) => ({
  where: c.files[0],
  what: `${c.files.length} files import each other in a loop: ${c.loop.join(' → ')}`,
  fix: 'Move what both sides need into a third file that neither of them imports from, or pass the value in instead of importing it.',
  effort: c.files.length > 3 ? 'large' : 'medium',
  places: c.files.map((file) => ({ file, from: 1 })),
});

export const layer = (p) => ({
  where: `${p.file}:${p.line}`,
  what: `${p.fromLayer} imports ${p.to} (${p.toLayer}), which ${p.fromLayer} may not use`,
  fix: `Move the shared part into a layer that ${p.fromLayer} may import, or route the call through the layer that owns it.`,
  effort: 'small',
  places: at(p.file, p.line),
});

export const restricted = (p) => ({
  where: `${p.file}:${p.line}`,
  what: `"${p.module}" is imported outside ${p.onlyIn.join(', ')}`,
  fix: `Call it through ${p.onlyIn[0]} instead of importing it here.`,
  effort: 'small',
  places: at(p.file, p.line),
});

export const duplicate = (d) => ({
  where: d.places.map(spot).join(' | '),
  what: `${d.lines} identical lines in ${d.places.length} places`,
  fix: 'Move the shared lines into one function, component or constant and use it from every place.',
  effort: effortForLines(d.lines),
  places: d.places,
});

export const repeated = (r) => ({
  where: r.places.map(spot).join(' | '),
  what: `${r.kind === 'list' ? 'The same list' : 'The same text'} ${short(r.value)} is written out in ${r.places.length} places`,
  fix: 'Define it once in a shared constants file and import it. Where one copy cannot import (rules files), add a test that checks both match.',
  effort: 'small',
  places: r.places.map((p) => ({ file: p.file, from: p.line })),
});

export const bigFile = (f) => ({
  where: f.file,
  what: `File has ${f.lines} lines (limit ${f.limit})`,
  fix: 'Split it by job into smaller files, each with one clear purpose, and keep the old file as the one place that wires them together.',
  effort: 'large',
  places: at(f.file, 1),
});

export const bigFunction = (f) => ({
  where: `${f.file}:${f.from}-${f.to}`,
  what: `${f.name} has ${f.lines} lines (limit ${f.limit})`,
  fix: 'Pull steps out into named helpers so each function does one thing.',
  effort: 'medium',
  places: [{ file: f.file, from: f.from, to: f.to }],
});
