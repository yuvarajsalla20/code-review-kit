// 1.15.0: the 2026-11-21 review fixes outside the secrets scan (see scan.test.mjs): roots that hold no code, hand-off checks,
// unconfirmed and dropped rows, probes, accepts that stick, typed unions, kit-owned packages, reviewers on trust, email attachments.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AREAS } from '../scripts/areas.mjs';
import { applyAccepted } from '../scripts/lib/accepted.mjs';
import { ConfigError } from '../scripts/lib/findings.mjs';
import { runAgents } from '../scripts/agents/index.mjs';
import { attachments, emailSettings, gitStatus } from '../scripts/email/index.mjs';
import { runStructure } from '../scripts/structure/index.mjs';
import { findRepeatedValues } from '../scripts/structure/dupes.mjs';
import { collect } from '../scripts/summary/collect.mjs';
import { decide } from '../scripts/summary/decide.mjs';
import { buildModel, checkExtra, plainLine } from '../scripts/summary/model.mjs';
import { toMarkdown } from '../scripts/summary/markdown.mjs';
import { toHtml } from '../scripts/summary/html.mjs';
import { project } from './helpers.mjs';

const kit = join(import.meta.dirname, '..');
const node = (script, cwd, ...args) => spawnSync('node', [join(kit, 'scripts', script), ...args], { cwd, encoding: 'utf8' });
const LOOP = { 'lib/a.js': "import './b.js';\nexport const a = 1;\n", 'lib/b.js': "import './a.js';\nexport const b = 1;\n" };
const SKIPS = { skipAreas: Object.fromEntries(['release', 'tests', 'speed', 'links', 'widgets', 'agents'].map((a) => [a, 'not part of this test'])) };

test('a configured root that does not exist, or roots with no code, stop the check instead of passing on nothing', () => {
  // The reviewer's repro: code in lib/, roots ['src'], gated cycles: 1.14.0 printed PASS cycles and the summary said Ready.
  const wrong = project({ ...LOOP, 'review.config.json': { name: 'p', structure: { roots: ['src'], gate: ['cycles'] }, ...SKIPS } });
  const c = node('check.mjs', wrong);
  assert.equal(c.status, 2);
  assert.match(c.stderr, /Config problem: structure\.roots: src does not exist/);
  assert.doesNotMatch(c.stdout, /PASS {2}cycles/);
  const s = node('summary.mjs', wrong);
  assert.equal(s.status, 2);
  assert.doesNotMatch(s.stdout, /Ready/);
  const right = project({ ...LOOP, 'review.config.json': { name: 'p', structure: { roots: ['lib'], gate: ['cycles'] }, ...SKIPS } });
  const ok = node('check.mjs', right);
  assert.equal(ok.status, 1);
  assert.match(ok.stdout, /Read 2 files\.\nFAIL {2}cycles \(1\)/);
  assert.throws(() => runStructure({}, project({ 'lib/a.js': '' })), /structure\.roots \(src\) holds no source files/, 'the default root, when absent, finds nothing: that stops too');
  assert.throws(() => runStructure({ structure: { roots: ['lib'], extra: ['firestore.rule'] } }, project({ 'lib/a.js': '' })), /structure\.extra: firestore\.rule not found/);
  for (const key of ['links', 'widgets']) {
    const area = AREAS.find((a) => a.key === key);
    assert.throws(() => area.run({ [key]: { roots: ['scr'] } }, project({ 'src/a.ts': '' })), new RegExp(`${key}\\.roots: scr does not exist`));
  }
  assert.throws(() => AREAS.find((a) => a.key === 'tests').run({ structure: { roots: ['scr'] } }, project({ 'src/a.ts': '', 'tests/a.test.ts': '' })), /scr does not exist/);
});

