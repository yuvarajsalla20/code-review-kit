#!/usr/bin/env node
// review-kit automated checks. No dependencies. Run from the project root:
//   node path/to/review-kit/scripts/check.mjs [path/to/review.config.json] [--results results.json]
// Exit code 1 if any command fails, any forbidden or secret match is found, or a gated check finds something.
// Exit code 3 (Incomplete) when everything that ran passed but an area that applies has no config block and is not in `skipAreas`.
import { readFileSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { AREAS, coverage } from './areas.mjs';
import { guard, loadConfig, parseArgs } from './lib/cli.mjs';
import { walk } from './lib/files.mjs';
import { printSection } from './lib/section.mjs';

const root = process.cwd();
const args = parseArgs();
const config = loadConfig(root, args.configPath);
/** The commands' outcomes, written with --results file.json in the shape summary.mjs --extra reads, so the summary shows them. */
const ran = [];
const SECRET_PATTERNS = [
  ['private key block', /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/],
  ['service account key', /"private_key"\s*:/],
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['generic secret assignment', /(secret|password|passwd|token)\s*[:=]\s*['"][^'"\s]{8,}['"]/i],
];

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

// 2. Forbidden patterns
console.log('\n== Forbidden patterns ==');
for (const rule of config.forbidden || []) {
  const re = new RegExp(rule.pattern);
  let hits = 0;
  for (const base of rule.paths || ['.']) {
    const start = join(root, base);
    if (!existsSync(start)) {
      fail(`forbidden:${rule.name}`, `path not found: ${base} (check the spelling in review.config.json)`);
      hits++;
      continue;
    }
    const files = statSync(start).isDirectory() ? walk(start, ['node_modules', '.git']) : [start];
    for (const file of files) {
      readFileSync(file, 'utf8').split('\n').forEach((text, i) => {
        if (re.test(text)) { hits++; fail(`forbidden:${rule.name}`, `${relative(root, file)}:${i + 1}  ${text.trim().slice(0, 100)}`); }
      });
    }
  }
  console.log(`${hits ? 'FAIL' : 'PASS'}  ${rule.name}${hits ? ` (${hits})` : ''}`);
}

// 3. Secrets
console.log('\n== Secrets ==');
let secretHits = 0;
const secretCfg = config.secrets || { paths: ['.'], skip: ['node_modules', '.git'] };
for (const base of secretCfg.paths) {
  if (!existsSync(join(root, base))) {
    fail('secret:path', `path not found: ${base} (check secrets.paths in review.config.json)`);
    secretHits++;
    continue;
  }
  for (const file of walk(join(root, base), secretCfg.skip || [])) {
    readFileSync(file, 'utf8').split('\n').forEach((text, i) => {
      for (const [label, re] of SECRET_PATTERNS) {
        if (re.test(text)) { secretHits++; fail(`secret:${label}`, `${relative(root, file)}:${i + 1}`); }
      }
    });
  }
}
console.log(`${secretHits ? 'FAIL' : 'PASS'}  secrets scan${secretHits ? ` (${secretHits})` : ''}`);

// 4. The script-based areas: structure, release, tests, agents (each when the config has its block)
for (const area of AREAS.filter((a) => config[a.key] && !a.slow)) {
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
