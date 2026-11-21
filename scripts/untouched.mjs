#!/usr/bin/env node
// Shows that the reviewers changed nothing in the project. Reviewer agents have Bash, which can write, so the rule that they never
// edit rests on their wording; this checks it afterwards.
//   node path/to/review-kit/scripts/untouched.mjs --save <file>      before starting the reviewers (keep the file outside the project, or in review-out/)
//   node path/to/review-kit/scripts/untouched.mjs --compare <file>   after they finish, before writing anything yourself
// --compare exits 1 and lists every added, changed or removed file (and a moved git commit). The review's own output files never count.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { compare, snapshot } from './lib/snapshot.mjs';

const root = process.cwd();
const argv = process.argv.slice(2);
const value = (flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
const save = value('--save');
const against = value('--compare');
if (!save && !against) {
  console.error('Usage: untouched.mjs --save <file> | --compare <file>');
  process.exit(2);
}
if (save) {
  mkdirSync(dirname(save), { recursive: true });
  const s = snapshot(root);
  writeFileSync(save, JSON.stringify(s));
  console.log(`Saved the state of ${Object.keys(s.files).length} files to ${save}.`);
  process.exit(0);
}
let before;
try {
  before = JSON.parse(readFileSync(against, 'utf8'));
} catch (e) {
  console.error(`Could not read ${against}: ${e.message}. Run --save before starting the reviewers.`);
  process.exit(2);
}
const d = compare(before, snapshot(root));
if (d.clean) {
  console.log('Untouched: no project file changed while the reviewers ran.');
  process.exit(0);
}
console.log('CHANGED: the project is not as it was before the reviewers ran. Tell the owner, and do not use these reviewers\' results until it is explained.');
for (const [label, list] of [['Added', d.added], ['Changed', d.changed], ['Removed', d.removed]]) for (const f of list) console.log(`${label}  ${f}`);
if (d.headMoved) console.log(`The git commit moved: ${before.head ?? 'none'} -> now different.`);
process.exit(1);
