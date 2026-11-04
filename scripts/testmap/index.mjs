// Which risky files no test reaches. A test reaches a file when it imports it, directly or through other files.
import { SOURCE, inside, listFiles, readText } from '../lib/files.mjs';
import { buildGraph } from '../lib/imports.mjs';
import { stripComments } from '../lib/source.mjs';

export const CHECKS = ['untested'];
const DEFAULTS = { paths: ['tests'], risky: [], gate: [] };

const effortFor = (lines) => (lines < 60 ? 'small' : lines < 200 ? 'medium' : 'large');

export function runTestMap(config, root) {
  const s = { ...DEFAULTS, ...config.tests };
  const structure = config.structure ?? {};
  const roots = structure.roots ?? ['src'];
  const sources = listFiles(root, roots, { ignore: [...(structure.ignore ?? []), ...s.paths], match: SOURCE });
  const tests = listFiles(root, s.paths, { match: SOURCE });
  const texts = new Map([...sources, ...tests].map((f) => [f, stripComments(readText(root, f))]));
  const { edges } = buildGraph(texts, structure.aliases ?? {});

  const reached = new Set();
  const queue = [...tests];
  while (queue.length) {
    const f = queue.pop();
    for (const { to } of edges.get(f) ?? []) if (!reached.has(to)) {
      reached.add(to);
      queue.push(to);
    }
  }
  const risky = sources.filter((f) => (s.risky.length ? s.risky.some((p) => inside(f, p)) : true));
  const findings = !tests.length
    ? [{ check: 'untested', gate: s.gate.includes('untested'), where: s.paths.join(', '), what: 'No test files found', fix: 'Add tests for the paths that must never fail.', effort: 'large', places: [] }]
    : risky.filter((f) => !reached.has(f)).map((f) => {
        const lines = texts.get(f).split('\n').length;
        return { check: 'untested', gate: s.gate.includes('untested'), where: f, what: `No test imports this file, directly or through another file (${lines} lines)`, fix: 'Add a test for its behaviour. If it is only wiring or layout, say so and accept it.', effort: effortFor(lines), places: [{ file: f, from: 1 }] };
      });
  return { findings, counts: { untested: findings.length }, gate: s.gate, files: sources.length, tests: tests.length, risky: risky.length, settings: s };
}
