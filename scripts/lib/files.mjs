// Shared by every script: finding and reading project files. No dependencies.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { ConfigError } from './findings.mjs';

/** Text files worth scanning for secrets and banned patterns. */
export const TEXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|html|css|rules|yml|yaml|env|txt)$/i;
/** Code files that can import each other. */
export const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs)$/i;
/** Folders no check should ever enter. */
export const ALWAYS_SKIP = ['node_modules', '.git', 'dist', 'build', '.expo', 'coverage'];

/** What a review writes into the project (reports, hand-off files). They quote the code and the findings, so no scan reads them. */
export const REVIEW_OUTPUT = ['review-out/', './summary.md', './summary.html', './summary.json', './verified.json'];

export const toPosix = (p) => p.split(sep).join('/');

/** True when `path` is `prefix` or lies inside it (so "src/a" does not match "src/ab"). */
export const inside = (path, prefix) => {
  const p = prefix.replace(/\/+$/, '');
  return path === p || path.startsWith(`${p}/`);
};

/**
 * True when a `skip` list leaves out the file or folder at `rel` (relative to the project, forward slashes).
 * An entry with a slash, or starting with `./`, is a path from the project root (`src/theme.ts`, `src/generated/`);
 * one without is a file or folder name anywhere (`node_modules`, `package-lock.json`).
 */
export const skipped = (skip, rel) => {
  const name = rel.split('/').at(-1);
  return skip.some((s) => {
    const p = s.replace(/^\.\//, '').replace(/\/+$/, '');
    return s.includes('/') ? inside(rel, p) : name === p;
  });
};

/**
 * Every matching file under `dir` smaller than `maxBytes`, leaving out what `skip` names (see `skipped`).
 * `base` is the project root that path entries in `skip` are read from (default `dir`).
 */
export function* walk(dir, skip = [], match = TEXT, maxBytes = 1_000_000, base = dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (skipped(skip, toPosix(relative(base, full)))) continue;
    const info = statSync(full);
    if (info.isDirectory()) yield* walk(full, skip, match, maxBytes, base);
    else if (match.test(name) && info.size < maxBytes) yield full;
  }
}

/**
 * The files a check should look at: everything under `roots` (folders or single files) that matches `match`,
 * minus anything under an `ignore` prefix. `maxBytes` (default 1 MB) lets a check look at big files, such as images. Paths are relative to `root`, with forward slashes.
 */
export function listFiles(root, roots, { ignore = [], match = SOURCE, maxBytes } = {}) {
  const found = new Set();
  for (const base of roots) {
    const start = join(root, base);
    if (!existsSync(start)) continue;
    const files = statSync(start).isDirectory() ? walk(start, ALWAYS_SKIP, match, maxBytes) : [start];
    for (const file of files) found.add(toPosix(relative(root, file)));
  }
  return [...found].filter((f) => !ignore.some((i) => inside(f, i))).sort();
}

/**
 * `listFiles` for the folders a check reads its code from, with the two mistakes that would make it pass on nothing stopped:
 * a folder the owner named (`configured`) that does not exist, and roots that hold no matching file at all (unless `allowEmpty`:
 * a check that reads other files too, such as images). `label` names the setting.
 */
export function checkedFiles(root, roots, { label, configured = false, allowEmpty = false, ...options } = {}) {
  if (configured) {
    const missing = roots.filter((r) => !existsSync(join(root, r)));
    if (missing.length) throw new ConfigError(`${label}: ${missing.join(', ')} ${missing.length > 1 ? 'do' : 'does'} not exist. Check the spelling in review.config.json.`);
  }
  const files = listFiles(root, roots, options);
  if (!files.length && !allowEmpty) throw new ConfigError(`${label} (${roots.join(', ')}) holds no source files, so this check would pass without reading any code. Point it at the folders that hold the code.`);
  return files;
}

export const readText = (root, path) => readFileSync(join(root, path), 'utf8');
