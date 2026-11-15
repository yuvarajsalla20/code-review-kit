#!/usr/bin/env node
// Firestore security rules and load, on the local emulator, with the project's real rules:
//   node path/to/review-kit/scripts/firestore-load.mjs [review.config.json] [--report load.md] [--results load.json]
// Needs Java and network for the first run (it installs firebase-tools and the rules test library into a cache folder outside the project).
// Never touches a real Firebase project: the project id must start with "demo-". Never writes to the project unless --report or --results says where.
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { guard, loadConfig, parseArgs, projectName } from './lib/cli.mjs';
import { KIT_VERSION } from './lib/version.mjs';
import { loadPlan, readRun } from './load/plan.mjs';

const root = process.cwd();
const args = parseArgs();
const config = loadConfig(root, args.configPath);
const plan = guard(() => loadPlan(config));
if (!existsSync(join(root, plan.rules))) {
  console.error(`Rules file not found: ${plan.rules} (set firestoreLoad.rules).`);
  process.exit(2);
}
if (spawnSync('java', ['-version']).status !== 0) {
  console.error('The Firestore emulator needs Java (11 or newer). Install it, then run again.');
  process.exit(2);
}

const work = process.env.REVIEW_KIT_LOAD_DIR ?? join(homedir(), '.cache', 'review-kit', 'firestore-load');
mkdirSync(work, { recursive: true });
if (!existsSync(join(work, 'node_modules', '@firebase', 'rules-unit-testing'))) {
  console.log(`Installing the emulator tools into ${work} (first run only)...`);
  writeFileSync(join(work, 'package.json'), '{"name":"review-kit-firestore-load","private":true,"type":"module"}\n');
  const install = spawnSync('npm', ['install', '--no-audit', '--no-fund', '--legacy-peer-deps', 'firebase-tools', '@firebase/rules-unit-testing', 'firebase'], { cwd: work, stdio: 'inherit' });
  if (install.status !== 0) process.exit(2);
}
copyFileSync(join(root, plan.rules), join(work, 'firestore.rules'));
copyFileSync(new URL('./load/runner.mjs', import.meta.url), join(work, 'runner.mjs'));
writeFileSync(join(work, 'plan.json'), JSON.stringify(plan));
writeFileSync(join(work, 'firebase.json'), JSON.stringify({ firestore: { rules: 'firestore.rules' }, emulators: { firestore: { host: '127.0.0.1', port: plan.port }, ui: { enabled: false } } }));

console.log(`Starting the Firestore emulator: ${plan.users} users x ${plan.perUser} items, a ${plan.heavy}-item account...`);
const runRes = spawnSync('npx', ['firebase', 'emulators:exec', '--only', 'firestore', '--project', plan.projectId, 'node runner.mjs'], { cwd: work, encoding: 'utf8', maxBuffer: 50_000_000 });
const { rows, ok } = readRun(runRes.stdout ?? '');
if (!rows.length) {
  console.error(`The emulator run produced no results.\n${(runRes.stderr || runRes.stdout || '').slice(-2000)}`);
  process.exit(2);
}
const table = (kind) => ['| Test | Result | Detail |', '|---|---|---|', ...rows.filter((r) => r.kind === kind).map((r) => `| ${r.name} | ${r.ok ? 'Pass' : 'FAIL'} | ${r.detail || '-'} |`)];
const markdown = [
  `# Firestore rules and load: ${projectName(config, root)}`, '', `Kit ${KIT_VERSION} - ${new Date().toISOString().slice(0, 10)} - rules: ${plan.rules}`, '',
  `**${rows.filter((r) => r.ok).length} of ${rows.length} passed.**`, '',
  '## Security rules', '', ...table('rules'), '', '## Load', '', ...table('load'), '',
  '## What this cannot show', '',
  '- The emulator runs on one machine: the speeds show the app\'s pattern holds up, not how fast Google\'s servers are.',
  '- Billing: count the reads and writes above, then check the Firebase usage page after a real week.',
  '- App Check, budget alerts and whether these rules are deployed live in the Firebase console.', '',
].join('\n');
if (args.report) writeFileSync(args.report, markdown);
else console.log(markdown);
if (args.results) writeFileSync(args.results, `${JSON.stringify({ results: rows.map((r) => ({ name: `Firestore ${r.kind}: ${r.name}`, result: r.ok ? 'pass' : 'fail', detail: r.detail })) }, null, 2)}\n`);
process.exit(ok ? 0 : 1);