test('hand-off levels and results are read whatever their case, and anything else names the file and row', () => {
  // The reviewer's repro: 'high', 'FAIL' and 'failed' gave Ready, High 0, failedRuns 0 in 1.14.0.
  const m = buildModel([], { add: [{ area: 'logic', severity: 'high', where: 'a.ts:1', what: 'x' }], results: [{ name: 'tests', result: 'FAIL' }, { name: 'load', result: 'failed' }, { name: 'e2e', result: 'Error' }, { name: 'unit', result: 'Passed' }] });
  assert.equal(m.verdict, 'Not ready');
  assert.equal(m.counts.High, 1);
  assert.equal(m.counts.failedRuns, 3);
  assert.deepEqual(m.results.map((r) => r.result), ['fail', 'fail', 'fail', 'pass']);
  assert.throws(() => checkExtra({ add: [{ area: 'logic', severity: 'Critical', where: 'a.ts:1', what: 'x' }] }, 'review-out/security.json'), (e) => e instanceof ConfigError && /review-out\/security\.json, add row 1 \(a\.ts:1\): severity "Critical" is not a level/.test(e.message));
  assert.throws(() => checkExtra({ add: [{ area: 'logic', where: 'a.ts:1' }] }, 'f.json'), /f\.json, add row 1 \(a\.ts:1\): severity is missing/);
  assert.throws(() => checkExtra({ results: [{ name: 'load' }] }, 'r.json'), /r\.json, results entry 1 \("load"\): result is missing/);
  assert.throws(() => checkExtra({ results: [{ name: 'load', result: 'flaky' }] }, 'r.json'), /"flaky" is not pass or fail/);
  assert.throws(() => checkExtra({ override: { k: { severity: 'urgent' } } }, 'v.json'), /v\.json, override "k": severity "urgent"/);
  const root = project({ 'src/a.ts': 'export const a = 1;\n', 'bad.json': { results: [{ name: 'tests', result: 'FAIL!' }] }, 'review.config.json': { name: 'p', structure: { roots: ['src'] } } });
  const cli = node('summary.mjs', root, '--extra', 'bad.json');
  assert.equal(cli.status, 2);
  assert.match(cli.stderr, /Config problem: bad\.json, results entry 1 \("tests"\)/);
});

test('a probe is listed apart and never counts as a failed test run', () => {
  const m = buildModel([], { results: [{ name: 'unit', result: 'pass' }, { name: 'repeat-reminder repro', kind: 'probe', result: 'fail', detail: 'shows the bug' }] });
  assert.equal(m.verdict, 'Ready');
  assert.equal(m.counts.failedRuns, 0);
  assert.deepEqual(m.results.map((r) => r.name), ['unit']);
  assert.deepEqual(m.probes.map((r) => r.name), ['repeat-reminder repro']);
  for (const out of [toMarkdown(m), toHtml(m)]) assert.match(out, /Bug checks by reviewers[\s\S]*repeat-reminder repro/);
  assert.equal(buildModel([], { results: [{ name: 'unit', kind: 'RUN', result: 'fail' }] }).verdict, 'Not ready');
  assert.throws(() => checkExtra({ results: [{ name: 'x', kind: 'repro', result: 'fail' }] }, 'r.json'), /kind "repro" is not run or probe/);
});

test('a row with no proof or proof "unverified" says it is not confirmed, never "Read in the code"', () => {
  const m = buildModel([], { add: [{ area: 'logic', severity: 'Medium', where: 'a.ts:1', what: 'x' }, { area: 'logic', severity: 'Low', where: 'b.ts:1', what: 'y', proof: 'Unverified', confirm: 'a run on a real phone' }, { area: 'logic', severity: 'Low', where: 'c.ts:1', what: 'z', proof: 'code' }] });
  assert.deepEqual(m.rows.map((r) => r.proof), ['unverified', 'unverified', 'code']);
  const md = toMarkdown(m);
  assert.match(md, /Not confirmed: no one has checked it yet/);
  assert.match(md, /Not confirmed: a run on a real phone/);
  assert.equal((md.match(/Read in the code/g) ?? []).length, 1);
});

const loopConfig = { name: 'demo', structure: { roots: ['src'], gate: ['cycles'] } };
const loopFiles = { 'src/a.ts': "import { b } from './b';\nexport const a = b;\n", 'src/b.ts': "import { a } from './a';\nexport const b = a;\n" };

test('a dropped row is listed with its reason, so a gated row cannot vanish without a word', () => {
  const collected = collect(loopConfig, project(loopFiles));
  const key = buildModel(collected, {}).rows.find((r) => r.check === 'cycles').key;
  const m = buildModel(collected, { drop: [key], dropReasons: { [key]: 'type-only: the loop is two interfaces' } });
  assert.equal(m.verdict, 'Ready');
  assert.deepEqual(m.dropped.map((d) => [d.key, d.mustFix, d.reason]), [[key, true, 'type-only: the loop is two interfaces']]);
  for (const out of [toMarkdown(m), toHtml(m)]) assert.match(out, /Dropped by reviewers[\s\S]*type-only: the loop is two interfaces/);
  assert.equal(buildModel(collected, { drop: [key] }).dropped[0].reason, 'No reason given');
});

test('Fix first never shows a double period', () => {
  assert.equal(plainLine({ meaning: 'Repeating items sit on their last occurrence.', impact: 'People see nothing.' }), 'Repeating items sit on their last occurrence. People see nothing.');
  assert.equal(plainLine({ meaning: 'A', impact: 'B.' }), 'A. B.');
  assert.equal(plainLine({ meaning: 'Only this.', impact: '' }), 'Only this.');
  assert.equal(plainLine({ meaning: 'Ends with dots...', impact: 'Then this' }), 'Ends with dots. Then this.');
});

