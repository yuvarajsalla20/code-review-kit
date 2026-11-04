// Shared by every script: finding and reading project files. No dependencies.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** Text files worth scanning for secrets and banned patterns. */
export const TEXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|html|css|rules|yml|yaml|env|txt)$/i;
/** Code files that can import each other. */
export const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs)$/i;
/** Folders no check should ever enter. */
export const ALWAYS_SKIP = ['node_modules', '.git', 'dist', 'build', '.expo', 'coverage'];

export const toPosix = (p) => p.split(sep).join('/');

/** Every matching file under `dir`, skipping folders named in `skip`. */
export function* walk(dir, skip = [], match = TEXT) {
  for (const name of readdirSync(dir)) {
    if (skip.includes(name)) continue;
    const full = join(dir, name);
    const info = statSync(full);
    if (info.isDirectory()) yield* walk(full, skip, match);
    else if (match.test(name) && info.size < 1_000_000) yield full;
  }
}

/** True when `path` is `prefix` or lies inside it (so "src/a" does not match "src/ab"). */
export const inside = (path, prefix) => {
  const p = prefix.replace(/\/+$/, '');
  return path === p || path.startsWith(`${p}/`);
};

/**
 * The files a check should look at: everything under `roots` (folders or single files) that matches `match`,
 * minus anything under an `ignore` prefix. Paths are relative to `root`, with forward slashes.
 */
export function listFiles(root, roots, { ignore = [], match = SOURCE } = {}) {
  const found = new Set();
  for (const base of roots) {
    const start = join(root, base);
    if (!existsSync(start)) continue;
    const files = statSync(start).isDirectory() ? walk(start, ALWAYS_SKIP, match) : [start];
    for (const file of files) found.add(toPosix(relative(root, file)));
  }
  return [...found].filter((f) => !ignore.some((i) => inside(f, i))).sort();
}

export const readText = (root, path) => readFileSync(join(root, path), 'utf8');
