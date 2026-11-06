import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runMutation } from '../scripts/mutation/index.mjs';
import { toMarkdown } from '../scripts/mutation/report.mjs';
import { apply, codeOnly, mutantsOf, sample } from '../scripts/mutation/operators.mjs';
import { ConfigError } from '../scripts/lib/findings.mjs';
import { project } from './helpers.mjs';

const kit = join(import.meta.dirname, '..');
const SRC = "export const size = (n) => {\n  if (n > 5) return 'big';\n  return 'small';\n};\nexport const adult = (n) => n >= 18;\n";
const TEST = "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { size, adult } from '../src/a.mjs';\ntest('a', () => {\n  assert.equal(size(10), 'big');\n  assert.equal(size(1), 'small');\n  assert.equal(adult(18), true);\n  assert.equal(adult(3), false);\n});\n";
const fixture = (test = TEST) => project({ 'src/a.mjs': SRC, 'tests/a.test.mjs': test, 'package.json': { name: 'x', type: 'module' } });
const cfg = { mutation: { files: ['src'], run: 'node --test' } };

test('operators: finds swaps in code, not in comments, strings or arrows', () => {
  const text = "// a === b\nconst s = 'x && y';\nconst f = (a) => a !== 1 && !a;\nconst g = a > b ? true : false; // ok\n";
  assert.deepEqual(mutantsOf(text).map((m) => `${m.line}:${m.from.trim()}`), ['3:!==', '3:&&', '3:!', '4:>', '4:true', '4:false']);
  assert.equal(codeOnly("x = 'a=== b' // z").includes('==='), false);
  assert.equal(codeOnly('a\n`b\nc`').split('\n').length, 3, 'lines are kept');
  const m = mutantsOf('const a = b === c;')[0];
  assert.equal(apply('const a = b === c;', m), 'const a = b !== c;');
  assert.equal(apply('if (!ok)', mutantsOf('if (!ok)')[0]), 'if (ok)');
});

test('sample: everything when short, an even and repeatable spread when long', () => {
  assert.deepEqual(sample([1, 2, 3], 5), [1, 2, 3]);
  assert.deepEqual(sample([...Array(10).keys()], 5), [0, 2, 4, 6, 8]);
});

test('a missed change is reported with its line; the strong tests catch the rest; the project is untouched', () => {
  const dir = fixture("import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { size, adult } from '../src/a.mjs';\ntest('a', () => {\n  assert.equal(size(6), 'big');\n  assert.equal(size(5), 'small');\n  assert.equal(adult(30), true);\n  assert.equal(adult(3), false);\n});\n");
  const before = readFileSync(join(dir, 'src/a.mjs'), 'utf8');
  const r = runMutation(cfg, dir);
  assert.equal(readFileSync(join(dir, 'src/a.mjs'), 'utf8'), before);
  assert.deepEqual(r.findings.map((f) => f.where), ['src/a.mjs:5']);
  assert.equal(r.findings[0].gate, false, 'advisory');
  assert.deepEqual(r.stats, { total: 2, tried: 2, killed: 1, survived: 1 });
  assert.match(toMarkdown('p', '1', 'd', r), /Tried 2 of 2 possible changes: tests caught 1, missed 1/);
});

test('boundary tests catch both changes', () => {
  const r = runMutation(cfg, fixture(TEST.replace("size(10)", 'size(6)').replace("size(1)", 'size(5)')));
  assert.deepEqual(r.findings, []);
  assert.equal(r.stats.killed, 2);
});

test('maxMutants limits the work; a bad config or failing baseline stops with a clear message', () => {
  assert.equal(runMutation({ mutation: { ...cfg.mutation, maxMutants: 1 } }, fixture()).stats.tried, 1);
  assert.throws(() => runMutation({ mutation: {} }, fixture()), ConfigError);
  assert.throws(() => runMutation({ mutation: { files: ['nope'], run: 'node --test' } }, fixture()), /matches no source file/);
  assert.throws(() => runMutation(cfg, project({ 'src/a.mjs': SRC, 'tests/a.test.mjs': TEST.replace("'big')", "'nope')"), 'package.json': { type: 'module' } })), /do not pass on an unchanged copy/);
});

test('it is not part of the default run, but --areas mutation and mutate.mjs run it', () => {
  const dir = fixture();
  const files = { ...cfg.mutation };
  const withCfg = project({ 'src/a.mjs': SRC, 'tests/a.test.mjs': TEST, 'package.json': { type: 'module' }, 'review.config.json': { mutation: files, speed: { roots: ['src'] } } });
  const summary = spawnSync('node', [join(kit, 'scripts/summary.mjs')], { cwd: withCfg, encoding: 'utf8' }).stdout;
  assert.doesNotMatch(summary, /Test strength/);
  const check = spawnSync('node', [join(kit, 'scripts/check.mjs')], { cwd: withCfg, encoding: 'utf8' }).stdout;
  assert.doesNotMatch(check, /Mutation/);
  const named = spawnSync('node', [join(kit, 'scripts/mutate.mjs')], { cwd: withCfg, encoding: 'utf8' });
  assert.equal(named.status, 0);
  assert.match(named.stdout, /Mutation check \(advisory\)/);
  assert.match(spawnSync('node', [join(kit, 'scripts/summary.mjs'), '--areas', 'mutation'], { cwd: withCfg, encoding: 'utf8' }).stdout, /Test strength|Mutation/);
  assert.ok(dir);
});

test('an escaped quote does not end a string early', () => {
  assert.deepEqual(mutantsOf("const s = 'it\\'s === ok';"), []);
});