test('decide writes entries that match again: the first file of a multi-place row, and contains without counts', () => {
  // The reviewer's repro: both entries came back STALE in 1.14.0.
  const rows = [
    { n: 1, area: 'structure', check: 'duplicates', where: 'src/a.ts:3-20 | src/b.ts:9-26', technical: '18 identical lines in 2 places' },
    { n: 2, area: 'structure', check: 'size', where: 'src/big.ts:1-120', technical: 'render has 120 lines (limit 80)', subject: 'render has' },
    { n: 3, area: 'structure', check: 'repeated', where: 'src/a.ts:4 | src/b.ts:7 | src/c.ts:2', technical: 'The same text already-taken is written out in 3 places', subject: 'already-taken' },
  ];
  const md = '## Your decisions\n\n| # | Level | Your decision |\n|---|---|---|\n| 1 | Low | accept: generated |\n| 2 | Low | accept: layout |\n| 3 | Low | accept: one message |\n';
  const { entries } = decide(md, { rows }, '2026-11-21');
  assert.deepEqual(entries.map((e) => [e.file, e.contains]), [['src/a.ts', undefined], ['src/big.ts', 'render has'], ['src/a.ts', 'already-taken']]);
  const later = { findings: [
    { check: 'duplicates', where: 'src/a.ts:4-21 | src/b.ts:9-26', what: '18 identical lines in 2 places' },
    { check: 'size', where: 'src/big.ts:1-121', what: 'render has 121 lines (limit 80)' },
    { check: 'repeated', where: 'src/a.ts:4 | src/b.ts:7 | src/c.ts:2 | src/d.ts:1', what: 'The same text already-taken is written out in 4 places' },
  ], counts: { duplicates: 1, size: 1, repeated: 1 }, gate: [] };
  const out = applyAccepted(later, entries, 'structure');
  assert.equal(out.accepted.length, 3);
  assert.equal(out.stale.length, 0);
});

test('the script rows carry a subject without counts, and decide uses it', () => {
  const root = project({ 'src/big.ts': `export function render() {\n${'  const x = 1;\n'.repeat(5)}}\n` });
  const result = runStructure({ structure: { roots: ['src'], size: { maxFunctionLines: 3 } } }, root);
  const m = buildModel([{ area: 'structure', result }], {});
  const row = m.rows.find((r) => r.check === 'size');
  assert.equal(row.subject, 'render has');
  const { entries } = decide(`## Your decisions\n\n| # | Your decision |\n|---|---|\n| ${row.n} | accept: fine |\n`, m, 'd');
  assert.equal(entries[0].contains, 'render has');
});

test('members of a string-literal union are not repeated text; typedUnions: false counts them again', () => {
  // app-invite-kit: 'already-connected' and 'host-connected', all members or returns of the InviteProblem union.
  const texts = new Map([
    ['src/types.ts', "export type InviteProblem =\n  | 'not-found'\n  | 'host-connected'\n  | 'already-connected';\nexport type R = { ok: false; problem: 'already-connected' | 'full' };"],
    ['src/a.ts', "return { ok: false, problem: 'already-connected' };\nif (p === 'host-connected') x();"],
    ['src/b.ts', "return { ok: false, problem: 'already-connected' };\nreturn 'host-connected';"],
    ['src/c.ts', "const label = 'not a union member' || 'other value!';\nshow('Something went wrong');"],
    ['src/d.ts', "const x = a || 'not a union member';\nshow('Something went wrong');"],
    ['src/e.ts', "const y = 'not a union member';\nshow('Something went wrong');"],
  ]);
  const values = (opts) => findRepeatedValues(texts, opts).map((r) => r.value).sort();
  assert.deepEqual(values(), ['Something went wrong', 'not a union member']);
  assert.deepEqual(values({ typedUnions: false }), ['Something went wrong', 'already-connected', 'host-connected', 'not a union member']);
});

