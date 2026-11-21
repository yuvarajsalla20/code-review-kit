// What the project looks like now, so the skills can show a reviewer changed nothing: every file's size and content hash, and the git commit.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { ALWAYS_SKIP, REVIEW_OUTPUT, skipped, toPosix } from './files.mjs';

/** `{ files: { path: hash }, head }` for the project at `root`, leaving out the review's own output and `ignore` (names or paths, as in secrets.skip). */
export function snapshot(root, ignore = []) {
  const skip = [...ALWAYS_SKIP, ...REVIEW_OUTPUT, ...ignore];
  const files = {};
  const visit = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const rel = toPosix(relative(root, full));
      if (skipped(skip, rel)) continue;
      const info = statSync(full, { throwIfNoEntry: false });
      if (!info) continue;
      if (info.isDirectory()) visit(full);
      else if (info.isFile()) files[rel] = info.size > 20_000_000 ? `size:${info.size}:${info.mtimeMs}` : createHash('sha1').update(readFileSync(full)).digest('hex');
    }
  };
  visit(root);
  const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  return { files, head: git.status === 0 && git.stdout ? git.stdout.trim() : null };
}

/** The files added, changed and removed between two snapshots, and whether the git commit moved. */
export function compare(before, after) {
  const added = Object.keys(after.files).filter((f) => !(f in before.files));
  const removed = Object.keys(before.files).filter((f) => !(f in after.files));
  const changed = Object.keys(after.files).filter((f) => f in before.files && before.files[f] !== after.files[f]);
  return { added, removed, changed, headMoved: before.head !== after.head, clean: !added.length && !removed.length && !changed.length && before.head === after.head };
}
