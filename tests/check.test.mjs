import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const check = join(import.meta.dirname, '..', 'scripts', 'check.mjs');
const run = (files, config) => {
  const root = mkdtempSync(join(tmpdir(), 'review-kit-check-'));
  mkdirSync(join(root, 'src'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(root, name), text);
  writeFileSync(join(root, 'review.config.json'), JSON.stringify(config));
  return spawnSync('node', [check], { cwd: root, encoding: 'utf8' });
};

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
  const root = mkdtempSync(join(tmpdir(), 'review-kit-check-'));
  mkdirSync(join(root, 'node_modules'));
  writeFileSync(join(root, 'node_modules', 'x.js'), "const token = 'abcdefgh12345678';");
  writeFileSync(join(root, 'review.config.json'), JSON.stringify({ secrets: { paths: ['.'], skip: ['node_modules'] } }));
  assert.equal(spawnSync('node', [check], { cwd: root, encoding: 'utf8' }).status, 0);
});
