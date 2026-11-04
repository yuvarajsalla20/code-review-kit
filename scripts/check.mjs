#!/usr/bin/env node
// review-kit automated checks. No dependencies. Run from the project root:
//   node path/to/review-kit/scripts/check.mjs [path/to/review.config.json]
// Exit code 1 if any command fails, any forbidden or secret match is found, or a gated check (structure, release, tests, agents) finds something.
import { readFileSync, statSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { AREAS } from './areas.mjs';
import { guard, loadConfig, parseArgs } from './lib/cli.mjs';
import { walk } from './lib/files.mjs';
import { printSection } from './lib/section.mjs';

const root = process.cwd();
const config = loadConfig(root, parseArgs().configPath);
const SECRET_PATTERNS = [
  ['private key block', /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/],
  ['service account key', /"private_key"\s*:/],
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['generic secret assignment', /(secret|password|passwd|token)\s*[:=]\s*['"][^'"\s]{8,}['"]/i],
];

const results = [];
const fail = (section, line) => results.push({ section, line });

// 1. Commands
console.log('== Commands ==');
for (const { name, run } of config.commands || []) {
  try {
    execSync(run, { cwd: root, stdio: 'pipe', encoding: 'utf8' });
    console.log(`PASS  ${name}`);
  } catch (e) {
    console.log(`FAIL  ${name}`);
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
for (const area of AREAS.filter((a) => config[a.key])) {
  printSection(area.title, area.checks, guard(() => area.run(config, root)), fail, `Review items are not failures: run scripts/${area.script} --report to get the table for the owner.`);
}

// Report
if (results.length) {
  console.log('\n== Details ==');
  for (const r of results) console.log(`[${r.section}] ${r.line}`);
  process.exit(1);
}
console.log('\nAll automated checks passed.');
