import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AREAS, KNOWN_CHECKS } from '../scripts/areas.mjs';
import { applyAccepted, fileOf, loadAccepted } from '../scripts/lib/accepted.mjs';
import { acceptedSection } from '../scripts/lib/table.mjs';
import { project } from './helpers.mjs';

const kit = join(import.meta.dirname, '..');
const node = (script, cwd, ...args) => spawnSync('node', [join(kit, 'scripts', script), ...args], { cwd, encoding: 'utf8' });
const entry = (extra = {}) => ({ area: 'speed', check: 'lists', file: 'src/a.tsx', reason: 'Always 14 items', date: '2026-11-06', ...extra });
const LIST = '<ScrollView>\n  {items.map((i) => <Row key={i} />)}\n</ScrollView>';
const root = (accepted, files = { 'src/a.tsx': LIST }) => project({ ...files, 'review.config.json': { speed: {} }, ...(accepted ? { 'review.accepted.json': accepted } : {}) });
const speed = AREAS.find((a) => a.key === 'speed');

test('an accepted row moves out of the findings, keeps its reason, and the counts follow', () => {
  const r = speed.run({ speed: {} }, root([entry()]));
  assert.equal(r.findings.length, 0);
  assert.equal(r.counts.lists, 0);
  assert.deepEqual(r.accepted.map((f) => [f.check, f.where, f.reason, f.date]), [['lists', 'src/a.tsx:1', 'Always 14 items', '2026-11-06']]);
  assert.deepEqual(r.stale, []);
});

test('without the file, or for another file or check, nothing changes', () => {
  assert.equal(speed.run({ speed: {} }, root(null)).findings.length, 1);
  assert.equal(speed.run({ speed: {} }, root([entry({ file: 'src/b.tsx' })])).findings.length, 1);
  assert.equal(speed.run({ speed: {} }, root([entry({ check: 'cleanup' })])).findings.length, 1);
  assert.equal(speed.run({ speed: {} }, root([entry({ area: 'structure', check: 'size' })])).findings.length, 1, 'another area never matches');
});

test('contains narrows an entry to one kind of row in the file', () => {
  const both = { 'src/a.ts': 'const id = setInterval(tick, 1000);\nuseEffect(() => {\n  onSnapshot(q, cb);\n}, []);' };
  const only = (extra) => speed.run({ speed: {} }, root([entry({ check: 'cleanup', file: 'src/a.ts', ...extra })], both));
  assert.equal(only({}).accepted.length, 2, 'without contains, every cleanup row in the file');
  const narrowed = only({ contains: 'repeating timer' });
  assert.deepEqual(narrowed.accepted.map((f) => f.what.slice(0, 24)), ['A repeating timer is sta']);
  assert.deepEqual(narrowed.findings.map((f) => f.what.slice(0, 20)), ['A live listener is s']);
});

test('an entry only applies to its own area, even when two areas have a check of the same name', () => {
  const result = { findings: [{ check: 'size', gate: false, where: 'x.ts:1-90', what: 'big' }], counts: { size: 1 }, gate: [] };
  const entries = [{ area: 'agents', check: 'size', file: 'x.ts', reason: 'r', date: 'd' }];
  assert.equal(applyAccepted(result, entries, 'structure').findings.length, 1);
  assert.equal(applyAccepted(result, entries, 'agents').findings.length, 0);
});

test('line numbers may move: an entry names the file', () => {
  assert.equal(fileOf('src/a.tsx:12-30'), 'src/a.tsx');
  assert.equal(fileOf('package.json:moment'), 'package.json:moment', 'a package row keeps its name');
  const moved = speed.run({ speed: {} }, root([entry()], { 'src/a.tsx': `// moved down\n\n\n${LIST}` }));
  assert.equal(moved.accepted.length, 1);
});

test('an entry that matches nothing is reported as stale, so the file cannot rot', () => {
  const r = speed.run({ speed: {} }, root([entry({ file: 'src/gone.tsx' })]));
  assert.equal(r.findings.length, 1);
  assert.deepEqual(r.stale.map((e) => e.file), ['src/gone.tsx']);
});

test('a gated row that is accepted no longer fails, but it stays listed', () => {
  const r = applyAccepted({ findings: [{ check: 'size', gate: true, where: 'src/a.ts:1-90', what: 'big' }], counts: { size: 1 }, gate: ['size'] }, [{ area: 'structure', check: 'size', file: 'src/a.ts', reason: 'r', date: 'd' }], 'structure');
  assert.equal(r.findings.some((f) => f.gate), false);
  assert.equal(r.accepted.length, 1);
});

test('a mistake in the file stops the run with the entry number: bad JSON, a missing field, an unknown area or check', () => {
  const load = (accepted) => () => loadAccepted(root(accepted), {}, KNOWN_CHECKS);
  assert.throws(load('{'), /review\.accepted\.json is not valid JSON/);
  assert.throws(load({}), /must be a list/);
  for (const key of ['area', 'check', 'file', 'reason', 'date']) assert.throws(load([entry({ [key]: '' })]), new RegExp(`entry 1: "${key}" is required`));
  assert.throws(load([entry(), entry({ area: 'nope' })]), /entry 2: unknown area "nope"/);
  assert.throws(load([entry({ check: 'liss' })]), /"liss" is not a check in speed/);
  assert.equal(load([entry()])().length, 1);
});

