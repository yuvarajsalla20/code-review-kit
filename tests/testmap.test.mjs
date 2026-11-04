import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { runTestMap } from '../scripts/testmap/index.mjs';
import { toMarkdown } from '../scripts/testmap/report.mjs';
import { project } from './helpers.mjs';

const files = {
  'src/notify/a.ts': "import { b } from '../shared/b';\nexport const a = b;",
  'src/shared/b.ts': 'export const b = 1;',
  'src/notify/c.ts': 'export const c = 2;\n'.repeat(120),
  'src/screens/Home.tsx': 'export const Home = 1;',
  'tests/a.test.ts': "import { a } from '../src/notify/a';\n",
};

test('a file is reached by a test directly or through another file; the rest are listed', () => {
  const result = runTestMap({ tests: { risky: ['src/notify'] } }, project(files));
  assert.deepEqual(result.findings.map((f) => f.where), ['src/notify/c.ts']);
  assert.equal(result.findings[0].effort, 'medium');
  assert.equal(result.findings[0].gate, false);
  assert.equal(result.tests, 1);
  assert.equal(result.risky, 2);
});

test('without a risky list every source file is checked, and test files are never counted as sources', () => {
  const result = runTestMap({}, project(files));
  assert.deepEqual(result.findings.map((f) => f.where).sort(), ['src/notify/c.ts', 'src/screens/Home.tsx']);
});

test('no test files at all is one finding', () => {
  const result = runTestMap({}, project({ 'src/a.ts': 'export const a = 1;' }));
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].what, 'No test files found');
});

test('report and command line', () => {
  const root = project({ ...files, 'review.config.json': { name: 'demo', tests: { risky: ['src/notify'], gate: ['untested'] } } });
  const md = toMarkdown('demo', '1.5.0', '2026-11-04', runTestMap({ tests: { risky: ['src/notify'] } }, root));
  assert.match(md, /# Test map: demo/);
  assert.match(md, /Risky files no test reaches/);
  assert.match(md, /src\/notify\/c\.ts/);
  const run = (cwd) => spawnSync('node', [join(import.meta.dirname, '..', 'scripts', 'testmap.mjs')], { cwd, encoding: 'utf8' });
  assert.equal(run(root).status, 1, 'gated when the owner puts untested in the gate list');
});
