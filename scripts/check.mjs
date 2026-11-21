#!/usr/bin/env node
// review-kit automated checks. No dependencies. Run from the project root:
//   node path/to/review-kit/scripts/check.mjs [path/to/review.config.json] [--results results.json]
// Exit code 1 if any command fails, any forbidden or secret match is found, or a gated check finds something.
// Exit code 3 (Incomplete) when everything that ran passed but an area that applies has no config block and is not in `skipAreas`.
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { AREAS, coverage } from './areas.mjs';
import { guard, loadConfig, parseArgs } from './lib/cli.mjs';
import { printSection, printStale } from './lib/section.mjs';

const root = process.cwd();
const args = parseArgs();
const config = loadConfig(root, args.configPath);
/** The commands' outcomes, written with --results file.json in the shape summary.mjs --extra reads, so the summary shows them. */
const ran = [];

const results = [];
const fail = (section, line) => results.push({ section, line });

/** The line a test runner ends with ("Tests  271 passed", "# pass 94"), or nothing. */
const lastCountLine = (out) => (String(out).split('\n').map((l) => l.replace(/\x1b\[[0-9;]*m/g, '').trim()).filter((l) => /\b(pass|passed|failed|fail|tests?)\b/i.test(l) && /\d/.test(l) && !/^duration/i.test(l)).slice(-2).join('; ') || '').slice(0, 160);

// 1. Commands
console.log('== Commands ==');
for (const { name, run } of config.commands || []) {
  try {
    const out = execSync(run, { cwd: root, stdio: 'pipe', encoding: 'utf8' });
    console.log(`PASS  ${name}`);
    ran.push({ name, result: 'pass', detail: lastCountLine(out) });
  } catch (e) {
    console.log(`FAIL  ${name}`);
    ran.push({ name, result: 'fail', detail: lastCountLine(String(e.stdout || e.stderr || e.message)) });
    fail(`command:${name}`, String(e.stdout || e.stderr || e.message).trim().split('\n').slice(0, 15).join('\n'));
  }
}

// 2 and 3. The banned patterns and the secrets scan: the same areas summary.mjs runs, so both read the same rows
// and an accepted false alarm (review.accepted.json, area "secrets" or "forbidden") stops counting in both.
const areaOf = (key) => AREAS.find((a) => a.key === key);
const forbidden = guard(() => areaOf('forbidden').run(config, root));
console.log('\n== Forbidden patterns ==');
for (const name of forbidden.gate) {
  const rows = forbidden.findings.filter((f) => f.check === name);
  const accepted = forbidden.accepted.filter((f) => f.check === name).length;
  console.log(`${rows.length ? 'FAIL' : 'PASS'}  ${name}${rows.length ? ` (${rows.length})` : ''}${accepted ? ` (${accepted} accepted)` : ''}`);
  for (const f of rows) fail(`forbidden:${name}`, `${f.where}  ${f.what}`);
}
printStale(forbidden);

const secrets = guard(() => areaOf('secrets').run(config, root));
console.log('\n== Secrets ==');
console.log(`Read ${secrets.files} files.`);
console.log(`${secrets.findings.length ? 'FAIL' : 'PASS'}  secrets scan${secrets.findings.length ? ` (${secrets.findings.length})` : ''}${secrets.accepted.length ? ` (${secrets.accepted.length} accepted)` : ''}`);
// The value itself is never printed: the output may be pasted or emailed.
for (const f of secrets.findings) fail(`secret:${f.what}`, f.where);
printStale(secrets);

// 4. The script-based areas: structure, release, tests, agents (each when the config has its block)
for (const area of AREAS.filter((a) => config[a.key] && !a.slow && !a.always)) {
  printSection(area.title, area.checks, guard(() => area.run(config, root)), fail, `Review items are not failures: run scripts/${area.script} --report to get the table for the owner.`);
}

// Areas with no block in the config were not checked. A run that skipped an area is Incomplete, not passed, unless the owner
// skipped it on purpose, with a reason, in `skipAreas` ({ "agents": "this project has no reviewer agents" }).
const { applicable, notRun, skipped } = coverage(config, root);
if (skipped.length) {
  console.log('\n== Skipped on purpose ==');
  for (const a of skipped) console.log(`${a.key}: ${config.skipAreas[a.key]}`);
}
if (notRun.length) {
  console.log('\n== Not run ==');
  console.log(`${notRun.map((a) => a.key).join(', ')}: no block in review.config.json, so these checks did not run.`);
  console.log('Add them (node <kit>/scripts/upgrade.mjs --write), or skip one on purpose with a reason under "skipAreas".');
}

if (args.results) {
  writeFileSync(args.results, `${JSON.stringify({ results: ran }, null, 2)}\n`);
  // Secret and forbidden hits are not copied here: summary.mjs runs the same scans itself, so they would count twice.
  console.log(`\nCommand results written to ${args.results} (pass it to summary.mjs with --extra).`);
}

// Report
if (results.length) {
  console.log('\n== Details ==');
  for (const r of results) console.log(`[${r.section}] ${r.line}`);
  process.exit(1);
}
if (notRun.length) {
  console.log(`\nINCOMPLETE: the checks that ran passed, but ${notRun.length} of ${applicable.length} areas did not run (see above). This is not a pass.`);
  process.exit(3);
}
console.log('\nAll automated checks passed.');