test('owned: an app importing what a kit owns is a row, off unless configured, narrowed by names and allowIn', () => {
  const files = {
    'src/share.ts': "import * as Sharing from 'expo-sharing';\nexport const go = (u: string) => Sharing.shareAsync(u);\n",
    'src/save.ts': "import { writeAsStringAsync, documentDirectory } from 'expo-file-system';\nexport const save = (t: string) => writeAsStringAsync(documentDirectory + 'a.csv', t);\n",
    'src/read.ts': "import * as FileSystem from 'expo-file-system';\nexport const read = (u: string) => FileSystem.readAsStringAsync(u);\n",
    'src/write2.ts': "import * as FileSystem from 'expo-file-system';\nexport const w = (u: string) => FileSystem.writeAsStringAsync(u, 'x');\n",
    'src/auth/google.ts': "import { GoogleSignin } from '@react-native-google-signin/google-signin';\nexport const g = GoogleSignin;\n",
    'src/login.ts': "const { GoogleSignin } = require('@react-native-google-signin/google-signin');\nexport const g = GoogleSignin;\n",
    'src/types.ts': "import type { FileInfo } from 'expo-file-system';\nexport type F = FileInfo;\n",
  };
  const root = project(files);
  assert.equal(runStructure({ structure: { roots: ['src'] } }, root).findings.filter((f) => f.check === 'owned').length, 0, 'off unless configured');
  const owned = [
    { kit: 'app-export-kit', modules: ['expo-sharing', 'expo-file-system'], names: ['shareAsync', 'writeAsStringAsync'] },
    { kit: 'app-auth-kit', modules: ['@react-native-google-signin/google-signin'], allowIn: ['src/auth'] },
  ];
  const rows = runStructure({ structure: { roots: ['src'], owned } }, root).findings.filter((f) => f.check === 'owned');
  assert.deepEqual(rows.map((r) => r.where).sort(), ['src/login.ts:1', 'src/save.ts:1', 'src/share.ts:1', 'src/write2.ts:1']);
  assert.equal(rows.find((r) => r.where === 'src/save.ts:1').what, 'writeAsStringAsync from "expo-file-system" is used here, but app-export-kit owns it');
  assert.ok(rows.every((r) => !r.gate), 'advisory unless the owner gates it');
  assert.throws(() => runStructure({ structure: { roots: ['src'], owned: [{ modules: ['x'] }] } }, root), /structure\.owned rule 1: "kit"/);
  assert.throws(() => runStructure({ structure: { roots: ['src'], owned: [{ kit: 'k', modules: [] }] } }, root), /"modules" must list at least one package/);
});

test('the agents check says which reviewers have Bash on trust', () => {
  const agent = (tools) => `---\nname: a\ndescription: d\ntools: ${tools}\n---\n## Method\nx\n## Rules\nSee \`rules/review-rules.md\`.\n## Output\nx\n`;
  const root = project({ 'rules/review-rules.md': '#', 'agents/x/a.md': agent('Read, Grep, Bash'), 'skills/s/SKILL.md': '`a`' });
  const r = runAgents({}, root);
  assert.equal(r.findings.filter((f) => f.check === 'frontmatter').length, 0);
  assert.match(r.notes[0], /Bash is allowed on trust in 1 of 1 reviewers \(agents\/x\/a\.md\)/);
  assert.match(node('agents.mjs', root).stdout, /## Allowed on trust/);
  assert.deepEqual(runAgents({}, project({ 'rules/review-rules.md': '#', 'agents/x/a.md': agent('Read, Grep'), 'skills/s/SKILL.md': '`a`' })).notes, []);
});

test('untouched.mjs shows whether a reviewer changed the project', () => {
  const root = project({ 'src/a.ts': 'export const a = 1;\n', 'review-out/keep.json': '{}' });
  assert.equal(node('untouched.mjs', root, '--save', 'review-out/before.json').status, 0);
  writeFileSync(join(root, 'review-out', 'security.json'), '{}');
  writeFileSync(join(root, 'summary.md'), '# s');
  const clean = node('untouched.mjs', root, '--compare', 'review-out/before.json');
  assert.equal(clean.status, 0, 'the review\'s own output never counts');
  assert.match(clean.stdout, /Untouched/);
  writeFileSync(join(root, 'src', 'a.ts'), 'export const a = 2;\n');
  writeFileSync(join(root, 'src', 'b.ts'), '');
  const changed = node('untouched.mjs', root, '--compare', 'review-out/before.json');
  assert.equal(changed.status, 1);
  assert.match(changed.stdout, /Added {2}src\/b\.ts/);
  assert.match(changed.stdout, /Changed {2}src\/a\.ts/);
  assert.equal(node('untouched.mjs', root).status, 2);
});

test('email: attachments outside the project, .env files and the addresses file are refused; a missing git does not crash', () => {
  const root = project({ 'summary.html': '<html></html>', '.env': 'X=1' });
  const s = (attach) => ({ ...emailSettings({ email: {} }), attach });
  assert.deepEqual(attachments(root, s(['summary.html'])).found.map((a) => a.name), ['summary.html']);
  assert.throws(() => attachments(root, s(['../other/secret.txt'])), /outside the project/);
  assert.throws(() => attachments(root, s(['/etc/passwd'])), /outside the project/);
  assert.throws(() => attachments(root, s(['.env'])), /never attached/);
  assert.throws(() => attachments(root, s(['config/.env.production'])), /never attached/);
  assert.throws(() => attachments(root, s(['review.email.json'])), /never attached/);
  assert.deepEqual(gitStatus(root, 'review.email.json', 'git-that-is-not-installed'), { git: false, tracked: false, ignored: false });
});
