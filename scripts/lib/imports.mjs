// Who imports whom. Works on comment-stripped text (see source.mjs).
import { posix } from 'node:path';
import { lineFinder } from './source.mjs';

const STATIC = /(?:^|\n)[ \t]*(import|export)\s+(type\s+)?(?:[^'";]*?\s+from\s+)?(['"])([^'"\n]+)\3/g;
const SIDE_EFFECT = /(?:^|\n)[ \t]*import\s+(['"])([^'"\n]+)\1/g;
const DYNAMIC = /\b(?:import|require)\(\s*(['"])([^'"\n]+)\1\s*\)/g;
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];

/** Every import in a file: { spec, typeOnly, line }. `import type` and `export type` are marked typeOnly. */
export function parseImports(clean) {
  const at = lineFinder(clean);
  const found = [];
  for (const m of clean.matchAll(STATIC)) found.push({ spec: m[4], typeOnly: !!m[2], line: at(m.index + m[0].indexOf(m[3])) });
  for (const m of clean.matchAll(SIDE_EFFECT)) found.push({ spec: m[2], typeOnly: false, line: at(m.index + m[0].indexOf(m[1])) });
  for (const m of clean.matchAll(DYNAMIC)) found.push({ spec: m[2], typeOnly: false, line: at(m.index) });
  const seen = new Set();
  return found.filter((f) => !seen.has(`${f.spec}|${f.line}`) && seen.add(`${f.spec}|${f.line}`));
}

/** The project file an import points at, or null for packages and files that are not in the set. */
export function resolveImport(from, spec, files, aliases = {}) {
  let base;
  for (const [prefix, target] of Object.entries(aliases)) if (spec.startsWith(prefix)) base = posix.normalize(target + spec.slice(prefix.length));
  if (base === undefined) {
    if (!spec.startsWith('.')) return null;
    base = posix.normalize(posix.join(posix.dirname(from), spec));
  }
  const swapped = base.replace(/\.(m|c)?jsx?$/, '');
  const tries = [base, ...EXTENSIONS.map((e) => base + e), ...EXTENSIONS.map((e) => `${base}/index${e}`), ...EXTENSIONS.map((e) => swapped + e)];
  return tries.find((t) => files.has(t)) ?? null;
}

/**
 * The import graph of a set of files: `edges` (file to the project files it imports) and `externals`
 * (file to the packages it imports). `texts` maps each path to its comment-stripped text.
 */
export function buildGraph(texts, aliases = {}) {
  const files = new Set(texts.keys());
  const edges = new Map();
  const externals = new Map();
  for (const [file, clean] of texts) {
    const to = [];
    const out = [];
    for (const imp of parseImports(clean)) {
      const target = resolveImport(file, imp.spec, files, aliases);
      if (target) to.push({ to: target, typeOnly: imp.typeOnly, line: imp.line });
      else if (!imp.spec.startsWith('.')) out.push({ spec: imp.spec, line: imp.line });
    }
    edges.set(file, to);
    externals.set(file, out);
  }
  return { edges, externals };
}
