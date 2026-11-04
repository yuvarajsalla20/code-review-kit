import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { project } from './helpers.mjs';

const check = join(import.meta.dirname, '..', 'scripts', 'check.mjs');
const run = (files, config) => spawnSync('node', [check], { cwd: project({ ...files, 'review.config.json': config }), encoding: 'utf8' });

test('check.mjs still passes a clean project, and runs commands', () => {
  const r = run({ 'src/a.ts': 'export const a = 1;' }, { forbidden: [{ name: 'log', pattern: 'console\\.log\\(', paths: ['src'] }], commands: [{ name: 'ok', run: 'node -e "0"' }] });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /PASS {2}ok/);
  assert.match(r.stdout, /PASS {2}log/);
  assert.match(r.stdout, /PASS {2}secrets scan/);
});

test('check.mjs fails on a banned pattern, a secret and a failing command', () => {
  const r = run(
    { 'src/a.ts': "console.log('x');\nconst password = 'hunter2hunter2';" },
    { forbidden: [{ name: 'log', pattern: 'console\\.log\\(', paths: ['src'] }], commands: [{ name: 'bad', run: 'node -e "process.exit(3)"' }] },
  );
  assert.equal(r.status, 1);
  assert.match(r.stdout, /FAIL {2}bad/);
  assert.match(r.stdout, /FAIL {2}log \(1\)/);
  assert.match(r.stdout, /FAIL {2}secrets scan \(1\)/);
});

test('check.mjs skips node_modules when scanning for secrets', () => {
  const r = run({ 'node_modules/x.js': "const token = 'abcdefgh12345678';" }, { secrets: { paths: ['.'], skip: ['node_modules'] } });
  assert.equal(r.status, 0);
});

const cfg = (extra) => ({ name: 'p', ...extra });

test('a failing command alone fails the run', () => {
  const r = run({ 'src/a.ts': 'export const a = 1;' }, cfg({ commands: [{ name: 'bad', run: 'node -e "process.exit(3)"' }] }));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /FAIL {2}bad/);
});

test('each secret pattern fails the run', () => {
  for (const text of ['const k = "AKIAABCDEFGHIJKLMNOP";', '-----BEGIN RSA PRIVATE KEY-----', '{ "private_key": "x" }']) {
    const r = run({ 'src/a.ts': text }, cfg({ secrets: { paths: ['src'], skip: [] } }));
    assert.equal(r.status, 1, text);
    assert.match(r.stdout, /FAIL {2}secrets scan/);
  }
});

test('a typo in a configured path or gate name stops the run instead of switching a check off', () => {
  const typoPath = run({ 'src/a.ts': 'export const a = 1;' }, cfg({ forbidden: [{ name: 'log', pattern: 'x', paths: ['scr'] }] }));
  assert.equal(typoPath.status, 1);
  assert.match(typoPath.stdout, /path not found: scr/);
  const typoSecrets = run({ 'src/a.ts': 'x' }, cfg({ secrets: { paths: ['scr'], skip: [] } }));
  assert.equal(typoSecrets.status, 1);
  assert.match(typoSecrets.stdout, /path not found: scr/);
  const typoGate = run({ 'src/a.ts': "import './a';" }, cfg({ structure: { roots: ['src'], gate: ['cycle'] } }));
  assert.equal(typoGate.status, 2);
  assert.match(typoGate.stderr, /Unknown gate name: cycle/);
  const typoRisky = run({ 'src/a.ts': 'x', 'tests/a.test.ts': "import '../src/a';" }, cfg({ structure: { roots: ['src'] }, tests: { risky: ['scr'] } }));
  assert.equal(typoRisky.status, 2);
  assert.match(typoRisky.stderr, /tests\.risky matches no source file: scr/);
});

test('a config that is not valid JSON gives one clear line, not a stack trace', () => {
  const r = run({ 'src/a.ts': 'x' }, '{ not json');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /is not valid JSON/);
  assert.doesNotMatch(r.stderr, /at .*\.mjs/);
});

test('check.mjs runs the agents checks when the config has an agents block', () => {
  const bad = '---\nname: a\ndescription: d\ntools: Read, Write\n---\n## Method\nx\n## Rules\nSee `rules/review-rules.md`.\n## Output\nx\n';
  const r = run({ 'agents/x/a.md': bad, 'skills/s/SKILL.md': '`a`', 'rules/review-rules.md': '# r' }, cfg({ agents: {} }));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /FAIL {2}frontmatter/);
});
