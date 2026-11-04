import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseArgs } from '../scripts/lib/cli.mjs';
import { buildModel, keyOf } from '../scripts/summary/model.mjs';
import { collect } from '../scripts/summary/collect.mjs';
import { toMarkdown } from '../scripts/summary/markdown.mjs';
import { toHtml } from '../scripts/summary/html.mjs';
import { project } from './helpers.mjs';

const kit = join(dirname(fileURLToPath(import.meta.url)), '..');
const NOW = new Date('2026-11-04T21:30:00Z');
const config = { name: 'demo', structure: { roots: ['src'], layers: [], gate: ['cycles'], size: { maxFileLines: 3 } } };
const files = { 'src/a.ts': "import { b } from './b';\nexport const a = b;\nexport const a2 = 1;\nexport const a3 = 2;\n", 'src/b.ts': "import { a } from './a';\nexport const b = a;\n" };
const model = (extra, cfg = config, f = files) => buildModel(collect(cfg, project(f)), extra, { now: NOW, project: 'demo', kitVersion: '9.9.9' });

test('parseArgs reads every value flag and keeps the config path', () => {
  const a = parseArgs(['cfg.json', '--report', 'r.md', '--html', 'p.html', '--extra', 'e.json', '--areas', 'a,b', '--json']);
  assert.deepEqual(a, { report: 'r.md', html: 'p.html', extra: 'e.json', areas: 'a,b', json: true, configPath: 'cfg.json' });
  assert.equal(parseArgs([]).configPath, undefined);
});

test('a failed gated check makes the verdict Not ready, and rows are plain and ranked', () => {
  const m = model();
  assert.equal(m.verdict, 'Not ready');
  assert.ok(m.counts.mustFix >= 1);
  assert.equal(m.rows[0].mustFix, true);
  assert.match(m.rows[0].meaning, /depend on each other in a loop/);
  assert.deepEqual(m.rows.map((r) => r.n), m.rows.map((_, i) => i + 1));
  assert.ok(m.terms.some((t) => t.term === 'circular import'));
  assert.ok(m.terms.some((t) => t.term === 'gated check'));
});

test('verified extras drop, override and add rows, and change the verdict', () => {
  const base = model();
  const dropAll = model({ drop: base.rows.map((r) => r.key) });
  assert.equal(dropAll.verdict, 'Ready');
  const high = model({ drop: base.rows.map((r) => r.key), add: [{ area: 'tests', severity: 'High', where: 'src/a.ts', what: 'x', meaning: 'm', impact: 'i', fix: 'f' }] });
  assert.equal(high.verdict, 'Ready after fixes');
  const blocker = model({ drop: base.rows.map((r) => r.key), add: [{ area: 'security', severity: 'Blocker', where: 'rules', what: 'x', fix: 'f' }] });
  assert.equal(blocker.verdict, 'Not ready');
  assert.equal(blocker.areas.find((a) => a.area === 'security').title, 'Security');
  const key = base.rows.find((r) => r.mustFix).key;
  assert.equal(model({ override: { [key]: { severity: 'Low' } } }).rows.find((r) => r.key === key).severity, 'Low');
  assert.equal(keyOf('structure', 'cycles', 'src/a.ts'), 'structure:cycles|src/a.ts');
});

test('markdown has every section and a decision column', () => {
  const md = toMarkdown(model());
  for (const h of ['## Verdict', '## Fix first', '## Your decisions', '## By area', '## Terms used', '## What we could not check']) assert.ok(md.includes(h), h);
  assert.match(md, /Your decision/);
  assert.match(md, /Version 9\.9\.9 - Nov 4, 2026, 3:30 PM CST/);
});

test('the page is complete, escapes text, and has a gray footer with the version', () => {
  const html = toHtml(model({ add: [{ area: 'tests', severity: 'Low', where: '<b>x</b>', what: '"q" & <i>', fix: 'f' }] }));
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /<footer>Version 9\.9\.9 - Nov 4, 2026/);
  assert.match(html, /footer\{background-color:var\(--foot\)/);
  assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;'));
  assert.ok(!html.includes('<b>x</b>'));
});

test('summary.mjs writes the page and report and exits 1 when something must be fixed', () => {
  const root = project({ ...files, 'review.config.json': config });
  const run = (...a) => spawnSync('node', [join(kit, 'scripts/summary.mjs'), ...a], { cwd: root, encoding: 'utf8' });
  const r = run('--html', join(root, 'p.html'), '--report', join(root, 's.md'));
  assert.equal(r.status, 1);
  assert.ok(existsSync(join(root, 'p.html')) && existsSync(join(root, 's.md')));
  assert.match(readFileSync(join(root, 's.md'), 'utf8'), /\*\*Not ready\*\*/);
  const clean = project({ 'src/a.ts': 'export const a = 1;\n', 'review.config.json': { name: 'ok', structure: { roots: ['src'], layers: [] } } });
  assert.equal(spawnSync('node', [join(kit, 'scripts/summary.mjs')], { cwd: clean, encoding: 'utf8' }).status, 0);
});

test('the kit summarises its own agents with --areas and no config', () => {
  const r = spawnSync('node', [join(kit, 'scripts/summary.mjs'), '--areas', 'agents'], { cwd: kit, encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Checks run: agents/);
});