test('check.mjs counts accepted rows, flags stale ones, exits 0 for an accepted gated row, and exits 2 on a mistake', () => {
  const dir = root([entry(), entry({ file: 'src/gone.tsx' })]);
  const out = node('check.mjs', dir);
  assert.match(out.stdout, /PASS {2}lists \(1 accepted\)/);
  assert.match(out.stdout, /STALE {2}accepted entry matches nothing now: lists in src\/gone\.tsx/);
  const bad = node('check.mjs', root('{'));
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /Config problem: review\.accepted\.json is not valid JSON/);
});

test('the stand-alone report and the summary both list accepted rows and stale entries', () => {
  const dir = root([entry(), entry({ file: 'src/gone.tsx' })]);
  const report = node('perf.mjs', dir).stdout;
  assert.match(report, /## Accepted earlier/);
  assert.match(report, /Always 14 items/);
  assert.match(report, /## Accepted entries that match nothing/);
  const summary = node('summary.mjs', dir, '--areas', 'speed').stdout;
  assert.match(summary, /## Accepted earlier/);
  assert.match(summary, /\| speed \| src\/a\.tsx:1 \|/);
  assert.match(summary, /## Accepted entries that match nothing/);
  const page = node('summary.mjs', dir, '--areas', 'speed', '--html', join(dir, 'out.html'));
  assert.match(page.stdout, /Page written/);
  assert.match(spawnSync('node', ['-e', `console.log(require('fs').readFileSync(${JSON.stringify(join(dir, 'out.html'))}, 'utf8'))`], { encoding: 'utf8' }).stdout, /Accepted earlier/);
  assert.deepEqual(acceptedSection({}), [], 'nothing to say when nothing was accepted');
});

test('check.mjs lists the areas that did not run, and says so in its last line', () => {
  const some = node('check.mjs', project({ 'src/a.ts': 'export const a = 1;', 'review.config.json': { tests: { paths: ['tests'], risky: [] } } }));
  assert.match(some.stdout, /== Not run ==\nstructure, release, speed: no block/);
  assert.match(some.stdout, /All automated checks that ran passed\. 3 of 4 areas did not run/);
  const all = node('check.mjs', project({ 'src/a.ts': 'export const a = 1;', 'review.config.json': { structure: {}, release: {}, tests: { paths: [] }, speed: {} } }));
  assert.doesNotMatch(all.stdout, /Not run/);
});

test('the agents area counts as not run only in a project that has an agents folder', () => {
  assert.doesNotMatch(node('check.mjs', project({ 'review.config.json': {} })).stdout, /agents/);
  assert.match(node('check.mjs', project({ 'agents/x.md': '', 'review.config.json': {} })).stdout, /agents/);
});

test('upgrade.mjs previews by default, writes only with --write, keeps the config, and adds blocks that gate nothing', () => {
  const files = { 'src/data/a.ts': 'export const a = 1;', 'assets/i.png': 'x', 'tests/a.test.ts': '', 'app.json': '{}', 'review.config.json': { name: 'demo', stack: ['x'] } };
  const dir = project(files);
  const preview = node('upgrade.mjs', dir);
  assert.match(preview.stdout, /Would add "structure"/);
  assert.match(preview.stdout, /Nothing written/);
  assert.deepEqual(JSON.parse(spawnSync('node', ['-e', `console.log(require('fs').readFileSync('review.config.json','utf8'))`], { cwd: dir, encoding: 'utf8' }).stdout), files['review.config.json'], 'unchanged');
  const wrote = node('upgrade.mjs', dir, '--write');
  assert.match(wrote.stdout, /Wrote /);
  const config = JSON.parse(spawnSync('node', ['-e', `console.log(require('fs').readFileSync('review.config.json','utf8'))`], { cwd: dir, encoding: 'utf8' }).stdout);
  assert.equal(config.name, 'demo');
  assert.deepEqual(config.structure, { roots: ['src'], ignore: ['tests'], gate: [] });
  assert.deepEqual(config.tests, { paths: ['tests'], risky: ['src/data'], gate: [] });
  assert.equal(config.release.appConfig, 'app.json');
  assert.deepEqual(config.speed.assetRoots, ['assets']);
  for (const block of ['structure', 'release', 'tests', 'speed']) assert.deepEqual(config[block].gate, [], `${block} gates nothing`);
  assert.match(node('upgrade.mjs', dir).stdout, /already has a block/);
  assert.equal(node('check.mjs', dir).status, 0, 'a project that was green stays green');
});

test('the summary says who verified the rows: agents, self-review, or not run', () => {
  const dir = root([]);
  const run = (extra) => {
    const f = join(dir, 'v.json');
    writeFileSync(f, JSON.stringify(extra));
    return node('summary.mjs', dir, '--areas', 'speed', '--extra', f).stdout;
  };
  assert.match(run({}), /Agent verification: Not run/);
  assert.match(run({ verifiedBy: 'inline' }), /Agent verification: Self-review/);
  assert.match(run({ verifiedBy: 'agents' }), /Agent verification: Verified by separate reviewer agents/);
  assert.match(run({ verifiedBy: 'bogus' }), /Agent verification: Not run/, 'an unknown value never counts as verified');
});
